# Orca Improvement Proposals (OIPs)

An OIP describes a significant change before it's built, so the design is discussed where everyone
can read it. OIPs for this repository live in this directory and are numbered per repository.

## When you need one

- A breaking change to the public TypeScript API, such as a rename, a removal, or a type change that
  isn't purely additive.
- Client-side behavior the OpenAPI contracts don't define, such as new helpers, retry or timeout
  defaults, or caching.
- Changing the supported JavaScript runtimes, or adding a runtime dependency.

Changes to the API itself, such as new operations, fields or extension groups, are proposed in
[Orca Agent Engine](https://github.com/orca-ae/orca-agent-engine). The SDK follows the published
contract.

Bug fixes, documentation, tests and additive changes that mirror the contract don't need an OIP.

## How to propose one

1. Raise the idea in
   [Discussions: Ideas](https://github.com/orca-ae/orca-sdk-typescript/discussions/categories/ideas)
   or in an issue first, so you learn early whether it fits.
2. Open a pull request that adds `proposals/NNNN-short-title.md`, where `NNNN` is the next free
   number, starting at `0001`. Use the sections below.
3. The OIP is accepted when its pull request merges with a maintainer's approval. Implementation pull
   requests link to it.

## Sections

```markdown
# NNNN: Title

- *Status*: Draft | Accepted | Rejected | Superseded by NNNN
- *Author*: name (@handle)

## Summary
One paragraph.

## Motivation
The problem, and who has it.

## Proposal
The design, including a sketch of the public API.

## Compatibility
What breaks, for whom, and the migration path.

## Alternatives considered
What else you looked at, and why not.
```
