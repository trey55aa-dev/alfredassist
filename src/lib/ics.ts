// Minimal iCalendar (.ics) export. Lets the user pull a schedule into Apple
// Calendar (or any calendar app) by downloading a standard .ics file — the
// portable path that works without a native EventKit integration.

interface IcsEvent {
  id?: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  description?: string;
  location?: string;
}

/** ISO → UTC iCalendar stamp: YYYYMMDDTHHMMSSZ */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function eventsToIcs(events: IcsEvent[]): string {
  const stamp = icsStamp(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alfred//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    const uid = `${(e.id ?? `${e.title}-${e.start}`).replace(/[^a-zA-Z0-9-]/g, "")}@alfred`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(e.start)}`,
      `DTEND:${icsStamp(e.end)}`,
      `SUMMARY:${esc(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file (user-initiated). */
export function downloadIcs(filename: string, ics: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
