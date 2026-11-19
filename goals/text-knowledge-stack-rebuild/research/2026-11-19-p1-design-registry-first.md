# P1 design: the registry as the single source of every published term (2026-11-19)

Design for phase P1, "L0 identity: declared terms, one digest". Angle: the registry is
the one source of truth for every published term, internal and external alike. There is
one table, one codec and one snapshot. The code composer becomes a typed lookup into
that table and stops minting IRIs.

Inputs: SPEC Objective 5, Constraints "Identity", acceptance bullet "L0"; PLAN row P1;
decisions `2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc`,
`2026-11-19-p0-rq3-external-vocabularies-as-adapters-confirmed`,
`2026-11-19-p0-activity-id-minted-at-start`,
`2026-11-19-p0-items4-6-9-annotation-document-shape`, `2026-11-19-p0-law-generators-well-formed-text`,
`2026-11-19-p0-design-module-home-and-effect-version`, `2026-11-19-p0-l0-split-by-dependency`; ledger rows `L0-1` to `L0-3`;
`ops/design/L0.identity.ts`, `ops/design/L0.digest.ts`; census section g; design facts
sections 5 and 6; `standards/architecture/16-knowledge-stack.md` "L0 · Identity", "4.
Identity regimes", "10. External vocabularies"; and the three P1 maps
(`2026-11-19-p1-map-identity-derivation.md`, `-registries-and-namespaces.md`,
`-iri-move.md`, cited below as *map I*, *map R* and *map M*).

Base: the maps measured `3dbdd1e46ba`/`c8e55ae87b5`. The new measurements in this file
were taken at `5e9d45c91ee` with `effect@4.1.4`, using the same exclusions
(`scratchpad/`, `.repos/`). Each one carries its command or file. Nothing was fetched
from the network. A value that only acquisition can produce, such as an upstream digest,
is marked *at acquisition*.

## Rulings applied

This design was chosen as the P1 base, with grafts from the minimal-surface and
evolution-first designs. The orchestrator's P1 rulings are recorded as the
`2026-11-19-p1-*` decision files, and where they differ from this text the decision
file wins. They override this design at these points:

- **D5** is withdrawn. `CanonicalHashSet` lives in `@beep/schema`, as the split ruling
  and the `L0.digest.ts` owner line say. `@beep/identity` keeps strictly ascending
  sorted arrays for its snapshot and registry collections (decision
  `2026-11-19-p1-canonical-set-in-schema-identity-sorted-arrays`).
- **D7** is replaced. `since` is a vocabulary release of the term snapshot, not the
  `@beep/identity` package version. The snapshot carries `release`, starting at
  `1.0.0`; the writer bumps the minor on additions and the major on deprecations, and
  existing rows keep their `since`. Nothing reads changeset frontmatter, and the "needs
  an @beep/identity changeset" refusal of section 4.2 is dropped (decision
  `2026-11-19-p1-since-is-a-snapshot-vocabulary-release`).
- **D8** is narrowed. P1 pins `prov`, `oa`, `nif`, `xsd`, `gufo` and `as`, plus `skos`,
  `doco` and the three SPAR pins already carried (`deo`, `fabio`, `cito`). The test
  that every external namespace is pinned stays in P5 (decision
  `2026-11-19-p1-pin-scope-eight-namespaces`).
- **Section 5.5, changesets**, is withdrawn. Every package P1 touches is private and
  repo-sanity forbids a changeset for a private workspace, so none is written. Each
  breaking change is recorded in a P1 decision file instead (decision
  `2026-11-19-p1-no-changesets-for-private-workspaces`).

Facts the judges corrected, which replace the figures in sections 1, 4.1, 5.3 and 13:

- The research-library fold publishes **87** distinct owned property IRIs, measured by
  running `assembleLibraryOntology()`. The 90 in section 1 counts field keys and
  includes the borrowed `dcterms:created` and `dcterms:title`. The deprecation count is
  re-derived by the codemod from the live fold plus the projection predicates
  `effectiveCategory` and `catalogIndex`, not taken from the 119 of section 5.3.
- Class locals are the ones the live fold prints, `Source` to `Manifest`, not the
  schema class names (`LibrarySource` in the section 4.1 shard example is wrong).
- The design-module handoff covers every importer of `./L0.*`:
  `L0.digest.ts:28`, `L1.text.ts:21`, `L2.annotation.ts:34-35`, `L3.taxonomy.ts:23-24`,
  `L4.claims.ts:40`, `L5.operations.ts:18-20`, `L6.interchange.ts:25`,
  `generators.ts:53-54` and `index.ts:44,46` (measured with
  `grep -rn 'from "\./L0\.' ops/design`). Section 13 omits `L1`, `L4` and `L6`.
- The `IdentityAuthority` importer outside identity is
  `packages/foundation/modeling/public-site/test/PublicSite.test.ts`.

---

## 1. Thesis and the measurements that decide it

The SPEC says three things about identity. Term IRIs are declared, never derived. Today's
path-derived IRIs are re-published, not pinned. The published set changes only with a
deprecation record. The question that decides the whole design is which of today's IRIs
are published. Four measurements answer it.

1. **The fold is the only in-process reader of the `iri` and `curie` annotations.**
   `git grep` for annotation reads of `iri`/`curie` outside tests finds one site,
   `packages/foundation/modeling/ontology/src/Fold.assembly.ts:131-137` (`classIdentity`
   reads `identifier`, `iri`, `curie`). Every annotation helper writes the record
   (`identity/src/Id.ts:1810-1827`, map I section 1). That makes 21,434 annotation
   identifiers (map I section 5), and nothing reads them except the fold.
2. **The research library is the only production caller of the fold.** The files that
   import `fold` from `@beep/ontology` are the ontology package's own `Fold.*` modules,
   `ontology/test/Fold.test.ts`, and
   `packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts`, whose
   call is at `:112`. That call folds 16 classes (`Library.ontology.ts:48-65`). The 16
   classes have 141 fields with 90 distinct keys, measured by importing the module (a
   one-off scratch script that counted `libraryOntologySchemas[i].fields`). Owned
   property IRIs are `appendLocal(composer.iri, field)` (`Fold.assembly.ts:436`), so the
   published research-library T-Box holds 16 class IRIs, 90 property IRIs and the
   instance bases named in section 5.3.
3. **The other exits read a composer `.iri` directly.** Outside `@beep/identity` and
   `goals/`, the composer read pattern
   `(\$…Id|\$I|\)|…composer)(.create(...))*.(iri|curie)` matches 173 non-comment lines
   in 37 files. Seven of those matches read fold output rather than a composer:
   `Fold.test.ts:515-516`, `Vocabulary.test.ts:165`, `Library.projection.ts:159` and
   `research-library-ontology.test.ts:149,155,175`. That leaves **166 composer reads in
   35 files**. They are the exits of map I section 6. All but two families use free
   segments under a root, vocabulary or package composer. The two exceptions embed a
   module file path: the research library (`Library.ontology.ts:34,287,340,378`,
   `Library.projection.ts:28-29,225,255,266,269,275`, `Library.views.ts:44-48`) and the
   test-runner pins (`packages/tooling/test-kit/test-runner/src/Vitest.errors.ts`, seven
   IRIs at `:23,55,65,121,131,141,151`, map I section 6).
4. **The persisted IRIs carry no file path.** They are the practice KG bundle
   (`law-practice/server/src/PracticeKg.projections.ts:79,285`), the stored SHACL reports
   (`epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:39-41`) and the XMP namespace
   in recorded media (`drivers/exiftool/src/ExiftoolConfig.ts:60`). No SQL column stores
   a module-derived IRI (map I section 7).

So the path-derived IRIs that reach any reader fall into two groups: the research
library's T-Box and the seven test-runner pins. The 21,434 annotation IRIs never leave
the process. Under these facts the registry-first design is small and exact:

- The registry table declares **every IRI that leaves the process**. That covers 335
  external terms (the 256 terms in `CoreVocab` and SPAR today plus the 79 curated
  terms of the six new namespaces), the SHACL and VoID terms, the internal
  vocabularies the exits use, and the instance bases.
  Nothing else gets an IRI.
- **23 code ids are bound**: the 16 research-library classes the fold reads and the 7
  test-runner schemas whose annotations SPEC names. An annotation carries `iri` and
  `curie` only for a bound code id. The other 21,411 annotations lose two fields that
  nobody reads.
- Persisted IRIs, and IRIs whose segments were already chosen by hand, are declared
  **with their current values**. Only the IRIs that embed a module path are re-minted:
  the research library and the test-runner pins. Each old value gets a `Deprecation`
  row in the first snapshot that names its replacement.

"Path-derived IRIs are gone" then holds by construction. `toIri`, `toCurie`,
`IriFromIdentity`, `CurieFromIdentity`, `rebase` and the composer's `.iri`/`.curie` are
deleted, so no code path can compute an IRI from an identity.

---

## 2. Homes and dependency edges

