# AI Metrics Raw Retention Spec

## Objective

Prove that `derived` can be regenerated from `raw` for a sampled window, then add a compaction step (compress in place or offload to a named target) for raw files older than a retention window decided in P0. `derived`, `mirror`, `config-snapshots` are untouched. The restore drill reads encrypted raw files at `raw/<sourceKind>/<id>.json` today (`packages/tooling/library/ai-metrics/src/retention.ts`, `archive.ts`), so compaction must either keep that path readable or teach the restore path the compacted or offloaded form. The step is a timer rendered on the ops seat via the same renderer family as `ops-seat-timers`.

Brief and decisions: [`explorations/agent-fleet-layout/BRIEF.md`](../../explorations/agent-fleet-layout/BRIEF.md), [`explorations/agent-fleet-layout/DECISIONS.md`](../../explorations/agent-fleet-layout/DECISIONS.md). Depends on: [`goals/ops-seat-timers`](../../goals/ops-seat-timers/README.md)

## Non-Goals

- Deleting raw data.
- Relocating the whole data root.
- Changing the forwarder, hashing or redaction posture (goal `ai-metrics-stack` P7).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/library/ai-metrics` (derive-from-raw proof, compaction)
- a timer renderer (depends on the `ops-seat-timers` renderer family)
- `goals/ai-metrics-stack` retention posture (extend, back-link)

## Constraints

- Raw is the encrypted source of record (`goals/ai-metrics-stack` SPEC); compress or offload only.
- Reproducibility proof precedes any compaction.
- Retention window and offload target are P0 decisions recorded in this packet's decision log.
- Depends on `goals/ops-seat-timers`: the compaction timer renders on `seats/ops` through that renderer family. P0 research and the reproducibility proof may start earlier; the goal does not close before the timer exists.
- Restore stays provable: a restore drill over compacted or offloaded raw must succeed before any original is removed.

## Acceptance Criteria

- [ ] A documented command regenerates `derived` for a sampled window from `raw` and diffs clean.
- [ ] Raw files older than the chosen window are compressed or offloaded; size before and after is recorded.
- [ ] After compaction, the restore drill replays a sampled window of retained (compacted or offloaded) raw data and matches the pre-compaction result.
- [ ] Nothing under `derived`, `mirror`, `config-snapshots` changes.
- [ ] `bun run beep quality package-verify @beep/ai-metrics` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/ai-metrics-raw-retention/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ai-metrics-raw-retention/ops/manifest.json` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/ai-metrics` | Passes |
| Whitespace | `git diff --check -- goals/ai-metrics-raw-retention` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log

Seeded from the exploration; entries here cover only decisions taken inside this goal.

| Date | Decision | Source |
| --- | --- | --- |
| 2026-10-05 | Scope, non-goals and constraints inherited from the exploration brief, rabbit holes and no-gos. | `explorations/agent-fleet-layout/DECISIONS.md` |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
