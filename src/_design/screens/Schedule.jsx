// Schedule — Day-grouped class list
// Showcases: row template with time-lead, category chip, count badge, state, day grouping

const ScheduleDay = ({ label, today, classes, count }) => (
  <div className="sm-day">
    <div className="sm-day-head">
      <span className="label">
        {today && <span className="today">Today</span>}
        {label}
      </span>
      <span className="count">{count} class{count === 1 ? "" : "es"}</span>
    </div>
    <div className="sm-list">
      {classes.map(c => (
        <button key={c.id} className={"sm-row " + (c.selected ? "on" : "")} type="button">
          <span className="lead time">{c.time}</span>
          <div className="body">
            <div className="title">
              {c.title}
              <span className="sm-cat">{c.cat}</span>
            </div>
            <div className="meta-line">{c.instructor} · {c.room} · {c.duration} min</div>
          </div>
          <div className="trail">
            <span className={"sm-count " + (c.bookedTone || "")}>
              <span className="n">{c.booked} / {c.capacity}</span>
            </span>
            <span className={"sm-state " + c.state}>{c.stateLabel}</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);

const ScheduleScreen = () => {
  const days = [
    {
      label: "Sun · 3 May",
      today: true,
      count: 4,
      classes: [
        { id: "c1", time: "09:00", title: "Mysore",        cat: "Yoga",     instructor: "Mira Holm", room: "Studio", duration: 90, booked: 8,  capacity: 12, state: "good", stateLabel: "Confirmed" },
        { id: "c2", time: "11:30", title: "Bootylicious",  cat: "Pilates",  instructor: "Brikela",   room: "Studio", duration: 50, booked: 17, capacity: 20, state: "good", stateLabel: "Confirmed", selected: true },
        { id: "c3", time: "14:00", title: "Reformer Flow", cat: "Pilates",  instructor: "Brikela",   room: "Reformer", duration: 50, booked: 6,  capacity: 6,  state: "warn", stateLabel: "Full · 2 wait" },
        { id: "c4", time: "18:00", title: "Slow Yin",      cat: "Yoga",     instructor: "Tor Lien",  room: "Studio", duration: 60, booked: 4,  capacity: 14, state: "good", stateLabel: "Confirmed" },
      ],
    },
    {
      label: "Mon · 4 May",
      today: false,
      count: 3,
      classes: [
        { id: "c5", time: "07:30", title: "Sunrise Flow",  cat: "Yoga",    instructor: "Mira Holm", room: "Studio", duration: 60, booked: 9,  capacity: 14, state: "good", stateLabel: "Confirmed" },
        { id: "c6", time: "12:00", title: "Lunch Pilates", cat: "Pilates", instructor: "Brikela",   room: "Studio", duration: 45, booked: 2,  capacity: 16, state: "warn", stateLabel: "Low — 2/16" },
        { id: "c7", time: "19:00", title: "Bootylicious",  cat: "Pilates", instructor: "Brikela",   room: "Studio", duration: 50, booked: 14, capacity: 20, state: "good", stateLabel: "Confirmed" },
      ],
    },
    {
      label: "Tue · 5 May",
      today: false,
      count: 2,
      classes: [
        { id: "c8", time: "09:00", title: "Mysore",         cat: "Yoga",    instructor: "Mira Holm", room: "Studio", duration: 90, booked: 6,  capacity: 12, state: "good", stateLabel: "Confirmed" },
        { id: "c9", time: "18:30", title: "Reformer Power", cat: "Pilates", instructor: "Brikela",   room: "Reformer", duration: 50, booked: 0,  capacity: 6,  state: "bad",  stateLabel: "Cancelled" },
      ],
    },
  ];

  return (
    <SmShell active="schedule">
      <div className="sm-content">
        <header className="sm-pagehead">
          <div>
            <h1>Schedule</h1>
            <p className="sub">Next 4 weeks · 32 classes scheduled</p>
          </div>
          <div className="actions">
            <button className="sm-btn">Edit sequence</button>
            <button className="sm-btn primary"><SmIcon name="plus" /> Add one-off class</button>
          </div>
        </header>
        {days.map((d, i) => <ScheduleDay key={i} {...d} />)}
      </div>
    </SmShell>
  );
};

window.ScheduleScreen = ScheduleScreen;
