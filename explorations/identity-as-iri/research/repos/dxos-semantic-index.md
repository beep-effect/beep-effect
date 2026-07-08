## 1. Overview & purpose

`@dxos/semantic-index` is a private DXOS package whose manifest describes it as a "Semantic index" that "extracts attributed propositions from text and answers SPARQL queries over them" (dxos/packages/core/compute/semantic-index/package.json:2-5). Its design places the semantic graph outside ECHO, says it references ECHO objects by DXN, and targets browser plus Cloudflare Worker execution (dxos/packages/core/compute/semantic-index/DESIGN.md:3-5). The package purpose is to turn text from user documents and synced feed messages into structured facts preserving attribution, uncertainty, and time for LLM answers and tasks (dxos/packages/core/compute/semantic-index/DESIGN.md:11-13). Its public barrel exports the type model, fact graph helpers, pipeline, store, errors, natural-language query generation, SPARQL building, predicate normalization, and SPARQL-to-query parsing (dxos/packages/core/compute/semantic-index/src/index.ts:5-13).

## 2. License

No package-local `LICENSE` file was present in the semantic-index directory during the filesystem check; the nearest package-local declaration is the package manifest, which says `"license": "FSL-1.1-Apache-2.0"` (dxos/packages/core/compute/semantic-index/package.json:12). The dxos monorepo root `LICENSE` begins with `Functional Source License, Version 1.1, ALv2 Future License` (dxos/LICENSE:1) and gives the abbreviation `FSL-1.1-Apache-2.0` (dxos/LICENSE:3-5). The dxos root package manifest also says `"license": "FSL-1.1-Apache-2.0"` (dxos/package.json:12). Because this is verified as FSL-1.1-Apache-2.0 rather than current MIT or Apache-2.0, mark this repo mining result **REFERENCE-ONLY**, not port-with-attribution.

## 3. Identity/addressing model

Facts carry a string `id` in the `Fact` schema (dxos/packages/core/compute/semantic-index/src/types/Fact.ts:11-20). The extraction pipeline constructs fact IDs as `${source}#${hash}#${index}` and assigns those IDs when mapping extracted candidates to stored facts (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts:32,69). Subject and object terms are either `{ entity, label? }` references or `{ literal }` values, and the entity `id` is documented as the normalized slug join key while `label` preserves the display surface form (dxos/packages/core/compute/semantic-index/src/types/Assertion.ts:7-15). `normalizeEntityId` trims and lowercases labels, replaces non-alphanumeric runs with `-`, strips leading/trailing dashes, and falls back to `entity-${hashText(normalized)}` for empty normalized labels (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts:23-31). The RDF vocabulary layer maps entity IDs to `https://dxos.org/semantic/entity/${encodeURIComponent(id)}` and fact IDs to `https://dxos.org/semantic/fact/${encodeURIComponent(id)}` (dxos/packages/core/compute/semantic-index/src/internal/vocab.ts:9-17). Attribution `source` and `wasDerivedFrom` are documented as DXN strings and modeled as strings in the attribution schema (dxos/packages/core/compute/semantic-index/src/types/Attribution.ts:7-13). The `Entity` schema has an optional `ref` documented as the DXN of a canonical ECHO object if resolved (dxos/packages/core/compute/semantic-index/src/types/Entity.ts:10-16). The current pipeline comments say provisional v1 entity resolution has no linking to real ECHO objects yet and is not the final identity scheme (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts:20-21).

## 4. Index/data model

