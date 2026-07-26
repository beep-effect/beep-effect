# JSDoc Documentation Compliance Inventory

Generated: 2026-07-26T03:16:34.112Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: required export tags, summaries, TSDoc grammar, forbidden legacy tags, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 124 |
| cleanPackages | 121 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 0 |
| publicModules | 2158 |
| publicExports | 17576 |
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
| 2 | `@beep/protobuf` | `packages/drivers/protobuf` | clean | 1 | 1 | 0 | 0 |
| 3 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 4 | `@beep/agents-domain` | `packages/agents/domain` | clean | 16 | 74 | 0 | 0 |
| 5 | `@beep/ontology` | `packages/foundation/modeling/ontology` | clean | 6 | 58 | 0 | 0 |
| 6 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 7 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 8 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 9 | `@beep/pacer` | `packages/drivers/pacer` | clean | 13 | 89 | 0 | 0 |
| 10 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 19 | 42 | 0 | 0 |
| 11 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | clean | 9 | 59 | 0 | 0 |
| 12 | `@beep/law-practice-server` | `packages/law-practice/server` | clean | 2 | 3 | 0 | 0 |
| 13 | `@beep/db-admin` | `packages/_internal/db-admin` | clean | 9 | 24 | 0 | 0 |
| 14 | `@beep/shared-domain` | `packages/shared/domain` | clean | 41 | 243 | 0 | 0 |
| 15 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 16 | `@beep/face-detection` | `packages/drivers/face-detection` | clean | 4 | 33 | 0 | 0 |
| 17 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | clean | 23 | 210 | 0 | 0 |
| 18 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 7 | 0 | 0 |
| 19 | `@beep/dock` | `packages/foundation/ui-system/dock` | clean | 20 | 212 | 0 | 0 |
| 20 | `@beep/repo-cli` | `packages/tooling/tool/cli` | clean | 143 | 866 | 0 | 0 |
| 21 | `@beep/pglite` | `packages/drivers/pglite` | clean | 4 | 11 | 0 | 0 |
| 22 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 83 | 0 | 0 |
| 23 | `@beep/agents-server` | `packages/agents/server` | clean | 11 | 39 | 0 | 0 |
| 24 | `@beep/courtlistener` | `packages/drivers/courtlistener` | clean | 1 | 1 | 0 | 0 |
| 25 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | clean | 12 | 46 | 0 | 0 |
| 26 | `@beep/editor` | `packages/foundation/ui-system/editor` | clean | 24 | 109 | 0 | 0 |
| 27 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | clean | 9 | 123 | 0 | 0 |
| 28 | `@beep/law-practice-domain` | `packages/law-practice/domain` | clean | 140 | 356 | 0 | 0 |
| 29 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | clean | 9 | 82 | 0 | 0 |
| 30 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | clean | 8 | 98 | 0 | 0 |
| 31 | `@beep/ontology-config` | `packages/ontology/config` | clean | 6 | 11 | 0 | 0 |
| 32 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | clean | 7 | 44 | 0 | 0 |
| 33 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | clean | 3 | 12 | 0 | 0 |
| 34 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | clean | 9 | 32 | 0 | 0 |
| 35 | `@beep/ontology-server` | `packages/ontology/server` | clean | 8 | 21 | 0 | 0 |
| 36 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 37 | `@beep/agents-use-cases` | `packages/agents/use-cases` | clean | 31 | 120 | 0 | 0 |
| 38 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | clean | 4 | 21 | 0 | 0 |
| 39 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 6 | 22 | 0 | 0 |
| 40 | `@beep/workspace-server` | `packages/workspace/server` | clean | 10 | 28 | 0 | 0 |
| 41 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 42 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 26 | 0 | 0 |
| 43 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 50 | 0 | 0 |
| 44 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | clean | 6 | 35 | 0 | 0 |
| 45 | `@beep/types` | `packages/foundation/primitive/types` | clean | 5 | 10 | 0 | 0 |
| 46 | `@beep/oip-web` | `apps/oip-web` | clean | 31 | 83 | 0 | 0 |
| 47 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 48 | `@beep/agents-tables` | `packages/agents/tables` | clean | 6 | 14 | 0 | 0 |
| 49 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 41 | 0 | 0 |
| 50 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | clean | 5 | 105 | 0 | 0 |
| 51 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 6 | 34 | 0 | 0 |
| 52 | `@beep/shared-tables` | `packages/shared/tables` | clean | 11 | 14 | 0 | 0 |
| 53 | `@beep/scratchpad` | `scratchpad` | clean | 65 | 802 | 0 | 0 |
| 54 | `@beep/md` | `packages/foundation/modeling/md` | clean | 6 | 211 | 0 | 0 |
| 55 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 56 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | clean | 12 | 30 | 0 | 0 |
| 57 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 28 | 62 | 0 | 0 |
| 58 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 28 | 119 | 0 | 0 |
| 59 | `@beep/utils` | `packages/foundation/modeling/utils` | clean | 26 | 201 | 0 | 0 |
| 60 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | clean | 18 | 262 | 0 | 0 |
| 61 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 62 | `@beep/tika` | `packages/drivers/tika` | clean | 4 | 16 | 0 | 0 |
| 63 | `@beep/libpff` | `packages/drivers/libpff` | clean | 4 | 19 | 0 | 0 |
| 64 | `@beep/venice-ai` | `packages/drivers/venice-ai` | clean | 3 | 35 | 0 | 0 |
| 65 | `@beep/graph-3d` | `packages/drivers/graph-3d` | clean | 7 | 17 | 0 | 0 |
| 66 | `@beep/form` | `packages/foundation/ui-system/form` | clean | 42 | 114 | 0 | 0 |
| 67 | `@beep/identity` | `packages/foundation/modeling/identity` | clean | 6 | 190 | 0 | 0 |
| 68 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 4 | 17 | 0 | 0 |
| 69 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 27 | 0 | 0 |
| 70 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | clean | 2 | 8 | 0 | 0 |
| 71 | `@beep/box` | `packages/drivers/box` | clean | 103 | 4501 | 0 | 0 |
| 72 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 54 | 0 | 0 |
| 73 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 74 | `@beep/documents-server` | `packages/documents/server` | clean | 28 | 103 | 0 | 0 |
| 75 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | clean | 48 | 312 | 0 | 0 |
| 76 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 5 | 27 | 0 | 0 |
| 77 | `@beep/professional-desktop` | `apps/professional-desktop` | clean | 51 | 156 | 0 | 0 |
| 78 | `@beep/epistemic-domain` | `packages/epistemic/domain` | clean | 34 | 94 | 0 | 0 |
| 79 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 89 | 0 | 0 |
| 80 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 64 | 0 | 0 |
| 81 | `@beep/firecrawl` | `packages/drivers/firecrawl` | clean | 5 | 267 | 0 | 0 |
| 82 | `@beep/ecfr` | `packages/drivers/ecfr` | clean | 5 | 69 | 0 | 0 |
| 83 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 84 | `@beep/acp` | `packages/drivers/acp` | clean | 10 | 410 | 0 | 0 |
| 85 | `@beep/nlp` | `packages/foundation/modeling/nlp` | clean | 28 | 310 | 0 | 0 |
| 86 | `@beep/infra` | `infra` | clean | 5 | 34 | 0 | 0 |
| 87 | `@beep/runpod` | `packages/drivers/runpod` | clean | 6 | 179 | 0 | 0 |
| 88 | `@beep/fc-runs` | `packages/tooling/test-kit/fc-runs` | clean | 2 | 5 | 0 | 0 |
| 89 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | clean | 63 | 677 | 0 | 0 |
| 90 | `@beep/documents-domain` | `packages/documents/domain` | clean | 24 | 96 | 0 | 0 |
| 91 | `@beep/schema` | `packages/foundation/modeling/schema` | clean | 253 | 1604 | 0 | 0 |
| 92 | `@beep/epistemic-server` | `packages/epistemic/server` | clean | 8 | 16 | 0 | 0 |
| 93 | `@beep/rdf` | `packages/foundation/modeling/rdf` | clean | 17 | 208 | 0 | 0 |
| 94 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 95 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 21 | 0 | 0 |
| 96 | `@beep/govinfo` | `packages/drivers/govinfo` | clean | 32 | 86 | 0 | 0 |
| 97 | `@beep/data` | `packages/foundation/primitive/data` | clean | 12 | 144 | 0 | 0 |
| 98 | `@beep/xai` | `packages/drivers/xai` | clean | 7 | 70 | 0 | 0 |
| 99 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 34 | 0 | 0 |
| 100 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 6 | 28 | 0 | 0 |
| 101 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 4 | 54 | 0 | 0 |
| 102 | `@beep/agents-client` | `packages/agents/client` | clean | 6 | 39 | 0 | 0 |
| 103 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | clean | 7 | 30 | 0 | 0 |
| 104 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 105 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | clean | 18 | 53 | 0 | 0 |
| 106 | `@beep/m365` | `packages/drivers/m365` | clean | 6 | 74 | 0 | 0 |
| 107 | `@beep/observability` | `packages/foundation/capability/observability` | clean | 24 | 165 | 0 | 0 |
| 108 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 109 | `@beep/html` | `packages/foundation/modeling/html` | clean | 5 | 355 | 0 | 0 |
| 110 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 111 | `@beep/ui` | `packages/foundation/ui-system/ui` | clean | 132 | 551 | 0 | 0 |
| 112 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | clean | 5 | 121 | 0 | 0 |
| 113 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | clean | 25 | 139 | 0 | 0 |
| 114 | `@beep/documents-tables` | `packages/documents/tables` | clean | 15 | 40 | 0 | 0 |
| 115 | `@beep/wink` | `packages/drivers/wink` | clean | 14 | 71 | 0 | 0 |
| 116 | `@beep/postgres` | `packages/drivers/postgres` | clean | 7 | 40 | 0 | 0 |
| 117 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 52 | 0 | 0 |
| 118 | `@beep/pretext` | `packages/drivers/pretext` | clean | 6 | 36 | 0 | 0 |
| 119 | `@beep/provenance` | `packages/foundation/modeling/provenance` | clean | 2 | 5 | 0 | 0 |
| 120 | `@beep/epistemic-tables` | `packages/epistemic/tables` | clean | 18 | 44 | 0 | 0 |
| 121 | `@beep/federal-register` | `packages/drivers/federal-register` | clean | 1 | 1 | 0 | 0 |
| 122 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 11 | 0 | 0 |
| 123 | `@beep/documents-use-cases` | `packages/documents/use-cases` | clean | 23 | 116 | 0 | 0 |
| 124 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 16 | 0 | 0 |

## Open Findings
