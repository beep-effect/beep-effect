## 1. Overview & purpose

The mined repo is an Effect-TS ontology-guided extraction system: its README says it extracts structured knowledge graphs from unstructured text using ontology-guided LLM prompting, and it frames the implementation as a functional/type-safe Effect-TS pipeline over OWL ontologies. `README.md:1-3`

Its documented pipeline is Turtle RDF -> graph/builder -> `OntologyContext` -> prompt fold -> `KnowledgeIndex` -> LLM -> `KnowledgeGraph` JSON -> RDF quads -> SHACL validation and Turtle output. `README.md:41-63`

The closest reusable prior art for our identity-as-IRI packet is not its authoring surface but its RDF store boundary, ontology parser, local-name extraction constraints, SHACL service, and projection plumbing; the handoff locks our design around literal-preserving `$I`, CURIE predicates, triples-as-tuples, and Effect v4 services. `README.md:65-69`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-122`

Version target: manifests and lockfile target Effect v3; root dependencies include `@effect/schema` `^0.75.5` and `effect` `^3.19.6`, the core package depends on `effect` `^3.19.13`, `bun.lock` resolves `@effect/schema@0.75.5` and `effect@3.19.13`, and source files import `Schema` from `"effect"` while service files still use `Context.Tag` or `Effect.Service`. `package.json:35-56`; `packages/@core-v2/package.json:36-69`; `bun.lock:761`; `bun.lock:1553`; `packages/@core-v2/src/Domain/Rdf/Types.ts:11`; `packages/@core-v2/src/Service/Shacl.ts:11-15`; `packages/@core-v2/src/Service/Shacl.ts:165-168`; `packages/@core-v2/src/Service/Ontology.ts:486-488`

Effect v4 translation: keep the mined repo's `Schema` usage conceptually, but import schemas as `effect/Schema`, and migrate `Context.Tag` or v3 `Effect.Service` boundaries to v4 `ServiceMap.Service`, because the handoff says `Context.Tag` does not exist in v4 and `@effect/schema` is deprecated. `packages/@core-v2/src/Domain/Rdf/Types.ts:11`; `packages/@core-v2/src/Service/Shacl.ts:165-168`; `packages/@core-v2/src/Service/OntologyRegistry.ts:67-70`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:31-33`

## 2. License — verify in-repo (LICENSE file, package.json "license"); quote the exact path and the exact text found. Apply this discipline explicitly: verified MIT/Apache license → mark "port-with-attribution"; missing or unverifiable license → mark "REFERENCE-ONLY (patterns, never code)".

`package.json` contains the exact field text `"license": "MIT"`. `package.json:12`

`LICENSE` contains the exact title text `MIT License`. `LICENSE:1`

`LICENSE` contains the exact copyright text `Copyright (c) 2024-present mkessy`. `LICENSE:3`

`LICENSE` contains the MIT permission grant beginning with `Permission is hereby granted, free of charge, to any person obtaining a copy` and continuing through permission to `use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software`. `LICENSE:5-10`

`LICENSE` requires the copyright and permission notice in copies or substantial portions of the software. `LICENSE:12-13`

`LICENSE` contains the standard MIT warranty disclaimer beginning `THE SOFTWARE IS PROVIDED "AS IS"` and ending with liability language for claims arising from use of the software. `LICENSE:15-21`

License verdict: verified MIT license -> `port-with-attribution`. `package.json:12`; `LICENSE:1-21`

## 3. Identity / IRI / prefix handling (how entities/terms get identities; is literal preservation supported?)

Identity is runtime-oriented: RDF IRIs are branded strings in `Domain/Rdf/Types.ts`, and a separate utility validates IRI shape with a regex before N3 operations. `packages/@core-v2/src/Domain/Rdf/Types.ts:13-34`; `packages/@core-v2/src/Utils/Rdf.ts:19-35`

Entity IRIs are built by concatenating a base namespace and a local name, then decoding the result through `IriSchema`. `packages/@core-v2/src/Utils/Rdf.ts:37-55`

The default RDF config supplies `baseNamespace: "http://example.org/kg/"`, an output format default of Turtle, and runtime prefix strings for schema/rdf/rdfs/owl/xsd. `packages/@core-v2/src/Service/Config.ts:215-226`; `packages/@core-v2/src/Service/Config.ts:322-331`

