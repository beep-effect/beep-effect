# P2 map: `@beep/provenance` and what it becomes in `@beep/text`

Read-only map for the P2 phase (L1 text). It lists every export of
`@beep/provenance`, every importer, how each importer uses it, and what each
export becomes in the L1 design (`ops/design/L1.text.ts`). It also covers the AST
source-map types that SPEC says must point at `@beep/text`, every test that pins
provenance behaviour or bytes, and a migration table at the end.

Base: the P2 text lane at `bf799f49b71` (the P1 PR C
head). No package source was edited.

## 0. Method

- Importers: `rg -l '@beep/provenance' packages apps scripts goals/*/ops tsconfig.json standards`
  (224 files: 172 `.ts`/`.tsx`, 52 other). A scratchpad import-clause parser (not
  committed) read every `import`/`export ... from "@beep/provenance[/sub]"` clause,
  named and namespace bindings included, and counted the non-import, non-comment
  lines that name each local binding. Kind labels in the appendices are a regex
  heuristic (`construct` = `X.make(`, `decode` = `S.decode*(X`, `field-or-param` =
  `name: X`, `type-arg` = generic or union position, `static:<m>` = `X.<m>`, `call`
  = function call). Read them as a guide, not a proof.
- Totals outside the owner package and the goal's design module: **156 files**
  (78 src, 78 test or story), 466 bindings across all 166 importing files, 24 of
  them type-only. Import paths used: `@beep/provenance/TextAnchor` 69 files,
  `/SourceTextIdentity` 61, `/VerifiedTextAnchor` 58, root barrel 27. The file
  count matches `research/consumer-census.md` section a (156). My usage-line count
  is 1,286, against the census's 1,100. The census counter dedupes per binding and
  per `NS.member`, and mine counts every line that names the binding.
- Effect APIs named below were checked against `.repos/effect` (package version
  4.1.4), in `packages/effect/src/Schema.ts`: `Opaque` :6700, `Class` :17784,
  `TaggedError` :17965, `TaggedStruct` :6376, `TaggedUnion` :6633,
  `toTaggedUnion` :6498, `declare` :591, `brand` :5371, `makeFilter` :6816,
  `isPattern` :6944, `link` :6748, `toEquivalence` :18078, `suspend` :5232,
  `Tuple` :4487, `tag` :6280, `OptionFromOptionalKey` :16868,
  `decodeUnknownEffect` :1536, `encodeUnknownEffect` :1953, `Natural` :8089,
  `makeOption` on classes :17588. Also `Effect.fn` (`Effect.ts:15239`),
  `effect/crypto/Digest` (`Digest` service `:135`), and `String.charCodeAt`,
  `length` and `slice` (`String.ts:589,488,397`).

## 1. The package today

`packages/foundation/modeling/provenance`, name `@beep/provenance`, private,
`version 0.0.0`. It has 3 modules plus a barrel (`src/index.ts` re-exports all
three) and 3 test files.

- Dependencies: `@beep/identity`, `@beep/schema`, `effect`
  (`package.json` `dependencies`). `@beep/text` adds `@beep/jsonc`, because
  `mintContentHash` (`packages/foundation/modeling/jsonc/src/Mint.ts:71`) is the L1
  design's hash path (`L1.text.ts:15,257,269,320`).
- Exports map: `"."`, `"./*"`, with `./internal/*` blocked.
- Identity composer: `$ProvenanceId` (`packages/foundation/modeling/identity/src/packages.ts:497`,
  `$I.create("provenance")`). Every schema annotation identifier is composed under it, for example
  `@beep/provenance/TextAnchor/TextAnchor` and
  `@beep/provenance/SourceTextIdentity/SourceTextDigest`. No provenance IRI is a
  published registry term: no namespace shard under
  `packages/foundation/modeling/identity/registry/namespaces/` covers it, and
  `registry/term-snapshot.json` has no provenance row. L0-3 therefore does not
  gate the rename. One test does pin the identifier strings (section 6, T8).
- Doctests: 22 `import.meta.vitest` JSDoc examples (`SourceTextIdentity.ts` 4,
  `TextAnchor.ts` 7, `VerifiedTextAnchor.ts` 11), all importing `@beep/provenance/*`.
- Spans (instrumentation catalog `standards/instrumentation-catalog/@beep/provenance.generated.jsonc`):
  `VerifiedTextAnchor.verify`, `.verifyAgainstVerifiedSource`,
  `.verifySourceTextIdentity`.
- Native-runtime allowance: `standards/effect-laws.allowlist.jsonc:109-116`
  (`weak-collection`, `CODEX-SECURITY-VERIFIED-ANCHOR-WEAK-IDENTITY`, file
  `provenance/src/VerifiedTextAnchor.ts`), mirrored in
  `packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts:113-116`.

## 2. Export catalogue

Each row gives the definition, then what the export becomes in L1, then its
external importers by package (files / usage lines, with the main kinds). The
per-package and per-file breakdowns are in Appendices A and B.

### 2.1 `SourceTextIdentity.ts`

| Export | Definition (file:line) | L1 role | External importers |
| --- | --- | --- | --- |
| `SourceTextDigest` (schema + type) | `Sha256PrefixedDigest.pipe(S.brand("SourceTextDigest"))`, encoded `sha256:<64 lowercase hex>` (`SourceTextIdentity.ts:30`; base `packages/foundation/modeling/schema/src/Sha256.ts:132`) | Unchanged. Fields 4 and 5 of `OccurrencePreimage` (`L1.text.ts:218-219`). It is the plain SHA-256 over the UTF-8 text, not a domain-tagged `ContentHash`. It is minted at `VerifiedTextAnchor.ts:603-608` and, independently, at `packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts:46-77` | 36 files / 65 lines. Almost all are `.make(` in fixtures (semantica 7, law-practice server 6, agent-memory-store 4). Field use: `law-practice/domain/.../ObservationVersionRef.model.ts:64`, semantica `schema/Text.ts:182`. Decode and equivalence: workspace resolver `:46,49,76-77`, professional-desktop `ContradictionQaSeed.ts:541` |
| `SourceTextExtractor` (`S.Opaque` of `{ name: NonEmptyString, version: NonEmptyString }`, static `decodeEffect`) | `SourceTextIdentity.ts:71,85` | Unchanged. Fields 6 and 7 of the preimage. Gains the well-formed-text check (census note row; SPEC Decision "census dispositions") | 40 files / 56 lines, nearly all `.make(`. Field use in semantica `schema/Provenance.ts:34`, `schema/Text.ts:21`, `ParserLive.ts:49`. Decode and equivalence in the workspace resolver `:47,86-98` |
| `SourceTextIdentity` (`S.Opaque` of `{ scopeRef, sourceRef: NonEmptyString; locator: PosixPath; sourceDigest, textDigest: SourceTextDigest; extractor: SourceTextExtractor; normalizationVersion: NonEmptyString }`) | `SourceTextIdentity.ts:125` | The L1 **text capture**. Fields 1 to 9 of `OccurrencePreimage` (`L1.text.ts:213-227`, built at `:233-250`). `LocatorMap.from/to` (`:344-352`), `Anchored.source` (`:202`), the L2 document's single capture. `scopeRef` is the matter-wall input (census section on access paths). Its string fields gain the well-formed-text constraint in P2 (census section a, note row), a behaviour change for lone surrogates only | 69 files / 154 lines. Main uses: schema fields in ports and DTOs (file-processing `SourceText.schema.ts:100,124,138,227`; langextract `VerifiedSpan.model.ts:598-631,903`; law-practice use-cases `CitationEngine.*`, `OfficeActionStructure.ports.ts:192-214`; epistemic use-cases `ContradictionTriage.rpc.ts:291,362,620`; `SourceTextIdentity.fields` spread at `ContradictionTriage.commands.ts:372`). Equivalence via `S.toEquivalence(SourceTextIdentity)` at about 20 sites (law-practice server `Mention.ts:90`, `ResolutionInput.ts:33`, `OfficeActionStructure.repo.ts:119`, langextract `VerifiedSpan.behavior.ts:60`). `.make(` in fixtures |

### 2.2 `TextAnchor.ts`

| Export | Definition (file:line) | L1 role | External importers |
| --- | --- | --- | --- |
| `TextAnchorFields` (plain record) | `{ startChar: S.Natural, endChar: S.Natural, quote: S.NonEmptyString }` (`TextAnchor.ts:51`) | Unchanged (decision `p0-text-anchor-retained-beside-selector-position`). `startChar`/`endChar` ≅ `Position{unit:"utf16-code-unit"}.start/end`, and `quote` ≅ `QuoteSelector.exact` and `Resolution.Unique.quote` | 4 files / 8 lines. Semantica `schema/Gold.ts:301-422` reads `.startChar`/`.endChar` for gold wire records. Epistemics `EvidenceSpan.model.ts:90` and epistemic tables `Evidence.converters.ts:105` read `.quote` (the stored `epistemic_evidence.span` codec) |
| `TextAnchorWidthCheck` (`S.makeFilter`) | `start < end && end - start === Str.length(quote)` (`TextAnchor.ts:70-97`) | Unchanged. It is the static half of L1-1 (width only). The full L1-1 law (`slice(text, position) = quote`) needs the text | 3 files / 7 lines: semantica `schema/Evidence.ts:316,334,351`, `schema/Gold.ts:163,195,243`; epistemics `EvidenceSpan.model.ts:119` |
| `isUtf16Boundary` (dual) | offset in `[0, length]` and not between a high and a low surrogate (`TextAnchor.ts:123-131`) | Unchanged. It is the `utf16-code-unit` case of the boundary test behind `convertPosition` (`UnitConversionRefusal "split-boundary"`, `L1.text.ts:325`) and `UnmappedReason "split-boundary"` (`:163`) | 3 files / 8 lines: langextract `VerifiedSpan.behavior.ts:145,325`; semantica `test/C0Input.test.ts:259-379`; cli `Kb.service.ts:73-74` |
| `TextAnchor` (`S.Class` with identifier `` $I`TextAnchor` ``, statics `isWellOrdered`, `isInternallyConsistent`, `decodeEffect`, `toCodecArbitrary` link) | over `TextAnchorStruct.mapFields(identity).check(TextAnchorWidthCheck)` (`TextAnchor.ts:63,133,156-212`) | **Kept with its stored shape.** It is not renamed to `Selector.Position`, which is added beside it (`L1.text.ts:63-81`). Bridge: `Anchored.range` and `Anchored.quote` (`:191-199`) read the receipt's anchor as `Position{unit:"utf16-code-unit", start:startChar, end:endChar}`, and fields 10 to 13 of the preimage are `"utf16-code-unit", startChar, endChar, quote`. `TextAnchor ⇄ oa:TextPositionSelector + oa:TextQuoteSelector` lives in `@beep/rdf` | 86 files / 758 lines, by far the largest. law-practice domain 43 files / 644 lines (ClaimElement and ClaimClauseRole models, where `TextAnchor` is a schema field type at about 470 lines, plus 30 test files), semantica 11 / 30 (`ExtractorLive.ts:224-377` with `TextAnchor.makeOption`), langextract 1 / 19 (`VerifiedSpan.behavior.ts` return and generic types), law-practice server 10 / 13, epistemics 3 / 10, apps and tests. `TextAnchor.isInternallyConsistent` in `Kb.service.ts:71` |
| `isWellOrdered` | alias of the static, `start <= end` (`TextAnchor.ts:189,230`) | Unchanged. This test admits `start == end`, while `TextAnchor` and `Position` both require `start < end` (open question 6) | 0 external (owner tests only) |
| `isInternallyConsistent` | alias of the static, i.e. `hasConsistentTextAnchorWidth` (`TextAnchor.ts:207,246`) | Unchanged | 1 file: epistemics `EvidenceSpan.model.ts:161` |

### 2.3 `VerifiedTextAnchor.ts`

