# JSDoc Documentation Compliance Inventory

Generated: 2026-11-01T00:59:36.970Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 184 |
| cleanPackages | 166 |
| packagesWithoutPublicSrcSurface | 2 |
| packagesNeedingRemediation | 16 |
| publicModules | 3627 |
| publicExports | 25639 |
| openModules | 161 |
| openExports | 97 |
| missingExportExamples | 3 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 50 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 1 |
| multiple-description-paragraphs | 158 |
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
| no-root-package-import | 47 |
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
| 2 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 3 | `@beep/types` | `packages/foundation/primitive/types` | needs-remediation | 5 | 12 | 1 | 12 |
| 4 | `@beep/test-runner` | `packages/tooling/test-kit/test-runner` | clean | 4 | 6 | 0 | 0 |
| 5 | `@beep/identity` | `packages/foundation/modeling/identity` | clean | 8 | 281 | 0 | 0 |
| 6 | `@beep/github-commands` | `packages/foundation/modeling/github-commands` | clean | 3 | 6 | 0 | 0 |
| 7 | `@beep/ontology-config` | `packages/ontology/config` | clean | 7 | 18 | 0 | 0 |
| 8 | `@beep/spdx` | `packages/foundation/modeling/spdx` | clean | 4 | 16 | 0 | 0 |
| 9 | `@beep/utils` | `packages/foundation/modeling/utils` | clean | 29 | 229 | 0 | 0 |
| 10 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 16 |
| 11 | `@beep/schema` | `packages/foundation/modeling/schema` | clean | 168 | 969 | 0 | 0 |
| 12 | `@beep/codegen-kit` | `packages/tooling/library/codegen-kit` | clean | 6 | 45 | 0 | 0 |
| 13 | `@beep/commands` | `packages/drivers/commands` | clean | 8 | 58 | 0 | 0 |
| 14 | `@beep/cosmos` | `packages/drivers/cosmos` | clean | 6 | 22 | 0 | 0 |
| 15 | `@beep/freshbooks` | `packages/drivers/freshbooks` | clean | 6 | 49 | 0 | 0 |
| 16 | `@beep/git` | `packages/drivers/git` | clean | 7 | 46 | 0 | 0 |
| 17 | `@beep/github-references` | `packages/foundation/modeling/github-references` | clean | 4 | 28 | 0 | 0 |
| 18 | `@beep/glob` | `packages/foundation/modeling/glob` | clean | 4 | 9 | 0 | 0 |
| 19 | `@beep/graph-3d` | `packages/drivers/graph-3d` | clean | 7 | 17 | 0 | 0 |
| 20 | `@beep/jsonc` | `packages/foundation/modeling/jsonc` | clean | 8 | 48 | 0 | 0 |
| 21 | `@beep/memfs` | `packages/tooling/test-kit/memfs` | clean | 3 | 23 | 0 | 0 |
| 22 | `@beep/pglite` | `packages/drivers/pglite` | clean | 4 | 10 | 0 | 0 |
| 23 | `@beep/pretext` | `packages/drivers/pretext` | clean | 6 | 36 | 0 | 0 |
| 24 | `@beep/public-site` | `packages/foundation/modeling/public-site` | clean | 4 | 27 | 0 | 0 |
| 25 | `@beep/runtime-env` | `packages/foundation/capability/runtime-env` | clean | 6 | 31 | 0 | 0 |
| 26 | `@beep/schema-org` | `packages/foundation/modeling/schema-org` | clean | 13 | 57 | 0 | 0 |
| 27 | `@beep/semver` | `packages/foundation/modeling/semver` | clean | 6 | 23 | 0 | 0 |
| 28 | `@beep/technical-drawing` | `packages/foundation/capability/technical-drawing` | clean | 19 | 224 | 0 | 0 |
| 29 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 15 | 54 | 1 | 0 |
| 30 | `@beep/todox` | `apps/todox` | clean | 16 | 57 | 0 | 0 |
| 31 | `@beep/toml` | `packages/foundation/modeling/toml` | clean | 9 | 68 | 0 | 0 |
| 32 | `@beep/windows-secrets` | `packages/drivers/windows-secrets` | clean | 4 | 13 | 0 | 0 |
| 33 | `@beep/xstate` | `packages/drivers/xstate` | clean | 6 | 26 | 0 | 0 |
| 34 | `@beep/yaml` | `packages/foundation/modeling/yaml` | clean | 11 | 95 | 0 | 0 |
| 35 | `@beep/acp` | `packages/drivers/acp` | clean | 15 | 1047 | 0 | 0 |
| 36 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | clean | 10 | 103 | 0 | 0 |
| 37 | `@beep/anthropic` | `packages/drivers/anthropic` | clean | 6 | 31 | 0 | 0 |
| 38 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | clean | 3 | 9 | 0 | 0 |
| 39 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | clean | 9 | 20 | 0 | 0 |
| 40 | `@beep/beep-effect-web` | `apps/beep-effect-web` | clean | 4 | 6 | 0 | 0 |
| 41 | `@beep/box` | `packages/drivers/box` | clean | 7 | 878 | 0 | 0 |
| 42 | `@beep/brand` | `packages/foundation/ui-system/brand` | clean | 7 | 50 | 0 | 0 |
| 43 | `@beep/chalk` | `packages/foundation/capability/chalk` | clean | 1 | 35 | 0 | 0 |
| 44 | `@beep/colors` | `packages/foundation/capability/colors` | clean | 1 | 9 | 0 | 0 |
| 45 | `@beep/discord` | `packages/drivers/discord` | clean | 4 | 15 | 0 | 0 |
| 46 | `@beep/dock` | `packages/foundation/ui-system/dock` | clean | 20 | 212 | 0 | 0 |
| 47 | `@beep/drizzle` | `packages/drivers/drizzle` | clean | 3 | 11 | 0 | 0 |
| 48 | `@beep/duckdb` | `packages/drivers/duckdb` | needs-remediation | 13 | 73 | 1 | 8 |
| 49 | `@beep/exiftool` | `packages/drivers/exiftool` | clean | 5 | 55 | 0 | 0 |
| 50 | `@beep/github` | `packages/drivers/github` | clean | 29 | 192 | 0 | 0 |
| 51 | `@beep/html` | `packages/foundation/modeling/html` | clean | 15 | 544 | 0 | 0 |
| 52 | `@beep/hubspot` | `packages/drivers/hubspot` | clean | 4 | 23 | 0 | 0 |
| 53 | `@beep/jsonl` | `packages/foundation/modeling/jsonl` | clean | 8 | 60 | 0 | 0 |
| 54 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 14 | 41 | 1 | 0 |
| 55 | `@beep/m365` | `packages/drivers/m365` | clean | 8 | 166 | 0 | 0 |
| 56 | `@beep/managed-section` | `packages/foundation/modeling/managed-section` | clean | 7 | 31 | 0 | 0 |
| 57 | `@beep/markdown` | `packages/foundation/modeling/markdown` | clean | 18 | 101 | 0 | 0 |
| 58 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | clean | 12 | 113 | 0 | 0 |
| 59 | `@beep/mcpb-kit` | `packages/tooling/library/mcpb-kit` | clean | 5 | 25 | 0 | 0 |
| 60 | `@beep/nlp` | `packages/foundation/modeling/nlp` | clean | 28 | 313 | 0 | 0 |
| 61 | `@beep/npm-spec` | `packages/foundation/modeling/npm-spec` | clean | 13 | 72 | 0 | 0 |
| 62 | `@beep/obs` | `packages/drivers/obs` | clean | 6 | 73 | 0 | 0 |
| 63 | `@beep/occt` | `packages/drivers/occt` | clean | 4 | 13 | 0 | 0 |
| 64 | `@beep/openai` | `packages/drivers/openai` | clean | 4 | 16 | 0 | 0 |
| 65 | `@beep/openai-compat` | `packages/drivers/openai-compat` | clean | 4 | 53 | 0 | 0 |
| 66 | `@beep/openclaw` | `packages/drivers/openclaw` | clean | 9 | 130 | 0 | 0 |
| 67 | `@beep/pacer` | `packages/drivers/pacer` | clean | 13 | 88 | 0 | 0 |
| 68 | `@beep/pdf-tools` | `packages/drivers/pdf-tools` | clean | 4 | 38 | 0 | 0 |
| 69 | `@beep/phoenix` | `packages/drivers/phoenix` | clean | 6 | 54 | 0 | 0 |
| 70 | `@beep/provenance` | `packages/foundation/modeling/provenance` | clean | 4 | 28 | 0 | 0 |
| 71 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 24 | 197 | 0 | 1 |
| 72 | `@beep/runpod` | `packages/drivers/runpod` | clean | 7 | 204 | 0 | 0 |
| 73 | `@beep/sanity` | `packages/drivers/sanity` | clean | 4 | 15 | 0 | 0 |
| 74 | `@beep/shared-use-cases` | `packages/shared/use-cases` | clean | 6 | 14 | 0 | 0 |
| 75 | `@beep/tailscale` | `packages/drivers/tailscale` | clean | 5 | 29 | 0 | 0 |
| 76 | `@beep/tsconfig` | `packages/foundation/modeling/tsconfig` | clean | 8 | 67 | 0 | 0 |
| 77 | `@beep/ui` | `packages/foundation/ui-system/ui` | clean | 132 | 557 | 0 | 0 |
| 78 | `@beep/uspto` | `packages/drivers/uspto` | clean | 5 | 27 | 0 | 0 |
| 79 | `@beep/walker` | `packages/foundation/capability/walker` | clean | 4 | 24 | 0 | 0 |
| 80 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | clean | 18 | 96 | 0 | 0 |
| 81 | `@beep/box-provisioning` | `packages/drivers/box-provisioning` | clean | 15 | 184 | 0 | 0 |
| 82 | `@beep/config-file` | `packages/foundation/capability/config-file` | clean | 13 | 70 | 0 | 0 |
| 83 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | clean | 3 | 12 | 0 | 0 |
| 84 | `@beep/ecfr` | `packages/drivers/ecfr` | clean | 6 | 172 | 0 | 0 |
| 85 | `@beep/epistemics` | `packages/foundation/modeling/epistemics` | clean | 35 | 131 | 0 | 0 |
| 86 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | clean | 34 | 183 | 0 | 0 |
| 87 | `@beep/github-reporting` | `packages/foundation/modeling/github-reporting` | clean | 5 | 40 | 0 | 0 |
| 88 | `@beep/govinfo` | `packages/drivers/govinfo` | clean | 32 | 85 | 0 | 0 |
| 89 | `@beep/langextract` | `packages/foundation/capability/langextract` | clean | 26 | 131 | 0 | 0 |
| 90 | `@beep/lockfiles` | `packages/foundation/modeling/lockfiles` | clean | 14 | 47 | 0 | 0 |
| 91 | `@beep/md` | `packages/foundation/modeling/md` | clean | 11 | 311 | 0 | 0 |
| 92 | `@beep/package-json` | `packages/foundation/modeling/package-json` | clean | 18 | 121 | 0 | 0 |
| 93 | `@beep/postgres` | `packages/drivers/postgres` | clean | 7 | 42 | 0 | 0 |
| 94 | `@beep/practice-setup` | `apps/practice-setup` | clean | 6 | 38 | 0 | 0 |
| 95 | `@beep/repo-tsconfig` | `packages/tooling/library/repo-tsconfig` | clean | 5 | 24 | 0 | 0 |
| 96 | `@beep/t3-code` | `packages/drivers/t3-code` | clean | 4 | 17 | 0 | 0 |
| 97 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | clean | 7 | 31 | 0 | 0 |
| 98 | `@beep/cli-kit` | `packages/foundation/capability/cli-kit` | clean | 29 | 196 | 0 | 0 |
| 99 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 11 | 0 | 0 |
| 100 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | clean | 6 | 112 | 0 | 0 |
| 101 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | clean | 8 | 40 | 0 | 0 |
| 102 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | clean | 6 | 124 | 0 | 0 |
| 103 | `@beep/libpff` | `packages/drivers/libpff` | clean | 7 | 42 | 0 | 0 |
| 104 | `@beep/observability` | `packages/foundation/capability/observability` | clean | 42 | 337 | 0 | 0 |
| 105 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | clean | 6 | 202 | 0 | 0 |
| 106 | `@beep/poppler` | `packages/drivers/poppler` | clean | 3 | 9 | 0 | 0 |
| 107 | `@beep/rdf` | `packages/foundation/modeling/rdf` | clean | 38 | 303 | 0 | 0 |
| 108 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 60 | 610 | 12 | 0 |
| 109 | `@beep/repo-workspaces` | `packages/tooling/library/repo-workspaces` | clean | 28 | 250 | 0 | 0 |
| 110 | `@beep/sbom` | `packages/foundation/modeling/sbom` | clean | 9 | 75 | 0 | 0 |
| 111 | `@beep/skill-contract` | `packages/foundation/modeling/skill-contract` | clean | 9 | 113 | 0 | 0 |
| 112 | `@beep/tesseract` | `packages/drivers/tesseract` | clean | 3 | 15 | 0 | 0 |
| 113 | `@beep/tika` | `packages/drivers/tika` | clean | 8 | 33 | 0 | 0 |
| 114 | `@beep/xdg` | `packages/foundation/capability/xdg` | clean | 7 | 31 | 0 | 0 |
| 115 | `@beep/editor` | `packages/foundation/ui-system/editor` | clean | 34 | 210 | 0 | 0 |
| 116 | `@beep/github-actions` | `packages/drivers/github-actions` | clean | 24 | 162 | 0 | 0 |
| 117 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | clean | 13 | 109 | 0 | 0 |
| 118 | `@beep/n3` | `packages/drivers/n3` | clean | 3 | 11 | 0 | 0 |
| 119 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | clean | 48 | 312 | 0 | 0 |
| 120 | `@beep/oip-web` | `apps/oip-web` | clean | 31 | 87 | 0 | 0 |
| 121 | `@beep/ontology` | `packages/foundation/modeling/ontology` | clean | 15 | 157 | 0 | 0 |
| 122 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 40 | 0 | 0 |
| 123 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 0 |
| 124 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | clean | 65 | 809 | 0 | 0 |
| 125 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 10 | 98 | 0 | 3 |
| 126 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | clean | 8 | 56 | 0 | 0 |
| 127 | `@beep/infra` | `infra` | needs-remediation | 11 | 109 | 3 | 22 |
| 128 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 129 | `@beep/palantiri` | `packages/tooling/library/palantiri` | clean | 20 | 156 | 0 | 0 |
| 130 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 131 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 132 | `@beep/shared-domain` | `packages/shared/domain` | clean | 106 | 374 | 0 | 0 |
| 133 | `@beep/wink` | `packages/drivers/wink` | clean | 14 | 72 | 0 | 0 |
| 134 | `@beep/agents-domain` | `packages/agents/domain` | clean | 16 | 75 | 0 | 0 |
| 135 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | clean | 15 | 47 | 0 | 0 |
| 136 | `@beep/documents-domain` | `packages/documents/domain` | clean | 26 | 81 | 0 | 0 |
| 137 | `@beep/epistemic-domain` | `packages/epistemic/domain` | clean | 54 | 262 | 0 | 0 |
| 138 | `@beep/law-practice-domain` | `packages/law-practice/domain` | clean | 252 | 953 | 0 | 0 |
| 139 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | clean | 9 | 123 | 0 | 0 |
| 140 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | clean | 4 | 16 | 0 | 0 |
| 141 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | clean | 23 | 217 | 0 | 0 |
| 142 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 488 | 4515 | 46 | 35 |
| 143 | `@beep/shared-tables` | `packages/shared/tables` | clean | 9 | 12 | 0 | 0 |
| 144 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 30 | 58 | 0 | 0 |
| 145 | `@beep/agents-tables` | `packages/agents/tables` | clean | 7 | 15 | 0 | 0 |
| 146 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 20 | 0 | 0 |
| 147 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 6 | 0 | 0 |
| 148 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | clean | 18 | 63 | 0 | 0 |
| 149 | `@beep/documents-tables` | `packages/documents/tables` | clean | 19 | 48 | 0 | 0 |
| 150 | `@beep/documents-use-cases` | `packages/documents/use-cases` | clean | 23 | 124 | 0 | 0 |
| 151 | `@beep/epistemic-config` | `packages/epistemic/config` | clean | 7 | 20 | 0 | 0 |
| 152 | `@beep/epistemic-tables` | `packages/epistemic/tables` | clean | 34 | 99 | 0 | 0 |
| 153 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | clean | 41 | 158 | 0 | 0 |
| 154 | `@beep/law-practice-tables` | `packages/law-practice/tables` | clean | 34 | 88 | 0 | 0 |
| 155 | `@beep/ontology-server` | `packages/ontology/server` | clean | 8 | 23 | 0 | 0 |
| 156 | `@beep/practice-claude-mod` | `apps/practice-claude-mod` | clean | 8 | 30 | 0 | 0 |
| 157 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 23 | 56 | 0 | 0 |
| 158 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | clean | 12 | 45 | 0 | 0 |
| 159 | `@beep/agents-use-cases` | `packages/agents/use-cases` | clean | 31 | 129 | 0 | 0 |
| 160 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | clean | 3 | 6 | 0 | 0 |
| 161 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | clean | 13 | 33 | 0 | 0 |
| 162 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 13 | 46 | 2 | 0 |
| 163 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 35 | 123 | 2 | 0 |
| 164 | `@beep/epistemic-client` | `packages/epistemic/client` | clean | 4 | 24 | 0 | 0 |
| 165 | `@beep/epistemic-server` | `packages/epistemic/server` | clean | 28 | 62 | 0 | 0 |
| 166 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | clean | 104 | 656 | 0 | 0 |
| 167 | `@beep/workspace-server` | `packages/workspace/server` | clean | 12 | 31 | 0 | 0 |
| 168 | `@beep/agents-client` | `packages/agents/client` | clean | 6 | 39 | 0 | 0 |
| 169 | `@beep/agents-server` | `packages/agents/server` | clean | 11 | 42 | 0 | 0 |
| 170 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 171 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 6 | 14 | 0 | 0 |
| 172 | `@beep/law-practice-server` | `packages/law-practice/server` | clean | 73 | 346 | 0 | 0 |
| 173 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 68 | 424 | 46 | 0 |
| 174 | `@beep/docket-intake` | `apps/docket-intake` | clean | 12 | 34 | 0 | 0 |
| 175 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 92 | 0 | 0 |
| 176 | `@beep/practice-gateway` | `apps/practice-gateway` | clean | 20 | 143 | 0 | 0 |
| 177 | `@beep/practice-identify` | `apps/practice-identify` | clean | 3 | 10 | 0 | 0 |
| 178 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | clean | 16 | 75 | 0 | 0 |
| 179 | `@beep/practice-m365-contacts` | `apps/practice-m365-contacts` | clean | 8 | 28 | 0 | 0 |
| 180 | `@beep/practice-mail-tagging` | `apps/practice-mail-tagging` | clean | 8 | 44 | 0 | 0 |
| 181 | `@beep/practice-review-hub` | `apps/practice-review-hub` | clean | 3 | 12 | 0 | 0 |
| 182 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 183 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 27 | 0 | 0 |
| 184 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 65 | 241 | 25 | 0 |

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

