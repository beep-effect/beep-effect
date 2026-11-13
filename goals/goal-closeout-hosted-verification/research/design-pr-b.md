# Design: PR B, final-check coverage measures only goal-data readers

This is the implementation contract for ruling D-cov,
`decisions/2026-11-13-final-check-coverage-runs-only-packages-whose-tests-read-goals.md`, and for
the orchestrator's PR B rulings, `decisions/2026-11-13-pr-b-coverage-planner-rulings.md` (C1 to
C3). Implementation happens in worktree `beep-effect-worktrees/final-check-coverage-scope`, on
branch `fix/final-check-coverage-goal-readers`.

**Revision 2026-11-12.** Two critic passes found one blocker (a packet manifest under a registry
prefix selected `@beep/law-practice-server`) and four smaller defects. Every fix is applied below,
together with the orchestrator's rulings on the open points:

- C1, C2 and C3 are confirmed. C1 is enforced inside the planner: `goalDataConsumerNamesForFile`
  returns `[]` for any `CiGoalDocument` path. C2 and C3 mean registry paths run their real readers,
  and the cost shift is accepted.
- The hosted change for code-plus-manifest PRs is recorded in C1's decision file, with a reversal.
- No extra manifest-suite step is added, either local-only or hosted.
- Root goals files that are outside the registry stay out of scope.
- The implementer does not publish. The orchestrator runs `yeet open`, then a scoped local
  `yeet final-check` with `--skip coverage=<reason>`, and names that skip in the PR body.
- Decision files are recorded by the orchestrator, not by the implementer. C1 to C3 are already
  recorded together in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`, and `SPEC.md`'s
  PR B scope paragraph (`SPEC.md:77-83`) already matches this design. Only C4 and C5 still need
  files (§10).

Every `file:line` citation is against this worktree at base `7a462a27d4f`. Three read-only probes
ran, each under 30 s:

1. `planCoverageAffectedScope` with the live `workspaceCoverageScopeOwners`, printing the
   measurability of every `ciGoalDataConsumers` consumer (`bun -e` from
   `packages/tooling/tool/cli`).
2. Every tracked `goals/` and `explorations/` path (19,786 of them) against both
   `S.is(CiGoalDocument)` and the registry patterns. 1,257 paths match a registry row, and exactly
   one of them is a `CiGoalDocument` (§1, item 5).
3. A re-implementation of the census scan (`goal-data-consumer-census.test.ts:40-198`, with its
   exclusions and `CLASSIFIER_TABLES`, and globs translated to plain regexes) checked against the
   two invariants in step 3, items 12 and 13. It found 1,498 non-excluded entries and no violation
   of either invariant. The only entries whose path is a `CiGoalDocument` are two law-practice
   template reads that resolve to the citation manifest (§1, item 5). The probe is an
   approximation. The census test is the authority.

No test, coverage or final-check suite ran.

## 1. Root cause, re-verified

The cause is one hand-written row in the coverage planner's fixture table. CI already shares that
planner, so the root cause sits in a **global input shared with hosted CI**, and the fix belongs at
that level.

| Claim from `map-coverage.md` | Verified at | Result |
| --- | --- | --- |
| A `goals/*/ops/manifest.json` row selects `@beep/repo-cli` | `CoverageScope.ts:114` | yes |
| A runner-burst prefix row selects `@beep/repo-cli` | `CoverageScope.ts:148` | yes |
| Fixture rows are matched before the `goals/` noop prefix | `CoverageScope.ts:792-802` (fixtures at :792, noop at :800) and `:70` | yes |
| Fixture owners never seed dependents | `CoverageScope.ts:832-837` | yes |
| An unmeasurable fixture owner forces a full fallback | `CoverageScope.ts:792-797` | yes. This matters for step 2. |
| The local coverage gate is `TURBO_SCM_BASE=<merge-base> bun run coverage --affected` | `FinalCheck.ts:352-360` | yes |
| `--affected` is stripped and the planner picks the `--filter`s | `Tasks.ts:975-978`, `:1093-1111` | yes |
| repo-cli weighs 1191.7 s against a 300 s single-run budget, so it goes to the sharded executor | `CoverageScope.ts:332`, `Tasks.ts:242`, `:4636-4648` | yes |
| A noop exits early with no ratchet | `Tasks.ts:4895-4898` | yes. The log line is at `:4896`. |
| Hosted uses the same planner | `CiCoverage.ts:406-413` → `Tasks.ts:1304-1310` → `resolveCoverageTaskOptions` (`Tasks.ts:1035`) | yes |
| Hosted Test Unit is Turbo affected ∪ planner owners minus labs | `CiLane.ts:2565-2580` | yes. Only `test-unit` is instrumented (`CiLane.ts:2696`). |
| Docs-only hosted runs skip Test Unit, Labs and Coverage Regression | `check.yml:751`, `:404`, `:1108` | yes |

Live probe today: #3101's five paths give `selected [@beep/repo-cli]`, and a manifest alone gives
the same. Every registry consumer is a live owner with a `coverage` script, so none would trip the
full fallback at `CoverageScope.ts:797`. The consumers are `@beep/law-practice-server`,
`@beep/eyecite`, `@beep/semantica`, `@beep/ciops`, `@beep/ontology` and `@beep/repo-cli`.

**Corrections and additions to the map**

1. **Labs.** Hosted does measure lab consumers. The Labs job runs `--coverage-only` even when lab
   checks are path-gated off (`check.yml:435-445`, `:499-503`). Coverage Regression `needs` the
   Labs artifact (`check.yml:1107`, `:1228-1231`). Keeping labs in the selection therefore
   matches hosted, and the map's open question 2 goes away.
2. **Final-check's changed files are not the planner's.** final-check builds `changedFiles` with
   `diffFilter: "d"`, which drops deleted paths (`FinalCheck.ts:1163-1166`). The planner uses
   `collectChangedFiles`, which keeps both sides of the diff plus dirty files
   (`ChangedFiles.ts:193-211`). A final-check short-circuit must therefore call the planner's own
   collection, never reuse final-check's list.
3. **Census trap.** A new test that names real registry paths as bare literals would itself be
   scanned as a goals reader (`goal-data-consumer-census.test.ts:53-58`, `:147-158`). The new
   test file has to join `CLASSIFIER_TABLES` (`goal-data-consumer-census.test.ts:63-66`). It must
   also avoid the three `READ_SHAPES` (`:48-52`): no `../goals/…` relative path, no
   `${root}/goals/…` template and no `$TURBO_ROOT$`. `CLASSIFIER_TABLES` only switches off the
   bare-literal scan.
4. **Turbo.** Turbo affected-selection uses task inputs (`turbo.json:5`,
   `affectedUsingTaskInputs`). Only `packages/tooling/tool/cli/turbo.json` declares
   `$TURBO_ROOT$/goals/…` inputs. They are the same four files repeated at `:9-12`, `:34-37` and
   `:59-62`, and none of them is a packet document. Root `turbo.json` names goal paths only in
   `//#` policy tasks:
   - `knowledge:semantic-delta` (`:5618`) and `knowledge:refs-check` (`:5639`);
   - `lint:effect-imports` (`:5724`);
   - `goals:doctor` (`:5868-5870`) and `goals:index-check` (`:6567-6570`);
   - `lint:roadmap-refs` (`:5877`) and `lint:reflection-artifacts` (`:6579`);
   - the `lint:typos` negations (`:5900-5920`).

   The `test` (`:5332`) and `coverage` (`:5439`) tasks name none.
5. **A packet manifest can sit under a registry prefix.** The citation-ops row is the bare prefix
   `^goals/citation-extraction-engine/ops/` (`CiOperational.schemas.ts:144`), so it matches that
   packet's `ops/manifest.json`. Probe 2 finds exactly one tracked path that is both a
   `CiGoalDocument` and a registry match: `goals/citation-extraction-engine/ops/manifest.json`.
   Without a guard, a manifest-only edit to that packet would select `@beep/law-practice-server`,
   which carries a 2679.9 s weight. No law-practice test reads that file. Most readers name one
   ops file each, as at `CitationHtmlBytes.test.ts:67`. The two template reads,
   `CitationNativeRendering.fixtures.ts:32` and `CitationRegexCharacters.test.ts:154`, take
   `${name}` and `${file}` from closed sets of `.py` names (`:26` and `:149-151`). The census
   still records a manifest entry for each template read, because `literalPrefix`
   (`goal-data-consumer-census.test.ts:129`) cuts a template down to its `ops/` directory, and
   `resolveReference` then returns every tracked file under it, the manifest included (probe 3).
   That entry is why the registry row needs its prefix (§5). The same prefix also puts the
   manifest on the hosted code route (`codeRoots`, `CiOperational.schemas.ts:261`).
6. **Do not exempt Markdown wholesale.** `ci-runner-security.test.ts:1540-1547` reads
   `goals/speed-loop/ops/runner-burst/README.md` and asserts its text. That file is not a
   `CiGoalDocument`, because the pattern only matches packet-root prose. The runner-burst
   registry row must keep selecting `@beep/repo-cli` for it.
7. **Registry edits are already global coverage inputs.** `packages/tooling/tool/cli/src/commands/Ci/`
   is a full-fallback prefix (`CoverageScope.ts:56`). A future edit to `CiOperational.schemas.ts`
   therefore runs full coverage, and PR B does not have to make it one.
8. **Hosted Repo Sanity on goals-only PRs.** On a goals-only profile Repo Sanity runs only the
   private home-path law (`check.yml:237-249`). Doctor and the ops-typecheck lane run on hosted
   only when a PR also touches code. Locally, final-check's `cheap-gates` runs them
   (`FinalCheck.ts:301-306`).

## 2. Where the fix sits, and what it changes on hosted CI

The fix is a single change to the shared planner's owner tables in `CoverageScope.ts`. The set of
packages "whose tests read `goals/`" becomes exactly the consumers in the census-enforced ROUT-03
registry `ciGoalDataConsumers` (`CiOperational.schemas.ts:142-237`), with one exception: a path
that matches `CiGoalDocument` (`CiOperational.schemas.ts:327`) selects nothing (C1). The
hand-written `goals/` fixture rows are deleted. `CiOperational.schemas.ts` itself is **not**
edited, so `codeRoots`, the docs-only classifier and the `ci patterns` projection stay
byte-identical (`CiOperational.schemas.ts:252-261`).

On hosted CI, docs-only classification never changes. Only non-docs-only PRs reach the planner:

| PR shape | Hosted today | Hosted after PR B |
| --- | --- | --- |
| Goals-only, docs-only (prose, manifests, unregistered packet data) | Test Unit `[]`; Labs and Coverage Regression skipped | unchanged |
| The citation packet's `ops/manifest.json`, alone or with prose | code route through `codeRoots`; the manifest row selects repo-cli | code route; the planner gives noop because `CiGoalDocument` wins over the citation prefix, so Test Unit is `[]` |
| Code plus a manifest edit | the manifest row adds repo-cli to Test Unit, Coverage Regression scope, self-judge exclusions (`CoverageRegression.ts:2438`) and scoped baseline-write adoption (`:2195`). repo-cli's manifest suites therefore run. | the manifest adds nothing; the code paths select as before. repo-cli's manifest suites run only when repo-cli is selected for another reason (R1, recorded in C1). |
| A registry path, such as citation `ops/` scripts, the frozen profile, the semantica report or `goals/*/ops/**/*.ts` | code route, but the planner gives noop, so Test Unit runs only the Turbo-declared repo-cli rows. An ops `.ts` edit runs nothing (`map-coverage.md` §4.1). | the planner selects the row's consumers, and Test Unit, Labs and Coverage Regression run them. This closes the ROUT-03 gap (C3). |
| An exploration registry path (ciops ABox, run4-fleet, ontology `manifest.jsonl`) | code route, planner noop (`explorations/` prefix, `CoverageScope.ts:70`) | consumers selected, as in the previous row |
| Main push | full partitions (`check.yml:748`) | unchanged |

## 3. Calls made in this design

The orchestrator confirmed all five. §10 holds their decision text and shows which ones are
already recorded (C1 to C3, in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`).

