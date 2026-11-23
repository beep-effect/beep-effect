# P2 map: rdf selectors, the `oa:` adapter, the party `TextSpan` case and the deferred spans

Read-only map for the P2 designer (PLAN row "P2 L1 text"). Measured on
the P2 text lane at `bf799f49b71` (stacked on P1 PR C;
`origin/main` holds P0 #3420 and P1 PR A #3429, and the chapter-11 amendment is on
`origin/main` at `standards/architecture/DECISIONS.md:3193`). Effect APIs named here
were checked against `.repos/effect/packages/effect/src` and the installed
`node_modules/effect` 4.1.4 declarations. Consumer scope matches the census
(tracked TS outside the owner), plus `goals/` and `scratchpad/` where they bite.

## 1. rdf selector schemas and the Web Annotation adapter

### 1.1 What exists

`packages/foundation/modeling/rdf/src/Evidence.ts` (357 lines, composer
`$RdfId.create("evidence")`, `:16`), every class carrying `semanticSchemaMetadata`
of kind `provenanceConstruct`:

| Symbol | Line | Shape | Note |
| --- | --- | --- | --- |
| `EvidenceSelectorKind` | `:34` | `LiteralKit(["text-quote","text-position","fragment"])` | discriminator only |
| `TextQuoteSelector` | `:78` | `{ kind: "text-quote", exact: NonEmptyString, prefix?, suffix? }` | prefix/suffix `OptionFromOptionalKey` with `withConstructorDefault(Effect.succeedNone)` |
| `TextPositionSelector` | `:122` | `{ kind: "text-position", start: Natural, end: Natural }` | no order check: admits `start >= end`; no unit |
| `FragmentSelector` | `:164` | `{ kind: "fragment", value: NonEmptyString, conformsTo?: IRIReference }` | `conformsTo` optional and may be relative |
| `EvidenceSelector` | `:204` | `S.Union([...]).pipe(S.toTaggedUnion("kind"))` | no Refined, no Range |
| `EvidenceTarget` | `:247` | `{ source: IRIReference, selector: EvidenceSelector }` | |
| `EvidenceAnchor` | `:290` | `{ id: IRIReference, target: EvidenceTarget, note? }` | not the party `EvidenceAnchor` |
| `BoundedEvidenceProjection` | `:339` | `{ anchors: Array(EvidenceAnchor), truncated: Boolean }` | |

`packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts` (717 lines, composer
`$RdfId.create("adapters/web-annotation")`, `:27`; metadata kind `adapterBoundary`,
`:29-39`) has two layers:

- Wire DTOs (census "keep"): `WebAnnotationTextQuoteSelector` `:60` (`type: "TextQuoteSelector"`),
  `WebAnnotationTextPositionSelector` `:100` (`start`, `end` Natural, no order check),
  `WebAnnotationFragmentSelector` `:138` (`conformsTo?: IRIReference`),
  `WebAnnotationSelector` `:174` (union tagged on `type`), `WebAnnotationTarget` `:221`
  (`{ source: IRIReference, selector }`, one selector, no `type: "SpecificResource"`),
  `WebAnnotation` `:257` (`{ id, type: "Annotation", bodyValue?, target }`).
- Evidence codecs (all built on `Evidence.ts`, all retire with it):
  `WebAnnotationSelectorFromEvidenceSelector` `:358`, `WebAnnotationTargetFromEvidenceTarget` `:492`,
  `WebAnnotationFromEvidenceAnchor` `:577` (each `S.toEncoded(X).pipe(S.decodeTo(DTO, { decode:
  SchemaGetter.transform(...), encode: SchemaGetter.transform(...) }))`), and the six functions
  `evidenceSelectorToWebAnnotationSelector` `:412`, `webAnnotationSelectorToEvidenceSelector` `:441`,
  `evidenceTargetToWebAnnotationTarget` `:631`, `webAnnotationTargetToEvidenceTarget` `:656`,
  `evidenceAnchorToWebAnnotation` `:687`, `webAnnotationToEvidenceAnchor` `:716`.

