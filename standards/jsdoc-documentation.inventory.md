# JSDoc Documentation Compliance Inventory

Generated: 2026-10-09T21:20:53.983Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 146 |
| cleanPackages | 64 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 79 |
| publicModules | 2789 |
| publicExports | 19237 |
| openModules | 360 |
| openExports | 1317 |
| missingExportExamples | 8 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 1289 |
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
| no-root-package-import | 1268 |
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
| 4 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 8 | 239 | 2 | 199 |
| 5 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 29 | 216 | 6 | 101 |
| 6 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 16 |
| 7 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 167 | 941 | 13 | 20 |
| 8 | `@beep/pglite` | `packages/drivers/pglite` | needs-remediation | 4 | 11 | 3 | 0 |
| 9 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 17 | 51 | 1 | 0 |
| 10 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 16 | 546 | 9 | 28 |
| 11 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 104 | 367 | 3 | 5 |
| 12 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 10 | 263 | 4 | 87 |
| 13 | `@beep/rdf` | `packages/foundation/modeling/rdf` | needs-remediation | 29 | 266 | 1 | 5 |
| 14 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 30 | 58 | 0 | 0 |
| 15 | `@beep/provenance` | `packages/foundation/modeling/provenance` | needs-remediation | 4 | 28 | 1 | 0 |
| 16 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | needs-remediation | 8 | 56 | 0 | 11 |
| 17 | `@beep/agents-domain` | `packages/agents/domain` | clean | 16 | 75 | 0 | 0 |
| 18 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 46 | 1 | 0 |
| 19 | `@beep/shared-use-cases` | `packages/shared/use-cases` | clean | 6 | 15 | 0 | 0 |
| 20 | `@beep/colors` | `packages/foundation/capability/colors` | needs-remediation | 1 | 9 | 1 | 9 |
| 21 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 313 | 9 | 9 |
| 22 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | clean | 30 | 159 | 0 | 0 |
| 23 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 57 | 255 | 8 | 2 |
| 24 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 12 | 113 | 8 | 53 |
| 25 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 41 | 0 | 0 |
| 26 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 27 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 128 | 2 | 2 |
| 28 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 25 | 166 | 8 | 97 |
| 29 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 224 | 775 | 9 | 5 |
| 30 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 26 | 126 | 0 | 0 |
| 31 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 33 | 139 | 11 | 0 |
| 32 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | needs-remediation | 4 | 11 | 2 | 7 |
| 33 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 21 | 3 | 0 |
| 34 | `@beep/postgres` | `packages/drivers/postgres` | needs-remediation | 7 | 43 | 0 | 1 |
| 35 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 34 | 99 | 4 | 0 |
| 36 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 0 |
| 37 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 214 | 1 | 3 |
| 38 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 6 | 22 | 0 | 0 |
| 39 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 5 |
| 40 | `@beep/documents-domain` | `packages/documents/domain` | clean | 26 | 82 | 0 | 0 |
| 41 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 48 | 0 | 0 |
| 42 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 26 | 0 | 0 |
| 43 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 34 | 89 | 1 | 0 |
| 44 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 56 | 433 | 4 | 1 |
| 45 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 34 | 3 | 4 |
| 46 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 43 | 4 | 3 |
| 47 | `@beep/box` | `packages/drivers/box` | needs-remediation | 7 | 877 | 0 | 2 |
| 48 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 24 | 53 | 8 | 4 |
| 49 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 6 | 28 | 0 | 0 |
| 50 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 6 | 134 | 2 | 0 |
| 51 | `@beep/codegen-kit` | `packages/tooling/library/codegen-kit` | clean | 5 | 37 | 0 | 0 |
| 52 | `@beep/chalk` | `packages/foundation/capability/chalk` | needs-remediation | 1 | 35 | 1 | 35 |
| 53 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 64 | 678 | 18 | 0 |
| 54 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 50 | 0 | 0 |
| 55 | `@beep/technical-drawing` | `packages/foundation/capability/technical-drawing` | needs-remediation | 15 | 113 | 0 | 98 |
| 56 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 5 | 111 | 0 | 0 |
| 57 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 312 | 13 | 0 |
| 58 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 59 | `@beep/epistemic-client` | `packages/epistemic/client` | clean | 4 | 25 | 0 | 0 |
| 60 | `@beep/ui` | `packages/foundation/ui-system/ui` | needs-remediation | 134 | 557 | 1 | 1 |
| 61 | `@beep/dock` | `packages/foundation/ui-system/dock` | needs-remediation | 20 | 212 | 0 | 189 |
| 62 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 7 | 44 | 3 | 0 |
| 63 | `@beep/agents-tables` | `packages/agents/tables` | clean | 7 | 16 | 0 | 0 |
| 64 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 6 | 32 | 0 | 0 |
| 65 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 7 | 126 | 4 | 7 |
| 66 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 67 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 19 | 1 | 0 |
| 68 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 69 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 70 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 23 | 56 | 0 | 0 |
| 71 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 12 | 0 | 0 |
| 72 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 93 | 0 | 0 |
| 73 | `@beep/documents-tables` | `packages/documents/tables` | clean | 19 | 48 | 0 | 0 |
| 74 | `@beep/documents-use-cases` | `packages/documents/use-cases` | clean | 23 | 120 | 0 | 0 |
| 75 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 76 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 77 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 64 | 0 | 0 |
| 78 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 57 | 310 | 1 | 1 |
| 79 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 6 | 139 | 2 | 0 |
| 80 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 86 | 2 | 2 |
| 81 | `@beep/poppler` | `packages/drivers/poppler` | clean | 3 | 10 | 0 | 0 |
| 82 | `@beep/face-detection` | `packages/drivers/face-detection` | clean | 4 | 34 | 0 | 0 |
| 83 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 10 | 86 | 0 | 3 |
| 84 | `@beep/skill-contract` | `packages/foundation/modeling/skill-contract` | needs-remediation | 9 | 113 | 0 | 79 |
| 85 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 0 |
| 86 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 30 | 521 | 0 | 2 |
| 87 | `@beep/pdf-tools` | `packages/drivers/pdf-tools` | clean | 4 | 25 | 0 | 0 |
| 88 | `@beep/firecrawl` | `packages/drivers/firecrawl` | clean | 5 | 267 | 0 | 0 |
| 89 | `@beep/runpod` | `packages/drivers/runpod` | clean | 7 | 203 | 0 | 0 |
| 90 | `@beep/tesseract` | `packages/drivers/tesseract` | clean | 3 | 16 | 0 | 0 |
| 91 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 0 |
| 92 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 28 | 188 | 0 | 1 |
| 93 | `@beep/occt` | `packages/drivers/occt` | clean | 4 | 13 | 0 | 0 |
| 94 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 0 |
| 95 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 73 | 1 | 0 |
| 96 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 89 | 12 | 0 |
| 97 | `@beep/venice-ai` | `packages/drivers/venice-ai` | needs-remediation | 3 | 35 | 0 | 1 |
| 98 | `@beep/xai` | `packages/drivers/xai` | clean | 7 | 70 | 0 | 0 |
| 99 | `@beep/openai` | `packages/drivers/openai` | clean | 4 | 17 | 0 | 0 |
| 100 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 101 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |
| 102 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 6 | 15 | 0 | 0 |
| 103 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 0 |
| 104 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 10 | 110 | 5 | 54 |
| 105 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | needs-remediation | 3 | 12 | 0 | 10 |
| 106 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 3 | 11 | 0 | 0 |
| 107 | `@beep/brand` | `packages/foundation/ui-system/brand` | needs-remediation | 7 | 50 | 0 | 43 |
| 108 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 39 | 2 | 0 |
| 109 | `@beep/editor` | `packages/foundation/ui-system/editor` | needs-remediation | 36 | 212 | 13 | 3 |
| 110 | `@beep/ontology-server` | `packages/ontology/server` | clean | 8 | 24 | 0 | 0 |
| 111 | `@beep/xstate` | `packages/drivers/xstate` | clean | 6 | 26 | 0 | 0 |
| 112 | `@beep/workspace-server` | `packages/workspace/server` | clean | 12 | 32 | 0 | 0 |
| 113 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 28 | 0 | 0 |
| 114 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 103 | 2 | 0 |
| 115 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 15 |
| 116 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 117 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 118 | `@beep/practice-mail-tagging` | `apps/practice-mail-tagging` | clean | 8 | 44 | 0 | 0 |
| 119 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 13 | 46 | 2 | 0 |
| 120 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 121 | `@beep/docket-intake` | `apps/docket-intake` | clean | 10 | 27 | 0 | 0 |
| 122 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 40 | 6 | 0 |
| 123 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 7 | 0 | 0 |
| 124 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 354 | 2981 | 47 | 23 |
| 125 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 87 | 0 | 0 |
| 126 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 1 |
| 127 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 9 | 32 | 1 | 0 |
| 128 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 13 | 109 | 0 | 3 |
| 129 | `@beep/oip-web` | `apps/oip-web` | clean | 31 | 86 | 0 | 0 |
| 130 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 131 | `@beep/shared-tables` | `packages/shared/tables` | clean | 9 | 12 | 0 | 0 |
| 132 | `@beep/scratchpad` | `scratchpad` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 133 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | clean | 10 | 23 | 0 | 0 |
| 134 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 135 | `@beep/todox` | `apps/todox` | clean | 16 | 57 | 0 | 0 |
| 136 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 64 | 232 | 25 | 0 |
| 137 | `@beep/acp` | `packages/drivers/acp` | clean | 11 | 417 | 0 | 0 |
| 138 | `@beep/practice-identify` | `apps/practice-identify` | clean | 3 | 10 | 0 | 0 |
| 139 | `@beep/infra` | `infra` | needs-remediation | 11 | 105 | 3 | 23 |
| 140 | `@beep/box-provisioning` | `packages/drivers/box-provisioning` | needs-remediation | 15 | 184 | 0 | 21 |
| 141 | `@beep/freshbooks` | `packages/drivers/freshbooks` | needs-remediation | 6 | 49 | 5 | 3 |
| 142 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 143 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 32 | 7 | 3 |
| 144 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 145 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 146 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | needs-remediation | 7 | 204 | 0 | 5 |

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
- `src/Curie.ts:112` `expandOption` (const) - 1 example import violation(s)
- `src/Curie.ts:165` `contractOption` (const) - 1 example import violation(s)
- `src/Curie.ts:264` `expand` (const) - 1 example import violation(s)
- `src/Curie.ts:312` `contract` (const) - 1 example import violation(s)
- `src/Curie.ts:368` `expandPredicate` (const) - 1 example import violation(s)
- `src/Curie.ts:388` `makeCurieCodec` (const) - 1 example import violation(s)
- `src/Curie.ts:408` `CoreCurieCodec` (const) - 1 example import violation(s)
- `src/Curie.ts:426` `makeCurieFromIri` (const) - 1 example import violation(s)
- `src/Curie.ts:450` `CurieFromIri` (const) - 1 example import violation(s)
- `src/Fibered.ts:220` `Fibered` (const) - 1 example import violation(s)
- `src/Id.ts:144` `IdentityInterpolationError` (class) - 1 example import violation(s)
- `src/Id.ts:177` `IdentitySegmentCountError` (class) - 1 example import violation(s)
- `src/Id.ts:211` `VERSION` (const) - 1 example import violation(s)
- `src/Id.ts:233` `SegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:369` `TitleFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:394` `IriFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:423` `CurieFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:453` `SlugFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:496` `ModuleSegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:517` `ModuleAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:538` `TaggedAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:557` `IdentityString` (type) - 2 example import violation(s)
- `src/Id.ts:578` `IdentitySymbol` (type) - 2 example import violation(s)
- `src/Id.ts:601` `SchemaAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:627` `DeclarationAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:662` `ErrorAnnotationRecord` (interface) - 1 example import violation(s)
- `src/Id.ts:684` `KeyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:707` `SkosClassification` (type) - 1 example import violation(s)
- `src/Id.ts:730` `OntologyKeyOptions` (type) - 1 example import violation(s)
- `src/Id.ts:761` `OntologyClassExtras` (type) - 1 example import violation(s)
- `src/Id.ts:795` `HttpAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:821` `IdentityAnyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:847` `IdentityAnnotation` (type) - 1 example import violation(s)
- `src/Id.ts:902` `IdentityAnnotationResult` (type) - 1 example import violation(s)
- `src/Id.ts:936` `AnnotatedSchema` (type) - 1 example import violation(s)
- `src/Id.ts:953` `TaggedModuleRecord` (type) - 1 example import violation(s)
- `src/Id.ts:1016` `IdentityComposer` (interface) - 1 example import violation(s)
- `src/Id.ts:1625` `BaseIdentityInput` (const) - 1 example import violation(s)
- `src/Id.ts:1654` `BaseIdentityInput` (type) - 1 example import violation(s)
- `src/Id.ts:2167` `make` (const) - 2 example import violation(s)
- `src/IdentityRegistry.ts:34` `IdentityEncoding` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:66` `IdentityRef` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:104` `IdentityEntry` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:181` `IdentityNotFoundError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:209` `IdentityRegistryConflictError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:250` `IdentityRegistry` (class) - 1 example import violation(s)
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
- `src/packages.ts:333` `$DataId` (const) - 1 example import violation(s)
- `src/packages.ts:349` `$IdentityId` (const) - 1 example import violation(s)
- `src/packages.ts:365` `$SchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:381` `$ProvenanceId` (const) - 1 example import violation(s)
- `src/packages.ts:397` `$RdfId` (const) - 1 example import violation(s)
- `src/packages.ts:445` `$TypesId` (const) - 1 example import violation(s)
- `src/packages.ts:461` `$UtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:479` `$UiId` (const) - 1 example import violation(s)
- `src/packages.ts:497` `$RepoAiMetricsId` (const) - 1 example import violation(s)
- `src/packages.ts:513` `$RepoCliId` (const) - 1 example import violation(s)
- `src/packages.ts:529` `$RepoConfigsId` (const) - 1 example import violation(s)
- `src/packages.ts:545` `$RepoUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:561` `$TestUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:579` `$SharedDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:612` `$SharedTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:628` `$SemanticWebId` (const) - 1 example import violation(s)
- `src/packages.ts:644` `$NlpId` (const) - 1 example import violation(s)
- `src/packages.ts:676` `$LangExtractId` (const) - 1 example import violation(s)
- `src/packages.ts:692` `$ObservabilityId` (const) - 1 example import violation(s)
- `src/packages.ts:708` `$ColorsId` (const) - 1 example import violation(s)
- `src/packages.ts:724` `$ChalkId` (const) - 1 example import violation(s)
- `src/packages.ts:740` `$RepoDocgenId` (const) - 1 example import violation(s)
- `src/packages.ts:756` `$InfraId` (const) - 1 example import violation(s)
- `src/packages.ts:774` `$WorkspaceDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:790` `$EpistemicDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:807` `$EpistemicUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:824` `$AgentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:840` `$AgentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:856` `$AgentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:872` `$AgentsClientId` (const) - 1 example import violation(s)
- `src/packages.ts:888` `$LawPracticeDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:906` `$LawPracticeUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:924` `$LawPracticeServerId` (const) - 1 example import violation(s)
- `src/packages.ts:941` `$ProfessionalDesktopId` (const) - 1 example import violation(s)
- `src/packages.ts:1087` `$AnthropicId` (const) - 1 example import violation(s)
- `src/packages.ts:1136` `$AcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1153` `$OpenaiCompatId` (const) - 1 example import violation(s)
- `src/packages.ts:1170` `$WorkspaceTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1187` `$WorkspaceUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1205` `$WorkspaceServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1222` `$DocumentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1239` `$DocumentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1257` `$DocumentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1274` `$ArchitectureLabDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1292` `$ArchitectureLabUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1310` `$ArchitectureLabConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:1328` `$ArchitectureLabServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1346` `$ArchitectureLabTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1364` `$ArchitectureLabClientId` (const) - 1 example import violation(s)
- `src/packages.ts:1382` `$ArchitectureLabUiId` (const) - 1 example import violation(s)
- `src/packages.ts:1400` `$ArchitectureLabProofId` (const) - 1 example import violation(s)
- `src/packages.ts:1418` `$RunpodId` (const) - 1 example import violation(s)
- `src/packages.ts:1435` `$OnepasswordCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1452` `$DiscordId` (const) - 1 example import violation(s)
- `src/packages.ts:1469` `$AiProviderCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1486` `$SanityId` (const) - 1 example import violation(s)
- `src/packages.ts:1503` `$HubspotId` (const) - 1 example import violation(s)
- `src/packages.ts:1520` `$PhoenixId` (const) - 1 example import violation(s)
- `src/packages.ts:1537` `$AiSyncId` (const) - 1 example import violation(s)
- `src/packages.ts:1554` `$BoxId` (const) - 1 example import violation(s)
- `src/packages.ts:1571` `$NlpMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1605` `$WinkId` (const) - 1 example import violation(s)
- `src/packages.ts:1622` `$FileProcessingId` (const) - 1 example import violation(s)
- `src/packages.ts:1639` `$TikaId` (const) - 1 example import violation(s)
- `src/packages.ts:1656` `$LibpffId` (const) - 1 example import violation(s)
- `src/packages.ts:1673` `$FirecrawlId` (const) - 1 example import violation(s)
- `src/packages.ts:1690` `$UsptoId` (const) - 1 example import violation(s)
- `src/packages.ts:1707` `$LexicalSchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:1724` `$EditorId` (const) - 1 example import violation(s)
- `src/packages.ts:1741` `$ScratchpadId` (const) - 1 example import violation(s)
- `src/packages.ts:1758` `$HtmlId` (const) - 1 example import violation(s)
- `src/packages.ts:1775` `$PandocAstId` (const) - 1 example import violation(s)
- `src/packages.ts:1792` `$PgliteId` (const) - 1 example import violation(s)
- `src/packages.ts:1809` `$M365Id` (const) - 1 example import violation(s)
- `src/packages.ts:1826` `$M365McpId` (const) - 1 example import violation(s)
- `src/packages.ts:1843` `$GovinfoId` (const) - 1 example import violation(s)
- `src/packages.ts:1860` `$EcfrId` (const) - 1 example import violation(s)
- `src/packages.ts:1877` `$ApiTransportId` (const) - 1 example import violation(s)
- `src/packages.ts:1894` `$McpKitId` (const) - 1 example import violation(s)
- `src/packages.ts:1911` `$UsptoMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1928` `$PacerId` (const) - 1 example import violation(s)
- `src/packages.ts:1945` `$FcRunsId` (const) - 1 example import violation(s)
- `src/packages.ts:1962` `$CosmosId` (const) - 1 example import violation(s)
- `src/packages.ts:1979` `$DbAdminId` (const) - 1 example import violation(s)
- `src/packages.ts:1996` `$EpistemicServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2013` `$EpistemicTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2030` `$LintRulesId` (const) - 1 example import violation(s)
- `src/packages.ts:2047` `$N3Id` (const) - 1 example import violation(s)
- `src/packages.ts:2064` `$PretextId` (const) - 1 example import violation(s)
- `src/packages.ts:2081` `$Graph3dId` (const) - 1 example import violation(s)
- `src/packages.ts:2098` `$DockId` (const) - 1 example import violation(s)
- `src/packages.ts:2115` `$DockReactId` (const) - 1 example import violation(s)
- `src/packages.ts:2132` `$OntologyClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2149` `$OntologyConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2166` `$OntologyDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:2183` `$OntologyServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2200` `$OntologyUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2217` `$OntologyUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:2234` `$OxigraphId` (const) - 1 example import violation(s)
- `src/packages.ts:2251` `$ShaclId` (const) - 1 example import violation(s)
- `src/packages.ts:2268` `$StorybookId` (const) - 1 example import violation(s)
- `src/packages.ts:2285` `$TsgoShimId` (const) - 1 example import violation(s)
- `src/packages.ts:2302` `$DocTextId` (const) - 1 example import violation(s)
- `src/packages.ts:2319` `$DocumentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2336` `$TailscaleId` (const) - 1 example import violation(s)
- `src/packages.ts:2353` `$AgentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2370` `$EpistemicConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2387` `$LawPracticeTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2405` `$PracticeKgMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2422` `$OpenclawId` (const) - 1 example import violation(s)
- `src/packages.ts:2439` `$ObsId` (const) - 1 example import violation(s)
- `src/packages.ts:2456` `$ExiftoolId` (const) - 1 example import violation(s)
- `src/packages.ts:2473` `$QaCaptureId` (const) - 1 example import violation(s)
- `src/packages.ts:2490` `$GovLegalMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2506` `$EpistemicClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2522` `$EpistemicUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2555` `$SkillContractId` (const) - 1 example import violation(s)
- `src/packages.ts:2572` `$CodegenKitId` (const) - 1 example import violation(s)
- `src/packages.ts:2589` `$BrandId` (const) - 1 example import violation(s)
- `src/packages.ts:2606` `$OpenaiId` (const) - 1 example import violation(s)
- `src/packages.ts:2623` `$TodoxId` (const) - 1 example import violation(s)
- `src/packages.ts:2640` `$BoxProvisioningId` (const) - 1 example import violation(s)

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
- `src/Array.ts:138` `mapNonEmpty` (const) - 1 example import violation(s)
- `src/Array.ts:177` `flatMapNonEmpty` (const) - 1 example import violation(s)
- `src/Array.ts:218` `mapNonEmptyReadonly` (const) - 1 example import violation(s)
- `src/Array.ts:263` `flatMapNonEmptyReadonly` (const) - 1 example import violation(s)
- `src/Array.ts:324` `indexOf` (const) - 1 example import violation(s)
- `src/Array.ts:356` `lastIndexOf` (const) - 1 example import violation(s)
- `src/Array.ts:386` `slice` (const) - 1 example import violation(s)
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
- `src/Equal.ts:22` `export * from "effect/Equal";` (re-export) - 1 example import violation(s)
- `src/Errors.ts:166` `mapToError` (function) - 1 example import violation(s)
- `src/Errors.ts:45` `ErrorMapper` (type) - 1 example import violation(s)
- `src/Errors.ts:99` `mapCauseError` (const) - 1 example import violation(s)
- `src/GlobalValue.ts:73` `globalValue` (const) - 1 example import violation(s)
- `src/Number.ts:43` `isPositive` (const) - 1 documentation section/link violation(s)
- `src/Number.ts:87` `isInteger` (const) - 1 example import violation(s)
- `src/Option.ts:63` `propFromNullishOr` (const) - 1 example import violation(s)
- `src/Option.ts:112` `getSomesStruct` (const) - 1 example import violation(s)
- `src/Predicate.ts:207` `chainRefinements` (function) - 1 example import violation(s)
- `src/Predicate.ts:156` `hasInspectableObjectShape` (const) - 1 example import violation(s)
- `src/Str.ts:824` `export * from "effect/String";` (re-export) - 1 example import violation(s)
- `src/Str.ts:294` `mapPrefix` (function) - 1 example import violation(s)
- `src/Str.ts:339` `mapPostfix` (function) - 1 example import violation(s)
- `src/Str.ts:41` `equivalence` (const) - 1 example import violation(s)
- `src/Str.ts:71` `orderAsc` (const) - 1 example import violation(s)
- `src/Str.ts:118` `prefix` (const) - 1 example import violation(s)
- `src/Str.ts:159` `prefixThunk` (const) - 1 example import violation(s)
- `src/Str.ts:212` `postfix` (const) - 1 example import violation(s)
- `src/Str.ts:253` `postfixThunk` (const) - 1 example import violation(s)
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
- `src/Str.ts:584` `startsWith` (const) - 1 example import violation(s)
- `src/Str.ts:624` `endsWith` (const) - 1 example import violation(s)
- `src/Str.ts:669` `contains` (const) - 1 example import violation(s)
- `src/Str.ts:713` `repeat` (const) - 1 example import violation(s)
- `src/Str.ts:748` `replaceWith` (const) - 1 example import violation(s)
- `src/Str.ts:791` `replaceAllWith` (const) - 1 example import violation(s)
- `src/Str.ts:844` `trimThunk` (const) - 1 example import violation(s)
- `src/Str.ts:864` `fromNumber` (const) - 1 example import violation(s)
- `src/Str.ts:881` `toSlug` (const) - 1 example import violation(s)
- `src/Str.ts:919` `truncate` (const) - 1 example import violation(s)
- `src/Str.ts:945` `orEmpty` (const) - 1 example import violation(s)
- `src/Str.ts:993` `matchEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:173` `dotGet` (const) - 1 example import violation(s)
- `src/Struct.ts:220` `dotGetOption` (const) - 1 example import violation(s)
- `src/Struct.ts:287` `mapPath` (const) - 1 example import violation(s)
- `src/Struct.ts:365` `mapPathLazy` (const) - 1 example import violation(s)
- `src/Struct.ts:447` `getLazy` (const) - 1 example import violation(s)
- `src/Struct.ts:482` `pathsOf` (const) - 1 example import violation(s)
- `src/Struct.ts:602` `entriesNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:633` `keys` (const) - 1 example import violation(s)
- `src/Struct.ts:659` `keysNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:694` `fromEntries` (const) - 1 example import violation(s)
- `src/Struct.ts:802` `reverse` (const) - 1 example import violation(s)
- `src/Struct.ts:924` `deepMerge` (const) - 1 example import violation(s)
- `src/Text.ts:33` `splitCommaSeparatedTrimmed` (const) - 1 example import violation(s)
- `src/Text.ts:61` `formatNameWithAliases` (const) - 1 example import violation(s)
- `src/Text.ts:93` `joinLines` (const) - 1 example import violation(s)
- `src/index.ts:30` `export * as A from "./Array.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:45` `export * as Bool from "./Bool.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:63` `export * as Data from "./Data.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:78` `export * as DateTime from "./DateTime.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:106` `export * as Eq from "./Equal.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:133` `export * as Err from "./Errors.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:151` `export * as FileSystem from "./FileSystem.ts";` (re-export) - 1 example import violation(s)
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
- `src/UnitInterval.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Email.ts:33` `EmailString` (const) - 1 example import violation(s)
- `src/Email.ts:52` `EmailString` (type) - 2 example import violation(s)
- `src/Email.ts:76` `Email` (const) - 1 example import violation(s)
- `src/Email.ts:96` `Email` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:67` `Added` (class) - 1 example import violation(s)
- `src/FileDiff.schema.ts:101` `Deleted` (class) - 1 example import violation(s)
- `src/FileDiff.schema.ts:136` `Modified` (class) - 1 example import violation(s)
- `src/FileDiff.schema.ts:170` `Info` (const) - 1 example import violation(s)
- `src/FileDiff.schema.ts:192` `Info` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:210` `Info` (namespace) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:528` `ThunkOf` (function) - 3 example import violation(s)
- `src/Fn/Fn.schema.ts:598` `Fn` (function) - 5 example import violation(s)
- `src/Fn/Fn.schema.ts:481` `AnyFn` (const) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:503` `AnyFn` (type) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:93` `BlockedHostError` (class) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:281` `isBlockedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:326` `assertAllowedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:391` `assertAllowedRemoteUrl` (const) - 1 example import violation(s)
- `src/SemanticVersion.ts:53` `SemanticVersionSchema` (interface) - 1 documentation section/link violation(s)
- `src/index.ts:194` `export * from "./Port.ts";` (re-export) - 1 example import violation(s)

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
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/Html.conformance.ts:220` `ConformantHtmlNode` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:43` `InputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:128` `resolveInputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:157` `inputStateAllowedAttributes` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:231` `ButtonState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:303` `resolveButtonState` (const) - 1 example import violation(s)
- `src/Html.meta.ts:604` `HTML_GLOBAL_ATTRIBUTE_NAMES` (const) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:502` `SafeHtmlAst` (const) - 1 example import violation(s)
- `src/Html.policy.ts:527` `SafeHtmlAst` (type) - 1 example import violation(s)
- `src/Html.policy.ts:549` `SafeHtmlNode` (const) - 1 example import violation(s)
- `src/Html.policy.ts:804` `inspectSafeHtml` (const) - 1 example import violation(s)
- `src/Html.policy.ts:833` `enforceSafeHtml` (const) - 1 example import violation(s)
- `src/Html.policy.ts:859` `safeHtmlAstConformant` (const) - 1 example import violation(s)
- `src/Html.policy.ts:887` `safeHtmlAstRoot` (const) - 1 example import violation(s)
- `src/Html.script.ts:44` `HtmlMimeType` (const) - 1 example import violation(s)
- `src/Html.script.ts:84` `JavaScriptMimeTypeEssence` (const) - 1 example import violation(s)
- `src/Html.script.ts:138` `ScriptDataBlockMimeType` (const) - 1 example import violation(s)
- `src/Html.script.ts:191` `ScriptState` (const) - 1 example import violation(s)
- `src/Html.script.ts:232` `InvalidScriptType` (class) - 1 example import violation(s)
- `src/Html.script.ts:287` `resolveScriptState` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:147` `SafeHtml` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:180` `SafeHtml` (type) - 1 example import violation(s)
- `src/Html.serialize.ts:611` `serialize` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:636` `serializeConformant` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:685` `serializeSafe` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:706` `untrustedHtmlValue` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:739` `safeHtmlValue` (const) - 1 example import violation(s)
- `src/Html.source-size.ts:829` `inspectSourceSizeList` (const) - 1 documentation section/link violation(s)

### @beep/shared-domain

Path: `packages/shared/domain`

Module findings:
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entity/Principal.ts:253` `PrincipalSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/SourceKind.ts:32` `SourceKindSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/primitives.ts:64` `Sha256` (const) - 1 example import violation(s)
- `src/identity/index.ts:84` `isIdentityComposer` (const) - 1 example import violation(s)
- `src/identity/index.ts:119` `AnyIdentityComposer` (const) - 1 example import violation(s)

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
- `src/Md.conformance.ts:381` `refineStrictMarkdownDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:465` `inspectMarkdownSpecificationConformance` (const) - 1 example import violation(s)
- `src/Md.escape.ts:712` `maxBackticks` (const) - 1 example import violation(s)
- `src/Md.escape.ts:777` `renderFencedCode` (const) - 1 example import violation(s)
- `src/Md.html.ts:42` `renderSafeHtml` (const) - 1 example import violation(s)
- `src/Md.render.ts:599` `renderMarkdownInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:658` `renderHtmlInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:677` `renderMarkdownBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:730` `renderHtmlBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:765` `renderMarkdownBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:785` `renderHtmlBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:810` `renderUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:831` `renderHtmlUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:852` `renderPlainTextUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:897` `renderWithUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:932` `renderEffectWithUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:974` `renderEffectWith` (const) - 1 example import violation(s)
- `src/Md.render.ts:1378` `makeMarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1404` `makeHtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1428` `MarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1452` `HtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1471` `PlainTextAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1498` `renderWith` (const) - 1 example import violation(s)
- `src/Md.render.ts:1532` `render` (const) - 1 example import violation(s)
- `src/Md.render.ts:1557` `renderHtml` (const) - 1 example import violation(s)
- `src/Md.render.ts:1582` `renderPlainText` (const) - 1 example import violation(s)
- `src/Md.safe.ts:745` `documentSafetyIssues` (const) - 1 example import violation(s)
- `src/Md.safe.ts:771` `inlineSafetyIssuesAtRoot` (const) - 1 example import violation(s)
- `src/Md.safe.ts:962` `refineSafeDocument` (const) - 1 example import violation(s)
- `src/Md.ts:124` `InlineContent` (type) - 1 example import violation(s)
- `src/Md.ts:180` `BlockContent` (type) - 1 example import violation(s)
- `src/Md.ts:203` `BlockTemplateValue` (type) - 1 example import violation(s)
- `src/Md.ts:242` `ListItemChildInput` (type) - 1 example import violation(s)
- `src/Md.ts:260` `ListItemContent` (type) - 1 example import violation(s)
- `src/Md.ts:299` `ListItemInput` (type) - 1 example import violation(s)
- `src/Md.ts:334` `TableRowInput` (type) - 1 example import violation(s)
- `src/Md.ts:544` `text` (const) - 1 example import violation(s)
- `src/Md.ts:561` `rawMarkdown` (const) - 1 example import violation(s)
- `src/Md.ts:582` `rawHtml` (const) - 1 example import violation(s)
- `src/Md.ts:599` `strong` (const) - 1 example import violation(s)
- `src/Md.ts:616` `em` (const) - 1 example import violation(s)
- `src/Md.ts:633` `del` (const) - 1 example import violation(s)
- `src/Md.ts:650` `code` (const) - 1 example import violation(s)
- `src/Md.ts:667` `a` (const) - 1 example import violation(s)
- `src/Md.ts:696` `img` (const) - 1 example import violation(s)
- `src/Md.ts:719` `br` (const) - 1 example import violation(s)
- `src/Md.ts:736` `inlineMath` (const) - 1 example import violation(s)
- `src/Md.ts:753` `footnoteRef` (const) - 1 example import violation(s)
- `src/Md.ts:771` `h1` (const) - 1 example import violation(s)
- `src/Md.ts:788` `h2` (const) - 1 example import violation(s)
- `src/Md.ts:805` `h3` (const) - 1 example import violation(s)
- `src/Md.ts:822` `h4` (const) - 1 example import violation(s)
- `src/Md.ts:839` `h5` (const) - 1 example import violation(s)
- `src/Md.ts:856` `h6` (const) - 1 example import violation(s)
- `src/Md.ts:873` `p` (const) - 1 example import violation(s)
- `src/Md.ts:890` `li` (const) - 1 example import violation(s)
- `src/Md.ts:907` `ul` (const) - 1 example import violation(s)
- `src/Md.ts:924` `ol` (const) - 1 example import violation(s)
- `src/Md.ts:953` `taskItem` (const) - 1 example import violation(s)
- `src/Md.ts:983` `taskListFromItems` (const) - 1 example import violation(s)
- `src/Md.ts:1000` `blockquote` (const) - 1 example import violation(s)
- `src/Md.ts:1017` `pre` (const) - 1 example import violation(s)
- `src/Md.ts:1041` `tableCell` (const) - 1 example import violation(s)
- `src/Md.ts:1058` `tableRow` (const) - 1 example import violation(s)
- `src/Md.ts:1076` `table` (const) - 1 example import violation(s)
- `src/Md.ts:1113` `mathBlock` (const) - 1 example import violation(s)
- `src/Md.ts:1130` `footnoteDef` (const) - 1 example import violation(s)
- `src/Md.ts:1154` `admonition` (const) - 1 example import violation(s)
- `src/Md.ts:1178` `embed` (const) - 1 example import violation(s)
- `src/Md.ts:1225` `youtube` (const) - 1 example import violation(s)
- `src/Md.ts:1244` `youtubeEffect` (const) - 1 example import violation(s)
- `src/Md.ts:1267` `youtubeUnsafe` (const) - 1 example import violation(s)
- `src/Md.ts:1283` `hr` (const) - 1 example import violation(s)
- `src/Md.ts:1300` `make` (const) - 1 example import violation(s)
- `src/Md.ts:1333` `Md` (const) - 1 example import violation(s)
- `src/index.ts:23` `export * from "./Md.behavior.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:39` `export * from "./Md.conformance.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:54` `export * from "./Md.escape.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:70` `export * from "./Md.html.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:85` `export * from "./Md.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:100` `export * from "./Md.render.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:115` `export * from "./Md.safe.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:131` `export * from "./Md.ts";` (re-export) - 1 example import violation(s)

