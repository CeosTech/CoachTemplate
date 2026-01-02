import { useState } from "react";
import { AuthApi } from "../api/auth";
import { useAuthStore } from "../store/auth.store";
import { Link, useNavigate } from "react-router-dom";

export function LoginPage() {
  const [email, setEmail] = useState("member@demo.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await AuthApi.login({ email, password });
      setAuth(data.accessToken, data.user);
      nav(data.user.role === "COACH" ? "/coach" : "/member");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--compact">
        <p className="raw-eyebrow">Connexion</p>
        <h2>Rejoins ton espace</h2>
        {error && <div className="auth-card__status auth-card__status--error">{error}</div>}
        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" type="email" />
          </label>
          <label>
            <span>Mot de passe</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
          </label>
          <div style={{ textAlign: "right", fontSize: 14 }}>
            <Link to="/forgot-password" className="auth-link">
              Mot de passe oublié ?
            </Link>
          </div>
          <button type="submit" className="btn auth-btn">Se connecter</button>
        </form>
        <p className="auth-card__hint">
          Demo: <b>member@demo.com</b> / <b>Password123!</b> ou <b>coach@demo.com</b>
        </p>
        <p className="auth-card__hint">
          Pas encore membre ?{" "}
          <Link to="/register" className="auth-link">
            Crée ton profil
          </Link>
        </p>
      </div>
    </div>
  );
}
