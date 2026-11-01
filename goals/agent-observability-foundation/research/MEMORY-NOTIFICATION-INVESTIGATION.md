# Memory notification investigation — 2026-10-28

## Follow-up — October 29, 17:16 CDT

The retained cross-boot kernel query still contains nine OOM decisions, latest at
10:56:06 CDT. No new decision occurred during the guarded delivery work. Available
RAM was 29.3 GiB of 125.1 GiB and swap free was about 77 MiB of 48 GiB. The earlier
Dolphin PID348619 no longer existed; this does not establish its growth cause.
ComfyUI and an unrelated TypeScript lint process were the largest observed
allocations. Both held forwarder units remain masked/inactive, with service PID0.
No unrelated process, swap setting or notification preference changed. Evidence:
`../ops/memory-notification-followup-20261029-1716.json`.

## Follow-up — October 29, 15:52 CDT

The fresh cross-boot query still has nine distinct OOM decisions, latest at
10:56:06 CDT. Boot separator lines are excluded from the event count. The host
has 37.2 GiB available RAM and only 0.05 GiB free swap at this snapshot. ComfyUI
PID 537468 holds about 34.8 GiB resident and 14.1 GiB swapped. No unrelated
application or swap setting changed. The held forwarder service and timer remain
masked/inactive. Evidence: `../ops/history/memory-notification-followup-20261029-1552.json`.

## Process-limit follow-up — October 29, 14:35 CDT

Cross-boot kernel records still contain nine OOM decisions: eight service-limit
kills and one whole-system exhaustion event. None occurred during the latest
final-check attempts. The screenshot remains matched to the deliberate 512 MiB
proof. Routine verification retains explicit opt-in for that destructive test.

A separate resource restriction was confirmed: the temporary final-check guard's
256-task allowance caused the kernel to reject new workers. The retry uses a
1024-task allowance while keeping the same memory/CPU/headroom/time limits and
records task peaks and rejection counts. It has already reached 260 tasks,
confirming that the old allowance was too small for this nested tool chain.
The earlier whole-CLI abort has an exact-service process-limit event too;
its crash cause must not be attributed to Bun alone without further evidence.

At 14:34:52, available RAM was 34.0 GiB of 125.1 GiB, with 45.7 GiB of 48 GiB
swap occupied. Ten-second full-memory-stall average was 0.14%. These are
point-in-time measurements, not sustained-health or leak proof. No unrelated
application, swap setting, or notification preference was changed. Evidence:
`../ops/memory-notification-followup-20261029-process-limit.json`.


## Fresh follow-up — October 29, 13:15 CDT

The cross-boot kernel query still contains nine distinct OOM decisions; none is
newer than the 10:56 restricted-runtime event. The screenshot remains exactly
matched to the deliberate 512 MiB proof. Source inspection confirms routine runs
use controlled stop; deliberate exhaustion requires `--exercise-oom`.

Available RAM briefly fell to about 6.8 GiB with swap effectively full. A later
sample recovered to about 19 GiB after two large Bun/TypeScript processes exited;
that sequence is an observation, not exclusive causal attribution. ComfyUI held
about 36.8 GiB RSS and 9.4 GiB swapped. Dolphin PID 348619 held about 22.3 GiB RSS
and 9.8 GiB swapped, with the same invocation identity as the earlier sample.
No application was stopped. The active Dolphin operation remains unknown.
`ShowToolTips=false` is already configured; the historical thumbnail workaround
is not a newly available fix or proof of the current memory-growth cause.

The historical forwarder hold was refreshed. Raw evidence is in
`../ops/history/memory-notification-followup-20261029-1315.json`. No heavy proof was
launched during the low-headroom inspection, and no notification or swap setting
was changed.

## Current evidence digest — October 29, 12:38 CDT

The exact screenshot is a deliberate 512 MiB service-limit test from this chat,
not a global memory shortage. Its default is now controlled stop/restart;
`--exercise-oom` is explicit opt-in and warns of desktop notifications.

