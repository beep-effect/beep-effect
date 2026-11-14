---
title: "Cost controls adopts nine account singletons (D20)"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "Remove the singleton declarations from the stack: retain leaves every live setting untouched; drop adopt(true) on the monitor and remove its alchemy:: tags with aws ce untag-resource."
---

D20 per-object adoption list for the `CostControls` stack. Nine live account objects are adopted, not recreated; none has a greenfield name.

| Logical id | Resource type | Live object | Adoption path |
| --- | --- | --- | --- |
| `AppTag` | `BeepAWS.CostExplorer.CostAllocationTag` | tag key `App` (Active) | silent: `read` returns plain attributes |
| `BeepCiTag` | same | tag key `beep-ci` (Active) | silent |
| `DataClassTag` | same | tag key `DataClass` (Active) | silent |
| `GhrEnvironmentTag` | same | tag key `ghr:environment` (Active) | silent |
| `ManagedByTag` | same | tag key `ManagedBy` (Active) | silent |
| `ProjectTag` | same | tag key `Project` (Active) | silent |
| `ComputeOptimizer` | `BeepAWS.ComputeOptimizer.Enrollment` | account enrollment (Active, member accounts off) | silent |
| `CostOptimizationHub` | `BeepAWS.CostOptimizationHub.Enrollment` | account enrollment (Active, member accounts off) | silent |
| `AccountServicesMonitor` | `AWS.CostExplorer.AnomalyMonitor` (`prod` only) | `arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460`, name `beep-account-services` | `adopt(true)` on this resource only; the deploy adds the `alchemy::*` ownership tags |

The eight `@beep/alchemy-aws-extras` singletons default to `retain`: removing one from the stack or destroying the stack leaves the account setting alone (hermetic test "removing the singletons from the stack deletes nothing"). Their reconcile writes only when the live status differs from the declared `Active`, which it does not today (read 2026-11-13). The monitor is retained in every stage that declares it. Because the monitor is adopted, the Pulumi cutover removes it from Pulumi state instead of destroying it.

Gotcha: an attended `pulumi up --refresh` of `beep-ci-runners/production` before the cutover would see the new `alchemy::*` tags on the monitor as drift and remove them; the next Alchemy read then reports it `Unowned` again and `adopt(true)` re-adopts it. No Pulumi update runs during the CI measurement window, and the cutover removes the monitor from Pulumi state.
