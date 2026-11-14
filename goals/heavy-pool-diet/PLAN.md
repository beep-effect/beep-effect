# Heavy Pool Diet Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-check lever status against `origin/main` (#3041, the Test Unit layout, PERIH-10) and fix the baseline window. | Lever table in `SPEC.md` current; scorecard baseline window (or interim `bun run beep ci lane-timings` readings) recorded under `history/`. |
| P1 Implement | in-progress | Land slices 1 to 12 below in order, at most three open PRs. | Every open lever landed behind its admission gate, or stopped with a decision file. |
| P2 Verify | pending | Read the acceptance numbers from the certainty scorecard over at least 7 days of code-head PR runs after the last diet lever. | Lint Policy p95, heavy slot-min per code run, admission-to-Heavy start and the post-diet heavy-queue p95 recorded under `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state; hand the heavy-queue p95 to the operator. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

PR-sized, in landing order. "Open now" means the slice needs nothing else from this or another goal. At most
three of this packet's PRs are open at once; slices 1 to 3 are the first three.

| # | Slice (PR title) | Levers | Size | Admission gate | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | `ci: delete the dead coverage-rollout probe` | PERIH-01 slice 1 | S | In one PR: the probe step, the `legacy_integration` output and the `test-integration` job's name conditional on `legacy_integration`, and the `LEGACY_COVERAGE` env line and assertion removed; Shared rule with COVE-08: COVE-08 (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. `ci-lane.test.ts` updated as well; Coverage Regression and Test Integration report under their exact required names on a code head; on a docs head Test Integration does, and Coverage Regression (skipped there, so GitHub shows its unevaluated name expression) waits on COVE-08's literal name. Workflow PR: cache-policy baseline re-record if `cache audit` asks. | Landed (#3116, aec8dbf57bd) |
| 2 | `ci: gate binary releases on a closure projection` | PERIH-11 slice 1 (absorbs PERIH-08) | M | Closure mutation fixtures: a change inside the binary's import closure triggers a release, one outside it does not; `bun run beep ci compile-binary` sha256 unchanged for an unchanged closure. | Landed (#3145) |
| 3 | `perf(ci): run required heavy lanes first and decide heavy skips at job level` (first `heavy.yml` PR, additive under a migration name) | ORDER (D11), HOST-06 PR 1 | M | Heavy Admission emits the goals-only and Docgen decisions beside `route_skips`; route replay plus mutation fixtures (docs, goals, no-diff, unreadable base); ruleset parity ledger shows every required `Heavy / *` context reporting; Lint Policy still runs when Check is red. | Open now |
| 4 | `test(repo-cli): pin the noResolve JSDoc inventory contract with fixtures` | LINT-01 residual | S | New merged-namespace and module-augmentation (of an imported package) fixtures; a noResolve parity assertion over the existing star-export, named re-export and overload fixtures in `jsdoc-inventory-detector-fixes.test.ts`; inventory byte parity minus `generatedAt`; one hosted JSDoc Ratchet timing recorded. | Open (#3301) |
| 4b | `test(repo-cli): pay the PR C checker parity gates` | LINT-04 residual | M | S2 prefilter generated from the retired-host rows and tested against them; P55 planted fixtures; S4 findings diff; P12/P11 814-assertion digest, diagnostics sha 44b7c59c9033de74 and an aliased-assertion fixture; P28 census and a WORKSPACE_MANIFEST_WALK re-key probe; per-file coverage floors hold. | A free PR slot |
| 5 | `perf(repo-cli): leave the JSDoc inventory to the required JSDoc Ratchet lane` | LINT-05 | S | Plan test: the hosted plan omits `jsdoc:inventory:check` and `jsdoc:ratchet:check` only while JSDoc Ratchet is required; seeded-red draft PR shows JSDoc Ratchet red and neither task in the Lint Policy log; identical Lint Policy findings otherwise. | #3041 merged; merge `main` after PERIH-02 if it landed first |
| 6 | `perf(ci): retire the heavy migration job names` (second `heavy.yml` PR) | ORDER (D11), HOST-06 PR 2 | S | `main` resolves the slice 3 workflow; parity ledger unchanged after the retirement. | Slice 3 merged and resolved on `main` |
| 7 | `ci: open a pin-bump PR on closure change` | PERIH-11 slice 2 | S | A closure change on `main` opens one reviewed pin-bump PR that passes its own Check; no PR for a release with an unchanged closure. | Open (#3299) |
| 8 | `perf(repo-cli): derive the changed-scope state width from the remaining slots` | LINT-02 slice 2 (absorbs LINT-03) | S | Plan-shape test: summed width at most `policyLint`, medium at least 2 for every profile, doctor present in both scopes with unchanged argv; then the hosted A/B for LINT-02 (at least 10 runs per arm, p50 and p95 each at least 90 s better, memory.peak under 24 GB) recorded under `history/`. | Slice 5; #3041 merged |
| 9 | `ci: bundle ci admission in the CI binary with a closure-digest fallback` | PERIH-01 slice 2 | M | Replay of recorded events (draft, label, fork, docs, push, error) through binary and source gives byte-identical `verdict`, `route_skips` and `route_receipt`; a closure-digest mismatch fixture forces the head-install fallback. | Slice 7; PERIH-10 landed by `route-soundness-repair` |
| 10 | Pin-bump PR for the admission binary (opened by slice 7's automation) | PERIH-11, PERIH-01 | S | Passes its own Check on the new pin. | Slice 9 merged and released |
| 11 | `ci: switch Admission to the pinned binary after the pin bump` | PERIH-01 slice 3 | S | Heavy Admission in `check.yml` and `heavy-admit.yml` runs the binary without the workspace install; admission-to-Heavy start read on the scorecard; tested revert in the PR body. Workflow PR: cache-policy baseline re-record. | Slice 10 |
| 12 | `chore(ci): queue-inclusive leg-width A/B harness for Test Unit` | HOST-08 | M | Hosted A/B under 1, 2 and 4+ concurrent PRs: push-to-Test-Unit p95 at most 9.5 min per run, runner-minutes beside it, no queued-job growth at the ceiling; the adopt-or-not result is a decision file. | Test Unit steady state (decision file); MEAS-04 (`certainty-scorecard`); ROUT-01 already met (landed in #3030; `hosted-setup-tax`) |

The final PR of the goal carries the scorecard readings, the `closeout` record and the reflection; it may ride with
slice 12 or follow it.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status heavy-pool-diet completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug heavy-pool-diet` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add heavy-pool-diet --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- **Already landed:** LINT-01 and LINT-04 in #3019 (027664ba178); LINT-02 slice 1 in #3041 (e8c9a47971b),
  so slices 5 and 8 no longer wait on it.
