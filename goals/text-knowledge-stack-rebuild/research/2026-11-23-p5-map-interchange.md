# P5 map: L6 interchange (Dataset quotient and digest, Literal cases, fold -> Dataset, rdf -> md, prov:Entity lens, namespace pins)

Read-only measurement at b61b79aa79f. No source was edited. Paths are repo-relative; `rdf/` below means `packages/foundation/modeling/rdf/`, `ontology/` means `packages/foundation/modeling/ontology/`. Line numbers are at this commit; where `research/consumer-census.md` cites an older line, the live line is given and the census line is noted as stale. Counts come from `git ls-files -- '*.ts' '*.tsx' | grep -vE '^(scratchpad|goals)/' | xargs rg -c -P '<pattern>'`, so they include comments and JSDoc examples.

## 1. The folds that produce RDF today (what `fold -> Dataset` replaces)

The ontology fold produces no `Dataset`. `fold` (`ontology/src/Fold.assembly.ts:981`, over `foldWith` `:954`) returns an `AssembledOntology` (`ontology/src/Fold.models.ts:677`: `classes`, `facts: S.Array(AssembledFact)`, `warnings`), and four string projections serialize it directly:

| Projection | Site | Output | Notes |
| --- | --- | --- | --- |
| `toTurtle` | `ontology/src/Fold.projections.ts:666` | Turtle text | hand-written writer: prefix block `:563`, class blocks, predicate blocks, one statement per fact `:552`; escaping `:459-466` |
| `toJsonLd` | `Fold.projections.ts:413` | `JsonLdDocument` (plain TS type `:137`) | not a `@beep/rdf/JsonLd` schema value |
| `toContext` | `Fold.projections.ts:249` | JSON-LD context record | |
| `toMarkdown` | `ontology/src/Fold.markdown.ts:304` (impl `:218`) | Markdown page | documentation, not RDF |

Literal handling in the fold's Turtle writer (`Fold.projections.ts:470-485`): a language tag wins over a datatype (`:481`, the datatype is dropped when both are set); a number or boolean without datatype prints bare (`literalValue` `:470`), so Turtle reads it as `xsd:integer`, `xsd:decimal`, `xsd:double` or `xsd:boolean` by lexical shape; a string without datatype or language prints as a simple literal. The fold's own input literal is the plain type `TypedLiteral` (`Fold.models.ts:124`: `value: string | number | boolean`, optional `datatype`, optional `language`), resolved into `FactLiteral` (`Fold.models.ts:411`: `value`, `datatypeIri: Option<IRI>`, `language: Option<LanguageTag>`); `Fold.assembly.ts:323` drops an invalid language tag silently through `O.flatMap(..., decodeLanguageTag)`. `ontology/test/Fold.test.ts:680` already passes `{ datatype: "rdf:langString", language: "en" }`.

The `@beep/ontology` -> `@beep/rdf` edge exists (`ontology/package.json` dependencies) but only `LanguageTag` is imported (`Fold.models.ts:19`, `Fold.assembly.ts:17`); `rg Dataset ontology/src` is empty.

Consumers of the string projections outside the package: `packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:8,405` (`toTurtle(assembled)` written to `ontology/research-library.ttl`, path `Library.paths.ts:39`, then reparsed by `N3TurtleCodec` to count triples `:421`) and `cli/test/research-library-ontology.test.ts:6,317,345` (parse and byte-stability of `toTurtle`). Inside: `ontology/test/Fold.test.ts` (substring assertions on Turtle text at `:348-360`, `:823`; JSON-LD at `:268-335`; Markdown at `:367-411`, `:857`). `research-library.ttl` is not tracked (`git ls-files | grep research-library.ttl` empty), so no committed Turtle golden changes.

The cli already builds a second, independent `Dataset` beside the fold: `libraryShapesDataset` (`Library.ontology.ts:284-357`) assembles SHACL quads and serializes them through `@beep/n3` `N3SerializeTurtleRequest` with a prefix map (`Library.ontology.ts:370-385`; request schema `packages/drivers/n3/src/N3.service.ts:111`). `catalogDataset` (`Library.projection.ts:155-308`) dedupes by `serializeQuad` into an `effect/HashSet` then sorts (`:301-308`). That N3 path is the existing `Dataset -> Turtle` serializer `fold -> Dataset` can reuse at the cli boundary; `@beep/n3` is a driver that depends on `@beep/rdf` (`packages/drivers/n3/package.json:57-60`), so `@beep/ontology` cannot call it.

## 2. `Dataset` today: representation, equality, blank nodes, canonical form and digests

Representation. `Dataset` is `S.Struct({ quads: S.Array(Quad) })` (`rdf/src/Rdf.ts:728-741`; census cites `:798-800`, stale). `makeDataset` copies the array (`Rdf.ts:1113`). Order and duplicate multiplicity are part of the value. `Quad` is `{ subject, predicate, object, graph }` with no `termType` (`Rdf.ts:694`). Terms are discriminated on `termType` through `S.toTaggedUnion("termType")` (`Term` `:518`, `Subject` `:559`, `ObjectTerm` `:605`, `GraphTerm` `:650`).