There is no `TextAnchor` codec today. `TextAnchor <-> oa:` is new code in this file
(SPEC Objective 6, `SPEC.md:56`; chapter 16 `standards/architecture/16-knowledge-stack.md:163-169`).

Existing defect the rewrite should not carry over: every transform runs
`Result.getOrThrow` inside `SchemaGetter.transform` (`WebAnnotation.ts:298,332,337,413,455,466,471,536,548,553,632,688`),
so a bad input throws a defect instead of producing a `SchemaIssue`. Effect 4.1.4 has no
`transformOrFail`; the failing forms are `SchemaGetter.transformEffect`
(`.repos/effect/packages/effect/src/SchemaGetter.ts:763`, `f: (e, options) => Effect<T, SchemaIssue.Issue, R>`)
and `SchemaTransformation.transformEffect` (`SchemaTransformation.ts:390`), failing with
`new SchemaIssue.InvalidValue(annotations?, input?)` (`SchemaIssue.ts:768`; installed
`node_modules/effect/dist/SchemaIssue.d.ts:489`).

Barrel and subpaths: `rdf/src/index.ts:26` re-exports the adapter as the namespace
`WebAnnotation`; `:33` does `export * from "./Evidence.ts"`. `package.json` exports `"./*":
"./src/*.ts"`, so deleting `Evidence.ts` removes `@beep/rdf/Evidence` with no manifest edit.

### 1.2 Every importer

`Evidence.ts` and the evidence codecs (census row f-1 counted "0 package or app imports";
that holds for `packages/` and `apps/` but misses one `goals/` script):

| Consumer | Lines | What it uses | P2 action |
| --- | --- | --- | --- |
| `rdf/src/Adapters/WebAnnotation.ts:17-24` | import + 96 name lines | all six Evidence schemas | rewrite on `@beep/text` `Selector` / `TextAnchor` |
| `rdf/src/index.ts:33` | 1 | barrel re-export | delete the line |
| `rdf/test/WebAnnotation.test.ts` (153 lines) | `:1-11`, cases `:58-153` | selector/target codecs, two `it.prop` round trips over `Arbitrary.schema(EvidenceSelector)` / `(EvidenceTarget)` (`:136`, `:145`) | rewrite over `Selector` |
| `rdf/test/InteropAndMetadata.test.ts` | `:1-3`, `:23-27`, `:43-68` | `EvidenceModule` in the metadata audit, `EvidenceAnchor` round trip | drop the `evidence` audit row; keep `adapters/web-annotation` (`:33-37`) |
| `rdf/test/Rdf.test.ts` | `:3-16`, `:143-165`, `:526-620`, `:735-760` | constructor-default parity, reversible codec test, two `it.effect.prop` round trips over `EvidenceAnchor` and `WebAnnotationFromEvidenceAnchor` | delete or rewrite those cases |
| `goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts:10,111` | 2 | `BoundedEvidenceProjection` by relative path into `rdf/src/Evidence.ts`, decoding the frozen `history/outputs/beep-effect-documentation-seed.evidence.json` (3 anchors, all `kind: "text-quote"`) | not in `goals/tsconfig.ops.json` (`include` is `*/ops/**/*.ts`), so no gate catches it; the goal is `lifecycle: reference` with `rerun.verify` naming this script (`ops/manifest.json:40`). Needs a decision (open question 3). The script writes `verification-report.json` when run, so it was not run for this map |
| `packages/foundation/capability/semantic-web/README.md:31` | 1 | Markdown code block `import { ProvBundle, EvidenceAnchor, makeQuad } from "@beep/rdf"` | edit the fence (docs fences are linted) |
| `standards/schema-catalog/@beep/rdf.generated.jsonc:16-32` | 17 rows | generated catalog | regenerate |
| `standards/coverage.regression-baseline.jsonc:36482` (`WebAnnotation.ts` lines 87.09, functions 71.42) and `:36494` (`Evidence.ts` 100) | | coverage ratchet | the rewritten adapter must not drop below its row; the `Evidence.ts` row goes with the file |

Wire DTO importers (kept):