| Object | Package / module | Why there |
| --- | --- | --- |
| `IRI`, `IRIReference`, `RelativeIRIReference`, `AbsoluteIRI` | `@beep/identity/Iri` (moved from `rdf/src/Iri.ts`, map M) | `TermIri` needs it and identity is effect-only (L0 homes decision, item 1) |
| `IdentityAuthority` | `@beep/identity/Authority` (new, no imports; moved from `Id.ts:77`) | the generated registry data and `Id.ts` both need it. If `Id.ts` kept it, `Id.ts → Registry.data.ts → Id.ts` would be a cycle |
| `CanonicalHashSet`, `CanonicalHashSetBy`, `sortedMembers` | `@beep/identity/CanonicalSet` | effect-only, and the snapshot needs it. This amends the `L0.digest.ts` owner line (decision D5) |
| `TermIri`, `CodeId`, `ReleaseVersion`, `TermLocal`, `Namespace`, `Term`, `TermBinding`, `Deprecation`, `TermSnapshot`, `SnapshotViolation`, `snapshotViolations`, `RegistryShard`, `RegistryConflict`, `RegistryTable` | `@beep/identity/Term` | split ruling: identity owns what expansion and binding need |
| the typed registry value and the one codec (`Registry`) | `@beep/identity/Registry` | one codec over one table |
| generated data (`RegistryVocab`, `RegistryBindings`, `RegistryDeprecations`) | `identity/src/internal/generated/Registry.data.ts` | `Id.ts` must read bindings synchronously at module load (map I section 9.2) |
| the table's source shards and the snapshot | `packages/foundation/modeling/identity/registry/namespaces/<prefix>.json`, `.../registry/term-snapshot.json` | data owned by the publisher of every term |
| `IdentityRegistry` service | `@beep/identity/IdentityRegistry` (kept; `IdentityEntry.fromBinding`; `IdentityRegistry.layer` over the generated table) | the runtime view of the same table |
| `ContentHash`, `DomainTag` | `@beep/schema/ContentHash` (beside `Sha256.ts:132`) | brands over `Sha256PrefixedDigest`, which schema owns |
| `mintContentHash`, `mintContentHashResult`, `JsoncFingerprint.canonicalizeSchemaResult` | `@beep/jsonc/Mint` and `@beep/jsonc/JsoncFingerprint` | jsonc is the canonical-JSON owner |
| `PinnedSource`, `NamespacePin`, `NamespacePins` and the pin data | `@beep/rdf/NamespacePin`, `rdf/src/Vocab/generated/namespace-pins.data.json` | split ruling; this adds the edge `@beep/rdf → @beep/spdx` (`spdx` depends on identity and effect only, map R section 5) |
| registry generator, `rebind`, `deprecate`; the term-stability gate | `packages/tooling/tool/cli/src/commands/Identity/` (new); `commands/Lint/IdentityRegistry.ts` (extended); `commands/SyncDataToTs/targets/PinnedVocabularies.ts` (new; absorbs `SparTerms.ts`) | cli already depends on rdf and spdx (map R section 7, item 14) |
| test-runner's published terms | `packages/tooling/test-kit/test-runner/src/internal/generated/RegistryTerms.ts` (generated projection) | test-runner cannot import identity: all 14 identity test files import `@beep/test-runner` (`grep -l '@beep/test-runner' identity/test/*.ts`), so identity depends on test-runner |

Import rules inside identity (map M section 4, extended):

- `Id.ts` imports only `Authority.ts`, `internal/generated/Registry.data.ts`, the type
  helpers in `Vocab.ts`, and the segment grammar, which moves to `internal/Segment.ts`.
- `Id.ts` and `packages.ts` never import `Iri.ts`, `Term.ts` or `Registry.ts`.
- `Registry.data.ts` is plain literal data and imports only `Authority.ts`.

---

## 3. Schemas (identity, `@beep/identity/Term`)

These follow the revised `ops/design/L0.identity.ts`, with four additions this design
needs: `TermLocal`, the `namespaces` field of the snapshot, the violation union, and the
shard and table records. The bottom-package idioms apply: `S.Literals`, no `LiteralKit`,
and versions as a local pattern. `$I = $IdentityId.create("Term")` imports
`./packages.ts`, as `Curie.ts:18` does.

```ts
// TermIri, CodeId, ReleaseVersion: as in ops/design/L0.identity.ts:29-69, with IRI
// imported from "./Iri.ts". CodeId keeps the pattern at L0.identity.ts:38-47.

/** Local name: one or more SafePnLocal segments joined by "/". New internal terms
 *  use one segment (gate rule); multi-segment locals exist only for kept values. */
export const TermLocal = S.String.check(S.makeFilter(isTermLocal, $I.annote("TermLocalCheck", {...})))
  .pipe(S.brand("TermLocal"), $I.annoteSchema("TermLocal", {...}));

export class Namespace   /* { prefix: SafePnPrefix, iri: IRI } */            // L0.identity.ts:72-77
export class Term        /* { iri: TermIri, namespace: SafePnPrefix, local: TermLocal } */
export class TermBinding /* { code: CodeId, term: TermIri, since: ReleaseVersion } */ // :89-99
export class Deprecation /* { term: TermIri, since, replacement: Option<TermIri> } */ // :102-108

export class TermSnapshot extends S.Opaque<TermSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("term-snapshot/v1"),
    namespaces: CanonicalHashSetBy(Namespace, Namespace.byPrefix),   // new: prefixes are published too
    terms: CanonicalHashSet(TermIri),                                 // vocabulary terms + namespace IRIs
    deprecations: CanonicalHashSetBy(Deprecation, Deprecation.byTerm),
  }).pipe($I.annoteSchema("TermSnapshot", {...}))
) {}

export const SnapshotViolation = S.TaggedUnion({
  TermRemoved:            { term: TermIri },           // in previous.terms, absent from next, no deprecation
  NamespacePrefixChanged: { iri: IRI, from: SafePnPrefix, to: SafePnPrefix },
  DeprecationRemoved:     { term: TermIri },           // deprecations are append-only
  DeprecationChanged:     { term: TermIri },
  TermRevived:            { term: TermIri },           // a deprecated IRI is live again
}).pipe($I.annoteSchema("SnapshotViolation", {...}));

/** L0-3: replaces unexplainedRemovals (L0.identity.ts:120-130); dual, pure. */
export const snapshotViolations: {
  (next: TermSnapshot): (previous: TermSnapshot) => ReadonlyArray<SnapshotViolation>;
  (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation>;
};

/** One source shard: one namespace, its locals, its bindings and its deprecations. */
export class RegistryShard extends S.Opaque<RegistryShard, { readonly brand: unique symbol }>()(
  S.Struct({
    namespace: Namespace,
    terms: CanonicalHashSet(TermLocal),
    bindings: CanonicalHashSetBy(ShardBinding /* { code, local, since } */, byCode),
    deprecations: CanonicalHashSetBy(ShardDeprecation /* { term: TermIri, since, replacement: Option<TermLocal> } */, byTerm),
    projection: S.OptionFromOptionalKey(S.Literals(["@beep/test-runner"])),
  })
) {}

export const RegistryConflict = S.TaggedUnion({
  DuplicatePrefix: {...}, DuplicateNamespaceIri: {...}, DuplicateTermIri: {...},
  DuplicateBinding: {...}, BindingToUnknownTerm: {...}, DeprecatedTermLive: {...},
  ReplacementUnknown: {...}, ReplacementCycle: {...},
});

/** The one table. The constructor is the only way to build it. Its invariants are a
 *  schema check group, so decoding refuses a conflicting table. */
export class RegistryTable extends S.Opaque<RegistryTable, { readonly brand: unique symbol }>()(
  S.Struct({ namespaces, terms: CanonicalHashSetBy(Term, byIri), bindings, deprecations }).check(registryInvariants)
) {
  static readonly fromShards: (shards: Iterable<RegistryShard>) => Result.Result<RegistryTable, RegistryConflict>;
  static readonly snapshot: (table: RegistryTable) => TermSnapshot;   // the projection the gate compares
  static readonly rebind: (table: RegistryTable, from: CodeId | CodePrefix, to: ...) => Result.Result<RegistryTable, RegistryConflict>;
}
```

`registryInvariants` checks the following:

- prefixes are unique, and namespace IRIs are unique;
- `term.iri === namespace.iri + local`, and the namespace exists;
- term IRIs are unique across namespaces, so contraction is an exact lookup, not a
  longest-prefix guess;
- each code id is bound at most once, and each binding names a live term;
- a deprecated IRI is not live;
- every replacement chain ends at a live term, with no cycle.

`CanonicalHashSet` keeps its unary string signature (`L0.digest.ts:106-116`, used as
`TermIri.pipe(CanonicalHashSet, ...)` at `L3.taxonomy.ts:136`). `CanonicalHashSetBy(item,
order)` handles struct members. Effect 4 `Equal` is structural for plain objects
(`node_modules/effect/src/Equal.ts:4,132`), so a `HashSet` of opaque struct values
deduplicates by value.

The cross-check that the split ruling asks for compares `ReleaseVersion` with
`@beep/schema`'s `SemanticVersion` and `S.Literals` with `LiteralKit`. It cannot sit in
identity's tests: a `@beep/schema` dev dependency there closes the workspace cycle
identity → schema → identity. It lives in
`packages/foundation/modeling/schema/test/IdentityRegistryParity.test.ts` instead
(decision D12), where schema → identity is the legal direction.

---

## 4. The one table: files, generator, snapshot

### 4.1 Source shards

There is one JSON file per namespace under
`packages/foundation/modeling/identity/registry/namespaces/`. Each file is the encoded
side of `RegistryShard`, with sorted arrays and one entry per line, so diffs review
line by line. Writers:

- External namespaces are written only by `bun run beep sync-data-to-ts --target
  pinned-vocabularies`, which writes the shard and the rdf pin in one run (section 9).
- Internal namespaces are edited by hand or through `beep identity rebind` and
  `beep identity deprecate`.
- Every edit is checked by `lint identity-registry`.

