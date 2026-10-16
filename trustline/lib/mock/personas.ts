import type { Borrower, ISODate, SourceType, WorkType } from "../types";
import type { MonthCtx, PersonaSpec, WeekCtx } from "./generator";
import { makeSource } from "./sources";

export interface PersonaDefinition {
  borrower: Omit<Borrower, "connectedSources" | "consents">;
  spec: PersonaSpec;
  /** Featured personas appear in the demo switcher and /demo. */
  featured: boolean;
  story: string;
  expected: string;
  appliedAt: ISODate;
}

const monthOfYear = (m: string) => Number(m.slice(5, 7)) - 1;

/* ------------------------------------------------------------------ */
/* 1. Giorgi — stable taxi driver                                      */
/* ------------------------------------------------------------------ */
const giorgi: PersonaDefinition = {
  featured: true,
  story: "Two years on Bolt, steady earnings, bills always on time, ~45 hrs a week.",
  expected: "Band A/B",
  appliedAt: "2026-09-29",
  borrower: {
    id: "giorgi",
    name: "Giorgi Beridze",
    phone: "+995 555 12 34 56",
    city: "Tbilisi",
    workType: "taxi",
    kycStatus: "verified",
    applicationStatus: "new",
    tagline: "Stable taxi driver",
  },
  spec: {
    seed: 101,
    historyMonths: 24,
    startBalance: 900,
    primaryBankId: "giorgi-bank",
    utilitySourceId: "giorgi-utility",
    mobileSourceId: "giorgi-mobile",
    sources: [
      makeSource("giorgi-bank", "bank", "City Bank", { accountHolderName: "Giorgi Beridze" }),
      makeSource("giorgi-bolt", "ride_hailing", "Bolt Driver"),
      makeSource("giorgi-uber", "ride_hailing", "Uber Driver", { status: "available" }),
      makeSource("giorgi-utility", "utility", "CityPower & Water"),
      makeSource("giorgi-mobile", "mobile_operator", "MobiCell"),
    ],
    streams: [
      { kind: "platform", provider: "Bolt", hourlyRate: 12.4, bankSourceId: "giorgi-bank" },
      {
        kind: "clients",
        label: "Private transfers",
        category: "client_payment",
        counterparties: ["Airport transfer — N. Kapanadze", "Airport transfer — Hotel Iveria", "Private client — T. Lomidze"],
        monthly: ({ rng }) => rng.normal(260, 40),
        paymentsPerMonth: [2, 4],
        bankSourceId: "giorgi-bank",
      },
    ],
    activity: {
      sources: [{ id: "giorgi-bolt", type: "ride_hailing", provider: "Bolt Driver", share: 1 }],
      weeks: 104,
      hours: ({ rng }) => rng.normal(45, 2.5),
      tripsPerHour: 1.7,
      rating: 4.88,
    },
    expenses: { rent: 500, utilities: 85, groceries: 450, fuel: 380, mobile: 25, savingsRate: 0.22, gamblingShare: 0, billOnTimeRate: 1, monthlySavingsTransfer: 200 },
    loan: { provider: "City Bank auto loan", monthly: 210, lateMonths: [], startMonthIndex: 2 },
  },
};

