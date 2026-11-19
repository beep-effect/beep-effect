# P0 design facts from the live tree (2026-11-19)

Read-only census for the eleven P0 design items in `SPEC.md` "Resolved Questions
and P0 Design Items" and section 4 of `research/2026-11-08-rebuild-report.md`.
Checkout: branch `goals/text-knowledge-stack-rebuild-p0-design` at `f9982f3b5e6`.
Every path is repo-relative. Every line number is from this checkout. Effect
facts are read from the installed `effect@4.1.4` (`node_modules/effect/src`);
`.repos/effect` (HEAD `4d9e66f559`, also `4.1.4`) has the same set of exported
names in `Schema.ts`, at shifted line numbers.

## 1. `cm1:` citation mention identity

**Format.** `packages/law-practice/domain/src/values/Citation/Citation.identity.ts:35-41`:

```ts
export const CitationMentionId = S.TemplateLiteral(["cm1:", Sha256Hex]).pipe(
  S.brand("CitationMentionId"), $I.annoteSchema("CitationMentionId", { ... }))
```

Siblings in the same file: `CitationAuthorityId` = `ca1:` + `Sha256Hex` (`:73`).
The server also mints `cl1:` and `cg1:`
(`packages/law-practice/server/src/internal/Citation/Resolve.ts:349-356`,
`SessionDocument.ts:220,230`) and `cd1:` (`CallbackSession.ts:798`).

**Preimage.** `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:86-108`
defines an ordered JSON tuple, encoded with `S.fromJsonString(S.Tuple([...]))`.
`:127-142` fills it in this order:

| # | Value | Source | Class |
| --- | --- | --- | --- |
| 0 | `"citation-mention/v1"` | `S.tag` | protocol and version |
| 1 | `engineArtifact` | `Sha256Hex` of the engine artifact | detection metadata, but in the preimage |
| 2 | `semanticKind` | `S.NonEmptyString`, max 128 (`:21-25`) | detection metadata, but in the preimage |
| 3 | `source.scopeRef` | `SourceTextIdentity` | occurrence: scope |
| 4 | `source.sourceRef` | " | occurrence: logical source |
| 5 | `source.locator` | `PosixPath` | occurrence: locator |
| 6 | `source.sourceDigest` | `sha256:<hex>` | occurrence: artifact bytes |
| 7 | `source.textDigest` | `sha256:<hex>` | occurrence: extracted text |
| 8, 9 | `source.extractor.name`, `.version` | " | occurrence: capture |
| 10 | `source.normalizationVersion` | " | occurrence: capture |
| 11, 12 | `anchor.startChar`, `anchor.endChar` | `S.Natural` | occurrence: range (UTF-16, implicit; no unit field) |
| 13 | `anchor.quote` | `S.String` | occurrence: exact quote |

The digest is `Sha256HexFromBytes(TextEncoder.encode(json))` (`:143`), and the
result is `` `cm1:${digest}` `` (`:147`). The input must hold a genuine runtime
`VerifiedTextAnchor` (`:29-56`), so a structural receipt is refused.

**Detection metadata outside the preimage.** The mention record has
`id, citation, engineArtifact, signal, warnings, evidenceConfidence` plus
`anchor, components, footnote`
(`packages/law-practice/domain/src/values/Citation/Citation.mention.ts:150-166`).
The receipt shape (`:168-174`) adds `schemaVersion: "citation-mention-receipt/v1"`
and replaces the proof with `TextAnchorVerificationReceipt`.

**Cascade.** `ca1:` for a case citation with a null page embeds the mention id:
`["citation-authority/v1", "case-occurrence", CitationMentionId]`
(`AuthorityIdentity.ts:77,117-120`). `cl1:` and `cg1:` slice the authority
digest (`Resolve.ts:349-356`). Re-minting `cm1` therefore re-mints those
`ca1`, `cl1` and `cg1` values.

**Where `cm1:` is persisted or pinned.**

- SQL: no table, column or migration stores it. `rg 'citation_mention|mention_id'`
  over `*.sql`, `*.table.ts` and migrations finds nothing, and
  `packages/law-practice/tables/src` has no citation-mention table.
