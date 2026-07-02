## 1. Overview & purpose

Ontorite presents itself as "A browser-based OWL 2 ontology editor" whose defining UX is nesting properties under the classes they describe via `rdfs:domain` rather than displaying properties as a detached flat list. `README.md:3-5` The package metadata matches that purpose with the description "A browser-based OWL 2 ontology editor with visual class-property nesting." `package.json:2-6`

Ontorite is a Vite/React app with scripts for `vite`, `tsc -b && vite build`, preview, lint, a Node static server, and Vitest; its runtime dependencies include React, Zustand, IndexedDB support, `n3`, `jsonld`, `rdfxml-streaming-parser`, and D3 force layout. `package.json:7-30` The browser root renders `App` inside React strict mode and an error boundary. `src/main.tsx:1-13`

The user-facing feature set includes creating ontologies, managing base URI/prefix mappings, importing/exporting Turtle, JSON-LD, RDF/XML, and N-Triples, nesting object/datatype/annotation properties under domain classes, and surfacing unassigned properties. `README.md:13-20` The app also advertises editorial notes, version metadata, timestamps, preserved unmapped triples, graph views, diffing, and validation. `README.md:29-46`

## 2. License

The repository has a top-level `LICENSE` file whose first line is `MIT License`. `LICENSE:1` The same file grants permission "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies" and requires the copyright and permission notice to be included in copies or substantial portions. `LICENSE:5-13` The README also states `MIT — see [LICENSE](LICENSE)`. `README.md:138-140`

Verdict: confirmed MIT, so this repository is **port-with-attribution eligible** for patterns or code we intentionally port, subject to preserving the MIT copyright/permission notice. `LICENSE:1-13`

## 3. Identity / IRI / prefix handling

Ontorite identities are plain string fields: `OntologyClass` carries `id`, `localName`, and full `uri`; `OntologyProperty` carries the same `id`, `localName`, and `uri` shape; ontology metadata carries `baseUri`, `ontologyUri`, and `prefixes: Record<string, string>`. `src/types/index.ts:92-117` `src/types/index.ts:148-164`

URI construction is value-level: `buildUri(baseUri, localNameStr)` appends `#` when the base lacks `#` or `/`, then concatenates the local name. `src/lib/uri-utils.ts:57-64` New ontologies default to `http://example.org/ontology/`, set `ontologyUri` to the base URI, and merge `STANDARD_PREFIXES` with caller metadata prefixes. `src/lib/store.ts:129-145`

Prefix compaction and expansion are runtime helpers: `compact` scans prefix entries and returns either `prefix:local`, `:local`, or `<uri>`. `src/lib/uri-utils.ts:30-40` `expand` strips angle brackets, expands known `prefix:local` pairs, and returns the input unchanged when no prefix is found. `src/lib/uri-utils.ts:42-55`

The Turtle parser is stricter than `expand` but still preserves bad tokens: `resolveNode` records `Unknown prefix: ...` and returns the unresolved `prefix:local` string as the node value. `src/lib/turtle-parser.ts:283-290`

The UI lets users accept computed IRIs or override full IRIs directly: `ClassForm` computes a URI from `baseUri` plus derived local name and binds an editable URI input to `uriValue`. `src/components/forms/ClassForm.tsx:63-68` `src/components/forms/ClassForm.tsx:170-189` `PropertyForm` uses the same computed/override pattern for property URIs. `src/components/forms/PropertyForm.tsx:119-124` `src/components/forms/PropertyForm.tsx:252-271`

Ontorite has runtime standard-prefix data for `owl`, `rdf`, `rdfs`, `xsd`, `skos`, and `dcterms`. `src/lib/uri-utils.ts:101-109` Its autocomplete layer adds well-known prefixes including `dc`, `foaf`, `schema`, `prov`, `dcat`, `void`, and `vann`. `src/lib/vocab-autocomplete.ts:43-63`