| Export | Definition (file:line) | L1 role | External importers |
| --- | --- | --- | --- |
| `VerifiedTextAnchorErrorReason` (`LiteralKit`) | `cross-scope`, `invalid-anchor`, `quote-mismatch`, `stale-source` (`VerifiedTextAnchor.ts:87`) | Unchanged. It has no L1 twin. The closest L1 outcomes are `UnitConversionRefusal` (`split-boundary`/`out-of-range`) and `Resolution.NotFound`/`Ambiguous` | 3 files / 4 lines: langextract `VerifiedSpan.model.ts:362` (unioned into `VerifiedSpanAttemptFailureReason`), epistemics `ClaimEvidenceReview.model.ts:163,219`, law-practice use-cases `OfficeActionStructure.ports.ts:139` |
| `VerifiedTextAnchorError` (`S.TaggedError`, `{ message, reason }`, static `fromReason`) | `VerifiedTextAnchor.ts:130-155` | Unchanged | 6 files / 15 lines: law-practice use-cases `OfficeActionStructure.service.ts:69-87` (`fromReason`), server `OfficeActionStructure.layer.ts:143,145`, semantica `schema/Errors.ts:145` |
| `VerifySourceTextIdentityInput` (`S.Opaque` of `{ expectedSource, source, sourceText }`) | `VerifiedTextAnchor.ts:172` | Unchanged | 14 files / 22 lines, `.make(` everywhere. `VerifySourceTextIdentityInput.fields` at `OfficeActionStructure.layer.ts:136-138` |
| `VerifiedSourceText` (opaque type + `S.declare` over a module-private `WeakMap`) | `VerifiedTextAnchor.ts:188-267` | Unchanged. It is the `target` argument of `reanchor` (`L1.text.ts:364-374`), the "text was verified" precondition | 28 files / 65 lines. law-practice server Citation internals hold it as a struct field via `S.declare` at 19 files / 46 lines (`SourceRequest.ts:27-30`, `OccurrenceProjection.ts:102-303`, `VerifiedExtraction.ts:62-128`, `CanonicalSource.ts:86,135`). Use-cases `CitationEngine.result.ts:81-118`. Guard `S.is(VerifiedSourceText)` in tests |
| `VerifyTextAnchorAgainstVerifiedSourceInput` | `S.Opaque` of `{ anchor: TextAnchor, verifiedSource: VerifiedSourceText }` (`:283`) | Unchanged | 9 files / 14 lines, `.make(` |
| `VerifyTextAnchorInput` | `S.Opaque` of `{ anchor, expectedSource, source, sourceText }` (`:318`) | Unchanged | 8 files / 11 lines, `.make(` |
| `TextAnchorVerificationReceipt` | `S.Opaque` of `{ anchor: TextAnchor, source: SourceTextIdentity }`. It has no time, verifier or digest (`:354`) | **The powerless receipt.** `Anchored` is `S.Opaque` of `{ receipt }` (`L1.text.ts:185-203`). `occurrencePreimage(anchored)` and `mintOccurrenceId(anchored)` read only the receipt (`:233-259`). L1-6 asserts it never becomes a proof without re-verification. It is stored in `law_practice_patent_citation_event.grounding` and in `epistemic_evidence_verification.verified_anchor`, which `manifestation_key` hashes (section 5) | 27 files / 49 lines. Schema fields: `PatentCitationEvent.model.ts:81` (stored), epistemic domain `EvidenceVerification.model.ts:49` (stored), epistemics `EvidenceVerification.model.ts:66`, `Citation.mention.ts:58,100,171` (mention receipt), langextract `VerifiedSpan.model.ts:470`, semantica `schema/Evidence.ts:422`, `schema/Text.ts:177`. `.make(` in seeds and fixtures |
| `toTextAnchorVerificationReceipt` | one-way projection, proof to receipt (`:523`) | Unchanged. It is the only route from proof to receipt, and the L1-6 direction | 9 files / 17 lines: law-practice server `Mention.ts:157-200` (6), `Document.ts:354-361`, `ResolutionInput.ts:161`, `OfficeActionStructure.layer.ts:37-38`; langextract `VerifiedSpan.behavior.ts:599`; professional-desktop seed |
| `VerifiedTextAnchor` (opaque type + `S.declare`) | `:369-460`. Issuers are only `verifyTextAnchorAgainstVerifiedSource` and `verifyTextAnchor`. Getters copy, and prototype and instances are frozen | Unchanged. It is the L1-6 target. The design mints `OccurrenceId` from the receipt, not the proof (open question 2) | 9 files / 21 lines: `MentionIdentity.ts:20,30` (cm1 accepts only a genuine proof, `:111-121`), `Citation.mention.ts:20-161`, `DocStructure.model.ts:247-265`, `OccurrenceProjection.ts:242,275`, `SixFormProjection.ts:154-236`, `ResolutionInput.ts:32,63`, tests |
| `verifySourceTextIdentity` | `Effect.fn`, R = `Digest`: scope, then identity equivalence, then well-formed text, then UTF-8 sha256 equals `textDigest` (`:587-614`) | Unchanged. `scopeRef` equality here is the only scope check on the anchor-resolution path (matter-wall census) | 12 files / 16 lines: law-practice server 8 (`CanonicalSource.ts:163`, `Document.ts:402`, `SourceEvidence.ts:65`, `OfficeActionStructure.layer.ts:90,144`), use-cases 1, domain `officeActionFixture.ts:55`, workspace resolver 1, langextract 1 |
| `verifyTextAnchorAgainstVerifiedSource` | `Effect.fn`: bounds, then UTF-16 boundaries, then exact slice equality (`:639-661`) | Unchanged. It is the L1-1 check at runtime | 9 files / 14 lines |
| `verifyTextAnchor` | composition of the two (`:721-737`) | Unchanged | 8 files / 11 lines: epistemic use-cases `ClaimEvidenceReview.service.ts:56,105`, epistemic server `ContradictionTriage.layer.ts:324`, law-practice use-cases `CandorPolicy.service.ts:144`, semantica `CanonicalizerLive.ts:43`, professional-desktop seed |

Internal, not exported: `WellFormedSourceText` (`VerifiedTextAnchor.ts:22-36`,
the regex `^(?:[\u0000-퟿-￿]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$`).
This is the check the P2 well-formed-text constraint can reuse for the
`SourceTextIdentity` string fields. Also internal: `TextAnchorStruct`
(`TextAnchor.ts:63`), the two `WeakMap` registries (`:49-50`) and the copy
helpers (`:52-71`).

### 2.4 L1 symbols with no provenance counterpart today (prior art)

| L1 symbol (`L1.text.ts`) | Closest existing code | Gap |
| --- | --- | --- |
| `OffsetUnit` `:32` (`utf16-code-unit`, `unicode-code-point`, `utf8-byte`) | langextract `TextOffsetUnit` (`VerifiedSpan.model.ts:42`, without `utf8-byte`); agent-memory-store `TextUnit` `["utf16"]` (`SpanAnchor.models.ts:35`) | The `utf16` literal maps to `utf16-code-unit` at read time (decision p0-rq4) |
| `OccurrenceId` `:42`, `OccurrencePreimage` `:213`, `mintOccurrenceId` `:253` | cm1 preimage `MentionIdentity.ts:86-147` (same nine capture fields, range and quote, plus engine artifact and kind, no unit, JSON-string tuple hashed to bare hex); agent-memory-store `OccurrenceAnchor` (`SpanAnchor.models.ts:86`); party `OccurrenceId` `party-occ` (`packages/party/domain/src/values/Ids/Ids.model.ts:139`, renamed in P2) | It is new bytes: `mintContentHash` hashes RFC 8785 canonical JSON of `[tag, ...fields]` to `sha256:<hex>` (`jsonc/src/Mint.ts:71-77`), whereas cm1 is `JSON.stringify` of the tuple to bare hex |
| `QuoteKey` `:53`, `mintQuoteKey` `:265` | semantica gold `quoteSha256` (`apps/labs/semantica/src/schema/Gold.ts:335,404`, sha256 of the raw quote) | No normalizer exists in provenance. `SourceTextIdentity.normalizationVersion` is described as the "locator-only normalization contract" (`SourceTextIdentity.ts:144`), not quote normalization (open question 9) |
| `Selector` (`Position`, `Quote`, `Fragment`, `Refined`, `Range`) `:63-150` | rdf `EvidenceSelector` (`rdf/src/Evidence.ts:78,122,164,204`, discriminant `kind`), `WebAnnotation*Selector` (`rdf/src/Adapters/WebAnnotation.ts:60,100,138,174`), cli Kb `Selector` (`Kb.schemas.ts:109`, kept) | rdf `TextPositionSelector` has no `start < end` check and no unit, and rdf `FragmentSelector.conformsTo` is optional `IRIReference` where the design requires `IRI`. rdf has no Refined or Range case |
| `Resolution` `:153`, `resolve` `:355` | langextract `locateRawText` (`VerifiedSpan.behavior.ts:298`), which already fails `ambiguous`/`not-found` rather than taking the first hit (`VerifiedSpan.model.ts:377-384`) | The outcome is typed as an error today, not as a `Resolution` value |
| `Reanchoring`, `UnmappedReason`, `LocatorMap`, `reanchor` `:163-175,344-374` | langextract `reanchorVerifiedSpanHistory` (`VerifiedSpan.behavior.ts:816`), which repeats locate, digest, boundary and slice checks against the new capture | No locator map, so no `Widened` case |
| `convertPosition`, `UnitConversionRefused` `:325-341,377` | langextract `convertTextOffsetRange` (`VerifiedSpan.behavior.ts:385`, code point to UTF-16, effectful) | Moves into `@beep/text`. The census disposition is "re-expressed on the text position in P2 and P3" |
| `Anchored` `:185` | none (the receipt is used bare) | |
| `CitationMentionDigest`, `CitationMentionInput`, `mintCitationMentionDigest` `:278-322` | `makeCitationMentionId` (`MentionIdentity.ts:121-148`) | Requires `citation-mention/v2`, the cascade through ca1, cl1 and cg1, and the v3 to v4 receipt read transform |

## 3. Importers by package (how each uses it)

Appendix B has every file with line numbers. Summary:

| Package | Files (src/test) | What it does with provenance |
| --- | --- | --- |
| `packages/law-practice/domain` | 48 (19/29) | (1) `TextAnchor` as the span type of the claim-element model: `ClaimClauseRole.{model,behavior,structure,projection,sourceQuery}.ts`, `ClaimElement.{model,edge.model,tree.model,behavior}.ts`, `ClaimLexicalEvidence.model.ts`, `DocStructure.*`, `PatentDocument.transition.ts:371-404` (`TextAnchor.makeOption`). (2) Citation values: `Citation.mention.ts` (proof in the mention, receipt in the mention receipt, `schemaVersion citation-mention-receipt/v1` at `:169`), `Citation.document.ts` (`citation-document-receipt/v3` at `:60`). (3) The stored receipt `PatentCitationEvent.model.ts:81`. (4) `ObservationVersionRef.model.ts:64` (`SourceTextDigest` field), `Distinction.model.ts:64`. (5) `internal/officeActionFixture.ts`, which verifies a fixture source |
| `packages/law-practice/server` | 37 (17/20) | Citation engine internals: `CanonicalSource.ts` builds a `SourceTextIdentity` and verifies it; `MentionIdentity.ts` mints cm1 from a `VerifiedTextAnchor`; `Mention.ts`/`Document.ts` project and restore receipts (`Document.ts:350-361` writes v3, `:402` re-verifies on restore); `OccurrenceProjection.ts`/`SixFormProjection.ts` verify anchors against a `VerifiedSourceText`; `SourceRequest`, `SourceEvidence`, `SourceAnnotation`, `VerifiedExtraction`, `ResolutionInput`, `ResolverOperation`, `SourceResolution`, `CallbackSession`, `SessionDocument` carry the types. `OfficeActionStructure.layer.ts`/`.repo.ts` verify source identity for the office-action path. Tests build fixtures and pin the cm1 golden |
| `apps/labs/semantica` | 20 (12/8) | Root-barrel importer. Gold schema spreads `TextAnchorFields` keys and checks `TextAnchorWidthCheck`. `Evidence.ts` embeds the receipt. `CanonicalizerLive.ts` verifies. `ExtractorLive.ts` builds anchors with `makeOption`. `ParserLive.ts` and `CanaryC0Live.ts` build extractors |
| `packages/law-practice/use-cases` | 12 (9/3) | `CitationEngine.{evidence,input,result}.ts` and `CitationExtractor.models.ts` carry `SourceTextIdentity`/`VerifiedSourceText`; `OfficeActionStructure.{ports,service}.ts` verify and map `VerifiedTextAnchorError`; `CandorPolicy.service.ts:144` calls `verifyTextAnchor`; `IrToLaw.service.ts:92-94` (root barrel) builds a `TextAnchor`; `ClaimInspection.lexical.ts:184` |
| `packages/foundation/capability/langextract` | 3 (2/1) | `VerifiedSpan.{model,behavior}.ts`: locate, convert units, verify, project receipts, re-anchor history. Prior art for `resolve`, `convertPosition` and `reanchor` |
| `packages/tooling/library/agent-memory-store` | 5 (2/3) | `SpanAnchor.models.ts:86-95` `OccurrenceAnchor { source, unit: TextUnit "utf16", anchor: TextAnchor }`, persisted inside node events (`NodeEvent.events.ts:78`); `MarkdownProjector.layer.ts:374-445` builds identities and anchors; `toMarkdownRange` (`SpanAnchor.models.ts:138`) bridges to `@beep/markdown` `MarkdownRange` |
| `packages/foundation/modeling/epistemics` | 5 (3/2) | `EvidenceSpan.model.ts` (`TextAnchorFields` + `confidence`, `TextAnchorWidthCheck`, `isInternallyConsistent`; retired in P4); `EvidenceVerification.model.ts:66` (receipt; manifestation key at `:123-132`); `ClaimEvidenceReview.model.ts` (identity and error reason) |
| `packages/epistemic/{domain,tables,server,use-cases,ui}` | 18 | Domain `EvidenceVerification` entity (stored receipt and manifestation key), tables tests that encode receipts, `ContradictionTriage.layer.ts:120,324-325` verifies, `ClaimEvidenceReview.service.ts:56-107` verifies, the rpc and commands carry `SourceTextIdentity`, the UI story and test build fixtures |
| `packages/foundation/capability/file-processing` | 2 (1/1) | `SourceText.schema.ts`: the `SourceTextResolver` port schemas embed `SourceTextIdentity` |
| `packages/workspace/server` | 2 (1/1) | `WorkspaceSourceTextResolver.ts` implements that port: decodes digest and extractor, mints the text digest, builds `SourceTextIdentity`, and calls `verifySourceTextIdentity` |
| `apps/professional-desktop` | 2 (1/1) | `ContradictionQaSeed.ts` seeds receipts and verifies; a sidecar registration test |
| `apps/labs/lejeune-bolt-workbench` | 1 | `domain/Bundle.ts:146-1126`, anchors as fields and `.make` |
| `packages/tooling/tool/cli` | 1 | `Kb.service.ts:71-74`: `TextAnchor.isInternallyConsistent` and `isUtf16Boundary` validate the Kb `TextQuote` selector |
| `goals/text-knowledge-stack-rebuild/ops/design` | 4 | `L1.text.ts:16-17,25`, `L2.annotation.ts:37`, `L4.claims.ts:166,243-246`, `generators.ts:139-786` |

Non-import references the rename PR must also edit:

