# P3 map: the consumers of the annotation document (2026-11-22)

Read-only map for the P3 designer. Scope: `IrToLaw`, the office-action review and its
standing list, the semantica projection and extractor, every `GroundedExtraction` hit in
`packages` and `apps`, and the candidate shapes that become annotations. The handoff
internals (`toAnnotatedDocument`, alignment, `VerifiedSpan`) are mapped only where a
consumer reads them.

Base: the P3 lane head `1c8d9636b1d` (P3 is stacked on the P2 text branch). Effect is 4.1.5 in both
`.repos/effect/packages/effect/package.json` and `node_modules/effect/package.json`. Every
path is repo-relative and every line number is from this checkout. Counts come from the
commands in the appendix.

Governing texts: `PLAN.md:26` (P3 row); `SPEC.md:28-36` (objective item 3),
`SPEC.md:301-305` (error boundaries), `SPEC.md:403-415` (L2 acceptance), `SPEC.md:497`
(office-action standing list); `research/law-test-plan.md:16-21` (`L2-1` to `L2-6`);
the decisions `2026-11-19-p0-items4-6-9-annotation-document-shape`, `2026-11-19-p0-item7-oa-profile`,
`2026-11-19-p0-routing-annotation-asset-pack-and-write-tool-host`, `2026-11-19-p0-census-dispositions`,
`2026-11-19-p0-activity-id-minted-at-start`, `2026-11-19-p0-structure-kinds-carry-containment-levels`,
`2026-11-22-p2-langextract-and-law-quotes-move-in-p3`, `2026-11-22-p2-occurrence-id-minting-and-proof-gate`;
and the design module `ops/design/L2.annotation.ts`.

## 1. What P3 requires of the consumers

| Source | Requirement on a consumer |
| --- | --- |
| `PLAN.md:26` exit | `rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers` is empty. Today it returns 30 lines in 3 files (section 2). |
| `PLAN.md:26` exit | `OfficeActionReview.flow.test.ts` exists over the annotation document. No `OfficeActionReview` test exists in `packages/law-practice/use-cases/test` today (section 4.3). |
| `PLAN.md:26` exit | The census rows for the nlp Handoff and Graph spans read `deleted`: `research/consumer-census.md:152` (Handoff `Contract.Span`), `:162` (Graph `Span`), `:316` and `:317` (section f rows 3 and 4). |
| `PLAN.md:26`, `SPEC.md:408-409` | The handoff's `Entity`, `Relation` and `Provenance` types are deleted (census `:154`, `:156`, `:158`). `Entity` has 3 usage lines in 2 files, 2 of them construction lines in 1 file, and `Relation` has 0 (census `:156`, `:158`). |
| `PLAN.md:26`, `SPEC.md:409-410` | `IrToLaw` and the semantica projection read the annotation document. Census correction 8 (`consumer-census.md:659-663`) says neither does today. |
| `SPEC.md:405-408` | The handoff emits annotations carrying both digests, scope, extractor and normalization pins, producer, attributes and typed `RelationCandidate`/`CorefCandidate` records. Consumers read those fields (section 8). |
| `SPEC.md:411-415` | P3 creates `OfficeActionReview.flow.test.ts` in the law-practice use-cases tests on synthetic fixtures. P4 adds the signal assertions and P6 adds the law-owned structure, the assessment profiles and the admission. |
| `SPEC.md:497`, `GOAL.md:53-55` | The standing list stays green at the P3 exit: the flow test, `server/test/LawPracticeServer.test.ts`, `server/test/OfficeActionStructure.test.ts`, `use-cases/test/OfficeActionStructure.test.ts` and `use-cases/test/OfficeActionFixtures.test.ts`. |
| `SPEC.md:301-305` | `Ambiguous`, `NotFound`, `Unmapped` and a failed re-verification are values, not errors. Driver and internal errors die in adapters. Port errors are raised in use-cases. |
| decision items 4-6-9 (amended) | Wire and storage input goes through the one checked decode entrypoint: the schema, then the effectful key verification. That entrypoint needs `Digest` (`L2.annotation.ts:696-761`), and the bare schema is for composition and generators only. |
| decision p2-langextract-and-law-quotes-move-in-p3 | P3 re-expresses langextract `TextOffsetRange`/`Utf16TextRange` and law-practice `TextQuote`, `SourceRef` and `SourceQuote`. In P2, "GroundedExtraction and the attempt records that embed it stay byte-identical". |
| ledger `L2-4` (`law-test-plan.md:19`) | The checked entrypoint refuses a document whose annotation key was replaced. A consumer that decodes stored or wire documents must call it, not the bare schema. |

## 2. `GroundedExtraction`: every hit

`rg -n "GroundedExtraction" packages apps --stats` finds 257 matches on 242 lines in 25 files.

