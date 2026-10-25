# JSDoc Documentation Compliance Inventory

Generated: 2026-10-25T10:59:58.979Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 182 |
| cleanPackages | 101 |
| packagesWithoutPublicSrcSurface | 2 |
| packagesNeedingRemediation | 79 |
| publicModules | 3556 |
| publicExports | 25274 |
| openModules | 440 |
| openExports | 1382 |
| missingExportExamples | 7 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 1351 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 11 |
| multiple-description-paragraphs | 424 |
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
| no-root-package-import | 1330 |
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
| 4 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 8 | 279 | 2 | 198 |
| 5 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 28 | 218 | 6 | 101 |
| 6 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 16 |
| 7 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 168 | 971 | 14 | 33 |
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
| 20 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 65 | 646 | 17 | 0 |
| 21 | `@beep/markdown` | `packages/foundation/modeling/markdown` | clean | 16 | 92 | 0 | 0 |
| 22 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 15 | 544 | 9 | 28 |
| 23 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 11 | 311 | 4 | 87 |
| 24 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 106 | 374 | 3 | 5 |
| 25 | `@beep/provenance` | `packages/foundation/modeling/provenance` | needs-remediation | 4 | 28 | 1 | 0 |
| 26 | `@beep/runtime-env` | `packages/foundation/capability/runtime-env` | clean | 6 | 31 | 0 | 0 |
| 27 | `@beep/rdf` | `packages/foundation/modeling/rdf` | needs-remediation | 38 | 303 | 1 | 5 |
| 28 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 30 | 58 | 0 | 0 |
| 29 | `@beep/epistemics` | `packages/foundation/modeling/epistemics` | clean | 35 | 131 | 0 | 0 |
| 30 | `@beep/colors` | `packages/foundation/capability/colors` | needs-remediation | 1 | 9 | 1 | 9 |
| 31 | `@beep/config-file` | `packages/foundation/capability/config-file` | clean | 13 | 70 | 0 | 0 |
| 32 | `@beep/github-commands` | `packages/foundation/modeling/github-commands` | clean | 3 | 6 | 0 | 0 |
| 33 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | needs-remediation | 8 | 56 | 0 | 11 |
| 34 | `@beep/agents-domain` | `packages/agents/domain` | clean | 16 | 75 | 0 | 0 |
| 35 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 45 | 1 | 0 |
| 36 | `@beep/shared-use-cases` | `packages/shared/use-cases` | clean | 6 | 14 | 0 | 0 |
| 37 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 313 | 9 | 9 |
| 38 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | needs-remediation | 34 | 183 | 0 | 19 |
| 39 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 51 | 241 | 7 | 2 |
| 40 | `@beep/codegen-kit` | `packages/tooling/library/codegen-kit` | clean | 6 | 45 | 0 | 0 |
| 41 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 5 | 49 | 0 | 0 |
| 42 | `@beep/duckdb` | `packages/drivers/duckdb` | clean | 7 | 43 | 0 | 0 |
| 43 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 42 | 337 | 8 | 98 |
| 44 | `@beep/cli-kit` | `packages/foundation/capability/cli-kit` | clean | 29 | 196 | 0 | 0 |
| 45 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 12 | 113 | 8 | 50 |
| 46 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 40 | 0 | 0 |
| 47 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 48 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 129 | 2 | 2 |
| 49 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 251 | 949 | 9 | 5 |
| 50 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 26 | 131 | 0 | 0 |
| 51 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 38 | 148 | 9 | 0 |
| 52 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | needs-remediation | 3 | 9 | 2 | 7 |
| 53 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 20 | 3 | 0 |
| 54 | `@beep/postgres` | `packages/drivers/postgres` | needs-remediation | 7 | 42 | 0 | 1 |
| 55 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 34 | 99 | 4 | 0 |
| 56 | `@beep/github` | `packages/drivers/github` | clean | 29 | 192 | 0 | 0 |
| 57 | `@beep/managed-section` | `packages/foundation/modeling/managed-section` | clean | 7 | 29 | 0 | 0 |
| 58 | `@beep/chalk` | `packages/foundation/capability/chalk` | needs-remediation | 1 | 35 | 1 | 35 |
| 59 | `@beep/acp` | `packages/drivers/acp` | clean | 15 | 1047 | 0 | 0 |
| 60 | `@beep/tsconfig` | `packages/foundation/modeling/tsconfig` | clean | 8 | 61 | 0 | 0 |
| 61 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 31 | 587 | 0 | 2 |
| 62 | `@beep/technical-drawing` | `packages/foundation/capability/technical-drawing` | needs-remediation | 19 | 224 | 0 | 126 |
| 63 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 5 | 111 | 0 | 0 |
| 64 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 0 |
| 65 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 217 | 1 | 3 |
| 66 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 6 | 22 | 0 | 0 |
| 67 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 5 |
| 68 | `@beep/documents-domain` | `packages/documents/domain` | clean | 26 | 81 | 0 | 0 |
| 69 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 47 | 0 | 0 |
| 70 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 25 | 0 | 0 |
| 71 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 34 | 88 | 1 | 0 |
| 72 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 103 | 651 | 4 | 4 |
| 73 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 33 | 3 | 4 |
| 74 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 42 | 4 | 2 |
| 75 | `@beep/box` | `packages/drivers/box` | needs-remediation | 7 | 878 | 0 | 2 |
| 76 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 24 | 56 | 8 | 4 |
| 77 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 8 | 166 | 2 | 0 |
| 78 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 312 | 13 | 0 |
| 79 | `@beep/xdg` | `packages/foundation/capability/xdg` | clean | 6 | 24 | 0 | 0 |
| 80 | `@beep/epistemic-client` | `packages/epistemic/client` | clean | 4 | 24 | 0 | 0 |
| 81 | `@beep/ui` | `packages/foundation/ui-system/ui` | clean | 132 | 557 | 0 | 0 |
| 82 | `@beep/t3-code` | `packages/drivers/t3-code` | clean | 4 | 17 | 0 | 0 |
| 83 | `@beep/github-reporting` | `packages/foundation/modeling/github-reporting` | clean | 5 | 40 | 0 | 0 |
| 84 | `@beep/poppler` | `packages/drivers/poppler` | clean | 3 | 9 | 0 | 0 |
| 85 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 103 | 0 | 0 |
| 86 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 10 | 94 | 0 | 3 |
| 87 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 17 | 91 | 3 | 0 |
| 88 | `@beep/skill-contract` | `packages/foundation/modeling/skill-contract` | needs-remediation | 9 | 113 | 0 | 79 |
| 89 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 0 |
| 90 | `@beep/repo-tsconfig` | `packages/tooling/library/repo-tsconfig` | clean | 4 | 15 | 0 | 0 |
| 91 | `@beep/palantiri` | `packages/tooling/library/palantiri` | clean | 20 | 156 | 0 | 0 |
| 92 | `@beep/pdf-tools` | `packages/drivers/pdf-tools` | clean | 4 | 38 | 0 | 0 |
| 93 | `@beep/runpod` | `packages/drivers/runpod` | clean | 7 | 204 | 0 | 0 |
| 94 | `@beep/tesseract` | `packages/drivers/tesseract` | clean | 3 | 15 | 0 | 0 |
| 95 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 0 |
| 96 | `@beep/lockfiles` | `packages/foundation/modeling/lockfiles` | clean | 14 | 47 | 0 | 0 |
| 97 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 24 | 197 | 0 | 1 |
| 98 | `@beep/occt` | `packages/drivers/occt` | clean | 4 | 13 | 0 | 0 |
| 99 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 0 |
| 100 | `@beep/dock` | `packages/foundation/ui-system/dock` | needs-remediation | 20 | 212 | 0 | 189 |
| 101 | `@beep/commands` | `packages/drivers/commands` | clean | 8 | 58 | 0 | 0 |
| 102 | `@beep/git` | `packages/drivers/git` | clean | 5 | 44 | 0 | 0 |
| 103 | `@beep/agents-tables` | `packages/agents/tables` | clean | 7 | 15 | 0 | 0 |
| 104 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 6 | 31 | 0 | 0 |
| 105 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 6 | 124 | 4 | 7 |
| 106 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 107 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 18 | 1 | 0 |
| 108 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 109 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 110 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 23 | 56 | 0 | 0 |
| 111 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 11 | 0 | 0 |
| 112 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 92 | 0 | 0 |
| 113 | `@beep/documents-tables` | `packages/documents/tables` | clean | 19 | 48 | 0 | 0 |
| 114 | `@beep/documents-use-cases` | `packages/documents/use-cases` | clean | 23 | 124 | 0 | 0 |
| 115 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 20 | 0 | 0 |
| 116 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 20 | 0 | 0 |
| 117 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 63 | 0 | 0 |
| 118 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 73 | 346 | 1 | 1 |
| 119 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 6 | 172 | 2 | 0 |
| 120 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 85 | 2 | 2 |
| 121 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 72 | 1 | 0 |
| 122 | `@beep/mcpb-kit` | `packages/tooling/library/mcpb-kit` | clean | 5 | 25 | 0 | 0 |
| 123 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 13 | 109 | 0 | 3 |
| 124 | `@beep/windows-secrets` | `packages/drivers/windows-secrets` | clean | 4 | 13 | 0 | 0 |
| 125 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 88 | 12 | 0 |
| 126 | `@beep/openai` | `packages/drivers/openai` | clean | 4 | 16 | 0 | 0 |
| 127 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 128 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 15 | 0 | 0 |
| 129 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 6 | 14 | 0 | 0 |
| 130 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 0 |
| 131 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 15 | 157 | 5 | 54 |
| 132 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 472 | 4451 | 47 | 35 |
| 133 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | needs-remediation | 3 | 12 | 0 | 10 |
| 134 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 3 | 11 | 0 | 0 |
| 135 | `@beep/repo-workspaces` | `packages/tooling/library/repo-workspaces` | clean | 27 | 244 | 0 | 0 |
| 136 | `@beep/sbom` | `packages/foundation/modeling/sbom` | clean | 9 | 75 | 0 | 0 |
| 137 | `@beep/github-references` | `packages/foundation/modeling/github-references` | clean | 4 | 28 | 0 | 0 |
| 138 | `@beep/brand` | `packages/foundation/ui-system/brand` | needs-remediation | 7 | 50 | 0 | 43 |
| 139 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 42 | 2 | 0 |
| 140 | `@beep/editor` | `packages/foundation/ui-system/editor` | needs-remediation | 34 | 210 | 13 | 3 |
| 141 | `@beep/ontology-server` | `packages/ontology/server` | clean | 8 | 23 | 0 | 0 |
| 142 | `@beep/xstate` | `packages/drivers/xstate` | clean | 6 | 26 | 0 | 0 |
| 143 | `@beep/workspace-server` | `packages/workspace/server` | clean | 12 | 31 | 0 | 0 |
| 144 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 27 | 0 | 0 |
| 145 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 104 | 2 | 0 |
| 146 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 15 |
| 147 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 6 | 0 | 0 |
| 148 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 33 | 0 | 0 |
| 149 | `@beep/practice-claude-mod` | `apps/practice-claude-mod` | clean | 8 | 30 | 0 | 0 |
| 150 | `@beep/public-site` | `packages/foundation/modeling/public-site` | clean | 4 | 27 | 0 | 0 |
| 151 | `@beep/practice-mail-tagging` | `apps/practice-mail-tagging` | clean | 8 | 44 | 0 | 0 |
| 152 | `@beep/schema-org` | `packages/foundation/modeling/schema-org` | clean | 13 | 57 | 0 | 0 |
| 153 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 13 | 46 | 2 | 0 |
| 154 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 155 | `@beep/docket-intake` | `apps/docket-intake` | clean | 12 | 34 | 0 | 0 |
| 156 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 40 | 6 | 0 |
| 157 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 6 | 0 | 0 |
| 158 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 1 |
| 159 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 14 | 41 | 1 | 0 |
| 160 | `@beep/practice-gateway` | `apps/practice-gateway` | clean | 20 | 143 | 0 | 0 |
| 161 | `@beep/oip-web` | `apps/oip-web` | clean | 31 | 87 | 0 | 0 |
| 162 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 163 | `@beep/shared-tables` | `packages/shared/tables` | clean | 9 | 12 | 0 | 0 |
| 164 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 106 | 646 | 84 | 0 |
| 165 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | clean | 16 | 73 | 0 | 0 |
| 166 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 167 | `@beep/todox` | `apps/todox` | clean | 16 | 57 | 0 | 0 |
| 168 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 53 | 0 | 0 |
| 169 | `@beep/practice-m365-contacts` | `apps/practice-m365-contacts` | clean | 8 | 27 | 0 | 0 |
| 170 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 65 | 241 | 25 | 0 |
| 171 | `@beep/jsonl` | `packages/foundation/modeling/jsonl` | clean | 8 | 60 | 0 | 0 |
| 172 | `@beep/practice-identify` | `apps/practice-identify` | clean | 3 | 10 | 0 | 0 |
| 173 | `@beep/infra` | `infra` | needs-remediation | 11 | 107 | 3 | 22 |
| 174 | `@beep/practice-setup` | `apps/practice-setup` | clean | 6 | 38 | 0 | 0 |
| 175 | `@beep/box-provisioning` | `packages/drivers/box-provisioning` | needs-remediation | 15 | 184 | 0 | 21 |
| 176 | `@beep/freshbooks` | `packages/drivers/freshbooks` | needs-remediation | 6 | 49 | 5 | 3 |
| 177 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 178 | `@beep/practice-review-hub` | `apps/practice-review-hub` | clean | 3 | 12 | 0 | 0 |
| 179 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 31 | 7 | 0 |
| 180 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 181 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 182 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | needs-remediation | 6 | 202 | 0 | 5 |

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
- `src/Fibered.ts:219` `Fibered` (const) - 1 example import violation(s)
- `src/Id.ts:170` `IdentityInterpolationError` (class) - 1 example import violation(s)
- `src/Id.ts:204` `IdentitySegmentCountError` (class) - 1 example import violation(s)
- `src/Id.ts:245` `SegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:381` `TitleFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:406` `IriFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:435` `CurieFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:465` `SlugFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:508` `ModuleSegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:529` `ModuleAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:550` `TaggedAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:569` `IdentityString` (type) - 2 example import violation(s)
- `src/Id.ts:590` `IdentitySymbol` (type) - 2 example import violation(s)
- `src/Id.ts:613` `SchemaAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:639` `DeclarationAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:674` `ErrorAnnotationRecord` (interface) - 1 example import violation(s)
- `src/Id.ts:696` `KeyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:719` `SkosClassification` (type) - 1 example import violation(s)
- `src/Id.ts:742` `OntologyKeyOptions` (type) - 1 example import violation(s)
- `src/Id.ts:773` `OntologyClassExtras` (type) - 1 example import violation(s)
- `src/Id.ts:807` `HttpAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:833` `IdentityAnyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:860` `IdentityAnnotation` (type) - 1 example import violation(s)
- `src/Id.ts:928` `IdentityAnnotationResult` (type) - 1 example import violation(s)
- `src/Id.ts:963` `AnnotatedSchema` (type) - 1 example import violation(s)
- `src/Id.ts:980` `TaggedModuleRecord` (type) - 1 example import violation(s)
- `src/Id.ts:1043` `IdentityComposer` (interface) - 1 example import violation(s)
- `src/Id.ts:1655` `BaseIdentityInput` (const) - 1 example import violation(s)
- `src/Id.ts:1684` `BaseIdentityInput` (type) - 1 example import violation(s)
- `src/Id.ts:2200` `make` (const) - 2 example import violation(s)
- `src/IdentityRegistry.ts:34` `IdentityEncoding` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:66` `IdentityRef` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:104` `IdentityEntry` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:182` `IdentityNotFoundError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:210` `IdentityRegistryConflictError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:252` `IdentityRegistry` (class) - 1 example import violation(s)
- `src/PnLocal.ts:169` `SafePnLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:198` `SafePnLocal` (type) - 1 example import violation(s)
- `src/PnLocal.ts:217` `SafePnPrefix` (const) - 1 example import violation(s)
- `src/PnLocal.ts:246` `SafePnPrefix` (type) - 1 example import violation(s)
- `src/PnLocal.ts:265` `isSafeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:282` `isSafePrefix` (const) - 1 example import violation(s)
- `src/PnLocal.ts:375` `EscapedPnLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:404` `EscapedPnLocal` (type) - 1 example import violation(s)
- `src/PnLocal.ts:422` `acceptsEscapedLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:438` `unescapeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:460` `escapeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:480` `prefixedNameOrIri` (const) - 1 example import violation(s)
- `src/Vocab.ts:37` `VocabShape` (type) - 1 example import violation(s)
- `src/Vocab.ts:63` `VocabEntry` (class) - 1 example import violation(s)
- `src/Vocab.ts:90` `VocabRegistry` (const) - 1 example import violation(s)
- `src/Vocab.ts:111` `VocabRegistry` (type) - 1 example import violation(s)
- `src/Vocab.ts:130` `CoreVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:378` `CoreVocab` (type) - 1 example import violation(s)
- `src/Vocab.ts:395` `Curie` (type) - 1 example import violation(s)
- `src/Vocab.ts:414` `Predicate` (type) - 1 example import violation(s)
- `src/Vocab.ts:431` `Expand` (type) - 1 example import violation(s)
- `src/Vocab.ts:473` `mergeVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:498` `SemanticFoundationVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:525` `SemanticFoundationVocab` (type) - 1 example import violation(s)
- `src/Vocab.ts:540` `SparVocab` (const) - 1 example import violation(s)
- `src/index.ts:31` `export * from "./Curie.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:56` `export * from "./Fibered.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:72` `export * from "./Id.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:87` `export * from "./IdentityRegistry.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:105` `export * from "./PnLocal.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:120` `export * from "./packages.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:135` `export * from "./Vocab.ts";` (re-export) - 1 example import violation(s)
- `src/packages.ts:369` `$DataId` (const) - 1 example import violation(s)
- `src/packages.ts:385` `$IdentityId` (const) - 1 example import violation(s)
- `src/packages.ts:401` `$SchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:417` `$ProvenanceId` (const) - 1 example import violation(s)
- `src/packages.ts:433` `$RdfId` (const) - 1 example import violation(s)
- `src/packages.ts:533` `$TypesId` (const) - 1 example import violation(s)
- `src/packages.ts:549` `$UtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:567` `$UiId` (const) - 1 example import violation(s)
- `src/packages.ts:585` `$RepoAiMetricsId` (const) - 1 example import violation(s)
- `src/packages.ts:601` `$RepoCliId` (const) - 1 example import violation(s)
- `src/packages.ts:617` `$RepoConfigsId` (const) - 1 example import violation(s)
- `src/packages.ts:633` `$RepoUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:649` `$TestUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:667` `$SharedDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:700` `$SharedTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:716` `$SemanticWebId` (const) - 1 example import violation(s)
- `src/packages.ts:732` `$NlpId` (const) - 1 example import violation(s)
- `src/packages.ts:764` `$LangExtractId` (const) - 1 example import violation(s)
- `src/packages.ts:780` `$ObservabilityId` (const) - 1 example import violation(s)
- `src/packages.ts:796` `$ColorsId` (const) - 1 example import violation(s)
- `src/packages.ts:812` `$ChalkId` (const) - 1 example import violation(s)
- `src/packages.ts:828` `$RepoDocgenId` (const) - 1 example import violation(s)
- `src/packages.ts:844` `$InfraId` (const) - 1 example import violation(s)
- `src/packages.ts:862` `$WorkspaceDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:878` `$EpistemicDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:895` `$EpistemicUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:912` `$AgentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:928` `$AgentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:944` `$AgentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:960` `$AgentsClientId` (const) - 1 example import violation(s)
- `src/packages.ts:976` `$LawPracticeDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:994` `$LawPracticeUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1012` `$LawPracticeServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1029` `$ProfessionalDesktopId` (const) - 1 example import violation(s)
- `src/packages.ts:1159` `$AnthropicId` (const) - 1 example import violation(s)
- `src/packages.ts:1176` `$AcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1193` `$OpenaiCompatId` (const) - 1 example import violation(s)
- `src/packages.ts:1210` `$WorkspaceTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1227` `$WorkspaceUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1245` `$WorkspaceServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1262` `$DocumentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1279` `$DocumentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1297` `$DocumentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1314` `$ArchitectureLabDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1332` `$ArchitectureLabUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1350` `$ArchitectureLabConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:1368` `$ArchitectureLabServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1386` `$ArchitectureLabTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1404` `$ArchitectureLabClientId` (const) - 1 example import violation(s)
- `src/packages.ts:1422` `$ArchitectureLabUiId` (const) - 1 example import violation(s)
- `src/packages.ts:1440` `$ArchitectureLabProofId` (const) - 1 example import violation(s)
- `src/packages.ts:1458` `$RunpodId` (const) - 1 example import violation(s)
- `src/packages.ts:1475` `$OnepasswordCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1492` `$DiscordId` (const) - 1 example import violation(s)
- `src/packages.ts:1509` `$AiProviderCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1526` `$SanityId` (const) - 1 example import violation(s)
- `src/packages.ts:1543` `$HubspotId` (const) - 1 example import violation(s)
- `src/packages.ts:1560` `$PhoenixId` (const) - 1 example import violation(s)
- `src/packages.ts:1577` `$AiSyncId` (const) - 1 example import violation(s)
- `src/packages.ts:1594` `$BoxId` (const) - 1 example import violation(s)
- `src/packages.ts:1611` `$NlpMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1645` `$WinkId` (const) - 1 example import violation(s)
- `src/packages.ts:1662` `$FileProcessingId` (const) - 1 example import violation(s)
- `src/packages.ts:1679` `$TikaId` (const) - 1 example import violation(s)
- `src/packages.ts:1696` `$LibpffId` (const) - 1 example import violation(s)
- `src/packages.ts:1713` `$UsptoId` (const) - 1 example import violation(s)
- `src/packages.ts:1730` `$LexicalSchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:1747` `$EditorId` (const) - 1 example import violation(s)
- `src/packages.ts:1764` `$ScratchpadId` (const) - 1 example import violation(s)
- `src/packages.ts:1781` `$HtmlId` (const) - 1 example import violation(s)
- `src/packages.ts:1798` `$PandocAstId` (const) - 1 example import violation(s)
- `src/packages.ts:1815` `$PgliteId` (const) - 1 example import violation(s)
- `src/packages.ts:1832` `$M365Id` (const) - 1 example import violation(s)
- `src/packages.ts:1849` `$M365McpId` (const) - 1 example import violation(s)
- `src/packages.ts:1866` `$GovinfoId` (const) - 1 example import violation(s)
- `src/packages.ts:1883` `$EcfrId` (const) - 1 example import violation(s)
- `src/packages.ts:1900` `$ApiTransportId` (const) - 1 example import violation(s)
- `src/packages.ts:1917` `$McpKitId` (const) - 1 example import violation(s)
- `src/packages.ts:1934` `$UsptoMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1951` `$PacerId` (const) - 1 example import violation(s)
- `src/packages.ts:1968` `$FcRunsId` (const) - 1 example import violation(s)
- `src/packages.ts:1985` `$CosmosId` (const) - 1 example import violation(s)
- `src/packages.ts:2002` `$DbAdminId` (const) - 1 example import violation(s)
- `src/packages.ts:2019` `$EpistemicServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2036` `$EpistemicTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2053` `$LintRulesId` (const) - 1 example import violation(s)
- `src/packages.ts:2070` `$N3Id` (const) - 1 example import violation(s)
- `src/packages.ts:2087` `$PretextId` (const) - 1 example import violation(s)
- `src/packages.ts:2104` `$Graph3dId` (const) - 1 example import violation(s)
- `src/packages.ts:2121` `$DockId` (const) - 1 example import violation(s)
- `src/packages.ts:2138` `$DockReactId` (const) - 1 example import violation(s)
- `src/packages.ts:2155` `$OntologyClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2172` `$OntologyConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2189` `$OntologyDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:2206` `$OntologyServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2223` `$OntologyUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2240` `$OntologyUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:2257` `$OxigraphId` (const) - 1 example import violation(s)
- `src/packages.ts:2274` `$ShaclId` (const) - 1 example import violation(s)
- `src/packages.ts:2291` `$StorybookId` (const) - 1 example import violation(s)
- `src/packages.ts:2308` `$TsgoShimId` (const) - 1 example import violation(s)
- `src/packages.ts:2325` `$DocTextId` (const) - 1 example import violation(s)
- `src/packages.ts:2342` `$DocumentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2359` `$TailscaleId` (const) - 1 example import violation(s)
- `src/packages.ts:2376` `$AgentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2393` `$EpistemicConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2410` `$LawPracticeTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2428` `$PracticeKgMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2445` `$OpenclawId` (const) - 1 example import violation(s)
- `src/packages.ts:2462` `$ObsId` (const) - 1 example import violation(s)
- `src/packages.ts:2479` `$ExiftoolId` (const) - 1 example import violation(s)
- `src/packages.ts:2496` `$QaCaptureId` (const) - 1 example import violation(s)
- `src/packages.ts:2513` `$GovLegalMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2529` `$EpistemicClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2545` `$EpistemicUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2578` `$SkillContractId` (const) - 1 example import violation(s)
- `src/packages.ts:2595` `$CodegenKitId` (const) - 1 example import violation(s)
- `src/packages.ts:2612` `$BrandId` (const) - 1 example import violation(s)
- `src/packages.ts:2629` `$OpenaiId` (const) - 1 example import violation(s)
- `src/packages.ts:2646` `$TodoxId` (const) - 1 example import violation(s)
- `src/packages.ts:2663` `$BoxProvisioningId` (const) - 1 example import violation(s)

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
- `src/Number.ts:44` `isPositive` (const) - 1 documentation section/link violation(s)
- `src/Number.ts:88` `isInteger` (const) - 1 example import violation(s)
- `src/Option.ts:132` `propFromNullishOr` (const) - 1 example import violation(s)
- `src/Option.ts:181` `getSomesStruct` (const) - 1 example import violation(s)
- `src/Predicate.ts:207` `chainRefinements` (function) - 1 example import violation(s)
- `src/Predicate.ts:156` `hasInspectableObjectShape` (const) - 1 example import violation(s)
- `src/Str.ts:846` `export * from "effect/String";` (re-export) - 1 example import violation(s)
- `src/Str.ts:43` `equivalence` (const) - 1 example import violation(s)
- `src/Str.ts:73` `orderAsc` (const) - 1 example import violation(s)
- `src/Str.ts:120` `prefix` (const) - 1 example import violation(s)
- `src/Str.ts:161` `prefixThunk` (const) - 1 example import violation(s)
- `src/Str.ts:214` `postfix` (const) - 1 example import violation(s)
- `src/Str.ts:255` `postfixThunk` (const) - 1 example import violation(s)
- `src/Str.ts:296` `mapPrefix` (const) - 1 example import violation(s)
- `src/Str.ts:336` `mapPostfix` (const) - 1 example import violation(s)
- `src/Str.ts:362` `camelCase` (const) - 1 example import violation(s)
- `src/Str.ts:380` `snakeCase` (const) - 1 example import violation(s)
- `src/Str.ts:398` `kebabCase` (const) - 1 example import violation(s)
- `src/Str.ts:417` `screamingSnake` (const) - 1 example import violation(s)
- `src/Str.ts:436` `pascalCase` (const) - 1 example import violation(s)
- `src/Str.ts:454` `pascalToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:473` `snakeToCamel` (const) - 1 example import violation(s)
- `src/Str.ts:492` `snakeToKebab` (const) - 1 example import violation(s)
- `src/Str.ts:511` `camelToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:530` `snakeToPascal` (const) - 1 example import violation(s)
- `src/Str.ts:549` `kebabToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:576` `startsWith` (const) - 1 example import violation(s)
- `src/Str.ts:616` `endsWith` (const) - 1 example import violation(s)
- `src/Str.ts:661` `contains` (const) - 1 example import violation(s)
- `src/Str.ts:705` `repeat` (const) - 1 example import violation(s)
- `src/Str.ts:759` `replaceWith` (const) - 1 example import violation(s)
- `src/Str.ts:813` `replaceAllWith` (const) - 1 example import violation(s)
- `src/Str.ts:866` `trimThunk` (const) - 1 example import violation(s)
- `src/Str.ts:886` `fromNumber` (const) - 1 example import violation(s)
- `src/Str.ts:903` `toSlug` (const) - 1 example import violation(s)
- `src/Str.ts:941` `truncate` (const) - 1 example import violation(s)
- `src/Str.ts:967` `orEmpty` (const) - 1 example import violation(s)
- `src/Str.ts:1015` `matchEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:175` `dotGet` (const) - 1 example import violation(s)
- `src/Struct.ts:222` `dotGetOption` (const) - 1 example import violation(s)
- `src/Struct.ts:289` `mapPath` (const) - 1 example import violation(s)
- `src/Struct.ts:367` `mapPathLazy` (const) - 1 example import violation(s)
- `src/Struct.ts:449` `getLazy` (const) - 1 example import violation(s)
- `src/Struct.ts:484` `pathsOf` (const) - 1 example import violation(s)
- `src/Struct.ts:604` `entriesNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:635` `keys` (const) - 1 example import violation(s)
- `src/Struct.ts:661` `keysNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:696` `fromEntries` (const) - 1 example import violation(s)
- `src/Struct.ts:804` `reverse` (const) - 1 example import violation(s)
- `src/Struct.ts:926` `deepMerge` (const) - 1 example import violation(s)
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
- `src/LiteralKit/internal/builders.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Percentage.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UnitInterval.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:37` `credentialRules` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:158` `detectCredentials` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:192` `countCredentialCategory` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:244` `replaceCredentialCategory` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:278` `replaceCredentialAssignmentsOutsideHeaders` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:308` `maskCredentialMatches` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.policy.ts:353` `maskCredentialCategory` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.schema.ts:26` `credentialPatternBankVersion` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.schema.ts:39` `CredentialCategory` (const) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.schema.ts:63` `CredentialCategory` (type) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.schema.ts:75` `CredentialRule` (class) - 1 example import violation(s)
- `src/CredentialPatternBank/CredentialPatternBank.schema.ts:100` `CredentialMatch` (class) - 1 example import violation(s)
- `src/Email.ts:33` `EmailString` (const) - 1 example import violation(s)
- `src/Email.ts:52` `EmailString` (type) - 2 example import violation(s)
- `src/Email.ts:76` `Email` (const) - 1 example import violation(s)
- `src/Email.ts:96` `Email` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:50` `Added` (class) - 1 example import violation(s)
- `src/FileDiff.schema.ts:84` `Deleted` (class) - 1 example import violation(s)
- `src/FileDiff.schema.ts:119` `Modified` (class) - 1 example import violation(s)
- `src/FileDiff.schema.ts:153` `Info` (const) - 1 example import violation(s)
- `src/FileDiff.schema.ts:175` `Info` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:193` `Info` (namespace) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:528` `ThunkOf` (function) - 3 example import violation(s)
- `src/Fn/Fn.schema.ts:598` `Fn` (function) - 5 example import violation(s)
- `src/Fn/Fn.schema.ts:481` `AnyFn` (const) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:503` `AnyFn` (type) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:93` `BlockedHostError` (class) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:283` `isBlockedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:328` `assertAllowedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:393` `assertAllowedRemoteUrl` (const) - 1 example import violation(s)
- `src/SemanticVersion.ts:53` `SemanticVersionSchema` (interface) - 1 documentation section/link violation(s)
- `src/Slug.ts:52` `SlugChecks` (const) - 1 example import violation(s)
- `src/index.ts:195` `export * from "./Port.ts";` (re-export) - 1 example import violation(s)

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
- `src/schemas/TSConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/WorkspaceDeps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
- `src/Html.conformance.ts:222` `ConformantHtmlNode` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:43` `InputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:128` `resolveInputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:157` `inputStateAllowedAttributes` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:231` `ButtonState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:303` `resolveButtonState` (const) - 1 example import violation(s)
- `src/Html.meta.ts:607` `HTML_GLOBAL_ATTRIBUTE_NAMES` (const) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:511` `SafeHtmlAst` (const) - 1 example import violation(s)
- `src/Html.policy.ts:536` `SafeHtmlAst` (type) - 1 example import violation(s)
- `src/Html.policy.ts:558` `SafeHtmlNode` (const) - 1 example import violation(s)
- `src/Html.policy.ts:813` `inspectSafeHtml` (const) - 1 example import violation(s)
- `src/Html.policy.ts:842` `enforceSafeHtml` (const) - 1 example import violation(s)
- `src/Html.policy.ts:868` `safeHtmlAstConformant` (const) - 1 example import violation(s)
- `src/Html.policy.ts:896` `safeHtmlAstRoot` (const) - 1 example import violation(s)
- `src/Html.script.ts:44` `HtmlMimeType` (const) - 1 example import violation(s)
- `src/Html.script.ts:86` `JavaScriptMimeTypeEssence` (const) - 1 example import violation(s)
- `src/Html.script.ts:140` `ScriptDataBlockMimeType` (const) - 1 example import violation(s)
- `src/Html.script.ts:195` `ScriptState` (const) - 1 example import violation(s)
- `src/Html.script.ts:236` `InvalidScriptType` (class) - 1 example import violation(s)
- `src/Html.script.ts:293` `resolveScriptState` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:147` `SafeHtml` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:180` `SafeHtml` (type) - 1 example import violation(s)
- `src/Html.serialize.ts:613` `serialize` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:638` `serializeConformant` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:687` `serializeSafe` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:708` `untrustedHtmlValue` (const) - 1 example import violation(s)
- `src/Html.serialize.ts:741` `safeHtmlValue` (const) - 1 example import violation(s)
- `src/Html.source-size.ts:831` `inspectSourceSizeList` (const) - 1 documentation section/link violation(s)

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
- `src/Md.conformance.ts:402` `refineStrictMarkdownDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:486` `inspectMarkdownSpecificationConformance` (const) - 1 example import violation(s)
- `src/Md.escape.ts:717` `maxBackticks` (const) - 1 example import violation(s)
- `src/Md.escape.ts:786` `renderFencedCode` (const) - 1 example import violation(s)
- `src/Md.html.ts:42` `renderSafeHtml` (const) - 1 example import violation(s)
- `src/Md.render.ts:884` `renderMarkdownInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:943` `renderHtmlInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:962` `renderMarkdownBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:997` `renderHtmlBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:1032` `renderMarkdownBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:1052` `renderHtmlBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:1077` `renderUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:1098` `renderHtmlUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:1119` `renderPlainTextUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:1164` `renderWithUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:1199` `renderEffectWithUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:1241` `renderEffectWith` (const) - 1 example import violation(s)
- `src/Md.render.ts:1634` `makeMarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1662` `makeHtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1688` `MarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1712` `HtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1731` `PlainTextAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1758` `renderWith` (const) - 1 example import violation(s)
- `src/Md.render.ts:1792` `render` (const) - 1 example import violation(s)
- `src/Md.render.ts:1817` `renderHtml` (const) - 1 example import violation(s)
- `src/Md.render.ts:1842` `renderPlainText` (const) - 1 example import violation(s)
- `src/Md.safe.ts:750` `documentSafetyIssues` (const) - 1 example import violation(s)
- `src/Md.safe.ts:776` `inlineSafetyIssuesAtRoot` (const) - 1 example import violation(s)
- `src/Md.safe.ts:968` `refineSafeDocument` (const) - 1 example import violation(s)
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

