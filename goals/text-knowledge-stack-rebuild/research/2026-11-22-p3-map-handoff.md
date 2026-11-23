# P3 map: the source side of the handoff

Read-only map for PLAN row "P3 L2 annotation: @beep/annotation, lossless handoff", source side only: what
produces the handoff today (`@beep/langextract` and the `@beep/nlp` Handoff contract it fills), the nlp Graph `Span`,
how verified receipts are minted today, what `@beep/text` (P2) now provides for anchors and occurrences, and every
stored or frozen byte of a handoff. The read side (how `IrToLaw`, the semantica projection and the office-action flow
consume the document) is named only where a source-side choice constrains it.

Base: the P3 lane at `1c8d9636b1d` (a layer on the P2 text lane). No package source was edited; this file is the only
write.

## 0. Method

- Every count is a command run on the base. File lists use
  `git ls-files -z -- '*.ts' '*.tsx' | grep -zv '^<owner>/' | xargs -0 rg -l -U "from\s*[\"']<pkg>(/[^\"']*)?[\"']"`,
  as `research/consumer-census.md` does. Usage lines drop import lines and JSDoc lines (`grep -v ':\s*\*'`), so they
  run lower than the census, whose counter kept JSDoc `**Example**` imports. Where the two differ, both are given.
- Line numbers are from `cat -n`, `rg -n` or the Read tool on the base, never from a filtered listing.
- Effect is 4.1.5 installed (`node_modules/effect/package.json`) and 4.1.5 in `.repos/effect` (`dd5f2f322f`). APIs named
  below, in `.repos/effect/packages/effect/src`: `Schema.ts` `toTaggedUnion` :6498 (its `isAnyOf` :6506), `tag` :6280,
  `Record` :4044, `Union` :5032, `NonEmptyArray` :4789, `Natural` :8089, `Opaque` :6700, `TaggedStruct` :6376,
  `TaggedUnion` :6633, `decodeTo` :5731, `decodeUnknownEffect` :1536, `makeFilterGroup` :6878, `ArrayEnsure` :4829,
  `DateTimeUtcFromMillis` :11992, `HashMap` :16067, `HashSet` :16162, `OptionFromOptionalKey` :16928, `Class` :17844,
  `TaggedError` :18025, `toEquivalence` :18138, `toCodecJson` :18390; `Effect.ts` `fn` :15239, `fnUntraced` :15114,
  `forEach` :842, `fromOption` :1996; `Layer.ts` `effect` :1039; `Context.ts` `Service` :44; `Clock.ts`
  `currentTimeMillis` :273; `crypto/Digest.ts` `Digest` :135, `layerWebCrypto` :159; `HashMap.ts` `toEntries` :659,
  `union` :913. **Shift:** the P2 design cites 4.1.4 numbers; past roughly `Schema.ts:16000` they moved by 60 lines in
  4.1.5 (`Class` 17784 to 17844, `TaggedError` 17965 to 18025, `toEquivalence` 18078 to 18138,
  `OptionFromOptionalKey` 16868 to 16928). Lines below 7000 are unchanged.

## 1. What P3 requires of the source side

| Source | Requirement on the source side | Where |
| --- | --- | --- |
| PLAN P3 goal | "the langextract handoff mints verified receipts and emits the document"; "the handoff's `Entity`, `Relation` and `Provenance` types deleted"; candidates as annotations | `PLAN.md:26` |
| PLAN P3 exit | "the handoff test asserts both digests, scope, pins, producer, attributes and typed candidates"; "the census rows for the nlp Handoff and Graph spans are `deleted`"; `rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers` empty | `PLAN.md:26` |
| SPEC L2 acceptance | the handoff "mints verified receipts and emits annotations with both digests, scope, extractor and normalization pins, producer, attributes and typed `RelationCandidate`/`CorefCandidate` records"; Entity, Relation, Provenance and the nlp Handoff and Graph spans deleted | `SPEC.md:403-415` (L2 acceptance row) |
| SPEC Constraints | schema first; `HashMap`/`HashSet` carriers; `Effect.fn`; `annotation` rdf-free with codecs in an adapter subpath; capability imports modeling, never the reverse; one digest format with a versioned domain tag; stored rows convert on read; spans carry ids, digests and counts, never quote or matter text | `SPEC.md:238-313` |
| SPEC error boundaries | `Ambiguous`, `NotFound`, `Unmapped`, a refused admission and a failed re-verification are values, not errors; driver and internal errors die in adapters, port errors in use-cases | `SPEC.md:301-305` |
| Ledger `L2-1`..`L2-6` | merge laws, id invariance under target order, attribution per (content, activity), referential integrity and the checked decode entrypoint, containment, the OA/NIF codec; all `planned` in `packages/foundation/modeling/annotation/test/` | `research/law-test-plan.md:16-21` |
| Census b | Handoff contract: adapt, rehome into `@beep/annotation` in P3 (40 lines / 10 files); `Span`, `Provenance`, `Entity`, `Relation` retire in P3; `AnnotatedDocument`, `Mention`, `TextChunk` rehome; `UnitInterval` re-export retires to `@beep/schema/UnitInterval`; Graph `Schema` adapts into annotation kinds in P3 (147 / 10); Graph `Span` retires in P3; Ontology `Kind` folds into the kind registry in P3 | `research/consumer-census.md:152-164` |
| Census f rows 3, 4 | nlp Handoff `Span` (20 / 9, retire P3, "empty spans allowed"); nlp Graph `Span` (0 direct, retire P3, "floats admitted") | `research/consumer-census.md:316-317` |
| Census h | langextract handoff "adapt in P3": ids `${documentId}:mention:${index}`, one chunk, `relations: A.empty()`, "no source or text digest"; langextract alignment mints no `VerifiedTextAnchor`; `VerifiedSpan` conversion moves to `@beep/text` | `research/consumer-census.md:480-482` |
| Decision p0-items4-6-9 | one capture per document; anchors key = occurrence hash of the row; key checks effectful, run by the constructor and by the one checked decode entrypoint; records carry no id field | `decisions/2026-11-19-p0-items4-6-9-annotation-document-shape.md` |
| Decision p0-routing | `@beep/annotation` is `foundation/modeling`; named consumers at creation: the langextract handoff, the semantica projection, the office-action flow | `decisions/2026-11-19-p0-routing-annotation-asset-pack-and-write-tool-host.md` |
| Decision p0-chapter-11-amendment | the handoff contract is an encoding with no stored rows: bump the version, regenerate fixtures; where rows are stored the stored-format law governs | `decisions/2026-11-19-p0-chapter-11-amendment-yields-to-the-stored-format-law.md` |
| Decision p0-activity-id | `ActivityId` is minted at run start from (activity/v1, operation term, pin, prompt digest, sorted used ids, start time) | `decisions/2026-11-19-p0-activity-id-minted-at-start.md` |
| Decision p2-langextract-and-law-quotes | P3 rewrites the handoff and `IrToLaw`; langextract `TextOffsetRange`/`Utf16TextRange` move in P3; "`GroundedExtraction` and the attempt records that embed it stay byte-identical" (in P2) | `decisions/2026-11-22-p2-langextract-and-law-quotes-move-in-p3.md` |
| Decision p2-occurrence-id | `mintOccurrenceId` takes the powerless `Anchored`; the proof gate stays with the caller that holds a `VerifiedTextAnchor` | `decisions/2026-11-22-p2-occurrence-id-minting-and-proof-gate.md` |
| PLAN execution note | the PR that moves L2 out of `ops/design` re-points every import of `L2.annotation.ts` and drops its `opsScripts` row | `PLAN.md:90-95` |

