# JSDoc Documentation Compliance Inventory

Generated: 2026-10-28T07:58:01.215Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 183 |
| cleanPackages | 127 |
| packagesWithoutPublicSrcSurface | 2 |
| packagesNeedingRemediation | 54 |
| publicModules | 3546 |
| publicExports | 25246 |
| openModules | 300 |
| openExports | 176 |
| missingExportExamples | 7 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 97 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 8 |
| multiple-description-paragraphs | 321 |
| leading-blank | 0 |
| trailing-blank | 0 |
| invalid-heading | 1 |
| section-out-of-order | 0 |
| duplicate-section | 0 |
| empty-section | 0 |
| section-after-example | 0 |
| invalid-when-to-use-prefix | 0 |
| malformed-example | 0 |
| duplicate-example | 0 |
| loose-ts-fence | 0 |
| forbidden-remarks | 0 |
| no-root-package-import | 91 |
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
| 4 | `@beep/identity` | `packages/foundation/modeling/identity` | clean | 8 | 280 | 0 | 0 |
| 5 | `@beep/utils` | `packages/foundation/modeling/utils` | clean | 29 | 228 | 0 | 0 |
| 6 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 16 |
| 7 | `@beep/schema` | `packages/foundation/modeling/schema` | clean | 169 | 974 | 0 | 0 |
| 8 | `@beep/semver` | `packages/foundation/modeling/semver` | clean | 6 | 23 | 0 | 0 |
| 9 | `@beep/glob` | `packages/foundation/modeling/glob` | clean | 4 | 9 | 0 | 0 |
| 10 | `@beep/memfs` | `packages/tooling/test-kit/memfs` | clean | 3 | 23 | 0 | 0 |
| 11 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 15 | 54 | 1 | 0 |
| 12 | `@beep/spdx` | `packages/foundation/modeling/spdx` | clean | 4 | 16 | 0 | 0 |
| 13 | `@beep/jsonc` | `packages/foundation/modeling/jsonc` | clean | 8 | 48 | 0 | 0 |
| 14 | `@beep/npm-spec` | `packages/foundation/modeling/npm-spec` | clean | 13 | 72 | 0 | 0 |
| 15 | `@beep/walker` | `packages/foundation/capability/walker` | clean | 4 | 24 | 0 | 0 |
| 16 | `@beep/package-json` | `packages/foundation/modeling/package-json` | clean | 18 | 121 | 0 | 0 |
| 17 | `@beep/toml` | `packages/foundation/modeling/toml` | clean | 9 | 68 | 0 | 0 |
| 18 | `@beep/yaml` | `packages/foundation/modeling/yaml` | clean | 11 | 95 | 0 | 0 |
| 19 | `@beep/pglite` | `packages/drivers/pglite` | needs-remediation | 4 | 10 | 3 | 0 |
| 20 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 64 | 628 | 16 | 0 |
| 21 | `@beep/markdown` | `packages/foundation/modeling/markdown` | clean | 16 | 92 | 0 | 0 |
| 22 | `@beep/html` | `packages/foundation/modeling/html` | clean | 15 | 544 | 0 | 0 |
| 23 | `@beep/md` | `packages/foundation/modeling/md` | clean | 11 | 311 | 0 | 0 |
| 24 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 106 | 374 | 3 | 5 |
| 25 | `@beep/provenance` | `packages/foundation/modeling/provenance` | clean | 4 | 28 | 0 | 0 |
| 26 | `@beep/runtime-env` | `packages/foundation/capability/runtime-env` | clean | 6 | 31 | 0 | 0 |
| 27 | `@beep/rdf` | `packages/foundation/modeling/rdf` | clean | 38 | 303 | 0 | 0 |
| 28 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 30 | 58 | 0 | 0 |
| 29 | `@beep/epistemics` | `packages/foundation/modeling/epistemics` | clean | 35 | 131 | 0 | 0 |
| 30 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 31 | `@beep/config-file` | `packages/foundation/capability/config-file` | clean | 13 | 70 | 0 | 0 |
| 32 | `@beep/github-commands` | `packages/foundation/modeling/github-commands` | clean | 3 | 6 | 0 | 0 |
| 33 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 8 | 56 | 0 | 0 |
| 34 | `@beep/agents-domain` | `packages/agents/domain` | clean | 16 | 75 | 0 | 0 |
| 35 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 45 | 1 | 0 |
| 36 | `@beep/shared-use-cases` | `packages/shared/use-cases` | clean | 6 | 14 | 0 | 0 |
| 37 | `@beep/nlp` | `packages/foundation/modeling/nlp` | clean | 28 | 313 | 0 | 0 |
| 38 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | clean | 34 | 183 | 0 | 0 |
| 39 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 51 | 241 | 7 | 2 |
| 40 | `@beep/tsconfig` | `packages/foundation/modeling/tsconfig` | clean | 8 | 67 | 0 | 0 |
| 41 | `@beep/codegen-kit` | `packages/tooling/library/codegen-kit` | clean | 6 | 45 | 0 | 0 |
| 42 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 49 | 0 | 0 |
| 43 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 7 | 43 | 0 | 0 |
| 44 | `@beep/observability` | `packages/foundation/capability/observability` | clean | 42 | 337 | 0 | 0 |
| 45 | `@beep/cli-kit` | `packages/foundation/capability/cli-kit` | clean | 29 | 196 | 0 | 0 |
| 46 | `@beep/xdg` | `packages/foundation/capability/xdg` | clean | 7 | 31 | 0 | 0 |
| 47 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | clean | 12 | 113 | 0 | 0 |
| 48 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 40 | 0 | 0 |
| 49 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 50 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 129 | 2 | 2 |
| 51 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 251 | 949 | 9 | 5 |
| 52 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 26 | 131 | 0 | 0 |
| 53 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 38 | 148 | 9 | 0 |
| 54 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | clean | 3 | 9 | 0 | 0 |
| 55 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 20 | 3 | 0 |
| 56 | `@beep/postgres` | `packages/drivers/postgres` | needs-remediation | 7 | 42 | 0 | 1 |
| 57 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 34 | 99 | 4 | 0 |
| 58 | `@beep/github` | `packages/drivers/github` | clean | 29 | 192 | 0 | 0 |
| 59 | `@beep/managed-section` | `packages/foundation/modeling/managed-section` | clean | 7 | 31 | 0 | 0 |
| 60 | `@beep/sbom` | `packages/foundation/modeling/sbom` | clean | 9 | 75 | 0 | 0 |
| 61 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 62 | `@beep/repo-tsconfig` | `packages/tooling/library/repo-tsconfig` | clean | 5 | 24 | 0 | 0 |
| 63 | `@beep/acp` | `packages/drivers/acp` | clean | 15 | 1047 | 0 | 0 |
| 64 | `@beep/commands` | `packages/drivers/commands` | clean | 8 | 58 | 0 | 0 |
| 65 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 31 | 588 | 0 | 2 |
| 66 | `@beep/technical-drawing` | `packages/foundation/capability/technical-drawing` | clean | 19 | 224 | 0 | 0 |
| 67 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 5 | 111 | 0 | 0 |
| 68 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 0 |
| 69 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 217 | 1 | 3 |
| 70 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 6 | 22 | 0 | 0 |
| 71 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 5 |
| 72 | `@beep/documents-domain` | `packages/documents/domain` | clean | 26 | 81 | 0 | 0 |
| 73 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 47 | 0 | 0 |
| 74 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 25 | 0 | 0 |
| 75 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 34 | 88 | 1 | 0 |
| 76 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 103 | 651 | 4 | 4 |
| 77 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 33 | 3 | 4 |
| 78 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 42 | 4 | 2 |
| 79 | `@beep/box` | `packages/drivers/box` | needs-remediation | 7 | 878 | 0 | 2 |
| 80 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 24 | 56 | 8 | 4 |
| 81 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 8 | 166 | 2 | 0 |
| 82 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | clean | 48 | 312 | 0 | 0 |
| 83 | `@beep/epistemic-client` | `packages/epistemic/client` | clean | 4 | 24 | 0 | 0 |
| 84 | `@beep/ui` | `packages/foundation/ui-system/ui` | clean | 132 | 557 | 0 | 0 |
| 85 | `@beep/t3-code` | `packages/drivers/t3-code` | clean | 4 | 17 | 0 | 0 |
| 86 | `@beep/github-reporting` | `packages/foundation/modeling/github-reporting` | clean | 5 | 40 | 0 | 0 |
| 87 | `@beep/github-actions` | `packages/drivers/github-actions` | clean | 24 | 162 | 0 | 0 |
| 88 | `@beep/poppler` | `packages/drivers/poppler` | clean | 3 | 9 | 0 | 0 |
| 89 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 103 | 0 | 0 |
| 90 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 10 | 97 | 0 | 3 |
| 91 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 17 | 91 | 3 | 0 |
| 92 | `@beep/skill-contract` | `packages/foundation/modeling/skill-contract` | clean | 9 | 113 | 0 | 0 |
| 93 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 0 |
| 94 | `@beep/palantiri` | `packages/tooling/library/palantiri` | clean | 20 | 156 | 0 | 0 |
| 95 | `@beep/pdf-tools` | `packages/drivers/pdf-tools` | clean | 4 | 38 | 0 | 0 |
| 96 | `@beep/runpod` | `packages/drivers/runpod` | clean | 7 | 204 | 0 | 0 |
| 97 | `@beep/tesseract` | `packages/drivers/tesseract` | clean | 3 | 15 | 0 | 0 |
| 98 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 0 |
| 99 | `@beep/lockfiles` | `packages/foundation/modeling/lockfiles` | clean | 14 | 47 | 0 | 0 |
| 100 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 24 | 197 | 0 | 1 |
| 101 | `@beep/occt` | `packages/drivers/occt` | clean | 4 | 13 | 0 | 0 |
| 102 | `@beep/git` | `packages/drivers/git` | clean | 5 | 44 | 0 | 0 |
| 103 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 0 |
| 104 | `@beep/dock` | `packages/foundation/ui-system/dock` | clean | 20 | 212 | 0 | 0 |
| 105 | `@beep/agents-tables` | `packages/agents/tables` | clean | 7 | 15 | 0 | 0 |
| 106 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 6 | 31 | 0 | 0 |
| 107 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | clean | 6 | 124 | 0 | 0 |
| 108 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 109 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 18 | 1 | 0 |
| 110 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 111 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 112 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 23 | 56 | 0 | 0 |
| 113 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 11 | 0 | 0 |
| 114 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 92 | 0 | 0 |
| 115 | `@beep/documents-tables` | `packages/documents/tables` | clean | 19 | 48 | 0 | 0 |
| 116 | `@beep/documents-use-cases` | `packages/documents/use-cases` | clean | 23 | 124 | 0 | 0 |
| 117 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 20 | 0 | 0 |
| 118 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 20 | 0 | 0 |
| 119 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 63 | 0 | 0 |
| 120 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 73 | 346 | 1 | 1 |
| 121 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 6 | 172 | 2 | 0 |
| 122 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 85 | 2 | 2 |
| 123 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 72 | 1 | 0 |
| 124 | `@beep/mcpb-kit` | `packages/tooling/library/mcpb-kit` | clean | 5 | 25 | 0 | 0 |
| 125 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 13 | 109 | 0 | 3 |
| 126 | `@beep/windows-secrets` | `packages/drivers/windows-secrets` | clean | 4 | 13 | 0 | 0 |
| 127 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 88 | 12 | 0 |
| 128 | `@beep/openai` | `packages/drivers/openai` | clean | 4 | 16 | 0 | 0 |
| 129 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 130 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 15 | 0 | 0 |
| 131 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 6 | 14 | 0 | 0 |
| 132 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 0 |
| 133 | `@beep/ontology` | `packages/foundation/modeling/ontology` | clean | 15 | 157 | 0 | 0 |
| 134 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 473 | 4454 | 47 | 35 |
| 135 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | clean | 3 | 12 | 0 | 0 |
| 136 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 3 | 11 | 0 | 0 |
| 137 | `@beep/repo-workspaces` | `packages/tooling/library/repo-workspaces` | clean | 27 | 244 | 0 | 0 |
| 138 | `@beep/github-references` | `packages/foundation/modeling/github-references` | clean | 4 | 28 | 0 | 0 |
| 139 | `@beep/brand` | `packages/foundation/ui-system/brand` | clean | 7 | 50 | 0 | 0 |
| 140 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 42 | 2 | 0 |
| 141 | `@beep/editor` | `packages/foundation/ui-system/editor` | clean | 34 | 210 | 0 | 0 |
| 142 | `@beep/ontology-server` | `packages/ontology/server` | clean | 8 | 23 | 0 | 0 |
| 143 | `@beep/xstate` | `packages/drivers/xstate` | clean | 6 | 26 | 0 | 0 |
| 144 | `@beep/workspace-server` | `packages/workspace/server` | clean | 12 | 31 | 0 | 0 |
| 145 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 27 | 0 | 0 |
| 146 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 104 | 2 | 0 |
| 147 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 15 |
| 148 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 6 | 0 | 0 |
| 149 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 33 | 0 | 0 |
| 150 | `@beep/practice-claude-mod` | `apps/practice-claude-mod` | clean | 8 | 30 | 0 | 0 |
| 151 | `@beep/public-site` | `packages/foundation/modeling/public-site` | clean | 4 | 27 | 0 | 0 |
| 152 | `@beep/practice-mail-tagging` | `apps/practice-mail-tagging` | clean | 8 | 44 | 0 | 0 |
| 153 | `@beep/schema-org` | `packages/foundation/modeling/schema-org` | clean | 13 | 57 | 0 | 0 |
| 154 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 13 | 46 | 2 | 0 |
| 155 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 156 | `@beep/docket-intake` | `apps/docket-intake` | clean | 12 | 34 | 0 | 0 |
| 157 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 40 | 6 | 0 |
| 158 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 6 | 0 | 0 |
| 159 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 1 |
| 160 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 14 | 41 | 1 | 0 |
| 161 | `@beep/practice-gateway` | `apps/practice-gateway` | clean | 20 | 143 | 0 | 0 |
| 162 | `@beep/oip-web` | `apps/oip-web` | clean | 31 | 87 | 0 | 0 |
| 163 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 164 | `@beep/shared-tables` | `packages/shared/tables` | clean | 9 | 12 | 0 | 0 |
| 165 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 68 | 424 | 46 | 0 |
| 166 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | clean | 16 | 75 | 0 | 0 |
| 167 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 168 | `@beep/todox` | `apps/todox` | clean | 16 | 57 | 0 | 0 |
| 169 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 53 | 0 | 0 |
| 170 | `@beep/practice-m365-contacts` | `apps/practice-m365-contacts` | clean | 8 | 28 | 0 | 0 |
| 171 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 65 | 241 | 25 | 0 |
| 172 | `@beep/jsonl` | `packages/foundation/modeling/jsonl` | clean | 8 | 60 | 0 | 0 |
| 173 | `@beep/practice-identify` | `apps/practice-identify` | clean | 3 | 10 | 0 | 0 |
| 174 | `@beep/infra` | `infra` | needs-remediation | 11 | 109 | 3 | 22 |
| 175 | `@beep/practice-setup` | `apps/practice-setup` | clean | 6 | 38 | 0 | 0 |
| 176 | `@beep/box-provisioning` | `packages/drivers/box-provisioning` | needs-remediation | 15 | 184 | 0 | 21 |
| 177 | `@beep/freshbooks` | `packages/drivers/freshbooks` | needs-remediation | 6 | 49 | 5 | 3 |
| 178 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 179 | `@beep/practice-review-hub` | `apps/practice-review-hub` | clean | 3 | 12 | 0 | 0 |
| 180 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 31 | 7 | 0 |
| 181 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 182 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 183 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | clean | 6 | 202 | 0 | 0 |

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