Equality. `areDatasetsEquivalent` (`Rdf.ts:1243-1251`) joins `sortDatasetQuads` (`:1221`, lexical order of `serializeQuad`) and compares strings. That is multiset equality on labelled quads: two datasets that differ only by blank-node labels compare unequal, and `[q, q]` differs from `[q]`. `serializeQuad`/`serializeTerm` (`:1166-1198`) is not N-Quads: the default graph prints `default` (`:1174`), blank labels are re-encoded (`:1134-1147`), and a language-tagged literal prints `"v"@tag` with the datatype dropped and the tag lowercased (`:1170-1172`). It is used as a set key in production: `OaCodec.ts:730-738,967,1499-1546` (annotation), `Library.projection.ts:301-307`, `apps/labs/semantica/src/layers/RdfProjectionLive.ts:114-121`, `ProvRdf.ts` `sameQuad`.

Live usage at this commit: `makeDataset(` 169 lines / 60 files; `Dataset.make(` 7 / 5; `sortDatasetQuads` 17 / 8; `areDatasetsEquivalent` 15 / 4 (only `rdf/test/Rdf.test.ts:314-316`, `rdf/test/ProvRdf.test.ts:197,225,264,360,386,592`, `annotation/test/rdf/OaCodec.laws.test.ts:627`); `serializeQuad` 64 / 17. Production `.quads` readers outside rdf and tests (22 files): the largest is the ontology slice, `packages/ontology/domain/src/aggregates/Session/Session.model.ts` (16 lines), which already re-implements set semantics by hand (`hasQuad(dataset.quads, quad) ? dataset : makeDataset(A.append(...))`, `:462`, `:686-693`). No table or stored-row schema holds a `Dataset` (coarse check: no file importing `@beep/rdf/Rdf` also declares a table; the ontology session re-parses its dataset, `packages/ontology/use-cases/src/aggregates/Session/Session.service.ts:128`).

Blank nodes. `BlankNode` is `{ termType: "BlankNode", value: BlankNodeLabel }` (`Rdf.ts:366`, label schema `:153-176`); nothing relabels or skolemizes. Producers that guarantee ground output: OA `encode`/`normalize` (decision `2026-11-22-p3-oa-instance-iris-and-ground-datasets`, SPEC.md:1804; tested `OaCodec.laws.test.ts:572`); `ProvRdf` mints `record/<index>` and `relation/<index>` IRIs (`rdf/src/ProvRdf.ts:162-167`) and refuses blank-node record subjects on decode (`rdf/test/ProvRdf.test.ts:451`).

Canonical form and digests. Three digest paths exist, none in `@beep/rdf`:

| Path | Site | Canonical form | Digest |
| --- | --- | --- | --- |
| `CanonicalizationService` contract | `packages/foundation/capability/semantic-web/src/services/canonicalization.ts:51` (`CanonicalizationAlgorithm = LiteralKit(["rdfc-1.0", "lexical-sort-v1"])`), requests `:175,214`, results `:250,283`, service `:363` | per algorithm | `DatasetFingerprint.fingerprint: Sha256Hex` (unprefixed hex) |
| `CanonicalizationServiceLive` | `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts` | `rdfc-1.0`: `canonize(..., { algorithm: "RDFC-1.0", maxWorkFactor: 1, signal: AbortSignal.timeout(1000) })` `:197-221`; `lexical-sort-v1`: `NQuads.serialize` of the label-sorted quads `:223-229` | `crypto.subtle.digest("SHA-256")` over the canonical text `:58-84`, not `effect/crypto/Digest` |
| semantica lab | `apps/labs/semantica/src/canary/RuntimeProbeChild.ts:103`, `src/layers/CanaryC2Live.ts:293` | `serializedQuads`: lexically sorted `serializeQuad` strings (`RdfProjectionLive.ts:111-121`) | `contentDigest(S.Array(S.String))` over that list (canonical JSON) |

The one production fingerprint consumer is the ontology slice CAS: `packages/ontology/use-cases/src/tools/OntologyToolService.ts:98-110` (`algorithm: "rdfc-1.0"`, advertised as `casAlgorithm: "rdfc-1.0"`, `casSemantics: "semantic"` `:444-445`).

Dependency direction. `@beep/rdf-canonize` depends on `@beep/rdf` and `@beep/semantic-web` (`packages/drivers/rdf-canonize/package.json` dependencies), and drivers own third-party engines (`standards/ARCHITECTURE.md:61`). `@beep/rdf` therefore cannot call the existing RDFC-1.0 implementation without either a new contract that the driver implements or a direct `rdf-canonize` dependency in a foundation package (I1, I2).

Upstream facts (`rdf-canonize@5.0.0`, `bun.lock:9257`, `node_modules/rdf-canonize`):

