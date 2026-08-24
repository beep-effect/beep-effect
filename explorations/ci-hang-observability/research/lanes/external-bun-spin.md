# Bun 1.3.14 CI hang: 100% CPU busy-spin (external research)

**Incident (given):** GitHub Actions self-hosted runner, Amazon Linux 2023 EC2, 8 vCPU. `bun run <script>` wrapper + `bun <file>.ts` child hang after work that normally finishes in ~10s. Child stdout/stderr are pipes captured by a parent orchestrator (another bun process). Child stdin inherited. During 40+ min hang: dead-flat CPU plateau at **exactly 1 full core** (1 incident) or **exactly 2 full cores** (2 incidents) — busy-spin, not blocked wait. Six bun processes at cleanup: orchestrator pair, victim step pair, one unexplained pair.

**Research date:** 2026-08-23  
**Pinned runtime:** Bun 1.3.14 CLI (`0d9b296`)  
**Method:** oven-sh/bun issues/PRs/changelogs, Bun docs/blog, Effect-adjacent reports. Every claim has URL + date + version.

**Version fact:** There is **no Bun 1.3.15+**. 1.3.14 (2026-05-13) is the last 1.3.x; the next published runtime is **Bun 1.4.0** (2026-08-20).

---

## Ranked shortlist (read this first)