## 2. The handoff today

### 2.1 `@beep/langextract/Handoff` (167 lines in 3 files)

- `toAnnotatedDocument(input: AnnotatedDocumentInput): Contract.AnnotatedDocument` is pure and synchronous
  (`src/Handoff/Handoff.behavior.ts:86`). It builds one `Provenance` from `generatedBy`, `source: input.documentId`
  and `timestamp` (`:87-91`), one chunk id `${documentId}:chunk:0` (`:92`), keeps only the four aligned cases
  (`:93`, filter at `:32-37`) and drops `unaligned` silently, then per aligned extraction emits a `Mention`
  (`chunkId`, id `${documentId}:mention:${index}`, `span: extraction.span`, `text: extraction.matchedText`) and an
  `Entity` (`canonicalName: extraction.text`, id `${documentId}:entity:${index}`, `mentions: [mentionId]`,
  `type: extraction.label`, `confidence` when present) (`:39-60`). The single `TextChunk` spans
  `[0, Str.length(input.text))`, kind `document` (`:96-104`). `relations` is always empty (`:111`), version
  `nlp-ir/1.1` (`:112`).
- `AnnotatedDocumentInput` (`src/Handoff/Handoff.model.ts:155-167`): `documentId: DocumentId` (from `@beep/nlp/Core`),
  `extractions: S.Array(GroundedExtraction)`, `generatedBy: S.String`, `text: S.String`, `timestamp: S.Finite`. No
  `SourceTextIdentity`, no digest, no scope, no extractor pin.
- Index (`src/Handoff/index.ts`) re-exports both files.
- Importers outside langextract: 0 (`rg -l "@beep/langextract/Handoff" packages apps goals scratchpad`, excluding the
  package). One src caller: `src/Service/Service.layer.ts:90-98`.

What is lost today, by field: no capture identity (only a free `documentId` string), ids from array position (two runs
with a reordered model output give different ids), every aligned label becomes an `Entity`, unaligned candidates
vanish, `ExtractionCandidate.attributes` (`src/Extraction/Extraction.model.ts:156-169`) and `alignmentStatus` are
dropped, the model's `text` and the source `matchedText` are split across `Entity.canonicalName` and `Mention.text`.

### 2.2 `@beep/nlp/Handoff/Contract` (553 lines; `index.ts` 44)

| Member | Line | Shape | P3 disposition (census b) |
| --- | --- | --- | --- |
| `ChunkId`, `MentionId`, `EntityId`, `RelationId` | 48, 84, 120, 156 | `S.String` branded | rehome (Chunk, Mention) / retire (Entity, Relation) |
| `ChunkKind` | 192 | `LiteralKit(["document","paragraph","sentence","token"])` | none named |
| `SpanFields` + `Span` | 213-232, 249-263 | `S.Class` `{end, start: S.Natural}`, check `start <= end`; documented as UTF-16 code units (`:261`) | retire (f-3) |
| `Provenance` | 316-328 | `{confidence?: UnitInterval, generatedBy: S.String, source: S.String, timestamp: S.Finite}` | retire |
| `TextChunk` | 353-365 | `{id, kind, provenance, span, text}` | rehome |
| `Mention` | 390-402 | `{chunkId, id, provenance, span, text}` | rehome |
| `Entity` | 427-441 | `{canonicalName, confidence?, id, mentions: MentionId[], provenance, type: S.String}` | retire |
| `Relation` | 465-480 | `{confidence?, evidence?: Span[], id, object, provenance, subject, type}` | retire |
| `AnnotatedDocument` | 514-528 | `{chunks, entities, mentions, provenance, relations, version: S.tag("nlp-ir/1.1")}` | rehome as `@beep/annotation` document |
| `makeProvenance` | 544-553 | dual constructor | retire |
| `UnitInterval` (index re-export) | `index.ts:28` | re-export of `@beep/schema/UnitInterval` | retire to upstream |

