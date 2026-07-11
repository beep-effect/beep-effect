# Ontology Agent Surface

## Status

Stage: `shape`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The ontology-workbench packet (completed-retained) built agent-ready plumbing on
purpose — SPEC 13–16: partitioned session graphs, schema-typed worker protocol,
real batch deltas, query safeguards — and named an agent/MCP tool surface as its
explicit follow-up. This exploration crystallizes that surface, folding in the
workbench retrospective's hardening pre-work and architecture consolidations.

## Next Open Question

BRIEF.md is drafted from the five resolved decisions — does it match the
picture in the user's head? (Shape-stage exit gate: user sign-off, then
decompose.)

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-10: align completed — all 5 queued questions resolved in one
  grilling pass (HTTP-on-sidecar transport; stateless+fingerprint-CAS session
  model; TierGate+attribution+budgets launch-blocking; curated ~10-tool
  vocabulary; hardening folded into P0/P1). BRIEF.md drafted; manifest
  advanced to `shape`. Stopped awaiting brief sign-off.
- 2026-07-10: research stage completed both halves — codex in-repo inventory
  (9 wire-ready RPCs; m365-mcp as MCP template; TierGate in mcp-kit; gaps: no
  two-writer session contract, no mutation budgets/attribution, no mountable
  MCP transport) + claude external landscape (query/authoring MCP prior art
  incl. open-ontologies and owl-mcp; MCP transport spec). Manifest advanced to
  `align` with a 5-question queue. Stopped before first grilling question.
- 2026-07-10: packet opened from the ontology-workbench closeout retrospective;
  capture dump filed (SPEC 13-16 leverage, thin-adapter thesis, hardening
  pre-work, architecture consolidations, agent-specific concerns, prior-art
  leads). Stopped at end of capture.
