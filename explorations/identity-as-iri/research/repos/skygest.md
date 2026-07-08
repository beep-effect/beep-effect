# skygest repository mining report

All skygest citations are relative to `<local-research-checkout>/skygest`.

## 1. Overview & purpose (what is skygest?)

Skygest is a private Bun/Effect Cloudflare Worker repo named `skygest-cloudflare`: the root manifest declares that name, sets `"private": true`, uses `index.ts` as the module entry, and declares a `packages/*` workspace layout (package.json:1-9). The root scripts show a Worker app lifecycle with `wrangler dev`, `wrangler deploy`, Cloudflare type generation, ontology snapshot building, ontology KV seeding, and data-layer sync commands (package.json:10-27). The root README says installation runs a postinstall fetch that writes pinned ingest artifacts into `.generated/cold-start/`, and it frames the repo as runnable through `bun run index.ts` (README.md:3-11). The repo guide calls it "a Cloudflare Worker built with Effect.ts" and names the main request router as `src/worker/filter.ts` (AGENTS.md:6-12).

The repo has an explicit ontology and data-intelligence side: the `@skygest/ontology-store` package is described as an application-profile graph seam over the `energy-intel` ontology, generating Effect Schema definitions from vendored Turtle modules, shipping SHACL shapes, and exposing per-entity modules with RDF mappings and AI Search projections (packages/ontology-store/README.md:1-14). The app-side data layer says its domain is Variables, Series, and Observations with DCAT-aligned catalog entities (src/domain/data-layer/README.md:1-27). The ingest harness README says adapters normalize provider outputs into Data Catalog Vocabulary candidates, share graph assembly and validation, and currently includes an Energy Institute adapter (src/ingest/dcat-harness/README.md:1-35).

## 2. License

No top-level or nested `LICENSE*`, `COPYING*`, or `NOTICE*` file was found by filename scan; that absence is not file-line-citable, so the citable license evidence is the inspected package metadata and README content. The root manifest contains package metadata, scripts, dependencies, devDependencies, and overrides, but no `license` field (package.json:1-66). The `@skygest/ontology-store` manifest likewise contains package metadata, scripts, dependencies, and peerDependencies, but no `license` field (packages/ontology-store/package.json:1-23). The root README includes setup and contributor notes but no repository code license statement (README.md:1-26). The ontology-store README explains the vendored ontology workflow but no repository code license statement is present there either (packages/ontology-store/README.md:1-74).

Some vendored ontology Turtle files do carry ontology metadata licenses: `agent.ttl` declares `dcterms:license <https://creativecommons.org/licenses/by/4.0/>` for the Energy Intelligence ontology module (packages/ontology-store/vendor/energy-intel/agent.ttl:20-29), and `data.ttl` declares the same license for its ontology module (packages/ontology-store/vendor/energy-intel/data.ttl:15-24). The vendored ontology README says those files are copies from `ontology_skill` pinned to `.upstream-commit` (packages/ontology-store/vendor/energy-intel/README.md:1-22), and the pin value is stored in `.upstream-commit` (packages/ontology-store/vendor/energy-intel/.upstream-commit:1).

Because no repository code license was verified, REFERENCE-ONLY discipline applies - patterns may inform our design, but code is NEVER ported from this repo.

## 3. Identity / IRI / prefix handling

Skygest has more than one identity scheme. The app data layer documents opaque entity URIs in the shape `https://id.skygest.io/{entity-kind}/{prefix}_{ULID}` (src/domain/data-layer/README.md:40-43), and the implementation brands that URI string shape in `EntityUri` while `makeEntityId` constructs the exact `https://id.skygest.io/${kind}/${prefix}_${raw}` value (src/domain/data-layer/ids.ts:5-20). The app domain also brands DID values with a `^did:` pattern and AT-protocol URIs with a `^at://` pattern (src/domain/types.ts:12-34).

