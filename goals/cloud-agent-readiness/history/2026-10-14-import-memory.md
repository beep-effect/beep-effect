# Bounded import-law scan — 2026-10-14

The worker's serial cheap-gate run isolated import-law memory growth. The scanner
loaded every discovered source tree into one ts-morph project and retained all
of its descendant wrapper caches through the complete scan. The CLI uses an
explicit Effect mapping and syntax checks, so this executable corpus does not
need a repository-wide semantic program.

At 76dd934bb2, discovery still covers the same corpus and exclusions. The scan
loads, checks, optionally saves and forgets each source tree before loading the
next. File order is deterministic. Non-CLI foundation mapping callers retain
semantic export resolution in a separate project seeded only with foundation
sources; this phase is not covered by the CLI's worker memory result. Markdown
and JSDoc enforcement, rewrite decisions, manual reviews and strict exit behavior
remain covered by the existing test matrix.

All 32 import-law tests pass, including a new 80-file dry-run/write/recheck
regression proving coverage and persistence after source release. Package quick
lint and type checks and commit hooks pass.

## Actual worker check

A clean owned worktree installed the frozen lockfile. The full CLI check ran
under agent-runs.slice with a three-minute deadline and the existing 7 GiB soft,
8 GiB hard, 256 MiB swap and two-CPU shared limits. The first measurement used
a nonexistent Bun path and exited 127 before scanning; corrected to the actual
~/.local/bin/bun and reran. Only the corrected run is successful evidence.

The full check exited 0 in 92.03 seconds: 8,079 source files, 27,822 fences,
zero touched files, rewrites, manual reviews and parser warnings. The service
reported a 1008.2M peak and zero swap; /usr/bin/time reported max RSS 1,092,008 KiB
(a separate metric). This fixes the prior full-scan memory blocker without
raising resource limits or reducing the enforced corpus.

[Sanitized measurement](../research/2026-10-14-import-memory.json) retains the
summary. A subsequent detached cheap-gate rerun uses this same source and the
one-lane worker launcher. Import-law passed inside Yeet in 97.49 seconds with the identical 8,079 files
and 27,822 fences. The whole proof service stayed around 2.3 GiB during that
gate. Markdown import governance also passed. This confirms the repair through
the actual detached launcher, not only the isolated CLI.

The later schema-first gate grew past the 7 GiB soft threshold, with its main
scan process blocked in mem_cgroup_handle_over_high. It is a separate complete-
proof blocker. After preserving evidence, cancelled only this owned job through
canonical job cancel. Cancellation returned 0 / stop-requested. Finalization
completed normally in this case; the record is terminated/cancelled, service
exit-code, exit status 130, published/acknowledged, and job wait returned 3.
No threshold relief, reset-failed, manual record edit or broad process kill was
needed. This is one live cancellation acceptance case, not reboot qualification
or proof that every memory-pressure shutdown succeeds.

Raw logs, attempt/inbox/ack records and Turbo summaries were archived on the
worker in ~/.cache/beep/yeet-import-proof/evidence.tgz and compared against the
originals before removing the owned clean worktree. Host memory returned to
about 10 GiB available. Existing readiness configuration edits remain untouched.
No PR, push, publication or full green cheap-gate verdict is claimed.

Remaining: bound schema-first scan memory, complete cheap-gate proof, and
qualify reboot persistence and harsher shutdown/finalization scenarios.
