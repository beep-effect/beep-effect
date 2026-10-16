# Longer bounded worker cheap-gate proof — 2026-10-14

Created a clean disposable worktree at ad60586d52, installed the frozen lockfile,
and submitted real cheap gates with --base HEAD and a ten-minute runtime ceiling.
Job e37b3d3c-c737-43f0-9171-36cc5bc79217 ran after the submitter exited.
The workload retained the 7 GiB soft / 8 GiB hard / 256 MiB swap, two-CPU shared
worker slice; observations used the separate control slice. SSH_AUTH_SOCK was
absent in the proof runner. No PR or publication occurred.

Early checks passed, including policy fingerprint, changeset status, atlas,
goal index and Markdown import governance. Import-law and schema-first scans
then overlapped under the hard-coded four-lane cheap-gate policy. Their live
processes were blocked in mem_cgroup_handle_over_high; slice memory pressure
approached 97 percent some / 96 percent full. Memory rose toward the 8 GiB hard
ceiling while gate completion stopped. This is resource contention evidence,
not evidence of source violations or a successful complete verdict.

The source policy describes these gates as sub-second operations; the observed
repository-wide scans no longer fit that assumption on this four-core worker.
A host-aware or explicitly selected lower cheap-gate lane width is the next
bounded remediation candidate. Keep hard resource limits in force.

The runtime deadline stopped the main runner. Systemd reported timeout and a
peak of 8,402,550,784 bytes (about 7.83 GiB). The finalizer timed out too, but
88 tasks remained in the failed unit, blocked in the soft-throttle path.
Recovery correctly refused to race those remaining tasks. Temporarily raising
only MemoryHigh to the unchanged 8 GiB hard ceiling released cleanup; immediately
restored MemoryHigh=7 GiB. No hard ceiling or persistent configuration changed.

Both independent waits returned 3 after cleanup. The unit had been collected,
so the durable result is terminated/finalizer-missing with unknown service
result and no outcome. Do not rewrite that conservative record to timeout:
the separately observed timeout and durable missing-finalizer cause are distinct.
No job record was manually edited or reset-failed used. The recovered state
was published and acknowledged normally. This qualifies actual recovery under
pressure but still does not supply a complete green cheap-gate verdict.

[Sanitized receipt](../research/2026-10-14-long-cheap-gates.json) records this
boundary. Raw logs, attempts, inbox/ack records and Turbo summaries were archived
on the worker in ~/.cache/beep/yeet-long-proof/evidence.tgz, verified against
source with tar comparison and SHA-256 before removing the owned clean worktree.
Available memory recovered to about 10 GiB. No other checkout or service changed.