### @beep/rdf

Path: `packages/foundation/modeling/rdf`

Module findings:
- `src/Vocab/Dcterms.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `src/Iri.ts:870` `IRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:911` `RelativeIRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:951` `AbsoluteIRI` (const) - 1 example import violation(s)
- `src/Iri.ts:992` `IRI` (const) - 1 example import violation(s)
- `src/Vocab/Xsd.ts:27` `XSD_NAMESPACE` (const) - 1 documentation section/link violation(s)

### @beep/provenance

Path: `packages/foundation/modeling/provenance`

Module findings:
- `src/TextAnchor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/semantic-web

Path: `packages/foundation/capability/semantic-web`

Export findings:
- `src/identity/IdentityRdfBinding.ts:99` `IdentityRdfBinding` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:142` `DefaultIdentityRdfBinding` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:163` `IdentityFiberPathError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:189` `IdentityEntryIriError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:215` `IdentityDatasetDecodeError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:256` `decodeEntrySubject` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:440` `entriesToDataset` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:494` `datasetToEntries` (const) - 1 example import violation(s)
- `src/identity/IdentityRegistryDataset.ts:43` `layerDataset` (const) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:90` `IdentityShapePolicy` (class) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:127` `projectShapes` (const) - 1 example import violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/colors

Path: `packages/foundation/capability/colors`

