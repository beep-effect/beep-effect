# Speed Loop

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Run the research → probe → grill → ship → harvest cycle as a standing agentic
loop over repo quality/speed/performance, until two consecutive cycles' best
probe-gated candidates each measure under ~30 seconds of full-sweep saving
(the stop rule — see `SPEC.md`).

## Read This First

1. [`SPEC.md`](./SPEC.md) — the loop protocol, guardrails, and stop rule.
2. [`PLAN.md`](./PLAN.md) — the cycle log.
3. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) — the living
   27-item opportunity ledger (the loop's working memory).
4. [`research/GRILL-DECISIONS.md`](./research/GRILL-DECISIONS.md) — every
   locked decision across the three grill sessions.
5. `research/r*.md`, `research/o*.md` — the eleven research reports;
   `research/adhd/` — the divergent-ideation pool and deepened branches.

## Outcome (2026-08-08)

Completed and retained as the evidence ledger for the campaign from the
Blacksmith exit through EC2 groundwork, the supervised runner burst, and the
wrap-up widgets. The campaign shipped more than eleven merged PRs; decisions
51–63 close the loop, disposition the remaining widgets, and graduate the
runner endgame without stretching this packet into another multi-week arc.

The active successor is
[`goals/ci-fleet-endgame`](../ci-fleet-endgame/README.md): an on-demand
worker-per-job system and elimination of 20-minute jobs are co-primary.

## Latest Evidence

- PR #548 (merged): tstyche removal, MimeType check-bomb fix
  (17.79s → 0.445s per barrel importer), CI concurrency caps, bounded docgen.
- PR #549 (merged): probe-proved leaf boundaries — BlockRepair 15.2M → 2.0M
  instantiations (−86.8%), Md.safe −21.8%.
- PRs #600, #603, #611, #618, and #620: Blacksmith exit, EC2 groundwork,
  hardening, and owned-runner cutover; the supervised burst then landed an
  eight-PR merge wave.
- `feat/speed-loop-wrapup-widgets`: #84, #88, #89, and #90 shipped together
  before the lifecycle flip.
- Closeout reflection:
  [`history/reflections/2026-08-08-codex.md`](./history/reflections/2026-08-08-codex.md).
- Predecessor packet: `goals/quality-speedup` (completed-retained) — census,
  quality-time inventory, tstyche inventory.