- **C1. Packet documents are not goal data, even under a registry row.** A `CiGoalDocument` path
  selects no coverage owner. That covers packet-root prose, `ops/manifest.json` and history or
  research `.gitkeep`. The registry already treats manifests this way on purpose: its census
  excludes the manifest glob as a packet document (`goal-data-consumer-census.test.ts:77-85`). The
  ruling's evidence, #3101 at 46 min, only makes sense if a manifest edit selects nothing.
  - The guard lives in the planner, not in the registry regex (§5). That leaves the classifier,
    `codeRoots` and the census byte-identical.
  - Manifest validity stays with `goals:doctor` and `goals:index-check`: in cheap-gates locally,
    and in Repo Sanity on hosted PRs that also touch code. R1 names what neither of them checks.
  - The hosted change for code-plus-manifest PRs, which the ruling does not cover, is recorded in
    C1's decision file with its reversal.
- **C2. One registry, all rows.** Exploration rows and lab consumers come along. Splitting the
  registry would leave those readers with the same gap, and hosted already measures labs (§1,
  item 1).
- **C3. The cost shift follows the ruling.** A registry-path edit now runs its consumers'
  coverage locally and on hosted CI. For citation ops and the frozen profile that means
  law-practice-server, weighted 2679.9 s (`CoverageScope.ts:267`). For any
  `goals/*/ops/**/*.ts` edit it means repo-cli, weighted 1191.7 s.
- **C4. The receipt records the reason.** final-check plans coverage in-process with the same
  function the subprocess uses. On `noop` it records a `passed` step with reason
  `no affected packages` and spawns nothing.
  - This mirrors the in-process probe `resolveFullLintPolicySweeps` (`FinalCheck.ts:367-377`) and
    the reuse branch's `passed`+`reason` shape (`FinalCheck.ts:803-817`).
  - The step is `passed`, not `skipped`, because `yeet ready` requires every skipped gate to be
    named in the PR body (`ReadyGate.ts:1236-1250`).