Module findings:
- `src/Colors.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/Colors.ts:62` `ProcessLikeStdout` (class) - 1 example import violation(s)
- `src/Colors.ts:90` `ProcessLike` (class) - 1 example import violation(s)
- `src/Colors.ts:196` `Formatter` (const) - 1 example import violation(s)
- `src/Colors.ts:213` `Formatter` (type) - 1 example import violation(s)
- `src/Colors.ts:252` `supportsColor` (const) - 1 example import violation(s)
- `src/Colors.ts:268` `isColorSupported` (const) - 1 example import violation(s)
- `src/Colors.ts:292` `Colors` (class) - 1 example import violation(s)
- `src/Colors.ts:341` `createColors` (const) - 1 example import violation(s)
- `src/Colors.ts:409` `default` (const) - 1 example import violation(s)

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
- `src/index.ts:23` `export * as Algebra from "./Algebra/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:38` `export * as Core from "./Core/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:53` `export * as Graph from "./Graph/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:69` `export * as Handoff from "./Handoff/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:85` `export * as IdentifierText from "./IdentifierText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:100` `export * as Ontology from "./Ontology/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:116` `export * as PathText from "./PathText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:132` `export * as QueryText from "./QueryText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:148` `export * as VariantText from "./VariantText.ts";` (re-export) - 1 example import violation(s)

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
- `src/values/GrantSet/GrantSet.model.ts:510` `evaluateExecutionRequest` (const) - 1 documentation section/link violation(s)

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
- `src/McpCaller.ts:44` `McpCallerIdentity` (class) - 1 example import violation(s)
- `src/McpCaller.ts:76` `CurrentMcpCaller` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:74` `defaultSanitizedSpanKeys` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:99` `sanitizeTracerAttributes` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:188` `withSanitizedToolSpan` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:604` `sanitizedToolkit` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/SourceAuth.ts:55` `SourceAuthGate` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:77` `SourceAuthGate` (type) - 1 example import violation(s)
- `src/SourceAuth.ts:100` `SourceAuthRegistration` (class) - 1 example import violation(s)
- `src/SourceAuth.ts:149` `resolveSourceCredential` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:178` `SourceAuthDecision` (type) - 2 example import violation(s)
- `src/SourceAuth.ts:199` `SourceAuthDecision` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:228` `decideSourceAuthMount` (const) - 1 example import violation(s)
- `src/TierGate.ts:65` `TierGateSettlement` (const) - 1 example import violation(s)
- `src/TierGate.ts:87` `TierGateSettlement` (type) - 1 example import violation(s)
- `src/TierGate.ts:107` `TierGateOutcome` (const) - 1 example import violation(s)
- `src/TierGate.ts:130` `TierGateOutcome` (type) - 2 example import violation(s)
- `src/TierGate.ts:160` `TierGateAuditRecord` (class) - 1 example import violation(s)
- `src/TierGate.ts:220` `TierGateVerdict` (const) - 1 example import violation(s)
- `src/TierGate.ts:255` `TierGateVerdict` (type) - 1 example import violation(s)
- `src/TierGate.ts:280` `ToolCallRequest` (interface) - 1 example import violation(s)
- `src/TierGate.ts:330` `TierGateShape` (interface) - 2 example import violation(s)
- `src/TierGate.ts:376` `TierGate` (class) - 1 example import violation(s)
- `src/TierGate.ts:396` `TierGatePolicy` (class) - 1 example import violation(s)
- `src/TierGate.ts:466` `fromApprovedToolsPolicy` (const) - 1 example import violation(s)
- `src/TierGate.ts:518` `TierGateDispatchResult` (type) - 1 example import violation(s)
- `src/TierGate.ts:553` `TierGateDispatchResult` (const) - 1 example import violation(s)
- `src/TierGate.ts:602` `dispatchWithTierGate` (const) - 1 example import violation(s)
- `src/TierGate.ts:640` `withEnabledWhenApprovedTool` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:42` `FourHintAnnotations` (class) - 1 example import violation(s)
- `src/ToolAnnotations.ts:101` `AnnotatedTool` (type) - 1 example import violation(s)
- `src/ToolAnnotations.ts:120` `annotateFourHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:153` `readOnlyToolHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:171` `destructiveWriteToolHints` (const) - 1 example import violation(s)
- `src/ToolkitComposition.ts:54` `GatedLayer` (interface) - 2 example import violation(s)
- `src/ToolkitComposition.ts:90` `gatedLayer` (const) - 1 example import violation(s)
- `src/ToolkitComposition.ts:136` `composeGatedLayers` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Module findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:397` `RuntimeDraftRecipient` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:446` `RuntimeCandidateDraft` (class) - 1 example import violation(s)

### @beep/observability

Path: `packages/foundation/capability/observability`

Module findings:
- `src/CauseDiagnostics.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/CauseRedaction.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/HttpError.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Logging.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/Metric.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/Observed.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/PhaseProfiler.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/CauseDiagnostics.ts:63` `CauseClassification` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:84` `CauseClassification` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:102` `ExitOutcome` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:123` `ExitOutcome` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:140` `CauseFingerprint` (class) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:207` `CauseSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:278` `ObservedExitSummary` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:299` `ObservedExitSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:428` `classifyCause` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:451` `fingerprintCause` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:476` `summarizeCause` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:527` `summarizeExit` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:586` `renderObservedCause` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:72` `REDACTION_PLACEHOLDER` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:92` `DEFAULT_MESSAGE_LIMIT` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:112` `DEFAULT_DETAIL_LIMIT` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:131` `RedactionChannel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:152` `RedactionChannel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:204` `sanitizeSensitiveText` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:229` `redactString` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:259` `RedactedCause` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:297` `RedactCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:391` `redactCauseSummary` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:427` `redactCause` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:457` `redactCauseForClient` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:481` `RedactedCauseError` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:517` `redactCauseEffect` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:546` `RedactedCauseLogLevel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:567` `RedactedCauseLogLevel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:584` `LogRedactedCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:629` `logRedactedCause` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:670` `tapRedactedCause` (const) - 1 example import violation(s)
- `src/CoreConfig.ts:45` `ObservabilityCoreConfig` (const) - 1 example import violation(s)
- `src/CoreConfig.ts:69` `ObservabilityCoreConfig` (type) - 1 example import violation(s)
- `src/HttpError.ts:166` `ClientHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:205` `ServerHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:239` `BadRequestError` (class) - 2 example import violation(s)
- `src/HttpError.ts:267` `UnauthorizedError` (class) - 2 example import violation(s)
- `src/HttpError.ts:295` `ForbiddenError` (class) - 2 example import violation(s)
- `src/HttpError.ts:323` `NotFoundError` (class) - 2 example import violation(s)
- `src/HttpError.ts:351` `ConflictError` (class) - 2 example import violation(s)
- `src/HttpError.ts:379` `UnprocessableEntityError` (class) - 2 example import violation(s)
- `src/HttpError.ts:407` `TooManyRequestsError` (class) - 2 example import violation(s)
- `src/HttpError.ts:435` `InternalServerErrorError` (class) - 2 example import violation(s)
- `src/HttpError.ts:463` `BadGatewayError` (class) - 2 example import violation(s)
- `src/HttpError.ts:491` `ServiceUnavailableError` (class) - 2 example import violation(s)
- `src/HttpError.ts:519` `GatewayTimeoutError` (class) - 2 example import violation(s)
- `src/HttpError.ts:545` `makeBadRequestError` (const) - 1 example import violation(s)
- `src/HttpError.ts:565` `makeUnauthorizedError` (const) - 1 example import violation(s)
- `src/HttpError.ts:585` `makeForbiddenError` (const) - 1 example import violation(s)
- `src/HttpError.ts:605` `makeNotFoundError` (const) - 1 example import violation(s)
- `src/HttpError.ts:625` `makeConflictError` (const) - 1 example import violation(s)
- `src/HttpError.ts:645` `makeUnprocessableEntityError` (const) - 1 example import violation(s)
- `src/HttpError.ts:665` `makeTooManyRequestsError` (const) - 1 example import violation(s)
- `src/HttpError.ts:685` `makeInternalServerError` (const) - 1 example import violation(s)
- `src/HttpError.ts:705` `makeBadGatewayError` (const) - 1 example import violation(s)
- `src/HttpError.ts:725` `makeServiceUnavailableError` (const) - 1 example import violation(s)
- `src/HttpError.ts:745` `makeGatewayTimeoutError` (const) - 1 example import violation(s)
- `src/Logging.ts:62` `LogFormat` (const) - 1 example import violation(s)
- `src/Logging.ts:83` `LogFormat` (type) - 1 example import violation(s)
- `src/Logging.ts:100` `PrettyLogTheme` (const) - 1 example import violation(s)
- `src/Logging.ts:121` `PrettyLogTheme` (type) - 1 example import violation(s)
- `src/Logging.ts:138` `BannerMode` (const) - 1 example import violation(s)
- `src/Logging.ts:159` `BannerMode` (type) - 1 example import violation(s)
- `src/Logging.ts:180` `PrettyLoggerConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:209` `LoggingConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:242` `layerMinimumLogLevel` (const) - 1 example import violation(s)
- `src/Logging.ts:261` `RenderLogBannerOptions` (class) - 1 example import violation(s)
- `src/Logging.ts:371` `renderLogBanner` (const) - 1 example import violation(s)
- `src/Logging.ts:461` `layerConsoleLogger` (const) - 1 example import violation(s)
- `src/Metric.ts:59` `TrackDurationOptions` (class) - 1 example import violation(s)
- `src/Metric.ts:86` `TrackDurationOptionsInput` (type) - 1 example import violation(s)
- `src/Metric.ts:160` `statusClass` (const) - 1 example import violation(s)
- `src/Metric.ts:195` `measureElapsedMillis` (const) - 1 example import violation(s)
- `src/Metric.ts:281` `trackDuration` (const) - 1 example import violation(s)
- `src/Metric.ts:409` `observeWorkflow` (const) - 1 example import violation(s)
- `src/Metric.ts:562` `observeHttpRequest` (const) - 1 example import violation(s)
- `src/Observed.ts:46` `ObservedError` (const) - 1 example import violation(s)
- `src/Observed.ts:67` `ObservedError` (type) - 1 example import violation(s)
- `src/Observed.ts:86` `ObservedErrorWithStack` (const) - 1 example import violation(s)
- `src/Observed.ts:107` `ObservedErrorWithStack` (type) - 1 example import violation(s)
- `src/Observed.ts:126` `ObservedDefect` (const) - 1 example import violation(s)
- `src/Observed.ts:147` `ObservedDefect` (type) - 1 example import violation(s)
- `src/Observed.ts:166` `ObservedDefectWithStack` (const) - 1 example import violation(s)
- `src/Observed.ts:187` `ObservedDefectWithStack` (type) - 1 example import violation(s)
- `src/Observed.ts:208` `ObservedCauseReason` (const) - 1 example import violation(s)
- `src/Observed.ts:229` `ObservedCauseReason` (type) - 1 example import violation(s)
- `src/Observed.ts:248` `ObservedCause` (const) - 1 example import violation(s)
- `src/Observed.ts:269` `ObservedCause` (type) - 1 example import violation(s)
- `src/Observed.ts:288` `ObservedExit` (const) - 1 example import violation(s)
- `src/Observed.ts:309` `ObservedExit` (type) - 1 example import violation(s)
- `src/PhaseProfiler.ts:75` `PhaseOutcome` (const) - 1 example import violation(s)
- `src/PhaseProfiler.ts:96` `PhaseOutcome` (type) - 1 example import violation(s)
- `src/PhaseProfiler.ts:122` `PhaseProfile` (class) - 1 example import violation(s)
- `src/PhaseProfiler.ts:307` `profilePhase` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:37` `DevToolsSpanFilter` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:63` `DevToolsSpanFilter` (type) - 1 example import violation(s)

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
- `src/values/PatentDocument/PatentDocument.normalizer.ts:501` `normalizePatentApplicationDocument` (const) - 1 example import violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:61` `PatentDocumentTriplet` (const) - 4 documentation section/link violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:38` `PatentNumber` (const) - 1 documentation section/link violation(s)

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