- `packages/foundation/modeling/identity/src/packages.ts:484-497`: `$ProvenanceId` needs a new composer for `@beep/text`.
- `packages/foundation/modeling/identity/test/shape-stable.test.ts:147`.
- `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:422,833`.
- `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:436` (`2.5`).
- `EffectLawsAllowlistSnapshot.ts:113-116` and `standards/effect-laws.allowlist.jsonc:111-116`.
- `turbo.json:405`.
- `tsconfig.json:986-989` and `vitest.aliases.generated.json:883-886`.
- 46 package tsconfig files that name `modeling/provenance`.
- 17 `package.json` dependents plus `scratchpad/package.json`.
- The `standards/` inventories: the schema-catalog shard (10 rows), the instrumentation-catalog shard (3 spans), 14 `standards/cache-baseline/@beep/*.json` files, `fallow.boundaries.generated.jsonc:951-953,1346,1355,2516`, `fallow.boundaries.provenance.jsonc:1185-1190`, `coverage.regression-baseline.jsonc:36148-36185`. These moves are count-neutral under S31.
- Docs: `standards/architecture/{16-knowledge-stack,DECISIONS,GLOSSARY}.md`, `packages/shared/domain/README.md`, the package's own `README.md` (6), `AGENTS.md`/`CLAUDE.md`.
- `packages/tooling/library/agent-memory-store/src/MarkdownPartition.models.ts:25` (a comment).
- `packages/epistemic/domain/test/fixtures/value-schema-identifiers.txt` (T8).
- `goals/provenance-shared-claim-kernel/ops/manifest.json`, a historical packet that only names the package.

## 4. AST source maps (SPEC "Target Surfaces"; chapter `16-knowledge-stack.md:168-170,409-410`)

The SPEC names `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema` and `@beep/html` as packages whose source maps import `@beep/text`. The live tree:

| Package | Source-position type | Shape | Consumers |
| --- | --- | --- | --- |
| `@beep/md` | `MdSourceMap` (`packages/foundation/modeling/md/src/Md.syntax.ts:426`), `MdSourceEntry` (`:351`, `{ position: Kit.Position, descendants: Natural, origin, tag, fingerprint: Int }`), `MdLoss.position` (`:226`), `positionAt(map, document, path) → Option<Kit.Position>` (`:603`), `MdFromSyntax.sourceMap` (`:928-940`, from `Md.parse` `parseResult`) | It stores no position type of its own. `Kit` is `@beep/markdown/MarkdownNode` | Only md tests (`md/test/Md.bridge-source-map.test.ts`, `Md.syntax.test.ts`, `Md.bridge-edges.test.ts`, `test/support/bridgeCorpus.ts:225`). No package outside md reads `MdSourceMap` |
| `@beep/markdown` (not named in SPEC) | `Point` (`packages/foundation/modeling/markdown/src/internal/nodes.ts:69`: `{ line, column, offset }`, all `S.Finite`, offsets and columns in UTF-16 code units), `Position` (`:126`: `{ start: Point, end: Point }`, end exclusive, `Position.synthetic` zero-width at 1:1:0), `MarkdownRange` (`src/MarkdownEdit.ts:141`: `{ offset, length }`, `S.Finite`, UTF-16) | mdast-shaped. It allows zero-width and non-integer values in the schema | md, agent-memory-store (`MarkdownRange` via `toMarkdownRange`, `MarkdownPartition.models.ts`) |
| `@beep/pandoc-ast` | none | Pandoc mapping reports locate by `JsonPath` pointers (`Pandoc.report.ts:225,248`), a structural path, not a text offset | |
| `@beep/lexical-schema` | none | (`TableCellSpan` at `Lexical.model.ts:545` is a table column span) | |
| `@beep/html` | none | (`Span` at `Html.model.ts:7468` is the `<span>` element) | |

Mapping to L1. Chapter 16 says "source maps from nodes to anchors, each owned by
its AST package", and the 2026-11-08 report §3 L1 has the same morphism as
`md | pandoc | lexical node → Anchored`. For md, the map is
`Kit.Position.start.offset/end.offset → Position{unit:"utf16-code-unit"}`, plus a
`SourceTextIdentity` for the Markdown text (needed for `Anchored`) and the quote
`text.slice(start, end)`. Three mismatches stand in the way:

1. `Kit.Point.offset` is `S.Finite`, not `S.Natural`.
2. `Position.synthetic` and empty nodes are zero-width, and neither `TextAnchor` nor `Position` admits `start == end`.
3. md holds no `SourceTextIdentity` for the text it parsed.

pandoc-ast, lexical-schema and html have nothing to repoint, so for them "source
maps that import `@beep/text`" means new features (open question 5). The
dependency edges are new too: none of the four depends on provenance today.
pandoc-ast and lexical-schema depend on md, and md depends on html and
markdown. `@beep/rdf` depends on md, an edge the SPEC removes in a later phase.

## 5. Stored and pinned bytes that carry provenance shapes

Database (`packages/_internal/db-admin/drizzle/20260813130540_baseline/migration.sql`):

| Column | Line | Holds | P2 effect |
| --- | --- | --- | --- |
| `epistemic_evidence.span` jsonb | `:267` | encoded `EvidenceSpan` (`TextAnchorFields` + `confidence`) | none in P2 (P4 adds the read transform) |
| `epistemic_evidence_verification.verified_anchor` jsonb | `:284` | encoded `TextAnchorVerificationReceipt` (not a `VerifiedTextAnchor`, which is a runtime-only `S.declare` and cannot be stored) | bytes unchanged; stricter decode if a stored identity holds a lone surrogate (open question 3) |
| `epistemic_evidence_verification.manifestation_key` text | `:283` | `sha256(version + "\n" + canonicalJson(encode({ evidenceId, verifiedAnchor })))` (`packages/foundation/modeling/epistemics/src/EvidenceVerification/EvidenceVerification.model.ts:123-132`) | unchanged while the receipt encoding is unchanged. Any field, order or tag change to `TextAnchor`, `SourceTextIdentity` or the receipt would orphan every stored key. This column is not listed among the SPEC's four |
| `law_practice_patent_citation_event.grounding` jsonb | `:480` | `TextAnchorVerificationReceipt` (`PatentCitationEvent.model.ts:81`) | as for `verified_anchor` |
| `law_practice_legal_position_relator.grounding` jsonb | `:459` | `LegalPositionGrounding { foundingExercise, producingExercise }` (`LegalPositionRelator.values.ts:66`); **no anchor** | none. The SPEC, census section f and decision p0-rq4 count it as an anchor column, which is inaccurate |

Outside the database:

- Citation document receipts `citation-document-receipt/v3` and `citation-mention-receipt/v1`, written by `law-practice/server/src/internal/Citation/Document.ts:350-353` and `Mention.ts:174,194`. Each embeds a receipt and a cm1 id. P2 adds v4 plus a v3→v4 read transform.
- agent-memory-store node events (`NodeEvent.events.ts:78`, `OccurrenceAnchor` with `unit:"utf16"`). They keep their bytes, and `OccurrenceId` is derived from them on read.

## 6. Tests that pin provenance behaviour or bytes

| # | Test | What it pins | P2 outcome |
| --- | --- | --- | --- |
| T1 | `provenance/test/TextAnchor.test.ts` (8 cases: subpath export `:21`, decode and re-slice `:25`, `isWellOrdered` `:40`, UTF-16 boundaries including a surrogate pair `:45`, empty and width rejection `:58`, `it.prop` encoded round trip `:83`, predicate agreement `:103`) | `TextAnchor` shape, width check, boundary predicate | Moves to `text/test`. It overlaps L1-1 and L1-2 but carries none of their ids. The ledger names new files (`TextAnchor.laws.test.ts`, `OffsetUnit.laws.test.ts`) |
| T2 | `provenance/test/VerifiedTextAnchor.test.ts` (15 cases, `:63-415`) | fail-closed verification: cross-scope before stale `:207`, digest and extractor drift `:224`, lone surrogate versus U+FFFD `:271` (pinned digests `replacementCharacterDigest`, `surrogateDigest` `:37-45`), split surrogate pair `:328`, quote mismatch `:345`, receipt round trip grants no proof on decode `:362`, forged-constructor rejection `:148`, `Arbitrary.schema(SourceTextIdentity)` property `:388`, `SourceTextDigest` encoded form `:403` | Moves. `:362` is the existing form of L1-6, and the ledger names `VerifiedTextAnchor.receipt.test.ts`. The `:388` arbitrary must still generate once the well-formed `isPattern` check is added to the string fields |
| T3 | `provenance/test/TaggedError.equivalence.test.ts:7` | `VerifiedTextAnchorError` declared equivalence | Moves |
| T4 | 22 doctests in `provenance/src/*.ts` | examples, including the `sha256:e3b0…` empty digest | Re-pointed to `@beep/text/*` |
| T5 | `packages/law-practice/server/test/CitationMentionIdentity.test.ts:71,241` | cm1 golden `cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9` | Kept as the v1 vector, with a v2 vector beside it (decision p0-rq4) |
| T6 | `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json` (13 `mentionId`) and `goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-adapter/native.observed.json` (29, frozen evidence) | cm1 and the ca1 case-occurrence values | The use-cases fixture is regenerated. The goal evidence stays frozen |
| T7 | `packages/law-practice/domain/test/CitationDocument.test.ts:239` | a `v2` document receipt is refused | It stays. P2 adds `CitationMentionMigration.test.ts` (v3 read to v4) |
| T8 | `packages/epistemic/domain/test/ValueSchemaIdentifiers.test.ts` with `fixtures/value-schema-identifiers.txt` (`toMatchFileSnapshot`) | 20 lines of `@beep/provenance/<Module>/<Symbol>` schema identifiers. The test comment says they "must stay byte-identical so persisted or snapshotted identifiers never move" | **Changes under a rename** unless the new composer keeps the strings (open question 1) |
| T9 | `packages/epistemic/tables/test/EvidenceVerificationTables.test.ts` (encodes receipts `:33-98`), `packages/epistemic/domain/test/EvidenceVerification.test.ts` (receipt encode `:26-117`) | the receipt wire shape and the manifestation key | unchanged |
| T10 | `packages/law-practice/domain/test/fixtures/claim-element/**` (207 JSON files with `startChar`/`endChar`/`quote`) and `packages/law-practice/server/test/fixtures/claim-element/US20200109732A1.claim1.expected.json` | `TextAnchor` wire shape | unchanged |
| T11 | `apps/labs/semantica/fixtures/gold/v1/*.json` (18 files), decoded through `TextAnchorFields` and `TextAnchorWidthCheck` (`schema/Gold.ts`) | flattened anchor wire shape and `quoteSha256` | unchanged |
| T12 | `apps/labs/lejeune-bolt-workbench/src/fixtures/fixture-manifest.json` | anchor fields | unchanged |
| T13 | md source-map suite (`md/test/Md.bridge-source-map.test.ts:42-175`) | `positionAt` and entry identity over the corpus | unchanged unless P2 changes `Kit.Position` |
| T14 | langextract `test/VerifiedSpanHistory.test.ts` | verify and re-anchor history | unchanged until langextract is re-expressed on `@beep/text` |
| T15 | `packages/foundation/modeling/identity/test/shape-stable.test.ts:147` | `$ProvenanceId: "@beep/provenance"` | edited with the composer |

No `__snapshots__` or `.snap` file holds a provenance shape. T8 is the only file snapshot.

## 7. Facts a designer needs

1. **Shapes stay, bytes stay.** Every stored or pinned provenance encoding (T9 to T12, three DB columns, the receipts) is a `TextAnchor`, `SourceTextIdentity` or receipt encoding. Decision `p0-text-anchor-retained-beside-selector-position` keeps all three. `Position`, `Selector`, `Anchored` and `OccurrenceId` are additions, so the P2 rename changes no stored bytes. The changes are the cm1 cascade, the receipt v4, the well-formed-text decode and the schema identifier strings (T8).
2. **Identifier strings move with the composer.** `$ProvenanceId` builds every `@beep/provenance/...` identifier, and T8 pins 20 of them. No registry term is involved (section 1), so L0-3 stays green whatever happens.
3. **Two hash disciplines will coexist.** `SourceTextDigest` (plain sha256 over UTF-8 text, `sha256:` prefix) and `OccurrenceId`/`QuoteKey` (`mintContentHash`, a domain-tagged RFC 8785 array). cm1 is a third today: JSON-string tuple to bare hex, prefixed `cm1:` (`MentionIdentity.ts:125-147`). It goes away with v2.
4. **Proof gate.** cm1 is minted "only from a genuine verified anchor, never a structural receipt" (`MentionIdentity.ts:111-121`). The design's `mintOccurrenceId` takes `Anchored`, a receipt (`L1.text.ts:253-259`), and `mintCitationMentionDigest` takes an `OccurrenceId`. Restore already re-verifies source text before rebuilding a document (`Document.ts:395-403`), so the v3→v4 read transform can mint from re-verified anchors.
5. **The well-formed-text constraint is a decode change on stored rows.** `verifySourceTextIdentity` already refuses lone surrogates in the source text (`VerifiedTextAnchor.ts:600-602`), but the identity's own string fields were never checked. `scopeRef`, `sourceRef` and `locator` could hold a lone surrogate in a stored receipt. The internal `WellFormedSourceText` regex (`:22-36`) is the check to reuse.
6. **Prior art for L1 behaviour sits in langextract.** `locateRawText` (unique-or-fail, ambiguity typed), `convertTextOffsetRange` (code point to UTF-16, split-surrogate refusal) and `reanchorVerifiedSpanHistory` exist, with tests, at `VerifiedSpan.behavior.ts:298,385,816`. They are the natural source for `resolve`, `convertPosition` and `reanchor`.
7. **Semantics mismatches to settle.** `isWellOrdered` allows empty ranges, but `TextAnchor` and `Position` do not. The rdf `TextPositionSelector` has no order check and no unit. rdf `FragmentSelector.conformsTo` is optional `IRIReference`, the design's is required `IRI`. md positions allow zero width and non-integers. The agent-memory-store unit literal is `utf16`.
8. **New package edges.** `@beep/text` adds a dependency on `@beep/jsonc` (minting) next to `@beep/identity` (`IRI` for `FragmentSelector`, `L1.text.ts:13`) and `@beep/schema`. `@beep/rdf` gains `@beep/text` for the `oa:` codec. md, pandoc-ast, lexical-schema and html gain `@beep/text` only if they ship source maps.

## 8. Migration table (importer → new symbol → behaviour / bytes change)

