// ── FloatingCmdButton ──────────────────────────────────────────────
// Mobile-only round button anchored to the bottom-center of the
// viewport. Tap opens the CommandPalette (which on mobile grows out
// of this button's position via `transform-origin: bottom center`).

export function FloatingCmdButton({
  onClick,
  hidden,
}: {
  onClick: () => void;
  /** Hide the button while the palette is open so the panel visually
   *  replaces it. The button still exists in the DOM so its position
   *  can act as the morph anchor for the palette. */
  hidden?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      className={"sm-cmd-floating" + (hidden ? " is-hidden" : "")}
    >
      <SearchIcon />
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}