| Rank | Documented defect | Fit to 1-or-2-core, ~2% race, wrapper never completes | Status vs 1.3.14 |
| --- | --- | --- | --- |
| **1** | Event-loop **zero-timeout poll spin** (`epoll_pwait2`/`kevent64` timeout=0, never parks). Family: [#27766](https://github.com/oven-sh/bun/issues/27766) (open). Linux cousins: [#34780](https://github.com/oven-sh/bun/pull/34780) epoll_pwait fallback, [#33261](https://github.com/oven-sh/bun/issues/33261) nested-tick `ready_polls` clobber. | **Best.** Permanent 100% of one core; SIGTERM ignored; child never exits after work should be done; piped stdio; race 5–10% of concurrent children (~2% of a quieter schedule is plausible). 1-core = one spinning child, wrapper asleep in `wait4`. 2-core = two spinning children among the three `bun run`+`bun` pairs. | **Still open on 1.3.14** (and on 1.4.0-canary.1 as of 2026-05-26). Several sibling fixes landed in 1.4.0. |
| **2** | **`spawnSync` wait-loop spin after lost child-exit** ([#34069](https://github.com/oven-sh/bun/issues/34069), open). Parent re-registers a finished pipe reader / `tickWithTimeout` never blocks; child is a **zombie**. | Strong if the hung JS actually calls `spawnSync`/`execFileSync`. Rate ~1/5 of a spawn-heavy suite; synthetic loops miss it. **Weaker** for a pure `bun run` wrapper: [#36711](https://github.com/oven-sh/bun/pull/36711) shows `bun run` waits with **`wait4`**, which would be 0% CPU, not a spin. | Open on **1.3.13 and 1.3.14**. Related PRs (#37754, #38883) after 1.3.14; issue still open 2026-08-21. |
| **3** | **Inherited-stdin / pipe FileReader spin** (1.3.14 changelog FIFO-stdin 100% CPU; [#22237](https://github.com/oven-sh/bun/issues/22237) “occasionally hogs CPU”; [#34177](https://github.com/oven-sh/bun/pull/34177) EPOLLONESHOT lost-dispatch). Incident: **stdin inherited**, stdout/stderr pipes. | Explains a **parent+child 2-core** plateau: child event-loop spin + parent pipe-reader EAGAIN/POLLHUP loop. Classic pipe *deadlock* is a **blocked wait (0% CPU)** — not this signature — unless the reader busy-polls a always-ready/HUP fd. | FIFO-stdin 100% CPU **claimed fixed in 1.3.14**; FileReader level-triggered re-arm is **1.4** (#34177, 2026-07-14). Residual races remain. |
| **4** | **ReadableStream `pull`/`driveAsyncIterator` 100% CPU** ([#36087](https://github.com/oven-sh/bun/pull/36087); 1.4 blog). Sync `_read()`/`next()` never yields. | Matches a **child** that is still pumping a stream after “work done”. Less specific to `bun run`. Benchmarks were run against **1.3.14+0d9b296af**. | **Fixed after 1.3.14** (in 1.4.0). |
| **5** | Unsettled top-level await / never-resolving Promise at **100% CPU** ([#14951](https://github.com/oven-sh/bun/issues/14951) open; [#31501](https://github.com/oven-sh/bun/issues/31501) on 1.3.14). | Matches a hang, but **not** “work finished in ~10s then stuck in the wrapper chain”. Effect fibers *could* leave this, but it is a JS-lifetime bug, not a spawn/pipe race. | Open on 1.3.14. Node warns+exits; Bun spins. |

### Single cheapest change

**Most likely to eliminate *or* expose it, in order:**

1. **Stop using the `bun run` wrapper for the victim step** — invoke `bun <file>.ts` (or `bun --bun <file>.ts`) directly. [#36711](https://github.com/oven-sh/bun/pull/36711) (2026-08-01, 1.4) documents that `bun run` is a distinct process that **forwards signals and `wait4`s the child**. If the hang disappears, the wrapper/wait path is implicated; if the child still pins 1 core, it is the runtime event loop (#27766 family). Cost: one argv change.

2. **Change stdio of the orchestrator spawn:** `stdin: "ignore"` (do not inherit), `stdout`/`stderr`: `"inherit"` or `"ignore"` instead of captured pipes. Docs default `Bun.spawn` stdout to a `ReadableStream` pipe ([bun.com/docs/guides/process/spawn](https://bun.com/docs/guides/process/spawn), retrieved 2026-08-23). If the 2-core cases vanish, it is pipe-reader spin + child spin. Cost: one spawn-options change. **This is the cheapest *experiment* that distinguishes rank 1 vs rank 3.**

3. **Bump Bun 1.3.14 → 1.4.0** (2026-08-20). There is no 1.3.15. 1.4.0 contains the documented busy-spin fixes (#34780 epoll_pwait 0ms timeout, #36087 fetch/ReadableStream 100% CPU, #36711 nested `bun run` wait, FileReader level-triggered #34177, spawnSync isolation #38883) plus a claimed 5× idle-CPU drop. **Caveat:** [#27766](https://github.com/oven-sh/bun/issues/27766) was **still reproducing on 1.4.0-canary.1** (2026-05-26); #34069 was **still open after 1.4.0** (comment 2026-08-21). A bump is the right first production change, but is not a guaranteed kill.

Do **not** expect `--no-orphans` (new in 1.3.14) to fix a busy-spin: it kills on *parent death*, not on a live spinning child.

---

## 0. Version map

| Version | Date | Source |
| --- | --- | --- |
| **Bun v1.3.14** | **2026-05-13** (GitHub release 03:48 UTC; blog dated May 13, 2026) | [github.com/oven-sh/bun/releases/tag/bun-v1.3.14](https://github.com/oven-sh/bun/releases/tag/bun-v1.3.14) · commit `0d9b296` · [bun.com/blog/bun-v1.3.14](https://bun.com/blog/bun-v1.3.14) |
| Bun v1.3.13 | 2026-04-20 | [github.com/oven-sh/bun/releases](https://github.com/oven-sh/bun/releases) · `bf2e2ce` |
| **Bun v1.4.0** (next after 1.3.14; **no 1.3.15**) | **2026-08-20** | [bun.com/blog/bun-v1.4](https://bun.com/blog/bun-v1.4) · tag `bun-v1.4.0` `34cbb9a` |

AL2023 kernels are **6.1+** (optional 6.12 / 6.18). `epoll_pwait2(2)` exists since Linux **5.11**, so the **epoll_pwait millisecond fallback is not the default path** on AL2023 unless something forces it (`BUN_FEATURE_FLAG_DISABLE_EPOLL_PWAIT2=1`, seccomp, gVisor). Source: [AWS AL2023 kernel docs](https://docs.aws.amazon.com/linux/al2023/ug/kernel-update.html) (retrieved 2026-08-23); [epoll_pwait2 HISTORY](https://man7.org/linux/man-pages/man2/epoll_wait.2.html) cited in [#34780](https://github.com/oven-sh/bun/pull/34780) (2026-07-20).

---

## 1. Known 100% CPU *spins* (not blocked waits)

### 1.1 OPEN — event-loop zero-timeout poll spin — [#27766](https://github.com/oven-sh/bun/issues/27766)

- **Opened:** 2026-03-03. **Status as of 2026-08-23: OPEN.**
- **Versions:** originally 1.3.10; **confirmed on 1.3.14 (`0d9b296af`) and 1.4.0-canary.1 (`0974d031c`)** in a 2026-05-25 comment (non-Ink PGLite CLI).
- **Signature:** spawn many concurrent `bun` children with `stdio: ["pipe","pipe","pipe"]`; **5–10% permanently hang at 100% of one core**; never exit; **SIGTERM ignored, SIGKILL required**; stacks show **`kevent64` with zero-timeout polling**. Observed 5+ hours.
- **Why it matches:** race, piped stdio, child work that should complete, wrapper/parent left waiting, exactly one core per stuck process. Two stuck children = two cores.
- Related (cited in the issue): [#26811](https://github.com/oven-sh/bun/issues/26811) / [#26812](https://github.com/oven-sh/bun/pull/26812) kqueue filter CPU (fixed 1.3.8, **this issue persists on 1.3.10+**); [#27490](https://github.com/oven-sh/bun/issues/27490) bmalloc `madvise` EAGAIN 100% retry; [#24231](https://github.com/oven-sh/bun/issues/24231) multiple bun processes 100% CPU.

### 1.2 FIXED IN 1.4 (after 1.3.14) — `epoll_pwait` fallback busy-spin — [#34780](https://github.com/oven-sh/bun/pull/34780)

- **PR:** 2026-07-20, commit `f2ce246`. Shipped in **Bun 1.4.0** ([blog](https://bun.com/blog/bun-v1.4), 2026-08-20): *“The epoll_pwait fallback no longer busy-spins on sub-millisecond timers. #34779 #34780”*.
- **Mechanism (verbatim from the PR):** when `epoll_pwait2` is unavailable, ns→ms **truncates** so sub-ms timer deadlines become `epoll_pwait(..., 0)` and the loop **busy-spins at 100% CPU until the deadline**. Fix: round up to 1 ms. Also: EINTR retries now subtract elapsed time (SIGCHLD storms / SIGPROF used to over-wait).
- **Repro:** `BUN_FEATURE_FLAG_DISABLE_EPOLL_PWAIT2=1 bun -e 'setInterval(..., 1)'` → **100% before, ~5% after**.
- **Fit:** a *sub-ms timer* spin lasts until the next deadline (ms), not 40 minutes — **unless the computed timeout is stuck at 0 forever** (the #27766 zero-timeout case). On AL2023 6.1+, `epoll_pwait2` is present, so this fallback is **off the default path**. Still the cleanest *documented Linux busy-spin in uSockets*.

Note: GitHub auto-linked [#34779](https://github.com/oven-sh/bun/pull/34779) in the 1.4 blog; that PR is a **Windows QPC monotonic clock** fix (2026-07-20), not the epoll spin. The Linux spin is **#34780**.

### 1.3 OPEN — `spawnSync` lost-exit, wait loop 100% CPU — [#34069](https://github.com/oven-sh/bun/issues/34069)

- **Opened:** 2026-07-13. **OPEN** as of 2026-08-21.
- **Versions:** 1.3.13 profile dSYM; **“behavior identical on 1.3.14”**; production hit on **1.3.14** (comment 2026-08-17).
- **Signature:** child **exited (zombie)**, pipes already closed; parent `R` at **99.9% of one core**; stack `spawnMaybeSync` → `PipeReader.PosixBufferedReader.registerPoll` → `kevent64` **every loop iteration**, or (later capture) **zero syscalls**, pure userspace `tickWithTimeout` / `computeHasPendingActivity`. Rate ~1 in 5 full suites; 0/40 in a synthetic `execFileSync` hammer. SIGTERM does not recover the wait loop.
- **Linux analogue already patched in 1.3.14:** changelog *“subprocess `'exit'` event not firing on Linux when multiple child processes exit simultaneously with `stdio: 'ignore'`”* because **pidfd was `EPOLLONESHOT` and the kernel disarmed it before userspace dispatched** ([bun.com/blog/bun-v1.3.14](https://bun.com/blog/bun-v1.3.14), 2026-05-13). That is the same *lost-exit* class; #34069 says the **spawnSync isolated loop** still loses it.

### 1.4 FIXED IN 1.4 — fetch / node:stream Readable 100% CPU — [#36087](https://github.com/oven-sh/bun/pull/36087)

- **PR:** 2026-07-27. 1.4 blog: *“Fixed fetch() hanging at 100% CPU when a node:stream Readable whose `_read()` pushes synchronously was passed as the request body.”*
- **Cause:** `driveAsyncIterator` never yields when `next()` is already fulfilled and `controller.write` returns `>= 0` (no backpressure). gdb: `ArrayBufferSink.write` re-entered from JS indefinitely. RSS climbs; timers never fire.
- **Benchmarked against `1.3.14+0d9b296af`.** Also: *“spawn-pipe (fetch.body → spawn stdin) on main **fails** (EPIPE)”*.

### 1.5 FIXED IN 1.3.x / earlier — SSL pool / WS / debugger / inotify spins

| Issue | Version | Status | Notes |
| --- | --- | --- | --- |
| [#25430](https://github.com/oven-sh/bun/issues/25430) SSL pool idle sockets keep reporting readable → kevent/epoll busy-poll 100% | 1.3.4, 2026-12-09 | Closed 2026-12-13 via [#25475](https://github.com/oven-sh/bun/pull/25475) | Comment: Linux repro did **not** fire; macOS Tahoe. **Before 1.3.14.** |
| [#24271](https://github.com/oven-sh/bun/pull/24271) `unref poll_ref` on WS upgrade to prevent CPU spin | cited from #25430, 2025 | merged | node:http |
| [#8157](https://github.com/oven-sh/bun/issues/8157) 100% CPU `epoll_wait` in IO Watcher | 1.0.27, 2024-01-13 | Closed 2025-02-07 as OK on 1.2.2 | **Blocked** `epoll_wait` (long usecs/call), not a userspace spin. |
| [#27667](https://github.com/oven-sh/bun/issues/27667) File Watcher 100% CPU (same inotify events forever) | 1.3.9, 2026-03-01 | Closed via [#27668](https://github.com/oven-sh/bun/issues/27668) | Separate thread, not `bun run` wrapper. 1.3.14 **rewrote fs.watch**. |
| [#21654](https://github.com/oven-sh/bun/issues/21654) 100% CPU of one core when debugging | 1.0–1.3.1 | Open (comments through 2025-10) | Debugger `BunDebugger.cpp` spin loop. Only if `--inspect` is on. |
| [#14951](https://github.com/oven-sh/bun/issues/14951) `await new Promise(()=>{})` hangs at **100% CPU** | 2024-11-02 | **Open** (also [#31501](https://github.com/oven-sh/bun/issues/31501) on **1.3.14**, 2026-05-28, closed as duplicate) | Node warns+exits 13; Bun spins. |
| [#6669](https://github.com/oven-sh/bun/issues/6669) `setTimeout(0)` loop hang 100% CPU | 1.0.7, 2023-10-23 | Closed #6674 | Old. |
| [#20144](https://github.com/oven-sh/bun/issues/20144) `bun:ffi` cc + infinite loop, Ctrl+C → multi-core `tcsetattr` spin | 1.2.16, 2025-06-02 | Closed | macOS only (`tcsetattr` EINTR loop). |

### 1.6 1.3.14 changelog items that already name this class

From [bun.com/blog/bun-v1.3.14](https://bun.com/blog/bun-v1.3.14) (2026-05-13) — these are **in** 1.3.14, so they are prior art for the *class*, not remaining unfixed bugs:

- **“Fixed: `process.stdin` hanging or spinning at 100% CPU when reading from a FIFO pipe and the parent process dies or a new writer reappears during the drain loop.”** Direct match for inherited-stdin + pipe + 100% CPU.
- **Event loop refactor** “to improve reliability and simplify memory management.”
- **pidfd `EPOLLONESHOT`:** `'exit'` not firing on Linux when several children exit together with `stdio: 'ignore'`.
- **`child_process` stdout leak** in `FileReader.onPull` memcpy path.
- **`Bun.spawn` stdin `"pipe"` fd leak** if `.stdin` never read.
- **PipeReader leak** on real read errors (`EBADF`/`EIO`); leaked poll keep-alive.
- **Concurrent `ReadableStream`s sharing a mutable EOF flag** (`Bun.stdin.stream()` vs `fetch(file://)`).
- **First pull returns data and EOF together** → `Controller is already closed`.
- **`timer.ref()` on an already-fired timer** kept the event loop alive (hang, not necessarily 100% CPU).
- **Bun Shell:** `cd` hanging forever on uncommon errnos.

### 1.7 1.4.0 changelog (after 1.3.14) matching spawn / pipe / hang / CPU / event loop / stdout / EOF

From [bun.com/blog/bun-v1.4](https://bun.com/blog/bun-v1.4) (2026-08-20):

- Idle CPU **5× lower**; production p99 CPU 24%→10%.
- *“The epoll_pwait fallback no longer busy-spins on sub-millisecond timers. #34779 #34780”*
- *“epoll/kqueue waits now subtract elapsed time when retrying after EINTR instead of over-waiting. #34779 #34780”*
- *“Fixed nested bun run exiting before its child on Ctrl-C … bun run waits for the script's cleanup to finish. #36711”*
- *“Fixed fetch() hanging at 100% CPU when a node:stream Readable whose `_read()` pushes synchronously was passed as the request body. #36087”*
- `child_process.spawn()` ignores `options.encoding`; stdout/stderr always Buffer chunks (#36050).
- Linux no longer sets `prctl(PR_SET_THP_DISABLE)` inherited across `execve` into `Bun.spawn` / `bun run` / lifecycle scripts.
- `--cpu-prof` tagged **v1.3.2** (so it **exists on 1.3.14**); `BUN_CPU_PROFILE=1` described in the 1.4 post.

---

## 2. `bun run <package.json script>` wrapper: hang / spin / waitpid vs event loop

**How the wrapper waits (documented 1.4 fix, describes 1.3.14 behavior):**

[#36711](https://github.com/oven-sh/bun/pull/36711) (merged for 1.4, 2026-08-01), fixing [#14799](https://github.com/oven-sh/bun/issues/14799) (opened 2024-10-24, closed by #36711):

- Nested `bun run outer` → `bun run inner` → `bun script.js`.
- Signal forwarding installed with **`SA_RESETHAND`**, so the handler resets to `SIG_DFL` after the first SIGINT. A process-group Ctrl+C delivers SIGINT to every runner **and** each runner forwards it, so the middle runner dies on the **second** SIGINT while the inner script is still in cleanup.
- Quote from the PR: **`bun run outer: wait4 sees inner died by SIGINT -> re-raise -> exit`**.
- So **`bun run` waits with `wait4` (waitpid family), not a blocking-free event loop**, and **does** forward signals for the child’s lifetime (once #36711 drops `SA_RESETHAND`).
- Implication for the incident: a healthy `bun run` wrapper waiting on a **still-alive spinning child** should be **asleep in `wait4` (0% CPU)**. A 1-core plateau is then **the child**. A 2-core plateau is **two children** (or wrapper *plus* child if the wrapper has left `wait4` and is spinning in JS/uSockets — which `bun run` should not do unless it also has an event loop tick for stdio/`--no-orphans`).

**`--no-orphans` (new in 1.3.14):** [blog](https://bun.com/blog/bun-v1.3.14) — Linux `prctl(PR_SET_PDEATHSIG, SIGKILL)`; macOS `EVFILT_PROC` on the event loop kqueue. “monitoring both the parent process and **child stdio**” on macOS `bun run`/`bunx`. Opt-in: `bun --no-orphans`, `[run] noOrphans = true`, `BUN_FEATURE_FLAG_NO_ORPHANS=1`. [#35414](https://github.com/oven-sh/bun/pull/35414) (mentioned from #34069, 2026-07-24): *“no-orphans: fix macOS hang when the script exits before kqueue registration.”* Linux path is prctl, not that hang.

**Other wrapper issues (wrong shape for a 40-min 100% CPU plateau):**

- [#21280](https://github.com/oven-sh/bun/issues/21280) (2025-07-22): `bun run --cwd` under `concurrently` fails to forward SIGINT to node children (Windows). Workaround `--bun`.
- [#6052](https://github.com/oven-sh/bun/issues/6052) (2023-09-25, **still Open**): `bun run` exits early after two CLI prompts.
- [#3137](https://github.com/oven-sh/bun/issues/3137) (2023-05-31, closed): process exits before `await subprocess.exited`.
- [#5481](https://github.com/oven-sh/bun/pull/5481) (2023-09-17): `child_process` close/exit events vs process exit.

---

## 3. Bun + Effect prior art

**Only dedicated report found:** [#28604](https://github.com/oven-sh/bun/issues/28604) — *“Bun 1.3.11 hangs on Effect.runSync — event loop regression from 1.3.9”* (opened 2026-03-27, **closed the same day**).

- Repro: `Effect.runSync(Effect.succeed(42))` hangs on Linux x64, Effect 3.19.19 / 3.21.0.
- **False alarm.** Author: CachyOS-packaged `/usr/bin/bun` `x86_64_v3` miscompile; official `bun.sh` 1.3.11 works. Follow-up: [CachyOS/distribution#394](https://github.com/CachyOS/distribution/issues/394).
- GitHub Actions bot duped it against #27766 / #6669 / #27362 because Effect’s scheduler is `setTimeout` / `Promise.then`.

**Nothing found** (as of 2026-08-23 searches over github.com/effect-ts and oven-sh/bun) that reports Effect fibers, `@effect/platform-bun`, or `@effect/platform-node`-under-bun **child_process / stream CPU spins** as a distinct Effect bug. If an Effect program hangs under official Bun 1.3.14, the evidence points at **Bun’s event loop / spawn / streams**, not an Effect-only defect.

Related Bun timer/event-loop bugs Effect would ride:

- [#6669](https://github.com/oven-sh/bun/issues/6669) `setTimeout(0)` tight loop 100% CPU (closed).
- [#14951](https://github.com/oven-sh/bun/issues/14951) unsettled TLA 100% CPU (open).
- [#34780](https://github.com/oven-sh/bun/pull/34780) sub-ms timer → `epoll_pwait(0)` (1.4).

---

## 4. Two bun processes in a parent-child *pipe* relationship (2-core burn)

**True pipe deadlock is 0% CPU** (both blocked: child `write` vs parent not `read`, or vice versa). A **constant 2-core burn** is not that. Documented 2-core-shaped cases:

1. **Two independent event-loop spins** — #27766 batches regularly stuck **1 or 2 children** at 100% each (*“STUCK: 2 children (pid=…, pid=…)”*). Matches “1 incident at 1 core, 2 incidents at 2 cores” if each stuck `bun <file>.ts` is one core and `bun run` is asleep in `wait4`.

2. **Parent pipe-reader busy-loop + child event-loop spin.** #34069: parent `registerPoll`/`kevent64` **every iteration** on a **finished** pipe. Combine with a still-running child (or a second spinner) and you get 2 cores. Linux pidfd ONESHOT lost-exit (fixed in 1.3.14 for `stdio:'ignore'`) is the same family.

3. **JS-level pipe copies, not a spin:** [Discussion #26343](https://github.com/oven-sh/bun/discussions/26343) (2026-01-23): `stdin: ffmpeg.stdout` routes through JS `ReadableStream` (CPU + OOM); `$` uses an OS pipe. CPU was **~3%**, not 100%.

4. **Older hang (blocked, not spin):** [#11297](https://github.com/oven-sh/bun/issues/11297) (1.1.9, 2024-05-23, closed) `lz4.stdout.pipe(tar.stdin)` hangs forever. [#1498](https://github.com/oven-sh/bun/issues/1498) (2022-11-13): kill child while `.read()`ing buffered stdout → parent stays open (`.read()` never resolves) — **event-loop alive, not 100% CPU**.

5. **#36087 spawn-pipe** on 1.3.14: `fetch.body → Bun.spawn stdin` **EPIPE**, not a clean 2-core spin.

6. **Backpressure ignored:** [#26332](https://github.com/oven-sh/bun/issues/26332) (1.3.6, Windows, closed #34740/#30600) fetch ReadableStream body floods memory. Memory, not a 2-core plateau.

**Best 2-core reading of *this* incident:** two of the three `bun <file>` children (orchestrator / victim / unexplained) are in the #27766 zero-timeout poll spin; their `bun run` wrappers are idle in `wait4`. Alternative: orchestrator’s **captured-pipe reader** is in a #34069-style registerPoll spin **and** the victim child is in a #27766 spin.

---

## 5. Cheap post-hoc diagnostics on a headless Linux box (script at timeout)

No SSH. A timeout hook **can** run as the same user as the runner.

### 5.1 Kernel /proc (always do this; no extra tools)

For each bun PID (`pgrep -a bun` / `/proc/*/comm`):

| File | What a *busy-spin* looks like vs a *blocked wait* |
| --- | --- |
| `/proc/<pid>/stat` field 3 | **`R`** (running) vs `S`/`D` |
| `/proc/<pid>/wchan` | spin: `0` / `-` ; wait: `do_epoll_wait`, `futex_wait_queue`, `pipe_read`, `do_wait` |
| `/proc/<pid>/stack` | often **empty for userspace spin**; useful if stuck in a syscall |
| `/proc/<pid>/status` | `voluntary_ctxt_switches` vs `nonvoluntary_ctxt_switches`. Pure userspace spin: **voluntary ≈ frozen**, CPU time climbs. Syscall-spin (`epoll(...,0)`): high voluntary, `%sys` high. |
| `/proc/<pid>/syscall` | `epoll_pwait2`/`epoll_pwait` with timeout **0**; or `restart_syscall` |
| `/proc/<pid>/fd` + `fdinfo` | pipes vs pidfd; epoll `events:` **0x19** (LT) vs **0x40000019** (ONESHOT) — [#34177](https://github.com/oven-sh/bun/pull/34177) used this |
| `/proc/<pid>/task/*/stat` | confirm **one thread** at 100% (main) vs IO Watcher / File Watcher |

Also: `ps -o pid,ppid,stat,wchan,pcpu,etime,cmd`; look for **`Z` zombies** (#34069). `ls -l /proc/<pid>/fd \| grep pipe`.

### 5.2 2-second syscall census (best cheap discriminator)

```
timeout 2 strace -f -c -p $PID
# or: timeout 2 strace -f -e trace=epoll_pwait,epoll_pwait2,epoll_wait,read,write,wait4,pidfd_wait -p $PID
```

- **#34780 / zero-timeout loop:** huge count of `epoll_pwait*` with ~0 wait time.
- **#34069 registerPoll:** `epoll_ctl`/`kevent` every iteration + no `wait4`.
- **Healthy `bun run` wrapper:** blocked in **`wait4`/`waitid`/`pidfd_wait`**.
- **Pipe deadlock (not this incident):** `read`/`write` sleeping.

### 5.3 Stack dump

```
timeout 8 gdb -p $PID -batch \
  -ex "set pagination off" \
  -ex "info threads" \
  -ex "thread apply all bt" \
  -ex detach
```

Needs `ptrace` (same UID usually works on a self-hosted runner; Yama `ptrace_scope` may block). `#36087` used gdb and saw `ArrayBufferSink.write`.

```
timeout 5 perf record -p $PID -g -- sleep 3
perf report --stdio --no-children | head
```

Expect `us_loop_run_bun_tick` / `bun_epoll_pwait2` / `PipeReader` / `spawnMaybeSync` / JSC `llint`.

### 5.4 Bun-built-in dump / inspector (1.3.x)

**There is no documented SIGUSR1/SIGUSR2 native stack dump for Bun 1.3.x** comparable to Node’s SIGUSR1 inspector kick or Java’s SIGQUIT. Searches of [bun.com/docs/runtime/debugger](https://bun.com/docs/runtime/debugger) (retrieved 2026-08-23) and env tables do not mention a hang-dump signal.

What **does** exist on 1.3.14:

| Mechanism | Since | Notes |
| --- | --- | --- |
| `bun --cpu-prof` → Chrome `.cpuprofile` | **v1.3.2** ([1.4 blog](https://bun.com/blog/bun-v1.4)) | Must be **on at process start**. Useless unless the CI command already passes it (or you wrap). |
| `BUN_CPU_PROFILE=1` (+ optional `BUN_CPU_PROFILE_DIR` / `BUN_CPU_PROFILE_NAME`) | Documented in **1.4** post | For workers you cannot pass flags to. Confirm on 1.3.14 before relying. |
| `--cpu-prof-md` Markdown profile | **1.4** | Not on 1.3.14. |
| `--inspect` / `--inspect-brk` / `--inspect-wait` | long-standing | **WebSocket** `ws://localhost:6499/...`, not a unix socket. Port can be set (`--inspect=4000`). [docs](https://bun.com/docs/runtime/debugger). **Do not enable casually:** [#21654](https://github.com/oven-sh/bun/issues/21654) 100% CPU while debugging. |
| `BUN_INSPECT`, `BUN_INSPECT_CONNECT_TO`, `BUN_INSPECT_PRELOAD` | in `src/env_var.zig` ([fossies snapshot](https://fossies.org/linux/bun/src/env_var.zig) 2026-03-18) | Cheap enable without changing argv. Still a WS inspector, needs a client at hang time. |
| `node:inspector` `Profiler.start/stop` | 1.4 blog cites [#25939](https://github.com/oven-sh/bun/pull/25939) | 1.4-era completeness; 1.3.14 inspector is the WS debugger. |

**Recommended CI hang hook (1.3.14, no inspector):** `/proc` snapshot + `strace -c` 2s + `gdb -batch bt` + `ps` zombie check. Optionally start victim with `bun --cpu-prof` so a `.cpuprofile` exists if the process is later SIGKILL’d (profiler must flush; not guaranteed on SIGKILL — prefer SIGTERM first, knowing #27766 **ignores SIGTERM**).

### 5.5 Useful `BUN_*` env (debug, not a dump)

From [bun.com/docs/runtime/environment-variables](https://bun.com/docs/runtime/environment-variables) (retrieved 2026-08-23) and `env_var.zig`:

| Var | Role |
| --- | --- |
| `BUN_DEBUG` / `BUN_DEBUG_ALL` | Internal debug logs (string/boolean). |
| `BUN_DEBUG_QUIET_LOGS=1` | Opposite — used in Bun’s own tests. |
| `BUN_FEATURE_FLAG_DISABLE_EPOLL_PWAIT2=1` | Force the **#34780 fallback** (will *increase* spin risk on 1.3.14; useful only as an A/B). |
| `BUN_FEATURE_FLAG_NO_ORPHANS=1` | Parent-death kill; not a hang dump. |
| `BUN_CONFIG_VERBOSE_FETCH=curl\|true` | Log fetch; irrelevant unless the child is stuck in HTTP. |
| `BUN_GARBAGE_COLLECTOR_LEVEL=1\|2` | Aggressive GC ([Bun.unsafe.gcAggressionLevel](https://bun.com/reference/bun/unsafe/gcAggressionLevel)). Can change races; not a dump. |
| `BUN_JSC_useJIT=0` | Disable JIT (used in [#29697](https://github.com/oven-sh/bun/issues/29697)). Distinguishes JIT hot-loop vs native poll spin. |
| `BUN_OPTIONS` | Prepends CLI flags to **every** bun invocation. **Danger:** [#39377](https://github.com/oven-sh/bun/issues/39377) (2026-08-17, 1.3.14) `bunx` fork-bomb when `BUN_OPTIONS` is set. Do not use blindly. |

---

## 6. How the 1-core vs 2-core plateau maps onto the tree

Six bun processes = **three wrapper pairs** (`bun run` + `bun <file>`):

```
orchestrator:  bun run <orch>  →  bun orch.ts   (captures pipes)
victim:        bun run <step>  →  bun step.ts   (stdin inherited, stdout/stderr piped)
unexplained:   bun run ?       →  bun ?         (lifecycle, bunx, leftover step)
```

[#36711](https://github.com/oven-sh/bun/pull/36711): wrapper **`wait4`s**. So:

- **1 core:** one `bun *.ts` in #27766 zero-timeout spin; its wrapper sleeping; everyone else idle.
- **2 cores:** two `bun *.ts` spinning (victim + unexplained, or victim + orchestrator). Or one child spin + one parent pipe-reader spin (#34069 / FIFO-stdin class).

That is why **stdio inherit/ignore** (experiment 2) vs **skip `bun run`** (experiment 1) vs **1.4 bump** (experiment 3) are ordered by information per unit of risk.

---

## Sources (primary)

- Bun 1.3.14 release: https://github.com/oven-sh/bun/releases/tag/bun-v1.3.14 — 2026-05-13 — bun-v1.3.14 `0d9b296`
- Bun 1.3.14 blog: https://bun.com/blog/bun-v1.3.14 — 2026-05-13 — 1.3.14
- Bun 1.4.0 blog: https://bun.com/blog/bun-v1.4 — 2026-08-20 — 1.4.0
- #27766: https://github.com/oven-sh/bun/issues/27766 — opened 2026-03-03, still open 2026-08-23 — 1.3.10 / **1.3.14** / 1.4.0-canary.1
- #34069: https://github.com/oven-sh/bun/issues/34069 — opened 2026-07-13, still open 2026-08-21 — **1.3.13 / 1.3.14**
- #34780: https://github.com/oven-sh/bun/pull/34780 — 2026-07-20 — 1.4.0
- #36711 / #14799: https://github.com/oven-sh/bun/pull/36711 — 2026-08-01 — 1.4.0 (describes 1.3 `wait4` + `SA_RESETHAND`)
- #36087: https://github.com/oven-sh/bun/pull/36087 — 2026-07-27 — 1.4.0 vs 1.3.14 `0d9b296af`
- #34177: https://github.com/oven-sh/bun/pull/34177 — 2026-07-14 — 1.4.0
- #28604: https://github.com/oven-sh/bun/issues/28604 — 2026-03-27 — 1.3.11 (CachyOS false alarm)
- #14951 / #31501: https://github.com/oven-sh/bun/issues/14951 — 2024-11-02; https://github.com/oven-sh/bun/issues/31501 — 2026-05-28 — **1.3.14**
- #25430: https://github.com/oven-sh/bun/issues/25430 — 2025-12-09 — 1.3.4
- Debugger docs: https://bun.com/docs/runtime/debugger — retrieved 2026-08-23
- Env docs: https://bun.com/docs/runtime/environment-variables — retrieved 2026-08-23
- AL2023 kernels: https://docs.aws.amazon.com/linux/al2023/ug/kernel-update.html — retrieved 2026-08-23 — 6.1 / 6.12 / 6.18
