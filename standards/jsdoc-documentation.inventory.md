# JSDoc Documentation Compliance Inventory

Generated: 2026-10-01T18:54:37.425Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 137 |
| cleanPackages | 18 |
| packagesWithoutPublicSrcSurface | 2 |
| packagesNeedingRemediation | 117 |
| publicModules | 2822 |
| publicExports | 20068 |
| openModules | 366 |
| openExports | 2860 |
| missingExportExamples | 5 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 3022 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 11 |
| multiple-description-paragraphs | 426 |
| leading-blank | 0 |
| trailing-blank | 0 |
| invalid-heading | 1 |
| section-out-of-order | 0 |
| duplicate-section | 0 |
| empty-section | 0 |
| section-after-example | 0 |
| invalid-when-to-use-prefix | 4 |
| malformed-example | 0 |
| duplicate-example | 0 |
| loose-ts-fence | 0 |
| forbidden-remarks | 0 |
| no-root-package-import | 3021 |
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
| 1 | `@beep/fc-runs` | `packages/tooling/test-kit/fc-runs` | needs-remediation | 2 | 6 | 1 | 0 |
| 2 | `@beep/test-runner` | `packages/tooling/test-kit/test-runner` | clean | 4 | 6 | 0 | 0 |
| 3 | `@beep/types` | `packages/foundation/primitive/types` | needs-remediation | 5 | 12 | 1 | 12 |
| 4 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 8 | 230 | 2 | 204 |
| 5 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 29 | 216 | 6 | 118 |
| 6 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 16 |
| 7 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 165 | 925 | 14 | 86 |
| 8 | `@beep/pglite` | `packages/drivers/pglite` | needs-remediation | 4 | 11 | 3 | 0 |
| 9 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 17 | 51 | 1 | 3 |
| 10 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 16 | 546 | 9 | 52 |
| 11 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 104 | 367 | 3 | 51 |
| 12 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 10 | 263 | 4 | 116 |
| 13 | `@beep/rdf` | `packages/foundation/modeling/rdf` | needs-remediation | 29 | 266 | 1 | 8 |
| 14 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 30 | 58 | 0 | 0 |
| 15 | `@beep/provenance` | `packages/foundation/modeling/provenance` | needs-remediation | 4 | 28 | 1 | 4 |
| 16 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | needs-remediation | 8 | 56 | 0 | 15 |
| 17 | `@beep/agents-domain` | `packages/agents/domain` | needs-remediation | 16 | 75 | 0 | 1 |
| 18 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 46 | 1 | 13 |
| 19 | `@beep/shared-use-cases` | `packages/shared/use-cases` | needs-remediation | 6 | 15 | 0 | 1 |
| 20 | `@beep/colors` | `packages/foundation/capability/colors` | needs-remediation | 1 | 9 | 1 | 9 |
| 21 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | needs-remediation | 26 | 130 | 0 | 53 |
| 22 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 57 | 255 | 8 | 16 |
| 23 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 313 | 9 | 33 |
| 24 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 12 | 112 | 8 | 53 |
| 25 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 41 | 0 | 0 |
| 26 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 27 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 128 | 2 | 22 |
| 28 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 25 | 166 | 8 | 109 |
| 29 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 33 | 139 | 11 | 22 |
| 30 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 5 |
| 31 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 214 | 648 | 9 | 7 |
| 32 | `@beep/langextract` | `packages/foundation/capability/langextract` | needs-remediation | 26 | 126 | 0 | 20 |
| 33 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | needs-remediation | 4 | 11 | 2 | 7 |
| 34 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 21 | 3 | 7 |
| 35 | `@beep/postgres` | `packages/drivers/postgres` | needs-remediation | 7 | 43 | 0 | 3 |
| 36 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 34 | 99 | 4 | 0 |
| 37 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 214 | 1 | 12 |
| 38 | `@beep/cosmos` | `packages/drivers/cosmos` | needs-remediation | 6 | 22 | 0 | 1 |
| 39 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 9 |
| 40 | `@beep/documents-domain` | `packages/documents/domain` | needs-remediation | 26 | 82 | 0 | 3 |
| 41 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | needs-remediation | 15 | 48 | 0 | 4 |
| 42 | `@beep/codegen-kit` | `packages/tooling/library/codegen-kit` | needs-remediation | 5 | 37 | 0 | 1 |
| 43 | `@beep/chalk` | `packages/foundation/capability/chalk` | needs-remediation | 1 | 35 | 1 | 35 |
| 44 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 64 | 678 | 18 | 36 |
| 45 | `@beep/phoenix` | `packages/drivers/phoenix` | needs-remediation | 5 | 50 | 0 | 2 |
| 46 | `@beep/duckdb` | `packages/drivers/duckdb` | needs-remediation | 6 | 28 | 0 | 4 |
| 47 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | needs-remediation | 5 | 111 | 0 | 2 |
| 48 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 312 | 13 | 77 |
| 49 | `@beep/openai-compat` | `packages/drivers/openai-compat` | needs-remediation | 4 | 54 | 0 | 9 |
| 50 | `@beep/epistemic-client` | `packages/epistemic/client` | needs-remediation | 4 | 25 | 0 | 1 |
| 51 | `@beep/ui` | `packages/foundation/ui-system/ui` | needs-remediation | 134 | 557 | 1 | 7 |
| 52 | `@beep/dock` | `packages/foundation/ui-system/dock` | needs-remediation | 20 | 212 | 0 | 189 |
| 53 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 34 | 89 | 1 | 16 |
| 54 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 32 | 114 | 4 | 21 |
| 55 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 34 | 3 | 6 |
| 56 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 40 | 4 | 7 |
| 57 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 24 | 53 | 8 | 18 |
| 58 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 7 | 44 | 3 | 5 |
| 59 | `@beep/agents-tables` | `packages/agents/tables` | clean | 7 | 16 | 0 | 0 |
| 60 | `@beep/anthropic` | `packages/drivers/anthropic` | needs-remediation | 6 | 31 | 0 | 5 |
| 61 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 7 | 126 | 4 | 61 |
| 62 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 63 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 19 | 1 | 7 |
| 64 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 65 | `@beep/n3` | `packages/drivers/n3` | needs-remediation | 3 | 11 | 0 | 1 |
| 66 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 23 | 56 | 0 | 0 |
| 67 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 12 | 0 | 0 |
| 68 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 93 | 0 | 0 |
| 69 | `@beep/box` | `packages/drivers/box` | needs-remediation | 7 | 876 | 0 | 12 |
| 70 | `@beep/documents-tables` | `packages/documents/tables` | clean | 19 | 48 | 0 | 0 |
| 71 | `@beep/documents-use-cases` | `packages/documents/use-cases` | needs-remediation | 23 | 120 | 0 | 18 |
| 72 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | needs-remediation | 9 | 21 | 0 | 3 |
| 73 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 74 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | needs-remediation | 18 | 64 | 0 | 10 |
| 75 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 6 | 139 | 2 | 2 |
| 76 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 86 | 2 | 3 |
| 77 | `@beep/face-detection` | `packages/drivers/face-detection` | needs-remediation | 4 | 34 | 0 | 7 |
| 78 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 10 | 86 | 0 | 23 |
| 79 | `@beep/skill-contract` | `packages/foundation/modeling/skill-contract` | needs-remediation | 9 | 113 | 0 | 79 |
| 80 | `@beep/uspto` | `packages/drivers/uspto` | needs-remediation | 5 | 26 | 0 | 3 |
| 81 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 1 |
| 82 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 30 | 521 | 0 | 81 |
| 83 | `@beep/firecrawl` | `packages/drivers/firecrawl` | needs-remediation | 5 | 267 | 0 | 2 |
| 84 | `@beep/runpod` | `packages/drivers/runpod` | needs-remediation | 7 | 203 | 0 | 1 |
| 85 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 1 |
| 86 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 28 | 176 | 0 | 14 |
| 87 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 3 |
| 88 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 73 | 1 | 34 |
| 89 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 89 | 12 | 13 |
| 90 | `@beep/venice-ai` | `packages/drivers/venice-ai` | needs-remediation | 3 | 35 | 0 | 4 |
| 91 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 6 | 74 | 2 | 3 |
| 92 | `@beep/xai` | `packages/drivers/xai` | needs-remediation | 7 | 70 | 0 | 6 |
| 93 | `@beep/openai` | `packages/drivers/openai` | needs-remediation | 4 | 17 | 0 | 3 |
| 94 | `@beep/hubspot` | `packages/drivers/hubspot` | needs-remediation | 4 | 23 | 0 | 1 |
| 95 | `@beep/sanity` | `packages/drivers/sanity` | needs-remediation | 4 | 16 | 0 | 2 |
| 96 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 6 | 15 | 0 | 0 |
| 97 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 1 |
| 98 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 10 | 110 | 5 | 54 |
| 99 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | needs-remediation | 3 | 12 | 0 | 10 |
| 100 | `@beep/drizzle` | `packages/drivers/drizzle` | needs-remediation | 3 | 11 | 0 | 3 |
| 101 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 22 | 82 | 1 | 30 |
| 102 | `@beep/brand` | `packages/foundation/ui-system/brand` | needs-remediation | 7 | 50 | 0 | 43 |
| 103 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 39 | 2 | 7 |
| 104 | `@beep/editor` | `packages/foundation/ui-system/editor` | needs-remediation | 36 | 212 | 13 | 14 |
| 105 | `@beep/ontology-server` | `packages/ontology/server` | needs-remediation | 8 | 24 | 0 | 2 |
| 106 | `@beep/workspace-server` | `packages/workspace/server` | needs-remediation | 12 | 32 | 0 | 4 |
| 107 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 28 | 0 | 0 |
| 108 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 103 | 2 | 7 |
| 109 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 17 |
| 110 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 111 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | needs-remediation | 13 | 34 | 0 | 17 |
| 112 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 13 | 46 | 2 | 2 |
| 113 | `@beep/discord` | `packages/drivers/discord` | needs-remediation | 4 | 15 | 0 | 1 |
| 114 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 40 | 6 | 3 |
| 115 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | needs-remediation | 3 | 7 | 0 | 4 |
| 116 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 290 | 2559 | 47 | 267 |
| 117 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | needs-remediation | 10 | 87 | 0 | 18 |
| 118 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 3 |
| 119 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 9 | 32 | 1 | 0 |
| 120 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 4 | 23 | 1 | 2 |
| 121 | `@beep/oip-web` | `apps/oip-web` | needs-remediation | 31 | 86 | 0 | 11 |
| 122 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 123 | `@beep/shared-tables` | `packages/shared/tables` | clean | 9 | 12 | 0 | 0 |
| 124 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 250 | 2543 | 4 | 324 |
| 125 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | needs-remediation | 7 | 14 | 0 | 3 |
| 126 | `@beep/tailscale` | `packages/drivers/tailscale` | needs-remediation | 5 | 29 | 0 | 3 |
| 127 | `@beep/todox` | `apps/todox` | clean | 16 | 57 | 0 | 0 |
| 128 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 58 | 201 | 25 | 0 |
| 129 | `@beep/acp` | `packages/drivers/acp` | needs-remediation | 11 | 417 | 0 | 6 |
| 130 | `@beep/infra` | `infra` | needs-remediation | 11 | 105 | 3 | 23 |
| 131 | `@beep/box-provisioning` | `packages/drivers/box-provisioning` | needs-remediation | 11 | 110 | 0 | 10 |
| 132 | `@beep/freshbooks` | `packages/drivers/freshbooks` | needs-remediation | 6 | 49 | 5 | 12 |
| 133 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | needs-remediation | 4 | 16 | 0 | 2 |
| 134 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 32 | 7 | 5 |
| 135 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 136 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 137 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | needs-remediation | 7 | 204 | 0 | 18 |

## Open Findings

### @beep/fc-runs

Path: `packages/tooling/test-kit/fc-runs`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/types

Path: `packages/foundation/primitive/types`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/TArray.types.ts:30` `Elem` (type) - 1 example import violation(s)
- `src/TString.types.ts:33` `NonEmpty` (type) - 1 example import violation(s)
- `src/TString.types.ts:67` `NonEmptyTrimmed` (type) - 1 example import violation(s)
- `src/TString.types.ts:89` `Chars` (type) - 1 example import violation(s)
- `src/TString.types.ts:132` `DotPropertyName` (type) - 1 example import violation(s)
- `src/TUnsafe.types.ts:29` `Any` (type) - 1 example import violation(s)
- `src/TUtils.types.ts:28` `UnionToIntersection` (type) - 1 example import violation(s)
- `src/TUtils.types.ts:54` `Simplify` (type) - 1 example import violation(s)
- `src/index.ts:43` `export type * as TArray from "./TArray.types.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:61` `export type * as TString from "./TString.types.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:77` `export type * as TUnsafe from "./TUnsafe.types.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:95` `export type * as TUtils from "./TUtils.types.ts";` (re-export) - 1 example import violation(s)

### @beep/identity

Path: `packages/foundation/modeling/identity`

