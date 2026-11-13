# Map: why `yeet final-check` ran coverage for 46 minutes on a goals-only diff

Read-only research for the D-cov ruling
(`decisions/2026-11-13-final-check-coverage-runs-only-packages-whose-tests-read-goals.md`).
Every claim cites `file:line` in this worktree (branch `feat/goal-closeout-hosted-verification`,
base `7a462a27d4f`). Nothing here ran a test, coverage or final-check suite. Three probes ran, each
in under 20 seconds: a `bun -e` call of `planWorkspaceCoverageAffectedScope` against the live
workspace, `turbo run test --affected --dry-run=json` with pinned `TURBO_SCM_BASE`/`TURBO_SCM_HEAD`,
and `gh pr checks 3101`.

## Answer in one paragraph

#3101 (`cbc647e52e8`) changed five files, all under `goals/alchemy-vault-sync-slice/`. One of them is
`ops/manifest.json`. The coverage planner keeps a hand-written "repository fixture" row that maps
every `goals/*/ops/manifest.json` to `@beep/repo-cli` (`CS:114`). The planner therefore selected
`@beep/repo-cli`, which weighs 1191.7 planner-seconds (`CS:332`). That is above the 300-second
single-run budget (`T:242`), so the run used the weighted shard executor: a filtered prebuild,
then repo-cli's 488 test files under coverage with `--maxWorkers=2` (`T:4636-4648`, `T:225`,
`T:967-973`). After that came the ratchet compare (`T:4915`). The gate itself is always selected,
because the coverage lane footprint is unrefined (`RF:141`). Turbo inputs, the ratchet's global
inputs and the route classifier only explain why a gate was selected. None of them added
repo-cli. Hosted CI classified the same five paths as docs-only. It allocated no Test Unit shard and
skipped Heavy / Coverage Regression (`check.yml:750-752`, `check.yml:1108`). `gh pr checks 3101`
shows both as `skipping`. Local final-check was therefore doing about 46 minutes of work that hosted
CI never does and never fails on. The census-backed registry of goal-data readers (`CO:142-237`)
already excludes manifests as packet documents (`CEN:77-85`). Deriving the planner's goal mapping
from that registry makes #3101 a no-op. It also fixes the reverse gap: real goal readers that the
planner currently ignores.

## Legend

