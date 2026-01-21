import { handleRegister, handleLogin } from "../../services/auth";

export function initUI(gameStarter: { start(): void; stop(): void }) {
  const registerBtn = document.getElementById("registerBtn") as HTMLButtonElement;
  const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;
  const regUser = document.getElementById("regUser") as HTMLInputElement;
  const regPass = document.getElementById("regPass") as HTMLInputElement;
  const loginUser = document.getElementById("loginUser") as HTMLInputElement;
  const loginPass = document.getElementById("loginPass") as HTMLInputElement;
  const authStatus = document.getElementById("authStatus") as HTMLElement;

  registerBtn.addEventListener("click", async () => {
    const u = regUser.value.trim();
    const p = regPass.value;
    if (!u || !p) { authStatus.textContent = "username & password required"; return; }
    const r = await handleRegister(u, p);
    authStatus.textContent = r.ok ? `Registered ${u}` : `Register failed: ${(r.body && r.body.error) || r.status || r.error}`;
  });

  loginBtn.addEventListener("click", async () => {
    const u = loginUser.value.trim();
    const p = loginPass.value;
    if (!u || !p) { authStatus.textContent = "username & password required"; return; }
    const r = await handleLogin(u, p);
    if (r.ok) {
      authStatus.textContent = `Logged in as ${r.body.username}`;
    } else {
      authStatus.textContent = `Login failed: ${(r.body && r.body.error) || r.status || r.error}`;
    }
  });

  return {
    // refreshAliasList,
    setAuthStatus(text: string) { authStatus.textContent = text; },
  };
}