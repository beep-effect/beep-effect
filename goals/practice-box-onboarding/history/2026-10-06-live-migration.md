# Inventory, map, and live migration

Date: 2026-10-06

Sanitized receipt. No tenant id, client or matter name, file name, principal,
or full digest appears here. The inventory, map, plans, receipts, journals,
and the attorney's spot-check sheet are private files under the corpus home's
`ops/box-onboarding/` directory, mode 0600.

## Inventory

Source: the corpus home's deduplicated `organized/` projection, one file per
distinct SHA-256.

| Category | Files |
| --- | --- |
| Docket files | 643 |
| Unsorted files | 3,055 |
| Client files | 81 |
| Candidates | 3,779 |
| Excluded (system and pipeline files) | 7 |
| Mapped | 3,772 (2.07 GB) |

Every mapped source exists with the catalogued size and SHA-256 (0 missing,
0 size mismatches, 0 hash mismatches). Mail exports, mail archives, and
recycle-bin metadata were not candidates.

Not inventoried: an 85 GB salvage payload that was never extracted, and
OneDrive or SharePoint from the workstation. A read-only inventory run on the
attorney's PC found 23 local-only documents and 145 cloud-only OneDrive
placeholders; they are not in this migration.

## Map

Matter identity is the practice KG's `family_key` (matter-lookup contract,
bundle version 2026-10-06-01): 170 matters over 105 bare family numbers.

| Destination | Matters or folders | Files |
| --- | --- | --- |
| Client folders, by client number | 28 clients, 139 matters, full 19-folder template each | 847 |
| Holding: dockets to be confirmed | 31 matters with no client number, a recycled number, or an ambiguous owner | 147 |
| Holding: unattributed, laid out as on the old drive | | 2,778 |

Placement of the 847 matter files: 261 prosecution, 228 drafting, 208 foreign
and PCT, 17 filing and formalities, 4 engagement, 129 loose in the matter
folder (no type rule matched, or correspondence). 351 of them were unsorted
files attributed by a docket reference in their text; the rest came from
docket folders.

Destination names: 0 collisions; 34 names adjusted for Box Drive on Windows;
invisible direction marks stripped from 4 names after Box rejected them.

## Folder skeleton (provisioning reconciler)

Two reviewed-plan applies, each preceded by a repeated identical dry-run:
8 folders on 2026-10-05 and 28 client-number folders on 2026-10-06. Both:
0 destructive actions, 0 declared external collaborators, the two
`BlockedByEntitlement` rows unchanged, post-apply verdict all-`Noop`.

## Content migration (`BoxContentMigration`)

Every apply was preceded by a dry-run run twice with identical plan digests.

| Run | Folders created | Files uploaded | Skipped identical | Failed | Provider calls | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Holding, first pass | 18 | 2,320 | 0 | 1 (HTTP 400) | 2,536 | incomplete |
| Holding, resume plus held dockets | 112 | 603 | 2,320 | 2 (HTTP 400) | 873 | incomplete |
| Holding, after the name fix | 0 | 2 | 2,923 | 0 | 270 | complete |
| Matters | 2,747 | 845 | 0 | 2 (HTTP 400) | 4,453 | incomplete |
| Matters, after the name fix | 0 | 2 | 845 | 0 | 1,658 | complete |

- Final state: 2,925 holding files and 847 matter files, 3,772 in total, each
  reported by Box with a SHA-1 equal to the local file's.
- Resumability held on the live tenant: each resume plan classified every
  previously uploaded file as identical and uploaded nothing twice. No
  `BlockedNameConflict` appeared in any plan.
- The four failures were two files in each scope whose names carried an
  invisible left-to-right mark. Box answers HTTP 400 for them. The map
  builder now strips those characters.
- Sources after the last apply: all 3,772 re-hashed, 0 changes.
- Provider calls: 9,790 across the five applies, plus about 2,000 for the
  dry-runs. That is above the 6,000 to 8,000 first estimated, because a plan
  over an existing tree lists every existing destination folder (828 calls
  for the matter tree) and each dry-run plans twice.

## Access

The attorney's 29 collaborations (28 client folders and the holding folder)
were created after the upload verified: 29 created, 0 failed, all declared
internal. They were created with one call each rather than through the
reconciler; see `SPEC.md` D18 and `research/OPPORTUNITIES.md`.

## Not done here

- Box Drive verification on the attorney's PC and placing the how-to page:
  the orchestrator is directing a session on that PC with the checklist.
- The attorney's answers to the spot-check sheet (client names for 28 client
  numbers, the client for 31 matters, 15 sampled placements, 5 questions).
