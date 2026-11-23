# P2 map: citation mention identity, receipts and agent-memory node events (2026-11-20)

Read-only map for the P2 designer. The P2 text lane, stacked
on P1 PR C (`bf799f49b71`). Every path is repo-relative; every line number is from this
checkout. Effect APIs are checked against `.repos/effect` (`packages/effect/package.json`
version `4.1.4`) and against the installed `node_modules/effect` (same signatures for every API
named below). The governing texts are the decisions
`2026-11-19-p0-chapter-11-amendment-yields-to-the-stored-format-law` (it supersedes the
refusal wording in `p0-rq4` and `p0-chapter-11-scoped-amendment-ships-with-p0`),
`2026-11-19-p0-rq4-occurrence-id-confirmed-mention-id-derives-from-it`,
`standards/ARCHITECTURE.md` "Stored Formats Convert On Read" (`:631-642`),
`standards/architecture/11-evolution-and-deprecation.md` rule 5 (`:159-167`), and the
`DECISIONS.md` entries "The Canonical Anchor Is `TextAnchor` ..." (`:2831`) and "Scoped
Amendment To Chapter 11 Persisted-Bytes Rule ..." (`:3193`, confirmed on `origin/main`).

## Part 1. The citation mention id and everything that feeds it

### 1.1 Current derivation (`cm1:`)

- Id schema: `packages/law-practice/domain/src/values/Citation/Citation.identity.ts:35-41`,
  `CitationMentionId = S.TemplateLiteral(["cm1:", Sha256Hex])` branded. Siblings in the
  same file: `ca1:` authority (`:73`), `cd1:` detached (`:100`), `cl1:` member list
  (`:125`), `cg1:` resource group (`:150`). All are bare-hex digests, not `sha256:`-prefixed
  `ContentHash` values.
- Minting: `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts`.
  Input `CitationMentionIdentityInput` (`:47-56`) requires a genuine runtime
  `VerifiedTextAnchor` (`:20,29-38`), `engineArtifact: Sha256Hex` and `semanticKind`
  (`S.NonEmptyString` max 128, `:21-25`). The preimage (`:86-108`) is
  `S.fromJsonString(S.Tuple([...]))`, so plain `JSON.stringify` of an ordered tuple, not
  RFC 8785. Values (`:127-142`): `"citation-mention/v1"`, engineArtifact, semanticKind,
  scopeRef, sourceRef, locator, sourceDigest, textDigest, extractor name, extractor
  version, normalizationVersion, startChar, endChar, quote. Digest:
  `Sha256HexFromBytes(TextEncoder.encode(json))` (`:143`), result `` `cm1:${digest}` `` (`:147`).
  No offset unit is in the preimage (UTF-16 is implicit).
- `semanticKind` is always `citation.type` (`case | law | journal | ...`): call sites
  `Mention.ts:129-133` (`makeCitationMention`), `Mention.ts:167-171`
  (`projectCitationMentionReceipt`), `Document.ts:370-376` (`projectCitationDocumentReceipt`).
- Re-check on restore: `restoreCitationMentionAgainstVerifiedSource`
  (`Mention.ts:245-299`) re-verifies every anchor against the canonical source, rebuilds the
  mention through `makeCitationMention`, and fails `stale-identity` when the recomputed id
  differs from the receipt's (`:296`). So a v3 receipt whose ids are `cm1:` fails restore the
  moment the minting function moves to v2, unless the ids are converted first.

### 1.2 Identifiers downstream of the mention id

| Id | Where minted | Preimage contains a mention id? | P2 effect |
| --- | --- | --- | --- |
| `ca1:` case-occurrence (case citation whose `page` component is `null`) | `AuthorityIdentity.ts:108-121` (key union `:73-84`, member `["citation-authority/v1","case-occurrence",CitationMentionId]` at `:77`), minted `:145-180` | yes | re-minted under a bumped key tag |
| `ca1:` full case / law / journal | `AuthorityIdentity.ts:122-131,166-176` | no (components, reporter, editions) | unchanged |
| `ca1:` external resource | `ResourceIdentity.ts:103,131-159` (`["citation-authority/v1","external-resource",hex,hex]`) | no | unchanged |
| `cl1:` / `cg1:` default path | `Resolve.ts:340-362` and the check `Document.ts:309-310`: `` `cl1:${Str.slice(4)(authority.id)}` ``, same for `cg1` | indirectly: a slice of the authority digest | change exactly when their authority id changes |
| `cl1:` / `cg1:` callback-session path | `SessionDocument.ts:62-63,130-141,218-230` (`["citation-session-node/v1", SourceTextIdentity, engineArtifact, kind, slot]`) | no | unchanged (bytes of `SourceTextIdentity` do not change) |
| `cd1:` detached | `CallbackSession.ts:487-490,787-798` (`["citation-detached/v1", SourceTextIdentity, engineArtifact, slot]`) | no | unchanged |

