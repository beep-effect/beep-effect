# C3.3 follow-up + C3.4 + C3.5 + C3.6 implementation brief — one PR

Owner: Fable orchestrator. Implementer: one Codex `codex exec` lane per stage (`gpt-6-astra`,
reasoning `medium`, `workspace-write`) in worktree `~/YeeBois/projects/beep-effect3-worktrees/ttc-c3-456`
on branch `ttc/c3-4-5-6-turbo-tasks` (created from `origin/main` at the commit recorded in
`c3-456-implementation.md`). The lane makes **no git writes** (no add/commit/stash/checkout/reset)
and runs **no graft commands**; Fable stages the listed paths by name and signs commits. Results
file: `goals/time-to-certainty/research/c3-456-implementation.md`, one `## Stage <X>` per launch with:
decisions + rejected alternatives, `### Stage <X> — files` (every path touched, created, deleted),
a verification table with the exact commands and exit codes, measurements, blockers, and the
precise residual for the next stage. One stage per launch; stop after the stage you were launched
for. If a stage cannot be completed as specified, finish every part that can be, and write the
blocker with evidence rather than widening or narrowing the scope silently.

## Read first

1. `research/decisions.md` rulings 19–31; `research/c3-lane-task-table.md` §2 (every input list is
   verbatim there: §2.1 row `doctest`, §2.2 all ★ rows), §2.3 (consumers), §4 (turbo.json shape and
   the D10 invocation table), §5 (doctest mode branch), §6 (test migration list), §7.1 (acceptance
   fixtures), §7.3 (risks R1–R7), D2/D5/D6/D7/D9/D10/D14/D15.
2. `research/c3-3-implementation.md` (the package-local scanner, `lint:laws`, the fleet cold
   measurement 141/141 in 86 s at concurrency 4 vs the five hosted steps 109 s), `research/c3-2-implementation.md`
   (the Turbo fixture idiom in `test/policy-fingerprint-turbo-inputs.test.ts` and
   `test/laws-turbo-inputs.test.ts`; the sticky-CI lesson: plan builders take scope explicitly,
   never read `isCi()`), `research/c3-2b-implementation.md` (the sweep switch).
3. Code anchors (line numbers are approximate; locate by symbol):
   `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` — `LINT_POLICY_STEP_CONCURRENCY` (~197),
   `scopedRepoCliStep` (~2520), `scopedLawStep` (~2538), `readLintPolicySweeps` (~2602),
   `rootRepoLintPolicySteps` (~2614), the existing Turbo policy invocations (`policyTurboStep`,
   `lint:jsdoc`/`lint:deprecated-apis`), `rootLintPolicyStepsForTesting`;
   `Quality/Quality.schemas.ts` — `PolicySweepProgram` (~38), `LintPolicySweeps` (~63);
   `standards/lint-policy.sweeps.jsonc`; `Ci/CiLane.ts` — `doctest` lane (~199, ~448, ~1213, ~2015,
   ~2260), `ci:knip` (~1439), `ci:jsdoc-ratchet:*` (~754, ~1425), `ci:fallow:*` (~1260, ~1280, ~1630),
   the Turbo step helpers (`turboStep`, `turboRunArgs`, `labsExcludeFilterArgs`, scm base at ~1107);
   `Quality/internal/GithubChecks.ts` — `quality:knip` (~303), `fallow:audit`/`fallow:dead-code`
   (~636–647), cheap-gate routes; `Quality/internal/TurboConfigProof.ts`; `Yeet/internal/WaveOrder.ts`;
   `Yeet/internal/ProofLedger.ts`, `ProofFact.ts`; `vitest.shared.ts` (`vitestDoctestActive` ~47,
   `include`/`includeSource` ~210); root `vitest.docs.ts`; `.github/workflows/heavy.yml` (`doctest_mode`
   ~89–139, `--mode` ~254–261); root `package.json` scripts; `turbo.json`;
   `src/internal/package-scripts/PackageScripts.schemas.ts`, `CreatePackage/CreatePackage.command.ts`,
   `Architecture/OperationPlanPackageJson.ts` (the `beep:policy` key);
   `packages/drivers/freshbooks/package.json`, `packages/drivers/box-provisioning/package.json`.
