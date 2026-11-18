---
title: "Cost controls Pulumi cutover executed: live verified, old pair destroyed, 11 state entries removed"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls-pulumi-removal"
reversal: "The 'after step 4' and 'after step 6' rollback paragraphs of decision 'Cost controls cutover from Pulumi' (import the BEFORE archive, refresh, preview two creates, targeted up; revert the removal PR first if it has merged)."
---

Executed by the packet gate session, attended with the orchestrator, on 2026-11-14, in the live-first order (decision "Cost controls cutover goes live first, Pulumi destroy second"). Facts from the gate session.

**Live deploy (steps 1 and 2).** #3320 merged 2026-11-14T05:15:40Z as `1f34884a98c`; `Deploy cost controls` run 43560670140 succeeded. Plan `1 to create, 1 to update` (`AnomalyAlerts` create, `MonthlyBudget` update), the nine singletons `noop`, the pre-deploy gate printed `deploy may run`. Account read afterwards: four budget notifications with one EMAIL subscriber each, `beep-account-anomaly-alerts` DAILY, budget actions 0.

**Pulumi cutover (steps 3 to 5) on `beep-ci-runners/production`.**

- BEFORE export 05:20Z: 367 resources, 3,396,936 bytes, sha256 `2c5933f882423d165f2a7469d85131305369bedf3d4ec8ef44dccc567291d00c`, byte-identical to the 2026-11-13 archive.
- Unprotect 05:20:47Z: 12 resources.
- Targeted destroy preview: exactly 2 deletes (JSON step list `delete=2, same=1`); no `--target-dependents`, no `--refresh`, no `--run-program`. Real destroy 05:22:15Z to 05:22:20Z: 2 deleted (`Monthly Budget`, `beep-account-daily-anomalies`).
- State deletes 05:22:55Z to 05:23:19Z: 11, each rc 0.
- AFTER export 05:24Z: 354 resources, 3,329,126 bytes, sha256 `07fb8a58b4187a51bc1eca31e64f60e7dea395d980ec2bc7f26427de9314b326`, 0 pending operations.
- Comparison: BEFORE minus AFTER is exactly the 13 `AccountCostControls` URNs; nothing added. The other 354 resources are content-identical apart from three serialization effects of the CLI's state rewrite: 75 secret fields re-encrypted; empty-list entries dropped from `propertyDependencies` on 82 resources (non-empty entries and `dependencies` identical); 27 resources reordered in the snapshot list with 0 dangling and 0 out-of-order references.
- `shard-overflow-preflight` ok at 05:24:47Z. Account after: budget `beep-account-monthly-cost` only, subscription `beep-account-anomaly-alerts` only, the services monitor present, six tags Active, both enrollments Active.

**Freeze.** A freeze on `pulumi preview` and `pulumi up` for `beep-ci-runners/production` started 2026-11-14T05:22:55Z and ends after the component-removal PR (step 6, this lane) merges and `pulumi preview --expect-no-changes --stack organization/beep-ci-runners/production` is clean: until then the program still declares the component, and a preview would plan all thirteen objects again.

**Step 6.** The component-removal PR deletes `AccountCostControls` from the program (`infra/src/internal/ci-runners-entry.ts`, infra/src/AccountCostControls.ts (removed in #3366) and its test) and the `accountCostControls:` keys `expectedAccountId`, `monthlyBudgetUsd` and `anomalyImpactUsd` from `infra/ci-runners/Pulumi.production.yaml`. It keeps `accountCostControls:notificationEmailAddresses` and moves `decodeNotificationRecipients` unchanged into `infra/src/NotificationRecipients.ts`, because the AWS turbo cache's throttle alarm reads both. With the 13 URNs already gone from state, the program's desired graph after this PR equals the AFTER state, so the diff against the stack is nothing; `preview` being frozen, that is proven by reading the program diff (only the component's import and construction removed; every other declaration and the alarm's config read untouched). It merges only after `live` has been green for 24 hours (not before 2026-11-15T05:18Z).

**Archives.** Both exports stay under `~/.local/state/beep/infra-archives/pulumi-exports/` until this PR has merged and `pulumi preview --expect-no-changes` on the stack is clean.