- `canonize` requires `algorithm`; `URDNA2015` is accepted as an alias of `RDFC-1.0` unless `rejectURDNA2015` (`lib/index.js:126-143`). Defaults `maxWorkFactor = 1`, `maxDeepIterations = -1` (`lib/RDFC10.js:17-27,103-108`).
- The Node build hashes with `require('crypto').createHash` (`lib/MessageDigest.js:6,29`); the `browser` and `react-native` maps swap in `MessageDigest-webcrypto.js` (`package.json:82-89`). The hash is internal to the algorithm, not injectable through Effect's `Digest`.
- Output is the sorted, joined N-Quads lines (`lib/RDFC10.js:190-193`). The N-Quads writer prints `@lang` only when the datatype is `rdf:langString` and omits the datatype only for `xsd:string` (`lib/NQuads.js:256-262`); the parser sets `rdf:langString` for a tagged literal and `xsd:string` for a plain one (`lib/NQuads.js:156-163`).
- Measured by probe at this commit (`bun -e` over `canonize`, read-only): `[q, q]` canonicalizes to two identical lines (duplicates are not removed); a literal `{ value: "x", datatype: xsd:string, language: "en" }` canonicalizes to `"x"`, the same bytes as the untagged literal. With today's `Literal`, a tagged `xsd:string` and a plain string therefore collide in every `rdfc-1.0` fingerprint, and a list with a duplicated quad fingerprints differently from the same set.

Other RDF libraries in `bun.lock`: `n3@2.13.12` (`:9003`, direct via `@beep/n3`), `oxigraph@0.5.13` (`:9095`), `shacl-engine@1.1.3` (`:9425`), `@rdfjs/dataset@2.0.3` (root catalog `package.json:108`), `@rdfjs/types@2.0.1` (`:7231`), and `rdf-isomorphic@2.0.1` (`:9261`) only as a transitive of `sparqlalgebrajs` and `@traqula/algebra-transformations-1-1` (`:9479`, `:7463`), not a workspace dependency. `n3`'s literal accessor maps `"abc"@en--ltr` to `rdf:dirLangString` (`node_modules/n3/src/N3DataFactory.js:147-148`), an RDF 1.2 case the three-case `Literal` does not have (I6).

Effect v4 facts used (checked in `$HOME/YeeBois/references/effect/effect/packages/effect/src`): `Equal` is structural by default for plain objects (`Equal.ts:117-121`, opt-out `byReference` `:503`), so a `HashSet` of decoded `Quad` values dedupes structurally; `Schema.HashSet(value)` encodes to `HashSet<Encoded>`, and only its JSON codec link turns it into an array in iteration order (`Schema.ts:16120-16127,16162-16190`), so the encoded JSON of a set-valued `Dataset` has no canonical order; `effect/crypto/Digest` has `sha256` (`crypto/Digest.ts:85`), the `Digest` service (`:135-143`) and `layerWebCrypto` (`:159`). `@beep/schema/CanonicalHashSet` (`packages/foundation/modeling/schema/src/CanonicalHashSet.ts:64`) requires `Encoded: string` items (decision `2026-11-19-p1-canonical-set-in-schema-identity-sorted-arrays`), so it cannot hold a struct-encoded `Quad` directly (I3).

## 3. Gold fixtures that must be regenerated, and their readers

`apps/labs/semantica/fixtures/gold/v1/g-projection.json` (968 bytes) is the fixture SPEC.md:450-452 and the rebuild report (`research/2026-11-08-rebuild-report.md:294`) name. Its content is `schemaVersion: "g-projection/v1"`, an embedding model identity, one kNN witness and two SPARQL `SELECT ?claim` counts (577 and 22). It carries no dataset digest and no quad text. Schema: `GProjectionExpectation` (`apps/labs/semantica/src/schema/Projection.ts:78-90`, tag `:80`). Readers: `apps/labs/semantica/test/ProjectionExpectation.test.ts:22` (asserts the counts `[577, 22]`), `test/Projection.test.ts:90,150,218` (gold directory and an inline v1 value), `test/Canary.test.ts:49`. The decision `2026-11-22-p3-semantica-reads-the-handoff` (SPEC.md:1898,1904) deferred it to P5.

What actually depends on the old `Dataset` and `Literal` in semantica: `RdfProjectionLive.rebuild` (`src/layers/RdfProjectionLive.ts:108-122`) returns `serializedQuads` and `serializedTriples` built from `sortDatasetQuads` and `serializeQuad`; the C1 rebuild-identity witness diffs those strings (`src/layers/CanaryC1Live.ts:214,338-355`), and C2 and the runtime probe digest them (`CanaryC2Live.ts:293`, `RuntimeProbeChild.ts:103`). Its literals are all plain `xsd:string` (`RdfProjectionLive.ts:62`), so the three-case `Literal` does not change those bytes; a `serializeQuad` redefinition or a switch to `DatasetDigest` does. The SPARQL counts go through Oxigraph, which already has set semantics, so the set quotient cannot change them unless the projection emits blank nodes (it emits none). Regeneration is therefore a schema-version step (add a canonical `DatasetDigest` to the expectation) rather than a recount (I4).

Other gold files: `g-entailment-rdfs.json` and `.n3` (read by `test/Reasoning.test.ts:104-129`) hold `serializeTerm` strings of IRIs only (0 lines matching `^^` or `@lang`), so a literal or dataset change leaves them byte-identical; `gold.json` and the per-paper `*.entity|relation|structure.json` files are annotation gold, not RDF.

## 4. `Literal` today and the cases needed

