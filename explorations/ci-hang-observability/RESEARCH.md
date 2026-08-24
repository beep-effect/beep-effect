# Research

## 2026-08-23 — CI hang root cause and observability

Scope: why hosted `Lint Policy` jobs sometimes finish nearly all work, then sit
silent until the 50-minute job timeout with bun processes still alive. Evidence
lanes: full job-log archaeology (four incidents + 100-run census), read-only
AWS instance forensics, an evidence-grade in-repo code trace
([`research/lanes/code-trace-report.md`](./research/lanes/code-trace-report.md)),
external prior-art research
([`research/lanes/external-prior-art.md`](./research/lanes/external-prior-art.md),
[`research/lanes/external-bun-spin.md`](./research/lanes/external-bun-spin.md)),
and local reproduction attempts. Distilled operational evidence with the full
incident census lives in
[`research/evidence/EVIDENCE.md`](./research/evidence/EVIDENCE.md); provenance
in [`research/SOURCES.md`](./research/SOURCES.md).

### Established facts (proven, with evidence class)

1. **Four occurrences of one signature.** 2026-08-14 and 2026-08-17 (victim
   `lint:docgen`, pre-#748), 2026-08-18 and 2026-08-23 (victim
   `lint:native-runtime`, post-#748). Each: all other policy steps print
   `done in`, the victim never does, total silence for 29-44 minutes, GitHub
   cancels at `timeout-minutes: 50`, and runner cleanup terminates **exactly
   six bun processes in three adjacent-pid pairs**. [job logs]
2. **The six orphans are structural.** The lane is three nested `bun run`
   pairs — `bun run beep ci lane lint-policy`+`bin.ts` →
   `bun run beep lint policy --full`+`bin.ts` → victim
   the victim step's `bun run` wrapper+`bin.ts` — each an intentionally detached session
   leader (Effect spawner default on Linux), unreachable by the runner's
   step-PID-only SIGINT/SIGTERM/SIGKILL. Six alive ⇒ both waiting ancestors
   plus the victim pair were alive at cleanup. [code trace + actions/runner
   source + job logs]
3. **The victim's direct child never exited.** Two independent proofs:
   (a) actions/runner force-completes a step ~5s after the step process exits
   even with held pipes, so 43 minutes of silence requires a live step tree;
   (b) since PR #748 (`capturePipeDeadline`, merged 2026-08-17, in the tree
   for both post-fix incidents) a step whose child exits is either completed
   or crashed loudly (`CapturePipeWedgedError`) within ~6s of that exit —
   neither happened. [runner source + StepExec.ts:483-522 + job logs]
4. **The hung chain was busy-spinning, not blocked.** Instance CPU is a
   dead-flat plateau for the entire silence window: exactly 1 core pinned
   (2026-08-14) or exactly 2 cores pinned (2026-08-17, 2026-08-23) of 8
   vCPUs, with **zero disk reads**, background-only writes, and
   keepalive-only network. [CloudWatch, three incidents]
5. **Host and orchestration are healthy.** Status checks 0, kernel console
   free of OOM/hung-task/panic, clean scale-up/scale-down in CloudTrail, no
   TTL-reaper interference, cancellation at exactly the configured timeout.
   64 GiB instance; co-resident peak well under capacity. [AWS evidence]
6. **The victim law spawns nothing.** `beep laws native-runtime --check` is a
   single-process, serial, in-process ts-morph AST scan — no ESLint, no
   tsserver/tsgo, no turbo, no git, no workers, no `Bun.spawn` on its path
   (NOT FOUND across the law, its handler, and its imports). Any
   grandchild-holds-the-pipe explanation is structurally impossible for this
   victim. [code trace]
7. **Step completion awaits exit ∧ stream-EOF.** `runCaptured` runs
   `Effect.all([fold(handle.all), handle.exitCode])`; the `done in` marker
   prints only after both. Captured output is buffered and only rendered
   after completion — a hung step is a total black box mid-flight.
   [Tasks.ts:1371-1449, StepExec.ts:604-635]
