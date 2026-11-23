---
title: "Standing missed-event check: GitHub-only verdicts on a hosted schedule, read-only, fails on alert"
date: 2026-11-23
lane: "feat/ci-missed-event-check"
reversal: "delete the scheduled workflow and the beep ci subcommand, uninstall and delete the beep-fleet-watch App, and delete its fleet-watch secret; the gate's local watch covers the window again; nothing is migrated"
---

The CI goals driver ruled a standing check for runner jobs that GitHub queued and the new fleet never served. The ruling came on 2026-11-19, and the driver specified the check on 2026-11-22. On 2026-11-23 it added token ruling 2′, amended the signals, and returned six blocking corrections in its first read. The check is its own pull request, after P5 step 4a and merged before 6b. Until it merges, the gate's local watch (`watch-once.sh`) covers 4a through the green day. This record is the check's specification and is written before any code.

**What it detects.** The check runs once for each `beep-fleet-*` job that is still `queued`. The trigger reads actions and runners only, so it works the same before and after 6b. Delivery evidence only classifies a trigger, and only before 6b.

A pool makes **progress** when at least one of its jobs started in the last 15 minutes (a `started_at` in that window and a `runner_name`). Progress counts every run the check reads, older `in_progress` runs included. Launches count only runs created in the last two hours.

