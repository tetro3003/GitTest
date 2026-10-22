/** Shared types for the designer beta (server + browser). */

export type ProviderId = "figma" | "wallet";
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
export type TimelineActor = "you" | "trustline" | "figma" | "blockchain" | "robot";
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
  kind: "version" | "comment";
  item: string;
  /** For comments: the person who wrote it (a likely client). */
  person: string | null;
}

export type PaymentStatus = "income" | "own_transfer" | "unclear" | "ignored";

export interface PaymentFact {
  at: string;
  amountUsd: number;
  asset: string;
  chain: string;
  payer: string;
  payerLabel: string | null;
  status: PaymentStatus;
  note: string | null;
  proof: string;
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