In-package tests: `packages/foundation/modeling/nlp/test/Handoff/Contract.test.ts` (pins `nlp-ir/1.1` at `:67,76`).

### 2.3 `GroundedExtraction` (`src/Extraction/Extraction.model.ts`)

- `ExtractionCandidate` (`:154-178`): `attributes: Record<string,string>` (at most 64, `MAX_CANDIDATE_ATTRIBUTES`,
  `Extraction.config.ts:60`) as `OptionFromOptionalKey`, `confidence: UnitInterval` optional, `label` (non-blank,
  bounded), `text` (non-blank, at most 4,096).
- Aligned fields (`:187-191`): the candidate fields plus `matchedText: S.NonEmptyString` and `span: Contract.Span`.
  `GroundedExtraction` (`:400-411`) is `S.Union` of five `S.Opaque` cases with `alignmentStatus: S.tag(...)`
  (`match_exact` `:217`, `match_lesser` `:255`, `match_minimal_fold` `:292`, `match_fuzzy` `:333`, `unaligned` `:364`),
  `S.toTaggedUnion("alignmentStatus")`. `unaligned` has no span and no matched text.
- `LangExtractRequest` (`:458-486`): `documentId`, `examples`, `options`, `targets`, `text` (at most 1,000,000 code
  units, `Extraction.config.ts:28`). No source identity.
- `LangExtractResult` (`:558-570`): `annotatedDocument: Contract.AnnotatedDocument` (`:560`), `diagnostics`,
  `documentId`, `extractions: S.Array(GroundedExtraction)`, `text`.
- The span is produced by `spanFromMatch` (`src/Alignment/Alignment.behavior.ts:75-79`) from `[start, matchedText]`;
  `matchedText` is the source slice (`:222-233`), so an aligned extraction is a candidate `TextAnchor`
  `{startChar: span.start, endChar: span.end, quote: matchedText}`. `SpanFromMatch` (`src/Alignment/Alignment.model.ts:329`)
  decodes to `Contract.Span`. Alignment refuses an ambiguous match (`findUniqueMatch`, `Alignment.behavior.ts:41-56`).

### 2.4 Where the handoff runs: `LangExtractService`

- `LangExtractServiceShape.extract: (request) => Effect<LangExtractResult, LangExtractError>`
  (`src/Service/Service.service.ts:33-35`); `LangExtractService` is a `Context.Service` (`:126-128`).
- `make` (`src/Service/Service.layer.ts:50-120`): prompt, `languageModel.generateText`, `parseModelOutput`,
  `alignCandidates(candidates, AlignmentSource.fromRequest(request))` (`:88`), `Clock.currentTimeMillis` (`:89`),
  `toAnnotatedDocument` with `generatedBy: GENERATED_BY` (`"@beep/langextract"`, `:32`) (`:90-98`).
- `layer: Layer.Layer<LangExtractService, never, LanguageModel.LanguageModel>` (`:172-175`). No `Digest.Digest` in
  the requirement, so the service can mint no hash today.
- Layer composition sites outside src (each must also provide `Digest` if the requirement grows):
  `packages/law-practice/server/src/Layer.ts:38`, `apps/labs/semantica/src/layers/ExtractorLive.ts:799`,
  `apps/labs/lejeune-bolt-workbench/server/provider-smoke.ts:366`, `packages/law-practice/server/test/LawPracticeServer.test.ts:57`,
  `packages/foundation/capability/langextract/test/Service.test.ts:112,164,192,227,254`.
- Instrumentation shard `standards/instrumentation-catalog/@beep/langextract.generated.jsonc`: 14 spans, none on the
  handoff (`LangExtractService.extract` and `.make`, `VerifiedSpan.*`, `LangExtract.parseModelOutput`, policy).

### 2.5 nlp Graph `Span` (census f-4)

`packages/foundation/modeling/nlp/src/Graph/Schema.ts:358`: `S.Opaque` over `{start: S.Finite, end: S.Finite}`, no order
check. Embedded in `EntityNode.span` (`:386-391`) and `RelationParticipant.span` (`:510-511`). Readers and writers of
the field: `packages/drivers/wink/src/WinkBackend.service.ts:123-129` (constructs with `confidence: 1` and
`span: findSpan(text, detail.value)`, `:54`), `apps/labs/semantica/src/layers/ExtractorLive.ts:690-718` (reads
`entity.span`, refuses non-natural, empty or width-mismatched spans as `fabricated-span`),
`packages/foundation/capability/nlp-processing/test/Graph/AnnotatedTextGraph.test.ts:64`,
`apps/labs/semantica/test/Extractor.test.ts:399`. `@beep/nlp/Graph` importers outside nlp: 10 files (nlp-processing 6,
wink 2, semantica 2); Graph schema usage lines by the heuristic of section 0: 105 (census: 147).

## 3. How verified receipts are minted today

