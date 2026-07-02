# ontograph-core mining report

## 1. Overview & purpose

`@ontograph/core` presents itself as a TypeScript ontology framework for defining entities, relations, constraints, and rules in code, then projecting the same definitions to OWL 2, SHACL, Neo4j Cypher, JSON Schema, and Mermaid outputs. (README.md:21-22) Its package metadata calls the library an ontology framework with expression AST, query, RBAC, SHACL validation, datasource mapping, and a fluent builder API. (package.json:2-5)

The public modeling layer centers on TypeScript interfaces: attributes have `@id`, `@type: "Attribute"`, labels, datatype, validation, enum, and optional struct data; entities have `@id`, `@type: "EntityType"`, kind, attributes, relations, constraints, UI, extends, and implements; relations have `@id`, `@type: "RelationType"`, domain, range, cardinality, inverse, and optional properties. (src/types.ts:28-43, src/types.ts:84-117) The top-level ontology record stores `@context`, `@id`, `@type: "Ontology"`, version, labels, entity/relation/value/attribute/constraint arrays, plus optional actions, rules, interfaces, derived attributes, datasource mappings, object mappings, and roles. (src/types.ts:366-396)

The package root re-exports many submodules, including builder, codegen, datasource, diff, DOT/ER/JSON Schema/Mermaid exporters, expression, lineage, object model, query, rule/security/transformer/types/validation/validator/versioning. (src/index.ts:1-25)

## 2. License — verify by reading the actual LICENSE file

Status: **port-with-attribution**.

The actual license file path is `LICENSE`, and its first line is `"MIT License"`. (LICENSE:1) The same file grants permission "free of charge" and says copies may be used, copied, modified, merged, published, distributed, sublicensed, and sold if the copyright and permission notice are included. (LICENSE:5-13) The package metadata also declares `"license": "MIT"`. (package.json:2-5)

## 3. Identity / IRI / prefix handling

Identity values are plain strings at the core model boundary: `AttributeDefinition["@id"]`, `EntityType["@id"]`, `RelationType["@id"]`, and `OntologyDefinition["@id"]` are all typed as `string`. (src/types.ts:28-35, src/types.ts:84-90, src/types.ts:106-115, src/types.ts:366-370) Reference fields are also strings: `RelationRef.ref`, `AttributeRef.ref`, entity `extends`, entity `implements`, relation `domain`, relation `range`, relation `inverse`, and attribute `datatypeRef` are string-valued. (src/types.ts:28-35, src/types.ts:51-62, src/types.ts:84-117)

Prefix handling is data-driven through `OntologyContext`, which requires an `ontograph` prefix, optionally names `scm` and `xsd`, and permits arbitrary string prefix keys. (src/types.ts:213-218) The supply-chain example fills that context with `ontograph`, `scm`, `xsd`, `epcis`, `cbv`, `sosa`, `ssn`, and `gs1` prefixes. (src/examples/supply-chain/index.ts:35-45)

The OWL exporter has a built-in prefix table for `rdf`, `rdfs`, `owl`, `xsd`, and `skos`, then appends additional prefixes from `ontology["@context"]` if they are not already built in. (src/exporters/owl-exporter.ts:19-25, src/exporters/owl-exporter.ts:70-80) The SHACL exporter similarly has built-in `rdf`, `rdfs`, `owl`, `xsd`, `sh`, and `ex` prefixes and then appends extra context prefixes. (src/exporters/shacl-exporter.ts:25-32, src/exporters/shacl-exporter.ts:67-78)

IRI expansion is ad hoc and local to exporters: `expandIRI` wraps absolute HTTP(S) IDs in angle brackets, returns any string containing `:` unchanged, and prefixes unqualified local IDs with `:`. (src/exporters/owl-exporter.ts:327-330, src/exporters/shacl-exporter.ts:346-349) Local-name extraction is also ad hoc: codegen, JSON Schema, DOT, Mermaid, ER, OWL, and SHACL exporters split IDs on `:` and use the final segment. (src/codegen/type-generator.ts:137-144, src/exporters/json-schema-exporter.ts:511-514, src/exporters/dot-exporter.ts:194-200, src/exporters/mermaid-exporter.ts:494-497, src/exporters/er-exporter.ts:252-255, src/exporters/owl-exporter.ts:333-335, src/exporters/shacl-exporter.ts:352-354)

The object-model validator has a stricter namespace-name regex for object IDs, requiring a leading alphabetic namespace segment, a colon, and an alphanumeric/underscore/dash local segment. (src/object-validator.ts:404-407)

