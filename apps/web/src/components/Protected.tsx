import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

export function Protected({ role, children }: { role?: "COACH" | "MEMBER"; children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
