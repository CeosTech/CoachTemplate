import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactElement } from "react";
import { useAuthStore } from "../store/auth.store";
import { PublicApi, type Brand, type SocialLink } from "../api/public";
import { DEFAULT_SOCIAL_LINKS } from "../constants/socialPresets";

const navLinks = [
  { label: "Accueil", to: "/" },
  { label: "Programmes", to: "/shop" },
  { label: "Contact", to: "/contact" }
];

const contentRoutes = ["/", "/shop", "/contact", "/payment", "/login", "/register", "/forgot-password", "/reset-password"];

const SOCIAL_ICON_MAP: Record<string, ReactElement> = {
  instagram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M22 8.2c-.2-1.5-1.2-2.6-2.6-2.8C17.4 5 12 5 12 5s-5.4 0-7.4.4C3.2 5.6 2.2 6.7 2 8.2 1.6 10.2 1.6 12 1.6 12s0 1.8.4 3.8c.2 1.5 1.2 2.6 2.6 2.8C6.6 19 12 19 12 19s5.4 0 7.4-.4c1.4-.2 2.4-1.3 2.6-2.8.4-2 .4-3.8.4-3.8s0-1.8-.4-3.8zM10 15.3V8.7l5.6 3.3L10 15.3z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M20 7.5a5 5 0 01-3.4-1.3v6.1a6.3 6.3 0 11-5.3-6.2v3.4a2.5 2.5 0 102 2.4V2h3.3A5 5 0 0020 4.1z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 8.98h3.96V21H3zM10.5 9h3.79v1.53h.06C15.2 9.78 16.67 9 18.44 9c4.08 0 4.83 2.69 4.83 6.2V21h-3.96v-5c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.66V21H10.5z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 2a10 10 0 00-8.7 15l-1.2 4.4 4.5-1.2A10 10 0 1012 2zm0 18.1a8.1 8.1 0 01-4.1-1.1l-.3-.2-2.7.7.7-2.6-.2-.3A8.1 8.1 0 1112 20zm4.5-5.6c-.2-.1-1.3-.7-1.5-.8s-.3-.1-.5.1-.6.8-.7.9-.2.2-.5.1a6.6 6.6 0 01-3-2.6c-.2-.3 0-.4.1-.5l.3-.3.2-.4c.1-.1 0-.3 0-.4 0-.1-.5-1.3-.7-1.8-.2-.5-.4-.4-.5-.4h-.5c-.1 0-.4.1-.6.3s-.8.8-.8 2 .9 2.2 1 2.3c.1.2 1.8 2.8 4.3 3.9.6.3 1.1.4 1.5.6.6.2 1.2.1 1.6.1.5-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-.9s-.2-.1-.4-.2z" />
    </svg>
  )
};

