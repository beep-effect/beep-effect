# Heavy Pool Diet Spec

## Objective

Cut heavy-pool occupancy and the admission chain on code PRs without reducing proof depth. Heavy / Lint Policy
runs about 12 min on the cap-2 `beep-ec2-heavy` Spot pool and holds about 60% of that pool's occupancy per code
run, while the required heavy contexts (Check, Docgen, Doctest) each run 1.3 to 2.6 min and wait behind it. The
diet keeps Lint Policy on the heavy pool (D11) and removes work it does not need to do: the JSDoc inventory and
ratchet it repeats from the required JSDoc Ratchet lane, the knowledge doctor's stage of its own, and the cost of
the hot checker walks. Required heavy lanes are ordered first. Heavy lanes that a route, goals-only or Docgen
decision will skip are decided at job level before a Spot VM boots. Heavy Admission stops installing the
workspace on every non-docs PR and runs from the pinned CI binary, kept current by closure-digest releases and
reviewed pin-bump PRs.

The goal is read on the certainty scorecard (`requires: ci/certainty-scorecard`). The post-diet heavy-queue p95
it reports is the number the gated heavy-pool capacity candidate reads; this goal never opens that money
question itself.

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md) —
[`BRIEF.md`](../../explorations/ten-minute-certainty/BRIEF.md) (move 3 of the solution sketch),
[`MAP.md`](../../explorations/ten-minute-certainty/MAP.md) (goal 4, capability check, reviewer constraints),
[`DECISIONS.md`](../../explorations/ten-minute-certainty/DECISIONS.md) (D5, D11, D19, D25), and the lever rows
in [`explorations/ten-minute-certainty/research/phase2/PLAN.md`](../../explorations/ten-minute-certainty/research/phase2/PLAN.md).

## Non-Goals

- Moving Heavy / Lint Policy to a standard hosted runner. Its measured peaks are 32 to 36 GiB against 16 GB, and
  fitting it would change the lane's shape (BRIEF rabbit hole, D11).
- Any heavy-pool capacity change: a cap above 2 or a larger runner class is money. It is the gated candidate
  "Heavy-pool capacity" in `MAP.md`, reopened only when the scorecard shows the post-diet heavy-queue p95 still
  binding the required path, and decided by the operator.
- Taking Lint Policy, Property Laws or Coverage Regression off the Yeet mergeable gate, or shortening the review
  window (BRIEF no-go). Lint Policy's findings stay identical; only where and when its tasks run changes.
- Any proof-depth reduction: no lint task, JSDoc check, knowledge check or heavy lane is dropped unless another
  required context runs the same check on the same head (LINT-05 is that case, and its gate proves it).
- Narrowing the `^transit` hub fan-out, file-level test selection as a receipt, or caching results under the R2
  pause (BRIEF rabbit holes).
- The single hosted `lint:shadcn` owner (PERIH-02): owned by
  [`hosted-setup-tax`](../hosted-setup-tax/README.md). This goal does not remove `lint:shadcn` from the Lint
  Policy plan.
- Base-ref CI pattern classification (PERIH-10): owned by
  [`route-soundness-repair`](../route-soundness-repair/README.md). This goal depends on it.