- `rdf/src/Adapters/DocumentAnnotation.ts:22,140-141` builds `NodeSelector = { ...WebAnnotationFragmentSelector.fields, value: MdNodeId }`
  (no `conformsTo`) and `NodeTarget = { ...WebAnnotationTarget.fields, type: "SpecificResource", selector: NodeSelector }`.
  It overrides `selector`, so a change to the type of `WebAnnotationTarget.selector` does not reach it; a new
  field on `WebAnnotationTarget` does.
- `packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:1,37,257-269` decodes a
  `WebAnnotation` with one `TextQuoteSelector` and asserts `annotation.target.selector.type`. A
  multi-selector target breaks this assertion. `@beep/semantic-web` is not a package named in the
  chapter-11 amendment, but this is a test, not a served payload, so it migrates in the same PR.

Not consumers (name matches only): `law-practice/domain/src/values/SourceRef/TextQuote.model.ts:15,60`
and `SourceRef.model.ts:201,239` (JSDoc and description text naming W3C `TextQuoteSelector`;
census routes them as occurrence projections in P2 and P3); `cli/src/commands/Kb/Kb.service.ts:51-78`
(its own `TextQuote` case, kept, P7 re-check); `identity/src/internal/generated/Registry.data.ts:293-297`,
`identity/test/Curie.laws.test.ts:135` and `cli/.../SyncDataToTs/targets/PinnedVocabularies.ts:328-332`
(`oa:` vocabulary terms); `goals/text-knowledge-stack-rebuild/ops/design/L6.interchange.ts:160-161` (CURIE strings).
Historical `goals/boolean-creep/data/**` receipts name `Evidence.ts` and stay frozen.

Registry: no `TermBinding` names an rdf Evidence, adapter, provenance or party code identity
(`identity/registry/namespaces/*.json`; only `vitest.json` has bindings), so deleting these
schemas does not move `registry/term-snapshot.json` and L0-3 is not involved. The composer IRIs
these modules mint stay path-derived (decision `2026-11-20-p1-composer-stays-registry-free`).

### 1.3 What `TextAnchor <-> oa:` must cover

Inputs from the decisions: offsets on the OA wire are Unicode code points and the stored unit is
`utf16-code-unit`; conversion goes through `@beep/text` unit conversion and fails closed on a split
surrogate (decision `p0-item7-oa-profile`; chapter 16 `:163-169`); `TextAnchor` keeps its stored shape
and `Selector.Position` sits beside it (decision `p0-text-anchor-retained-beside-selector-position`).
`TextAnchor` (`provenance/src/TextAnchor.ts`) is `{ startChar, endChar, quote }` with
`TextAnchorWidthCheck` (`start < end` and UTF-16 width equals `quote` length) and a separate
`isUtf16Boundary(sourceText, boundary)`; the width check does not reject a range that splits a
surrogate pair.

Consequences for the codec's shape:

1. It cannot be a text-free `S.decodeTo` codec. The code-point width follows from the quote, but
   `start` needs the prefix of the source text. Encode and decode both take the source text (a
   string, or `VerifiedSourceText` when the caller has verified the capture) and return a
   `Result`/`Effect` failing with `UnitConversionRefused` (`ops/design/L1.text.ts`, `split-boundary`
   or `out-of-range`).
2. `oa:hasSource` needs an IRI. `TextAnchor` has none, and `SourceTextIdentity.sourceRef` is a
   non-empty string, not an IRI. The codec takes the source IRI as an argument; decoding cannot
   rebuild a `SourceTextIdentity` or a receipt (L1-6: nothing decoded becomes a `VerifiedTextAnchor`).
3. One anchor maps to two selectors (`oa:TextPositionSelector` plus `oa:TextQuoteSelector`, chapter 16
   `:163`). `WebAnnotationTarget.selector` holds one. Options: make `selector` a non-empty array of
   alternatives (OA allows several `oa:hasSelector` values), or nest with `oa:refinedBy` (registered,
   `identity/registry/namespaces/oa.json`). Either changes the target wire shape (allowed for `@beep/rdf`
   by the amendment, no stored rows) and touches the semantic-web test above.

Cases the round-trip tests in `packages/foundation/modeling/rdf/test` must cover (PLAN exit criterion):

