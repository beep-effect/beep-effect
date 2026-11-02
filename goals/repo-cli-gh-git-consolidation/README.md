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

P1 Implement. W0 (#2514), the W1 kit (#2522), W1a (#2539), W1b (#2546), W2 (#2593, SPEC D-10), the W3 kit
(#2556), W3 sites (#2614, SPEC D-12) and the W4 kit (#2600) merged. W2b (this PR, SPEC D-11): the remaining Yeet
git halves, the Library inventory read and ai-metrics' `ls-files` run through `Git`, with Sweep's probes behind the
`sweepProbeFromGit` CommandProbe adapter. Next: W4 sites, then W5.

## Latest Evidence

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
