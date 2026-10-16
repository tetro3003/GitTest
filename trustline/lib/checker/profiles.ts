import type { EvidenceChannel, SourceType, WorkType } from "../types";

/**
 * Work Checker profiles: for each profession, which apps prove the work, what
 * they track, how much an active hour can realistically earn, and which
 * authenticity checks run on the raw signals. Framework-free.
 */

export interface CheckerSourceDef {
  type: SourceType;
  provider: string;
  /** What we read from the app, shown on the consent screen. */
  tracks: string[];
  /** How the real integration will work (shown to users and lenders). */
  how: string;
  /** Name of the things the user picks to share, if any ("files", "repositories"). */
  items?: string;
  /** Sources that produce signals but no hours (e.g. sensors). */
  signalsOnly?: boolean;
  /** Ways real data can come in for this app. */
  channels: EvidenceChannel[];
  /** Where to find the export in the app, shown on the upload screen. */
  exportHint?: string;
}

export interface SignalDef {
  key: string;
  label: string;
  /** Unit suffix used when displaying totals. */
  unit?: string;
}

export interface QualityCheck {
  label: string;
  target: string;
  /** Returns the displayed value and whether it passes, or null if the data isn't shared. */
  run: (s: Record<string, number>, ctx: { weeks: number; hours: number }) => { value: string; ok: boolean } | null;
}

