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

## 2026-09-08: continuation found a resolved but unfinished base merge

- **Work:** locating the existing campaign before restarting the goal from a
  different checkout.
- **Evidence:** the campaign branch had implementation commit `2edf1f7f56`,
  `MERGE_HEAD` at `9fce883441`, 131 staged paths, and no unmerged index entries.
  The packet still named base `53193e5a5e`; `yeet status --remote` found no PR
  and a failed saved proof. The current merge candidate passed
  `fallow:health:baseline:check`, with all 189 entries matched, and reported
  207 suppressions with zero missing reasons or stale entries.
- **Cost:** the launcher checkout described P0 as pending while the existing
  campaign described implementation as complete. Git state, packet claims,
  and old proof output had to be reconciled before further work.
- **Prevention:** leave a continuation receipt naming the implementation
  commit, pending merge target, staged-state ownership, and last authoritative
  failure. Distinguish local acceptance evidence from hosted PR completion.

## 2026-09-08: a clean health comparison is not an empty health inventory

- **Work:** checking the completed tail against the packet's critical-finding
  acceptance language.
- **Evidence:** the baseline comparison exits 0 with an empty `findings`
  array, but an unbaselined `fallow:health --complexity-breakdown --report-only`
  scan retains three critical CRAP findings at cognitive scores 7, 8, and 12.
  No unwaived function exceeds cognitive 15. The chart baseline still has one
  `complexity_critical` count because Fallow combines cognitive and CRAP
  severity for `tooltipLabel`.
- **Cost:** treating either the empty regression array or the aggregate
  critical count as the cognitive-tail census would misstate acceptance.
- **Prevention:** report the unwaived cognitive-over-15 count separately from
  critical CRAP findings and baseline regressions. Keep the explicit 7-15
  non-goal and deferred runtime-coverage CRAP decision visible during closeout.
- **Resolution:** on 2026-09-08 the user confirmed the cognitive >15
  completion scope. The SPEC and launcher now require an explicit unwaived
  cognitive-tail census and retain critical estimated-CRAP findings below the
  ceiling as separately reported evidence.

## 2026-09-08: the command environment omitted the user runtime directory

- **Work:** checking the scheduler and user scopes before heavyweight proof.
- **Evidence:** `systemctl --user list-units 'agent-run-*.scope'` failed with
  `XDG_RUNTIME_DIR not defined`. The current user's runtime directory and bus
  socket existed. Supplying their verified paths to the command restored the
  user-manager query and allowed the host scheduler snapshot to be checked.
- **Cost:** an empty scheduler result without the runtime-directory context
  could have been mistaken for proof that no other admitted work existed.
- **Prevention:** preserve the desktop user's runtime directory and bus
  connection in agent command environments. When they are absent, verify the
  owning user and existing socket before supplying those paths; never reap
  work from a snapshot taken in a different coordination namespace.

## 2026-09-08: full docgen stopped on an unchanged scratchpad package

- **Work:** running `bun run beep yeet repair` after merging current main.
- **Evidence:** full docgen reported 117 successful tasks out of 126 before
  `@beep/scratchpad#docgen` exited 130. Its last phase was typechecking 3,172
  examples from 477 modules; no TypeScript diagnostic accompanied the exit.
  `git diff --name-only origin/main -- scratchpad` was empty. The available
  kernel journal query returned no OOM entry for that interval.
- **Cost:** the parent repair continued into builds while retaining the
  failed documentation step, so activity in a later phase did not imply that
  the preceding phase passed.
- **Prevention:** report completed wave verdicts from structured step results,
  and include termination cause and process identity in child-failure receipts.
  Treat this exit as unresolved until an isolated replay and the complete
  authoritative proof pass; do not classify it as a flake from the exit code.
- **Replay:** after the later base update and memory recovery, the exact
  scratchpad `bun run docgen` child command exited 0, compiling all 3,172
  examples from 477 modules. This resolves the isolated reproduction; it does
  not replace the required full-repository proof.

## 2026-09-08: the merged verification-plan test omitted blocking health

- **Work:** running the affected repo-CLI suite after integrating main's
  economics-based Yeet wave ordering with the campaign's health promotion.
