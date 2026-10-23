import { backend } from "@/server/app";
import { DEMO, demoFetch, demoResolver, enableDemoSettings } from "./demo";
import { createBetaHttp } from "./http";
import { createBetaService } from "./service";
import { createBetaStore } from "./store";
import { createVault } from "./vault";

/** One beta service per server process, sharing the SQLite file with the demo. */
function build() {
  const store = createBetaStore(backend().db);
  if (DEMO()) {
    enableDemoSettings();
    console.log("[beta] DEMO MODE: outside services replaced by synthetic stand-ins (server/beta/demo.ts)");
  }
  const service = createBetaService({ store, vault: createVault(), ...(DEMO() ? { fetch: demoFetch, dnsResolver: demoResolver } : {}) });
  return { service, handle: createBetaHttp(service) };
}

const g = globalThis as unknown as { __trustlineBeta?: ReturnType<typeof build> };
export const beta = () => (g.__trustlineBeta ??= build());