Module findings:
- `src/Id.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/Curie.ts:110` `expandOption` (const) - 2 example import violation(s)
- `src/Curie.ts:163` `contractOption` (const) - 2 example import violation(s)
- `src/Curie.ts:262` `expand` (const) - 1 example import violation(s)
- `src/Curie.ts:310` `contract` (const) - 1 example import violation(s)
- `src/Curie.ts:366` `expandPredicate` (const) - 1 example import violation(s)
- `src/Curie.ts:386` `makeCurieCodec` (const) - 1 example import violation(s)
- `src/Curie.ts:406` `CoreCurieCodec` (const) - 1 example import violation(s)
- `src/Curie.ts:424` `makeCurieFromIri` (const) - 1 example import violation(s)
- `src/Curie.ts:448` `CurieFromIri` (const) - 1 example import violation(s)
- `src/Fibered.ts:217` `Fibered` (const) - 1 example import violation(s)
- `src/Id.ts:142` `IdentityInterpolationError` (class) - 1 example import violation(s)
- `src/Id.ts:175` `IdentitySegmentCountError` (class) - 1 example import violation(s)
- `src/Id.ts:209` `VERSION` (const) - 1 example import violation(s)
- `src/Id.ts:231` `SegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:367` `TitleFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:392` `IriFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:421` `CurieFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:451` `SlugFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:494` `ModuleSegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:515` `ModuleAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:536` `TaggedAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:555` `IdentityString` (type) - 2 example import violation(s)
- `src/Id.ts:576` `IdentitySymbol` (type) - 2 example import violation(s)
- `src/Id.ts:599` `SchemaAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:625` `DeclarationAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:660` `ErrorAnnotationRecord` (interface) - 1 example import violation(s)
- `src/Id.ts:682` `KeyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:705` `SkosClassification` (type) - 1 example import violation(s)
- `src/Id.ts:728` `OntologyKeyOptions` (type) - 1 example import violation(s)
- `src/Id.ts:759` `OntologyClassExtras` (type) - 1 example import violation(s)
- `src/Id.ts:793` `HttpAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:819` `IdentityAnyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:845` `IdentityAnnotation` (type) - 1 example import violation(s)
- `src/Id.ts:900` `IdentityAnnotationResult` (type) - 1 example import violation(s)
- `src/Id.ts:934` `AnnotatedSchema` (type) - 1 example import violation(s)
- `src/Id.ts:951` `TaggedModuleRecord` (type) - 1 example import violation(s)
- `src/Id.ts:1014` `IdentityComposer` (interface) - 1 example import violation(s)
- `src/Id.ts:1623` `BaseIdentityInput` (const) - 1 example import violation(s)
- `src/Id.ts:1652` `BaseIdentityInput` (type) - 1 example import violation(s)
- `src/Id.ts:2165` `make` (const) - 2 example import violation(s)
- `src/IdentityRegistry.ts:30` `IdentityEncoding` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:62` `IdentityRef` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:100` `IdentityEntry` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:177` `IdentityNotFoundError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:205` `IdentityRegistryConflictError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:247` `IdentityRegistry` (class) - 2 example import violation(s)
- `src/PnLocal.ts:160` `SafePnLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:189` `SafePnLocal` (type) - 1 example import violation(s)
- `src/PnLocal.ts:208` `SafePnPrefix` (const) - 1 example import violation(s)
- `src/PnLocal.ts:237` `SafePnPrefix` (type) - 1 example import violation(s)
- `src/PnLocal.ts:256` `isSafeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:273` `isSafePrefix` (const) - 1 example import violation(s)
- `src/PnLocal.ts:366` `EscapedPnLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:395` `EscapedPnLocal` (type) - 1 example import violation(s)
- `src/PnLocal.ts:413` `acceptsEscapedLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:429` `unescapeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:451` `escapeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:471` `prefixedNameOrIri` (const) - 1 example import violation(s)
- `src/Vocab.ts:36` `VocabShape` (type) - 1 example import violation(s)
- `src/Vocab.ts:62` `VocabEntry` (class) - 1 example import violation(s)
- `src/Vocab.ts:88` `VocabRegistry` (const) - 1 example import violation(s)
- `src/Vocab.ts:109` `VocabRegistry` (type) - 1 example import violation(s)
- `src/Vocab.ts:128` `CoreVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:376` `CoreVocab` (type) - 1 example import violation(s)
- `src/Vocab.ts:393` `Curie` (type) - 1 example import violation(s)
- `src/Vocab.ts:412` `Predicate` (type) - 1 example import violation(s)
- `src/Vocab.ts:429` `Expand` (type) - 1 example import violation(s)
- `src/Vocab.ts:471` `mergeVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:496` `SemanticFoundationVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:523` `SemanticFoundationVocab` (type) - 1 example import violation(s)
- `src/index.ts:31` `export * from "./Curie.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:56` `export * from "./Fibered.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:72` `export * from "./Id.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:87` `export * from "./IdentityRegistry.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:105` `export * from "./PnLocal.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:120` `export * from "./packages.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:135` `export * from "./Vocab.ts";` (re-export) - 1 example import violation(s)
- `src/packages.ts:234` `$ApiDocsId` (const) - 1 example import violation(s)
- `src/packages.ts:251` `$CiopsId` (const) - 1 example import violation(s)
- `src/packages.ts:268` `$LejeuneBoltWorkbenchId` (const) - 1 example import violation(s)
- `src/packages.ts:286` `$SemanticaId` (const) - 1 example import violation(s)
- `src/packages.ts:303` `$TrustgraphWorkbenchId` (const) - 1 example import violation(s)
- `src/packages.ts:323` `$DataId` (const) - 1 example import violation(s)
- `src/packages.ts:339` `$IdentityId` (const) - 1 example import violation(s)
- `src/packages.ts:355` `$SchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:371` `$ProvenanceId` (const) - 1 example import violation(s)
- `src/packages.ts:387` `$RdfId` (const) - 1 example import violation(s)
- `src/packages.ts:435` `$TypesId` (const) - 1 example import violation(s)
- `src/packages.ts:451` `$UtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:469` `$UiId` (const) - 1 example import violation(s)
- `src/packages.ts:487` `$RepoAiMetricsId` (const) - 1 example import violation(s)
- `src/packages.ts:503` `$RepoCliId` (const) - 1 example import violation(s)
- `src/packages.ts:519` `$RepoConfigsId` (const) - 1 example import violation(s)
- `src/packages.ts:535` `$RepoUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:551` `$TestUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:569` `$SharedDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:602` `$SharedTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:618` `$SemanticWebId` (const) - 1 example import violation(s)
- `src/packages.ts:634` `$NlpId` (const) - 1 example import violation(s)
- `src/packages.ts:666` `$LangExtractId` (const) - 1 example import violation(s)
- `src/packages.ts:682` `$ObservabilityId` (const) - 1 example import violation(s)
- `src/packages.ts:698` `$ColorsId` (const) - 1 example import violation(s)
- `src/packages.ts:714` `$ChalkId` (const) - 1 example import violation(s)
- `src/packages.ts:730` `$RepoDocgenId` (const) - 1 example import violation(s)
- `src/packages.ts:746` `$InfraId` (const) - 1 example import violation(s)
- `src/packages.ts:764` `$WorkspaceDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:780` `$EpistemicDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:797` `$EpistemicUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:814` `$AgentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:830` `$AgentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:846` `$AgentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:862` `$AgentsClientId` (const) - 1 example import violation(s)
- `src/packages.ts:878` `$LawPracticeDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:896` `$LawPracticeUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:914` `$LawPracticeServerId` (const) - 1 example import violation(s)
- `src/packages.ts:931` `$ProfessionalDesktopId` (const) - 1 example import violation(s)
- `src/packages.ts:1077` `$AnthropicId` (const) - 1 example import violation(s)
- `src/packages.ts:1126` `$AcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1143` `$OpenaiCompatId` (const) - 1 example import violation(s)
- `src/packages.ts:1160` `$WorkspaceTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1177` `$WorkspaceUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1195` `$WorkspaceServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1212` `$DocumentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1229` `$DocumentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1247` `$DocumentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1264` `$ArchitectureLabDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1282` `$ArchitectureLabUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1300` `$ArchitectureLabConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:1318` `$ArchitectureLabServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1336` `$ArchitectureLabTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1354` `$ArchitectureLabClientId` (const) - 1 example import violation(s)
- `src/packages.ts:1372` `$ArchitectureLabUiId` (const) - 1 example import violation(s)
- `src/packages.ts:1390` `$ArchitectureLabProofId` (const) - 1 example import violation(s)
- `src/packages.ts:1408` `$RunpodId` (const) - 1 example import violation(s)
- `src/packages.ts:1425` `$OnepasswordCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1442` `$DiscordId` (const) - 1 example import violation(s)
- `src/packages.ts:1459` `$AiProviderCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1476` `$SanityId` (const) - 1 example import violation(s)
- `src/packages.ts:1493` `$HubspotId` (const) - 1 example import violation(s)
- `src/packages.ts:1510` `$PhoenixId` (const) - 1 example import violation(s)
- `src/packages.ts:1527` `$AiSyncId` (const) - 1 example import violation(s)
- `src/packages.ts:1544` `$BoxId` (const) - 1 example import violation(s)
- `src/packages.ts:1561` `$NlpMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1595` `$WinkId` (const) - 1 example import violation(s)
- `src/packages.ts:1612` `$FileProcessingId` (const) - 1 example import violation(s)
- `src/packages.ts:1629` `$TikaId` (const) - 1 example import violation(s)
- `src/packages.ts:1646` `$LibpffId` (const) - 1 example import violation(s)
- `src/packages.ts:1663` `$FirecrawlId` (const) - 1 example import violation(s)
- `src/packages.ts:1680` `$UsptoId` (const) - 1 example import violation(s)
- `src/packages.ts:1697` `$LexicalSchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:1714` `$EditorId` (const) - 1 example import violation(s)
- `src/packages.ts:1731` `$ScratchpadId` (const) - 1 example import violation(s)
- `src/packages.ts:1748` `$HtmlId` (const) - 1 example import violation(s)
- `src/packages.ts:1765` `$PandocAstId` (const) - 1 example import violation(s)
- `src/packages.ts:1782` `$PgliteId` (const) - 1 example import violation(s)
- `src/packages.ts:1799` `$M365Id` (const) - 1 example import violation(s)
- `src/packages.ts:1816` `$M365McpId` (const) - 1 example import violation(s)
- `src/packages.ts:1833` `$GovinfoId` (const) - 1 example import violation(s)
- `src/packages.ts:1850` `$EcfrId` (const) - 1 example import violation(s)
- `src/packages.ts:1867` `$ApiTransportId` (const) - 1 example import violation(s)
- `src/packages.ts:1884` `$McpKitId` (const) - 1 example import violation(s)
- `src/packages.ts:1901` `$UsptoMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1918` `$PacerId` (const) - 1 example import violation(s)
- `src/packages.ts:1935` `$FcRunsId` (const) - 1 example import violation(s)
- `src/packages.ts:1952` `$CosmosId` (const) - 1 example import violation(s)
- `src/packages.ts:1969` `$DbAdminId` (const) - 1 example import violation(s)
- `src/packages.ts:1986` `$EpistemicServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2003` `$EpistemicTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2020` `$LintRulesId` (const) - 1 example import violation(s)
- `src/packages.ts:2037` `$N3Id` (const) - 1 example import violation(s)
- `src/packages.ts:2054` `$PretextId` (const) - 1 example import violation(s)
- `src/packages.ts:2071` `$Graph3dId` (const) - 1 example import violation(s)
- `src/packages.ts:2088` `$DockId` (const) - 1 example import violation(s)
- `src/packages.ts:2105` `$DockReactId` (const) - 1 example import violation(s)
- `src/packages.ts:2122` `$OntologyClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2139` `$OntologyConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2156` `$OntologyDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:2173` `$OntologyServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2190` `$OntologyUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2207` `$OntologyUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:2224` `$OxigraphId` (const) - 1 example import violation(s)
- `src/packages.ts:2241` `$ShaclId` (const) - 1 example import violation(s)
- `src/packages.ts:2258` `$StorybookId` (const) - 1 example import violation(s)
- `src/packages.ts:2275` `$TsgoShimId` (const) - 1 example import violation(s)
- `src/packages.ts:2292` `$DocTextId` (const) - 1 example import violation(s)
- `src/packages.ts:2309` `$DocumentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2326` `$TailscaleId` (const) - 1 example import violation(s)
- `src/packages.ts:2343` `$AgentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2360` `$EpistemicConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2377` `$LawPracticeTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2395` `$PracticeKgMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2412` `$OpenclawId` (const) - 1 example import violation(s)
- `src/packages.ts:2429` `$ObsId` (const) - 1 example import violation(s)
- `src/packages.ts:2446` `$ExiftoolId` (const) - 1 example import violation(s)
- `src/packages.ts:2463` `$QaCaptureId` (const) - 1 example import violation(s)
- `src/packages.ts:2480` `$GovLegalMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2496` `$EpistemicClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2512` `$EpistemicUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2545` `$SkillContractId` (const) - 1 example import violation(s)
- `src/packages.ts:2562` `$CodegenKitId` (const) - 1 example import violation(s)
- `src/packages.ts:2579` `$BrandId` (const) - 1 example import violation(s)
- `src/packages.ts:2596` `$OpenaiId` (const) - 1 example import violation(s)
- `src/packages.ts:2613` `$TodoxId` (const) - 1 example import violation(s)
- `src/packages.ts:2630` `$BoxProvisioningId` (const) - 1 example import violation(s)

### @beep/utils

Path: `packages/foundation/modeling/utils`

Module findings:
- `src/Bool.ts:1` (jsdoc) - 1 example import violation(s)
- `src/Data.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GlobalValue.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/NodeUrl.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Path.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Array.ts:614` `export * from "effect/Array";` (re-export) - 1 example import violation(s)
- `src/Array.ts:43` `matchToBoolean` (const) - 1 example import violation(s)
- `src/Array.ts:73` `assertNonEmptyArray` (const) - 1 example import violation(s)
- `src/Array.ts:96` `assertNonEmptyReadonlyArray` (const) - 1 example import violation(s)
- `src/Array.ts:138` `mapNonEmpty` (const) - 2 example import violation(s)
- `src/Array.ts:177` `flatMapNonEmpty` (const) - 2 example import violation(s)
- `src/Array.ts:218` `mapNonEmptyReadonly` (const) - 2 example import violation(s)
- `src/Array.ts:263` `flatMapNonEmptyReadonly` (const) - 2 example import violation(s)
- `src/Array.ts:324` `indexOf` (const) - 2 example import violation(s)
- `src/Array.ts:356` `lastIndexOf` (const) - 2 example import violation(s)
- `src/Array.ts:386` `slice` (const) - 2 example import violation(s)
- `src/Array.ts:412` `entries` (const) - 1 example import violation(s)
- `src/Array.ts:430` `keys` (const) - 1 example import violation(s)
- `src/Array.ts:450` `values` (const) - 1 example import violation(s)
- `src/Array.ts:476` `appendInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:506` `appendAllInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:540` `sortInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:575` `spliceInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:642` `makeReadonly` (const) - 1 example import violation(s)
- `src/Array.ts:665` `fromIterableNonEmpty` (const) - 1 example import violation(s)
- `src/Array.ts:689` `emptyReadonly` (const) - 1 example import violation(s)
- `src/Bool.ts:18` `export * from "effect/Boolean";` (re-export) - 1 example import violation(s)
- `src/DrainableWorker.ts:31` `DrainableWorker` (interface) - 1 example import violation(s)
- `src/DrainableWorker.ts:80` `makeDrainableWorker` (const) - 1 example import violation(s)
- `src/Equal.ts:22` `export * from "effect/Equal";` (re-export) - 1 example import violation(s)
- `src/Errors.ts:165` `mapToError` (function) - 2 example import violation(s)
- `src/Errors.ts:45` `ErrorMapper` (type) - 2 example import violation(s)
- `src/Errors.ts:98` `mapCauseError` (const) - 2 example import violation(s)
- `src/FileSystem.ts:313` `existsSync` (const) - 1 example import violation(s)
- `src/FileSystem.ts:437` `readdirSync` (const) - 1 example import violation(s)
- `src/FileSystem.ts:467` `statSync` (const) - 1 example import violation(s)
- `src/FileSystem.ts:507` `makeWaitForFile` (const) - 1 example import violation(s)
- `src/Glob.ts:250` `Glob` (interface) - 1 example import violation(s)
- `src/Glob.ts:274` `Glob` (const) - 1 example import violation(s)
- `src/Glob.ts:553` `layer` (const) - 1 example import violation(s)
- `src/GlobalValue.ts:73` `globalValue` (const) - 1 example import violation(s)
- `src/HostProcess.ts:99` `HostProcessPlatform` (const) - 1 example import violation(s)
- `src/HostProcess.ts:124` `HostProcessArchitecture` (const) - 1 example import violation(s)
- `src/NodeUrl.ts:88` `fromFileUrl` (const) - 2 example import violation(s)
- `src/NodeUrl.ts:141` `toFileUrl` (const) - 2 example import violation(s)
- `src/Number.ts:44` `isPositive` (const) - 1 documentation section/link violation(s)
- `src/Number.ts:88` `isInteger` (const) - 1 example import violation(s)
- `src/Option.ts:63` `propFromNullishOr` (const) - 2 example import violation(s)
- `src/Option.ts:112` `getSomesStruct` (const) - 1 example import violation(s)
- `src/Path.ts:69` `export { fromFileUrl, toFileUrl } from "./NodeUrl.ts";` (re-export) - 1 example import violation(s)
- `src/Predicate.ts:207` `chainRefinements` (function) - 1 example import violation(s)
- `src/Predicate.ts:156` `hasInspectableObjectShape` (const) - 1 example import violation(s)
- `src/Str.ts:826` `export * from "effect/String";` (re-export) - 1 example import violation(s)
- `src/Str.ts:294` `mapPrefix` (function) - 2 example import violation(s)
- `src/Str.ts:339` `mapPostfix` (function) - 2 example import violation(s)
- `src/Str.ts:41` `equivalence` (const) - 2 example import violation(s)
- `src/Str.ts:71` `orderAsc` (const) - 2 example import violation(s)
- `src/Str.ts:118` `prefix` (const) - 2 example import violation(s)
- `src/Str.ts:159` `prefixThunk` (const) - 2 example import violation(s)
- `src/Str.ts:212` `postfix` (const) - 2 example import violation(s)
- `src/Str.ts:253` `postfixThunk` (const) - 2 example import violation(s)
- `src/Str.ts:370` `camelCase` (const) - 1 example import violation(s)
- `src/Str.ts:388` `snakeCase` (const) - 1 example import violation(s)
- `src/Str.ts:406` `kebabCase` (const) - 1 example import violation(s)
- `src/Str.ts:425` `screamingSnake` (const) - 1 example import violation(s)
- `src/Str.ts:444` `pascalCase` (const) - 1 example import violation(s)
- `src/Str.ts:462` `pascalToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:481` `snakeToCamel` (const) - 1 example import violation(s)
- `src/Str.ts:500` `snakeToKebab` (const) - 1 example import violation(s)
- `src/Str.ts:519` `camelToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:538` `snakeToPascal` (const) - 1 example import violation(s)
- `src/Str.ts:557` `kebabToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:584` `startsWith` (const) - 2 example import violation(s)
- `src/Str.ts:624` `endsWith` (const) - 2 example import violation(s)
- `src/Str.ts:669` `contains` (const) - 2 example import violation(s)
- `src/Str.ts:713` `repeat` (const) - 2 example import violation(s)
- `src/Str.ts:749` `replaceWith` (const) - 2 example import violation(s)
- `src/Str.ts:793` `replaceAllWith` (const) - 2 example import violation(s)
- `src/Str.ts:846` `trimThunk` (const) - 1 example import violation(s)
- `src/Str.ts:866` `fromNumber` (const) - 1 example import violation(s)
- `src/Str.ts:883` `toSlug` (const) - 1 example import violation(s)
- `src/Str.ts:921` `truncate` (const) - 2 example import violation(s)
- `src/Str.ts:947` `orEmpty` (const) - 1 example import violation(s)
- `src/Str.ts:995` `matchEmpty` (const) - 1 example import violation(s)
- `src/Stream.ts:46` `streamFilterJson` (const) - 1 example import violation(s)
- `src/Struct.ts:172` `dotGet` (const) - 2 example import violation(s)
- `src/Struct.ts:219` `dotGetOption` (const) - 2 example import violation(s)
- `src/Struct.ts:286` `mapPath` (const) - 2 example import violation(s)
- `src/Struct.ts:364` `mapPathLazy` (const) - 1 example import violation(s)
- `src/Struct.ts:446` `getLazy` (const) - 2 example import violation(s)
- `src/Struct.ts:481` `pathsOf` (const) - 1 example import violation(s)
- `src/Struct.ts:601` `entriesNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:632` `keys` (const) - 1 example import violation(s)
- `src/Struct.ts:658` `keysNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:693` `fromEntries` (const) - 1 example import violation(s)
- `src/Struct.ts:801` `reverse` (const) - 1 example import violation(s)
- `src/Struct.ts:923` `deepMerge` (const) - 1 example import violation(s)
- `src/Text.ts:34` `splitCommaSeparatedTrimmed` (const) - 1 example import violation(s)
- `src/Text.ts:62` `formatNameWithAliases` (const) - 1 example import violation(s)
- `src/Text.ts:94` `joinLines` (const) - 1 example import violation(s)
- `src/index.ts:30` `export * as A from "./Array.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:45` `export * as Bool from "./Bool.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:63` `export * as Data from "./Data.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:78` `export * as DateTime from "./DateTime.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:106` `export * as Eq from "./Equal.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:133` `export * as Err from "./Errors.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:151` `export * as FileSystem from "./FileSystem.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:173` `export * from "./HostProcess.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:189` `export * as Html from "./Html.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:205` `export * as N from "./Number.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:221` `export * as O from "./Option.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:236` `export * as Path from "./Path.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:252` `export * as P from "./Predicate.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:267` `export * from "./Random.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:283` `export * as R from "./Record.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:299` `export * as Str from "./Str.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:314` `export * as Stream from "./Stream.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:330` `export * as Struct from "./Struct.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:346` `export * as Text from "./Text.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:362` `export * from "./thunk.ts";` (re-export) - 1 example import violation(s)
- `src/thunk.ts:247` `thunkEffect` (const) - 1 example import violation(s)
- `src/thunk.ts:309` `thunkEffectSucceedNull` (const) - 1 example import violation(s)
- `src/thunk.ts:367` `thunkEmptyReadonlyRecord` (const) - 1 example import violation(s)

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
- `src/Blockchain.ts:26` `Networks` (const) - 1 example import violation(s)
- `src/MimeTypes.ts:36` `MimeType` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:192` `FileExtension` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:326` `mimes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:604` `getTypes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:625` `getExtensions` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:650` `lookup` (const) - 1 documentation section/link violation(s)
- `src/Timezones.ts:35` `TimezoneName` (type) - 1 documentation section/link violation(s)
- `src/Timezones.ts:75` `TimezoneNameValues` (const) - 1 documentation section/link violation(s)
- `src/index.ts:26` `export * as Blockchain from "./Blockchain.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:41` `export * as Calendar from "./Calendar.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:56` `export * as CurrencyCodes from "./CurrencyCodes.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:75` `export * as KeyboardShortcuts from "./KeyboardShortcuts.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:90` `export * as MimeTypesData from "./MimeTypes.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:105` `export * as Territories from "./Territories.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:120` `export * as Timezones from "./Timezones.ts";` (re-export) - 1 example import violation(s)

### @beep/schema

Path: `packages/foundation/modeling/schema`

Module findings:
- `src/Color/Color.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthAmount/EthAmount.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EvmAddress/EvmAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float16Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fn/Fn.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Percentage.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Semver.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/UnitInterval.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AtURI.ts:240` `AtUri` (const) - 1 example import violation(s)
- `src/AtURI.ts:269` `AtUri` (type) - 1 example import violation(s)
- `src/AtURI.ts:292` `AtUri` (namespace) - 1 example import violation(s)
- `src/Conformance/Conformance.annotations.ts:138` `Annotation` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.annotations.ts:189` `makeAnnotationResult` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.collector.ts:43` `collectConformanceAnnotationsResult` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.invariant.schema.ts:231` `InvariantEnforcement` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.invariant.schema.ts:354` `InvariantDescriptor` (class) - 1 example import violation(s)
- `src/Conformance/Conformance.policy.schema.ts:80` `ConformancePolicy` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.profile.schema.ts:66` `ConformanceProfile` (class) - 1 example import violation(s)
- `src/Conformance/Conformance.report.schema.ts:84` `ConformanceIssue` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.report.schema.ts:234` `ConformanceReport` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:35` `GitObjectId` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:80` `SpecificationDate` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:232` `SpecificationRevision` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:282` `SpecificationSource` (class) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:322` `SpecificationReference` (class) - 1 example import violation(s)
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:157` `CrossOriginOpenerPolicyHeader` (const) - 1 example import violation(s)
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:257` `Header` (const) - 1 example import violation(s)
- `src/Csp/Csp.schema.ts:956` `ContentSecurityPolicyHeader` (const) - 1 example import violation(s)
- `src/Csp/Csp.schema.ts:1064` `Header` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:72` `CsvDocument` (type) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:315` `Csv` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:315` `CSV` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:381` `CSV` (type) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:315` `Schema` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:403` `Schema` (type) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:112` `formatCsvHeaderRow` (const) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:148` `formatCsvDataRow` (const) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:186` `formatCsvDocument` (const) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:186` `format` (const) - 1 example import violation(s)
- `src/CsvParser/CsvParser.parser.ts:414` `parseCsvRows` (const) - 1 example import violation(s)
- `src/CsvParser/CsvParser.parser.ts:414` `parse` (const) - 1 example import violation(s)
- `src/Cuid.ts:40` `sha512` (const) - 1 example import violation(s)
- `src/Cuid.ts:155` `CuidState` (class) - 1 example import violation(s)
- `src/Cuid.ts:212` `cuid` (const) - 1 example import violation(s)
- `src/Did.ts:79` `Did` (const) - 1 example import violation(s)
- `src/Did.ts:108` `Did` (type) - 1 example import violation(s)
- `src/Did.ts:131` `Did` (namespace) - 1 example import violation(s)
- `src/Double.ts:52` `Double` (const) - 1 example import violation(s)
- `src/Email.ts:33` `EmailString` (const) - 1 example import violation(s)
- `src/Email.ts:52` `EmailString` (type) - 2 example import violation(s)
- `src/Email.ts:76` `Email` (const) - 1 example import violation(s)
- `src/Email.ts:96` `Email` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:67` `Added` (class) - 2 example import violation(s)
- `src/FileDiff.schema.ts:101` `Deleted` (class) - 2 example import violation(s)
- `src/FileDiff.schema.ts:136` `Modified` (class) - 2 example import violation(s)
- `src/FileDiff.schema.ts:170` `Info` (const) - 2 example import violation(s)
- `src/FileDiff.schema.ts:192` `Info` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:210` `Info` (namespace) - 1 example import violation(s)
- `src/Fixed64.ts:58` `Fixed64` (const) - 1 example import violation(s)
- `src/Float.ts:57` `Float` (const) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:524` `ThunkOf` (function) - 3 example import violation(s)
- `src/Fn/Fn.schema.ts:594` `Fn` (function) - 5 example import violation(s)
- `src/Fn/Fn.schema.ts:477` `AnyFn` (const) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:499` `AnyFn` (type) - 1 example import violation(s)
- `src/Http/Http.headers.shared.ts:271` `makeHeaderEncodeForbidden` (const) - 1 example import violation(s)
- `src/Jsonc.ts:92` `JsoncTextToUnknown` (const) - 1 example import violation(s)
- `src/Jsonc.ts:137` `decodeJsoncTextAs` (const) - 1 example import violation(s)
- `src/LocalDate/LocalDate.schema.ts:249` `fromString` (const) - 1 example import violation(s)
- `src/LocalDate/LocalDate.schema.ts:322` `todayEffect` (const) - 1 example import violation(s)
- `src/LocalDate/LocalDate.schema.ts:343` `fromDateTime` (const) - 1 example import violation(s)
- `src/Markdown.ts:184` `MarkdownTextToHtml` (const) - 1 example import violation(s)
- `src/Markdown.ts:222` `decodeMarkdownTextAs` (const) - 1 example import violation(s)
- `src/NoSniff/NoSniff.schema.ts:153` `NoSniffHeader` (const) - 1 example import violation(s)
- `src/NoSniff/NoSniff.schema.ts:255` `Header` (const) - 1 example import violation(s)
- `src/Port.ts:70` `Port` (const) - 1 example import violation(s)
- `src/Port.ts:123` `PortFromString` (const) - 1 example import violation(s)
- `src/Port.ts:150` `PortFromString` (type) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:91` `BlockedHostError` (class) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:279` `isBlockedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:324` `assertAllowedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:389` `assertAllowedRemoteUrl` (const) - 1 example import violation(s)
- `src/SecureHeaderError/SecureHeaderError.errors.ts:404` `SecureHeaderError` (type) - 1 example import violation(s)
- `src/SecureHeaderError/SecureHeaderError.errors.ts:404` `Error` (type) - 1 example import violation(s)
- `src/SecureHeaderOptions/SecureHeaderOptions.schema.ts:168` `createHeadersObject` (const) - 1 example import violation(s)
- `src/SecureHeaderOptions/SecureHeaderOptions.schema.ts:200` `createSecureHeaders` (const) - 1 example import violation(s)
- `src/SemanticVersion.ts:53` `SemanticVersionSchema` (interface) - 1 documentation section/link violation(s)
- `src/Semver.ts:643` `SemverFromString` (const) - 1 example import violation(s)
- `src/Sha256.ts:112` `Sha256HexFromBytes` (const) - 1 example import violation(s)
- `src/Sha256.ts:142` `Sha256HexFromBytes` (type) - 1 example import violation(s)
- `src/Sha256.ts:165` `Sha256HexFromHexBytes` (const) - 1 example import violation(s)
- `src/Sha256.ts:192` `Sha256HexFromHexBytes` (type) - 1 example import violation(s)
- `src/Xml.ts:86` `XmlTextToUnknown` (const) - 1 example import violation(s)
- `src/Xml.ts:131` `decodeXmlTextAs` (const) - 1 example import violation(s)
- `src/index.ts:187` `export * from "./Port.ts";` (re-export) - 2 example import violation(s)

### @beep/pglite

Path: `packages/drivers/pglite`

Module findings:
- `src/Pglite.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PgliteClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/test-utils

Path: `packages/tooling/test-kit/test-utils`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Layer.ts:46` `provideScopedLayer` (const) - 1 example import violation(s)
- `src/Schema.ts:39` `assertSchemaArbitraryDecodesToSelf` (const) - 1 example import violation(s)
- `src/SqlTest.ts:1047` `makePgliteTestcontainerResource` (const) - 1 example import violation(s)

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
- `src/index.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/Html.attributes.ts:78` `makeAsciiCaseInsensitiveEnumerated` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:706` `CrossOrigin` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:797` `Utf8Charset` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:836` `FormAutocomplete` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:891` `ButtonCommand` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1197` `HtmlStep` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1396` `HtmlRelationList` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1442` `LinkRelationList` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1490` `HtmlIdReferenceList` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1552` `MetadataName` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1631` `AutocompleteAttribute` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1833` `EnumeratedGlobalAttributes` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1943` `DatasetKey` (type) - 1 example import violation(s)
- `src/Html.conformance.ts:175` `ConformantHtml` (const) - 1 example import violation(s)
- `src/Html.conformance.ts:217` `ConformantHtmlNode` (const) - 2 example import violation(s)
- `src/Html.conformance.ts:2267` `conform` (const) - 1 example import violation(s)
- `src/Html.conformance.ts:2299` `conformantRoot` (const) - 1 example import violation(s)
- `src/Html.contract.ts:103` `HtmlDocumentChild` (type) - 1 example import violation(s)
- `src/Html.form-control.ts:43` `InputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:128` `resolveInputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:157` `inputStateAllowedAttributes` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:231` `ButtonState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:303` `resolveButtonState` (const) - 1 example import violation(s)
- `src/Html.meta.ts:603` `HTML_GLOBAL_ATTRIBUTE_NAMES` (const) - 1 documentation section/link violation(s)
- `src/Html.meta.ts:1425` `HtmlBooleanAttributeName` (type) - 1 example import violation(s)
- `src/Html.policy.ts:344` `SafeImageUrlAttribute` (type) - 1 example import violation(s)
- `src/Html.policy.ts:393` `HtmlPolicyRule` (type) - 1 example import violation(s)
- `src/Html.policy.ts:500` `SafeHtmlAst` (const) - 2 example import violation(s)
- `src/Html.policy.ts:526` `SafeHtmlAst` (type) - 2 example import violation(s)
- `src/Html.policy.ts:548` `SafeHtmlNode` (const) - 2 example import violation(s)
- `src/Html.policy.ts:804` `inspectSafeHtml` (const) - 2 example import violation(s)
- `src/Html.policy.ts:834` `enforceSafeHtml` (const) - 2 example import violation(s)
- `src/Html.policy.ts:861` `safeHtmlAstConformant` (const) - 2 example import violation(s)
- `src/Html.policy.ts:890` `safeHtmlAstRoot` (const) - 2 example import violation(s)
- `src/Html.script.ts:42` `HtmlMimeType` (const) - 2 example import violation(s)
- `src/Html.script.ts:82` `JavaScriptMimeTypeEssence` (const) - 1 example import violation(s)
- `src/Html.script.ts:136` `ScriptDataBlockMimeType` (const) - 2 example import violation(s)
- `src/Html.script.ts:189` `ScriptState` (const) - 1 example import violation(s)
- `src/Html.script.ts:230` `InvalidScriptType` (class) - 1 example import violation(s)
- `src/Html.script.ts:286` `resolveScriptState` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:93` `UntrustedHtml` (type) - 1 example import violation(s)
- `src/Html.serialize.ts:144` `SafeHtml` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:178` `SafeHtml` (type) - 2 example import violation(s)
- `src/Html.serialize.ts:228` `HtmlSerializeRule` (type) - 1 example import violation(s)
- `src/Html.serialize.ts:610` `serialize` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:636` `serializeConformant` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:686` `serializeSafe` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:708` `untrustedHtmlValue` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:742` `safeHtmlValue` (const) - 2 example import violation(s)
- `src/Html.source-size.ts:205` `SourceSizeIssue` (class) - 1 example import violation(s)
- `src/Html.source-size.ts:238` `SourceSizeAnalysis` (class) - 1 example import violation(s)
- `src/Html.source-size.ts:830` `inspectSourceSizeList` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/shared-domain

Path: `packages/shared/domain`

Module findings:
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/Organization/Organization.behavior.ts:38` `isTenantRoot` (const) - 1 example import violation(s)
- `src/entities/Organization/Organization.behavior.ts:88` `hasValidTenantPlacement` (const) - 1 example import violation(s)
- `src/entities/Organization/Organization.values.ts:36` `LicenseTier` (const) - 1 example import violation(s)
- `src/entities/Organization/Organization.values.ts:84` `Settings` (class) - 1 example import violation(s)
- `src/entity/EntityId.ts:89` `EntityIdValue` (const) - 1 example import violation(s)
- `src/entity/EntityRef.ts:53` `EntityType` (const) - 1 example import violation(s)
- `src/entity/EntityRef.ts:108` `EntityRef` (class) - 1 example import violation(s)
- `src/entity/EntityRef.ts:184` `makeResult` (const) - 1 example import violation(s)
- `src/entity/EntityRef.ts:233` `make` (const) - 1 example import violation(s)
- `src/entity/Principal.ts:253` `PrincipalSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/SourceKind.ts:32` `SourceKindSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/primitives.ts:64` `Sha256` (const) - 2 example import violation(s)
- `src/entity/primitives.ts:103` `Ed25519Signature` (const) - 1 example import violation(s)
- `src/entity/primitives.ts:147` `EncryptionKeyId` (const) - 1 example import violation(s)
- `src/entity/primitives.ts:191` `HybridLogicalClock` (const) - 1 example import violation(s)
- `src/entity/primitives.ts:235` `VectorClock` (const) - 1 example import violation(s)
- `src/identity/Agents/AgentId.ts:53` `AgentId` (type) - 1 example import violation(s)
- `src/identity/Agents/ProviderInstanceId.ts:53` `ProviderInstanceId` (type) - 1 example import violation(s)
- `src/identity/Agents/SkillId.ts:53` `SkillId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/ActivityId.ts:53` `ActivityId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/CandidateClaimId.ts:53` `CandidateClaimId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/ClaimDispositionId.ts:53` `ClaimDispositionId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/EdgeVersionId.ts:53` `EdgeVersionId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/EvidenceId.ts:53` `EvidenceId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/UsageRecordId.ts:53` `UsageRecordId` (type) - 1 example import violation(s)
- `src/identity/Shared/ActivityId.ts:53` `ActivityId` (type) - 1 example import violation(s)
- `src/identity/Shared/AgentId.ts:53` `AgentId` (type) - 1 example import violation(s)
- `src/identity/Shared/AgentVersionId.ts:53` `AgentVersionId` (type) - 1 example import violation(s)
- `src/identity/Shared/ConnectorAccountId.ts:53` `ConnectorAccountId` (type) - 1 example import violation(s)
- `src/identity/Shared/LocalMachineId.ts:53` `LocalMachineId` (type) - 1 example import violation(s)
- `src/identity/Shared/MembershipId.ts:53` `MembershipId` (type) - 1 example import violation(s)
- `src/identity/Shared/OrganizationId.ts:53` `OrganizationId` (type) - 1 example import violation(s)
- `src/identity/Shared/ServiceAccountId.ts:53` `ServiceAccountId` (type) - 1 example import violation(s)
- `src/identity/Shared/TeamId.ts:53` `TeamId` (type) - 1 example import violation(s)
- `src/identity/Shared/UserId.ts:53` `UserId` (type) - 1 example import violation(s)
- `src/identity/Workspace/ApprovalGateId.ts:53` `ApprovalGateId` (type) - 1 example import violation(s)
- `src/identity/Workspace/CandidateDraftId.ts:53` `CandidateDraftId` (type) - 1 example import violation(s)
- `src/identity/Workspace/CandidateProjectId.ts:53` `CandidateProjectId` (type) - 1 example import violation(s)
- `src/identity/Workspace/CandidateTaskId.ts:53` `CandidateTaskId` (type) - 1 example import violation(s)
- `src/identity/Workspace/ContextPacketId.ts:53` `ContextPacketId` (type) - 1 example import violation(s)
- `src/identity/Workspace/EmailArtifactId.ts:53` `EmailArtifactId` (type) - 1 example import violation(s)
- `src/identity/Workspace/MessageId.ts:53` `MessageId` (type) - 1 example import violation(s)
- `src/identity/Workspace/ThreadId.ts:53` `ThreadId` (type) - 1 example import violation(s)
- `src/identity/Workspace/TurnId.ts:53` `TurnId` (type) - 1 example import violation(s)
- `src/identity/Workspace/WorkspaceId.ts:53` `WorkspaceId` (type) - 1 example import violation(s)
- `src/identity/index.ts:84` `isIdentityComposer` (const) - 1 example import violation(s)
- `src/identity/index.ts:119` `AnyIdentityComposer` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:100` `makeEffect` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:207` `fromString` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:274` `todayEffect` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:707` `LocalDateFromString` (const) - 1 example import violation(s)

### @beep/md

Path: `packages/foundation/modeling/md`

