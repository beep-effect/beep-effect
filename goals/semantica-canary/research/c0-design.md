# C0 design — schemas, contracts, Layers (P2, first vertical slice first)

Status: design for review, 2026-08-25. Written before any C0 service code, per the packet's
design order (schema → `Context.Service` contract → Layer). Anchors were verified against the live
tree by a read-only research pass whose full citation report is kept in the private docs
mirror (not committed); every claim below names the live symbol it composes. The exploration's Current law table
and M1-M6 win where this document and they disagree.

## 1. Decisions this design makes (D-C0-n)

| Id | Decision | Why |
| --- | --- | --- |
| D-C0-1 | Extractor provider family = **Anthropic** (`@beep/anthropic` `AnthropicLanguageModelLive`, model from `AI_ANTHROPIC_MODEL`); gold proposer family = **xAI** (`@beep/xai` `XAiLanguageModel.layer`). | S2 needs two live hosted families with `op://`-backed keys already in the driver Layers; `@beep/openai` is not merged (C1 edge only). |
| D-C0-2 | `CanonicalText` is `ResolvedSourceText` from `@beep/file-processing`, constructed by the lab's `Canonicalizer` (identity pinned by the lab), not by `WorkspaceSourceTextResolver` (which drags `WorkspaceVaultStore`). | M1 compose-not-build; the workspace resolver's R channel is a product concern. |
| D-C0-3 | Parsers: PDF = `@beep/doc-text` engine (`extract-text`, `mergePages: true`); Markdown = identity (the UTF-8 decoded bytes are the canonical text); HTML = lab-local deterministic text extractor (script/style dropped, entities decoded, block boundaries → `\n`), version-pinned in `SourceTextExtractor`. | Repo has no HTML parser brick (`@beep/html` is schema-only); `@beep/md` renders AST→MD, not text. Tier-D bytes stay small. |
| D-C0-4 | Breaker retry for PDF = the same `unpdf` document proxy with per-page `getTextContent({ disableNormalization: true })`, lab-local, behind the same `Parser` contract as a second Layer. | `unpdf.extractText` does not pass that flag (M1 retry path). |
| D-C0-5 | `Chunker` is NET-NEW: paragraph/sentence splitter over the exact canonical text producing global UTF-16 half-open offsets; every `Chunk` carries a `TextAnchor` and its verification receipt. | No live chunker preserves `TextAnchor` (Wink rejoins sentences with a literal space; `nlp-ir` `Span` is not an anchor). |
| D-C0-6 | Hosted lane reads relations from `LangExtractResult.extractions` **before** the handoff; the handoff's `relations: []` defect is bypassed, not fixed here (cleanup-on-touch stays with `@beep/langextract`). Relation convention: the LangExtract targets include a `relation` extraction class whose `attributes` carry `predicate`, `subject`, and `object` (entity surface strings) and whose grounded span is the relation's evidence; subject/object resolve deterministically to the entity claim of the same document whose anchor quote equals the attribute string exactly, else the nearest preceding entity claim with an equal NFC-folded quote; an unresolved endpoint yields `DegradedClaim{ kind: "relation-unresolved" }`, never a claim. | Relation count 0 on the G-relation papers is a failure, not a score (S7); `GroundedExtraction` carries no typed subject/object, so the convention must be the lab's. |
| D-C0-7 | Pattern lane = Wink `NLPService` entity extraction, every returned `{start,end}` re-derived as a `TextAnchor` and verified; a slice that does not verify becomes a typed `FabricatedSpan` degraded claim, never a claim. | Wink substitutes `0` on `indexOf` miss. |
| D-C0-8 | Nothing wall-clock enters any content-addressed id or the report: `ProvenanceEvent` ids hash the event body without timestamps; `recordedAt` is a sibling column; run `mode` (live/replay) and all timings live only in `EvalRunTelemetry`. | G7/R1: the replay digest must equal the live digest. |
| D-C0-9 | Gold ids are frozen from the manifest alone: G-structure = the first 10 W1 ids in manifest order, G-entity = the first 5 of those, G-relation = the first 3 of those; the first-slice paper = the first G-relation id. A gold paper that fails to parse fails the applicable gate (and R2). `gold/v1` is proposed by a `canary gold propose` command (P1 step 8, its own PR before the slice PR) that reads the paper text through the live `@beep/doc-text` brick and the xAI proposer; the spot-check may only annotate, never reorder. | No parser candidate can move the scored subset, so candidates stay comparable and P1 stays executable as written. |
| D-C0-10 | Ledger = PGlite file database under `<ledgerRoot>/<runId>/<mode>/` — the logical `RunId` stays content-addressed and mode-free, the execution's directory carries `live` or `replay`, and every execution starts from an empty ledger; DDL owned by the lab (labs law); one transaction per append; appends are idempotent because every row is content-addressed (`insert … on conflict (id) do nothing` when the stored digest matches, `LedgerFailed{ reason: "conflicting-row" }` when it does not). | First-probe storage bundle (B1/A1); replay must prove the report from cached responses alone, never from a populated live ledger. |
| D-C0-11 | The provider cache sits at the `LanguageModel` boundary: live composes `CachingLanguageModelLive(AnthropicLanguageModelLive)` (write-once on miss), `--offline` composes `ReplayLanguageModelLive` backed only by `ProviderCache` (a miss is `ProviderUnavailable{ offline: true }`) and never constructs `AnthropicLive`, so no key is read. `LangExtractService.layer` is provided the same way in both modes. | CI has no keys; one interposition point serves the hosted lane and the gold proposer alike. |
| D-C0-12 | Extraction outcomes are values, like parse outcomes: `Extractor.extract` returns `ExtractOutcome = Extracted{ batch } \| Degraded{ document, lane, kind, detail }`; the orchestrator never converts an error into silence. | R2 counts degraded documents; a failure channel would drop them from the report. |

