## 1. Overview and purpose

- `ontology-master` presents itself as a desktop OWL ontology modeling tool; the README names it as a desktop app and describes it as AI-driven OWL ontology modeling over multiple data sources with standard OWL output (`README.md:1-3`).
- Its feature list covers a reused `pi-gui` desktop GUI, multi-source ingestion, a six-stage AI modeling pipeline, multi-model support, OWL export, SHACL validation, and CLI usage (`README.md:5-13`).
- The repository architecture is a monorepo with a desktop app, CLI, Python reasoner, and packages for session driver, catalogs, pi-sdk bridge, ontology types, ingestion, modeler, and SQLite store (`README.md:15-33`).
- The stack table identifies `@om/ontology` as the OWL 2 type layer, ingestion libraries for common formats, `owlready2 + rdflib` as the Python FastAPI reasoner/export backend, and `better-sqlite3` as persistence (`README.md:92-101`).
- The `@om/ontology` package publicly exports the core domain types, `makeIRI`, `createOntology`, `OntologyOperations`, and `validateOntology` (`packages/ontology/src/index.ts:1-11`).
- A later design note says the desktop already had `DataImportView`, `OntologyModelerView`, `OwlExportView`, `@om/ontology`, `@om/ingestion`, `@om/modeler`, and a Python reasoner, while the then-current desktop pages mostly used frontend in-memory simulation and `@om/modeler` directly called an OpenAI-compatible API (`docs/superpowers/specs/2026-05-28-ontology-workbench-pi-agent-design.md:3-6`).

## 2. License - verify by quoting the actual LICENSE file path and contents (it looked like MIT, author Matthew Lam, but confirm). If verified MIT/Apache-2.0, label the repo "port-with-attribution" eligible; if no license file or unclear license, label it "REFERENCE-ONLY".

- Verified license path: `LICENSE` (`LICENSE:1-21`).
- Compliant excerpt from the actual file:

```text
LICENSE:1 MIT License
LICENSE:3 Copyright (c) 2026 Matthew Lam
LICENSE:12-13 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
```

- The rest of `LICENSE` contains the standard MIT grant and warranty disclaimer, including permission to use, copy, modify, merge, publish, distribute, sublicense, and sell copies, followed by the standard "AS IS" warranty disclaimer (`LICENSE:5-21`).
- Package metadata also declares `"license": "MIT"` (`package.json:5`).
- The README license section says `MIT` (`README.md:108-110`).
- Reuse label: `port-with-attribution` eligible, because the checked-in license file is MIT and the copyright holder line names Matthew Lam (`LICENSE:1-3`).

## 3. Identity / IRI / prefix handling

- The core `IRI` interface stores three string fields: `full`, `local`, and `namespace` (`packages/ontology/src/types.ts:7-14`).
- The shared `Labelled` shape embeds an `iri: IRI` beside `label`, optional `description`, and optional language-tagged `labels` (`packages/ontology/src/types.ts:16-21`).
- `makeIRI(namespace, local)` computes `full` by concatenating directly when the namespace ends in `#` or `/`, otherwise by inserting `#`; it returns the same `local` and `namespace` values it received (`packages/ontology/src/model.ts:7-14`).
- `OntologyModel` stores top-level `iri`, optional `versionIRI`, `prefix`, and `imports`, then separate arrays for classes, properties, individuals, axioms, SHACL shapes, candidate changes, competency questions, and metadata (`packages/ontology/src/types.ts:187-207`).
- `createOntology(iri, prefix, metadata)` copies the supplied `iri` and `prefix` into the model and initializes every ontology collection as an empty array (`packages/ontology/src/model.ts:16-41`).
- The project store defaults new projects to prefix `om` and IRI `http://example.org/${prefix}` when callers do not provide options (`packages/store/src/project.ts:19-24`).
- The CLI derives a prefix from the source filename by removing the extension and replacing non-alphanumeric characters with `_`, then creates `http://example.org/${prefix}` as the ontology IRI (`apps/cli/src/index.ts:60-63`).
- The pi-agent protocol type accepts an optional `prefix`, the converter defaults it to `om`, and conversion derives a hash namespace as `${result.iri}#` (`packages/modeler/src/pi-agent-protocol.ts:67-78`, `packages/modeler/src/pi-agent-protocol.ts:173-181`).
- The modeling tools derive a namespace by appending `#` to `model.iri`, then mint class and property IRIs through `makeIRI(namespace, name)` (`packages/modeler/src/tools/modeling-tools.ts:8-11`, `packages/modeler/src/tools/modeling-tools.ts:25-33`, `packages/modeler/src/tools/modeling-tools.ts:50-58`).
- The desktop `createClass` path manually builds the same hash namespace and full IRI, then stores `{ full, namespace, local }` directly on the class object (`apps/desktop/electron/ontology-workbench-store.ts:181-204`).
- The inspected type definitions expose `IRI`, `iri`, and `prefix`, but not a dedicated `CURIE` field or `curie` member in the opened core model shapes (`packages/ontology/src/types.ts:7-14`, `packages/ontology/src/types.ts:189-193`, `packages/modeler/src/pi-agent-protocol.ts:67-78`).
- Turtle generation uses the model prefix as the emitted namespace prefix in both CLI fallback export and desktop preview (`apps/cli/src/index.ts:135-141`, `apps/desktop/electron/ontology-workbench-store.ts:578-586`).