| Case | Expected |
| --- | --- |
| `decode(encode(a, t), t)` for generated `a` on valid boundaries of well-formed `t` | `a` (property test; generators per decision `p0-law-generators-well-formed-text`) |
| astral-plane fixture (an anchor after a non-BMP character, for example `"A😀B"`) | code-point offsets on the wire differ from the UTF-16 offsets and convert back |
| anchor whose `startChar` or `endChar` splits a surrogate pair | encode refuses with `split-boundary` |
| wire offsets past the end of `t` | decode refuses with `out-of-range` |
| wire `start >= end` (the old DTO admits it) | decode refuses: `Selector.Position` and `TextAnchor` are non-empty |
| position present, quote absent | quote read from the slice (L1-1) |
| quote present, position absent | through `resolve`: `Unique` decodes, `Ambiguous` refuses (L1-5), `NotFound` refuses |
| position and quote disagree | refuses |
| `encode(decode(w, t), t)` for third-party `w` | equals `w` with the missing selector added (a normalize step, as L2-6 states for documents) |

The adapter module is audited by `InteropAndMetadata.test.ts:33-37,70-91`: every exported schema
(except `WebAnnotationSelector`) must carry `semanticSchemaMetadata` whose `canonicalName` equals its
export name, so any new exported codec schema needs `adapterMetadata(...)`.

The rest of the `Selector` union: if the evidence codecs are re-expressed over `Selector` (the census
says "retire into `@beep/text` `Selector`; the `oa:` codec stays"), the DTO lacks `oa:RangeSelector`
and `oa:refinedBy`; `oa:RangeSelector` and `oa:refinedBy` are registered, `oa:hasStartSelector` and
`oa:hasEndSelector` are not (the term list is pinned in `PinnedVocabularies.ts:326-342`). `Position`
carries a `unit` the wire lacks (the wire is code points; a `utf8-byte` position converts first). `Fragment`
requires an absolute `conformsTo: IRI` while the DTO and `DocumentAnnotation` emit fragments without one.
The PLAN exit names only the `TextAnchor` round trip, so the full union is optional for P2.

## 2. The party `TextSpan` case

Package: `packages/party/domain` (`@beep/party-domain`; deps `@beep/epistemics`, `@beep/identity`,
`@beep/schema`, `@beep/shared-domain`, `@beep/utils`, no `@beep/provenance`). No party package
persists anything: no SQL client, no drizzle table, and no `party` match under
`packages/_internal/db-admin/drizzle`.

`packages/party/domain/src/entities/Provenance/Provenance.model.ts`:

- `TextSpan` `:413-421`: `S.TaggedStruct("TextSpan", { occurrence: OccurrenceId, textDigest: Digest,
  start: Int >= 0, end: Int >= 1, quote: NonEmptyString })`. `occurrence` is the party artifact
  occurrence (`party-occ:`), `textDigest` is the party `Digest` (bare hex 8 to 64,
  `values/Ids/Ids.model.ts:391`), the unit is undeclared, and there is no extractor, normalization
  version or source digest.
- `EvidenceAnchor` `:470-480`: `S.Union([HeaderField, TextSpan.check(TextSpanOrderCheck), MetadataTag, RecordRow]).pipe(S.toTaggedUnion("_tag"))`.
  Non-text cases: `HeaderField` `:394`, `MetadataTag` `:434`, `RecordRow` `:453`.

Consumers of the `TextSpan` case itself: none outside the defining module. Nothing constructs
it in `packages/`, `apps/` or `scratchpad/`; the one use is the negative decode in
`packages/party/domain/test/Party.competency.test.ts:60-70` (`end < start` must fail). Nothing
matches exhaustively over `EvidenceAnchor` (only `_tag === "HeaderField"` reads in
`party/server/test/MailRecord.test.ts:107,201-202`). Census row f-5's "10 / 4" counts the union's
other cases, which P2 does not change:

| Consumer of the union | Lines |
| --- | --- |
| `party/domain/src/entities/Claim/Claim.model.ts:11,97` | `anchors: S.NonEmptyArray(EvidenceAnchor)` |
| `party/domain/src/entities/Communication/Communication.model.ts:31,131,153,176,196,217,237` | `anchor: EvidenceAnchor` fields |
| `party/server/src/values/ReviewLoop/ReviewLoop.model.ts:10,140` | `anchor: EvidenceAnchor` |
| `party/server/src/values/ContactEvidence/ContactEvidence.behavior.ts`, `MailIndex/MailIndex.behavior.ts` | `RecordRow.make` / `HeaderField.make` |
| `party/domain/test/fixtures/acme.ts:17,124,210`, `party/server/test/ReviewLoop.test.ts:65` | `HeaderField` / `RecordRow` |
| `scratchpad/party/scripts/ReviewPageAdapter.ts:11,176`, `scratchpad/party/test/ReviewPageAdapter.test.ts:102` | scratchpad, outside the sums |

Same-PR rename (decision `p0-rq4`): the party `OccurrenceId` (`Ids.model.ts:139-148`, prefix
`party-occ`, description "occ: scheme") gives up the name to `@beep/text`. Read sites:
`Provenance.model.ts:12,77,151,396,415,436,454`; `Communication.model.ts:28,149,194,349,460`;
`party/domain/test/fixtures/acme.ts:12,87`; `party/server/src/values/ContactEvidence/ContactEvidence.behavior.ts:11,101`;
`party/server/src/values/MailIndex/MailIndex.behavior.ts:11,122,348`; `party/server/test/ReviewLoop.test.ts:1,65`;
`scratchpad/party/scripts/identity-evidence.ts:22,404`; `scratchpad/party/test/ReviewPageAdapter.test.ts:1,102`.
The `party-occ:` value strings live only in tests, fixtures and in-memory construction, so the prefix
can stay. The entity is `ArtifactOccurrence` (`:149-158`), so `ArtifactOccurrenceId` is the obvious name.
One more `OccurrenceId` exists as a module-local, unexported const in
`packages/tooling/tool/cli/src/commands/Codex/Security.schemas.ts:152` (`occ_` + 24 hex); no decision names it.

What replaces the case: the census says "`TextSpan` becomes an `@beep/text` occurrence; the union stays
party-owned for the non-text cases" (`consumer-census.md:312,316-325`), while the PLAN exit asks for the row
to read `deleted`. The `TextSpan` fields cannot be minted into an `OccurrenceId`: there is no extractor,
no normalization version, no prefixed source or text digest and no unit. With zero producers and no stored
rows, nothing needs migrating; the replacement case carries an `@beep/text` reference (an `OccurrenceId`, or
`Anchored`) beside the party artifact occurrence, and `@beep/party-domain` gains a dependency on `@beep/text`.
The competency test's negative case moves to the new case.

## 3. Spans deferred to P3 and P4, and where P2 touches them anyway

Leave the shapes alone:

| Encoding | Definition | Phase |
| --- | --- | --- |
| nlp Handoff `Span` | `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:213-262` (`start <= end`, empty spans allowed) | P3 |
| nlp Graph `Span` | `packages/foundation/modeling/nlp/src/Graph/Schema.ts:358` (finite floats, no order check; used in `:391`, `:511`) | P3 |
| epistemics `EvidenceSpan` | `packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:107-150` (`TextAnchorFields` plus `confidence`) | P4; stored `epistemic_evidence.span` read by `epistemic/tables/.../EvidenceVerification.converters.ts:77` and `epistemic/server/.../ContradictionTriage.repo.ts:645` |

Couplings that make P2 edit them or their neighbours:

1. `EvidenceSpan.model.ts:16-21` imports `TextAnchorFields` and `TextAnchorWidthCheck` from
   `@beep/provenance/TextAnchor`; the module also names `@beep/provenance` in JSDoc (`:6`, `:124`) and in the
   schema `description` (`:150`). Chapter 11 rule 3 (same PR, no alias) and the PLAN exit `rg -l "@beep/provenance" packages apps`
   empty force P2 to rewrite these to `@beep/text`. The edit is path and text only. The description change
   regenerates the epistemics schema catalog and touches no stored bytes. The same holds for
   `ClaimEvidenceReview.model.ts:7-8` and `EvidenceVerification/EvidenceVerification.model.ts:7` in epistemics.
2. The nlp packages have no `@beep/provenance` import (deps: identity, schema, utils), so the rename does
   not reach either nlp span.
