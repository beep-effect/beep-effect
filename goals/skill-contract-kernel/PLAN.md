# Skill Contract Kernel Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm scope against the inherited exploration research; re-read the qa judge surfaces (`Inventory.schemas.ts`, `JudgeCheck.ts`, `JudgeIngest.ts`, `JudgeLint.ts`) and the substrate precedents (`VerifiedTextAnchor`, `TierGateVerdict`, `ClaimGateResult`). | Facts and blockers recorded; first-slice shape confirmed. |
| P1 Implement | pending | First vertical slice, then widen: (a) `Gate` + `EvidenceReceipt` schemas; one `JudgeCheck` rule (cited-artifact-exists) as a typed fail-closed gate with parity tests; (b) full `SkillContract` root, ladder ADT, remaining receipts, `GateSummary`; (c) judge-gate retrofit complete; (d) SKILL.md projection via `@beep/md` + re-extraction equality gate. | Acceptance criteria of `SPEC.md` are met. |
| P2 Verify | pending | Run required checks and capture evidence (package tests, parity tests, `beep yeet verify`, docgen). | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Design order is schema → service contract → implementation; the first slice
  exists to surface substrate friction before the surface is wide.
- ACS/in-toto vocabulary sources are pinned in
  [`research/SOURCES.md`](./research/SOURCES.md); do not re-derive them from
  memory.

## Verification Commands

```sh
test "$(wc -m < goals/skill-contract-kernel/GOAL.md)" -le 4000
jq . goals/skill-contract-kernel/ops/manifest.json
rg -n "skill-contract-kernel|GOAL.md|agentLaunchers|packetAnchorDocument" goals/skill-contract-kernel
git diff --check -- goals/skill-contract-kernel
```
