# Harness OTel Adoption Plan

## Status

Status: `completed-retained` (all phases completed 2026-07-25)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed 2026-07-14 | Verify Claude Code + Codex OTel config surfaces against current docs; inspect dankserver collector pipeline config; decide dual-ingestion precedence rule; pin semconv versions. | Done: `research/p0-config-surfaces.md` + `research/p0-attribute-contract.md` (precedence rule + pinned versions + attribute schema v1). |
| P1 Implement | completed 2026-07-14 | Slice 1: Claude Code → collector → Phoenix with repo/goal-slug attributes (needs operator: tailscale-serve route + collector pipeline update). Slice 2: Codex exporters. Slice 3: attribute schema module + optional Grafana dashboard. | Done: `history/p1-rollout-evidence.md` (dankserver 3b22cac, tailnet :8448 route, attributed metrics live; typed schema module deferred to first in-code consumer per amended acceptance). |
| P2 Verify | completed 2026-07-25 | Coverage-verification note: one day of native telemetry vs local transcripts; payload privacy check. | Done: `history/p2-coverage-verification.md` (98.5% session coverage by id-join, per-model token comparison, codex mode inventory + recorded limits, 560-span privacy sample clean). |
| P3 Close | completed 2026-07-25 | PR to mergeable via yeet, closeout reflection, packet status updates in the same PR (per the same-PR packet-state law entering via harness-hygiene-mechanical). | Packet closed; reflection lint passes. |

## Operator actions (completed 2026-07-14)

- New tailscale-serve route on dankserver → 127.0.0.1:4318 (collector),
  tailnet-only, pattern of the existing 8447→6006 Phoenix route. Done —
  verified live in `history/p1-rollout-evidence.md`.
- `monitoring_otel_collector` pipeline config: add traces exporter →
  Phoenix `127.0.0.1:6006`, keep/confirm metrics → prometheus. Done —
  dankserver commit 3b22cac.

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` in the same PR as the final work.