Places that carry a mention id as a reference (all must be rewritten through one old-to-new
map): `CitationMentionReceipt.id` and `warnings[].previousMentionId`
(`Citation.mention.ts:119-125,150-157`), `CitationResolved/Ambiguous/Unresolved.mentionId`
(`Citation.resolution.ts:57,81,103`), `CitationGroupMember.Mention.mentionId`
(`Citation.membership.ts:50`, used in `memberLists[].members` and
`authorities[].representative`). Places that carry an authority id: `authorities[].id`,
`Resolved.authorityId`, `Ambiguous.candidateAuthorityIds` (`isUnique`, min 2;
`Citation.resolution.ts:58,82`), `groups[].authorityId` (`Citation.membership.ts:95`).
Out of band, not in the receipt: `CitationResourceBinding` (`ResourceIdentity.ts:64-100`)
carries `decisions: CitationMentionId[]`, `candidates[].mentionId` and group lists with
`Mention` members; restore takes it as `resourceBindings` beside the receipt
(`Document.ts:157-171`).

### 1.3 The receipt format (v3) and where it is written and read

- Document receipt: `Citation.document.ts:49-63`, `ReceiptShape =
  { schemaVersion: S.tag("citation-document-receipt/v3"), source, engineArtifact,
  authorities, resolutions, groups, memberLists, detachedCitations, mentions:
  CitationMentionReceipt[] }`, wrapped with the coherence filter (`:64-133`) as
  `CitationDocumentReceipt` (`:179-186`). Pure schema, no services.
- Mention receipt: `Citation.mention.ts:168-174,248-265`, `schemaVersion:
  "citation-mention-receipt/v1"`, the metadata fields (`:150-157`: `id, citation,
  engineArtifact, signal, warnings, evidenceConfidence`), `anchor:
  TextAnchorVerificationReceipt` (structural `{ anchor, source }`, no proof), components
  and footnote receipts (`:57-63,99-105`).
- Writers: `projectCitationDocumentReceipt` (`Document.ts:340-383`, tag literals at
  `:350,353`; it re-mints every mention id and verifies authorities before emitting);
  `projectCitationMentionReceipt` and `captureCitationMentionReceiptData`
  (`Mention.ts:150-202`, tag `:174,194`). In-repo producer of document receipts:
  `SessionDocument.ts:262-276`, surfaced in `CitationExtractedDocumentResult`
  (`SourceDocument.ts:37-54`) and `CitationSourceResolutionResult`
  (`SourceResolution.ts:42-58`).
- Readers: `restoreCitationDocument` (`Document.ts:395-421`, boundary schema
  `RestoreBoundary` `:164-171` and JSON codec `RestoreJson` over `RestoreInput`
  `:157-163`, whose `receipt` field is the ceiling-checked `Snapshot.receipt` `:115-145`);
  `restoreCitationMention` (`Mention.ts:220-235`); the resolution input snapshot
  `ResolutionInput.ts:35-56`; and the served use-case input
  `CitationEngineResolutionInput.mentions: CitationMentionReceipt[]`
  (`packages/law-practice/use-cases/src/CitationEngine/CitationEngine.input.ts:207-221`), a
  wire input that carries standalone mention receipts (v1).
- Storage: no table, column or migration holds a receipt or a `cm1:` value
  (design facts section 1; census `consumer-census.md:481`). Receipts are returned to callers
  and are "held outside the database"; the repo has no file or KV writer for them. The
  stored-format law still governs them by the amendment-yields decision. There is no
  read-time-transform precedent in `packages/` or `apps/` to copy
  (`rg -il "read-time transform|convert on read|stored-format" packages apps -g '*.ts'` is
  empty).

### 1.4 Tests and fixtures that carry receipt bytes or ids