| Area | File (lines with a hit) | Role |
| --- | --- | --- |
| langextract src (8 files, 121 lines) | `Extraction/Extraction.model.ts` (51), `Alignment/Alignment.model.ts` (17), `Alignment/Alignment.behavior.ts` (13), `VerifiedSpan/VerifiedSpan.behavior.ts` (13), `Handoff/Handoff.behavior.ts` (10), `VerifiedSpan/VerifiedSpan.model.ts` (9), `Handoff/Handoff.model.ts` (6), `Service/Service.layer.ts` (2) | owner and producer: the union is defined at `Extraction.model.ts:400-418`, its cases at `:217-398`, and the aligned fields at `:187-191` (`matchedText`, `span: Contract.Span`). Alignment mints it (`Alignment.behavior.ts:498-530`) and `LangExtractResult.extractions` carries it (`Extraction.model.ts:563`) |
| langextract test (5 files, 50 lines) | `Alignment.test.ts` (16), `VerifiedSpanSpike.test.ts` (13), `Extraction.test.ts` (11), `Handoff.test.ts` (5), `VerifiedSpanHistory.test.ts` (5) | the owner's tests |
| law-practice use-cases src (4 files, 25 lines) | `IrToLaw/IrToLaw.service.ts` (11), `OfficeActionStructure/OfficeActionStructure.service.ts` (7), `IrToLaw/IrToLaw.ports.ts` (4), `OfficeActionStructure/OfficeActionStructure.ports.ts` (3) | consumer (sections 3 and 5) |
| law-practice server src (1 file, 3 lines) | `OfficeActionStructure/OfficeActionStructure.layer.ts` (3) | consumer, which writes the stored attempt log (section 5) |
| law-practice tests (2 files, 13 lines) | `use-cases/test/OfficeActionStructure.test.ts` (10), `server/test/OfficeActionStructure.test.ts` (3) | standing list |
| semantica (2 files, 20 lines) | `src/layers/ExtractorLive.ts` (15), `test/Extractor.test.ts` (5) | consumer (section 6) |
| lejeune workbench (3 files, 10 lines) | `src/workflows/Normalize.ts` (4), `src/workflows/Rules.ts` (4), `server/provider-smoke.ts` (2) | consumer outside the PLAN rg (section 7) |

The PLAN exit rg covers 30 lines today: `IrToLaw.service.ts` lines 6, 23, 55, 62, 64, 67, 69, 82, 90, 109 and 182;
`IrToLaw.ports.ts` lines 8, 13, 25 and 54; `ExtractorLive.ts` lines 5, 343, 352, 358, 381, 382, 384, 394, 395, 403, 404, 413, 498,
610 and 617. The census counted 10 lines in `IrToLaw.service.ts` (`consumer-census.md:488`) and there are 11 now.

There are 19 `GroundedExtraction.cases.<status>.make(` construction lines in 14 files.
Outside langextract they are in law-practice (`OfficeActionStructure.service.ts` 2,
`OfficeActionStructure.layer.ts` 1, `use-cases/test/OfficeActionStructure.test.ts` 7,
`server/test/OfficeActionStructure.test.ts` 1), semantica `test/Extractor.test.ts` (2) and
lejeune `Normalize.ts` and `Rules.ts` (1 each).

Three readers outside the PLAN rg depend on the type without naming it.
`OfficeActionReview.service.ts:260-261` passes `extractionResult.extractions` straight to `toLaw`.
`IrToLaw.errors.ts:10,96` imports `AlignmentStatus` for the error field.
`apps/labs/semantica/src/canary/RelationPreview.ts:196-204` builds `GroundedExtraction[]`
with `alignCandidates` and calls `groundHostedExtractions`.

## 3. `IrToLaw`

### 3.1 Contract today

- Port: `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts`. The handler type is
  `(input: ReadonlyArray<GroundedExtraction>) => Effect<LawEntities, IrToLawExtractionError>` (`:54`). It is wrapped as
  `S.declare` (`:58-60`) inside the `IrToLawShape` `S.Opaque` (`:154-162`), and the service tag is at `:195`.
  `LawEntities` is declared as an exported interface (`:46-52`) and merged with the class (`:72-96`, `:122`).