Compared with our baseline, Ontorite does not bind authority/prefix at a typed composer root; our D1 requires total authority binding at `make(...)`, and our D3 requires borrowed vocab as composer-baked CURIE literal types. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-91` The first-principles prototype rules also require every identity and CURIE to stay a static literal with type-level assertions for `IriFromIdentity`, `CurieFromIdentity`, `Expand`, and `Predicate`. `scratchpad/identity/README.md:12-24`

## 4. Vocabulary typing (literal types? codegen? runtime derivation?)

Ontorite has a small literal union only for property kind: `PropertyType` is exactly `"owl:ObjectProperty" | "owl:DatatypeProperty" | "owl:AnnotationProperty"`. `src/types/index.ts:19-23`

The vocabulary autocomplete model is runtime data: `VocabKind` is a four-member union, while each `VocabEntry` stores `prefix`, `localName`, `uri`, `label`, and `kind` as fields. `src/lib/vocab-autocomplete.ts:13-21` The file describes itself as a curated autocomplete index and says its coverage is intentionally kept small rather than complete. `src/lib/vocab-autocomplete.ts:1-10`

Ontorite's XSD vocabulary is a runtime `Record<string, string>` mapping compact names such as `xsd:string` to full datatype IRIs. `src/lib/uri-utils.ts:83-99` Validation derives datatype correctness by checking datatype-property ranges against the set of values from that XSD record. `src/lib/validation.ts:16-20` `src/lib/validation.ts:140-151`

Autocomplete emits either full IRIs or compact prefixed names at runtime: the component documents `outputAs?: "uri" | "compact"` and says `"compact"` emits values like `skos:editorialNote`. `src/components/forms/VocabAutocomplete.tsx:45-50` Selection implements that by returning `${prefix}:${localName}` only when the selected suggestion is from the vocab index and `outputAs === "compact"`. `src/components/forms/VocabAutocomplete.tsx:145-155`

In the inspected source, there is no evidence of codegen or schema-derived literal vocabulary unions: package scripts are only dev/build/preview/lint/start/build:serve/test, and the vocab index is hand-curated runtime data. `package.json:7-15` `src/lib/vocab-autocomplete.ts:1-10`

## 5. Triple/graph data model

Ontorite's editor model is not triples-as-tuples; it is a typed object model with `OntologyClass`, `OntologyProperty`, `Individual`, ontology metadata, `extraTriples`, and `unmappedTriples`. `src/types/index.ts:92-146` `src/types/index.ts:148-214`

The explicit extra-triple shape is `{ predicate: string; object: string; isLiteral: boolean; lang?: string; datatype?: string }`, so arbitrary facts are predicate/object records attached to classes or properties. `src/types/index.ts:9-17` Parser leftovers use `UnmappedTriple` with `subject`, `predicate`, `object`, `isLiteral`, optional language, and optional datatype. `src/types/index.ts:194-202`

The parser layer has a flat triple shape, `ParsedTriple`, with `s`, `p`, `o`, `isLiteral`, optional language, and optional datatype. `src/types/index.ts:277-292` `parseTurtle` produces `ParsedTriple[]`; `buildModelFromTriples` consumes that flat array and returns typed metadata/classes/properties/individuals/unmapped triples. `src/lib/turtle-parser.ts:259-264` `src/lib/turtle-parser.ts:527-533`

The model builder records recognized predicates into typed fields and collects anything not consumed into `unmappedTriples`. `src/lib/turtle-parser.ts:812-829` `src/lib/turtle-parser.ts:998-1040`

Class expressions are modeled as either a single class URI or an `owl:unionOf` over multiple class URIs, and the comment says unknown class expressions fall through to `extraTriples` or `unmappedTriples`. `src/types/index.ts:32-44`

`rdfs:domain` drives property nesting: the store builds a map from class IDs to properties by comparing each property's `domain` URI(s) to class URIs. `src/lib/store.ts:386-407` The README describes this same UX as showing every class the properties it is the `rdfs:domain` of. `README.md:3-5`

The graph visualization support has a separate UI layout model of `GraphNode { id, x, y, vx, vy }` and `GraphEdge { source, target }`; this is layout state for visual graphs, not the RDF storage model. `src/lib/graph-utils.ts:14-25`

## 6. Projections/serializations

Ontorite supports four import/export formats in its format registry: Turtle, JSON-LD, RDF/XML, and N-Triples. `src/lib/formats/index.ts:19-40` Format detection prefers filename extension and falls back to content sniffing. `src/lib/formats/index.ts:42-61`

The multi-format pipeline normalizes every import to `ParsedTriple` records, uses `buildModelFromTriples` uniformly, and uses Turtle as the source serializer before converting non-Turtle exports through `n3`/format modules. `src/lib/formats/index.ts:1-13` `src/lib/formats/index.ts:63-105`

Turtle serialization emits sorted prefixes, an `owl:Ontology` declaration, grouped class/property/individual sections, and a preserved-triples section for visible unmapped triples. `src/lib/turtle-serializer.ts:128-156` `src/lib/turtle-serializer.ts:158-235`

The Turtle serializer also reconstructs RDF lists from unmapped triples so `owl:unionOf` can round-trip as collection syntax. `src/lib/turtle-serializer.ts:63-91` `src/lib/turtle-serializer.ts:115-120`

JSON-LD import calls `jsonld.toRDF`, maps quads to `ParsedTriple`, and extracts simple top-level context prefixes. `src/lib/formats/jsonld.ts:24-60` JSON-LD export serializes Turtle to N-Quads, calls `jsonld.fromRDF`, and compacts with the ontology prefix map. `src/lib/formats/jsonld.ts:64-81`

N-Triples import/export is backed by `n3` parser/writer. `src/lib/formats/ntriples.ts:9-31` `src/lib/formats/ntriples.ts:34-49`

RDF/XML import uses `rdfxml-streaming-parser`; RDF/XML export parses Turtle with `n3` and emits a minimal hand-rolled RDF/XML document. `src/lib/formats/rdfxml.ts:20-45` `src/lib/formats/rdfxml.ts:60-116`

In the inspected format registry, Ontorite has no Markdown, SHACL, or standalone JSON-LD context projection comparable to our `mod.toMarkdown()`, `toShacl()`, or `mod.context()` targets; the exported format union contains only the four formats above. `src/lib/formats/index.ts:19-40` Our baseline requires JSON-LD/context, Turtle, Markdown, and later SHACL projections. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`

