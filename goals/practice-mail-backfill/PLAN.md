# Practice Mail Backfill Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | CSP/New Commerce quote for the EOP2 seat (term, cancellation); dry-run license assignment beside Business Premium; open the >100 GB support case; census the source PSTs (counts/sizes/nesting only). | Quote, dry-run, and case-number evidence in `history/`; PST census recorded without client-identifying names. |
| P1 Implement | pending | Author the goal-local runbook instance from r2 (staging form chosen per the nesting census, mapping-CSV pairing, tranche plan); assign the seat; enable archive + auto-expansion. | Runbook complete; seat active; archive enabled. |
| P2 Verify | pending | Execute tranche 1 operator-attended; reconcile counts against the staged manifest; verify Outlook search with the attorney; gate tranches 2/3 on the support-case verdict. | Tranche-1 reconciliation + search evidence in `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish the packet's runbook/evidence updates through yeet and drive the PR to mergeable. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

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