The package's core storage unit is `Fact`, containing `id`, `assertion`, `valence`, `attribution`, `recordedAt`, `extractor`, and `sourceHash` fields (dxos/packages/core/compute/semantic-index/src/types/Fact.ts:11-20). The design defines a Fact as one extracted proposition plus metadata, with assertion fields grounded in an RDF triple, valence grounded in FactBank factuality, attribution grounded in PROV-O, and provenance fields including `id`, transaction time, extractor, and source hash (dxos/packages/core/compute/semantic-index/DESIGN.md:22-31). The design states the model is Effect Schema and JSON-serializable, and that conflicting or time-varying facts are multiple facts rather than write-time merges (dxos/packages/core/compute/semantic-index/DESIGN.md:37-39). `factToTriples` reifies each Fact as a fact node with `sx:subject`, `sx:predicate`, `sx:object`, valence triples, PROV-O source/time triples, recorded time, source hash, and extractor metadata (dxos/packages/core/compute/semantic-index/src/internal/sparql/mapping.ts:35-52). The same mapper adds optional agent, confidence, nature, validity, quote, display labels, derived-from values, and spans as additional triples (dxos/packages/core/compute/semantic-index/src/internal/sparql/mapping.ts:53-87). `triplesToFacts` groups quads by fact IRI, uses predicate local names as property keys, rebuilds a candidate fact object, and validates it through the `Fact` schema (dxos/packages/core/compute/semantic-index/src/internal/sparql/mapping.ts:90-150). The SQLite schema creates a `triples` table with `(s, p, o, oType, g)`, a unique index over all five columns, lookup indexes on `(s,p,o)` and `(p,o)`, an `entities` table with optional `ref`, and a `cursors` table keyed by source (dxos/packages/core/compute/semantic-index/src/internal/sqlite/schema.ts:9-24). The in-memory path uses an N3 `Store` as an RDF/JS source and appends quads with N3 store de-duplication (dxos/packages/core/compute/semantic-index/src/internal/source/memory-source.ts:7-15). The SQLite source persists quads inside one transaction and ignores duplicate quads through the `triples_unique` constraint (dxos/packages/core/compute/semantic-index/src/internal/source/sqlite-source.ts:29-42). The `SemanticStore` SQLite layer migrates the schema, creates a SQLite RDF/JS source, persists facts by flattening them through `factToTriples`, stores cursors by source hash, and clears triples/entities/cursors together (dxos/packages/core/compute/semantic-index/src/SemanticStore.ts:58-99). The memory layer uses an N3 store plus a `Map` of cursors and exposes the same API shape as the SQLite layer (dxos/packages/core/compute/semantic-index/src/SemanticStore.ts:103-130).

## 5. Retrieval API

The store API exposes `putFacts`, structured `query`, raw SPARQL `select`, source `cursor`, `setCursor`, and `clear` (dxos/packages/core/compute/semantic-index/src/SemanticStore.ts:24-36). The structured `SemanticQuery` supports `subjectEntity`, `predicate`, `entity`, `source`, and `minConfidence` fields (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-builder.ts:7-18). `buildSparql` lowers those fields to a `SELECT ?fact ?p ?o` query, including subject-entity, literal predicate, source, subject-or-object entity union, and confidence threshold patterns, with an all-facts fallback when no filters are supplied (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-builder.ts:20-55). The raw SPARQL path uses Comunica `queryBindings`, accepts a source array, keeps rows whose `fact` and `p` are named nodes and whose `o` is a named node or literal, then returns quads for reassembly (dxos/packages/core/compute/semantic-index/src/internal/sparql/engine.ts:22-50). The structured N3 memory query path finds fact nodes matching each constraint, intersects those node sets, fetches all triples for the matching fact nodes, reassembles facts, and applies `minConfidence` as an inclusive threshold (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-memory.ts:15-20,24-71). The structured SQLite query path performs the same constraint intersection over the `triples` table, fetches matching fact-node rows, reassembles facts, and applies `minConfidence` as an inclusive threshold (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-sqlite.ts:17-25,32-89). Predicate retrieval normalizes the query predicate and stored predicate, then accepts exact normalized matches plus substring matches in either direction (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-memory.ts:32-43; dxos/packages/core/compute/semantic-index/src/internal/sparql/query-sqlite.ts:44-53). `normalizePredicate` lowercases, trims, collapses whitespace, drops leading auxiliary/copula/article words, stems the head verb lightly, and explicitly does not merge true synonyms such as `works for` and `works at` (dxos/packages/core/compute/semantic-index/src/internal/sparql/normalize-predicate.ts:54-73). Inferred from the retrieval implementations: there is no ranking or scoring order in the structured path; confidence is only a threshold filter, and the cited query functions perform set restriction, reassembly, and optional filtering without a ranking step (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-memory.ts:24-71; dxos/packages/core/compute/semantic-index/src/internal/sparql/query-sqlite.ts:32-89). The natural-language query helper uses an AI model to emit the structured query shape with `subjectEntity`, `entity`, `predicate`, and `minConfidence`, and its prompt tells the model to omit fields not implied by the question (dxos/packages/core/compute/semantic-index/src/nl-to-query.ts:16-21,23-42,44-59).

