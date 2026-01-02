import { useEffect, useState } from "react";
import { CoachSiteApi } from "../api/coach";
import type {
  SiteContent,
  Stat,
  Feature,
  FocusBlock,
  Testimonial,
  Review,
  MethodStep,
  CarouselSlide,
  SocialLink
} from "../api/public";
import { SOCIAL_LINK_PRESETS } from "../constants/socialPresets";

type Palette = NonNullable<SiteContent["palette"]>;

type SiteForm = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  fontFamily: string;
  heroEyebrow: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroPrimaryImage: string;
  heroSecondaryImage: string;
  coachName: string;
  coachRole: string;
  coachBio: string;
  coachPhoto: string;
  ctaPrimary: string;
  ctaSecondary: string;
  heroStats: Stat[];
  features: Feature[];
  focusBlocks: FocusBlock[];
  coachStats: Stat[];
  testimonials: Testimonial[];
  reviews: Review[];
  methodSteps: MethodStep[];
  carouselSlides: CarouselSlide[];
  palette: Palette;
  socialLinks: SocialLink[];
  promoLocation: string;
  promoHotline: string;
  promoEmail: string;
};

const EMPTY_FORM: SiteForm = {
  brandName: "",
  tagline: "",
  logoUrl: "",
  primaryColor: "",
  fontFamily: "",
  heroEyebrow: "",
  heroTitle: "",
  heroHighlight: "",
  heroDescription: "",
  heroPrimaryImage: "",
  heroSecondaryImage: "",
  coachName: "",
  coachRole: "",
  coachBio: "",
  coachPhoto: "",
  ctaPrimary: "",
  ctaSecondary: "",
  heroStats: [],
  features: [],
  focusBlocks: [],
  coachStats: [],
  testimonials: [],
  reviews: [],
  methodSteps: [],
  carouselSlides: [],
  palette: {},
  socialLinks: [],
  promoLocation: "",
  promoHotline: "",
  promoEmail: ""
};

const arrayTemplates = {
  heroStats: (): Stat => ({ label: "", value: "" }),
  features: (): Feature => ({ title: "", description: "", icon: "" }),
  focusBlocks: (): FocusBlock => ({ title: "", description: "", metric: "" }),
  coachStats: (): Stat => ({ label: "", value: "" }),
  testimonials: (): Testimonial => ({ name: "", role: "", message: "", avatar: "" }),
  reviews: (): Review => ({ name: "", quote: "", score: 5 }),
  methodSteps: (): MethodStep => ({ title: "", description: "" }),
  carouselSlides: (): CarouselSlide => ({ title: "", description: "", image: "" }),
  socialLinks: (): SocialLink => ({ label: "", url: "", icon: "", image: "" })
};

type ArrayFieldKey = keyof typeof arrayTemplates;

function mapSiteToForm(site: { brand: any; content: SiteContent }): SiteForm {
  return {
    brandName: site.brand.brandName ?? "",
    tagline: site.brand.tagline ?? "",
    logoUrl: site.brand.logoUrl ?? "",
    primaryColor: site.brand.primaryColor ?? "",
    fontFamily: site.brand.fontFamily ?? "",
    heroEyebrow: site.content.heroEyebrow ?? "",
    heroTitle: site.content.heroTitle ?? "",
    heroHighlight: site.content.heroHighlight ?? "",
    heroDescription: site.content.heroDescription ?? "",
    heroPrimaryImage: site.content.heroPrimaryImage ?? "",
    heroSecondaryImage: site.content.heroSecondaryImage ?? "",
    coachName: site.content.coach?.name ?? "",
    coachRole: site.content.coach?.role ?? "",
    coachBio: site.content.coach?.bio ?? "",
    coachPhoto: site.content.coach?.photo ?? "",
    ctaPrimary: site.content.ctaPrimary ?? "",
    ctaSecondary: site.content.ctaSecondary ?? "",
    heroStats: site.content.heroStats ?? [],
    features: site.content.features ?? [],
    focusBlocks: site.content.focusBlocks ?? [],
    coachStats: site.content.coach?.stats ?? [],
    testimonials: site.content.testimonials ?? [],
    reviews: site.content.reviews ?? [],
    methodSteps: site.content.methodSteps ?? [],
    carouselSlides: site.content.carouselSlides ?? [],
    palette: site.content.palette ?? {},
    socialLinks: site.content.socialLinks ?? [],
    promoLocation: site.content.promoBar?.location ?? "",
    promoHotline: site.content.promoBar?.hotline ?? "",
    promoEmail: site.content.promoBar?.email ?? ""
  };
}