## 7. Validation approach

Ontorite's validation module is an imperative pass over the object model; its header lists checks for missing labels, missing property domain, object/datatype range mismatches, duplicate URIs, empty base URI, and broken subclass/subproperty references. `src/lib/validation.ts:1-14`

Validation emits `ValidationIssue[]` with `severity: "error" | "warning"`, entity identity, entity type, message, and optional field. `src/types/index.ts:216-224`

The implementation reports empty base URI as an error, unlabeled classes/properties as warnings, duplicate URIs as errors, missing domains as warnings, unknown domain members as errors, unknown object-property ranges as warnings, non-XSD datatype ranges as warnings, unknown inverse properties as warnings, and cardinality conflicts as warning/error depending on the case. `src/lib/validation.ts:21-36` `src/lib/validation.ts:38-85` `src/lib/validation.ts:87-203`

The app auto-runs validation in a React `useMemo`. `src/components/layout/App.tsx:182-185` Export checks validation errors and asks the user whether to export anyway, so validation is advisory at export time rather than a hard assembly gate. `src/components/core/ImportExport.tsx:35-46`

The validation panel displays error/warning counts and each issue message. `src/components/core/ValidationPanel.tsx:14-17` `src/components/core/ValidationPanel.tsx:47-66`

The preserved-triples table has live cell validation for plausible IRI/prefixed-name shapes, and its header says warnings never block saving. `src/components/core/UnmappedTriplesTable.tsx:1-7` `src/components/core/UnmappedTriplesTable.tsx:59-68`

