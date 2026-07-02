## 1. Overview & purpose — what IS ontosphere (platform? editor? toolkit?).

- Verdict: Ontosphere is a browser-based RDF/OWL knowledge-graph editor with agent-facing control surfaces, not a standalone identity-composer toolkit; the README describes it as a “Browser-based RDF knowledge-graph editor with client-side OWL 2 DL reasoning, reasoner-verified repair, and a Model Context Protocol server for AI agents.” `/home/elpresidank/YeeBois/dev/ontosphere/README.md:3-5`
- The product scope is editor/platform shaped: it loads RDF files, URLs, and SPARQL endpoints; lets users author nodes and edges; runs OWL 2 DL reasoning through Konclude WASM; suggests repairs; exposes MCP tools; and keeps data browser-local with no backend. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:19-20`
- The architecture overview says the app combines a Reactodia canvas, OWL 2 DL reasoning, namespace management, workflow catalog, MCP support, and an in-memory RDF store running in Web Workers. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:64-66`
- The package identity is a Vite/React TypeScript app named `ontosphere`, versioned `1.5.2`, with package license `Apache-2.0`. `/home/elpresidank/YeeBois/dev/ontosphere/package.json:2-5`
- The dependency set confirms RDF/editor/reasoning platform scope: it includes `@rdfjs/data-model`, `@rdfjs/dataset`, `@reactodia/workspace`, `n3`, `rdf-canonize`, `rdf-parse`, `rdf-reasoner-konclude`, `shacl-engine`, and `sparqljs`. `/home/elpresidank/YeeBois/dev/ontosphere/package.json:99-135`

## 2. License — verify in-repo (LICENSE looked Apache-2.0; confirm by quoting the exact path and license header/text you found). Discipline: verified MIT/Apache-2.0 → mark port-with-attribution; missing/unverified/other → mark REFERENCE-ONLY.

- In-repo license header quote: `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE:1` is `Apache License`; `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE:2` is `Version 2.0, January 2004`; `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE:3` is `http://www.apache.org/licenses/`. `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE:1-3`
- Package metadata independently declares `"license": "Apache-2.0"`. `/home/elpresidank/YeeBois/dev/ontosphere/package.json:2-5`
- Discipline verdict: `port-with-attribution`, because Apache-2.0 is verified by both the root `LICENSE` header and package metadata. `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE:1-3` `/home/elpresidank/YeeBois/dev/ontosphere/package.json:2-5`

## 3. Identity / IRI / prefix handling.

- Ontosphere has a runtime namespace registry with a default prefix `""`, default URI `http://example.com/`, and a `NamespaceEntry` shape containing `prefix`, `uri`, optional `namespace`, and optional `color`. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/namespaces.ts:1-4`
- Namespace maps are normalized and converted through helper functions rather than through type-level composers. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/namespaces.ts:11-40`
- The MCP IRI helper has built-in prefixes for `rdf`, `rdfs`, `owl`, `xsd`, `foaf`, `skos`, `dc`, `dcterms`, `schema`, and `ex`, then merges in a dynamic namespace registry getter. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:6-35`
- Runtime IRI expansion accepts blank nodes and already-schemed values, expands `prefix:local`, and returns an `"Unknown prefix:"` error string when the prefix is not registered. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:38-73`
- The UI-side term utilities find the longest matching namespace for an IRI, expand prefixed forms, and contract IRIs to prefixed display values at runtime. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/termUtils.ts:128-211`
- A separate provider utility shortens IRIs from a prefix map and falls back to a local-name extraction when no prefix matches. `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/prefixShorten.ts:1-7`
- The React prefix context is a mutable map from prefix to namespace URI. `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/PrefixContext.ts:3-7`
- Well-known vocabulary handling is a large runtime registry: `WELL_KNOWN_PREFIXES` is the preferred prefix array and includes W3C/core prefixes such as `rdf`, `rdfs`, `owl`, `xsd`, and `skos`. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/wellKnownOntologies.ts:1-54`
- Runtime ontology lookup resolves a load target by prefix first, then namespace URL, then passes unknown inputs through unchanged. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/wellKnownOntologies.ts:663-672`
- MCP namespace tools expose `setNamespace` as an upsert into `rdfManager.addNamespace` and `listNamespaces` as the current registry read. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/namespaceTools.ts:6-25` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/namespaceTools.ts:57-66`
- Loaded RDF prefixes are merged into the manager for data and ontology graphs, then persisted and pushed to the worker. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1136-1173`
- New canvas entities can be generated as `namespaceUri + TypeLocalName + "_" + counter`, so generated identity is runtime/counter based rather than derived from a total root authority. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/iriUtils.ts:17-25`
- The README explicitly documents namespace management as runtime behavior, including renaming a URI and propagating the change across triples. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:107-112`