```json
{
  "namespace": { "prefix": "research-library", "iri": "https://beep-effect.com/ns/research-library/" },
  "terms": ["LibraryArtifact", "LibraryCapture", "...", "accessClass", "..."],
  "bindings": [
    { "code": "@beep/repo-cli/commands/Research/Library/Library.schemas/LibrarySource", "local": "LibrarySource", "since": "1.0.0" }
  ],
  "deprecations": [
    { "term": "https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas/LibrarySource", "since": "1.0.0", "replacement": "LibrarySource" }
  ]
}
```

### 4.2 Generated artifacts

`bun run beep identity registry --write` decodes every shard and builds the table with
`RegistryTable.fromShards`. It stops on the first `RegistryConflict`. Otherwise it
writes three artifacts. `--check` writes nothing and reports drift.

1. `identity/src/internal/generated/Registry.data.ts` holds three literal consts. Internal
   IRIs are spelled `` `${IdentityAuthority}research-library/` ``, not as raw literals:
   - `RegistryVocab`: prefix to `{ iri, terms }`, keeping the `VocabShape` shape
     (`Vocab.ts:37`) so the existing `Curie<V>`, `Predicate<V>` and `Expand<C, V>`
     helpers (`Vocab.ts:445,464,481`) work unchanged;
   - `RegistryBindings`: code id to `{ curie, iri }`, precomputed so `Id.ts` needs no
     codec;
   - `RegistryDeprecations`.
2. `identity/registry/term-snapshot.json`: `TermSnapshot` v1 encoded, written by
   `RegistryTable.snapshot`, with sorted arrays.
3. `test-runner/src/internal/generated/RegistryTerms.ts`: the rows of shards that
   declare `"projection": "@beep/test-runner"`, as plain literals. Each row has
   `identifier`, `iri` and `curie`.

The `since` value is the `@beep/identity` release that ships the row (decision D7). The
registry is published by identity, so one version line orders every row. For rows new
relative to the base snapshot, the generator computes it as
`semver.inc(identity.version, highestPendingBump)`, reading the `"@beep/identity": <bump>`
frontmatter of `.changeset/*.md`. With no pending identity changeset it refuses:
"a registry change needs an @beep/identity changeset". For P1, identity is at `0.1.1`
(`identity/package.json`) and the change is major, so every P1 row carries `1.0.0`.

### 4.3 The snapshot and why it is a separate file

The table and the snapshot hold the same facts, and the snapshot is regenerated from the
table. It is committed for three reasons:

- it is the compact, sorted, one-IRI-per-line form that reviewers diff;
- the gate can compare it against the base ref with one `git show`;
- the identity test can import it with `import snapshot from "../registry/term-snapshot.json" with { type: "json" }`.
  This form is already in use, for example at `drivers/github-actions/test/reachability.test.ts:23`.

`terms` holds every vocabulary term IRI and every namespace IRI. A namespace IRI is
published because instance IRIs are minted under it, as with `practice-kg`.
`namespaces` makes prefix changes visible. `deprecations` only grows.

---

## 5. What a code id's IRI is, and what "re-published" means concretely

### 5.1 The rule

The declared IRI of a code id `c` is `RegistryBindings[c].iri` when `c` is bound.
Otherwise `c` has no IRI. A code id is the composer identity `@beep/<pkg>/<module>/<Name>`,
and it stays a code path (`identifier`, `Symbol.for`, JSON Schema `$defs`, OpenAPI
component names; map I section 6). None of the 3,303 `create(...)` calls change.

A new internal term IRI is `IdentityAuthority + <namespace>/ + <local>`, with a
one-segment local. The namespace is named for its vocabulary, not for a package or file.
Renaming a package or moving a file therefore edits `TermBinding.code` and nothing else.

### 5.2 Kept values (declared with today's bytes)

A value is kept if it is persisted, so the stored-format law applies, or if its segments
are already hand-chosen. Every row below was read off its read site, and the generator
reproduces each value byte for byte. The proof is that the existing pins stay green
unchanged:

- `law-practice/server/test/PracticeKg.projections.test.ts:1144-1197,1413`;
- `epistemic/tables/test/EpistemicTables.test.ts:140,676`;
- the type pin in `drivers/exiftool/test/Exiftool.models.test.ts:268-271`.

| Prefix | Namespace IRI (after `https://beep-effect.com/ns/`) | Terms | Read sites |
| --- | --- | --- | --- |
| `epistemic` | `epistemic/` | `Claim`, `hasEvidenceQuote`, `claim` (instance base) | `ClaimGate.service.ts:39-41` |
| `beepQA` | `qa/1.0/` (XMP; prefix already `beepQA`, `ExiftoolConfig.ts:76`) | the 8 `BeepQaTagName` members (`ExiftoolConfig.ts:109`) | `ExiftoolConfig.ts:60` |
| `qa` | `qa/` | `evidence/{cited-event-id-exists,declared-round-coherent,evidence-cross-check,judge-output-inventory,cited-artifact-exists}/v2`, `receipts/{accepted,delivered,persisted,recovery-attempt,semantically-applied}/v2`, `verifiers/judge-settlement/v1` | `JudgeContract.ts:64-72,770,851-855,942`, `CitedArtifactExistsGate.ts:30-32` |
| `skill-contract` | `skill-contract/` | `evidence/failure/v2`, `evidence/gate-summary/v2`, `evidence/gate-certificate/v1` | `Recovery.ts:340`, `EvidenceReceipt.ts:385`, `GateCertificate.ts:335-336` |
| `contracts` | `contracts/` | `qa-inventory/v1` | `JudgeContract.ts:772` |
| `schemas` | `schemas/` | `qa-judge-input/v1`, `qa-judge-settlement/v1` | `JudgeContract.ts:773,841,844` |
| `document` | `document/` | `pattern`, `citation` | `rdf/src/Adapters/DocumentAnnotation.ts:20-21` |
| `documents-taxonomy` | `documents/taxonomy/` | `legal-document` | `documents/domain/src/values/Taxonomy/Taxonomy.seed.ts:14-15` |
| `practice-kg` | `practice-kg/` | the 7 `KgNodeKind` members (`law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:39`) as instance bases | `PracticeKg.projections.ts:79,285` |
| `identity-rdf` | `semantic-web/identity/` | `identifier`, `curie` | `semantic-web/src/identity/IdentityRdfBinding.ts:27-28` |
| `semantic-foundation` | `ontology/semantic-foundation/` | none; instances minted under it (`taxonomy/legal-intake`, `concept/*`, `document-class/*`, `filing-root/*`, `vocabulary/{docketing,party-kinds,legal-roles}/concept/*`, `classification/<kind>/<edition>/…`) | `Vocabulary.seed.ts:10,291,377` (72 read lines), `SemanticFoundation.seed.ts:12-15` (12), `Classification.models.ts:378-379,398,423`, `TaxonomyLoader.ts:134-138` |
| `semantica` | `semantica/` (lab; gold fixture `semantica/fixtures/gold/v1/g-projection.json:21,26`) | none; minted (`ontology/<Term>`) | `apps/labs/semantica/src/layers/RdfProjectionLive.ts:26,41-53` |
| `lejeune` | `lejeune/ontology/` (lab) | none; minted | `apps/labs/lejeune-bolt-workbench/src/runtime/Projections.ts:31,350,356` |

The multi-segment locals in this table (`qa`, `skill-contract`, `contracts`, `schemas`)
are the reason `TermLocal` admits `/`. They are versioned contract identifiers that
evidence receipts carry and `cli/skills/qa-inventory-judge/SKILL.md:2,5` commits, so
they keep their bytes. The canonical CURIE keeps the raw `/` (`qa:receipts/accepted/v2`),
as `beep:a/b` does today (`Id.ts:1690-1696`). Turtle serializers escape it at the
boundary with the existing `prefixedNameOrIri` (`PnLocal.ts:480`), because a bare `/` is
not a legal `PN_LOCAL` (`PnLocal.ts:25-30`).

The `beep:` prefix and the four terms that `SemanticFoundationVocab` declares
(`Vocab.ts:548-558`) retire. Their only readers are identity tests (map R section 1.2).
The IRIs live on as instances under `semantic-foundation`.

### 5.3 Re-minted values (the path-derived IRIs that left the process)

| Old IRI (after the authority) | New IRI | Count | Sites |
| --- | --- | --- | --- |
| `repo-cli/commands/Research/Library/Library.schemas/<Class>` | `research-library/<Class>` | 16 (bound) | `Library.schemas.ts:16`, `Library.ontology.ts:34,48-65` |
| `repo-cli/commands/Research/Library/Library.schemas/<field>` | `research-library/<field>` | 90 | `Fold.assembly.ts:436`, `Library.ontology.ts:287,340` |
| `…/Library.schemas` (ontology base and SPARQL `lib:` prefix) | namespace `research-library/` | 1 | `Library.ontology.ts:378`, `Library.views.ts:45,48` |
| `…/Library.schemas/{Topic,SoftwareAgent,Distribution,effectiveCategory,catalogIndex}` | `research-library/{same}` | 5; `Topic`, `SoftwareAgent` and `Distribution` are instance bases | `Library.projection.ts:29,225,255,266,269,275` |
| `repo-cli/commands/Research/Library/Library.views/term` | `research-library/view` (instance base for metadata keys and the 6 `v:` locals) | 1, in-process only, no deprecation row | `Library.views.ts:40,44,48,412` |
| `test-utils/Vitest/<Name>` | `vitest/<Name>` (bound; prefix `vitest`) | 7 | `Vitest.errors.ts:23,55,65,121,131,141,151` |

The term list for each new shard is the exact list the generator emits, so the counts
above are what the commit writes. Field keys share one term across classes, as they do
today: a property is module IRI plus field.