## 8. API ergonomics

Ontorite's authoring API is imperative UI-to-store calls over partial objects, not a static `$I.class` / `$I.key` / `$I.ontology` authoring DSL. `src/lib/store.ts:57-79` `src/types/index.ts:226-258`

Representative new-ontology call site:

```tsx
// src/components/layout/OntologyList.tsx:40-45
const handleCreate = () => {
  if (!form.label.trim()) return;
  createOntology({
    ontologyLabel: form.label.trim(),
    baseUri: form.baseUri.trim() || `http://example.org/${form.label.toLowerCase().replace(/\s+/g, "-")}/`,
  });
```

Representative class authoring call site:

```tsx
// src/components/forms/ClassForm.tsx:95-103
addClass({
  localName: effectiveName,
  uri: uriValue || buildUri(baseUri, effectiveName),
  labels: cleanLabels.length ? cleanLabels : [{ value: effectiveName, lang: "" }],
  descriptions: cleanDescs,
  subClassOf,
  disjointWith,
  extraTriples: expandedTriples,
});
```

Representative property authoring call site:

```tsx
// src/components/forms/PropertyForm.tsx:149-169
const data: Partial<OntologyProperty> = {
  localName: effectiveName,
  uri: uriValue || buildUri(baseUri, effectiveName),
  type: propType,
  labels: cleanLabels.length ? cleanLabels : [{ value: effectiveName, lang: "" }],
  descriptions: cleanDescs,
  domain,
  ranges,
  subPropertyOf,
  inverseOf: inverseOf || undefined,
  exactCardinality: exactCardVal,
  minCardinality: exactCardVal !== undefined ? undefined : parseCard(minCard),
  maxCardinality: exactCardVal !== undefined ? undefined : parseCard(maxCard),
  extraTriples: expandedTriples,
};

if (existing) {
  updateProperty(existing.id, data);
} else {
  addProperty(data);
}
```

Representative extra-triple predicate call site:

```tsx
// src/components/forms/ExtraTripleEditor.tsx:36-43
<VocabAutocomplete
  value={entry.predicate}
  onChange={(val) => update(i, { predicate: val })}
  filter={{ kinds: ["property"] }}
  placeholder="prov:wasQuotedFrom"
  outputAs="compact"
  className="font-mono"
