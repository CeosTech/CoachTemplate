import { useState } from "react";
import { AuthApi } from "../api/auth";
import { useAuthStore } from "../store/auth.store";
import { useNavigate } from "react-router-dom";
import { MEMBER_GOAL_PRESETS, MEMBER_LEVEL_PRESETS } from "../constants/memberPresets";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [preferredTraining, setPreferredTraining] = useState("");
  const [limitations, setLimitations] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await AuthApi.register({
        email,
        password,
        fullName,
        goal,
        level,
        age: age ? Number(age) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        preferredTraining,
        limitations
      });
      setAuth(data.accessToken, data.user);
      nav("/member");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--compact">
        <p className="raw-eyebrow">Onboarding membre</p>
        <h2>Crée ton profil</h2>
        {error && <div className="auth-card__status auth-card__status--error">{error}</div>}

        <form onSubmit={submit} className="auth-form auth-form--grid">
          <label>
            <span>Nom complet</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" />
          </label>
          <label>
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" type="email" />
          </label>
          <label>
            <span>Mot de passe</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" type="password" />
          </label>
          <label>
            <span>Âge</span>
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Âge" type="number" />
          </label>
          <label>
            <span>Taille (cm)</span>
            <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="Taille" type="number" />
          </label>
          <label>
            <span>Poids (kg)</span>
            <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="Poids" type="number" />
          </label>
          <label>
            <span>Objectif principal</span>
            <input list="signup-goal-presets" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Choisis ou écris ton objectif" />
          </label>
          <label>
            <span>Niveau actuel</span>
            <input list="signup-level-presets" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Débutant, Intermédiaire..." />
          </label>
          <label className="auth-form__full">
            <span>Préférences / matériel</span>
            <textarea value={preferredTraining} onChange={(e) => setPreferredTraining(e.target.value)} placeholder="Muscu, home gym, cardio..." />
          </label>
          <label className="auth-form__full">
            <span>Limitations / blessures</span>
            <textarea value={limitations} onChange={(e) => setLimitations(e.target.value)} placeholder="Précise les éléments à surveiller" />
          </label>
          <button type="submit" className="btn auth-btn">Créer</button>
          <datalist id="signup-goal-presets">
            {MEMBER_GOAL_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
          <datalist id="signup-level-presets">
            {MEMBER_LEVEL_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
        </form>
      </div>
    </div>
  );
}
