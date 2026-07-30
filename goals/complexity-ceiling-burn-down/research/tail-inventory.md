# Tail Inventory — functions above cognitive 15

Snapshot 2026-07-30 from the calibration scan (fallow 3.10.0, pre-backfill
tree). REFRESH IN P0 from `bun run fallow:health --format json` before
triage; line numbers drift. Verdict column filled during P0: `refactor` /
`override` / `ignore` (+ one-line justification), then executed in P1 waves.

| # | Cog | Cyc | Lines | Function | Location | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 94 | 35 | 207 | `scanSchemaFirstInventory` | `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:93` | |
| 2 | 74 | 32 | 206 | `runEffectImportRules` | `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:110` | |
| 3 | 73 | 40 | 178 | `runLintToolingSchemaFirst` | `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:219` | |
| 4 | 61 | 39 | 119 | `collectExportedDeclarationCandidates` | `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:400` | |
| 5 | 50 | 29 | 222 | `runTerseEffectRules` | `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:572` | |
| 6 | 49 | 50 | 281 | `root` | `packages/foundation/ui-system/ui/src/themes/components/button.ts:72` | |
| 7 | 47 | 17 | 130 | `validate` | `packages/foundation/capability/semantic-web/src/adapters/shacl-engine.ts:76` | |
| 8 | 46 | 28 | 163 | `animate` | `packages/foundation/ui-system/ui/src/components/live-waveform.tsx:339` | |
| 9 | 44 | 14 | 109 | `generateAnalysisReport` | `packages/tooling/tool/cli/src/commands/Docgen/Docgen.render.ts:251` | |
| 10 | 42 | 10 | 224 | `Scene` | `packages/foundation/ui-system/ui/src/components/orb.tsx:127` | |
| 11 | 39 | 5 | 464 | `LiveWaveform` | `packages/foundation/ui-system/ui/src/components/live-waveform.tsx:78` | |
| 12 | 36 | 19 | 72 | `collectCandidatesForSourceFile` | `packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.analysis.ts:771` | |
| 13 | 34 | 40 | 119 | `validateMonitorGuards` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:134` | |
| 14 | 33 | 16 | 59 | `collectOutlineEntries` | `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:589` | |
| 15 | 31 | 17 | 53 | `collectDualBindings` | `packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.analysis.ts:93` | |
| 16 | 29 | 30 | 178 | `root` | `packages/foundation/ui-system/ui/src/themes/components/chip.ts:32` | |
| 17 | 28 | 21 | 50 | `finalTopLevelPipeOpenIndex` | `packages/drivers/box/scripts/generate.ts:154` | |
| 18 | 28 | 18 | 76 | `schemaForUnion` | `packages/drivers/box/scripts/generate.ts:364` | |
| 19 | 28 | 11 | 49 | `<anonymous>` | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:336` | |
| 20 | 27 | 25 | 113 | `LinkPreview` | `packages/foundation/ui-system/ui/src/components/link-preview.tsx:288` | |
| 21 | 27 | 25 | 142 | `TodoItem` | `packages/foundation/ui-system/ui/src/components/todo-item.tsx:114` | |
| 22 | 25 | 15 | 92 | `runReflectionArtifactLint` | `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts:256` | |
| 23 | 25 | 14 | 81 | `collectManagerMethods` | `packages/drivers/box/scripts/generate.ts:817` | |
| 24 | 24 | 23 | 59 | `collectCandidateDiagnostics` | `packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.analysis.ts:460` | |
| 25 | 24 | 17 | 141 | `Sidebar` | `packages/foundation/ui-system/ui/src/components/sidebar.tsx:244` | |
| 26 | 24 | 17 | 95 | `reportInvariantDiagnostics` | `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:1490` | |
| 27 | 24 | 16 | 80 | `parseQuotedField` | `packages/foundation/modeling/schema/src/CsvParser/CsvParser.parser.ts:121` | |
| 28 | 23 | 14 | 22 | `isUnionMemberAnnotation` | `packages/drivers/acp/scripts/generate.ts:295` | |
| 29 | 23 | 11 | 93 | `exportRecordViolations` | `packages/tooling/tool/cli/src/commands/Lint/SchemaTopology.ts:160` | |
| 30 | 23 | 11 | 31 | `publishSteps` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:525` | |
| 31 | 23 | 2 | 151 | `SpeechInput` | `packages/foundation/ui-system/ui/src/components/speech-input.tsx:172` | |
| 32 | 22 | 28 | 80 | `<arrow>` | `packages/foundation/ui-system/ui/src/components/orb.tsx:223` | |
| 33 | 22 | 10 | 49 | `toRdf` | `packages/foundation/capability/semantic-web/src/adapters/jsonld-document.ts:822` | |
| 34 | 22 | 10 | 59 | `detectCycles` | `packages/tooling/library/repo-utils/src/Graph.ts:152` | |
| 35 | 21 | 11 | 115 | `planPackageReferenceSync` | `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:932` | |
| 36 | 21 | 10 | 42 | `visit` | `packages/tooling/library/repo-utils/src/FsUtils.ts:436` | |
| 37 | 20 | 29 | 53 | `formatViolationMessage` | `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:436` | |
| 38 | 20 | 25 | 66 | `<arrow>` | `packages/foundation/ui-system/ui/src/components/chart.tsx:325` | |
| 39 | 20 | 18 | 75 | `decodeStrideFaces` | `packages/drivers/face-detection/src/FaceDetection.service.ts:661` | |
| 40 | 19 | 14 | 59 | `<anonymous>` | `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:511` | |
| 41 | 19 | 14 | 72 | `runSkillsUpdate` | `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:890` | |
| 42 | 19 | 13 | 79 | `<anonymous>` | `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:586` | |
| 43 | 19 | 11 | 53 | `closureQuads` | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:542` | |
| 44 | 18 | 13 | 60 | `walk` | `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:148` | |
| 45 | 18 | 12 | 43 | `tokenizeLocal` | `packages/foundation/modeling/identity/src/PnLocal.ts:247` | |
| 46 | 17 | 18 | 116 | `root` | `packages/foundation/ui-system/ui/src/themes/components/controls.ts:193` | |
| 47 | 17 | 15 | 214 | `<anonymous>` | `packages/tooling/tool/cli/src/commands/Files/Files.service.ts:671` | |
| 48 | 17 | 14 | 148 | `makeForwarderRunProgram` | `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1525` | |
| 49 | 17 | 10 | 54 | `scanComponent` | `packages/foundation/modeling/rdf/src/Iri.ts:225` | |
| 50 | 17 | 9 | 72 | `parseRowAt` | `packages/foundation/modeling/schema/src/CsvParser/CsvParser.parser.ts:276` | |
| 51 | 16 | 17 | 123 | `preprocessImage` | `packages/drivers/face-detection/src/FaceDetection.service.ts:423` | |
| 52 | 16 | 14 | 75 | `schemaForType` | `packages/drivers/box/scripts/generate.ts:441` | |
| 53 | 16 | 14 | 58 | `<anonymous>` | `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:685` | |
| 54 | 16 | 14 | 132 | `aggregateGeneratedDocs` | `packages/tooling/tool/cli/src/commands/Docgen/internal/Aggregate.ts:118` | |
| 55 | 16 | 13 | 32 | `<arrow>` | `packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts:296` | |
| 56 | 16 | 11 | 25 | `collectManagerProperties` | `packages/drivers/box/scripts/generate.ts:779` | |
| 57 | 16 | 11 | 210 | `buildOntologySnapshotFromPartitions` | `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:590` | |
| 58 | 16 | 10 | 91 | `CalendarEventCard` | `packages/foundation/ui-system/ui/src/components/calendar-event-card.tsx:89` | |
| 59 | 16 | 8 | 134 | `ChartTooltipContent` | `packages/foundation/ui-system/ui/src/components/chart.tsx:262` | |
| 60 | 16 | 8 | 39 | `handleBlur` | `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts:903` | |

Total: 60 functions. Family split: {"packages/tooling":28,"packages/foundation":22,"packages/drivers":8,"packages/ontology":2}
