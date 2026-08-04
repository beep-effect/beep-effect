# Gate value audit — laws and lint batteries

Date: 2026-08-04  
Branch audited: `chore/improve-speed-of-things`  
Scope: read-only source/history review plus isolated read-only timings; no Turbo,
build, or test command was run.

## Bottom line

1. **Dual-arity should come off the full-repo every-run path, but the rule should
   not disappear.** Delete the empty committed-inventory/repair churn and run the
   detector only against changed exported helpers. Tonight it cost **79.0s** to
   find zero live, tracked, missing, stale, or enforced entries while excluding
   156 legitimate helpers (`.beep/yeet/logs/full_01-pre-push.log:2280`,
   `.beep/yeet/logs/full_01-pre-push.log:2872-2880`). It has real historical
   value—the P0 dogfood caught two new helper APIs—but that evidence supports
   changed-export enforcement, not a perpetual whole-tree census
   (`goals/one-round-loop/history/p0-parity-evidence.md:211-218`).
2. **Keep Markdown lint.** Tonight it did no work—**0.091s, 0 files**—because the
   clean-tree/default-discovery invocation had no Markdown inputs
   (`.beep/yeet/logs/full_01-pre-push.log:2285`,
   `.beep/yeet/logs/full_01-pre-push.log:3099-3103`). Historically it caught a
   real unlanguaged fence (`MD040`), so its cost/catch ratio is excellent
   (`goals/box-typecheck-cost/history/reflections/2026-08-01-claude.md:75-82`).
   Its defect is visibility: untracked Markdown can produce `Linting: 0 files`
   until staged (`goals/box-typecheck-cost/history/reflections/2026-08-01-claude.md:28-31`).
3. **Scope cspell to changed source/config files.** It is not zero-benefit: the
   operator reports one comment typo tonight, and prior histories record a real
   cspell miss and named-term catches (`goals/lint-toolchain-modernization/history/reflections/2026-06-21-claude.md:34-35`,
   `goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md:153-159`).
   But the current full scan checks 3,991 files for **9.2s** while excluding
   goals, docs, tests, explorations, and agent instructions—the places where
   spelling review is often most valuable (`.beep/yeet/logs/full_01-pre-push.log:2284`,
   `.beep/yeet/logs/full_01-pre-push.log:3097-3098`, `cspell.json:76-97`). Typos
   already supplies a much cheaper overlapping net.

