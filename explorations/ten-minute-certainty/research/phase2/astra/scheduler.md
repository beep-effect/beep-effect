# Area G — QualityScheduler extension audit

## Verdict

Extend the existing scheduler. Make its admission unit a lane or package, retain one proof-owned cgroup, and admit the presently uncovered entrypoints. Do not introduce a checker agent, daemon admission authority, second semaphore, or new result cache. This is principally a local reliability and tail-latency intervention: **no direct hosted runner-minute or hosted critical-path savings are established**. It cannot by itself deliver the operator's hosted push-to-required-green p95 below ten minutes or shrink a single intrinsically long package below ten minutes.

The highest provisional economic levers are **G-L4 smaller units**, **G-L5 CPU-aware admission/width**, and **G-L1 footprint-based charging**. Their savings are hypotheses, not measured speedups. The implementation order is different: G-L8 observation, G-L2 measurement/schema, G-L4 ownership/service migration, G-L3 coverage of entrypoints, G-L1 charging, then G-L5 and G-L6 controlled rollout; G-L7 can proceed independently after ownership verification. Keep #3005, #3007 and #3014 as merged baseline dependencies; none of their changes is proposed here.

### Schema first: the lease is not the proof owner

Extend `internal/repo-run/QualityScheduler.schemas.ts`, reusing existing `YeetAdmissionLease`, `YeetAdmissionTicket`, `AdmissionRequest`, `RunScopeRecord`, proof-input facts, UUID and package/lane identities. Use annotated branded `S.Opaque` data, named `LiteralKit` domains and schema-derived unions, codecs and guards; use `Option` for missing measurements. This is a design specification, not compiled implementation.

| Model | Required content and invariants |
| --- | --- |
| AdmissionUnit | Discriminated `kind: lane | package | tier`. Lane carries canonical lane id and its exact scope descriptor; package carries package id, task and selected dependency closure; tier carries legacy full/cheap-gates/review-fix identity. Tier is compatibility fallback, not the new default. Grain describes work executed, not merely the name of the ticket. |
| ProofOwner | Stable proof id, attempt id if available, origin key, canonical checkout, immutable head/diff identity, pid plus process-start identity, and proof lifecycle state. Attribution must work without optional attemptId. Retain exclusion across different proofs sharing a checkout. |
| ProofCgroup | Existing verified service/scope identity, owner proof id, verified cgroup path and creation identity, support/verification status. The proof owns this throughout its lifetime, including between unit leases. Detached work adopts its existing `beep-proof-<jobId>.service`; attached work creates/adopts one scope once per proof. |
| ResourceDemand | Positive bounded memory bytes, CPU demand in core units, worker-width ceiling; units and version explicit. Do not reinterpret an existing token as CPU. Legacy token demand remains a conservatively translated compatibility case. |
| WeightSource | Tagged `measured` (cohort key, sample count, timestamp range, estimator, safety margin, receipt references), `conservativeFallback` (reason and versioned bound), or `legacy` (old weight/version). Cohort keys include task/unit, scope size/class, toolchain, host profile, worker count, warm/cold state. Unknown never means zero. |
| UnitTicket / UnitLease | Schema/protocol version, proof owner reference, unit, resource demand/source, original enqueue instant and unique enqueue nonce, grant id, heartbeat, priority, fairness origin and deadline metadata. Reuse nonce on observation/retry; new nonce for genuinely new work. Unit release cannot terminate the proof cgroup. |
| UnitObservation | Start/end, queue wait, CPU delta, measured current-memory maxima plus sample interval, whole-proof memory.peak, anon/file/kernel/shmem observations, swap, memory.events and pressure deltas. Distinguish whole-proof peak from unit peak and isolated from overlapping samples. Missing is explicit. |
| Backpressure | Tagged queued/admitted/withdrawn/refused, nonce, effective queue position, origin position, limiting dimension, wait age, ETA interval or unknown with reason, fairness deadline, ordered eligible cheap alternatives and policy reason. It is progress, never proof success. |

**Ruling 35 design constraint:** `goals/time-to-certainty/research/decisions.md:406–422` explicitly binds a detached proof to its transient service. Today `RunScope.ts:244–254` adopts that service, while attached entry uses the ticket nonce to create a scope. Naively calling today's bracket once per lane would move the attached parent repeatedly and can strand descendants or incorrectly authorize reaping a shared service. Separate proof lifetime from unit lifetime first. Keep one owner record, one cgroup, and several transient unit reservations beneath that owner **as records only, not child cgroups**. Idle proof memory remains visible in `memory.current` and ancestor budgets. Never sum the same cgroup's current usage once per lease.

