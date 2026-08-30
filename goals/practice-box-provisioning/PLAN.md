# Practice Box Provisioning Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Verify CCG platform-app approval on the Business plan; repair Box SDK version provenance; confirm the reconciler package home with `bun run beep architecture`; gather the Box quote items (Governance-on-Business, Business Plus, collaborator seats) into a decision-ready table. | CCG verdict + quote table recorded in `history/`; package topology chosen; SDK provenance marker repaired. |
| P1 Implement | pending | Driver expansion (reads first, then mutations, regenerate + remeasure), then the reconciler: intent/observed/plan/receipt schemas → service contracts (`Inventory`, `Planner`, `Applier`, orchestration) → implementation. | Acceptance criteria for the driver surface and the dry-run vertical slice are met. |
| P2 Verify | pending | Dry-run plan artifact against the live tenant; repeat-run identity; operator-attended first apply; all-`Noop` re-plan; package-verify handoffs. | Verification matrix green; apply receipt in `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `bun run beep yeet monitor` reports `merge-ready: yes` (the aggregate hard gate); zero unresolved review threads. |
| P4 Close | pending | Land the closeout reflection and packet-state flip in the same PR as the final work (same-PR packet-state flips) — these edits ride that PR before its publish, never a post-merge follow-up. | The final work PR contains the reflection and status flip; P3's merge-ready verdict covers it. |

## P4 Closeout Checklist

Run this checklist before the final work PR publishes — the reflection and
the `status` → `completed-retained` flip land in that same PR (same-PR
packet-state flips), never as a post-merge follow-up:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json`
   phase statuses + `initiative.status`.

## Execution Notes

- Work driver phases and reconciler phases as separate PRs if the diff grows;
  each PR still rides the full yeet path.
- The live tenant is only touched in P2 apply, operator-attended, from a
  reviewed plan artifact. Everything before that is reads and dry-run.
- Preserve unrelated worktree changes; keep `SPEC.md` normative.

## Verification Commands

```sh
test "$(wc -m < goals/practice-box-provisioning/GOAL.md)" -le 4000
jq . goals/practice-box-provisioning/ops/manifest.json
rg -n "practice-box-provisioning|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-box-provisioning
git diff --check -- goals/practice-box-provisioning
```
