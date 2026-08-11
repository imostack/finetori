/**
 * Auth constants with no server-only or database imports, so `proxy.ts` can
 * use them without pulling in the Postgres driver on every matched request.
 */
export const SESSION_COOKIE = "finetori_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