Module findings:
- `src/Md.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.html.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.safe.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Md.behavior.ts:97` `segmentInlineRuns` (const) - 1 example import violation(s)
- `src/Md.behavior.ts:133` `renderPlainTextInline` (const) - 1 example import violation(s)
- `src/Md.behavior.ts:150` `renderPlainTextBlock` (const) - 1 example import violation(s)
- `src/Md.behavior.ts:167` `renderPlainTextBlocks` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:235` `CommonMarkDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:285` `GfmDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:331` `BeepMarkdownDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:382` `refineStrictMarkdownDocument` (const) - 2 example import violation(s)
- `src/Md.conformance.ts:466` `inspectMarkdownSpecificationConformance` (const) - 1 example import violation(s)
- `src/Md.escape.ts:156` `UrlPolicySpec` (const) - 1 example import violation(s)
- `src/Md.escape.ts:710` `maxBackticks` (const) - 1 example import violation(s)
- `src/Md.escape.ts:775` `renderFencedCode` (const) - 1 example import violation(s)
- `src/Md.html.ts:43` `renderSafeHtml` (const) - 2 example import violation(s)
- `src/Md.model.ts:56` `CodeFenceLanguage` (const) - 1 example import violation(s)
- `src/Md.model.ts:86` `CodeFenceLanguage` (type) - 1 example import violation(s)
- `src/Md.model.ts:113` `YouTubeVideoId` (const) - 1 example import violation(s)
- `src/Md.model.ts:192` `TableAlignment` (const) - 1 example import violation(s)
- `src/Md.model.ts:232` `AdmonitionKind` (const) - 1 example import violation(s)
- `src/Md.model.ts:272` `EmbedKind` (const) - 1 example import violation(s)
- `src/Md.model.ts:313` `InlineChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:1192` `Inline` (const) - 1 example import violation(s)
- `src/Md.model.ts:1341` `BlockChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:1415` `ListItemChild` (const) - 1 example import violation(s)
- `src/Md.model.ts:1513` `ListItemChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:1648` `HeadingLevel` (const) - 1 example import violation(s)
- `src/Md.model.ts:1671` `HeadingLevel` (type) - 1 example import violation(s)
- `src/Md.model.ts:1927` `ListChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:2072` `OrderedListStart` (const) - 1 example import violation(s)
- `src/Md.model.ts:2298` `TaskItemChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:3301` `Block` (const) - 1 example import violation(s)
- `src/Md.render.ts:594` `renderMarkdownInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:653` `renderHtmlInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:192` `EffectRenderAdapter` (interface) - 1 example import violation(s)
- `src/Md.render.ts:672` `renderMarkdownBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:725` `renderHtmlBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:760` `renderMarkdownBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:780` `renderHtmlBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:805` `renderUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:826` `renderHtmlUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:847` `renderPlainTextUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:892` `renderWithUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:927` `renderEffectWithUnsafe` (const) - 2 example import violation(s)
- `src/Md.render.ts:969` `renderEffectWith` (const) - 2 example import violation(s)
- `src/Md.render.ts:1373` `makeMarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1399` `makeHtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1423` `MarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1447` `HtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1466` `PlainTextAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1493` `renderWith` (const) - 2 example import violation(s)
- `src/Md.render.ts:1527` `render` (const) - 2 example import violation(s)
- `src/Md.render.ts:1552` `renderHtml` (const) - 2 example import violation(s)
- `src/Md.render.ts:1577` `renderPlainText` (const) - 2 example import violation(s)
- `src/Md.safe.ts:78` `DocumentSafetyPathSegment` (const) - 1 example import violation(s)
- `src/Md.safe.ts:743` `documentSafetyIssues` (const) - 1 example import violation(s)
- `src/Md.safe.ts:769` `inlineSafetyIssuesAtRoot` (const) - 1 example import violation(s)
- `src/Md.safe.ts:810` `SafeInline` (const) - 1 example import violation(s)
- `src/Md.safe.ts:837` `SafeInline` (type) - 1 example import violation(s)
- `src/Md.safe.ts:859` `SafeDocument` (const) - 1 example import violation(s)
- `src/Md.safe.ts:886` `SafeDocument` (type) - 1 example import violation(s)
- `src/Md.safe.ts:904` `decodeSafeDocument` (const) - 1 example import violation(s)
- `src/Md.safe.ts:925` `decodeSafeDocumentEffect` (const) - 1 example import violation(s)
- `src/Md.safe.ts:963` `refineSafeDocument` (const) - 2 example import violation(s)
- `src/Md.ts:122` `InlineContent` (type) - 1 example import violation(s)
- `src/Md.ts:178` `BlockContent` (type) - 1 example import violation(s)
- `src/Md.ts:201` `BlockTemplateValue` (type) - 1 example import violation(s)
- `src/Md.ts:240` `ListItemChildInput` (type) - 1 example import violation(s)
- `src/Md.ts:258` `ListItemContent` (type) - 1 example import violation(s)
- `src/Md.ts:297` `ListItemInput` (type) - 1 example import violation(s)
- `src/Md.ts:332` `TableRowInput` (type) - 1 example import violation(s)
- `src/Md.ts:542` `text` (const) - 1 example import violation(s)
- `src/Md.ts:559` `rawMarkdown` (const) - 1 example import violation(s)
- `src/Md.ts:580` `rawHtml` (const) - 1 example import violation(s)
- `src/Md.ts:597` `strong` (const) - 1 example import violation(s)
- `src/Md.ts:614` `em` (const) - 1 example import violation(s)
- `src/Md.ts:631` `del` (const) - 1 example import violation(s)
- `src/Md.ts:648` `code` (const) - 1 example import violation(s)
- `src/Md.ts:665` `a` (const) - 1 example import violation(s)
- `src/Md.ts:694` `img` (const) - 1 example import violation(s)
- `src/Md.ts:717` `br` (const) - 1 example import violation(s)
- `src/Md.ts:734` `inlineMath` (const) - 1 example import violation(s)
- `src/Md.ts:751` `footnoteRef` (const) - 1 example import violation(s)
- `src/Md.ts:769` `h1` (const) - 1 example import violation(s)
- `src/Md.ts:786` `h2` (const) - 1 example import violation(s)
- `src/Md.ts:803` `h3` (const) - 1 example import violation(s)
- `src/Md.ts:820` `h4` (const) - 1 example import violation(s)
- `src/Md.ts:837` `h5` (const) - 1 example import violation(s)
- `src/Md.ts:854` `h6` (const) - 1 example import violation(s)
- `src/Md.ts:871` `p` (const) - 1 example import violation(s)
- `src/Md.ts:888` `li` (const) - 1 example import violation(s)
- `src/Md.ts:905` `ul` (const) - 1 example import violation(s)
- `src/Md.ts:922` `ol` (const) - 1 example import violation(s)
- `src/Md.ts:951` `taskItem` (const) - 1 example import violation(s)
- `src/Md.ts:981` `taskListFromItems` (const) - 1 example import violation(s)
- `src/Md.ts:998` `blockquote` (const) - 1 example import violation(s)
- `src/Md.ts:1015` `pre` (const) - 1 example import violation(s)
- `src/Md.ts:1039` `tableCell` (const) - 1 example import violation(s)
- `src/Md.ts:1056` `tableRow` (const) - 1 example import violation(s)
- `src/Md.ts:1074` `table` (const) - 1 example import violation(s)
- `src/Md.ts:1111` `mathBlock` (const) - 1 example import violation(s)
- `src/Md.ts:1128` `footnoteDef` (const) - 1 example import violation(s)
- `src/Md.ts:1152` `admonition` (const) - 1 example import violation(s)
- `src/Md.ts:1176` `embed` (const) - 1 example import violation(s)
- `src/Md.ts:1224` `youtube` (const) - 2 example import violation(s)
- `src/Md.ts:1243` `youtubeEffect` (const) - 2 example import violation(s)
- `src/Md.ts:1266` `youtubeUnsafe` (const) - 1 example import violation(s)
- `src/Md.ts:1282` `hr` (const) - 1 example import violation(s)
- `src/Md.ts:1299` `make` (const) - 1 example import violation(s)
- `src/Md.ts:1333` `Md` (const) - 2 example import violation(s)
- `src/index.ts:23` `export * from "./Md.behavior.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:39` `export * from "./Md.conformance.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:54` `export * from "./Md.escape.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:71` `export * from "./Md.html.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:86` `export * from "./Md.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:101` `export * from "./Md.render.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:117` `export * from "./Md.safe.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:134` `export * from "./Md.ts";` (re-export) - 2 example import violation(s)

### @beep/rdf

Path: `packages/foundation/modeling/rdf`

Module findings:
- `src/Vocab/Dcterms.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `src/Iri.ts:869` `IRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:910` `RelativeIRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:950` `AbsoluteIRI` (const) - 1 example import violation(s)
- `src/Iri.ts:991` `IRI` (const) - 1 example import violation(s)
- `src/SemanticSchemaMetadata/SemanticSchemaMetadata.annotations.ts:62` `makeSemanticSchemaMetadataResult` (const) - 1 example import violation(s)
- `src/SemanticSchemaMetadata/SemanticSchemaMetadata.annotations.ts:162` `collectSemanticSchemaMetadataResult` (const) - 1 example import violation(s)
- `src/SemanticSchemaMetadata/SemanticSchemaMetadata.annotations.ts:221` `getSemanticSchemaMetadataResult` (const) - 1 example import violation(s)
- `src/Vocab/Xsd.ts:27` `XSD_NAMESPACE` (const) - 1 documentation section/link violation(s)

### @beep/provenance

Path: `packages/foundation/modeling/provenance`

Module findings:
- `src/TextAnchor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/TextAnchor.ts:151` `TextAnchor` (class) - 1 example import violation(s)
- `src/VerifiedTextAnchor.ts:512` `toTextAnchorVerificationReceipt` (const) - 1 example import violation(s)
- `src/VerifiedTextAnchor.ts:576` `verifySourceTextIdentity` (const) - 1 example import violation(s)
- `src/VerifiedTextAnchor.ts:708` `verifyTextAnchor` (const) - 1 example import violation(s)

### @beep/semantic-web

Path: `packages/foundation/capability/semantic-web`

Export findings:
- `src/identity/IdentityRdfBinding.ts:96` `IdentityRdfBinding` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:139` `DefaultIdentityRdfBinding` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:160` `IdentityFiberPathError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:186` `IdentityEntryIriError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:212` `IdentityDatasetDecodeError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:253` `decodeEntrySubject` (const) - 2 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:438` `entriesToDataset` (const) - 2 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:493` `datasetToEntries` (const) - 2 example import violation(s)
- `src/identity/IdentityRegistryDataset.ts:42` `layerDataset` (const) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:89` `IdentityShapePolicy` (class) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:127` `projectShapes` (const) - 2 example import violation(s)
- `src/services/canonicalization.ts:353` `CanonicalizationService` (class) - 1 example import violation(s)
- `src/services/shacl-validation.ts:426` `ShaclValidationService` (class) - 1 example import violation(s)
- `src/services/sparql-query.ts:361` `SparqlQueryService` (class) - 1 example import violation(s)
- `src/services/sparql-query.ts:397` `UnsupportedSparqlQueryServiceLive` (const) - 1 example import violation(s)

### @beep/agents-domain

Path: `packages/agents/domain`

Export findings:
- `src/entities/Skill/Skill.model.ts:97` `SkillFrontmatter` (const) - 1 example import violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Thread/Thread.errors.ts:44` `ThreadStoreNotFound` (class) - 1 example import violation(s)
- `src/aggregates/Thread/Thread.errors.ts:80` `ThreadStoreConflict` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:50` `CreateThreadInput` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:93` `AppendTurnInput` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:170` `SetThreadTitleIfEmptyInput` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:255` `ThreadStore` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:51` `TimelineMessageItem` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:92` `TimelineToolCallItem` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:128` `TimelineItem` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:178` `TimelineTurn` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:233` `ThreadTimeline` (class) - 1 example import violation(s)
- `src/aggregates/Workspace/WorkspaceVault.ts:236` `WorkspaceVaultStoreShape` (interface) - 1 example import violation(s)
- `src/aggregates/Workspace/WorkspaceVault.ts:275` `WorkspaceVaultStore` (class) - 1 example import violation(s)

### @beep/shared-use-cases

Path: `packages/shared/use-cases`

Export findings:
- `src/PromotionGate/PromotionGate.service.ts:62` `PromotionGate` (class) - 1 example import violation(s)

### @beep/colors

Path: `packages/foundation/capability/colors`

Module findings:
- `src/Colors.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/Colors.ts:63` `ProcessLikeStdout` (class) - 1 example import violation(s)
- `src/Colors.ts:91` `ProcessLike` (class) - 1 example import violation(s)
- `src/Colors.ts:197` `Formatter` (const) - 1 example import violation(s)
- `src/Colors.ts:214` `Formatter` (type) - 1 example import violation(s)
- `src/Colors.ts:253` `supportsColor` (const) - 1 example import violation(s)
- `src/Colors.ts:269` `isColorSupported` (const) - 1 example import violation(s)
- `src/Colors.ts:293` `Colors` (class) - 1 example import violation(s)
- `src/Colors.ts:342` `createColors` (const) - 1 example import violation(s)
- `src/Colors.ts:410` `default` (const) - 1 example import violation(s)

### @beep/file-processing

Path: `packages/foundation/capability/file-processing`

Export findings:
- `src/Artifact/Artifact.constructors.ts:41` `deriveArtifactId` (const) - 1 example import violation(s)
- `src/Artifact/Artifact.schema.ts:253` `ArtifactLocator` (class) - 1 example import violation(s)
- `src/Artifact/Artifact.schema.ts:297` `SourceArtifact` (class) - 1 example import violation(s)
- `src/Artifact/Artifact.schema.ts:343` `ArtifactReference` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:71` `encodeProcessRunManifestJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:108` `encodeFileProcessingCoverageSummaryJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:145` `encodeSourceProcessingRecordJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:184` `encodeFileProcessingFailureRecordJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:220` `encodeChildArtifactRecordJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:67` `SucceededSourceProcessingRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:123` `SkippedSourceProcessingRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:177` `FailedSourceProcessingRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:228` `SourceProcessingRecord` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:268` `SourceProcessingRecord` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:288` `FileProcessingFailureReason` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:317` `FileProcessingFailureReason` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:345` `SkippedFileProcessingFailureRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:397` `FailedFileProcessingFailureRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:441` `FileProcessingFailureRecord` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:480` `FileProcessingFailureRecord` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:507` `ChildArtifactRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:547` `FileProcessingCoverageSummary` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:601` `ProcessRunManifest` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:89` `TextArtifactReference` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:168` `ExtractionResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:209` `ArchiveExportResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:263` `ExtractedProcessFileResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:317` `ArchiveExportProcessFileResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:367` `SkippedProcessFileResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:414` `ProcessFileResult` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:454` `ProcessFileResult` (type) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:48` `DetectFileOperation` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:83` `DetectionResult` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:130` `ExtractFileOperation` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:176` `ExportArchiveOperation` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:223` `ProcessFileOperation` (class) - 1 example import violation(s)
- `src/PathSafety/PathSafety.policy.ts:112` `validateResolvedPath` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:50` `isResolvedPathWithinRoot` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:104` `resolvePathWithinRoot` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:226` `resolvePathWithinCanonicalRoot` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:346` `writeFileWithinCanonicalRootAtomically` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:400` `writeFileWithinRootAtomically` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.layer.ts:108` `makeFileProcessingServiceLayer` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:102` `FileProcessingService` (class) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:180` `detectFile` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:234` `extractFile` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:287` `exportArchive` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:341` `processFile` (const) - 1 example import violation(s)
- `src/SourceText/SourceText.paging.ts:120` `pageSourceText` (const) - 1 example import violation(s)
- `src/SourceText/SourceText.paging.ts:162` `pageSourceTextContainingOffset` (const) - 1 example import violation(s)
- `src/Strategy/Strategy.schema.ts:438` `SelectedStrategy` (const) - 1 example import violation(s)
- `src/Strategy/Strategy.schema.ts:476` `SelectedStrategy` (type) - 1 example import violation(s)
- `src/test.ts:81` `decodeTestOperationIdentifiers` (const) - 1 example import violation(s)

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
- `src/values/Contradiction/Contradiction.model.ts:1365` `contradictionProposalDigest` (const) - 1 example import violation(s)
- `src/values/Contradiction/Contradiction.model.ts:1518` `contradictionCandidateDigest` (const) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:47` `Confidence` (const) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:71` `Confidence` (type) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:143` `EvidenceSpan` (class) - 1 example import violation(s)
- `src/values/EvidenceSpan/index.ts:30` `export * from "./EvidenceSpan.model.ts";` (re-export) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:535` `sealExecutionDecision` (const) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:575` `verifyExecutionDecisionHash` (const) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:780` `sealExecutionOutcome` (const) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:809` `verifyExecutionOutcomeHash` (const) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:146` `FrozenGrantSet` (class) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:279` `addGrant` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:361` `freezeGrantSet` (const) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:401` `verifyFrozenGrantSetDigest` (const) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:436` `ExecutionRequestEvaluationOptions` (class) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:504` `evaluateExecutionRequest` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

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
- `src/Algebra/Monoid.ts:387` `MultiSet` (const) - 1 example import violation(s)
- `src/Core/Document.ts:199` `Document` (class) - 1 example import violation(s)
- `src/Core/Pattern.ts:534` `Pattern` (class) - 1 example import violation(s)
- `src/Core/Sentence.ts:113` `Sentence` (class) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:788` `traverseNodes` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:834` `traverseNodesCollect` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:881` `mapNodesEffect` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:941` `streamNodes` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:968` `streamNodesWithIndex` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:995` `batchNodes` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:53` `NLPOperation` (type) - 1 example import violation(s)
- `src/Operations/Composable.ts:79` `OperationBuilder` (class) - 1 example import violation(s)
- `src/Operations/Composable.ts:280` `makeOperation` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:325` `fromDefinition` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:353` `makePureOperation` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:393` `map` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:434` `product` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:476` `zipWith` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:523` `compose` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:555` `identity` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:577` `traverse` (const) - 1 example import violation(s)
- `src/Operations/Definition.ts:49` `OperationDefinition` (interface) - 1 example import violation(s)
- `src/Operations/Definition.ts:82` `OperationInput` (type) - 1 example import violation(s)
- `src/Operations/Definition.ts:109` `OperationOutput` (type) - 1 example import violation(s)
- `src/index.ts:23` `export * as Algebra from "./Algebra/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:38` `export * as Core from "./Core/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:53` `export * as Graph from "./Graph/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:69` `export * as Handoff from "./Handoff/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:85` `export * as IdentifierText from "./IdentifierText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:100` `export * as Ontology from "./Ontology/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:116` `export * as PathText from "./PathText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:132` `export * as QueryText from "./QueryText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:148` `export * as VariantText from "./VariantText.ts";` (re-export) - 1 example import violation(s)

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
- `src/ApiKeyRequired.ts:75` `ApiKeyRequiredFailure` (class) - 1 example import violation(s)
- `src/ApiKeyRequired.ts:131` `apiKeyRequiredFailure` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/FieldTier.ts:50` `FieldTierName` (const) - 1 example import violation(s)
- `src/FieldTier.ts:71` `FieldTierName` (type) - 1 example import violation(s)
- `src/FieldTier.ts:96` `FieldTierSet` (interface) - 1 example import violation(s)
- `src/FieldTier.ts:130` `defineFieldTiers` (const) - 1 example import violation(s)
- `src/FieldTier.ts:157` `stripNulls` (const) - 1 example import violation(s)
- `src/FieldTier.ts:189` `projectFieldTier` (const) - 1 example import violation(s)
- `src/FieldTier.ts:232` `estimateJsonSize` (const) - 1 example import violation(s)
- `src/FieldTier.ts:260` `OversizedFieldProjection` (class) - 1 example import violation(s)
- `src/FieldTier.ts:298` `FetchableHandle` (class) - 1 example import violation(s)
- `src/FieldTier.ts:343` `FieldProjectionOutcome` (const) - 1 example import violation(s)
- `src/FieldTier.ts:380` `FieldProjectionOutcome` (type) - 2 example import violation(s)
- `src/FieldTier.ts:433` `projectWithinBudget` (const) - 1 example import violation(s)
- `src/FieldTier.ts:470` `ColumnarEnvelope` (class) - 1 example import violation(s)
- `src/FieldTier.ts:517` `toColumnarEnvelope` (const) - 1 example import violation(s)
- `src/McpCaller.ts:43` `McpCallerIdentity` (class) - 1 example import violation(s)
- `src/McpCaller.ts:75` `CurrentMcpCaller` (const) - 2 example import violation(s)
- `src/SanitizedSpan.ts:69` `defaultSanitizedSpanKeys` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:94` `sanitizeTracerAttributes` (const) - 2 example import violation(s)
- `src/SanitizedSpan.ts:183` `withSanitizedToolSpan` (const) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:598` `sanitizedToolkit` (const) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/SourceAuth.ts:53` `SourceAuthGate` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:75` `SourceAuthGate` (type) - 1 example import violation(s)
- `src/SourceAuth.ts:98` `SourceAuthRegistration` (class) - 1 example import violation(s)
- `src/SourceAuth.ts:147` `resolveSourceCredential` (const) - 2 example import violation(s)
- `src/SourceAuth.ts:176` `SourceAuthDecision` (type) - 2 example import violation(s)
- `src/SourceAuth.ts:197` `SourceAuthDecision` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:226` `decideSourceAuthMount` (const) - 2 example import violation(s)
- `src/TierGate.ts:60` `TierGateSettlement` (const) - 1 example import violation(s)
- `src/TierGate.ts:82` `TierGateSettlement` (type) - 1 example import violation(s)
- `src/TierGate.ts:102` `TierGateOutcome` (const) - 1 example import violation(s)
- `src/TierGate.ts:125` `TierGateOutcome` (type) - 2 example import violation(s)
- `src/TierGate.ts:155` `TierGateAuditRecord` (class) - 1 example import violation(s)
- `src/TierGate.ts:215` `TierGateVerdict` (const) - 1 example import violation(s)
- `src/TierGate.ts:250` `TierGateVerdict` (type) - 1 example import violation(s)
- `src/TierGate.ts:275` `ToolCallRequest` (interface) - 1 example import violation(s)
- `src/TierGate.ts:325` `TierGateShape` (interface) - 3 example import violation(s)
- `src/TierGate.ts:371` `TierGate` (class) - 2 example import violation(s)
- `src/TierGate.ts:391` `TierGatePolicy` (class) - 1 example import violation(s)
- `src/TierGate.ts:461` `fromApprovedToolsPolicy` (const) - 2 example import violation(s)
- `src/TierGate.ts:513` `TierGateDispatchResult` (type) - 1 example import violation(s)
- `src/TierGate.ts:548` `TierGateDispatchResult` (const) - 1 example import violation(s)
- `src/TierGate.ts:597` `dispatchWithTierGate` (const) - 2 example import violation(s)
- `src/TierGate.ts:635` `withEnabledWhenApprovedTool` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:42` `FourHintAnnotations` (class) - 1 example import violation(s)
- `src/ToolAnnotations.ts:101` `AnnotatedTool` (type) - 1 example import violation(s)
- `src/ToolAnnotations.ts:120` `annotateFourHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:153` `readOnlyToolHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:171` `destructiveWriteToolHints` (const) - 1 example import violation(s)
- `src/ToolkitComposition.ts:53` `GatedLayer` (interface) - 3 example import violation(s)
- `src/ToolkitComposition.ts:89` `gatedLayer` (const) - 2 example import violation(s)
- `src/ToolkitComposition.ts:134` `composeGatedLayers` (const) - 2 example import violation(s); 1 documentation section/link violation(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Module findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:88` `ProviderInstanceRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:117` `ProviderInstanceRepository` (class) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:170` `ProviderProbeShape` (interface) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:189` `ProviderProbe` (class) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.service.ts:40` `makeProviderInstanceUseCases` (const) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.use-cases.ts:39` `ProviderInstanceUseCasesShape` (interface) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.use-cases.ts:69` `ProviderInstanceUseCases` (class) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:166` `FixtureTurnKernel` (const) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:42` `AgentTurnKernelShape` (interface) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:79` `AgentTurnKernel` (class) - 1 example import violation(s)
- `src/processes/AssistantTurn/index.ts:63` `export * from "./AssistantTurn.kernel.ts";` (re-export) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.commands.ts:66` `ProposeCandidateOutputSet` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:397` `RuntimeDraftRecipient` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:446` `RuntimeCandidateDraft` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:844` `CandidateOutputSet` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts:299` `makeInMemoryProfessionalRuntimeSdk` (const) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts:622` `runRuntimeFixture` (const) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.service.ts:38` `ProfessionalRuntimeSdk` (interface) - 1 example import violation(s)
- `src/proof.ts:49` `export { makeInMemoryProfessionalRuntimeSdk } from "./processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts";` (re-export) - 1 example import violation(s)
- `src/proof.ts:89` `export {
  RuntimeFixtureInput,
  runRuntimeFixture,
} from "./processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts";` (re-export) - 1 example import violation(s)
- `src/public.ts:169` `export type { ProfessionalRuntimeSdk } from "./processes/ProfessionalRuntime/ProfessionalRuntime.service.ts";` (re-export) - 1 example import violation(s)
- `src/test.ts:28` `export * from "./proof.ts";` (re-export) - 1 example import violation(s)

### @beep/observability

Path: `packages/foundation/capability/observability`

Module findings:
- `src/CauseDiagnostics.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/CauseRedaction.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/HttpError.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Logging.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Metric.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Observed.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/PhaseProfiler.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/CauseDiagnostics.ts:59` `CauseClassification` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:80` `CauseClassification` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:98` `ExitOutcome` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:119` `ExitOutcome` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:136` `CauseFingerprint` (class) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:203` `CauseSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:273` `ObservedExitSummary` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:294` `ObservedExitSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:423` `classifyCause` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:446` `fingerprintCause` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:471` `summarizeCause` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:522` `summarizeExit` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:581` `renderObservedCause` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:69` `REDACTION_PLACEHOLDER` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:89` `DEFAULT_MESSAGE_LIMIT` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:109` `DEFAULT_DETAIL_LIMIT` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:128` `RedactionChannel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:149` `RedactionChannel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:201` `sanitizeSensitiveText` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:226` `redactString` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:256` `RedactedCause` (class) - 2 example import violation(s)
- `src/CauseRedaction.ts:294` `RedactCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:388` `redactCauseSummary` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:424` `redactCause` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:454` `redactCauseForClient` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:478` `RedactedCauseError` (class) - 2 example import violation(s)
- `src/CauseRedaction.ts:513` `redactCauseEffect` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:542` `RedactedCauseLogLevel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:563` `RedactedCauseLogLevel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:580` `LogRedactedCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:626` `logRedactedCause` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:668` `tapRedactedCause` (const) - 2 example import violation(s)
- `src/CoreConfig.ts:45` `ObservabilityCoreConfig` (const) - 1 example import violation(s)
- `src/CoreConfig.ts:69` `ObservabilityCoreConfig` (type) - 1 example import violation(s)
- `src/HttpError.ts:164` `ClientHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:202` `ServerHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:235` `BadRequestError` (class) - 2 example import violation(s)
- `src/HttpError.ts:262` `UnauthorizedError` (class) - 2 example import violation(s)
- `src/HttpError.ts:289` `ForbiddenError` (class) - 2 example import violation(s)
- `src/HttpError.ts:316` `NotFoundError` (class) - 2 example import violation(s)
- `src/HttpError.ts:343` `ConflictError` (class) - 2 example import violation(s)
- `src/HttpError.ts:370` `UnprocessableEntityError` (class) - 2 example import violation(s)
- `src/HttpError.ts:397` `TooManyRequestsError` (class) - 2 example import violation(s)
- `src/HttpError.ts:424` `InternalServerErrorError` (class) - 2 example import violation(s)
- `src/HttpError.ts:451` `BadGatewayError` (class) - 2 example import violation(s)
- `src/HttpError.ts:478` `ServiceUnavailableError` (class) - 2 example import violation(s)
- `src/HttpError.ts:505` `GatewayTimeoutError` (class) - 2 example import violation(s)
- `src/HttpError.ts:531` `makeBadRequestError` (const) - 1 example import violation(s)
- `src/HttpError.ts:551` `makeUnauthorizedError` (const) - 1 example import violation(s)
- `src/HttpError.ts:571` `makeForbiddenError` (const) - 1 example import violation(s)
- `src/HttpError.ts:591` `makeNotFoundError` (const) - 1 example import violation(s)
- `src/HttpError.ts:611` `makeConflictError` (const) - 1 example import violation(s)
- `src/HttpError.ts:631` `makeUnprocessableEntityError` (const) - 1 example import violation(s)
- `src/HttpError.ts:651` `makeTooManyRequestsError` (const) - 1 example import violation(s)
- `src/HttpError.ts:671` `makeInternalServerError` (const) - 1 example import violation(s)
- `src/HttpError.ts:691` `makeBadGatewayError` (const) - 1 example import violation(s)
- `src/HttpError.ts:711` `makeServiceUnavailableError` (const) - 1 example import violation(s)
- `src/HttpError.ts:731` `makeGatewayTimeoutError` (const) - 1 example import violation(s)
- `src/Logging.ts:55` `LogFormat` (const) - 1 example import violation(s)
- `src/Logging.ts:76` `LogFormat` (type) - 1 example import violation(s)
- `src/Logging.ts:93` `PrettyLogTheme` (const) - 1 example import violation(s)
- `src/Logging.ts:114` `PrettyLogTheme` (type) - 1 example import violation(s)
- `src/Logging.ts:131` `BannerMode` (const) - 1 example import violation(s)
- `src/Logging.ts:152` `BannerMode` (type) - 1 example import violation(s)
- `src/Logging.ts:173` `PrettyLoggerConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:202` `LoggingConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:236` `layerMinimumLogLevel` (const) - 2 example import violation(s)
- `src/Logging.ts:255` `RenderLogBannerOptions` (class) - 1 example import violation(s)
- `src/Logging.ts:365` `renderLogBanner` (const) - 1 example import violation(s)
- `src/Logging.ts:455` `layerConsoleLogger` (const) - 2 example import violation(s)
- `src/Metric.ts:52` `TrackDurationOptions` (class) - 1 example import violation(s)
- `src/Metric.ts:79` `TrackDurationOptionsInput` (type) - 1 example import violation(s)
- `src/Metric.ts:153` `statusClass` (const) - 1 example import violation(s)
- `src/Metric.ts:188` `measureElapsedMillis` (const) - 2 example import violation(s)
- `src/Metric.ts:272` `trackDuration` (const) - 2 example import violation(s)
- `src/Metric.ts:398` `observeWorkflow` (const) - 2 example import violation(s)
- `src/Metric.ts:549` `observeHttpRequest` (const) - 2 example import violation(s)
- `src/Observed.ts:46` `ObservedError` (const) - 1 example import violation(s)
- `src/Observed.ts:67` `ObservedError` (type) - 1 example import violation(s)
- `src/Observed.ts:86` `ObservedErrorWithStack` (const) - 1 example import violation(s)
- `src/Observed.ts:107` `ObservedErrorWithStack` (type) - 1 example import violation(s)
- `src/Observed.ts:126` `ObservedDefect` (const) - 1 example import violation(s)
- `src/Observed.ts:147` `ObservedDefect` (type) - 1 example import violation(s)
- `src/Observed.ts:166` `ObservedDefectWithStack` (const) - 1 example import violation(s)
- `src/Observed.ts:187` `ObservedDefectWithStack` (type) - 1 example import violation(s)
- `src/Observed.ts:208` `ObservedCauseReason` (const) - 2 example import violation(s)
- `src/Observed.ts:229` `ObservedCauseReason` (type) - 1 example import violation(s)
- `src/Observed.ts:248` `ObservedCause` (const) - 2 example import violation(s)
- `src/Observed.ts:269` `ObservedCause` (type) - 1 example import violation(s)
- `src/Observed.ts:288` `ObservedExit` (const) - 2 example import violation(s)
- `src/Observed.ts:309` `ObservedExit` (type) - 1 example import violation(s)
- `src/PhaseProfiler.ts:70` `PhaseOutcome` (const) - 2 example import violation(s)
- `src/PhaseProfiler.ts:91` `PhaseOutcome` (type) - 1 example import violation(s)
- `src/PhaseProfiler.ts:117` `PhaseProfile` (class) - 1 example import violation(s)
- `src/PhaseProfiler.ts:301` `profilePhase` (const) - 2 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:75` `DevToolsRelayService` (class) - 1 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:122` `makeDevToolsRelayService` (const) - 1 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:229` `layerDevToolsRelayServer` (const) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:154` `OtlpPacketLab` (class) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:289` `layerJson` (const) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:311` `layerProtobuf` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:34` `DevToolsSpanFilter` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:60` `DevToolsSpanFilter` (type) - 1 example import violation(s)
- `src/server/ErrorReporting.ts:146` `layerErrorReporter` (const) - 1 example import violation(s)
- `src/server/HttpApiTelemetry.ts:528` `observeHttpApiEffect` (const) - 1 example import violation(s)
- `src/server/HttpApiTelemetry.ts:593` `HttpApiTelemetryMiddleware` (class) - 1 example import violation(s)
- `src/server/HttpApiTelemetry.ts:740` `observeHttpApiHandler` (const) - 1 example import violation(s)
- `src/server/TraceContext.ts:54` `injectTraceContextHeaders` (const) - 1 example import violation(s)
- `src/server/TraceContext.ts:115` `withIncomingTraceContext` (const) - 1 example import violation(s)

