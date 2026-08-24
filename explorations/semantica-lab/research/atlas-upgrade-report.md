# Semantica Atlas Upgrade Report

Date: 2026-08-24  
Target: `@beep/semantica` (`[notion: page @beep/semantica]`) in Todox

## Outcome

All requested Notion changes succeeded. Final read-back found 34 upgraded original data sources,
215 catalog rows with `Kind`, 27 graded Module Index rows, exactly 13 parked rows, and 12 Findings
rows. No existing property, row, or body content was deleted or renamed.

## 1. Schema upgrade

- Canary: added `Kind` to Split — Chunking Strategies and verified it by re-fetch before
  continuing.
- Upgraded all 33 catalog data sources: 165 properties total, including the canary property.
- Every catalog now has `Kind`, `Maturity`, `Verdict`, `Beep counterpart`, and `Docs URL`;
  existing `name`, `description`, and `link` were unchanged.
- `Kind` is select: `driver`, `component`, `algorithm`, `strategy`, `model`, `surface`.
- `Maturity` is select: `solid`, `partial`, `stub`, `unknown`.
- `Verdict` is select: `adopt`, `adapt`, `already-have`, `park`, `drop`.
- `Beep counterpart` is rich text. `Docs URL` is URL.
- Module Index (`[notion: Module Index data source]`) gained two properties:
  `Maturity` with the same four options and `Target home` as select.
- `Target home` options: `domain`, `use-cases`, `server`, `client`, `ui`, `tables`,
  `drivers`, `foundation`, `tooling`, `drop`, `tbd`.
- Re-fetched and verified all 34 data sources before row writes.

## 2. Kind fill

- Updated all 213 original rows, plus set `Kind=driver` during creation of both delta rows.
- Final distribution across 215 rows: `driver` 29, `component` 121, `algorithm` 7,
  `strategy` 29, `model` 0, `surface` 29.
- Driver databases: Vector Store — Backends (8), Graph Store — Backends (4), Triplet Store —
  Backends (5), Embeddings — Supported Models (4), LLM Providers — Supported Providers (8).
- Strategy databases: Split — Chunking Strategies (6), Semantic Extract — Extraction Methods (3),
  Vector Store — Search Modes (3), Deduplication — V2 Strategies (3), Conflicts — Detection Types
  (4), Conflicts — Resolution Strategies (4), Visualization — Layout Algorithms (3), Seed — Use
  Cases (3).
- Algorithm database: Knowledge Graph — Graph Algorithms (7).
- Surface databases: Explorer — Routes (10), MCP Server — Integrations (5), Export — Export
  Formats (14).
- Component databases: Ingest (23), Parse (17), Normalize (6), Additional Extractors (4),
  Ontology (9), Reasoning (6), Embeddings (5), Deduplication (6), Context (7), Provenance (4),
  Change Management (4), Visualization (6), Pipeline (7), Evals (4), Core (6), Utils (7).

## 3. Module maturity

- Updated all 27 Module Index rows and set `Target home=tbd` on every row.
- `solid` (19): ingest, parse, split, normalize, semantic_extract, kg, vector_store, graph_store,
  triplet_store, deduplication, conflicts, context, provenance, change_management, export,
  visualization, explorer, seed, utils.
- `partial` (7): ontology, reasoning, embeddings, pipeline, llms, mcp_server, core.
- `stub` (1): evals.

## 4. Known delta rows

- Added `sqlite-vec` to Vector Store — Backends with `Kind=driver`.
- Added `Anzo` to Triplet Store — Backends with `Kind=driver`.
- Verified one row of each name. Existing `Grok` remains present once and was not renamed.

## 5. Auto-park

- Set `Verdict=park` on all 5 MCP Server — Integrations rows and all 8 LLM Providers —
  Supported Providers rows: 13 updates.
- Read-back found exactly those 13 park values and no other non-empty Verdict values.

## 6. Findings database

- Appended a new `## Findings` heading at the end of the page, then created and converted one
  child database to inline: `Findings — Bugs, Drift & Gaps`
  (`[notion: Findings — Bugs, Drift & Gaps data source]`).
- Properties: `Finding` title; `Module` and `Evidence` rich text.
- `Class` options: `bug`, `design-flaw`, `drift`, `doc-gap`.
- `Status` options: `open`, `fixed-local`, `reported-upstream`, `resolved`.
- `Source` options: `danklocal`, `grounding`, `audit`.
- Seeded all 12 requested findings: explorer registry keying, restart persistence, ontology DELETE,
  random-vector fallback, sequential “parallel” pipeline, SPARQL reasoner, simulated ontology
  checks, fourteen ontology passes, evals stub, MCP 12-vs-17 drift, Grok/Groq drift, and uncovered
  integrations/root MCP/CLI/cookbook/deploy surfaces.
- Verified status/source split: 3 `fixed-local` + `danklocal`; 9 `open` + `grounding`.
- Verified class split: 4 `bug`, 4 `design-flaw`, 2 `drift`, 2 `doc-gap`.

## 7. Skips, failures, and recovered errors

- Skipped or unresolved requested work: none.
- A 33-source SQL read batch was retried as four batches after:
  `Failed to execute query: too many attached databases - max 10`.
- Explorer — Routes / SPARQL `Kind` was retried once and succeeded after:
  `The automatic permission approval review did not finish before its deadline. Do not assume the
  action is unsafe based on the timeout alone. You may retry once, or ask the user for guidance or
  explicit approval.`
- Final read-back verified the page tail is Module Index, the new Findings heading, then the inline
  Findings database.
