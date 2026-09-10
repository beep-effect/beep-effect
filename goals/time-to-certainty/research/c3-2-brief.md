# C3.2 implementation brief — fingerprint root task, eslint package tasks, shard retirement

Owner: Fable orchestrator (design, schemas, turbo contract, evidence judgment). Implementer: one
Codex `codex exec` lane per stage (`gpt-6-astra`, reasoning `medium`, `workspace-write`), launched
from the worktree `~/YeeBois/projects/beep-effect3-worktrees/ttc-c3-2` on branch
`ttc/c3-2-eslint-package-tasks`. The lane makes **no git writes** (no `add`, `commit`, `stash`,
`checkout`, `restore`); Fable stages the listed paths by name and signs the commits.

Results file: `goals/time-to-certainty/research/c3-2-implementation.md`. After each stage append
one `## Stage <X>` section with: the decisions taken (with the alternative rejected), a
`### Stage <X> — files` list of every tracked path created or edited (paths only), the
verification commands run with their exit codes, measurements, and blockers or open questions.
Never summarize in chat only; the file is the handoff.

## Read first (in this order)

1. `goals/time-to-certainty/research/decisions.md` — rulings 19–29 (round 6 onwards). Ruling 29
   is the mechanism this PR lands; ruling 28 fixes lane-id spelling.
2. `goals/time-to-certainty/research/c3-lane-task-table.md` — revision 5. D15 (revised), D6,
   D10, D16; §2.1 rows `lint:deprecated-apis` and `lint:jsdoc`; §2.2 rows
   `//#lint:policy-fingerprint` and `//#lint:jsdoc:root`; §4 shape; §7.1 fixtures; §7.2 row 2.
3. `goals/time-to-certainty/research/c3-turbo-facts.md` — verified Turbo 2.10 facts (root task
   syntax, `$TURBO_ROOT$`, hash composition, `--affected` with `affectedUsingTaskInputs`).
4. `goals/time-to-certainty/research/c3-1-brief.md` amendments 2–8 and
   `research/c3-1-implementation.md` — what C3.1 shipped (thin workers `lint deprecated-apis
   --package`, `lint jsdoc --package` / `--root-only`, the structure-only fingerprint, the
   scripts-block gate) and the sandbox facts (the lane cannot spawn Node; Bun-only checks).
5. `goals/time-to-certainty/research/OPPORTUNITIES.md` 2026-09-09 entries on the fingerprint
   merge-ref failure and on `describe.sequential` / eslint heap / coverage rows.