The ontology-store identity scheme uses `https://w3id.org/energy-intel/...` IRIs. Generated IRI constants are RDF/JS `NamedNode` values, for example `EI.Expert` and `EI.Organization` point at `https://w3id.org/energy-intel/Expert` and `https://w3id.org/energy-intel/Organization` (packages/ontology-store/src/iris.ts:8-58). Generated entity schemas brand class-specific IRI string patterns such as `ExpertIri`, which must match `https://w3id.org/energy-intel/expert/...` (packages/ontology-store/src/generated/agent.ts:4-15). The hand-written Expert entity derives expert IRIs by replacing colons and whitespace in a handle and prefixing `https://w3id.org/energy-intel/expert/` (packages/ontology-store/src/agent/expert.ts:356-366). The hand-written Post entity converts AT-protocol URIs into `https://w3id.org/energy-intel/post/<sanitized-did>_<rkey>` IRIs (packages/ontology-store/src/content/post.ts:85-111).

Prefix handling is split between parsed Turtle prefixes, generated namespace constants, and registry strings. The vendored `agent.ttl` binds prefixes including `bfo`, `dcterms`, `ei`, `foaf`, `owl`, `rdf`, `rdfs`, `skos`, and `xsd` (packages/ontology-store/vendor/energy-intel/agent.ttl:1-9). The codegen parser records prefixes from Turtle parse output into a `prefixes` record (packages/ontology-store/scripts/codegen/parseTtl.ts:432-453). The generated IRI module emits constants for `EI`, `BFO`, `FOAF`, `IAO`, `RDF`, `RDFS`, `OWL`, `SKOS`, and `XSD` (packages/ontology-store/scripts/codegen/emitIrisModule.ts:1-29). The predicate registry uses CURIE-like string keys such as `iao:mentions`, `ei:authoredBy`, and `bfo:bears` while storing full predicate IRIs next to allowed subject and object entity types (packages/ontology-store/src/Domain/PredicateRegistry.ts:15-36).

Skygest does not expose a single authority-bound identity composer comparable to the handoff D1 shape. Its inspected code derives IRIs in several places: app data-layer IDs come from `ids.ts`, Expert IRIs come from `expert.ts`, Post IRIs come from `post.ts`, post Skygest URIs come from `post-ids.ts`, and generated entity IRIs come from codegen patterns (src/domain/data-layer/ids.ts:5-20; packages/ontology-store/src/agent/expert.ts:356-366; packages/ontology-store/src/content/post.ts:85-111; src/domain/data-layer/post-ids.ts:178-190; packages/ontology-store/src/generated/agent.ts:4-15).

## 4. Vocabulary typing

Vocabulary typing is mostly runtime- and schema-driven. The data layer defines annotation symbols for DCAT class/property, SKOS mapping, schema.org type, SDMX concept, design decision, and XSD datatype metadata (src/domain/data-layer/annotations.ts:1-69). Catalog schemas attach those borrowed vocabulary annotations directly to fields, such as `DcatClass("dcat:Catalog")`, `DcatProperty("dcterms:title")`, and `SchemaOrgType("Dataset")` (src/domain/data-layer/catalog.ts:48-60; src/domain/data-layer/catalog.ts:66-87; src/domain/data-layer/catalog.ts:144-157).

The ontology-store generates vocabulary modules from Turtle rather than hand-maintaining all terms. The generator pipeline parses TTL files into a `ClassTable`, builds JSON Schema, post-processes AST, renders Effect Schema source, emits `iris.ts`, and writes generated files idempotently (packages/ontology-store/scripts/generate-from-ttl.ts:1-26; packages/ontology-store/scripts/generate-from-ttl.ts:109-179). Generated class schemas use branded IRI fields and `Schema.Class` definitions (packages/ontology-store/scripts/codegen/renderSchemaSource.ts:215-244). The generated concept module stores SKOS concept data as literal objects with fields like `iri`, `slug`, `label`, `definition`, `topConcepts`, `broader`, and `narrower` (packages/ontology-store/src/generated/concepts.ts:45-228).

The predicate registry gives a typed registry surface over named predicates. Its `PREDICATES` map is declared `as const`, `PredicateName` is `keyof typeof PREDICATES`, and `TypedLinkInput` carries `predicate`, subject/object IRIs, subject/object types, and optional `effectiveFrom` (packages/ontology-store/src/Domain/PredicateRegistry.ts:15-60). Runtime checks verify whether a supplied subject or object type is included in the registry entry's allowed types (packages/ontology-store/src/Domain/PredicateRegistry.ts:62-72). This is useful vocabulary pressure, but it is not the handoff D3 model of CURIE literal types baked into the composer.