Every row re-points imports from `@beep/provenance[/X]` to `@beep/text[/X]` (subpaths `SourceTextIdentity`, `TextAnchor` and `VerifiedTextAnchor` kept as module names unless P2 renames them). Columns: new symbol or symbols, then behaviour change, then bytes change.

| Importer | New symbol(s) | Behaviour change | Bytes change |
| --- | --- | --- | --- |
| law-practice domain, claim-element and doc-structure models (`ClaimClauseRole.*`, `ClaimElement.*`, `ClaimLexicalEvidence`, `DocStructure.*`, `PatentDocument.transition.ts`, `Distinction.model.ts`; 30 tests) | `TextAnchor` (same) | no: shape and checks kept | no: T10 fixtures unchanged |
| law-practice domain `Citation.mention.ts`, `Citation.document.ts` | `TextAnchorVerificationReceipt`, `VerifiedTextAnchor`, `SourceTextIdentity`, plus `OccurrenceId`; receipt `schemaVersion` v4 / mention receipt v2 | yes: new receipt version, v3 accepted only through the declared read transform | yes: new receipt versions and new mention ids (T5 to T7) |
| law-practice domain `PatentCitationEvent.model.ts:81` | `TextAnchorVerificationReceipt` | only the stricter identity-string decode | no: stored `grounding` keeps its bytes |
| law-practice domain `ObservationVersionRef.model.ts`, `internal/officeActionFixture.ts` | `SourceTextDigest`, `verifySourceTextIdentity`, … | no | no |
| law-practice server `MentionIdentity.ts` | `mintOccurrenceId` + `mintCitationMentionDigest` (`citation-mention/v2`) | yes: the preimage gains an explicit unit, and mentions share one occurrence. Keep the proof gate (fact 4) | yes: cm1 to v2, with ca1 case-occurrence, cl1 and cg1 re-minted (`AuthorityIdentity.ts:77,117-120`, `Resolve.ts:349-356`, `SessionDocument.ts:220,230`) |
| law-practice server `Document.ts`, `Mention.ts`, `SessionDocument.ts` | receipt v4 writer + v3→v4 read transform | yes: v3 converts on read instead of being refused | yes: new writes are v4 |
| law-practice server other Citation internals and `OfficeActionStructure.{layer,repo}.ts` | same symbols; optionally `resolve`/`OccurrenceId` in `OccurrenceProjection.ts` | no (rename only) unless `resolve` replaces langextract locate | no |
| law-practice use-cases (`CitationEngine.*`, `CitationExtractor.models.ts`, `OfficeActionStructure.*`, `CandorPolicy.service.ts`, `IrToLaw.service.ts`, `ClaimInspection.lexical.ts`) | same symbols; `SourceQuote`/`TextQuote`/`SourceRef` become occurrence projections (P2 to P3) | no for the rename. Projections are a P2/P3 behaviour change outside provenance | no |
| epistemic domain `EvidenceVerification.*` | `TextAnchorVerificationReceipt` | no | stored bytes and `manifestation_key` no. **T8 identifier fixture yes** (20 lines) unless the identifiers are preserved |
| epistemics `EvidenceSpan.model.ts`, `EvidenceVerification.model.ts`, `ClaimEvidenceReview.model.ts` | `TextAnchorFields`, `TextAnchorWidthCheck`, `isInternallyConsistent`, receipt, error reason | no in P2 (`EvidenceSpan` retires in P4) | no |
| epistemic tables, server, use-cases, ui | same symbols | no | no |
| langextract `VerifiedSpan.*` | same symbols now; `OffsetUnit`, `Position`, `convertPosition`, `resolve`, `reanchor` when re-expressed (P2 to P3) | yes once re-expressed: refusal types become `UnitConversionRefused`/`Resolution`. `VerifiedSpanAttemptFailureReason` unions the provenance reason (`:362`) | no stored bytes found (`VerifiedSpanHistory` has no consumer outside langextract) |
| agent-memory-store `SpanAnchor.models.ts`, `MarkdownProjector.layer.ts` | `SourceTextIdentity`, `TextAnchor`; `OccurrenceId` derived at read time (`utf16` → `utf16-code-unit`) | yes: occurrence identity becomes available | no: node events keep bytes; frozen old-event fixture required |
| file-processing `SourceText.schema.ts` | `SourceTextIdentity` | the stricter identity-string decode at the port | no |
| workspace server `WorkspaceSourceTextResolver.ts` | `SourceTextDigest`, `SourceTextExtractor`, `SourceTextIdentity`, `verifySourceTextIdentity` | stricter decode only | no |
| semantica (`schema/{Gold,Evidence,Text,Provenance,Errors}.ts`, `layers/*Live.ts`, `services/Canonicalizer.ts`, 8 tests) | same symbols | no | no: T11 gold fixtures unchanged |
| professional-desktop `ContradictionQaSeed.ts` + test | same symbols | no | no |
| lejeune `domain/Bundle.ts` | `TextAnchor` | no | no (T12) |
| cli `Kb.service.ts` | `TextAnchor.isInternallyConsistent`, `isUtf16Boundary` | no (Kb `Selector` kept; P7 re-checks) | no |
| goal design module `ops/design/{L1.text,L2.annotation,L4.claims,generators}.ts` | imports `@beep/text`. `L1.text.ts` is the source of the package's new modules | n/a | n/a |
| rdf `Evidence.ts` selectors (no provenance import today) | deleted, replaced by `Selector`; `WebAnnotation.ts` gains `TextAnchor ⇄ oa:` via `convertPosition` | yes: `oa:start`/`oa:end` become code points, converted from stored UTF-16 and failing closed on a split surrogate | yes for astral-plane text on the wire; no internal consumer (census f row 1) |
| md `Md.syntax.ts` (no provenance import today) | node → `Anchored`/`Position` source map | yes (new capability) | no for existing `MdSourceMap` unless `Kit.Position` changes |
| party domain `EvidenceAnchor.TextSpan`, `OccurrenceId` `party-occ` (no provenance import today) | `TextSpan` deleted for an `@beep/text` occurrence; `party-occ` renamed | yes | yes for party wire shapes. No table stores them (`packages/party` has no tables package) |
| identity `packages.ts:497` + `shape-stable.test.ts:147` | `$TextId` (name to be chosen) | no | identifier strings yes (T8, schema catalog); no registry term |
| tooling, config and standards inventories (section 3 list) | `@beep/text` paths | no | inventory text only; count-neutral |

## 9. Open questions

1. **Schema identifiers.** T8 (`value-schema-identifiers.txt`, 20 lines) pins `@beep/provenance/...` identifiers, and its test comment claims they "never move". Does P2 regenerate T8 under a decision (no persisted use of these identifiers was found outside that fixture) or keep the old identifier prefix in `@beep/text`?
2. **Proof gate for minting.** `makeCitationMentionId` refuses receipts today (`MentionIdentity.ts:111-121`), but the design mints `OccurrenceId` from `Anchored` (a receipt). Should `mintOccurrenceId` also accept a `VerifiedTextAnchor` (or should cm2 minting require one) so the mention path keeps its proof requirement? Should the v3→v4 transform re-verify against the source text (as restore does at `Document.ts:402`) or trust the stored receipt?
3. **Lone surrogates in stored rows.** Does the well-formed-text constraint on the `SourceTextIdentity` strings need a declared read-time transform (or a measured proof that no row in `verified_anchor` or `patent_citation_event.grounding` holds a lone surrogate) under the stored-format law?
4. **Census and SPEC count of anchor columns.** `legal_position_relator.grounding` holds no anchor, and `verified_anchor` holds a receipt, not a `VerifiedTextAnchor`. Meanwhile `manifestation_key` is a hash over the receipt encoding that is not named. Should decision p0-rq4 and census section f be corrected?
5. **AST source maps.** Only `@beep/md` has a source map, and its position type lives in `@beep/markdown`, which is outside the SPEC list and the chapter-11 amendment's package list. pandoc-ast, lexical-schema and html have none. Is P2's exit "md's source map yields `Anchored`" only, with the other three deferred or dropped? How are zero-width and synthetic positions represented, given `TextAnchor` and `Position` refuse empty ranges?
6. **`isWellOrdered`.** It accepts `start == end`, against every other range in L1. Should it be kept as is, tightened, or retired?
7. **Selector details.** rdf `FragmentSelector.conformsTo` is optional, and the design's `FragmentSelector.conformsTo` is required. Is that a deliberate narrowing? And which `conformsTo` IRIs (if any) cover party's non-text `EvidenceAnchor` cases?
8. **langextract scope in P2.** Are `convertTextOffsetRange`, `locateRawText` and `reanchorVerifiedSpanHistory` replaced by the `@beep/text` functions in P2, or only after P3 (the census says "P2 and P3")?
9. **`normalizationVersion` meaning.** `SourceTextIdentity.normalizationVersion` is documented as the locator-only normalization contract. `mintQuoteKey(normalizationVersion, normalizedQuote)` uses the same name for quote normalization (NFKC and de-hyphenation in L1-3). Are they one version or two?
10. **agent-memory-store sequencing.** The P2 work there waits for "that goal's open lane" (decision p0-rq4). Is that lane merged at P2's base?

## Appendix A. Importers per symbol and package

All importing files, including the owner package (`packages/foundation/modeling/provenance`, its own src and tests and JSDoc examples) and the goal design module. "Uses" counts non-import, non-comment lines that name the binding. Kinds are the heuristic labels from section 0.

### `SourceTextDigest` (39 files, 101 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 2 | 5 | arbitrary 2, type-arg 2, other 2, construct 1 |
| `apps/labs/semantica` | 7 | 13 | construct 12, field-or-param 1 |
| `apps/professional-desktop` | 2 | 3 | construct 2, decode 1, type-arg 1 |
| `packages/epistemic/domain` | 2 | 3 | construct 3 |
| `packages/epistemic/server` | 1 | 2 | construct 2 |
| `packages/epistemic/tables` | 1 | 1 | construct 1 |
| `packages/epistemic/ui` | 2 | 5 | construct 4, field-or-param 1 |
| `packages/epistemic/use-cases` | 1 | 2 | construct 2 |
| `packages/foundation/capability/file-processing` | 1 | 1 | construct 1 |
| `packages/foundation/capability/langextract` | 1 | 1 | construct 1 |
| `packages/foundation/modeling/epistemics` | 1 | 1 | construct 1 |
| `packages/foundation/modeling/provenance` | 3 | 36 | other 13, construct 8, field-or-param 6, static:annotateKey 6, type-arg 6, type 3, equivalence 3, decode 1, encode 1, guard 1 |
| `packages/law-practice/domain` | 2 | 3 | field-or-param 2, static:annotateKey 2, construct 1 |
| `packages/law-practice/server` | 6 | 9 | construct 8, type-arg 1 |
| `packages/law-practice/use-cases` | 1 | 1 | construct 1 |
| `packages/tooling/library/agent-memory-store` | 4 | 7 | construct 7 |
| `packages/workspace/server` | 2 | 8 | type-arg 4, decode 2, field-or-param 2, other 2, equivalence 1 |

### `SourceTextExtractor` (43 files, 72 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 1 | 2 | construct 2 |
| `apps/labs/semantica` | 12 | 20 | construct 17, field-or-param 3 |
| `apps/professional-desktop` | 2 | 2 | construct 2 |
| `packages/epistemic/domain` | 2 | 3 | construct 3 |
| `packages/epistemic/server` | 1 | 1 | construct 1 |
| `packages/epistemic/tables` | 1 | 1 | construct 1 |
| `packages/epistemic/ui` | 2 | 3 | construct 3 |
| `packages/epistemic/use-cases` | 1 | 2 | construct 2 |
| `packages/foundation/capability/file-processing` | 1 | 1 | construct 1 |
| `packages/foundation/capability/langextract` | 1 | 1 | construct 1 |
| `packages/foundation/modeling/epistemics` | 1 | 1 | construct 1 |
| `packages/foundation/modeling/provenance` | 3 | 16 | type-arg 7, construct 5, other 2, decode 2, field-or-param 2 |
| `packages/law-practice/domain` | 1 | 1 | construct 1 |
| `packages/law-practice/server` | 6 | 8 | construct 8 |
| `packages/law-practice/use-cases` | 2 | 2 | construct 2 |
| `packages/tooling/library/agent-memory-store` | 4 | 3 | construct 3 |
| `packages/workspace/server` | 2 | 5 | field-or-param 2, equivalence 1, type-arg 1, decode 1, construct 1 |

### `SourceTextIdentity` (75 files, 208 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 3 | 11 | field-or-param 7, construct 2, static:annotateKey 2, other 1, equivalence 1, type-arg 1 |
| `apps/labs/semantica` | 6 | 7 | construct 7 |
| `apps/professional-desktop` | 2 | 2 | construct 2 |
| `packages/epistemic/domain` | 2 | 5 | construct 5 |
| `packages/epistemic/server` | 1 | 1 | construct 1 |
| `packages/epistemic/tables` | 1 | 2 | construct 2 |
| `packages/epistemic/ui` | 2 | 4 | construct 4 |
| `packages/epistemic/use-cases` | 6 | 11 | construct 4, field-or-param 3, equivalence 2, type-arg 2, static:fields 1, other 1, static:annotateKey 1 |
| `packages/foundation/capability/file-processing` | 2 | 6 | field-or-param 4, construct 1, encode 1, type-arg 1 |
| `packages/foundation/capability/langextract` | 3 | 19 | field-or-param 12, type 4, equivalence 2, type-arg 2, construct 1 |
| `packages/foundation/modeling/epistemics` | 2 | 3 | field-or-param 2, construct 1 |
| `packages/foundation/modeling/provenance` | 3 | 54 | field-or-param 24, other 14, type-arg 9, equivalence 4, construct 4, static:ts 3, decode 1, encode 1, arbitrary 1 |
| `packages/law-practice/domain` | 4 | 9 | equivalence 3, type-arg 3, other 2, field-or-param 2, construct 1, type 1 |
| `packages/law-practice/server` | 24 | 43 | type-arg 18, field-or-param 11, construct 10, equivalence 10, static:pipe 3, schema-wrap 2, type 1 |
| `packages/law-practice/use-cases` | 8 | 16 | field-or-param 6, type-arg 4, construct 3, equivalence 2, other 2, type 1, schema-wrap 1, decode 1 |
| `packages/tooling/library/agent-memory-store` | 4 | 7 | construct 4, field-or-param 3, static:annotateKey 3 |
| `packages/workspace/server` | 2 | 8 | type-arg 4, other 2, decode 1, encode 1, construct 1, field-or-param 1, equivalence 1 |

