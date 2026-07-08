# JSDoc Documentation Compliance Inventory

Generated: 2026-07-08T05:54:02.624Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: required export tags, summaries, TSDoc grammar, forbidden legacy tags, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 100 |
| cleanPackages | 52 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 45 |
| publicModules | 1617 |
| publicExports | 14506 |
| openModules | 129 |
| openExports | 1407 |
| missingExportExamples | 1215 |
| missingExportCategories | 91 |
| missingExportSince | 91 |
| forbiddenTagFindings | 2 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 24 |
| unsafeExampleFindings | 68 |
| schemaAnnotationFindings | 126 |
| rootPolicyOpen | 0 |

## Root Policy

| File | Tag | Status | Missing |
|---|---|---|---|
| tsdoc.json | `@effects` | resolved | none |
| tsdoc.json | `@precondition` | resolved | none |
| tsdoc.json | `@postcondition` | resolved | none |
| tsdoc.json | `@invariant` | resolved | none |

## Package Summary

| Order | Package | Path | Status | Modules | Exports | Open Modules | Open Exports |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | `@beep/dol` | `packages/drivers/dol` | clean | 1 | 1 | 0 | 0 |
| 2 | `@beep/hubspot` | `packages/drivers/hubspot` | needs-remediation | 4 | 22 | 0 | 1 |
| 3 | `@beep/agents-domain` | `packages/agents/domain` | clean | 12 | 48 | 0 | 0 |
| 4 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 2 | 22 | 0 | 1 |
| 5 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 6 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 7 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 8 | `@beep/pacer` | `packages/drivers/pacer` | clean | 13 | 89 | 0 | 0 |
| 9 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 16 | 34 | 0 | 0 |
| 10 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 8 | 57 | 0 | 4 |
| 11 | `@beep/law-practice-server` | `packages/law-practice/server` | clean | 2 | 3 | 0 | 0 |
| 12 | `@beep/db-admin` | `packages/_internal/db-admin` | clean | 7 | 13 | 0 | 0 |
| 13 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 40 | 225 | 0 | 5 |
| 14 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 15 | `@beep/face-detection` | `packages/drivers/face-detection` | clean | 4 | 33 | 0 | 0 |
| 16 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 7 | 0 | 0 |
| 17 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 101 | 678 | 0 | 54 |
| 18 | `@beep/pglite` | `packages/drivers/pglite` | clean | 4 | 11 | 0 | 0 |
| 19 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 83 | 0 | 0 |
| 20 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 7 | 27 | 0 | 6 |
| 21 | `@beep/courtlistener` | `packages/drivers/courtlistener` | clean | 1 | 1 | 0 | 0 |
| 22 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | clean | 8 | 25 | 0 | 0 |
| 23 | `@beep/editor` | `packages/foundation/ui-system/editor` | clean | 21 | 86 | 0 | 0 |
| 24 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 0 | 8 |
| 25 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 50 | 122 | 0 | 3 |
| 26 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 9 | 82 | 0 | 9 |
| 27 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | needs-remediation | 8 | 94 | 0 | 18 |
| 28 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | clean | 4 | 14 | 0 | 0 |
| 29 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 8 | 32 | 7 | 8 |
| 30 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 31 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 23 | 72 | 0 | 7 |
| 32 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 4 | 21 | 0 | 17 |
| 33 | `@beep/workspace-server` | `packages/workspace/server` | clean | 7 | 19 | 0 | 0 |
| 34 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 35 | `@beep/uspto` | `packages/drivers/uspto` | needs-remediation | 5 | 24 | 0 | 5 |
| 36 | `@beep/phoenix` | `packages/drivers/phoenix` | needs-remediation | 5 | 50 | 0 | 10 |
| 37 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 5 | 32 | 0 | 4 |
| 38 | `@beep/types` | `packages/foundation/primitive/types` | clean | 5 | 10 | 0 | 0 |
| 39 | `@beep/oip-web` | `apps/oip-web` | needs-remediation | 31 | 84 | 1 | 4 |
| 40 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 41 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 5 | 103 | 0 | 50 |
| 42 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 6 | 30 | 0 | 0 |
| 43 | `@beep/shared-tables` | `packages/shared/tables` | clean | 11 | 14 | 0 | 0 |
| 44 | `@beep/scratchpad` | `scratchpad` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 45 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 6 | 170 | 0 | 48 |
| 46 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | clean | 12 | 30 | 0 | 0 |
| 47 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 27 | 60 | 0 | 0 |
| 48 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | needs-remediation | 28 | 107 | 0 | 12 |
| 49 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 26 | 213 | 0 | 17 |
| 50 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 17 | 258 | 0 | 4 |
| 51 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 52 | `@beep/tika` | `packages/drivers/tika` | clean | 4 | 16 | 0 | 0 |
| 53 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 4 | 19 | 0 | 2 |
| 54 | `@beep/venice-ai` | `packages/drivers/venice-ai` | clean | 3 | 35 | 0 | 0 |
| 55 | `@beep/form` | `packages/foundation/ui-system/form` | needs-remediation | 42 | 114 | 0 | 1 |
| 56 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 6 | 166 | 0 | 21 |
| 57 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 4 | 17 | 0 | 0 |
| 58 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | clean | 2 | 8 | 0 | 0 |
| 59 | `@beep/box` | `packages/drivers/box` | needs-remediation | 103 | 4497 | 0 | 2 |
| 60 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 61 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 311 | 0 | 4 |
| 62 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 5 | 26 | 0 | 0 |
| 63 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 25 | 48 | 2 | 23 |
| 64 | `@beep/epistemic-domain` | `packages/epistemic/domain` | clean | 22 | 43 | 0 | 0 |
| 65 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 64 | 0 | 0 |
| 66 | `@beep/firecrawl` | `packages/drivers/firecrawl` | needs-remediation | 5 | 267 | 0 | 3 |
| 67 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 5 | 23 | 0 | 9 |
| 68 | `@beep/acp` | `packages/drivers/acp` | clean | 10 | 410 | 0 | 0 |
| 69 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 313 | 0 | 25 |
| 70 | `@beep/infra` | `infra` | clean | 5 | 34 | 0 | 0 |
| 71 | `@beep/runpod` | `packages/drivers/runpod` | needs-remediation | 6 | 178 | 0 | 2 |
| 72 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 63 | 654 | 2 | 18 |
| 73 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 241 | 1566 | 0 | 438 |
| 74 | `@beep/epistemic-server` | `packages/epistemic/server` | clean | 2 | 3 | 0 | 0 |
| 75 | `@beep/rdf` | `packages/foundation/modeling/rdf` | clean | 17 | 208 | 0 | 0 |
| 76 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | needs-remediation | 4 | 16 | 0 | 2 |
| 77 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 78 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 85 | 0 | 17 |
| 79 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 144 | 0 | 36 |
| 80 | `@beep/xai` | `packages/drivers/xai` | clean | 7 | 70 | 0 | 0 |
| 81 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 82 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 4 | 17 | 0 | 0 |
| 83 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | needs-remediation | 4 | 54 | 0 | 3 |
| 84 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 3 | 24 | 0 | 3 |
| 85 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 29 | 0 | 10 |
| 86 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 87 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | clean | 10 | 19 | 0 | 0 |
| 88 | `@beep/m365` | `packages/drivers/m365` | clean | 6 | 74 | 0 | 0 |
| 89 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 24 | 159 | 3 | 11 |
| 90 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 5 | 339 | 0 | 331 |
| 91 | `@beep/ui` | `packages/foundation/ui-system/ui` | needs-remediation | 132 | 578 | 114 | 54 |
| 92 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | needs-remediation | 5 | 119 | 0 | 92 |
| 93 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 25 | 138 | 0 | 5 |
| 94 | `@beep/wink` | `packages/drivers/wink` | clean | 14 | 71 | 0 | 0 |
| 95 | `@beep/postgres` | `packages/drivers/postgres` | clean | 7 | 36 | 0 | 0 |
| 96 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 52 | 0 | 0 |
| 97 | `@beep/provenance` | `packages/foundation/modeling/provenance` | clean | 2 | 4 | 0 | 0 |
| 98 | `@beep/epistemic-tables` | `packages/epistemic/tables` | clean | 6 | 12 | 0 | 0 |
| 99 | `@beep/federal-register` | `packages/drivers/federal-register` | clean | 1 | 1 | 0 | 0 |
| 100 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |

## Open Findings

### @beep/hubspot

Path: `packages/drivers/hubspot`

Export findings:
- `src/HubSpot.config.ts:62` `HubSpotBaseUrl` (const) - 1 schema annotation/type-alias gap(s)

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Export findings:
- `src/index.ts:11` `export * as Ontology from "./Ontology.models.ts";` (re-export) - 1 category casing violation(s)

### @beep/mcp-kit

Path: `packages/foundation/capability/mcp-kit`

Export findings:
- `src/TierGate.ts:211` `ToolCallRequest` (interface) - missing @example
- `src/TierGate.ts:397` `TierGateDispatchResult` (type) - missing @example
- `src/TierGate.ts:412` `TierGateDispatchResult` (const) - missing @example
- `src/ToolkitComposition.ts:34` `GatedLayer` (interface) - missing @example

### @beep/shared-domain

Path: `packages/shared/domain`

Export findings:
- `src/entity/EntityId.ts:121` `EntityIdValue` (type) - 1 unsafe example violation(s)
- `src/entity/EntityId.ts:137` `EntityIdValueFor` (type) - 1 unsafe example violation(s)
- `src/entity/EntityId.ts:308` `Definition` (class) - 1 unsafe example violation(s)
- `src/entity/EntityId.ts:374` `EntityId` (type) - 1 unsafe example violation(s)
- `src/entity/EntityId.ts:420` `Any` (type) - 1 unsafe example violation(s)

### @beep/repo-cli

Path: `packages/tooling/tool/cli`

Export findings:
- `src/commands/Architecture/OperationPlan.ts:46` `ArchitectureDomainKind` (type) - missing @example
- `src/commands/Architecture/OperationPlan.ts:73` `ArchitecturePlanStage` (type) - missing @example
- `src/commands/Architecture/OperationPlan.ts:110` `ArchitectureSliceRole` (type) - missing @example
- `src/commands/Architecture/OperationPlan.ts:218` `ArchitectureWriterKind` (type) - missing @example
- `src/commands/Architecture/OperationPlan.ts:639` `ArchitectureOperation` (const) - 1 schema annotation/type-alias gap(s)
- `src/commands/Architecture/OperationPlan.ts:652` `ArchitectureOperation` (type) - missing @example
- `src/commands/Architecture/OperationPlanPackageJson.ts:64` `renderPackageJsonOperation` (const) - missing @example
- `src/commands/Corpus/Corpus.schemas.ts:325` `RecycleBinFormatVersion` (type) - missing @example
- `src/commands/Corpus/Corpus.schemas.ts:514` `CorpusRestorationRecord` (type) - missing @example
- `src/commands/Corpus/Corpus.schemas.ts:628` `RecycleBinEntryKind` (type) - missing @example
- `src/commands/Corpus/Corpus.schemas.ts:955` `CorpusOrganizeCategory` (type) - missing @example
- `src/commands/Corpus/Corpus.service.ts:153` `CorpusCommandServiceShape` (interface) - 1 unsafe example violation(s)
- `src/commands/Files/Files.schemas.ts:59` `PositiveMediaDimension` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:91` `FileSha256Hash` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:132` `NonNegativePixelOffset` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:157` `MediaKind` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:182` `SupportedMetadataImageExtension` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:207` `NormalizeImageFormatInput` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:232` `NormalizeImageFormat` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:265` `NormalizeSkippedReason` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:299` `CreateCaptionFilesSkippedReason` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:324` `BorderSide` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:349` `BorderDetectionKind` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:382` `DetectBordersSkippedReason` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:416` `DetectFacesSkippedReason` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:447` `DetectFacesFlag` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:472` `CandidateAssessmentProfile` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:497` `CandidateAssessmentDecision` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:526` `CandidateAssessmentReason` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:559` `ArchivePoorCandidatesSkippedReason` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:591` `CandidateRatioThreshold` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:638` `BorderDetectionPercentage` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:685` `BorderDetectionMaxScanPercentage` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:732` `BorderDetectionTolerance` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:779` `RgbChannel` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:923` `SafeFilePrefix` (type) - missing @example
- `src/commands/Files/Files.schemas.ts:2256` `ProcessFilesFailurePolicy` (type) - missing @example
- `src/commands/Files/Files.service.ts:346` `FilesCommandServiceShape` (interface) - 1 unsafe example violation(s)
- `src/commands/Image/Image.schemas.ts:217` `ExtractFramesDirOutcome` (type) - missing @example
- `src/commands/Image/Image.service.ts:55` `ImageCommandServiceShape` (interface) - 1 unsafe example violation(s)
- `src/commands/Lint/SchemaCatalog.ts:50` `SchemaCatalogEntryKind` (const) - 1 schema annotation/type-alias gap(s)
- `src/commands/Lint/SchemaFirst.ts:172` `SchemaFirstPolicyRuleId` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/commands/Lint/SchemaFirst.ts:205` `SchemaFirstEntryKind` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/commands/Lint/SchemaFirst.ts:223` `SchemaFirstEntryStatus` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/commands/Lint/SchemaFirst.ts:361` `SchemaCrispeningFamily` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/commands/Research/Research.service.ts:103` `ResearchCommandServiceShape` (interface) - missing @example
- `src/commands/Skills/Skills.command.ts:222` `remoteSkillSources` (const) - missing @example
- `src/commands/Skills/Skills.command.ts:707` `renderCodexConfigWithSkills` (const) - missing @example
- `src/commands/Skills/Skills.command.ts:847` `runSkillsUpdate` (const) - missing @example
- `src/commands/TsconfigSync/TsconfigSync.command.ts:268` `TsconfigSyncRunOptions` (type) - missing @example
- `src/commands/TsconfigSync/TsconfigSync.command.ts:300` `TsconfigSyncSection` (type) - missing @example
- `src/commands/TsconfigSync/TsconfigSync.command.ts:402` `TsconfigSyncChange` (type) - missing @example
- `src/commands/TsconfigSync/TsconfigSync.command.ts:516` `PlannedFileChange` (type) - missing @example
- `src/commands/TsconfigSync/TsconfigSync.command.ts:578` `TsconfigSyncResult` (type) - missing @example

### @beep/agents-server

Path: `packages/agents/server`

Export findings:
- `src/AssistantTurn/BlockRepair.ts:260` `PatchOpSummaryBase` (class) - missing @example
- `src/AssistantTurn/BlockRepair.ts:277` `AddPatchOpSummary` (class) - missing @example
- `src/AssistantTurn/BlockRepair.ts:292` `RemovePatchOpSummary` (class) - missing @example
- `src/AssistantTurn/BlockRepair.ts:307` `ReplacePatchOpSummary` (class) - missing @example
- `src/AssistantTurn/BlockRepair.ts:322` `PatchOpSummary` (const) - missing @example
- `src/AssistantTurn/BlockRepair.ts:335` `PatchOpSummary` (type) - missing @example

### @beep/nlp-mcp

Path: `packages/drivers/nlp-mcp`

Export findings:
- `src/StreamingTools.ts:98` `LinesOutput` (type) - missing @example
- `src/StreamingTools.ts:149` `FileInfoOutput` (type) - missing @example
- `src/StreamingTools.ts:186` `TextStatsOutput` (type) - missing @example
- `src/StreamingTools.ts:241` `JsonlOutput` (type) - missing @example
- `src/StreamingTools.ts:276` `JsonlStatsOutput` (type) - missing @example
- `src/StreamingTools.ts:311` `DatasetMetaOutput` (type) - missing @example
- `src/StreamingTools.ts:361` `DataOutput` (type) - missing @example
- `src/StreamingTools.ts:401` `PipelineOutput` (type) - missing @example

### @beep/law-practice-domain

Path: `packages/law-practice/domain`

Export findings:
- `src/values/ApplicationNumber/ApplicationNumber.model.ts:81` `ApplicationNumber` (type) - 1 unsafe example violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:86` `PatentDocumentTriplet` (type) - 1 unsafe example violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:74` `PatentNumber` (type) - 1 unsafe example violation(s)

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/Domain.ts:226` `DocEntry` (class) - 1 unsafe example violation(s)
- `src/Domain.ts:308` `Class` (class) - 1 unsafe example violation(s)
- `src/Domain.ts:454` `Function` (class) - 1 unsafe example violation(s)
- `src/Domain.ts:588` `Constant` (class) - 1 unsafe example violation(s)
- `src/Printer.ts:446` `print` (const) - 1 unsafe example violation(s)
- `src/Printer.ts:553` `printModule` (const) - 1 unsafe example violation(s)
- `src/ProofManifest.ts:45` `DocgenProofManifestStandard` (type) - missing @example
- `src/ProofManifest.ts:71` `DocgenProofManifestSchemaVersion` (type) - missing @example
- `src/ProofManifest.ts:97` `DocgenProofManifestStatus` (type) - missing @example

