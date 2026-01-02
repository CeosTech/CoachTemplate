import type { SocialLink } from "../api/public";

export type SocialPreset = {
  id: string;
  label: string;
  url: string;
  icon?: string;
  image?: string;
};

export const SOCIAL_LINK_PRESETS: SocialPreset[] = [
  { id: "instagram", label: "Instagram", url: "https://instagram.com/votrecoach", icon: "📸" },
  { id: "youtube", label: "YouTube", url: "https://youtube.com/@votrecoach", icon: "▶️" },
  { id: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@votrecoach", icon: "🎵" },
  { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/votrecoach", icon: "💼" },
  { id: "whatsapp", label: "WhatsApp", url: "https://wa.me/33000000000", icon: "💬" }
];

export const DEFAULT_SOCIAL_LINKS: SocialLink[] = SOCIAL_LINK_PRESETS.slice(0, 3).map(({ label, url, icon, image }) => ({
  label,
  url,
  icon,
  image
}));
