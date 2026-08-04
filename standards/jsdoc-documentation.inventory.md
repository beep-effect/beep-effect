# JSDoc Documentation Compliance Inventory

Generated: 2026-08-04T12:13:58.294Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 134 |
| cleanPackages | 20 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 111 |
| publicModules | 2361 |
| publicExports | 15513 |
| openModules | 443 |
| openExports | 1379 |
| missingExportExamples | 0 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 0 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 22 |
| multiple-description-paragraphs | 1338 |
| leading-blank | 0 |
| trailing-blank | 1 |
| invalid-heading | 2 |
| section-out-of-order | 0 |
| duplicate-section | 0 |
| empty-section | 85 |
| section-after-example | 0 |
| invalid-when-to-use-prefix | 4 |
| malformed-example | 85 |
| duplicate-example | 0 |
| loose-ts-fence | 0 |
| forbidden-remarks | 467 |
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
| 1 | `@beep/dol` | `packages/drivers/dol` | needs-remediation | 1 | 1 | 1 | 1 |
| 2 | `@beep/protobuf` | `packages/drivers/protobuf` | clean | 1 | 1 | 0 | 0 |
| 3 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 4 | `@beep/agents-domain` | `packages/agents/domain` | needs-remediation | 16 | 74 | 0 | 7 |
| 5 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 10 | 105 | 5 | 13 |
| 6 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 7 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | needs-remediation | 3 | 7 | 2 | 1 |
| 8 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 9 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 89 | 12 | 6 |
| 10 | `@beep/workspace-tables` | `packages/workspace/tables` | needs-remediation | 19 | 42 | 0 | 3 |
| 11 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 9 | 61 | 8 | 7 |
| 12 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 13 | 59 | 1 | 25 |
| 13 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 11 | 30 | 3 | 2 |
| 14 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 41 | 243 | 3 | 14 |
| 15 | `@beep/discord` | `packages/drivers/discord` | needs-remediation | 4 | 15 | 0 | 6 |
| 16 | `@beep/face-detection` | `packages/drivers/face-detection` | needs-remediation | 4 | 33 | 1 | 2 |
| 17 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 38 | 6 | 0 |
| 18 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 214 | 2 | 6 |
| 19 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | needs-remediation | 3 | 7 | 3 | 3 |
| 20 | `@beep/dock` | `packages/foundation/ui-system/dock` | needs-remediation | 20 | 212 | 0 | 9 |
| 21 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 153 | 984 | 33 | 58 |
| 22 | `@beep/pglite` | `packages/drivers/pglite` | needs-remediation | 4 | 11 | 3 | 1 |
| 23 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 83 | 0 | 0 |
| 24 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 39 | 2 | 2 |
| 25 | `@beep/courtlistener` | `packages/drivers/courtlistener` | needs-remediation | 1 | 1 | 1 | 1 |
| 26 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 46 | 1 | 1 |
| 27 | `@beep/editor` | `packages/foundation/ui-system/editor` | needs-remediation | 25 | 145 | 13 | 13 |
| 28 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 14 |
| 29 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 148 | 372 | 9 | 103 |
| 30 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 9 | 82 | 0 | 6 |
| 31 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | needs-remediation | 9 | 112 | 1 | 13 |
| 32 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 19 | 1 | 1 |
| 33 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 7 | 44 | 4 | 19 |
| 34 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | needs-remediation | 3 | 12 | 0 | 2 |
| 35 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 9 | 32 | 1 | 0 |
| 36 | `@beep/ontology-server` | `packages/ontology/server` | needs-remediation | 8 | 24 | 0 | 4 |
| 37 | `@beep/colors` | `packages/foundation/capability/colors` | needs-remediation | 1 | 9 | 1 | 4 |
| 38 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 127 | 2 | 8 |
| 39 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 4 | 21 | 3 | 0 |
| 40 | `@beep/cosmos` | `packages/drivers/cosmos` | needs-remediation | 6 | 22 | 0 | 1 |
| 41 | `@beep/workspace-server` | `packages/workspace/server` | clean | 12 | 32 | 0 | 0 |
| 42 | `@beep/chalk` | `packages/foundation/capability/chalk` | needs-remediation | 1 | 35 | 1 | 18 |
| 43 | `@beep/epistemic-client` | `packages/epistemic/client` | needs-remediation | 4 | 25 | 0 | 6 |
| 44 | `@beep/uspto` | `packages/drivers/uspto` | needs-remediation | 5 | 26 | 0 | 2 |
| 45 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 50 | 0 | 0 |
| 46 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 30 |
| 47 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 10 | 25 | 1 | 11 |
| 48 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 6 | 35 | 1 | 6 |
| 49 | `@beep/types` | `packages/foundation/primitive/types` | needs-remediation | 5 | 12 | 1 | 4 |
| 50 | `@beep/oip-web` | `apps/oip-web` | needs-remediation | 31 | 83 | 0 | 5 |
| 51 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 52 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 6 |
| 53 | `@beep/agents-tables` | `packages/agents/tables` | needs-remediation | 6 | 14 | 0 | 2 |
| 54 | `@beep/ontology-domain` | `packages/ontology/domain` | needs-remediation | 6 | 41 | 1 | 1 |
| 55 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 5 | 119 | 4 | 7 |
| 56 | `@beep/langextract` | `packages/foundation/capability/langextract` | needs-remediation | 7 | 50 | 0 | 6 |
| 57 | `@beep/shared-tables` | `packages/shared/tables` | needs-remediation | 11 | 14 | 0 | 4 |
| 58 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 65 | 802 | 51 | 36 |
| 59 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 8 | 251 | 4 | 29 |
| 60 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | needs-remediation | 5 | 10 | 0 | 2 |
| 61 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 62 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 14 | 59 | 4 | 2 |
| 63 | `@beep/epistemic-ui` | `packages/epistemic/ui` | needs-remediation | 5 | 12 | 0 | 3 |
| 64 | `@beep/workspace-domain` | `packages/workspace/domain` | needs-remediation | 28 | 62 | 0 | 1 |
| 65 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 28 | 119 | 0 | 0 |
| 66 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 26 | 202 | 5 | 63 |
| 67 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 19 | 281 | 1 | 5 |
| 68 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 69 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 34 | 3 | 8 |
| 70 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 40 | 4 | 11 |
| 71 | `@beep/venice-ai` | `packages/drivers/venice-ai` | needs-remediation | 3 | 35 | 0 | 1 |
| 72 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 4 |
| 73 | `@beep/form` | `packages/foundation/ui-system/form` | needs-remediation | 42 | 114 | 10 | 17 |
| 74 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 6 | 204 | 2 | 24 |
| 75 | `@beep/drizzle` | `packages/drivers/drizzle` | needs-remediation | 4 | 17 | 1 | 9 |
| 76 | `@beep/ontology-ui` | `packages/ontology/ui` | needs-remediation | 15 | 28 | 0 | 1 |
| 77 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | needs-remediation | 3 | 10 | 2 | 6 |
| 78 | `@beep/box` | `packages/drivers/box` | needs-remediation | 103 | 676 | 0 | 46 |
| 79 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 80 | `@beep/shacl` | `packages/drivers/shacl` | needs-remediation | 3 | 6 | 0 | 1 |
| 81 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 103 | 4 | 6 |
| 82 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 312 | 13 | 96 |
| 83 | `@beep/anthropic` | `packages/drivers/anthropic` | needs-remediation | 5 | 29 | 0 | 13 |
| 84 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 54 | 176 | 25 | 22 |
| 85 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 53 | 240 | 8 | 14 |
| 86 | `@beep/ontology-client` | `packages/ontology/client` | needs-remediation | 3 | 89 | 0 | 2 |
| 87 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | needs-remediation | 18 | 64 | 0 | 8 |
| 88 | `@beep/firecrawl` | `packages/drivers/firecrawl` | clean | 5 | 267 | 0 | 0 |
| 89 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 5 | 69 | 2 | 0 |
| 90 | `@beep/oxigraph` | `packages/drivers/oxigraph` | needs-remediation | 3 | 6 | 0 | 1 |
| 91 | `@beep/acp` | `packages/drivers/acp` | clean | 10 | 410 | 0 | 0 |
| 92 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 310 | 9 | 37 |
| 93 | `@beep/infra` | `infra` | needs-remediation | 7 | 72 | 1 | 19 |
| 94 | `@beep/runpod` | `packages/drivers/runpod` | clean | 6 | 179 | 0 | 0 |
| 95 | `@beep/fc-runs` | `packages/tooling/test-kit/fc-runs` | needs-remediation | 2 | 5 | 2 | 3 |
| 96 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 63 | 675 | 18 | 54 |
| 97 | `@beep/documents-domain` | `packages/documents/domain` | needs-remediation | 24 | 96 | 0 | 1 |
| 98 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 259 | 1672 | 31 | 119 |
| 99 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 21 | 47 | 8 | 12 |
| 100 | `@beep/rdf` | `packages/foundation/modeling/rdf` | needs-remediation | 22 | 213 | 1 | 1 |
| 101 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 102 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 103 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 86 | 2 | 10 |
| 104 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 9 |
| 105 | `@beep/xai` | `packages/drivers/xai` | needs-remediation | 7 | 70 | 0 | 1 |
| 106 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 107 | `@beep/duckdb` | `packages/drivers/duckdb` | needs-remediation | 6 | 28 | 5 | 9 |
| 108 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | needs-remediation | 5 | 111 | 0 | 13 |
| 109 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 3 |
| 110 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 16 |
| 111 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 30 | 7 | 1 |
| 112 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 113 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 21 | 3 | 2 |
| 114 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 28 | 126 | 9 | 22 |
| 115 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 6 | 74 | 2 | 9 |
| 116 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 24 | 165 | 8 | 18 |
| 117 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 118 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 12 | 520 | 10 | 15 |
| 119 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 120 | `@beep/ui` | `packages/foundation/ui-system/ui` | needs-remediation | 133 | 553 | 1 | 21 |
| 121 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | needs-remediation | 5 | 158 | 0 | 5 |
| 122 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 25 | 139 | 0 | 10 |
| 123 | `@beep/documents-tables` | `packages/documents/tables` | needs-remediation | 15 | 40 | 0 | 4 |
| 124 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 71 | 1 | 6 |
| 125 | `@beep/postgres` | `packages/drivers/postgres` | needs-remediation | 7 | 40 | 0 | 1 |
| 126 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 52 | 0 | 0 |
| 127 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 2 |
| 128 | `@beep/provenance` | `packages/foundation/modeling/provenance` | needs-remediation | 4 | 22 | 1 | 8 |
| 129 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 28 | 86 | 4 | 17 |
| 130 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 20 |
| 131 | `@beep/federal-register` | `packages/drivers/federal-register` | needs-remediation | 1 | 1 | 1 | 1 |
| 132 | `@beep/doc-text` | `packages/drivers/doc-text` | needs-remediation | 3 | 12 | 0 | 2 |
| 133 | `@beep/documents-use-cases` | `packages/documents/use-cases` | needs-remediation | 23 | 116 | 0 | 13 |
| 134 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |

## Open Findings

### @beep/dol

Path: `packages/drivers/dol`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/index.ts:39` `VERSION` (const) - 1 documentation section/link violation(s)

### @beep/agents-domain

Path: `packages/agents/domain`

Export findings:
- `src/entities/ProviderInstance/ProviderInstance.behavior.ts:40` `loginGuidance` (const) - 1 documentation section/link violation(s)
- `src/entities/ProviderInstance/ProviderInstance.model.ts:36` `ProviderInstance` (class) - 1 documentation section/link violation(s)
- `src/entities/ProviderInstance/ProviderInstance.values.ts:43` `ProviderKind` (const) - 1 documentation section/link violation(s)
- `src/entities/ProviderInstance/ProviderInstance.values.ts:203` `EnvVarName` (const) - 1 documentation section/link violation(s)
- `src/entities/ProviderInstance/ProviderInstance.values.ts:272` `EnvVars` (const) - 1 documentation section/link violation(s)
- `src/values/AssistantContent/AssistantContent.behavior.ts:34` `inlineToMd` (const) - 1 documentation section/link violation(s)
- `src/values/AssistantContent/AssistantContent.behavior.ts:77` `blockToMd` (const) - 1 documentation section/link violation(s)

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Module findings:
- `src/Fold.assembly.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Fold.assembly.ts:66` `BoundComposer` (type) - 1 documentation section/link violation(s)
- `src/Fold.assembly.ts:884` `fold` (const) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:65` `SchemaHandle` (type) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:116` `TypedLiteral` (type) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:155` `Triple` (type) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:276` `TripleValue` (const) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:351` `AssembledPredicateKind` (const) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:460` `AssembledFact` (class) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:603` `OntologyValidationWarning` (class) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:227` `toContext` (const) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:383` `toJsonLd` (const) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:623` `toTurtle` (const) - 1 documentation section/link violation(s)
- `src/SemanticFoundation.seed.ts:49` `SemanticFoundationSeed` (const) - 1 documentation section/link violation(s)

### @beep/architecture-lab-ui

Path: `packages/architecture-lab/ui`

Module findings:
- `src/aggregates/WorkItem/WorkItem.view-model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/WorkItem/WorkItem.view-model.ts:220` `toWorkItemSummaryViewModel` (const) - 1 documentation section/link violation(s)

### @beep/pacer

Path: `packages/drivers/pacer`

Module findings:
- `src/CsoAuth.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.mock-data.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.mock.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.tokens.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PacerAuth.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pcl.api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pcl.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PclClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CsoAuth.models.ts:39` `CsoAuthRequest` (class) - 1 documentation section/link violation(s)
- `src/CsoAuth.models.ts:71` `CsoAuthResponse` (class) - 1 documentation section/link violation(s)
- `src/Pacer.config.ts:262` `loadPacerConfig` (const) - 1 documentation section/link violation(s)
- `src/Pacer.tokens.ts:39` `NextGenCsoToken` (const) - 1 documentation section/link violation(s)
- `src/Pacer.tokens.ts:94` `LoginResult` (const) - 1 documentation section/link violation(s)
- `src/Pacer.tokens.ts:175` `CaseNumberFull` (const) - 1 documentation section/link violation(s)

### @beep/workspace-tables

Path: `packages/workspace/tables`

Export findings:
- `src/entities/Message/Message.converters.ts:95` `toMessageInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Thread/Thread.converters.ts:90` `toThreadInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Turn/Turn.converters.ts:92` `toTurnInsert` (const) - 1 documentation section/link violation(s)

### @beep/mcp-kit

Path: `packages/foundation/capability/mcp-kit`

Module findings:
- `src/ApiKeyRequired.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FieldTier.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TierGate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolAnnotations.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolkitComposition.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ApiKeyRequired.ts:122` `apiKeyRequiredFailure` (const) - 1 documentation section/link violation(s)
- `src/McpCaller.ts:36` `McpCallerIdentity` (class) - 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:168` `withSanitizedToolSpan` (const) - 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:365` `sanitizedToolkit` (const) - 2 documentation section/link violation(s)
- `src/SourceAuth.ts:50` `SourceAuthGate` (const) - 1 documentation section/link violation(s)
- `src/TierGate.ts:314` `TierGateShape` (interface) - 1 documentation section/link violation(s)
- `src/ToolkitComposition.ts:124` `composeGatedLayers` (const) - 1 documentation section/link violation(s)

### @beep/law-practice-server

Path: `packages/law-practice/server`

Module findings:
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Layer.ts:71` `LawPracticeServerLive` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.emails.ts:157` `readEmailRows` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.errors.ts:48` `PracticeKgProjectionError` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.fts.ts:269` `buildDuckDb` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.projections.ts:570` `buildPracticeKgBundleImpl` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.projections.ts:697` `PracticeKgProjections` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.projections.ts:732` `PracticeKgProjectionsLive` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.projections.ts:779` `buildPracticeKgBundle` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.rows.ts:65` `PracticeKgCatalogRow` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.rows.ts:117` `PracticeKgEnrichmentRow` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.rows.ts:174` `withDuckDb` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.rows.ts:200` `stripPrefix` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:70` `PracticeKgOptions` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:165` `PracticeKgNodeRow` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:211` `PracticeKgEdgeRow` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:257` `PracticeKgEmailHeaderRow` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:296` `PracticeKgSchemaVersions` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:326` `PracticeKgSourceRuns` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:362` `PracticeKgCounts` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:409` `PracticeKgBundleManifest` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:459` `PracticeKgSummary` (class) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:510` `encodePracticeKgBundleManifestJson` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:559` `encodePracticeKgNodePayloadJson` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.schemas.ts:596` `encodePracticeKgSummaryJson` (const) - 1 documentation section/link violation(s)
- `src/PracticeKg.tool-handlers.ts:123` `PracticeKgToolkitHandlersLive` (const) - 1 documentation section/link violation(s)

### @beep/db-admin

Path: `packages/_internal/db-admin`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/migrate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/migrations/EpistemicEdge.ts:32` `EpistemicEdgeMigrationTarget` (const) - 1 documentation section/link violation(s)
- `src/migrations/EpistemicExecutionLedger.ts:36` `EpistemicExecutionLedgerMigrationTarget` (const) - 1 documentation section/link violation(s)

### @beep/shared-domain

Path: `packages/shared/domain`

Module findings:
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/Membership/Membership.model.ts:32` `Model` (class) - 1 documentation section/link violation(s)
- `src/entities/Organization/Organization.behavior.ts:36` `isTenantRoot` (const) - 1 documentation section/link violation(s)
- `src/entities/Organization/Organization.behavior.ts:83` `hasValidTenantPlacement` (const) - 1 documentation section/link violation(s)
- `src/identity/index.ts:83` `isIdentityComposer` (const) - 1 documentation section/link violation(s)
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:44` `ClaimLifecycle` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:64` `makeOption` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:92` `makeEffect` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:190` `fromString` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:252` `todayEffect` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:488` `diffInDays` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:631` `daysInMonth` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:663` `LocalDateFromString` (const) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:47` `Model` (class) - 1 documentation section/link violation(s)
- `src/values/OnePasswordReference/OnePasswordReference.model.ts:48` `OnePasswordReference` (const) - 1 documentation section/link violation(s)

### @beep/discord

Path: `packages/drivers/discord`