Today `Literal` is `{ termType: "Literal", value, language: Option<LanguageTag>, datatype: NamedNode }` (`Rdf.ts:414-428`; census `:484-500`, stale). Nothing forbids a language on a non-`rdf:langString` datatype or `rdf:langString` without a language. `makeLiteral(value, datatype, { language })` (`Rdf.ts:981-986`, internal `:949-959`) is the constructor everyone uses; the JSDoc example itself builds a tagged `xsd:string` (`Rdf.ts:968`). `LanguageTag` is `Rdf.ts:272`; `serializeTerm` lowercases the tag (`:1172`), the canonical driver does not.

Live counts: `makeLiteral(` 97 lines / 38 files (census: 87 / 36 at the P0 base). Direct `Literal.make({ termType` 2 / 2: `rdf/src/ProvRdf.ts:170` (always `language: O.none()`) and one test.

Sites that build a tagged `xsd:string` (become `LangTagged`): `rdf/test/Rdf.test.ts:223,292,293,326`; `rdf/test/ProvRdf.test.ts:336,443`; `packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts:135`; JSDoc `rdf/src/Rdf.ts:968`. Already correct (`rdf:langString` plus tag): `packages/tooling/tool/cli/test/knowledge-coverage-examples.test.ts:33-34`. `rdf:langString` is a registry term (`packages/foundation/modeling/identity/src/internal/generated/Registry.data.ts:458`).

Pass-through decoders that forward a parsed language with whatever datatype the engine reported (each becomes a three-way match on datatype and language): `packages/drivers/n3/src/N3.service.ts:211-213`, `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:147-149`, `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:151-153`, `packages/drivers/shacl/src/Shacl.validation.ts:217`. Encoders that read `language` back out: `canonicalization.ts:109-119` (`toCanonizeObject`), `N3.service.ts:261-263`, `Oxigraph.sparql.ts:103-108`.

Readers that branch on the datatype and the absent language today and need the case match instead: `rdf/src/ProvRdf.ts:654-677,696,721` (refuse a tagged `prov:value`, timestamp or label). The fold's `FactLiteral` (`Fold.models.ts:411`) is a fourth literal shape, with an untyped number and boolean case the three-case `Literal` has no direct image for: the mapping `number -> Typed xsd:integer | xsd:decimal | xsd:double` must be chosen, not inherited from Turtle's lexical rules (I5).

The cases: `Simple` (datatype `xsd:string`, no tag), `Typed` (any other datatype, never `xsd:string` or `rdf:langString`), `LangTagged` (datatype `rdf:langString`, tag required). These match exactly what the canonicalizer's N-Quads writer can tell apart (`lib/NQuads.js:256-262`), which closes the collision measured in section 2.

## 5. The `rdf -> md` edge

Exit check: `rg -l "@beep/md" packages/foundation/modeling/rdf/src packages/foundation/modeling/rdf/package.json` returns `rdf/src/Adapters/MdSections.ts` and `rdf/package.json` today. Every edge:

| Edge | Site |
| --- | --- |
| dependency | `rdf/package.json:73` (`"@beep/md": "workspace:^"`) |
| source import | `rdf/src/Adapters/MdSections.ts:8,14` (`Block`, `Heading`, `HeadingLevel`, `Document` from `@beep/md/Md.model`) |
| barrel | `rdf/src/index.ts:19` (`export * from "./Adapters/MdSections.ts"`) |
| test | `rdf/test/DocumentAnnotation.test.ts` imports `@beep/md/Md.model` and `@beep/rdf/Adapters/MdSections` |
| project references | `rdf/tsconfig.json:15`, `rdf/tsconfig.test.json:21`, `rdf/tsconfig.check.json:9` (`../md/tsconfig.json`) |

`MdSections.ts` (280 lines) has no consumer outside rdf (`rg foldMdSections|MdSections` outside `modeling/rdf/` is empty). Its only rdf content is the string `DOCO_NAMESPACE` (`MdSections.ts:13,111,137,242`), which `rdf/src/Vocab/Doco.ts` re-exports from the generated term module, itself read from `RegistryVocab` (decision `2026-11-20-p1-namespace-pins-live-tree-calls`, point 1). `@beep/md` already depends on `@beep/identity` (`packages/foundation/modeling/md/package.json:83`) and does not depend on `@beep/rdf`, so the fold can move into `@beep/md` reading `namespace("doco").iri` (`packages/foundation/modeling/identity/src/Registry.ts:526-529`) with no new edge. The test must move with it: a `@beep/md` devDependency left in rdf would keep `package.json` in the exit grep. After the move the annotation package's accepted transitive `@beep/md` edge through rdf (SPEC.md:1754) disappears. The coverage baseline rows (`standards/coverage.regression-baseline.jsonc`) for `rdf/src/Adapters/MdSections.ts` move by the S31 "rows move with the file" ruling (decision `2026-11-19-p1-s31-rows-move-with-the-file`).

## 6. `prov:Entity` projection and the L6-2 lens

What exists. `rdf/src/Prov.ts` is the PROV-O value model: `Entity` (`Prov.ts:298-328`: optional `id: ObjectRef`, the six relation arrays, `generatedAtTime`, `invalidatedAtTime`, one scalar `value`), `ObjectRef` (`:96`, an IRI, CURIE or local id), `ProvBundle { records, lifecycle }` (`:1089`). `rdf/src/ProvRdf.ts` is the codec pair `provBundleToDataset` (`:569`, impl `:519-536`) and `datasetToProvBundle` (`:1003`). Its round trip is tested with `areDatasetsEquivalent` (`rdf/test/ProvRdf.test.ts:160-264`, `:543` property). Two properties matter for L6-2: subjects of records without an `id` are minted from the record's array index (`ProvRdf.ts:162-176`), so the projection is deterministic but not invariant under record permutation; and `lifecycle` is refused rather than projected (`ProvRdf.ts:535`), which is an omitted field declared as a refusal.

