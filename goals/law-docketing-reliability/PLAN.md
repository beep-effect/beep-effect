# Law Docketing Reliability Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Consume the patent spine lifecycle/records contract; refresh ODP rate/cadence facts; select an external heartbeat vendor/path whose alert remains operational with the app and desktop off; define the acceptance harness and bounded-recovery evidence. | Dependency contract, monitor independence, alert channel, operational assumptions, costs/credentials, and the kill/restore proof procedure are recorded without weakening the 20-minute staleness requirement. |
| P1 Implement | pending | Add sequential 15-minute polling/reconciliation heartbeats, the T-90/30/14/7/3/1 acknowledgment ladder, independent alerts, durable cursor state, bounded backfill, reconciliation, and attorney-visible recovery reporting. | The reliability flow composes the spine records without owning legal computation; failures and acknowledgments are auditable; recovery resumes the external heartbeat only after reconciliation proof. |
| P2 Verify | pending | Exercise cadence, staleness, ladder/repeats, complete-daily-sweep, kill-app alert, bounded backfill, Outlook/open-deadline reconciliation, recovery report, and resumed-heartbeat tests. | The app can be killed while the independent alert still arrives; restoration produces complete recovery evidence; all SPEC acceptance criteria are green or blockers are archived. |
| P3 Close | pending | Run repo proof, prepare and drive the PR to mergeable through Yeet, write the closeout reflection, and synchronize packet evidence/status. | Yeet/GitHub reports the PR mergeable; a schema-valid reflection exists; README, PLAN, and manifest state match the evidence. |

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained` / `complete`):

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`, covering tooling,
   implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` with final evidence.
4. Confirm kill-app alert/recovery proof and Yeet/GitHub mergeability evidence.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Monitoring inside the app, desktop, or a shared failure domain is not an
  acceptable substitute for the independent dead-man path.
- Do not broaden into legal computation or later jurisdiction packets.
- Archive monitor-selection and verification evidence without secrets, tokens,
  client matter content, or raw notification credentials.

## Verification Commands

```sh
test "$(wc -m < goals/law-docketing-reliability/GOAL.md)" -le 4000
jq . goals/law-docketing-reliability/ops/manifest.json
rg -n "law-docketing-reliability|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-docketing-reliability
git diff --check -- goals/law-docketing-reliability
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
