import type { ImportResult } from "../evidence/importer";
import type { AuditEntry } from "../service/store";
import type {
  ApplicantDetail,
  ApplicantQuery,
  ApplicantSummary,
  Borrower,
  BorrowerProfile,
  DataSource,
  Lender,
  MonitoringAlert,
  PersonaSummary,
  Share,
  WorkItem,
  WorkType,
} from "../types";

export type { ImportResult } from "../evidence/importer";
export type { AuditEntry } from "../service/store";

export interface ConnectCredentials {
  github?: { username: string };
  figma?: { token: string; files: string[] };
}

export interface WorkDataImport {
  name: string;
  text: string;
}

export interface IngestSetup {
  /** POST work events here (Zapier, Make, IFTTT, sensors, scripts). */
  webhookUrl: string;
  key: string;
  exampleCurl: string;
  /** Command to run the desktop tracker on the borrower's computer. */
  trackerCommand: string;
}

/** What leaves the device after a lesson recording is analysed — never the audio itself. */
export interface LessonRecordingSample {
  name: string;
  recordedMinutes: number;
  speechMinutes: number;
}

/**
 * The contract between the UI and the backend. The mock adapter implements it
 * in-browser today; the live adapter will call the REST API with the same
 * method names and types.
 */
export interface ApiClient {
  /* Borrower */
  getBorrower(borrowerId: string): Promise<Borrower>;
  startOnboarding(borrowerId: string, input: { name: string; phone: string }): Promise<Borrower>;
  submitKyc(borrowerId: string): Promise<Borrower>;
  setWorkType(borrowerId: string, workType: WorkType): Promise<Borrower>;
  listSources(borrowerId: string): Promise<DataSource[]>;
  /** Connect a source. With credentials (GitHub username, Figma token) the server pulls real data. */
  connectSource(borrowerId: string, sourceId: string, credentials?: ConnectCredentials): Promise<DataSource>;
  disconnectSource(borrowerId: string, sourceId: string): Promise<DataSource>;
  getProfile(borrowerId: string): Promise<BorrowerProfile>;

  /* Work Checker */
  /** Choose whether one file / repo / lesson series is shared with the Work Checker. */
  setWorkItemShared(borrowerId: string, itemId: string, shared: boolean): Promise<WorkItem[]>;
  /** Submit an offline lesson recording; only its length and speech share are sent. */
  uploadLessonRecording(borrowerId: string, sourceId: string, recording: LessonRecordingSample): Promise<WorkItem>;
  /** Universal: import an export file (CSV/JSON) from any work app. */
  importWorkData(borrowerId: string, sourceId: string, file: WorkDataImport): Promise<ImportResult>;
  /** Add an app that isn't in the list ("Other app"). */
  addCustomWorkApp(borrowerId: string, name: string): Promise<DataSource>;
  /** Webhook URL + key and desktop-tracker command for a source (needs the backend). */
  getIngestSetup(borrowerId: string, sourceId: string): Promise<IngestSetup>;
  /** Who did what with this borrower's data. */
  getAccessLog(borrowerId: string): Promise<AuditEntry[]>;

  /* Sharing */
  listLenders(): Promise<Lender[]>;
  shareWithLender(borrowerId: string, lenderId: string, opts: { days: number; scope: string[] }): Promise<Share>;
  listShares(borrowerId: string): Promise<Share[]>;
  revokeShare(borrowerId: string, shareId: string): Promise<Share>;

  /* Lender */
  getApplicants(query?: ApplicantQuery): Promise<ApplicantSummary[]>;
  getApplicant(borrowerId: string): Promise<ApplicantDetail>;
  getMonitoring(): Promise<MonitoringAlert[]>;

  /* Demo only */
  listPersonas(): Promise<PersonaSummary[]>;
  resetDemo(): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
