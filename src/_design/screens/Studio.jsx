// Studio — Products & Instructors
// Showcases: row template, state badge, category chip, count, overflow menu, page header

const StudioProducts = () => {
  const products = [
    { id: "all",      lead: "∞",  title: "All Inclusive",   cat: "Subscription",  meta: "Monthly · unlimited classes",  price: "NOK 1,600", state: "good", stateLabel: "Active" },
    { id: "10clip",   lead: "10", title: "10-Clip Card",    cat: "Clip card",     meta: "10 credits · valid 365 days",  price: "NOK 2,100", state: "good", stateLabel: "Active" },
    { id: "5clip",    lead: "5",  title: "5-Clip Card",     cat: "Clip card",     meta: "5 credits · valid 180 days",   price: "NOK 1,200", state: "good", stateLabel: "Active" },
    { id: "drop",     lead: "1",  title: "Drop-in",         cat: "Drop-in",       meta: "Single class",                 price: "NOK 280",   state: "good", stateLabel: "Active" },
    { id: "private",  lead: "P",  title: "Private session", cat: "Private",       meta: "1-on-1 · 60 min",              price: "NOK 950",   state: "neutral", stateLabel: "Inactive" },
    { id: "intro",    lead: "✦",  title: "Intro week",      cat: "Add-on",        meta: "7 days · new clients",         price: "NOK 199",   state: "neutral", stateLabel: "Inactive" },
  ];

  return (
    <div className="sm-section">
      <div className="sm-section-head">
        <h2>Products · 6</h2>
        <button className="sm-btn primary sm">
          <SmIcon name="plus" /> Add product
        </button>
      </div>
      <div className="sm-list">
        {products.map(p => (
          <button key={p.id} className="sm-row" type="button">
            <span className="lead">{p.lead}</span>
            <div className="body">
              <div className="title">
                {p.title}
                <span className="sm-cat">{p.cat}</span>
              </div>
              <div className="meta-line">{p.meta}</div>
            </div>
            <div className="trail">
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--ink)" }}>{p.price}</span>
              <span className={"sm-state " + p.state}>{p.stateLabel}</span>
              <span className="menu" aria-label="Row actions"><SmIcon name="more" /></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const StudioInstructors = () => {
  const instructors = [
    { name: "Brikela",    initials: "BK", classes: 12, state: "good", stateLabel: "Active" },
    { name: "Mira Holm",  initials: "MH", classes: 8,  state: "good", stateLabel: "Active" },
    { name: "Tor Lien",   initials: "TL", classes: 5,  state: "good", stateLabel: "Active" },
    { name: "Sara Vee",   initials: "SV", classes: 0,  state: "neutral", stateLabel: "On leave" },
  ];
  return (
    <div className="sm-section">
      <div className="sm-section-head">
        <h2>Instructors · 4</h2>
        <button className="sm-btn sm">
          <SmIcon name="plus" /> Invite instructor
        </button>
      </div>
      <div className="sm-list">
        {instructors.map(i => (
          <button key={i.name} className="sm-row" type="button">
            <span className="lead">{i.initials}</span>
            <div className="body">
              <div className="title">{i.name}</div>
              <div className="meta-line">{i.classes} class{i.classes === 1 ? "" : "es"} this week</div>
            </div>
            <div className="trail">
              <span className={"sm-state " + i.state}>{i.stateLabel}</span>
              <span className="menu"><SmIcon name="more" /></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const StudioLocations = () => (
  <div className="sm-section">
    <div className="sm-section-head">
      <h2>Locations · 1</h2>
      <button className="sm-btn sm"><SmIcon name="plus" /> Add location</button>
    </div>
    <div className="sm-list">
      <button className="sm-row" type="button">
        <span className="lead">📍</span>
        <div className="body">
          <div className="title">Studio<span className="sm-cat">Default</span></div>
          <div className="meta-line">Storgata 1, 0182 Oslo · capacity 20</div>
        </div>
        <div className="trail">
          <span className="sm-state good">Active</span>
          <span className="menu"><SmIcon name="more" /></span>
        </div>
      </button>
    </div>
  </div>
);

const StudioScreen = () => (
  <SmShell active="studio">
    <div className="sm-content">
      <header className="sm-pagehead">
        <div>
          <h1>Studio</h1>
          <p className="sub">Products, instructors, and locations</p>
        </div>
        <div className="actions">
          <button className="sm-btn"><SmIcon name="envelope" /> Studio settings</button>
        </div>
      </header>
      <StudioProducts />
      <StudioInstructors />
      <StudioLocations />
    </div>
  </SmShell>
);

window.StudioScreen = StudioScreen;