## 4. Vocabulary typing (literal types? codegen? runtime?)

The main vocabulary of attribute datatypes is a string-literal union named `DataType`, with values such as `string`, `integer`, `float`, `decimal`, `boolean`, `datetime`, `date`, `array`, `object`, `ref`, geospatial/vector/time/money/measurement values, and `struct`. (src/types.ts:9-26) Attributes carry that datatype, optional `datatypeRef`, optional validation rules, optional enum values, and optional struct fields. (src/types.ts:28-43)

Relation vocabulary is not modeled as a borrowed RDF predicate registry; relation IDs, domain IDs, range IDs, inverse IDs, attribute refs, and relation refs are string fields. (src/types.ts:51-62, src/types.ts:84-117) The example relation vocabulary is authored as `RelationType[]` objects, such as `scm:supplies` with domain `scm:Supplier`, range `scm:Product`, and inverse `scm:suppliedBy`. (src/examples/supply-chain/relations.ts:1-12)

Runtime and projection code map the internal `DataType` vocabulary into target vocabularies. The OWL exporter maps selected datatypes to `xsd:*`, `rdf:List`, and `rdf:Resource`. (src/exporters/owl-exporter.ts:27-36) The SHACL shape generator maps selected datatypes to `xsd:*` strings. (src/validation/shacl-shapes.ts:146-158) The JSON Schema exporter maps datatypes to JSON Schema types, formats, refs, geospatial object shapes, vector arrays, currency/measurement objects, and struct objects. (src/exporters/json-schema-exporter.ts:344-439)

The TypeScript code generator emits interfaces from the ontology's entity types, uses the entity `@id` as a string literal for generated `"@type"`, converts attribute refs to field names by splitting on `:`, optionally includes relation fields, and maps `DataType` values to TypeScript types. (src/codegen/type-generator.ts:34-58, src/codegen/type-generator.ts:61-97, src/codegen/type-generator.ts:114-144) The generator's main loop covers entity types and optional interfaces; no value-type loop appears in that `generate()` method. (src/codegen/type-generator.ts:44-56)

## 5. Triple/graph data model

The ontology graph is record-based rather than triple-tuple-based: `OntologyDefinition` stores arrays for entity types, relation types, value types, attributes, constraints, and optional adjacent concerns. (src/types.ts:366-396) Entity records contain arrays of `AttributeRef`, `RelationRef`, and `ConstraintRef`, while relation records carry explicit `domain`, `range`, cardinality, and inverse fields. (src/types.ts:84-117)

The supply-chain example follows that record model: `supplyChainOntology` spreads imported arrays into `entityTypes`, `eventTypes`, `relationTypes`, `valueTypes`, `attributes`, `constraints`, and `views`. (src/examples/supply-chain/index.ts:35-83, src/examples/supply-chain/index.ts:84-214, src/examples/supply-chain/index.ts:215-383) Individual entity examples embed attribute refs and relation refs by string ID, such as `scm:Supplier` referencing `scm:organizationCode`, `scm:name`, and `scm:supplies`. (src/examples/supply-chain/entities.ts:3-23)

The instance/object layer uses a separate object graph model: `ObjectClass` references an entity type, `ObjectInstance` references an object class and stores property values, and `ObjectLink` references a relation type plus from/to object IDs. (src/object-model.ts:42-86, src/object-model.ts:108-130) Object packages and object models group classes, instances, links, packages, versions, and an ontology reference. (src/object-model.ts:132-183)

The Neo4j transformer derives node labels from entity IDs and relationship type mappings from relation records, including the relation ID, uppercase snake-case Neo4j type, domain, and range. (src/transformer.ts:74-101, src/transformer.ts:163-177)

## 6. Projections/serializations

The OWL exporter explicitly maps `EntityType` to `owl:Class`, `RelationType` to `owl:ObjectProperty`, attributes to datatype or object properties, constraints to restrictions, and value types to `owl:Class` plus `owl:oneOf`. (src/exporters/owl-exporter.ts:1-10) Its `export()` method writes prefixes, ontology header, entity types, relation types, attribute types, value types, constraints, and interfaces, then returns joined Turtle text. (src/exporters/owl-exporter.ts:57-68)

The SHACL exporter maps entities to node shapes, constraints and attributes to property shapes, value types to node shapes with `sh:in`, and relations to `sh:class` property shapes. (src/exporters/shacl-exporter.ts:1-10) Its `export()` method writes prefixes, entity type shapes, value type shapes, and constraint shapes. (src/exporters/shacl-exporter.ts:58-65)

