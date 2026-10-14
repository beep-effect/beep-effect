# Observability Kernel and Instrumentation Catalog Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm defect repros, catalog placement, effect snapshot. | Placement decision logged; repro tests red. |
| P1 Defects + split | in-progress | Fix the five defects; split kernel from server wiring. | Regression tests green. |
| P2 Catalog + registry | pending | Catalog schema, registry with beep.* v2, EmitterContext, TelemetryTier, lint, enrichment. | Decode + lint tests green; doctrine regenerated. |
| P3 Migrate | pending | Metric/name migrations; effect bump. | Repo check green. |
| P4 Yeet | pending | PR to mergeable. | Merge gate passes. |
| P5 Close | pending | Reflection; packet flip. | completed-retained. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- 2026-10-14 PR 1: the five defects (DevTools/OTLP ordering, DevTools span end/events, `layerConsoleLogger` tracer bridge and dual form, pluggable `OtlpSerialization`) are fixed with regression tests; `package-verify @beep/observability` passes. The kernel/`server` split is the rest of P1.

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/observability-kernel-catalog/GOAL.md)" -le 4000
jq . goals/observability-kernel-catalog/ops/manifest.json
rg -n "observability-kernel-catalog|GOAL.md|agentLaunchers|packetAnchorDocument" goals/observability-kernel-catalog
git diff --check -- goals/observability-kernel-catalog
```