### @beep/provenance

Path: `packages/foundation/modeling/provenance`

Module findings:
- `src/TextAnchor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/rdf

Path: `packages/foundation/modeling/rdf`

Module findings:
- `src/Vocab/Dcterms.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `src/Iri.ts:873` `IRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:914` `RelativeIRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:954` `AbsoluteIRI` (const) - 1 example import violation(s)
- `src/Iri.ts:995` `IRI` (const) - 1 example import violation(s)
- `src/Vocab/Xsd.ts:27` `XSD_NAMESPACE` (const) - 1 documentation section/link violation(s)

### @beep/colors

Path: `packages/foundation/capability/colors`

Module findings:
- `src/Colors.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/Colors.ts:63` `ProcessLikeStdout` (class) - 1 example import violation(s)
- `src/Colors.ts:92` `ProcessLike` (class) - 1 example import violation(s)
- `src/Colors.ts:182` `Formatter` (const) - 1 example import violation(s)
- `src/Colors.ts:199` `Formatter` (type) - 1 example import violation(s)
- `src/Colors.ts:239` `supportsColor` (const) - 1 example import violation(s)
- `src/Colors.ts:255` `isColorSupported` (const) - 1 example import violation(s)
- `src/Colors.ts:279` `Colors` (class) - 1 example import violation(s)
- `src/Colors.ts:328` `createColors` (const) - 1 example import violation(s)
- `src/Colors.ts:396` `default` (const) - 1 example import violation(s)

