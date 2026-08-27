# Round 1 fixer report: ontology-domain

JSDoc-only edits under `scratchpad/effect-ontology/Domain/**`. Runtime
behavior is unchanged. Re-export graph edges `ValidationPolicy` and `HttpUrl`
were left as-is. Timeline `ClaimRank` had its invented re-export JSDoc removed
(R1-022) rather than retitled.

## Changed files

- `scratchpad/effect-ontology/Domain/PathLayout.ts`
- `scratchpad/effect-ontology/Domain/Model/Agent.ts`
- `scratchpad/effect-ontology/Domain/Model/BatchWorkflow.ts`
- `scratchpad/effect-ontology/Domain/Model/CoreOntology.ts`
- `scratchpad/effect-ontology/Domain/Model/Entity.ts`
- `scratchpad/effect-ontology/Domain/Model/EntityResolution.ts`
- `scratchpad/effect-ontology/Domain/Model/ExtractionRun.ts`
- `scratchpad/effect-ontology/Domain/Model/Ontology.ts`
- `scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts`
- `scratchpad/effect-ontology/Domain/Model/OntologyEmbeddings.ts`
- `scratchpad/effect-ontology/Domain/Schema/Api.ts`
- `scratchpad/effect-ontology/Domain/Schema/Batch.ts`
- `scratchpad/effect-ontology/Domain/Schema/BatchStatusResponse.ts`
- `scratchpad/effect-ontology/Domain/Schema/CurationAction.ts`
- `scratchpad/effect-ontology/Domain/Schema/DocumentMetadata.ts`
- `scratchpad/effect-ontology/Domain/Schema/EventSchema.ts`
- `scratchpad/effect-ontology/Domain/Schema/JobSchema.ts`
- `scratchpad/effect-ontology/Domain/Schema/KnowledgeModel.ts`
- `scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts`
- `scratchpad/effect-ontology/Domain/Schema/Search.ts`
- `scratchpad/effect-ontology/Domain/Schema/Timeline.ts`

## Items closed

| ID | Action |
| --- | --- |
| ontology-domain-R1-001 | Replaced six Batch activity DTO Examples with `S.decodeUnknownOption` of realistic payloads; log `ontologyId`, graph URI count, policy defaults, `conforms`, `targetNamespace`, `documentIds.length`. |
| ontology-domain-R1-002 | Timeline ranked/read-model Examples now decode or construct rows and log `rank`, `claims.length`, `corrections.length`, `hasMore`, `affectedClaims.length`, `_tag`/`conflictType`. Deleted the vacuous `ClaimConflict` type Example. |
| ontology-domain-R1-003 | Search hit/response Examples decode `claims: []` / `label: "Alice"` / `conflictCount: 0` and log those fields. |
| ontology-domain-R1-004 | Preprocessing stats/manifest/output Examples `.decode` small fixtures and log `failedCount`, `documents.length`, `durationMs`. |
| ontology-domain-R1-005 | `OntologyEventEntry` decodes a `ClaimCorrected` journal entry and logs `event` + `primaryKey`. Deleted type-level `acceptEvent` / unused accessor Examples. |
| ontology-domain-R1-006 | `DerivedAssertion` decodes a rule-backed assertion and logs `ruleId`. Deleted `TextSpan` / `RdfObject` unused-function type Examples. |
| ontology-domain-R1-007 | `ExtractionRun` class and path/primary-key members decode a pending run and log `metadataPath`, `inputPath`, `outputPath("metadata")`, `[PrimaryKey.symbol]()`. Member Example titles now name the member. `chunkId` left as-is. |
| ontology-domain-R1-008 | Deleted 28 PathLayout type-companion identity-`accept` Examples. Kept runtime `fromParts`/`fromBatch`/`fromHash` Examples and the `StoragePathSegment` `.make` type Example. |
| ontology-domain-R1-009 | Deleted eight CurationAction type-companion dummy `summarize`+`decode({})` Examples. Kept described `@see` where present. |
| ontology-domain-R1-010 | Deleted three Ontology.ts type-companion dummy `summarize`+`decode({})` Examples. |
| ontology-domain-R1-011 | Deleted `BackgroundJob` / `JobMetadata` unused-accessor type Examples. |
| ontology-domain-R1-012 | Deleted `BatchIngestResult` / `BatchIngestResponse` unused-accessor type Examples. |
| ontology-domain-R1-013 | Deleted `SubmitJobSource` / `JobStatusResponse` `typeof` type Examples. |
| ontology-domain-R1-014 | Deleted `ERNode` / `EREdge` `typeof` type Examples. |
| ontology-domain-R1-015 | Deleted `DocumentStatus` / `BatchState` `typeof` type Examples. |
| ontology-domain-R1-016 | Deleted `MentionEvidence` / `EventInterval` `typeof` type Examples. |
| ontology-domain-R1-017 | `OntologyEmbeddingsJson` encodes a 2-d class vector and round-trips JSON, logging `dimension` and vector length. Deleted type-level `typeof` fences. |
| ontology-domain-R1-018 | Deleted `BatchStatusResponse` type Example. |
| ontology-domain-R1-019 | Deleted eight `keyof` type Examples. Getter Examples now decode a result and log `entities.length` / `isEmpty` / `isValid` / `hasTurtle` / `hasClaims`. Added a success decode Example beside the existing `S.is({})` failure on `ExtractionResult` / `ExtractWithClaimsResult`. |
| ontology-domain-R1-020 | Deleted `EvidenceSpan` `keyof` type Example. |
| ontology-domain-R1-021 | Deleted `AgentEvent` `keyof` type Example. |
| ontology-domain-R1-022 | Removed JSDoc from `export { ClaimRank }` in Timeline (copy-paste BooleanQueryValueDefinition title). Callers follow `KnowledgeModel.ClaimRank`. |

## Not documented (rejected census false positives)

- `Schema/Batch.ts` `export { ValidationPolicy }` — existing re-export JSDoc left untouched; owning docs remain on `Schema/Shacl.ts`.
- `Schema/LinkIngestion.ts` `export { HttpUrl }` — bare graph edge; owning docs remain on `@beep/ontology/Ontology.models`.
- `Schema/Timeline.ts` `export { ClaimRank }` — JSDoc deleted; not replaced with a barrel Example.

## Residual risk

- New value-level Examples depend on schema defaults (`validationPolicy`, empty collections, chunking/LLM config) and branded identity spellings (`batch-`/`doc-` + 12 hex, `gs://` URIs, `Namespace/OntologyName@` + 64-hex version). If a nested codec rejects a payload, docgen will fail on that fence rather than silently compile a function object.
- `OntologyEventEntry` `createdAt` is `S.DateTimeUtc` (already-`DateTime.Utc` input), not `DateTimeUtcFromString`. The Example uses `DateTime.makeUnsafe("…Z")`.
- `ClaimConflict` uses `S.TaggedUnion` with `_tag: "pending"` plus two encoded `ClaimWithRank` objects.
- Type-level Example deletion is the smallest legal fix; those companions no longer show narrowing in hover, which matches the kind split.

## Commands run

Verification was not executed in this fixer pass (no shell tool in the subagent). Required follow-up from the repo root:

```bash
zsh -ic 'bun run docgen:local'
zsh -ic 'bun run --cwd scratchpad check:effect-ontology'
# optional pack census
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
```

If `docgen:local` reports `full-required` because a global input moved, the bounded package-scoped loop is:

```bash
zsh -ic 'bun run --cwd scratchpad docgen:effect-ontology'
```

## Symbols left undocumented

None among the 22 accepted findings. The three rejected re-export edges were intentionally not given new owning Examples.
