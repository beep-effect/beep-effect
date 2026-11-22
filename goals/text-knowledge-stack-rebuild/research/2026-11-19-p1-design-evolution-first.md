# P1 design: L0 identity, evolution first (2026-11-19)

> **Status.** Not chosen. The P1 base is the registry-first design
> (`2026-11-19-p1-design-registry-first.md`), taken with grafts from this design and its
> sibling; its "Rulings applied" section and the `2026-11-19-p1-*` decision files say
> which parts of this text were adopted. This file is kept as the record of the angle.

Design for phase P1 ("L0 identity: declared terms, one digest"). Measured at worktree
head `c8e55ae87b5` with `effect@4.1.4`; the three P1 maps
(`2026-11-19-p1-map-identity-derivation.md`, `2026-11-19-p1-map-registries-and-namespaces.md`,
`2026-11-19-p1-map-iri-move.md`) are the fact base, cited as *derivation map*, *registry
map* and *IRI-move map*. New measurements made for this design are marked **(measured)**
with their method.

**Angle.** Over the next five years the repository will rename modules, move and delete
packages, deprecate terms and re-publish vocabularies. Each of those must be one recorded,
reviewable step with a mechanical check, and an agent must not be able to change a
published term by accident. This design gets there by:

1. Removing every API that derives an IRI.
2. Declaring every published IRI in one directory of `@beep/identity`.
3. Treating the published set as an append-only ledger that a gate compares against the
   base branch.

Where a choice traded convenience against that property, it took the property.

## 0. Summary of the decisions

1. **Code ids are never published.** `$I` composers keep building code ids
   (`@beep/<pkg>/<module>/<Name>`) and lose `.iri`, `.curie`, `.rebase`, the authority and
   prefix binding, `IriFromIdentity` and `CurieFromIdentity`. The type checker therefore
   enumerates every site that read a derived IRI. The codemod is the compiler.
2. **Terms are declared** in `packages/foundation/modeling/identity/src/terms/`. A schema
   annotation carries `iri` and `curie` only when its code id has a `TermBinding` row. An
   unbound schema has no IRI. This affects about 21,400 identifiers (derivation map §5).
3. **Re-published, concretely:**
   - 113 IRIs whose value embeds a module path below the package are re-minted to
     path-free terms, each with a genesis tombstone that names its replacement.
   - Every other IRI that leaves the process keeps its value and becomes a declared term or
     a declared instance namespace. This covers practice KG, stored SHACL reports, XMP,
     predicate types and seeds.
   - No stored row changes.
4. **One registry value** over 37 namespaces replaces `CoreVocab`, `SemanticFoundationVocab`,
   `SparVocab`/`SparTerms`, the hand-written rdf constants and the rdf `Curie` schema. It
   has 19 external namespaces, 6 beep vocabularies and 12 beep instance namespaces.
5. **The term-stability snapshot** is a generated, line-per-row JSON ledger at
   `packages/foundation/modeling/identity/data/term-snapshot.json`.
   `bun run beep lint identity-registry` compares it with the base branch, so a published
   term leaves only through a `Deprecation` row and a major changeset. A frozen genesis
   copy gives a git-free floor test.
6. **Canonical JSON** keeps its one owner, `@beep/jsonc`.
   - `@beep/schema` gains the `ContentHash` and `DomainTag` brands.
   - `@beep/jsonc` gains `mintContentHash` and `definePreimage`, which binds a domain tag
     to its preimage schema and a committed golden vector. A changed preimage without a tag
     bump fails a test.
   - The whole E1 alias chain retires.
7. Four PRs, at most three open at once. Breaking changes ship with major changesets for
   `@beep/identity`, `@beep/rdf`, `@beep/ontology`, `@beep/semantic-web`,
   `@beep/test-runner`, `@beep/epistemics` and `@beep/epistemic-domain`.

## 1. Facts this design rests on

| Fact | Value | Source |
| --- | --- | --- |
| Annotation IRIs minted today | 21,434 distinct; about 90% embed a file path | derivation map §5 |
| `create("<literal>")` chains | 3,303 in 3,153 files; 2,704 mirror the file path | derivation map §5 |
| Where an IRI leaves the process | the exits in derivation map §6; the research library T-Box is the only persisted output that embeds a file path | derivation map §6-7 |
| Composer `.iri`/`.curie` reads outside identity | 51 lines in 25 files on `$<X>Id(.create(..))*` chains, plus 5 `$I.iri` lines in 2 files (`Library.ontology.ts:287,340,378`; `public-site/test/PublicSite.test.ts:153,156`); 0 in `scratchpad/` | **(measured)** `git grep -nP '\$[A-Za-z0-9]+Id(\.create\([^)]*\))*\.(iri\|curie)\b'` and `'\$[A-Za-z0-9_]*\.(iri\|curie)\b'`, JSDoc lines dropped. Reads through composer-valued variables are not counted: `PracticeKg.projections.ts:285`, `Classification.models.ts:398,423`, `Fold.assembly.ts:436,847,909` |
| Research-library ontology | 16 classes; 87 distinct owned property IRIs (134 owned property slots); 2 borrowed (`dcterms:created`, `dcterms:title`); 1 ontology IRI; owned properties are namespace-level (`.../Library.schemas/id`), not class-scoped | **(measured)** `bun -e` running `assembleLibraryOntology()` (`cli/src/commands/Research/Library/Library.ontology.ts:111-117`) |
| Test-runner pinned IRIs | 7 (`Vitest.errors.ts:23,55,65,121,131,141,151`) | derivation map §6 |
| semantic-web identity predicates | 2 (`semantic-web/src/identity/IdentityRdfBinding.ts:27-28`) | **(measured)** |
| XMP tags in the `qa/1.0/` namespace | 8 (`drivers/exiftool/src/ExiftoolConfig.ts:109-118`) | **(measured)** |
| Curated external term lists today | 256 terms: dcat 45, rdf 17, rdfs 15, skos 32, owl 25, dcterms 98, schema 13, doco 6, deo 2, fabio 1, cito 2 | registry map §1.1, §1.3 |
| SHACL locals emitted by `src` | at least 18 (`NodeShape`, `property`, `path`, `datatype`, `class`, `minCount`, `maxCount`, `hasValue`, `in`, `xone`, `targetClass`, `targetNode`, `Info`, `Warning`, plus 4 `*ConstraintComponent`). Shell `sh("bash")` noise is excluded | **(measured)** `git grep -ohP 'sh\("\K[A-Za-z]+(?="\))'` and the `shacl#` and `SHACL_NAMESPACE}` forms over `*/src/*.ts` |
| Package versions | `@beep/identity` 0.1.1; `@beep/jsonc`, `@beep/rdf`, `@beep/test-runner` 0.0.0. `@beep/repo-cli`, `@beep/repo-utils` and `@beep/scratchpad` are changeset-ignored | **(measured)** each `package.json`; `.changeset/config.json:13` |
| `effect/Arbitrary` exports | `schema`, `Constant`, `array(item, { minLength, maxLength })`, `map`, `filter`, `filterMap`, `flatMap`, `all` | **(measured)** `node_modules/effect/src/Arbitrary.ts:90-93,423,446,497,511,650,718,794` |

## 2. Identity regimes (the glossary entry P1 writes)

The current chapter (`standards/architecture/16-knowledge-stack.md:398`) states two regimes
joined by minting. P1 states four precisely, three of them published:

| Regime | What it identifies | Form | Who assigns | Stability rule | May leave the process |
| --- | --- | --- | --- | --- | --- |
| **Code identity** | a schema, key, check, error or service in source | `@beep/<pkg>/<module>/<Name>` from an `$I` composer | the source path, by convention | none: changes on any rename | as a JSON Schema `$defs` or OpenAPI name only, never as an IRI |
| **Term** | a kind: class, property or vocabulary term | `Namespace.iri` + `local`, CURIE `prefix:local` | declared in `@beep/identity/terms`; bound to a code identity through `TermBinding` | the snapshot ledger: leaves only through `Deprecation`; a tombstone is never reused | yes |
| **Named instance** | an individual under a repository namespace: practice KG node, claim subject, concept, predicate-type version | instance-namespace IRI + caller key | namespace declared in the registry; key supplied by the owner | the namespace IRI is immutable; keys are the owner's data | yes |
| **Content hash** | a minted record (occurrence, annotation, generation, activity, claim) | `sha256:` + 64 hex over `[domainTag, ...preimage]` in RFC 8785 form | `@beep/jsonc` minting, one brand per domain | a changed preimage bumps its tag; stored rows convert on read | yes |

P1 also edits these glossary entries:

- **Identity Authority** (`standards/architecture/GLOSSARY.md:419`). Its current text says
  "Code derives IRIs from identity composers". It is rewritten to say that registry
  declarations are the only place the authority is spelled, and that composers derive code
  identities, not IRIs.
- **Term** (`:907-915`). It gains the tombstone rule.
- **Term Binding** and **Identity Regime** are added.

## 3. Schemas and where each lives

### 3.1 Dependency lines (unchanged by P1)

- `@beep/identity` imports `effect` only. It never imports `@beep/utils`, `@beep/schema`,
  `@beep/jsonc` or `@beep/rdf`, not even as a dev dependency, because each of them depends
  on `@beep/identity`.
- `@beep/schema` and `@beep/jsonc` sit above identity.
- `@beep/rdf` gains a dependency on `@beep/spdx`. `@beep/spdx` depends on identity and
  effect only (registry map §5), so this adds no cycle.

