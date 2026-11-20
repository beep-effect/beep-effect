# P1 design, minimal surface: declared terms, one digest (2026-11-19)

> **Status.** Not chosen. The P1 base is the registry-first design
> (`2026-11-19-p1-design-registry-first.md`), taken with grafts from this design and its
> sibling; its "Rulings applied" section and the `2026-11-19-p1-*` decision files say
> which parts of this text were adopted. This file is kept as the record of the angle.

Design for phase P1 ("L0 identity: declared terms, one digest"). Angle: the
smallest mechanism that makes a published IRI independent of code paths, with
the fewest new concepts, the least churn at the composer call sites, and
generated data in place of hand-kept data.

Binding inputs: `SPEC.md` Objective 5, Constraints "Identity", acceptance
bullet "L0"; `PLAN.md` row P1; decisions
`2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc`,
`2026-11-19-p0-rq3-external-vocabularies-as-adapters-confirmed`,
`2026-11-19-p0-activity-id-minted-at-start`,
`2026-11-19-p0-items4-6-9-annotation-document-shape`, `2026-11-19-p0-law-generators-well-formed-text`,
`2026-11-19-p0-design-module-home-and-effect-version`, `2026-11-19-p0-l0-split-by-dependency`; ledger rows `L0-1` to `L0-3`
(`research/law-test-plan.md:7-9`); `ops/design/L0.identity.ts`,
`ops/design/L0.digest.ts`; census section g; design facts sections 5 and 6;
`standards/architecture/16-knowledge-stack.md` "L0 · Identity" (`:61-106`),
section 4 (`:398-434`) and section 10 (`:541-568`); the three P1 maps
(`research/2026-11-19-p1-map-identity-derivation.md`, `-registries-and-namespaces.md`,
`-iri-move.md`).

Base: worktree head `c8e55ae87b5`. Its package source is identical to `3dbdd1e46ba`,
where the maps measured. `effect@4.1.4`. New counts in this file were measured at
`c8e55ae87b5`, and each says how it was taken.

## 0. The design in one paragraph

Composers keep naming code and stop naming anything published. P1 deletes
`.iri`, `.curie`, `rebase` and the authority binding from `@beep/identity`'s
composers, so the 21,434 path-derived annotation IRIs (map 1, section 5) cease to
exist instead of being snapshotted. Every IRI that leaves a process (map 1,
section 6) comes from the one registry instead, in one of three forms:

- a declared term of a registered namespace, read through the existing typed CURIE
  codec, with its literal type kept;
- an instance IRI minted under a registered namespace by a namespace minter that has
  the composer's `.create(...).iri` shape, so call sites change only their root;
- a fold vocabulary, whose class and property IRIs are the fold namespace plus the
  class name or field key, never the module path.

Values are re-published unchanged wherever they are persisted or already free of a
module path. The one path-shaped published vocabulary, the research library, is
re-minted under `research-library/`, with a generated `Deprecation` per old IRI.
The term snapshot, the binding rows and the test-runner's pin file are generated.
`bun run beep lint identity-registry` regenerates and checks them, and compares the
snapshot with the snapshot at the merge base.

Concepts added beyond the P0 design module: one namespace minter and one `release`
field on the snapshot. Concepts removed: composer IRIs, `rebase`, the composer
vocabulary binding, `VocabEntry`, `VocabRegistry`, `SemanticFoundationVocab`,
`SparVocab`, the rdf `Curie` schema and ontology `registryPrefix`.

## 1. Facts this design rests on

| Fact | Evidence |
| --- | --- |
| A composer's IRI is `authority + identity tail`; validation throws but never transforms a segment | `identity/src/Id.ts:1680-1696` (`toIri`, `toCurie`), `:1719-1727` (`validateSegment`) |
| One-argument `make(base)` already builds unbound composers with no IRI or CURIE, and the annotation helpers already omit `iri`/`curie` for them | `Id.ts:2173-2213`, `:1810-1827`, `:849-858`; `ontology/src/Fold.assembly.ts:57-58` |
| The only generic reader of the annotation `iri`/`curie` keys is the fold | `git grep -n -P '"(iri|curie)"'` over non-test `*.ts` (scratchpad and `.repos` excluded) finds `Fold.assembly.ts:136-137` and identity itself; effect's JSON Schema and OpenAPI generators use `identifier`, not `iri` (map 1, section 6) |
| Composer `.iri`/`.curie` reads outside identity: 174 lines in 36 files, 131 lines in 21 `src` files, and 83 of those 131 sit in the two ontology seed files (`Vocabulary.seed.ts` 72, `SemanticFoundation.seed.ts` 11) | grep over the 3,110 files that import `@beep/identity`, `/packages` or `/Id`, with resource-field reads (`resource.iri`, `node.iri`, ontology Session modules, PracticeKg row fields) and `CoreVocab.<p>.iri` excluded. This is an upper bound. After commit C8 the compiler lists every remaining read exactly |
| `.key("<curie>")` borrowed-predicate annotations: 50 lines | `git grep -c -P '\$[A-Za-z0-9]+\.key\('`; 28 in `ontology/src/Ontology.models.ts`, 7 in `cli/.../Library.schemas.ts` |
| Research library ontology: 16 classes and 141 predicate uses: 87 distinct owned property IRIs, plus 7 borrowed uses. Base `https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas`, prefix `beep` | measured by running `assembleLibraryOntology()` (`cli/.../Library.ontology.ts:111-117`) under `bun` at `c8e55ae87b5` |
| The committed QA skill contract embeds 14 beep IRIs in a digested JSON (`sha256 6a41c162…b371`) | `packages/tooling/tool/cli/skills/qa-inventory-judge/SKILL.md:2` |
| Every workspace package is private and `privatePackages.version` is `false`, so package versions never move: `@beep/identity` has been `0.1.1` since PR #177 | `identity/package.json:3,6`; `.changeset/config.json` (`"privatePackages": { "version": false }`); `identity/CHANGELOG.md:3-7` |
| `@beep/schema` depends on `@beep/identity`, so identity cannot take `@beep/schema` even as a dev dependency without a workspace cycle (the same reason map 3 forbids `@beep/utils`) | design facts section 5; map 3, section 4 |
| `@beep/repo-cli`, `@beep/repo-utils` and `@beep/scratchpad` are changeset-ignored | `.changeset/config.json` `ignore` |

The last three facts correct the P0 inputs. Section 15 collects the corrections.

## 2. The core decision: composers name code, the registry names what is published

### 2.1 What is deleted, and why deletion beats a snapshot of everything

P0 design facts section 6 inferred that "term stability needs a snapshot of all
derived IRIs, because every `$I` call site publishes one". That holds only while
composers derive IRIs. Today a `$I` call site writes an IRI into an in-process
annotation that only the fold reads (section 1). Snapshotting 21,434 IRIs would
freeze the module path into 21,434 published strings, which is the opposite of
the objective. Deleting the derivation removes the problem at its source and costs
zero edits at the 3,303 `create` chains and the roughly 21,000 annotation calls.

After P1:

- `IdentityComposer<Value>` has `identifier`, `value`, `slug`, `string()`,
  `symbol()`, `create`, `compose`, `make`, the template tag, the `annote*` and
  `class` helpers, and `key`. It has no `iri`, `curie`, `rebase` or `vocabRegistry`.
- An annotation record is `{ schemaId, identifier, title }` plus the caller's
  extras. `identifier` stays the code path. It names JSON Schema `$defs`, OpenAPI
  components and `Symbol.for` ids (map 1, section 6), and none of those is a
  published IRI.
- `make` keeps only the one-argument form. `packages.ts:47` becomes
  `Identity.make("beep").$BeepId`.

