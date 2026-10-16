/**
 * Domain types shared by the UI, the API client and the scoring engine.
 * Keep this file framework-free: the backend will reuse these shapes.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;
export type MonthKey = string; // YYYY-MM

export type WorkType = "taxi" | "delivery" | "designer" | "developer" | "tutor" | "beauty" | "repair" | "other";
export type KycStatus = "not_started" | "pending" | "verified" | "failed";

export type SourceType =
  | "bank"
  | "ride_hailing"
  | "delivery_platform"
  | "design_tool"
  | "dev_tool"
  | "video_lessons"
  | "lesson_audio"
  | "booking_app"
  | "salon_sensors"
  | "custom_app"
  | "utility"
  | "mobile_operator"
  | "invoice_upload";

/** 1 = verified money, 2 = payment behaviour, 3 = work evidence */
export type SourceTier = 1 | 2 | 3;
export type SourceStatus = "available" | "connected" | "revoked" | "error";

export interface DataSource {
  id: string;
  type: SourceType;
  provider: string;
  status: SourceStatus;
  connectedAt: ISODateTime | null;
  tier: SourceTier;
  /** Name on the account as reported by the provider (used for KYC match). */
  accountHolderName?: string;
  /** Human-readable list of what is shared when connected. */
  dataShared: string[];
  /** How many days the consent is valid for. */
  consentDays: number;
  /** Not required to get a score (work evidence, invoices). */
  optional: boolean;
  /** Where the real data for this source came from, once any was added. */
  evidence?: EvidenceInfo;
}

/** The four universal ways work data gets in (plus simulated demo data). */
export type EvidenceChannel = "api" | "file" | "webhook" | "tracker" | "upload" | "simulated";

export interface EvidenceInfo {
  channel: EvidenceChannel;
  /** Account, file name or device the data came from. */
  label: string;
  events: number;
  from: ISODate | null;
  to: ISODate | null;
  updatedAt: ISODateTime;
}

/** What one unit of recorded work is. Every channel normalises to these. */
export type WorkEventKind =
  | "trip"
  | "order"
  | "shift"
  | "design_session"
  | "design_version"
  | "client_comment"
  | "commit"
  | "pr_merged"
  | "review"
  | "issue"
  | "worklog"
  | "lesson"
  | "appointment"
  | "no_show"
  | "visit"
  | "service_hair"
  | "service_nails"
  | "service_other"
  | "app_session"
  | "task";

/** The universal work event: every app, file, webhook and tracker is turned into these. */
export interface WorkEvent {
  at: ISODateTime;
  minutes: number;
  kind: WorkEventKind;
  units?: number;
  client?: string;
  amount?: number;
  km?: number;
  /** File, repository, project, app… the work belongs to. */
  item?: string;
}

/** Real work data attached to one source. Replaces that source's simulated data. */
export interface EvidenceFeed {
  sourceId: string;
  channel: EvidenceChannel;
  label: string;
  events: WorkEvent[];
  updatedAt: ISODateTime;
}

export interface ImportSummary {
  fileName: string;
  rows: number;
  imported: number;
  skipped: number;
  /** Which column was used for what, e.g. { date: "Trip date", amount: "Earnings" }. */
  columns: Record<string, string>;
  from: ISODate | null;
  to: ISODate | null;
  hours: number;
  amount: number;
  kinds: Partial<Record<WorkEventKind, number>>;
  warnings: string[];
}

export type ConsentStatus = "active" | "revoked" | "expired";

export interface Consent {
  id: string;
  kind: "source" | "lender_share";
  /** Source id for `source` consents, lender id for `lender_share`. */
  targetId: string;
  scope: string[];
  grantedAt: ISODateTime;
  expiresAt: ISODateTime;
  status: ConsentStatus;
}

export type ApplicationStatus = "new" | "in_review" | "approved" | "declined" | "active_loan";

export interface Borrower {
  id: string;
  name: string;
  phone: string;
  city: string;
  workType: WorkType;
  kycStatus: KycStatus;
  connectedSources: DataSource[];
  consents: Consent[];
  applicationStatus: ApplicationStatus;
  /** Short demo blurb, not part of the real model. */
  tagline?: string;
}

