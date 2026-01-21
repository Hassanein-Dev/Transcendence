const API_BASE = `/api`; // Nginx proxies /api to backend

export type ApiResult = { ok: boolean; status: number; body: any; error?: string };

function safePreview(body: any) {
  try {
    return typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200);
  } catch {
    return String(body);
  }
}

export function setToken(token: string | null, persistent = true) {
  if (token) {
    if (persistent) {
      localStorage.setItem("token", token);
      sessionStorage.removeItem("token");
    } else {
      sessionStorage.setItem("token", token);
      localStorage.removeItem("token");
    }
  } else {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  }
}

export function getToken(): string | null {
  const session = sessionStorage.getItem("token");
  const local = localStorage.getItem("token");
  const token = session || local;
  return token;
}

export function removeToken() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

async function request(path: string, opts: RequestInit = {}): Promise<ApiResult> {
  const method = (opts.method || "GET").toUpperCase();
  const url = `${API_BASE}${path}`;

  // Attach token if available
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  opts.headers = headers;

  try {
    const res = await fetch(url, opts);
    const contentType = res.headers.get("content-type") || "";
    let body: any = null;
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }
    
    // Handle 401 errors - but don't log expected auth failures (login/register)
    if (res.status === 401 && path !== '/login' && path !== '/register') {
      // Auto-logout on 401 to prevent stuck state (except for auth endpoints)
      removeToken();
      // Dispatch custom event to trigger logout
      window.dispatchEvent(new CustomEvent('auth-error', { detail: { status: 401 } }));
    }
    
    return { ok: res.ok, status: res.status, body };
  } catch (err: any) {
    return { ok: false, status: 0, body: null, error: err?.message || String(err) };
  }
}

// Auth endpoints
export async function registerUser(username: string, email: string, password: string) {
  return request("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginUser(identifier: string, password: string, code?: string) {
  return request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password, code }),
  });
}

// Password reset APIs
export async function requestPasswordReset(email: string) {
  return request("/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  return request("/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function me() {
  return request("/me", { method: "GET" });
}

// Profile / user APIs
export async function getUserProfile(userId: number | string) {
  return request(`/users/${userId}`, { method: "GET" });
}

export async function updateUserProfile(userId: number | string, data: any) {
  return request(`/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getUserGames(userId: number | string) {
  return request(`/users/${userId}/games`, { method: "GET" });
}

// Add to existing API functions (friends, tournaments, etc.)

// Friend system APIs
export async function getFriends() {
  return request("/friends", { method: "GET" });
}

export async function getFriendRequests() {
  return request("/friends/requests", { method: "GET" });
}

export async function sendFriendRequest(friendUsername: string) {
  return request("/friends/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendUsername })
  });
}

export async function handleFriendAction(friendId: number, action: 'accept' | 'reject' | 'block' | 'unfriend') {
  return request("/friends/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendId, action })
  });
}

export async function getBlockedUsers() {
  return request("/friends/blocked", { method: "GET" });
}

export async function getFriendSuggestions() {
  return request("/friends/suggestions", { method: "GET" });
}

export async function blockUser(userId: number) {
  return handleFriendAction(userId, 'block');
}

export async function unblockUser(userId: number) {
  // Unblock by removing the block entry
  return request("/friends/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendId: userId, action: 'unfriend' })
  });
}

export async function searchUsers(query: string) {
  return request(`/users/search?q=${encodeURIComponent(query)}`, { method: "GET" });
}

export async function saveGameResult(tournamentId: string, gameData: {
  player1Id: string;
  player2Id: string;
  winnerId: string;
  scores: [number, number];
  tournamentMatchId?: string;
}) {
  return request(`/tournaments/${tournamentId}/game-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gameData),
  });
}

export async function getTournamentMatches(tournamentId: string) {
  return request(`/tournaments/${tournamentId}/matches`, { method: "GET" });
}

export async function startTournament(tournamentId: string) {
  return request(`/tournaments/${tournamentId}/start`, { method: "POST" });
}

// Admin APIs
// Admin: Create multiple users
export async function adminCreateUsers(users: Array<{ username: string; email: string; password: string }>) {
  return request('/admin/create-users', {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ users }),
  });
}

// Admin: Generate 10 connected users (all friends)
export async function adminGenerateConnectedUsers() {
  return request('/admin/generate-connected-users', {
    method: 'POST',
  });
}

// Admin: Generate 10 standalone users (no friends)
export async function adminGenerateStandaloneUsers() {
  return request('/admin/generate-standalone-users', {
    method: 'POST',
  });
}

// Admin: List all users
export async function adminListUsers() {
  return request('/admin/users', {
    method: 'GET',
  });
}

export async function adminDeleteUser(userId: number | string) {
  return request(`/admin/users/${userId}`, { method: "DELETE" });
}

// News
export async function adminCreateNews(data: { title: string, content: string, type: 'news' | 'event', event_date?: string }) {
  return request('/news', {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export async function adminDeleteNews(id: number) {
  return request(`/news/${id}`, {
    method: 'DELETE'
  });
}

export async function getNews() {
  return request('/news', {
    method: 'GET'
  });
}