### `TextAnchor` (90 files, 818 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 1 | 1 | construct 1 |
| `apps/labs/lejeune-bolt-workbench` | 1 | 4 | field-or-param 2, construct 2 |
| `apps/labs/semantica` | 11 | 30 | construct 12, field-or-param 9, type-arg 7, equivalence 3, decode 1, static:makeOption 1, other 1 |
| `apps/professional-desktop` | 2 | 9 | construct 7, field-or-param 2 |
| `packages/epistemic/domain` | 2 | 4 | construct 3, decode 1, type-arg 1 |
| `packages/epistemic/server` | 1 | 3 | construct 2, field-or-param 1 |
| `packages/epistemic/tables` | 1 | 4 | construct 3, field-or-param 1 |
| `packages/epistemic/use-cases` | 1 | 2 | construct 2 |
| `packages/foundation/capability/langextract` | 1 | 19 | type-arg 18, static:makeOption 1 |
| `packages/foundation/modeling/epistemics` | 3 | 10 | construct 5, field-or-param 3, equivalence 1, type-arg 1, other 1 |
| `packages/foundation/modeling/provenance` | 4 | 60 | type-arg 16, other 12, field-or-param 10, type 6, decode 6, construct 5, static:isWellOrdered 5, static:isInternallyConsistent 4, static:ts 2, encode 1, guard 1, arbitrary 1, equivalence 1 |
| `packages/law-practice/domain` | 43 | 644 | field-or-param 413, type-arg 110, construct 92, schema-wrap 38, other 29, static:annotateKey 5, static:makeOption 4, equivalence 2, type 1, guard 1 |
| `packages/law-practice/server` | 10 | 13 | construct 8, field-or-param 4, type-arg 1, schema-wrap 1 |
| `packages/law-practice/use-cases` | 3 | 6 | type-arg 4, construct 2, decode 2, equivalence 1 |
| `packages/tooling/library/agent-memory-store` | 5 | 8 | construct 5, field-or-param 3, static:annotateKey 3 |
| `packages/tooling/tool/cli` | 1 | 1 | static:isInternallyConsistent 1 |

### `TextAnchorFields` (5 files, 12 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `apps/labs/semantica` | 2 | 6 | static:startChar 3, static:endChar 3 |
| `packages/epistemic/tables` | 1 | 1 | static:quote 1 |
| `packages/foundation/modeling/epistemics` | 1 | 1 | static:quote 1 |
| `packages/foundation/modeling/provenance` | 1 | 4 | other 2, type-arg 2 |

### `TextAnchorVerificationReceipt` (30 files, 63 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 3 | 5 | field-or-param 2, type-arg 2, construct 1, schema-wrap 1 |
| `apps/labs/semantica` | 7 | 10 | construct 7, field-or-param 2, type-arg 1 |
| `apps/professional-desktop` | 2 | 3 | construct 2, field-or-param 1 |
| `packages/epistemic/domain` | 3 | 9 | field-or-param 5, construct 3, static:annotateKey 1, encode 1, type-arg 1 |
| `packages/epistemic/server` | 2 | 3 | construct 3 |
| `packages/epistemic/tables` | 1 | 7 | construct 5, encode 2, type-arg 2 |
| `packages/epistemic/use-cases` | 1 | 1 | field-or-param 1, static:pipe 1 |
| `packages/foundation/capability/langextract` | 1 | 1 | field-or-param 1 |
| `packages/foundation/modeling/epistemics` | 2 | 2 | field-or-param 1, static:annotateKey 1, construct 1 |
| `packages/foundation/modeling/provenance` | 2 | 14 | other 9, type-arg 3, construct 2, decode 1, encode 1, equivalence 1 |
| `packages/law-practice/domain` | 2 | 4 | field-or-param 4, static:annotateKey 1 |
| `packages/law-practice/server` | 3 | 3 | field-or-param 1, construct 1, type-arg 1 |
| `packages/law-practice/use-cases` | 1 | 1 | type-arg 1 |

### `TextAnchorWidthCheck` (4 files, 13 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `apps/labs/semantica` | 2 | 6 | check 6, type-arg 6 |
| `packages/foundation/modeling/epistemics` | 1 | 1 | check 1, type-arg 1 |
| `packages/foundation/modeling/provenance` | 1 | 6 | other 4, check 2, type-arg 2 |

### `VerifiedSourceText` (30 files, 76 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 1 | 2 | field-or-param 2 |
| `packages/foundation/capability/langextract` | 1 | 2 | field-or-param 2 |
| `packages/foundation/modeling/provenance` | 2 | 11 | type-arg 5, other 4, field-or-param 2, guard 1 |
| `packages/law-practice/domain` | 1 | 1 | other 1 |
| `packages/law-practice/server` | 19 | 46 | type-arg 23, field-or-param 22, guard 7, decode 3, schema-wrap 2, other 1 |
| `packages/law-practice/use-cases` | 5 | 13 | type-arg 11, field-or-param 4, guard 3, schema-wrap 1 |
| `packages/workspace/server` | 1 | 1 | guard 1, type-arg 1 |

### `VerifiedTextAnchor` (11 files, 46 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 1 | 2 | type-arg 2 |
| `packages/foundation/modeling/provenance` | 2 | 25 | other 9, type-arg 8, field-or-param 2, static:verifySourceTextIdentity 2, static:verifyAgainstVerifiedSource 2, static:verify 2, decode 1, guard 1 |
| `packages/law-practice/domain` | 2 | 7 | type-arg 6, field-or-param 1 |
| `packages/law-practice/server` | 6 | 12 | type-arg 8, field-or-param 4, guard 2 |

### `VerifiedTextAnchorError` (9 files, 41 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `goals/text-knowledge-stack-rebuild/ops/design` | 1 | 2 | type-arg 2 |
| `apps/labs/semantica` | 2 | 2 | field-or-param 1, static:fromReason 1 |
| `packages/foundation/modeling/provenance` | 2 | 26 | static:fromReason 16, type-arg 6, other 3, construct 1, equivalence 1 |
| `packages/law-practice/domain` | 1 | 1 | type-arg 1 |
| `packages/law-practice/server` | 1 | 2 | static:fromReason 2 |
| `packages/law-practice/use-cases` | 2 | 8 | type-arg 4, static:fromReason 4 |

### `VerifiedTextAnchorErrorReason` (4 files, 14 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/capability/langextract` | 1 | 1 | type-arg 1 |
| `packages/foundation/modeling/epistemics` | 1 | 2 | field-or-param 2 |
| `packages/foundation/modeling/provenance` | 1 | 10 | other 4, field-or-param 4, type 2 |
| `packages/law-practice/use-cases` | 1 | 1 | field-or-param 1 |

### `VerifySourceTextIdentityInput` (16 files, 38 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/capability/langextract` | 1 | 1 | construct 1 |
| `packages/foundation/modeling/provenance` | 2 | 16 | construct 8, other 6, field-or-param 2 |
| `packages/law-practice/domain` | 1 | 2 | other 1, construct 1 |
| `packages/law-practice/server` | 9 | 12 | construct 9, field-or-param 1, equivalence 1, static:fields 1, other 1 |
| `packages/law-practice/use-cases` | 2 | 6 | construct 4, field-or-param 2 |
| `packages/workspace/server` | 1 | 1 | construct 1 |

### `VerifyTextAnchorAgainstVerifiedSourceInput` (11 files, 23 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/capability/langextract` | 1 | 1 | construct 1 |
| `packages/foundation/modeling/provenance` | 2 | 9 | construct 5, other 3, field-or-param 1 |
| `packages/law-practice/domain` | 2 | 6 | construct 6 |
| `packages/law-practice/server` | 5 | 5 | construct 5 |
| `packages/law-practice/use-cases` | 1 | 2 | construct 2 |

### `VerifyTextAnchorInput` (10 files, 29 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `apps/labs/semantica` | 1 | 1 | construct 1 |
| `apps/professional-desktop` | 1 | 1 | construct 1 |
| `packages/epistemic/server` | 1 | 1 | construct 1 |
| `packages/epistemic/use-cases` | 1 | 2 | construct 2 |
| `packages/foundation/modeling/provenance` | 2 | 18 | construct 9, type-arg 3, other 3, field-or-param 3 |
| `packages/law-practice/server` | 3 | 5 | construct 5 |
| `packages/law-practice/use-cases` | 1 | 1 | construct 1 |

### `isInternallyConsistent` (3 files, 6 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/modeling/epistemics` | 1 | 1 | call 1 |
| `packages/foundation/modeling/provenance` | 2 | 5 | call 3, other 2 |

### `isUtf16Boundary` (5 files, 17 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `apps/labs/semantica` | 1 | 4 | call 4 |
| `packages/foundation/capability/langextract` | 1 | 2 | call 2 |
| `packages/foundation/modeling/provenance` | 2 | 9 | call 8, other 1 |
| `packages/tooling/tool/cli` | 1 | 2 | call 2 |

### `isWellOrdered` (2 files, 6 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/modeling/provenance` | 2 | 6 | other 3, call 3 |

### `toTextAnchorVerificationReceipt` (11 files, 20 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `apps/labs/semantica` | 1 | 1 | field-or-param 1 |
| `apps/professional-desktop` | 1 | 1 | call 1 |
| `packages/foundation/capability/langextract` | 1 | 1 | call 1 |
| `packages/foundation/modeling/provenance` | 2 | 3 | other 1, type-arg 1, call 1 |
| `packages/law-practice/domain` | 1 | 1 | call 1 |
| `packages/law-practice/server` | 5 | 13 | call 13 |

### `verifySourceTextIdentity` (14 files, 24 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/capability/langextract` | 1 | 1 | call 1 |
| `packages/foundation/modeling/provenance` | 2 | 8 | call 7, other 1 |
| `packages/law-practice/domain` | 1 | 1 | call 1 |
| `packages/law-practice/server` | 8 | 9 | call 9 |
| `packages/law-practice/use-cases` | 1 | 4 | call 4 |
| `packages/workspace/server` | 1 | 1 | call 1 |

### `verifyTextAnchor` (10 files, 22 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `apps/labs/semantica` | 1 | 1 | call 1 |
| `apps/professional-desktop` | 1 | 1 | call 1 |
| `packages/epistemic/server` | 1 | 1 | call 1 |
| `packages/epistemic/use-cases` | 1 | 2 | call 2 |
| `packages/foundation/modeling/provenance` | 2 | 11 | call 9, other 2 |
| `packages/law-practice/server` | 3 | 5 | call 5 |
| `packages/law-practice/use-cases` | 1 | 1 | call 1 |

### `verifyTextAnchorAgainstVerifiedSource` (11 files, 20 use lines)

| Package | Files | Uses | Kinds |
| --- | --- | --- | --- |
| `packages/foundation/capability/langextract` | 1 | 1 | call 1 |
| `packages/foundation/modeling/provenance` | 2 | 6 | call 5, other 1 |
| `packages/law-practice/domain` | 2 | 6 | call 6 |
| `packages/law-practice/server` | 5 | 5 | call 5 |
| `packages/law-practice/use-cases` | 1 | 2 | call 2 |

## Appendix B. Importers per file

Grouped by owning package (nearest `package.json`); paths are relative to that package. Each cell: binding, use-line count, heuristic kinds, first six line numbers.

### goals/text-knowledge-stack-rebuild/ops/design (package root `.`)

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `generators.ts` | `SourceTextDigest` 3 (arbitrary 2, type-arg 2, construct 1) @158,209,756; `SourceTextExtractor` 2 (construct 2) @248,786; `SourceTextIdentity` 4 (field-or-param 2, construct 2) @139,188,242,780; `TextAnchor` 1 (construct 1) @145; `TextAnchorVerificationReceipt` 1 (construct 1) @144 |
| `L1.text.ts` | `SourceTextDigest` 2 (other 2) @218,219; `SourceTextIdentity` 3 (field-or-param 2, static:annotateKey 2, other 1) @202,346,347; `TextAnchorVerificationReceipt` 1 (field-or-param 1) @187; `VerifiedSourceText` 2 (field-or-param 2) @367,372 |
| `L2.annotation.ts` | `SourceTextIdentity` 4 (field-or-param 3, equivalence 1, type-arg 1) @37,143,257,472 |
| `L4.claims.ts` | `TextAnchorVerificationReceipt` 3 (type-arg 2, schema-wrap 1, field-or-param 1) @166,243,245; `VerifiedTextAnchor` 2 (type-arg 2) @243,246; `VerifiedTextAnchorError` 2 (type-arg 2) @243,246 |