Correction to decision `2026-11-19-p0-l0-split-by-dependency`. It says "the registry test
cross-checks both against the @beep/schema schemas as a test dependency". An
identity→schema dev edge closes a workspace cycle, as the IRI-move map §4 shows for
`@beep/utils`. So the cross-check moves to
`packages/foundation/modeling/schema/test/IdentityRegistryPrimitives.test.ts`, which
imports identity legally. It asserts two things:

- every `ReleaseVersion` in the registry decodes as `@beep/schema/SemanticVersion`;
- every identity `S.Literals` domain equals a `LiteralKit` literal set.

This needs a decision file (§12, D6).

### 3.2 `@beep/identity`

New and changed modules. All schemas use `S.Opaque` with `$I` annotations from
`$IdentityId` in `./packages.ts`. Literal domains use `S.Literals` under the
bottom-package exception.

| Module | Contents | Notes |
| --- | --- | --- |
| `src/Iri.ts` | `IRI`, `IRIReference`, `RelativeIRIReference`, `AbsoluteIRI` | moved by `git mv` from `rdf/src/Iri.ts`, exactly as the IRI-move map §10 plans |
| `src/Authority.ts` | `IdentityAuthority` | moved out of `Id.ts:77` so that term declarations can import it without importing `Id.ts`. The 1 external importer (derivation map §4) is re-pointed |
| `src/terms/declare.ts` | `vocabulary(...)`, `instances(...)`, `bind(...)`, `deprecate(...)` | pure builders with const type parameters; no imports except types. They return plain data with literal-typed IRIs |
| `src/terms/External.ts` | the 19 external namespaces with curated local lists | `dcat`, `rdf`, `rdfs`, `owl`, `dcterms`, `schema`, `skos`, `doco`, `deo`, `fabio`, `cito` (carried over), `prov`, `oa`, `nif`, `xsd`, `gufo`, `as`, `sh`, `void` (new). The lists are generated into `src/internal/generated/ExternalTerms.ts` by the pinned target (§3.5) |
| `src/terms/Beep.ts` | 6 beep vocabularies and 12 beep instance namespaces (§4.3) | hand-written; the one place a beep IRI is spelled |
| `src/terms/Bindings.ts` | `TermBinding` rows | hand-written; one row per bound code identity |
| `src/terms/Deprecations.ts` | `Deprecation` rows, including the 113 genesis tombstones | append-only |
| `src/internal/BindingIndex.ts` | `HashMap<code, { iri, curie }>` over the binding rows | the only terms module `Id.ts` imports. It is import-free apart from `terms/*` and `effect/HashMap`, so `Id.ts` and `packages.ts` still never import `Iri.ts` (the binding rule of IRI-move map §4) |
| `src/Registry.ts` | `TermIri`, `CodeId`, `ReleaseVersion`, `Namespace`, `Term`, `NamespaceEntry`, `TermBinding`, `Deprecation`, `TermRegistry`, `RegistryViolation`, `makeRegistry`, `Registry` | `Registry` is the decoded repository registry. It is built at module load with `S.decodeUnknownSync`, so an invalid declaration fails every importer immediately |
| `src/Curie.ts` | `Curie` (branded `prefix:local`), `expand`, `contract`, `expandOption`, `contractOption`, `prefixOf` | rebuilt over `TermRegistry`. This is the one registry codec, and it replaces `Vocab.ts` `Curie<V>`, `CurieFromIri`, `makeCurieCodec`, `CoreCurieCodec`, the rdf `Curie` (`rdf/src/Rdf.ts:301`) and ontology `registryPrefix` (`ontology/src/internal/Fold.ts:7-19`) |
| `src/Instances.ts` | `mintNamed(ns, path)`, `mintEncoded(ns, key)` | `mintNamed` applies the composer's `validateSegment` rules to `path` (shared internal function), so practice-KG and predicate-type IRIs stay byte-identical. `mintEncoded` is `ns.iri + encodeURIComponent(key)`, matching `ClaimGate.service.ts:41` |
| `src/Snapshot.ts` | `TermSnapshot`, `snapshotOf`, `SnapshotViolation`, `checkSnapshotEvolution`, `unexplainedRemovals` | pure; used by the L0-3 test and the lint |
| `src/IdentityRegistry.ts` | adapted, not retired | `IdentityEntry` becomes `{ code: CodeId, term: TermIri, curie: Curie, fibers }` built by `IdentityEntry.fromBinding`. `IdentityRef` encodings become `code`, `term` and `curie`. It gains a production `IdentityRegistry.layer` over `Registry.bindings` and keeps `layerLocal` |
| `src/Vocab.ts` | deleted | `CoreVocab`, `SemanticFoundationVocab`, `SparVocab`, `mergeVocab`, `VocabShape`, `VocabEntry`, `VocabRegistry`, `Curie<V>`, `Predicate<V>` and `Expand<C,V>` retire into `Registry` and `Curie.ts`. Their consumers are in derivation map §4: ontology `Fold.*`, cli `SyncDataToTs/targets/{VocabTerms,SparTerms}.ts` and rdf `test/VocabDrift.test.ts` |

Schema sketch. Field shapes follow the ruled design module (`ops/design/L0.identity.ts`)
with three P1 additions:

- `NamespaceEntry` distinguishes a closed vocabulary from an open instance base.
- A vocabulary keeps the locals of its deprecated terms (`retired`), so data written before
  a deprecation still expands and contracts.
- Every collection is a strictly ascending array, not an `S.HashSet`. `S.HashSet` encodes
  in iteration order (design facts §7), and identity cannot import `CanonicalHashSet` from
  `@beep/schema`.

```ts
// identity/src/Registry.ts (sketch; validated against effect@4.1.4 Schema)
export const TermIri = IRI.pipe(S.brand("TermIri"), $I.annoteSchema("TermIri", { description: "A declared, published term IRI." }));
export const CodeId = S.String.check(S.isPattern(/^@beep\/[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9._-]+)+$/, ...)).pipe(S.brand("CodeId"), ...);
export const ReleaseVersion = S.String.check(S.isPattern(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/, ...)).pipe(S.brand("ReleaseVersion"), ...);

export class Namespace extends S.Opaque<Namespace, ...>()(S.Struct({ prefix: SafePnPrefix, iri: IRI }).pipe(...)) {}
export class Term extends S.Opaque<Term, ...>()(S.Struct({ iri: TermIri, namespace: SafePnPrefix, local: SafePnLocal }).pipe(...)) {}

export const NamespaceEntry = S.TaggedUnion({
  Vocabulary: { namespace: Namespace, locals: SortedUnique(SafePnLocal), retired: SortedUnique(SafePnLocal) },
  Instances: { namespace: Namespace },
}).pipe($I.annoteSchema("NamespaceEntry", { description: "A closed vocabulary or an open instance base." }));

export class TermBinding extends S.Opaque<TermBinding, ...>()(S.Struct({ code: CodeId, term: TermIri, since: ReleaseVersion }).pipe(...)) {}
export class Deprecation extends S.Opaque<Deprecation, ...>()(S.Struct({
  term: TermIri, since: ReleaseVersion, replacement: S.OptionFromOptionalKey(TermIri),
}).pipe(...)) {}

export class TermRegistry extends S.Opaque<TermRegistry, ...>()(S.Struct({
  namespaces: SortedUniqueBy(NamespaceEntry, (e) => e.namespace.prefix),
  bindings: SortedUniqueBy(TermBinding, (b) => b.code),
  deprecations: SortedUniqueBy(Deprecation, (d) => d.term),
}).pipe(...)) {}

export const RegistryViolation = S.TaggedUnion({
  DuplicatePrefix: { prefix: SafePnPrefix },
  DuplicateNamespaceIri: { iri: IRI },
  NamespaceIriNotTerminal: { prefix: SafePnPrefix },          // must end in "/" or "#"
  OwnershipPrefixMismatch: { prefix: SafePnPrefix },          // beep IRI <=> "beep-" prefix
  DuplicateLocal: { prefix: SafePnPrefix, local: SafePnLocal },
  BindingToUnknownTerm: { code: CodeId, term: TermIri },
  BindingToDeprecatedTerm: { code: CodeId, term: TermIri },
  TermBoundTwice: { term: TermIri },
  ActiveAndDeprecated: { term: TermIri },
  DanglingReplacement: { term: TermIri, replacement: TermIri },
}).pipe(...);

export const makeRegistry: (input: TermRegistry.Encoded) => Result.Result<TermRegistry, NonEmptyReadonlyArray<RegistryViolation>>;
```

`SortedUnique(...)` and `SortedUniqueBy(...)` are identity-local checks: strictly ascending
by the key string in UTF-16 code-unit order. That is the order RFC 8785 uses, so the
decoder refuses an unsorted or duplicated file instead of normalizing it.

The `Term` invariant behind unique contraction: a term IRI is `namespace.iri + local`, and
a `SafePnLocal` contains no `/` or `#`. A term's namespace is therefore the IRI up to its
last `/` or `#`. Nested namespace IRIs, such as `epistemic/` and `epistemic/claim/`, then
need no prefix-free rule. Contraction is unique whenever namespace IRIs are distinct, which
`DuplicateNamespaceIri` enforces.

### 3.3 `@beep/schema`

These are moved from `ops/design/L0.digest.ts`, following the owner split in that file's
header.

| Module | Contents |
| --- | --- |
| `src/ContentHash.ts` | `ContentHash` (brand over `Sha256PrefixedDigest`, `Sha256.ts:132`), `DomainTag` (`<domain>/v<n>`), `ActivityId` (brand over `ContentHash`) |
| `src/CanonicalHashSet.ts` | `CanonicalHashSet(item)` (decoded `HashSet`, encoded as a sorted deduplicated array), `sortedMembers` |
| `src/WellFormedText.ts` | `WellFormedText` (no lone surrogate) |
| `src/Instant.ts` | `Instant` (`S.DateTimeUtcFromMillis`) |

