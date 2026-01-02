import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PublicApi, type Slot, type AvailabilityResponse } from "../api/public";
import { useAuthStore } from "../store/auth.store";
import { MemberApi, type MemberPackSummary } from "../api/member";

function overlaps(a: Slot, b: Slot) {
  return new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt);
}

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function remainingCredits(pack: MemberPackSummary) {
  const total = typeof pack.totalCredits === "number" ? pack.totalCredits : pack.product.creditValue ?? 0;
  const remaining = typeof pack.creditsRemaining === "number" ? pack.creditsRemaining : total;
  return { total, remaining };
}

type BookingFormProps = {
  embed?: boolean;
  packs?: MemberPackSummary[];
  refreshPacks?: () => Promise<void>;
  onBooking?: () => void;
  initialSlot?: Slot | null;
};

export function BookingForm({ embed = false, packs, refreshPacks, onBooking, initialSlot }: BookingFormProps) {
  const { user } = useAuthStore();
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [selected, setSelected] = useState<Slot | null>(initialSlot ?? null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [localPacks, setLocalPacks] = useState<MemberPackSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [helper, setHelper] = useState<string | null>(null);
  const resolvedPacks = packs ?? localPacks;
  const availablePacks = useMemo(
    () => resolvedPacks.filter((pack) => pack.status === "ACTIVE" && remainingCredits(pack).remaining > 0),
    [resolvedPacks]
  );
  const [selectedPackId, setSelectedPackId] = useState<string>("");

  useEffect(() => {
    PublicApi.availability().then(setData).catch((e: any) => setError(e.message));
  }, []);

  useEffect(() => {
    if (initialSlot) {
      setSelected(initialSlot);
    }
  }, [initialSlot?.startAt, initialSlot?.endAt]);

  useEffect(() => {
    if (!packs) {
      MemberApi.packs().then(setLocalPacks).catch(() => {});
    }
  }, [packs]);

  useEffect(() => {
    if (availablePacks.length && !selectedPackId) {
      setSelectedPackId(availablePacks[0].id);
    }
  }, [availablePacks, selectedPackId]);

  const slots = useMemo(() => {
    if (!data) return [];
    const av = data.availabilities;
    const booked = data.bookedSlots;

    const all: Slot[] = [];
    for (const a of av) {
      let cur = new Date(a.startAt);
      const end = new Date(a.endAt);
      while (cur.getTime() + 60 * 60 * 1000 <= end.getTime()) {
        const s = new Date(cur);
        const e = new Date(cur.getTime() + 60 * 60 * 1000);
        const slot = { startAt: s.toISOString(), endAt: e.toISOString() };
        const isBooked = booked.some((b) => overlaps(slot, b));
        if (!isBooked) all.push(slot);
        cur = new Date(cur.getTime() + 60 * 60 * 1000);
      }
    }
    return all;
  }, [data]);

  async function refreshAvailability() {
    try {
      const next = await PublicApi.availability();
      setData(next);
    } catch {
      // silent network error
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Choisis d'abord un créneau.");
      return;
    }
    if (!selectedPackId) {
      setError("Sélectionne le pack à débiter.");
      return;
    }
    if (!user || user.role !== "MEMBER") {
      setError("Connecte-toi avec ton compte adhérent pour réserver.");
      return;
    }

    setStatus("loading");
    setError(null);
    setHelper(null);
    try {
      await PublicApi.book({ startAt: selected.startAt, endAt: selected.endAt, notes: bookingNotes, packId: selectedPackId });
      setHelper("Réservation envoyée au coach. Le créneau passe en 'En attente'.");
      setSelected(null);
      setBookingNotes("");
      await refreshAvailability();
      if (refreshPacks) {
        await refreshPacks();
      } else if (!packs) {
        MemberApi.packs().then(setLocalPacks).catch(() => {});
      }
      onBooking?.();
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Impossible d'envoyer la réservation.");
    }
  }

  const hero = (
    <section className="dashboard-hero">
      <div>
        <p className="eyebrow">Réserver une séance</p>
        <h2>Consomme tes heures pack</h2>
        <p>Choisis un créneau disponible, puis débite le pack correspondant. Aucune CB à chaque séance.</p>
      </div>
    </section>
  );

  const bookingSectionId = embed ? "booking-form" : undefined;
  const hasCredits = availablePacks.length > 0;

  const sections = (
    <>
      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      <section className="dashboard-card" id={bookingSectionId}>
        <div className="dashboard-card__title">1. Choisis ton créneau</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {slots.map((s) => {
            const active = selected?.startAt === s.startAt;
            return (
              <button
                key={s.startAt}
                onClick={() => setSelected(s)}
                style={{
                  textAlign: "left",
                  border: active ? "2px solid var(--raw-red)" : "1px solid #efe1dc",
                  borderRadius: 14,
                  padding: 12,
                  background: active ? "#fff5f5" : "#fff"
                }}
              >
                <strong>{fmt(s.startAt)}</strong>
                <div style={{ opacity: 0.7 }}>→ {fmt(s.endAt)}</div>
              </button>
            );
          })}
          {slots.length === 0 && <div style={{ opacity: 0.7 }}>Pas encore de créneau. Revenez bientôt.</div>}
        </div>
        <textarea
          value={bookingNotes}
          onChange={(e) => setBookingNotes(e.target.value)}
          placeholder="Notes coach (objectifs, contraintes...)"
          style={{ width: "100%", marginTop: 12, borderRadius: 12, border: "1px solid #e7dad4", padding: 12, minHeight: 80 }}
        />
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">2. Utilise tes heures</div>
        {!hasCredits && (
          <div style={{ opacity: 0.7 }}>
            Aucun pack actif ou plus d&apos;heures disponibles. <Link to="/shop">Achète un pack</Link> pour débloquer la réservation.
          </div>
        )}
        {hasCredits && (
          <form onSubmit={submit} className="cms-form cms-form--compact">
            <div className="pack-grid">
              {availablePacks.map((pack) => {
                const { remaining, total } = remainingCredits(pack);
                return (
                  <label
                    key={pack.id}
                    className={`pack-card pack-card--selectable${selectedPackId === pack.id ? " pack-card--active" : ""}`}
                  >
                    <input type="radio" name="pack" value={pack.id} checked={selectedPackId === pack.id} onChange={() => setSelectedPackId(pack.id)} />
                    <div>
                      <div className="pack-card__title">{pack.product.title}</div>
                      <div className="pack-card__hours">
                        <strong>{remaining}</strong>
                        <span>heures restantes</span>
                      </div>
                      <div className="pack-card__meta">{total ? `${total}h au total` : "Crédits illimités"}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <button className="btn btn--block" type="submit" disabled={!selected || !selectedPackId || status === "loading"}>
              {status === "loading" ? "Réservation en cours..." : "Envoyer la réservation"}
            </button>
            {helper && <small style={{ color: "#16a34a", display: "block", marginTop: 8 }}>{helper}</small>}
          </form>
        )}
      </section>
    </>
  );

  if (embed) {
    return sections;
  }

  return (
    <div className="dashboard">
      {hero}
      {sections}
    </div>
  );
}

export function BookingPage() {
  return <Navigate to="/member/booking" replace />;
}