### apps/labs/lejeune-bolt-workbench

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/domain/Bundle.ts` | `TextAnchor` 4 (field-or-param 2, construct 2) @146,384,631,1126 |

### apps/labs/semantica

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/canary/Gold.ts` | `TextAnchor` 3 (field-or-param 2, decode 1) @357,394,672 |
| `src/layers/CanaryC0Live.ts` | `SourceTextExtractor` 1 (construct 1) @68 |
| `src/layers/CanonicalizerLive.ts` | `SourceTextDigest` 2 (construct 2) @36,38; `SourceTextIdentity` 1 (construct 1) @31; `toTextAnchorVerificationReceipt` 1 (field-or-param 1) @58; `VerifyTextAnchorInput` 1 (construct 1) @44; `verifyTextAnchor` 1 (call 1) @43 |
| `src/layers/ChunkerLive.ts` | `TextAnchor` 1 (construct 1) @224 |
| `src/layers/ExtractorLive.ts` | `TextAnchor` 15 (type-arg 6, field-or-param 5, construct 3, static:makeOption 1, other 1, equivalence 1) @224,251,358,374,376,377,… |
| `src/layers/ParserLive.ts` | `SourceTextExtractor` 5 (construct 4, field-or-param 1) @35,36,37,38,49 |
| `src/schema/Errors.ts` | `VerifiedTextAnchorError` 1 (field-or-param 1) @145 |
| `src/schema/Evidence.ts` | `TextAnchor` 1 (construct 1, equivalence 1) @478; `TextAnchorFields` 0 () @; `TextAnchorVerificationReceipt` 1 (field-or-param 1) @422; `TextAnchorWidthCheck` 3 (check 3, type-arg 3) @316,334,351 |
| `src/schema/Gold.ts` | `TextAnchorFields` 6 (static:startChar 3, static:endChar 3) @301,302,347,351,421,422; `TextAnchorWidthCheck` 3 (check 3, type-arg 3) @163,195,243 |
| `src/schema/Provenance.ts` | `SourceTextExtractor` 1 (field-or-param 1) @34 |
| `src/schema/Text.ts` | `SourceTextDigest` 1 (field-or-param 1) @182; `SourceTextExtractor` 1 (field-or-param 1) @21; `TextAnchor` 2 (field-or-param 1, equivalence 1, type-arg 1) @176,229; `TextAnchorVerificationReceipt` 1 (field-or-param 1) @177 |
| `src/services/Canonicalizer.ts` | `TextAnchor` 1 (field-or-param 1) @24; `TextAnchorVerificationReceipt` 1 (type-arg 1) @25 |
| `test/C0Input.test.ts` | `isUtf16Boundary` 4 (call 4) @259,260,378,379; `SourceTextExtractor` 3 (construct 3) @297,343,367; `TextAnchor` 1 (construct 1) @216 |
| `test/Evaluator.test.ts` | `SourceTextDigest` 2 (construct 2) @174,176; `SourceTextExtractor` 3 (construct 3) @106,157,170; `SourceTextIdentity` 1 (construct 1) @169; `TextAnchor` 2 (construct 2) @200,227; `TextAnchorVerificationReceipt` 2 (construct 2) @200,227 |
| `test/Extractor.test.ts` | `SourceTextExtractor` 1 (construct 1) @77 |
| `test/Gold.test.ts` | `SourceTextExtractor` 1 (construct 1) @178 |
| `test/GoldSource.test.ts` | `SourceTextDigest` 2 (construct 2) @251,253; `SourceTextExtractor` 1 (construct 1) @245; `SourceTextIdentity` 1 (construct 1) @246 |
| `test/helpers/CrashProbeChild.ts` | `SourceTextDigest` 2 (construct 2) @64,66; `SourceTextExtractor` 1 (construct 1) @60; `SourceTextIdentity` 1 (construct 1) @59; `TextAnchor` 1 (construct 1) @34; `TextAnchorVerificationReceipt` 1 (construct 1) @57 |
| `test/Projection.test.ts` | `SourceTextDigest` 2 (construct 2) @275,277; `SourceTextExtractor` 1 (construct 1) @271; `SourceTextIdentity` 1 (construct 1) @270; `TextAnchor` 1 (construct 1) @279; `TextAnchorVerificationReceipt` 1 (construct 1) @280 |
| `test/Schema.test.ts` | `SourceTextDigest` 2 (construct 2) @226,227; `SourceTextExtractor` 1 (construct 1) @221; `SourceTextIdentity` 2 (construct 2) @222,899; `TextAnchor` 2 (construct 2) @231,236; `TextAnchorVerificationReceipt` 3 (construct 3) @241,242,900; `VerifiedTextAnchorError` 1 (static:fromReason 1) @851 |

### apps/professional-desktop

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/contradiction/ContradictionQaSeed.ts` | `SourceTextDigest` 1 (decode 1, type-arg 1) @541; `SourceTextExtractor` 1 (construct 1) @980; `SourceTextIdentity` 1 (construct 1) @979; `TextAnchor` 1 (construct 1) @991; `TextAnchorVerificationReceipt` 1 (construct 1) @740; `toTextAnchorVerificationReceipt` 1 (call 1) @1052; `VerifyTextAnchorInput` 1 (construct 1) @998; `verifyTextAnchor` 1 (call 1) @997 |
| `test/contradiction-sidecar-registration.test.ts` | `SourceTextDigest` 2 (construct 2) @62,176; `SourceTextExtractor` 1 (construct 1) @170; `SourceTextIdentity` 1 (construct 1) @169; `TextAnchor` 8 (construct 6, field-or-param 2) @291,311,331,408,432,455,…; `TextAnchorVerificationReceipt` 2 (field-or-param 1, construct 1) @180,296 |

### packages/epistemic/domain

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/entities/EvidenceVerification/EvidenceVerification.behavior.ts` | `TextAnchorVerificationReceipt` 3 (field-or-param 3) @62,66,68 |
| `src/entities/EvidenceVerification/EvidenceVerification.model.ts` | `TextAnchorVerificationReceipt` 1 (field-or-param 1, static:annotateKey 1) @49 |
| `test/ClaimEvidenceReview.test.ts` | `SourceTextDigest` 1 (construct 1) @28; `SourceTextExtractor` 2 (construct 2) @45,124; `SourceTextIdentity` 3 (construct 3) @39,115,122 |
| `test/EpistemicDomain.test.ts` | `TextAnchor` 2 (decode 1, type-arg 1, construct 1) @38,154 |
| `test/EvidenceVerification.test.ts` | `SourceTextDigest` 2 (construct 2) @28,29; `SourceTextExtractor` 1 (construct 1) @38; `SourceTextIdentity` 2 (construct 2) @37,105; `TextAnchor` 2 (construct 2) @32,111; `TextAnchorVerificationReceipt` 5 (construct 3, encode 1, type-arg 1, field-or-param 1) @26,31,103,110,117 |

### packages/epistemic/server

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/ContradictionTriage/ContradictionTriage.layer.ts` | `TextAnchorVerificationReceipt` 1 (construct 1) @120; `VerifyTextAnchorInput` 1 (construct 1) @325; `verifyTextAnchor` 1 (call 1) @324 |
| `test/integration/ContradictionTriage.pglite.test.ts` | `SourceTextDigest` 2 (construct 2) @144,146; `SourceTextExtractor` 1 (construct 1) @140; `SourceTextIdentity` 1 (construct 1) @139; `TextAnchor` 3 (construct 2, field-or-param 1) @132,163,954; `TextAnchorVerificationReceipt` 2 (construct 2) @137,953 |

### packages/epistemic/tables

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/entities/Evidence/Evidence.converters.ts` | `TextAnchorFields` 1 (static:quote 1) @105 |
| `test/EvidenceVerificationTables.test.ts` | `SourceTextDigest` 1 (construct 1) @35; `SourceTextExtractor` 1 (construct 1) @43; `SourceTextIdentity` 2 (construct 2) @42,56; `TextAnchor` 4 (construct 3, field-or-param 1) @37,62,75,182; `TextAnchorVerificationReceipt` 7 (construct 5, encode 2, type-arg 2) @33,36,54,61,73,98,… |

### packages/epistemic/ui

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `stories/ClaimEvidenceReview.stories.tsx` | `SourceTextDigest` 3 (construct 2, field-or-param 1) @27,50,54; `SourceTextExtractor` 2 (construct 2) @44,142; `SourceTextIdentity` 2 (construct 2) @38,140 |
| `test/ClaimEvidenceReviewPanel.test.tsx` | `SourceTextDigest` 2 (construct 2) @29,30; `SourceTextExtractor` 1 (construct 1) @31; `SourceTextIdentity` 2 (construct 2) @25,144 |

### packages/epistemic/use-cases

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/ClaimEvidenceReview/ClaimEvidenceReview.commands.ts` | `SourceTextIdentity` 1 (field-or-param 1) @18 |
| `src/ClaimEvidenceReview/ClaimEvidenceReview.service.ts` | `TextAnchor` 2 (construct 2) @58,107; `VerifyTextAnchorInput` 2 (construct 2) @57,106; `verifyTextAnchor` 2 (call 2) @56,105 |
| `src/ContradictionTriage/ContradictionTriage.commands.ts` | `SourceTextIdentity` 1 (static:fields 1) @372 |
| `src/ContradictionTriage/ContradictionTriage.ports.ts` | `SourceTextIdentity` 1 (other 1) @90 |
| `src/ContradictionTriage/ContradictionTriage.rpc.ts` | `SourceTextIdentity` 3 (field-or-param 2, static:annotateKey 1, equivalence 1, type-arg 1) @291,362,620; `TextAnchorVerificationReceipt` 1 (field-or-param 1, static:pipe 1) @200 |
| `test/ClaimEvidenceReview.test.ts` | `SourceTextDigest` 2 (construct 2) @42,43; `SourceTextExtractor` 2 (construct 2) @44,106; `SourceTextIdentity` 3 (construct 3) @38,104,132 |
| `test/ContradictionTriage.rpc.test.ts` | `SourceTextIdentity` 2 (construct 1, equivalence 1, type-arg 1) @188,240 |

### packages/foundation/capability/file-processing

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/SourceText/SourceText.schema.ts` | `SourceTextIdentity` 4 (field-or-param 4) @100,124,138,227 |
| `test/SourceText.test.ts` | `SourceTextDigest` 1 (construct 1) @25; `SourceTextExtractor` 1 (construct 1) @27; `SourceTextIdentity` 2 (construct 1, encode 1, type-arg 1) @26,189 |

### packages/foundation/capability/langextract

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/VerifiedSpan/VerifiedSpan.behavior.ts` | `SourceTextIdentity` 6 (field-or-param 5, equivalence 1, type-arg 1) @60,559,625,626,629,635; `isUtf16Boundary` 2 (call 2) @145,325; `TextAnchor` 19 (type-arg 18, static:makeOption 1) @143,147,149,159,185,199,…; `toTextAnchorVerificationReceipt` 1 (call 1) @599; `VerifySourceTextIdentityInput` 1 (construct 1) @662; `VerifyTextAnchorAgainstVerifiedSourceInput` 1 (construct 1) @587; `verifySourceTextIdentity` 1 (call 1) @661; `verifyTextAnchorAgainstVerifiedSource` 1 (call 1) @586; `VerifiedSourceText` 2 (field-or-param 2) @580,613 |
| `src/VerifiedSpan/VerifiedSpan.model.ts` | `SourceTextIdentity` 9 (type 4, field-or-param 4, equivalence 1, type-arg 1) @598,611,617,625,631,903,…; `TextAnchorVerificationReceipt` 1 (field-or-param 1) @470; `VerifiedTextAnchorErrorReason` 1 (type-arg 1) @362 |
| `test/VerifiedSpanHistory.test.ts` | `SourceTextDigest` 1 (construct 1) @48; `SourceTextExtractor` 1 (construct 1) @58; `SourceTextIdentity` 4 (field-or-param 3, construct 1) @57,80,81,99 |

### packages/foundation/modeling/epistemics

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/ClaimEvidenceReview/ClaimEvidenceReview.model.ts` | `SourceTextIdentity` 2 (field-or-param 2) @55,188; `VerifiedTextAnchorErrorReason` 2 (field-or-param 2) @163,219 |
| `src/EvidenceSpan/EvidenceSpan.model.ts` | `isInternallyConsistent` 1 (call 1) @161; `TextAnchor` 6 (field-or-param 3, equivalence 1, type-arg 1, other 1, construct 1) @29,150,172,173,174,176; `TextAnchorFields` 1 (static:quote 1) @90; `TextAnchorWidthCheck` 1 (check 1, type-arg 1) @119 |
| `src/EvidenceVerification/EvidenceVerification.model.ts` | `TextAnchorVerificationReceipt` 1 (field-or-param 1, static:annotateKey 1) @66 |
| `test/EvidenceSpan.test.ts` | `TextAnchor` 3 (construct 3) @36,38,39 |
| `test/Factories.test.ts` | `SourceTextDigest` 1 (construct 1) @75; `SourceTextExtractor` 1 (construct 1) @82; `SourceTextIdentity` 1 (construct 1) @76; `TextAnchor` 1 (construct 1) @153; `TextAnchorVerificationReceipt` 1 (construct 1) @152 |