## 5. Triple/graph or other data model

The RDF seam is built on RDF/JS and N3. `RdfQuad` is an N3 `Quad`, and `IRI` is a branded non-empty string in the ontology-store domain (packages/ontology-store/src/Domain/Rdf.ts:6-29). `RdfStore` exposes `makeStore`, `addQuads`, `size`, `query`, `parseTurtle`, and `toTurtle` service methods (packages/ontology-store/src/Service/RdfStore.ts:43-64). The service can add quads to a target graph and parse Turtle into quads (packages/ontology-store/src/Service/RdfStore.ts:76-120), and it serializes quads back to Turtle through N3 `Writer` with default prefixes (packages/ontology-store/src/Service/RdfStore.ts:122-152).

Per-entity ontology modules carry both structural schema and graph projection hooks. `OntologyEntityModule` includes `schema`, `iriOf`, `toTriples`, `fromTriples`, and `AiSearch` members (packages/ontology-store/src/Domain/OntologyEntity.ts:6-18). The Expert module emits `rdf:type` triples for `EI.Expert` and `FOAF.Person`, literal triples for name/DID/bio, and BFO role triples for `bfo:0000053` plus the role IRI (packages/ontology-store/src/agent/expert.ts:130-148). The Post module emits `rdf:type EI.ContentItem`, text, AT URI, DID, and posted-at triples (packages/ontology-store/src/content/post.ts:117-130). The EnergyTopic module emits SKOS `Concept`, preferred label, scheme, top concept, definition, alt label, broader, and narrower triples (packages/ontology-store/src/concept/energy-topic.ts:87-119).

The repo also has a relational graph model for entity links. `EntityLink` includes a link id, triple hash, subject IRI, predicate IRI, optional object IRI or object literal fields, graph IRI, subject/object types, state, source, effective time, confidence, and timestamps (packages/ontology-store/src/Domain/EntityGraph.ts:78-95). Its D1 schema declares `entity_links`, enforces that either `object_iri` or `object_value` is present, and adds indexes across subject, object, predicate, graph, and state fields (packages/ontology-store/src/Domain/EntityGraph.ts:141-209). The app-side data-layer graph declares runtime node and edge unions (src/domain/data-layer/graph.ts:3-51), maps graph edges to ontology CURIE/IRI declarations with direction and cardinality (src/domain/data-layer/graph-ontology-mapping.ts:14-121), and builds traversable graphs with duplicate and reference validation (src/data-layer/DataLayerGraph.ts:401-620).

## 6. Projections/serializations

Skygest has several projection surfaces. RDF triples are serialized to Turtle by `RdfStore.toTurtle` (packages/ontology-store/src/Service/RdfStore.ts:122-152). The data layer provides unidirectional, lossy schema.org JSON-LD codecs for Variables, Series, Observations, Agents, Datasets, Distributions, DataServices, and DatasetSeries (src/domain/data-layer/schema-org.ts:1-14; src/domain/data-layer/schema-org.ts:34-43; src/domain/data-layer/schema-org.ts:52-62; src/domain/data-layer/schema-org.ts:71-78; src/domain/data-layer/schema-org.ts:87-97; src/domain/data-layer/schema-org.ts:107-125; src/domain/data-layer/schema-org.ts:135-146; src/domain/data-layer/schema-org.ts:157-165; src/domain/data-layer/schema-org.ts:175-182). The data-layer README explicitly states that schema.org export codecs are lossy by design while DCAT/RDF remains the canonical graph surface (src/domain/data-layer/README.md:55-57).

The ontology-store projects entities into AI Search and metadata records. The Projection domain defines five canonical metadata fields: `entity_type`, `iri`, `topic`, `authority`, and `time_bucket` (packages/ontology-store/src/Domain/Projection.ts:3-20). `ProjectionContract` carries a contract id, entity type, description, metadata keys, fixture, key function, body function, and metadata function (packages/ontology-store/src/Domain/Projection.ts:38-70). `assertNoMetadataDrift` compares a contract's metadata output keys with the expected metadata key list (packages/ontology-store/src/Domain/Projection.ts:72-89). Expert and Post modules expose unified projections with key/body/metadata functions (packages/ontology-store/src/agent/expert.ts:306-337; packages/ontology-store/src/content/post.ts:316-332).

