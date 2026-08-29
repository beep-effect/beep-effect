# Quality Speedup

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Cut the wall-clock time from "agent starts work" to "PR is mergeable": remove
the tstyche type-test lane, measure where quality time actually goes (local
yeet lanes, clone fleet, hosted CI), and census TypeScript instantiation/memory
cost with a staged remediation plan. Workstream A is a landable change;
Workstreams B and C are evidence-first and land as docs-only reports.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/quality-speedup/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - measurement artifacts and reports.

## Current Phase

P4 Close — all workstreams shipped in one PR (removal + reports + grill
decisions + the three pulled-forward remediations); closeout reflection
written. Remaining follow-ups are recorded in
`history/2026-08-03-grill-decisions.md`.

## Latest Evidence

- PR [#548](https://github.com/beep-effect/beep-effect/pull/548) —
  `perf(quality-speedup)`: tstyche removal, MimeType check-bomb fix
  (barrel importers 17.79s → 0.445s), CI concurrency cap, bounded pre-push
  docgen, three research reports, grill decisions.
- Green local proof: yeet verify success (15:02, zero failed lanes) prior to
  publish; verdict at `.beep/yeet/runs/` for the branch.
- Closeout reflection: `history/reflections/2026-08-04-claude.md`.

## Notes

- Workstream A deletion is gated on review of
  `research/tstyche-inventory.md` (unique type assertions flagged there need
  explicit sign-off before their files are deleted).
- Prior art that must not be re-derived: `goals/repo-quality-throughput`,
  `explorations/agent-pipeline-velocity`,
  `goals/coding-agent-effectiveness-evidence-loop`, `goals/box-typecheck-cost`
  (all completed/retained — this packet cites them, it does not fork them).
- Remediation derived from B/C does NOT land in this packet; P3 hands off a
  reviewed candidate list.
