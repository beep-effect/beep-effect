# C3.1 implementation brief — scripts-block schema, gate, writers, fleet rewrite

Lane: Codex, medium effort, in the worktree on branch `ttc/c3-1-package-scripts` (base: main
`3aa8f688d9`, which carries the ratified design gate). Orchestrator: Fable (publishes, reviews,
never merges). Results file: `goals/time-to-certainty/research/c3-1-implementation.md` (create it
in your first turn, append per stage; receipts for friction go to `research/OPPORTUNITIES.md` at
the moment they happen, redacted for a public repo).

## Read first (in this order)

1. `goals/time-to-certainty/research/c3-lane-task-table.md` — the ratified design. This brief
   implements §7.2 row "PR 1 (C3.1)". Binding sections: §1 D3, D4, D7, D9 (only the two gates),
   D11, D13, D15, D16; §3 (schema and service sketch, presence table); §6 (tests); §7.1
   (acceptance); §8 (out of scope).
2. `goals/time-to-certainty/research/decisions.md` — rulings 19–25 and the round-7 entry.
3. `goals/time-to-certainty/research/c3-sublane-inputs.md` — census; you need only the fleet
   numbers and the `doctest` section.
4. `AGENTS.md` (Code Laws, Discovery & Reuse, Quality Operator) and
   `.patterns/jsdoc-documentation.md`. Effect v4 APIs are validated against `.repos/effect`
   (`packages/effect/src/Schema.ts`, `SchemaTransformation.ts`, `Context.ts`), never from memory.
5. Precedents: `packages/tooling/tool/cli/src/internal/repo-run/` (schema module style, `$I`
   identifiers, `S.Class`, `LiteralKit`), `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofLedger.ts:190`
   (`Context.Service`), `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1766–1965`
   (`appBaseScripts`, `packageScripts`), `commands/Architecture/OperationPlanPackageJson.ts`,
   `commands/DeletePackage/`, `commands/Lint/Lint.command.ts` (`lintSubcommands`,
   `runDeprecatedApiLintShard`), `commands/Codegen/Codegen.command.ts`, `vitest.shared.ts`,
   root `package.json` scripts, `turbo.json`.

## Design order (non-negotiable)

Schema → `Context.Service` contract → implementation. Do not build helpers first and compose
later. `effect/HashMap`/`HashSet` families only (never `Set`/`Map`); `Effect.fn` or
`Effect.fnUntraced` for every generator function; typed errors as tagged errors; `LiteralKit`
for literal domains (no `as const` on inline arrays passed to it); JSDoc on exports with
`**Example** (Title)` sections and `@category`/`@since`; tests import package source through
`@beep/*` aliases.

## Stages — one commit each, in this order, with the results file appended after each

Use `git add <paths>` (never `git add -A`) and conventional commit messages
(`feat(repo-cli): …`, body lines under 100 chars). Do not push. Do not run `yeet publish`.

### Stage A — schema module

`packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts` (+ `index.ts`),
per §3: `PackageScriptsRuleVersion` (`package-scripts-rules/v1`), `PackageKind` (library, tool,
ecosystem, app, lab, infra, exempt), `TaskScriptName`, `ImplScriptName`, `TaskScriptBinding`
(`indirection` with `ifPresent`, `cli`, `owned`), `TaskScriptPresence` (`required`, `optional`,
`absent`, `derived` with rule `doctest-sources` | `codegen-generator`), `TaskScriptRule`,
`ImplScriptDefault`, `ScriptsBlock` (HashMap tiers; `Encoded` namespace), `ScriptsRecord` +
`scriptsBlockFromRecord(kind)` via `S.decodeTo` + `SchemaTransformation.transform` (function
replacers only, typed failures), `PackageScriptsDrift` (six variants), `ManifestCount`,
`PackageScriptsReportWire`, `PackageScriptsReport`, `PackageScriptsReportFromWire`,
`CodegenGeneratorPackage` (the eight generators listed in §3). The canonical rule table of §3
is data in this module (one `TaskScriptRule` per (kind, key)), with the per-kind
`ImplScriptDefault` values taken from today's generators (`packageScripts`, `appBaseScripts`,
`renderPackageJsonOperation`). Tests: `packages/tooling/tool/cli/test/package-scripts.schemas.test.ts`
(decode/encode round trips, tier disjointness, every rule row decodes, the presence table
matches §3 literally).

### Stage B — service and gate

