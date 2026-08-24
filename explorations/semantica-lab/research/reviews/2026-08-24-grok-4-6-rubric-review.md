# Adversarial rubric review (Grok 4.6, 2026-08-24)

Target: `research/criteria-rubric.md` (DRAFT), against `DECISIONS.md` D1–D18, `RESEARCH.md`,
`research/grounding-semantica-repo.md`, and the in-repo bricks they name.

## 1. Hard gates

Envelope (rubric L9–10, D9) is the right product cut and the wrong quality cut. It parks the
backends grounding §5 calls solid (Neo4j/FalkorDB/AGE, Qdrant/Weaviate/Milvus, Blazegraph/Jena/
Anzo). Bake-offs will still crown a "best-in-class" winner (D7) inside that ghetto. Require a
parked-SOTA appendix so the winner cannot pretend it beat Neo4j.

"In-process" is undefined. `grounding-beep-labs.md` §6: Professional Desktop runs Effect in a
compiled Bun sidecar, not the WebKit webview. Transformers.js in the webview, ONNX in Bun, and a
Rust crate are three different in-process stories.

Copyleft-sidecar (L12–13) is a distribution trap. Process boundary stops linking. Shipping
GPL/AGPL inside a Tauri bundle is still conveyance; WASM linked into JS is worse. "Case-by-case"
with no distributee / source-offer / linking test will ratify this in a PR comment.

The 12-month "life" floor (L14–15) is naive both ways. A commit is not maintenance. EYE, Oxigraph,
Jena go quiet for years and remain the answer. Replace with: tagged release, or we build it in
CI, or we vendor it with a name.

Missing: (a) silent degradation. Grounding §5/§7 random-vector fallback shaped like success.
Success-shaped garbage ⇒ park. (b) WASM/RSS/model-download budget: eyereasoner + Oxigraph WASM +
transformers.js will OOM WebKitGTK. (c) Determinism: D16 evals-as-spine cannot sit on a
non-replayable embedder. (d) Ingest SSRF (grounding §2). (e) Mobile: say no-go or the sidecar
story dies later. Exhibit: `@beep/tika`'s default lane is HTTP to `localhost:9998`. Envelope parks
the repo's actual file engine unless `tika-app.jar` is admitted as a JVM sidecar.

## 2. Axes and weights

Envelope fit ×2 re-imposes the option D9 rejected. After the hard gate every survivor is already
legal. Scoring "pure TS/WASM, no sidecar" at ×2 means sidecars always lose even when they won
quality. That is strict-embedded with extra steps.

Quality ×3 glues three things. Semantica would win breadth and fail correctness (simulated
HermiT/Pellet, SPARQL that always raises; grounding §4). Split: correctness on a named eval, and
coverage against a family checklist.

Effect-native cost ×2, data-model fidelity ×2, beep-overlap ×1, wrap surface ×1 are one cluster.
A library that already speaks IRI/literal scores all four. Overlap is integration cost. Fidelity
is schema.

Score this instead (sum 11): correctness-on-D14-corpus ×3; schema fidelity (IRI vs
literal+lang+datatype, spans, provenance hooks, model identity) ×2; operational envelope (RSS,
cold start, model bytes, spawn) ×2; wrap/maintenance ×2; beep-compose ×1. Drop scored
envelope-fit. D16 provenance-first and evals-as-spine are not axes, so a winner that cannot emit
append-only events or a replayable report can still beat the table.

## 3. Family sheets

Storage-as-one-decision is a false unification. Grounding §7.2 wanted *separate* families for
vector, property graph, and RDF. D10 + rubric §1 collapse them so "engine count" can elect
pgvector-on-PGlite. That candidate is not in `@beep/pglite`. Repo pgvector hits are Docker
`pgvector/pgvector` comments (`packages/epistemic/server/test/integration/*`).
`scratchpad/effect-ontology` proves *server* Postgres. `@beep/duckdb` already ships in
`apps/practice-kg-mcp`.

`@beep/semantic-web` "covering SPARQL" confuses a contract (`SparqlQueryService`,
select/ask/construct, engine-agnostic) with a store. Ontology `OntologyReasoner` is RDFS closure /
domainRange / disjointness, not OWL-DL, not Datalog. `effect/Graph` is an in-memory digraph, not a
persisted property graph. Those are already-have traps under D7. D8's exactly-one-of
{already-have, pick-one, park} cannot say PGlite + Oxigraph + an ANN. Force one engine and you lie
or you pick the worst of three. Semantica `graph_store` has no in-memory backend (grounding §5);
if the lab needs one, that is NET-NEW. Missing seeds: Kuzu, DuckDB/VSS, rdf-js/Comunica,
LanceDB/usearch, candle-native.