### @beep/test-utils

Path: `packages/tooling/test-kit/test-utils`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/pglite

Path: `packages/drivers/pglite`

Module findings:
- `src/Pglite.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PgliteClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/Workspaces.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/errors/CyclicDependencyError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/DomainError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/NoSuchFileError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/OptionInjectionError.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/WorkspaceDeps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/shared-domain

Path: `packages/shared/domain`

Module findings:
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entity/Principal.ts:258` `PrincipalSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/SourceKind.ts:32` `SourceKindSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/primitives.ts:68` `Sha256` (const) - 1 example import violation(s)
- `src/identity/index.ts:82` `isIdentityComposer` (const) - 1 example import violation(s)
- `src/identity/index.ts:117` `AnyIdentityComposer` (const) - 1 example import violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/epistemic-domain

Path: `packages/epistemic/domain`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionGrant/ExecutionGrant.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionVerdict/ExecutionVerdict.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/values/GrantSet/GrantSet.model.ts:280` `addGrant` (const) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:509` `evaluateExecutionRequest` (const) - 1 documentation section/link violation(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Module findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:407` `RuntimeDraftRecipient` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:457` `RuntimeCandidateDraft` (class) - 1 example import violation(s)

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
- `src/values/PatentDocument/PatentDocument.normalizer.ts:543` `normalizePatentApplicationDocument` (const) - 1 example import violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:63` `PatentDocumentTriplet` (const) - 4 documentation section/link violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:38` `PatentNumber` (const) - 1 documentation section/link violation(s)

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

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Export findings:
- `src/forwarder.ts:467` `AiMetricsForwarderInput` (class) - 1 example import violation(s)
- `src/forwarder.ts:1469` `runAiMetricsForwarder` (const) - 1 example import violation(s)

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
- `src/aggregates/Session/Session.worker-protocol.ts:286` `encodeWorkerCommand` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:327` `encodeWorkerResult` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:368` `OntologyWorkerUndecodableCommand` (class) - 1 documentation section/link violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Module findings:
- `src/Chat.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClientObservability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Chat.atoms.ts:714` `SendTurnRequest` (class) - 1 example import violation(s)
- `src/Chat.atoms.ts:748` `EditTurnRequest` (class) - 1 example import violation(s)
- `src/Chat.atoms.ts:788` `TurnRequest` (const) - 1 example import violation(s)
- `src/Chat.atoms.ts:816` `TurnRequest` (type) - 1 example import violation(s)
- `src/Chat.atoms.ts:889` `runTurnAtom` (const) - 1 example import violation(s)

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
- `src/PracticeKg.tools.ts:457` `PracticeKgToolResult` (class) - 1 example import violation(s)
- `src/PracticeSetup/PracticeSetup.ports.ts:99` `SetupProbesShape` (class) - missing @example
- `src/PracticeSetup/PracticeSetup.ports.ts:178` `SetupApprovalsShape` (class) - missing @example
- `src/PracticeSetup/PracticeSetup.service.ts:112` `SetupDoctorShape` (class) - missing @example

### @beep/tika

Path: `packages/drivers/tika`

Module findings:
- `src/Tika.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Tika.response.ts:155` `readTikaContentText` (const) - 1 example import violation(s)
- `src/Tika.server.ts:181` `makeTikaServerFileProcessingEngine` (const) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:333` `makeTikaServerFileProcessingEngineFromEnv` (const) - 1 documentation section/link violation(s)
- `src/Tika.tikaapp.ts:101` `makeTikaAppFileProcessingEngine` (const) - 1 documentation section/link violation(s)

### @beep/libpff

Path: `packages/drivers/libpff`

Module findings:
- `src/Libpff.eml.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Libpff.eml.ts:190` `rfc5322DateFromOutlookTimestamp` (const) - 1 example import violation(s)
- `src/Libpff.eml.ts:436` `assembleEml` (const) - 1 example import violation(s)

### @beep/box

Path: `packages/drivers/box`

Export findings:
- `src/Box.streaming.ts:495` `BoxUploadFilePartByUrlPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:662` `BoxGetZipDownloadContentPayload` (class) - 1 example import violation(s)

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
- `src/GovernedEgress/GovernedEgress.fetch.ts:208` `makeGovernedEgressFetch` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:129` `GovernedTierGateOptions` (class) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:185` `refusalGuidance` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:242` `makeGovernedTierGate` (const) - 1 documentation section/link violation(s)

### @beep/m365

Path: `packages/drivers/m365`

Module findings:
- `src/M365.auth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/M365.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/ProofManifest.ts:162` `DocgenProofManifestFile` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:199` `DocgenProofManifestFingerprint` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:266` `DocgenProofManifest` (class) - 1 example import violation(s)

### @beep/ai-provider-cli

Path: `packages/drivers/ai-provider-cli`

Module findings:
- `src/AiProviderCliHome.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/exiftool

Path: `packages/drivers/exiftool`

Module findings:
- `src/ExiftoolConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/obs

Path: `packages/drivers/obs`

Module findings:
- `src/Obs.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/models/ImageConfig.schema.ts:241` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)

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
- `src/Govinfo.service.ts:69` `GovinfoShape` (interface) - 1 example import violation(s)

