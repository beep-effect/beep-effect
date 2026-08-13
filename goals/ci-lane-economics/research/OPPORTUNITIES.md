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