## 2. Schemas (lab-local, `src/schema/*.ts`; all `S.Class`, branded ids, `LiteralKit` domains)

Reused live: `Sha256Hex`, `NonNegativeInt`, `UnitInterval` (`@beep/schema`); `TextAnchor`,
`TextAnchorFields`, `SourceTextIdentity`, `SourceTextExtractor`, `TextAnchorVerificationReceipt`
(`@beep/provenance`); `ResolvedSourceText` (`@beep/file-processing`); `Confidence`
(`@beep/epistemic-domain`); the P1 `CorpusManifest`, `F1Index`, `canonicalJson`.

| Schema | Shape (decoded side) | Refinements / notes |
| --- | --- | --- |
| `DocumentId` | `Sha256Hex` branded `DocumentId` (sha256 of the source bytes) | full digest, never truncated (constraint 14) |
| `MediaType` | `LiteralKit(["text/markdown","text/html","application/pdf"])` | moves out of `F1.ts`; F1 and W1 share it |
| `SourceDocument` | `{ id: DocumentId, mediaType, origin: Origin, bytes: NonNegativeInt, sha256: Sha256Hex, acquired: ProvenanceEventId }` | `Origin = W1Paper{ corpusId, paperId: CorpusPaperId, relativePath } \| Fixture{ fixtureId: F1FixtureId, relativePath }` (`toTaggedUnion("kind")`); `sha256 === id` |
| `DegradedKind` | `LiteralKit(["invalid-utf8","truncated","empty-text-layer","extraction-failed","input-limit","provider-unavailable","model-output-invalid","fabricated-span","relation-unresolved"])` | the only degraded vocabulary in C0; F1's `FixtureDegradedKind` is a subset |
| `ExtractOutcome` | `Extracted{ batch: EvidenceBatch } \| Degraded{ document, lane: ExtractionLane, kind: DegradedKind, detail }` | `ExtractionLane = LiteralKit(["hosted","pattern"])`; D-C0-12 |
| `ParseOutcome` | `Parsed{ document: DocumentId, text: S.String, extractor: SourceTextExtractor } \| Degraded{ document, kind: DegradedKind, detail: NonEmptyString }` | the parser returns raw extracted text + its pinned extractor; `Canonicalizer.identify` turns `Parsed` into `CanonicalText`; F1 expectation check = `expectation === "degraded" ⇔ outcome is Degraded` and kinds equal |
| `CanonicalText` | `= ResolvedSourceText` (type alias + `S.is` guard only) | identity: `scopeRef="semantica-canary"`, `sourceRef=DocumentId`, `locator=relativePath`, `sourceDigest=bytes sha`, `textDigest=sha(text)`, `extractor={name,version}` from the Parser Layer, `normalizationVersion="raw/1"` |
| `ChunkId` | `Sha256Hex` branded; `sha256(canonicalJson({ document, textDigest, startChar, endChar }))` | document-scoped (identical text in two documents never shares a chunk id), content-addressed, replay-stable |
| `Chunk` | `{ id: ChunkId, document: DocumentId, kind: LiteralKit(["heading","paragraph","sentence"]), ordinal: NonNegativeInt, anchor: TextAnchor, receipt: TextAnchorVerificationReceipt }` | a chunk without a verified anchor is unrepresentable |
| `ProviderFamily` | `LiteralKit(["anthropic","xai","wink"])` | `openai` joins at C1 |
| `ModelIdentity` | `{ provider: ProviderFamily, name: NonEmptyString, revision: NonEmptyString, artifactHash: Sha256Hex, taskType: LiteralKit(["extraction","gold-proposal"]) }` | `artifactHash` = sha256 of the pinned prompt template + options (canonical JSON); the "prompt/config hash" of the cache key |
| `ProviderCacheKey` | `{ schemaVersion: "provider-cache/v1", model: ModelIdentity, requestKind: LiteralKit(["generate-text"]), inputDigest: Sha256Hex }` | `cacheKey = sha256(canonicalJson(encode(key)))`; `inputDigest` = sha256 of the exact request text |
| `ProviderCacheEntry` | `{ key: ProviderCacheKey, cacheKey: Sha256Hex, response: NonEmptyString, responseDigest: Sha256Hex }` | immutable, no TTL; the on-disk file name is `cacheKey` |
| `BatchId` | `Sha256Hex` branded; `sha256(canonicalJson({ document, method, model, inputs }))` | one batch per (document, lane); `inputs` are the chunk ids in order |
| `ClaimId` | `Sha256Hex` branded; `sha256(canonicalJson({ document, chunk, kind-body, method, model }))` (the full `ModelIdentity`, not only `artifactHash`) | same claim ⇒ same id live and replay; document-scoped like `ChunkId`; a model swap or breaker candidate is a distinct claim |
| `EvidenceClaim` | `{ id: ClaimId, document, chunk: ChunkId, body: ClaimBody, confidence: Confidence, method: LiteralKit(["hosted-langextract","pattern-wink"]), model: ModelIdentity, cacheKey: Option<Sha256Hex>, receipt: TextAnchorVerificationReceipt }` | `ClaimBody = Entity{ label, entityType, ...TextAnchorFields } \| Relation{ predicate, subject: ClaimId, object: ClaimId, ...TextAnchorFields } \| Structure{ role: LiteralKit(["title","abstract","section","reference"]), depth: NonNegativeInt, ...TextAnchorFields }`; spread `TextAnchorFields` + `Confidence` as epistemic `EvidenceSpan` does |
| `EvidenceBatch` | `{ id: BatchId, document, method, model, inputs: NonEmptyArray<ChunkId>, claims: ReadonlyArray<EvidenceClaim>, degraded: ReadonlyArray<DegradedClaim>, lossy: ReadonlyArray<LossDeclaration> }` | `DegradedClaim = { kind: DegradedKind, detail, chunk }`; `lossy: ReadonlyArray<LossDeclaration>` with `LossDeclaration = LiteralKit(["relations-not-supported","structure-not-supported"])` — the Wink lane declares both, the hosted lane declares none (D-C0-6); a lane's unsupported kinds are scored `unsupported`, never `0` |
| `ConflictWitness` | `{ id: Sha256Hex, left: ClaimId, right: ClaimId, basis: LiteralKit(["same-anchor-different-label","same-pair-different-predicate"]) }` | `ContradictionCandidate` precedent; claims stay separate nodes |
| `ProvenanceEventId` | `Sha256Hex` branded; `sha256(canonicalJson({ prev, body }))` | hash chain without wall-clock (D-C0-8) |
| `ProvenanceEvent` | `{ id, prev: Option<ProvenanceEventId>, body: EventBody }` where `EventBody = Ingested{ document } \| Parsed{ document, outcome: "parsed" \| DegradedKind, extractor } \| Chunked{ document, chunks: ReadonlyArray<ChunkId> } \| Extracted{ batch: BatchId, model } \| Asserted{ claims: ReadonlyArray<ClaimId> } \| Invalidated{ claim: ClaimId, reason }` | ledger row adds `recordedAt` outside the id |
| `GoldRef` | `{ version: "gold/v1", digest: Sha256Hex, proposer: ModelIdentity, spotCheckedFraction: UnitInterval, subsets: { structure: ReadonlyArray<CorpusPaperId>, entity: …, relation: … } }` | subsets follow D-C0-9 |
| `EvalRun` | `{ id: RunId, stage: CanaryStage, corpusHash: Sha256Hex, fixtureIndexDigest: Sha256Hex, gold: GoldRef, extractor: ModelIdentity, patternLane: ModelIdentity }` | **refinement (S2):** `gold.proposer.provider !== extractor.provider`; `RunId = sha256(canonicalJson(body))` |
| `DocumentOutcome` | `{ document, origin, parse: "parsed" \| DegradedKind, extraction: { hosted: "extracted" \| DegradedKind, pattern: "extracted" \| DegradedKind }, chunks: NonNegativeInt, claims: { entity, relation, structure } per lane, degradedClaims: NonNegativeInt, anchorsVerified: NonNegativeInt, anchorsFailed: NonNegativeInt, cacheKeys: ReadonlyArray<Sha256Hex> }` | per-document row of the report; extraction-stage degradation is accounted here (D-C0-12) |
| `MetricScore` | `{ name: MetricName, subset: LiteralKit(["structure","entity","relation","all"]), lane: ExtractionLane, status: LiteralKit(["scored","unsupported"]), value: UnitInterval, support: NonNegativeInt }` | `MetricName` = the upstream #574 (T3) names — **open item O-1**; `scored` requires `support >= 1`; `unsupported` is legal only for a lane that declared the matching loss |
| `EvalReport` | `{ schemaVersion: "eval-report/v1", run: EvalRun, documents: NonEmptyArray<DocumentOutcome>, metrics: NonEmptyArray<MetricScore>, unexpectedDegraded: NonNegativeInt, reportDigest: Sha256Hex }` | `reportDigest = sha256(canonicalJson(encode(report) without reportDigest))` (R1); refinements: `metrics` holds exactly one entry per (required metric, subset, lane) of `RequiredMetrics(run.stage)` and nothing else, hosted-lane entries are all `scored`; `unexpectedDegraded === count(W1 rows with parse ≠ "parsed" or hosted extraction ≠ "extracted") + count(F1 rows whose parse outcome ≠ declared)`; every `anchorsFailed === 0` |
| `EvalRunTelemetry` | `{ schemaVersion: "eval-telemetry/v1", reportDigest, runId, mode: LiteralKit(["live","replay"]), startedAt, wallClockMs, coldStartMs, p95Ms, rssBytes, diskGrowthBytes, dependencyBytes, modelBytes }` | sidecar only; never compared |

