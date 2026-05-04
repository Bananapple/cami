import { useEffect, useRef, type ReactNode } from "react";

// ── Drawer ─────────────────────────────────────────────────────────
// Right-side sheet, 520px desktop / bottom sheet mobile.
// Scroll model: header pinned top, action bar pinned bottom,
// single scroll surface between, sticky section eyebrows inside.

export type DrawerTab = { id: string; label: string; count?: number };

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerMeta,
  headerLead,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  headerMeta?: ReactNode;
  headerLead?: ReactNode;
  tabs?: DrawerTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Reset scroll-to-top when tab changes
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [activeTab]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sm-drawer-scrim" onClick={onClose} />
      <aside className="sm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sm-drawer-head">
          <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
            {headerLead}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>{title}</h3>
              {subtitle && <p className="sub">{subtitle}</p>}
              {headerMeta && <div className="meta-row">{headerMeta}</div>}
            </div>
          </div>
          <button className="close" onClick={onClose} aria-label="Close drawer">
            <CloseIcon />
          </button>
        </header>

        {tabs && tabs.length > 0 && (
          <div className="sm-drawer-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={"sm-drawer-tab " + (activeTab === t.id ? "on" : "")}
                onClick={() => onTabChange?.(t.id)}
                type="button"
              >
                {t.label}
                {t.count !== undefined && <span className="ct">{t.count}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="sm-drawer-body" ref={bodyRef}>
          {children}
        </div>

        {actions && <div className="sm-drawer-actions">{actions}</div>}
      </aside>
    </>
  );
}

// ── DrawerSection ──────────────────────────────────────────────────
// Vertical-divider layout. Eyebrow title + optional inline edit-link.
// Eyebrow is sticky inside the drawer body when scrolled past.

export function DrawerSection({
  title,
  action,
  children,
  flush,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Remove default padding (for embedded RowLists that span edge-to-edge) */
  flush?: boolean;
}) {
  return (
    <section className="sm-drawer-section" style={flush ? { padding: 0 } : undefined}>
      {title && (
        <h4
          style={
            flush
              ? {
                  margin: 0,
                  padding: "16px 20px 8px",
                  position: "sticky",
                  top: 0,
                  background: "var(--surface)",
                  zIndex: 2,
                  borderBottom: "1px solid var(--line-soft)",
                }
              : {
                  position: "sticky",
                  top: 0,
                  background: "var(--surface)",
                  zIndex: 2,
                  margin: "-16px -20px 10px",
                  padding: "16px 20px 10px",
                  borderBottom: "1px solid var(--line-soft)",
                }
          }
        >
          {title}
          {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
        </h4>
      )}
      {children}
    </section>
  );
}

// ── DrawerActions ──────────────────────────────────────────────────
// Sticky bottom bar. Layout: destructive far-left, ghost middle, primary far-right.
// Just a slot — caller passes Buttons in the right order.

export function DrawerActions({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ── EditLink ───────────────────────────────────────────────────────
// Inline section action. e.g. "Edit" next to a section eyebrow.

export function EditLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="edit-link" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}
