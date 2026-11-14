---
title: "Cost controls cutover from Pulumi: destroy two URNs, state-delete eleven, no pulumi up"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "Before the program PR: pulumi stack import --stack production --file ~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-13.json (or a newer export), then pulumi up --target the budget and subscription URNs."
---

Rulings (packet gate session, 2026-11-14): the PR that removes the `AccountCostControls` component from the Pulumi program must merge before any later `pulumi preview` or `pulumi up` of `beep-ci-runners/production`, and it keeps `accountCostControls:notificationEmailAddresses` for the turbo-cache throttle alarm. The runner fleet and the AWS turbo cache in that stack are under a CI measurement window until the 2026-11-20 verdict, so every Pulumi step below is state-only or target-only, and the packet gate session tells the orchestrator before running them. The passphrase comes only through `op run` from the 1Password field `PULUMI_ENCRYPTION_PASSPHRASE` of item `BEEP_SECRETS` in vault `BEEP_SECRETS` (verified by the gate 2026-11-14); it never goes in a file, an argument or a log.

Procedure for the launching session; this lane ran none of it except the export. It touches only the `AccountCostControls` subtree of `beep-ci-runners/production` (backend `s3://oip-law-pulumi-state`, secrets provider `passphrase`), never runs the program (`pulumi destroy` and the `pulumi state` commands read state only; never pass `--run-program`), and needs no `pulumi up`. The same stack holds the live runner fleet and the AWS turbo cache, and a CI measurement window is running: no other URN is named, and `pulumi destroy` runs only with explicit `--target`s and without `--target-dependents`.

Archive: `pulumi stack export --stack production` taken 2026-11-13 at `~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-13.json` (3,396,936 bytes, sha256 `2c5933f882423d165f2a7469d85131305369bedf3d4ec8ef44dccc567291d00c`, deployment version 4, last update 2026-11-13T13:44:48-06:00, 367 resources, 0 pending operations). Re-export immediately before step 1 if the stack's last update is newer than that, and record the new file's size and sha256 in a follow-up decision; the newest export is the reversal.

