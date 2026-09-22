# Root script boundary review (2026-09-12)

Authority: manifest source review only. None of these commands was executed for this review. Categories identify the next interpretation boundary, not purity or qualification.

Census SHA-256: `a86f00d589254c1a03a4849566211627c84e53c8788d4c6c9e54516cadff60d5`. All 73 root script names occur exactly once below. Root scripts are entrypoints, not additional executable graph nodes.

## Findings

- `beep:preflight` mixes configuration, schema and manifest writes with checks. Its entire chain cannot be represented as a read-only verdict.
- `prepare` patches installed tooling; `postinstall` installs hooks and builds runner support. Dependency installation has these additional effects.
- `nuke` includes Docker shutdown and broad system/volume pruning. It is a destructive operator command, not a reusable quality computation.
- `op` resolves environment references before dispatch; generic CLI wrappers require argument- and environment-specific review.
- `changeset:status:since-main` names a mutable Git ref. Git selection is part of its input boundary.
- `deps:update` and `ui-add` request latest dependency/tool versions, so their resolution is not an exact pinned computation.
- Explicit baseline/report writes must retain their output paths and authority. A cached return code cannot substitute for those writes.
- Dispatch rows remain unresolved until the current CLI aliases, supplied arguments and nested processes are reviewed. A script name is not proof that its target command exists or succeeds.

## Complete manifest mapping

### CLI dispatch conditions observed in current source

`packages/tooling/tool/cli/src/bin-main.ts` recognizes six Quality verbs:
`build`, `check`, `test`, `lint`, `audit` and `coverage`. With no root global
flag, and excluding named lint-policy subcommands, it calls
`parseQualityTaskInvocation` and then `runQualityTask` when parsing succeeds.
Thus absence of these verbs from the displayed full command tree does not
establish that their root scripts are invalid. Full argument interpretation
still belongs to the Quality parser and planners.

Root global flags (help, version, completions and log level) disable this fast
path. A separate CI fast path follows the same global-flag restriction. These
branches must be retained when associating root invocations with planner output.

`packages/tooling/tool/cli/src/bin.ts` also handles exactly `lint --fix` by
checking tracked, staged and untracked Git paths. When all three Git probes
succeed and no changed paths exist, it returns success without loading the
full CLI or running lint. This is a Git-selected non-execution, not a cached
lint execution or a proof that every source file passes lint.

This section is source evidence only; no dispatch branch was executed here.

Thirteen pure `parseQualityTaskInvocation` observations additionally confirm
the argument boundary: audit retains `packages`, `--force`, `github` and
`quality` arguments; coverage removes the forwarding separator while retaining
`--write-baseline` and concurrency; `lint --fix` becomes a fix-mode invocation.
Lint-policy subcommands and help return no Quality invocation. These parser
observations execute no task and do not validate the downstream interpretation
or outcome of the retained arguments. The runtime boundary receipt binds the
private recipe, results and parser source.

### Explicit mutation or install boundary

| Root script | Exact manifest command |
| --- | --- |
| `beep:preflight` | `bun run beep tsconfig-sync && bun run fallow:boundaries:write && bun run beep quality jsdoc-inventory --ci-output-json .beep/ci/jsdoc-documentation.inventory.jsonc --ci-output-markdown .beep/ci/jsdoc-documentation.inventory.md && bun run beep lint schema-first --write && bun run beep lint package-scripts --write && bun run beep lint policy-fingerprint --write && bun run beep quality test-tsgo && bun run beep ci lane repo-sanity && bun run beep ci lane jsdoc-ratchet --inventory .beep/ci/jsdoc-documentation.inventory.jsonc && bun run beep ci lane knip && bun run beep lint policy` |
| `changeset` | `changeset` |
| `codegen` | `bunx turbo run codegen` |
| `codegen:barrel` | `bun run beep codegen barrel` |
| `config-sync` | `bun run beep tsconfig-sync` |
| `coverage:baseline:write` | `beep-cli coverage -- --write-baseline --concurrency=3` |
| `create-package` | `bun run beep create-package` |
| `deps:update` | `bunx syncpack update --target=latest --dependency-types=catalog` |
| `fallow:boundaries:write` | `bun run beep fallow boundaries --write` |
| `fallow:dead-code:baseline:write` | `fallow dead-code --config .fallowrc.jsonc --format json --quiet --summary --save-regression-baseline standards/fallow.dead-code.regression-baseline.jsonc` |
| `fallow:health:baseline:write` | `fallow health --config .fallowrc.jsonc --format json --quiet --summary --save-baseline standards/fallow.health.regression-baseline.jsonc` |
| `knowledge:refs-rewrite` | `bun scripts/knowledge-refs-rewrite.ts` |
| `lint:fix` | `beep-cli lint --fix` |
| `postinstall` | `lefthook install && bun run infra:prepare-gha-runners` |
| `prepare` | `effect-tsgo unpatch && node scripts/prune-tsgo-backups.mjs && effect-tsgo patch` |
| `purge` | `bun run beep purge` |
| `skills:update` | `bun run beep skills update` |
| `ui-add` | `bunx --bun shadcn@latest add --cwd packages/foundation/ui-system/ui` |
| `version-sync` | `bun run beep version-sync` |