The root lint-policy list is 25 independent read-only subprocesses
(`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1292-1320`) run at
concurrency 2 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:102-111`).
Individual seconds below therefore describe CPU/work and critical-path risk,
not an additive wall-time total. The latest retained run launched root lint plus
all 25 policy steps at concurrency 3 and finished the root lint task in 122.7s,
while the whole quality-lint lane failed after 286.0s on terse-effect
(`.beep/yeet/logs/full_01-pre-push.log:2238-2264`,
`.beep/yeet/logs/full_01-pre-push.log:2278`,
`.beep/yeet/logs/full_01-pre-push.log:3107-3112`). Fleet data shows why this
matters: hosted Lint Policy is p50 **588s**, p95 **963s**, with about a **21%**
failure rate (`goals/quality-speedup/research/quality-time-inventory.md:56-71`).

## Inventory and recommendation

`Measured` means one warm isolated read-only run in this audit. `Tonight` means
the latest retained full-proof log. `Fleet` means the committed 92-run hosted
sample / 49-checkout local scan (`goals/quality-speedup/research/quality-time-inventory.md:3-14`).
To keep the table readable, unique source basenames are shortened: `Tasks.ts`
means `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`, `CiLane.ts`
means `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`, and the other
command/ratchet basenames resolve under the command directories named in the
surrounding prose. All evidence/history/config citations remain repo-relative.

| Gate | What it checks | Where wired | Cost/run | Catch evidence | Recommendation |
| --- | --- | --- | ---: | --- | --- |
| **dual-arity** | Public 2–3 positional helper APIs follow Effect data-first/data-last dual form and inventory is reconciled. | Lint policy: `Tasks.ts:1298`; command contract: `Laws.command.ts:325-346`; Yeet repair writes inventory: `Planner.ts:244-265`. | **79.0s tonight**; 30.6s prior warm floor. | Tonight: none, zero live/enforced. Historical: two P0 helpers; old remediation drove 120→0. | **Scope to changed exported helpers; delete empty inventory + every-repair write.** |
| **lint:markdown** | Markdown structural rules such as fenced-code languages; broad style rules are disabled. | `Tasks.ts:1314`; config/ignores: `.markdownlint-cli2.jsonc:1-43`. | **0.091s tonight; 0.09s measured**, 0 files clean. | Historical real `MD040`; tonight none. Untracked-file blind spot. | **Keep** as the already-cheap changed-Markdown gate; make explicit path discovery include untracked/staged files. |
| **lint:spell / cspell** | Dictionary spelling over non-ignored repo text. | `Tasks.ts:1313`; dictionaries/ignores: `cspell.json:7-57`, `cspell.json:59-107`. | **9.245s tonight; 9.03s measured**, 3,991 files. | Operator-reported comment typo tonight; prior cspell miss and technical terms. | **Scope to changed files**; do not full-scan on every PR. |
| effect-imports | Canonical Effect import aliases and stable submodule imports; supports safe rewrites. | `Tasks.ts:1293`; command description: `Laws.command.ts:205-240`. | 11.7s tonight. | Caught this pipeline's own `Duration` import and rich-text stable-module imports. | **Scope to changed TS files**; retain `--write` in repair. |
| terse-effect | Trivial helper refs/thunks, `flow` candidates, Option compaction/match forms, and related terse equivalents. | `Tasks.ts:1294`; command: `Laws.command.ts:255-310`. | 34.9s tonight. | **One real flow candidate tonight** at `IanaMediaTypes.ts:514`; multiple prior real catches. | **Scope to changed TS files; keep blocking.** |
| effect-fn | Reusable functions returning `Effect.gen` are wrapped by `Effect.fn`/`Effect.fnUntraced`. | `Tasks.ts:1295`; command: `Laws.command.ts:361-391`. | 15.1s tonight. | Full proof caught an arrow-returning `Effect.gen` that tests/tsgo missed. | **Scope to changed TS files; keep blocking.** |
| frozen-grant-set | `FrozenGrantSet.make` is called only inside its defining module. | `Tasks.ts:1296`; command: `Laws.command.ts:407-438`. | 20.0s tonight. | No concrete caught-regression incident found; git history mostly shows gate introduction/feature compliance. | **Scope to changed authority files**; keep because it protects a narrow security boundary. |
| native-runtime | Hotspot code avoids native `Object`/collections/date/error/runtime patterns, with explicit exceptions. | `Tasks.ts:1297`; command: `Laws.command.ts:453-488`. | 21.2s tonight. | Caught a native `Error` in `Effect.die`; tonight zero errors, 25 allowlisted. | **Scope scan to changed TS plus changed allowlist; keep blocking.** |
| laws allowlist | Validates schema, duplicate/stale keys, live native-runtime matches, and generated ESLint snapshot parity. | `Tasks.ts:1299`; stale/live/snapshot checks: `AllowlistCheck.ts:190-273`. | 4.1s tonight; **2.17s measured**. | Historical cleanup reduced 17 entries to 6 justified idioms; no tonight catch. | **Keep.** Load-bearing for native-runtime exceptions and generated ESLint lookup. |
| tsgo-rules | All installed `@effect/tsgo` diagnostics remain configured as errors and suppression directives stay prohibited. | `Tasks.ts:1300`; command: `Quality.command.ts:2017-2018`. | 6.3s tonight; **3.17s measured**. | 83 rules verified tonight; history records directives forcing a test-harness rewrite. | **Keep.** It guards configuration, not source scanning. |
| identity-registry | Every workspace package uses the central IdentityComposer registry and no package creates a local root composer. | `Tasks.ts:1301`; contract: `IdentityRegistry.ts:260-271`. | 23.6s tonight. | Rich-text scaffolding exposed a registry-updater drift bug. | **Keep**, but cache by workspace manifests/registry inputs. |
| package-test-imports | Package tests import workspace source through `@beep/*`, not relative `src/` paths. | `Tasks.ts:1302`; contract: `PackageTestImports.ts:334-335`. | 16.1s tonight. | No concrete catch incident found in git-log/goal-history search. | **Scope to changed test files.** Delete later only if Biome/ESLint owns the same rule. |
| package-test-typecheck | Ratchets packages whose normal `check` omits their own test sources. | `Tasks.ts:1303`; baseline contract: `PackageTestTypecheck.ts:965-977`. | 7.1s tonight. | Bitemporal work exposed `Order.string` only through a recorded test-typecheck blind spot. | **Keep** on manifest/tsconfig/test topology changes; otherwise reuse baseline. |
| reflection-artifacts | Completed goal packets have schema-valid closeout reflections. | `Tasks.ts:1304`; contract: `ReflectionArtifact.ts:350-360`. | 2.9s tonight; **1.88s measured**. | Correctly blocked at least two administrative closeouts without reflections. | **Scope to changed goal lifecycle/manifests/reflections.** |
| roadmap-refs | Roadmap goal/exploration links resolve to real targets. | `Tasks.ts:1305`; contract: `RoadmapRefs.ts:268-269`. | 2.2s tonight. | No concrete caught-regression incident found; history mainly records its introduction. | **Scope to roadmap/goals/explorations changes.** |
| goals:doctor | Manifest lifecycle claims agree with git/filesystem reality under a shrink-only baseline. | `Tasks.ts:1306`; command: `Doctor.ts:796-818`. | 2.35s tonight. | Caught invalid `"completed"` statuses after tests passed. | **Scope to goal-packet changes; keep blocking there.** |
| goals:index-check | `goals/INDEX.md` exactly matches goal manifests. | `Tasks.ts:1307`; comparison/failure: `PortfolioIndex.ts:253-266`. | 2.39s tonight; **1.92s measured**. | Repeatedly caught stale index after packet additions/status changes. | **Scope to goal manifest/index changes.** |
| schema-first inventory + SFV4 detectors | Reconciles exported data-model inventory and blocks schema-first/SFV4 policy findings. | `Tasks.ts:1308`; command: `SchemaFirst.ts:346-354`; detector output tonight: `.beep/yeet/logs/full_01-pre-push.log:3038-3057`. | 32.3s tonight. | P0 caught an exported pure-data alias; first Yeet on rich-text caught multiple real findings. Line-keyed exceptions have also false-redded after unrelated shifts. | **Scope to changed exported symbols**, while retaining the baseline ledger and stable symbol keys. |
| schema-catalog *(callable, not wired)* | Checks generated schema catalog freshness. | Registered only as a lint subcommand: `Lint.command.ts:600-615`; contract: `SchemaCatalog.ts:765-773`. | **19.84s measured; currently red/stale.** | No blocking-gate catch evidence because it is not a gate. | **Advisory/on-demand dedicated refresh only; do not add to every-run policy.** |
| schema-topology *(callable, not wired)* | Canonical `@beep/schema` source/export/root-alias topology. | Registered only: `Lint.command.ts:600-615`; contract: `SchemaTopology.ts:492-493`. | **1.88s measured; green.** | No concrete catch incident found. | **Scope to `@beep/schema`/root-alias changes** if promoted; otherwise keep on-demand. |
| tooling-schema-first *(callable, not wired)* | Filename/export-interface/tagged-union conventions in repo-cli source. | Registered only: `Lint.command.ts:600-615`; contract: `Lint.command.ts:568-569`. | **1.99s measured; 148 findings.** | No gate catch evidence; it is a permanently red diagnostic today. | **Delete or explicitly baseline before promotion.** In current form it is not a trustworthy gate. |
| deprecated-apis | Sharded ESLint scan for deprecated third-party APIs. | `Tasks.ts:1309`; contract: `Lint.command.ts:493-526`. | **161.7s tonight**, slowest policy subprocess. | History has a real `KeyboardEvent.keyCode` cleanup, but the clearest recorded incident was scanner config missing story files, not a product catch. | **Scope to changed TS/TSX and dependents.** Highest immediate policy-work reduction. |
| lint:jsdoc | ESLint JSDoc/TSDoc rules over the repo. | `Tasks.ts:1310`. | 58.7s tonight. | One new package produced 41 real warnings; rich-text fileoverview placement was caught. | **Scope to changed exported source files/packages; keep blocking.** |
| jsdoc-module-tags | Forbids legacy `@module` fileoverview tags. | `Tasks.ts:1311`; contract: `Quality.command.ts:2021-2023`. | 2.1s tonight. | No concrete catch incident found. | **Scope to changed source files**; fold into lint:jsdoc if possible. |
| lint:docgen | Rechecks package docs, reusing proof manifests. | `Tasks.ts:1312`. | 10.4s tonight with 117 packages skipped. | Rich-text caught hidden/misordered fileoverview blocks; hosted Docgen is already a separate required lane. | **Delete from lint-policy; retain standalone required Docgen.** This is duplicate placement, not deletion of doc proof. |
| lint:circular | Circular dependencies in tooling source directories. | `Tasks.ts:1315`; contract: `Lint.command.ts:501-513`. | 8.1s tonight. | Git history shows cycle cleanup, but no clear gate-caught incident in goal histories. | **Scope to changed tooling dependency graph.** |
| typos | Fast typo scanner over its configured repository surface. | `Tasks.ts:1316`; pre-commit also runs it: `lefthook.yml:15-18`. | 0.261s tonight; **0.24s measured**. | Caught `CHECKs` at five sites in one real packet. | **Keep.** It is the spelling gate with the best marginal cost/catch ratio. |
| oxlint (`--quiet`) | Mandatory/error Oxlint rules; suppresses advisory-warning backlog. | `Tasks.ts:1317-1319`. | 2.3s tonight. | Rule-spike evidence found nine whole-tree occurrences and led to an explicit advisory/mandatory split. | **Keep error-only.** Its current `--quiet` posture is already the right demotion boundary. |
| instructions-drift | Root `CLAUDE.md` remains the `AGENTS.md` symlink. | Script: `package.json:432`; changed-file pre-commit hook: `lefthook.yml:19-21`. | **<0.01s measured.** | No recorded catch found. | **Keep.** Near-zero-cost single-source invariant, already perfectly scoped. |
| syncpack | Workspace dependency/catalog version consistency. | Repo Sanity collector: `GithubChecks.ts:273-277`. | **0.09s measured.** | Tonight's dependency repair required syncpack range alignment; seeded manifest drift is known to fire Repo Sanity. | **Keep.** Near-zero cost and distinct manifest signal. |
| Sherif | Monorepo package-manifest hygiene, with `non-existent-packages` ignored. | Repo Sanity collector: `GithubChecks.ts:278-281`. | **0.01s measured**; current run emitted one non-blocking root-dependencies warning. | Seeded manifest desync is structurally covered; no clear organic catch found. | **Keep errors blocking; warnings advisory.** Already effectively demoted. |
| Knip ratchet | New unused exports/files/dependencies and unresolved dependencies relative to a committed baseline. | Required CI lane: `CiLane.ts:433-438`; baseline enforcement: `KnipRatchet.ts:443-473`. | **12.0s measured**; p0 also 12s. | Strong: caught five genuine integration regressions, fixed without baseline growth. | **Keep.** One of the best evidenced standalone gates. |
| codegen drift | Regenerates ECFR output, diffs generated files, and checks desktop migration bundle. | Required descriptor: `CiLane.ts:406-411`; steps: `CiLane.ts:770-798`. | ~3s warm p0; hosted lane belongs to the 7–87s low-cost group. | Synthetic drift failed locally and CI; no organic catch found in searched history. | **Keep**, but trigger only on generator/input/generated-bundle paths. |
| JSDoc ratchet | Generates a JSDoc inventory, blocks totals growth, and enforces cleanup-on-touch grammar. | Required lane: `CiLane.ts:441-447`; inventory+ratchet sequence: `CiLane.ts:829-846`; comparison: `JSDocRatchet.ts:340-377`. | p0 169s; hosted p50 **289s**, p95 371s, 0/88 failures. | Synthetic regressions proven; old cleanup reduced ~2,418 findings to zero. First fixture missed because an undocumented export does not reduce documented totals. | **Scope inventory to affected barrel exports; retain changed-file grammar and scheduled/full-main census.** |
| coverage regression | Runs package coverage and fails package/metric drops versus committed baseline. | Required descriptor: `CiLane.ts:389-395`; compare after coverage: `Tasks.ts:1488-1508`; metric comparison: `CoverageRegression.ts:437-487`. | p0 warm 146s; hosted p50 **692s**, p95 828s, ~25% fail. | Synthetic drop proven; also repeatedly catches environment/test-lane incompatibilities, not just coverage loss. | **Scope more narrowly to directly changed packages; run full regression on main/nightly.** Keep the metric ratchet, remove PR-wide blast radius. |

## Per-gate rationale and proposed follow-up shape

### 1. Dual-arity — scope, and remove the empty ledger machinery

The current command is paying whole-project ts-morph cost to prove an empty
inventory. Both the check and Yeet repair say `live_entries=0`,
`tracked_entries=0`, and `enforced_candidates=0`; repair still rewrites the
inventory (`.beep/yeet/logs/prepare_02-dual-arity.log:1-9`). The scanner was
previously the lint-policy critical-path floor at 30.6s
(`goals/agent-pipeline-velocity/history/rqt-ledger.md:37-48`) and tonight rose to
79.0s. Worse, Yeet has repeatedly misattributed unrelated failures to this gate
even while it passed (`goals/agent-pipeline-velocity/history/rqt-ledger.md:53-61`).

The law nevertheless has a demonstrated catch: P0 created two public 3/4-arg
helpers and the battery forced them into `dual(...)`/schema-plan forms
(`goals/one-round-loop/history/p0-parity-evidence.md:208-226`). The right follow-up
is therefore:

- delete `standards/dual-arity.inventory.jsonc` once it is empty;
- remove the unconditional `laws dual-arity --write` Yeet prepare step;
- add an include/changed-path mode and run it only when changed TypeScript
  contains exported candidate helpers (or when the detector itself changes);
- keep a scheduled/full detector self-test if the operator wants protection
  against scanner drift.

That preserves the proven marginal catch while eliminating the expensive
zero-candidate census and timestamp/conflict churn.

### 2. Markdown lint — keep the gate, fix its evidence contract

The operator's zero-benefit prior is not supported by the history. It caught a
real `MD040` fence defect that self-review missed
(`goals/box-typecheck-cost/history/reflections/2026-08-01-claude.md:75-82`), and
its current runtime is noise-level. The problem is not cost; it is that bare
`markdownlint-cli2` may select zero files on a clean or unstaged tree. Preserve
the gate, but have the wrapper pass the exact changed/staged/untracked Markdown
paths so `0 files` is an intentional no-op rather than ambiguous evidence. Do
not expand it into ignored `docs/**` without a separate cleanup decision; the
current ignore set is explicit (`.markdownlint-cli2.jsonc:18-43`).

### 3. cspell — low marginal value, not zero value

The final retained log cannot prove the operator-reported typo because it is the
post-fix clean pass; it proves only that 3,991 files were scanned with zero
remaining issues. Historical evidence is stronger than the prior: one package
round caught a cspell miss alongside effect-imports, schema-first, and JSDoc
findings (`goals/lint-toolchain-modernization/history/reflections/2026-06-21-claude.md:34-35`),
and other packets record technical-word interventions. But cspell excludes
`goals/**`, `**/docs/**`, `**/test/**`, `explorations/**`, and `**/AGENTS.md`
(`cspell.json:76-97`), while typos catches real prose defects at 1/38th the wall
cost. Run cspell only on changed source/config files and keep typos as the broad
required spelling net. If changed-path plumbing proves brittle, deletion in
favor of typos is preferable to retaining the full scan.

### 4. Effect laws — retain their semantics, stop rescanning untouched code

- **effect-imports:** proven both as a catcher and a Yeet repair primitive. The
  grouped-concurrency change itself was corrected by this law
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:44-51`), and the
  Effect-import codemod cannot be replaced by a simple lint rule without losing
  whole-file consolidation (`goals/lint-toolchain-modernization/history/reflections/2026-06-21-claude.md:20-23`).
