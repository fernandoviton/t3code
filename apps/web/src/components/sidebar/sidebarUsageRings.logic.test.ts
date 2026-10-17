import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import type { LimitPresentations } from "@t3tools/shared/usageLimits";
import { describe, expect, it } from "vite-plus/test";

import {
  claudeUsageRefreshTargets,
  selectClaudeUsageRings,
  USAGE_HOVER_REFRESH_MS,
} from "./sidebarUsageRings.logic";

const now = Date.parse("2026-10-16T12:00:00.000Z");

const session: ServerProviderUsageWindow = {
  id: "five_hour",
  kind: "session",
  label: "Session",
  usedPercent: 19,
  windowDurationMins: 300,
  resetsAt: "2026-10-16T15:00:00.000Z",
};
const weekly: ServerProviderUsageWindow = {
  id: "seven_day",
  kind: "weekly",
  label: "Weekly",
  usedPercent: 8,
  windowDurationMins: 10080,
  resetsAt: "2026-10-22T10:00:00.000Z",
};
const weeklyOpus: ServerProviderUsageWindow = {
  ...weekly,
  id: "seven_day_opus",
  label: "Weekly (Opus)",
  usedPercent: 50,
};

function provider(
  driver: string,
  windows: readonly ServerProviderUsageWindow[] | null,
  { checkedAt = "2026-10-16T11:00:00.000Z", email }: { checkedAt?: string; email?: string } = {},
): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated", ...(email ? { email } : {}) },
    checkedAt: "2026-10-16T11:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...(windows ? { usageLimits: { checkedAt, windows } } : {}),
  };
}

function presentations(...environments: (readonly ServerProvider[])[]): LimitPresentations {
  return new Map(
    environments.map((providers, index) => [
      EnvironmentId.make(`env-${index}`),
      { entry: { target: { label: `Env ${index}` } }, serverConfig: { providers } },
    ]),
  );
}

describe("selectClaudeUsageRings", () => {
  it("reads Claude's session and all-models weekly windows", () => {
    const rings = selectClaudeUsageRings(
      presentations([provider("claudeAgent", [session, weeklyOpus, weekly])]),
      now,
    );
    expect(rings?.session?.usedPercent).toBe(19);
    expect(rings?.weekly?.id).toBe("seven_day");
    expect(rings?.weekly?.usedPercent).toBe(8);
  });

  it("ignores other providers' limits", () => {
    expect(selectClaudeUsageRings(presentations([provider("codex", [session])]), now)).toBeNull();
  });

  it("is null when Claude reports no limits", () => {
    expect(selectClaudeUsageRings(presentations([provider("claudeAgent", null)]), now)).toBeNull();
    expect(selectClaudeUsageRings(presentations([provider("claudeAgent", [])]), now)).toBeNull();
  });

  it("keeps whichever window is present", () => {
    const rings = selectClaudeUsageRings(presentations([provider("claudeAgent", [weekly])]), now);
    expect(rings?.session).toBeNull();
    expect(rings?.weekly?.usedPercent).toBe(8);
  });
});

describe("claudeUsageRefreshTargets", () => {
  const environment = (phase: string, providers: readonly ServerProvider[]) => ({
    connection: { phase },
    serverConfig: { providers },
  });
  const connected = new Map([
    [
      EnvironmentId.make("local"),
      environment("connected", [
        provider("claudeAgent", [session]),
        provider("codex", [session]),
        provider("cursor", null),
      ]),
    ],
    [
      EnvironmentId.make("remote"),
      environment("disconnected", [provider("claudeAgent", [session])]),
    ],
  ]);

  it("targets Claude instances that report usage on connected environments", () => {
    expect(claudeUsageRefreshTargets(connected, new Map(), now)).toEqual([
      {
        key: "local:claudeAgent",
        environmentId: EnvironmentId.make("local"),
        instanceId: ProviderInstanceId.make("claudeAgent"),
      },
    ]);
  });

  it("skips an instance refreshed within the window", () => {
    const recent = new Map([["local:claudeAgent", now - USAGE_HOVER_REFRESH_MS + 1]]);
    expect(claudeUsageRefreshTargets(connected, recent, now)).toEqual([]);
    const stale = new Map([["local:claudeAgent", now - USAGE_HOVER_REFRESH_MS]]);
    expect(claudeUsageRefreshTargets(connected, stale, now)).toHaveLength(1);
  });
});