## 6. API ergonomics

The simplest store call site gets the service, writes facts, and queries by subject entity (dxos/packages/core/compute/semantic-index/src/SemanticStore.test.ts:29-31):

```ts
const store = yield* SemanticStore;
yield* store.putFacts([mk({ id: 'f1' })]);
const facts = yield* store.query({ subjectEntity: 'alice' });
```

The pipeline call site runs extraction/persistence from one document, then queries the store by predicate (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.test.ts:92-101):

```ts
yield* SemanticPipeline.run([
  {
    text: "I think I'm probably going to Paris next week",
    source: 'dxn:q:m1',
    author: 'Alice',
    date: '2026-06-06T00:00:00.000Z',
  },
]);
const store = yield* SemanticStore;
const facts = yield* store.query({ predicate: 'travelsTo' });
```

The store-free extraction call site proves facts can be derived with only an AI service and no store layer (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.test.ts:167-208):

```ts
const facts = yield* extractFacts([
  {
    text: "I think I'm probably going to Paris next week",
    source: 'editor:input',
    author: 'Alice',
    date: '2026-06-06T00:00:00.000Z',
  },
]);
```

The browser/test layer call site uses `SemanticStore.layerMemory`, runs the pipeline, then exercises both structured query and raw `SELECT` (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.test.ts:271-282):

```ts
const byEntity = yield* store.query({ entity: 'composer' });
const all = yield* store.select('SELECT ?fact ?p ?o WHERE { ?fact ?p ?o }');
const byFuzzyPredicate = yield* store.query({ predicate: 'discussed' });
```

The graph call site builds an entity-neighborhood graph from an in-memory fact source at a bounded depth (dxos/packages/core/compute/semantic-index/src/fact-graph.test.ts:27-31):

```ts
const graph = buildFactGraph('socrates', factSourceFromFacts(SYLLOGISM), { depth: 2 });
expect(graph.nodes.map((node) => node.id).sort()).toEqual(['man', 'mortal', 'socrates']);
```

## 7. DIAMONDS

1. Adopt the service/layer boundary, not the code. DXOS exposes one `SemanticStore` API over SQLite and memory layers, while our Phase 4 asks for a `ServiceMap.Service` registry whose local layer and graph-store layer share one interface (dxos/packages/core/compute/semantic-index/src/SemanticStore.ts:54-130; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:325-328). This maps cleanly to D8: the registry is the retrieval service over fibers, while storage stays swappable.

2. Keep retrieval ID-first. DXOS turns entity/fact IDs into stable semantic IRIs and indexes reified triples by subject/predicate/object columns, which is much closer to our dereference-not-search target than vector retrieval (dxos/packages/core/compute/semantic-index/src/internal/vocab.ts:9-17; dxos/packages/core/compute/semantic-index/src/internal/sqlite/schema.ts:13-19; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:263-279). For our D1/D4 design, the stronger version is: identity composer mints canonical IRI/CURIE handles first, then registry lookup dereferences those handles.

3. Preserve assertion, attribution, valence, and provenance as separate channels. DXOS keeps assertion, valence, attribution, recorded time, extractor, and source hash distinct in `Fact`, which is useful prior art for our Section 5 fiber union that includes annotations, DESCRIBE results, docs, and provenance records (dxos/packages/core/compute/semantic-index/src/types/Fact.ts:11-20; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:268-275).

4. Treat conflicts as query-time data, not write-time overwrite. DXOS explicitly stores conflicting/time-varying claims as multiple facts and says resolution is query-time, which is compatible with our PROV-O and bitemporal ambitions for the fiber over an identity (dxos/packages/core/compute/semantic-index/DESIGN.md:37-39,97-102; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:268-279).

5. Copy the cursor idea for source-index maintenance. DXOS stores source hashes keyed by source and skips unchanged re-ingest before invoking extraction, which is a practical local-first pattern for our registry layers when generated docs, AST annotations, or graph-store projections are already current (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts:109-136; dxos/packages/core/compute/semantic-index/src/SemanticStore.ts:31-34,71-82).

