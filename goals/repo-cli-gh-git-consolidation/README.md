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

P1 Implement, W2 in review (this PR). The G7 dirty-axis readers run through `Git`: `internal/repo-run/ChangedFiles.ts`
(`unstagedChanges` / `stagedChanges` / `untrackedFiles` with `diffFilter`, `noRenames` and pathspecs; `changedFiles`
for the base range, through the new `collectBaseRangeChangedFiles`), Yeet's `lockfileChangedSinceBase`, the `status`
probes of `ResidueReap`, `TmpfsReap` and the fleet mirror, the Worktree listing (`Git.worktreeList` mapped by
`worktreeListEntriesFromGit`; `parseWorktreePorcelain` and `parseStatusPorcelainZ` retired), Fleet's origin and
common-dir probes, and the one-liners of `Codex/Security`, `Session/SessionLedger`, `Runners`, `Ci/CiLane`,
`Quality/ChangesetStatus`, `PackageVerify`, `CoverageRegression` and `CoverageArtifacts` (SPEC D-10). The Knowledge
path-removal log (#110) stays: `Git.log` has no starting ref. W2b carries the Yeet `Settle`/`ProofShadow` and
probe-seam git halves, `Library.inventory.ts` and ai-metrics #107. W0 merged (#2514); the W1 kit merged (#2522);
W1a (#2539) and W1b (#2546) in review. Next: W2b, then W3.

## Latest Evidence

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
