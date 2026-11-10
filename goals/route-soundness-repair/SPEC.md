# Route Soundness Repair Spec

## Objective

Close the routing and proof soundness holes the ten-minute-certainty audit confirmed, so that the narrowing
levers in later goals are admitted on selectors that are known to be sound. Each repair widens selection or makes
a judge stricter; none removes proof. Concretely:

- **Goal-data consumers stay on the code route (ROUT-03).** Files under `goals/` that a test reads, spawns or
  imports, or that a `turbo.json` declares as an input, are not docs-only, are mapped to their consumer package in
  CoverageScope, and are declared as per-package Turbo test inputs. Today every goal-packet file is docs-only
  (`packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts`, `docs` alternative `^goals/[^/]+/`) and
  `goals/` is a coverage no-op prefix
  (`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` line 70).
- **Knowledge and packet policy run on docs-only and goals-only PRs (ROUT-02).** The knowledge root tasks run only
  inside Heavy / Lint Policy, which docs-only PRs never start. #3039 gave Repo Sanity a goals-only path, but it runs
  only the private-home-paths law there. A small hosted docs-policy job (D8), set up like that goals-only path,
  returns the knowledge and packet verdicts before merge.
- **The test families key on the `@beep/glob` setup closure (TEST-10).** `vitest.setup.ts` line 34 imports
  `GlobPattern` from `@beep/glob`, but the root `test`, `test:property` and `doctest` tasks depend only on `^transit` and
  `@beep/utils#transit` (`turbo.json` lines 5374, 5419 and 67 respectively), so 127 of 200 test tasks replay a cached green after a
  glob edit.
- **A bare `bun run coverage` judges against the merge base it planned from (COVE-02).**
- **final-check receipts are versioned by gate set, and the docs name the exact gates (YEET-08).** The receipt is
  tagged `yeet-final-check/v1` with no gate-set digest, and AGENTS.md still names an "Effect Diagnostics" gate that
  `FinalCheckGate` does not contain.
- **Local coverage runs on Node 22.23.4 from one shared pin (COVE-03).** check.yml pins 22.23.4 in three places
  while `.nvmrc` is 24.22.1.
- **The coverage comparator has a fixed context name (COVE-08)**, and coverage failure rows are labelled (COVE-04).
- **Change-profile classifies against base-ref CI patterns (PERIH-10).**
- **One relevance model (ROUT-07):** a differential test across the seven path classifiers, then one versioned
  RoutePlan registry.

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md) —
[`BRIEF.md`](../../explorations/ten-minute-certainty/BRIEF.md) (move 2, "Repair the eight soundness holes"),
[`MAP.md`](../../explorations/ten-minute-certainty/MAP.md) (goal 2, first vertical slice),
[`DECISIONS.md`](../../explorations/ten-minute-certainty/DECISIONS.md) (D6, D8, D15, D19, D23, D24),
[`explorations/ten-minute-certainty/research/phase2/PLAN.md`](../../explorations/ten-minute-certainty/research/phase2/PLAN.md) (lever rows,
"Cross-area critique").

## Non-Goals