| File | What it pins | P2 action |
| --- | --- | --- |
| `packages/law-practice/server/test/CitationMentionIdentity.test.ts:71,241` | golden `cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9` | keep as the v1 vector; add the v2 vector beside it (decision p0-rq4: "golden vectors that pin v1 and v2 side by side") |
| `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json` | 13 `mentionId` inputs (`cm1:`) and 13 `expectedId` (`ca1:`); the two `missing-page` cases (`:203-296`, `page: null`) derive their `ca1:` from the `cm1:` input | regenerate inputs and the two case-occurrence `expectedId`s; it is an oracle capture (`oracleCommit`, `producerSha256`) read by four server tests (`CitationAuthorityIdentity.test.ts:17-27` pins `schemaVersion` and `oracleCommit` literals; `CitationDocumentPersistence.test.ts:55`; `CitationResolverText.test.ts:14`; `CitationResourceIdentity.test.ts:16`) |
| `packages/law-practice/domain/test/CitationDocument.test.ts:162-176,239` | a receipt built with `make` at v3/v1; asserts `v2` is refused | bump to v4/v2; keep the v2 refusal; add that v3 is not refused only where the transforming codec is in scope (server) |
| `packages/law-practice/domain/test/CitationIdentity.test.ts:12-63` | `cm1:`/`ca1:` template acceptance | follows the prefix ruling (1.6) |
| `packages/law-practice/server/test/CitationDocumentPersistence.test.ts:90-92` and 60 more receipt uses | stale-id sentinels `ca1:fff...`, `cm1:fff...`; JSON round trips through `S.fromJsonString(CitationDocumentReceipt)` | prefix/sentinel update; round trips stay on the current version |
| `CitationMention.test.ts:209,236`, `CitationResolve.test.ts:244`, `CitationModelMutation.test.ts:422`, `CitationCallbackSession.test.ts:74,431`, `CitationResourceObjects.test.ts:265,340` | `cm1:` template literals | prefix update |
| `CitationCallbackMutations.test.ts:525-530`, `CitationCallbackRuntimeIndex.test.ts:424` | JSON round trips of projected receipts | none beyond the tag bump |
| `goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-adapter/native.observed.json` (29 `cm1:`) | frozen history evidence | do not edit (history); record the change in that packet's history per decision p0-rq4 |

No committed frozen receipt exists today: every receipt in the tests is built with `make` or
projected at run time. The frozen v3 fixture is new work.

### 1.5 What "citation-mention/v2 over OccurrenceId" requires

1. `OccurrenceId` from `@beep/text` minted over a structural receipt. The design module
   already does this: `goals/text-knowledge-stack-rebuild/ops/design/L1.text.ts:206-259`
   (`OccurrenceDomainTag = "occurrence/v1"`, preimage tuple `:213-227` = scopeRef, sourceRef,
   locator, sourceDigest, textDigest, extractor name, extractor version,
   normalizationVersion, unit, start, end, quote; `mintOccurrenceId(anchored: Anchored)`
   over `TextAnchorVerificationReceipt`, unit fixed to `utf16-code-unit` at `:245`). It hashes
   through `mintContentHash` (`packages/foundation/modeling/jsonc/src/Mint.ts:71-77`, RFC 8785
   over `[domainTag, ...preimage]`, result `sha256:<hex>`), so it needs `Digest` and can fail
   with `JsoncCanonicalizeError`.
2. The mention digest: `CitationMentionDomainTag = "citation-mention/v2"`, preimage
   `[engineArtifact, semanticKind, OccurrenceId]` (`L1.text.ts:278-322`). P1 shipped
   `definePreimage` / `Preimage` / `PreimageRegistry` with committed golden vectors
   (`Mint.ts:286-620`); `occurrence/v1` and `citation-mention/v2` should be declared with it,
   so the golden check refuses a preimage change without a tag bump.
3. Production keeps the proof gate: `makeCitationMentionId` still decodes a genuine
   `VerifiedTextAnchor` (`MentionIdentity.ts:29-56,124`), projects it to the receipt, mints the
   `OccurrenceId`, then the v2 digest. The v1 function stays as a pinned historical encoder
   (a `cm1` value cannot be expressed as a `Preimage`, because v1 is not RFC 8785), used by the
   golden test and by the v3 transform's integrity check (1.6, step 2).
4. Display prefix: `CitationMentionId` becomes a v2 template (proposed `cm2:`), and a frozen
   `CitationMentionIdV1` (`cm1:`) lives only inside the frozen v3 schemas (open question 1).
