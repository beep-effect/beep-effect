---
title: "Cost controls runs silent beside Pulumi and goes live after the cutover"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "Set notifications to live in the prod configuration before the cutover (recipients then get every alert twice until the Pulumi budget and subscription are destroyed)."
---

Two budgets and two anomaly subscriptions would mail the same people twice, and on creation, not only on the next breach: month-to-date spend was $371.54 against the $200 limit on 2026-11-13, so all four live notifications (ACTUAL 50/80/100 %, FORECASTED 100 %) are in `ALARM`, and a new budget with the same thresholds alerts at once.

The stack therefore runs in two phases, set by `notifications` in the tracked `prod` configuration:

1. `silent` (what this lane ships): the new budget exists with no notifications and no anomaly subscription is declared; the adopted monitor keeps feeding the Pulumi-owned subscription. Nobody is mailed by the new stack.
2. `live`: one-line PR after the Pulumi cutover destroyed `Monthly Budget` and `beep-account-daily-anomalies`; the deploy it triggers adds the four budget notifications and creates `beep-account-anomaly-alerts` on the adopted monitor.

So recipients are never mailed twice. Each threshold mails once from the new budget when the phase flips, because the month is already over budget, which is the alert the old budget would also have sent at the next breach. The gap without budget alerts is the time between the destroy step of the cutover and the `live` deploy, one PR merge; the gap without anomaly mail is the same window, and the daily anomaly digest is at most one day late. The parallel period itself is the time between the first `prod` deploy and the cutover, which the launching session runs right after verifying that deploy.
