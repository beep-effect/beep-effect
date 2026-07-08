## 1. Overview & purpose

rdflib.js is an RDF library for browsers and Node.js whose package metadata names it `rdflib`, describes it as "an RDF library for node.js. Suitable for client and server side.", and lists Tim BL as author (`package.json:2-12`). Its README positions it as a broad RDF and Linked Data client surface: RDF/XML, Turtle, N3, RDFa, JSON-LD, WebDAV/SPARQL Update, local querying, RDFJS compatibility, smushing, and provenance tracking (`README.md:5-15`).

The identity-as-IRI baseline is stricter than rdflib.js: D1 requires total root authority binding, D3 requires borrowed vocabulary as static CURIE literal types, D4 requires handles rather than strings, D6 requires triples-as-tuples, and D8 requires a first-class `Fibered` retrieval kit (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-122`). The scratchpad reinforces that this prototype is clean-room, `effect`-only, static-literal-only, and disposable provenance before graduation (`scratchpad/identity/README.md:14-24`). This report mines rdflib.js for mature RDF API scar tissue against that baseline.

## 2. License — verify by reading package.json "license" field, any LICENSE file, and README license mentions; quote the exact findings. If verified MIT/Apache-2.0, mark it "port-with-attribution" eligible. If genuinely missing/unclear, mark it "REFERENCE-ONLY".

License status: **MIT; port-with-attribution eligible** (`package.json:39`, `README.md:114-115`, `MIT-LICENSE.txt:1-21`).

- `package.json` exact finding: `"license": "MIT",` (`package.json:39`).
- `README.md` exact finding: `## LICENSE` followed by `MIT` (`README.md:114-115`).
- `MIT-LICENSE.txt` exact finding: `Copyright 2000-2012 MIT and other contributors` (`MIT-LICENSE.txt:1`).
- `MIT-LICENSE.txt` exact permission finding: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files... to deal in the Software without restriction` (`MIT-LICENSE.txt:4-8`).
- `MIT-LICENSE.txt` exact attribution condition: `The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.` (`MIT-LICENSE.txt:12-13`).

## 3. Identity/IRI/prefix handling (NamedNode design, Namespace() factory ergonomics, sameTerm/equality semantics)

- `NamedNode` is the concrete IRI term class: its comment says "A named (IRI) RDF node", it sets `termType` to `NamedNode`, and its constructor stores `termValue(iri)` as the node value (`src/named-node.ts:8-22`).
- `NamedNode` validates at construction time that the IRI is present, contains a colon, and has no unencoded space; failures throw `Error` (`src/named-node.ts:23-34`).
- `NamedNode` includes web-centric helpers: `dir()` strips fragments and returns the containing slash directory, `site()` returns an origin-like site with trailing slash, and `doc()` removes a `#` fragment (`src/named-node.ts:37-74`).
- `NamedNode.toString()` serializes as `<${value}>`, and `id()` returns the fragment after `#` (`src/named-node.ts:76-86`).
- `NamedNode.uri` is an alias for `value`, and it has both getter and setter, so the IRI string is mutable after construction (`src/named-node.ts:88-95`).
- Generic `Node.equals` compares `termType` and `value`, while `Node.sameTerm` simply delegates to `equals` (`src/node-internal.ts:60-87`).
- `Literal.equals` extends equality beyond term type and lexical value by also comparing language and datatype equality (`src/literal.ts:60-74`).
- `Namespace(nsuri, factory?)` returns a local-name function whose only parameter is `ln: string`, and the returned function creates `namedNode(nsuri + (ln || ''))` (`src/namespace.ts:4-14`).
- `Namespace` defaults to an inline `namedNode` factory that constructs rdflib `NamedNode`s, but it can be supplied a custom `RdfJsDataFactory` (`src/namespace.ts:9-13`).
- A unit test captures the ergonomic pattern: `Namespace("http://example.com/")("term")` equals `new NamedNode("http://example.com/term")` (`tests/unit/namespace-test.js:5-13`).
- Store-level prefix state is a mutable `namespaces` dictionary (`src/store.ts:133-137`, `src/store.ts:201-202`).
- `setPrefixForURI(prefix, nsuri)` ignores `tab` in one special case, ignores generated-looking `ns*` and `default*` prefixes, removes any existing prefix targeting the same namespace, and then records the new mapping (`src/store.ts:1087-1105`).
- `Formula.sym(uri, name?)` rejects the removed two-argument prefix-mapping form with `This feature (kb.sym with 2 args) is removed. Do not assume prefix mappings.` (`src/formula.ts:746-750`).

## 4. Vocabulary typing

- The RDFJS-facing `NamedNode` interface is only `termType: "NamedNode"` plus `value: string`; it does not carry prefix/local-name type membership in that interface (`src/tf-types.ts:26-33`).
- rdflib's internal RDF type aliases similarly model `SubjectType`, `PredicateType`, `ObjectType`, and `GraphType` as unions of term classes rather than vocabulary-specific literal unions (`src/types.ts:76-83`).
- The ergonomic vocabulary factory is runtime-only: `Namespace(nsuri)` accepts any `ln: string` and concatenates it to the namespace IRI (`src/namespace.ts:9-14`).
- XSD is provided as a fixed runtime object of named nodes such as `boolean`, `dateTime`, `decimal`, `double`, `integer`, `langString`, and `string` (`src/xsd.js:3-17`, `src/xsd-internal.js:1-10`).
- `Literal` defaults to `xsd:string`, changes to `rdf:langString` when a language is supplied, and otherwise accepts a caller-supplied datatype converted through `NamedNode.fromValue` (`src/literal.ts:22-50`).
- Serializer construction seeds a prefix map from `solid-namespace`, then explicitly suggests `rdf` and `xml` prefixes (`src/serializer.js:8-45`).
- The `serialize(...)` options surface accepts `namespaces?: Record<string, string>` as prefix mappings, not a typed vocabulary registry (`src/serialize.ts:33-43`).
- Type-level compatibility tests assign rdflib factory terms to `@rdfjs/types` `NamedNode`, `BlankNode`, `Literal`, `Variable`, and `DefaultGraph` variables, and then use rdflib-specific methods like `toCanonical()` on inferred rdflib terms (`tests/types/rdfjs-compatibility.ts:1-25`).

## 5. Triple/graph model (Statement, IndexedFormula/store, quads)

- `Statement` represents "an RDF Triple or Quad" and implements the RDFJS `Quad<S, P, O, G | DefaultGraph>` shape (`src/statement.ts:15-23`).
- `Statement` stores `subject`, `predicate`, `object`, and `graph`, and its constructor coerces subject, predicate, object, and graph through `Node.fromValue`, defaulting graph to a default graph when omitted (`src/statement.ts:24-66`).
- The `graph` field is documented as the document where the triple is or was or will be stored, and the comment says the graph explains why the triple is present after reading data from various web places (`src/statement.ts:33-55`).
- `Statement.why` is an alias getter/setter for `graph` (`src/statement.ts:68-75`).
- `Statement.equals` checks equality of subject, predicate, object, and graph (`src/statement.ts:77-88`).
- `Formula` is "A formula, or store of RDF statements"; it stores an array of `Statement`s and exposes `ns = Namespace` (`src/formula.ts:53-75`, `src/formula.ts:89-103`).
- `Formula.add` appends `rdfFactory.quad(subject, predicate, object, graph)` to the `statements` array (`src/formula.ts:105-121`).
- `Formula.statementsMatching` does a linear filter over statements using `equals` on any provided subject, predicate, object, and graph (`src/formula.ts:240-270`).
- `IndexedFormula` is "Indexed Formula aka Store" and declares subject, predicate, object, and why indexes plus a four-entry `index` tuple (`src/store.ts:124-161`).
- `IndexedFormula.add` accepts statements, arrays, stores, or raw quad parts; it converts string subjects to named nodes, converts terms through `Node.fromValue`, validates subject/predicate/object/graph roles, de-duplicates with `holds`, indexes the resulting statement in all four indexes, pushes it to `statements`, and triggers data callbacks (`src/store.ts:398-499`).
- `IndexedFormula.statementsMatching` canonicalizes provided terms, returns the whole statement array for an all-wildcard query, uses a direct index for a single fixed term, and for multiple fixed terms chooses the shortest available index before filtering (`src/store.ts:1107-1194`).
- `IndexedFormula` supports owl identity-processing features through property/class actions for `owl:sameAs`, `owl:InverseFunctionalProperty`, and `owl:FunctionalProperty` when features are enabled (`src/store.ts:63-65`, `src/store.ts:360-390`).
- `equate` canonicalizes two terms and calls `replaceWith` to redirect the lexically larger term to the smaller one (`src/store.ts:662-685`).
- `replaceWith` moves indexes from the old hash to the new hash, records redirections and aliases, adds a `link:uri` triple, and informs the fetcher if present (`src/store.ts:1010-1057`).

## 6. Serializers (prefixed-name generation, escaping rules)

- `serialize(...)` defaults to Turtle and dispatches by content type to RDF/XML, N3, Turtle, N-Triples, JSON-LD, and N-Quads/N-Quads-alt writers (`src/serialize.ts:18-95`).
- `serialize(...)` uses store namespaces as suggestions when the store has a `namespaces` field, and `options.namespaces` are applied as mandatory prefixes through `setNamespaces` (`src/serialize.ts:54-64`).
- Turtle serialization merges default `si` flags with user flags so a caller can preserve options such as `o` (`src/serialize.ts:73-78`).
- JSON-LD serialization sets flags `si dr`, serializes through Turtle, then converts with `ttl2jsonld.parse` (`src/serialize.ts:83-87`, `src/serializer.js:1046-1064`).
- Serializer prefix state is stored in paired `prefixes` and `namespaces` maps; construction initializes them from `solid-namespace` and suggested `rdf`/`xml` prefixes (`src/serializer.js:20-45`).
- `setPrefix` rejects empty values and generated-looking `default*`/`ns*` prefixes, deletes any existing namespace using the requested prefix, and records the prefix-to-namespace pair (`src/serializer.js:94-118`).
- `suggestPrefix` is weaker than `setPrefix`: it rejects the same generated-looking/empty values and returns without changing an already-used prefix or namespace URI (`src/serializer.js:121-133`).
- `makeUpPrefix` derives a prefix from the namespace tail, tries several prefix lengths, and falls back to numbered prefixes (`src/serializer.js:159-195`).
- `isValidPNLocal(local)` allows empty locals, rejects a trailing dot, allows dots inside the local name, and rejects characters present in `_notNameChars` (`src/serializer.js:258-283`).
- `symbolToN3` tries to split a named node URI at `#`, or at the last `/` unless the `/` flag is present, and only considers prefix abbreviation for `http`, `ws`, or `file` URIs when prefix abbreviation is not suppressed by `p` (`src/serializer.js:647-657`).
- `symbolToN3` refuses a prefixed-name split when the namespace is the base directory, when flag `o` forbids a dot-containing local, when the namespace is too short, or when `isValidPNLocal(localid)` fails (`src/serializer.js:658-669`).
- When a prefixed-name split is valid, `symbolToN3` uses the default namespace, an existing prefix, or `makeUpPrefix`; otherwise it falls through to `explicitURI(uri)` (`src/serializer.js:678-698`).
- `explicitURI` emits relative IRIs against `base` unless flag `r` is set, applies N-Triples-style Unicode escaping under `u`, otherwise URI-encodes via `hexify(decodeURI(uri))`, and wraps the result in angle brackets (`src/serializer.js:285-294`).
- `stringToN3` chooses single-quote or triple-quote delimiters based on string length/newline/quote content and escapes control characters, quotes, backslashes, and non-ASCII when `e` is active (`src/serializer.js:599-646`).
- Literal serialization emits native numeric/boolean Turtle forms for XSD integer, decimal, double, and boolean unless flag `x` suppresses that behavior (`src/serializer.js:550-590`).
- Dot-local behavior is covered by tests: dotted prefixed names parse, non-trailing dotted locals abbreviate by default, trailing-dot locals stay full IRIs, and flag `o` forces dotted locals to stay full IRIs (`tests/unit/dot-in-term-test.ts:5-22`, `tests/unit/dot-in-term-test.ts:178-241`).

## 7. Validation approach

- rdflib.js validates many invariants at runtime through constructors and throws: `NamedNode` rejects missing, relative-looking, and space-containing IRIs (`src/named-node.ts:20-34`).
- Unit tests assert that `NamedNode` throws for a URI with spaces and for a relative URI (`tests/unit/named-node-test.js:7-16`).
- `IndexedFormula.add` performs runtime role validation with `isRDFlibSubject`, `isRDFlibPredicate`, `isRDFlibObject`, and `isGraph`, and throws `Error` when a role check fails (`src/store.ts:433-450`).
- The role guards are structural term-type checks, and the rdflib-specific predicate guard permits `NamedNode`, `BlankNode`, or `Variable` term types (`src/utils/terms.ts:36-68`).
- `parse(...)` dispatches by content type, wraps synchronous parse failures, uses callbacks for parse success/error, and throws `Don't know how to parse ... yet` for unsupported content types (`src/parse.ts:17-74`, `src/parse.ts:97-145`).
- The N3 parser reports syntax failures with `BadSyntax`, including missing qname after `@prefix`, missing URI after `@prefix`, bad string escapes, and bad hex escapes (`src/n3parser.js:460-482`, `src/n3parser.js:1450-1535`).
- Store integrity checking exists as an imperative consistency walk over `statements` and all four indexes (`src/store.ts:536-596`).
- Validation is not schema-first in the inspected core paths: the concrete evidence is runtime constructors, structural guards, imperative store checks, and parser errors rather than a schema decode boundary (`src/named-node.ts:20-34`, `src/store.ts:433-450`, `src/store.ts:536-596`, `src/parse.ts:17-74`).

## 8. API ergonomics — representative call sites (short real code excerpts)

Namespace factory ergonomics: a namespace callable turns a local string into a `NamedNode` and equality stays term-based (`tests/unit/namespace-test.js:7-12`).

```js
const ns = Namespace("http://example.com/")
const term = ns('term')
expect(term.equals(new NamedNode("http://example.com/term"))).to.equal(true)
```

Formula/store convenience: terms can be added with `kb.add`, then `each`, `any`, and `anyValue` retrieve by wildcard position (`tests/unit/formula-test.js:51-77`).

```js
const kb = new Formula()
kb.add(alice, knows, bob, doc)
kb.add(alice, knows, charlie, doc)
kb.add(alice, age, 21)
let friends = kb.each(alice, knows)
let x = kb.any(alice, age)
let s = kb.anyValue(alice, age)
```

Prefix control at serialization: the graph records prefix mappings, statements are added, and Turtle emits `example:subject schema:predicate` (`tests/unit/serialize-test.js:171-189`).

```js
const kb = graph()
kb.setPrefixForURI("example", "https://example.com/")
kb.add(statement)
const result = serialize(doc, kb, null, 'text/turtle')
```

Dot-local projection control: default Turtle abbreviation emits `ex:file.name`, while flag `o` forces `<http://example.com/file.name>` (`tests/unit/dot-in-term-test.ts:226-240`).

```ts
const withDefault = serialize(doc, kb, null, 'text/turtle')
expect(withDefault).to.contain('ex:file.name')
const withFlag = serialize(doc, kb, null, 'text/turtle', undefined, { flags: 'o' })
expect(withFlag).to.contain('<http://example.com/file.name>')
```

Identity smushing call site: adding `owl:sameAs` makes a lookup through the other node succeed when `IndexedFormula` identity behavior is active in that test harness (`test/tc0003/test_identity.js:39-48`).

```js
var ex = new $rdf.Namespace('http://example/com/#')
var owl = new $rdf.Namespace('http://www.w3.org/2002/07/owl#')
var kb = new $rdf.IndexedFormula()
kb.add(ex('John'), ex('hairColor'), 'Yellow')
kb.add(ex('Jack'), ex('eyeColor'), 'Green')
kb.add(ex('John'), owl('sameAs'), ex('Jack'))
var y = kb.the(ex('John'), ex('eyeColor'))
```

Standalone export ergonomics: `st` is exported as a standalone function and can be called with three string values, yielding a statement with subject/predicate/object values matching those strings (`tests/unit/exports.js:4-16`).

```js
const st = rdflib.st
const triple = st('http://ex.org/s', 'http://ex.org/p', 'http://ex.org/o')
expect(triple.subject).to.have.property('value', 'http://ex.org/s')
```

## 9. DIAMONDS — patterns worth stealing, explicitly mapped onto D1–D9 from the handoff doc and onto phases (Phase 1 vocab+CURIE types, Phase 2 composer binding, Phase 3 fold+projections, Phase 4 Fibered+retrieval)

- **Callable namespace factories, but type them.** rdflib's `Namespace(nsuri)(local)` is the right ergonomic shape for borrowed vocabulary references (`src/namespace.ts:9-14`, `tests/unit/namespace-test.js:7-12`). Map to **D3** and **Phase 1**: keep the callable feel, but make the argument a static CURIE literal type and generate the registry from schema data rather than accepting any `string` (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:380-385`).
- **Absolute IRI validation belongs at the identity constructor boundary.** `NamedNode` rejects missing, relative-looking, and space-containing IRIs (`src/named-node.ts:20-34`). Map to **D1/D4** and **Phase 2**: composer-derived IRIs should be total and literal-preserving, but still fail fast if a root binding would mint an invalid absolute IRI (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-78`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:387-392`).
- **Quads preserve provenance without complicating the triple authoring grammar.** `Statement` keeps S/P/O plus `graph`, and the graph is explicitly documented as the document/provenance for a triple (`src/statement.ts:15-66`). Map to **D6/D7** and **Phase 3**: author triples as tuples, then let the fold attach provenance/context graph metadata during assembly (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-114`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:394-401`).
- **Four-position indexing is the veteran retrieval lesson.** `IndexedFormula` indexes subject, predicate, object, and graph, then `statementsMatching` uses a direct index or shortest index before filtering (`src/store.ts:148-161`, `src/store.ts:1107-1194`). Map to **D8** and **Phase 4**: `Fibered` should build deterministic maps once and retrieve by identity/CURIE/IRI without global search (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-118`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:403-409`).
- **Projection-specific prefix policy is correct.** rdflib keeps full IRI identity in terms, while `symbolToN3` decides whether to emit a prefixed name or full IRI based on namespace/local validity, flags, and base (`src/serializer.js:647-698`). Map to **D2** and **Phase 1/Phase 3**: slash/hash choice and PN_LOCAL escaping are projection concerns, not model concerns (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:79-84`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:198-200`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:346-348`).
- **Dotted-local tests are directly reusable as a regression family.** rdflib tests parse dotted QNames, default abbreviation, trailing-dot full IRI fallback, and the `o` flag escape hatch (`tests/unit/dot-in-term-test.ts:5-22`, `tests/unit/dot-in-term-test.ts:178-241`). Map to **D2/Phase 1/Phase 3**: port these cases into the PN_LOCAL escaper and Turtle projection tests.
- **One graph, many projections.** `serialize(...)` dispatches one store to Turtle, N3, RDF/XML, JSON-LD, N-Triples, and N-Quads paths (`src/serialize.ts:18-95`). Map to **D6/Phase 3**: the `$I.ontology` fold should create one assembled graph value whose JSON-LD, Turtle, Markdown, context, and later SHACL projections are pure folds (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:253-257`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-354`).

## 10. ROUGH — scar tissue / anti-patterns to avoid, with reasons

- **Raw string coercion makes D4 unenforceable.** `IndexedFormula.add` converts string subjects to named nodes and converts object values through `Node.fromValue` (`src/store.ts:433-438`), and tests show object strings/numbers/booleans/dates being accepted directly (`tests/unit/formula-test.js:43-46`, `tests/unit/formula-test.js:51-123`). D4 says relation endpoints are handles, known CURIEs, or absolute IRI literals, never `Ont.ref`-style strings or typo-prone schema names (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`).
- **Mutable IRI values are poison for interned identity.** `NamedNode.uri` has a setter that assigns `this.value = uri` (`src/named-node.ts:88-95`). D1/D2 need composer identity, interned symbol, IRI, and CURIE projections to remain mechanically derived and stable except for explicit `rebase` projection changes (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-84`, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:193-196`).
- **Automatic prefix invention is useful for display but wrong as authority.** `makeUpPrefix` derives prefixes from arbitrary namespace tails (`src/serializer.js:159-195`), and tests expect invented prefixes like `exa` and `shacl` (`tests/unit/serializer-test.ts:12-46`). D1/D3 require root-owned prefixes and vocab registry inheritance, so invented prefixes should be projection-only and never feed typed identity (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-91`).
- **Smushing changes retrieval semantics behind the caller's back.** Optional `sameAs`, inverse-functional-property, and functional-property features install property actions (`src/store.ts:360-390`); `equate` and `replaceWith` redirect indexes and aliases (`src/store.ts:662-685`, `src/store.ts:1010-1057`). For identity-as-IRI, `owl:sameAs` should remain an explicit graph fact or an opt-in closure layer, not a default mutation of canonical owned identity.
- **Runtime errors are not typed errors.** Constructor checks, store role checks, parser dispatch, and N3 `BadSyntax` produce runtime `Error`/`BadSyntax` failures (`src/named-node.ts:20-34`, `src/store.ts:433-450`, `src/parse.ts:67-74`, `src/n3parser.js:460-482`). The beep implementation should keep fold validation as `effect/Schema` plus typed `OntologyAssemblyError` boundaries (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:241-257`).
- **Legacy aliases accumulate cognitive load.** `Statement.why` aliases `graph` (`src/statement.ts:68-75`), `Store as IndexedFormula` is exported as an alias (`src/index.ts:65-99`), and `Formula.sym(uri, name?)` still has a rejected legacy two-argument shape (`src/formula.ts:746-750`). The new API should use nominal `$I.key`, `$I.class`, and `$I.ontology` entrypoints without synonym surfaces (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:241-252`).
- **Serializer flags are powerful but too stringly for house APIs.** rdflib uses string flags like `si`, `dr`, `p`, and `o` for serializer behavior (`README.md:66-95`, `src/serializer.js:53-63`, `src/serialize.ts:73-91`). The new projections should expose typed options and keep one-character flags only as internal implementation details if used at all.
- **RDFJS compatibility is necessary but not sufficient.** rdflib terms satisfy RDFJS shapes while also exposing rdflib-specific methods (`tests/types/rdfjs-compatibility.ts:1-25`). Beep should interoperate with RDFJS at boundaries while preserving stronger internal `IdentityComposer`/CURIE/handle types.

## 11. D1–D9 DELTA TABLE — one row per decision D1 through D9, marking whether rdflib.js's approach supports, contradicts, or is silent on each decision, with a one-line justification per row

| Decision | rdflib.js delta | One-line justification |
|---|---|---|
| D1 - Authority binding is total, at the root (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-78`) | Contradicts | rdflib validates absolute `NamedNode` IRIs but allows open `namedNode`/`sym` construction and per-call `Namespace` factories rather than total root composer binding (`src/named-node.ts:20-34`, `src/namespace.ts:9-14`, `src/formula.ts:746-750`). |
| D2 - Slash IRIs for mechanical mapping; hash allowed via `rebase` (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:79-84`) | Supports | rdflib treats hash and slash as serializer split points and falls back to explicit IRIs when a prefixed name is unsafe, which supports the projection-vs-model split even though it has no composer `rebase` (`src/serializer.js:647-698`). |
| D3 - Borrowed vocabulary is a CURIE literal type baked into the composer (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:85-91`) | Contradicts | rdflib's borrowed-vocab ergonomics are `Namespace(nsuri)(ln: string)`, which is runtime-concatenated and not a CURIE literal union (`src/namespace.ts:9-14`). |
| D4 - References are handles, never strings (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:92-95`) | Contradicts | rdflib accepts/coerces raw strings in `IndexedFormula.add` and exported `st(...)` call sites, so typos are runtime data rather than compile errors (`src/store.ts:433-438`, `tests/unit/exports.js:4-16`). |
| D5 - Predicate local names default to the struct key (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:96-99`) | Silent | rdflib has predicates as graph terms and serializer-local names, but no schema struct-field authoring layer where field keys can default predicates (`src/statement.ts:24-31`, `src/serializer.js:658-693`). |
| D6 - Relational facts are triples-as-tuples (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:100-105`) | Supports | rdflib's core value is S/P/O plus optional graph provenance, and store queries operate directly over subject, predicate, object, graph positions (`src/statement.ts:15-66`, `src/store.ts:1107-1194`). |
| D7 - Where relational facts live is open (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:106-114`) | Silent | rdflib stores graph statements but has no `$I.class` inline-fact channel or `$I.ontology` fold authoring channel to compare (`src/formula.ts:53-75`, `src/store.ts:124-161`). |
| D8 - The fibration pattern becomes a first-class kit (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:115-118`) | Supports | rdflib does not implement `Fibered`, but its four-position index plus graph/provenance slot is useful evidence for deterministic retrieval structures (`src/store.ts:148-161`, `src/store.ts:1107-1194`, `src/statement.ts:33-55`). |
| D9 - Owned/borrowed annotation channels never share a key (`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:119-122`) | Silent | rdflib models terms and namespace/prefix maps, but the inspected core does not have owned-vs-borrowed annotation keys analogous to `identifier` and `term` (`src/named-node.ts:8-35`, `src/store.ts:1087-1105`). |

## 12. "What would we do differently" — synthesis of concrete recommendations

1. Keep rdflib's callable namespace ergonomics, but make the callable argument a generated literal union of valid local names and expose authoring as CURIE literals (`"skos:prefLabel"`) rather than raw namespace-local strings.
2. Make the composer root the only place that binds authority, prefix, and vocab. Serializer prefix maps may override display, but they must never mint identity.
3. Preserve rdflib's separation between model identity and projection escaping: full IRIs remain canonical in the model, while Turtle decides whether CURIE/local emission is valid.
4. Port the dot-local and trailing-dot test families into the Phase 1 PN_LOCAL escaper and Phase 3 Turtle projection tests.
5. Use rdflib's quad/provenance lesson, but keep the authoring grammar as D6 triples-as-tuples; graph/provenance belongs in the assembled fold result.
6. Build indexes deliberately: subject/predicate/object/graph maps for ontology assembly, and identity/CURIE/IRI maps for `Fibered` retrieval. Do not rely on corpus-wide search.
7. Reject raw string endpoint coercion. Endpoints should be schema handles, known CURIEs, or absolute IRI literals, with schema errors or type errors at the boundary.
8. Do not smush owned identity by default. Treat `owl:sameAs`, functional properties, and inverse-functional properties as explicit facts or an opt-in reasoning layer.
9. Replace string serializer flags with typed projection options. Internally, options can map to compact flags, but the public API should document behavior as data.
10. Use RDFJS compatibility only at package boundaries. Internally, keep literal-preserving `IdentityComposer`, vocab registry, and typed `OntologyAssemblyError` contracts.

## 13. Sources — every file path (with line numbers where relevant) that was actually inspected to produce this report

Baseline authority:

- `<repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:74-122`
- `<repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:126-200`
- `<repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:204-260`
- `<repo-root>/explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:337-409`
- `<repo-root>/scratchpad/identity/README.md:1-24`

rdflib.js metadata and docs:

- `<local-research-checkout>/rdflib.js/package.json:1-165`
- `<local-research-checkout>/rdflib.js/MIT-LICENSE.txt:1-21`
- `<local-research-checkout>/rdflib.js/README.md:1-115`

rdflib.js core source:

- `<local-research-checkout>/rdflib.js/src/named-node.ts:1-110`
- `<local-research-checkout>/rdflib.js/src/node-internal.ts:1-115`
- `<local-research-checkout>/rdflib.js/src/node.ts:1-47`
- `<local-research-checkout>/rdflib.js/src/namespace.ts:1-15`
- `<local-research-checkout>/rdflib.js/src/statement.ts:1-149`
- `<local-research-checkout>/rdflib.js/src/formula.ts:1-820`
- `<local-research-checkout>/rdflib.js/src/store.ts:1-1228`
- `<local-research-checkout>/rdflib.js/src/index.ts:1-138`
- `<local-research-checkout>/rdflib.js/src/serializer.js:1-1088`
- `<local-research-checkout>/rdflib.js/src/serialize.ts:1-112`
- `<local-research-checkout>/rdflib.js/src/literal.ts:1-190`
- `<local-research-checkout>/rdflib.js/src/factories/canonical-data-factory.ts:1-238`
- `<local-research-checkout>/rdflib.js/src/factories/extended-term-factory.ts:1-60`
- `<local-research-checkout>/rdflib.js/src/factories/rdflib-data-factory.ts:1-58`
- `<local-research-checkout>/rdflib.js/src/types.ts:1-103`
- `<local-research-checkout>/rdflib.js/src/tf-types.ts:1-183`
- `<local-research-checkout>/rdflib.js/src/xsd-internal.js:1-10`
- `<local-research-checkout>/rdflib.js/src/xsd.js:1-21`
- `<local-research-checkout>/rdflib.js/src/utils/terms.ts:1-142`
- `<local-research-checkout>/rdflib.js/src/parse.ts:1-145`
- `<local-research-checkout>/rdflib.js/src/n3parser.js:430-490`
- `<local-research-checkout>/rdflib.js/src/n3parser.js:1450-1555`

rdflib.js tests and representative call sites:

- `<local-research-checkout>/rdflib.js/tests/unit/namespace-test.js:1-31`
- `<local-research-checkout>/rdflib.js/tests/unit/formula-test.js:1-126`
- `<local-research-checkout>/rdflib.js/test/tc0003/test_identity.js:1-107`
- `<local-research-checkout>/rdflib.js/tests/unit/serialize-test.js:1-603`
- `<local-research-checkout>/rdflib.js/tests/unit/serializer-test.ts:1-53`
- `<local-research-checkout>/rdflib.js/tests/unit/named-node-test.js:1-17`
- `<local-research-checkout>/rdflib.js/tests/unit/dot-in-term-test.ts:1-243`
- `<local-research-checkout>/rdflib.js/tests/types/rdfjs-compatibility.ts:1-25`
- `<local-research-checkout>/rdflib.js/tests/unit/factories/canonical-data-factory-test.ts:1-65`
- `<local-research-checkout>/rdflib.js/tests/unit/exports.js:1-25`