### 2.2 The three forms a published beep IRI takes

| Form | Mechanism | Snapshot | Today's examples |
| --- | --- | --- | --- |
| Declared term | `RegistryCodec.decode("beep:epistemic/Claim")`: the existing `makeCurieCodec` (`identity/src/Curie.ts:391`) over the one registry. The argument is type-checked against the declared term list, and the result has the literal IRI type | listed, from the registry | SHACL class and path IRIs, in-toto predicate types, skill-contract ids, document annotation types, the identity RDF predicates, the test-runner's 7 |
| Instance under a namespace | `Registry.minter("practice-kg").create(kind).create(key).iri`, the same `.create(...).iri` shape and segment validation as a composer, rooted at a registered namespace IRI | the namespace IRI is listed; instances are not terms and are not listed | practice KG nodes, claim subjects, XMP namespace, seed concepts, lab projections, research library records |
| Fold vocabulary | `fold(namespace, input)`: class IRI `namespace.iri + className`, property IRI `namespace.iri + fieldKey` | listed, generated by running each published fold | research library T-Box and SHACL |

A class name or field key is part of a schema's published shape: renaming one
already changes the wire. A module path is not part of that shape. The fold
therefore uses the first and never the second.

## 3. Schemas, and where each one lives

### 3.1 `packages/foundation/modeling/identity/src/Iri.ts` (moved)

The RFC 3987 schemas `IRI`, `IRIReference`, `RelativeIRIReference` and
`AbsoluteIRI` move exactly as map 3 specifies (sections 2-4 and 10). The move uses
`git mv`, `$IdentityId.create("Iri")`, the 34 `@beep/utils` calls rewritten to
`effect/Array` and `effect/String` (one becomes `pipe(identifier, Str.startsWith("Relative"))`),
and `canonicalizeSchemaOrgIri` stays in `rdf/src/Vocab/SchemaOrg.ts`. Binding rule:
`Id.ts` and `packages.ts` never import `Iri.ts` or `Term.ts`.

### 3.2 `identity/src/Term.ts` (new; the design module `L0.identity.ts` lands here)

This is the P0 design module with three changes:

- the snapshot encodes sorted arrays, because `S.HashSet` encodes in iteration
  order and the snapshot is a committed file;
- the snapshot gains `bindings` and `release`;
- `since` means the vocabulary release, not the package version (section 15).

```ts
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { IRI } from "./Iri.ts";
import { $IdentityId } from "./packages.ts";
import { SafePnLocal, SafePnPrefix } from "./PnLocal.ts";

const $I = $IdentityId.create("Term");

export const TermIri = IRI.pipe(S.brand("TermIri"), $I.annoteSchema("TermIri", { description: "A registry-declared IRI under a registered namespace." }));
export type TermIri = typeof TermIri.Type;

// CodeId and ReleaseVersion: verbatim from ops/design/L0.identity.ts:38-69.

export class Namespace extends S.Opaque<Namespace, { readonly brand: unique symbol }>()(
  S.Struct({ prefix: SafePnPrefix, iri: IRI }).pipe($I.annoteSchema("Namespace", { description: "A registry namespace: prefix and IRI." }))
) {}
export class Term extends S.Opaque<Term, { readonly brand: unique symbol }>()(
  S.Struct({ iri: TermIri, namespace: SafePnPrefix, local: SafePnLocal }).pipe($I.annoteSchema("Term", { description: "A declared term." }))
) {}
export class TermBinding extends S.Opaque<TermBinding, { readonly brand: unique symbol }>()(
  S.Struct({ code: CodeId, term: TermIri, since: ReleaseVersion }).pipe($I.annoteSchema("TermBinding", { description: "A code identity bound to the term it publishes." }))
) {}
export class Deprecation extends S.Opaque<Deprecation, { readonly brand: unique symbol }>()(
  S.Struct({ term: TermIri, since: ReleaseVersion, replacement: S.OptionFromOptionalKey(TermIri) })
    .pipe($I.annoteSchema("Deprecation", { description: "The one record that may remove a published IRI." }))
) {}

/** Strictly ascending by a string key: sorted and duplicate-free in one check. */
const SortedBy = <Item extends S.Top>(item: Item, key: (value: Item["Type"]) => string, name: string) =>
  S.Array(item).check(
    S.makeFilter(
      (values: ReadonlyArray<Item["Type"]>) =>
        A.every(A.drop(values, 1), (value, index) => key(values[index]) < key(value)) || `${name} must be strictly ascending`,
      $I.annote(`${name}Sorted`, { description: `${name} entries are strictly ascending and unique.` })
    )
  );

export class TermSnapshot extends S.Opaque<TermSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("term-snapshot/v1"),
    release: ReleaseVersion,                       // vocabulary release, see section 7.4
    terms: SortedBy(TermIri, (iri) => iri, "Terms"), // every published beep IRI, namespace IRIs included
    bindings: SortedBy(TermBinding, (b) => `${b.code}\u0000${b.term}`, "Bindings"),
    deprecations: SortedBy(Deprecation, (d) => d.term, "Deprecations"),
  }).pipe($I.annoteSchema("TermSnapshot", { description: "The published beep IRI set (L0-3)." }))
) {}

/** L0-3: IRIs `previous` published that `next` neither publishes nor deprecates. */
export const unexplainedRemovals: {
  (next: TermSnapshot): (previous: TermSnapshot) => HashSet.HashSet<TermIri>;
  (previous: TermSnapshot, next: TermSnapshot): HashSet.HashSet<TermIri>;
} = dual(2, (previous: TermSnapshot, next: TermSnapshot) => {
  const deprecated = HashSet.fromIterable(A.map(next.deprecations, (d) => d.term));
  return HashSet.filter(
    HashSet.difference(HashSet.fromIterable(previous.terms), HashSet.fromIterable(next.terms)),
    (term) => !HashSet.has(deprecated, term)
  );
});
```

The `SortedBy` filter is a sketch. Validate `A.every`'s index argument against
`node_modules/effect/src/Array.ts` before writing it (memory note: `A.reduce`
passes the index). `Order` is imported for the writer's `A.sort`. Literal domains
stay `S.Literals` under the bottom-package exception in the split decision.

### 3.3 `identity/src/Registry.ts` (new): the one registry

```ts
// Hand-declared beep vocabulary: the only hand-kept term data. The first content is generated by the C6 codemod (section 5.3).
const BeepVocab = {
  beep: { iri: IdentityAuthority, terms: [/* the 35 terms of section 4.2 */] },
  library: { iri: `${IdentityAuthority}research-library/`, terms: ["effectiveCategory", "catalogIndex"] },
  "library-view": { iri: `${IdentityAuthority}research-library/view/`, terms: [] },
  "practice-kg": { iri: `${IdentityAuthority}practice-kg/`, terms: [] },
  "epistemic-claim": { iri: `${IdentityAuthority}epistemic/claim/`, terms: [] },
  "qa-xmp": { iri: `${IdentityAuthority}qa/1.0/`, terms: [] },
  "semantic-foundation": { iri: `${IdentityAuthority}ontology/semantic-foundation/`, terms: [] },
  "legal-document": { iri: `${IdentityAuthority}documents/taxonomy/legal-document#`, terms: [] },
  semantica: { iri: `${IdentityAuthority}semantica/`, terms: [] },
  lejeune: { iri: `${IdentityAuthority}lejeune/ontology/`, terms: [] },
} satisfies VocabShape;

