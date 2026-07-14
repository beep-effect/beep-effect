# Harness OTel Adoption

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Point Claude Code and Codex native OTel exporters at dankserver's existing
`monitoring_otel_collector` (traces→Phoenix, metrics→Prometheus/Grafana) with
a beep-owned, version-pinned attribute schema that finally makes agent
telemetry attributable to repo/branch/goal/task-class — content capture off.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/harness-otel-adoption/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance (inherited from
   [`explorations/agent-effectiveness-pulse`](../../explorations/agent-effectiveness-pulse/README.md)).

## Current Phase

P0 Research — verify current Claude Code/Codex OTel config surfaces and the
dankserver collector pipeline; decide the dual-ingestion precedence rule.

## Latest Evidence

Not started. Graduated 2026-07-14 from
[`explorations/agent-effectiveness-pulse`](../../explorations/agent-effectiveness-pulse/README.md)
(pulse report: `research/pulse-report.md`; landscape:
`research/2026-07-13-external-landscape.md`; decisions: DECISIONS.md
2026-07-14 entries).
