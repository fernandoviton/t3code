# `viton` branch

Our long-lived branch of T3 Code. It is based on the latest **stable
release** of upstream (`pingdotgg/t3code`) and carries our own features on
top. Commit straight to `viton`; no PRs.

**Current base: `v0.1.0`.**

Remotes:

- `origin`: upstream `pingdotgg/t3code`. Fetch release tags from here; never push.
- `fork`: our fork `fernandoviton/t3code`. `viton` tracks `fork/viton`, so
  push after every commit.

Never base on or merge upstream `main`: it runs ahead of releases with
unreleased work. Upstream has no release branch; stable releases are the
plain `vX.Y.Z` tags. Ignore the `-nightly.*` and `-preview.*` tags.

## Ground rules

- Keep each feature in **new files** where possible, with the smallest
  possible edits to upstream files. That keeps release syncs cheap.
- List every upstream file a feature touches in the table below, so a merge
  conflict points straight at the feature that caused it.
- Every feature ships with a unit test for its logic and passes
  `vp fmt`, `vp lint`, and `tsc-rs --noEmit` in the app it touches.

## Moving to a new release

When upstream tags a new stable release, merge that tag. Merge rather than
rebase because the branch is shared and never force-pushed:

```bash
cd ~/src/t3code
git fetch origin --tags
git tag -l 'v*' | grep -vE 'nightly|preview' | sort -V | tail -1   # newest stable
git merge vX.Y.Z               # resolve conflicts using the table below
corepack pnpm install --frozen-lockfile
(cd apps/web && corepack pnpm exec vp test run --project unit src/components/sidebar)
(cd apps/web && corepack pnpm run typecheck)
git push fork viton
```

## Trying a change

Run a dev instance against a throwaway home so the real `~/.t3` and the
running service (port 3773) are untouched:

```bash
cd ~/src/t3code
PATH="$PWD/node_modules/.bin:$PATH" node scripts/dev-runner.ts dev \
  --home-dir /tmp/t3-dev-home --no-browser
# open the pairingUrl it prints (web on :5733, server on :13773)
```

## Deploying

The `t3code` user service runs `apps/server/dist/bin.mjs` from this checkout.
To deploy the latest `viton` commit, on the VM with a clean `viton` checkout:

```bash
~/src/build-t3code.sh viton        # builds in place, stamps <base>+viton.<sha>
systemctl --user restart t3code    # run yourself: it drops sessions hosted by this server
```

The build stamps the version only for the build and restores the files after.
`~/src/build-t3code.sh <tag>` still checks out a release tag with
`git reset --hard`, so it **leaves `viton`**. Use it only to roll back to plain
upstream. Update "Current base" above after each release merge.

## Windows installer

`.github/workflows/viton-windows.yml` builds an unsigned Windows x64
installer on GitHub Actions and publishes it as a prerelease named after the
tag, at https://github.com/fernandoviton/t3code/releases. To build one:

```bash
tag=viton-build-$(date +%Y%m%d)-1   # bump the suffix for a second build that day
git tag "$tag" && git push fork "$tag"
```

- The version is `<base release>-preview.<date>.<run>`, e.g.
  `0.1.0-preview.20261016.1`. Upstream ships `-preview.` builds without an
  update feed, so the app won't auto-update back to official T3.
- It has the same app ID as official T3, so installing it replaces an
  official install and keeps the same settings and data.
- Unsigned, so Windows SmartScreen warns on first run ("More info" → "Run
  anyway").
- Built without upstream's Clerk/relay config, so T3 Connect sign-in isn't
  available. Direct connections to a server work.

## Features

Mobile features waiting for our own iOS build are listed in
[VITON_MOBILE_BACKLOG.md](VITON_MOBILE_BACKLOG.md).

| Feature                    | Status   | New files                                                                                                               | Upstream files touched                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar usage rings        | Deployed | `apps/web/src/components/sidebar/SidebarUsageItem.tsx`, `sidebarUsageRings.logic.ts`, `sidebarUsageRings.logic.test.ts` | `apps/web/src/components/sidebar/SidebarChrome.tsx` (swaps the Usage item); `packages/contracts/src/rpc.ts`, `apps/server/src/ws.ts`, `packages/client-runtime/src/state/server.ts` (`refreshUsage` flag on `server.refreshProviders`)                                                                                                                                                                                                                                       |
| One-off scheduled messages | Deployed | none                                                                                                                    | `packages/contracts/src/scheduledTask.ts` (`once` trigger), `orchestratorMcp.ts`; `apps/server/src/scheduledTasks/Schedule.ts`, `ScheduledTaskService.ts`; `apps/web/src/components/settings/ScheduledTasksSettings.tsx`, `scheduledTasksSettings.logic.ts`, `threadActionMenu.logic.ts`, `hooks/useThreadActionMenu.ts`, `Sidebar.tsx`; `apps/mobile/src/features/settings/scheduledTaskDraft.ts`, `SettingsScheduledTasksRouteScreen.tsx`; `docs/user/project-settings.md` |
| Auto-resume on by default  | Built    | none                                                                                                                    | `packages/contracts/src/settings.ts` (`autoResumeLimitedThreads` default `true`); `docs/user/thread-sidebar.md`                                                                                                                                                                                                                                                                                                                                                              |

### Sidebar usage rings

The Usage button at the bottom-left of the sidebar shows Claude's
subscription limits as two rings, like Claude Code's `/usage`:

- **Outer ring:** 5-hour session, in Claude orange.
- **Inner ring:** all-models weekly window, in blue.
- A ring turns red at 90% used or more.
- Hovering lists both percentages with their reset times. The popup is the
  whole view: clicking does nothing.
- Opening the popup forces a fresh read of each Claude instance, at most once
  per 30 seconds (tracked in memory), with a spinner in the popup while it
  runs.
- With no Claude limits reported it falls back to the plain chart icon,
  which opens the Usage page.

The data is the provider snapshot T3 already streams to the web app
(`ServerProvider.usageLimits`), pooled across environments with the same
helpers as the Usage page. On its own it goes stale: background checks only
run while a T3 window is focused, Claude's usage probe is cached for 5
minutes, and `rate_limit_event`s during turns are sparse. Hence the forced
read on hover, which sends `refreshUsage` to drop that instance's probe
cache.

Ideas for later:

- Show other providers' limits (Codex etc.) when Claude isn't configured.
- Amber warning tier before red.

### One-off scheduled messages

A **Once** trigger for scheduled tasks (`{type:"once", runAt}`), mainly to
queue a prompt for when a usage limit resets. **Schedule message…** in a
thread's menu opens the task form bound to that thread; the form's **Run in**
picker chooses a thread or a new one.

- It fires one time. A run missed while the server was off fires on boot,
  unlike fixed-time runs. Any run, including **Run now**, uses it up.
- Into an existing thread it is queued, so it waits for a running turn.
- The server rejects a run time in the past.
- Not gated by server capability: a client on an older server gets a save
  error.
