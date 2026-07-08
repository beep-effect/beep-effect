# JSDoc Documentation Compliance Inventory

Generated: 2026-07-08T09:47:28.451Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: required export tags, summaries, TSDoc grammar, forbidden legacy tags, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 100 |
| cleanPackages | 87 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 10 |
| publicModules | 1618 |
| publicExports | 14516 |
| openModules | 120 |
| openExports | 88 |
| missingExportExamples | 78 |
| missingExportCategories | 8 |
| missingExportSince | 8 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 0 |
| unsafeExampleFindings | 3 |
| schemaAnnotationFindings | 9 |
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
| 2 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 3 | `@beep/agents-domain` | `packages/agents/domain` | clean | 12 | 48 | 0 | 0 |
| 4 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 2 | 22 | 0 | 1 |
| 5 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 6 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 7 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 8 | `@beep/pacer` | `packages/drivers/pacer` | clean | 13 | 89 | 0 | 0 |
| 9 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 16 | 34 | 0 | 0 |
| 10 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | clean | 8 | 56 | 0 | 0 |
| 11 | `@beep/law-practice-server` | `packages/law-practice/server` | clean | 2 | 3 | 0 | 0 |
| 12 | `@beep/db-admin` | `packages/_internal/db-admin` | clean | 7 | 13 | 0 | 0 |
| 13 | `@beep/shared-domain` | `packages/shared/domain` | clean | 40 | 225 | 0 | 0 |
| 14 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 15 | `@beep/face-detection` | `packages/drivers/face-detection` | clean | 4 | 33 | 0 | 0 |
| 16 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 7 | 0 | 0 |
| 17 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 101 | 678 | 0 | 54 |
| 18 | `@beep/pglite` | `packages/drivers/pglite` | clean | 4 | 11 | 0 | 0 |
| 19 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 83 | 0 | 0 |
| 20 | `@beep/agents-server` | `packages/agents/server` | clean | 7 | 27 | 0 | 0 |
| 21 | `@beep/courtlistener` | `packages/drivers/courtlistener` | clean | 1 | 1 | 0 | 0 |
| 22 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | clean | 8 | 25 | 0 | 0 |
| 23 | `@beep/editor` | `packages/foundation/ui-system/editor` | clean | 21 | 86 | 0 | 0 |
| 24 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | clean | 9 | 123 | 0 | 0 |
| 25 | `@beep/law-practice-domain` | `packages/law-practice/domain` | clean | 50 | 122 | 0 | 0 |
| 26 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | clean | 9 | 82 | 0 | 0 |
| 27 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | clean | 8 | 94 | 0 | 0 |
| 28 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | clean | 4 | 14 | 0 | 0 |
| 29 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | clean | 8 | 31 | 0 | 0 |
| 30 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 31 | `@beep/agents-use-cases` | `packages/agents/use-cases` | clean | 23 | 79 | 0 | 0 |
| 32 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | clean | 4 | 21 | 0 | 0 |
| 33 | `@beep/workspace-server` | `packages/workspace/server` | clean | 7 | 19 | 0 | 0 |
| 34 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 35 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 26 | 0 | 0 |
| 36 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 50 | 0 | 0 |
| 37 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | clean | 6 | 37 | 0 | 0 |
| 38 | `@beep/types` | `packages/foundation/primitive/types` | clean | 5 | 10 | 0 | 0 |
| 39 | `@beep/oip-web` | `apps/oip-web` | needs-remediation | 31 | 83 | 1 | 0 |
| 40 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 41 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | clean | 5 | 105 | 0 | 0 |
| 42 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 6 | 30 | 0 | 0 |
| 43 | `@beep/shared-tables` | `packages/shared/tables` | clean | 11 | 14 | 0 | 0 |
| 44 | `@beep/scratchpad` | `scratchpad` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 45 | `@beep/md` | `packages/foundation/modeling/md` | clean | 6 | 175 | 0 | 0 |
| 46 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | clean | 12 | 30 | 0 | 0 |
| 47 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 27 | 60 | 0 | 0 |
| 48 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 28 | 119 | 0 | 0 |
| 49 | `@beep/utils` | `packages/foundation/modeling/utils` | clean | 26 | 198 | 0 | 0 |
| 50 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | clean | 17 | 258 | 0 | 0 |
| 51 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 52 | `@beep/tika` | `packages/drivers/tika` | clean | 4 | 16 | 0 | 0 |
| 53 | `@beep/libpff` | `packages/drivers/libpff` | clean | 4 | 19 | 0 | 0 |
| 54 | `@beep/venice-ai` | `packages/drivers/venice-ai` | clean | 3 | 35 | 0 | 0 |
| 55 | `@beep/form` | `packages/foundation/ui-system/form` | clean | 42 | 114 | 0 | 0 |
| 56 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 6 | 155 | 0 | 3 |
| 57 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 4 | 17 | 0 | 0 |
| 58 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | clean | 2 | 8 | 0 | 0 |
| 59 | `@beep/box` | `packages/drivers/box` | clean | 103 | 4497 | 0 | 0 |
| 60 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 61 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | clean | 48 | 312 | 0 | 0 |
| 62 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 5 | 26 | 0 | 0 |
| 63 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 25 | 48 | 2 | 0 |
| 64 | `@beep/epistemic-domain` | `packages/epistemic/domain` | clean | 22 | 43 | 0 | 0 |
| 65 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 64 | 0 | 0 |
| 66 | `@beep/firecrawl` | `packages/drivers/firecrawl` | clean | 5 | 267 | 0 | 0 |
| 67 | `@beep/ecfr` | `packages/drivers/ecfr` | clean | 5 | 23 | 0 | 0 |
| 68 | `@beep/acp` | `packages/drivers/acp` | clean | 10 | 410 | 0 | 0 |
| 69 | `@beep/nlp` | `packages/foundation/modeling/nlp` | clean | 28 | 310 | 0 | 0 |
| 70 | `@beep/infra` | `infra` | clean | 5 | 34 | 0 | 0 |
| 71 | `@beep/runpod` | `packages/drivers/runpod` | clean | 6 | 179 | 0 | 0 |
| 72 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 63 | 666 | 0 | 12 |
| 73 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 241 | 1567 | 0 | 17 |
| 74 | `@beep/epistemic-server` | `packages/epistemic/server` | clean | 2 | 3 | 0 | 0 |
| 75 | `@beep/rdf` | `packages/foundation/modeling/rdf` | clean | 17 | 208 | 0 | 0 |
| 76 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 77 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 78 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 86 | 0 | 1 |
| 79 | `@beep/data` | `packages/foundation/primitive/data` | clean | 12 | 144 | 0 | 0 |
| 80 | `@beep/xai` | `packages/drivers/xai` | clean | 7 | 70 | 0 | 0 |
| 81 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 82 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 4 | 17 | 0 | 0 |
| 83 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 4 | 54 | 0 | 0 |
| 84 | `@beep/agents-client` | `packages/agents/client` | clean | 3 | 24 | 0 | 0 |
| 85 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | clean | 7 | 29 | 0 | 0 |
| 86 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 87 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | clean | 10 | 19 | 0 | 0 |
| 88 | `@beep/m365` | `packages/drivers/m365` | clean | 6 | 74 | 0 | 0 |
| 89 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 24 | 159 | 3 | 0 |
| 90 | `@beep/html` | `packages/foundation/modeling/html` | clean | 5 | 355 | 0 | 0 |
| 91 | `@beep/ui` | `packages/foundation/ui-system/ui` | needs-remediation | 132 | 551 | 114 | 0 |
| 92 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | clean | 5 | 121 | 0 | 0 |
| 93 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | clean | 25 | 139 | 0 | 0 |
| 94 | `@beep/wink` | `packages/drivers/wink` | clean | 14 | 71 | 0 | 0 |
| 95 | `@beep/postgres` | `packages/drivers/postgres` | clean | 7 | 36 | 0 | 0 |
| 96 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 52 | 0 | 0 |
| 97 | `@beep/provenance` | `packages/foundation/modeling/provenance` | clean | 2 | 4 | 0 | 0 |
| 98 | `@beep/epistemic-tables` | `packages/epistemic/tables` | clean | 6 | 12 | 0 | 0 |
| 99 | `@beep/federal-register` | `packages/drivers/federal-register` | clean | 1 | 1 | 0 | 0 |
| 100 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |

