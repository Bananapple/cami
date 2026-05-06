// ClassDrawer — drawer template applied to a class detail
// Showcases: drawer header with state+cat+count, underline tabs, sections with eyebrows, action bar destruct-far-left

const ClassDrawer = () => {
  const [tab, setTab] = React.useState("attending");

  const attending = [
    { id: "frida",  name: "Frida Kalo",      meta: "All Inclusive · 8 visits",     state: "good",    stateLabel: "Paid",  initials: "FK" },
    { id: "elena",  name: "Elena Sanchez",   meta: "10-Clip · 6 left",             state: "good",    stateLabel: "Paid",  initials: "ES" },
    { id: "marco",  name: "Marco Bellini",   meta: "Drop-in · first visit",        state: "good",    stateLabel: "Paid",  initials: "MB" },
    { id: "lina",   name: "Lina Berg",       meta: "All Inclusive · 22 visits",    state: "good",    stateLabel: "Paid",  initials: "LB" },
    { id: "yuki",   name: "Yuki Tanaka",     meta: "10-Clip · 3 left",             state: "warn",    stateLabel: "Low credits", initials: "YT" },
    { id: "olav",   name: "Olav Kristensen", meta: "Drop-in",                      state: "good",    stateLabel: "Paid",  initials: "OK" },
  ];

  const waitlist = [
    { id: "w1", name: "Anja Storm",   meta: "Offered 11m ago",  state: "warn",    stateLabel: "Offered · 11m", initials: "AS" },
    { id: "w2", name: "Ben Hauge",    meta: "In line · #2",      state: "neutral", stateLabel: "Waiting",       initials: "BH" },
    { id: "w3", name: "Cleo Park",    meta: "In line · #3",      state: "neutral", stateLabel: "Waiting",       initials: "CP" },
  ];

  return (
    <>
      <div className="sm-drawer-scrim"></div>
      <aside className="sm-drawer">
        <header className="sm-drawer-head">
          <div>
            <h3>Bootylicious</h3>
            <p className="sub">Sun 3 May · 11:30 — 12:20 · Brikela · Studio</p>
            <div className="meta-row">
              <span className="sm-state good">Scheduled</span>
              <span className="sm-cat">Pilates</span>
              <span className="sm-count"><span className="n">17 / 20</span> booked</span>
            </div>
          </div>
          <button className="close" aria-label="Close"><SmIcon name="close" /></button>
        </header>

        <div className="sm-drawer-tabs">
          <button className={"sm-drawer-tab " + (tab === "attending" ? "on" : "")} onClick={() => setTab("attending")}>
            Attending <span className="ct">17</span>
          </button>
          <button className={"sm-drawer-tab " + (tab === "waitlist" ? "on" : "")} onClick={() => setTab("waitlist")}>
            Waitlist <span className="ct">3</span>
          </button>
          <button className={"sm-drawer-tab " + (tab === "cancelled" ? "on" : "")} onClick={() => setTab("cancelled")}>
            Cancelled <span className="ct">2</span>
          </button>
          <button className={"sm-drawer-tab " + (tab === "details" ? "on" : "")} onClick={() => setTab("details")}>
            Details
          </button>
        </div>

        <div className="sm-drawer-body">
          {tab === "attending" && (
            <>
              <section className="sm-drawer-section">
                <h4>
                  Notes
                  <button className="edit-link">Edit</button>
                </h4>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "var(--t-small)" }}>
                  Bring extra mats — heavier crowd than usual.
                </p>
              </section>
              <section className="sm-drawer-section" style={{ padding: 0 }}>
                <div style={{ padding: "16px 20px 8px" }}>
                  <h4 style={{ margin: 0 }}>
                    Attending · 17
                    <button className="edit-link">Add walk-in</button>
                  </h4>
                </div>
                <div style={{ borderTop: "1px solid var(--line-soft)" }}>
                  {attending.map(a => (
                    <button key={a.id} className="sm-row" type="button" style={{ borderRadius: 0 }}>
                      <span className="lead">{a.initials}</span>
                      <div className="body">
                        <div className="title">{a.name}</div>
                        <div className="meta-line">{a.meta}</div>
                      </div>
                      <div className="trail">
                        <span className={"sm-state " + a.state}>{a.stateLabel}</span>
                        <span className="menu"><SmIcon name="more" /></span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "waitlist" && (
            <section className="sm-drawer-section" style={{ padding: 0 }}>
              <div style={{ padding: "16px 20px 8px" }}>
                <h4 style={{ margin: 0 }}>Waitlist · 3</h4>
              </div>
              <div style={{ borderTop: "1px solid var(--line-soft)" }}>
                {waitlist.map(a => (
                  <button key={a.id} className="sm-row" type="button" style={{ borderRadius: 0 }}>
                    <span className="lead">{a.initials}</span>
                    <div className="body">
                      <div className="title">{a.name}</div>
                      <div className="meta-line">{a.meta}</div>
                    </div>
                    <div className="trail">
                      <span className={"sm-state " + a.state}>{a.stateLabel}</span>
                      <span className="menu"><SmIcon name="more" /></span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === "cancelled" && (
            <div className="sm-empty" style={{ padding: 48 }}>
              <div className="glyph"><SmIcon name="users-empty" /></div>
              <p>2 clients cancelled in advance.</p>
              <p className="hint">Spots auto-released to the waitlist.</p>
            </div>
          )}

          {tab === "details" && (
            <>
              <section className="sm-drawer-section">
                <h4>Schedule</h4>
                <p style={{ margin: 0, fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
                  Recurring · Every Sunday at 11:30 · 50 minutes
                </p>
              </section>
              <section className="sm-drawer-section">
                <h4>Capacity & room</h4>
                <p style={{ margin: 0, fontSize: "var(--t-small)", color: "var(--ink-soft)" }}>
                  20 · Studio room
                </p>
              </section>
            </>
          )}
        </div>

        <footer className="sm-drawer-actions">
          <button className="sm-btn danger destruct">Cancel class</button>
          <button className="sm-btn ghost">Sub instructor</button>
          <button className="sm-btn primary">Edit class</button>
        </footer>
      </aside>
    </>
  );
};

window.ClassDrawer = ClassDrawer;
