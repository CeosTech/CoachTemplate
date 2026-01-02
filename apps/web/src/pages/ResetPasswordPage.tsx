import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthApi } from "../api/auth";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const disabled = !token || loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!token) {
      setStatus({ tone: "error", message: "Lien invalide." });
      return;
    }
    if (!password || password.length < 8) {
      setStatus({ tone: "error", message: "Utilise au moins 8 caractères." });
      return;
    }
    if (password !== confirm) {
      setStatus({ tone: "error", message: "Les mots de passe doivent être identiques." });
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.resetPassword({ token, password });
      setStatus({ tone: "success", message: res.message || "Mot de passe mis à jour." });
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible de mettre à jour le mot de passe." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--compact">
        <p className="raw-eyebrow">Nouveau mot de passe</p>
        <h2>Protège ton accès</h2>
        {!token && <p className="auth-card__status auth-card__status--error">Lien invalide ou expiré.</p>}
        {status && <div className={`auth-card__status auth-card__status--${status.tone === "success" ? "success" : "error"}`}>{status.message}</div>}
        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Nouveau mot de passe</span>
            <input type="password" value={password} placeholder="********" onChange={(e) => setPassword(e.target.value)} disabled={disabled} />
          </label>
          <label>
            <span>Confirmation</span>
            <input type="password" value={confirm} placeholder="********" onChange={(e) => setConfirm(e.target.value)} disabled={disabled} />
          </label>
          <button className="btn auth-btn" type="submit" disabled={disabled}>
            {loading ? "Mise à jour..." : "Enregistrer"}
          </button>
        </form>
        <p className="auth-card__hint">
          <Link to="/login" className="auth-link">
            Retourner à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