export const RegistryVocab = pipe(CoreVocab, mergeVocab(SparTerms), mergeVocab(ExternalTerms), mergeVocab(BeepVocab)); // pipe from effect/Function
export type RegistryVocab = typeof RegistryVocab;
export const RegistryCodec = makeCurieCodec(RegistryVocab);          // replaces CoreCurieCodec
export const namespaces: ReadonlyArray<Namespace>;                    // decoded rows of RegistryVocab
export const terms: ReadonlyArray<Term>;                              // decoded rows of every declared term
export const namespaceOf: <P extends keyof RegistryVocab & string>(prefix: P) => Namespace;
export const minter: <P extends keyof RegistryVocab & string>(prefix: P) => IriMinter<RegistryVocab[P]["iri"]>;
export const DeclaredBindings: ReadonlyArray<TermBinding>;           // the 7 test-runner rows (section 9)
export { Deprecations } from "./Deprecations.ts";                    // authored records, section 8
```

- `CoreVocab` stays the seven-prefix base value (`Vocab.ts:130`). `mergeVocab` is
  dual (`Vocab.ts:523-529`).
- `SparTerms` is the generated module that already exists
  (`identity/src/internal/generated/SparTerms.ts`).
- `ExternalTerms` is a new generated module,
  `identity/src/internal/generated/ExternalTerms.ts`, holding `prov`, `oa`, `nif`,
  `xsd`, `gufo` and `as`.
- `sh` (SHACL) and `void` are registered too, because they are spoken
  (map 2, section 1.8: 13 lines in 11 files and 4 lines in 3 files). They are added
  to `CoreVocab` with their curated terms.
- The `beep` prefix and its IRI are unchanged, so `beep:` CURIEs are unchanged.

`IriMinter` is the one new value type, in `identity/src/Registry.ts`:

```ts
export interface IriMinter<Iri extends string> {
  readonly iri: Iri;
  create<const Segment extends TString.NonEmpty>(segment: SegmentValue<Segment>): IriMinter<Joined<Iri, Segment>>;
}
```

`Joined` appends directly after a trailing `/` or `#` and inserts `/` otherwise.
`create` runs the same `SegmentSchema` validation as a composer. To share it, move
`validateSegment` from `Id.ts:1719` to `identity/src/internal/segment.ts`. So an
instance IRI minted by the minter is byte-identical to the composer chain it
replaces: `…/practice-kg/` + `kind` + `/` + `key` equals `toIri(@beep/practice-kg/kind/key)`.

Defaults move to the registry: `expand`, `contract`, `expandOption`,
`contractOption` and `expandPredicate` default to `RegistryVocab` instead of
`CoreVocab` (`Curie.ts:113-370`). `CurieFromIri` (`Curie.ts:454`, 0 consumers)
closes over `RegistryVocab`. `IdentityComposer.key(term)` types `term` as
`Predicate<RegistryVocab>`; `CoreVocab` is a subset, so the 50 `key` call sites
compile unchanged.

Deleted from identity:

- `VocabEntry` and `VocabRegistry` (`Vocab.ts:63,90`; 0 consumers outside identity,
  map 1 section 4), replaced by `Namespace` and `Term`;
- `SemanticFoundationVocab` (`Vocab.ts:548`; 0 outside consumers): its 4 terms move
  into `beep`;
- `SparVocab` (`Vocab.ts:590`; 1 test consumer, `rdf/test/VocabDrift.test.ts:1`,
  which moves to `RegistryVocab`);
- `CoreCurieCodec` (0 consumers);
- the binding types `IdentityBinding`, `IriFromIdentity`, `CurieFromIdentity`,
  `BoundComposerIri` and `BoundComposerCurie`, and `toIri`/`toCurie`.

`IdentityRegistry.ts` keeps its service and `layerLocal`. `IdentityEntry` becomes
`{ identity: CodeId, iri: TermIri, curie: S.String, fibers }`, and
`IdentityEntry.fromComposer` (`IdentityRegistry.ts:133`) becomes
`IdentityEntry.fromBinding(binding, fibers)`, which contracts the term through
`RegistryCodec`. The registry service is the runtime view of the binding rows, and
no production layer is added, because no caller needs one (map 1, section 3).

### 3.4 `packages/foundation/modeling/rdf/src/NamespacePin.ts` (new)

`PinnedSource { location: IRI, revision }` and `NamespacePin { prefix, source, license: SpdxExpression.FromString, version, digest: Sha256PrefixedDigest, semanticDigest: Sha256PrefixedDigest }`,
as in `ops/design/L6.interchange.ts:34-50`, with two changes:

- `semanticDigest` is added. It is the existing `SparTerms` second digest over the
  sorted curated terms (`cli/.../SyncDataToTs/targets/SparTerms.ts:22-38`). The xsd
  pin has no ontology to check, so its semantic digest is the only check that binds
  it (map 2, section 8, question 10).
- `revision` reuses the six typed revision kinds of `@beep/schema/Conformance`
  (`Conformance.source.schema.ts:139-348`). It does not stay a free string.

The pin table is generated data, `rdf/src/Vocab/generated/namespace-pins.data.json`,
written by the acquisition target. It covers:

- the six new namespaces;
- `skos` and `doco`, as decided;
- `deo`, `fabio` and `cito`, whose pins already sit in the SPAR generator
  (`SparTerms.ts:40-111`) and carry over at no cost.

`@beep/rdf` gains `@beep/spdx`, with no cycle (map 2, section 5). `rdf/src/Vocab/{Prov,Oa,Xsd}.ts`
re-export `*_NAMESPACE` from the generated term modules, following the `Doco.ts:16`
pattern, and build their named nodes from registry terms. The constant names stay,
so the 80 outside uses need no edit.

### 3.5 Digest: `@beep/schema` brands, one minter in `@beep/jsonc`

| Symbol | Home | Source |
| --- | --- | --- |
| `ContentHash` (brand over `Sha256PrefixedDigest`), `DomainTag` | `packages/foundation/modeling/schema/src/ContentHash.ts` | `ops/design/L0.digest.ts:49-78` |
| `CanonicalHashSet`, `sortedMembers` | `packages/foundation/modeling/schema/src/CanonicalHashSet.ts` | `L0.digest.ts:102-120` (decision `2026-11-19-p0-items4-6-9-annotation-document-shape`, set-codec amendment) |
| `mintContentHash` (effectful, `Digest.Digest`), `mintContentHashResult` (pure, caller `JsoncDigest`) | `packages/foundation/modeling/jsonc/src/ContentHash.ts` | `L0.digest.ts:122-144`: the canonical bytes of `[domainTag, ...preimage]` from `JsoncFingerprint.hash` and `hashResult` (`JsoncFingerprint.ts:702,749`) |

That is one canonical-JSON implementation, the existing `JsoncFingerprint`, with no
second encoder. The array framing `[tag, ...preimage]` is a new declared format.
It is not the `${version}\n${canonical}` framing of the stored execution-authority
seals, which stay as they are (map 2, section 6.1).

## 4. Declared IRIs for today's identifiers: what "re-published" means

### 4.1 Rule R

Each IRI published today keeps its value as a declared registry IRI. The one
exception is an IRI whose value spells a module path below the package (map 1's
`path` and `path-partial` classes). Such an IRI is re-minted once into a path-free
namespace, and the first snapshot records a `Deprecation` with a `replacement` for
it.

The reasons:

1. The stored-format law forbids rewriting the persisted ones: the practice KG
   bundle, stored SHACL reports and recorded XMP (map 1, section 7). The committed
   QA contract digest (section 1) would also change.
2. A hand-chosen free segment stops being derived the moment the registry declares
   it. Its stability is then enforced by the snapshot. The test-runner's
   `test-utils/…` IRIs already show this: they outlived their package.
3. A value that spells a file path invites re-derivation and misreads as a code
   location. The only published one is the research library.