A fresh cross-boot query still identifies nine distinct decisions since October
27: five observability proof-service limits, one compiler limit, two separate
AI-hub qualification-service limits, and one global OOM that killed ComfyUI.
The exact case receipts for the two AI-hub events remain unconfirmed. The original
Dolphin process peaked at 45.6 GiB and exited without intervention; no new kernel
OOM appeared. Do not dismiss all notifications as tests.

A different Dolphin invocation started at 12:20:52, PID 348619, service
`app-org.kde.dolphin@e59e6286f3544567a0e1b153ebacab42.service`, invocation
`7153b614f8494b15bb22d9edb558f6d5`. It initially held roughly 11–12 GiB resident
and 6 GiB swapped, then rose to about 18 GiB resident during this follow-up.
Memory was predominantly private anonymous allocation. Its journal contains
portal Invalid transfer errors; those do not establish the cause. There were
no `dolphin-*` or `dolphin_*` temporary entries in the bounded top-level `/tmp`
check. Installed Dolphin and kio-extras are 26.08.2; KIO is 6.31.0. No root cause
or fixed-version recommendation has been established.

The saved host sample had 37.16 GiB available of 125.13 GiB RAM and only 2.99 GiB
free of 48 GiB swap. Two brief vmstat intervals showed roughly 176–204 MiB/s
swap-out. This is real paging activity even without a new global OOM. It is a
snapshot, not a forecast or proof of a leak. The operator was asked about the
active Dolphin folder/activity; no close action is pending or authorized from
the earlier, already-exited process.

At 12:42:22, available RAM was about 28.5 GiB, swap free was only 168 MiB,
and Dolphin remained about 18.7 GiB resident. No new kernel OOM appeared
since 12:20. The current package verification had finished; no additional
heavy verification was launched during the unexplained desktop growth.

Both historical forwarder units are freshly masked/inactive, service MainPID=0.
No unrelated application, notification preference or swap setting was changed.
The current full AI-metrics audit/docgen passed under the separate bounded guard;
no memory stress was run. Exact host/event evidence is in
`../ops/memory-notification-followup-20261029-midday.json`. Older sections below
are historical observations and must not be read as current memory totals.

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
`ops/history/worker-resource-controlled-stop-verification.json`: result `passed`,
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

## Delivery guard correction — 2026-10-29

The collected Yeet cheap-gate run moved its admitted descendants into `[redacted-agent-session-8]`, a sibling of the outer proof service. The old outer-service monitor therefore did not measure aggregate proof memory. The admitted scope retained a peak of 15,691,333,632 bytes (about 14.6 GiB), with no own memory/swap limits; its observed current use was 4,510,527,488 bytes when this was discovered. The outer service reported only 605,114,368 bytes peak. Earlier outer-service Yeet peaks cannot establish aggregate bounds. This observation does not establish a new kernel OOM event.

The exact owned scope was verified through live process ancestry, given runtime limits, and deliberately stopped together with the outer job after the collected checks had exposed repairable failures. The revised guard follows live descendants into admitted scopes, sums nonoverlapping owned cgroup usage, applies limits only to ancestry-proven owned scopes, and stops those scopes before the outer service on threshold breach. The supported `BEEP_QUALITY_CHEAP_GATE_CONCURRENCY=1` setting now serializes the next collected run. No other agent's service or user application was stopped. The guard revision and before/after evidence are retained by `ops/history/delivery-guard-correction.json`; aggregate qualification remains pending its next admitted run.

## Refreshed cross-boot check — 2026-10-29 08:55 CDT

The retained kernel journal now contains **eight distinct OOM decisions** since
October 27: the seven listed above plus a service-local event at October 29
07:54:53. The newer unit is
`restricted-runtime-qual-35bd64e246d2427c9ccfdf60344ace7c.service`.
Its kernel record says `CONSTRAINT_MEMCG`, memory usage and limit both
786,432 KiB (768 MiB), and zero allowed swap. The unit journal confirms
`oom-kill`, Python PID 3993553, and a 768 MiB peak. Duplicate victim lines in
the same event are not counted as separate OOM decisions.

