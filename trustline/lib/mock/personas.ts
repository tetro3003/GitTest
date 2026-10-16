import type { Borrower, ISODate, WorkType } from "../types";
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
  story: "Two years on RideCo, steady earnings, bills always on time, ~45 hrs a week.",
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
      makeSource("giorgi-rideco", "ride_hailing", "RideCo"),
      makeSource("giorgi-utility", "utility", "CityPower & Water"),
      makeSource("giorgi-mobile", "mobile_operator", "MobiCell"),
    ],
    streams: [
      { kind: "platform", provider: "RideCo", hourlyRate: 12.4, bankSourceId: "giorgi-bank" },
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
      sourceId: "giorgi-rideco",
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
  story: "Three direct clients plus FreelanceHub payouts. Income grew from ₾2,000 to ₾4,500, a few uneven months.",
  expected: "Band B",
  appliedAt: "2026-09-27",
  borrower: {
    id: "nino",
    name: "Nino Japaridze",
    phone: "+995 577 98 76 54",
    city: "Tbilisi",
    workType: "it_freelance",
    kycStatus: "verified",
    applicationStatus: "in_review",
    tagline: "Growing IT freelancer",
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
      makeSource("nino-hub", "freelance_platform", "FreelanceHub"),
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
      sourceId: "nino-hub",
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
  story: "Maths tutor with 14 families. Strong September–May, almost nothing in July–August.",
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
      makeSource("levan-tutorbook", "freelance_platform", "TutorBook"),
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
      sourceId: "levan-tutorbook",
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
  expected: "D without activity → C with activity boost",
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
      makeSource("sandro-delivergo", "delivery_platform", "DeliverGo"),
      makeSource("sandro-utility", "utility", "CityPower & Water"),
      makeSource("sandro-mobile", "mobile_operator", "MobiCell"),
    ],
    streams: [{ kind: "platform", provider: "DeliverGo", hourlyRate: 10, bankSourceId: "sandro-bank" }],
    activity: {
      sourceId: "sandro-delivergo",
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
      makeSource("dato-quickdrop", "delivery_platform", "QuickDrop"),
      makeSource("dato-utility", "utility", "CityPower & Water"),
      makeSource("dato-invoices", "invoice_upload", "Invoice upload"),
    ],
    streams: [
      { kind: "platform", provider: "QuickDrop", hourlyRate: 9, bankSourceId: "dato-bank" },
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
      sourceId: "dato-quickdrop",
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
  const platformType = o.workType === "taxi" ? "ride_hailing" : o.workType === "delivery" ? "delivery_platform" : "freelance_platform";
  const provider = o.workType === "taxi" ? "RideCo" : o.workType === "delivery" ? "DeliverGo" : "FreelanceHub";
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
        ...(hours > 0 ? [makeSource(act, platformType, provider)] : []),
        makeSource(`${o.id}-utility`, "utility", "CityPower & Water"),
      ],
      streams: [
        ...(hours > 0 ? [{ kind: "platform" as const, provider, hourlyRate: o.hourlyRate ?? 11, bankSourceId: bank }] : []),
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
              sourceId: act,
              weeks: months * 4,
              hours: ({ weeksAgo, rng }) => rng.normal(hours, 3) * (o.dropLast4w && weeksAgo < 4 ? 1 - o.dropLast4w : 1),
              tripsPerHour: o.workType === "taxi" ? 1.7 : o.workType === "delivery" ? 2.2 : 0.05,
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
  filler({ id: "mariam", name: "Mariam Gogua", city: "Tbilisi", workType: "it_freelance", seed: 613, appliedAt: "2026-09-21", status: "in_review", hours: 32, hourlyRate: 40, clientIncome: 1800 }),
  filler({ id: "irakli", name: "Irakli Abashidze", city: "Kutaisi", workType: "repair", seed: 614, appliedAt: "2026-09-18", status: "new", clientIncome: 1900, billOnTime: 0.8 }),
  filler({ id: "ana", name: "Ana Chkheidze", city: "Batumi", workType: "tutor", seed: 615, appliedAt: "2026-04-03", status: "active_loan", hours: 18, hourlyRate: 25, clientIncome: 600 }),
  filler({ id: "luka", name: "Luka Shengelia", city: "Rustavi", workType: "delivery", seed: 616, appliedAt: "2026-09-10", status: "declined", hours: 30, hourlyRate: 8, gambling: 0.3, billOnTime: 0.6 }),
  filler({ id: "keti", name: "Keti Dolidze", city: "Tbilisi", workType: "other", seed: 617, appliedAt: "2026-05-20", status: "active_loan", clientIncome: 2100 }),
];

export const PERSONAS: PersonaDefinition[] = [giorgi, nino, levan, sandro, dato, ...fillers];
export const FEATURED_PERSONA_IDS = PERSONAS.filter((p) => p.featured).map((p) => p.borrower.id);

export function getPersona(id: string): PersonaDefinition | undefined {
  return PERSONAS.find((p) => p.borrower.id === id);
}
