# Memory notification investigation — 2026-10-28

## Cross-boot correction and refreshed findings — 2026-10-29 00:18 CDT

The latest investigation queried retained kernel messages across all boots with
`journalctl _TRANSPORT=kernel --since '2026-10-21'`, rather than relying on
`journalctl -k` (which selects the current boot). This establishes a broader
history than the current-boot checkpoints below. Seven matching OOM decisions
were found in the retained interval:

| Local time (CDT) | Victim / scope | Finding |
| --- | --- | --- |
| Oct 27 07:16:09 | ComfyUI Python PID 3841020 | Actual global OOM: `CONSTRAINT_NONE`, `global_oom`, free swap 0 KiB out of 50,331,644 KiB. Victim selection does not prove this application alone caused exhaustion. |
| Oct 28 05:57:47 | proof `f73fd58c50b7` | `CONSTRAINT_MEMCG`, configured 512 MiB ceiling. |
| Oct 28 05:59:29 | proof `43e8e622bca9` | `CONSTRAINT_MEMCG`, configured 512 MiB ceiling. |
| Oct 28 06:04:08 | proof `c2d016cab73a` | `CONSTRAINT_MEMCG`, configured 512 MiB ceiling. |
| Oct 28 06:06:47 | proof `8698e49ccdfa` | `CONSTRAINT_MEMCG`, configured 512 MiB ceiling. |
| Oct 28 14:26:17 | proof `db4bf07912b3` (screenshot) | `CONSTRAINT_MEMCG`, configured 512 MiB ceiling; retained receipt identifies deliberate memory exhaustion. |
| Oct 28 21:13:20 | `foundation-managed-enrollment-types` / TypeScript | `CONSTRAINT_MEMCG`, 6 GiB service peak. |

The four early proof names are exact kernel attributions, not independently
recovered per-run receipts. They match the disposable proof service family and
ceiling. The screenshot's deliberate-test attribution has the stronger retained
fixture/receipt evidence. These records explain repeated notifications, but do
not justify dismissing all memory warnings as synthetic: the October 27 global
event was real.

Current snapshot: 125 GiB RAM, approximately 41 GiB available, 41 GiB swap used.
Ten-second memory stall averages were 0.00%; three subsequent one-second vmstat
intervals showed no swap-out and 72–196 KiB/s swap-in. Zram held about 39.7 GiB
logical data in 18.8 GiB physical allocation. These are brief observations, not
proof of sustained health or a memory leak. ComfyUI was the largest sampled
resident process at about 26.3 GiB; one Dolphin process was about 5.3 GiB.
Neither was interrupted.

Rechecked the verifier source: intentional exhaustion still requires explicit
`--exercise-oom`; default verification performs a controlled stop. Rechecked the
latest package verification guard: it stops its owned job at 8 GiB observed use
or below 8 GiB host headroom, with a 12 GiB emergency ceiling, no swap, and two
CPU affinity. That run failed on typecheck diagnostics, not OOM; observed peak
was 3,828,314,112 bytes and minimum host headroom 36,456,087,552 bytes. No new
stress workload, intentional OOM, swap change, or notification suppression was
performed during this investigation. Heavy-work admission across all launch
surfaces remains an unresolved prevention requirement for the foundation work.

The dated sections below remain historical checkpoints. Their current-boot
counts must not be read as counts covering earlier boots.

The operator's screenshot names `beep-observation-proof-db4bf07912b3.service`. This was this chat's disposable resource proof. At 14:26:17 CDT the kernel recorded `CONSTRAINT_MEMCG` for that exact service and killed Bun PID 719818. The service reached its configured 512 MiB memory ceiling with zero additional swap. This was the deliberate memory-exhaustion scenario, not a recorded global out-of-memory event. KDE presented the cgroup event with generic “Memory Shortage Avoided” wording.

The test should have warned the operator about this desktop side effect. The verifier now requires explicit `--exercise-oom` to invoke the memory allocation route. Routine runs use a controlled stop/restart, retain the real configured memory ceiling, and mark memory enforcement as not exercised by that run. Existing successful OOM evidence is preserved separately in `ops/worker-resource-oom-verification.json`. Genuine workstation notifications were not disabled.

At inspection, the current boot had one recorded OOM kill, matching the exact test unit. The user-manager cgroup reported `oom=1, oom_kill=1`; that count remained unchanged after the subsequent routine run. All owned proof units were stopped. Matching kernel entries were not available in the two preceding boot queries; do not generalize the exact screenshot attribution to unidentified earlier warnings.