- **Evidence:** `yeet.test.ts` failed the complete pre-push lane-list
  assertion. The current verification plan includes `fallow:health` as an
  unseeded preflight lane after the seeded lanes; the inherited expected list
  contained only audit and dead-code. The cheap tier already runs health
  before heavy feedback.
- **Resolution:** retain the ordered full-list assertion and add its missing
  `fallow:health` entry. This asserts that the promotion remains in the
  authoritative proof without changing the scheduler's unrelated ordering
  policy. A focused replay and package handoff check are required next.
- **Focused proof:** all 164 tests in `test/yeet.test.ts` passed in the
  isolated replay. `bun run beep quality package-verify @beep/repo-cli --quick`
  then passed lint and check. The quick subset matches this continuation's
  single test assertion edit; aggregate proof remains a separate requirement.

## 2026-09-08: system memory pressure killed repair and the CLI test runner

- **Work:** waiting for the affected tests in the same Yeet repair run.
- **Evidence:** seven test tasks passed, while the repo-CLI test process and
  repair parent exited with SIGKILL/137. The host journal at 15:34:25 local
  time records `earlyoom` killing both processes. One second later, the
  kernel killed a Codex process with roughly 80 GiB of anonymous resident
  memory. The previous repair handle is gone; no campaign process remained
  when the continuation inspected the process table.
- **Attribution:** the aggregate termination is environment-only. The
  independently reported health-lane assertion failure was a campaign merge
  repair and was fixed separately. Neither attribution makes the interrupted
  aggregate proof pass.
- **Prevention:** record host memory-pressure events alongside child exit
  codes, keep tool output bounded, and use the shared admission scheduler for
  heavyweight proof. Resume only after checking live process ownership and
  available memory, without killing unrelated work or weakening gates.

## 2026-09-08: the optional docgen wrapper rejects canonical example prose

- **Work:** isolating the scratchpad documentation termination with
  `bun run docgen:local --package @beep/scratchpad --parallel 1`.
- **Evidence:** the wrapper stopped in metadata analysis before compiling
  examples. It reported missing `@example` tags even where exports have the
  required titled `**Example**` sections. The current-main
  `Docgen/internal/quality/Quality.subjects.ts` still lists `@example` as a
  required export tag and derives examples only from `tagValues(tags,
  "example")`; those paths are unchanged by this campaign. The exact package
  docgen child then passed.
- **Attribution:** the wrapper metadata mismatch is inherited. The successful
  child replay provides a focused diagnostic; aggregate Yeet remains the
  acceptance command.
- **Prevention:** keep metadata recognition aligned with the canonical JSDoc
  section grammar and report wrapper metadata failures separately from the
  example compiler result.

## 2026-09-08: packet edits left the local Goals projection stale

- **Work:** running full Yeet verification after refreshing the manifest and
  evidence for Fallow 3.23.0.
- **Evidence:** the cheap-gate collection passed 14 lanes, including all 139
  package test typechecks and audit, dead-code, and health. Only
  `cheap-gates:goals-index` failed with `local goals/INDEX.md drifts`.
- **Attribution:** introduced projection drift from this continuation's
  packet edits; refresh it with `bun run beep goals index --write`, then run
  the complete verifier again.
- **Cost:** the collect-all cheap tier spent roughly eight minutes checking
  test types after the projection failure was already known.
- **Prevention:** regenerate and check manifest-derived local projections
  immediately after the final packet edit, before starting aggregate proof.

## 2026-09-08: an inherited archive dependency blocks the security lane

- **Work:** full Yeet verification after all 15 cheap gates passed.
- **Evidence:** OSV reported `GHSA-vwc7-r8mq-g2x9` for `adm-zip@0.6.0`, reached
  through `onnxruntime-node@1.29.0`. The security lane exited 1. Both versions
  remain npm latest, and the scanner reports no fixed version. The installed
  ONNX installer creates a predictable temporary directory and invokes ZIP
  extraction with overwrite enabled, matching the destination-symlink
  condition in the [advisory](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9).
- **Attribution:** inherited; `git diff origin/main -- bun.lock
  osv-scanner.toml` is empty at base `9b7553f618`. Identical dependency state
  does not make the vulnerability a false positive or the failing gate pass.