The JSON Schema exporter creates a Draft 2020-12 object schema, sets `$id` from the ontology ID or a base URI, and emits entity/interface/value type definitions into `$defs`. (src/exporters/json-schema-exporter.ts:67-92, src/exporters/json-schema-exporter.ts:98-121) It converts entity attributes and relations into JSON Schema properties, required fields, refs, `allOf` inheritance, and interface composition. (src/exporters/json-schema-exporter.ts:131-211)

The Mermaid exporter supports `classDiagram`, `graph`, and `flowchart` outputs and dispatches on the requested diagram type. (src/exporters/mermaid-exporter.ts:17-21, src/exporters/mermaid-exporter.ts:81-90) The DOT exporter writes a Graphviz `digraph`, nodes for entity/value types, and edges for relations and inheritance. (src/exporters/dot-exporter.ts:66-84, src/exporters/dot-exporter.ts:87-159) The ER exporter writes Mermaid `erDiagram` syntax, emits entity/value definitions, and writes relationships with cardinality markers from relation `min`/`max`. (src/exporters/er-exporter.ts:1-21, src/exporters/er-exporter.ts:51-83, src/exporters/er-exporter.ts:199-250)

The README describes the intended multi-format surface as Mermaid, OWL 2 Turtle, SHACL Turtle, JSON Schema, DOT, and Neo4j Cypher DDL. (README.md:45-54)

## 7. Validation approach

Ontology validation is imperative and in-memory: `OntologyValidator.validate` accepts an `OntologyDefinition`, accumulates string errors and warnings, requires an ontology `@id` and version, warns when there are no entity types, checks entity attribute refs and relation refs against the ontology arrays, detects orphan relation domains/ranges, detects inheritance cycles, and reports missing attributes and relations. (src/validator.ts:34-116) Interface validation is a separate method that returns warnings when an entity declares an unknown interface or misses required interface attributes/relations. (src/validator.ts:250-319)

SHACL generation and SHACL validation are separate surfaces. `SHACLShapeGenerator.generate` builds attribute maps, emits entity type shapes, includes interface shapes, and maps attributes to property shapes with datatype, min count, pattern, and enum data. (src/validation/shacl-shapes.ts:68-85, src/validation/shacl-shapes.ts:95-128, src/validation/shacl-shapes.ts:130-158) `SHACLValidator.validate` iterates data records, chooses a shape by the record's `@type`, validates each property, and returns conforms/results/timestamp. (src/validation/shacl-validator.ts:23-46, src/validation/shacl-validator.ts:156-182)

The SHACL validator checks min count, datatype, numeric min/max, regex pattern, and enum membership at runtime. (src/validation/shacl-validator.ts:65-153) Object-model validation checks object class IDs/types/properties, object instance class membership/metadata/required/identity/enum values, link IDs/types/from/to fields, model references, link referential integrity, and link cycles. (src/object-validator.ts:43-99, src/object-validator.ts:102-248, src/object-validator.ts:250-405)

Validation rules at the core type level are only `min`, `max`, `pattern`, and `custom`. (src/types.ts:45-49) The builder's `defineAttribute` turns a `pattern` option into a `ValidationRule` entry. (src/builder/define.ts:164-201)

## 8. API ergonomics — quote representative authoring call sites

The builder API is fluent: `EntityTypeBuilder.attr`, `.rel`, `.constraint`, `.implements`, `.ui`, and `.extends` mutate builder-local arrays/config and return `this`; `.build()` returns an `EntityType`. (src/builder/define.ts:43-115) `defineEntity` returns an `EntityTypeBuilder`, while `defineRelation` and `defineAttribute` return completed records. (src/builder/define.ts:117-158, src/builder/define.ts:177-202)

Representative fluent entity authoring:

```ts
.attr("sc:sku", { identity: true, required: true })
```

This call site comes from the builder test that verifies `.attr()` pushes an attribute ref and `.build()` materializes it. (src/builder/builder.test.ts:67-80)

Representative relation authoring:

```ts
const rel = defineRelation("sc:storedIn", {
  label: { en: "Stored In" },
  domain: "sc:Product",
  range: "sc:Warehouse",
});
```

This call site verifies the relation `@id`, `@type`, domain, range, and label fields. (src/builder/builder.test.ts:208-220)

Representative object-literal authoring:

```ts
{
  "@id": "scm:Product",
  "@type": "EntityType",
  label: { zh: "产品", en: "Product" },
  kind: "entity",
}
```

