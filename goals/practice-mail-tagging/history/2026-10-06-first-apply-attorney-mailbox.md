# First live apply on the attorney's mailbox

Run on 2026-10-06, unattended, on the operator's ruling relayed by the
orchestrator, after the IT-mailbox proof
([record](2026-10-06-first-apply-it-mailbox.md)). Code: `main` at 9e95b9a6e8.
Window: mail received since 2026-10-01. Categories only: folder map `[]`
(filing off), no contact overlay. Counts only; no message, address, subject,
or matter key is recorded. No undo drill on his real tags; undo stays
available by run id.

| Step | Run | Result |
| --- | --- | --- |
| Dry-run since 2026-10-01 | | 150 scanned; 25 matched across 7 matters (largest 8); 2 needs-attorney; 0 ambiguous; 0 below threshold; 123 no signal |
| Gate | | review share 1.3% (< 10%); no matter above 5% of the window → proceed |
| Apply, same window | tag-20261006T215609404Z | 25 `M:` categories on 25 messages, 7 matter names created, 2 `P: Unmatched - review`; 27 ledger lines; no errors |
| Report | | tagged 27, processed 150, checkpoint at the newest message of the day |

50 attachments on matched messages were skipped as `sender-not-routable`
(no overlay; filing was off in any case).

The checkpoint now stands at today. Mail from 2026-07-01 to 2026-09-30 is not
tagged; backfilling it needs a pass from a separate state directory with
`--since 2026-07-01`, sharing nothing with the live checkpoint. That is the
next decision for the orchestrator.