- **C5. Skips win.** Any skip decides before the noop branch, and the probe runs only when no skip
  applies. That covers an operator `--skip`, a compute-profile deferral and a route skip, which
  is everything `skipFor` returns (`FinalCheck.ts:951-959`).

Orchestrator rulings on the remaining open points:

- **No extra manifest-suite step.** final-check, cheap-gates and Repo Sanity gain no targeted run
  of the three manifest-reading repo-cli suites. R1 records the loss.
- **Root goals files stay out of scope.** These are `goals/tsconfig.ops.json` and
  `goals/*.baseline.jsonc`. Both local and hosted plan nothing for them today, and PR B does not
  change that. Registering them is a separate census change.

## 4. Ordered steps

### Step 1: factor the affected-scope resolution (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`)

- Move `Tasks.ts:1069-1093` into an exported `resolveAffectedCoverageScope(repoRoot: string,
  base: string)`.
  - It keeps the `collectChangedFiles(repoRoot, base, "HEAD")` call with its error mapping, and
    the baseline row delta with its log line.
  - It returns `planWorkspaceCoverageAffectedScope(...)`, a `CoverageAffectedScope`
    (`CoverageScope.ts:572-585`).
  - It is an `Effect.fn("QualityTasks.resolveAffectedCoverageScope")`. Its return type is
    `Effect.fn.Return<CoverageAffectedScope, QualityTaskConfigurationError, QualityTaskEnvironment>`.
  - Its JSDoc follows the house shape: `**Details**` prose plus a titled `**Example**`, then
    `@category utilities` and `@since 0.0.0`, like `resolveCiCoverageArtifactPlan`
    (`Tasks.ts:1293-1303`). No `@example` or `@remarks` tags.
  - `QualityTaskEnvironment` (`Tasks.ts:264-270`) stays a local alias. Its six services are the
    exact requirement set of `runYeetFinalCheck` (`FinalCheck.ts:1141-1149`), so step 4 adds no
    new requirement.
- `resolveCoverageTaskOptions` keeps base resolution (`Tasks.ts:1059-1068`) and calls the helper
  at the old `:1093` site. Behaviour is unchanged.
- Reword the noop line at `Tasks.ts:4896` to
  `[beep-cli] coverage:affected: no affected packages (no coverage-bearing inputs changed)`.
  A repository-wide `rg` finds no test or workflow that parses the old text. The only other hits
  are a historical line in `goals/ship-velocity/research/OPPORTUNITIES.md` and these research
  files.

### Step 2: derive goal-data owners from the registry (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts`)

- Import `CiGoalDocument` and `ciGoalDataConsumers` from `../../Ci/CiOperational.schemas.ts`.
  - That module is a leaf: it imports only identity, schema, `effect/Array` and `effect/Schema`
    (`CiOperational.schemas.ts:8-11`).
  - `Tasks.ts:68` already imports from it, so the Quality → Ci edge exists and no cycle is
    added.
  - In this file, `A` and `Str` come from `@beep/utils` (`CoverageScope.ts:11`) and `S` from
    `effect/Schema` (`:21`).
- Add these internal (not exported) bindings near the fixture tables. They are compiled once at
  module load:

  ```ts
  // ROUT-03 registry (CiOperational.schemas.ts), kept live by goal-data-consumer-census.test.ts:
  // the only goal and exploration paths whose changes select coverage owners. A packet document
  // (CiGoalDocument: packet-root prose, ops/manifest.json, history/research .gitkeep) selects
  // nothing even under a registry prefix such as citation ops/ (C1). Every other packet path
  // stays coverage-inert under COVERAGE_NOOP_PREFIXES.
  const GOAL_DATA_CONSUMER_OWNER_PATTERNS: ReadonlyArray<readonly [RegExp, ReadonlyArray<string>]> = A.map(
    ciGoalDataConsumers,
    (row) => [new RegExp(row.pattern, "u"), row.consumers] as const
  );
  const isGoalDocument = S.is(CiGoalDocument);
  const goalDataConsumerNamesForFile = (filePath: string): ReadonlyArray<string> =>
    isGoalDocument(filePath)
      ? A.empty<string>()
      : A.flatMap(
          A.filter(GOAL_DATA_CONSUMER_OWNER_PATTERNS, ([pattern]) => pattern.test(filePath)),
          ([, consumers]) => consumers
        );
  ```

  - Use the derived `S.is(CiGoalDocument)` guard. `CiGoalDocument` is
    `new RegExp(ciOperationalPatterns.goals, "u")` compiled once at module load
    (`CiOperational.schemas.ts:327`). That is the precompiled pattern the second critic asked for,
    so do not add a second compile of it or a hand-written predicate.
  - The registry regexes carry only the `u` flag, never `g`, so `RegExp.test` is stateless across
    calls.
  - Do not add a `.md` exemption (§1, item 6).
  - Do not tighten any registry regex (§5).
- In `repositoryFixtureOwnerNamesForFile` (`CoverageScope.ts:762-770`), append
  `goalDataConsumerNamesForFile(filePath)` before `A.dedupe`. Three functions read that one
  function, so all three pick the change up without edits: `fullReasonForFile` (`:792-797`),
  `selectedOwnersForFile` (`:815-821`) and `planCoverageSelfJudgeScope` (`:1252-1256`,
  `:1268-1272`).
- Delete `["goals/*/ops/manifest.json", "@beep/repo-cli"]` (`:114`) and
  `["goals/speed-loop/ops/runner-burst/", "@beep/repo-cli"]` (`:148`). The registry row at
  `CiOperational.schemas.ts:197-203` replaces the second with the same prefix and consumer.
- Edit the comment at `CoverageScope.ts:106-109`: drop "goal manifests" from the glob examples,
  and say that goal and exploration readers come from `ciGoalDataConsumers`. Keep the `goals/` and
  `explorations/` noop prefixes (`:70`).

### Step 3: planner tests (new `packages/tooling/tool/cli/test/coverage-scope-goal-readers.test.ts`, census edits)

This file proves that a goals-only diff yields the reduced set. It calls the affected-set function
and never runs coverage.

- It is modelled on `coverage-scope-standards-owners.test.ts:1-60`.
- It imports `planCoverageAffectedScope`, `CoverageScopeOwner` and `workspaceCoverageScopeOwners`
  from `@beep/repo-cli/test/Quality` (barrel `src/test/Quality.test-kit.ts:89`), and
  `ciGoalDataConsumers` and `CiGoalDocument` from `@beep/repo-cli/commands/Ci`.
- It uses no relative path into `src/`.

Pure cases run over synthetic owners: the six registry consumers at their real `packagePath`s,
plus `@beep/b` at `packages/b`, all `hasCoverage: true`.