Export findings:
- `src/Discord.errors.ts:95` `DiscordError` (class) - 1 documentation section/link violation(s)
- `src/Discord.models.ts:175` `DiscordConfigInput` (class) - 2 documentation section/link violation(s)
- `src/Discord.models.ts:238` `DiscordCreateMessageRequest` (class) - 1 documentation section/link violation(s)
- `src/Discord.models.ts:280` `DiscordChannelProof` (class) - 1 documentation section/link violation(s)
- `src/Discord.models.ts:331` `DiscordMessageProof` (class) - 1 documentation section/link violation(s)
- `src/Discord.service.ts:272` `Discord` (class) - 1 documentation section/link violation(s)

### @beep/face-detection

Path: `packages/drivers/face-detection`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/FaceDetection.errors.ts:147` `FaceDetectionError` (class) - 1 documentation section/link violation(s)
- `src/FaceDetection.service.ts:815` `makeFaceDetectionService` (const) - 1 documentation section/link violation(s)

### @beep/gov-legal-mcp

Path: `packages/drivers/gov-legal-mcp`

Module findings:
- `src/Handlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolNames.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology-use-cases

Path: `packages/ontology/use-cases`

Module findings:
- `src/aggregates/Session/worker.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/tools/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Session/Session.worker-protocol.ts:280` `encodeWorkerCommand` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:315` `encodeWorkerResult` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:350` `OntologyWorkerUndecodableCommand` (class) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolkit.ts:608` `PublishProvenanceRequest` (class) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolkit.ts:837` `PublishProvenanceTool` (const) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolkit.ts:924` `OntologyPublishToolkit` (const) - 1 documentation section/link violation(s)

### @beep/architecture-lab-client

Path: `packages/architecture-lab/client`

Module findings:
- `src/aggregates/WorkItem/WorkItem.client.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/WorkItem/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/WorkItem/WorkItem.client.ts:77` `WorkItemClientTransport` (interface) - 1 documentation section/link violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:192` `WorkItemClient` (class) - 1 documentation section/link violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:252` `makeWorkItemClient` (const) - 1 documentation section/link violation(s)

### @beep/dock

Path: `packages/foundation/ui-system/dock`

Export findings:
- `src/Dock.atoms.ts:146` `makeDockAtomsWith` (const) - 1 documentation section/link violation(s)
- `src/Dock.models-tree.ts:246` `PanelConstraints` (class) - 1 documentation section/link violation(s)
- `src/Dock.placement.ts:146` `RootSplitPlacement` (class) - 1 documentation section/link violation(s)
- `src/DockEngine.service.ts:125` `DockEngine` (class) - 1 documentation section/link violation(s)
- `src/DockPolicy.ts:120` `lockedGroupsPolicy` (const) - 1 documentation section/link violation(s)
- `src/Geometry.models.ts:59` `DockBox` (class) - 1 documentation section/link violation(s)
- `src/Minima.ts:135` `titleMinima` (const) - 1 documentation section/link violation(s)
- `src/Recency.ts:76` `touchedGroups` (const) - 1 documentation section/link violation(s)
- `src/Recency.ts:122` `makeMruGroupsAtom` (const) - 1 documentation section/link violation(s)

### @beep/repo-cli

Path: `packages/tooling/tool/cli`

Module findings:
- `src/commands/Ci/CiLane.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codegen/Codegen.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Docgen/Docgen.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Docs/Docs.aggregate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Doctor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Inventory.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Migration.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/PortfolioIndex.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/SetStatus.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/IdentityRegistry.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/ReflectionArtifact.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/RoadmapRefs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Control.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Doctor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Inventory.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeIngest.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeLint.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.render.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.session.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Record.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Report.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 documentation section/link violation(s)

Export findings:
- `src/commands/Ci/CiLane.ts:329` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:762` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.recyclebin.ts:97` `parseRecycleBinMetadata` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.recyclebin.ts:153` `classifyRecycleBinName` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.recyclebin.ts:189` `pairRecycleBinEntries` (const) - 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:91` `resolveCreatePackageTemplateDir` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Doctor.ts:154` `GoalDoctorFinding` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Doctor.ts:248` `classifyGoalDoctorFindings` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.errors.ts:141` `GoalsGitError` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:41` `GoalStatus` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:94` `GoalPhaseStatus` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:146` `GoalManifestSchemaVersion` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:190` `GoalCompletionGate` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:221` `GoalInitiative` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:251` `GoalPhase` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.schemas.ts:291` `GoalManifest` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Inventory.ts:76` `GoalPacketRecord` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Inventory.ts:292` `readmeMissionLine` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Migration.ts:55` `GOAL_STATUS_MIGRATIONS` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/Migration.ts:321` `GoalPacketMigration` (class) - 1 documentation section/link violation(s)
- `src/commands/Goals/Migration.ts:521` `planGoalPacketMigration` (const) - 1 documentation section/link violation(s)
- `src/commands/Goals/PortfolioIndex.ts:113` `renderPortfolioIndex` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:322` `runFrozenGrantSetRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:551` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:194` `TestTypecheckBlindSpotBaseline` (class) - 1 documentation section/link violation(s)
- `src/commands/Lint/ReflectionArtifact.ts:196` `reflectionFrontmatterIsValid` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Control.ts:112` `markLiveSession` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Doctor.ts:276` `runQaDoctor` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:137` `extractionPlanPath` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:174` `artifactBudgetPath` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:302` `resolveRoundLayout` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:354` `PreparedVideo` (class) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:450` `windowSeqsForLabel` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:586` `ExtractionOutcome` (class) - 1 documentation section/link violation(s)
- `src/commands/Qa/Inventory.schemas.ts:38` `QaSeverity` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Inventory.schemas.ts:74` `QaLens` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Inventory.schemas.ts:229` `QaEvidenceRef` (class) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:324` `requireInventoryRound` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:373` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:525` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:624` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.command.ts:61` `QaCommandLayers` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.render.ts:313` `renderInventoryMarkdown` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.session.ts:173` `resolveCaptureTarget` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.session.ts:321` `readEventLog` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.session.ts:437` `collectToolVersions` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.session.ts:580` `discoverRecordedVideo` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Record.ts:159` `harnessEnv` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/Record.ts:231` `requireCapturedEvents` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:582` `runBunAudit` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.osv-ignore.ts:146` `activeOsvIgnoreIdsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Research/Research.schemas.ts:146` `KnowledgeCardFrontmatter` (class) - 1 documentation section/link violation(s)
- `src/commands/Root.ts:51` `rootCommand` (const) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:46` `WORKTREE_LOCAL_FILE_ENTRIES` (const) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:435` `resolveWorktreeContext` (const) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:481` `addWorktree` (const) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:521` `copyLocalFiles` (const) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:606` `worktreeDoctorReportForContext` (const) - 1 documentation section/link violation(s)

### @beep/pglite

Path: `packages/drivers/pglite`

Module findings:
- `src/Pglite.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PgliteClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Pglite.errors.ts:40` `PgliteError` (class) - 1 documentation section/link violation(s)

### @beep/agents-server

Path: `packages/agents/server`

Module findings:
- `src/AssistantTurn/AnthropicTurnCodec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AssistantTurn/AnthropicTurnKernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AssistantTurn/AnthropicTurnCodec.ts:185` `assistantBlockOutput` (const) - 1 documentation section/link violation(s)
- `src/AssistantTurn/AnthropicTurnCodec.ts:210` `assistantOutput` (const) - 1 documentation section/link violation(s)

### @beep/courtlistener

Path: `packages/drivers/courtlistener`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/index.ts:39` `VERSION` (const) - 1 documentation section/link violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Thread/ThreadTimeline.ts:273` `activeBranchTurns` (const) - 1 documentation section/link violation(s)

### @beep/editor

Path: `packages/foundation/ui-system/editor`

Module findings:
- `src/chat/atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/attachment-model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/attachments.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/chat-composer.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/code-fence.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/send.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/toolbar.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/typeahead.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/code-block-node.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/mermaid-node.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/nodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/chat/atoms.ts:180` `typeaheadOptionId` (const) - 1 documentation section/link violation(s)
- `src/chat/atoms.ts:232` `isTypeaheadMenuVisible` (const) - 1 documentation section/link violation(s)
- `src/chat/atoms.ts:527` `attachmentSweepBindingAtom` (const) - 1 documentation section/link violation(s)
- `src/chat/atoms.ts:647` `sendBlockedAtom` (const) - 1 documentation section/link violation(s)
- `src/chat/atoms.ts:731` `sendKeyBindingAtom` (const) - 1 documentation section/link violation(s)
- `src/chat/atoms.ts:838` `unboundSend` (const) - 1 documentation section/link violation(s)
- `src/chat/attachment-model.ts:369` `ComposerAttachment` (class) - 1 documentation section/link violation(s)
- `src/chat/chat-composer.tsx:143` `ChatComposerProps` (interface) - 1 documentation section/link violation(s)
- `src/chat/code-fence.ts:55` `$isInsideCodeBlock` (const) - 1 documentation section/link violation(s)
- `src/chat/code-fence.ts:87` `$openCodeFence` (const) - 1 documentation section/link violation(s)
- `src/chat/toolbar.tsx:171` `$selectionBlockType` (const) - 1 documentation section/link violation(s)
- `src/runtime.ts:91` `decodeEditorStateForRuntime` (const) - 1 documentation section/link violation(s)
- `src/youtube-embed.tsx:205` `YouTubeEmbed` (function) - 1 documentation section/link violation(s)

### @beep/nlp-mcp

Path: `packages/drivers/nlp-mcp`

Module findings:
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/DatasetLoader.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/Jsonl.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/Pipeline.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/StreamingHandlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/StreamingTools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/bin.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Server.ts:102` `makeServerLayer` (const) - 1 documentation section/link violation(s)
- `src/Streaming/DatasetLoader.ts:631` `loadJsonl` (const) - 1 documentation section/link violation(s)
- `src/Streaming/Jsonl.ts:188` `streamJsonl` (const) - 1 documentation section/link violation(s)
- `src/Streaming/Jsonl.ts:217` `streamJsonlResults` (const) - 1 documentation section/link violation(s)
- `src/Streaming/Jsonl.ts:334` `sampleJsonl` (const) - 1 documentation section/link violation(s)
- `src/Streaming/Pipeline.ts:212` `processFile` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:65` `StreamingAllowedRoots` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:91` `layerAllowedRoots` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:127` `resolveLocalPath` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:320` `streamLines` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:359` `readLines` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:475` `sampleLines` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:574` `computeStats` (const) - 1 documentation section/link violation(s)
- `src/StreamingHandlers.ts:104` `StreamingToolkitHandlersLive` (const) - 1 documentation section/link violation(s)

### @beep/law-practice-domain

Path: `packages/law-practice/domain`

Module findings:
- `src/values/Citation/Citation.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CitationBase/CitationBase.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CitationType/CitationType.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CitationWarning/CitationWarning.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/DurableLocator/DurableLocator.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/FullCitationType/FullCitationType.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ShortFormCitationType/ShortFormCitationType.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/Claim/Claim.model.ts:52` `Claim` (class) - 1 documentation section/link violation(s)
- `src/entities/Distinction/Distinction.model.ts:59` `Distinction` (class) - 1 documentation section/link violation(s)
- `src/entities/OfficeAction/OfficeAction.model.ts:50` `OfficeAction` (class) - 1 documentation section/link violation(s)
- `src/entities/PriorArtReference/PriorArtReference.model.ts:50` `PriorArtReference` (class) - 1 documentation section/link violation(s)
- `src/entities/Rejection/Rejection.model.ts:52` `Rejection` (class) - 1 documentation section/link violation(s)
- `src/values/AnnotationCitation/AnnotationCitation.model.ts:54` `AnnotationCitation` (class) - 3 documentation section/link violation(s)
- `src/values/CanonCitation/CanonCitation.model.ts:51` `CanonCitation` (class) - 3 documentation section/link violation(s)
- `src/values/CaseGroup/CaseGroup.model.ts:55` `CaseGroup` (class) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:112` `Parenthetical` (class) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:239` `FullCaseCitation` (class) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:795` `IdCitation` (class) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1034` `SupraCitation` (class) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1220` `ShortFormCaseCitation` (class) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1498` `Citation` (const) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1544` `Citation` (type) - 2 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1566` `Citation` (namespace) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1646` `FullCitation` (const) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1689` `FullCitation` (type) - 2 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1709` `ShortFormCitation` (const) - 3 documentation section/link violation(s)
- `src/values/Citation/Citation.models.ts:1731` `ShortFormCitation` (type) - 2 documentation section/link violation(s)
- `src/values/CitationBase/CitationBase.model.ts:60` `CitationBase` (class) - 3 documentation section/link violation(s)
- `src/values/CitationId/CitationId.model.ts:38` `CitationId` (const) - 3 documentation section/link violation(s)
- `src/values/CitationId/CitationId.model.ts:64` `CitationId` (type) - 2 documentation section/link violation(s)
- `src/values/CitationSignal/CitationSignal.model.ts:35` `CitationSignal` (const) - 3 documentation section/link violation(s)
- `src/values/CitationSignal/CitationSignal.model.ts:74` `CitationSignal` (type) - 2 documentation section/link violation(s)
- `src/values/CitationType/CitationType.model.ts:40` `CitationType` (const) - 3 documentation section/link violation(s)
- `src/values/CitationType/CitationType.model.ts:87` `CitationType` (type) - 2 documentation section/link violation(s)
- `src/values/CitationWarning/CitationWarning.models.ts:38` `WarningLevel` (const) - 3 documentation section/link violation(s)
- `src/values/CitationWarning/CitationWarning.models.ts:61` `WarningLevel` (type) - 2 documentation section/link violation(s)
- `src/values/CitationWarning/CitationWarning.models.ts:80` `WarningPosition` (class) - 2 documentation section/link violation(s)
- `src/values/CitationWarning/CitationWarning.models.ts:121` `CitationWarning` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:57` `CaseComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:140` `StatuteComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:217` `ConstitutionalComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:298` `JournalComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:376` `NeutralComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:450` `IdComponentSpan` (class) - 2 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:520` `SupraComponentSpan` (class) - 2 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:590` `ShortFormCaseComponentSpan` (class) - 2 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:663` `PublicLawComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:738` `FederalRegisterComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:816` `StatutesAtLargeComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:894` `FederalRuleComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:970` `RestatementComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:1047` `TreatiseComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:1124` `AnnotationComponentSpan` (class) - 3 documentation section/link violation(s)
- `src/values/ConstitutionalCitation/ConstitutionalCitation.model.ts:52` `ConstitutionalCitation` (class) - 3 documentation section/link violation(s)
- `src/values/ContextOptions/ContextOptions.model.ts:40` `ContextOptions` (class) - 3 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:41` `CourtLevel` (const) - 3 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:64` `CourtLevel` (type) - 2 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:90` `CourtJurisdiction` (const) - 3 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:113` `CourtJurisdiction` (type) - 2 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:143` `CourtInference` (class) - 3 documentation section/link violation(s)
- `src/values/DocketCitation/DocketCitation.model.ts:53` `DocketCitation` (class) - 3 documentation section/link violation(s)
- `src/values/DurableLocator/DurableLocator.model.ts:52` `DurableLocator` (class) - 3 documentation section/link violation(s)
- `src/values/DurableLocatorOptions/DurableLocatorOptions.model.ts:41` `DurableLocatorOptions` (class) - 3 documentation section/link violation(s)
- `src/values/FederalRegisterCitation/FederalRegisterCitation.model.ts:53` `FederalRegisterCitation` (class) - 3 documentation section/link violation(s)
- `src/values/FederalRuleCitation/FederalRuleCitation.model.ts:53` `FederalRuleCitation` (class) - 3 documentation section/link violation(s)
- `src/values/Footnote/Footnote.model.ts:166` `detectTextFootnotes` (function) - 1 documentation section/link violation(s)
- `src/values/Footnote/Footnote.model.ts:83` `Zone` (class) - 2 documentation section/link violation(s)
- `src/values/FullCitationType/FullCitationType.model.ts:41` `FullCitationType` (const) - 3 documentation section/link violation(s)
- `src/values/FullCitationType/FullCitationType.model.ts:85` `FullCitationType` (type) - 2 documentation section/link violation(s)
- `src/values/HistoryChain/HistoryChain.model.ts:36` `HistoryChain` (class) - 3 documentation section/link violation(s)
- `src/values/HistoryLink/HistoryLink.model.ts:47` `HistoryLink` (class) - 3 documentation section/link violation(s)
- `src/values/HistorySignal/HistorySignal.model.ts:46` `HistorySignal` (const) - 3 documentation section/link violation(s)
- `src/values/HistorySignal/HistorySignal.model.ts:110` `HistorySignal` (type) - 2 documentation section/link violation(s)
- `src/values/JournalCitation/JournalCitation.model.ts:53` `JournalCitation` (class) - 3 documentation section/link violation(s)
- `src/values/KgEdgePredicate/KgEdgePredicate.model.ts:37` `KgEdgePredicate` (const) - 1 documentation section/link violation(s)
- `src/values/KgNodeKind/KgNodeKind.model.ts:38` `KgNodeKind` (const) - 1 documentation section/link violation(s)
- `src/values/KindCode/KindCode.model.ts:34` `KindCode` (const) - 2 documentation section/link violation(s)
- `src/values/LegislativeMaterialCitation/LegislativeMaterialCitation.model.ts:53` `LegislativeMaterialCitation` (class) - 3 documentation section/link violation(s)
- `src/values/LocalOrdinanceCitation/LocalOrdinanceCitation.model.ts:51` `LocalOrdinanceCitation` (class) - 3 documentation section/link violation(s)
- `src/values/NeutralCitation/NeutralCitation.model.ts:55` `NeutralCitation` (class) - 3 documentation section/link violation(s)
- `src/values/OfficeCode/OfficeCode.model.ts:35` `OfficeCode` (const) - 2 documentation section/link violation(s)
- `src/values/ParallelGroup/ParallelGroup.model.ts:43` `ParallelGroup` (class) - 3 documentation section/link violation(s)
- `src/values/ParentheticalType/ParentheticalType.model.ts:39` `ParentheticalType` (const) - 3 documentation section/link violation(s)
- `src/values/ParentheticalType/ParentheticalType.model.ts:79` `ParentheticalType` (type) - 2 documentation section/link violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:58` `PatentDocumentTriplet` (const) - 5 documentation section/link violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:35` `PatentNumber` (const) - 2 documentation section/link violation(s)
- `src/values/PinciteInfo/PinciteInfo.model.ts:37` `PinciteInfo` (namespace) - 1 documentation section/link violation(s)
- `src/values/PinciteInfo/PinciteInfo.model.ts:154` `PinciteInfo` (class) - 3 documentation section/link violation(s)
- `src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts:38` `PracticeKgEpistemicStatus` (const) - 1 documentation section/link violation(s)
- `src/values/PracticeKgProvenanceKind/PracticeKgProvenanceKind.model.ts:37` `PracticeKgProvenanceKind` (const) - 1 documentation section/link violation(s)
- `src/values/PublicLawCitation/PublicLawCitation.model.ts:53` `PublicLawCitation` (class) - 3 documentation section/link violation(s)
- `src/values/RegulationCitation/RegulationCitation.model.ts:51` `RegulationCitation` (class) - 3 documentation section/link violation(s)
- `src/values/ResolutionResult/ResolutionResult.model.ts:45` `ResolutionResult` (class) - 3 documentation section/link violation(s)
- `src/values/RestatementCitation/RestatementCitation.model.ts:54` `RestatementCitation` (class) - 3 documentation section/link violation(s)
- `src/values/Segment/Segment.model.ts:37` `Segment` (class) - 1 documentation section/link violation(s)
- `src/values/SessionLawCitation/SessionLawCitation.model.ts:55` `SessionLawCitation` (class) - 3 documentation section/link violation(s)
- `src/values/ShortFormCitationType/ShortFormCitationType.model.ts:42` `ShortFormCitationType` (const) - 3 documentation section/link violation(s)
- `src/values/ShortFormCitationType/ShortFormCitationType.model.ts:65` `ShortFormCitationType` (type) - 2 documentation section/link violation(s)
- `src/values/Span/Span.model.ts:42` `Span` (class) - 1 documentation section/link violation(s)
- `src/values/Span/Span.model.ts:185` `TransformationMap` (class) - 1 documentation section/link violation(s)
- `src/values/StateRuleCitation/StateRuleCitation.model.ts:54` `StateRuleCitation` (class) - 3 documentation section/link violation(s)
- `src/values/StatuteCitation/StatuteCitation.model.ts:54` `StatuteCitation` (class) - 3 documentation section/link violation(s)
- `src/values/StatutesAtLargeCitation/StatutesAtLargeCitation.model.ts:51` `StatutesAtLargeCitation` (class) - 3 documentation section/link violation(s)
- `src/values/StringCitationGroup/StringCitationGroup.model.ts:44` `StringCitationGroup` (class) - 3 documentation section/link violation(s)
- `src/values/StructuredDate/StructuredDate.model.ts:42` `ParsedDate` (class) - 3 documentation section/link violation(s)
- `src/values/StructuredDate/StructuredDate.model.ts:129` `StructuredDate` (class) - 3 documentation section/link violation(s)
- `src/values/SubsequentHistoryEntry/SubsequentHistoryEntry.model.ts:49` `SubsequentHistoryEntry` (class) - 3 documentation section/link violation(s)
- `src/values/SurroundingContext/SurroundingContext.model.ts:40` `SurroundingContext` (class) - 3 documentation section/link violation(s)
- `src/values/TreatiseCitation/TreatiseCitation.model.ts:56` `TreatiseCitation` (class) - 3 documentation section/link violation(s)
- `src/values/TreatyCitation/TreatyCitation.model.ts:50` `TreatyCitation` (class) - 3 documentation section/link violation(s)

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/Checker.ts:294` `checkModule` (function) - 1 documentation section/link violation(s)
- `src/Configuration.ts:535` `load` (const) - 1 documentation section/link violation(s)
- `src/Domain.ts:670` `Export` (class) - 1 documentation section/link violation(s)
- `src/Parser.ts:780` `parseModule` (const) - 1 documentation section/link violation(s)
- `src/Printer.ts:446` `print` (const) - 1 documentation section/link violation(s)
- `src/Printer.ts:553` `printModule` (const) - 1 documentation section/link violation(s)

### @beep/file-processing

Path: `packages/foundation/capability/file-processing`

Module findings:
- `src/PathSafety/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/PathSafety/index.ts:57` `PathSafetyViolationReason` (const) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:106` `PathSafetyError` (class) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:248` `isPathWithinRoot` (const) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:303` `validateResolvedPath` (const) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:353` `resolvePathWithinRoot` (const) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:478` `resolvePathWithinCanonicalRoot` (const) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:591` `writeFileWithinCanonicalRootAtomically` (const) - 1 documentation section/link violation(s)
- `src/PathSafety/index.ts:642` `writeFileWithinRootAtomically` (const) - 1 documentation section/link violation(s)
- `src/SourceText/index.ts:40` `SOURCE_TEXT_PAGE_CODE_UNITS` (const) - 1 documentation section/link violation(s)
- `src/SourceText/index.ts:335` `SourceTextPage` (class) - 1 documentation section/link violation(s)
- `src/SourceText/index.ts:464` `pageSourceText` (const) - 1 documentation section/link violation(s)
- `src/SourceText/index.ts:501` `pageSourceTextContainingOffset` (const) - 1 documentation section/link violation(s)
- `src/Strategy/index.ts:527` `classifyFormatFromExtension` (const) - 1 documentation section/link violation(s)

### @beep/ontology-config

Path: `packages/ontology/config`

Module findings:
- `src/McpConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/layer.ts:52` `OntologyConfigLive` (const) - 1 documentation section/link violation(s)

### @beep/ai-provider-cli

Path: `packages/drivers/ai-provider-cli`

Module findings:
- `src/AiProviderCliHome.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AiProviderCli.errors.ts:43` `AiProviderCliError` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:38` `AiProviderCliProvider` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:83` `AiProviderCliAuthStatus` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:129` `AiProviderCliTokenSource` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:175` `AiProviderCliClaudeSubscriptionLabel` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:266` `AiProviderCliProbeOptions` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:304` `AiProviderCliRunRequest` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:348` `AiProviderCliProcessResult` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:388` `AiProviderCliAuthProbe` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:432` `AiProviderCliClaudeAuthStatusPayload` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.models.ts:482` `AiProviderCliAuthSnapshot` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCli.service.ts:64` `AiProviderCliRunner` (type) - 1 documentation section/link violation(s)
- `src/AiProviderCli.service.ts:309` `AiProviderCli` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:52` `AiProviderCliHomeMode` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:94` `AiProviderCliCodexSharedDirectory` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:136` `AiProviderCliCodexPrivateEntry` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:223` `AiProviderCliCodexHomeLayout` (class) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:112` `expandTildePath` (const) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:452` `AiProviderCliHome` (class) - 1 documentation section/link violation(s)

