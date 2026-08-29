# External research: GitHub Actions hang (self-hosted ephemeral runner + Bun lint-policy)

**Incident (context only):** A GitHub Actions job on a self-hosted ephemeral EC2 runner (Amazon Linux 2023, one-job-one-VM, `github-aws-runners/terraform-aws-github-runner` v7.10.1) runs a Bun-based CLI (`bun run beep ci lane lint-policy`) that spawns 26 lint/policy subprocesses with concurrency 3. 25 of 26 completed within ~5 minutes; one step (`lint:native-runtime`) never emitted its completion marker; the job sat silent until GitHub cancelled it at the 50-minute job timeout; the runner's "Cleaning up orphan processes" cleanup then terminated several lingering Bun processes. The same command finishes in ~10 seconds locally.

**Scope:** Pure external research. Claims below are cited to primary sources (GitHub issues, runner/Bun source, official docs) with dates/versions where available. Repository licenses are recorded when a repo is cited.

**Repos and licenses (working list, expanded as sources are added):**

| Repo | License |
|------|---------|
| [actions/runner](https://github.com/actions/runner) | MIT ([LICENSE](https://github.com/actions/runner/blob/main/LICENSE)) |
| [oven-sh/bun](https://github.com/oven-sh/bun) | MIT (core; see [LICENSE.md](https://github.com/oven-sh/bun/blob/main/LICENSE.md)) |
| [nodejs/node](https://github.com/nodejs/node) | MIT ([LICENSE](https://github.com/nodejs/node/blob/main/LICENSE)) |
| [sindresorhus/execa](https://github.com/sindresorhus/execa) | MIT ([license](https://github.com/sindresorhus/execa/blob/main/license)) |
| [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | MIT ([LICENSE](https://github.com/typescript-eslint/typescript-eslint/blob/main/LICENSE)) |
| [vercel/turborepo](https://github.com/vercel/turborepo) | MIT ([LICENSE](https://github.com/vercel/turborepo/blob/main/LICENSE)) |
| [github-aws-runners/terraform-aws-github-runner](https://github.com/github-aws-runners/terraform-aws-github-runner) | MIT ([LICENSE](https://github.com/github-aws-runners/terraform-aws-github-runner/blob/main/LICENSE)) |
| [eslint/eslint](https://github.com/eslint/eslint) | MIT ([LICENSE](https://github.com/eslint/eslint/blob/main/LICENSE)) |
| [microsoft/typescript-go](https://github.com/microsoft/typescript-go) (tsgo) | Apache-2.0 ([LICENSE](https://github.com/microsoft/typescript-go/blob/main/LICENSE)) |
| [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 ([LICENSE.txt](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)) |
| [git/git](https://github.com/git/git) | GPL-2.0 ([COPYING](https://github.com/git/git/blob/master/COPYING)) |
| [ringerc/github-actions-signal-handling-demo](https://github.com/ringerc/github-actions-signal-handling-demo) | no LICENSE file in the repo (cited as empirical signal-timing demo only) |

---

## Status

- [done] §1 actions/runner step-completion, pipe-hold, orphan cleanup, timeout signals
- [done] §2 Bun child-process hang classes
- [done] §3 Node.js / execa prior art
- [done] §4 Lint-toolchain daemons/workers
- [done] §5 Self-hosted / github-aws-runners / AL2023
- [done] §6 Ranking against incident shape

---

## 1. actions/runner step-completion, pipe inheritance, orphan cleanup, job timeout

**Repo:** [actions/runner](https://github.com/actions/runner) — MIT ([LICENSE](https://github.com/actions/runner/blob/main/LICENSE)). Source cited against `main` as of 2026-08-23 (tree SHA `760d2cfe38fbc3bd6aadecdd86695b21765b5aa2`).

### 1.1 A step does **not** complete on process exit alone — the invoker also waits for stdout/stderr EOF

`ProcessInvoker` always redirects all three stdio streams:

```csharp
_proc.StartInfo.RedirectStandardInput = true;
_proc.StartInfo.RedirectStandardError = true;
_proc.StartInfo.RedirectStandardOutput = true;
```

Source: [`src/Runner.Sdk/ProcessInvoker.cs`](https://github.com/actions/runner/blob/main/src/Runner.Sdk/ProcessInvoker.cs) (the worker/listener wrap this type via [`src/Runner.Common/ProcessInvoker.cs`](https://github.com/actions/runner/blob/main/src/Runner.Common/ProcessInvoker.cs)).

It deliberately does **not** use `Process.OutputDataReceived` / `ErrorDataReceived`. Comments in that file:

> The implementation of the process invoker does not hook up DataReceivedEvent and ErrorReceivedEvent of Process, instead, we read both STDOUT and STDERR stream manually on separate thread. The reason is we find a huge perf issue about process STDOUT/STDERR with those events.

Each redirected stream is drained on its own thread until `reader.EndOfStream` (true EOF on the pipe):

```csharp
private void StartReadStream(StreamReader reader, ConcurrentQueue<string> dataBuffer)
{
    Task.Run(() =>
    {
        while (!reader.EndOfStream)
        {
            string line = reader.ReadLine();
            ...
        }
        Trace.Info("STDOUT/STDERR stream read finished.");
        if (Interlocked.Decrement(ref _asyncStreamReaderCount) == 0 && _waitingOnStreams)
        {
            _processExitedCompletionSource.TrySetResult(true);
            ...
        }
    });
}
```

`ExecuteAsync` then waits on `_processExitedCompletionSource`, not on `Process.WaitForExit()` alone. That TCS is completed from **two** paths:

1. **Stream EOF path.** After `Process.Exited` fires, if stdout/stderr readers are still running (`_asyncStreamReaderCount != 0`), the handler sets `_waitingOnStreams = true`. When the last reader hits `EndOfStream`, it completes the TCS.
2. **5-second fallback after exit.** If streams are still open when `Exited` fires, a background task waits 5 seconds, then `KillProcessTree()`, then **forcibly completes** the TCS even if pipes have not EOFed:

```csharp
private void ProcessExitedHandler(object sender, EventArgs e)
{
    if ((_proc.StartInfo.RedirectStandardError || _proc.StartInfo.RedirectStandardOutput)
        && _asyncStreamReaderCount != 0)
    {
        _waitingOnStreams = true;
        Task.Run(async () =>
        {
            // Wait 5 seconds and then Cancel/Kill process tree
            await Task.Delay(TimeSpan.FromSeconds(5));
            KillProcessTree();
            _processExitedCompletionSource.TrySetResult(true);
            ...
        });
    }
    else
    {
        _processExitedCompletionSource.TrySetResult(true);
        ...
    }
}
```

**Implication for hang classification:**

- If the **step process itself has already exited** but a grandchild still holds the write end of the runner's stdout/stderr pipe, the runner will stall **at most ~5 seconds** after `Exited`, then kill and complete. A 45-minute silent hang is **not** explained by the runner waiting on EOF after the step PID is gone.
- If the **step process never exits** (typical: a Bun/Node CLI is itself blocked waiting on a child whose pipes are held open by a grandchild, or a child that never exits), `Process.Exited` never fires, the 5-second fallback never runs, and the step hangs until job-level cancellation. That is the shape of this incident (no completion marker, silence until 50-minute timeout).

On Linux, the fallback kill is **not** a process-tree kill. `NixKillProcessTree()` only calls `_proc.Kill()` on the direct child (already exited in the fallback path), so grandchildren that inherited the pipe are **not** reaped by this path:

```csharp
private void NixKillProcessTree()
{
    try
    {
        if (_proc?.HasExited == false)
        {
            _proc?.Kill();
        }
    }
    ...
}
```

Windows does walk `NtQueryInformationProcess` parent/child relationships and kills the tree. Linux does not. Related: [actions/runner#4601](https://github.com/actions/runner/issues/4601) (opened 2026-08-03, still open as of this research) documents that orphan cleanup is also snapshot-then-`Kill()`, not cgroup/process-tree.

This is the same class of API as .NET `Process.WaitForExit()` with redirected output, which waits for EOF on the async stream readers ([Microsoft docs: `Process.WaitForExit`](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.waitforexit) — "When standard output has been redirected to asynchronous event handlers, it is possible that output processing will not have completed when `HasExited` returns true"; [Stack Overflow analysis of `WaitUntilEOF`](https://stackoverflow.com/questions/68497066/how-can-i-reliably-read-the-full-output-of-a-process-in-c-sharp-when-providing-a), 2021-07-23). The runner reimplemented that wait with a 5s cap.

### 1.2 Canonical class: job/step hangs because a background/grandchild inherited the step's output pipe

This is a well-documented class across GitHub Actions, Azure Pipelines (the runner is a descendant of that agent), Node `child_process`, and every "wait for close, not exit" wrapper.

**GitHub Actions / runner issues:**

| Source | Date | What it shows |
|--------|------|----------------|
| [actions/runner#884](https://github.com/actions/runner/issues/884) "Pipes appear to not pass on EOF on macOS runners" | 2020-12-25 | `yes` left as an orphan (`Terminate orphan process: pid (1129) (yes)`). Classic "writer never sees EOF / reader never sees EOF" on the runner's capture pipes. |
| [actions/runner#1326](https://github.com/actions/runner/issues/1326) "GitHub Actions step is hanging until timeout" | 2021-09-13 | Step stops producing output and hangs until workflow timeout — the same *observable* as this incident. |
| [actions/runner#2298](https://github.com/actions/runner/issues/2298) "GitHub Action step is hanging until timeout" | 2022-12-04 | Process runs as expected until the final step, then hangs with no further log until timeout. |
| [actions/runner#2684](https://github.com/actions/runner/issues/2684) "Action runner ignores SIGPIPE" | 2023-07-07, still open, labeled `bug`/`keep` | Self-hosted VM; `od \| dd` hangs. `/proc/<pid>/fd` shows the step's stdout is the runner's capture pipe (`Runner.Worker spawnclient 106 112`). Author: "so we're using those pipe's to capture the output of the job." Demonstrates the runner **holds the read end of the step's stdout** for the life of the step. |
| [actions/runner#598](https://github.com/actions/runner/issues/598) "Disable process cleanup" | 2020-07-17 | Bazel server started by a job is killed at "Cleaning up orphan processes". Documents that daemons spawned by a step **do** inherit `RUNNER_TRACKING_ID` and survive until job finalize. |
| [orgs/community#58311](https://github.com/orgs/community/discussions/58311) "Prevent cleaning up specific orphan process" | 2023-06-17 | Same: Complete-job step kills all processes carrying the tracking env. |
| [actions/runner-images#13837](https://github.com/actions/runner-images/issues/13837) | 2026 (macOS 15) | NX codegen hangs; post-job cleanup reveals orphan Node processes: `Cleaning up orphan processes` / `Terminate orphan process`. Work completed but processes lingered. |

**Same class outside the runner (establishes the pipe-inheritance mechanism, not Actions-specific):**

- Node `child_process`: `'exit'` fires on PID death; `'close'` fires when **all stdio pipes close**. A grandchild that inherited stdout keeps `'close'` from firing. Canonical docs: [nodejs.org child_process](https://nodejs.org/api/child_process.html) (`'close'` vs `'exit'`). See §3.
- [anomalyco/opencode#24784](https://github.com/anomalyco/opencode/issues/24784) (2026-04-28): "bash tool hangs on Windows when grandchild process inherits stdout pipe" — child exits 0, grandchild daemon holds the pipe, `close` never fires.
- [zackees/running-process#108](https://github.com/zackees/running-process/issues/108) (2026-05-19): daemon trampoline inherits parent stdio; "Any grandparent process reading those pipes never observes EOF and hangs indefinitely." Explicitly: "The hang only manifests when some ancestor reads the daemon's stdio via a pipe — exactly the pattern any CI script uses. Interactive terminal use never triggers it."

**Mitigation folklore (Actions-specific):** start the background process with stdout/stderr redirected to a file or `/dev/null`, or strip `RUNNER_TRACKING_ID`. [Meziantou, 2025-08-04](https://www.meziantou.net/how-to-keep-processes-running-after-a-github-action-job-ends.htm): the runner identifies orphans by `RUNNER_TRACKING_ID`; to keep a process, remove that env var. That is the inverse of this incident (we *want* those processes dead; they were still alive at cleanup).

### 1.3 What "Cleaning up orphan processes" actually does

Implemented in [`src/Runner.Worker/JobExtension.cs`](https://github.com/actions/runner/blob/main/src/Runner.Worker/JobExtension.cs) (`InitializeJob` + `FinalizeJob`). Confirmed by [issue #4601](https://github.com/actions/runner/issues/4601) pinning the same lines at commit `b7fd7da`.

**Start of job (`InitializeJob`):**

- `process.clean` job variable defaults **true**.
- Generate `_processLookupId = $"github_{Guid.NewGuid()}"`.
- `Environment.SetEnvironmentVariable(Constants.ProcessTrackingId, _processLookupId)` where `Constants.ProcessTrackingId = "RUNNER_TRACKING_ID"` ([`src/Runner.Common/Constants.cs`](https://github.com/actions/runner/blob/main/src/Runner.Common/Constants.cs)).
- Snapshot `Process.GetProcesses()` into `_existingProcesses` as `"$pid_$ProcessName"`.

Every descendant of the worker inherits `RUNNER_TRACKING_ID` unless it explicitly unsets it. That is the only tagging mechanism — **not** a cgroup, **not** a session id, **not** a process group.

**End of job (`FinalizeJob`, the "Complete job" step):**

1. Print `Cleaning up orphan processes`.
2. Snapshot `Process.GetProcesses()` again.
3. Skip the current worker PID.
4. Skip anything present in the start-of-job snapshot (same `pid_name`).
5. For every other process, read `RUNNER_TRACKING_ID`:
   - Linux: `File.ReadAllText($"/proc/{pid}/environ")` and split on `\0` ([`LinuxProcessExtensions.GetEnvironmentVariable`](https://github.com/actions/runner/blob/main/src/Runner.Common/ProcessExtensions.cs)).
   - macOS: `ps e -p <pid> -o command` (lossy; cannot parse env values that contain spaces).
   - Windows: PEB walk via `NtQueryInformationProcess` / `ReadProcessMemory`.
6. If the value equals this job's `_processLookupId`, log `Terminate orphan process: pid ({pid}) ({ProcessName})` and call `proc.Value.Kill()`.

**Signals / timing of orphan cleanup:**

- This runs **after** the job's steps have finished **or been cancelled**, in the post-job "Complete job" timeline record — i.e. *after* the 50-minute timeout cancellation has already torn down the step.
- `Process.Kill()` on .NET / Linux is **SIGKILL (9)**, not SIGTERM. There is no SIGINT/SIGTERM grace on this path. ([.NET `Process.Kill` docs](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.kill) — "Kill forces termination"; on Unix it is `SIGKILL`.)
- No second pass. [actions/runner#4601](https://github.com/actions/runner/issues/4601) (2026-08-03): a process spawned *during* the snapshot→`/proc/environ`→`Kill()` window is missed, reparented to init, and lives until the host is recycled. Author's workload: "a Node CLI that spawns a long-lived native server as a child and supervises it over a control pipe. The CLI is killed by the pass; the server is not." Suggested fix 3 is "scope the job to a cgroup on Linux and kill the cgroup" — which AL2023/cgroup v2 would make possible but the runner does **not** currently do.
- Disable with job variable `process.clean: false` ([#598](https://github.com/actions/runner/issues/598)).

Seeing several lingering Bun processes terminated here is **expected** if those processes (a) inherited `RUNNER_TRACKING_ID` and (b) were still alive when the step was finally cancelled. It is evidence they outlived the step's useful work; it is **not** evidence that cleanup itself caused the 50-minute hang.

### 1.4 Cancellation flow when a job hits `timeout-minutes`

Two layers. `timeout-minutes` is enforced by the **GitHub service**, which then sends a `JobCancelMessage` to the runner; the runner does not locally count the 50 minutes. Docs: [`jobs.<job_id>.timeout-minutes`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes) (default 360 minutes hosted; self-hosted also capped at 5 days as of 2024-04-04 — [GitHub changelog](https://github.blog/changelog/2024-04-04-actions-jobs-executing-on-self-hosted-runners-will-now-timeout-in-5-days/)).

**Layer A — Listener (`JobDispatcher`) receives the cancel:**

[`src/Runner.Listener/JobDispatcher.cs`](https://github.com/actions/runner/blob/main/src/Runner.Listener/JobDispatcher.cs):

1. `Cancel(JobCancelMessage)` logs `Job cancellation request {id} received, cancellation timeout {Timeout.TotalMinutes} minutes.`
2. `WorkerDispatcher.Cancel(timeout)`:
   - Immediately `WorkerCancellationTokenSource.Cancel()` (this is the token `RunAsync` waits on as `jobRequestCancellationToken`).
   - Clamps timeout to **at least 60 seconds**.
   - Schedules `WorkerCancelTimeoutKillTokenSource.CancelAfter(timeout - 15 seconds)` — so the hard-kill of `Runner.Worker` is at `max(timeout, 60s) - 15s` after the cancel message (minimum **45 seconds** of graceful window).
3. `RunAsync`, seeing `jobRequestCancellationToken` fire, sends IPC `MessageType.CancelRequest` to the worker (or `RunnerShutdown` / `OperatingSystemShutdown` if the host is going down).
4. Then `await Task.WhenAny(workerProcessTask, Task.Delay(-1, workerCancelTimeoutKillToken))`. If the worker is still alive when the kill token fires, it cancels `workerProcessCancelTokenSource` with `killProcessOnCancel: true` — i.e. skip SIGINT/SIGTERM and `Kill()` the worker.

**Layer B — Worker cancels the in-flight step via `ProcessInvoker`:**

On Linux, `CancelAndKillProcessTree(killProcessOnCancel: false)` (the default for step processes):

```csharp
private readonly TimeSpan _sigintTimeout = TimeSpan.FromMilliseconds(7500);
private readonly TimeSpan _sigtermTimeout = TimeSpan.FromMilliseconds(2500);
```

Sequence against the **step PID only** (`kill(pid, SIGINT)` / `kill(pid, SIGTERM)` via libc — **not** process-group, **not** cgroup):

| Order | Signal | Wait |
|-------|--------|------|
| 1 | **SIGINT (2)** | 7.5 s |
| 2 | **SIGTERM (15)** | 2.5 s |
| 3 | `KillProcessTree()` → on Linux `_proc.Kill()` = **SIGKILL (9)** on the step PID only | immediate |

Independent empirical confirmation: [ringerc/github-actions-signal-handling-demo](https://github.com/ringerc/github-actions-signal-handling-demo) (README): "github delivers a SIGINT, waits 7.5s, delivers a SIGTERM, waits 2.5s, then presumably sends a SIGKILL. It then runs any `if: always()` steps." Matches the constants exactly. Also [github.com/orgs/community/discussions/26311](https://github.com/orgs/community/discussions/26311) (2020-07-19) "Graceful job termination".

If the step process ignores SIGINT/SIGTERM (common for Bun/Node unless they install handlers and *also* forward to children), the step PID dies only at SIGKILL, 10 seconds after the worker received `CancelRequest`. Grandchildren are **not** signaled by this path on Linux. They survive until orphan cleanup's `Kill()` in FinalizeJob — which is why the incident log can show "Cleaning up orphan processes" terminating several Bun processes *after* the 50-minute cancel.

**End-to-end timeline for this incident's 50-minute `timeout-minutes`:**

1. t=0: step starts, runner redirects its stdout/stderr.
2. t≈5 min: 25/26 subprocesses done; `lint:native-runtime` never prints a completion marker; the **step PID (Bun CLI) is still alive**, so the runner never sees `Exited`.
3. t=50 min: GitHub service sends `JobCancelMessage`.
4. Listener cancels worker token, IPC `CancelRequest`.
5. Worker → step: SIGINT (7.5s) → SIGTERM (2.5s) → SIGKILL the step PID.
6. `if: always()` / post steps (if any), then FinalizeJob: `Cleaning up orphan processes` SIGKILLs anything still carrying `RUNNER_TRACKING_ID` (the lingering Bun children/grandchildren).
7. If the worker itself hasn't exited by `cancelTimeout - 15s`, the listener SIGKILLs `Runner.Worker`.

### Relevance to incident

The 50-minute silence is **not** the runner waiting on EOF after the Bun CLI exited: `ProcessInvoker` caps that wait at 5 seconds. The step process itself never exited. The runner *will* keep a step open indefinitely while that PID lives, because it captures stdout/stderr through pipes the process (and any inheriting grandchildren) can hold. Linux cancellation and orphan cleanup both kill **individual PIDs**, not a cgroup, which is why several Bun processes were still around to be "Terminate orphan process"-ed after timeout. The well-known grandchild-pipe-hold class is the mechanism by which a *finished* lint tool can keep the Bun CLI (and therefore the Actions step) alive; it is not a runner bug unique to this job.

---


---

## 2. Bun child-process semantics and hang classes

**Repo:** [oven-sh/bun](https://github.com/oven-sh/bun) — MIT ([LICENSE.md](https://github.com/oven-sh/bun/blob/main/LICENSE.md)). Docs: [bun.sh/docs/api/spawn](https://bun.sh/docs/api/spawn) (also mirrored at [bun.com/docs/runtime/child-process](https://bun.com/docs/runtime/child-process), last crawled 2026-08-22).

### 2.1 `Bun.spawn` / `Bun.spawnSync` stdio

`Bun.spawn` uses [`posix_spawn(3)`](https://man7.org/linux/man-pages/man3/posix_spawn.3.html). Stdio is configured independently:

| Option | stdin | stdout | stderr |
|--------|-------|--------|--------|
| Default | no input (`null`) | **`"pipe"`** → `ReadableStream` on `proc.stdout` | **`"inherit"`** (so `proc.stderr` is `undefined`) |
| `"pipe"` | `FileSink` for writing | `ReadableStream` | `ReadableStream` |
| `"inherit"` | parent fd | parent fd | parent fd |
| `"ignore"` / `null` | discard | discard | discard |
| `number` / `Bun.file()` | that fd/file | that fd/file | that fd/file |

Docs quote ([Spawn | Bun Docs](https://bun.sh/docs/api/spawn)):

> By default `stdout` is an instance of `ReadableStream`; `stderr` is inherited from the parent process.

So a typical `Bun.spawn(["tsgo", ...])` **pipes stdout** (parent waits on a pipe) and **inherits stderr** (child writes to the same fd the GitHub runner is capturing). Inherited stderr is exactly how a grandchild can hold the **runner's** log pipe open; piped stdout is how the **Bun parent** can hang waiting for EOF.

`Bun.spawnSync` is the blocking counterpart: `stdout`/`stderr` come back as `Buffer`, and the call does not return until the process exits. It is the right primitive for CLI tools; `spawn` is the one that can leave the parent event loop alive.

### 2.2 Awaiting a Bun subprocess: exit vs stream closure are **separate**

Two different waits, documented independently:

```ts
const proc = Bun.spawn(["bun", "--version"]);
await proc.exited;           // Promise<number> — resolves when the process **exits**
const text = await proc.stdout.text();  // ReadableStream — resolves on **EOF**
```

- `proc.exited` / `onExit` = PID death. Docs: "The `exited` property is a `Promise` that resolves when the process exits."
- `proc.stdout.text()` / `getReader().read()` until `done` = the pipe's write end closed.

They are not the same. The official example even does `await proc.stdout.text()` **without** awaiting `exited` first. If a grandchild inherited the stdout pipe, `stdout.text()` never settles even after `exited` has resolved.

**Third, and more important for this incident:** Bun's documented parent-lifetime rule ([same page](https://bun.sh/docs/api/spawn#exit-handling)):

> The parent `bun` process does not terminate until all child processes have exited. Use `proc.unref()` to detach the child process from the parent.

That is a hard keep-alive: any `Bun.spawn` without `unref()` pins the parent event loop until that child PID is gone. Combined with inherited stdio, a daemonized grandchild can pin:

1. the lint subprocess (because it waits on stdout EOF or doesn't unref),
2. the Bun CLI orchestrator (because it doesn't exit until children exit),
3. the Actions step (because the CLI PID never dies — §1.1).

`proc.kill()` / `proc.kill("SIGTERM")` signals **that** subprocess only, not descendants. Linux cancellation of the Actions step likewise signals only the step PID (§1.4).

Linux-only: `cgroup:` option on `Bun.spawn` joins a cgroup before exec so memory/pids/CPU limits apply to the child **and every process it spawns**. Not used by default. Relevant because AL2023 is cgroup v2 (§5) and the runner does not put jobs in a cgroup either.

### 2.3 Known Bun hang classes (with versions)

| Issue | Date | Versions | Status | Class |
|-------|------|----------|--------|-------|
| [oven-sh/bun#1498](https://github.com/oven-sh/bun/issues/1498) | 2022-11-13 | 0.2.3, Linux | Closed | Kill a child **while** `stdout.getReader().read()` is pending and the child has not flushed: `.read()` never resolves, **Bun stays open forever**. Author: "the process is forever open, the call to `.read()` never resolves." Direct stdin/stdout-pipe hang on Linux. |
| [oven-sh/bun#11892](https://github.com/oven-sh/bun/issues/11892) | 2024-06-15 | **1.1.13**, still labeled `bug`/`node:child_process` | **Open** | `spawn()` + `.kill()` of `yarn run dev`. **Works locally, hangs on GitHub Actions** waiting for `stdoutPromise` after the child "exited". Log: `Waiting for stdoutPromise to resolve (hangs on CI)...` then the Actions step times out. Links [#2092](https://github.com/oven-sh/bun/issues/2092) (SIGINT) and #1498. **This is the closest Bun×GHA prior art.** |
| [oven-sh/bun#11297](https://github.com/oven-sh/bun/issues/11297) | 2024-05-23 | 1.1.9 | Closed via #27535 / #11331 | `node:child_process.spawn` + piping a file stream into the child **hangs forever on Bun, completes on Node**. |
| [oven-sh/bun#2092](https://github.com/oven-sh/bun/issues/2092) | (linked from #11892) | | | `process.kill(SIGINT)` not behaving as expected. |
| [oven-sh/bun#8049](https://github.com/oven-sh/bun/issues/8049) | 2024-01-08 | | Open, `bun:spawn` | Piping `Bun.spawn` stdout into another spawn's stdin: `Unsupported ReadableStream type`. |
| [oven-sh/bun#11044](https://github.com/oven-sh/bun/issues/11044) | 2024-05-13 | 1.1.8-canary | Open, `node.js` compat | Extra stdio fds (`stdio: [..., 'pipe']` at index ≥3) don't deliver data. |
| [oven-sh/bun#30831](https://github.com/oven-sh/bun/issues/30831) | 2026-05-15 | 1.3.14-canary, Linux | Open | `child_process.spawn` stdio piping between processes: `TODO: stream.Readable stdio`. |
| [oven-sh/bun#30443](https://github.com/oven-sh/bun/issues/30443) | 2026-05-09 | 1.3.5 vs Node 24.11.1 | | `stdio` array length > 3 eventually `connect ENOENT` after ~15 iterations. |
| [oven-sh/bun#26505](https://github.com/oven-sh/bun/issues/26505) | 2026-01-27 | 1.3.7 | | Piped stdout is a `Readable` not a `Socket`; Nx needs to `unref` the streams for the process to shut down. "you need to unref the streams in addition to the child_process for the process to shut down gracefully." |
| [oven-sh/bun#31653](https://github.com/oven-sh/bun/issues/31653) | 2026-06-01 | 1.3.8, ubuntu-latest | Open | `bun test` hangs on GHA with **zero output past the banner**, child alive, spawn stream stayed open (no EOF) for 120–180s until SIGKILL. Reproduces on CI, not on 8-core macOS workstations. |
| [oven-sh/bun#26810](https://github.com/oven-sh/bun/issues/26810) | 2026-02-08 | 1.3.7/1.3.8 hang; 1.3.6 clean | | Intermittent startup hang on Linux. |
| [oven-sh/bun#15893](https://github.com/oven-sh/bun/issues/15893) | 2024-12-20 | 1.1.36 | Closed | Bun as a child process, stdin/stdout RPC: hangs forever vs Node. |

#11892's smoking-gun log line is the same shape as this incident: child "exited", parent still waiting on a stdout promise, GHA times the step out, local is fine.

#1498 is the mechanism: a pending `read()` on a piped stdout that never EOFs keeps the Bun process alive even after `kill()`.

#26505 is the unref-the-streams variant of the same class, reported from Nx plugin workers — a lint/build-tool worker that holds the parent open.

### Relevance to incident

If `lint:native-runtime` is launched via `Bun.spawn` (or Bun's `node:child_process`) with default/piped stdout, and that tool (tsgo, eslint+projectService, tsserver-shaped worker) either (a) doesn't exit or (b) exits but leaves a grandchild holding the pipe, the orchestrator Bun process **will not exit**. Official docs say so (`unref` required; `exited` ≠ stream EOF). #11892 shows this exact "works locally, hangs on GHA waiting for stdout" failure, still open as of 1.1.13 and not contradicted by later spawn bugs. Multiple Bun PIDs at orphan cleanup are what you get when the parent never unref'd its children. Local 10s is explained by TTY/inherit stdio: no pipe to hold, and often no leftover daemon because the interactive session's process group dies with the terminal.

---

## 3. Node.js prior art: stdio-close vs exit, detached+unref, execa

**Repos:** [nodejs/node](https://github.com/nodejs/node) MIT; [sindresorhus/execa](https://github.com/sindresorhus/execa) MIT.

### 3.1 `child_process.exec` waits for **stdio close**, not just exit

Canonical Node docs ([nodejs.org child_process, v26.7.0](https://nodejs.org/api/child_process.html)):

**Event `'close'`** ([#event-close](https://nodejs.org/api/child_process.html#event-close)): emitted after the process has ended **and the stdio streams have been closed**. Distinct from `'exit'` "since multiple processes might share the same stdio streams."

**Event `'exit'`** ([#event-exit](https://nodejs.org/api/child_process.html#event-exit)): emitted after the child process ends. Docs warn that **stdio streams might still be open** when `'exit'` fires.

The documented spawn example waits on `'close'`, not `'exit'`.

Implementation, not just docs: `exec()` is a thin wrapper over `execFile()` ([`lib/child_process.js`](https://github.com/nodejs/node/blob/main/lib/child_process.js) on `main`, fetched 2026-08-23). `execFile` registers:

```js
child.addListener('close', exithandler);
child.addListener('error', errorhandler);
```

The user callback (and therefore `util.promisify(exec)` / `await exec(...)`) runs on **`'close'`**. A grandchild that inherited stdout/stderr prevents `'close'`, so `exec` never invokes the callback, even if the direct child has already exited with code 0.

Pipes are the default (`stdio: ['pipe','pipe','pipe']`). If the child writes faster than the parent reads, the child **blocks** on a full pipe — another hang class, distinct from EOF-hold but sharing the same non-TTY CI environment.

### 3.2 Canonical mitigation: `detached` + `unref` + `stdio: 'ignore'`

From [`options.detached`](https://nodejs.org/api/child_process.html#optionsdetached) (added v0.7.10):

> On non-Windows platforms, if `options.detached` is set to `true`, the child process will be made the leader of a new process group and session.

> By default, the parent will wait for the detached child process to exit. To prevent the parent process from waiting … use `subprocess.unref()`.

> When using the `detached` option to start a long-running process, the process will not stay running in the background after the parent exits unless it is provided with a `stdio` configuration that is not connected to the parent. If the parent process' stdio is inherited, the child process will remain attached to the controlling terminal.

The documented daemon spawn:

```js
const subprocess = spawn(process.argv[0], ['child_program.js'], {
  detached: true,
  stdio: 'ignore',
});
subprocess.unref();
```

All three are required. Missing `stdio: 'ignore'` is how CI hangs: the daemon inherits the pipe, `'close'` never fires, `exec`/the parent never finishes. This is the same paragraph of advice as the Actions "redirect background job output to a file" folklore in §1.2.

### 3.3 How execa handles the "child exited, pipes still open" case

[execa `docs/termination.md`](https://github.com/sindresorhus/execa/blob/main/docs/termination.md) and [API](https://github.com/sindresorhus/execa/blob/main/docs/api.md) (current main):

| Option | Default | Behavior |
|--------|---------|----------|
| `cleanup` | `true` | Kill the subprocess when the **current** process exits, unless it is `detached`. Does **not** run if the parent was SIGKILLed (Actions' last step on Linux). |
| `forceKillAfterDelay` (née `forceKillAfterTimeout`) | `5000` ms | After SIGTERM (timeout, `cancelSignal`, `subprocess.kill()`), send **SIGKILL** if still alive. `error.isForcefullyTerminated` flags this. Disable with `false`. |
| `killSignal` | `'SIGTERM'` | First signal. |
| `timeout` | `0` (off) | SIGTERM after N ms. |
| `killDescendants` | (documented in termination.md) | Default: **only the subprocess**, not what it spawned. "For example, terminating a subprocess started with the `shell` option only terminates the shell, not the command it is running." Set `killDescendants` to kill the tree. Applies to `kill()`, `cancelSignal`, `timeout`, `maxBuffer`, `cleanup`, and the force-kill escalation. |
| `detached` + `stdio: 'ignore'` + `unref()` | opt-in | Same Node daemon pattern; [execa#115](https://github.com/sindresorhus/execa/issues/115) (2017-11-21) is the canonical "unref is not enough" bug. |

execa does **not** magically resolve `'close'` when a grandchild holds the pipe. It papers over the resulting stuck PID with: (1) `timeout` so the wait is bounded, (2) SIGTERM→5s→SIGKILL so a process that swallowed SIGTERM still dies, (3) optional `killDescendants` so the grandchild holding the pipe is actually signaled. A CLI that `await execa(...)` **without a timeout** has the same unbounded hang as raw `exec`.

[execa#597](https://github.com/sindresorhus/execa/issues/597) (2023-12-14, closed by #601): `cleanup: true` + SIGTERM is racy — parent may exit before the child has actually died, because `beforeExit` handlers cannot be async. That is the inverse of this incident (parent died, child lingered) and matches what Actions orphan cleanup is for.

### Relevance to incident

The Node/`exec` close-vs-exit contract is the platonic form of this hang: 25/26 children `'close'`d; one child's PID may even have exited while a tsgo/tsserver/eslint-worker grandchild still holds stdout, so the Bun orchestrator's wait never finishes. Locally a TTY/`inherit` stdio means there is no pipe and no `'close'` to miss. execa's lesson for the orchestrator is concrete: bound every spawn with `timeout` + `forceKillAfterDelay` + `killDescendants` (or `stdio: 'ignore'` + `unref` for anything allowed to outlive the step). The Actions runner already does the first two at *step* granularity (SIGINT 7.5s / SIGTERM 2.5s / SIGKILL) but **not** at the grandchild granularity execa now exposes as `killDescendants`.

---

## 4. Lint-toolchain daemons/workers that outlive their parent

### 4.1 typescript-eslint `projectService` / tsserver

[typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) MIT. `parserOptions.projectService: true` instantiates TypeScript's `ts.server.ProjectService` **in-process** via `require('typescript/lib/tsserverlibrary')` — see [`packages/project-service/src/createProjectService.ts`](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/project-service/src/createProjectService.ts). It is not a separate `tsserver` binary by default, but it **is** the tsserver host: watch-shaped `ServerHost`, plugins, inferred projects. Anything a TS plugin starts (file watchers, extra Node processes, schema loaders) lives in that process.

**Documented "lint process does not exit":** [typescript-eslint#9905](https://github.com/typescript-eslint/typescript-eslint/issues/9905) (2024-08-29, closed by [#9964](https://github.com/typescript-eslint/typescript-eslint/pull/9964)). With `projectService: true` and the `gql-tada` TS plugin loading a **local file** schema, **"the lint process does not exit when done."** Same config with `project: true` (no projectService) exits. URL schema: exits. Versions: `@typescript-eslint/*` 8.3.0, TypeScript 5.5.4, ESLint 8.57.0, Node 20.10.0. Root cause class: projectService loads `tsconfig` plugins; a plugin keeps handles/watchers alive; the ESLint CLI never reaches process exit.

Related CI-only behavior: [PR #11327](https://github.com/typescript-eslint/typescript-eslint/pull/11327) discussion (2025-07-15): a typescript-estree test failure **"has nothing to do with caching, it is all to do with whether `CI=true` is set"** (`singleRun` inference). GitHub Actions sets `CI=true` (§1 ProcessInvoker). Locally `CI` is often unset, so projectService takes a different path.

tsserver itself historically does not die with its parent: [microsoft/TypeScript#51100](https://github.com/microsoft/TypeScript/issues/51100) (2022-10-07, Bug, "Fix Available", Backlog) — "tsserver doesn't shut itself down when the parent process is killed."

Performance docs warn that `projectService` plus changing `extraFileExtensions` forces a **full tsserver project reload** ([typed-linting performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/)).

### 4.2 ESLint worker threads (`--concurrency`)

ESLint 9.34.0+ (merged [eslint/eslint#19794](https://github.com/eslint/eslint/pull/19794), 2025) can lint on `node:worker_threads` (`Worker` + `SHARE_ENV`). `--concurrency=off|auto|N`, default **off**. Workers are threads, not processes, so they do **not** independently hold the Actions stdout pipe after the main ESLint process exits — when the main process dies, threads die.

They **do** multiply memory (OOM reports on large typescript-eslint + eslint-plugin-import codebases, [discussion #20040](https://github.com/eslint/eslint/discussions/20040)) and they share the process: if projectService/a plugin keeps the main event loop alive (§4.1), workers don't change that. Not a strong match for "multiple Bun processes" at cleanup — threads wouldn't show up as extra PIDs. Extra **Bun/node PIDs** imply spawned processes, not worker threads.

### 4.3 Turbo daemon

[turbo.json `daemon`](https://turborepo.dev/docs/reference/configuration) (docs current as of this research):

> **Deprecated**: The daemon is no longer used for `turbo run` and this option will be removed in version 3.0. The `--daemon` and `--no-daemon` flags are also deprecated.
>
> The daemon is still used by `turbo watch` and the Turborepo LSP.

Historical (when daemon *did* auto-start on `turbo` invocation):

- [vercel/turborepo#3455](https://github.com/vercel/turborepo/issues/3455) (2023-01-24): daemon "starts as a side effect of simply running turbo from the command line and never [stops]."
- [vercel/turborepo#5971](https://github.com/vercel/turborepo/issues/5971) (2023-09-16): "every time turbo runs a command, it tries to start the daemon."
- [vercel/turborepo#9455](https://github.com/vercel/turborepo/issues/9455) (2024-11-18): daemon leaves `<defunct>` processes, can breach the OS process limit.
- [vercel/turborepo#9694](https://github.com/vercel/turborepo/issues/9694) (2025-01-13): SIGINT to turbo is not forwarded to tasks; maintainer: "That is our daemon which is expected to continue running after the primary turbo exits."

Disable (older turbo): `turbo --no-daemon`, `turbo.json` `"daemon": false`, or env historically used in CI write-ups. On current turbo, `turbo run` should not autostart it; `turbo watch` / LSP still do. A `lint:native-runtime` script that is a direct `tsgo`/`eslint` spawn rather than `turbo run` would not hit this. A monorepo that still shells out to `turbo` for the lane might, on older turbo.

### 4.4 tsgo / typescript-go

[microsoft/typescript-go](https://github.com/microsoft/typescript-go) Apache-2.0. Native Go port of `tsc` (`tsgo`). The incident step name `lint:native-runtime` is a strong pointer at this binary (or a wrapper around it).

Public tracker search for "tsgo LSP daemon CI hang leftover process" did not surface a canonical "tsgo leaves a background process that holds CI open" issue as of this research. tsgo does ship an LSP mode; a one-shot `tsgo` compile/typecheck should be a single process that exits. Residual risk is the same as any native compiler: if invoked in watch/LSP mode, or if it `posix_spawn`s helpers that inherit stdio, it participates in §2/§3. Treat as a **candidate occupant of the stuck step**, not a documented hang class of its own.

### 4.5 git credential / askpass in headless CI

Git's prompt chain ([gitcredentials](https://git-scm.com/docs/gitcredentials)): `GIT_ASKPASS` → `core.askPass` → `SSH_ASKPASS` → terminal. `git_terminal_prompt()` **finds the terminal from the environment and ignores whether stdin has been redirected** ([git/git@719399b](https://github.com/git/git/commit/719399b57b3db8471852d86f96ab5db4a40d43ba) introducing `credential.interactive=false`, specifically because askpass/`echo` still fell through to a blocking TTY prompt).

Standard CI mitigations:

- `GIT_TERMINAL_PROMPT=0` — [SO 64319349](https://stackoverflow.com/questions/64319349/force-git-to-fail-when-password-required-instead-of-prompting-for-password) (2020-10-12): clone fails immediately with `terminal prompts disabled` instead of hanging on `Username for`.
- `GIT_ASKPASS=true` (or `echo`) — same thread; still not always enough without `credential.interactive=false` (Git 2.46+, see that commit).
- `GIT_SSH_COMMAND='ssh -o BatchMode=yes'` — SSH passphrase prompts are a separate hang ([fastlane#30078](https://github.com/fastlane/fastlane/pull/30078)).
- Agent wrappers inject `GIT_TERMINAL_PROMPT`, `GIT_ASKPASS`, `GH_PROMPT_DISABLED`, `DISPLAY=` to fail fast rather than block 5 minutes ([google-gemini/gemini-cli#20893](https://github.com/google-gemini/gemini-cli/pull/20893)).

GHA-specific stdin trap: [actions/runner-images#10959](https://github.com/actions/runner-images/issues/10959) (2024-11-13, closed): programs see an **empty FIFO on stdin** (`is_fifo=true`), so tools with "read stdin if it's a pipe" heuristics (ripgrep, and anything similar) wait on stdin instead of using argv files. The runner's ProcessInvoker *does* close the step's stdin write end immediately (§1.1), so the step itself should see EOF; a grandchild that inherited stdin before that close, or that reopened `/dev/tty`, can still block.

### Relevance to incident

Best toolchain occupant for a **single** silent `lint:native-runtime` among 26: a native/type-aware lint that uses projectService or a TS plugin (#9905: process does not exit) or a tsgo/eslint child that inherited pipes. Turbo daemon is a weaker match on current turbo (`turbo run` no longer starts it) unless this repo is on an older turbo or invokes `turbo watch`/LSP. Git askpass would typically hang an early checkout/fetch, not a late lint step after 25 others succeeded — unless `lint:native-runtime` itself shells out to git (blame, ls-files, commit-hash). ESLint worker threads don't explain extra Bun PIDs.

---

## 5. GitHub Actions self-hosted runner / github-aws-runners / AL2023

**Repo:** [github-aws-runners/terraform-aws-github-runner](https://github.com/github-aws-runners/terraform-aws-github-runner) MIT. Incident version **v7.10.1**. Latest at research time: [v7.11.0](https://github.com/github-aws-runners/terraform-aws-github-runner/releases) (2026-08-14).

### 5.1 Ephemeral one-job-one-VM

Official ephemeral docs: [github-aws-runners.github.io …/examples/ephemeral](https://github-aws-runners.github.io/terraform-aws-github-runner/examples/ephemeral/) and [configuration](https://github-aws-runners.github.io/terraform-aws-github-runner/configuration/).

- `enable_ephemeral_runners = true` → runner binary `--ephemeral` → **one job, then the agent exits**; userdata/shutdown hooks terminate the EC2 instance.
- Requires `workflow_job` webhooks + JIT config (`enable_jit_config` defaults on for ephemeral).
- Scale-down lambda is still active and "should only remove orphan instances," with `minimum_running_time_in_minutes` sized so a booting runner is not killed before it connects.
- Job retry (optional): after launch, a delayed check (default **300 s**) re-queues if the GitHub job is still `queued`. This is about **jobs that never started**, not jobs that started and hung.
- Documented failure: "We have no mechanism to avoid events never being processed, which means potentially no runner gets created and the job in GitHub times out in 6 hours." Inverse of this incident (runner *did* run the job).
- Troubleshooting "Runners not terminating after job completion": check `enable_ephemeral_runners` and SSM `runner_agent_mode=ephemeral`. That is **post-job** leak of the VM, not a 50-minute silent *step*.

No primary-source issue was found of the form "ephemeral AL2023 runner: work finished, job hung until timeout, then orphan Bun processes" specific to this Terraform module. The hang is inside `actions/runner` on that VM (§1). Ephemeral mode does mean: (a) leftover processes cannot poison the *next* job (the VM dies), (b) they *can* keep **this** job's runner process alive until GitHub cancels, which keeps the instance billable for the full `timeout-minutes`.

### 5.2 Runner service shutdown / TTL vs job hang

Official runner systemd unit ([`src/Misc/layoutbin/actions.runner.service.template`](https://github.com/actions/runner/blob/main/src/Misc/layoutbin/actions.runner.service.template)):

```
[Service]
ExecStart={{RunnerRoot}}/runsvc.sh
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=5min
```

**`KillMode=process`** — systemd sends the kill signal **only to the main PID**, not to the control group ([systemd.kill](https://www.freedesktop.org/software/systemd/man/latest/systemd.kill.html)). Default systemd `KillMode` is `control-group`. The Actions project explicitly chose the weaker mode. Combined with `TimeoutStopSec=5min`, a `systemctl stop` of the runner service waits up to 5 minutes for the main process, then SIGKILLs **that PID only**. Grandchildren (Bun, tsserver, tsgo) are not in the stop set.

Ephemeral AWS userdata often starts the runner as a one-shot script rather than this unit, but the same design shows up in the stock template: **the runner does not rely on systemd/cgroup to reap job children.** Reaping is `RUNNER_TRACKING_ID` + `Process.Kill()` (§1.3), after the job is already cancelled.

GitHub-side TTL: hosted default 360 minutes; self-hosted jobs capped at **5 days** as of 2024-04-04 ([changelog](https://github.blog/changelog/2024-04-04-actions-jobs-executing-on-self-hosted-runners-will-now-timeout-in-5-days/)). The incident's 50-minute bound is the workflow's `timeout-minutes`, not a runner/AWS TTL.

### 5.3 Amazon Linux 2023, cgroup v2, pipe inheritance

AL2023 uses **cgroup v2 only** ([AWS AL2023 cgroup v2](https://docs.aws.amazon.com/linux/al2023/ug/cgroupv2.html)). That would be the right primitive to kill a job tree (`echo 1 > cgroup.kill` on the job cgroup). The runner does not create a per-job cgroup. [actions/runner#4601](https://github.com/actions/runner/issues/4601) (2026-08-03) explicitly proposes "Scope the job to a cgroup on Linux and kill the cgroup" as fix #3 for missed orphans — i.e. it is **not implemented**.

cgroup v2 does **not** change POSIX pipe inheritance. `posix_spawn` / `fork`+`exec` still duplicate stdout/stderr into children unless the child dups `/dev/null` over them. AL2023 is not a special hang trigger; it is a host that *could* isolate and doesn't.

SELinux: the runner's systemd install script (`systemd.svc.sh.template`) calls `restorecon` on Fedora-like systems when `getenforce == Enforcing`. AL2023 can run enforcing SELinux; that has not been documented as causing this hang class.

Related GHA-on-Linux stdin: [runner-images#10959](https://github.com/actions/runner-images/issues/10959) FIFO-on-stdin (hosted Ubuntu). Self-hosted AL2023 with ProcessInvoker-closed stdin should EOF immediately for the step PID; still a footgun for tools that reopen tty or inherit before close.

### Relevance to incident

github-aws-runners v7.10.1 ephemeral + AL2023 explains **why leftover Buns are visible at "Cleaning up orphan processes"** (no cgroup kill, `KillMode=process`, env-var snapshot cleanup, then VM recycle) and **why a hung step costs a full `timeout-minutes` of an EC2 box**. It does not explain why `lint:native-runtime` failed to exit — that is §§1–4. No module-level bug was found that would hang a finished job independently of the Actions worker.

---

## 6. Ranking: documented failure classes vs this incident

Incident shape to match: 25/26 lint/policy subprocesses completed in ~5 minutes; **one** (`lint:native-runtime`) never printed a completion marker; **step silent until 50-minute `timeout-minutes`**; runner then `Cleaning up orphan processes` and **SIGKILLed several still-alive Bun PIDs**; same command **~10 s locally**.

| Rank | Failure class | Fit | Why |
|------|---------------|-----|-----|
| **1** | **Grandchild inherited piped stdio + waiter waits on `'close'` / stream EOF / unref'd child** (Node `exec` `'close'`, Bun `stdout.text()` / parent-waits-for-children, Actions redirected pipes) | **Best** | Explains *one* stuck step, silence (no more writes), leftover Bun PIDs, and local-vs-CI (TTY/inherit vs pipes). Canonical sources: Node `'close'` vs `'exit'` docs + `execFile` `addListener('close')`; Bun docs "parent does not terminate until all child processes have exited"; [bun#11892](https://github.com/oven-sh/bun/issues/11892) *literally* "works locally, hangs on GHA waiting for stdoutPromise"; [bun#1498](https://github.com/oven-sh/bun/issues/1498) pending `read()` after kill never EOFs; [runner ProcessInvoker](https://github.com/actions/runner/blob/main/src/Runner.Sdk/ProcessInvoker.cs) redirects stdout/stderr for the whole step. Occupant of the stuck spawn is most likely `lint:native-runtime`'s tool (tsgo / eslint+projectService / a wrapper) leaving a child that holds the pipe. |
| **2** | **Bun parent keep-alive without `proc.unref()`** | **Very strong (mechanism under #1)** | Even if the child's PID is alive as a daemon (tsserver-shaped, turbo LSP, plugin worker), Bun will not exit. Matches multiple Bun processes at cleanup. Docs-mandated, not a bug. |
| **3** | **Bun×GHA spawn/kill/stdout bugs (#11892, #1498, #31653)** | **Strong** | Same environment split (CI hang, local fine). #11892 still open. #31653 (2026-06, Bun 1.3.8) is another "child alive, stream never EOF, zero output, GHA only." Does not require a lint-toolchain daemon — Bun itself can strand the wait. |
| **4** | **typescript-eslint `projectService` / TS plugin keeps the lint process alive (#9905)** | **Strong occupant of the stuck 1/26** | Documented "lint process does not exit when done" with `projectService: true` + a file-watching/schema plugin. `CI=true` changes `singleRun` (#11327). Does not by itself explain *Bun* PIDs unless ESLint is launched by Bun (it is, in this incident). |
| **5** | **Actions Linux cancellation does not kill the tree** (SIGINT/SIGTERM/SIGKILL on **step PID only**; orphan cleanup is a later SIGKILL of tagged PIDs; systemd `KillMode=process`) | **Strong for the cleanup log, not for the 45 min of silence** | Explains why Bun processes were still there to terminate *after* timeout. The silence *during* the 50 minutes is the step PID not exiting (§1.1: runner's EOF-after-exit wait is only 5 s). |
| **6** | **Non-TTY / FIFO stdin vs local TTY** ([runner-images#10959](https://github.com/actions/runner-images/issues/10959), git `git_terminal_prompt` ignoring redirected stdin) | **Partial** | Excellent explanation of local 10 s vs CI hang *in general*. Weaker for *this* job: 25/26 siblings finished under the same stdin/TTY conditions, so the trigger is something special to `lint:native-runtime`, not a global FIFO. |
| **7** | **Turbo daemon autostart** | **Weak on current turbo** | Daemon no longer used for `turbo run` (deprecated, removed in 3.0). Still used for `turbo watch` / LSP. Would need evidence this lane invokes those. Older turbo (#3455, #5971, #9694) would rank higher. |
| **8** | **ESLint `--concurrency` worker threads** | **Weak** | Threads, not processes — would not show up as extra Bun PIDs. Default `off`. |
| **9** | **git askpass / credential prompt** | **Weak for this shape** | Classic unbounded CI hang, but it usually bites clone/fetch, not a late lint after 25 successes, unless that step shells out to git without `GIT_TERMINAL_PROMPT=0`. |
| **10** | **github-aws-runners / ephemeral TTL / AL2023 cgroup v2 as the hang *cause*** | **Does not fit as cause** | Ephemeral + AL2023 explain isolation *failure* (no cgroup.kill, `KillMode=process`, snapshot cleanup races #4601) and cost of a hung job (instance lives until GitHub cancel). They do not generate a silent step. Scale-down / job-retry are about queued jobs, not in-flight ones. |
| **11** | **Runner waiting on stdout EOF after the step PID already exited** | **Ruled out for the 50 min hang** | ProcessInvoker caps that at **5 seconds** after `Exited`, then completes anyway. A 45-minute silence means the **step PID (Bun CLI) was still alive**. |

**Working hypothesis (external evidence only):** `lint:native-runtime` spawned a child (tsgo and/or eslint with projectService) under Bun with piped/inherited stdio. That child or a grandchild kept a pipe or the Bun keep-alive set occupied. The orchestrator never saw completion, so it never printed the marker; the Actions step PID never exited; GitHub cancelled at 50 minutes; SIGINT/SIGTERM to the step PID were ignored or didn't reach descendants; SIGKILL killed the step; FinalizeJob's `RUNNER_TRACKING_ID` sweep SIGKILLed the remaining Bun processes. Locally, TTY stdio + process-group teardown on shell exit make the same graph finish in seconds.

**Highest-leverage confirmations (not done here; this is external research):** on a hung runner before timeout, `ls -l /proc/<bun>/fd` for inherited `pipe:[…]` matching `Runner.Worker`; `tr '\\0' '\\n' < /proc/<pid>/environ | grep RUNNER_TRACKING_ID`; whether `lint:native-runtime` uses `Bun.spawn` without `unref`/`stdio: "ignore"` and without a timeout; `projectService` / TS plugins in that package; turbo version and whether the lane calls `turbo run` vs raw tsgo. Mitigation pattern that the cited sources agree on: **timeout every spawn, `killDescendants` or a cgroup, `stdio` not inherited for anything that may daemonize, `proc.unref()` only for processes that are allowed to outlive the step, `GIT_TERMINAL_PROMPT=0`.**

