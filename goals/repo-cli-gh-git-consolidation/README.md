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

P1 Implement, W0 in review: `Git.isAncestor` and `Git.worktreePrune` in `@beep/git`, `Git.layer` at the repo-cli
runtime edge, and the Knowledge, Quality residue, Ci route-census, GitWorktree and TmpfsReap sites on them (SPEC
D-07). P0 is complete: [`research/p0-site-inventory-2026-11-02.md`](./research/p0-site-inventory-2026-11-02.md).
Next: W1 (fail-closed parsers, rename score, bounded output; the repo-cli and Yeet `GitExec` layers).

## Latest Evidence

- 2026-11-02 P0: 36 site-list rows censused with the kit gaps G1-G10 and a six-wave plan (PLAN "Waves").
- 2026-11-02 W0: `research/is-ancestor-prune-differential-w0.json` (21 scenarios, 18 same, 3 classified, 0
  unclassified); `@beep/git` unit, coverage, test-double and real-repository suites green; repo-cli typecheck and
  the knowledge-doctor, residue-reap, tmpfs-reap, route-census and quality dispatch suites green.

## Notes

Created paused by effected-promotion closeout PR C from its W4-l decision; unpaused 2026-11-02 (SPEC D-02).
The inherited site list is [`research/site-list.md`](./research/site-list.md); the working census is
[`research/p0-site-inventory-2026-11-02.md`](./research/p0-site-inventory-2026-11-02.md).
