import { registerUser, loginUser } from "./api";

export async function handleRegister(username: string, email: string, password: string) {
  const res = await registerUser(username, email, password);
  return res;
}

export async function handleLogin(username: string, password: string) {
  const res = await loginUser(username, password);
  return res;
}