`PackageScriptsPolicy.ts` (`Context.Service`, shape per §3: `kindOf`, `rules`, `expected`,
`diff`, `check`, `write`). `kindOf` reads the root `workspaces` globs and the path prefixes in
§3; out-of-domain manifests are ignored. `DerivationEvidence`: doctest owners come from the same
selector the worker will use (`src/**/*.{ts,tsx}`, excluding `.d.ts`, `test/fixtures`,
`node_modules`, `.context`, and marked by `import.meta.vitest`), minus bypassing configs (a
package `vitest*.config.ts` that does not import `vitest.shared.ts`, e.g. `apps/storybook`) which
are reported as `derivation-conflict`; generators come from `CodegenGeneratorPackage`.
`--write`: strict-tier fixes, missing `beep:*` defaults, placeholder removal
(`echo 'no codegen needed'` and the "will be implemented" text), never edits an existing
`beep:*` value or any extra key, idempotent, stable key order. CLI: `beep lint package-scripts
--check|--write [--json]`, registered in `lintSubcommands`, and `beep lint policy-fingerprint
--check|--write` per D15 (generator over the `src/**` of `@beep/repo-cli`'s transitive workspace
`dependencies` closure plus the root tool configs the checkers read: `eslint.config.mjs`,
`tsdoc.json`, `.oxlintrc.json`, `_typos.toml`, `knip.jsonc`, `.fallowrc.jsonc`, `biome.jsonc`,
`tsconfig.base.json`, `tsconfig.json`; output `standards/policy-tools.fingerprint.json` with the
input list embedded so the gate and the generator share one source of truth). Add both to
`rootRepoLintPolicySteps` in `Quality/Tasks.ts` as CLI steps (the Turbo root tasks for them
come in C3.5) and to `beep:preflight` (`--write` forms, before the checks). Tests: literal
contract tests (§3 "Gate contract") including app/infra docgen retained, optional parallel
scripts retained, impl values and extras preserved, idempotent write, fixture exclusion, exempt
preserved, derivation-conflict, negative drift, and a fingerprint freshness test.

### Stage C — writers converge

`CreatePackage.command.ts` (`packageScripts`, `appBaseScripts`), `Architecture/OperationPlanPackageJson.ts`,
and `DeletePackage` consume the rule table and defaults from the schema module (one canonical
block per kind). Codegen placeholders are no longer stamped. Update `create-package.test.ts`
and the architecture/delete-package tests to literal expectations of the new block (do not
derive expectations from the rule table).

### Stage D — thin workers and the doctest mode branch (D16)

- `beep lint deprecated-apis --package <dir>`: eslint over the package directory with
  `--config <repoRoot>/eslint.config.mjs`, `BEEP_ESLINT_PROFILE=deprecated-apis`, a
  `NODE_OPTIONS` heap cap (default `--max-old-space-size=4096`), no eslint cache. The no-arg
  form keeps today's shard behaviour unchanged (C3.2 replaces it).
- `beep lint jsdoc --package <dir> | --root-only`: docs profile, `--max-warnings=0`;
  `--root-only` selects eligible files outside package workspaces excluding `apps/labs/**`.
- `beep lint laws --package <dir>`: runs terse-effect (`--check --advisory`), native-runtime,
  frozen-grant-set, effect-fn, package-test-imports (`--include-root <dir>`) scoped with
  `--include-prefix <dir>`; correct today, package-local scanner comes in C3.3.
- `vitest.shared.ts`: the `BEEP_VITEST_DOCTEST` branch per §5 (plugin, `include: []`,
  `includeSource: ["src/**/*.{ts,tsx}"]`, fixtures excluded, `passWithNoTests` false in doctest
  mode, serial). Export `vitestDoctestActive`. Root `vitest.docs.ts` and the hosted lane are
  untouched here (C3.4).
- Tests for each worker's argv/env and one fixture run of the doctest branch
  (`test/fixtures/doctest-lane/package/` gains `beep:doctest`/`doctest`; keep the existing
  root-config test passing).

### Stage E — fleet rewrite, codegen split, law line (last; separate commit)