5. The case-occurrence authority key gets a bumped tag (proposed
   `["citation-authority/v2","case-occurrence", <v2 mention id>]`); the other `Key` members keep
   `citation-authority/v1` because their preimage did not change (open question 2).
6. Dependencies: `@beep/law-practice-server` and `@beep/law-practice-domain` depend on
   `@beep/provenance` today and on neither `@beep/text` nor `@beep/jsonc`. The server needs
   `@beep/text` (OccurrenceId) and `@beep/jsonc` (`mintContentHash` / `definePreimage`) for the
   v2 mint, unless `@beep/text` re-exports a mint entry point.

### 1.6 What "a declared v3 to v4 transform converting receipts on read" requires

Shape, with the APIs checked in `effect@4.1.4`:

- Freeze the read side of v3 as its own pure schemas: `CitationDocumentReceiptV3` (tag
  `citation-document-receipt/v3`) over a frozen `CitationMentionReceiptV1` (tag
  `citation-mention-receipt/v1`), with frozen `cm1:` / `ca1:` / `cl1:` / `cg1:` id schemas and
  the same coherence filter. They must not import the live v4 id schemas, or the next id change
  silently changes what v3 accepts.
- Bump the live schemas: `citation-document-receipt/v4`, and (recommended, open question 3)
  `citation-mention-receipt/v2` for the nested mention receipt, since its `id` changes meaning.
- The transform is effectful (it hashes), so it is
  `CitationDocumentReceiptV3.pipe(S.decodeTo(CitationDocumentReceipt, { decode:
  SchemaGetter.transformEffect(f), encode: SchemaGetter.forbidden(...) }))`
  (`Schema.ts:5731-5737` takes `decode`/`encode` getters with service parameters `RD`/`RE`;
  `SchemaGetter.transformEffect` `SchemaGetter.ts:763-767` returns `Getter<T, E, R>` from
  `(e, options) => Effect<T, SchemaIssue.Issue, R>`; `SchemaGetter.forbidden` `:437`). The
  read codec is `S.Union([CitationDocumentReceipt, migratedV3])` (`Schema.ts:5032`); the
  union's encode picks v4, so writes never produce v3. Failures map to
  `new SchemaIssue.InvalidValue(annotations, input)` (`SchemaIssue.ts:768-771`). The codec's
  `DecodingServices` becomes `Digest.Digest`, so it lives in the server next to the minting
  functions, not in the pure domain schema (the domain keeps `S.is`/`make` over the v4 type).
- `f` recomputes, from the receipt's own fields only:
  1. per mention: `OccurrenceId` from `mention.anchor` (`{ source, anchor }`), then the v2 id
     from `(mention.engineArtifact, mention.citation.type, OccurrenceId)`;
  2. (recommended) before step 1, recompute the v1 id with the pinned v1 encoder and refuse a
     v3 mention whose stored `cm1:` does not match, so the transform never launders a stale or
     tampered id into a fresh one;
  3. per authority: identify case-occurrence authorities by recomputation, not by inference:
     compute the v1 case-occurrence key for every mention's `cm1:`; an `authorities[].id`
     equal to one of them maps to the v2 case-occurrence key over that mention's new id; every
     other authority id is kept;
  4. per group and list: an id equal to `cg1:`/`cl1:` plus the slice of a remapped authority's
     old digest is the default path and is recomputed from the new authority id; session-node
     ids (`citation-session-node/v1`) are kept;
  5. rewrite every mention and authority reference through the two maps (1.2), set the tags,
     and decode through the v4 schema so the coherence filter runs on the result.
- The transform grants no proof: `restoreCitationDocument` still re-verifies source and
  anchors and re-mints every id (`Document.ts:395-421`, `Mention.ts:257-299`). The read sites
  that must take the union codec: `Document.ts` `Snapshot.receipt` / `RestoreInput` /
  `RestoreBoundary` (`:115-171`). The `captureCitationRestoration` engine check
  (`Snapshot.ts:84-92`) reads `receipt.engineArtifact`, which the transform keeps.
- Out-of-band bindings: a v3 receipt restored with custom `resourceBindings` fails
  `stale-authority` (`Document.ts:200-260`) because the bindings carry `cm1:` ids. Either the
  transform also exposes its id maps and restore rewrites the bindings, or bindings are
  re-derived by the adapter (open question 4).
- Standalone v1 mention receipts reach the engine through `CitationEngineResolutionInput`
  (wire, no stored rows). The amendment permits refusing them; reusing the mention-level part
  of the transform is cheap (open question 5).
