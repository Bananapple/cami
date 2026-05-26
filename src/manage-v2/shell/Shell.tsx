import { useState, type ReactNode } from "react";
import "../tokens/tokens.css";
import { NavRail, type NavId, useIsMobile } from "./NavRail";
import { FloatingCmdButton } from "./FloatingCmdButton";
import { CommandPalette, useCommandPaletteShortcut, type CommandItem } from "../components/CommandPalette";

// ── Shell ──────────────────────────────────────────────────────────
// Desktop: 220px fixed rail + scrolling content.
// Mobile (<640px): rail hidden. A floating round button at the bottom
// center opens the CommandPalette, which already exposes every nav
// destination (Home/Today/Schedule/Clients/Studio) + Sign out + member
// search. No separate mobile drawer.

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

        <main className="sm-canvas">
          <div className="sm-content">{children}</div>
        </main>
      </div>

      {isMobile && (
        <FloatingCmdButton onClick={() => setPaletteOpen(true)} hidden={paletteOpen} />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commandItems}
        brandName={isMobile ? brandName : undefined}
        userInitials={isMobile ? userInitials : undefined}
      />
    </div>
  );
}
