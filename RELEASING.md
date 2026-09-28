# Releasing

Releases use [Release Please](https://github.com/googleapis/release-please) in
`.github/workflows/release.yml`. The public package is `@orca-ae/orca-sdk` on
[npmjs.org](https://www.npmjs.com/package/@orca-ae/orca-sdk). A human merges the release PR;
GitHub Actions then builds and publishes the exact release tag.

## Release loop

1. Squash-merge work into `main` using Conventional Commit PR titles. `fix:` bumps patch, `feat:`
   bumps minor, and breaking changes bump minor while the SDK is pre-1.0. Commits containing only
   documentation, tests or chores do not normally create a release.
2. The push to `main` runs Release Please, which creates or updates `release: <version>`. It updates
   `package.json`, `CHANGELOG.md`, `.release-please-manifest.json`, and `src/version.ts`.
3. Review the release PR, validate its exact commit, and merge it. The next run creates `vX.Y.Z`
   and the GitHub Release.
4. In the same workflow, the publish job checks out that tag, verifies it belongs to `main`, runs
   `yarn lint`, `yarn test`, and `yarn build`, and checks that generated version files are unchanged.
   It packs `dist/` and publishes the checked tarball publicly to npmjs.org with provenance and the
   `latest` dist-tag, using npm Trusted Publishing (OIDC).

This is not a release on every feature merge. Merging the release PR is the approval to release.
The former scheduled RC and manual promotion workflows are removed; there is no automatic RC
cycle, tag deletion, or post-publication version-bump commit.

## Version source of truth

`package.json` owns the package version; the old, redundant `VERSION` file is removed.
`src/version.ts` is generated from it by `scripts/utils/sync-version.cjs`, and carries a
`x-release-please-version` annotation so the release PR commits the matching SDK version too.
Do not hand-edit either version. Both CommonJS and ESM exports and request headers must agree with
`dist/package.json`. The publish script additionally checks the release tag and manifest.

The manifest starts at `0.0.0`, Release Please's sentinel for no previous release.
`initial-version: 0.2.2` selects the first release without pretending an earlier tag exists.
After that, Release Please updates the manifest and computes versions from new commits;
`initial-version` does not pin subsequent releases. Confirm `0.2.2` is unused on npmjs.org before
merging the first release PR. Existing GitHub Packages versions do not reserve npmjs.org versions.

## One-time maintainer setup

### GitHub

- Allow GitHub Actions to create pull requests in repository settings and organization policy.
  Release Please uses `GITHUB_TOKEN` with `contents: write` and `pull-requests: write`; no direct
  writes to `main` or branch-protection bypass are needed. Tag rules must allow creation of release
  tags by the workflow. Protect existing release tags from modification or deletion.
- Create the GitHub Environment **`npm`**, preferably with required reviewers. Restrict deployment
  branches to `main`: workflow runs originate on `main`, even though checkout builds a release tag.
- Keep the repository public for npm provenance. The publish job uses GitHub-hosted Ubuntu runners,
  Node.js 24 (with an npm CLI supporting Trusted Publishing, npm >=11.5.1), and `id-token: write`.
  Neither `NPM_TOKEN` nor `packages: write` is used.

**Bot PR CI:** PRs opened or updated with `GITHUB_TOKEN` do not automatically trigger PR workflows.
Before merging, check out the exact release PR head and run `yarn install --frozen-lockfile`,
`yarn lint`, `yarn test`, and `yarn build`. If branch protection requires automated PR checks,
configure Release Please to use a least-privilege GitHub App token so those checks run; do not
remove required checks to work around the bot-token limitation. This workflow does not provision
that App. Publishing still repeats validation independently.

### npmjs.org

1. Ensure your npm account owns or has publishing access to the **`@orca-ae`** scope and
   **`@orca-ae/orca-sdk`** package. GitHub organization membership does not grant npm scope rights.
2. In the package's npm settings, add a GitHub Actions Trusted Publisher:

   | Field | Value |
   | --- | --- |
   | Organization or user | `orca-ae` |
   | Repository | `orca-sdk-typescript` |
   | Workflow filename | `release.yml` (not a path) |
   | Environment name | `npm` |
   | Allowed actions | Enable direct `npm publish`, not only staged publishing |

3. After a successful OIDC publication, restrict traditional publishing tokens in the npm package
   settings. Do not store a long-lived npm token in GitHub Actions.

If npm requires the package to exist before Trusted Publisher settings are available, a maintainer
performs the first publication from the reviewed release tag using interactive npm authentication.
Do not publish a placeholder or unrelated package just to reserve the name:

```sh
git fetch origin --tags
git checkout --detach v0.2.2
corepack enable
yarn install --frozen-lockfile
yarn lint && yarn test && yarn build
npm login --registry=https://registry.npmjs.org/
(cd dist && npm publish --access public --registry=https://registry.npmjs.org/)
```

This local bootstrap does not have GitHub Actions provenance. Configure the trusted publisher
then retry the workflow for this tag; an identical already-published artifact is safely skipped.
Subsequent releases use OIDC and provenance. Do not assume these account settings have been
configured merely because the workflow files exist. See [npm's Trusted Publishing guide](https://docs.npmjs.com/trusted-publishers/).

## Retrying a failed publication

GitHub Release creation and npm publication are separate operations. A GitHub Release can exist
while npm publication is still awaiting approval or has failed. Fix permissions, configuration or
registry availability, then select **Actions → Release → Run workflow**, use branch **main**, and
set `release_tag` to the existing stable tag, for example `v0.2.2`. Or:

```sh
gh workflow run release.yml --ref main -f release_tag=v0.2.2
```

A nonempty `release_tag` bypasses Release Please, not the publishing checks. Recovery requires an
existing, non-draft, non-prerelease GitHub Release, a tag reachable from `main`, matching versions,
and passing validation. It builds the tag, never the current `main` contents. Leaving the input
empty runs Release Please normally. Both paths use the same concurrency group.

- Already published with identical tarball integrity: skip without changing any dist-tags.
- Existing version with different integrity: stop; publish a corrected **new version**, not an overwrite.
- Registry 401/403/429/5xx or network errors: fail closed, not treated as a missing version.
- Retrying an older missing version when `latest` is newer: refuse to move `latest` backwards.

Do not delete or move a published tag. If source or build changes are needed, merge a fix and
release a new version instead of modifying the existing release. Tags created with `GITHUB_TOKEN`
do not trigger another workflow, which is why publishing is part of this workflow rather than a
separate tag-triggered job.

## Installing the package

```sh
npm install @orca-ae/orca-sdk
# or
yarn add @orca-ae/orca-sdk
```

No token or special registry configuration is needed. Remove any old project/user `.npmrc`
`@orca-ae:registry=https://npm.pkg.github.com/` override (or change it to
`https://registry.npmjs.org/`), and refresh affected lockfile resolutions.