- **Not blocked:** `requires: ci/certainty-scorecard` gates the acceptance numbers and the capacity hand-off,
  not slices 1 to 8. Until the scorecard reports, record interim readings with `bun run beep ci lane-timings`
  and never claim an acceptance number from them.
- **Two-PR and three-PR rules:** every `heavy.yml` change is two PRs (slices 3 and 6); every binary change is
  three (slices 9, 10, 11). Batch workflow edits where gates allow, because each workflow PR freezes coverage
  floors and needs a cache-policy baseline re-record.
- **Cross-goal waits:** slice 9 waits on PERIH-10 (`route-soundness-repair`); slice 12 waits on MEAS-04
  (`certainty-scorecard`) and the Test Unit layout owned by `ci-lane-economics` (its ROUT-01 dependency is met:
  the skips landed in #3030). Slice 1 shares `check.yml` with COVE-08 (`route-soundness-repair`) under the rule in
  slice 1: whichever lands second deletes `legacy_coverage` and merges `main` first.
- **Feeds the merge-queue candidates (D28):** HOST-06 is this goal's job-removing lever; its consumers are
  `merge-group-parity` and the gated `merge-queue-activation` in `explorations/github-merge-queue`:
  `merge-group-parity` waits on this goal (with route-soundness-repair and hosted-setup-tax) merging, and
  `merge-queue-activation` waits on `merge-group-parity`.

## Verification Commands

```sh
test "$(wc -m < goals/heavy-pool-diet/GOAL.md)" -le 4000
jq . goals/heavy-pool-diet/ops/manifest.json
rg -n "heavy-pool-diet|GOAL.md|agentLaunchers|packetAnchorDocument" goals/heavy-pool-diet
git diff --check -- goals/heavy-pool-diet
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug heavy-pool-diet`; add a `kind: checkpoint` file there, never edit this block._

### P0 lever re-check at b757bd0400f; PERIH-01 slice 1 lands before COVE-08, 2026-11-10

Lever status re-checked against origin/main b757bd0400f: #3041 merged as e8c9a47971b (LINT-02 slice 1 landed; LINT-05 and LINT-02 slice 2 unblocked), COVE-08 in route-soundness-repair has not landed, and heavy.yml@main declares neither Heavy / Coverage Regression nor Heavy / Test Integration, so the coverage-rollout probe always printed false. PERIH-01 slice 1 therefore deletes the probe, the legacy_integration output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion, and sets legacy_coverage to the literal 'false'; COVE-08 lands second and deletes it. The Tasks.ts, check.yml and JSDoc Ratchet citations in SPEC.md, PLAN.md, README.md, research/SOURCES.md and the manifest statusNote were moved to their b757bd0400f lines. P0 stays in-progress: the interim baseline census (bun run beep ci lane-timings --window --workflow check.yml, 24 h and 12 h windows ending 2026-11-10T00:00Z) failed both times on an HTTP 502 for one run's jobs page 2, so no baseline window is recorded yet. P1 is in-progress with slice 1.

Lane claude/awesome-chaplygin-626db8

Reverse: Revert the PERIH-01 slice 1 merge commit (check.yml, the two tests, packet files) and delete this checkpoint file.

### LINT-05 slice 5: hosted Lint Policy leaves the JSDoc pair to JSDoc Ratchet, 2026-11-12

P1 slice 5 (LINT-05) drops `jsdoc:inventory:check` and `jsdoc:ratchet:check` from the hosted Lint Policy plan, full scope (`fullScopeStateTasks`) and changed scope (the medium graph), only while `standards/branch-protection-contexts.json` lists `JSDoc Ratchet` as required. That lane runs `beep ci lane jsdoc-ratchet` (inventory then ratchet) on every head Lint Policy runs on: Lint Policy (`heavy.yml` `verify`) runs only on Heavy Admission's admitted heads, admission never admits a documentation-only diff, and JSDoc Ratchet (`check.yml` `jsdoc-ratchet`) skips only documentation-only diffs. Only a hosted plan reads the snapshot. A local plan, a hosted plan without the snapshot and a hosted plan whose ruleset no longer requires the context keep the pair, so the duplicate can cost time but never coverage. The plan test in `quality-tasks.test.ts` pins all four cases and shows the pair is the only difference. Hosted proof on draft #3135: on clean head 22b29e034ac, Heavy / Lint Policy (job 131572953270, full scope) passed and JSDoc Ratchet (job 131575513753) passed. On seeded head c0f69b7127f, where commit 9ebacd64ddc lowered `packagesNeedingRemediation` in the totals baseline from 15 to 14 (reverted before merge), JSDoc Ratchet (job 131585460322) failed with `packagesNeedingRemediation: 15 > 14 (+1)` and Heavy / Lint Policy (job 131585460827, full scope, 6 steps) passed. Neither Lint Policy log names `jsdoc:inventory:check` or `jsdoc:ratchet:check`. The scorecard reading of the saving stays open. Rejected: deleting the pair from the shared task lists (a local `bun run lint` would lose the inventory) and keying on `CI` alone (the drop would outlive the required context).

Lane perf/heavy-pool-diet-lint-05

Reverse: Revert the slice 5 squash commit; the hosted Lint Policy plan then runs jsdoc:inventory:check and jsdoc:ratchet:check again.

### PERIH-01 slice 1 merged in #3116; required names proven on a code head, 2026-11-12

#3116 merged as aec8dbf57bd on 2026-11-12. Before the merge, Check run 42775621719 on code head fcbedcaa604 reported Heavy / Test Integration (success) and Heavy / Coverage Regression under their exact required names, and neither Test Integration Partitions nor Coverage Artifact Migration appeared. Coverage Regression was red on nine ratchet rows, all inherited from #3068 (87837893fd7) and identical on main at b757bd0400f and 2cadc8caa0d; the PR merged over that red under S11. A docs head only runs the new check.yml once it is on main, so no docs-head proof existed at merge time; the documentation-only PR that adds this checkpoint is that docs head, and its run is the docs-head reading. The Publish Beep CI Binary run on aec8dbf57bd failed on an HTTP 403 from gh release create after compile and smoke passed, so release beep-ci-aec8dbf57bde does not exist; later main commits published normally.

Lane docs/heavy-pool-diet-perih-01-proof · PR #3116

Reverse: Revert the #3116 squash commit aec8dbf57bd; this checkpoint then records history only.

### PERIH-01 slice 1 post-merge review fixes, 2026-11-12

The post-merge review of #3116 found four residues, all fixed here. (1) The PLAN slice 1 gate claimed both required names on a docs head; on a docs head the skipped coverage-regression job shows its unevaluated name expression, so the gate now says Test Integration is proven on both heads and the docs-head half of Coverage Regression waits on COVE-08 (route-soundness-repair). (2) docs/runbooks/ci-coverage-artifacts.md still described the deleted resolved-SHA lookup; it now says heavy.yml@main declares no Coverage Regression job and legacy_coverage is the constant 'false' until COVE-08. (3) ci-runner-security.test.ts exempted check.yml:Test Integration Partitions, a job name #3116 removed; the entry is gone and the descriptor census now fails on any exemption that matches no live job context. (4) SPEC.md and research/SOURCES.md cited check.yml by line numbers that moved; they now cite jobs and steps by name.

Lane docs/perih-01-review-fixes

Reverse: Revert this PR's squash commit; it changes only prose, citations and one test assertion.

### PERIH-11 slice 1: binary releases gated on a closure digest, 2026-11-12

PLAN slice 2 lands PERIH-11 slice 1 (absorbing PERIH-08). `bun run beep ci binary-closure` computes the static runtime import closure of `packages/tooling/tool/cli/src/bin-ci.ts` with the policy-fingerprint graph reader (a new follow-all `moduleClosure` beside the shell and command walks), adds the manifest of every workspace it reaches, the whole `src` of any reached workspace with a non-literal dynamic import, and the build inputs `bun.lock`, `.bun-version`, `bunfig.toml`, every file under `patches/`, `CiCompileBinary.ts` and `.github/workflows/beep-ci-binary.yml`, and digests the sorted listing with sha256. At 466be5b825e the closure is 345 files (341 before `patches/` joined it).

`beep-ci-binary.yml` computes that digest before compiling, compares it with the digest recorded in the `beep-linux-x64.closure.json` asset of the latest `beep-ci-*` release, and skips compile, smoke and publish on a match. Every release now carries the digest in its notes and that asset. The path list stays as a coarse prefilter and gains `bunfig.toml` and `patches/**`. A `workflow_dispatch` input `verify_reproducible` recompiles an unchanged closure and fails unless the sha256 equals the latest release's; that run is the hosted proof that an unchanged closure compiles to the same bytes.

Scope calls:
- `CiOperational.patterns.json` stays outside the closure. The binary reads the checkout's copy at run time (`changeProfilePatterns` in `CiOperational.service.ts`), and the file is a projection of the compiled-in `ciOperationalPatterns`, whose TypeScript source the closure already covers. The SPEC acceptance text does not name the file, so this is a recorded scope call, not a deviation.
- The root `package.json` is outside the closure: `bun.lock` records the resolved versions, and including the root manifest would release on every script edit. The patch files under `patches/` are inside it: `bun.lock` `patchedDependencies` records only each patch's path, so a patch edit would otherwise leave the digest unchanged while `bun install` applies different code (review finding on #3145). No patched package is reachable from `bin-ci.ts` today, so this costs a release only when a patch changes.
- The policy-fingerprint walker was generalized in place (one `moduleClosure` method, plus exported `livePolicySourceTree` and `readPolicyWorkspaces`). `bun run beep lint policy-fingerprint` reports `current`: no policy command's import closure changed, so `standards/policy-tools.fingerprint.json` needed no reseal.

The mutation fixtures are `packages/tooling/tool/cli/test/ci-binary-closure.test.ts`: edits to `CiBinary.ts`, a reached `@beep/utils` module, `bun.lock`, `.bun-version`, the workflow and a patch file move the digest; a new import edge pulls its module in; edits to a `goals/` file, `@beep/git`, an unreached repo-cli command and `CiOperational.patterns.json` leave it unchanged; the digest is independent of workspace order. The first main push after merge publishes once (no earlier release records a digest); the closure-skip reading of the next push and the reproducibility dispatch are recorded after merge.

Lane claude/jolly-hopper-9a2206 · PR #3145

Reverse: Revert the slice's squash commit; beep-ci-binary.yml then releases on its path list again and the closure command disappears.

### Baselines before d8326d5593 are not comparable (declaration-only builds), 2026-11-13

declaration-only-builds PR 2 (#3208) merged at `d8326d55935849b4bf6fd29ec4ef80327efd6af8` (2026-11-13T05:44:35Z). Library builds are now `tsrs -p tsconfig.json --emitDeclarationOnly`: no Babel step, no `babel` script key, no JavaScript in a library dist.

- Every `#build` cache entry (local, remote, CI) misses once from that commit. The first run after merging main rebuilds cold and is not a regression.
- Any wall-time, cache-size or dist-size baseline this packet recorded before that commit is not comparable with a reading after it. Re-take the baseline before reading an after-number.
- Measured by the owning goal (181 packages, serial, fastest of three): build 80.9 s to 32.9 s, dist 232.5 MB to 147.9 MB, compile unchanged (`goals/declaration-only-builds/research/2026-11-13-build-after.md`).
- A lane editing generated files (package.json scripts, the catalog, turbo.json, the policy fingerprint, the cache baseline, the check-census baseline) merges main first and re-runs the generators.

Lane chore/ci-goals-finish

Reverse: Delete this checkpoint; it records a fact about main and changes no behaviour.

### Check-lane baselines before 3e822c71c5 are not comparable (check once), 2026-11-13

declaration-only-builds PR 3 (#3242, "check once") merged at `3e822c71c5` (2026-11-13). The root Turbo `check` task now depends on the package's own `build` for declaration-only packages, and their `beep:check` runs the declaration-only build command instead of a separate no-emit check.

- Every `check` task hash misses once from that commit. The first run after merging main is cold and is not a regression.
- Build minutes now sit inside the check lane: Heavy / Check and Heavy / Build start together on separate VMs, so on a cold hash both compute the same build. A check-lane wall-time or runner-minute baseline recorded before that commit is not comparable with a reading after it. Re-take the baseline before reading an after-number.
- The cache-qualification and check-census baselines were re-recorded in that PR; a reading that compares against either must use the post-merge files.
- Measured by the owning goal on main at `d8326d55935` (182 packages, serial): own-source check 35.4 s, a warm unchanged build 19.7 s; the saving from checking once is 15.7 s serial.
- `TSRS_FAST` is a global Turbo input and part of the tsrs incremental state: record with each baseline whether it was set.
- Follow-up this makes possible, not scheduled here: folding Heavy / Build into Heavy / Check (one fewer fleet VM per run), a heavy-pool-diet slice.

Lane docs/check-lane-baseline-break

Reverse: Delete this checkpoint; it records a fact about main and changes no behaviour.

### First main closure-gate runs after #3145 failed before the digest comparison, 2026-11-13

#3145 merged as 87c4dc204c8 on 2026-11-13. The first four `Beep CI Binary` runs on main after it failed in "Compare the closure digest with the latest release" with `Missing required flag: --list` (job 131612442366 and siblings): runs 43342046581, 43342105606, 43342142443 and 43342189531, on main pushes 87c4dc204c8 through d1c7c6cb63f. `beep ci binary-closure` declared `--list` as a boolean flag without a default, so the CLI required it, and the workflow calls the command with `--out` only. Every run stopped before compile, so no release was cut and the pinned binary at `.github/actions/fetch-beep-ci/action.yml` was never affected. The two runs before #3145 (61ac4497363, f3cd33a2969) passed on the old path trigger.

These runs therefore say nothing yet about closure skips: none reached the digest comparison. #3165 gives `--list` a default of false and adds `ci-binary-closure-command.test.ts`, which runs the workflow's exact `--out`-only invocation through the registered command (red without the default, green with it). The same command with the default in place exits 0 in about 3 s and writes a 345-file closure JSON. In the same PR, `ci-binary-closure.test.ts` resolves the checkout root with `fs.realPath` inside each test, which satisfies EV010 without the inventory row #3145 added (S31). The first main push after #3165 publishes the first digest-recording release; the closure-skip reading is the main push after that whose closure is unchanged.

Lane fix/ci-binary-closure-ev010 · PR #3165

Reverse: Revert #3165's squash commit; the release workflow then fails at the closure step again and the closure test needs its EV010 inventory row back.

### LINT-01 residual: noResolve parity fixtures and whole-repo byte parity, 2026-11-13

PLAN slice 4 pays the LINT-01 gate items #3019 left unpaid. The inventory gains an internal
`JSDocInventoryProgramOptions` argument that defaults to the production `{ noResolve: true }`; it has no CLI
flag or env var. `jsdoc-inventory-noresolve-parity.test.ts` adds merged-namespace and module-augmentation
fixtures and reuses the star-export, local named re-export and overload fixtures, which now live in
`test/jsdoc-inventory-fixtures.ts`. It asserts that the inventory built with `noResolve: true` strictly equals
the inventory built with `noResolve: false`, and that both match an explicit 25-row listing. It also asserts
that the resolving program really loads the augmented package. A whole-repo run with resolution forced on
produced byte-identical jsonc and md minus `generatedAt` across 196 packages. The production wall time was
2:11 against 10:22. Digests, commands and timings are in
`history/2026-11-13-lint-01-noresolve-parity.md`. No real difference between the modes was found, so the
lever's gate holds. Namespace members are not scored as separate entries today, and the listing pins that.
The hosted JSDoc Ratchet timing goes into the same history file.

Lane test/heavy-pool-diet-noresolve-fixtures · PR #3301

Reverse: Revert this PR's squash commit; the fixtures and the parity record disappear and the inventory is unchanged.

### PERIH-11: the closure digest covers tsconfig chains; dispatches run on main only, 2026-11-13

A post-merge review of #3145, #3165, #3183 and #3185 found three gaps, all fixed in one PR.

- The digest missed TypeScript configuration. When Bun bundles, it resolves `compilerOptions.paths` before `node_modules` and the exports map, and it honours emit options such as `jsx` and `verbatimModuleSyntax`. The root `tsconfig.json` carries the `@beep/*` path aliases (written by tsconfig-sync) and `tsconfig.base.json` sets `jsx` and `verbatimModuleSyntax`. So an alias or emit edit could change the binary while the digest held, and the workflow would keep a stale release. The closure now adds each reached workspace's `tsconfig.json`, every file on its relative `extends` chain, and the root `tsconfig.json`. A package-specifier `extends` resolves into `node_modules`, which `bun.lock` pins. The closure grows from 345 to 361 files. The workflow path prefilter gains the root `tsconfig.json` and `tsconfig.base.json`, so an edit to those starts the run. Including whole workspace tsconfigs, `references` included, adds little release churn: tsconfig-sync rewrites references only when a dependency changes, and the changed `package.json` already moves the digest.
- A `workflow_dispatch` from a non-default ref joined the single `beep-ci-binary` concurrency group #3185 introduced. It could take a pending main push's slot, get the main push cancelled, then skip its own job, leaving a closure change unpublished. The group is now keyed on `github.ref`.
- A `verify_reproducible` dispatch from a non-default ref skipped the whole job and showed green without comparing bytes. The job-level ref condition is now a first step that fails on any ref other than the default branch. When `verify_reproducible` is set and the closure changed, the summary says the run did not verify anything.
- Including the root `tsconfig.json` would otherwise cut byte-identical releases: on main it changed 20 times in the 14 days to 2026-11-13 (tsconfig-sync adds alias entries whenever a package is added or renamed), and `tsconfig.base.json` changed 4 times. A changed digest now leads to a compile followed by a byte comparison with the latest release's `beep-linux-x64.sha256`. When the bytes match, the workflow re-uploads `beep-linux-x64.closure.json` onto that release with `--clobber` and appends a "re-recorded" line to its notes. It cuts no new release, and the next run sees the closure as unchanged and skips the compile. This rests on the build being reproducible, which run 43353769826 showed. Rejected: digesting only the alias entries the closure resolves, which is tighter but more code and more ways to be wrong.

Lane fix/ci-binary-closure-tsconfig

Reverse: Revert this PR's squash commit; tsconfig edits then stop moving the digest and a non-main dispatch skips green again.

### PERIH-11 slice 1 read on main: unchanged closures skip, and recompile byte for byte, 2026-11-13

After #3165 (2ca2885bf09) fixed the `--list` default, the `Beep CI Binary` runs on main read as follows (closure digest, then outcome):

- 2ca2885bf09, run 43347759308: digest 40dcf6635fef; the latest release (beep-ci-61ac4497363e) recorded no digest, so it compiled and published beep-ci-2ca2885bf097, the first release that records a digest.
- ad71f5cdb67, run 43347787888: same digest 40dcf6635fef, but it also compiled and published (beep-ci-ad71f5cdb675). It overlapped run 43347759308 and listed the releases before that run had published, so it compared against beep-ci-61ac4497363e. The per-SHA concurrency group lets runs for different commits overlap; serializing them is a separate small PR.
- 3b85830d051, run 43350867866: digest 40dcf6635fef equals the recorded digest, so the job skipped compile, smoke and publish. This is the first closure skip.
- 202927595d6, run 43351886883: digest 6560e02c00f9 changed, so the job compiled and published beep-ci-202927595d64.
- 0f7a40369eb (run 43351914611) and 29ccc707fa9 (run 43352789758): digest 6560e02c00f9 unchanged, so both skipped.

Reproducibility: the `verify_reproducible` dispatch on main at 29ccc707fa9 (run 43353769826) found the closure unchanged, recompiled anyway, and matched beep-ci-202927595d64 byte for byte (sha256 98a0a2483f6e...). The release was built from 202927595d6, a different commit with the same closure, so an unchanged closure compiles to the same binary on hosted CI. PLAN slice 2's admission gate is met. The pin-bump automation is slice 7.

Lane fix/ci-binary-closure-coverage

Reverse: Records hosted readings only; revert this checkpoint file if the runs are re-read differently.

### PERIH-11 slice 2: a published release opens one reviewed pin-bump PR, 2026-11-13

PLAN slice 7 lands PERIH-11 slice 2. When `beep-ci-binary.yml` publishes a new `beep-ci-*` release on main (the closure digest changed and the compiled bytes differ from the latest release), the same job rewrites the pin in `.github/actions/fetch-beep-ci/action.yml` and opens one pull request for review.

- The rewrite is `bun run beep ci binary-pin --tag <beep-ci-...> --sha256 <hex> [--check|--write]`, a source-CLI command beside `binary-closure` and `compile-binary`. It decodes the tag (`beep-ci-` plus 12 lowercase hex) and the digest (`@beep/schema/Sha256` `Sha256Hex`), rewrites exactly the `BEEP_CI_RELEASE_TAG` and `BEEP_CI_SHA256` values, and fails typed when the file holds none or more than one of either line. `test/ci-binary-pin.test.ts` covers the idempotent rewrite, malformed tags and digests, and missing or duplicated pin lines. It stays out of `bin-ci.ts`: the release job has the toolchain installed, and the binary surface would grow for a command no pre-toolchain job runs.
- No pull request for an unchanged closure (skip path), a byte-identical recompile (re-record path), a `verify_reproducible` dispatch or a non-default ref: the rewrite step requires the publish step's `published=true` output, `!inputs.verify_reproducible` and the default-branch ref, and the three pull-request steps require the rewrite step to have succeeded. The "Require the default branch" guard and the ref-keyed concurrency group are unchanged.
- One pin-bump pull request at a time: `peter-evans/create-pull-request` always uses the branch `ci/beep-ci-pin-bump`. A newer release force-updates that branch and refreshes the open pull request's title and body instead of opening a second one. The pull request is labelled `ready-for-heavy` and is never auto-merged.
- Credential: the knowledge-mint GitHub App (`KNOWLEDGE_MINT_APP_CLIENT_ID`, `KNOWLEDGE_MINT_APP_PRIVATE_KEY`), the same App `knowledge-baseline-mint.yml` uses to open pull requests and `catalog-regeneration.yml` and `skills-update-train.yml` use to push. Its pull requests start workflows (#3015 ran Check and Heavy), which a `github.token` pull request does not. The token is minted in the step right before the pull-request step with contents, pull-requests and issues write (issues only for the label), and only that step reads it. The job's own `permissions` did not grow. The App holds no `workflows` permission and needs none, because the pin is a composite action, not a workflow file. A fail-closed step stops the job when the App variable is missing, and the run summary always prints the four commands an agent runs to open the pull request by hand.
- `bun run beep ci binary-closure` moved from 34ec6eee1b3f to fd2f159d8fc3 on this branch, only because the workflow file is a closure input. `bin-ci.ts` and its imports are unchanged, so the first main run after merge should compile identical bytes and take the re-record path: no release and no pin-bump pull request.

Still to read on main after merge: that first run re-recording rather than publishing; the first real closure change opening one pin-bump pull request that passes its own Check; and a closure-unchanged push opening none.

Lane ci/heavy-pool-diet-pin-bump-pr · PR #3299

Reverse: Revert this PR's squash commit; pin bumps are then hand-written again.

<!-- beep:decisions:end -->
