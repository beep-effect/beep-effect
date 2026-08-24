# Semantica Atlas Upgrade Report — Run 2

Date: 2026-08-24  
Target: `@beep/semantica` (`[notion: page @beep/semantica]`) in Todox

## Outcome

All requested writes with an existing catalog match succeeded. The run added one inline glossary
database with 61 rows, updated 23 catalog rows from 22 census items, and added 8 license notes.
No existing property, row, or body content was deleted or renamed.

## 1. Canary and glossary

- Canary: appended `## Glossary — Rosetta` after the Findings database and verified it by
  re-fetch before continuing.
- Created `Glossary — Rosetta` as one inline database directly below the heading.
- Added exactly the requested properties: `Term`, `Definition`, `Kind`, `Rosetta`, and `Source`.
- Imported all 61 seed rows; final SQL read-back returned 61 rows and 61 distinct terms.
- Moved each trailing file citation into `Source`; `Definition` contains the citation-free text.
- Preserved literal `tbd` values and omitted `Module Index link candidate` entirely.

## 2. Docs URLs

- Matched 22 of 29 census items to existing rows and updated 23 rows across 6 catalog databases.
  OpenAI accounts for two rows: embeddings and the LLM-provider row.
- Updates by catalog: Vector Store 7, Graph Store 4, Triplet Store 5, Embeddings 4,
  LLM Providers 1, Parse 2.
- Preferred 8 verified `llms.txt` URLs; used docs roots for the other 15 row updates.
- Final read-back returned exactly 23 non-empty `Docs URL` values in the inspected catalogs.

## 3. License notes

- Added 8 notes where `Beep counterpart` was confirmed empty: Pinecone, FalkorDB, Neo4j,
  Amazon Neptune, Blazegraph, Anzo, OpenAI embeddings, and OpenAI LLM provider.
- Notes use the census classification: `SSPL-1.0 — see census`, `GPL-3.0 — see census`,
  `GPL-2.0 — see census`, or `proprietary — see census`.
- Skipped because `Beep counterpart` was non-empty: 0.

## 4. Skips and failures

- No matching row; no row created: PGlite, unified/remark, eyereasoner (eye-js), N3.js,
  rdf-validate-shacl, shacl-engine, Dusa.
- Write failures: none.
- Approval-review timeouts: none.
- Error text: none.