The ontology registry gives an ontology short id, ontology IRI, storage path, imports, and a `targetNamespace` for entities. `packages/@core-v2/registry.json:6-20`

Storage identity is separate from RDF identity: the path schema is `ontologies/{namespace}/{name}/{hash}/ontology.ttl`, while `OntologyRef`-style identity is modeled elsewhere as namespace/name/hash data rather than as the `$I` composer path. `packages/@core-v2/src/Domain/PathLayout.ts:24-32`; `packages/@core-v2/registry.json:6-20`

Local-name handling extracts the substring after the last slash or hash, so both slash and hash vocabularies can be projected to local names. `packages/@core-v2/src/Utils/Iri.ts:108-113`

The safe local-name map tracks collisions and reports whether multiple IRIs share the same lowercase local name, but its returned map still stores the last IRI for the colliding local name. `packages/@core-v2/src/Utils/Iri.ts:129-187`

The deprecated local-name map is still exposed and explicitly warns that it silently overwrites collisions by last-write-wins behavior. `packages/@core-v2/src/Utils/Iri.ts:189-203`

Literal RDF values are preserved at runtime with lexical value, optional language, and optional datatype fields. `packages/@core-v2/src/Domain/Rdf/Types.ts:75-120`

N3 literals are converted back to the domain `Literal` while preserving language and datatype where present. `packages/@core-v2/src/Service/Rdf.ts:55-65`

Language-tagged literals can be emitted from `{ value, language }` objects during RDF conversion. `packages/@core-v2/src/Utils/Rdf.ts:318-330`

The repo does not preserve identity or CURIE values as TypeScript literal types through a composer; constants are asserted to branded `IRI`, and the handoff requires static literal IRIs/CURIEs that are grep-harvestable and not runtime-computed. `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-20`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:40-46`

## 4. Vocabulary typing (literal types? codegen? runtime constants?)

Vocabulary typing is runtime-constant based: RDF, OWL, XSD, and other vocabularies are exported as `as const` objects whose values are full IRI strings asserted by `iri(value: string): IRI`. `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-20`; `packages/@core-v2/src/Domain/Rdf/Constants.ts:26-37`; `packages/@core-v2/src/Domain/Rdf/Constants.ts:62-93`; `packages/@core-v2/src/Domain/Rdf/Constants.ts:138-149`

Known external vocabulary metadata is a runtime record keyed by full vocabulary namespace strings and carrying prefix/name/publisher/specUrl metadata. `packages/@core-v2/src/Domain/Rdf/Constants.ts:446-490`

The LLM schema layer accepts local names for classes, validates them case-insensitively against ontology class IRIs, and normalizes to canonical local names. `packages/@core-v2/src/Schema/EntityFactory.ts:107-166`

The relation schema layer accepts local names for properties, validates them case-insensitively against ontology property IRIs, and later expands them to full IRIs after extraction. `packages/@core-v2/src/Schema/RelationFactory.ts:57-115`; `packages/@core-v2/src/Schema/RelationFactory.ts:166-177`

The authoring instructions embedded in the entity schema require local names for types and explicitly reject full URIs at extraction time. `packages/@core-v2/src/Schema/EntityFactory.ts:330-348`

The authoring instructions embedded in the relation schema require local names for predicates and explicitly reject full URIs at extraction time. `packages/@core-v2/src/Schema/RelationFactory.ts:283-305`

This differs from the handoff: our Phase 1 requires generated or curated vocab data that derives `Curie`, `Predicate`, and `Expand` literal types, with total expand/contract codecs and schema errors for unknown prefixes. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:130-162`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`

## 5. Triple/graph data model

The RDF model defines `RdfTerm` as a union of `IRI`, `BlankNode`, or `Literal`. `packages/@core-v2/src/Domain/Rdf/Types.ts:122-139`

`Triple` is a `Schema.Class` with subject as IRI or blank node, predicate as IRI, and object as any RDF term. `packages/@core-v2/src/Domain/Rdf/Types.ts:141-182`

`Quad` extends the triple shape with an optional graph IRI and can discard graph information through `toTriple()`. `packages/@core-v2/src/Domain/Rdf/Types.ts:184-245`

The RDF service hides N3 behind an opaque `RdfStore` wrapper and exposes query patterns with nullable wildcard fields. `packages/@core-v2/src/Service/Rdf.ts:25-50`

Store queries convert domain terms to N3 terms, query `N3.Store`, and return domain `Quad` objects. `packages/@core-v2/src/Service/Rdf.ts:493-515`

Store merging uses RDF set semantics by adding quads into an N3 store and returning only the count of newly added quads. `packages/@core-v2/src/Service/Rdf.ts:1151-1174`

The extraction data model is separate from the RDF data model: `Entity` carries a snake_case id, mention, type strings, and attribute key/value pairs. `packages/@core-v2/src/Domain/Model/Entity.ts:98-162`

`Relation` carries `subjectId`, string `predicate`, scalar-or-string `object`, optional evidence, and an `isEntityReference` heuristic that treats lowercase snake_case strings as entity references. `packages/@core-v2/src/Domain/Model/Entity.ts:303-389`

`KnowledgeGraph` is an extraction result with arrays of `Entity` and `Relation` plus optional source text. `packages/@core-v2/src/Domain/Model/Entity.ts:431-495`

Entity conversion builds a subject IRI from base namespace plus entity id, emits rdf:type triples, label triples, and attribute triples. `packages/@core-v2/src/Utils/Rdf.ts:432-475`

Relation conversion builds subject and object IRIs from entity ids when `isEntityReference` is true and otherwise emits literal objects. `packages/@core-v2/src/Utils/Rdf.ts:505-530`

The handoff requires relational facts as triples-as-tuples with predicate-open CURIE literal types and datatype/object property inference from the AST, so the mined repo's runtime relation objects are implementation prior art rather than the target authoring grammar. `packages/@core-v2/src/Domain/Model/Entity.ts:303-389`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105`

