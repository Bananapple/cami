// Always normalize through Date so we get a clean Z-suffixed UTC string
// that Google Calendar and iCal clients parse unambiguously
const fmtIso = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(o: {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  description?: string;
}): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: o.title,
    dates: `${fmtIso(o.startsAt)}/${fmtIso(o.endsAt)}`,
    ...(o.location ? { location: o.location } : {}),
    ...(o.description ? { details: o.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function icsDataUrl(o: {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  description?: string;
}): string {
  const uid = `booking-${Date.now()}@heycami.studio`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cami//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${fmtIso(o.startsAt)}`,
    `DTEND:${fmtIso(o.endsAt)}`,
    `SUMMARY:${o.title}`,
    ...(o.location ? [`LOCATION:${o.location}`] : []),
    ...(o.description ? [`DESCRIPTION:${o.description}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf8,${encodeURIComponent(lines.join("\r\n"))}`;
}
