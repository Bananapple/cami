import { useState, type ReactNode } from "react";
import "../tokens/tokens.css";
import { NavRail, type NavId, useIsMobile } from "./NavRail";
import { NavIcon } from "./Icons";
import { CommandPalette, useCommandPaletteShortcut, type CommandItem } from "../components/CommandPalette";

// ── Shell ──────────────────────────────────────────────────────────
// Desktop: 220px fixed rail + scrolling content
// Mobile (<640px): rail hidden; fixed burger top-right of viewport;
// tap → rail slides in from left at 85vw with backdrop scrim.

export function Shell({
  active,
  onNavigate,
  brandName,
  userInitials,
  userName,
  commandItems = [],
  onUserClick,
  onSignOut,
  hiddenIds = [],
  children,
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  brandName: string;
  userInitials: string;
  userName: string;
  commandItems?: CommandItem[];
  onUserClick?: () => void;
  onSignOut?: () => void;
  hiddenIds?: NavId[];
  children: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  useCommandPaletteShortcut(setPaletteOpen);

  return (
    <div className="sm-app" style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
      <div className="sm-shell" style={isMobile ? { gridTemplateColumns: "1fr" } : undefined}>
        {!isMobile && (
          <NavRail
            active={active}
            onNavigate={onNavigate}
            onSearchClick={() => setPaletteOpen(true)}
            brandName={brandName}
            userInitials={userInitials}
            userName={userName}
            onUserClick={onUserClick}
            onSignOut={onSignOut}
            hiddenIds={hiddenIds}
          />
        )}

        {isMobile && mobileNavOpen && (
          <NavRail
            active={active}
            onNavigate={onNavigate}
            onSearchClick={() => {
              setPaletteOpen(true);
              setMobileNavOpen(false);
            }}
            brandName={brandName}
            userInitials={userInitials}
            userName={userName}
            onUserClick={onUserClick}
            onSignOut={onSignOut}
            hiddenIds={hiddenIds}
            mobileOpen
            onMobileClose={() => setMobileNavOpen(false)}
          />
        )}

        <main className="sm-canvas">
          <div className="sm-content">{children}</div>
        </main>
      </div>

      {isMobile && !mobileNavOpen && (
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="sm-burger sm-burger-fixed"
        >
          <NavIcon name="menu" size={18} />
        </button>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
