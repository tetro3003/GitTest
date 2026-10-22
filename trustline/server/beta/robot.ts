import { beta } from "./index";

/**
 * The daily robot. Started once when the server boots (instrumentation.ts).
 * Every ROBOT_CHECK_MINUTES it refreshes any connection not synced for
 * ROBOT_MAX_AGE_HOURS (default 24), so scores stay current with no clicks.
 */
const g = globalThis as unknown as { __trustlineRobot?: NodeJS.Timeout };

export function startRobot() {
  if (g.__trustlineRobot || process.env.ROBOT_DISABLED === "1") return;
  const everyMin = Number(process.env.ROBOT_CHECK_MINUTES) || 10;
  const maxAge = Number(process.env.ROBOT_MAX_AGE_HOURS) || 24;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const n = await beta().service.robotPass(maxAge);
      if (n) console.log(`[robot] refreshed ${n} connection(s)`);
    } catch (e) {
      console.error("[robot]", e);
    } finally {
      busy = false;
    }
  };
  g.__trustlineRobot = setInterval(tick, everyMin * 60_000);
  setTimeout(tick, 15_000);
  console.log(`[robot] daily robot on: checks every ${everyMin} min, refreshes data older than ${maxAge} h`);
}
