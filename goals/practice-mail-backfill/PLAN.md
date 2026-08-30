# Practice Mail Backfill Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | CSP/New Commerce quote for the EOP2 seat (term, cancellation); dry-run license assignment beside Business Premium; open the >100 GB support case; census the source PSTs (counts/sizes/nesting only). | Quote, dry-run, and case-number evidence in `history/`; PST census recorded without client-identifying names. |
| P1 Implement | pending | Author the goal-local runbook instance from r2 (staging form chosen per the nesting census, mapping-CSV pairing, tranche plan); assign the seat; enable archive + auto-expansion. | Runbook complete; seat active; archive enabled. |
| P2 Verify | pending | Prerequisite before any tranche upload: the preservation gate of `goals/oppold-corpus-salvage-restoration` has passed for the mail media, and the staging manifest derives from the preserved estate's verified census — never from ad-hoc copies. Then execute tranche 1 operator-attended; reconcile counts against that staged manifest; verify Outlook search with the attorney; gate tranches 2/3 on the support-case verdict. | Preservation-gate evidence linked; tranche-1 reconciliation + search evidence in `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish the packet's runbook/evidence updates through yeet and drive the PR to mergeable. On the packet's final work PR, the P4 closeout edits are committed before this phase's publish, so the merge-ready verdict binds the head that actually merges. | `bun run beep yeet monitor` reports `merge-ready: yes` (the aggregate hard gate); zero unresolved review threads. |
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

- Every tenant mutation (license assignment, archive enablement, import job)
  is operator-attended; agent sessions prepare, verify, and record.
- Retention hold stays ON at close; releasing it is a different decision and
  a different packet.
- Mapping CSVs and PST inventories live outside the repo; `history/` carries
  counts, hashes, tranche ids, and job status only.

## Verification Commands

```sh
test "$(wc -m < goals/practice-mail-backfill/GOAL.md)" -le 4000
jq . goals/practice-mail-backfill/ops/manifest.json
rg -n "practice-mail-backfill|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-mail-backfill
git diff --check -- goals/practice-mail-backfill
```
