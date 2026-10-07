# P11 — correspondents from the mail archives, bundle `2026-10-07-02`

Date: 2026-10-07. Decisions: SPEC D-25, D-26. Counts only; no client data.

## Build

Same private working root, salvage run, docket register, contacts table and
practice domains as `-04`, plus the corpus provenance message index of both
export trees (`--mail-index`, two files, 241,501 rows) and a re-extraction of
the working-files run with page-by-page OCR. Claims carried from `-04`. Build
time 8 min 37 s, 9.6 GB peak.

`verify.ts --compare-to <-04>`: ok — 15,003 nodes, 6,599 edges, 187 matters,
573 dockets, 4,524 correspondent rows over 169 matters, 0 correspondents
without a matter, 0 dangling edges, 0 unresolved references; 16 claims (14
with a source document). Matter-table diff: `lost: false`.

## `-04` -> `-05`

| | `-04` | `-05` |
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

Measured before deciding, on `-04`: following In-Reply-To and References from
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
alone. The PC was offline when the bundle was ready (overnight). A watcher
(`kg-swap-0702`, out of the repo) stages and self-checks the bundle when the PC
comes online, and switches `bundle_dir` and restarts Claude Desktop only
between 19:00 and 07:00, leaving `-04` in place if the self-check fails.

## Still out

19 files over 200 MB (wait for the next catalog refresh, D-26); USPTO
enrichment for the working-files run (the organizer manifest holds only the
June sources, D-26); participants known only by Exchange address; OCR models
for seven scripts; email attachments as documents.
