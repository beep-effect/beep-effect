# Online contacts dry run

Run `seed-6324a4ae-185b-44c6-a60b-39b2daa61bf2` read every contact folder and the four byte-identical CSV
inputs. VCF was not supplied. The pre-seed export contains 536 contacts
with sha256 prefix `7942bb0ee834`; SPEC records the full hash.

| Plan tag | Count |
| --- | --- |
| Create | 0 |
| SkipExistsInMailbox | 480 |
| SkipAlreadySeeded | 0 |
| Conflict | 0 |
| SkipUnidentifiable | 7 |
| Untracked tagged | 0 |

No PATCH or DELETE is planned. No contact or folder write has run.
All 480 identifiable source contacts match pre-existing mailbox contacts.
Main's `ContactSeeding.apply` returns before folder discovery and journal
persistence when Create is zero (`Contacts.service.ts`, the empty-creates
branch). A subsequent `undo --run` requires a matching journal and rejects
missing state. This branch therefore cannot produce the required dedicated
folder and per-run rollback evidence for this zero-create mailbox state.

Stop under the live-defect rule before smoke or apply. A reviewed fix must
handle a zero-create receipt and its rollback semantics; the goal's dedicated
folder criterion must be reconciled with mailbox-wide duplicate avoidance.
Existing contacts must remain untouched, and no live retry runs unreviewed code.


## Run 5 — authorized zero-create repair verification

Read-only CSV-only online plan passed: run
`seed-b5aae0b5-5df1-474e-9ce3-9954a22f0661`.
Create 0; SkipExistsInMailbox 480; SkipAlreadySeeded 0; Conflict 0;
SkipUnidentifiable 7; untrackedTagged 0. No PATCH or DELETE planned.
The Run 4 ruling accepts all 480 mailbox-wide matches; the bounded repair
must persist this no-op run and prove its per-run undo without mailbox changes.