## 6. Projections/serializations (JSON-LD, Turtle, etc.)

The RDF service parses Turtle into an N3-backed `RdfStore`. `packages/@core-v2/src/Service/Rdf.ts:441-456`

The RDF service parses TriG into an N3-backed `RdfStore` with named graph support. `packages/@core-v2/src/Service/Rdf.ts:458-481`

The RDF service serializes stores to Turtle with configured prefixes and a 30-second timeout. `packages/@core-v2/src/Service/Rdf.ts:970-1003`

The RDF service serializes stores to TriG with configured prefixes and named graph information. `packages/@core-v2/src/Service/Rdf.ts:1005-1047`

The path layout reserves output names for JSON, resolved graph, Turtle, and JSON-LD artifacts, including `graph.ttl` and `graph.jsonld`. `packages/@core-v2/src/Domain/PathLayout.ts:111-128`

The config exposes `JSON-LD` as an allowed output format; the cited RDF service projection surface inspected for this report is Turtle and TriG parse/serialize. `packages/@core-v2/src/Service/Config.ts:217-219`; `packages/@core-v2/src/Service/Rdf.ts:441-481`; `packages/@core-v2/src/Service/Rdf.ts:970-1047`

The README's final RDF example is Turtle. `README.md:157-168`

Our handoff requires JSON-LD context/projection, Turtle projection, Markdown projection, and later SHACL projection as assembled pure projections from `$I.ontology`. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`

## 7. Validation approach (SHACL? custom? schema-level?)

The repo has schema-level validation for RDF primitives, including branded IRI, blank node, literal, triple, and quad schemas. `packages/@core-v2/src/Domain/Rdf/Types.ts:13-245`

The repo has schema-level validation for ontology extraction classes/properties through generated entity and relation schemas. `packages/@core-v2/src/Schema/EntityFactory.ts:107-166`; `packages/@core-v2/src/Schema/RelationFactory.ts:57-115`

The repo also has a dedicated SHACL service that imports `shacl-engine`, SPARQL validations, and Effect service primitives. `packages/@core-v2/src/Service/Shacl.ts:1-15`

The SHACL service interface exposes `validate`, `loadShapes`, `generateShapesFromOntology`, cache controls, and policy-based validation. `packages/@core-v2/src/Service/Shacl.ts:93-139`

The default SHACL layer parses shapes through the RDF builder before handing N3 stores to validation. `packages/@core-v2/src/Service/Shacl.ts:289-307`

SHACL validation constructs a `ShaclValidator`, validates an N3 dataset, maps focus node/path/value/message/severity/source shape, and records graph sizes and duration. `packages/@core-v2/src/Service/Shacl.ts:310-356`

SHACL shape generation scans `owl:Class`, `owl:ObjectProperty`, `owl:DatatypeProperty`, `owl:FunctionalProperty`, and OWL restrictions to produce node/property shapes with class, datatype, nodeKind, minCount, and maxCount constraints. `packages/@core-v2/src/Service/Shacl.ts:385-606`

Policy validation can log only, fail on violations, or fail on warnings according to `ValidationPolicy`. `packages/@core-v2/src/Service/Shacl.ts:618-727`

The RDF builder still contains a separate placeholder `validate` method that always returns `conforms: true` with the report text `SHACL validation not yet implemented`, so validation behavior is split between a real SHACL service and an obsolete RDF-builder placeholder. `packages/@core-v2/src/Service/Rdf.ts:1202-1215`; `packages/@core-v2/src/Service/Shacl.ts:310-356`

The checked-in core shapes file includes concrete SHACL node shapes and SPARQL constraints, including `TrackedEntityShape`, `TrackedEventShape`, temporal consistency, and confidence score constraints. `ontologies/core/shapes.ttl:19-29`; `ontologies/core/shapes.ttl:75-90`; `ontologies/core/shapes.ttl:123-162`

## 8. API ergonomics — what does authoring an ontology/class/property look like? Quote representative call sites verbatim with file:line.

Ontology authoring is primarily Turtle-first; the checked-in core ontology declares prefixes and a base IRI at the top of the Turtle file. `ontologies/core/core.ttl:1-10`

The ontology header is ordinary OWL/RDFS/DCTERMS Turtle:

```turtle
<http://effect-ontology.dev/core> a owl:Ontology ;
    rdfs:label "Effect Core Ontology"@en ;
    rdfs:comment "Extends DUL with Entity/Event/Mention modeling for ontology-guided knowledge extraction."@en ;
    owl:versionInfo "1.0.0" ;
    dcterms:created "2024-12-25"^^xsd:date ;
    dcterms:creator <https://github.com/pooks> ;
    owl:imports <http://www.ontologydesignpatterns.org/ont/dul/DUL.owl> .
