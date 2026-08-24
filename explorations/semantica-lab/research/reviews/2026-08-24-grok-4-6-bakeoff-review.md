# Adversarial bake-off review (Grok 4.6, D17)

Targets: five family sheets vs rubric v2.0, A1–A9, shared-schema, workload-contract.
Live spot-checks below. `gold/v1` is absent. Rubric §4's compatibility round has not run.
These sheets still name winners. That is the process failure.

## 1. Per-sheet

**Storage.** Weakest claim: PGlite G5 **P** on M1 (2,600 synthetic events, 1,004 MB RSS,
tmpfs, "do not use the real W1 corpus"). Gate 5 was skipped. Live: `@beep/pglite` is a typed
SQL wrapper, no pgvector (`package.json` 0.5.6; no pgvector dep). Oxigraph `makeStore`
constructs a fresh `Store()` per request (`Oxigraph.sparql.ts:176-194`) and never reads
`timeoutMs` (`sparql-query.ts:95`). [L7] is a SQL service; `DuckDb.service.ts` has no
vector/KNN surface, so vector integration **18-20** is invented. Oxigraph is starred `*`
(G6 U) and still the RDF winner, against the sheet's own "cannot enter the bundle" rule.
Winner order follows engine-count and practice-KG compose (`PracticeKg.projections.ts:603-623`,
`Host.ts:117-125`), not task quality (adjacency **24-31**, no Cypher). **Overturn:** keep the
ledger+projections *shape*; PGlite G5 → U; Oxigraph out of the bundle; cut the DuckDB vector
integration score.

**Embeddings.** Weakest claim: native ORT as pick-one while runtime G5 and G7 are UNKNOWN.
`require("onnxruntime-node")` was measured. That module does not tokenize or pool.
FaceDetection maps load/run errors (`FaceDetection.service.ts:337-358,782-790`) and does
not embed. Semantica's hash-seeded fallback is real (`text_embedder.py:329-365`). Venice
returns a model *name* (`swagger.yaml:9537-9539`). Snowflake MRL-256 is real (native 768,
truncate+renorm, MTEB 54.2). Task **34-38** is MTEB, not W1 (no qrels). G8 PASS on a
NET-NEW `DegradedEmbedding` wrapper skips the semantic floor. Runtime pick is D7
incumbency: ORT already loads. Transformers.js owns the missing tokenizer/pooling.
Ranges overlap (69-91 vs 65-89). **Overturn:** park model and runtime. Do not freeze
`dim: 256`.

**Input.** Weakest claim: PDF.js G8 PASS* and "provisional winner" with the package
absent, no W1, no G-structure (M3). Live checks hold: `ExtractionResult` has no span
(`Extraction.schema.ts:168-183`); `@beep/md` / `@beep/html` are models, not parsers, no
positions (`md/README.md:23-24`, `Html.model.ts:188-195`); Wink `Tokenization` carries
half-open offsets (`WinkTokenization.service.ts:145-177`) and omitted ids use
`Clock.currentTimeMillis` (`:307`); Tika app concatenates stdout (`Tika.tikaapp.ts:108-139`)
and `TikaContentText` trims (`Tika.response.ts:42-47`). W1 directory has **76** PDFs, not
443. Sensitivity already makes PDF.js/MuPDF a rubric §2 tie. The verdict still crowns
PDF.js. **Overturn:** PDF parse = tie. Other stages follow the table.

**Reasoning.** Weakest claim: EYE G1 PASS "runs in Bun" with **zero** M1 import (M1 is
ontology, SHACL, N3, rete). Winner gates are documentation. G8 PASS is EYE `--proof`
lemmas, not `InferenceEvent` (decode "unbuilt"). Gold soundness **0-16** under UNKNOWN
violates the sheet's "UNKNOWN never earns points." Rubric §3.4 named SHACL(+AF); the
sheet dropped it. shacl-engine G5 FAIL is a 20 s M1 hang not in
`ShaclEngineValidation.test.ts:54-82`. Live: ontology result is modules+quads, no proof
DAG (`Session.reasoner.ts:295-308,838-847`); N3 mutates the store (`n3/README.md:452-454`);
v3 `thenFn` is not awaited (`fire-rules.ts:99-106`). L4 `../beep-effect-logos` does not
resolve from this sheet; checkout is `~/YeeBois/projects/beep-effect-logos`. **Overturn:**
park. No Bun-measured wrap exists.

**Extraction.** Weakest claim: hybrid task **32-36** with G-entity/G-relation UNKNOWN.
Rubric task quality *is* gold-label eval. Live: handoff `relations: A.empty()`
(`Handoff.behavior.ts:83`); Wink `findSpan` returns `{start:0}` on miss
(`WinkBackend.service.ts:50-53`); `extractRelations` is `notSupported` (`:134-137`). Dual
family verdict Already-have **and** Pick-one is illegal under D8/A9. G4/G8 PASS "by
contract" scores a spec. Midpoints 76 vs 73. **Overturn:** family = pick-one/adapt;
forward hybrid *and* pattern-only; drop already-have; zero 32-36 until gold.