The supply-chain entity file uses that object-literal style for many entities and then embeds attribute and relation refs as arrays. (src/examples/supply-chain/entities.ts:101-126)

Representative aggregate ontology authoring:

```ts
export const supplyChainOntology: OntologyDefinition = {
  "@context": {
    ontograph: "https://ontograph.app/ontology/scm#",
    scm: "http://example.com/supplychain#",
  },
}
```

The full example continues by spreading imported entity, event, relation, action, value, attribute, constraint, and view arrays into the ontology object. (src/examples/supply-chain/index.ts:35-83, src/examples/supply-chain/index.ts:84-214, src/examples/supply-chain/index.ts:215-383)

## 9. DIAMONDS — patterns worth adopting

1. Data-driven prefix registry consumed by projections. Ontograph stores prefixes in `OntologyContext`, authors concrete contexts in ontology data, and exporters merge those context entries with built-in RDF/OWL/SHACL prefixes. (src/types.ts:213-218, src/examples/supply-chain/index.ts:35-45, src/exporters/owl-exporter.ts:19-25, src/exporters/owl-exporter.ts:70-80, src/exporters/shacl-exporter.ts:25-32, src/exporters/shacl-exporter.ts:67-78) Maps to D1, D2, D3, and D9; use in phase 1 for vocab+CURIE registry data and in phase 2 for composer binding, but replace stringly expansion with the locked literal-preserving codec.

2. Projection writers are simple folds over one assembled model. Ontograph's OWL exporter has one `export()` orchestration that runs prefix/header/entity/relation/attribute/value/constraint/interface writers and returns text; its SHACL/JSON Schema/Mermaid/DOT/ER exporters follow the same "constructed value to text/object" shape. (src/exporters/owl-exporter.ts:57-68, src/exporters/shacl-exporter.ts:58-65, src/exporters/json-schema-exporter.ts:83-129, src/exporters/mermaid-exporter.ts:81-90, src/exporters/dot-exporter.ts:66-73, src/exporters/er-exporter.ts:51-83) Maps to D6 and phase 3; keep the projection ergonomics, but make the assembled value come from `$I.ontology` triples-as-tuples.

3. Runtime SHACL generation and validation are separate from authoring. Ontograph generates SHACL shapes from ontology definitions, then validates data against shape records by `@type`. (src/validation/shacl-shapes.ts:68-85, src/validation/shacl-shapes.ts:95-128, src/validation/shacl-validator.ts:23-46, src/validation/shacl-validator.ts:65-153) Maps to D6 and D8; adopt in phase 4 as a projection plus validation gate, with `$I.key` predicate expansion and AST-derived datatype/optionality.

4. Type generation from the ontology model gives a useful proof artifact. Ontograph's `TypeGenerator` derives TS interfaces from entity type records, writes a literal `"@type"` value, turns refs into field names, optionally includes relations, and filters namespaces. (src/codegen/type-generator.ts:34-58, src/codegen/type-generator.ts:61-97, src/codegen/type-generator.ts:137-149) Maps to D3, D4, D5, and phase 1/phase 3; adopt as generated proof/golden output after literal CURIE and handle typing exist, not as the source of truth.

5. Separate object graph records are useful for retrieval and instance-level checks. Ontograph's `ObjectClass`, `ObjectInstance`, and `ObjectLink` split class definitions, instance values, and relation links, and `ObjectValidator` checks class refs, link refs, referential integrity, and cycles. (src/object-model.ts:42-86, src/object-model.ts:108-130, src/object-validator.ts:250-405) Maps to D4, D8, and phase 4; adapt the separation for `Fibered` retrieval layers where handles resolve to local annotations, graph-store descriptions, docs, and provenance.

6. The fluent authoring surface is terse enough to study. Ontograph's entity builder chains `.attr()`, `.rel()`, `.constraint()`, `.implements()`, `.ui()`, `.extends()`, and `.build()` over an entity ID. (src/builder/define.ts:43-115, src/builder/builder.test.ts:182-205) Maps to D5, D7, and phase 3; adopt the terseness, but route it through `$I.key`, `$I.class`, and `$I.ontology` rather than standalone string IDs.

## 10. ROUGH — anti-patterns to avoid, with reasoning

1. Stringly identity and relation refs. Core IDs, refs, domains, ranges, inverses, and datatype refs are public `string` fields, so the type surface does not encode borrowed vocabulary, owned handles, absolute IRIs, or inverse predicates as separate channels. (src/types.ts:28-35, src/types.ts:51-62, src/types.ts:84-117) Avoid for D3, D4, and D9 because our design authority requires literal-typed CURIEs, handles instead of strings, and separate owned/borrowed annotation channels.