### packages/foundation/modeling/provenance

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/SourceTextIdentity.ts` | `SourceTextDigest` 18 (other 9, field-or-param 6, static:annotateKey 6, type 3) @30,31,32,54,136,139,…; `SourceTextExtractor` 8 (type-arg 4, other 2, decode 2, field-or-param 2) @71,80,85,142,71,80,…; `SourceTextIdentity` 3 (other 2, type-arg 1) @11,125,147 |
| `src/TextAnchor.ts` | `TextAnchorFields` 4 (other 2, type-arg 2) @51,64,51,64; `TextAnchorWidthCheck` 6 (other 4, check 2, type-arg 2) @92,94,133,92,94,133; `isUtf16Boundary` 1 (other 1) @123; `TextAnchor` 30 (type-arg 9, other 6, type 6, construct 3, decode 3, static:isWellOrdered 3, static:isInternallyConsistent 3) @25,156,158,160,167,189,…; `isWellOrdered` 2 (other 2) @189,230; `isInternallyConsistent` 2 (other 2) @207,246 |
| `src/VerifiedTextAnchor.ts` | `VerifiedTextAnchorErrorReason` 10 (other 4, field-or-param 4, type 2) @87,93,113,136,150,87,…; `VerifiedTextAnchorError` 22 (static:fromReason 13, type-arg 5, other 3, construct 1) @130,131,133,138,150,151,…; `VerifySourceTextIdentityInput` 10 (other 6, field-or-param 2, construct 2) @172,173,181,588,725,172,…; `VerifiedSourceText` 10 (other 4, type-arg 4, field-or-param 2) @246,263,264,289,589,246,…; `VerifyTextAnchorAgainstVerifiedSourceInput` 5 (other 3, field-or-param 1, construct 1) @283,284,291,641,732; `VerifyTextAnchorInput` 9 (type-arg 3, other 3, field-or-param 3) @318,325,722,318,325,722,…; `TextAnchorVerificationReceipt` 10 (other 8, construct 2) @354,355,362,523,529,354,…; `VerifiedTextAnchor` 20 (other 6, type-arg 6, field-or-param 2, static:verifySourceTextIdentity 2, static:verifyAgainstVerifiedSource 2, static:verify 2) @18,432,455,456,523,587,…; `SourceTextDigest` 9 (other 3, equivalence 3, type-arg 3, construct 3) @14,20,606,14,20,606,…; `SourceTextExtractor` 6 (type-arg 3, construct 3) @14,54,14,54,14,54; `SourceTextIdentity` 45 (field-or-param 24, other 12, static:ts 3, equivalence 3, type-arg 3, construct 3) @14,21,40,46,52,53,…; `TextAnchor` 18 (field-or-param 10, other 4, static:ts 2, construct 2) @15,45,66,67,288,320,…; `toTextAnchorVerificationReceipt` 1 (other 1) @523; `verifyTextAnchor` 2 (other 2) @721,721; `verifySourceTextIdentity` 2 (other 1, call 1) @587,724; `verifyTextAnchorAgainstVerifiedSource` 2 (other 1, call 1) @639,731 |
| `test/TaggedError.equivalence.test.ts` | `VerifiedTextAnchorError` 4 (static:fromReason 3, equivalence 1, type-arg 1) @8,9,10,11 |
| `test/TextAnchor.test.ts` | `isInternallyConsistent` 3 (call 3) @60,61,62; `isUtf16Boundary` 8 (call 8) @48,49,50,51,52,53,…; `isWellOrdered` 4 (call 3, other 1) @40,41,42,113; `TextAnchor` 11 (type-arg 6, decode 2, other 2, static:isWellOrdered 2, encode 1, guard 1, arbitrary 1, equivalence 1, static:isInternallyConsistent 1) @12,13,14,15,17,18,… |
| `test/VerifiedTextAnchor.test.ts` | `SourceTextDigest` 9 (construct 5, type-arg 3, other 1, decode 1, encode 1, guard 1) @37,38,41,42,45,404,…; `SourceTextExtractor` 2 (construct 2) @48,240; `SourceTextIdentity` 6 (type-arg 5, decode 1, encode 1, construct 1, arbitrary 1, equivalence 1) @30,33,51,52,390,395; `TextAnchor` 1 (decode 1, type-arg 1) @49; `TextAnchorVerificationReceipt` 4 (type-arg 3, decode 1, encode 1, other 1, equivalence 1) @29,32,378,381; `toTextAnchorVerificationReceipt` 2 (type-arg 1, call 1) @174,374; `VerifiedSourceText` 1 (guard 1, type-arg 1) @34; `VerifiedTextAnchor` 5 (other 3, type-arg 2, decode 1, guard 1) @31,35,63,378,384; `VerifySourceTextIdentityInput` 6 (construct 6) @70,97,111,153,279,288; `VerifyTextAnchorAgainstVerifiedSourceInput` 4 (construct 4) @114,120,156,163; `VerifyTextAnchorInput` 9 (construct 9) @193,212,229,237,257,306,…; `verifySourceTextIdentity` 6 (call 6) @69,96,110,152,278,287; `verifyTextAnchor` 9 (call 9) @192,211,228,236,256,305,…; `verifyTextAnchorAgainstVerifiedSource` 4 (call 4) @113,119,155,176 |

### packages/law-practice/domain

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/entities/Distinction/Distinction.model.ts` | `TextAnchor` 1 (field-or-param 1, static:annotateKey 1) @64 |
| `src/entities/PatentCitationEvent/PatentCitationEvent.model.ts` | `TextAnchorVerificationReceipt` 1 (field-or-param 1, static:annotateKey 1) @81 |
| `src/internal/officeActionFixture.ts` | `SourceTextDigest` 1 (construct 1) @44; `SourceTextExtractor` 1 (construct 1) @51; `SourceTextIdentity` 2 (other 1, construct 1) @36,45; `VerifySourceTextIdentityInput` 2 (other 1, construct 1) @37,54; `verifySourceTextIdentity` 1 (call 1) @55; `VerifiedSourceText` 1 (other 1) @38; `VerifiedTextAnchorError` 1 (type-arg 1) @40 |
| `src/values/Citation/Citation.document.ts` | `SourceTextIdentity` 2 (equivalence 1, type-arg 1, field-or-param 1) @27,50 |
| `src/values/Citation/Citation.mention.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @19; `TextAnchorVerificationReceipt` 3 (field-or-param 3) @58,100,171; `VerifiedTextAnchor` 4 (type-arg 4) @20,24,66,161 |
| `src/values/ClaimElement/ClaimClauseRole.behavior.ts` | `TextAnchor` 148 (field-or-param 108, type-arg 16, other 12, construct 12) @147,148,620,622,624,626,… |
| `src/values/ClaimElement/ClaimClauseRole.model.ts` | `TextAnchor` 109 (field-or-param 91, type-arg 18, schema-wrap 18) @126,127,153,188,190,191,… |
| `src/values/ClaimElement/ClaimClauseRole.projection.ts` | `TextAnchor` 38 (field-or-param 29, type-arg 5, other 4) @52,54,56,59,110,193,… |
| `src/values/ClaimElement/ClaimClauseRole.sourceQuery.ts` | `TextAnchor` 5 (field-or-param 5) @45,49,74,135,142 |
| `src/values/ClaimElement/ClaimClauseRole.structure.ts` | `TextAnchor` 168 (field-or-param 104, type-arg 42, construct 14, other 10, static:makeOption 2) @87,102,109,118,123,124,… |
| `src/values/ClaimElement/ClaimElement.behavior.ts` | `TextAnchor` 3 (construct 2, type 1) @2615,2616,2619 |
| `src/values/ClaimElement/ClaimElement.edge.model.ts` | `TextAnchor` 1 (field-or-param 1, static:annotateKey 1) @52 |
| `src/values/ClaimElement/ClaimElement.model.ts` | `TextAnchor` 6 (field-or-param 4, static:annotateKey 3, other 1, construct 1) @299,338,351,357,418,479 |
| `src/values/ClaimElement/ClaimElement.tree.model.ts` | `TextAnchor` 5 (field-or-param 3, type-arg 2, equivalence 1) @70,73,74,102,110 |
| `src/values/ClaimElement/ClaimLexicalEvidence.model.ts` | `TextAnchor` 3 (field-or-param 3) @56,112,256 |
| `src/values/DocStructure/DocStructure.behavior.ts` | `TextAnchor` 2 (type-arg 1, construct 1) @75,80 |
| `src/values/DocStructure/DocStructure.model.ts` | `SourceTextIdentity` 4 (equivalence 1, type-arg 1, type 1, field-or-param 1, other 1) @246,251,259,265; `TextAnchor` 2 (field-or-param 2) @211,212; `VerifiedTextAnchor` 3 (type-arg 2, field-or-param 1) @247,253,265 |
| `src/values/ObservationVersionRef/ObservationVersionRef.model.ts` | `SourceTextDigest` 2 (field-or-param 2, static:annotateKey 2) @64,64 |
| `src/values/PatentDocument/PatentDocument.transition.ts` | `TextAnchor` 5 (type-arg 4, static:makeOption 1) @371,382,402,403,404 |
| `test/CitationDocument.test.ts` | `TextAnchor` 3 (construct 3) @114,191,211; `toTextAnchorVerificationReceipt` 1 (call 1) @169; `VerifyTextAnchorAgainstVerifiedSourceInput` 3 (construct 3) @112,189,209; `verifyTextAnchorAgainstVerifiedSource` 3 (call 3) @111,188,208 |
| `test/ClaimElement.citation-proof.test.ts` | `TextAnchor` 15 (construct 9, field-or-param 6) @48,67,75,81,89,90,… |
| `test/ClaimElement.clause-evidence.test.ts` | `TextAnchor` 1 (construct 1) @47 |
| `test/ClaimElement.composition-enumeration.test.ts` | `TextAnchor` 1 (construct 1) @117 |
| `test/ClaimElement.coordinator-copula.test.ts` | `TextAnchor` 2 (construct 2) @97,143 |
| `test/ClaimElement.dotted-labels.test.ts` | `TextAnchor` 5 (construct 4, field-or-param 1) @68,237,238,288,295 |
| `test/ClaimElement.each-direct-modifier.test.ts` | `TextAnchor` 3 (construct 2, other 1) @123,126,517 |
| `test/ClaimElement.finite-private-routes.test.ts` | `TextAnchor` 3 (field-or-param 2, construct 1) @30,41,210 |
| `test/ClaimElement.finite-proof.test.ts` | `TextAnchor` 4 (construct 4) @59,70,85,181 |
| `test/ClaimElement.intrinsic-noun.test.ts` | `TextAnchor` 3 (construct 3) @49,104,173 |
| `test/ClaimElement.ownership-boundary.test.ts` | `TextAnchor` 3 (construct 2, field-or-param 1) @19,20,87 |
| `test/ClaimElement.preamble-ownership.test.ts` | `TextAnchor` 21 (field-or-param 11, type-arg 6, schema-wrap 6, construct 4) @43,44,45,52,56,57,… |
| `test/ClaimElement.proof-integrity.test.ts` | `TextAnchor` 5 (construct 3, field-or-param 2) @19,20,21,22,76 |
| `test/ClaimElement.qualified-end-integrity.test.ts` | `TextAnchor` 2 (static:makeOption 1, construct 1) @58,66 |
| `test/ClaimElement.raw-transition.test.ts` | `TextAnchor` 6 (construct 6) @69,146,264,265,270,361 |
| `test/ClaimElement.recurrence-admission.test.ts` | `TextAnchor` 1 (construct 1) @74 |
| `test/ClaimElement.recurrence.test.ts` | `TextAnchor` 24 (field-or-param 13, type-arg 10, schema-wrap 9, construct 2, guard 1) @44,46,48,50,62,63,… |
| `test/ClaimElement.registry-projection.test.ts` | `TextAnchor` 3 (construct 1, field-or-param 1, equivalence 1, type-arg 1) @68,94,122 |
| `test/ClaimElement.right-parenthesis-labels.test.ts` | `TextAnchor` 3 (construct 3) @83,299,390 |
| `test/ClaimElement.right-parenthesis-work-cache.test.ts` | `TextAnchor` 1 (construct 1) @278 |
| `test/ClaimElement.source-composition-projection.test.ts` | `TextAnchor` 1 (construct 1) @61 |
| `test/ClaimElement.source-part-of-speech.test.ts` | `TextAnchor` 1 (construct 1) @70 |
| `test/ClaimElement.source-projection.test.ts` | `TextAnchor` 7 (field-or-param 5, type-arg 1, schema-wrap 1, construct 1) @31,39,45,46,54,55,… |
| `test/ClaimElement.verbal-proof.test.ts` | `TextAnchor` 2 (construct 2) @66,327 |
| `test/claimElementFixtures.ts` | `TextAnchor` 2 (other 1, construct 1) @81,91 |
| `test/DocStructure.test.ts` | `TextAnchor` 1 (construct 1) @148; `VerifyTextAnchorAgainstVerifiedSourceInput` 3 (construct 3) @98,104,147; `verifyTextAnchorAgainstVerifiedSource` 3 (call 3) @97,103,146 |
| `test/helpers/ClaimElementFiniteConformance.ts` | `TextAnchor` 23 (field-or-param 19, type-arg 4, schema-wrap 4) @29,30,31,38,40,41,… |
| `test/helpers/ClaimElementFiniteSource.ts` | `TextAnchor` 1 (field-or-param 1) @19 |
| `test/helpers/ClaimElementRoleInspection.ts` | `TextAnchor` 1 (construct 1) @50 |

### packages/law-practice/server

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/internal/Citation/CallbackSession.ts` | `SourceTextIdentity` 2 (type-arg 1, field-or-param 1) @488,495 |
| `src/internal/Citation/CanonicalSource.ts` | `SourceTextDigest` 2 (type-arg 1, construct 1) @65,146; `SourceTextExtractor` 1 (construct 1) @160; `SourceTextIdentity` 3 (type-arg 2, schema-wrap 1, construct 1) @53,65,157; `VerifiedSourceText` 2 (decode 2, type-arg 2) @86,135; `VerifySourceTextIdentityInput` 1 (construct 1) @163; `verifySourceTextIdentity` 1 (call 1) @162 |
| `src/internal/Citation/Document.ts` | `SourceTextIdentity` 2 (field-or-param 1, type-arg 1) @159,167; `toTextAnchorVerificationReceipt` 3 (call 3) @354,357,361; `VerifySourceTextIdentityInput` 1 (construct 1) @403; `verifySourceTextIdentity` 1 (call 1) @402 |
| `src/internal/Citation/Mention.ts` | `SourceTextIdentity` 2 (equivalence 1, type-arg 1, field-or-param 1) @90,93; `toTextAnchorVerificationReceipt` 6 (call 6) @157,159,164,195,197,200; `VerifiedSourceText` 5 (field-or-param 4, decode 1, type-arg 1) @205,247,252,259,262; `VerifySourceTextIdentityInput` 1 (construct 1) @228; `VerifyTextAnchorAgainstVerifiedSourceInput` 1 (construct 1) @209; `verifySourceTextIdentity` 1 (call 1) @227; `verifyTextAnchorAgainstVerifiedSource` 1 (call 1) @208; `TextAnchorVerificationReceipt` 1 (field-or-param 1) @206 |
| `src/internal/Citation/MentionIdentity.ts` | `VerifiedTextAnchor` 2 (type-arg 2) @20,30 |
| `src/internal/Citation/OccurrenceProjection.ts` | `TextAnchor` 1 (construct 1) @212; `VerifiedSourceText` 6 (field-or-param 6) @102,191,221,240,273,303; `VerifyTextAnchorAgainstVerifiedSourceInput` 1 (construct 1) @210; `verifyTextAnchorAgainstVerifiedSource` 1 (call 1) @209; `VerifiedTextAnchor` 2 (field-or-param 2) @242,275 |
| `src/internal/Citation/ResolutionInput.ts` | `SourceTextIdentity` 3 (equivalence 1, type-arg 1, field-or-param 1, type 1) @33,49,60; `TextAnchor` 1 (type-arg 1, schema-wrap 1) @52; `toTextAnchorVerificationReceipt` 1 (call 1) @161; `VerifiedSourceText` 1 (type-arg 1) @31; `VerifiedTextAnchor` 2 (type-arg 2) @32,63; `VerifyTextAnchorAgainstVerifiedSourceInput` 1 (construct 1) @181; `verifyTextAnchorAgainstVerifiedSource` 1 (call 1) @180 |
| `src/internal/Citation/ResolverOperation.ts` | `VerifiedSourceText` 1 (type-arg 1) @17 |
| `src/internal/Citation/SessionDocument.ts` | `SourceTextIdentity` 1 (type-arg 1) @63 |
| `src/internal/Citation/SixFormProjection.ts` | `TextAnchor` 1 (construct 1) @198; `VerifyTextAnchorAgainstVerifiedSourceInput` 1 (construct 1) @200; `verifyTextAnchorAgainstVerifiedSource` 1 (call 1) @199; `VerifiedSourceText` 2 (field-or-param 2) @164,184; `VerifiedTextAnchor` 3 (type-arg 2, field-or-param 1) @154,205,236 |
| `src/internal/Citation/SourceAnnotation.ts` | `SourceTextIdentity` 2 (field-or-param 1, static:pipe 1) @40,45; `VerifiedSourceText` 3 (type-arg 2, other 1) @59,60,138 |
| `src/internal/Citation/SourceEvidence.ts` | `SourceTextIdentity` 2 (static:pipe 1, field-or-param 1) @23,24; `VerifySourceTextIdentityInput` 1 (construct 1) @66; `verifySourceTextIdentity` 1 (call 1) @65; `VerifiedSourceText` 1 (type-arg 1) @50 |
| `src/internal/Citation/SourceRequest.ts` | `SourceTextIdentity` 3 (field-or-param 2, static:pipe 1) @52,69,102; `VerifiedSourceText` 4 (type-arg 3, schema-wrap 1, field-or-param 1) @27,28,29,30 |
| `src/internal/Citation/SourceResolution.ts` | `VerifiedSourceText` 1 (type-arg 1) @36 |
| `src/internal/Citation/VerifiedExtraction.ts` | `SourceTextIdentity` 1 (type-arg 1, schema-wrap 1) @84; `VerifiedSourceText` 4 (field-or-param 3, type-arg 1, schema-wrap 1) @62,68,116,128 |
| `src/OfficeActionStructure/OfficeActionStructure.layer.ts` | `toTextAnchorVerificationReceipt` 2 (call 2) @37,38; `VerifiedTextAnchorError` 2 (static:fromReason 2) @143,145; `VerifySourceTextIdentityInput` 2 (field-or-param 1, equivalence 1, static:fields 1) @136,138; `verifySourceTextIdentity` 2 (call 2) @90,144 |
| `src/OfficeActionStructure/OfficeActionStructure.repo.ts` | `SourceTextIdentity` 2 (field-or-param 1, equivalence 1, type-arg 1) @119,125 |
| `test/CitationBuiltinDiff.test.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @144 |
| `test/CitationCanonicalAnnotation.test.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @65 |
| `test/CitationDocumentPersistence.test.ts` | `SourceTextDigest` 1 (construct 1) @100; `SourceTextExtractor` 1 (construct 1) @107; `SourceTextIdentity` 2 (construct 2) @101,758; `TextAnchor` 3 (construct 3) @121,137,742; `TextAnchorVerificationReceipt` 1 (construct 1) @740; `VerifySourceTextIdentityInput` 1 (construct 1) @760; `VerifyTextAnchorInput` 2 (construct 2) @117,133; `verifySourceTextIdentity` 1 (call 1) @759; `verifyTextAnchor` 2 (call 2) @116,132 |
| `test/CitationEngineCorpus.fixtures.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @23; `VerifiedSourceText` 1 (type-arg 1) @47 |
| `test/CitationEngineResolution.test.ts` | `VerifiedSourceText` 1 (type-arg 1) @33 |
| `test/CitationMention.test.ts` | `SourceTextDigest` 1 (construct 1) @44; `SourceTextExtractor` 1 (construct 1) @51; `SourceTextIdentity` 4 (construct 3, field-or-param 1) @45,56,184,185; `TextAnchor` 1 (construct 1) @66; `VerifiedTextAnchor` 2 (guard 2, type-arg 2) @115,123; `VerifyTextAnchorInput` 1 (construct 1) @62; `verifyTextAnchor` 1 (call 1) @61 |
| `test/CitationMentionIdentity.test.ts` | `SourceTextDigest` 3 (construct 3) @31,43,104; `SourceTextExtractor` 3 (construct 3) @44,105,106; `SourceTextIdentity` 4 (type-arg 2, construct 1, field-or-param 1) @35,38,52,100; `TextAnchor` 1 (construct 1) @59; `TextAnchorVerificationReceipt` 1 (type-arg 1) @26; `toTextAnchorVerificationReceipt` 1 (call 1) @137; `VerifyTextAnchorInput` 2 (construct 2) @55,154; `verifyTextAnchor` 2 (call 2) @54,153 |
| `test/CitationOccurrenceProjection.fixtures.ts` | `SourceTextDigest` 1 (construct 1) @46; `SourceTextExtractor` 1 (construct 1) @53; `SourceTextIdentity` 1 (construct 1) @47; `VerifiedSourceText` 2 (field-or-param 1, guard 1, type-arg 1) @124,186; `VerifySourceTextIdentityInput` 1 (construct 1) @57; `verifySourceTextIdentity` 1 (call 1) @56 |
| `test/CitationPairedSource.fixtures.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @45; `VerifiedSourceText` 4 (field-or-param 4) @49,50,95,96 |
| `test/CitationResolve.fixtures.ts` | `SourceTextDigest` 1 (construct 1) @55; `SourceTextExtractor` 1 (construct 1) @64; `SourceTextIdentity` 1 (construct 1) @58; `TextAnchor` 1 (construct 1) @77; `VerifySourceTextIdentityInput` 1 (construct 1) @68; `VerifyTextAnchorAgainstVerifiedSourceInput` 1 (construct 1) @75; `verifySourceTextIdentity` 1 (call 1) @67; `verifyTextAnchorAgainstVerifiedSource` 1 (call 1) @74 |
| `test/CitationSixFormProjection.test.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @169; `VerifiedTextAnchor` 1 (field-or-param 1) @65 |
| `test/CitationSourceAnnotation.test.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @99; `VerifiedSourceText` 3 (guard 3, type-arg 3) @136,186,221 |
| `test/CitationSourceDocument.test.ts` | `SourceTextIdentity` 1 (equivalence 1, type-arg 1) @58 |
| `test/CitationSourceEvidence.test.ts` | `VerifiedSourceText` 2 (type-arg 2, guard 1) @46,48 |
| `test/CitationSourceRequest.test.ts` | `VerifiedSourceText` 1 (guard 1, type-arg 1) @58 |
| `test/CitationVerifiedExtraction.fixtures.ts` | `VerifiedSourceText` 2 (field-or-param 1, guard 1, type-arg 1) @61,62 |
| `test/ClaimElement.reference.test.ts` | `TextAnchor` 1 (field-or-param 1) @38 |
| `test/ClaimInspection.projection-fixtures.test.ts` | `TextAnchor` 2 (field-or-param 2) @19,26 |
| `test/evaluation/Structural.ts` | `TextAnchor` 1 (field-or-param 1) @20 |
| `test/OfficeActionStructure.test.ts` | `SourceTextIdentity` 1 (construct 1) @231; `VerifySourceTextIdentityInput` 3 (construct 2, other 1) @46,177,232 |