"Re-published, not pinned" (SPEC Objective 5) is therefore a statement about the
source of each value: it comes from the registry and is never copied beside a
derivation. Most values do not change.

### 4.2 Artifact table

| Artifact | Published IRIs | Before → after | Consequence | Changeset |
| --- | --- | --- | --- | --- |
| Research library T-Box and SHACL (`ontology/research-library{,.shacl}.ttl` in a portable library, `Library.paths.ts:39,53`) | 16 classes, 87 owned properties, 2 projection predicates (`Library.projection.ts:225,266`), instance IRIs | `…/ns/repo-cli/commands/Research/Library/Library.schemas/<X>` → `…/ns/research-library/<X>`. The views prefix `v:` `…/Library.views/term/` → `…/research-library/view/`. Prefix `library` (already the Turtle prefix, `Library.ontology.ts:378`) | A library folder keeps its old TTL until the next `publish`, which rewrites both files atomically. The A-Box is a projection of `library.json` and regenerates. 105 deprecations: 103 terms plus the two old namespace bases | none: `@beep/repo-cli` is ignored; the decision file records it |
| Ontology fold (`Fold.assembly.ts:893`) | whatever a caller folds | `fold(composer: BoundComposer, …)` → `fold(namespace: Namespace, …)` | API break; the one `src` caller is `Library.ontology.ts:112` | `@beep/ontology` major |
| Fold test pins (`ontology/test/Fold.test.ts:295,744`, `.rebase` at `:659`) | test only | fixture `Namespace` values | none | — |
| ClaimGate SHACL and stored dispositions (`ClaimGate.service.ts:39-41`) | `beep:epistemic/Claim`, `beep:epistemic/hasEvidenceQuote`, the `epistemic-claim` minter | unchanged | stored rows untouched; golden equality test | `@beep/epistemic-use-cases` patch |
| Practice KG DuckDB (`PracticeKg.projections.ts:79,285`) | `practice-kg/<kind>/<key>` | unchanged (minter root swap) | golden equality test | `@beep/law-practice-server` patch |
| XMP in QA recordings (`ExiftoolConfig.ts:60`) | `qa/1.0/` | unchanged; `BEEP_QA_XMP_NAMESPACE_URI = RegistryVocab["qa-xmp"].iri` keeps its literal type | none | `@beep/exiftool` patch |
| in-toto predicate types, skill contract (`skill-contract/src/Recovery.ts:340`, `EvidenceReceipt.ts:385`, `GateCertificate.ts:335`; `cli/.../Qa/JudgeContract.ts:64-72,770-773,841-844,942`; `CitedArtifactExistsGate.ts:31`) | 3 skill-contract, 5 `qa/evidence/*/v2`, 5 `qa/receipts/*/v2`, `contracts/qa-inventory/v1`, 2 `schemas/qa-judge-*/v1`, `qa/verifiers/judge-settlement/v1` | unchanged | the `SKILL.md` digest is unchanged; a test re-renders it | `@beep/skill-contract` patch |
| JSON-LD document annotations (`rdf/src/Adapters/DocumentAnnotation.ts:20-21`) | `beep:document/pattern`, `beep:document/citation` | unchanged | none | inside the `@beep/rdf` major |
| Documents taxonomy (`documents/domain/.../Taxonomy.seed.ts:14-15,42`) | scheme `beep:documents/taxonomy/legal-document`; JSON-LD context prefix `beep` → `…/legal-document#` | IRIs unchanged. The context key is renamed `legal-document`, which removes the redefinition of the registry's `beep` prefix the census flagged | compact JSON-LD changes its prefix label only | `@beep/documents-domain` patch |
| Ontology seeds and classification editions (`Vocabulary.seed.ts`, `SemanticFoundation.seed.ts`, `Classification.models.ts:378-423`, `TaxonomyLoader.ts:134-138`) | concept and scheme IRIs under `ontology/semantic-foundation/` | unchanged (minter root swap; the prefix check reads `IdentityAuthority`) | none | inside the `@beep/ontology` major |
| Labs (`semantica/src/layers/RdfProjectionLive.ts:26`, gold fixture `g-projection.json`; `lejeune-bolt-workbench/src/runtime/Projections.ts:31`) | `semantica/`, `lejeune/ontology/` | unchanged | the gold fixture is unchanged | none (apps) |
| Identity RDF binding (`semantic-web/src/identity/IdentityRdfBinding.ts:27-28`) | `beep:semantic-web/identity/{identifier,curie}` | unchanged; entries come from bindings | the `IdentityEntry` type changes | `@beep/semantic-web` major |
| Test-runner records (`test-runner/src/Vitest.errors.ts:16-151`) | 7 `beep:test-utils/Vitest/*` | unchanged; read from a generated file (section 9) | none | `@beep/test-runner` patch |
| Annotation records of every annotated schema | `iri`, `curie` (21,434) | removed | in-process only; the fold no longer reads them | inside the `@beep/identity` major (section 4.4) |
| Composer and registry API | `.iri`, `.curie`, `rebase`, `vocabRegistry`, binding overloads of `make`; the identity schemas and codecs deleted in section 3.3 | removed | compile errors list every reader | `@beep/identity` major |
| JSON Schema `$defs`, OpenAPI components | identifiers | unchanged | `docgen/schema.json` unchanged | — |

The 35 declared `beep` terms are:

- `epistemic/Claim`, `epistemic/hasEvidenceQuote`;
- `document/pattern`, `document/citation`;
- `documents/taxonomy/legal-document`;
- `semantic-web/identity/identifier`, `semantic-web/identity/curie`;
- the 3 skill-contract evidence types;
- 5 `qa/evidence/*/v2`, 5 `qa/receipts/*/v2`;
- `contracts/qa-inventory/v1`;
- 2 `schemas/qa-judge-*/v1`;
- `qa/verifiers/judge-settlement/v1`;
- the 4 semantic-foundation terms of `Vocab.ts:551-556`;
- the 7 test-runner terms.

`JudgeContract.ts:770` mints `receipts/${name}/v2` from a function argument. Its
five call sites (`:851-856`) become five declared CURIEs, and the function takes a
`Curie<RegistryVocab>`.

### 4.3 The first snapshot is honest about the past

Commit C6 freezes `identity/test/fixtures/term-snapshot.base.json`. It is the
published set at the P1 base, computed once with the old derivation from the
section 4.2 sources: the old research library fold, every term and namespace read
site, and the 7 test-runner IRIs. `L0-3` asserts
`unexplainedRemovals(base, committed) = ∅`. So every IRI published before P1 is
either still published with the same bytes or deprecated with its replacement. That
is the "module-derived IRIs included" clause of the L0-3 row, applied to history.

### 4.4 Major changesets

`@beep/identity`, `@beep/rdf` (IRI schemas and rdf `Curie` removed, constants
re-sourced), `@beep/ontology` and `@beep/semantic-web` are majors. `@beep/schema`
and `@beep/jsonc` are minors (new modules). The patches are listed in section 4.2,
plus `@beep/documents-domain` (rdf dependency dropped), `@beep/ontology-client`,
`@beep/epistemic-domain` and `@beep/execution-authority-domain` (copies retired).
`@beep/repo-cli` and `@beep/scratchpad` are ignored.

Ruling to record: losing the identity-written `iri`/`curie` annotation keys is
`@beep/identity`'s breaking change. It changes no encoded or decoded shape in the
schemas' own packages, so those packages take the internal-dependency patch rather
than about 200 majors.

## 5. Composer API change and the codemod

### 5.1 Call-site churn by surface

