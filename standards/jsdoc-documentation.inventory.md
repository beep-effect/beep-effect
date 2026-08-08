# JSDoc Documentation Compliance Inventory

Generated: 2026-08-08T12:50:30.943Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 134 |
| cleanPackages | 68 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 63 |
| publicModules | 2418 |
| publicExports | 15988 |
| openModules | 406 |
| openExports | 157 |
| missingExportExamples | 0 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 0 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 12 |
| multiple-description-paragraphs | 547 |
| leading-blank | 0 |
| trailing-blank | 1 |
| invalid-heading | 1 |
| section-out-of-order | 0 |
| duplicate-section | 0 |
| empty-section | 0 |
| section-after-example | 0 |
| invalid-when-to-use-prefix | 4 |
| malformed-example | 0 |
| duplicate-example | 0 |
| loose-ts-fence | 0 |
| forbidden-remarks | 2 |
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
| 2 | `@beep/protobuf` | `packages/drivers/protobuf` | clean | 1 | 1 | 0 | 0 |
| 3 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 4 | `@beep/agents-domain` | `packages/agents/domain` | clean | 16 | 74 | 0 | 0 |
| 5 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 10 | 105 | 5 | 9 |
| 6 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 7 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 8 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 9 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 89 | 12 | 0 |
| 10 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 19 | 42 | 0 | 0 |
| 11 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 9 | 61 | 8 | 4 |
| 12 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 16 | 65 | 1 | 0 |
| 13 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 12 | 34 | 2 | 0 |
| 14 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 41 | 249 | 3 | 0 |
| 15 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 16 | `@beep/face-detection` | `packages/drivers/face-detection` | clean | 4 | 33 | 0 | 0 |
| 17 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 38 | 6 | 0 |
| 18 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 214 | 1 | 3 |
| 19 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 7 | 0 | 0 |
| 20 | `@beep/dock` | `packages/foundation/ui-system/dock` | clean | 20 | 212 | 0 | 0 |
| 21 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 175 | 1317 | 46 | 10 |
| 22 | `@beep/pglite` | `packages/drivers/pglite` | needs-remediation | 4 | 11 | 3 | 0 |
| 23 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 83 | 0 | 0 |
| 24 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 39 | 2 | 0 |
| 25 | `@beep/courtlistener` | `packages/drivers/courtlistener` | clean | 1 | 1 | 0 | 0 |
| 26 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 46 | 1 | 0 |
| 27 | `@beep/editor` | `packages/foundation/ui-system/editor` | needs-remediation | 25 | 145 | 13 | 0 |
| 28 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 1 |
| 29 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 161 | 424 | 9 | 4 |
| 30 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | clean | 9 | 82 | 0 | 0 |
| 31 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | needs-remediation | 9 | 112 | 1 | 0 |
| 32 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 19 | 1 | 0 |
| 33 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 7 | 44 | 3 | 0 |
| 34 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | clean | 3 | 12 | 0 | 0 |
| 35 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 9 | 32 | 1 | 0 |
| 36 | `@beep/ontology-server` | `packages/ontology/server` | clean | 8 | 24 | 0 | 0 |
| 37 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 38 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 127 | 2 | 0 |
| 39 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | clean | 4 | 21 | 0 | 0 |
| 40 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 6 | 22 | 0 | 0 |
| 41 | `@beep/workspace-server` | `packages/workspace/server` | clean | 12 | 32 | 0 | 0 |
| 42 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 43 | `@beep/epistemic-client` | `packages/epistemic/client` | clean | 4 | 25 | 0 | 0 |
| 44 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 26 | 0 | 0 |
| 45 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 50 | 0 | 0 |
| 46 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 15 |
| 47 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 19 | 49 | 1 | 0 |
| 48 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 6 | 35 | 1 | 0 |
| 49 | `@beep/types` | `packages/foundation/primitive/types` | clean | 5 | 12 | 0 | 0 |
| 50 | `@beep/oip-web` | `apps/oip-web` | needs-remediation | 31 | 83 | 0 | 5 |
| 51 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 52 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 0 |
| 53 | `@beep/agents-tables` | `packages/agents/tables` | clean | 6 | 14 | 0 | 0 |
| 54 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 41 | 0 | 0 |
| 55 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 5 | 119 | 4 | 4 |
| 56 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 7 | 50 | 0 | 0 |
| 57 | `@beep/shared-tables` | `packages/shared/tables` | clean | 11 | 14 | 0 | 0 |
| 58 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 65 | 803 | 51 | 36 |
| 59 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 8 | 251 | 4 | 0 |
| 60 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | needs-remediation | 5 | 10 | 0 | 2 |
| 61 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 62 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 22 | 85 | 4 | 0 |
| 63 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 5 | 12 | 0 | 0 |
| 64 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 28 | 62 | 0 | 0 |
| 65 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 28 | 119 | 0 | 0 |
| 66 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 26 | 202 | 4 | 1 |
| 67 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | clean | 19 | 287 | 0 | 0 |
| 68 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 69 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 34 | 3 | 3 |
| 70 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 40 | 4 | 1 |
| 71 | `@beep/venice-ai` | `packages/drivers/venice-ai` | clean | 3 | 35 | 0 | 0 |
| 72 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 0 |
| 73 | `@beep/form` | `packages/foundation/ui-system/form` | needs-remediation | 42 | 114 | 9 | 0 |
| 74 | `@beep/identity` | `packages/foundation/modeling/identity` | clean | 6 | 204 | 0 | 0 |
| 75 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 4 | 17 | 0 | 0 |
| 76 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 28 | 0 | 0 |
| 77 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | needs-remediation | 3 | 10 | 2 | 0 |
| 78 | `@beep/box` | `packages/drivers/box` | clean | 103 | 676 | 0 | 0 |
| 79 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 80 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 81 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 103 | 2 | 0 |
| 82 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 312 | 13 | 0 |
| 83 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 5 | 29 | 0 | 0 |
| 84 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 54 | 176 | 25 | 22 |
| 85 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 53 | 240 | 8 | 2 |
| 86 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 89 | 0 | 0 |
| 87 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 64 | 0 | 0 |
| 88 | `@beep/firecrawl` | `packages/drivers/firecrawl` | clean | 5 | 267 | 0 | 0 |
| 89 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 5 | 69 | 2 | 0 |
| 90 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 91 | `@beep/acp` | `packages/drivers/acp` | clean | 10 | 410 | 0 | 0 |
| 92 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 310 | 9 | 0 |
| 93 | `@beep/infra` | `infra` | needs-remediation | 8 | 89 | 2 | 19 |
| 94 | `@beep/runpod` | `packages/drivers/runpod` | clean | 6 | 179 | 0 | 0 |
| 95 | `@beep/fc-runs` | `packages/tooling/test-kit/fc-runs` | needs-remediation | 2 | 5 | 1 | 0 |
| 96 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 63 | 675 | 18 | 0 |
| 97 | `@beep/documents-domain` | `packages/documents/domain` | clean | 24 | 96 | 0 | 0 |
| 98 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 259 | 1672 | 24 | 0 |
| 99 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 21 | 47 | 8 | 4 |
| 100 | `@beep/rdf` | `packages/foundation/modeling/rdf` | needs-remediation | 22 | 213 | 1 | 1 |
| 101 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 102 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 103 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 86 | 2 | 0 |
| 104 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 8 |
| 105 | `@beep/xai` | `packages/drivers/xai` | clean | 7 | 70 | 0 | 0 |
| 106 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 107 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 6 | 28 | 0 | 0 |
| 108 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 5 | 111 | 0 | 0 |
| 109 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 0 |
| 110 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 0 |
| 111 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 30 | 7 | 0 |
| 112 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 113 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 21 | 3 | 0 |
| 114 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 28 | 126 | 9 | 0 |
| 115 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 6 | 74 | 2 | 0 |
| 116 | `@beep/observability` | `packages/foundation/capability/observability` | clean | 24 | 165 | 0 | 0 |
| 117 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 118 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 12 | 520 | 8 | 2 |
| 119 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 120 | `@beep/ui` | `packages/foundation/ui-system/ui` | clean | 133 | 553 | 0 | 0 |
| 121 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | clean | 5 | 158 | 0 | 0 |
| 122 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 25 | 139 | 0 | 1 |
| 123 | `@beep/documents-tables` | `packages/documents/tables` | clean | 15 | 40 | 0 | 0 |
| 124 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 71 | 1 | 0 |
| 125 | `@beep/postgres` | `packages/drivers/postgres` | clean | 7 | 40 | 0 | 0 |
| 126 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 52 | 0 | 0 |
| 127 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 0 |
| 128 | `@beep/provenance` | `packages/foundation/modeling/provenance` | needs-remediation | 4 | 22 | 1 | 0 |
| 129 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 28 | 86 | 4 | 0 |
| 130 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 0 |
| 131 | `@beep/federal-register` | `packages/drivers/federal-register` | clean | 1 | 1 | 0 | 0 |
| 132 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 12 | 0 | 0 |
| 133 | `@beep/documents-use-cases` | `packages/documents/use-cases` | clean | 23 | 116 | 0 | 0 |
| 134 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |

## Open Findings

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Module findings:
- `src/Fold.assembly.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Fold.assembly.ts:67` `BoundComposer` (type) - 1 documentation section/link violation(s)
- `src/Fold.assembly.ts:886` `fold` (const) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:66` `SchemaHandle` (type) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:117` `TypedLiteral` (type) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:156` `Triple` (type) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:277` `TripleValue` (const) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:352` `AssembledPredicateKind` (const) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:461` `AssembledFact` (class) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:604` `OntologyValidationWarning` (class) - 1 documentation section/link violation(s)

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
- `src/ApiKeyRequired.ts:124` `apiKeyRequiredFailure` (const) - 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:171` `withSanitizedToolSpan` (const) - 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:371` `sanitizedToolkit` (const) - 1 documentation section/link violation(s)
- `src/ToolkitComposition.ts:127` `composeGatedLayers` (const) - 1 documentation section/link violation(s)

### @beep/law-practice-server

Path: `packages/law-practice/server`

Module findings:
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/db-admin

Path: `packages/_internal/db-admin`

Module findings:
- `src/migrate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/shared-domain

Path: `packages/shared/domain`

Module findings:
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

Export findings:
- `src/aggregates/Session/Session.worker-protocol.ts:288` `encodeWorkerCommand` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:325` `encodeWorkerResult` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:362` `OntologyWorkerUndecodableCommand` (class) - 1 documentation section/link violation(s)

