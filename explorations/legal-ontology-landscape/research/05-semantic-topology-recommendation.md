# P4 Semantic Topology Recommendation

Date: 2026-07-09

## Scope

This P4 report answers CQs 16, 17, and 20 from
`research/01-direction-grounding.md`:

- CQ16: every graph edge used by search or agent answers must be rebuildable
  from accepted claims, EventLog/provenance records, DMS links, and evidence
  spans.
- CQ17: route questions explicitly across Postgres/PGlite projections,
  RDF/SPARQL sidecars, bounded SHACL validation, and not-yet-wired semantic
  engines.
- CQ20: for each accepted external ontology or vocabulary term, adopt, slice,
  map, or reject it based on competency-question value and repo authority.

The governing doctrine is unchanged: authority is Effect Schema + EventLog +
evidence spans + provenance. RDF, SPARQL, SHACL, OWL, graph stores, vectors, and
agent-memory graphs are sidecars for validation, interchange, retrieval, and
agent grounding. They do not become accepted legal fact authority.

## Local Grounding

- `goals/semantic-foundation/SPEC.md` locks v1 non-goals: no SPARQL wiring, no
  graph store, Postgres/PGlite projection doctrine, and M4 SHACL authoring
  against the current bounded validator.
- `goals/legal-document-intake/SPEC.md` D6/D7 resolves KG storage as
  Postgres/PGlite projection and treats KG submissions as epistemic claims that
  pass librarian -> critic -> ClaimGate before materializing nodes/edges.
- `docs/BEEPGRAPH_ARCHITECTURE.md` defines BeepGraph as an Effect-native typed
  authority spine with graph/retrieval shells as rebuildable projections and
  caches.
- `packages/foundation/capability/semantic-web/src/services/sparql-query.ts`
  exposes `select`, `ask`, and `construct` request/result schemas but ships
  `UnsupportedSparqlQueryServiceLive`.
- `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`
  and `src/adapters/shacl-engine.ts` expose and implement the bounded M4 subset:
  `targetClass`, `minCount`, `maxCount`, and `datatype`.
- `standards/memory-architecture/01-memory-layer-taxonomy.md` and
  `05-context-graph-capability-assessment.md` keep Graphiti-style temporal
  graphs, FalkorDB, GraphRAG, and vector stores in candidate/projection/cache
  roles with TTL, pruning, compression, and provenance back-pointers.
- The repo already has PGlite dependencies and a local `@beep/pglite` driver
  that exposes embedded Postgres through Effect SQL tags. `package.json` also
  already lists `shacl-engine`, but the current public SHACL adapter remains the
  bounded in-repo implementation.

## Web Evidence Used

Firecrawl MCP search was used for current external evidence. The search
feedback MCP call was rejected by the client once, so feedback calls were not
retried.

- Oxigraph: https://github.com/oxigraph/oxigraph/issues/128 and
  https://pypi.org/project/oxigraph/
- Comunica: https://github.com/comunica/comunica,
  https://comunica.dev/docs/query/,
  http://rdf.js.org/comunica-browser/, and
  https://comunica.github.io/Article-ISWC2018-Resource/
- Apache Jena Fuseki: https://jena.apache.org/documentation/fuseki2/ and
  https://jena.apache.org/documentation/fuseki2/fuseki-config-endpoint.html
- SHACL engines: https://github.com/rdf-ext/shacl-engine,
  https://github.com/rdflib/pyshacl, https://github.com/TopQuadrant/shacl-js,
  and https://www.w3.org/TR/shacl/
- OWL profiles and inference: https://www.w3.org/TR/owl2-profiles/,
  https://jena.apache.org/documentation/inference/,
  https://github.com/RDFLib/OWL-RL, and https://pypi.org/project/owlrl/
- LinkML: https://linkml.io/linkml/intro/overview.html and
  https://linkml.io/linkml/faq/why-linkml.html
- Projection/cache surfaces: https://pglite.dev/docs/about,
  https://pglite.dev/extensions/, https://github.com/pgvector/pgvector,
  https://docs.falkordb.com/, https://github.com/getzep/graphiti, and
  https://www.getzep.com/platform/graphiti/

## Recommendation A: SPARQL Engine

Recommendation: keep `UnsupportedSparqlQueryServiceLive` through v1 and M4.
When the SPARQL milestone is explicitly un-gated, implement the first adapter
against Oxigraph, not Comunica or Fuseki, unless the gate evidence shows the
dominant need is federated web querying rather than local sidecar querying.