Typed errors (all `S.TaggedError` with `$I.annoteError`): `DocumentUnavailable`, `ParserFailed`
(carries `DegradedKind`), `AnchorRejected` (wraps `VerifiedTextAnchorError`), `ProviderUnavailable`
(`{ offline: boolean, cacheKey }` — the offline cache miss), `ProviderCacheCorrupt`, `LedgerFailed`
(wraps `PgliteError`), `GoldUnavailable`, `ReportInvalid`.

## 3. Contracts (`Context.Service`, `src/services/*.ts`)

```ts
DocumentSource.list(selection: DocumentSelection): Effect<ReadonlyArray<SourceDocument>, DocumentUnavailable>
DocumentSource.read(document: DocumentId): Effect<Uint8Array, DocumentUnavailable>
Parser.parse(document: SourceDocument, bytes: Uint8Array): Effect<ParseOutcome>            // never fails: degraded is a value; Parsed carries raw text + extractor
Canonicalizer.identify(document, parsed: ParseOutcome.Parsed): Effect<CanonicalText, never, Crypto.Crypto>
Canonicalizer.verify(canonical, anchor): Effect<TextAnchorVerificationReceipt, AnchorRejected, Crypto.Crypto>
Chunker.chunk(canonical: CanonicalText): Effect<NonEmptyArray<Chunk>, AnchorRejected, Crypto.Crypto>
Extractor.extract(canonical, chunks): Effect<ExtractOutcome, AnchorRejected, Crypto.Crypto>   // ProviderUnavailable / invalid model output become Degraded values (D-C0-12)
ProviderCache.lookup(key): Effect<Option<ProviderCacheEntry>, ProviderCacheCorrupt>
ProviderCache.store(entry): Effect<void, ProviderCacheCorrupt>                               // write-once; second store of the same key is a no-op if digests match, else ProviderCacheCorrupt
Ledger.appendDocument(document: SourceDocument, outcome: ParseOutcome, canonical: Option<CanonicalText>, chunks: ReadonlyArray<Chunk>, events: NonEmptyArray<ProvenanceEvent>): Effect<void, LedgerFailed>   // one transaction; every document reaches the ledger, degraded ones included
Ledger.appendBatch(outcome: ExtractOutcome, events: NonEmptyArray<ProvenanceEvent>): Effect<void, LedgerFailed>   // one transaction; idempotent on content-addressed ids (D-C0-10)
Ledger.read(run: RunId): Effect<LedgerSnapshot, LedgerFailed>
Evaluator.score(run: EvalRun, snapshot: LedgerSnapshot, outcomes): Effect<EvalReport, GoldUnavailable | ReportInvalid, Crypto.Crypto>
```