### @beep/repo-cli

Path: `packages/tooling/tool/cli`

Module findings:
- `src/commands/Ci/CiLane.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codegen/Codegen.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.capture.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.csv.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.packet.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.scan.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.triage.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.write.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Docgen/Docgen.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Docs/Docs.aggregate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Doctor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Inventory.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Migration.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/PortfolioIndex.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/SetStatus.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
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
- `src/commands/Worktree/Fleet.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Fleet.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 documentation section/link violation(s)

Export findings:
- `src/commands/Ci/CiLane.ts:329` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:762` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:91` `resolveCreatePackageTemplateDir` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:328` `runFrozenGrantSetRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:565` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:342` `requireInventoryRound` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:393` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:541` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:642` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:595` `runBunAudit` (const) - 1 documentation section/link violation(s)

### @beep/pglite

Path: `packages/drivers/pglite`

Module findings:
- `src/Pglite.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PgliteClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/agents-server

Path: `packages/agents/server`

Module findings:
- `src/AssistantTurn/AnthropicTurnCodec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AssistantTurn/AnthropicTurnKernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/Streaming/DatasetLoader.ts:647` `loadJsonl` (const) - 1 documentation section/link violation(s)

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
- `src/values/KindCode/KindCode.model.ts:37` `KindCode` (const) - 1 documentation section/link violation(s)
- `src/values/OfficeCode/OfficeCode.model.ts:38` `OfficeCode` (const) - 1 documentation section/link violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:61` `PatentDocumentTriplet` (const) - 4 documentation section/link violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:38` `PatentNumber` (const) - 1 documentation section/link violation(s)

### @beep/file-processing

Path: `packages/foundation/capability/file-processing`

Module findings:
- `src/PathSafety/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology-config

Path: `packages/ontology/config`

Module findings:
- `src/McpConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ai-provider-cli

Path: `packages/drivers/ai-provider-cli`

Module findings:
- `src/AiProviderCliHome.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Module findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/Openclaw.models.ts:123` `OpenclawDiagnosticText` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:176` `OpenclawProcessRequest` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:342` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:415` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:450` `OpenclawSecretsReloadOutput` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:515` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1179` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1267` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1354` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1425` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:403` `OpenclawCliRunner` (type) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:52` `OpenclawSecretReference` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:100` `OpenclawTargetVersion` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1058` `OpenclawSkillPin` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1158` `OpenclawDeploymentIntent` (class) - 1 documentation section/link violation(s)

### @beep/law-practice-tables

Path: `packages/law-practice/tables`

Module findings:
- `src/Tables.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/test-utils

Path: `packages/tooling/test-kit/test-utils`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Module findings:
- `src/Lexical.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.codec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Lexical.model.ts:1136` `ElementNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:2198` `YouTubeNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3197` `decodeEditorStateStrictResult` (const) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3280` `analyzeEditorStateCompatibilityResult` (const) - 1 documentation section/link violation(s)

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
- `claudecode/Plugin/Define.ts:872` `write` (const) - 1 documentation section/link violation(s)
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

### @beep/utils

Path: `packages/foundation/modeling/utils`

Module findings:
- `src/FileSystem.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GlobalValue.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/NodeUrl.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Path.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Number.ts:44` `isPositive` (const) - 1 documentation section/link violation(s)

### @beep/tika

Path: `packages/drivers/tika`

Module findings:
- `src/Tika.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Tika.server.ts:165` `makeTikaServerFileProcessingEngine` (const) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:311` `makeTikaServerFileProcessingEngineFromEnv` (const) - 1 documentation section/link violation(s)
- `src/Tika.tikaapp.ts:89` `makeTikaAppFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/libpff

Path: `packages/drivers/libpff`

Module findings:
- `src/Libpff.eml.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Libpff.pffexport.ts:464` `makePffexportFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/graph-3d