## 2. Cross-family composition

The five winners do not compose.

- **Spans.** PDF.js wants a whitespace-lossy canonical stream. `VerifiedSpan` maps onto
  whatever UTF-16 string it was handed (`VerifiedSpan.behavior.ts:458-475`).
  `EvidenceBatch` wants source spans. `ExtractionResult` cannot carry them. No sheet
  names the one canonicalization id later spans are against.
- **Dim.** Embeddings freeze `ModelIdentity.dim: 256`. Storage M2 is **10,000×384**.
  Snowflake native is **768**. One branded field, three widths.
- **EYE vs ledger.** ADHD/A1 proof-ledger is incremental Rete over PGlite proof nodes.
  EYE wrap is full rerun ("no incremental API 0-1"). RDFS has four owners: EYE, parked
  ontology reasoner, Oxigraph SPARQL, PGlite proof tables.
- **DuckDB exact vs pgvector.** VSS parked because `INSTALL` fetches (M7). Exact arrays
  have no envelope-legal ANN. pgvector is a different engine plus an unstable PGlite
  extension API. Migration is a second bake-off.
- **Oxigraph.** M3 rebuild 153 ms / 10k quads on a long-lived store the live adapter
  does not have. Per-request rebuild vs derived projection vs EYE's own graph copy.
- **Budgets.** M4 already 1,145 MB RSS. EYE docs warn 1 GB stacks. 1,145+1,000 > 2 GB.
  Storage M6 ≈175 MB (DuckDB 141). Unpruned ORT 259 MB. Sum 434 > 250. Storage G5 PASS
  counted three engines, not five.

## 3. Probe audit

Underspecified: Oxigraph long-lived store (no crash/timeout fixture); PDF.js G6 "disable
fetch" (policy as PASS); EYE `--restricted` (config as PASS, never run); hybrid G4 "by
contract." Unfalsifiable today: anything that needs `gold/v1` or W1 qrels. Quietly
optional: storage power-loss (G7 still P); Rehype (HTML parser, not installed).

**Run first:** one sidecar, network off, F1 then one W1 PDF, all five winners loaded
(PGlite + DuckDB exact + Oxigraph + ORT/Snowflake + EYE `--restricted` + PDF.js).
Cold, peak RSS, installed bytes. Miss <5 s / <2 GB / <250 MB and every family table
is fiction. Gold before this wastes the two-week loop.

## 4. Verdict-vocabulary + atlas sync

A9 family = `already-have|pick-one|bundle|park`. Row = `adopt|adapt|already-have|park|drop`.
Atlas rows are Semantica modules. Snowflake, PDF.js, EYE, DuckDB exact are not those
rows. Without new catalog rows the Notion column is a name dump.

| Family | Write to Verdict | Row mapping |
| storage | `bundle` | PGlite `adapt`; DuckDB exact `adapt`; Oxigraph `park` until G6; adjacency `adapt`; VSS/pgvector/JSONL-as-SoR `park`; server Postgres `drop` |
| embeddings | `park` (sheet said pick-one) | Snowflake `adapt` (MRL truncate is a change); ORT `adapt`; API `drop`; semantica embedder `drop` |
| input | no single cell (A3) | file-processing `adapt`; unified `adapt`; PDF.js/MuPDF `park` pending tie; md/html `already-have` as dest, `drop` as parsers; Tika `park`; Tokenization `adapt` |
| reasoning | `park` (sheet said pick-one) | EYE `adapt` only after Bun G5/G7; ontology `park`; rete salvage `park`; SHACL optional `park` |
| extraction | `pick-one` only | hybrid `adapt`; pattern `adapt`; LLM-only `park`; Wink `findSpan` `drop`; LangExtract handoff `adapt`; `semantic_extract` `drop` |

Copying sheet prose into Notion puts two family values in extraction and invites `bundle`
on input. The filter then lies.

## 5. Top 3 regrets

1. **EYE as the M1 wrap.** Never loaded in Bun. Documented 1 GB stacks on top of M4
   1,145 MB. The two-week loop OOMs, or reasoning is switched off and the KG has no
   checkable derivations.
2. **256 vs 384 vs 768.** First W1 embed writes the wrong `ModelIdentity`. DuckDB
   tables are the wrong width. A later ANN flip rebuilds the store. Eval identity dies.
3. **PDF.js on academic PDFs with no G-structure.** Lossy page items become the
   canonical stream. Extraction gold labels the wrong offsets. EvidenceBatch looks
   precise and is ungrounded.

## Family verdicts

- storage: RATIFY-WITH-EDITS (PGlite G5→U; Oxigraph out; DuckDB vector score; freeze dim with embeddings)
- embeddings: REWORK (runtime G5/G7 UNKNOWN; D7 incumbency; dim 256; no W1 qrels)
- input: RATIFY-WITH-EDITS (PDF parse = tie; name the canonicalization id; Rehype is not installed)
- reasoning: REWORK (winner unrun on Bun; UNKNOWN scored; SHACL dropped; G8 is the wrong proof type)
- extraction: REWORK (dual family verdict; 32-36 without gold; G8 by spec)
