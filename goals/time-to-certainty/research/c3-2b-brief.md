# C3.2b implementation brief — cheap per-package typed programs, then the shards retire

Owner: Fable orchestrator. Implementer: one Codex `codex exec` lane per stage (`gpt-6-astra`,
reasoning `medium`, `workspace-write`) in worktree `~/YeeBois/projects/beep-effect3-worktrees/ttc-c3-2b`
on branch `ttc/c3-2b-typed-programs`. The lane makes **no git writes** and runs **no graft commands**;
Fable stages listed paths by name and signs commits. Results file:
`goals/time-to-certainty/research/c3-2b-implementation.md` (one `## Stage <X>` per launch with
decisions + rejected alternatives, `### Stage <X> — files`, verification table with exit codes,
measurements, blockers). Sibling lane: C3.3 works in `ttc-c3-3` on the laws scanner and must not be
touched; do not edit `Laws/**` or the `lint:laws` registration.

## Read first

1. `research/decisions.md` rulings 19–30 (ruling 30 is the gate this PR must satisfy).
2. `research/c3-lane-task-table.md` D6 (revision 6), D10, D15, §2.1 row `lint:deprecated-apis`, §7.1,
   §7.2 row 2b.
3. `research/c3-2-implementation.md` (Hosted rounds 1 and 3: 52 of 141 tasks in 15 min per package
   versus 538 s for 28 shards; the silent-pass fix; the scope-only plan builder) and
   `research/OPPORTUNITIES.md` 2026-09-10 entries.
