# Follow-up PR research: fail-fast Yeet and cycle-class removal

## Executive decision

Make `yeet verify` **wave-fail-fast by default**, not naively serial
stop-on-first: run a small bounded wave of cheap, independent, high-yield gates,
collect every failure already produced by that wave, and do not start later
expensive waves after the first failed wave. Keep an explicit
`--failure-policy collect-all` mode for large refactors, because the current
runner intentionally finishes all 21 serial lanes and reports their combined
failures only after the group completes. (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:897-939`,
`goals/quality-speedup/research/quality-time-inventory.md:88-93`)

Do not add a second overlapping `ship` state machine. Extend the already-shipped
`publish --start-pr-early` path, whose plan is commit → clean-HEAD preflight →
push/PR → full local proof → hosted monitor, but change the tail to run local
proof and hosted observation concurrently after an explicit cheap local gate.
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:533-563`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:345-392`,
`packages/tooling/tool/cli/test/yeet.test.ts:555-595`)

Treat “auto-fix hosted reds” as a later bounded orchestration phase, not part of
the first PR: today monitor is only `gh pr checks --watch`, and Yeet can route a
failed local command but has no structured hosted-job-log ingestion or agent
repair transition. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:420-450`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:524-552`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:226-243`)

## Evidence and scoring basis

Tonight required five 12–22 minute verify attempts and four publish attempts;
verify #4 paid a full 15-minute re-proof for one formatting nit, a generated
tuple change paid a failed 14-minute proof before its Fallow exemption was
added, and two publish failures were changeset mechanics. (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:10-23`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:45-53`)

The broader sample agrees that reruns are the target: `full:pre-push` averaged
1,022 seconds, failed in 20 of 101 observations, and was the largest recorded
local wall-time sink; hosted Coverage Regression, Lint Policy, Check, and Test
Integration failed at about 25%, 21%, 14%, and 14%, respectively. (`goals/quality-speedup/research/quality-time-inventory.md:58-71`,
`goals/quality-speedup/research/quality-time-inventory.md:78-86`,
`goals/quality-speedup/research/quality-time-inventory.md:103-111`)

“Round-trip eliminated” below means a long full-proof or manual recovery cycle
avoided; a fail-fast preflight may still require a short fix-and-rerun command.
That distinction is necessary because the retained artifacts do not record
attempt history or per-sub-lane timings, so exact end-to-end savings beyond the
cited incidents are estimates. (`goals/quality-speedup/research/quality-time-inventory.md:27-44`,
`goals/quality-speedup/research/quality-time-inventory.md:176-183`)

Implementation sizes are planning estimates from the cited mutation surfaces:
S ≈ 50–120 LOC, M ≈ 120–300 LOC, L ≈ 300–600 LOC, and XL >600 LOC, including
focused tests but excluding generated documentation. (`packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:650-713`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:136-196`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:185-227`)

## Ranked proposals

### 1. Add a cheap preflight wave before the full proof

**Why rank #1:** S–M, about 100–220 LOC; it would have converted at least the
documented 15-minute formatting failure, 14-minute Fallow failure, and two
changeset publish failures into early failures, avoiding up to four long-cycle
equivalents in tonight's sequence. This is an upper-bound incident replay, not
a claim that four literal command invocations disappear. (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:14-23`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:64-72`)

**Design:** introduce a `GithubCheckFailurePolicy = fail-fast | collect-all`
schema and execute ordered waves rather than projecting every lane directly to
a flat step list. The existing lane model already carries `id`, `stage`, and
`blockedBy`, but `githubCheckLaneSteps` currently discards that scheduling
metadata. (`packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:650-713`,
`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:137-167`)

Use this static first slice rather than a learned scheduler; current local
sub-lane history is too incomplete to support dynamic ranking.
(`goals/quality-speedup/research/quality-time-inventory.md:176-183`)

