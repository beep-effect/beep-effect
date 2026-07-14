# One-Round Loop

## Status

Lifecycle: `completed-retained` — P0 and P1 complete; P2–P4 pending.

Source: [`ops/manifest.json`](./ops/manifest.json)

### Closeout reconciliation (2026-07-11)

Manifest phases had drifted: P0 (CI-lane inversion: `beep ci` lane +
`check.yml` thinning) and P1 (property-law lane, SAST gate, env-max
floors) shipped via merged PRs #321–#336 during 2026-07-07/08 (e.g.
#327 merged as `64b7e44d88`), but all phases still read `pending`.
Reconciled 2026-07-11: P0/P1 marked complete with PR evidence; P2–P4
remain pending and the packet stays active.

### Portfolio closeout (2026-07-14)

The retained deliverable is P0 and P1: CI-lane inversion and the
property-law lane shipped through merged PRs #321–#336. P2's four
medium-tier items and all P3 stretch items are recorded `wont_fix` in
[`ops/progress.json`](./ops/progress.json) until CI round-trips measurably
bottleneck delivery (median PR requires more than one CI round).

P4's documentation closeout is recorded in
[`history/p4-closeout.md`](./history/p4-closeout.md), which points each
shipped Verification Matrix claim to the P0/P1 evidence. The property lane
remains non-required; its required-check flip is explicitly deferred under
the same trigger rather than treated as shipped.

## Mission

Make the next crispening-scale effort need at most one CI round per PR:
a single local command renders CI's verdict (`beep ci local`, backed by
CLI-owned lane definitions so drift is structurally impossible), and
schema round-trip laws run deep enough pre-merge to catch
seed-dependent bugs on the PR that introduces them. The packet proves
itself on itself via the dogfood rule.

## Launch

```text
/goal follow the instructions in goals/one-round-loop/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` is the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) — normative: tiers, fences, Definition of
   Done (mechanisms + self-dogfood), verification matrix, stop
   conditions.
3. [`PLAN.md`](./PLAN.md) — phase table and execution notes.
4. [`research/decisions-locked.md`](./research/decisions-locked.md) —
   grilled rulings D1–D7 and R1–R4. Locked — do not reopen.
5. [`research/research-facts.md`](./research/research-facts.md) — the
   distilled fact base (CI lane inventory, verify delta, numRuns
   landscape, coverage internals, CLI surfaces).
6. [`ops/manifest.json`](./ops/manifest.json) — machine-readable
   routing; [`ops/progress.json`](./ops/progress.json) — resumable
   state incl. the dogfood ledger.

## Current Phase

Docs-side P4 closeout is complete. P0 and P1 are complete and merged;
P2 and P3 are recorded deferrals, and the property-lane required-check
flip remains deferred.

## Latest Evidence

Packet authored 2026-07-07 from the crispening closeout reflection
(`goals/repo-crispening-orchestration/history/reflections/2026-07-07-claude.md`)
plus three Explore research briefs. P0 and P1 shipped via merged PRs
#321–#336 (2026-07-07/08, e.g. #327 merged as `64b7e44d88`); manifest
reconciled 2026-07-11.
Portfolio closeout and the required reflection were recorded 2026-07-14.

## Notes

Locked decisions live in
[`research/decisions-locked.md`](./research/decisions-locked.md);
amendments require a superseding entry in
`standards/architecture/DECISIONS.md`. Sibling seam: this packet edits
tooling, CI, and test infrastructure only — the sole product-adjacent
edits are the three wire-preserving `withNormalizedCheck` migrations
(venice-ai, phoenix, m365; uspto optional as a noted tightening —
SPEC fence 4).