## Open Findings

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Export findings:
- `src/index.ts:11` `export * as Ontology from "./Ontology.models.ts";` (re-export) - 1 category casing violation(s)

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
- `src/commands/Corpus/Corpus.service.ts:155` `CorpusCommandServiceShape` (interface) - 1 unsafe example violation(s)
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

### @beep/oip-web

Path: `apps/oip-web`

Module findings:
- `src/components/MattersCarousel.tsx:1` (none) - missing summary; missing @since

### @beep/identity

Path: `packages/foundation/modeling/identity`

Export findings:
- `src/Id.ts:113` `IdentityInterpolationError` (class) - 1 schema annotation/type-alias gap(s)
- `src/Id.ts:145` `IdentitySegmentCountError` (class) - 1 schema annotation/type-alias gap(s)
- `src/Vocab.ts:56` `VocabEntry` (class) - 1 schema annotation/type-alias gap(s)

### @beep/professional-desktop

Path: `apps/professional-desktop`

Module findings:
- `src/runtime/Pglite.ts:1` (none) - missing summary; missing @since
- `src/transport/TauriIpcSocket.ts:1` (none) - missing summary; missing @since

### @beep/repo-utils

Path: `packages/tooling/library/repo-utils`

Export findings:
- `src/JSDoc/JSDoc.ts:558` `StructuralJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:1208` `AccessModifierJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:1617` `DocumentationContentJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:2063` `TSDocSpecificJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:2191` `InlineJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:2497` `OrganizationalJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:2693` `EventDependencyJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:3465` `RemainingJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:4046` `ClosureSpecificJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:4452` `TypeDocSpecificJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:4545` `TypeScriptSpecificJSDoc` (type) - missing @example
- `src/JSDoc/JSDoc.ts:4610` `JSDocTag` (type) - missing @example