| Surface | Sites (measured) | Rewrite | How |
| --- | --- | --- | --- |
| `$<Pkg>Id.create("…")` chains | 3,303 lines / 3,153 files (map 1, section 5) | none | — |
| `annote`, `annoteSchema`, `annoteKey`, `annoteClass`, `annoteError`, `annoteHttp`, `class`, `make`, template tag | 21,434 IRI-bearing identifiers; 3,032 template tags | none (the record shrinks) | — |
| `key("<curie>")` | 50 lines | none (types against `RegistryVocab`) | — |
| Declared-term reads (`$EpistemicId.create("Claim").iri` and similar) | 35 terms at about 30 `src` lines plus their tests | `RegistryCodec.decode("beep:epistemic/Claim")` | codemod C6 |
| Instance reads (`$X.create(a).create(b).iri`) | the rest of the 131 `src` lines; 83 of them in two seed files share 4 root bindings | change the root binding only: `const graphIdentity = Registry.minter("practice-kg")` | codemod C6 |
| `fold($I, …)` and `$I.iri` in the research library | `Library.ontology.ts:112,287,340,378`; `Library.projection.ts:28-29,159,225,255,266,269,275`; `Library.views.ts:44-48,434` | `namespaceOf("library")`, `minter("library")`, `minter("library-view")` | hand, C7 |
| `rebase` | `ontology/test/Fold.test.ts:659`, `identity/test/IriBinding.test.ts:80` | fixture `Namespace` | hand, C7 and C8 |
| `IdentityEntry.fromComposer` | semantic-web tests and the epistemic e2e test (map 1, section 4) | `fromBinding` | hand, C8 |
| IRI importers (`@beep/rdf`, `@beep/rdf/Iri`) | 19 package and goals files, 6 rdf `src` files, 56 scratchpad files (map 3, section 5) | specifier rewrite; 20 import splits | one-off ts-morph script, map 3 section 10 |
| Generators that print `create("<path>")` (`codegen-kit` `postProcess.ts:625,733`, `ModelFirstTemplates.ts:233,282,360,645`) | — | none: their output names code only | — |

### 5.2 Completeness

C8 deletes the members. After that, `tsrs` fails at every remaining composer IRI
read in packages, apps, scratchpad and goals ops. That error list is the exact
work list, and an empty `bunx tsrs -p tsconfig.packages.json` is the proof. No
string-scanning lint is added: once the member is gone, no code can read it.

### 5.3 The C6 codemod

A one-off `bun` script runs outside the tracked tree, so no Python and no
committed script. It loads every `src` and test module that reads a vocabulary or
root composer's `.iri`. Map 1's scanner class lists them: vocabulary composers,
root chains, and `$SemanticaId`/`$SemanticWebId`/`$SkillContractId` reads. For each
site the script:

1. evaluates the old value;
2. classifies the site as a term (no trailing `/` and no runtime segment) or an
   instance root;
3. writes the term into `BeepVocab.beep.terms` or the namespace row;
4. rewrites the site.

The script's output table goes into the commit message as the receipt. Its
invariant, checked by the golden test of section 10.4: old value equals new value
for every site.

## 6. The fold over a namespace

- `fold(namespace: Namespace, input: OntologyFoldInput)`. `BoundComposer`
  (`Fold.assembly.ts:57-72`) is deleted.
- Vocabulary: `RegistryVocab`. The `composer.vocabRegistry ?? CoreVocab` fallback at
  `:894-897` goes.
- Class identity: the `identifier` annotation is required, as today. The local name
  is the last `/` segment of the identifier. Then `iri = namespace.iri + local` and
  `curie = namespace.prefix + ":" + local`. `classIdentity` (`:130-149`) stops
  reading the `iri` and `curie` annotation keys.
- Owned property: `namespace.iri + field`, replacing `appendLocal(composer.iri, field)`
  at `:436`. Borrowed predicates through `key()` are unchanged.
- New refusals, as `OntologyAssemblyError` reasons:
  - `namespaceConflict`: the prefix is registered with a different IRI. This replaces
    `reservedPrefix` at `:899-903`.
  - `duplicateLocal`: two classes, or a class and a field, share a local name in the
    namespace.
- Base IRI: `namespace.iri`, replacing `:909`.

A module rename changes `identifier` and therefore neither the class local name nor
anything else the fold emits. Section 10.3 tests exactly that.

## 7. The snapshot: format, location, generator and gate

### 7.1 Format and location

Location: `packages/foundation/modeling/identity/data/term-snapshot.json`. That is
identity-owned data outside `src`, following the `data/conformance/sources.json`
precedent of `md`, `html`, `lexical` and `pandoc-ast`. It is the encoded side of
`TermSnapshot`: sorted arrays, two-space JSON, a trailing newline.

```json
{
  "version": "term-snapshot/v1",
  "release": "1.0.0",
  "terms": ["https://beep-effect.com/ns/", "https://beep-effect.com/ns/contracts/qa-inventory/v1", "…"],
  "bindings": [
    { "code": "@beep/repo-cli/commands/Research/Library/Library.schemas/Source", "term": "https://beep-effect.com/ns/research-library/Source", "since": "1.0.0" },
    { "code": "@beep/test-utils/Vitest/TestHang", "term": "https://beep-effect.com/ns/test-utils/Vitest/TestHang", "since": "1.0.0" }
  ],
  "deprecations": [
    { "term": "https://beep-effect.com/ns/repo-cli/commands/Research/Library/Library.schemas/Source", "since": "1.0.0", "replacement": "https://beep-effect.com/ns/research-library/Source" }
  ]
}
```

- `terms`: every published beep IRI. That is the declared terms of the beep
  namespaces, the beep namespace IRIs, and the terms of each published fold.
  External terms are not listed: their stability is the `NamespacePin`'s job.
- `bindings`:
  - one row per folded class (class identifier → class term);
  - one row per folded field (`<class identifier>.<field>`, the `annoteKey`
    identifier form → property term), so one property term may have several rows;
  - the 7 declared test-runner rows.

  First-snapshot sizes, from the measured counts: terms = 35 declared + 10
  namespaces + 103 research-library fold terms (+2 declared projection terms, unless
  the fold already emits them; the writer deduplicates); bindings = 16 + 141 + 7.

### 7.2 Generator

Location: `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry/TermSnapshot.ts`.
It is a pure function from sources to a `TermSnapshot`. Its sources:

- `RegistryVocab`, `DeclaredBindings` and `Deprecations` from `@beep/identity/Registry`;
- `PublishedVocabularies`, a list in the lint of
  `{ namespace, assemble }` rows. Today the list has one row:
  `assembleLibraryOntology`. P3's kind registry adds a row; nothing else does.

`--fix` writes the snapshot. It also writes the test-runner pin file (section 9) and
keeps every existing row's `since`. It refuses to write a snapshot that the base
check of section 7.3 would reject, so `--fix` can never launder a removal.

### 7.3 Gate: `bun run beep lint identity-registry`

New violation kinds, added beside `IdentityRegistry.ts:70-77`:

| Kind | Check |
| --- | --- |
| `term-snapshot-drift` | the regenerated snapshot differs from the committed file |
| `term-removed-without-deprecation` | `unexplainedRemovals(base, committed)` is non-empty. `base` is the snapshot at `git merge-base HEAD origin/main` (`--base <ref>` overrides it), and is empty when the file is absent at base. A changed term counts as a removal plus an addition |
| `deprecation-removed` | a deprecation present at base is missing at head (deprecations are append-only) |
| `term-declared-twice` | one IRI is declared in two namespaces, or one binding row appears twice |
| `term-outside-authority` | a snapshot term is not under `IdentityAuthority` |
| `test-runner-terms-drift` | `test-runner/src/internal/generated/RegistryTerms.ts` differs from its regeneration |

