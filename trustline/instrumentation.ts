/** Runs once when the Next.js server starts: switches on the daily robot. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRobot } = await import("./server/beta/robot");
    startRobot();
  }
}