None of these names exists in `@beep/schema` or `@beep/identity` today **(measured)**:
`git grep -nP '^export (const|class|type) (Instant|WellFormedText|ContentHash|DomainTag|CanonicalHashSet|ActivityId)\b'`
finds only slice-local symbols in law-practice, party, shared/domain and repo-utils.

### 3.4 `@beep/jsonc`

| Module | Contents |
| --- | --- |
| `src/ContentHash.ts` | `mintContentHash` (`Effect.fn("ContentHash.mint")`, hashes the RFC 8785 bytes of `[tag, ...preimage]` through `JsoncFingerprint.hash` and the `Digest` service) and `mintContentHashResult(digest)` (the sync twin over `hashResult`), as in `ops/design/L0.digest.ts:127-144` |
| `src/Preimage.ts` | `definePreimage({ tag, schema, project })` returns `{ tag, mint, mintResult }`. Here `project` maps a decoded value to the preimage array, and set-valued fields go through their `CanonicalHashSet` encoding. The module also has `PreimageGolden` (`{ tag, input, digest }`) and the test helper `assertGoldens(preimage, goldens)` |
| `src/ActivityId.ts` | `ActivityPin`, `ActivityStartFields`, `ActivityStart`, `activityPreimage`, `ActivityDomainTag = "activity/v1"`, `mintActivityId` (from `L0.digest.ts:146-198`). It lands in PR 4, because `ActivityStart.operation` is a `TermIri` |
| `src/JsoncFingerprint.ts` | gains `canonicalizeSchemaResult: (value) => Result<string, S.SchemaError>`, the `SchemaError`-channel twin the retired copies' consumers need (`GrantSet.model.ts:344-348`, `Retention.behavior.ts:29`; registry map §8 question 8). It is the only new export on the owner |

`definePreimage` is the evolution device for content hashes. A domain tag and its preimage
schema are declared together, and each declaration ships a committed golden vector, so the
three can only change together:

- `jsonc/test/fixtures/preimage-goldens.json` holds the goldens of jsonc-owned tags (P1:
  `activity/v1` and the L0-2 fixture tag).
- Every later layer adds `test/fixtures/preimage-goldens.json` beside its own
  `definePreimage` calls.

If someone edits a preimage schema or projection and keeps the tag, the golden fails. The
fix is a new tag with a new golden. Where rows are stored, the old tag gets a declared
read-time transform under the stored-format law.

### 3.5 `@beep/rdf`

| Module | Contents |
| --- | --- |
| `src/NamespacePin.ts` | `PinnedSource { location: IRI, revision }`. `revision` reuses the six `@beep/schema/Conformance` revision kinds (`Conformance.source.schema.ts:139-348`; registry map §8 question 3), not a free string. `NamespacePin { prefix, source, license: SpdxExpression, version, digest: Sha256PrefixedDigest, termsDigest: ContentHash }`. Pins are keyed by prefix |
| `src/Vocab/generated/namespace-pins.data.json` | 19 pin rows, written by the target below |
| `src/Vocab/generated/*.terms.ts` | NamedNode term tables, regenerated as projections of `Registry`. The hand-written `Prov.ts`, `Oa.ts` and `Xsd.ts` constants become generated `Prov.terms.ts`, `Oa.terms.ts` and `Xsd.terms.ts`, and `Shacl.terms.ts` and `Void.terms.ts` are added. The `PROV_*`, `OA_*` and `XSD_*` export names are kept, so their 80 outside lines (registry map §1.5) need no edit |
| `src/Rdf.ts` | `Curie` (`:301`) and `CurieChecks` (`:148`) are deleted. `PrefixMap` (`:860`) gains `PrefixMap.fromRegistry(prefixes)` |

`termsDigest` is the content hash, domain tag `namespace-terms/v1`, of
`[prefix, namespaceIri, sortedLocals]` taken from identity's registry. It ties identity's
curated list to rdf's pin mechanically. Editing a list without re-pinning fails
`rdf/test/NamespacePin.test.ts`.

The pins are acquired by a new `sync-data-to-ts` target, `pinned-vocabularies`, in
`packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/PinnedVocabularies.ts`. It
generalizes `SparTerms.ts:22-136` and replaces `VocabTerms.ts`, whose `sourceUrls: []` at
`:149` pins nothing. The target:

- fetches each source at an immutable revision;
- checks the byte sha256;
- runs a per-format declaration check (Turtle, RDF/XML or OWL, JSON-LD context, or a
  specification document);
- checks the license notice in the artifact;
- writes the curated identity term lists, the rdf term tables and the pin data in one
  run.

Source bytes are never committed (the vendor-manifest practice, registry map §4).

Decisions taken where the registry map left questions open:

| Question (registry map §8) | Ruling |
| --- | --- |
| 1, pin scope | Every external namespace in the registry gets a pin in P1 (19), because the rdf test asserts it for every non-beep namespace |
| 2, SHACL and VoID | Registered (`sh`, `void`), since the repo speaks them in 11 and 3 files |
| 4, license id | An SPDX expression read from the artifact's own notice. A W3C artifact takes `W3C-20150513` when its notice is that license (`@beep/spdx` `internal/licenseIds.ts:635-637`), otherwise `LicenseRef-W3C-<notice-date>`. The target refuses a mismatch |
| 9, `as:` form | `http://www.w3.org/ns/activitystreams#`, the mapping in the OA JSON-LD context. The target asserts that the pinned `anno.jsonld` maps `as` to exactly this IRI, so the choice is checked, not assumed |
| 10, xsd | Pins the XML Schema 1.1 Part 2 REC 2012-04-05 document as a `datedSnapshot`. The semantic digest rests on the 6 curated locals |
| 11, PROV | Pins `https://www.w3.org/ns/prov.ttl`, which the vendor manifest already digests (`explorations/legal-ontology-landscape/assets/manifest.jsonl:15`). The fetch must reproduce `d7ea634d…1097` |
| 12, dead trustgraph script | Not P1. It gets a separate small PR opened the same hour (fix-where-found law) that deletes `goals/trustgraph-doc-ontology/scripts/build-artifacts.ts` |

The new curated lists, using the minimum each consumer needs (registry map §5):

| Prefix | Locals |
| --- | --- |
| `prov` | 34 (the 33 `Prov.ts` locals plus `specializationOf`) |
| `oa` | 16 |
| `nif` | 8 (`Context`, `isString` and the 6 in the map) |
| `xsd` | 6 |
| `gufo` | 14 |
| `as` | 1 (`generator`) |
| `sh` | 18 |
| `void` | 2 (`Dataset`, `triples`) |

That is 99 new external terms, 355 external terms in all.

## 4. Declared IRIs for code identities

### 4.1 The binding mechanism

`identityAnnotation` (`Id.ts:1810-1827`) builds `{ schemaId, identifier, title }` as today.
It then looks the identifier up in `BindingIndex`:

- **Bound:** the record also carries `iri` (the term) and `curie` (its registry
  contraction).
- **Unbound:** the record has no `iri` or `curie`.

The record shape that `identity/test/shape-stable.test.ts:428-467` pins (`schemaId`,
`identifier`, `iri`, `curie`, `title`) holds for bound kinds. The test is rewritten to pin
both cases, with the reason recorded in decision D2.

Why a table keyed by code id rather than a term named at each call site:

- **No call-site sweep.** About 21,400 annotation calls stay as they are. Only the bound
  kinds (23 in P1) get a row. The SPEC's own wording ("code id to term IRI through the
  binding table"; "a module rename edits `code`, never `term`") describes exactly this
  table.
- **A rename is a visible step.** Renaming a module changes its code id, so the binding no
  longer matches. Three checks fire: the fold refuses the unbound class, the lint reports
  `binding-dangling`, and the snapshot diff shows the `code` column edit that repairs it.
  A term written at the call site would survive a rename silently. That costs nothing
  today, but it also lets a copied annotation bind a second schema to the same term
  unnoticed. Here `TermBoundTwice` is a registry violation.
- **Dependencies stay clean.** `Id.ts` needs only an import-free data index. No Effect,
  Layer or service is required at module load, which derivation map §9.2 requires.

The fold stops reading `iri` annotations. It resolves each schema's `identifier` through an
explicit `TermRegistry` argument, so fixtures in `ontology/test/Fold.test.ts` pass test
registries built with `makeRegistry`.

```ts
// ontology/src/Fold.assembly.ts, replacing fold(composer: BoundComposer, input) at :893
export const fold = Effect.fn("Ontology.fold")(function* (input: {
  readonly registry: TermRegistry;
  readonly vocabulary: SafePnPrefix;   // the Vocabulary entry this fold owns
  readonly label: string;
  readonly schemas: ReadonlyArray<SchemaHandle>;
  readonly triples: ReadonlyArray<FoldTriple>;
}) { ... });
```

The assembly errors gain:

- `UnboundClass{ identifier }`;
- `ForeignClass{ identifier, term }` (the term is outside `vocabulary`);
- `UndeclaredProperty{ field }` (an owned field with no local in `vocabulary`);
- `UnusedTerm{ local }` (a declared local that no class or field produced).

The last two make a field rename fail the research-library test until the vocabulary is
edited, and the edit that removes the old local needs a `Deprecation`. A fold vocabulary
is owned by exactly one fold.

### 4.2 Which IRIs are terms, and the re-publication rule

