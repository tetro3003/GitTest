import type { ApplicationStatus, EvidenceFeed, KycStatus, Share, SourceStatus, WorkItem, WorkType } from "../types";

/**
 * Storage contract for the Trustline service. Two implementations:
 *  - lib/mock/db.ts       — browser localStorage (demo / mock mode)
 *  - server/sqlite-store.ts — SQLite database (real backend)
 */
export interface BorrowerState {
  name: string;
  phone: string;
  workType: WorkType;
  kycStatus: KycStatus;
  applicationStatus: ApplicationStatus;
  sources: Record<string, { status: SourceStatus; connectedAt: string | null }>;
  /** Per work item: shared with the Work Checker or not (overrides the default). */
  items: Record<string, boolean>;
  /** Lesson recordings the borrower uploaded and we measured. */
  uploads: WorkItem[];
  /** "Other app" sources the borrower added themselves. */
  customSources: { id: string; name: string; createdAt: string }[];
}

export interface AuditEntry {
  at: string;
  /** "borrower:giorgi", "lender:city-bank", "system". */
  actor: string;
  action: string;
  borrowerId?: string;
  detail?: string;
}

export interface Store {
  getBorrower(id: string): BorrowerState | undefined;
  saveBorrower(id: string, state: BorrowerState): void;
  listShares(filter?: { borrowerId?: string; lenderId?: string }): Share[];
  /** Insert or update by id. */
  saveShare(share: Share): void;
  getFeeds(borrowerId: string): EvidenceFeed[];
  /** Insert or replace the feed for (borrowerId, feed.sourceId). */
  saveFeed(borrowerId: string, feed: EvidenceFeed): void;
  deleteFeed(borrowerId: string, sourceId: string): void;
  audit(entry: AuditEntry): void;
  listAudit(filter?: { borrowerId?: string; actor?: string; limit?: number }): AuditEntry[];
  /** Wipe everything and load the demo seed again. */
  reset(): void;
}