- The package doc (`:6-14`) gives a reason that census `:488` already marks stale: it says the
  envelope carries no span-bearing mentions, but `Contract.AnnotatedDocument` does carry
  `mentions: S.Array(Mention)` (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:518`).
  `packages/law-practice/use-cases/README.md:4` repeats the claim ("maps the generic `@beep/nlp` Handoff IR").
- The implementation is pure, with no `R`: `makeIrToLaw()` at `IrToLaw.service.ts:180-184`.

### 3.2 What the mapping reads from each extraction

| Read | Line | Becomes |
| --- | --- | --- |
| `label` (matched against `OfficeActionExtractionLabel`: `office_action`, `claim`, `rejection_reference`, `distinction`, `OfficeActionExtractionLabel.ts:28-37`) | `IrToLaw.service.ts:71` (`A.findFirst`, first match wins) | selects the extraction |
| `alignmentStatus` (aligned vs `unaligned`) | `:64`, `:76-77` | if unaligned, fails `required-extraction-unaligned` with the status copied into the error (`:55-60`) |
| `text` (the model's candidate text, not the source slice) | `:86` | `Claim.text` (`:124`), `OfficeAction.applicationNumber` (`:137`), `PriorArtReference.title` (`:147`), `Distinction.detail.limitation` (`:130`) |
| `span.start`, `span.end`, `matchedText` | `:94-98` | `Distinction.anchor` as a `TextAnchor` (`:128`). This is the only positional read; the other three labels contribute text only |
| `attributes`, `confidence` | never read | |

`required-extraction-missing` fires when a label is absent (`:49-53`, `:70-73`).
Entities are decoded with `spikeEntityInput` and `Effect.orDie` (`:118-155`).
`Distinction.anchor` is a bare `TextAnchor`
(`packages/law-practice/domain/src/entities/Distinction/Distinction.model.ts:64`).
`Distinction` is not persisted: `rg -il distinction packages/law-practice/tables packages/_internal/db-admin/drizzle` is empty.

### 3.3 Who consumes `IrToLaw`

| Consumer | Line | What it depends on |
| --- | --- | --- |
| `OfficeActionReview.service.ts` | `:34`, `:166`, `:261` | `toLaw(extractionResult.extractions)` |
| `OfficeActionReview.ports.ts` | `:21`, `:151-155` | `IrToLawExtractionError` in `OfficeActionReviewError` |
| `server/src/Layer.ts` | `:27`, `:36`, `:44`, `:87` | `IrToLaw.of(makeIrToLaw())`, provided through `provideMerge` |
| `server/src/PracticeKg.claims.ts` | `:24`, `:47`, `:526` | the error union catches `IrToLawExtractionError | LangExtractError` per file |
| `server/test/LawPracticeServer.test.ts` | `:9`, `:33`, `:66-81`, `:88-124`, `:151-173`, `:180-194` | reads `extractionResult.extractions` and asserts `alignmentStatus` `match_lesser` (`:100-104`) and `match_minimal_fold` (`:161-164`) before `toLaw`; asserts that the quote re-slices the fixture (`:115-117`, `:168-171`) and that the limitation is the lower-case candidate text (`:120-122`); asserts the `missing` and `unaligned` error reasons (`:177-194`, `:191` checks `alignmentStatus` `unaligned`) |
| `use-cases/test/SchemaParity.test.ts` | `:2-5`, `:36-38`, `:75-79`, `:123-127`, `:148-178` | an `IrToLawShape` decode, property round-trips, and a pinned encoded wire shape for both error reasons, including `alignmentStatus: "unaligned"` |

### 3.4 What reading the annotation document requires

Each read in 3.2 needs a home in the document (`L2.annotation.ts`):

- Selection by label becomes a selection by `Mention.class` (`TermIri`, `L2.annotation.ts:271-275`).
  It needs four office-action class IRIs. `rg -l "beep-effect.com/ns/annotation" packages apps standards`
  returns 0 files, so no annotation or law-practice extraction class is registered (Q8).
- The anchor read becomes `HashMap.get(doc.anchors, target)` followed by
  `Anchored.receipt.anchor` (`packages/foundation/modeling/text/src/Occurrence.ts:80-110`).
  That yields the same `TextAnchor` the distinction needs, from a powerless receipt.
- The candidate `text` has no field in the design `Mention` body (Q4).
- The alignment tier has no field, and unaligned candidates cannot be annotations,
  because `Targets` is non-empty (`L2.annotation.ts:69-82`) (Q5, Q6).
- `A.findFirst` over an ordered array becomes a lookup in a `HashMap` keyed by content hash,
  which has no order (Q12).

## 4. The office-action review and the flow test

### 4.1 The loop today

`makeOfficeActionReview` (`use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:246-285`) runs these steps in order:

1. `fileProcessing.process`, then `sourceTextFrom` (`:250-259`, `:118-135`, text only).
2. `LangExtractRequest.make({ documentId: DocumentId.make(input.operationId), targets, text })`
   (`:137-142`). The request has no `SourceTextIdentity` (`Extraction.model.ts:458-485`), and
   `DocumentId` comes from `@beep/nlp/Core` (`:23`).
3. `irToLaw.toLaw` (`:261`).
4. `candidateClaimOf` and `evidenceOf` (`:78-102`). `evidenceOf` hard-codes `confidence: 0.9` (`:95`); P4 retires it.
5. `gate.evaluate` (`:275`), `transition.advance` (`:279`) and `projectClaims` (`:282`).

The input (`OfficeActionReview.ports.ts:72-97`) is a fixture key, a matter key, an `operationId`, a `SourceArtifact`
(digest and text) and an `entitySeed`. It carries no scope, extractor or normalization pins.

`extractCandidate` has two consumers outside the loop: `server/src/PracticeKg.claims.ts:478-494`
(it builds an `OfficeActionReviewInput` per docketed file and persists candidate and evidence) and
`use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts:17,183,221`, which builds the same `OfficeActionCandidateExtraction`.

`server/src/Layer.ts:77-91` already requires `Digest.Digest` (`:79`), so minting receipts and
occurrence ids in the server path adds no new requirement.

### 4.2 The standing list, measured at the base

The files were run under `nice -n 19 bunx --bun vitest run <files>` in each package:

| Package | Files | Result |
| --- | --- | --- |
| `packages/law-practice/server` | `test/LawPracticeServer.test.ts`, `test/OfficeActionStructure.test.ts` | 2 files, 13 tests passed |
| `packages/law-practice/use-cases` | `test/OfficeActionStructure.test.ts`, `test/OfficeActionFixtures.test.ts` | 2 files, 6 tests passed |

These were file-scoped runs. The Verification Matrix (`SPEC.md:497`) names each package's
`bun run test`, which was not run here.

### 4.3 What `OfficeActionReview.flow.test.ts` over an annotation document needs

- Home: `packages/law-practice/use-cases/test/OfficeActionReview.flow.test.ts` (`SPEC.md:411-413`).
  Today the review is exercised only through the server (`LawPracticeServer.test.ts`), with
  the real LangExtract layer over a stubbed `LanguageModel` (`:50-64`).
- Dependencies available to use-cases tests (`packages/law-practice/use-cases/package.json`):
  `@beep/langextract`, `@beep/text`, `@beep/epistemic-use-cases`, `@beep/file-processing` and `@beep/test-runner`.
  `@beep/annotation` must be added, because `IrToLaw` src reads the document. `makeClaimGate` needs a
  SHACL service (`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:139`), and
  `makeClaimTransition()` is pure (`ClaimLifecycle.service.ts:121`).
- Synthetic fixture: the office-action text and the expected quote and limitation live in
  `packages/law-practice/server/test/fixture.ts:28-46`, a server-local helper the use-cases
  tests cannot import. `use-cases/test/fixtures/office-action-structure/` holds 42 files of
  finality and period fixtures (`labels.jsonl` with 34 rows, `OfficeActionFixtures.test.ts:16`), which are a different flow.
- Source identity: an annotation document names one capture (`SourceTextIdentity`,
  `L2.annotation.ts:143-148`). The test needs a synthetic identity: scope, source ref, locator, both
  `sha256:` digests, extractor name and version, and normalization version
  (`packages/foundation/modeling/text/src/SourceTextIdentity.ts:185-210`). The fixture today has only
  `artifact:` and `sha256:` digests of the artifact (`fixture.ts:48-60`).
- Digest: the checked decode entrypoint, `mintOccurrenceId` (`Occurrence.ts:339-345`, `Effect.fn` with
  `Digest.Digest`) and receipt verification all need it. `Digest.layerWebCrypto`
  (`.repos/effect/packages/effect/src/crypto/Digest.ts:159`) or `BunCrypto.layer`
  (`.repos/effect/packages/platform/bun/src/BunCrypto.ts:26` re-exports NodeCrypto; the server test uses it, `LawPracticeServer.test.ts:13,63`).
- Assertions the P3 version can make without P4 or P6:
  - the document passes the checked entrypoint;
  - every anchor's receipt names the fixture capture;
  - the distinction mention's anchor re-slices the fixture text;
  - `IrToLaw` maps the document to the five entities;
  - the loop ends at `shape_valid` (today's `LawPracticeServer.test.ts:126-143` expectation);
  - a missing label fails typed.

  What the unaligned case asserts depends on Q6.
- The `0.9` stays until P4 (`OfficeActionReview.signals.test.ts`). The flow test must not assert it,
  or P4 has to rewrite the flow test as well as delete the default.

## 5. `OfficeActionStructure`: a standing-list consumer whose stored bytes embed `GroundedExtraction`

`OfficeActionStructure` is outside the PLAN rg but on the standing list.

- Use-cases: `OfficeActionStructure.service.ts:45-58` builds two `match_exact` extractions
  (`action-finality`, `shortened-statutory-period`) from the raw pair. `fromExtractions` (`:59-115`)
  refuses anything but `match_exact` with `rule-not-covered` (`:75-77`), rebuilds `TextAnchor`s from
  `span` and `matchedText` (`:78-87`), and verifies them against `VerifiedSourceText` (`:88-93`).
  It is the one consumer that mints `VerifiedTextAnchor` proofs from extractions today.
- Port: `fromExtractions(input, extractions: ReadonlyArray<GroundedExtraction>)` (`OfficeActionStructure.ports.ts:76-79`).
  The stored attempt has `extractions: S.Array(GroundedExtraction)` under `schemaVersion: S.tag("1")` (`:183-204`).
- Server: `retainedExtractions` (`OfficeActionStructure.layer.ts:41-51`) writes the extractions into every
  recognized attempt. `replay` (`:134-161`) feeds `attempt.extractions` back into `fromExtractions` (`:154`)
  and fails if the stored outcome disagrees with the replayed one.
- Store: `officeActionStructureFileStore` (`OfficeActionStructure.repo.ts:61-136`) writes append-only JSONL
  through `S.fromJsonString(OfficeActionStructureAttempt)` (`:26`, `:112-115`) and reads it back (`:79-93`).
- Frozen bytes: `packages/law-practice/server/test/fixtures/office-action-attempts-v1.jsonl`
  (2 lines, 3,457 bytes; committed by `b1fab8a30c4`, "freeze the anchor, receipt, attempt-log and node-event
  bytes before p2"). Line 1 has two encoded extractions in the key order `label`, `text`, `matchedText`,
  `span:{"end":..,"start":..}`, `alignmentStatus`. `span` encodes `end` before `start` because
  `SpanFields` declares them in that order (`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:213-217`).
  Tests: "writes the frozen rows byte for byte" (`server/test/OfficeActionStructure.test.ts:301-329`) and
  "reads the frozen rows and re-encodes every one to the same line" (`:331-352`).
- Consequence: P3 retires `Contract.Span` (census `:152`, `:316`), and `GroundedExtraction.span` is a `Contract.Span`
  (`Extraction.model.ts:190`). Any change to that field, or deleting `GroundedExtraction`, changes the
  bytes of a stored record. Under the stored-format law the stored v1 rows then need a declared read-time
  transform, unless the v1 encoding is kept (Q1, Q2, Q3).

## 6. Semantica

### 6.1 `ExtractorLive` (`apps/labs/semantica/src/layers/ExtractorLive.ts`, 817 lines)

| Read of a `GroundedExtraction` | Line | Use |
| --- | --- | --- |
| `label` | `:359`, `:369`, `:614-615` | `"relation"` splits the relation lane; `StructureRole` labels (`title`, `abstract`, `section`, `reference`) become `Structure` bodies; every other label becomes `Entity.entityType` |
| `attributes.depth` | `:343-350` | `Structure.depth` (`S.Natural`, default 0) |
| `attributes.cluster` | `:352-356`, `:368` | `Entity.cluster` (coreference) |
| `attributes.subject/object/predicate`, `text` | `:412-420` | `RelationExtractionCandidate` (`schema/Evidence.ts:159-167`) |
| `span`, `matchedText` | `:384-392` | `TextAnchor` |
| alignment tier | `:394-401` (every aligned tier accepted), `:403-410` (`match_fuzzy` refused for relation evidence), `:617` (`unaligned` becomes a `fabricated-span` degraded claim, `:577-582`) | lane policy |
| `confidence` | `:238-239`, `:537`, `:628` | `evidenceConfidence` defaults to `1` (P4 retires it; the pattern lane does the same at `:722`) |

Relation grounding re-aligns the subject and object surfaces inside the evidence quote with
`alignCandidate` (`:422-436`, a direct `@beep/langextract/Alignment` call). Endpoint entities are
synthesized as `entityType: "relation-endpoint"` (`:479-485`). The output is a semantica
`EvidenceBatch` (`:265-291`) whose claims each carry a `TextAnchorVerificationReceipt` minted by
`canonicalizer.verify` (`:251-252`; `CanonicalizerLive.ts:42-60` wraps `verifyTextAnchor` against
`canonical.identity`). The input capture is `CanonicalText = ResolvedSourceText {identity: SourceTextIdentity, text}`
(`schema/Text.ts:115`). Semantica already has the capture and the receipts that the annotation document requires.

`groundHostedExtractions` (`:606-648`, exported `@internal`) has two callers: `makeHostedExtractor` (`:671`) and
`src/canary/RelationPreview.ts:197` (the E5 cache preview, which also counts `label === "relation"`
on the raw extractions at `:207`). `containingChunk` (`:224-235`) finds a chunk by range. This is
semantica's own chunk, not the containment law, which decision p0-structure-kinds limits to structure kinds.

The pattern lane reads `@beep/nlp/Graph/Schema` `EntityNode.span` (`:55`, `:694-697`), the float
Graph `Span` that P3 deletes (census `:162`, `:317`). Outside nlp, `EntityNode|RelationNode|RelationParticipant`
appear on 52 lines in 8 files. 31 of them are in `nlp-processing/src/Graph/AnnotatedTextGraph.ts`, and 4 are in semantica (`ExtractorLive.ts` 2,
`test/Extractor.test.ts` 2) (Q15).

### 6.2 The projection (`src/layers/RdfProjectionLive.ts`, 186 lines)

It has 0 `GroundedExtraction` hits. It reads `LedgerSnapshot.batches` to `EvidenceBatch` to `EvidenceClaim.body`
(`:66-97`). It emits claim, chunk, label, role and predicate-text quads, a predicate IRI per claim (`:79`) and
no anchor, quote or receipt (census `:483`). The PLAN exit rg therefore lands on `ExtractorLive.ts` only; whether
"the semantica projection reads it" also binds `RdfProjectionLive` is Q13. The gold fixture
`fixtures/gold/v1/g-projection.json` is regenerated in P5 (census `:485`).

### 6.3 Semantica stored bytes

- Ledger: `LedgerLive.ts:264-277` opens PGlite at `<ledgerRoot>/<runId>/<mode>`, and `ledgerRoot` defaults to
  `.beep/semantica/ledger` (`src/runtime/Config.ts:108`), which is gitignored (`.gitignore:125`, `**/.beep/*`).
  Payloads are JSON-encoded `ExtractOutcome` (holding `EvidenceBatch`) and are decoded back in replay mode
  (`LedgerLive.ts:72-73`, `:221-229`). They are runtime bytes, not committed (Q14).
- Provider cache: `schema/ProviderCache.ts:77-81` stores the raw model `response` string, not extractions,
  so it is untouched by a handoff change.
- Committed fixtures: 35 files under `fixtures/` (gold labels, manifests, `relation-preview.json`). None holds an encoded
  `GroundedExtraction`. `relation-preview.json` lists the cases whose relation counts the preview canary computes
  through `groundHostedExtractions`; the counts are printed, not stored (corrected after the design review).

### 6.4 Semantica tests

`test/Extractor.test.ts` builds `match_exact` extractions over `Contract.Span` (`:85-102`) and fakes a whole
`LangExtractResult`, including an empty `Contract.AnnotatedDocument` with `Contract.Provenance` (`:104-135`).
It is the only `LangExtractResult.make(` outside langextract; `rg -n "LangExtractResult.make\("` finds 4 lines, 3 of them in langextract.
It has 6 `it.layer` blocks over the hosted lane (`:185-358`), including
"disqualifies fuzzy alignment for relation evidence" (`:357-358`). At the base,
`test/Extractor.test.ts`, `test/Projection.test.ts` and `test/ProjectionExpectation.test.ts` pass (3 files, 15 tests).

## 7. Lejeune workbench (outside the PLAN rg)

- `src/workflows/Normalize.ts:59-60` and `src/workflows/Rules.ts:30-31` construct
  `GroundedExtraction.cases.unaligned` purely as the input of `locateGroundedExtractions`
  (`langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts:487-497`) and read back `TextAnchor`s.
  No model output is involved.
- `server/provider-smoke.ts:291` filters `result.extractions` to the aligned tiers and re-decodes `label` and `text`.
- None of the three files persists an encoded `GroundedExtraction`. `provider-smoke.ts:333-355` writes a
  `ProviderRecording` built from the re-decoded `{label, text}` candidates (`ProviderRecording.make({candidates, ...})`),
  not from the extractions themselves.

## 8. Candidate shapes that become annotations

The design kinds are in `L2.annotation.ts:271-341` (extraction kinds) and `:343-432` (structure kinds).

| Shape today | Fields | Design target | Gap |
| --- | --- | --- | --- |
| langextract aligned `GroundedExtraction` (`Extraction.model.ts:180-191`, `:217-362`) | `label`, `text`, `matchedText`, `span`, `attributes` (`Record<string,string>`, optional), `confidence` (optional), `alignmentStatus` | `Mention {class}` over one target. The anchors row holds the receipt | `text`, `attributes`, `confidence` and tier have no field (Q4, Q5, Q7, Q9) |
| langextract `unaligned` | `label`, `text`, `attributes`, `confidence` | none (targets must be non-empty) | Q6 |
| nlp `Contract.Mention` (`Contract.ts:390-396`) | `chunkId`, `id` (`${documentId}:mention:${index}`, `Handoff.behavior.ts:42`), `provenance`, `span`, `text` | `Mention` | ids re-minted from the array index today (census `:153`) |
| nlp `Contract.Entity` (`Contract.ts:427-434`) | `canonicalName` (= `text`), `confidence`, `id`, `mentions`, `provenance`, `type` (= `label`) | deleted (`SPEC.md:408`) | `type` and `canonicalName` survive only if Q4 and Q8 give them a home |
| nlp `Contract.Relation` (`Contract.ts:465-473`) | `subject`/`object` `EntityId`, `type`, `evidence` spans, `confidence` | deleted; replaced by `RelationCandidate {subject, predicate: TermIri, object}` over Mention ids (`L2.annotation.ts:285-291`) | always empty today (`Handoff.behavior.ts:111`) |
| nlp `Contract.TextChunk` (`Contract.ts:353-359`) | `id` (`:chunk:0`), `kind`, `provenance`, `span`, `text` | `Chunk {ordinal}` (`L2.annotation.ts:278-282`) | one whole-document chunk today (`Handoff.behavior.ts:92-104`) |
| nlp `Contract.Provenance` (`Contract.ts:316-321`) | `confidence`, `generatedBy` (`"@beep/langextract"`, `Service.layer.ts:32`), `source`, `timestamp` (`Clock.currentTimeMillis`, `Service.layer.ts:89`) | deleted; replaced by `Generation {run, content, activity, at}` (`L2.annotation.ts:59-66`) with `ActivityId` from `mintActivityId` (`packages/foundation/modeling/jsonc/src/ActivityStart.ts:221`; fields `operation` IRI, `pin` `Model{model,version}` or `Engine{engine,edition}`, `promptDigest`, `used`, `started`, `:50-122`) | the producer pin for the office-action path (Q11) |
| semantica `ClaimBody.Entity` (`schema/Evidence.ts:306-322`) | anchor, `label`, `entityType`, `cluster` | `Mention {class = entityType}` plus `CorefCandidate {members}` per cluster with 2 or more members (`L2.annotation.ts:294-309`) | a single-member cluster has no annotation (members of 2 or more are required, `:299`) |
| semantica `ClaimBody.Relation` (`schema/Evidence.ts:324-340`) | anchor of the evidence quote, `predicate` (a `FrozenRelationPredicate` string, 6 literals, `:119-130`), `subject`/`object` `ClaimId` | `RelationCandidate` | the predicate needs 6 `TermIri`s; the design candidate has one target set, and whether the evidence span is its target is unstated |
| semantica `ClaimBody.Structure` (`schema/Evidence.ts:342-357`) | anchor, `role` (`title`, `abstract`, `section`, `reference`, `:189`), `depth` (`S.Natural`, 0 allowed) | `Title`, `Section {depth 1..6}` (`L2.annotation.ts:344-358`) | no kind for `abstract` or `reference`; `Section.depth` refuses 0, which is semantica's default (`ExtractorLive.ts:349`) |
| semantica `RelationExtractionCandidate` (`schema/Evidence.ts:159-167`) | `evidenceQuote`, `subject`, `object`, `predicate` strings | pre-grounding; parsed from attributes | stays lab-local or becomes the handoff's typed parse (Q7) |
| office-action labels (`OfficeActionExtractionLabel.ts:28-37`) | 4 literals; targets `entity` x3 and `custom` x1 (`OfficeActionReview.service.ts:55-76`) | `Mention {class}` | 4 class IRIs, none registered (Q8) |
| office-action structure labels (`OfficeActionStructure.service.ts:31-35`) | `action-finality`, `shortened-statutory-period` | `Mention {class}` if section 5 moves onto the document | Q3 |
| `ExtractionTarget.kind` (`entity`, `custom`, `relation`) | in requests only | no annotation | none |

Kind references: the design restricts `RelationCandidate` and `CorefCandidate` references to `Mention`
(`L2.annotation.ts:331`, `:338`). Semantica relation endpoints are `Entity` claims, so they map to `Mention`
with no conflict. No consumer reads containment, and extraction kinds have no level (decision p0-structure-kinds).

## 9. Stored and pinned bytes on the consumer side

| Bytes | Where | P3 exposure |
| --- | --- | --- |
| office-action attempt log (JSONL, `schemaVersion: "1"`) | written by `OfficeActionStructure.repo.ts:112-115`; frozen at `server/test/fixtures/office-action-attempts-v1.jsonl` | embeds encoded `GroundedExtraction` and `Contract.Span` (section 5) |
| semantica ledger payloads (`ExtractOutcome`/`EvidenceBatch`) | PGlite under the gitignored `.beep/semantica/ledger` | only if `EvidenceBatch` or `EvidenceClaim` changes shape (Q14) |
| `IrToLawExtractionError` encoded wire shape | pinned by `use-cases/test/SchemaParity.test.ts:148-178` | changes if `alignmentStatus` or the reasons change (Q6) |
| Practice KG candidate and evidence rows | `server/src/PracticeKg.claims.ts:496-518` (`persistCandidate`) | the evidence span is P4's; P3 touches it only through a changed `OfficeActionReviewInput` (Q10) |
| `LangExtractResult`, `Contract.AnnotatedDocument` | not persisted: `.annotatedDocument` is read only at `langextract/test/Service.test.ts:137-139` and set in the semantica fake (`Extractor.test.ts:115`) | none |
| `Distinction` | not persisted (section 3.2) | none |

## 10. Effect APIs a consumer migration uses (checked in `.repos/effect`, 4.1.5)

- `Digest` service `effect/crypto/Digest` (`packages/effect/src/crypto/Digest.ts:135`), `layerWebCrypto` (`:159`).
  `BunCrypto` re-exports NodeCrypto (`packages/platform/bun/src/BunCrypto.ts:26`).
- `S.HashMap` (`packages/effect/src/Schema.ts:16067`) and `S.HashSet` (`:16162`), the document carriers.
- `S.toTaggedUnion` (`Schema.ts:6498`) supplies `isAnyOf`, `guards` and `match` (`:6506-6510`), which every
  consumer of `GroundedExtraction` uses today (`IrToLaw.service.ts:64`, `ExtractorLive.ts:395`, `:404`).
- `@effect/vitest` `layer` (`packages/vitest/src/index.ts:363`) and `prop` (`:396`), for the flow test and law rows.

## 11. Open questions for the design

1. Does P3 delete `GroundedExtraction`, or keep it as the aligner's pre-annotation output in langextract?
   The PLAN exit empties only two directories (30 lines). The other 212 lines in 22 files include the
   `OfficeActionStructure` port and its stored attempts and the lejeune locate inputs (sections 2, 5 and 7).
2. P3 retires `Contract.Span`, and `GroundedExtraction.span` is one. Is the attempt-log v1 encoding kept
   byte-identical by a langextract-owned span with the same `{end,start}` key order, or does
   `OfficeActionStructureAttempt` bump `schemaVersion` with a declared v1-to-v2 read transform proved on
   `office-action-attempts-v1.jsonl`? The two byte-for-byte tests (`OfficeActionStructure.test.ts:301-352`) decide which is cheaper.
3. Does `OfficeActionStructure` move onto the annotation document in P3, given that it is on the standing list,
   verifies its own anchors and stores extractions? Or does it stay on extractions, with its PLAN-row silence recorded by decision?
4. Where does the model's candidate `text` live when it differs from the source quote (lesser, minimal-fold or
   fuzzy tier)? `IrToLaw` maps it into four entity fields, and the server test asserts the lower-case
   limitation (`LawPracticeServer.test.ts:120-122`). If it goes into the `Mention` body it enters `AnnotationId`;
   if it goes into an attribute see Q7; if it is dropped, the expectation changes to the quote.
5. Where does the alignment tier live? `IrToLaw` (`:64`, `:76-77`), the semantica relation lane (`ExtractorLive.ts:403-410`),
   `OfficeActionStructure` (`service.ts:75-77`) and two server-test assertions (`:100-104`, `:161-164`) branch on it.
   A body field puts it in the content hash, so two tiers at one span would be two annotations.
   A `Generation` or activity field keeps it out of the hash. `Anchored` holds only the receipt.
6. What does the handoff emit for unaligned candidates, which cannot be annotations? Is it a residual list beside
   the document, by analogy with the OA decoder's residual (decision p0-item7)? The answer fixes `IrToLaw`'s
   `required-extraction-unaligned` reason, the error's `alignmentStatus` field and its pinned wire shape
   (`SchemaParity.test.ts:148-178`), semantica's `fabricated-span` degradations (`ExtractorLive.ts:577-582`, `:617`)
   and `LangExtractDiagnostics.unalignedCount`.
7. "Attributes" (`SPEC.md:34`, `:407`): does the handoff keep the raw `Record<string,string>` on the annotation, or
   parse `cluster` into `CorefCandidate`, `subject`/`object`/`predicate` into `RelationCandidate` and `depth`
   into `Section`, then drop the record? Semantica reads all five keys (section 6.1). The office action reads none.
8. Who declares the class and predicate terms, and in which namespace? That covers 4 office-action labels, 2 structure-pair labels,
   semantica's entity types and `relation-endpoint`, 4 structure roles and 6 relation predicates.
   `beep-effect.com/ns/annotation` has 0 registry hits. The design uses `ns/annotation/...` IRIs (`L2.annotation.ts:315-339`),
   and the generators use `ns/annotation/class/...` (`ops/design/generators.ts:92-95`). Law-practice labels are product
   vocabulary (decision p0-routing).
9. Confidence in P3: `Contract.Provenance.confidence` is deleted, and semantica's `evidenceConfidence` reads
   `ExtractionCandidate.confidence`, defaulting to `1` until P4. Does the P3 document drop confidence (semantica then
   passes `O.none()` until the P4 signal arrives) or carry it somewhere outside the content hash?
10. The handoff's capture: `LangExtractRequest` has no `SourceTextIdentity`. Semantica has `canonical.identity`. The office
    action has only a `SourceArtifact`, and its extractor pins would come from `ProcessFileResult` (`engineVersion` is optional,
    `file-processing/src/Extraction/Extraction.schema.ts:194`). Does the request gain a `SourceTextIdentity` or
    `VerifiedSourceText`, and does `OfficeActionReviewInput` change? Its other builders are `PracticeKg.claims.ts:478-494`
    and the server `fixture.ts:56-77`.
11. The `ActivityId` pin for the handoff run: `ActivityPin` needs `Model{model,version}` or `Engine{engine,edition}`.
    `LanguageModel` exposes no model identity to LangExtract, and the server test stubs it. Semantica has `ModelIdentity`.
    Where does the office-action path's pin come from, and what is the operation term?
12. Order and multiplicity: `IrToLaw` takes the first extraction per label, but document annotations are an unordered
    `HashMap`. Two `distinction` mentions at different spans: is that a typed refusal, a choice by position, or a
    list? Equal content (same class, same target) dedupes by hash and unions attribution. Must semantica's
    `EvidenceBatch.claims` order (first-wins `dedupeWith`, `ExtractorLive.ts:279`) be redefined by position?
13. Does "the semantica projection reads it" bind `RdfProjectionLive`, which reads `EvidenceBatch` and has 0 hits, or only
    `ExtractorLive`, which the PLAN rg checks? Projecting annotations would change `g-projection.json` before P5 regenerates it.
14. Is the semantica ledger (gitignored PGlite with a replay mode) under the stored-format law if `EvidenceBatch` changes, or
    is it declared disposable per run by decision?
15. The Graph `Span` deletion: P3 deletes it (census `:162`), but its readers are semantica's pattern lane
    (`ExtractorLive.ts:694-697`) and `nlp-processing/src/Graph/AnnotatedTextGraph.ts` (31 lines). Those are the L5 home's files,
    which P6 absorbs. Does P3 migrate them or re-sequence the deletion?
16. Flow-test composition: does it use the real langextract `Service` over a stubbed `LanguageModel` (the server-test pattern,
    which exercises the handoff minting) or a hand-built document? Does the fixture text move to, or get copied into,
    `use-cases/test/fixtures`? Is the gate real (`makeClaimGate` with a SHACL service) or faked?
17. Does `IrToLaw.toLaw` take a document already returned by the checked entrypoint (pure, as today), or decode and verify
    itself (gaining `Digest` in `R`, which changes `IrToLawShape`, `Layer.ts:36` and the `SchemaParity.test.ts` shape decode)?
18. Dependencies and nlp residue: `@beep/annotation` must be added to law-practice use-cases and semantica. Both still import
    `@beep/nlp/Core` `DocumentId` (`OfficeActionReview.service.ts:23`, `ExtractorLive.ts:17`, `LawPracticeServer.test.ts:11`),
    and semantica imports `UnitInterval` from `@beep/nlp/Handoff` (`ExtractorLive.ts:18`; census `:160` retires that to
    `@beep/schema/UnitInterval`). Do these move in P3 with the handoff, or in P6 and P7?
19. Does the lejeune workbench (10 lines, 3 files) migrate in P3? Its use is a locate input, not a handoff consumer.

## Appendix: commands run

```sh
rg -n "GroundedExtraction" packages apps --stats
rg -c "GroundedExtraction" packages apps
rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers | wc -l   # 30
rg -c "GroundedExtraction\.cases\.[a-z_]+\.make" packages apps
rg -n "LangExtractResult.make\(" packages apps
rg -n "Contract\.Span\b" packages apps --glob '!packages/foundation/modeling/nlp/**'
rg -n "EntityNode|RelationNode|RelationParticipant" packages apps --glob '!packages/foundation/modeling/nlp/**' -g '*.ts'
rg -l "beep-effect.com/ns/annotation" packages apps standards | wc -l   # 0
rg -il "distinction" packages/law-practice/tables packages/_internal/db-admin/drizzle   # empty
wc -lc packages/law-practice/server/test/fixtures/office-action-attempts-v1.jsonl   # 2 3457
git check-ignore -v .beep/semantica/ledger/x   # .gitignore:125
# under nice -n 19, 5-minute load 25 to 31:
(cd packages/law-practice/server && bunx --bun vitest run test/LawPracticeServer.test.ts test/OfficeActionStructure.test.ts)   # 13 passed
(cd packages/law-practice/use-cases && bunx --bun vitest run test/OfficeActionStructure.test.ts test/OfficeActionFixtures.test.ts)   # 6 passed
(cd apps/labs/semantica && bunx --bun vitest run test/Extractor.test.ts test/Projection.test.ts test/ProjectionExpectation.test.ts)   # 15 passed
```