The P1 snapshot carries one `Deprecation { term: old, since: "1.0.0", replacement:
new }` per re-minted row that left the process: 16 + 90 + 1 + 5 + 7 = 119 rows. They
are recorded although no earlier snapshot exists, so the move from derived to declared
IRIs is itself written down, and anyone reading an old research-library Turtle file can
map it. The old values are computed by the one-off codemod (section 6.3) from the
composer expressions at the P1 base, before the composer IRI surface is deleted. They
are frozen in `identity/test/fixtures/p1-retired-iris.json` for L0-3.

The test-runner code ids are corrected in the same row, from `@beep/test-utils/Vitest/X`
to `@beep/test-runner/Vitest/X`. `@beep/test-utils` is a different live package (census
section g), so the old identifier claimed an owner it does not have.

### 5.4 What changes for each artifact that carries an IRI

| Artifact | Change | Consequence | Proof |
| --- | --- | --- | --- |
| Research-library T-Box and SHACL (`ontology/research-library.ttl`, `.shacl.ttl`, written outside the repo, `Library.paths.ts:39,53`) | every class, property and instance IRI re-minted (5.3) | regenerate. Old files map through the 119 deprecation rows. No in-repo reader of old files | `cli/test/research-library-ontology.test.ts` re-pinned |
| Ontology fold output (Turtle, JSON-LD, Markdown) | the base is a registry `Namespace`. A class IRI is its binding. An owned property must be a declared term of that namespace | `fold` refuses an unbound class (`UnboundClass`) and an undeclared owned property (`UndeclaredProperty`) | `Fold.test.ts` over a fixture registry |
| test-runner annotations (7 schemas) | identifier, `Symbol.for` id, IRI and CURIE change (5.3) | none is persisted. Errors are in-process | `test-runner/test/Vitest.errors.terms.test.ts`, rewritten `identity/test/VitestErrorsParity.test.ts` |
| In-process `iri`/`curie` annotations of the 21,411 unbound identifiers | removed | the only reader is the fold (fact 1) | `shape-stable.test.ts:428-467` rewritten with the record shape for bound and unbound |
| Practice KG bundle (DuckDB `kg_node.iri`, `kg_edge.*_iri`) | none (kept value, byte-identical mint) | stored rows untouched | `PracticeKg.projections.test.ts:1144-1197,1413` unchanged |
| Stored SHACL reports of claim dispositions | none | none | `EpistemicTables.test.ts:140,676` unchanged |
| XMP namespace in recorded media | none | none | `Exiftool.models.test.ts:268-271` unchanged |
| in-toto predicate types, skill contracts, QA judge schemas, `SKILL.md` | none | none | `qa-inventory-judge/SKILL.md` unchanged |
| JSON-LD document annotations, documents taxonomy seed, ontology seeds (230 concept IRIs), lab projections | none | P5 moves the seeds with IRIs preserved | existing seed and gold tests unchanged |
| Identity RDF binding (semantic-web) | predicates unchanged. Entries come from bindings (`IdentityEntry.fromBinding`), and `fromComposer` (`IdentityRegistry.ts:133`) is deleted | fewer entries: only bound code ids have an IRI | semantic-web tests re-pinned |
| JSON Schema `$defs` (`tooling/tool/docgen/schema.json`), OpenAPI component names | none (identifiers unchanged) | none | `docgen` check |
| 18 IRI-schema identities `@beep/rdf/iri/...` | become `@beep/identity/Iri/...` code ids with no IRI | nothing pins them (map M section 4) | `git grep` empty |

### 5.5 Changesets

| Package | Bump | Reason |
| --- | --- | --- |
| `@beep/identity` | major (0.1.1 → 1.0.0) | composer `.iri`, `.curie`, `rebase`, `vocabRegistry`, the `Authority`, `Prefix` and `Vocab` type parameters, `IriFromIdentity` and `CurieFromIdentity` removed; `CoreVocab`, `SparVocab`, `SemanticFoundationVocab`, `mergeVocab`, `VocabEntry`, `VocabRegistry`, `CoreCurieCodec`, `makeCurieCodec`, `makeCurieFromIri` and `CurieFromIri` removed into `Registry`; annotation record changed; `IdentityEntry.fromComposer` removed; `IdentityAuthority` moved; new modules |
| `@beep/rdf` | major | IRI schemas and the `@beep/rdf/Iri` subpath removed (map M section 6); branded `Curie` (`Rdf.ts:301`) removed |
| `@beep/test-runner` | major | 7 published identifiers and IRIs changed |
| `@beep/ontology` | major | `fold(composer, input)` becomes `fold(namespace, input)`; the CoreVocab default is gone; new refusals |
| `@beep/semantic-web` | major | `IdentityEntry` construction and shape (`iri: TermIri`) |
| `@beep/schema`, `@beep/jsonc` | minor | `ContentHash`, `DomainTag`; `Mint`, `canonicalizeSchemaResult` |
| `@beep/documents-domain`, `@beep/ontology-client`, `@beep/epistemic-domain`, `@beep/execution-authority-domain`, `@beep/epistemic-use-cases`, `@beep/law-practice-server`, `@beep/exiftool`, `@beep/skill-contract`, `@beep/epistemic-tables` (JSDoc only) | patch | imports and reads re-pointed, bytes unchanged |
| `@beep/repo-cli`, `@beep/scratchpad` | none | ignored (`.changeset/config.json` `ignore`) |

---

## 6. The composer API and the codemods

### 6.1 Before and after

| Member | Today | After P1 |
| --- | --- | --- |
| `IdentityComposer<Value, Authority, Prefix, Vocab>` (`Id.ts:1011-1016`) | four parameters | `IdentityComposer<Value>`. The 203 `IdentityComposer<"@beep/...">` annotations in `packages.ts` use only the first parameter and compile unchanged |
| `make(base, { authority, prefix, vocab })` (`packages.ts:47`) | binding sets the IRI authority | `make(base, { registry? })`. The registry defaults to `RegistryBindings`, and tests pass a fixture view. `packages.ts:47` becomes `make("beep").$BeepId` |
| `.iri`, `.curie`, `rebase`, `vocabRegistry` (`Id.ts:1325-1497`, `:2058-2068`) | path-derived | deleted |
| `annote`, `annoteSchema`, `annoteKey`, `annoteClass`, `annoteError`, `annoteHttp`, `class` | write `{ schemaId, identifier, iri, curie, title }` | write `{ schemaId, identifier, title }`, plus `iri` and `curie` from `registry[identifier]` when bound. The type mirrors it: `IdentityAnnotation<Id>` gains `{ iri: RegistryBindings[Id]["iri"]; curie: ... }` only when `Id extends keyof typeof RegistryBindings` |
| `key(term: Predicate<Vocab>)` (`Id.ts:1392-1393`; 50 calls in 7 files) | closed over the composer's `Vocab` | closed over `RegistryVocab` (one codec). Call sites are unchanged, because every `skos:`, `rdfs:` and similar term they use is in the registry |
| `create`, `compose`, `make` (string), template tag, `.identifier`, `.value`, `string()`, `symbol()` | | unchanged |

`Registry` (`@beep/identity/Registry`) is the lookup every former `.iri` reader uses:

```ts
Registry.iri(curie: Curie<RegistryVocab>): Expand<C, RegistryVocab>          // literal type kept
Registry.namespace(prefix: keyof RegistryVocab): { prefix; iri }             // literal
Registry.expand(curie: string): O.Option<TermIri>                            // closed world
Registry.contract(iri: string): O.Option<Curie<RegistryVocab>>              // exact index
Registry.CurieFromIri: S.Codec<TermIri, string>                              // the one schema codec
Registry.mint(base: Curie | Prefix, ...segments: SegmentValue[]): IRI         // composer segment grammar: bytes equal create(...).iri
Registry.mintEncoded(base, raw: string): IRI                                 // `${base}/${encodeURIComponent(raw)}` (ClaimGate, research library)
Registry.bindingOf(code: string): O.Option<{ term: TermIri; curie }>
Registry.replacementOf(iri: string): O.Option<TermIri>                       // deprecation chain
Registry.view(table: RegistryTable): RegistryView                            // fixture registries for tests and fold
```

`mint` reuses the segment validation that `create` runs, moved to
`internal/Segment.ts`. That is why the practice KG mints
`graphIdentity.create(kind).create(naturalKey).iri`
(`PracticeKg.projections.ts:285`) and
`Registry.mint("practice-kg:" + kind, naturalKey)` produce the same bytes and refuse the
same inputs.

The angle says "typed lookup", which is why `Registry.iri` keeps literal types and
`BEEP_QA_XMP_NAMESPACE_URI` keeps `as const`. A composer-side `$I.term(segment)` reader
is not added: no caller needs it, and fallow would flag it as dead code.

### 6.2 The fold

`fold(composer: BoundComposer, input)` (`Fold.assembly.ts:893`) becomes
`fold(namespace: keyof RegistryVocab, input)`, with `foldWith(view)` for fixture
registries. These lines change:

- `baseIri` and `prefix` come from the namespace (`:909`, `:847-849`);
- the `reservedPrefix` check (`:897-902`) is deleted, because the owned namespace is
  itself a registry row;
- a class IRI is `Registry.bindingOf(identifier)` and no longer reads the annotation
  `iri` (`:131-137`);
- an owned property is `Registry.expand("<prefix>:<field>")` (`:436`).

Each change has a typed refusal (`UnboundClass{identifier}`,
`UndeclaredProperty{field}`) added to the existing `OntologyAssemblyError` codes. The
research library passes `"research-library"` and deletes its duplicate
`Library.schemas` composers (`Library.ontology.ts:34`, `Library.projection.ts:28`,
`Library.views.ts:45`).