The runtime catalog and provisioning layer make those projections deployable. Provisioning derives AI Search binding names, namespace names, metadata names, and describable bindings from the entity runtime catalog (packages/ontology-store/src/Provisioning.ts:36-55). The catalog definition checks duplicate tags, projection entity type mismatches, projection fixture type mismatches, metadata drift, and fixture IRI mismatches (packages/ontology-store/src/Provisioning.ts:154-223). The concrete catalog registers Expert, Organization, Post, EnergyTopic, and auto-generated modules (packages/ontology-store/src/Provisioning.ts:225-278).

## 7. Validation approach

Validation is layered. Domain strings are branded with `effect/Schema` checks: DID values must match `^did:`, AT URIs must match `^at://`, HTTPS URLs must match `^https://`, and several date/web annotations are added through schema metadata (src/domain/types.ts:12-34; src/domain/types.ts:49-93). Data-layer entity IDs are branded and pattern-checked as `https://id.skygest.io/...` URIs (src/domain/data-layer/ids.ts:5-20). Generated ontology-store entity IRI brands use class-specific regular expressions (packages/ontology-store/src/generated/agent.ts:4-15).

SHACL validation is treated as a first-class service. The SHACL domain distinguishes severities, violations, validation reports, and engine errors, and a non-conforming report is represented as data instead of thrown as an error (packages/ontology-store/src/Domain/Shacl.ts:5-45). `ShaclService` loads shapes and validates data quads with `shacl-engine`, decodes the report through Effect Schema, and maps unexpected failures to typed `ShaclValidationError` values (packages/ontology-store/src/Service/Shacl.ts:180-242).

The test suite enforces codegen, graph, schema, ID, and RDF behavior. Codegen drift tests compare generated modules, `iris.ts`, and concept constants against committed output (packages/ontology-store/tests/codegen/drift.test.ts:65-151). Data-layer ID tests accept branded IDs and reject wrong kind, plain strings, and too-short ULID suffixes (tests/data-layer-ids.test.ts:9-50). Post ID tests cover Bluesky, Twitter, and chart asset round trips (tests/post-ids.test.ts:84-180). Data-layer graph tests validate graph relationships, traversal, and declared variable edges (tests/data-layer-graph.test.ts:103-187). RDF store tests cover Turtle parsing, querying, serialization, named graphs, and strict parse failure mapping to `RdfError` (packages/ontology-store/tests/Service/RdfStore.test.ts:29-104).

## 8. API ergonomics

The cleanest ergonomics are entity-local: callers derive IDs, call `toTriples`, call `fromTriples`, and use projection contracts without touching a central graph builder.

Representative Post IRI derivation call site (packages/ontology-store/tests/content/post.test.ts:25-33):

```ts
const iri = postIriFromAtUri(
  "at://did:plc:abc/app.bsky.feed.post/3kgvexample"
);
expect(iri).toBe(
  "https://w3id.org/energy-intel/post/did_plc_abc_3kgvexample"
);
```

Representative Expert RDF round-trip call site (packages/ontology-store/tests/agent/expert.test.ts:68-78):

```ts
const original = sampleExpert();
const triples = expertToTriples(original);

const distilled = yield* expertFromTriples(triples, original.iri);
expect(distilled.iri).toBe(original.iri);
expect(distilled.name).toBe(original.name);
expect(distilled.roles.length).toBe(original.roles.length);
expect(distilled.did).toBe(original.did);
```

Representative pure fact and projection-metadata call site (packages/ontology-store/tests/Domain/EntityDefinition.test.ts:48-63):

```ts
const facts = PostEntity.ontology.toTriples(samplePost());
expect(facts.some((fact) => fact.predicate === PREDICATES["ei:authoredBy"].iri)).toBe(true);
expect(PostEntity.render.aiSearch.key(samplePost())).toBe(samplePost().iri);
expect(PostEntity.render.aiSearch.metadata(samplePost()).entity_type).toBe("post");
```

Representative RDF store call site (packages/ontology-store/tests/Service/RdfStore.test.ts:35-47):

