import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

export type DashboardNavLink = {
  label: string;
  to: string;
  variant?: "primary" | "menu";
};

type DashboardNavProps = {
  title: string;
  subtitle?: string;
  links: DashboardNavLink[];
};

export function DashboardNav({ title, subtitle, links }: DashboardNavProps) {
  const { logout, user } = useAuthStore();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const forcedMenuLinks = links.filter((link) => link.variant === "menu");
  const regularLinks = links.filter((link) => link.variant !== "menu");
  const primaryLinks = regularLinks.slice(0, 4);
  const extraLinks = [...regularLinks.slice(4), ...forcedMenuLinks];

  useEffect(() => {
    if (!overflowOpen) return;
    function handleClick(event: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [overflowOpen]);

  useEffect(() => {
    function syncViewport() {
      if (typeof window === "undefined") return;
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    }
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setOverflowOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobile && mobileOpen) {
      document.body.classList.add("body--topnav-locked");
    } else {
      document.body.classList.remove("body--topnav-locked");
    }
    return () => {
      document.body.classList.remove("body--topnav-locked");
    };
  }, [isMobile, mobileOpen]);

  function handleNavClick() {
    if (isMobile) {
      setMobileOpen(false);
      setOverflowOpen(false);
    }
  }

  return (
    <header className={`dashboard-topnav${mobileOpen ? " dashboard-topnav--mobile-open" : ""}`}>
      <div className="dashboard-topnav__brand">
        <span className="dashboard-topnav__logo">RAW</span>
        <div>
          <strong>{title}</strong>
          <small>{subtitle ?? user?.email}</small>
        </div>
      </div>
      <button
        className="dashboard-topnav__toggle"
        type="button"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-expanded={mobileOpen}
        aria-controls="dashboard-topnav-links"
      >
        {mobileOpen ? "Fermer" : "Menu"}
      </button>
      <nav id="dashboard-topnav-links" className={`dashboard-topnav__links ${mobileOpen ? "dashboard-topnav__links--open" : ""}`}>
        {primaryLinks.map((link) => (
          <Link key={link.to} to={link.to} onClick={handleNavClick}>
            {link.label}
          </Link>
        ))}
        {extraLinks.length > 0 && (
          <div className={`dashboard-topnav__more ${overflowOpen ? "dashboard-topnav__more--open" : ""}`} ref={overflowRef}>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setOverflowOpen((prev) => !prev)}>
              Menu
            </button>
            <div className="dashboard-topnav__dropdown">
              {extraLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => {
                    setOverflowOpen(false);
                    handleNavClick();
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        <button
          className="btn btn--outline btn--small"
          onClick={() => {
            logout();
            handleNavClick();
          }}
        >
          Logout
        </button>
      </nav>
      {isMobile && <div className={`dashboard-topnav__overlay${mobileOpen ? " dashboard-topnav__overlay--visible" : ""}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />}
    </header>
  );
}