| Short | Path |
| --- | --- |
| `FC` | `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` |
| `FCS` | `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.schemas.ts` |
| `RG` | `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts` |
| `T` | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` |
| `CS` | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` |
| `GC` | `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts` |
| `RF` | `packages/tooling/tool/cli/src/commands/Ci/RouteFootprints.ts` |
| `RC` | `packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts` |
| `CO` | `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts` |
| `COS` | `packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts` |
| `CL` | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` |
| `CC` | `packages/tooling/tool/cli/src/commands/Ci/CiCoverage.ts` |
| `CEN` | `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts` |
| `QT` | `packages/tooling/tool/cli/test/quality-tasks.test.ts` |
| `TJ` | `turbo.json` |
| `TJcli` | `packages/tooling/tool/cli/turbo.json` |

## 1. The trace, step by step

### 1.1 final-check selects the coverage gate for any diff

1. `runYeetFinalCheck` computes `changedFiles` against the merge base (`FC:1163-1166`). It then
   builds the route by classifying the head (`FC:1171-1177`).
2. The route maps the `coverage` gate to the `coverage` CI lane (`FC:125`). For every lane-backed
   gate, `planFinalCheckRoute` asks `routeLaneDecision` (`FC:156-166`).
3. The coverage footprint is `unrefined("coverage", "covered-pkgs", ...)` (`RF:141`). Unrefined
   means "every atom kind" (`RF:88-109`). The only admitted refinement removes `packet`/`commits`
   from `build` and `check`, not from `coverage` (`RF:59-80`). #3101's paths classify as `packet`
   (the Markdown files) and `packet:data` (`ops/manifest.json`) (`RC:249`, `RC:307-308`). Every
   head also carries a `commits` atom (`RF:64-65`). So `routeLaneDecision` returns `selected` for
   coverage (`RF:358-360`). The route decides **whether** the gate runs. It does not decide
   **what** the gate measures.
4. The planned coverage step is
   `TURBO_SCM_BASE=<merge-base> bun run coverage --affected` (`FC:354-360`). It runs as a
   subprocess with inherited stdio (`FC:734-761`).

### 1.2 `bun run coverage --affected` plans its own package set

1. Because `--affected` is a caller-pinned argument, the mode is `explicit` (`T:1134-1138`,
   `T:1169-1179`). That path resolves through `resolveCoverageTaskOptions` (`T:1225-1231`).
2. The affected branch reads the base from `TURBO_SCM_BASE` (`T:1059-1068`). It collects
   `base...HEAD` changed files (`T:1069-1071`) and calls `planWorkspaceCoverageAffectedScope`
   (`T:1093`). `--affected` is then **stripped** before Turbo sees it (`T:975-978`, `T:1094`). The
   selection becomes explicit `--filter=<pkg>` arguments (`T:1111`). Turbo's own affected logic
   therefore plays no part in coverage scoping.
3. The planner (`CS:1476-1536`) handles each changed path as follows:
   - A **full** fallback happens if the path is a global coverage input (`CS:748-749`,
     `CS:33-59`), a workspace `package.json` (`CS:788-790`), a fixture row whose owner is
     unavailable (`CS:792-797`), or a path with no workspace owner (`CS:804-810`).
   - A path under a **noop** prefix contributes nothing. The noop prefixes include `goals/`,
     `explorations/` and `research/` (`CS:70`, `CS:757-760`, `CS:800-802`).
   - Otherwise the path selects its owner plus any **repository fixture** owners
     (`CS:815-821`). The fixture table is matched **before** the noop test (`CS:792` precedes
     `CS:800`), so a fixture row overrides the `goals/` noop.
4. The fixture table has two `goals/` rows:
   - `["goals/*/ops/manifest.json", "@beep/repo-cli"]` (`CS:114`), added in #1112
     (`441b31f668f`) when "live test fixtures" were registered.
   - `["goals/speed-loop/ops/runner-burst/", "@beep/repo-cli"]` (`CS:148`).

   Fixture owners never seed dependents (`CS:828-837`), so the selection stays exactly
   `@beep/repo-cli`.

### 1.3 Why it took about 46 minutes

- `@beep/repo-cli` weighs 1191.7 s in the planner table (`CS:332`). The table says these weights
  are upper bounds measured under load averages of 48 to 59 (`CS:165-181`).
- Any selection heavier than 300 s (`T:242`) is "wide" (`T:4636-4639`). A wide selection goes to
  the weighted shard executor (`T:4641-4648`, `T:4823-4829`). That executor runs one
  `turbo run build --filter=@beep/repo-cli` prebuild, which pulls in repo-cli's whole `^build`
  closure (`T:4584-4589`, `T:4616-4628`). It then runs the repo-cli shard. repo-cli is the one
  "two-worker" package (`T:225`), so the shard runs `--fileParallelism=true --maxWorkers=2`
  (`T:232-234`, `T:967-973`) over `packages/tooling/tool/cli/test` (488 `*.test.ts` files).
- Turbo's `coverage` task is `cache: false` (`TJ:5439-5441`), so nothing is replayed from cache.
- The ratchet compare then judges every repo-cli row (`T:4836-4847`, `T:4915`). That compare can
  also go red on a goals-only diff because of inherited repo-cli rows, which have nothing to do
  with the diff.

Probe (live workspace owners, `planWorkspaceCoverageAffectedScope`):

| Changed files | Planner verdict today | Planner weight |
| --- | --- | --- |
| #3101's 5 paths (`git show --stat cbc647e52e8`) | `selected [@beep/repo-cli]` | 1191.7 s |
| `goals/<slug>/ops/manifest.json` alone | `selected [@beep/repo-cli]` | 1191.7 s |
| `goals/<slug>/SPEC.md` alone | `noop` | 0 |
| `goals/speed-loop/ops/runner-burst/*.sh` | `selected [@beep/repo-cli]` | 1191.7 s |
| `goals/citation-extraction-engine/ops/*.py` | `noop` | 0 |
| `goals/citation-extraction-engine/history/evidence/.../profile.frozen.json.txt` | `noop` | 0 |
| `goals/time-to-certainty/research/economics.json` | `noop` | 0 |
| `goals/<slug>/ops/*.ts` | `noop` | 0 |

## 2. Things that do **not** cause it

| Suspect | Finding |
| --- | --- |
| Turbo global inputs | `global.inputs` lists `.bun-version`, `.nvmrc`, the root projection and the root tsconfigs. It has no `goals/` entry (`TJ:9-19`). |
| Turbo task inputs | The root `coverage` task inputs are package-relative plus the root vitest files (`TJ:5448-5462`). repo-cli's `turbo.json` adds four specific `goals/**/research` files to `test`/`test:property`/`coverage` (`TJcli:5-12`, `TJcli:56-62`). Coverage scoping never uses Turbo `--affected` (`T:1094`, `T:1111`). Probe: `turbo run test --affected --dry-run=json` with base `cbc647e52e8^` and head `cbc647e52e8` selects **0** test tasks. The same probe on `7a462a27d4f` (a repo-cli test edit) selects `@beep/repo-cli`, which confirms the probe method. |
| Ratchet global inputs | `COVERAGE_FULL_INPUT_FILES`/`_PREFIXES` cover `.bun-version`, `bun.lock`, `package.json`, the baseline, Quality/Ci internals, `turbo.json`, tsconfigs and `.github/` (`CS:33-59`). None of them is under `goals/`. |
| Route classifier | It selects the gate (§1.1). The route has no package grain, so it cannot narrow repo-cli. |

## 3. Which tests actually read `goals/`

### 3.1 The census-backed registry (ROUT-03)

`ciGoalDataConsumers` (`CO:142-237`) lists every goal or exploration path family that a test
reads, spawns or imports, or that a package `turbo.json` declares. Each row carries its consumer
packages. `goal-data-consumer-census.test.ts` rebuilds the consumer list from test sources and
package `turbo.json` files. It fails when a consumed path is unregistered (`CEN:253-262`) or a row
goes stale (`CEN:287-315`). The registry today:

| Row pattern (`CO`) | Consumers |
| --- | --- |
| `^goals/citation-extraction-engine/ops/` (`CO:143-155`) | `@beep/law-practice-server` |
| `^goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile\.frozen\.json\.txt$` (`CO:156-168`) | `@beep/eyecite`, `@beep/law-practice-server` |
| `^goals/semantica-canary/history/c2/full-w1\.replay\.eval-report\.json$` (`CO:169-175`) | `@beep/semantica` (lab) |
| `^goals/time-to-certainty/research/economics\.json$` (`CO:176-182`) | `@beep/repo-cli` |
| `^goals/time-to-certainty/research/gate-order-handoff\.json$` (`CO:183-189`) | `@beep/ciops` (lab), `@beep/repo-cli` |
| `^goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics(\.test)?\.py$` (`CO:190-196`) | `@beep/repo-cli` |
| `^goals/speed-loop/ops/runner-burst/` (`CO:197-203`) | `@beep/repo-cli` |
| `^explorations/beep-ci-operational-ontology/.../s6/(graphs/abox\.ttl\|snapshot/raw/journal\.ndjson)$` (`CO:204-215`) | `@beep/ciops` (lab) |
| `^explorations/beep-ci-operational-ontology/.../s4/beep-ci-ops/corpus/run4-fleet/` (`CO:216-222`) | `@beep/ciops` (lab) |
| `^explorations/legal-ontology-landscape/assets/manifest\.jsonl$` (`CO:223-229`) | `@beep/ontology` |
| `^goals/[^/]+/ops/.+\.ts$` (`CO:230-236`) | `@beep/repo-cli` |

All six consumer packages define a `coverage` script. Only `packages/tooling/tool/cli` declares
`goals/` paths in a package `turbo.json`.

### 3.2 Manifests are excluded on purpose

The census lists `goals/*/ops/manifest.json` as a `packet-document` exclusion. The stated reason:
"packet manifests are goal documents (CiGoalDocument); packet policy on goals-only PRs is
ROUT-02's docs-policy job" (`CEN:77-85`). Bare literals that name a single packet document are
not counted either (`CEN:53-58`, `CEN:161-165`). The census still requires that every
packet-document exclusion covers only `ciOperationalPatterns.goals` paths (`CEN:271-282`).

repo-cli suites do read every tracked manifest live:

- `goals-ops-typecheck.test.ts:27-31` reads the `opsScripts` field.
- `goals-manifest-capabilities.test.ts:78-101` (`git ls-files :(glob)goals/*/ops/manifest.json`)
  decodes each manifest and builds the capability graph.
- `goals-graph.test.ts:548-553` runs the "evergreen census" of the capability graph.

A manifest edit could therefore turn these suites red. On a goals-only PR, local final-check
already covers manifest validity with `goals:doctor` and `goals:index-check`. Both are in the
cheap-gates tier (`GC:855-861`, `GC:975-981`, `T:3678`, `T:3719`), and final-check runs that tier
as its first step (`FC:301-306`). Hosted CI runs no repo-cli tests on such a PR (§4). ROUT-02, the
docs-policy job, is still open (`goals/route-soundness-repair/SPEC.md:133`).

## 4. How hosted CI decides for the same diff

1. **Change Profile.** `classifyChangedPaths` sets `docs_only` only when no path matches
   `codeRoots` and every path matches `goals` or `docs` (`COS:86-97`, `COS:93-94`). `docs`
   includes `^goals/[^/]+/` (`CO:260`). `codeRoots` is the product roots plus every registry
   pattern (`CO:261`). Probe with `isHeavyDocsOnlyPath`: all five #3101 paths are docs-only. A
   citation ops `.py`, an ops `.ts` and `economics.json` are code-route.
2. **Admission.** A docs-only diff sets `skip-satisfied`, `admitted=false` and `docs_only=true`
   (`check.yml:104-112`, `heavy-admit.yml:71-78`). Every `Heavy / <lane>` context then passes
   without work. `heavy.yml` (called `@main`, `check.yml:183`) no longer declares Coverage
   Regression (`check.yml:100-102`).
3. **Test Plan.** A docs-only diff gets `test_unit='[]'` (`check.yml:750-752`). Otherwise the plan
   is `ci lane test-unit --plan-partitions --affected` (`check.yml:730`). That plan is Turbo's
   affected `test` selection **unioned with the same coverage planner** through
   `ciCoveragePlan` → `resolveCiCoverageArtifactPlan` → `resolveCoverageTaskOptions`
   (`CL:2565-2580`, `CC:406-413`, `T:1304-1309`).
4. **Coverage Regression.** The job is skipped when `docs_only == 'true'` (`check.yml:1108`).
   Otherwise its comparison runs with `--affected` through the same planner
   (`check.yml:1137-1142`, `check.yml:1219-1236`).
5. **#3101 hosted result** (`gh pr checks 3101`):
   - Change Profile: pass.
   - Heavy Admission: pass.
   - Test Plan: pass.
   - `Test Unit (${{ matrix.partition }})`: **skipping**.
   - Test Unit: pass in 2 s.
   - Heavy / Coverage Regression: **skipping**.
   - Repo Sanity: pass in 3m27s. Repo Sanity ran its full body because `decisions/` and
     `research/OPPORTUNITIES.md` fall outside the `goals` prose pattern (`CO:253-254`), which
     makes `goals_only=false` (`check.yml:238-243`).

### 4.1 A second gap, found while comparing (hosted also misses real readers)

For goals-only diffs that touch a **registry** path, hosted CI leaves docs-only as the census
intends. But Test Unit selects a consumer only if the consumer's Turbo `test` inputs declare the
path, or if the coverage planner maps it:

| Registry row | Declared in Turbo `test` inputs? | Coverage planner maps it? | Hosted Test Unit runs the consumer? |
| --- | --- | --- | --- |
| citation `ops/` | no (law-practice/server has no `turbo.json`) | no (probe: `noop`) | **no** |
| frozen citation profile | no (eyecite `turbo.json` has 0 goal paths) | no (probe: `noop`) | **no** |
| semantica canary report | no | no | **no** (lab; labs lane gate is separate, `check.yml:435`) |
| `economics.json` | yes, `TJcli:11` | no (probe: `noop`) | repo-cli `test` via Turbo |
| `gate-order-handoff.json` | yes for repo-cli (`TJcli:12`); no for ciops | no | repo-cli yes, ciops no |
| `native-dependency-diagnostics*.py` | yes, `TJcli:9-10` | no | repo-cli yes |
| `runner-burst/` | no | yes, `CS:148` | repo-cli yes |
| explorations rows (ciops, ontology) | no | no (`explorations/` is a noop prefix, `CS:70`) | **no** |
| `goals/*/ops/**/*.ts` | no | no (probe: `noop`) | **no**. Probe: `turbo --affected` on `da69ce5cd0d` (ops `.ts` only) selects 0 test tasks. When that happens, Test Unit passes with "The plan selected no Test Unit partition" (`check.yml:944-945`). |

Today, then, local final-check runs too much on manifests (all of repo-cli) and too little on
real readers (nothing). Hosted CI matches local for the readers, because both use one planner.

## 5. Current versus proposed, by path class (goals-only diffs)

| Path class | Local final-check today | Hosted today | Local after the proposal | Hosted after the proposal |
| --- | --- | --- | --- | --- |
| Packet prose (`*.md`) | noop | docs-only skip | noop, "no affected packages" | unchanged |
| `ops/manifest.json` | **repo-cli, about 46 min** | docs-only skip | noop, "no affected packages" | unchanged (docs-only) |
| Other packet data (`ops/*.json`, `research/*.json`, `history/**`) not in the registry | noop | docs-only skip | noop | unchanged |
| Registry row with repo-cli consumers | repo-cli only for runner-burst; noop otherwise | repo-cli `test` for Turbo-declared rows; nothing for ops `.ts` | repo-cli coverage | repo-cli coverage plus Test Unit |
| Registry row with law-practice-server/eyecite/ontology consumers | noop | nothing | those packages' coverage | those packages' coverage plus Test Unit |

Local stays a superset of hosted in every row: hosted's docs-only rows run nothing, and the
code-route rows now go through the same planner on both sides.

## 6. Proposal (minimal)

### 6.1 Required: derive the planner's goal mapping from the registry (`CS`)

One source of truth decides "packages whose tests read `goals/`": the ROUT-03 registry that the
census test already enforces.

```ts
// CS imports (CO is a leaf module: it imports only identity, schema and effect, CO:8-11)
import { ciGoalDataConsumers } from "../../Ci/CiOperational.schemas.ts";

// Goal and exploration paths that tests read, spawn or import (ROUT-03 registry, kept live by
// goal-data-consumer-census.test.ts). Every other packet path stays coverage-inert (CS:70).
const GOAL_DATA_CONSUMER_PATTERNS = A.map(
  ciGoalDataConsumers,
  (row) => [new RegExp(row.pattern, "u"), row.consumers] as const
);

const goalDataConsumerNamesForFile = (filePath: string): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(GOAL_DATA_CONSUMER_PATTERNS, ([pattern]) => pattern.test(filePath)),
    ([, consumers]) => consumers
  );
```

- Delete `["goals/*/ops/manifest.json", "@beep/repo-cli"]` (`CS:114`) and
  `["goals/speed-loop/ops/runner-burst/", "@beep/repo-cli"]` (`CS:148`). The registry row
  `CO:197-203` replaces the second one.
