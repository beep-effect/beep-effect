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