2. Local `expandIRI` rules are too weak for a canonical IRI system. The exporter helper returns colon-containing strings unchanged, wraps absolute HTTP(S) strings in angle brackets, and prefixes local IDs with `:`. (src/exporters/owl-exporter.ts:327-330) The ontology header then embeds the result inside another pair of angle brackets for `owl:versionIRI`. (src/exporters/owl-exporter.ts:84-88) Avoid for D1 and D2 because the composer-level codec must be total, literal-preserving, and unambiguous before any writer runs.

3. Relation facts are split across relation records and entity refs rather than a single tuple grammar. A `RelationType` owns domain/range/inverse/cardinality fields, and entities carry relation refs separately. (src/types.ts:84-117) Avoid for D6 and D7 because the handoff wants `[Subject, Predicate, Object]` as the relational fact grammar and keeps inline-vs-fold placement as the only open question.

4. Documentation and implementation drift. README quick-start calls `defineRelation("sc:storedIn", { label }, "sc:Product", "sc:Warehouse")`, while the actual `defineRelation` implementation accepts only `(id, config)` with `domain` and `range` inside `config`. (README.md:120-126, src/builder/define.ts:129-158) README quick-start calls `validator.validate([warehouse, product], [storedIn])`, while the actual validator accepts one `OntologyDefinition`. (README.md:128-130, src/validator.ts:34-35) Avoid by making phase gates compile the examples that advertise the API.

5. Root export drift for advertised exporters. README imports `OWLExporter` and `SHACLExporter` from `@ontograph/core`, but the root barrel exports DOT, ER, JSON Schema, and Mermaid exporters and does not list OWL or SHACL exporter files in the inspected `src/index.ts`. (README.md:197-201, src/index.ts:9-12, src/index.ts:23-24) Avoid by making the phase 3 projection API part of the package-level public barrel tests.

6. Regex-parsed rule strings leak into semantic projections. OWL and SHACL exporters parse constraint `rule` strings with comparison regexes and fallback behavior. (src/exporters/owl-exporter.ts:388-405, src/exporters/shacl-exporter.ts:285-313) Avoid for phase 3 validation because our fold should prefer schema/AST evidence and typed errors over string rule forensics.

7. JSON Schema array cardinality is projected through string length keywords. Relation refs are emitted as arrays, but min/max cardinality is written as `minLength` and `maxLength`. (src/exporters/json-schema-exporter.ts:442-477) Avoid by keeping projection tests at the semantic-output level for every target format.

8. Identity metadata is conflated with SHACL language uniqueness. The SHACL exporter writes `sh:uniqueLang true` when an attribute ref is marked identity. (src/exporters/shacl-exporter.ts:203-226) Avoid for D9 because owned identity and borrowed predicate metadata need dedicated channels and target-format-specific semantics.

## 11. Sources — full list of file paths inspected

Design authority read before mining:

- `/home/elpresidank/YeeBois/projects/beep-effect/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`
- `/home/elpresidank/YeeBois/projects/beep-effect/scratchpad/identity/README.md`

Ontograph-core files inspected:

- `LICENSE`
- `package.json`
- `README.md`
- `docs/content/docs/quick-start.mdx`
- `docs/content/docs/core/types.mdx`
- `docs/content/docs/core/owl-export.mdx`
- `src/index.ts`
- `src/types.ts`
- `src/builder/index.ts`
- `src/builder/define.ts`
- `src/builder/builder.test.ts`
- `src/validator.ts`
- `src/validation/shacl-shapes.ts`
- `src/validation/shacl-validator.ts`
- `src/exporters/owl-exporter.ts`
- `src/exporters/shacl-exporter.ts`
- `src/exporters/json-schema-exporter.ts`
- `src/exporters/mermaid-exporter.ts`
- `src/exporters/dot-exporter.ts`
- `src/exporters/er-exporter.ts`
- `src/codegen/type-generator.ts`
- `src/examples/supply-chain-ontology.ts`
- `src/examples/supply-chain/index.ts`
- `src/examples/supply-chain/entities.ts`
- `src/examples/supply-chain/relations.ts`
- `src/examples/supply-chain/attributes.ts`
- `src/object-model.ts`
- `src/object-validator.ts`
- `src/transformer.ts`
- `src/query/neo4j-engine.ts`