### @beep/file-processing

Path: `packages/foundation/capability/file-processing`

Export findings:
- `src/Artifact/index.ts:101` `ArtifactId` (type) - missing @example
- `src/Artifact/index.ts:138` `OperationId` (type) - missing @example
- `src/Artifact/index.ts:175` `ContentDigest` (type) - missing @example
- `src/Artifact/index.ts:234` `ArtifactLocatorKind` (type) - missing @example
- `src/Extraction/index.ts:51` `SourceProcessingStatus` (type) - missing @example
- `src/Extraction/index.ts:403` `ProcessFileResult` (type) - missing @example
- `src/Extraction/index.ts:624` `SourceProcessingRecord` (type) - missing @example
- `src/Extraction/index.ts:656` `FileProcessingFailureReason` (type) - missing @example
- `src/Extraction/index.ts:797` `FileProcessingFailureRecord` (type) - missing @example
- `src/Operation/index.ts:52` `FileProcessingOperationErrorReason` (type) - missing @example
- `src/PathSafety/index.ts:69` `PathSafetyViolationReason` (type) - missing @example
- `src/Strategy/index.ts:41` `FileProcessingOperationKind` (type) - missing @example
- `src/Strategy/index.ts:68` `FileProcessingEngineFamily` (type) - missing @example
- `src/Strategy/index.ts:130` `FileFormatFamily` (type) - missing @example
- `src/Strategy/index.ts:162` `FileProcessingCapability` (type) - missing @example
- `src/Strategy/index.ts:189` `FileProcessingSupportDisposition` (type) - missing @example
- `src/Strategy/index.ts:225` `FileProcessingSkipReason` (type) - missing @example
- `src/Strategy/index.ts:391` `SelectedStrategy` (type) - missing @example

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/rules/index.ts:1` (none) - missing summary; missing @since
- `src/rules/namespace-node-imports.ts:1` (none) - missing summary; missing @since
- `src/rules/no-global-process-runtime.ts:1` (none) - missing summary; missing @since
- `src/rules/no-inline-schema-compile.ts:1` (none) - missing summary; missing @since
- `src/rules/no-manual-effect-runtime-in-tests.ts:1` (none) - missing summary; missing @since
- `src/rules/no-opaque-instance-fields.ts:1` (none) - missing summary; missing @since
- `src/rules/utils.ts:1` (none) - missing summary; missing @since

Export findings:
- `src/index.ts:154` `RuleRegistrySchema` (class) - 1 schema annotation/type-alias gap(s)
- `src/rules/index.ts:42` `default` (CallExpression) - missing summary; missing @example, @category, @since
- `src/rules/namespace-node-imports.ts:59` `default` (CallExpression) - missing summary; missing @example, @category, @since
- `src/rules/no-global-process-runtime.ts:53` `default` (CallExpression) - missing summary; missing @example, @category, @since
- `src/rules/no-inline-schema-compile.ts:85` `default` (CallExpression) - missing summary; missing @example, @category, @since
- `src/rules/no-manual-effect-runtime-in-tests.ts:152` `default` (CallExpression) - missing summary; missing @example, @category, @since
- `src/rules/no-opaque-instance-fields.ts:38` `default` (CallExpression) - missing summary; missing @example, @category, @since
- `src/rules/utils.ts:299` `ImportBinding` (const) - 1 schema annotation/type-alias gap(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Export findings:
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:65` `RuntimeCandidateLifecycle` (const) - 1 schema annotation/type-alias gap(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:86` `RuntimeClaimConfidence` (const) - 1 schema annotation/type-alias gap(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:107` `RuntimeApprovalDecision` (const) - 1 schema annotation/type-alias gap(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:128` `RuntimeRequestKind` (const) - 1 schema annotation/type-alias gap(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:149` `RuntimeSourceKind` (const) - 1 schema annotation/type-alias gap(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:170` `RuntimeActivityType` (const) - 1 schema annotation/type-alias gap(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:191` `RuntimeUsageMode` (const) - 1 schema annotation/type-alias gap(s)

### @beep/m365-mcp

Path: `packages/drivers/m365-mcp`

Export findings:
- `src/M365Handlers.ts:88` `M365ToolkitHandlersLive` (const) - missing @example
- `src/M365Tools.ts:97` `M365ListDrivesTool` (const) - missing @example
- `src/M365Tools.ts:114` `M365ListSitesTool` (const) - missing @example
- `src/M365Tools.ts:131` `M365GetSiteTool` (const) - missing @example
- `src/M365Tools.ts:148` `M365DeltaDriveItemsTool` (const) - missing @example
- `src/M365Tools.ts:165` `M365DownloadDriveItemContentTool` (const) - missing @example
- `src/M365Tools.ts:182` `M365GetListItemTool` (const) - missing @example
- `src/M365Tools.ts:199` `M365ListDriveItemVersionsTool` (const) - missing @example
- `src/M365Tools.ts:216` `M365ListMessagesTool` (const) - missing @example
- `src/M365Tools.ts:233` `M365GetMessageTool` (const) - missing @example
- `src/M365Tools.ts:250` `M365ListEventsTool` (const) - missing @example
- `src/M365Tools.ts:267` `M365GetEventTool` (const) - missing @example
- `src/M365Tools.ts:284` `M365Toolkit` (const) - missing @example
- `src/M365Tools.ts:304` `M365Toolkit` (type) - missing @example
- `src/Server.ts:26` `M365McpServerConfig` (class) - missing @example
- `src/Server.ts:46` `makeServerLayer` (const) - missing @example
- `src/index.ts:54` `VERSION` (const) - missing @example

### @beep/uspto

Path: `packages/drivers/uspto`

Export findings:
- `src/Uspto.models.ts:54` `UsptoApplicationNumber` (type) - missing @example
- `src/Uspto.models.ts:88` `UsptoApplicationNumberFromText` (const) - 1 schema annotation/type-alias gap(s)
- `src/Uspto.models.ts:133` `UsptoPatentNumber` (type) - missing @example
- `src/Uspto.models.ts:170` `UsptoPatentNumberFromText` (const) - 1 schema annotation/type-alias gap(s)
- `src/Uspto.service.ts:45` `UsptoShape` (interface) - 1 unsafe example violation(s)

### @beep/phoenix

Path: `packages/drivers/phoenix`

Export findings:
- `src/Phoenix.errors.ts:56` `PhoenixOperation` (type) - missing @example
- `src/Phoenix.errors.ts:83` `PhoenixErrorReason` (type) - missing @example
- `src/Phoenix.models.ts:53` `PhoenixDoctorStatus` (type) - missing @example
- `src/Phoenix.models.ts:80` `PhoenixDatasetSelectorKind` (type) - missing @example
- `src/Phoenix.models.ts:107` `PhoenixAnnotationTargetKind` (type) - missing @example
- `src/Phoenix.models.ts:134` `PhoenixAnnotatorKind` (type) - missing @example
- `src/Phoenix.models.ts:162` `PhoenixAnnotationValue` (type) - missing @example
- `src/Phoenix.models.ts:197` `PhoenixPromptChatRole` (type) - missing @example
- `src/Phoenix.models.ts:224` `PhoenixPromptTemplateFormat` (type) - missing @example
- `src/Phoenix.models.ts:259` `PhoenixPromptModelProvider` (type) - missing @example

### @beep/test-utils

Path: `packages/tooling/test-kit/test-utils`

Export findings:
- `src/SqlTest.ts:304` `PgliteTestcontainersTestDriverConfigInput` (type) - 1 unsafe example violation(s)
- `src/SqlTest.ts:383` `PgExternalTestDriverConfigInput` (type) - 1 unsafe example violation(s)
- `src/SqlTest.ts:430` `PgliteSqlTestLayerOptions` (interface) - 1 unsafe example violation(s)
- `src/SqlTest.ts:643` `PgliteTestcontainerResource` (interface) - 1 unsafe example violation(s)

### @beep/oip-web

Path: `apps/oip-web`

Module findings:
- `src/components/MattersCarousel.tsx:1` (none) - missing summary; missing @since

Export findings:
- `src/app/api/contact/ContactRouteResponse.ts:88` `contactRequestResponseWithSubmit` (const) - 1 unsafe example violation(s)
- `src/app/layout.tsx:146` `instant` (const) - missing @example
- `src/app/page.tsx:36` `instant` (const) - missing @example
- `src/components/HeroVideo.tsx:158` `HERO_ROTATE_MS` (const) - missing @example

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Export findings:
- `src/Lexical.model.ts:83` `LexicalNodeVersion` (const) - missing @example
- `src/Lexical.model.ts:95` `LexicalNodeVersion` (type) - missing @example
- `src/Lexical.model.ts:117` `TextFormatBits` (const) - missing @example
- `src/Lexical.model.ts:125` `TextFormatBit` (const) - missing @example
- `src/Lexical.model.ts:137` `TextFormatBit` (type) - missing @example
- `src/Lexical.model.ts:145` `TEXT_FORMAT_MASK_ALL` (const) - missing @example
- `src/Lexical.model.ts:167` `TextFormatMask` (const) - missing @example
- `src/Lexical.model.ts:175` `TextFormatMask` (type) - missing @example
- `src/Lexical.model.ts:183` `hasTextFormat` (const) - missing @example
- `src/Lexical.model.ts:194` `withTextFormat` (const) - missing @example
- `src/Lexical.model.ts:210` `TextDetailBits` (const) - missing @example
- `src/Lexical.model.ts:218` `TextDetailBit` (const) - missing @example
- `src/Lexical.model.ts:230` `TextDetailBit` (type) - missing @example
- `src/Lexical.model.ts:238` `TEXT_DETAIL_MASK_ALL` (const) - missing @example
- `src/Lexical.model.ts:260` `TextDetailMask` (const) - missing @example
- `src/Lexical.model.ts:268` `TextDetailMask` (type) - missing @example
- `src/Lexical.model.ts:276` `LexicalIndentDepth` (const) - missing @example
- `src/Lexical.model.ts:289` `LexicalIndentDepth` (type) - missing @example
- `src/Lexical.model.ts:297` `TableCellHeaderState` (const) - missing @example
- `src/Lexical.model.ts:309` `TableCellHeaderState` (type) - missing @example
- `src/Lexical.model.ts:317` `TableCellSpan` (const) - missing @example
- `src/Lexical.model.ts:330` `TableCellSpan` (type) - missing @example
- `src/Lexical.model.ts:338` `TableDimension` (const) - missing @example
- `src/Lexical.model.ts:351` `TableDimension` (type) - missing @example
- `src/Lexical.model.ts:359` `ArtifactRefId` (const) - missing @example
- `src/Lexical.model.ts:380` `ArtifactRefId` (type) - missing @example
- `src/Lexical.model.ts:610` `SafeInlineStyle` (const) - 1 schema annotation/type-alias gap(s)
- `src/Lexical.model.ts:643` `SafeStyleValue` (const) - 1 schema annotation/type-alias gap(s)
- `src/Lexical.model.ts:743` `BaseNode` (namespace) - missing @example
- `src/Lexical.model.ts:843` `ElementNode` (namespace) - missing @example
- `src/Lexical.model.ts:912` `TextBase` (namespace) - missing @example
- `src/Lexical.model.ts:972` `TextNode` (namespace) - missing @example
- `src/Lexical.model.ts:1024` `TabNode` (namespace) - missing @example
- `src/Lexical.model.ts:1074` `LineBreakNode` (namespace) - missing @example
- `src/Lexical.model.ts:1122` `RootNode` (namespace) - missing @example
- `src/Lexical.model.ts:1170` `ParagraphNode` (namespace) - missing @example
- `src/Lexical.model.ts:1219` `HeadingNode` (namespace) - missing @example
- `src/Lexical.model.ts:1269` `QuoteNode` (namespace) - missing @example
- `src/Lexical.model.ts:1328` `ListNode` (namespace) - missing @example
- `src/Lexical.model.ts:1390` `ListItemNode` (namespace) - missing @example
- `src/Lexical.model.ts:1455` `LinkNode` (namespace) - missing @example
- `src/Lexical.model.ts:1522` `CodeNode` (namespace) - missing @example
- `src/Lexical.model.ts:1587` `ArtifactRefNode` (namespace) - missing @example
- `src/Lexical.model.ts:1653` `YouTubeNode` (namespace) - missing @example
- `src/Lexical.model.ts:1745` `TableCellNode` (namespace) - missing @example
- `src/Lexical.model.ts:1818` `TableRowNode` (namespace) - missing @example
- `src/Lexical.model.ts:1888` `TableNode` (namespace) - missing @example
- `src/Lexical.model.ts:1934` `LexicalNode` (const) - 1 schema annotation/type-alias gap(s)
- `src/Lexical.model.ts:1977` `LexicalNode` (namespace) - missing @example
- `src/Lexical.model.ts:2081` `SerializedEditorState` (namespace) - missing @example

### @beep/md

Path: `packages/foundation/modeling/md`

Export findings:
- `src/Md.behavior.ts:31` `SegmentStrategy` (interface) - missing @example; forbidden @template
- `src/Md.behavior.ts:86` `segmentInlineRuns` (const) - forbidden @template
- `src/Md.model.ts:25` `CodeFenceLanguage` (const) - missing @example
- `src/Md.model.ts:45` `CodeFenceLanguage` (type) - missing @example
- `src/Md.model.ts:57` `YouTubeVideoId` (const) - missing @example
- `src/Md.model.ts:78` `InlineChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Md.model.ts:90` `InlineChildren` (namespace) - missing @example
- `src/Md.model.ts:134` `Text` (namespace) - missing @example
- `src/Md.model.ts:181` `RawMarkdown` (namespace) - missing @example
- `src/Md.model.ts:231` `RawHtml` (namespace) - missing @example
- `src/Md.model.ts:278` `Strong` (namespace) - missing @example
- `src/Md.model.ts:328` `Em` (namespace) - missing @example
- `src/Md.model.ts:378` `Del` (namespace) - missing @example
- `src/Md.model.ts:428` `Code` (namespace) - missing @example
- `src/Md.model.ts:478` `A` (namespace) - missing @example
- `src/Md.model.ts:533` `Img` (namespace) - missing @example
- `src/Md.model.ts:577` `Br` (namespace) - missing @example
- `src/Md.model.ts:622` `Inline` (type) - missing @example
- `src/Md.model.ts:630` `Inline` (namespace) - missing @example
- `src/Md.model.ts:668` `BlockChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Md.model.ts:680` `BlockChildren` (namespace) - missing @example
- `src/Md.model.ts:700` `ListItemChild` (const) - missing @example
- `src/Md.model.ts:714` `ListItemChild` (type) - missing @example
- `src/Md.model.ts:722` `ListItemChild` (namespace) - missing @example
- `src/Md.model.ts:740` `ListItemChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Md.model.ts:752` `ListItemChildren` (namespace) - missing @example
- `src/Md.model.ts:796` `P` (namespace) - missing @example
- `src/Md.model.ts:842` `HeadingLevel` (type) - missing @example
- `src/Md.model.ts:882` `Heading` (namespace) - missing @example
- `src/Md.model.ts:936` `Li` (namespace) - missing @example
- `src/Md.model.ts:960` `ListChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Md.model.ts:972` `ListChildren` (namespace) - missing @example
- `src/Md.model.ts:1016` `Ul` (namespace) - missing @example
- `src/Md.model.ts:1066` `Ol` (namespace) - missing @example
- `src/Md.model.ts:1121` `TaskItem` (namespace) - missing @example
- `src/Md.model.ts:1147` `TaskItemChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Md.model.ts:1159` `TaskItemChildren` (namespace) - missing @example
- `src/Md.model.ts:1203` `TaskList` (namespace) - missing @example
- `src/Md.model.ts:1253` `BlockQuote` (namespace) - missing @example
- `src/Md.model.ts:1320` `Pre` (namespace) - missing @example
- `src/Md.model.ts:1378` `TableCell` (namespace) - missing @example
- `src/Md.model.ts:1430` `TableRow` (namespace) - missing @example
- `src/Md.model.ts:1486` `Table` (namespace) - missing @example
- `src/Md.model.ts:1538` `YouTube` (namespace) - missing @example
- `src/Md.model.ts:1581` `Hr` (namespace) - missing @example
- `src/Md.model.ts:1626` `Block` (type) - missing @example
- `src/Md.model.ts:1634` `Block` (namespace) - missing @example
- `src/Md.model.ts:1698` `Document` (namespace) - missing @example

### @beep/semantic-web

Path: `packages/foundation/capability/semantic-web`

Export findings:
- `src/services/canonicalization.ts:50` `CanonicalizationAlgorithm` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/canonicalization.ts:72` `CanonicalizationErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/jsonld-context.ts:46` `JsonLdContextErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/jsonld-document.ts:48` `JsonLdDocumentErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/jsonld-stream-parse.ts:274` `JsonLdStreamParseErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/jsonld-stream-serialize.ts:124` `JsonLdStreamSerializeErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/provenance.ts:66` `ProvenanceExportProfile` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/provenance.ts:88` `ProvenanceServiceErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/shacl-validation.ts:49` `ShaclSeverity` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/shacl-validation.ts:245` `ShaclValidationErrorReason` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/sparql-query.ts:44` `SparqlQueryProfile` (const) - 1 schema annotation/type-alias gap(s)
- `src/services/sparql-query.ts:220` `SparqlQueryErrorReason` (const) - 1 schema annotation/type-alias gap(s)

### @beep/utils

Path: `packages/foundation/modeling/utils`

Export findings:
- `src/Array.ts:641` `emptyReadonly` (const) - missing @example
- `src/Errors.ts:163` `mapToError` (function) - missing summary; missing @example, @category, @since
- `src/Errors.ts:166` `mapToError` (function) - missing summary; missing @example, @category, @since
- `src/FileSystem.ts:386` `readdirSync` (function) - missing summary; missing @example, @category, @since
- `src/FileSystem.ts:390` `readdirSync` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:206` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:209` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:212` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:215` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:224` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:242` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:262` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:284` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:308` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:334` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Predicate.ts:335` `chainRefinements` (function) - missing summary; missing @example, @category, @since
- `src/Struct.ts:784` `DeepPartial` (type) - 1 category casing violation(s)

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Export findings:
- `src/agent-effectiveness.ts:105` `AgentEffectivenessStatus` (type) - missing @example
- `src/agent-effectiveness.ts:132` `AgentEffectivenessAnnotationValue` (type) - missing @example
- `src/agent-effectiveness.ts:916` `AgentEffectivenessDatasetKind` (type) - missing @example
- `src/agent-effectiveness.ts:1043` `AgentEffectivenessPromptRole` (type) - missing @example

### @beep/libpff

Path: `packages/drivers/libpff`

Export findings:
- `src/Libpff.pffexport.ts:57` `PffexportMode` (type) - missing @example
- `src/Libpff.pffexport.ts:84` `PffexportFormat` (type) - missing @example

### @beep/form

Path: `packages/foundation/ui-system/form`

Export findings:
- `src/fields/TimeField.tsx:35` `TimeFieldProps` (interface) - 1 unsafe example violation(s)

### @beep/identity

Path: `packages/foundation/modeling/identity`

Export findings:
- `src/Curie.ts:164` `expand` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:165` `expand` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:166` `expand` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:167` `expand` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:188` `contract` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:192` `contract` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:193` `contract` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:194` `contract` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:215` `expandPredicate` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:219` `expandPredicate` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:220` `expandPredicate` (function) - missing summary; missing @example, @category, @since
- `src/Curie.ts:224` `expandPredicate` (function) - missing summary; missing @example, @category, @since
- `src/Id.ts:1635` `make` (function) - missing summary; missing @example, @category, @since
- `src/Id.ts:1641` `make` (function) - missing summary; missing @example, @category, @since
- `src/Id.ts:113` `IdentityInterpolationError` (class) - 1 schema annotation/type-alias gap(s)
- `src/Id.ts:144` `IdentitySegmentCountError` (class) - 1 schema annotation/type-alias gap(s)
- `src/Id.ts:495` `IdentityString` (type) - 1 unsafe example violation(s)
- `src/Id.ts:512` `IdentitySymbol` (type) - 1 unsafe example violation(s)
- `src/Vocab.ts:31` `VocabShape` (type) - 1 unsafe example violation(s)
- `src/Vocab.ts:56` `VocabEntry` (class) - 1 schema annotation/type-alias gap(s)
- `src/Vocab.ts:436` `mergeVocab` (const) - 1 unsafe example violation(s)

### @beep/box

Path: `packages/drivers/box`

Export findings:
- `src/experimental/Box.schemas.ts:111` `BoxSdkError` (type) - missing @example
- `src/experimental/Box.schemas.ts:141` `BoxApiError` (type) - missing @example

### @beep/nlp-processing

Path: `packages/foundation/capability/nlp-processing`

Export findings:
- `src/Graph/AnnotatedTextGraph.ts:85` `AnnotatedNode` (type) - missing @example
- `src/Graph/GraphOperations/Types.ts:155` `ExecutionMetrics` (class) - 1 schema annotation/type-alias gap(s)
- `src/Tools/_schemas.ts:33` `AiPhoneticAlgorithmKit` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Tools/_schemas.ts:52` `AiPhoneticAlgorithm` (const) - missing @example

### @beep/professional-desktop

Path: `apps/professional-desktop`

Module findings:
- `src/runtime/Pglite.ts:1` (none) - missing summary; missing @since
- `src/transport/TauriIpcSocket.ts:1` (none) - missing summary; missing @since

Export findings:
- `src/chat/ChatFixtures.ts:15` `decodeWorkspaceId` (const) - missing summary; missing @example, @category, @since
- `src/chat/ChatFixtures.ts:17` `userDocument` (const) - missing summary; missing @example, @category, @since
- `src/chat/ChatFixtures.ts:20` `userParagraphDocument` (const) - missing summary; missing @example, @category, @since
- `src/chat/ChatOrchestrator.ts:52` `documentToPlainText` (const) - missing @example
- `src/chat/ChatOrchestrator.ts:359` `makeChatOperations` (const) - missing @example
- `src/chat/UsageRecordSink.ts:27` `UsageRecordSinkShape` (interface) - missing @example
- `src/chat/UsageRecordSink.ts:38` `UsageRecordSink` (class) - missing @example
- `src/chat/UsageRecordSink.ts:51` `makeInMemoryUsageRecordSink` (const) - missing @example
- `src/chat/UsageRecordSink.ts:72` `UsageRecordSinkInMemory` (const) - missing @example
- `src/chat/UsageRecordSink.ts:125` `UsageRecordSinkDrizzle` (const) - missing @example
- `src/chat/ui/StreamingBlocks.tsx:41` `boundedKey` (const) - missing @example, @category, @since
- `src/chat/ui/StreamingBlocks.tsx:52` `stableOccurrenceKeys` (const) - missing @example, @category, @since
- `src/chat/ui/StreamingBlocks.tsx:80` `blockRenderKey` (const) - missing summary; missing @example, @category, @since
- `src/runtime/Layer.ts:50` `ChatHandlersLayer` (type) - missing @example
- `src/runtime/Layer.ts:82` `RuntimeLive` (const) - missing @example
- `src/runtime/Layer.ts:97` `RuntimeTest` (const) - missing @example
- `src/runtime/Migrations.ts:269` `SidecarReadyMarker` (const) - missing @example
- `src/runtime/Observability.ts:97` `ObservabilityLive` (const) - missing @example
- `src/runtime/Pglite.ts:72` `ChatDbCompatibilityMarker` (const) - missing @example
- `src/runtime/Pglite.ts:112` `markCompatibleChatDbDataDir` (const) - missing @example
- `src/runtime/Pglite.ts:172` `ensureCompatibleChatDbDataDir` (const) - missing @example
- `src/runtime/Pglite.ts:252` `makeBundledPgliteLayer` (const) - missing @example
- `src/runtime/Pglite.ts:266` `PgliteDrizzleLive` (const) - missing @example

### @beep/firecrawl

Path: `packages/drivers/firecrawl`

Export findings:
- `src/Firecrawl.models.ts:436` `FirecrawlScrapeOptions` (const) - missing @example
- `src/Firecrawl.models.ts:462` `FirecrawlParseFile` (const) - missing @example
- `src/Firecrawl.models.ts:488` `FirecrawlParseOptions` (const) - missing @example

### @beep/ecfr

Path: `packages/drivers/ecfr`

Export findings:
- `src/Ecfr.service.ts:47` `EcfrShape` (interface) - 1 unsafe example violation(s)
- `src/_generated/Ecfr.generated.ts:22` `Agency` (class) - missing @example
- `src/_generated/Ecfr.generated.ts:52` `AgenciesResponse` (class) - missing @example
- `src/_generated/Ecfr.generated.ts:72` `Title` (class) - missing @example
- `src/_generated/Ecfr.generated.ts:105` `TitlesResponse` (class) - missing @example
- `src/_generated/Ecfr.generated.ts:122` `EcfrOperationDescriptor` (class) - missing @example
- `src/_generated/Ecfr.generated.ts:139` `listAgenciesOperation` (const) - missing @example
- `src/_generated/Ecfr.generated.ts:151` `listTitlesOperation` (const) - missing @example
- `src/_generated/Ecfr.generated.ts:163` `ECFR_OPERATIONS` (const) - missing @example

### @beep/nlp

Path: `packages/foundation/modeling/nlp`

Export findings:
- `src/Core/PatternBuilders.ts:87` `pos` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:88` `pos` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:113` `entity` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:114` `entity` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:139` `literal` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:140` `literal` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:162` `optionalPos` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:163` `optionalPos` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:188` `optionalEntity` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:189` `optionalEntity` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:214` `optionalLiteral` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternBuilders.ts:215` `optionalLiteral` (function) - missing summary; missing @example, @category, @since
- `src/Core/PatternParsers.ts:102` `BracketStringToPOSPatternElement` (const) - 1 schema annotation/type-alias gap(s)
- `src/Core/PatternParsers.ts:133` `BracketStringToEntityPatternElement` (const) - 1 schema annotation/type-alias gap(s)
- `src/Core/PatternParsers.ts:166` `BracketStringToLiteralPatternElement` (const) - 1 schema annotation/type-alias gap(s)
- `src/Core/Similarity.ts:48` `SimilarityMethod` (type) - missing @example
- `src/Core/Vectorization.ts:65` `BM25Norm` (type) - missing @example
- `src/Graph/Schema.ts:41` `TextNodeType` (const) - 1 schema annotation/type-alias gap(s)
- `src/Graph/Schema.ts:60` `TextEdgeRelation` (const) - 1 schema annotation/type-alias gap(s)
- `src/Handoff/Contract.ts:55` `ChunkId` (type) - missing @example
- `src/Handoff/Contract.ts:82` `MentionId` (type) - missing @example
- `src/Handoff/Contract.ts:109` `EntityId` (type) - missing @example
- `src/Handoff/Contract.ts:136` `RelationId` (type) - missing @example
- `src/Handoff/Contract.ts:151` `ChunkKind` (const) - 1 schema annotation/type-alias gap(s)
- `src/Handoff/Contract.ts:211` `Span` (type) - missing @example

### @beep/runpod

Path: `packages/drivers/runpod`

Export findings:
- `src/Runpod.config.ts:32` `RunpodConfigUrl` (const) - 1 schema annotation/type-alias gap(s)
- `src/Runpod.service.ts:186` `RunpodShape` (interface) - 1 unsafe example violation(s)

### @beep/repo-utils

Path: `packages/tooling/library/repo-utils`

Module findings:
- `src/TypeScript/index.ts:1` (jsdoc) - missing summary
- `src/TypeScript/models/index.ts:1` (jsdoc) - missing summary

Export findings:
- `src/JSDoc/JSDoc.ts:526` `StructuralJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:1173` `AccessModifierJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:1582` `DocumentationContentJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:2019` `TSDocSpecificJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:2148` `InlineJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:2441` `OrganizationalJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:2634` `EventDependencyJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:3380` `RemainingJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:3958` `ClosureSpecificJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:4361` `TypeDocSpecificJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:4454` `TypeScriptSpecificJSDoc` (const) - 1 schema annotation/type-alias gap(s)
- `src/JSDoc/JSDoc.ts:4502` `JSDocTag` (const) - 1 schema annotation/type-alias gap(s)
- `src/TSMorph/TSMorph.model.ts:428` `SymbolKind` (const) - 1 schema annotation/type-alias gap(s)
- `src/TSMorph/TSMorph.model.ts:455` `SymbolCategory` (const) - 1 schema annotation/type-alias gap(s)
- `src/TSMorph/TSMorph.model.ts:744` `TsMorphScopeMode` (const) - 1 schema annotation/type-alias gap(s)
- `src/TSMorph/TSMorph.model.ts:771` `TsMorphReferencePolicy` (const) - 1 schema annotation/type-alias gap(s)
- `src/TSMorph/TSMorph.model.ts:1976` `TsMorphDiagnosticCategory` (const) - 1 schema annotation/type-alias gap(s)
- `src/TSMorph/TSMorph.service.ts:278` `TSMorphServiceError` (const) - 1 schema annotation/type-alias gap(s)

### @beep/schema

Path: `packages/foundation/modeling/schema`

Export findings:
- `src/Age/Age.schema.ts:45` `Age` (type) - missing @example
- `src/Age/Age.schema.ts:45` `Schema` (type) - missing @example
- `src/ArrayOf.ts:40` `ArrayOfStrings` (type) - missing @example
- `src/ArrayOf.ts:69` `NonEmptyArrayOfStrings` (type) - missing @example
- `src/ArrayOf.ts:98` `ArrayOfNonEmptyStrings` (type) - missing @example
- `src/ArrayOf.ts:127` `NonEmptyArrayOfNonEmptyStrings` (type) - missing @example
- `src/ArrayOf.ts:156` `ArrayOfNumbers` (type) - missing @example
- `src/ArrayOf.ts:185` `NonEmptyArrayOfNumbers` (type) - missing @example
- `src/ArrayOf.ts:214` `ArrayOfInts` (type) - missing @example
- `src/ArrayOf.ts:243` `NonEmptyArrayOfInts` (type) - missing @example
- `src/BufferEncoding.ts:27` `BuffEncoding` (const) - 1 schema annotation/type-alias gap(s)
- `src/CardinalDirection/CardinalDirection.schema.ts:38` `CardinalDirection` (type) - missing @example
- `src/CardinalDirection/CardinalDirection.schema.ts:65` `CardinalDirectionAbbrev` (type) - missing @example
- `src/CardinalDirection/CardinalDirection.schema.ts:27` `Schema` (const) - 1 schema annotation/type-alias gap(s)
- `src/CardinalDirection/CardinalDirection.schema.ts:38` `Schema` (type) - missing @example
- `src/CardinalDirection/CardinalDirection.schema.ts:53` `Abbrev` (const) - 1 schema annotation/type-alias gap(s)
- `src/CardinalDirection/CardinalDirection.schema.ts:65` `Abbrev` (type) - missing @example
- `src/Color/Color.adjust.ts:108` `RgbaColorString` (type) - missing @example
- `src/Color/Color.adjust.ts:147` `ColorAmount` (type) - missing @example
- `src/Color/Color.adjust.ts:206` `MixColors` (type) - missing @example
- `src/Color/Color.adjust.ts:264` `Lighten` (type) - missing @example
- `src/Color/Color.adjust.ts:322` `Darken` (type) - missing @example
- `src/Color/Color.adjust.ts:380` `WithAlpha` (type) - missing @example
- `src/Color/Color.hex.ts:65` `hexToRgbValue` (const) - missing @example
- `src/Color/Color.hex.ts:94` `rgbToHexValue` (const) - missing @example
- `src/Color/Color.hex.ts:127` `HexColorInput` (type) - missing @example
- `src/Color/Color.hex.ts:160` `HexColor` (type) - missing @example
- `src/Color/Color.hex.ts:196` `NormalizeHexColor` (type) - missing @example
- `src/Color/Color.oklch.ts:68` `rgbToOklchValue` (const) - missing @example
- `src/Color/Color.oklch.ts:102` `oklchToRgbValue` (const) - missing @example
- `src/Color/Color.oklch.ts:153` `OklchCoordinate` (type) - missing @example
- `src/Color/Color.oklch.ts:184` `OklchLightness` (type) - missing @example
- `src/Color/Color.oklch.ts:215` `OklchChroma` (type) - missing @example
- `src/Color/Color.oklch.ts:246` `OklchHue` (type) - missing @example
- `src/Color/Color.rgb.ts:52` `RgbInputChannel` (type) - missing @example
- `src/Color/Color.rgb.ts:83` `RgbChannel` (type) - missing @example
- `src/Color/Color.scale.ts:157` `HexColorScale12` (type) - missing @example
- `src/Color/Color.scale.ts:225` `GenerateScale` (type) - missing @example
- `src/Color/Color.scale.ts:285` `GenerateNeutralScale` (type) - missing @example
- `src/Color/Color.scale.ts:361` `GenerateAlphaScale` (type) - missing @example
- `src/Color/Color.shared.ts:18` `$I` (const) - missing @example
- `src/Color/Color.shared.ts:27` `schemaIssueToError` (const) - missing @example
- `src/Color/Color.shared.ts:37` `RgbEncoded` (class) - missing @example
- `src/Color/Color.shared.ts:55` `OklchEncoded` (class) - missing @example
- `src/Color/Color.transforms.ts:22` `oklchToHexValue` (const) - missing @example
- `src/Color/Color.transforms.ts:30` `hexToOklchValue` (const) - missing @example
- `src/Color/Color.transforms.ts:66` `HexToRgb` (type) - missing @example
- `src/Color/Color.transforms.ts:99` `RgbToHex` (type) - missing @example
- `src/Color/Color.transforms.ts:132` `RgbToOklch` (type) - missing @example
- `src/Color/Color.transforms.ts:165` `OklchToRgb` (type) - missing @example
- `src/Color/Color.transforms.ts:201` `HexToOklch` (type) - missing @example
- `src/Color/Color.transforms.ts:234` `OklchToHex` (type) - missing @example
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:53` `CoepValue` (type) - missing @example
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:84` `CrossOriginEmbedderPolicyOption` (type) - missing @example
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:212` `CrossOriginEmbedderPolicyHeader` (type) - missing @example
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:133` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:212` `Header` (type) - missing @example
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:84` `Option` (type) - missing @example
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:52` `CoopValue` (type) - missing @example
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:84` `CrossOriginOpenerPolicyOption` (type) - missing @example
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:104` `CrossOriginOpenerPolicyResponseHeader` (class) - 1 example import violation(s)
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:194` `CrossOriginOpenerPolicyHeader` (type) - missing @example
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:134` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:194` `Header` (type) - missing @example
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:84` `Option` (type) - missing @example
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:104` `ResponseHeader` (class) - 1 example import violation(s)
- `src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts:51` `CorpValue` (type) - missing @example
- `src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts:82` `CrossOriginResourcePolicyOption` (type) - missing @example
- `src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts:191` `CrossOriginResourcePolicyHeader` (type) - missing @example
- `src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts:131` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts:191` `Header` (type) - missing @example
- `src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts:82` `Option` (type) - missing @example
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:74` `CryptoTxnHash` (type) - missing @example
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:108` `CryptoTxnHashRedacted` (type) - missing @example
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:74` `Schema` (type) - missing @example
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:108` `Redacted` (type) - missing @example
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:148` `CryptoWalletAddress` (type) - missing @example
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:180` `CryptoWalletAddressRedacted` (type) - missing @example
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:148` `Schema` (type) - missing @example
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:180` `Redacted` (type) - missing @example
- `src/Csp/Csp.schema.ts:549` `ReportURI` (const) - 1 schema annotation/type-alias gap(s)
- `src/Csp/Csp.schema.ts:876` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/Csp/Csp.schema.ts:708` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/Csv/Csv.schema.ts:337` `CsvText` (type) - missing @example
- `src/DomDragEvent/DomDragEvent.schema.ts:54` `DOMDragEvent` (type) - missing @example
- `src/DomDragEvent/DomDragEvent.schema.ts:54` `DomDragEvent` (type) - missing @example
- `src/DomDragEvent/DomDragEvent.schema.ts:54` `Schema` (type) - missing @example
- `src/DomEvent/DomEvent.schema.ts:54` `DOMEvent` (type) - missing @example
- `src/DomEvent/DomEvent.schema.ts:54` `DomEvent` (type) - missing @example
- `src/DomEvent/DomEvent.schema.ts:54` `Schema` (type) - missing @example
- `src/DomHtmlElement/DomHtmlElement.schema.ts:54` `DOMHtmlElement` (type) - missing @example
- `src/DomHtmlElement/DomHtmlElement.schema.ts:54` `DomHtmlElement` (type) - missing @example
- `src/DomHtmlElement/DomHtmlElement.schema.ts:54` `Schema` (type) - missing @example
- `src/DomMouseEvent/DomMouseEvent.schema.ts:54` `DOMMouseEvent` (type) - missing @example
- `src/DomMouseEvent/DomMouseEvent.schema.ts:54` `DomMouseEvent` (type) - missing @example
- `src/DomMouseEvent/DomMouseEvent.schema.ts:54` `Schema` (type) - missing @example
- `src/DomReactNode/DomReactNode.schema.ts:68` `DOMReactNode` (type) - missing @example
- `src/DomReactNode/DomReactNode.schema.ts:68` `DomReactNode` (type) - missing @example
- `src/DomReactNode/DomReactNode.schema.ts:68` `Schema` (type) - missing @example
- `src/Duration/Duration.input.ts:94` `DurationUnit` (type) - missing @example
- `src/Duration/Duration.input.ts:193` `DurationInput` (type) - missing @example
- `src/Duration/Duration.input.ts:250` `DurationFromInput` (type) - missing @example
- `src/Duration/Duration.input.ts:173` `Input` (const) - 1 schema annotation/type-alias gap(s)
- `src/Duration/Duration.input.ts:193` `Input` (type) - missing @example
- `src/EntitySchema/EntitySchema.persist.ts:452` `PersistDescriptorByValueStrategy` (type) - 1 unsafe example violation(s)
- `src/EntitySchema/EntitySchema.persist.ts:477` `EntityIdLike` (type) - 1 unsafe example violation(s)
- `src/EntitySchema/EntitySchema.persist.ts:529` `PersistDescriptorFor` (type) - 1 unsafe example violation(s)
- `src/EntitySchema/EntitySchema.persist.ts:551` `PersistDescriptorForInput` (type) - 1 unsafe example violation(s)
- `src/EntitySchema/EntitySchema.persist.ts:567` `PersistedFor` (type) - 1 unsafe example violation(s)
- `src/EntitySchema/EntitySchema.persist.ts:612` `CheckedPersistedFor` (type) - 1 unsafe example violation(s)
- `src/EntitySchema/EntitySchema.shape.ts:54` `EntityFieldInputError` (class) - missing @example
- `src/EntitySchema/EntitySchema.shape.ts:72` `EntitySchemaAttachmentError` (class) - missing @example
- `src/EntitySchema/EntitySchema.shape.ts:189` `EncodedFieldShape` (type) - missing @example
- `src/EntitySchema/EntitySchema.shared.ts:17` `$I` (const) - missing @example
- `src/EntitySchema/EntitySchema.shared.ts:26` `DefinitionAnnotationKey` (const) - missing @example
- `src/EthAmount/EthAmount.schema.ts:71` `EthAmount` (type) - missing @example
- `src/EthAmount/EthAmount.schema.ts:71` `Schema` (type) - missing @example
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:69` `EthereumValidatorPublicKey` (type) - missing @example
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:103` `EthereumValidatorPublicKeyRedacted` (type) - missing @example
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:69` `Schema` (type) - missing @example
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:103` `Redacted` (type) - missing @example
- `src/EvmAddress/EvmAddress.schema.ts:62` `EvmAddress` (type) - missing @example
- `src/EvmAddress/EvmAddress.schema.ts:94` `EvmAddressRedacted` (type) - missing @example
- `src/EvmAddress/EvmAddress.schema.ts:62` `Schema` (type) - missing @example
- `src/EvmAddress/EvmAddress.schema.ts:94` `Redacted` (type) - missing @example
- `src/ExpectCt/ExpectCt.schema.ts:76` `ExpectCTEnabled` (type) - missing @example
- `src/ExpectCt/ExpectCt.schema.ts:104` `ExpectCTOption` (type) - missing @example
- `src/ExpectCt/ExpectCt.schema.ts:268` `ExpectCTHeader` (type) - missing @example
- `src/ExpectCt/ExpectCt.schema.ts:209` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/ExpectCt/ExpectCt.schema.ts:268` `Header` (type) - missing @example
- `src/ExpectCt/ExpectCt.schema.ts:92` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/ExpectCt/ExpectCt.schema.ts:104` `Option` (type) - missing @example
- `src/FileDiff.schema.ts:180` `Info` (namespace) - missing @example
- `src/FilePath/FilePath.guards.ts:51` `HasNullByte` (type) - missing @example
- `src/FilePath/FilePath.guards.ts:90` `SupportedWindowsNamespace` (type) - missing @example
- `src/FilePath/FilePath.guards.ts:128` `UsesPosixSeparator` (type) - missing @example
- `src/FilePath/FilePath.guards.ts:166` `UsesWindowsSeparator` (type) - missing @example
- `src/FilePath/FilePath.guards.ts:204` `EndsWithSeparator` (type) - missing @example
- `src/FilePath/FilePath.roots.ts:54` `WindowsDriveRoot` (type) - missing @example
- `src/FilePath/FilePath.roots.ts:92` `WindowsUncRoot` (type) - missing @example
- `src/FilePath/FilePath.roots.ts:161` `HasLeafSegment` (type) - missing @example
- `src/FilePath/FilePath.schema.ts:50` `SupportedPathFamily` (type) - missing @example
- `src/FilePath/FilePath.schema.ts:159` `FilePath` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:48` `WindowsDotSegment` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:108` `ValidWindowsPlainPathSegment` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:149` `ValidWindowsRootSegment` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:181` `ValidWindowsPathSegment` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:212` `WindowsSegments` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:244` `ValidWindowsUncRest` (type) - missing @example
- `src/FilePath/FilePath.segments.ts:278` `ValidWindowsUncSegments` (type) - missing @example
- `src/FilePath/FilePath.shared.ts:20` `$I` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:29` `windowsDrivePrefixRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:37` `windowsDriveRootRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:45` `windowsUncPrefixRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:53` `windowsUncRootRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:61` `windowsSegmentWithoutSeparatorsRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:69` `windowsInvalidSegmentCharacterRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:77` `windowsInvalidTrailingSegmentRegExp` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:98` `splitNonEmpty` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:107` `usesUnsupportedWindowsNamespacePrefix` (const) - missing @example
- `src/FilePath/FilePath.shared.ts:119` `isWindowsDrivePrefix` (const) - missing @example
- `src/FilePath/FilePath.windows.ts:93` `WindowsDrivePath` (type) - missing @example
- `src/FilePath/FilePath.windows.ts:165` `WindowsUncPath` (type) - missing @example
- `src/FilePath/FilePath.windows.ts:249` `WindowsRelativePath` (type) - missing @example
- `src/Float16Array.ts:105` `Float16Arr` (type) - missing @example
- `src/Float16Array.ts:156` `Float16ArrayFromArray` (type) - missing @example
- `src/Float16Array.ts:164` `Float16ArrayFromArray` (namespace) - missing @example
- `src/Float32Array.ts:59` `Float32Arr` (type) - missing @example
- `src/Float32Array.ts:107` `Float32ArrayFromArray` (type) - missing @example
- `src/Float32Array.ts:115` `Float32ArrayFromArray` (namespace) - missing @example
- `src/Float64Array.ts:59` `Float64Arr` (type) - missing @example
- `src/Float64Array.ts:107` `Float64ArrayFromArray` (type) - missing @example
- `src/Float64Array.ts:115` `Float64ArrayFromArray` (namespace) - missing @example
- `src/Fn/Fn.schema.ts:473` `AnyFn` (type) - missing @example
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:79` `ForceHttpsRedirectEnabled` (type) - missing @example
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:107` `ForceHttpsRedirectOption` (type) - missing @example
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:238` `ForceHttpsRedirectHeader` (type) - missing @example
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:167` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:238` `Header` (type) - missing @example
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:95` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts:107` `Option` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:54` `FrameGuardMode` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:109` `FrameGuardAllowFrom` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:137` `FrameGuardOption` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:286` `FrameGuardHeader` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:210` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/FrameGuard/FrameGuard.schema.ts:286` `Header` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:54` `Mode` (type) - missing @example
- `src/FrameGuard/FrameGuard.schema.ts:125` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/FrameGuard/FrameGuard.schema.ts:137` `Option` (type) - missing @example
- `src/Glob/Glob.schema.ts:130` `Glob` (type) - missing @example
- `src/Graph/Graph.edge.ts:67` `Edge` (interface) - missing @example
- `src/Graph/Graph.encoded.ts:78` `EdgeIso` (type) - missing @example
- `src/Graph/Graph.encoded.ts:91` `GraphIso` (type) - missing @example
- `src/Graph/Graph.encoded.ts:109` `EdgeEncodedSchema` (interface) - missing @example
- `src/Graph/Graph.encoded.ts:126` `GraphEncodedSchema` (interface) - missing @example
- `src/Graph/Graph.primitives.ts:43` `NodeIndex` (type) - missing @example
- `src/Graph/Graph.primitives.ts:97` `EdgeIndex` (type) - missing @example
- `src/Graph/Graph.primitives.ts:148` `GraphKind` (type) - missing @example
- `src/Graph/Graph.rebuild.ts:60` `rebuildImmutableGraph` (const) - missing @example
- `src/Graph/Graph.rebuild.ts:103` `rebuildMutableGraph` (const) - missing @example
- `src/Graph/Graph.shared.ts:22` `$I` (const) - missing @example
- `src/Graph/Graph.shared.ts:31` `GraphKindValue` (const) - missing @example
- `src/Graph/Graph.shared.ts:43` `GraphKindValue` (type) - missing @example
- `src/Graph/Graph.shared.ts:52` `RawEdgeEncoded` (type) - missing @example
- `src/Graph/Graph.shared.ts:65` `RawGraphEncoded` (type) - missing @example
- `src/Graph/Graph.shared.ts:88` `makeInvalidGraphIssue` (const) - missing @example
- `src/Graph/Graph.shared.ts:98` `makeGraphConstructionIssue` (const) - missing @example
- `src/Graph/Graph.shared.ts:112` `sortRawNodeEntries` (const) - missing @example
- `src/Graph/Graph.shared.ts:127` `sortRawEdgeEntries` (const) - missing @example
- `src/Graph/Graph.shared.ts:138` `toRawEdgeEncoded` (const) - missing @example
- `src/Graph/Graph.shared.ts:151` `toRawGraphEncoded` (const) - missing @example
- `src/Graph/Graph.shared.ts:186` `formatGraph` (const) - missing @example
- `src/Graph/Graph.shared.ts:230` `makeGraphEquivalence` (const) - missing @example
- `src/Graph/Graph.shared.ts:307` `isImmutableGraphValue` (const) - missing @example
- `src/Graph/Graph.shared.ts:317` `isMutableGraphValue` (const) - missing @example
- `src/Graph/Graph.shared.ts:329` `trimGraphDescription` (const) - missing @example
- `src/Graph/Graph.transforms.ts:27` `DirectedGraph` (interface) - missing @example
- `src/Graph/Graph.transforms.ts:40` `UndirectedGraph` (interface) - missing @example
- `src/Graph/Graph.transforms.ts:53` `MutableDirectedGraph` (interface) - missing @example
- `src/Graph/Graph.transforms.ts:66` `MutableUndirectedGraph` (interface) - missing @example
- `src/Http/Http.headers.shared.ts:45` `ArrayOfStrOrStr` (type) - missing @example
- `src/Http/Http.headers.shared.ts:73` `StringOrUrl` (type) - missing @example
- `src/Http/Http.headers.shared.ts:102` `HeaderMaxAgeSeconds` (type) - missing @example
- `src/Http/Http.headers.shared.ts:148` `EncodedStrictURIFromStrOrURL` (type) - missing @example
- `src/Http/Http.headers.shared.ts:200` `ResponseHeader` (class) - 1 example import violation(s)
- `src/Http/Http.headers.shared.ts:265` `makeResponseHeaderOption` (const) - 1 example import violation(s)
- `src/HttpMethod/HttpMethod.schema.ts:105` `HttpMethod` (type) - missing @example
- `src/HttpMethod/HttpMethod.schema.ts:105` `Schema` (type) - missing @example
- `src/HttpProtocol/HttpProtocol.schema.ts:37` `HttpProtocol` (type) - missing @example
- `src/HttpProtocol/HttpProtocol.schema.ts:25` `Schema` (const) - 1 schema annotation/type-alias gap(s)
- `src/HttpProtocol/HttpProtocol.schema.ts:37` `Schema` (type) - missing @example
- `src/HttpStatus/HttpStatus.category.ts:54` `HttpStatusCategory` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:44` `BadRequest` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:86` `Unauthorized` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:117` `PaymentRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:153` `Forbidden` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:186` `NotFound` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:216` `MethodNotAllowed` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:246` `NotAcceptable` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:277` `ProxyAuthenticationRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:311` `RequestTimeout` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.core.ts:343` `Conflict` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:38` `MisdirectedRequest` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:70` `UnprocessableEntity` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:98` `Locked` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:128` `FailedDependency` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:158` `TooEarly` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:189` `UpgradeRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:222` `PreconditionRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:261` `TooManyRequests` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:292` `RequestHeaderFieldsTooLarge` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.extended.ts:323` `UnavailableForLegalReasons` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:42` `Gone` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:72` `LengthRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:102` `PreconditionFailed` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:136` `PayloadTooLarge` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:167` `UriTooLong` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:198` `UnsupportedMediaType` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:229` `RangeNotSatisfiable` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:259` `ExpectationFailed` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.resource.ts:289` `ImATeapot` (type) - missing @example
- `src/HttpStatus/HttpStatus.client-error.ts:110` `HttpStatus4XX` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.client-error.ts:126` `HttpStatus4XX` (type) - missing @example
- `src/HttpStatus/HttpStatus.informational.ts:44` `Continue` (type) - missing @example
- `src/HttpStatus/HttpStatus.informational.ts:74` `SwitchingProtocols` (type) - missing @example
- `src/HttpStatus/HttpStatus.informational.ts:105` `Processing` (type) - missing @example
- `src/HttpStatus/HttpStatus.informational.ts:135` `EarlyHints` (type) - missing @example
- `src/HttpStatus/HttpStatus.informational.ts:170` `HttpStatus1XX` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.informational.ts:186` `HttpStatus1XX` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:50` `MultipleChoices` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:80` `MovedPermanently` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:113` `Found` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:143` `SeeOther` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:175` `NotModified` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:205` `UseProxy` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:235` `SwitchProxy` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:268` `TemporaryRedirect` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:300` `PermanentRedirect` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:341` `HttpStatus3XX` (type) - missing @example
- `src/HttpStatus/HttpStatus.redirection.ts:349` `HttpStatus3XX` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.schema.ts:53` `HttpStatus` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.schema.ts:69` `HttpStatus` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.aggregate.ts:64` `HttpStatus5XX` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.server-error.aggregate.ts:80` `HttpStatus5XX` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:47` `InternalServerError` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:77` `NotImplemented` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:109` `BadGateway` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:141` `ServiceUnavailable` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:175` `GatewayTimeout` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:205` `HttpVersionNotSupported` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:238` `VariantAlsoNegotiates` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:268` `InsufficientStorage` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:297` `LoopDetected` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:327` `NotExtended` (type) - missing @example
- `src/HttpStatus/HttpStatus.server-error.ts:359` `NetworkAuthenticationRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.shared.ts:17` `$I` (const) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:43` `Ok` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:71` `Created` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:102` `Accepted` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:134` `NonAuthoritativeInformation` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:163` `NoContent` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:193` `ResetContent` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:225` `PartialContent` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:256` `MultiStatus` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:287` `AlreadyReported` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:318` `ImUsed` (type) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:358` `HttpStatus2XX` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.success.ts:374` `HttpStatus2XX` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.aggregate.ts:63` `HttpStatusUnofficial` (namespace) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.aggregate.ts:79` `HttpStatusUnofficial` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:44` `RequestHeaderFieldsTooLargeShopify` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:75` `LoginTimeout` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:105` `RequestHeaderTooLarge` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:135` `SslCertificateError` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:165` `SslCertificateRequired` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:195` `ClientClosedRequest` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:226` `WebServerReturnedAnUnknownError` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:257` `WebServerIsDown` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:287` `SslHandshakeFailed` (type) - missing @example
- `src/HttpStatus/HttpStatus.unofficial.ts:319` `InvalidSslCertificate` (type) - missing @example
- `src/Json.ts:39` `JsonObject` (type) - missing @example
- `src/Json.ts:68` `JsonArray` (type) - missing @example
- `src/Jsonc.ts:92` `JsoncTextToUnknown` (const) - 1 schema annotation/type-alias gap(s)
- `src/Jsonl.ts:104` `JsonlTextToUnknown` (const) - 1 schema annotation/type-alias gap(s)
- `src/LiteralKit/LiteralKit.schema.ts:745` `LiteralKit` (function) - missing summary; missing @example, @category, @since
- `src/LiteralKit/LiteralKit.schema.ts:749` `LiteralKit` (function) - missing summary; missing @example, @category, @since
- `src/LocalDate/LocalDate.schema.ts:692` `LocalDateFromString` (type) - 1 unsafe example violation(s)
- `src/LocalDate/LocalDate.schema.ts:708` `LocalDateFromString` (namespace) - 1 unsafe example violation(s)
- `src/Logs.ts:43` `LogLevel` (type) - missing @example
- `src/Logs.ts:74` `LogSeverity` (type) - missing @example
- `src/MappedLiteralKit/MappedLiteralKit.schema.ts:349` `MappedLiteralKit` (function) - 1 unsafe example violation(s)
- `src/MappedLiteralKit/MappedLiteralKit.schema.ts:318` `MappedLiteralKit` (interface) - 1 unsafe example violation(s)
- `src/Markdown.ts:140` `Markdown` (type) - missing @example
- `src/Model/Model.codecs.ts:28` `JsonFromString` (interface) - 1 example import violation(s)
- `src/Model/Model.codecs.ts:56` `JsonFromString` (const) - 1 example import violation(s)
- `src/Model/Model.datetime.ts:44` `Date` (const) - 1 example import violation(s); 2 schema annotation/type-alias gap(s)
- `src/Model/Model.datetime.ts:159` `DateTimeInsert` (const) - 1 example import violation(s)
- `src/Model/Model.datetime.ts:205` `DateTimeInsertFromDate` (const) - 1 example import violation(s)
- `src/Model/Model.datetime.ts:251` `DateTimeInsertFromNumber` (const) - 1 example import violation(s)
- `src/Model/Model.datetime.ts:299` `DateTimeUpdate` (const) - 1 example import violation(s)
- `src/Model/Model.datetime.ts:348` `DateTimeUpdateFromDate` (const) - 1 example import violation(s)
- `src/Model/Model.datetime.ts:397` `DateTimeUpdateFromNumber` (const) - 1 example import violation(s)
- `src/Model/Model.fields.ts:22` `Generated` (interface) - missing @example
- `src/Model/Model.fields.ts:62` `GeneratedByApp` (interface) - missing @example
- `src/Model/Model.fields.ts:102` `Sensitive` (interface) - missing @example
- `src/Model/Model.fields.ts:151` `optionalOption` (interface) - 1 example import violation(s)
- `src/Model/Model.fields.ts:169` `optionalOption` (const) - 1 example import violation(s)
- `src/Model/Model.fields.ts:201` `FieldOption` (interface) - 1 example import violation(s)
- `src/Model/Model.fields.ts:229` `FieldOption` (const) - 1 example import violation(s)
- `src/Model/Model.sqlite.ts:51` `BooleanSqlite` (const) - 1 example import violation(s)
- `src/Model/Model.uuid.ts:29` `UuidV4Insert` (interface) - 1 example import violation(s)
- `src/Model/Model.uuid.ts:96` `UuidV4Insert` (const) - 1 example import violation(s)
- `src/Model/Model.uuid.ts:71` `UuidV4WithGenerate` (const) - 1 example import violation(s)
- `src/Model/Model.variants.ts:15` `Class` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `extract` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `Field` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `FieldExcept` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `FieldOnly` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `fieldEvolve` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `Struct` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:15` `Union` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:331` `fields` (const) - 1 example import violation(s)
- `src/MutableHashMap.ts:101` `MutableHashMapFromSelf` (interface) - missing @example
- `src/MutableHashMap.ts:119` `MutableHashMap` (interface) - missing @example
- `src/MutableHashSet.ts:71` `MutableHashSetFromSelf` (interface) - missing @example
- `src/MutableHashSet.ts:88` `MutableHashSet` (interface) - missing @example
- `src/NoOpen/NoOpen.schema.ts:52` `NoOpenValue` (type) - missing @example
- `src/NoOpen/NoOpen.schema.ts:83` `NoOpenOption` (type) - missing @example
- `src/NoOpen/NoOpen.schema.ts:192` `NoOpenHeader` (type) - missing @example
- `src/NoOpen/NoOpen.schema.ts:192` `Header` (type) - missing @example
- `src/NoOpen/NoOpen.schema.ts:83` `Option` (type) - missing @example
- `src/NoOpen/NoOpen.schema.ts:52` `Value` (type) - missing @example
- `src/NoSniff/NoSniff.schema.ts:53` `NoSniffValue` (type) - missing @example
- `src/NoSniff/NoSniff.schema.ts:85` `NoSniffOption` (type) - missing @example
- `src/NoSniff/NoSniff.schema.ts:102` `NoSniffResponseHeader` (class) - 1 example import violation(s)
- `src/NoSniff/NoSniff.schema.ts:195` `NoSniffHeader` (type) - missing @example
- `src/NoSniff/NoSniff.schema.ts:130` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/NoSniff/NoSniff.schema.ts:195` `Header` (type) - missing @example
- `src/NoSniff/NoSniff.schema.ts:85` `Option` (type) - missing @example
- `src/NoSniff/NoSniff.schema.ts:102` `ResponseHeader` (class) - 1 example import violation(s)
- `src/NoSniff/NoSniff.schema.ts:53` `Value` (type) - missing @example
- `src/ParserOptions/ParserOptions.schema.ts:85` `HeaderValueInput` (type) - missing @example
- `src/ParserOptions/ParserOptions.types.ts:44` `HeaderArray` (type) - missing @example
- `src/ParserOptions/ParserOptions.types.ts:76` `HeaderTransformFunction` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:81` `PermissionsPolicyDirective` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:116` `PermissionsPolicyDirectiveKey` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:150` `QuotedOrigin` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:181` `PermissionsPolicyDirectiveValueSingle` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:209` `PermissionsPolicyAllowlistedOrigin` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:241` `PermissionsPolicyDirectiveValue` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:273` `PermissionsPolicyDirectives` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:326` `PermissionsPolicyOption` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:465` `PermissionsPolicyHeader` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:402` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:465` `Header` (type) - missing @example
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:314` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/PermissionsPolicy/PermissionsPolicy.schema.ts:326` `Option` (type) - missing @example
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:58` `PermittedCrossDomainPoliciesValue` (type) - missing @example
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:89` `PermittedCrossDomainPoliciesOption` (type) - missing @example
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:206` `PermittedCrossDomainPoliciesHeader` (type) - missing @example
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:138` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:206` `Header` (type) - missing @example
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:89` `Option` (type) - missing @example
- `src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts:58` `Value` (type) - missing @example
- `src/PosixPath.ts:71` `NativePathToPosixPath` (const) - 1 schema annotation/type-alias gap(s)
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:61` `ReferrerPolicyValue` (type) - missing @example
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:90` `ReferrerPolicyValueList` (type) - missing @example
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:118` `ReferrerPolicyOption` (type) - missing @example
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:254` `ReferrerPolicyHeader` (type) - missing @example
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:186` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:254` `Header` (type) - missing @example
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:106` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:118` `Option` (type) - missing @example
- `src/ReferrerPolicy/ReferrerPolicy.schema.ts:61` `Value` (type) - missing @example
- `src/SecureHeader/SecureHeader.schema.ts:55` `SecureHeader` (type) - missing @example
- `src/SecureHeader/SecureHeader.schema.ts:55` `Schema` (type) - missing @example
- `src/SecureHeaderError/SecureHeaderError.errors.ts:391` `SecureHeaderError` (type) - missing @example
- `src/SecureHeaderError/SecureHeaderError.errors.ts:391` `Error` (type) - missing @example
- `src/Sex/Sex.schema.ts:36` `Sex` (type) - missing @example
- `src/Sex/Sex.schema.ts:25` `Schema` (const) - 1 schema annotation/type-alias gap(s)
- `src/Sex/Sex.schema.ts:36` `Schema` (type) - missing @example
- `src/Slug.ts:96` `Slug` (type) - missing @example
- `src/Timestamp/Timestamp.schema.ts:130` `ToIsoStr` (const) - 1 schema annotation/type-alias gap(s)
- `src/Timestamp/Timestamp.schema.ts:176` `ToIsoStr` (namespace) - 1 unsafe example violation(s)
- `src/Timezone.ts:41` `Timezone` (type) - missing @example
- `src/Toml.ts:95` `TomlTextToUnknown` (const) - 1 schema annotation/type-alias gap(s)
- `src/Xml.ts:85` `XmlTextToUnknown` (const) - 1 schema annotation/type-alias gap(s)
- `src/XssProtection/XssProtection.schema.ts:53` `XSSProtectionMode` (type) - missing @example
- `src/XssProtection/XssProtection.schema.ts:108` `XSSProtectionReport` (type) - missing @example
- `src/XssProtection/XssProtection.schema.ts:136` `XSSProtectionOption` (type) - missing @example
- `src/XssProtection/XssProtection.schema.ts:270` `XSSProtectionHeader` (type) - missing @example
- `src/XssProtection/XssProtection.schema.ts:217` `Header` (const) - 1 schema annotation/type-alias gap(s)
- `src/XssProtection/XssProtection.schema.ts:270` `Header` (type) - missing @example
- `src/XssProtection/XssProtection.schema.ts:53` `Mode` (type) - missing @example
- `src/XssProtection/XssProtection.schema.ts:124` `Option` (const) - 1 schema annotation/type-alias gap(s)
- `src/XssProtection/XssProtection.schema.ts:136` `Option` (type) - missing @example
- `src/Yaml.ts:94` `YamlTextToUnknown` (const) - 1 schema annotation/type-alias gap(s)

### @beep/onepassword-cli

Path: `packages/drivers/onepassword-cli`

Export findings:
- `src/OnePasswordCli.models.ts:53` `OnePasswordReferenceProbeStatus` (type) - missing @example
- `src/OnePasswordCli.service.ts:49` `OnePasswordCliRunner` (type) - 1 unsafe example violation(s)

### @beep/govinfo

Path: `packages/drivers/govinfo`

Export findings:
- `src/Govinfo.service.ts:56` `GovinfoShape` (interface) - 1 unsafe example violation(s)
- `src/domain/contracts/Search/Search.contract.ts:228` `Failure` (namespace) - missing @example
- `src/domain/index.ts:16` `export * from "./contracts/index.ts";` (re-export) - 1 category casing violation(s)
- `src/domain/values/CollectionContainer/CollectionContainer.model.ts:92` `CollectionContainer` (namespace) - missing @example
- `src/domain/values/CollectionSummary/CollectionSummary.model.ts:74` `CollectionSummary` (namespace) - missing @example
- `src/domain/values/GranuleContainer/GranuleContainer.model.ts:104` `GranuleContainer` (namespace) - missing @example
- `src/domain/values/GranuleMetadata/GranuleMetadata.model.ts:89` `GranuleMetadata` (namespace) - missing @example
- `src/domain/values/PackageInfo/PackageInfo.model.ts:83` `PackageInfo` (namespace) - missing @example
- `src/domain/values/SearchBody/SearchBody.model.ts:75` `SearchBody` (namespace) - missing @example
- `src/domain/values/SearchResponse/SearchResponse.model.ts:75` `SearchResponse` (namespace) - missing @example
- `src/domain/values/SearchResult/SearchResult.model.ts:105` `SearchResult` (namespace) - missing @example
- `src/domain/values/Sort/Sort.model.ts:53` `SortBase` (namespace) - missing @example
- `src/domain/values/Sort/Sort.model.ts:112` `SortASC` (namespace) - missing @example
- `src/domain/values/Sort/Sort.model.ts:176` `SortDESC` (namespace) - missing @example
- `src/domain/values/Sort/Sort.model.ts:219` `Sort` (const) - 1 schema annotation/type-alias gap(s)
- `src/domain/values/Sort/Sort.model.ts:233` `Sort` (namespace) - missing @example
- `src/domain/values/SummaryItem/SummaryItem.model.ts:73` `SummaryItem` (namespace) - missing @example

### @beep/data

Path: `packages/foundation/primitive/data`

Export findings:
- `src/generated/cldr-territories.ts:17` `TerritoryDataMetadata` (const) - missing @example
- `src/generated/cldr-territories.ts:56` `TerritoryDataReleaseTag` (const) - missing @example
- `src/generated/cldr-territories.ts:64` `TerritoryDataValues` (const) - missing @example
- `src/generated/cldr-territories.ts:1621` `TerritoryDataByCode` (const) - missing @example
- `src/generated/cldr-territories.ts:3178` `TerritoryCodeValues` (const) - missing @example
- `src/generated/cldr-territories.ts:3445` `TerritoryDataNameByCode` (const) - missing @example
- `src/generated/cldr-territories.ts:3712` `TerritoryDataCodeNamePairs` (const) - missing @example
- `src/generated/cldr-territories.ts:4753` `ContinentDataValues` (const) - missing @example
- `src/generated/cldr-territories.ts:4782` `ContinentDataByCode` (const) - missing @example
- `src/generated/cldr-territories.ts:4811` `ContinentCodeValues` (const) - missing @example
- `src/generated/cldr-territories.ts:4825` `ContinentDataNameByCode` (const) - missing @example
- `src/generated/cldr-territories.ts:4839` `ContinentDataCodeNamePairs` (const) - missing @example
- `src/generated/iana-media-types.ts:18` `OfficialMimeTypeDataMetadata` (const) - missing @example
- `src/generated/iana-media-types.ts:30` `OfficialMimeTypeDataUpdated` (const) - missing @example
- `src/generated/iana-media-types.ts:38` `OfficialMimeTypeDataSourceUrl` (const) - missing @example
- `src/generated/iana-media-types.ts:46` `OfficialMimeTypeDataSourceSha256` (const) - missing @example
- `src/generated/iana-media-types.ts:54` `OfficialMimeTypeDataValues` (const) - missing @example
- `src/generated/iana-media-types.ts:14740` `OfficialMimeTypeDataByType` (const) - missing @example
- `src/generated/iana-media-types.ts:29426` `OfficialMimeTypeDataTypeValues` (const) - missing @example
- `src/generated/iana-media-types.ts:31737` `OfficialMimeTypeDataByTopLevel` (const) - missing @example
- `src/generated/iana-timezones.ts:18` `TimezoneDataMetadata` (const) - missing @example
- `src/generated/iana-timezones.ts:30` `TimezoneDataVersion` (const) - missing @example
- `src/generated/iana-timezones.ts:38` `TimezoneDataSourceUrl` (const) - missing @example
- `src/generated/iana-timezones.ts:46` `TimezoneDataSourceSha256` (const) - missing @example
- `src/generated/iana-timezones.ts:54` `TimezoneDataValues` (const) - missing @example
- `src/generated/iana-timezones.ts:1857` `TimezoneDataByName` (const) - missing @example
- `src/generated/iana-timezones.ts:3660` `TimezoneNameValues` (const) - missing @example
- `src/generated/iso4217.ts:18` `CurrencyCodeDataMetadata` (const) - missing @example
- `src/generated/iso4217.ts:30` `CurrencyCodeDataPublished` (const) - missing @example
- `src/generated/iso4217.ts:38` `CurrencyCodeDataSourceUrl` (const) - missing @example
- `src/generated/iso4217.ts:46` `CurrencyCodeDataSourceSha256` (const) - missing @example
- `src/generated/iso4217.ts:54` `CurrencyCodeDataValues` (const) - missing @example
- `src/generated/iso4217.ts:1764` `CurrencyCodeDataByCode` (const) - missing @example
- `src/generated/iso4217.ts:3474` `CurrencyCodeDataCodeValues` (const) - missing @example
- `src/generated/iso4217.ts:3661` `CurrencyCodeDataNameByCode` (const) - missing @example
- `src/generated/iso4217.ts:3848` `CurrencyCodeDataCodeNamePairs` (const) - missing @example

### @beep/ffmpeg

Path: `packages/drivers/ffmpeg`

Export findings:
- `src/FFmpeg.models.ts:74` `PositiveFrameRate` (type) - 1 unsafe example violation(s)
- `src/FFmpeg.models.ts:134` `PositiveMilliseconds` (type) - 1 unsafe example violation(s)
- `src/FFmpeg.models.ts:194` `SafeFramePrefix` (type) - 1 unsafe example violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Export findings:
- `src/Chat.atoms.ts:408` `StreamingTurn` (class) - 1 schema annotation/type-alias gap(s)
- `src/Chat.atoms.ts:519` `EditTarget` (class) - 1 schema annotation/type-alias gap(s)
- `src/Chat.atoms.ts:689` `TurnRequest` (const) - 1 schema annotation/type-alias gap(s)

### @beep/uspto-mcp

Path: `packages/drivers/uspto-mcp`

Export findings:
- `src/UsptoDocumentTiers.ts:132` `DocumentsProjectionOutput` (const) - missing @example
- `src/UsptoDocumentTiers.ts:148` `DocumentsProjectionOutput` (type) - missing @example
- `src/UsptoHandlers.ts:86` `UsptoToolkitHandlersLive` (const) - missing @example
- `src/UsptoTools.ts:65` `UsptoToolErrorReason` (type) - missing @example
- `src/UsptoTools.ts:138` `UsptoMcpFailure` (type) - missing @example
- `src/UsptoTools.ts:146` `UsptoSearchApplicationsParams` (class) - missing @example
- `src/UsptoTools.ts:167` `UsptoSearchApplicationsTool` (const) - missing @example
- `src/UsptoTools.ts:222` `UsptoGetDocumentsTool` (const) - missing @example
- `src/UsptoTools.ts:241` `UsptoToolkit` (const) - missing @example
- `src/UsptoTools.ts:249` `UsptoToolkit` (type) - missing @example

### @beep/observability

Path: `packages/foundation/capability/observability`

Module findings:
- `src/experimental/server/index.ts:1` (jsdoc) - missing summary
- `src/server/index.ts:1` (jsdoc) - missing summary
- `src/web/index.ts:1` (jsdoc) - missing summary

Export findings:
- `src/CauseRedaction.ts:358` `redactCauseSummary` (const) - missing @example
- `src/Logging.ts:206` `RenderLogBannerOptions` (class) - missing @example
- `src/Metric.ts:39` `TrackDurationOptions` (class) - missing @example
- `src/Metric.ts:56` `TrackDurationOptionsInput` (type) - missing @example
- `src/server/DevTools.ts:48` `DevToolsSpanFilter` (type) - missing @example
- `src/server/DevTools.ts:56` `LayerFilteredDevToolsOptions` (class) - missing @example
- `src/server/ErrorReporting.ts:27` `ConsoleErrorReporterOptions` (class) - missing @example
- `src/server/ErrorReporting.ts:44` `ErrorReporterLayerOptions` (class) - missing @example
- `src/server/HttpApiTelemetry.ts:31` `HttpStatusCode` (const) - missing @example
- `src/server/HttpApiTelemetry.ts:44` `HttpStatusCode` (type) - missing @example
- `src/server/NodeSdk.ts:115` `NodeSdkServerOptionsInput` (type) - missing @example

### @beep/html

Path: `packages/foundation/modeling/html`

Export findings:
- `src/Html.attributes.ts:37` `Dir` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:46` `Translate` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:55` `ContentEditable` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:64` `Draggable` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:73` `SpellCheck` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:82` `WritingSuggestions` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:91` `AutoCapitalize` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:100` `AutoCorrect` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:109` `InputMode` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:118` `EnterKeyHint` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:127` `Hidden` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:136` `Popover` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:145` `PopoverTargetAction` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:156` `BooleanAttribute` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:174` `StandardGlobalAttributes` (const) - missing @example
- `src/Html.attributes.ts:219` `DatasetAttribute` (const) - missing @example
- `src/Html.attributes.ts:286` `AriaAttributes` (const) - missing @example
- `src/Html.attributes.ts:375` `EventHandlerAttributes` (const) - missing @example
- `src/Html.attributes.ts:386` `GlobalAttributes` (const) - missing @example
- `src/Html.attributes.ts:401` `GlobalAttributesStruct` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.attributes.ts:411` `GlobalAttributesType` (type) - missing @example
- `src/Html.attributes.ts:419` `GlobalAttributesEncoded` (type) - missing @example
- `src/Html.meta.ts:68` `HtmlElementMeta` (const) - missing @example
- `src/Html.meta.ts:83` `HtmlElementMeta` (type) - missing @example
- `src/Html.meta.ts:91` `ELEMENT_META` (const) - missing @example
- `src/Html.model.ts:49` `HtmlChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Html.model.ts:58` `HtmlChildren` (namespace) - missing @example
- `src/Html.model.ts:71` `Fragment` (class) - missing @example
- `src/Html.model.ts:82` `Fragment` (namespace) - missing @example
- `src/Html.model.ts:95` `Document` (class) - missing @example
- `src/Html.model.ts:106` `Document` (namespace) - missing @example
- `src/Html.model.ts:119` `A` (class) - missing @example
- `src/Html.model.ts:167` `A` (namespace) - missing @example
- `src/Html.model.ts:249` `Abbr` (class) - missing @example
- `src/Html.model.ts:263` `Abbr` (namespace) - missing @example
- `src/Html.model.ts:282` `Acronym` (class) - missing @example
- `src/Html.model.ts:296` `Acronym` (namespace) - missing @example
- `src/Html.model.ts:315` `Address` (class) - missing @example
- `src/Html.model.ts:329` `Address` (namespace) - missing @example
- `src/Html.model.ts:348` `Applet` (class) - missing @example
- `src/Html.model.ts:362` `Applet` (namespace) - missing @example
- `src/Html.model.ts:381` `Area` (class) - missing @example
- `src/Html.model.ts:427` `Area` (namespace) - missing @example
- `src/Html.model.ts:501` `Article` (class) - missing @example
- `src/Html.model.ts:515` `Article` (namespace) - missing @example
- `src/Html.model.ts:534` `Aside` (class) - missing @example
- `src/Html.model.ts:548` `Aside` (namespace) - missing @example
- `src/Html.model.ts:567` `Audio` (class) - missing @example
- `src/Html.model.ts:591` `Audio` (namespace) - missing @example
- `src/Html.model.ts:626` `B` (class) - missing @example
- `src/Html.model.ts:640` `B` (namespace) - missing @example
- `src/Html.model.ts:659` `Base` (class) - missing @example
- `src/Html.model.ts:674` `Base` (namespace) - missing @example
- `src/Html.model.ts:695` `Basefont` (class) - missing @example
- `src/Html.model.ts:708` `Basefont` (namespace) - missing @example
- `src/Html.model.ts:725` `Bdi` (class) - missing @example
- `src/Html.model.ts:739` `Bdi` (namespace) - missing @example
- `src/Html.model.ts:758` `Bdo` (class) - missing @example
- `src/Html.model.ts:772` `Bdo` (namespace) - missing @example
- `src/Html.model.ts:791` `Bgsound` (class) - missing @example
- `src/Html.model.ts:804` `Bgsound` (namespace) - missing @example
- `src/Html.model.ts:821` `Big` (class) - missing @example
- `src/Html.model.ts:835` `Big` (namespace) - missing @example
- `src/Html.model.ts:854` `Blink` (class) - missing @example
- `src/Html.model.ts:868` `Blink` (namespace) - missing @example
- `src/Html.model.ts:887` `Blockquote` (class) - missing @example
- `src/Html.model.ts:902` `Blockquote` (namespace) - missing @example
- `src/Html.model.ts:923` `Body` (class) - missing @example
- `src/Html.model.ts:948` `Body` (namespace) - missing @example
- `src/Html.model.ts:989` `Br` (class) - missing @example
- `src/Html.model.ts:1003` `Br` (namespace) - missing @example
- `src/Html.model.ts:1022` `Button` (class) - missing @example
- `src/Html.model.ts:1123` `Button` (namespace) - missing @example
- `src/Html.model.ts:1307` `Canvas` (class) - missing @example
- `src/Html.model.ts:1323` `Canvas` (namespace) - missing @example
- `src/Html.model.ts:1346` `Caption` (class) - missing @example
- `src/Html.model.ts:1361` `Caption` (namespace) - missing @example
- `src/Html.model.ts:1382` `Center` (class) - missing @example
- `src/Html.model.ts:1396` `Center` (namespace) - missing @example
- `src/Html.model.ts:1415` `Cite` (class) - missing @example
- `src/Html.model.ts:1429` `Cite` (namespace) - missing @example
- `src/Html.model.ts:1448` `Code` (class) - missing @example
- `src/Html.model.ts:1462` `Code` (namespace) - missing @example
- `src/Html.model.ts:1481` `Col` (class) - missing @example
- `src/Html.model.ts:1500` `Col` (namespace) - missing @example
- `src/Html.model.ts:1529` `Colgroup` (class) - missing @example
- `src/Html.model.ts:1544` `Colgroup` (namespace) - missing @example
- `src/Html.model.ts:1565` `Data` (class) - missing @example
- `src/Html.model.ts:1580` `Data` (namespace) - missing @example
- `src/Html.model.ts:1601` `Datalist` (class) - missing @example
- `src/Html.model.ts:1615` `Datalist` (namespace) - missing @example
- `src/Html.model.ts:1634` `Dd` (class) - missing @example
- `src/Html.model.ts:1648` `Dd` (namespace) - missing @example
- `src/Html.model.ts:1667` `Del` (class) - missing @example
- `src/Html.model.ts:1683` `Del` (namespace) - missing @example
- `src/Html.model.ts:1706` `Details` (class) - missing @example
- `src/Html.model.ts:1722` `Details` (namespace) - missing @example
- `src/Html.model.ts:1745` `Dfn` (class) - missing @example
- `src/Html.model.ts:1759` `Dfn` (namespace) - missing @example
- `src/Html.model.ts:1778` `Dialog` (class) - missing @example
- `src/Html.model.ts:1794` `Dialog` (namespace) - missing @example
- `src/Html.model.ts:1817` `DirElement` (class) - missing @example
- `src/Html.model.ts:1831` `DirElement` (namespace) - missing @example
- `src/Html.model.ts:1850` `Div` (class) - missing @example
- `src/Html.model.ts:1865` `Div` (namespace) - missing @example
- `src/Html.model.ts:1886` `Dl` (class) - missing @example
- `src/Html.model.ts:1901` `Dl` (namespace) - missing @example
- `src/Html.model.ts:1922` `Dt` (class) - missing @example
- `src/Html.model.ts:1936` `Dt` (namespace) - missing @example
- `src/Html.model.ts:1955` `Em` (class) - missing @example
- `src/Html.model.ts:1969` `Em` (namespace) - missing @example
- `src/Html.model.ts:1988` `Embed` (class) - missing @example
- `src/Html.model.ts:2009` `Embed` (namespace) - missing @example
- `src/Html.model.ts:2042` `Fieldset` (class) - missing @example
- `src/Html.model.ts:2127` `Fieldset` (namespace) - missing @example
- `src/Html.model.ts:2283` `Figcaption` (class) - missing @example
- `src/Html.model.ts:2297` `Figcaption` (namespace) - missing @example
- `src/Html.model.ts:2316` `Figure` (class) - missing @example
- `src/Html.model.ts:2330` `Figure` (namespace) - missing @example
- `src/Html.model.ts:2349` `Font` (class) - missing @example
- `src/Html.model.ts:2363` `Font` (namespace) - missing @example
- `src/Html.model.ts:2382` `Footer` (class) - missing @example
- `src/Html.model.ts:2396` `Footer` (namespace) - missing @example
- `src/Html.model.ts:2415` `Form` (class) - missing @example
- `src/Html.model.ts:2459` `Form` (namespace) - missing @example
- `src/Html.model.ts:2520` `Frame` (class) - missing @example
- `src/Html.model.ts:2533` `Frame` (namespace) - missing @example
- `src/Html.model.ts:2550` `Frameset` (class) - missing @example
- `src/Html.model.ts:2564` `Frameset` (namespace) - missing @example
- `src/Html.model.ts:2583` `H1` (class) - missing @example
- `src/Html.model.ts:2598` `H1` (namespace) - missing @example
- `src/Html.model.ts:2619` `H2` (class) - missing @example
- `src/Html.model.ts:2634` `H2` (namespace) - missing @example
- `src/Html.model.ts:2655` `H3` (class) - missing @example
- `src/Html.model.ts:2670` `H3` (namespace) - missing @example
- `src/Html.model.ts:2691` `H4` (class) - missing @example
- `src/Html.model.ts:2706` `H4` (namespace) - missing @example
- `src/Html.model.ts:2727` `H5` (class) - missing @example
- `src/Html.model.ts:2742` `H5` (namespace) - missing @example
- `src/Html.model.ts:2763` `H6` (class) - missing @example
- `src/Html.model.ts:2778` `H6` (namespace) - missing @example
- `src/Html.model.ts:2799` `Head` (class) - missing @example
- `src/Html.model.ts:2814` `Head` (namespace) - missing @example
- `src/Html.model.ts:2835` `Header` (class) - missing @example
- `src/Html.model.ts:2849` `Header` (namespace) - missing @example
- `src/Html.model.ts:2868` `Hgroup` (class) - missing @example
- `src/Html.model.ts:2882` `Hgroup` (namespace) - missing @example
- `src/Html.model.ts:2901` `Hr` (class) - missing @example
- `src/Html.model.ts:2919` `Hr` (namespace) - missing @example
- `src/Html.model.ts:2946` `Html` (class) - missing @example
- `src/Html.model.ts:2962` `Html` (namespace) - missing @example
- `src/Html.model.ts:2985` `I` (class) - missing @example
- `src/Html.model.ts:2999` `I` (namespace) - missing @example
- `src/Html.model.ts:3018` `Iframe` (class) - missing @example
- `src/Html.model.ts:3068` `Iframe` (namespace) - missing @example
- `src/Html.model.ts:3154` `Img` (class) - missing @example
- `src/Html.model.ts:3190` `Img` (namespace) - missing @example
- `src/Html.model.ts:3249` `Input` (class) - missing @example
- `src/Html.model.ts:3385` `Input` (namespace) - missing @example
- `src/Html.model.ts:3638` `Ins` (class) - missing @example
- `src/Html.model.ts:3654` `Ins` (namespace) - missing @example
- `src/Html.model.ts:3677` `Isindex` (class) - missing @example
- `src/Html.model.ts:3690` `Isindex` (namespace) - missing @example
- `src/Html.model.ts:3707` `Kbd` (class) - missing @example
- `src/Html.model.ts:3721` `Kbd` (namespace) - missing @example
- `src/Html.model.ts:3740` `Keygen` (class) - missing @example
- `src/Html.model.ts:3753` `Keygen` (namespace) - missing @example
- `src/Html.model.ts:3770` `Label` (class) - missing @example
- `src/Html.model.ts:3785` `Label` (namespace) - missing @example
- `src/Html.model.ts:3806` `Legend` (class) - missing @example
- `src/Html.model.ts:3821` `Legend` (namespace) - missing @example
- `src/Html.model.ts:3842` `Li` (class) - missing @example
- `src/Html.model.ts:3858` `Li` (namespace) - missing @example
- `src/Html.model.ts:3881` `Link` (class) - missing @example
- `src/Html.model.ts:3940` `Link` (namespace) - missing @example
- `src/Html.model.ts:4040` `Listing` (class) - missing @example
- `src/Html.model.ts:4054` `Listing` (namespace) - missing @example
- `src/Html.model.ts:4073` `Main` (class) - missing @example
- `src/Html.model.ts:4087` `Main` (namespace) - missing @example
- `src/Html.model.ts:4106` `MapElement` (class) - missing @example
- `src/Html.model.ts:4121` `MapElement` (namespace) - missing @example
- `src/Html.model.ts:4142` `Mark` (class) - missing @example
- `src/Html.model.ts:4156` `Mark` (namespace) - missing @example
- `src/Html.model.ts:4175` `Marquee` (class) - missing @example
- `src/Html.model.ts:4193` `Marquee` (namespace) - missing @example
- `src/Html.model.ts:4220` `Menu` (class) - missing @example
- `src/Html.model.ts:4237` `Menu` (namespace) - missing @example
- `src/Html.model.ts:4262` `Menuitem` (class) - missing @example
- `src/Html.model.ts:4276` `Menuitem` (namespace) - missing @example
- `src/Html.model.ts:4295` `Meta` (class) - missing @example
- `src/Html.model.ts:4335` `Meta` (namespace) - missing @example
- `src/Html.model.ts:4396` `Meter` (class) - missing @example
- `src/Html.model.ts:4416` `Meter` (namespace) - missing @example
- `src/Html.model.ts:4447` `Multicol` (class) - missing @example
- `src/Html.model.ts:4461` `Multicol` (namespace) - missing @example
- `src/Html.model.ts:4480` `Nav` (class) - missing @example
- `src/Html.model.ts:4494` `Nav` (namespace) - missing @example
- `src/Html.model.ts:4513` `Nextid` (class) - missing @example
- `src/Html.model.ts:4526` `Nextid` (namespace) - missing @example
- `src/Html.model.ts:4543` `Nobr` (class) - missing @example
- `src/Html.model.ts:4557` `Nobr` (namespace) - missing @example
- `src/Html.model.ts:4576` `Noembed` (class) - missing @example
- `src/Html.model.ts:4590` `Noembed` (namespace) - missing @example
- `src/Html.model.ts:4609` `Noframes` (class) - missing @example
- `src/Html.model.ts:4623` `Noframes` (namespace) - missing @example
- `src/Html.model.ts:4642` `Noscript` (class) - missing @example
- `src/Html.model.ts:4656` `Noscript` (namespace) - missing @example
- `src/Html.model.ts:4675` `ObjectElement` (class) - missing @example
- `src/Html.model.ts:4777` `ObjectElement` (namespace) - missing @example
- `src/Html.model.ts:4967` `Ol` (class) - missing @example
- `src/Html.model.ts:4985` `Ol` (namespace) - missing @example
- `src/Html.model.ts:5012` `Optgroup` (class) - missing @example
- `src/Html.model.ts:5028` `Optgroup` (namespace) - missing @example
- `src/Html.model.ts:5051` `Option` (class) - missing @example
- `src/Html.model.ts:5070` `Option` (namespace) - missing @example
- `src/Html.model.ts:5099` `Output` (class) - missing @example
- `src/Html.model.ts:5185` `Output` (namespace) - missing @example
- `src/Html.model.ts:5343` `P` (class) - missing @example
- `src/Html.model.ts:5358` `P` (namespace) - missing @example
- `src/Html.model.ts:5379` `Param` (class) - missing @example
- `src/Html.model.ts:5392` `Param` (namespace) - missing @example
- `src/Html.model.ts:5409` `Picture` (class) - missing @example
- `src/Html.model.ts:5423` `Picture` (namespace) - missing @example
- `src/Html.model.ts:5442` `Plaintext` (class) - missing @example
- `src/Html.model.ts:5456` `Plaintext` (namespace) - missing @example
- `src/Html.model.ts:5475` `Pre` (class) - missing @example
- `src/Html.model.ts:5490` `Pre` (namespace) - missing @example
- `src/Html.model.ts:5511` `Progress` (class) - missing @example
- `src/Html.model.ts:5527` `Progress` (namespace) - missing @example
- `src/Html.model.ts:5550` `Q` (class) - missing @example
- `src/Html.model.ts:5565` `Q` (namespace) - missing @example
- `src/Html.model.ts:5586` `Rb` (class) - missing @example
- `src/Html.model.ts:5600` `Rb` (namespace) - missing @example
- `src/Html.model.ts:5619` `Rp` (class) - missing @example
- `src/Html.model.ts:5633` `Rp` (namespace) - missing @example
- `src/Html.model.ts:5652` `Rt` (class) - missing @example
- `src/Html.model.ts:5666` `Rt` (namespace) - missing @example
- `src/Html.model.ts:5685` `Rtc` (class) - missing @example
- `src/Html.model.ts:5699` `Rtc` (namespace) - missing @example
- `src/Html.model.ts:5718` `Ruby` (class) - missing @example
- `src/Html.model.ts:5732` `Ruby` (namespace) - missing @example
- `src/Html.model.ts:5751` `SElement` (class) - missing @example
- `src/Html.model.ts:5765` `SElement` (namespace) - missing @example
- `src/Html.model.ts:5784` `Samp` (class) - missing @example
- `src/Html.model.ts:5798` `Samp` (namespace) - missing @example
- `src/Html.model.ts:5817` `Script` (class) - missing @example
- `src/Html.model.ts:5847` `Script` (namespace) - missing @example
- `src/Html.model.ts:5894` `Search` (class) - missing @example
- `src/Html.model.ts:5908` `Search` (namespace) - missing @example
- `src/Html.model.ts:5927` `Section` (class) - missing @example
- `src/Html.model.ts:5941` `Section` (namespace) - missing @example
- `src/Html.model.ts:5960` `Select` (class) - missing @example
- `src/Html.model.ts:6048` `Select` (namespace) - missing @example
- `src/Html.model.ts:6210` `Selectedcontent` (class) - missing @example
- `src/Html.model.ts:6224` `Selectedcontent` (namespace) - missing @example
- `src/Html.model.ts:6243` `Slot` (class) - missing @example
- `src/Html.model.ts:6258` `Slot` (namespace) - missing @example
- `src/Html.model.ts:6279` `Small` (class) - missing @example
- `src/Html.model.ts:6293` `Small` (namespace) - missing @example
- `src/Html.model.ts:6312` `Source` (class) - missing @example
- `src/Html.model.ts:6332` `Source` (namespace) - missing @example
- `src/Html.model.ts:6363` `Spacer` (class) - missing @example
- `src/Html.model.ts:6376` `Spacer` (namespace) - missing @example
- `src/Html.model.ts:6393` `Span` (class) - missing @example
- `src/Html.model.ts:6407` `Span` (namespace) - missing @example
- `src/Html.model.ts:6426` `Strike` (class) - missing @example
- `src/Html.model.ts:6440` `Strike` (namespace) - missing @example
- `src/Html.model.ts:6459` `Strong` (class) - missing @example
- `src/Html.model.ts:6473` `Strong` (namespace) - missing @example
- `src/Html.model.ts:6492` `Style` (class) - missing @example
- `src/Html.model.ts:6509` `Style` (namespace) - missing @example
- `src/Html.model.ts:6534` `Sub` (class) - missing @example
- `src/Html.model.ts:6548` `Sub` (namespace) - missing @example
- `src/Html.model.ts:6567` `Summary` (class) - missing @example
- `src/Html.model.ts:6581` `Summary` (namespace) - missing @example
- `src/Html.model.ts:6600` `Sup` (class) - missing @example
- `src/Html.model.ts:6614` `Sup` (namespace) - missing @example
- `src/Html.model.ts:6633` `Table` (class) - missing @example
- `src/Html.model.ts:6659` `Table` (namespace) - missing @example
- `src/Html.model.ts:6702` `Tbody` (class) - missing @example
- `src/Html.model.ts:6721` `Tbody` (namespace) - missing @example
- `src/Html.model.ts:6750` `Td` (class) - missing @example
- `src/Html.model.ts:6778` `Td` (namespace) - missing @example
- `src/Html.model.ts:6825` `Template` (class) - missing @example
- `src/Html.model.ts:6851` `Template` (namespace) - missing @example
- `src/Html.model.ts:6882` `Textarea` (class) - missing @example
- `src/Html.model.ts:6976` `Textarea` (namespace) - missing @example
- `src/Html.model.ts:7150` `Tfoot` (class) - missing @example
- `src/Html.model.ts:7164` `Tfoot` (namespace) - missing @example
- `src/Html.model.ts:7183` `Th` (class) - missing @example
- `src/Html.model.ts:7213` `Th` (namespace) - missing @example
- `src/Html.model.ts:7260` `Thead` (class) - missing @example
- `src/Html.model.ts:7274` `Thead` (namespace) - missing @example
- `src/Html.model.ts:7293` `Time` (class) - missing @example
- `src/Html.model.ts:7308` `Time` (namespace) - missing @example
- `src/Html.model.ts:7329` `Title` (class) - missing @example
- `src/Html.model.ts:7343` `Title` (namespace) - missing @example
- `src/Html.model.ts:7362` `Tr` (class) - missing @example
- `src/Html.model.ts:7382` `Tr` (namespace) - missing @example
- `src/Html.model.ts:7413` `Track` (class) - missing @example
- `src/Html.model.ts:7433` `Track` (namespace) - missing @example
- `src/Html.model.ts:7460` `Tt` (class) - missing @example
- `src/Html.model.ts:7474` `Tt` (namespace) - missing @example
- `src/Html.model.ts:7493` `U` (class) - missing @example
- `src/Html.model.ts:7507` `U` (namespace) - missing @example
- `src/Html.model.ts:7526` `Ul` (class) - missing @example
- `src/Html.model.ts:7542` `Ul` (namespace) - missing @example
- `src/Html.model.ts:7565` `Var` (class) - missing @example
- `src/Html.model.ts:7579` `Var` (namespace) - missing @example
- `src/Html.model.ts:7598` `Video` (class) - missing @example
- `src/Html.model.ts:7626` `Video` (namespace) - missing @example
- `src/Html.model.ts:7669` `Wbr` (class) - missing @example
- `src/Html.model.ts:7682` `Wbr` (namespace) - missing @example
- `src/Html.model.ts:7699` `Xmp` (class) - missing @example
- `src/Html.model.ts:7713` `Xmp` (namespace) - missing @example
- `src/Html.model.ts:7733` `HtmlNode` (const) - missing @example
- `src/Html.model.ts:7892` `HtmlNode` (namespace) - missing @example
- `src/Html.model.ts:8200` `Metadata` (const) - missing @example
- `src/Html.model.ts:8219` `Flow` (const) - missing @example
- `src/Html.model.ts:8485` `Sectioning` (const) - missing @example
- `src/Html.model.ts:8497` `Heading` (const) - missing @example
- `src/Html.model.ts:8509` `Phrasing` (const) - missing @example
- `src/Html.model.ts:8682` `Embedded` (const) - missing @example
- `src/Html.model.ts:8710` `Interactive` (const) - missing @example
- `src/Html.model.ts:8763` `Palpable` (const) - missing @example
- `src/Html.model.ts:8993` `ScriptSupporting` (const) - missing @example
- `src/Html.nodes.ts:50` `Text` (namespace) - missing @example
- `src/Html.nodes.ts:66` `Comment` (class) - missing @example
- `src/Html.nodes.ts:82` `Comment` (namespace) - missing @example
- `src/Html.nodes.ts:98` `Doctype` (class) - missing @example
- `src/Html.nodes.ts:122` `Doctype` (namespace) - missing @example

### @beep/ui

Path: `packages/foundation/ui-system/ui`

Module findings:
- `src/components/accordion.tsx:1` (none) - missing summary; missing @since
- `src/components/alert-dialog.tsx:1` (none) - missing summary; missing @since
- `src/components/alert.tsx:1` (none) - missing summary; missing @since
- `src/components/aspect-ratio.tsx:1` (none) - missing summary; missing @since
- `src/components/attachment.tsx:1` (none) - missing summary; missing @since
- `src/components/avatar.tsx:1` (none) - missing summary; missing @since
- `src/components/badge.tsx:1` (none) - missing summary; missing @since
- `src/components/banner.tsx:1` (none) - missing summary; missing @since
- `src/components/blocks/editor-00/editor.tsx:1` (none) - missing summary; missing @since
- `src/components/blocks/editor-00/nodes.ts:1` (none) - missing summary; missing @since
- `src/components/blocks/editor-00/plugins.tsx:1` (none) - missing summary; missing @since
- `src/components/breadcrumb.tsx:1` (none) - missing summary; missing @since
- `src/components/bubble.tsx:1` (none) - missing summary; missing @since
- `src/components/button-group.tsx:1` (none) - missing summary; missing @since
- `src/components/button.tsx:1` (none) - missing summary; missing @since
- `src/components/calendar-event-card.tsx:1` (none) - missing summary; missing @since
- `src/components/calendar.tsx:1` (none) - missing summary; missing @since
- `src/components/card.tsx:1` (none) - missing summary; missing @since
- `src/components/carousel.tsx:1` (none) - missing summary; missing @since
- `src/components/chart.tsx:1` (none) - missing summary; missing @since
- `src/components/checkbox.tsx:1` (none) - missing summary; missing @since
- `src/components/collapsible.tsx:1` (none) - missing summary; missing @since
- `src/components/combobox.tsx:1` (none) - missing summary; missing @since
- `src/components/command.tsx:1` (none) - missing summary; missing @since
- `src/components/context-menu.tsx:1` (none) - missing summary; missing @since
- `src/components/conversation.tsx:1` (none) - missing summary; missing @since
- `src/components/date-picker.tsx:1` (none) - missing summary; missing @since
- `src/components/dialog.tsx:1` (none) - missing summary; missing @since
- `src/components/direction.tsx:1` (none) - missing summary; missing @since
- `src/components/drawer.tsx:1` (none) - missing summary; missing @since
- `src/components/dropdown-menu.tsx:1` (none) - missing summary; missing @since
- `src/components/editor/editor-ui/content-editable.tsx:1` (none) - missing summary; missing @since
- `src/components/editor/themes/editor-theme.ts:1` (none) - missing summary; missing @since
- `src/components/effect-date-time-picker.tsx:1` (none) - missing summary; missing @since
- `src/components/empty.tsx:1` (none) - missing summary; missing @since
- `src/components/field.tsx:1` (none) - missing summary; missing @since
- `src/components/hover-card.tsx:1` (none) - missing summary; missing @since
- `src/components/input-group.tsx:1` (none) - missing summary; missing @since
- `src/components/input-otp.tsx:1` (none) - missing summary; missing @since
- `src/components/input.tsx:1` (none) - missing summary; missing @since
- `src/components/item.tsx:1` (none) - missing summary; missing @since
- `src/components/kbd.tsx:1` (none) - missing summary; missing @since
- `src/components/knowledge-graph.tsx:1` (none) - missing summary; missing @since
- `src/components/label.tsx:1` (none) - missing summary; missing @since
- `src/components/link-preview.tsx:1` (none) - missing summary; missing @since
- `src/components/live-waveform.tsx:1` (none) - missing summary; missing @since
- `src/components/marker.tsx:1` (none) - missing summary; missing @since
- `src/components/menubar.tsx:1` (none) - missing summary; missing @since
- `src/components/message-scroller.tsx:1` (none) - missing summary; missing @since
- `src/components/message.tsx:1` (none) - missing summary; missing @since
- `src/components/native-select.tsx:1` (none) - missing summary; missing @since
- `src/components/navigation-menu.tsx:1` (none) - missing summary; missing @since
- `src/components/notification-card.tsx:1` (none) - missing summary; missing @since
- `src/components/orb-background.tsx:1` (none) - missing summary; missing @since
- `src/components/orb.tsx:1` (none) - missing summary; missing @since
- `src/components/pagination.tsx:1` (none) - missing summary; missing @since
- `src/components/popover.tsx:1` (none) - missing summary; missing @since
- `src/components/progress.tsx:1` (none) - missing summary; missing @since
- `src/components/radio-group.tsx:1` (none) - missing summary; missing @since
- `src/components/resizable.tsx:1` (none) - missing summary; missing @since
- `src/components/scroll-area.tsx:1` (none) - missing summary; missing @since
- `src/components/select.tsx:1` (none) - missing summary; missing @since
- `src/components/separator.tsx:1` (none) - missing summary; missing @since
- `src/components/sheet.tsx:1` (none) - missing summary; missing @since
- `src/components/sidebar.tsx:1` (none) - missing summary; missing @since
- `src/components/skeleton.tsx:1` (none) - missing summary; missing @since
- `src/components/slider.tsx:1` (none) - missing summary; missing @since
- `src/components/sonner.tsx:1` (none) - missing summary; missing @since
- `src/components/speech-input.tsx:1` (none) - missing summary; missing @since
- `src/components/spinner.tsx:1` (none) - missing summary; missing @since
- `src/components/switch.tsx:1` (none) - missing summary; missing @since
- `src/components/table-icons.tsx:1` (none) - missing summary; missing @since
- `src/components/table.tsx:1` (none) - missing summary; missing @since
- `src/components/tabs.tsx:1` (none) - missing summary; missing @since
- `src/components/textarea.tsx:1` (none) - missing summary; missing @since
- `src/components/toast.tsx:1` (none) - missing summary; missing @since
- `src/components/toaster.tsx:1` (none) - missing summary; missing @since
- `src/components/todo-item.tsx:1` (none) - missing summary; missing @since
- `src/components/toggle-group.tsx:1` (none) - missing summary; missing @since
- `src/components/toggle.tsx:1` (none) - missing summary; missing @since
- `src/components/toolbar.tsx:1` (none) - missing summary; missing @since
- `src/components/tooltip.tsx:1` (none) - missing summary; missing @since
- `src/components/tour.tsx:1` (none) - missing summary; missing @since
- `src/components/ui/tooltip.tsx:1` (none) - missing summary; missing @since
- `src/hooks/use-scribe.ts:1` (none) - missing summary; missing @since
- `src/hooks/useNumberInput.ts:1` (none) - missing summary; missing @since
- `src/hooks/useSpinner.ts:1` (none) - missing summary; missing @since
- `src/lib/index.ts:1` (jsdoc) - missing summary
- `src/themes/colors.ts:1` (none) - missing summary; missing @since
- `src/themes/components/alert.ts:1` (none) - missing summary; missing @since
- `src/themes/components/autocomplete.ts:1` (none) - missing summary; missing @since
- `src/themes/components/avatar.ts:1` (none) - missing summary; missing @since
- `src/themes/components/button.ts:1` (none) - missing summary; missing @since
- `src/themes/components/card.ts:1` (none) - missing summary; missing @since
- `src/themes/components/chip.ts:1` (none) - missing summary; missing @since
- `src/themes/components/controls.ts:1` (none) - missing summary; missing @since
- `src/themes/components/data-grid.ts:1` (none) - missing summary; missing @since
- `src/themes/components/date-picker.ts:1` (none) - missing summary; missing @since
- `src/themes/components/dialog.ts:1` (none) - missing summary; missing @since
- `src/themes/components/layout.ts:1` (none) - missing summary; missing @since
- `src/themes/components/link.ts:1` (none) - missing summary; missing @since
- `src/themes/components/list.ts:1` (none) - missing summary; missing @since
- `src/themes/components/menu.ts:1` (none) - missing summary; missing @since
- `src/themes/components/progress.ts:1` (none) - missing summary; missing @since
- `src/themes/components/select.ts:1` (none) - missing summary; missing @since
- `src/themes/components/svg-icon.ts:1` (none) - missing summary; missing @since
- `src/themes/components/table.ts:1` (none) - missing summary; missing @since
- `src/themes/components/text-field.ts:1` (none) - missing summary; missing @since
- `src/themes/components/tree-view.ts:1` (none) - missing summary; missing @since
- `src/themes/shadows.ts:1` (none) - missing summary; missing @since
- `src/themes/theme-init-script.tsx:1` (none) - missing summary; missing @since
- `src/themes/theme.ts:1` (none) - missing summary; missing @since
- `src/themes/types.ts:1` (none) - missing summary; missing @since
- `src/themes/typography.ts:1` (none) - missing summary; missing @since

Export findings:
- `src/components/banner.tsx:208` `Banner` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/banner.tsx:209` `Banner` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/banner.tsx:210` `Banner` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/banner.tsx:211` `Banner` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/conversation.tsx:24` `ConversationProps` (type) - 1 unsafe example violation(s)
- `src/components/conversation.tsx:63` `ConversationContentProps` (type) - 1 unsafe example violation(s)
- `src/components/conversation.tsx:96` `ConversationEmptyStateProps` (type) - 1 unsafe example violation(s)
- `src/components/conversation.tsx:153` `ConversationScrollButtonProps` (type) - 1 unsafe example violation(s)
- `src/components/country-select.tsx:301` `CountryCode` (const) - missing summary; missing @example, @category, @since
- `src/components/country-select.tsx:493` `CountryOptionContentProps` (interface) - missing @example
- `src/components/dialog.tsx:253` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:254` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:255` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:256` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:257` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:258` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:259` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:260` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dialog.tsx:261` `Dialog` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:415` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:416` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:417` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:418` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:419` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:420` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:421` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:422` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:423` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:424` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:425` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:426` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:427` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/dropdown-menu.tsx:428` `DropdownMenu` (Identifier) - missing summary; missing @example, @category, @since
- `src/components/knowledge-graph.tsx:30` `GraphNode` (interface) - 1 unsafe example violation(s)
- `src/components/knowledge-graph.tsx:59` `GraphLink` (interface) - 1 unsafe example violation(s)
- `src/components/knowledge-graph.tsx:103` `KnowledgeGraphHandle` (interface) - 1 unsafe example violation(s)
- `src/components/live-waveform.tsx:23` `LiveWaveformProps` (type) - 1 unsafe example violation(s)
- `src/components/notification-card.tsx:35` `NotificationStatus` (type) - 1 unsafe example violation(s)
- `src/components/notification-card.tsx:70` `ActionType` (type) - 1 unsafe example violation(s)
- `src/components/notification-card.tsx:104` `ActionStyle` (type) - 1 unsafe example violation(s)
- `src/components/notification-card.tsx:178` `NotificationAction` (type) - 1 unsafe example violation(s)
- `src/components/orb.tsx:27` `AgentState` (type) - 1 unsafe example violation(s)
- `src/components/toast.tsx:120` `ToastVariant` (type) - 1 unsafe example violation(s)
- `src/components/toast.tsx:303` `ToastActionElement` (type) - 1 unsafe example violation(s)
- `src/components/toast.tsx:287` `ToastProps` (type) - 1 unsafe example violation(s)
- `src/components/tour.tsx:187` `Step` (interface) - 1 unsafe example violation(s)
- `src/components/tour.tsx:216` `Tour` (interface) - 1 unsafe example violation(s)
- `src/hooks/use-scribe.ts:66` `ScribeStatus` (type) - 1 unsafe example violation(s)
- `src/hooks/useNumberInput.ts:503` `NumberInputEventType` (type) - missing @example
- `src/hooks/useNumberInput.ts:530` `NumberInputError` (type) - missing @example
- `src/themes/theme-provider.tsx:81` `ThemeMode` (type) - missing @example
- `src/themes/theme-provider.tsx:108` `ResolvedThemeMode` (type) - missing @example
- `src/themes/types.ts:17` `ThemeOptions` (type) - 1 unsafe example violation(s)
- `src/themes/types.ts:33` `ThemeComponents` (type) - 1 unsafe example violation(s)

### @beep/pandoc-ast

Path: `packages/foundation/modeling/pandoc-ast`

Export findings:
- `src/Pandoc.codec.ts:58` `PandocConstructorWire` (class) - missing @example
- `src/Pandoc.codec.ts:78` `PandocConstructorWire` (namespace) - missing @example
- `src/Pandoc.codec.ts:131` `PandocJsonWire` (namespace) - missing @example
- `src/Pandoc.codec.ts:153` `PandocJsonFromString` (const) - missing @example
- `src/Pandoc.codec.ts:165` `PandocJsonFromString` (type) - missing @example
- `src/Pandoc.mapping.ts:869` `PandocToDocumentResult` (class) - missing @example
- `src/Pandoc.mapping.ts:889` `PandocToDocumentResult` (namespace) - missing @example
- `src/Pandoc.mapping.ts:913` `DocumentToPandocResult` (class) - missing @example
- `src/Pandoc.mapping.ts:933` `DocumentToPandocResult` (namespace) - missing @example
- `src/Pandoc.model.ts:50` `PandocApiVersion` (type) - missing @example
- `src/Pandoc.model.ts:58` `PandocKeyValue` (const) - missing @example
- `src/Pandoc.model.ts:70` `PandocKeyValue` (type) - missing @example
- `src/Pandoc.model.ts:113` `PandocAttr` (namespace) - missing @example
- `src/Pandoc.model.ts:163` `PandocTarget` (namespace) - missing @example
- `src/Pandoc.model.ts:203` `PandocMathType` (type) - missing @example
- `src/Pandoc.model.ts:238` `PandocListNumberStyle` (type) - missing @example
- `src/Pandoc.model.ts:265` `PandocListNumberDelimiter` (type) - missing @example
- `src/Pandoc.model.ts:273` `PandocInlineChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Pandoc.model.ts:287` `PandocInlineChildren` (namespace) - missing @example
- `src/Pandoc.model.ts:305` `PandocBlockChildren` (const) - missing @example; 1 schema annotation/type-alias gap(s)
- `src/Pandoc.model.ts:319` `PandocBlockChildren` (namespace) - missing @example
- `src/Pandoc.model.ts:337` `PandocListItem` (const) - missing @example
- `src/Pandoc.model.ts:351` `PandocListItem` (type) - missing @example
- `src/Pandoc.model.ts:359` `PandocListItems` (const) - missing @example
- `src/Pandoc.model.ts:371` `PandocListItems` (type) - missing @example
- `src/Pandoc.model.ts:379` `Str` (class) - missing @example
- `src/Pandoc.model.ts:397` `Str` (namespace) - missing @example
- `src/Pandoc.model.ts:418` `Space` (class) - missing @example
- `src/Pandoc.model.ts:432` `Space` (namespace) - missing @example
- `src/Pandoc.model.ts:452` `SoftBreak` (class) - missing @example
- `src/Pandoc.model.ts:466` `SoftBreak` (namespace) - missing @example
- `src/Pandoc.model.ts:486` `LineBreak` (class) - missing @example
- `src/Pandoc.model.ts:500` `LineBreak` (namespace) - missing @example
- `src/Pandoc.model.ts:520` `Emph` (class) - missing @example
- `src/Pandoc.model.ts:538` `Emph` (namespace) - missing @example
- `src/Pandoc.model.ts:562` `Strong` (class) - missing @example
- `src/Pandoc.model.ts:580` `Strong` (namespace) - missing @example
- `src/Pandoc.model.ts:604` `Strikeout` (class) - missing @example
- `src/Pandoc.model.ts:622` `Strikeout` (namespace) - missing @example
- `src/Pandoc.model.ts:646` `Code` (class) - missing @example
- `src/Pandoc.model.ts:667` `Code` (namespace) - missing @example
- `src/Pandoc.model.ts:693` `Link` (class) - missing @example
- `src/Pandoc.model.ts:717` `Link` (namespace) - missing @example
- `src/Pandoc.model.ts:745` `Image` (class) - missing @example
- `src/Pandoc.model.ts:769` `Image` (namespace) - missing @example
- `src/Pandoc.model.ts:797` `Span` (class) - missing @example
- `src/Pandoc.model.ts:818` `Span` (namespace) - missing @example
- `src/Pandoc.model.ts:844` `Note` (class) - missing @example
- `src/Pandoc.model.ts:862` `Note` (namespace) - missing @example
- `src/Pandoc.model.ts:886` `Math` (class) - missing @example
- `src/Pandoc.model.ts:907` `Math` (namespace) - missing @example
- `src/Pandoc.model.ts:929` `UnknownInline` (class) - missing @example
- `src/Pandoc.model.ts:950` `UnknownInline` (namespace) - missing @example
- `src/Pandoc.model.ts:972` `PandocInline` (const) - missing @example
- `src/Pandoc.model.ts:1001` `PandocInline` (type) - missing @example
- `src/Pandoc.model.ts:1009` `PandocInline` (namespace) - missing @example
- `src/Pandoc.model.ts:1055` `Plain` (class) - missing @example
- `src/Pandoc.model.ts:1073` `Plain` (namespace) - missing @example
- `src/Pandoc.model.ts:1097` `Para` (class) - missing @example
- `src/Pandoc.model.ts:1115` `Para` (namespace) - missing @example
- `src/Pandoc.model.ts:1139` `Header` (class) - missing @example
- `src/Pandoc.model.ts:1163` `Header` (namespace) - missing @example
- `src/Pandoc.model.ts:1191` `BlockQuote` (class) - missing @example
- `src/Pandoc.model.ts:1209` `BlockQuote` (namespace) - missing @example
- `src/Pandoc.model.ts:1233` `CodeBlock` (class) - missing @example
- `src/Pandoc.model.ts:1254` `CodeBlock` (namespace) - missing @example
- `src/Pandoc.model.ts:1280` `BulletList` (class) - missing @example
- `src/Pandoc.model.ts:1298` `BulletList` (namespace) - missing @example
- `src/Pandoc.model.ts:1319` `OrderedList` (class) - missing @example
- `src/Pandoc.model.ts:1346` `OrderedList` (namespace) - missing @example
- `src/Pandoc.model.ts:1370` `HorizontalRule` (class) - missing @example
- `src/Pandoc.model.ts:1384` `HorizontalRule` (namespace) - missing @example
- `src/Pandoc.model.ts:1404` `Div` (class) - missing @example
- `src/Pandoc.model.ts:1425` `Div` (namespace) - missing @example
- `src/Pandoc.model.ts:1451` `Table` (class) - missing @example
- `src/Pandoc.model.ts:1475` `Table` (namespace) - missing @example
- `src/Pandoc.model.ts:1503` `UnknownBlock` (class) - missing @example
- `src/Pandoc.model.ts:1524` `UnknownBlock` (namespace) - missing @example
- `src/Pandoc.model.ts:1546` `PandocBlock` (const) - missing @example
- `src/Pandoc.model.ts:1572` `PandocBlock` (type) - missing @example
- `src/Pandoc.model.ts:1580` `PandocBlock` (namespace) - missing @example
- `src/Pandoc.model.ts:1620` `PandocMeta` (const) - missing @example
- `src/Pandoc.model.ts:1632` `PandocMeta` (type) - missing @example
- `src/Pandoc.model.ts:1672` `PandocDocument` (namespace) - missing @example
- `src/Pandoc.report.ts:41` `PandocMappingDirection` (type) - missing @example
- `src/Pandoc.report.ts:68` `PandocMappingSeverity` (type) - missing @example
- `src/Pandoc.report.ts:95` `PandocMappingProfile` (type) - missing @example
- `src/Pandoc.report.ts:122` `JsonPathSegment` (type) - missing @example
- `src/Pandoc.report.ts:136` `JsonPath` (const) - missing @example
- `src/Pandoc.report.ts:151` `JsonPath` (type) - missing @example
- `src/Pandoc.report.ts:226` `PandocMappingIssue` (namespace) - missing @example
- `src/Pandoc.report.ts:299` `PandocCompatibilityReport` (namespace) - missing @example

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/internal.ts:19` `schemaIssueToError` (const) - missing @example
- `src/next/internal.ts:31` `isFunctionValue` (const) - missing @example
- `src/next/models/AllowedDevOrigin.schema.ts:59` `AllowedDevOrigin` (type) - 1 unsafe example violation(s)
- `src/next/models/ImageConfig.schema.ts:29` `LoaderValue` (const) - 1 schema annotation/type-alias gap(s)
- `src/next/security/index.ts:179` `SecureHeadersConfigInput` (type) - missing @example