URNs (13: eleven live resources, the component's AWS provider, the component). Every one but the component is `protect: true`; tags and enrollments are also `retainOnDelete`.

| # | Object | URN | Step |
| --- | --- | --- | --- |
| 1 | budget `Monthly Budget` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:budgets/budget:Budget::account-cost-controls-monthly` | destroy |
| 2 | subscription `beep-account-daily-anomalies` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalySubscription:AnomalySubscription::account-cost-controls-daily-anomalies` | destroy |
| 3 | monitor `beep-account-services` (adopted by Alchemy) | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalyMonitor:AnomalyMonitor::account-cost-controls-service-monitor` | state delete |
| 4 | tag `App` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-App` | state delete |
| 5 | tag `beep-ci` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-beep-ci` | state delete |
| 6 | tag `DataClass` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-DataClass` | state delete |
| 7 | tag `ghr:environment` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ghr:environment` | state delete |
| 8 | tag `ManagedBy` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ManagedBy` | state delete |
| 9 | tag `Project` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-Project` | state delete |
| 10 | Compute Optimizer enrollment | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:computeoptimizer/enrollmentStatus:EnrollmentStatus::account-cost-controls-compute-optimizer` | state delete |
| 11 | Cost Optimization Hub enrollment | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costoptimizationhub/enrollmentStatus:EnrollmentStatus::account-cost-controls-optimization-hub` | state delete |
| 12 | component AWS provider | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$pulumi:providers:aws::account-cost-controls-aws` | state delete |
| 13 | component | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls::account-cost-controls` | state delete |

Why state delete for 3-11: a Pulumi delete of a tag deactivates it, of an enrollment opts the account out, and of the monitor deletes the account's only services monitor that Alchemy now owns. Only the budget and the subscription, which Alchemy replaced under new names, are destroyed.

Preconditions: the first `prod` deploy of `CostControls` is green including its verify step; `alchemy plan --stage prod` in CI shows no create or replace; `aws ce list-tags-for-resource` on the monitor shows `alchemy::stack=CostControls`; the orchestrator has been told the Pulumi steps are about to run.

Environment, from `infra/ci-runners` (single quotes: URNs contain `$` and `:`):

```sh
cd infra/ci-runners
export AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1 PULUMI_BACKEND_URL=s3://oip-law-pulumi-state
U1='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:budgets/budget:Budget::account-cost-controls-monthly'
U2='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalySubscription:AnomalySubscription::account-cost-controls-daily-anomalies'
U3='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalyMonitor:AnomalyMonitor::account-cost-controls-service-monitor'
U4='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-App'
U5='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-beep-ci'
U6='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-DataClass'
U7='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ghr:environment'
U8='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ManagedBy'
U9='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-Project'
U10='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:computeoptimizer/enrollmentStatus:EnrollmentStatus::account-cost-controls-compute-optimizer'
U11='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costoptimizationhub/enrollmentStatus:EnrollmentStatus::account-cost-controls-optimization-hub'
U12='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$pulumi:providers:aws::account-cost-controls-aws'
U13='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls::account-cost-controls'
```

1. Unprotect, state only, URNs 1-12:

   ```sh
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi state unprotect --stack production --yes "$U1" "$U2" "$U3" "$U4" "$U5" "$U6" "$U7" "$U8" "$U9" "$U10" "$U11" "$U12"
   ```

   Check: `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi stack export --stack production | jq '[.deployment.resources[] | select(.urn|test("AccountCostControls")) | .protect // false] | any'` prints `false`, and `| jq '.deployment.resources|length'` still prints 367.
2. Destroy the old budget and subscription, preview first:

   ```sh
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi destroy --stack production --target "$U1" --target "$U2" --preview-only
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi destroy --stack production --target "$U1" --target "$U2" --yes
   ```

   The preview must show exactly 2 deletes, both named above, nothing else; never add `--target-dependents` or `--run-program`. Check: `aws budgets describe-budgets --account-id 832907639880 --query 'Budgets[].BudgetName'` lists `beep-account-monthly-cost` and not `Monthly Budget`; `aws ce get-anomaly-subscriptions --query 'AnomalySubscriptions[].SubscriptionName'` lacks `beep-account-daily-anomalies`; `aws ce get-anomaly-monitors` still lists `beep-account-services`.
3. State delete, URN 3 first (its dependent, URN 2, is gone), then 4-11, then 12, then 13:

   ```sh
   for u in "$U3" "$U4" "$U5" "$U6" "$U7" "$U8" "$U9" "$U10" "$U11" "$U12" "$U13"; do
     PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi state delete --stack production --yes "$u" || break
   done
   ```

   Check after the loop: no `AccountCostControls` URN in the export and 354 resources; `aws` reads unchanged (six tags Active, both enrollments Active, monitor present).
4. Flip `notifications` to `live` in the `prod` configuration (`packages/tooling/infra/cost-controls/src/Config.ts`) in one PR; the `COST_CONTROLS_NOTIFICATION_EMAILS` environment secret was already set in the bootstrap step (deploy-role decision). Its deploy adds the budget notifications and creates `beep-account-anomaly-alerts`. Check: `aws budgets describe-notifications-for-budget --account-id 832907639880 --budget-name beep-account-monthly-cost` lists four notifications; the subscription exists on the monitor's ARN with threshold 10.
5. In a later PR, delete `AccountCostControls` from `infra/src/internal/ci-runners-entry.ts`, `infra/src/AccountCostControls.ts` and its test, and the `accountCostControls:` keys from `Pulumi.production.yaml` except `notificationEmailAddresses`, which the turbo-cache throttle alarm keeps reading. That PR merges before the next `pulumi preview` or `up` of this stack: until then the program still declares the component, and a preview would plan to create all eleven resources again (the monitor create would hit the one-per-account quota). After it, the recipient list lives in two places only: that Pulumi config key and the `cost-controls-prod` GitHub secret.

Rollback: before step 5, `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi stack import --stack production --file <newest archive>` restores the subtree as exported (other resources too, so import only if no other update ran since the export; otherwise re-add single objects with `pulumi import`). Then `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi up --stack production --target "$U1" --target "$U2"` recreates `Monthly Budget` and `beep-account-daily-anomalies`, the Alchemy prod stage goes back to `silent`, and `aws budgets delete-budget --account-id 832907639880 --budget-name beep-account-monthly-cost` removes the retained Alchemy budget. The singletons need nothing: neither tool changed their status.
