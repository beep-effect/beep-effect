# C3 lane-to-task table — design gate

Status: REVISION 2, 2026-09-08, after one adversarial Codex review
(`research/c3-lane-task-table.review.md`, disposition appended there). Awaiting Benjamin. No
implementation starts before this table is ratified. Owner: Fable orchestrator. Rulings in
force: 5, 6, 10, 19–25 (`research/decisions.md`). Evidence: `research/c3-turbo-facts.md` (Grok,
15 Turbo 2.10 facts against the docs, plus the live-probe amendment), `research/c3-sublane-inputs.md`
(Codex, per-lane input census with Q1/Q2), and the live probes in §0.2 (turbo 2.10.12,
`futureFlags` on).

Revision 2 changes, from the review: git/tree/time-state lanes are non-reusable (D2); a
policy-tool fingerprint replaces per-task guesses at the CLI's runtime closure (D15); presence
kinds follow the fleet census, coverage keeps its package-owned text (D3, D4, D13); one
fleet-wide manifest touch with thin workers in PR 1 (D16); ordered invocations keep cheap precise
gates first (D10); `knip:check` avoids the recursion (D9); inputs, consumers, test list, fixtures
and accounting corrected (§2–§7); the out-of-scope list is reproduced in §8.

Reading order: §0 findings, §1 decisions, §2 table, §3 schema, §4 `turbo.json`, §5 doctest
branch, §6 tests, §7 acceptance and train, §8 scope and questions.

## 0. Findings

### 0.1 Ranking (ratified, no change)

Hosted minutes per lane from `research/economics.md`: Lint Policy 9.73% (p50 363 s), Doctest
2.65% (p50 82 s, affected file list on PRs), Knip 2.49% (p50 80 s). Inside the policy lane
(`goals/lint-policy-single-digit/research/00-evidence-brief.md`, run 31683014887, before the
4-way shards): deprecated-apis 975 s, semantic-delta 78 s, schema-first 51 s, terse-effect
33 s, jsdoc 29 s, native-runtime 27 s, identity-registry 22 s, frozen-grant-set 19 s, circular
18 s, effect-fn 16 s, package-test-imports 14 s, effect-imports 12 s, package-test-typecheck
6 s, tsgo-rules 5 s, oxlint 4.5 s, allowlist 4 s, ecosystem-polarity 4 s, goals:doctor 4 s,
jsdoc-module-tags 4 s, reflection-artifacts 4 s, goals:index-check 4 s, roadmap-refs 4 s,
judge-rubric 3 s, typos 1 s. `knowledge:refs-check` and `lint:effect-imports-markdown` joined
the lane after the brief and are unmeasured. Local inner-lane p50 is unmeasured for every
sublane (A5 gap: pre-push inner states carry no `durationMs`); the "local p50" column is blank
by evidence. The PR train (§7) follows the hosted ranking: deprecated-apis, doctest, then the
root tasks. Ranking is migration order, not runtime order (D10).

### 0.2 Live probes (turbo 2.10.12, flags on)

Method: a transient `//#c3-probe` task (`inputs: ["packages/tooling/tool/cli/src/commands/Lint/**"]`)
and `//#c3-probe-docs` (`inputs: ["research/**"]`) added on a temporary commit in this
worktree, `turbo run … --dry-run=json`, working-tree edits, then `git reset --hard 964fa2bb61`.
The reviewer could not repeat P4/P6/P8 under a no-edit constraint; they become executable
fixtures in C3.5 (§7.1) before ratification of the root-task selection claim.

| # | Probe | Result |
| --- | --- | --- |
| P1 | `//#name` task with a root script; `turbo run name` | Runs the root task; `tasks[].taskId` is `//#name`, `tasks[].hash` present, `tasks[].inputs` maps each matched file to its git blob hash. Root task inputs may glob into workspace directories. |
| P2 | docs-only edit (`README.md`) vs declared-input edit | Hash stable on the docs edit; hash changes on the input edit. |
| P3 | `--affected`, no diff | Nothing selected, root tasks included. |
| P4 | `--affected`, edit `research/README.md` | Exactly `//#c3-probe-docs` selected. Root tasks are selected by **their own declared inputs**, not by "root-owned files". |
| P5 | `--affected`, edit `packages/drivers/freshbooks/README.md` | `@beep/freshbooks#check` plus dependents; no root task. |
| P6 | `--affected`, edit `Lint.command.ts` (inside `@beep/repo-cli`, matches `//#c3-probe` inputs) | `//#c3-probe` plus `@beep/repo-cli#check` and dependents. |
| P7 | `--affected`, edit `AGENTS.md` (undeclared root file) | Nothing selected. |
| P8 | `--affected --filter=//` | Intersection, not union: empty on a package-only change. |
| P9 | `turbo run c3-probe check --filter=@beep/schema` | Root task not selected by a package filter. |
| P10 | `envMode` | `strict` by default. Inline `VAR=1 cmd` in the script text is visible to the child; a caller variable is visible only when declared in `env` or `passThroughEnv`; an undeclared caller variable is stripped. |
| P11 | Hash vs env | Declared `env` value changes the hash; `passThroughEnv` and undeclared variables do not. Script text is hashed through `package.json`. |
| P12 | `cache: true`, no `outputs` | Second run: `cache hit, replaying logs`. |
| P13 | `--summarize` | Writes `.turbo/runs/<id>.json`; per task `hash`, `cache.status` (`MISS`/`HIT`), `execution.exitCode`; root `taskId` is `//#name`. |
| P14 | `--continue` | Default `never`; values `never`, `dependencies-successful`, `always`. |
| P15 | Root task `dependsOn: ["@beep/schema#check"]` | Accepted; the package task is scheduled first. |

Consequences:

- **F1 (amends ruling 19's mechanism, keeps its outcome).** With `affectedUsingTaskInputs`,
  root tasks with file inputs participate in local `--affected` through their declared inputs
  (P3–P7). "Root tasks always run unfiltered" stays true for the hosted full-scope run (ruling
  20) and for the non-file-dependent tasks of D2, which need their own unfiltered invocation.
  An executable root-task selection fixture (P4/P6) is an acceptance item of C3.5, not a
  claim this table makes on its own authority.
- **F2.** No union trick: `--filter=//` intersects with `--affected` (P8; Grok fact 14).
- **F3 (risk class, corrected).** An undeclared input causes a wrong local skip (selection)
  and a wrong reuse (hash). Hosted full scope protects selection only: a hosted run reads the
  same remote cache and serves the same false hit. Hash honesty therefore rests on input-closure
  fixtures per lane (edit a file the tool reads that the inputs omit; the hash must change),
  the Yeet `TURBO_FORCE` rule on lockfile diffs, and ruling 6's tripwire. §7.1 makes these
  fixtures mandatory before any reuse claim.
- **F4.** Lockfile and root-config changes still select every task (Grok fact 3).
  `global.inputs` are prepended to each task's inputs and a task may negate them (the `lint`
  task already negates root tsconfigs), so they are per-task inputs, not an unconditional
  global mechanism. Editing `turbo.json` in a PR runs everything once; expected.
- **F5.** `filterUsingTasks` does not mean "skip packages lacking the script"; that is default
  Turbo behaviour for a registered task. An unregistered task name errors even with `--filter`
  (Grok fact 6). Ruling 23's placeholder removal stands on the default behaviour.

### 0.3 Census facts that shape the shapes (`c3-sublane-inputs.md`)

- Type-aware: `lint:deprecated-apis` (`projectService`, `@typescript-eslint/no-deprecated`),
  `lint:schema-first` (`getType()` through ts-morph; it loads compiler options and explicit
  globs, no root preload). Not type-aware: docs eslint profile, every `beep laws` law (syntax
  ts-morph; effect-fn and frozen-grant-set preload the root tsconfig corpus today),
  package-test-imports (scans every `packages/**/package.json` for owners), circular (madge
  import graph), oxlint, typos.
- Non-file state readers: `knowledge:semantic-delta` (merge-base, ref census, archives,
  `GITHUB_EVENT_PATH`), `knowledge:refs-check` (archived HEAD tree), `goals:doctor` (`git log
  --since`, wall clock), `lint:jsdoc-module-tags` and jsdoc-inventory (`git ls-files` tracked
  set), fallow `audit|dead-code|health` hosted envelopes (`--base` resolution plus dirty census),
  `changeset-status` (`git diff since`), `repo-sanity` (git plus network), `version-sync`
  (network), the hosted doctest lane (`git diff` affected files; retired by C3.4), knip
  (gitignore semantics including `.git/info/exclude`).