```ts
const store = yield* RdfStore.makeStore();
const quads = yield* RdfStore.parseTurtle(turtle);
yield* RdfStore.addQuads(store, quads);

expect(yield* RdfStore.size(store)).toBe(1);
expect(yield* RdfStore.query(store, { predicate: FOAF.name })).toHaveLength(1);

const serialized = yield* RdfStore.toTurtle(store);
expect(serialized).toContain("Ada Lovelace");
```

Representative SHACL validation call site (packages/ontology-store/tests/Service/Shacl.test.ts:96-112):

```ts
const shapes = yield* RdfStore.parseTurtle(shapesTurtle);
const data = yield* RdfStore.parseTurtle(`
  @prefix ex: <https://example.com/> .
  ex:Ada a ex:Expert .
`);

const graph = yield* ShaclService.loadShapes(shapes);
const report = yield* ShaclService.validate(data, graph);

expect(report.conforms).toBe(false);
expect(report.violations).toHaveLength(1);
expect(report.violations[0]?.message).toContain("Name required");
```

Representative schema.org projection call site (tests/data-layer-schema-org.test.ts:205-229):

```ts
const json = datasetToSchemaOrg(dataset);
expect(json["@type"]).toBe("Dataset");
expect(json.name).toBe("EI Monthly Oil Demand");
expect(json.creator?.name).toBe("Energy Institute");
expect(json.includedInDataCatalog?.["@id"]).toBe(sampleCatalog.id);
expect(json.distribution?.[0]?.["@id"]).toBe(distribution.id);
expect(json.variableMeasured?.[0]?.name).toBe("Oil demand");
```

## 9. DIAMONDS

1. Deterministic vendored-vocabulary generation is worth adopting as a clean-room phase 1/phase 3 idea. Skygest pins ontology Turtle inputs, parses them into a class table, emits Effect Schema modules plus `iris.ts`, and tests generated output for drift (packages/ontology-store/vendor/energy-intel/README.md:1-22; packages/ontology-store/scripts/generate-from-ttl.ts:1-26; packages/ontology-store/tests/codegen/drift.test.ts:65-151). This supports D3 and phase 1 if we adapt the idea into our composer-owned CURIE literal types instead of copying Skygest's generator.

2. Entity modules that co-locate schema, identity, triples, reverse mapping, and projections are a strong phase 3/phase 4 shape. Skygest's `OntologyEntityModule` contract names `schema`, `iriOf`, `toTriples`, `fromTriples`, and `AiSearch` together (packages/ontology-store/src/Domain/OntologyEntity.ts:6-18), and Expert/Post modules follow that shape with entity-local triple and projection functions (packages/ontology-store/src/agent/expert.ts:130-180; packages/ontology-store/src/agent/expert.ts:306-337; packages/ontology-store/src/content/post.ts:117-213; packages/ontology-store/src/content/post.ts:316-332). This supports D6, D7, D8, phase 3, and phase 4 as a clean-room module-boundary idea.

3. Projection drift checks are a clean phase 4 idea. Skygest's projection contract declares metadata keys next to fixture/key/body/metadata functions (packages/ontology-store/src/Domain/Projection.ts:38-70), `assertNoMetadataDrift` compares declared keys with emitted metadata (packages/ontology-store/src/Domain/Projection.ts:72-89), and provisioning rejects metadata drift in the runtime catalog (packages/ontology-store/src/Provisioning.ts:154-223). This supports D8 and D9 if we wire equivalent checks to Fibered retrieval annotations and owned/borrowed channels.

4. SHACL validation as report data, not just thrown failure, is useful for phase 3/phase 4 validation. Skygest represents SHACL conformity and violations as a decoded report (packages/ontology-store/src/Domain/Shacl.ts:5-45), and service tests assert both conforming and non-conforming reports (packages/ontology-store/tests/Service/Shacl.test.ts:71-114). This supports D6/D8 by giving projections and graph folds inspectable validation output.

5. Keeping platform identity and graph identity side by side is a useful D4 pressure test. Skygest preserves DIDs and AT URIs as branded values (src/domain/types.ts:12-34) while deriving graph IRIs for posts from AT URIs (packages/ontology-store/src/content/post.ts:85-111) and separate Skygest post URIs from social URIs (src/domain/data-layer/post-ids.ts:178-190). This supports our D4 rule that references should be structured handles, while reminding us not to erase external handles during IRI projection.