There is a separate workload-containment concern. The workstation has about 125 GiB RAM and 47 GiB swap. Available RAM fell from roughly 49 GiB to 25 GiB during sampling, while swap usage rose from roughly 11 GiB to 15 GiB. Several active Bun/Biome processes in other worktrees used roughly 3–7 GiB RSS each. Examples included yeet-ready-refresh, beep-effect22, citation-extraction-engine and several beep-effect4 worktrees. RSS samples are not additive ownership accounting and do not alone prove a leak.

The desktop `app.slice` had approximately 93.7 GiB charged memory at one sample and no MemoryHigh/MemoryMax/MemorySwapMax ceiling. The separately bounded `agent-runs.slice` had roughly 4.6 GiB charged memory, MemoryHigh=88 GiB, MemoryMax=96 GiB and MemorySwapMax=8 GiB. Several heavy jobs were descendants of Claude, Chromium or terminal app scopes rather than the bounded agent-run slice. This merits a cross-lane admission/launcher audit; it is not evidence that those jobs caused this screenshot's cgroup kill. They belong to other active sessions and were not interrupted or reconfigured.

The first routine proof after changing the OOM default encountered an independent HTTP issue: the oversized-body probe received Caddy 502 with an upstream Unix-socket broken pipe instead of 413. It cleaned up without another OOM. This exposes intermittent early-rejection behavior despite earlier passing exchanges. Listener qualification has been reopened in implementation-verification.json; do not enroll producers until repaired. No memory test should be repeated merely to investigate that HTTP issue.


## Follow-up verification

The subsequent default run completed successfully. Its receipt is preserved at
`ops/worker-resource-controlled-stop-verification.json`: result `passed`,
`deliberateMemoryExhaustion=false`, `memoryLimitExercised=false`, restart cause
`controlled-stop`, exact receipt replay after restart, and all four owned worker/proxy
units inactive with MainPID=0. Twenty-four consecutive declared oversized requests
returned 413 after adding a frontend size check; this is bounded fixture evidence,
not blanket production listener qualification. No deliberate OOM was repeated.

A fresh current-boot kernel query still returned only the 14:26:17 service-limit
kill. No matching entries appeared in queries for the preceding two boots. The
forwarder service and timer remain masked and inactive. No proof worker units
remain loaded.

The follow-up live workstation sample showed approximately 96 GiB used of 125 GiB,
28 GiB available, and 21 GiB used swap of 47 GiB. The ten-second memory stall
averages were zero at that instant, while the one-minute averages still showed
recent pressure (some=0.37%, full=0.21%). These are changing snapshots, not proof
that all workloads have sufficient headroom. Later process attribution found a
Bun process in beep-effect22 around 13.5 GiB RSS, a TypeScript compiler in the
security-findings-20261028 worktree around 7.6 GiB, and several other Bun processes
around 3–4.6 GiB each. Several were charged to terminal, Chromium, or Claude app
scopes, outside agent-runs.slice. Process RSS values can share memory and should
not be summed into a precise workstation total.

The immediate warning source is addressed by the routine-test default. The
separate reliability improvement is to route heavy checks through shared admission
and bounded job scopes, accounting for desktop workloads as well as admitted jobs.
No global desktop memory cap, unrelated job termination, notification suppression,
or memory-leak diagnosis was applied from these snapshots.

## Fresh check at 17:09–17:16 CDT

The current-boot kernel query still identifies only the original 14:26:17
service-limit kill; systemd-oomd has no entries since midnight. The held forwarder
service and timer are still masked/inactive. No observation proof worker remains
loaded after the new entrypoint proof; it uses controlled shutdown only.

Available RAM varied from 37 GiB down to 20–22 GiB during this inspection, with
34–35 GiB swap occupied and nonzero memory-stall averages. A later three-second
vmstat sample included a one-second swap-out burst of about 249 MiB/s. This is
actual workload pressure, independently of the deliberately triggered earlier
notification. Swap occupancy alone is not a current OOM diagnosis.

A read-only process sample attributed about 33.6 GiB RSS and 6.7 GiB swap to
ComfyUI's Python process. Several independent Beep compiler/check jobs consumed
roughly 1–4.7 GiB RSS apiece. Many ran under Claude's desktop application scope,
outside agent-runs.slice. These are point-in-time process samples, not additive
physical-memory totals or proof of a leak. No such workload was interrupted.
The desktop app slice remains uncapped while the agent slice has its own separate
limits; therefore agent-slice capacity alone does not establish host headroom.

