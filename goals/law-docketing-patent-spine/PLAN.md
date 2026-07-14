# Law Docketing Patent Spine Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Refresh the governing legal authorities and their effective dates; derive the attorney-reviewable office-action, maintenance-fee, and exceptional-date rule fixtures; confirm the ODP office-action and optional e-Office Action ingestion paths. Treat external heartbeat vendor selection as owned by `law-docketing-reliability`, not this packet. | The authority ledger and bounded fixture set are freshness-dated; ODP/e-OA path facts and gaps are recorded; the lifecycle/records contract needed by reliability is explicit. |
| P1 Implement | pending | Build the smallest schema-first US Patent Office-Action Approval Spine: evidenced intake, versioned rules, candidate comparison, attorney approvals, durable records, reconciliation, one-way Outlook scheduling, and sequential ODP polling. | The office-action, maintenance-fee, and exceptional-date fixtures traverse the complete approved lifecycle and persist across restart; disagreement escalates and no unapproved date becomes operative. |
| P2 Verify | pending | Exercise the fixture, restart, provenance, escalation, approval, reconciliation, Outlook, T-ladder, and sequential-polling proof matrix; consume the sibling reliability packet's kill-app alert and recovery evidence. | All SPEC acceptance criteria are green, including paired reliability acceptance, or blockers are archived with reproducible evidence. |
| P3 Close | pending | Run repo proof, prepare and drive the PR to mergeable through Yeet, write the closeout reflection, and synchronize packet evidence/status. | Yeet/GitHub reports the PR mergeable; a schema-valid reflection exists; README, PLAN, and manifest state match the evidence. |

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained` / `complete`):

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`, covering tooling,
   implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` with final evidence.
4. Confirm the paired reliability proof and Yeet/GitHub mergeability evidence.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Narrow supported rules rather than weakening provenance, approval,
  reconciliation, exceptional-case, or dead-man guarantees.
- Do not perform the CPI/LawToolBox commercial-access evaluation in P0. The CPI
  trigger fires only after handroll v1 lands; LawToolBox belongs to court work.
- Archive authority refreshes, fixture inventories, and verification output
  under `history/` without credentials or sensitive matter content.

## Verification Commands

```sh
test "$(wc -m < goals/law-docketing-patent-spine/GOAL.md)" -le 4000
jq . goals/law-docketing-patent-spine/ops/manifest.json
rg -n "law-docketing-patent-spine|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-docketing-patent-spine
git diff --check -- goals/law-docketing-patent-spine
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