- Test Unit shard and bin counts, Vitest worker counts and the replay-file splits: owned by
  [`ci-lane-economics`](../ci-lane-economics/README.md) (#3007, #3028, #3030, #3040, #3043 and #3046 merged). HOST-08
  here is only the queue-aware A/B harness and its reading.
- The scorecard itself (MEAS-01, MEAS-04, queue-inclusive heavy-pool telemetry): owned by
  [`certainty-scorecard`](../certainty-scorecard/README.md).
- Per-SHA main groups: since D28 they are part of the gated `merge-queue-activation` candidate in
  [`explorations/github-merge-queue`](../../explorations/github-merge-queue/README.md), whose
  `merge-group-parity` waits on this goal merging. The cancel ban and throughput layout stay with
  [`main-verdict-every-commit`](../main-verdict-every-commit/README.md).
- Promising the 10-minute number. The exploration's projection is p95 70 to 115 minutes for code heads without
  capacity (D20).

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
  - `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`: the hosted Lint Policy plan.
    `policyStateTasks` (lines 3705 to 3714) still carries `jsdoc:inventory:check` and `jsdoc:ratchet:check`
    (lines 3711 and 3712), and `policyCachedStateTasks` (line 3723) carries them into the changed-scope medium
    graph (LINT-05). #3041 (merged as e8c9a47971b) runs the knowledge doctor abreast of the medium graph in both
    scopes (`knowledgeDoctorPolicySteps`, line 3831, spread at lines 3900 and 3980; LINT-02 slice 1). The
    changed-scope state width is the fixed `POLICY_UNSCOPED_STATE_WIDTH = 1` at line 3727, with the medium
    width `policyLint - 1` at line 3970 (LINT-02 slice 2). `lint:shadcn` is at line 3709 (PERIH-02's), and
    #3039 added `lint:private-home-paths` (line 3693) to `policyTrackedDiscoveryTasks` (line 3688), which the
    state list spreads.
  - `packages/tooling/tool/cli/src/commands/Quality/internal/LintPolicyScope.ts`: changed-scope widening
    classes and the Turbo target probe; read by the plan-shape tests, changed only if a slice needs it.
  - `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`: the inventory
    builds its in-memory projects with `noResolve` (line 1342, landed in #3019). LINT-01's fixture suite goes in
    a new test file beside `packages/tooling/tool/cli/test/jsdoc-inventory-detector-fixes.test.ts`.
  - `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` and
    `packages/tooling/tool/cli/src/commands/Ci/CiAdmission.ts`: the admission decision that
    `bun run beep ci admission` runs from the checkout today.
  - `packages/tooling/tool/cli/src/commands/Ci/CiBootstrap.command.ts` (`ciBootstrapCommands`, lines 141 to
    149), `packages/tooling/tool/cli/src/commands/Ci/CiBinary.ts`,
    `packages/tooling/tool/cli/src/commands/Ci/CiCompileBinary.ts` and `packages/tooling/tool/cli/src/bin-ci.ts`:
    the pre-toolchain binary surface. Admission is not in it yet (PERIH-01).
  - `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts`: hosted job and step reads, used for interim
    readings before the scorecard reports.
  - Tests under `packages/tooling/tool/cli/test`: `quality-tasks.test.ts`, `lint-policy-scope.test.ts`,
    `ci-heavy-admission.test.ts`, `ci-binary-commands.test.ts`, `ci-docs-job-admission.test.ts`,
    `ci-lane.test.ts` (asserts the literal Test Integration name), `ci-runner-security.test.ts` (asserts the
    probe is gone and `legacy_coverage` is 'false'), `ci-lane-timings.test.ts`.
- `packages/tooling/library/repo-cli-kit/src/tsmorph/ProjectFactory.ts`: the `compilerOptions` parameter #3019
  added; reused, not changed.
- `.github/workflows/check.yml` (cited by job and step, because line numbers move with every workflow PR): the
  Heavy Admission job (`admission`) with its workspace install (step `Setup monorepo CI`) and its
  `bun run beep ci admission` step (`Decide heavy admission`); the `heavy` job's `heavy.yml@main` call; the
  `jsdoc-ratchet` job. PERIH-01 slice 1 deleted the coverage-rollout probe, the `legacy_integration` output,
  the `test-integration` job's name conditional (now the literal `Heavy / Test Integration`) and the
  `coverage-regression` job's `LEGACY_COVERAGE` env line and assertion; the `admission` job's
  `legacy_coverage` output is the literal `'false'` until COVE-08 deletes it. The `coverage-regression` job's
  name conditional on `legacy_coverage` is not this goal's surface: COVE-08 (`route-soundness-repair`) owns it.
- `.github/workflows/heavy-admit.yml`: runs the same admission job when the `ready-for-heavy` label lands; it
  switches to the binary with `check.yml`.
- `.github/workflows/heavy.yml`: the Lint Policy job (`verify`, lines 102 to 107, `runs-on: beep-ec2-heavy`) and
  the shared lane steps, whose `Determine lane execution` step (from line 137) decides route skips, goals-only and
  the Docgen diff only after the VM has booted and checked out (HOST-06), plus the `needs:` order for required
  heavy lanes first (D11).
- `.github/workflows/beep-ci-binary.yml`: releases on any main push under a broad path list (lines 11 to 22), not
  on a change to the binary's closure (PERIH-11).
- `.github/actions/fetch-beep-ci/action.yml`: the pin `beep-ci-d15ecf4ca610` (lines 20 and 21), unchanged since
  #2906 on 2026-11-07; bumped only by reviewed pin-bump PRs.
- `standards/cache-qualification-baseline.json`: re-recorded in any slice that touches `turbo.json`, `bun.lock`
  or a workflow file.
- This packet (`goals/heavy-pool-diet/`).

No new workspace package is planned.

### Levers

Status is from the live checkout at `origin/main` b7d3c9d99a (2026-11-14) for PERIH-11 and 25452087e73 for PERIH-01;
the other rows were last re-verified at c90929b1ff1 (after the rebase from 6eb2e0588e2) and against the open PR
heads named.

| Lever | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| LINT-01 | JSDoc inventory programs built with `noResolve` | Landed, #3019 (027664ba178): `JSDocDocumentationInventory.ts:1342`. Existing fixtures in `jsdoc-inventory-detector-fixes.test.ts`: star export (lines 388, 1084), local named re-export (line 842), overload groups (lines 643, 700, 762). Residual open (#3301): merged-namespace and module-augmentation fixtures plus a noResolve parity assertion over all five shapes; whole-repo byte parity minus `generatedAt` across 196 packages (`history/2026-11-13-lint-01-noresolve-parity.md`); one hosted JSDoc Ratchet timing pending; scorecard reading. | Inventory jsonc and md byte-identical minus `generatedAt` across 194 packages; fixtures for a local re-export, a star export, a merged namespace, an overload and a module augmentation of an imported package (three exist; the gate is unpaid for the other two and for parity); one hosted JSDoc Ratchet timing. | none |
| LINT-05 | Drop the duplicate JSDoc inventory and ratchet from the hosted Lint Policy plan | Slice 5 (P1): the hosted plan reads `standards/branch-protection-contexts.json` (`Tasks.ts:3875` `readRequiredContexts`) and drops the pair from full scope (`fullScopeStateTasks`, `:3735`) and the changed-scope medium graph (`:4015`) while `JSDoc Ratchet` is required; plan test `quality-tasks.test.ts:5803`. Seeded-red proof on #3135: JSDoc Ratchet red on the seeded head, neither task in either Lint Policy log. Scorecard reading open. | A plan test shows the hosted plan omits both tasks only while JSDoc Ratchet is a required context; on a seeded-red draft PR, JSDoc Ratchet fails and the Lint Policy log shows neither task. | LINT-01; #3041 merged (same task lists) |
| LINT-02 | Knowledge doctor abreast of medium; changed-scope state width derived from the remaining slots | Slice 1 landed in #3041 (e8c9a47971b); its hosted A/B is unpaid. Slice 2 open: `Tasks.ts:3727`, `:3970`. | Plan-shape test: doctor present in both scopes with unchanged argv, summed width at most `policyLint`, medium at least 2 for every profile; a red doctor fails the lane; hosted A/B of at least 10 runs per arm with p50 and p95 each at least 90 s better and memory.peak under 24 GB. | LINT-01, LINT-05 |
| LINT-04 | PR C checker algorithms: P55, S4, P12/P11, P28, S2 | Landed, #3019 (027664ba178), all five families. Residual gate items paid by slice 4b (history/2026-11-13-lint-04-parity-gates.md): S2 prefilter generated from the rows, P55 planted fixtures, S4 findings diff, P12/P11 aliased-assertion fixture and a bounded pre/post digest (the whole-repo pre-#3019 digest is not paid: the old scanner exceeds the 8 GiB cap), P28 census and WORKSPACE_MANIFEST_WALK re-key probe. Open: the whole-repo pre-#3019 P12/P11 digest (the old scanner needs a host with more than 21 GB free; #3019's 814 assertions and sha 44b7c59c9033de74 are unreproducible as recorded) and the scorecard reading | Those per-family items (the #3019 commit message asserts byte-for-byte output but records none of them); per-file coverage floors hold. | LINT-01, LINT-05 (credit order only) |
| ORDER (D11) | Required heavy lanes (Check, Docgen, Doctest) first; Lint Policy `needs:` them with `if: !cancelled()` | PR 1 open (#3302): `verify` needs Check, Docgen and Doctest with `!cancelled()`; hosted proof read after merge (`@main`). | On the same heads, push-to-start of Check, Docgen and Doctest on the cap-2 pool is no slower and Lint Policy still runs and reports when Check is red; two-PR `heavy.yml@main` rollout. | none |
| HOST-06 | Route skips, goals-only and Docgen decisions hoisted to job-level `if` before Spot boot | PR 1 open (#3302): Heavy Admission emits `lane_skips`; each lane job skips at job level on `lane_skips` and pull request `route_skips`; callers pass `lane_skips` in slice 6, the in-VM gate decides until then. | Route replay plus mutation fixtures (docs, goals, no-diff, unreadable base); hosted ruleset parity ledger (every required `Heavy / *` context still reports); two-PR `heavy.yml@main` rollout. | none (decision outputs computed in Heavy Admission) |
| PERIH-11 | Closure-digest binary releases and reviewed pin-bump PRs (merges PERIH-08) | Slice 1 landed (PLAN slice 2): `beep ci binary-closure` digests the static import closure of `bin-ci.ts` plus its build inputs, and `beep-ci-binary.yml` compiles and publishes only when that digest differs from the latest `beep-ci-*` release's recorded digest (the path list stays as a prefilter). Slice 2 (PLAN slice 7) landed (#3299): whenever main pins an older release than the newest `beep-ci-*` one, the release job opens or updates one reviewed pin-bump PR on `ci/beep-ci-pin-bump`, the pin rewritten by `beep ci binary-pin`. Read on main: the first pin-bump PR (#3326) passed its own Check and merged as 76238b4c11, and two later main pushes with an unchanged closure opened none (history/2026-11-14-perih-11-slice-2-after-the-bump.md). The next closure change after that merge opened a new PR (#3334), which passed its own Check and merged as b7d3c9d99a. | Closure mutation fixtures; the pin-bump PR proves itself through its own Check. | none |
| PERIH-01 | Heavy Admission from the pinned CI binary with a closure-digest fallback; delete the dead coverage-rollout probe (absorbs DEPS-02 admission half) | Slice 1 (probe deletion) landed before COVE-08: probe, `legacy_integration`, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion removed; `legacy_coverage` set to 'false' for COVE-08 to delete. Open: the `admission` job's `Setup monorepo CI` step installs, admission not in `ciBootstrapCommands`. | Replay of recorded events (draft, label, fork, docs, push, error) through binary and source gives byte-identical `verdict`, `route_skips` and `route_receipt`; a closure-digest mismatch fixture forces the head-install fallback; slice 1 removes the probe, the `legacy_integration` output and its Test Integration name conditional, and the `LEGACY_COVERAGE` env line and assertion together, and sets `legacy_coverage` to 'false' if it lands before COVE-08 (COVE-08 then deletes it) or removes it outright if COVE-08 landed first. | PERIH-11, PERIH-10 (route-soundness-repair); slice 1 coordinates with COVE-08 |
| HOST-08 | Queue-aware Test Unit leg-width A/B | Open; the Test Unit layout changed again in #3043 and #3046, so it is not yet at steady state. | Hosted A/B: push-to-Test-Unit p95 at most 9.5 min per run from lane timings, runner-minutes beside it, no queued-job growth at the ceiling. | MEAS-04 (certainty-scorecard), Test Unit steady state; ROUT-01 already met (landed in #3030; hosted-setup-tax) |

## Constraints

- **Ruling D11:** Lint Policy stays on the heavy pool; the diet runs; required heavy lanes are ordered first; the
  capacity decision waits for the scorecard's post-diet heavy-queue p95 and goes to the operator as money.
- **Ruling D5:** Lint Policy is not one of the 15 ruleset contexts. Its wall is reported beside the target, never
  inside it, and it stays on the Yeet mergeable gate.
- **Lint order (PLAN, "Dependency order" item 6):** LINT-01 before LINT-05 before LINT-02 before LINT-04, with
  LINT-03 (the width split) folded into LINT-02 slice 2. LINT-01 and LINT-04 have already landed together in
  #3019, so the order now binds the remaining work (LINT-05, then the LINT-02 A/B and slice 2) and the credit
  order: each saving is read after its own landing and credited once.
- **CI binary chain (item 3):** closure-digest release trigger, then automated reviewed pin-bump PRs (PERIH-11),
  then base-ref patterns (PERIH-10, a cross-goal dependency on `route-soundness-repair`, landed with a
  backward-compatible decode so a pin bump that changes the patterns schema does not fail closed on its own
  Change Profile), then binary-dependent moves such as PERIH-01 with a closure-digest fallback to head install.
  Each binary change is three PRs: the CLI change, the pin bump, then the workflow switch.
- **`heavy.yml` is called at `@main` (item 4; the `check.yml` `heavy` job):** HOST-06, the D11 ordering and any heavy-lane
  input or Lint Policy job rename are two PRs. The first lands additive under a migration name; the second
  retires it after `main` resolves the new reusable workflow.
- **Reviewer constraint on PERIH-01 (`MAP.md`, CodeRabbit on #3017):** `check.yml` derives both
  `legacy_coverage` and `legacy_integration` from the coverage-rollout probe step. The slice sets both outputs
  explicitly or removes their consumers in the same PR; hard-coding the coverage job name alone leaves
  `legacy_coverage` empty and fails the comparator's boolean check on non-docs runs.
- **Double counting (PLAN, "Double counting"):** credit each saving once. The JSDoc dedupe: LINT-01 for the JSDoc
  Ratchet ubuntu job, LINT-05 (with the HOST-03 JSDoc half) for the Lint Policy copy. The knowledge-doctor
  overlap: LINT-02 and HOST-04 claim the same 200 to 211 s, booked once after the inventory pole is removed. Heavy
  Admission on the binary: PERIH-01 and DEPS-02 claim the same 0.6 to 0.9 min and about 950 to 1,050
  runner-min/week, credited once to PERIH-01; DEPS-01's admission-install claim disappears with it. Docgen's skip
  saving belongs to HOST-06, not to the lane-relevance skips in `hosted-setup-tax`.
- **Shared file with `hosted-setup-tax`:** PERIH-02 removes `lint:shadcn` from the same `policyStateTasks` list
  that LINT-05 edits. Whichever PR lands second merges `main` first, and the one-hosted-owner test PERIH-02 adds
  must stay green after LINT-05.
- **Shared lines with `route-soundness-repair` (one rule, stated the same in both packets):** COVE-08
  (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a
  literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test
  Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output
  has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe
  deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with
  its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands
  second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the
  lines it changes.
- **The merge group waits on this goal (D28):** HOST-06 (job-level skips before the Spot boot) is still this
  goal's job-removing lever. Its consumers are now `merge-group-parity` and the gated `merge-queue-activation`
  candidate in `explorations/github-merge-queue`: `merge-group-parity` waits on this goal,
  route-soundness-repair and hosted-setup-tax merging, and `merge-queue-activation` waits on
  `merge-group-parity`; job-removing levers land first because a merge-group run adds the most jobs.
- **Shared file with #3041:** #3041 merged (e8c9a47971b), so LINT-05 and LINT-02 slice 2 can start; this goal
  opens no competing doctor-placement PR.
- **Job ceiling (PLAN, "Conflicts"):** HOST-08 is the only lever here that may add legs. It lands after the
  job-removing levers and inside the unverified ~60 concurrent hosted job ceiling, and only once the Test Unit
  layout owned by `ci-lane-economics` is at steady state.
- **Cache-policy baseline:** any PR touching `turbo.json`, `bun.lock`, root `package.json` or a workflow file
  freezes coverage floors at base, escalates to a full matrix and re-records
  `standards/cache-qualification-baseline.json` in the same PR. Batch workflow edits to keep full-matrix runs few.
- **Workflow PR merges:** the orchestrator's App token cannot merge workflow PRs, so slices that edit
  `.github/workflows/` plan a merge by an identity that can.
- **Rollback:** every workflow slice names a tested revert in its PR body (PLAN, "Missing from the plan").
- **Packet rule:** at most three open PRs across this packet's lanes; a fourth change is sequenced behind one.
- Repo-cli tests pass on Node and Bun; Effect tests via `@effect/vitest`. Schema-first, Effect v4 only,
  `effect/HashMap` and `effect/HashSet` over native collections, `Effect.fn` for generator functions.
- Numbers are quoted as the exploration states them. The heavy slot-minute figures (about 24 to 26 slot-min per
  code run, 260 to 275 slot-min/h peak demand against 120 supplied) are derived from two post-#3005 runs and one
  day of peak traffic, not from queue-inclusive telemetry; the 84 min required heavy-queue p95 baseline was
  measured on the 09-12Z window of 11-09 PR runs, which still included Heavy / Test Integration (removed by
  #3005), and the projected 10 to 20 min at peak is a fluid-model guess. The scorecard's measured baseline replaces them before any acceptance number is read.

## Acceptance Criteria

All numbers are read from the certainty scorecard over at least 7 days of code-head PR runs after the last diet
lever lands, against its baseline window before the first one; superseded heads are censored.

- [ ] **Lint Policy wall:** Heavy / Lint Policy job wall p95 at most 9 min on code-head PR runs (baseline p50
      about 12.1 min over 16 PR runs, range 8.6 to 16.7; the scorecard's baseline window supplies the p95),
      read from the scorecard's Lint Policy wall p95 row, reported beside the target, never inside it.
- [ ] **Heavy occupancy:** heavy slot-minutes per code run (VM boot included) down by at least 20% against the
      scorecard baseline.
- [ ] **Admission chain:** admission-to-Heavy start (Heavy Admission job start to the first `Heavy / *` job
      start) at least 0.5 min faster p50 on non-docs PR runs.
- [ ] **No proof change:** JSDoc inventory jsonc and md byte parity minus `generatedAt` before and after each
      inventory change, and identical Lint Policy findings (same failing-task set and finding lines) on the same
      heads before and after each Lint Policy plan change.
- [ ] LINT-01 residual: merged-namespace and module-augmentation fixtures committed, the existing star-export,
      named re-export and overload fixtures asserted under noResolve parity, all green; one hosted JSDoc Ratchet
      timing recorded under `history/`.
- [ ] LINT-04 residual: the per-family gate items (S2 generated prefilter, P55 planted fixtures, S4 findings
      diff, P12/P11 digest, diagnostics sha and aliased-assertion fixture, P28 census and re-key probe) committed
      and green, with per-file coverage floors held.
      Status (slice 4b, #3311): S2, P55, S4 and P28 paid. P12/P11 paid in part: the aliased-assertion fixture
      (`lint-opaque-roundtrips.test.ts`) and a pre/post digest over four sampled packages (154 assertions,
      identical). NOT paid, and this item stays open: the whole-repo pre-#3019 P12/P11 digest. The pre-change
      checker reached 14 GiB after 47 minutes on the 31 GiB worker and was stopped. A run on a host with more
      than 21 GB free pays it.
- [ ] LINT-05 landed behind its gate: the plan test and the seeded-red draft PR evidence are recorded.
- [ ] LINT-02 landed: #3041 (or its replacement) merged, slice 2 merged, and the hosted A/B (at least 10 runs per
      arm, p50 and p95 each at least 90 s better, memory.peak under 24 GB) recorded under `history/`.
- [ ] Required heavy lanes first: on the same heads, push-to-start of Check, Docgen and Doctest is no slower, and a
      seeded Check red still produces a Lint Policy verdict.
- [ ] HOST-06 landed in two PRs with its route replay, mutation fixtures and ruleset parity ledger recorded; every
      required `Heavy / *` context still reports on docs, goals-only and code heads.
- [x] PERIH-11: binary releases trigger on a closure-digest change only, and a closure change opens a reviewed
      pin-bump PR that passes its own Check; closure mutation fixtures are committed.
- [ ] PERIH-01: one PR removes the probe step, the `legacy_integration` output with its Test Integration name
      conditional, and the LEGACY_COVERAGE env line and assertion, and either removes `legacy_coverage`
      outright (COVE-08 landed first) or sets it to 'false' for COVE-08 to delete;
      Heavy Admission and `heavy-admit.yml` run admission from the pinned binary with the closure-digest fallback;
      the byte-identical replay over recorded events is committed.
- [ ] HOST-08: after Test Unit steady state, the leg-width A/B harness reports push-to-Test-Unit p95 per arm with
      runner-minutes beside it and no queued-job growth at the ceiling; the result, adopted or not, is a decision
      file.
- [ ] The post-diet heavy-queue p95 is reported by the scorecard and handed to the operator as the input to the
      gated capacity candidate, with no capacity change made by this goal.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/heavy-pool-diet/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/heavy-pool-diet/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/heavy-pool-diet` | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Lint Policy plan shape (Node) | `bunx vitest run packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/lint-policy-scope.test.ts` | Passes |
| Lint Policy plan shape (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/quality-tasks.test.ts test/lint-policy-scope.test.ts` | Passes |
| JSDoc inventory parity | `bun run beep quality jsdoc-inventory` before and after, diffed minus `generatedAt` | Byte-identical |
| JSDoc ratchet | `bun run beep quality jsdoc-ratchet` | Passes |
| Lint Policy findings | `bun run beep lint policy --full` on the same head before and after a plan change | Same failing-task set and findings |
| Admission and binary (Node) | `bunx vitest run packages/tooling/tool/cli/test/ci-heavy-admission.test.ts packages/tooling/tool/cli/test/ci-binary-commands.test.ts packages/tooling/tool/cli/test/ci-docs-job-admission.test.ts packages/tooling/tool/cli/test/ci-lane.test.ts packages/tooling/tool/cli/test/ci-runner-security.test.ts` | Passes |
| Admission and binary (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ci-heavy-admission.test.ts test/ci-binary-commands.test.ts test/ci-docs-job-admission.test.ts test/ci-lane.test.ts test/ci-runner-security.test.ts` | Passes |
| Binary build | `bun run beep ci compile-binary` | Builds; sha256 printed |
| CI patterns projection | `bun run beep ci patterns` | No drift |
| Workflow lint | `bun run beep ci workflow-lint` | Passes |
| Route replay (HOST-06) | `bun run beep ci route replay` | Recall unchanged |
| Cache-policy baseline | `bun run beep cache audit` | Passes; baseline re-recorded where a slice touches global inputs |
| Interim hosted readings | `bun run beep ci lane-timings` | Recorded under `history/` until the scorecard reports |
| Decision log | `bun run beep goals decisions check --slug heavy-pool-diet` | No drift |
| Packet doctor | `bun run beep goals doctor` | No blocking finding for this packet |
| Final gate | `bun run beep yeet final-check` | Passing receipt for the PR head |
| Acceptance numbers | certainty scorecard rows for Lint Policy wall, heavy slot-min per code run, admission-to-Heavy start, heavy-queue p95 | Thresholds above met |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- A heavy-pool capacity change (cap, runner class, paid hosted runner) would be needed to meet an acceptance
  number: stop and hand the scorecard's post-diet heavy-queue p95 to the operator.
- A lever's admission gate fails twice on the same design (findings differ, inventory bytes differ, a required
  context stops reporting): stop that lever and record the result; never land it with the gate weakened.
- The certainty scorecard has not landed when every lever has: report the levers as landed and the acceptance
  numbers as pending on `ci/certainty-scorecard`.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add heavy-pool-diet --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug heavy-pool-diet`; add a `kind: decision` file there, never edit this block._

### COVE-08 owns the Coverage Regression job name; PERIH-01 slice 1 leaves that line alone, 2026-11-09

COVE-08 (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. Both outputs are then set explicitly or have no consumers, which meets the MAP.md reviewer constraint. COVE-08 is assigned to route-soundness-repair by D23. Rejected: removing both name conditionals in PERIH-01 slice 1 (lands COVE-08's change without its route replay of context emission).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D23); `explorations/ten-minute-certainty/MAP.md` (Reviewer constraints); coordinator arbitration of the 2026-11-09 review round.

Reverse: Supersede with matching decision files here and in route-soundness-repair that move the line to PERIH-01.

### HOST-08 starts only once the Test Unit layout is at steady state; ci-lane-economics owns the layout, 2026-11-09

The Test Unit layout belongs to `goals/ci-lane-economics` (#3007, #3028, #3030, #3040, #3043 and #3046 merged). HOST-08 here is only the queue-aware leg-width A/B harness and its reading. Steady state means: the Test Unit layout of #3043 (nine repo-cli and eight law-practice shards on two Vitest workers) and #3046 (test shards created before non-test lanes, 20-minute shard timeouts) has run seven consecutive days of PR runs with no further change to `packages/tooling/tool/cli/vitest.shards.json`, `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts` or the Test Unit shard jobs in `.github/workflows/check.yml`, counted from c90929b1ff1 (#3046) or from any later layout change. HOST-08 also waits on MEAS-04 (certainty-scorecard); its ROUT-01 dependency is already met, because ROUT-01's empty-partition skips landed in #3030 (hosted-setup-tax keeps only its residual gate). It adds legs only within the hosted job ceiling. Rejected: running the A/B now (every Test Unit number is pre-steady-state) and changing shard counts from this goal (ci-lane-economics owns them).

Source: `git log origin/main` (dbaf55668cb #3028, f818c6e52bf #3030, 0ae245d5da8 #3007, 694c91bbf9d #3040, 08972a39a16 #3043, c90929b1ff1 #3046); exploration `explorations/ten-minute-certainty/research/phase2/PLAN.md` (HOST-08 row).

Reverse: Supersede with a decision file naming a different steady-state test, or hand HOST-08 to ci-lane-economics.

### Landed levers stay in the goal with their evidence, unpaid gate items and scorecard reading, 2026-11-09

LINT-01 and LINT-04 landed in #3019 and LINT-02 slice 1 rides open #3041. Each stays in this goal's Levers table as landed (or carried), with its commit or PR as evidence, the part of its admission gate that was never paid (fixtures, replays, digests, A/B runs) as a slice, and its reading in the certainty scorecard. A commit message that asserts parity does not pay a gate that names fixtures or digests. Rejected: deleting a lever once its code lands (its unpaid gate and its saving would have no owner).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D26).

Reverse: Supersede with a decision file if the exploration amends D26; the landed levers would then leave the Levers table.

### LINT-01 and LINT-04 landed in #3019; the goal keeps their unpaid gate items and their measurement, 2026-11-09

#3019 (027664ba178) compiles the JSDoc inventory's per-package projects with `noResolve` through a new options parameter on `createInMemoryTsMorphProject` (LINT-01), and rewrites all five PR C families: P55 effect-imports, S4 effect-vitest, P12/P11 opaque-roundtrips, P28 the lint:laws manifest walk and S2 retired-iri (LINT-04). Its commit message asserts byte-for-byte output for every checker but records no fixture, digest or census. The goal does not redo the rewrites. Of the five fixtures the LINT-01 gate names, `packages/tooling/tool/cli/test/jsdoc-inventory-detector-fixes.test.ts` already carries three of the five: a star export (lines 388 and 1084), a local named re-export (`export { default as documentedRule } from "./documentedRule.ts"`, line 842) and function-overload groups (lines 643, 700 and 762). The merged namespace (its namespaces at lines 191 to 206 are not merged with a value) and the module augmentation of an imported package (no `declare module` fixture) are missing. It keeps four residuals: the two missing LINT-01 fixtures plus a noResolve parity assertion over the three existing ones; one hosted JSDoc Ratchet timing; the unpaid LINT-04 per-family gate items: S2's prefilter generated from the retired-host rows (#3019 ships a hand-written regex), P55 planted fixtures, the S4 findings diff, the P12/P11 814-assertion digest with diagnostics sha 44b7c59c9033de74 and an aliased-assertion fixture, and the P28 census with a WORKSPACE_MANIFEST_WALK re-key probe; and the scorecard reading of both levers. Because LINT-04 landed before LINT-05, the plan's credit order (LINT-01, then LINT-05, then LINT-02, then LINT-04) no longer matches landing order, so each saving is read from the scorecard after its own landing and credited once. Rejected: dropping both levers from the goal (loses the measurement and the unpaid gates) and treating the #3019 commit message as the per-family gate (it records no fixtures, digest or census).

Source: `git show --stat 027664ba178`; `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts` line 1342.

Reverse: Reopen either lever with a decision file if the scorecard or a parity check shows a #3019 checker diverged.

### Open #3041 carries LINT-02 slice 1; the goal keeps its hosted A/B and the state-width slice, 2026-11-09

Open #3041 moves the knowledge doctor out of its own Lint Policy stage and runs it abreast of the medium graph in both the full-scope and changed-scope plans (its diff of `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`; on main the doctor is still its own stage at lines 3887 and 3967). It is not landed until it merges. #3041 does not drop the duplicate JSDoc inventory and ratchet from the hosted plan, does not change the changed-scope state width (still a fixed one slot), and states that no hosted run has measured the new placement. This goal therefore does not open a competing doctor PR. It keeps the LINT-02 gate (a hosted A/B of at least 10 runs per arm, p50 and p95 each at least 90 s better, memory.peak under 24 GB) and the second slice that derives the changed-scope state width from the remaining slots. LINT-05 lands after #3041 merges, because both edit the same Lint Policy task lists. Rejected: a second doctor-placement PR from this goal (duplicate of #3041).

Source: #3041 head 937e2a20f8c, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` diff against `origin/main` 6eb2e0588e2, main-side lines re-verified at c90929b1ff1.

Reverse: If #3041 closes without merging, take LINT-02 slice 1 back into this goal's first slot with a decision file.

### Lint Policy is outside the 15-context target, stays on the Yeet mergeable gate and is reported beside it, 2026-11-09

Heavy / Lint Policy is not one of the 15 ruleset contexts, so this goal's Lint Policy wall numbers never count toward the push-to-every-required-context-green target. Lint Policy stays on the Yeet mergeable gate (BRIEF no-go), and the certainty scorecard reports its wall and time-to-mergeable in a separate row beside the target. The diet reaches the target only through heavy-pool occupancy: fewer slot-minutes on the cap-2 pool let Check, Docgen and Doctest start sooner. Rejected: including the mergeable contexts in the target (it would make a capacity decision target-critical before the diet lands) and green-only pooled heads.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D5).

Reverse: A new exploration ruling that adds Yeet-mergeable contexts to the target; then restate this goal's acceptance against it.

### Lint Policy stays on the heavy pool; run the diet, order required heavy lanes first, defer capacity, 2026-11-09

Heavy / Lint Policy stays on the cap-2 `beep-ec2-heavy` pool. This goal runs the diet (LINT-01 noResolve, LINT-05 drop the duplicate JSDoc chain, LINT-02 knowledge doctor abreast, LINT-04 PR C algorithms) and orders the required heavy lanes (Check, Docgen, Doctest) ahead of Lint Policy with `needs:` plus `if: !cancelled()`, so a Check red still lets Lint Policy run and report. The capacity decision (a cap above 2 or a larger runner class) is money: it goes to the operator only when the certainty scorecard shows the post-diet heavy-queue p95 still binding the required path. Rejected: moving Lint Policy to a standard hosted runner (measured peaks of 32 to 36 GiB against 16 GB), opening the capacity decision now (unmeasured), and stopping Yeet from waiting on Lint Policy (a policy red would no longer hold merges).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D11).

Reverse: Supersede with a decision file that moves Lint Policy or opens the capacity question, citing the scorecard's post-diet heavy-queue p95.

### PERIH-01 sets both legacy admission outputs or removes their consumers in the same PR, 2026-11-09

`check.yml` derives both `legacy_coverage` and `legacy_integration` from the Heavy Admission coverage-rollout probe step. The slice that deletes the probe sets both outputs explicitly or removes their consumers in the same PR, under one rule shared with route-soundness-repair: COVE-08 (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. Hard-coding the coverage job name alone leaves `legacy_coverage` empty and fails that assertion on every non-docs run. Rejected: deleting the probe and its step output alone (turns Coverage Regression red), and deleting only the coverage half.

Source: exploration `explorations/ten-minute-certainty/MAP.md` (Reviewer constraints, CodeRabbit on #3017, 2026-11-09).

Reverse: Restore the coverage-rollout probe step and both admission outputs from the reverted check.yml.

### Cycle-two goal in the critic's order, at most three open PRs, 2026-11-09

This goal is one of six graduated packets run as a whole program in the critic's dependency order: measurement first, soundness before any narrowing, job-removing levers before job-adding ones. It runs in cycle two against the certainty scorecard, but the diet levers that remove work are startable now because their gates are plan tests, parity proofs and replays; only the acceptance numbers and the capacity question wait on `ci/certainty-scorecard`. HOST-08 adds legs, so it lands last and only within the hosted job ceiling. At most three of this packet's PRs are open at once; a fourth is sequenced behind one of them. Rejected: opening every lever as its own PR at once (breaks the packet limit and the double-counting order) and holding the whole goal until the scorecard lands (contradicts D25).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19).

Reverse: Supersede with a decision file that changes the order or the PR budget, with the operator ruling that allows it.

### The admission-chain gate reads heavy-pool pickup per producer run, 2026-11-13

The Admission chain acceptance criterion defines its row as "Heavy Admission job start to the first `Heavy / *` job start ... on non-docs PR runs". certainty-scorecard #3144 (decision `certainty-scoring-fixes` there) changed what `beep ci certainty` reports as `admissionToHeavy`. The old row took the earliest non-skipped `Heavy / ` job of check.yml runs only. Since #3030 that is mostly the hosted `Heavy / Test Integration` aggregate, which starts after every integration shard, so the row measured shard time (planned fixture p50 6.45 min). The row now covers every producer run of a code head, check.yml and heavy-admit.yml alike, and pairs that run's own Heavy Admission start with its first executed job on the heavy pool (beep-ec2-heavy runner labels). On the same fixture the p50 is 1.22 min (n 15). This goal reads the criterion under that definition: first heavy-pool job per producer run, both producers. Its baseline must be taken with a `beep ci certainty` build that includes #3144. A baseline taken before #3144 and a measurement after it compare different quantities, and neither may be used against the other.

Lane fix/certainty-scoring-fixes · PR #3144

Reverse: Delete this file; the Admission chain criterion then reads the certainty-scorecard row under whatever definition it carries when measured.

### Slices 3 and 6 are held until the ci-lane-economics window-5 verdict, 2026-11-13

The CI goals driver (T3 thread CI goals finish, which keeps the ci-lane-economics window-5 record, window 2026-11-13T20:00Z to 2026-11-20T20:00Z) ruled on 2026-11-13 that #3302 (PLAN slice 3: required heavy lanes first and job-level lane skips in heavy.yml) is lane-affecting. It stays a draft, merged with main and green, and merges together with slice 6 only after the window-5 verdict, or earlier if the driver restarts the window. A preview census runs 2026-11-18T02:00Z; if it shows a breach this change repairs, the driver asks the operator about merging the held set then. #3301 (slice 4) is not lane-affecting and goes to final at content-final. #3299 (slice 7) is not lane-affecting as it stands, but it edits a workflow file, so it is an operator hand merge queued from a `final <sha40> #3299` PR comment. Finals are posted as PR comments. The goal's final PR (reflection and `goals set-status heavy-pool-diet completed-retained`) is coordinated by the driver. Rejected: merging #3302 at the ordinary gate (it would change heavy-lane start order and skips inside the measurement window).

Reverse: Delete this file; #3302 and slice 6 then merge at the ordinary gate.

### The hosted check-census step adds at most 0.5 slot-minutes per relevant Heavy / Check run, 2026-11-13

Measured on a built local tree on 2026-11-13 (single-threaded tsc 7.0.2+effect-tsgo.0.68.1, host load 5 to 11 on 64 cores): the step runs serially after a green Turbo run on the same runner and adds 24.2 s when the run checked @beep/repo-cli, 5.4 s for @beep/law-practice-domain, 4.2 s for the six @beep/schema rows and 30.0 s for every row (push runs), plus about 1.4 s for the Turbo selection dry run on every affected run; a run that checks no row package pays only that dry run. A slower hosted core stretches these numbers in proportion, and the step's own `ci:check:census: ok in <ms>` log line is the hosted reading.

Lane feat/check-census-hosted-measure

Reverse: Remove the check lane's census step (runCheckLaneCensus in the CI lane module); the gate itself stays runnable locally.

### Lint Policy re-runs with a runner-loss re-run of a required heavy lane, 2026-11-14

Ruling D11's ordering (#3302) gives Heavy / Lint Policy `needs: [check, docgen, doctest]`. `.github/workflows/rerun-runner-loss.yml` runs `bun run beep ci rerun-runner-loss`, which re-runs each lost job through `POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun` (`CiRerunRunnerLoss.ts`). GitHub documents that endpoint as re-running the job and its dependent jobs. A runner-loss re-run of Check, Docgen or Doctest therefore also re-runs Lint Policy. Before #3302, Lint Policy had no `needs` and never re-ran with them. The beep-reviewer P2 thread on #3302 raised this.

No fix keeps the ordering. In GitHub Actions only `needs` orders jobs within a run. Concurrency groups and runner labels do not order them, and the job re-run API has no option to leave dependents alone. Dropping `needs` gives up D11. Splitting Lint Policy into a second workflow triggered by `workflow_run` would lose its literal `Heavy / Lint Policy` context under the `heavy.yml@main` callers and add a second Spot boot. The cost is accepted.

Evidence, read 2026-11-14 from this worker:

- The 200 most recent `Rerun Runner Loss` runs cover 2026-11-13T14:50Z to 2026-11-14T01:17Z, about 10.5 h. 155 were skipped because the triggering run had not failed. 42 succeeded and 3 failed, so 45 runs evaluated a failed run.
- Only 5 of those 45 evaluation logs could be read: the GitHub API stalled on this worker under shared load. All 5 gave the verdict `no-runner-loss`, meaning no job was re-run. One of them (run 43537551636) left a Heavy / Lint Policy red alone because it had failed for another reason.
- So a runner-loss re-run of a required heavy lane is rare next to how often the ordering applies. The ordering helps every admitted code head, because the three required lanes take the cap-2 `beep-ec2-heavy` pool first on every run. The extra Lint Policy run costs about 5 min p50 and 8 min p95 of heavy-pool wall time per re-run, on today's runs.
- The rate should be re-read on the certainty scorecard once ci-lane-economics' window-5 verdict lands. If runner-loss re-runs of Check, Docgen or Doctest grow to a large share of heavy runs, reverse this.

Rejected: removing `needs` (gives up D11's ordering on every run to save a rare re-run); a separate Lint Policy workflow (loses the literal context and adds a boot).

Reverse: Remove needs from the Lint Policy job in heavy.yml; Lint Policy then starts beside the required lanes again.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