/* ------------------------------------------------------------------ */
/* 2. Nino — growing IT freelancer                                     */
/* ------------------------------------------------------------------ */
const nino: PersonaDefinition = {
  featured: true,
  story: "Developer with three direct clients plus FreelanceHub payouts. Income grew from ₾2,000 to ₾4,500; GitHub and Jira show the work behind it.",
  expected: "Band B",
  appliedAt: "2026-09-27",
  borrower: {
    id: "nino",
    name: "Nino Japaridze",
    phone: "+995 577 98 76 54",
    city: "Tbilisi",
    workType: "developer",
    kycStatus: "verified",
    applicationStatus: "in_review",
    tagline: "Growing developer",
  },
  spec: {
    seed: 202,
    historyMonths: 24,
    startBalance: 500,
    primaryBankId: "nino-bank",
    utilitySourceId: "nino-utility",
    mobileSourceId: "nino-mobile",
    invoiceSourceId: "nino-invoices",
    sources: [
      makeSource("nino-bank", "bank", "Lari Bank", { accountHolderName: "Nino Japaridze" }),
      makeSource("nino-github", "dev_tool", "GitHub"),
      makeSource("nino-jira", "dev_tool", "Jira"),
      makeSource("nino-utility", "utility", "CityPower & Water"),
      makeSource("nino-mobile", "mobile_operator", "MobiCell"),
      makeSource("nino-invoices", "invoice_upload", "Invoice upload"),
    ],
    streams: [
      {
        kind: "clients",
        label: "FreelanceHub",
        category: "platform_payout",
        counterparties: ["FreelanceHub"],
        monthly: ({ i, n, rng }) => (rng.chance(0.1) ? 0.3 : 1) * (850 + (1250 * i) / (n - 1)) * rng.range(0.6, 1.4),
        paymentsPerMonth: [2, 4],
        bankSourceId: "nino-bank",
      },
      {
        kind: "clients",
        label: "Direct clients",
        category: "client_payment",
        counterparties: ["Northwind Studio", "Pixel Forge", "Atlas Retail"],
        monthly: ({ i, n, rng }) => (rng.chance(0.12) ? 0.3 : 1) * (1150 + (1250 * i) / (n - 1)) * rng.range(0.6, 1.4),
        paymentsPerMonth: [1, 3],
        bankSourceId: "nino-bank",
      },
    ],
    activity: {
      sources: [
        { id: "nino-github", type: "dev_tool", provider: "GitHub", share: 0.85, items: [{ name: "atlas-retail/web-shop", weight: 5 }, { name: "pixel-forge/payments-api", weight: 3 }, { name: "northwind/cms", weight: 2 }, { name: "nino/dotfiles", weight: 0.3, shared: false }] },
        { id: "nino-jira", type: "dev_tool", provider: "Jira", share: 0.15, items: [{ name: "ATLAS — Atlas Retail", weight: 3 }, { name: "PF — Pixel Forge", weight: 2 }] },
      ],
      weeks: 104,
      hours: ({ w, rng }) => rng.normal(27 + w * 0.06, 3),
      tripsPerHour: 0.05,
      activeContracts: ({ w }) => 2 + Math.floor(w / 45),
      distinctClients: ({ w, rng }) => 3 + Math.floor(w / 50) + (rng.chance(0.2) ? 1 : 0),
      rating: 4.93,
    },
    invoices: { matched: 6, unmatched: 0, clients: ["Northwind Studio", "Pixel Forge", "Atlas Retail"], amount: [600, 1400] },
    expenses: { rent: 1100, utilities: 80, groceries: 480, fuel: 0, mobile: 30, savingsRate: 0.08, gamblingShare: 0, billOnTimeRate: 0.8, monthlySavingsTransfer: 300 },
    loan: { provider: "TechPoint Credit (laptop)", monthly: 350, lateMonths: [15, 19, 22], startMonthIndex: 8 },
  },
};

/* ------------------------------------------------------------------ */
/* 3. Levan — seasonal tutor                                           */
/* ------------------------------------------------------------------ */
const STUDENTS = [
  "Parent — M. Gelashvili", "Parent — K. Abashidze", "Parent — L. Tsiklauri", "Parent — S. Maisuradze",
  "Parent — E. Kiknadze", "Parent — D. Natsvlishvili", "Parent — R. Chikovani", "Parent — T. Kurtanidze",
  "Parent — A. Dolidze", "Parent — G. Shengelia", "Parent — N. Bakradze", "Parent — I. Gogoladze",
  "Parent — Z. Lomtadze", "Parent — B. Javakhishvili",
];
const tutorSeason = (m: number) => (m === 5 ? 0.25 : m === 6 ? 0.03 : m === 7 ? 0.06 : 1);
const levan: PersonaDefinition = {
  featured: true,
  story: "Maths tutor with 14 families, online on Zoom and at home. Strong September–May, almost nothing in July–August.",
  expected: "Band C, seasonality explained",
  appliedAt: "2026-09-30",
  borrower: {
    id: "levan",
    name: "Levan Tsiklauri",
    phone: "+995 593 11 22 33",
    city: "Kutaisi",
    workType: "tutor",
    kycStatus: "verified",
    applicationStatus: "new",
    tagline: "Seasonal tutor",
  },
  spec: {
    seed: 303,
    historyMonths: 24,
    startBalance: 1800,
    primaryBankId: "levan-bank",
    utilitySourceId: "levan-utility",
    mobileSourceId: "levan-mobile",
    sources: [
      makeSource("levan-bank", "bank", "City Bank", { accountHolderName: "Levan Tsiklauri" }),
      makeSource("levan-zoom", "video_lessons", "Zoom"),
      makeSource("levan-meet", "video_lessons", "Google Meet", { status: "available" }),
      makeSource("levan-audio", "lesson_audio", "Offline lesson audio"),
      makeSource("levan-utility", "utility", "CityPower & Water"),
      makeSource("levan-mobile", "mobile_operator", "MobiCell"),
    ],
    streams: [
      {
        kind: "clients",
        label: "Lesson payments",
        category: "client_payment",
        counterparties: STUDENTS,
        monthly: ({ month, rng }) => 2250 * tutorSeason(monthOfYear(month)) * rng.range(0.88, 1.12),
        paymentsPerMonth: [3, 14],
        bankSourceId: "levan-bank",
      },
    ],
    activity: {
      sources: [
        { id: "levan-zoom", type: "video_lessons", provider: "Zoom", share: 0.55, items: [{ name: "Maths — exam prep (grade 12)", weight: 3 }, { name: "Maths — grade 9 group", weight: 2 }] },
        { id: "levan-audio", type: "lesson_audio", provider: "Offline lesson audio", share: 0.45, items: [{ name: "Home lesson — 14 Sep", weight: 1 }, { name: "Home lesson — 21 Sep", weight: 1 }, { name: "Home lesson — 28 Sep", weight: 1 }] },
      ],
      weeks: 104,
      hours: ({ month, rng }: WeekCtx) => rng.normal(22, 2) * tutorSeason(monthOfYear(month)),
      tripsPerHour: 1,
      distinctClients: ({ month, rng }) => Math.round((12 + rng.int(0, 2)) * Math.min(1, tutorSeason(monthOfYear(month)) * 2)),
      rating: 4.95,
    },
    savingsDrawdown: { months: [6, 7], amount: 650 },
    expenses: { rent: 550, utilities: 70, groceries: 400, fuel: 0, mobile: 20, savingsRate: 0.28, gamblingShare: 0, billOnTimeRate: 0.9 },
  },
};

