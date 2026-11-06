# repo-cli gh/git consolidation

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move repo-cli and its tests off hand-rolled gh and git spawning onto @beep/github, @beep/git and @beep/commands, extending the kits where they lack the feature

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/repo-cli-gh-git-consolidation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P1 Implement, W7c in review (this PR). `research/w7-site-census-2026-11-03.md` counted 279 remaining git and gh
argv templates, 208 without a recorded outcome (SPEC D-16); the W7 kit (#2665, SPEC D-17) added the `@beep/git` members
and options the 37 (B) rows need and moved `patientGit` to `internal/repo-run/PatientGit.ts`; W7a (#2708, SPEC D-18)
moved the Yeet census rows Y1-Y88 onto it; W7b (#2721, SPEC D-19) moved the other command groups' rows B1-B136; this PR
moves the Worktree rows W1-W45 (SPEC D-20). Earlier
waves merged: W0 (#2514), the W1 kit (#2522), W1a (#2539), W1b (#2546), W2 (#2593, D-10), W2b (#2606, D-11), the W3 kit
(#2556), W3 sites (#2614, D-12), the W4 kit (#2600), W4 sites (#2622, D-13), W5 (#2642, D-14), W6 (#2648, D-15), the W7
kit (#2665, D-17), W7a (#2708, D-18) and W7b (#2721, D-19). Next: the runner retirement, then closeout C.

## Latest Evidence

- 2026-11-03 W7c: `research/worktree-differential-w7.json` (107 scenarios, 106 same, 1 classified, 0 unclassified);
  repo-cli `check` clean, the Worktree, reap, residue, fleet, tmpfs and merge-driver suites green on Node and Bun,
  `goals/tsconfig.ops.json` clean for the W7c files; `lint effect-vitest`, Fallow audit and Fallow health introduce 0.
- 2026-11-03 W7b: `research/groups-differential-w7.json` (100 scenarios, 34 git and 66 gh; 76 same, 24 classified,
  0 unclassified); the census W7b rows B1-B136 are on `@beep/git`/`@beep/github` or KEEP with their reason (D-19).
- 2026-11-03 W7a: `research/yeet-differential-w7.json` (81 scenarios, 72 same, 9 classified, 0 unclassified);
  repo-cli `check` and `docgen` clean, every `yeet-*`, `proof-job`, `session-ledger` and `ci-runner-security` suite
  green on Node (1868 tests; `yeet-merge-gate` holds 3 reds only on a host with an active merge reservation)
  and the 8 touched suites on Bun, `goals/tsconfig.ops.json` clean; `lint effect-vitest`, Fallow audit, health and
  dead-code introduce 0.
- 2026-11-02 W6: `research/yeet-gh-seams-differential-w6.json` (51 scenarios, 40 same, 11 classified, 0 unclassified);
  repo-cli `check` clean, every `yeet-*`, `proof-job` and `shared-internals` suite green on Node and Bun (65 files,
  1885 tests), `goals/tsconfig.ops.json` clean; `lint effect-vitest`, Fallow audit and Fallow health introduce 0.
- 2026-11-02 W5: the 86 repo-cli suites that held a `ChildProcessSpawner.make`/`makeHandle` double run 2737 tests
  before and after on Node and on Bun (baseline origin/main 71bc36fcb4), `tailscale.test.ts` 15 before and after on
  both; repo-cli `check` and tailscale `check` clean; `lint effect-vitest`, Fallow audit and Fallow health introduce
  0. Two `quality-command-dispatch` security cases fail on origin/main's file as well while another session's
  `agent-run` scope is live (RunScope samples it), so they are environment-only.
- 2026-11-02 W4 sites: `research/review-thread-differential-w4.json` (40 scenarios, 29 same, 11 classified, 0
  unclassified); repo-cli typecheck clean, every `yeet-*` and `shared-internals` suite green (62 files, 1577 tests),
  the `@beep/github` `ReviewThread` suite green with the cursor hardening.
- 2026-11-02 W2b: `research/yeet-remainder-differential-w2b.json` (66 scenarios, 55 same, 11 classified, 0
  unclassified); repo-cli and ai-metrics `check` clean, touched suites green on Node and Bun.
- 2026-11-02 W3 sites: `research/reviewer-ci-github-differential-w3.json` (45 scenarios, 37 same, 8 classified,
  0 unclassified); repo-cli typecheck and lint clean, the reviewer, ci and yeet merge-gate suites green.
- 2026-11-02 W2: `research/dirty-axis-differential-w2.json` (66 scenarios, 61 same, 5 classified, 0 unclassified);
  repo-cli typecheck clean, the worktree, fleet, residue-reap, tmpfs-reap, quality-tasks, docgen, session-ledger,
  codex-security, package-verify, ci-lane, changeset-status, runners-bake, coverage-artifacts and step-git-exec
  suites green (23 files, 1137 tests); `lint policy-fingerprint --write` leaves the seals byte-identical.
- 2026-11-02 W1b: `research/yeet-git-differential-w1b.json` (31 scenarios, 27 same, 4 classified, 0
  unclassified); repo-cli typecheck clean, every `yeet-*`, `step-git-exec`, `tmpfs-reap`, `residue-reap`,
  `git-worktree` and `git-adoption-sites` suite green (64 files, 1640 tests).
- 2026-11-02 W1a: `research/git-readers-differential-w1a.json` (45 scenarios, 28 same, 17 classified, 0
  unclassified); repo-cli typecheck clean, `step-git-exec` (fold unit tests and a real-repository reader test),
  knowledge, quality, ci-route, worktree, coverage and yeet final-check suites green.

- 2026-11-02 P0: 36 site-list rows censused with the kit gaps G1-G10 and a six-wave plan (PLAN "Waves").
- 2026-11-02 W0: `research/is-ancestor-prune-differential-w0.json` (21 scenarios, 18 same, 3 classified, 0
  unclassified); `@beep/git` unit, coverage, test-double and real-repository suites green; repo-cli typecheck and
  the knowledge-doctor, residue-reap, tmpfs-reap, route-census and quality dispatch suites green.

## Notes

Created paused by effected-promotion closeout PR C from its W4-l decision; unpaused 2026-11-02 (SPEC D-02).
The inherited site list is [`research/site-list.md`](./research/site-list.md); the working census is
[`research/p0-site-inventory-2026-11-02.md`](./research/p0-site-inventory-2026-11-02.md).