export interface ProfessionChecker {
  workType: WorkType;
  label: string;
  /** What one unit of work is called. */
  unit: string;
  sources: CheckerSourceDef[];
  /** Realistic gross earnings per active hour (GEL) for this work. */
  hourlyRange: [number, number];
  signals: SignalDef[];
  checks: QualityCheck[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const has = (s: Record<string, number>, ...keys: string[]) => keys.every((k) => k in s);

export const CHECKERS: ProfessionChecker[] = [
  {
    workType: "taxi",
    label: "Taxi driver",
    unit: "trips",
    hourlyRange: [9, 20],
    sources: [
      { type: "ride_hailing", provider: "Bolt Driver", tracks: ["Hours online", "Completed trips", "Distance driven", "Acceptance rate", "Driver rating"], how: "Driver signs in to Bolt; we read the weekly earnings statement and trip log.", channels: ["file", "webhook"], exportHint: "Bolt Driver app → Earnings → Download statement (CSV)" },
      { type: "ride_hailing", provider: "Uber Driver", tracks: ["Hours online", "Completed trips", "Distance driven", "Driver rating"], how: "Driver signs in to Uber; we read trip history and weekly statements.", channels: ["file", "webhook"], exportHint: "drivers.uber.com → Earnings → Statements → Download CSV" },
    ],
    signals: [
      { key: "trips", label: "Trips completed" },
      { key: "km", label: "Distance driven", unit: "km" },
      { key: "accepted", label: "Ride requests accepted" },
      { key: "offered", label: "Ride requests offered" },
    ],
    checks: [
      { label: "Trips per hour online", target: "1–3 per hour", run: (s, c) => (has(s, "trips") ? { value: ratio(s.trips, c.hours).toFixed(1), ok: ratio(s.trips, c.hours) >= 1 && ratio(s.trips, c.hours) <= 3 } : null) },
      { label: "Kilometres per trip", target: "3–20 km", run: (s) => (has(s, "km", "trips") ? { value: ratio(s.km, s.trips).toFixed(1), ok: ratio(s.km, s.trips) >= 3 && ratio(s.km, s.trips) <= 20 } : null) },
      { label: "Acceptance rate", target: "≥ 75%", run: (s) => (has(s, "accepted", "offered") ? { value: pct(ratio(s.accepted, s.offered)), ok: ratio(s.accepted, s.offered) >= 0.75 } : null) },
    ],
  },
  {
    workType: "delivery",
    label: "Courier",
    unit: "orders",
    hourlyRange: [7, 16],
    sources: [
      { type: "delivery_platform", provider: "Wolt Partner", tracks: ["Hours online", "Orders delivered", "Distance", "Completion rate", "Courier rating"], how: "Courier signs in to Wolt; we read the shift log and payout statements.", channels: ["file", "webhook"], exportHint: "Wolt Partner app → Earnings → Export (CSV)" },
      { type: "delivery_platform", provider: "Glovo Courier", tracks: ["Hours online", "Orders delivered", "Distance", "Completion rate"], how: "Courier signs in to Glovo; we read slot history and earnings.", channels: ["file", "webhook"], exportHint: "Glovo Couriers app → Earnings → Download report" },
    ],
    signals: [
      { key: "orders", label: "Orders delivered" },
      { key: "km", label: "Distance", unit: "km" },
      { key: "completed", label: "Orders completed" },
      { key: "assigned", label: "Orders assigned" },
    ],
    checks: [
      { label: "Orders per hour online", target: "1–4 per hour", run: (s, c) => (has(s, "orders") ? { value: ratio(s.orders, c.hours).toFixed(1), ok: ratio(s.orders, c.hours) >= 1 && ratio(s.orders, c.hours) <= 4 } : null) },
      { label: "Completion rate", target: "≥ 90%", run: (s) => (has(s, "completed", "assigned") ? { value: pct(ratio(s.completed, s.assigned)), ok: ratio(s.completed, s.assigned) >= 0.9 } : null) },
      { label: "Kilometres per order", target: "1–10 km", run: (s) => (has(s, "km", "orders") ? { value: ratio(s.km, s.orders).toFixed(1), ok: ratio(s.km, s.orders) >= 1 && ratio(s.km, s.orders) <= 10 } : null) },
    ],
  },
  {
    workType: "designer",
    label: "UI/UX designer",
    unit: "design hours",
    hourlyRange: [20, 90],
    sources: [
      { type: "design_tool", provider: "Figma", tracks: ["Version history of the files you pick", "Editing sessions", "Comments from clients", "Collaborators"], how: "Designer signs in to Figma and picks files; we read each file's version history and comments (Figma REST API).", items: "files", channels: ["api", "tracker", "file"], exportHint: "Any time-tracking export (Toggl, Clockify) of your Figma work" },
      { type: "design_tool", provider: "Adobe Photoshop", tracks: ["Editing time per document", "Saves", "Export events"], how: "The Trustline desktop tracker counts minutes you actively work in Photoshop (app name and time only — no screenshots).", items: "documents", channels: ["tracker", "file"], exportHint: "A time-tracking export (Toggl, Clockify, RescueTime) filtered to Photoshop" },
      { type: "design_tool", provider: "Adobe Illustrator", tracks: ["Editing time per document", "Saves", "Export events"], how: "The Trustline desktop tracker counts minutes you actively work in Illustrator.", items: "documents", channels: ["tracker", "file"], exportHint: "A time-tracking export filtered to Illustrator" },
    ],
    signals: [
      { key: "sessions", label: "Editing sessions" },
      { key: "versions", label: "Versions saved" },
      { key: "activeDays", label: "Active days" },
      { key: "clientComments", label: "Comments from clients" },
      { key: "exports", label: "Exports / handoffs" },
    ],
    checks: [
      { label: "Days with design work per week", target: "≥ 3 days", run: (s, c) => (has(s, "activeDays") ? { value: ratio(s.activeDays, c.weeks).toFixed(1), ok: ratio(s.activeDays, c.weeks) >= 3 } : null) },
      { label: "Average editing session", target: "20 min – 4 h", run: (s, c) => (has(s, "sessions") ? { value: `${Math.round(ratio(c.hours, s.sessions) * 60)} min`, ok: ratio(c.hours, s.sessions) >= 0.33 && ratio(c.hours, s.sessions) <= 4 } : null) },
      { label: "Client feedback on files", target: "≥ 2 comments / month", run: (s, c) => (has(s, "clientComments") ? { value: (ratio(s.clientComments, c.weeks) * 4.33).toFixed(1), ok: ratio(s.clientComments, c.weeks) * 4.33 >= 2 } : null) },
    ],
  },
  {
    workType: "developer",
    label: "Software developer",
    unit: "coding hours",
    hourlyRange: [25, 110],
    sources: [
      { type: "dev_tool", provider: "GitHub", tracks: ["Commits on the repositories you pick", "Pull requests merged", "Code reviews by others", "Active days"], how: "Developer signs in with a GitHub username; we read public commit and pull-request metadata, never the code.", items: "repositories", channels: ["api", "file"], exportHint: "git log --pretty=format:'%ad,%s' --date=iso > commits.csv" },
      { type: "dev_tool", provider: "Jira", tracks: ["Issues resolved", "Logged work time", "Projects and clients"], how: "Developer connects Jira Cloud; we read resolved issues and work logs.", items: "projects", channels: ["file", "webhook"], exportHint: "Jira → Filters → Export → CSV (all fields), or a Tempo worklog export" },
    ],
    signals: [
      { key: "commits", label: "Commits" },
      { key: "prsMerged", label: "Pull requests merged" },
      { key: "reviewsByOthers", label: "Reviews by other people" },
      { key: "activeDays", label: "Active days" },
      { key: "issuesResolved", label: "Jira issues resolved" },
    ],
    checks: [
      { label: "Days with commits per week", target: "≥ 3 days", run: (s, c) => (has(s, "activeDays") ? { value: ratio(s.activeDays, c.weeks).toFixed(1), ok: ratio(s.activeDays, c.weeks) >= 3 } : null) },
      { label: "Work reviewed by other people", target: "≥ 1 review / week", run: (s, c) => (has(s, "reviewsByOthers") ? { value: ratio(s.reviewsByOthers, c.weeks).toFixed(1), ok: ratio(s.reviewsByOthers, c.weeks) >= 1 } : null) },
      { label: "Commits per hour", target: "< 5 (no automated spam)", run: (s, c) => (has(s, "commits") ? { value: ratio(s.commits, c.hours).toFixed(1), ok: ratio(s.commits, c.hours) < 5 } : null) },
    ],
  },
  {
    workType: "tutor",
    label: "Tutor",
    unit: "lessons",
    hourlyRange: [15, 60],
    sources: [
      { type: "video_lessons", provider: "Zoom", tracks: ["Lessons held", "Lesson length", "Number of different students"], how: "Tutor connects Zoom; we read meeting metadata (time, length, participant count), never recordings.", items: "lesson series", channels: ["file", "webhook"], exportHint: "zoom.us → Reports → Usage → Export as CSV" },
      { type: "video_lessons", provider: "Google Meet", tracks: ["Lessons held", "Lesson length", "Number of different students"], how: "Tutor connects Google Calendar + Meet; we read meeting metadata.", items: "lesson series", channels: ["file"], exportHint: "Google Calendar → Settings → Import & export → Export, or a Meet attendance CSV" },
      { type: "lesson_audio", provider: "Offline lesson audio", tracks: ["Recording length", "Share of time with speech"], how: "Tutor uploads or records lesson audio. We only measure how long someone was speaking; audio is never stored or transcribed.", items: "recordings", channels: ["upload"] },
    ],
    signals: [
      { key: "lessons", label: "Lessons" },
      { key: "students", label: "Different students" },
      { key: "recordings", label: "Offline recordings" },
      { key: "speechMinutes", label: "Teaching minutes detected", unit: "min" },
      { key: "recordedMinutes", label: "Recorded minutes", unit: "min" },
    ],
    checks: [
      { label: "Average lesson length", target: "30–120 min", run: (s, c) => (has(s, "lessons") ? { value: `${Math.round(ratio(c.hours, s.lessons) * 60)} min`, ok: ratio(c.hours, s.lessons) >= 0.5 && ratio(c.hours, s.lessons) <= 2 } : null) },
      { label: "Different students", target: "≥ 5", run: (s, c) => (has(s, "students") ? { value: String(Math.round(ratio(s.students, c.weeks))), ok: ratio(s.students, c.weeks) >= 5 } : null) },
      { label: "Speech in offline recordings", target: "≥ 60% of the time", run: (s) => (has(s, "speechMinutes", "recordedMinutes") && s.recordedMinutes > 0 ? { value: pct(ratio(s.speechMinutes, s.recordedMinutes)), ok: ratio(s.speechMinutes, s.recordedMinutes) >= 0.6 } : null) },
    ],
  },
  {
    workType: "beauty",
    label: "Beauty services",
    unit: "appointments",
    hourlyRange: [12, 45],
    sources: [
      { type: "booking_app", provider: "Booksy", tracks: ["Appointments completed", "No-shows", "Different clients", "Service types", "Client rating"], how: "Stylist connects Booksy; we read the appointment calendar and service history.", channels: ["file", "webhook"], exportHint: "Booksy Biz → Statistics → Appointments → Export" },
      { type: "booking_app", provider: "Fresha", tracks: ["Appointments completed", "No-shows", "Different clients", "Service types"], how: "Stylist connects Fresha; we read appointments and sales history.", channels: ["file", "webhook"], exportHint: "Fresha → Reports → Appointments list → Download CSV" },
      { type: "salon_sensors", provider: "Salon sensors", tracks: ["Visitors (door counter)", "Hair services (chair sensor)", "Nail services (station sensor)", "Other services"], how: "Pilot hardware: a door counter and station sensors send anonymous counts — no cameras, no personal data.", signalsOnly: true, channels: ["webhook"] },
    ],
    signals: [
      { key: "appointments", label: "Appointments completed" },
      { key: "noShows", label: "No-shows" },
      { key: "clients", label: "Different clients" },
      { key: "visitors", label: "Visitors counted", unit: "people" },
      { key: "hair", label: "Hair services (sensor)" },
      { key: "nails", label: "Nail services (sensor)" },
      { key: "otherServices", label: "Other services (sensor)" },
    ],
    checks: [
      { label: "Appointments per working hour", target: "0.4–2", run: (s, c) => (has(s, "appointments") ? { value: ratio(s.appointments, c.hours).toFixed(1), ok: ratio(s.appointments, c.hours) >= 0.4 && ratio(s.appointments, c.hours) <= 2 } : null) },
      { label: "No-show rate", target: "≤ 15%", run: (s) => (has(s, "noShows", "appointments") ? { value: pct(ratio(s.noShows, s.appointments + s.noShows)), ok: ratio(s.noShows, s.appointments + s.noShows) <= 0.15 } : null) },
      {
        label: "Sensor services vs bookings",
        target: "80–130% of bookings",
        run: (s) => {
          if (!has(s, "hair", "nails", "otherServices", "appointments")) return null;
          const r = ratio(s.hair + s.nails + s.otherServices, s.appointments);
          return { value: pct(r), ok: r >= 0.8 && r <= 1.3 };
        },
      },
    ],
  },
];

/**
 * Universal checker for professions without their own profile (repair, other…):
 * works with any app the person adds, using generic time and earnings checks.
 */
export function genericChecker(workType: WorkType): ProfessionChecker {
  return {
    workType,
    label: workType === "repair" ? "Repair worker" : "Self-employed",
    unit: "work hours",
    hourlyRange: [8, 60],
    sources: [],
    signals: [{ key: "activeDays", label: "Active days" }],
    checks: [
      { label: "Days with work per week", target: "≥ 3 days", run: (s, c) => (has(s, "activeDays") ? { value: ratio(s.activeDays, c.weeks).toFixed(1), ok: ratio(s.activeDays, c.weeks) >= 3 } : null) },
    ],
  };
}

export function checkerFor(workType: WorkType): ProfessionChecker {
  return CHECKERS.find((c) => c.workType === workType) ?? genericChecker(workType);
}

export function isWorkEvidenceType(t: SourceType): boolean {
  return t === "custom_app" || CHECKERS.some((c) => c.sources.some((s) => s.type === t));
}

/** "Any other app" — the universal source every profession can add. */
export const CUSTOM_APP_SOURCE: CheckerSourceDef = {
  type: "custom_app",
  provider: "Other app",
  tracks: ["Work sessions and their length", "Clients", "Earnings, if the export has them"],
  how: "Add any app you work in. Upload its export, send events from Zapier/Make, or run the desktop tracker.",
  channels: ["file", "webhook", "tracker"],
  exportHint: "Most apps have Settings → Download your data / Export (CSV or JSON)",
};

export function sourceDefFor(provider: string, type?: SourceType): CheckerSourceDef | undefined {
  if (type === "custom_app") return { ...CUSTOM_APP_SOURCE, provider };
  return CHECKERS.flatMap((c) => c.sources).find((s) => s.provider === provider);
}

export const CHANNEL_LABEL: Record<EvidenceChannel, string> = {
  api: "Sign in (API)",
  file: "Upload export",
  webhook: "Live webhook",
  tracker: "Desktop tracker",
  upload: "Recording",
  simulated: "Demo data",
};

/** Verdict → points. Not sharing costs more than weak evidence, so hiding never pays. */
export const WORK_CHECK_POINTS = {
  strong: 50,
  moderate: 20,
  weak: -15,
  not_shared: -30,
  mismatch: -50,
  not_supported: 0,
} as const;