- No narrowing or skip lever lands here. Job-level lane-relevance skips (PERIH-04) and narrowed
  publish lints (YEET-02) belong to other goals and wait for this goal's differential, as does ROUT-01's residual (its
  after-the-fact admission gate; the #3030 empty-leg skips landed before this goal). TURB-03 is an unowned backlog row
  (MAP backlog, D24) and waits for the differential too if a goal adopts it by decision file.
- No proof-depth reduction: property run floors and seeds, coverage floors, the canonical test census, the full
  corpus replay per PR and the required contexts stay as they are (BRIEF no-go).
- Coverage Regression is not made a required context and does not stop gating Yeet mergeable (D6). The gated
  candidate "Coverage Regression as a required context" reopens only when the scorecard shows coverage-verdict p95
  under 10 minutes.
- The bounded in-publish advisory ratchet (COVE-01) is local-proof-under-ten's lever; this goal only lands its
  prerequisites (COVE-02, COVE-03, COVE-04).
- The coverage-rollout probe step, the `legacy_integration` output, the Test Integration name conditional and the
  `LEGACY_COVERAGE` env line and assertion belong to PERIH-01's probe-deletion slice (heavy-pool-diet); the
  `legacy_coverage` output is deleted by whichever of that slice and COVE-08 lands second (Constraints). The closure-digest release trigger and
  automated pin-bump PRs are PERIH-11 (heavy-pool-diet).
- No narrowing of the `^transit` hub fan-out on tests (rabbit hole; TEST-07 is a gated candidate). TEST-10 only
  adds a dependency edge.
- File-level test selection stays advisory (TEST-08 gated candidate); no new result cache, second scheduler or
  checker agent.
- Caching coverage results or enforcing any reuse decision stays out while the R2 pause holds (D14).
- The ROUT-07 registry does not remove a classifier until its disagreements are zero or admitted, and Turbo stays
  the task-graph authority; lefthook keeps staged-file semantics.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli` (`@beep/repo-cli`):
  - `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts` (`ciOperationalPatterns`, `heavyDocsOnlyPattern`) and its generated
    projection `packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json` (checked by `bun run beep ci patterns`). ROUT-03
    slice 1 adds the `ciGoalDataConsumers` registry there and joins each row into `codeRoots`, leaving the `goals` and
    `docs` alternatives unchanged (decision "ROUT-03 slice 1 keeps consumed goal paths on the code route through codeRoots
    consumer rows").
  - `packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts` (`changeProfile`, which reads the head checkout's patterns file and
    falls back to the embedded value): the base-ref read with a backward-compatible decode (PERIH-10).
  - `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`: the docs-policy lane id (ROUT-02).
  - `packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts`, `packages/tooling/tool/cli/src/commands/Quality/internal/LintPolicyScope.ts`, `lefthook.yml` and the
    inline greps in `.github/workflows/check.yml`: classifiers the ROUT-07 differential compares.
  - `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts`: consumer rows for goal-data paths (ROUT-03 slice 2).
  - `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (bare coverage comparator call, line 4852) and
    `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts` (`compareCoverageRegressionBaseline` already takes a
    `base`): COVE-02; failure-row labels (COVE-04).
  - `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageEnvironment.ts`: the shared Node pin for local coverage children
    (COVE-03).
  - `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.schemas.ts` (`FinalCheckGate`, `FinalCheckReceipt`),
    `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` and `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts` (ancestor carry,
    around line 1260): YEET-08.
  - Tests under `packages/tooling/tool/cli/test/`, including `ci-heavy-admission.test.ts`,
    `ci-docs-job-admission.test.ts`, `quality-tasks.test.ts`, `root-tasks-turbo-inputs.test.ts`,
    `yeet-final-check.test.ts`, `yeet-final-check-refresh.test.ts`, `yeet-ready-gate.test.ts` and
    `ci-route-classify.test.ts`, and `ci-runner-security.test.ts` (the coverage-regression name assertion at line 2675
    and the `check.yml:Coverage Artifact Migration` job-name entry at line 1964, COVE-08). New test files (the goal-data consumer census, the classifier differential) are
    created under the same directory.
- Per-package `turbo.json` test inputs for the goal-data consumers: `packages/tooling/tool/cli/turbo.json` (already
  declares two time-to-certainty research JSON files and two `.py` research inputs), `packages/drivers/eyecite/turbo.json`,
  `apps/labs/semantica/turbo.json` and `apps/labs/ciops/turbo.json` (both declare only a build task today; add a
  test task), and a new turbo.json in the `packages/law-practice/server` directory, which has none. The same slice
  registers the cross-package fixture read the ROUT-09 audit found (`packages/law-practice/use-cases/test/fixtures`).
- Root `turbo.json` (`test`, `test:property`, `doctest` `dependsOn`) `standards/cache-qualification-baseline.json`
  and `standards/policy-tools.fingerprint.json` (TEST-10).
- `.github/workflows/check.yml`: the docs-policy job (ROUT-02), the fixed name of the `coverage-regression` job
  (COVE-08), every `beep ci change-profile` call site (PERIH-10): in check.yml the
  change-profile job step (line 53), the Test Plan classification step (line 769) and the lane-gate evals (lines 267,
  1197, 1333, 1747), plus `.github/workflows/heavy.yml`, `.github/workflows/heavy-admit.yml` and
  `.github/workflows/storybook.yml`; the binary smoke call in `.github/workflows/beep-ci-binary.yml` is listed as
  excluded. Re-inventory with grep when the slice starts, and the coverage Node pins (COVE-03 drift test).
- `scripts/cloud/bootstrap.sh`: provision the pinned coverage runtime (COVE-03).
- `AGENTS.md` (Quality Operator "Final" paragraph) and `.claude/skills/yeet/SKILL.md`: exact final-check gate names
  (YEET-08 slice 1).
- This packet (`goals/route-soundness-repair/**`).

No new workspace package is planned.

### Levers

Status checked against `origin/main` at c90929b1ff1 on 2026-11-10 (decision "Every lever is open at graduation").

| Id | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| ROUT-03 | Register goal-folder data consumers; narrow the #2999 widening for consumed paths | slice 1 landed in #3064 (census test and `ciGoalDataConsumers` rows in `codeRoots`, checked at 5e09d90a6da); slice 2 (CoverageScope rows, per-package Turbo inputs) open | Generated census of every `goals/` path a test reads, spawns or imports, or a `turbo.json` declares, plus the existing cross-package fixture read the ROUT-09 audit found (law-practice-server coverage tests read `packages/law-practice/use-cases/test/fixtures` by relative path, unregistered as a fixture owner and excluded from transit; PLAN ROUT-09 entry); each non-docs-only, mapped in CoverageScope and a per-package Turbo input; mutations of a `.py` probe, a `.ts` ops script, the frozen JSON fixture and a research JSON each selected and red | none |
| ROUT-02 | Docs-policy job: knowledge and packet policy on docs-only and goals-only PRs | open (#3010 and #3011 add no job or lane id; #3039 added a Repo Sanity goals-only path that runs only the private-home-paths law, check.yml line 329) | Completeness test derived from `turbo.json` inputs against fixed probe paths with an explicit exclusion list (fails today on `lint:effect-imports-markdown`); goals-only and docs-only fixtures select the docs-policy job; replaying #2909's head goes red | ROUT-03; HOST-06 (heavy-pool-diet) |
| TEST-10 | Key `test`, `test:property` and `doctest` on `@beep/glob#transit` with a setup-closure invariant (merges TURB-04) | open (`turbo.json` lines 5374, 5419, 67) | Dry-run hash A/B in a disposable worktree: every hash in the three families changes on a `GlobPattern.ts` edit, a control edit leaves them stable (pre-fix `@beep/identity#test=efb65c7d1bcb4fc1`); invariant over cacheable families only; cache-qualification baseline re-recorded in the same PR | none |
| COVE-02 | Bare `bun run coverage` judges against the merge base it planned from | open; #3008 made bare runs plan `--affected` from the merge base, but `Tasks.ts` line 4852 still omits the base | Fixture in `quality-tasks.test.ts`: a lowered row in a dirty baseline fails the bare run with the self-judge line; the same fixture passes on the current tree | none |
| YEET-08 | Versioned final-check receipts by gate set, exact gate names, named hosted obligations | open (`FinalCheckReceipt` tag `yeet-final-check/v1`, no gate-set digest; AGENTS.md names "Effect Diagnostics") | A v1 receipt is refused on the head path and the ancestor-carry path; a docs-drift test ties AGENTS.md and SKILL.md gate names to the `FinalCheckGate` literals; later slices: commitlint argv equals check.yml `--from/--to`, codegen and IPC planned only when `should_run` | slice 1 none; slices 2-3 SCHE-02 (local-proof-under-ten) |
| COVE-03 | Local coverage children and baseline writes on Node 22.23.4 from one shared pin | open (`.nvmrc` 24.22.1; check.yml pins 22.23.4 at three sites) | Wrong runtime refused with no rows written; `bunx --bun` law-practice-server argv unchanged; pin-drift test against check.yml; A/B on `@beep/acp` plus 2-4 v8 packages in hosted producer mode matches hosted rows within 0.001 | none |
| COVE-08 | Fixed comparator context name, removing the conditional on the job name | open (check.yml `coverage-regression` job, Heavy / Coverage Regression, line 1160: name conditional on `legacy_coverage`) | Route replay of context emission on docs, source and main events | coordinated with PERIH-01's probe-deletion slice (heavy-pool-diet), see Constraints |
| COVE-04 | Label coverage failure rows (inherited, environment) | open | Synthetic fixtures; exit status unchanged | COVE-03 |
| PERIH-10 | Classify PRs against base-ref CI patterns | open (change-profile reads the head patterns file) | Canonical base patterns plus a widened head give `docs_only=false`; a push gives the full profile; a base from an older schema decodes or falls back explicitly; every call site covered or listed as excluded with a reason | ROUT-03; PERIH-11 (heavy-pool-diet) |
| ROUT-07 | Differential test across the seven classifiers, then one RoutePlan registry | open | Differential parity over corpus heads; zero unadmitted disagreements | ROUT-03; ROUT-05 (certainty-scorecard) |

## Constraints

- **Order (PLAN "Dependency order" items 2, 3 and 5, "Conflicts").** ROUT-03 lands first: it only widens
  selection, so it is safe while change-profile still reads head patterns. PERIH-10 lands only after heavy-pool-diet's
  closure-digest release trigger and automated pin-bump PRs (PERIH-11), with a backward-compatible decode: under base
  reads a pin bump whose binary expects a changed patterns schema would otherwise fail closed on its own Change
  Profile. After PERIH-10, ROUT-03-style regex edits and PERIH-04's new keys take effect one PR late; say so in the
  PERIH-10 PR. PERIH-01's binary-admission slices (heavy-pool-diet) wait on PERIH-10.
- **ROUT-03 deadline (D8).** If the census slice cannot land by 2026-11-16, roll the `docs` regex back in full to its
  pre-#2999 form instead.
- **ROUT-03 slice 2 uses per-package `turbo.json` inputs, never the root test task**: a root edit cold-starts every
  package's test cache and forces a cache-qualification re-record and a policy-fingerprint reseal.
- **TEST-10 touches root `turbo.json`.** It re-records the cache-qualification baseline and reseals
  `standards/policy-tools.fingerprint.json` in the same PR and freezes
  coverage rows at base (full matrix). Batch it with no other `turbo.json`, `bun.lock` or workflow change. #3041
  (merged) edited `turbo.json`; re-record against main after it.
- **Any workflow change** (ROUT-02, COVE-08, PERIH-10) freezes coverage floors at base, escalates to a full
  matrix and re-records the cache-policy baseline in the same PR; plan the S11 path. ROUT-03's per-package
  `turbo.json` edits do the same (the baseline records per-package inputs). A change to `.github/workflows/heavy.yml`, which check.yml calls at `@main`, is two PRs:
  additive under a migration name first, retirement after main resolves. PERIH-10 (PLAN slice 12) covers heavy.yml's
  `beep ci change-profile` eval; the change-profile binary change is expected to cover it with no heavy.yml edit, and
  if the slice needs one (for example to fetch the base ref), that edit follows this two-PR rule.
- **ROUT-02 host.** #3039 made Repo Sanity run on goals-only diffs: its lane gate sets `home_paths_only` and the job
  runs only the private-home-paths law, with no disk cleanup and no app secrets. That is not the knowledge and packet
  policy D8 asks for. ROUT-02 builds the small hosted docs-policy job D8 rules (one check.yml job plus a CiLane id),
  with its setup modeled on that goals-only path. The operator kept that job on 2026-11-09; the proposal to host the
  steps in Repo Sanity is closed (decision "Operator keeps the D8 docs-policy job for ROUT-02"). Cost is about +4-5 runner-min per docs/goals-only run (PLAN row; the critique books +3-5) and 0
  on code PRs; it is booked as a cost, not a saving.
- **COVE-08 and PERIH-01 split one edge.** heavy.yml no longer emits Heavy / Coverage Regression, so
  `legacy_coverage` resolves false and the name already resolves to `Heavy / Coverage Regression`. COVE-08 owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice (heavy-pool-diet) owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. The reviewer constraint on PERIH-01 (set both outputs or remove their consumers) stays with heavy-pool-diet. Required-context names do not change.
- **Downstream consumer:** `explorations/github-merge-queue`'s gated `merge-group-parity` candidate (its MAP.md; gated on
  `goals/merge-queue-lab` ending in go) waits for this goal to merge,
  because a merge group's docs-only verdict inherits the change-profile selector D8 found unsound
  (`explorations/github-merge-queue/DECISIONS.md`, "sequencing-against-ten-minute-certainty"; D28).
- **YEET-08 slice 1 versions receipts against ancestor carry** (`ReadyGate.ts`): an old receipt must not pass a larger
  gate set on either the same-head or the ancestor-carry path. Keep the optional `computeProfile` and `forceLocal` keys
  decoding (owned by `goals/compute-profile-gate-routing`). The AGENTS.md and SKILL.md wording changes ride in the
  same PR, tied to the literals by a test.
- **COVE-03** adds one pin source and a drift test, never a second free-standing literal; cloud bootstrap provisions the
  runtime. No V8 counter delta has been measured, so the A/B gate is the evidence.
- **ROUT-07** must report before any narrowing lever in another goal lands (PERIH-04, YEET-02, ROUT-01's
  residual, and TURB-03 if a goal adopts it, D24); its
  registry starts from the union of obligations and migrates one consumer at a time.
- **Every repair lands with a mutation fixture or a replay.** Route replay uses `bun run beep ci route replay`.
- **Three open PRs per packet** (`goals/README.md`). Soundness repairs land before any narrowing lever (D19).
- Effect v4 and schema-first rules apply to new code: `LiteralKit` for literal domains, `Effect.fn` for generators,
  `effect/HashMap` and `effect/HashSet`, imports from per-module `effect` leaves. `@beep/repo-cli` tests pass on Node
  and Bun.
- Ownership boundaries: Test Unit partition sizing is `goals/ci-lane-economics`; the route corpus and footprints came
  from `goals/verification-route` (completed-retained, not reopened here); cache reuse is `goals/turborepo-quality-cache-adoption`
  (paused, D14); final-check compute-profile keys are `goals/compute-profile-gate-routing`.
- Numbers come from the exploration packet. Several are derived, not measured (PLAN "Numbers still without a primary
  source"); this goal does not promise the 10-minute target (D20).

## Acceptance Criteria

- [ ] **Goal-data consumers (ROUT-03):** the census test lists every `goals/` path a test reads, spawns or imports, or a
      `turbo.json` declares; each is non-docs-only and, after slice 2, mapped in CoverageScope and declared as a
      per-package Turbo test input. The `packages/law-practice/use-cases/test/fixtures` prefix is mapped to
      `@beep/law-practice-server` in CoverageScope's fixture-owner prefixes and declared as its Turbo test input: a
      coverage scope fixture whose change set is only
      `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json` includes
      `@beep/law-practice-server` (fails before, passes after). Mutating a citation ops `.py` probe, a `.ts` ops script, the frozen profile JSON
      fixture and a ciops research JSON each selects the consumer through change-profile and `--affected` and turns
      it red. Slice 1 merged by 2026-11-16, or the regex rolled back.
- [ ] **Docs/goals knowledge policy (ROUT-02):** goals-only and docs-only fixtures select the docs-policy job; its task
      list passes the completeness test; replaying #2909's head goes red.
- [ ] **Glob setup closure (TEST-10):** a `GlobPattern.ts` edit changes every `test`, `test:property` and `doctest`
      hash in a dry run; a control edit changes none; the cache-qualification baseline is re-recorded and the policy fingerprint resealed in the same PR.
- [ ] **Bare-coverage self-judge (COVE-02):** a lowered row in a dirty baseline fails a bare `bun run coverage` with the
      self-judge line; the clean tree passes.
- [ ] **Final-check receipt versioning (YEET-08 slice 1):** a v1 receipt is refused on the head and ancestor-carry
      paths; the docs-drift test fails if AGENTS.md or the yeet skill names a gate that `FinalCheckGate` lacks.
- [ ] **Node coverage runtime (COVE-03):** a local coverage run on another Node is refused with no rows written; the pin
      drift test fails when check.yml and the shared pin disagree; the A/B matches hosted rows within 0.001.
- [ ] **COVE-08:** the comparator job name is a literal, `ci-runner-security.test.ts` asserts it, and the
      `legacy_coverage` output is gone if PERIH-01's probe deletion landed first; route replay shows the same context on docs, source and main
      events. **COVE-04:** synthetic failure rows carry their label and the exit status is unchanged.
- [ ] **PERIH-10:** a widened head pattern over canonical base patterns gives `docs_only=false`; an older-schema base
      decodes or falls back explicitly; every call site is covered or listed as excluded with a reason.
- [ ] **ROUT-07:** the differential reports zero unadmitted disagreements over the corpus heads; each admitted
      disagreement has a decision file.
- [ ] The certainty-scorecard nightly report shows runner-minutes per docs/goals-only run and per code run, so the
      cost ROUT-02 and ROUT-03 add is visible; no required context disappears.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/route-soundness-repair/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/route-soundness-repair/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/route-soundness-repair` | Passes |
| Pattern projection | `bun run beep ci patterns` | No drift from `ciOperationalPatterns` |
| Change profile | `bun run beep ci change-profile` on a mutation branch | `docs_only=false` for each consumed `goals/` path |
| Route plan | `bun run beep ci route plan` on each mutation | Selects the consumer's lanes |
| Route replay | `bun run beep ci route replay` | No new skipped red |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| CLI tests (Node) | `bunx vitest run packages/tooling/tool/cli/test/ci-heavy-admission.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/yeet-final-check.test.ts packages/tooling/tool/cli/test/yeet-ready-gate.test.ts` plus the new census and differential files | Passes |
| CLI tests (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ci-heavy-admission.test.ts test/quality-tasks.test.ts test/yeet-final-check.test.ts test/yeet-ready-gate.test.ts` | Passes |
| Turbo inputs | `bunx vitest run packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts` | Passes |
| Cache audit | `bun run beep cache audit` | Passes after the TEST-10 re-record |
| Workflow lint | `bun run beep ci workflow-lint` | Passes after each check.yml change |
| Decision log | `bun run beep goals decisions check` | No drift |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Final | `bun run beep yeet final-check` | Passes on the pushed head |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- 2026-11-16 passes without ROUT-03 slice 1 merged: stop narrowing work and land the full rollback of the docs regex
  (D8) before anything else.
- A repair cannot produce a mutation fixture that goes red on the pre-fix tree: the hole is not reproduced; record
  the evidence and do not land the repair as a soundness fix.
- PERIH-11 has not landed when PERIH-10 is next: hold PERIH-10, keep the other slices moving.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add route-soundness-repair --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug route-soundness-repair`; add a `kind: decision` file there, never edit this block._

### COVE-08 and COVE-04 are assigned to this goal; COVE-08 makes the comparator name literal, 2026-11-09

The first draft of MAP.md's lever table left COVE-08 and COVE-04 without a home; D23 assigns both here (MAP.md goal 2 row, amended at graduation): D6 says the fixed comparator context name lands now, and D15 requires labelled coverage rows, which COVE-04 produces, before the advisory ratchet in local-proof-under-ten. COVE-08 owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice (heavy-pool-diet) owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. Neither goal claims the same lines twice. COVE-04 waits for COVE-03. Rejected: leaving both unowned until a later re-plan.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D6, D15, D23).

Reverse: Move COVE-08 to heavy-pool-diet beside PERIH-01 and COVE-04 to local-proof-under-ten, and supersede this decision.

### COVE-08 fixed comparator context name now; Coverage Regression stays non-required and gates mergeable, 2026-11-09

Heavy / Coverage Regression stays a non-required context that still gates Yeet mergeable, and this goal lands the fixed-context-name slice (COVE-08) now, so a later promotion needs no migration. The job is not made required here: that would put a 29-minute push-to-verdict on the required path and block merges on inherited coverage reds. Dropping the gate was rejected by both seats, because floor regressions would reach a main that mostly gets no verdict. Promotion is revisited only once the nightly scorecard shows coverage-verdict p95 under 10 minutes.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D6).

Reverse: Restore the conditional job name on the coverage-regression job in check.yml; the policy itself is unchanged by this decision.

### Targeted narrowing of the #2999 docs-only widening, a docs-policy job, rollback by 2026-11-16, 2026-11-09

The #2999 widening that made every file in a goal packet docs-only is narrowed, not rolled back: a generated census of every `goals/` path a test reads, spawns or imports, or that a `turbo.json` declares, keeps those paths on the code route (ROUT-03), and a small hosted docs-policy job runs knowledge and packet policy on docs-only and goals-only PRs (ROUT-02). If the ROUT-03 census PR cannot land within a week of the 2026-11-09 ruling, that is by 2026-11-16, the docs regex is rolled back in full to its pre-#2999 form. Rejected: full rollback now (loses the docs-only savings on every packet PR) and keeping the widening as is (nothing can be admitted on top of an unsound selector).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D8).

Reverse: Restore the pre-#2999 docs regex in CiOperational.schemas.ts, regenerate the patterns projection and delete the docs-policy job.

### Every lever is open at graduation; #3008 makes the COVE-02 hole concrete, 2026-11-09

Checked against origin/main at c90929b1ff1 (re-verified after the base moved): no lever of this goal has landed. #3008 made a bare local `bun run coverage` plan `--affected` from the origin/main merge base, but the bare path still calls the comparator without that base (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` line 4838), so it plans from one tree and judges against the working-copy floors; COVE-02 stays open and is now reached by every bare run. #3010 (a docs-only allocation report) and #3011 (docs-only scanner qualification in Tasks.ts) add no hosted docs-policy job or lane id, so ROUT-02 stays open; #3039 (merged) gave Repo Sanity a goals-only path that runs only the private-home-paths law, which is not the knowledge and packet policy D8 asks for.
Source: `git log origin/main` and file reads in this checkout on 2026-11-09, re-read at c90929b1ff1 on 2026-11-10.

Reverse: Re-run the lever status check against origin/main and supersede this decision with the new statuses.

### COVE-02 and COVE-03 are prerequisites of the advisory ratchet; local coverage on Node 22.23.4 from one pin, 2026-11-09

The bounded in-publish advisory ratchet (COVE-01) belongs to local-proof-under-ten and may land only after this goal's bare-coverage self-judge fix (COVE-02) and the Node 22.23.4 local coverage pin (COVE-03). Local coverage children and baseline writes run on Node 22.23.4 read from one shared pin with a drift test against check.yml, so a local judge cannot drift from the hosted producer runtime. Rejected: letting COVE-01 land first on the repo default runtime, which keeps the node#63785 class of local false reds.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D15).

Reverse: Drop the shared pin and its drift test and let local coverage children use the repo .nvmrc runtime again; COVE-01 must then wait for a new ruling.

### Soundness repairs land before any narrowing lever; at most three open PRs in this packet, 2026-11-09

This goal runs in cycle one beside certainty-scorecard, and its repairs land before any narrowing lever in hosted-setup-tax or local-proof-under-ten, because a narrowing admitted on an unsound selector inherits the hole. The packet keeps at most three concurrently open PRs, as repo law requires. Rejected: running only the first three PRs, or only the scorecard and soundness packets, which leave the rest of the program without an owner.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19).

