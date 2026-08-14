# Lane C5 — verify/publish concurrency and resource-contention policy

Date: 2026-08-13. Scope: read-only inspection of `beep-effect5`; no quality commands were run.

## Concrete findings

### 1. The active Yeet lock is checkout-local, fail-fast, and narrower than the operator thinks

- A full proof acquires `artifactDir/quality-lock`; the default artifact directory is the invoking checkout's `.beep/yeet`, not a path shared by sibling `../beep-effect*` checkouts (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:120-125`, `packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts:85-90`). It serializes full verify/publish proofs **within one checkout only**. It does not prevent two agents in two checkouts from saturating the same machine.
- Acquisition is a real atomic exclusion (`writeFileString(..., { flag: "wx" })`) (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:368-382`). A second full proof does **not** block or queue: after one stale-lock check it exits 1 with “Another Yeet full proof appears active” (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:446-486`). There is no wait timeout because there is no wait.
- Only full-tier proof phases take the lock. `runProofPhase` wraps the full phase in `acquireUseRelease`; review-fix bypasses it (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:224-242`). Both `yeet verify` and ordinary `yeet publish` contain the same full pre-push proof (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:600-615,624-630`), so they contend in one checkout. `monitor`, `closeout`, repair, and review-fix do not.
- Normal completion/interruption releases the lock through the scoped finalizer (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:238-242`; `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:506-509`). After SIGKILL/crash, the next contender decodes `{pid, startedAt,...}`, probes `process.kill(pid, 0)`, deletes the lock only when that PID is absent, then retries one atomic claim (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:318-334,450-473`).
- Orphan handling has three gaps: no heartbeat/age timeout; no Linux `/proc/<pid>/stat` start-time check, so PID reuse can make a dead owner look alive; and malformed/unreadable metadata is deliberately never reaped (`proofLockDisposition` returns `refuse-unreadable`) (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:330-334`). Reaping also occurs only when another proof reaches this lock in the same checkout.
- The historical “orphaned quality run” incident was broader than a stale lock: a dead agent's broker continued its queued `yeet verify` for nearly an hour, causing Next build-lock collisions and `tsgo-test-checks` temp-directory deletion races (`goals/llm-provider-subscription-auth/history/reflections/2026-07-12-claude.md:19-26`). The current lock cannot discover a still-live orphan broker, and locks in sibling checkouts cannot see it.
- Successful CLI teardown was hardened to `process.exit(0)` because leaked Turbo/bun handles previously wedged after success (`packages/tooling/tool/cli/src/bin-main.ts:154-168`), but that fixes post-success handles, not detached brokers or machine-level admission.

### 2. The advertised workstation profile is not an execution policy

- `Quality.plan.ts` reports a workstation profile of Turbo concurrency 8, docgen parallelism 6, one full-proof slot, and three review-fix slots (`packages/tooling/tool/cli/src/commands/Quality/Quality.plan.ts:51-59`). Detection selects it at >=32 CPUs and >=64 GiB total RAM (`packages/tooling/tool/cli/src/commands/Quality/Quality.plan.ts:83-95`).
- Those fields are only rendered/tested: the only production call to `detectQualityProfile()` prints `quality profile detect`; no runner consumes `fullProofSlots`, `reviewFixSlots`, `turboConcurrency`, or `docgenParallel` (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:2473`; schema at `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:386-398`). Thus “fullProofSlots: 1” is descriptive, not the active mutex, and “turboConcurrency: 8” does not tune Yeet.

### 3. Full verify is serial across lanes, but several lanes have nested parallelism