- **Boundary:** the launcher stops before dependency, lockfile, or security
  behavior changes. The user has been asked whether to authorize a private
  random extraction directory mitigation, regression proof, and a reviewed
  expiring exception while a fixed upstream release is unavailable. No such
  change has been applied.
- **Prevention:** surface newly published inherited dependency findings before
  the expensive proof phase, and distinguish attribution from risk acceptance.
- **Authorization and focused proof:** the user approved the installer
  mitigation and reviewed exception on 2026-09-08. A controlled test using the
  actual installer and real ZIP library reproduced an outside-file overwrite
  before the patch. With a private `mkdtempSync` workspace, both the success
  case and missing-entry cleanup case passed. Applying the pinned dependency
  patch and validating the installed result remain required.

## 2026-09-08: full proof repeats the same test typecheck command

- **Work:** waiting for full pre-push after the 15 cheap gates passed.
- **Evidence:** `cheap-gates:test-tsgo` ran `bun run beep quality test-tsgo`
  across 1,020 files and 139 packages and passed in about eight minutes. The
  later `quality:check:tsgo-tests` lane launched the same command again. The
  log reused exact audit and dead-code lane proofs, but not this differently
  named typecheck lane.
- **Cost:** a second broad compiler pass delays independent docgen and test
  failures even when the cheap tier already proved the same command.
- **Prevention:** evaluate shared proof identity for equivalent commands and
  inputs while preserving invalidation on source, configuration, or tool
  changes. This campaign records the observation without changing admission
  or proof-reuse policy.

### Approved mitigation integrated (2026-09-08)

The generated `onnxruntime-node@1.29.0` Bun patch now replaces timestamp-based
temporary directory reuse with atomic private `mkdtempSync` allocation. No
dependency versions changed. Frozen installation, both installed-dependency
regression tests, and the real local security lane pass. Eight CLI dispatch
tests pass, including rejection before OSV when the mitigation proof fails.
Hosted Security now runs the same proof before the scanner; the single-advisory
exception expires on September 15. The preceding full aggregate passed every
other lane, including coverage. Full proof including the mitigation remains
open. Keeping mitigation regression proof beside expiring exceptions would
have prevented a scanner-only acceptance decision.

### Generated patch context trips whitespace proof (2026-09-08)

`git diff --cached --check` flagged the new Bun patch's blank context markers
as trailing whitespace. The just-started verifier was intentionally interrupted
(exit 130) before proceeding. Regenerating the same source diff with zero
context removes those markers; Bun reapplied it in the isolated install, and
both the isolated and root frozen-install regression checks passed with the
identical intended installer source. Patch generation should account for the
repository's whitespace check before starting aggregate verification.

### Root regression proof needs a declared dependency (2026-09-08)

The first complete cheap-gate run after mitigation passed 14 of 15 lanes but
Knip reported `unlisted: scripts/test-onnxruntime-installer-patch.mjs#onnxruntime-node`.
The root script resolved a package installed for the face-detection workspace
without declaring its own dependency. The root development manifest now names
`onnxruntime-node` through the existing catalog, retaining resolved version
1.29.0 and the pinned patch. Root-script dependency checks should run alongside
regression proof before an aggregate that begins with repository typechecking.
No Knip baseline or suppression was added.

Frozen installation, the actual security gate, and Fallow audit passed after
that declaration. Knip now reports `current=2 baseline=2 introduced=0`.

### Commit-range gates limit pre-commit proof reuse (2026-09-08)

The current full verifier's SAST selector uses `origin/main...HEAD` and its
recorded Semgrep invocation omits the staged new root regression script.
Identical file bytes before and after committing therefore do not imply an
identical verification scope. Normal Yeet publish must prove the committed
candidate so the new script enters SAST; a pre-commit proof receipt alone is
insufficient for this campaign's publication. Making commit-range limitations
visible in verification receipts would prevent unsafe reuse assumptions.
The selector itself is unchanged in this goal.

A focused pre-publication replay applied the same Semgrep configurations to
all four staged JavaScript/TypeScript files, including the new script: 128
rules ran with zero findings. This supporting check does not replace the
normal committed-candidate publish proof.