- **terse-effect:** tonight's exact finding is durable in the proof log
  (`.beep/yeet/logs/full_01-pre-push.log:2832-2850`). Other work recorded two
  flow candidates fixed to `flow`/direct `O.match`
  (`goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md:151-155`).
- **effect-fn:** a full proof caught a reusable arrow callback returning
  `Effect.gen` after per-package tests/tsgo were green
  (`goals/yeet-publish-preflight/history/reflections/2026-07-14-claude.md:59-68`).
- **native-runtime:** caught a native `Error` construction in real work
  (`goals/box-typecheck-cost/history/reflections/2026-08-01-claude.md:75-82`).
- **frozen-grant-set:** no historical catch was found. It is still a precise
  authority-boundary invariant, so the least-regret posture is changed-file
  enforcement rather than deletion. Reassess after 50 scoped runs; zero
  candidates/catches would justify folding it into a focused package lint.
- **allowlist-check:** keep unscoped. It validates not only hand-authored JSONC
  but stale live keys and the generated ESLint snapshot
  (`packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:213-273`). It is
  load-bearing for native-runtime consumers and costs only ~2–4s.

### 5. Structural/configuration lint — mostly keep, narrowly trigger

- **tsgo-rules** is a cheap meta-gate over 83 installed diagnostics. It catches
  weakening of the compiler-law configuration, including `:off` directives;
  source tests alone cannot replace it
  (`goals/lint-toolchain-modernization/history/reflections/2026-06-21-claude.md:28-31`).