### @beep/epistemic-use-cases

Path: `packages/epistemic/use-cases`

Module findings:
- `src/ClaimDisposition/ClaimDisposition.commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimGate/ClaimGate.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimProjection/ClaimProjection.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:1` (none) - missing summary; missing @since
- `src/ContradictionTriage/ContradictionTriage.rpc.ts:1` (none) - missing summary; missing @since
- `src/EdgeAuthority/EdgeAuthority.commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ClaimDisposition/ClaimDisposition.ports.ts:161` `ClaimDispositionRepositoryShape` (interface) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.ports.ts:198` `ClaimDispositionRepository` (class) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:211` `ClaimGateOutcomeResolverShape` (interface) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:246` `ClaimGateOutcomeResolver` (class) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:328` `makeClaimGateOutcomeResolver` (const) - 1 example import violation(s)
- `src/ClaimEvidenceReview/ClaimEvidenceReview.service.ts:52` `explainClaimEvidence` (const) - 1 example import violation(s)
- `src/ClaimEvidenceReview/ClaimEvidenceReview.service.ts:102` `approveClaimEvidence` (const) - 1 example import violation(s)
- `src/ClaimGate/ClaimGate.ports.ts:43` `ClaimGateShape` (interface) - 1 example import violation(s)
- `src/ClaimGate/ClaimGate.ports.ts:80` `ClaimGate` (class) - 1 example import violation(s)
- `src/ClaimGate/ClaimGate.service.ts:135` `makeClaimGate` (const) - 1 example import violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:39` `ClaimTransitionShape` (interface) - 1 example import violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:76` `ClaimTransition` (class) - 1 example import violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:116` `makeClaimTransition` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:243` `ListContradictionCandidates` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:292` `GetContradictionCandidate` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:340` `GetExpandedContradictionCandidate` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.ports.ts:64` `ContradictionReviewer` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.ports.ts:88` `ContradictionReviewScope` (class) - 1 example import violation(s)
- `src/EdgeAuthority/EdgeAuthority.ports.ts:63` `EdgeAuthorityRepositoryShape` (interface) - 1 example import violation(s)
- `src/EdgeAuthority/EdgeAuthority.ports.ts:104` `EdgeAuthorityRepository` (class) - 1 example import violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:64` `ExecutionLedgerShape` (interface) - 1 example import violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:112` `ExecutionLedger` (class) - 1 example import violation(s)

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
- `src/Pretext.models.ts:306` `naturalWidth` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:340` `lineRanges` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:397` `lineStats` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:433` `lineCount` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:476` `textHeight` (const) - 1 example import violation(s)

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
- `src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:190` `PatentCitationDiscovery` (const) - 1 example import violation(s)
- `src/values/CitingApplicationIdentity/CitingApplicationIdentity.model.ts:474` `CitingApplicationIdentity` (const) - 1 example import violation(s)
- `src/values/KindCode/KindCode.model.ts:37` `KindCode` (const) - 1 documentation section/link violation(s)
- `src/values/OfficeCode/OfficeCode.model.ts:38` `OfficeCode` (const) - 1 documentation section/link violation(s)
- `src/values/PatentDocument/PatentDocument.normalizer.ts:499` `normalizePatentApplicationDocument` (const) - 2 example import violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:61` `PatentDocumentTriplet` (const) - 4 documentation section/link violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:38` `PatentNumber` (const) - 1 documentation section/link violation(s)

### @beep/langextract

Path: `packages/foundation/capability/langextract`

Export findings:
- `src/Alignment/Alignment.model.ts:294` `CurrentAlignmentSource` (class) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:323` `SpanFromMatch` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:370` `MatchedTextFromScored` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:404` `AlignedMatchFromMatchedText` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:455` `GroundedExtractionFromCandidate` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:497` `GroundedExtractionsFromCandidates` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.behavior.ts:92` `parseModelOutput` (const) - 1 example import violation(s)
- `src/Service/Service.layer.ts:163` `layer` (const) - 1 example import violation(s)
- `src/Service/Service.policy.ts:41` `allowRemoteExtractionPolicy` (const) - 1 example import violation(s)
- `src/Service/Service.policy.ts:120` `ensureRemoteExtractionAllowed` (const) - 1 example import violation(s)
- `src/Service/Service.prompt.ts:82` `buildPrompt` (const) - 1 example import violation(s)
- `src/Service/Service.service.ts:34` `LangExtractServiceShape` (interface) - 1 example import violation(s)
- `src/Service/Service.service.ts:57` `LangExtractRemotePolicyShape` (interface) - 1 example import violation(s)
- `src/Service/Service.service.ts:127` `LangExtractService` (class) - 1 example import violation(s)
- `src/Service/Service.service.ts:148` `LangExtractRemotePolicy` (class) - 1 example import violation(s)
- `src/Service/Service.service.ts:176` `LangExtractGenerationTimeout` (class) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:310` `locateRawText` (const) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:391` `convertTextOffsetRange` (const) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:437` `reconstructSourceText` (const) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:493` `locateGroundedExtractions` (const) - 1 example import violation(s)

### @beep/api-transport

Path: `packages/foundation/capability/api-transport`

Module findings:
- `src/EgressDenied.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Transport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/EgressDenied.ts:46` `EgressDenied` (class) - 1 example import violation(s)
- `src/Transport.ts:63` `ApiAuth` (const) - 1 example import violation(s)
- `src/Transport.ts:110` `ApiAuth` (type) - 1 example import violation(s)
- `src/Transport.ts:173` `RateLimitSnapshot` (class) - 1 example import violation(s)
- `src/Transport.ts:273` `ApiTransportOptions` (class) - 1 example import violation(s)
- `src/Transport.ts:347` `ApiTransport` (interface) - 2 example import violation(s)
- `src/Transport.ts:386` `makeApiTransport` (const) - 2 example import violation(s)

### @beep/epistemic-config

Path: `packages/epistemic/config`

Module findings:
- `src/Audience.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ServerConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TestLayer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ServerConfig.ts:71` `EpistemicDestinationAllowlistConfig` (const) - 1 example import violation(s)
- `src/ServerConfig.ts:99` `EpistemicPolicyRevisionConfig` (const) - 1 example import violation(s)
- `src/ServerConfig.ts:178` `EpistemicConfig` (class) - 1 example import violation(s)
- `src/TestLayer.ts:78` `fixtureFrozenAt` (const) - 1 example import violation(s)
- `src/TestLayer.ts:150` `makeEpistemicConfigTest` (const) - 1 example import violation(s)
- `src/TestLayer.ts:167` `EpistemicConfigTest` (const) - 1 example import violation(s)
- `src/layer.ts:42` `EpistemicConfigLive` (const) - 1 example import violation(s)

### @beep/postgres

Path: `packages/drivers/postgres`

Export findings:
- `src/PostgresDiagnostics.service.ts:312` `formatSql` (const) - 1 example import violation(s)
- `src/PostgresDiagnostics.service.ts:365` `formatPostgresErrorWith` (const) - 1 example import violation(s)
- `src/PostgresDiagnostics.service.ts:440` `logPostgresError` (const) - 1 example import violation(s)

### @beep/epistemic-tables

Path: `packages/epistemic/tables`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/entities/EdgeVersion/EdgeVersion.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology-use-cases

Path: `packages/ontology/use-cases`

Module findings:
- `src/aggregates/Session/worker.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Session/Session.ports.ts:327` `TurtleCodec` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.ports.ts:519` `OntologyFileStoreShape` (interface) - 1 example import violation(s)
- `src/aggregates/Session/Session.ports.ts:544` `OntologyFileStore` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.reasoner.ts:935` `OntologyReasoner` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.service.ts:169` `SessionUseCases` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.sparql.ts:650` `OntologySparqlRunner` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.validation.ts:345` `OntologyValidationRunnerShape` (interface) - 1 example import violation(s)
- `src/aggregates/Session/Session.validation.ts:878` `OntologyValidationRunner` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:285` `encodeWorkerCommand` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:326` `encodeWorkerResult` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:367` `OntologyWorkerUndecodableCommand` (class) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolService.ts:361` `OntologyToolService` (class) - 1 example import violation(s)

### @beep/cosmos

Path: `packages/drivers/cosmos`

Export findings:
- `src/Cosmos.renderer.ts:743` `renderCosmosGraph` (const) - 1 example import violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Module findings:
- `src/Chat.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClientObservability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Chat.atoms.ts:95` `chatProtocolLayerAtom` (const) - 1 example import violation(s)
- `src/Chat.atoms.ts:710` `SendTurnRequest` (class) - 2 example import violation(s)
- `src/Chat.atoms.ts:742` `EditTurnRequest` (class) - 2 example import violation(s)
- `src/Chat.atoms.ts:780` `TurnRequest` (const) - 2 example import violation(s)
- `src/Chat.atoms.ts:808` `TurnRequest` (type) - 2 example import violation(s)
- `src/Chat.atoms.ts:882` `runTurnAtom` (const) - 2 example import violation(s)
- `src/Chat.layer.ts:74` `HttpChatProtocolLive` (const) - 1 example import violation(s)
- `src/ClientObservability.ts:93` `ClientObservabilityLive` (const) - 1 example import violation(s)
- `src/index.ts:52` `export * from "./ClientObservability.ts";` (re-export) - 1 example import violation(s)

### @beep/documents-domain

Path: `packages/documents/domain`

Export findings:
- `src/values/Taxonomy/Taxonomy.projection.ts:234` `projectFiledDocumentPath` (const) - 1 example import violation(s)
- `src/values/Taxonomy/Taxonomy.projection.ts:311` `projectInboxDocumentPath` (const) - 1 example import violation(s)
- `src/values/Taxonomy/Taxonomy.projection.ts:342` `projectIntakeInboxPath` (const) - 1 example import violation(s)

### @beep/architecture-lab-domain

Path: `packages/architecture-lab/domain`

Export findings:
- `src/aggregates/WorkItem/WorkItem.model.ts:241` `assign` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.model.ts:286` `complete` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.model.ts:333` `reopen` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.model.ts:373` `archive` (const) - 1 example import violation(s)

### @beep/codegen-kit

Path: `packages/tooling/library/codegen-kit`

Export findings:
- `src/CodegenKit.service.ts:493` `CodegenKit` (class) - 1 example import violation(s)

### @beep/chalk

Path: `packages/foundation/capability/chalk`

Module findings:
- `src/Chalk.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/Chalk.ts:93` `ChalkInstance` (interface) - 1 example import violation(s)
- `src/Chalk.ts:127` `Chalk` (type) - 1 example import violation(s)
- `src/Chalk.ts:158` `Chalk` (const) - 1 example import violation(s)
- `src/Chalk.ts:181` `BackgroundColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:198` `BackgroundColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:221` `ChalkConstructorOptions` (const) - 1 example import violation(s)
- `src/Chalk.ts:243` `ChalkConstructorOptions` (type) - 1 example import violation(s)
- `src/Chalk.ts:266` `ChalkOptions` (const) - 1 example import violation(s)
- `src/Chalk.ts:283` `ChalkOptions` (type) - 1 example import violation(s)
- `src/Chalk.ts:306` `ColorInfo` (const) - 1 example import violation(s)
- `src/Chalk.ts:323` `ColorInfo` (type) - 1 example import violation(s)
- `src/Chalk.ts:346` `ColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:363` `ColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:391` `ColorSupport` (const) - 1 example import violation(s)
- `src/Chalk.ts:408` `ColorSupport` (type) - 1 example import violation(s)
- `src/Chalk.ts:430` `ColorSupportLevel` (const) - 1 example import violation(s)
- `src/Chalk.ts:447` `ColorSupportLevel` (type) - 1 example import violation(s)
- `src/Chalk.ts:470` `ColorSupportLevelInput` (const) - 1 example import violation(s)
- `src/Chalk.ts:487` `ColorSupportLevelInput` (type) - 1 example import violation(s)
- `src/Chalk.ts:510` `ForegroundColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:527` `ForegroundColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:550` `ModifierName` (const) - 1 example import violation(s)
- `src/Chalk.ts:567` `ModifierName` (type) - 1 example import violation(s)
- `src/Chalk.ts:584` `modifierNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:601` `foregroundColorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:618` `backgroundColorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:635` `colorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:652` `modifiers` (const) - 1 example import violation(s)
- `src/Chalk.ts:669` `foregroundColors` (const) - 1 example import violation(s)
- `src/Chalk.ts:686` `backgroundColors` (const) - 1 example import violation(s)
- `src/Chalk.ts:703` `colors` (const) - 1 example import violation(s)
- `src/Chalk.ts:725` `supportsColor` (const) - 1 example import violation(s)
- `src/Chalk.ts:747` `supportsColorStderr` (const) - 1 example import violation(s)
- `src/Chalk.ts:774` `chalkStderr` (const) - 1 example import violation(s)
- `src/Chalk.ts:806` `default` (const) - 1 example import violation(s)

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
- `src/Dependencies.ts:82` `extractWorkspaceDependencies` (const) - 1 example import violation(s)
- `src/DependencyIndex.ts:56` `buildRepoDependencyIndex` (const) - 1 example import violation(s)
- `src/FsUtils.ts:177` `FsUtils` (class) - 1 example import violation(s)
- `src/FsUtils.ts:195` `FsUtilsLive` (const) - 1 example import violation(s)
- `src/FsUtils.ts:429` `walkFiles` (const) - 1 example import violation(s)
- `src/FsUtils.ts:528` `exists` (const) - 1 example import violation(s)
- `src/FsUtils.ts:570` `findNearestPackageDir` (const) - 1 example import violation(s)
- `src/Graph.ts:101` `topologicalSort` (const) - 1 example import violation(s)
- `src/Graph.ts:179` `detectCycles` (const) - 1 example import violation(s)
- `src/Graph.ts:287` `computeTransitiveClosure` (const) - 1 example import violation(s)
- `src/JSDoc/models/CanonicalJSDocSourceMetadata.model.ts:33` `CanonicalJSDocSourceMetadata` (class) - 1 example import violation(s)
- `src/JsonUtils.ts:41` `jsonStringifyPretty` (const) - 1 example import violation(s)
- `src/JsonUtils.ts:67` `jsonStringifyCompact` (const) - 1 example import violation(s)
- `src/JsonUtils.ts:94` `jsonParse` (const) - 1 example import violation(s)
- `src/Root.ts:46` `findRepoRoot` (const) - 1 example import violation(s)
- `src/TSMorph/TSMorph.service.ts:397` `TSMorphService` (class) - 1 example import violation(s)
- `src/TSMorph/TSMorph.service.ts:728` `createTSMorphService` (const) - 1 example import violation(s)
- `src/TSMorph/TSMorph.service.ts:1439` `TSMorphServiceLive` (const) - 1 example import violation(s)
- `src/TsConfig.ts:51` `collectTsConfigPaths` (const) - 1 example import violation(s)
- `src/Workspaces.ts:120` `resolveWorkspaceDirs` (const) - 1 example import violation(s)
- `src/Workspaces.ts:227` `getWorkspaceDir` (const) - 1 example import violation(s)
- `src/Workspaces.ts:303` `resolveWorkspacePackages` (const) - 1 example import violation(s)
- `src/schemas/BiomeJson.ts:60` `renderBiomeJson` (const) - 1 example import violation(s)
- `src/schemas/DocgenConfig.ts:457` `createCanonicalDocgenConfig` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1768` `decodePackageJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1801` `encodePackageJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1831` `encodePackageJsonToJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1866` `encodePackageJsonPrettyEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1900` `readPackageJsonFile` (const) - 1 example import violation(s)
- `src/schemas/PackageJsonTools.ts:342` `normalizePackageJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJsonTools.ts:454` `getPackageJsonSchemaIssues` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:1959` `decodeTSConfigEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:1993` `decodeTSConfigFromJsoncTextEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:2022` `encodeTSConfigEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:2045` `encodeTSConfigToJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:2073` `encodeTSConfigPrettyEffect` (const) - 1 example import violation(s)

### @beep/phoenix

Path: `packages/drivers/phoenix`

Export findings:
- `src/Phoenix.config.ts:78` `PhoenixConfigInput` (class) - 1 example import violation(s)
- `src/Phoenix.service.ts:666` `Phoenix` (class) - 1 example import violation(s)

### @beep/duckdb

Path: `packages/drivers/duckdb`

Export findings:
- `src/DuckDb.errors.ts:173` `DuckDbError` (class) - 1 example import violation(s)
- `src/DuckDb.service.ts:85` `DuckDbClient` (interface) - 1 example import violation(s)
- `src/DuckDb.service.ts:179` `DuckDbShape` (interface) - 1 example import violation(s)
- `src/DuckDb.service.ts:494` `DuckDb` (class) - 1 example import violation(s)

### @beep/ffmpeg

Path: `packages/drivers/ffmpeg`

Export findings:
- `src/FFmpeg.service.ts:153` `FFmpegEventSink` (type) - 1 example import violation(s)
- `src/FFmpeg.service.ts:181` `FFmpegShape` (interface) - 1 example import violation(s)

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
- `src/Backend/Composition.ts:127` `withFallback` (const) - 1 example import violation(s)
- `src/Backend/Composition.ts:221` `CachingOptions` (class) - 1 example import violation(s)
- `src/Backend/Composition.ts:289` `withCaching` (const) - 1 example import violation(s)
- `src/Backend/Composition.ts:401` `selectByCapability` (const) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:334` `NLPBackendShape` (interface) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:410` `supportsCapability` (const) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:455` `getSupportedCapabilities` (const) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:486` `notSupported` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:103` `tokenize` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:141` `sentences` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:182` `tokenizeToDocument` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:223` `tokenCount` (const) - 1 example import violation(s)
- `src/Graph/AnnotatedTextGraph.ts:401` `fromDocumentAnnotated` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:97` `generateNodeId` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:183` `GraphNode` (interface) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:261` `makeNode` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:328` `singleton` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:372` `addNode` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:434` `getNode` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:463` `getChildren` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:492` `getRoots` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:547` `cata` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:598` `GraphCoalgebra` (type) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:620` `ana` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:664` `map` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:718` `toArray` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:758` `show` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Executor.ts:515` `GraphExecutorLive` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Executor.ts:548` `GraphExecutorTest` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Operation.ts:59` `GraphOperation` (interface) - 1 example import violation(s)
- `src/Graph/GraphOperations/Operation.ts:103` `make` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:364` `ResultStoreLive` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:390` `ResultStoreTest` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:268` `ConstantOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:308` `LinearOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:348` `LinearithmicOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:388` `QuadraticOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:433` `OperationCost` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:497` `OperationCost` (type) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:731` `generateExecutionId` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:795` `makeOperationResult` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:143` `singleton` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:213` `fromDocument` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:284` `addChildren` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:390` `tokenizeNodes` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:496` `mapNodes` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:517` `filterNodes` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:552` `dfs` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:577` `bfs` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:602` `topo` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:619` `toArray` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:674` `findNodesByType` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:698` `getRoots` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:716` `getLeaves` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:742` `getChildren` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:826` `show` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:60` `TextOperation` (interface) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:81` `makeOperation` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:265` `foldableGraph` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:303` `executeOperation` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:347` `executeOperations` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:411` `ForgetfulOperation` (interface) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:537` `collectData` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:555` `depth` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:677` `flatMap` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:927` `traverse` (const) - 1 example import violation(s)
- `src/NLPService.ts:52` `NLPServiceShape` (interface) - 1 example import violation(s)
- `src/NLPService.ts:124` `make` (const) - 1 example import violation(s)
- `src/NLPService.ts:179` `layer` (const) - 1 example import violation(s)
- `src/NLPService.ts:233` `processText` (const) - 1 example import violation(s)
- `src/NLPService.ts:284` `extractEntities` (const) - 1 example import violation(s)
- `src/NLPService.ts:335` `extractRelations` (const) - 1 example import violation(s)
- `src/NLPService.ts:388` `tagPartsOfSpeech` (const) - 1 example import violation(s)
- `src/Tools/ToolExport.ts:115` `ExportedToolError` (class) - 1 example import violation(s)
- `src/Tools/ToolExport.ts:199` `ExportedTool` (interface) - 1 example import violation(s)
- `src/Tools/ToolExport.ts:426` `exportTools` (const) - 1 example import violation(s)
- `src/Tools/index.ts:1038` `exportTools` (const) - 1 example import violation(s)

### @beep/openai-compat

Path: `packages/drivers/openai-compat`

Export findings:
- `src/OpenAiCompat.models.ts:1209` `decodeChatCompletionResponse` (const) - 1 example import violation(s)
- `src/OpenAiCompat.models.ts:1233` `decodeChatCompletionChunk` (const) - 1 example import violation(s)
- `src/OpenAiCompatClient.service.ts:54` `OpenAiCompatClientOptions` (class) - 1 example import violation(s)
- `src/OpenAiCompatClient.service.ts:94` `OpenAiCompatClientShape` (interface) - 1 example import violation(s)
- `src/OpenAiCompatClient.service.ts:375` `OpenAiCompatClient` (class) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:154` `OpenAiCompatProvider` (type) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:182` `OpenAiCompatLanguageModelOptions` (type) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:972` `makeFromProvider` (const) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:1024` `layerFromProvider` (const) - 1 example import violation(s)

### @beep/epistemic-client

Path: `packages/epistemic/client`

Export findings:
- `src/Protocol.ts:99` `HttpEpistemicProtocolLive` (const) - 1 example import violation(s)

### @beep/ui