## 4. Vocabulary typing (literal types? codegen? runtime?).

- Vocabulary support is runtime constant-table based: `vocabularies.ts` centralizes W3C URI constants for RDF, RDFS, OWL, XSD, and SHACL. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/vocabularies.ts:1-5`
- The RDF, RDFS, OWL, XSD, and SHACL objects expose URI strings and convenience exports, not generated CURIE literal unions. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/vocabularies.ts:13-96`
- Well-known ontology typing is built around `as const` registry entries and derived pack metadata, but the registry entries are loaded/queried at runtime. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/wellKnownOntologies.ts:1-13` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/wellKnownOntologies.ts:520-639`
- MCP tool typing is JSON Schema at runtime: `McpToolManifestEntry.inputSchema` is `JSONSchema7`. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/types.ts:1-8`
- `addNode`, `addTriple`, `setNamespace`, and `updateNode` schemas accept `iri`, `typeIri`, `subjectIri`, `predicateIri`, `objectIri`, `prefix`, `namespace`, and property values as strings. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:187-203` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:258-281` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:490-499` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:527-538`
- Domain-display typing exists for ontology/editor models: `RDFType` is a string union for UI/model categories, while `LiteralProperty` stores `datatype` and `language` as optional strings. `/home/elpresidank/YeeBois/dev/ontosphere/src/types/ontology.ts:126-135` `/home/elpresidank/YeeBois/dev/ontosphere/src/types/ontology.ts:154-166`
- Literal construction is runtime based: the node property editor expands `xsd:` manually, expands other prefixed datatypes when possible, creates language-tagged literals for `@lang`, and otherwise creates plain literals. `/home/elpresidank/YeeBois/dev/ontosphere/src/components/Canvas/NodePropertyEditor.tsx:475-507` `/home/elpresidank/YeeBois/dev/ontosphere/src/components/Canvas/NodePropertyEditor.tsx:997-1007`
- Not found in repo: a compile-time CURIE/literal vocabulary type layer or vocabulary code generator. Searched `src`, `scripts`, and `package.json` for `effect/Schema`, `@effect/schema`, `zod`, `io-ts`, `codegen`, `generate.*vocab`, `Curie`, and `CURIE`; the positive source evidence found for authoring contracts is runtime JSON Schema and runtime constant tables. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/types.ts:1-8` `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/vocabularies.ts:1-96`

## 5. Triple/graph data model.