- In `repositoryFixtureOwnerNamesForFile` (`CS:762-770`), append
  `goalDataConsumerNamesForFile(filePath)` before the dedupe. `fullReasonForFile` and
  `selectedOwnersForFile` pick it up unchanged (`CS:792-797`, `CS:815-821`). The `goals/` and
  `explorations/` noop prefixes stay (`CS:70`).
- Result for #3101: `noop`. Result for a registry path: its consumers, with no dependents
  (`CS:828-837`). Mixed diffs change in exactly two ways: a manifest no longer adds repo-cli, and
  registry paths now add their consumers.

This one function change also changes hosted CI (Test Plan and the Coverage Regression
comparison, §4), which is intended. Splitting final-check from hosted is the drift that this design
avoids. `T:1146-1151` already says local and hosted share "the same affected plan `yeet
final-check` trusts".

### 6.2 Required: record "no affected packages"

- Floor: reword the no-op line `T:4896` to
  `[beep-cli] coverage:affected: no affected packages (no coverage-bearing inputs changed)`.
  The subprocess already exits 0 in seconds without the ratchet (`T:4895-4898`).
- To put the reason in the receipt, factor `T:1059-1093` into an exported
  `planAffectedCoverageScope(repoRoot, base)`. Then, in `runGate` for `coverage` (`FC:972-991`),
  write a short-circuit for `noop`:
  `FinalCheckStepResult.make({ gate: "coverage", status: "passed", reason: "no affected packages", ... })`.
  This mirrors the reuse branch (`FC:803-817`). Use `passed` with a reason, not `skipped`:
  `yeet ready` lists `skipped` steps as gates that the PR body must name (`RG:1236-1250`). A
  planner no-op is a pass, not a skip. `reason` is already optional on step results (`FCS:121`).

### 6.3 Tests (focused; no full suite)

In `QT`, next to `QT:9059-9074` (which stays valid, because runner-burst is in the registry) and
`QT:9145-9157`:

- #3101's five paths give `noop`, and manifest-only gives `noop`.
- For each `ciGoalDataConsumers` row, one sample path (reuse the census `mutations`,
  `CEN:207-217`) selects exactly that row's measurable consumers.
- A goals path that is not in the registry (`goals/x/ops/data.json`) gives `noop`.

Run them with a scoped `vitest -t`. `goal-data-consumer-census.test.ts` needs no change.

### 6.4 Rollout notes

- The fix PR edits `CS`, a global coverage input
  (`packages/tooling/tool/cli/src/commands/Quality/internal/Coverage`, `CS:57`), so its own
  final-check falls back to **full** coverage. Plan
  `--skip coverage=<reason>` or the constrained-compute `yeet open` route, and let hosted CI prove
  it.
- Per the ruling, the change ships from lane `final-check-coverage-scope`. Its reversal: restore
  `CS:114` and `CS:148` and drop the registry append.

## 7. Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Add a route refinement that removes `packet`/`packet:data`/`commits` from the `coverage` lane (`RF:59-80`) | The route has no package grain, so it could skip the whole gate but never choose readers. A registry path is `packet:data` too. Skipped gates also surface as "name them in the PR body" (`RG:1236-1250`). |
| A pre-filter only in final-check (goals-only diff → `--filter` the registry consumers) | It forks local planning from hosted planning, leaves the `CS:114` mismatch on hosted mixed diffs, and leaves the §4.1 hosted gap open. |
| Run only the goals-reading test files of repo-cli under coverage | The ratchet is per file. A partial repo-cli run lowers every untouched row and goes red (`T:4836-4847`). |
| Register manifests in the census registry | Every goal PR edits its manifest, so every goal PR would run repo-cli on hosted too. That is the opposite of the ruling. |

## 8. Open questions

1. **Manifest readers.** Three repo-cli suites read every manifest live (§3.2). The proposal
   follows the census policy (manifests are packet documents) and the ruling's #3101 evidence. It
   relies on `goals:doctor`/`goals:index-check` in cheap-gates to catch manifest breakage locally.
   Does `goals doctor` check what `goals-manifest-capabilities` and `goals-graph` check (capability
   graph consistency, `opsScripts` ↔ `tsconfig.ops.json`)? If it does not, a manifest edit can
   still turn `main` red after the merge, just as hosted CI allows today.
2. **Lab consumers.** `@beep/semantica` and `@beep/ciops` define `coverage` but are labs. Hosted
   Test Unit excludes them (`CL:2557-2560`, `CL:2574`), and #1112 deliberately removed a ciops
   fixture registration. Should the registry append filter labs out, or let the labs lane own
   them?
3. **Cost shift.** Registry paths with `@beep/law-practice-server` (2679.9 s, `CS:267`) or
   `@beep/repo-cli` (1191.7 s) consumers, including any `goals/*/ops/**/*.ts` edit, will now run
   20 to 45 minutes of coverage locally and on hosted CI, where today they run nothing. That
   follows the ruling, but someone should confirm it. Otherwise the registry row for ops `.ts`
   (`CO:230-236`, an `import` of raw text for a typecheck census) could be treated like
   manifests.
4. The exact 46-minute split (prebuild against the repo-cli shard against the compare) is not in
   this checkout. The #3101 final-check receipt lives in another lane's
   `.beep/yeet/final-check/`.