Receipt-minting calls in source (`verifySourceTextIdentity`, `verifyTextAnchor`, `verifyTextAnchorAgainstVerifiedSource`,
`toTextAnchorVerificationReceipt`, non-test, non-comment): 20 files. The pattern every site follows is
`verifySourceTextIdentity(VerifySourceTextIdentityInput{expectedSource, source, sourceText})` (needs `Digest`, returns
the private `VerifiedSourceText`, `packages/foundation/modeling/text/src/VerifiedTextAnchor.ts:587`), then
`verifyTextAnchorAgainstVerifiedSource({anchor, verifiedSource})` (no requirement, fails with
`VerifiedTextAnchorError` reasons `cross-scope | invalid-anchor | quote-mismatch | stale-source`, `:87-97`, `:639`), then
`toTextAnchorVerificationReceipt` (`:523`) to the persisted `TextAnchorVerificationReceipt {anchor, source}` (`:354-367`).

| Site | What it verifies | Relevance to P3 |
| --- | --- | --- |
| langextract `VerifiedSpan` (`src/VerifiedSpan/VerifiedSpan.behavior.ts:579-609`, `:661`, `beginVerifiedSpanHistory` `:725`) | re-locates each candidate's model `text` in the source (`locateGroundedExtractions` `:487`, which ignores `extraction.span`), verifies each anchor, stores `VerifiedSpanCandidateAnchorReceipt {candidateIndex, receipt}` (`VerifiedSpan.model.ts:462-476`) in an attempt record that also checks `matterRef` against both `scopeRef`s and the normalization version (`VerifiedSpan.behavior.ts:623-640`) | the one receipt path inside `@beep/langextract`; no caller outside the package (`rg VerifiedSpanHistory\|beginVerifiedSpanHistory` outside: 0) |
| langextract Alignment, Extraction, Handoff, Service, Target | nothing: 0 references to `VerifiedTextAnchor`, `verifyTextAnchor`, `TextAnchorVerificationReceipt`, `SourceTextIdentity` or `@beep/text` | the handoff mints no receipt |
| law-practice citation (`server/src/internal/Citation/Mention.ts:157-227`, `Document.ts:354-402`, `OccurrenceProjection.ts:209`, `SixFormProjection.ts:199`, `ResolutionInput.ts:161-180`, `SourceEvidence.ts:65`, `CanonicalSource.ts:162`, `MentionIdentity.ts:169`) | citation mentions; `makeCitationMentionId` accepts only a `VerifiedTextAnchor` and projects it to its receipt before minting (decision p2-occurrence-id) | the model for "mint over a receipt, gate on a proof" |
| office-action structure (`use-cases/src/OfficeActionStructure/OfficeActionStructure.service.ts:88-91`, `server/src/OfficeActionStructure/OfficeActionStructure.layer.ts:37-38,90,144`, `domain/src/internal/officeActionFixture.ts:55`) | finality and period anchors; then converts receipts back into `GroundedExtraction.match_exact` with `span: {start, end}` (`OfficeActionStructure.service.ts:45-57`, `OfficeActionStructure.layer.ts:41-49`) to store them | the reverse direction (receipt to `GroundedExtraction`) exists and is stored, section 6 |
| semantica `CanonicalizerLive.ts:43`; epistemic `ClaimEvidenceReview.service.ts:56,105`, `ContradictionTriage.layer.ts:320`; `CandorPolicy.service.ts:144`; `apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts:997,1052` | claim evidence anchors | not handoff |
| `@beep/text` itself (`Reanchoring.ts:259-269`, `VerifiedTextAnchor.ts:724-731`), `@beep/md` (`Md.anchors.ts:62`) | re-anchoring and AST source maps | `Anchored.make({ receipt })` after verification is the pattern `reanchor` already uses |

The capture identity the handoff would need exists upstream of both live callers in one case only:
`apps/labs/semantica` passes `ResolvedSourceText {identity: SourceTextIdentity, text}`
(`packages/foundation/capability/file-processing/src/SourceText/SourceText.schema.ts:122-131`) and builds the request
from `canonical.identity.sourceRef` and `canonical.text` (`ExtractorLive.ts:321-328`). The office-action review builds
its request from `ProcessFileResult` text and `DocumentId.make(input.operationId)`
(`packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:118-140`); `ProcessFileResult`
(`file-processing/src/Extraction/Extraction.schema.ts:446`) carries no `SourceTextIdentity`.

## 4. What P2 provides (`packages/foundation/modeling/text`, `@beep/text`, exports `./*` to `src/*.ts`)

| Symbol | File:line | Use on the source side |
| --- | --- | --- |
| `SourceTextIdentity` (scope, source ref, locator, both digests, extractor `{name, version}`, normalization version) | `src/SourceTextIdentity.ts:185-212` | the document's `text`; "both digests, scope, pins" of the PLAN exit are its fields |
| `verifySourceTextIdentity`, `verifyTextAnchorAgainstVerifiedSource`, `verifyTextAnchor`, `toTextAnchorVerificationReceipt` | `src/VerifiedTextAnchor.ts:587, 639, 721, 523` | the receipt mint |
| `TextAnchorVerificationReceipt` | `src/VerifiedTextAnchor.ts:354` | the value an anchors row holds |
| `Anchored {receipt}` with statics `range` (UTF-16 `Position`), `quote`, `source` | `src/Occurrence.ts:80-149` | anchors table value |
| `OccurrenceId` (brand over `ContentHash`), `OccurrencePreimage` (`occurrence/v1`, golden `sha256:68270708…`), `mintOccurrenceId: Anchored -> Effect<OccurrenceId, PreimageMintError, Digest>` | `src/Occurrence.ts:168, 290-310, 339-344` | anchors key; annotation target |
| `Position {unit, start, end}` (start < end), `OffsetUnit`, `convertPosition`, `slicePosition`, `UnitConversionRefused` (`split-boundary`, `out-of-range`, `ill-formed-text`) | `src/OffsetUnit.ts:40, 81, 116, 155, 195, 223` | replacement for `Contract.Span` and `Utf16TextRange`; OA code-point offsets (L2-6) |
| `Selector`, `resolve`, `Resolution` (`Unique`, `Ambiguous{count}`, `NotFound`) | `src/Selector.ts:171`, `src/Resolution.ts:50, 245` | L2-6 "preserves `resolve`" |
| `QuoteKey`, `mintQuoteKey` (`quote-key/v1`, not injective) | `src/QuoteKey.ts:91, 192` | grouping only, never an id |
| `reanchor`, `LocatorMap`, `Reanchoring` | `src/Reanchoring.ts:223`, `src/LocatorMap.ts:248` | not on the handoff path |