6. The pure graph adapter is a useful `pullback` mental model. DXOS `buildFactGraph` takes a `FactSource`, expands a bounded neighborhood deterministically, and keeps the backing store out of the graph builder; that resembles our D8 `Fibered.pullback(f)` context-budgeting move over a sub-base (dxos/packages/core/compute/semantic-index/src/fact-graph.ts:7-14,48-90; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:317-319).

## 8. ROUGH

1. Do not copy the license. The package and repo are FSL-1.1-Apache-2.0, so this is reference-only pattern mining (dxos/packages/core/compute/semantic-index/package.json:12; dxos/LICENSE:1-5; dxos/package.json:12).

2. Slug identity is too weak for our D1/D4 contract. DXOS lowercases and slugifies labels into entity IDs, and the source comments say this is provisional and not linked to real ECHO objects yet; our design needs total root authority binding and handle-only references, not display-label-derived IDs (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts:20-31; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-95).

3. Open string predicates are the opposite of D3/D6. DXOS v1 stores predicates as open strings and later normalizes them heuristically, while our design requires CURIE literal predicate types and triples-as-tuples so invalid borrowed predicates fail at authoring or schema decode time (dxos/packages/core/compute/semantic-index/DESIGN.md:33-35,51-57; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-105).

4. Avoid substring predicate matching in the registry. DXOS accepts substring matches in either direction after predicate normalization, which helps noisy LLM extraction but is not dereference; our registry should resolve exact identity/IRI/CURIE handles and put any fuzzy search in a separate discovery tool (dxos/packages/core/compute/semantic-index/src/internal/sparql/query-memory.ts:32-43; dxos/packages/core/compute/semantic-index/src/internal/sparql/query-sqlite.ts:44-53; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:277-279).

5. Local-name reassembly is a collision hazard. DXOS reassembly keys annotations by predicate local name and documents an invariant that every serialized predicate must have a unique local name; our D9 split between owned `identifier` and borrowed `term` channels should avoid this entire class of local-name collision (dxos/packages/core/compute/semantic-index/src/internal/sparql/mapping.ts:15,25-32; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-122).

6. Keep raw SPARQL optional. DXOS comments say structured SQLite queries avoid Comunica because Comunica does not bundle for browser or Workers, while raw `select` remains server-side only; our registry service should make exact local dereference the portable core and leave SPARQL/DESCRIBE as an optional graph-store layer (dxos/packages/core/compute/semantic-index/src/SemanticStore.ts:94-107; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:325-328).

7. Add supersession deliberately if source content changes. DXOS currently appends changed-source facts and defers deleting or superseding prior facts from that source; for our provenance story, append-only is fine only if supersession, validity, and bitemporal policy are explicit fiber parts (dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts:109-115; explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:268-275).

## 9. Sources

- <local-research-checkout>/dxos/LICENSE
- <local-research-checkout>/dxos/package.json
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/DESIGN.md
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/moon.yml
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/package.json
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/SemanticPipeline.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/SemanticPipeline.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/SemanticStore.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/SemanticStore.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/errors.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/fact-graph.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/fact-graph.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/index.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/source/memory-source.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/source/sqlite-source.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/source/sqlite-source.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/engine.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/mapping.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/mapping.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/normalize-predicate.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/normalize-predicate.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/query-builder.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/query-memory.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/query-sqlite.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/sparql-to-query.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sparql/sparql-to-query.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sqlite/schema.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/sqlite/schema.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/stages/chunk.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/stages/chunk.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/stages/extract.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/stages/reconcile.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/internal/vocab.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/nl-to-query.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/smoke.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/testing/discord-messages.json
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/testing/harness/generate-facts.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/testing/harness/generate-facts.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/testing/harness/serialize.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/testing/index.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/Assertion.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/Attribution.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/Entity.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/Fact.test.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/Fact.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/Valence.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/src/types/index.ts
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/tsconfig.json
- <local-research-checkout>/dxos/packages/core/compute/semantic-index/vitest.config.ts
- <repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md
- <repo-root>/scratchpad/identity/README.md