## 4. Vocabulary typing (literal types? codegen? runtime derivation?)

- The core ontology package defines a closed `DataType` TypeScript union for selected `xsd:*` literals and `rdfs:Literal` (`packages/ontology/src/types.ts:78-93`).
- The package also defines a closed `PropertyCharacteristic` union for OWL property characteristics such as `functional`, `transitive`, `symmetric`, and `irreflexive` (`packages/ontology/src/types.ts:67-76`).
- The opened definitions for class expressions, restrictions, and axioms are TypeScript tagged unions (`packages/ontology/src/types.ts:33-39`, `packages/ontology/src/types.ts:116-136`).
- The `@om/ontology` package metadata exposes only `build`, `dev`, and `test` scripts, all backed by TypeScript or Vitest, so the opened package metadata does not show a code-generation step for vocabulary types (`packages/ontology/package.json:9-17`).
- Runtime datatype validation is duplicated manually in `isDataType`, which enumerates the same accepted literal datatype strings and returns true only for those strings (`packages/modeler/src/pi-agent-protocol.ts:328-341`).
- `readDataProperty` turns an unrecognized protocol `range` into `DEFAULT_DATATYPE`, and `DEFAULT_DATATYPE` is `xsd:string` (`packages/modeler/src/pi-agent-protocol.ts:89-91`, `packages/modeler/src/pi-agent-protocol.ts:261-270`).
- The `create_data_property` agent tool accepts `dataType` as a JSON-schema string and casts it to `import('@om/ontology').DataType`, defaulting to `xsd:string` when missing (`packages/modeler/src/tools/modeling-tools.ts:62-83`).
- Built-in RDF/OWL/RDFS/XSD names appear as hard-coded Turtle prefix lines in fallback/preview emitters, not as a shared literal vocabulary registry in the opened files (`apps/cli/src/index.ts:135-141`, `apps/desktop/electron/ontology-workbench-store.ts:578-586`).

## 5. Triple/graph data model

- The TypeScript model is an object aggregate with arrays for `classes`, `objectProperties`, `dataProperties`, `annotationProperties`, `individuals`, `axioms`, and `shaclShapes`, not a primary triple tuple store (`packages/ontology/src/types.ts:187-207`).
- `Axiom` is a tagged union with cases such as `subClassOf`, `equivalentClasses`, `disjointClasses`, `objectPropertyAssertion`, and `dataPropertyAssertion` (`packages/ontology/src/types.ts:126-136`).
- Individual property values are represented as `{ propertyIRI, value }`, where `value` is either an `IRI` or a `DataValue` (`packages/ontology/src/types.ts:95-114`).
- Object properties carry `domain` and `range` as `ClassExpression[]`, while data properties carry `range` as `DataType[]` (`packages/ontology/src/types.ts:41-59`).
- `OntologyOperations` mutates the aggregate model by pushing classes, object properties, data properties, annotation properties, individuals, axioms, SHACL shapes, and competency questions into their corresponding arrays (`packages/ontology/src/model.ts:44-147`).
- The Python reasoner owns an `rdflib.Graph` in `OwlEngine`, can parse Turtle into that graph, and can serialize an `owlready2` ontology to Turtle before parsing it back into `rdflib` (`python/om_reasoner/owl_engine.py:10-20`, `python/om_reasoner/owl_engine.py:57-61`, `python/om_reasoner/owl_engine.py:81-90`).
- The Python export tests construct graph triples directly with `g.add((subject, predicate, object))` for classes, labels, comments, domains, and ranges (`python/tests/test_export.py:11-33`).
- The inference path returns subclass facts as dictionaries with `type`, `subject`, and `object` fields after iterating `cls.INDIRECT_is_a`; it does not return RDF triple tuples from that method (`python/om_reasoner/owl_engine.py:63-79`).