An IRI is **published** when it leaves the process (derivation map §6). The rule P1
applies to each published IRI family:

- **Retain the value** when a stored row, recorded media or a committed artifact carries
  it (the stored-format law), or when its value contains no module or file segment below
  the package. A retained value becomes a declared term, or a declared instance namespace,
  with the same bytes.
- **Re-mint the value** when it embeds a module or file path below the package. Such a
  value invites the next reader to "fix" it after a rename. A re-minted IRI gets a genesis
  `Deprecation` (term = old IRI, `since` 0.1.1, `replacement` = new term). That records it
  as a tombstone that can never be re-declared, and it gives holders of old RDF a
  machine-readable migration map.
- **Drop without record** the IRI annotations of unbound schemas. About 21,400 identifiers
  lose them. They never left the process: the only production reader of `iri` annotations
  is the fold (`Fold.assembly.ts:136`), whose one production caller is the research
  library.

### 4.3 What changes, family by family

| Family (exit site) | Before | After | Change | Stored or committed carrier |
| --- | --- | --- | --- | --- |
| Research-library T-Box and SHACL (`Library.ontology.ts:34,112,287,340,378`; `Library.projection.ts:28`) | `https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas` and 16 class plus 87 property IRIs under it | vocabulary `beep-library` = `https://beep-effect.com/ns/research-library/`; classes `Source` … `Manifest` and properties `id` … keep their locals; the ontology IRI is the namespace IRI; Turtle prefix `beep-library:` | **re-minted**, 104 IRIs, 104 tombstones; 16 bindings | Turtle files written outside the repo (`Library.paths.ts:39,53`); regenerated on the next `beep research library` run |
| Test-runner pins (`test-runner/src/Vitest.errors.ts:23-151`) | `https://beep-effect.com/ns/test-utils/Vitest/{PositiveTimeoutMillis, TestContextUnavailable, TestContextUnavailable.method, TestHang, TestHang.lastLogLine, TestHang.testName, TestHang.timeoutMillis}` | vocabulary `beep-testing` = `https://beep-effect.com/ns/testing/` with the same 7 locals; code ids corrected to `@beep/test-runner/Vitest/<Name>`; 7 bindings | **re-minted**, 7 tombstones | none |
| semantic-web identity predicates (`IdentityRdfBinding.ts:27-28`) | `https://beep-effect.com/ns/semantic-web/identity/{identifier,curie}` | vocabulary `beep-identity` = `https://beep-effect.com/ns/identity/`, terms `code`, `curie` | **re-minted**, 2 tombstones | none (round trip in tests) |
| ClaimGate SHACL (`ClaimGate.service.ts:39-41`) | `.../ns/epistemic/Claim`, `.../hasEvidenceQuote`, subjects `.../ns/epistemic/claim/<encoded key>` | vocabulary `beep-epistemic` = `.../ns/epistemic/` (`Claim`, `hasEvidenceQuote`); instances `beep-claim` = `.../ns/epistemic/claim/` through `mintEncoded` | retained, byte-identical | stored SHACL reports with claim dispositions |
| XMP (`ExiftoolConfig.ts:60,109-118`) | `.../ns/qa/1.0/` and 8 tag names | vocabulary `beep-qa-xmp` = `.../ns/qa/1.0/` with the 8 tags; `BeepQaTagName` becomes `LiteralKit` over the registry locals; the XMP serialization prefix stays `beepQA` | retained; the tags become declared terms | recorded media |
| Practice KG (`PracticeKg.projections.ts:79,285`) | `.../ns/practice-kg/<kind>/<key>` | instances `beep-practice-kg`; `mintNamed(PracticeKg, \`${kind}/${key}\`)` | retained, byte-identical | DuckDB `kg_node.iri`, `kg_edge` keys |
| Predicate types and contracts (`skill-contract/src/{Recovery.ts:340, EvidenceReceipt.ts:385, GateCertificate.ts:335}`; `cli/src/commands/Qa/JudgeContract.ts:770,772,842,845,942`; `CitedArtifactExistsGate.ts:31`) | `.../ns/skill-contract/evidence/<name>/v<n>`, `.../ns/qa/receipts/<name>/v2`, `.../ns/qa/evidence/...`, `.../ns/qa/verifiers/...`, `.../ns/contracts/qa-inventory/v1`, `.../ns/schemas/qa-judge-*/v1` | instances `beep-skill-evidence`, `beep-qa-receipt`, `beep-qa-evidence`, `beep-qa-verifier`, `beep-contract`, `beep-schema-ref`; `mintNamed` with today's paths | retained, byte-identical | receipts; `cli/skills/qa-inventory-judge/SKILL.md:2,5` |
| Document annotations (`rdf/src/Adapters/DocumentAnnotation.ts:20-21`) | `.../ns/document/{pattern,citation}` | vocabulary `beep-document` | retained | JSON-LD output |
| Ontology seeds and classification editions (`Vocabulary.seed.ts:10,291,377`, `SemanticFoundation.seed.ts:12-15`, `Classification.models.ts:379,398,423`) | `.../ns/ontology/semantic-foundation/...` (230 seed concept and scheme IRIs) | instances `beep-semantic-foundation`; `mintNamed` | retained; the 4 `beep:` terms of `SemanticFoundationVocab` (`Vocab.ts:548-558`) become instance keys, and the `beep` CURIE prefix retires (0 consumers outside identity, registry map §1.2) | seed `.ttl`/`.jsonld` files (move to the asset pack in P5) |
| TaxonomyLoader prefix check (`TaxonomyLoader.ts:132-139`) | `$BeepId.iri` | `IdentityAuthority` | same string | |
| Documents taxonomy (`Taxonomy.seed.ts:14-15`) | `.../ns/documents/taxonomy/legal-document` | instances `beep-documents-taxonomy` | retained | seed |
| Lab projections (`apps/labs/semantica/src/layers/RdfProjectionLive.ts:26`; `apps/labs/lejeune-bolt-workbench/src/runtime/Projections.ts:31`) | `.../ns/semantica/`, `.../ns/lejeune/ontology/` | instances `beep-semantica`, `beep-lejeune` | retained | gold fixture `semantica/fixtures/gold/v1/g-projection.json:21,26` stays unchanged, which proves it |
| Ontology fold test pins (`ontology/test/Fold.test.ts:295,744`; `identity/test/IriBinding.test.ts`) | `.../ns/patent/Ontology.models/HttpUrl`, `.../ns/ontology/Ontology.models/OWLClass` | test registries; `IriBinding.test.ts` is replaced by `Registry.test.ts` and `TermStability.test.ts` | test fixtures, not published | none |
| JSON Schema `$defs` and OpenAPI names | code identity | unchanged | none (not IRIs; §11) | `docgen/schema.json` |

Registry totals after P1:

- **37 namespaces:** 19 external, 6 beep vocabularies (`beep-library`, `beep-testing`,
  `beep-identity`, `beep-epistemic`, `beep-document`, `beep-qa-xmp`) and 12 beep instance
  bases.
- **479 active terms:** 355 external and 124 beep (103 + 7 + 2 + 2 + 2 + 8).
- **23 bindings.**
- **113 deprecations.**

The rule "a beep-owned namespace has a `beep-` prefix, and an external one does not"
(`OwnershipPrefixMismatch`) keeps a future external prefix from colliding with a
repository one.

### 4.4 Breaking-change consequences and changesets

| Package | Bump | Why |
| --- | --- | --- |
| `@beep/identity` | major | composer members and type parameters removed (`.iri`, `.curie`, `.rebase`, `.vocabRegistry`, `make(base, binding)`); annotation record drops `iri`/`curie` for unbound kinds; `Vocab.ts` deleted; `IdentityEntry` reshaped; `IdentityAuthority` moved module; new `Iri`, `Registry`, `Curie` codec, `Instances`, `Snapshot` |
| `@beep/rdf` | major | IRI schemas and the `@beep/rdf/Iri` subpath removed (IRI-move map §6); `Curie` removed; `NamespacePin` added |
| `@beep/ontology` | major | `fold` signature; `BoundComposer` and `Curie<CoreVocab>` types gone; new assembly errors |
| `@beep/semantic-web` | major | identity predicates re-minted; entries built from bindings |
| `@beep/test-runner` | major | annotation `identifier`, `schemaId`, `iri` and `curie` values changed |
| `@beep/epistemics`, `@beep/epistemic-domain` | major | public `canonicalDetectionJson`/`Result` aliases removed (§5.3) |
| `@beep/schema`, `@beep/jsonc` | minor | new modules and exports |
| `@beep/exiftool`, `@beep/skill-contract`, `@beep/epistemic-use-cases`, `@beep/law-practice-server`, `@beep/documents-domain` (also drops `@beep/rdf`), `@beep/ontology-client`, `@beep/execution-authority-domain` | patch | internal re-point; published values byte-identical |
| `@beep/repo-cli`, `@beep/scratchpad` | none | changeset-ignored (`.changeset/config.json:13`) |

The retained values are proved by tests that already exist and stay unchanged:

- `law-practice/server/test/PracticeKg.projections.test.ts:1144-1197,1413`;
- `exiftool/test/Exiftool.models.test.ts:268-271` (its literal-type assertion is kept,
  because registry constants keep literal types);
- the epistemic tables and pglite SHACL report tests;
- the semantica gold fixture.

## 5. The composer API change and the codemod

### 5.1 Before and after