### 6.3 Codemods

1. **One-off read migration**:
   `goals/text-knowledge-stack-rebuild/ops/p1/iri-reads-codemod.ts`, registered in
   `opsScripts` and built on `ts-morph`, which is in `node_modules`. It runs while the
   composer still has `.iri`:
   - For each of the 166 reads, it evaluates the composer expression statically. Each one
     is a chain of string-literal `create` calls on a `packages.ts` export.
   - It computes the old IRI and finds the registry row: an equal value for kept rows, or
     a deprecation's `term` for re-minted rows.
   - It writes `Registry.iri("<curie>")`, `Registry.namespace("<prefix>").iri`, or, for a
     template-literal segment, `Registry.mint(...)` or `Registry.mintEncoded(...)`.
   - It reports any site it cannot resolve. A run that reports one is a failed run: fix
     the shard and re-run.
   - It also writes `identity/test/fixtures/p1-retired-iris.json`.
   - It never touches `create(...)` calls.

   The 34 JSDoc lines that read a composer IRI
   (`git grep -P '^\s*\*.*(\$…Id|\$I|composer)(.create(...))*.(iri|curie)'`, 34 lines,
   most in `ClaimDisposition.converters.ts` (6), `packages.ts` (5), `Fold.models.ts` (4)
   and `Id.ts` (4)) are rewritten by hand in the same commit, because docgen compiles
   them.
2. **Permanent module-rename codemod**:
   `bun run beep identity rebind --from <code|code-prefix> --to <code|code-prefix>`.
   This is `RegistryTable.rebind` behind a command. It rewrites `code` columns in the
   shards and regenerates. Use it after a `git mv` of a module or a package rename, for
   example `@beep/provenance` to `@beep/text` in P2. Prefix mode moves every binding
   under a module or package. The gate (section 7) reports a binding whose code id no
   longer has a call site. It names `rebind` as the fix and never rewrites the term.
3. **Mechanical edits**:
   - the `make(..., { authority, prefix })` calls in 3 test files (`Fold.test.ts:19,317,487,626,656`,
     `shared/domain/test/IdentityNamespaces.test.ts`, `cli/test/lint-identity-registry.test.ts`);
   - the 2 `rebase` callers (`identity/test/IriBinding.test.ts`, `ontology/test/Fold.test.ts`);
   - the four multi-parameter `IdentityComposer` type users (map I section 4);
   - `PublicSite.test.ts:153-157` (`$I.iri` becomes `IdentityAuthority`).

---

## 7. The gate: `bun run beep lint identity-registry`, extended

The existing checks (`commands/Lint/IdentityRegistry.ts:70-77`) stay. New
`IdentityRegistryViolationKind` members (a `LiteralKit` in cli):

| Kind | Check |
| --- | --- |
| `registry-shard-invalid` | a shard fails `RegistryShard` decode |
| `registry-conflict` | `RegistryTable.fromShards` returns a `RegistryConflict` (8 cases) |
| `registry-generated-drift` | `Registry.data.ts`, `term-snapshot.json` or the test-runner projection differs from regeneration (`--fix` rewrites them) |
| `term-removed-without-deprecation` | `snapshotViolations(base, head)` reports `TermRemoved` (L0-3) |
| `namespace-prefix-changed`, `deprecation-changed`, `term-revived` | the other `SnapshotViolation` cases |
| `binding-dangling` | a bound code id has no statically visible annotation call site in its package. The scan reuses the source walk at `:96`, plus a ts-morph pass over `const $X = $<Pkg>Id.create("<lit>")` and `$X.annote*("<lit>")` (map I method). Bindings of dynamic identities are refused. Shards with `projection` are checked by the projecting package's own test instead |
| `term-local-multi-segment` | a new internal term (absent from the base snapshot) has a `/` in its local |
| `registry-since-mismatch` | a row new against base has `since` other than the version computed in section 4.2 |

**Base.** The base is `--base <ref>`, by default the merge base with `origin/main`. It is
read with `git show <base>:packages/foundation/modeling/identity/registry/term-snapshot.json`.
That works in hosted blobless clones, which fetch blobs lazily (memory
`hosted-ci-blobless-clone-lazy-fetch`). When the base has no snapshot, as on P1's own
PR, the base is the empty snapshot, so every term counts as an addition. Additions are
free. Removals need a deprecation.

**`--fix`** regenerates only. It never deletes a snapshot entry and never writes a
`Deprecation`. Only `bun run beep identity deprecate <curie> [--replacement <curie>]`
writes one.

**`delete-package`** (`DeletePackage.command.ts:41,355`) refuses a package that owns
bindings and lists them, unless `--deprecate-terms` is passed, which writes
replacement-free deprecations. `create-package` is unchanged, because a new package has
no bindings.

The lint runs in the Verification Matrix row "Schema laws" and in `final-check` (Lint
Policy).

---

## 8. The deprecation record

`Deprecation { term: TermIri, since: ReleaseVersion, replacement: Option<TermIri> }`
(`L0.identity.ts:102-108`, unchanged).

- It is the only record that may remove a term or namespace IRI from the published set.
- Deprecations are append-only. Changing or removing one is a violation.
- A deprecated IRI is never live again (`TermRevived`).
- `replacement`, when present, resolves through the chain to a live term.
- A deprecated term is absent from `RegistryVocab`, so `Registry.expand` returns `None`
  for its CURIE. `Registry.replacementOf(iri)` lets a reader convert an old IRI on read.
  That is the stored-format route, and no stored row is rewritten.
- `since` follows section 4.2.

---

## 9. External namespaces and pins

With one table there is no exemption list: every external namespace in `RegistryVocab`
has a `NamespacePin` in P1. That covers `dcat`, `rdf`, `rdfs`, `owl`, `dcterms`,
`schema`, `skos`, `doco`, `deo`, `fabio`, `cito`, the six new namespaces, and `sh`
(SHACL) and `void` (VoID). The repo speaks SHACL in 11 files through 7 local
`SHACL_NAMESPACE` constants and VoID in 3 files (map R section 1.8), so they are
registered and their constants migrated, as "every namespace the repo speaks" requires.
That makes 19 namespaces. `rdf/test/NamespacePin.test.ts` then states its assertion over
"every namespace whose IRI is not under `IdentityAuthority`" with no allowlist, and the
P5 exit criterion is met early.

`NamespacePin` follows `L6.interchange.ts:34-57`, with one change (decision D8):
`PinnedSource.revision` uses the six typed revision kinds of
`@beep/schema/Conformance` (`Conformance.source.schema.ts:139-348`) instead of a free
`NonEmptyString`. rdf already depends on schema.

| Prefix | IRI | Artifact | License | Curated terms |
| --- | --- | --- | --- | --- |
| `prov` | `http://www.w3.org/ns/prov#` | the dated PROV-O OWL of the REC of 2013-04-30. The manifest's `prov.ttl` row (`explorations/legal-ontology-landscape/assets/manifest.jsonl:15`) is the fallback if the dated form does not resolve (*at acquisition*) | `W3C-20150513` after reading the notice; otherwise `LicenseRef-W3C-Document` | the 33 `Prov.ts` locals plus `specializationOf` |
| `oa` | `http://www.w3.org/ns/oa#` | `http://www.w3.org/ns/oa.ttl`, retrievedSnapshot plus sha256 | as above | the 16 in map R section 5 |
| `nif` | `http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#` (*confirm from the header*) | `NLP2RDF/ontologies@<commit>/nif-core/nif-core.ttl` | `Apache-2.0 OR CC-BY-3.0` (*confirm OR vs AND*) | `Context`, `Sentence`, `Word`, `beginIndex`, `endIndex`, `anchorOf`, `referenceContext`, `isString` |
| `xsd` | `http://www.w3.org/2001/XMLSchema#` | RDF 1.1 Concepts REC 2014-02-25 section 5.1, the RDF-compatible XSD datatypes. The semantic digest rests on the curated list | `W3C-20150513` | the six `Xsd.ts` locals |
| `gufo` | `http://purl.org/nemo/gufo#` | `nemo-ufes/gufo@<commit>/gufo.ttl` 1.0.0 | `CC-BY-4.0` (*confirm*) | the 13 classes of the gUFO typing (`L3.taxonomy.ts:122-145`) plus `mediates` |
| `as` | `http://www.w3.org/ns/activitystreams#`, the form `anno.jsonld` binds and `DocumentAnnotation.ts:37` already loads | AS2 vocabulary REC 2017-05-23 OWL at a commit | `W3C-20150513` | `generator` |
| `skos`, `doco` (and `deo`, `fabio`, `cito`) | existing | SKOS: manifest row `:13` re-fetched. SPAR: the four pins carried from `SparTerms.ts:40-111` | W3C; `CC-BY-4.0` | unchanged lists (map R section 1) |
| `dcat`, `rdf`, `rdfs`, `owl`, `dcterms`, `schema`, `sh`, `void` | existing or literal today | dated W3C artifacts; `schema` pins the vendored v30.0 (`schema-org/src/internal/vocabulary.ts:41`, CC-BY-SA-3.0) | per artifact | the current `CoreVocab` lists; for `sh`, the terms in the 7 constants' uses |

The acquisition target, `targets/PinnedVocabularies.ts`, generalizes `SparTerms.project`
(`SparTerms.ts:113-136`):

- it checks the byte digest;
- it confirms each curated term through a per-format declaration check (Turtle, RDF/XML
  and spec-document strategies; map R section 5);
- it computes a semantic digest over the sorted curated terms;
- it writes the identity shard and the rdf pin in one run.