```

Source: `ontologies/core/core.ttl:27-33`

Class authoring is ordinary OWL class Turtle:

```turtle
:Person a owl:Class ;
    rdfs:subClassOf :TrackedEntity, dul:Agent ;
    rdfs:label "Person"@en ;
    skos:prefLabel "Person"@en ;
    skos:example "John Smith, CEO of Acme Corp"@en ;
    rdfs:comment "A human individual tracked across documents."@en .
```

Source: `ontologies/core/core.ttl:81-86`

Object property authoring is ordinary OWL property Turtle with domain/range and inverse metadata:

```turtle
:hasEvidentialMention a owl:ObjectProperty ;
    rdfs:subPropertyOf dul:isReferenceOf ;
    rdfs:label "has evidential mention"@en ;
    rdfs:comment "Links a TrackedEntity or TrackedEvent to text spans that evidence its existence."@en ;
    skos:scopeNote "Use from ENTITY/EVENT perspective: 'JohnSmith hasEvidentialMention mention_123'. Prefer this over 'mentions'."@en ;
    rdfs:domain [ a owl:Class ;
                  owl:unionOf ( :TrackedEntity :TrackedEvent ) ] ;
    rdfs:range :Mention .
```

Source: `ontologies/core/core.ttl:118-125`

Datatype property authoring is ordinary OWL datatype property Turtle:

```turtle
:name a owl:DatatypeProperty , owl:FunctionalProperty ;
    rdfs:subPropertyOf dul:hasDataValue ;
    rdfs:label "name"@en ;
    rdfs:comment "The canonical name of the entity."@en ;
    rdfs:domain :TrackedEntity ;
    rdfs:range xsd:string .
```

Source: `ontologies/core/core.ttl:215-220`

Schema authoring from ontology classes constructs `ClassDefinition` values and passes them to `makeEntitySchema`:

```ts
    const classes = [
      new ClassDefinition({
        id: iri("http://schema.org/Person"),
        label: "Person",
        comment: "A person",
        properties: []
      }),
      new ClassDefinition({
        id: iri("http://schema.org/Organization"),
        label: "Organization",
        comment: "An organization",
        properties: []
      })
    ]

    const schema = makeEntitySchema(classes)