Read-only source inspection found the matching unit prefix and exact 768 MiB
limit in `~/ai/lib/review/restricted_runtime_aggregate.py`.
That implementation has an explicit `memory-pressure` stress case whose intended
result is a bounded group OOM kill. A receipt tying this exact unit to that case
was not recovered, so deliberate stress is a plausible source attribution, not
an independently confirmed per-run conclusion. This belongs to the AI hub
runtime qualification family, not the observability worker. No source or service
in that other workstream was modified or re-run.

The workstation snapshot had approximately 48 GiB RAM available of 125 GiB,
with 35 GiB swap occupied of 47 GiB. Ten-second memory stalls were 0.38 percent;
two subsequent one-second vmstat samples showed 104 and 4,864 KiB/s swap-in
and zero swap-out. This does not indicate immediate global exhaustion at the
sample time, nor does it establish sustained health. The largest resident
process was ComfyUI Python PID 537468 at about 38.5 GiB RSS, running under a
Ghostty application scope. RSS is not a precise additive ownership total or a
memory leak diagnosis. The application slice remained uncapped and the separate
agent-runs slice retained 88 GiB soft / 96 GiB hard / 8 GiB swap limits.

No foundation or observation-proof service was running. Old failed unit records
remain visible; they are not live consumers. The historical metrics forwarder
service and timer remain masked. Routine resource proof still uses controlled
stop/restart, with intentional exhaustion requiring explicit `--exercise-oom`.
No notification setting, swap configuration, unrelated application or service
was changed by this investigation.

The latest source verification ended with exit 1 due to two schema test policy
advisories, not OOM. Its guard observed 7,150,952,448 bytes peak and at least
35,061,673,984 bytes host headroom, with no admission-scope escape recorded.
AI-metrics audit/docgen, CLI lint/typecheck, and fixed-field schema checks passed
within that run. The combined run remains failed until the two remaining
advisories are independently adjudicated and the policy gate passes.

A small synthetic sibling-scope proof then passed without exhaustion. A child
allocated only 16 MiB, moved into its own agent-run scope, and independently
read back the guard-applied 7 GiB soft / 12 GiB hard / zero-swap limits. The
guard found its live ancestry and accounted about 26.8 MiB total while the
outer service alone reported 2.4 MiB. Both processes exited normally. This
qualifies the specific accounting/limit-application repair; it does not exercise
threshold termination or establish full Yeet workload qualification. Evidence:
`ops/history/delivery-guard-sibling-verification.json`.

## Read-only follow-up on October 29 at 10:27 CDT

The retained journal still contains eight distinct kernel OOM decisions since
October 27. The latest is the separate 07:54 restricted-runtime unit; no newer
decision appeared during this check. The screenshot's exact unit remains tied
to the deliberate 512 MiB proof by both the journal and the original receipt.
Repeated log lines for one kill are not additional OOM decisions.

The workstation sample recorded 125.13 GiB total RAM, 39.00 GiB available,
and 48.00 GiB total swap with 7.18 GiB free. An earlier sample in this turn
had about 44 GiB available. A ComfyUI Python process was the largest resident
consumer, around 39–41 GiB RSS, running under a Ghostty application scope.
That is workload attribution, not evidence of a leak or grounds to stop it.
No unrelated application was interrupted and no swap setting was changed.

Both historical forwarder units were freshly verified masked and inactive.
Routine verification continues to use controlled shutdown and an early-stop
memory guard. The schema catalog has a separate documented larger memory
profile: its completed regeneration used about 12.5 GiB, zero swap, and retained
at least 35 GiB host headroom. It produced no OOM event; the combined command's
failure was the subsequently detected dependency/cache-policy drift.

The exact read-only host sample and retained decision lines are in
`ops/memory-notification-followup-20261029.json`. This is an instantaneous
observation, not a guarantee against future pressure from concurrent jobs.

