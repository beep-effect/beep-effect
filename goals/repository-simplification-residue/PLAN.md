# Repository simplification residue plan

Status: `in-progress`. Lifecycle: `active`.

## Phases

| Phase | Status | Exit evidence |
| --- | --- | --- |
| P0 Research and admission | complete | Fifteen contracts reconciled; one closeout PR admitted by the fleet orchestrator. |
| P1 Implement waves | complete | Fifteen closed source issues and merged implementation receipts. |
| P2 Verify program acceptance | complete | Exact-head acceptance reconciliation, fresh scans and current drift attribution. |
| P3 Yeet and merge | in-progress | Publish through Yeet, final-check, until-ready monitor, then orchestrator S11 gate. |
| P4 Close | in-progress | Validated reflection and proposed closeout in final work PR; verified adoption after merge in a packet-state PR. |

## Accepted work and evidence

All fifteen source acceptances, the canon final #2586 and the source-bound wave
receipts are mapped in
[the final reconciliation](history/receipts/2026-11-10-acceptance-reconciliation.md).
Its JSON companion records receipt hashes, exact source head, closed issue facts
and current inventory identities. The historical wave order and per-wave tests
remain in SPEC and history; no original receipt is rewritten by this closeout.

## Current drift boundary

The fresh source scan reports 533 findings, 15 open and 518 exceptions;
`introduced=0` is a ratchet result, not a zero-open result. Fifty-nine exception
reasons lack literal Owner/Exit clauses. The fleet orchestrator owns one separate
remediation lane for all of them, with source-PR attribution retained in the
reconciliation receipt. It includes harness-ledger, which was already open at
#2586's merge. No exception or baseline row is added by this closeout.

## Remaining executable steps

1. Validate the reflection, packet projections, references and docs formatting.
2. Publish the admitted closeout PR with `yeet publish` on this workstation.
3. Bind the PR number, `proposedCloseout`, and local Yeet verdict reference; send
   all follow-up commits through `yeet publish` too.
4. Run final-check on the pushed head, flip ready, and complete the until-ready
   monitor. Answer every actionable review thread and integrate main if needed.
5. Send `final <sha40> #N merge-ready: yes` to the fleet orchestrator; it owns
   the S11 merge gate. Nobody hand-merges this goal final before that line.
6. After merge, run `goals completion refresh --slug repository-simplification-residue`
   on this workstation. Only verified evidence permits status adoption.
7. Use `goals set-status` in a second packet-state PR, reconcile status prose and
   phases, merge that PR through the gate, and retire the lane canonically.

## Admission and recovery

The packet cap is six main-targeting open PRs, drafts included, and at most three
open PRs for this packet. The orchestrator's 2026-11-10 admission excludes the two
`queue-lab` sandbox PRs that never merge to main; five main-targeting PRs preceded
this closeout. Recount before publication. No new spend is authorized.

Revert the closeout documents to reverse this reconciliation. Implementation
recovery stays with the per-wave receipts. Native configuration, original patches,
identity maps, foreign checkouts and coverage floors are untouched. #1868 remains
an external measurement gate; children and synthetic sessions add zero.