| Surface | Today | After P1 |
| --- | --- | --- |
| `make(base, { authority, prefix, vocab })` (`Id.ts:2173`) | binds an authority, prefix and vocabulary | `make(base)`; root `$I = Identity.make("beep").$BeepId` (`packages.ts:47`) |
| `IdentityComposer<Value, Authority, Prefix, Vocab>` | 4 type parameters | `IdentityComposer<Value>`. The 203 `IdentityComposer<"@beep/...">` annotations in `packages.ts` and the 4 external type uses (derivation map §4) compile unchanged |
| `.iri`, `.curie`, `IriFromIdentity`, `CurieFromIdentity`, `toIri`, `toCurie`, `localPathFromIdentity` (`Id.ts:376,405,1680-1696`) | path-derived IRI and CURIE | deleted |
| `.rebase({ iri, prefix })` (`Id.ts:2058-2068`) | republish under another authority | deleted. Re-publication is a registry edit (§7) |
| `.vocabRegistry` | vocabulary attached to a composer | deleted. The registry is `@beep/identity/Registry` |
| `identityAnnotation` (`Id.ts:1810-1827`) | `iri`/`curie` from the composer | `iri`/`curie` from `BindingIndex` when bound |
| `$EpistemicId`, `$QaId`, `$SemanticFoundationId`, `$BeepId` | IRI bases | code-id composers only. Their IRI uses move to registry constants (§4.3) |

### 5.2 Codemod

The codemod is driven by the compiler. Deleting the members makes `tsgo` list every
reader: the 56 measured direct reads (§1), the composer-valued variable reads listed there,
and any not found by grep. Each site moves to a registry constant by this table:

| Read | Replacement |
| --- | --- |
| `$EpistemicId.create("Claim").iri` | `Epistemic.Claim.iri` |
| `` `${$EpistemicId.create("claim").iri}/` `` | `Claims.iri` |
| `` `${$QaId.create("1.0").iri}/` `` | `QaXmp.iri` (literal type kept) |
| `$SkillContractId.create("evidence/failure/v2").iri` | `mintNamed(SkillEvidence, "failure/v2")` |
| `$QaId.create(\`receipts/${n}/v2\`).iri` | `mintNamed(QaReceipt, \`${n}/v2\`)` |
| `graphIdentity.create(k).create(key).iri` | `mintNamed(PracticeKg, \`${k}/${key}\`)` |
| `$BeepId.iri` | `IdentityAuthority` |
| `fold($I, input)` | `fold({ registry: Registry, vocabulary: "beep-library", ...input })` |
| `` `${$I.iri}/${key}` `` (`Library.ontology.ts:287,340`) | `Registry` term lookup in `beep-library` |
| `IdentityEntry.fromComposer(c, fibers)` | `IdentityEntry.fromBinding(binding, fibers)` |

`mintNamed` returns a `Result`. Each call site maps the failure into the error channel it
already uses for `create`'s refusal.

The rewrite is done by hand: about 70 sites, each a one-line rewrite. A script would add
nothing over the compiler's list.

Completeness is verified by three checks:

- `bunx tsgo` over the workspace;
- `git grep -nP '\.(iri|curie)\b'` on `$`-named composers returns nothing;
- the `public-origin-literal` law keeps exempting only the identity and public-site owners
  (`cli/src/commands/Laws/RetiredIriAuthorities.model.ts:247-261`). The allowlist entry for
  `test-runner/src/Vitest.errors.ts` moves by rename to the generated pin file (§6.4), so
  the inventory count is unchanged.

Generators that print `create("<path>")` (`codegen-kit/src/internal/postProcess.ts:625,733`,
`ModelFirstTemplates.ts:233,282,360,645`) mint code ids only and need no change.
`create-package` is unchanged.

`delete-package` (`DeletePackage.command.ts:41,355`) gains a refusal. It will not delete a
package while any `TermBinding.code` starts with `@beep/<slug>/`, and its message lists the
terms to deprecate or rebind. Today that command drops IRIs silently (derivation map §2).

### 5.3 Canonical JSON copies

P1 retires the whole E1 alias chain, not only the two copies the census names. Every link
is a re-export of the owner, and the SPEC criterion is one implementation:

- `packages/epistemic/domain/src/values/internal/CanonicalJson.ts`;
- `packages/execution-authority/domain/src/internal/CanonicalJson.ts`;
- the public alias at `epistemic/domain/src/values/ContradictionDetection/ContradictionDetection.behavior.ts:7-10,32`;
- the epistemics aliases `canonicalDetectionJson` and `canonicalDetectionJsonResult`
  (`epistemics/src/ContradictionDetection/ContradictionDetection.behavior.ts:42,67`);
- the wrapper `epistemics/src/internal/CanonicalJson.ts:36-52`.

Every consumer listed in registry map §6.2 imports `JsoncFingerprint.canonicalize`,
`canonicalizeResult` or the new `canonicalizeSchemaResult`. The bytes do not change, and
three tests prove it: `cli/test/canonical-digest-owner-differential.test.ts` (its alias rows
re-pointed to the owner), `canonical-digest-owner-replay.test.ts` and the seal goldens
`execution-authority/domain/test/ExecutionAuthority.test.ts:533`.

The three pinned encoders (E5 PartyKey v1, E6 eyecite parity, the `LogicalEdgeIdentity`
key) are listed in the jsonc README. An in-source note is added at
`LogicalEdgeIdentity.model.ts:269`, the one encoder without a `biome-ignore` anchor.

## 6. Snapshot file, location and gate

### 6.1 Location and format

- **Path:** `packages/foundation/modeling/identity/data/term-snapshot.json`. Placing data
  under a package follows the precedent of `md/data/conformance/sources.json`. Identity
  tests import it with `import snapshot from "../data/term-snapshot.json" with { type: "json" }`
  (precedent: `drivers/github-actions/test/reachability.test.ts:23`).
- **Content:** the encoded `TermSnapshot`, a pure projection `snapshotOf(Registry)`:

  ```json
  {
    "version": "term-snapshot/v1",
    "namespaces": [
      {"iri":"http://purl.org/dc/terms/","kind":"vocabulary","prefix":"dcterms"},
      {"iri":"https://beep-effect.com/ns/research-library/","kind":"vocabulary","prefix":"beep-library"}
    ],
    "terms": [
      {"iri":"https://beep-effect.com/ns/research-library/Source","local":"Source","namespace":"beep-library"}
    ],
    "bindings": [
      {"code":"@beep/repo-cli/commands/Research/Library/Library.schemas/Source","since":"0.1.1","term":"https://beep-effect.com/ns/research-library/Source"}
    ],
    "deprecations": [
      {"replacement":"https://beep-effect.com/ns/research-library/Source","since":"0.1.1","term":"https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas/Source"}
    ]
  }
  ```

- **Layout:** each row is its own RFC 8785 canonical form, written by
  `JsoncFingerprint.canonicalize`, on its own line. Rows are strictly ascending by key:
  namespaces by prefix, terms by IRI, bindings by code, deprecations by term. The identity
  decoder refuses unsorted input.

This layout serves review over the long run:

- A rename is a one-line diff.
- A deprecation is a two-line diff: one term line removed, one deprecation line added.
- Two lanes that add different terms touch different lines, so they rarely conflict.

At P1 the snapshot has 37 namespace rows, 479 term rows, 23 binding rows and 113
deprecation rows.

`since` is the `@beep/identity` version in `package.json` on the PR's base commit (0.1.1
at genesis). It reads "first released after this version". The lint sets the value, so an
agent cannot backdate a row.

### 6.2 The evolution check (pure, in identity)

`checkSnapshotEvolution(previous, next): ReadonlyArray<SnapshotViolation>`:

| Violation | Condition |
| --- | --- |
| `UnexplainedRemoval{ term }` | active in `previous`, not active in `next`, and no `next` deprecation names it (this is `unexplainedRemovals`, `ops/design/L0.identity.ts:120-130`) |
| `DeprecationDropped{ term }` | a `previous` deprecation is absent from `next` (deprecations are append-only) |
| `TombstoneRevived{ term }` | a term deprecated in `previous` is active in `next` |
| `NamespaceIriChanged{ prefix, previous, next }` | a prefix maps to a different IRI |
| `NamespaceDropped{ prefix }` | a namespace disappears. Namespaces are permanent; retire their terms instead |
| `NamespaceKindChanged{ prefix }` | vocabulary ↔ instances |
| `SinceRewritten{ key }` | a row in both snapshots changed `since` |

### 6.3 The gate: `bun run beep lint identity-registry`

The lint keeps its current checks (`cli/src/commands/Lint/IdentityRegistry.ts:70-77`) and
adds the violation kinds below. The base snapshot is read with `git show <base>:<path>`,
where `--base` defaults to `git merge-base HEAD origin/main` and to `HEAD^1` on a push to
`main`. That follows the precedent of `cli/src/commands/Lint/internal/EffectSchemaInventorySource.ts`.
A base with no snapshot file (the genesis commit) runs every check except the evolution
check.

| Kind | What it checks | `--fix` |
| --- | --- | --- |
| `term-snapshot-stale` | the committed file ≠ `snapshotOf(Registry)` | rewrites the file |
| `term-evolution` | `checkSnapshotEvolution(base, head)` is non-empty (one finding per violation) | none |
| `since-not-current` | a new row's `since` ≠ the identity version on base | stamps it |
| `binding-dangling` | a binding's code id resolves to no annotation call (static scan below) | none |
| `binding-ambiguous` | a code id is minted in more than one file. Today 44 module identities are shared on purpose (derivation map §5); a bound kind must be unique | none |
| `binding-reassigned` | a term's binding moved from code X to code Y while X still resolves in head. A rename removes X; a reassignment changes meaning | none |
| `changeset-missing` | the snapshot's published part changed with no `.changeset/*.md` naming `@beep/identity`: `minor` for additions, `major` for any deprecation | none |
| `generated-pins-stale` | `test-runner/src/internal/generated/RegistryTerms.ts` ≠ its projection of `Registry` | rewrites it |
| `genesis-floor-edited` | `identity/test/fixtures/term-snapshot.genesis.json` differs from base | none |
| `domain-tag-duplicate` | one domain-tag literal appears in two `definePreimage` or `DomainTag.make` calls across tracked `src` | none |
| `preimage-golden-missing` | a `definePreimage` tag has no entry in a `test/fixtures/preimage-goldens.json` of the same package | none |