### @beep/dock-react

Path: `packages/foundation/ui-system/dock-react`

Export findings:
- `src/DockReact.types.ts:174` `DockTitleMinimaOptions` (type) - 1 documentation section/link violation(s)
- `src/DockviewReact.tsx:233` `DockviewReact` (const) - 1 documentation section/link violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology-server

Path: `packages/ontology/server`

Export findings:
- `src/aggregates/Session/Session.file-store.ts:224` `makeFileSystemOntologyFileStore` (const) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolHandlers.ts:199` `publishProvenance` (const) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolHandlers.ts:235` `OntologyMcpPublishHandlersLive` (const) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolHandlers.ts:304` `OntologyMcpPublishToolsLive` (const) - 1 documentation section/link violation(s)

### @beep/colors

Path: `packages/foundation/capability/colors`

Module findings:
- `src/Colors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Colors.ts:188` `Formatter` (const) - 1 documentation section/link violation(s)
- `src/Colors.ts:240` `supportsColor` (const) - 1 documentation section/link violation(s)
- `src/Colors.ts:276` `Colors` (class) - 1 documentation section/link violation(s)
- `src/Colors.ts:321` `createColors` (const) - 1 documentation section/link violation(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Module findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:56` `fixtureBlocksFor` (const) - 1 documentation section/link violation(s)
- `src/processes/Chat/Chat.rpc.ts:41` `ListThreadsRpc` (const) - 1 documentation section/link violation(s)
- `src/processes/Chat/Chat.rpc.ts:66` `CreateThreadRpc` (const) - 1 documentation section/link violation(s)
- `src/processes/Chat/Chat.rpc.ts:93` `GetTimelineRpc` (const) - 1 documentation section/link violation(s)
- `src/processes/Chat/Chat.rpc.ts:178` `SendMessageRpc` (const) - 1 documentation section/link violation(s)
- `src/processes/Chat/Chat.rpc.ts:209` `EditMessageRpc` (const) - 1 documentation section/link violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts:246` `makeInMemoryProfessionalRuntimeSdk` (const) - 1 documentation section/link violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts:741` `runRuntimeFixture` (const) - 1 documentation section/link violation(s)

### @beep/m365-mcp

Path: `packages/drivers/m365-mcp`

Module findings:
- `src/M365Handlers.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/M365Tools.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/cosmos

Path: `packages/drivers/cosmos`

Export findings:
- `src/Cosmos.renderer.ts:576` `renderCosmosGraph` (const) - 1 documentation section/link violation(s)

### @beep/chalk

Path: `packages/foundation/capability/chalk`

Module findings:
- `src/Chalk.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Chalk.ts:87` `ChalkInstance` (interface) - 1 documentation section/link violation(s)
- `src/Chalk.ts:118` `Chalk` (type) - 1 documentation section/link violation(s)
- `src/Chalk.ts:146` `Chalk` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:166` `BackgroundColorName` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:202` `ChalkConstructorOptions` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:221` `ChalkConstructorOptions` (type) - 1 documentation section/link violation(s)
- `src/Chalk.ts:241` `ChalkOptions` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:277` `ColorInfo` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:313` `ColorName` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:354` `ColorSupport` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:389` `ColorSupportLevel` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:425` `ColorSupportLevelInput` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:461` `ForegroundColorName` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:497` `ModifierName` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:660` `supportsColor` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:679` `supportsColorStderr` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:703` `chalkStderr` (const) - 1 documentation section/link violation(s)
- `src/Chalk.ts:732` `default` (const) - 1 documentation section/link violation(s)

### @beep/epistemic-client

Path: `packages/epistemic/client`

Export findings:
- `src/ContradictionTriage/ContradictionTriage.atoms.ts:254` `contradictionReviewCandidateIdAtom` (const) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.atoms.ts:295` `selectedContradictionCandidateAtom` (const) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.atoms.ts:366` `contradictionEvidenceSourcePageAtom` (const) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.atoms.ts:539` `reviewContradictionCandidateAtom` (const) - 1 documentation section/link violation(s)
- `src/Protocol.ts:56` `resolveEpistemicRpcHttpUrl` (const) - 1 documentation section/link violation(s)
- `src/Protocol.ts:92` `HttpEpistemicProtocolLive` (const) - 1 documentation section/link violation(s)

### @beep/uspto

Path: `packages/drivers/uspto`

Export findings:
- `src/Uspto.models.ts:253` `normalizeUsptoApplicationNumber` (const) - 1 documentation section/link violation(s)
- `src/Uspto.models.ts:278` `normalizeUsptoPatentNumber` (const) - 1 documentation section/link violation(s)

### @beep/openclaw

Path: `packages/drivers/openclaw`

Module findings:
- `src/Openclaw.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawProbe.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawSystemd.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Openclaw.config.ts:53` `OPENCLAW_VALIDATE_TIMEOUT` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.config.ts:213` `OPENCLAW_NIX_MODE` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.config.ts:231` `OPENCLAW_GATEWAY_TOKEN` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.config.ts:261` `hermeticOpenclawEnv` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.config.ts:291` `OPENCLAW_COMPATIBILITY_SET` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.errors.ts:106` `OpenclawCommandExitError` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.errors.ts:191` `OpenclawOutputParseError` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:123` `OpenclawDiagnosticText` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:176` `OpenclawProcessRequest` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:339` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:412` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:447` `OpenclawSecretsReloadOutput` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:512` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1176` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1264` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1351` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1422` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:403` `OpenclawCliRunner` (type) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:750` `OpenclawCli` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:51` `OpenclawSecretReference` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:99` `OpenclawTargetVersion` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1050` `OpenclawSkillPin` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1150` `OpenclawDeploymentIntent` (class) - 1 documentation section/link violation(s)
- `src/OpenclawProbe.service.ts:113` `probeOpenclawReadiness` (const) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:264` `OpenclawSha256Hex` (const) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:319` `RenderedOpenclawConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:399` `renderOpenclawConfig` (const) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:467` `declaredExtensionSurfaces` (const) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:506` `findLossySchemaPlaceholders` (const) - 1 documentation section/link violation(s)
- `src/OpenclawSystemd.service.ts:223` `OpenclawSystemd` (class) - 1 documentation section/link violation(s)

### @beep/law-practice-tables

Path: `packages/law-practice/tables`

Module findings:
- `src/Tables.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ReadModels.ts:31` `DbSchema` (const) - 1 documentation section/link violation(s)
- `src/ReadModels.ts:84` `KgNodeReadModel` (type) - 1 documentation section/link violation(s)
- `src/ReadModels.ts:114` `KgNodeInsert` (type) - 1 documentation section/link violation(s)
- `src/ReadModels.ts:167` `KgEdgeInsert` (type) - 1 documentation section/link violation(s)
- `src/ReadModels.ts:194` `KgBuildReadModel` (type) - 1 documentation section/link violation(s)
- `src/entities/KgBuild/KgBuild.read-model-table.ts:30` `KG_BUILD_TABLE_NAME` (const) - 1 documentation section/link violation(s)
- `src/entities/KgBuild/KgBuild.read-model-table.ts:59` `kgBuildTable` (const) - 1 documentation section/link violation(s)
- `src/entities/KgEdge/KgEdge.read-model-table.ts:31` `KG_EDGE_TABLE_NAME` (const) - 1 documentation section/link violation(s)
- `src/entities/KgEdge/KgEdge.read-model-table.ts:63` `kgEdgeTable` (const) - 1 documentation section/link violation(s)
- `src/entities/KgNode/KgNode.read-model-table.ts:31` `KG_NODE_TABLE_NAME` (const) - 1 documentation section/link violation(s)
- `src/entities/KgNode/KgNode.read-model-table.ts:66` `kgNodeTable` (const) - 1 documentation section/link violation(s)

### @beep/test-utils

Path: `packages/tooling/test-kit/test-utils`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Layer.ts:30` `provideScopedLayer` (const) - 1 documentation section/link violation(s)
- `src/Schema.ts:30` `assertSchemaArbitraryDecodesToSelf` (const) - 1 documentation section/link violation(s)
- `src/SqlTest.ts:415` `PgliteInProcessTestDriverConfigInput` (type) - 1 documentation section/link violation(s)
- `src/SqlTest.ts:1478` `PgliteInProcessTestDriver` (const) - 1 documentation section/link violation(s)
- `src/SqlTest.ts:1591` `makePgliteIntegrationGate` (const) - 1 documentation section/link violation(s)
- `src/SqlTest.ts:1664` `makePgliteSqlTestLayer` (const) - 1 documentation section/link violation(s)

### @beep/types