- Whole-tree scanners: knip, typos and oxlint (binary walks from cwd; ignore semantics
  unknown), identity-registry (every workspace `src/**` plus manifests), schema-first,
  refs-check and semantic-delta (tracked docs corpus), tsgo-rules (walks tsconfigs and TS
  sources for directives), roadmap-refs (link-target existence anywhere).
- `lint:package-test-typecheck` is a blind-spot inventory over manifests and test tsconfigs;
  `beep quality test-tsgo` is the Turbo aggregate. Both stay CLI steps.
- Doctest corpus: 365 `import.meta.vitest` sources owned by **27 of 142** workspaces.
- Fleet presence today (142 workspaces: 125 library, 6 app, 5 lab, 2 tool, 1 ecosystem,
  1 infra, 2 exempt): `docgen` 124/125 library, 3/6 app, 0/5 lab, 2/2 tool, 1/1 ecosystem,
  1/1 infra; `coverage` 125/125 library, 5/6 app, 0/5 lab, 1/1 infra; `test:property`
  91/125 library, 3/6 app, 2/2 tool; `test:integration` 87/125 library, 2/6 app, 1/1
  ecosystem; `test:integration:parallel` 22 library, 1 app, 1 ecosystem; `codegen` 22 library,
  4 app, 5 lab, 2 tool, 1 infra; `lint:fix` absent in the ecosystem manifest.

## 1. Decisions (veto by editing the entry; silence ratifies)

- **D1 Shape assignment.** Package task when the tool's file reads partition by package
  directory once the worker is package-local (eslint both profiles, the syntax laws after D5,
  package-test-imports with its owner-manifest input, doctest). Root task otherwise (§2.2).
  Ecosystem-polarity is a root task (4 s, ecosystem members only). Package data inputs alone
  never make a hash honest; every CLI-backed task also carries the policy-tool fingerprint
  (D15).
- **D2 Non-file-state lanes are non-reusable.** Lanes whose result depends on git history,
  refs, the archived HEAD tree, the tracked set, the index, wall clock, network, or workflow
  event data become root tasks with `cache: false`, always run in an unfiltered invocation
  (D10), and are recorded by the ledger with input source `undeclared` (ruling 5's honest
  report). They gain a Turbo task hash for provenance, not for reuse. Rejected for now: a
  merge-base or HEAD-tree env carrier (`BEEP_PROOF_BASE_SHA`); the reviewer showed it encodes
  neither the ref census, the index, nor dirty-state provenance. A later item may fund a
  complete state model (Q3). Members: semantic-delta, refs-check, goals:doctor,
  jsdoc-module-tags, jsdoc-inventory, fallow audit/dead-code, changeset-status, knip (D9),
  repo-sanity members that read git or the network.
- **D3 Two-tier scripts block with four presence kinds.** Task-facing keys are the strict
  tier: for each (kind, key) the rule is `required`, `optional` (value strict when present),
  `absent`, or `derived` (D7, D11); values are `indirection` (`bun run beep:X`, or `bun run
  --if-present beep:audit`), `cli` (exact `beep-cli …` text), or `owned` (package text kept
  as is). Implementation keys (`beep:*`) are the free tier: required only behind an
  unconditional indirection, value free, generator default stamped when missing, never
  overwritten by `--write`. Unknown keys are `extras`, never touched. The tiers are disjoint by
  construction and the gate validates that. No semantic claim is made about free-tier values
  (a `beep:audit` chain is package truth, not policy).
- **D4 Indirection direction: docgen converges, coverage does not.** `docgen` converges on
  `bun run beep:docgen` + `beep:docgen: bunx --bun --no-install docgen` (129 manifests move,
  2 fix their relative-path `beep:docgen`, the docgen tool keeps `bun run src/bin.ts` as its
  `beep:docgen`), per ruling 24. `coverage` keeps its package-owned text (`owned`, required
  where present today) because converging it is outside ruling 24 and the reviewer's scope
  reading; Q1 asks whether to add it. Cost model corrected: any manifest rewrite invalidates
  every task that hashes `package.json`, which is every task, so the fleet is touched once
  (D16) and the cold run is measured before any hit-ratio claim (§7.1.3).
- **D5 `lint:laws` composition and the package-local scanner.** One CLI subcommand
  `beep-cli lint laws --package .`: terse-effect (`--check --advisory`, never fails),
  native-runtime, frozen-grant-set, effect-fn, package-test-imports. One process, one hash.
  The worker resolves the repo root separately from the package cwd, builds syntax ts-morph
  projects from the package file surface (`**/*.{ts,tsx}` under the package, root compiler
  options by value, no root preload, `referencePolicy: "workspaceOnly"`), keeps each law's
  diagnostic exclusions, and reads every `packages/**/package.json` for package-test-imports
  ownership (declared input). Native-runtime's extra roots (`scratchpad`, `effect-ontology`)
  keep a root residual task `//#lint:native-runtime:roots`. **A1 (amends ruling 21):**
  effect-imports code mode stays out of `lint:laws` while its promoted-family list is empty
  (it returns early today; its honest inputs are every foundation `src/**`); it is a root task
  and joins `lint:laws` when the per-module-imports flip gives it work (Q6).
- **D6 `lint:deprecated-apis` package mode and concurrency.** `beep-cli lint deprecated-apis
  --package .` runs eslint over the package directory with `--config <repoRoot>/eslint.config.mjs`,
  the profile env, and a per-package heap cap (`NODE_OPTIONS` declared in `env`). The 4-way
  shard runner and the per-shard eslint cache retire once the package task lands (orchestrator
  default). The typed profile runs in its own bounded invocation (D10). Coverage equals today's
  shards: labs are a shard today and stay covered; the docs profile's root-owned JS/MJS/CJS
  files (root `eslint .`) keep a root residual `//#lint:jsdoc:root` so no file loses coverage.
  Config-base and source-routing parity with the root invocation is a C3.2 fixture.
- **D7 Doctest presence by need.** `doctest` is present iff the package owns at least one
  `import.meta.vitest` source under the same selector the worker uses (`src/**/*.{ts,tsx}`,
  excluding `.d.ts`, fixtures, `node_modules`, `.context`) and its resolved vitest config
  inherits the shared branch (§5). A positive derivation with a bypassing config
  (`apps/storybook`) is a gate error, not a stamp. 27 boots instead of 142. The task runs with
  `passWithNoTests: false` so lost discovery fails instead of passing. Unowned marked sources
  are reported.
- **D8 Doctest task shape.** `doctest: bun run beep:doctest`, `beep:doctest:
  BEEP_VITEST_DOCTEST=1 bunx --bun vitest run`; `vitest.shared.ts` branches on the flag (§5);
  `dependsOn: ["^transit"]` covers declared dependencies only; the global alias map can
  resolve an undeclared `@beep/*` import, which knip's required-context gate makes unlikely
  and the closure fixture makes visible; `env: ["BEEP_VITEST_DOCTEST"]`; `cache: true`, no
  outputs; inputs include package setup files and the shared config's runtime imports. Hosted
  Doctest runs `turbo run doctest --summarize` full scope; the affected-file resolver,
  `vitest.docs.ts`, and `doctest_mode` in `heavy.yml` retire.
- **D9 Root script names.** Root tasks need root scripts. `knip` keeps `knip-bun` (the ratchet
  calls `bun run knip`; renaming it recurses) and gains `knip:check: bun run beep quality
  knip` with task `//#knip:check`. New root scripts (21): `lint:circular`,
  `lint:identity-registry`, `knowledge:semantic-delta`, `knowledge:refs-check`,
  `lint:tsgo-rules`, `lint:effect-imports`, `lint:effect-imports-markdown`,
  `lint:schema-first`, `lint:allowlist`, `lint:ecosystem-polarity`, `lint:jsdoc-module-tags`,
  `lint:jsdoc:root`, `lint:native-runtime:roots`, `lint:typos`, `lint:package-scripts`,
  `goals:doctor`, `goals:index-check`, `lint:reflection-artifacts`, `lint:roadmap-refs`,
  `lint:judge-rubric`, `jsdoc:inventory:check`, `fallow:audit:check`, `fallow:dead-code:check`,
  `knip:check`. Existing root scripts keep their text where the meaning is unchanged
  (`lint:oxlint`, `changeset:status`, `config-sync:check`, `topo-sort`).