1. **#3101 is noop.** `planCoverageAffectedScope(owners, PR_3101)` equals `{ _tag: "noop" }`.
   `PR_3101` is #3101's five paths under `goals/alchemy-vault-sync-slice/`
   (`git show --stat cbc647e52e8`): `README.md`, `SPEC.md`, one `decisions/*.md`,
   `ops/manifest.json` and `research/OPPORTUNITIES.md`.
2. **A manifest alone is noop.** `["goals/demo-packet/ops/manifest.json"]` gives noop.
3. **A manifest under a registry prefix is noop.** This is the blocker regression.
   `["goals/citation-extraction-engine/ops/manifest.json"]` gives noop, not
   `@beep/law-practice-server`. So does `goals/citation-extraction-engine/README.md`.
4. **Unregistered packet data is noop.** `goals/demo-packet/ops/data.json`,
   `goals/demo-packet/research/x.json`, `goals/demo-packet/history/evidence/y.json` and
   `goals/demo-packet/ops/run.sh` each give noop.
5. **Every registry row selects exactly its readers.** A `SAMPLES` record maps each row's
   `pattern` to one sample path.
   - Completeness comes first: `A.sort(R.keys(SAMPLES), Order.String)` equals
     `A.sort(A.map(ciGoalDataConsumers, (row) => row.pattern), Order.String)`, so adding a
     registry row without a sample fails the test. Effect v4 `Array.sort` takes an `Order`
     (`effect/Array.ts:4562`).
   - No sample may be a `CiGoalDocument`. Assert `!S.is(CiGoalDocument)(sample)` for each one.
   - For each sample, the expected value is
     `{ _tag: "selected", packageNames, dependentPackageNames: [] }`, where `packageNames` is
     `A.sort(A.dedupe(<consumers of every row whose pattern matches the sample>), Order.String)`.
     That is the planner's own order (`CoverageScope.ts:1037-1041`).
   - Use a `.py` sample for citation ops, so that it does not also match the ops-`.ts` row.
6. **Markdown read as data still selects.** `["goals/speed-loop/ops/runner-burst/README.md"]`
   selects `@beep/repo-cli` (§1, item 6). This keeps a later `.md` exemption from passing.
7. **Mixed diff.** `["packages/b/src/B.ts", "goals/demo-packet/ops/manifest.json"]` selects only
   `@beep/b`.
8. **runner-burst still selects repo-cli.** The existing case at `quality-tasks.test.ts:9059-9074`
   stays unchanged. It now passes through the registry row instead of the deleted prefix.

Live cases use `it.layer(NodeServices.layer)` and owners from
`workspaceCoverageScopeOwners(repoRoot)`:

9. `PR_3101` gives noop against the live workspace, and so does
   `goals/citation-extraction-engine/ops/manifest.json`.
10. Every `ciGoalDataConsumers` consumer is a live owner with `hasCoverage`. Otherwise a registry
    row would force a full fallback at `CoverageScope.ts:797`.

Census edits go in `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`:

11. Add `"packages/tooling/tool/cli/test/coverage-scope-goal-readers.test.ts"` to
    `CLASSIFIER_TABLES` (`:63-66`). Its path literals are classifier inputs, not reads (§1,
    item 3).
12. Add the invariant "every reader package is a consumer of the row matching its path":
    - For each non-excluded census entry, the package that owns `entry.source` must be in the
      union of `row.consumers` over the rows whose pattern matches `entry.path`.
    - The owner is the `name` in the `package.json` of the nearest ancestor directory of
      `entry.source` that has one. For a `turbo.json` source that is its own directory. Do not
      cut the path at the first `/test/`: `TEST_SOURCE` (`:40`) also admits files such as
      `src/test/*.test-kit.ts`, and the directory before their `/test/` has no `package.json`.
    - The failure message names the entry and says to add the package to that row's
      `consumers`.
    - With item 5, this makes "the planner selects every package whose tests read the path" a
      checked fact for every path that is not a `CiGoalDocument`. It is the mechanized half of
      §6.
13. Add the invariant "no package `turbo.json` goal input is a packet document": no non-excluded
    entry whose `source` matches `PACKAGE_TURBO` (`:43`) has a `path` that satisfies
    `S.is(CiGoalDocument)`. Turbo would select such a package on a manifest edit while the
    planner selects nothing, which would make hosted Test Unit stricter than local (§6, case 3).
    The four live inputs pass it.

Probe 3 runs both invariants over the live tree. Of 1,498 entries, it finds no reader package
outside its row's consumers and no `turbo.json` packet-document input. The two packet-document
entries, the citation manifest from the law-practice template reads, pass item 12 because the
citation-ops row lists `@beep/law-practice-server`. The census test itself must confirm all of
this (§7).

### Step 3b: direct tests for the factored helper (`packages/tooling/tool/cli/test/quality-tasks.test.ts`)

`resolveAffectedCoverageScope` is a new export, so it needs direct cases for the coverage
ratchet. Add them beside "emits an explicit empty plan for an unchanged affected checkout"
(`quality-tasks.test.ts:1240-1249`), reusing `coverageArtifactPlanRepository()` (`:794-825`) and
`runGit`:

1. An unchanged checkout against `HEAD` gives `{ _tag: "noop" }`.
2. Tag the fixture commit. Commit a new `goals/coverage-scope-fixture/ops/manifest.json` and a
   `goals/coverage-scope-fixture/README.md`, then resolve against the tag: `noop`. The slug must
   never exist in the real tree, so the census resolves nothing for it.
3. Commit `packages/covered/src/index.ts` on top and resolve against the tag:
   `selected ["@beep/covered"]` with no dependents.

### Step 4: final-check records `no affected packages` (`packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts`)

- Imports:
  - `resolveAffectedCoverageScope` from `../../Quality/Tasks.ts`. `FinalCheck.ts:62` already
    imports from that module.
  - `type CoverageAffectedScope` from `../../Quality/internal/CoverageScope.ts`.
  - `* as Match from "effect/Match"`.
- Add `readonly coverageScope?: CoverageAffectedScope` to `FinalCheckRun` (`:922-930`). It is
  optional, so existing test literals still type-check.
- Add `const FINAL_CHECK_COVERAGE_NOOP_REASON = "no affected packages"`.
- Add the probe with the same shape as `resolveFullLintPolicySweeps` (`:367-377`):

  ```ts
  // Same planner, base and changed-file collection as the coverage subprocess (Tasks.ts), so a
  // noop here is the subprocess's noop. Never pass final-check's own changedFiles: they drop
  // deletions. A failed probe leaves the subprocess to plan for itself.
  const resolveFinalCheckCoverageScope = Effect.fn("Yeet.resolveFinalCheckCoverageScope")(
    function* (repoRoot: string, base: string) {
      return O.some(yield* resolveAffectedCoverageScope(repoRoot, base));
    },
    Effect.catch((error) =>
      Console.log(
        `[yeet] final-check coverage: scope probe unavailable; the coverage step plans for itself (${error.message})`
      ).pipe(Effect.as(O.none<CoverageAffectedScope>()))
    )
  );
  ```