The new owned worker entrypoint is tested at 512 MiB RAM, zero additional swap,
50% CPU and 64 tasks and refuses startup without verified limits and ownership.
The package gate uses a separate bounded scope. A CLI typecheck reached its
120-second deadline with a 3.13 GiB peak under a 3 GiB soft memory threshold;
that is a timeout, not another OOM. Its result is not reported as a passing check.

## Fresh check at 17:51 CDT

The current boot still contains only the exact 14:26:17 `CONSTRAINT_MEMCG`
kill named in the screenshot. Kernel OOM searches in each of the preceding
four boots returned no entries; systemd-oomd also returned no entries in the
current boot. This establishes the supplied screenshot's cause, not the cause
of any unidentified earlier notification. No owned `beep-observation-proof-*`
or `foundation-*` unit is loaded. The forwarder service and timer are both
masked and inactive.

The first live memory sample showed 42 GiB available out of 125 GiB RAM and
36 GiB occupied out of 47 GiB swap. Memory pressure was nonzero: full-stall
averages were 0.06% over ten seconds, 0.51% over one minute and 0.59% over
five minutes. Two subsequent one-second samples showed swap-in of about
78 MiB/s and 28 MiB/s, with no swap-out in those intervals. High swap
occupancy is therefore accompanied by some actual paging, although this
sample does not show a new OOM.

Read-only process attribution identified ComfyUI at approximately 33.2 GiB
RSS and 5.8 GiB swap; selected Beep checks were roughly 3.3–4.5 GiB RSS.
One check was in an admitted `agent-runs.slice` scope, another under Claude's
desktop app scope, and another in its own app-slice service. The desktop
app slice remained uncapped, while the separate agent slice retained its
88 GiB soft / 96 GiB hard / 8 GiB swap limits. These isolated limits do not
constitute host-wide admission accounting. No unrelated workload was stopped.

The existing verifier's default and warning were inspected directly:
`--exercise-oom` is opt-in, only that branch requests the memory-exhaustion
fixture, and the default branch performs a controlled service stop. No
resource proof or memory-exhaustion test was run for this follow-up diagnosis.


## Fresh check at 18:29–18:31 CDT

The current-boot kernel log still contains only the 14:26:17 OOM kill of the
exact screenshot service. systemd-oomd has no current-boot entries. Routine
resource verification still requires explicit --exercise-oom for deliberate
exhaustion; this investigation did not run it. The latest package gate completed
successfully, using 5.5 GiB peak and zero additional swap. The forwarder service
and timer remain masked/inactive.

A live snapshot showed 46 GiB RAM available and almost all nominal 48 GiB zram
swap occupied. zramctl reported about 45.7 GiB stored data occupying 22.1 GiB
physical allocation after compression (rapidly changing snapshots). Three
one-second vmstat intervals showed approximately 0.75–1.22 MiB/s swap-in and
zero swap-out. Ten-second memory stall averages were zero at the earlier sample,
with recent one/five-minute pressure still nonzero. High occupancy is reduced
headroom, not proof of another OOM or a leak.

ComfyUI's Python process had about 19.2 GiB resident and 18.1 GiB swapped;
WebStorm about 0.54 GiB resident and 3.0 GiB swapped. Two Beep checks under
Claude's desktop scope had roughly 4.3 and 3.2 GiB resident. Per-process values
are attribution snapshots, not additive physical-memory totals. No unrelated
workload was stopped, swap cleared, or notifications disabled.

## Fresh check at 19:16 CDT

The screenshot attribution was revalidated against the kernel journal: the only
current-boot OOM kill remains the 14:26:17 proof-service event, with usage and
limit both 524288 KiB and zero swap. The preceding two boots returned no matching
OOM kills; systemd-oomd has no current-boot entries. No owned proof or foundation
unit remains loaded. The held forwarder service and timer remain masked.

Available RAM was about 50 GiB of 125 GiB, while swap was approximately 47 GiB
occupied. zram reported 46.3 GiB data using about 24 GiB physical allocation.
The largest sampled process was ComfyUI, at about 14.2 GiB resident and 23.1 GiB
swapped; WebStorm had about 1.1 GiB resident and 2.5 GiB swapped. Two one-second
vmstat intervals showed about 10.3 and 2.0 MiB/s swap-in with zero swap-out.
These snapshots show reduced swap headroom and paging, not a new OOM or proof
of a leak. No unrelated processes, swap settings, or notifications were changed.

The explicit OOM option and controlled-stop default were inspected in source.
No resource-exhaustion test was run during this check. The pending launch-facts
focused check had already ended: four test failures, 34 passes, 482.1 MiB peak,
zero swap, and ordinary exit status 1. Its failures arose from sharing one SQL
test layer across independent cases; they were not memory-limit failures.