Reverse: Supersede in the exploration: let named narrowing levers land before their soundness repair, recording the accepted hole.

### ROUT-02 is the D8 docs-policy job; Repo Sanity hosting is a proposed D8 amendment, 2026-11-10

ROUT-02 builds the small hosted docs-policy job D8 rules: one check.yml job plus a CiLane id, its setup modeled on the goals-only Repo Sanity path #3039 added (no disk cleanup, no app secrets). Hosting the knowledge and packet steps inside Repo Sanity instead is recorded only as a proposed amendment to D8 for the operator, because an agent decision cannot change the form an operator ruling chose. The trade: Repo Sanity hosting adds no hosted job against the concurrent-job ceiling, but folds knowledge and packet policy into an existing required context and lengthens it on documentation heads. The slice measures both before building.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D8); `.github/workflows/check.yml` at c90929b1ff1 and #3039.

Reverse: If the operator accepts the amendment, supersede this decision with one that hosts the knowledge and packet steps in Repo Sanity and amend the docs-only-narrowing decision.

### Operator keeps the D8 docs-policy job for ROUT-02; the Repo Sanity hosting proposal is closed, 2026-11-10

Asked on 2026-11-09 where ROUT-02 (knowledge and packet policy on docs-only and goals-only PRs) should run, the operator answered: keep the separate small docs-policy job that D8 ruled. ROUT-02 (PLAN slice 7) therefore builds one check.yml job plus a CiLane id, its setup modeled on the goals-only Repo Sanity path #3039 added (no disk cleanup, no app secrets). The proposed D8 amendment to host those steps inside Repo Sanity, recorded in the 2026-11-10 decision "ROUT-02 is the D8 docs-policy job", is closed without adoption, and slice 7 no longer measures the Repo Sanity alternative before building.
Source: operator answer of 2026-11-09 relayed by the orchestrator session; exploration `explorations/ten-minute-certainty/DECISIONS.md` (D8).