Reasoning: the contract is already small (`select`, `ask`, `construct` over an
RDF/JS dataset), and the consumer posture is local-first desktop plus web apps.
Oxigraph is the best eventual fit for an embedded local RDF/SPARQL sidecar if
its JavaScript/WASM package passes Bun, desktop, and browser fixture tests.
Comunica is the better TypeScript-native federated query framework, but its
strength is decentralized/federated web RDF, not a simple embedded sidecar over
repo projections. Fuseki is a mature SPARQL server, but it adds JVM/server ops
that conflict with the v1 local-first posture. "None" is correct now because
Postgres/PGlite and bounded SHACL answer the current CQs without adding a second
query authority.

| Option | Fit | Tradeoffs | Verdict |
| --- | --- | --- | --- |
| Oxigraph embedded JS/WASM | Best eventual local sidecar candidate. Maintainer discussion confirms an npm package intended for Node and browsers, with caveats around bundlers and WASM loading; PyPI also exposes the CLI/server package. | Effect wrapping is straightforward: one `Layer` around `execute`, timeout, result decoding, and typed errors. Bun/browser compatibility must be proven. No authority writes; read projection only. | Eventual first adapter after gates. |
| Comunica | Strongest TS-native and browser/federated story; docs cover CLI, JS apps, browser, HTTP querying, caching, federated querying, JSON-LD, and GraphQL. | More framework surface than the current contract needs. Better for querying decentralized RDF sources than for one local projection. Effect wrapping is ergonomic, but runtime footprint and query behavior need focused benchmarks. | Track as fallback if federated RDF becomes the real requirement. |
| Jena Fuseki | Mature SPARQL 1.1 server, standalone or embedded, with TDB persistence and endpoint configuration. | JVM/server process, endpoint security, deployment, and lifecycle ops are too heavy for local-first desktop/web v1. Good interoperability lab, poor default app dependency. | Reject for v1; use only as external conformance/reference harness. |
| None / keep unsupported | Matches locked v1 non-goal and avoids premature graph-store semantics. | Leaves SPARQL consumers unable to execute sidecar queries. That is acceptable until concrete queries exist. | Current decision. |

## Recommendation B: SHACL Engine

Recommendation: deliberately keep the bounded in-repo SHACL validator for M4
shape authoring. Do not replace it for M4. If M4 later needs broader SHACL Core,
prefer backing the existing contract with `rdf-ext/shacl-engine`; do not adopt
`shacl-js`, and do not run `pySHACL` as a service unless a separate service
topology decision explicitly accepts Python/server ops.

Reasoning: M4 actually needs `targetClass`, `minCount`, `maxCount`, and
`datatype` to validate intake and ClaimGate shape contracts. The repo already
documents exactly that bounded subset, and the adapter implements only that
subset. A real engine adds value only when shapes need logical constraints,
enumerations, node-kind, closed shapes, property paths beyond a single named
node, or SPARQL constraints.

| Option | Fit | Tradeoffs | Verdict |
| --- | --- | --- | --- |
| Keep bounded validator | Exact fit for M4's current shape features and service contract. Deterministic, Effect-native, easy to test, no new runtime semantics. | Not full SHACL. It will reject or ignore legitimate future SHACL patterns until the contract is widened. | Keep for M4. |
| `rdf-ext/shacl-engine` | Best future JS/RDF/JS-backed engine. Project describes a fast RDF/JS SHACL engine with browser playground/client-side use and optional SPARQL support. | Need adapter mapping to current typed violation report, max-result truncation, and deterministic fixture behavior. Optional SPARQL constraints must stay disabled unless SPARQL is separately gated. | Preferred upgrade path after gates. |
| `shacl-js` | Historical JavaScript SHACL API from TopQuadrant. | Search evidence says it is not actively maintained and points users toward newer implementations. | Reject. |
| `pySHACL` as service | Comprehensive Python validator with CLI/REST-service options and advanced SHACL support. | Python service topology, packaging, lifecycle, and cross-runtime error mapping are poor fit for local-first TS/Bun unless explicitly accepted. | Reference/conformance only; no v1 service. |

## Recommendation C: OWL RL/EL Inference

Recommendation: do not run OWL RL or EL inference in v1 intake or query paths.
If inference becomes useful, run it offline as a batch projection over pinned
ontology/vendor slices and accepted projection tables, then write derived rows
with provenance and source-version metadata. Never let inferred triples become
accepted legal fact without the same evidence/ClaimGate authority path.