**Static resolution of a code id** `@beep/<slug>/<module>/<Name>` requires:

1. `<slug>` registered in `packages.ts`;
2. one file of that package containing `const $X = $<Pkg>Id.create("<module>")`;
3. `$X.annoteSchema|annote|annoteKey|annoteClass|annoteError|annoteHttp|class("<Name>"`
   in that file, or a literal `identifier: "<code>"` in the package. The second form covers
   the hand-written test-runner annotations.

This is the matcher of the derivation-map scanner, run per binding. It is reused from the
syntactic parser of `cli/src/commands/Lint/SchemaCatalog.ts` (`:597-656`). A binding whose
code id cannot be resolved statically is refused. That turns the 8 dynamic `create` calls
and the factory-minted identifiers into an explicit rule: a bound kind must be minted
literally.

### 6.4 Test-runner re-publication

`@beep/test-runner` cannot import identity, because identity has it as a dev dependency
(derivation map §6). Its 7 terms are therefore projected into a generated module,
`packages/tooling/test-kit/test-runner/src/internal/generated/RegistryTerms.ts`. It holds
`iri` and `curie` per bound code id and is written by `lint identity-registry --fix`
(`generated-pins-stale` guards it). `Vitest.errors.ts` reads its annotation `iri` and
`curie` from that module, and its `identifier` and `schemaId` become
`@beep/test-runner/Vitest/<Name>`.

Two tests close the loop:

- `test-runner/test/RegistryTerms.test.ts` asserts that every annotated schema in
  `Vitest.errors.ts` carries the generated term for its identifier. This is the PLAN exit
  "`bun run test` in test-runner passes with IRIs resolved from the registry".
- `identity/test/VitestErrorsParity.test.ts:23-61` is rewritten to assert, for each of the
  7 bindings, that the resolved annotation of the test-runner schema has
  `identifier = code`, `iri = term` and `curie = contract(Registry, term)`.

The comment at `Vitest.errors.ts:11-12` is replaced.

## 7. Evolution operations

Each operation is one PR-sized step, and each has a check that fails when the step is
skipped or done wrong.

| Operation | The recorded step | Mechanical check |
| --- | --- | --- |
| Rename a module or symbol of a bound kind | edit `TermBinding.code` in `terms/Bindings.ts`, then `--fix` | until the edit: `binding-dangling`, and the fold refuses `UnboundClass`. After it: a one-line `bindings` diff, with `binding-reassigned` guarding against a disguised reassignment |
| Rename or move a package (P2 `provenance` → `text`; P3-P7 facets) | the same `code` edits for every binding under the slug | the same checks. `TermBinding` rows change and `terms` rows do not, which is what the module-rename test (§8.3) proves |
| Delete a package | deprecate or rebind its bound terms first | `delete-package` refuses while a binding names the slug; `term-evolution` refuses removal without deprecation |
| Deprecate a term | move the local to the vocabulary's `retired`, add a `Deprecation` row, add a major changeset, `--fix` | `UnexplainedRemoval` without the row; `changeset-missing` without the changeset; `BindingToDeprecatedTerm` while still bound |
| Re-publish a term under a new IRI | declare the new term, deprecate the old one with `replacement`, rebind the code id | `DanglingReplacement` if the successor is not active; `TombstoneRevived` if anyone reuses the old IRI |
| Add a term or namespace | declare it, add a minor changeset, `--fix` | `term-snapshot-stale`; `changeset-missing`; registry violations (`OwnershipPrefixMismatch`, `DuplicateNamespaceIri`, `NamespaceIriNotTerminal`) |
| Re-pin or extend an external vocabulary | run the `pinned-vocabularies` target | byte digest, declaration check and license check in the target; `termsDigest` mismatch in `rdf/test/NamespacePin.test.ts` |
| Rename a field of a folded class | declare the new local and deprecate the old one | fold `UndeclaredProperty` and `UnusedTerm` |
| Change a content-hash preimage | bump the domain tag, add a golden, and add a read-time transform where rows are stored | the golden fails under the old tag; `domain-tag-duplicate`; `preimage-golden-missing` |

What an agent cannot do by accident:

- **Derive a beep IRI:** the derivation API is gone.
- **Spell a beep IRI** outside identity or public-site: blocked by `public-origin-literal`.
- **Spell an external namespace IRI** in `src`: blocked by the new Biome GritQL rule
  `no-literal-namespace-iri` (`biome.jsonc` plugin, scoped like `no-hand-rolled-canonical-json`
  at `biome.jsonc:395-401`). Its IRI list is generated from `Registry`, and
  `lint identity-registry` checks that it is fresh.
- **Remove, alter or reuse a published term:** blocked by the evolution check against
  base, with the git-free genesis floor behind it.
- **Change a preimage silently:** blocked by the golden vectors.

## 8. Law tests and generators

The ledger rows `research/law-test-plan.md:91-93` move to `green` in PR 4. Test titles
start with the row id.

### 8.1 `L0-1`: `packages/foundation/modeling/identity/test/Curie.laws.test.ts`

The test has three parts.

1. **Production registry, exhaustive.**
   `it("L0-1 expand then contract is the identity on every registered term")` iterates
   every `Vocabulary` local, active and retired, of `Registry` (479 active terms) and
   asserts both directions:
   - `contract(Registry, iri) = Some(c)` and `expand(Registry, c) = Some(iri)`;
   - `expand(Registry, c) = Some(iri)` and `contract(Registry, iri) = Some(c)`.

   Six named examples cover the acceptance bullet: `prov:wasGeneratedBy`, `oa:hasTarget`,
   `nif:beginIndex`, `xsd:string`, `gufo:Kind` and `as:generator`, each expanding to its
   pinned namespace IRI and contracting back.