Precedent for reading the merge base: `docgen:local` bounds itself to
`origin/main...HEAD` (AGENTS.md "Docgen"). The lint already runs in the Schema laws
lane (SPEC Verification Matrix, `SPEC.md:485`) and in the create-package contract.

### 7.4 `release` and `since`

All packages are private, with `privatePackages.version: false` (section 1), so a
package version cannot date a binding: `@beep/identity` would stamp `0.1.1` forever.
The snapshot therefore carries its own vocabulary release:

- it starts at `1.0.0`;
- the writer bumps the minor when terms are added and the major when a deprecation is
  added;
- the `since` of a new binding or deprecation is the release that first records it,
  and later regenerations keep it.

`ReleaseVersion` and the `TermBinding`/`Deprecation` shapes are unchanged; only the
meaning of `since` is pinned. The glossary records it.

## 8. The deprecation record

- Shape: `Deprecation { term, since, replacement? }` (section 3.2).
- Authoring: `identity/src/Deprecations.ts` exports an array of
  `Deprecation.make(...)` values. It is the only hand-authored record besides the
  beep term declarations. A deprecation is a deliberate act, so it is written, not
  generated. Bulk deprecations from a re-mint are generated once by the commit that
  re-mints, as C7 does for the research library's 105 rows, and are frozen data
  afterwards.
- Rules, all enforced by the gate:
  - a published IRI leaves the set only with a deprecation;
  - a deprecation is never removed;
  - `replacement`, when present, is itself published at head.
- `delete-package` no longer drops IRIs silently, because composers publish nothing.
  A deleted package that hosted a fold vocabulary trips
  `term-removed-without-deprecation`.

## 9. The test-runner's IRIs, re-published from the registry

`@beep/test-runner` cannot import identity (map 1, section 6).

- The registry declares the 7 terms in `beep` and the 7 bindings in
  `DeclaredBindings`. Both keep their exact current values and code ids.
- `--fix` generates `packages/tooling/test-kit/test-runner/src/internal/generated/RegistryTerms.ts`:
  a `const` record keyed by the code identifier, holding `{ iri, curie }` and a
  "generated from @beep/identity" header.
- `Vitest.errors.ts` reads `iri` and `curie` from that record instead of spelling
  them. Its `identifier` and `schemaId` pins stay: they name code, and P1 binds terms.
- `identity/test/VitestErrorsParity.test.ts` stops re-deriving from `$TestUtilsId`
  (`:23-41`). It asserts that each test-runner annotation's `(identifier, iri, curie)`
  equals a `DeclaredBindings` row contracted through `RegistryCodec`.
- The `public-origin-literal` allowlist entry (`RetiredIriAuthorities.model.ts:255-260`)
  is re-pointed from `Vitest.errors.ts` to the generated file: a rename, so S31 is
  neutral.
- PLAN exit: `bun run test` in `packages/tooling/test-kit/test-runner` passes, with
  every IRI in the package coming from the generated registry file.

## 10. Law tests and their generators

All `law` rows use `it.prop` or `it.effect.prop` from `@effect/vitest` with
`effect/Arbitrary` (`schema`, `Constant`, `array`, `map`, `filter`, `flatMap` and
`all`, validated in `node_modules/effect/src/Arbitrary.ts:423-794`). Generators
produce well-formed text only (decision `2026-11-19-p0-law-generators-well-formed-text`).

### 10.1 `L0-1` in `identity/test/Curie.laws.test.ts`

Title: `L0-1 expand then contract is the identity on every registered term`.

- Generator: `Arbitrary.schema(S.Literals(registeredCuries))`, where
  `registeredCuries` is derived from `Registry.terms`. Because the domain is finite,
  the same test also iterates every term exhaustively.
- Properties:
  - `contract(expand(c)) = c` and `expand(contract(i)) = i` over `RegistryVocab`;
  - each of `prov`, `oa`, `nif`, `xsd`, `gufo` and `as` has at least one term, and
    each round-trips: the acceptance clause;
  - closed world: for `Arbitrary.filter(Arbitrary.schema(IRI), notRegistered)`,
    `contractOption` is `None`;
  - registry well-formedness: no prefix twice, no term IRI in two namespaces (the
    `contract` reducer at `Curie.ts:121` picks one namespace, so a double declaration
    would break the law).
- Companion, `L0-1` side: `rdf/test/NamespacePin.test.ts` asserts that every pin has
  an SPDX license and both digests, and that the eight decided prefixes plus `deo`,
  `fabio` and `cito` have pins.

### 10.2 `L0-2` in `jsonc/test/ContentHash.laws.test.ts`

Title: `L0-2 equivalent records hash alike under key order and set order`.

- Fixture preimage schema, in the test:
  `{ name: WellFormed, members: CanonicalHashSet(WellFormed), counts: S.Record(WellFormed, S.Int) }`.
  `WellFormed` is `S.String` filtered by the well-formedness regex of `L0.digest.ts:35-44`.
- Generators:
  - key order: `Arbitrary.flatMap(record, r => Arbitrary.map(Arbitrary.array(Arbitrary.schema(S.Finite), { minLength: n, maxLength: n }), keys => permuteKeys(r, keys)))`;
  - set order: two `HashSet`s from two generated permutations of one array;
  - domain separation: `Arbitrary.all({ a: tag, b: tag })` filtered to `a ≠ b`.
- Properties:
  - equal hashes under key permutation and under set permutation through the
    `CanonicalHashSet` encoding;
  - distinct tags give distinct hashes for one preimage;
  - `mintContentHashResult(sha256)` from `test/support/Sha256.ts` equals
    `mintContentHash` under `Digest.layerWebCrypto` (`effect/crypto/Digest.ts:159`);
  - every output decodes as `ContentHash`.
- Golden vector: one fixed preimage gives one fixed `sha256:…` string, which pins
  the `[tag, ...preimage]` framing.

### 10.3 `L0-3` in `identity/test/TermStability.test.ts`, plus the rename test

Title: `L0-3 the published term set changes only with a deprecation record`.

- Law over generated pairs:
  - generator: `Arbitrary.flatMap` from a generated previous snapshot to
    `(next, removed, deprecated)`, with `removed ⊆ previous.terms` and
    `deprecated ⊆ removed` chosen by generated boolean masks;
  - properties: `unexplainedRemovals(previous, next) = removed \ deprecated`;
    additions never count; an empty diff gives the empty set.
- Acceptance over the committed file. The committed snapshot decodes through
  `TermSnapshot`, and:
  - every registry declared term and beep namespace IRI is in `terms`;
  - every binding's term is in `terms`;
  - every deprecation replacement is in `terms`;
  - `unexplainedRemovals(base fixture, committed) = ∅` (section 4.3).
- Identity-level rename law, titled
  `L0-3 a composer publishes nothing a module rename could change`:
  - generator: `Arbitrary.schema(CodeId)` pairs `(old, new)`;
  - property: annotation records made under the two composers differ only in
    `identifier`, `schemaId` and the composer-derived title, and carry no `iri` or
    `curie` key.
- End-to-end rename test, in
  `packages/tooling/tool/cli/test/lint-identity-registry.term-snapshot.test.ts`,
  titled `L0-3 a test renames a module and proves no published IRI changes`:
  - re-annotate every folded research-library schema with a renamed identifier
    (`schema.annotate({ identifier, schemaId })`, which is exactly what a module
    rename changes): module rename
    `…/commands/Research/Library/Library.schemas/X` → `…/research/library/model/X`,
    and package rename `@beep/repo-cli` → `@beep/research-library`;
  - run the real generator;
  - assert that `terms` and `deprecations` are byte-equal and that `bindings` differ
    only in `code`.

