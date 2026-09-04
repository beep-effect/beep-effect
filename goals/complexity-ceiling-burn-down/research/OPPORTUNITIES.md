# Research friction receipts

## 2026-09-03: the Yeet parent failure overrode the structured failing lane

- **Work:** attributing the final full Yeet verification failure before the
  current-main refresh.
- **Evidence:** the run verdict recorded `quality:jsdoc-ratchet` as failed and
  `pre-push:security` as passed, but the quality-issue index classified the
  parent `full:pre-push` exit as `security-audit` and recommended inspecting an
  OSV finding. The parent raw log had already been truncated before the JSDoc
  lane output.
- **Cost:** the generated repair command pointed at a green lane and obscured
  the actual failed sublane, requiring a manual verdict and inner-lane audit.
- **Prevention:** derive parent failure classification and repair routing from
  the structured child-lane results before applying raw-output fingerprints;
  never let a truncated parent excerpt override an identified failed child.

## 2026-09-03: focused Vitest forks timed out before collection

- **Work:** proving the scheduler/task test merge after refreshing the campaign
  onto current `origin/main`.
- **Evidence:** the two-file focused Vitest command exited after 120 seconds
  with `Timeout waiting for worker to respond` for both fork workers, zero test
  files collected, and zero tests executed; no other heavy repo process was
  active in the pre-run process snapshot.
- **Cost:** the default focused command spent two minutes without producing
  code evidence.
- **Prevention:** expose or document a canonical focused repo-CLI test command
  that uses a single thread worker on constrained sessions, while leaving the
  hosted/package proof topology unchanged.

## 2026-09-03: temporary Git fixtures inherited workstation signing

- **Work:** tracing the shared exit 128 in the current-main repo-CLI task tests.
- **Evidence:** after temporarily exposing the fixture helper's stderr, its
  synthetic-repository commit failed with `1Password: Could not connect to
  socket` because Git inherited the workstation's global commit-signing policy.
  `op-doctor` confirmed the service-account shim in the current shell and no
  desktop-integration journal activity; sandboxed systemd and vault probes were
  unavailable and were not retried.
- **Cost:** 17 otherwise independent tests failed at the shared fixture commit,
  hiding their actual assertions behind a workstation-specific human signing
  dependency.
- **Prevention:** make synthetic test-repository Git invocations explicitly use
  `commit.gpgSign=false`; test fixtures must not inherit the operator's signing
  or credential integrations.

## 2026-09-03: scoped coverage writes used a different verifier topology

- **Work:** accepting the six attributed coverage-denominator movements after
  the complexity extractions.
- **Evidence:** the scoped baseline writer forced `maxWorkers=2` for every
  selected owner and skipped one repo-CLI test under
  `VITEST_COVERAGE_REPORT_ONLY=1`. Full Yeet instead used weighted shards with
  two workers only for repo-CLI and one worker for the other owners; all tests
  passed, but 17 file floors fell below the mismatched writer output.
- **Cost:** a complete Yeet verification spent the full coverage budget before
  proving that the writer could not reproduce its own full-verifier metrics.
- **Prevention:** baseline regeneration and comparison must share one package
  sharding function, worker-count policy, and test inventory.
- **Resolution:** all baseline writes now use the weighted full-verifier shard
  topology, and the report-only test skip was removed. Focused planner tests
  assert one-worker short-owner shards and report-only propagation.

## 2026-09-03: exact coverage filters produced zero baseline shards

- **Work:** rerunning the four-owner remediation command after aligning writer
  and verifier topology.
- **Evidence:** `--filter=@beep/...` made the run scoped but left
  `expectedPackageNames` empty, so the prebuild ran without the intended
  package filters, the planner created zero shards, and the writer correctly
  refused to mutate the baseline because no summaries existed.
- **Cost:** the failed prebuild consumed time and exposed a planner path that
  could never satisfy the writer's completeness check.