After isolating the launch test databases, all 38 focused tests passed. Full
package audit and docgen then passed after two import-order fixes: 118.316 seconds,
5.7 GiB peak, zero additional swap. This verification did not exercise OOM.


## Fresh check at 19:51–19:56 CDT

The only current-boot kernel OOM remains the exact screenshot's 14:26:17
512 MiB proof-service limit event. The preceding boot query and current-boot
systemd-oomd query returned no matching events. The verifier source still makes
--exercise-oom opt-in. Both historical forwarder units remain masked/inactive.
No deliberate memory-exhaustion scenario was run.

Available RAM varied from approximately 55 GiB to 48 GiB, while occupied swap
rose from 30 GiB to 44 GiB. At a later sample zram stored about 42.8 GiB of data
in 20.9 GiB physical allocation. Two one-second vmstat intervals showed about
0.75 and 1.69 MiB/s swap-in and zero swap-out. The ten-second full-stall average
was 0.12%, with a one-minute average of 0.89%. These are live snapshots with
changing pressure, not a new OOM diagnosis. ComfyUI was the largest sampled
process: about 29.1 GiB resident and 13.1 GiB swapped. The desktop app slice
remains uncapped; agent-runs.slice retains 88 GiB soft/96 GiB hard/8 GiB swap
limits. No unrelated workload was stopped or reconfigured.

The resumed client's focused tests passed 24 cases in four files, peaking at
460.3 MiB with zero additional swap. Its earlier typecheck and fixture-shutdown
failures had ordinary exit status 1; they were not OOM events. Full verification
results are retained with the client implementation evidence separately.


At 19:58 CDT, the full package audit/docgen passed with 5.6 GiB peak and zero
additional swap. The actual worker/client restart proof also passed without OOM;
all six owned units had MainPID=0 and no proof units remained loaded after cleanup.
The kernel query still returned only the original screenshot event. The latest
memory snapshot showed 56 GiB available RAM and 35 GiB occupied swap. Historical
recovery hold remains intact.


## Additional verification-job event at 21:13 CDT

At 21:13:20, `foundation-managed-enrollment-types.service` hit the 6 GiB
ceiling assigned to a CLI-wide test typecheck and ended with `oom-kill`.
This was an undersized verification envelope, not an intentional exhaustion test.
The event was disclosed immediately; it may produce another KDE warning. Earlier
statements that the current boot contained only the 14:26 event describe their
capture times and are no longer a current total. The failed job stopped and its
log is preserved at `/tmp/foundation-managed-enrollment-types.log`.

A focused typecheck covering the changed managed-owner command and tests completed
with about 1.6 GiB peak, together with the existing managed-runtime regression suite.
This focused result does not replace the broader CLI gate. Future broad checks
need measured admission and an early-stop memory guard, not reuse of the undersized
limit. No unrelated process, swap setting, or desktop notification was changed.


The supervised broader retry ended at its five-minute deadline as the growth guard
observed just over 12 GiB. The service reports timeout, not oom-kill; peak was
12.1 GiB and swap was zero. Minimum observed host-available RAM was about 13.5 GiB.
The check remains unverified. The guard receipt is
`/tmp/foundation-managed-enrollment-wide-types-guard.json`; no unrelated process
was stopped. Its initial 8 GiB soft threshold was raised to 12 GiB on the same live
job after observing reclaim pressure; this was not a restart or a passing result.


## Latest confirmation at 21:49 CDT

The current-boot kernel query identifies two service-local memory-limit kills:
the screenshot proof at 14:26:17 and the CLI typecheck at 21:13:20. Both are
CONSTRAINT_MEMCG; neither is recorded as a global memory-exhaustion kill. No
owned observation-proof or managed-enrollment unit remains loaded. The historical
forwarder service and timer remain masked/inactive. The verifier source confirms
that deliberate exhaustion requires --exercise-oom; ordinary proof uses controlled
stop/restart.

The snapshot showed 46 GiB available RAM out of 125 GiB, with roughly 46 GiB
of 47 GiB swap occupied. Ten-second full memory stalls averaged 0.18%. Subsequent
one-second intervals showed approximately 117 and 218 MiB/s swap-out, so actual
workload pressure persists independently of the two service-limit notifications.
Zram held 45.8 GiB of data in about 23.9 GiB physical allocation. These are
short samples, not a leak diagnosis or a claim that paging is sustained. No
unrelated jobs, swap settings, or notification settings were changed.


## Managed-owner recovery verification