- Persisted form: only the JSON receipts `citation-document-receipt/v3`
  (`Citation.document.ts:60`) and `citation-mention-receipt/v1`, projected in
  `packages/law-practice/server/src/internal/Citation/Document.ts:350-353`.
  `packages/law-practice/domain/test/CitationDocument.test.ts:239` asserts that a
  `v2` receipt is refused. Versions are bumped and old ones refused; there is no
  upgrader. `v3` landed with the engine (#2511).
- Golden vector: `packages/law-practice/server/test/CitationMentionIdentity.test.ts:71,241`
  (`cm1:dc70e426…6ae9`).
- Fixtures: `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json`
  (13 `mentionId` values) and
  `goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-adapter/native.observed.json`
  (29, frozen evidence).
- Consumers of `CitationMentionId`: 15 src files and 10 test files.

**Migration pattern in the repo.** Every migration lives in
`packages/_internal/db-admin/drizzle/<ts>_<name>/{migration.sql,down.sql,snapshot.json}`,
with targets in `packages/_internal/db-admin/src/migrations/*.ts`. Each one is
tested by a PGlite integration test that migrates, applies `down.sql` split on
`--> statement-breakpoint`, then re-applies. Example:
`packages/_internal/db-admin/test/integration/SharedMembershipMigration.pglite.test.ts:21-56`.

**Owner.** `goals/citation-extraction-engine`: `completed-retained`, closeout
final PR #2966, updated 2026-11-13.
`gh pr list --search citation --state open --limit 20` returns `[]`.

*Implication.* `cm1` is already the occurrence preimage, with two detection
fields mixed in (engine artifact and semantic kind). Splitting them out means a
`citation-mention/v2` token. No SQL rows exist to re-mint. The re-mint is a
receipt-version bump (receipt v4 or mention-receipt v2) that refuses old
receipts, as `v2`→`v3` already did, plus regenerated goldens and fixtures, and it
must cascade through `ca1` (case-occurrence), `cl1` and `cg1`. The SPEC's
"migration that re-mints existing records" has no persisted records today. The
cheapest form is a protocol-vector test that pins `v1` and `v2` side by side.
The UTF-16 unit is implicit, so an explicit `OffsetUnit` in `OccurrenceId` is a
preimage change by itself.

## 2. Claim status vocabularies

Reader B smell 11 (`research/2026-11-08-reader-b-modeling-audit.md:490`) names
these sites. The cited list has eight, not seven:

| # | Vocabulary | Path:line | Members | Owner | Files naming it (non-test pkgs) |
| --- | --- | --- | --- | --- | --- |
| 1 | `ReviewTag` | `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:186` | Proposed, Accepted, Rejected, Disputed, Retracted | `@beep/epistemics` | 2 (epistemics, party/domain) |
| 2 | `ReviewState` (in `makeClaimEnvelope`) | `Claim.model.ts:331-338` | same five tags, cases carry dispositions | `@beep/epistemics` factory | 7, 3 test (party/domain, party/server) |
| 3 | `ReviewerDisposition` | `Claim.model.ts:304` | accepted, rejected, abstained | `@beep/epistemics` factory | 3 |
| 4 | `StructuralVerdict` | `Claim.model.ts:157-160` | Admitted, ShapeRejected{violations} | `@beep/epistemics` | 2, 1 test |
| 5 | `ClaimDispositionStatus` | `packages/foundation/modeling/epistemics/src/ClaimDispositionStatus/ClaimDispositionStatus.model.ts:12` | active, rejected, superseded | `@beep/epistemics` | 7 (epistemic/domain, epistemic/use-cases, law-practice/use-cases); SQL CHECK in `packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql` (`epistemic_claim_disposition_bounded`) |
| 6 | `ClaimGateResult` (+ `ClaimGateSeverity`) | `packages/foundation/modeling/epistemics/src/ClaimGate/ClaimGateResult.model.ts:99,135`; severity `:12` | verdict admitted, rejected{violations}; severity info, warning, violation | `@beep/epistemics` | 11, 4 test (epistemic/use-cases, tooling/library) |
| 7 | `ClaimEvidenceReviewStatus` (+ `ClaimEvidenceVerification`) | `packages/foundation/modeling/epistemics/src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:161-180` | Pending, Current{review}, Stale{review, reason: basis-changed, source-unverified}; Verified, Unverified{reason} | `@beep/epistemics` factory, bound in `packages/epistemic/domain/src/values/ClaimEvidenceReview/ClaimEvidenceReview.model.ts:90,123` | 5, 2 test (epistemic/domain, epistemic/ui) |
| 8 | `ClaimLifecycle` | `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:20` | candidate, shape_valid, consistency_checked, admitted | `@beep/shared-domain` | 27, 7 test (epistemic, law-practice); re-exported unchanged by `packages/epistemic/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts` |

Counts come from `rg -l -w <Symbol>` over `packages` and `apps`.

**Transition system today.** `ClaimLifecycleTransition` is
`S.Opaque { from, to, reason }` (`ClaimLifecycle.model.ts:96-106`). The only
transition is `packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts:121-129`:
`rejected` gives the claim back unchanged, `admitted` moves `candidate →
shape_valid`, and anything else fails with `ClaimInvalidTransition`.
`consistency_checked` and `admitted` have no producer.

**Envelope.** `makeClaimEnvelope` (`Claim.model.ts:276-371`) takes
`{ $I, proposition, logicalKey: (p) => string, ids: { claimVersion, assertion, activity, principal } }`
and returns `{ ReviewerDisposition, EvidenceSignals, DependenceAssessment, ReviewState, ClaimVersion }`.
`ClaimVersion` (`:343-368`) is:

```ts
S.Struct({ id, logicalKey: S.NonEmptyString, proposition, supportedBy: S.NonEmptyArray(ids.assertion),
  challengedBy: S.Array(ids.assertion), validTime: ValidTime, knowledge: KnowledgeInterval,
  supersedes: S.OptionFromNullOr(ids.claimVersion), review: ReviewState, signals: EvidenceSignals })
  .check(ClaimLogicalKeyCheck)
```

The five signals (`:311-317`) are `sourceTrust` (low, moderate, high),
`sourceAssertedConfidence` and `extractorConfidence` (`Measurement`),
`validator` (Conforms, Violations), and `reviewer` (`ReviewerDisposition`). Each
is wrapped by
`makeSignal = (value) => S.TaggedUnion({ Present: { value }, Absent: { reason: AbsenceReason } })`
(`:69-70`), with `AbsenceReason` = not-assessed, unavailable, not-applicable,
legacy-unknown (`:39`).

`ClaimVersion` has no `orgScope`. It lives on
`LogicalEdgeIdentity` (`packages/foundation/modeling/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:113-126`:
`{ evidenceScope: Option, matterScope: Option, orgScope: NonEmptyString, qualifiers: Record<string,string>, relation, source, target }`).
Its key is a third, pipe-joined canonical encoding hashed with `sha256`
(`:291-302`), not canonical JSON.

`EvidenceSpan` (`packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:107-119,147`)
is an `S.Opaque` of `TextAnchorFields` plus `confidence: UnitInterval` plus a
quote capped at 65,536 characters.

The glossary already binds a decentralization law, "Verdict family (epistemic
vocabulary law)": `standards/architecture/GLOSSARY.md:766-787`, which says
"names may be shared; vocabularies stay decentralized".