### @beep/semantic-web

Path: `packages/foundation/capability/semantic-web`

Export findings:
- `src/identity/IdentityRdfBinding.ts:98` `IdentityRdfBinding` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:143` `DefaultIdentityRdfBinding` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:164` `IdentityFiberPathError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:192` `IdentityEntryIriError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:220` `IdentityDatasetDecodeError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:262` `decodeEntrySubject` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:446` `entriesToDataset` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:500` `datasetToEntries` (const) - 1 example import violation(s)
- `src/identity/IdentityRegistryDataset.ts:43` `layerDataset` (const) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:89` `IdentityShapePolicy` (class) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:127` `projectShapes` (const) - 1 example import violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/file-processing

Path: `packages/foundation/capability/file-processing`

Export findings:
- `src/SecretScrub/SecretScrub.policy.ts:36` `PromptAdmissibleText` (type) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.policy.ts:50` `promptTextFromScrub` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.policy.ts:69` `secretRetentionDeadline` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.policy.ts:87` `isSecretPurgeEligible` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:26` `SecretCoverage` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:42` `SecretCoverage` (type) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:53` `SecretResidue` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:69` `SecretResidue` (type) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:80` `SecretRetentionClass` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:96` `SecretRetentionClass` (type) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:110` `SecretRetentionRecord` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:133` `SecretCategoryCount` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:155` `SecretEvidence` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:184` `SecretScrubProof` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:209` `SecretScrubInput` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.schema.ts:233` `SecretScrubResult` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.service.ts:38` `SecretScrubService` (class) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.service.ts:57` `scrubSecretText` (const) - 1 example import violation(s)
- `src/SecretScrub/SecretScrub.service.ts:128` `SecretScrubLive` (const) - 1 example import violation(s)

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
- `src/CauseDiagnostics.ts:208` `CauseSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:279` `ObservedExitSummary` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:300` `ObservedExitSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:429` `classifyCause` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:452` `fingerprintCause` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:477` `summarizeCause` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:528` `summarizeExit` (const) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:587` `renderObservedCause` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:74` `REDACTION_PLACEHOLDER` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:94` `DEFAULT_MESSAGE_LIMIT` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:114` `DEFAULT_DETAIL_LIMIT` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:133` `RedactionChannel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:154` `RedactionChannel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:193` `sanitizeSensitiveText` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:218` `redactString` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:248` `RedactedCause` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:287` `RedactCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:382` `redactCauseSummary` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:418` `redactCause` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:448` `redactCauseForClient` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:472` `RedactedCauseError` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:510` `redactCauseEffect` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:539` `RedactedCauseLogLevel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:560` `RedactedCauseLogLevel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:577` `LogRedactedCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:623` `logRedactedCause` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:664` `tapRedactedCause` (const) - 1 example import violation(s)
- `src/CoreConfig.ts:45` `ObservabilityCoreConfig` (const) - 1 example import violation(s)
- `src/CoreConfig.ts:69` `ObservabilityCoreConfig` (type) - 1 example import violation(s)
- `src/HttpError.ts:166` `ClientHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:207` `ServerHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:243` `BadRequestError` (class) - 2 example import violation(s)
- `src/HttpError.ts:273` `UnauthorizedError` (class) - 2 example import violation(s)
- `src/HttpError.ts:303` `ForbiddenError` (class) - 2 example import violation(s)
- `src/HttpError.ts:333` `NotFoundError` (class) - 2 example import violation(s)
- `src/HttpError.ts:361` `ConflictError` (class) - 2 example import violation(s)
- `src/HttpError.ts:389` `UnprocessableEntityError` (class) - 2 example import violation(s)
- `src/HttpError.ts:420` `TooManyRequestsError` (class) - 2 example import violation(s)
- `src/HttpError.ts:450` `InternalServerErrorError` (class) - 2 example import violation(s)
- `src/HttpError.ts:481` `BadGatewayError` (class) - 2 example import violation(s)
- `src/HttpError.ts:511` `ServiceUnavailableError` (class) - 2 example import violation(s)
- `src/HttpError.ts:541` `GatewayTimeoutError` (class) - 2 example import violation(s)
- `src/HttpError.ts:569` `makeBadRequestError` (const) - 1 example import violation(s)
- `src/HttpError.ts:589` `makeUnauthorizedError` (const) - 1 example import violation(s)
- `src/HttpError.ts:609` `makeForbiddenError` (const) - 1 example import violation(s)
- `src/HttpError.ts:629` `makeNotFoundError` (const) - 1 example import violation(s)
- `src/HttpError.ts:649` `makeConflictError` (const) - 1 example import violation(s)
- `src/HttpError.ts:669` `makeUnprocessableEntityError` (const) - 1 example import violation(s)
- `src/HttpError.ts:689` `makeTooManyRequestsError` (const) - 1 example import violation(s)
- `src/HttpError.ts:709` `makeInternalServerError` (const) - 1 example import violation(s)
- `src/HttpError.ts:729` `makeBadGatewayError` (const) - 1 example import violation(s)
- `src/HttpError.ts:749` `makeServiceUnavailableError` (const) - 1 example import violation(s)
- `src/HttpError.ts:769` `makeGatewayTimeoutError` (const) - 1 example import violation(s)
- `src/Logging.ts:62` `LogFormat` (const) - 1 example import violation(s)
- `src/Logging.ts:83` `LogFormat` (type) - 1 example import violation(s)
- `src/Logging.ts:100` `PrettyLogTheme` (const) - 1 example import violation(s)
- `src/Logging.ts:121` `PrettyLogTheme` (type) - 1 example import violation(s)
- `src/Logging.ts:138` `BannerMode` (const) - 1 example import violation(s)
- `src/Logging.ts:159` `BannerMode` (type) - 1 example import violation(s)
- `src/Logging.ts:180` `PrettyLoggerConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:210` `LoggingConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:244` `layerMinimumLogLevel` (const) - 1 example import violation(s)
- `src/Logging.ts:263` `RenderLogBannerOptions` (class) - 1 example import violation(s)
- `src/Logging.ts:374` `renderLogBanner` (const) - 1 example import violation(s)
- `src/Logging.ts:467` `layerConsoleLogger` (const) - 1 example import violation(s)
- `src/Metric.ts:59` `TrackDurationOptions` (class) - 1 example import violation(s)
- `src/Metric.ts:87` `TrackDurationOptionsInput` (type) - 1 example import violation(s)
- `src/Metric.ts:210` `statusClass` (const) - 1 example import violation(s)
- `src/Metric.ts:245` `measureElapsedMillis` (const) - 1 example import violation(s)
- `src/Metric.ts:331` `trackDuration` (const) - 1 example import violation(s)
- `src/Metric.ts:462` `observeWorkflow` (const) - 1 example import violation(s)
- `src/Metric.ts:615` `observeHttpRequest` (const) - 1 example import violation(s)
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
- `src/PhaseProfiler.ts:308` `profilePhase` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:37` `DevToolsSpanFilter` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:63` `DevToolsSpanFilter` (type) - 1 example import violation(s)
- `src/server/DevTools.ts:216` `layerFilteredDevToolsTracer` (const) - 1 example import violation(s)

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
- `src/ApiKeyRequired.ts:76` `ApiKeyRequiredFailure` (class) - 1 example import violation(s)
- `src/ApiKeyRequired.ts:133` `apiKeyRequiredFailure` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/FieldTier.ts:50` `FieldTierName` (const) - 1 example import violation(s)
- `src/FieldTier.ts:71` `FieldTierName` (type) - 1 example import violation(s)
- `src/FieldTier.ts:96` `FieldTierSet` (interface) - 1 example import violation(s)
- `src/FieldTier.ts:130` `defineFieldTiers` (const) - 1 example import violation(s)
- `src/FieldTier.ts:157` `stripNulls` (const) - 1 example import violation(s)
- `src/FieldTier.ts:189` `projectFieldTier` (const) - 1 example import violation(s)
- `src/FieldTier.ts:232` `estimateJsonSize` (const) - 1 example import violation(s)
- `src/FieldTier.ts:260` `OversizedFieldProjection` (class) - 1 example import violation(s)
- `src/FieldTier.ts:299` `FetchableHandle` (class) - 1 example import violation(s)
- `src/FieldTier.ts:345` `FieldProjectionOutcome` (const) - 1 example import violation(s)
- `src/FieldTier.ts:382` `FieldProjectionOutcome` (type) - 2 example import violation(s)
- `src/FieldTier.ts:435` `projectWithinBudget` (const) - 1 example import violation(s)
- `src/FieldTier.ts:472` `ColumnarEnvelope` (class) - 1 example import violation(s)
- `src/FieldTier.ts:520` `toColumnarEnvelope` (const) - 1 example import violation(s)
- `src/McpCaller.ts:44` `McpCallerIdentity` (class) - 1 example import violation(s)
- `src/McpCaller.ts:77` `CurrentMcpCaller` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:75` `defaultSanitizedSpanKeys` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:100` `sanitizeTracerAttributes` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:189` `withSanitizedToolSpan` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:607` `sanitizedToolkit` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/SourceAuth.ts:55` `SourceAuthGate` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:77` `SourceAuthGate` (type) - 1 example import violation(s)
- `src/SourceAuth.ts:100` `SourceAuthRegistration` (class) - 1 example import violation(s)
- `src/SourceAuth.ts:150` `resolveSourceCredential` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:179` `SourceAuthDecision` (type) - 2 example import violation(s)
- `src/SourceAuth.ts:200` `SourceAuthDecision` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:229` `decideSourceAuthMount` (const) - 1 example import violation(s)
- `src/TierGate.ts:65` `TierGateSettlement` (const) - 1 example import violation(s)
- `src/TierGate.ts:87` `TierGateSettlement` (type) - 1 example import violation(s)
- `src/TierGate.ts:107` `TierGateOutcome` (const) - 1 example import violation(s)
- `src/TierGate.ts:130` `TierGateOutcome` (type) - 2 example import violation(s)
- `src/TierGate.ts:282` `ToolCallRequest` (interface) - 1 example import violation(s)
- `src/TierGate.ts:332` `TierGateShape` (interface) - 2 example import violation(s)
- `src/TierGate.ts:378` `TierGate` (class) - 1 example import violation(s)
- `src/TierGate.ts:398` `TierGatePolicy` (class) - 1 example import violation(s)
- `src/TierGate.ts:469` `fromApprovedToolsPolicy` (const) - 1 example import violation(s)
- `src/TierGate.ts:521` `TierGateDispatchResult` (type) - 1 example import violation(s)
- `src/TierGate.ts:556` `TierGateDispatchResult` (const) - 1 example import violation(s)
- `src/TierGate.ts:605` `dispatchWithTierGate` (const) - 1 example import violation(s)
- `src/TierGate.ts:643` `withEnabledWhenApprovedTool` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:42` `FourHintAnnotations` (class) - 1 example import violation(s)
- `src/ToolAnnotations.ts:102` `AnnotatedTool` (type) - 1 example import violation(s)
- `src/ToolAnnotations.ts:121` `annotateFourHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:154` `readOnlyToolHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:172` `destructiveWriteToolHints` (const) - 1 example import violation(s)
- `src/ToolkitComposition.ts:54` `GatedLayer` (interface) - 2 example import violation(s)
- `src/ToolkitComposition.ts:90` `gatedLayer` (const) - 1 example import violation(s)
- `src/ToolkitComposition.ts:136` `composeGatedLayers` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

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
- `src/Transport.ts:283` `ApiTransportOptions` (class) - 1 example import violation(s)
- `src/Transport.ts:360` `ApiTransport` (interface) - 1 example import violation(s)
- `src/Transport.ts:401` `makeApiTransport` (const) - 1 example import violation(s)

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

### @beep/chalk

Path: `packages/foundation/capability/chalk`

Module findings:
- `src/Chalk.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/Chalk.ts:91` `ChalkInstance` (interface) - 1 example import violation(s)
- `src/Chalk.ts:125` `Chalk` (type) - 1 example import violation(s)
- `src/Chalk.ts:156` `Chalk` (const) - 1 example import violation(s)
- `src/Chalk.ts:179` `BackgroundColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:196` `BackgroundColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:219` `ChalkConstructorOptions` (const) - 1 example import violation(s)
- `src/Chalk.ts:241` `ChalkConstructorOptions` (type) - 1 example import violation(s)
- `src/Chalk.ts:264` `ChalkOptions` (const) - 1 example import violation(s)
- `src/Chalk.ts:281` `ChalkOptions` (type) - 1 example import violation(s)
- `src/Chalk.ts:304` `ColorInfo` (const) - 1 example import violation(s)
- `src/Chalk.ts:321` `ColorInfo` (type) - 1 example import violation(s)
- `src/Chalk.ts:344` `ColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:361` `ColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:389` `ColorSupport` (const) - 1 example import violation(s)
- `src/Chalk.ts:406` `ColorSupport` (type) - 1 example import violation(s)
- `src/Chalk.ts:428` `ColorSupportLevel` (const) - 1 example import violation(s)
- `src/Chalk.ts:445` `ColorSupportLevel` (type) - 1 example import violation(s)
- `src/Chalk.ts:468` `ColorSupportLevelInput` (const) - 1 example import violation(s)
- `src/Chalk.ts:485` `ColorSupportLevelInput` (type) - 1 example import violation(s)
- `src/Chalk.ts:508` `ForegroundColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:525` `ForegroundColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:548` `ModifierName` (const) - 1 example import violation(s)
- `src/Chalk.ts:565` `ModifierName` (type) - 1 example import violation(s)
- `src/Chalk.ts:582` `modifierNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:599` `foregroundColorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:616` `backgroundColorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:633` `colorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:650` `modifiers` (const) - 1 example import violation(s)
- `src/Chalk.ts:667` `foregroundColors` (const) - 1 example import violation(s)
- `src/Chalk.ts:684` `backgroundColors` (const) - 1 example import violation(s)
- `src/Chalk.ts:701` `colors` (const) - 1 example import violation(s)
- `src/Chalk.ts:723` `supportsColor` (const) - 1 example import violation(s)
- `src/Chalk.ts:745` `supportsColorStderr` (const) - 1 example import violation(s)
- `src/Chalk.ts:772` `chalkStderr` (const) - 1 example import violation(s)
- `src/Chalk.ts:804` `default` (const) - 1 example import violation(s)

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Export findings:
- `src/forwarder.ts:466` `AiMetricsForwarderInput` (class) - 1 example import violation(s)
- `src/forwarder.ts:1405` `runAiMetricsForwarder` (const) - 1 example import violation(s)

### @beep/technical-drawing

Path: `packages/foundation/capability/technical-drawing`

Export findings:
- `src/Approval.rules.ts:51` `textLines` (const) - 1 example import violation(s)
- `src/Approval.rules.ts:68` `authoredLines` (const) - 1 example import violation(s)
- `src/Approval.rules.ts:119` `verifyConfirmation` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:38` `approvalStatement` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:56` `EmailAddress` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:74` `EmailAddress` (type) - 1 example import violation(s)
- `src/Approval.schemas.ts:102` `EmailConfirmation` (class) - 1 example import violation(s)
- `src/Approval.schemas.ts:138` `PdfConfirmation` (class) - 1 example import violation(s)
- `src/Approval.schemas.ts:178` `Confirmation` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:201` `Confirmation` (type) - 2 example import violation(s)
- `src/Approval.schemas.ts:224` `ApprovalRefusalReason` (const) - 1 example import violation(s)
- `src/Approval.schemas.ts:247` `ApprovalRefusalReason` (type) - 1 example import violation(s)
- `src/Approval.schemas.ts:281` `ApprovalRecord` (class) - 1 example import violation(s)
- `src/Approval.service.ts:46` `ConfirmationSource` (const) - 1 example import violation(s)
- `src/Approval.service.ts:82` `ConfirmationSource` (type) - 2 example import violation(s)
- `src/Approval.service.ts:103` `SignRequest` (class) - 1 example import violation(s)
- `src/Approval.service.ts:134` `SheetSetApprovalShape` (interface) - 1 example import violation(s)
- `src/Approval.service.ts:260` `SheetSetApproval` (class) - 1 example import violation(s)
- `src/FigureSet.service.ts:103` `RenderRequest` (class) - 1 example import violation(s)
- `src/FigureSet.service.ts:155` `FigureSetShape` (interface) - 1 example import violation(s)
- `src/FigureSet.service.ts:780` `FigureSet` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:39` `Vec3` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:60` `Vec3` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:76` `PositiveLength` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:106` `PositiveLength` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:123` `Rotation` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:261` `Box` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:298` `Prism` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:343` `Cylinder` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:374` `Primitive` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:397` `Primitive` (type) - 2 example import violation(s)
- `src/Geometry.schemas.ts:435` `Part` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:625` `LengthUnit` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:647` `LengthUnit` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:671` `ModelSpec` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:807` `Camera` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:850` `Segment2` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:871` `Segment2` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:909` `ShadingSkipReason` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:932` `ShadingSkipReason` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:948` `ShadingSkip` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1085` `ShadingCoverage` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1155` `ShadingBand` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1197` `EdgeSet` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1266` `ShadingStyle` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1288` `ShadingStyle` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1316` `HatchAxis` (const) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1338` `HatchAxis` (type) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1390` `ShadingPlan` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1482` `BoundingBox` (class) - 1 example import violation(s)
- `src/Geometry.schemas.ts:1519` `ModelSummary` (class) - 1 example import violation(s)
- `src/Geometry.segments.ts:47` `canonicalSegments` (const) - 1 example import violation(s)
- `src/Geometry.segments.ts:71` `mirrorSegments` (const) - 1 example import violation(s)
- `src/Geometry.segments.ts:99` `sameSegments` (const) - 1 example import violation(s)
- `src/Manifest.digest.ts:34` `sha256Hex` (const) - 1 example import violation(s)
- `src/Manifest.schemas.ts:33` `Sha256Hex` (const) - 1 example import violation(s)
- `src/Manifest.schemas.ts:63` `Sha256Hex` (type) - 1 example import violation(s)
- `src/Manifest.schemas.ts:79` `EngineInfo` (class) - 1 example import violation(s)
- `src/Manifest.schemas.ts:158` `FigureRecord` (class) - 1 example import violation(s)
- `src/Manifest.schemas.ts:228` `OmissionProof` (class) - 1 example import violation(s)
- `src/Manifest.schemas.ts:327` `RenderManifest` (class) - 1 example import violation(s)
- `src/Shading.rules.ts:152` `viewFactsOf` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:242` `aspectOf` (const) - 2 example import violation(s)
- `src/Shading.rules.ts:567` `legibleStrokeLength` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:917` `legibleShading` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:1142` `reclippedShading` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:1212` `reclippedCoverage` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:1353` `hatchDirectionOf` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:1433` `anchorOf` (const) - 1 example import violation(s)
- `src/Shading.rules.ts:1716` `treatmentFor` (const) - 1 example import violation(s)
- `src/Shading.schemas.ts:216` `FaceFacts` (class) - 1 example import violation(s)
- `src/Sheet.compose.ts:221` `labelWidthPt` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:244` `strokeLabel` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:334` `viewExtents` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:474` `sheetGeometry` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:491` `commonScale` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:651` `drawnBrokenGapMm` (const) - 1 example import violation(s)
- `src/Sheet.compose.ts:719` `composeSheet` (const) - 2 example import violation(s)
- `src/Sheet.schemas.ts:35` `SheetFormat` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:57` `SheetFormat` (type) - 1 example import violation(s)
- `src/Sheet.schemas.ts:84` `PT_PER_CM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:100` `PT_PER_MM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:116` `PagePoints` (class) - 1 example import violation(s)
- `src/Sheet.schemas.ts:147` `pageSizePt` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:168` `MARGINS_CM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:184` `MIN_LETTER_HEIGHT_CM` (const) - 1 example import violation(s)
- `src/Sheet.schemas.ts:714` `SheetOptions` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.errors.ts:40` `DrawingErrorReason` (const) - 1 example import violation(s)
- `src/TechnicalDrawing.errors.ts:63` `DrawingErrorReason` (type) - 1 example import violation(s)
- `src/TechnicalDrawing.errors.ts:87` `DrawingError` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:41` `GeometryEngineShape` (interface) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:67` `GeometryEngine` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:89` `PdfBackendShape` (interface) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:127` `PdfBackend` (class) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:144` `MailReaderShape` (interface) - 1 example import violation(s)
- `src/TechnicalDrawing.ports.ts:163` `MailReader` (class) - 1 example import violation(s)
- `src/Validation.rules.ts:168` `structuralFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:231` `labelTextFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:269` `marginFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:323` `purityFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:376` `shadingSpacingFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:439` `outlineSpacingFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:525` `shadingCoverageFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:572` `shadingOutlineClearanceFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:632` `shadingLoneLineFindings` (const) - 1 example import violation(s)
- `src/Validation.rules.ts:732` `shadingBandLadderFindings` (const) - 1 example import violation(s)
- `src/Validation.schemas.ts:31` `PdfPageSize` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:56` `PdfFontFact` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:190` `PdfFacts` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:242` `InkBounds` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:274` `PageMetrics` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:334` `FindingCode` (const) - 1 example import violation(s)
- `src/Validation.schemas.ts:356` `FindingCode` (type) - 1 example import violation(s)
- `src/Validation.schemas.ts:374` `SheetFinding` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:443` `ValidationOptions` (class) - 1 example import violation(s)
- `src/Validation.schemas.ts:539` `ValidationReport` (class) - 1 example import violation(s)
- `src/View.schemas.ts:51` `ViewName` (const) - 1 example import violation(s)
- `src/View.schemas.ts:73` `ViewName` (type) - 1 example import violation(s)
- `src/View.schemas.ts:260` `isPerspectiveView` (const) - 1 example import violation(s)
- `src/View.schemas.ts:295` `CameraForViewInput` (class) - 1 example import violation(s)
- `src/View.schemas.ts:407` `cameraForView` (const) - 1 example import violation(s)
- `src/View.schemas.ts:512` `FigureSpec` (class) - 1 example import violation(s)
- `src/View.schemas.ts:556` `OmissionRelation` (const) - 1 example import violation(s)
- `src/View.schemas.ts:578` `OmissionRelation` (type) - 1 example import violation(s)
- `src/View.schemas.ts:595` `OmissionClaim` (class) - 1 example import violation(s)
- `src/View.schemas.ts:686` `FigureSetSpec` (class) - 1 example import violation(s)

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

