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
  onSignOut,
  hiddenIds = [],
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  onSearchClick: () => void;
  brandName: string;
  userInitials: string;
  userName: string;
  onUserClick?: () => void;
  onSignOut?: () => void;
  hiddenIds?: NavId[];
}) {
  return (
    <aside className="sm-rail">
      <div className="sm-brand">
        <span className="sm-logo" aria-hidden="true" />
        <b>{brandName}</b>
      </div>
      <nav className="sm-nav">
        {ITEMS.filter((it) => !hiddenIds.includes(it.id)).map((it) => (
          <button
            key={it.id}
            type="button"
            className={"sm-nav-item " + (active === it.id ? "on" : "")}
            onClick={() => onNavigate(it.id)}
          >
            <span className="ic">
              <NavIcon name={it.icon} />
            </span>
            {it.label}
          </button>
        ))}
        {onSignOut && (
          <button
            type="button"
            className="sm-nav-item"
            onClick={onSignOut}
          >
            <span className="ic">
              <NavIcon name="sign-out" />
            </span>
            Sign out
          </button>
        )}
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
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</span>
        </button>
      </div>
    </aside>
  );
}

// ── useIsMobile ────────────────────────────────────────────────────
// Tiny media-query hook for the burger collapse breakpoint
// eslint-disable-next-line react-refresh/only-export-components
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