| Verdict | Alerts | Condition |
| --- | --- | --- |
| `Stuck` | yes | The pool is at cap, a runner of the pool is idle in both runner reads of the run, and the job was created at or before the first runner read. A job created between the reads may simply not have been picked up yet. |
| `Wedged` | yes | The pool is at cap, at least one counted runner is not busy (offline or idle) in the second runner read, a pool job has been queued 15 minutes or more, and the pool made no progress. |
| `MissedDelivery` | yes, before 6b | No 2xx `queued` delivery for the job on repository hook 714397446, 5 minutes or more after the job was created. |
| `NoLaunch` | yes | The job has been queued 10 minutes or more, the pool is below cap counting registered runners, the pool has no idle runner in the second runner read (a runner that just booted counts), and one of three holds. The launches since the job's creation cover its rank (launches ≥ rank, and the job is still queued). Or the pool made no progress. Or the job has been queued 2 hours or more. This is the trigger. |
| `WaitingAtCap` | no | The pool is at cap, and no `Stuck` or `Wedged` condition holds. All runners busy at cap stays here. |
| `Waiting` | no | The pool is below cap, and no earlier verdict holds: every remaining below-cap case. With progress, a job queued under 2 hours whose launches since its creation are fewer than its rank (the pool's queued jobs created at or before it, itself included) is here. So is a job queued under 10 minutes, and a job whose pool has a runner idle in the second runner read, with or without progress. |

**Precedence.** A job gets the first verdict that holds, in this order: `Stuck`, `Wedged`, `MissedDelivery`, `NoLaunch`, `WaitingAtCap`, `Waiting`. Below the 10-minute threshold a job is `WaitingAtCap` or `Waiting`, unless `Stuck`, `Wedged` or `MissedDelivery` holds. With no runner idle in the second runner read, `Waiting` needs progress: with no progress, a job queued 10 minutes or more below cap is `NoLaunch` whatever its rank, so a total scale-up outage cannot hide as `Waiting`. Launches are read only from runs created in the last two hours, so such a job queued 2 hours or more below cap is `NoLaunch` whatever its rank or progress: an undercount of launches cannot leave it `Waiting` forever. A runner idle in the second read keeps a below-cap job `Waiting`: it may have just booted for the job.

Each `NoLaunch` carries a classification:

- **Before 6b:** `lost` (a 2xx delivery and still no launch) or `unknown`. A delivery page or detail failed after its retries, a candidate detail names no workflow job (its request or payload is absent), or the pages read do not reach back to the start of the job's delivery window (its creation minus 2 minutes). A failed read is unknown, never a miss. A job with no 2xx `queued` delivery reports as `MissedDelivery`, which ranks above `NoLaunch`. A 2xx delivered later than the job's creation plus 5 minutes falls outside the window and reads as missed, which is accepted.
- **From 6b:** `delivery evidence: gate`. The check reads no deliveries.

Not alerts: `WaitingAtCap` and `Waiting`. The p95 queue-to-start of the pool's jobs that started in the window goes in the summary only.

**Signals.** GitHub only. The check makes no AWS call and keeps no state between runs.

- **Runners.** Read from the org's self-hosted runners with their labels, twice in each run, 300 seconds apart. A counted runner is a registered `beep-fleet-*` runner of the pool, in one of three states:
  - `online` with `busy=false`: idle for this read;
  - `busy=true`: serving;
  - `offline`: booting, or a ghost. It counts toward the cap, never as idle.
- **Idle.** A runner is idle only when the same runner id is `online` and not busy in both reads. That holds for 300 seconds or more, with no cross-run state and no launch-time estimate.
- **Cap.** The cap is read at the first runner read and again at the second. A pool counts as at cap when either read is at cap, and as below cap only when both are. One cycling runner briefly reads below cap, and a single early read misclassified jobs that were waiting at cap (2026-11-22, 21:53Z pass).
- **Launches since a job's creation.** The pool's jobs with `started_at` at or after that creation and a `runner_name`, plus the pool's currently registered runners that are not busy. A job cancelled or skipped while queued gets a `started_at` without a runner, so it does not count. That trap was measured on 2026-11-22.
- **Jobs.** Read from the runs and jobs APIs with paging over every page, up to 50 pages per listing (a single `per_page=100` page is not enough). A listing that stops at 50 pages with fewer items than its total count fails the run as a read error, never a silent partial result. A listing that fits on one page is accepted on its first walk; any other listing is accepted when two consecutive walks of it agree. Once a first walk is not accepted, a later walk needs that agreement even when it fits on one page. After three walks without agreement the check uses the union of the walks' ids and adds `listing unstable (N walks)` to the summary. That is not a read error: a busy-hour listing must not red like an alert, and a job missed in one run is caught 10 minutes later. A repeated id counts as a disagreement and goes into the union. Real read failures (an HTTP error, a decode failure, a truncation or an empty page short of its own reported total, even when the total changed between pages) stay read errors. The runs are the `queued` and `in_progress` runs plus the runs created in the last two hours, which carry the started jobs for launches and progress. The jobs are the ones carrying a `beep-fleet-*` label.
- **Deliveries, before 6b only.** Read from repository hook 714397446 by cursor paging, newest first, once per run, back to the oldest alerting job's creation minus 2 minutes. Each delivery's detail is fetched once and cached. Delivery ids exceed 2^53 and stay strings end to end.

**Cap source.** Each pool's `maximumCount` has one source of truth: the production configuration in `packages/tooling/infra/ci-runners/src/Config.ts`. A generated input projects it for the check, and a test asserts the projection equals the production configuration for each pool and phase. Nothing in the workflow holds a cap literal, and overflow ON or OFF needs no workflow edit: the toggle changes which jobs carry the overflow label, not a pool's cap. The caps follow `main`, not the live fleet: between a cap change's merge and its deploy, the check reads the merged cap.

**Where it runs.** A scheduled workflow every 10 minutes on a hosted `ubuntu` runner, never on `beep-fleet`: the check must not depend on the fleet it watches. The logic is a `beep ci` subcommand in repo-cli. The workflow runs it from source, so it is not in the CI binary's closure, and its merge needs no binary release or pin-sync proof. A run lasts at least the 300-second gap between its two runner reads.

**Contracts.** Four services, so the tests run instantly with fakes:

- a GitHub reads service (runs, jobs, org runners, hook deliveries and delivery details);
- a token provider;
- the clock;
- a sleep seam for the 300-second gap.

**Token (ruling 2′).** A new read-only App, `beep-fleet-watch`, installed on `beep-effect/beep-effect` only.

- **Permissions:** actions read, organization self-hosted runners read and repository hooks read.
- **Key:** an Actions secret in the `fleet-watch` environment. The environment deploys from `main` only, and only the scheduled check uses it.
- **Tokens:** the workflow mints them with exactly those three permissions.

This is an explicit exception to the 2026-11-13 rule of one long-lived credential in CI, and the operator accepts it when creating the App. The fleet App (`beep-ci-fleet-controller`) is out: its key mints admin-write tokens and never leaves its store.

The code reads the installation token through the token provider, and the tests use a fake. So the check is built before the App exists. The workflow merges only once the App and environment exist, through the operator's hand merge.

**Hook source is configuration.** Before 6b the source is repository hook 714397446 (the new fleet's Lambda URL). From 6b there is no hook source at all: the check does not read `/app/hook/deliveries`. The 6b pull request does three things together:

- it sets the source to none;
- it drops or idles the repository-hooks read;
- it switches the classifier to `delivery evidence: gate`.

A run whose window spans the switch classifies each job by the configuration in effect at the job's creation.

**Failures and remedies.** A run fails on any alerting verdict. The step summary names the previous scheduled run and its time: the newest scheduled run created before this one, so a newer scheduled run pending behind this one is skipped. A manual dispatch, which is not in the scheduled runs, names the newest. The gap is measured from one scheduled run to the next, and a manual dispatch does not reset it. The gate and the green-day watch treat a gap of more than 30 minutes between scheduled runs as a finding. The summary lists each alerting job with:

- its id, pool, age, verdict and classification;
- before 6b, its delivery evidence (delivery id and status code, or the window read and the oldest delivery reached);
- the remedy commands, never run by the check:
  - **Before 6b:** when a 2xx or failed `queued` delivery exists, the redelivery (`gh api -X POST repos/<repo>/hooks/<hook>/deliveries/<id>/attempts`). When the delivery is `missed`, `gh run cancel <run>`, then, once the run completes, `gh run rerun <run>`.
  - **From 6b:** the gate's enrichment and App-redelivery command, and the same cancel and rerun pair.
  - The cancel and rerun pair is marked as the gate's call: it reruns the whole run. `gh run rerun --failed` refuses a run that is still in progress, so the summary never prints it for a queued job.

The check never redelivers, cancels, reruns or writes anything. It files no issue and adds no alert service. A green run writes one summary line: jobs checked, verdict counts, p95 queue-to-start, the previous run's time and the number of GitHub requests the run made (the installation-token budget at 144 runs a day). A setup or install failure turns the run red too, so the gate reads the summary heading `## Fleet missed-event check: N alert(s)`, not the run's colour.

**Tests.** They are built from the watch's dry runs, as fixtures:

- each verdict, each `NoLaunch` classification, and the precedence order;
- a delivery walk that reaches the job's creation but not its window start, creation minus 2 minutes (`unknown`);
- a listing stopped at 50 pages with fewer items than its total count (a read error, "listing truncated at 50 pages"; never a silent partial result);
- a listing whose ids change in every one of three walks (the union of the walks' ids, with `listing unstable (3 walks)` in the summary; not a failure);
- a delivery walk stopped at 60 pages (`unknown`);
- a detail read that fails (`unknown`);
- the rank rule with progress (`Waiting` with 3 launches for rank 4);
- a total outage: 0 launches and 3 jobs queued 10 minutes or more below cap, all `NoLaunch`;
- launches that cover the rank while the job is still queued (`NoLaunch`, watch-once's LOST rule);
- a job queued 2 hours or more below cap with progress and launches below its rank (`NoLaunch`, not `Waiting`);
- a cap read that cycles between the two runner reads (`WaitingAtCap`, not `Stuck`);
- an idle runner at cap in both reads (`Stuck`);
- an idle runner at cap in both reads and a job created between the reads (`WaitingAtCap`);
- a runner idle only in the second read, below cap, a job queued 12 minutes, with progress (`Waiting`);
- a runner idle only in the second read, below cap, a delivered job queued 12 minutes, without progress (`Waiting`);
- a 2xx `queued` delivery whose detail names no workflow job (`unknown`, not `MissedDelivery`);
- an empty page short of a total that changed between pages (a read error, never the union of partial walks);
- a paginated listing whose next walk fits on one page (accepted only when a third walk agrees);
- a newer scheduled run pending while this one runs (the previous run is the newest created before this one);
- two ghost `offline` runners at cap 2 with a job queued 20 minutes and no progress (`Wedged`);
- two busy runners on 40-minute jobs at cap 2 (`WaitingAtCap`);
- the 6b switch in the middle of a window (a job created before it is classified from deliveries; one created after it gets `delivery evidence: gate`);
- a runner registered `offline` below cap;
- launches that exclude a job cancelled or skipped while queued;
- the cap projection equal to the production configuration.

**Order.** The check lands as its own pull request before 6b. It touches a workflow path, so it needs the operator's hand merge and the driver's read, at a head whose tests are built from those fixtures. The watch stays the gate's tool until this check is green on `main`.
