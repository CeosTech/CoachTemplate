import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type DashboardSection = {
  id?: string;
  label: string;
  helper?: string;
  to?: string;
  group?: string;
};

type DashboardQuickAction = {
  label: string;
  helper?: string;
  href?: string;
  onClick?: () => void;
};

type DashboardLayoutProps = {
  sidebarTitle: string;
  sidebarDescription?: string;
  action?: { label: string; href: string };
  sections: DashboardSection[];
  mobileActions?: DashboardQuickAction[];
  children: React.ReactNode;
};

export function DashboardLayout({ sidebarTitle, sidebarDescription, action, sections, mobileActions, children }: DashboardLayoutProps) {
  const location = useLocation();
  const anchorSections = useMemo(() => sections.filter((section) => section.id && !section.to), [sections]);
  const [activeAnchor, setActiveAnchor] = useState(anchorSections[0]?.id);
  const groupedSections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, DashboardSection[]>();
    sections.forEach((section) => {
      const key = section.group ?? "__default";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(section);
    });
    return { order, map };
  }, [sections]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next: Record<string, boolean> = {};
      groupedSections.order.forEach((key) => {
        next[key] = prev[key] ?? false;
      });
      return next;
    });
  }, [groupedSections.order]);

  useEffect(() => {
    function syncSidebar() {
      if (typeof window === "undefined") return;
      const mobile = window.innerWidth <= 960;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    }
    syncSidebar();
    window.addEventListener("resize", syncSidebar);
    return () => window.removeEventListener("resize", syncSidebar);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isMobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobile && sidebarOpen) {
      document.body.classList.add("body--sidebar-locked");
    } else {
      document.body.classList.remove("body--sidebar-locked");
    }
    return () => {
      document.body.classList.remove("body--sidebar-locked");
    };
  }, [isMobile, sidebarOpen]);

  function normalizePath(path: string) {
    const normalized = path.replace(/\/+$/, "");
    return normalized === "" ? "/" : normalized;
  }

  function matchRoute(target: string) {
    const normalizedTarget = normalizePath(target);
    const currentPath = normalizePath(location.pathname);
    if (currentPath === normalizedTarget) return true;
    return currentPath.startsWith(`${normalizedTarget}/`);
  }

  useEffect(() => {
    if (anchorSections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveAnchor(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0.1 }
    );
    anchorSections.forEach((section) => {
      const node = section.id ? document.getElementById(section.id) : null;
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [anchorSections]);

  function isActive(section: DashboardSection) {
    if (section.to) return matchRoute(section.to);
    if (section.id) return activeAnchor === section.id;
    return false;
  }

  function handleSidebarNavigate() {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }

  function renderLink(section: DashboardSection) {
    const active = isActive(section);
    if (section.to) {
      return (
        <Link key={section.to} to={section.to} className={`dashboard-shell__link ${active ? "dashboard-shell__link--active" : ""}`} onClick={handleSidebarNavigate}>
          <span>{section.label}</span>
          {section.helper && <small>{section.helper}</small>}
        </Link>
      );
    }
    if (!section.id) return null;
    return (
      <a key={section.id} href={`#${section.id}`} className={`dashboard-shell__link ${active ? "dashboard-shell__link--active" : ""}`} onClick={handleSidebarNavigate}>
        <span>{section.label}</span>
        {section.helper && <small>{section.helper}</small>}
      </a>
    );
  }

  const mobileActionsEnabled = isMobile && !!mobileActions?.length;

  return (
    <div className={`dashboard-shell-wrapper${isMobile && sidebarOpen ? " dashboard-shell-wrapper--sidebar-open" : ""}`}>
      <button
        className="dashboard-shell__mobile-toggle"
        type="button"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-expanded={sidebarOpen}
        aria-controls="dashboard-sidebar"
      >
        {sidebarOpen ? "Masquer le menu" : "Afficher le menu"}
      </button>
      {isMobile && sidebarOpen && (
        <div className="dashboard-shell__overlay dashboard-shell__overlay--visible" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
      <div className="dashboard-shell">
        <aside id="dashboard-sidebar" className={`dashboard-shell__sidebar${sidebarOpen ? " dashboard-shell__sidebar--open" : ""}`} aria-hidden={!sidebarOpen && isMobile}>
          <div className="dashboard-shell__intro">
            <p className="eyebrow">Navigation</p>
            <h3>{sidebarTitle}</h3>
            {sidebarDescription && <p>{sidebarDescription}</p>}
            {action && (
              <a className="btn btn--ghost btn--small" href={action.href}>
                {action.label}
              </a>
            )}
          </div>
          <nav className="dashboard-shell__nav">
          {groupedSections.order.map((groupKey) => {
            const isDefaultGroup = groupKey === "__default";
            const items = groupedSections.map.get(groupKey) ?? [];
            const isCollapsed = collapsedGroups[groupKey] ?? false;
            return (
              <div key={groupKey} className={`dashboard-shell__group${isDefaultGroup ? " dashboard-shell__group--plain" : ""}`}>
                {!isDefaultGroup && (
                  <button
                    type="button"
                    className="dashboard-shell__group-header"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{groupKey}</span>
                    <span className="dashboard-shell__caret">{isCollapsed ? "▸" : "▾"}</span>
                  </button>
                )}
                {(isDefaultGroup || !isCollapsed) && items.map((section) => renderLink(section))}
              </div>
            );
          })}
          </nav>
        </aside>
        <div className="dashboard-shell__content">{children}</div>
      </div>
      {mobileActionsEnabled && (
        <div className="dashboard-shell__mobile-actions" role="toolbar" aria-label="Actions rapides">
          {mobileActions!.map((action, index) => {
            if (action.href) {
              return (
                <Link key={`${action.href}-${index}`} to={action.href} className="dashboard-shell__mobile-btn" onClick={handleSidebarNavigate}>
                  <span>{action.label}</span>
                  {action.helper && <small>{action.helper}</small>}
                </Link>
              );
            }
            return (
              <button key={`${action.label}-${index}`} type="button" className="dashboard-shell__mobile-btn" onClick={action.onClick} aria-label={action.label}>
                <span>{action.label}</span>
                {action.helper && <small>{action.helper}</small>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