- **identity-registry** has real scaffolder-drift evidence: CreatePackage was
  targeting an obsolete registry shape until rich-text work exercised it
  (`goals/rich-text-foundation/history/2026-06-12-implementation-evidence.md:5-11`).
  Cache it or trigger on workspace/identity changes; do not discard it.
- **package-test-imports** has a clear repository law but no located incident.
  It should scan only changed tests. If an existing static linter can express
  the alias rule, consolidate rather than keep a standalone 16s ts-morph walk.
- **package-test-typecheck** protects a genuine topology blind spot. Keep the
  baseline gate on changes to package scripts, tsconfigs, or test trees.
- **instructions-drift** is already an ideal gate: zero-cost and changed-file
  scoped by Lefthook. No catch history is required to justify such a cheap
  single-source invariant.

### 6. Goal/packet governance — scope all four to packet changes

Reflection lint has strong direct evidence: it correctly blocked closeouts that
lacked the artifact (`goals/beep-schema-topology/history/reflections/2026-07-11-claude.md:52-58`,
`goals/canvas/history/reflections/2026-07-11-claude.md:80-87`). Goals doctor and
index also caught invalid lifecycle vocabulary and stale generated index state
after package tests passed (`goals/yeet-publish-preflight/history/reflections/2026-07-14-claude.md:59-68`,
`goals/box-typecheck-cost/history/reflections/2026-08-01-claude.md:75-82`). These
are valuable packet gates but wasteful on ordinary code-only PRs. Trigger
reflection-artifacts, roadmap-refs, doctor, and index-check only when
`goals/**`, `explorations/**`, or relevant roadmap files change. Roadmap-refs is
the weakest evidenced of the four; retain it for one observation window and
delete it if it produces no organic catches.

