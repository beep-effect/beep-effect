# Context Rent Telemetry

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Every always-loaded line in `CLAUDE.md` / `AGENTS.md` / skill frontmatter charges rent
(context tokens, every session, every agent) — but nobody measures which lines actually
change agent behavior. Instrument it; prune empirically instead of by taste.

## Next Open Question

Resume when knowledge-surface-automation Workstream C ships pruning-proposal
machinery. Decide the A/B guidance-degraded-session question at unpark.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).

## Trail

- 2026-08-13: parked the empirical arm. Resume when
  knowledge-surface-automation Workstream C ships pruning-proposal machinery;
  decide the A/B guidance-degraded-session question at unpark.

- 2026-07-31: packet opened — spin-off captured from the knowledge-surface-automation
  ratification interview (Workstream C's context-bloat pruning stays proposal-only;
  empirical pruning graduates here).