### @beep/api-transport

Path: `packages/foundation/capability/api-transport`

Module findings:
- `src/EgressDenied.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Transport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/EgressDenied.ts:46` `EgressDenied` (class) - 1 example import violation(s)
- `src/Transport.ts:67` `ApiAuth` (const) - 1 example import violation(s)
- `src/Transport.ts:114` `ApiAuth` (type) - 1 example import violation(s)
- `src/Transport.ts:177` `RateLimitSnapshot` (class) - 1 example import violation(s)
- `src/Transport.ts:277` `ApiTransportOptions` (class) - 1 example import violation(s)
- `src/Transport.ts:351` `ApiTransport` (interface) - 1 example import violation(s)
- `src/Transport.ts:390` `makeApiTransport` (const) - 1 example import violation(s)

### @beep/epistemic-config

Path: `packages/epistemic/config`

Module findings:
- `src/Audience.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ServerConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TestLayer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/postgres

Path: `packages/drivers/postgres`

Export findings:
- `src/PostgresDiagnostics.service.ts:367` `formatPostgresErrorWith` (const) - 1 example import violation(s)

### @beep/epistemic-tables

Path: `packages/epistemic/tables`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/entities/EdgeVersion/EdgeVersion.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/pretext

Path: `packages/drivers/pretext`

Module findings:
- `src/Pretext.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pretext.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/browser.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology-use-cases

