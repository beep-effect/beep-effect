# First live apply and undo drill (operator's IT mailbox)

Run on 2026-10-06, unattended, on the operator's instruction, against his own
IT mailbox (not the attorney's) through the app-only registration after its
Exchange scope was widened to admit that mailbox. Code: `main` at 9e95b9a6e8.
Categories only: folder map `[]` (filing off, D-42), no contact overlay, no
seeded mail. Counts only; no message, address, or subject is recorded.

| Step | Run | Result |
| --- | --- | --- |
| Access probe (dry-run, 1 page) | | 50 scanned, no 403 |
| Dry-run, whole mailbox since 2026-07-01 | | 3,676 scanned, 0 matched, would add `P: USPTO` ×5 |
| Bounded apply, `--max-pages 2` | tag-20261006T214119204Z | 100 scanned, no message written; six `P:` names created; checkpoint saved |
| Apply resumed from the checkpoint | tag-20261006T214152558Z | 3,577 scanned, `P: USPTO` written on 5 messages, 5 ledger lines |
| Undo, dry-run | | 5 entries, 5 would be restored |
| Undo | | 5 messages restored, 5 categories removed, 0 missing |
| Report after undo | | tagged 0, undone 5 |
| Fresh-state dry-run (independent check) | | proposes `P: USPTO` ×5 again: the categories are gone server-side |

The bounded slice held none of the taggable mail, so the apply was resumed
from its checkpoint to prove a message write; the extra scope was exactly the
five category adds, all undone.

Exercised: Graph read and paging, Deleted Items / Junk exclusion, master
category creation, ledger-first category write with the change key,
checkpoint, undo read-modify-write. Not exercised (no input in this mailbox):
`M:` matter categories, conversation carryover, the review category, the 412
stale-write retry, attachment filing. The six `P:` names remain in the
mailbox's category list; undo never deletes category names.
