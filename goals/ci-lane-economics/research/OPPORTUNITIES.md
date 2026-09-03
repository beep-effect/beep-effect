# ci-lane-economics — friction and opportunity ledger

Record receipts at the moment friction happens (what you were doing, the
evidence, what would have prevented it). Redact for the public repo.

## Seed context (2026-08-13, from the split)

- Pre-cache hosted p50s: Lint ~43.6m, Test Unit ~23m, Property Laws ~22.4m.
- The ~9-minute type-graph import inside vitest re-pays per heavy-import
  suite; caching cannot fix it — per-slice sharding is the lever.
- Fleet Docgen/Lint hangs from the runMain success-exit class are FIXED
  (#673); do not let historical hang data pollute the census.

## 2026-08-13 — the lane-timings collector stops before the census boundary

- **Doing:** building the P0 cache-warm census from the Check workflow after
  the #673/#674 rollout boundary.
- **Evidence:** `bun run beep ci lane-timings --help` can select only the most
  recent 1-100 runs. It cannot select a workflow, event, time/SHA boundary, or
  required contexts, and its rows omit run event/SHA plus Turbo task hit counts.
  The census therefore required separate Actions run/job/log API joins; one
  unquoted `?filter=all` endpoint also triggered zsh glob expansion before the
  call reached `gh`.
- **Would have prevented it:** make `ci lane-timings` accept workflow,
  since/until, event, and job-name filters; carry run metadata into every row;
  and parse the final Turbo `Cached: X cached, Y total` line for lanes declared
  `uses_turbo: "true"`. The collector should emit the percentile and flake
  populations separately so later packets do not rebuild this join ad hoc.

## 2026-08-13 — required-context metadata drifted from the live ruleset

- **Doing:** reconciling the P0 lane table with the repo-local CI lane registry.
- **Evidence:** live ruleset `10240248` returns 16 required contexts and omits
  `JSDoc Ratchet`, while `CiLane.ts` marked that visible lane `required: true`
  and its test described a frozen 17-context set.
- **Would have prevented it:** generate or periodically verify the descriptor's
  `required` flags against the live ruleset, with an explicit offline snapshot
  and provenance date rather than hand-maintained metadata.

## 2026-08-13 — raw phase edits accept invalid status tokens until schema proof

- **Doing:** advancing the packet from P1 into P2 after signing the placement
  decision.
- **Evidence:** `jq` accepted `"in_progress"`, but the canonical
  `GoalPhaseStatus` is `"in-progress"`. The mistake surfaced as two failures
  only after the five-minute repo-CLI test lane reached the tracked-manifest
  census.
- **Would have prevented it:** a schema-aware goal phase-transition command, or
  running `bun run beep goals doctor` immediately after every raw manifest
  status edit and before any broad test lane.

## 2026-08-13 — Yeet repair hint contradicted its structured failed sublane

- **Doing:** attributing the first full publish proof failure after the P0/P1
  packet update and initial P2 CI changes.
- **Evidence:** the structured proof result identified only `quality:lint` as
  failed and showed SAST passing, but the terminal repair hint classified the
  failure as SAST. A direct goal-index check then identified the actual lint
  failure: `goals/INDEX.md` had not been regenerated after the manifest phase
  changes.
- **Would have prevented it:** derive the repair hint from Yeet's structured
  failed-sublane result before applying broad output fingerprints, and have the
  manifest writer regenerate or explicitly name the goal-index follow-up.

## 2026-08-13 — Bun cannot directly refresh a transitive-only package

- **Doing:** clearing a newly revised Nano ID advisory that appeared between
  two Yeet publication attempts.
- **Evidence:** `bun update nanoid` added Nano ID 6 as a root dependency while
  leaving PostCSS on vulnerable Nano ID 3.3.17; refreshing or temporarily
  adding/removing the package also restored the stale transitive lock entry.
  The minimal repair was a one-line lock resolution to 3.3.18 using the npm
  registry integrity, proven by frozen install and the repository security
  lane.
- **Would have prevented it:** a documented repo command for refreshing one
  transitive resolution without adding a root dependency, or a package-manager
  mode that accepts a transitive package plus exact version and preserves it
  after the temporary root edge is removed.

## 2026-08-13 — trusted file dependency installed without its build artifact

- **Doing:** completing the clean-HEAD Yeet proof after the CI lane changes.
- **Evidence:** a fresh frozen install left the trusted file dependency
  `@pulumi/gharunners` without its ignored `bin/` output. Both the package Check
  task and the independent test-tsgo census then resolved generated TypeScript
  source under the repository's stricter compiler policy and failed. Running
  the dependency's own postinstall produced its intended JavaScript and
  declarations, after which both infra typecheck shapes passed.
- **Would have prevented it:** make the root install lifecycle explicitly run
  the generated SDK's postinstall; do not rely on Bun to execute lifecycle
  scripts for a trusted `file:` dependency nested under a workspace.

## 2026-08-13 — a failed matrix job cannot be retried while its workflow is running

- **Doing:** recovering the first P2 hosted admission wave after `Test
  Integration` lost its GitHub-hosted runner.
- **Evidence:** PR #684 attempt-one run `31723283969`, job `94525310886`,
  received the runner shutdown signal after 10m25s; the verification step was
  cancelled and four Turbo tasks exited 137. A targeted job-rerun API call then
  returned `403: The workflow run containing this job is already running`, so
  recovery had to wait for unrelated long-running matrix jobs to finish. The
  accepted targeted retry, job `94533388363`, then reproduced the shutdown on a
  different hosted runner after 11m21s total / 8m05s of Turbo work, firing the
  packet's hosted-placement rollback.
- **Would have prevented it:** give required lanes independently rerunnable
  workflow boundaries, or add an external closeout retry policy that recognizes
  the runner-shutdown signature and retries the failed job once the workflow is
  terminal without laundering the failed attempt into duration percentiles.

## 2026-08-13 — retrying an obsolete run cancels the current-head matrix

- **Doing:** closing PR #684 after rolling `Test Integration` back from the
  GitHub-hosted experiment to `beep-ec2-heavy`.
- **Evidence:** current-head run `31726953139` started for the rollback commit,
  but a targeted retry of pre-rollback run `31723283969` was accepted at
  17:42:22Z. The shared workflow concurrency group began cancelling every
  current-head job during checkout at 17:42:24Z, leaving a wall of red checks
  with no source task having run. Cancelling the obsolete retry was required
  before publishing a fresh exact-head run.
- **Would have prevented it:** scope retry automation to the PR's current head
  SHA and refuse stale-run reruns; alternatively include the head SHA in the
  concurrency key so a stale diagnostic retry cannot evict current-head proof.

## 2026-08-13 — concurrent checkout proofs contaminated local lane timings

- **Doing:** running the exact-head full Yeet proof to establish correctness
  and collect clean local task weights for the P2 Coverage redesign.
- **Evidence:** five independent checkout proofs were simultaneously running
  the test-tsgo census on the same host. The exact-head proof finished green,
  but its CPU-bound wall times were resource-contended and therefore are not
  representative performance weights.
- **Would have prevented it:** a host-wide quality concurrency lease or
  fleet-aware local scheduler that serializes heavyweight proof phases across
  sibling checkouts while allowing unrelated lightweight work to continue.

## 2026-08-13 — local coverage timing hid fleet contention

- **Doing:** admitting the five-shard Coverage Regression redesign on the live
  32-GB fleet runner after its complete local proof passed.
- **Evidence:** PR #698 job `94583467537` passed all 124 package comparisons but
  took 22m18s. Its 43-second prebuild was not the bottleneck: four mixed shards
  took 14m59s-15m54s while the isolated `@beep/repo-cli` shard stretched from
  its 12m48 baseline weight to 20m16s under five simultaneous Vitest coverage
  processes.
- **Would have prevented it:** a fleet-parity performance runner for admission
  tests, or a coverage planner invariant that caps aggregate shard concurrency
  at the runner's already accepted Turbo concurrency.

## 2026-08-13 — review-fix proof omitted a blocking Effect law

- **Doing:** publishing the final review fixes for the P2 Coverage redesign.
- **Evidence:** two consecutive `yeet repair --tier review-fix` passes completed
  green, but the hosted Lint Policy job then found one introduced `effect-fn`
  violation in `Ci.command.ts`: an `Effect.forEach` callback directly returned
  `Effect.gen`. The focused `bun run beep laws effect-fn --check` caught the
  corrected shape immediately.
- **Would have prevented it:** include every blocking hosted policy law in the
  review-fix tier, or report excluded blocking sublanes explicitly before the
  tier can be treated as publish-ready proof.

## 2026-08-13 — cold hosted build failed once but passed clean reproduction

- **Doing:** admitting the four-shard Coverage shape after PR cache access was
  changed to local-only on main.
- **Evidence:** exact-head job `94603831042` failed during its prebuild with
  transient `@beep/nlp` TypeScript/Effect diagnostics after 17 of 52 tasks. A
  fresh detached clone of the same commit then completed the full local-only
  root build with 128/128 tasks, zero cache hits, in 1m11s.
- **Would have prevented it:** make cold-build repeatability a first-class CI
  probe and automatically retry this diagnostic signature once before
  classifying it as a deterministic source failure.

## 2026-08-13 — Turbo concurrency did not bound Vitest worker fan-out

- **Doing:** admitting the four-shard Coverage Regression candidate on the
  existing eight-vCPU fleet runner.
- **Evidence:** PR #698 job `94608048289` took 24m10s and failed. Three mixed
  shards passed in 15m30s-16m46s; the shard containing `@beep/repo-cli` took
  19m13s and failed ten explicit 5-second timeout tests plus one 1-second
  timing assertion. Although each shard used Turbo concurrency one, every
  package-local Vitest process could still size its worker pool from the whole
  host, oversubscribing four co-resident shards.
- **Would have prevented it:** treat subprocess worker pools as part of the
  lane's aggregate concurrency budget and pass an explicit per-shard Vitest
  worker cap derived from host vCPUs divided by shard count.

## 2026-08-13 — cold hosted prebuild flaked a second time

- **Doing:** admitting the two-worker four-shard Coverage Regression candidate
  on PR #698.
- **Evidence:** run `31753283207`, job `94623544457`, failed after 1m26s when
  the cold prebuild reported `thunk.ts is not a module` and missing exports
  after five successful tasks. A clean detached worktree at exact merge ref
  `c72c8e1ab3` then passed all 128 forced build tasks with zero cache hits in
  1m03s. Targeted retry job `94625871718` passed the same prebuild.
- **Would have prevented it:** make cold-build repeatability a first-class CI
  probe and retry this known impossible-diagnostic signature once before
  classifying it as a deterministic source failure.

## 2026-08-13 — uniform two-worker cap preserved correctness but missed time

- **Doing:** admitting the two-worker four-shard Coverage Regression candidate
  on the existing eight-vCPU fleet runner.
- **Evidence:** targeted retry job `94625871718` passed every test and compared
  all 124 package summaries, but took 23m23s. Its cold prebuild took 3m38s and
  the four shards took 15m32s, 16m58s, 17m26s, and 18m23s. The cap removed the
  prior repo-cli timeouts but left insufficient CPU throughput for the charter.
- **Would have prevented it:** a fleet-parity capacity model that includes the
  cold prebuild and tests a small bounded worker-cap curve instead of treating
  host-vCPU equality as the only safe candidate.

## 2026-08-13 — uniform three-worker cap added contention without throughput

- **Doing:** admitting the four-shard, three-worker Coverage Regression
  candidate on PR #707.
- **Evidence:** run `31759003628`, job `94641084512`, failed after 23m08s. The
  cold prebuild took 3m30s; the three mixed shards passed in 16m05s, 16m32s,
  and 17m16s, while the repo-cli shard failed after 18m16s when a bounded-work
  assertion measured 1026.30ms against its 1000ms ceiling. There was no OOM or
  runner shutdown. The repo-cli Vitest config disables file parallelism, so
  raising `maxWorkers` could not shorten its 728.76 seconds of serial imports.
- **Would have prevented it:** profile the long pole's Vitest configuration and
  phase breakdown before raising a uniform worker cap; explicitly parallelize
  the serial file-import boundary under a bounded coverage-only worker pool.

## 2026-08-13 — root lint-fix did not accept file paths

- **Doing:** formatting the focused Coverage Regression implementation files.
- **Evidence:** `bun run lint:fix -- <two paths>` routed the paths to Turbo as
  task names and exited with `Missing tasks in project`; no files were changed.
- **Would have prevented it:** expose or document a canonical file-scoped
  formatter entrypoint distinct from the root task-oriented lint-fix command.

## 2026-08-13 — stale zero-cache flags became mutually exclusive

- **Doing:** running the forced local full-path proof for the five-shard
  coverage candidate.
- **Evidence:** Turbo 2.10 rejected `--force --remote-only` before executing a
  task because cache configuration cannot be combined with `force`; the prior
  proof recipe had treated both as compatible zero-cache controls.
- **Would have prevented it:** keep one canonical forced-execution recipe in
  the packet or CLI and validate it against the pinned Turbo version.

## 2026-08-13 — main advanced across an expensive local proof

- **Doing:** proving and preparing the five-shard PR #707 revision for
  publication.
- **Evidence:** `origin/main` advanced from `ddc8a873b1` to `5ca003a342` while
  the forced full coverage proof ran, including a concurrent edit to this
  ledger. Rebasing therefore required additive conflict resolution and made
  the successful old-base proof non-authoritative for the final head.
- **Would have prevented it:** refresh and pin the intended merge base
  immediately before expensive proof, and serialize writes to the active
  packet ledger while an admission candidate is being closed out.

## 2026-08-13 — main advanced again between verification and publish

- **Doing:** publishing the fully verified five-shard PR #707 revision.
- **Evidence:** Yeet reused the exact full proof but refused publication because
  `origin/main` advanced from `5ca003a342` to `9c621da122` and overlapped the
  coverage task test. The landed commit also edited all three active packet
  evidence files, requiring another additive rebase and making the completed
  proof non-authoritative for the final head.
- **Would have prevented it:** serialize the final proof/publish window for an
  active packet, or have the publisher pin and atomically lease-check the base
  before starting the expensive proof.

## 2026-08-13 — rebased cold prebuild hit transient TS2589

- **Doing:** repeating the forced full-coverage proof after rebasing PR #707
  onto the newly advanced main.
- **Evidence:** the zero-cache prebuild stopped after nine seconds when
  `@beep/box` reported `TS2589: Type instantiation is excessively deep and
  possibly infinite`; an immediate focused `@beep/box` build passed in under
  one second without a source change. A retry moved the same failure to
  `@beep/xai` after 60 successful tasks; its immediate focused build also
  passed. A process census showed a sibling checkout simultaneously running
  many Vitest workers and a high-CPU tsgo check on the shared host.
- **Would have prevented it:** retry this known transient compiler-depth
  signature once at the failed package boundary before discarding an otherwise
  admissible full-path proof.

## 2026-08-14 — wall-clock perf assertion still flakes under capped coverage shards

- **Doing:** babysitting PR #695 (unrelated refactor) through the post-#698
  sharded Coverage Regression lane.
- **Evidence:** run `31757037521` job `94634965992`: `coverage:shard-1`
  (`--maxWorkers=2`) failed only
  `test/qa-command.test.ts > JudgeCheck JSON extraction > stays bounded on
  pathological balanced-object output` — `expected 1050.17 to be less than
  1000`; 1513 of 1519 passed. The worker cap fixed the 5-second timeout class
  but a 1000ms wall-clock bound still sits within instrumentation jitter, so
  any root-file-touching PR can draw this flake. Rerun attributed as
  environment-only, not content.
- **Would have prevented it:** exempt wall-clock performance assertions from
  the coverage runtime (env-guard them off when coverage instrumentation is
  active) or express the bound relative to an in-run calibration constant
  instead of absolute milliseconds.

## 2026-08-14 — green correctness merged before timing admission

- **Doing:** monitoring the final PR #707 Coverage Regression wave and waiting
  to admit or reject the five-shard shape against the packet's 20-minute gate.
- **Evidence:** job `94664247028` completed green in 23m14s, with the
  verification step itself taking 22m00s. The PR was merged externally three
  seconds after the job ended, before the timing evidence could be classified
  and the packet closeout state could be written. The implementation is
  correctness-green but economics-rejected, so a successor PR is required.
- **Would have prevented it:** hold merge until the active packet records its
  admission decision, or make packet admission/closeout a protected required
  context for performance-governed changes.

## 2026-08-14 — moving main carried a stale generated goal index

- **Doing:** running the canonical full Yeet verification for the bounded
  eight-shard successor after refreshing to the latest `origin/main`.
- **Evidence:** build, security, lint subcommands, and all 128 package
  typechecks passed, but the aggregate lint lane exited only because
  `goals/INDEX.md` on the refreshed base reported 143 packets while the live
  manifests projected 144. The candidate changes no goal manifest; regenerating
  the index changed only the packet and active counts.
- **Would have prevented it:** require the generated goal-index check on main
  before merge, or regenerate `goals/INDEX.md` in the PR that adds a packet
  manifest so unrelated successors do not inherit the drift.

## 2026-08-14 — eight-shard correctness merged before timing admission

- **Doing:** admitting PR #716's bounded eight-shard Coverage Regression shape
  against the packet's 20-minute live-fleet ceiling.
- **Evidence:** job `94695402310` passed every check without timeout, shutdown,
  or OOM, but took 22m18s. The PR merged externally 2m52s after the job ended,
  before the rejected timing result was written into the packet.
- **Would have prevented it:** require the packet's timing-admission decision
  before merging performance-governed changes, even when correctness is green.

## 2026-08-14 — checkout ownership changed during successor closeout

- **Doing:** publishing and monitoring the verified eight-shard successor from
  its feature branch.
- **Evidence:** the normal checkout was switched to unrelated runner work while
  the coverage branch was published, merged as #716, and deleted. Reconstructing
  the exact result required hosted PR state plus reflog evidence before the next
  candidate could start safely.
- **Would have prevented it:** serialize branch ownership through Yeet closeout,
  or reserve an explicit execution worktree for the performance admission loop.

## 2026-08-14 — nested worktree broke fixed-depth TypeScript resolution

- **Doing:** isolating the nine-shard candidate from unrelated work in the
  normal checkout, then running the focused repo-cli package typecheck.
- **Evidence:** a worktree nested under the repository made fixed-depth config
  paths resolve source from the parent checkout and emitted unrelated missing
  Node and `Float16Array` types; the candidate's 105 focused tests and Biome
  check passed in the same location.
- **Would have prevented it:** create execution worktrees as sibling checkouts,
  or make root/config resolution derive from the current Git common directory
  instead of assuming a fixed package depth.

## 2026-08-14 — scoped repair rewrote an unrelated inherited finding

- **Doing:** running the canonical Yeet repair pass for the nine-shard
  successor's five-file change set.
- **Evidence:** the terse-effect writer scanned outside the candidate scope and
  rewrote one inherited helper in `PostgresDrizzle.service.ts`; the same pass
  reported other inherited manual findings but did not rewrite them. The
  unrelated change had to be identified and removed before verification.
- **Would have prevented it:** constrain repair writers to the declared Yeet
  change set, or require explicit opt-in before a repair tier edits clean paths.

## 2026-08-14 — bundled Actions inspector depended on a broken Python shim

- **Doing:** classifying PR #719's terminal Coverage Regression failure with
  the repository's GitHub Actions inspection workflow.
- **Evidence:** the bundled `inspect_pr_checks.py` entrypoint stopped before
  reading the PR because its `python` command resolved through an invalid
  application shim; direct authenticated `gh run view --log-failed` remained
  usable.
- **Would have prevented it:** ship the inspector with a verified interpreter
  entrypoint or preflight the configured Python shim before routing CI
  diagnosis through it.

## 2026-08-14 — Node coverage Glob shim ignored static scan roots

- **Doing:** admitting the nine-shard Coverage Regression candidate on PR
  #719.
- **Evidence:** run `31794013295`, job `94746974171`, failed after 22m26s.
  The Node coverage shim recursively walked the complete repository for every
  `Bun.Glob`, including statically rooted architecture and workspace patterns.
  Concurrent scoped Biome directories disappeared during those unrelated
  walks, producing `ENOENT` in repo-cli and an opaque glob failure in
  repo-utils; the same scans consumed hundreds of seconds.
- **Would have prevented it:** derive the scan root and maximum non-recursive
  depth from each glob pattern, and treat a directory that disappears during a
  recursive walk as an empty branch.

## 2026-08-14 — local full-shard replay depended on implicit CI state

- **Doing:** replaying the repaired nine-shard Coverage Regression path before
  publication.
- **Evidence:** the root coverage command without `CI=true` silently selected
  the ordinary unsharded ratchet even with full-run arguments; its banner was
  the only indication, and the run had to be cancelled after 38 seconds. The
  same command with CI state selected `coverage:full` and nine queues.
- **Would have prevented it:** expose an explicit local full-sharded flag or
  dedicated replay command instead of making the execution shape depend on an
  implicit environment variable.

## 2026-08-14 — stale project reference raced the cold coverage prebuild

- **Doing:** admitting the repaired nine-shard Coverage Regression head on PR
  #719.
- **Evidence:** run `31799253491`, job `94763099702`, failed after 1m27s when
  `@beep/ontology-config` reported `thunk.ts is not a module` and cascading
  missing `@beep/utils` exports. The exact merge ref then passed all 128 forced
  build tasks with zero cache hits in 1m03s. Its cold task trace showed
  `@beep/ontology-config` starting beside `@beep/utils`; an unused Schema
  project reference made that early task recursively build
  Schema -> Data -> Utils outside Turbo's package dependency order.
- **Repair proof:** with the stale reference removed, the same forced,
  zero-cache, concurrency-four build passed 128/128 tasks in 56.2s. The
  `@beep/ontology-config` task completed without recursing into Schema, Data,
  or Utils while Turbo continued scheduling those packages itself.
- **Would have prevented it:** keep package project references aligned with
  actual workspace dependencies so Turbo is the sole cross-package build
  scheduler and no independent `tsc -b` process writes the same referenced
  projects concurrently.

## 2026-08-14 — repaired long pole kept an unnecessary worker while the mixed tail missed admission

- **Doing:** admitting the repaired nine-shard Coverage Regression head on PR
  #719 against the under-20-minute live-fleet ceiling.
- **Evidence:** run `31802039933`, job `94772037908`, passed every coverage
  test and all 127 baseline comparisons in 21m39s. The repaired repo-utils
  shard drained in 2m15s, repo-cli in 13m48s, and the seven mixed queues
  controlled wall time at 14m55s-16m44s. Repo-utils still held two workers
  while the measured bottleneck lacked enough independent queues.
- **Would have prevented it:** reallocate worker capacity after the
  infrastructure repair's first live profile—one repo-utils worker plus an
  eighth mixed queue preserves the aggregate cap while targeting the actual
  tail.

## 2026-08-30 — the timing collector still cannot express the P3 live week

- **Doing:** collecting the representative post-merge week of required PR and
  push jobs for the P3 p95 proof after required fleet lanes moved into the
  reusable `Heavy` workflow.
- **Evidence:** `bun run beep ci lane-timings --help` still accepts only
  `--runs 1-100`. `LaneTimings.ts` reads the latest unfiltered repository-wide
  Actions runs from `actions/runs?per_page=<limit>` and emits rows without the
  workflow, event, head SHA, or run timestamps needed to select and audit an
  exact seven-day population. The live ruleset now spans both ordinary Check
  contexts and six `Heavy / ...` contexts, so the latest 100 repository-wide
  workflows are neither a stable week boundary nor a complete lane census.
- **Would have prevented it:** add workflow, event, since/until, and head-SHA
  filters; retain run provenance on every row; paginate beyond 100 runs; and
  emit successful attempt-one percentiles separately from attributed failures,
  cancellations, and reruns.

## 2026-08-30 — installed gh rejects paginated slurp with inline jq

- **Doing:** counting Check and Heavy workflow runs inside the bounded P3 week
  without writing raw Actions payloads to disk.
- **Evidence:** both `gh api --paginate --slurp ... --jq ...` calls stopped at
  argument validation with ``the `--slurp` option is not supported with `--jq`
  or `--template` `` before making the API request.
- **Would have prevented it:** document the installed CLI's composition rule in
  the evidence recipe, or make `gh api` support applying its jq expression to
  the slurped page array; the compatible fallback is `--slurp | jq`.

## 2026-08-30 — nested command interpolation stopped the census before launch

- **Doing:** launching the bounded 476-run job join through the JavaScript tool
  wrapper while retaining shell variables inside an `xargs` worker.
- **Evidence:** the wrapper evaluated the nested shell expression first and
  stopped with `ReferenceError: run_id is not defined`; no API request or
  census row ran.
- **Would have prevented it:** escape nested shell interpolation in JavaScript
  template strings, or pass long collection commands through an argument form
  that does not give two languages ownership of the same `${...}` syntax.

## 2026-08-30 — parallel job fetches corrupted the NDJSON aggregation stream

- **Doing:** repeating the 476-run join with compact failure/rerun output after
  the first result exceeded the tool transcript limit.
- **Evidence:** twelve concurrent `gh api | jq -c` workers wrote to one pipe;
  their buffered output interleaved and the final reducer stopped at `jq:
  parse error: Invalid numeric literal`. The API fetches themselves continued
  until the broken downstream pipe closed.
- **Would have prevented it:** give each worker an isolated result channel and
  perform an ordered merge, or make the repository collector own paginated,
  bounded-concurrency joins instead of composing raw concurrent stdout.

## 2026-08-30 — the P2-to-P3 manifest transition drifted the goals index again

- **Doing:** running the collected cheap gates after moving the packet's P2
  phase to complete and P3 to in progress.
- **Evidence:** `cheap-gates:goals-index` failed with `local goals/INDEX.md
  drifts from goals/*/ops/manifest.json` and named `bun run beep goals index
  --write` as the repair. The remaining cheap preflight gates continued.
- **Would have prevented it:** make the phase-transition writer regenerate the
  local goals projection atomically, or make the gate repair this deterministic
  ignored projection before comparison.

## 2026-08-30 — overlapping test-tsgo lanes shared one checkout temp path

- **Doing:** running the required affected CI check beside the collected cheap
  gates; both independently entered the repository-wide `test-tsgo` census.
- **Evidence:** the cheap-gates process failed with `Failed to write
  node_modules/.tmp/tsgo-test-checks/packages-tooling-library-codegen-kit.tsconfig.json`
  while the affected CI-lane process completed all 953 files plus the tsgo
  smoke check successfully.
- **Would have prevented it:** namespace `test-tsgo` temporary directories by
  invocation, or serialize this census within one checkout even when the outer
  commands do not use heavyweight admission.

## 2026-08-30 — queued publish had no durable resume handle

- **Doing:** waiting for the single publish-time full proof to receive machine
  admission after the evidence commit was created.
- **Evidence:** the live publish reported scheduler position three, then its
  observation handle returned `Unknown process id`. Current process and
  scheduler state contained neither the publish process nor its ticket, while
  the remote branch and PR were still absent. The retained Yeet verdict covered
  only the earlier cheap-gates run, so no admitted full proof had started.
- **Would have prevented it:** make queued publish sessions durable and
  reattachable across agent continuations, or persist a Yeet resume command
  that can prove whether admission and each later publish phase began before
  safely resuming from the first incomplete phase.

## 2026-08-30 — admission wait ended at a second repository lock

- **Doing:** resuming only the missing merge-preview parity phase after an
  interrupted publish had already passed cheap-gates and pre-push.
- **Evidence:** `bun run beep yeet verify --ci-parity` remained in scheduler
  position three for 1,729 seconds, then exited before parity with `Another Yeet
  full proof for this repository is active.` The machine admission ticket and
  repository origin lock were both healthy, but they serialized independently,
  turning one wait into a terminal second-lock refusal.
- **Would have prevented it:** make origin-lock availability part of scheduler
  admission eligibility, or keep the admitted command waiting on its live
  origin owner while preserving queue position instead of failing after the
  machine-budget wait has completed.

## 2026-08-30 — publish monitor treated pending checks as a failed lane

- **Doing:** completing the one admitted `yeet publish --pr --monitor` cycle
  after the exact head had been pushed and PR #930 had opened.
- **Evidence:** the full pre-push and CI-parity lanes passed, but
  `monitor:02-pr-checks-watch` exited after 964 ms while the status summary
  reported 17 required checks, zero failing, and ten pending. The verdict still
  labeled the monitor lane failed and proposed rerunning the Nix lane even
  though Nix was pending rather than failed.
- **Would have prevented it:** keep the monitor attached while required checks
  are pending, and derive repair commands only from terminal failing required
  contexts rather than from a generic nonzero pending-check exit.

## 2026-08-30 — combined post-merge fetch lost the base tracking ref

- **Doing:** proving PR #930 merged before cleaning its deleted remote topic
  ref, while refreshing `origin/main` for the ancestry check.
- **Evidence:** a single fetch requested both the live main ref and the already
  deleted topic ref; it stopped with `couldn't find remote ref`, after which a
  main-only prune fetch failed with `cannot lock ref` because `origin/HEAD`
  pointed at the now-missing `origin/main`. The configured origin fetchspec
  restored `origin/main` to merge commit `8adba76f`, and the guarded ancestry
  check then passed.
- **Would have prevented it:** fetch the durable base independently from an
  optional topic ref, confirm the topic with `ls-remote`, and prune only that
  exact tracking ref after the base ref and merge ancestry are proven.

## 2026-09-03 — prior CI-economics memory recap was missing

- **Doing:** recovering the prior P2/P3 evidence context before reproducing the
  current-ruleset census and signing the next repair decision.
- **Evidence:** the durable memory registry named a CI-lane-economics rollout
  summary, but that referenced file was absent from the rollout-summary
  directory; only the older August 13 census recap was present.
- **Would have prevented it:** validate registry targets when producing durable
  memory summaries, or retain the packet-local evidence as the only canonical
  handoff pointer.

## 2026-09-03 — Actions job logs require explicit escape-sequence consent

- **Doing:** fetching a representative p90-tail job log to extract Turbo task
  counts, cache outcomes, and the package-level long poles.
- **Evidence:** `gh api .../actions/jobs/<id>/logs` refused to emit the log
  because it contains terminal escape sequences and left the redirected raw
  file empty; the diagnostic requires `--allow-escape-sequences`.
- **Would have prevented it:** make the packet's log-collection recipe include
  the explicit flag, or provide a structured Turbo-summary artifact that avoids
  terminal control data entirely.

## 2026-09-03 — historical PR heads no longer equal their associated PR head

- **Doing:** checking whether each representative tail wave changed `bun.lock`
  or root configuration by comparing its head SHA with the PR base SHA.
- **Evidence:** the commits-to-pulls endpoint associated several historical
  commits with a PR whose current `head.sha` had advanced, so an exact-head
  predicate left 14 of 29 selected heads without a base even though the PR
  association was still present.
- **Would have prevented it:** retain the run-time PR number and base SHA in the
  census corpus, or archive a per-run compare receipt before the branch head can
  advance or disappear.

## 2026-09-03 — hosted-runner disk documentation does not describe live geometry

- **Doing:** deciding whether Lint and Test Unit can safely avoid destructive
  image cleanup from their measured disk headroom.
- **Evidence:** GitHub documents 14 GB SSD for standard Ubuntu runners, while
  every one of the 87 current tail logs reported a 145 GiB root with at least
  86 GiB free before cleanup; the cleanup reclaimed 21–22 GiB. The published
  capacity cannot establish a safe unconditional skip for this live image.
- **Would have prevented it:** expose a stable runner-image free-space
  guarantee or make the workflow gate cleanup from its own pre-step `df`
  census, retaining the current cleanup below an evidence-backed threshold.

## 2026-09-03 — manifest evidence update again drifted the goals index

- **Doing:** verifying packet bookkeeping after adding the three P3 research
  reports and signed repair status to the initiative manifest.
- **Evidence:** `bun run beep goals index --check` failed with `local
  goals/INDEX.md drifts from goals/*/ops/manifest.json` even though
  `goals doctor` had already reported no blocking findings.
- **Would have prevented it:** make manifest-changing packet commands update
  the deterministic goals projection atomically, or have `goals doctor`
  surface projection drift before a separate index check.

## 2026-09-03 — architecture gate cannot validate a plain role-file addition

- **Doing:** running the required architecture gate before adding the CI lane
  partition-table role beside the existing lane command.
- **Evidence:** `bun run beep architecture` only listed subcommands, while
  `bun run beep architecture check` exited with `Missing required flag:
  --file`; the check accepts only a previously emitted architecture operation
  plan and has no mode for validating an ordinary role file.
- **Would have prevented it:** document the applicable command for a plain
  role-file addition, or add an architecture check mode that validates the
  live source topology without requiring a generated mutation plan.

## 2026-09-03 — bun test cannot initialize the Effect Vitest suite

- **Doing:** running the first focused partition-table proof with the packet's
  permitted `bun test packages/tooling/tool/cli/test/ci-lane.test.ts` command.
- **Evidence:** Bun's test runner failed before test collection inside
  `@vitest/runner` with `TypeError: undefined is not an object (evaluating
  'runner.config')` at the first `@effect/vitest` layer suite.
- **Would have prevented it:** route `@effect/vitest` files through the repo's
  Vitest configuration by default, or make the documented Bun fallback reject
  incompatible suites with a direct diagnostic.

## 2026-09-03 — the threaded fallback conflicts with command-test cwd isolation

- **Doing:** running both required focused suites with the sandbox-safe Vitest
  thread pool after the Bun runner failed during suite initialization.
- **Evidence:** all 58 collected CI-lane tests passed, but three pre-existing
  command tests failed at their temporary-repository setup with
  `process.chdir() is not supported in workers`.
- **Would have prevented it:** make command tests pass an explicit working
  directory instead of mutating process-wide cwd, or document a mixed proof
  command that uses threads only for suites without cwd isolation.

## 2026-09-03 — Turbo has no base flag for affected selection

- **Doing:** proving all five PR-shaped partitions with the signed
  `--affected --base origin/main` lane invocation.
- **Evidence:** the CLI initially forwarded both shape arguments into Turbo
  2.10.12, which rejected every dry run with `unexpected argument '--base'
  found`; the existing lane contract carries the base to Turbo through
  `TURBO_SCM_BASE` while forwarding only `--affected`.
- **Would have prevented it:** distinguish the outer `beep ci lane --base`
  flag from Turbo's environment-only base override in the implementation
  constraint and command example.

## 2026-09-03 — only does not suppress same-name task dependencies

- **Doing:** running the first forced Lint partition after its 134-task union
  proof selected the committed 67-package `lint-a` bin.
- **Evidence:** `turbo run lint --only --filter=@beep/colors` planned seven
  tasks, including six transitive `^lint` dependencies; the 67-filter forced
  run expanded to 106 tasks. In contrast, `turbo run @beep/colors#lint --only`
  planned exactly one task, and two explicit package task ids planned exactly
  two while retaining their package filters.
- **Would have prevented it:** make the Turbo guidance distinguish generic
  task names from package-qualified task ids when `dependsOn: ["^lint"]` is
  present, and include a dry-run exact-cardinality assertion in the shard spec.

## 2026-09-03 — managed sandbox blocks libpff symlink targets

- **Doing:** running the forced 67-package `unit-b` shard to prove its exact
  execution set and complete the three-bin Test Unit runtime proof.
- **Evidence:** the shard selected exactly 67 tasks, then two existing
  `@beep/libpff` tests failed with `EROFS: read-only file system` while creating
  symlinks whose targets were under `/var/tmp` and the external Bun install.
- **Would have prevented it:** provide the unit-shard proof in a native runner
  with writable test fixture targets, or make the libpff fixtures place their
  external-target substitutes beneath the workspace-approved temp root.

## 2026-09-03 — inherited schema export break blocks package verification

- **Doing:** running the required `@beep/repo-cli` package verifier after the
  focused shard contracts and runtime union proofs passed.
- **Evidence:** docgen passed, but the audit failed because
  `@beep/schema/Unknown` does not currently export `UnknownFromJsonString`;
  the same diagnostic appears across many untouched repo-cli files, and the
  pre-repair `CiLane.ts` already imported that symbol.
- **Would have prevented it:** keep the schema package and repo-cli consumer
  branch heads synchronized, or gate scoped work on a baseline package audit
  before creating a new failure-inbox row for inherited compiler failures.

## 2026-09-03 — managed sandbox blocks the Yeet base refresh

- **Doing:** running the canonical Yeet cheap-gates tier after the focused,
  partition, package, and workflow proofs.
- **Evidence:** `bun run beep yeet verify --tier cheap-gates` exited 255 before
  any quality gate because its mandatory `git fetch` could not update the
  sandbox's read-only `.git` metadata.
- **Would have prevented it:** run the canonical operator in a profile with
  writable Git metadata, or provide an explicitly offline verification mode
  that accepts a previously refreshed base ref.

## 2026-09-03 — package audit asserted a bare lint label that a live 1Password session rewrites

- **Doing:** running the required `beep quality package-verify @beep/repo-cli` handoff proof
  for the shard implementation on a workstation with a usable `op` session.
- **Evidence:** the audit's Vitest pass failed one untouched test,
  `keeps running repo-wide root lint policy checks after aggregate lint fails`, with
  `expected [ 'lint (op run)' ] to deeply equal [ 'lint' ]`; the same test passed once `op`
  was removed from `PATH`, and Yeet's own proof lanes never hit it because they run with
  `CI=true`.
- **Would have prevented it:** stub the secret-session predicate in the test or assert the
  label prefix, so the audit's verdict does not depend on whether the machine holds a
  1Password session.

## 2026-09-03 — stale schema build output masqueraded as new type errors

- **Doing:** running the package audit after cutting the branch from a moved `origin/main`
  without rebuilding dependency outputs.
- **Evidence:** `tsgo` reported `Module '"@beep/schema/Unknown"' has no exported member
  'UnknownFromJsonString'` across untouched CLI files; a
  `turbo run build --filter="@beep/repo-cli^..."` cleared every error in 24 seconds.
- **Would have prevented it:** make the package audit rebuild, or at least fingerprint,
  the dependency outputs it type-checks against, so a moved base cannot present as a
  branch regression.

## 2026-09-03 — a well-tested feature tripped a single-file coverage floor

- **Doing:** adding deterministic partition proof and execution tests after the scoped
  coverage ratchet rejected the CI lane economics repair.
- **Evidence:** the partition feature already had table-law and workflow-shape tests, but
  concentrating its runtime implementation in `CiLane.ts` lowered that file's committed
  branch, function, line, and statement rows even though package-level coverage remained
  broad.
- **Would have prevented it:** require end-to-end execution-path tests in the same change
  whenever a large runtime path is added to a file with a high committed per-file floor,
  and show the projected per-file delta before pre-push.

## 2026-09-03 — package verification used a sandbox-read-only uv cache

- **Doing:** running the required `@beep/repo-cli` package verifier after restoring the
  partition execution coverage row.
- **Evidence:** build, typecheck, 2,819 tests, and docgen passed, then the Python audit
  stopped because `uv` could not create a temporary lock beneath `~/.cache/uv`, which is
  read-only in the managed workspace profile.
- **Would have prevented it:** have the package verifier route `UV_CACHE_DIR` to the
  workspace-approved temporary root when the default user cache is not writable.

## 2026-09-03 — package verification hit a nondeterministic tmpfs reference probe

- **Doing:** rerunning the required `@beep/repo-cli` package verifier with its Python
  cache redirected to the writable temporary root.
- **Evidence:** the audit's earlier 146-file run passed the tmpfs suite, but the rerun
  observed `refCount` 0 instead of a live file-descriptor reference; the exact failing
  test passed immediately in isolated single-worker reproduction.
- **Would have prevented it:** make the tmpfs live-reference fixture wait for the
  descriptor to become visible before asserting, or retry the reference census within a
  small deterministic bound.