## 6. Projections/serializations

- The README advertises OWL export to Turtle, RDF/XML, OWL/XML, and JSON-LD through the Python `owlready2/rdflib` backend (`README.md:11-12`).
- The FastAPI export route accepts an `ExportRequest` with `model`, `format`, optional `prefixes`, and optional JSON-LD `context` (`python/om_reasoner/routes/export.py:16-20`).
- The export route loads the JSON model into `OwlEngine`, converts it to an `rdflib` graph, dispatches on `turtle`, `rdfxml`, `owlxml`, or `jsonld`, and returns corresponding media types (`python/om_reasoner/routes/export.py:23-57`).
- Turtle export optionally binds request prefixes into the graph and calls `graph.serialize(format="turtle")` (`python/om_reasoner/exporters/turtle.py:6-11`).
- RDF/XML export calls `graph.serialize(format="xml")` (`python/om_reasoner/exporters/rdfxml.py:6-8`).
- The OWL/XML exporter also calls `graph.serialize(format="xml")` and comments that rdflib does not natively support OWL/XML (`python/om_reasoner/exporters/owlxml.py:6-10`).
- JSON-LD export calls `graph.serialize(format="json-ld")` and passes the optional context when present (`python/om_reasoner/exporters/jsonld.py:7-11`).
- The CLI tries the Python `/api/export/ontology` endpoint first and falls back to a built-in Turtle generator if the backend call fails (`apps/cli/src/index.ts:83-96`).
- The CLI fallback Turtle generator emits ontology metadata, classes, object properties, data properties, and individuals by string-building Turtle lines (`apps/cli/src/index.ts:133-198`).
- The desktop export action generates Turtle preview for `turtle` and, for other formats, returns a message that the format will be generated after Python reasoner integration plus the same Turtle preview (`apps/desktop/electron/ontology-workbench-store.ts:261-272`).
- The Python export tests verify Turtle, RDF/XML, and JSON-LD exporters over a hand-built rdflib graph (`python/tests/test_export.py:36-54`).

## 7. Validation approach

- `validateOntology` returns a `ValidationResult` containing `valid`, `errors`, and `warnings` arrays (`packages/ontology/src/validators.ts:3-7`).
- The validator checks that superclass references exist unless they are built-in OWL Thing/Nothing IRIs (`packages/ontology/src/validators.ts:21-38`, `packages/ontology/src/validators.ts:122-125`).
- The validator builds a parent map and reports circular inheritance when `hasCircularInheritance` detects a repeated class IRI in a traversal (`packages/ontology/src/validators.ts:40-53`, `packages/ontology/src/validators.ts:127-139`).
- The validator warns when a class has no label (`packages/ontology/src/validators.ts:55-64`).
- The validator warns when object property domain or range class references do not exist and are not built-in classes (`packages/ontology/src/validators.ts:66-86`).
- The validator warns when the ontology has no classes (`packages/ontology/src/validators.ts:88-94`).
- Duplicate IRI validation only collects class, object property, data property, and individual IRIs in the opened code (`packages/ontology/src/validators.ts:96-113`).
- The desktop store calls `validateOntology` for explicit validation, before reasoner status, and whenever it sets an ontology model (`apps/desktop/electron/ontology-workbench-store.ts:236-258`, `apps/desktop/electron/ontology-workbench-store.ts:411-421`).
- The SHACL validator parses data and optional shapes as Turtle graphs, then calls `pyshacl.validate` with RDFS inference and `abort_on_first=False` (`python/om_reasoner/validators/shacl.py:7-35`).
- The reasoning endpoint returns an empty `triples` list for Turtle input with a message that full inference needs the owlready2 model path, while model input runs `engine.infer()` and returns the inferred list plus count (`python/om_reasoner/routes/reasoning.py:27-41`).
- `OwlEngine.infer()` calls `owlready2.sync_reasoner_hermit()` and reports inferred superclass facts from `INDIRECT_is_a` (`python/om_reasoner/owl_engine.py:63-79`).