Initially serialize unit execution within a proof where measurements are inseparable. For existing concurrent cheap waves, either retain a measured aggregate tier reservation temporarily or implement atomic same-proof unit reservation batches before enabling concurrency: sum resource demands, count the proof/cgroup only once, and preserve output-conflict constraints. Never hold an outer tier reservation while waiting for an inner reservation. A nested command receives a validated admission capability tied to its owner, unit and actual budget; arbitrary inherited environment variables cannot grant a bypass. Unreserved work goes back through the same scheduler.

### Context.Service contract, then rollout

`withQualityAdmission` is currently an exported Effect bracket, **not** a `QualityScheduler` Context.Service (`QualityScheduler.ts:2227`). Existing services include `MemoryStats` and `AdmissionJournalReader`. Encapsulate the current implementation behind a `QualityScheduler` Context.Service and Layer; do not replace its durable queue, promotion transitions or overshoot arbitration with an in-memory queue.

Proposed service operations: scoped `openProof(owner)` returns a proof ownership capability; generic `withUnit(proof, request, use)` waits, grants, runs, observes and releases; `observe(nonce)` exposes structured progress; `snapshot` reads current state; `withdraw(nonce)` verifies caller ownership. Keep `withQualityAdmission` as the compatibility facade over this service. Errors remain typed (`QualitySchedulerError` plus explicit refusal/unsupported-demand cases); task errors and interruption propagate unchanged. Filesystem, randomness, process spawner and codecs belong in the Layer. Do not expose an unscoped raw acquire that invites forgotten release.

Extend `MemoryStats`' existing `reservationCapacity` contract to evaluate vector demands against host and all relevant ancestor ceilings, preserving its conservative unknown-membership behavior (`MemoryStats.service.ts:193–293`). Add resource sampling to existing run-scope telemetry and journal contracts; the sampler reports facts, never authorizes work. Return worker-width allowances with a grant so `Quality.plan.ts` uses the same demand accounting as admission. Keep same-checkout output exclusion separate from capacity accounting inside the existing authority. Reaper logic must distinguish dead unit from dead proof: stop only the verified dead proof's cgroup; one stale unit nonce never grants authority to kill a live proof.

Roll out versioned readers before writers. Existing v1 readers may quarantine unknown versions, removing charged work from their view; merely making new readers backward-compatible is insufficient. Use a compatibility phase and fleet capability check, retain legacy tier behavior while old writers exist, then enable small units. A mixed-version fixture must prove no live lease becomes uncharged. Rollback disables small-unit production, drains existing owners and restores conservative tier admission; it does not delete live leases or downgrade their decoding.

## Measured this pass

Read the brief first, then the required inventory sections, scheduler component/lever/rejection rows and Astra component 28. No other phase-2 auditor output was read. No tracked file, git state, configuration or running proof was changed; no benchmark, install, coverage, docgen, test or lint workload was launched. File-reading Python was used only to reduce existing journal data. Paths below are relative to `~/YeeBois/projects/beep-effect` unless stated otherwise.

| Command/source | Result and limits |
| --- | --- |
| `gh run list --workflow check.yml --event pull_request --limit 100 --json createdAt,conclusion` | 100 runs, 2026-11-08 16:49:31Z through 11-09 16:33:53Z: 21 on Nov 8 and 79 on Nov 9; 46 success, 12 failure, 42 cancelled. Both dates are partial/censored. Endpoint span 23h44m22s gives approximately 101 runs/day, 708/week as a burst extrapolation, not a stable seven-day average. Cancelled runs remain in compute accounting. |
| `bun run beep yeet economics` at 17:22Z | 476 attempts; publish 188, verify 157, closeout 68, repair 35, monitor 28. Window Aug 8 07:58Z–Nov 9 13:42Z, approximately 93 days. Cheap gates: 114 executions, p50 4.0m/p95 11.6m, 8.97h. Pre-push: 91, p50 14.5m/p95 57.1m, 29.01h. These are wrapper observations, not scheduler-only time. |
| `bun run beep quality scheduler status` | 0/10 active tokens, MemAvailable 69.3 GiB, no active queue/lease lines, 2,068 quarantine rows. Command flooded output; do not confuse row count with live contention. This snapshot cannot estimate throughput. |
| Read `~/.beep/runtime/beep-admit-uid-1000/journal.ndjson` | 243,231 bytes; 607 rows: 200 admitted, 202 enqueued, 201 released, 3 withdrawn, 1 lease-evicted. Oldest retained admission Nov 6 21:38:08Z. All 200 admissions full-proof; 165 publish-priority, 35 verify. |
| Nonce join of admitted and released rows | Wait seconds n=200: p50 0.040, p90 82.232, p95 178.091, max 644.299, sum 6,018.319 (100.305m). Matched hold minutes n=199: p50 4.044, p90 7.620, p95 9.451, max 88.573, sum 1,193.087. One unmatched grant is censored, not zero duration. |
| Existing release telemetry | 155 release rows carry memoryPeakBytes: p50 22.894 GiB, p90 27.611, max 33.250. This population is not necessarily the same as the 199 matched holds; missing samples remain missing. No per-unit anonymous-memory or CPU sample was available in this reduction. |
| Targeted `rg` of `withQualityAdmission` | Yeet Handler plus Cache.protocol.runner, Cache.pilot, Cache.pilot.runner, Cache.workflow and Cache.dependencies call it. FinalCheck and PackageVerify do not. FinalCheck `runGates` is sequential; PackageVerify declares step concurrency 3. |
| Source inspection | Existing progress prints position/holders every configured interval (`QualityScheduler.ts:1594–1635,1960–2000`); there is no ETA in that formatter. Same-origin peers are allowed across checkouts; same-checkout owners block (`:1480–1540`). Journal keeps 200 admissions/2,400 known rows (`AdmissionJournal.ts:59–65`). |