### @beep/duckdb

Path: `packages/drivers/duckdb`

Module findings:
- `src/DuckDbEventLogServerEncrypted.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/DuckDbMessageStorage.service.ts:821` `layerMigrations` (const) - 1 documentation section/link violation(s)
- `src/DuckDbMessageStorage.service.ts:856` `layerStorage` (const) - 1 documentation section/link violation(s)
- `src/DuckDbMessageStorage.service.ts:887` `layerWith` (const) - 1 documentation section/link violation(s)
- `src/DuckDbMessageStorage.service.ts:915` `layer` (const) - 1 documentation section/link violation(s)
- `src/DuckDbRunnerStorage.service.ts:320` `layerMigrations` (const) - 1 documentation section/link violation(s)
- `src/DuckDbRunnerStorage.service.ts:353` `layerStorage` (const) - 1 documentation section/link violation(s)
- `src/DuckDbRunnerStorage.service.ts:379` `layerWith` (const) - 1 documentation section/link violation(s)
- `src/DuckDbRunnerStorage.service.ts:405` `layer` (const) - 1 documentation section/link violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/models/ImageConfig.schema.ts:241` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)

### @beep/repo-utils

Path: `packages/tooling/library/repo-utils`

Module findings:
- `src/FsUtils.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TagValue.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JsonUtils.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Root.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TsConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/errors/CyclicDependencyError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/DomainError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/NoSuchFileError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/OptionInjectionError.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/ProofManifest.ts:162` `DocgenProofManifestFile` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:199` `DocgenProofManifestFingerprint` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:266` `DocgenProofManifest` (class) - 1 example import violation(s)

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
- `src/commands/Cache/Cache.command.ts:315` `runCacheWarm` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:513` `buildCacheDashboard` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.service.ts:111` `encodeCachePolicyBaselineText` (const) - 1 example import violation(s)
- `src/commands/Ci/CiLane.ts:406` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:1554` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Corpus/Corpus.errors.ts:312` `CorpusArchiveMoveDigestMismatchError` (class) - 1 example import violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:119` `resolveCreatePackageTemplateDir` (const) - 1 documentation section/link violation(s)
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
- `src/commands/Quality/Quality.command.ts:1045` `runBunAudit` (const) - 1 documentation section/link violation(s)
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

### @beep/db-admin

Path: `packages/_internal/db-admin`

Module findings:
- `src/migrate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/documents-server

Path: `packages/documents/server`

Module findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

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