export function SiteSettingsPage() {
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    CoachSiteApi.get()
      .then((data) => {
        setForm(mapSiteToForm(data));
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof SiteForm, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updatePalette = (field: keyof Palette, value: string) => {
    setForm((prev) => ({ ...prev, palette: { ...prev.palette, [field]: value } }));
  };

  function updateArrayField<K extends ArrayFieldKey>(key: K, updater: (items: SiteForm[K]) => SiteForm[K]) {
    setForm((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  }

  function updateArrayItem<K extends ArrayFieldKey>(key: K, index: number, value: SiteForm[K][number]) {
    updateArrayField(key, (items) => items.map((item, idx) => (idx === index ? value : item)) as SiteForm[K]);
  }

  function removeArrayItem<K extends ArrayFieldKey>(key: K, index: number) {
    updateArrayField(key, (items) => items.filter((_, idx) => idx !== index) as SiteForm[K]);
  }

  function addArrayItem<K extends ArrayFieldKey>(key: K) {
    updateArrayField(key, (items) => [...items, arrayTemplates[key]()] as SiteForm[K]);
  }

  function addSocialPreset(presetId: string) {
    const preset = SOCIAL_LINK_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      socialLinks: [
        ...prev.socialLinks,
        {
          label: preset.label,
          url: preset.url,
          icon: preset.icon ?? "",
          image: preset.image ?? ""
        }
      ]
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        brandName: form.brandName || undefined,
        tagline: form.tagline || undefined,
        logoUrl: form.logoUrl || undefined,
        primaryColor: form.primaryColor || undefined,
        fontFamily: form.fontFamily || undefined,
        heroEyebrow: form.heroEyebrow || undefined,
        heroTitle: form.heroTitle || undefined,
        heroHighlight: form.heroHighlight || undefined,
        heroDescription: form.heroDescription || undefined,
        heroPrimaryImage: form.heroPrimaryImage || undefined,
        heroSecondaryImage: form.heroSecondaryImage || undefined,
        coachName: form.coachName || undefined,
        coachRole: form.coachRole || undefined,
        coachBio: form.coachBio || undefined,
        coachPhoto: form.coachPhoto || undefined,
        ctaPrimary: form.ctaPrimary || undefined,
        ctaSecondary: form.ctaSecondary || undefined,
        palette: form.palette,
        heroStats: form.heroStats,
        features: form.features,
        focusBlocks: form.focusBlocks,
        coachStats: form.coachStats,
        testimonials: form.testimonials,
        reviews: form.reviews,
        methodSteps: form.methodSteps,
        carouselSlides: form.carouselSlides,
        socialLinks: form.socialLinks,
        promoBar: {
          location: form.promoLocation || undefined,
          hotline: form.promoHotline || undefined,
          email: form.promoEmail || undefined
        }
      };

      const updated = await CoachSiteApi.update(payload);
      setForm(mapSiteToForm(updated));
      setSuccess("Landing mise à jour ✅");
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div>Chargement du CMS...</div>;

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">CMS landing</p>
          <h2>Personnalise ton site en marque blanche</h2>
          <p>Logo, couleurs, textes et sections complètes en quelques clics.</p>
        </div>
      </section>

      <section className="dashboard-card">
        {error && <div style={{ color: "crimson" }}>{error}</div>}
        {success && <div style={{ color: "#4ade80" }}>{success}</div>}

        <div className="site-preview">
          <div className="site-preview__brand">
            {form.logoUrl ? <img src={form.logoUrl} alt="Logo" /> : <div className="placeholder-logo">Logo</div>}
            <div>
              <div className="preview-title">{form.brandName || "Ta marque"}</div>
              <div className="preview-subtitle">{form.tagline || "Ton slogan impactant."}</div>
            </div>
          </div>
          <div className="palette-grid">
            <div style={{ background: form.primaryColor || "#0ea5e9" }} />
            <div style={{ background: form.palette.secondary || "#f97316" }} />
            <div style={{ background: form.palette.background || "#030617" }} />
          </div>
          <div className="preview-hero">
            <p>{form.heroEyebrow || "Eyebrow"}</p>
            <h3>
              {form.heroTitle || "Titre"} <span>{form.heroHighlight || "Highlight"}</span>
            </h3>
            <p>{form.heroDescription || "Description inspirante."}</p>
          </div>
        </div>

        <form onSubmit={submit} className="cms-form">
          <div className="cms-grid">
            <div>
              <h3>Identité</h3>
              <input placeholder="Nom de marque" value={form.brandName} onChange={(e) => handleChange("brandName", e.target.value)} />
              <input placeholder="Tagline" value={form.tagline} onChange={(e) => handleChange("tagline", e.target.value)} />
              <input placeholder="Logo URL" value={form.logoUrl} onChange={(e) => handleChange("logoUrl", e.target.value)} />
              <input placeholder="Texte localisation (bannière)" value={form.promoLocation} onChange={(e) => handleChange("promoLocation", e.target.value)} />
              <input placeholder="Hotline" value={form.promoHotline} onChange={(e) => handleChange("promoHotline", e.target.value)} />
              <input placeholder="Email contact" value={form.promoEmail} onChange={(e) => handleChange("promoEmail", e.target.value)} />
              <label className="palette-field">
                Couleur primaire
                <input
                  type="color"
                  value={form.primaryColor || "#0ea5e9"}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({ ...prev, primaryColor: value, palette: { ...prev.palette, primary: value } }));
                  }}
                />
              </label>
              <label className="palette-field">
                Couleur secondaire
                <input
                  type="color"
                  value={form.palette.secondary || "#f97316"}
                  onChange={(e) => updatePalette("secondary", e.target.value)}
                />
              </label>
              <label className="palette-field">
                Couleur fond
                <input
                  type="color"
                  value={form.palette.background || "#030617"}
                  onChange={(e) => updatePalette("background", e.target.value)}
                />
              </label>
              <input placeholder="Police (CSS font-family)" value={form.fontFamily} onChange={(e) => handleChange("fontFamily", e.target.value)} />
            </div>

            <div>
              <h3>Hero</h3>
              <input placeholder="Eyebrow" value={form.heroEyebrow} onChange={(e) => handleChange("heroEyebrow", e.target.value)} />
              <input placeholder="Titre" value={form.heroTitle} onChange={(e) => handleChange("heroTitle", e.target.value)} />
              <input placeholder="Highlight" value={form.heroHighlight} onChange={(e) => handleChange("heroHighlight", e.target.value)} />
              <textarea placeholder="Description" value={form.heroDescription} onChange={(e) => handleChange("heroDescription", e.target.value)} />
              <input placeholder="Image principale" value={form.heroPrimaryImage} onChange={(e) => handleChange("heroPrimaryImage", e.target.value)} />
              <input placeholder="Image secondaire" value={form.heroSecondaryImage} onChange={(e) => handleChange("heroSecondaryImage", e.target.value)} />
            </div>

            <div>
              <h3>Coach & CTA</h3>
              <input placeholder="Nom du coach" value={form.coachName} onChange={(e) => handleChange("coachName", e.target.value)} />
              <input placeholder="Rôle du coach" value={form.coachRole} onChange={(e) => handleChange("coachRole", e.target.value)} />
              <textarea placeholder="Bio coach" value={form.coachBio} onChange={(e) => handleChange("coachBio", e.target.value)} />
              <input placeholder="Photo coach" value={form.coachPhoto} onChange={(e) => handleChange("coachPhoto", e.target.value)} />
              <input placeholder="CTA principal" value={form.ctaPrimary} onChange={(e) => handleChange("ctaPrimary", e.target.value)} />
              <input placeholder="CTA secondaire" value={form.ctaSecondary} onChange={(e) => handleChange("ctaSecondary", e.target.value)} />
            </div>
          </div>

          <ContentList
            title="Stats hero"
            items={form.heroStats}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Label" value={item.label} onChange={(e) => updateArrayItem("heroStats", idx, { ...item, label: e.target.value })} />
                <input placeholder="Valeur" value={item.value} onChange={(e) => updateArrayItem("heroStats", idx, { ...item, value: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("heroStats")}
            onRemove={(idx) => removeArrayItem("heroStats", idx)}
          />

          <ContentList
            title="Features"
            items={form.features}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Icône (emoji)" value={item.icon ?? ""} onChange={(e) => updateArrayItem("features", idx, { ...item, icon: e.target.value })} />
                <input placeholder="Titre" value={item.title} onChange={(e) => updateArrayItem("features", idx, { ...item, title: e.target.value })} />
                <textarea placeholder="Description" value={item.description} onChange={(e) => updateArrayItem("features", idx, { ...item, description: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("features")}
            onRemove={(idx) => removeArrayItem("features", idx)}
          />

          <ContentList
            title="Focus blocks"
            items={form.focusBlocks}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Titre" value={item.title} onChange={(e) => updateArrayItem("focusBlocks", idx, { ...item, title: e.target.value })} />
                <textarea placeholder="Description" value={item.description} onChange={(e) => updateArrayItem("focusBlocks", idx, { ...item, description: e.target.value })} />
                <input placeholder="Metric" value={item.metric ?? ""} onChange={(e) => updateArrayItem("focusBlocks", idx, { ...item, metric: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("focusBlocks")}
            onRemove={(idx) => removeArrayItem("focusBlocks", idx)}
          />

          <ContentList
            title="Stats coach"
            items={form.coachStats}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Label" value={item.label} onChange={(e) => updateArrayItem("coachStats", idx, { ...item, label: e.target.value })} />
                <input placeholder="Valeur" value={item.value} onChange={(e) => updateArrayItem("coachStats", idx, { ...item, value: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("coachStats")}
            onRemove={(idx) => removeArrayItem("coachStats", idx)}
          />

          <ContentList
            title="Témoignages"
            items={form.testimonials}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Nom" value={item.name} onChange={(e) => updateArrayItem("testimonials", idx, { ...item, name: e.target.value })} />
                <input placeholder="Discipline" value={item.role} onChange={(e) => updateArrayItem("testimonials", idx, { ...item, role: e.target.value })} />
                <textarea placeholder="Message" value={item.message} onChange={(e) => updateArrayItem("testimonials", idx, { ...item, message: e.target.value })} />
                <input placeholder="Avatar URL" value={item.avatar} onChange={(e) => updateArrayItem("testimonials", idx, { ...item, avatar: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("testimonials")}
            onRemove={(idx) => removeArrayItem("testimonials", idx)}
          />

          <ContentList
            title="Avis partenaires"
            items={form.reviews}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Nom" value={item.name} onChange={(e) => updateArrayItem("reviews", idx, { ...item, name: e.target.value })} />
                <textarea placeholder="Citation" value={item.quote} onChange={(e) => updateArrayItem("reviews", idx, { ...item, quote: e.target.value })} />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Score"
                  value={item.score}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    updateArrayItem("reviews", idx, { ...item, score: Number.isNaN(value) ? 0 : value });
                  }}
                />
              </>
            )}
            onAdd={() => addArrayItem("reviews")}
            onRemove={(idx) => removeArrayItem("reviews", idx)}
          />

          <ContentList
            title="Méthode"
            items={form.methodSteps}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Titre" value={item.title} onChange={(e) => updateArrayItem("methodSteps", idx, { ...item, title: e.target.value })} />
                <textarea placeholder="Description" value={item.description} onChange={(e) => updateArrayItem("methodSteps", idx, { ...item, description: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("methodSteps")}
            onRemove={(idx) => removeArrayItem("methodSteps", idx)}
          />

          <ContentList
            title="Carrousel"
            items={form.carouselSlides}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Titre" value={item.title} onChange={(e) => updateArrayItem("carouselSlides", idx, { ...item, title: e.target.value })} />
                <textarea placeholder="Description" value={item.description} onChange={(e) => updateArrayItem("carouselSlides", idx, { ...item, description: e.target.value })} />
                <input placeholder="Image URL" value={item.image} onChange={(e) => updateArrayItem("carouselSlides", idx, { ...item, image: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("carouselSlides")}
            onRemove={(idx) => removeArrayItem("carouselSlides", idx)}
          />

          <ContentList
            title="Réseaux sociaux"
            items={form.socialLinks}
            renderFields={(item, idx) => (
              <>
                <input placeholder="Nom / plateforme" value={item.label} onChange={(e) => updateArrayItem("socialLinks", idx, { ...item, label: e.target.value })} />
                <input placeholder="URL" value={item.url} onChange={(e) => updateArrayItem("socialLinks", idx, { ...item, url: e.target.value })} />
                <input placeholder="Icône (emoji ou texte)" value={item.icon ?? ""} onChange={(e) => updateArrayItem("socialLinks", idx, { ...item, icon: e.target.value })} />
                <input placeholder="Logo / pictogramme (URL image)" value={item.image ?? ""} onChange={(e) => updateArrayItem("socialLinks", idx, { ...item, image: e.target.value })} />
              </>
            )}
            onAdd={() => addArrayItem("socialLinks")}
            onRemove={(idx) => removeArrayItem("socialLinks", idx)}
          />
          <div className="cms-inline">
            <label htmlFor="social-preset-select">Preset rapide</label>
            <select
              id="social-preset-select"
              onChange={(e) => {
                if (!e.target.value) return;
                addSocialPreset(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Choisir un réseau</option>
              {SOCIAL_LINK_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn--block">
            Sauvegarder mes contenus
          </button>
        </form>
      </section>
    </div>
  );
}

type ContentListProps<T> = {
  title: string;
  items: T[];
  renderFields: (item: T, index: number) => React.ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function ContentList<T>({ title, items, renderFields, onAdd, onRemove }: ContentListProps<T>) {
  return (
    <div className="cms-section">
      <div className="cms-section__header">
        <h3>{title}</h3>
        <button type="button" className="btn btn--ghost" onClick={onAdd}>
          + Ajouter
        </button>
      </div>
      {items.length === 0 && <div className="cms-empty">Aucun élément.</div>}
      <div className="cms-list">
        {items.map((item, idx) => (
          <div key={idx} className="cms-list__item">
            <div className="cms-list__fields">{renderFields(item, idx)}</div>
            <button type="button" className="cms-remove" onClick={() => onRemove(idx)}>
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