What the projection needs. `SourceTextIdentity` (`packages/foundation/modeling/text/src/SourceTextIdentity.ts:185-212`) has seven fields: `scopeRef`, `sourceRef`, `locator`, `sourceDigest`, `textDigest`, `extractor { name, version }` (`:127-139`), `normalizationVersion`. `CaptureId` (`text/src/Capture.ts:46`, minted by `mintCaptureId` `:184` over `CapturePreimage` `:140`) hashes all eight values under `capture/v1`, and the P2 decision records that "P5's `prov:Entity` projection of `SourceTextIdentity` uses this id or amends this decision" (SPEC.md:1539). `@beep/rdf` already depends on `@beep/text` (`rdf/package.json:76`). The instance-IRI printer for a content hash (`https://beep-effect.com/ns/instance/sha256-<hex>`) lives in `packages/foundation/modeling/annotation/src/rdf/OaCodec.ts:650-672` (`instanceIri` `:681`); annotation depends on rdf, so rdf cannot import it, and a second printer would duplicate it (I7).

`Prov.Entity` has no field for any of the seven `SourceTextIdentity` fields except through `id` and the single `value`. So through `Prov.ts` alone the kept part is `{ captureId }` and every other field is omitted; keeping the digests, extractor or locator needs either new `Entity` fields with registered predicates or a projection that writes quads beside the `Entity` record (I8). `scopeRef` is a matter or tenant reference; whether it is kept in an interchange projection is a policy choice the map cannot make (I9).

Lens shape for L6-2 (`rdf/test/Projection.laws.test.ts`, title `L6-2 projection is deterministic and kept fields satisfy GetPut and PutGet`, `research/law-test-plan.md:37`). The report states it as: every projection is deterministic given a Skolem scheme, declares kept and omitted fields, and the kept ones satisfy GetPut and PutGet compared on the dataset quotient (`research/2026-11-08-rebuild-report.md:296`; critic `research/2026-11-08-critic-1-theory.md:154`). In terms of the live tree: `get: Dataset -> Result<Kept, Refusal>` is the decoder restricted to the profile, `put: (Dataset, Kept) -> Dataset` replaces the profile's quads and keeps the residual, GetPut is `put(d, get(d)) ≡ d` up to isomorphism for `d` in the profile, and PutGet is `get(put(d, k)) = k`. Candidates in the tree, with the projection each gives the law:

| Projection | Owner | Today | Kept / omitted |
| --- | --- | --- | --- |
| `SourceTextIdentity -> prov:Entity` | `@beep/rdf` (`Prov.ts`, `ProvRdf.ts`) | absent | to be declared (I8, I9) |
| `ProvBundle <-> Dataset` | `@beep/rdf` `ProvRdf.ts` | round-trip tests, no kept/omitted declaration | `lifecycle` refused; record order not kept |
| OA `encode`/`decode`/`normalize` | `@beep/annotation/rdf/OaCodec` | `OaCodec.laws.test.ts` (L2-6) | residual and rejected are explicit outputs |
| `fold -> Dataset` | `@beep/ontology` | absent | one-way; warnings omitted |

The test file sits in rdf, so only rdf-owned projections can be instances there unless the law is exported as a reusable harness that the annotation and ontology tests instantiate (I10).

## 7. `NamespacePin` and every namespace the registry speaks

Live surface: `rdf/src/NamespacePin.ts` declares `PinnedSource { location: IRI, revision: SpecificationRevision }`, `NamespacePin { prefix, namespace: NamespaceIri, source, license: SpdxExpression.FromString, attribution, version, digest, termsDigest }` and `NamespacePins = S.Array(NamespacePin)` with a strictly-ascending-by-prefix check; `namespacePins()` decodes `rdf/src/Vocab/generated/NamespacePins.data.ts`, generated (with `namespace-pins.data.json`) by the `pinned-vocabularies` sync target `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/PinnedVocabularies.ts` (rows `:187-458`, fetch and byte digest `:498-521`, outputs `:40-44`).

The registry has 38 namespace shards (`packages/foundation/modeling/identity/registry/namespaces/*.json`). Nineteen are external (IRI not under `IdentityAuthority`, `https://beep-effect.com/ns/`, `identity/src/Authority.ts:38`):