3. `@beep/langextract` imports `@beep/provenance` in `VerifiedSpan/VerifiedSpan.model.ts:9-10`,
   `VerifiedSpan.behavior.ts:9-17,47` and `test/VerifiedSpanHistory.test.ts`, and P2 re-expresses its
   `TextOffsetRange` (`VerifiedSpan.model.ts:112`) and `Utf16TextRange` (`:173`) on the text position.
   The same module embeds `GroundedExtraction` (with `Contract.Span`, `Extraction/Extraction.model.ts:190`)
   in its verified-span attempt records (`VerifiedSpan.model.ts:584-623`, `:901-910`), so P2 must leave
   `GroundedExtraction` and `Contract.Span` byte-identical. `convertTextOffsetRange` (`VerifiedSpan.behavior.ts:370-379`,
   code point to UTF-16 over `"A😀B"`) is existing unit-conversion code for `@beep/text` to absorb or call.
4. `TextAnchor` stays non-empty while the Handoff `Span` admits `start == end` (census `:95`, `:146`), so a P2
   converter from a Handoff span to `Selector.Position` would be partial. P2 has no reason to write one; P3 owns it.

## 4. Census rows P2 must record

Rows in `research/consumer-census.md` section f (`:292-337`) that this map's facets own, and the disposition
P2 writes when its PR lands (chapter 11 row schema: usage, upstream coverage, covered, uncovered,
construction, disposition, semantic loss):

| Row | Today | P2 records | Notes for the semantic-loss column |
| --- | --- | --- | --- |
| f-1 rdf `TextQuoteSelector`, `TextPositionSelector` (`EvidenceSelector`, `FragmentSelector`, carrier `EvidenceAnchor`) `:308` | retire in P2 | `deleted` (with PR and commit) | Today "none". Narrowings the replacement makes: positions become non-empty and unit-tagged, `Fragment.conformsTo` becomes a required absolute IRI, and `EvidenceAnchor.id`/`note` and `BoundedEvidenceProjection` get no `@beep/text` counterpart (the DTO `WebAnnotation` keeps `id` and `bodyValue`). Add the missed `goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts` consumer and its outcome. |
| f-5 party `EvidenceAnchor` case `TextSpan` `:312` | adapt in P2 | `deleted` for the `TextSpan` case; the union stays party-owned with three non-text cases plus the new `@beep/text` case | Today "yes (below)". The case has 0 producers, 0 stored rows and one negative test, so the loss is of shape only: an undeclared unit and a bare-hex `textDigest` become a declared unit and a prefixed digest. Correct the row: its 10 / 4 usage counts the union's other cases, and the `TextSpan` case itself has 0 consumers outside its module. |
| extra table: rdf `WebAnnotation*Selector` wire classes `:336` | keep | `kept`, amended | Record any wire-shape change to `WebAnnotationTarget` (selector array or `refinedBy`) and the migrated semantic-web test. |
| party `OccurrenceId` (prose `:322-325`, decision `p0-rq4`) | no row | renamed (proposed `ArtifactOccurrenceId`) | No stored rows; prefix unchanged. |
| f-2 `EvidenceSpan` `:309`, f-3 Handoff `Span` `:310`, f-4 Graph `Span` `:311` | P4, P3, P3 | unchanged | P2 touches only `EvidenceSpan.model.ts` imports and descriptions (section 3). |

The neighbouring P2 rows (`TextAnchor` module `:95`, langextract, law-practice `TextQuote`/`SourceRef`/`SourceQuote`,
agent-memory-store `OccurrenceAnchor`) belong to the other P2 maps.

## 5. CI runner Lambda handlers

Handler entries (`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts:59-70`): seven in
`packages/tooling/library/alchemy-github-runners/src/internal/lambda/` (`job-retry`, `runner-binaries-syncer`,
`scale-down`, `scale-up`, `ssm-housekeeper`, `termination-watcher`, `webhook`, plus the shared `Runtime.ts`) and
`packages/tooling/infra/ci-runners/src/internal/lambda/reaper.ts`. `ALLOWED_IDENTITY_SOURCES` (`:33-39`):
`Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts`, `internal/schemaStatics.ts`. The test checks only the
identity sources in each source map, not the whole map.