Reasoning: W3C OWL 2 Profiles exist to make reasoning tractable in different
ways: EL for large ontologies, QL for large instance data/query rewriting, and
RL for scalable rule-style reasoning. That is useful for deriving lookup edges,
subsumption closures, and classification helper rows. It is not needed to admit
legal claims from documents. Runtime inference during ingestion would obscure
which source span, event, or human/policy boundary caused an accepted edge.

| Placement | Fit | Tradeoffs | Verdict |
| --- | --- | --- | --- |
| Offline batch over projections | Best fit. Can materialize derived `broader`, `narrower`, `subClassOf`, role/norm, or scheme-closure rows with ontology version and derivation activity. | Requires stale-projection invalidation and batch reproducibility. Queries must distinguish asserted vs inferred rows. | Preferred later path. |
| At ingestion | Can enrich candidates before validation. | Blurs candidate vs accepted state and can create untraceable edges before evidence admission. Adds latency and hard-to-debug inference effects. | Reject for v1. |
| Runtime query inference | Flexible for ad hoc semantic queries. | Turns sidecar semantics into query-time authority and complicates reproducibility. Bad fit for local-first apps and evidence-driven legal answers. | Reject for v1. |
| None | Safest for M1/M4. | Misses convenience closures until batch inference exists. | Current v1 decision. |

## Recommendation D: LinkML

Recommendation: use LinkML only as generator inspiration and external
interoperability reference. Do not adopt LinkML as the polyglot schema hub, and
do not make LinkML YAML the source of truth.

Reasoning: LinkML is good at authoring YAML schemas and generating JSON-LD,
JSON Schema, SQL, RDF, ShEx/SHACL-adjacent artifacts, docs, and validators. That
is exactly why it is useful to study for exporters, documentation, and test
fixtures. But the repo doctrine is Effect-Schema-first: source authority lives
in schema-first domain models, typed errors, EventLog records, evidence spans,
and provenance. Moving the hub to LinkML would create a second schema authority
and invert `goals/semantic-foundation`.

| Option | Fit | Tradeoffs | Verdict |
| --- | --- | --- | --- |
| Adopt as polyglot schema hub | Strong generator ecosystem and non-TS interoperability. | Violates Effect Schema authority, duplicates model ownership, and creates YAML-first drift from runtime schemas. | Reject. |
| Use as generator inspiration | Lets the repo borrow ideas for JSON-LD/SHACL/SQL/docs generation while keeping Effect Schema as the model source. | Requires writing repo-native generators or adapters instead of taking LinkML output directly. | Adopt this stance. |
| Reject completely | Avoids dependency and doctrine risk. | Leaves useful generator patterns and interoperability vocabulary on the table. | Too strict. |

## Recommendation E: Projection Patterns

Recommendation: project ontology-shaped data into Postgres/PGlite tables first,
with pgvector side tables for retrieval. Keep FalkorDB as a later optional graph
read model and Graphiti/Zep-style memory as a bounded temporal/session cache.
Neither FalkorDB nor Graphiti owns legal facts.

Postgres/PGlite should store the operational semantic read model beside the rest
of the local-first app data. RDF/JSON-LD/Turtle remains an interchange sidecar
generated from the same rows and accepted authority records. SPARQL, if later
added, queries a rebuilt RDF sidecar derived from those tables, not an
independent graph store.

Recommended projection tables and roles:

| Projection | Rows | Authority source | Query role |
| --- | --- | --- | --- |
| `semantic_concept_scheme` | Scheme IRI, label, version, source, edition, license posture, manifest pointer. | Repo-owned taxonomy seed, vetted vendor manifest, EventLog. | Load scheme metadata, edition pinning. |
| `semantic_concept` | Concept IRI, scheme, notation, status, local authority flag. | Effect Schema registry/loader and repo-owned seed. | Taxonomy lookup, filing-path derivation. |
| `semantic_concept_label` | `prefLabel`, `altLabel`, `hiddenLabel`, language, source. | SKOS seed/vendor slice. | Search, UI labels, classifier hints. |
| `semantic_concept_note` | definition, scope note, editorial note, provenance. | SKOS/DCTerms/curated notes. | Agent grounding packets. |
| `semantic_concept_relation` | broader, narrower, related, exactMatch, closeMatch, source scheme, asserted/inferred flag. | SKOS mappings, batch inference projection, EventLog. | Hierarchy traversal and FOLIO alignment. |
| `semantic_external_mapping` | Beep IRI to FOLIO/SALI/IPC/CPC/Nice/other target IRI, mapping predicate, confidence, evidence. | P1/P2 verdicts and curated mapping records. | CQ20 audit trail. |
| `claim_graph_node_projection` | Admitted claim/entity node projection with source claim id and lifecycle state. | Accepted claims, evidence spans, DMS links, EventLog. | Two-hop graph traversal in SQL. |
| `claim_graph_edge_projection` | Admitted edge projection with predicate, subject/object ids, evidence span ids, source event id. | Accepted claims and provenance. | Local graph answers and rebuildable KG edges. |
| `semantic_embedding` | Embeddings for concepts, chunks, claims, and graph nodes using pgvector/PGlite pgvector where supported. | Derived from text/source rows. | Retrieval cache only. |
| `rdf_sidecar_snapshot` | Optional named graph export metadata, hash, generated-at, source event range. | Rebuild job over authority/projection tables. | Interchange, validation, SPARQL gate fixtures. |