/* ------------------------------------------------------------------ */
/* 4. Sandro — new courier, short history                              */
/* ------------------------------------------------------------------ */
const sandro: PersonaDefinition = {
  featured: true,
  story: "Started delivering 4 months ago. Short income history, but 42 hrs online every single week.",
  expected: "D without work data → C with Work Checker",
  appliedAt: "2026-09-30",
  borrower: {
    id: "sandro",
    name: "Sandro Kapanadze",
    phone: "+995 598 44 55 66",
    city: "Batumi",
    workType: "delivery",
    kycStatus: "verified",
    applicationStatus: "new",
    tagline: "New courier",
  },
  spec: {
    seed: 404,
    historyMonths: 5,
    incomeMonths: 4,
    startBalance: 1500,
    primaryBankId: "sandro-bank",
    utilitySourceId: "sandro-utility",
    mobileSourceId: "sandro-mobile",
    sources: [
      makeSource("sandro-bank", "bank", "Black Sea Bank", { accountHolderName: "Sandro Kapanadze" }),
      makeSource("sandro-wolt", "delivery_platform", "Wolt Partner"),
      makeSource("sandro-glovo", "delivery_platform", "Glovo Courier", { status: "available" }),
      makeSource("sandro-utility", "utility", "CityPower & Water"),
      makeSource("sandro-mobile", "mobile_operator", "MobiCell"),
    ],
    streams: [{ kind: "platform", provider: "Wolt", hourlyRate: 10, bankSourceId: "sandro-bank" }],
    activity: {
      sources: [{ id: "sandro-wolt", type: "delivery_platform", provider: "Wolt Partner", share: 1 }],
      weeks: 18,
      hours: ({ w, rng }) => rng.normal(41 + Math.min(w, 6) * 0.3, 1.5),
      tripsPerHour: 2.3,
      rating: 4.82,
    },
    expenses: { rent: 300, utilities: 50, groceries: 300, fuel: 160, mobile: 20, savingsRate: 0.2, gamblingShare: 0, billOnTimeRate: 1 },
  },
};

