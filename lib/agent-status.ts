/**
 * Global on/off switch for the news agent (ingest + scheduled publish).
 *
 * Flip AGENT_PAUSED=true in the environment to stop both cron jobs from
 * doing anything, without touching the cron schedule itself. Used to halt
 * posting for clients who have fallen behind on payment.
 */
export function isAgentPaused(): boolean {
  return process.env.AGENT_PAUSED === "true";
}