6. A graph-to-ontology mapping table is a useful migration artifact for D3/D6/D7. Skygest maps runtime graph edge kinds to ontology CURIEs, IRIs, declarations, direction, cardinality, and notes (src/domain/data-layer/graph-ontology-mapping.ts:14-121). The clean-room adoption is not the specific mappings, but the idea of a checked table during phase 3 fold/projection work.

## 10. ROUGH

1. Inline predicates appear when the TTL vocabulary does not declare needed terms. Expert defines inline `ei:bio` and `ei:did` nodes because they are not declared in `agent.ttl` (packages/ontology-store/src/agent/expert.ts:99-112), and Post defines inline text/AT URI/DID/posted-at predicates for the same reason (packages/ontology-store/src/content/post.ts:48-56). For our D3/D9 design, this is an anti-pattern: borrowed vocabulary terms and owned terms need explicit channels instead of local ad hoc nodes.

2. The base ontology-store `IRI` brand accepts any non-empty string, even though its comment says it is for absolute IRIs (packages/ontology-store/src/Domain/Rdf.ts:6-19). Our D1/D4 implementation should make absolute IRI, CURIE, and handle distinctions statically sharper than a non-empty string brand.

3. Some ontology snapshot parsing uses regex over TTL-like text and mints placeholder `http://example.org/ontology/energy-news#...` IRIs (src/ontology/buildSnapshot.ts:137-176). That contradicts our D1 authority-binding discipline and is too fragile for phase 1 vocabulary grounding.

4. `postIriFromAtUri` throws a plain `Error` for invalid AT URIs (packages/ontology-store/src/content/post.ts:85-111). In this repo's Effect-first style, the equivalent path should use typed errors or schema decode failures rather than untyped exceptions.

5. Auto-generated runtime modules emit only an `rdf:type` triple and treat reverse mapping as minimal schema decode (packages/ontology-store/src/Domain/AutoEntity.ts:80-112). That is acceptable as a bootstrap, but our D6/D7 fold design needs predicate-open facts and property inference rather than class-only graph presence.

6. Relation targets and predicate registrations still rely on string entity type names. `RelationDeclaration` stores `target: string` (packages/ontology-store/src/Domain/EntityDefinition.ts:20-26), and the predicate registry stores allowed subject and object entity types as string arrays (packages/ontology-store/src/Domain/PredicateRegistry.ts:15-36). That contradicts D4's "references are handles, never strings" direction.

## 11. D1-D9 DELTA TABLE

