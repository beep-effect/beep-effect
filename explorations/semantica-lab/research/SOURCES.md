# semantica-lab — Sources & Provenance

- **Cluster / origin:** session-driven grounding sweep (2026-08-24) around the Semantica KG
  framework, the beep-effect labs doctrine, and the `@beep/semantica` Notion atlas; plus
  Benjamin's own v3 archive as reasoning prior art.
- **Provenance:** grounding files in this directory (each authored by a GPT-5.6 Sol xhigh agent
  from primary sources); decisions in [`../DECISIONS.md`](../DECISIONS.md).

## 1. Mined source corpus

Mined at symbol granularity by the D5 extraction pipeline: `scratchpad/semantica-ir/` emits a
schema-validated JSONL IR over `semantica/**` (6,105 records, 354 files, SHA-256-stamped; stats
in [`ir-extraction-report.md`](./ir-extraction-report.md)). The IR output itself is gitignored;
the extractor, schema, and report are committed.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `semantica-agi/semantica` (local: `~/YeeBois/workstation-apps/semantica` @ `add1c006`, branch `danklocal`) | MIT (Hawksight AI, verified in `LICENSE`) | port-with-attribution (ideas ported schema-first, not vendored code) | concepts: provenance events, storage capability families, ContextGraph, ontology lifecycle, typed inference explanations, pipeline DAG contract |
| `beep-effect-logos` (local: `~/YeeBois/projects/beep-effect-logos`, archived v3 beep-effect) | own code (Benjamin's) | free reuse / salvage | `rete` SALVAGE (network topology + behavioral test oracle), `rules` PATTERN (operator taxonomy), `logos` PATTERN (rule-AST + validator semantics) — per `grounding-v3-logos.md` §5 |
| `scratchpad/effect-ontology` (in-repo quarantined experiment) | in-repo; upstream was MIT per its ledger | reference + pattern; explicitly non-importable, promotion unauthorized | PORTING_LEDGER per-symbol method as template precedent; Effect v4 ontology idioms |

Benjamin's `danklocal` branch carries 3 unique local fixes not upstream (explorer ontology
registry: URL-keyed entries, persistence across restarts, DELETE of implicit entries) — evidence
for the Findings DB and candidates for the upstream lane (DECISIONS D16).

## 3. External research sources

- Semantica docs: https://docs.getsemantica.ai/ (glossary: https://docs.getsemantica.ai/glossary/)
- Notion atlas page: `@beep/semantica` in the private Todox workspace (identifier withheld;
  find it via Notion search)
- Bake-off candidate URLs: fetch-verified in [`docs-url-census.md`](./docs-url-census.md) and
  in each family sheet's Sources appendix (`bakeoff-*.md`).

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| RDF value models, OWL/PROV vocab, SPARQL | `packages/foundation/capability/semantic-web` (`@beep/semantic-web`) | reuse (bake-off candidate, D7: competes, no bye) |
| Ontology slice (SKOS/SHACL, bounded reasoning, workbench UI) | `packages/ontology/*` | reuse/extend — shared spine per D13 |
| File/document processing | `@beep/file-processing`, `@beep/md`, `@beep/html`, `@beep/tika` (default lane: HTTP localhost:9998 — envelope analysis needed), `@beep/pandoc-ast` | reuse (input-stack bake-off, per-stage) |
| NLP + extraction | `@beep/nlp`, `@beep/nlp-processing`, `@beep/langextract` | reuse (input/extraction sheets) |
| RDF terms & provenance primitives | `@beep/rdf` (term model), `@beep/provenance` (TextAnchor — NOT a PROV-O log) | reuse/extend (shared-schema input, A7) |
| Embedded analytics | `@beep/duckdb` (shipping in practice-kg-mcp) | reuse candidate (storage projections) |
| Embedded Postgres + ORM | `@beep/pglite`, `@beep/postgres` | reuse (storage bake-off; pgvector-on-PGlite convergence) |
| Property graph in-memory | `effect/Graph` (Effect v4) | reuse candidate |
| LLM providers / agent chat | agents slice (`@beep/agents-client` etc.) | already-have (LLM multiplexing auto-parked, D10) |
| Local practice-KG precedent (PGlite + DuckDB + read-only MCP) | `apps/practice-kg-mcp` | pattern |
| Tauri shell + Bun sidecar + migrations | `apps/professional-desktop` | pattern only (never imported) |
| Lab scaffold + lifecycle | `bun run beep create-package --lab`, `standards/architecture/15-lab-apps.md` | reuse |
| Retrieval/projection lab (charter counterpart) | `apps/labs/trustgraph-workbench` | boundary per D13 |
| Extraction pipeline IR + Notion sync (D5) | — | NET-NEW (proto-lab code) |
| Reasoning substrate (Effect-native, schema-first) | — | NET-NEW pending bake-off + v3 salvage verdict |

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md),
  [`../DECISIONS.md`](../DECISIONS.md), [`./OPPORTUNITIES.md`](./OPPORTUNITIES.md)
- Grounding files: [`grounding-semantica-repo.md`](./grounding-semantica-repo.md),
  [`grounding-beep-labs.md`](./grounding-beep-labs.md),
  [`grounding-notion-semantica.md`](./grounding-notion-semantica.md),
  [`grounding-v3-logos.md`](./grounding-v3-logos.md)
- Sibling doctrine: `goals/lab-apps-lifecycle/` (D13 names `semantica` a first-wave lab source);
  `docs/BEEPGRAPH_ARCHITECTURE.md` (trustgraph direction)
