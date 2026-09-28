# Contributing to the Orca TypeScript SDK

Thanks for your interest in the Orca TypeScript SDK, the TypeScript client for
[Orca Agent Engine](https://github.com/orca-ae/orca-agent-engine). Bug reports, fixes,
documentation, tests and feedback on the API are all welcome.

> **Using an AI assistant?** Read the [AI policy](AI_POLICY.md) first.
> **Are you a coding agent?** Start with [AGENTS.md](AGENTS.md).

## Ways to contribute

- **Report a bug or request a feature.** Open an
  [issue](https://github.com/orca-ae/orca-sdk-typescript/issues/new/choose).
- **Ask a question or share an idea.** Start a
  [discussion](https://github.com/orca-ae/orca-sdk-typescript/discussions).
- **Fix something.** Issues labeled
  [`good first issue`](https://github.com/orca-ae/orca-sdk-typescript/labels/good%20first%20issue)
  and [`help wanted`](https://github.com/orca-ae/orca-sdk-typescript/labels/help%20wanted) are good
  places to start. Comment on the issue to say you're working on it, so nobody duplicates your work.
- **Improve the docs.** If something confused you, it will confuse the next person too.

## Where to talk

| For | Use |
|---|---|
| Bugs and concrete feature requests | [Issues](https://github.com/orca-ae/orca-sdk-typescript/issues) |
| Questions | [Discussions: Q&A](https://github.com/orca-ae/orca-sdk-typescript/discussions/categories/q-a) |
| Design ideas, and proposals before they become an OIP | [Discussions: Ideas](https://github.com/orca-ae/orca-sdk-typescript/discussions/categories/ideas) |
| Wrong responses or behavior from the engine itself | [Orca Agent Engine issues](https://github.com/orca-ae/orca-agent-engine/issues) |
| Security vulnerabilities | Report privately, as described in [SECURITY.md](SECURITY.md) |
| Conduct concerns | See the [code of conduct](https://github.com/orca-ae/.github/blob/main/CODE_OF_CONDUCT.md) |

## Before you write code

- **Small changes**, such as bug fixes, docs and tests, can go straight to a pull request.
- **Larger changes** should start with an issue or a discussion, so we can agree on the approach
  before you spend time on it.
- **The SDK follows the engine's API contracts.** Every public method maps to an operation in one of
  the vendored OpenAPI specs under `openapi/` (see [AGENTS.md](AGENTS.md)). New operations and fields
  start in Orca Agent Engine; the SDK picks them up when the specs are refreshed.
- **Some changes need an Orca Improvement Proposal (OIP):** breaking changes to the public TypeScript
  API, client-side behavior the contracts don't define, supported runtimes, and new runtime
  dependencies. See [proposals/](proposals/README.md).

## Build and test

You need Node.js 20 or later and Yarn 1.x.

```bash
git clone https://github.com/orca-ae/orca-sdk-typescript.git
cd orca-sdk-typescript
yarn install --frozen-lockfile
```

Run the same checks as CI before you open a pull request:

```bash
yarn lint    # type-check, ESLint and the license-header check
yarn test    # unit tests
yarn build   # builds dist/
```

If the header check fails, `node scripts/utils/license-headers.cjs --fix` adds the missing headers.

Integration tests exercise the SDK against a live deployment of the engine. Set both
`ORCA_TEST_BASE_URL` and `ORCA_TEST_API_KEY` to run them, or neither to skip them; one without the
other fails. See [tests/integration/README.md](tests/integration/README.md).

End-to-end tests stand up the engine in a kind cluster with Helm and run the built SDK directly
against it. They need `yarn build` first and access to the engine's source revision for its Helm
chart; see [tests/e2e/README.md](tests/e2e/README.md). CI runs them nightly and on same-repository
pull requests.

## CI configuration

Workflows that talk to something outside this repository read what they need from secrets, which
GitHub masks in the public run logs. That covers endpoints and audiences as well as credentials.
Uploaded artifacts are not masked, so these workflows upload none.

The test workflows gate on those secrets: absent secrets skip the job rather than fail it, so a
fork or a fresh clone stays green without pretending to have run anything. A skipped job finishes
in seconds, which is the tell.

| Workflow | Needs | Absent |
| --- | --- | --- |
| `ci.yml` | nothing | — |
| `claude.yml`, `claude-code-review.yml` | `CLAUDE_CODE_OAUTH_TOKEN` | job fails — no gate |
| `e2e-managed-agents.yml` | an organization token that can read the engine source | job skips |
| `integration.yml` | `ORCA_TEST_API_KEY` and `ORCA_TEST_BASE_URL` | job skips; only one fails |

Maintainers set repository secrets under **Settings → Secrets and variables → Actions**. The
end-to-end and integration jobs never run on pull requests from forks, which get no secrets.

## Code style

- Follow the conventions in [AGENTS.md](AGENTS.md): the resource class pattern, the `path` tagged
  template for URLs, snake_case wire fields, and a unit test for every public method.
- Formatting is Prettier's (`yarn format`), and ESLint runs as part of `yarn lint`.
- Every source file starts with the license header, in the file's own comment syntax:

  ```ts
  // Copyright The Orca Authors
  // SPDX-License-Identifier: Apache-2.0
  ```

## Commits

### Sign your commits (DCO)

Every commit needs a Developer Certificate of Origin sign-off:

```bash
git commit -s -m "fix: retry streaming requests after a dropped connection"
```

The `-s` flag adds a line such as `Signed-off-by: Your Name <you@example.com>`. The line certifies
that you wrote the change, or otherwise have the right to submit it under the project's license. The
full text is at [developercertificate.org](https://developercertificate.org/).

A DCO check runs on every pull request. If you forgot to sign off, fix the last commit with
`git commit --amend -s --no-edit`, or a series with `git rebase --signoff origin/main`, and then
force-push your branch.

We don't use a CLA. The DCO sign-off is all we ask.

### Write useful messages

Start the subject with a [Conventional Commits](https://www.conventionalcommits.org/) type, such as
`feat:`, `fix:`, `docs:`, `test:`, `ci:` or `chore:`, followed by a short summary in the imperative
mood. Then explain why the change is needed, if that isn't obvious. Pull requests are squash-merged,
so the pull request title becomes the commit subject on `main`: give it the same form.

### Say when AI helped

If an AI tool helped meaningfully, add an `Assisted-by:` trailer. `Co-authored-by:` is also
accepted. The [AI policy](AI_POLICY.md) explains what counts.

## Pull requests

1. Fork the repository on GitHub, and add your fork as a remote:
   `git remote add fork https://github.com/<your-username>/orca-sdk-typescript.git`. Create a branch
   for your change, and push it to `fork`.
2. Keep each pull request to one logical change. Smaller pull requests get reviewed sooner.
3. Fill in the pull request template: what changed and why, compatibility, how you tested it, and AI
   assistance.
4. Update the documentation, and `CHANGELOG.md` under *Unreleased*, in the same pull request when you
   change behavior or the public API.
5. Make sure CI passes.
6. A code owner reviews and approves the change. Code owners are listed in
   [CODEOWNERS](.github/CODEOWNERS). These docs call them maintainers.

We aim to respond promptly. If your pull request has been quiet for a while, @-mention one of the
code owners.

## License

The SDK is licensed under the [Apache License 2.0](LICENSE); see also [NOTICE](NOTICE). By
contributing, you agree that your contributions are licensed under the same terms, as certified by
your DCO sign-off.