- Ontosphere models RDF terms and quads with serializable worker shapes: `WorkerQuad` has `subject`, `predicate`, `object`, and `graph`, and `predicate` is a `WorkerNamedNode`. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts:10-35`
- Term serialization preserves literal language and datatype, with `xsd:string` omitted as the default datatype. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts:98-125`
- Quad serialization and deserialization are explicit conversion functions between runtime RDF terms and worker-safe data. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts:127-181`
- The provider converter has a parallel `WorkerTerm`/`WorkerQuad` shape and converts worker quads back to RDF/JS terms. `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/quadConverter.ts:1-39`
- The manager declares the default data graph as `urn:vg:data` and maintains an IRI regex for graph/term handling. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:35-36`
- The worker assigns graph roles: `urn:vg:data` and `urn:vg:ontologies` are reasoning inputs, while `urn:vg:inferred`, `urn:vg:shapes`, `urn:vg:workflows`, and `urn:vg:provenance` are excluded from reasoning input. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:291-320`
- Dataset exports know the named graph set `urn:vg:data`, `urn:vg:inferred`, `urn:vg:shapes`, `urn:vg:ontologies`, and `urn:vg:workflows`. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:3760-3771`
- Reactodia-facing data only searches data and inferred graphs, while schema lookup includes data, inferred, and ontologies graphs. `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/N3DataProvider.ts:116-146`
- The data provider indexes subjects, types, inferred markers, schema-allowed graphs, inferred links, structural groups, and view-mode-filtered search results. `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/N3DataProvider.ts:245-311` `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/N3DataProvider.ts:582-755`
- UI node data carries identity fields such as `key`, `iri`, `rdfTypes`, `primaryTypeIri`, display labels, literal/annotation/inferred properties, and layer metadata. `/home/elpresidank/YeeBois/dev/ontosphere/src/types/canvas.ts:16-71`
- UI link data carries `source`, `target`, `propertyUri`, `propertyPrefixed`, `propertyType`, `rdfType`, and `isInferred`. `/home/elpresidank/YeeBois/dev/ontosphere/src/types/canvas.ts:110-140`
- `addTriple` builds a one-quad sync batch, and `applyBatch` builds sync batches with actual addition/removal deltas. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1419-1440` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1465-1532`
- Worker `syncBatch` removes and adds quads, records changed signatures, deduplicates, and counts actual additions/removals. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:4924-5065`

## 6. Projections/serializations.

- The README says Ontosphere imports Turtle, N-Triples, N-Quads, TriG, JSON-LD, and RDF/XML, and exports Turtle, JSON-LD, RDF/XML, N-Quads, TriG, SVG, PNG, and CSV. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:210-214`
- RDF manager import/export helpers infer media type from filename and content, and JSON-LD has an explicit context resolver path. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:67-180`
- MCP `exportGraph` dispatches graph export for Turtle, JSON-LD, RDF/XML, N-Quads, and TriG. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:392-438`
- The manager exposes `exportToTurtle`, `exportToJsonLD`, and `exportToRdfXml`, and separate dataset-faithful `exportToNQuads` and `exportToTriG` paths. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1605-1672`
- Canonicalization exports N-Quads, parses them, filters graph/inferred content according to options, canonicalizes, and hashes the result. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1674-1716`
- Worker export normalization tracks `dropGraph` and `dataset` flags, with dataset exports spanning all configured named graphs. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:3730-3771`
- Worker export distinguishes dataset export across all graphs from single-graph export that includes requested graph quads plus data-grounded inferred quads. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:4331-4401`
- Single-graph formats deskolemize blank nodes and drop graph names, while dataset formats preserve named graph structure. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:4403-4434`
- JSON-LD and RDF/XML serializers are implemented manually in the worker, while Turtle, TriG, and N-Quads use the N3 writer. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:4438-4548`
- MCP `canonicalizeGraph` returns canonical output, a hash, and quad count. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:746-780`

## 7. Validation approach.

- The README describes a reasoning stack where Konclude WASM provides complete tableau reasoning for SROIQ(D), while an N3 backend exists as a BGP-only fallback. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:272-287`
- The README describes SHACL validation and says shapes load into `urn:vg:shapes`. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:291-307`
- MCP SHACL tools load SHACL content into `urn:vg:shapes`, validate through `rdfManager.runShaclValidation`, and can load shapes from URLs. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/shacl.ts:10-82`
- Worker SHACL validation checks the shapes graph against data plus inferred graphs and uses `shacl-engine`, SPARQL, RDF/JS data-model, and RDF/JS dataset packages. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:2267-2349`
- MCP `runReasoning` defaults to Konclude with an N3 fallback and SHACL enabled by default. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:132-184`
- MCP `explainDiagnostics` combines reasoning, inconsistency justifications, unsatisfiable classes, OWL profile checks, SHACL validation, repair suggestions, and verification. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:243-447`
- The manager wrapper delegates `runReasoning` and `runShaclValidation` into the worker and returns structured payloads. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:718-790`
- Worker Konclude reasoning clears stale inferred triples for full runs, writes inferred triples, and runs SHACL after reasoning. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:5474-5624`
- Worker N3 reasoning is implemented as a fallback path. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:5880-6105`
- OWL profile checking is a pragmatic structural detector for object/data property misuse, object/datatype conflicts, and literal-in-`rdf:type` cases. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/owlProfile.ts:4-37` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/owlProfile.ts:153-220`
- A separate `graphValidation.ts` helper is effectively empty: it documents that a lightweight helper was removed and always returns an empty array. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/graphValidation.ts:1-19`

## 8. API ergonomics — quote representative authoring call sites verbatim (with file:line).

- Browser automation example, quoted verbatim from `/home/elpresidank/YeeBois/dev/ontosphere/README.md:590-591`:

```ts
await page.evaluate(async ([name, params]) => window.__mcpTools[name](params),
  ['addNode', { iri: 'ex:alice', typeIri: 'foaf:Person', label: 'Alice' }]);