6. Code: `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` (fingerprint generator
   `policyToolsFingerprint`, `fingerprintPatterns`, `lintPolicyFingerprintCommand`, the shard
   runner `DEPRECATED_API_LINT_SHARDS` / `runDeprecatedApiLintShard` / `runDeprecatedApiLint`,
   the workers `runEslintWorker`), `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
   (`rootRepoLintPolicySteps`, `turboStep`, `turboRunArgs`, `boundedRootTurboArgs`),
   `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` (`BEEP_QUALITY_CHECK_CONCURRENCY`
   decoding at ~765, `lint-policy` lane), `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts`
   (ruling 28 lane specs and the id = label test), `packages/tooling/tool/cli/src/commands/Yeet/internal/{IssueClassification,WaveOrder}.ts`
   (needles and seed rows keyed on `lint:deprecated-apis` / `lint:jsdoc`),
   `turbo.json`, root `package.json`, `standards/policy-tools.fingerprint.json`,
   `packages/tooling/tool/cli/test/coverage-turbo-inputs.test.ts` and
   `test-tsgo-turbo-inputs.test.ts` (the existing turbo-input proof shape; locate the turbo.json
   schema they decode and reuse it).
7. `.repos/effect` for every Effect v4 API before writing it; `.patterns/jsdoc-documentation.md`.

## Design order (non-negotiable)

Schema → `Context.Service` contract → implementation. Every new shape is an `effect/Schema`
class or `LiteralKit` domain before any function consumes it; decode at the boundary once
(module-level `S.decodeEffect` / `S.decodeUnknownEffect` helpers, never inline
`S.decodeUnknownSync` in tests — the schema-first gate counts them).

## Stages — one commit each, one stage per launch, results file appended after each

### Stage A — ruling 29: the fingerprint root task and the dependency edge

Deliver, in this order:

1. **Schema.** `PolicyToolsFingerprint` keeps `policy-tools-fingerprint/v1` (a sorted declared
   input list, no digest). Add a schema for the `turbo.json` slice the writer touches (reuse the
   existing turbo configuration schema if the proof tests already decode one; otherwise a
   minimal `S.Struct` over `tasks["//#lint:policy-fingerprint"].inputs`).
2. **Computation.** `fingerprintPatterns` returns, per closure member, `<dir>/src/**` **and**
   `<dir>/package.json`; `policyToolsFingerprint` adds the root `package.json`, the existing
   `rootConfigs`, and `standards/policy-tools.fingerprint.json`, and **drops `**/package.json`**.
   Sorted, deduplicated, stable.
3. **Writer and gate.** `lint policy-fingerprint --write` writes the file **and** materializes the
   same list into `turbo.json` as `tasks["//#lint:policy-fingerprint"].inputs` (root task, so
   plain repo-relative globs, no `$TURBO_ROOT$`). Edit only that one array by a targeted splice
   that keeps the file's formatting (2-space JSON, Biome-stable); prove `--write` twice is
   byte-idempotent. `--check` compares both the file and the materialized list against the
   computation and names which of the two drifted in its failure message. `beep:preflight`
   already runs `--write`; keep the step id `lint:policy-fingerprint` in `Tasks.ts`.
4. **turbo.json + root script.** `"//#lint:policy-fingerprint": { "cache": true, "outputs": [],
   "inputs": [<materialized>] }`; root `package.json` script
   `"lint:policy-fingerprint": "beep-cli lint policy-fingerprint --check"` (a root task needs its
   root script; the root task never invokes turbo itself). Regenerate with `--write` after the
   code lands so the committed file and the materialized list are current.
5. **Proof tests** (Node **and** Bun; Effect process API as in Stage E4, never `Bun.*`;
   `@beep/*` aliases): (a) `turbo.json`'s materialized list equals the computed list for this
   repo; (b) a temp fixture repo (turbo binary from the repo's `node_modules/.bin`) with the root
   task and one package task `lint:jsdoc` that `dependsOn` it: a closure `src` edit changes the
   package task's hash, an edit outside the closure leaves it stable, and reverting restores the
   original hash; (c) `--check` fails when the materialized list drifts and when the file drifts,
   with the distinguishing message; (d) `--write` idempotence. If the sandbox cannot spawn the
   turbo binary (EPERM or a worker timeout), write the test anyway, mark it in the results file,
   and Fable runs it.

Do **not** touch the policy package tasks in this stage; the edge is added when they exist
(Stage B). Do not change `standards/policy-tools.fingerprint.json` by hand: run the writer.

### Stage B — `lint:deprecated-apis`, `lint:jsdoc` package tasks and `//#lint:jsdoc:root`

1. `turbo.json` entries exactly as §2.1 rows 291–292 and §2.2 row `//#lint:jsdoc:root` specify:
   inputs verbatim, `cache: true`, `outputs: []`, `dependsOn: ["^transit", "//#lint:policy-fingerprint"]`
   for `lint:deprecated-apis` with `env: ["NODE_OPTIONS"]`, `dependsOn: ["//#lint:policy-fingerprint"]`
   for `lint:jsdoc` and for `//#lint:jsdoc:root`. Root script `"lint:jsdoc:root": "beep-cli lint
   jsdoc --root-only"`. The stamped package scripts already exist (C3.1); no manifest touch.
   `bun run beep lint package-scripts --check` stays green.
2. Proof tests per §7.1(1)–(2) for each of the three tasks: in-package source edit changes the
   hash; an unrelated package's edit does not; negative closure fixtures — `eslint.config.mjs`,
   `tsdoc.json`, `packages/tooling/policy-pack/repo-configs/src/eslint/**` and
   `.../internal/eslint/**` edits change the hash; for `lint:deprecated-apis` a dependency
   package's source edit changes it (through `^transit`) and a root `tsconfig*.json` edit changes
   it; the fingerprint edge from Stage A holds for all three.
3. Smoke: `bunx turbo run lint:jsdoc --filter=@beep/schema --dry-run=json` and
   `bunx turbo run lint:deprecated-apis --filter=@beep/identity --dry-run=json` resolve the
   expected `resolvedTaskDefinition` (record the inputs count and the dependency task ids in the
   results file). A live run of each on one small package if the sandbox permits.

### Stage C — the typed invocation; shard runner and eslint caches retire (D6, D10 item 4)

1. In `rootRepoLintPolicySteps` replace the `lint:deprecated-apis` `repoCliStep` with a
   `turboStep` running `lint:deprecated-apis` at bounded concurrency
   (`BEEP_QUALITY_CHECK_CONCURRENCY`, default 4, decoded through the existing option schema),
   `--continue=dependencies-successful --summarize`, scoped with `--affected` and the caller's base
   locally when the run is not `--full`, unscoped for `--full` and for the hosted `lint-policy`
   lane. Replace the `lint:jsdoc` `bunxStep` with a `turboStep` running `lint:jsdoc` and
   `//#lint:jsdoc:root` together. Step labels stay `lint:deprecated-apis` and `lint:jsdoc`
   (ruling 28: id = label = log prefix; the GithubChecks id test, the IssueClassification needles
   and the WaveOrder rows must not change spelling). Reuse `turboRunArgs` and the remote-cache
   posture the other turbo steps use; never add an ambient `TURBO_SCM_BASE`.
2. Retire `DEPRECATED_API_LINT_SHARDS`, `runDeprecatedApiLintShard`, the shard loop in
   `runDeprecatedApiLint`, `DEPRECATED_API_LINT_CACHE_DIRECTORY` and `deprecatedApiLintCacheLocation`
   (and their tests). Keep `DEPRECATED_API_LINT_NODE_OPTIONS` (the worker heap). `beep lint
   deprecated-apis` without `--package` runs the same turbo invocation as the step so
   `bun run lint:deprecated-apis` keeps working; the root script becomes
   `"lint:deprecated-apis": "bunx turbo run lint:deprecated-apis"` (D11 pattern: no root task
   wraps a turbo-invoking script). Update `lint-workers.test.ts`, `lint-command.test.ts`,
   `quality-tasks.test.ts` and any other test that names the shards or the eslint cache.
3. Gotcha (quality-lanes campaign, 2026-09-09): the root `tsconfig.json` include list is not
   dead — typescript-eslint's project service resolves unclaimed files through it; do not narrow
   it. The labs shard tolerance (`--no-error-on-unmatched-pattern`) now belongs to the package
   worker for the lab kind if it is still needed; prove it on one lab package.
4. Regenerate the fingerprint (`bun run beep lint policy-fingerprint --write`) after the CLI
   source edits; the closure shape is unchanged, so the diff should be empty — record that.

### Stage D — before/after, packet state, receipts

1. Measurements in the results file (§7.1(4)): the shard runner's wall time from the last hosted
   Lint Policy run before this PR (Fable supplies it from `bun run beep ci lane-timings` if the
   sandbox cannot reach GitHub), the local turbo cold run and the warm run's per-task hit ratio
   (`--summarize` summaries under `.turbo/runs/`), and the count of `lint:deprecated-apis` /
   `lint:jsdoc` tasks scheduled. Never a whole-proof denominator.
2. `goals/time-to-certainty/PLAN.md`: tick C3.1 (merged as #1029) and C3.2.
3. Any friction met during Stages A–D is a receipt in `research/OPPORTUNITIES.md` at the moment
   it happens (redacted: no secrets, `~` for home paths, no session or machine ids).

## Verification split (the sandbox cannot spawn Node)

The lane runs, per stage, and records exit codes: `bunx biome check <touched files>`,
`bunx --bun vitest run --pool=threads <touched test files>` from `packages/tooling/tool/cli`,
`bun run beep lint policy-fingerprint --check`, `bun run beep lint package-scripts --check`,
and the turbo dry-runs above if the binary spawns. Fable runs `bun run beep quality
package-verify @beep/repo-cli` (`CI=true TMPDIR=/tmp`), `bun run docgen:local`, the live turbo
runs, the Node coverage run for touched files, and `bun run beep lint policy` locally.

## Hard rules

- No git writes. Never touch `.claude/settings.json`, `.claude/helpers/graft-*.cjs`, `graft/`,
  `.ignore`, or `docs/_internal/`. Never print secrets, tokens, or `OP_*` values.
- Effect v4 only (`.repos/effect`): `effect/HashMap` / `HashSet` never `Map` / `Set`;
  generator functions through `Effect.fn` / `Effect.fnUntraced`; `LiteralKit` for literal unions
  (no `as const` on the inline array); no `node:http`; Effect helper modules over native helpers;
  match helpers over conditional chains.
- JSDoc on every export: titled `**Example** (Title)` with an observable `console.log`, imports
  from `effect/Effect`-style module paths never root `effect`; `@category`, `@since 0.0.0`.
- Tests: `@beep/*` aliases into `src`; runtime-agnostic (Node and Bun); `describe(name,
  { concurrent: false }, fn)` never `describe.sequential`; no `Bun.*`; no inline
  `S.decodeUnknownSync`.
- Every new tracked file under `packages/tooling/tool/cli/src` needs coverage: the hosted
  ratchet adds a `new-uncovered-file` row per metric with uncovered units unless the file has a
  baseline row; keep new modules fully covered or tell Fable which rows to splice.
- Workspace scripts blocks are generated (`bun run beep lint package-scripts --write`); the root
  `package.json` scripts are hand-edited but the gate must stay green.
- Keep `turbo.json` Biome-formatted; the materializing writer must be idempotent.
- Stop at the end of the stage; do not start the next stage in the same launch.