Path: `packages/foundation/ui-system/ui`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/components/effect-date-time-picker.tsx:712` `EffectDateTimeLocalizationProvider` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:744` `EffectDatePicker` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:791` `EffectDateTimePicker` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:831` `EffectTimePicker` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:362` `AdapterEffectDateTime` (class) - 1 example import violation(s)
- `src/hooks/useNumberInput.ts:534` `getStepFactor` (const) - 1 example import violation(s)
- `src/index.ts:29` `export { VERSION } from "./Version.ts";` (re-export) - 1 example import violation(s)

### @beep/dock

Path: `packages/foundation/ui-system/dock`

Export findings:
- `src/AnchoredBox.ts:27` `TopLeft` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:48` `TopRight` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:69` `BottomLeft` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:90` `BottomRight` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:111` `AnchoredSize` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:131` `TopLeftAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:155` `TopRightAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:179` `BottomRightAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:203` `BottomLeftAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:233` `AnchoredBox` (const) - 1 example import violation(s)
- `src/AnchoredBox.ts:262` `AnchoredBox` (type) - 1 example import violation(s)
- `src/AnchoredBox.ts:284` `AnchoredBox` (namespace) - 1 example import violation(s)
- `src/Dock.atoms.ts:50` `DockAtomObservabilityLive` (const) - 2 example import violation(s)
- `src/Dock.atoms.ts:208` `makeDockAtomsWith` (const) - 2 example import violation(s)
- `src/Dock.atoms.ts:242` `makeDockAtoms` (const) - 2 example import violation(s)
- `src/Dock.commands.ts:33` `UserCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:58` `ApiCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:85` `CommandOrigin` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:109` `CommandOrigin` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:126` `OpenPanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:152` `ActivatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:178` `UpdatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:198` `MovePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:224` `MoveGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:245` `UpdateGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:265` `ClosePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:290` `ResizeSplitCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:316` `ClearWorkspaceCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:340` `MaximizeGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:360` `RestoreMaximizedCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:380` `FloatGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:399` `DockFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:418` `MoveFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:455` `DockCommand` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:494` `DockCommand` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:511` `DockCommandEnvelope` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:537` `AllowedRenderers` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:560` `AllowedRenderers` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:577` `RestoreSnapshotRequest` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:29` `DockRejectionReason` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:64` `DockRejectionReason` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:81` `DockCommandRejected` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:108` `DockInvariantReason` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:135` `DockInvariantReason` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:152` `DockInvariantViolation` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:178` `DockInputBoundary` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:198` `DockInputBoundary` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:215` `DockInputError` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:241` `DockPersistenceOperation` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:261` `DockPersistenceOperation` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:278` `DockPersistenceError` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:304` `DockSnapshotMissing` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:329` `DockTransitionError` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:351` `DockTransitionError` (type) - 1 example import violation(s)
- `src/Dock.events.ts:31` `PanelOpenedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:57` `PanelActivatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:83` `PanelTitleChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:103` `PanelViewChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:123` `PanelRenderModeChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:144` `PanelTabComponentChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:173` `PanelConstraintsChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:202` `PanelMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:230` `PanelReorderedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:250` `GroupMergedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:272` `GroupMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:292` `GroupUpdatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:312` `PanelClosedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:338` `SplitResizedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:364` `WorkspaceClearedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:389` `WorkspaceRestoredEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:415` `GroupMaximizedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:435` `GroupRestoredEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:454` `GroupFloatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:473` `GroupDockedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:492` `FloatingGroupMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:536` `DockEvent` (const) - 1 example import violation(s)
- `src/Dock.events.ts:582` `DockEvent` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:30` `PanelId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:51` `PanelId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:69` `GroupId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:90` `GroupId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:108` `SplitId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:129` `SplitId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:147` `CommandId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:168` `CommandId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:186` `RendererKey` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:207` `RendererKey` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:225` `SplitRatio` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:254` `SplitRatio` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:46` `PanelRenderMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:66` `PanelRenderMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:83` `PanelParameterValue` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:103` `PanelParameterValue` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:120` `PanelParameters` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:140` `PanelParameters` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:157` `ComponentPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:183` `TextPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:208` `PanelView` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:230` `PanelView` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:259` `PanelConstraints` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:286` `Panel` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:337` `PanelPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:369` `GroupLockedMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:387` `GroupLockedMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:404` `GroupHeaderPosition` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:422` `GroupHeaderPosition` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:439` `GroupMetadata` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:469` `GroupPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:506` `TabsNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:672` `HorizontalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:701` `VerticalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:732` `SplitLayout` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:799` `SplitLayout` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:818` `SplitNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:912` `DockNode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1057` `DockNode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1100` `DockNode` (namespace) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1170` `FloatingMember` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1190` `EmptyWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1218` `PopulatedWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1299` `DockWorkspace` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1517` `DockWorkspace` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1534` `DockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:32` `DockUnchangedReason` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:63` `DockUnchangedReason` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:81` `DockChanged` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:109` `DockUnchanged` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:136` `DockMutationResult` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:158` `DockMutationResult` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:176` `DockMutationOutcome` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:30` `RootPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:55` `TabPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:82` `DockSide` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:102` `DockSide` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:119` `SplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:153` `RootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:181` `GroupSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:209` `GroupRootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:238` `DockPlacement` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:262` `DockPlacement` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:279` `DockMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:300` `DockMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:317` `DockGroupMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:338` `DockGroupMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:38` `DispatchDockCommand` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:63` `DispatchUnknownDockCommand` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:88` `SaveDockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:112` `RestoreDockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:137` `DockAtomOperationKind` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:162` `DockAtomOperationKind` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:179` `DockAtomOperation` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:208` `DockAtomOperation` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:226` `DockMutationCompleted` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:251` `DockSnapshotSaved` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:278` `DockAtomOperationOutcome` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:302` `DockAtomOperationOutcome` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:319` `DockAtomSessionError` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:346` `DockAtomSessionError` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:364` `DockAtomFeedSuccess` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:392` `DockAtomFeedFailure` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:420` `DockAtomFeedEntry` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:442` `DockAtomFeedEntry` (type) - 1 example import violation(s)
- `src/DockEngine.service.ts:91` `DockEngineShape` (interface) - 3 example import violation(s)
- `src/DockEngine.service.ts:133` `DockEngine` (class) - 2 example import violation(s)
- `src/DockEngine.service.ts:169` `DockEngineLive` (const) - 2 example import violation(s)
- `src/DockEngine.service.ts:192` `DockSnapshotStoreShape` (interface) - 2 example import violation(s)
- `src/DockEngine.service.ts:217` `DockSnapshotStore` (class) - 2 example import violation(s)
- `src/DockEngine.service.ts:243` `makeDockSnapshotStoreMemory` (const) - 3 example import violation(s)
- `src/DockEngine.service.ts:274` `requireSnapshot` (const) - 2 example import violation(s)
- `src/DockPolicy.ts:46` `DockCommandPolicy` (type) - 3 example import violation(s)
- `src/DockPolicy.ts:125` `lockedGroupsPolicy` (const) - 2 example import violation(s)
- `src/DockPolicy.ts:206` `makePolicyDockEngineLayer` (const) - 2 example import violation(s)
- `src/Geometry.models.ts:39` `Extent` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:63` `DockBox` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:88` `GroupGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:108` `SashGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:128` `FloatingGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:148` `DockGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:188` `resolveAnchoredBox` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:231` `GeometryOptions` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:265` `GroupMinimumLookup` (type) - 2 example import violation(s)
- `src/Geometry.models.ts:282` `GroupMinimaRecord` (type) - 1 example import violation(s)
- `src/Minima.ts:62` `TabChrome` (class) - 1 example import violation(s)
- `src/Minima.ts:87` `titleWords` (const) - 1 example import violation(s)
- `src/Minima.ts:139` `titleMinima` (const) - 1 example import violation(s)
- `src/Minima.ts:198` `makeTitleMinimaAtom` (const) - 2 example import violation(s)
- `src/Recency.ts:41` `touchedGroupsInEvents` (const) - 1 example import violation(s)
- `src/Recency.ts:81` `touchedGroups` (const) - 1 example import violation(s)
- `src/Recency.ts:130` `makeMruGroupsAtom` (const) - 1 example import violation(s)

### @beep/law-practice-tables

Path: `packages/law-practice/tables`

Module findings:
- `src/Tables.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/ActFrame/ActFrame.converters.ts:80` `toActFrameInsert` (const) - 1 example import violation(s)
- `src/entities/ActFrame/ActFrame.converters.ts:115` `fromActFrameRow` (const) - 1 example import violation(s)
- `src/entities/CandorDisposition/CandorDisposition.converters.ts:79` `toCandorDispositionInsert` (const) - 1 example import violation(s)
- `src/entities/CandorDisposition/CandorDisposition.converters.ts:108` `fromCandorDispositionRow` (const) - 1 example import violation(s)
- `src/entities/CorrectionDelta/CorrectionDelta.converters.ts:79` `toCorrectionDeltaInsert` (const) - 1 example import violation(s)
- `src/entities/CorrectionDelta/CorrectionDelta.converters.ts:112` `fromCorrectionDeltaRow` (const) - 1 example import violation(s)
- `src/entities/IdsSubmissionFact/IdsSubmissionFact.converters.ts:79` `toIdsSubmissionFactInsert` (const) - 1 example import violation(s)
- `src/entities/IdsSubmissionFact/IdsSubmissionFact.converters.ts:108` `fromIdsSubmissionFactRow` (const) - 1 example import violation(s)
- `src/entities/LegalOppositionCandidate/LegalOppositionCandidate.converters.ts:80` `toLegalOppositionCandidateInsert` (const) - 1 example import violation(s)
- `src/entities/LegalOppositionCandidate/LegalOppositionCandidate.converters.ts:116` `fromLegalOppositionCandidateRow` (const) - 1 example import violation(s)
- `src/entities/LegalPositionRelator/LegalPositionRelator.converters.ts:80` `toLegalPositionRelatorInsert` (const) - 1 example import violation(s)
- `src/entities/LegalPositionRelator/LegalPositionRelator.converters.ts:117` `fromLegalPositionRelatorRow` (const) - 1 example import violation(s)
- `src/entities/PatentCitationEvent/PatentCitationEvent.converters.ts:74` `toPatentCitationEventInsert` (const) - 1 example import violation(s)
- `src/entities/PatentCitationEvent/PatentCitationEvent.converters.ts:103` `fromPatentCitationEventRow` (const) - 1 example import violation(s)
- `src/entities/PowerExercise/PowerExercise.converters.ts:80` `toPowerExerciseInsert` (const) - 1 example import violation(s)
- `src/entities/PowerExercise/PowerExercise.converters.ts:115` `fromPowerExerciseRow` (const) - 1 example import violation(s)

### @beep/law-practice-use-cases

Path: `packages/law-practice/use-cases`

Module findings:
- `src/IrToLaw/IrToLaw.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/IrToLaw/IrToLaw.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OfficeActionReview/OfficeActionReview.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PracticeKg.tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CandorPolicy/CandorPolicy.ports.ts:102` `CandorRecordReaderShape` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.ports.ts:162` `CandorRecordReader` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.ports.ts:211` `CandorPolicyShape` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.ports.ts:276` `CandorPolicy` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.service.ts:320` `CandorPolicyLive` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.ports.ts:200` `CandorRecordRepositoryShape` (class) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.ports.ts:301` `CandorRecordRepository` (class) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.reader.ts:64` `CandorRecordReaderFromRepository` (const) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.errors.ts:92` `IrToLawExtractionError` (class) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.ports.ts:152` `IrToLawShape` (class) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.ports.ts:192` `IrToLaw` (class) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.service.ts:176` `makeIrToLaw` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.ports.ts:217` `LegalPositionRecordRepositoryShape` (class) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.ports.ts:335` `LegalPositionRecordRepository` (class) - 1 example import violation(s)
- `src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.ports.ts:147` `LegalPositionRelatorPolicy` (class) - 1 example import violation(s)
- `src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts:221` `LegalPositionRelatorPolicyLive` (const) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:71` `OfficeActionReviewInput` (class) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:216` `OfficeActionReviewShape` (interface) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:256` `OfficeActionReview` (class) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.service.ts:243` `makeOfficeActionReview` (const) - 1 example import violation(s)
- `src/PracticeKg.tools.ts:198` `PracticeKgToolResult` (class) - 1 example import violation(s)

### @beep/tika

Path: `packages/drivers/tika`

Module findings:
- `src/Tika.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Tika.error-translation.ts:158` `tikaOperationError` (const) - 1 example import violation(s)
- `src/Tika.response.ts:99` `decodeTikaResponseRecord` (const) - 1 example import violation(s)
- `src/Tika.response.ts:152` `readTikaContentText` (const) - 1 example import violation(s)
- `src/Tika.server.ts:166` `makeTikaServerFileProcessingEngine` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Tika.server.ts:312` `makeTikaServerFileProcessingEngineFromEnv` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Tika.tikaapp.ts:96` `makeTikaAppFileProcessingEngine` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/libpff

Path: `packages/drivers/libpff`

Module findings:
- `src/Libpff.eml.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Libpff.eml.ts:179` `rfc5322DateFromOutlookTimestamp` (const) - 1 example import violation(s)
- `src/Libpff.eml.ts:439` `assembleEml` (const) - 1 example import violation(s)
- `src/Libpff.error-translation.ts:177` `libpffOperationError` (const) - 1 example import violation(s)
- `src/Libpff.errors.ts:173` `makeLibpffError` (const) - 1 example import violation(s)
- `src/Libpff.messages.ts:85` `PffexportMessageRecord` (class) - 1 example import violation(s)
- `src/Libpff.messages.ts:132` `encodePffexportMessageRecordJson` (const) - 1 example import violation(s)
- `src/Libpff.pffexport.ts:558` `makePffexportFileProcessingEngine` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

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
- `src/ClaimDisposition/ClaimDisposition.repo.ts:80` `makeInMemoryClaimDispositionRepository` (const) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.repo.ts:119` `makeDrizzleClaimDispositionRepository` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.layer.ts:388` `ContradictionTriageRepositoryDrizzle` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.layer.ts:408` `ContradictionTriageServiceLive` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.layer.ts:428` `ContradictionTriageRepositoryFixture` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.repo.ts:440` `makeDrizzleContradictionTriageRepository` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc-handlers.ts:27` `ContradictionHandlersLive` (const) - 1 example import violation(s)
- `src/EdgeAuthority/EdgeAuthority.repo.ts:414` `makeDrizzleEdgeAuthorityRepository` (const) - 1 example import violation(s)
- `src/ExecutionLedger/ExecutionLedger.repo.ts:85` `makeDrizzleExecutionLedger` (const) - 1 example import violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:118` `GovernedEgressOptions` (class) - 1 example import violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:211` `makeGovernedEgressFetch` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:64` `GovernedEgressLiveOptions` (interface) - 1 example import violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:99` `GovernedEgressLive` (const) - 1 example import violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:123` `GovernedTierGateOptions` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:180` `refusalGuidance` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:237` `makeGovernedTierGate` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.layer.ts:52` `GovernedTierGateLive` (const) - 1 example import violation(s)
- `src/ShaclValidation/BoundedShaclValidator.layer.ts:263` `BoundedShaclValidationServiceLive` (const) - 1 example import violation(s)

### @beep/ai-provider-cli

Path: `packages/drivers/ai-provider-cli`

Module findings:
- `src/AiProviderCliHome.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AiProviderCli.service.ts:70` `AiProviderCliRunner` (type) - 1 example import violation(s)
- `src/AiProviderCli.service.ts:322` `AiProviderCli` (class) - 1 example import violation(s)
- `src/AiProviderCliHome.service.ts:456` `AiProviderCliHome` (class) - 1 example import violation(s)
- `src/index.ts:89` `export * from "./AiProviderCli.service.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:151` `export * from "./AiProviderCliHome.service.ts";` (re-export) - 1 example import violation(s)

### @beep/anthropic

Path: `packages/drivers/anthropic`

Export findings:
- `src/Anthropic.repair.ts:193` `collectToolParamsJson` (const) - 1 example import violation(s)
- `src/Anthropic.repair.ts:273` `collectToolParamsJsonWithUsage` (const) - 1 example import violation(s)
- `src/Anthropic.repair.ts:339` `generateAnthropicToolJson` (const) - 1 example import violation(s)
- `src/Anthropic.service.ts:44` `AnthropicLive` (const) - 1 example import violation(s)
- `src/Anthropic.service.ts:115` `AnthropicLanguageModelLive` (const) - 1 example import violation(s)

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Module findings:
- `src/Lexical.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.codec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Lexical.behavior.ts:38` `nodeToPlainText` (const) - 1 example import violation(s)
- `src/Lexical.behavior.ts:83` `editorStateToPlainText` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:95` `ArtifactUri` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:399` `blockToLexical` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:504` `documentToEditorState` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:667` `nodeToBlocks` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:714` `editorStateToDocument` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:100` `LexicalNodeVersion` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:237` `TextFormatMask` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:273` `hasTextFormat` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:295` `withTextFormat` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:405` `TextDetailMask` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:441` `LexicalIndentDepth` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:519` `TableCellSpan` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:560` `TableDimension` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:881` `SafeInlineStyle` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:937` `SafeStyleValue` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:992` `SafeUrl` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:1074` `BaseNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1130` `ElementNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1189` `ElementNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1272` `TextBase` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1321` `TextNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:1347` `TextNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1390` `TabNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:1421` `TabNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1466` `LineBreakNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:1491` `LineBreakNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1552` `RootNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1613` `ParagraphNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1676` `HeadingNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1748` `QuoteNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1846` `ListNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1990` `ListItemNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2069` `LinkNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2149` `CodeNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2196` `ArtifactRefNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:2229` `ArtifactRefNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2277` `YouTubeNode` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Lexical.model.ts:2310` `YouTubeNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2416` `TableCellNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2502` `TableRowNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2585` `TableNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2662` `LexicalNode` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:2714` `LexicalNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2803` `SerializedEditorState` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:2876` `SerializedEditorState` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2926` `LexicalNodeWire` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3016` `SerializedEditorStateWire` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3070` `EditorStateWireFromJson` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3094` `LexicalDecodeError` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:3154` `LexicalCompatibilityResult` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:3232` `decodeEditorStateStrictResult` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3267` `decodeEditorStateStrict` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3288` `decodeEditorStateLossless` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3315` `analyzeEditorStateCompatibilityResult` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3351` `analyzeEditorStateCompatibility` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3376` `EditorStateFromJson` (const) - 1 example import violation(s)
- `src/index.ts:26` `export { editorStateToPlainText, nodeToPlainText } from "./Lexical.behavior.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:41` `export {
  ARTIFACT_URI_PREFIX,
  ArtifactUri,
  blockToLexical,
  documentToEditorState,
  editorStateToDocument,
  nodeToBlocks,
} from "./Lexical.codec.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export {
  ArtifactRefId,
  ArtifactRefNode,
  analyzeEditorStateCompatibility,
  BaseNode,
  CodeNode,
  Direction,
  decodeEditorStateLossless,
  decodeEditorStateStrict,
  EditorStateFromJson,
  EditorStateWireFromJson,
  ElementFormat,
  ElementNode,
  HeadingNode,
  HeadingTag,
  hasTextFormat,
  LexicalCompatibilityIssue,
  LexicalCompatibilityResult,
  LexicalDecodeError,
  LexicalIndentDepth,
  LexicalNode,
  LexicalNodeVersion,
  LexicalNodeWire,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ListNodeValue,
  ListTag,
  ListType,
  ParagraphNode,
  QuoteNode,
  RootNode,
  SafeInlineStyle,
  SafeStyleValue,
  SafeUrl,
  SerializedEditorState,
  SerializedEditorStateWire,
  TableCellHeaderState,
  TableCellNode,
  TableCellSpan,
  TableDimension,
  TableNode,
  TableRowNode,
  TabNode,
  TEXT_DETAIL_MASK_ALL,
  TEXT_FORMAT_MASK_ALL,
  TextBase,
  TextDetailBit,
  TextDetailBits,
  TextDetailMask,
  TextFormatBit,
  TextFormatBits,
  TextFormatMask,
  TextMode,
  TextNode,
  withTextFormat,
  YouTubeNode,
} from "./Lexical.model.ts";` (re-export) - 2 example import violation(s)

### @beep/ontology-config

Path: `packages/ontology/config`

Module findings:
- `src/McpConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/McpConfig.ts:47` `OntologyMcpMutationsEnabledConfig` (const) - 1 example import violation(s)
- `src/McpConfig.ts:117` `OntologyMcpConfig` (class) - 1 example import violation(s)
- `src/ServerConfig.ts:37` `OntologyWorkspaceRootConfig` (const) - 1 example import violation(s)
- `src/ServerConfig.ts:105` `OntologyConfig` (class) - 1 example import violation(s)
- `src/TestLayer.ts:53` `makeOntologyMcpConfigTest` (const) - 1 example import violation(s)
- `src/layer.ts:55` `OntologyConfigLive` (const) - 1 example import violation(s)
- `src/layer.ts:87` `OntologyMcpConfigLive` (const) - 1 example import violation(s)

### @beep/n3

Path: `packages/drivers/n3`

Export findings:
- `src/N3.service.ts:344` `N3TurtleCodec` (class) - 1 example import violation(s)

### @beep/box

Path: `packages/drivers/box`

Export findings:
- `src/Box.config.ts:47` `BoxDeveloperTokenConfig` (class) - 1 example import violation(s)
- `src/Box.config.ts:82` `BoxCcgConfig` (class) - 1 example import violation(s)
- `src/Box.config.ts:115` `BoxConfig` (class) - 1 example import violation(s)
- `src/Box.config.ts:143` `BoxConfigLayer` (const) - 1 example import violation(s)
- `src/Box.config.ts:183` `layer` (const) - 1 example import violation(s)
- `src/Box.config.ts:207` `layerConfig` (const) - 1 example import violation(s)
- `src/Box.service.ts:118` `Box` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:85` `BoxByteInput` (type) - 1 example import violation(s)
- `src/Box.streaming.ts:103` `BoxByteStream` (type) - 1 example import violation(s)
- `src/Box.streaming.ts:434` `BoxUploadFilePartByUrlPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:594` `BoxGetZipDownloadContentPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:1009` `makeStreamingOperations` (const) - 1 example import violation(s)

### @beep/documents-use-cases

Path: `packages/documents/use-cases`

Export findings:
- `src/aggregates/Document/DocumentIntake.ts:138` `DocumentIntakeShape` (interface) - 1 example import violation(s)
- `src/aggregates/Document/DocumentIntake.ts:164` `DocumentIntake` (class) - 1 example import violation(s)
- `src/aggregates/Document/FilingDecision.ts:135` `FilingDecisionShape` (interface) - 1 example import violation(s)
- `src/aggregates/Document/FilingDecision.ts:166` `FilingDecision` (class) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:440` `DmsMirrorShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:485` `DmsMirror` (class) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:633` `DmsMirrorAvailabilityShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:664` `DmsMirrorAvailability` (class) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:369` `VaultSyncEngineShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:424` `VaultSyncEngine` (class) - 1 example import violation(s)
- `src/entities/SyncConflict/SyncConflict.repository.ts:250` `SyncConflictRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncConflict/SyncConflict.repository.ts:294` `SyncConflictRepository` (class) - 1 example import violation(s)
- `src/entities/SyncCursor/SyncCursor.repository.ts:169` `SyncCursorRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncCursor/SyncCursor.repository.ts:206` `SyncCursorRepository` (class) - 1 example import violation(s)
- `src/entities/SyncItem/SyncItem.repository.ts:359` `SyncItemRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncItem/SyncItem.repository.ts:408` `SyncItemRepository` (class) - 1 example import violation(s)
- `src/entities/SyncOperation/SyncOperation.repository.ts:394` `SyncOperationRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncOperation/SyncOperation.repository.ts:452` `SyncOperationRepository` (class) - 1 example import violation(s)

### @beep/architecture-lab-config

Path: `packages/architecture-lab/config`

Export findings:
- `src/aggregates/WorkItem/WorkItem.layer.ts:110` `WorkItemConfig` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:190` `ArchitectureLabConfigLive` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:217` `ArchitectureLabConfigTest` (const) - 1 example import violation(s)

### @beep/architecture-lab-use-cases

Path: `packages/architecture-lab/use-cases`