### packages/law-practice/use-cases

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/CandorPolicy/CandorPolicy.service.ts` | `VerifyTextAnchorInput` 1 (construct 1) @145; `verifyTextAnchor` 1 (call 1) @144 |
| `src/CitationEngine/CitationEngine.evidence.ts` | `SourceTextIdentity` 2 (type 1, field-or-param 1) @14,15; `VerifiedSourceText` 2 (type-arg 1, field-or-param 1) @14,15 |
| `src/CitationEngine/CitationEngine.input.ts` | `SourceTextIdentity` 1 (field-or-param 1) @106 |
| `src/CitationEngine/CitationEngine.result.ts` | `SourceTextIdentity` 2 (type-arg 2, schema-wrap 1, equivalence 1) @17,20; `VerifiedSourceText` 4 (type-arg 4, field-or-param 2, schema-wrap 1) @81,82,83,118 |
| `src/CitationExtractor/CitationExtractor.models.ts` | `SourceTextIdentity` 2 (equivalence 1, type-arg 1, field-or-param 1) @19,35; `VerifiedSourceText` 2 (type-arg 1, field-or-param 1) @93,98 |
| `src/ClaimSelfCheck/ClaimInspection.lexical.ts` | `TextAnchor` 1 (construct 1) @184 |
| `src/IrToLaw/IrToLaw.service.ts` | `TextAnchor` 2 (type-arg 1, construct 1) @92,94 |
| `src/OfficeActionStructure/OfficeActionStructure.ports.ts` | `SourceTextIdentity` 3 (field-or-param 3) @192,193,214; `TextAnchorVerificationReceipt` 1 (type-arg 1) @131; `VerifiedSourceText` 2 (type-arg 2) @32,35; `VerifiedTextAnchorErrorReason` 1 (field-or-param 1) @139; `VerifySourceTextIdentityInput` 2 (field-or-param 2) @260,282; `VerifiedTextAnchorError` 4 (type-arg 4) @75,79,279,283 |
| `src/OfficeActionStructure/OfficeActionStructure.service.ts` | `TextAnchor` 3 (type-arg 3, decode 2, equivalence 1) @38,78,83; `VerifiedTextAnchorError` 4 (static:fromReason 4) @69,73,82,87; `VerifyTextAnchorAgainstVerifiedSourceInput` 2 (construct 2) @89,92; `verifyTextAnchorAgainstVerifiedSource` 2 (call 2) @88,91 |
| `test/CandorPolicy.test.ts` | `SourceTextIdentity` 3 (other 2, decode 1, type-arg 1) @46,69,74 |
| `test/CitationEngineInput.test.ts` | `SourceTextDigest` 1 (construct 1) @54; `SourceTextExtractor` 1 (construct 1) @61; `SourceTextIdentity` 1 (construct 1) @55; `VerifiedSourceText` 3 (guard 3, type-arg 3) @68,87,103 |
| `test/OfficeActionStructure.test.ts` | `SourceTextExtractor` 1 (construct 1) @222; `SourceTextIdentity` 2 (construct 2) @220,228; `VerifySourceTextIdentityInput` 4 (construct 4) @205,212,225,230; `verifySourceTextIdentity` 4 (call 4) @204,211,224,229 |

### packages/tooling/library/agent-memory-store

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/MarkdownProjector.layer.ts` | `SourceTextDigest` 4 (construct 4) @378,379,423,424; `SourceTextExtractor` 1 (construct 1) @108; `SourceTextIdentity` 2 (construct 2) @374,419; `TextAnchor` 2 (construct 2) @394,445 |
| `src/SpanAnchor.models.ts` | `SourceTextIdentity` 3 (field-or-param 3, static:annotateKey 3) @88,88,88; `TextAnchor` 3 (field-or-param 3, static:annotateKey 3) @90,90,90; `SourceTextDigest` 0 () @; `SourceTextExtractor` 0 () @ |
| `test/fixtures.ts` | `SourceTextDigest` 1 (construct 1) @26; `SourceTextExtractor` 1 (construct 1) @35; `SourceTextIdentity` 1 (construct 1) @29; `TextAnchor` 1 (construct 1) @39 |
| `test/OperationCapture.support.ts` | `SourceTextDigest` 2 (construct 2) @69,70; `SourceTextExtractor` 1 (construct 1) @42; `SourceTextIdentity` 1 (construct 1) @65; `TextAnchor` 1 (construct 1) @75 |
| `test/OperationCapture.test.ts` | `TextAnchor` 1 (construct 1) @321 |

### packages/tooling/tool/cli

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/commands/Kb/Kb.service.ts` | `isUtf16Boundary` 2 (call 2) @73,74; `TextAnchor` 1 (static:isInternallyConsistent 1) @71 |

### packages/workspace/server

| File | Symbol: uses (kinds) @ lines |
| --- | --- |
| `src/SourceText/WorkspaceSourceTextResolver.ts` | `SourceTextDigest` 5 (type-arg 3, field-or-param 2, equivalence 1, decode 1) @46,49,66,76,77; `SourceTextExtractor` 4 (field-or-param 2, equivalence 1, type-arg 1, decode 1) @47,86,87,98; `SourceTextIdentity` 1 (type-arg 1) @186 |
| `test/WorkspaceSourceTextResolver.test.ts` | `SourceTextDigest` 3 (other 2, decode 1, type-arg 1) @84,114,115; `SourceTextExtractor` 1 (construct 1) @120; `SourceTextIdentity` 7 (type-arg 3, other 2, decode 1, encode 1, construct 1, field-or-param 1, equivalence 1) @51,52,118,119,132,189,…; `VerifiedSourceText` 1 (guard 1, type-arg 1) @53; `VerifySourceTextIdentityInput` 1 (construct 1) @222; `verifySourceTextIdentity` 1 (call 1) @221 |