`VocabTerms.ts` then generates the rdf `*.terms.ts` projections from the registry instead
of `CoreVocab` (`:25`), so the 54 outside uses of the `<PREFIX>_NAMESPACE`/`_TERMS`
constants keep their names. `rdf/src/Vocab/{Prov,Oa,Xsd}.ts` build their named nodes
from registry terms with the same constant names, so the 80 outside lines need no edit
(map R section 7, item 9). The literal cleanups in map R section 7, item 13 land in the
same commit.

---

## 10. Canonical JSON and the minting function

- `@beep/schema/ContentHash`: `ContentHash` (brand over `Sha256PrefixedDigest`,
  `Sha256.ts:132`) and `DomainTag`, as at `L0.digest.ts:49-78`.
- `@beep/jsonc/Mint`: `mintContentHash` (`Effect.fn`, over `JsoncFingerprint.hash`,
  needs `Digest.Digest`) and `mintContentHashResult(digest)` (over `hashResult`), as at
  `L0.digest.ts:122-144`. The preimage is the RFC 8785 form of `[domainTag, ...preimage]`.
- `JsoncFingerprint.canonicalizeSchemaResult(value): Result<string, S.SchemaError>`
  moves the `SchemaError`-channel twin
  (`epistemics/src/internal/CanonicalJson.ts:46-52`) into the owner. The two slice copies
  (`epistemic/domain/src/values/internal/CanonicalJson.ts`,
  `execution-authority/domain/src/internal/CanonicalJson.ts`) are deleted. Their 3
  consumers (`Retention.behavior.ts:12`, `ExecutionRecord.model.ts:33`,
  `GrantSet.model.ts:34`) import the owner. The throwing use at
  `ExecutionRecord.model.ts:543` becomes `Result.getOrThrow` over `canonicalizeResult`.
  The epistemics internal wrapper re-points to the owner twin.
  `@beep/epistemic-domain` gains a `@beep/jsonc` dependency. The bytes do not change, and
  `ExecutionAuthority.test.ts:533` seal goldens plus
  `cli/test/canonical-digest-owner-{differential,replay}.test.ts` prove it.
- Pinned encoders: a "Pinned encoders" section in `jsonc/README.md` names E5, E6 and the
  `LogicalEdgeIdentity` key (map R section 6.3), and an in-source note goes at
  `LogicalEdgeIdentity.model.ts:269`.
- `@beep/jsonc` gains `@noble/hashes` as a dev dependency, already in the catalog through
  epistemics, for the sync twin in L0-2.

---

## 11. Law tests

Effect APIs were checked against `node_modules/effect/src` at 4.1.4: `Arbitrary.schema`
`:423`, `map` `:511`, `filterMap` `:650`, `flatMap` `:718`, `all` `:794`;
`crypto/Digest.ts` `sha256` `:85`, `Digest` `:135`, `layerWebCrypto` `:159`.
`@effect/vitest` `it.prop` and `it.effect.prop` take a Schema or an Arbitrary
(`@effect/vitest/src/index.ts:95-163`).

### L0-1: `identity/test/Curie.laws.test.ts`

Title: `L0-1 expand then contract is the identity on every registered term`.

1. **Exhaustive over the real registry.** For every term of `RegistryVocab`, assert
   `Registry.contract(Registry.expand(c)) = Some(c)` and
   `Registry.expand(Registry.contract(iri)) = Some(iri)`. The table holds a few hundred
   terms (the generator prints the exact count), so a loop over all of them beats
   sampling. Also assert the `CurieFromIri` codec round trip.
2. **`it.prop` over generated registries.** Built with the production constructors:
   - `namespaceArb`: `Arbitrary.all({ prefix: Arbitrary.schema(SafePnPrefix), host: Arbitrary.schema(SafePnPrefix), sep: Arbitrary.schema(S.Literals(["/","#"])) })`
     mapped to `` `https://${host}.example/${prefix}${sep}` `` and decoded through `Namespace`;
   - `localArb`: `Arbitrary.array(Arbitrary.schema(SafePnLocal), { minLength: 1, maxLength: 3 })`
     joined by `/` and decoded through `TermLocal`. `SafePnLocal` carries its own codec
     arbitrary (`PnLocal.ts:169-182`);
   - a nested namespace, whose IRI is a parent namespace IRI plus a segment plus `/`, so
     contraction must be exact, not longest-prefix;
   - shards assembled and passed through `RegistryTable.fromShards` inside
     `Arbitrary.filterMap`, which keeps successes, then `Registry.view`;
   - properties: round trip on every term, and closed world, meaning an unregistered
     local in a registered namespace expands to `None`.
3. **Acceptance examples.** `prov:Activity`, `oa:TextQuoteSelector`, `nif:beginIndex`,
   `xsd:string`, `gufo:Relator` and `as:generator` expand to their IRIs and contract
   back. A multi-segment local (`qa:receipts/accepted/v2`) does the same.

### L0-2: `jsonc/test/ContentHash.laws.test.ts`

Title: `L0-2 equivalent records hash alike under key order and set order`.

- Generator: a local `Probe` schema `{ label, count: S.Int, tags: CanonicalHashSet(S.String), nested: S.Struct(...) }`
  with well-formed string leaves (a local pattern schema with no lone surrogate, decision
  `2026-11-19-p0-law-generators-well-formed-text`). `a` comes from `Arbitrary.schema(Probe)`. `b` is built by encoding
  `a`, re-inserting object keys in a generated permutation at every level, shuffling the
  tag array, then decoding.
- Properties:
  - `S.toEquivalence(Probe)(a, b)`;
  - `mintContentHashResult(sha256)(tag, [encode a]) = …[encode b]`;
  - two `DomainTag`s give different hashes for one preimage, and so does `x/v1` against
    `x/v2`;
  - the result decodes as `ContentHash`;
  - with `it.effect.prop` and `Digest.layerWebCrypto`, `mintContentHash` equals the
    Result twin.

### L0-3: `identity/test/TermStability.test.ts`

1. `L0-3 the published term set changes only with a deprecation record`. The imported
   snapshot equals `RegistryTable.snapshot(table)`, which catches drift. Then, on copies
   of the real table:
   - removing a live term reports exactly `TermRemoved`, and adding its `Deprecation`
     reports nothing;
   - changing a prefix reports `NamespacePrefixChanged`;
   - dropping a deprecation reports `DeprecationRemoved`;
   - re-adding a deprecated IRI reports `TermRevived`.

   `it.prop` over generated additions to a generated table asserts no violation, because
   additions are free.
2. `L0-3 renaming a module changes no published IRI`. This is the SPEC acceptance test,
   run on the real table:
   - `rebind` moves `@beep/repo-cli/commands/Research/Library/Library.schemas/*` to
     `@beep/repo-cli/commands/Research/Catalog/Catalog.schemas/*`;
   - assert `snapshot(before)` equals `snapshot(after)`;
   - build the composers with `make("repo-cli", { registry: before })` and
     `make("repo-cli", { registry: after })`;
   - assert that `S.resolveAnnotations(S.String.pipe(composer.annoteSchema("LibrarySource")))`
     gives the same `iri` and `curie` from the new module under `after` as from the old
     module under `before`;
   - assert that the old module under `after` gives no `iri`. The binding moved, and the
     lint's `binding-dangling` catches a file move without `rebind`.
3. `L0-3 every re-published path-derived IRI has a deprecation naming its replacement`.
   Each old IRI in `fixtures/p1-retired-iris.json` (119) is a deprecation whose
   replacement is live.

The cli end-to-end test (`cli/test/lint-identity-registry.test.ts`, extended) works on a
fixture repo. It `git mv`s a bound module, sees `binding-dangling`, runs
`identity rebind`, and checks that the lint is green and `term-snapshot.json` is
byte-equal.

### Other tests P1 adds

- `test-runner/test/Vitest.errors.terms.test.ts`: each of the 7 annotations equals its
  `RegistryTerms.ts` row. This meets the PLAN exit "`bun run test` in test-runner passes
  with IRIs resolved from the registry".
- `identity/test/VitestErrorsParity.test.ts`, rewritten: the projection equals the
  registry rows (`:21-41` today derives from `$TestUtilsId`).
- `rdf/test/NamespacePin.test.ts`: every external namespace has a pin with an SPDX
  expression and a digest, and every pin prefix is a registry namespace.
- `schema/test/IdentityRegistryParity.test.ts`: the D12 cross-check.

---

## 12. The IRI schema move

Taken as map M plans it, with option 1 (re-home under `$IdentityId`, decision D4):

- `canonicalizeSchemaOrgIri` goes to `rdf/src/Vocab/SchemaOrg.ts`;
- `git mv` to `identity/src/Iri.ts`, with 34 `@beep/utils` calls rewritten, one of them
  `Str.startsWith` at `Iri.ts:783`;
- 19 package and design importers, 6 rdf importers and 56 scratchpad files re-pointed;
- `@beep/documents-domain` drops `@beep/rdf`;
- tests moved;
- coverage, fallow and catalog rows renamed, not added;
- changesets as in section 5.5.

The 18 identities that change carry no IRI under this design, so the move publishes
nothing.

---

## 13. Doctrine and glossary edits (in the P1 PR)

- `standards/architecture/GLOSSARY.md`:
  - **Identity Regime** (new): kinds have compile-checked code ids and, when published,
    a declared term bound by `TermBinding`. Instances have content-addressed ids (domain
    tag plus digest) or are minted under a declared term or namespace.
  - **Term Binding** (new).
  - **Term-Stability Snapshot** (new).
  - **Content Hash** (new): `sha256:` plus 64 hex, a domain-tagged preimage, one brand
    per domain.
  - **Identity Authority** (`:419-428`) rewritten: it is the root of declared internal
    namespaces. It drops "Code derives IRIs from identity composers" and the `@beep/a/b`
    example.
  - **Term** (`:906`) and **Namespace** (`:539`) note instance minting under a term or
    namespace.