Path: `packages/foundation/primitive/types`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/TString.types.ts:30` `NonEmpty` (type) - 1 documentation section/link violation(s)
- `src/TString.types.ts:62` `NonEmptyTrimmed` (type) - 1 documentation section/link violation(s)
- `src/TString.types.ts:124` `DotPropertyName` (type) - 1 documentation section/link violation(s)
- `src/TUnsafe.types.ts:26` `Any` (type) - 1 documentation section/link violation(s)

### @beep/oip-web

Path: `apps/oip-web`

Export findings:
- `src/app/layout.tsx:154` `instant` (const) - 1 documentation section/link violation(s)
- `src/app/page.tsx:44` `instant` (const) - 1 documentation section/link violation(s)
- `src/components/BackToTop.tsx:68` `BackToTop` (function) - 1 documentation section/link violation(s)
- `src/components/MattersCarousel.tsx:49` `MattersCarousel` (function) - 1 documentation section/link violation(s)
- `src/components/ThemeModeToggle.tsx:29` `ThemeModeToggle` (function) - 1 documentation section/link violation(s)

### @beep/exiftool

Path: `packages/drivers/exiftool`

Module findings:
- `src/ExiftoolConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Exiftool.models.ts:187` `SafeTagName` (const) - 1 documentation section/link violation(s)
- `src/Exiftool.models.ts:249` `ExiftoolWritableExtension` (const) - 1 documentation section/link violation(s)
- `src/Exiftool.models.ts:355` `ExifMetadata` (class) - 1 documentation section/link violation(s)
- `src/ExiftoolConfig.ts:367` `beepQaRawTagKey` (const) - 1 documentation section/link violation(s)
- `src/ExiftoolConfig.ts:391` `provenanceTagAssignments` (const) - 1 documentation section/link violation(s)
- `src/ExiftoolConfig.ts:461` `provenanceFromRawTags` (const) - 1 documentation section/link violation(s)

### @beep/agents-tables

Path: `packages/agents/tables`

Export findings:
- `src/entities/ProviderInstance/ProviderInstance.converters.ts:94` `toProviderInstanceInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/ProviderInstance/ProviderInstance.table.ts:36` `providerInstanceTable` (const) - 1 documentation section/link violation(s)

### @beep/ontology-domain

Path: `packages/ontology/domain`

Module findings:
- `src/aggregates/Session/Session.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Session/Session.model.ts:522` `classifySessionDatasetPartitions` (const) - 1 documentation section/link violation(s)

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Module findings:
- `src/Lexical.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.codec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Lexical.codec.ts:447` `documentToEditorState` (const) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1136` `ElementNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:2198` `YouTubeNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3197` `decodeEditorStateStrictResult` (const) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3280` `analyzeEditorStateCompatibilityResult` (const) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:69` `legacyYouTubeVideoId` (const) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:98` `sanitizeUrl` (const) - 1 documentation section/link violation(s)

### @beep/langextract

Path: `packages/foundation/capability/langextract`

Export findings:
- `src/VerifiedSpan/index.ts:231` `RawTextChunk` (class) - 1 documentation section/link violation(s)
- `src/VerifiedSpan/index.ts:439` `normalizeTextLocator` (const) - 1 documentation section/link violation(s)
- `src/VerifiedSpan/index.ts:571` `locateRawText` (const) - 1 documentation section/link violation(s)
- `src/VerifiedSpan/index.ts:611` `convertTextOffsetRange` (const) - 1 documentation section/link violation(s)
- `src/VerifiedSpan/index.ts:667` `reconstructSourceText` (const) - 1 documentation section/link violation(s)
- `src/VerifiedSpan/index.ts:717` `locateGroundedExtractions` (const) - 1 documentation section/link violation(s)

### @beep/shared-tables

Path: `packages/shared/tables`

Export findings:
- `src/Schema.ts:41` `DbSchema` (const) - 1 documentation section/link violation(s)
- `src/entities/Membership/Membership.table.ts:31` `Table` (const) - 1 documentation section/link violation(s)
- `src/entities/Organization/Organization.table.ts:31` `Table` (const) - 1 documentation section/link violation(s)
- `src/entities/User/User.table.ts:31` `Table` (const) - 1 documentation section/link violation(s)

### @beep/scratchpad

Path: `scratchpad`

Module findings:
- `claudecode/ClaudeProject.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/ClaudeRuntime.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Errors.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Bus.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Context.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Envelope.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/ConfigChange.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/CwdChanged.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/Elicitation.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/ElicitationResult.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/FileChanged.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/InstructionsLoaded.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/MessageDisplay.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/Notification.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PermissionDenied.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PermissionRequest.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PostCompact.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PostToolBatch.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PostToolUse.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PostToolUseFailure.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PreCompact.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/PreToolUse.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/SessionEnd.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/SessionStart.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/Setup.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/Stop.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/StopFailure.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/SubagentStart.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/SubagentStop.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/TaskCompleted.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/TaskCreated.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/TeammateIdle.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/UserPromptExpansion.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/UserPromptSubmit.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/WorktreeCreate.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Events/WorktreeRemove.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Matcher.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Runner.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Tool.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Hook/Transcript.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Mcp.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Mcp/Schema.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Plugin.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Plugin/Define.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Plugin/Load.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Settings/HooksSection.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Settings/Loader.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Settings/Schema.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `claudecode/Testing.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `claudecode/ClaudeRuntime.ts:98` `RuntimeOptions` (interface) - 1 documentation section/link violation(s)
- `claudecode/ClaudeRuntime.ts:122` `ProjectRuntimeOptions` (interface) - 1 documentation section/link violation(s)
- `claudecode/ClaudeRuntime.ts:148` `PluginRuntimeOptions` (interface) - 1 documentation section/link violation(s)
- `claudecode/ClaudeRuntime.ts:337` `project` (const) - 1 documentation section/link violation(s)
- `claudecode/ClaudeRuntime.ts:362` `plugin` (const) - 1 documentation section/link violation(s)
- `claudecode/Errors.ts:54` `HookStdinReadError` (class) - 1 documentation section/link violation(s)
- `claudecode/Errors.ts:80` `HookInputDecodeError` (class) - 1 documentation section/link violation(s)
- `claudecode/Errors.ts:106` `HookHandlerError` (class) - 1 documentation section/link violation(s)
- `claudecode/Errors.ts:129` `HookOutputEncodeError` (class) - 1 documentation section/link violation(s)
- `claudecode/Errors.ts:152` `HookStdoutWriteError` (class) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/Command.ts:42` `CommandFrontmatter` (class) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/OutputStyle.ts:35` `OutputStyleFrontmatter` (class) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/Parser.ts:43` `ParsedFrontmatter` (class) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/Parser.ts:176` `parse` (const) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/Render.ts:134` `render` (const) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/Skill.ts:143` `SkillFrontmatter` (class) - 1 documentation section/link violation(s)
- `claudecode/Frontmatter/Subagent.ts:84` `SubagentFrontmatter` (class) - 1 documentation section/link violation(s)
- `claudecode/Hook/Envelope.ts:141` `envelopeFields` (const) - 1 documentation section/link violation(s)
- `claudecode/Hook/Runner.ts:179` `DispatchMap` (type) - 1 documentation section/link violation(s)
- `claudecode/Hook/Runner.ts:324` `runHookProgram` (const) - 1 documentation section/link violation(s)
- `claudecode/Hook/Runner.ts:406` `hookTeardown` (const) - 1 documentation section/link violation(s)
- `claudecode/Hook/Transcript.ts:60` `readTranscript` (const) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:157` `ClaudeJsonFile` (class) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:456` `mergeMcpJsonFiles` (const) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:532` `toClaudeCodeJson` (const) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:567` `loadJson` (const) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:631` `loadManagedMcp` (const) - 1 documentation section/link violation(s)
- `claudecode/Mcp/JsonFile.ts:725` `loadEffective` (const) - 1 documentation section/link violation(s)
- `claudecode/Plugin/Define.ts:867` `write` (const) - 1 documentation section/link violation(s)
- `claudecode/Settings/Loader.ts:332` `load` (const) - 1 documentation section/link violation(s)
- `claudecode/Settings/Schema.ts:1722` `SettingsFile` (class) - 1 documentation section/link violation(s)
- `claudecode/Testing.ts:283` `runHookWithMockStdin` (const) - 1 documentation section/link violation(s)
- `claudecode/Testing.ts:365` `fixtures` (const) - 1 documentation section/link violation(s)
- `claudecode/Testing.ts:656` `expectBlockDecision` (const) - 1 documentation section/link violation(s)
- `claudecode/Testing.ts:955` `makeMockFileSystem` (const) - 1 documentation section/link violation(s)
- `claudecode/Testing.ts:1167` `expectPluginTree` (const) - 1 documentation section/link violation(s)

### @beep/md

Path: `packages/foundation/modeling/md`

Module findings:
- `src/Md.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.html.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.safe.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Md.behavior.ts:103` `segmentInlineRuns` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:99` `UrlPolicy` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:177` `AllowListUrlPolicySpec` (class) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:349` `UrlPolicyInput` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:558` `normalizeUrlPolicy` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:656` `isUrlDestinationAllowedWithPolicy` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:758` `sanitizeUrlDestinationWithPolicy` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:781` `sanitizeUrlDestination` (const) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:940` `renderFencedCode` (const) - 1 documentation section/link violation(s)
- `src/Md.html.ts:233` `renderSafeHtml` (const) - 1 documentation section/link violation(s)
- `src/Md.model.ts:88` `YouTubeVideoId` (const) - 1 documentation section/link violation(s)
- `src/Md.model.ts:455` `RawHtml` (class) - 1 documentation section/link violation(s)
- `src/Md.model.ts:1830` `TaskListItemSpec` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:182` `EffectRenderAdapter` (interface) - 1 documentation section/link violation(s)
- `src/Md.render.ts:785` `renderUnsafe` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:803` `renderHtmlUnsafe` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:821` `renderPlainTextUnsafe` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:840` `renderWithUnsafe` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:868` `renderEffectWithUnsafe` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:907` `renderEffectWith` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:1343` `HtmlFragmentAdapter` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:1385` `renderWith` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:1416` `render` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:1438` `renderHtml` (const) - 1 documentation section/link violation(s)
- `src/Md.render.ts:1460` `renderPlainText` (const) - 1 documentation section/link violation(s)
- `src/Md.ts:192` `BlockTemplateValue` (type) - 1 documentation section/link violation(s)
- `src/Md.ts:587` `rawHtml` (const) - 1 documentation section/link violation(s)
- `src/Md.ts:1198` `youtubeUnsafe` (const) - 1 documentation section/link violation(s)
- `src/Md.ts:1254` `Md` (const) - 1 documentation section/link violation(s)

### @beep/practice-kg-mcp

Path: `apps/practice-kg-mcp`

Export findings:
- `src/runtime/Layer.ts:53` `makePracticeKgBuildLayer` (const) - 1 documentation section/link violation(s)
- `src/runtime/Pglite.ts:33` `makePracticeKgPgliteLayer` (const) - 1 documentation section/link violation(s)

### @beep/law-practice-use-cases

Path: `packages/law-practice/use-cases`

Module findings:
- `src/IrToLaw/IrToLaw.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/IrToLaw/IrToLaw.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OfficeActionReview/OfficeActionReview.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PracticeKg.tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/OfficeActionReview/OfficeActionReview.candidates.ts:29` `OfficeActionReviewSpikeCandidates` (const) - 1 documentation section/link violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:207` `OfficeActionReviewShape` (interface) - 1 documentation section/link violation(s)

### @beep/epistemic-ui

Path: `packages/epistemic/ui`

Export findings:
- `src/ContradictionTriage/ContradictionTriageView.tsx:1385` `ContradictionTriageView` (function) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriageView.tsx:121` `ContradictionTriageViewProps` (interface) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/EvidenceSourcePanel.tsx:66` `EvidenceSourcePanel` (function) - 1 documentation section/link violation(s)

### @beep/workspace-domain

Path: `packages/workspace/domain`

Export findings:
- `src/entities/Workspace/Workspace.values.ts:57` `WorkspaceVaultRootPath` (const) - 1 documentation section/link violation(s)

### @beep/utils

Path: `packages/foundation/modeling/utils`

Module findings:
- `src/FileSystem.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Function.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GlobalValue.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/NodeUrl.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Path.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Array.ts:39` `matchToBoolean` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:66` `assertNonEmptyArray` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:87` `assertNonEmptyReadonlyArray` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:129` `mapNonEmpty` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:165` `flatMapNonEmpty` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:203` `mapNonEmptyReadonly` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:245` `flatMapNonEmptyReadonly` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:303` `indexOf` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:332` `lastIndexOf` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:359` `slice` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:443` `appendInPlace` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:470` `appendAllInPlace` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:501` `sortInPlace` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:533` `spliceInPlace` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:596` `makeReadonly` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:616` `fromIterableNonEmpty` (const) - 1 documentation section/link violation(s)
- `src/Array.ts:639` `emptyReadonly` (const) - 1 documentation section/link violation(s)
- `src/DateTime.ts:26` `makeUnsafeUtc` (const) - 1 documentation section/link violation(s)
- `src/DrainableWorker.ts:76` `makeDrainableWorker` (const) - 1 documentation section/link violation(s)
- `src/Errors.ts:160` `mapToError` (function) - 1 documentation section/link violation(s)
- `src/Errors.ts:95` `mapCauseError` (const) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:385` `readdirSync` (function) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:261` `appendFileSync` (const) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:304` `existsSync` (const) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:325` `rmSync` (const) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:350` `renameSync` (const) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:423` `statSync` (const) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:460` `makeWaitForFile` (const) - 1 documentation section/link violation(s)
- `src/Glob.ts:79` `GlobOptions` (class) - 1 documentation section/link violation(s)
- `src/Glob.ts:178` `GlobError` (class) - 1 documentation section/link violation(s)
- `src/Glob.ts:235` `Glob` (interface) - 1 documentation section/link violation(s)
- `src/GlobalValue.ts:56` `globalValue` (const) - 1 documentation section/link violation(s)
- `src/Html.ts:27` `escapeHtml` (const) - 1 documentation section/link violation(s)
- `src/Html.ts:51` `escapeHtmlMultiline` (const) - 1 documentation section/link violation(s)
- `src/NodeUrl.ts:84` `fromFileUrl` (const) - 1 documentation section/link violation(s)
- `src/NodeUrl.ts:133` `toFileUrl` (const) - 1 documentation section/link violation(s)
- `src/Number.ts:41` `isPositive` (const) - 2 documentation section/link violation(s)
- `src/Option.ts:60` `propFromNullishOr` (const) - 1 documentation section/link violation(s)
- `src/Option.ts:102` `getSomesStruct` (const) - 1 documentation section/link violation(s)
- `src/Predicate.ts:203` `chainRefinements` (function) - 1 documentation section/link violation(s)
- `src/Predicate.ts:365` `hasProperties` (const) - 1 documentation section/link violation(s)
- `src/Stream.ts:43` `streamFilterJson` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:150` `dotGet` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:190` `dotGetOption` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:236` `mapPath` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:311` `mapPathLazy` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:390` `getLazy` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:422` `pathsOf` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:477` `StringKeyEntries` (type) - 1 documentation section/link violation(s)
- `src/Struct.ts:503` `entries` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:532` `entriesNonEmpty` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:560` `keys` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:583` `keysNonEmpty` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:615` `fromEntries` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:684` `ReverseStruct` (type) - 1 documentation section/link violation(s)
- `src/Struct.ts:717` `reverse` (const) - 1 documentation section/link violation(s)
- `src/Struct.ts:784` `DeepPartial` (type) - 2 documentation section/link violation(s)
- `src/Struct.ts:817` `deepMerge` (const) - 1 documentation section/link violation(s)
- `src/Text.ts:58` `formatNameWithAliases` (const) - 1 documentation section/link violation(s)
- `src/Utils.ts:27` `structuralRegionState` (const) - 1 documentation section/link violation(s)
- `src/Utils.ts:56` `structuralRegion` (const) - 1 documentation section/link violation(s)
- `src/thunk.ts:503` `thunkSomeNone` (const) - 1 documentation section/link violation(s)
- `src/thunk.ts:524` `thunkResultFailVoid` (const) - 1 documentation section/link violation(s)

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Module findings:
- `src/duckdb.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/agent-effectiveness.ts:3019` `syncAgentEffectivenessPhoenix` (const) - 1 documentation section/link violation(s)
- `src/archive.ts:280` `writeEncryptedRawArchiveObject` (const) - 1 documentation section/link violation(s)
- `src/archive.ts:392` `decryptEncryptedRawArchiveEnvelope` (const) - 1 documentation section/link violation(s)
- `src/duckdb.ts:78` `withAiMetricsDuckDb` (const) - 1 documentation section/link violation(s)
- `src/mirror.ts:740` `buildAiMetricsMirrorBundle` (const) - 1 documentation section/link violation(s)

### @beep/tika

Path: `packages/drivers/tika`

Module findings:
- `src/Tika.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Tika.config.ts:116` `TIKA_SERVER_URL` (const) - 1 documentation section/link violation(s)
- `src/Tika.config.ts:182` `TikaServerEngineConfig` (class) - 1 documentation section/link violation(s)
- `src/Tika.error-translation.ts:55` `TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE` (const) - 1 documentation section/link violation(s)
- `src/Tika.error-translation.ts:148` `tikaOperationError` (const) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:133` `stringifyTikaMetadata` (const) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:164` `makeTikaServerFileProcessingEngine` (const) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:320` `makeTikaServerFileProcessingEngineFromEnv` (const) - 1 documentation section/link violation(s)
- `src/Tika.tikaapp.ts:89` `makeTikaAppFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/libpff

Path: `packages/drivers/libpff`

Module findings:
- `src/Libpff.eml.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Libpff.eml.ts:128` `foldHeaderLine` (const) - 2 documentation section/link violation(s)
- `src/Libpff.eml.ts:171` `rfc5322DateFromOutlookTimestamp` (const) - 1 documentation section/link violation(s)
- `src/Libpff.eml.ts:216` `stripMimeStructuralHeaders` (const) - 1 documentation section/link violation(s)
- `src/Libpff.eml.ts:263` `parseOutlookHeaders` (const) - 1 documentation section/link violation(s)
- `src/Libpff.eml.ts:309` `synthesizeEmlHeaderBlock` (const) - 1 documentation section/link violation(s)
- `src/Libpff.eml.ts:418` `assembleEml` (const) - 2 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:64` `LIBPFF_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE` (const) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:163` `libpffOperationError` (const) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:46` `PFFEXPORT_MESSAGES_SUFFIX` (const) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:76` `PffexportMessageRecord` (class) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:459` `makePffexportFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/venice-ai

Path: `packages/drivers/venice-ai`

Export findings:
- `src/VeniceAI.service.ts:354` `VeniceAIRequestOptions` (class) - 1 documentation section/link violation(s)

### @beep/graph-3d

Path: `packages/drivers/graph-3d`

Module findings:
- `src/Graph3D.react.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Graph3D.projection.ts:57` `Graph3DProjection` (class) - 1 documentation section/link violation(s)
- `src/Graph3D.projection.ts:148` `SyntheticGraph3DOptions` (class) - 1 documentation section/link violation(s)
- `src/Graph3D.projection.ts:199` `generateSyntheticGraph3DProjection` (const) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:945` `renderGraph3D` (const) - 1 documentation section/link violation(s)

### @beep/form

Path: `packages/foundation/ui-system/form`

Module findings:
- `src/components/Form.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/components/SubmitButton.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/core/Defaults.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/core/Errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/core/FormOptions.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/core/FormSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/core/contexts.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/hooks/useAppForm.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/internal/FieldShell.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/components/Form.tsx:76` `Form` (const) - 1 documentation section/link violation(s)
- `src/components/SubmitButton.tsx:80` `SubmitButton` (const) - 1 documentation section/link violation(s)
- `src/core/Defaults.ts:42` `getDefaultFormValues` (const) - 1 documentation section/link violation(s)
- `src/core/Defaults.ts:69` `getEncodedDefaultFormValues` (const) - 1 documentation section/link violation(s)
- `src/core/FormOptions.ts:117` `makeFormOptions` (const) - 1 documentation section/link violation(s)
- `src/core/FormOptions.ts:157` `formOptionsWithDefaults` (const) - 1 documentation section/link violation(s)
- `src/core/FormSchema.ts:80` `toFormSchema` (const) - 1 documentation section/link violation(s)
- `src/core/Path.ts:84` `Paths` (type) - 1 documentation section/link violation(s)
- `src/fields/UploadAvatarField.tsx:88` `UploadAvatarField` (const) - 1 documentation section/link violation(s)
- `src/fields/UploadBoxField.tsx:88` `UploadBoxField` (const) - 1 documentation section/link violation(s)
- `src/fields/UploadField.tsx:86` `UploadField` (const) - 1 documentation section/link violation(s)
- `src/hooks/useAppForm.tsx:125` `useAppForm` (const) - 1 documentation section/link violation(s)
- `src/internal/ComboboxFieldParts.tsx:150` `StringComboboxField` (const) - 1 documentation section/link violation(s)
- `src/internal/FieldBinding.tsx:128` `BoundField` (function) - 1 documentation section/link violation(s)
- `src/internal/FieldBinding.tsx:209` `createBoundField` (function) - 1 documentation section/link violation(s)
- `src/internal/FieldBinding.tsx:514` `createDateTimePickerField` (function) - 1 documentation section/link violation(s)
- `src/internal/FieldBinding.tsx:66` `useBoundField` (const) - 1 documentation section/link violation(s)

