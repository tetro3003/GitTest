import { API_MODE } from "../config";
import type { ApiClient } from "./client";
import { createLiveAdapter } from "./live-adapter";
import { createMockAdapter } from "./mock-adapter";

export type { ApiClient } from "./client";
export { ApiError } from "./client";

/** Selected by NEXT_PUBLIC_API_MODE=mock|live. */
export const api: ApiClient = API_MODE === "live" ? createLiveAdapter() : createMockAdapter();