8. **The schedule is deterministic, and the victim's start window is too.**
   Static LPT order + concurrency 3 reproduce the same slot timeline every
   run; `lint:native-runtime` takes its slot at ≈ lane-minute 3.7, overlapping
   the 12-16 GiB 4-way `deprecated-apis` ESLint shards for its first ~83s.
   A deterministic schedule makes a timing/load-window race strike the same
   victim repeatedly — and the victim changed exactly when step content and
   timings changed (post-#748 merge window). [schedule reconstruction]
9. **Solo invocations do not reproduce.** 41 local runs of the exact victim
   command under CI-like env and piped stdio (bun 1.3.14, same pin as CI):
   0 hangs, all ~10s. [hammer]
10. **Frequency ≈ 2 per ~90 Lint Policy runs** in the 2026-08-17→23 window;
    all neighboring runs succeed in 5-6 min. [census]

### What is inference (not yet proven)

- **Where the spin lives.** The evidence localizes the hang to the victim
  pair (`bun run` script-runner wrapper + `bin.ts` law process) and proves it
  burns 1-2 cores without I/O, but does not identify the spinning code: Bun
  runtime internals (event-loop/stream spin, GC thrash under the co-resident
  allocation burst, `bun run` wrapper wait loop) vs. a ts-morph/TS
  non-progressing loop. The 10s deterministic local result over identical
  input argues against a pure input-driven compiler loop; the co-residency
  window and CI-only trigger argue for a load/timing-sensitive runtime
  pathology. The spin-signature follow-up found **named Bun defects that
  match exactly**: [bun#27766](https://github.com/oven-sh/bun/issues/27766)
  (open; confirmed on 1.3.14) — spawning many concurrent bun children with
  piped stdio leaves 5-10% of them **permanently spinning at 100% of one
  core, never exiting, ignoring SIGTERM**, with zero-timeout poll stacks;
  the issue's own logs record "STUCK: 2 children", matching our 1-core and
  2-core plateaus. [bun#34069](https://github.com/oven-sh/bun/issues/34069)
  (open; reproduced on 1.3.14) adds the parent-side variant — a pipe-reader
  wait-loop spinning at 99.9% after a lost child exit — whose reporter also
  measured **0/40 in a synthetic hammer** while hitting ~1/5 in real suites,
  mirroring our own 0/41 hammer. The coherent story: 1-core incidents = the
  victim `bin.ts` in a #27766 spin (its `bun run` wrapper asleep in
  `wait4`); 2-core incidents = that plus the policy-runner's capture reader
  in a #34069-style spin. This remains inference until an on-host stack
  confirms it, but it is now inference with named, version-matched prior
  art. **Bun 1.4.0 (released 2026-08-20; there is no 1.3.15) ships several
  fixes in this family** (epoll_pwait sub-ms busy-spin #34780, ReadableStream
  100%-CPU #36087, nested `bun run` wait #36711, FileReader level-triggered
  re-arm #34177) though #27766 itself was still reproducible on a 1.4
  canary — see
  [`research/lanes/external-bun-spin.md`](./research/lanes/external-bun-spin.md).
- **Why 1 core in one incident and 2 in two others.** Consistent with either
  one or both processes of the pair spinning, or a runtime with one or two
  hot threads; undetermined.
- **Whether the pre-#748 docgen incidents share the same mechanism.** Same
  end-state signature and a CPU plateau in both, but docgen's step does spawn
  descendants, so the (now-fixed) pipe-EOF class was also available to it.
  The post-fix incidents are the clean cases.

### Hypothesis ranking

| # | Hypothesis | Verdict | Discriminating evidence |
| --- | --- | --- | --- |
| H1 | Victim bun child enters a non-progressing event-loop busy-spin — the bun#27766 class (concurrent piped children, 100% of one core, SIGTERM-immune, open on 1.3.14), with bun#34069 parent-reader spin as the 2-core companion | **Leading; all facts consistent + named version-matched prior art** | Facts 3, 4, 6, 8, 9; #27766/#34069 signatures |
| H2 | Child exited, stdio pipe held open by an inheriting process (the class PR #748 fixed) | **Refuted for post-fix incidents** | Fact 3 (deadline would fire), fact 6 (no descendant exists to hold the pipe) |
| H3 | Resource exhaustion / kernel OOM / disk full | **Refuted** | Fact 5; zero OOM console lines; 25 siblings completed |
| H4 | Runner infrastructure failure / GitHub orchestration | **Refuted** | Fact 5; healthy runner performed the cancel + cleanup |
| H5 | Effect scheduler/fiber defect in the orchestrator (step fiber never scheduled or lost) | **Effectively refuted** | Fact 4 (orchestrator idle-waiting would not pin cores; a lost fiber burns nothing); 25 identical paths completed; announcement of all 26 commands precedes scheduling |
| H6 | ts-morph/TS compiler infinite loop on this input | **Unlikely but open** | Fact 9 (same input, 41 clean runs) argues against; cannot be fully excluded without an on-host stack |

### The mitigation gap (why #748 didn't cover this)

`capturePipeDeadline` arms **after** `handle.exitCode` resolves — it bounds
the drain, not the child. Nothing in the lane bounds a child that never
exits: no per-step `Effect.timeout`, no watchdog, no heartbeat, no progress
output (all confirmed NOT FOUND). The only bound is the job-level 50-minute
timeout, which converts a ~10s step into a 50-minute billable hang plus a
lost lane. The victim shift (docgen → native-runtime) is consistent with
#748 having genuinely closed the pipe-EOF class while leaving the
never-exiting-child class exposed.

### Cheapest discriminating instrumentation (per remaining unknown)

1. **Split the dual await** (identifies exit-vs-EOF and pid): timestamped
   structured events at StepExec's `Effect.all` — spawn (pid/pgid), exitCode
   resolved, capture EOF, deadline armed/fired. One recurrence then tells
   exactly which state the victim died in. ~15 lines.
2. **Per-step soft watchdog with forensic dump** (identifies the spinning
   pid and its state): at N× the step's LPT-expected duration (or a flat
   2-3 min for sub-30s steps), without killing anything, dump once:
   `ps -eo pid,ppid,pgid,sid,stat,pcpu,wchan:24,etimes,args --forest`,
   `/proc/<pids>/status` (threads, ctx-switch counters — voluntary≈0 with
   high nonvoluntary ⇒ spin), `/proc/<pids>/smaps_rollup` (heap size ⇒ GC
   thrash discriminator), `/proc/<pids>/stack` where permitted. This converts
   the next ~2%-probability recurrence into a root-cause identification.
3. **Concurrency repro harness** (removes the need to wait for CI): victim
   command × 50 iterations with 2 synthetic co-residents reproducing the
   deprecated-apis allocation profile; if it wedges, attach `perf top`/gdb.
4. **Bun 1.4.0 canary**: 1.3.14 → 1.4.0 (2026-08-20) on a shadow lane; 1.4
   ships the #34780/#36087/#36711/#34177 spin-family fixes and a claimed 5×
   idle-CPU drop, but #27766 itself is still open — treat the bump as
   probability reduction plus better diagnostics, not a proven kill.
5. **Drop the `bun run` wrapper for policy steps** (`bun
   packages/tooling/tool/cli/src/bin.ts …` directly): halves the process
   count per step, removes the wrapper wait path from the suspect set, and
   is a one-line change in `repoCliStep` — high information per unit risk.
6. **On-host forensics recipe when a wedge is caught live** (from the
   bun-spin lane): `/proc/<pid>/{stat,wchan,status,syscall,task}` (R-state,
   wchan 0, frozen voluntary ctx-switches ⇒ userspace spin), 2s
   `strace -f -c` (zero-timeout `epoll_pwait*` storm vs idle `wait4`), and
   `gdb -p <pid> -batch -ex 'thread apply all bt'`. Bun 1.3.14 has no
   dump-on-signal; `--cpu-prof` exists but must be armed at process start.

### Existing observability capabilities (inventory)

Present: per-step `done in` markers (completion only); pre-scheduling command
announcements; lane-level `run_lane` group reap; #748 post-exit wedge guard +
its unit suite (`step-capture-lifecycle.test.ts`); `beep ci lane-timings`
(offline job/setup/pickup durations from the Actions API; no RSS); setup
telemetry in the step summary; operator-dispatched `fleet-lane-probe.yml` /
`fleet-shadow-check.yml` host probes; job-level timeouts; CloudWatch EC2
metrics (1-min CPU/net/disk; **no memory** — no CW agent on fleet AMI);
fleet lambda logs + CloudTrail.

NOT FOUND (the gaps that made these incidents month-long mysteries): live or
tee'd step output; per-step timeout/watchdog; heartbeat; structured per-step
lifecycle events (spawn pid / exit / EOF); any process/`/proc`/`ps` dump on
timeout or cancellation; always-run diagnostic step in `check.yml`; runner
memory metrics; OTel spans/export anywhere in the CI path.

### Recommendation sketch (inputs to ALIGN — decisions belong to the operator)

- **Durable fix direction:** bound every policy step (per-step timeout with
  diagnostic dump + group-kill escalation, i.e. extend the #748 philosophy
  from "after exit" to "from spawn"), rather than chasing the bun defect
  first — the lane must survive a spinning child regardless of its cause.
  A step retry-once-on-timeout would likely convert both incidents into
  ~7-minute green lanes (the victim is deterministic-input and passed in 87
  other runs).
- **Observability direction:** instrument the existing seams (StepExec dual
  await + watchdog dump) before adding any hosted infrastructure; the fleet
  is ephemeral, so in-job forensics at the moment of wedge is worth more
  than any dashboard. CW agent / memory metrics and OTel export are optional
  escalations with real cost/retention questions — operator decisions.
- **Open questions for the grilling:** observability scope (in-job dumps
  only vs CW agent vs OTel/LGTM), retention/cost ceiling, CI failure policy
  on step timeout (fail fast vs retry-once vs observe-only first), bun
  upgrade posture, and whether to attempt the concurrency repro before or
  after instrumentation ships.