Export findings:
- `src/aggregates/WorkItem/WorkItem.repository.ts:223` `WorkItemRepositoryShape` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repository.ts:267` `WorkItemRepository` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.service.ts:162` `makeWorkItemUseCases` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.use-cases.ts:56` `WorkItemUseCasesShape` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.use-cases.ts:108` `WorkItemUseCases` (class) - 1 example import violation(s)
- `src/entities/Worker/Worker.repository.ts:227` `WorkerRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/Worker/Worker.repository.ts:267` `WorkerRepository` (class) - 1 example import violation(s)
- `src/entities/Worker/Worker.service.ts:125` `makeWorkerUseCases` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.use-cases.ts:44` `WorkerUseCasesShape` (interface) - 1 example import violation(s)
- `src/entities/Worker/Worker.use-cases.ts:86` `WorkerUseCases` (class) - 1 example import violation(s)

### @beep/ecfr

Path: `packages/drivers/ecfr`

Module findings:
- `src/Ecfr.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/_generated/Ecfr.gen.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Ecfr.service.ts:286` `EcfrShape` (interface) - 1 example import violation(s)
- `src/Ecfr.service.ts:528` `Ecfr` (class) - 1 example import violation(s)

### @beep/govinfo

Path: `packages/drivers/govinfo`

Module findings:
- `src/Govinfo.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/domain/contracts/Api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Govinfo.config.ts:130` `GovinfoConfigInput` (class) - 1 example import violation(s)
- `src/Govinfo.service.ts:64` `GovinfoShape` (interface) - 2 example import violation(s)
- `src/Govinfo.service.ts:165` `Govinfo` (class) - 1 example import violation(s)

### @beep/face-detection

Path: `packages/drivers/face-detection`

Export findings:
- `src/FaceDetection.models.ts:143` `RawFaceDetectionConfidence` (const) - 1 example import violation(s)
- `src/FaceDetection.models.ts:613` `decodeFaceDetectionModelConfig` (const) - 1 example import violation(s)
- `src/FaceDetection.models.ts:641` `decodeFaceDetectionImageRequest` (const) - 1 example import violation(s)
- `src/FaceDetection.service.ts:209` `LoadedFaceDetector` (interface) - 1 example import violation(s)
- `src/FaceDetection.service.ts:257` `FaceDetectionServiceShape` (interface) - 1 example import violation(s)
- `src/FaceDetection.service.ts:316` `FaceDetectionService` (class) - 1 example import violation(s)
- `src/FaceDetection.service.ts:960` `withDetector` (const) - 1 example import violation(s)

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/CLI.ts:224` `cli` (const) - 1 example import violation(s)
- `src/Checker.ts:318` `checkModule` (function) - 1 example import violation(s)
- `src/Configuration.ts:305` `Configuration` (class) - 1 example import violation(s)
- `src/Configuration.ts:546` `load` (const) - 1 example import violation(s)
- `src/Configuration.ts:635` `configProviderLayer` (const) - 1 example import violation(s)
- `src/Core.ts:842` `program` (const) - 1 example import violation(s)
- `src/Domain.ts:1201` `Process` (class) - 1 example import violation(s)
- `src/Parser.ts:234` `parseInterfaces` (const) - 1 example import violation(s)
- `src/Parser.ts:356` `parseFunctions` (const) - 1 example import violation(s)
- `src/Parser.ts:407` `parseTypeAliases` (const) - 1 example import violation(s)
- `src/Parser.ts:452` `parseConstants` (const) - 1 example import violation(s)
- `src/Parser.ts:554` `parseExports` (const) - 1 example import violation(s)
- `src/Parser.ts:616` `parseNamespaces` (const) - 1 example import violation(s)
- `src/Parser.ts:802` `parseClasses` (const) - 1 example import violation(s)
- `src/Parser.ts:860` `parseModule` (const) - 1 example import violation(s)
- `src/Printer.ts:421` `print` (const) - 1 example import violation(s)
- `src/Printer.ts:521` `printModule` (const) - 1 example import violation(s)
- `src/ProofManifest.ts:156` `DocgenProofManifestFile` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:192` `DocgenProofManifestFingerprint` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:257` `DocgenProofManifest` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:475` `writeDocgenProofManifest` (const) - 1 example import violation(s)
- `src/ProofManifest.ts:548` `verifyDocgenProofManifest` (const) - 1 example import violation(s)
- `src/Version.ts:44` `readModuleVersion` (const) - 1 example import violation(s)

### @beep/skill-contract

Path: `packages/foundation/modeling/skill-contract`

Export findings:
- `src/EvidenceLadder.ts:34` `EvidenceReceiptReference` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:59` `EvidenceLadderReceiptTypes` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:85` `Accepted` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:111` `Persisted` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:138` `Delivered` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:166` `SemanticallyApplied` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:195` `EvidenceLadderState` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:254` `evidenceLadderFor` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:289` `transportCompleted` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:309` `advanceToPersisted` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:335` `advanceToDelivered` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:361` `advanceToSemanticallyApplied` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:42` `EvidenceDigest` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:74` `EvidenceSubject` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:131` `EvidenceReceipt` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:157` `AttestationResource` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:181` `GateSummaryVerifier` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:205` `GateVerificationResult` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:233` `GateVerifiedLevel` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:281` `GateResultSummary` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:358` `GateSummary` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:379` `GateSummaryPredicateType` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:397` `GateSummaryReceipt` (const) - 1 example import violation(s)
- `src/Gate.ts:39` `GateId` (const) - 1 example import violation(s)
- `src/Gate.ts:78` `makeGateId` (const) - 1 example import violation(s)
- `src/Gate.ts:101` `GateSeverity` (const) - 1 example import violation(s)
- `src/Gate.ts:129` `GateApplicabilityKind` (const) - 1 example import violation(s)
- `src/Gate.ts:157` `AlwaysGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:188` `ConditionalGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:220` `GateApplicability` (const) - 1 example import violation(s)
- `src/Gate.ts:252` `EvidencePredicateType` (const) - 1 example import violation(s)
- `src/Gate.ts:284` `GateEvidenceRequirement` (class) - 1 example import violation(s)
- `src/Gate.ts:324` `GateDeclaration` (class) - 1 example import violation(s)
- `src/Gate.ts:377` `GateRegistry` (class) - 1 example import violation(s)
- `src/Gate.ts:398` `GateOutcome` (const) - 1 example import violation(s)
- `src/Gate.ts:518` `GateAuditRecord` (const) - 1 example import violation(s)
- `src/Gate.ts:584` `GateVerdict` (const) - 1 example import violation(s)
- `src/Recovery.ts:62` `BudgetDuration` (const) - 1 example import violation(s)
- `src/Recovery.ts:90` `RecoveryBudget` (class) - 1 example import violation(s)
- `src/Recovery.ts:116` `RecoveryBudgetConsumed` (class) - 1 example import violation(s)
- `src/Recovery.ts:141` `RecoveryAttemptOutcome` (const) - 1 example import violation(s)
- `src/Recovery.ts:169` `RecoveryAttemptReceipt` (class) - 1 example import violation(s)
- `src/Recovery.ts:198` `FailureTerminalReason` (const) - 1 example import violation(s)
- `src/Recovery.ts:310` `FailureReceiptPredicate` (class) - 1 example import violation(s)
- `src/Recovery.ts:331` `FailurePredicateType` (const) - 1 example import violation(s)
- `src/Recovery.ts:349` `FailureReceipt` (const) - 1 example import violation(s)
- `src/Recovery.ts:373` `NoRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:396` `BoundedRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:427` `RecoveryPolicy` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:27` `SchemaReferenceId` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:64` `SchemaReference` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:59` `SkillCompletionReceipt` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:115` `SkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:142` `toSkillCompletionReceipt` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:165` `EvaluateSkillCompletionInput` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:193` `CompletionInvariantReason` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:232` `CompletionInvariantError` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:258` `CompletionAllowed` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:284` `CompletionDenied` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:310` `CompletionEvaluation` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:393` `evaluateSkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:460` `LiveVerified` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:486` `DeployableBlocked` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:514` `FailedWithPartialEffects` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:541` `SkillTerminal` (const) - 1 example import violation(s)
- `src/SkillContract.ts:33` `SkillContractId` (const) - 1 example import violation(s)
- `src/SkillContract.ts:62` `ReceiptTypeBindings` (class) - 1 example import violation(s)
- `src/SkillContract.ts:94` `SkillContract` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:63` `SkillMarkdownProjection` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:89` `SkillArtifactDenialReason` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:127` `SkillArtifactCheck` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:178` `SkillArtifactAllowed` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:204` `SkillArtifactDenied` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:231` `SkillArtifactVerdict` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:262` `VerifySkillArtifactInput` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:368` `projectSkillDocument` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:400` `renderSkillMarkdown` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:442` `decodeSkillFrontmatter` (const) - 2 example import violation(s)
- `src/SkillProjection.ts:551` `verifySkillArtifact` (const) - 1 example import violation(s)

### @beep/uspto

Path: `packages/drivers/uspto`

Export findings:
- `src/Uspto.config.ts:72` `UsptoConfigInput` (class) - 1 example import violation(s)
- `src/Uspto.errors.ts:152` `makeUsptoError` (const) - 1 example import violation(s)
- `src/Uspto.service.ts:52` `UsptoShape` (interface) - 1 example import violation(s)

### @beep/exiftool

Path: `packages/drivers/exiftool`

Module findings:
- `src/ExiftoolConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Exiftool.service.ts:64` `ExiftoolShape` (interface) - 1 example import violation(s)

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Export findings:
- `src/agent-effectiveness.ts:2988` `makeAgentEffectivenessDoctorReport` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:3355` `makeAgentEffectivenessAnnotationPlan` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:3594` `makeAgentEffectivenessDatasetBundle` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:3965` `syncAgentEffectivenessPhoenix` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4327` `makeAgentEffectivenessAnnotationCheckReport` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4384` `agentEffectivenessDoctorReportToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4436` `agentEffectivenessAnnotationPlanToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4479` `agentEffectivenessAnnotationCheckReportToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4522` `agentEffectivenessDatasetBundleToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4559` `agentEffectivenessPromptBundleToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4603` `agentEffectivenessExperimentBundleToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4652` `agentEffectivenessPhoenixSyncResultToJson` (const) - 1 example import violation(s)
- `src/archive.ts:325` `AiMetricsRawArchiveKey` (const) - 1 example import violation(s)
- `src/archive.ts:347` `AiMetricsRawArchiveKey` (type) - 1 example import violation(s)
- `src/archive.ts:474` `writeEncryptedRawArchiveObject` (const) - 1 example import violation(s)
- `src/archive.ts:591` `decryptEncryptedRawArchiveEnvelope` (const) - 1 example import violation(s)
- `src/compose.ts:44` `renderAiMetricsLocalPhoenixCompose` (const) - 1 example import violation(s)
- `src/config-snapshot.ts:949` `makeAiMetricsConfigSnapshot` (const) - 1 example import violation(s)
- `src/config-snapshot.ts:1121` `writeAiMetricsConfigSnapshotArtifacts` (const) - 1 example import violation(s)
- `src/config-snapshot.ts:1221` `configSnapshotToJson` (const) - 1 example import violation(s)
- `src/data-root.ts:493` `requireAbsoluteAiMetricsDataRoot` (const) - 1 example import violation(s)
- `src/derived-storage.ts:1022` `ensureAiMetricsDerivedStorage` (const) - 1 example import violation(s)
- `src/duckdb.ts:91` `withAiMetricsDuckDb` (const) - 1 example import violation(s)
- `src/forwarder.ts:134` `AiMetricsForwarderInput` (class) - 1 example import violation(s)
- `src/forwarder.ts:1017` `runAiMetricsForwarder` (const) - 1 example import violation(s)
- `src/forwarder.ts:1151` `forwarderRunResultToJson` (const) - 1 example import violation(s)
- `src/forwarder.ts:1197` `forwarderTimerPlanToJson` (const) - 1 example import violation(s)
- `src/hook-pulse.ts:661` `HookPulseRawEvent` (class) - 1 example import violation(s)
- `src/hook-pulse.ts:966` `hookPulseHashSalt` (const) - 1 example import violation(s)
- `src/hook-pulse.ts:1143` `HookPulseV1` (class) - 1 example import violation(s)
- `src/hook-pulse.ts:1438` `HookPulseV1FromRawEvent` (const) - 1 example import violation(s)
- `src/identity-registry.ts:538` `isNestedGitRoot` (const) - 1 example import violation(s)
- `src/identity-registry.ts:592` `makeAiMetricsCanonicalRoot` (const) - 1 example import violation(s)
- `src/identity-registry.ts:744` `readAiMetricsIdentityRegistry` (const) - 1 example import violation(s)
- `src/identity-registry.ts:814` `identityRegistryToJson` (const) - 1 example import violation(s)
- `src/identity-registry.ts:976` `upsertAiMetricsIdentityRegistry` (const) - 1 example import violation(s)
- `src/ingest.ts:190` `summarizeTranscriptText` (const) - 1 example import violation(s)
- `src/ingest.ts:250` `summaryToJson` (const) - 1 example import violation(s)
- `src/install.ts:1327` `makeAiMetricsInstallSpec` (const) - 1 example import violation(s)
- `src/install.ts:1392` `makeAiMetricsInstallPlan` (const) - 1 example import violation(s)
- `src/install.ts:1457` `makeAiMetricsInstallDoctorResult` (const) - 1 example import violation(s)
- `src/install.ts:1584` `makeAiMetricsInstallApplyDryRunResult` (const) - 1 example import violation(s)
- `src/install.ts:1630` `aiMetricsInstallPlanToJson` (const) - 1 example import violation(s)
- `src/install.ts:1671` `aiMetricsInstallDoctorToJson` (const) - 1 example import violation(s)
- `src/install.ts:1708` `aiMetricsInstallApplyDryRunToJson` (const) - 1 example import violation(s)
- `src/mirror.ts:361` `aiMetricsMirrorPayloadContainsJsonStringPrefix` (const) - 1 example import violation(s)
- `src/mirror.ts:802` `locateLatestAiMetricsMirrorBundle` (const) - 1 example import violation(s)
- `src/mirror.ts:938` `buildAiMetricsMirrorBundle` (const) - 1 example import violation(s)
- `src/mirror.ts:1128` `aiMetricsMirrorBundleToJson` (const) - 1 example import violation(s)
- `src/otlp.ts:653` `readAiMetricsOtlpSpanProjections` (const) - 1 example import violation(s)
- `src/otlp.ts:876` `AiMetricsOtlpSpanSenderShape` (interface) - 1 example import violation(s)
- `src/otlp.ts:1034` `runAiMetricsOtlpProjectionBatchExport` (const) - 1 example import violation(s)
- `src/otlp.ts:1098` `runAiMetricsOtlpExport` (const) - 1 example import violation(s)
- `src/otlp.ts:1146` `otlpExportResultToJson` (const) - 1 example import violation(s)
- `src/privacy.ts:456` `hashPublicTextSha256` (const) - 1 example import violation(s)
- `src/privacy.ts:496` `hashPrivateIdentifier` (const) - 1 example import violation(s)
- `src/privacy.ts:620` `makeAiMetricsSourceAttribution` (const) - 1 example import violation(s)
- `src/privacy.ts:801` `makeSanitizedTranscript` (const) - 1 example import violation(s)
- `src/privacy.ts:883` `makeAiMetricsPrivacyCheckResult` (const) - 1 example import violation(s)
- `src/privacy.ts:943` `privacyCheckToJson` (const) - 1 example import violation(s)
- `src/retention.ts:674` `AiMetricsRetentionRestoreDrillInput` (class) - 1 example import violation(s)
- `src/retention.ts:1010` `listAiMetricsRetentionInventory` (const) - 1 example import violation(s)
- `src/retention.ts:1179` `enforceAiMetricsRetentionPolicy` (const) - 1 example import violation(s)
- `src/retention.ts:1311` `runAiMetricsRetentionDelete` (const) - 1 example import violation(s)
- `src/retention.ts:1369` `runAiMetricsRetentionCompact` (const) - 1 example import violation(s)
- `src/retention.ts:1437` `runAiMetricsRetentionRestoreDrill` (const) - 1 example import violation(s)
- `src/retention.ts:1595` `aiMetricsRetentionInventoryToJson` (const) - 1 example import violation(s)
- `src/retention.ts:1636` `aiMetricsRetentionEnforcementToJson` (const) - 1 example import violation(s)
- `src/retention.ts:1678` `aiMetricsRetentionMutationToJson` (const) - 1 example import violation(s)
- `src/retention.ts:1720` `aiMetricsRetentionRestoreDrillToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:944` `listAiMetricsBenchmarkCases` (const) - 1 example import violation(s)
- `src/scorecard.ts:1517` `aiMetricsLabelQueueToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1556` `aiMetricsOutcomeLabelToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1588` `aiMetricsBenchmarkCaseToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1628` `aiMetricsBenchmarkCaseListToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1666` `aiMetricsBenchmarkRunToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1708` `aiMetricsWeeklyReportToJson` (const) - 1 example import violation(s)
- `src/source-discovery.ts:646` `discoverAiMetricsSources` (const) - 1 example import violation(s)
- `src/source-discovery.ts:718` `sourceDiscoveryToJson` (const) - 1 example import violation(s)
- `src/telemetry-v2-store.ts:222` `TelemetryV2StoreShape` (interface) - 1 example import violation(s)
- `src/telemetry-v2-store.ts:444` `TelemetryV2Store` (class) - 1 example import violation(s)

### @beep/firecrawl

Path: `packages/drivers/firecrawl`

Export findings:
- `src/Firecrawl.config.ts:126` `FirecrawlConfigInput` (class) - 1 example import violation(s)
- `src/Firecrawl.service.ts:756` `Firecrawl` (class) - 1 example import violation(s)

### @beep/runpod

Path: `packages/drivers/runpod`

Export findings:
- `src/RunpodDocs.service.ts:289` `parseRunpodDocsIndex` (const) - 1 example import violation(s)

### @beep/obs

Path: `packages/drivers/obs`

Module findings:
- `src/Obs.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Obs.service.ts:116` `ObsShape` (interface) - 1 example import violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/NextConfig.model.ts:423` `decodeNextConfig` (const) - 1 example import violation(s)
- `src/next/SharedNextConfig.model.ts:297` `BeepNextConfigOptions` (class) - 1 example import violation(s)
- `src/next/SharedNextConfig.model.ts:528` `decodeBeepNextConfigEnv` (const) - 1 example import violation(s)
- `src/next/models/AllowedDevOrigin.schema.ts:31` `AllowedDevOrigin` (const) - 1 example import violation(s)
- `src/next/models/Compiler.schema.ts:224` `SassOptions` (const) - 1 example import violation(s)
- `src/next/models/ImageConfig.schema.ts:238` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)
- `src/next/models/Routes.schema.ts:29` `RouteHasType` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:90` `RouteHas` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:266` `Rewrite` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:303` `Header` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:344` `Redirect` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:390` `Middleware` (const) - 1 example import violation(s)
- `src/next/models/Shared.schema.ts:34` `FileSizeSuffix` (const) - 1 example import violation(s)
- `src/next/models/Shared.schema.ts:88` `SizeLimit` (const) - 1 example import violation(s)

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
- `src/ClockCorrelator.service.ts:333` `ClockCorrelatorShape` (interface) - 1 example import violation(s)
- `src/Collector.service.ts:244` `CollectorShape` (interface) - 1 example import violation(s)
- `src/Witness.service.ts:68` `WitnessShape` (interface) - 1 example import violation(s)

### @beep/wink

Path: `packages/drivers/wink`

Module findings:
- `src/WinkBackend.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Wink.layer.ts:41` `WinkLayerLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:74` `WinkLayerAllLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:93` `WinkCorpusManagerLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:114` `WinkEngine` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:137` `WinkEngineLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:159` `WinkEngineRefLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:183` `WinkSimilarityLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:199` `WinkTokenization` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:223` `WinkTokenizationLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:245` `WinkUtilsLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:267` `WinkVectorizerLive` (const) - 1 example import violation(s)
- `src/Wink.service.ts:141` `WinkEngineRuntimeState` (type) - 1 example import violation(s)
- `src/Wink.service.ts:290` `WinkEngine` (class) - 1 example import violation(s)
- `src/Wink.service.ts:314` `WinkEngineLive` (const) - 1 example import violation(s)
- `src/WinkBackend.service.ts:169` `WinkBackendLive` (const) - 1 example import violation(s)
- `src/WinkCorpus.service.ts:860` `WinkCorpusManager` (class) - 1 example import violation(s)
- `src/WinkCorpus.service.ts:890` `WinkCorpusManagerLive` (const) - 1 example import violation(s)
- `src/WinkEngineRef.service.ts:74` `WinkEngineRef` (class) - 1 example import violation(s)
- `src/WinkEngineRef.service.ts:100` `WinkEngineRefLive` (const) - 1 example import violation(s)
- `src/WinkEngineRef.service.ts:124` `WinkEngineRuntimeState` (type) - 1 example import violation(s)
- `src/WinkObservability.ts:79` `WinkWorkflowObservationOptions` (class) - 1 example import violation(s)
- `src/WinkObservability.ts:209` `observeWinkWorkflow` (const) - 1 example import violation(s)
- `src/WinkObservability.ts:320` `mapWinkToolError` (const) - 1 example import violation(s)
- `src/WinkObservability.ts:362` `observeWinkTool` (const) - 1 example import violation(s)
- `src/WinkSimilarity.service.ts:297` `WinkSimilarity` (class) - 1 example import violation(s)
- `src/WinkSimilarity.service.ts:331` `WinkSimilarityLive` (const) - 1 example import violation(s)
- `src/WinkTokenization.service.ts:374` `WinkTokenization` (const) - 1 example import violation(s)
- `src/WinkTokenization.service.ts:397` `WinkTokenizationLive` (const) - 1 example import violation(s)
- `src/WinkTools.service.ts:372` `WinkNlpToolkitLive` (const) - 1 example import violation(s)
- `src/WinkUtils.service.ts:324` `WinkUtils` (class) - 1 example import violation(s)
- `src/WinkUtils.service.ts:348` `WinkUtilsLive` (const) - 1 example import violation(s)
- `src/WinkVectorizer.service.ts:76` `ScopedVectorizer` (interface) - 1 example import violation(s)
- `src/WinkVectorizer.service.ts:370` `WinkVectorizer` (class) - 1 example import violation(s)
- `src/WinkVectorizer.service.ts:395` `WinkVectorizerLive` (const) - 1 example import violation(s)

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
- `src/Pacer.config.ts:102` `PacerConfigBase` (class) - 1 example import violation(s)
- `src/Pacer.config.ts:134` `PacerConfigQA` (class) - 1 example import violation(s)
- `src/Pacer.config.ts:160` `PacerConfigProd` (class) - 1 example import violation(s)
- `src/Pacer.config.ts:275` `loadPacerConfig` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:169` `defaultCasePages` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:190` `loopingCaseReportBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:209` `defaultPartyBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:227` `authSuccessBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:251` `authInvalidBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:275` `logoutBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:299` `logoutInvalidBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:377` `reportInfoBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:412` `downloadResultsBody` (const) - 1 example import violation(s)

### @beep/venice-ai

Path: `packages/drivers/venice-ai`

Export findings:
- `src/VeniceAI.service.ts:485` `VeniceAIConfigInput` (class) - 1 example import violation(s)
- `src/VeniceAI.service.ts:1453` `VENICE_AI_OPERATION_DESCRIPTORS` (const) - 2 example import violation(s)
- `src/VeniceAI.service.ts:2109` `VeniceAI` (class) - 1 example import violation(s)
- `src/VeniceAI.service.ts:2182` `VeniceAiChat` (class) - 1 example import violation(s)

### @beep/m365

Path: `packages/drivers/m365`

Module findings:
- `src/M365.auth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/M365.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/M365.auth.ts:181` `M365InteractiveAuthorizer` (type) - 1 example import violation(s)
- `src/M365.auth.ts:316` `M365AuthShape` (type) - 1 example import violation(s)
- `src/M365.auth.ts:336` `M365Auth` (class) - 1 example import violation(s)

### @beep/xai

Path: `packages/drivers/xai`

Export findings:
- `src/XAi.config.ts:173` `XAiConfigInput` (class) - 1 example import violation(s)
- `src/XAi.service.ts:109` `XAiEndpointMethod` (type) - 1 example import violation(s)
- `src/XAi.service.ts:128` `XAiStreamMethod` (type) - 1 example import violation(s)
- `src/XAi.service.ts:187` `XAiWebSocketMethod` (type) - 1 example import violation(s)
- `src/XAi.service.ts:1027` `XAi` (class) - 1 example import violation(s)
- `src/XAiLanguageModel.service.ts:244` `make` (const) - 1 example import violation(s)

### @beep/openai

Path: `packages/drivers/openai`

Export findings:
- `src/OpenAi.service.ts:45` `OpenAiLive` (const) - 1 example import violation(s)
- `src/OpenAi.service.ts:135` `OpenAiLanguageModelLive` (const) - 1 example import violation(s)
- `src/OpenAi.service.ts:179` `makeOpenAiEmbeddingModelLive` (const) - 1 example import violation(s)

### @beep/hubspot

Path: `packages/drivers/hubspot`

Export findings:
- `src/HubSpot.service.ts:347` `HubSpotShape` (type) - 1 example import violation(s)

### @beep/sanity

Path: `packages/drivers/sanity`

Export findings:
- `src/Sanity.service.ts:170` `SanityShape` (type) - 1 example import violation(s)
- `src/Sanity.service.ts:365` `Sanity` (class) - 1 example import violation(s)

### @beep/graph-3d

Path: `packages/drivers/graph-3d`

Module findings:
- `src/Graph3D.react.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Graph3D.renderer.ts:1006` `renderGraph3D` (const) - 1 example import violation(s)

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Module findings:
- `src/Fold.assembly.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Fold.assembly.ts:67` `BoundComposer` (type) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.assembly.ts:886` `fold` (const) - 3 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:47` `MarkdownLinkMode` (const) - 1 example import violation(s)
- `src/Fold.markdown.ts:68` `MarkdownLinkMode` (type) - 1 example import violation(s)
- `src/Fold.markdown.ts:85` `MarkdownOptions` (class) - 1 example import violation(s)
- `src/Fold.markdown.ts:296` `toMarkdown` (const) - 3 example import violation(s)
- `src/Fold.models.ts:40` `AbsoluteIri` (type) - 1 example import violation(s)
- `src/Fold.models.ts:65` `SchemaHandle` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:81` `Subject` (type) - 1 example import violation(s)
- `src/Fold.models.ts:97` `LiteralScalar` (type) - 1 example import violation(s)
- `src/Fold.models.ts:116` `TypedLiteral` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:136` `TupleObject` (type) - 1 example import violation(s)
- `src/Fold.models.ts:155` `Triple` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:171` `OntologyFoldInput` (type) - 1 example import violation(s)
- `src/Fold.models.ts:202` `isSchemaHandle` (const) - 1 example import violation(s)
- `src/Fold.models.ts:276` `TripleValue` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:296` `TripleValue` (type) - 1 example import violation(s)
- `src/Fold.models.ts:312` `SkosClassification` (const) - 1 example import violation(s)
- `src/Fold.models.ts:332` `SkosClassification` (type) - 1 example import violation(s)
- `src/Fold.models.ts:351` `AssembledPredicateKind` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:371` `AssembledPredicateKind` (type) - 1 example import violation(s)
- `src/Fold.models.ts:388` `FactLiteral` (class) - 1 example import violation(s)
- `src/Fold.models.ts:413` `FactObject` (const) - 1 example import violation(s)
- `src/Fold.models.ts:435` `FactObject` (type) - 2 example import violation(s)
- `src/Fold.models.ts:460` `AssembledFact` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:493` `AssembledPredicate` (class) - 1 example import violation(s)
- `src/Fold.models.ts:528` `AssembledClass` (class) - 1 example import violation(s)
- `src/Fold.models.ts:556` `OntologyWarningCode` (const) - 1 example import violation(s)
- `src/Fold.models.ts:580` `OntologyWarningCode` (type) - 1 example import violation(s)
- `src/Fold.models.ts:603` `OntologyValidationWarning` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:636` `AssembledOntology` (class) - 1 example import violation(s)
- `src/Fold.models.ts:664` `OntologyAssemblyErrorReason` (const) - 1 example import violation(s)
- `src/Fold.models.ts:693` `OntologyAssemblyErrorReason` (type) - 1 example import violation(s)
- `src/Fold.models.ts:718` `OntologyAssemblyError` (class) - 1 example import violation(s)
- `src/Fold.models.ts:750` `isFactLiteral` (const) - 1 example import violation(s)
- `src/Fold.projections.ts:45` `JsonLdTerm` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:69` `JsonLdContext` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:86` `JsonLdNodeValue` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:109` `JsonLdNode` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:130` `JsonLdDocument` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:236` `toContext` (const) - 3 example import violation(s)
- `src/Fold.projections.ts:389` `toJsonLd` (const) - 3 example import violation(s)
- `src/Fold.projections.ts:632` `toTurtle` (const) - 3 example import violation(s)
- `src/SemanticFoundation.models.ts:189` `ConceptAlignment` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:220` `TaxonomyConcept` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:287` `FilingRoot` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:176` `VendorAlignmentManifestEntry` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:235` `VendorConceptSlice` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:431` `VendorSliceConceptMismatch` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:465` `VendorAlignmentTargetNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:36` `LibrarianInput` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:105` `TaxonomyConceptNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:127` `UnsupportedDocumentClass` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:158` `runLibrarianLoop` (const) - 2 example import violation(s)

### @beep/dock-react

Path: `packages/foundation/ui-system/dock-react`

Export findings:
- `src/DockReact.types.ts:33` `DockAtomGraph` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:52` `DockPanelApi` (class) - 2 example import violation(s)
- `src/DockReact.types.ts:76` `DockPanelProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:97` `DockTabProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:114` `DockRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:131` `DockTabRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:148` `DockviewAdapterApi` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:184` `DockTitleMinimaOptions` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:208` `DockviewReactProps` (type) - 1 example import violation(s)
- `src/DockviewReact.tsx:244` `DockviewReact` (const) - 3 example import violation(s)

### @beep/drizzle

Path: `packages/drivers/drizzle`

Export findings:
- `src/Drizzle.service.ts:94` `DrizzleClient` (interface) - 1 example import violation(s)
- `src/Drizzle.service.ts:134` `DrizzleShape` (interface) - 1 example import violation(s)
- `src/Drizzle.service.ts:174` `Drizzle` (class) - 1 example import violation(s)

### @beep/law-practice-server

Path: `packages/law-practice/server`

Module findings:
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CandorPromotionGate/CandorPromotionGate.layer.ts:45` `makeCandorPromotionGate` (const) - 1 example import violation(s)
- `src/CandorPromotionGate/CandorPromotionGate.ports.ts:136` `CandorPromotionSubjectResolver` (class) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.layer.ts:36` `CandorRecordRepositoryInMemory` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.layer.ts:62` `CandorRecordRepositoryLive` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.repo.ts:159` `makeInMemoryCandorRecordRepository` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.repo.ts:240` `makeCandorRecordRepository` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.layer.ts:37` `LegalPositionRecordRepositoryInMemory` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.layer.ts:70` `LegalPositionRecordRepositoryLive` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.repo.ts:180` `makeInMemoryLegalPositionRecordRepository` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.repo.ts:261` `makeLegalPositionRecordRepository` (const) - 1 example import violation(s)
- `src/PracticeKg.claims.ts:298` `runPracticeKgClaimsBatch` (const) - 1 example import violation(s)
- `src/PracticeKg.emails.ts:182` `readEmailRows` (const) - 1 example import violation(s)
- `src/PracticeKg.errors.ts:50` `PracticeKgProjectionError` (class) - 1 example import violation(s)
- `src/PracticeKg.fts.ts:272` `buildDuckDb` (const) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:571` `buildPracticeKgBundleImpl` (const) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:699` `PracticeKgProjections` (class) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:736` `PracticeKgProjectionsLive` (const) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:785` `buildPracticeKgBundle` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:181` `withDuckDb` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:226` `decodePracticeKgGraphRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:245` `decodePracticeKgFamilyRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:266` `decodePracticeKgDocumentRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:287` `decodePracticeKgEmailRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:306` `decodePracticeKgCandidateClaimRows` (const) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:541` `encodePracticeKgBundleManifestJson` (const) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:570` `encodePracticeKgCountsJson` (const) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:599` `encodePracticeKgNodePayloadJson` (const) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:641` `encodePracticeKgSummaryJson` (const) - 1 example import violation(s)
- `src/PracticeKg.tool-handlers.ts:136` `PracticeKgToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Tools.ts:108` `PracticeKgToolkitLayer` (const) - 1 example import violation(s)

### @beep/brand

Path: `packages/foundation/ui-system/brand`

Export findings:
- `src/Brand.assets.ts:31` `RenderedAsset` (class) - 1 example import violation(s)
- `src/Brand.assets.ts:84` `renderBrandAssets` (const) - 1 example import violation(s)
- `src/Brand.css.ts:28` `GENERATED_CSS_BANNER` (const) - 1 example import violation(s)
- `src/Brand.css.ts:76` `fontStack` (const) - 1 example import violation(s)
- `src/Brand.css.ts:147` `renderThemeCss` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:32` `PrintableText` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:60` `PrintableText` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:76` `ScaleStep` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:95` `ScaleStep` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:111` `SurfaceStep` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:130` `SurfaceStep` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:146` `ColorScale` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:176` `SurfaceScale` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:202` `Foreground` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:225` `Border` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:247` `Semantic` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:270` `Alpha` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:290` `Alpha` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:306` `GlowStop` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:328` `GlowLayer` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:350` `Glow` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:373` `ColorScheme` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:399` `SchemeName` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:418` `SchemeName` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:434` `FontStack` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:458` `Typography` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:480` `SvgPathData` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:513` `SvgPathData` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:529` `MarkPoint` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:551` `MarkRotation` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:573` `PixelGlasses` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:598` `BrandMark` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:627` `BrandIdentity` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:653` `SvgPaint` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:672` `SvgPaint` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:689` `MarkPaint` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:712` `MarkGround` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:741` `MarkSvgRequest` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:774` `WordmarkSvgRequest` (class) - 1 example import violation(s)
- `src/Brand.svg.ts:52` `glassesTransform` (const) - 1 example import violation(s)
- `src/Brand.svg.ts:121` `renderMarkSvg` (const) - 1 example import violation(s)
- `src/Brand.svg.ts:159` `renderWordmarkSvg` (const) - 1 example import violation(s)
- `src/Brand.tokens.ts:134` `beep` (const) - 1 example import violation(s)

