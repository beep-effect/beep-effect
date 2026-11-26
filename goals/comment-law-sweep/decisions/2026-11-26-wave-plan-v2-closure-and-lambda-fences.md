---
title: "Wave plan v2: 73 waves with the closure tail and Lambda fence split out"
date: 2026-11-26
kind: checkpoint
lane: "goals/comment-law-sweep-w17"
reversal: "Replace this plan with a later census checkpoint; it records order and sizes only."
---

Amends the wave plan in `2026-11-26-wave-plan-census-2026-11-26` under the ruling `closure-and-lambda-fenced-tail`, which ships in the same PR. The census is the same: 45,018 rows on `main` after #3576.

Two kinds of rows leave the regular waves:

- **Closure tail:** 1,565 rows in src files listed in the live CI binary closure manifest (`beep-ci-6f88be88e928` `beep-linux-x64.closure.json`, 352 files, none of them tests).
- **Lambda fence:** 471 rows of runner-handler src. Until the CI driver's plan-only run names the reachable files, every src row in identity, schema, data and utils counts as fenced.

What remains is 68 regular waves:

- **Waves 47–68:** repo-cli without its closure files.
- **Waves 69–72:** the closure tail. These waves are AST-identical, and only one closure PR is open at a time, each sequenced with the CI driver.
- **Wave 73:** the Lambda wave, opened only on the CI driver's word.

Part sizes for split packages are estimates until each wave starts.

## Waves

