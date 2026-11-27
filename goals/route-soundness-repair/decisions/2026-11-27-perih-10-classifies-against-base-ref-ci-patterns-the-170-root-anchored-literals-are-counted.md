---
title: "PERIH-10 classifies against base-ref CI patterns; the 170 root-anchored literals are counted"
date: 2026-11-27
kind: checkpoint
lane: "fix/route-soundness-perih-10"
reversal: "Restore readCheckoutCiPatterns at the head checkout in CiOperational.service.ts and HeavyAdmission.ts, revert the parity fixture, and drop the two repo-cli inputs with a cache re-record"
---

`beep ci change-profile` and the heavy lane-skip read (`readHeavyLaneSkips`) now take `CiOperational.patterns.json` from the pull request's base commit (`git show <base>:<file>`), never from the head checkout. A base with no file uses the binary's compiled-in patterns. A base file that git cannot read, or that does not decode under the binary's schema, keeps every profile active. Neither case fails the job, so a pin bump whose binary expects a changed schema runs in full instead of failing its own Change Profile. A pattern edit therefore takes effect on the pull request after it merges.

**Mutation evidence.** `ci-bootstrap-parity.test.ts` commits canonical patterns at the base. The head widens `docs` to `.` and `codeRoots` to `^$`, and adds a source file. Against the previous head-checkout read the profile came out `docs_only=true`, which was the red assertion. With the base read it comes out `docs_only=false`. The same test covers four more cases:

- a base without the file classifies with the compiled-in patterns;
- a narrowed base pattern applies to a docs-only head;
- a base file that predates `lanes` keeps every lane relevant;
- an undecodable base file yields the full profile with exit 0.

A push already yields the full profile (golden `push` row).

**Call sites.** None needed a workflow edit. These call the pinned `beep` binary:

- `check.yml`: the Change Profile job, the Test Plan classification and the lane-gate evals in Coverage Regression, Professional Desktop IPC Stdio and JSDoc Ratchet;
- `heavy-admit.yml`, the documentation-only admission;
- `storybook.yml`, the lane gate.

The admission lane skips (`readHeavyLaneSkips`) run from source instead: `bun run beep ci admission` in `check.yml` and `heavy-admit.yml`, both `pull_request` workflows that check out the merge ref.

`heavy.yml` no longer calls change-profile, and `shard-overflow.yml` only consumes the `docs_only` output. One call site is excluded: the smoke run in `beep-ci-binary.yml` sets `GITHUB_EVENT_NAME=push`, which never reads patterns. `CiOperational.service.ts` is in the CI binary closure, so the change-profile half ships with the next closure-digest binary release and its reviewed pin bump (PERIH-11), and the pull request is an operator hand merge. The base read goes through `@beep/git/Git`, which grows the closure from 352 to 363 paths: the nine `@beep/git` sources plus its `package.json` and `tsconfig.json`, and nothing else. `ci-binary-closure.test.ts` pins `Git.ts` inside the closure. The admission half is live at merge. Until the pin bump merges, admission skips read the base patterns while change-profile still reads the head checkout.

**Root-anchored literals (170 rows, origin/main).**

- 143 are not reads: classifier rows, synthetic temp-tree paths, assertion messages and in-memory projects.
- 5 are real reads already declared: the claim-element fixtures and `vitest.shards.json`.
- 10 are real reads the task graph already reaches. Nine are sources in the reader's workspace dependency closure. A turbo `--affected` dry run selected `@beep/repo-cli#test` for a one-byte change to each of the nine. The tenth is repo-gate-vitest's source, which every `test` reaches through `@beep/repo-gate-vitest#transit`.
- 2 are real reads that no input declared, now declared on repo-cli's `test`, `test:property` and `coverage`. Before the declaration a dry run did not select `@beep/repo-cli#test` for either file. After it, it does.
- 10 are expected results of repository-wide scans in repo-cli tests (the property sweep, the goal-data census, the tracked `turbo.json` listing). Declaring the listed files does not make those scans sound. They move to a Repo Sanity task in the next PR of this lane.
