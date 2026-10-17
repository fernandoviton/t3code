# `custom` branch

Our long-lived branch of T3 Code. It tracks upstream `main`
(`pingdotgg/t3code`) and carries our own features on top. Commit straight to
`custom`; no PRs.

## Ground rules

- Keep each feature in **new files** where possible, with the smallest
  possible edits to upstream files. That keeps syncs with `main` cheap.
- List every upstream file a feature touches in the table below, so a merge
  conflict points straight at the feature that caused it.
- Every feature ships with a unit test for its logic and passes
  `vp fmt`, `vp lint`, and `tsc-rs --noEmit` in the app it touches.

## Syncing with upstream

Pick one approach and stick to it. Merging is the default because the branch
is shared and never force-pushed:

```bash
cd ~/src/t3code
git fetch origin
git merge origin/main          # resolve conflicts using the table below
corepack pnpm install --frozen-lockfile
(cd apps/web && corepack pnpm exec vp test run --project unit src/components/sidebar)
(cd apps/web && corepack pnpm run typecheck)
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
`~/src/build-t3code.sh <tag>` still checks out a release tag with
`git reset --hard`, so it would **leave `custom`**. To deploy this branch,
the script needs a variant that builds the current branch instead (TODO).

## Features

| Feature             | Status             | New files                                                                                                               | Upstream files touched                                                     |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Sidebar usage rings | Done, not deployed | `apps/web/src/components/sidebar/SidebarUsageItem.tsx`, `sidebarUsageRings.logic.ts`, `sidebarUsageRings.logic.test.ts` | `apps/web/src/components/sidebar/SidebarChrome.tsx` (swaps the Usage item) |

### Sidebar usage rings

The Usage button at the bottom-left of the sidebar shows Claude's
subscription limits as two rings, like Claude Code's `/usage`:

- **Outer ring:** 5-hour session, in Claude orange.
- **Inner ring:** all-models weekly window, in blue.
- A ring turns red at 90% used or more.
- Hovering lists both percentages with their reset times; clicking still
  opens the Usage page.
- With no Claude limits reported it falls back to the plain chart icon.

The data is the provider snapshot T3 already streams to the web app
(`ServerProvider.usageLimits`), pooled across environments with the same
helpers as the Usage page. Claude's `rate_limit_event`s update it during
turns, and a once-a-minute clock keeps reset times current between updates.

Ideas for later:

- Show other providers' limits (Codex etc.) when Claude isn't configured.
- Amber warning tier before red.