**Memory semantics resolved:** cgroup v2 `memory.peak` is maximum charged memory for the cgroup and descendants; file cache is included in memory accounting, and `memory.stat` separates anon, file and kernel with shmem included in file. Thus 22.9 GiB is not 22.9 GiB of anonymous RSS. Do not subtract a release-time file counter from a lifetime peak or subtract overlapping categories. Verify installed-kernel support before using FD-local peak resets; without it, interval sampling supplies a lower bound on the true unit peak. Shared cache charging and retained page cache complicate attribution. [Linux kernel cgroup-v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory). The code currently reads systemd `MemoryPeak` (`RunScope.ts:390`); an implementation must qualify that property's availability against direct cgroup readings.

**Ranking rule:** use weekly expected minutes saved divided by trust-risk weight (low=1, medium=2, high=3). Local denominators are 188×7/93 = **14.15 publishes/week** and 157×7/93 = **11.82 verifies/week**. Hosted term uses the measured burst extrapolation above but is zero for every Area G lever. The inventory's fleet 2,596 attempts is supplied evidence, not refreshed here; modes, overlapping dates and active scheduling hosts are insufficient to multiply the local result by 112 checkouts. Report 2,596 as scope, not 2,596 weekly opportunities. Unknown ad-hoc attempts receive no invented volume.

The points below are explicit **guesses for prioritization**. There is no measured causal speedup. Their intervals include regressions and they overlap, so do not sum them. The retained queue's 100.305 total minutes bounds savings from deleting those waits alone; arbitrary multi-minute average claims require execution-contention or retry measurements beyond this journal. Ranking includes safety prerequisites at zero economic credit rather than inventing savings for them.

### Common acceptance experiment (future, not run here)

Freeze head/toolchain, cold/warm state, full selected task graph and outputs. Compare baseline vs candidate with randomized order and at least 20 trials per cell at **N=1,2,4,8 concurrent agents**, origins/checkouts balanced and also one-origin-flood adversarial arrivals. Include docs publish, narrow source publish, affected final-check, package-verify, coverage-heavy verify and ad-hoc docgen/vitest; replay #3005/#3007/#3014 baseline without reimplementing them. Report completions/hour, push or invocation-to-verdict p50/p95, per-origin queue p95/p99/max, first actionable red, runner-minutes (unchanged hosted control), CPU-seconds, whole-proof and sampled unit memory peaks, host/ancestor pressure, OOM/throttle events and cancelled/failed trials. Never count timeout/withdrawal as a fast green. Require identical task/test census, coverage/property floors and negative-witness reds; retain integration/output exclusivity. Acceptance: no OOM or missing proof, no material N=1 regression (>5%), and statistically supported tail/throughput improvement at the saturated N. Large indivisible packages may remain above ten minutes; report that honestly.

## Ranked levers

### 1. G-L4 — Admit lane/package units while preserving proof ownership

