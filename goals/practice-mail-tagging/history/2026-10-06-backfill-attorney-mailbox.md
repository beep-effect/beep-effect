# Backfill of the attorney's mailbox since 2026-07-01

Run on 2026-10-06, unattended, on the orchestrator's ruling (D-44, D-45), from
a separate state directory with its own ledger and checkpoint, so it shares
nothing with the live run. Code: `main` at 9e95b9a6e8. Counts only.

| Step | Run | Result |
| --- | --- | --- |
| Dry-run, `--since 2026-07-01`, filing off | | 1,813 scanned; 325 matched across 27 matters; would add 300 `M:` tags (the 25 October tags already present); largest matter 57/1,813 = 3.1%; review 26/1,813 = 1.4% (ambiguous 3, needs attorney 23); below threshold 0 |
| Gate (review under ~10%, no matter swallowing the window) | | passed |
| Apply, categories and filing with the real folder map | tag-20261006T215903382Z | 300 `M:` tags, 20 `P: USPTO`, 24 `P: Unmatched - review`; attachments filed 0, deduplicated 0, reconciled 0, not routable 566; 0 Box calls (so no line in the shared call ledger); 0 errors |

Mailbox after both runs: 325 matter-tagged messages across 27 matters, 26
flagged for review, 20 `P: USPTO`. Each run is undone by its own id from its
own state directory. No attachment was routable: none of the matched
USPTO-sender messages carried a file, and client senders need contact
evidence (D-46).
