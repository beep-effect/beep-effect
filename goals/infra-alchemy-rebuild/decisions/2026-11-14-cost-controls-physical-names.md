---
title: "Cost controls: new pinned names for budget and subscription; the services monitor is adopted"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "Rename the budget and subscription in packages/tooling/infra/cost-controls/src/CostControls.ts (a rename replaces them); to recreate the monitor instead, the Pulumi-owned one must be deleted first (one per account)."
---

The `CostControls` stack (`packages/tooling/infra/cost-controls`, D5) replaces the Pulumi `AccountCostControls` component of `beep-ci-runners/production`. Its two named, greenfield resources get new physical names pinned in source for `prod`, so no deploy depends on a state-held instance id (the #3133 lesson), and they run beside the Pulumi-owned ones until the cutover (D12):

| Logical id | Resource | `prod` name | Pulumi name it runs beside |
| --- | --- | --- | --- |
| `MonthlyBudget` | `AWS.Budgets.Budget` | `beep-account-monthly-cost` | `Monthly Budget` |
| `AnomalyAlerts` | `AWS.CostExplorer.AnomalySubscription` | `beep-account-anomaly-alerts` | `beep-account-daily-anomalies` |

Both names differ from the live ones on purpose: the Budget provider's `read` returns plain attributes, so a same-name budget would be adopted silently. A personal stage suffixes the budget with the stage (`beep-account-monthly-cost-dev_<user>`) and declares no subscription.

The third named resource cannot be greenfield. AWS allows one `DIMENSIONAL` / `SERVICE` ("AWS services") anomaly monitor per account (Cost Management quotas page; the live account has exactly one, `beep-account-services`), so a second monitor beside the Pulumi one would fail `CreateAnomalyMonitor` with a quota error, and the plan cannot show that because plan never calls create. The monitor therefore joins the adopted singletons (next decision): `prod` declares `AccountServicesMonitor` with the live name `beep-account-services`, `AdoptPolicy.adopt(true)` on that one resource (its `read` reports `Unowned` because it carries no Alchemy tags) and `RemovalPolicy.retain()`. Adoption also keeps the monitor's detection history. Personal stages do not declare it, nor any other account singleton, so a dev stage never adopts the account's only services monitor or any tag or enrollment.

Budget retention: `RemovalPolicy.retain(stage === "prod")`, the Alchemy form of the Pulumi `protect: true`, so a stack destroy cannot remove the account budget. The subscription is destroy-on-delete like any owned resource.