- `beep codegen` becomes a group with `barrel` (today's default, `--package`, `--dry-run`);
  root `codegen` → `bunx turbo run codegen`; root `codegen:barrel` → `bun run beep codegen barrel`;
  `@beep/identity`'s script → `beep-cli codegen barrel`; migrate every caller of the old default.
- Run `bun run beep lint package-scripts --write` once; commit the manifest diff as its own
  commit titled `chore(fleet): converge package scripts on the canonical block`. Expected shape:
  `docgen` → `bun run beep:docgen` + `beep:docgen: bunx --bun --no-install docgen` across the
  fleet (the docgen tool keeps `bun run src/bin.ts` as its `beep:docgen`); the four new keys
  (`lint:deprecated-apis`, `lint:jsdoc` except labs, `lint:laws`; `doctest` only on the 27
  owners); placeholders removed; `coverage` untouched (Q1 default); `beep:policy` left in place
  (retires in C3.3); exempt manifests untouched. Report the counts in the results file.
- `AGENTS.md` Quality Operator: one law line — the scripts block is generated; run
  `bun run beep lint package-scripts --write` (and never hand-edit task-facing keys).
- Do not register the four package tasks in `turbo.json` (C3.2–C3.4) and do not touch
  `rootRepoLintPolicySteps` beyond Stage B.

## Verification (after Stage E)

- `bun run docgen:local`.
- `CI=true TMPDIR=/tmp bun run beep quality package-verify @beep/repo-cli`.
- `bun run beep quality package-verify --quick <pkg>` for a batch of touched workspaces (at
  least: one library with doctests, one without, one app, one lab, `packages/ecosystem/*`,
  `infra`), via Turbo where the command supports it; record what ran.
- `bun run beep lint package-scripts --check` and `bun run beep lint policy-fingerprint --check`
  must be green on the rewritten tree; `bun run beep lint policy` filtered to the touched
  surfaces where a filter exists.
- `git diff --stat origin/main..HEAD | tail -1` must stay under 500 changed files.

Environment note: `bun` is on PATH through `~/.local/share/mise/installs/bun/1.4.2/bin`
(the worktree's `mise.toml` is not trusted on this station); use `bun run beep …` as usual.

## Hard rules

No push, no publish, no merge, no edits outside the files this brief names plus the tests that
pin them; no new dependencies; no `Set`/`Map`/`node:http`; no Effect v3 APIs; Yeet inbox rows
are acknowledged only with attributed forms; stop and write the blocker into the results file if
a stage cannot be completed as specified rather than improvising a different design.

## Amendment 2026-09-09 — commit contract (sandbox signing)

The lane's sandbox cannot reach the station's 1Password SSH signing agent, so the lane makes
**no git write commands at all** (no `git add`, `git commit`, `git stash`, `git checkout --`).
Instead, at the end of each stage it appends to the results file a `### Stage <X> — files`
section listing every path it created, changed, or deleted (one per line, repo-relative), then
continues with the next stage. The orchestrator stages those paths and creates the signed
per-stage commits. The graft code-graph tool is disabled for the lane; if `graft/` or `.ignore`
residue reappears, delete it and never list it. Verification commands of the brief still run
inside the lane (they need no git writes); `docgen:local` may use the local cache only.

## Amendment 2026-09-09 (2) — verification split (sandbox cannot spawn Node)

The lane's sandbox denies Node child processes (`spawnSync … EPERM` inside the tsgo shim), so
the canonical package verification (`beep quality package-verify`, `docgen:local`, Turbo runs)
is the orchestrator's job after each stage, outside the sandbox. Inside the lane, verify each
stage with the Bun-runtime checks only: `bunx --no-install biome check --write <files>`,
`bunx --bun --no-install tsgo -p packages/tooling/tool/cli/tsconfig.check.json --pretty false`
(and `tsconfig.test.json` for tests), and `bunx --bun --no-install vitest run <test files>
--pool=threads` from the package directory. Record those results and the file list per stage,
then continue to the next stage without waiting; do not acknowledge Yeet inbox rows for
sandbox-only failures (the orchestrator attributes them). Stage A is accepted by the
orchestrator's own run of the canonical verification.

## Amendment 2026-09-09 (3) — routing scope and one stage per launch

- **Routing files are in scope.** New `beep lint` subcommands must also be registered in the
  `LINT_POLICY_SUBCOMMANDS` allowlist in `packages/tooling/tool/cli/src/internal/cli/LintRouting.ts`
  (consumed by `src/bin-main.ts` and `commands/Quality/Quality.schemas.ts`, which need no edit
  unless a test pins them) and pinned in `test/lint-subcommand-allowlist.test.ts`. Stage B adds
  `package-scripts` and `policy-fingerprint`; Stage D adds `jsdoc` and `laws`. Any other file
  that a stage's entrypoint genuinely requires (a barrel, a routing table, a test that pins the
  old shape) is in scope too: name it in the stage's file list with one line of reason instead
  of stopping. Stop only for design conflicts, not for file-scope questions.
- **Restore the Stage B aggregate wiring** the previous attempt backed out: the two gates join
  `rootRepoLintPolicySteps` in `Quality/Tasks.ts` as CLI steps and `beep:preflight` runs their
  `--write` forms before the checks. Generate `standards/policy-tools.fingerprint.json` with
  `bun run beep lint policy-fingerprint --write` once the routing is fixed and list it.
- **One stage per launch.** Each launch finishes exactly the stage named in its prompt (its
  files list, its Bun-runtime checks, its results note) and then stops; the orchestrator runs
  the canonical verification and makes the signed commit between stages.

## Amendment 2026-09-09 (4) — converting a direct value to the indirection keeps package truth

When `--write` converts a task-facing key from a direct value to its indirection (today's
`docgen: bunx --bun --no-install docgen` → `docgen: bun run beep:docgen`), the implementation
key is seeded with the manifest's **existing** value (`beep:docgen := old docgen text`), not
the kind default, unless the existing value already is the indirection. For 129 manifests the
two coincide; for `packages/tooling/tool/docgen` (`bun run src/bin.ts`) the difference is the
package's truth (D3, D4). The kind default is used only when no prior value exists (a genuinely
missing key). Add a literal test for the docgen-tool case in Stage C or E, whichever touches
the writer first.

## Amendment 2026-09-09 (5) — `lint laws --package` and non-`packages/` workspaces

`lint package-test-imports --include-root` accepts roots under `packages/` only (its scan domain
is `packages/**/test/**`). The `laws --package <dir>` worker therefore runs package-test-imports
only when `<dir>` is under `packages/`; for apps, labs and infra it runs the four laws alone and
says so in its output. That preserves today's coverage exactly (the root policy step never
scanned app or infra tests). Add a worker test for an `apps/` directory. This lands at the start
of Stage E, before the fleet `--write`, so every stamped `lint:laws` script is runnable.