### @beep/skill-contract

Path: `packages/foundation/modeling/skill-contract`

Export findings:
- `src/EvidenceLadder.ts:34` `EvidenceReceiptReference` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:60` `EvidenceLadderReceiptTypes` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:90` `Accepted` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:117` `Persisted` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:145` `Delivered` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:174` `SemanticallyApplied` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:204` `EvidenceLadderState` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:263` `evidenceLadderFor` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:300` `transportCompleted` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:320` `advanceToPersisted` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:346` `advanceToDelivered` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:372` `advanceToSemanticallyApplied` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:42` `EvidenceDigest` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:75` `EvidenceSubject` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:133` `EvidenceReceipt` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:159` `AttestationResource` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:184` `GateSummaryVerifier` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:209` `GateVerificationResult` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:237` `GateVerifiedLevel` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:284` `GateResultSummary` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:361` `GateSummary` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:383` `GateSummaryPredicateType` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:401` `GateSummaryReceipt` (const) - 1 example import violation(s)
- `src/Gate.ts:41` `GateId` (const) - 1 example import violation(s)
- `src/Gate.ts:80` `makeGateId` (const) - 1 example import violation(s)
- `src/Gate.ts:103` `GateSeverity` (const) - 1 example import violation(s)
- `src/Gate.ts:131` `GateApplicabilityKind` (const) - 1 example import violation(s)
- `src/Gate.ts:159` `AlwaysGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:191` `ConditionalGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:225` `GateApplicability` (const) - 1 example import violation(s)
- `src/Gate.ts:257` `EvidencePredicateType` (const) - 1 example import violation(s)
- `src/Gate.ts:289` `GateEvidenceRequirement` (class) - 1 example import violation(s)
- `src/Gate.ts:330` `GateDeclaration` (class) - 1 example import violation(s)
- `src/Gate.ts:384` `GateRegistry` (class) - 1 example import violation(s)
- `src/Gate.ts:406` `GateOutcome` (const) - 1 example import violation(s)
- `src/Gate.ts:529` `GateAuditRecord` (const) - 1 example import violation(s)
- `src/Gate.ts:595` `GateVerdict` (const) - 1 example import violation(s)
- `src/Recovery.ts:68` `BudgetDuration` (const) - 1 example import violation(s)
- `src/Recovery.ts:96` `RecoveryBudget` (class) - 1 example import violation(s)
- `src/Recovery.ts:123` `RecoveryBudgetConsumed` (class) - 1 example import violation(s)
- `src/Recovery.ts:149` `RecoveryAttemptOutcome` (const) - 1 example import violation(s)
- `src/Recovery.ts:177` `RecoveryAttemptReceipt` (class) - 1 example import violation(s)
- `src/Recovery.ts:207` `FailureTerminalReason` (const) - 1 example import violation(s)
- `src/Recovery.ts:318` `FailureReceiptPredicate` (class) - 1 example import violation(s)
- `src/Recovery.ts:340` `FailurePredicateType` (const) - 1 example import violation(s)
- `src/Recovery.ts:356` `FailureReceipt` (const) - 1 example import violation(s)
- `src/Recovery.ts:380` `NoRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:404` `BoundedRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:436` `RecoveryPolicy` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:27` `SchemaReferenceId` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:64` `SchemaReference` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:61` `SkillCompletionReceipt` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:118` `SkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:145` `toSkillCompletionReceipt` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:168` `EvaluateSkillCompletionInput` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:198` `CompletionInvariantReason` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:237` `CompletionInvariantError` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:266` `CompletionAllowed` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:293` `CompletionDenied` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:320` `CompletionEvaluation` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:403` `evaluateSkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:470` `LiveVerified` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:497` `DeployableBlocked` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:526` `FailedWithPartialEffects` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:555` `SkillTerminal` (const) - 1 example import violation(s)
- `src/SkillContract.ts:33` `SkillContractId` (const) - 1 example import violation(s)
- `src/SkillContract.ts:62` `ReceiptTypeBindings` (class) - 1 example import violation(s)
- `src/SkillContract.ts:95` `SkillContract` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:65` `SkillMarkdownProjection` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:92` `SkillArtifactDenialReason` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:130` `SkillArtifactCheck` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:180` `SkillArtifactAllowed` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:207` `SkillArtifactDenied` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:235` `SkillArtifactVerdict` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:266` `VerifySkillArtifactInput` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:373` `projectSkillDocument` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:405` `renderSkillMarkdown` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:448` `decodeSkillFrontmatter` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:549` `verifySkillArtifact` (const) - 1 example import violation(s)

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
- `src/Dock.atoms.ts:55` `DockAtomObservabilityLive` (const) - 1 example import violation(s)
- `src/Dock.atoms.ts:213` `makeDockAtomsWith` (const) - 1 example import violation(s)
- `src/Dock.atoms.ts:246` `makeDockAtoms` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:34` `UserCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:60` `ApiCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:88` `CommandOrigin` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:111` `CommandOrigin` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:128` `OpenPanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:155` `ActivatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:182` `UpdatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:203` `MovePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:230` `MoveGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:254` `UpdateGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:277` `ClosePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:303` `ResizeSplitCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:330` `ClearWorkspaceCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:355` `MaximizeGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:376` `RestoreMaximizedCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:397` `FloatGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:417` `DockFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:437` `MoveFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:477` `DockCommand` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:515` `DockCommand` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:532` `DockCommandEnvelope` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:559` `AllowedRenderers` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:582` `AllowedRenderers` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:599` `RestoreSnapshotRequest` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:29` `DockRejectionReason` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:64` `DockRejectionReason` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:81` `DockCommandRejected` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:110` `DockInvariantReason` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:137` `DockInvariantReason` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:154` `DockInvariantViolation` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:182` `DockInputBoundary` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:202` `DockInputBoundary` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:219` `DockInputError` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:247` `DockPersistenceOperation` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:267` `DockPersistenceOperation` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:284` `DockPersistenceError` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:312` `DockSnapshotMissing` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:339` `DockTransitionError` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:361` `DockTransitionError` (type) - 1 example import violation(s)
- `src/Dock.events.ts:31` `PanelOpenedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:58` `PanelActivatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:85` `PanelTitleChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:106` `PanelViewChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:127` `PanelRenderModeChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:155` `PanelTabComponentChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:191` `PanelConstraintsChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:222` `PanelMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:251` `PanelReorderedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:272` `GroupMergedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:300` `GroupMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:323` `GroupUpdatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:344` `PanelClosedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:371` `SplitResizedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:398` `WorkspaceClearedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:424` `WorkspaceRestoredEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:452` `GroupMaximizedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:473` `GroupRestoredEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:493` `GroupFloatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:513` `GroupDockedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:533` `FloatingGroupMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:578` `DockEvent` (const) - 1 example import violation(s)
- `src/Dock.events.ts:623` `DockEvent` (type) - 1 example import violation(s)
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
- `src/Dock.models-tree.ts:187` `TextPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:213` `PanelView` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:234` `PanelView` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:263` `PanelConstraints` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:291` `Panel` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:343` `PanelPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:376` `GroupLockedMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:394` `GroupLockedMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:411` `GroupHeaderPosition` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:429` `GroupHeaderPosition` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:446` `GroupMetadata` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:477` `GroupPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:515` `TabsNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:681` `HorizontalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:711` `VerticalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:743` `SplitLayout` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:810` `SplitLayout` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:829` `SplitNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:922` `DockNode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1067` `DockNode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1110` `DockNode` (namespace) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1180` `FloatingMember` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1201` `EmptyWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1230` `PopulatedWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1311` `DockWorkspace` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1529` `DockWorkspace` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1546` `DockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:32` `DockUnchangedReason` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:63` `DockUnchangedReason` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:81` `DockChanged` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:109` `DockUnchanged` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:136` `DockMutationResult` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:158` `DockMutationResult` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:176` `DockMutationOutcome` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:31` `RootPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:57` `TabPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:85` `DockSide` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:105` `DockSide` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:122` `SplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:157` `RootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:186` `GroupSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:215` `GroupRootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:245` `DockPlacement` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:268` `DockPlacement` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:285` `DockMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:306` `DockMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:323` `DockGroupMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:344` `DockGroupMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:38` `DispatchDockCommand` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:64` `DispatchUnknownDockCommand` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:93` `SaveDockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:118` `RestoreDockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:144` `DockAtomOperationKind` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:169` `DockAtomOperationKind` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:186` `DockAtomOperation` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:214` `DockAtomOperation` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:232` `DockMutationCompleted` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:258` `DockSnapshotSaved` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:286` `DockAtomOperationOutcome` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:309` `DockAtomOperationOutcome` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:326` `DockAtomSessionError` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:353` `DockAtomSessionError` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:371` `DockAtomFeedSuccess` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:399` `DockAtomFeedFailure` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:427` `DockAtomFeedEntry` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:449` `DockAtomFeedEntry` (type) - 1 example import violation(s)
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
- `src/Geometry.models.ts:88` `GroupGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:109` `SashGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:130` `FloatingGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:151` `DockGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:190` `resolveAnchoredBox` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:233` `GeometryOptions` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:268` `GroupMinimumLookup` (type) - 2 example import violation(s)
- `src/Geometry.models.ts:285` `GroupMinimaRecord` (type) - 1 example import violation(s)
- `src/Minima.ts:66` `TabChrome` (class) - 1 example import violation(s)
- `src/Minima.ts:90` `titleWords` (const) - 1 example import violation(s)
- `src/Minima.ts:142` `titleMinima` (const) - 1 example import violation(s)
- `src/Minima.ts:201` `makeTitleMinimaAtom` (const) - 1 example import violation(s)
- `src/Recency.ts:42` `touchedGroupsInEvents` (const) - 1 example import violation(s)
- `src/Recency.ts:82` `touchedGroups` (const) - 1 example import violation(s)
- `src/Recency.ts:131` `makeMruGroupsAtom` (const) - 1 example import violation(s)

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Module findings:
- `src/Lexical.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.codec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Lexical.model.ts:1162` `ElementNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:2375` `YouTubeNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3349` `decodeEditorStateStrictResult` (const) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3432` `analyzeEditorStateCompatibilityResult` (const) - 1 documentation section/link violation(s)
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

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Module findings:
- `src/Fold.assembly.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Fold.assembly.ts:68` `BoundComposer` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.assembly.ts:887` `fold` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:46` `MarkdownLinkMode` (const) - 1 example import violation(s)
- `src/Fold.markdown.ts:67` `MarkdownLinkMode` (type) - 1 example import violation(s)
- `src/Fold.markdown.ts:84` `MarkdownOptions` (class) - 1 example import violation(s)
- `src/Fold.markdown.ts:296` `toMarkdown` (const) - 1 example import violation(s)
- `src/Fold.models.ts:40` `AbsoluteIri` (type) - 1 example import violation(s)
- `src/Fold.models.ts:65` `SchemaHandle` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:81` `Subject` (type) - 1 example import violation(s)
- `src/Fold.models.ts:97` `LiteralScalar` (type) - 1 example import violation(s)
- `src/Fold.models.ts:116` `TypedLiteral` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:136` `TupleObject` (type) - 1 example import violation(s)
- `src/Fold.models.ts:156` `Triple` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:172` `OntologyFoldInput` (type) - 1 example import violation(s)
- `src/Fold.models.ts:203` `isSchemaHandle` (const) - 1 example import violation(s)
- `src/Fold.models.ts:285` `TripleValue` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:305` `TripleValue` (type) - 1 example import violation(s)
- `src/Fold.models.ts:321` `SkosClassification` (const) - 1 example import violation(s)
- `src/Fold.models.ts:341` `SkosClassification` (type) - 1 example import violation(s)
- `src/Fold.models.ts:360` `AssembledPredicateKind` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:380` `AssembledPredicateKind` (type) - 1 example import violation(s)
- `src/Fold.models.ts:397` `FactLiteral` (class) - 1 example import violation(s)
- `src/Fold.models.ts:423` `FactObject` (const) - 1 example import violation(s)
- `src/Fold.models.ts:445` `FactObject` (type) - 2 example import violation(s)
- `src/Fold.models.ts:471` `AssembledFact` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:505` `AssembledPredicate` (class) - 1 example import violation(s)
- `src/Fold.models.ts:542` `AssembledClass` (class) - 1 example import violation(s)
- `src/Fold.models.ts:571` `OntologyWarningCode` (const) - 1 example import violation(s)
- `src/Fold.models.ts:595` `OntologyWarningCode` (type) - 1 example import violation(s)
- `src/Fold.models.ts:618` `OntologyValidationWarning` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:653` `AssembledOntology` (class) - 1 example import violation(s)
- `src/Fold.models.ts:682` `OntologyAssemblyErrorReason` (const) - 1 example import violation(s)
- `src/Fold.models.ts:711` `OntologyAssemblyErrorReason` (type) - 1 example import violation(s)
- `src/Fold.models.ts:736` `OntologyAssemblyError` (class) - 1 example import violation(s)
- `src/Fold.models.ts:770` `isFactLiteral` (const) - 1 example import violation(s)
- `src/Fold.projections.ts:46` `JsonLdTerm` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:71` `JsonLdContext` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:88` `JsonLdNodeValue` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:112` `JsonLdNode` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:133` `JsonLdDocument` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:239` `toContext` (const) - 1 example import violation(s)
- `src/Fold.projections.ts:392` `toJsonLd` (const) - 1 example import violation(s)
- `src/Fold.projections.ts:635` `toTurtle` (const) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:191` `ConceptAlignment` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:224` `TaxonomyConcept` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:293` `FilingRoot` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:224` `VendorAlignmentManifestEntry` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:283` `VendorConceptSlice` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:493` `VendorSliceConceptMismatch` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:529` `VendorAlignmentTargetNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:36` `LibrarianInput` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:110` `TaxonomyConceptNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:134` `UnsupportedDocumentClass` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:169` `runLibrarianLoop` (const) - 1 example import violation(s)

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
- `src/commands/Ci/CiLane.ts:406` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:1565` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.errors.ts:312` `CorpusArchiveMoveDigestMismatchError` (class) - 1 example import violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:122` `resolveCreatePackageTemplateDir` (const) - 1 documentation section/link violation(s)
- `src/commands/Drawings/Drawings.intake.schemas.ts:304` `MessageFacts` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.intake.schemas.ts:354` `IntakeRecord` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.intake.schemas.ts:405` `IntakeResult` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.intake.ts:625` `renderIntakeSummary` (const) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.measurements.schemas.ts:431` `CriticMeasurements` (class) - 1 example import violation(s)
- `src/commands/Drawings/Drawings.measurements.ts:910` `measurementsMarkdown` (const) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:774` `explorationProjectionDriftPaths` (const) - 1 example import violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:328` `runFrozenGrantSetRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:628` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:512` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:628` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:732` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:1053` `runBunAudit` (const) - 1 documentation section/link violation(s)
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
- `src/commands/Worktree/Fleet.service.ts:326` `parseProcStatStartTime` (const) - 1 example import violation(s)

