# Contacts seeding and rollback receipt — 2026-10-13

Run `seed-53844f79-97c0-461f-8ff6-5d7d14776d66`. Grant: attorney=True, other=False. Pre-seed export:
536 contacts, sha256 prefix `7942bb0ee834`; full hash is in SPEC.

The contacts-only smoke passed two tests, with two unrelated tests skipped.
It made exactly one synthetic contact POST and one DELETE of that contact;
M365_LIVE_WRITE was unset. No message read or calendar write ran.

| Apply outcome | Count |
| --- | --- |
| Created | 0 |
| Matched existing in mailbox | 480 |
| Already seeded | 0 |
| Conflict | 0 |
| Unidentifiable | 7 |
| Failed | 0 |
| Untracked tagged | 0 |

All 480 identifiable CSV contacts are resolvable mailbox-wide. No existing
contact was duplicated, patched or tagged. No dedicated folder was present;
zero-create apply created none, per the Run 4 ruling. No folder/contact POST,
PATCH or DELETE ran during apply. Category: `beep-practice-contacts-seed`.

Verification plan `seed-ad1d3c6e-cf8b-4b62-a978-0156bd9a7030`: Create 0, SkipExistsInMailbox 480,
SkipAlreadySeeded 0, Conflict 0, SkipUnidentifiable 7, untrackedTagged 0.

Rollback proof: `undo --run` dry-run, `undo --by-category` dry-run and the
Run 4 authorized `undo --run --yes` on the empty journal all passed:
deleted 0, edited 0, unverifiable 0, failed 0. The 0600 private journal has
zero contact entries, folderCreated false, the counts-only apply receipt and
its persisted no-op undo receipt. No folder was deleted. Private state and
export content remain outside the repository. Only the smoke mutated the
mailbox, and it cleaned up its own contact.

Reversal commands remain in runbook sections 3 and 4. The orchestrator removes
the contacts grant separately after PR 2 merges, preserving prior outbox grants.