### Committed command references expose a probe limitation (2026-09-08)

Publication passed security, SAST, build, test typechecking, full docgen,
integration tests, and lint, then stopped at semantic-delta with one introduced
finding in the SPEC: `Unknown beep command path: quality github-checks security.`
The command is executable, but its command group combines a positional mode
with a named subcommand. The knowledge resolver treats the mode as another
subcommand whenever the group has children. The new inline documentation
exposed this inherited probe limitation only after it entered HEAD; the earlier
pre-commit semantic-delta result did not cover it.

The SPEC and manifest now use `bun run beep ci lane security`, the existing
lane entry point that dispatches to the same mitigation proof and OSV scan.
No scanner exemption, command behavior, or probe implementation changes are
needed. Future command-surface work should distinguish positional arguments
from child commands, and verification receipts should identify HEAD-only
documentation scope alongside committed-range security scope.

The generated root failure packet suggested an OSV repair even though the
security lane passed; the precise lane result identified lint-policy and its
semantic-delta child. Repair routing should derive from that current child
failure instead of retaining the earlier security category.

### Main advanced while publication was proving the candidate (2026-09-08)

Main at `52fcc8d135` changed 599 files, including 15 campaign overlaps, and
promoted inline schema compilation to an error. The merge had one textual
conflict in the advisory explanation; the approved mitigation-specific reason
was retained. Three codec compilations added by the campaign's SHACL test
still needed adaptation after the automatic merge. They now reuse the existing
module-level codecs, and the full package handoff and repository Oxlint pass.

The health baseline and suppression inventory are unchanged after three fresh
checks. Refreshing the base immediately before publication exposed this
integration requirement; a clean textual merge alone would not have established
compliance with the newly enforced rule. The current-main candidate needs a
fresh aggregate proof, while the earlier successful run remains dated evidence.

### Concurrent mitigation landed during full verification (2026-09-08)

The user requested early PR publication to expose queued work to other agents.
The running verifier was deliberately interrupted after all 15 initial gates,
security, SAST, build, and desktop IPC passed. The publication freshness check
then found main at `663904610c`, with an overlapping ONNX installer replacement
already landed in PR #1017. Its scoped fflate override removes vulnerable
adm-zip and the temporary exception. The merge retained that upstream fix,
removed a duplicate patch registration introduced by automatic merging, and
adapted the campaign's pre-scan regression guard to the installed replacement
and its two private directories. Frozen installation and all three guard tests
pass. Opening the PR before a long aggregate would have made this overlap
visible earlier; the new early-publication workflow follows that preference.

### Early review clarified proxy configuration and acceptance (2026-09-08)

PR #1021 exposed two introduced review issues before its local proof was
admitted: Storybook's HMR endpoint was fixed to one proxy host, and checked
implementation criteria could be read as final verification. The proxy config
now derives its address from portless's supplied URL and leaves normal Vite
configuration in place when portless is absent or explicitly bypassed. The
SPEC separately lists unchecked published-commit proof, hosted readiness, and
packet closeout gates; the launcher's overall acceptance remains unchecked.
The queued proof was deliberately interrupted so a follow-up commit can
include both repairs. Treating proxy origin as runtime configuration and
separating implementation evidence from final acceptance would have prevented
these issues.

The focused Storybook handoff also caught a reference-version mismatch:
`.repos/effect` names the URL configuration constructor `Config.URL`, while
the pinned installed Effect version exposes `Config.url`. The final code uses
the installed API and reads environment configuration through Effect Config.
Reference-checkout API searches should be compared with the pinned package
exports before an integration is treated as compilable.

### Review caught formatter and bounded-traversal regressions (2026-09-08)

PR #1021 found that a nullish fallback erased intentional formatter suppression
and eager array flattening evaluated every SHACL shape before capping results.
The tooltip now uses an Option to distinguish an absent formatter from an
invoked formatter returning null or undefined. Both new suppression cases fail
on the prior code and pass after the repair; default and zero results also
pass. SHACL now traverses properties, subjects, and shapes lazily, stopping
after the property batch that reaches the limit, as the original loop did.
The focused validator test observes one violation construction with a cap and
all three without it. All nine UI tests and five bounded-validator tests pass.
Behavior-preservation review must include intentionally empty callback results
and traversal work, not just returned values. The new literal-default docgen
fixture also uses a titled Example section; its focused test passes.