1. **Wave 0, bounded cheap/policy candidates:** changeset status, repo-sanity, Knip, blocking
   Fallow, secrets/security/SAST, and the clean-HEAD install preflight. The
   current composer puts changeset status after all quality, Fallow, and
   repo-sanity lanes, while the install preflight is independently measured at
   6.3 seconds and has not failed in 49 observations. (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:633-647`,
   `goals/quality-speedup/research/quality-time-inventory.md:80-85`)
2. **Wave 1, one heavy graph at a time:** build, lint, then check; build is
   relatively cheap in the available hosted/local samples, while Lint Policy
   and Check have much higher observed failure rates than Docgen. (`goals/quality-speedup/research/quality-time-inventory.md:58-70`,
   `goals/quality-speedup/research/quality-time-inventory.md:82-86`)
3. **Wave 2:** test; **Wave 3:** JSDoc ratchet and Docgen last, because their
   observed failure rates are 0% and about 2% despite p50s of 289 and 498
   seconds. (`goals/quality-speedup/research/quality-time-inventory.md:61-70`)

`fail-fast` completes the active wave and then stops scheduling; `collect-all`
runs every wave and preserves the current aggregate-failure behavior. This
avoids cancelling useful sibling evidence while still preventing a known cheap
red from launching Docgen or another heavy graph. (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:912-939`,
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:991-1020`)

The concurrency experiment should use existing stage boundaries: run at most
two of `repo-sanity`, `diff-security`, and `environment` concurrently, record
wall time and peak RSS, and fall back to one if the RSS gate fails; those stages
already exist in the lane schema. Keep build/check/lint/test mutually exclusive
until measurement proves otherwise:
local RSS is additive, three large checks can exceed 20 GB, and the locked grill
decision requires wall-time and peak-RSS evidence before pre-push
parallelization. (`packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:650-682`,
`goals/quality-speedup/research/instantiation-census.md:126-145`,
`goals/quality-speedup/history/2026-08-03-grill-decisions.md:33-37`)

**Code anchors:** `GithubCheckLaneSpec`/new failure policy in
`Quality.schemas.ts`; wave/family metadata and reordered constructors in
`internal/GithubChecks.ts`; a wave executor beside `runStreamingStepGroup` in
`Quality/Tasks.ts`; replace the flat `runGithubCheckLaneGroup` call in
`Quality.command.ts`. (`packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:650-713`,
`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:190-234`,
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:897-940`,
`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:633-647`)

**Falsification test:** replay one seeded failure per wave and assert later
waves are `not-run` under fail-fast but all same-wave failures are retained;
then compare full collect-all lane IDs/verdicts against today's 21-lane order.
Reject low-RSS concurrency if peak RSS or machine usability breaches the
census constraint, even if wall time improves. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:35-39`,
`goals/quality-speedup/research/quality-time-inventory.md:88-93`,
`goals/quality-speedup/research/quality-time-inventory.md:147-157`)

**Owner:** new `quality-speedup` CLI follow-up; it is not assigned in the locked
follow-up list, and the earlier decision explicitly deferred this work pending
RSS evidence. (`goals/quality-speedup/history/2026-08-03-grill-decisions.md:28-37`,
`goals/quality-speedup/history/2026-08-03-grill-decisions.md:61-67`)

### 2. Make publish retries accept the exact unpushed commit Yeet just created

**Why rank #2:** S, about 70–140 LOC; it directly removes the documented manual
`git reset --soft HEAD~1` recovery over 482 paths and at least one of tonight's
four publish attempts. (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:8-18`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:45-51`)

The contradiction is concrete: normal publish creates the commit before proof,
then tells the operator to amend or reset after proof failure, but the next run
calls `collectPublishIntent`, which rejects an empty index before it can reach
the commit phase. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:321-343`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:395-405`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:871-889`)

Add a durable `preparedCommit` checkpoint after commit with branch, base,
commit SHA, reviewed paths, and pushed=false. On retry, return a tagged publish
intent of `StagedIntent` or `PreparedCommitIntent`; accept the latter only when
HEAD and branch match the checkpoint, the worktree is clean, and the commit is
not already contained by the publish upstream. Arbitrary clean commits should
remain explicit through a future `--existing-commit` option rather than being
silently inferred. (`packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:843-926`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:245-287`,
`goals/one-round-loop/SPEC.md:47-55`)

`Handler.runPublishMode` then skips only intent collection/staging/commit for
the matching prepared commit and continues the cheap proof, push, PR, and
monitor states; this is distinct from current `--reuse-verified`, which accepts
a clean commit only after exact full-proof state matches. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:245-325`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:705-733`)

**Falsification test:** force a post-commit changeset failure, rerun publish
with an empty index, and require the same HEAD to resume without a new commit;
then change HEAD, dirty the tree, mark the commit pushed, and require all three
cases to fail closed. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:395-409`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:930-999`)

**Owner:** `one-round-loop` S2 already names “committed-branch mode,” but that
packet recorded P3 stretch as `wont_fix` until its round-trip trigger changes;
tonight's narrower “resume Yeet's own exact commit” can be reactivated there or
owned by the new follow-up without enabling arbitrary committed branches.
(`goals/one-round-loop/SPEC.md:9-15`, `goals/one-round-loop/SPEC.md:47-55`,
`goals/one-round-loop/PLAN.md:19-25`)

### 3. Add transactional per-lane proof resume, but use lane-scoped inputs for repair reuse

**Why rank #3:** L, about 350–550 LOC; exact-tree transactional checkpoints
eliminate up to one 17-minute cycle per interruption, but lane-scoped hashes are
required before claiming savings for tonight's fix-induced reruns. (`goals/quality-speedup/research/quality-time-inventory.md:120-126`,
`goals/coding-agent-effectiveness-evidence-loop/PLAN.md:221-239`)

The smallest sound vertical slice follows the packet's transactional-write and
toolchain-hash contract while reusing the current per-lane state fields.
(`goals/coding-agent-effectiveness-evidence-loop/PLAN.md:221-239`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:32-67`)

