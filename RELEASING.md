# Releasing

The SDK is published to GitHub Packages at [`@orca-ae/orca-sdk`](https://github.com/orca-ae/orca-sdk-typescript/packages). Releases are driven by two workflows in `.github/workflows/`:

- **`release-rc.yml`** — release current `main` as a new release candidate.
- **`promote.yml`** — promote the latest RC to a stable release and bump `main` to the next version.

The source-of-truth version lives in the top-level `VERSION` file.

`VERSION` tracks the planned stable release. The effective package version comes from
`package.json`, which may include an RC suffix during release builds. `yarn lint`, `yarn test`,
and `yarn build` regenerate `src/version.ts` from that value so SDK exports and User-Agent headers
match the package being built. Do not edit `src/version.ts` by hand. The build also checks both
CommonJS and ESM version exports against `dist/package.json`.

## Versioning model

`VERSION` on `main` is **always stable semver** (e.g. `0.2.1`) — it represents the next planned stable release. Release candidates are derived at release time: the `release-rc` workflow appends `-rcN` (where `N` is the next available RC number for that base) and tags the resulting version as `vX.Y.Z-rcN`. When the RC is ready to ship, `promote` publishes the stable `vX.Y.Z`, deletes the `-rc*` tags for that base, and bumps `VERSION` on `main` to the next planned stable.

A git tag `v{version}` is pushed for every RC and stable release. The publish step builds from that exact tag.

## Typical flow

1. **Cut an RC.** The `release-rc` workflow fires automatically every Monday at 00:00 UTC, or you can trigger it manually. It reads `VERSION` from `main`, finds the next RC number from existing tags, and publishes `vX.Y.Z-rcN`. **`main` is not modified.**
2. **Promote when ready.** Once the RC is validated downstream, go to **Actions → Promote → Run workflow** and choose a `bump_type` (`patch` / `minor` / `major`, default `patch`). The workflow publishes the stable `vX.Y.Z`, deletes all `vX.Y.Z-rc*` tags, and pushes a single `Bump version to <next>` commit to `main`.
3. **Repeat.** The next Monday (or next manual `release-rc` dispatch) starts producing RCs against the newly bumped base.

## Release RC workflow (`release-rc.yml`)

**Triggers:**

| When | Trigger |
|------|---------|
| Mondays 00:00 UTC | `schedule` cron |
| Manual | `workflow_dispatch` (no inputs) |

**What it does:**

1. Checks out `main` with full tag history.
2. Reads `VERSION`. Refuses to run if it isn't stable semver (`X.Y.Z` with no `-rc`).
3. Scans `vX.Y.Z-rc*` tags, computes the next `-rcN`.
4. Runs `yarn install --frozen-lockfile`, `yarn lint`, `yarn test`, `yarn build`.
5. `npm version <rc-version> --no-git-tag-version --allow-same-version` — updates `package.json` in the checkout only.
6. Creates and pushes tag `v<rc-version>` at `main` HEAD.
7. Publishes `dist/` to GitHub Packages.

**`main` is never modified.** The workflow only writes a git tag.

## Promote workflow (`promote.yml`)

**Triggers:** `workflow_dispatch` only.

**Input:**

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `bump_type` | choice (`patch` / `minor` / `major`) | `patch` | How to bump `VERSION` on `main` after publishing stable |

**What it does:**

1. **prepare** — reads `VERSION`, finds the latest `vX.Y.Z-rc*` tag, and refuses to proceed unless:
   - `VERSION` is stable semver, AND
   - At least one RC tag exists for that base, AND
   - The latest RC tag points at `main` HEAD (no commits landed since the RC was cut), AND
   - The stable tag `vX.Y.Z` doesn't already exist.
2. **validate** — runs `yarn lint`, `yarn test`, `yarn build` against `main`.
3. **promote** —
   - Creates and pushes the stable tag `vX.Y.Z`.
   - Builds and publishes the stable version to GitHub Packages.
   - Deletes every `vX.Y.Z-rc*` tag (local and remote).
   - Writes the bumped `VERSION` (e.g. `0.2.1` → `0.2.2` with `patch`), syncs `package.json`, commits `Bump version to <next>`, pushes to `main`.

Publish happens **before** the bump commit. If publish fails, `main` is untouched — re-run after addressing the underlying cause.

## Re-publishing

GitHub Packages refuses to re-publish an existing version. To re-publish a botched RC, just trigger `release-rc` again — it produces the next `-rcN`. If a botched stable release needs replacement, bump on `main` and cut a new RC + promote cycle.

## Consuming the package

Consumers need a `.npmrc` that points the `@orca-ae` scope at GitHub Packages and provides a token with `read:packages`:

```ini
@orca-ae:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then:

```sh
npm install @orca-ae/orca-sdk
# or
yarn add @orca-ae/orca-sdk
```

## Required secrets / settings

Both workflows use the default `secrets.GITHUB_TOKEN`. No additional secrets are required as long as:

- The token can push tags (`release-rc`) and push to `main` (`promote`) — i.e. branch protection allows the workflow to push, or `main` is excluded from required-PR rules for these workflows.
- The token has `packages: write` for the repo's GitHub Packages namespace.

If `main` is fully protected, swap `secrets.GITHUB_TOKEN` in `promote.yml`'s checkout step for a PAT (or GitHub App token) with bypass rights and store it as `secrets.RELEASE_BOT_TOKEN`.

## Operational guidance

- **Don't trigger `release-rc` and `promote` simultaneously.** Each has its own concurrency group, but they touch overlapping state (the same set of RC tags). Wait for one to finish before starting the other.
- **Hotfix on top of an RC?** Land the fix on `main`, then run `release-rc` to cut a new `-rcN`. Don't promote until the latest RC tag points at the commit you actually want to ship.
- **Manual local publish.** The `prepublishOnly` script in `package.json` blocks `npm publish` from the repo root. To publish by hand:

  ```sh
  yarn install --frozen-lockfile
  yarn build
  cd dist
  npm publish
  ```

  You'll need a token in your `.npmrc` with `write:packages` for `@orca-ae`.
