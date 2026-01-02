import { apiFetch } from "./client";
import { useAuthStore } from "../store/auth.store";

export type Brand = {
  brandName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  fontFamily?: string | null;
};

export type Product = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  isActive: boolean;
  checkoutUrl?: string | null;
  billingInterval?: string | null;
  activeSubscribers?: number | null;
  creditValue?: number | null;
};

export type Slot = { startAt: string; endAt: string };

export type AvailabilityResponse = {
  availabilities: Slot[];
  bookedSlots: Slot[];
};

export type BookingPayload = { startAt: string; endAt: string; notes?: string; paymentId?: string; packId?: string };

export type Booking = {
  id: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
};

export type Stat = { label: string; value: string };
export type Feature = { title: string; description: string; icon?: string };
export type FocusBlock = { title: string; description: string; metric?: string };
export type Testimonial = { name: string; role: string; message: string; avatar: string };
export type Review = { name: string; quote: string; score: number };
export type MethodStep = { title: string; description: string };
export type CarouselSlide = { title: string; description: string; image: string };

export type SocialLink = { label: string; url: string; icon?: string; image?: string };

export type SiteContent = {
  heroEyebrow?: string;
  heroTitle?: string;
  heroHighlight?: string;
  heroDescription?: string;
  heroPrimaryImage?: string;
  heroSecondaryImage?: string;
  heroStats: Stat[];
  features: Feature[];
  focusBlocks: FocusBlock[];
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
  palette?: { primary?: string; secondary?: string; background?: string };
  fontFamily?: string;
  ctaPrimary?: string;
  ctaSecondary?: string;
  socialLinks?: SocialLink[];
  promoBar?: { location?: string; hotline?: string; email?: string };
};

export type SiteResponse = {
  brand: Brand;
  content: SiteContent;
};

export const PublicApi = {
  brand: () => apiFetch<Brand>("/api/public/brand"),
  siteContent: () => apiFetch<SiteResponse>("/api/public/site"),
  products: () => apiFetch<Product[]>("/api/public/products"),
  availability: () => apiFetch<AvailabilityResponse>("/api/public/availability"),
  contact: (payload: { fullName: string; email: string; subject: string; message: string }) =>
    apiFetch("/api/public/contact", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    }),
  book: (payload: BookingPayload) => {
    const token = useAuthStore.getState().accessToken;
    return apiFetch<Booking>("/api/public/book", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  }
};