- `ProofState`: add `toolchainHash`, lane outcome, and lane input fingerprint;
  atomically upsert one passed lane through temp-file + rename instead of
  constructing all lane records only after global success. The current model
  already has per-lane command hashes, but `writeVerifiedState` creates every
  lane with one shared diff fingerprint and writes only after the caller has
  observed total success. (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:32-67`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:266-283`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:529-557`)
- `Planner`: expose proof lanes rather than one opaque `full:pre-push` wrapper,
  or pass an internal checkpoint contract to the Quality runner; mark only
  read-only proof lanes `fingerprint-match`. Today Planner creates one proof
  step and its generic constructor forces `resume: never`, while the shared
  repo-run model downgrades every non-package-feedback resume request to
  `never`. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:170-196`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:353-358`,
  `packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts:455-472`)
- `Handler`: before each proof lane, load and validate the matching command,
  toolchain, and lane-input hash; record a `skipped` verdict for a hit; after a
  pass, checkpoint immediately; retain the full-proof lock around the whole
  family. Today Handler runs steps serially, detects failure only after the
  phase, and writes reusable state only after all results pass. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:175-225`,
  `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:23-39`)

The evidence-loop packet's literal command + **tree** fingerprint design is
sound for interruption of a byte-identical tree, but any formatting,
changeset, generated-file, or security-pin fix changes the shared fingerprint
and invalidates all prior lanes. Therefore a straight implementation would not
make tonight's verify #4 retry “seconds long”; that outcome requires per-lane
inputs, such as Turbo task hashes for build/check/test and declared input globs
plus tool/config hashes for non-Turbo policy lanes. (`goals/coding-agent-effectiveness-evidence-loop/PLAN.md:221-239`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:195-237`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:14-15`)

**Measured/estimated saving:** exact-tree v1 saves 0 cycles proven from tonight's
fix log, but up to about 17 minutes per future interruption; lane-input v2 could
avoid the four repeated full sweeps after the first of five verifies, an upper
bound of 48–88 minutes from tonight's stated 12–22 minute range. (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:14-15`,
`goals/quality-speedup/research/quality-time-inventory.md:123-126`)

**Falsification test:** interrupt after lane k and require lanes `<k` to skip on
an unchanged tree; then alter one lane's declared input and require exactly that
lane plus dependents to rerun; alter bun/turbo/tsgo or the lockfile and require
all affected proofs to invalidate. This is the packet's stated safety burden,
including complete coverage of untracked files, environment, and toolchain.
(`goals/coding-agent-effectiveness-evidence-loop/PLAN.md:221-239`)

**Owner:** `coding-agent-effectiveness-evidence-loop` P3; the quality-speedup
grill explicitly left transactional proof resume there. (`goals/coding-agent-effectiveness-evidence-loop/PLAN.md:207-239`,
`goals/quality-speedup/history/2026-08-03-grill-decisions.md:28-32`)

### 4. Turn `--start-pr-early` into the sanctioned fail-fast ship path

**Why rank #4:** M–L, about 250–450 LOC for the overlap-only slice; it does not
remove a proof round, but overlaps the local 12–22 minute proof with hosted CI's
12.2-minute successful-PR p50, so the estimated critical-path saving is up to
the shorter side, about 12 minutes on a median successful attempt. (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:14-15`,
`goals/quality-speedup/research/quality-time-inventory.md:73-75`)

State transitions should be explicit, refining the phases already present in
Planner and Handler. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:533-563`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:345-392`)

`intent-ready → committed → cheap-gates-green → pushed → pr-open →
{local-proof-running || hosted-running} → green | repair-required`.
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:533-563`)