### @beep/identity

Path: `packages/foundation/modeling/identity`

Module findings:
- `src/Id.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/packages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Curie.ts:104` `expandOption` (const) - 1 documentation section/link violation(s)
- `src/Curie.ts:154` `contractOption` (const) - 1 documentation section/link violation(s)
- `src/Id.ts:1940` `make` (function) - 1 documentation section/link violation(s)
- `src/Id.ts:133` `IdentityInterpolationError` (class) - 1 documentation section/link violation(s)
- `src/Id.ts:164` `IdentitySegmentCountError` (class) - 1 documentation section/link violation(s)
- `src/Id.ts:217` `SegmentValue` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:350` `TitleFromIdentifier` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:372` `IriFromIdentity` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:398` `CurieFromIdentity` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:425` `SlugFromIdentifier` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:465` `ModuleSegmentValue` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:483` `ModuleAccessor` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:500` `TaggedAccessor` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:558` `SchemaAnnotationExtras` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:581` `DeclarationAnnotationExtras` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:619` `SkosClassification` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:639` `OntologyKeyOptions` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:667` `OntologyClassExtras` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:714` `HttpAnnotationExtras` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:737` `IdentityAnyAnnotationExtras` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:758` `IdentityAnnotation` (type) - 1 documentation section/link violation(s)
- `src/Id.ts:906` `IdentityComposer` (interface) - 1 documentation section/link violation(s)
- `src/PnLocal.ts:415` `escapeLocal` (const) - 1 documentation section/link violation(s)
- `src/packages.ts:40` `$I` (const) - 1 documentation section/link violation(s)

### @beep/drizzle

Path: `packages/drivers/drizzle`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Drizzle.errors.ts:91` `DrizzleErrorContext` (class) - 1 documentation section/link violation(s)
- `src/Drizzle.errors.ts:303` `DrizzleError` (class) - 1 documentation section/link violation(s)
- `src/Drizzle.service.ts:36` `DrizzleRows` (const) - 1 documentation section/link violation(s)
- `src/Drizzle.service.ts:91` `DrizzleClient` (interface) - 1 documentation section/link violation(s)
- `src/Drizzle.service.ts:130` `DrizzleShape` (interface) - 1 documentation section/link violation(s)
- `src/EntityTable.models.ts:139` `ColumnBuilderFor` (type) - 1 documentation section/link violation(s)
- `src/EntityTable.models.ts:208` `TableFor` (type) - 1 documentation section/link violation(s)
- `src/EntityTable.models.ts:502` `pgTableFrom` (const) - 1 documentation section/link violation(s)
- `src/EntityTable.models.ts:547` `columns` (const) - 1 documentation section/link violation(s)

### @beep/ontology-ui

Path: `packages/ontology/ui`

Export findings:
- `src/aggregates/Session/Session.tree.ts:62` `ontologyTreeItemsFor` (const) - 1 documentation section/link violation(s)

### @beep/api-transport

Path: `packages/foundation/capability/api-transport`

Module findings:
- `src/EgressDenied.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Transport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/EgressDenied.ts:44` `EgressDenied` (class) - 1 documentation section/link violation(s)
- `src/Transport.ts:58` `ApiAuth` (const) - 1 documentation section/link violation(s)
- `src/Transport.ts:164` `RateLimitSnapshot` (class) - 1 documentation section/link violation(s)
- `src/Transport.ts:261` `ApiTransportOptions` (class) - 1 documentation section/link violation(s)
- `src/Transport.ts:331` `ApiTransport` (interface) - 1 documentation section/link violation(s)
- `src/Transport.ts:366` `makeApiTransport` (const) - 1 documentation section/link violation(s)

### @beep/box

Path: `packages/drivers/box`

Export findings:
- `src/experimental/domain/entities/AiTaxonomy/AiTaxonomy.model.ts:32` `AiTaxonomy` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/AiTextGen/AiTextGen.model.ts:32` `AiTextGen` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/AppItem/AppItem.model.ts:32` `AppItem` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Collaboration/Collaboration.model.ts:32` `Collaboration` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Comment/Comment.model.ts:32` `Comment` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/DevicePinner/DevicePinner.ts:32` `DevicePinner` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/EmailAlias/EmailAlias.model.ts:32` `EmailAlias` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Event/Event.model.ts:32` `Event` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/File/File.model.ts:32` `File` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/FileVersion/FileVersion.model.ts:32` `FileVersion` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Folder/Folder.model.ts:32` `Folder` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/FolderReference/FolderReference.model.ts:32` `FolderReference` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Group/Group.model.ts:32` `Group` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/GroupMembership/GroupMembership.model.ts:32` `GroupMembership` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/IntegrationMapping/IntegrationMapping.model.ts:32` `IntegrationMapping` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Invite/Invite.model.ts:32` `Invite` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Item/Item.model.ts:32` `Item` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Outcome/Outcome.model.ts:32` `Outcome` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/PLACEHOLDER/PLACEHOLDER.model.ts:32` `PLACEHOLDER` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/RetentionPolicy/RetentionPolicy.model.ts:32` `RetentionPolicy` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/RetentionPolicyAssignment/RetentionPolicyAssignment.model.ts:32` `RetentionPolicyAssignment` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/SignRequest/SignRequest.model.ts:32` `SignRequest` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/SignTemplate/SignTemplate.model.ts:32` `SignTemplate` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/StoragePolicy/StoragePolicy.model.ts:32` `StoragePolicy` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/StoragePolicyAssignment/StoragePolicyAssignment.model.ts:32` `StoragePolicyAssignment` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Task/Task.model.ts:32` `Task` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TaskAssignment/TaskAssignment.model.ts:32` `TaskAssignment` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TrashFile/TrashFile.model.ts:32` `TrashFile` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TrashFileRestored/TrashFileRestored.model.ts:32` `TrashFileRestored` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TrashFolder/TrashFolder.model.ts:32` `TrashFolder` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TrashFolderRestored/TrashFolderRestored.model.ts:32` `TrashFolderRestored` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TrashWebLink/TrashWebLink.model.ts:32` `TrashWebLink` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/TrashWebLinkRestored/TrashWebLinkRestored.model.ts:32` `TrashWebLinkRestored` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/UploadSession/UploadSession.model.ts:32` `UploadSession` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/User/User.model.ts:32` `User` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/WebLink/WebLink.model.ts:32` `WebLink` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Webhook/Webhook.model.ts:32` `Webhook` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/Workflow/Workflow.model.ts:32` `Workflow` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/entities/ZipDownload/ZipDownload.model.ts:32` `ZipDownload` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/errors/ClientError.errors.ts:33` `PLACEHOLDER` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/values/Classification/Classification.model.ts:32` `Classification` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/values/Metadata/Metadata.model.ts:32` `Metadata` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/values/PLACEHOLDER/PLACEHOLDER.model.ts:32` `PLACEHOLDER` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/values/Resource/Resource.model.ts:32` `Resource` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/values/SearchResult/PLACEHOLDER.model.ts:32` `PLACEHOLDER` (class) - 1 documentation section/link violation(s)
- `src/experimental/domain/values/UploadPart/UploadPart.model.ts:32` `UploadPart` (class) - 1 documentation section/link violation(s)

### @beep/shacl

Path: `packages/drivers/shacl`

Export findings:
- `src/Shacl.validation.ts:445` `ShaclValidationServiceLive` (const) - 1 documentation section/link violation(s)

### @beep/documents-server

Path: `packages/documents/server`

Module findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/VaultSyncEngine.service.ts:1` (packageDocumentation) - 2 documentation section/link violation(s)
- `src/entities/internal/RepoSupport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:510` `makeDmsMirrorBox` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorBox.ts:770` `DmsMirrorAvailabilityBoxLayer` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncConflict/SyncConflict.repo.ts:95` `makeInMemorySyncConflictRepository` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncCursor/SyncCursor.repo.ts:103` `makeInMemorySyncCursorRepository` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncOperation/SyncOperation.repo.ts:105` `makeInMemorySyncOperationRepository` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncOperation/SyncOperation.repo.ts:255` `makeDrizzleSyncOperationRepository` (const) - 1 documentation section/link violation(s)

### @beep/nlp-processing

Path: `packages/foundation/capability/nlp-processing`

Module findings:
- `src/Backend/Composition.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Backend/NLPBackend.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/AnnotatedTextGraph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/EffectGraph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Executor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/TextGraph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/TypeClass.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/NLPService.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Backend/Composition.ts:125` `withFallback` (const) - 1 documentation section/link violation(s)
- `src/Backend/Composition.ts:273` `withCaching` (const) - 1 documentation section/link violation(s)
- `src/Backend/Composition.ts:355` `selectByCapability` (const) - 1 documentation section/link violation(s)
- `src/Backend/NLPBackend.ts:326` `NLPBackendShape` (interface) - 1 documentation section/link violation(s)
- `src/Graph/AnnotatedTextGraph.ts:370` `fromDocumentAnnotated` (const) - 2 documentation section/link violation(s)
- `src/Graph/AnnotatedTextGraph.ts:529` `addPOSAnnotations` (const) - 1 documentation section/link violation(s)
- `src/Graph/AnnotatedTextGraph.ts:605` `addDependencyAnnotations` (const) - 1 documentation section/link violation(s)
- `src/Graph/EffectGraph.ts:178` `GraphNode` (interface) - 1 documentation section/link violation(s)
- `src/Graph/EffectGraph.ts:227` `EffectGraph` (interface) - 1 documentation section/link violation(s)
- `src/Graph/EffectGraph.ts:526` `cata` (const) - 1 documentation section/link violation(s)
- `src/Graph/EffectGraph.ts:733` `show` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:52` `sentencize` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:80` `tokenize` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:109` `posTag` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:137` `lemmatize` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:164` `extractEntities` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:193` `parseDependencies` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:223` `extractRelations` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:311` `StandardOperations` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Errors.ts:109` `OperationError` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Errors.ts:174` `StorageError` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Errors.ts:236` `GraphOperationError` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Executor.ts:79` `GraphExecutorShape` (interface) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Executor.ts:123` `GraphExecutor` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Executor.ts:502` `GraphExecutorLive` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Executor.ts:533` `GraphExecutorTest` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:57` `GraphOperation` (interface) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:99` `make` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:140` `pure` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:176` `transform` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:212` `expand` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:242` `filter` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:276` `identity` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:67` `AnyOperationResult` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:107` `ResultKey` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:209` `ResultStoreShape` (interface) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:348` `ResultStoreLive` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:64` `MAX_PARALLEL_CONCURRENCY` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:88` `ExecutionStrategy` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:155` `ExecutionMetrics` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:418` `OperationCost` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:508` `ValidationResult` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:613` `ExecutionOptions` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:721` `OperationResult` (interface) - 1 documentation section/link violation(s)
- `src/Graph/TextGraph.ts:207` `fromDocument` (const) - 1 documentation section/link violation(s)
- `src/Graph/TextGraph.ts:381` `tokenizeNodes` (const) - 1 documentation section/link violation(s)
- `src/Graph/TextGraph.ts:782` `show` (const) - 1 documentation section/link violation(s)
- `src/NLPService.ts:50` `NLPServiceShape` (interface) - 1 documentation section/link violation(s)
- `src/NLPService.ts:119` `make` (const) - 1 documentation section/link violation(s)
- `src/Tools/Analyze.ts:50` `Analyze` (const) - 1 documentation section/link violation(s)
- `src/Tools/BagOfWords.ts:61` `BagOfWords` (const) - 1 documentation section/link violation(s)
- `src/Tools/BowCosineSimilarity.ts:70` `BowCosineSimilarity` (const) - 1 documentation section/link violation(s)
- `src/Tools/ChunkBySentences.ts:67` `ChunkBySentences` (const) - 1 documentation section/link violation(s)
- `src/Tools/CorpusStats.ts:61` `CorpusStats` (const) - 1 documentation section/link violation(s)
- `src/Tools/CreateCorpus.ts:75` `CreateCorpus` (const) - 1 documentation section/link violation(s)
- `src/Tools/DeleteCorpus.ts:58` `DeleteCorpus` (const) - 1 documentation section/link violation(s)
- `src/Tools/DocumentStats.ts:50` `DocumentStats` (const) - 1 documentation section/link violation(s)
- `src/Tools/ExtractEntities.ts:78` `ExtractEntities` (const) - 1 documentation section/link violation(s)
- `src/Tools/ExtractKeywords.ts:65` `ExtractKeywords` (const) - 1 documentation section/link violation(s)
- `src/Tools/LearnCorpus.ts:81` `LearnCorpus` (const) - 1 documentation section/link violation(s)
- `src/Tools/LearnCustomEntities.ts:99` `LearnCustomEntities` (const) - 1 documentation section/link violation(s)
- `src/Tools/NGrams.ts:87` `NGrams` (const) - 1 documentation section/link violation(s)
- `src/Tools/NlpToolkit.ts:89` `NlpTools` (const) - 1 documentation section/link violation(s)
- `src/Tools/NlpToolkit.ts:140` `NlpToolkit` (const) - 1 documentation section/link violation(s)
- `src/Tools/Paragraphize.ts:60` `Paragraphize` (const) - 1 documentation section/link violation(s)
- `src/Tools/PhoneticMatch.ts:63` `PhoneticMatch` (const) - 1 documentation section/link violation(s)
- `src/Tools/QueryCorpus.ts:87` `QueryCorpus` (const) - 1 documentation section/link violation(s)
- `src/Tools/RankByRelevance.ts:76` `RankByRelevance` (const) - 1 documentation section/link violation(s)
- `src/Tools/RemoveStopWords.ts:61` `RemoveStopWords` (const) - 1 documentation section/link violation(s)
- `src/Tools/Sentences.ts:60` `Sentences` (const) - 1 documentation section/link violation(s)
- `src/Tools/Stem.ts:60` `Stem` (const) - 1 documentation section/link violation(s)
- `src/Tools/TextSimilarity.ts:70` `TextSimilarity` (const) - 1 documentation section/link violation(s)
- `src/Tools/Tokenize.ts:61` `Tokenize` (const) - 1 documentation section/link violation(s)
- `src/Tools/ToolExport.ts:112` `ExportedToolError` (class) - 1 documentation section/link violation(s)
- `src/Tools/ToolExport.ts:174` `ExportedTool` (interface) - 1 documentation section/link violation(s)
- `src/Tools/ToolExport.ts:396` `exportTools` (const) - 1 documentation section/link violation(s)
- `src/Tools/TransformText.ts:95` `TransformText` (const) - 1 documentation section/link violation(s)
- `src/Tools/TverskySimilarity.ts:85` `TverskySimilarity` (const) - 1 documentation section/link violation(s)
- `src/Tools/WordCount.ts:60` `WordCount` (const) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:117` `AiToken` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:173` `AiAnalysis` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:212` `AiSentence` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:247` `AiKeyword` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:281` `AiDocumentStats` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:318` `AiSentenceChunk` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:353` `AiRankedText` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:390` `AiEntity` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:427` `AiNGram` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:462` `AiPhoneticMatch` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:501` `AiToolError` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:538` `AiCorpusConfig` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:575` `AiCorpusSummary` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:612` `AiCorpusRankedDocument` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:645` `AiCorpusIdf` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:677` `AiCorpusMatrixShape` (class) - 1 documentation section/link violation(s)
- `src/Tools/_schemas.ts:715` `AiCorpusStats` (class) - 1 documentation section/link violation(s)

### @beep/anthropic

Path: `packages/drivers/anthropic`

Export findings:
- `src/Anthropic.config.ts:39` `ANTHROPIC_API_KEY_ENV` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.config.ts:64` `ANTHROPIC_MODEL_ENV` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.config.ts:87` `ANTHROPIC_DEFAULT_MODEL` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.config.ts:173` `AnthropicApproximatePrice` (class) - 1 documentation section/link violation(s)
- `src/Anthropic.config.ts:236` `AnthropicLanguageModelOptions` (class) - 1 documentation section/link violation(s)
- `src/Anthropic.errors.ts:38` `RepairError` (class) - 1 documentation section/link violation(s)
- `src/Anthropic.repair.ts:137` `makeAnthropicRepairPlan` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.repair.ts:181` `collectToolParamsJson` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.repair.ts:255` `collectToolParamsJsonWithUsage` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.repair.ts:319` `generateAnthropicToolJson` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.service.ts:76` `makeAnthropicLanguageModelLayer` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.service.ts:110` `AnthropicLanguageModelLive` (const) - 1 documentation section/link violation(s)
- `src/Anthropic.service.ts:139` `makeAnthropicTurnPlan` (const) - 1 documentation section/link violation(s)

### @beep/professional-desktop

Path: `apps/professional-desktop`

Module findings:
- `src/App.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ChatOrchestrator.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/UsageRecordSink.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/ChatApp.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/Composer.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/MessageView.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/Sidebar.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/StreamingBlocks.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/ThemeToggle.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/Thread.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/editor-state.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/layout.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/contradiction/ContradictionQaSeed.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/intake/VaultDirectoryPickerOrchestrator.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ontology/OntologyWorkspaceSeed.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Migrations.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Observability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Pglite.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/spikes/Graph3DSpike.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/sync/DmsMirrorDisconnected.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/transport/IpcChatClient.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/transport/IpcSpikePanel.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/transport/TauriIpcSocket.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/workspace/dock.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/chat/UsageRecordSink.ts:119` `UsageRecordSinkInMemory` (const) - 1 documentation section/link violation(s)
- `src/chat/ui/Composer.atoms.ts:184` `normalizeLegacyRawDocument` (const) - 1 documentation section/link violation(s)
- `src/chat/ui/layout.atoms.ts:123` `sidebarPercentAtom` (const) - 1 documentation section/link violation(s)
- `src/chat/ui/layout.atoms.ts:179` `clampSidebarPercent` (const) - 1 documentation section/link violation(s)
- `src/chat/ui/layout.atoms.ts:201` `sidebarSize` (const) - 1 documentation section/link violation(s)
- `src/contradiction/ContradictionQaSeed.ts:150` `CONTRADICTION_QA_ANCHOR_START` (const) - 1 documentation section/link violation(s)
- `src/contradiction/ContradictionQaSeed.ts:956` `seedContradictionQaFixtures` (const) - 1 documentation section/link violation(s)
- `src/contradiction/ContradictionQaSeed.ts:1055` `ContradictionQaSeedLive` (const) - 1 documentation section/link violation(s)
- `src/intake/Intake.atoms.ts:48` `DesktopIntakeClient` (class) - 1 documentation section/link violation(s)
- `src/ontology/OntologyWorkspaceSeed.ts:70` `seedPizzaTutorial` (const) - 1 documentation section/link violation(s)
- `src/ontology/OntologyWorkspaceSeed.ts:124` `OntologyWorkspaceSeedLive` (const) - 1 documentation section/link violation(s)
- `src/runtime/BrowserFailure.atoms.ts:132` `reportedBrowserFailureAtoms` (const) - 1 documentation section/link violation(s)
- `src/runtime/Migrations.ts:113` `SidecarReadyMarker` (const) - 1 documentation section/link violation(s)
- `src/runtime/Pglite.ts:91` `ChatDbCompatibilityMarker` (const) - 1 documentation section/link violation(s)
- `src/runtime/Pglite.ts:222` `ensureCompatibleChatDbDataDir` (const) - 1 documentation section/link violation(s)
- `src/runtime/ProfessionalAtomRuntime.ts:84` `professionalAtomRegistryAtom` (const) - 1 documentation section/link violation(s)
- `src/sync/Sync.atoms.ts:240` `vaultSyncStatusAtom` (const) - 1 documentation section/link violation(s)
- `src/sync/Sync.atoms.ts:381` `vaultSyncCommandAtoms` (const) - 1 documentation section/link violation(s)
- `src/sync/VaultSyncOrchestrator.ts:74` `VaultSyncHandlersLive` (const) - 1 documentation section/link violation(s)
- `src/sync/VaultSyncPanel.tsx:185` `VaultSyncPanel` (function) - 1 documentation section/link violation(s)
- `src/theme/Theme.atoms.ts:59` `migrateWorkbenchThemeMode` (const) - 1 documentation section/link violation(s)
- `src/workspace/ProfessionalWorkspace.ts:26` `DEFAULT_PROFESSIONAL_WORKSPACE_ID` (const) - 1 documentation section/link violation(s)

### @beep/epistemic-domain

Path: `packages/epistemic/domain`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionGrant/ExecutionGrant.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionVerdict/ExecutionVerdict.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/EdgeVersion/EdgeVersion.model.ts:106` `EdgeVersion` (class) - 1 documentation section/link violation(s)
- `src/entities/EvidenceVerification/EvidenceVerification.model.ts:43` `EvidenceVerification` (class) - 1 documentation section/link violation(s)
- `src/values/Contradiction/Contradiction.model.ts:362` `ContradictionBeliefPair` (class) - 1 documentation section/link violation(s)
- `src/values/Contradiction/Contradiction.model.ts:945` `ContradictionDispositionStatus` (const) - 1 documentation section/link violation(s)
- `src/values/Contradiction/Contradiction.model.ts:1005` `ContradictionReviewReason` (const) - 1 documentation section/link violation(s)
- `src/values/Contradiction/Contradiction.model.ts:1171` `canonicalizeContradiction` (const) - 1 documentation section/link violation(s)
- `src/values/Contradiction/Contradiction.model.ts:1226` `contradictionEvidenceDigest` (const) - 1 documentation section/link violation(s)
- `src/values/EvidenceVerification/EvidenceVerification.model.ts:38` `EvidenceVerificationManifestationKey` (const) - 1 documentation section/link violation(s)
- `src/values/EvidenceVerification/EvidenceVerification.model.ts:112` `evidenceVerificationManifestationKey` (const) - 1 documentation section/link violation(s)
- `src/values/ExecutionGrant/ExecutionGrant.model.ts:86` `SinkAudience` (const) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:652` `verifyExecutionDecisionChain` (const) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:698` `verifyOutcomeBinding` (const) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:281` `addGrant` (const) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:486` `evaluateExecutionRequest` (const) - 1 documentation section/link violation(s)