- **Area/mechanism/grain:** G; implement the schema and service design above in `QualityScheduler{,.schemas}.ts`, `RunScope{,.schemas}.ts`, `MemoryStats.service.ts`, Yeet `Handler.ts` and `Quality/internal/GithubChecks.ts`. Grain **package**, or repo for inherently global lanes, affected-set for an indivisible selected graph. Splitting reservation lifetime does not narrow the selected proof. Release at child completion/red and interleave proofs at boundaries.
- **Savings:** hosted runner 0m/PR; hosted critical path 0m/PR; local publish **0.50m**, verify **1.50m**; plausible range −0.25..1m and −1..3m respectively. CPU-seconds unknown, initially approximately equal work plus reservation overhead. **Basis guess**, anchored to measured 0.04s uncontended admission, 178s p95 wait, 4m median tier hold and 88.6m max. Weekly 24.8m / risk 3 = **8.3**. Much of the verify gain requires reduced execution contention; queue data alone does not prove it.
- **Trust risk:** high; early release with live descendants, nested deadlock, duplicated cgroup charges, or reaping a live service could terminate tests and yield incomplete evidence. Mitigate by proof/unit separation, verified ownership, drain-before-release, atomic batch reservation and no green on incomplete census.
- **Admission gate:** parity ledger plus lifecycle mutation fixtures and controlled A/B. Exercise cancellation before/after grant, pid reuse, child survival, same-proof nesting, simultaneous promotions, stale nonce, old writer/new reader and new writer/old reader, and output collisions. Prove one detached service per proof across all units; compare cgroup membership and lease accounting at every boundary.
- **Prior art/dependencies:** current queue, nonce transitions, #2973 ancestor budgeting and ruling 35 remain. No second scheduler; no preemption. Depends on G-L2/G-L8 schema observations; other local consumers depend on this. Assumes the three in-flight PRs merged.
- **PR slices:** “Model proof ownership and unit demand” (schemas/RunScope, M); “Encapsulate existing admission in service” (scheduler and Layers, M); “Admit Yeet lanes without nested tiers” (Handler/GithubChecks/tests, L). Enable last slice only after fleet compatibility.
- **Confidence/open questions:** medium in mechanism, low in savings. Measure indivisible graph sizes, unit-boundary overhead and whether retained cache keeps small proofs materially charged between units.

### 2. G-L5 — Add CPU demand and use grants to bound worker width

- **Area/mechanism/grain:** G; extend ResourceDemand and MemoryStats/resource observations, `Quality.plan.ts` and scheduler eligibility with a CPU dimension. **Package** or lane; total runnable demand across grants must fit the effective cpuset/quota budget with a measured interactive reserve. PSI informs backoff/hysteresis, not an oscillating replacement scheduler. Start shadow-only; do not change systemd CPU quotas or buy capacity.
- **Savings:** hosted 0/0m; local publish **0.20m**, verify **0.50m**, ranges −0.5..0.5 / −2..2m. CPU-seconds unknown; less oversubscription need not reduce CPU instructions. **Guess**, based on inventory CPU-some p99 21%, max 66%, not a new causal measurement. Weekly 8.7m / risk 2 = **4.4**.
- **Trust risk:** medium; shrinking worker count can expose timeouts, and incorrect CPU floors can stall work or favor false incomplete success. Preserve deadlines/verdict semantics and minimum workers; timeouts remain red. Do not change property-run counts, coverage or test selection.
- **Admission gate:** A/B controls plus parity ledger, quota/cpuset/missing-PSI fixtures and N=1/2/4/8 trials. Measure throughput, CPU-seconds per complete proof, p95 wait and memory peaks alongside effective width; require gains over memory-only control.
- **Prior art/dependencies:** #2560 already scales widths by admission; extend it, do not propose width scaling as new. More threads had no wall benefit in the recorded deprecated-API sweep. Depends on L2/L3/L4 coverage and telemetry; otherwise unseen CPU work invalidates demand estimates.
- **PR slices:** “Record CPU demand and pressure” (resource schemas/telemetry, M); “Shadow CPU grant budgets” (scheduler/Quality.plan, M); “Enforce qualified widths” (policy/tests, S).
- **Confidence/open questions:** low savings confidence; establish interactive reserve and burst tolerance experimentally on existing hosts, including unadmitted agent inference/tool activity.

### 3. G-L1 — Charge cheap-gates and docs/goals publishes by executed footprint

- **Area/mechanism/grain:** G; change Handler request construction and GithubChecks lane demand lookup to use actual planned units, not branch names. **Affected-set** for a selected plan, package where supported, repo for scanners that still scan globally. Docs/goals is a cohort tag, never a license to skip admission or reduce checks. Cache hits still have graph/hash overhead.
- **Savings:** hosted 0/0m; local publish **0.25m**, verify **0.15m**, ranges −0.25..0.75 / −0.25..0.5m; CPU-seconds approximately unchanged. **Guess**, grounded in 165/200 publish-priority grants and inventory docs/goals 42% lease-hours (not rejoined here). Weekly 5.3m / risk 2 = **2.7**. Shares savings with L4, not additive.
- **Trust risk:** medium; assuming documentation implies low memory while global scanners run can trigger OOM. Use measured executed footprint and conservative unknown weights; preserve current check selection. Weight-only change grants no new skip-satisfied result.
- **Admission gate:** A/B plus parity ledger. If a slice also changes routing, it separately requires route replay + mutation fixtures; keep that outside this scheduler slice. Measure per-unit and whole-wave peaks for cold/warm docs, goals, mixed and policy edits; prove candidate never undercharges an observed envelope.
- **Prior art/dependencies:** D1 deviation rejected publish-proof weight 1 when it contained 30–45 GiB proof work. Push-first changes the workload, but is insufficient evidence for weight 1. #3011/#3014 are inputs to cohort definitions, not permission to skip admission. Depends on L2/L4.
- **PR slices:** “Classify demand from selected cheap lanes” (Handler/GithubChecks, M); “Enable qualified cheap-unit weights” (weight table/fixtures, S).
- **Confidence/open questions:** medium mechanism, low savings. Which nominally docs-only plans still run expensive global scanners? Does task-cache miss materially alter the bound?

