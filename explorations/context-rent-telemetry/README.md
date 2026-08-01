# Context Rent Telemetry

## Status

Stage: `capture`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Every always-loaded line in `CLAUDE.md` / `AGENTS.md` / skill frontmatter charges rent
(context tokens, every session, every agent) — but nobody measures which lines actually
change agent behavior. Instrument it; prune empirically instead of by taste.

## Next Open Question

Which harness telemetry signal can attribute an agent behavior change to a specific
guidance line (CLAUDE.md rule, skill description) — and can the
agent-effectiveness-loop Phoenix substrate measure it without new infrastructure?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).

## Trail

- 2026-07-31: packet opened — spin-off captured from the knowledge-surface-automation
  ratification interview (Workstream C's context-bloat pruning stays proposal-only;
  empirical pruning graduates here).