Transitive `@beep/*` closure of the two handler packages (package.json dependencies, followed): `@beep/alchemy-aws-extras`,
`@beep/alchemy-github-runners`, `@beep/data`, `@beep/identity`, `@beep/infra-ci-runners`, `@beep/schema`,
`@beep/utils`. Source imports agree: `@beep/identity/Root` and the `@beep/schema` barrel (handler-reachable through
`RunnerRuntime.models.ts`, `WorkflowJob.models.ts`, `ScaleDown.program.ts`, `TerminationWatcher.program.ts`,
`RunnerPool.models.ts`).

No P2 target is reachable from a handler: `@beep/rdf`, `@beep/provenance`/`@beep/text`, `@beep/party-domain`,
`@beep/epistemics`, `@beep/nlp`, `@beep/langextract`, `@beep/jsonc`, `@beep/md` and `@beep/html` are all outside
the closure. What can still move a handler hash:

- `create-package` for `@beep/text` and retiring `$ProvenanceId` (`identity/src/packages.ts:497`) edit
  `packages.ts`, which the handlers do not load. Safe as long as P2 does not touch the five allowed identity sources.
- Any edit to a `@beep/schema`, `@beep/utils` or `@beep/data` module the `@beep/schema` barrel bundles would change
  map text that `HandlerBundles.test.ts` does not inspect. P2 should add nothing to `@beep/schema` (the design module
  already finds `ContentHash`, `DomainTag`, `LiteralKit`, `PosixPath` and `Sha256Hex` there, and `ContentHash` is not
  in the barrel) and keep `OffsetUnit` and the rest in `@beep/text`.
- `bun.lock` is in the `deploy-ci-runners.yml` push path filter (`:50-55`), and adding and removing workspaces changes
  it, so the P2 merge triggers that workflow. The job runs only while `CI_RUNNERS_DEPLOY_ARMED` (and, for a push,
  `CI_RUNNERS_ROUTINE_ARMED`) is true (`:11-19`, `:86-89`); with unchanged handler maps the plan has no function update.

## Open questions

1. Codec signature: does `TextAnchor <-> oa:` take a raw source string or `VerifiedSourceText`, and does it return
   `Result` (like `convertPosition` in `ops/design/L1.text.ts`) or `Effect`? Where does the `oa:hasSource` IRI come from
   (a caller argument, or a mapping from `SourceTextIdentity`)?
2. Wire shape for two selectors: should `WebAnnotationTarget.selector` become a non-empty array of alternatives or a
   `refinedBy` chain? Either changes the DTO the semantic-web test decodes.
3. `goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts` decodes a frozen artifact with `BoundedEvidenceProjection`.
   Should it be retired from the reference goal's `rerun.verify` (with a note in that packet's history), given a
   script-local schema that reproduces the frozen bytes, or should `BoundedEvidenceProjection` survive in `@beep/rdf`?
   Census row f-1 needs the outcome either way.
4. Does P2 re-express the evidence codecs over the whole `Selector` union (which needs `RangeSelector`/`refinedBy` DTOs and
   registry terms `oa:hasStartSelector`/`oa:hasEndSelector`, a snapshot release), or delete them and ship only the
   `TextAnchor` codec?
5. Fragment selectors without `conformsTo` (`DocumentAnnotation`'s `MdNodeId` targets): should they stay DTO-only, or
   should `Selector.Fragment.conformsTo` become optional?
6. The party replacement case: `OccurrenceId` only, or `Anchored` (receipt)? And what is the new name of the party
   `OccurrenceId`? `ArtifactOccurrenceId` is proposed.
7. Should the `TextAnchor <-> oa:` round trip get a law-ledger id (it is a PLAN exit criterion, not one of `L1-1` to
   `L1-6`), and a test-title convention?
8. Party's `ActivityId` (`party-act`) and `Digest` also collide with stack names (census `:322-325`), and the cli
   Codex `OccurrenceId` const shares the reserved name. Only the party `OccurrenceId` has a P2 decision. Do the others
   need decision files now or in P3?