Beside `@beep/text`: `mintContentHash` and `definePreimage`/`PreimageRegistry` (`packages/foundation/modeling/jsonc/src/Mint.ts:71, 542, 591`);
`ActivityStart` with `ActivityPin` (`Engine {engine, edition}` | `Model {model, version}`), `promptDigest` optional,
`used: CanonicalHashSet(ContentHash)`, `started: DateTimeUtcFromMillis`, and `mintActivityId`
(`packages/foundation/modeling/jsonc/src/ActivityStart.ts:50, 86-95, 160-182, 221`); `ContentHash`, `DomainTag`,
`ActivityId` (`packages/foundation/modeling/schema/src/ContentHash.ts:49, 91, 139`); `CanonicalHashSet`
(`packages/foundation/modeling/schema/src/CanonicalHashSet.ts:64`). `SourceTextDigest` and `ContentHash` share the
encoded form `sha256:<hex>` but are different brands (`SourceTextIdentity.ts:31-35`, `ContentHash.ts:49-52`).

Registry: every term of the OA profile (decision p0-item7) is declared in
`packages/foundation/modeling/identity/registry/namespaces/{oa,prov,dcterms,as,nif,rdf}.json` (27 of 27 local names
found by `grep -c`). No `annotation` namespace shard exists (`rg -c "ns/annotation"
packages/foundation/modeling/identity/src/internal/generated/Registry.data.ts` is 0; 34 shard files, none for it), while
`ops/design/L2.annotation.ts:315-429` mints ten kind IRIs `https://beep-effect.com/ns/annotation/<Kind>` with
`TermIri.make`. No `@beep/annotation` package and no `$AnnotationId` exist yet.

## 5. Consumers P3 touches on the source side

| Surface | Files (outside owner) | Usage lines | Detail |
| --- | --- | --- | --- |
| `@beep/nlp/Handoff` importers | 12 (langextract 10, semantica 2) | `Contract.*` 29 non-comment lines; census 40 / 10 | members: `Span` 15 lines in 9 files; `AnnotatedDocument` 3 files; `Provenance` 3; `Mention`, `MentionId`, `Entity`, `EntityId`, `ChunkId`, `TextChunk` only in `Handoff.behavior.ts`; `Relation` 0. `Service.service.ts:70` imports it in JSDoc only |
| `UnitInterval` via `@beep/nlp/Handoff` | 8 | 19 (census 24) | langextract `Alignment.{model,config,behavior}`, `Extraction.model`, 3 tests; semantica `ExtractorLive.ts:18,325,425` |
| `Contract.Span` in `GroundedExtraction` | n/a | n/a | `Extraction.model.ts:190`; every `GroundedExtraction` value carries it |
| `GroundedExtraction` outside langextract | 12 | 55 non-import lines | IrToLaw ports 4 and service 10 (by `rg -c`); semantica `ExtractorLive.ts` 14 and test 5; law-practice `OfficeActionStructure` ports 3, service 7, server layer 3, server test 3, use-cases test 10; lejeune `provider-smoke.ts`, `Normalize.ts`, `Rules.ts` 2 each |
| PLAN exit command | 3 files | 30 lines (`rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers`, comments included) | `ExtractorLive.ts` 15, `IrToLaw.service.ts` 11, `IrToLaw.ports.ts` 4 |
| `LangExtractResult.annotatedDocument` readers | 2 | 4 | `langextract/test/Service.test.ts:137-139`; constructed in `apps/labs/semantica/test/Extractor.test.ts:115`. No src reader |
| `LangExtractResult.extractions` readers | 4 src or test | | `OfficeActionReview.service.ts:261` (into `irToLaw.toLaw`), `ExtractorLive.ts:675`, `provider-smoke.ts:291`, `LawPracticeServer.test.ts:93,157,166` |
| `IrToLaw` | ports, service, errors | | `toLaw: ReadonlyArray<GroundedExtraction> -> Effect<LawEntities, IrToLawExtractionError>` (`IrToLaw.ports.ts:54-60`); reads `label`, `text`, `alignmentStatus`, `span`, `matchedText` and builds an unverified `TextAnchor` (`IrToLaw.service.ts:55-99`); error carries `alignmentStatus` (`IrToLaw.errors.ts:10,96`); stale header comment (`IrToLaw.ports.ts:8-14`) |
| semantica `ExtractorLive` | 1 | | reads `label` (`StructureRole`, "relation"), `attributes` (`depth`, `cluster`, `subject`, `predicate`, `object`; `:343-356`, `:412-420`), `confidence` (`:238-239` defaults to `1`), `span`/`matchedText` (`:384-391`), and turns `unaligned` into `DegradedClaim` (`:577`); relation endpoints are re-aligned inside the evidence quote (`:422-437`) |
| `@beep/nlp/Core` `DocumentId` in langextract | 15 files import `@beep/nlp/Core` | | `LangExtractRequest.documentId`, `AnnotatedDocumentInput.documentId`; census b moves Core to `@beep/nlp-processing` in P6 |
| langextract `VerifiedSpan` ranges | 9 importer files outside (law-practice 4, lejeune 3, goal ops 2) | 23 lines of the range and locate names | decision p2-langextract-and-law-quotes puts their re-expression in P3 |
| Design module | 4 references | | `ops/design/index.ts:59`, `generators.ts:78,82`, `L6.interchange.ts:27,31`; `ops/manifest.json:159` `opsScripts` row |