```

Source: `packages/@core-v2/test/Schema/EntityFactory.test.ts:31-46`

Relation schema authoring constructs `PropertyDefinition` values and passes valid entity ids plus properties to `makeRelationSchema`:

```ts
    const validEntityIds = ["cristiano_ronaldo", "al_nassr"]
    const properties = [
      new PropertyDefinition({
        id: "http://schema.org/memberOf",
        label: "member of",
        comment: "Organization membership",
        domain: [],
        range: [],
        rangeType: "object"
      })
    ]

    const schema = makeRelationSchema(validEntityIds, properties)
```

Source: `packages/@core-v2/test/Schema/RelationFactory.test.ts:59-71`

Extraction authoring uses local names for predicates in the structured relation payload:

```ts
    const validRelation = {
      relations: [
        {
          subjectId: "cristiano_ronaldo",
          predicate: "memberOf", // Local name, not full IRI
          object: "al_nassr" // Entity reference
        }
      ]
    }
```

Source: `packages/@core-v2/test/Schema/RelationFactory.test.ts:75-83`

RDF-building ergonomics use an Effect scope, a mutable RDF store handle, and service methods:

```ts
        const turtle = yield* Effect.gen(function*() {
          const store = yield* RdfBuilder.makeStore
          yield* RdfBuilder.addEntities(store, [entity])
          return yield* RdfBuilder.toTurtle(store)
        }).pipe(Effect.scoped)
```

Source: `packages/@core-v2/test/RdfBuilder.test.ts:37-42`

Compared to the handoff, the mined repo authors the ontology in Turtle and derives extraction schemas from parsed ontology classes/properties, while our target authors owned ontology facts at `$I.key`, `$I.class`, and `$I.ontology` call sites with static CURIE predicates and schema handles. `ontologies/core/core.ttl:1-10`; `packages/@core-v2/test/Schema/EntityFactory.test.ts:31-46`; `packages/@core-v2/test/Schema/RelationFactory.test.ts:59-83`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:204-260`

## 9. DIAMONDS — patterns worth adopting. For each diamond: state why, and explicitly tag which of D1-D9 or which handoff phase (Phase 1 vocab+CURIE types, Phase 2 composer binding, Phase 3 fold+projections, Phase 4 Fibered+retrieval) it informs.

1. Collision-aware local-name maps are worth adopting because CURIE/local-name ergonomics need a place to reject ambiguous local names instead of silently choosing a namespace; this informs D3, D4, and Phase 1 vocab+CURIE types. `packages/@core-v2/src/Utils/Iri.ts:129-187`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-95`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`

2. The RDF term model is worth adopting as a runtime substrate because it cleanly models IRI, blank node, literal, triple, and quad terms with language/datatype support; this informs D6 and Phase 3 fold+projections, even though our authoring grammar should remain triples-as-tuples. `packages/@core-v2/src/Domain/Rdf/Types.ts:75-245`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

3. The opaque N3 store boundary is worth adopting because it keeps parser/writer backend details out of domain code while preserving query and serialization operations; this informs Phase 3 fold+projections and Phase 4 retrieval. `packages/@core-v2/src/Service/Rdf.ts:25-50`; `packages/@core-v2/src/Service/Rdf.ts:441-515`; `packages/@core-v2/src/Service/Rdf.ts:970-1047`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`

4. The ontology parser is worth adapting because it extracts OWL classes, object/datatype/functional properties, subclass/subproperty hierarchy, SKOS metadata, inverse links, equivalent classes, and blank-node `owl:unionOf` lists from Turtle; this informs Phase 3 fold+projections. `packages/@core-v2/src/Service/Ontology.ts:119-180`; `packages/@core-v2/src/Service/Ontology.ts:182-263`; `packages/@core-v2/src/Service/Ontology.ts:278-319`; `packages/@core-v2/src/Service/Ontology.ts:321-465`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

5. Local-name extraction schemas are worth adopting as an LLM-facing projection because they reduce prompt tokens, constrain outputs to ontology terms, and normalize casing; this informs D5 and Phase 3 fold+projections. `packages/@core-v2/src/Schema/EntityFactory.ts:107-166`; `packages/@core-v2/src/Schema/RelationFactory.ts:57-115`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:96-99`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