### 4. G-L6 — Bound unfair overtaking and give agents actionable backpressure

- **Area/mechanism/grain:** G; extend ticket ordering and progress schema/renderer at `QualityScheduler.ts:1480–1540,1594–1635,1960–2000`. **Package**/lane scheduling; preserve same-checkout exclusion and legacy-origin migration. Fair-share origin is repository origin, with checkout/proof as a second level so one repo's many agents do not starve one another. Deterministic deficit/virtual-service ordering must run inside existing promotion arbitration.
- **Declared bound:** after **120s** waiting an eligible unit enters protected ordering; no newer unit may overtake it. Rotate origins, then checkout/proofs, with at most one quantum per active peer before repeating; a long unit's measured demand×runtime accrues fairness debt. Freeze the peer set ahead when protected. Conditional bound is 120s + remaining running work + sum of finite service bounds of protected work already ahead + promotion overhead. New arrivals cannot increase that bound. **There is no honest unconditional finite start bound** with nonpreemptive 88-minute units, unavailable memory, or hung owners. At **600s**, emit `deferred-capacity`/hosted-route guidance, not success or forced admission; a waiting caller may explicitly withdraw, preserving incomplete proof state. Record capacity-blocked time and bound violations separately.
- **Backpressure contract:** queued nonce, positions overall/within origin, cause (memory/CPU/output/legacy owner), holders, ETA range with sample count or unknown, aging deadline, and cheapest eligible next units sorted by measured cost with failure-yield/precision when available. Cheapest-first applies only within dependency/output/fairness constraints, never perpetual shortest-job-first. Agent keeps one pending request and waits for state-change notifications; it may work on unrelated edits or select an unstarted cheap unit through the same authority. No shell retry loop, repeated ticket creation, or automatic reap of healthy owners. The existing console position is retained, not reinvented.
- **Savings:** hosted 0/0m; local publish **0.05m**, verify **0.10m**, ranges −0.25..0.25 / −0.5..0.5m; CPU-seconds unknown. **Guess**, no agent-spin census. Weekly 1.9m / risk 1 = **1.9**. Tail fairness is the main benefit; FIFO already makes median wait tiny.
- **Trust risk:** low for verdict, meaningful liveness risk; wrong ETA or fairness identity can strand work. ETA is advisory, no success claim; preserve immutable enqueue age and nonce, verify deterministic multi-process order and admission capacity.
- **Admission gate:** adversarial fairness replay with continuous tiny arrivals, oversized tasks, multiple checkouts per origin, crashes and unavailable resources; controlled A/B measures max/tail wait, overtakes, completions and memory peaks. Prove conditional bound rather than claiming all work starts in 120s.
- **Prior art/dependencies:** 120s aging and 2/10m console escalations already exist. Origin-wide fail-fast lock stays retired. Depends on L4/L8 and duration cohorts. No automatic ten-minute task timeout.
- **PR slices:** “Expose structured admission progress” (schema/renderer, M); “Enforce bounded overtaking across origins” (order/tests, M).
- **Confidence/open questions:** high utility, low economic confidence. Fairness runtime estimator must charge underestimated jobs retrospectively without killing them.

### 5. G-L8 — Retain an attributable admission history across weeks

- **Area/mechanism/grain:** G; `AdmissionJournal.ts` and its reader. **Repo** telemetry, not a proof. Keep bounded hot state; archive immutable rotated lifecycle segments for a proposed 30 days with byte cap, schema version, checksum and explicit truncation markers. Preserve checkout/origin/unit/owner attribution independently of attemptId; do not return to the rejected minimal enqueue/withdraw pair. Readers query windows instead of scanning everything on every promotion.
- **Savings:** hosted 0/0m; local publish **0m**, verify **0m**; CPU-seconds slight overhead, unmeasured. **Derived zero direct savings**, weekly score **0/1=0**. Current ~243 KB per 2.8-day retained window suggests only a few MB/month at tier grain, but per-unit traffic can grow by orders of magnitude; size from actual event counts, not this extrapolation alone.
- **Trust risk:** low; pruning unfinished lifecycles can mislead performance policy or erase ownership evidence. Separate live leases from archives, preserve nonterminal records and withdrawals, atomic rotation and idempotent reader deduplication.
- **Admission gate:** parity ledger over old/new replay, truncation/crash/duplicate/malformed fixtures; measure promotion p95 overhead, bytes/day and reader latency under projected unit event rate. A/B throughput and memory peaks must be unchanged within noise.
- **Prior art/dependencies:** current 200-admission/2,400-row ring and ciops replay lab; capacity-stamp family remains parked. Add demanded measurements for this extension only, not a resurrection of that unapproved projection family.
- **PR slices:** “Rotate attributable admission history” (journal/reader/tests, M). First rollout prerequisite despite zero economic rank.
- **Confidence/open questions:** high need; retention byte cap and unit event volume are engineering measurements, not operator-only questions.