### @beep/dock-react

Path: `packages/foundation/ui-system/dock-react`

Export findings:
- `src/DockReact.types.ts:34` `DockAtomGraph` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:53` `DockPanelApi` (class) - 2 example import violation(s)
- `src/DockReact.types.ts:78` `DockPanelProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:99` `DockTabProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:116` `DockRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:133` `DockTabRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:150` `DockviewAdapterApi` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:186` `DockTitleMinimaOptions` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:210` `DockviewReactProps` (type) - 1 example import violation(s)
- `src/DockviewReact.tsx:244` `DockviewReact` (const) - 2 example import violation(s)

### @beep/brand

Path: `packages/foundation/ui-system/brand`

Export findings:
- `src/Brand.assets.ts:31` `RenderedAsset` (class) - 1 example import violation(s)
- `src/Brand.assets.ts:85` `renderBrandAssets` (const) - 1 example import violation(s)
- `src/Brand.css.ts:37` `GENERATED_CSS_BANNER` (const) - 1 example import violation(s)
- `src/Brand.css.ts:87` `fontStack` (const) - 1 example import violation(s)
- `src/Brand.css.ts:158` `renderThemeCss` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:32` `PrintableText` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:62` `PrintableText` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:78` `ScaleStep` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:97` `ScaleStep` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:113` `SurfaceStep` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:132` `SurfaceStep` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:148` `ColorScale` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:177` `SurfaceScale` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:202` `Foreground` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:224` `Border` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:245` `Semantic` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:267` `Alpha` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:287` `Alpha` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:303` `GlowStop` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:324` `GlowLayer` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:345` `Glow` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:367` `ColorScheme` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:392` `SchemeName` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:411` `SchemeName` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:427` `FontStack` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:450` `Typography` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:471` `SvgPathData` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:508` `SvgPathData` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:524` `MarkPoint` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:545` `MarkRotation` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:566` `PixelGlasses` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:594` `BrandMark` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:622` `BrandIdentity` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:651` `SvgPaint` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:670` `SvgPaint` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:687` `MarkPaint` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:709` `MarkGround` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:737` `MarkSvgRequest` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:771` `WordmarkSvgRequest` (class) - 1 example import violation(s)
- `src/Brand.svg.ts:46` `glassesTransform` (const) - 1 example import violation(s)
- `src/Brand.svg.ts:115` `renderMarkSvg` (const) - 1 example import violation(s)
- `src/Brand.svg.ts:153` `renderWordmarkSvg` (const) - 1 example import violation(s)
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
- `src/Openclaw.models.ts:354` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:427` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:463` `OpenclawSecretsReloadOutput` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:532` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1233` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1337` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1426` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1498` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
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
- `effected/github-actions/Action.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionCache.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionEnvironment.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionInput.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionLogger.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionOutputs.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionState.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionsIdentityToken.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ActionsProvenance.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/Artifact.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/BlobEnvelope.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/BlobStore.githubCache.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/BlobStore.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/BlobTransfer.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/CacheKey.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/ChildEnv.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/DetachedProcess.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/DryRun.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/GitHubToken.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/OidcTokenIssuer.ts:1` (packageDocumentation) - missing @since
- `effected/github-actions/PackageManagerInstaller.ts:1` (packageDocumentation) - missing @since
- `effected/github-actions/Secret.ts:1` (packageDocumentation) - missing @since
- `effected/github-actions/ToolInstaller.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/index.ts:1` (packageDocumentation) - missing @since
- `effected/github-actions/internal/actionsResults.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/archiveCommands.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/cacheService.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/digest.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/fsProbe.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/ieeeNumber.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/jwt.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/pnpmExe.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/runner.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/runnerFile.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/sigv4.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/spawn.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/twirp.ts:1` (none) - missing summary; missing @since
- `effected/github-actions/internal/unstubbed.ts:1` (none) - missing summary; missing @since
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

### @beep/pandoc-ast

Path: `packages/foundation/modeling/pandoc-ast`

Export findings:
- `src/index.ts:22` `export * from "./Pandoc.codec.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:43` `export * from "./Pandoc.conformance.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:58` `export * from "./Pandoc.mapping.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export * from "./Pandoc.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:88` `export * from "./Pandoc.report.ts";` (re-export) - 1 example import violation(s)