Lane fix/rout-03-goal-data-census · PR #3064

Reverse: A new operator ruling that hosts the knowledge and packet steps in Repo Sanity supersedes this file and amends the docs-only-narrowing decision.

### ROUT-03 slice 1 keeps consumed goal paths on the code route through codeRoots consumer rows, 2026-11-10

Slice 1 widens the code route without touching the `docs` or `goals` alternatives. A schema-backed registry, `ciGoalDataConsumers` (`CiGoalDataConsumer` rows in `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts`), names each consumed goal path family with its consumer packages, mode and evidence files, and every row's pattern joins `codeRoots`, which already excludes a path from docs-only in both `heavyDocsOnlyPattern` and the change-profile classifier. Reason: `beep ci change-profile` decodes the head checkout's `CiOperational.patterns.json` with the binary pinned on main, so a value change to an existing key takes effect on the PR that lands it, while a new key would be ignored by the pinned decoder until the next binary bump; editing `codeRoots` also cannot narrow anything (widening-only). The rows: the citation-extraction-engine `ops/` directory (law-practice-server spawns its `.py` probes and imports its `.mjs` children), the frozen six-form profile (eyecite, law-practice-server), the semantica C2 canary report, the time-to-certainty `economics.json` and `gate-order-handoff.json` (repo-cli, ciops), the native-dependency-diagnostics `.py` pair (repo-cli) and every `goals/*/ops/**/*.ts` script (repo-cli's goals-ops-typecheck raw glob). The census (`packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`) regenerates consumers from test sources and package `turbo.json` inputs by three read shapes (test-relative `../goals/`, `${root}/goals/` joins, `$TURBO_ROOT$/goals/`), resolves them against tracked files, and drops references whose packet segment is interpolated (synthetic fixtures). It excludes the `goals/*/ops/manifest.json` glob (packet manifests are goal documents; ROUT-02) and leaves root `//#` policy-task inputs to ROUT-02. Before the change it reported 548 consumed entries as docs-only; after it, none.
Source: `packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts` (`changeProfilePatterns`, `classifyChangedPaths`); `.github/workflows/check.yml` Change Profile job at 5e09d90a6da.

Lane fix/rout-03-goal-data-census · PR #3064

Reverse: Remove the ciGoalDataConsumers rows from codeRoots in CiOperational.schemas.ts, run bun run beep ci patterns --write, and delete goal-data-consumer-census.test.ts.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
