import { useEffect, useState } from "react";
import { NavIcon, type IconName } from "./Icons";

export type NavId = "home" | "today" | "schedule" | "clients" | "studio";

const ITEMS: { id: NavId; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "today", label: "Today", icon: "today" },
  { id: "schedule", label: "Schedule", icon: "schedule" },
  { id: "clients", label: "Clients", icon: "clients" },
  { id: "studio", label: "Studio", icon: "studio" },
];

export function NavRail({
  active,
  onNavigate,
  onSearchClick,
  brandName,
  userInitials,
  userName,
  onUserClick,
  mobileOpen,
  onMobileClose,
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  onSearchClick: () => void;
  brandName: string;
  userInitials: string;
  userName: string;
  onUserClick?: () => void;
  /** Mobile-only: rail is hidden by default; this opens an overlay */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 18, 16, 0.18)",
            backdropFilter: "blur(1px)",
            zIndex: 30,
          }}
          className="sm-rail-scrim"
        />
      )}
      <aside
        className={"sm-rail" + (mobileOpen ? " sm-rail-mobile-open" : "")}
        style={
          mobileOpen
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: 240,
                zIndex: 31,
              }
            : undefined
        }
      >
        <div className="sm-brand">
          <span className="sm-logo" aria-hidden="true" />
          <b>{brandName}</b>
        </div>
        <nav className="sm-nav">
          {ITEMS.map((it) => (
            <button
              key={it.id}
              type="button"
              className={"sm-nav-item " + (active === it.id ? "on" : "")}
              onClick={() => {
                onNavigate(it.id);
                onMobileClose?.();
              }}
            >
              <span className="ic">
                <NavIcon name={it.icon} />
              </span>
              {it.label}
            </button>
          ))}
        </nav>
        <button type="button" className="sm-nav-search" onClick={onSearchClick}>
          <NavIcon name="search" />
          Search
          <kbd>⌘K</kbd>
        </button>
        <div className="sm-rail-foot">
          <button
            type="button"
            onClick={onUserClick}
            style={{
              all: "unset",
              cursor: onUserClick ? "pointer" : "default",
              display: "flex",
              gap: 8,
              alignItems: "center",
              width: "100%",
            }}
          >
            <div className="av">{userInitials}</div>
            <span>{userName}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ── useIsMobile ────────────────────────────────────────────────────
// Tiny media-query hook for the burger collapse breakpoint
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}