/* ------------------------------------------------------------------ */
/* 5. Dato — fraud case                                                */
/* ------------------------------------------------------------------ */
const dato: PersonaDefinition = {
  featured: true,
  story: "Income tripled right before applying — driven by money bouncing between friends, unpaid invoices and very low platform activity.",
  expected: "Fraud flags, band capped at D",
  appliedAt: "2026-09-30",
  borrower: {
    id: "dato",
    name: "Dato Mchedlishvili",
    phone: "+995 551 00 99 88",
    city: "Rustavi",
    workType: "delivery",
    kycStatus: "verified",
    applicationStatus: "new",
    tagline: "Fraud case",
  },
  spec: {
    seed: 505,
    historyMonths: 12,
    startBalance: 2600,
    primaryBankId: "dato-bank",
    utilitySourceId: "dato-utility",
    invoiceSourceId: "dato-invoices",
    sources: [
      makeSource("dato-bank", "bank", "City Bank", { accountHolderName: "Dato Mchedlishvili" }),
      makeSource("dato-bank2", "bank", "Express Bank", { accountHolderName: "Irakli Gelashvili" }),
      makeSource("dato-glovo", "delivery_platform", "Glovo Courier"),
      makeSource("dato-utility", "utility", "CityPower & Water"),
      makeSource("dato-invoices", "invoice_upload", "Invoice upload"),
    ],
    streams: [
      { kind: "platform", provider: "Glovo", hourlyRate: 9, bankSourceId: "dato-bank" },
      {
        kind: "clients",
        label: "Odd jobs",
        category: "client_payment",
        counterparties: ["Cash deposit", "Odd job — N. Sh."],
        monthly: ({ rng }) => rng.normal(520, 120),
        paymentsPerMonth: [1, 3],
        bankSourceId: "dato-bank",
      },
    ],
    activity: {
      sources: [{ id: "dato-glovo", type: "delivery_platform", provider: "Glovo Courier", share: 1 }],
      weeks: 52,
      hours: ({ rng }) => Math.max(0, rng.normal(8, 2.5)),
      tripsPerHour: 2,
      rating: 4.41,
    },
    circular: {
      counterparties: ["Giga T.", "Mamuka K.", "Levan R."],
      monthsAgo: [1, 2],
      perMonth: 4,
      amount: [1100, 2100],
      bankSourceId: "dato-bank",
    },
    secondaryInflows: { bankSourceId: "dato-bank2", counterparty: "Cash deposit", perMonth: 2, amount: [700, 1300], monthsAgo: [1, 2] },
    invoices: { matched: 0, unmatched: 5, clients: ["BuildMart LLC", "Prime Logistics"], amount: [1500, 2600] },
    expenses: { rent: 350, utilities: 60, groceries: 320, fuel: 60, mobile: 25, savingsRate: 0.15, gamblingShare: 0.02, billOnTimeRate: 0.92 },
  },
};

/* ------------------------------------------------------------------ */
/* Background applicants (fill out the lender dashboard)               */
/* ------------------------------------------------------------------ */

/** Default work tool and payout counterparty per profession for background applicants. */
const FILLER_TOOLS: Partial<Record<WorkType, { type: SourceType; provider: string; payer: string }>> = {
  taxi: { type: "ride_hailing", provider: "Bolt Driver", payer: "Bolt" },
  delivery: { type: "delivery_platform", provider: "Wolt Partner", payer: "Wolt" },
  tutor: { type: "video_lessons", provider: "Zoom", payer: "Preply" },
  designer: { type: "design_tool", provider: "Figma", payer: "Upwork" },
  developer: { type: "dev_tool", provider: "GitHub", payer: "Upwork" },
  beauty: { type: "booking_app", provider: "Booksy", payer: "Booksy Pay" },
};

interface FillerOpts {
  id: string;
  name: string;
  city: string;
  workType: WorkType;
  seed: number;
  appliedAt: ISODate;
  status: Borrower["applicationStatus"];
  /** Weekly hours; `dropLast4w` simulates a recent decline. */
  hours?: number;
  hourlyRate?: number;
  dropLast4w?: number;
  clientIncome?: number;
  gambling?: number;
  billOnTime?: number;
  months?: number;
}