The later combined AI-metrics package gate, scoped CLI typechecks and 17 tests
passed in 147.066 seconds with 5.6 GiB peak and zero allowed swap. An external
guard observed at least 24,669,712,384 bytes of host-available RAM and required
no stop. The actual registered-command/collector proof stopped all ten owned
service processes. No deliberate OOM exercise was run. A source review also
changed each periodic HTTP flush to release its scoped client immediately;
this is not evidence that it caused any prior workstation memory notification.


## Population publication checkpoint, 22:53 CDT

The refreshed current-boot kernel query still showed only the two recorded
CONSTRAINT_MEMCG kills: the 14:26:17 512 MiB proof and the 21:13:20 typecheck.
The contemporaneous snapshot had about 40 GiB available RAM and 33 GiB swap used;
ten-second some/full memory pressure was 0.00%. This short snapshot does not
establish long-term workload or leak behavior.

The later population package gate passed with an externally observed peak of
5,938,671,616 bytes and at least 28,316,626,944 bytes host headroom. The final scoped
CLI gate passed both compilers and 25 tests with observed peak 2,571,239,424 bytes.
Both guards required no stop; swap was disallowed for those jobs. The human command
proof failure was a missing boolean default, not memory exhaustion. Its corrected
actual-command proof passed and stopped all ten temporary service processes. No
additional deliberate OOM exercise was run. Recovery-held service/timer remain
masked/inactive; unrelated applications and desktop notifications were untouched.


## Fresh notification investigation at 23:39 CDT

The kernel journal still records exactly two current-boot memory-limit kills:
the screenshot service at 14:26:17 and the broad typecheck at 21:13:20. Both
report CONSTRAINT_MEMCG. systemd-oomd has no current-boot entries. No owned
beep-observation-* or foundation-* units were loaded. Source inspection confirms
that --exercise-oom remains explicit opt-in and routine proof uses controlled stop.
No exhaustion test was run for this investigation.

Available RAM changed from approximately 34 to 39 GiB of 125 GiB during this
short inspection; occupied swap changed from 39 to 41 GiB of nominal 48 GiB.
Initial ten-second full memory stall average was 4.90 percent. Two one-second
vmstat intervals showed about 416 and 345 MiB/s swap-out. This is actual paging
pressure, not evidence of a global OOM or a demonstrated memory leak. Zram
subsequently held 40.4 GiB data in 21.9 GiB physical allocation.

Read-only process attribution identified ComfyUI PID 3900686 at about 22.7 GiB
RSS and 19.8 GiB swap. The tsgolint process PID 2528285 in
beep-effect4-worktrees/retention-digest-scan increased from about 8.4 to 13.0 GiB
RSS between samples. It belongs to the Chromium app scope, outside
agent-runs.slice. These process snapshots are not additive physical-memory totals
and do not establish a leak. No unrelated job, notification, or swap setting was
changed. Host-wide admission across desktop-launched checks remains the concrete
prevention gap.


## Resumed investigation — 2026-10-29T06:36:08.625755-05:00

A fresh cross-boot kernel search from October 27 still returned the seven OOM
decisions listed at the top: one global event, five 512 MiB proof-service events,
and the 6 GiB TypeScript service event. No later OOM decision appeared in the
queried retained log. systemd-oomd returned no entries for that interval.

The current snapshot had about 44 GiB RAM available out of 125 GiB and 36 GiB
swap occupied out of 47 GiB. Ten-second memory stalls were some=0.57%,
full=0.54%; two subsequent one-second samples showed 736–816 KiB/s swap-in
and zero swap-out. These bounded samples show some recent pressure, not a
current global shortage or a demonstrated leak. The app slice remains uncapped;
the separate agent-runs slice retains 88 GiB soft / 96 GiB hard / 8 GiB swap
limits. Heavy work outside that slice remains a host-wide admission concern.

The full CLI package check has ended with Bun 1.4.4 abort()/SIGABRT after about
616 seconds. systemd reports core-dump, MainPID=0, with about 5.82 GiB peak.
The external guard did not stop it and observed at least 31.84 GiB host-available
RAM. This is a failed runtime verification, not a passing gate and not a new
kernel OOM. All 1,421 recorded CLI input hashes remained unchanged. The bounded
receipt is ops/whole-cli-runtime-abort-verification.json. No duplicate check was
started.

The historical forwarder service and timer remain masked/inactive, and no
beep-observation proof unit is loaded. The explicit --exercise-oom option is
still required for deliberate exhaustion. No unrelated application, swap setting,
or desktop notification was changed.