### @beep/schema

Path: `packages/foundation/modeling/schema`

Export findings:
- `src/CardinalDirection/CardinalDirection.schema.ts:104` `Schema` (type) - missing @example
- `src/CardinalDirection/CardinalDirection.schema.ts:127` `Abbrev` (type) - missing @example
- `src/Duration/Duration.input.ts:303` `Input` (type) - missing @example
- `src/Http/Http.headers.shared.ts:45` `ArrayOfStrOrStr` (type) - missing @example
- `src/Http/Http.headers.shared.ts:73` `StringOrUrl` (type) - missing @example
- `src/Http/Http.headers.shared.ts:102` `HeaderMaxAgeSeconds` (type) - missing @example
- `src/Http/Http.headers.shared.ts:148` `EncodedStrictURIFromStrOrURL` (type) - missing @example
- `src/HttpProtocol/HttpProtocol.schema.ts:68` `Schema` (type) - missing @example
- `src/Model/Model.variants.ts:52` `Class` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:152` `extract` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:68` `Field` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:84` `FieldExcept` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:100` `FieldOnly` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:168` `fieldEvolve` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:116` `Struct` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Model/Model.variants.ts:135` `Union` (BindingElement) - missing summary; missing @example, @category, @since
- `src/Sex/Sex.schema.ts:67` `Schema` (type) - missing @example

### @beep/govinfo

Path: `packages/drivers/govinfo`

Export findings:
- `src/domain/index.ts:16` `export * from "./contracts/index.ts";` (re-export) - 1 category casing violation(s)

### @beep/observability

Path: `packages/foundation/capability/observability`

Module findings:
- `src/experimental/server/index.ts:1` (jsdoc) - missing summary
- `src/server/index.ts:1` (jsdoc) - missing summary
- `src/web/index.ts:1` (jsdoc) - missing summary

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
