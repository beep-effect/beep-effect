# Agent Rating Critique Fixes

## Status

Lifecycle: `superseded`

**Closed by operator ruling (finish board, 2026-11-13).** There has been no real progress in about three weeks, the rating is now stale, and later quality goals overlap its fixes. The packet is `superseded` without meeting its completion gate. To resume, run `bun run beep goals set-status agent-rating-critique-fixes active` and re-graduate the next slice. Decision: [`decisions/2026-11-13-finish-board-ruling-close.md`](./decisions/2026-11-13-finish-board-ruling-close.md).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Land the 2026-10-21 repository rating (8/10) as evidence and execute its
critique fixes in scored phases.

## Launch

```text
/goal follow the instructions in goals/agent-rating-critique-fixes/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative
contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (acceptance per
   phase, Decision Log D1–D4).
3. [`PLAN.md`](./PLAN.md) - phases P0–P4 with exit criteria.
4. [`research/repository-rating.md`](./research/repository-rating.md) -
   the scored baseline: 11 dimensions, overall 8/10, every deduction
   citing a repo path.
5. [`research/SOURCES.md`](./research/SOURCES.md) - audit method, counting
   commands, provenance.
6. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.

## Current Phase

P0 Land rating + packet — in progress. The rating and packet ship in one
docs-only PR from worktree `agent-rating-critique-fixes` (branch
`docs/agent-rating-critique-fixes`). Fix phases P1–P3 are separate PRs;
P4 re-rates under the identical rubric and closes the packet.

## Latest Evidence

[`research/repository-rating.md`](./research/repository-rating.md)
(2026-10-21): eight parallel auditors plus orchestrator-verified
maintainability/security. Headline scores: Architecture 9, Schema-first
9.5, Type safety 9, Testing 8.5, CI/CD 8.5, Security 8.5, Modularity 8,
Agent friendliness 7, Documentation 7, Maintainability 6.5, DX 6.
Overall 8/10 (mean 87.5/11).

## Notes

- The three highest-leverage fixes (rating §"Where the next point of
  effort goes"): shrink the always-loaded prefix, close the two
  silent-green holes, split the four handwritten mega-files.
- S11 (merge over red required jobs) is an operator ruling. This packet
  records a recommendation at P2; it does not change the policy.
