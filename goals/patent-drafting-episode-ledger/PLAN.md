# Patent Drafting Episode Ledger Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Contract and fixture audit | pending | Confirm live emitters, sibling seams, row ordering, and canonical event ordering. | Provisional arms and deterministic fixture order are explicit; no sibling amendment is required. |
| P1 Ledger and promotion slice | pending | Implement the event union/fold, support closures, law-side refusal, annex, projection, and fallback. | The first vertical slice satisfies the SPEC. |
| P2 Verify | pending | Run focused schema, behavior, replay, and rebuild proofs. | Acceptance evidence is green or blockers are recorded. |
| P3 Yeet: PR to mergeable | pending | Publish through Yeet and resolve hosted checks/review. | PR is merge-ready with zero unresolved threads. |
| P4 Close | pending | Record evidence/reflection and close the packet. | Receipts, status, and reflection are current. |

## P4 Closeout Checklist

Write a reflection under `history/reflections/`, run the packet’s required
verification, update packet evidence/status, and close only after the Yeet
completion gate is satisfied.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep the exploration as the decision/provenance authority.
- Do not pull the public-USPTO benchmark into this goal.

## Verification Commands

```sh
test "$(wc -m < goals/patent-drafting-episode-ledger/GOAL.md)" -le 4000
jq . goals/patent-drafting-episode-ledger/ops/manifest.json
rg -n "patent-drafting-episode-ledger|GOAL.md|agentLaunchers|packetAnchorDocument" goals/patent-drafting-episode-ledger
git diff --check -- goals/patent-drafting-episode-ledger
```