- The full proof is one `beep quality github-checks pre-push` step (`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:129-150`). It comprises 21-ish sub-lanes grouped as preflight -> heavy -> test -> documentation (`packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:792-819`; lane construction at `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:223-254,296-339,357-419`).
- Waves are executed in order, and every lane inside a wave is still passed to `collectStreamingStepFailures`, whose `Effect.forEach` is hard-coded to concurrency 1 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:944-978,1012-1050`). Therefore build, lint, and check do not overlap; the historical mean full pre-push was 1,022 seconds, with a 20% observed failure rate (`goals/quality-speedup/research/quality-time-inventory.md:80-107`).
- Each root Turbo lane defaults locally to `--concurrency=3`; CI defaults to 4 unless the lane supplies an explicit cap (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:100-111,545-568`). Coverage remains local 3 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:515-529`). Serial SQL integration is deliberately fixed at 1 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1430-1455`).
- The pre-push planner's own `YEET_TURBO_CONCURRENCY=3` applies to targeted feedback Turbo commands, not the full pre-push collector (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:174-181`).
- Lint is the dangerous nested case: root lint launches the Turbo lint graph plus policy steps with outer concurrency 3 (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1141-1164,1663-1690`); the Turbo child itself defaults to 3; and `lint:deprecated-apis` launches four ESLint shards, each with an 8 GiB V8 heap ceiling (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:46-75,505-513`). This is why a run-level count alone is too crude.
- CI differs by lane: Check is explicitly concurrency 1, Coverage 3, the general CI cap is 4, and hosted 16 GiB Lint/Test Unit keep a 2-task survival cap (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:583-588,650-653,800-806,855`). Lint Policy's outer concurrency moved to 3 and passed hosted admission at 9m24s, but the packet explicitly says its admission still lacks per-step RSS telemetry (`goals/lint-policy-single-digit/PLAN.md:9-15`; `goals/lint-policy-single-digit/history/reflections/2026-08-13-claude.md:91-93`).
- GitHub itself cancels an older in-progress PR workflow for the same workflow/ref (`.github/workflows/check.yml:9-11`) while matrix lanes run independently with `fail-fast: false` (`.github/workflows/check.yml:47-56`). That is hosted supersession, not local machine backpressure.

## Memory and concurrency model

Use **50 GiB**, not installed 128 GiB, as the conservative available-memory input. Reserve 10 GiB for the operator, filesystem/cache growth, Docker/Nix, and measurement error; schedule against **40 GiB**. If `MemAvailable` is 60 GiB, capacity may rise dynamically to 50 GiB, but the policy must not assume it.

Evidence:

- Before #668, a cold concurrency-1 Check graph peaked at 23.28 GiB and had two individual processes at 23.28 and 19.23 GiB (`goals/ci-fleet-endgame/research/ci-graph-check-baseline.md:49-72`).
- After #668, the same cold graph peaked at **11.0 GiB** at concurrency 1; max process was 10.49 GiB. An exact concurrency-2 run of the two heaviest processes measured **15.64 GiB combined**, and a 105-task concurrency-2 mini-graph measured 14.1 GiB (`goals/ci-fleet-endgame/research/ci-graph-check-baseline.md:168-192`). All processes are now below the 13 GiB fleet budget (`goals/ci-fleet-endgame/research/ci-graph-check-baseline.md:194-202`).
- A conservative additive concurrency-3 Check bound from the three largest post-flip rows is 10.49 + 7.22 + 6.49 = **24.20 GiB** (the rows are recorded in `goals/ci-fleet-endgame/research/data/ci-graph-check-postflip.tsv:1-4`). Actual overlap should be lower, but it has not been measured.
- Lint is less certain and is probably the full-verify peak. Four deprecated-API shards were estimated at **12-20 GiB RSS**; individual small-root probes reached 2.78-4.07 GiB, and the packet warns four pathological children can exceed their 32 GiB aggregate heap allowance after overhead (`goals/lint-policy-single-digit/research/02-inplace-optimization.md:5-10,38-43,77-83`). Other full concurrent policy probes separately measured Schema First ~14.0 GB, Terse ~10.2 GB, and Native ~5.3 GB (`goals/lint-policy-single-digit/research/05-long-tail.md:40-45`). Outer concurrency 3 can overlap the four-shard child with two of these.

Estimated current peaks (ranges are scheduling estimates, not claimed measurements):

| Unit | Estimated peak | Basis |
| --- | ---: | --- |
| Check, Turbo c1 | 11 GiB measured | post-#668 cold whole-lane peak |
| Check, Turbo c2 | 15.6 GiB measured | exact heaviest-pair run |
| Check, Turbo c3 | 20-25 GiB estimated | additive top-three ceiling 24.2 GiB |
| Lint, current outer 3 / shard 4 | 30-45 GiB conservative | 12-20 GiB shard group plus two 5-14 GB analyzers; nesting is real |
| One current full verify | **30-45 GiB** | lanes are serial, so approximate max is Lint rather than the sum of all lanes |
| Two unrestricted current verifies | **60-90 GiB** | unsafe against 50 GiB available and 40 GiB schedulable |

Consequences:

1. At current settings, only **one unrestricted full verify** fits the 40 GiB scheduling envelope with a defensible margin.
2. Two verify processes can coexist safely when admission is **lane-weighted**: two c2 Check lanes project ~31.3 GiB from the measured pair; light/preflight work can overlap; only one current Lint lane may enter at a time.
3. Raising every local Turbo lane from 3 to the unused workstation profile's 8 is contraindicated. Eight worst-case 10.49 GiB processes are impossible in the real free-memory envelope. CPU is not the limiting resource for typecheck; memory is.
4. For a single run, c3 is the present best evidence-backed Check setting; c4 is not admissible until a cold c3/c4 process-tree measurement shows <30 GiB. For fleet throughput with two active verifies, c2 per Check lane is the measured safe setting.

## Ranked recommendations

### 1. Add a machine-wide weighted, fair scheduler; retain the checkout lock for artifact integrity

**Policy.** Use 5 GiB tokens. Capacity is `min(10, floor((MemAvailableGiB - 10) / 5))`, reevaluated before every heavy-lane admission; refuse new heavy work below 15 GiB available. This yields 8 tokens at 50 GiB available and 10 at 60 GiB. A verify gets a one-token run ticket, then dynamically acquires lane deltas: light/preflight 1 total; build/test/docgen 3; Check c2 4; Check c3 5; current Lint 8. Consequently multiple verifies are “running,” but only combinations that fit 40-50 GiB enter heavy work. Do not replace the existing `.beep/yeet/quality-lock`: it protects one checkout's artifacts and branch state, while the new scheduler protects machine resources.

**Location.** Active leases: `${XDG_RUNTIME_DIR}/beep-effect-quality/` (0700), fallback `/tmp/beep-effect-quality-${uid}/`; durable timing/RSS history: `${XDG_STATE_HOME:-~/.local/state}/beep-effect/quality/`. This spans all `~/YeeBois/**/beep-effect*` checkouts without committing state or confusing two machines sharing a home directory.

**Touch points.** Add `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` plus schemas/tests; acquire the run ticket around full-tier work in `Yeet/internal/Handler.ts:224-242`; acquire/release lane weights in `Quality/Tasks.ts:1012-1050`; add resource class/weight to `GithubCheckLaneSpec` in `Quality/Quality.schemas.ts:843-879` and lane constructors in `Quality/internal/GithubChecks.ts:139-183`. Replace the unused slot/profile fields in `Quality.plan.ts:31-60` with real scheduler capacity, reserve, and per-class defaults—or wire them into this implementation so the command stops promising settings execution ignores.

**Impact:** very high; permits two or more active agents without unbounded sibling-checkout oversubscription and prevents the current fail-fast retry storm. **Effort:** medium-high. **Risk:** medium; cross-process atomicity and cancellation need fixture tests. Roll out report-only for several days, then opt-in, then default-on after observed peak RSS stays below 40 GiB at the 50 GiB watermark.

### 2. Make per-lane concurrency adaptive; do not globally raise Turbo

**Policy.** Solo mode: keep Check/build/test at Turbo c3. Contended mode (another heavy ticket queued or active): run Check at c2; this is the only setting with direct two-process memory evidence. Keep SQL integration at c1. Keep Test at c3 pending a cold process-tree RSS measurement; hosted Test Unit's c2 cap is explicit evidence that it is not yet a blind c8 candidate. Keep current Lint outer c3 only when it owns all 8 tokens; if the product requirement is simultaneous progress, use outer c2 while another run holds tokens, but do not change the inner shard c4 independently without remeasurement. Allow preflight repo-sanity/security lanes concurrency 4 because they are independent and not Turbo/typecheck-heavy, using weights rather than an unbounded wave.

**Touch points.** Replace literal local `ROOT_TURBO_CONCURRENCY_ARG` / coverage values in `Quality/Tasks.ts:100-127,563-568` with scheduler-selected args; keep explicit integration override at `Tasks.ts:1430-1455`. Parameterize `LINT_POLICY_STEP_CONCURRENCY` and `DEPRECATED_API_LINT_CONCURRENCY` only through the same admission decision (`Quality/Tasks.ts:118-127`; `Lint/Lint.command.ts:46-49`). Change lane execution at `Tasks.ts:944-978,1012-1050` from unconditional serial to weighted bounded execution. Leave CI-specific caps in `Ci/CiLane.ts:583-588,650-653,800-806,855` unchanged.

**Impact:** high; c2 lets two Check lanes fit at ~31.3 GiB while c3 preserves solo latency. Parallel weighted preflight removes serial wall without stacking typecheck graphs. **Effort:** medium. **Risk:** medium; Turbo task mix and lint RSS vary. Require cold c3 and c4 process-tree RSS measurements before any c4 local default; accept only if one run stays <30 GiB and two-run combined stays <40 GiB.

### 3. Queue with visible progress and publish priority plus aging

**Policy.** A contender waits instead of failing. Print immediately: ticket id, class/weight, tokens active/capacity, owners (`pid`, checkout, branch, lane, age), queue position, and admission watermark. Refresh every 15 seconds; `Ctrl-C` removes its ticket. No fixed wait timeout by default, but emit escalating diagnostics at 2 and 10 minutes. Use FIFO within class. Give a publish's final proof priority over new verifies because it unlocks push/PR feedback, but after a verify waits 2 minutes it ages to equal priority; never preempt a running lane. Do not reserve tokens while `gh pr checks --watch` runs. Separately serialize commit/push/PR mutations by `(remote repository identity, branch)` so two checkouts targeting the same branch cannot race; different branches may publish concurrently after proof.

**Touch points.** Queue behavior belongs in the new scheduler; pass mode/branch from `Handler.ts:996-1036`. Publish phase boundaries already exist in `Planner.ts:600-615` and `Handler.ts:1030-1065`; release heavy tokens before push/monitor. Preserve GitHub's existing same-ref supersession policy (`.github/workflows/check.yml:9-11`).

**Impact:** high on backpressure latency and operator comprehension; eliminates immediate second-agent failure and prioritizes work nearest hosted feedback. **Effort:** medium. **Risk:** low-medium; starvation if aging is omitted, PR churn if mutation locking is omitted.

### 4. Add memory/load watermarks, heartbeat leases, and scoped orphan reaping

**Policy.** Before admission read Linux `MemAvailable`, 1-minute load, PSI memory, and swap-in rate. Hard block heavy admission when available memory <15 GiB or memory PSI is sustained; reduce capacity one token at a time when load >48 on this 64-thread host, hard block new CPU-heavy lanes above 60. These are admission controls, not reasons to kill healthy work. Each lease records PID, `/proc/<pid>/stat` start time, process-group/session id, checkout, branch, command, lane, weight, and heartbeat. Heartbeat every 5 seconds; suspect after 30 seconds, reap only when PID is dead or start time mismatches. Malformed leases quarantine with a visible diagnostic rather than blocking forever.

For children, centralize process-group ownership in `packages/tooling/tool/cli/src/internal/process/StepExec.ts:542-565,610-637,679-693`: register the spawned process group in the lease; on owner death send TERM only to that registered group, wait 10 seconds, then KILL. Never use broad `pkill`, and never kill a live PID merely because its heartbeat is old. Reconcile leases at every CLI start and provide `bun run beep quality scheduler status|reap --dry-run` for operator proof.

**Impact:** high reliability; directly addresses PID reuse, malformed locks, detached child trees, and silent resource loss. **Effort:** high. **Risk:** medium-high because incorrect reaping is destructive; require `/proc` start-time tests, PID-reuse fixtures, crash/SIGKILL integration tests, and dry-run-by-default manual reap.

### 5. Instrument before raising the remaining caps

Record process-tree peak RSS, CPU time, queue wait, admitted weight, Turbo concurrency, lane start/end, and exit in the existing Yeet attempt/verdict artifacts. The current system already times top-level steps (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:245-274`) but the full pre-push step hides sub-lane RSS and much sub-lane timing. Persisting it makes the proposed c2/c3 adaptive decision self-correcting and supplies p50/p95 queue-delay evidence.

