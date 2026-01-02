import { prisma } from "../../db/prisma";

type Stat = { label: string; value: string };
type Feature = { title: string; description: string; icon?: string };
type Focus = { title: string; description: string; metric?: string };
type Testimonial = { name: string; role: string; message: string; avatar: string };
type Review = { name: string; quote: string; score: number };
type MethodStep = { title: string; description: string };
type CarouselSlide = { title: string; description: string; image: string };
type Palette = { primary?: string; secondary?: string; background?: string };
type SocialLink = { label: string; url: string; icon?: string; image?: string };
type PromoBar = { location?: string; hotline?: string; email?: string };

export type SiteContent = {
  heroEyebrow?: string;
  heroTitle?: string;
  heroHighlight?: string;
  heroDescription?: string;
  heroPrimaryImage?: string;
  heroSecondaryImage?: string;
  heroStats: Stat[];
  features: Feature[];
  focusBlocks: Focus[];
  coach: {
    name?: string;
    role?: string;
    bio?: string;
    photo?: string;
    stats: Stat[];
  };
  testimonials: Testimonial[];
  reviews: Review[];
  methodSteps: MethodStep[];
  carouselSlides: CarouselSlide[];
  palette?: Palette;
  fontFamily?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  socialLinks: SocialLink[];
  promoBar?: PromoBar;
};

type SiteUpdateInput = Partial<{
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroHighlight: string | null;
  heroDescription: string | null;
  heroPrimaryImage: string | null;
  heroSecondaryImage: string | null;
  heroStats: Stat[];
  features: Feature[];
  focusBlocks: Focus[];
  coachName: string | null;
  coachRole: string | null;
  coachBio: string | null;
  coachPhoto: string | null;
  coachStats: Stat[];
  testimonials: Testimonial[];
  reviews: Review[];
  methodSteps: MethodStep[];
  carouselSlides: CarouselSlide[];
  palette: Palette;
  fontFamily: string | null;
  ctaPrimary: string | null;
  ctaSecondary: string | null;
  socialLinks: SocialLink[];
  promoBar: PromoBar;
  brandName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}>;