- Chapter 16: L0 "Pending P1" removed. Section 4 gains the kept-or-re-minted rule from
  section 5. Section 10 records the 19 pins and SHACL and VoID.
- `identity/README.md`, `rdf/README.md:5,13`, `jsonc/README.md`.
- `rdf/src/SemanticSchemaMetadata/SemanticSchemaMetadata.schema.ts:300-314`: the
  deprecation text says "registry-bound `iri` annotations". Decision D1 names the
  reversed packets `identity-iri-core` and `identity-iri-fold` (map I section 9.9).
- `RetiredIriAuthorities.model.ts:255-260`: the allowlist entry moves to
  `test-runner/src/internal/generated/RegistryTerms.ts` with its reason updated. That is
  a rename, and the count stays 1 (S31).
- Design-module handoff (decision `2026-11-19-p0-design-module-home-and-effect-version`):
  - `ops/design/L0.identity.ts` is deleted, and its `opsScripts` entry with it;
  - `L0.digest.ts` keeps only `WellFormedText`, `Instant` and the activity objects (P2
    to P6) and imports `ContentHash`/`DomainTag` from `@beep/schema/ContentHash`, the
    minter from `@beep/jsonc/Mint` and `CanonicalHashSet` from `@beep/identity/CanonicalSet`;
  - `L1`, `L2`, `L3`, `L5`, `L6` and `generators.ts` re-point their `TermIri`/`Term`
    imports to `@beep/identity/Term` (lines listed by `grep 'from "./L0\.'`:
    `L0.digest.ts:28`, `generators.ts:53-54`, `L2.annotation.ts:34-35`,
    `L3.taxonomy.ts:23-24`, `L5.operations.ts:18-20`);
  - `index.ts:44,46` is updated.
- The ledger rows `L0-1` to `L0-3` go to `green` with file and title.

---

## 14. Edit plan: a three-PR stack, each commit compiling and green

This stays within the packet limit of three open PRs. Every commit runs
`bun run beep quality package-verify` for each package it touches, plus the commands
listed with it.

**PR A: foundation (no registry semantics yet)**

1. `docs(goals): P1 decisions` records D4, D5, D10, D11 and D12 through
   `bun run beep goals decisions add text-knowledge-stack-rebuild ...`.
2. `refactor(identity): move the RFC 3987 IRI schemas from rdf` covers map M section 10,
   steps 2-12 (including scratchpad and documents-domain) and the dead trustgraph script
   (map R, question 12: deleted, since its goal is `wont-do` and it imports a deleted
   module). Proof: map M section 11.
3. `feat(identity,schema,jsonc): canonical set, ContentHash and the minting function`
   adds `identity/src/CanonicalSet.ts`, `schema/src/ContentHash.ts`, `jsonc/src/Mint.ts`,
   `JsoncFingerprint.canonicalizeSchemaResult` and the `L0-2` test. Proof:
   `bun run --filter=@beep/jsonc test -t "L0-2"`.
4. `refactor(epistemic,execution-authority): import canonical JSON from its owner`
   deletes the two copies, re-points the 3 consumers and the epistemics wrapper, and
   adds the pinned-encoder record. Proof: the seal goldens and the
   canonical-digest-owner differential and replay tests.
5. Changesets for A.

**PR B: the table, the codec, the pins (stacked on A)**

6. `feat(identity): Authority module and the Term schemas` adds `Authority.ts`, with
   `PublicEntityId.ts` re-pointed, the only outside importer (map I section 4). It also
   adds `internal/Segment.ts`, `Term.ts` with constructors and `snapshotViolations`,
   unit tests, and the D12 parity test in schema.
7. `feat(repo-cli): identity registry generator` adds `commands/Identity/Registry.ts`
   (`--write`/`--check`) and the shards for the 11 existing external namespaces, with
   values equal to `CoreVocab` and `SparTerms`. It writes `Registry.data.ts` and the
   first `term-snapshot.json`. `Vocab.ts` still exists, so the old and new data coexist
   inside the stack only. Proof: a generator test asserts `RegistryVocab` equals
   `mergeVocab(CoreVocab, SparTerms)` prefix by prefix. That assertion is deleted in
   commit 10.
8. `feat(identity): the Registry codec` adds `Registry.ts`, the `L0-1` test over the 11
   namespaces, and `IdentityRegistry.layer`.
9. `feat(rdf,repo-cli): namespace pins and the pinned-vocabulary target`:
   - adds `rdf/src/NamespacePin.ts` and the `@beep/spdx` dependency;
   - adds `targets/PinnedVocabularies.ts`, absorbing `SparTerms.ts`, and re-points
     `VocabTerms.ts` to the registry;
   - acquires the 8 new namespaces and the 11 re-pins, which writes the shards and pin
     data;
   - adds `rdf/test/NamespacePin.test.ts`;
   - rebuilds `Prov.ts`, `Oa.ts` and `Xsd.ts` from the registry, migrates the
     SHACL and VoID constants, and applies the map R section 7, item 13 literal cleanups;
   - extends `L0-1` with the six acceptance examples.
10. `refactor(identity,ontology,rdf): one CURIE codec`:
    - deletes `CoreVocab`, `SparVocab`, `SemanticFoundationVocab`, `mergeVocab`,
      `VocabEntry`, `VocabRegistry`, `CoreCurieCodec`, `makeCurieCodec`,
      `makeCurieFromIri`, `CurieFromIri` and `internal/generated/SparTerms.ts`;
    - deletes rdf's `Curie` (`Rdf.ts:301`) and ontology's `registryPrefix`
      (`internal/Fold.ts:7-19`);
    - migrates `Fold.*` to `Registry`, keeping the composer signature for now;
    - sets the composer `Vocab` default to `RegistryVocab`;
    - adds `PrefixMap.fromRegistry` in rdf (map R section 7, item 11);
    - rewrites `Vocab.test.ts`, `Curie.test.ts` and `rdf/test/VocabDrift.test.ts`.
11. Changesets for B.

**PR C: bindings and the break (stacked on B)**

12. `feat(identity): internal namespaces with kept values` adds the 13 kept shards of
    section 5.2 and runs the codemod (section 6.3, item 1) over the kept-value reads.
    The values are byte-identical, the composer still has `.iri`, and the existing pins
    prove the bytes (section 5.4).
13. `feat(identity,ontology,repo-cli,test-runner): re-publish the research library and
    the test-runner terms`:
    - adds the `research-library` and `vitest` shards with 23 bindings and 119
      deprecations;
    - runs the codemod over the remaining reads, which writes
      `fixtures/p1-retired-iris.json`;
    - changes `fold` to `fold(namespace)` with `UnboundClass`/`UndeclaredProperty`;
    - migrates the research library;
    - adds the test-runner projection, `Vitest.errors.ts` importing it, the
      `@beep/test-runner/Vitest/*` code ids, and the test-runner test;
    - moves the `RetiredIriAuthorities` allowlist entry.

    Old composer IRIs still exist but no reader is left. Proof: the research-library
    tests and `bun run --filter=@beep/test-runner test`.
14. `feat(identity)!: the composer reads its IRI from the registry`:
    - deletes `toIri`, `toCurie`, `localPathFromIdentity`, `IriFromIdentity`,
      `CurieFromIdentity`, `.iri`, `.curie`, `rebase`, `vocabRegistry` and the binding
      options, and adds `make(base, { registry })`;
    - makes `identityAnnotation` look up bindings;
    - changes `packages.ts:47`;
    - replaces `IdentityEntry.fromComposer` with `fromBinding` and migrates semantic-web;
    - rewrites `IriBinding.test.ts`, `shape-stable.test.ts:428-467`, `PublicSite.test.ts`,
      `Fold.test.ts` and the 34 JSDoc lines;
    - adds `TermStability.test.ts` (L0-3, including the rename test);
    - updates the SemanticSchemaMetadata text.

    Proof: `rg -n 'IriFromIdentity|CurieFromIdentity|\.rebase\(|toIri\(' packages` is
    empty, and `bunx tsrs` passes across the repo through `bun run check`.
15. `feat(repo-cli): term-stability gate, rebind, deprecate` extends the lint (section 7)
    and the `delete-package` guard, and adds the cli e2e rename test.
16. `docs: identity regimes and the P1 doctrine` covers section 13 and the ledger rows
    to green, plus PLAN P1 status and the design-module handoff.
17. Changesets for C and `bun run beep yeet final-check`.

---

## 15. Decisions to record before or with the commits

Each is a file under `decisions/` with a reversal clause.