4. Code: `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts`
   (`projectService` with `defaultProject: "tsconfig.json"`, `allowDefaultProject`), `eslint.config.mjs`
   (`BEEP_ESLINT_PROFILE`), `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`
   (`runEslintWorker`, the shard program `runDeprecatedApiLint`, `lintDeprecatedApisCommand`),
   `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (`rootRepoLintPolicySteps`,
   `policyLintTurboStep`, `runRootLintPolicyTaskInternal`), `turbo.json`, a package's
   `tsconfig.check.json` (reference-keeping: `references` to upstream `tsconfig.json`, #1058) and
   `tsconfig.test.json` (`include: ["src","test"]`, no references), the tsconfig-sync generator
   (`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts`, comment near
   "The check overlay extends ./tsconfig.json"), `.repos/effect` for every Effect v4 API.

## Why (measured)

`beep lint deprecated-apis --package packages/foundation/modeling/identity` takes 15.6 s and 3.6 GB
RSS on the workstation for a tiny package: the project service resolves `@beep/*` (package exports
point at `src`) to upstream **sources** and rebuilds the transitive closure per package; test files
are claimed by the root `tsconfig.json` and pull the whole corpus. The 28 shards amortized that.
The reference-keeping check overlay resolves upstream packages through their built declarations
(#1058 census: upstream src 42,322 → 51 files, 286 s → 86 s across 139 packages). Ruling 30: the
shard program retires only after a hosted cold measurement shows the per-package typed program
within the shard budget (538 s for the full sweep on `beep-ec2-heavy`).

## Stages — one commit each, one stage per launch

### Stage A — the sweep switch (schema → contract → implementation)

1. Schema: `PolicySweepProgram = LiteralKit(["shards", "turbo"])`; class
   `LintPolicySweeps` (`schemaVersion: "lint-policy-sweeps/v1"`, `deprecatedApis: PolicySweepProgram`)
   in `Quality.schemas.ts`; a tracked file `standards/lint-policy.sweeps.jsonc` with
   `deprecatedApis: "shards"`; a module-level decoder (`S.fromJsonString`, JSONC-tolerant if the
   repo's JSONC helper exists — locate it, do not hand-strip comments).
2. Contract: `runRootLintPolicyTaskInternal` decodes the file once and passes the choice into
   `rootRepoLintPolicySteps(repoRoot, files, base, sweeps)`; the builder stays scope-only: with
   `base` undefined it emits the shard `repoCliStep` when `deprecatedApis === "shards"` and the
   Turbo step (`deprecatedApisTurboStep(repoRoot, undefined)`, full scope, no `--affected`) when
   `"turbo"`; with a base it emits the affected Turbo step as today. The standalone
   `beep lint deprecated-apis --full` follows the same switch. A missing or malformed file is a
   loud `QualityTaskConfigurationError`, never a silent default.
3. Tests (`quality-tasks.test.ts` with the existing `policyTurboStep` helpers, `lint-workers.test.ts`):
   both programs for full scope, the affected path unchanged, the malformed-file error. Keep every
   function trivial (Fallow CRAP). Add the sweep file to the Lint Policy step's inputs where a task
   declares them (`//#lint:policy-fingerprint` inputs via `lint policy-fingerprint --write` if the
   generator's root-config list is where it belongs; otherwise record why not).

### Stage B — the overlay-based typed worker

1. `DeprecatedApisESLintConfig.ts`: when `BEEP_ESLINT_PROJECT` is set (a comma-separated list of
   repo-relative tsconfig paths), `parserOptions` uses `project: [...]` + `tsconfigRootDir` instead
   of `projectService`; unset keeps today's project-service config byte-for-byte (the shards and
   the root `eslint .` keep it). Model the env through the config's existing typed boundary, not
   an ad-hoc `process.env` read scattered in rules.
2. `runEslintWorker` for the `deprecated-apis` profile sets `BEEP_ESLINT_PROJECT` to the package's
   `tsconfig.check.json,tsconfig.test.json` and lints exactly the files those overlays include
   (`src/**`, `test/**` as the overlays declare); files under the package that neither overlay
   claims (scripts, fixtures, storybook roots, the `allowDefaultProject` globs) get a second,
   project-service pass so coverage stays equal to the shards (D6). If a package lacks an overlay,
   fail loudly naming the package.
3. `turbo.json` `lint:deprecated-apis`: `dependsOn: ["^build", "//#lint:policy-fingerprint"]`
   (declarations come from upstream `dist`); inputs unchanged. Update the Stage B fixture in
   `policy-fingerprint-turbo-inputs.test.ts` (`^build` replaces `^transit`; an upstream source edit
   still invalidates through the build hash) and the pinned table expectation.
4. Prove locally on three packages of different size (`@beep/identity`, `@beep/schema`,
   `@beep/repo-cli`): wall and max RSS before (project service) and after (overlays, with
   `bunx turbo run build --filter=<pkg>...` having produced upstream `dist`), and that the
   diagnostics are identical (`--format json` diff). Then the fleet: `bunx turbo run
   lint:deprecated-apis --concurrency=4 --continue=dependencies-successful --summarize --cache=local:rw`
   cold and warm; record `Tasks/Cached/Time` and per-task p50/max from the run summary against
   Stage D's 2,387 task-seconds and 140 tasks.

### Stage C — hosted measurement (Fable flips the switch; the lane prepares)

The lane writes the exact measurement protocol into the results file: Fable commits
`standards/lint-policy.sweeps.jsonc` → `"turbo"` on this branch, the hosted Lint Policy lane runs the
full-scope Turbo sweep (with `^build` served by the remote cache), and the step's `done in` time is
compared with 538 s. Within budget → keep `turbo`; otherwise Fable reverts to `shards` and the PR
still lands Stages A–B (local reuse) with the receipt.

### Stage D — retire (only if Stage C passed)

Remove the shard list, runner, per-shard eslint cache and `DEPRECATED_API_LINT_CONCURRENCY`; the
standalone command without `--package` runs the Turbo sweep (full or affected); the root
`lint:deprecated-apis` script becomes `bunx turbo run lint:deprecated-apis`; tests follow. The root
`eslint .` for jsdoc stays (ruling 30 scopes this PR to typed programs). Update D6/§7.2 in the table
to record the measurement and the retirement; PLAN.md unchanged.

## Verification in the sandbox (record exit codes)

`bunx biome check <touched>`; `bunx oxlint --quiet --disable-nested-config <touched TS>`;
`bunx --no-install vitest run --pool=forks --maxWorkers=1 test/lint-command.test.ts`;
`bunx --no-install vitest run --pool=threads test/lint-workers.test.ts test/policy-fingerprint-turbo-inputs.test.ts`;
`bunx --bun vitest run --pool=threads test/quality-tasks.test.ts -t 'policy Turbo|plans repo-wide root lint|deprecated|sweep'`;
`bun run beep lint schema-first`; `bun run beep quality fallow audit --check --base origin/main --quiet`
and `... health --check --base origin/main --quiet` (read `.beep/fallow/*.check.json` `exitStatus`);
`bun run beep lint policy-fingerprint --check`; `bun run beep lint package-scripts --check`; a
source-resolving focused tsgo config over the touched tests. Fable runs package-verify, Node
coverage, and the hosted lane.

## Hard rules

No git writes; no graft; never touch `.claude/settings.json`, `graft/`, `.ignore`, `docs/_internal/`;
Effect v4 (`.repos/effect`), `HashMap`/`HashSet`, `Effect.fn`/`fnUntraced`, `LiteralKit` (no `as const`),
no `node:http`; JSDoc `**Example** (Title)` with `console.log`, module-path imports; tests via `@beep/*`
aliases, runtime-agnostic (no `Bun.*`), `describe(name, { concurrent: false }, fn)`; no inline
`S.decodeUnknownSync`; workspace scripts blocks are generated; keep `turbo.json` Biome-formatted;
never make a plan builder consult `isCi()` (scope is the caller's; the default ConfigProvider's env
trie is sticky per process); stop at the end of the stage.