- **Prevention:** parse exact inline and split Turbo filters into required
  coverage owners before planning; reject Turbo ranges, `--since`, and names
  without a workspace coverage script when writing a scoped baseline.
- **Resolution:** the option resolver now validates and deduplicates exact
  owners, the planner emits one verifier-equivalent shard per weighted group,
  and focused tests cover valid and unsupported selectors.

## 2026-09-03: a fixed scheduler wait invalidated an atomic coverage write

- **Work:** remeasuring the six attributed package owners with the scoped
  coverage-baseline writer.
- **Evidence:** five owners passed, but the unchanged repo-CLI test
  `stamps an older current ticket so a younger legacy client can drain`
  observed `blockedOnOriginAtMillis === 0` after its fixed 100 ms wait. The
  same test passed in the exact-main control and in the earlier full campaign
  verification; the writer correctly left the baseline untouched because one
  expected summary was missing.
- **Cost:** the atomic write discarded more than eight minutes of otherwise
  valid measurements and requires a full repo-CLI coverage rerun.
- **Prevention:** scheduler tests should wait on a bounded observable condition
  instead of assuming a background polling transition completes within one
  fixed 100 ms interval under coverage and machine contention.

## 2026-09-03: ignored projections contaminated a clean-main coverage control

- **Work:** attributing the final coverage-ratchet deltas by stashing the
  campaign and measuring the same package owners on exact `origin/main`.
- **Evidence:** the first clean tracked-tree run left the ignored
  `goals/INDEX.md` projection from the campaign in place, so
  `goals-bootstrap-plan.test.ts` observed the campaign's `4/5` row where exact
  main expected `0/5`; the other 2,904 repo-CLI tests passed. Regenerating the
  goals index and exploration Atlas from exact main made the isolated
  repo-CLI control pass all 2,905 tests and every committed coverage floor.
- **Cost:** the invalid control spent more than twelve minutes and could have
  falsely attributed a test failure to exact main or to nondeterministic
  coverage behavior.
- **Prevention:** a clean-base attribution recipe must refresh or remove every
  ignored generated projection after stashing tracked work and before running
  tests whose fixtures compare against those projections.

## 2026-09-03: latest-main refresh invalidated the fixed suppression count

- **Work:** refreshing the final Fallow evidence after fast-forwarding the
  campaign to the current `origin/main`.
- **Evidence:** the branch moved from `58e063757b` to `a1652c1923`; the
  current `fallow suppressions --format json` result increased from 194 to
  207 even though the campaign diff contains no added suppression marker.
- **Cost:** the previously refreshed no-growth criterion became false due only
  to independent mainline changes, forcing another packet and evidence update.
- **Prevention:** express no-growth acceptance against the exact-base inventory
  recorded by the final proof, while retaining prior counts as dated
  provenance instead of fixed stop conditions.

## 2026-09-03: the suppression acceptance gate lacks a stable comparator

- **Work:** refreshing the P0 complexity-tail inventory and proving that the
  campaign cannot grow Fallow suppressions.
- **Evidence:** `research/SOURCES.md` calls 78 the number of pragmas backfilled.
  Reconstructing calibration commit `3464a827e4` with its locked Fallow 3.10.0
  reports 91 analyzed suppressions; the live Fallow 3.22.0 inventory reports
  194. No committed 2026-07-30 suppression-total artifact preserved the
  original tool result.
- **Cost:** the packet's repo-wide acceptance criterion is already false by 103
  suppressions due to unrelated post-calibration work, and removing them would
  breach this goal's named scope.
- **Prevention:** commit a schema-versioned suppression inventory with every
  count-based ratchet, and define whether later packets gate the repo-wide total,
  per-kind totals, or only the initiating campaign's delta.
- **Resolution:** on 2026-09-03 the user declared the old packet scope stale and
  made the live Fallow 3.22.0 total of 194 the campaign's no-growth baseline.