### @beep/ontology-client

Path: `packages/ontology/client`

Export findings:
- `src/aggregates/Session/Session.atoms.ts:459` `openPathInputAtom` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.atoms.ts:1042` `ontologyDocumentErrorAtom` (const) - 1 documentation section/link violation(s)

### @beep/architecture-lab-use-cases

Path: `packages/architecture-lab/use-cases`

Export findings:
- `src/aggregates/WorkItem/WorkItem.repository.ts:216` `WorkItemRepositoryShape` (interface) - 1 documentation section/link violation(s)
- `src/aggregates/WorkItem/WorkItem.service.ts:63` `toWorkItemActionError` (const) - 1 documentation section/link violation(s)
- `src/aggregates/WorkItem/WorkItem.service.ts:154` `makeWorkItemUseCases` (const) - 1 documentation section/link violation(s)
- `src/aggregates/WorkItem/WorkItem.use-cases.ts:105` `WorkItemUseCases` (class) - 1 documentation section/link violation(s)
- `src/entities/Worker/Worker.repository.ts:208` `WorkerRepositoryShape` (interface) - 1 documentation section/link violation(s)
- `src/entities/Worker/Worker.service.ts:53` `toWorkerActionError` (const) - 1 documentation section/link violation(s)
- `src/entities/Worker/Worker.service.ts:110` `makeWorkerUseCases` (const) - 1 documentation section/link violation(s)
- `src/entities/Worker/Worker.use-cases.ts:83` `WorkerUseCases` (class) - 1 documentation section/link violation(s)

### @beep/ecfr

Path: `packages/drivers/ecfr`

Module findings:
- `src/Ecfr.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/_generated/Ecfr.generated.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/oxigraph

Path: `packages/drivers/oxigraph`

Export findings:
- `src/Oxigraph.sparql.ts:284` `OxigraphSparqlQueryServiceLive` (const) - 1 documentation section/link violation(s)

### @beep/nlp

Path: `packages/foundation/modeling/nlp`

Module findings:
- `src/Algebra/NLPMonoid.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/Schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Handoff/Contract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Handoff/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology/Kind.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Operations/Composable.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Operations/Definition.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Operations/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Algebra/Monoid.ts:40` `Monoid` (interface) - 1 documentation section/link violation(s)
- `src/Algebra/Monoid.ts:99` `fold` (const) - 1 documentation section/link violation(s)
- `src/Algebra/Monoid.ts:153` `StringConcat` (const) - 1 documentation section/link violation(s)
- `src/Algebra/Monoid.ts:176` `StringJoin` (const) - 1 documentation section/link violation(s)
- `src/Algebra/Monoid.ts:358` `MultiSet` (const) - 1 documentation section/link violation(s)
- `src/Algebra/Monoid.ts:418` `SetIntersection` (const) - 1 documentation section/link violation(s)
- `src/Algebra/NLPMonoid.ts:126` `TokenConcat` (const) - 1 documentation section/link violation(s)
- `src/Algebra/NLPMonoid.ts:149` `TokenBagOfWords` (const) - 1 documentation section/link violation(s)
- `src/Algebra/NLPMonoid.ts:203` `SentenceConcat` (const) - 1 documentation section/link violation(s)
- `src/Algebra/NLPMonoid.ts:342` `AnnotationMap` (const) - 1 documentation section/link violation(s)
- `src/Algebra/NLPMonoid.ts:734` `computeTFIDF` (const) - 1 documentation section/link violation(s)
- `src/Core/Document.ts:195` `Document` (class) - 1 documentation section/link violation(s)
- `src/Core/Pattern.ts:96` `UniversalPOSTag` (const) - 1 documentation section/link violation(s)
- `src/Core/Pattern.ts:188` `POSPatternOption` (const) - 1 documentation section/link violation(s)
- `src/Core/Pattern.ts:268` `LiteralPatternOption` (const) - 1 documentation section/link violation(s)
- `src/Core/Pattern.ts:457` `MarkRange` (const) - 1 documentation section/link violation(s)
- `src/Core/Pattern.ts:504` `Pattern` (class) - 1 documentation section/link violation(s)
- `src/Core/Sentence.ts:110` `Sentence` (class) - 1 documentation section/link violation(s)
- `src/Core/Token.ts:36` `TokenIndex` (type) - 1 documentation section/link violation(s)
- `src/Core/Token.ts:109` `CharPosition` (type) - 1 documentation section/link violation(s)
- `src/Core/Token.ts:207` `Token` (class) - 1 documentation section/link violation(s)
- `src/Graph/GraphOps.ts:251` `mapNodes` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOps.ts:608` `buildIndex` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOps.ts:735` `traverseNodes` (const) - 1 documentation section/link violation(s)
- `src/Graph/GraphOps.ts:825` `mapNodesEffect` (const) - 1 documentation section/link violation(s)
- `src/IdentifierText.ts:40` `tokens` (const) - 1 documentation section/link violation(s)
- `src/IdentifierText.ts:65` `variants` (const) - 1 documentation section/link violation(s)
- `src/Ontology/Kind.ts:50` `TextKind` (const) - 1 documentation section/link violation(s)
- `src/Ontology/Kind.ts:162` `TypedText` (type) - 1 documentation section/link violation(s)
- `src/Ontology/Kind.ts:385` `KindContainment` (class) - 1 documentation section/link violation(s)
- `src/PathText.ts:47` `normalizePathPhrase` (const) - 1 documentation section/link violation(s)
- `src/PathText.ts:69` `isPathLike` (const) - 1 documentation section/link violation(s)
- `src/PathText.ts:91` `filePathVariants` (const) - 1 documentation section/link violation(s)
- `src/PathText.ts:112` `moduleSpecifierVariants` (const) - 1 documentation section/link violation(s)
- `src/QueryText.ts:33` `normalizeQuestion` (const) - 1 documentation section/link violation(s)
- `src/QueryText.ts:54` `normalizePhrase` (const) - 1 documentation section/link violation(s)
- `src/VariantText.ts:35` `orderedDedupe` (const) - 1 documentation section/link violation(s)

### @beep/infra

Path: `infra`

Module findings:
- `src/OpenClaw.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/OpenClaw.ts:400` `OpenClawExpectedIdentity` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:563` `OpenClawDeploymentConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:757` `OpenClawBackupConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:817` `OpenClawGeneration` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1151` `makeOpenClawGeneration` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1227` `renderOpenClawUnit` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1298` `renderOpenClawRunScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1397` `renderOpenClawGenerationTree` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1460` `renderOpenClawPreflightScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1588` `renderOpenClawStageScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1717` `renderOpenClawApplyScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1836` `renderOpenClawRollbackScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1984` `renderOpenClawDriftAuditScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2037` `renderOpenClawProbeScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2109` `renderOpenClawLiveAcceptanceScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2206` `renderOpenClawBackupShipScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2270` `OpenClawStackArgs` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2354` `makeOpenClawStackArgsFromConfigValues` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2557` `OpenClawStack` (class) - 1 documentation section/link violation(s)

### @beep/fc-runs

Path: `packages/tooling/test-kit/fc-runs`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/FastCheckRuns.ts:57` `parseFcNumRunsFloor` (const) - 1 documentation section/link violation(s)
- `src/FastCheckRuns.ts:90` `envFcNumRunsFloor` (const) - 1 documentation section/link violation(s)
- `src/FastCheckRuns.ts:114` `fcRuns` (const) - 1 documentation section/link violation(s)

### @beep/repo-utils

Path: `packages/tooling/library/repo-utils`

Module findings:
- `src/Dependencies.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/DependencyIndex.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FsUtils.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TagValue.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JsonUtils.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Root.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TsConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UniqueDeps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/errors/CyclicDependencyError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/DomainError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/NoSuchFileError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/OptionInjectionError.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/WorkspaceDeps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Dependencies.ts:75` `extractWorkspaceDependencies` (const) - 1 documentation section/link violation(s)
- `src/DependencyIndex.ts:52` `buildRepoDependencyIndex` (const) - 1 documentation section/link violation(s)
- `src/FsUtils.ts:340` `WalkFilesSymlinkGuard` (type) - 1 documentation section/link violation(s)
- `src/FsUtils.ts:411` `walkFiles` (const) - 1 documentation section/link violation(s)
- `src/FsUtils.ts:501` `exists` (const) - 1 documentation section/link violation(s)
- `src/FsUtils.ts:539` `findNearestPackageDir` (const) - 1 documentation section/link violation(s)
- `src/Graph.ts:100` `topologicalSort` (const) - 1 documentation section/link violation(s)
- `src/Graph.ts:150` `detectCycles` (const) - 1 documentation section/link violation(s)
- `src/Graph.ts:297` `computeTransitiveClosure` (const) - 1 documentation section/link violation(s)
- `src/JSDoc/models/ASTDerivability.model.ts:31` `ASTDerivability` (const) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TSCategory.model.ts:1480` `getCandidateCategories` (function) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TSCategory.model.ts:1540` `resolveContextFallback` (function) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TSCategory.model.ts:301` `make` (const) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TSCategory.model.ts:1147` `CATEGORY_PRECEDENCE` (const) - 1 documentation section/link violation(s)
- `src/JSDoc/models/tag-values/index.ts:362` `TagValue` (const) - 1 documentation section/link violation(s)
- `src/JSDoc/models/tag-values/index.ts:548` `TagName` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:64` `END_OF_OPTIONS` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:87` `isOptionLike` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:119` `insertEndOfOptions` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:155` `toLiteralArgs` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:182` `guardLiteralArg` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:214` `guardLiteralArgs` (const) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:242` `LiteralArg` (const) - 1 documentation section/link violation(s)
- `src/Root.ts:42` `findRepoRoot` (const) - 1 documentation section/link violation(s)
- `src/TsConfig.ts:45` `collectTsConfigPaths` (const) - 1 documentation section/link violation(s)
- `src/TypeScript/models/TSSyntaxKind.model.ts:462` `TSSyntaxKind` (const) - 1 documentation section/link violation(s)
- `src/UniqueDeps.ts:93` `collectUniqueNpmDependencies` (const) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:62` `workspaceGlobsFrom` (const) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:112` `resolveWorkspaceDirs` (const) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:215` `getWorkspaceDir` (const) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:246` `WorkspacePackage` (class) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:283` `resolveWorkspacePackages` (const) - 1 documentation section/link violation(s)
- `src/schemas/BiomeJson.ts:57` `renderBiomeJson` (const) - 1 documentation section/link violation(s)
- `src/schemas/DocgenConfig.ts:40` `DEFAULT_DOCGEN_EXCLUDE` (const) - 1 documentation section/link violation(s)
- `src/schemas/DocgenConfig.ts:121` `CanonicalDocgenExamplesCompilerOptions` (class) - 1 documentation section/link violation(s)
- `src/schemas/DocgenConfig.ts:433` `createCanonicalDocgenConfig` (const) - 1 documentation section/link violation(s)
- `src/schemas/DocgenConfig.ts:531` `mergeManagedDocgenConfig` (const) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1096` `NpmPackageJson` (class) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1118` `PackageJson` (class) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1640` `decodePackageJsonEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1669` `encodePackageJsonEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1728` `encodePackageJsonPrettyEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1758` `readPackageJsonFile` (const) - 1 documentation section/link violation(s)
- `src/schemas/PackageJsonTools.ts:331` `normalizePackageJsonEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1586` `TSConfig` (class) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1865` `decodeTSConfigEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1895` `decodeTSConfigFromJsoncTextEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1920` `encodeTSConfigEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1965` `encodeTSConfigPrettyEffect` (const) - 1 documentation section/link violation(s)
- `src/schemas/TsconfigAliasTargets.ts:174` `resolveRootExportTarget` (const) - 1 documentation section/link violation(s)
- `src/schemas/TsconfigAliasTargets.ts:249` `buildCanonicalAliasTargets` (const) - 1 documentation section/link violation(s)
- `src/schemas/TsconfigAliasTargets.ts:288` `deriveWildcardAliasTargetFromExport` (const) - 1 documentation section/link violation(s)
- `src/schemas/TsconfigAliasTargets.ts:321` `isFileStemWildcardExportTarget` (const) - 1 documentation section/link violation(s)
- `src/schemas/WorkspaceDeps.ts:86` `WorkspaceDeps` (class) - 1 documentation section/link violation(s)

### @beep/documents-domain

Path: `packages/documents/domain`

Export findings:
- `src/values/Sync/Sync.values.ts:33` `DmsProvider` (const) - 1 documentation section/link violation(s)

### @beep/schema

Path: `packages/foundation/modeling/schema`

