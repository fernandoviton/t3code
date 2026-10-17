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
`~/src/build-t3code.sh <tag>` still checks out a release tag with
`git reset --hard`, so it would **leave `viton`** and build plain upstream.
To deploy this branch, the script needs a variant that builds the current
branch instead (TODO). Update "Current base" above after each release merge.

## Windows installer

`.github/workflows/viton-windows.yml` builds an unsigned Windows x64
installer on GitHub Actions. To build one:

```bash
tag=viton-build-$(date +%Y%m%d)-1   # bump the suffix for a second build that day
git tag "$tag" && git push fork "$tag"
gh run download -R fernandoviton/t3code --dir ~/outbox/   # once the run finishes
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
