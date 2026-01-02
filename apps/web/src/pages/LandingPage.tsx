import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PublicApi, type Brand, type Product, type SiteContent } from "../api/public";

const heroGallery = [
  { image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80", label: "Coach – action" },
  { image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80", label: "Coach studio" }
];

const baseStats = [
  { label: "Athlètes suivis", value: "480+" },
  { label: "Transformations documentées", value: "180" },
  { label: "Satisfaction", value: "4.9/5" },
  { label: "Sessions/mois", value: "120+" }
];

const testimonialsFallback = [
  {
    name: "Chloé",
    role: "Bikini Fitness",
    message: "12 semaines pour dessiner ma silhouette et obtenir mon meilleur posing.",
    avatar: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=80"
  },
  {
    name: "Matthias",
    role: "Powerbuilding",
    message: "Une programmation précise, on sait quoi faire et pourquoi on le fait.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80"
  },
  {
    name: "Lina",
    role: "Cross-training",
    message: "Le suivi mindset et nutrition m’a permis de tenir le rythme.",
    avatar: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=80"
  }
];

const methodStepsFallback = [
  { title: "Diagnostic 360°", description: "Questionnaire + appel + review posturale pour comprendre ton contexte." },
  { title: "Blueprint personnalisé", description: "Bloc 12 semaines + nutrition, livrable en PDF ou accès app." },
  { title: "Suivi pro", description: "Check-in vidéo, recap mensuel, partage WhatsApp & PDF." }
];

const formatPrice = (cents?: number) =>
  typeof cents === "number"
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100)
    : "";

type DisplayProduct = { id: string; title: string; description: string; priceLabel: string; interval?: string | null };

export function LandingPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [siteContent, setSiteContent] = useState<SiteContent | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeStory, setActiveStory] = useState(0);

  useEffect(() => {
    PublicApi.siteContent()
      .then((res) => {
        setBrand(res.brand);
        setSiteContent(res.content);
      })
      .catch(() => {});
    PublicApi.products().then(setProducts).catch(() => {});
  }, []);

  const testimonials = siteContent?.testimonials?.length ? siteContent.testimonials : testimonialsFallback;
  const heroStats = siteContent?.heroStats?.length ? siteContent.heroStats : baseStats;
  const methodSteps = siteContent?.methodSteps?.length ? siteContent.methodSteps : methodStepsFallback;
  const heroImage = siteContent?.heroPrimaryImage ?? heroGallery[0].image;
  const heroEyebrow = siteContent?.heroEyebrow ?? "Body transformation & nutrition";
  const heroTitle = siteContent?.heroTitle ?? (brand?.brandName ?? "RAW Coaching");
  const heroHighlight = siteContent?.heroHighlight ?? "Des physiques sculptés, des esprits solides.";
  const heroDescription =
    siteContent?.heroDescription ??
    brand?.tagline ??
    "Bloc intensif, nutrition pilotée et mindset pro pour des athlètes et entrepreneurs exigeants.";
  const primaryCta = siteContent?.ctaPrimary ?? "Choisir mon pack";
  const secondaryCta = siteContent?.ctaSecondary ?? "Parler au coach";

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStory((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const programCards: DisplayProduct[] = useMemo(() => {
    return products.slice(0, 3).map((product) => ({
      id: product.id,
      title: product.title,
      description: product.description,
      priceLabel: formatPrice(product.priceCents),
      interval: product.billingInterval
    }));
  }, [products]);

  return (
    <div className="raw-landing">
      <section className="raw-hero raw-section">
        <div className="raw-hero__content">
          <p className="raw-eyebrow">{heroEyebrow}</p>
          <h1>
            {heroTitle} <span>{heroHighlight}</span>
          </h1>
          <p className="raw-hero__lead">{heroDescription}</p>
          <div className="raw-hero__cta">
            <Link to="/shop" className="btn btn--xl">
              {primaryCta}
            </Link>
            <Link to="/contact" className="btn btn--ghost">
              {secondaryCta}
            </Link>
            <Link to="/login" className="raw-hero__link">
              Accès membre →
            </Link>
          </div>
          <div className="raw-hero__stats">
            {heroStats.map((stat) => (
              <div key={stat.label}>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="raw-hero__media">
          <div className="raw-hero__shot raw-hero__shot--solo">
            <img src={heroImage} alt="Athlete" />
          </div>
          <div className="raw-hero__badge">
            <span>RAW</span>
            <small>Coaching Elite</small>
          </div>
        </div>
      </section>

      <section className="raw-mission raw-section">
        <div className="raw-section__header raw-section__header--spaced">
          <p className="raw-eyebrow">Notre mission</p>
          <h2>On sculpte, on documente, on délivre</h2>
          <p>
            Chaque adhérent reçoit un plan complet : entraînement, nutrition, mindset et reporting. On veut des preuves visuelles
            et chiffrées, pas des slogans.
          </p>
        </div>
        <div className="raw-mission__grid">
          <div className="raw-mission__card">
            <h3>Bloc recomposition</h3>
            <p>Check-ins caméra, plan nutrition, adaptation hebdomadaire.</p>
            <span>12 semaines • Pliométrie + Hyper</span>
          </div>
          <div className="raw-mission__card raw-mission__card--highlight">
            <h3>Pack Performance</h3>
            <p>Tests labo, programmation mental + support sur WhatsApp.</p>
            <span>8 semaines intensives</span>
          </div>
          <div className="raw-mission__card">
            <h3>Mindset focus</h3>
            <p>Routines journalières, visualisation et recap PDF mensuel.</p>
            <span>Cumulable</span>
          </div>
        </div>
      </section>

      <section className="raw-programs raw-section">
        <div className="raw-section__header">
          <p className="raw-eyebrow">Choisis ton parcours</p>
          <h2>Des offres modulables pour avancer</h2>
        </div>
        <div className="raw-program-grid">
          {programCards.length === 0 ? (
            <div className="raw-empty">Les offres arrivent très vite.</div>
          ) : (
            programCards.map((card) => (
              <div key={card.id} className="raw-program-card">
                <div className="program-tag">{card.interval === "MONTHLY" ? "Abonnement" : "Pack intensif"}</div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <div className="program-price">
                  {card.priceLabel}
                  {card.interval === "MONTHLY" ? " / mois" : ""}
                </div>
                <Link to="/shop" className="btn btn--block">
                  Choisir ce pack
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="raw-stories raw-section">
        <div className="raw-section__header raw-section__header--tight">
          <p className="raw-eyebrow">Client stories</p>
          <h2>Ils racontent leur évolution</h2>
        </div>
        <div className="raw-story">
          <img src={testimonials[activeStory].avatar} alt={testimonials[activeStory].name} />
          <div>
            <h3>{testimonials[activeStory].name}</h3>
            <span>{testimonials[activeStory].role}</span>
            <p>“{testimonials[activeStory].message}”</p>
          </div>
        </div>
        <div className="raw-story__controls">
          {testimonials.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Story ${idx + 1}`}
              className={idx === activeStory ? "pager-dot pager-dot--active" : "pager-dot"}
              onClick={() => setActiveStory(idx)}
            />
          ))}
        </div>
      </section>

      <section className="raw-coach-profile raw-section">
        <div className="raw-coach-profile__media">
          <img src={siteContent?.coach?.photo ?? "https://live.staticflickr.com/65535/54129753010_f8b4de916f_b.jpg"} alt={siteContent?.coach?.name ?? "Coach"} />
        </div>
        <div className="raw-coach-profile__content">
          <p className="raw-eyebrow">Coach & mentor</p>
          <h2>{siteContent?.coach?.name ?? "Ton coach dédié"}</h2>
          <p className="raw-coach-profile__role">{siteContent?.coach?.role ?? "Head coach • Performance & mindset"}</p>
          <p>{siteContent?.coach?.bio ?? "Chaque bloc est construit pour garder le cap sur tes objectifs : analyse biométrique, programmation intelligente et accountability sans compromis."}</p>
          <ul>
            <li>12+ ans d'expérience terrain et studio privé.</li>
            <li>Blueprint sur-mesure pour entrepreneurs, athlètes et parents pressés.</li>
            <li>Suivi mindset : check vidéo, feedback en moins de 24h, accountability par WhatsApp.</li>
          </ul>
          <div className="hero-ctas" style={{ marginTop: 16 }}>
            <Link to="/member/booking" className="btn btn--ghost">
              Planifier un call
            </Link>
            <Link to="/shop" className="btn">
              Choisir un pack
            </Link>
          </div>
        </div>
      </section>

      <section className="raw-method raw-section">
        <div className="raw-section__header">
          <p className="raw-eyebrow">Méthode</p>
          <h2>On t’accompagne de A à Z</h2>
        </div>
        <div className="raw-method-grid">
          {methodSteps.map((step, idx) => (
            <div key={step.title} className="raw-method-card">
              <div className="raw-method__index">{String(idx + 1).padStart(2, "0")}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="raw-cta raw-section">
        <h2>Prêt à écrire ton avant/après ?</h2>
        <p>On planifie ton blueprint, on documente chaque étape, tu obtiens un physique qui fait matcher performance et esthétique.</p>
        <div className="raw-hero__cta raw-hero__cta--center">
          <Link to="/register" className="btn btn--xl">
            Je veux commencer
          </Link>
          <Link to="/coach" className="btn btn--ghost">
            Accès coach
          </Link>
        </div>
      </section>
    </div>
  );
}