function filler(o: FillerOpts): PersonaDefinition {
  const tool = FILLER_TOOLS[o.workType] ?? { type: "delivery_platform" as const, provider: "Wolt Partner", payer: "Wolt" };
  const bank = `${o.id}-bank`;
  const act = `${o.id}-platform`;
  const months = o.months ?? 18;
  const hours = o.hours ?? 0;
  return {
    featured: false,
    story: "",
    expected: "",
    appliedAt: o.appliedAt,
    borrower: { id: o.id, name: o.name, phone: "+995 5xx xx xx xx", city: o.city, workType: o.workType, kycStatus: "verified", applicationStatus: o.status },
    spec: {
      seed: o.seed,
      historyMonths: months,
      startBalance: 700,
      primaryBankId: bank,
      utilitySourceId: `${o.id}-utility`,
      sources: [
        makeSource(bank, "bank", "City Bank", { accountHolderName: o.name }),
        ...(hours > 0 ? [makeSource(act, tool.type, tool.provider)] : []),
        makeSource(`${o.id}-utility`, "utility", "CityPower & Water"),
      ],
      streams: [
        ...(hours > 0 ? [{ kind: "platform" as const, provider: tool.payer, hourlyRate: o.hourlyRate ?? 11, bankSourceId: bank }] : []),
        ...(o.clientIncome
          ? [
              {
                kind: "clients" as const,
                label: "Clients",
                category: "client_payment" as const,
                counterparties: ["Client — A. B.", "Client — M. K.", "Client — Studio 9", "Client — L. P."],
                monthly: ({ rng }: MonthCtx) => rng.normal(o.clientIncome ?? 0, (o.clientIncome ?? 0) * 0.18),
                paymentsPerMonth: [2, 6] as [number, number],
                bankSourceId: bank,
              },
            ]
          : []),
      ],
      activity:
        hours > 0
          ? {
              sources: [{ id: act, type: tool.type, provider: tool.provider, share: 1 }],
              weeks: months * 4,
              hours: ({ weeksAgo, rng }) => rng.normal(hours, 3) * (o.dropLast4w && weeksAgo < 4 ? 1 - o.dropLast4w : 1),
              tripsPerHour: o.workType === "taxi" ? 1.7 : o.workType === "delivery" ? 2.2 : o.workType === "tutor" ? 1 : 0.05,
              rating: 4.7,
            }
          : undefined,
      expenses: { rent: 400, utilities: 70, groceries: 380, fuel: o.workType === "taxi" || o.workType === "delivery" ? 250 : 0, mobile: 20, savingsRate: 0.18, gamblingShare: o.gambling ?? 0, billOnTimeRate: o.billOnTime ?? 0.95 },
    },
  };
}

const fillers: PersonaDefinition[] = [
  filler({ id: "tamar", name: "Tamar Kvaratskhelia", city: "Tbilisi", workType: "delivery", seed: 611, appliedAt: "2026-06-12", status: "active_loan", hours: 44, hourlyRate: 9, dropLast4w: 0.35 }),
  filler({ id: "beka", name: "Beka Lomidze", city: "Tbilisi", workType: "taxi", seed: 612, appliedAt: "2026-09-25", status: "approved", hours: 50, hourlyRate: 12 }),
  filler({ id: "irakli", name: "Irakli Abashidze", city: "Kutaisi", workType: "repair", seed: 614, appliedAt: "2026-09-18", status: "new", clientIncome: 1900, billOnTime: 0.8 }),
  filler({ id: "ana", name: "Ana Chkheidze", city: "Batumi", workType: "tutor", seed: 615, appliedAt: "2026-04-03", status: "active_loan", hours: 18, hourlyRate: 25, clientIncome: 600 }),
  filler({ id: "luka", name: "Luka Shengelia", city: "Rustavi", workType: "delivery", seed: 616, appliedAt: "2026-09-10", status: "declined", hours: 30, hourlyRate: 8, gambling: 0.3, billOnTime: 0.6 }),
  filler({ id: "giga", name: "Giga Tsereteli", city: "Tbilisi", workType: "developer", seed: 618, appliedAt: "2026-09-12", status: "in_review", hours: 26, hourlyRate: 45, clientIncome: 900 }),
];