### @beep/agents-server

Path: `packages/agents/server`

Module findings:
- `src/AssistantTurn/AnthropicTurnCodec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AssistantTurn/AnthropicTurnKernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AssistantTurn/AnthropicTurnKernel.ts:282` `AnthropicTurnKernel` (const) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:219` `BlockRepairCall` (type) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:262` `RepairInvalidBlocks` (type) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:686` `makeRepairInvalidBlocks` (const) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:734` `repairInvalidBlocks` (const) - 1 example import violation(s)
- `src/AssistantTurn/index.ts:51` `export * from "./AnthropicTurnKernel.ts";` (re-export) - 1 example import violation(s)
- `src/AssistantTurn/index.ts:81` `export * from "./BlockRepair.ts";` (re-export) - 1 example import violation(s)

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
- `src/capability/catalog.ts:90` `editorCapabilityCatalog` (const) - 1 example import violation(s)
- `src/capability/projection.ts:39` `ShortcutHelpEntry` (class) - 1 example import violation(s)
- `src/capability/resolver.ts:489` `resolveEditorProfile` (const) - 1 example import violation(s)
- `src/capability/resolver.ts:547` `resolveEditorProfileEffect` (const) - 1 example import violation(s)
- `src/capability/schemas.ts:445` `KeyChordFromString` (const) - 1 example import violation(s)
- `src/capability/schemas.ts:928` `CapabilityCatalog` (const) - 1 example import violation(s)
- `src/chat/atoms.ts:408` `composerRuntime` (const) - 1 example import violation(s)
- `src/chat/atoms.ts:899` `onSendAtom` (const) - 1 example import violation(s)
- `src/chat/attachment-model.ts:530` `fileToAttachment` (const) - 1 example import violation(s)
- `src/chat/config.ts:235` `SlashItems` (const) - 1 example import violation(s)
- `src/chat/config.ts:332` `MentionOptions` (const) - 1 example import violation(s)
- `src/runtime.ts:61` `decodeEditorStateForRuntimeResult` (const) - 1 example import violation(s)
- `src/runtime.ts:98` `decodeEditorStateForRuntime` (const) - 1 example import violation(s)
- `src/viewer.tsx:244` `EditorViewer` (function) - 1 example import violation(s)

### @beep/ontology-server

Path: `packages/ontology/server`

Export findings:
- `src/aggregates/Session/Session.file-store.ts:227` `makeFileSystemOntologyFileStore` (const) - 1 example import violation(s)
- `src/aggregates/Session/Session.layer.ts:104` `OntologyFileStoreLayer` (const) - 1 example import violation(s)

### @beep/workspace-server

Path: `packages/workspace/server`

Export findings:
- `src/SourceText/WorkspaceSourceTextResolver.ts:335` `WorkspaceSourceTextResolverLayer` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.repo.ts:246` `makeInMemoryThreadStore` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.repo.ts:411` `makeDrizzleThreadStore` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.repo.ts:651` `makeThreadStore` (const) - 1 example import violation(s)

### @beep/documents-server

Path: `packages/documents/server`

Module findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Document/DocumentIntake.service.ts:96` `makeDocumentIntake` (const) - 1 example import violation(s)
- `src/aggregates/Document/FilingDecisionLlm.config.ts:199` `FilingDecisionLlmConfigValue` (class) - 1 example import violation(s)
- `src/aggregates/Document/FilingTextExtraction.ts:70` `FilingTextExtractionShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:213` `DmsMirrorFixtureHandleShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:316` `makeDmsMirrorFixture` (const) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSyncEngine.service.ts:419` `makeVaultSyncEngine` (const) - 1 example import violation(s)
- `src/entities/internal/RepoSupport.ts:110` `makeEntityStore` (const) - 1 example import violation(s)

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
- `src/Openclaw.models.ts:121` `OpenclawDiagnosticText` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:175` `OpenclawProcessRequest` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:349` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:422` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:457` `OpenclawSecretsReloadOutput` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:522` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1198` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1301` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1388` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1459` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:442` `OpenclawCliRunner` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:787` `OpenclawCli` (class) - 1 example import violation(s)
- `src/OpenclawIntent.models.ts:54` `OpenclawSecretReference` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:101` `OpenclawTargetVersion` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1080` `OpenclawSkillPin` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1183` `OpenclawDeploymentIntent` (class) - 1 documentation section/link violation(s)
- `src/OpenclawSystemd.service.ts:225` `OpenclawSystemd` (class) - 1 example import violation(s)

### @beep/architecture-lab-server

Path: `packages/architecture-lab/server`

Export findings:
- `src/Layer.ts:36` `ArchitectureLabServerLive` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.http.ts:186` `makeWorkItemHttpHandlers` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:41` `makeWorkItemServer` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:68` `WorkItemServer` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:99` `WorkItemServerLayer` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repo.ts:74` `makeInMemoryWorkItemRepository` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repo.ts:174` `makeDrizzleWorkItemRepository` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repo.ts:248` `makeWorkItemRepository` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.rpc.ts:52` `makeWorkItemRpcHandlers` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.tools.ts:78` `makeWorkItemToolHandlers` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.layer.ts:39` `makeWorkerServer` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.layer.ts:66` `WorkerServer` (class) - 1 example import violation(s)
- `src/entities/Worker/Worker.layer.ts:91` `WorkerServerLayer` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.repo.ts:74` `makeInMemoryWorkerRepository` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.repo.ts:166` `makeDrizzleWorkerRepository` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.repo.ts:222` `makeWorkerRepository` (const) - 1 example import violation(s)
- `src/test.ts:36` `ArchitectureLabServerTest` (const) - 1 example import violation(s)

### @beep/db-admin

Path: `packages/_internal/db-admin`

Module findings:
- `src/migrate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/migrate.ts:79` `migrateOnBoot` (const) - 1 example import violation(s)
- `src/targets.ts:90` `listDbAdminMigrationTargets` (const) - 1 example import violation(s)

### @beep/discord

Path: `packages/drivers/discord`

Export findings:
- `src/Discord.service.ts:273` `Discord` (class) - 1 example import violation(s)

### @beep/gov-legal-mcp

Path: `packages/drivers/gov-legal-mcp`

Module findings:
- `src/Handlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolNames.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Handlers.ts:88` `GovinfoToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Handlers.ts:110` `EcfrToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Server.ts:140` `makeServerLayer` (const) - 1 example import violation(s)

### @beep/architecture-lab-client

Path: `packages/architecture-lab/client`

Export findings:
- `src/aggregates/WorkItem/WorkItem.client.ts:80` `WorkItemClientTransport` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:146` `WorkItemClientShape` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:198` `WorkItemClient` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:259` `makeWorkItemClient` (const) - 1 example import violation(s)

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
- `src/commands/Worktree/Worktree.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 documentation section/link violation(s)

Export findings:
- `src/commands/AIMetrics/AIMetrics.command.ts:1214` `aiMetricsCommand` (const) - 1 example import violation(s)
- `src/commands/AIMetrics/AIMetrics.errors.ts:164` `runAiMetricsProgram` (const) - 1 example import violation(s)
- `src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:704` `agentEffectivenessCommand` (const) - 1 example import violation(s)
- `src/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:451` `decodeTaskManifestJson` (const) - 1 example import violation(s)
- `src/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:477` `encodeAgentEffectivenessEvalScoreReportJson` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.plan.ts:246` `makeArchitectureOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.plan.ts:331` `makeArchitecturePackageOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.schemas.ts:960` `encodeCanonicalSliceOperationPlanJson` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.schemas.ts:990` `decodeCanonicalSliceOperationPlanJson` (const) - 1 example import violation(s)
- `src/commands/Architecture/OperationPlanExecution.ts:183` `checkCanonicalSliceOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/OperationPlanExecution.ts:281` `applyCanonicalSliceOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/OperationPlanPackageJson.ts:93` `renderPackageJsonOperation` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:254` `runCacheWarm` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:280` `runCacheWarmForTesting` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:451` `buildCacheDashboard` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:506` `runCacheRestorationProbe` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.schemas.ts:244` `CacheDashboardReportJson` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.schemas.ts:261` `CacheWarmReceiptJson` (const) - 1 example import violation(s)
- `src/commands/Ci/Ci.command.ts:270` `appendTurboSummary` (const) - 1 example import violation(s)
- `src/commands/Ci/CiAdmission.ts:57` `HeavyAdmissionJson` (const) - 1 example import violation(s)
- `src/commands/Ci/CiAdmission.ts:121` `runCiAdmission` (const) - 1 example import violation(s)
- `src/commands/Ci/CiLane.ts:369` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:1442` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/HeavyAdmission.ts:497` `readHeavyAdmissionChangedPaths` (const) - 1 example import violation(s)
- `src/commands/Ci/HeavyAdmission.ts:545` `readHeavyAdmissionEvent` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.capture.schemas.ts:631` `CodexFindingsCapturePayload` (class) - 1 example import violation(s)
- `src/commands/Codex/Findings.capture.schemas.ts:690` `decodeCodexFindingsCapturePayload` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.csv.ts:329` `decodeCodexFindingsCsv` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.normalize.ts:244` `priorIdsOfEntries` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.normalize.ts:300` `planPacket` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.refresh.ts:242` `validateCodexFindingsIngestModes` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.refresh.ts:313` `loadCodexRefreshLedgerSource` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.schemas.ts:433` `decodeCodexFindingsIngestOptions` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.write.ts:162` `assertPacketDocumentsClean` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.errors.ts:303` `CorpusArchiveMoveDigestMismatchError` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.recyclebin.ts:101` `parseRecycleBinMetadata` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:248` `CorpusCommandService` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:353` `archiveMoveCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:380` `catalogCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:413` `extractCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:440` `enrichCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:467` `organizeCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:497` `salvageCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:524` `verifySalvage` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:568` `preserveRestorationArchive` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:596` `reconcileRestorationAcceptance` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:636` `restoreMail` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:676` `restoreLegacyWord` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:712` `restoreRecycle` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:740` `verifyRestorationArchive` (const) - 1 example import violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:109` `resolveCreatePackageTemplateDir` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:1107` `createPackageCommand` (const) - 1 example import violation(s)
- `src/commands/DeletePackage/DeletePackage.command.ts:380` `rewritePendingChangesets` (const) - 1 example import violation(s)
- `src/commands/Docgen/Doctest.service.ts:46` `DoctestFenceAnalyzer` (class) - 1 example import violation(s)
- `src/commands/Docgen/Doctest.service.ts:80` `DoctestFenceRewriter` (class) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:680` `explorationProjectionDriftPaths` (const) - 1 example import violation(s)
- `src/commands/Explore/Check.ts:358` `runExploreCheck` (const) - 1 example import violation(s)
- `src/commands/Fallow/Fallow.command.ts:520` `fallowCommand` (const) - 1 example import violation(s)
- `src/commands/Files/Files.command.ts:899` `filesCommand` (const) - 1 example import violation(s)
- `src/commands/Files/Files.errors.ts:120` `failOnExtensionlessFile` (const) - 1 example import violation(s)
- `src/commands/Files/Files.plan.ts:195` `uniqueNormalizeTargetName` (const) - 1 example import violation(s)
- `src/commands/Files/Files.plan.ts:230` `uniqueArchiveTargetName` (const) - 1 example import violation(s)
- `src/commands/Files/Files.service.ts:2725` `flattenMediaFiles` (const) - 1 example import violation(s)
- `src/commands/Goals/Doctor.ts:784` `runGoalsDoctor` (const) - 1 example import violation(s)
- `src/commands/Goals/Goals.schemas.ts:489` `decodeGoalManifest` (const) - 1 example import violation(s)
- `src/commands/Goals/Inventory.ts:187` `listGoalPackets` (const) - 1 example import violation(s)
- `src/commands/Goals/Inventory.ts:212` `listGoalPacketsStrict` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:108` `PacketForkRepairApplier` (class) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:526` `isRecoverableGenesisSeed` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:644` `planPacketGenesisRecovery` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:698` `planPacketGenesisSeed` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:792` `quarantineOwnedGenesisEvents` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketCore.schemas.ts:942` `decodePacketEvent` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketCore.schemas.ts:1408` `decodePacketTraceProjection` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketEventStore.ts:149` `withPacketEventLock` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketEventStore.ts:282` `PacketEventStore` (class) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketEventStore.ts:356` `foldUnambiguousStream` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketFold.ts:476` `renderPacketTraceFile` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketFold.ts:628` `planForkRepair` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketTransitionWriter.ts:368` `PacketTransitionWriter` (class) - 1 example import violation(s)
- `src/commands/Goals/PortfolioIndex.ts:193` `buildPortfolioIndexContent` (const) - 1 example import violation(s)
- `src/commands/Goals/PortfolioIndex.ts:247` `writePortfolioIndex` (const) - 1 example import violation(s)
- `src/commands/Goals/SetStatus.ts:315` `loadGoalPacketManifest` (const) - 1 example import violation(s)
- `src/commands/Image/Image.command.ts:140` `imageCommand` (const) - 1 example import violation(s)
- `src/commands/Image/Image.schemas.ts:306` `decodeExtractFramesOptions` (const) - 1 example import violation(s)
- `src/commands/Image/Image.schemas.ts:327` `decodeExtractFramesDirOptions` (const) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:96` `ImageCommandService` (class) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:307` `ImageCommandServiceLive` (const) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:328` `extractFrames` (const) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:353` `extractFramesDir` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.command.ts:497` `applyKnowledgeRefsCheck` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.errors.ts:74` `KnowledgeOperationalError` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1070` `encodeKnowledgeRefsReportJson` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1097` `decodeKnowledgeRefsReportJson` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1160` `knowledgeSha256Hex` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1192` `makeKnowledgeRefId` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:2262` `decodeKnowledgeUtf8` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:2960` `scanKnowledgeRefsTree` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:468` `decodeKnowledgeFinding` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:508` `encodeKnowledgeFinding` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:902` `encodeKnowledgeSemanticDeltaReportJson` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:270` `KnowledgeService` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:308` `makeKnowledgeFindingId` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:874` `scanKnowledgePair` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1034` `guardKnowledgeCloneAttributes` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1524` `resolveKnowledgeProbePolicy` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1648` `makeKnowledgeTreeOracle` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1733` `KnowledgeServiceLive` (const) - 1 example import violation(s)
- `src/commands/Labs/Labs.command.ts:190` `labsListCommand` (const) - 1 example import violation(s)
- `src/commands/Labs/Labs.command.ts:218` `labsCommand` (const) - 1 example import violation(s)
- `src/commands/Laws/EffectFn.ts:393` `runEffectFnRules` (const) - 1 example import violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:328` `runFrozenGrantSetRules` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/commands/Laws/LawsPackage.ts:75` `scanLawsPackage` (const) - 1 example import violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:615` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/SchemaDiagnostics.ts:64` `formatSchemaDiagnostics` (const) - 1 example import violation(s)
- `src/commands/Laws/SchemaDiagnostics.ts:95` `formatRedactedSchemaDiagnostics` (const) - 1 example import violation(s)
- `src/commands/Lint/EcosystemPolarity.ts:384` `runEcosystemPolarityCheck` (const) - 1 example import violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:388` `collectTestTypecheckBlindSpots` (const) - 1 example import violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:500` `runPackageTestTypecheckLint` (const) - 1 example import violation(s)
- `src/commands/Lint/ReflectionArtifact.ts:208` `reflectionFrontmatterIsValid` (const) - 1 example import violation(s)
- `src/commands/Lint/RoadmapRefs.ts:293` `runRoadmapRefsLint` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:620` `generateSchemaCatalogDocument` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:676` `renderSchemaCatalogDocument` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:701` `generateSchemaCatalogText` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:757` `runSchemaCatalog` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:796` `lintSchemaCatalogCommand` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaFirst.ts:162` `export { makeSchemaFirstOwnerResolver, makeSchemaFirstProject } from "./internal/SchemaFirstProject.ts";` (re-export) - 1 example import violation(s)
- `src/commands/Lint/SchemaFirst.ts:179` `export { runSchemaFirstLint } from "./internal/SchemaFirstScan.ts";` (re-export) - 1 example import violation(s)
- `src/commands/Lint/SchemaFirst.ts:460` `lintSchemaFirstCommand` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaTopology.ts:417` `collectSchemaTopologyViolations` (const) - 1 example import violation(s)
- `src/commands/Qa/CitedArtifactExistsGate.ts:233` `evaluateCitedArtifactExists` (const) - 1 example import violation(s)
- `src/commands/Qa/Control.ts:42` `requireLiveHandle` (const) - 1 example import violation(s)
- `src/commands/Qa/Control.ts:89` `stopLiveSession` (const) - 1 example import violation(s)
- `src/commands/Qa/Control.ts:118` `markLiveSession` (const) - 1 example import violation(s)
- `src/commands/Qa/Doctor.ts:293` `runQaDoctor` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:149` `extractionPlanPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:190` `artifactBudgetPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:212` `writeArtifactBudget` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:238` `readArtifactBudget` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:262` `readExtractionPlan` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:324` `resolveRoundLayout` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:792` `runQaExtract` (const) - 1 example import violation(s)
- `src/commands/Qa/Inventory.schemas.ts:534` `decodeQaInventory` (const) - 1 example import violation(s)
- `src/commands/Qa/Inventory.schemas.ts:562` `encodeQaInventory` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:359` `crossCheckAgainstRound` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:394` `raiseCrossCheckFailure` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:452` `requireInventoryRound` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:511` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeContract.ts:177` `evaluateCitedEventIdExists` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeContract.ts:313` `evaluateDeclaredRoundCoherent` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeContract.ts:707` `evaluateJudgeOutputInventoryDecodes` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeIngest.ts:103` `inventoryJsonPath` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeIngest.ts:123` `parseJudgeOutput` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeIngest.ts:167` `runQaJudgeIngest` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeLint.ts:53` `runQaJudgeLint` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgePack.ts:380` `readLegacyManifest` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgePack.ts:567` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:668` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:863` `runQaJudgePack` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeSkill.ts:78` `runQaJudgeSkill` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.command.ts:66` `QaCommandLayers` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.command.ts:319` `qaCommand` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:343` `decodeQaRecordOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:363` `decodeQaExtractOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:383` `decodeQaReportOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:403` `decodeQaMarkOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:423` `decodeQaJudgePackOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:443` `decodeQaJudgeIngestOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:463` `decodeQaJudgeLintOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:64` `qaRootPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:196` `resolveAppHostTarget` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:316` `resolveCaptureTarget` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:378` `resolveRound` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:407` `resolveExistingRound` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:482` `readEventLog` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:562` `readCommitProvenance` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:606` `collectToolVersions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:675` `recordHintPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:703` `readRecordStartHint` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:730` `writeRecordStartHint` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:763` `discoverRecordedVideo` (const) - 1 example import violation(s)
- `src/commands/Qa/Record.ts:243` `requireCapturedEvents` (const) - 1 example import violation(s)
- `src/commands/Qa/Record.ts:473` `runQaRecord` (const) - 1 example import violation(s)
- `src/commands/Qa/Report.ts:40` `runQaReport` (const) - 1 example import violation(s)
- `src/commands/Quality/ChangesetGraph.ts:385` `changesetPackageReferencesFromText` (const) - 1 example import violation(s)
- `src/commands/Quality/CheckCensusGate.ts:1140` `CheckCensusSampler` (class) - 1 example import violation(s)
- `src/commands/Quality/FallowQuality.command.ts:1252` `collectAuditDiffInputForTesting` (const) - 1 example import violation(s)
- `src/commands/Quality/FallowQuality.command.ts:2470` `qualityFallowCommand` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.command.ts:1020` `runBunAudit` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:1150` `devQualityStepsForTesting` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.osv-ignore.ts:105` `selectOsvIgnoreIdsForAudit` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.osv-ignore.ts:154` `activeOsvIgnoreIdsForTesting` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.render.ts:71` `printQualityProfileConfig` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.render.ts:113` `printQualityProfileDetection` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.schemas.ts:451` `decodePackageJsonDocument` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.schemas.ts:850` `decodeGithubChecksFallowFeatureMatrix` (const) - 1 example import violation(s)
- `src/commands/Refs/Refs.service.ts:143` `ReferenceWorkspace` (class) - 1 example import violation(s)
- `src/commands/Research/Research.command.ts:403` `runResearchInstallTimers` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:61` `ResearchCommandServiceRequirements` (type) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:163` `ResearchCommandService` (class) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:265` `captureResearchUrl` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:292` `researchStatus` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:319` `cognifyResearchCards` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:353` `runResearchDaily` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:380` `writeResearchDigest` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:412` `siftResearchHistory` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:444` `writeResearchRepoCards` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:471` `pullResearchNotionLinks` (const) - 1 example import violation(s)
- `src/commands/Runners/Runners.command.ts:38` `resolveBakeMode` (const) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:120` `BakeConfig` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:166` `BakeReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:275` `BakePlan` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:334` `BakeCheckReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.service.ts:161` `BakeLocalInputs` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.service.ts:211` `RunnersService` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.command.ts:974` `runSkillsUpdate` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.command.ts:1084` `skillsCommand` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:556` `SkillSnapshot` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1174` `decodeSkillUpstream` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1207` `encodeSkillUpstream` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1234` `decodeSkillSnapshotFile` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1261` `encodeSkillSnapshotFile` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1291` `decodeSkillSnapshot` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1321` `encodeSkillSnapshot` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1348` `decodeSkillLicense` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1375` `encodeSkillLicense` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1404` `decodeSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1433` `encodeSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1462` `decodeSkillPatch` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1491` `encodeSkillPatch` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1518` `decodeSkillPatches` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1545` `encodeSkillPatches` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1573` `decodeSkillEffective` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1601` `encodeSkillEffective` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1622` `decodeSkillLockV2Entry` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1643` `encodeSkillLockV2Entry` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1664` `decodeSkillsLockV2` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1685` `encodeSkillsLockV2` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1715` `decodeSkillsLockV2Json` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1741` `encodeSkillsLockV2Json` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:616` `SkillUpstreamContentSource` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:655` `SkillUpstreamContentSourceLive` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:708` `resolveSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:855` `SkillProvenanceService` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:907` `SkillProvenanceServiceLayer` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:934` `SkillProvenanceServiceLive` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:972` `runSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/SyncDataToTs/SyncDataToTs.command.ts:546` `syncDataToTsCommand` (const) - 1 example import violation(s)
- `src/commands/TsconfigSync/TsconfigSync.command.ts:49` `tsconfigSyncCommand` (const) - 1 example import violation(s)
- `src/commands/TsconfigSync/TsconfigSync.schemas.ts:282` `byStringAscending` (const) - 1 example import violation(s)
- `src/commands/TsconfigSync/TsconfigSync.service.ts:80` `syncTsconfigAtRoot` (const) - 1 example import violation(s)
- `src/commands/VersionSync/VersionSync.command.ts:50` `versionSyncCommand` (const) - 1 example import violation(s)
- `src/commands/Worktree/Fleet.service.ts:330` `parseProcStatStartTime` (const) - 1 example import violation(s)
- `src/commands/Worktree/Fleet.service.ts:448` `FleetMirrorService` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:350` `resolveWorktreeContext` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:408` `addWorktree` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:455` `copyLocalFiles` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:553` `worktreeDoctorReportForContext` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:723` `linkReferences` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:877` `renderWorktreeRemovalReceipt` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:1067` `worktreeCommand` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:147` `WorktreeMergedPullRequestProbe` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:347` `worktreeArchivePlan` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:473` `WorktreeRemovalService` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:534` `runWorktreeGitCapture` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:1508` `WorktreeRemovalServiceLayer` (const) - 1 example import violation(s)
- `src/commands/Yeet/Yeet.command.ts:522` `yeetMonitorDurationMillis` (const) - 1 example import violation(s)

### @beep/ai-sync

Path: `packages/tooling/library/ai-sync`

Export findings:
- `src/drift.ts:54` `getGeneratedSourceMetadata` (const) - 1 example import violation(s)
- `src/drift.ts:89` `checkGeneratedArtifacts` (const) - 1 example import violation(s)
- `src/drift.ts:165` `checkSourceDriftWithFetcher` (const) - 1 example import violation(s)
- `src/drift.ts:216` `checkStrictDrift` (const) - 1 example import violation(s)
- `src/drift.ts:249` `assertNoStrictDrift` (const) - 1 example import violation(s)
- `src/generator.ts:372` `hashSourceText` (const) - 1 example import violation(s)
- `src/generator.ts:420` `fetchSourceText` (const) - 1 example import violation(s)
- `src/generator.ts:510` `generateAiSyncArtifacts` (const) - 1 example import violation(s)
- `src/index.ts:46` `export * from "./drift.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:137` `export * from "./validation.ts";` (re-export) - 1 example import violation(s)
- `src/schemas.ts:88` `NormalizedAgentInstructionDocument` (const) - 1 example import violation(s)
- `src/validation.ts:431` `validateRepoConfig` (const) - 1 example import violation(s)
- `src/validation.ts:474` `validateRepoSafetyPolicy` (const) - 1 example import violation(s)
- `src/validation.ts:515` `validateDogfoodConfig` (const) - 1 example import violation(s)
- `src/validation.ts:543` `validateDogfoodConfigs` (const) - 1 example import violation(s)
- `src/validation.ts:569` `defaultRepoRoot` (const) - 1 example import violation(s)
- `src/validation.ts:597` `validateCurrentCheckoutDogfood` (const) - 1 example import violation(s)
- `src/validation.ts:626` `validateCurrentCheckoutDogfoodConfigs` (const) - 1 example import violation(s)

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
- `src/Server.ts:107` `makeServerLayer` (const) - 1 example import violation(s)
- `src/Streaming/DatasetLoader.ts:668` `loadJsonl` (const) - 1 documentation section/link violation(s)
- `src/StreamingHandlers.ts:107` `StreamingToolkitHandlersLive` (const) - 1 example import violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/m365-mcp