This is a refinement of existing plan phases, not a new run mode: Planner
already has `commit`, `early-publish`, `full`, and `monitor`; Handler currently
executes `full` to completion before it enters monitor. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:533-563`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:345-392`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:722-764`)

After Wave 0 passes and the PR exists, use structured concurrency to run local
full proof and hosted observation together, collecting both terminal outcomes
rather than cancelling one when its sibling fails. Advance to `green` only if
both are green for the same head SHA; a local proof that writes files must use
the existing “already pushed” follow-up-commit error path. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:372-392`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:1112-1126`)

The CLI flag text currently says hooks are skipped, while the planner and tests
deliberately omit `--no-verify`; fix that documentation mismatch as part of the
same PR so “cheap gates” are explicit and testable rather than implied by hook
installation state. (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:48-54`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:377-381`,
`packages/tooling/tool/cli/test/yeet.test.ts:585-595`)

**Falsification test:** instrument timestamps and prove local proof and hosted
watch overlap on the same SHA; seed a cheap red and assert no push; seed one
local-only and one hosted-only red and assert the final state retains both
outcomes without claiming success. The timing-field follow-up is needed to make
that overlap durably measurable. (`goals/quality-speedup/research/quality-time-inventory.md:27-35`,
`goals/quality-speedup/research/quality-time-inventory.md:176-183`)

**Owner:** extend the completed-retained `yeet-publish-preflight` behavior or
create a focused successor; that packet owns the current clean-HEAD and
`start-pr-early` contract, while `one-round-loop` owns the deferred
committed-branch mode. (`goals/yeet-publish-preflight/README.md:38-49`,
`goals/yeet-publish-preflight/SPEC.md:33-75`,
`goals/one-round-loop/SPEC.md:47-55`)

### 5. Add a bounded hosted-red auto-fix loop only after structured ingestion exists

**Why rank #5:** XL, >600 LOC plus an agent/orchestrator boundary; it could
remove a human diagnosis/relaunch transition on the roughly one-third of PR
attempts that pay at least one hosted retry, but tonight's repository evidence
does not measure how many of its four publish attempts were safely
auto-fixable. (`goals/quality-speedup/research/quality-time-inventory.md:103-111`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:45-51`)

Add states `hosted-red-observed → logs-ingested → repair-planned →
repair-applied → followup-committed → pushed`, keyed by head SHA and bounded by
an attempt limit. Every new commit invalidates both local and hosted proof for
the prior SHA, so the loop returns to the cheap gate and parallel proof/watch
fork rather than “resuming” stale success. (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:712-733`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:380-392`)

The first slice should only ingest failed check names, run/job IDs, bounded logs,
and repair routing into the verdict/issue index; deterministic repair commands
may run automatically, while raw code changes remain delegated to the existing
quality-review-fix workflow with a fresh reviewed commit. Today monitor records
only command exit and output, and verdict repair commands are derived from the
local executed step. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:434-445`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:203-243`)

**Falsification test:** replay a hosted failure fixture with bounded logs and
assert same-SHA attribution, one repair attempt, a new commit, re-entry through
cheap gates, and termination at the configured cap; stale logs or an
unclassified failure must stop for operator review rather than loop. The
inventory identifies missing cancellation causes and Yeet↔hosted correlation
as current instrument gaps. (`goals/quality-speedup/research/quality-time-inventory.md:27-35`,
`goals/quality-speedup/research/quality-time-inventory.md:176-183`)

**Owner:** no active packet owns this end-to-end behavior; the instrumentation
portion belongs with the approved quality-speedup instrument-hygiene follow-up,
while repair orchestration needs a new successor packet. (`goals/quality-speedup/history/2026-08-03-grill-decisions.md:28-32`,
`goals/quality-speedup/history/reflections/2026-08-04-claude.md:32-38`)

## Recommended PR sequence

1. **PR A:** cheap preflight waves + explicit fail-fast/collect-all policy +
   retry-safe `preparedCommit`; this addresses tonight's concrete cycle classes
   without enabling heavy concurrency. (`goals/quality-speedup/history/reflections/2026-08-04-claude.md:8-23`,
   `goals/quality-speedup/history/2026-08-03-grill-decisions.md:33-37`)
2. **PR B:** evidence-loop exact-tree transactional checkpoints, then the
   separately falsified lane-input extension; do not claim post-fix reuse from
   the exact-tree slice. (`goals/coding-agent-effectiveness-evidence-loop/PLAN.md:221-239`,
   `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:529-557`)
3. **PR C:** evolve `start-pr-early` into the concurrent ship path, using PR A's
   cheap-gate state and PR B's durable outcomes. (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:345-392`)
4. **PR D:** structured hosted-log ingestion first, then a bounded agent repair
   loop only after same-SHA attribution and attempt caps are proven.
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:434-445`,
   `goals/quality-speedup/research/quality-time-inventory.md:27-35`)
