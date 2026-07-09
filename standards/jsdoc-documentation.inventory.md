# JSDoc Documentation Compliance Inventory

Generated: 2026-07-09T12:30:57.832Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: required export tags, summaries, TSDoc grammar, forbidden legacy tags, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 108 |
| cleanPackages | 105 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 0 |
| publicModules | 1700 |
| publicExports | 14953 |
| openModules | 0 |
| openExports | 0 |
| missingExportExamples | 0 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 0 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
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
| 3 | `@beep/agents-domain` | `packages/agents/domain` | clean | 12 | 49 | 0 | 0 |
| 4 | `@beep/ontology` | `packages/foundation/modeling/ontology` | clean | 2 | 22 | 0 | 0 |
| 5 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 6 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 7 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 8 | `@beep/pacer` | `packages/drivers/pacer` | clean | 13 | 89 | 0 | 0 |
| 9 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 16 | 34 | 0 | 0 |
| 10 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | clean | 8 | 56 | 0 | 0 |
| 11 | `@beep/law-practice-server` | `packages/law-practice/server` | clean | 2 | 3 | 0 | 0 |
| 12 | `@beep/db-admin` | `packages/_internal/db-admin` | clean | 7 | 13 | 0 | 0 |
| 13 | `@beep/shared-domain` | `packages/shared/domain` | clean | 41 | 237 | 0 | 0 |
| 14 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 15 | `@beep/face-detection` | `packages/drivers/face-detection` | clean | 4 | 33 | 0 | 0 |
| 16 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | clean | 16 | 103 | 0 | 0 |
| 17 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 7 | 0 | 0 |
| 18 | `@beep/repo-cli` | `packages/tooling/tool/cli` | clean | 132 | 794 | 0 | 0 |
| 19 | `@beep/pglite` | `packages/drivers/pglite` | clean | 4 | 11 | 0 | 0 |
| 20 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 83 | 0 | 0 |
| 21 | `@beep/agents-server` | `packages/agents/server` | clean | 7 | 27 | 0 | 0 |
| 22 | `@beep/courtlistener` | `packages/drivers/courtlistener` | clean | 1 | 1 | 0 | 0 |
| 23 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | clean | 8 | 25 | 0 | 0 |
| 24 | `@beep/editor` | `packages/foundation/ui-system/editor` | clean | 21 | 86 | 0 | 0 |
| 25 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | clean | 9 | 123 | 0 | 0 |
| 26 | `@beep/law-practice-domain` | `packages/law-practice/domain` | clean | 50 | 122 | 0 | 0 |
| 27 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | clean | 9 | 82 | 0 | 0 |
| 28 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | clean | 8 | 95 | 0 | 0 |
| 29 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | clean | 4 | 14 | 0 | 0 |
| 30 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | clean | 8 | 31 | 0 | 0 |
| 31 | `@beep/ontology-server` | `packages/ontology/server` | clean | 6 | 11 | 0 | 0 |
| 32 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 33 | `@beep/agents-use-cases` | `packages/agents/use-cases` | clean | 23 | 79 | 0 | 0 |
| 34 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | clean | 4 | 21 | 0 | 0 |
| 35 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 5 | 19 | 0 | 0 |
| 36 | `@beep/workspace-server` | `packages/workspace/server` | clean | 7 | 19 | 0 | 0 |
| 37 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 38 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 26 | 0 | 0 |
| 39 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 50 | 0 | 0 |
| 40 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | clean | 6 | 34 | 0 | 0 |
| 41 | `@beep/types` | `packages/foundation/primitive/types` | clean | 5 | 10 | 0 | 0 |
| 42 | `@beep/oip-web` | `apps/oip-web` | clean | 31 | 83 | 0 | 0 |
| 43 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 44 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 38 | 0 | 0 |
| 45 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | clean | 5 | 105 | 0 | 0 |
| 46 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 6 | 34 | 0 | 0 |
| 47 | `@beep/shared-tables` | `packages/shared/tables` | clean | 11 | 14 | 0 | 0 |
| 48 | `@beep/scratchpad` | `scratchpad` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 49 | `@beep/md` | `packages/foundation/modeling/md` | clean | 6 | 211 | 0 | 0 |
| 50 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | clean | 12 | 30 | 0 | 0 |
| 51 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 27 | 60 | 0 | 0 |
| 52 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 28 | 119 | 0 | 0 |
| 53 | `@beep/utils` | `packages/foundation/modeling/utils` | clean | 26 | 198 | 0 | 0 |
| 54 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | clean | 18 | 262 | 0 | 0 |
| 55 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 56 | `@beep/tika` | `packages/drivers/tika` | clean | 4 | 16 | 0 | 0 |
| 57 | `@beep/libpff` | `packages/drivers/libpff` | clean | 4 | 19 | 0 | 0 |
| 58 | `@beep/venice-ai` | `packages/drivers/venice-ai` | clean | 3 | 35 | 0 | 0 |
| 59 | `@beep/form` | `packages/foundation/ui-system/form` | clean | 42 | 114 | 0 | 0 |
| 60 | `@beep/identity` | `packages/foundation/modeling/identity` | clean | 6 | 159 | 0 | 0 |
| 61 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 4 | 17 | 0 | 0 |
| 62 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 3 | 4 | 0 | 0 |
| 63 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | clean | 2 | 8 | 0 | 0 |
| 64 | `@beep/box` | `packages/drivers/box` | clean | 103 | 4497 | 0 | 0 |
| 65 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 66 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | clean | 48 | 312 | 0 | 0 |
| 67 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 5 | 26 | 0 | 0 |
| 68 | `@beep/professional-desktop` | `apps/professional-desktop` | clean | 28 | 51 | 0 | 0 |
| 69 | `@beep/epistemic-domain` | `packages/epistemic/domain` | clean | 22 | 44 | 0 | 0 |
| 70 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 42 | 0 | 0 |
| 71 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 64 | 0 | 0 |
| 72 | `@beep/firecrawl` | `packages/drivers/firecrawl` | clean | 5 | 267 | 0 | 0 |
| 73 | `@beep/ecfr` | `packages/drivers/ecfr` | clean | 5 | 23 | 0 | 0 |
| 74 | `@beep/acp` | `packages/drivers/acp` | clean | 10 | 410 | 0 | 0 |
| 75 | `@beep/nlp` | `packages/foundation/modeling/nlp` | clean | 28 | 310 | 0 | 0 |
| 76 | `@beep/infra` | `infra` | clean | 5 | 34 | 0 | 0 |
| 77 | `@beep/runpod` | `packages/drivers/runpod` | clean | 6 | 179 | 0 | 0 |
| 78 | `@beep/fc-runs` | `packages/tooling/test-kit/fc-runs` | clean | 2 | 5 | 0 | 0 |
| 79 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | clean | 63 | 677 | 0 | 0 |
| 80 | `@beep/schema` | `packages/foundation/modeling/schema` | clean | 241 | 1569 | 0 | 0 |
| 81 | `@beep/epistemic-server` | `packages/epistemic/server` | clean | 2 | 3 | 0 | 0 |
| 82 | `@beep/rdf` | `packages/foundation/modeling/rdf` | clean | 17 | 208 | 0 | 0 |
| 83 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 84 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 85 | `@beep/govinfo` | `packages/drivers/govinfo` | clean | 32 | 86 | 0 | 0 |
| 86 | `@beep/data` | `packages/foundation/primitive/data` | clean | 12 | 144 | 0 | 0 |
| 87 | `@beep/xai` | `packages/drivers/xai` | clean | 7 | 70 | 0 | 0 |
| 88 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 89 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 6 | 28 | 0 | 0 |
| 90 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 4 | 54 | 0 | 0 |
| 91 | `@beep/agents-client` | `packages/agents/client` | clean | 3 | 23 | 0 | 0 |
| 92 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | clean | 7 | 30 | 0 | 0 |
| 93 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 94 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | clean | 10 | 19 | 0 | 0 |
| 95 | `@beep/m365` | `packages/drivers/m365` | clean | 6 | 74 | 0 | 0 |
| 96 | `@beep/observability` | `packages/foundation/capability/observability` | clean | 24 | 159 | 0 | 0 |
| 97 | `@beep/html` | `packages/foundation/modeling/html` | clean | 5 | 355 | 0 | 0 |
| 98 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 99 | `@beep/ui` | `packages/foundation/ui-system/ui` | clean | 132 | 551 | 0 | 0 |
| 100 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | clean | 5 | 121 | 0 | 0 |
| 101 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | clean | 25 | 139 | 0 | 0 |
| 102 | `@beep/wink` | `packages/drivers/wink` | clean | 14 | 71 | 0 | 0 |
| 103 | `@beep/postgres` | `packages/drivers/postgres` | clean | 7 | 36 | 0 | 0 |
| 104 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 52 | 0 | 0 |
| 105 | `@beep/provenance` | `packages/foundation/modeling/provenance` | clean | 2 | 5 | 0 | 0 |
| 106 | `@beep/epistemic-tables` | `packages/epistemic/tables` | clean | 6 | 12 | 0 | 0 |
| 107 | `@beep/federal-register` | `packages/drivers/federal-register` | clean | 1 | 1 | 0 | 0 |
| 108 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |

## Open Findings
