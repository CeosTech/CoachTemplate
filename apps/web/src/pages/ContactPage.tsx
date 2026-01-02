import { useState } from "react";
import { PublicApi } from "../api/public";

export function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      await PublicApi.contact({ fullName, email, subject, message });
      setStatus("success");
      setFullName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <div className="auth-page contact-layout">
      <aside className="contact-highlight">
        <div className="contact-highlight__media">
          <img
            src="https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=700&q=60"
            alt="Coach accompagnant un client lors d'une séance"
          />
        </div>
        <div className="contact-highlight__body">
          <p className="raw-eyebrow">Coaching sur-mesure</p>
          <h3>Tu n&apos;es pas seul pour atteindre tes objectifs</h3>
          <p>
            Analyse biomécanique, plan d&apos;action personnalisé, feedback vidéo et motivation continue.
            L&apos;accompagnement d&apos;un coach te permet d&apos;éviter les blessures, de suivre un plan qui évolue avec
            toi et de transformer chaque séance en progrès concret.
          </p>
          <ul>
            <li>Plan entraînement + nutrition ajusté chaque semaine</li>
            <li>Points de contrôle réguliers et reporting clair</li>
            <li>Support WhatsApp / vidéo pour corriger la technique</li>
          </ul>
        </div>
      </aside>
      <div className="auth-card contact-form">
        <p className="raw-eyebrow">Contact</p>
        <h2>Parlons de tes objectifs</h2>
        {status === "success" && <div className="auth-card__status raw-contact__status--ok">Message envoyé ✅</div>}
        {error && <div className="auth-card__status auth-card__status--error">{error}</div>}
        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Nom complet</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" required />
          </label>
          <label>
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          </label>
          <label>
            <span>Sujet</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" required />
          </label>
          <label>
            <span>Message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explique ton besoin" required />
          </label>
          <button className="btn auth-btn" type="submit" disabled={status === "loading"}>
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
}