Path: `packages/ontology/use-cases`

Module findings:
- `src/aggregates/Session/worker.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Session/Session.worker-protocol.ts:285` `encodeWorkerCommand` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:326` `encodeWorkerResult` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:367` `OntologyWorkerUndecodableCommand` (class) - 1 documentation section/link violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Module findings:
- `src/Chat.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClientObservability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Chat.atoms.ts:718` `SendTurnRequest` (class) - 1 example import violation(s)
- `src/Chat.atoms.ts:750` `EditTurnRequest` (class) - 1 example import violation(s)
- `src/Chat.atoms.ts:788` `TurnRequest` (const) - 1 example import violation(s)
- `src/Chat.atoms.ts:816` `TurnRequest` (type) - 1 example import violation(s)
- `src/Chat.atoms.ts:890` `runTurnAtom` (const) - 1 example import violation(s)

### @beep/law-practice-tables

Path: `packages/law-practice/tables`

Module findings:
- `src/Tables.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/law-practice-use-cases

Path: `packages/law-practice/use-cases`

Module findings:
- `src/IrToLaw/IrToLaw.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/IrToLaw/IrToLaw.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OfficeActionReview/OfficeActionReview.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PracticeKg.tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/PracticeKg.tools.ts:265` `PracticeKgToolResult` (class) - 1 example import violation(s)

### @beep/tika

Path: `packages/drivers/tika`

Module findings:
- `src/Tika.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Tika.response.ts:151` `readTikaContentText` (const) - 1 example import violation(s)
- `src/Tika.server.ts:171` `makeTikaServerFileProcessingEngine` (const) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:316` `makeTikaServerFileProcessingEngineFromEnv` (const) - 1 documentation section/link violation(s)
- `src/Tika.tikaapp.ts:98` `makeTikaAppFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/libpff

Path: `packages/drivers/libpff`

Module findings:
- `src/Libpff.eml.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Libpff.eml.ts:185` `rfc5322DateFromOutlookTimestamp` (const) - 1 example import violation(s)
- `src/Libpff.eml.ts:431` `assembleEml` (const) - 1 example import violation(s)
- `src/Libpff.pffexport.ts:564` `makePffexportFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/box