4. Effect v4 is `effect@4.0.0-rc.113`. Validate every Effect API against the reference checkout
   (`.repos/effect` in the main clone `~/YeeBois/projects/beep-effect3` if the worktree lacks the
   symlink), never from memory. Renames that already bit this packet: `Config.String` (not
   `Config.string`); the fast-check bridge is gone — property tests use
   `import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary"`, `Arbitrary.schema(Model)`,
   `Arbitrary.checkEffect(Arbitrary.all([...]), property, fcRuns(n))` from `@beep/test-utils`, and
   assert `result._tag === "Passed"` (pattern: `test/agent-effectiveness-command.test.ts`).

## Standing laws (AGENTS.md + packet)

- Schema → `Context.Service` contract → implementation. `LiteralKit` for literal unions (no
  `as const`). `effect/HashMap`/`HashSet`, never `Map`/`Set`. `Effect.fn`/`Effect.fnUntraced` for
  generator functions. Match helpers over conditional chains. No `node:http`.
- JSDoc on every exported symbol: `**Example** (Title)` sections that import through **exported**
  paths (`@beep/repo-cli/...`, never an `internal/*` path the export map blocks), `@category` +
  `@since` on every barrel export line (including named re-exports; pre-commit Biome reorders
  `export {}` above `export *`, so document each line, not the group), described `@see`. Run
  `bunx eslint --no-warn-ignored --max-warnings=0 --config eslint.config.mjs <touched src>` before
  reporting: the hosted `lint:jsdoc` lane is the root `eslint .` at zero warnings.
- Tests import package source through `@beep/*` aliases; they must run on **both** Bun
  (`beep:test`) and Node (`coverage`): no `Bun.*` APIs, no `@effect/platform-bun`. Coverage is
  ratcheted **per package with its own suite, in-process**: code you add to `repo-utils` needs a
  `repo-utils` test; a CLI branch reached only through a spawned `bun run bin.ts` child is
  uninstrumented — exercise commands in-process (`Command.runWith(cmd, { version })` with
  `ConfigProvider.fromUnknown`). Every new source file needs enough tests that its per-file rows
  clear the baseline (`standards/coverage.regression-baseline.jsonc`).
- Turbo: root tasks are `//#<script>` and need a root `package.json` script of that name; fixtures
  prove inputs with `--dry-run=json`/`--summarize` over a synthetic repo (idiom:
  `test/laws-turbo-inputs.test.ts`), never by assertion on the JSON text alone. Commit nothing;
  Fable commits `turbo.json` edits before probing `--affected` (turbo reads the committed base).
- Plan builders (`rootRepoLintPolicySteps` and successors) are scope-only functions: the caller
  passes `base`/`full`/sweeps; the builder never reads `CI`.
- Package scripts blocks are generated: `bun run beep lint package-scripts --write` after any
  scripts-schema change; `bun run beep lint policy-fingerprint --write` after any CLI source change
  under the fingerprint closure; both `--check` green before reporting.
- Friction receipts: when something is slower, harder, or riskier than it should be, append a
  receipt to `research/OPPORTUNITIES.md` at that moment (doing / evidence / would have prevented
  it), redacted for a public repo (`~` for home paths, no ids, minimal error text).

## Verification split

Lane (Bun sandbox, no Node spawn, no network): `bunx biome check --write <touched>`;
`bunx turbo run check package-test-typecheck --filter=@beep/repo-cli [--filter=<other touched pkg>]`;
`bunx vitest run <touched suites> --pool=threads` in the package dir; eslint zero warnings on touched
`src`; `bun run beep lint package-scripts --check`; `bun run beep lint policy-fingerprint --check`;
`bunx turbo run <task> --dry-run=json` probes. Fable: `bun run beep quality package-verify
@beep/repo-cli` (`CI=true TMPDIR=/tmp`), `bun run docgen:local`, scoped coverage, commit, push,
hosted lanes.

## Stages — one commit each, one stage per launch

### Stage A — C3.3 follow-up: the laws plan switch and `beep:policy` retirement

