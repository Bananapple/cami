// MemberDrawer — drawer template for a client detail
// Showcases: header with avatar+state, underline tabs, stats grid, recent activity rows, contact section

const MemberDrawer = () => {
  const [tab, setTab] = React.useState("overview");

  const recent = [
    { id: "a1", time: "Sun 3 May · 11:30", title: "Bootylicious", cat: "Pilates", state: "good", stateLabel: "Booked" },
    { id: "a2", time: "Fri 1 May · 18:00", title: "Slow Yin",     cat: "Yoga",    state: "good", stateLabel: "Attended" },
    { id: "a3", time: "Wed 29 Apr · 12:00", title: "Lunch Pilates", cat: "Pilates", state: "warn", stateLabel: "No-show" },
    { id: "a4", time: "Mon 27 Apr · 09:00", title: "Mysore",      cat: "Yoga",    state: "good", stateLabel: "Attended" },
    { id: "a5", time: "Sat 25 Apr · 14:00", title: "Reformer Flow", cat: "Pilates", state: "info", stateLabel: "Refunded" },
  ];

  return (
    <>
      <div className="sm-drawer-scrim"></div>
      <aside className="sm-drawer">
        <header className="sm-drawer-head">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1 }}>
            <div className="sm-av-lg">FK</div>
            <div>
              <h3>Frida Kalo</h3>
              <p className="sub">frida@proton.me · +47 901 23 456</p>
              <div className="meta-row">
                <span className="sm-state good">All Inclusive</span>
                <span className="sm-cat">Member</span>
                <span className="sm-count"><span className="n">8</span> visits this month</span>
              </div>
            </div>
          </div>
          <button className="close" aria-label="Close"><SmIcon name="close" /></button>
        </header>

        <div className="sm-drawer-tabs">
          <button className={"sm-drawer-tab " + (tab === "overview" ? "on" : "")} onClick={() => setTab("overview")}>
            Overview
          </button>
          <button className={"sm-drawer-tab " + (tab === "activity" ? "on" : "")} onClick={() => setTab("activity")}>
            Activity <span className="ct">42</span>
          </button>
          <button className={"sm-drawer-tab " + (tab === "billing" ? "on" : "")} onClick={() => setTab("billing")}>
            Billing
          </button>
          <button className={"sm-drawer-tab " + (tab === "notes" ? "on" : "")} onClick={() => setTab("notes")}>
            Notes <span className="ct">2</span>
          </button>
        </div>

        <div className="sm-drawer-body">
          {tab === "overview" && (
            <>
              <section className="sm-drawer-section">
                <h4>This month</h4>
                <div className="sm-stats">
                  <div className="sm-stat">
                    <div className="lab">Booked</div>
                    <div className="v">8</div>
                  </div>
                  <div className="sm-stat">
                    <div className="lab">Attended</div>
                    <div className="v">7</div>
                  </div>
                  <div className="sm-stat">
                    <div className="lab">No-shows</div>
                    <div className="v warn">1</div>
                  </div>
                  <div className="sm-stat">
                    <div className="lab">Spend</div>
                    <div className="v">1,600</div>
                  </div>
                </div>
              </section>

              <section className="sm-drawer-section">
                <h4>
                  Plan
                  <button className="edit-link">Change plan</button>
                </h4>
                <p style={{ margin: 0, fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
                  All Inclusive · NOK 1,600/mo · renews 1 Jun 2025
                </p>
              </section>

              <section className="sm-drawer-section" style={{ padding: 0 }}>
                <div style={{ padding: "16px 20px 8px" }}>
                  <h4 style={{ margin: 0 }}>
                    Recent activity
                    <button className="edit-link">View all</button>
                  </h4>
                </div>
                <div style={{ borderTop: "1px solid var(--line-soft)" }}>
                  {recent.slice(0, 4).map(a => (
                    <button key={a.id} className="sm-row" type="button" style={{ borderRadius: 0 }}>
                      <div className="body">
                        <div className="title">
                          {a.title}
                          <span className="sm-cat">{a.cat}</span>
                        </div>
                        <div className="meta-line">{a.time}</div>
                      </div>
                      <div className="trail">
                        <span className={"sm-state " + a.state}>{a.stateLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="sm-drawer-section">
                <h4>
                  Contact
                  <button className="edit-link">Edit</button>
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px 12px", fontSize: "var(--t-small)" }}>
                  <span style={{ color: "var(--ink-muted)" }}>Email</span>
                  <span>frida@proton.me</span>
                  <span style={{ color: "var(--ink-muted)" }}>Phone</span>
                  <span>+47 901 23 456</span>
                  <span style={{ color: "var(--ink-muted)" }}>Joined</span>
                  <span>14 Jan 2024</span>
                  <span style={{ color: "var(--ink-muted)" }}>Source</span>
                  <span>Friend referral</span>
                </div>
              </section>
            </>
          )}

          {tab === "activity" && (
            <section className="sm-drawer-section" style={{ padding: 0 }}>
              {recent.map(a => (
                <button key={a.id} className="sm-row" type="button" style={{ borderRadius: 0 }}>
                  <div className="body">
                    <div className="title">
                      {a.title}
                      <span className="sm-cat">{a.cat}</span>
                    </div>
                    <div className="meta-line">{a.time}</div>
                  </div>
                  <div className="trail">
                    <span className={"sm-state " + a.state}>{a.stateLabel}</span>
                  </div>
                </button>
              ))}
            </section>
          )}

          {tab === "billing" && (
            <section className="sm-drawer-section">
              <h4>Payment method</h4>
              <p style={{ margin: 0, fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
                Visa ending 4242 · expires 06/27
              </p>
            </section>
          )}

          {tab === "notes" && (
            <div className="sm-empty" style={{ padding: 48 }}>
              <div className="glyph"><SmIcon name="envelope" /></div>
              <p>2 internal notes from staff.</p>
              <p className="hint">Click to read or add a new note.</p>
              <div style={{ marginTop: 14 }}>
                <button className="sm-btn"><SmIcon name="plus" /> Add note</button>
              </div>
            </div>
          )}
        </div>

        <footer className="sm-drawer-actions">
          <button className="sm-btn danger destruct">Deactivate</button>
          <button className="sm-btn ghost">Send message</button>
          <button className="sm-btn primary">Edit member</button>
        </footer>
      </aside>
    </>
  );
};

window.MemberDrawer = MemberDrawer;