**Touch points.** Extend `GithubCheckLaneRun` / report schemas beside `Quality.schemas.ts:881-890`, populate in `Tasks.ts:1012-1055`, and attach scheduler facts to the verdict writer at `Yeet/internal/Handler.ts:927-977`. Expose a compact `quality scheduler status --json` for agents.

**Impact:** medium-high; prevents another concurrency change based on total installed RAM or heap ceilings rather than observed peak. **Effort:** medium. **Risk:** low if metrics are bounded and paths are sanitized.

## Recommended initial production configuration

```text
slot_size_gib=5
reserve_gib=10
capacity=min(10, floor((MemAvailableGiB-reserve_gib)/slot_size_gib))
hard_admission_floor_gib=15
verify_run_ticket=1
lane_light=1
lane_build_test_docgen=3
lane_check_c2=4
lane_check_c3=5
lane_lint_current=8
solo_turbo_concurrency=3
contended_check_concurrency=2
sql_integration_concurrency=1
queue_heartbeat_seconds=5
queue_progress_seconds=15
publish_priority_aging_seconds=120
```

This configuration meets the operator's actual goal—more than one agent can be inside verify/publish concurrently—without pretending that two current nested-Lint peaks fit in ~50 GiB free. The first follow-up measurement should be a cold, instrumented full verify at current settings and then two queued verifies; do not raise c3 until those traces establish the true 95th-percentile Lint and full-run peaks.
