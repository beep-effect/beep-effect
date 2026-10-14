# Observability Palantiri

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

One production-grade observability surface — the Palantiri — for everything
the operator runs: the deployed web apps, `practice-kg-mcp` on the attorney's
PC, the Tailscale fleet, repo tooling and CI, and every AI agent harness, both
as an emitter of attributed telemetry and as a consumer through one MCP + CLI
query surface. "Unified" means one attribution schema, one OTLP pipeline, one
query surface, and one place to look, not necessarily one store.

## Next Open Question

None — graduated 2026-10-14 into six goals (see [`MAP.md`](./MAP.md)). The
packet reopens at `decompose` when a MAP gate fires: the hub-store bake-off
(D1 enrollment gate), `tbk-ubuntu` enrollment, public ingress (spend), parcel-
gated yeet actions, or a cloud-VM path home.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's launch prompt (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - inherited D1–D9 plus the align log (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-10-14: align closed in two rounds plus a naming amendment
  (families-and-hosts survey); BRIEF and MAP written; graduated into
  `observability-kernel-catalog`, `palantiri-parcels`,
  `practice-kg-mcp-strict-tier`, `fleet-telemetry-tailnet`,
  `harness-emitters-all-providers`, `webapp-and-ci-telemetry`.
- 2026-10-14: research closed — four lanes (in-repo, fleet/hub, harness
  emitters, strict-tier exporter) plus operator dashboard review; RESEARCH.md
  and SOURCES.md written; `tbk-ubuntu` gated; stopped at align (usage limit).
- 2026-10-14: packet opened from the operator's launch prompt; handoff bundle
  imported into `research/handoff/`; D1–D9 recorded as inherited; research
  round launched.