1. **Hard switch, no sweeps key.** In `rootRepoLintPolicySteps` the four `scopedLawStep`s
   (`lint:terse-effect`, `lint:native-runtime`, `lint:frozen-grant-set`, `lint:effect-fn`) and the
   `lint:package-test-imports` `scopedRepoCliStep` are replaced by **one** Turbo invocation
   `turbo run lint:laws //#lint:native-runtime:roots` built with the same helper the
   `lint:jsdoc` invocation uses (`--continue=dependencies-successful --summarize`; `--affected`
   with the caller's scm base when `base` is defined, i.e. local; unfiltered when `base` is
   undefined, i.e. `--full`/hosted; labs filter not applied, D6). Rationale to record: the fleet
   cold run measured 86 s at concurrency 4 against 109 s for the five hosted steps and 0.4 s warm,
   so ruling 30's reason for keeping a legacy program does not apply; the table mandates the
   scoped steps retire when their last law migrates. `lint:effect-imports` stays a scoped step
   (A1) until Stage D moves it to `//#lint:effect-imports`; keep `scopedRepoCliStep` only for it
   and delete `scopedLawStep` if nothing else uses it. `LINT_POLICY_STEP_CONCURRENCY` stays until
   Stage D.
2. **`beep:policy` retires**: remove the key from the scripts-block schema
   (`PackageScripts.schemas.ts`), the two writers (`CreatePackage.command.ts`,
   `OperationPlanPackageJson.ts`), the two manifests (`freshbooks`, `box-provisioning`; inspect
   their `beep:audit` chains so nothing references the removed script), and the tests that pin it
   (`test/create-package.test.ts`, `test/architecture-operation-plan.test.ts`). Then
   `bun run beep lint package-scripts --write` (expect only those two manifests to change; report
   the diff) and `--check` green; `bun run beep lint policy-fingerprint --write` + `--check`.
3. **Tests**: `test/quality-tasks.test.ts` pins for `rootLintPolicyStepsForTesting` — the new
   invocation argv in both scopes; assert the five labels are gone and no other step changed
   (record the before/after label list in the results file). Update any docs that still name
   the five steps (`standards/turbo-remote-cache.md` if it lists policy tasks; the CLI help text).
4. **Verify**: full lane split above; run `bun run beep lint policy` locally once (affected scope)
   and paste the invocation line and exit code.

### Stage B — C3.4: the `doctest` package task

Constraint first: the hosted Doctest lane on a PR runs **main's** `heavy.yml` (the runner group
admits `heavy.yml@main` only), so during this PR the lane still calls
`ci lane doctest --mode <affected|full>`. `ci lane doctest` therefore keeps accepting `--mode`
(ignored; a one-line deprecation note in its help) and always runs the full-scope Turbo plan;
the `heavy.yml` edit lands in the same PR and takes effect after merge. Record this in the
results file and in a receipt.

1. `turbo.json` `doctest`: inputs verbatim from §2.1 row `doctest`, plus every doctest owner's
   vitest setup files (derive the list from the owners' `vitest.config.ts` `setupFiles`; e.g.
   `packages/tooling/tool/cli/test/global-cleanup.ts`), `env: ["BEEP_VITEST_DOCTEST"]`,
   `dependsOn: ["^transit"]`, `cache: true`, `outputs: []`. Owners are the manifests with a
   `doctest`/`beep:doctest` script (28 today; D7 presence-by-need, `passWithNoTests: false`).
2. `vitest.shared.ts`: export `vitestDoctestActive`; every inheriting package `vitest.config.ts`
   that sets `test.include` makes the override conditional (ordinary `include` only when the flag is
   off) — the §5 list of ten plus any other inheriting owner you find; do not touch configs that
   do not import the shared config (`apps/storybook` bypasses: assert the package-scripts doctest
   selector never derives a positive `doctest` for a bypassing config, R2). Add a test asserting
   non-empty in-source discovery for every owner under `BEEP_VITEST_DOCTEST=1` via vitest's config
   resolution (no full run), so `passWithNoTests: false` cannot red a task silently.
3. Retire: root `vitest.docs.ts`; root `doctest` script; in `Ci/CiLane.ts`
   `resolveAffectedDoctestFiles`, `expandDoctestDependents`, `isDoctestPackageInput`,
   `resolveDeletedDoctestManifestRevision`, `doctestStepForTesting`; `runCiDoctestLane` becomes
   `turbo run doctest --summarize` through the same remote-cache session and helpers the other
   Turbo lanes use, label `ci:doctest` unchanged. `.github/workflows/heavy.yml`: `doctest_mode`
   gate and `--mode` removed. `@effect/doctest` stays a root devDependency.