Module findings:
- `src/AtURI.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/BigDecimal.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/BinaryFileExtension.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Color/Color.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Did.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EffectSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthAmount/EthAmount.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EvmAddress/EvmAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FileExtension.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FileName.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float16Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fn/Fn.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Glob/Glob.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.shared.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LiteralKit/LiteralKit.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Options.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Percentage.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PromiseSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SafeRemoteHost.ts:1` (packageDocumentation) - 2 documentation section/link violation(s)
- `src/SchemaUtils/pluck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/split.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withCodecStatics.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withConstructorDefaults.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UnitInterval.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AtURI.ts:227` `AtUri` (const) - 7 documentation section/link violation(s)
- `src/BigDecimal.ts:33` `BigDecimalFromNumber` (const) - 1 documentation section/link violation(s)
- `src/BinaryFileExtension.ts:238` `hasBinaryExtension` (function) - 1 documentation section/link violation(s)
- `src/BinaryFileExtension.ts:265` `isBinaryContent` (function) - 1 documentation section/link violation(s)
- `src/BinaryFileExtension.ts:175` `BinaryFileExtension` (const) - 1 documentation section/link violation(s)
- `src/Bytes.ts:48` `Bytes` (const) - 1 documentation section/link violation(s)
- `src/CauseTaggedError/CauseTaggedError.errors.ts:510` `CauseTaggedError` (const) - 1 documentation section/link violation(s)
- `src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts:149` `CrossOriginEmbedderPolicyHeader` (const) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:163` `createDirectiveValue` (const) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:342` `FetchDirective` (class) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:431` `DocumentDirective` (class) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:494` `NavigationDirective` (class) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:593` `ReportingDirective` (class) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:647` `CspDirectives` (class) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:681` `ContentSecurityPolicyOptionStruct` (class) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:874` `createContentSecurityPolicyOptionHeaderValue` (const) - 1 documentation section/link violation(s)
- `src/Csp/Csp.schema.ts:925` `ContentSecurityPolicyHeader` (const) - 1 documentation section/link violation(s)
- `src/Csv/Csv.schema.ts:310` `Csv` (const) - 1 documentation section/link violation(s)
- `src/Csv/Csv.schema.ts:310` `CSV` (const) - 1 documentation section/link violation(s)
- `src/Csv/Csv.schema.ts:310` `Schema` (const) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:168` `DateTimeInputString` (const) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:211` `DateTimeInputNumber` (const) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:253` `DateTimeInputDate` (const) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:295` `DateTimeInputDateTime` (const) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:392` `DateTimeInputParts` (class) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:427` `DateTimeInput` (const) - 1 documentation section/link violation(s)
- `src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts:517` `DateTimeUtcFromValid` (const) - 1 documentation section/link violation(s)
- `src/Did.ts:75` `Did` (const) - 4 documentation section/link violation(s)
- `src/DomainModel.ts:33` `defaultFields` (const) - 1 documentation section/link violation(s)
- `src/Double.ts:56` `Double` (const) - 1 documentation section/link violation(s)
- `src/EffectSchema.ts:58` `isEffect` (const) - 1 documentation section/link violation(s)
- `src/Email.ts:30` `EmailString` (const) - 1 documentation section/link violation(s)
- `src/Email.ts:69` `Email` (const) - 1 documentation section/link violation(s)
- `src/FileExtension.ts:68` `extractMimeExtensions` (const) - 1 documentation section/link violation(s)
- `src/FilePath/FilePath.schema.ts:155` `FilePath` (const) - 1 documentation section/link violation(s)
- `src/Fixed32.ts:66` `Fixed32` (const) - 1 documentation section/link violation(s)
- `src/Fixed64.ts:56` `Fixed64` (const) - 1 documentation section/link violation(s)
- `src/Float.ts:61` `Float` (const) - 1 documentation section/link violation(s)
- `src/Float16Array.ts:82` `Float16Arr` (const) - 1 documentation section/link violation(s)
- `src/Float16Array.ts:141` `Float16ArrayFromArray` (const) - 1 documentation section/link violation(s)
- `src/Float16Array.ts:232` `Float16ArrayField` (const) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:40` `Float32Arr` (const) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:95` `Float32ArrayFromArray` (const) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:183` `Float32ArrayField` (const) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:40` `Float64Arr` (const) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:95` `Float64ArrayFromArray` (const) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:183` `Float64ArrayField` (const) - 1 documentation section/link violation(s)
- `src/Glob/Glob.schema.ts:113` `Glob` (const) - 1 documentation section/link violation(s)
- `src/Graph/Graph.edge.ts:222` `Edge` (const) - 1 documentation section/link violation(s)
- `src/Graph/Graph.primitives.ts:30` `NodeIndex` (const) - 1 documentation section/link violation(s)
- `src/Graph/Graph.transforms.ts:187` `DirectedGraph` (const) - 1 documentation section/link violation(s)
- `src/Html.ts:33` `HtmlFragment` (const) - 1 documentation section/link violation(s)
- `src/Int64.ts:35` `isInt64` (function) - 1 documentation section/link violation(s)
- `src/Int64.ts:72` `Int64` (const) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.schema.ts:144` `SubSchema` (const) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.shared.ts:949` `ExtensionsBag` (const) - 1 documentation section/link violation(s)
- `src/LiteralKit/LiteralKit.schema.ts:47` `LiteralToKey` (type) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:52` `LocalDate` (class) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:667` `LocalDateFromString` (const) - 1 documentation section/link violation(s)
- `src/MappedLiteralKit/MappedLiteralKit.schema.ts:350` `MappedLiteralKit` (function) - 1 documentation section/link violation(s)
- `src/Markdown.ts:123` `Markdown` (const) - 1 documentation section/link violation(s)
- `src/Markdown.ts:174` `MarkdownTextToHtml` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.codecs.ts:58` `JsonFromString` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.datetime.ts:168` `DateTimeInsert` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.datetime.ts:215` `DateTimeInsertFromDate` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.datetime.ts:262` `DateTimeInsertFromNumber` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.datetime.ts:311` `DateTimeUpdate` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.datetime.ts:361` `DateTimeUpdateFromDate` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.datetime.ts:411` `DateTimeUpdateFromNumber` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.fields.ts:58` `Generated` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.fields.ts:106` `GeneratedByApp` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.fields.ts:157` `GeneratedByAppOnInsert` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.fields.ts:204` `Sensitive` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.fields.ts:278` `FieldOption` (interface) - 1 documentation section/link violation(s)
- `src/Model/Model.fields.ts:306` `FieldOption` (const) - 1 documentation section/link violation(s)
- `src/Model/Model.variants.ts:52` `Class` (BindingElement) - 1 documentation section/link violation(s)
- `src/Options.ts:86` `OptionFromOptionalNullishKey` (const) - 2 documentation section/link violation(s)
- `src/ParserOptions/ParserOptions.schema.ts:150` `ParserOptions` (class) - 1 documentation section/link violation(s)
- `src/ParserOptions/ParserOptions.schema.ts:150` `Schema` (class) - 1 documentation section/link violation(s)
- `src/Port.ts:68` `Port` (const) - 1 documentation section/link violation(s)
- `src/Port.ts:118` `PortFromString` (const) - 1 documentation section/link violation(s)
- `src/PromiseSchema.ts:64` `isPromise` (const) - 1 documentation section/link violation(s)
- `src/SafeObject/SafeObject.schema.ts:39` `SafeObject` (const) - 1 documentation section/link violation(s)
- `src/SafeObject/SafeObject.schema.ts:89` `SafeObjectFromObjectKeyword` (const) - 1 documentation section/link violation(s)
- `src/SafeObject/SafeObject.schema.ts:39` `Schema` (const) - 1 documentation section/link violation(s)
- `src/SafeRemoteHost.ts:86` `BlockedHostError` (class) - 1 documentation section/link violation(s)
- `src/SafeRemoteHost.ts:269` `isBlockedRemoteHost` (const) - 1 documentation section/link violation(s)
- `src/SafeRemoteHost.ts:309` `assertAllowedRemoteHost` (const) - 1 documentation section/link violation(s)
- `src/SafeRemoteHost.ts:372` `assertAllowedRemoteUrl` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/isCodecDataFirst.ts:46` `isCodecDataFirst` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/optional.ts:45` `optional` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/optionalKeyWithDefaults.ts:36` `optionalKeyWithDefault` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/pluck.ts:58` `pluck` (function) - 1 documentation section/link violation(s)
- `src/SchemaUtils/split.ts:48` `split` (function) - 1 documentation section/link violation(s)
- `src/SchemaUtils/toEquivalence.ts:32` `DualEquivalence` (type) - 1 documentation section/link violation(s)
- `src/SchemaUtils/toEquivalence.ts:64` `toEquivalence` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withConstructorDefaults.ts:46` `withNoneDefault` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withConstructorDefaults.ts:80` `withConstantDefault` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withEncodeDefault.ts:45` `withEncodeDefault` (const) - 2 documentation section/link violation(s)
- `src/SchemaUtils/withKeyDefaults.ts:114` `withEmptyArrayDefaults` (function) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withKeyDefaults.ts:50` `withKeyDefaults` (const) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withStatics.ts:103` `withStatics` (const) - 1 documentation section/link violation(s)
- `src/Semver.ts:374` `Semver` (class) - 1 documentation section/link violation(s)
- `src/Sfixed32.ts:66` `Sfixed32` (const) - 1 documentation section/link violation(s)
- `src/Sfixed64.ts:56` `Sfixed64` (const) - 1 documentation section/link violation(s)
- `src/Sint32.ts:66` `Sint32` (const) - 1 documentation section/link violation(s)
- `src/Sint64.ts:56` `Sint64` (const) - 1 documentation section/link violation(s)
- `src/Slug.ts:83` `Slug` (const) - 1 documentation section/link violation(s)
- `src/StatusCauseError.ts:62` `StatusCauseInputOptions` (class) - 1 documentation section/link violation(s)
- `src/StatusCauseError.ts:193` `makeStatusCauseError` (const) - 1 documentation section/link violation(s)
- `src/StatusCauseTaggedErrorClass/StatusCauseTaggedErrorClass.errors.ts:528` `StatusCauseTaggedErrorClass` (const) - 1 documentation section/link violation(s)
- `src/String.ts:227` `StrFromUnknown` (const) - 1 documentation section/link violation(s)
- `src/TaggedErrorClass/TaggedErrorClass.errors.ts:342` `TaggedErrorClass` (const) - 1 documentation section/link violation(s)
- `src/TerritoryCode.ts:114` `TerritoryNameFromCode` (const) - 1 documentation section/link violation(s)
- `src/Timestamp/Timestamp.schema.ts:45` `ISOStr` (const) - 1 documentation section/link violation(s)
- `src/Timestamp/Timestamp.schema.ts:233` `Timestamp` (class) - 1 documentation section/link violation(s)
- `src/Transformations.ts:47` `destructiveTransform` (const) - 1 documentation section/link violation(s)
- `src/Uint32.ts:66` `Uint32` (const) - 1 documentation section/link violation(s)
- `src/Uint64.ts:56` `Uint64` (const) - 1 documentation section/link violation(s)

### @beep/epistemic-server

Path: `packages/epistemic/server`

Module findings:
- `src/ClaimDisposition/ClaimDisposition.repo.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.repo.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.repo.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ClaimDisposition/ClaimDisposition.repo.ts:77` `makeInMemoryClaimDispositionRepository` (const) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.layer.ts:33` `EdgeAuthorityRepositoryDrizzle` (const) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.repo.ts:178` `supersessionHeadOf` (const) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.repo.ts:331` `supersedeEdgeFactInTransaction` (const) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.layer.ts:33` `ExecutionLedgerDrizzle` (const) - 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:212` `makeGovernedEgressFetch` (const) - 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:64` `GovernedEgressLive` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:124` `GovernedTierGateOptions` (class) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:181` `refusalGuidance` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:238` `makeGovernedTierGate` (const) - 1 documentation section/link violation(s)
- `src/Layer.ts:150` `EpistemicServerRpcLive` (const) - 1 documentation section/link violation(s)
- `src/Layer.ts:173` `EpistemicServerDrizzleRpcLive` (const) - 1 documentation section/link violation(s)

### @beep/rdf

Path: `packages/foundation/modeling/rdf`

Module findings:
- `src/Vocab/Dcterms.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `src/Vocab/Xsd.ts:26` `XSD_NAMESPACE` (const) - 1 documentation section/link violation(s)

### @beep/govinfo

Path: `packages/drivers/govinfo`

Module findings:
- `src/Govinfo.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/domain/contracts/Api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/domain/contracts/Search/Search.contract.ts:44` `Payload` (class) - 1 documentation section/link violation(s)
- `src/domain/values/CollectionContainer/CollectionContainer.model.ts:48` `CollectionContainer` (class) - 1 documentation section/link violation(s)
- `src/domain/values/GranuleContainer/GranuleContainer.model.ts:51` `GranuleContainer` (class) - 1 documentation section/link violation(s)
- `src/domain/values/GranuleMetadata/GranuleMetadata.model.ts:51` `GranuleMetadata` (class) - 1 documentation section/link violation(s)
- `src/domain/values/PackageInfo/PackageInfo.model.ts:40` `PackageInfo` (class) - 1 documentation section/link violation(s)
- `src/domain/values/SearchBody/SearchBody.model.ts:43` `SearchBody` (class) - 1 documentation section/link violation(s)
- `src/domain/values/SearchResult/SearchResult.model.ts:47` `SearchResult` (class) - 1 documentation section/link violation(s)
- `src/domain/values/Sort/Sort.model.ts:36` `SortBase` (class) - 1 documentation section/link violation(s)
- `src/domain/values/Sort/Sort.model.ts:177` `SortDESC` (class) - 1 documentation section/link violation(s)
- `src/domain/values/SummaryItem/SummaryItem.model.ts:38` `SummaryItem` (class) - 1 documentation section/link violation(s)

### @beep/data

Path: `packages/foundation/primitive/data`

Module findings:
- `src/Calendar.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CurrencyCodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/KeyboardShortcuts.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Timezones.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/cldr-territories.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/iana-media-types.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/iana-timezones.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/iso4217.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CurrencyCodes.ts:94` `CurrencyCodeDataValues` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:36` `MimeType` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:192` `FileExtension` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:326` `mimes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:604` `getTypes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:625` `getExtensions` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:650` `lookup` (const) - 1 documentation section/link violation(s)
- `src/Timezones.ts:34` `TimezoneName` (type) - 1 documentation section/link violation(s)
- `src/Timezones.ts:72` `TimezoneNameValues` (const) - 1 documentation section/link violation(s)

### @beep/xai

Path: `packages/drivers/xai`

Export findings:
- `src/XAi.models.ts:162` `XAiRequestOptions` (class) - 1 documentation section/link violation(s)

### @beep/duckdb

Path: `packages/drivers/duckdb`

Module findings:
- `src/DuckDb.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/DuckDb.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/DuckDb.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/DuckDbSqlClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/DuckDb.errors.ts:104` `DuckDbErrorFromUnknownOptions` (class) - 1 documentation section/link violation(s)
- `src/DuckDb.errors.ts:155` `DuckDbError` (class) - 1 documentation section/link violation(s)
- `src/DuckDb.models.ts:41` `DuckDbConnectionOptions` (class) - 1 documentation section/link violation(s)
- `src/DuckDb.models.ts:79` `DuckDbParquetExport` (class) - 1 documentation section/link violation(s)
- `src/DuckDb.models.ts:112` `DuckDbRow` (const) - 1 documentation section/link violation(s)
- `src/DuckDb.models.ts:155` `DuckDbRows` (const) - 1 documentation section/link violation(s)
- `src/DuckDb.service.ts:78` `DuckDbClient` (interface) - 1 documentation section/link violation(s)
- `src/DuckDb.service.ts:170` `DuckDbShape` (interface) - 1 documentation section/link violation(s)
- `src/DuckDb.service.ts:483` `DuckDb` (class) - 1 documentation section/link violation(s)

### @beep/ffmpeg

Path: `packages/drivers/ffmpeg`

Export findings:
- `src/FFmpeg.capture.models.ts:346` `SafeMetadataKey` (const) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:437` `ClipCodec` (const) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:477` `MetadataPair` (class) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:889` `ExtractClipRequest` (class) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:1090` `RenderGifResult` (class) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:1138` `RenderContactSheetRequest` (class) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:1264` `WriteContainerMetadataRequest` (class) - 1 documentation section/link violation(s)
- `src/FFmpeg.capture.models.ts:1373` `ProbeRegionLuminanceRequest` (class) - 1 documentation section/link violation(s)
- `src/FFmpeg.service.ts:663` `buildExtractFrameAtArgs` (const) - 1 documentation section/link violation(s)
- `src/FFmpeg.service.ts:777` `buildExtractClipArgs` (const) - 1 documentation section/link violation(s)
- `src/FFmpeg.service.ts:896` `buildRenderGifArgs` (const) - 1 documentation section/link violation(s)
- `src/FFmpeg.service.ts:1108` `buildWriteContainerMetadataArgs` (const) - 1 documentation section/link violation(s)
- `src/FFmpeg.service.ts:1213` `buildProbeRegionLuminanceArgs` (const) - 1 documentation section/link violation(s)

### @beep/obs

Path: `packages/drivers/obs`

Module findings:
- `src/Obs.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Obs.errors.ts:140` `ObsError` (class) - 1 documentation section/link violation(s)
- `src/Obs.models.ts:153` `ObsConfigInput` (class) - 1 documentation section/link violation(s)
- `src/Obs.models.ts:402` `EnsureQaSceneResult` (class) - 1 documentation section/link violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Module findings:
- `src/Chat.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClientObservability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Chat.atoms.ts:88` `chatProtocolLayerAtom` (const) - 2 documentation section/link violation(s)
- `src/Chat.atoms.ts:116` `ChatClient` (class) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:156` `threadsAtoms` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:246` `CreateThreadAtomInput` (class) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:290` `createThreadAtom` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:340` `draftAtoms` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:374` `draftRevisionAtoms` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:414` `StreamingTurn` (class) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:483` `streamingTurnAtom` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:648` `reportDecodeFailureAtom` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:837` `runTurnAtom` (const) - 1 documentation section/link violation(s)
- `src/Chat.atoms.ts:1238` `turnActiveAtom` (const) - 1 documentation section/link violation(s)
- `src/Chat.layer.ts:37` `resolveChatRpcHttpUrl` (const) - 1 documentation section/link violation(s)
- `src/Chat.layer.ts:68` `HttpChatProtocolLive` (const) - 1 documentation section/link violation(s)
- `src/ProviderInstance.atoms.ts:116` `probeProviderInstanceAtom` (const) - 1 documentation section/link violation(s)
- `src/ProviderInstance.service.ts:61` `providerInstanceTransportLayerAtom` (const) - 1 documentation section/link violation(s)

### @beep/uspto-mcp

Path: `packages/drivers/uspto-mcp`