- In `runYeetFinalCheck`, rename the literal at `:1178-1190` to `plannedRun`. Then derive the run
  from it:

  ```ts
  const coverageScope =
    A.contains(gates, "coverage") && O.isNone(skipFor(plannedRun, "coverage"))
      ? yield* resolveFinalCheckCoverageScope(repoRoot, mergeBase)
      : O.none<CoverageAffectedScope>();
  const run: FinalCheckRun = O.match(coverageScope, {
    onNone: () => plannedRun,
    onSome: (scope) => ({ ...plannedRun, coverageScope: scope }),
  });
  ```

  - `exactOptionalPropertyTypes` is on (`tsconfig.base.json:30`), so never assign
    `coverageScope: undefined`. Leave the key out when there is no scope, as above.
  - The guard is `skipFor`, not only `skips`. A route skip is not in `skips`, and C5 requires it
    to win.
  - The probe runs before the `dryRun` return at `:1192`, so `--dry-run` reports the same plan.
- In `runGate` (`:972-991`), replace the `onNone` ternary with a `Match` over the gate (Code Laws:
  match helpers over conditional chains). The arms:
  - `"expectation-rewrite"`: unchanged.
  - The gate is `"coverage"` and `run.coverageScope?._tag === "noop"`: return
    `{ steps: A.map(plannedFor(run, "coverage"), noopCoverageStep), verdicts: [], shadowMisses: [] }`
    and spawn nothing. The step is
    `FinalCheckStepResult.make({ gate: entry.gate, label: entry.step.label, hostedContext: entry.hostedContext, command: renderCommand(entry.step), status: "passed", durationMs: 0, reason: FINAL_CHECK_COVERAGE_NOOP_REASON })`.
    `reason` is already an optional key (`FinalCheck.schemas.ts:121`).
  - Otherwise: `Effect.forEach(plannedFor(run, gate), runner.execute)`, as today.
  - The skip check in `onSome` stays first, which is C5.
  - The noop arm deliberately skips `runner.execute`. It writes no lane proof
    (`FinalCheck.ts:820-828`) and calls no `invalidate`, because it spawns nothing and moves no
    tree. A `--resume` run probes again, which costs less than a proof lookup.
  - A `shadow-skipped` route gate is not a skip (`skipFor` matches only `decision: "skipped"`), so
    it reaches the noop arm. A noop result passes and records no shadow miss
    (`FinalCheck.ts:1036-1040`).
- In `printGatePlan` (`:961-970`), add the same arm with a `Match`. It prints
  `  coverage: no affected packages (planner noop); nothing runs`.
- Leave every other scope untouched. `selected` and `full` run `bun run coverage --affected`
  exactly as now, and it re-plans with the same function.

### Step 5: final-check tests (`packages/tooling/tool/cli/test/yeet-final-check.test.ts`)

Add these beside the "gate execution and shadow sentinel" layer (`:846`), reusing the
`routedGateRun` pattern (`:810-842`) through `runFinalCheckGatesForTesting`. The planned step is
`gate: "coverage"` with `sh -c 'echo ran > ran; exit 1'`. Build the scopes with
`CoverageNoopScope.make({})` and `CoverageSelectedScope.make(...)` from
`@beep/repo-cli/test/Quality`.

1. A noop scope gives a `passed` step with reason `no affected packages`, `durationMs` 0, and no
   `${root}/ran` file.
2. `CoverageSelectedScope.make({ packageNames: ["@beep/b"], dependentPackageNames: [] })` runs
   the step: it is `failed`, and `ran` exists.
3. A noop scope with `skips: [{ gate: "coverage", reason: "x" }]` gives a `skipped` step with
   reason `x`, and `ran` does not exist. The operator skip wins.
4. A noop scope with a route whose `coverage` gate is `decision: "skipped"` gives a `skipped`
   step with the route's reason, and `ran` does not exist. The route skip wins (C5).
   - Build the route with `FinalCheckRoute.make` (class at `FinalCheck.schemas.ts:325`; example
     at `:320`), using `atomsByKind: R.map(ChangeAtomKind.Enum, () => 0)`.
   - Build the gate with `FinalCheckRouteGate.make` (class at `:296`), for example
     `{ gate: "coverage", lane: "none", decision: "skipped", refinements: [], reason: "route:test" }`.

### Step 6: docs (`.claude/skills/yeet/references/gates-and-proof.md`)

After the gate table (`:98-108`), add two sentences:

- Coverage selects owners through the shared planner. A goal or exploration path selects only its
  `ciGoalDataConsumers` readers, and a packet document (prose, `ops/manifest.json`, `.gitkeep`)
  selects none.
- When nothing is selected, the receipt's coverage step passes with reason
  `no affected packages` and nothing runs.

No changeset is needed: `@beep/repo-cli` is ignored by changesets (`.changeset/config.json:13`).

### Step 7: verify (implementer) and publish (orchestrator)