Path: `packages/drivers/box`

Export findings:
- `src/Box.streaming.ts:437` `BoxUploadFilePartByUrlPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:597` `BoxGetZipDownloadContentPayload` (class) - 1 example import violation(s)

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
- `src/GovernedEgress/GovernedEgress.fetch.ts:214` `makeGovernedEgressFetch` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:129` `GovernedTierGateOptions` (class) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:186` `refusalGuidance` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:243` `makeGovernedTierGate` (const) - 1 documentation section/link violation(s)

### @beep/m365

Path: `packages/drivers/m365`

Module findings:
- `src/M365.auth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/M365.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/technical-drawing

Path: `packages/foundation/capability/technical-drawing`

Export findings:
- `src/Approval.rules.ts:50` `textLines` (const) - 1 example import violation(s)
- `src/Approval.rules.ts:67` `authoredLines` (const) - 1 example import violation(s)
- `src/Approval.rules.ts:118` `verifyConfirmation` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:38` `approvalStatement` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:56` `EmailAddress` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:74` `EmailAddress` (type) - 1 example import violation(s)
- `src/Approval.schemas.ts:102` `EmailConfirmation` (class) - 1 example import violation(s)
- `src/Approval.schemas.ts:137` `PdfConfirmation` (class) - 1 example import violation(s)
- `src/Approval.schemas.ts:174` `Confirmation` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:197` `Confirmation` (type) - 2 example import violation(s)
- `src/Approval.schemas.ts:220` `ApprovalRefusalReason` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:243` `ApprovalRefusalReason` (type) - 1 example import violation(s)
- `src/Approval.schemas.ts:277` `ApprovalRecord` (class) - 1 example import violation(s)
- `src/Approval.service.ts:46` `ConfirmationSource` (const) - 1 example import violation(s)
- `src/Approval.service.ts:82` `ConfirmationSource` (type) - 2 example import violation(s)
- `src/Approval.service.ts:103` `SignRequest` (class) - 1 example import violation(s)
- `src/Approval.service.ts:132` `SheetSetApprovalShape` (interface) - 1 example import violation(s)
- `src/Approval.service.ts:273` `SheetSetApproval` (class) - 1 example import violation(s)
- `src/FigureSet.service.ts:52` `RenderRequest` (class) - 1 example import violation(s)
- `src/FigureSet.service.ts:92` `FigureSetShape` (interface) - 1 example import violation(s)
- `src/FigureSet.service.ts:322` `FigureSet` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:37` `Vec3` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:58` `Vec3` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:74` `PositiveLength` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:102` `PositiveLength` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:119` `Rotation` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:162` `Box` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:192` `Prism` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:228` `Cylinder` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:258` `Primitive` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:281` `Primitive` (type) - 2 example import violation(s)
- `src/Geometry.schemas.ts:307` `Part` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:347` `LengthUnit` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:369` `LengthUnit` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:388` `ModelSpec` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:434` `Camera` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:467` `Segment2` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:488` `Segment2` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:511` `EdgeSet` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:566` `ShadingPlan` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:595` `BoundingBox` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:625` `ModelSummary` (class) - 1 example import violation(s)
- `src/Geometry.segments.ts:47` `canonicalSegments` (const) - 1 example import violation(s)
- `src/Geometry.segments.ts:69` `mirrorSegments` (const) - 1 example import violation(s)
- `src/Geometry.segments.ts:97` `sameSegments` (const) - 1 example import violation(s)
- `src/Manifest.schemas.ts:32` `Sha256Hex` (const) - 1 example import violation(s)
- `src/Manifest.schemas.ts:60` `Sha256Hex` (type) - 1 example import violation(s)
- `src/Manifest.schemas.ts:76` `EngineInfo` (class) - 1 example import violation(s)
- `src/Manifest.schemas.ts:105` `FigureRecord` (class) - 1 example import violation(s)
- `src/Manifest.schemas.ts:138` `OmissionProof` (class) - 1 example import violation(s)
- `src/Manifest.schemas.ts:177` `RenderManifest` (class) - 1 example import violation(s)
- `src/Sheet.compose.ts:200` `labelWidthPt` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:223` `strokeLabel` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:263` `viewExtents` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:303` `sheetGeometry` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:338` `commonScale` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:373` `composeSheet` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:31` `SheetFormat` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:53` `SheetFormat` (type) - 1 example import violation(s)
- `src/Sheet.schemas.ts:78` `PT_PER_CM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:94` `PT_PER_MM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:110` `PagePoints` (class) - 1 example import violation(s)
- `src/Sheet.schemas.ts:140` `pageSizePt` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:161` `MARGINS_CM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:177` `MIN_LETTER_HEIGHT_CM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:194` `SheetOptions` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.errors.ts:31` `DrawingErrorReason` (const) - 1 example import violation(s)
- `src/TechnicalDrawing.errors.ts:54` `DrawingErrorReason` (type) - 1 example import violation(s)
- `src/TechnicalDrawing.errors.ts:78` `DrawingError` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:40` `GeometryEngineShape` (interface) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:66` `GeometryEngine` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:88` `PdfBackendShape` (interface) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:116` `PdfBackend` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:133` `MailReaderShape` (interface) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:152` `MailReader` (class) - 1 example import violation(s)
- `src/Validation.rules.ts:62` `structuralFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:135` `marginFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:189` `purityFindings` (const) - 1 example import violation(s)
- `src/Validation.schemas.ts:30` `PdfPageSize` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:54` `PdfFontFact` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:86` `PdfFacts` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:114` `InkBounds` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:145` `PageMetrics` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:193` `FindingCode` (const) - 1 example import violation(s)
- `src/Validation.schemas.ts:215` `FindingCode` (type) - 1 example import violation(s)
- `src/Validation.schemas.ts:233` `SheetFinding` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:261` `ValidationOptions` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:293` `ValidationReport` (class) - 1 example import violation(s)
- `src/View.schemas.ts:50` `ViewName` (const) - 1 example import violation(s)
- `src/View.schemas.ts:72` `ViewName` (type) - 1 example import violation(s)
- `src/View.schemas.ts:93` `isPerspectiveView` (const) - 1 example import violation(s)
- `src/View.schemas.ts:109` `CameraForViewInput` (class) - 1 example import violation(s)
- `src/View.schemas.ts:146` `cameraForView` (const) - 1 example import violation(s)
- `src/View.schemas.ts:185` `FigureSpec` (class) - 1 example import violation(s)
- `src/View.schemas.ts:218` `OmissionRelation` (const) - 1 example import violation(s)
- `src/View.schemas.ts:240` `OmissionRelation` (type) - 1 example import violation(s)
- `src/View.schemas.ts:257` `OmissionClaim` (class) - 1 example import violation(s)
- `src/View.schemas.ts:296` `FigureSetSpec` (class) - 1 example import violation(s)

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

### @beep/ui

Path: `packages/foundation/ui-system/ui`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
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
- `src/Dock.atoms.ts:53` `DockAtomObservabilityLive` (const) - 1 example import violation(s)
- `src/Dock.atoms.ts:211` `makeDockAtomsWith` (const) - 1 example import violation(s)
- `src/Dock.atoms.ts:244` `makeDockAtoms` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:34` `UserCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:59` `ApiCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:86` `CommandOrigin` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:110` `CommandOrigin` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:127` `OpenPanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:153` `ActivatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:179` `UpdatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:199` `MovePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:225` `MoveGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:246` `UpdateGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:266` `ClosePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:291` `ResizeSplitCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:317` `ClearWorkspaceCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:341` `MaximizeGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:361` `RestoreMaximizedCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:381` `FloatGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:400` `DockFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:419` `MoveFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:456` `DockCommand` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:495` `DockCommand` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:512` `DockCommandEnvelope` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:538` `AllowedRenderers` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:561` `AllowedRenderers` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:578` `RestoreSnapshotRequest` (class) - 1 example import violation(s)
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
- `src/Dock.models-tree.ts:49` `PanelRenderMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:69` `PanelRenderMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:86` `PanelParameterValue` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:106` `PanelParameterValue` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:123` `PanelParameters` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:143` `PanelParameters` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:160` `ComponentPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:186` `TextPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:211` `PanelView` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:233` `PanelView` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:262` `PanelConstraints` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:289` `Panel` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:340` `PanelPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:372` `GroupLockedMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:390` `GroupLockedMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:407` `GroupHeaderPosition` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:425` `GroupHeaderPosition` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:442` `GroupMetadata` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:472` `GroupPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:509` `TabsNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:675` `HorizontalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:704` `VerticalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:735` `SplitLayout` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:802` `SplitLayout` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:821` `SplitNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:915` `DockNode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1060` `DockNode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1103` `DockNode` (namespace) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1173` `FloatingMember` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1193` `EmptyWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1221` `PopulatedWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1302` `DockWorkspace` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1520` `DockWorkspace` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1537` `DockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:32` `DockUnchangedReason` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:63` `DockUnchangedReason` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:81` `DockChanged` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:109` `DockUnchanged` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:136` `DockMutationResult` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:158` `DockMutationResult` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:176` `DockMutationOutcome` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:31` `RootPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:56` `TabPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:83` `DockSide` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:103` `DockSide` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:120` `SplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:154` `RootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:182` `GroupSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:210` `GroupRootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:239` `DockPlacement` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:263` `DockPlacement` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:280` `DockMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:301` `DockMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:318` `DockGroupMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:339` `DockGroupMoveTarget` (type) - 1 example import violation(s)
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
- `src/DockEngine.service.ts:93` `DockEngineShape` (interface) - 2 example import violation(s)
- `src/DockEngine.service.ts:134` `DockEngine` (class) - 1 example import violation(s)
- `src/DockEngine.service.ts:169` `DockEngineLive` (const) - 1 example import violation(s)
- `src/DockEngine.service.ts:192` `DockSnapshotStoreShape` (interface) - 1 example import violation(s)
- `src/DockEngine.service.ts:216` `DockSnapshotStore` (class) - 1 example import violation(s)
- `src/DockEngine.service.ts:242` `makeDockSnapshotStoreMemory` (const) - 2 example import violation(s)
- `src/DockEngine.service.ts:273` `requireSnapshot` (const) - 1 example import violation(s)
- `src/DockPolicy.ts:46` `DockCommandPolicy` (type) - 2 example import violation(s)
- `src/DockPolicy.ts:124` `lockedGroupsPolicy` (const) - 1 example import violation(s)
- `src/DockPolicy.ts:204` `makePolicyDockEngineLayer` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:40` `Extent` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:64` `DockBox` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:89` `GroupGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:109` `SashGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:129` `FloatingGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:149` `DockGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:189` `resolveAnchoredBox` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:232` `GeometryOptions` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:266` `GroupMinimumLookup` (type) - 2 example import violation(s)
- `src/Geometry.models.ts:283` `GroupMinimaRecord` (type) - 1 example import violation(s)
- `src/Minima.ts:65` `TabChrome` (class) - 1 example import violation(s)
- `src/Minima.ts:90` `titleWords` (const) - 1 example import violation(s)
- `src/Minima.ts:142` `titleMinima` (const) - 1 example import violation(s)
- `src/Minima.ts:201` `makeTitleMinimaAtom` (const) - 1 example import violation(s)
- `src/Recency.ts:42` `touchedGroupsInEvents` (const) - 1 example import violation(s)
- `src/Recency.ts:82` `touchedGroups` (const) - 1 example import violation(s)
- `src/Recency.ts:131` `makeMruGroupsAtom` (const) - 1 example import violation(s)