Module findings:
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoDocumentTiers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoHandlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoSourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoTools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/bin.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Server.ts:83` `makeServerLayer` (const) - 1 documentation section/link violation(s)

### @beep/epistemic-config

Path: `packages/epistemic/config`

Module findings:
- `src/Audience.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ServerConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TestLayer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Audience.ts:55` `resolveSinkAudience` (const) - 1 documentation section/link violation(s)
- `src/ServerConfig.ts:67` `EpistemicDestinationAllowlistConfig` (const) - 1 documentation section/link violation(s)

### @beep/epistemic-use-cases

Path: `packages/epistemic/use-cases`

Module findings:
- `src/ClaimDisposition/ClaimDisposition.commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimGate/ClaimGate.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimProjection/ClaimProjection.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ClaimDisposition/ClaimDisposition.commands.ts:61` `ClaimDispositionAppend` (class) - 1 documentation section/link violation(s)
- `src/ClaimDisposition/ClaimDisposition.ports.ts:78` `ClaimDispositionRepositoryUnavailable` (class) - 1 documentation section/link violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:105` `ClaimGateOutcomeInput` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:125` `SubmitContradictionCandidate` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:345` `GetExpandedContradictionCandidate` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:450` `ReviewContradictionCandidate` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:50` `ContradictionListPayload` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:101` `EvidenceSourcePageSelector` (const) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:141` `EvidenceSourcePagePayload` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:180` `ContradictionEvidenceView` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:237` `ContradictionCandidateDetailView` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:317` `EvidenceSourceHighlight` (class) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:435` `ContradictionActionErrorReason` (const) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.service.ts:40` `ContradictionTriageService` (class) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.commands.ts:160` `RecordEdgeFact` (class) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.commands.ts:236` `SupersedeEdgeFact` (class) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.commands.ts:268` `EdgeAsOfQuery` (class) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.errors.ts:143` `SupersessionConflict` (class) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.errors.ts:262` `EdgeConstraintViolation` (class) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.ports.ts:60` `EdgeAuthorityRepositoryShape` (interface) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.errors.ts:87` `ExecutionLedgerConstraintViolation` (class) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:61` `ExecutionLedgerShape` (interface) - 1 documentation section/link violation(s)

### @beep/m365

Path: `packages/drivers/m365`

Module findings:
- `src/M365.auth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/M365.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/M365.auth.ts:142` `M365InteractiveAuthorizer` (type) - 1 documentation section/link violation(s)
- `src/M365.config.ts:34` `GRAPH_API_BASE_URL` (const) - 1 documentation section/link violation(s)
- `src/M365.config.ts:69` `DEFAULT_REDIRECT_URI` (const) - 1 documentation section/link violation(s)
- `src/M365.config.ts:102` `M365_READ_SCOPES` (const) - 1 documentation section/link violation(s)
- `src/M365.config.ts:127` `M365_RESERVED_WRITE_SCOPES` (const) - 1 documentation section/link violation(s)
- `src/M365.config.ts:190` `M365ConfigInput` (class) - 1 documentation section/link violation(s)
- `src/M365.errors.ts:173` `M365Error` (class) - 1 documentation section/link violation(s)
- `src/M365.schemas.ts:372` `GraphCollection` (const) - 1 documentation section/link violation(s)
- `src/M365.service.ts:696` `M365SkippedEncryptedItem` (class) - 1 documentation section/link violation(s)

### @beep/observability

Path: `packages/foundation/capability/observability`

Module findings:
- `src/CauseDiagnostics.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/HttpError.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Logging.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Metric.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Observed.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PhaseProfiler.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CauseDiagnostics.ts:53` `CauseClassification` (const) - 1 documentation section/link violation(s)
- `src/CauseDiagnostics.ts:406` `classifyCause` (const) - 1 documentation section/link violation(s)
- `src/CauseDiagnostics.ts:426` `fingerprintCause` (const) - 1 documentation section/link violation(s)
- `src/CauseDiagnostics.ts:498` `summarizeExit` (const) - 1 documentation section/link violation(s)
- `src/CauseDiagnostics.ts:554` `renderObservedCause` (const) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:190` `sanitizeSensitiveText` (const) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:212` `redactString` (const) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:239` `RedactedCause` (class) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:401` `redactCause` (const) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:451` `RedactedCauseError` (class) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:484` `redactCauseEffect` (const) - 1 documentation section/link violation(s)
- `src/CauseRedaction.ts:589` `logRedactedCause` (const) - 1 documentation section/link violation(s)
- `src/CoreConfig.ts:42` `ObservabilityCoreConfig` (const) - 1 documentation section/link violation(s)
- `src/Logging.ts:221` `layerMinimumLogLevel` (const) - 1 documentation section/link violation(s)
- `src/Logging.ts:346` `renderLogBanner` (const) - 1 documentation section/link violation(s)
- `src/Logging.ts:433` `layerConsoleLogger` (const) - 1 documentation section/link violation(s)
- `src/Metric.ts:145` `statusClass` (const) - 1 documentation section/link violation(s)
- `src/Metric.ts:178` `measureElapsedMillis` (const) - 1 documentation section/link violation(s)

### @beep/html

Path: `packages/foundation/modeling/html`

Module findings:
- `src/Html.attributes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.conformance.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.contract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.foreign.ts:1` (jsdoc) - 2 documentation section/link violation(s)
- `src/Html.meta.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.nodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Html.contract.ts:75` `HtmlDocumentChild` (const) - 1 documentation section/link violation(s)
- `src/Html.contract.ts:119` `HtmlDocument` (class) - 1 documentation section/link violation(s)
- `src/Html.foreign.ts:189` `isForeignAttributeNameFixedPoint` (const) - 1 documentation section/link violation(s)
- `src/Html.meta.ts:589` `HTML_GLOBAL_ATTRIBUTE_NAMES` (const) - 1 documentation section/link violation(s)
- `src/Html.model.ts:271` `ForeignElement` (class) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:56` `SafeHtmlAttributes` (const) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:110` `SafeHtmlElement` (const) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:246` `SafeUrlAttribute` (const) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:60` `UntrustedHtml` (const) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:125` `SafeHtml` (const) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:574` `serialize` (const) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:694` `safeHtmlValue` (const) - 1 documentation section/link violation(s)
- `src/Html.source-size.ts:823` `inspectSourceSizeList` (const) - 1 documentation section/link violation(s)
- `src/Html.srcset.ts:249` `inspectSrcset` (const) - 1 documentation section/link violation(s)
- `src/index.ts:61` `Html` (const) - 1 documentation section/link violation(s)

### @beep/ui

Path: `packages/foundation/ui-system/ui`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/components/avatar.tsx:114` `AvatarImage` (function) - 1 documentation section/link violation(s)
- `src/components/blocks/editor-00/plugins.tsx:37` `Plugins` (function) - 1 documentation section/link violation(s)
- `src/components/carousel.tsx:158` `useCarousel` (function) - 1 documentation section/link violation(s)
- `src/components/chart.tsx:166` `ChartStyle` (const) - 1 documentation section/link violation(s)
- `src/components/color-picker.tsx:104` `ColorPicker` (const) - 1 documentation section/link violation(s)
- `src/components/combobox.tsx:575` `useComboboxAnchor` (function) - 1 documentation section/link violation(s)
- `src/components/editor/editor-ui/content-editable.tsx:74` `ContentEditable` (function) - 1 documentation section/link violation(s)
- `src/components/effect-date-time-picker.tsx:324` `AdapterEffectDateTime` (class) - 1 documentation section/link violation(s)
- `src/components/emoji-picker.tsx:73` `EmojiPicker` (const) - 1 documentation section/link violation(s)
- `src/components/orb-background.tsx:218` `OrbBackground` (function) - 1 documentation section/link violation(s)
- `src/components/orb-background.tsx:28` `OrbTone` (type) - 1 documentation section/link violation(s)
- `src/components/phone-input.tsx:282` `PhoneInput` (const) - 1 documentation section/link violation(s)
- `src/components/toast.tsx:45` `ToastProvider` (const) - 1 documentation section/link violation(s)
- `src/components/upload.tsx:91` `UploadBoxProps` (interface) - 1 documentation section/link violation(s)
- `src/components/upload.tsx:170` `UploadBoxRenderProps` (interface) - 1 documentation section/link violation(s)
- `src/components/verified-source-text-viewer.tsx:81` `VerifiedSourceTextViewer` (function) - 1 documentation section/link violation(s)
- `src/components/verified-source-text-viewer.tsx:40` `VerifiedSourceTextViewerProps` (interface) - 1 documentation section/link violation(s)
- `src/hooks/useNumberInput.ts:398` `toNumber` (const) - 1 documentation section/link violation(s)
- `src/hooks/useNumberInput.ts:423` `numberToString` (const) - 1 documentation section/link violation(s)
- `src/hooks/useNumberInput.ts:470` `getStepFactor` (const) - 1 documentation section/link violation(s)
- `src/hooks/useNumberInput.ts:717` `useNumberBoundary` (const) - 1 documentation section/link violation(s)

### @beep/pandoc-ast

Path: `packages/foundation/modeling/pandoc-ast`

Export findings:
- `src/Pandoc.codec.ts:427` `PandocLosslessDocument` (const) - 1 documentation section/link violation(s)
- `src/Pandoc.codec.ts:1067` `decodePandocJsonStrict` (const) - 1 documentation section/link violation(s)
- `src/Pandoc.codec.ts:1527` `decodePandocJsonLossless` (const) - 1 documentation section/link violation(s)
- `src/Pandoc.model.ts:91` `PandocUnknownConstructorWire` (const) - 1 documentation section/link violation(s)
- `src/Pandoc.model.ts:2316` `PandocTablePayload` (const) - 1 documentation section/link violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/eslint/EffectLawsAllowlist.ts:56` `resetAllowlistCache` (const) - 1 documentation section/link violation(s)
- `src/eslint/NoNativeRuntimeHotspots.ts:25` `NO_NATIVE_RUNTIME_ERROR_FILES` (const) - 1 documentation section/link violation(s)
- `src/next/NextConfig.model.ts:180` `NextConfig` (class) - 1 documentation section/link violation(s)
- `src/next/SharedNextConfig.model.ts:77` `BeepNextConfigEnv` (class) - 1 documentation section/link violation(s)
- `src/next/SharedNextConfig.model.ts:222` `BeepNextPwaConfig` (const) - 1 documentation section/link violation(s)
- `src/next/SharedNextConfig.model.ts:309` `BeepNextConfigOptionsInput` (type) - 1 documentation section/link violation(s)
- `src/next/SharedNextConfig.model.ts:570` `defineBeepNextConfig` (const) - 1 documentation section/link violation(s)
- `src/next/models/ImageConfig.schema.ts:222` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)
- `src/next/security/index.ts:130` `SecureHeadersConfig` (const) - 1 documentation section/link violation(s)
- `src/next/security/index.ts:253` `withSecureHeaders` (const) - 1 documentation section/link violation(s)

### @beep/documents-tables

Path: `packages/documents/tables`

Export findings:
- `src/entities/SyncConflict/SyncConflict.converters.ts:95` `toSyncConflictInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncCursor/SyncCursor.converters.ts:92` `toSyncCursorInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncItem/SyncItem.converters.ts:100` `toSyncItemInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/SyncOperation/SyncOperation.converters.ts:99` `toSyncOperationInsert` (const) - 1 documentation section/link violation(s)

### @beep/wink

Path: `packages/drivers/wink`

Module findings:
- `src/WinkBackend.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Wink.service.ts:137` `WinkEngineRuntimeState` (type) - 1 documentation section/link violation(s)
- `src/WinkCorpus.service.ts:827` `WinkCorpusManager` (class) - 1 documentation section/link violation(s)
- `src/WinkEngineRef.service.ts:72` `WinkEngineRef` (class) - 1 documentation section/link violation(s)
- `src/WinkObservability.ts:77` `WinkWorkflowObservationOptions` (class) - 1 documentation section/link violation(s)
- `src/WinkTools.service.ts:367` `WinkNlpToolkitLive` (const) - 1 documentation section/link violation(s)
- `src/WinkVectorizer.service.ts:71` `ScopedVectorizer` (interface) - 1 documentation section/link violation(s)

### @beep/postgres

Path: `packages/drivers/postgres`

Export findings:
- `src/PostgresSqlState.models.ts:408` `PgErrorCanonicalNameByCode` (const) - 1 documentation section/link violation(s)

### @beep/pretext

Path: `packages/drivers/pretext`

Module findings:
- `src/Pretext.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pretext.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/browser.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Pretext.models.ts:141` `FontMetricsSnapshotV1` (class) - 1 documentation section/link violation(s)
- `src/Pretext.models.ts:292` `naturalWidth` (const) - 1 documentation section/link violation(s)

### @beep/provenance

Path: `packages/foundation/modeling/provenance`

Module findings:
- `src/TextAnchor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/SourceTextIdentity.ts:119` `SourceTextIdentity` (class) - 1 documentation section/link violation(s)
- `src/TextAnchor.ts:112` `isUtf16Boundary` (const) - 1 documentation section/link violation(s)
- `src/VerifiedTextAnchor.ts:120` `VerifyTextAnchorInput` (class) - 1 documentation section/link violation(s)
- `src/VerifiedTextAnchor.ts:152` `TextAnchorVerificationReceipt` (class) - 1 documentation section/link violation(s)
- `src/VerifiedTextAnchor.ts:203` `VerifiedTextAnchor` (type) - 1 documentation section/link violation(s)
- `src/VerifiedTextAnchor.ts:223` `VerifiedTextAnchor` (const) - 1 documentation section/link violation(s)
- `src/VerifiedTextAnchor.ts:288` `toTextAnchorVerificationReceipt` (const) - 1 documentation section/link violation(s)
- `src/VerifiedTextAnchor.ts:349` `verifyTextAnchor` (const) - 1 documentation section/link violation(s)

### @beep/epistemic-tables

Path: `packages/epistemic/tables`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/entities/EdgeVersion/EdgeVersion.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/CandidateClaim/CandidateClaim.converters.ts:115` `toCandidateClaimInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/ClaimDisposition/ClaimDisposition.converters.ts:138` `toClaimDispositionInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.converters.ts:248` `toContradictionCandidateInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.converters.ts:278` `fromContradictionCandidateRow` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.converters.ts:298` `toContradictionReceiptInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.converters.ts:350` `toContradictionDispositionInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.table.ts:32` `candidateTable` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.table.ts:51` `receiptTable` (const) - 1 documentation section/link violation(s)
- `src/entities/Contradiction/Contradiction.table.ts:69` `dispositionTable` (const) - 1 documentation section/link violation(s)
- `src/entities/EdgeVersion/EdgeVersion.converters.ts:176` `toEdgeVersionInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/Evidence/Evidence.converters.ts:189` `toEvidenceInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/EvidenceVerification/EvidenceVerification.converters.ts:102` `toEvidenceVerificationInsert` (const) - 1 documentation section/link violation(s)
- `src/entities/EvidenceVerification/EvidenceVerification.table.ts:27` `Table` (const) - 1 documentation section/link violation(s)
- `src/entities/UsageRecord/UsageRecord.converters.ts:142` `toUsageRecordInsert` (const) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.converters.ts:145` `fromExecutionDecisionRow` (const) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:78` `executionDecisionTable` (const) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:121` `executionOutcomeTable` (const) - 1 documentation section/link violation(s)

### @beep/qa-capture

Path: `packages/tooling/library/qa-capture`

Module findings:
- `src/ActionEvent.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClockCorrelator.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Collector.api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Collector.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExtractionPlan.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/QaCapture.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SessionStore.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Witness.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ActionEvent.models.ts:75` `EpochMilliseconds` (const) - 1 documentation section/link violation(s)
- `src/ActionEvent.models.ts:276` `NonPrintableKey` (const) - 1 documentation section/link violation(s)
- `src/ActionEvent.models.ts:1203` `BeaconEvent` (class) - 1 documentation section/link violation(s)
- `src/ClockCorrelator.service.ts:120` `detectBeaconEdges` (const) - 1 documentation section/link violation(s)
- `src/ClockCorrelator.service.ts:172` `fitBeaconClockSync` (const) - 1 documentation section/link violation(s)
- `src/Collector.service.ts:56` `SERVER_MARKER_SEQ_BASE` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlan.models.ts:155` `ExtractionRule` (class) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:87` `GIF_BYTES_PER_WIDTH_PIXEL_FRAME` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:102` `SHEET_ESTIMATED_BYTES` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:132` `END_SEEK_GUARD_SECONDS` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:150` `FRAME_MAX_WIDTH` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:233` `planWindows` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:498` `mergeOverlappingWindows` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:644` `applyBudget` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:757` `BuildExtractionPlanOptions` (class) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:840` `epochToVideoSeconds` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:882` `videoSecondsToEpochMs` (const) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:1023` `planDriverRequests` (const) - 1 documentation section/link violation(s)
- `src/QaCapture.models.ts:493` `ClockSync` (class) - 1 documentation section/link violation(s)
- `src/QaCapture.models.ts:567` `CaptureProvenance` (class) - 1 documentation section/link violation(s)

### @beep/federal-register

Path: `packages/drivers/federal-register`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/index.ts:40` `VERSION` (const) - 1 documentation section/link violation(s)

### @beep/doc-text

Path: `packages/drivers/doc-text`

Export findings:
- `src/DocText.service.ts:41` `DOC_TEXT_ENGINE_VERSION` (const) - 1 documentation section/link violation(s)
- `src/DocText.service.ts:59` `DocTextFileProcessingEngineDescriptor` (const) - 1 documentation section/link violation(s)

### @beep/documents-use-cases

Path: `packages/documents/use-cases`

Export findings:
- `src/aggregates/Sync/DmsMirror.ts:189` `EnsureFolderInput` (class) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirror.ts:223` `UploadFileInput` (class) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirror.ts:301` `MoveItemInput` (class) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirror.ts:375` `PollEventsInput` (class) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirror.ts:424` `DmsMirrorShape` (interface) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirror.ts:494` `DmsMirrorProbe` (class) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:121` `VaultSyncError` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:273` `MarkConflictReviewedInput` (class) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:335` `VaultSyncEngineShape` (interface) - 1 documentation section/link violation(s)
- `src/entities/SyncConflict/SyncConflict.repository.ts:245` `SyncConflictRepositoryShape` (interface) - 1 documentation section/link violation(s)
- `src/entities/SyncCursor/SyncCursor.repository.ts:166` `SyncCursorRepositoryShape` (interface) - 1 documentation section/link violation(s)
- `src/entities/SyncItem/SyncItem.repository.ts:352` `SyncItemRepositoryShape` (interface) - 1 documentation section/link violation(s)
- `src/entities/SyncOperation/SyncOperation.repository.ts:387` `SyncOperationRepositoryShape` (interface) - 1 documentation section/link violation(s)
