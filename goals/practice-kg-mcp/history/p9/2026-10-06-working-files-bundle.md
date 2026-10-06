# P9 — working-files bundle `2026-10-06-02`

Date: 2026-10-06. Decisions: SPEC D-18 to D-22. Counts only; no client data.

## Pipeline run

| Stage | Result |
| --- | --- |
| Landing copy | 8,256 files, 32 GB, 0 hash mismatches (verified by the orchestrator session) |
| Salvage, run `2026-10-tom-pc`, source `source-b`, `--dedupe` | 8,237 records: 6,610 copied (17 GB), 1,627 already known |
| Held out of salvage | 19 files over 200 MB (8 zip, 6 CAD, 4 video, 1 zip of 5.5 GB); 14 GB |
| Catalog (private working root) | 25,011 source rows; distinct digests 7,342 -> 13,952 |
| Extract, concurrency 16, 46 min | 7,640 sources: 4,405 succeeded (4,250 text artifacts), 3,235 failed |
| USPTO enrichment | not re-run (D-22) |
| Build | `--include-run 2026-10-tom-pc --docket-register <jsonl>` |
| Claims carry | 16 claims, 16 evidence, 14 with source document |
| Verify | ok; 0 dangling edges; 0 unresolved references |

Extraction failures: 3,138 "no engine" (1,605 `.eml`, 285 `.msg`, the rest
CAD, Illustrator, video, archives, backups), 94 PDF timeouts, 2 Tika driver
failures, 1 pffexport failure. Tesseract crashed 3 times in its JPEG 2000
decoder; Tika returns those pages empty.

## Bundle, old -> new

| | `2026-10-06-01` | `2026-10-06-02` |
| --- | --- | --- |
| Documents | 7,330 | 13,940 |
| Nodes | 8,240 | 15,002 |
| Edges | 1,756 | 6,579 |
| Matters | 170 | 187 |
| Matters with a client | 143 | 160 |
| Dockets | 438 | 572 |
| Store format (pglite / duckdb) | 2 / 2 | 3 / 3 |

Matter lookup on the attorney's folder paths: of the files whose path gives a
client and a docket, 4,874 resolve to one safe matter and 1 does not (36 of 37
client-keyed families; 17 of 37 against the old bundle). 3,381 files have no
client and docket in the path.

## What changed for consumers of the old bundle

- No client-keyed matter disappeared and no matter changed client.
- One bare family became client-keyed.
- Two client-keyed matters lost documents (6 -> 1 and 3 -> 1), and 6 dockets
  under them returned to unattributed. Those documents had been attributed by
  family consensus; the working folders show the family number is shared by
  several clients, so the build no longer guesses.

## Defect caught before hand-off

The first build put the docket register first in attribution. Six client-keyed
matters of the old bundle disappeared: bare docket numbers are reused across
clients and the register lists only current dockets, so older documents were
moved to the register's client against their own text. The register now applies
last, only to a family with no client evidence (D-21); a regression test covers
it. The comparison that caught it: diff `matters` and `matter_dockets` between
the old and new bundle before announcing a build.

## Known gaps

- Loose email files (1,890) are not extracted; fill-in needs the extractor to
  route `.eml` and `.msg` to Tika, then one full re-extract and a rebuild.
- 19 oversize files are held out until salvage hashes by streaming.
- 94 PDFs timed out; pages hit by the Tesseract crashes have no text.

## Fill-in bundle `2026-10-06-03`

Built after the corpus tooling gained `.eml` / `.msg` extraction, a resumable
extractor and a per-source Tika timeout. Same salvage run and catalog; one full
re-extract (93 min at concurrency 16, 15-minute Tika timeout), then a rebuild
with `--bundle-version 2026-10-06-03`, claims carried from `-02`.

| | `-02` | `-03` |
| --- | --- | --- |
| Extraction: succeeded / text artifacts | 4,405 / 4,250 | 6,380 / 6,225 |
| Emails with text | 0 | 1,886 of 1,890 |
| PDF timeouts | 94 | 8 |
| Documents with text in the bundle | 9,927 | 11,902 |
| Documents | 13,940 | 13,940 |
| Matters / with a client | 187 / 159 | 187 / 159 |
| Dockets | 572 | 572 |
| Edges | 6,579 | 6,574 |
| Documents reporting the base run | 6,301 | 7,330 |

Verify: ok, 0 dangling edges, 0 unresolved references; 16 claims, 14 with a
source document. Self-check on the built bundle: `ok`, 15,002 nodes, 187
matters, 10 tools. Against `-02`: no matter or docket added or dropped, no
matter changed client; one document moved from a bare family to a keyed one.

Correction to the `-02` table above: matters with a client were 159, not 160.

### Defect in `-02` fixed here

A document the organizer had already placed reported the working-files run, and
that copy's size and date, whenever the same file also sat in the working
folders (1,029 documents). Matter, docket and client were never affected. In
`-03` such a document keeps its base run, size and date; `source_origin_chain`
lists every run and path the file appears in and is the column to read for
"which runs hold this file". Found by the Box workstream's dry run.

### Consumer notes for `-02` -> `-03`

- Matters, dockets and clients are unchanged; no re-mapping is needed for them.
- `run_label` on about a thousand documents returns to `base`. Do not filter on
  `run_label` to mean "came from the old drive only"; read `source_origin_chain`.
- 1,975 more documents have searchable text, 1,886 of them saved emails. Email
  attachments are not exported; an email's text and headers are.
- The Box workstream's map, built from `-02`, moves 48 files out of four
  existing matters, more than the two matters the matters table shows losing
  documents: Box also files unsorted old-drive documents by docket reference,
  and those follow the docket's owner. That is the same no-guessing rule seen
  from Box's side; the numbers are Box's.

### Known gap in `-03`: one application lost its matter

Comparing `matter_dockets.application_numbers` between `-02` and `-03` shows one
application number that was attached to all 9 dockets of one client-keyed matter
in `-02` and to none in `-03`. Enrichment is identical in both bundles. The
cause is the D-11 membership rule: an application is attached to a matter only
when every document mentioning its number sits in one client-keyed family, and a
document that became readable in `-03`, attributed to another family, cites it.
The application stays in the graph as a mention of both families.

This is the rule being brittle, not a correction: one outside citation outweighs
dozens of documents in the owning matter, so more text made the bundle less
useful there. Effects and handling:

- Looking the number up returns `none` where `-02` returned the matter. Docket
  intake routes a `none` on an application that has mentions to review, with the
  citing matters as candidates.
- The Box folder-name builder joins dockets to enrichment for the invention
  title and finds none. Box keeps the title it already has; a title is never
  blanked or changed because a newer bundle has no application for a matter.
- The next bundle replaces "every mention in one family" with a dominance rule
  (file-name evidence and a clear majority of mentioning documents, weaker cases
  labelled), with its own decision-log entry and measured distributions.

Process change: before announcing a bundle, diff each docket's application and
patent numbers against the previous bundle, not only the matter and docket keys.
The Box workstream found this one.

### Still out of the bundle

19 files over 200 MB (archives, CAD, video); 8 PDFs that time out; pages where
Tesseract crashes in its JPEG 2000 decoder; USPTO enrichment for the new run.