Package edges: `@beep/langextract` depends on `@beep/identity`, `@beep/nlp`, `@beep/schema`, `@beep/text`, `@beep/utils`
(`packages/foundation/capability/langextract/package.json:78-82`). semantica, law-practice server and use-cases each
depend on `@beep/langextract` and `@beep/nlp`.

## 6. Stored and frozen bytes

| Bytes | Holder | Shape that P3 would change | Status today |
| --- | --- | --- | --- |
| `nlp-ir/1.1` `AnnotatedDocument` | in memory only (`LangExtractResult.annotatedDocument`) | the whole envelope | no stored row, no fixture file; literals in 2 tests (`langextract/test/Handoff.test.ts:71`, `nlp/test/Handoff/Contract.test.ts:67,76`) and one test fake (`semantica/test/Extractor.test.ts:121`). Under the chapter-11 amendment it may change with a version bump |
| office-action attempt log rows | `officeActionStructureFileStore` JSON lines (`packages/law-practice/server/src/OfficeActionStructure/OfficeActionStructure.repo.ts:61`); schema `OfficeActionStructureAttempt.extractions: S.Array(GroundedExtraction)` (`use-cases/src/OfficeActionStructure/OfficeActionStructure.ports.ts:183-203`) | encoded `GroundedExtraction`, i.e. `span: {"end":…,"start":…}` and `alignmentStatus` | stored format. Frozen fixture `packages/law-practice/server/test/fixtures/office-action-attempts-v1.jsonl` (2 rows, 3,457 bytes) read through `test/officeActionFixtures.ts:3`; `OfficeActionStructure.test.ts:327` asserts a fresh write equals the frozen bytes and `:331-347` that every frozen row re-encodes to the same line. The store has no caller outside that test (P2 design section 7) |
| `VerifiedSpanAttemptRecord` | schema says "persisted" (`VerifiedSpan.model.ts:544-546`); `candidates: S.Array(GroundedExtraction)` (`:584-596`), receipts in `outcome` | encoded `GroundedExtraction` | no store and no fixture file in the repo; no caller outside langextract |
| anchor receipts | `law_practice_*.grounding` jsonb (`TextAnchorVerificationReceipt`) | none: `Anchored` wraps the same receipt shape | unchanged by P3 |
| semantica provider cache | `ProviderCacheEntry {response, responseDigest}`, key over `sha256(buildPrompt(request))` (`apps/labs/semantica/src/schema/ProviderCache.ts:77-133`, `ExtractorLive.ts:330-339`) | the prompt reads only `examples`, `targets`, `text` (`langextract/src/Service/Service.prompt.ts:85-94`) | a new request field leaves keys unchanged as long as the prompt text does not change |
| semantica gold and f1 fixtures | `apps/labs/semantica/fixtures/**` | none | 0 of the JSON fixtures contains `alignmentStatus`, `matchedText` or `nlp-ir` |
| other `matchedText` JSON | eyecite and bluebook fixtures under `packages/law-practice/*/test/fixtures` | none | citation-engine shapes (0 `alignmentStatus`), not handoff bytes |

Negative tests that depend on today's span shape: `packages/law-practice/use-cases/test/OfficeActionStructure.test.ts:148`
and `:191` build empty spans (`start == end`) and `:177` an inverted one; `Contract.Span` decodes the empty ones, a
`Position` would refuse them at decode.

## 7. Today's output against the L2 design (`ops/design/L2.annotation.ts`)

| Today (`Handoff.behavior.ts`, `Contract.ts`) | L2 design | Gap |
| --- | --- | --- |
| `Provenance.source = documentId` | document `text: SourceTextIdentity` (`:144`, `:258`) | no identity reaches the handoff (section 3) |
| `Provenance.generatedBy = "@beep/langextract"`, `timestamp` (`S.Finite` ms) | `Generation {run, content, activity: ActivityId, at: DateTimeUtcFromMillis}` (`:59-66`), `run` = hash of (`generation/v1`, content, activity) (`:519-525`) | `ActivityStart` needs an operation term IRI, a model pin and the used ids; the service knows the prompt but not the model identity |
| `Provenance.confidence`, `Entity.confidence = extraction.confidence` | no confidence anywhere in L2 | confidence is an L4 signal; L2 has no field for it |
| `Mention.span` + `Mention.text` | anchors row `OccurrenceId -> Anchored` (`:259`); annotation `targets` (`:69-82`) | receipt minting, `Digest` |
| `Mention.id`, `Entity.id` from index | `AnnotationId` content hash of (`annotation/v1`, sorted targets, kind IRI, encoded body) (`:480-516`); records carry no id | design still uses `mintContentHash` with a local sort (`:494-505`); its comment says P3 moves it to `definePreimage` with `CanonicalHashSet` |
| `Entity.type = label`, `canonicalName = text` | `Mention {class: TermIri}` (`:271-275`) | label is a free string; model `text`, `attributes`, `alignmentStatus` have no field |
| `Mention.chunkId`, one whole-text `TextChunk` | `Chunk {ordinal}` (`:278-282`); a Mention body has no chunk link | an empty request text has no anchor |
| `relations: []` | `RelationCandidate {subject, predicate: TermIri, object}` (`:285-291`), `CorefCandidate {members ≥ 2}` (`:294-309`) | no producer: the only relation and cluster conventions are semantica's attribute names |
| unaligned candidates dropped | `Targets` non-empty (`:69-79`) | a lossless handoff has no place for them |
| `version: "nlp-ir/1.1"` | no version field; schema identity is the caller-owned `S.Opaque` (`:440-444`) | where the handoff's document schema lives |
| decode through the bare schema (`LangExtractResult` is an `S.Opaque`) | one checked decode entrypoint (`makeCheckedDecode`, `:745-761`) | decoding a `LangExtractResult` that embeds a document would bypass key verification |

