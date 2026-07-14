# Harness OTel Adoption Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Verify Claude Code + Codex OTel config surfaces against current docs; inspect dankserver collector pipeline config; decide dual-ingestion precedence rule; pin semconv versions. | Config surfaces confirmed per execution mode; precedence rule recorded; attribute schema drafted. |
| P1 Implement | pending | Slice 1: Claude Code → collector → Phoenix with repo/goal-slug attributes (needs operator: tailscale-serve route + collector pipeline update). Slice 2: Codex exporters. Slice 3: attribute schema module + optional Grafana dashboard. | All acceptance criteria in `SPEC.md` implementable and demonstrated. |
| P2 Verify | pending | Coverage-verification note: one day of native telemetry vs local transcripts; payload privacy check. | Verification matrix green or gaps documented. |
| P3 Close | pending | PR to mergeable via yeet, closeout reflection, packet status updates in the same PR (per the same-PR packet-state law entering via harness-hygiene-mechanical). | Packet closed; reflection lint passes. |

## Operator actions (need confirmation at execution time)

- New tailscale-serve route on dankserver → 127.0.0.1:4318 (collector),
  tailnet-only, pattern of the existing 8447→6006 Phoenix route.
- `monitoring_otel_collector` pipeline config: add traces exporter →
  Phoenix `127.0.0.1:6006`, keep/confirm metrics → prometheus.

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` in the same PR as the final work.