`DocumentSelection = { manifest: CorpusManifest, paper: Option<CorpusPaperId>, fixtures: F1Index }`.
Two `Extractor` Layers satisfy one contract (hosted LangExtract shape, pattern Wink) and both run
under the same gold probe (S7); the runtime composes them as `Extractor.Hosted` and
`Extractor.Pattern` tags of the same shape to keep the report's per-method columns honest.
`LanguageModel` is injected into the hosted Layer, never constructed inside it; the cache lives at
the `LanguageModel` boundary (D-C0-11): live wraps the Anthropic model with write-once caching,
`--offline` provides the replay model over `ProviderCache` alone, and a miss surfaces as
`ExtractOutcome.Degraded{ kind: "provider-unavailable" }` — counted by R2 for a W1 paper and
expected for none of F1.

## 4. First-probe Layers and composition

| Contract | Layer | Composes |
| --- | --- | --- |
| `DocumentSource` | `DocumentSourceLive` | `LabConfig.corpusRoot`, `CorpusManifestBuilder.check`, `F1Catalog.load`, `BunServices` FileSystem |
| `Parser` | `ParserLive` (per media type) | `DocTextFileProcessingEngine.extract` (PDF), identity UTF-8 decode (MD; invalid → `Degraded invalid-utf8`), lab HTML extractor; `ParserRetryLive` = direct `unpdf` `disableNormalization` (breaker retry only, D-C0-4) |
| `Canonicalizer` | `CanonicalizerLive` | `SourceTextIdentity.make`, `Sha256HexFromBytes`, `verifyTextAnchor`, `toTextAnchorVerificationReceipt` |
| `Chunker` | `ChunkerLive` | lab splitter + `Canonicalizer.verify` per chunk |
| `LanguageModel` | `CachingLanguageModelLive` (live) / `ReplayLanguageModelLive` (offline) | live: `AnthropicLanguageModelLive` + `ProviderCache` write-once; offline: `ProviderCache` only, no provider Layer constructed (D-C0-11) |
| `Extractor` (hosted) | `HostedExtractorLive` | `LangExtractService.layer` ⟵ the composed `LanguageModel`, explicit `LangExtractRemotePolicy` allow, relation convention (D-C0-6), `locateGroundedExtractions` |
| `Extractor` (pattern) | `PatternExtractorLive` | `NLPServiceLive` ⟵ `WinkBackendLive`; anchors re-derived + verified; declares `relations-not-supported` and `structure-not-supported` |
| `ProviderCache` | `ProviderCacheLive` | `LabConfig.providerCacheDirectory`, atomic write (temp file + rename), `canonicalJson`, `Sha256HexFromBytes` |
| `Ledger` | `LedgerLive` | `@beep/pglite` `makeLayer({ dataDir: <ledgerRoot>/<runId>/<mode> })` + lab DDL (`documents`, `parse_outcomes`, `chunks`, `claims`, `batches`, `events`, `conflicts`; append-only, content-addressed primary keys, `Invalidated` tombstones) |
| `Evaluator` | `EvaluatorLive` | `gold/v1` files under the lab's `fixtures/gold/v1/`, `canonicalJson`, `Sha256HexFromBytes` |
| Gold proposer (P1 step 8) | `GoldProposerLive` (a `canary gold propose` subcommand, not a stage; its own PR before the slice PR) | `XAiLanguageModel.layer` through the same caching `LanguageModel` boundary, paper text via `@beep/doc-text` — writes `fixtures/gold/v1/*.json` + `proposer` identity; the spot-check edits only `spotCheckedFraction` and per-item `verified` flags |

