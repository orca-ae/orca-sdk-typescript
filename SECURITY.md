# Security policy

## Supported versions

We fix security issues in the latest minor release of the Orca TypeScript SDK. Fixes ship in the
next release. Older versions don't receive patches, so upgrade to the latest release to get them.

## Reporting a vulnerability

**Please don't report security problems in a public issue, pull request or discussion.**

Report them privately, in either of these ways:

1. **GitHub private vulnerability reporting.** Use the *Report a vulnerability* button on this
   repository's [Security tab](https://github.com/orca-ae/orca-sdk-typescript/security/advisories/new).
   We prefer this channel: it's private, it keeps the conversation in one thread, and it stays
   attached to the repository.
2. **Email `security@runorca.ai`**, with the repository name in the subject line.

As much as you have of the following helps us act quickly:

- the affected SDK version or commit, and the JavaScript runtime you use
- what an attacker could do, and under which configuration
- steps to reproduce the problem
- anything you already know about the impact

A rough report sent early is better than a polished one sent late.

## Scope

This repository is the TypeScript client library. Credential handling is its most
security-sensitive part. Of particular interest:

- API keys or access tokens leaking into logs, error messages or URLs
- requests that carry a credential to an unintended host, for example through base-URL handling or
  redirect following
- header or path injection through caller-supplied resource names or IDs

Vulnerabilities in the engine itself belong to
[Orca Agent Engine](https://github.com/orca-ae/orca-agent-engine/security/advisories/new).

## What happens next

We'll acknowledge your report, investigate it, and keep you updated as we go. We coordinate
disclosure with you. By default we aim to publish within 90 days of the report, and sooner once a fix
is available.

When the fix is released, we publish a security advisory in this repository and credit you in it,
unless you ask us not to.

We don't run a bug bounty program.