export const DEFAULT_SITE_CONTENT: SiteContent = {
  heroEyebrow: "Coaching premium • performance & mindset",
  heroTitle: "Coach Template",
  heroHighlight: "pour des athlètes ambitieux.",
  heroDescription: "Des cycles intelligents, une nutrition maîtrisée, une mentalité de champion. Construis un physique puissant et durable.",
  heroPrimaryImage: "https://images.unsplash.com/photo-1599058917212-d750089bc07d?auto=format&fit=crop&w=800&q=80",
  heroSecondaryImage: "https://images.unsplash.com/photo-1507398941214-572c25f4b1dc?auto=format&fit=crop&w=800&q=80",
  heroStats: [
    { label: "Athlètes suivis", value: "480+" },
    { label: "Satisfaction", value: "4.9/5" },
    { label: "Sessions / mois", value: "120+" },
    { label: "Records battus", value: "310" }
  ],
  features: [
    { title: "Plans hybrides", description: "Muscu, conditioning et mobilité combinés intelligemment.", icon: "💪" },
    { title: "Suivi biométrique", description: "Tracking hebdo du sommeil, stress et récup.", icon: "📈" },
    { title: "Coaching mindset", description: "Habitudes, nutrition et mental de compétiteur.", icon: "🧠" }
  ],
  focusBlocks: [
    { title: "Force +", description: "Cycles 4-6 semaines axés force max + vitesse.", metric: "+18% PR" },
    { title: "Lean Build", description: "Hypertrophie + cardio métabolique pour un rendu sec.", metric: "-6% BF" },
    { title: "Athletic Flow", description: "Mobilité dynamique + plyo pour explosivité.", metric: "+22% Jump" }
  ],
  coach: {
    name: "Nora Levant",
    role: "Head Coach • Performance féminine",
    bio: "Ancienne athlète élite, 12 ans d’expérience en musculation et préparation mentale.",
    photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
    stats: [
      { label: "Certifications", value: "CSCS, PN2, HRV Expert" },
      { label: "Spécialité", value: "Force & recomposition" }
    ]
  },
  testimonials: [
    {
      name: "Chloé S.",
      role: "Powerlifting",
      message: "12 semaines pour ajouter +32kg à mon total et retrouver la confiance sur les barres lourdes.",
      avatar: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=160&q=80"
    },
    {
      name: "Hugo B.",
      role: "Cross-Training",
      message: "Les blocs puissances + le support mindset m’ont permis de performer sans sacrifier ma récup.",
      avatar: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=160&q=80"
    },
    {
      name: "Lina P.",
      role: "Hypertrophie",
      message: "Programme ultra clair, check-in vidéo, on sent l’expertise à chaque étape.",
      avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80"
    }
  ],
  reviews: [
    { name: "Studio Lift Club", quote: "Des cycles précis, un feedback constant. Résultats chiffrés chaque mois.", score: 5 },
    { name: "Origin Athletics", quote: "Une expérience haut de gamme pour nos athlètes corporate.", score: 4.8 },
    { name: "Pulse Collective", quote: "L’équipe adore l’approche hybride muscu/conditionning.", score: 5 },
    { name: "Beyond Gym", quote: "Capacité à vulgariser la data biométrique, précieux.", score: 4.9 }
  ],
  methodSteps: [
    { title: "Diagnostic 360°", description: "Appel + questionnaire biomécanique, évaluation du stress et de la récup." },
    { title: "Blueprint personnalisé", description: "Bloc sur 6 semaines avec ordre des priorités, volume adapté et zones cardio." },
    { title: "Suivi en temps réel", description: "Check-in vidéo, ajustements dans l’app, support mindset." }
  ],
  carouselSlides: [
    {
      title: "Bloc Force & Puissance",
      description: "Progressions linéaires + contrast training pour maxer ton système nerveux.",
      image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80"
    },
    {
      title: "Hybrid Conditioning",
      description: "Cardio zones 2/4 + tempo lifts pour un cœur solide et des muscles denses.",
      image: "https://images.unsplash.com/photo-1445384763658-0400939829cd?auto=format&fit=crop&w=1200&q=80"
    },
    {
      title: "Mindset & Récup",
      description: "Protocols sommeil/HRV, mobility flows et routines focus mental.",
      image: "https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?auto=format&fit=crop&w=1200&q=80"
    }
  ],
  palette: { primary: "#0ea5e9", secondary: "#f97316", background: "#030617" },
  fontFamily: "Chivo, 'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ctaPrimary: "Book un créneau",
  ctaSecondary: "Devenir membre",
  socialLinks: [
    { label: "Instagram", url: "https://instagram.com/raw-coaching", icon: "📸" },
    { label: "YouTube", url: "https://youtube.com/@rawcoaching", icon: "▶️" },
    { label: "WhatsApp", url: "https://wa.me/33000000000", icon: "💬" }
  ],
  promoBar: {
    location: "RAW Coaching • Lyon & Online",
    hotline: "+33 6 00 00 00 00",
    email: "hello@rawcoaching.fr"
  }
};