- **D10 Ordered invocations, one shared plan.** `beep lint policy` and the hosted Lint Policy
  lane run one plan definition in three invocations, in this order: (1) cheap precise gates
  (every root task under about 10 s plus `//#lint:package-scripts`), local fail-fast per SPEC
  B3; (2) medium tasks (`lint:jsdoc`, `lint:laws`, `//#lint:schema-first`, the D2 unfiltered
  group); (3) the typed profile `lint:deprecated-apis` at bounded concurrency
  (`BEEP_QUALITY_CHECK_CONCURRENCY`, default 4). Local: file-input tasks take `--affected`;
  the D2 group runs unfiltered in its own invocation. Hosted and `--full`: no `--affected`.
  Every invocation uses `--continue=dependencies-successful --summarize`; the wrapper keeps a
  nonzero exit across invocations and, hosted, runs all three for the full diagnostic picture.
  `beep:preflight` runs the `--write` generators first, then the plan. Aggregates (D12) run
  last.
- **D11 Codegen split.** `turbo.json` `codegen` keeps `cache: false` and `dependsOn:
  ["^codegen"]`; root `codegen` becomes `bunx turbo run codegen` (no root task wraps it);
  `beep codegen` becomes a group with `barrel` (today's default, `--package`); root
  `codegen:barrel` = `bun run beep codegen barrel`. The 25 `echo 'no codegen needed'`
  placeholders and the one "will be implemented" placeholder leave; the 8 real generators keep
  their text; `@beep/identity` moves to `beep-cli codegen barrel`; every old barrel caller is
  migrated in the same PR. The Codegen Drift CI lane (`generate:check` over driver packages)
  and its workflow path gate are unchanged.
- **D12 Aggregates stay CLI steps after the Turbo runs.** `lint package-test-typecheck`
  (blind-spot inventory over manifests and test tsconfigs), the jsdoc ratchet compare (consumes
  only a fresh, successful inventory), and `beep quality test-tsgo` (the existing Turbo
  aggregate with its freshness checks) run after the invocations.
- **D13 Kinds and the exempt domain.** Kinds: library, tool, ecosystem, app, lab, infra,
  exempt. The gate's domain is the root `workspaces` members only (142); nested non-workspace
  manifests (`infra/lambda/*`, `infra/ci-runners/*`) are out of domain. `ecosystem` uses the
  library rules with its census differences recorded as `optional` (`lint:fix` absent today);
  no stricter-audit claim.
- **D14 Cache flags.** Deterministic checks with closed file and env inputs: `cache: true`,
  no outputs. D2 lanes: `cache: false`, unfiltered, non-reusable. Binary walkers (oxlint,
  typos): `cache: true` only after their walk fixture passes (§7.1); until then
  `cache: false`. Generators that write tracked files: plain scripts or `cache: false`.
- **D15 Policy-tool fingerprint (new).** The checker implementations are inputs of every
  policy task. Instead of guessing each task's import closure, one generated file
  `standards/policy-tools.fingerprint.json` (content hash over `packages/tooling/tool/cli/src/**`,
  `packages/tooling/library/repo-utils/src/**`, `packages/tooling/policy-pack/*/src/**`, and the
  root tool configs the checkers read) is declared as a `$TURBO_ROOT$` input of every
  package policy task and a plain input of every root policy task. A cheap root gate
  `//#lint:policy-fingerprint` (inputs: those trees plus the file) fails when it is stale;
  `beep:preflight` regenerates it. A checker edit therefore reruns policy tasks exactly once,
  and build/check/test caches stay untouched. Foundation packages the CLI imports are not in
  the fingerprint by default (Q7); node_modules dependencies are already in
  `hashOfExternalDependencies`. This matches ruling 4's epoch salt ("policy-pack version") with
  a computed version instead of a hand bump.
- **D16 One fleet-wide manifest touch.** Because every manifest rewrite busts every task's
  cache, the fleet is rewritten once, in PR 1, with all four new keys. PR 1 therefore also
  ships thin, runnable workers: `lint deprecated-apis --package` and `lint jsdoc --package`
  (eslint over the package dir with the shared config), `lint laws --package` (the existing
  law runners scoped with `--include-prefix`, correct but not yet package-local), and the
  `vitest.shared.ts` mode branch. Task registration, hash claims, lane rewiring, and the
  package-local law scanner land in C3.2–C3.5 without touching manifests. Rejected: staged
  rule versions with one manifest touch per PR (three extra cold fleets). The gate ships a
  rule version so a manifest stamped by rule v1 is not judged by v2.

## 2. Lane-to-task table

Legend. Consumers: **P** `rootRepoLintPolicySteps` (`Quality/Tasks.ts:2423`), **F**
`beep:preflight` (root `package.json`), **C** hosted lane builder (`Ci/CiLane.ts`), **G** cheap
gates and repo-quality routes in `Quality/internal/GithubChecks.ts` (`:300`, `:485`, `:491`,
`:521–581`), **W** wave seed (`Yeet/internal/WaveOrder.ts`), **L** lefthook (stays direct),
**Y** Yeet planner reads its artifacts (`Yeet/internal/Planner.ts:348–361`). Shape: **pkg** =
package task, **root** = `//#` task, **cli** = stays a CLI step. `WT` = whole-tree file inputs
(a label; selected by any matching change; reuse by hash only). Every task row implicitly adds
`$TURBO_ROOT$/standards/policy-tools.fingerprint.json` (D15). Lane ids consumed by
`Yeet/internal/IssueClassification.ts` and WaveOrder keep their names; task ids are recorded
beside them, not in place of them.

### 2.1 Package tasks (four scripts, ruling 21)

| Today's step | Task | Script (package) | `inputs` | `env` | `dependsOn` | cache | Consumers | Hosted p50 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lint:deprecated-apis` (`beep-cli lint deprecated-apis`, 29 shards ×4) | `lint:deprecated-apis` | `beep-cli lint deprecated-apis --package .` | `**/*.{ts,tsx,js,jsx,mjs,cjs}`, `package.json`, `tsconfig*.json`, `$TURBO_ROOT$/eslint.config.mjs`, `$TURBO_ROOT$/tsconfig*.json`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/package.json`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/**`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/**`, `$TURBO_ROOT$/packages/**/tsconfig*.json`, `$TURBO_ROOT$/apps/**/tsconfig*.json`, `$TURBO_ROOT$/infra/**/tsconfig*.json`, `$TURBO_ROOT$/packages/**/package.json`, `$TURBO_ROOT$/apps/**/package.json`, `$TURBO_ROOT$/infra/package.json`, `!node_modules/**`, `!.beep/**` | `NODE_OPTIONS` (`BEEP_ESLINT_PROFILE` is global) | `^transit` (dependency sources; declarations come through projectService, not builds) | `true` | P, F, C(lint-policy), W | 975 s pre-shard, 435 s sharded | Eslint cache retires. Own invocation (D10). Labs included as today. |
| `lint:jsdoc` (`bunx eslint . --max-warnings=0`) | `lint:jsdoc` | `beep-cli lint jsdoc --package .` | `**/*.{ts,tsx,js,jsx,mjs,cjs}`, `package.json`, `$TURBO_ROOT$/eslint.config.mjs`, `$TURBO_ROOT$/tsdoc.json`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/package.json`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/**`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/**`, `!node_modules/**` | none | none (syntax) | `true` | P, F, C, W | 29 s | Root-owned files keep `//#lint:jsdoc:root` (D6). |
| `lint:terse-effect`, `lint:native-runtime`, `lint:frozen-grant-set`, `lint:effect-fn`, `lint:package-test-imports` (five `scopedLawStep`/`scopedRepoCliStep`; effect-imports per A1) | `lint:laws` | `beep-cli lint laws --package .` | `**/*.{ts,tsx}`, `package.json`, `tsconfig*.json`, `$TURBO_ROOT$/tsconfig*.json`, `$TURBO_ROOT$/packages/**/package.json`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts`, `$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts`, `$TURBO_ROOT$/standards/effect-laws.allowlist.jsonc`, `!node_modules/**` | none | none (syntax) | `true` | P, F, C, W | 33+27+19+16+14 = 109 s | Task registered only after the package-local scanner (D5, C3.3). |
| `ci:doctest` (`bunx vitest run --config vitest.docs.ts <files>`) | `doctest` | `bun run beep:doctest` → `BEEP_VITEST_DOCTEST=1 bunx --bun vitest run` | `src/**`, `test/**`, `package.json`, `tsconfig*.json`, `vitest*.config.ts`, `$TURBO_ROOT$/vitest.shared.ts`, `$TURBO_ROOT$/vitest.setup.ts`, `$TURBO_ROOT$/vitest.aliases.generated.json`, `$TURBO_ROOT$/packages/foundation/modeling/utils/src/**` (shared config import), `!node_modules/**` | `BEEP_VITEST_DOCTEST` | `^transit` | `true` | C(doctest), `heavy.yml` `doctest_mode` | 82 s (affected list) | 27 manifests (D7); `passWithNoTests: false`. |

### 2.2 Root tasks (ruling 19, second shape)

All rows: shape **root**; `cache: true` with no outputs unless marked; `dependsOn` none; `env`
none unless marked. Inputs are root-relative (P1). "D2" marks the non-reusable group: `cache:
false`, unfiltered, ledger `undeclared`.

| Today's step (label) | Root script (★ new) | Script text | `inputs` | Flags | Consumers | Hosted p50 |
| --- | --- | --- | --- | --- | --- | --- |
| — (gate) | ★ `lint:policy-fingerprint` | `bun run beep lint policy-fingerprint --check` | `packages/tooling/tool/cli/src/**`, `packages/tooling/library/repo-utils/src/**`, `packages/tooling/policy-pack/*/src/**`, `standards/policy-tools.fingerprint.json` | D15 | P, F, G | new |
| — (gate) | ★ `lint:package-scripts` | `bun run beep lint package-scripts --check` | `package.json`, `**/package.json`, `packages/**/src/**/*.{ts,tsx}`, `apps/**/src/**/*.{ts,tsx}`, `**/vitest*.config.ts`, `!**/node_modules/**`, `!**/test/fixtures/**` | derivation evidence uses root workspace membership and the doctest selector (D7) | P, F, G | new |
| `knowledge:semantic-delta` | ★ `knowledge:semantic-delta` | `bun run beep knowledge semantic-delta` | `AGENTS.md`, `CLAUDE.md`, `goals/**`, `explorations/**`, `docs/**`, `.claude/**`, `.agents/**`, `.codex/**`, `standards/**`, `.github/**`, `**/package.json`, `!docs/generated/**`, `!docs/_internal/**` (explanatory; not a reuse claim) | D2; `passThroughEnv: ["GITHUB_EVENT_PATH"]` | P, F, W(`quality:lint-policy`) | 78 s |
| `knowledge:refs-check` | ★ `knowledge:refs-check` | `bun run beep knowledge refs --check` | same corpus | D2 | P, F | unmeasured |
| `lint:schema-first` | ★ `lint:schema-first` | `bun run beep lint schema-first` | `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/{src,test}/**/*.ts`, `**/package.json`, `**/tsconfig*.json`, `standards/schema-first.inventory.jsonc`, `standards/schema-crispening.policy.jsonc`, `!**/docs/**`, `!**/node_modules/**` | `WT`; typed through explicit globs (no build edge) | P, F, G(`cheap-gates:schema-first`) | 51 s |
| `lint:identity-registry` | ★ `lint:identity-registry` | `bun run beep lint identity-registry` | `{packages,apps,infra,tools,scratchpad}/**/*.{ts,tsx}`, `**/package.json`, `packages/foundation/modeling/identity/src/packages.ts`, `!**/node_modules/**`, `!**/dist/**` | `WT` | P, F | 22 s |
| `lint:circular` | ★ `lint:circular` | `bun run beep lint circular` | `packages/tooling/**/src/**/*.ts`, `packages/foundation/**/src/**/*.{ts,tsx}` (import closure of the two roots), `tsconfig.json`, `tsconfig.base.json` | | P, F | 18 s |
| `lint:effect-imports` (code mode; A1) | ★ `lint:effect-imports` | `bun run beep laws effect-imports --check` | `{apps,packages,infra}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`, `packages/foundation/**/package.json`, `packages/foundation/**/src/**`, `!**/node_modules/**`, `!packages/**/docs/**` | `WT`; deliberate over-inclusion while it returns early | P, F, G | 12 s |
| `lint:effect-imports-markdown` | ★ `lint:effect-imports-markdown` | `bun run beep laws effect-imports --mode markdown --check` | `.patterns/**/*.{md,mdx}`, `standards/**/*.{md,mdx}`, `.claude/skills/**/*.{md,mdx}`, `docs/**/*.{md,mdx}`, `goals/*/[A-Z]*.md`, `packages/foundation/**/package.json`, `packages/foundation/**/src/**` | | P, F | unmeasured |
| `lint:tsgo-rules` | ★ `lint:tsgo-rules` | `bun run beep quality tsgo-rules` | `{apps,packages,tooling,infra}/**/*.{cts,mts,ts,tsx}`, `{apps,packages,infra,scratchpad}/**/tsconfig*.json`, `tsconfig.base.json`, `tsconfig.json`, `vitest.aliases.generated.json`, `!**/node_modules/**`, `!**/dist/**` | `WT` (directive walk) | P, F, G(`cheap-gates:tsgo-rules`) | 5 s |
| `lint:oxlint` | `lint:oxlint` (text gains `--quiet --disable-nested-config`) | `oxlint --quiet --disable-nested-config` | `.oxlintrc.json`, `.gitignore`, `**/.gitignore`, `*.{js,mjs,cjs,ts,tsx,jsx}`, `scripts/**`, `apps/**/*.{ts,tsx,js,jsx,mjs,cjs}`, `packages/**/*.{ts,tsx,js,jsx,mjs,cjs}`, `infra/**/*.{ts,js,mjs}`, `packages/tooling/policy-pack/lint-rules/src/**`, `!**/node_modules/**`, `!**/dist/**` | `cache: false` until the walk fixture passes (D14) | P, F | 4.5 s |
| `lint:ecosystem-polarity` | ★ `lint:ecosystem-polarity` | `bun run beep lint ecosystem-polarity` | `packages/ecosystem/*/package.json`, `packages/ecosystem/*/src/**/*.{ts,tsx,mts,cts}` | | P, F | 4 s |
| `lint:allowlist` | ★ `lint:allowlist` | `bun run beep laws allowlist-check` | `standards/effect-laws.allowlist.jsonc`, `packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts`, `{packages,apps,infra}/**/*.{ts,tsx}` (entries may name any target root), `!**/node_modules/**` | `WT` | P, F, G(`cheap-gates:allowlist-check`) | 4 s |
| `lint:jsdoc-module-tags` | ★ `lint:jsdoc-module-tags` | `bun run beep quality jsdoc-module-tags` | `{.patterns,apps,packages,tooling}/**/*.{hbs,md,ts,tsx}`, `!apps/labs/**` (explanatory) | D2 (`git ls-files`) | P, F | 4 s |
| `lint:jsdoc:root` (new residual, D6) | ★ `lint:jsdoc:root` | `bun run beep lint jsdoc --root-only` | `*.{ts,tsx,js,jsx,mjs,cjs}`, `scripts/**`, `eslint.config.mjs`, `tsdoc.json`, policy-pack eslint sources | | P, F | new |
| `lint:native-runtime:roots` (new residual, D5) | ★ `lint:native-runtime:roots` | `bun run beep laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology` | those roots' `**/*.{ts,tsx}`, allowlist sources | | P, F | new |
| `goals:doctor` | ★ `goals:doctor` | `bun run beep goals doctor` | `goals/**`, `explorations/**`, `goals/goals-doctor.baseline.jsonc` (explanatory) | D2 (git log, wall clock) | P, F, G(`cheap-gates:goals-doctor`) | 4 s |
| `goals:index-check` | ★ `goals:index-check` | `bun run beep goals index --check` | `goals/*/ops/manifest.json`, `goals/*/README.md`, `goals/*/GOAL.md`, `goals/INDEX.md` | | P, F, G(`cheap-gates:goals-index`) | 4 s |
| `lint:reflection-artifacts` | ★ `lint:reflection-artifacts` | `bun run beep lint reflection-artifacts` | `goals/*/history/reflections/**`, `goals/*/ops/manifest.json` | | P, F | 4 s |
| `lint:roadmap-refs` | ★ `lint:roadmap-refs` | `bun run beep lint roadmap-refs` | `**/*`, `!**/node_modules/**`, `!.beep/**`, `!**/dist/**`, `!**/.turbo/**`, `!**/coverage/**` (existence check may target anything) | `WT` | P, F | 4 s |
| `lint:judge-rubric` | ★ `lint:judge-rubric` | `bun run beep lint judge-rubric` | `.claude/skills/browser-qa-loop/resources/judge-prompt.md` | (Qa lens code is in the fingerprint) | P, F | 3 s |
| `lint:typos` | ★ `lint:typos` | `typos` | `_typos.toml`, `.gitignore`, `**/.gitignore`, `**/*` minus the exact `files.extend-exclude` list transcribed from `_typos.toml` at implementation time; typos version pinned by the lockfile | `cache: false` until the walk fixture passes (D14) | P, F, L(stays direct with its own excludes) | 1 s |
| `ci:knip` (`beep quality knip`) | ★ `knip:check` (`knip` stays `knip-bun`) | `bun run beep quality knip` | `knip.jsonc`, `**/package.json`, `bun.lock`, `**/tsconfig*.json`, `.gitignore`, `**/.gitignore`, `apps/**`, `packages/**`, `infra/**`, `scripts/**`, root tool configs, `standards/knip.regression-baseline.jsonc`, `!**/node_modules/**`, `!**/dist/**`, `!**/.turbo/**` (explanatory) | D2 (gitignore semantics incl. `.git/info/exclude`) | F, C(knip), G(`:300`, `cheap-gates:knip`), W(`quality:knip`) | 80 s |
| `ci:fallow:audit` | ★ `fallow:audit:check` | `bun run beep quality fallow audit --check --base "$BEEP_PROOF_BASE" --out .beep/fallow/audit.check.json --quiet` | `.fallowrc.jsonc`, `**/package.json`, `**/tsconfig*.json`, `apps/**`, `packages/**`, `infra/**`, `scripts/**`, `.claude/skills/**`, `.fallow/plugins/**`, `standards/fallow.pilot.inventory.jsonc` (explanatory) | D2; `env: ["BEEP_PROOF_BASE"]` (the worker's `--base` argument, forwarded by the wrapper as today); `outputs: [".beep/fallow/audit.check.json", ".beep/fallow/raw/audit.check.*"]` | C(fallow), G(`:485`), W(`fallow:audit`), Y | most frequent actionable red (47) |
| `ci:fallow:dead-code` | ★ `fallow:dead-code:check` | `… fallow dead-code --check --base "$BEEP_PROOF_BASE" --out .beep/fallow/dead-code.check.json --quiet` | as audit (no baseline file: hosted does not pass it) | D2; `outputs: [".beep/fallow/dead-code.check.json", ".beep/fallow/raw/dead-code.check.*"]` | C, G(`:491`), W(`fallow:dead-code`), Y | |
| `ci:fallow:health|boundaries|flags|security|fix-preview` (advisory) | stay `bun run` steps under the workflow-gated fallow lane | | | explicit exception to ruling 19 (advisory envelopes, workflow-gated) | C, `check.yml:767–806` | |
| `ci:jsdoc-ratchet:inventory` | ★ `jsdoc:inventory:check` | `bun run beep quality jsdoc-inventory --output-json .beep/ci/jsdoc-documentation.inventory.jsonc --output-markdown .beep/ci/jsdoc-documentation.inventory.md` | `**/docgen.json`, `**/package.json`, `{packages,apps,infra}/**/*.{ts,tsx}` (any `docgen.srcDir`), `tsdoc.json` (explanatory) | D2 (`git ls-files`, timestamps); `outputs: [".beep/ci/jsdoc-documentation.inventory.*"]` | C(jsdoc-ratchet), F (write variant `jsdoc:inventory` stays a script), W, G(`cheap-gates:jsdoc-ratchet`) | ratchet lane |
| `ci:jsdoc-ratchet:ratchet` compare | **cli** after the run | `beep quality jsdoc-ratchet --inventory .beep/ci/… --baseline standards/jsdoc-totals.regression-baseline.jsonc` | consumes a fresh successful inventory only | | C | |
| `lint:package-test-typecheck` | **cli** (D12) | `beep lint package-test-typecheck` | | | P, F | 6 s |
| `quality test-tsgo` aggregate | **cli** (existing Turbo aggregate) | | | | F, G(`cheap-gates:test-tsgo`) | |
| `changeset:status` | root task | `bun run beep quality changeset-status` | `.changeset/**`, `**/package.json` (explanatory) | D2 (`git diff since`) | C(repo-sanity), F, W, G | Repo Sanity 5.14% |
| `config-sync:check` | root task | `bun run beep tsconfig-sync --check` | `**/package.json`, `**/tsconfig*.json`, `**/docgen.json`, `syncpack.config.ts`, `tsconfig.base.json` | | C(repo-sanity), F, W(`repo-sanity:tsconfig-sync`), G | |
| `changeset-graph`, syncpack, sherif, versions, `bun-audit`, `fallow:boundaries:check` | **cli** members of repo-sanity (git or network, or already generated-config compares) | | | | C, W | |
| `version-sync` | **cli**; lefthook keeps `--skip-network` | | | network | L | |
| `topo-sort` | root task | `bun run beep topo-sort` | `**/package.json` | | F | |
| `docs:aggregate` | generator script (unchanged) | | | | — | |

### 2.3 Consumers to rewire (all PRs)

- `Quality/Tasks.ts` `rootRepoLintPolicySteps` (26 steps) becomes the three-invocation plan of
  D10 plus the CLI aggregates; `scopedLawStep`/`scopedRepoCliStep` retire when their last law
  migrates (C3.3); `LINT_POLICY_STEP_CONCURRENCY` retires with the step group.
- `Quality/internal/GithubChecks.ts`: the repo-quality knip route (`:300`), the direct Fallow
  workers (`:485`, `:491`), and the cheap-gate routes for config-sync, tsgo, effect-imports,
  schema-first, allowlist, goals doctor and index, jsdoc, knip, Fallow (`:521–581`) switch to
  the same task invocations (C3.5); lane ids stay.
- `Lint/Lint.command.ts`: `DEPRECATED_API_LINT_SHARDS`, `runDeprecatedApiLintShard`, the
  eslint cache constants retire (C3.2); `lint deprecated-apis` (no args) becomes the Turbo
  wrapper; `--package` is the worker (PR 1); new `lint jsdoc`, `lint laws`,
  `lint package-scripts`, `lint policy-fingerprint`.
- `Ci/CiLane.ts`: `doctestStepForTesting` (exported; its JSDoc surface changes),
  `resolveAffectedDoctestFiles`, `expandDoctestDependents`, `isDoctestPackageInput`,
  `resolveDeletedDoctestManifestRevision` retire (C3.4); `knip`, `jsdoc-ratchet`, `fallow`
  lane steps call `turbo run //#… --summarize` and keep the envelope checks (`:1235`, `:1557`)
  and `--base` forwarding (`:1226`) (C3.5); `lint-policy` lane calls `beep lint policy --full`
  unchanged; `codegen` driver steps (`:1197`) unchanged.
- `.github/workflows/heavy.yml`: `doctest_mode` gate (`:91–141`) and `--mode` (`:244`) retire
  (C3.4). `check.yml` entries (`:247`, `:758`, `:831`, `:859`) and `:767–806` envelope checks
  keep their lane entrypoints; artifacts keep flowing through them.
- Root `package.json`: `doctest` retires (C3.4); D9 scripts added (PR 1 for the two gates,
  C3.5 for the rest); `codegen` split (PR 1); `beep:preflight` rewritten (C3.5).
- `Yeet/internal/WaveOrder.ts` seed rows keep their lane ids; each gains a `taskIds` note
  (C3.6). `Yeet/internal/Planner.ts:348–361` keeps reading Fallow artifacts.
- `Quality/internal/TurboConfigProof.ts` task set gains `lint:deprecated-apis`, `lint:jsdoc`,
  `lint:laws`, `doctest` (C3.2–C3.4) and root-task proofs (C3.5).
- `create-package`, `Architecture/OperationPlanPackageJson.ts`, `DeletePackage/*`: consume the
  scripts-block schema (PR 1).
- `standards/turbo-remote-cache.md`: "Reading policy task hashes" (root `taskId` is
  `//#<script>`; three summaries per policy run; freshness protocol from §7.1.5) and the rule
  line from C3.5.
- Lefthook stays direct for `typos` (its own excludes) and `version-sync --skip-network`.

## 3. Scripts-block schema (schema → service → implementation)

Home: `packages/tooling/tool/cli/src/internal/package-scripts/` (`PackageScripts.schemas.ts`,
`PackageScriptsPolicy.ts`, `index.ts`), following `internal/repo-run/`. Every API below was
checked against `.repos/effect` (rc.112) by the reviewer: `S.Class`, `S.Record`, `S.HashMap`,
`S.HashSet`, `S.TaggedUnion`, `S.optionalKey`, `S.is`, `S.decodeTo`,
`SchemaTransformation.transform`, `S.Array`, `S.Literal`, `S.Int`, `Context.Service`,
`LiteralKit`. `S.HashMap`/`S.HashSet` encode to Effect collections, not JSON, so the report's
wire form uses `S.Record`/`S.Array` with a `decodeTo` into the collection view.

```ts
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $RepoCliId.create("internal/package-scripts/PackageScripts.schemas");

export const PackageScriptsRuleVersion = S.Literal("package-scripts-rules/v1");

/** Workspace kinds; `exempt` = scratchpad and tools/ members. Domain = root `workspaces` only. */
export const PackageKind = LiteralKit(["library", "tool", "ecosystem", "app", "lab", "infra", "exempt"]).pipe(
  $I.annoteSchema("PackageKind", { description: "Manifest kind that selects the canonical scripts block." })
);
export type PackageKind = typeof PackageKind.Type;

/** Task-facing keys: the names Turbo runs. Strict tier (D3). */
export const TaskScriptName = LiteralKit([
  "build", "check", "lint", "lint:fix", "test", "test:property", "test:integration",
  "test:integration:parallel", "coverage", "docgen", "audit", "package-test-typecheck", "codegen",
  "lint:deprecated-apis", "lint:jsdoc", "lint:laws", "doctest",
]).pipe($I.annoteSchema("TaskScriptName", { description: "Script keys that Turbo tasks invoke." }));
export type TaskScriptName = typeof TaskScriptName.Type;

/** Implementation keys: package truth behind the indirection. Free tier (D3). */
export const ImplScriptName = LiteralKit([
  "beep:build", "beep:check", "beep:lint", "beep:lint:fix", "beep:test", "beep:test:integration",
  "beep:docgen", "beep:audit", "beep:doctest",
]).pipe($I.annoteSchema("ImplScriptName", { description: "Package-owned implementation scripts." }));
export type ImplScriptName = typeof ImplScriptName.Type;

/** Binding of a task-facing key: the derived relation of ruling 24. */
export const TaskScriptBinding = S.TaggedUnion({
  indirection: { impl: ImplScriptName, ifPresent: S.Boolean },   // `bun run [--if-present] ${impl}`
  cli: { command: S.String },                                     // exact `beep-cli …` text
  owned: {},                                                      // package text kept verbatim
}).pipe($I.annoteSchema("TaskScriptBinding", { description: "Binding kind for one task-facing script key." }));
export type TaskScriptBinding = typeof TaskScriptBinding.Type;

/** Presence of a task-facing key in one kind. */
export const TaskScriptPresence = S.TaggedUnion({
  required: {},
  optional: {},                                                   // value strict when present
  absent: {},
  derived: { rule: LiteralKit(["doctest-sources", "codegen-generator"]) },   // D7, D11
}).pipe($I.annoteSchema("TaskScriptPresence", { description: "Whether a kind carries a task-facing key." }));

export class TaskScriptRule extends S.Class<TaskScriptRule>($I`TaskScriptRule`)(
  { kind: PackageKind, name: TaskScriptName, presence: TaskScriptPresence, binding: TaskScriptBinding },
  $I.annote("TaskScriptRule", { description: "Canonical rule for one task-facing key in one manifest kind." })
) {}

export class ImplScriptDefault extends S.Class<ImplScriptDefault>($I`ImplScriptDefault`)(
  { kind: PackageKind, name: ImplScriptName, value: S.String },
  $I.annote("ImplScriptDefault", { description: "Default implementation script text, stamped only when missing." })
) {}

/** Partitioned view of one manifest's `scripts` record; the wire form is the flat record. */
export class ScriptsBlock extends S.Class<ScriptsBlock>($I`ScriptsBlock`)(
  {
    kind: PackageKind,
    tasks: S.HashMap(TaskScriptName, S.String),
    impls: S.HashMap(ImplScriptName, S.String),
    extras: S.HashMap(S.String, S.String),
  },
  $I.annote("ScriptsBlock", { description: "Partitioned view of a package.json scripts record." })
) {}
export declare namespace ScriptsBlock {
  export type Encoded = typeof ScriptsBlock.Encoded;
}

export const ScriptsRecord = S.Record(S.String, S.String);
/** decode: ScriptsRecord.Type → ScriptsBlock.Encoded; encode: ScriptsBlock.Encoded → ScriptsRecord.Type (typed errors, no throws). */
export const scriptsBlockFromRecord = (kind: PackageKind) =>
  ScriptsRecord.pipe(
    S.decodeTo(ScriptsBlock, SchemaTransformation.transform({
      decode: (record) => partition(kind, record),
      encode: (block) => flatten(block),                          // stable key order: tasks, impls, extras
    }))
  );

export const PackageScriptsDrift = S.TaggedUnion({
  "missing-task": { name: TaskScriptName },
  "unexpected-task": { name: TaskScriptName },
  "wrong-binding": { name: TaskScriptName, expected: S.String, actual: S.String },
  "missing-impl": { name: ImplScriptName },
  "placeholder": { name: S.Literal("codegen"), actual: S.String },
  "derivation-conflict": { name: S.Literal("doctest"), reason: S.String },   // positive derivation, bypassing config
}).pipe($I.annoteSchema("PackageScriptsDrift", { description: "One scripts-block deviation for one manifest." }));
export type PackageScriptsDrift = typeof PackageScriptsDrift.Type;

const ManifestCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe($I.annoteSchema("ManifestCount", { description: "Non-negative manifest count." }));

/** Wire form of the report (JSON); the HashMap/HashSet view is decoded from it. */
export const PackageScriptsReportWire = S.Struct({
  schemaVersion: S.Literal("package-scripts-report/v1"),
  rules: PackageScriptsRuleVersion,
  manifests: ManifestCount,
  drift: S.Record(S.String, S.Array(PackageScriptsDrift)),        // manifest path → drift rows, sorted
  written: S.Array(S.String),
});
export class PackageScriptsReport extends S.Class<PackageScriptsReport>($I`PackageScriptsReport`)(
  {
    schemaVersion: S.Literal("package-scripts-report/v1"),
    rules: PackageScriptsRuleVersion,
    manifests: ManifestCount,
    drift: S.HashMap(S.String, S.Array(PackageScriptsDrift)),
    written: S.HashSet(S.String),
  },
  $I.annote("PackageScriptsReport", { description: "Result of one --check or --write pass over the fleet." })
) {}
```

Guards derive from the schemas (`S.is(TaskScriptRule)`, `PackageKind.is.lab`,
`TaskScriptName.is["lint:laws"]`); no hand-rolled predicates.

Service contract (`Context.Service`, `ProofLedger.ts:190` precedent):

```ts
export interface PackageScriptsPolicyShape {
  readonly kindOf: (manifestPath: string) => Effect.Effect<PackageKind, PackageScriptsPolicyError>;
  readonly rules: (kind: PackageKind) => ReadonlyArray<TaskScriptRule>;
  readonly expected: (kind: PackageKind, actual: ScriptsBlock, evidence: DerivationEvidence) => ScriptsBlock;
  readonly diff: (actual: ScriptsBlock, expected: ScriptsBlock) => ReadonlyArray<PackageScriptsDrift>;
  readonly check: (repoRoot: string) => Effect.Effect<PackageScriptsReport, PackageScriptsPolicyError>;
  readonly write: (repoRoot: string) => Effect.Effect<PackageScriptsReport, PackageScriptsPolicyError>;
}
export class PackageScriptsPolicy extends Context.Service<PackageScriptsPolicy, PackageScriptsPolicyShape>()(
  $I`PackageScriptsPolicy`, { make: Effect.fn("PackageScriptsPolicy.make")(function* (…) { … }) }
) {}
```

`DerivationEvidence` = `{ doctestOwners: HashSet<manifestPath>, bypassingConfigs: HashSet<manifestPath>,
generators: HashSet<manifestPath> }` computed once per run with the doctest worker's selector
(D7) and the existing non-placeholder `codegen` set. `kindOf` reads the root `workspaces` globs
and path prefixes (`apps/labs/*` → lab, `apps/*` → app, `packages/tooling/tool/*` → tool,
`packages/ecosystem/*` → ecosystem, `infra` → infra, `scratchpad` and `tools/*` → exempt,
else library); a manifest outside the workspaces is out of domain.

Canonical rule table (strict tier), presence from the census in §0.3. `ind(x)` = indirection
to `beep:x`; `cli(t)` = exact text; `own` = package-owned; `req`/`opt`/`—`.

| key | library | tool | ecosystem | app | lab | infra |
| --- | --- | --- | --- | --- | --- | --- |
| build / check / lint / test | req ind | req ind | req ind | req ind | req ind | req ind |
| lint:fix | req ind | req ind | opt ind | req ind | req ind | req ind |
| test:property | opt ind(test) | opt ind(test) | — | opt ind(test) | — | — |
| test:integration | opt ind(test:integration) | — | req ind | opt ind | — | — |
| test:integration:parallel | opt ind(test:integration) | — | opt ind | opt ind | — | — |
| coverage | req own | req own | req own | opt own | — | req own |
| docgen | req ind(docgen) | req ind | req ind | opt ind | — | req ind |
| audit | req `bun run --if-present beep:audit` | same | same | same | same | same |
| package-test-typecheck | req cli(`beep-cli quality test-tsgo-package`) | same | same | same | same | same |
| codegen | derived(codegen-generator) own | same | same | same | same | same |
| lint:deprecated-apis | req cli(`beep-cli lint deprecated-apis --package .`) | same | same | same | same | same |
| lint:jsdoc | req cli(`beep-cli lint jsdoc --package .`) | same | same | same | same | same |
| lint:laws | req cli(`beep-cli lint laws --package .`) | same | same | same | same | same |
| doctest | derived(doctest-sources) ind(doctest) | same | same | same | same | — |

Gate contract: `beep lint package-scripts --check` exits non-zero with one drift row per
manifest and key; `--write` applies strict-tier fixes, adds missing `beep:*` defaults, removes
placeholders, and never edits an existing `beep:*` value or any `extras` key; both are
idempotent. Tests assert observable contracts with literals (existing
`create-package.test.ts:195,220` style): app and infra docgen retained, optional parallel
scripts retained, impl values and extras preserved, idempotent writes, fixture exclusion, and
negative drift; they do not derive expectations from the rule table they test.

## 4. `turbo.json` contract

The canonical input lists are §2; this section shows the shape only. Two examples:

```jsonc
"lint:laws": {
  "cache": true,
  "inputs": ["**/*.{ts,tsx}", "package.json", "tsconfig*.json", "$TURBO_ROOT$/tsconfig*.json",
    "$TURBO_ROOT$/packages/**/package.json", "$TURBO_ROOT$/standards/policy-tools.fingerprint.json",
    "$TURBO_ROOT$/standards/effect-laws.allowlist.jsonc",
    "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts",
    "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts",
    "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts",
    "!node_modules/**"]
},
"//#fallow:audit:check": {
  "cache": false,
  "env": ["BEEP_PROOF_BASE"],
  "outputs": [".beep/fallow/audit.check.json", ".beep/fallow/raw/audit.check.*"],
  "inputs": [".fallowrc.jsonc", "**/package.json", "**/tsconfig*.json", "apps/**", "packages/**", "infra/**",
    "scripts/**", ".claude/skills/**", ".fallow/plugins/**", "standards/policy-tools.fingerprint.json",
    "!**/node_modules/**"]
}
```

The reviewer validated nine sketched entries against the installed 2.10.12 schema (Ajv,
valid). C3.2–C3.5 generate the final entries from §2 and prove them with `--dry-run=json`
fixtures, so the table and the file cannot disagree. `global.env` keeps `BEEP_ESLINT_PROFILE`;
`codegen` is unchanged; no `with`, no `interruptible`.

Invocations (D10):

| Context | Invocations |
| --- | --- |
| local `beep lint policy` | (1) `turbo run <cheap gates> --affected --continue=dependencies-successful --summarize`, stop on a precise red; (2) `turbo run lint:jsdoc lint:laws //#lint:schema-first --affected …` and, unfiltered, `turbo run <D2 group> …`; (3) `turbo run lint:deprecated-apis --affected --concurrency=<N> …`; then CLI aggregates |
| `--full`, hosted Lint Policy | the same three without `--affected`, all executed, nonzero exit retained |
| hosted Doctest | `turbo run doctest --summarize` |
| hosted Knip / Fallow / JSDoc Ratchet | `turbo run //#knip:check --summarize`; `turbo run //#fallow:audit:check //#fallow:dead-code:check --summarize` then envelope checks; `turbo run //#jsdoc:inventory:check --summarize` then the compare |
| `beep:preflight` | the `--write` generators (`tsconfig-sync`, `fallow:boundaries:write`, `jsdoc:inventory`, `schema-first --write`, `package-scripts --write`, `policy-fingerprint --write`), then the local plan |

The remote-cache secret session wraps the runs as `turboStep` does today (`turboRunArgs`);
`labsExcludeFilterArgs` is not applied to policy tasks (D6). `TURBO_SCM_BASE`/head scope come
from the existing caller (`CiLane.ts:1107`), never from an ambient wrapper.

## 5. `vitest.shared.ts` doctest mode branch (ruling 22)

```ts
import * as Doctest from "@effect/doctest/Plugin";

export const vitestDoctestActive = configStringEqualsSync("BEEP_VITEST_DOCTEST", "1");

const config: ViteUserConfig = {
  plugins: [resolveUniformTypeScriptSourceSpecifiers(), ...(vitestDoctestActive ? [Doctest.plugin()] : [])],
  // …
  test: {
    // …
    testTimeout: vitestDoctestActive ? 30_000 : vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 30_000,
    passWithNoTests: vitestCoverageRunActive,          // doctest: false (D7)
    include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
    includeSource: vitestDoctestActive ? ["src/**/*.{ts,tsx}"] : [],
    exclude: vitestDoctestActive
      ? ["**/.context/**", "**/node_modules/**", "**/test/fixtures/**"]
      : ["**/.context/**", "**/node_modules/**"],
    sequence: { concurrent: !vitestDoctestActive },
  },
};
```

Package script: `"beep:doctest": "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run"` (P10).
Resolved-config facts from the review: a package config that sets `test.include` while
inheriting the shared branch runs its ordinary tests **as well as** doctests (vitest appends
in-source files to the test list), and a config that never imports the shared config bypasses
the mode. Ten inheriting configs set `test.include` (duckdb, todox, oip-web,
professional-desktop, practice-kg-mcp, api-docs, ciops, lejeune-bolt-workbench, semantica,
trustgraph-workbench); `apps/storybook` bypasses; browser and integration configs are not
selected by the default command. C3.4 therefore makes every package override conditional on
the exported `vitestDoctestActive` (ordinary `include` only when the flag is off), asserts a
non-empty eligible discovery per owner, and adds each owner's setup files (for example
`packages/tooling/tool/cli/test/global-cleanup.ts`) to the task inputs. `sequence.concurrent`
governs in-file concurrency only; Turbo's process fan-out is measured, not assumed.
`vitest.docs.ts` is deleted; `@effect/doctest` stays a root devDependency.

## 6. Test migration list

| File | Today | Change | PR |
| --- | --- | --- | --- |
| `packages/tooling/tool/cli/test/ci-lane.test.ts:13,1085–1098` | imports and asserts `doctestStepForTesting` argv | assert the `turbo run doctest --summarize` step | C3.4 |
| `packages/tooling/tool/cli/test/ci-lane.test.ts:1300–1700` (`doctestCiLayer` cases at 1314, 1360, 1398, 1421, 1444, 1462, 1522, 1568, 1604, 1628, 1657, 1682) | exercise `resolveAffectedDoctestFiles` | delete with the resolver; keep one `full` case | C3.4 |
| `packages/tooling/tool/cli/test/doctest-lane.test.ts:17` + `test/fixtures/doctest-lane/package/{package.json,tsconfig.json:3}` | boots vitest with `vitest.docs.ts` | fixture gains `beep:doctest`/`doctest` scripts and a tsconfig without the root config reference; the test runs the package script with `BEEP_VITEST_DOCTEST=1` | C3.4 |
| `packages/tooling/tool/cli/test/ci-runner-security.test.ts:326,355` | asserts `doctest_mode=full` and the root `doctest` script | assert both are gone | C3.4 |
| `packages/tooling/tool/cli/test/ci-lane.test.ts:982,1131–1137,1147` | `ci:jsdoc-ratchet`, `ci:fallow:*` argv | `turbo run //#… --summarize` argv, envelope checks retained, inventory→compare order retained | C3.5 |
| `packages/tooling/tool/cli/test/quality-tasks.test.ts:99,2544,2592,2616,2659` (`rootLintPolicyStepsForTesting`), `:2137–2138` (fallow blocking/envelope), `:1320` (cheap-gate spawn count) | pin the 26-step list and spawn counts | pin the three-invocation plan argv and the CLI aggregate list; prove no check is lost (label set before = task set + aggregates after); the push-only red at `:1320` is inherited on main | C3.2, C3.5 |
| `packages/tooling/tool/cli/test/create-package.test.ts:195,202,220,238` | pins `beep:policy` (inside `beep:audit` too), codegen placeholder, `docgen: bun run beep:docgen` | literal contract tests for the new block; `beep:policy` retirement inspects `beep:audit` chains | PR 1, C3.3 |
| `DEPRECATED_API_LINT_SHARDS` | no test pins it | new worker tests: package cwd, config base, profile env, heap cap, exit codes | PR 1, C3.2 |
| `packages/tooling/tool/cli/test/turbo-config-proof*.test.ts` | task set `build check lint test docgen` | add the four package tasks and two root tasks; add the fixtures of §7.1 | C3.2–C3.5 |
| `packages/tooling/tool/cli/test/architecture*.test.ts`, `delete-package*.test.ts` | pin inline scripts objects | literal contracts against the new block | PR 1 |
| `packages/tooling/tool/cli/test/docgen.test.ts` (`doctest` fixture) | docgen's doctest rewrite preview | unchanged | — |

## 7. Acceptance and PR train

### 7.1 Per-lane acceptance

1. **Hash fixtures** (`TurboConfigProof` style, `--dry-run=json`): (a) an edit to a file
   outside the lane's declared and actual closure leaves the hash stable; (b) an in-package
   source edit (package task) or a declared-input edit (root task) changes it. For Markdown,
   refs, roadmap and typos tasks a docs edit is an input, so (a) uses a non-docs file.
2. **Negative closure fixtures** (the F3 backstop): for each task, edit a file the tool reads
   that the declared inputs omit (owner manifest, setup file, shared rule helper, ignore
   file, link target) and assert the hash changes; if it does not, widen the inputs before the
   task is registered. Binary walkers (oxlint, typos, knip) ship with a walk fixture; until it
   passes they stay `cache: false`.
3. **Ruling 6 fixtures**: a package whose source the change touches never reuses (ledger
   tripwire); a declared-input edit selects the root task under `--affected` (P4/P6 as
   executable fixtures, C3.5).
4. **Accounting before claims** (ship-velocity C5): baseline hosted p50/p95 per lane and the
   local pre-push wave are recorded before the PR; the first cold run after merge and the
   second run's per-lane hit ratio are recorded after; never a whole-proof denominator. PR 1's
   fleet-wide cold run is measured the same way.
5. **Ledger provenance and freshness**: each invocation records its own summary path; the
   ledger ingests `tasks[].hash` only from summaries created by this attempt (run id and
   start time), requires `execution.exitCode === 0` or valid cache evidence per task, and
   distinguishes skipped, missing, failed and uncacheable tasks. Root `taskId` is
   `//#<script>`.
6. Hosted Lint Policy and Doctest stay full scope; all moved tests green; each gate lands
   green on main (fleet `--write` in the same PR, ruling 24); a `<= 500 changed files` check
   runs before every publish.
7. Package handoff: `bun run beep quality package-verify @beep/repo-cli` (`CI=true
   TMPDIR=/tmp`) for the CLI; for the fleet manifest PR, `--quick` verification on a sample
   of touched workspaces plus Yeet's required full gates decide readiness.

### 7.2 PR train

| PR | Item | Scope | Files (est.) |
| --- | --- | --- | --- |
| 0 | rulings + this table | publish `ttc/c3-package-tasks-grill` with `c3-turbo-facts.md`, `c3-sublane-inputs.md`, this file and its review | 6 |
| 1 | C3.1 | schema + service + `lint package-scripts` + `lint policy-fingerprint` + fingerprint file + three writers + thin workers (D16) + mode branch + fleet `--write` (docgen convergence, four new keys, codegen placeholders, `beep:policy` optional until C3.3) + `codegen` split + two root gates registered + `AGENTS.md` law line | ~190 (142 manifests) |
| 2 | C3.2 | `lint:deprecated-apis` + `lint:jsdoc` tasks and `//#lint:jsdoc:root`; shard runner and eslint caches retire; the typed invocation; `turbo-config-proof` tasks; fixtures; before/after | ~25 |
| 3 | C3.3 | package-local law scanner; `lint:laws` task; `//#lint:native-runtime:roots`; `scopedLawStep` retires; `beep:policy` retires from fleet (manifest touch: 2 files) and schema | ~30 |
| 4 | C3.4 | `doctest` task, conditional package overrides (11 configs), `vitest.docs.ts` and resolver retire, `heavy.yml`, tests | ~40 |
| 5 | C3.5 | `//#` root tasks, D9 root scripts, three-invocation plan in `lint policy` and `beep:preflight`, GithubChecks routes, knip/fallow/jsdoc-ratchet lanes on Turbo, `standards/turbo-remote-cache.md` | ~35 |
| 6 | C3.6 | economics re-run, ledger report with per-lane hashes, PLAN checkmarks, receipts | ~10 |

Each PR: `bun run docgen:local`, filtered checks locally, package-verify per §7.1.7,
`bun run beep yeet publish --start-pr-early --monitor --pr`, babysit to `merge-ready: yes`,
answer every thread with `bun run beep yeet reply`. Never merge. Friction receipts go to
`research/OPPORTUNITIES.md` as they happen.

### 7.3 Risks named up front

- **R1 Cold hosted Doctest.** 27 boots plus `^transit` misses on dependency changes; today's
  affected list is 82 s p50. Remote-cache reads warmed by main's push run; accounting per
  7.1.4 before any claim.
- **R2 Package vitest configs.** Ten inheriting overrides and one bypass (§5); C3.4 makes
  overrides conditional and refuses positive derivation on a bypass.
- **R3 Eslint memory.** The typed invocation is bounded (D10); the hosted runner memory
  ceiling is the number to measure against.
- **R4 Binary walkers.** Unknown ignore semantics; `cache: false` until the walk fixture
  passes (D14, 7.1.2).
- **R5 One fleet-wide cold run** from the PR 1 manifest touch (D16), measured per 7.1.4.
- **R6 Root task selection widening.** `WT` root tasks are selected on any matching change
  locally; the honest cost of truthful inputs.
- **R7 Fingerprint scope.** Foundation packages the CLI imports are outside the fingerprint
  (Q7); a checker behaviour change that lives in `@beep/utils` would not rerun policy tasks.

## 8. Scope and open questions

Out of scope (from the orchestrator brief, reproduced so the packet is self-contained): the
Labs C3 item; the `X` → `beep:X` indirection layer itself; hosted `--affected`; the ops and
infra root scripts; promoting oxlint advisory rules; merge queues; hosted-tier proof reuse; any
cache-key change without first-cold-lane measurement; a second scheduler or lock.

- **Q1 (D4)** Converge `coverage` to the indirection too (PR 1 touches every manifest anyway),
  or keep it package-owned as revision 2 does?
- **Q2 (D7)** Presence-by-need for `doctest` (27 manifests) with `passWithNoTests: false`, or
  stamp every manifest?
- **Q3 (D2)** Accept the non-reusable class as is, or fund a complete git/tree/ref/time state
  model for reuse of those lanes in a later item?
- **Q4 (D10)** Three ordered invocations with local fail-fast after the cheap gates, or amend
  SPEC B3 toward one collected plan?
- **Q5 (F1)** Amend ruling 19's text to record the verified mechanism (root tasks join
  `--affected` by inputs; only the D2 group needs an unfiltered invocation)?
- **Q6 (A1)** Keep effect-imports code mode out of `lint:laws` until it has promoted families?
- **Q7 (D15)** Fingerprint the CLI, repo-utils and policy-pack only, or also the foundation
  packages the CLI imports (`@beep/utils`, `@beep/schema`, `@beep/identity`)?
