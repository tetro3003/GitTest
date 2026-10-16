/**
 * Single place for product-level constants. Rename the product, change the
 * currency or tune policy thresholds here.
 */
export const PRODUCT_NAME = "Trustline";
export const PRODUCT_TAGLINE =
  "We turn verified gig and freelance earnings plus work activity into a bank-ready income and risk profile.";

export const CURRENCY = {
  code: "GEL",
  symbol: "₾",
  locale: "en-US",
} as const;

/** Fixed "today" for the demo so every run produces the same numbers. */
export const DEMO_AS_OF = "2026-10-01";

/** Scoring policy. Mirrors what the backend will own in the next phase. */
export const SCORING_CONFIG = {
  baseScore: 500,
  minScore: 300,
  maxScore: 850,
  /** Share of free cash flow we recommend as the max monthly loan payment. */
  paymentToFreeCashFlowRatio: 0.4,
  /** Weight applied to the two most recent months (pre-application inflation guard). */
  recentMonthWeight: 0.5,
  bands: { A: 740, B: 670, C: 600, D: 530 },
  /** A high-severity fraud flag caps the score at this value (top of band D). */
  fraudCapScore: 599,
} as const;

/** Lender decision suggestion thresholds (configurable per lender later). */
export const DECISION_THRESHOLDS = {
  approveMinScore: 670,
  declineBelowScore: 560,
  /** Number of high-severity flags that forces a decline. */
  declineHighFlags: 2,
} as const;

/** Monthly income benchmark per segment, used to score income level. */
export const SEGMENT_BENCHMARKS: Record<
  "taxi" | "delivery" | "designer" | "developer" | "tutor" | "beauty" | "repair" | "other",
  { medianIncome: number; maxHourlyEarnings: number; label: string }
> = {
  taxi: { medianIncome: 1800, maxHourlyEarnings: 28, label: "Taxi driver" },
  delivery: { medianIncome: 1400, maxHourlyEarnings: 24, label: "Courier" },
  designer: { medianIncome: 2600, maxHourlyEarnings: 90, label: "UI/UX designer" },
  developer: { medianIncome: 3000, maxHourlyEarnings: 110, label: "Software developer" },
  tutor: { medianIncome: 1500, maxHourlyEarnings: 60, label: "Tutor" },
  beauty: { medianIncome: 1600, maxHourlyEarnings: 45, label: "Beauty specialist" },
  repair: { medianIncome: 1700, maxHourlyEarnings: 45, label: "Repair worker" },
  other: { medianIncome: 1500, maxHourlyEarnings: 50, label: "Self-employed" },
};

/**
 * live (default) = talk to the backend at /api/v1 (same app, SQLite database).
 * mock = run everything in the browser (used for the shareable single-file demo).
 */
export const API_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "mock" ? "mock" : "live";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
/** Key the lender dashboard sends to the API. The backend seeds this demo key for City Bank. */
export const LENDER_API_KEY = process.env.NEXT_PUBLIC_LENDER_API_KEY ?? "tl_demo_citybank_key";

/** Simulated latency range for the mock adapter, in ms. */
export const MOCK_LATENCY: readonly [number, number] = [300, 800];

/** Where the sample export files are served from (public/samples). */
export const SAMPLES_BASE = process.env.NEXT_PUBLIC_SAMPLES_BASE ?? "/samples/";