4. Tests per §6 rows 1–4 (`ci-lane.test.ts`, `doctest-lane.test.ts` + its fixture gains
   `beep:doctest`/`doctest` scripts and runs the package script with `BEEP_VITEST_DOCTEST=1`,
   `ci-runner-security.test.ts` asserts `doctest_mode` and the root `doctest` script are gone);
   `TurboConfigProof` gains `doctest`; a hash fixture in the `laws-turbo-inputs` idiom: docs-only
   edit stable; `src`, `test`, setup-file and shared-config edits change the hash; `^transit`
   dependency edit changes it.
5. Measure (R1): `turbo run doctest` cold over the fleet at concurrency 4 (wall, per-package boot
   p50/max) and warm (all `HIT`); the two slowest packages by name.

### Stage C — C3.5: root task registration

1. For every ★ row of §2.2 not yet registered (registered today: `//#lint:policy-fingerprint`,
   `//#lint:jsdoc:root`, `//#lint:native-runtime:roots`; root scripts that exist but have no task:
   `lint:oxlint`, `changeset:status`, `config-sync:check`, `topo-sort`, `knip`, `fallow:*`,
   `jsdoc:inventory`): add the root `package.json` script with the table's script text verbatim
   (`lint:oxlint` gains `--quiet --disable-nested-config`), and the `//#<script>` task with the
   table's inputs verbatim, `cache: false` for D2 rows, `env`/`passThroughEnv`/`outputs` as marked,
   `dependsOn: ["//#lint:policy-fingerprint"]` on every CLI-backed row (D15). Binary walkers
   (`lint:oxlint`, `lint:typos`, `knip:check`) stay `cache: false` unless you ship the D14 walk
   fixture and it passes; say which.
2. `Quality/internal/TurboConfigProof.ts` gains root-task proofs for every row.
3. Tests: `test/root-tasks-turbo-inputs.test.ts` in the dry-run idiom, data-driven over every
   registered root task from `turbo.json`: (a) a declared-input edit changes the hash and a
   non-input edit does not (§7.1.1); (b) one negative-closure probe per task where the table names
   a tool-read file outside the declared inputs — widen the inputs if it fails (§7.1.2); (c) the
   ruling-27 fixture: a declared-input edit selects the root task under `--affected`
   (`affectedUsingTaskInputs`), a non-input edit does not (§7.1.3).
4. `standards/turbo-remote-cache.md`: "Reading policy task hashes" section (root `taskId` is
   `//#<script>`; summaries per local and hosted run; freshness protocol §7.1.5) and the rule line
   "every hosted script lane except labs is a Turbo task".

### Stage D — C3.5: consumers

1. `rootRepoLintPolicySteps` becomes the D10 plan (§4 invocation table): local = (1) cheap gates
   `--affected --continue=dependencies-successful --summarize`, stop on a precise red; (2)
   `lint:jsdoc lint:laws //#lint:schema-first --affected …`; (3) the D2 group unfiltered; (4)
   `lint:deprecated-apis --affected --concurrency=<N> …`; hosted/`--full` = three runs (cheap;
   medium + D2; typed — where the typed run keeps ruling 30's shard program when
   `sweeps.deprecatedApis === "shards"`); then the CLI aggregates (`lint package-test-typecheck`,
   `quality test-tsgo`, the jsdoc ratchet compare after a fresh inventory). `LINT_POLICY_STEP_CONCURRENCY`,
   `scopedLawStep`, `scopedRepoCliStep` retire (effect-imports is now `//#lint:effect-imports`).
   A test proves no check is lost: the step label set before (26) equals the task set plus
   aggregates after (`test/quality-tasks.test.ts` pins at ~99, ~2544–2659).
2. Root `beep:preflight` = the `--write` generators (tsconfig-sync, fallow:boundaries:write,
   jsdoc:inventory, schema-first --write, package-scripts --write, policy-fingerprint --write)
   then `bun run beep lint policy` (the local plan).