- Shard plan: a new server test must be listed in `packages/law-practice/server/vitest.shards.json`;
  `packages/law-practice/server/test/vitest-shards-plan.test.ts:120` asserts the plan "names
  every unit test file exactly once and nothing else".

### 1.7 Fixtures that must exist (Part 1)

- `packages/law-practice/server/test/fixtures/citation-document-receipt-v3.json` (name
  proposed): a frozen v3 document receipt captured **before** the minting change, by running
  today's `projectCitationDocumentReceipt` and encoding with `S.fromJsonString`. It should
  cover a case-occurrence authority (null page, so the `ca`/`cl`/`cg` cascade runs), a full
  case authority (ids unchanged), an `Ambiguous` resolution, an `Unresolved` resolution, an
  overlap warning (`previousMentionId`), a component and a footnote receipt, and a detached
  citation (`cd1:` unchanged). Store its source text and expected source and engine identity
  beside it so the test can restore it.
- `packages/law-practice/server/test/CitationMentionMigration.test.ts` (SPEC P2 exit): decodes
  the frozen v3 bytes through the union codec, asserts the exact v4 ids (golden), asserts the
  integrity refusal on a v3 receipt with a stale `cm1:`, then restores the converted receipt
  against its source text and gets the same runtime document as a fresh v4 projection.
- `CitationMentionIdentity.test.ts`: v1 and v2 golden vectors side by side; the
  `definePreimage` golden for `citation-mention/v2`.

## Part 2. agent-memory-store node events

### 2.1 Stored anchor shape

- `packages/tooling/library/agent-memory-store/src/SpanAnchor.models.ts`:
  `TextUnit = LiteralKit(["utf16"])` (`:35-39`); `OccurrenceAnchor` (`:86-96`) is an
  `S.Opaque` of `{ source: SourceTextIdentity, unit: TextUnit, anchor: TextAnchor }`, imported
  from the `@beep/provenance` root (`:10`). `toMarkdownRange` (`:138-142`).
- `NodeCreated.anchor: S.OptionFromOptionalKey(OccurrenceAnchor)`
  (`src/NodeEvent.events.ts:71-95`, field `:78-80`); absent for agent-written nodes. Event
  definition `NodeCreatedEvent` (`:370-375`), group `MemoryEvents` (`:555-563`),
  `MemoryLogSchema` (`:593`). No other event carries an anchor.
- In-memory (not stored) use: `BaseNode.anchor` (`src/Operation.models.ts:33-40`) in the
  export base, built at `src/MarkdownProjector.layer.ts:391-395`; read by
  `internal/OperationCapture.align.ts:55`, `OperationCapture.diff.ts:71`,
  `OperationCapture.status.ts:31`.

### 2.2 Where events are written and read

- Write: `MarkdownProjector.layer.ts:408-458` (`importEvents`) builds `NodeCreated` with
  `OccurrenceAnchor.makeOption` (`:442-450`) over a `SourceTextIdentity` of `scopeRef
  "agent-memory-store"`, `sourceRef "import"`, `locator` the file path, both digests
  `sha256:<file digest>`, extractor `@beep/agent-memory-store/MarkdownPartition` v1
  (`:108-111`), `normalizationVersion "1"` (`:418-427`); offsets come from the partition range.
  `MemoryLog.layer.ts` writes through `effect/eventlog` over `SqlEventJournal`
  (`:411-421`), tables `agent_memory_journal` / `agent_memory_remotes` (`:99-102`), on SQLite
  (`@beep/sqlite`, `bun:sqlite`). The stored form is the `payload BLOB` column
  (`.repos/effect/packages/effect/src/eventlog/SqlEventJournal.ts:104-108`) holding
  `SchemaBinary.toCodec(payload)` bytes (`eventlog/Event.ts:68,450`; `EventLog.ts:817`).
  Correction to the census wording "stored outside the database": the events are rows of the
  package's own SQLite journal, not of the db-admin Postgres schema.
- Read: `internal/MarkdownProjection.ts:84-89` (`nodeEventDecoders`, decoding
  `NodeCreatedEvent.payloadSchemaBinary`), folded at `:137-160` (the anchor is decoded and
  dropped today; `ProjectedNode` holds no anchor); `internal/AdmissionLog.ts:93-100` (same
  decoder, anchor dropped). Both read through `MemoryLog.entriesAfter`
  (`MemoryLog.service.ts:117`, `MemoryLog.layer.ts:366-380`).