| Prefix | IRI | Pinned now | Generated term module in rdf |
| --- | --- | --- | --- |
| `as` | `http://www.w3.org/ns/activitystreams#` | yes | no (registry only) |
| `cito` | `http://purl.org/spar/cito/` | yes | `Cito.terms.ts` |
| `dcat` | `http://www.w3.org/ns/dcat#` | no | `Dcat.terms.ts` |
| `dcterms` | `http://purl.org/dc/terms/` | no | `Dcterms.terms.ts` |
| `deo` | `http://purl.org/spar/deo/` | yes | `Deo.terms.ts` |
| `doco` | `http://purl.org/spar/doco/` | yes | `Doco.terms.ts` |
| `fabio` | `http://purl.org/spar/fabio/` | yes | `Fabio.terms.ts` |
| `gufo` | `http://purl.org/nemo/gufo#` | yes | no (registry only) |
| `nif` | `http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#` | yes | no (registry only) |
| `oa` | `http://www.w3.org/ns/oa#` | yes | `Oa.terms.ts` |
| `owl` | `http://www.w3.org/2002/07/owl#` | no | `Owl.terms.ts` |
| `prov` | `http://www.w3.org/ns/prov#` | yes | `Prov.terms.ts` |
| `rdf` | `http://www.w3.org/1999/02/22-rdf-syntax-ns#` | no | `Rdf.terms.ts` |
| `rdfs` | `http://www.w3.org/2000/01/rdf-schema#` | no | `Rdfs.terms.ts` |
| `schema` | `https://schema.org/` | no | `SchemaOrg.terms.ts` |
| `sh` | `http://www.w3.org/ns/shacl#` | no | `Shacl.terms.ts` |
| `skos` | `http://www.w3.org/2004/02/skos/core#` | yes | `Skos.terms.ts` |
| `void` | `http://rdfs.org/ns/void#` | no | `Void.terms.ts` |
| `xsd` | `http://www.w3.org/2001/XMLSchema#` | yes | `Xsd.terms.ts` |

The other 19 are internal (`annotation`, `beepQA`, `contracts`, `document`, `documents-taxonomy`, `epistemic`, `identity-rdf`, `instance`, `lejeune`, `office-action`, `operation`, `practice-kg`, `qa`, `research-library`, `schemas`, `semantica`, `semantic-foundation`, `skill-contract`, `vitest`).

The current test (`rdf/test/NamespacePin.test.ts`) hard-codes the eleven pinned prefixes (`:47-59`) and the eight P5 exceptions (`:20`, `unpinnedUntilP5 = ["dcat", "dcterms", "owl", "rdf", "rdfs", "schema", "sh", "void"]`), and asserts the exceptions are exactly the unpinned externals (`:68-76`). The P5 exit (PLAN.md:29, SPEC.md:454-456) needs eight new rows acquired by the sync target (location, revision, SPDX license, attribution, version, byte digest recorded at acquisition, never invented: decision `2026-11-19-p1-pin-scope-eight-namespaces`) and the test rewritten so the external set equals the pinned set with a license and a `sha256:` digest on each. Any namespace P5 adds must be pinned in the same commit: the L3 sketch uses `semapv:` CURIEs for SSSOM mapping justifications (`ops/design/L3.taxonomy.ts:51-55`) and SSSOM itself has `sssom:` terms; neither is a registry namespace today (I11). The nanopub namespace is held on an unresolved license (decision `2026-11-23-p4-nanopub-restricted-profile`; no `np` shard exists and `packages/foundation/modeling/epistemics/src/rdf` does not exist at this commit), so it does not enter the P5 pin set.

## 8. The OA and annotation adapters that touch `Dataset`

`rdf/src/Adapters/WebAnnotation.ts` (P2, `TextAnchor <-> oa:` target, `:537`, `:581`) and `rdf/src/Adapters/DocumentAnnotation.ts` are JSON-shaped and do not build a `Dataset`. The `Dataset` adapter is `@beep/annotation/rdf/OaCodec` (`packages/foundation/modeling/annotation/src/rdf/OaCodec.ts`, 1,641 lines, P3):

- `toDataset` (`:729-739`) dedupes by `serializeQuad` through `effect/HashMap`, then `sortDatasetQuads`: the hand-made set quotient restricted to ground datasets that SPEC.md:1804 records "until P5 lands the Dataset quotient".
- `indexOf` (`:965-971`) dedupes the input the same way; the decoder's residual is a `serializeQuad` set difference (`:1494-1546`).
- Literals: `integerLiteral`, `stringLiteral`, `xsd:dateTime` (`:715-724`), all untagged.
- The import activity's `sourceDigest` is the SHA-256 of the parsed RDF document bytes, and "P5 may switch the input to the canonical dataset digest by a decision, which re-mints import activity ids" (SPEC.md:1794); the reversal of `2026-11-22-p3-oa-instance-iris-and-ground-datasets` is "prove L2-6 on the P5 quotient" (SPEC.md:1808) (I12).
- Tests: `annotation/test/rdf/OaCodec.laws.test.ts` compares through a local `quadSet` (`:83`) and `areDatasetsEquivalent` (`:627`), asserts ground output (`:572`) and `normalized.quads` emptiness (`:886`).

Other P2 and P3 `Dataset` builders on the same pattern: `packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts` (3 `.quads` reads); `apps/labs/semantica/src/layers/RdfProjectionLive.ts:111-121`.

## 9. The L6 sketch against the live tree, surface by surface