| # | Wave | Rows | Scopes |
| ---: | --- | ---: | --- |
| 1 | repo-workspaces tests part 2 (w14) | 683 | `packages/tooling/library/repo-workspaces` |
| 2 | repo-workspaces tests part 3 (w15), with the 3 `vitest.config.ts` rows | 817 | `packages/tooling/library/repo-workspaces` |
| 3 | yaml part 1/2 (w16): tests, plus the 13 src rows in `src/internal/composer` and `src/internal/rules` | 437 | `packages/foundation/modeling/yaml` |
| 4 | yaml part 2/2 (w17): tests | 437 | `packages/foundation/modeling/yaml` |
| 5 | markdown part 1/3 | 584 | `packages/foundation/modeling/markdown` |
| 6 | professional-desktop part 1/2 | 555 | `apps/professional-desktop` |
| 7 | professional-desktop part 2/2 | 555 | `apps/professional-desktop` |
| 8 | git part 1/2 | 490 | `packages/drivers/git` |
| 9 | git part 2/2 | 490 | `packages/drivers/git` |
| 10 | memfs part 1/2 | 418 | `packages/tooling/test-kit/memfs` |
| 11 | memfs part 2/2 | 418 | `packages/tooling/test-kit/memfs` |
| 12 | technical-drawing | 776 | `packages/foundation/capability/technical-drawing` |
| 13 | occt | 761 | `packages/drivers/occt` |
| 14 | markdown part 2/3 | 584 | `packages/foundation/modeling/markdown` |
| 15 | lockfiles | 751 | `packages/foundation/modeling/lockfiles` |
| 16 | package-json | 727 | `packages/foundation/modeling/package-json` |
| 17 | github | 643 | `packages/drivers/github` |
| 18 | agent-memory-store | 500 | `packages/tooling/library/agent-memory-store` |
| 19 | xlsx | 455 | `packages/foundation/modeling/xlsx` |
| 20 | config-file | 436 | `packages/foundation/capability/config-file` |
| 21 | use-cases | 429 | `packages/law-practice/use-cases` |
| 22 | acp | 392 | `packages/drivers/acp` |
| 23 | markdown part 3/3 | 584 | `packages/foundation/modeling/markdown` |
| 24 | sbom | 391 | `packages/foundation/modeling/sbom` |
| 25 | cli-kit | 375 | `packages/foundation/capability/cli-kit` |
| 26 | domain | 375 | `packages/law-practice/domain` |
| 27 | duckdb | 359 | `packages/drivers/duckdb` |
| 28 | editor | 337 | `packages/foundation/ui-system/editor` |
| 29 | ciops | 300 | `apps/labs/ciops` |
| 30 | tail: apps 1/2 | 784 | `apps/practice-kg-mcp`, `apps/oip-web`, `apps/docket-intake`, `apps/practice-setup`, `apps/practice-gateway`, `apps/labs/semantica`, `apps/storybook`, `apps/practice-claude-mod`, `apps/practice-review-hub` |
| 31 | github-actions part 1/2 | 791 | `packages/drivers/github-actions` |
| 32 | tail: apps 2/2 + infra + packages/_internal + packages/agents + packages/architecture-lab | 628 | `apps/labs/lane-cockpit`, `apps/practice-mail-tagging`, `apps/beep-effect-web`, `apps/labs/api-docs`, `apps/labs/lejeune-bolt-workbench`, `apps/todox`, `apps/practice-m365-contacts`, `apps/practice-identify`, `apps/labs/trustgraph-workbench`, `infra`, `infra/lambda/turbo-cache`, `packages/_internal/db-admin`, `packages/agents/client`, `packages/agents/server`, `packages/agents/use-cases`, `packages/agents/domain`, `packages/agents/tables`, `packages/architecture-lab/server`, `packages/architecture-lab/tables` |
| 33 | tail: packages/documents | 281 | `packages/documents/server`, `packages/documents/use-cases`, `packages/documents/tables`, `packages/documents/domain` |
| 34 | tail: packages/drivers 1/3 | 636 | `packages/drivers/commands`, `packages/drivers/alchemy-postgres`, `packages/drivers/m365-mcp` |
| 35 | tail: packages/drivers 2/3 | 781 | `packages/drivers/pdf-tools`, `packages/drivers/libpff`, `packages/drivers/runpod`, `packages/drivers/box`, `packages/drivers/graph-3d`, `packages/drivers/tika`, `packages/drivers/box-provisioning`, `packages/drivers/m365`, `packages/drivers/cosmos` |
| 36 | tail: packages/drivers 3/3 + packages/ecosystem | 641 | `packages/drivers/ffmpeg`, `packages/drivers/obs`, `packages/drivers/doc-text`, `packages/drivers/freshbooks`, `packages/drivers/exiftool`, `packages/drivers/postgres`, `packages/drivers/uspto-mcp`, `packages/drivers/wink`, `packages/drivers/nlp-mcp`, `packages/drivers/pacer`, `packages/drivers/windows-secrets`, `packages/drivers/uspto`, `packages/drivers/gov-legal-mcp`, `packages/drivers/pglite`, `packages/drivers/tailscale`, `packages/drivers/openclaw`, `packages/drivers/xstate`, `packages/drivers/tesseract`, `packages/drivers/ai-provider-cli`, `packages/drivers/poppler`, `packages/drivers/pretext`, `packages/drivers/rdf-canonize`, `packages/drivers/drizzle`, `packages/drivers/openai-compat`, `packages/drivers/sanity`, `packages/drivers/sqlite`, `packages/drivers/firecrawl`, `packages/drivers/hubspot`, `packages/drivers/openai`, `packages/drivers/phoenix`, `packages/drivers/ecfr`, `packages/drivers/govinfo`, `packages/drivers/onepassword-cli`, `packages/drivers/shacl`, `packages/ecosystem/effect-drizzle` |
| 37 | tail: packages/epistemic + packages/execution-authority | 534 | `packages/epistemic/server`, `packages/epistemic/tables`, `packages/epistemic/use-cases`, `packages/epistemic/domain`, `packages/epistemic/ui`, `packages/execution-authority/server`, `packages/execution-authority/domain`, `packages/execution-authority/tables`, `packages/execution-authority/config` |
| 38 | tail: packages/foundation/capability 1/2 | 758 | `packages/foundation/capability/mcp-kit`, `packages/foundation/capability/walker`, `packages/foundation/capability/nlp-processing`, `packages/foundation/capability/observability`, `packages/foundation/capability/xdg` |
| 39 | github-actions part 2/2 | 791 | `packages/drivers/github-actions` |
| 40 | tail: packages/foundation/capability 2/2 + packages/foundation/modeling | 557 | `packages/foundation/capability/runtime-env`, `packages/foundation/capability/langextract`, `packages/foundation/capability/file-processing`, `packages/foundation/capability/api-transport`, `packages/foundation/capability/semantic-web`, `packages/foundation/capability/chalk`, `packages/foundation/modeling/github-reporting`, `packages/foundation/modeling/lexical`, `packages/foundation/modeling/schema`, `packages/foundation/modeling/epistemics`, `packages/foundation/modeling/github-commands`, `packages/foundation/modeling/rdf`, `packages/foundation/modeling/utils`, `packages/foundation/modeling/ontology` |
| 41 | tail: packages/foundation/ui-system + packages/law-practice | 636 | `packages/foundation/ui-system/dock-react`, `packages/foundation/ui-system/ui`, `packages/foundation/ui-system/dock`, `packages/foundation/ui-system/brand`, `packages/law-practice/tables` |
| 42 | tail: packages/ontology + packages/party + packages/shared | 345 | `packages/ontology/client`, `packages/ontology/use-cases`, `packages/ontology/server`, `packages/ontology/ui`, `packages/ontology/config`, `packages/party/domain`, `packages/shared/domain`, `packages/shared/tables` |
| 43 | tail: packages/tooling/infra | 343 | `packages/tooling/infra/ci-runners`, `packages/tooling/infra/github`, `packages/tooling/infra/infra-hosts`, `packages/tooling/infra/turbo-cache`, `packages/tooling/infra/cost-controls` |
| 44 | tail: packages/tooling/library 1/2 | 687 | `packages/tooling/library/repo-cli-kit`, `packages/tooling/library/repo-utils`, `packages/tooling/library/repo-tsconfig` |
| 45 | tail: packages/tooling/library 2/2 + packages/tooling/policy-pack | 798 | `packages/tooling/library/qa-capture`, `packages/tooling/library/repo-gate-run`, `packages/tooling/library/alchemy-github-runners`, `packages/tooling/library/alchemy-vercel`, `packages/tooling/library/palantiri`, `packages/tooling/library/codegen-kit`, `packages/tooling/library/repo-gate-record`, `packages/tooling/library/mcpb-kit`, `packages/tooling/library/alchemy-aws-extras`, `packages/tooling/library/ai-sync`, `packages/tooling/policy-pack/lint-rules`, `packages/tooling/policy-pack/repo-configs` |
| 46 | tail: packages/tooling/test-kit + packages/tooling/tool + packages/workspace + tools + the 224 root-level rows | 543 | `packages/tooling/test-kit/repo-gate-vitest`, `packages/tooling/test-kit/test-utils`, `packages/tooling/test-kit/fc-runs`, `packages/tooling/test-kit/test-runner`, `packages/tooling/tool/docgen`, `packages/workspace/server`, `packages/workspace/use-cases`, `packages/workspace/tables`, `packages/workspace/domain`, `tools/tsgo-shim` |
| 47 | repo-cli part 1/22 | 790 | `packages/tooling/tool/cli` |
| 48 | repo-cli part 2/22 | 790 | `packages/tooling/tool/cli` |
| 49 | repo-cli part 3/22 | 790 | `packages/tooling/tool/cli` |
| 50 | repo-cli part 4/22 | 790 | `packages/tooling/tool/cli` |
| 51 | repo-cli part 5/22 | 790 | `packages/tooling/tool/cli` |
| 52 | repo-cli part 6/22 | 790 | `packages/tooling/tool/cli` |
| 53 | repo-cli part 7/22 | 790 | `packages/tooling/tool/cli` |
| 54 | repo-cli part 8/22 | 790 | `packages/tooling/tool/cli` |
| 55 | repo-cli part 9/22 | 790 | `packages/tooling/tool/cli` |
| 56 | repo-cli part 10/22 | 790 | `packages/tooling/tool/cli` |
| 57 | repo-cli part 11/22 | 790 | `packages/tooling/tool/cli` |
| 58 | repo-cli part 12/22 | 790 | `packages/tooling/tool/cli` |
| 59 | repo-cli part 13/22 | 790 | `packages/tooling/tool/cli` |
| 60 | repo-cli part 14/22 | 790 | `packages/tooling/tool/cli` |
| 61 | repo-cli part 15/22 | 790 | `packages/tooling/tool/cli` |
| 62 | repo-cli part 16/22 | 790 | `packages/tooling/tool/cli` |
| 63 | repo-cli part 17/22 | 790 | `packages/tooling/tool/cli` |
| 64 | repo-cli part 18/22 | 790 | `packages/tooling/tool/cli` |
| 65 | repo-cli part 19/22 | 790 | `packages/tooling/tool/cli` |
| 66 | repo-cli part 20/22 | 790 | `packages/tooling/tool/cli` |
| 67 | repo-cli part 21/22 | 790 | `packages/tooling/tool/cli` |
| 68 | repo-cli part 22/22 | 790 | `packages/tooling/tool/cli` |
| 69 | closure tail: markdown src part 1/2 (AST-identical) | 493 | `packages/foundation/modeling/markdown` |
| 70 | closure tail: markdown src part 2/2 (AST-identical) | 493 | `packages/foundation/modeling/markdown` |
| 71 | closure tail: foundation/capability and github modeling (AST-identical) | 435 | `packages/foundation/capability/cli-kit`, `packages/foundation/capability/runtime-env`, `packages/foundation/capability/walker`, `packages/foundation/modeling/github-reporting`, `packages/foundation/modeling/github-commands` |
| 72 | closure tail: repo-cli, github-actions, repo-cli-kit and repo-utils (AST-identical) | 144 | `packages/tooling/tool/cli`, `packages/drivers/github-actions`, `packages/tooling/library/repo-cli-kit`, `packages/tooling/library/repo-utils` |
| 73 | Lambda fence: runner handler packages and identity, schema, data and utils src (only on the CI driver's word) | 471 | `packages/tooling/infra/ci-runners`, `packages/tooling/library/alchemy-github-runners`, `packages/tooling/library/alchemy-aws-extras`, `packages/foundation/modeling/identity`, `packages/foundation/modeling/schema`, `packages/foundation/primitive/data`, `packages/foundation/modeling/utils` |

## Fenced rows per package

| Scope | Rows | Regular waves | Closure tail | Lambda fence |
| --- | ---: | ---: | ---: | ---: |
| `packages/foundation/modeling/schema` | 178 | 52 | 0 | 126 |
| `packages/foundation/modeling/markdown` | 2738 | 1752 | 986 | 0 |
| `packages/foundation/capability/cli-kit` | 663 | 375 | 288 | 0 |
| `packages/foundation/modeling/utils` | 25 | 6 | 0 | 19 |
| `packages/foundation/primitive/data` | 41 | 0 | 0 | 41 |
| `packages/foundation/capability/runtime-env` | 161 | 71 | 90 | 0 |
| `packages/foundation/modeling/identity` | 34 | 0 | 0 | 34 |
| `packages/tooling/tool/cli` | 17473 | 17390 | 83 | 0 |
| `packages/tooling/library/repo-utils` | 219 | 217 | 2 | 0 |
| `packages/drivers/github-actions` | 1617 | 1582 | 35 | 0 |
| `packages/tooling/library/repo-cli-kit` | 293 | 269 | 24 | 0 |
| `packages/foundation/modeling/github-commands` | 26 | 16 | 10 | 0 |
| `packages/foundation/capability/walker` | 244 | 224 | 20 | 0 |
| `packages/foundation/modeling/github-reporting` | 212 | 185 | 27 | 0 |
| `packages/tooling/infra/ci-runners` | 259 | 95 | 0 | 164 |
| `packages/tooling/library/alchemy-github-runners` | 179 | 97 | 0 | 82 |
| `packages/tooling/library/alchemy-aws-extras` | 26 | 21 | 0 | 5 |

## Regular-wave scopes

Row counts exclude fenced rows.

| Scope | Rows | src | test | Wave |
| --- | ---: | ---: | ---: | --- |
| `packages/tooling/tool/cli` | 17390 | 9452 | 7938 | 47–68 |
| `packages/foundation/modeling/markdown` | 1752 | 270 | 1482 | 5–23 |
| `packages/drivers/github-actions` | 1582 | 563 | 1019 | 31–39 |
| `packages/tooling/library/repo-workspaces` | 1500 | 3 | 1497 | 1–2 |
| `apps/professional-desktop` | 1110 | 696 | 414 | 6–7 |
| `packages/drivers/git` | 980 | 522 | 458 | 8–9 |
| `packages/foundation/modeling/yaml` | 874 | 13 | 861 | 3–4 |
| `packages/tooling/test-kit/memfs` | 835 | 498 | 337 | 10–11 |
| `packages/foundation/capability/technical-drawing` | 776 | 408 | 368 | 12 |
| `packages/drivers/occt` | 761 | 375 | 386 | 13 |
| `packages/foundation/modeling/lockfiles` | 751 | 192 | 559 | 15 |
| `packages/foundation/modeling/package-json` | 727 | 259 | 468 | 16 |
| `packages/drivers/github` | 643 | 273 | 370 | 17 |
| `packages/tooling/library/agent-memory-store` | 500 | 199 | 301 | 18 |
| `packages/foundation/modeling/xlsx` | 455 | 279 | 176 | 19 |
| `packages/foundation/capability/config-file` | 436 | 121 | 315 | 20 |
| `packages/law-practice/use-cases` | 429 | 224 | 205 | 21 |
| `packages/drivers/acp` | 392 | 251 | 141 | 22 |
| `packages/foundation/modeling/sbom` | 391 | 92 | 299 | 24 |
| `packages/foundation/capability/cli-kit` | 375 | 24 | 351 | 25 |
| `packages/law-practice/domain` | 375 | 256 | 119 | 26 |
| `packages/drivers/duckdb` | 359 | 154 | 205 | 27 |
| `packages/foundation/ui-system/editor` | 337 | 285 | 52 | 28 |
| `apps/labs/ciops` | 300 | 198 | 102 | 29 |
| `packages/drivers/commands` | 273 | 140 | 133 | 34 |
| `packages/foundation/ui-system/dock-react` | 273 | 216 | 57 | 41 |
| `packages/tooling/library/repo-cli-kit` | 269 | 139 | 130 | 44 |
| `infra` | 258 | 179 | 79 | 32 |
| `packages/foundation/ui-system/ui` | 256 | 254 | 2 | 41 |
| `packages/execution-authority/server` | 249 | 126 | 123 | 37 |
| `packages/foundation/capability/mcp-kit` | 231 | 95 | 136 | 38 |
| `packages/foundation/capability/walker` | 224 | 36 | 188 | 38 |
| `packages/tooling/library/repo-utils` | 217 | 125 | 92 | 44 |
| `apps/practice-kg-mcp` | 216 | 123 | 93 | 30 |
| `packages/documents/server` | 210 | 107 | 103 | 33 |
| `packages/tooling/library/repo-tsconfig` | 201 | 85 | 116 | 44 |
| `packages/drivers/alchemy-postgres` | 195 | 99 | 96 | 34 |
| `packages/foundation/modeling/github-reporting` | 185 | 35 | 150 | 40 |
| `packages/drivers/m365-mcp` | 168 | 70 | 98 | 34 |
| `packages/tooling/policy-pack/lint-rules` | 166 | 82 | 84 | 45 |
| `packages/drivers/pdf-tools` | 166 | 86 | 80 | 35 |
| `packages/epistemic/server` | 164 | 37 | 127 | 37 |
| `packages/ontology/client` | 158 | 79 | 79 | 42 |
| `apps/oip-web` | 153 | 92 | 61 | 30 |
| `packages/tooling/library/qa-capture` | 124 | 74 | 50 | 45 |
| `packages/drivers/libpff` | 122 | 66 | 56 | 35 |
| `packages/tooling/library/repo-gate-run` | 119 | 56 | 63 | 45 |
| `packages/foundation/capability/nlp-processing` | 110 | 103 | 7 | 38 |
| `packages/foundation/capability/observability` | 106 | 55 | 51 | 38 |
| `packages/agents/client` | 105 | 81 | 24 | 32 |
| `packages/ecosystem/effect-drizzle` | 103 | 67 | 36 | 36 |
| `packages/tooling/library/alchemy-github-runners` | 97 | 0 | 97 | 45 |
| `packages/tooling/infra/ci-runners` | 95 | 0 | 95 | 43 |
| `packages/_internal/db-admin` | 93 | 0 | 93 | 32 |
| `apps/docket-intake` | 93 | 46 | 47 | 30 |
| `packages/foundation/capability/xdg` | 87 | 21 | 66 | 38 |
| `packages/ontology/use-cases` | 86 | 50 | 36 | 42 |
| `packages/drivers/runpod` | 86 | 69 | 17 | 35 |
| `packages/drivers/box` | 84 | 63 | 21 | 35 |
| `packages/foundation/modeling/lexical` | 83 | 41 | 42 | 40 |
| `packages/tooling/test-kit/repo-gate-vitest` | 83 | 27 | 56 | 46 |
| `packages/tooling/infra/github` | 82 | 24 | 58 | 43 |
| `apps/practice-setup` | 80 | 58 | 22 | 30 |
| `packages/foundation/capability/runtime-env` | 71 | 0 | 71 | 40 |
| `packages/tooling/test-kit/test-utils` | 71 | 35 | 36 | 46 |
| `packages/tooling/library/alchemy-vercel` | 69 | 46 | 23 | 45 |
| `packages/tooling/infra/infra-hosts` | 69 | 34 | 35 | 43 |
| `apps/practice-gateway` | 67 | 45 | 22 | 30 |
| `packages/drivers/graph-3d` | 66 | 66 | 0 | 35 |
| `packages/drivers/tika` | 66 | 22 | 44 | 35 |
| `packages/drivers/box-provisioning` | 65 | 35 | 30 | 35 |
| `packages/drivers/m365` | 65 | 49 | 16 | 35 |
| `packages/drivers/cosmos` | 61 | 60 | 1 | 35 |
| `packages/foundation/capability/langextract` | 60 | 55 | 5 | 40 |
| `packages/tooling/library/palantiri` | 60 | 41 | 19 | 45 |
| `apps/labs/semantica` | 60 | 22 | 38 | 30 |
| `packages/drivers/ffmpeg` | 59 | 23 | 36 | 36 |
| `apps/storybook` | 59 | 59 | 0 | 30 |
| `packages/tooling/library/codegen-kit` | 55 | 44 | 11 | 45 |
| `packages/foundation/ui-system/dock` | 54 | 47 | 7 | 41 |
| `packages/foundation/modeling/schema` | 52 | 0 | 52 | 40 |
| `packages/tooling/infra/turbo-cache` | 51 | 25 | 26 | 43 |
| `packages/execution-authority/domain` | 48 | 13 | 35 | 37 |
| `packages/drivers/obs` | 47 | 19 | 28 | 36 |
| `packages/drivers/doc-text` | 46 | 28 | 18 | 36 |
| `packages/drivers/freshbooks` | 46 | 29 | 17 | 36 |
| `packages/tooling/infra/cost-controls` | 46 | 16 | 30 | 43 |
| `packages/tooling/tool/docgen` | 45 | 16 | 29 | 46 |
| `packages/law-practice/tables` | 40 | 0 | 40 | 41 |
| `packages/agents/server` | 38 | 27 | 11 | 32 |
| `packages/documents/use-cases` | 38 | 30 | 8 | 33 |
| `packages/foundation/modeling/epistemics` | 38 | 21 | 17 | 40 |
| `packages/drivers/exiftool` | 36 | 25 | 11 | 36 |
| `packages/tooling/test-kit/fc-runs` | 36 | 12 | 24 | 46 |
| `packages/party/domain` | 36 | 12 | 24 | 42 |
| `packages/drivers/postgres` | 33 | 20 | 13 | 36 |
| `apps/practice-claude-mod` | 33 | 26 | 7 | 30 |
| `packages/ontology/server` | 31 | 14 | 17 | 42 |
| `packages/workspace/server` | 30 | 12 | 18 | 46 |
| `packages/tooling/policy-pack/repo-configs` | 26 | 14 | 12 | 45 |
| `packages/drivers/uspto-mcp` | 26 | 1 | 25 | 36 |
| `packages/drivers/wink` | 26 | 15 | 11 | 36 |
| `packages/documents/tables` | 25 | 0 | 25 | 33 |
| `packages/drivers/nlp-mcp` | 25 | 13 | 12 | 36 |
| `packages/tooling/library/repo-gate-record` | 25 | 11 | 14 | 45 |
| `packages/tooling/library/mcpb-kit` | 23 | 12 | 11 | 45 |
| `packages/drivers/pacer` | 23 | 21 | 2 | 36 |
| `apps/practice-review-hub` | 23 | 13 | 10 | 30 |
| `packages/drivers/windows-secrets` | 23 | 18 | 5 | 36 |
| `packages/tooling/library/alchemy-aws-extras` | 21 | 0 | 21 | 45 |
| `packages/epistemic/tables` | 21 | 0 | 21 | 37 |
| `packages/epistemic/use-cases` | 21 | 6 | 15 | 37 |
| `packages/foundation/capability/file-processing` | 21 | 15 | 6 | 40 |
| `packages/workspace/use-cases` | 21 | 6 | 15 | 46 |
| `apps/labs/lane-cockpit` | 18 | 14 | 4 | 32 |
| `packages/tooling/test-kit/test-runner` | 18 | 16 | 2 | 46 |
| `infra/lambda/turbo-cache` | 17 | 13 | 4 | 32 |
| `packages/shared/domain` | 17 | 9 | 8 | 42 |
| `packages/foundation/modeling/github-commands` | 16 | 0 | 16 | 40 |
| `apps/practice-mail-tagging` | 16 | 8 | 8 | 32 |
| `packages/drivers/uspto` | 16 | 16 | 0 | 36 |
| `packages/drivers/gov-legal-mcp` | 15 | 0 | 15 | 36 |
| `packages/ontology/ui` | 14 | 14 | 0 | 42 |
| `packages/drivers/pglite` | 14 | 7 | 7 | 36 |
| `packages/drivers/tailscale` | 14 | 8 | 6 | 36 |
| `packages/tooling/library/ai-sync` | 13 | 10 | 3 | 45 |
| `apps/beep-effect-web` | 13 | 13 | 0 | 32 |
| `packages/foundation/ui-system/brand` | 13 | 10 | 3 | 41 |
| `packages/agents/use-cases` | 12 | 5 | 7 | 32 |
| `packages/execution-authority/tables` | 12 | 0 | 12 | 37 |
| `packages/drivers/openclaw` | 12 | 1 | 11 | 36 |
| `apps/labs/api-docs` | 11 | 9 | 2 | 32 |
| `packages/drivers/xstate` | 11 | 7 | 4 | 36 |
| `packages/epistemic/domain` | 10 | 0 | 10 | 37 |
| `packages/drivers/tesseract` | 10 | 2 | 8 | 36 |
| `packages/agents/domain` | 9 | 9 | 0 | 32 |
| `apps/labs/lejeune-bolt-workbench` | 9 | 9 | 0 | 32 |
| `packages/drivers/ai-provider-cli` | 8 | 8 | 0 | 36 |
| `packages/documents/domain` | 8 | 5 | 3 | 33 |
| `packages/drivers/poppler` | 8 | 2 | 6 | 36 |
| `apps/todox` | 8 | 8 | 0 | 32 |
| `packages/drivers/pretext` | 7 | 6 | 1 | 36 |
| `packages/drivers/rdf-canonize` | 7 | 5 | 2 | 36 |
| `packages/foundation/modeling/rdf` | 7 | 6 | 1 | 40 |
| `packages/workspace/tables` | 7 | 0 | 7 | 46 |
| `packages/foundation/capability/api-transport` | 6 | 3 | 3 | 40 |
| `apps/practice-m365-contacts` | 6 | 3 | 3 | 32 |
| `tools/tsgo-shim` | 6 | 6 | 0 | 46 |
| `packages/foundation/modeling/utils` | 6 | 0 | 6 | 40 |
| `packages/architecture-lab/server` | 5 | 0 | 5 | 32 |
| `packages/execution-authority/config` | 5 | 0 | 5 | 37 |
| `packages/foundation/capability/semantic-web` | 5 | 3 | 2 | 40 |
| `packages/agents/tables` | 4 | 0 | 4 | 32 |
| `packages/foundation/capability/chalk` | 4 | 4 | 0 | 40 |
| `packages/drivers/drizzle` | 4 | 1 | 3 | 36 |
| `packages/epistemic/ui` | 4 | 3 | 1 | 37 |
| `packages/drivers/openai-compat` | 4 | 1 | 3 | 36 |
| `packages/foundation/modeling/ontology` | 3 | 3 | 0 | 40 |
| `apps/practice-identify` | 3 | 1 | 2 | 32 |
| `packages/drivers/sanity` | 3 | 2 | 1 | 36 |
| `packages/drivers/sqlite` | 3 | 0 | 3 | 36 |
| `packages/drivers/firecrawl` | 2 | 2 | 0 | 36 |
| `packages/drivers/hubspot` | 2 | 1 | 1 | 36 |
| `packages/ontology/config` | 2 | 0 | 2 | 42 |
| `packages/drivers/openai` | 2 | 0 | 2 | 36 |
| `packages/drivers/phoenix` | 2 | 1 | 1 | 36 |
| `apps/labs/trustgraph-workbench` | 2 | 1 | 1 | 32 |
| `packages/workspace/domain` | 2 | 2 | 0 | 46 |
| `packages/architecture-lab/tables` | 1 | 0 | 1 | 32 |
| `packages/drivers/ecfr` | 1 | 0 | 1 | 36 |
| `packages/drivers/govinfo` | 1 | 1 | 0 | 36 |
| `packages/drivers/onepassword-cli` | 1 | 0 | 1 | 36 |
| `packages/drivers/shacl` | 1 | 0 | 1 | 36 |
| `packages/shared/tables` | 1 | 1 | 0 | 42 |