| Decision | Skygest stance | Verdict |
| --- | --- | --- |
| D1: total authority binding at root | Skygest uses several authority roots and derivation sites: `https://id.skygest.io/...` for app data-layer IDs, `https://w3id.org/energy-intel/...` for ontology-store entities, inline `https://skygest.dev/vocab/post#...` predicates, and `http://example.org/ontology/energy-news#...` snapshot IRIs (src/domain/data-layer/ids.ts:5-20; packages/ontology-store/src/generated/agent.ts:4-15; packages/ontology-store/src/content/post.ts:48-56; src/ontology/buildSnapshot.ts:137-176). | contradicts |
| D2: slash IRIs by default | Skygest's main generated and derived entity IRIs are slash-style, including `https://id.skygest.io/<kind>/<prefix>_<ULID>`, `https://w3id.org/energy-intel/expert/...`, and `https://w3id.org/energy-intel/post/...` (src/domain/data-layer/ids.ts:5-20; packages/ontology-store/src/agent/expert.ts:356-366; packages/ontology-store/src/content/post.ts:85-111). | supports |
| D3: borrowed vocab CURIE literal type baked into composer | Skygest has prefix constants, generated `NamedNode` vocabulary constants, annotation symbols, and CURIE-like predicate keys, but no inspected composer-baked CURIE literal type; the predicate registry's CURIE-shaped keys remain a runtime registry surface (packages/ontology-store/src/iris.ts:8-106; src/domain/data-layer/annotations.ts:28-69; packages/ontology-store/src/Domain/PredicateRegistry.ts:15-60). | supports |
| D4: references are handles, never strings | Skygest brands many external handles and IRIs, including DID, AT URI, HTTPS URL, and entity URI (src/domain/types.ts:12-34; src/domain/data-layer/ids.ts:5-20), but relation declarations and predicate registry subject/object types still use string names (packages/ontology-store/src/Domain/EntityDefinition.ts:20-26; packages/ontology-store/src/Domain/PredicateRegistry.ts:15-36). | contradicts |
| D5: predicate local names default to struct key | Skygest's codegen derives schema property identifiers from the final IRI segment or fragment and sanitizes them before rendering schema fields (packages/ontology-store/scripts/codegen/renderSchemaSource.ts:91-97), and catalog schemas put vocabulary annotations next to struct fields (src/domain/data-layer/catalog.ts:66-87). | supports |
| D6: relational facts are triples-as-tuples, predicate-open | Skygest models RDF quads, entity facts, entity links, and per-entity triple emitters; its graph link schema stores subject IRI, predicate IRI, object IRI/value/datatype, graph IRI, and evidence metadata (packages/ontology-store/src/Domain/Rdf.ts:21-29; packages/ontology-store/src/Domain/EntityDefinition.ts:7-18; packages/ontology-store/src/Domain/EntityGraph.ts:78-95; packages/ontology-store/src/agent/expert.ts:130-148). | supports |
| D7: relational fact location open; fold channel first | Skygest places facts in several locations: per-entity `toTriples`, entity definitions, a predicate registry, D1 entity-link tables, and app-side graph builders (packages/ontology-store/src/Domain/OntologyEntity.ts:6-18; packages/ontology-store/src/Domain/EntityDefinition.ts:39-53; packages/ontology-store/src/Domain/PredicateRegistry.ts:15-36; packages/ontology-store/src/Domain/EntityGraph.ts:141-209; src/data-layer/DataLayerGraph.ts:401-620). | supports |
| D8: Fibered kit for metadata retrieval | Skygest does not implement our Fibered kit, but it does bind projection contracts, metadata drift checks, entity runtime catalog entries, AI Search projection shapes, and entity search hydration by IRI or query (packages/ontology-store/src/Domain/Projection.ts:38-89; packages/ontology-store/src/Provisioning.ts:154-278; src/domain/entitySearch.ts:81-134). | supports |
| D9: owned/borrowed annotation channels never share a key | Skygest separates annotation symbols for DCAT, SKOS, schema.org, SDMX, design decisions, and XSD (src/domain/data-layer/annotations.ts:1-69), but some undeclared owned terms are inline-minted in entity modules instead of going through a separate owned vocabulary channel (packages/ontology-store/src/agent/expert.ts:99-112; packages/ontology-store/src/content/post.ts:48-56). | supports |

## 12. "What would we do differently"

Skygest is most valuable to us as reference material for module boundaries, projection contracts, drift checks, and validation surfaces, not as an implementation source. The repo demonstrates that ontology-backed entity work benefits from deterministic vocabulary generation, entity-local RDF mappings, projection metadata contracts, and SHACL report data (packages/ontology-store/scripts/generate-from-ttl.ts:1-26; packages/ontology-store/src/Domain/OntologyEntity.ts:6-18; packages/ontology-store/src/Domain/Projection.ts:38-89; packages/ontology-store/src/Domain/Shacl.ts:5-45).

We would make the identity system stricter than Skygest. Instead of multiple derivation sites for `id.skygest.io`, `w3id.org/energy-intel`, `skygest.dev/vocab/post`, and placeholder `example.org` namespaces (src/domain/data-layer/ids.ts:5-20; packages/ontology-store/src/agent/expert.ts:356-366; packages/ontology-store/src/content/post.ts:48-56; src/ontology/buildSnapshot.ts:137-176), our D1/D2 path should force every owned IRI through one root-bound composer, with explicit rebase for any hash namespace. Instead of non-empty string IRI branding and plain `Error` throws (packages/ontology-store/src/Domain/Rdf.ts:6-19; packages/ontology-store/src/content/post.ts:85-111), our implementation should use static IRI/CURIE/handle schemas and typed errors.

