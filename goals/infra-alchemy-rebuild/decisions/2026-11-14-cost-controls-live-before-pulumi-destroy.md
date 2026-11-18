---
title: "Cost controls cutover goes live first, Pulumi destroy second (packet gate)"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls-live"
reversal: "Return to the destroy-first order with a bounded gap: destroy the old Pulumi pair before merging live; requires a new packet gate ruling."
---

Ruling of the packet gate session, 2026-11-14, superseding the destroy-first order and the two-hour gap rule recorded on 2026-11-14 (cutover decision, timing; silent-parallel-run decision, gap limit): in the Pulumi cutover `live` goes first and the Pulumi destroy second.

Why: the destroy-first order leaves a gap between destroying `Monthly Budget` and `beep-account-daily-anomalies` and the `live` deploy in which the account, already over its budget ($371.54 month to date against $200 on 2026-11-13), has no budget and no anomaly mail at all. The cost of the new order is one duplicate burst: the new budget sends each threshold mail once when its notifications are created, and the new `AnomalyAlerts` subscription runs beside the old Pulumi one, so at most one duplicate daily anomaly digest, until the gate session destroys the old pair right after the `live` deploy is verified.

New order: (1) merge the `live` PR, whose deploy adds the budget notifications and creates `AnomalyAlerts` (the pre-deploy gate accepts a budget update and an `AnomalyAlerts` create while the nine singletons stay no-op; the PR does not touch the workflow, so it is an ordinary gate merge, disclosed to the orchestrator before it merges as the window-5 owner asked); (2) verify both exist and the gate step passed; (3) the gate session destroys only the old Pulumi budget and subscription by target, then removes the monitor, six tags, two enrollments, provider and component from Pulumi state; (4) the component-removal PR merges after `live` has been green for 24 hours. Rollback follows the order: before (3), a PR back to `silent` (the gate's single allowed `AnomalyAlerts` delete); after (3), restore the Pulumi pair (import, refresh, preview two creates, targeted up), then `silent`; after (4), revert the removal PR first. The cutover decision, the silent-parallel-run decision, the runbook and the package README carry the new order.