export type TransactionCategory =
  | "platform_payout"
  | "client_payment"
  | "transfer_self"
  | "transfer_p2p"
  | "rent"
  | "utilities"
  | "groceries"
  | "fuel"
  | "loan_repayment"
  | "gambling"
  | "other";

export interface Transaction {
  id: string;
  date: ISODate;
  amount: number; // always positive
  direction: "in" | "out";
  counterparty: string;
  category: TransactionCategory;
  sourceId: string;
  /** End-of-transaction account balance. */
  balanceAfter: number;
}

export interface ActivityRecord {
  weekStart: ISODate;
  sourceId: string;
  hoursOnline: number;
  tripsOrOrders: number;
  activeContracts: number;
  rating: number | null;
  distinctClients: number;
  /** Profession-specific raw signals, e.g. { versionsSaved: 14, clientComments: 3 }. */
  signals: Record<string, number>;
}

/**
 * Something the borrower chose to share inside a work tool: a Figma file, a
 * GitHub repo, a Zoom lesson series, an uploaded lesson recording…
 */
export interface WorkItem {
  id: string;
  sourceId: string;
  name: string;
  /** Share of this source's activity that comes from the item (0–1). */
  weight: number;
  shared: boolean;
  lastActivity: ISODate;
  stats: Record<string, number>;
}

export type WorkCheckStatus = "strong" | "moderate" | "weak" | "mismatch" | "not_shared" | "not_supported";

export interface WorkEvidenceLine {
  label: string;
  value: string;
  /** What good looks like, e.g. "≥ 80% of weeks". */
  target: string;
  ok: boolean;
}

/** Result of the profession-specific Work Checker. */
export interface WorkCheckResult {
  status: WorkCheckStatus;
  points: number;
  profession: string;
  /** Plain-language one-liner for the borrower. */
  summary: string;
  sourcesUsed: string[];
  evidence: WorkEvidenceLine[];
  /** Monthly income the observed work can plausibly explain. */
  explainedIncome: { low: number; high: number } | null;
  /** Verified monthly income being checked. */
  income: number;
  activeHoursPerWeek: number;
  consistency: number;
}

/** A bill or loan instalment with its due date and when it was actually paid. */
export interface ObligationPayment {
  id: string;
  sourceId: string;
  kind: "utility" | "mobile" | "loan";
  provider: string;
  amount: number;
  dueDate: ISODate;
  paidDate: ISODate | null;
}

export interface Invoice {
  id: string;
  sourceId: string;
  date: ISODate;
  client: string;
  amount: number;
}

/** Everything the engine needs. Only data from connected sources goes in. */
export interface ScoringInput {
  borrower: Pick<Borrower, "id" | "name" | "workType">;
  sources: DataSource[];
  transactions: Transaction[];
  activity: ActivityRecord[];
  obligations: ObligationPayment[];
  invoices: Invoice[];
  workItems: WorkItem[];
  asOf: ISODate;
}

export type Trend = "growing" | "flat" | "declining";

export interface Features {
  avgIncome3m: number;
  avgIncome6m: number;
  avgIncome12m: number;
  medianIncome6m: number;
  /** Coefficient of variation of monthly income (lower = more stable). */
  incomeCV: number;
  /** Relative monthly slope, e.g. 0.05 = +5% of mean per month. */
  trendSlope: number;
  trend: Trend;
  zeroIncomeMonths: number;
  incomeSourceCount: number;
  topSourceShare: number;
  seasonal: boolean;
  essentialSpend: number;
  existingDebtPayments: number;
  freeCashFlow: number;
  freeCashFlowRatio: number;
  minBalanceAvg: number;
  nearZeroBalanceCount: number;
  onTimeBillRate: number | null;
  loanRepaymentOnTime: number | null;
  gamblingShare: number;
  hasActivityData: boolean;
  activeWeeksLast52: number;
  activityConsistency: number;
  activityTrend: Trend;
  /** Change in hours: last 4 weeks vs the 4 weeks before. */
  activityChange4w: number;
  avgRating: number | null;
  tenureMonths: number;
  verifiedMonthlyIncome: number;
  /** Income before excluding self-transfers / suspected circular money. */
  grossMonthlyIncome: number;
}