### 7. Schema-first family — keep the enforced detector, be honest about the rest

The actual required battery contains only `lint schema-first`; schema-catalog,
schema-topology, and tooling-schema-first are registered CLI commands but are
absent from `rootRepoLintPolicySteps` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1292-1320`,
`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:600-615`). This audit
confirmed why that distinction matters:

- `schema-first` is green and has real catch evidence, including an exported
  pure-data alias in P0 (`goals/one-round-loop/history/p0-parity-evidence.md:208-218`).
  Preserve its baseline, but switch to stable symbol keys and changed-export
  scanning; line-keyed exceptions have re-red after unrelated edits
  (`goals/standards-remediation/history/reflections/2026-07-08-claude.md:43-54`).
- `schema-catalog` currently reports the tracked generated catalog stale. That
  is consistent with the policy that whole-repo snapshots are refreshed only
  in dedicated chore PRs, not feature branches
  (`standards/generated-artifacts.policy.md:1-27`). Keep it on-demand.
- `schema-topology` is cheap and green, but has no found catch incident. Trigger
  it only on schema/root-alias topology changes if promoted.
- `tooling-schema-first` currently reports 148 findings. A permanently red
  diagnostic cannot be a meaningful gate. Delete it or establish a reviewed
  ratchet; do not pretend it belongs to the green battery.

### 8. General lint/doc gates — cut the broad scans and one duplicate

- **deprecated-apis** is tonight's largest individual policy cost at 161.7s.
  Its recorded failure history includes scanner/config friction and temporary
  file races (`goals/quality-gate-ratchets/history/gate-proofs.md:33-46`). Scan
  changed TS/TSX and affected packages, not every app/package shard.
- **lint:jsdoc** has strong catch evidence: one package integration surfaced 41
  warnings (`goals/lint-toolchain-modernization/history/reflections/2026-06-21-claude.md:34-35`).
  Scope it to changed exported source/packages.
- **jsdoc-module-tags** is cheap but unevidenced. Fold its one rule into the
  changed-file JSDoc pass rather than preserve a standalone subprocess.
- **lint:docgen** should be removed from lint-policy because Docgen is already a
  separate required hosted context (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:397-404`).
  Keep standalone Docgen; remove the duplicate orchestration slot.