Path: `packages/drivers/m365-mcp`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/M365Handlers.ts:104` `M365ToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Server.ts:120` `makeServerLayer` (const) - 1 example import violation(s)

### @beep/oip-web

Path: `apps/oip-web`

Export findings:
- `src/app/api/contact/ContactHttpApiRoute.ts:74` `makeOipContactHttpApiWebHandlerWithSubmit` (const) - 1 example import violation(s)
- `src/app/api/contact/ContactRouteResponse.ts:106` `contactRequestResponseWithSubmit` (const) - 1 example import violation(s)
- `src/app/api/contact/ContactRouteResponse.ts:150` `contactRequestResponse` (const) - 1 example import violation(s)
- `src/contact/ContactSubmission.model.ts:170` `ContactSubmission` (class) - 1 example import violation(s)
- `src/contact/ContactSubmission.model.ts:306` `contactSubmissionPayloadFromFormDataEffect` (const) - 1 example import violation(s)
- `src/contact/ContactSubmission.model.ts:390` `decodeContactSubmission` (const) - 1 example import violation(s)
- `src/contact/ContactSubmission.service.ts:288` `submitContact` (const) - 1 example import violation(s)
- `src/content/OipContent.model.ts:682` `decodeOipSiteContentResult` (const) - 1 example import violation(s)
- `src/content/OipContent.model.ts:703` `decodeOipSiteContent` (const) - 1 example import violation(s)
- `src/runtime/OipRuntimeConfig.ts:54` `makeTextConfigOptionReader` (const) - 1 example import violation(s)
- `src/runtime/OipRuntimeConfig.ts:86` `makeRedactedConfigOptionReader` (const) - 1 example import violation(s)

### @beep/scratchpad

Path: `scratchpad`

Module findings:
- `jsonc/index.ts:1` (packageDocumentation) - 1 example import violation(s)
- `memfs/internal/volume.ts:1` (none) - missing summary; missing @since
- `schemastore/index.ts:1` (packageDocumentation) - 1 example import violation(s)
- `semver/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `beep-docs/api-reference/ApiReferenceDataset.ts:559` `loadApiReferenceDataset` (const) - 1 example import violation(s)
- `beep-docs/api-reference/DatasetPath.ts:68` `resolveWithinDataset` (const) - 1 example import violation(s)
- `beep-docs/api-reference/Reflection.ts:250` `loadReflection` (const) - 1 example import violation(s)
- `bun-test/index.ts:200` `setDefaultTimeout` (const) - 1 example import violation(s)
- `bun-test/index.ts:564` `effect` (const) - 1 example import violation(s)
- `bun-test/index.ts:581` `live` (const) - 1 example import violation(s)
- `bun-test/index.ts:601` `layer` (const) - 1 example import violation(s)
- `bun-test/index.ts:618` `flakyTest` (const) - 1 example import violation(s)
- `bun-test/index.ts:654` `it` (const) - 1 example import violation(s)
- `bun-test/index.ts:672` `makeMethods` (const) - 1 example import violation(s)
- `bun-test/index.ts:691` `describeWrapped` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Command.ts:45` `CommandFrontmatter_` (class) - 1 example import violation(s)
- `claudecode/Frontmatter/Command.ts:89` `CommandFrontmatter` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/OutputStyle.ts:38` `OutputStyleFrontmatter_` (class) - 1 example import violation(s)
- `claudecode/Frontmatter/OutputStyle.ts:70` `OutputStyleFrontmatter` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:190` `parse` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:229` `parseFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:260` `parseSkillFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:289` `parseCommandFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:318` `parseSubagentFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:349` `parseOutputStyleFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:140` `render` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:163` `renderCommand` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:187` `renderSkill` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:214` `renderSubagent` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:238` `renderOutputStyle` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Skill.ts:130` `SkillFrontmatter` (class) - 1 example import violation(s)
- `claudecode/Frontmatter/Subagent.ts:82` `SubagentFrontmatter` (class) - 1 example import violation(s)
- `codemode/Codemode.result.ts:371` `encodeResultModel` (const) - 1 example import violation(s)
- `codemode/Codemode.service.ts:177` `resolveExecutionLimits` (const) - 1 example import violation(s)
- `codemode/Codemode.service.ts:206` `execute` (const) - 1 example import violation(s)
- `codemode/Codemode.service.ts:247` `make` (const) - 1 example import violation(s)
- `codemode/Codemode.tool-runtime.ts:1112` `prepare` (const) - 1 example import violation(s)
- `codemode/Codemode.tool-runtime.ts:1147` `searchIndex` (const) - 1 example import violation(s)
- `codemode/Codemode.tool-runtime.ts:1323` `make` (const) - 1 example import violation(s)
- `codemode/Codemode.values.ts:181` `CodeModePromise` (class) - 1 example import violation(s)
- `codemode/Codemode.values.ts:505` `isCodeModeValue` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.errors.ts:258` `constructAggregateErrorValue` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.execute.ts:81` `executeWithLimits` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.iterator.ts:101` `preserveConsumerError` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:219` `invokeIntrinsic` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:619` `invokeArrayFrom` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:718` `invokeGroupBy` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:936` `applyCollectionCallback` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:292` `Scope` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:560` `CodeModeFunction` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:642` `CodeModeGenerator` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:717` `GeneratorMethodReference` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:1113` `PromiseInstanceMethodReference` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:1946` `tryInterpreter` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:2033` `asNode` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:100` `PromiseRuntime` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:394` `resolvePromiseValue` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:480` `resolvePromise` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:582` `invokePromiseMethod` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:755` `invokePromiseInstanceMethod` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:854` `constructPromise` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.runtime.ts:480` `Interpreter` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.scope.ts:67` `ScopeStack` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.runtime.ts:685` `invoke` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:532` `componentDefinitions` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:927` `operationInput` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1120` `operationOutput` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1285` `operationPath` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1368` `validateBaseUrl` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1410` `specServerUrl` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1448` `securityRequirements` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1513` `operationSecurityRequirements` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1600` `securitySchemes` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:559` `CredentialBearer` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:588` `CredentialBasic` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:626` `CredentialApiKey` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:657` `CredentialHeader` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:799` `AuthConfig` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1175` `SecurityRequirement` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1219` `Plan` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1276` `AppliedAuth` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1394` `FromSpecResult` (class) - 1 example import violation(s)
- `codemode/openapi/index.ts:412` `fromSpec` (const) - 2 example import violation(s)
- `codemode/stdlib/StdLib.json.ts:71` `invokeJsonMethod` (const) - 1 example import violation(s)
- `codemode/stdlib/StdLib.math.ts:184` `invokeMathSumPrecise` (const) - 1 example import violation(s)
- `codemode/stdlib/StdLib.object.ts:201` `invokeObjectFromEntries` (const) - 1 example import violation(s)
- `codemode/stdlib/StdLib.url.ts:156` `invokeUriFunction` (const) - 1 example import violation(s)
- `glob/GlobPattern.ts:83` `GlobPatternError` (class) - 1 example import violation(s)
- `glob/GlobPattern.ts:155` `GlobPatternOptions` (class) - 1 example import violation(s)
- `glob/GlobPattern.ts:265` `GlobPattern` (class) - 1 example import violation(s)
- `glob/GlobSet.ts:110` `GlobSet` (class) - 2 example import violation(s)
- `glob/index.ts:27` `export { GlobPattern, GlobPatternError, GlobPatternOptions } from "./GlobPattern.ts";` (re-export) - 1 example import violation(s)
- `glob/index.ts:45` `export { GlobSet } from "./GlobSet.ts";` (re-export) - 1 example import violation(s)
- `glob/internal/limits.ts:51` `MAX_PATTERN_LENGTH` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:76` `EXPANSION_MAX` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:101` `MAX_GLOBSTAR_RECURSION` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:128` `MAX_EXTGLOB_RECURSION` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:153` `MAX_NESTING_DEPTH` (const) - 1 example import violation(s)
- `jsonc/Jsonc.ts:151` `JsoncParseError` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:219` `JsoncParseOptions` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:307` `JsoncStringifyOptions` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:344` `JsoncStringifyError` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:514` `Jsonc` (class) - 1 example import violation(s)
- `jsonc/JsoncEdit.ts:130` `JsoncFormattingOptionsLike` (const) - 1 example import violation(s)
- `jsonc/JsoncFingerprint.ts:399` `JsoncFingerprint` (class) - 1 example import violation(s)
- `jsonc/JsoncModifier.ts:70` `JsoncModificationError` (class) - 1 example import violation(s)
- `jsonc/JsoncModifier.ts:173` `JsoncModifier` (class) - 1 example import violation(s)
- `jsonc/JsoncNode.ts:43` `JsoncSegment` (const) - 1 example import violation(s)
- `jsonc/JsoncNode.ts:182` `JsoncNode` (class) - 1 example import violation(s)
- `jsonc/JsoncVisitor.ts:118` `JsoncVisitor` (class) - 1 example import violation(s)
- `jsonc/index.ts:32` `export type { JsoncBoundCodec } from "./Jsonc.ts";` (re-export) - 1 example import violation(s)
- `jsonc/internal/navigate.ts:209` `NavigateResult` (const) - 1 example import violation(s)
- `jsonc/internal/parser.ts:92` `ParseCode` (const) - 1 example import violation(s)
- `jsonc/internal/scanner.ts:41` `SyntaxKind` (const) - 1 example import violation(s)
- `jsonc/internal/scanner.ts:93` `ScanError` (const) - 1 example import violation(s)
- `jsonl/Envelope.ts:82` `EnvelopeFrame` (const) - 1 example import violation(s)
- `jsonl/Envelope.ts:291` `Envelope` (const) - 1 example import violation(s)
- `jsonl/JsonlError.ts:68` `MalformedLine` (class) - 1 example import violation(s)
- `jsonl/JsonlError.ts:183` `InvalidData` (class) - 1 example import violation(s)
- `jsonl/Line.ts:54` `ParsedLine` (class) - 1 example import violation(s)
- `jsonl/Slice.ts:142` `matchesFrame` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:163` `probeBomBytes` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:231` `readTail` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:322` `readTailUntil` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:402` `readRangeText` (const) - 1 example import violation(s)
- `memfs/MemoryFileSystem.ts:362` `MemoryFileSystemSeedEntry` (const) - 1 example import violation(s)
- `memfs/MemoryFileSystem.ts:489` `MemoryFileSystemTransientFault` (const) - 1 example import violation(s)
- `memfs/MemoryFileSystem.ts:915` `MemoryFileSystem` (class) - 1 example import violation(s)
- `memfs/internal/volume.ts:2815` `make` (const) - 1 example import violation(s)
- `memfs/internal/volume.ts:2993` `makeInspectable` (const) - 1 example import violation(s)
- `memfs/internal/volume.ts:3022` `layer` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:327` `HtmlYearString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:364` `HtmlMonthString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:401` `HtmlDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:437` `HtmlYearlessDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:474` `HtmlTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:511` `HtmlLocalDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:550` `HtmlTimeZoneOffsetString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:585` `HtmlGlobalDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:621` `HtmlWeekString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:657` `HtmlDurationUnit` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:694` `HtmlIsoDurationString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:736` `HtmlHumanDurationString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:771` `HtmlDurationString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:803` `HtmlUrlTokenString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:845` `HtmlUrlPotentiallySurroundedBySpaces` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:890` `makeHtmlUrlFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:923` `MicrodataSerializedUrlString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:965` `MicrodataUrlFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1115` `HtmlDurationValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1168` `MicrodataDurationFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1227` `MicrodataDateTimeFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1265` `XsdIntegerString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1334` `XsdIntegerFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1398` `XsdDoubleString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1446` `XsdDoubleFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1484` `MicrodataNumericValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1530` `MicrodataDataValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1575` `MicrodataXsdDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1612` `MicrodataXsdYearMonthString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1653` `MicrodataXsdYearString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1690` `MicrodataXsdTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1730` `MicrodataXsdDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1776` `MicrodataRdfTimeValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1823` `MicrodataRuntimeValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1957` `VCardValueType` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1994` `VCardValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2032` `VCardValueTypeFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2069` `VCardIanaValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2112` `VCardExperimentalValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2153` `VCardDeclaredValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2190` `VCardTextString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2231` `VCardUriString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2268` `VCardDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2306` `VCardTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2342` `VCardDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2381` `VCardDateAndOrTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2416` `VCardTimestampString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2450` `VCardZonedTimestampString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2490` `VCardBooleanString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2528` `VCardIntegerString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2561` `VCardFloatString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2596` `VCardUtcOffsetString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2631` `VCardLanguageTagString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2671` `VCardBooleanFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2758` `VCardIntegerFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2798` `VCardFloatValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2854` `VCardFloatFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2940` `VCardUtcOffsetValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2991` `VCardUtcOffsetFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3062` `VCardTimestampValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3112` `VCardTimestampFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3157` `VCardUrlFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3200` `MicrodataContextualValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3253` `VCardTypedScalarFromString` (const) - 1 example import violation(s)
- `schemastore/AnnotationCarriers.ts:276` `AnnotationCarriers` (class) - 1 example import violation(s)
- `schemastore/CanonicalJson.ts:60` `NonJsonValueError` (class) - 1 example import violation(s)
- `schemastore/CanonicalJson.ts:264` `CanonicalJson` (class) - 1 example import violation(s)
- `schemastore/DocumentDiff.ts:54` `SchemaChange` (const) - 1 example import violation(s)
- `schemastore/SchemaFile.ts:197` `WriteOutcome` (const) - 1 example import violation(s)
- `schemastore/SchemaFile.ts:232` `WriteChange` (const) - 1 example import violation(s)
- `schemastore/SchemaFile.ts:506` `SchemaFile` (class) - 1 example import violation(s)
- `schemastore/SchemaPipeline.ts:444` `SchemaPipeline` (class) - 1 example import violation(s)
- `schemastore/SchemaTarget.ts:114` `SchemaTarget` (class) - 1 example import violation(s)
- `schemastore/SchemaValidator.ts:274` `SchemaValidator` (class) - 1 example import violation(s)
- `schemastore/SchemaVersioning.ts:80` `InvalidSchemaVersionError` (class) - 1 example import violation(s)
- `schemastore/SchemaVersioning.ts:155` `SchemaVersion` (const) - 1 example import violation(s)
- `schemastore/SchemaVersioning.ts:305` `SchemaVersioning` (class) - 1 example import violation(s)
- `schemastore/StoreDocument.ts:261` `StoreDocument` (class) - 1 example import violation(s)
- `schemastore/index.ts:51` `export { AnnotationCarriers, CarrierDepthExceededError } from "./AnnotationCarriers.ts";` (re-export) - 1 example import violation(s)
- `semver/Comparator.ts:43` `InvalidComparatorError` (class) - 1 example import violation(s)
- `semver/Comparator.ts:107` `Comparator` (class) - 1 example import violation(s)
- `semver/Range.ts:46` `InvalidRangeError` (class) - 1 example import violation(s)
- `semver/Range.ts:165` `Range` (class) - 1 example import violation(s)
- `semver/Range.ts:584` `UnsatisfiableConstraintError` (class) - 1 example import violation(s)
- `semver/SemVer.ts:68` `InvalidVersionError` (class) - 1 example import violation(s)
- `semver/SemVer.ts:175` `SemVer` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:45` `EmptyCacheError` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:109` `VersionNotFoundError` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:179` `UnsatisfiedRangeError` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:335` `VersionCache` (class) - 1 example import violation(s)
- `semver/VersionDiff.ts:66` `VersionDiff` (class) - 1 example import violation(s)
- `semver/index.ts:35` `export { Comparator, InvalidComparatorError } from "./Comparator.ts";` (re-export) - 1 example import violation(s)
- `semver/internal/grammar.ts:42` `ParseResult` (const) - 1 example import violation(s)
- `semver/internal/order.ts:72` `ComparatorOperator` (const) - 1 example import violation(s)
- `toml/Toml.ts:56` `TomlStringifyOptions` (class) - 1 example import violation(s)
- `toml/Toml.ts:87` `TomlParseError` (class) - 1 example import violation(s)
- `toml/Toml.ts:127` `TomlStringifyError` (class) - 1 example import violation(s)
- `toml/Toml.ts:270` `Toml` (class) - 1 example import violation(s)
- `toml/TomlDocument.ts:111` `TomlDocument` (class) - 1 example import violation(s)
- `toml/TomlEdit.ts:46` `TomlSegment` (const) - 1 example import violation(s)
- `toml/TomlFormat.ts:76` `TomlRangeLike` (const) - 1 example import violation(s)
- `toml/TomlFormat.ts:145` `TomlModificationError` (class) - 1 example import violation(s)
- `toml/TomlFormat.ts:936` `TomlFormat` (class) - 1 example import violation(s)
- `toml/TomlVisitor.ts:229` `TomlVisitor` (class) - 1 example import violation(s)
- `toml/internal/scanner.ts:47` `ScanResult` (const) - 1 example import violation(s)
- `toml/internal/scanner.ts:92` `ScalarValue` (const) - 1 example import violation(s)
- `yaml/Yaml.ts:74` `YamlParseOptions` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:152` `YamlStringifyOptions` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:257` `YamlParseError` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:322` `YamlStringifyError` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:639` `Yaml` (class) - 1 example import violation(s)
- `yaml/YamlDocument.ts:109` `YamlDocument` (class) - 1 example import violation(s)
- `yaml/YamlFormat.ts:141` `YamlModificationError` (class) - 1 example import violation(s)
- `yaml/YamlFormat.ts:609` `YamlFormat` (class) - 1 example import violation(s)
- `yaml/YamlLint.ts:594` `YamlStyleConflictError` (class) - 1 example import violation(s)
- `yaml/YamlLint.ts:843` `YamlLint` (class) - 1 example import violation(s)
- `yaml/YamlNode.ts:1131` `aliasExpansionLimit` (function) - 1 example import violation(s)
- `yaml/YamlNode.ts:1080` `AliasExpansionBudgetExceeded` (class) - 1 example import violation(s)
- `yaml/YamlNode.ts:1175` `nodeToJsValue` (const) - 1 example import violation(s)
- `yaml/YamlToken.ts:216` `YamlTokens` (class) - 1 example import violation(s)
- `yaml/YamlVisitor.ts:246` `YamlVisitor` (class) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:293` `buildAnchorMap` (function) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:57` `checkAnchorOnAlias` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:96` `makeAlias` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:150` `registerAnchor` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:182` `getAnchorName` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:214` `getAliasName` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:242` `scanName` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:345` `getNodeValue` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:115` `composeBlockMap` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:260` `flattenBlockMapChildren` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1501` `checkDuplicateKeys` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1627` `checkMultilineImplicitKeys` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1728` `checkTrailingContentOnSameLine` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1952` `composeBlockSeq` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:2336` `composeFlatBlockMap` (const) - 1 example import violation(s)
- `yaml/internal/composer/comments.ts:319` `blankAboveIsKeepChompContent` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:259` `composeDocument` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:991` `validateCrossDocumentDirectives` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:1152` `EMPTY_DOCUMENT` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:1189` `composeFirstDocument` (const) - 1 example import violation(s)
- `yaml/internal/composer/flow.ts:208` `composeFlowMap` (const) - 1 example import violation(s)
- `yaml/internal/composer/flow.ts:299` `flattenFlowChildren` (const) - 1 example import violation(s)
- `yaml/internal/composer/flow.ts:527` `composeFlowSeq` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:219` `getScalarStyle` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:249` `getBlockChomp` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:280` `getBlockIndent` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:476` `foldFlowLines` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1021` `blockMapStartsWithValueSep` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1150` `findFirstContent` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1176` `findLastContent` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:325` `getScalarValue` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:862` `findNextSignificantChild` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:900` `hasValueSepAfterInList` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:924` `hasBlockMapAfterInList` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:956` `findValueSepOffset` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:989` `hasValueSepBetween` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1056` `hasValueSepThroughPlainScalars` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1204` `findNextContentChild` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1240` `indexOfChild` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1266` `hasValueSepAfter` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1718` `shouldPreserveRaw` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:270` `hasMeta` (function) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:291` `clearMeta` (function) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:555` `exitNesting` (function) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:144` `sameLine` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:172` `hasNonWhitespaceBeforeOnLine` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:203` `lineIndentColumn` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:435` `createState` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:491` `MAX_NESTING_DEPTH` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:519` `enterNesting` (const) - 1 example import violation(s)
- `yaml/internal/composer/tags.ts:113` `parseDirective` (function) - 1 example import violation(s)
- `yaml/internal/composer/tags.ts:45` `resolveTagHandle` (const) - 1 example import violation(s)
- `yaml/internal/composer/tags.ts:154` `validateTagHandlesInDocument` (const) - 1 example import violation(s)
- `yaml/internal/cst-parser.ts:1104` `parseCSTAll` (function) - 1 example import violation(s)
- `yaml/internal/cst-visitor.ts:794` `cstEvents` (function) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:30` `YAML_LEX_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:63` `YAML_PARSE_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:101` `YAML_COMPOSE_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:140` `YAML_STRINGIFY_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:177` `YAML_MODIFY_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diff.ts:94` `computeEdits` (const) - 1 example import violation(s)
- `yaml/internal/fold.ts:199` `isControlChar` (function) - 1 example import violation(s)
- `yaml/internal/fold.ts:224` `hasInteriorTrailingWhitespace` (function) - 1 example import violation(s)
- `yaml/internal/fold.ts:267` `hasNewlineSpacesTab` (function) - 1 example import violation(s)
- `yaml/internal/fold.ts:61` `foldScalarLine` (const) - 1 example import violation(s)
- `yaml/internal/fold.ts:139` `foldRenderedScalar` (const) - 1 example import violation(s)
- `yaml/internal/fold.ts:308` `renderSingleQuotedMultiline` (const) - 1 example import violation(s)
- `yaml/internal/lexer.ts:118` `createScanner` (function) - 1 example import violation(s)
- `yaml/internal/lexer.ts:1514` `lexAll` (function) - 1 example import violation(s)
- `yaml/internal/rules/util.ts:220` `coveringToken` (const) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:439` `renderSingleQuoted` (function) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:73` `StringifyFailure` (class) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:121` `StringifyDepthExceeded` (class) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:369` `renderDoubleQuoted` (const) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:2014` `stringifyValue` (const) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:2056` `stringifyDocument` (const) - 1 example import violation(s)

### @beep/practice-kg-mcp

Path: `apps/practice-kg-mcp`

Export findings:
- `src/entrypoint.ts:27` `runEntrypoint` (const) - 1 example import violation(s)
- `src/runtime/Host.ts:51` `loadPracticeKgBundleContext` (const) - 1 example import violation(s)
- `src/runtime/Layer.ts:54` `makePracticeKgBuildLayer` (const) - 1 example import violation(s)

### @beep/tailscale

Path: `packages/drivers/tailscale`

Export findings:
- `src/Tailscale.service.ts:73` `parseTailscaleMagicDnsName` (const) - 1 example import violation(s)
- `src/Tailscale.service.ts:114` `parseTailscaleStatus` (const) - 1 example import violation(s)
- `src/Tailscale.service.ts:152` `readTailscaleStatus` (const) - 1 example import violation(s)

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

### @beep/acp

Path: `packages/drivers/acp`

Export findings:
- `src/AcpAgent.service.ts:221` `AcpAgent` (class) - 1 example import violation(s)
- `src/AcpClient.service.ts:291` `AcpClient` (class) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:52` `AcpUnknownExtRequestHandler` (type) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:73` `AcpUnknownExtNotificationHandler` (type) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:99` `AcpExtensionRegistrars` (interface) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:474` `makeAcpPatchedProtocol` (const) - 2 example import violation(s)

### @beep/infra

Path: `infra`

Module findings:
- `src/CiFleetController.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CiRunners.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CiFleetController.ts:595` `CiFleetControllerPulumiConfigValues` (const) - missing @example
- `src/CiFleetController.ts:631` `CiFleetControllerConfig` (class) - missing @example
- `src/CiFleetController.ts:663` `makeCiFleetControllerConfig` (const) - missing @example
- `src/CiFleetController.ts:687` `loadCiFleetControllerConfig` (const) - missing @example
- `src/OpenClaw.ts:398` `OpenClawExpectedIdentity` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:581` `OpenClawDeploymentConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:823` `OpenClawBackupConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:895` `OpenClawGeneration` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1249` `makeOpenClawGeneration` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1331` `renderOpenClawUnit` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1405` `renderOpenClawRunScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1507` `renderOpenClawGenerationTree` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1573` `renderOpenClawPreflightScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1704` `renderOpenClawStageScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1836` `renderOpenClawApplyScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1958` `renderOpenClawRollbackScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2109` `renderOpenClawDriftAuditScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2165` `renderOpenClawProbeScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2240` `renderOpenClawLiveAcceptanceScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2340` `renderOpenClawBackupShipScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2404` `OpenClawStackArgs` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2490` `makeOpenClawStackArgsFromConfigValues` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2693` `OpenClawStack` (class) - 1 documentation section/link violation(s)

### @beep/box-provisioning

Path: `packages/drivers/box-provisioning`

Export findings:
- `src/BoxProvisioning.ts:203` `BoxProvisioning` (class) - 1 example import violation(s)
- `src/BoxProvisioningErrors.ts:140` `BoxProvisioningDriftError` (class) - 1 example import violation(s)
- `src/BoxProvisioningIntent.ts:514` `BoxWebhookIntent` (class) - 1 example import violation(s)
- `src/BoxProvisioningObserved.ts:323` `BoxObservedWebhook` (class) - 1 example import violation(s)
- `src/BoxProvisioningPlan.ts:398` `BoxForeignResource` (class) - 1 example import violation(s)
- `src/BoxProvisioningPlanner.ts:760` `BoxProvisioningPlanner` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:337` `BoxActionApplied` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:366` `BoxActionSkipped` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:393` `BoxActionBlocked` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:451` `BoxApplyReceipt` (class) - 2 example import violation(s)

### @beep/freshbooks

Path: `packages/drivers/freshbooks`

Module findings:
- `src/Freshbooks.config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.token.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Freshbooks.config.ts:285` `FreshbooksConfigInput` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Freshbooks.errors.ts:73` `FreshbooksErrorReason` (const) - 1 documentation section/link violation(s)
- `src/Freshbooks.models.ts:566` `FreshbooksDecode` (const) - missing @example
- `src/Freshbooks.service.ts:86` `ResolvedFreshbooksConfig` (class) - 1 example import violation(s)
- `src/Freshbooks.service.ts:123` `resolveConfig` (const) - 1 example import violation(s)
- `src/Freshbooks.service.ts:317` `Freshbooks` (class) - 1 example import violation(s)
- `src/Freshbooks.service.ts:424` `makeFreshbooksAuthLayer` (const) - 1 example import violation(s)
- `src/Freshbooks.token.ts:74` `FreshbooksTokenResponse` (class) - 1 example import violation(s)
- `src/Freshbooks.token.ts:124` `FreshbooksStoredToken` (class) - 1 example import violation(s)
- `src/Freshbooks.token.ts:178` `FreshbooksTokenStore` (class) - 1 example import violation(s)
- `src/Freshbooks.token.ts:232` `FreshbooksTokenStoreShape` (type) - 1 example import violation(s)
- `src/Freshbooks.token.ts:257` `FreshbooksAuthShape` (type) - 1 example import violation(s)

### @beep/onepassword-cli

Path: `packages/drivers/onepassword-cli`

Export findings:
- `src/OnePasswordCli.models.ts:121` `OnePasswordCliDiagnosticText` (const) - 1 example import violation(s)
- `src/OnePasswordCli.service.ts:44` `OnePasswordCliRunner` (type) - 1 example import violation(s)

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
- `src/Server.ts:133` `makeServerLayer` (const) - 1 example import violation(s)
- `src/UsptoDocumentTiers.ts:189` `MintFetchableHandle` (const) - 1 example import violation(s)
- `src/UsptoDocumentTiers.ts:250` `ProjectDocumentsWithinBudgetOptions` (class) - 1 example import violation(s)
- `src/UsptoDocumentTiers.ts:304` `projectDocumentsWithinBudget` (const) - 1 example import violation(s)
- `src/UsptoHandlers.ts:102` `UsptoToolkitHandlersLive` (const) - 1 example import violation(s)

### @beep/pandoc-ast

Path: `packages/foundation/modeling/pandoc-ast`

Export findings:
- `src/Pandoc.codec.ts:256` `PandocDecodeError` (class) - 1 example import violation(s)
- `src/Pandoc.codec.ts:461` `PandocLosslessDocument` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:493` `PandocLosslessDocument` (type) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1309` `decodePandocJson` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1351` `decodePandocJsonString` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1851` `decodePandocJsonLossless` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1873` `decodePandocJsonStringLossless` (const) - 1 example import violation(s)
- `src/Pandoc.conformance.ts:238` `PandocConformanceResult` (const) - 1 example import violation(s)
- `src/Pandoc.conformance.ts:329` `inspectPandocConformance` (const) - 1 example import violation(s)
- `src/Pandoc.mapping.ts:74` `PandocMappingError` (class) - 1 example import violation(s)
- `src/Pandoc.model.ts:3316` `PandocTablePayload` (type) - 1 example import violation(s)
- `src/Pandoc.model.ts:3674` `PandocMetaValue` (namespace) - 1 example import violation(s)
- `src/Pandoc.model.ts:4228` `PandocMeta` (const) - 1 example import violation(s)
- `src/index.ts:22` `export * from "./Pandoc.codec.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:43` `export * from "./Pandoc.conformance.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:58` `export * from "./Pandoc.mapping.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export * from "./Pandoc.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:88` `export * from "./Pandoc.report.ts";` (re-export) - 1 example import violation(s)