| Surface | Fit | Tradeoffs | Verdict |
| --- | --- | --- | --- |
| Postgres/PGlite | Matches D6, local-first desktop/web, current `@beep/pglite` driver, and PGlite's browser/Node/Bun positioning. Supports recursive SQL and side-by-side app data. | Recursive graph traversal is less ergonomic than Cypher for deep graph work. Needs disciplined schema/versioning. | Primary projection store. |
| pgvector | Fits local vector retrieval beside relational authority; pgvector supports storing vectors with normal Postgres data and ANN indexes. PGlite exposes a pgvector extension surface. | Embeddings are cache/projection rows. Dimension and model changes need rebuild metadata. | Retrieval cache beside projection tables. |
| FalkorDB | Strong graph/Cypher/GraphRAG read model with full-text/vector features. Existing standards already name it as graph projection direction when a graph engine is needed. | Extra service and projection sync complexity. Not v1, not authority. | Later optional read model after SQL projection proves insufficient. |
| Graphiti/Zep | Good temporal context graph and hybrid retrieval reference; tracks changing facts and provenance to episodes. | Python-first, LLM/embedding-mediated construction, and subject to semantic-memory degradation without bounds. | Managed Layer 2/4 cache only: TTL, pruning, consolidation, provenance back-pointers. |

## Gate Conditions

### SPARQL milestone

Un-gate SPARQL only when all of these are true:

1. A real consumer has at least three concrete `ASK`, `SELECT`, or `CONSTRUCT`
   queries that cannot be answered cleanly by Postgres/PGlite projection tables,
   bounded SHACL validation, or generated JSON-LD/Turtle exports.
2. The query set is read-only over an RDF sidecar snapshot rebuilt from Effect
   Schema records, EventLog events, accepted claims, DMS links, and evidence
   spans. No query result is treated as accepted legal fact without the
   authority path.
3. A fixture corpus exists with pinned repo-owned SKOS data, vetted vendor
   slices, PROV/evidence records, and expected SPARQL results for `ask`,
   `select`, and `construct`.
4. An Oxigraph adapter has passed Bun, desktop sidecar, and browser/PGlite-adjacent
   smoke tests with bounded dataset size, timeout/cancellation behavior, typed
   `SparqlQueryError` mapping, and acceptable bundle/runtime footprint. If it
   fails, Comunica may be re-evaluated only if the failing requirement is
   browser/federated querying rather than embedded local querying.
5. The implementation remains a `SparqlQueryService` layer over a sidecar
   projection. It does not introduce a graph store, SPARQL write path, or
   server dependency into v1.

### M4 SHACL upgrade

Un-gate a real SHACL engine only when all of these are true:

1. M4-authored intake or ClaimGate shapes need at least two SHACL features beyond
   `targetClass`, `minCount`, `maxCount`, and `datatype`, such as `class`,
   `nodeKind`, `in`, `pattern`, `languageIn`, logical constraints, qualified
   value shapes, closed shapes, or property paths.
2. At least three representative legal-intake fixtures fail only because the
   bounded validator lacks those features; the same fixtures still carry source
   spans, DMS links, and provenance.
3. `rdf-ext/shacl-engine` has a passing adapter spike under Bun and the target
   desktop/web runtime, with deterministic report ordering, typed
   `ShaclValidationViolation` mapping, max-result truncation, and optional
   SPARQL constraints disabled unless the SPARQL milestone is separately
   un-gated.
4. The public `ShaclValidationService` contract is preserved or deliberately
   versioned. Existing bounded-shape tests stay green.
5. The engine validates candidates and projections only. It does not make RDF or
   SHACL the authority for legal facts.