- **circular** should run only when tooling imports change. No organic catch was
  found, but the rule is distinct and its focused graph is inexpensive.
- **typos** and mandatory-only **oxlint** both stay. Typos has a real five-site
  catch (`goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md:156-159`),
  and Oxlint already suppresses advisory backlog by design
  (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1317-1319`).

### 9. Repo Sanity and standalone ratchets

- **syncpack** should stay: effectively free and implicated in tonight's
  dependency-pin repair across syncpack/Knip/Fallow
  (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:68-76`).
- **Sherif** should keep errors blocking and warnings advisory. The current root
  dependency warning does not fail the command, which is already the correct
  posture.
- **Knip** is load-bearing and well evidenced. A real integration introduced
  five findings; the team fixed all five without growing the baseline
  (`goals/quality-gate-ratchets/history/gate-proofs.md:20-31`). Keep it.
- **codegen drift** is cheap and has a valid two-way fixture proof: the drift
  marker failed locally/CI after regeneration (`goals/one-round-loop/history/p0-parity-evidence.md:111-122`,
  `goals/one-round-loop/history/p0-parity-evidence.md:155-173`). Path-gate it to
  generator inputs/outputs and the desktop migration source.
- **JSDoc ratchet** is valuable but overbroad. Hosted data shows 0 failures in
  88 runs at p50 289s (`goals/quality-speedup/research/quality-time-inventory.md:56-71`).
  It does not feed Docgen: CI first creates a temporary JSDoc inventory and
  then passes that inventory to the ratchet
  (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:829-846`). It is
  load-bearing for the JSDoc totals ledger/report, not for Docgen compilation.
  Preserve cleanup-on-touch (already changed-file aware at
  `JSDocRatchet.ts:490-518`), compute affected barrel-export inventory on PRs,
  and run the full census on main/nightly.
- **coverage regression** is the highest-cost/failure-rate gate: hosted p50
  692s, p95 828s, ~25% failure
  (`goals/quality-speedup/research/quality-time-inventory.md:56-66`). It has a
  valid synthetic fail/pass proof (`goals/quality-gate-ratchets/history/gate-proofs.md:8-13`),
  but the P0 dogfood also found a pre-existing runtime/environment failure
  rather than a coverage regression
  (`goals/one-round-loop/history/p0-parity-evidence.md:234-249`). Keep the
  fail-on-drop comparison; limit PR execution to directly changed packages and
  move the full baseline sweep to main/nightly.

## Recommended follow-up PR order

1. Change-scope `dual-arity`, `terse-effect`, `effect-fn`, `effect-imports`,
   `native-runtime`, schema-first, deprecated-apis, JSDoc, cspell, and the
   packet-only gates. Delete the empty dual-arity inventory/write step.
2. Remove `lint:docgen` from lint-policy while retaining the standalone Docgen
   required context; fold `jsdoc-module-tags` into the changed-file JSDoc pass.
3. Path-gate codegen and narrow coverage/JSDoc-ratchet PR scope; keep full
   main/nightly censuses.
4. Delete or baseline the currently red `tooling-schema-first` diagnostic; keep
   schema-catalog as a dedicated refresh command.
5. Instrument per-step outcomes/catches for 50 PRs. Gates recommended only by
   invariant logic and with **no catch evidence**—frozen-grant-set,
   package-test-imports, roadmap-refs, schema-topology, jsdoc-module-tags, and
   circular—should be revisited with actual observed candidate/catch counts.

This sequence removes repeated whole-tree work without discarding the gates
with demonstrated catches or the artifacts consumed by another enforcement
surface.