A follow-up review caught an inherited zero-limit edge in that original loop:
an empty first property batch satisfied a zero cap and incorrectly reported
nonconformance. The cap now short-circuits only after an actual violation. A
zero limit returns no details while preserving conformance; the regression
also checks a conforming first property followed by a later violation. The
conforming zero-limit case fails before this correction.

### Proxy correction introduced a new complexity finding (2026-09-08)

Hosted Fallow audit and health rejected the first HMR review fix: `viteFinal`
rose to cognitive 12 and cyclomatic 15. The existing callback mixed proxy
transport selection with unrelated plugin, resolver, and filesystem settings.
Proxy transport settings now resolve once from the optional configured URL.
Vite's assembly preserves disabled HMR and consumes those settings through
its existing merge function. This retains the reviewed behavior without
repeating transport or nested-configuration guards; no baseline or threshold
is relaxed.

The first extraction still exceeded the per-file CRAP allowance; its reduced
version passed health but remained a new audit finding. The final assembly
reuses Vite's `mergeConfig` for nested options
and plugin ordering, then deduplicates the configured modules and filesystem
roots. Seven proxy cases also check retained plugin order, aliases, server
headers, filesystem strictness, source maps, and warning-limit precedence.
The health baseline check passes without changing the baseline or thresholds.

A separate local Fallow audit exited 137 during workstation memory exhaustion.
The earlyoom journal identifies its `quality fallow audit` process as a SIGKILL
target with less than one percent memory available and no free swap. This is
an environment failure, not a successful audit. Keep heavyweight work behind
admission and require a successful audit after memory recovers.

The successful rerun reports zero introduced Fallow audit findings. Storybook's
quick package verification and the unchanged health baseline also pass.
Hosted Lint Policy separately exposed line-sensitive schema inventory drift:
the new validator regression moved an existing advisory from line 14 to 19.
The canonical schema-first writer refreshes that location while retaining the
same advisory; review-test additions need this inventory check before push.

### Test fixture omitted a required Recharts payload field (2026-09-08)

The hosted Check lane passed all 246 package tasks, then its separate test
compiler rejected the new tooltip fixture: `graphicalItemId` is required by
Recharts' payload type. Runtime assertions and the normal package check had
passed because those checks did not compile this test surface. The fixture now
supplies the series identity. Test-only changes need the package test-typecheck
alongside their runtime assertions before publication.

### Publication mode did not match the requested queue behavior (2026-09-08)

The user asked for review fixes to be committed and pushed as soon as available.
Early PR mode pushed first but still entered the full local proof queue. After
the user explicitly requested skipping proof, `yeet publish --fast --monitor`
pushed the tooltip fixture fix and began hosted monitoring. Publication receipts
should state both when the push happens and whether local proof still follows;
the packet now records the authorized replacement of that wait.

### Final waiver and baseline retained obsolete allowances (2026-09-08)

The review fixes left four stale baseline entries and a tooltip CRAP allowance
that no longer reproduced. At the final wave boundary, the canonical writer
reduced the baseline from 189 to 185 entries, the tooltip line allowance fell
from 135 to 77, and its CRAP allowance was removed. The writer saved successfully
but exited 1 for retained unbaselined findings; all three subsequent baseline
comparisons exited 0. Record the writer and comparator outcomes separately.

Fast mode subsequently committed the final ratchet update but waited for
`full-proof(3)` admission before reaching push. The owned queued attempt was
interrupted, the reviewed commit was pushed directly, and Yeet hosted monitoring
continued. The user's no-queue publication instruction requires a path that
cannot wait for proof admission before push, even when dependency-sensitive
preflight is selected. No other agent's lease or process was changed.

The commit hook also added the canonical baseline's final newline, changing
its byte digest without changing any finding. Three fresh checks of published
`e08f77cdcb` now back the recorded digest. Capture exact baseline bytes after
formatter hooks before labeling a digest as published-commit evidence.
