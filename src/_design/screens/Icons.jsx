// Tiny stroke icon set — Lucide-style 14px / 1.5 stroke
const SmIcon = ({ name, size = 14 }) => {
  const s = size;
  const stroke = 1.5;
  const props = {
    width: s, height: s, viewBox: "0 0 16 16",
    fill: "none", stroke: "currentColor",
    strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "home":
      return (<svg {...props}><path d="M2.5 7L8 2.5 13.5 7v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7z"/><path d="M6 14V9h4v5"/></svg>);
    case "today":
      return (<svg {...props}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11"/><path d="M5.5 2v3M10.5 2v3"/><path d="M8 9v2M6 10h4"/></svg>);
    case "schedule":
      return (<svg {...props}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11"/><path d="M5.5 2v3M10.5 2v3"/></svg>);
    case "clients":
      return (<svg {...props}><circle cx="6" cy="6.5" r="2.2"/><path d="M2.5 13.5c.4-2 1.7-3.2 3.5-3.2s3.1 1.2 3.5 3.2"/><circle cx="11.2" cy="5.8" r="1.6"/><path d="M10 9.5c.6-.5 1.1-.7 2-.7 1.4 0 2.5 1 2.8 2.5"/></svg>);
    case "studio":
      return (<svg {...props}><circle cx="8" cy="8" r="1.5"/><path d="M8 1.8v2M8 12.2v2M14.2 8h-2M3.8 8h-2M12.4 3.6l-1.4 1.4M5 11l-1.4 1.4M12.4 12.4L11 11M5 5L3.6 3.6"/></svg>);
    case "search":
      return (<svg {...props}><circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/></svg>);
    case "plus":
      return (<svg {...props}><path d="M8 3v10M3 8h10"/></svg>);
    case "close":
      return (<svg {...props}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>);
    case "more":
      return (<svg {...props}><circle cx="3.5" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="12.5" cy="8" r="1" fill="currentColor"/></svg>);
    case "check":
      return (<svg {...props}><path d="M3.5 8.5L6.5 11.5 12.5 4.5"/></svg>);
    case "users-empty":
      return (<svg {...props}><circle cx="6" cy="6.5" r="2.2"/><path d="M2.5 13.5c.4-2 1.7-3.2 3.5-3.2s3.1 1.2 3.5 3.2"/></svg>);
    case "envelope":
      return (<svg {...props}><rect x="2" y="4" width="12" height="9" rx="1.2"/><path d="M2.5 5l5.5 4 5.5-4"/></svg>);
    case "calendar-empty":
      return (<svg {...props}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5.5 2v3M10.5 2v3"/></svg>);
    case "clock":
      return (<svg {...props}><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2L10 10"/></svg>);
    default:
      return null;
  }
};

window.SmIcon = SmIcon;