function isMarketingRoute(pathname: string) {
  return contentRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(DEFAULT_SOCIAL_LINKS);
  const [promo, setPromo] = useState<{ location?: string; hotline?: string; email?: string }>({});
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    PublicApi.siteContent()
      .then((res) => {
        setBrand(res.brand);
        setSocialLinks(res.content.socialLinks && res.content.socialLinks.length > 0 ? res.content.socialLinks : DEFAULT_SOCIAL_LINKS);
        setPromo(res.content.promoBar ?? {});
      })
      .catch(() => {
        setSocialLinks(DEFAULT_SOCIAL_LINKS);
        PublicApi.brand().then(setBrand).catch(() => {});
      });
  }, []);

  useEffect(() => {
    if (!brand) return;
    const root = document.documentElement;
    if (brand.fontFamily) root.style.setProperty("--app-font", brand.fontFamily);
    if (brand.primaryColor) root.style.setProperty("--accent-color", brand.primaryColor);
    if (brand.secondaryColor) root.style.setProperty("--accent-secondary", brand.secondaryColor);
    if (brand.backgroundColor) root.style.setProperty("--background-color", brand.backgroundColor);
  }, [brand]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32);
    handler();
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const showMarketingShell = isMarketingRoute(location.pathname);

  if (!showMarketingShell) {
    return (
      <div className="site-shell site-shell--plain">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="site-shell">
      <div className="promo-bar">
        <span>{promo.location ?? "RAW Coaching • Lyon & Online"}</span>
        <span>
          Hotline : <a href={`tel:${promo.hotline ?? "+33600000000"}`}>{promo.hotline ?? "+33 6 00 00 00 00"}</a>
        </span>
        <span>Email : {promo.email ?? "hello@rawcoaching.fr"}</span>
      </div>
      <header className={`site-header ${scrolled ? "site-header--scrolled" : ""}`}>
        <div className="brand">
          <Link to="/" className="brand-mark">
            <span className="brand-icon">RAW</span>
            <div>
              <div className="brand-title">{brand?.brandName ?? "Coach Template"}</div>
              <div className="brand-subtitle">{brand?.tagline ?? "Performance & mindset"}</div>
            </div>
          </Link>
        </div>

        <button className="nav-toggle" onClick={() => setMenuOpen((prev) => !prev)}>
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links ${menuOpen ? "nav-links--open" : ""}`}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
            return (
              <Link key={link.to} to={link.to} className={`nav-link ${isActive ? "nav-link--active" : ""}`} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className={`nav-cta ${menuOpen ? "nav-cta--open" : ""}`}>
          {!user ? (
            <>
              <Link to="/login" className="nav-link nav-link--muted">
                Connexion
              </Link>
              <Link to="/register" className="btn btn--outline" onClick={() => setMenuOpen(false)}>
                Devenir membre
              </Link>
            </>
          ) : user.role === "COACH" ? (
            <>
              <Link to="/coach" className="btn btn--ghost" onClick={() => setMenuOpen(false)}>
                Dashboard coach
              </Link>
              <Link to="/coach/programs" className="nav-link nav-link--muted" onClick={() => setMenuOpen(false)}>
                Program Builder
              </Link>
              <Link to="/coach/members" className="nav-link nav-link--muted" onClick={() => setMenuOpen(false)}>
                Adhérents
              </Link>
              <Link to="/coach/site" className="nav-link nav-link--muted" onClick={() => setMenuOpen(false)}>
                Personnaliser
              </Link>
              <button
                className="btn btn--outline"
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/member" className="btn btn--ghost" onClick={() => setMenuOpen(false)}>
                Espace adhérent
              </Link>
              <button
                className="btn btn--outline"
                onClick={() => {
                  logout();
                  setMenuOpen(false);
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      <main className="site-main site-main--full">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <div className="brand-title">{brand?.brandName ?? "Coach Template"}</div>
          <p>{brand?.tagline ?? "Programme premium pour athlètes ambitieux."}</p>
        </div>
        <div>
          <div className="footer-title">Navigation</div>
          <div className="footer-links">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <div className="footer-title">Contact</div>
          <p>hello@coach-template.io</p>
          <p>@coachtemplate</p>
        </div>
        {socialLinks.length > 0 && (
          <div>
            <div className="footer-title">Réseaux</div>
            <div className="footer-socials">
              {socialLinks.map((link) => (
                <a key={`${link.url}-${link.label}`} href={link.url} target="_blank" rel="noreferrer" className="footer-social">
                  {renderSocialIcon(link)}
                  <span>{link.label || link.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

function detectSocialPlatform(link: SocialLink) {
  const target = `${link.label ?? ""} ${link.url ?? ""}`.toLowerCase();
  if (target.includes("instagram")) return "instagram";
  if (target.includes("youtube")) return "youtube";
  if (target.includes("tiktok")) return "tiktok";
  if (target.includes("linkedin")) return "linkedin";
  if (target.includes("whatsapp") || target.includes("wa.me")) return "whatsapp";
  return null;
}

function renderSocialIcon(link: SocialLink) {
  if (link.image) {
    return <img src={link.image} alt={link.label ?? "Réseau"} />;
  }
  if (link.icon) {
    return <span className="footer-social__icon">{link.icon}</span>;
  }
  const platform = detectSocialPlatform(link);
  if (platform && SOCIAL_ICON_MAP[platform]) {
    return (
      <span className="footer-social__icon" aria-hidden="true">
        {SOCIAL_ICON_MAP[platform]}
      </span>
    );
  }
  return <span className="footer-social__icon">↗</span>;
}