## 8. Inventories and generated artefacts on the source side

| Artefact | Entries today | P3 effect |
| --- | --- | --- |
| `standards/schema-first.inventory.jsonc:689-695` | 1 (`SpanFields` exception, `@beep/nlp`) | leaves with `Contract.Span` (S31 count falls) |
| `goals/schema-opaque-default/ops/codemod/keep-class.jsonc:639-640` | 1 (`SpanFields`) | stale once the class is gone |
| `standards/coverage.regression-baseline.jsonc` | langextract 23 rows (Handoff `:17762,17774,17786`); nlp Handoff and Graph 5 (`:28643-28691`) | rows move or leave by rename |
| `standards/schema-catalog/@beep/nlp.generated.jsonc` | 11 rows naming `Handoff`, 13 naming `Graph/Schema` | regenerated |
| `standards/schema-catalog/@beep/langextract.generated.jsonc` | 1 row naming `Handoff` | regenerated |
| `standards/instrumentation-catalog/@beep/langextract.generated.jsonc` | 14 spans | gains any handoff or minting span |
| `standards/cache-baseline/@beep/*.json` naming langextract | 5 files | regenerated |
| langextract in-package suppressions | 1 (`VerifiedSpan.model.ts:559`, `fallow-ignore`) | unchanged unless the file moves |

## 9. Open questions for the design (numbered)

1. **Capture identity.** `LangExtractRequest` and `AnnotatedDocumentInput` carry no `SourceTextIdentity`. Does the
   request gain one (semantica has `canonical.identity`; the office-action review has none, since `ProcessFileResult`
   carries none), does the handoff take a `VerifiedSourceText` from the caller, or does the service verify
   `request.text` against a supplied identity (needs `Digest`)?
2. **Which locator mints the receipt.** Verify the alignment candidate `{span.start, span.end, matchedText}` directly,
   or re-locate through `VerifiedSpan.locateGroundedExtractions`, which ignores `span` and searches for the model
   `text` (`VerifiedSpan.behavior.ts:487-525`)? For `match_fuzzy`, `match_lesser` and `match_minimal_fold` the two can
   disagree, and only the second checks `matterRef` and the normalization version.
3. **Failed verification of an aligned candidate** (split surrogate, past the end, quote mismatch): a typed
   `LangExtractError` reason for the whole run, a dropped candidate with a diagnostic count, or a recorded refusal
   value (SPEC error boundaries make a failed re-verification a value)?
4. **Unaligned candidates.** The design requires non-empty targets, yet the handoff is to be lossless and
   semantica reports unaligned candidates as `DegradedClaim` (`ExtractorLive.ts:577`). Kept in `LangExtractResult`
   beside the document, in a residual like the OA decoder's, or dropped?
5. **`Digest` in the service.** Minting needs `Digest.Digest`. Does `LangExtractServiceShape.extract` gain it in `R`,
   or does `layer` require it (`Service.layer.ts:172`) and close over it? Either way five composition sites change
   (section 2.4).
6. **The handoff's `ActivityId`.** `ActivityStart` needs an operation term IRI (none is declared for extraction),
   a pin (`LanguageModel.LanguageModel` exposes no model identity; semantica has `ActiveModelIdentity`), the prompt
   digest (available at `Service.layer.ts:60`) and the used ids (the capture's `textDigest` is a `SourceTextDigest`,
   not a `ContentHash` brand). What replaces `GENERATED_BY`, and is the import-activity rule of decision p0-item7 the
   model for a run with no model pin?
7. **Kind IRIs.** No `annotation` namespace shard exists. Does P3 add one with the ten kind terms (a term-snapshot
   release under `L0-3` and the identity-registry lint), and who owns extraction-label terms?
8. **Label to `Mention.class`.** The label is a free string (`ExtractionCandidateLabel`); `Mention.class` is a
   `TermIri`. Is the mapping supplied by the caller per request target (`ExtractionTarget.name`), declared by the
   consumer's label domain (`OfficeActionExtractionLabel`, semantica `StructureRole`), or is the label carried as a
   literal body field?
9. **Fields with no home in the design:** the model `text` (`Entity.canonicalName` today), `attributes` (named by the
   PLAN exit), `alignmentStatus` (read by `IrToLawExtractionError`, `IrToLaw.errors.ts:96`). A wider `Mention` body,
   a separate extraction kind, or a record outside the content hash? Putting them in the body changes `AnnotationId`
   per run when the model rephrases.
10. **Extractor confidence.** `GroundedExtraction.confidence` and `Provenance.confidence` have no L2 field and P4 owns
    signals. Does P3 drop it from the document and keep it on `GroundedExtraction`, so P4 reads it there?
11. **Who mints `RelationCandidate` and `CorefCandidate`.** The generic handoff has no relation convention; semantica
    reads `label == "relation"` with `subject`/`predicate`/`object` attributes and a `cluster` attribute, and resolves
    endpoints inside the evidence quote (`ExtractorLive.ts:412-437`). Does the handoff take a caller-supplied candidate
    mapping, or does semantica build the candidates over the emitted document?