*Implication.* Only `ClaimLifecycle` has a transition function, and that
function covers one edge. `ReviewTag` is a projection of the `ReviewState` tags,
a duplicate. `StructuralVerdict` and `ClaimGateResult` both encode
admitted/rejected shape outcomes, likely another duplicate. `ClaimDispositionStatus`
is pinned in SQL, so persisted bytes constrain it. An `Assessments<K>` registry
fits the glossary law (owners keep their vocabularies). The census must classify
the eight sites, not seven. `orgScope` sits on the edge identity, not the claim,
so the claim core's `scope` is new surface.

## 3. Temporal intervals

- `ValidInterval`: `packages/foundation/modeling/epistemics/src/ValidInterval/ValidInterval.model.ts:39-46,67-74,94-100`.
  Fields `validFrom: S.DateTimeUtcFromMillis` (inclusive) and
  `validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr)` (exclusive), with
  `ValidIntervalOrderCheck` requiring `validFrom < validTo` when present.
- `KnowledgeInterval`: `packages/foundation/modeling/epistemics/src/KnowledgeInterval/KnowledgeInterval.model.ts:39-46,67-74,94-100`.
  Fields `recordedAt` (inclusive) and `expiredAt` (Option, exclusive), with
  `KnowledgeIntervalOrderCheck`.
- `ValidTime = S.TaggedUnion({ Unknown: {}, Interval: ValidIntervalFields }).check(ValidTimeOrderCheck)`
  (`Claim.model.ts:219-230`).
- Point reads: `holdsAt` (`ValidInterval.behavior.ts:41`), `knownAt`
  (`KnowledgeInterval.behavior.ts:41`), and `validAt` and `versionsAt`
  (`Claim.behavior.ts:30,54`). All are half-open at the upper bound.
- Local bound checks live in the schema checks above.
- Disjointness has no schema- or TypeScript-level check. It exists only as a
  Postgres constraint on edges:
  `ADD CONSTRAINT "epistemic_edge_no_overlap" EXCLUDE USING gist ("logical_key" WITH =, int8range("valid_from","valid_to",'[)') WITH &&) WHERE ("expired_at" IS NULL)`
  (`packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql:34-37`),
  plus a unique `(logical_key, version)` and an open-head unique index (`:33,38-40`).
  `packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts:260-268`
  maps the violations to `SupersessionConflict`. Tests:
  `packages/epistemic/server/test/integration/EdgeAuthority.pg.test.ts:235-244,407`
  and `packages/_internal/db-admin/test/integration/EpistemicEdgeMigration.pglite.test.ts:60,218`.

*Implication.* The existing disjointness law partitions by `logical_key` over
valid time among the current (unexpired) rows, and only the database enforces
it. The SPEC's L4 law ("successive knowledge intervals are disjoint per
`logicalKey`") is a different axis, knowledge time, and nothing checks it
today. P0 must pick an axis per law and say whether a pure in-memory checker,
needed for the log's law tests, mirrors the gist constraint. The millisecond
`int8range` encoding fixes `Instant` precision at milliseconds for anything that
reaches this table.

## 4. Provenance: identity, anchors and proofs

