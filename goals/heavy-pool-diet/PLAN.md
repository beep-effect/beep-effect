# Heavy Pool Diet Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | in-progress | Re-check lever status against `origin/main` (#3041, the Test Unit layout, PERIH-10) and fix the baseline window. | Lever table in `SPEC.md` current; scorecard baseline window (or interim `bun run beep ci lane-timings` readings) recorded under `history/`. |
| P1 Implement | in-progress | Land slices 1 to 12 below in order, at most three open PRs. | Every open lever landed behind its admission gate, or stopped with a decision file. |
| P2 Verify | pending | Read the acceptance numbers from the certainty scorecard over at least 7 days of code-head PR runs after the last diet lever. | Lint Policy p95, heavy slot-min per code run, admission-to-Heavy start and the post-diet heavy-queue p95 recorded under `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state; hand the heavy-queue p95 to the operator. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

PR-sized, in landing order. "Open now" means the slice needs nothing else from this or another goal. At most
three of this packet's PRs are open at once; slices 1 to 3 are the first three.

| # | Slice (PR title) | Levers | Size | Admission gate | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | `ci: delete the dead coverage-rollout probe` | PERIH-01 slice 1 | S | In one PR: the probe step, the `legacy_integration` output and the `test-integration` job's name conditional on `legacy_integration`, and the `LEGACY_COVERAGE` env line and assertion removed; Shared rule with COVE-08: COVE-08 (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. `ci-lane.test.ts` updated as well; Coverage Regression and Test Integration report under their exact required names on a code head and a docs head. Workflow PR: cache-policy baseline re-record if `cache audit` asks. | Landed (#3116, aec8dbf57bd) |
| 2 | `ci: gate binary releases on a closure projection` | PERIH-11 slice 1 (absorbs PERIH-08) | M | Closure mutation fixtures: a change inside the binary's import closure triggers a release, one outside it does not; `bun run beep ci compile-binary` sha256 unchanged for an unchanged closure. | Landed (this PR) |
| 3 | `perf(ci): run required heavy lanes first and decide heavy skips at job level` (first `heavy.yml` PR, additive under a migration name) | ORDER (D11), HOST-06 PR 1 | M | Heavy Admission emits the goals-only and Docgen decisions beside `route_skips`; route replay plus mutation fixtures (docs, goals, no-diff, unreadable base); ruleset parity ledger shows every required `Heavy / *` context reporting; Lint Policy still runs when Check is red. | Open now |
| 4 | `test(repo-cli): pin the noResolve JSDoc inventory contract with fixtures` | LINT-01 residual | S | New merged-namespace and module-augmentation (of an imported package) fixtures; a noResolve parity assertion over the existing star-export, named re-export and overload fixtures in `jsdoc-inventory-detector-fixes.test.ts`; inventory byte parity minus `generatedAt`; one hosted JSDoc Ratchet timing recorded. | A free PR slot |
| 4b | `test(repo-cli): pay the PR C checker parity gates` | LINT-04 residual | M | S2 prefilter generated from the retired-host rows and tested against them; P55 planted fixtures; S4 findings diff; P12/P11 814-assertion digest, diagnostics sha 44b7c59c9033de74 and an aliased-assertion fixture; P28 census and a WORKSPACE_MANIFEST_WALK re-key probe; per-file coverage floors hold. | A free PR slot |
| 5 | `perf(repo-cli): leave the JSDoc inventory to the required JSDoc Ratchet lane` | LINT-05 | S | Plan test: the hosted plan omits `jsdoc:inventory:check` and `jsdoc:ratchet:check` only while JSDoc Ratchet is required; seeded-red draft PR shows JSDoc Ratchet red and neither task in the Lint Policy log; identical Lint Policy findings otherwise. | #3041 merged; merge `main` after PERIH-02 if it landed first |
| 6 | `perf(ci): retire the heavy migration job names` (second `heavy.yml` PR) | ORDER (D11), HOST-06 PR 2 | S | `main` resolves the slice 3 workflow; parity ledger unchanged after the retirement. | Slice 3 merged and resolved on `main` |
| 7 | `ci: open a pin-bump PR on closure change` | PERIH-11 slice 2 | S | A closure change on `main` opens one reviewed pin-bump PR that passes its own Check; no PR for a release with an unchanged closure. | Slice 2 |
| 8 | `perf(repo-cli): derive the changed-scope state width from the remaining slots` | LINT-02 slice 2 (absorbs LINT-03) | S | Plan-shape test: summed width at most `policyLint`, medium at least 2 for every profile, doctor present in both scopes with unchanged argv; then the hosted A/B for LINT-02 (at least 10 runs per arm, p50 and p95 each at least 90 s better, memory.peak under 24 GB) recorded under `history/`. | Slice 5; #3041 merged |
| 9 | `ci: bundle ci admission in the CI binary with a closure-digest fallback` | PERIH-01 slice 2 | M | Replay of recorded events (draft, label, fork, docs, push, error) through binary and source gives byte-identical `verdict`, `route_skips` and `route_receipt`; a closure-digest mismatch fixture forces the head-install fallback. | Slice 7; PERIH-10 landed by `route-soundness-repair` |
| 10 | Pin-bump PR for the admission binary (opened by slice 7's automation) | PERIH-11, PERIH-01 | S | Passes its own Check on the new pin. | Slice 9 merged and released |
| 11 | `ci: switch Admission to the pinned binary after the pin bump` | PERIH-01 slice 3 | S | Heavy Admission in `check.yml` and `heavy-admit.yml` runs the binary without the workspace install; admission-to-Heavy start read on the scorecard; tested revert in the PR body. Workflow PR: cache-policy baseline re-record. | Slice 10 |
| 12 | `chore(ci): queue-inclusive leg-width A/B harness for Test Unit` | HOST-08 | M | Hosted A/B under 1, 2 and 4+ concurrent PRs: push-to-Test-Unit p95 at most 9.5 min per run, runner-minutes beside it, no queued-job growth at the ceiling; the adopt-or-not result is a decision file. | Test Unit steady state (decision file); MEAS-04 (`certainty-scorecard`); ROUT-01 already met (landed in #3030; `hosted-setup-tax`) |

The final PR of the goal carries the scorecard readings, `proposedCloseout` and the reflection; it may ride with
slice 12 or follow it.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

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

### PERIH-01 slice 1 merged in #3116; required names proven on a code head, 2026-11-12

#3116 merged as aec8dbf57bd on 2026-11-12. Before the merge, Check run 42775621719 on code head fcbedcaa604 reported Heavy / Test Integration (success) and Heavy / Coverage Regression under their exact required names, and neither Test Integration Partitions nor Coverage Artifact Migration appeared. Coverage Regression was red on nine ratchet rows, all inherited from #3068 (87837893fd7) and identical on main at b757bd0400f and 2cadc8caa0d; the PR merged over that red under S11. A docs head only runs the new check.yml once it is on main, so no docs-head proof existed at merge time; the documentation-only PR that adds this checkpoint is that docs head, and its run is the docs-head reading. The Publish Beep CI Binary run on aec8dbf57bd failed on an HTTP 403 from gh release create after compile and smoke passed, so release beep-ci-aec8dbf57bde does not exist; later main commits published normally.

Lane docs/heavy-pool-diet-perih-01-proof · PR #3116

Reverse: Revert the #3116 squash commit aec8dbf57bd; this checkpoint then records history only.

### PERIH-11 slice 1: binary releases gated on a closure digest, 2026-11-12

PLAN slice 2 lands PERIH-11 slice 1 (absorbing PERIH-08). `bun run beep ci binary-closure` computes the static runtime import closure of `packages/tooling/tool/cli/src/bin-ci.ts` with the policy-fingerprint graph reader (a new follow-all `moduleClosure` beside the shell and command walks), adds the manifest of every workspace it reaches, the whole `src` of any reached workspace with a non-literal dynamic import, and the build inputs `bun.lock`, `.bun-version`, `bunfig.toml`, `CiCompileBinary.ts` and `.github/workflows/beep-ci-binary.yml`, and digests the sorted listing with sha256. At 25452087e73 the closure is 341 files.

`beep-ci-binary.yml` computes that digest before compiling, compares it with the digest recorded in the `beep-linux-x64.closure.json` asset of the latest `beep-ci-*` release, and skips compile, smoke and publish on a match. Every release now carries the digest in its notes and that asset. The path list stays as a coarse prefilter and gains `bunfig.toml`. A `workflow_dispatch` input `verify_reproducible` recompiles an unchanged closure and fails unless the sha256 equals the latest release's; that run is the hosted proof that an unchanged closure compiles to the same bytes.

Scope calls:
- `CiOperational.patterns.json` stays outside the closure. The binary reads the checkout's copy at run time (`changeProfilePatterns` in `CiOperational.service.ts`), and the file is a projection of the compiled-in `ciOperationalPatterns`, whose TypeScript source the closure already covers. The SPEC acceptance text does not name the file, so this is a recorded scope call, not a deviation.
- The root `package.json` and `patches/` are outside the closure: `bun.lock` records resolved versions and patched dependencies, and none of the patched packages is reachable from `bin-ci.ts`. Including the root manifest would release on every script edit.
- The policy-fingerprint walker was generalized in place (one `moduleClosure` method, plus exported `livePolicySourceTree` and `readPolicyWorkspaces`). `bun run beep lint policy-fingerprint` reports `current`: no policy command's import closure changed, so `standards/policy-tools.fingerprint.json` needed no reseal.

The mutation fixtures are `packages/tooling/tool/cli/test/ci-binary-closure.test.ts`: edits to `CiBinary.ts`, a reached `@beep/utils` module, `bun.lock`, `.bun-version` and the workflow move the digest; a new import edge pulls its module in; edits to a `goals/` file, `@beep/git`, an unreached repo-cli command and `CiOperational.patterns.json` leave it unchanged; the digest is independent of workspace order. The first main push after merge publishes once (no earlier release records a digest); the closure-skip reading of the next push and the reproducibility dispatch are recorded after merge.

Lane claude/jolly-hopper-9a2206

Reverse: Revert the slice's squash commit; beep-ci-binary.yml then releases on its path list again and the closure command disappears.

<!-- beep:decisions:end -->