12. **`Chunk`.** Keep the whole-text chunk (redundant with the capture, impossible over empty text) or emit chunks
    only from a real chunking pass? The design `Mention` has no chunk link, so `Mention.chunkId` has no successor.
13. **`Contract.Span` versus stored `GroundedExtraction`.** Retiring `Contract.Span` changes the type of
    `GroundedExtraction.span`, whose encoded bytes are stored in the attempt log and pinned by
    `OfficeActionStructure.test.ts:327,347`. Keep a langextract-owned schema with the same `{start, end}` encoding,
    move to `Position` (encoded `{_tag, unit, start, end}`) with a declared read-time transform for `v1` rows, or bump
    `OfficeActionStructureAttempt.schemaVersion`? The empty-span negative tests (section 6) move from verification to
    decode under `Position`.
14. **`LangExtractResult` shape.** Does it keep `extractions` beside the new document? The exit command forbids
    `GroundedExtraction` only in `IrToLaw` and `semantica/src/layers`; `OfficeActionStructure`, lejeune and
    `VerifiedSpan` keep reading it.
15. **The document schema the handoff emits.** A langextract-owned `S.Opaque` over `makeAnnotationDocument(ExtractionKinds)`,
    or the annotation package's own extraction document? Which registry: `ExtractionKinds` only, or `DocumentKinds`
    so a later structure pass merges into the same document type (L2-1 merges over compatible documents)?
16. **Checked decode at the result boundary.** `LangExtractResult` decodes through the bare schema. Does the result
    stop embedding the document as a schema field, or does the service export a checked result decode built on
    `makeCheckedDecode`?
17. **Graph scope.** Census b says Graph `Schema` adapts into annotation kinds in P3 (147 lines); the PLAN exit asks
    only that the Graph `Span` row read `deleted`. Does P3 replace only `EntityNode.span`/`RelationParticipant.span`
    (with what: `Position`, a receipt?) or move the node schemas? `@beep/nlp-processing` and the wink driver would then
    depend on `@beep/annotation` or `@beep/text`.
18. **The `UnitInterval` re-export** (19 lines in 8 files): retired to `@beep/schema/UnitInterval` in P3 with the
    Handoff move, or left for P7?
19. **`DocumentId`** from `@beep/nlp/Core` in the request and the handoff input: kept on `@beep/nlp` until P6 moves
    Core, or replaced by the capture's `sourceRef` now?
20. **`VerifiedSpan` ranges.** Decision p2-langextract-and-law-quotes moves `TextOffsetRange`/`Utf16TextRange` to the
    text position in P3. Same PR as the handoff, and with which refusal mapping (`convertTextOffsetRange` keeps its own
    behaviour on ill-formed text, decision p2-unit-conversion-refuses-ill-formed-text)?
21. **Generation time.** `Clock.currentTimeMillis` gives an integer; `Provenance.timestamp` admits any finite number
    and `AnnotatedDocumentInput.timestamp` is `S.Finite`. Is `at` the run start (the `ActivityStart.started` value) or
    the handoff time, and is it one value for every annotation of a run?
22. **Scope check.** `VerifiedSpan` refuses a source whose `scopeRef` differs from `matterRef`
    (`VerifiedSpan.behavior.ts:623-640`); `verifySourceTextIdentity` refuses `cross-scope` between expected and
    supplied identity. Which of the two does the handoff run, and against which expected identity?
23. **Spans and attributes.** Which new spans (`Concept.action` per chapter 12) does the handoff add, and which ids or
    counts do they carry (never quote text)?
24. **Ontology `Kind`** (714 lines, 0 importers outside nlp): folded into the kind registry in P3 as census b says,
    or deleted with the package in P7?

## Appendix: commands

```sh
git ls-files -z -- '*.ts' '*.tsx' | grep -zv '^packages/foundation/modeling/nlp/' \
  | xargs -0 rg -l -U "from\s*[\"']@beep/nlp/Handoff(/[^\"']*)?[\"']"                                 # 12 files
rg -n 'Contract\.Span' packages apps --type ts -g '!packages/foundation/modeling/nlp/**' | grep -v ':\s*\*' # 15 lines, 9 files
rg -n "\bGroundedExtraction" packages apps goals scratchpad --type ts \
  -g '!packages/foundation/capability/langextract/**' | grep -v "import " | wc -l                      # 55
rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers | wc -l # 30
rg -c "VerifiedTextAnchor|verifyTextAnchor|TextAnchorVerificationReceipt|SourceTextIdentity|@beep/text" \
  packages/foundation/capability/langextract/src/{Alignment,Extraction,Handoff,Service,Target}          # 0 each
rg -l "toTextAnchorVerificationReceipt\(|verifyTextAnchor\(|verifyTextAnchorAgainstVerifiedSource\(|verifySourceTextIdentity\(" \
  packages apps --type ts -g '!**/test/**' -g '!**/dist/**' | wc -l                                    # 20
git grep -n -I "nlp-ir/1" -- ':!*.md'
git grep -l -I '"alignmentStatus"'                                                                     # 1 fixture
wc -lc packages/law-practice/server/test/fixtures/office-action-attempts-v1.jsonl                      # 2 3457
rg -c "ns/annotation" packages/foundation/modeling/identity/src/internal/generated/Registry.data.ts    # 0
grep -c 'Handoff' standards/schema-catalog/@beep/nlp.generated.jsonc                                    # 11
```