- `SourceTextIdentity` (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:125`)
  is an `S.Opaque` of
  `{ scopeRef: NonEmptyString, sourceRef: NonEmptyString, locator: PosixPath, sourceDigest: SourceTextDigest, textDigest: SourceTextDigest, extractor: SourceTextExtractor{name, version}, normalizationVersion: NonEmptyString }`.
  `SourceTextDigest = Sha256PrefixedDigest.pipe(S.brand("SourceTextDigest"))`
  (`:30`), where `Sha256PrefixedDigest = S.TemplateLiteral(["sha256:", Sha256Hex]).pipe(S.brand(...))`
  (`packages/foundation/modeling/schema/src/Sha256.ts:132`).
- `TextAnchor` (`packages/foundation/modeling/provenance/src/TextAnchor.ts:51-62,156`)
  is an `S.Class` over
  `TextAnchorFields = { startChar: S.Natural, endChar: S.Natural, quote: S.NonEmptyString }`,
  checked by `TextAnchorWidthCheck` (`end - start === Str.length(quote)`, UTF-16).
  It has a `toCodecArbitrary` link that uses `S.link`. `isUtf16Boundary` is a
  separate helper.
- `TextAnchorVerificationReceipt` (`VerifiedTextAnchor.ts:354`) is an `S.Opaque`
  of `{ anchor: TextAnchor, source: SourceTextIdentity }`. It holds no digest of
  the verification, no time and no verifier.
- `VerifiedTextAnchor` (`:369-460`) is
  `S.declare<VerifiedTextAnchor>(VerifiedTextAnchorValue.is)`, where
  `is = P.isObject(input) && verifiedTextAnchorSnapshots.has(input)`. Issuance is
  private: module-scoped
  `WeakMap<object, Snapshot>` (`:49-50`), a non-exported
  `class VerifiedTextAnchorValue` with getters that copy, frozen prototype and
  instance, and a non-exported `issueVerifiedTextAnchor` (`:395`). The only
  issuers are `verifyTextAnchorAgainstVerifiedSource` (`:639`) and
  `verifyTextAnchor` (`:721`), both `Effect.fn` with `Digest` in `R`. The receipt
  can be projected (`toTextAnchorVerificationReceipt`, `:523`) but never
  converted back. The same pattern serves `VerifiedSourceText` (`:263`).
- Time schemas, counted by occurrences in non-test `.ts`:

| Candidate | `packages/foundation` (files) | all `packages` + `apps` |
| --- | --- | --- |
| `S.DateTimeUtcFromMillis` | 20 (6) | 94 |
| `S.DateTimeUtcFromString` | 8 (5) | 270 |
| `S.DateTimeUtc` | 7 (4) | 55 |
| `S.DateFromString` | 2 (2) | 2 |
| `S.Date` | 0 | 7 |

The epistemics intervals and `makeClaimEnvelope` (`reviewedAt`, `openedAt`, `at`)
all use `S.DateTimeUtcFromMillis`. No repo `Instant` or `Timestamp` schema
exists, apart from a drizzle column helper
(`packages/ecosystem/effect-drizzle/src/pg/Column.ts:877`).

*Implication.* `S.DateTimeUtcFromMillis` is the foundation-local convention and
matches the `int8range` storage, so `Instant` can be that schema. Slices lean
toward ISO strings (270 sites), so any served payload that moves keeps its own
codec under the chapter-11 bytes rule. `Anchored` = range + quote + receipt can
reuse `TextAnchorVerificationReceipt` unchanged. The receipt carries no digest,
so "the `anchors` key equals the occurrence hash of its value" is computable
from `(source, anchor)` alone, provided the occurrence preimage matches section
1's fields.

## 5. IRI home

`packages/foundation/modeling/rdf/src/Iri.ts:995-1002`:

```ts
export const IRI = S.String.pipe(S.check(iriChecks), S.brand("IRI"), $I.annoteSchema("IRI", { description: "RFC 3987 IRI syntax." }))
```

Siblings: `IRIReference` (`:873`), `RelativeIRIReference` (`:914`), `AbsoluteIRI`
(`:954`). The file imports `{ A, Str } from "@beep/utils"` (`:8`) and
`SCHEMA_ORG_NAMESPACE` from `./Vocab/generated/SchemaOrg.terms.ts` (`:13`). The
schema.org constant is used only by `canonicalizeSchemaOrgIri` (`:708,747`), so
the RFC 3987 checks depend on `@beep/utils` alone.

Runtime dependency edges (`dependencies` + `peerDependencies` in each `package.json`):

- `@beep/identity` → (effect only). `@beep/types` is a dev dependency.
- `@beep/utils` → `@beep/identity`
- `@beep/schema` → `@beep/identity`, `@beep/utils`, `@beep/data`
- `@beep/data` → `@beep/utils`
- `@beep/rdf` → `@beep/identity`, `@beep/md`, `@beep/schema`, `@beep/utils`
- `@beep/jsonc` → `@beep/identity`, `@beep/schema`, `@beep/utils`

Importers of `IRI` outside `rdf`, via named imports from `@beep/rdf` or `@beep/rdf/Iri`:

- `packages/foundation/modeling/ontology/src/Fold.models.ts`, `Fold.assembly.ts`
  (`:16`, runtime `S.decodeUnknownEffect(IRI)` and `S.is(IRI)` at `:113,128,277`),
  and `test/Fold.test.ts`
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`
- `scratchpad/effect-ontology/**` (55 files)

`IRIReference` is imported by `packages/documents/domain/src/values/Taxonomy/Taxonomy.{model,seed}.ts`
and by nine `@beep/ontology` src and test files. Inside `@beep/identity`,
`IdentityEntry.iri` is plain `S.String`
(`packages/foundation/modeling/identity/src/IdentityRegistry.ts:104-110`).

*Implication.* If `identity` must use `IRI` (`TermIri`, `Namespace.iri`), only
two homes avoid a cycle. The first is `@beep/identity` itself, rewriting the
`@beep/utils` `A` and `Str` calls to `effect/Array` and `effect/String`, because
`utils → identity`. The second is a new effect-only package below `identity`.
`@beep/utils`, `@beep/schema` and `@beep/jsonc` depend on `identity` directly, and
`@beep/data` depends on it through `@beep/utils`, so `identity` cannot import them. `rdf` then re-exports or imports from the new
home, and roughly 60 importers keep compiling if `@beep/rdf` re-exports
`IRI`. `canonicalizeSchemaOrgIri` stays in `rdf`.

## 6. `@beep/identity` today

- IRIs are derived from paths. `IdentityAuthority = "https://beep-effect.com/ns/"`
  (`packages/foundation/modeling/identity/src/Id.ts:77`).
  `toIri(authority, identity)` drops the first `/`-segment of `@beep/<pkg>/<path>`
  and appends the rest (`:1680-1688`), so `@beep/a/b` becomes
  `https://beep-effect.com/ns/a/b`. `toCurie` gives `beep:<path>` (`:1690-1696`).
  The type-level mirror is `IriFromIdentity` (`:376`).
- Registry: `packages.ts` (3,990 lines) holds the `$I.compose(...)` slugs and
  one `export const $XxxId` per package. `IdentityRegistry.ts` is a
  `Context.Service` (`:253`) over `IdentityEntry { identity, iri, curie, fibers }`
  (`:104`). `IdentityEncoding = S.Literals(["identity","iri","curie"])` (`:34`)
  is a bare `S.Literals`, not a `LiteralKit`.
- Vocabularies: `Vocab.ts` `CoreVocab` (`:130`) has the prefixes `dcat`, `rdf`,
  `rdfs`, `skos`, `owl`, `dcterms`, `schema` and `beep`. There is no `prov`,
  `oa`, `nif`, `xsd` or `gufo`. `SemanticFoundationVocab` (`:548`) and
  `SparVocab` (`:590`) merge onto it.
- `Curie.ts` has `expand`, `contract`, the `Option` forms, `makeCurieCodec`,
  `CoreCurieCodec` (`:411`) and `CurieFromIri` (`:454`). `PnLocal.ts` has the
  SPARQL `PN_LOCAL` escape helpers.
- Canonical JSON: one RFC 8785 owner, `packages/foundation/modeling/jsonc/src/JsoncFingerprint.ts`
  (`JsoncFingerprint.canonicalizeResult`). `packages/foundation/modeling/epistemics/src/internal/CanonicalJson.ts:36-52`
  wraps it. Two 38-line re-export copies exist:
  `packages/epistemic/domain/src/values/internal/CanonicalJson.ts` and
  `packages/execution-authority/domain/src/internal/CanonicalJson.ts`, both
  through `canonicalDetectionJson`. Goal `goals/canonical-digest-owner` is
  `completed-retained` (final #3209). `@beep/jsonc` depends on
  `identity`, `schema` and `utils`.
- `identity-registry` lint
  (`packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts`; flag
  `--fix`) checks that every `@beep/*` workspace has a slug and an export in
  `packages.ts`, checks the labs segment, and forbids local root composers. Its
  violation kinds (`:70-77`) are missing-registration, orphan-registration,
  local-root-composer and labs-segment-missing/extra/misplaced. It does not
  check published IRIs or term stability.
- `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:11-24` and following
  lines pin seven literal `iri: "https://beep-effect.com/ns/test-utils/Vitest/…"`
  values, plus `identifier`, `schemaId` and `curie`, with this comment: "Historical
  public schema identities are pinned here to keep this bootstrap package
  independent of identity and schema."

*Implication.* Term stability needs a snapshot of all derived IRIs, because
every `$I` call site publishes one. `CoreVocab` lacks the five prefixes the L0
acceptance names. The canonical-JSON implementation already exists as one owner,
`@beep/jsonc`, but `identity` cannot import it (`jsonc → identity`). Either L0's
"one canonical JSON implementation" lives in `@beep/jsonc`, which `identity`
leaves alone, or the RFC 8785 core moves down. The identity-registry lint is
the natural place for a term-snapshot check.

## 7. Effect API against installed `effect@4.1.4`

Root `package.json:171` catalog sets `"effect": "4.1.4"`, `bun.lock:8128` has
`effect@4.1.4`, and `node_modules/@effect/vitest` is 4.1.4. The SPEC and the
report said 4.1.2 (the SPEC is corrected in P0); the installed version is 4.1.4. Lines below are in
`node_modules/effect/src/Schema.ts`.

| API | Exists | Signature |
| --- | --- | --- |
| `S.Opaque` | yes `:6688` | `Opaque<Self, Brand = {}>() => <S extends Top>(schema: S) => Opaque<Self, S, Brand> & Omit<S, keyof Top>` |
| `S.TaggedUnion` | yes `:6621` | `(casesByTag: Record<string, Struct.Fields>) => TaggedUnion<{ [K]: TaggedStruct<K, …> }>` |
| `S.toTaggedUnion` | yes `:6486` | `(tag) => (self: Union<Members>) => toTaggedUnion<Tag, Members>` |
| `S.TaggedStruct` | yes `:6364` | `(value: Tag, fields: Fields)` |
| `S.HashMap` | yes `:16049` | `(key, value)`. The JSON codec encodes to `Array<[k, v]>` in HashMap iteration order (`:16057,16082`), unsorted |
| `S.HashSet` | yes `:16144` | `(value)` |
| `S.Option` | yes `:16238` | `(value)`. Encoded side is `Option<Encoded>`; the repo norm for wire is `S.OptionFromNullOr` |
| `S.NonEmptyArray` | yes `:4777` | lambda `(schema)` |
| `S.NonEmptyString` | yes `:9249` | `String.check(isNonEmpty())` |
| `S.suspend` | yes `:5220` | `(f: () => S)` |
| `S.Codec` | yes `:1083` (interface) | `Codec<T, E = T, RD = never, RE = never>` |
| `S.brand` | yes `:5359` | `brand<B extends string>(identifier: B & EnsureSingleBrandKey<B>)`. A union or open template key is rejected (`:5312`); `Type = S["Type"] & Brand<B>`. Double branding composes and is already in use (`SourceTextDigest = Sha256PrefixedDigest.pipe(S.brand(...))`) |
| `S.check` | yes `:5243` | `(...checks) => (self) => self.check(...)` |
| `S.isPattern` | yes `:6932` | `(regExp, annotations?) => Filter<string>` |
| `S.DateTimeUtcFromMillis` | yes `:11974` | `Int.pipe(decodeTo(DateTimeUtc, …))` |
| `S.Natural` | yes `:8077` | `Int.check(isGreaterThanOrEqualTo(0))`. `S.NonNegativeInt` does not exist |
| `S.decodeTo` | yes `:5718` | `(to)` or `(to, transformation)` |
| `S.link` | yes `:6736` | `link<T>() => (encodeTo, transformation)` |
| `S.toJsonSchemaDocument` | yes `:18412` | `(schema, options?) => JsonSchema.Document<"draft-2020-12">` |
| `effect/Combiner` | yes | `make(combine)`, `min`, `max`, `first`, `last`, `constant`, `flip`, `intercalate` |
| `effect/Reducer` | yes | `Reducer<A> extends Combiner<A>`; `make(combine, initialValue, combineAll?)` (`Reducer.ts:120`) |
| `effect/Graph` | yes | `findCycle(graph): Option<CycleResult>` (`Graph.ts:5869`), `isAcyclic` (`:5973`), `topo` (Kahn iterator, `:10858`), `stronglyConnectedComponents` (`:7662`), `dfs`, `bfs`, `dfsPostOrder` |
| Arbitrary | `effect/Arbitrary` | `schema(schema, options?)` (`Arbitrary.ts:423`). The repo imports it about 960 times. FastCheck is at `effect/testing/FastCheck` |
| `it.prop` / `it.effect.prop` | yes | `@effect/vitest` `src/index.ts:112,173`, both `(name, arbitraries, self)`. Repo use: `packages/epistemic/use-cases/test/ContradictionTriage.rpc.test.ts:158`, `packages/workspace/tables/test/WorkspaceTables.test.ts:249` |

`LiteralKit` (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:288-296,383`):

```ts
export interface LiteralKit<L extends LiteralTuple> extends S.Literals<L> {
  readonly Enum; readonly is; readonly match; readonly matchOrElse; readonly omit; pick(...); readonly toTaggedUnion; }
export function LiteralKit<const L extends Literals>(literals: L): LiteralKit<L>
```

Real use, from `packages/foundation/modeling/epistemics/src/ClaimGate/ClaimGateResult.model.ts:99-103,135-140`:

```ts
const ClaimGateVerdict = LiteralKit(["admitted", "rejected"]).pipe($I.annoteSchema("ClaimGateVerdict", { ... }));
export const ClaimGateResult = ClaimGateVerdict.toTaggedUnion("verdict")({ admitted: {}, rejected: { violations: S.Array(ClaimGateViolation).annotateKey({ ... }) } })
```

`$I` on an `S.Opaque` class: the annotation goes on the inner schema before
wrapping (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:125`
and following lines):

```ts
const $I = $ProvenanceId.create("SourceTextIdentity");
export class SourceTextIdentity extends S.Opaque<SourceTextIdentity, { readonly brand: unique symbol }>()(
  S.Struct({ scopeRef: S.NonEmptyString.annotateKey({ description: "…" }), ... })
    .pipe($I.annoteSchema("SourceTextIdentity", { description: "…" }))) {}
```

Foundation usage: `S.Opaque<` 1,234, `S.TaggedUnion(` 24, `S.HashMap(` 5,
`S.HashSet(` 1, `S.Option(` 51.

*Implication.* Every API the sketches use exists in 4.1.4. `Present.or(Absent)`
in the report is not an API; the real form is `makeSignal`. `ContentHash` as
`sha256:<64 hex>` already exists as `Sha256PrefixedDigest`, so L0 can brand it
rather than add a new schema. Because `S.HashMap` and `S.HashSet` encode in
iteration order, every hashed preimage must sort its entries explicitly, which
supports design item 4's "deduplicate then sort before hashing". `effect/Graph`
covers the acyclicity check for `derivedFrom` (L4-3; the support half was
deleted by decision p0-item10).

## 8. Goals ops surface

`goals/tsconfig.ops.json:1-19` (comments omitted):

```jsonc
{ "extends": "../tsconfig.configs.json", "include": ["*/ops/**/*.ts", "ops-ambient.d.ts"],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "compilerOptions": { "rootDir": "..", "lib": ["ESNext", "DOM"], "plugins": [] } }
```

`tsconfig.configs.json` extends `tsconfig.base.json` with
`moduleResolution: "bundler"` and no `paths`. `@beep/*` resolves through the
workspace `node_modules/@beep/*` symlinks to each package's `exports`, which
point at `./src/*.ts`; `publishConfig.exports` carries the dist map. No built
dists are needed. Existing ops scripts already import `@beep/*` (89 files, for
example `goals/citation-extraction-engine/ops/check-cleaner-unicode.ts:2-3`).
`"plugins": []` means the Effect language-service diagnostics do not run on ops
files.

Run on this checkout: `bunx tsrs -p goals/tsconfig.ops.json --noEmit` exited 0
in about 3 s (tsrs 0.25.0, TS 7.1.0-beta with effect-tsgo 0.70.0; 4,986 files;
check time 3.01 s; load average about 29).

`opsScripts` examples:

- `goals/hosted-setup-tax/ops/manifest.json`:
  `[{ "path": "ops/turb-01-replay.ts", "purpose": "TURB-01 slice 1 first-parent replay: …" }, { "path": "ops/turb-01b-replay.ts", "purpose": "…" }]`.
  Layout: `ops/{manifest.json, turb-01-replay.ts, turb-01b-replay.ts}`.
- `goals/repo-cli-gh-git-consolidation/ops/manifest.json`: 13 top-level
  differentials plus nested `ops/frozen-w3/*.old.ts`, each listed by path (for
  example `ops/frozen-w3/CiGovernance.old.ts`).
- `goals/text-knowledge-stack-rebuild/ops/manifest.json` has no `opsScripts` yet.

Doctor checks (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:730-797`):
the check is opt-in and skipped when `opsScripts` is absent. When present, it
blocks on `ops-script-missing` (a listed path does not exist),
`ops-script-unregistered` (a `*.ts` under `ops/` is not listed),
`ops-script-unregistrable` (the path fails `GoalOpsScriptPath`
`/^ops(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/`, `Goals.schemas.ts:2186-2194`) and
`ops-script-duplicate`. Dot-leading segments are skipped. The entry schema is
`GoalOpsScript { path, purpose: NonEmptyString }` (`Goals.schemas.ts:2230-2240`).
`packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts` fails when an
entry falls outside `include`.

*Implication.* `ops/design/*.ts` is a valid home. Aliases resolve and the gate
is green and fast today. Every file under `ops/design/` must be listed by path.
The memory rule asks scratchpad prototypes to clear every tsgo diagnostic, and
`plugins: []` disables that profile here. If the design module is to meet that
bar, P0 needs a decision file (or a second check through a package tsconfig).

## 9. MCP hosts and write tools

Hosts:

- `@beep/mcp-kit` (`packages/foundation/capability/mcp-kit`): `ToolAnnotations.ts`
  (`annotateFourHints`, `readOnlyToolHints`, `destructiveWriteToolHints`) and
  `TierGate.ts`. TierGate is "the real security boundary" for `tools/call`
  (`:1-20`). An unannotated tool counts as destructive, and dispatch without
  approval requires `Readonly: true` (`:412-421`).
- Drivers: `packages/drivers/{gov-legal-mcp,m365-mcp,nlp-mcp,uspto-mcp}`.
- Apps: `apps/practice-kg-mcp`, `apps/practice-gateway`, and
  `apps/professional-desktop/server/OntologyMcpTransport.ts`.
- Slice toolkits: `packages/law-practice/use-cases/src/{ReviewHub/ReviewHub.tools.ts, ClaimInspection.tools.ts, ClaimSelfCheck.tools.ts, PracticeKg.tools.ts}`
  and `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`.
- `packages/execution-authority/server/src/GovernedTierGate/GovernedTierGate.gate.ts`
  is a second gate over the same `Tool.Destructive` default (`:199`).

Tools that write records (`readOnly: false` or mutating):

- `review_record_verdict`, `review_lock_batch`, `review_record_answer`: law-practice
  ReviewHub, append-only (`ReviewHub.tools.ts:18-24,69,95,121`)
- `ontology_propose_change_batch`, `ontology_repair`, `ontology_export_provenance`:
  OntologyToolkit (`:769-770,846-900`)
- `m365_outbox_*` (create, delete and send draft; create and update event):
  `packages/drivers/m365-mcp/src/OutboxTools.ts:617-782`
- `setup_profile_save`: `apps/practice-gateway/src/SetupTools.ts:214-220,320`
- Palantiri: `packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.tools.ts:34`

No MCP tool writes epistemic claims or annotations today (`rg Tool.make packages/epistemic`
finds nothing). The claim tools (`claim_inspect_input`, `claim_self_check`) are
read-only.

*Implication.* "Write tools emit `proposed` only" has no current subject. The
generic enforcement seam is `@beep/mcp-kit` `TierGate`, which already reads
tool annotations at dispatch. The record-level guarantee (a write tool's success
schema admits only stance `proposed`) belongs to whichever package defines the
first claim or annotation write tool. Candidates: `@beep/epistemics` exporting a
`ProposedOnly` success schema, used by `packages/law-practice/use-cases` tools.
P0 must name one. `mcp-kit` is the gate and the stance type lives in the claims
layer.

## 10. `create-package` and routing doctrine

`bun run beep create-package --help` shows `<name>` and these flags: `--type`
(library, tool, app), `--app-kind`, `--lab`, `--reuse-retired-name`,
`--parent-dir`, `--family` (drivers, ecosystem, foundation, tooling), `--kind`
(foundation: primitive, modeling, capability, ui-system per
`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:151`;
tooling: library, tool, policy-pack, test-kit, infra), `--dir-name`,
`--description`, `--dry-run`, `--skip-lockfile` and `--with-stories-tsconfig`.
`@beep/text` would be `create-package text --family foundation --kind modeling --type library`
(flag combination inferred from the help, not run).

`standards/ARCHITECTURE.md:62`: "Domain-agnostic reusable substrate owned by this
repo | `foundation/*`, after the specific-home-first routing test."

`:877-887`: "Route specific homes before reaching for `foundation/capability`:"
1. product semantics go to the slice or `shared/*`
2. external engines, SDKs and wrappers go to `drivers`
3. repo operations go to `tooling`
4. UI primitives go to `foundation/ui-system`
5. "Only remaining repo-owned, domain-agnostic technical services may go to
   `foundation/capability`."

`:888-897`: "`foundation/capability` is accepted only after a negative gate plus
proof: it carries no product semantics; it does not wrap an external engine…;
it is not repo-operational tooling; it is not a UI primitive…; it has multiple
real consumers or an explicit platform-capability rationale. Reusable shape
alone is not enough."

Chapter 7 sharpens this (`standards/architecture/07-non-slice-families.md:48-58`):
"**≥2 named consumers currently importing the package**, listed by name in the
package's README". Rejection is by consumer count below 2, a more specific home,
or an ergonomic wrapper (`:85-89`).

Chapter 11:

- Persisted bytes, `standards/architecture/11-evolution-and-deprecation.md:159-163`
  (rule 5 of "Upstream-first retirement in `foundation/modeling`"): "**Persisted
  and served bytes do not change.** Persisted columns and externally served
  payloads keep byte-identical encodings… Only in-memory shapes may change. A
  persisted or served boundary whose upstream default differs and that no such
  codec reproduces is a separate migration goal; it leaves the retirement PR."
- Promoted contracts (V2), `:171-177`: "A retirement may replace the
  implementation behind a field of a promoted contract only when the field's
  name, decoded type (brands included), accepted values, encoded bytes, and
  semantic meaning all stay unchanged… A change to any of them is a breaking
  change… and the contract migrates under the `V2` rule, never in the
  retirement PR."
- The V2 rule itself, `:38-54`: "A breaking change without a `V2` variant is a
  contract violation". The deprecation window is 2 minors or 1 quarter (`:49`).
- Rules 1 to 6 (facet census, ADAPT and RETIRE sums, same PR with no alias) are
  at `:120-168`.

*Implication.* `@beep/text`, `@beep/annotation` and the reshaped epistemics are
`foundation/modeling`, not `capability`, so the negative gate binds only if
`nlp-processing` or another L5 package is new; `nlp-processing` already exists
as a capability. A `cm1` re-mint changes encoded bytes, so rule 5 sends it to
"a separate migration goal" unless the scoped chapter-11 amendment the SPEC
requires covers it. That is why that amendment gates P2.

## 11. Doctrine formats and gates

Most recent `DECISIONS.md` entry, `standards/architecture/DECISIONS.md:2668-2765`,
"2026-11-18: Slices Are Model-First Bounded Contexts In Four Packages". Shape:

```md
## 2026-11-18: <Title>

- **Status:** Active
- **Amends:** 2026-04-21 "<entry>" and 2026-11-06 "<entry>"
- **Amends:** "<section>", … in `standards/ARCHITECTURE.md`

Decision:
<paragraphs; optional table of settled rows>

Rationale:
<paragraphs citing grilled decision ids and evidence>

Rejected:
- <alternative> (D2).
```

`.claude/skills/grill-with-docs/ADR-FORMAT.md:12-37` gives the base shape
(`## YYYY-MM-DD: Short Decision Title`, `- **Status:** Active`, `Decision:`,
`Rationale:`). A superseded entry gets `**Status:** Superseded` plus
`**Superseded-by:**`, and doctrine docs are updated in the same pass (`:99-118`).
The newest entry adds `Amends:` and `Rejected:` beyond the template.

`.claude/skills/grill-with-docs/CONTEXT-FORMAT.md:11-21` gives the glossary entry
format (`## Term Name` + one operational paragraph), with an optional
`**Terminology caveat:**` (`:49-54`). Real entry,
`standards/architecture/GLOSSARY.md:738-742`:

```md
## Value Object

A concept with no identity. Value objects own validation and pure behavior.
Promote value objects to `values/` only when they are reused; otherwise keep
them local to the concept that uses them.
```

Chapters: `00-philosophy`, `01-hexagonal-vertical-slices`, `02-shared-kernel`,
`03-driver-boundaries`, `04-rich-domain-model`, `05-layer-composition`,
`06-configuration-boundaries`, `07-non-slice-families`, `08-testing`,
`09-errors-across-boundaries`, `10-cross-slice-coordination`,
`11-evolution-and-deprecation`, `12-observability`,
`13-onboarding-the-minimum-viable-slice`, `14-ecosystem-packages`,
`15-lab-apps`. A new knowledge-stack chapter is **16**. It needs a row in the
index table of `standards/architecture/README.md` (`:87-89` list 13 to 15).
`ADR-FORMAT.md:104-116` lists only 01 to 13.

Gates: no `bun run beep lint` subcommand validates `DECISIONS.md`, `GLOSSARY.md`
or chapter structure. The lint list was checked, and
`rg 'DECISIONS|GLOSSARY' packages/tooling` finds only CI-routing tests. The
`laws` MarkdownFences law
(`packages/tooling/tool/cli/src/commands/Laws/MarkdownFences.ts:1-17`) does
type-check every `ts`/`tsx` fence under `standards/` against the root
tsconfig, while goal packets are exempt. Docgen-lane routing treats a
`DECISIONS.md` change as `affected`
(`packages/tooling/tool/cli/test/ci-lane.test.ts:1968`).

*Implication.* The chapter and the nine rulings are free-form beyond the
template. Any TypeScript fence in the chapter or in `DECISIONS.md` must compile
under `bun run beep laws`, so sketches belong in `ops/design/` (exempt, and
checked by tsrs) and the chapter should quote only compiling fragments or use
`skip-type-checking`.