Embeddings anti-pattern is right (model identity in schema; hash as a tagged degraded mode).
Still silent on *which* process loads the model.

Input stack will explode. Notion ingest catalog is 23 ingestors including Snowflake/Databricks/
GDrive (`grounding-notion-semantica.md`). Census vs `@beep/file-processing` with no D14 format
bound becomes a second Semantica. SOURCES.md §4 omits `@beep/tika`, `@beep/langextract`,
`@beep/nlp`, `@beep/nlp-processing`, `@beep/pandoc-ast`, `@beep/rdf`, `@beep/provenance`.
Extraction (`semantic_extract`, grounding: solid) is not a bake-off. That is the step that
produces the KG.

Reasoning "pick-one + NET-NEW hybrid" (rubric L58–60) is a never-close clause: wrap EYE, invent
typed proof DAGs forever. D15 says /adhd runs *before* this sheet freezes; this draft already
contains the sheet. Constrain: the wrap is pick-one; NET-NEW is a dated spike with kill criteria.
Missing seeds: Ascent/Datafrog (Rust Datalog, native in the Tauri crate), SWI/Trealla WASM.

## 4. Decision-set risks

**D12 Tauri-first.** Milestone 1 is headless Document→KG + evals (tests/CLI/MCP). The generator
emits a WebKit window, not Desktop's sidecar (`grounding-beep-labs.md` §3, §7.6). Labs CI does not
run Cargo. Failure: three weeks of icon, CSP, and `dev:tauri` before a single triplet exists.

**D2 + D5 Notion/repo dual-write.** Packet owns decisions; Notion owns facts; the IR pipeline is
"proto-lab code." RESEARCH.md already records atlas drift (missing sqlite-vec, Anzo, Grok vs Groq)
on day one. 213 title-only rows, empty descriptions. Failure: agents write both surfaces;
JSONL→Notion becomes the product; bake-offs wait on griffe while Semantica ships 0.6.7.

**D8 × D10 storage unification.** Three-way partition plus "judged together" plus engine-count as
integration cost. Failure: PGlite wins by making SPARQL and Cypher into SQL views; you re-litigate
storage when SHACL needs named graphs Oxigraph already had.

Honorable: D13. `trustgraph-workbench` is a scaffold heading. You cannot eval a graph you cannot
see, so the construction lab grows a workbench and the charter leaks. D16 provenance-first inverts
storage signatures *before* the bake-off that chooses them. `@beep/provenance` today is
`TextAnchor`, not a PROV-O log.

## 5. What's missing entirely

The shared schema. Independent bake-offs assume Document / Chunk / Entity / Triplet /
ProvenanceEvent / InferenceEvent can be picked later. They cannot. Input spans, RDF terms
(`@beep/rdf`, not semantic-web), embedding dimension identity, and proof premises have to be one
family or four winners will not compose. Grounding §3 is Semantica's death: dataclass / Pydantic /
dict models for the same words.

Appetite. `BRIEF.md` and `MAP.md` are empty. Four Opus-class bake-offs, an AST→Notion pipeline, a
Tauri scaffold, /adhd, and dual-write atlas work have no time box. What two-week Document→KG→eval
loop would *falsify* the lab? If that loop does not need a property graph *and* a triplet store
*and* a WASM reasoner, the rubric is scoring the wrong function.

Where the runtime lives (webview / Bun sidecar / Rust) is the unasked question every envelope and
embeddings answer is downstream of.

## Verdict

**RATIFY-WITH-EDITS.** Mandatory before any bake-off launches:

1. Split storage scoring into vector / property-graph / triplet. D8 may return a bundle, not a
   single engine.
2. Drop Envelope-fit as a scored axis. Define in-process as the Bun sidecar process unless an
   explicit exception is recorded.
3. Replace Quality×3 with correctness-on-corpus + coverage. Hard-gate success-shaped fallbacks.
4. Copyleft sidecars need a written distribution analysis. Maintenance floor:
   releasable-or-vendorable, not "commit in 12 months."
5. Bound the input census to D14 formats. Add the omitted `@beep/*` bricks in §3 to seed lists and
   SOURCES.md §4. Extraction is either a fifth sheet or a scored already-have, not a skip.
6. Freeze family 4 only after D15. NET-NEW is a dated spike; the wrap is the pick-one.
7. A one-page shared schema of Document/Chunk/Term/ProvenanceEvent is bake-off *input*, not output.
8. Record D12 M1 as window-optional so the Tauri scaffold cannot block the headless proof.