### @beep/ai-provider-cli

Path: `packages/drivers/ai-provider-cli`

Module findings:
- `src/AiProviderCliHome.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Module findings:
- `src/Lexical.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.codec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Lexical.model.ts:1135` `ElementNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:2349` `YouTubeNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3316` `decodeEditorStateStrictResult` (const) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3399` `analyzeEditorStateCompatibilityResult` (const) - 1 documentation section/link violation(s)
- `src/index.ts:26` `export { editorStateToPlainText, nodeToPlainText } from "./Lexical.behavior.ts";` (re-export) - 1 example import violation(s)
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
} from "./Lexical.model.ts";` (re-export) - 1 example import violation(s)

### @beep/ontology-config

Path: `packages/ontology/config`

Module findings:
- `src/McpConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/law-practice-server

Path: `packages/law-practice/server`

Module findings:
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/DocumentIdentification/Identification.rdap.ts:68` `registrantFromRdap` (const) - 1 example import violation(s)

### @beep/ecfr

Path: `packages/drivers/ecfr`

Module findings:
- `src/Ecfr.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/_generated/Ecfr.gen.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/govinfo

Path: `packages/drivers/govinfo`

Module findings:
- `src/Govinfo.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/domain/contracts/Api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Govinfo.config.ts:130` `GovinfoConfigInput` (class) - 1 example import violation(s)
- `src/Govinfo.service.ts:68` `GovinfoShape` (interface) - 1 example import violation(s)

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/ProofManifest.ts:162` `DocgenProofManifestFile` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:198` `DocgenProofManifestFingerprint` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:263` `DocgenProofManifest` (class) - 1 example import violation(s)

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
- `src/Gate.ts:41` `GateId` (const) - 1 example import violation(s)
- `src/Gate.ts:80` `makeGateId` (const) - 1 example import violation(s)
- `src/Gate.ts:103` `GateSeverity` (const) - 1 example import violation(s)
- `src/Gate.ts:131` `GateApplicabilityKind` (const) - 1 example import violation(s)
- `src/Gate.ts:159` `AlwaysGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:190` `ConditionalGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:222` `GateApplicability` (const) - 1 example import violation(s)
- `src/Gate.ts:254` `EvidencePredicateType` (const) - 1 example import violation(s)
- `src/Gate.ts:286` `GateEvidenceRequirement` (class) - 1 example import violation(s)
- `src/Gate.ts:326` `GateDeclaration` (class) - 1 example import violation(s)
- `src/Gate.ts:379` `GateRegistry` (class) - 1 example import violation(s)
- `src/Gate.ts:400` `GateOutcome` (const) - 1 example import violation(s)
- `src/Gate.ts:520` `GateAuditRecord` (const) - 1 example import violation(s)
- `src/Gate.ts:586` `GateVerdict` (const) - 1 example import violation(s)
- `src/Recovery.ts:66` `BudgetDuration` (const) - 1 example import violation(s)
- `src/Recovery.ts:94` `RecoveryBudget` (class) - 1 example import violation(s)
- `src/Recovery.ts:120` `RecoveryBudgetConsumed` (class) - 1 example import violation(s)
- `src/Recovery.ts:145` `RecoveryAttemptOutcome` (const) - 1 example import violation(s)
- `src/Recovery.ts:173` `RecoveryAttemptReceipt` (class) - 1 example import violation(s)
- `src/Recovery.ts:202` `FailureTerminalReason` (const) - 1 example import violation(s)
- `src/Recovery.ts:314` `FailureReceiptPredicate` (class) - 1 example import violation(s)
- `src/Recovery.ts:335` `FailurePredicateType` (const) - 1 example import violation(s)
- `src/Recovery.ts:353` `FailureReceipt` (const) - 1 example import violation(s)
- `src/Recovery.ts:377` `NoRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:400` `BoundedRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:431` `RecoveryPolicy` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:27` `SchemaReferenceId` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:64` `SchemaReference` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:61` `SkillCompletionReceipt` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:117` `SkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:144` `toSkillCompletionReceipt` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:167` `EvaluateSkillCompletionInput` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:195` `CompletionInvariantReason` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:234` `CompletionInvariantError` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:260` `CompletionAllowed` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:286` `CompletionDenied` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:312` `CompletionEvaluation` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:395` `evaluateSkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:462` `LiveVerified` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:488` `DeployableBlocked` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:516` `FailedWithPartialEffects` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:543` `SkillTerminal` (const) - 1 example import violation(s)
- `src/SkillContract.ts:33` `SkillContractId` (const) - 1 example import violation(s)
- `src/SkillContract.ts:62` `ReceiptTypeBindings` (class) - 1 example import violation(s)
- `src/SkillContract.ts:94` `SkillContract` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:66` `SkillMarkdownProjection` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:92` `SkillArtifactDenialReason` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:130` `SkillArtifactCheck` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:181` `SkillArtifactAllowed` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:207` `SkillArtifactDenied` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:234` `SkillArtifactVerdict` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:265` `VerifySkillArtifactInput` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:371` `projectSkillDocument` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:403` `renderSkillMarkdown` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:444` `decodeSkillFrontmatter` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:553` `verifySkillArtifact` (const) - 1 example import violation(s)

### @beep/exiftool

Path: `packages/drivers/exiftool`