## Refreshed cross-boot check — 2026-10-29 11:28 CDT

The retained kernel journal now has **nine distinct OOM decisions** since
October 27. The additional event occurred at 10:56:06 CDT in
`restricted-runtime-qual-41a0eb0cc1ac45b8b27e82a47e7e20dc.service`.
The kernel identifies `CONSTRAINT_MEMCG`; the unit journal reports Python PID
2787027, a 768 MiB peak, and `oom-kill`. Duplicate victim messages were not
counted as additional decisions. This is another AI-hub restricted-runtime
qualification service event, not a new observability-worker or global OOM.
The current candidate source still contains the matching service prefix,
768 MiB ceiling and explicit `memory-pressure` case. An exact case receipt
was not recovered, so intentional stress remains an inference for this run.

The host had about 40 GiB available RAM when first sampled in this continuation,
and about 34 GiB of occupied swap. A later pressure sample reported zero
10-second stalls, with small nonzero longer averages. Neither snapshot proves
sustained health or a leak. Fresh raw attribution and host values are retained
in `ops/history/memory-notification-followup-20261029-late.json`.
The historical forwarder is still masked/inactive. No unrelated workload,
notification preference or swap setting was changed; foundation verification
continues with the owned-job memory guard and controlled-stop default.

## Live Dolphin growth observed 2026-10-29, 12:18–12:21 CDT

While the final observability verification completed, Dolphin PID 164671 grew
from about 30 GiB RSS to 35 GiB and then 42 GiB RSS. The last smaps observation
was mostly private anonymous memory, rather than reclaimable file cache. Host
available RAM fell to about 6 GiB and swap was almost full. The proof's own
service peaked near 5 GiB and completed; Dolphin was in a separate application
service started at 12:08:38. Its original launcher/workload is not established.

Before closing anything, the agent asked whether the file manager owned active
work. The process exited at 12:20:47 without agent intervention. No new kernel
OOM was recorded. Its service summary reports 45.6 GiB memory peak and 5.8 GiB
swap peak over 12 minutes 9 seconds. Available RAM then recovered to about
48 GiB. Repeated PNG decoding errors and a portal transfer error are diagnostic
leads, not proof of the cause. No other application, notification or swap setting
was changed. The pending close question no longer requires action.

This is separate from the earlier deliberate proof-limit kills and demonstrates
that other desktop workloads can create substantial real memory pressure. See
`../ops/memory-dolphin-growth-20261029.json` for the process/service binding and
ordered observations. Do not label the process a proven memory leak or attribute
it to this packet without further evidence.

## Cross-checkout pressure during delivery — 2026-10-29 afternoon

The 26-minute full CLI run stopped protectively after host available memory
fell below the 16 GiB reserve. Its own peak was about 7 GiB and PID-limit
events remained zero. systemd later reported a shutdown timeout because the
process did not exit within the five-second stop grace. This was not a
RuntimeMax deadline or kernel OOM. All 1,779 checked source hashes were stable.

A later local final-check also stopped on host pressure; available RAM then
fell to about 7.5 GiB and swap was almost full. Metadata-only process inspection
identified Bun workloads in `beep-effect9-worktrees/turborepo-producer-capture`
and `beep-effect9-worktrees/docgen-node-launch`, including two processes over
11 GiB RSS, under a shared Chromium application scope. ComfyUI held about
34 GiB RSS plus 14 GiB swapped memory. These observations establish competing
workloads, not a memory leak or the exact commands that launched them.

The next owned package check was refused before launch under the 24 GiB
admission floor. No unrelated workload was stopped. The separately bounded
installed worker proof passed with no deliberate OOM; temporary units and
its independent monitor were stopped and removed as owned. All heavy proof
paths need admission and per-job budgets, including commands launched by
browser-hosted sessions. Evidence: `../ops/history/memory-pressure-cross-checkout-20261029.json`
and `../ops/whole-cli-protective-stop-verification.json`.
