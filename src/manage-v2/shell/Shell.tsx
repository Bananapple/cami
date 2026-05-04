import { useState, type ReactNode } from "react";
import "../tokens/tokens.css";
import { NavRail, type NavId, useIsMobile } from "./NavRail";
import { NavIcon } from "./Icons";
import { CommandPalette, useCommandPaletteShortcut, type CommandItem } from "../components/CommandPalette";

// ── Shell ──────────────────────────────────────────────────────────
// The chrome wrapping every /manage-v2 screen.
//
// Layout:
//   - Desktop: 220px fixed-position rail + scrolling content area
//   - Mobile (<640px): rail hidden behind a burger
//
// The drawer overlays the canvas (content area only — rail stays visible).

export function Shell({
  active,
  onNavigate,
  brandName,
  userInitials,
  userName,
  commandItems = [],
  onUserClick,
  children,
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  brandName: string;
  userInitials: string;
  userName: string;
  /** Items to show in the ⌘K palette */
  commandItems?: CommandItem[];
  onUserClick?: () => void;
  children: ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  useCommandPaletteShortcut(setPaletteOpen);

  return (
    <div className="sm-app" style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
      <div
        className="sm-shell"
        style={isMobile ? { gridTemplateColumns: "1fr" } : undefined}
      >
        {!isMobile && (
          <NavRail
            active={active}
            onNavigate={onNavigate}
            onSearchClick={() => setPaletteOpen(true)}
            brandName={brandName}
            userInitials={userInitials}
            userName={userName}
            onUserClick={onUserClick}
          />
        )}

        {isMobile && (
          <NavRail
            active={active}
            onNavigate={onNavigate}
            onSearchClick={() => setPaletteOpen(true)}
            brandName={brandName}
            userInitials={userInitials}
            userName={userName}
            onUserClick={onUserClick}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />
        )}

        <main className="sm-canvas">
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                zIndex: 4,
                width: 36,
                height: 36,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-input)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <NavIcon name="menu" size={16} />
            </button>
          )}
          <div
            className="sm-content"
            style={isMobile ? { padding: "60px 20px 32px" } : undefined}
          >
            {children}
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
