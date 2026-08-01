# Bitemporal Goal Roadmap (--as-of)

## Status

Stage: `capture`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

`beep goals next --as-of <commit|date>`: replay the capability-derived roadmap graph as
it stood at any point in time, over an event ledger — the roadmap becomes a bitemporal
projection instead of a now-only view.

## Next Open Question

Event ledger source of truth: derive events from the git history of
`goals/*/ops/manifest.json`, or maintain an explicit append-only ledger file — and does
the projection reuse the epistemic-bitemporal-edge-core kernel or stay a simpler
single-timeline replay?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).

## Trail

- 2026-07-31: packet opened — spin-off captured from the knowledge-surface-automation
  ratification interview (Workstream D ships the now-view engine; the time dimension
  lives here as a sibling of epistemic-bitemporal-edge-core).