3. `GithubChecks.ts`: `quality:knip`, `fallow:audit`, `fallow:dead-code` and the cheap-gate routes
   (config-sync, tsgo-rules, effect-imports, schema-first, allowlist, goals doctor, goals index,
   jsdoc, knip, Fallow) invoke the same `turbo run //#… --summarize` tasks; lane ids unchanged
   (ruling 28).
4. `CiLane.ts`: `knip`, `jsdoc-ratchet` (inventory task, then the CLI compare), `fallow` lanes
   call `turbo run //#… --summarize`, keeping the envelope checks and `--base` forwarding through
   `BEEP_PROOF_BASE`; `lint-policy` lane unchanged (`beep lint policy --full`).
5. `WaveOrder.ts` seed rows gain `taskIds` notes; `Planner.ts` keeps reading Fallow artifacts.
6. Tests per §6 rows 5–6 (`ci-lane.test.ts` argv pins; `quality-tasks.test.ts`).

### Stage E — C3.6: economics and the ledger report

1. **Ledger report with per-lane hashes**: extend the ledger surface (`Yeet/internal/ProofLedger.ts`,
   `ProofFact.ts`; the `yeet` status/closeout renderer that prints ledger facts) so each recorded
   lane row lists its Turbo task ids and `tasks[].hash` values ingested from that attempt's own
   summaries (§7.1.5 provenance: run id + start time, `execution.exitCode === 0` or valid cache
   evidence; skipped/missing/failed/uncacheable distinguished). Schema first (a per-lane task-hash
   row class), fixture-tested.
2. **Accounting before claims (§7.1.4)**: `research/c3-456-economics.md` with the pre-merge
   baseline per migrated lane — hosted p50/p95 from
   `bun run beep ci lane-timings --window --since 2026-09-04T00:00:00Z --until <now>` for Doctest,
   Knip, Fallow, JSDoc Ratchet, Lint Policy, Repo Sanity, Codegen Drift — and the local cold/warm
   numbers from Stages B–D. The "after merge" rows stay explicit TODOs with the exact command; never
   a whole-proof denominator.
3. Do **not** edit `PLAN.md`, `decisions.md`, or the lane task table: Fable writes the checkmarks,
   revision 8 and the rulings.

## Amendment 1 (2026-09-11, after Stage B) — Stage B2: marker-literal parity

Vitest selects an `includeSource` file by the literal `import.meta.vitest` anywhere in its text.
Five repo-cli sources contain the literal without a marked fence (`Docgen/Doctest.schemas.ts`
documentation example; `Docgen/internal/Doctest.ts` marker detection and fence generation;
`internal/package-scripts/PackageScriptsPolicy.ts` derivation grep;
`CreatePackage/internal/IdentityExportBlock.ts` and `SyncDataToTs/targets/VocabTerms.ts`
generated-file templates), so the strict fleet task reds repo-cli with "no test suite". Ruling:
keep vitest's selection as the selector and `passWithNoTests: false`; sources that must *name*
the marker compose it at runtime.