`RuntimeLayer` grows to `Layer.mergeAll(BunServices.layer, LabConfigLive, LoggingLive, …)` with the
eight service Layers provided over it; `server/main.ts` stays a thin `Command.run` and the process
is started through `bun run op -- …` so the provider Layers read injected keys (no `op://`
resolution in lab code).

## 5. `canary c0` flow

1. `DocumentSource.list` — W1 rows (all, or `--paper`) + all F1 fixtures; `Ingested` events.
2. For each document: `Parser.parse` → `Parsed` (→ `Canonicalizer.identify`, `Chunker.chunk`) or
   `Degraded`; either way `Ledger.appendDocument` records the document, its outcome, its canonical
   text and chunks (when parsed) and the `Ingested`/`Parsed`/`Chunked` events in one transaction.
3. For each parsed document: `Extractor.Hosted` and `Extractor.Pattern` → two `ExtractOutcome`s,
   each appended through `Ledger.appendBatch` with its `Extracted`/`Asserted` events (a degraded
   outcome appends an `Extracted{ degraded }` event and no claims).
4. `Evaluator.score` → `EvalReport` written to `<out>/eval-report.json` and `EvalRunTelemetry` to
   `<out>/eval-telemetry.json`; stdout prints `reportDigest`.
5. `--offline`: identical flow over an empty replay ledger (`<ledgerRoot>/<runId>/replay`) with
   `ReplayLanguageModelLive`; the CLI exits non-zero if `unexpectedDegraded > 0`. The slice proof
   runs live then offline and asserts digest equality.