**Precondition, orchestrator, before dispatching the implementer.** `bun run check` in repo-cli is
`tsrs -p tsconfig.check.json` over project references (`packages/tooling/tool/cli/package.json:187`).
It means nothing until the dependency `dist/` outputs exist. A lane cut fresh from `7a462a27d4f`
has none: `packages/tooling/library/repo-cli-kit/dist` is absent in this packet's own worktree.
In that state the check reports thousands of TS6305 errors ("Output file … has not been built
from source") plus cascades, which the previous design pass hit here.

- Build repo-cli's dependency closure in the PR B lane first:
  `bun x turbo run build --filter=@beep/repo-cli^...` from the lane root, which is mostly
  turbo-cache hits.
- This is the same `check:build-closure` step that `package-verify --quick` runs before
  `beep:check` (`PackageVerify.ts:637-646`). It is the orchestrator's step because it fans out
  past the package, and implementer agents may not run a fan-out.
- Vitest needs no build. Test imports resolve to `src` through the package `exports`
  (`package.json:30`, `:81`, `:83`), so the single test files below run either way.
- If the implementer still sees TS6305, it attributes the result as environment-only, reports it,
  and never edits source to quiet it.

**Implementer, lane `final-check-coverage-scope`.** Run each file on its own from
`packages/tooling/tool/cli`, then the package check:

```sh
bunx --bun vitest run test/coverage-scope-goal-readers.test.ts
bunx --bun vitest run test/goal-data-consumer-census.test.ts
bunx --bun vitest run test/yeet-final-check.test.ts
bunx --bun vitest run test/quality-tasks.test.ts -t "coverage"
bun run check
```

The implementer does not commit, push, run `yeet final-check`, `yeet publish`, `bun run coverage`
or the full repo-cli suite. The tree is left dirty for the orchestrator.

**Orchestrator.**

- Run `bun run beep quality package-verify @beep/repo-cli --quick`, which rebuilds the closure
  itself. Then merge `origin/main` (R4), commit, and run `bun run beep yeet open --body-file <md>`.
- PR B edits `Tasks.ts` and `CoverageScope.ts`, both global coverage inputs
  (`CoverageScope.ts:33-59`: `Tasks.ts` at `:41`, the `Quality/internal/Coverage` prefix at `:57`).
  Its own local coverage would fall back to the full workspace.
- Run the scoped local final-check on the content-final head with
  `--skip coverage="global coverage input changed; hosted full Test Unit + Coverage Regression prove it"`,
  then `yeet ready`.
- The PR body names that skip, states the §2 hosted behaviour table including the
  code-plus-manifest change, and gives the §9 reversal.

### Step 8: record the calls (orchestrator)

C1 to C3 are already recorded in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`. That
file says plainly that C4 and C5 stay with this step, and `SPEC.md:77-83` already lists PR B's
final file scope. What remains:

- Add C4 and C5 from §10 with `bun run beep goals decisions add goal-closeout-hosted-verification`.
- Apply the optional C1 amendment in §10, if the orchestrator takes it.

Do not add separate C1 to C3 files, which would duplicate the ruling. The packet is still
untracked here, so these files ride this goal's PR, not PR B.

## 5. Why this shape and not the alternatives

| Alternative | Rejected because |
| --- | --- |
| Pre-filter only in final-check | It forks local planning from hosted planning. It keeps the manifest row on hosted mixed diffs and leaves the §2 registry gap open. |
| A route refinement that drops `packet` from the coverage lane (`RouteFootprints.ts:141`) | The route has no package grain. It would skip the whole gate, recorded as `skipped`, which `yeet ready` makes the PR body name. |
| Register manifests in the registry | Every goal PR edits its manifest, so every goal PR would run repo-cli coverage, hosted too. That is the opposite of the ruling. |
| Tighten the citation-ops regex to exclude `manifest.json` | The manifest would leave `codeRoots` and turn docs-only, which changes hosted classification and the `ci patterns` projection. The census entry from law-practice-server's prefix read would then need a new exclusion. The planner guard reaches the same result with `CiOperational.schemas.ts` untouched. |
| Exempt Markdown, or all of `*.md`, from registry matching | `ci-runner-security.test.ts:1540-1547` reads the runner-burst `README.md` as data (§1, item 6). |
| Keep a targeted manifest-suite step (cheap-gates or Repo Sanity) | Ruled out by the orchestrator. The loss is recorded in C1 and R1 instead. |
| Log-only reword, without the in-process probe | The ruling says the gate "records" the reason. A log line is not in the receipt. |

## 6. Proof that hosted CI is not stricter than the new local gate

**Definitions**

- `P(F)` is the planner verdict for changed set `F`. Locally `F` comes from
  `collectChangedFiles(mergeBase…HEAD)` (`Tasks.ts:1069`). On hosted it comes from
  `--base $BEEP_COVERAGE_BASE_SHA` (`check.yml:730`). Both sides call the same function, locally
  through `resolveAffectedCoverageScope` and on hosted through `CiCoverage.ts:412` →
  `Tasks.ts:1309`. Paths that satisfy `CiGoalDocument` add nothing to `P` on either side.
- `L(F)` is the local gate. It runs `P(F)`'s packages under coverage, which executes their tests,
  plus the ratchet over `P(F)`. On noop it does nothing and records a passed step
  (`Tasks.ts:4884-4920`, step 4).
- `H(F)` is hosted for a pull request:
  - Test Unit runs `T(F) ∪ (P(F) \ labs)` (`CiLane.ts:2565-2580`), where `T(F)` is Turbo's
    affected `test` set.
  - Labs runs `P(F) ∩ labs` coverage (`CiCoverage.ts:625`, `check.yml:499-503`).
  - Coverage Regression compares over `P(F)` (`CiCoverage.ts:661-726`).

**Claim.** For every goals-only pull-request diff, and for the goal part of every mixed diff, each
package that `H(F)` tests or measures is also tested and measured by `L(F)`.

**Case analysis**

1. **`F` is docs-only.** Hosted allocates no Test Unit shard and skips Labs and Coverage
   Regression (`check.yml:751`, `:404`, `:1108`), so `H(F) = ∅` ⊆ `L(F)`. #3101 is this case. Its
   checks show `skipping` (`map-coverage.md` §4).
2. **`F` is goals-only but code-route.** That means a registry path, which joins `codeRoots`
   (`CiOperational.schemas.ts:261`), including `goals/citation-extraction-engine/ops/manifest.json`
   under the citation prefix. It can also mean a root goals file such as `goals/tsconfig.ops.json`.
   - The `P(F)` parts of `H(F)` equal `L(F)`'s: they are the same function on the same three-dot
     range. Local measures labs too, while hosted Test Unit drops them and its Labs job adds them
     back. For the citation manifest, `P = ∅` on both sides.
   - **`T(F)` ⊆ `P(F)`.** With `affectedUsingTaskInputs` (`turbo.json:5`), Turbo selects `test`
     for a path only through global inputs or through a package's `test` inputs. The global inputs
     list no `goals/` path (`turbo.json:9-19`).
     - The only package `turbo.json` naming goal paths is repo-cli's, with four files at
       `packages/tooling/tool/cli/turbo.json:9-12`.
     - Each of the four matches a registry row whose consumers include `@beep/repo-cli`
       (`CiOperational.schemas.ts:176-196`), and none is a `CiGoalDocument`, so `P` selects
       repo-cli whenever `T` does.
     - Step 3, items 12 and 13 mechanize both facts. `turbo.json` files are census sources
       (`PACKAGE_TURBO`, `goal-data-consumer-census.test.ts:43`, `:182`). A future `turbo.json`
       goal input whose package is not a row consumer, or that names a packet document, fails the
       census.
   - Root goals files are outside the census (`NAMED_PACKET`,
     `goal-data-consumer-census.test.ts:59`, `:135`). Both `P` and `T` are empty for them today,
     so `H = L = ∅`. Changing that is out of scope by ruling.
3. **`F` is mixed (code plus goals).** `P` is a per-file union (`CoverageScope.ts:1032-1044`).
   - Non-goal files plan exactly as before, the same on both sides.
   - Goal files are covered by cases 1 and 2. The manifest row's removal shrinks both sides
     equally.
   - `T(F)` for non-goal files is not changed by this PR. Item 13 keeps `T` from adding a package
     for a packet document.
   - The hosted loss on these PRs is real but symmetric: repo-cli's manifest suites drop out of
     both `H` and `L` (R1).
4. **Main push.** Hosted runs every partition (`check.yml:748`). That is stricter by design, but
   it is a post-merge proof, not a pull-request gate that final-check replays. A manifest that
   breaks one of the invariants listed in R1 first goes red here.

Other gates are unaffected. Test Integration is not instrumented (`CiLane.ts:2696`), and no other
final-check gate reads `CoverageScope`.

## 7. Evidence to capture

Implementer (lane `final-check-coverage-scope`):

- The new test file passes. That includes the #3101 case, the citation-manifest case, the
  runner-burst README case and the per-row completeness case.
- The census passes with both new invariants. If item 12 fails, add the missing consumer to the
  row in `CiOperational.schemas.ts`. That row change is then a deliberate hosted change: report
  it to the orchestrator for the PR body, and note that it makes the PR's own coverage full
  (§1, item 7).
- `yeet-final-check.test.ts` passes with the four new cases, and `quality-tasks.test.ts -t coverage`
  passes with the three step 3b cases. Their enclosing describe, "CI coverage artifact planning"
  (`quality-tasks.test.ts:1173`), carries the word the `-t` filter matches.
- `bun run check` passes for `@beep/repo-cli` once the step 7 build closure exists. A TS6305-only
  result is reported as environment, not as a pass or a code failure.

Orchestrator (at publish):

- A `bun -e` replay of `planWorkspaceCoverageAffectedScope` on the branch prints `noop` for
  #3101's paths, where today it prints `selected [@beep/repo-cli]`. It also prints `noop` for
  `goals/citation-extraction-engine/ops/manifest.json`.
- `yeet final-check --dry-run` on a goals-only commit prints the noop coverage line.

## 8. Risks

- **R1. repo-cli's manifest-reading suites lose pre-merge runs on hosted code-plus-manifest PRs,
  not only on goals-only diffs.** The suites are `goals-ops-typecheck.test.ts`,
  `goals-manifest-capabilities.test.ts` and `goals-graph.test.ts`.
  - **Today.** Hosted goals-only (docs-only) diffs never ran them. Hosted code-plus-manifest PRs
    ran them, because the manifest row put repo-cli into Test Unit. Locally every manifest edit
    ran them.
  - **After PR B.** They run before merge only when repo-cli is selected for another reason: a
    repo-cli path, a registry path naming repo-cli, or a global input. Otherwise they first run
    on the main push (`check.yml:748`).
  - **What still covers manifests.** Doctor decodes every non-template manifest
    (`Doctor.ts:1072-1100`). It also checks `opsScripts` existence, listing and duplicates
    (`Doctor.ts:699-760`) and the capability findings (`Doctor.ts:155-158`). It runs in local
    cheap-gates and in hosted Repo Sanity on non-goals-only PRs. Repo Sanity's
    `goals-ops-typecheck` lane compiles `goals/tsconfig.ops.json` (`GithubChecks.ts:620-637`).
    `tsconfig.ops.json` inclusion stays covered: an `opsScripts` entry outside `ops/` is
    `ops-script-missing`, and a new `ops/**/*.ts` is a registry path that still selects repo-cli.
  - **What nothing checks before merge** on a manifest edit that does not otherwise select
    repo-cli:
    - The `goals/_template/ops/manifest.json` decode. Doctor skips the template
      (`Inventory.ts:171`), and only `goals-manifest-capabilities.test.ts:154-175` decodes it.
    - Encoding every tracked manifest after decoding it
      (`goals-manifest-capabilities.test.ts:263-277`). Doctor only decodes.
    - Agreement between the capability graph's SQL evaluator and the reference evaluator over
      every live manifest, and `knowledge-surface-automation` still providing `knowledge/doctor`,
      `skills/warehouse`, `goals/graph` and `goals/bootstrap`
      (`goals-graph.test.ts:546-570`).
  - **Ruling.** Accepted, with no extra step. Recorded in C1 with its reversal.
- **R2. Registry-path edits become expensive locally and on hosted.** The local upper bound is
  about 45 min for law-practice-server. The ruling asks for this (C3), but citation-ops-heavy goals
  will feel it.
- **R3. The noop probe must stay byte-equal to the subprocess plan.** It uses the same function,
  the same base and a clean tree (`FinalCheck.ts:1201`, re-checked at `:1204`). The one way to
  break it is passing final-check's own `changedFiles`, which drop deletions. Step 4 forbids it.
- **R4. Collisions.** `Tasks.ts` and `CoverageScope.ts` are hot files for the ten-minute-certainty
  slices. Merge `origin/main` before the final check.
- **R5. Hosted scope on code-plus-manifest PRs shrinks.** A manifest no longer drags repo-cli into
  Test Unit, Coverage Regression's judged rows, the self-judge exclusions
  (`CoverageRegression.ts:2438`) or scoped baseline-write adoption (`:2195`). That removes a source
  of inherited repo-cli ratchet reds and costs the suite runs in R1. Both effects are in C1's
  decision file.
- **R6. The C1 guard hides any future test that really reads a packet document.** Such a reader
  would show up in the census under a registry row. The planner would still select nothing for
  the document, by design. Today no test reads `goals/citation-extraction-engine/ops/manifest.json`
  (§1, item 5). A test that must react to a packet document should read data the registry can
  name instead.
- **R7. A registry consumer without a `coverage` script forces a full fallback**
  (`CoverageScope.ts:797`). Live case 10 guards this. All six consumers have coverage today.

## 9. Reversal

Revert the PR. That restores `CoverageScope.ts:114` and `:148`, drops the registry append and its
`CiGoalDocument` guard, and removes the final-check noop branch. The branch is inert anyway once
the planner stops returning noop for goals paths. The ruling's own reversal wording is "Restore the
previous affected-set computation for goals/ paths". Each call in §10 also has its own narrower
reversal.

## 10. Decisions to record

This design wrote nothing to `SPEC.md`, `PLAN.md` or `decisions/`, which the revise:A lane owns.
While this section was being written, that lane recorded C1 to C3 as one ruling file, and the
status table reflects that:

| Call | Status | Orchestrator action |
| --- | --- | --- |
| C1 | Recorded in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`, including the hosted change on code-plus-manifest PRs and a reversal that restores the manifest row | none required. The optional amendment below names what doctor does not check. |
| C2 | Recorded in the same file | none |
| C3 | Recorded in the same file | none |
| C4 | Not recorded. The ruling file leaves it to step 8. | add a decision file from the text below |
| C5 | Not recorded. The ruling file leaves it to step 8. | add a decision file from the text below |

The C1 to C3 text below is kept as reference wording for the PR body and for reviewers. Do not
add files for C1 to C3, because they would duplicate the ruling. Command shape for C4 and C5
(pass the body through a variable or a here-doc so the backticks survive the shell):

```sh
bun run beep goals decisions add goal-closeout-hosted-verification \
  --title "<title>" --reversal "<reversal>" --body "<body>" \
  --lane feat/goal-closeout-hosted-verification
```

### C1. Goal-packet documents select no coverage owners, even under a goal-data registry row

- **Title:** Goal-packet documents select no coverage owners, even under a goal-data registry row
- **Body:**

  > The coverage planner derives goal-data owners from the ROUT-03 registry
  > `ciGoalDataConsumers`. A path matching `CiGoalDocument` (packet-root prose,
  > `ops/manifest.json`, history/research `.gitkeep`) selects nothing, even under a registry
  > prefix. The hand-written `goals/*/ops/manifest.json` → `@beep/repo-cli` row in
  > `CoverageScope.ts` is deleted.
  >
  > Evidence: #3101's five paths selected repo-cli locally because of that row, and coverage ran
  > 46 minutes. The only tracked path that is both a packet document and a registry match is
  > `goals/citation-extraction-engine/ops/manifest.json`. Without the guard it would select
  > `@beep/law-practice-server` (2679.9 s weight), and no law-practice test reads it. The guard
  > sits in the planner, so `CiOperational.schemas.ts`, the docs-only classifier and the census
  > stay unchanged.
  >
  > Hosted change beyond the D-cov ruling: on a pull request that edits code plus any packet
  > manifest, hosted CI no longer adds `@beep/repo-cli` to Test Unit, Coverage Regression scope,
  > the self-judge exclusions or scoped baseline-write adoption. repo-cli's manifest-reading
  > suites (`goals-ops-typecheck`, the `goals-manifest-capabilities` census, the `goals-graph`
  > evergreen census) then run before merge only when repo-cli is selected for another reason;
  > otherwise they first run on the main push. Goals doctor does not cover the `_template`
  > manifest decode, the encode round-trip of every tracked manifest, or capability-graph
  > evaluator agreement and its named providers. By orchestrator ruling no extra local-only or
  > hosted manifest-suite step is added.
- **Reversal:** Restore `["goals/*/ops/manifest.json", "@beep/repo-cli"]` in
  `COVERAGE_REPOSITORY_FIXTURE_OWNER_FILES`. Hosted code-plus-manifest PRs, and local
  manifest-only diffs, then run repo-cli again. Keep the `CiGoalDocument` guard in
  `goalDataConsumerNamesForFile`.
  - Fixture rows are evaluated beside the registry append (`CoverageScope.ts:762-770`), so the
    restored row alone brings repo-cli back for every manifest.
  - Removing the guard would also make `goals/citation-extraction-engine/ops/manifest.json`
    select `@beep/law-practice-server`, which reads no manifest. That would re-open the blocker,
    not reverse C1.
  - The recorded ruling's reversal, "restore the manifest row in `CoverageScope.ts` (C1)",
    already says this.
- **Status:** recorded in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`.
- **Optional amendment to that file.** Its C1 bullet ends "goals doctor's ops-script and
  capability checks are the only pre-merge cover". To name what that cover misses, as R1 does,
  append this sentence to the bullet:

  > Doctor does not check the `_template` manifest decode, the encode round-trip of every tracked
  > manifest, or capability-graph evaluator agreement and its named providers; those first run on
  > the main push (`research/design-pr-b.md` R1).

  - After editing the decision file, run
    `bun run beep goals decisions write --slug goal-closeout-hosted-verification`. It must print
    `drift_remaining=0`.
  - Stage the regenerated `SPEC.md` in the same commit. Otherwise `goals:doctor` reports a
    blocking `decision-log-drift` in cheap-gates and Repo Sanity.

### C2. Coverage selects every ROUT-03 registry row's readers, exploration and lab rows included

- **Title:** Coverage selects every ROUT-03 registry row's readers, exploration and lab rows
  included
- **Body:**

  > One registry drives coverage selection for goal and exploration paths: every
  > `ciGoalDataConsumers` row, including the exploration rows (ciops ABox and run4-fleet, the
  > ontology `manifest.jsonl`) and the lab consumers `@beep/semantica` and `@beep/ciops`.
  > Splitting the registry would leave those readers with the gap ROUT-03 found. Hosted Labs
  > already runs lab coverage with `--coverage-only` and Coverage Regression needs that
  > artifact, so local and hosted stay at parity. The `goals/speed-loop/ops/runner-burst/`
  > prefix row in `CoverageScope.ts` is deleted because the registry row covers the same prefix
  > and consumer.
- **Reversal:** Filter the registry to `goals/` rows and drop lab consumers inside
  `goalDataConsumerNamesForFile`, and restore the runner-burst prefix row.
- **Status:** recorded in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`.

### C3. A goal-data registry path edit runs its readers' coverage locally and on hosted CI

- **Title:** A goal-data registry path edit runs its readers' coverage locally and on hosted CI
- **Body:**

  > Editing a registry path now selects that row's consumers. Before, the planner gave noop for
  > these paths even though hosted put them on the code route. The cost shift is accepted. Citation
  > ops scripts and the frozen six-form profile run `@beep/law-practice-server` (2679.9 s weight).
  > Any `goals/*/ops/**/*.ts` edit runs `@beep/repo-cli` (1191.7 s). The semantica, ciops and
  > ontology rows run their lab or package owner. This closes the gap ROUT-03 left, where
  > code-route goal paths ran none of their readers.
- **Reversal:** Remove the registry append from `repositoryFixtureOwnerNamesForFile`, so goal and
  exploration paths plan noop again, or narrow it to exclude the `goals/*/ops/**/*.ts` row.
- **Status:** recorded in `decisions/2026-11-13-pr-b-coverage-planner-rulings.md`.

### C4. final-check records a passed coverage step with reason "no affected packages" on a noop plan

- **Title:** final-check records a passed coverage step with reason "no affected packages" on a
  noop plan
- **Body:**

  > final-check plans coverage in-process with `resolveAffectedCoverageScope(repoRoot,
  > mergeBase)`, the function the `coverage --affected` subprocess calls. It never uses its own
  > changed-file list, which drops deletions. On `noop` the coverage step is recorded as
  > `passed` with reason `no affected packages`, duration 0, and nothing spawns; `--dry-run`
  > prints the same plan. The step is passed rather than skipped because `yeet ready` requires
  > skipped gates to be named in the PR body. A failed probe logs and leaves the subprocess to
  > plan for itself.
- **Reversal:** Remove `coverageScope` and the noop arm from `FinalCheck.ts`; the coverage step
  spawns `bun run coverage --affected` again and logs its own noop.

### C5. A coverage skip decides before the noop shortcut

- **Title:** A coverage skip decides before the noop shortcut
- **Body:**

  > An operator `--skip coverage=<reason>`, a compute-profile deferral and a route skip, which is
  > everything `skipFor` returns, are evaluated before the in-process coverage probe. The probe
  > runs only when `skipFor(run, "coverage")` is None. A skipped coverage gate therefore stays
  > `skipped` with its own reason in the receipt and in the PR-body naming rule, and never turns
  > into a `passed` noop.
- **Reversal:** Evaluate the noop arm before `skipFor` in `runGate` and `printGatePlan`, and probe
  whenever the coverage gate is requested.

### Packet text

No edit is needed. `SPEC.md:77-83` already gives PR B's final scope:
- `Quality/internal/CoverageScope.ts`, `Quality/Tasks.ts` and `Yeet/internal/FinalCheck.ts`;
- their tests: the new `coverage-scope-goal-readers.test.ts`,
  `goal-data-consumer-census.test.ts`, `quality-tasks.test.ts` and `yeet-final-check.test.ts`;
- the yeet skill's gates reference.

It also cites the ruling file for C1 to C3, and it matches steps 1 to 6.