Path: `packages/drivers/graph-3d`

Module findings:
- `src/Graph3D.react.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/internal/FieldShell.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/api-transport

Path: `packages/foundation/capability/api-transport`

Module findings:
- `src/EgressDenied.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Transport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/documents-server

Path: `packages/documents/server`

Module findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/runtime/Pglite.ts:90` `ChatDbCompatibilityMarker` (const) - 1 documentation section/link violation(s)
- `src/runtime/Pglite.ts:221` `ensureCompatibleChatDbDataDir` (const) - 1 documentation section/link violation(s)
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
- `src/values/GrantSet/GrantSet.model.ts:282` `addGrant` (const) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:490` `evaluateExecutionRequest` (const) - 1 documentation section/link violation(s)

### @beep/ecfr

Path: `packages/drivers/ecfr`

Module findings:
- `src/Ecfr.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/_generated/Ecfr.generated.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/infra

Path: `infra`

Module findings:
- `src/CiRunners.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/OpenClaw.ts:401` `OpenClawExpectedIdentity` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:571` `OpenClawDeploymentConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:765` `OpenClawBackupConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:825` `OpenClawGeneration` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1159` `makeOpenClawGeneration` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1235` `renderOpenClawUnit` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1306` `renderOpenClawRunScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1405` `renderOpenClawGenerationTree` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1468` `renderOpenClawPreflightScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1596` `renderOpenClawStageScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1725` `renderOpenClawApplyScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1844` `renderOpenClawRollbackScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1992` `renderOpenClawDriftAuditScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2045` `renderOpenClawProbeScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2117` `renderOpenClawLiveAcceptanceScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2214` `renderOpenClawBackupShipScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2278` `OpenClawStackArgs` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2362` `makeOpenClawStackArgsFromConfigValues` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2565` `OpenClawStack` (class) - 1 documentation section/link violation(s)

### @beep/fc-runs

Path: `packages/tooling/test-kit/fc-runs`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/schema

Path: `packages/foundation/modeling/schema`

Module findings:
- `src/BigDecimal.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Color/Color.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EffectSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthAmount/EthAmount.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EvmAddress/EvmAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float16Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fn/Fn.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.shared.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LiteralKit/LiteralKit.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Options.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Percentage.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PromiseSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/pluck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/split.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withCodecStatics.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withConstructorDefaults.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UnitInterval.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/GovernedEgress/GovernedEgress.fetch.ts:212` `makeGovernedEgressFetch` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:124` `GovernedTierGateOptions` (class) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:181` `refusalGuidance` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:238` `makeGovernedTierGate` (const) - 1 documentation section/link violation(s)

### @beep/rdf

Path: `packages/foundation/modeling/rdf`

Module findings:
- `src/Vocab/Dcterms.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `src/Vocab/Xsd.ts:27` `XSD_NAMESPACE` (const) - 1 documentation section/link violation(s)

### @beep/govinfo

Path: `packages/drivers/govinfo`

Module findings:
- `src/Govinfo.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/domain/contracts/Api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/MimeTypes.ts:36` `MimeType` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:192` `FileExtension` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:326` `mimes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:604` `getTypes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:625` `getExtensions` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:650` `lookup` (const) - 1 documentation section/link violation(s)
- `src/Timezones.ts:35` `TimezoneName` (type) - 1 documentation section/link violation(s)
- `src/Timezones.ts:75` `TimezoneNameValues` (const) - 1 documentation section/link violation(s)

### @beep/obs

Path: `packages/drivers/obs`

Module findings:
- `src/Obs.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Module findings:
- `src/Chat.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClientObservability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/epistemic-config

Path: `packages/epistemic/config`

Module findings:
- `src/Audience.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ServerConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TestLayer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/m365

Path: `packages/drivers/m365`

Module findings:
- `src/M365.auth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/M365.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/html

Path: `packages/foundation/modeling/html`

Module findings:
- `src/Html.attributes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.conformance.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.contract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.meta.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.nodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Html.meta.ts:603` `HTML_GLOBAL_ATTRIBUTE_NAMES` (const) - 1 documentation section/link violation(s)
- `src/Html.source-size.ts:825` `inspectSourceSizeList` (const) - 1 documentation section/link violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/models/ImageConfig.schema.ts:238` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)

### @beep/wink

Path: `packages/drivers/wink`

Module findings:
- `src/WinkBackend.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/pretext

Path: `packages/drivers/pretext`

Module findings:
- `src/Pretext.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pretext.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/browser.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/provenance

Path: `packages/foundation/modeling/provenance`

Module findings:
- `src/TextAnchor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/epistemic-tables

Path: `packages/epistemic/tables`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/entities/EdgeVersion/EdgeVersion.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