Module findings:
- `src/ExiftoolConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Export findings:
- `src/forwarder.ts:139` `AiMetricsForwarderInput` (class) - 1 example import violation(s)
- `src/forwarder.ts:1023` `runAiMetricsForwarder` (const) - 1 example import violation(s)

### @beep/obs

Path: `packages/drivers/obs`

Module findings:
- `src/Obs.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/models/ImageConfig.schema.ts:238` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)

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

### @beep/wink

Path: `packages/drivers/wink`

Module findings:
- `src/WinkBackend.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/venice-ai

Path: `packages/drivers/venice-ai`

Export findings:
- `src/VeniceAI.service.ts:1458` `VENICE_AI_OPERATION_DESCRIPTORS` (const) - 1 example import violation(s)

### @beep/graph-3d

Path: `packages/drivers/graph-3d`

Module findings:
- `src/Graph3D.react.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Module findings:
- `src/Fold.assembly.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Fold.assembly.ts:71` `BoundComposer` (type) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.assembly.ts:890` `fold` (const) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:46` `MarkdownLinkMode` (const) - 1 example import violation(s)
- `src/Fold.markdown.ts:67` `MarkdownLinkMode` (type) - 1 example import violation(s)
- `src/Fold.markdown.ts:84` `MarkdownOptions` (class) - 1 example import violation(s)
- `src/Fold.markdown.ts:295` `toMarkdown` (const) - 2 example import violation(s)
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
- `src/Fold.projections.ts:46` `JsonLdTerm` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:70` `JsonLdContext` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:87` `JsonLdNodeValue` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:110` `JsonLdNode` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:131` `JsonLdDocument` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:237` `toContext` (const) - 2 example import violation(s)
- `src/Fold.projections.ts:390` `toJsonLd` (const) - 2 example import violation(s)
- `src/Fold.projections.ts:633` `toTurtle` (const) - 2 example import violation(s)
- `src/SemanticFoundation.models.ts:189` `ConceptAlignment` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:220` `TaxonomyConcept` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:287` `FilingRoot` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:180` `VendorAlignmentManifestEntry` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:239` `VendorConceptSlice` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:435` `VendorSliceConceptMismatch` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:469` `VendorAlignmentTargetNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:36` `LibrarianInput` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:105` `TaxonomyConceptNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:127` `UnsupportedDocumentClass` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:158` `runLibrarianLoop` (const) - 1 example import violation(s)

### @beep/dock-react

Path: `packages/foundation/ui-system/dock-react`

Export findings:
- `src/DockReact.types.ts:34` `DockAtomGraph` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:53` `DockPanelApi` (class) - 2 example import violation(s)
- `src/DockReact.types.ts:77` `DockPanelProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:98` `DockTabProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:115` `DockRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:132` `DockTabRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:149` `DockviewAdapterApi` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:185` `DockTitleMinimaOptions` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:209` `DockviewReactProps` (type) - 1 example import violation(s)
- `src/DockviewReact.tsx:244` `DockviewReact` (const) - 2 example import violation(s)

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
- `src/capability/projection.ts:38` `ShortcutHelpEntry` (class) - 1 example import violation(s)
- `src/chat/atoms.ts:901` `onSendAtom` (const) - 1 example import violation(s)
- `src/viewer.tsx:244` `EditorViewer` (function) - 1 example import violation(s)

### @beep/documents-server

Path: `packages/documents/server`

Module findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/Openclaw.models.ts:177` `OpenclawProcessRequest` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:351` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:424` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:459` `OpenclawSecretsReloadOutput` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:524` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1200` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1303` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1390` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1461` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:446` `OpenclawCliRunner` (type) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:54` `OpenclawSecretReference` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:101` `OpenclawTargetVersion` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1080` `OpenclawSkillPin` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1183` `OpenclawDeploymentIntent` (class) - 1 documentation section/link violation(s)

### @beep/db-admin

Path: `packages/_internal/db-admin`

Module findings:
- `src/migrate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/gov-legal-mcp

Path: `packages/drivers/gov-legal-mcp`

Module findings:
- `src/Handlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolNames.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/commands/Cache/Cache.command.ts:269` `runCacheWarm` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:466` `buildCacheDashboard` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.service.ts:110` `encodeCachePolicyBaselineText` (const) - 1 example import violation(s)
- `src/commands/Ci/CiLane.ts:386` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:1520` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.errors.ts:303` `CorpusArchiveMoveDigestMismatchError` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:915` `indexMailExportTrees` (const) - missing @example
- `src/commands/Corpus/Corpus.service.ts:928` `repairAttachmentExtensions` (const) - missing @example
- `src/commands/Corpus/Corpus.service.ts:941` `runMetadataCensus` (const) - missing @example
- `src/commands/CreatePackage/CreatePackage.command.ts:114` `resolveCreatePackageTemplateDir` (const) - 1 documentation section/link violation(s)
- `src/commands/Explore/Atlas.ts:684` `explorationProjectionDriftPaths` (const) - 1 example import violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:330` `runFrozenGrantSetRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:620` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:511` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:587` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:688` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:1017` `runBunAudit` (const) - 1 documentation section/link violation(s)
- `src/commands/Runners/Runners.schemas.ts:120` `BakeConfig` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:166` `BakeReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:275` `BakePlan` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:334` `BakeCheckReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.service.ts:170` `BakeLocalInputs` (class) - 1 example import violation(s)
- `src/commands/Worktree/Fleet.service.ts:327` `parseProcStatStartTime` (const) - 1 example import violation(s)

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
- `src/Streaming/DatasetLoader.ts:671` `loadJsonl` (const) - 1 documentation section/link violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/m365-mcp

Path: `packages/drivers/m365-mcp`

Export findings:
- `src/OutboxAttachmentSource.ts:149` `OutboxAttachmentDigest` (class) - 1 example import violation(s)
- `src/OutboxAttachmentSource.ts:181` `OutboxAttachment` (class) - 1 example import violation(s)
- `src/OutboxSendGuard.ts:267` `sameAttachments` (const) - 1 example import violation(s)

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

### @beep/infra

Path: `infra`

Module findings:
- `src/CiFleetController.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CiRunners.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CiFleetController.ts:598` `CiFleetControllerPulumiConfigValues` (const) - missing @example
- `src/CiFleetController.ts:634` `CiFleetControllerConfig` (class) - missing @example
- `src/CiFleetController.ts:666` `makeCiFleetControllerConfig` (const) - missing @example
- `src/CiFleetController.ts:690` `loadCiFleetControllerConfig` (const) - missing @example
- `src/OpenClaw.ts:399` `OpenClawExpectedIdentity` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:582` `OpenClawDeploymentConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:824` `OpenClawBackupConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:896` `OpenClawGeneration` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1250` `makeOpenClawGeneration` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1332` `renderOpenClawUnit` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1406` `renderOpenClawRunScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1508` `renderOpenClawGenerationTree` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1574` `renderOpenClawPreflightScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1705` `renderOpenClawStageScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1837` `renderOpenClawApplyScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1959` `renderOpenClawRollbackScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2110` `renderOpenClawDriftAuditScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2166` `renderOpenClawProbeScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2241` `renderOpenClawLiveAcceptanceScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2341` `renderOpenClawBackupShipScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2405` `OpenClawStackArgs` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2491` `makeOpenClawStackArgsFromConfigValues` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2694` `OpenClawStack` (class) - 1 documentation section/link violation(s)

### @beep/box-provisioning

Path: `packages/drivers/box-provisioning`

Export findings:
- `src/BoxContentMigrationMap.ts:225` `BoxContentMigrationFile` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:70` `BoxContentFolderExists` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:102` `BoxContentFolderCreate` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:160` `BoxContentUpload` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:197` `BoxContentSkipIdentical` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:233` `BoxContentBlockedNameConflict` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:262` `BoxContentBlockedSourceMissing` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:288` `BoxContentBlockedSourceChanged` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:181` `BoxContentActionApplied` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:210` `BoxContentActionSkipped` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:241` `BoxContentActionBlocked` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:277` `BoxContentActionFailed` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:310` `BoxContentActionNotAttempted` (class) - 1 example import violation(s)
- `src/BoxProvisioningErrors.ts:152` `BoxProvisioningDriftError` (class) - 1 example import violation(s)
- `src/BoxProvisioningIntent.ts:540` `BoxWebhookIntent` (class) - 1 example import violation(s)
- `src/BoxProvisioningObserved.ts:323` `BoxObservedWebhook` (class) - 1 example import violation(s)
- `src/BoxProvisioningPlan.ts:398` `BoxForeignResource` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:339` `BoxActionApplied` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:368` `BoxActionSkipped` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:395` `BoxActionBlocked` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:452` `BoxApplyReceipt` (class) - 1 example import violation(s)

### @beep/freshbooks

Path: `packages/drivers/freshbooks`

Module findings:
- `src/Freshbooks.config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.token.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Freshbooks.config.ts:286` `FreshbooksConfigInput` (class) - 1 documentation section/link violation(s)
- `src/Freshbooks.errors.ts:73` `FreshbooksErrorReason` (const) - 1 documentation section/link violation(s)
- `src/Freshbooks.models.ts:566` `FreshbooksDecode` (const) - missing @example

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
- `src/UsptoDocumentTiers.ts:189` `MintFetchableHandle` (const) - 1 example import violation(s)
- `src/UsptoDocumentTiers.ts:250` `ProjectDocumentsWithinBudgetOptions` (class) - 1 example import violation(s)
- `src/UsptoDocumentTiers.ts:304` `projectDocumentsWithinBudget` (const) - 1 example import violation(s)

### @beep/pandoc-ast

Path: `packages/foundation/modeling/pandoc-ast`

Export findings:
- `src/index.ts:22` `export * from "./Pandoc.codec.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:43` `export * from "./Pandoc.conformance.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:58` `export * from "./Pandoc.mapping.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export * from "./Pandoc.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:88` `export * from "./Pandoc.report.ts";` (re-export) - 1 example import violation(s)