We would keep Skygest's useful clean-room ideas but route them through the handoff phases: phase 1 gets deterministic vocab ingestion plus typed CURIEs, phase 2 binds all identity through the composer, phase 3 folds triples/projections through schema-owned handles, and phase 4 adds Fibered retrieval metadata plus drift checks. Because no repository code license was verified, the closing verdict is reference-only: learn from the architectural pressure, do not port code (package.json:1-66; packages/ontology-store/package.json:1-23; README.md:1-26; packages/ontology-store/README.md:1-74).

## 13. Sources

Comparison baseline read before mining:

- <repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md
- <repo-root>/explorations/identity-as-iri/assets/exploration-report-2026-07-01.md
- <repo-root>/explorations/identity-as-iri/DECISIONS.md
- <repo-root>/scratchpad/identity/README.md

Skygest files inspected:

- README.md
- package.json
- AGENTS.md
- packages/ontology-store/README.md
- packages/ontology-store/package.json
- packages/ontology-store/vendor/energy-intel/README.md
- packages/ontology-store/vendor/energy-intel/.upstream-commit
- packages/ontology-store/vendor/energy-intel/agent.ttl
- packages/ontology-store/vendor/energy-intel/data.ttl
- packages/ontology-store/src/iris.ts
- packages/ontology-store/src/index.ts
- packages/ontology-store/src/Domain/Rdf.ts
- packages/ontology-store/src/Domain/Shacl.ts
- packages/ontology-store/src/Domain/EntityDefinition.ts
- packages/ontology-store/src/Domain/EntityGraph.ts
- packages/ontology-store/src/Domain/PredicateRegistry.ts
- packages/ontology-store/src/Domain/Projection.ts
- packages/ontology-store/src/Domain/OntologyEntity.ts
- packages/ontology-store/src/Domain/AutoEntity.ts
- packages/ontology-store/src/Service/RdfStore.ts
- packages/ontology-store/src/Service/Shacl.ts
- packages/ontology-store/src/Service/EntityProjectionRegistry.ts
- packages/ontology-store/src/Provisioning.ts
- packages/ontology-store/src/agent/expert.ts
- packages/ontology-store/src/agent/organization.ts
- packages/ontology-store/src/content/post.ts
- packages/ontology-store/src/concept/energy-topic.ts
- packages/ontology-store/src/auto-entities.ts
- packages/ontology-store/src/generated/agent.ts
- packages/ontology-store/src/generated/concepts.ts
- packages/ontology-store/scripts/generate-from-ttl.ts
- packages/ontology-store/scripts/codegen/emitIrisModule.ts
- packages/ontology-store/scripts/codegen/parseTtl.ts
- packages/ontology-store/scripts/codegen/renderSchemaSource.ts
- packages/ontology-store/tests/codegen/drift.test.ts
- packages/ontology-store/tests/Domain/Shacl.test.ts
- packages/ontology-store/tests/Domain/EntityDefinition.test.ts
- packages/ontology-store/tests/Service/Shacl.test.ts
- packages/ontology-store/tests/Service/RdfStore.test.ts
- packages/ontology-store/tests/agent/expert.test.ts
- packages/ontology-store/tests/content/post.test.ts
- packages/ontology-store/tests/package.test.ts
- src/domain/types.ts
- src/domain/bi.ts
- src/domain/entitySearch.ts
- src/domain/data-layer/README.md
- src/domain/data-layer/annotations.ts
- src/domain/data-layer/ids.ts
- src/domain/data-layer/catalog.ts
- src/domain/data-layer/alias.ts
- src/domain/data-layer/graph.ts
- src/domain/data-layer/graph-ontology-mapping.ts
- src/domain/data-layer/schema-org.ts
- src/domain/data-layer/post-ids.ts
- src/data-layer/DataLayerGraph.ts
- src/ontology/canonical.ts
- src/ontology/catalog.ts
- src/ontology/buildSnapshot.ts
- src/ingest/dcat-harness/README.md
- src/ingest/dcat-harness/IngestNode.ts
- src/ingest/dcat-harness/IngestEdge.ts
- src/ingest/dcat-harness/validate.ts
- src/ingest/dcat-harness/buildGraph.ts
- src/ingest/dcat-harness/ledger.ts
- tests/data-layer-ids.test.ts
- tests/post-ids.test.ts
- tests/data-layer-graph.test.ts
- tests/data-layer-schema-org.test.ts
