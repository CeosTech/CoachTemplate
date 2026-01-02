import { apiFetch } from "./client";

export const AuthApi = {
  register: (payload: any) => apiFetch<any>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: any) => apiFetch<any>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  forgotPassword: (payload: { email: string }) => apiFetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload: { token: string; password: string }) => apiFetch<{ message: string }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
  me: (token: string) => apiFetch<any>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
};