### 10.4 Golden tests for unchanged persisted IRIs

These live in each owning package's test directory, beside existing tests:

- the practice KG `graphIri` for each `KgNodeKind`;
- the ClaimGate class, path and subject prefix;
- `BEEP_QA_XMP_NAMESPACE_URI`, with its literal type (`expectTypeOf`);
- the QA `SKILL.md` re-rendered byte-equal, so its digest `6a41c162…` is unchanged;
- the semantica gold fixture unchanged.

Each expected value is read from the base fixture, so "unchanged" is measured
against the pre-P1 derivation, not restated by hand.

## 11. One canonical JSON

- The owner stays `@beep/jsonc/JsoncFingerprint`, and the minting function builds
  on it (section 3.5).
- Retire the two slice-local copies:
  - delete `packages/epistemic/domain/src/values/internal/CanonicalJson.ts` and
    `packages/execution-authority/domain/src/internal/CanonicalJson.ts`;
  - re-point their 3 consumers to the module the copies alias,
    `@beep/epistemics/ContradictionDetection` (`canonicalDetectionJson`,
    `canonicalDetectionJsonResult`, `ContradictionDetection.behavior.ts:42,67`):
    `Retention.behavior.ts:12`, `ExecutionRecord.model.ts:33` and
    `GrantSet.model.ts:34`.
  - That adds no API and no dependency (both packages already import epistemics),
    and keeps the bytes and the `S.SchemaError` channel. The seal goldens
    (`execution-authority/domain/test/ExecutionAuthority.test.ts:533`) and the
    differential tests are the proof.
- The third alias (`epistemic/domain/.../ContradictionDetection.behavior.ts:32`) and
  the epistemics public pair stay. Census row E1 classes them as owner-backed, and
  the census facet covers only the copies.
- Pinned encoders are recorded, not changed: E5 PartyKey v1, E6 eyecite parity, and
  the `LogicalEdgeIdentity` key. The record is a section of
  `packages/foundation/modeling/jsonc/README.md` naming each with its
  `biome-ignore` anchor, plus one in-source comment at
  `LogicalEdgeIdentity.model.ts:269`, which no rule marks.

## 12. Doctrine and glossary edits (same PR)

`standards/architecture/GLOSSARY.md`:

- Rewrite "Identity Authority" (`:419-428`). Its sentence "code derives IRIs from
  identity composers" becomes: composers name code; the registry declares published
  IRIs under the authority.
- Add "Identity Regime": kinds have registry-declared terms bound to code; instances
  have content-addressed identity; minting joins them; this follows chapter 16
  section 4.
- Add "Term Binding", "Term Snapshot" (with `release` and `since`), "Namespace
  Minter" and "Content Hash" (which includes the domain tag).
- Amend "Term" (`:906`) to name the snapshot gate.

`16-knowledge-stack.md`: flip the P1 "Pending" markers. `ActivityId` moves from
"Pending P1" to "Pending P3" (section 14).

A P1 decision file names the reversed doctrine of `identity-iri-core` and
`identity-iri-fold`, both completed-retained (map 1, section 9.9). The explicit
address fields of `SemanticSchemaMetadata` stay deprecated
(`rdf/src/SemanticSchemaMetadata/SemanticSchemaMetadata.schema.ts:300-314`), because
the fold rule of section 6 needs no per-schema address.

## 13. Edit plan

### 13.1 Ordered commits

Each commit compiles, passes the touched packages' `quality package-verify`, and
carries its own changesets. PR shape: PR-1 is C2, PR-2 is C3, PR-3 is C1 and C4-C11
stacked on PR-1. That keeps the packet within three open PRs.

1. **C1 Decisions.** Record these through `bun run beep goals decisions add`:
   - the minimal-surface design (composers unbound, Rule R, fold rule);
   - `since` as vocabulary release;
   - the schema cross-check moved to `@beep/schema` tests;
   - the reversal of the `identity-iri-*` doctrine;
   - `ActivityId` deferred to P3.
2. **C2 IRI move** (PR-1): map 3, section 10, steps 1-12, including the 18
   code-identity re-home decision, the scratchpad migration, the
   `@beep/documents-domain` dependency drop and the regenerated catalogs.
   Changesets: rdf major, identity minor, three patches.
3. **C3 Digest** (PR-2):
   - `schema/src/ContentHash.ts` and `CanonicalHashSet.ts`; `jsonc/src/ContentHash.ts`;
   - `L0-2`;
   - retire the two copies (section 11); the jsonc README pinned-encoder section;
   - design-module handoff for the moved `L0.digest.ts` symbols: re-point `L1`,
     `L3`, `L5`, `L6` and `generators.ts`. `L0.digest.ts` keeps `WellFormedText`,
     `Instant`, `ActivityId`, `ActivityPin` and `ActivityStartFields`.
4. **C4 External namespaces.**
   - Add the `external-vocab` acquisition target in
     `cli/src/commands/SyncDataToTs/targets/`. It generalizes `SparTerms.ts`: one
     declaration-check strategy per format (Turtle, RDF/XML, spec-only xsd), byte and
     semantic digests, and the license.
   - Generated outputs: `identity/src/internal/generated/ExternalTerms.ts`,
     `rdf/src/Vocab/generated/{Prov,Oa,Nif,Xsd,Gufo,As}.terms.ts`, and
     `namespace-pins.data.json`.
   - `rdf/src/NamespacePin.ts` and its test; the `@beep/spdx` dependency;
     `Prov`/`Oa`/`Xsd` re-sourced.
   - It needs network acquisition and the confirmations listed in map 2, section 5
     (prov artifact, `as:` scheme, licenses).
5. **C5 One registry.**
   - `identity/src/Term.ts` and `Registry.ts`; `sh` and `void` in `CoreVocab`; the
     codec defaults moved to `RegistryVocab`.
   - Delete `VocabEntry`, `VocabRegistry`, `SemanticFoundationVocab`, `SparVocab`,
     `CoreCurieCodec`, the rdf `Curie` (`Rdf.ts:301`) and ontology `registryPrefix`
     (`internal/Fold.ts:7-19`). Migrate `Fold.models.ts:85,124,188` and
     `Fold.assembly.ts:280`.
   - Literal cleanup (map 2, section 7, item 13) and the 7 local `SHACL_NAMESPACE`
     constants.
   - `L0-1`.
   - The `@beep/schema` test cross-checking `ReleaseVersion` and identity's
     `S.Literals` domains.
   - Design-module handoff for `L0.identity.ts`: delete the file, re-point its five
     importers to `@beep/identity/Term`, and update the index, `generators.ts` and
     `opsScripts`.
6. **C6 Re-publish declared and instance IRIs.**
   - Freeze the base fixture first, from the parent commit.
   - Run the codemod (section 5.3).
   - `BeepVocab` terms and namespaces; `minter`; every non-fold read site migrated
     (`src` and tests).
   - The golden tests of section 10.4.
   - The `legal-document` JSON-LD context key.
7. **C7 Fold over a namespace.**
   - Section 6, and the research library on `library` and `library-view`.
   - `Deprecations.ts`: 105 rows, generated by diffing the base fixture against the
     new fold, matched by local name.
   - Fold tests re-pinned. Changeset: `@beep/ontology` major.
8. **C8 Unbind composers.**
   - Delete the IRI members and binding machinery; `packages.ts:47`; annotation
     records shrink; `key()` types against `RegistryVocab`.
   - `IdentityEntry.fromBinding`, with semantic-web and its tests.
   - Rewrite `IriBinding.test.ts` as registry tests. Update
     `shape-stable.test.ts:428-467` with the recorded reason.
   - Re-point `PublicSite.test.ts:153-157` and `Exiftool.models.test.ts:268-271`.
   - Glossary "Identity Authority". Changeset: `@beep/identity` major.
   - `tsrs` over the whole workspace is the completeness proof (section 5.2).