### Service lifecycle or persistent execution

| Root script | Exact manifest command |
| --- | --- |
| `dev` | `bunx turbo run dev` |
| `nuke` | `docker compose down && docker system prune -a -f && docker volume prune -a -f` |
| `quality:dev` | `bun run beep quality dev` |
| `services:up` | `docker compose up -d` |
| `storybook` | `bunx turbo run storybook --filter=@beep/storybook` |
| `storybook:start` | `bunx turbo run storybook:start --filter=@beep/storybook` |

### Environment or generic dynamic dispatch

| Root script | Exact manifest command |
| --- | --- |
| `ai-sync` | `bun run --cwd packages/tooling/library/ai-sync ai-sync` |
| `beep` | `bun run packages/tooling/tool/cli/src/bin.ts --` |
| `codex:quality-review-fix-loop` | `bun run beep codex quality-review-fix-loop` |
| `fallow` | `fallow` |
| `files` | `bun run beep files` |
| `image` | `bun run beep image` |
| `op` | `op run --env-file=.env --` |

### Finite command with explicit configuration or predicate

| Root script | Exact manifest command |
| --- | --- |
| `check:configs` | `tsgo -p tsconfig.configs.json --noEmit --pretty false` |
| `config-sync:check` | `bun run beep tsconfig-sync --check` |
| `doctest` | `vitest run --config vitest.docs.ts` |
| `fallow:audit` | `fallow audit --config .fallowrc.jsonc --format json --quiet` |
| `fallow:boundaries:check` | `bun run beep fallow boundaries --check` |
| `fallow:dead-code` | `fallow dead-code --config .fallowrc.jsonc` |
| `fallow:dead-code:json` | `fallow dead-code --config .fallowrc.jsonc --format json --quiet` |
| `fallow:health` | `fallow health --config .fallowrc.jsonc` |
| `fallow:health:baseline:check` | `fallow health --config .fallowrc.jsonc --format json --quiet --summary --baseline standards/fallow.health.regression-baseline.jsonc` |
| `fallow:migrate:dry-run` | `fallow migrate --dry-run` |
| `impeccable:detect` | `node .claude/skills/impeccable/scripts/detector/cli/main.mjs` |
| `instructions:drift` | `test -L CLAUDE.md && test "$(readlink CLAUDE.md)" = AGENTS.md \|\| { echo 'drift: root CLAUDE.md must be a symlink to AGENTS.md (single-source law, agent-pipeline-velocity C1)'; exit 1; }` |
| `lint:jsdoc:root` | `beep-cli lint jsdoc --root-only` |
| `lint:native-runtime:roots` | `beep-cli laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology` |
| `lint:policy-fingerprint` | `beep-cli lint policy-fingerprint --check` |
| `skills:update:check` | `bun run beep skills update --check` |
| `topo-sort` | `bun run beep topo-sort` |

### Build or generated report output

| Root script | Exact manifest command |
| --- | --- |
| `docgen` | `bun run beep docgen local --full` |
| `docgen:local` | `bun run beep docgen local` |
| `docs:aggregate` | `beep-cli docgen aggregate` |
| `infra:prepare-gha-runners` | `node infra/node_modules/@pulumi/gharunners/scripts/build.js --compiler node_modules/typescript/bin/tsc` |
| `jsdoc:inventory` | `bun run beep quality jsdoc-inventory` |
| `storybook:build` | `bunx turbo run storybook:build --filter=@beep/storybook` |

### Unexpanded quality or tool dispatch

| Root script | Exact manifest command |
| --- | --- |
| `audit` | `beep-cli audit packages` |
| `audit:fresh` | `beep-cli audit packages --force` |
| `audit:full` | `bun run audit:fresh && bun run audit:github quality` |
| `audit:github` | `beep-cli audit github` |
| `build` | `beep-cli build` |
| `changeset:status` | `bun run beep quality changeset-status` |
| `changeset:status:since-main` | `bun run beep quality changeset-status --since origin/main` |
| `check` | `beep-cli check` |
| `coverage` | `beep-cli coverage` |
| `fallow:boundaries` | `bun run beep fallow boundaries` |
| `knip` | `knip-bun` |
| `lint` | `beep-cli lint` |
| `lint:deprecated-apis` | `beep-cli lint deprecated-apis` |
| `lint:oxlint` | `oxlint` |
| `pkg:verify` | `beep-cli quality package-verify` |
| `pkg:verify:quick` | `beep-cli quality package-verify --quick` |
| `test` | `beep-cli test` |
| `test:storybook` | `bunx turbo run test:storybook --filter=@beep/storybook` |
