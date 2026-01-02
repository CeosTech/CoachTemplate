import { create } from "zustand";

type Role = "COACH" | "MEMBER";

export type AuthState = {
  accessToken: string | null;
  user: null | { id: string; email: string; role: Role };
  setAuth: (token: string, user: any) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("accessToken"),
  user: localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user") as string) : null,
  setAuth: (token, user) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ accessToken: token, user });
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    set({ accessToken: null, user: null });
  }
}));
