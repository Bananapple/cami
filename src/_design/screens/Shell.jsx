// Shared shell — sidebar rail + content area
// Used by all four redesigned screens

const SmRail = ({ active = "studio" }) => {
  const items = [
    { id: "home",     label: "Home" },
    { id: "today",    label: "Today" },
    { id: "schedule", label: "Schedule" },
    { id: "clients",  label: "Clients" },
    { id: "studio",   label: "Studio" },
  ];
  return (
    <aside className="sm-rail">
      <div className="sm-brand">
        <span className="sm-logo" aria-hidden="true"></span>
        <b>Brikela</b>
      </div>
      <nav className="sm-nav">
        {items.map(it => (
          <button
            key={it.id}
            className={"sm-nav-item " + (active === it.id ? "on" : "")}
          >
            <span className="ic"><SmIcon name={it.id} /></span>
            {it.label}
          </button>
        ))}
      </nav>
      <button className="sm-nav-search">
        <SmIcon name="search" />
        Search
        <kbd>⌘K</kbd>
      </button>
      <div className="sm-rail-foot">
        <div className="av">NV</div>
        <span>Nico Vibe</span>
      </div>
    </aside>
  );
};

const SmShell = ({ active, children }) => (
  <div className="sm-app" style={{ width: "100%", height: "100%" }}>
    <div className="sm-shell">
      <SmRail active={active} />
      <main className="sm-canvas">{children}</main>
    </div>
  </div>
);

window.SmRail = SmRail;
window.SmShell = SmShell;
