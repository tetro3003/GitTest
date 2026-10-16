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
  WorkType,
} from "../types";

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
  connectSource(borrowerId: string, sourceId: string): Promise<DataSource>;
  disconnectSource(borrowerId: string, sourceId: string): Promise<DataSource>;
  getProfile(borrowerId: string): Promise<BorrowerProfile>;

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