6. The SHACL generation and policy validation service is worth porting conceptually because it derives shape constraints from ontology structure and applies severity policy explicitly; this informs Phase 4 Fibered+retrieval and the handoff's SHACL projection. `packages/@core-v2/src/Service/Shacl.ts:385-606`; `packages/@core-v2/src/Service/Shacl.ts:618-727`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:351-354`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:403-409`

7. The registry resolver is worth adopting as a retrieval boundary because it accepts ontology id, IRI, storage path, and GCS URI forms and resolves them to entries or paths; this informs D8 and Phase 4 Fibered+retrieval. `packages/@core-v2/src/Service/OntologyRegistry.ts:115-201`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-118`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:325-328`

8. Named graph provenance metadata is worth adopting because extraction runs can carry PROV-O and DCTERMS triples in a graph-scoped channel; this informs Phase 4 Fibered+retrieval and provenance-oriented retrieval. `packages/@core-v2/src/Service/Rdf.ts:681-759`; `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md:19-25`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:403-409`

## 10. ROUGH — anti-patterns to avoid, and why.

1. Avoid carrying Effect v3 service style forward: the mined repo uses `Context.Tag` and v3-style `Effect.Service`, while the baseline requires Effect v4 `ServiceMap.Service` and `effect/Schema`. `packages/@core-v2/src/Service/Shacl.ts:11-15`; `packages/@core-v2/src/Service/Shacl.ts:165-168`; `packages/@core-v2/src/Service/Ontology.ts:486-488`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:31-33`

2. Avoid runtime-computed IRIs in the authoring layer: the mined repo builds IRIs by concatenating base namespace and local name, while the baseline bans runtime-computed identity/CURIE interpolation and requires static literal harvestability. `packages/@core-v2/src/Utils/Rdf.ts:37-55`; `packages/@core-v2/src/Utils/Rdf.ts:432-442`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:40-46`

3. Avoid branded strings as a substitute for literal-preserving vocab types: the mined repo asserts constants to `IRI`, while the baseline requires CURIE literal types, literal-preserving `Expand`, and total codecs. `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-20`; `packages/@core-v2/src/Domain/Rdf/Constants.ts:26-37`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:150-162`

4. Avoid string relation references: the mined repo models `subjectId`, `predicate`, and `object` as strings/scalars and uses a lowercase snake_case heuristic for entity references, while the baseline requires references as schema handles, known CURIEs, or absolute IRI literals. `packages/@core-v2/src/Domain/Model/Entity.ts:326-389`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`

5. Avoid silently-colliding local-name expansion: the deprecated map still advertises last-write-wins collision behavior, and the schema factories call the deprecated map rather than the safe result. `packages/@core-v2/src/Utils/Iri.ts:189-203`; `packages/@core-v2/src/Schema/EntityFactory.ts:132-134`; `packages/@core-v2/src/Schema/RelationFactory.ts:82-84`

6. Avoid split validation APIs where one surface is real and another is a placeholder: the RDF builder returns a hardcoded conforming SHACL result, while the separate SHACL service performs actual validation. `packages/@core-v2/src/Service/Rdf.ts:1202-1215`; `packages/@core-v2/src/Service/Shacl.ts:310-356`

7. Avoid namespace conversion that treats a full target namespace as a path segment: the registry stores `targetNamespace` as a full IRI, while `addEntities` and `addRelations` prepend the base domain and append `options.targetNamespace`, which can double-IRI if given that registry value. `packages/@core-v2/registry.json:20`; `packages/@core-v2/src/Service/Rdf.ts:550-559`; `packages/@core-v2/src/Service/Rdf.ts:604-613`

8. Avoid promising projection formats ahead of the cited service surface: config and path layout mention JSON-LD, while the inspected RDF service surface cited here is Turtle and TriG parse/serialize. `packages/@core-v2/src/Service/Config.ts:217-219`; `packages/@core-v2/src/Domain/PathLayout.ts:111-128`; `packages/@core-v2/src/Service/Rdf.ts:441-481`; `packages/@core-v2/src/Service/Rdf.ts:970-1047`

9. Avoid annotation key overloading: the mined repo uses generic schema `identifier` annotations for extraction schemas, while the baseline reserves owned `identifier` for `@beep` identities and sends borrowed predicates through a dedicated `term` slot. `packages/@core-v2/src/Schema/EntityFactory.ts:330-348`; `packages/@core-v2/src/Schema/RelationFactory.ts:283-305`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:119-122`