## 2026-09-03: the health baseline drifted between wave boundaries

- **Work:** proving the packet's baseline-ratchet verification command before
  starting P1 implementation.
- **Evidence:** `bun run fallow:health:baseline:check` exits 1 on the packet-only
  branch with two inherited regressions and 108 of 385 baseline entries stale;
  neither reported source file differs on this branch.
- **Cost:** P1 cannot begin from the clean comparator assumed by the plan, and
  a later green result must distinguish campaign repairs from inherited drift.
- **Prevention:** run and, when intentionally shrinking, rewrite the health
  baseline in every PR that changes measured source identities; reject a wave
  boundary that leaves the baseline stale.

## 2026-09-03: the baseline writer reports a failing process after writing

- **Work:** shrinking `standards/fallow.health.regression-baseline.jsonc` at
  the completed implementation boundary.
- **Evidence:** `bun run fallow:health:baseline:write` rewrote the baseline but
  exited 1 because the unbaselined health scan still contained expected
  inherited findings. A subsequent `bun run fallow:health:baseline:check`
  exited 0 with 192 of 192 entries matched and zero stale entries.
- **Cost:** the writer's exit status looks like a failed write and produces a
  very large JSON report even with `--quiet`, so automation must inspect the
  resulting baseline and run the comparison before deciding whether the write
  succeeded.
- **Prevention:** give Fallow's baseline writer a write-specific success status
  or add a repo wrapper that writes, verifies the output artifact, performs the
  clean comparison, and reports one bounded summary.

## 2026-09-03: the Storybook process shim ran after the imports it guarded

- **Work:** recording the browser-QA evidence required for the refactored chart,
  waveform, and Orb components.
- **Evidence:** the portless Storybook preview remained blank and Playwright
  reported `ReferenceError: process is not defined` from
  `packages/foundation/modeling/utils/src/HostProcess.ts`. The existing shim was
  in `.storybook/preview.tsx`, whose static imports are evaluated first. Once
  rendering resumed, Vite also advertised the unproxied backend port for HMR,
  producing a failed secure WebSocket connection on every story.
- **Cost:** the first recorded QA round timed out without rendering a chart and
  had to be diagnosed and repeated.
- **Prevention:** install browser-global shims through Storybook `previewHead`,
  before the preview module graph evaluates; configure HMR for the public
  portless endpoint; and keep a dev-server smoke story in addition to
  browser-mode tests.

## 2026-09-03: packet proof named a nonexistent Fallow subcommand

- **Work:** reconciling the refreshed packet's verification commands before
  package and Yeet closeout.
- **Evidence:** `bun run beep quality fallow plan --check --quiet` exited 1 and
  listed `command-contract-check` and `ci-contract-check`; the promoted-lane
  proof actually lives at `beep quality github-checks plan-contract-check`.
- **Cost:** the stale command interrupted an otherwise independent suppression
  inventory and could have been mistaken for a lane regression.
- **Prevention:** source packet verification commands from the owning CLI help
  or command definition, and execute each command once before recording it.

## 2026-09-03: a package test tsconfig is not a standalone compiler entrypoint

- **Work:** proving one Effect diagnostic fix in the repo CLI after refreshing
  the checkout from `@effect/tsgo` 0.35.0 to the lockfile's 0.39.1.
- **Evidence:** `bunx tsgo -p packages/tooling/tool/cli/test/tsconfig.json
  --noEmit` reported the package's test files outside the inherited source
  `rootDir`; the repository command `bun run beep quality test-tsgo` supplies
  the intended test-compilation context.
- **Cost:** the apparently focused command produced hundreds of unrelated
  `TS6059` diagnostics and could obscure the one Effect diagnostic under test.
- **Prevention:** document or expose a package-scoped wrapper for the same
  compilation profile used by `beep quality test-tsgo`; until then, use the
  canonical repository runner for Effect diagnostics in test graphs.

