import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthApi } from "../api/auth";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!email) {
      setStatus({ tone: "error", message: "Ajoute ton email." });
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.forgotPassword({ email });
      setStatus({ tone: "success", message: res.message || "Un email arrive si le compte existe." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible d'envoyer le lien." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--compact">
        <p className="raw-eyebrow">Réinitialisation</p>
        <h2>Tu as oublié ton mot de passe ?</h2>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Entre ton email et reçois un lien valable 1h.</p>
        {status && <div className={`auth-card__status auth-card__status--${status.tone === "success" ? "success" : "error"}`}>{status.message}</div>}
        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Email</span>
            <input type="email" placeholder="email@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn auth-btn" type="submit" disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
        <p className="auth-card__hint">
          <Link to="/login" className="auth-link">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
