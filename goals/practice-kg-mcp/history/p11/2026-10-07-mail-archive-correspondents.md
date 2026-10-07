# P11 — correspondents from the mail archives, bundles `2026-10-07-02` to `2026-10-07-04`

Date: 2026-10-07. Decisions: SPEC D-25, D-26, D-27. Counts only; no client data.
Bundles are named by their full version here. The bundle before this phase is
`2026-10-07-01`; this phase built `2026-10-07-02`, then `2026-10-07-03` and
`2026-10-07-04` (the section on rebuilds). The current bundle is
`2026-10-07-04`.

## Build

Same private working root, salvage run, docket register, contacts table and
practice domains as `2026-10-07-01`, plus the corpus provenance message index
of both
export trees (`--mail-index`, two files, 241,501 rows) and a re-extraction of
the working-files run with page-by-page OCR. Claims carried from
`2026-10-07-01`. Build
time 8 min 37 s, 9.6 GB peak.

`verify.ts --compare-to` against `2026-10-07-01`, on `2026-10-07-02`: ok —
15,003 nodes, 6,599 edges, 187 matters,
573 dockets, 4,524 correspondent rows over 169 matters, 0 correspondents
without a matter, 0 dangling edges, 0 unresolved references; 16 claims (14
with a source document). Matter-table diff: `lost: false`.

## `2026-10-07-01` -> `2026-10-07-02`

| | `2026-10-07-01` | `2026-10-07-02` |
| --- | --- | --- |
| Matters / dockets | 187 / 572 | 187 / 573 |
| Matters or dockets removed; numbers withdrawn | — | 0; 0 |
| Documents with text | 11,902 | 12,061 |
| Correspondent rows | 605 | 4,524 |
| Matters with a correspondent / with a client | 23 / 21 | 169 / 152 |
| Distinct addresses / not the practice's own | 211 / 192 | 769 / 718 |
| Rows on the practice's own addresses | 127 | 1,278 |
| Rows whose address belongs to a contact | 96 | 862 |
| Contact addresses that appear as correspondents | 15 of 562 | 54 of 562 |

The added docket comes from newly readable OCR text. No application or patent
number moved. `unique` correspondent answers depend only on the contacts
table, which did not change, so no `unique` answer changed.

## Mail index (D-26)

| | |
| --- | --- |
| Index rows (July export / 2026-07 refresh) | 118,771 / 122,730 |
| Distinct messages (one Message-ID, else tree and path) | 238,158 |
| Placed on one matter by the subject line | 16,427 |
| Subject naming several matters (left out) | 728 |
| Subject with no reference | 210,222 |
| Placed but with no usable address | 1,538 |
| Exchange-only addresses dropped from placed messages | 7,230 |

Measured before deciding, on `2026-10-07-01`: following In-Reply-To and
References from
a placed message would add 136 messages, and no index row carries a
conversation index, so neither is used.

## Coverage per matter

Not counting the practice's own addresses: 2 matters have only practice
addresses, 70 have 1 to 4 outside addresses, 40 have 5 to 19, 57 have 20 or
more (median 7, most 90). Of the 718 outside addresses, 385 write about one
matter, 213 about two to five, 120 about more than five (most 75, foreign
associates and the previous firm). 18 of the 187 matters still have no
correspondent; their mail, if any, never names a docket in its subject.

## OCR re-extraction

All 7,640 sources of the working-files run were extracted again with `--ocr`
(2 h 36 min at concurrency 8): 6,385 succeeded (6,380 before), 296 sources were
read page by page (2,034 pages, 0 failed), 1,248 still have no engine (CAD,
archives, video, installers). Tesseract has no models for Arabic, Greek,
Hebrew, Hindi, Japanese, Korean and Russian on this workstation; pages in
those scripts were read with the available models only.

## Attorney's PC

Extension 0.4.0 and store format 4 are unchanged, so the swap is the bundle
alone. The PC was offline when the first bundle was ready (overnight). A
watcher (out of the repo) stages the bundle when the PC is online, and switches
`bundle_dir` and restarts Claude Desktop only between 19:00 and 07:00, after a
self-check, leaving `2026-10-07-01` in place if the self-check fails.

`2026-10-07-04` is staged on the PC and passes `--self-check` there (ok,
15,003 nodes, 187 matters, 11 tools), run against the staged folder while
Claude Desktop kept running on `2026-10-07-01`. The first staged copy failed
that check: the zip had been written file by file and left out the graph
store's empty directories, without which it does not open (7 directories on
the PC against 17). The packaging now writes directory entries, and a zip is
extracted and self-checked on the workstation before it is sent.

## Rebuilds as `2026-10-07-03` and `2026-10-07-04` (D-27)

Review of the P11 change found counting defects, fixed the same day in two
steps. `2026-10-07-03`: a message the attorney filed that also sits in an
archive was
tallied twice, and an archive item without a `Message-ID` present in both
export trees was two messages. `2026-10-07-04`: the filed mail's `Message-ID`
header is
now found whatever case its name is written in (16 of the 1,886 filed mails
write `Message-Id`), and the fallback key for an item without a `Message-ID`
also carries its RFC 5322 addresses, so two items that share a time and
subject but differ in a participant stay apart (no such pair exists in this
index; the counts of the pass did not move).

| | `2026-10-07-02` | `2026-10-07-03` | `2026-10-07-04` |
| --- | --- | --- | --- |
| Distinct archive messages | 238,158 | 237,475 | 237,475 |
| Placed on one matter / ambiguous | 16,427 / 728 | 16,370 / 719 | 16,370 / 719 |
| Correspondent rows / matters | 4,524 / 169 | 4,524 / 169 | 4,524 / 169 |
| Sum of message counts over all rows | 70,989 | 67,315 | 67,289 |

The same matter-address pairs remain throughout. Against `2026-10-07-02`, 436
rows on 28 matters carry a lower, correct message count in `2026-10-07-04`;
against `2026-10-07-03`, 10 rows on 2 matters. `verify.ts --compare-to` on
`2026-10-07-04`: ok and `lost: false` against `2026-10-07-03` (no difference
in the matter tables) and against `2026-10-07-01` (one docket added). Claims
carried (16). Neither `2026-10-07-02` nor `2026-10-07-03` was installed on
the PC; the watcher now stages `2026-10-07-04`. A built
bundle is never rebuilt under its own version, so each correction took a new
one.

A second review round then made the fallback key carry each MAPI recipient's
role and the `Message-ID` read take the first non-empty value of a list. On
this corpus that separates two archive messages, neither with a docket
reference (237,477 distinct), and no filed mail has a list-valued id. A
scratch build with that code is row for row identical to `2026-10-07-04` in
`matters`, `matter_dockets`, `matter_correspondents`, `contact_client_links`
and `contact_addresses`, so `2026-10-07-04` stands.

## Still out

19 files over 200 MB (wait for the next catalog refresh, D-26); USPTO
enrichment for the working-files run (the organizer manifest holds only the
June sources, D-26); participants known only by Exchange address; OCR models
for seven scripts; email attachments as documents.