### @beep/wink

Path: `packages/drivers/wink`

Module findings:
- `src/WinkBackend.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/m365-mcp

Path: `packages/drivers/m365-mcp`

Export findings:
- `src/OutboxAttachmentSource.ts:151` `OutboxAttachmentDigest` (class) - 1 example import violation(s)
- `src/OutboxAttachmentSource.ts:184` `OutboxAttachment` (class) - 1 example import violation(s)
- `src/OutboxSendGuard.ts:269` `sameAttachments` (const) - 1 example import violation(s)

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

### @beep/graph-3d

Path: `packages/drivers/graph-3d`

Module findings:
- `src/Graph3D.react.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/commands/Cache/Cache.command.ts:290` `runCacheWarm` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:487` `buildCacheDashboard` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.service.ts:111` `encodeCachePolicyBaselineText` (const) - 1 example import violation(s)
- `src/commands/Ci/CiLane.ts:404` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:1552` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.errors.ts:312` `CorpusArchiveMoveDigestMismatchError` (class) - 1 example import violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:122` `resolveCreatePackageTemplateDir` (const) - 1 documentation section/link violation(s)
- `src/commands/Drawings/Drawings.intake.schemas.ts:304` `MessageFacts` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.intake.schemas.ts:354` `IntakeRecord` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.intake.schemas.ts:405` `IntakeResult` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.intake.ts:625` `renderIntakeSummary` (const) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.measurements.schemas.ts:431` `CriticMeasurements` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.measurements.ts:910` `measurementsMarkdown` (const) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:787` `explorationProjectionDriftPaths` (const) - 1 example import violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:328` `runFrozenGrantSetRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:628` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:512` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:628` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:732` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:1052` `runBunAudit` (const) - 1 documentation section/link violation(s)
- `src/commands/Runners/Runners.schemas.ts:120` `BakeConfig` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:167` `BakeReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:276` `BakePlan` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:334` `BakeCheckReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.service.ts:179` `BakeLocalInputs` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.render.ts:222` `renderSkillsLockMigrationPlanJson` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.render.ts:296` `renderSkillsLockMigrationPlanSummary` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.render.ts:349` `renderSkillsLockWriteReceiptJson` (const) - 1 example import violation(s)
- `src/commands/Skills/SkillsLock.schemas.ts:96` `LocalSkillLockEntry` (class) - 1 example import violation(s)
- `src/commands/Skills/SkillsLock.schemas.ts:579` `LocalMigrationRow` (class) - 1 example import violation(s)
- `src/commands/Skills/SkillsLock.schemas.ts:745` `SkillsLockMigrationPlan` (class) - 1 example import violation(s)
- `src/commands/Skills/SkillsLock.schemas.ts:813` `SkillsLockMigrationArtifacts` (class) - 1 example import violation(s)
- `src/commands/Skills/SkillsLock.schemas.ts:886` `SkillsLockWrittenFile` (class) - 1 example import violation(s)
- `src/commands/Skills/SkillsLock.schemas.ts:921` `SkillsLockWriteReceipt` (class) - 1 example import violation(s)
- `src/commands/Worktree/Fleet.service.ts:327` `parseProcStatStartTime` (const) - 1 example import violation(s)

