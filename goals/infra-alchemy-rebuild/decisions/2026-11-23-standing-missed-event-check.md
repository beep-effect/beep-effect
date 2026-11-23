---
title: "Standing missed-event check: GitHub-only verdicts on a hosted schedule, read-only, fails on alert"
date: 2026-11-23
lane: "feat/ci-missed-event-check"
reversal: "delete the scheduled workflow and the beep ci subcommand, uninstall and delete the beep-fleet-watch App, and delete its fleet-watch secret; the gate's local watch covers the window again; nothing is migrated"
---

The CI goals driver ruled a standing check for runner jobs that GitHub queued and the new fleet never served. The ruling came on 2026-11-19, and the driver specified the check on 2026-11-22. On 2026-11-23 it added token ruling 2′, amended the signals, and returned six blocking corrections in its first read. The check is its own pull request, after P5 step 4a and merged before 6b. Until it merges, the gate's local watch (`watch-once.sh`) covers 4a through the green day. This record is the check's specification and is written before any code.

**What it detects.** The check runs once for each `beep-fleet-*` job that is still `queued`. The trigger reads actions and runners only, so it works the same before and after 6b. Delivery evidence only classifies a trigger, and only before 6b.

A pool makes **progress** when at least one of its jobs started in the last 15 minutes (a `started_at` in that window and a `runner_name`).

| Verdict | Alerts | Condition |
| --- | --- | --- |
| `Stuck` | yes | The pool is at cap, a job of that pool is queued, and a runner of the pool is idle in both runner reads of the run. |
| `Wedged` | yes | The pool is at cap, at least one counted runner is not busy (offline or idle), a pool job has been queued 15 minutes or more, and the pool made no progress. |
| `MissedDelivery` | yes, before 6b | No 2xx `queued` delivery for the job on repository hook 714397446, 5 minutes or more after the job was created. |
| `NoLaunch` | yes | The job has been queued 10 minutes or more, the pool is below cap counting registered runners, the pool has no idle runner, and one of three holds. The launches since the job's creation cover its rank (launches ≥ rank, and the job is still queued). Or the pool made no progress. Or the job has been queued 2 hours or more. This is the trigger. |
| `WaitingAtCap` | no | The pool is at cap, and no `Stuck` or `Wedged` condition holds. All runners busy at cap stays here. |
| `Waiting` | no | The pool is below cap, has made progress, and the launches since the job's creation are fewer than the job's rank: the pool's queued jobs created at or before it, itself included. |

**Precedence.** A job gets the first verdict that holds, in this order: `Stuck`, `Wedged`, `MissedDelivery`, `NoLaunch`, `WaitingAtCap`, `Waiting`. Below the 10-minute threshold a job is `WaitingAtCap` or `Waiting`, unless `Stuck`, `Wedged` or `MissedDelivery` holds. `Waiting` needs progress: with no progress, a job queued 10 minutes or more below cap is `NoLaunch` whatever its rank, so a total scale-up outage cannot hide as `Waiting`. Launches are read only from runs created in the last two hours, so a job queued 2 hours or more below cap is `NoLaunch` whatever its rank or progress: an undercount of launches cannot leave it `Waiting` forever.

Each `NoLaunch` carries a classification:

- **Before 6b:** `missed` (no 2xx `queued` delivery), `lost` (a 2xx delivery and still no launch) or `unknown`. A delivery page or detail failed after its retries, or the pages read do not reach back to the job's creation. A failed read is unknown, never a miss.
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
- **Jobs.** Read from the runs and jobs APIs with paging over every page (a single `per_page=100` page is not enough). The runs are the `queued` and `in_progress` runs plus the runs created in the last two hours, which carry the started jobs for launches and progress. The jobs are the ones carrying a `beep-fleet-*` label.
- **Deliveries, before 6b only.** Read from repository hook 714397446 by cursor paging, newest first, once per run, back to the oldest alerting job's creation minus 2 minutes. Each delivery's detail is fetched once and cached. Delivery ids exceed 2^53 and stay strings end to end.

**Cap source.** Each pool's `maximumCount` has one source of truth: the production configuration in `packages/tooling/infra/ci-runners/src/Config.ts`. A generated input projects it for the check, and a test asserts the projection equals the production configuration for each pool and phase. Nothing in the workflow holds a cap literal, and overflow ON or OFF needs no workflow edit: the toggle changes which jobs carry the overflow label, not a pool's cap.

**Where it runs.** A scheduled workflow every 10 minutes on a hosted `ubuntu` runner, never on `beep-fleet`: the check must not depend on the fleet it watches. The logic is a `beep ci` subcommand in repo-cli, so it is closure source. Its merge cuts a binary cycle. A run lasts at least the 300-second gap between its two runner reads.

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

**Failures and remedies.** A run fails on any alerting verdict. The step summary names the previous scheduled run and its time. The gate and the green-day watch treat a gap of more than 30 minutes between scheduled runs as a finding. The summary lists each alerting job with:

- its id, pool, age, verdict and classification;
- before 6b, its delivery evidence (delivery id and status code, or the window read and the oldest delivery reached);
- the remedy commands, never run by the check:
  - **Before 6b:** when a 2xx or failed `queued` delivery exists, the redelivery (`gh api -X POST repos/<repo>/hooks/<hook>/deliveries/<id>/attempts`). When the delivery is `missed`, `gh run cancel <run>`, then, once the run completes, `gh run rerun <run>`.
  - **From 6b:** the gate's enrichment and App-redelivery command, and the same cancel and rerun pair.
  - The cancel and rerun pair is marked as the gate's call: it reruns the whole run. `gh run rerun --failed` refuses a run that is still in progress, so the summary never prints it for a queued job.

The check never redelivers, cancels, reruns or writes anything. It files no issue and adds no alert service. A green run writes one summary line: jobs checked, verdict counts, p95 queue-to-start and the previous run's time.

**Tests.** They are built from the watch's dry runs, as fixtures:

- each verdict, each `NoLaunch` classification, and the precedence order;
- a delivery page older than the job (`unknown`);
- a detail read that fails (`unknown`);
- the rank rule with progress (`Waiting` with 3 launches for rank 4);
- a total outage: 0 launches and 3 jobs queued 10 minutes or more below cap, all `NoLaunch`;
- launches that cover the rank while the job is still queued (`NoLaunch`, watch-once's LOST rule);
- a job queued 2 hours or more below cap with progress and launches below its rank (`NoLaunch`, not `Waiting`);
- a cap read that cycles between the two runner reads (`WaitingAtCap`, not `Stuck`);
- an idle runner at cap in both reads (`Stuck`);
- two ghost `offline` runners at cap 2 with a job queued 20 minutes and no progress (`Wedged`);
- two busy runners on 40-minute jobs at cap 2 (`WaitingAtCap`);
- the 6b switch in the middle of a window (a job created before it is classified from deliveries; one created after it gets `delivery evidence: gate`);
- a runner registered `offline` below cap;
- launches that exclude a job cancelled or skipped while queued;
- the cap projection equal to the production configuration.

**Order.** The check lands as its own pull request before 6b. It touches a workflow path, so it needs the operator's hand merge and the driver's read, at a head whose tests are built from those fixtures. The watch stays the gate's tool until this check is green on `main`.