## 11. D1-D9 DELTA TABLE — a markdown table, one row per decision D1 through D9: what this repo does vs. what the handoff locks, and a verdict of supports / contradicts / silent.

| Decision | effect-ontology behavior | Handoff lock | Verdict |
|---|---|---|---|
| D1 | Uses runtime RDF config, registry ids/IRIs/storage paths, and `targetNamespace`; it does not bind every composer path to `.iri`/`.curie` at a root authority. `packages/@core-v2/src/Service/Config.ts:215-226`; `packages/@core-v2/registry.json:6-20` | Root `make("beep", { authority, prefix, vocab })` derives every composer `.iri`/`.curie` mechanically. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-78` | silent |
| D2 | Supports both slash and hash namespaces by extracting local names after the last slash or hash and by shipping slash base namespaces plus hash vocab constants. `packages/@core-v2/src/Utils/Iri.ts:108-113`; `packages/@core-v2/src/Service/Config.ts:215-226`; `packages/@core-v2/src/Domain/Rdf/Constants.ts:26-37` | Slash IRIs are the mechanical default, with hash allowed through `rebase` for published vocabularies. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:79-84` | supports |
| D3 | Uses runtime full-IRI constants and LLM-facing local names rather than CURIE literal predicate types inherited through the composer. `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-20`; `packages/@core-v2/src/Schema/RelationFactory.ts:57-115` | Borrowed vocabulary is a composer-baked CURIE literal type with inverse syntax and zero imports at usage sites. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91` | contradicts |
| D4 | Uses string ids, string predicates, string/scalar objects, and an entity-reference regex. `packages/@core-v2/src/Domain/Model/Entity.ts:326-389` | Relation endpoints accept schema handles, known CURIEs, or absolute IRI literals, never string references. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95` | contradicts |
| D5 | LLM schemas default to local names derived from ontology IRIs and reject full URIs in extracted type/predicate payloads. `packages/@core-v2/src/Schema/EntityFactory.ts:107-166`; `packages/@core-v2/src/Schema/RelationFactory.ts:57-115`; `packages/@core-v2/src/Schema/RelationFactory.ts:283-305` | Predicate local names default to the struct key at `$I.key` sites, with explicit override for custom IRI cases. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:96-99` | supports |
| D6 | Models RDF triples/quads as `Schema.Class` records and extraction facts as `Relation` objects with declared `rangeType`. `packages/@core-v2/src/Domain/Rdf/Types.ts:141-245`; `packages/@core-v2/src/Domain/Model/Entity.ts:303-389`; `packages/@core-v2/src/Domain/Model/Ontology.ts:645-657` | Relational facts are triples-as-tuples and datatype/object property is inferred from the AST at fold time. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105` | contradicts |
| D7 | Observed ontology facts live in Turtle and observed extraction schemas live in generated entity/relation schema factories. `ontologies/core/core.ttl:1-10`; `packages/@core-v2/src/Schema/EntityFactory.ts:330-348`; `packages/@core-v2/src/Schema/RelationFactory.ts:283-305` | Relational facts may live inline, at the fold, or both, but the fold channel must be implemented first. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:106-114` | silent |
| D8 | Has ontology registry lookup and semantic document conversion. `packages/@core-v2/src/Service/OntologyRegistry.ts:115-201`; `packages/@core-v2/src/Domain/Model/Ontology.ts:1006-1030` | `Fibered` becomes a first-class kit and registry service exposes `resolve(identity | iri | curie) -> fiber parts` through `ServiceMap.Service`. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-118`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:283-333` | silent |
| D9 | Uses generic `identifier` annotations on generated extraction schemas and string property ids in ontology models. `packages/@core-v2/src/Schema/EntityFactory.ts:330-348`; `packages/@core-v2/src/Schema/RelationFactory.ts:283-305`; `packages/@core-v2/src/Domain/Model/Ontology.ts:411-420` | Owned `identifier` and borrowed `term` annotations never share a key. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:119-122` | contradicts |

## 12. "What would we do differently" — closing verdict, synthesizing sections 9-11.

We should treat this repo as `port-with-attribution` prior art for runtime RDF machinery, not as the target authoring API, because its license is verified MIT and its strongest patterns are parser/store/projection/SHACL services rather than composer-bound identity authoring. `package.json:12`; `LICENSE:1-21`; `packages/@core-v2/src/Service/Rdf.ts:25-50`; `packages/@core-v2/src/Service/Shacl.ts:385-727`

