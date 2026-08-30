# Round 1 inventory: ontology-domain

Read-only JSDoc review of `scratchpad/effect-ontology/Domain/` against
`.patterns/jsdoc-documentation.md`. Census: 55 modules, 576 owning exports, 51
re-exports, 0 open modules, 3 open owning (`ValidationPolicy`, `HttpUrl`,
`ClaimRank`). Those three census hits are `export { Foo }` graph edges, not
owning declarations.

Mechanical tags, module headers, `$I.annote` / `$I.annoteSchema`, same-name type
aliases, namespace Example imports, and the zero-legacy carriers (`@example`,
`@remarks`, `@module`, `@template`) are in law on owning declarations. The pack
is not rubber-stamp clean: many **required value-level Examples** never
construct or decode the symbol. They `import type`, bind an unused accessor, and
log the function or `typeof` of that function.

`fixerGroup` is `ontology-domain` on every item.

## Reviewed files

55 exporting modules. Barrels (`Domain/index.ts`, `Error/index.ts`,
`Model/index.ts`, `Rdf/index.ts`, `Schema/index.ts`) have 0 owning exports; their
`export *` Examples were not opened as new symbols.

| Area | Files | Census mechanical | Editorial |
| --- | --- | --- | --- |
| `Error/*` | 15 | none | none accepted |
| `Identity.ts` | 1 | none | none accepted |
| `PathLayout.ts` | 1 | none | type-level identity Examples |
| `Rdf/*` | 3 | none | none accepted (`EXTR` already has a real Gotcha) |
| `Model/*` | 17 | none | vacuous Examples on several files; see items |
| `Schema/*` | 18 | 3 re-export FPs | vacuous Examples on several files; see items |

Owning exports reviewed: 576.

## Rejected false positives

Census `exportKind: re-export` plus `missing-summary|missing-required-tags` on:

- `effect-ontology/Domain/Schema/Batch.ts:423` `ValidationPolicy` — `export { ValidationPolicy }` graph edge. Owning docs live on `Schema/Shacl.ts`. Attached re-export JSDoc already exists and is not a missing-tag miss.
- `effect-ontology/Domain/Schema/LinkIngestion.ts:18` `HttpUrl` — bare `export { HttpUrl }` from `@beep/ontology/Ontology.models`. Law: document the owning declaration, do not invent a barrel Example.
- `effect-ontology/Domain/Schema/Timeline.ts:33` `ClaimRank` — `export { ClaimRank }` graph edge. Owning docs live on `Schema/KnowledgeModel.ts`. Census did not see the attached JSDoc; that JSDoc is a copy-paste defect opened as ontology-domain-R1-022, not as a missing-tag fill.

Do not add `@category` / `@since` / titled Examples to these re-exports to “close” the census.

---