```

- JSON-RPC class authoring example, quoted verbatim from `/home/elpresidank/YeeBois/dev/ontosphere/docs/mcp-demo/pizza-tutorial.md:443`:

```json
`{"jsonrpc":"2.0","id":128,"method":"tools/call","params":{"name":"addNode","arguments":{"iri":"http://www.pizza-ontology.com/pizza.owl#VegetarianPizza","typeIri":"http://www.w3.org/2002/07/owl#Class","label":"VegetarianPizza"}}}`
```

- JSON-RPC subclass assertion example, quoted verbatim from `/home/elpresidank/YeeBois/dev/ontosphere/docs/mcp-demo/pizza-tutorial.md:444`:

```json
`{"jsonrpc":"2.0","id":129,"method":"tools/call","params":{"name":"addTriple","arguments":{"subjectIri":"http://www.pizza-ontology.com/pizza.owl#VegetarianPizza","predicateIri":"http://www.w3.org/2000/01/rdf-schema#subClassOf","objectIri":"http://www.pizza-ontology.com/pizza.owl#NamedPizza"}}}`
```

- JSON-RPC instance edge example, quoted verbatim from `/home/elpresidank/YeeBois/dev/ontosphere/docs/mcp-demo/pizza-tutorial.md:511`:

```json
`{"jsonrpc":"2.0","id":85,"method":"tools/call","params":{"name":"addTriple","arguments":{"subjectIri":"http://www.pizza-ontology.com/pizza.owl#pizza1","predicateIri":"http://www.pizza-ontology.com/pizza.owl#hasTopping","objectIri":"http://www.pizza-ontology.com/pizza.owl#mozz1"}}}`
```

- Implementation call site for atomic node authoring, quoted verbatim from `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/nodes.ts:79-83`:

```ts
const adds: Array<{ s: string; p: string; o: string }> = [];
for (const t of typeIris) adds.push({ s: iri, p: RDF_TYPE, o: t });
if (label) adds.push({ s: iri, p: RDFS_LABEL, o: label });
if (adds.length > 0) {
  await rdfManager.applyBatch({ adds });
```

- Implementation call site for triple authoring, quoted verbatim from `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/links.ts:79`:

```ts
rdfManager.addTriple(subjectIri, predicateIri, objectIri);
```

- Ergonomic summary: Ontosphere’s authoring API is easy for agents because the manifest documents a workflow of `loadOntology`, `setNamespace`, `addNode`, `addTriple`, `runLayout`, `runReasoning`, `getGraphState`, and `exportImage`; the same manifest exposes those authoring parameters as runtime strings. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:23-27` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:187-203` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:258-281`

## 9. DIAMONDS — patterns worth adopting; explicitly map each onto D1–D9 and onto handoff phases (phase 1 vocab+CURIE types, phase 2 composer binding, phase 3 fold+projections, phase 4 Fibered+retrieval).

| Pattern worth adopting | Ontosphere evidence | D1-D9 mapping | Handoff phase mapping |
| --- | --- | --- | --- |
| Prefix expansion should fail loudly at the boundary. | Unknown prefixes return an `"Unknown prefix:"` error before mutations proceed. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:38-73` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/nodes.ts:53-71` | Supports D3’s borrowed-vocabulary surface, but our version should make the error impossible for typed CURIEs. | Phase 1: keep the boundary behavior as a runtime backstop behind typed vocab+CURIE inputs. |
| A named-graph partition makes projection and reasoning boundaries inspectable. | Data and ontology graphs are reasoning inputs, while inferred, shapes, workflows, and provenance graphs are excluded; exports know the dataset graph set. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:291-320` `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:3760-3771` | Supports D6 triples-as-tuples and informs D7 fact-location choices. | Phase 3: use graph partitions in fold/projection tests; Phase 4: use them as Fibered retrieval channels. |
| Dataset-faithful exports are a strong proof surface. | N-Quads and TriG export all named graphs, while canonicalization produces canonical output, hash, and quad count. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1641-1716` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:746-780` | Supports D6 and D7 by making relational facts externally checkable. | Phase 3: fold+projection proof should include dataset-faithful N-Quads/TriG and canonical hash checks. |
| Reasoning plus validation plus repair is the right user-facing loop. | `explainDiagnostics` combines reasoning, justifications, unsatisfiable classes, OWL profile checks, SHACL, repair suggestions, and repair verification. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:243-447` | Supports D6’s explicit facts and helps D8’s retrieval/repair posture. | Phase 4: Fibered+retrieval should expose diagnostics as first-class projections. |
| MCP workflow docs are useful as executable ergonomics tests. | The manifest documents a recommended workflow from ontology loading through authoring, reasoning, graph-state checks, and export. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:23-29` | Supports D4 only as an ergonomics test; our implementation should replace string IRI arguments with handles. | Phase 2: composer binding should generate the authoring handles; Phase 3: fold+projection should pass the workflow without stringly calls. |
| Provenance should be kept out of semantic reasoning and export by default. | The README says provenance is excluded from reasoning, SHACL, and export, and the MCP manifest describes `urn:vg:provenance` as an agent-edit record graph excluded from reasoning/SHACL/export. `/home/elpresidank/YeeBois/dev/ontosphere/README.md:443-466` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:20-21` | Supports D8 and informs D9’s separation of owned annotations from borrowed/provenance metadata. | Phase 4: Fibered+retrieval should isolate provenance/retrieval graphs from semantic projections. |

## 10. ROUGH — anti-patterns to avoid, and why.

| Anti-pattern to avoid | Ontosphere evidence | Why we should avoid it |
| --- | --- | --- |
| Stringly identity at the authoring boundary. | `addNode` and `addTriple` accept `iri`, `typeIri`, `subjectIri`, `predicateIri`, and `objectIri` as strings. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:187-203` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:258-281` | It contradicts D3 typed CURIEs and D4 handle-only references. |
| Multiple prefix systems with overlapping responsibilities. | Prefix behavior appears in MCP IRI utilities, term utilities, a prefix-shortening provider, and React prefix context. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:6-73` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/termUtils.ts:128-211` `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/prefixShorten.ts:1-7` `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/PrefixContext.ts:3-7` | It is the opposite of D1’s single total root authority and makes D3 prefix behavior harder to reason about. |
| Counter-generated default IRIs. | The default namespace is `http://example.com/`, and generated entity IRIs use namespace URI plus type local name plus counter. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/namespaces.ts:1-4` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/iriUtils.ts:17-25` | D1 and D2 need deterministic composer-derived IRIs, not UI-generation counters. |
| Validation surface spread across a no-op helper, profile detector, SHACL, and reasoner diagnostics. | `graphValidation.ts` always returns an empty array, while OWL profile checks, SHACL validation, and reasoning diagnostics live elsewhere. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/graphValidation.ts:1-19` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/owlProfile.ts:153-220` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/shacl.ts:10-82` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:243-447` | Our fold should have one obvious validation/projection path, then optional diagnostics layered on top. |
| Single-graph exports can erase named-graph boundaries. | Worker export drops graph names for single-graph formats and preserves dataset boundaries only for dataset exports. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:4331-4434` | D6 and D7 need projection tests that distinguish lossy display/export formats from canonical dataset proofs. |
| Manual serializers in the worker. | JSON-LD and RDF/XML are manually assembled in the worker, while N3 writer handles Turtle, TriG, and N-Quads. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:4438-4548` | Prefer standard projection libraries unless a hand-rolled serializer is required and heavily tested. |

## 11. D1–D9 DELTA TABLE — one row per decision D1 through D9: what ontosphere does vs what our handoff decided, verdict (supports / contradicts / silent).

| Decision | Our handoff decided | What ontosphere does | Verdict |
| --- | --- | --- | --- |
| D1 | Total root authority binding; composers derive `.iri` and `.curie` mechanically. | Ontosphere uses mutable/default namespace maps and runtime namespace upserts, and generated entity IRIs can be counter-based. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/namespaces.ts:1-40` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/namespaceTools.ts:6-25` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/iriUtils.ts:17-25` | contradicts |
| D2 | Slash IRIs are mechanical; hash IRIs come through explicit `rebase`. | Ontosphere accepts and resolves prefixes/namespaces at runtime, and well-known ontology loading resolves prefix or namespace URL before passing unknown values through. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:38-73` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/wellKnownOntologies.ts:663-672` | silent |
| D3 | Borrowed vocab is a CURIE literal type in the composer, with inverse syntax such as `^rdfs:subClassOf`. | Ontosphere has preloaded prefixes and runtime expansion errors, but MCP schemas still accept `typeIri`, `predicateIri`, and related fields as strings. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:6-73` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:187-203` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:258-281` | contradicts |
| D4 | References are handles, never strings. | Ontosphere authoring examples and implementation paths pass raw IRI strings into `addNode`, `addTriple`, `applyBatch`, and `rdfManager.addTriple`. `/home/elpresidank/YeeBois/dev/ontosphere/docs/mcp-demo/pizza-tutorial.md:443-444` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/nodes.ts:79-83` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/links.ts:79` | contradicts |
| D5 | Predicate local names default to struct keys. | Ontosphere authoring requires explicit predicate IRI strings in `addTriple`, and update properties use explicit `predicateIri` strings. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:258-281` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:527-538` | contradicts |
| D6 | Relational facts are triples-as-tuples; datatype/object is inferred from the AST. | Ontosphere stores RDF as quads, serializes terms with literal datatype/language, and exposes add/apply batch paths for `{ s, p, o }` changes. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts:10-35` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts:98-181` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1419-1532` | supports |
| D7 | Location of relational facts remains open; fold first. | Ontosphere places facts in an RDF store with named graph roles and exposes them through graph projections, but it does not show a schema-AST fold channel. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:291-320` `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:3760-3771` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:392-438` | silent |
| D8 | Build a Fibered kit. | Ontosphere has retrieval-adjacent graph partitioning, provenance exclusion, reasoning diagnostics, and export/canonicalization surfaces, but no Fibered kit was found in the searched repo. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:291-320` `/home/elpresidank/YeeBois/dev/ontosphere/README.md:443-466` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:243-447` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:746-780` | silent |
| D9 | Owned and borrowed annotation keys are separated. | Ontosphere stores literal and annotation properties with string predicate/datatype fields, and provenance is isolated as a separate graph excluded from reasoning/SHACL/export. `/home/elpresidank/YeeBois/dev/ontosphere/src/types/ontology.ts:126-149` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:527-538` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:20-21` | silent |

## 12. What would we do differently — closing verdict, synthesized from sections above.

- Closing verdict: use Ontosphere as `port-with-attribution` reference material for projection, validation, and agent-workflow ideas, because its Apache-2.0 license is verified in both the root license and package metadata. `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE:1-3` `/home/elpresidank/YeeBois/dev/ontosphere/package.json:2-5`
- Keep the named-graph partition idea, because Ontosphere’s data/ontology/inferred/shapes/workflows/provenance graph split gives a concrete model for separating asserted facts, inference, validation shapes, workflows, and provenance. `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:291-320` `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts:3760-3771`
- Keep dataset-faithful projections and canonical hash proofs, because Ontosphere’s N-Quads/TriG exports and canonicalization path create a strong external proof surface. `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts:1641-1716` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:746-780`
- Keep the diagnostics loop shape, because Ontosphere combines OWL reasoning, SHACL validation, profile checks, repair suggestions, and verification behind MCP diagnostics. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:243-447`
- Do not copy the string-first identity surface, because Ontosphere’s MCP API accepts raw string IRIs/predicates and expands them at runtime. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:187-203` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts:258-281` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:38-73`
- Do not copy counter-generated/default identity, because Ontosphere’s default namespace is `http://example.com/` and generated entity IRIs can include a counter. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/namespaces.ts:1-4` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/iriUtils.ts:17-25`
- Do not copy the scattered prefix/validation shape, because Ontosphere spreads prefix handling across multiple utilities and contains a no-op validation helper alongside other validation paths. `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts:6-73` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/termUtils.ts:128-211` `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/prefixShorten.ts:1-7` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/graphValidation.ts:1-19`
- Our implementation should use Ontosphere’s graph/projection/diagnostic diamonds behind the D1-D9 handoff constraints: typed vocab+CURIEs first, composer-bound handles second, schema fold plus dataset projections third, and Fibered retrieval with isolated provenance fourth. `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/vocabularies.ts:1-96` `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts:10-181` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts:392-438` `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts:243-447`

## 13. Sources — list every file path you inspected in ontosphere.

- `/home/elpresidank/YeeBois/dev/ontosphere/LICENSE`
- `/home/elpresidank/YeeBois/dev/ontosphere/README.md`
- `/home/elpresidank/YeeBois/dev/ontosphere/package.json`
- `/home/elpresidank/YeeBois/dev/ontosphere/docs/mcp-demo/pizza-tutorial.md`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/namespaces.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/constants/vocabularies.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/components/Canvas/NodePropertyEditor.tsx`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/manifest.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/types.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/graph.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/iriUtils.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/links.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/namespaceTools.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/nodes.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/reasoning.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/mcp/tools/shacl.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/N3DataProvider.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/PrefixContext.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/RdfMetadataProvider.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/prefixShorten.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/providers/quadConverter.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/stores/ontologyStore.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/stores/shaclResultStore.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/types/canvas.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/types/ontology.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/graphValidation.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/iriUtils.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/owlProfile.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.impl.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfManager.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/rdfSerialization.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/reasoningTypes.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/termUtils.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/utils/wellKnownOntologies.ts`
- `/home/elpresidank/YeeBois/dev/ontosphere/src/workers/rdfManager.runtime.ts`