## 8. API ergonomics - quote representative authoring call sites (actual code snippets with file:line)

- The agent tool API authors classes imperatively with `makeIRI` plus `OntologyOperations.addClass` (`packages/modeler/src/tools/modeling-tools.ts:25-34`):

```ts
// packages/modeler/src/tools/modeling-tools.ts:25-34
async execute(args: Record<string, unknown>): Promise<string> {
  const name = args.name as string;
  const iri = makeIRI(namespace, name);
  ops.addClass({
    type: 'class', iri, label: name,
    description: args.description as string | undefined,
    superClasses: args.superClassName ? [makeIRI(namespace, args.superClassName as string)] : [],
    equivalentClasses: [], disjointWith: [], restrictions: [],
  });
  return `Created class "${name}". Total classes: ${ops.stats().classes}`;
}
```

- Object-property authoring uses string arguments for domain and range class names, then converts each name through `makeIRI(namespace, ...)` (`packages/modeler/src/tools/modeling-tools.ts:50-59`):

```ts
// packages/modeler/src/tools/modeling-tools.ts:50-59
async execute(args: Record<string, unknown>): Promise<string> {
  const name = args.name as string;
  ops.addObjectProperty({
    type: 'object-property', iri: makeIRI(namespace, name), label: name,
    description: args.description as string | undefined,
    domain: [{ kind: 'iri', iri: makeIRI(namespace, args.domainClassName as string) }],
    range: [{ kind: 'iri', iri: makeIRI(namespace, args.rangeClassName as string) }],
    superProperties: [], characteristics: [],
  });
  return `Created object property "${name}". Total: ${ops.stats().objectProperties}`;
}
```

- The pi-agent protocol conversion is batch/object based: parsed class entries are mapped into `model.classes.push(...)` with minted hash-namespace IRIs (`packages/modeler/src/pi-agent-protocol.ts:173-192`):

```ts
// packages/modeler/src/pi-agent-protocol.ts:173-192
export function convertProtocolResultToOntology(result: PiAgentOntologyJson): OntologyModel {
  const prefix = result.prefix?.trim() || DEFAULT_PREFIX;
  const model = createOntology(result.iri, prefix, {
    title: result.title,
    description: result.description,
    language: "zh",
  });
  const namespace = `${result.iri}#`;

  model.classes.push(...result.classes.map((entry): OwlClass => ({
    type: "class",
    iri: makeIRI(namespace, entry.name),
    label: entry.label || entry.name,
    labels: entry.label ? { zh: entry.label } : undefined,
    description: entry.description,
    superClasses: (entry.superClasses ?? []).map((name) => makeIRI(namespace, name)),
    equivalentClasses: [],
    disjointWith: [],
    restrictions: [],
  })));
```

- The CLI user path starts by ingesting a source, deriving a filename prefix, and creating an empty ontology with `createOntology` before validation/export (`apps/cli/src/index.ts:31-43`, `apps/cli/src/index.ts:60-66`):

```ts
// apps/cli/src/index.ts:60-66
// Step 2: Create ontology model
const prefix = name.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
const model = createOntology(`http://example.org/${prefix}`, prefix, { title: prefix });

