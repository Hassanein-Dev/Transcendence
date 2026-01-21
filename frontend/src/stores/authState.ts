import { me } from "../services/api";
import { getToken, setToken, removeToken } from "../services/api";

type Subscriber = (user: any | null) => void;

let currentUser: any | null = null;
const subscribers: Subscriber[] = [];

// Call on app startup to hydrate auth state from stored token
export async function initAuth() {
  await new Promise(resolve => setTimeout(resolve, 50));
  const token = getToken();
  
  if (!token) {
    currentUser = null;
    notify();
    return currentUser;
  }
  
  const r = await me();
  
  if (r.ok && r.body) {
    currentUser = {
      id: r.body.id,
      username: r.body.username,
      picture: r.body.picture || r.body.avatarUrl,
      email: r.body.email,
      created_at: r.body.created_at,
      ...r.body
    };
  } else {
    // Token invalid or expired -> clear token
    if (r.status === 401) {
      removeToken();
      currentUser = null;
    }
  }
  notify();
  return currentUser;
}

export function subscribe(fn: Subscriber) {
  subscribers.push(fn);
  // call immediately with current state
  fn(currentUser);
  return () => {
    const i = subscribers.indexOf(fn);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

function notify() {
  for (const s of subscribers) s(currentUser);
}

export function getCurrentUser() {
  return currentUser;
}

// Set current user (for OAuth login)
export function setCurrentUser(user: any) {
  currentUser = user;
  notify();
}

// Logout client-side (stateless JWT) — clears token and notifies subscribers
export function logout() {
  removeToken();
  currentUser = null;
  notify();
}