### 6. G-L2 — Calibrate memory demand from qualified cgroup observations

- **Area/mechanism/grain:** G; ResourceDemand/WeightSource, `RunScope.ts`, `MemoryStats.service.ts` and journal observation schemas. **Package** and lane calibration, repo/tier fallback. Collect isolated unit trials first; retain total charge for enforcement, classify anon/file/kernel/shmem for explanation. A cautious initial estimator is upper observed envelope plus explicit margin; only move toward percentile models after adequate cohorts and overrun evidence. Cache residency and worker width are cohort inputs.
- **Savings:** hosted 0/0m; local publish **0m**, verify **0m** credited; immediate effect may be slower (illustrative −1..0m / −3..0m). CPU-seconds unknown. **Derived zero credit**, not zero overhead. Weekly score **0/2=0**. Static 3×5=15 GiB is below measured p50 22.894 GiB; blindly rounding whole-tier peak to five or seven tokens may improve safety while worsening throughput.
- **Trust risk:** medium; bad peak attribution or deducting reclaimable cache too aggressively undercharges work and invites partial OOM. Charge total measured envelopes initially, observe memory.events and retained memory, require enough isolated samples; unknown cohorts use conservative bounds. Do not silently clamp a newly measured oversized demand down to fit (today's legacy token clamp is not a sound physical-memory guarantee); return unsupported-demand or a recorded hosted route.
- **Admission gate:** isolated vs overlapping telemetry parity, direct memory.current/peak vs systemd property qualification, cold/warm A/B at N=1/2/4/8, missing-controller/ancestor-limit/membership-change fixtures. Report overrun frequency and memory p95/max alongside throughput and wait; no undercharge-driven OOM accepted.
- **Prior art/dependencies:** #2973 already accounts ancestor budgets, #2925 worker refusal stays. memory.peak includes cache as documented above. Need L8; L4 supplies attributable unit boundaries. During bootstrap, measure candidate units in separate complete proof runs rather than manufacturing extra child cgroups.
- **PR slices:** “Record qualified memory cohorts” (RunScope/journal, M); “Resolve demand from measured envelopes” (MemoryStats/scheduler/tests, M).
- **Confidence/open questions:** high semantic correction, medium estimator design, low savings. The 155 peaks do not identify page-cache share at peak; additional samples are required.

### 7. G-L7 — Retire obsolete wrapper guidance and archive quarantine residue

- **Area/mechanism/grain:** G; **repo** documentation/status cleanup. `.claude/skills/orchestrate/SKILL.md:276,358` still mentions beep-heavy; `docs/runbooks/practice-m365-contacts-seeding.md:109,134` has wrapper examples. Replace relevant operational guidance with existing scheduler-backed entrypoints after compatibility rollout. Make status summarize quarantine count/date/reasons with an explicit detail option. Archive the 2,068 historical rows with hashes and restore instructions after proving none identifies a live owner/unit; do not remove active leases or infer deadness from age.
- **Savings:** hosted 0/0m; local publish **0m**, verify **0m**, CPU-seconds unmeasured/negligible. **Derived zero direct credit**, score **0/1=0**. Agent context reduction is real in this pass's output but not monetized as proof latency.
- **Trust risk:** low if archive only; deleting evidence or removing an actively used wrapper could expose unadmitted work. Verify live ownership/consumers, preserve restore path, never broad-kill. User memory edits require explicit memory-update authorization; this audit neither edits nor silently migrates personal memory.
- **Admission gate:** none, pure waste removal for status summarization; ownership census/archive restoration fixture for residue; entrypoint parity for command guidance. Record status byte/row reduction, unchanged active lease count and unchanged N-agent throughput/memory.
- **Prior art/dependencies:** inventory reports no live beep-heavy since Oct 25; not independently remeasured here. Legacy lock bounces are August, not current scheduler failure. Depends on L3 for replacement heavy-entrypoint coverage.
- **PR slices:** “Summarize and archive historical quarantine” (status/journal tooling/tests, S/M); “Retire obsolete heavy-wrapper instructions” (named docs/skills, S).
- **Confidence/open questions:** high status benefit; live wrapper consumers still need a fresh census before retirement. Do not rewrite historical incident evidence.

### 8. G-L3 — Admit final-check, package-verify and ad-hoc heavy commands

- **Area/mechanism/grain:** G; integrate `withQualityAdmission` at FinalCheck gate execution, PackageVerify task execution, Quality coverage/package runner, Docgen operations and canonical vitest/test-runner entrypoints. **Package** where independent, affected-set for canonical coverage aggregation, repo for mandatory global checks. final-check stays sequential initially. Preserve package-verify's concurrent behavior only under atomic sibling-unit reservations, otherwise use measured aggregate fallback until that capability lands.
- **Savings:** hosted 0/0m; local publish **0m**, verify **0m** credited; plausible direct wait cost −2..0m / −5..0m, while avoided OOM retries could yield positive savings not quantified here. CPU-seconds unchanged work plus overhead. **Guess, zero credit**, score **0/3=0**. This is a high-priority safety prerequisite despite last economic rank; no current evidence attributes the low-memory incident to a specific uncovered command.
- **Trust risk:** high during migration: nested waits, omission of selected packages, coverage reducer running before every producer, unsupported worker refusal mistaken for success, or direct binary invocation escaping wrappers. Mitigate with inherited validated capability, manifest-of-selected-work, canonical census, completed-producer barrier and terminal incomplete/refused states.
- **Admission gate:** route replay + mutation fixtures where dispatch changes, parity ledger for commands, controlled A/B with full workload census. Inject failures in late packages, kill a producer, mutate source during final-check, and prove no ready receipt is written. Verify every managed heavy subprocess maps to exactly one proof cgroup and an active unit grant. Report escaped-command census separately: a wrapper cannot govern arbitrary user-launched binaries by assertion.
- **Prior art/dependencies:** final-check's existing head/tree stability check (`FinalCheck.ts:1089–1121`) must survive. Cache qualification already uses admission. Worker compute-profile refusal, full bare-test doctrine, full doctest fleet and uncached coverage stay. Depends on L4/L2 and the same concurrency/output-write experiment that previously held parallel final-check/audit/docgen.
- **PR slices:** “Admit final-check gates” (FinalCheck/tests, M); “Admit package verification tasks” (PackageVerify/tests, M); “Admit canonical coverage docgen and vitest entrypoints” (Quality/Docgen/test-runner and generated script integration, L split by entrypoint). Generated manifest scripts must use the repo generator, not manual edits.
- **Confidence/open questions:** high admission gap, low net savings. Which raw commands remain outside managed launch paths? Quantify coverage rather than claiming total machine control.

## Rejected mechanisms considered

| Mechanism | Why it stays rejected; new evidence that could reopen |
| --- | --- |
| Second scheduler/checker agent/beep-heavy lock around Yeet | Explicit operator ruling; adds authority and double reservations. Measurements can improve this scheduler, not reopen a second authority without a new operator ruling. |
| Publish proof weight 1 or docs admission bypass | Prior D1 rejection; expensive scanners remain possible. Reopen only a specific low weight with isolated current-plan cold/warm envelopes and adversarial resource trials. No bypass proposed. |
| Preempt running work when capacity shrinks | Violates nonpreemption, loses proof integrity. Keep rollback of newest promoter before execution. Reopening needs an explicit policy change plus resumable-proof correctness, not a throughput graph. |
| Detached scopes/nohup/templates or a cgroup per inner unit | Ruling 35 makes the proof service the accounting unit. Unit reservations are records; no new evidence here justifies changing that ruling. |
| Worker-host admission bypass | Preserve explicit refusal/recorded force-local rules and hosted route. A demonstrated new supported envelope can qualify a profile, not silent bypass. |
| Capacity-stamp projection family/minimal event pairs | Prior ciops ruling parks the former and rejects inadequate attribution in the latter. This report retains lifecycle identity and collects the measurements required for unit resource demand. Reopen the broader family only through its own recorded ruling and evidence. |
| Parallel final-check with audit/docgen | Admission alone cannot solve concurrent output writes. Reopen only with equivalent-work, output-conflict and lifecycle parity experiments; initial rollout leaves final-check serial. |
| Shortest-job-first without fairness | Endless cheap arrivals starve large proofs. Restrict cheapest-first to eligible fair scheduling and preserve original enqueue age; no evidence here supports an unbounded policy. |
| Coverage caching, reduced test/property depth, skipped required contexts | No local scheduler evidence can justify weakening the trust charter. Coverage remains run/head-bound, bare test remains full, doctest remains fleet-wide, required contexts remain present. |
| Increase hosted pool cap or move jobs to paid capacity | Outside Area G and operator money boundary. No estimated hosted savings credited. |

## Contradictions with the inventory

1. “Only Yeet takes leases” is false in current source: five Cache command modules call `withQualityAdmission`. Include their leases in compatibility and attribution tests.
2. “Unadmitted work caused” the 4.6 GiB dip is stronger than the evidence. Inventory itself admits no process attribution; one lease plus host pressure establishes unexplained load, not its source. Other applications, retained cache and unobserved agents remain candidates.
3. The simplified capacity formula omits existing ancestor-cgroup reservation accounting in `MemoryStats.service.ts`; do not reimplement #2973 or claim host MemAvailable alone determines capacity.
4. Position and holder feedback already exist. Missing pieces are structured actionable state, ETA uncertainty, eligible alternative ordering and a defensible fairness bound.
5. 23–33 GiB cgroup peaks are not anonymous RSS. Page cache is included; current release counters cannot recover composition at peak. Raising weights alone may lower throughput.
6. The 2,068 quarantine entries are historical evidence, not 2,068 queued jobs. Status cleanup is context hygiene, not recovered compute slots.
7. Current retained ring is 607 rows and wait p90 82.232s; inventory's 606/85.6s reflects a moving retention window, not necessarily an erroneous calculation. Peak median is reproduced. This pass did not reproduce idle-73% or docs/goals-42% joins.
8. Schema `publish:1` is real, while Handler proof scopes use full-proof(3); they describe different scopes, not contradictory implementations.
9. User-requested Context.Service changes require introducing a service facade over the existing bracket, not editing a scheduler service that already exists.
10. The brief resolves inventory questions on target metric and scheduler direction. No need to re-ask those questions, propose a checker agent, or reopen in-flight partition/input PRs.

## Operator-only questions

**None blocks this design.** Target, direction and trust policy are already ruled. N=1/2/4/8 workload trials, 30-day proposed retention and conservative weights are reversible engineering choices to qualify. Buying capacity, changing hosted runner pool size, or relaxing proof depth would require a separate operator decision and are not requested here. Personal memory migration is outside this read-only audit and requires explicit authorization if later desired. A finite unconditional queue-start SLA would require changing nonpreemption or workload bounds; this proposal instead states the enforceable conditional bound and a distinct 600s backpressure outcome.

Historical memory was consulted only for discovery of admission-versus-pressure context (`MEMORY.md:5635–5645`); live source and journal observations above supersede it. No historical snapshot establishes current contention.

```json
{
  "area": "G \u2014 QualityScheduler and local compute governance",
  "levers": [
    {
      "id": "G-L4",
      "title": "Admit lane/package units while preserving proof ownership",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.5,
        "localWallMinPerVerify": 1.5,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Early release or shared-cgroup reaping loses live proof work"
      },
      "admissionGate": "parity ledger + lifecycle mutation fixtures + A/B measurement with controls",
      "confidence": "medium mechanism; low savings"
    },
    {
      "id": "G-L5",
      "title": "Add CPU demand and grant-controlled worker width",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.2,
        "localWallMinPerVerify": 0.5,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Timeouts or incomplete proofs under incorrect CPU budgets"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "low savings"
    },
    {
      "id": "G-L1",
      "title": "Charge cheap gates by executed footprint",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.25,
        "localWallMinPerVerify": 0.15,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Undercharged global scanners trigger partial OOM"
      },
      "admissionGate": "parity ledger + A/B measurement with controls; route replay + mutation fixture if routing changes",
      "confidence": "medium mechanism; low savings"
    },
    {
      "id": "G-L6",
      "title": "Bound overtaking and expose actionable backpressure",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.05,
        "localWallMinPerVerify": 0.1,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Incorrect fairness or ETA strands work; progress mistaken for green"
      },
      "admissionGate": "adversarial fairness replay + A/B measurement with controls",
      "confidence": "high utility; low savings"
    },
    {
      "id": "G-L8",
      "title": "Retain attributable admission history",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Pruned lifecycles corrupt attribution or ownership evidence"
      },
      "admissionGate": "parity ledger + rotation/crash fixtures",
      "confidence": "high need; no direct savings"
    },
    {
      "id": "G-L2",
      "title": "Calibrate demand from qualified cgroup measurements",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Peak misattribution undercharges memory and yields partial OOM"
      },
      "admissionGate": "telemetry parity + A/B measurement with controls",
      "confidence": "high semantics; medium estimator"
    },
    {
      "id": "G-L7",
      "title": "Retire obsolete wrapper guidance and quarantine residue",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Deleting live ownership or evidence exposes unadmitted work"
      },
      "admissionGate": "none, pure waste removal for display; ownership and restore fixtures for archive",
      "confidence": "high display benefit; retirement needs live census"
    },
    {
      "id": "G-L3",
      "title": "Admit final check package verification and ad hoc heavy commands",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Nested waits or omitted producers yield incomplete verification"
      },
      "admissionGate": "route replay + mutation fixture + parity ledger + A/B measurement with controls",
      "confidence": "high gap; low net savings"
    }
  ]
}
```