| Surface | Sketch (`ops/design/L6.interchange.ts`) | Live tree | Gap |
| --- | --- | --- | --- |
| `PinnedSource` | `location: IRI`, `revision: S.NonEmptyString` | `revision: SpecificationRevision` (`NamespacePin.ts`, decision `p1-pin-scope-eight-namespaces`, D8 kept) | live supersedes the sketch |
| `NamespacePin` | `source`, `license`, `version`, `digest` | adds `prefix`, `namespace: NamespaceIri`, `attribution`, `termsDigest` | live supersedes |
| `NamespacePins` | `S.HashMap(SafePnPrefix, NamespacePin)` | `S.Array(NamespacePin)` strictly ascending by prefix | live supersedes (sorted array, one entry per prefix) |
| `Literal` | `S.Union([SimpleLiteral, TypedLiteral, LangTaggedLiteral])` over `S.TaggedStruct` with `_tag`, `S.toTaggedUnion("_tag")`; no `termType` | one struct with `termType: "Literal"`, member of `Term`/`ObjectTerm` unions discriminated by `termType` (`Rdf.ts:414,518,605`) | the sketch's `ObjectTerm` (`S.Union([Rdf.NamedNode, Rdf.BlankNode, Literal])`) mixes a `termType` member family with a `_tag` family and is not `toTaggedUnion`-able on either key; every `Term.match`/`ObjectTerm.match` site (`serializeTerm` `:1166`, `canonicalization.ts:109`, drivers) needs one discriminator (I13) |
| `TypedLiteral` check | `S.makeFilter` refusing `xsd:string` and `rdf:langString` via `HashSet.has` | none | new |
| `LangTaggedLiteral` | `language: Rdf.LanguageTag` | `LanguageTag` exists (`Rdf.ts:272`); case is not normalized on decode | case policy (I6) |
| `Quad` | sketch redeclares with its own `ObjectTerm` | `Rdf.ts:694` | replaced in place |
| `Dataset` | `quads: S.HashSet(Quad)`, equality "is the isomorphism quotient" | `quads: S.Array(Quad)`, `Rdf.ts:728` | a `HashSet` gives set equality on labelled quads only; isomorphism needs canonical relabelling, so `Equal` on `Dataset` is not the quotient unless the value is stored canonically labelled or `Equal` is overridden (I1, I3) |
| `DatasetDigest` | `ContentHash.pipe(S.brand("DatasetDigest"))` (prefixed `sha256:`) | `DatasetFingerprint.fingerprint: Sha256Hex` (unprefixed) in semantic-web | two digest encodings for one concept (I2) |
| `canonicalDigest` | `(Dataset) => Effect<DatasetDigest, JsoncCanonicalizeError, Digest.Digest>` | RDFC-1.0 lives in the driver; hashes through WebCrypto and `node:crypto` | the error type names canonical JSON, but the canonical form of a dataset is RDFC-1.0 N-Quads, whose failures are the work-factor and timeout errors `canonicalization.ts:46-56,183-195` maps (I2) |
| `isIsomorphic` | dual `(self, that) => boolean` (pure) | `areDatasetsEquivalent`, pure, label-sensitive | a pure isomorphism check needs a pure canonicalizer (I1) |
| prov:Entity projection, lens | absent from the sketch | absent | P5 designs it (I8-I10) |
| `fold -> Dataset` | absent from the sketch (L3 sketch owns the fold) | string projections only | see section 1 |
| `rdf -> md` | absent | present | section 5 |

## 10. L6 exit mapping (measured state)

| PLAN.md:29 / SPEC.md:447-457 item | Today | Work |
| --- | --- | --- |
| `L6-1` green, `rdf/test/Dataset.laws.test.ts` | file absent; law row `planned` (`law-test-plan.md:36`) | `Dataset` set, isomorphism, canonical digest; property test with blank-node relabelling and duplication generators |
| `L6-2` green, `rdf/test/Projection.laws.test.ts` | file absent (`law-test-plan.md:37`) | lens declaration plus instances (section 6) |
| `rg -l "@beep/md" rdf/src rdf/package.json` empty | 2 files | section 5 |
| `prov:Entity` round-trip test green | absent | section 6 |
| `NamespacePin` test asserts license and digest on every external namespace | 11 of 19 pinned; 8 listed as exceptions (`NamespacePin.test.ts:20`) | 8 acquisitions; test rewrite (section 7) |
| `fold -> Dataset` the only serialization path | 3 RDF string serializers (`toTurtle`, `toJsonLd`, `toContext`) plus `toMarkdown` | section 1, I14 |
| `Dataset` quotient, canonical digest, semantica gold regenerated | list, label-sensitive equality, three ad-hoc digests | sections 2-3 |
| `Literal` three cases | one struct | section 4 |
| office-action standing list stays green | not measured here | (P5 design) |

Coverage: every new src file needs 100 percent (repo law; `standards/coverage.regression-baseline.jsonc` rows for `rdf/src/Rdf.ts` are below 100 today per SPEC.md:1258 and may not be lowered).

## Open questions

I1. Where is RDFC-1.0 for `@beep/rdf`? Options measured: (a) a `Context.Service` contract in rdf (the existing `CanonicalizationService` moved down from `@beep/semantic-web`) implemented by `@beep/rdf-canonize`, so `canonicalDigest` and `isIsomorphic` are effectful and need a layer; (b) `rdf-canonize` as a direct dependency of a foundation package, against the drivers rule (`standards/ARCHITECTURE.md:61`); (c) a repo-owned pure RDFC-1.0 in rdf. The sketch's pure `isIsomorphic` presumes (c). L6-1's test in `rdf/test` needs the implementation as a devDependency under (a), and `@beep/rdf-canonize` depends on `@beep/rdf`, so the test edge closes a workspace cycle.