### @beep/agents-server

Path: `packages/agents/server`

Module findings:
- `src/AssistantTurn/AnthropicTurnCodec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AssistantTurn/AnthropicTurnKernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/Openclaw.models.ts:352` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:423` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:459` `OpenclawSecretsReloadOutput` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:526` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1227` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1331` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1420` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1492` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:457` `OpenclawCliRunner` (type) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:54` `OpenclawSecretReference` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:101` `OpenclawTargetVersion` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1102` `OpenclawSkillPin` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1207` `OpenclawDeploymentIntent` (class) - 1 documentation section/link violation(s)

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
- `src/Streaming/DatasetLoader.ts:685` `loadJsonl` (const) - 1 documentation section/link violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/scratchpad

Path: `scratchpad`

Module findings:
- `effected/cli/ui-testing.ts:1` (packageDocumentation) - missing @since
- `effected/cli/ui.ts:1` (packageDocumentation) - missing @since
- `effected/cli/ui/CliUi.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/CliUiLive.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/Confirm.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/DocView.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/KeyHelp.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/KeyTable.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/MultiSelect.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/Select.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/Tabs.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/TextInput.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/Toggle.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/UiKey.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/UiProvider.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/UiStreams.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/UiTheme.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/Viewport.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/ErrorBoundary.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/Holder.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/ScreenContext.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/UiProviders.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/ink.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/inkChalk.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/inkConsole.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/lazyView.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/lineText.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/mountPermit.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/perfDrain.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/renderOptions.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/internal/screenElement.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/testing/CliUiTest.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/testing/fakeStreams.ts:1` (none) - missing summary; missing @since
- `effected/cli/ui/testing/terminalModel.ts:1` (none) - missing summary; missing @since
- `effected/engine/Distribution.ts:1` (none) - missing summary; missing @since
- `effected/engine/LaunchContext.ts:1` (none) - missing summary; missing @since
- `effected/engine/ProcessGuard.ts:1` (none) - missing summary; missing @since
- `effected/engine/Remediation.ts:1` (none) - missing summary; missing @since
- `effected/engine/guard.ts:1` (packageDocumentation) - missing @since
- `effected/engine/index.ts:1` (packageDocumentation) - missing @since
- `effected/npm/NpmExecutor.ts:1` (none) - missing summary; missing @since
- `effected/npm/NpmRegistry.ts:1` (none) - missing summary; missing @since
- `effected/npm/PackagePublish.ts:1` (none) - missing summary; missing @since
- `effected/npm/PackageTarball.ts:1` (none) - missing summary; missing @since
- `effected/npm/PublishError.ts:1` (none) - missing summary; missing @since
- `effected/sbom/SigstoreSigner.ts:1` (none) - missing summary; missing @since

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
- `src/CiFleetController.ts:657` `CiFleetControllerConfig` (class) - missing @example
- `src/CiFleetController.ts:690` `makeCiFleetControllerConfig` (const) - missing @example
- `src/CiFleetController.ts:720` `loadCiFleetControllerConfig` (const) - missing @example
- `src/OpenClaw.ts:402` `OpenClawExpectedIdentity` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:593` `OpenClawDeploymentConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:836` `OpenClawBackupConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:909` `OpenClawGeneration` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1271` `makeOpenClawGeneration` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1358` `renderOpenClawUnit` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1432` `renderOpenClawRunScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1535` `renderOpenClawGenerationTree` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1604` `renderOpenClawPreflightScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1740` `renderOpenClawStageScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1872` `renderOpenClawApplyScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1994` `renderOpenClawRollbackScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2148` `renderOpenClawDriftAuditScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2207` `renderOpenClawProbeScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2282` `renderOpenClawLiveAcceptanceScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2385` `renderOpenClawBackupShipScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2449` `OpenClawStackArgs` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2536` `makeOpenClawStackArgsFromConfigValues` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2739` `OpenClawStack` (class) - 1 documentation section/link violation(s)

### @beep/box-provisioning

Path: `packages/drivers/box-provisioning`

Export findings:
- `src/BoxContentMigrationMap.ts:232` `BoxContentMigrationFile` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:70` `BoxContentFolderExists` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:102` `BoxContentFolderCreate` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:160` `BoxContentUpload` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:197` `BoxContentSkipIdentical` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:233` `BoxContentBlockedNameConflict` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:263` `BoxContentBlockedSourceMissing` (class) - 1 example import violation(s)
- `src/BoxContentMigrationPlan.ts:290` `BoxContentBlockedSourceChanged` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:183` `BoxContentActionApplied` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:212` `BoxContentActionSkipped` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:243` `BoxContentActionBlocked` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:279` `BoxContentActionFailed` (class) - 1 example import violation(s)
- `src/BoxContentMigrationReceipt.ts:312` `BoxContentActionNotAttempted` (class) - 1 example import violation(s)
- `src/BoxProvisioningErrors.ts:155` `BoxProvisioningDriftError` (class) - 1 example import violation(s)
- `src/BoxProvisioningIntent.ts:553` `BoxWebhookIntent` (class) - 1 example import violation(s)
- `src/BoxProvisioningObserved.ts:330` `BoxObservedWebhook` (class) - 1 example import violation(s)
- `src/BoxProvisioningPlan.ts:401` `BoxForeignResource` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:344` `BoxActionApplied` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:373` `BoxActionSkipped` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:400` `BoxActionBlocked` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:457` `BoxApplyReceipt` (class) - 1 example import violation(s)

### @beep/freshbooks

Path: `packages/drivers/freshbooks`

Module findings:
- `src/Freshbooks.config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Freshbooks.token.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Freshbooks.config.ts:285` `FreshbooksConfigInput` (class) - 1 documentation section/link violation(s)
- `src/Freshbooks.errors.ts:73` `FreshbooksErrorReason` (const) - 1 documentation section/link violation(s)
- `src/Freshbooks.models.ts:575` `FreshbooksDecode` (const) - missing @example

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
