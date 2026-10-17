import type { EnvironmentId, ProviderInstanceId, ServerProvider } from "@t3tools/contracts";
import {
  collectLimitAccounts,
  collectLimitPools,
  providersWithLimits,
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

/** Opening the popup re-reads usage at most this often per Claude instance. */
export const USAGE_HOVER_REFRESH_MS = 30_000;

export interface ClaudeUsageRefreshTarget {
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
}

/**
 * Claude instances on connected environments that report usage and were not
 * re-read in the last {@link USAGE_HOVER_REFRESH_MS}. `lastRefreshAt` holds
 * when each key was last asked to refresh.
 */
export function claudeUsageRefreshTargets(
  presentations: UsageRefreshPresentations,
  lastRefreshAt: ReadonlyMap<string, number>,
  now: number,
): readonly ClaudeUsageRefreshTarget[] {
  const targets: ClaudeUsageRefreshTarget[] = [];
  for (const [environmentId, presentation] of presentations) {
    if (presentation.connection.phase !== "connected") continue;
    for (const provider of providersWithLimits(presentation.serverConfig?.providers ?? [])) {
      if (provider.driver !== "claudeAgent") continue;
      const key = `${environmentId}:${provider.instanceId}`;
      if (now - (lastRefreshAt.get(key) ?? -Infinity) < USAGE_HOVER_REFRESH_MS) continue;
      targets.push({ key, environmentId, instanceId: provider.instanceId });
    }
  }
  return targets;
}

type UsageRefreshPresentations = ReadonlyMap<
  EnvironmentId,
  {
    readonly connection: { readonly phase: string };
    readonly serverConfig: { readonly providers?: readonly ServerProvider[] | undefined } | null;
  }
>;