export type ReasonDirection = "positive" | "negative" | "neutral";

export interface ScoreReason {
  id: string;
  /** Precise label for lenders. */
  label: string;
  /** Plain-language explanation for borrowers. */
  plain: string;
  /** Point impact on the score. */
  impact: number;
  direction: ReasonDirection;
  /** Underlying value, formatted, for transparency. */
  detail: string;
}

export type FraudFlagType =
  | "circular_money"
  | "pre_application_spike"
  | "income_activity_mismatch"
  | "unmatched_invoices"
  | "name_mismatch";

export type Severity = "low" | "medium" | "high";

export interface FraudFlag {
  type: FraudFlagType;
  severity: Severity;
  title: string;
  explanation: string;
  transactionIds: string[];
  invoiceIds?: string[];
}

export interface EarlyWarning {
  type: "activity_decline" | "low_balance" | "missed_bill";
  severity: Severity;
  message: string;
}

export type Band = "A" | "B" | "C" | "D" | "E";
export type Decision = "approve" | "review" | "decline";
export type DataSufficiency = "ok" | "limited" | "insufficient";

export interface MonthlyIncomePoint {
  month: MonthKey;
  /** Inflows counted as income per income-source label. */
  bySource: Record<string, number>;
  gross: number;
  verified: number;
  hours: number | null;
}

export interface ScoreReport {
  borrowerId: string;
  score: number;
  band: Band;
  baseScore: number;
  /** Score before any fraud cap. */
  uncappedScore: number;
  bandCapped: boolean;
  /** Score the borrower would have without sharing work evidence. */
  scoreWithoutActivity: number;
  verifiedMonthlyIncome: number;
  recommendedMaxPayment: number;
  reasons: ScoreReason[];
  fraudFlags: FraudFlag[];
  earlyWarnings: EarlyWarning[];
  /** Points from the Work Checker (can be negative). */
  workCheckPoints: number;
  workCheck: WorkCheckResult;
  decision: Decision;
  dataSufficiency: DataSufficiency;
  features: Features;
  monthlyIncome: MonthlyIncomePoint[];
  incomeSources: string[];
  improvementTips: string[];
  generatedAt: ISODateTime;
}

/* ---------- API-level shapes ---------- */

export interface Lender {
  id: string;
  name: string;
  type: "bank" | "mfi" | "leasing";
  description: string;
}

export interface Share {
  id: string;
  borrowerId: string;
  lenderId: string;
  lenderName: string;
  code: string;
  scope: string[];
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
  status: ConsentStatus;
}

export interface BorrowerProfile {
  borrower: Borrower;
  report: ScoreReport;
  activity: ActivityRecord[];
  workItems: WorkItem[];
}

export interface ApplicantSummary {
  id: string;
  name: string;
  workType: WorkType;
  city: string;
  score: number;
  band: Band;
  verifiedMonthlyIncome: number;
  recommendedMaxPayment: number;
  fraudFlagCount: number;
  highestSeverity: Severity | null;
  status: ApplicationStatus;
  decision: Decision;
  appliedAt: ISODate;
}

export interface ApplicantDetail {
  borrower: Borrower;
  report: ScoreReport;
  transactions: Transaction[];
  activity: ActivityRecord[];
  invoices: Invoice[];
  obligations: ObligationPayment[];
  workItems: WorkItem[];
}

export interface MonitoringAlert {
  id: string;
  borrowerId: string;
  borrowerName: string;
  workType: WorkType;
  severity: Severity;
  type: EarlyWarning["type"] | FraudFlagType;
  message: string;
  detectedAt: ISODate;
  /** Weekly hours for the sparkline. */
  trend: number[];
}

export interface ApplicantQuery {
  search?: string;
  bands?: Band[];
  workTypes?: WorkType[];
  sortBy?: "score" | "income" | "name" | "appliedAt";
  sortDir?: "asc" | "desc";
}

export interface PersonaSummary {
  borrower: Borrower;
  report: ScoreReport;
  story: string;
  expected: string;
}