- Consumers: none outside the package (`rg "@beep/agent-memory-store" packages apps` finds only
  the identity registry).

### 2.3 Deriving OccurrenceId at read time with the bytes kept

- Byte facts. `SchemaBinary` default mode is "compatible schema evolution" and keys struct
  fields by an id derived from the field name unless `SchemaBinary.fieldId` pins it
  (`encoding/SchemaBinary.ts:44-63,104-112,930-957`); bytes "carry the layout of the schema
  that wrote them". So the encoded side of `OccurrenceAnchor` must keep its three keys
  (`source`, `unit`, `anchor`), the `SourceTextIdentity` and `TextAnchor` encoded fields, and
  the literal `"utf16"`. Moving the classes from `@beep/provenance` to `@beep/text` changes
  annotations, not the encoded layout.
- Derivation. A function, not a schema transform: `occurrenceIdOf(anchor: OccurrenceAnchor):
  Effect<OccurrenceId, JsoncCanonicalizeError, Digest>` that builds
  `Anchored{ receipt: TextAnchorVerificationReceipt{ anchor: anchor.anchor, source:
  anchor.source } }` and calls `mintOccurrenceId`, with the unit mapped `utf16 ->
  utf16-code-unit` (the design mint already hard-codes `utf16-code-unit`,
  `L1.text.ts:245`). Keeping it out of the payload schema keeps
  `NodeCreatedEvent.payloadSchemaBinary` free of `DecodingServices`; `effect/eventlog`
  threads payload decoding services into the server side
  (`eventlog/Event.ts:283-310`), so an effectful payload schema would leak `Digest` into the
  journal runtime.
- Optional pure unit mapping, if P2 wants `OffsetUnit` in memory: the field can be
  `S.Literal("utf16").pipe(S.decodeTo(S.Literal("utf16-code-unit"),
  SchemaTransformation.transform({ decode: () => "utf16-code-unit", encode: () => "utf16" })))`
  (`Schema.ts:2744,5731`; `SchemaTransformation.ts:440`): sync, service-free, and it encodes
  back to the same literal, so bytes are unchanged. Not required by the decision.
- Failure surface: `mintContentHash` canonicalizes with RFC 8785, which rejects lone
  surrogates. Node text is already `isWellFormedText` (`NodeEvent.events.ts:77`), but the
  `SourceTextIdentity` fields are not checked today, and P2 adds well-formedness checks to
  them (SPEC Decision log, `@beep/provenance` facet). A stored event whose `locator` holds a
  lone surrogate would then fail to decode. The derivation should return a typed failure, and
  the check-tightening needs a statement about legacy rows (open question 6).
- The P0 decision also says the `OccurrenceAnchor` preimage is "re-expressed on OccurrenceId
  in P2, sequenced after that goal's open lane merges". That lane is
  feat/agent-memory-store-p3 (worktree agent-memory-store-p3, head `c93b36cb77a`, last
  commit 2026-11-13). It is not on `origin/main`, has no remote branch, and has no PR. It changes
  68 files in the package, including `NodeEvent.events.ts` (adds `NodeLinked`),
  `Operation.models.ts`, `OperationCapture.diff.ts` and `internal/OperationCapture.align.ts`.
  It does not touch `OccurrenceAnchor` or `SpanAnchor.models.ts`, so the only overlap is the
  `@beep/provenance` import lines (open question 7).

### 2.4 Fixtures that must exist (Part 2)

- A frozen `NodeCreated` payload: the `SchemaBinary` bytes (hex or base64 in a committed
  fixture, for example `packages/tooling/library/agent-memory-store/test/fixtures/node-created-v0.ts`)
  of a `NodeCreated` with `anchor: Some(...)`, captured **before** P2 edits
  `SpanAnchor.models.ts` or the provenance classes, using today's
  `NodeCreatedEvent.payloadSchemaBinary` and the `anchor` from `test/fixtures.ts:28-40`. A
  second payload with `anchor` absent is cheap and proves the optional key.
- The test (SPEC P2 exit "a frozen agent-memory node event fixture reads to its OccurrenceId"):
  decode the frozen bytes with `S.decodeEffect(NodeCreatedEvent.payloadSchemaBinary)`, derive
  the `OccurrenceId`, compare with a golden `sha256:` value, and re-encode the decoded payload
  to assert byte identity with the frozen bytes. Today's nearest test only round-trips freshly
  encoded bytes (`test/NodeEvent.test.ts:130-150,206-224`), which proves nothing about old
  bytes.
