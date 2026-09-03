# Practice Box Provisioning Plan

## Status

Status: `completed-retained` — all phases complete on 2026-09-03. The live
dry-run, the operator-attended apply, and the all-`Noop` re-plan are recorded
in `history/2026-09-03-p2-live-apply.md`; the reflection and status flip ride
PR #959 with the final fix.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Verify CCG platform-app approval on the Business plan; repair Box SDK version provenance; confirm the reconciler package home with `bun run beep architecture`; gather the Box quote items (Governance-on-Business, Business Plus, collaborator seats) into a decision-ready table. | CCG verdict + quote table recorded in `history/`; package topology chosen; SDK provenance marker repaired. |
| P1 Implement | complete | Driver expansion (reads first, then mutations, regenerate + remeasure), then the reconciler: intent/observed/plan/receipt schemas → service contracts (`Inventory`, `Planner`, `Applier`, orchestration) → implementation. | Driver and reconciler package verification pass; local dry-run/apply safety tests are green. |
| P2 Verify | complete | Dry-run plan artifact against the live tenant; repeat-run identity; operator-attended first apply; all-`Noop` re-plan; package-verify handoffs. | Verification matrix green; apply receipt in `history/`. |
| P3 Yeet: PR to mergeable | complete | Publish work commits through yeet and drive the PR toward mergeable: required checks green, review comments answered and resolved. The packet's final merge-ready verdict is deliberately not taken here — it belongs to P4, after the closeout edits are published on the same PR. | Checks green and zero unresolved review threads on the latest work head. |
| P4 Close | complete | Land the closeout reflection and packet-state flip in the same PR as the final work (same-PR packet-state flips — never a post-merge follow-up), publish that closeout head through yeet, and take the packet's final gate on it. | `bun run beep yeet monitor` reports `merge-ready: yes` on the head that contains the reflection and status flip. |

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
4. Publish the closeout commit through yeet and run
   `bun run beep yeet monitor` until it reports `merge-ready: yes` on that
   head — the packet's final gate.

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