2. **Generated registries, as a property.**
   `it.prop("L0-1 expand then contract is the identity on every registered term of a generated registry", [registryWithTerm], ...)`.
   The generator builds leaves with `Arbitrary.schema` and dependent values through the
   production constructor:

   ```ts
   const prefixes = Arbitrary.array(Arbitrary.schema(SafePnPrefix), { minLength: 1, maxLength: 6 });
   const namespaceArb = (prefix: string, index: number) =>
     Arbitrary.map(
       Arbitrary.all([Arbitrary.schema(S.Literals(["/", "#"])), Arbitrary.array(Arbitrary.schema(SafePnLocal), { minLength: 1, maxLength: 12 })]),
       ([terminal, locals]) => ({ _tag: "Vocabulary", namespace: { prefix, iri: `https://example.test/ns${index}${terminal}` }, locals: sortedUnique(locals), retired: [] })
     );
   const registryWithTerm = Arbitrary.flatMap(dedupe(prefixes), (ps) =>
     Arbitrary.filterMap(Arbitrary.all(ps.map(namespaceArb)), (namespaces) =>
       Result.map(makeRegistry({ namespaces, bindings: [], deprecations: [] }), (registry) => [registry, pickTerm(registry)])));
   ```

   `pickTerm` draws an index with `Arbitrary.schema(S.Int.check(S.isBetween(...)))`.
   `filterMap` keeps only registries that `makeRegistry` accepts. With distinct generated
   prefixes and indexed IRIs that is every draw, so nothing is discarded.

3. **Closed world, as a property.**
   `it.prop("L0-1 contraction refuses an unregistered local and expansion an unknown prefix", ...)`
   asserts `contract = None` on `ns.iri + local` for a generated local outside the list,
   and `expand = None` for an unregistered prefix.

Invariant examples for `makeRegistry` (one per `RegistryViolation` case) go in
`identity/test/Registry.test.ts`. They are kept apart from the law file because they are
profile checks.

### 8.2 `L0-2`: `packages/foundation/modeling/jsonc/test/ContentHash.laws.test.ts`

The fixture preimage is declared through the production `definePreimage`, with the tag
`l0-2-fixture/v1` and this schema:

```ts
S.Struct({
  name: WellFormedText,
  nested: S.Struct({ a: S.Finite, b: WellFormedText }),
  members: CanonicalHashSet(WellFormedText),
  sequence: S.Array(WellFormedText),
})
```

Tests:

- `it.prop("L0-2 equivalent records hash alike under key order and set order", [pairArb], ...)`.
  `pairArb = Arbitrary.flatMap(Arbitrary.schema(Fixture), (a) => Arbitrary.map(permutationArb(a), (b) => [a, b]))`.
  Here `b` rebuilds `a` with object keys inserted in reverse order at every level, and
  `members` built from a generated shuffle with duplicates of `a.members`. The test asserts
  `S.toEquivalence(Fixture)(a, b)` and then `mintResult(a) = mintResult(b)`, with
  `@noble/hashes` `sha256` as the `JsoncDigest` (the repo's synchronous SHA-256, registry
  map §6.1).
- `it.effect.prop("L0-2 the effectful mint agrees with the sync twin", ...)` checks that
  `mint` under `Digest.layerWebCrypto` (`node_modules/effect/src/crypto/Digest.ts:159`)
  equals `mintResult`.
- `it.prop("L0-2 order in a sequence field is significant", ...)` swaps two distinct
  elements of `sequence` and asserts that the canonical bytes differ. This is the negative
  that keeps the law honest.
- `it.prop("L0-2 distinct domain tags give distinct canonical bytes", ...)` asserts that one
  preimage under two generated tags gives different canonical strings. It compares bytes,
  not a collision claim.
- `it("L0-2 preimage goldens hold")` runs `assertGoldens` over
  `jsonc/test/fixtures/preimage-goldens.json`, which covers `l0-2-fixture/v1` and
  `activity/v1`.

All generated text is `WellFormedText`, which follows decision `2026-11-19-p0-law-generators-well-formed-text`.

### 8.3 `L0-3`: `packages/foundation/modeling/identity/test/TermStability.test.ts`

- `it("L0-3 the published term set changes only with a deprecation record")`. Fixture pairs
  run through `checkSnapshotEvolution`, one per row of §6.2:
  - removal without a deprecation is reported;
  - removal with one is clean;
  - a revived tombstone is reported, including the module-derived case: re-declaring
    `https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas/Source`
    is `TombstoneRevived`;
  - a changed namespace IRI is reported;
  - a dropped deprecation is reported;
  - a rewritten `since` is reported.
- `it("L0-3 the committed snapshot is the registry's projection and covers the genesis floor")`
  decodes `data/term-snapshot.json` and asserts that it equals `snapshotOf(Registry)`. It
  also asserts that `checkSnapshotEvolution(genesis, live)` is empty, where `genesis` is
  the frozen `test/fixtures/term-snapshot.genesis.json` written once in PR 4 and never
  edited. This holds even where the base-branch gate cannot run.
- `it("L0-3 a module rename changes no published IRI")` is the acceptance clause:
  1. Two production composers stand for the same kind before and after a move:
     `$IdentityId.create("fixture/before/Module")` and
     `$IdentityId.create("fixture/after/Moved")`.
  2. A registry `r` binds the before code to a term `T`. `r2 = renameBinding(r, before, after)`
     is the production helper the rename step uses.
  3. Through `annotationFor(registry, code)`, the function `identityAnnotation` calls with
     `BindingIndex`, the test asserts that the before code under `r` and the after code
     under `r2` both give `iri = T`, and that `snapshotOf(r).terms` equals
     `snapshotOf(r2).terms`.
  4. It asserts that `checkSnapshotEvolution(snapshotOf(r), snapshotOf(r2))` is empty and
     that the two snapshots differ only in `bindings`.
  5. As a negative, the after code under `r` (rename without the binding edit) yields no
     `iri`. That shows the IRI is not derived from the path.

  The lint's fixture test (`cli/test/lint-identity-registry.test.ts`) adds the repository
  view: a fixture workspace whose bound module is renamed reports `binding-dangling`; after
  the `code` edit it is clean, and its snapshot diff is the one binding line.

## 9. Edit plan

The plan is four PRs. PR 1 and PR 2 are independent and open first. PR 3 stacks on PR 1,
and PR 4 on PRs 2 and 3, so no more than three are open at once. Every commit compiles
(`bunx tsgo`) and passes the touched packages' tests. Each PR runs
`bun run beep quality package-verify` for every touched package, then `yeet final-check`
on its head.

**PR 1: IRI schemas move to identity**

1. Add the P1 decision files D1-D11 (§12) with `bun run beep goals decisions add`, and the
   census rows for `IdentityRegistry` (adapt), `Vocab.ts` registries 1-3 (retire into
   `Registry`) and the full E1 chain (retire).
2. Carry out the IRI move as the IRI-move map §10 steps 2-9 specify, in one commit, since a
   partial move does not compile:
   - move `canonicalizeSchemaOrgIri` to `rdf/src/Vocab/SchemaOrg.ts`;
   - `git mv rdf/src/Iri.ts identity/src/Iri.ts` with the `effect/Array` and
     `effect/String` rewrite, including `Str.startsWith` at `:783`;
   - set `$I = $IdentityId.create("Iri")`;
   - regenerate the barrels and re-point the 6 rdf importers, the 19 package and goals-ops
     importers, and the 56 scratchpad files;
   - drop `@beep/documents-domain` → `@beep/rdf`;
   - move the tests to `identity/test/Iri.test.ts` and `rdf/test/SchemaOrg.test.ts`.
3. Regenerate the schema catalog, fallow boundaries, the fallow health key rename, the
   coverage rows and the documents-domain cache baseline. Add changesets: rdf major,
   identity minor, patches.

**PR 2: one digest and one canonical JSON**

4. Add `@beep/schema` `ContentHash.ts`, `CanonicalHashSet.ts`, `WellFormedText.ts` and
   `Instant.ts`, with unit tests. Re-point the matching imports in `ops/design/L1`-`L6` and
   `generators.ts`. `L0.digest.ts` keeps only the activity block.
5. Add `@beep/jsonc` `ContentHash.ts`, `Preimage.ts` and
   `JsoncFingerprint.canonicalizeSchemaResult`; `test/ContentHash.laws.test.ts` (L0-2)
   and `test/fixtures/preimage-goldens.json`. Mark ledger row `L0-2` green.
6. Retire the E1 alias chain (§5.3), with consumers re-pointed and the differential test
   rows updated. Update the jsonc README and add the pinned-encoder note. Add changesets:
   epistemics and epistemic-domain major, schema and jsonc minor, patches.

**PR 3: one registry, pinned (stacked on PR 1)**

7. Identity registry core:
   - add `Authority.ts`, `Registry.ts`, `terms/declare.ts` and `terms/External.ts` (the 11
     carried-over lists unchanged);
   - rebuild `Curie.ts` over `TermRegistry`;
   - delete `Vocab.ts`; remove `.vocabRegistry` and the `vocab` binding from composers;
   - migrate the ontology fold's vocabulary parameter to `TermRegistry`, delete
     `registryPrefix`, migrate `Fold.models.ts:85,124,188` and `Fold.assembly.ts:280`;
   - migrate the cli generators and `rdf/test/VocabDrift.test.ts`; delete rdf `Curie` and
     add `PrefixMap.fromRegistry`;
   - add `identity/test/Registry.test.ts` and `Curie.laws.test.ts` (L0-1, active over the
     11 existing namespaces at this commit);
   - add `schema/test/IdentityRegistryPrimitives.test.ts`.
8. External namespaces and pins:
   - add the `pinned-vocabularies` target and acquire the 19 pins (network);
   - generate the identity term lists, the rdf term tables and
     `namespace-pins.data.json`;
   - add `rdf/src/NamespacePin.ts` and `rdf/test/NamespacePin.test.ts`, plus the
     `@beep/spdx` dependency;
   - turn `Prov.ts`, `Oa.ts` and `Xsd.ts` into generated tables with the export names kept;
     add `Shacl` and `Void`.
   - L0-1 now covers the six new prefixes and their named examples.
9. Clean up namespace literals in `src`:
   - the two local `XSD_STRING` redefinitions;
   - the JSON-LD context at `DocumentAnnotation.ts:36-45`;
   - `Session.validation.ts:68-69,836-841`;
   - `Library.ontology.ts:368-379`;
   - `Fold.projections.ts:140-149`;
   - the seven local `SHACL_NAMESPACE` constants and the VoID literals.

   Then add the `no-literal-namespace-iri` Biome rule. Add changesets: rdf major (already
   major in PR 1 if PR 1 has not released), identity major, ontology major, patches.

**PR 4: terms, bindings, snapshot (stacked on PRs 2 and 3)**

10. Declare the terms, additively:
    - `terms/Beep.ts` (6 vocabularies, 12 instance bases);
    - `terms/Bindings.ts` (23 rows);
    - `terms/Deprecations.ts` (113 genesis tombstones);
    - `Instances.ts` and `internal/BindingIndex.ts`.

    In the same commit:
    - migrate every `.iri`/`.curie` reader in `src` and tests to registry constants (§5.2);
    - give `fold` its registry signature and the four new errors, and fold the research
      library over `beep-library`;
    - re-express `TaxonomyLoader` on `IdentityAuthority`;
    - adapt `IdentityRegistry` and `IdentityEntry`, and re-express semantic-web;
    - move the `ActivityId` block into `@beep/jsonc` with its golden;
    - delete `ops/design/L0.digest.ts` and its `opsScripts` entry.

    The composer `.iri` member still exists at this commit, but no `src` reader uses it.
11. Remove derivation from the composer:
    - delete the members and types of §5.1, and have `identityAnnotation` read
      `BindingIndex`;
    - set `packages.ts:47` to `make("beep")`;
    - rewrite `shape-stable.test.ts:428-467`; replace `IriBinding.test.ts`; update
      `PublicSite.test.ts:153-157` and `Exiftool.models.test.ts:268-271`;
    - add the test-runner generated `RegistryTerms.ts`, the corrected identifiers and
      `RegistryTerms.test.ts`, and rewrite `VitestErrorsParity.test.ts`;
    - move the public-origin allowlist entry by rename;
    - add the `delete-package` refusal.
12. Add the snapshot and the gate:
    - `Snapshot.ts`, `data/term-snapshot.json` (genesis) and
      `test/fixtures/term-snapshot.genesis.json`;
    - `TermStability.test.ts` (L0-3, with the module-rename test);
    - the new `lint identity-registry` kinds and `--fix` writers, with fixture tests;
    - delete `ops/design/L0.identity.ts` and its `opsScripts` entry, and re-point
      `L2.annotation.ts:35`, `L3.taxonomy.ts:23-24`, `L5.operations.ts:18-20`,
      `L6.interchange.ts:25` and `generators.ts:54` to the packages (design-module handoff, decision
      `2026-11-19-p0-design-module-home-and-effect-version`).
13. Update the doctrine and close the phase:
    - glossary entries (§2);
    - chapter 16 L0 and sections 4 and 10: drop "Pending P1"; replace "P5 for the license
      and digest test" with P1; state the four regimes;
    - `identity/README.md` and `rdf/README.md`;
    - mark ledger rows `L0-1` and `L0-3` green;
    - set PLAN P1 to done;
    - add changesets: identity major, ontology major, semantic-web major, test-runner major,
      patches.

## 10. Risks

1. **Module-load coupling.** `Id.ts` now imports `internal/BindingIndex.ts` and through it
   the term data. A careless import of `Iri.ts` or `Registry.ts` from there creates a
   runtime cycle. Mitigation: `identity/test/ImportGraph.test.ts` asserts that `Id.ts`,
   `packages.ts` and `internal/BindingIndex.ts` import nothing from `Iri.ts`, `Registry.ts`
   or `Snapshot.ts`, and the fallow boundary file records the rule.
2. **Static code-id resolution misses a real binding** (dynamic `create`, a factory, a
   shared module identity). Mitigation: the lint refuses an unresolvable binding instead of
   passing it, and the runtime folds (the cli research-library test, `RegistryTerms.test.ts`)
   prove the bound kinds independently.
3. **Base-ref availability in hosted CI.** Hosted clones are blobless, and on a push to
   `main` the base is `HEAD^1`. Mitigation: the lint fetches the base path explicitly. The
   genesis floor test needs no git, so a skipped gate still cannot lose a P1 term.
4. **Pin acquisition is a network step with unconfirmed facts** (the NIF license
   expression, the W3C notice ids, the gUFO version, the PROV artifact digest). Mitigation:
   the target refuses any mismatch between the declared license and digest and the
   fetched artifact. Every "to confirm" item of registry map §5 becomes an assertion in the
   target, not a comment.
5. **External consumers of research-library Turtle** see 104 changed IRIs. Mitigation: the
   genesis tombstones carry replacements. The fold can emit `owl:deprecated true` and
   `dcterms:isReplacedBy` triples for them; that is P1-optional, a one-function addition,
   and is recorded in D3 if taken.
6. **Composer type surgery in a 2,215-line `Id.ts`.** It could disturb type-level
   performance, the check census or the 203 explicit `IdentityComposer<"...">` annotations.
   Mitigation: keep the first type parameter, remove the others in one commit, and run
   `bun run beep lint check-census` and the tsgo timing before and after.
7. **New files need 100% hosted coverage.** `Registry.ts`, `Snapshot.ts`, `Instances.ts`,
   `Preimage.ts` and `NamespacePin.ts` are all new. Mitigation: the law and profile tests
   above are written to cover every violation case. Local whole-package coverage is
   skipped on constrained hosts (`final-check --skip coverage=<reason>`).
8. **Byte-identity of retained IRIs** (practice KG keys through `mintNamed`, claim subjects
   through `mintEncoded`). Mitigation: `mintNamed` reuses the composer's own
   `validateSegment`, and the existing pin tests stay unchanged as the proof. Any diff in
   them stops the PR.
9. **Snapshot merge conflicts between lanes.** Mitigation: one sorted row per line, and
   `--fix` regenerates after a merge. Since stamps come from the base version, two lanes
   produce identical rows for identical edits.
10. **The split-decision cycle.** As written, its cross-check would create an
    identity→schema dev edge, which is a cycle. D6 moves the test into `@beep/schema`. If
    the reviewer prefers the original wording, the workspace graph refuses it.
11. **Scope.** PR 4 is large. Mitigation: commits 10-12 are each green on their own. If
    PR 4's review stalls, commit 12 can split into its own stacked PR without changing the
    order.

## 11. Deliberately left to later phases

- **Domain brands and their `definePreimage` declarations**: `OccurrenceId` and
  `citation-mention/v2` in P2; `AnnotationId` and `RunEntityId` in P3; `ClaimId` in P4.
  P1 ships only the mechanism, `activity/v1` and the fixture tag.
- **gUFO class typing** as a record keyed by term IRI in `@beep/ontology` (P5). P1
  registers the `gufo` namespace and its 14 terms only.
- **Operation terms** for `ActivityStart.operation` (P6). P1 declares none, and
  `mintActivityId` is exercised only by its golden.
- **OA and NIF codecs** and the `as:generator` emission (P3). P1 registers and pins the
  namespaces.
- **`SemanticSchemaMetadata`'s explicit address fields** (`rdf/src/SemanticSchemaMetadata/SemanticSchemaMetadata.schema.ts:300-314`,
  deprecated by `identity-iri-core`). D2 reverses the ruling behind them, but they carry
  no path-derived IRI, and the rdf data-model rewrite in P5 decides their fate.
- **Candidate vocabularies** LKIF, ELI and OntoLex `lexicog`: no commitment (RQ3).
- **`@beep/schema-org`** retirement (P7). Its vendored `schema` table stays until then.
- **The vocabulary composers** `$EpistemicId`, `$QaId` and `$SemanticFoundationId` remain
  as code-id composers. They are not published, and the epistemics rewrite (P4) and the
  seeds move (P5) can retire them.
- **JSON Schema `$defs` and OpenAPI names**: they stay code identities, are not IRIs and
  are outside the term regime.
- **The bare `Sha256Hex` primitive**: out of scope by decision (2,370 lines in 439 files).

## 12. Decision files P1 records (PR 1, commit 1)

| Id | Title | Reversal |
| --- | --- | --- |
| D1 | IRI schemas re-home under `$IdentityId`. 18 code identities change, none are pinned, and code identities are never published | use `$RdfId.create("iri")` from `./packages.ts` (IRI-move map §4 option 2) |
| D2 | Terms are declared and bound by code id; composers derive no IRI; annotations carry `iri`/`curie` only for bound kinds. This reverses the addressing rulings of `identity-iri-core` and `identity-iri-fold` | restore composer `.iri`/`.curie` and derive unbound annotations again |
| D3 | Re-publication rule: retain a published value that is persisted or free of module segments; re-mint one that embeds a module path, with a genesis tombstone; drop unbound annotation IRIs without record (113 re-minted) | bind the 113 old values as terms instead of tombstoning them |
| D4 | Four identity regimes; instance namespaces; the `beep-` prefix rule; `beep:` root prefix retired | fold instance bases back into vocabularies |
| D5 | Snapshot ledger at `identity/data/term-snapshot.json`, compared with base by `lint identity-registry`; genesis floor fixture; `since` = identity version on base; changeset levels | keep the snapshot without base comparison and rely on the floor alone |
| D6 | The version and literal cross-check runs in `@beep/schema` tests (amends `p0-l0-split-by-dependency`, whose identity→schema test edge would cycle) | none; the cycle forbids the alternative |
| D7 | Every external namespace (19, `sh` and `void` included) is pinned in P1 with `termsDigest`; the rdf pin test lands in P1 (amends chapter 16 §10 "P5") | defer `sh`, `void` and the core W3C pins to P5 |
| D8 | The whole E1 canonical-JSON alias chain retires; the owner gains `canonicalizeSchemaResult`; `definePreimage` with goldens and domain-tag uniqueness | retire only the two census copies |
| D9 | `IdentityRegistry` adapts over `TermBinding` and gains a production layer | retire it and re-express semantic-web over `Registry` directly |
| D10 | Registry and snapshot collections are strictly sorted arrays, not `S.HashSet`, in identity | move `CanonicalHashSet` into identity |
| D11 | The `ActivityStart` and `mintActivityId` move rides PR 4 because `operation` is a `TermIri` | move them in P6 with L5 |

## 13. Acceptance mapping

| Clause (SPEC L0 bullet, PLAN P1 exit) | Where it is met |
| --- | --- |
| `TermBinding` and the term-stability snapshot exist | `identity/src/Registry.ts`, `terms/Bindings.ts`, `src/Snapshot.ts`, `data/term-snapshot.json` (PR 4) |
| Only a deprecation record may change the snapshot | `checkSnapshotEvolution`; `lint identity-registry` `term-evolution`; genesis floor; L0-3 |
| A test renames a module and proves no published IRI changes | `TermStability.test.ts` "L0-3 a module rename changes no published IRI", plus the lint fixture test |
| Registry expands and contracts `prov:`, `oa:`, `nif:`, `xsd:`, `gufo:`, `as:` with pin, license and digest | `Curie.laws.test.ts` (L0-1, named examples); `rdf/test/NamespacePin.test.ts` |
| `@beep/identity` depends on `effect` only | `rg -n 'from "@beep/' packages/foundation/modeling/identity/src` returns only relative or self modules; `identity/package.json` dependencies |
| One canonical JSON implementation; versioned, domain-tagged minting in `@beep/jsonc`; `ContentHash` brands | §3.3-3.4, §5.3; L0-2 |
| Path-derived IRIs are gone | §5.1 (no derivation API) and §4.3 (every exit declared) |
| Test-runner pinned IRIs re-published from the registry; its `bun run test` passes | §6.4 |
| IRI schema move | PR 1 (IRI-move map) |
| Identity regimes in the glossary | §2, commit 13 |
| `bun run beep lint identity-registry` passes and checks term stability | §6.3 |
| `L0-1` to `L0-3` green by id in the named packages | §8 |
