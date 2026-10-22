/** Shared types for the designer beta (server + browser). */

export type ProviderId = "figma" | "wallet" | "gmail" | "wise" | "bank" | "bank_id" | "canva" | "webflow" | "miro" | "dribbble";
export type OAuthProvider = "google" | "canva" | "webflow" | "miro" | "dribbble";
export type WorkSource = "figma" | "canva" | "webflow" | "miro" | "dribbble";
export type PaymentSource = "wallet" | "email" | "wise" | "bank";
/** Georgian banks that can confirm a person's identity through open banking. */
export type BankId = "tbc" | "bog";
export const BANK_NAMES: Record<BankId, string> = { tbc: "TBC Bank", bog: "Bank of Georgia" };

/** What a bank confirmed about its customer: the name it verified when the account was opened. */
export interface BankIdentity {
  bank: BankId;
  holderName: string;
  /** Last 4 characters of each account's IBAN, so the person can recognise them. */
  accounts: string[];
  matchesAccount: boolean;
  confirmedAt: string;
}
export type ConnectionStatus = "needs_setup" | "syncing" | "ok" | "error";

export type ChainFamily = "evm" | "solana" | "tron";

export interface BetaUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface BetaConnection {
  id: string;
  provider: ProviderId;
  /** e.g. "Figma · nino.design" or "MetaMask · 0x12…9fA". */
  label: string;
  status: ConnectionStatus;
  createdAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Provider-specific, non-secret settings (file links, wallet address…). */
  settings: Record<string, unknown>;
  stats: { workItems: number; payments: number };
}

/** Who performed a step, shown as a coloured chip in the timeline. */
export type TimelineActor = "you" | "trustline" | "figma" | "blockchain" | "robot" | "google" | "ai" | "wise" | "bank" | "canva" | "webflow" | "miro" | "dribbble";
export type TimelineLevel = "step" | "ok" | "warn" | "error";

export interface TimelineEntry {
  id: number;
  at: string;
  runId: string;
  connectionId: string | null;
  actor: TimelineActor;
  level: TimelineLevel;
  text: string;
  /** Technical detail: the exact request or rule used. */
  tech: string | null;
}

/** A single piece of design work, read from the work tool's server. */
export interface WorkFact {
  at: string;
  source: WorkSource;
  /** version/edit = hands-on design work; comment = someone else reviewing; publish/shot = finished work shown. */
  kind: "version" | "edit" | "comment" | "publish" | "shot";
  item: string;
  /** For comments: the person who wrote it (a likely client). */
  person: string | null;
}

export type PaymentStatus = "income" | "own_transfer" | "unclear" | "ignored" | "duplicate" | "not_income";

export interface PaymentFact {
  at: string;
  source: PaymentSource;
  amountUsd: number;
  /** Original currency or coin (USDC, EUR, GEL…). */
  asset: string;
  /** Where it was seen: a blockchain, "Upwork", "PayPal", "Wise", "TBC Bank"… */
  chain: string;
  payer: string;
  payerLabel: string | null;
  status: PaymentStatus;
  note: string | null;
  /** Link or reference that proves it (explorer link, email signature result, bank transaction id). */
  proof: string;
}

export interface IdentityCheck {
  status: "verified" | "failed";
  name: string;
  documentNumberLast4: string;
  expiry: string;
  checks: { id: string; label: string; ok: boolean; detail: string }[];
  verifiedAt: string;
}

export interface BetaReason {
  id: string;
  label: string;
  impact: number;
  plain: string;
}

export interface BetaFlag {
  id: string;
  severity: "high" | "medium";
  title: string;
  detail: string;
}

export interface BetaMonth {
  month: string;
  income: number;
  workHours: number;
}

export interface BetaScore {
  ready: boolean;
  /** Why the score is not ready yet. */
  missing: string[];
  score: number | null;
  band: "A" | "B" | "C" | "D" | "E" | null;
  verifiedMonthlyIncome: number;
  maxMonthlyPayment: number;
  reasons: BetaReason[];
  flags: BetaFlag[];
  months: BetaMonth[];
  features: Record<string, number>;
  generatedAt: string;
}

export interface WalletChallenge {
  challengeId: string;
  message: string;
  expiresAt: string;
}