9. **C9 Snapshot and gate.**
   - `TermSnapshot.ts` generator; the new lint kinds; the base comparison;
     `identity/data/term-snapshot.json`.
   - `L0-3` and the cli rename test.
10. **C10 Test-runner.**
    - `DeclaredBindings`; the generated `RegistryTerms.ts`; `Vitest.errors.ts`
      re-pointed; `VitestErrorsParity` rewritten.
    - The allowlist re-point; the snapshot regenerated to add 7 bindings (additions
      only).
11. **C11 Packet and doctrine.**
    - The glossary entries of section 12; the chapter 16 flips.
    - Ledger rows `L0-1` to `L0-3` set to `green`; census section g dispositions set
      to done.
    - `PLAN.md` status through a checkpoint decision; the
      `OPPORTUNITIES.md` receipts.

### 13.2 Verification at the PR-3 head

- Package proofs:
  - `bun run beep quality package-verify` for identity, rdf, ontology, jsonc,
    schema, semantic-web, test-runner, documents-domain, ontology-client,
    epistemic-use-cases, law-practice-server, exiftool and skill-contract;
  - `bun run --filter=@beep/scratchpad check`.
- Lints and gates:
  - `bun run beep lint identity-registry`, `bun run beep lint schema-first` and
    `bun run beep lint schema-catalog`;
  - `bunx tsrs -p goals/tsconfig.ops.json --noEmit`;
  - `bun run beep yeet final-check`.
- Ledger lookup: `rg -n "L0-[123]" packages/foundation/modeling/{identity,jsonc}/test`.

## 14. Risks

1. **Hidden dynamic readers of the annotation `iri` or `curie` key.** The compiler
   cannot see `annotations["iri"]`. The grep found only `Fold.assembly.ts:136-137`.
   Mitigations: `shape-stable.test.ts` asserts that no identity record carries the
   keys, and the C8 commit re-runs the grep.
2. **Byte drift in persisted IRIs.** This would hit the practice KG, SHACL reports,
   XMP and the `SKILL.md` digest. Mitigation: the golden tests of section 10.4 read
   the expected values from the base fixture. The minter shares the composer's
   segment validation and join rule (section 3.3).
3. **External pins need network acquisition and judgement.** The open items are the
   prov artifact, the `http` or `https` form of `as:`, the xsd target, and SPDX ids
   for the W3C notices (map 2, section 8). C4 cannot be finished offline. Stop
   condition: no namespace is registered without its pin. If a pin cannot be
   confirmed, P1 holds and a decision records it.
4. **Type-check cost of `RegistryVocab`.** It is a union of about 400 literal
   CURIEs, behind `key()` and the codec. Measure `tsrs` time for identity and ontology
   before and after C5. The fallback is a per-namespace codec type, which changes
   no runtime.
5. **The merge-base gate on shallow or offline clones.** Mitigations: `--base <ref>`
   and a clear error when the base cannot be read. Hosted CI clones are blobless and
   fetch lazily (memory note), so `git show <base>:<path>` works there. A base that
   cannot be read is reported as unknown, never as clean.
6. **Research-library consumers outside the repo.** Existing portable libraries keep
   the old TTL until republished. The deprecations publish the old-to-new map. Check
   before C7 that no stored library record holds a class IRI:
   `rg -n "Library.schemas/" <library>/library.json` against a sample library, and
   `rg` of `Library.schemas.ts` for IRI-typed fields.
7. **Fold local-name collisions** once the class local name comes from the last
   identifier segment. `duplicateLocal` refuses them. The research library's 16
   class names are distinct, as measured by the fold run.
8. **The major-versus-patch ruling for annotation shrinkage** (section 4.4) may be
   contested. It is recorded in C1 and reversible by adding majors.
9. **Workspace cycles.**
   - identity must not take `@beep/schema`, `@beep/utils`, `@beep/jsonc` or
     `@beep/rdf`. Verify with
     `rg -n 'from "@beep/(utils|schema|jsonc|rdf|data)' packages/foundation/modeling/identity`.
   - The lint writes into test-runner `src`. That is a generated cross-package
     write, like the writes of `create-package` into `packages.ts`, and not a
     dependency edge.
10. **S31 totals.**
    - The `public-origin-literal` allowlist entry and the moved `Iri.ts` rows move by
      rename.
    - Retiring `registryPrefix` and the rdf `Curie` removes entries.
    - No new inventory is introduced: the snapshot is data that the gate checks, not
      an exception list.

## 15. Corrections to the P0 inputs found by this design

1. **`since` cannot be a package version.** Every package is private and
   `privatePackages.version: false`, so `@beep/identity` has been `0.1.1` since
   PR #177. The sketch's "package version that first published the binding"
   (`L0.identity.ts:93`) would stamp a constant. Fix: the vocabulary `release` of
   section 7.4.
2. **The cross-check cannot run in identity's tests.** The split decision's "the
   registry test cross-checks both against the `@beep/schema` schemas as a test
   dependency" needs identity to take `@beep/schema` as a dev dependency, which
   closes a workspace cycle (`schema → identity`). The cross-check moves to
   `@beep/schema`'s tests, which may import identity.
3. **`TermSnapshot` with `S.HashSet` fields** (`L0.identity.ts:111-117`) encodes in
   iteration order, so a committed snapshot would not be deterministic. Fix: sorted
   arrays with a strict-order check (section 3.2), in line with the set-codec amendment of decision
   `2026-11-19-p0-items4-6-9-annotation-document-shape`.
4. **Design facts section 6 says composer IRIs must all be snapshotted.** That holds
   only while composers derive them. This design deletes the derivation (section 2.1).

## 16. Left to later phases on purpose

| Item | Phase | Reason |
| --- | --- | --- |
| `identifier` stays a code path (JSON Schema `$defs`, OpenAPI names, `Symbol.for`), including the test-runner's `@beep/test-utils/…` identifiers | — | P1's scope is published IRIs. Identifiers are code names, and changing them would rewrite committed `docgen/schema.json` `$defs` for no stability gain |
| Edition stability of seed concept IRIs (`ontology/semantic-foundation/…`) and their move to the asset pack | P5 (`L3-4`) | P1 only re-roots their minter, which leaves the bytes unchanged |
| Term bindings for annotation kinds | P3 | one `PublishedVocabularies` row, or a declared-binding row, per kind registry |
| `ActivityId`, `ActivityPin`, `ActivityStartFields`, `WellFormedText`, `Instant` | P2 (`WellFormedText`), P3 (`ActivityId` for the import activity), P4 and P6 | first consumers. Chapter 16's "Pending P1" for `ActivityId` becomes "Pending P3" in C11 |
| Pins for `dcat`, `rdf`, `rdfs`, `owl`, `dcterms`, `schema`, `sh` and `void` | P5 | P1 pins the eight the decision names plus the three SPAR pins that already exist. The P5 exit test widens to every external namespace |
| The epistemics public canonical-JSON alias pair and the epistemic-domain re-export | — | census E1 classes them as owner-backed, so they are not copies |
| A production `IdentityRegistry` layer | when a caller exists | there is no caller today (map 1, section 3) |
| LKIF, ELI and OntoLex `lexicog` | when a decision names a consumer | decision `2026-11-19-p0-rq3-external-vocabularies-as-adapters-confirmed` |
| The dead trustgraph script (`goals/trustgraph-doc-ontology/scripts/build-artifacts.ts:18`) | same-hour small PR | it lies outside P1's files. Fixing it where found means its own PR, not this one |
