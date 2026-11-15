---
title: "Cost controls personal-stage plan: 1 create, no account singleton, no delete or replace; no spend"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "n/a (read-only plan record)"
---
Amended 2026-11-14 after beep-reviewer round 1 on #3310 (P2, relayed by the packet gate session): personal stages no longer declare any account singleton, so a workstation deploy cannot adopt or write an account-wide setting outside the workflow's pre-deploy gate. Re-measured the same day with the same read-only command (`bunx alchemy plan --stage dev_elpresidank --env-file /dev/null --no-input`): `Plan: 1 to create`, the only line `[MonthlyBudget] create`; the state bucket still held only `BeepEffectWeb/` and `Storybook/` afterwards. The `prod` graph is unchanged. The first measurement, kept below as history, planned `1 to create, 8 to adopted` because every stage then adopted the six tags and two enrollments.


Read-only `alchemy plan` for a personal stage against account 832907639880, from `packages/tooling/infra/cost-controls` on 2026-11-13, credentials from `eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`, `AWS_REGION=us-east-1`, `CI` unset: `bunx alchemy plan --stage dev_elpresidank --env-file /dev/null --no-input --detailed`. Exit 0, `Plan: 1 to create, 8 to adopted`, no delete, no replace, no update. No deploy ran; afterwards the state bucket still held only `BeepEffectWeb/` and `Storybook/`, and every live setting read the same as before.

| Plan line | Live state (read-only `aws` reads, same day) | Why |
| --- | --- | --- |
| `[MonthlyBudget] create`, `budgetName: beep-account-monthly-cost-dev_elpresidank`, limit 200 USD, cost types as Pulumi's, `notifications: []` | `aws budgets describe-budgets` lists one budget, `Monthly Budget` (200 USD, MTD $371.54) | new stage-suffixed name, nothing to read; silent phase, so no subscribers and no recipient variable read |
| `[AppTag]`, `[BeepCiTag]`, `[DataClassTag]`, `[GhrEnvironmentTag]`, `[ManagedByTag]`, `[ProjectTag]` `adopted`, no declared property changes | `aws ce list-cost-allocation-tags` for the six keys: all `Active`, `UserDefined` | `read` returns plain attributes; declared `Active` equals live, so the deploy would write nothing |
| `[ComputeOptimizer] adopted`, no changes | `aws compute-optimizer get-enrollment-status`: `Active`, member accounts off | same |
| `[CostOptimizationHub] adopted`, no changes | `aws cost-optimization-hub list-enrollment-statuses`: `Active`, member accounts off | same |
| no monitor, no subscription line | `aws ce get-anomaly-monitors`: one `DIMENSIONAL`/`SERVICE` monitor `beep-account-services`; `get-anomaly-subscriptions`: `beep-account-daily-anomalies`, daily, threshold 10 | by design a personal stage declares neither (the monitor is an account singleton adopted only by `prod`) |

Difference from the brief's expectation (three named creates): only the budget plans as a create. The eight tag and enrollment singletons and the anomaly monitor are `prod` only; the anomaly monitor cannot be created beside the live one (one services monitor per account) and is adopted by `prod`, and the subscription exists only in `prod`'s `live` phase. The `prod` plan, which exercises the monitor adoption, first runs as the workflow's plan step; it needs `CI=true` and, by the packet gate session's ruling of 2026-11-14, runs only in the workflow, never from a workstation. The hermetic tests cover it (`adopts the services monitor, keeps the budget silent and retains both`).

Spend: none. AWS Budgets monitoring budgets and their notifications are free (only action-enabled budgets beyond two cost $0.10/day; this budget has no actions, and the account's one existing budget has none either); Cost Anomaly Detection monitors and subscriptions are free, and no monitor is added; cost allocation tag activation, Compute Optimizer default enrollment (no enhanced infrastructure metrics) and Cost Optimization Hub enrollment are free. Basis: the AWS Budgets pricing page and the Cost Management quotas page, read 2026-11-13. The parallel period adds one free budget.