function parseJson<T>(value?: string | null, fallback: T = [] as unknown as T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serialize(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.stringify(value);
}

function buildContentFromRecord(record?: { [key: string]: any } | null): SiteContent {
  return {
    heroEyebrow: record?.heroEyebrow ?? DEFAULT_SITE_CONTENT.heroEyebrow,
    heroTitle: record?.heroTitle ?? DEFAULT_SITE_CONTENT.heroTitle,
    heroHighlight: record?.heroHighlight ?? DEFAULT_SITE_CONTENT.heroHighlight,
    heroDescription: record?.heroDescription ?? DEFAULT_SITE_CONTENT.heroDescription,
    heroPrimaryImage: record?.heroPrimaryImage ?? DEFAULT_SITE_CONTENT.heroPrimaryImage,
    heroSecondaryImage: record?.heroSecondaryImage ?? DEFAULT_SITE_CONTENT.heroSecondaryImage,
    heroStats: parseJson<Stat[]>(record?.heroStats, DEFAULT_SITE_CONTENT.heroStats),
    features: parseJson<Feature[]>(record?.features, DEFAULT_SITE_CONTENT.features),
    focusBlocks: parseJson<Focus[]>(record?.focusBlocks, DEFAULT_SITE_CONTENT.focusBlocks),
    coach: {
      name: record?.coachName ?? DEFAULT_SITE_CONTENT.coach.name,
      role: record?.coachRole ?? DEFAULT_SITE_CONTENT.coach.role,
      bio: record?.coachBio ?? DEFAULT_SITE_CONTENT.coach.bio,
      photo: record?.coachPhoto ?? DEFAULT_SITE_CONTENT.coach.photo,
      stats: parseJson<Stat[]>(record?.coachStats, DEFAULT_SITE_CONTENT.coach.stats)
    },
    testimonials: parseJson<Testimonial[]>(record?.testimonials, DEFAULT_SITE_CONTENT.testimonials),
    reviews: parseJson<Review[]>(record?.reviews, DEFAULT_SITE_CONTENT.reviews),
    methodSteps: parseJson<MethodStep[]>(record?.methodSteps, DEFAULT_SITE_CONTENT.methodSteps),
    carouselSlides: parseJson<CarouselSlide[]>(record?.carouselSlides, DEFAULT_SITE_CONTENT.carouselSlides),
    palette: parseJson<Palette>(record?.palette, DEFAULT_SITE_CONTENT.palette),
    fontFamily: record?.fontFamily ?? DEFAULT_SITE_CONTENT.fontFamily,
    ctaPrimary: record?.ctaPrimary ?? DEFAULT_SITE_CONTENT.ctaPrimary,
    ctaSecondary: record?.ctaSecondary ?? DEFAULT_SITE_CONTENT.ctaSecondary,
    socialLinks: parseJson<SocialLink[]>(record?.socialLinks, DEFAULT_SITE_CONTENT.socialLinks),
    promoBar: parseJson<PromoBar>(record?.promoBar, DEFAULT_SITE_CONTENT.promoBar)
  };
}

function buildSiteResponse(coach: any) {
  const content = buildContentFromRecord(coach.site);
  const brand = {
    brandName: coach.brandName,
    tagline: coach.tagline,
    logoUrl: coach.logoUrl,
    primaryColor: content.palette?.primary ?? coach.primaryColor,
    secondaryColor: content.palette?.secondary,
    backgroundColor: content.palette?.background,
    fontFamily: content.fontFamily ?? DEFAULT_SITE_CONTENT.fontFamily
  };
  return { brand, content };
}

function prepareSiteData(input: SiteUpdateInput) {
  const data: any = {};
  const assign = (key: string, value: any) => {
    if (value === undefined) return;
    data[key] = value;
  };

  assign("heroEyebrow", input.heroEyebrow);
  assign("heroTitle", input.heroTitle);
  assign("heroHighlight", input.heroHighlight);
  assign("heroDescription", input.heroDescription);
  assign("heroPrimaryImage", input.heroPrimaryImage);
  assign("heroSecondaryImage", input.heroSecondaryImage);
  assign("heroStats", serialize(input.heroStats));
  assign("features", serialize(input.features));
  assign("focusBlocks", serialize(input.focusBlocks));
  assign("coachName", input.coachName);
  assign("coachRole", input.coachRole);
  assign("coachBio", input.coachBio);
  assign("coachPhoto", input.coachPhoto);
  assign("coachStats", serialize(input.coachStats));
  assign("testimonials", serialize(input.testimonials));
  assign("reviews", serialize(input.reviews));
  assign("methodSteps", serialize(input.methodSteps));
  assign("carouselSlides", serialize(input.carouselSlides));
  assign("palette", serialize(input.palette));
  assign("fontFamily", input.fontFamily);
  assign("ctaPrimary", input.ctaPrimary);
  assign("ctaSecondary", input.ctaSecondary);
  assign("socialLinks", serialize(input.socialLinks));
  assign("promoBar", serialize(input.promoBar));

  return data;
}

async function getCoachProfileByUser(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId }, include: { site: true } });
  if (!coach) throw Object.assign(new Error("Coach profile not found"), { status: 404 });
  return coach;
}

export const siteService = {
  async getPublicSite() {
    const coach = await prisma.coachProfile.findFirst({ where: { isActive: true }, include: { site: true } });
    if (!coach) throw Object.assign(new Error("No coach configured"), { status: 500 });
    return buildSiteResponse(coach);
  },

  async getCoachSite(userId: string) {
    const coach = await getCoachProfileByUser(userId);
    return buildSiteResponse(coach);
  },

  async updateCoachSite(userId: string, input: SiteUpdateInput) {
    const coach = await getCoachProfileByUser(userId);

    const profileUpdates: any = {};
    const assignProfile = (key: string, value: any) => {
      if (value === undefined) return;
      profileUpdates[key] = value;
    };

    assignProfile("brandName", input.brandName);
    assignProfile("tagline", input.tagline);
    assignProfile("logoUrl", input.logoUrl);
    assignProfile("primaryColor", input.primaryColor);

    if (Object.keys(profileUpdates).length) {
      await prisma.coachProfile.update({ where: { id: coach.id }, data: profileUpdates });
    }

    const siteData = prepareSiteData(input);
    const site = await prisma.coachSite.upsert({
      where: { coachId: coach.id },
      update: siteData,
      create: { coachId: coach.id, ...siteData }
    });

    const updatedCoach = { ...coach, ...profileUpdates, site };
    return buildSiteResponse(updatedCoach);
  }
};