/* ------------------------------------------------------------------ */
/* 6. Mariam — UI/UX designer                                          */
/* ------------------------------------------------------------------ */
const mariam: PersonaDefinition = {
  featured: true,
  story: "Freelance UI/UX designer for three agencies. Figma version history, Photoshop and Illustrator sessions show the work behind every invoice.",
  expected: "Band A/B, strong design evidence",
  appliedAt: "2026-09-21",
  borrower: { id: "mariam", name: "Mariam Gogua", phone: "+995 568 21 43 65", city: "Tbilisi", workType: "designer", kycStatus: "verified", applicationStatus: "in_review", tagline: "UI/UX designer" },
  spec: {
    seed: 613,
    historyMonths: 18,
    startBalance: 1200,
    primaryBankId: "mariam-bank",
    utilitySourceId: "mariam-utility",
    mobileSourceId: "mariam-mobile",
    sources: [
      makeSource("mariam-bank", "bank", "Lari Bank", { accountHolderName: "Mariam Gogua" }),
      makeSource("mariam-figma", "design_tool", "Figma"),
      makeSource("mariam-ps", "design_tool", "Adobe Photoshop"),
      makeSource("mariam-ai", "design_tool", "Adobe Illustrator"),
      makeSource("mariam-utility", "utility", "CityPower & Water"),
      makeSource("mariam-mobile", "mobile_operator", "MobiCell"),
    ],
    streams: [
      {
        kind: "clients",
        label: "Agencies",
        category: "client_payment",
        counterparties: ["Bloom Agency", "Kavea Studio", "Nordic Apps"],
        monthly: ({ i, rng }) => (2900 + i * 25) * rng.range(0.85, 1.15),
        paymentsPerMonth: [2, 4],
        bankSourceId: "mariam-bank",
      },
    ],
    activity: {
      sources: [
        { id: "mariam-figma", type: "design_tool", provider: "Figma", share: 0.65, items: [{ name: "Bloom — banking app redesign", weight: 4 }, { name: "Kavea — e-shop checkout", weight: 3 }, { name: "Nordic Apps — design system", weight: 2 }, { name: "Personal portfolio", weight: 0.5, shared: false }] },
        { id: "mariam-ps", type: "design_tool", provider: "Adobe Photoshop", share: 0.2, items: [{ name: "Kavea product photos.psd", weight: 2 }, { name: "Bloom app store screens.psd", weight: 1 }] },
        { id: "mariam-ai", type: "design_tool", provider: "Adobe Illustrator", share: 0.15, items: [{ name: "Nordic Apps icon set.ai", weight: 2 }, { name: "Kavea logo refresh.ai", weight: 1 }] },
      ],
      weeks: 72,
      hours: ({ rng }) => rng.normal(34, 3),
      tripsPerHour: 0.05,
      distinctClients: () => 3,
      rating: 4.9,
    },
    expenses: { rent: 800, utilities: 75, groceries: 420, fuel: 0, mobile: 25, savingsRate: 0.2, gamblingShare: 0, billOnTimeRate: 0.95, monthlySavingsTransfer: 250 },
  },
};

/* ------------------------------------------------------------------ */
/* 7. Keti — beauty specialist                                         */
/* ------------------------------------------------------------------ */
const keti: PersonaDefinition = {
  featured: true,
  story: "Hairdresser and nail artist renting a chair at Salon Lumi. Booksy bookings and the salon's door and station sensors confirm ~130 services a month.",
  expected: "Band A/B, bookings match sensors",
  appliedAt: "2026-09-26",
  borrower: { id: "keti", name: "Keti Dolidze", phone: "+995 574 66 77 88", city: "Tbilisi", workType: "beauty", kycStatus: "verified", applicationStatus: "new", tagline: "Beauty specialist" },
  spec: {
    seed: 617,
    historyMonths: 18,
    startBalance: 900,
    primaryBankId: "keti-bank",
    utilitySourceId: "keti-utility",
    sources: [
      makeSource("keti-bank", "bank", "City Bank", { accountHolderName: "Keti Dolidze" }),
      makeSource("keti-booksy", "booking_app", "Booksy"),
      makeSource("keti-fresha", "booking_app", "Fresha", { status: "available" }),
      makeSource("keti-sensors", "salon_sensors", "Salon sensors"),
      makeSource("keti-utility", "utility", "CityPower & Water"),
    ],
    streams: [
      {
        kind: "clients",
        label: "Card payments",
        category: "client_payment",
        counterparties: ["Salon Lumi — card terminal payout", "Booksy Pay"],
        monthly: ({ rng }) => rng.normal(2250, 220),
        paymentsPerMonth: [6, 10],
        bankSourceId: "keti-bank",
      },
    ],
    activity: {
      sources: [
        { id: "keti-booksy", type: "booking_app", provider: "Booksy", share: 1 },
        { id: "keti-sensors", type: "salon_sensors", provider: "Salon sensors", share: 0 },
      ],
      weeks: 72,
      hours: ({ rng }) => rng.normal(38, 2.5),
      tripsPerHour: 0.75,
      rating: 4.86,
    },
    expenses: { rent: 450, utilities: 70, groceries: 380, fuel: 0, mobile: 20, savingsRate: 0.18, gamblingShare: 0, billOnTimeRate: 0.95 },
  },
};

export const PERSONAS: PersonaDefinition[] = [giorgi, nino, levan, sandro, dato, mariam, keti, ...fillers];
export const FEATURED_PERSONA_IDS = PERSONAS.filter((p) => p.featured).map((p) => p.borrower.id);

export function getPersona(id: string): PersonaDefinition | undefined {
  return PERSONAS.find((p) => p.borrower.id === id);
}