For Phase 1, use the mined repo's collision-aware local-name lesson but implement the handoff's literal-preserving vocab registry, `Curie`, `Predicate`, `Expand`, and total expand/contract codec instead of branded full-IRI constants. `packages/@core-v2/src/Utils/Iri.ts:129-187`; `packages/@core-v2/src/Domain/Rdf/Constants.ts:13-20`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:130-162`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`

For Phase 2, do not copy runtime `buildIri(baseNamespace, localName)` authoring into `$I`; use the baseline root authority binding and static literal identity/CURIE interpolation rules instead. `packages/@core-v2/src/Utils/Rdf.ts:37-55`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:40-46`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-78`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:387-392`

For Phase 3, adapt the ontology parser, RDF term model, and Turtle/TriG projection patterns behind `$I.ontology`, but expose triples-as-tuples, schema handles, CURIE predicates, and projections that include JSON-LD context, Turtle, Markdown, and later SHACL. `packages/@core-v2/src/Service/Ontology.ts:119-465`; `packages/@core-v2/src/Domain/Rdf/Types.ts:141-245`; `packages/@core-v2/src/Service/Rdf.ts:441-481`; `packages/@core-v2/src/Service/Rdf.ts:970-1047`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:204-260`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

For Phase 4, adapt registry resolution, named graph provenance, and SHACL policy validation into v4 `ServiceMap.Service` layers, and keep the registry/fiber index swappable only below a stable `Fibered` API. `packages/@core-v2/src/Service/OntologyRegistry.ts:115-201`; `packages/@core-v2/src/Service/Rdf.ts:681-759`; `packages/@core-v2/src/Service/Shacl.ts:618-727`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:283-333`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:403-409`

The decisive difference is that `effect-ontology` mines an ontology into runtime extraction schemas, while our handoff makes identity the authoring authority and derives ontology projections from literal-typed schema annotations. `README.md:170-179`; `packages/@core-v2/src/Schema/EntityFactory.ts:330-348`; `packages/@core-v2/src/Schema/RelationFactory.ts:283-305`; `explorations/identity-as-iri/assets/exploration-report-2026-07-01.md:10-25`; `scratchpad/identity/README.md:8-24`

## 13. Sources — full list of file paths inspected in the mined repo.

- `LICENSE`
- `package.json`
- `bun.lock`
- `README.md`
- `packages/@core-v2/package.json`
- `packages/web/package.json`
- `packages/web/src/services/TicketClient.ts`
- `packages/@core-v2/registry.json`
- `packages/@core-v2/src/Domain/Identity.ts`
- `packages/@core-v2/src/Domain/PathLayout.ts`
- `packages/@core-v2/src/Domain/Rdf/Types.ts`
- `packages/@core-v2/src/Domain/Rdf/Constants.ts`
- `packages/@core-v2/src/Domain/Model/Entity.ts`
- `packages/@core-v2/src/Domain/Model/Ontology.ts`
- `packages/@core-v2/src/Domain/Schema/OntologyBrowser.ts`
- `packages/@core-v2/src/Domain/Schema/OntologyRegistry.ts`
- `packages/@core-v2/src/Domain/Schema/Shacl.ts`
- `packages/@core-v2/src/Service/Config.ts`
- `packages/@core-v2/src/Service/Rdf.ts`
- `packages/@core-v2/src/Service/Ontology.ts`
- `packages/@core-v2/src/Service/OntologyLoader.ts`
- `packages/@core-v2/src/Service/OntologyRegistry.ts`
- `packages/@core-v2/src/Service/Shacl.ts`
- `packages/@core-v2/src/Service/Sparql.ts`
- `packages/@core-v2/src/Utils/Iri.ts`
- `packages/@core-v2/src/Utils/Rdf.ts`
- `packages/@core-v2/src/Schema/EntityFactory.ts`
- `packages/@core-v2/src/Schema/RelationFactory.ts`
- `packages/@core-v2/test/RdfBuilder.test.ts`
- `packages/@core-v2/test/Ontology.test.ts`
- `packages/@core-v2/test/Schema/EntityFactory.test.ts`
- `packages/@core-v2/test/Schema/RelationFactory.test.ts`
- `ontologies/core/core.ttl`
- `ontologies/core/shapes.ttl`
