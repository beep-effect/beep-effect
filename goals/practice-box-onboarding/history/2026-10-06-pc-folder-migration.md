# Live practice folder migration

Date: 2026-10-06

Sanitized receipt. No client, matter, folder, or file name, no principal, and
no full digest appears here. The inventory, map, linking records, plans,
receipt, journal, and file-id table are private files under the corpus home.

## Source

The attorney's live practice folder on his PC, pulled over the tailnet by the
orchestrator into the corpus home's `incoming/` area with a hashed inventory
(path, size, modified time, SHA-256, attributes; one row per empty directory).

| | Files | Size |
| --- | --- | --- |
| Whole folder on the PC | 1,529,428 | 383 GB |
| Excluded before the pull (a copy of the salvage corpus, tooling, a secrets file) | 1,521,172 | 349 GB |
| Pulled and inventoried | 8,256 | 34.0 GB |
| Mapped and uploaded | 6,383 | 19.8 GB |
| Temp and backup files, not uploaded | 251 | 1.8 GB |
| One file over Box's 5 GB per-file limit, held out | 1 | 5.55 GB |
| Awaiting the attorney's answer (two non-client folders, three small folders, loose files) | 1,621 | 6.8 GB |

Not OneDrive-backed; no cloud placeholders. Every pulled file was hashed on
the workstation against the inventory before any upload.

## Map

His layout is mirrored exactly: `<Box client folder>/<his matter folder>/<his
subfolders>/...`. Nothing is renamed or regrouped (`SPEC.md` D19, D20).

- 25 client directories: 8 mapped onto existing Box client folders by client
  number, 17 new client folders (4 with a client number, 13 named as he named
  them).
- 214 matter directories (6 empty), each with a private linking record:
  client number, his own matter number, dockets, KG matter key or null, and
  whether the KG bundle knows it. 141 carry a docket and a client number and
  resolve to 26 distinct KG matter keys (11 safe in the bundle, 2 flagged,
  13 not yet in it); 73 have no docket in the folder name.
- 114 of the 6,383 files are byte-identical to files from the first
  migration. They were uploaded again at their live location so the mirror
  has no holes (`SPEC.md` D21).
- 5 names adjusted for case-insensitive collisions.

## Content migration

| Run | Folders created | Files uploaded | Skipped identical | Failed | Provider calls | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Apply, killed by a desktop-app crash | 756 | 2,258 | 0 | 0 | about 3,100 | no receipt |
| Resume dry-run, gate stopped | 0 | 0 | | | 1,516 | plans differed |
| Resume apply | 0 | 4,125 | 2,258 | 0 | 6,685 | complete |

- Final state: 6,383 files, each reported by Box with a SHA-1 equal to the
  local file's; post-apply plan is 766 existing folders and 6,383 identical
  files. No name conflict, no HTTP 429.
- The crash killed the apply mid-run with four uploads in flight. All four
  had completed; the resume plan classified 2,258 files as identical and
  uploaded none of them twice.
- The first resume stopped at its own gate because another session moved
  large files out of the source directory between the two plans. The source
  was replaced by a stable hard-link view and the gate then passed.
- Access: 18 collaborations created for the attorney (17 new client folders
  and the firm administration folder), all internal, 0 failed.

## API allowance

The plan publishes 50,000 calls a month and the admin console shows no usage
view, so a private month-to-date ledger is the meter. This workstream:
26,982 calls across both migrations, against a 40,000 ceiling agreed with the
orchestrator. A plan over an existing tree costs one listing per existing
folder (758 here), so each resume costs about 1,500 calls before it uploads
anything.

## Attorney review

A private, tailnet-only review page replaced the printed sheet: 103
questions, mostly one tap, answers saved as he goes and locked when he
finishes. No answers had arrived when this receipt was written.
