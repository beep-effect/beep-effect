---
title: "The missed-event check's schedule runs at minute 3 of each ten"
date: 2026-11-24
lane: "fix/ci-missed-event-check-cron-offset"
reversal: "Set the cron in .github/workflows/fleet-missed-event-check.yml back to \"*/10 * * * *\" and the schedule assertion in ci-fleet-missed-event-check.test.ts to match."
---

After #3499 merged at 2026-11-24T00:04:06Z, `fleet-missed-event-check.yml` (cron `*/10 * * * *`, workflow active) had no scheduled run in over two hours. Its only runs were two manual dispatches, 45297774933 and 45308658599, both green, and the repository's other cron workflows fired as usual. The working diagnosis is that GitHub never registered the new workflow's schedule. A push to the default branch that changes the file makes GitHub read the schedule again, so this PR changes it.

The change is the cron itself: `3-59/10 * * * *`, still every ten minutes, at minutes 3, 13, 23, 33, 43 and 53. GitHub delays scheduled runs at periods of high load and names the start of every hour as one; at sufficient load it drops some queued runs. `*/10` puts one run in six on the hour. The repository's other crons already use off-boundary minutes (`41 4 * * *`, `17 9 * * *`).

No alert for a missing schedule is added to the check. A scheduled run exists only when the schedule fires, so the check can report its own missing schedule only from a manual dispatch, which already prints `previous scheduled run: none found`. Between scheduled runs, a gap of more than 30 minutes is already reported as a finding for the gate. Detecting a schedule that never registers needs a watcher outside this workflow.