### ontology-domain-R1-001: Batch.ts activity DTOs never decode or construct

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/Batch.ts:168; scratchpad/effect-ontology/Domain/Schema/Batch.ts:208; scratchpad/effect-ontology/Domain/Schema/Batch.ts:241; scratchpad/effect-ontology/Domain/Schema/Batch.ts:321; scratchpad/effect-ontology/Domain/Schema/Batch.ts:352; scratchpad/effect-ontology/Domain/Schema/Batch.ts:386
- `symbol`: ExtractionActivityInput, ResolutionActivityInput, ValidationActivityInput, ValidationActivityOutput, IngestionActivityInput, BatchWorkflowPayload
- `kind`: value
- `evidence`: Required class Examples only `import type` the DTO, define an unused accessor, and `console.log(typeof ontology) // "function"` (and the same `typeof` trick for `count`, `graph`, `conforms`, `namespace`, `documents`). Sibling `ValidationActivityViolationSummary` already decodes a realistic payload; these six do not. Placeholder law: `import { fn }; console.log(fn)` and unused bindings.
- `impact`: Callers hovering the workflow boundary never see schema-owned defaults, `Option` provenance, or the non-empty document-id invariant. Docgen compiles a function object, not the DTO doing its job.
- `suggestedFix`: Replace each Example with `S.decodeUnknownOption(Symbol)({ ...realistic fields... })` and log an observable field (`ontologyId`, `documentGraphUris.length`, `logOnly`/`shouldFail` policy, `conforms`, `targetNamespace`, `documentIds.length`). Keep existing Details/invariants. Do not add empty When-to-use.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-002: Timeline.ts ranked/read-model Examples log unapplied accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/Timeline.ts:278; scratchpad/effect-ontology/Domain/Schema/Timeline.ts:352; scratchpad/effect-ontology/Domain/Schema/Timeline.ts:406; scratchpad/effect-ontology/Domain/Schema/Timeline.ts:464; scratchpad/effect-ontology/Domain/Schema/Timeline.ts:518; scratchpad/effect-ontology/Domain/Schema/Timeline.ts:726; scratchpad/effect-ontology/Domain/Schema/Timeline.ts:747
- `symbol`: ClaimWithRank, ArticleDetailResponse, TimelineEntityResponse, TimelineClaimsResponse, CorrectionWithClaims, ClaimConflict
- `kind`: value
- `evidence`: Value Examples bind `readRank` / `countClaims` / `countCorrections` / `hasNext` / `affectedCount` / `status` and `console.log` the function, never a decoded row. `ArticleDetailResponse` value-imports the class only as a type. Same-name `ClaimConflict` type repeats the unapplied `_tag`/`conflictType` accessor. Contrast `ArticleSummary` and `TimelineEntityQuery`, which decode realistic payloads.
- `impact`: Bitemporal rank, pagination, and tagged resolution data are the reason these DTOs exist; the Examples hide that behind a function object.
- `suggestedFix`: Decode or `.make` a realistic claim/article/conflict and log `rank`, `claims.length`, `hasMore`, `_tag`, or `conflictType`. For the type companion, delete the Example (type-level Example is optional) or bind a decoded `ClaimConflict` value. Do not invent a second Example on the value.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-003: Search.ts hit/response classes never run the schema

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/Search.ts:91; scratchpad/effect-ontology/Domain/Schema/Search.ts:154; scratchpad/effect-ontology/Domain/Schema/Search.ts:238; scratchpad/effect-ontology/Domain/Schema/Search.ts:318
- `symbol`: ClaimSearchResponse, EntitySearchResult, Suggestion, ArticleSearchResult
- `kind`: value
- `evidence`: Each required Example `import type`s the class, defines `count` / `claimCount` / `label` / `conflicts`, and logs the unapplied function. Request siblings (`EntitySearchRequest`, `ClaimSearchRequest`) already decode bodies and log defaults (`limit` Some(20)).
- `impact`: Pagination totals, facet Option, and conflict counts never appear. Callers cannot tell a hit from a request DTO by hovering the Example.
- `suggestedFix`: Decode a minimal valid response/hit (`claims: []`, `total: 0`, `label: "Alice"`, `conflictCount: 0`) and log the field the accessor was pretending to teach.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-004: DocumentMetadata.ts stats/manifest/output Examples are unused accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/DocumentMetadata.ts:722; scratchpad/effect-ontology/Domain/Schema/DocumentMetadata.ts:753; scratchpad/effect-ontology/Domain/Schema/DocumentMetadata.ts:827
- `symbol`: PreprocessingStats, EnrichedManifest, PreprocessingActivityOutput
- `kind`: value
- `evidence`: `const failures = (stats) => stats.failedCount; console.log(failures)` (same for `count` / `duration`). `PreprocessingActivityInput` in the same file decodes a batch id + manifest URI and logs `preprocessing.enabled`. Type companions `DocumentType` / `EntityDensity` bind literals and are fine.
- `impact`: Non-negative aggregates, type-distribution records, and duration units are undocumented in the only required Example.
- `suggestedFix`: `.make` or decode a small stats/manifest/output fixture and log `failedCount`, `documents.length`, or `durationMs`. Keep the `[0, 1]` complexity invariant in prose, not as a fake function.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-005: EventSchema.ts Examples are `typeof S.is` and unused `acceptEvent`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/EventSchema.ts:297; scratchpad/effect-ontology/Domain/Schema/EventSchema.ts:164; scratchpad/effect-ontology/Domain/Schema/EventSchema.ts:318; scratchpad/effect-ontology/Domain/Schema/EventSchema.ts:364; scratchpad/effect-ontology/Domain/Schema/EventSchema.ts:395
- `symbol`: OntologyEventEntry, CurationEvent, ExtractionEvent, OntologyEvent
- `kind`: value
- `evidence`: Value Example is `console.log(typeof S.is(OntologyEventEntry)) // "function"` — tautological, never a journal entry. Type Examples are `const acceptEvent = (_event) => undefined; console.log(acceptEvent)`. `OntologyEventGroups.length // 2` in the same file is the only observable Example.
- `impact`: Event-tag/payload pairing is the public contract; the Example does not show a tag, primary key, or payload field.
- `suggestedFix`: On `OntologyEventEntry`, decode or construct one tagged case (`event: "ClaimCorrected"` plus a realistic payload) and log `event` / primary-key shape. Delete the three type-level `acceptEvent` fences (optional for types) or replace with a narrowed event value. Do not log `typeof S.is`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-006: KnowledgeModel.ts DerivedAssertion and span/term type Examples are unused functions

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/KnowledgeModel.ts:688; scratchpad/effect-ontology/Domain/Schema/KnowledgeModel.ts:304; scratchpad/effect-ontology/Domain/Schema/KnowledgeModel.ts:421
- `symbol`: DerivedAssertion, TextSpan, RdfObject
- `kind`: value
- `evidence`: `DerivedAssertion` (value class) logs unapplied `readRule`. Type companions `TextSpan` / `RdfObject` log unapplied `width` / `termType`. `Claim` in the same file decodes a full triple+evidence payload; `ClaimRank` / `EventType` type companions bind literals and are fine.
- `impact`: Rule id + non-empty supporting facts, and the legacy span→`TextAnchor` mapping, never show up. Callers cannot see `termType` discrimination.
- `suggestedFix`: Decode/make a `DerivedAssertion` with `ruleId` and log it. For types, delete the Example or construct `TextSpan`/`RdfObject` via the runtime schema and log `endChar - startChar` / `termType` on a real value.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-007: ExtractionRun aggregate and members log `typeof` of unused accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/ExtractionRun.ts:646; scratchpad/effect-ontology/Domain/Model/ExtractionRun.ts:705; scratchpad/effect-ontology/Domain/Model/ExtractionRun.ts:723; scratchpad/effect-ontology/Domain/Model/ExtractionRun.ts:741; scratchpad/effect-ontology/Domain/Model/ExtractionRun.ts:760
- `symbol`: ExtractionRun
- `kind`: value
- `evidence`: Class Example: `const metadataPath = (run) => run.metadataPath; console.log(typeof metadataPath) // "function"`. Members `[PrimaryKey.symbol]`, `metadataPath`, `inputPath`, `outputPath` repeat the same unused-function/`typeof` fence. Member titles are copy-paste: `inputPath` is titled **Example** (Use outputPath); `outputPath` is titled **Example** (Use AuditErrorType). `chunkId` static already logs a real `doc-…-chunk-2` id.
- `impact`: PathLayout-derived storage keys and primary-key identity are the aggregate’s job; hovers show a function type. Wrong titles teach the wrong member.
- `suggestedFix`: Decode/make a minimal `ExtractionRun` and log `run.metadataPath`, `run.inputPath`, `run.outputPath("metadata")`, and `run[PrimaryKey.symbol]()`. Retitle member Examples to the member they document. Keep `chunkId` as-is.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-008: PathLayout.ts type companions identity-wrap and log the function

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/PathLayout.ts:247; scratchpad/effect-ontology/Domain/PathLayout.ts:263; scratchpad/effect-ontology/Domain/PathLayout.ts:279; scratchpad/effect-ontology/Domain/PathLayout.ts:330; scratchpad/effect-ontology/Domain/PathLayout.ts:364; scratchpad/effect-ontology/Domain/PathLayout.ts:398; scratchpad/effect-ontology/Domain/PathLayout.ts:432; scratchpad/effect-ontology/Domain/PathLayout.ts:466; scratchpad/effect-ontology/Domain/PathLayout.ts:500; scratchpad/effect-ontology/Domain/PathLayout.ts:534; scratchpad/effect-ontology/Domain/PathLayout.ts:568; scratchpad/effect-ontology/Domain/PathLayout.ts:602; scratchpad/effect-ontology/Domain/PathLayout.ts:636; scratchpad/effect-ontology/Domain/PathLayout.ts:670; scratchpad/effect-ontology/Domain/PathLayout.ts:704; scratchpad/effect-ontology/Domain/PathLayout.ts:738; scratchpad/effect-ontology/Domain/PathLayout.ts:772; scratchpad/effect-ontology/Domain/PathLayout.ts:819; scratchpad/effect-ontology/Domain/PathLayout.ts:856; scratchpad/effect-ontology/Domain/PathLayout.ts:935; scratchpad/effect-ontology/Domain/PathLayout.ts:995; scratchpad/effect-ontology/Domain/PathLayout.ts:1107; scratchpad/effect-ontology/Domain/PathLayout.ts:1141; scratchpad/effect-ontology/Domain/PathLayout.ts:1175; scratchpad/effect-ontology/Domain/PathLayout.ts:1219; scratchpad/effect-ontology/Domain/PathLayout.ts:1255; scratchpad/effect-ontology/Domain/PathLayout.ts:1291; scratchpad/effect-ontology/Domain/PathLayout.ts:1328
- `symbol`: OntologyFilePath, OntologyFilePathTuple, OntologyFilePathEncoded, OntologyManifestPath, BatchStatusPath, BatchManifestPath, BatchResolutionPath, BatchValidationGraphPath, BatchValidationReportPath, BatchCanonicalPath, BatchEnrichedManifestPath, BatchIngestManifestPath, BatchFinalOutputPath, BatchInferencePath, DocumentMetadataPath, DocumentInputPath, DocumentGraphPath, RunMetadataPath, RunInputPath, RunChunkPath, RunOutputPath, ImageOriginalPath, ImageMetadataPath, ImageLabelsPath, ImageVariantPath, ImageOwnerBasePath, ImageManifestPath, CanonicalNamespacePath
- `kind`: type
- `evidence`: Repeated `const accept = (path: T) => path; console.log(accept)` on 28 same-name / Encoded companions. Runtime schemas already construct `fromParts`/`fromBatch`/`fromHash` with observable paths. `StoragePathSegment` type companion actually `.make`s a segment — keep that pattern.
- `impact`: Type-level Example is optional; once present it must observe a value. These fences compile an identity function and teach nothing about branded path strings.
- `suggestedFix`: Smallest fix: delete the type-level Example sections; keep the “Runtime value decoded by {@link …}.” lead, `@category type-level`, `@since 0.0.0`. Do not clone the runtime Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-009: CurationAction.ts type companions decode `{}` into a dummy string

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:157; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:205; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:254; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:301; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:349; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:396; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:632; scratchpad/effect-ontology/Domain/Schema/CurationAction.ts:752
- `symbol`: CorrectTripleAction, MarkAsWrongAction, AddAliasAction, PromoteToPreferredAction, LinkToWikidataAction, CurationAction, CurationEvent, CurationJob
- `kind`: type
- `evidence`: `const summarizeX = (_value: X): string => "valid …"; console.log(O.map(S.decodeUnknownOption(X)({}), summarizeX))`. Empty object fails the tagged struct; the mapper ignores the value. Titles say “Decode X”. Runtime consts already decode realistic `_tag` payloads via `@effect-ontology/Schema/CurationAction`. Type Examples import `@effect-ontology/Domain/Schema/CurationAction` instead.
- `impact`: Hover on the decoded type shows a guaranteed `None` plus a hardcoded string, contradicting the value Example’s successful decode.
- `suggestedFix`: Delete the type-level Examples (optional) and keep described `@see {@link Runtime}` where present. If kept, reuse the runtime payload and log a real field. Align imports to `@effect-ontology/Schema/CurationAction`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-010: Ontology.ts type companions dummy-summarize a failed decode

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/Ontology.ts:180; scratchpad/effect-ontology/Domain/Model/Ontology.ts:423; scratchpad/effect-ontology/Domain/Model/Ontology.ts:609
- `symbol`: PropertyRangeKind, ClassDefinition, PropertyDefinition
- `kind`: type
- `evidence`: Same dummy `summarizeX = (_value) => "valid …"` plus `S.decodeUnknownOption(X)({})`. Runtime `PropertyRangeKind.is.object("object")` already teaches the literal kit. Class/property runtime Examples decode real metadata.
- `impact`: Type Examples titled “Decode …” never produce a class or property; they print `None`.
- `suggestedFix`: Delete the three type-level Examples or bind `PropertyRangeKind` / a decoded class/property and log `id` / `isObjectProperty`. Use `@effect-ontology/Model/Ontology`, not `@effect-ontology/Domain/Model/Ontology`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-011: JobSchema.ts type companions log unapplied tag/attempt accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/JobSchema.ts:259; scratchpad/effect-ontology/Domain/Schema/JobSchema.ts:326
- `symbol`: BackgroundJob, JobMetadata
- `kind`: type
- `evidence`: `const jobName = (job) => job._tag; console.log(jobName)` and `const attempts = (metadata) => metadata.attempts; console.log(attempts)`. Runtime `BackgroundJob` logs `Object.keys(cases).length // 5`; `JobMetadata` decodes `{ id }` and logs `attempts` Some(0).
- `impact`: Type Examples add no narrowing or default-zero teaching beyond the runtime blocks.
- `suggestedFix`: Delete both type-level Examples; keep “Runtime job/metadata decoded by {@link …}.”
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-012: LinkIngestion.ts result/response type Examples log unapplied accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts:316; scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts:455
- `symbol`: BatchIngestResult, BatchIngestResponse
- `kind`: type
- `evidence`: `readStatus` / `total` functions logged, never applied. Runtime `BatchIngestResult` already decodes an `error` tag. `LinkStatus` type companion binds `"processing"` and is fine.
- `impact`: Status-specific nested success vs required error is not shown on the decoded type.
- `suggestedFix`: Delete the type Examples or log `_tag` / `summary.total` on a value produced by `BatchIngestResponse.fromResults`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-013: Api.ts SubmitJobSource / JobStatusResponse types log `typeof` of accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/Api.ts:82; scratchpad/effect-ontology/Domain/Schema/Api.ts:367
- `symbol`: SubmitJobSource, JobStatusResponse
- `kind`: type
- `evidence`: `console.log(typeof tag) // "function"` and the same for `status`. Runtime `SubmitJobSource` constructs `Inline` and logs `_tag`. `JobStatus` / `JobErrorType` type companions bind literals and are fine.
- `impact`: Discriminated inline-vs-HTTPS source and failed-vs-non-failed response data never appear on the type hover.
- `suggestedFix`: Delete the type Examples, or bind a constructed `Inline` / `completed` response and log `_tag` / `status`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-014: EntityResolution.ts ERNode / EREdge types log `typeof` of unused tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/EntityResolution.ts:207; scratchpad/effect-ontology/Domain/Model/EntityResolution.ts:322
- `symbol`: ERNode, EREdge
- `kind`: type
- `evidence`: `const tag = (node) => node._tag; console.log(typeof tag) // "function"`. Runtime node Example already uses `ERNode.guards.MentionRecord`. `ResolutionMethod` type binds `"neighbor"` and is fine.
- `impact`: Two-tier mention-vs-canonical discrimination is not shown on the decoded union type.
- `suggestedFix`: Delete the type Examples or log `_tag` on a constructed `MentionRecord` / `ResolutionEdge`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-015: BatchWorkflow.ts DocumentStatus / BatchState types log `typeof` of unused tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/BatchWorkflow.ts:103; scratchpad/effect-ontology/Domain/Model/BatchWorkflow.ts:432
- `symbol`: DocumentStatus, BatchState
- `kind`: type
- `evidence`: Unused `tag` / `stage` accessors with `console.log(typeof …) // "function"`. `BatchStage` type binds `"Validating"` and is fine. Runtime `BatchState.isValidTransition` is demonstrated on the Model barrel, not here.
- `impact`: Stage-specific nested members (the reason this is a tagged union, not a string) never appear.
- `suggestedFix`: Delete the type Examples or construct a `Pending`/`Failed` value and log `_tag`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-016: CoreOntology.ts MentionEvidence / EventInterval types log `typeof` of unused accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/CoreOntology.ts:329; scratchpad/effect-ontology/Domain/Model/CoreOntology.ts:660
- `symbol`: MentionEvidence, EventInterval
- `kind`: type
- `evidence`: `width` / `hasEnd` functions with `console.log(typeof …) // "function"`. `EventTime` type companion binds `{ _tag: "Unspecified" }` and is fine. Runtime `MentionEvidence` is a legacy→`TextAnchor` codec; the type Example never shows `quote` / offsets.
- `impact`: Ordered optional end instant and canonical span fields stay hidden.
- `suggestedFix`: Delete the type Examples or decode a span/interval and log `endChar - startChar` / `end._tag`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-017: OntologyEmbeddings.ts codec Example is `S.isSchema`; types log `typeof` accessors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/OntologyEmbeddings.ts:301; scratchpad/effect-ontology/Domain/Model/OntologyEmbeddings.ts:283; scratchpad/effect-ontology/Domain/Model/OntologyEmbeddings.ts:323
- `symbol`: OntologyEmbeddingsJson, OntologyEmbeddings
- `kind`: value
- `evidence`: Runtime JSON codec Example is only `console.log(S.isSchema(OntologyEmbeddingsJson)) // true` — not encode/decode. Type companions log `typeof dimension` / `typeof inspect`. Uniform-dimension invariant is in the value Details, never shown.
- `impact`: Callers of the JSON codec never see a round-trip or dimension check.
- `suggestedFix`: Encode a tiny `OntologyEmbeddings` (one class vector, matching `dimension`) to JSON and log `dimension` after decode. Delete the type-level `typeof` fences.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-018: BatchStatusResponse type Example logs `typeof` of unused `_tag` accessor

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/BatchStatusResponse.ts:109
- `symbol`: BatchStatusResponse
- `kind`: type
- `evidence`: `const tag = (response) => response._tag; console.log(typeof tag) // "function"`. Runtime schema already decodes `NotFound` and logs `_tag`.
- `impact`: Type Example adds no variant-ownership teaching.
- `suggestedFix`: Delete the type Example; keep the described lead linking the runtime schema.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-019: OntologyAgent.ts type Examples are `keyof` tautologies; getters leave unused bindings

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:122; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:388; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:532; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:621; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:677; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:781; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:851; scratchpad/effect-ontology/Domain/Model/OntologyAgent.ts:991
- `symbol`: OntologyAgentConfig, ExtractWithClaimsOptions, QueryBinding, QueryResult, ReasoningResult, ViolationsByLevel, ViolationExplanation, EnhancedValidationReport
- `kind`: type
- `evidence`: Repeated `const field: keyof T = "concurrency"; console.log(field) // "concurrency"` (and `articleId`, `bindings`, `answer`, `inferredTripleCount`, `violations`, `explanation`, `conforms`). Titles say “Select the … field” but never read a value. Class getters (`entities`, `isEmpty`, `isValid`, `hasTurtle`, `hasClaims`) bind unused accessors with copy-paste titles **Example** (Use OntologyAgent) / (Use onNone) and no `console.log`.
- `impact`: Schema-owned defaults (`concurrency` 4, `autoCreateAssertions` false) and validation `onNone` semantics never appear on the type or getter hover.
- `suggestedFix`: Delete type-level `keyof` Examples. On getters, construct/decode a result and log `entities.length` / `isValid` / `hasClaims`, and retitle to the getter. `ExtractionResult` value Example (`S.is({}) // false`) may stay as a failure case if a success decode is added, not as the sole fence.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-020: Entity.ts EvidenceSpan type Example only logs a `keyof` literal

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/Entity.ts:151
- `symbol`: EvidenceSpan
- `kind`: type
- `evidence`: Titled **Example** (Select the quoted text) is `const field: keyof EvidenceSpan = "quote"; console.log(field) // "quote"`. No span is decoded. `RelationObject` type companion binds `{ _tag: "Boolean", value: true }` and is fine.
- `impact`: Callers never see the legacy text-field → `TextAnchor` quote/offsets the codec exists to produce.
- `suggestedFix`: Delete the type Example or decode a legacy span and log `quote` / `startChar`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-021: Agent.ts AgentEvent type Example only logs `"_tag"`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Model/Agent.ts:1005
- `symbol`: AgentEvent
- `kind`: type
- `evidence`: Titled **Example** (Select the lifecycle discriminator) is `const field: keyof AgentEvent = "_tag"; console.log(field) // "_tag"`. Runtime union Example (if any on the const) is the place to show a tagged event; this type fence never constructs one. `AgentType` type companion binds `"extractor"` and is fine.
- `impact`: Agent-started vs checkpoint events are not distinguished on the decoded type.
- `suggestedFix`: Delete the type Example or construct `AgentStarted` / `PipelineCheckpoint` and log `_tag`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### ontology-domain-R1-022: Timeline ClaimRank re-export Example is copy-pasted from BooleanQueryValueDefinition

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/effect-ontology/Domain/Schema/Timeline.ts:33
- `symbol`: ClaimRank
- `kind`: value
- `evidence`: `export { ClaimRank }` carries JSDoc whose Example is titled **Example** (Use BooleanQueryValueDefinition) while the lead says “Claim-rank vocabulary re-exported for timeline source-path parity.” Census flagged this as an owning miss (rejected above). The attached title is still a caller-facing copy-paste. Owning Example on `KnowledgeModel.ClaimRank` already logs `ClaimRank.is.preferred("preferred")`.
- `impact`: Hovering the Timeline re-export teaches a private query codec name, not claim rank. Law: re-exports are graph edges, not new documentation subjects.
- `suggestedFix`: Delete the JSDoc on `export { ClaimRank }`. Do not retitle and keep a barrel Example. Callers follow the KnowledgeModel owning block.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ontology-domain
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Pack verdict

- files reviewed: 55
- owning exports reviewed: 576
- confirmed mechanical items: 0
- editorial items: 22
- rejected false positives: 3
- accepted findings: 22

Every exporting module and every owning export was reviewed. The three census-open owners are re-export false positives (not documented as new symbols). Accepted findings are editorial Example-quality defects: seven files ship placeholder **required** value-level Examples; fourteen more ship vacuous optional type-level Examples (`identity accept`, dummy `summarize`+`decode({})`, `typeof` of an unused accessor, or `keyof` tautology); Timeline’s `ClaimRank` re-export has a copy-paste Example title and should drop its invented JSDoc.

Not opened (reject list): retitling generic but observable “Use X” Examples; filling empty When-to-use/Details; documenting `export *` barrels; taste-only lead rewrites on Error/Identity/Shacl/Rdf/Auth/BatchRequest/OntologyBrowser/OntologyRegistry/Inference where Examples already decode or `.make` realistic values.