// Step 3: Validate
const validation = validateOntology(model);
```

- The desktop class creation path manually clones the model, appends a class object, updates `metadata.modified`, and revalidates through `setOntologyModel` (`apps/desktop/electron/ontology-workbench-store.ts:181-205`, `apps/desktop/electron/ontology-workbench-store.ts:411-421`).

## 9. DIAMONDS - patterns worth adopting; explicitly map each one onto our D1-D9 decisions and the handoff phases (phase 1 vocab+CURIE types, phase 2 composer binding, phase 3 fold+projections, phase 4 Fibered+retrieval)

Comparison frame: the handoff decisions D1-D9 are the authority for identity-as-IRI design, and the first-principles prototype requires `effect`-only imports, no `@beep/*` packages, static identity/CURIE literals, and type-level assertions for literal transforms (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:69-123`, `scratchpad/identity/README.md:12-23`).

| Pattern worth adopting | ontology-master evidence | Adopt into our D1-D9 plan |
|---|---|---|
| Closed literal vocab subsets with a runtime guard | `DataType` is a literal union and `isDataType` repeats the accepted runtime values (`packages/ontology/src/types.ts:80-93`, `packages/modeler/src/pi-agent-protocol.ts:328-341`). | Phase 1 vocab+CURIE types: keep the closed-union feel, but generate it from the RDF vocab registry required by D3 rather than duplicating guards by hand (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`). |
| Runtime projection record for IRI parts | The `IRI` object preserves `full`, `local`, and `namespace`, and `makeIRI` centralizes the delimiter rule (`packages/ontology/src/types.ts:7-14`, `packages/ontology/src/model.ts:7-14`). | Phase 2 composer binding: useful as a runtime projection/cache behind D1 and D2, while our source of truth remains the literal identity path and root authority binding (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-84`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:387-392`). |
| Separate owned identity fields from labels/metadata | `Labelled` keeps `iri`, `label`, `description`, and language labels as distinct fields, and `OntologyModel` keeps annotation properties in a separate collection (`packages/ontology/src/types.ts:16-21`, `packages/ontology/src/types.ts:195-201`). | Phase 2 and Phase 3: reinforces D9, where owned identity annotations and borrowed predicate slots must not share keys (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:119-122`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:358-367`). |
| Small named modeling commands | The tool layer exposes narrow commands for `create_class`, `create_object_property`, `create_data_property`, `get_data_schema`, `list_classes`, and `get_ontology_stats` (`packages/modeler/src/tools/modeling-tools.ts:12-115`). | Phase 3 fold+projections: good agent command shape, but endpoints should accept handles/CURIEs per D4 and field-key defaults per D5 instead of free strings (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-105`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`). |
| Protocol-to-model conversion as a deterministic gate | The protocol parser extracts the last fenced `ontology-json` block, parses required fields, converts to `OntologyModel`, and the desktop completion path applies that conversion before setting state (`packages/modeler/src/pi-agent-protocol.ts:91-170`, `packages/modeler/src/pi-agent-protocol.ts:173-238`, `apps/desktop/electron/ontology-workbench-store.ts:363-395`). | Phase 3 fold+projections and Phase 4 Fibered+retrieval: adopt the deterministic "parse, gate, record" posture for D6/D7 fold input and D8 agent-context grounding (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-118`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-409`). |
| Error/warning split before export | `validateOntology` returns errors and warnings, and the desktop export summary stores validation error messages beside counts (`packages/ontology/src/validators.ts:3-24`, `apps/desktop/electron/ontology-workbench-store.ts:500-511`). | Phase 3 fold+projections: preserve the split for typed `OntologyAssemblyError` hard failures versus warnings, as required by the fold contract (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-259`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`). |
| Projection boundary around a graph backend | The Python export route turns a model into an `rdflib` graph and then dispatches Turtle, RDF/XML, OWL/XML, or JSON-LD exporters (`python/om_reasoner/routes/export.py:23-57`). | Phase 3 fold+projections: useful boundary for serializer adapters, but our D6 assembled ontology projections should stay pure catamorphisms and include JSON-LD context, Turtle, Markdown, and SHACL (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`). |
| Workflow state as retrieval surface | The desktop state keeps sources, selected source IDs, modeling session ref, phase runs, ontology model, export summary, validation result, export preview, and revision (`apps/desktop/src/ontology-workbench-state.ts:85-101`). | Phase 4 Fibered+retrieval: mirrors D8's need for deterministic agent context sections, but our retrieval surface should resolve identity/IRI/CURIE through the registry service rather than UI state alone (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:283-333`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:403-409`). |

## 10. ROUGH - anti-patterns to avoid and why

- Avoid stringly references: ontology-master's agent protocol stores class/property domains, ranges, and superclasses as strings before conversion (`packages/modeler/src/pi-agent-protocol.ts:28-49`, `packages/modeler/src/pi-agent-protocol.ts:182-235`). Our D4 requires handles, known CURIEs, or absolute IRI literals rather than string references (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`).
- Avoid a prefix string without a literal CURIE registry: ontology-master stores `prefix: string` and emits it into Turtle, while the opened model definitions do not expose a dedicated CURIE type (`packages/ontology/src/types.ts:189-193`, `apps/cli/src/index.ts:135-141`). Our D3 requires borrowed vocabulary as a CURIE literal type inherited through the composer (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91`).
- Avoid hand-duplicated datatype registries: ontology-master defines `DataType` once in the type layer and repeats the same accepted strings in `isDataType` (`packages/ontology/src/types.ts:80-93`, `packages/modeler/src/pi-agent-protocol.ts:328-341`). Our Phase 1 registry should be data first and type-derived (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:128-163`).
- Avoid lossy JSON-to-OWL export bridges: ontology-master's TypeScript object/data properties include domain/range fields, but `OwlEngine.load_from_json` only dynamically creates object and data property classes in the opened Python loops and does not apply those domain/range values there (`packages/ontology/src/types.ts:43-59`, `python/om_reasoner/owl_engine.py:38-47`).
- Avoid format labels that overpromise: the `export_owlxml` function comments that rdflib does not natively support OWL/XML and then serializes as XML/RDF (`python/om_reasoner/exporters/owlxml.py:6-10`).
- Avoid serializer string-building as the semantic model: ontology-master has two hand-built Turtle emitters in CLI fallback and desktop preview, both interpolating prefix/local names into Turtle strings (`apps/cli/src/index.ts:135-198`, `apps/desktop/electron/ontology-workbench-store.ts:578-626`). Our Phase 3 projections should walk the assembled ontology model and handle PN_LOCAL escaping as a projection concern (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:198-200`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`).
- Avoid incomplete duplicate checks: ontology-master's duplicate IRI check collects classes, object properties, data properties, and individuals, while the model also contains annotation properties and SHACL shapes (`packages/ontology/src/validators.ts:96-113`, `packages/ontology/src/types.ts:195-201`).
- Avoid bypassing operation-level invariants during conversion: `OntologyOperations.addClass`, `addObjectProperty`, and `addDataProperty` check duplicates, but `convertProtocolResultToOntology` pushes parsed arrays directly into `model.classes`, `model.objectProperties`, and `model.dataProperties` (`packages/ontology/src/model.ts:52-88`, `packages/modeler/src/pi-agent-protocol.ts:182-216`).
- Avoid module-level mutable reasoner singletons for request handling: both export and reasoning routes create a module-level `engine = OwlEngine()` (`python/om_reasoner/routes/export.py:12-13`, `python/om_reasoner/routes/reasoning.py:7-8`).
- Avoid treating non-Turtle export as implemented in UI state before the backend path is wired: the desktop export method returns a placeholder message for non-Turtle formats and appends a Turtle preview (`apps/desktop/electron/ontology-workbench-store.ts:261-272`).

## 11. Sources - full list of file paths inspected

- `/home/elpresidank/YeeBois/projects/beep-effect/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`
- `/home/elpresidank/YeeBois/projects/beep-effect/scratchpad/identity/README.md`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/LICENSE`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/README.md`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/package.json`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/ontology/package.json`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/ontology/src/index.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/ontology/src/types.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/ontology/src/model.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/ontology/src/validators.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/modeler/src/tools/modeling-tools.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/modeler/src/pi-agent-protocol.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/modeler/src/pipeline.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/modeler/src/__tests__/pi-agent-protocol.test.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/store/src/project.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/packages/store/src/database.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/apps/cli/src/index.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/apps/desktop/electron/ontology-workbench-store.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/apps/desktop/src/ontology-workbench-state.ts`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/owl_engine.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/routes/export.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/routes/reasoning.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/validators/shacl.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/exporters/turtle.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/exporters/rdfxml.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/exporters/owlxml.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/om_reasoner/exporters/jsonld.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/python/tests/test_export.py`
- `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontology-master/docs/superpowers/specs/2026-05-28-ontology-workbench-pi-agent-design.md`