- Recommended L1 tie-in: the same golden `OccurrenceId` asserted from a
  `TextAnchorVerificationReceipt` with the same fields in `@beep/text`'s `OccurrenceId` test
  (ledger `L1-4`, `packages/foundation/modeling/text/test/OccurrenceId.laws.test.ts`), so both
  routes provably mint one identity.

## Part 3. Office-action standing list (SPEC Verification Matrix)

`SPEC.md:491`, row "Office-action flow", required result Green, "run with each package's
`bun run test`, at every phase exit from P3":

| Test | Package | Exists today | Command |
| --- | --- | --- | --- |
| `packages/law-practice/use-cases/test/OfficeActionReview.flow.test.ts` | `@beep/law-practice-use-cases` | no (created in P3) | `bun run test` in `packages/law-practice/use-cases` |
| `packages/law-practice/server/test/LawPracticeServer.test.ts` | `@beep/law-practice-server` | yes | `bun run test` in `packages/law-practice/server` |
| `packages/law-practice/server/test/OfficeActionStructure.test.ts` | `@beep/law-practice-server` | yes | same |
| `packages/law-practice/use-cases/test/OfficeActionStructure.test.ts` | `@beep/law-practice-use-cases` | yes | `bun run test` in `packages/law-practice/use-cases` |
| `packages/law-practice/use-cases/test/OfficeActionFixtures.test.ts` | `@beep/law-practice-use-cases` | yes | same |

`bun run test` resolves to `beep:test`: use-cases `bunx --bun vitest run --passWithNoTests`
(`packages/law-practice/use-cases/package.json:25,32`); server `bunx --bun vitest run
--passWithNoTests --exclude=test/integration/** --exclude=test/PartyContactSource.boundary.test.ts
&& BEEP_GATE_CONTINUES=1 bunx vitest run test/PartyContactSource.boundary.test.ts`
(`packages/law-practice/server/package.json:26,35`). The PLAN P2 row asks that this list "stays
green" at P2's exit, so P2 runs the four existing files although the matrix row binds from P3
on. The P2 edits that touch it: the `@beep/provenance` import rewrite and the citation id change
in the server package.

## Open questions

1. Display prefix for the v2 mention id: `cm2:` (recommended: v3 and v4 ids stay
   distinguishable and the frozen v3 schema keeps `cm1:`), or keep `cm1:` over a v2 digest. Also
   whether the digest stays bare hex (today's `Sha256Hex`) or becomes the `sha256:`-prefixed
   `ContentHash` that `mintContentHash` returns.
2. Case-occurrence authority: bump only that `Key` member's tag (`citation-authority/v2`) and
   keep the `ca1:` prefix for every authority, or bump the prefix. P0 says `cl` and `cg` are
   "re-minted with a bumped domain tag", but they have no tag: they are prefix plus a slice of
   the authority digest. Does that mean a `cl2:`/`cg2:` prefix for remapped ones, or is the
   changed digest enough?
3. Bump the nested mention receipt to `citation-mention-receipt/v2` together with document v4?
   The decision names only the document step.
4. Out-of-band `CitationResourceBinding`s carry `cm1:` ids. Should the transform expose its id
   maps so restore rewrites bindings, or do the adapters re-derive bindings?
5. Standalone v1 mention receipts on `CitationEngineResolutionInput` (served wire, no stored
   rows): refuse them under the amendment, or convert them with the mention-level transform?
6. P2 makes `SourceTextIdentity` strings well-formed. Does that check apply when decoding
   stored node events and v3 receipts (a legacy lone surrogate becomes unreadable), or only on
   construction and write?
7. The agent-memory-store P3 lane is unpushed and has no PR, so "sequenced after that goal's
   open lane merges" may never happen. Wait, rebase the lane onto P2, or take the
   `OccurrenceAnchor` work first, given that the lane does not touch the anchor?
8. Should the v3 transform refuse a stale `cm1:` (recommended, step 2 in 1.6) or trust it,
   since restore re-verifies anyway? Refusal needs the v1 encoder kept as a pinned historical
   encoder.
9. `authority-identity-cases.json` is an oracle capture with `producerSha256`. Are its
   `mentionId` inputs regenerated in place, or does a v2 sibling fixture sit beside the frozen
   v1 one?
