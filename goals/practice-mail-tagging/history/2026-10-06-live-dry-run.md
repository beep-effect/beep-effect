# Live dry-run over mail since 2026-07-01

Run on 2026-10-06 against the attorney's mailbox through the app-only
registration, from `fix/practice-mail-known-docs` (the code of #1511 on top of
#1495). Counts only; no message, address, subject, or matter key is recorded.

| Count | Value |
| --- | --- |
| Mode | `dry-run` (`wrote: false`) |
| Messages scanned | 1,802 |
| Matched to a matter | 323 (27 distinct matters) |
| Unmatched, no signal | 1,453 |
| Unmatched, ambiguous | 3 |
| Unmatched, needs attorney | 23 |
| Unmatched, below threshold | 0 |
| `P: USPTO` adds | 20 |
| `P: Unmatched - review` adds | 26 |
| Attachments filed | 0 |
| Attachments skipped, sender not routable | 562 |
| Box API calls | 0 (call ledger unchanged) |
| Wall time | 65 s |

Inputs: practice KG bundle `2026-10-06-03`, the Box folder-id map (158 matters)
and the known-files index (10,155 rows) from the onboarding run.

The first attempt stopped before reading mail: the known-files index records
files outside any matter folder with a null family key, which the decoder
rejected. Fixed in #1511 (SPEC D-40). No attachment is filed until the
attorney supplies the contact overlay: without it only USPTO senders route,
and none of the matched USPTO mail carried a file attachment.