1. `internal/jsdoc/DoctestSource.ts` exports one named constant for the in-source test marker,
   composed at runtime (never the literal), and one helper that renders the fence info string
   for a named example (`ts <marker> name="<name>"`). JSDoc: **Details** stating why it is
   composed (vitest's `includeSource` grep), a **Gotchas** line ("a source that spells the marker
   verbatim becomes a test file"), an example whose printed output does not itself spell the
   literal.
2. The five files use the constant/helper; no `src/**` file in `@beep/repo-cli` spells the literal
   unless it carries a marked fence. `Doctest.schemas.ts`'s example refers to the helper.
3. Parity test (repo-cli, in-process, both runtimes): for every doctest owner in the live
   workspace, every `src/**/*.{ts,tsx}` file whose text contains the literal also contains at
   least one marked fence; and a synthetic fixture proves (a) a template file that composes the
   marker is **not** selected by vitest's `resolveConfig` + marker predicate, (b) a file with a
   marked fence is. Keep the Stage B discovery test; extend it rather than duplicating it.
4. Rerun the exact Stage B cold/warm pair (same commands, fresh `TURBO_CACHE_DIR`): require
   27/27 successful cold and 27/27 `HIT` warm; record wall, p50/max lifetime, and the two slowest
   packages. Report the schema thread-shutdown warning text verbatim (one line) and whether it
   changes the exit code.
5. Lane split unchanged (Bun-only checks; Fable runs package-verify, docgen:local, coverage).

## Amendment 2 (2026-09-11, after Stage B2) — Stage B3: doctests run on Node

Evidence (Fable, schema alone in `packages/foundation/modeling/schema`): the package script
`BEEP_VITEST_DOCTEST=1 bunx --bun vitest run` (Bun, thread pool) times out 9 trivial examples at
30 s; Bun's fork pool never completes vitest's startup handshake (Stage B); Node
(`BEEP_VITEST_DOCTEST=1 bunx vitest run`, no `--bun`) passes 120 files / 363 assertions in 8.0 s
wall, exit 0. The retired root lane ran on Node. Ruling 34: the doctest package script runs on
Node; the Bun `--bun` launcher stays for ordinary `beep:test`.

1. `PackageScripts.schemas.ts`: every kind's `beep:doctest` impl default becomes
   `BEEP_VITEST_DOCTEST=1 bunx vitest run`. `bun run beep lint package-scripts --write`
   regenerates the owner manifests (expect exactly the 27 owners plus the doctest-lane fixture if
   it is generated; list them); `--check` green; `lint policy-fingerprint --write` + `--check`.
2. `vitest.shared.ts`: remove the `pool: "threads"` doctest override and its comment; keep the
   rest of the doctest branch.
3. `test/doctest-lane.test.ts` and its fixture package follow the new script text; any test that
   pins `--bun` in a doctest script updates. The parity and discovery tests stay.
4. Rerun the exact Stage B cold/warm pair with a fresh `TURBO_CACHE_DIR`: require 27/27 successful
   cold and 27/27 `HIT` warm; record wall, lifetime p50/max, the two slowest packages, max RSS.
5. Do not write a changeset (Fable runs `yeet repair` at publish). Lane split unchanged.

## Amendment 3 (2026-09-11, after Stage C) — Stage C2: selectors, `.git/**`, and the affected fixture

Two live Turbo 2.10.12 facts, measured by Fable in a synthetic git fixture (script in the
implementation record):

- **F-A. Explicit `//#<task>` selectors bypass `--affected`.** `turbo run //#lint:a //#lint:b
  --affected` selects every named root task in every state; `turbo run lint:a lint:b --affected`
  (bare names) selects by declared inputs exactly as table §0.2 P3–P7 recorded (the live probe
  used bare names). Every affected invocation therefore names tasks bare; `//#` appears only in
  summaries, ledgers and `turbo.json` keys.
- **F-B. `**/*` inputs hash `.git/**`.** With a `.git` directory present, a `**/*` input glob
  hashes the object store (37 of 46 inputs in the probe); `!.git/**` removes them.

1. `turbo.json`: every root task whose inputs start with `**/*` (`//#lint:roadmap-refs`,
   `//#lint:typos`, any other) gains `!.git/**` and `!**/.git/**`. Table §2.2 is amended by the
   orchestrator (revision 8).
2. `Quality/Tasks.ts`: the Stage A laws invocation and the existing `lint:jsdoc` affected
   invocation name their root residuals bare (`lint:native-runtime:roots`, `lint:jsdoc:root`);
   the full/hosted invocations may stay as they are. Update the `quality-tasks.test.ts` pins.
3. `test/root-tasks-turbo-inputs.test.ts`: (a) the affected case names tasks bare, creates a
   `base` branch at the first commit and a README-only second commit, and asserts: clean →
   only tasks whose inputs cover README (none expected once README is not an input; otherwise
   exactly those); each row's declared-input edit selects exactly that row (plus any `**/*`
   row); a non-input edit selects nothing; (b) a new case proves F-A: the same edit with `//#`
   selectors selects every named task; (c) a new hash case initializes git in the fixture,
   writes one loose object, and asserts every root task hash is unchanged (F-B). Synthetic git
   repositories under the system temp directory are permitted for this lane; the checkout stays
   untouched. Run the whole suite (`bunx --bun vitest run test/root-tasks-turbo-inputs.test.ts
   --pool=threads`).
4. Record F-A and F-B as an amendment section in `research/c3-turbo-facts.md`.
5. Lane split unchanged; Fable reruns package-verify and the Node suite.
