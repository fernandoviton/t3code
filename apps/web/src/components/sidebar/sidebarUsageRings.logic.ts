import {
  collectLimitAccounts,
  collectLimitPools,
  type LimitPoolWindow,
  type LimitPresentations,
} from "@t3tools/shared/usageLimits";

export interface SidebarUsageRings {
  readonly session: LimitPoolWindow | null;
  readonly weekly: LimitPoolWindow | null;
}

/** At or above this share used, a ring switches to the warning colour. */
export const USAGE_RING_WARN_PERCENT = 90;

/**
 * Claude's session and all-models weekly windows, pooled across every
 * connected environment the same way the Usage page pools them. Null when no
 * environment reports Claude limits, so the footer falls back to its plain icon.
 */
export function selectClaudeUsageRings(
  presentations: LimitPresentations,
  now: number,
): SidebarUsageRings | null {
  const pool = collectLimitPools(collectLimitAccounts(presentations), now).find(
    (candidate) => candidate.driver === "claudeAgent",
  );
  if (!pool) return null;
  const session = pool.windows.find((window) => window.kind === "session") ?? null;
  // Claude may also report per-model weekly windows; the plain one covers all models.
  const weekly =
    pool.windows.find((window) => window.kind === "weekly" && window.id === "seven_day") ??
    pool.windows.find((window) => window.kind === "weekly") ??
    null;
  return session || weekly ? { session, weekly } : null;
}
