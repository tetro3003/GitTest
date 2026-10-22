import { backend } from "@/server/app";
import { createBetaHttp } from "./http";
import { createBetaService } from "./service";
import { createBetaStore } from "./store";
import { createVault } from "./vault";

/** One beta service per server process, sharing the SQLite file with the demo. */
function build() {
  const store = createBetaStore(backend().db);
  const service = createBetaService({ store, vault: createVault() });
  return { service, handle: createBetaHttp(service) };
}

const g = globalThis as unknown as { __trustlineBeta?: ReturnType<typeof build> };
export const beta = () => (g.__trustlineBeta ??= build());