| Id | Decision | Reversal |
| --- | --- | --- |
| D1 | Registry first. Only IRIs that leave the process are terms, and 23 code ids are bound. Unbound annotations carry no `iri`/`curie`. This reverses `identity-iri-core` and `identity-iri-fold` | bind every annotation identity with today's value, generated, by a decision before P2 |
| D2 | Kept or re-minted: persisted and hand-chosen values are kept; module-path values are re-minted to `<namespace>/<local>`, with 119 deprecations | re-declare the old values as live terms, the deprecation rows inverted |
| D3 | Instances are minted under a declared term or namespace with the composer segment grammar (`Registry.mint`). The `Namespace` record stays prefix and IRI | add a `kind` field to `Namespace` |
| D4 | IRI schemas re-home under `$IdentityId` (map M option 1) | `$RdfId.create("iri")` from `./packages.ts` |
| D5 | `CanonicalHashSet` lives in `@beep/identity` | move it to `@beep/schema` once identity no longer needs it |
| D6 | `TermSnapshot` gains `namespaces`, and `snapshotViolations` replaces `unexplainedRemovals` | drop the field, keep the removals check |
| D7 | `since` is the `@beep/identity` release version, computed from pending changesets | per-owner-package versions |
| D8 | Every external namespace is pinned in P1 (19, SHACL and VoID included). `PinnedSource.revision` uses the Conformance revision kinds. `as:` is `http://`. `xsd` pins RDF 1.1 Concepts. PROV pins the dated PROV-O | pin only the eight named and add an exemption list to the rdf test |
| D9 | The test-runner gets a generated projection, and its code ids are corrected to `@beep/test-runner` | keep the hand-written pins, with parity checked by the registry |
| D10 | Canonical-JSON copies retire through `JsoncFingerprint.canonicalizeSchemaResult`. The epistemic-domain `ContradictionDetection` alias and the epistemics `canonicalDetectionJson*` pair wait for P4 | re-add the slice re-exports |
| D11 | `IdentityAuthority` moves to `@beep/identity/Authority` | move it back and inline the authority in the generated data |
| D12 | The version and literal cross-check lives in `@beep/schema/test`, because an identity dev dependency on schema is a workspace cycle | add a schema-free copy of `SemanticVersion` to the identity tests |

---

## 16. Risks

1. **Type-check cost.**
   - What: `Curie<RegistryVocab>` becomes a union of every registered term (335 external
     terms in the curated lists of section 9, plus SHACL, VoID and the internal
     namespaces), and with
     reverse markers `Predicate<RegistryVocab>` (`Vocab.ts:464`) doubles it. The 50 `key`
     calls and 3,300 annotation sites resolve the binding conditional.
   - Measure: run `bun run --filter=@beep/identity check` and
     `--filter=@beep/repo-cli check` before and after commits 10 and 14.
   - Fallback: per-namespace `Curie` unions, with `key` typed over a prefix argument.
2. **Acquisition.**
   - What: 19 pins need network fetches, licenses read from notices, and three form
     choices (PROV artifact, `as:` scheme, `xsd` document). A wrong license id fails
     `SpdxExpression.FromString`.
   - Handling: the target refuses rather than guesses, and `LicenseRef-*` is the
     fallback recorded in D8.
3. **Computing `since` from changesets.** Frontmatter parsing is new code, and two
   lanes that change the registry at once can compute different versions.
   - Rule: the lint compares against the base, so the second lane to merge re-runs
     `--fix` after merging `main`, which the base-conflict rule already requires.
4. **Snapshot merge conflicts.** Sorted JSON with one IRI per line keeps conflicts to
   adjacent-line additions. `--fix` resolves them by regeneration.
5. **The static binding scan.**
   - What: it cannot see dynamic identities (8 dynamic `create` calls and the factories,
     map I section 5).
   - Mitigation: binding them is refused by rule, and none of the 23 is dynamic.
6. **Fold refusals.** A future fold caller with unbound classes fails at runtime with
   `UnboundClass`. There is one production caller today, and its test covers it.
7. **Research-library consumers outside the repo** lose their old IRIs. The deprecation
   rows give the map. No in-repo reader exists, so no conversion function ships (no
   dead code).
8. **Coverage of new files.** New files need 100% hosted coverage, not a baseline
   (memory `session-resolve-shipped-and-new-file-coverage`). `Term.ts`, `Registry.ts`,
   `CanonicalSet.ts`, `Mint.ts`, `NamespacePin.ts` and the generator need complete tests.
   The plan's tests target that, and the generator gets fixture-shard tests.
9. **S31.** Inventories change only by rename: the IRI-move rows, the allowlist entry,
   and the fallow ceiling at `.fallowrc.jsonc:594`. Re-run the census S31 grep at each PR
   head.
10. **Workspace cycles.** Identity must not gain `@beep/schema`, `@beep/utils` or
    `@beep/rdf` even as dev dependencies (D12, map M section 4).
    `rg -n 'from "@beep/(utils|schema|jsonc|rdf)' packages/foundation/modeling/identity`
    stays empty.
11. **Size of PR C, commit 14.** It is the one breaking commit, touching about 35 files
    of reads plus tests and JSDoc. Commits 12 and 13 move every value first, so commit 14
    deletes code and changes no published bytes beyond what commit 13 already moved.
12. **Docs and JSDoc examples** with `import.meta.vitest` run in docgen. The 34 lines plus
    the `Id.ts:63-73` and `Fold.assembly.ts:880-887` examples are rewritten. Run
    `bun run docgen:local`.

---

## 17. Left to later phases on purpose

- `WellFormedText`, `Instant`, `ActivityPin`, `ActivityStart`, `ActivityId` and
  `mintActivityId` (`L0.digest.ts:34-198`) stay in the design module until P2 (text) and
  P6 (operations). The domain brands (`OccurrenceId`, `AnnotationId`, `RunEntityId`,
  `ClaimId`) arrive with their layers.
- gUFO class typing (`L3.taxonomy.ts:122-145`) goes in `@beep/ontology` in P5. P1
  registers and pins only the `gufo:` terms.
- The OA and NIF adapters and the use of `as:generator` come in P3.
- The ontology seed move to the law-practice asset pack is P5. P1 routes those IRIs
  through `Registry.mint` with unchanged bytes.
- The epistemic-domain `canonicalDetectionJson` re-export and the epistemics alias pair
  wait for P4 (D10).
- The schema.org vocabulary table and its `FOREIGN_PREFIXES` (72) retire with
  `@beep/schema-org` in P7.
- Candidate vocabularies LKIF, ELI and OntoLex `lexicog` (rq3 decision) are not
  registered.
- Lab-only foreign namespaces stay out of the registry: ciops
  `https://oip.law/ontology/ci-ops#` (`apps/labs/ciops/src/projection/Turtle.ts:15-20`)
  and the asset-loaded Free Law Project publication vocabulary
  (`law-practice/server/src/internal/Citation/SemanticVocabulary.ts:69,109`). P7
  re-checks them.
- The bare `Sha256Hex` primitive (2,370 lines) is out of scope, as the L0 homes decision
  rules.
- A conversion helper for instance IRIs under a deprecated base waits until a reader of
  old research-library files exists.

---

## 18. Answers to the open questions of the three maps

- **Map I:**
  1. Terms are the IRIs that leave the process (section 1).
  2. Re-published means section 5.2 and 5.3.
  3. Unbound annotations carry no IRI, and the fold refuses them.
  4. A property is a declared term of the fold namespace.
  5. `identifier` is unchanged.
  6. Instance prefixes are terms or namespaces that `Registry.mint` mints under.
  7. Literal types are kept through the generated `const` data.
  8. The snapshot comes from the shards. The binding scan is static, and dynamic
     bindings are refused.
  9. Shared module identities and free segments keep their names.
  10. `IdentityRegistry` stays as the runtime view, with `layer` over the table.
- **Map R:**
  1. All external namespaces are pinned.
  2. SHACL and VoID are registered.
  3. Typed revision kinds.
  4. `W3C-20150513` after reading each notice, otherwise `LicenseRef-*`.
  5. Resolved by the split ruling.
  6. `@beep/schema/ContentHash`.
  7. The third alias waits for P4.
  8. The owner gets the SchemaError twin.
  9. `as:` is `http://`.
  10. `xsd` pins RDF 1.1 Concepts.
  11. PROV pins the dated PROV-O.
  12. The trustgraph script is deleted.
- **Map M:** option 1, re-home.

---

## 19. Verification for P1

```sh
bun run beep identity registry --check
bun run beep lint identity-registry            # includes the term-stability gate against origin/main
rg -n "L0-1|L0-3" packages/foundation/modeling/identity/test
rg -n "L0-2" packages/foundation/modeling/jsonc/test
bun run --filter=@beep/test-runner test
rg -n 'IriFromIdentity|CurieFromIdentity|toIri\(|\.rebase\(' packages apps      # expect none
git grep -n 'ns/repo-cli/commands' -- ':!packages/foundation/modeling/identity/registry' ':!**/fixtures/p1-retired-iris.json' ':!goals' ':!explorations'   # expect none
git grep -n 'ns/test-utils/' -- packages apps ':!packages/foundation/modeling/identity/registry' ':!**/fixtures/p1-retired-iris.json'   # expect none
rg -n 'from "@beep/(utils|schema|jsonc|rdf)' packages/foundation/modeling/identity  # expect none
jq '.dependencies | keys' packages/foundation/modeling/identity/package.json         # ["effect"]
test ! -e packages/epistemic/domain/src/values/internal/CanonicalJson.ts
test ! -e packages/execution-authority/domain/src/internal/CanonicalJson.ts
bun run beep quality package-verify @beep/identity
bun run beep quality package-verify @beep/jsonc
bun run beep quality package-verify @beep/schema
bun run beep quality package-verify @beep/rdf
bun run beep quality package-verify @beep/ontology
bun run beep quality package-verify @beep/semantic-web
bun run beep quality package-verify @beep/test-runner
bun run beep lint schema-catalog && bun run beep lint schema-first && bun run beep lint laws --package packages/foundation/modeling/identity
bunx tsrs -p goals/tsconfig.ops.json --noEmit
bunx tsrs -p goals/text-knowledge-stack-rebuild/ops/design/tsconfig.json --noEmit
bun run docgen:local
bun run beep yeet final-check
```
