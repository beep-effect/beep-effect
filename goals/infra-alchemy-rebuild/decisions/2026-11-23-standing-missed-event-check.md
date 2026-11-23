---
title: "Standing missed-event check: GitHub-only verdicts on a hosted schedule, read-only, fails on alert"
date: 2026-11-23
lane: "feat/ci-missed-event-check"
reversal: "delete the scheduled workflow and the beep ci subcommand, uninstall and delete the beep-fleet-watch App, and delete its fleet-watch secret; the gate's local watch covers the window again; nothing is migrated"
---

The CI goals driver ruled a standing check for runner jobs that GitHub queued and the new fleet never served. The ruling came on 2026-11-19, and the driver specified the check on 2026-11-22, with token ruling 2′ and amended signals on 2026-11-23. The check is its own pull request, after P5 step 4a and merged before 6b. Until it merges, the gate's local watch (`watch-once.sh`) covers 4a through the green day. This record is the check's specification and is written before any code.

**What it detects.** The check runs once for each `beep-fleet-*` job that is still `queued`. The trigger reads actions and runners only, so it works the same before and after 6b. Delivery evidence only classifies a trigger, and only before 6b.

| Verdict | Alerts | Condition |
| --- | --- | --- |
| `NoLaunch` | yes | The job has been queued 10 minutes or more, the pool is below its cap counting registered runners, and the pool has no idle runner. This is the trigger. |
| `MissedDelivery` | yes, before 6b | No 2xx `queued` delivery for the job on repository hook 714397446, 5 minutes or more after the job was created. It alerts before `NoLaunch` can. |
| `Stuck` | yes | A runner of the pool has been idle for 5 minutes or more, the pool is at cap, and a job of that pool is queued. |
| `WaitingAtCap` | no | The pool is at cap and has no idle runner. |
| `Waiting` | no | The pool is below cap, but fewer runners registered since the job's creation than the pool's queued jobs created at or before it (its rank). |

Each `NoLaunch` carries a classification:

- **Before 6b:** `missed` (no 2xx `queued` delivery), `lost` (a 2xx delivery and still no launch) or `unknown`. A delivery page or detail failed after its retries, or the pages read do not reach back to the job's creation. A failed read is unknown, never a miss.
- **From 6b:** `delivery evidence: gate`. The check reads no deliveries, and the summary prints the command the gate runs to enrich the verdict.

Not alerts: `WaitingAtCap` and `Waiting`. The p95 queue-to-start of the pool's jobs that started in the window goes in the summary only.

**Signals.** GitHub only. The check makes no AWS call.

- **Runners.** A launch is a registered `beep-fleet-*` runner of the pool, from the org's self-hosted runners with their labels. Three states:
  - registered and `online` with `busy=false`: idle;
  - `busy=true`: serving;
  - registered and `offline`: booting. It counts toward the cap and toward the launches since the job's creation, never as idle.
- **Idle since.** An ephemeral runner is idle only before its first job, so its idle time starts no earlier than its registration. A runner first seen idle is seeded at its launch time plus 300 seconds, never later than now. That is the watch's rule, kept because the runner API has no idle-since field.
- **Jobs.** Read from the runs and jobs APIs (`queued` and `in_progress` runs, their `queued` jobs with a `beep-fleet-*` label).
- **Cap.** Read twice: once at the start of the run and once for each job. A pool counts as at cap when either read is at cap, and as below cap only when both are. One cycling runner briefly reads below cap, and a single early read misclassified jobs that were waiting at cap (2026-11-22, 21:53Z pass).
- **Deliveries, before 6b only.** Read from repository hook 714397446 by cursor paging, newest first, once per run, back to the oldest alerting job's creation minus 2 minutes. Each delivery's detail is fetched once and cached. Delivery ids exceed 2^53 and stay strings end to end.

**Where it runs.** A scheduled workflow every 10 minutes on a hosted `ubuntu` runner, never on `beep-fleet`: the check must not depend on the fleet it watches. The logic is a `beep ci` subcommand in repo-cli, so it is closure source. Its merge cuts a binary cycle.

**Token (ruling 2′).** A new read-only App, `beep-fleet-watch`, installed on `beep-effect/beep-effect` only.

- **Permissions:** actions read, organization self-hosted runners read and repository hooks read.
- **Key:** an Actions secret in the `fleet-watch` environment. The environment deploys from `main` only, and only the scheduled check uses it.
- **Tokens:** the workflow mints them with exactly those three permissions.

This is an explicit exception to the 2026-11-13 rule of one long-lived credential in CI, and the operator accepts it when creating the App. The fleet App (`beep-ci-fleet-controller`) is out: its key mints admin-write tokens and never leaves its store.

The code reads the installation token through a token-provider service, and the tests use a fake. So the check is built before the App exists. The workflow merges only once the App and environment exist, through the operator's hand merge.

**Hook source is configuration.** Before 6b the source is repository hook 714397446 (the new fleet's Lambda URL). From 6b there is no hook source at all: the check does not read `/app/hook/deliveries`. The 6b pull request does three things together:

- it sets the source to none;
- it drops or idles the repository-hooks read;
- it switches the classifier to `delivery evidence: gate`.

A run whose window spans the switch classifies each job by the configuration in effect at the job's creation.

**Failures.** A run fails on any alerting verdict. The step summary lists each alerting job with:

- its id, pool, age, verdict and classification;
- before 6b, its delivery evidence (delivery id and status code, or the window read and the oldest delivery reached);
- the exact commands: the redelivery (`gh api -X POST repos/<repo>/hooks/<hook>/deliveries/<id>/attempts`) before 6b, the gate's enrichment command from 6b, and the rerun (`gh run rerun <run> --failed`).

The check never redelivers, reruns or writes anything, and it only prints the commands. It files no issue and adds no alert service. A green run writes one summary line: jobs checked, verdict counts, p95 queue-to-start.

**Tests.** They are built from the watch's dry runs, as fixtures:

- each verdict, and each `NoLaunch` classification;
- a delivery page older than the job (`unknown`);
- a detail read that fails (`unknown`);
- the rank rule (`Waiting` with 3 launches for rank 4);
- a cap read that cycles during the run (`WaitingAtCap`, not `Stuck`);
- an idle runner at cap (`Stuck`);
- the 6b switch in the middle of a window (a job created before it is classified from deliveries; one created after it gets `delivery evidence: gate`);
- a runner registered `offline`.

**Order.** The check lands as its own pull request before 6b. It touches a workflow path, so it needs the operator's hand merge and the driver's read, at a head whose tests are built from those fixtures. The watch stays the gate's tool until this check is green on `main`.