## 6. Proof plan (lab tests; the slice, then C0)

- Schema laws: round-trips for every class; `EvalRun` rejects `proposer.provider === extractor.provider`;
  `EvalReport` rejects `anchorsFailed > 0`; `canonicalJson`/`reportDigest` stability across key order.
- `ProviderCache`: write-once, second identical store is a no-op, conflicting store is `ProviderCacheCorrupt`;
  offline miss is `ProviderUnavailable{offline:true}`.
- `Chunker`: every chunk verifies against the canonical text; NFD/CRLF/emoji/ZWJ specimen (`md-unicode`)
  keeps UTF-16 boundaries; a chunk that would split a surrogate pair is rejected.
- Parser degradation: `md-invalid-utf8` → `invalid-utf8`, `html-truncated` → `truncated`,
  `pdf-truncated` → `extraction-failed` (declared from the specimen's construction — the file is cut
  before its xref, so PDF.js cannot open it; doc-text's `extraction` reason maps to it). The
  `DegradedKind` mapping is fixed in the Parser Layer and keyed on the doc-text reason the
  normalized `FileProcessingOperationError` carries in its cause (`empty-text-layer` →
  `empty-text-layer`, `extraction` → `extraction-failed`, `input-limit` → `input-limit`); the
  engine boundary folds those reasons into `file-extraction-failed`, so if the translation drops
  the original reason the lab adds it to that translation in `@beep/doc-text` as cleanup-on-touch
  (O1) before the slice — the lab never classifies by message text (**open item O-5**). An
  observed kind that differs from the declared one is a failed assertion, never a reason to edit
  the index.
- Hosted lane in CI: only F1 is replayable there — its recorded `ProviderCache` entries are
  committed under `fixtures/provider-cache/` and the CI test runs `canary c0 --offline` over F1
  alone with `ReplayLanguageModelLive` (no keys, no W1 bytes; B3/D14 keep the papers out of the
  repo). The W1 slice and the full-manifest R2 runs, live then offline, are local proofs whose
  `EvalReport`s, telemetry sidecars and cache-entry digests are archived under the packet's
  `history/`.
- Slice gate = MAP §First Vertical Slice bullets; C0 gate = R2 over the full W1 + F1.

## 7. Open items (must close before the slice PR)

- **O-1** `MetricName`: mine upstream #574 (T3) for the metric names; until then the LiteralKit is
  `["structure-f1","entity-f1","relation-f1","span-fidelity"]` and the doc says so.
- **O-2** Pattern-lane targets: the Wink custom-entity patterns used for persons/orgs/methods (pinned
  into `ModelIdentity.artifactHash` for the `wink` family).
- **O-3** Ledger DDL v1 and the `LedgerSnapshot` read model (kept minimal: what `Evaluator` needs).
- **O-5** Confirm whether `FileProcessingOperationError` preserves the `DocTextError.reason`; if not, the
  cleanup-on-touch translation change lands in `@beep/doc-text` (its own PR, O1) before the slice.
- **O-4** Hosted request budget for the slice (one LangExtract call per chunk vs per document) — start
  per document, chunks carried as `RawTextChunk`s; measure in `EvalRunTelemetry`.
