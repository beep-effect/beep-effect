---
title: "Cost controls runs silent beside Pulumi and goes live after the cutover"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "Return prod to silent with one PR (notifications: silent); its plan deletes only the stack's own AnomalyAlerts subscription, the single delete the pre-deploy gate allows."
---

Two budgets and two anomaly subscriptions would mail the same people twice, and on creation, not only on the next breach: month-to-date spend was $371.54 against the $200 limit on 2026-11-13, so all four live notifications (ACTUAL 50/80/100 %, FORECASTED 100 %) are in `ALARM`, and a new budget with the same thresholds alerts at once.

The stack therefore runs in two phases, set by `notifications` in the tracked `prod` configuration:

1. `silent` (what this lane ships): the new budget exists with no notifications and no anomaly subscription is declared; the adopted monitor keeps feeding the Pulumi-owned subscription. Nobody is mailed by the new stack.
2. `live`: one-line PR, merged before the Pulumi destroy (packet gate ruling, 2026-11-14); the deploy it triggers adds the four budget notifications and creates `beep-account-anomaly-alerts` on the adopted monitor. The old Pulumi budget and subscription are destroyed right after the `live` deploy is verified.

Superseded in part (packet gate ruling, 2026-11-14): the silent phase kept recipients from being mailed twice during the parallel run, but the destroy-first order it assumed left a gap with no budget or anomaly mail on an account already over its budget. The order is now `live` first, Pulumi destroy second. The cost is one duplicate burst: each threshold mails once from the new budget when its notifications are created (the month is already over budget), and the new daily anomaly subscription runs beside the old one until the gate session destroys the old pair right after the `live` deploy is verified, so at most one duplicate daily digest. There is no gap and no gap limit; the earlier two-hour rule is withdrawn. The component-removal PR still waits until `live` has been green for 24 hours.
