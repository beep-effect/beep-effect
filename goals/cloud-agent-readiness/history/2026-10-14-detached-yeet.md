# Detached Yeet execution — 2026-10-14

## Scope and result

Actual detached Yeet execution is demonstrated on beep-worker: submission from
a user-owned scope, survival after the submitter exits, a live transient user
service, bounded resource limits, terminal result publication, job wait exit
semantics and cleanup. The ordinary error path finishes normally. The first
cheap-gates run terminates cleanly at its runtime ceiling. A stressed rerun
exposed finalizer starvation and a stale-running-record recovery gap.

This is **not a green cheap-gates verdict**, full heavy proof, hosted CI,
publish/merge qualification or reboot persistence. No PR was opened, changed
or published. The goal remains in progress.

## Isolated source and launch route

Created clean branch chore/worker-yeet-smoke at 4199d132f6 in the sibling
beep-effect-worktrees/yeet-readiness-smoke directory. Installed its frozen
lockfile independently (2647 packages, 6.59 seconds). Preserved the existing
readiness worktree's Graft configuration edits.

A plain SSH CLI submission refused before creating a job, despite a reachable
user bus. RunScope.detectRunScopeSupport asks the user manager for GetUnitByPID
of the submitting CLI. SSH's process belongs to the system SSH session, so
that ownership lookup fails. Retried from a transient user scope; no fallback
or detector override was used. The installed [worker wrapper](../ops/beep-worker-yeet.sh),
mode 0755 at ~/.local/bin/beep-worker-yeet, preserves this supported route,
derives the user bus, selects nvm's configured default, resolves the current
checkout's CLI, and removes SSH_AUTH_SOCK. It refuses without the installed
slice or checkout CLI.

Example from a selected worker checkout:

```bash
beep-worker-yeet verify --tier cheap-gates --detach --job-max-runtime '3 minutes' --json
beep-worker-yeet job wait <job-id> --timeout '30 seconds'
beep-worker-yeet job status <job-id> --json
```

Both proof runs used --base HEAD because this disposable branch has no new
source diff. They still executed real repo-wide cheap gates. This does not
qualify the readiness branch's diff against current origin/main. The first
run's base refresh fetched the shallow clone's missing history; the rerun had
that preparation available. No origin URL or authentication configuration was
changed.

## Persistent worker guards

The stock workstation slice has a 48 GiB soft / 60 GiB hard budget, unsuitable
for this worker. Installed the [worker-specific slice](../ops/agent-runs-worker.slice)
at ~/.config/systemd/user/agent-runs.slice, mode 0644. Its final budget is:

| Control | Value |
| --- | --- |
| MemoryHigh | 7 GiB |
| MemoryMax | 8 GiB |
| MemorySwapMax | 256 MiB |
| CPUQuota | 200%, shared across the slice |
| TasksMax | 512 |

Initial MemoryHigh was 6 GiB. The stressed rerun reached ~6.4 GiB combined with
its waiter/finalizer. Kernel memory pressure exceeded 90%, and process wchan
identified __mem_cgroup_handle_over_high; I/O pressure was near zero. Raising
only the soft threshold to 7 GiB released the stalled cleanup. The 8 GiB hard
ceiling stayed in force. Updated both the runtime property and persistent
source; future heavy proofs and concurrency remain unqualified.

The user manager already had an SSH agent in its environment. Merely unsetting
it in the submitter would not remove that inherited service environment.
Installed [proof-service drop-in](../ops/beep-proof-worker-environment.conf)
as ~/.config/systemd/user/beep-proof-.service.d/20-worker-environment.conf,
mode 0644, with UnsetEnvironment=SSH_AUTH_SOCK. A harmless matching service
probe and the live Yeet runner's /proc environment both confirmed no agent.
The manager's desktop environment was not globally changed.

Live systemd and kernel evidence confirmed the intended slice, RuntimeMax=3min,
MemoryMax=8589934592, swap=268435456, cpu.max=200000/100000 and pids.max=512.
The recorded submitter was gone while the proof runner remained active. Service
KillMode was control-group and stop timeout one minute. These limits constrain
only this shared worker slice, not every desktop/agent process.

## Real job outcomes

| Job | Workload | Outcome |
| --- | --- | --- |
| 2224ea7b-f347-45e0-9bc6-57795feb06b6 | Real cheap-gates, three-minute ceiling | terminated / timeout; ExecStopPost finalized and published the result; job wait returned 3. Four gate summaries passed before interruption. |
| cbc6b437-9395-4283-8d6a-74214d33802f | Bounded warm rerun of real cheap-gates | Main process stopped at the ceiling, but memory-high pressure starved finalization. After pressure relief, unit was failed/timeout and empty while its durable record still said running. Recovered as terminated / finalizer-missing; wait returned 3. Five gate summaries passed; no complete verdict. |
| 72ae2c71-9cd1-46ff-9524-aa9bb062dc01 | Detached until-ready monitor on deliberately unpublished branch, one-minute ceiling | finished / failure in ~8 seconds: requires an open PR. Normal finalization/publication succeeded; wait returned 1. No PR was created to turn this into a green monitor. |

A waiter's own timeout returned 1 while leaving its job active; that was not
misclassified as job completion. Settled waits acknowledge only their own job
observation rows. Logs, inbox rows and attempt receipts were preserved.

### Finalizer recovery boundary

The second job's main process was gone and systemd reported failed/timeout with
zero main/control PIDs and an empty cgroup. The finalizer had not published a
result. Existing readLocked recovery checks only LoadState=not-found, so a
loaded failed unit leaves that dead job recorded running. After preserving
unit evidence, reset-failed was applied **only to this owned, already-empty
unit**. Collection allowed the canonical job wait/read path to observe the
missing unit and dead runner, publish finalizer-missing and acknowledge it.
No job JSON was hand-edited, success fabricated, live process broadly killed,
or unrelated failed unit reset.

Add a bounded, source-tested recovery path for loaded failed/inactive units
whose main/control processes are gone, preserving observed systemd results.
Finalization must also remain runnable under a proof's resource pressure.
Increasing the soft threshold restores this host's cleanup; it does not prove
that either general recovery problem is fixed.

## Evidence and cleanup

[Sanitized evidence](../research/2026-10-14-detached-yeet.json) contains terminal
records and live unit/kernel metadata. Raw job logs, inbox/ack receipts,
attempt journals and Turbo run summaries were copied into
~/.cache/beep/yeet-qualification/archive on the worker and verified file-by-file
with SHA-256 before cleanup. Private install/submission/wait logs remain beside
that archive. No raw credentials were emitted or committed.

Confirmed no test worktree process holders and a clean tracked/untracked tree.
Removed only the owned disposable worktree and deleted its branch with git -d
from the retaining readiness checkout; no force removal/deletion was needed.
All test proof services and wrapper scopes are gone. Worker memory recovered
to ~10 GiB available. The persistent slice, environment drop-in and launcher
remain installed. There are no new recurring timers.

Rollback requires no root access. First verify no owner uses the worker proof
slice; preserve these three managed assets, then remove only the worker wrapper,
proof-service drop-in and worker slice and reload the user manager. Reconcile
any runtime slice property override at the same time. Do not remove the shared
slice or reset another owner's unit while a proof is active.

Remaining acceptance: normal green cheap-gates/full proof with an appropriate
worker budget; cancellation/reboot recovery; pressure-safe finalization and
loaded-failed-unit reconciliation; direct SSH support versus an explicitly
required user-scope launch route. These are recorded as goal additions.