I2. One dataset digest encoding: the sketch's `DatasetDigest` (prefixed `ContentHash`, `sha256:`) or semantic-web's `DatasetFingerprint` (`Sha256Hex`)? The ontology slice CAS advertises `rdfc-1.0` (`OntologyToolService.ts:444`); which one does it carry after P5, and does `lexical-sort-v1` survive as an algorithm once the digest is on the canonical form? Also the error channel: the canonicalizer's work-limit and timeout failures, not `JsoncCanonicalizeError`.

I3. What is `Dataset`'s decoded carrier and its encoded form? `S.HashSet(Quad)` gives set equality but not isomorphism and an unordered JSON encoding (`Schema.ts:16120-16127`); `CanonicalHashSet` needs string items. Is the encoded form the canonical N-Quads text (a string, so `CanonicalHashSet` of quad lines or one canonical document), and is `Equal` on `Dataset` the quotient (custom `Equal`/`Hash` on canonical labels) or label equality with `isIsomorphic` as a separate function?

I4. What does "regenerate `g-projection.json`" mean when the fixture holds no quads or digest? Proposed by the measurement: bump to `g-projection/v2` adding the canonical `DatasetDigest` of the G-subset projection, keep the counts, and replace `serializedQuads`/`serializedTriples` digests in `CanaryC2Live.ts:293` and `RuntimeProbeChild.ts:103` with `DatasetDigest`. Is the v1 file deleted (no stored rows, SPEC.md:598 amendment) or kept as a frozen old version?

I5. How does the fold map `FactLiteral` to the three cases: untyped number to `xsd:integer` only when `Number.isInteger` and to `xsd:double` (or `xsd:decimal`) otherwise; boolean to `xsd:boolean`; a language with a datatype other than `rdf:langString` refused at assembly (a new `OntologyAssemblyErrorReason`) or the datatype dropped as `toTurtle` does today (`Fold.projections.ts:481`)? And is the silent drop of an invalid language tag (`Fold.assembly.ts:323`) a refusal now?

I6. Language tags and direction: lowercase on decode (so `"x"@EN` and `"x"@en` are one literal, as `serializeTerm` already assumes at `Rdf.ts:1172`) or keep case and compare case-insensitively? And `rdf:dirLangString` from `n3@2.13.12` (`N3DataFactory.js:147-148`): refused by the n3 decoder, or a fourth case?

I7. Where does the content-hash instance-IRI printer live so rdf can project `CaptureId` as the `prov:Entity` subject: move `instanceIri` (`OaCodec.ts:650-681`) down to `@beep/identity` or `@beep/rdf`, with annotation importing it?

I8. Kept and omitted fields of the `SourceTextIdentity -> prov:Entity` projection: only `captureId` through `Prov.Entity.id`, or also digests, extractor and locator? The latter needs registered predicates (which namespace: `prov:`, `nif:`, or an internal one) and an `Entity` extension or extra quads beside the record.

I9. Is `scopeRef` (matter or tenant scope) ever written to an interchange dataset, or always an omitted field of the lens?

I10. Which projections instantiate L6-2 and where: only rdf-owned ones (`SourceTextIdentity -> prov:Entity`, `ProvBundle <-> Dataset`) in `rdf/test/Projection.laws.test.ts`, or a lens-law harness exported from rdf that `@beep/annotation` (OA) and `@beep/ontology` (fold) tests also run? `ProvRdf`'s index-minted subjects (`ProvRdf.ts:162-167`) make it deterministic but not permutation-invariant; does L6-2 require Skolem subjects derived from content instead?

I11. Do SSSOM `MappingSet` RDF exports enter P5 (then `sssom:` and `semapv:` become registry namespaces with pins in the same commit), or is the mapping set TSV/JSON only in P5?

I12. Does P5 switch the OA import activity's `sourceDigest` to the canonical dataset digest (re-minting import activity ids, SPEC.md:1794) and re-prove L2-6 on the quotient (SPEC.md:1808), or leave both as is?

I13. One discriminator for terms: keep `termType` on every term and add an inner literal tag (for example `termType: "Literal"` plus `kind: "Simple" | "Typed" | "LangTagged"`), or move every term family to `_tag`? The choice decides how many of the `Term.match` sites and the RDF/JS-shaped driver adapters change.

I14. "`fold -> Dataset` is the only serialization path": are `toJsonLd` and `toContext` deleted (Turtle and JSON-LD produced from the `Dataset` by `@beep/n3` at the cli), and does `toMarkdown`, which is documentation and not RDF, stay as a projection of `AssembledOntology`? The cli test pins `toTurtle` byte stability (`research-library-ontology.test.ts:345`), and Turtle text order and prefix choice change under N3 (census row, `consumer-census.md:245`).

I15. `serializeQuad` keeps its non-N-Quads form (`default` graph token, re-encoded blank labels, datatype dropped on tagged literals) as a set key in 17 files: is it retired in favour of `Equal` on `Quad` and canonical N-Quads, or redefined to the N-Quads line of the three-case literal?