## 2026-09-03: verification outlived its publication base

- **Work:** publishing the staged campaign immediately after its authoritative
  full Yeet verification completed.
- **Evidence:** `bun run beep yeet publish --staged-only --pr --monitor`
  refused because `origin/main` advanced by five commits during verification;
  four campaign-touched paths had also changed upstream.
- **Cost:** the successful full verification cannot authorize publication on
  the new base, so the campaign must refresh, reconcile the four overlaps, and
  repeat the proof before Yeet may publish it.
- **Prevention:** bind long-running verification to an upstream lease or make
  publish fast-forward, reconcile, and selectively rerun only gates whose
  inputs changed when the verified base advances during the same workflow.

## 2026-09-03: latest-main packet changes invalidated the ignored goals projection

- **Work:** rerunning the canonical Yeet repair after fast-forwarding the
  campaign across five new mainline commits.
- **Evidence:** every refreshed-base build, compiler, lint, docgen, Fallow, and
  affected test lane passed, but `feedback:00-cheap-gates` failed because the
  ignored local `goals/INDEX.md` did not include the newly landed packet
  manifests. Regenerating it made `bun run beep goals index --check` pass.
- **Cost:** the collect-all repair completed its eight-minute test compiler and
  five-minute affected-test fanout before reporting the sole projection drift.
- **Prevention:** regenerate ignored repository projections immediately after
  a mainline refresh, or make the refresh workflow update and verify them
  before starting long-running quality gates.

## 2026-09-03: the pre-push P0 pointed at a passing security lane

- **Work:** attributing the sole failure from the refreshed full Yeet
  verification.
- **Evidence:** the inner-lane journal recorded `quality:coverage` as the only
  failed child while secrets, security, SAST, and Nix all passed; the generated
  P0 packet nevertheless prescribed inspecting an OSV finding.
- **Cost:** the generated repair command sent diagnosis toward an unrelated
  green lane and hid the one-file coverage regression behind the parent
  `full:01-pre-push` label.
- **Prevention:** derive P0 classification and repair guidance from the failed
  child lane whenever a parent aggregate records its inner-lane journal.

## 2026-09-03: full-shard coverage lost a covered generator continuation

- **Work:** repairing the one branch regression reported after all ten full
  coverage shards passed their test suites.
- **Evidence:** the aggregate report measured the `completed` continuation in
  `AdmissionJournal.ts` at 98.94% branch coverage with one uncovered branch;
  an isolated verifier-shaped run of all 104 scheduler tests covered both
  outcomes at that line. Replacing the generator-local early-return branch
  with the existing Effect conditional helper preserves the same behavior
  without relying on that unstable V8 branch mapping.
- **Cost:** the eight-minute coverage run failed despite the relevant scenario
  being exercised, requiring report-level attribution and a focused replay.
- **Prevention:** keep generator continuations expressed through stable Effect
  combinators when V8 remaps a covered branch differently across merged worker
  reports, and retain an isolated full-test-file replay as attribution evidence.

## 2026-09-03: sandboxed scheduler status misclassified host work as dead

- **Work:** deciding whether a ten-minute full-proof admission wait was live
  backpressure or stale scheduler state.
- **Evidence:** scheduler status run inside the managed process namespace
  reported zero active tokens and classified the holder leases as dead, while
  the admitted wait stream continued receiving fresh holder heartbeats. A host
  systemd query then showed the scheduler-owned scope active with 707 tasks;
  the host-side guarded reaper correctly found nothing dead.
- **Cost:** the sandboxed snapshot pointed toward stopping an active heavy
  scope and forced an interruption, scope audit, and verifier restart before
  the wait could be classified safely.
- **Prevention:** scheduler status and reap must observe the same process and
  user-systemd namespace as admitted work, or fail closed when that namespace
  is unavailable instead of treating invisible host PIDs as dead.