/>
```

Representative class-card property nesting call site:

```tsx
// src/components/core/ClassCard.tsx:342-348
{/* Add-property form */}
{addingProperty ? (
  <div ref={formRef} className="px-3 pt-1.5">
    <PropertyForm
      defaultDomainUri={cls.uri}
      onDone={() => setAddingProperty(false)}
    />
```

The ergonomic diamond is good for humans because domain context pre-fills the property form, but the authoring calls accept mutable strings and partial objects rather than typed handles. `src/components/core/ClassCard.tsx:342-348` `src/components/forms/PropertyForm.tsx:149-169` Our baseline requires references to be schema handles, known CURIEs, or absolute IRI literals, never string ref wrappers or typo-prone schema strings. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-105`

## 9. DIAMONDS

- **Preserved-triples workbench.** Ontorite preserves triples the parser cannot map, displays them in an editable table, and can promote them into entity `extraTriples`. `README.md:33` `src/components/core/UnmappedTriplesTable.tsx:116-125` `src/components/core/UnmappedTriplesTable.tsx:202-218` Adopt the pattern as a Phase 3 diagnostic/provenance surface for the `$I.ontology` fold, while keeping our triples schema-validated and tuple-shaped under D6. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

- **Domain-first property authoring.** Ontorite's central UX nests properties under their `rdfs:domain` class and opens `PropertyForm` with `defaultDomainUri={cls.uri}`. `README.md:3-5` `src/components/core/ClassCard.tsx:342-348` This maps to D5/D6 and Phase 3: our fold can infer property identity and datatype/object property shape from the field/key context while still projecting conventional `rdfs:domain` / `rdfs:range` triples. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:96-105` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

- **Canonical flat-triples interchange.** Ontorite imports every supported format into `ParsedTriple[]` and converts non-Turtle exports by first serializing to Turtle and parsing through `n3`. `src/lib/formats/index.ts:1-13` `src/lib/formats/index.ts:63-105` This maps to D6 and Phase 3: our assembled ontology should keep a tiny triple relation core and make JSON-LD/Turtle/Markdown projections pure catamorphisms from the assembled record. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-257`

- **Runtime vocab autocomplete is a strong UI affordance.** Ontorite merges curated vocab suggestions and in-ontology local entries, and can emit either full IRIs or compact CURIE-looking strings. `src/components/forms/VocabAutocomplete.tsx:127-155` This maps to D3 and Phase 1: our implementation should keep the user-facing CURIE ergonomics, but move correctness from runtime autocomplete into a composer-baked literal CURIE type and registry codec. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`

- **Idempotent migration/sweep passes.** Ontorite has explicit migration helpers for moving `skos:editorialNote`, `dcterms:created`, `dcterms:modified`, `owl:versionIRI`, and `owl:versionInfo` out of generic triple buckets into typed fields, plus tests asserting idempotence. `src/lib/store.ts:255-326` `src/lib/__tests__/migration.test.ts:76-127` This maps to D9 and Phase 3: our owned identity annotations and borrowed predicate channels should have explicit migration gates instead of overloading one annotation key. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-122` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:358-372`

- **`owl:unionOf` hoisting.** Ontorite recognizes blank-node union class expressions, hoists them into `ClassExpression`, removes blank-node class cards, and round-trip tests the behavior. `src/lib/turtle-parser.ts:567-648` `src/lib/__tests__/turtle-serializer.test.ts:154-235` This maps to D4/D6 and Phase 3: imported RDF structures should become typed handles/relations before authoring, while projections remain responsible for RDF syntax details. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-105` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`

- **First-class provenance metadata.** Ontorite stores `created`/`modified` timestamps on ontology/classes/properties/individuals and serializes them as `dcterms:created` / `dcterms:modified`. `src/types/index.ts:101-110` `src/types/index.ts:123-145` `src/types/index.ts:160-164` `src/lib/turtle-serializer.ts:146-150` `src/lib/turtle-serializer.ts:269-270` `src/lib/turtle-serializer.ts:314-315` This maps to D8 and Phase 4: provenance is a natural fiber over identity and should be recoverable by deterministic retrieval, not copied into ad hoc view state. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-118` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:403-409`

## 10. ROUGH

- **Unknown prefix handling is too permissive for our design.** Ontorite's `expand` returns unknown prefixed names unchanged, and the Turtle parser records an error but still emits the unresolved `prefix:local` token as data. `src/lib/uri-utils.ts:42-55` `src/lib/turtle-parser.ts:283-290` Our baseline requires unknown prefixes to be schema errors, never silent pass-through. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:159-162`

- **Mutable string IRIs undermine static identity.** Ontorite lets class/property forms edit full URI strings and then saves those strings into partial store updates. `src/components/forms/ClassForm.tsx:170-189` `src/components/forms/PropertyForm.tsx:252-271` `src/components/forms/ClassForm.tsx:84-103` `src/components/forms/PropertyForm.tsx:149-169` Our D1/D4 design wants canonical IRIs derived mechanically from composer identity and references passed as handles/CURIE/absolute IRI literals. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-78` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`

- **Random UI IDs are separate from semantic IRIs.** Ontorite generates random short IDs with `crypto.randomUUID().slice(0, 8)` and stores those IDs alongside mutable `uri` fields. `src/lib/store.ts:127-145` `src/lib/store.ts:644-667` `src/lib/store.ts:745-773` Our baseline treats interned symbols and IRIs as two encodings of the same identity point, not separate random UI keys plus mutable URI strings. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:23-25` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:263-279`

- **Validation is advisory, not an assembly gate.** Ontorite auto-runs validation and asks the user whether to export anyway when errors exist. `src/components/layout/App.tsx:182-185` `src/components/core/ImportExport.tsx:35-46` Our Phase 3 fold requires validation as the propose/gate/record boundary and says projections should never fail after assembly. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-257`

- **Generic triple buckets become a second model.** Ontorite stores both entity `extraTriples` and ontology-level `unmappedTriples`, then provides manual promotion between them. `src/types/index.ts:9-17` `src/types/index.ts:194-214` `src/lib/store.ts:987-1029` This is useful as a migration workbench, but our D6 model should keep relation facts as one schema-validated tuple grammar instead of letting generic buckets become peer authoring channels. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:241-257`

- **No PN_LOCAL escaping in `compact`.** Ontorite's `compact` returns `${prefix}:${local}` directly for any URI that starts with a namespace. `src/lib/uri-utils.ts:30-40` Our handoff explicitly calls slash/dot escaping a Turtle projection concern. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:198-200` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:346-348`

- **The vocab registry is hand-curated runtime data.** Ontorite's vocab file says the autocomplete index is kept small on purpose and adds terms when they come up in real ontologies. `src/lib/vocab-autocomplete.ts:1-10` Our Phase 1 requires registry data reconciled with existing vocab constants, derived literal types, a codec, and property-based round-trip tests over the registry. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`

- **Legacy `dc:` is present in the well-known prefix table.** Ontorite includes `dc: "http://purl.org/dc/elements/1.1/"` in autocomplete prefixes. `src/lib/vocab-autocomplete.ts:43-63` Our baseline says to use `dcterms:` as the default Dublin Core namespace and explicitly migrates legacy `dc/elements/1.1/*` to `dcterms:*`. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:147-148` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:365-367`

- **Simplified cardinality lives on properties.** Ontorite's property form labels cardinality as "Simplified constraints — not OWL 2 restriction blank nodes" and the serializer emits `owl:cardinality`, `owl:minCardinality`, or `owl:maxCardinality` directly in a property block. `src/components/forms/PropertyForm.tsx:531-576` `src/lib/turtle-serializer.ts:327-334` Our fold should infer datatype/object property shape from schema AST and reserve richer constraint output for projection-specific SHACL/OWL handling. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:351-354`

- **Hand-rolled serialization surfaces are large.** Ontorite has a character-level recursive-descent Turtle parser and a minimal hand-rolled RDF/XML writer. `src/lib/turtle-parser.ts:1-6` `src/lib/formats/rdfxml.ts:1-13` For our implementation, this is a warning to keep the ontology authoring model small and push syntax complexity into focused, tested projection modules. `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-257` `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`

## 11. Sources

- /home/elpresidank/YeeBois/projects/beep-effect/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md
- /home/elpresidank/YeeBois/projects/beep-effect/scratchpad/identity/README.md
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/LICENSE
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/README.md
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/package.json
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/main.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/types/index.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/common-ontologies.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/file-access.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/formats/index.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/formats/jsonld.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/formats/ntriples.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/formats/quad-utils.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/formats/rdfxml.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/graph-utils.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/ontology-diff.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/persistence.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/store.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/turtle-parser.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/turtle-serializer.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/uri-utils.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/validation.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/vocab-autocomplete.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/__tests__/format-detect.test.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/__tests__/migration.test.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/__tests__/turtle-parser.test.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/lib/__tests__/turtle-serializer.test.ts
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/core/ClassCard.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/core/ImportExport.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/core/UnmappedTriplesTable.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/core/ValidationPanel.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/dialogs/CreateEdgeDialog.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/dialogs/CreateEntityDialog.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/dialogs/OntologyMetadataDrawer.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/forms/ClassForm.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/forms/ExtraTripleEditor.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/forms/PropertyForm.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/forms/VocabAutocomplete.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/layout/App.tsx
- /home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontorite/src/components/layout/OntologyList.tsx
