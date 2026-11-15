---
title: "Cost controls deploys through a stack-scoped OIDC role, beep-alchemy-cost-controls-deploy"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-cost-controls"
reversal: "gh secret delete COST_CONTROLS_NOTIFICATION_EMAILS --env cost-controls-prod --repo beep-effect/beep-effect; aws iam delete-role-policy --role-name beep-alchemy-cost-controls-deploy --policy-name cost-controls-deploy; aws iam delete-role --role-name beep-alchemy-cost-controls-deploy; gh api -X DELETE repos/beep-effect/beep-effect/environments/cost-controls-prod."
---

Created 2026-11-14 by the packet gate session from the commands below, run as written (policy files in a scratch directory, deleted afterwards), before this lane's PR opened. Receipts: role `arn:aws:iam::832907639880:role/beep-alchemy-cost-controls-deploy` with inline policy `cost-controls-deploy`; `aws iam simulate-principal-policy` for `budgets:ModifyBudget` returns `implicitDeny` on the Pulumi budget `Monthly Budget` and `allowed` on `beep-account-monthly-cost`; GitHub environment `cost-controls-prod` with a `main`-only branch policy; environment variable `COST_CONTROLS_DEPLOY_ROLE_ARN` set; environment secret `COST_CONTROLS_NOTIFICATION_EMAILS` set from the encrypted Pulumi config, its shape checked only (one line, contains an `@`, no spaces). This lane created nothing. The shared role `beep-alchemy-state-rw` stays state-only; the `CostControls` stack takes its own GitHub OIDC deploy role, `beep-alchemy-cost-controls-deploy`, and its workflow assumes only that role (state access included), as `vars.COST_CONTROLS_DEPLOY_ROLE_ARN` on the `cost-controls-prod` environment.

Trust: the existing provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, subject exactly `repo:beep-effect/beep-effect:environment:cost-controls-prod`. Session length one hour.

Permissions, inline policy `cost-controls-deploy`, least privilege for what the five providers and the post-deploy check call:

- Budgets (global service; budget ARNs carry no region): `budgets:ViewBudget` on `arn:aws:budgets::832907639880:budget/*` (DescribeBudget and DescribeBudgets, the latter for the verify step); `budgets:ModifyBudget`, `budgets:TagResource`, `budgets:UntagResource`, `budgets:ListTagsForResource` only on `arn:aws:budgets::832907639880:budget/beep-account-monthly-cost`. ModifyBudget covers create, update, delete and every notification and subscriber call. The Pulumi budget `Monthly Budget` stays out of reach.
- Cost Explorer anomaly detection (global, `us-east-1` endpoint): `ce:GetAnomalyMonitors`, `ce:GetAnomalySubscriptions`, `ce:CreateAnomalySubscription` on `*` (list and create take no resource ARN); `ce:UpdateAnomalyMonitor`, `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` on the adopted monitor `arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460`; `ce:UpdateAnomalySubscription`, `ce:DeleteAnomalySubscription`, `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` on `arn:aws:ce::832907639880:anomalysubscription/*`. No `ce:CreateAnomalyMonitor` and no `ce:DeleteAnomalyMonitor`: the monitor is adopted and retained.
- Cost allocation tags: `ce:ListCostAllocationTags`, `ce:UpdateCostAllocationTagsStatus` on `*`.
- Compute Optimizer (regional API, called in `us-east-1`): `compute-optimizer:GetEnrollmentStatus`, `compute-optimizer:UpdateEnrollmentStatus` on `*`.
- Cost Optimization Hub (`us-east-1` only): `cost-optimization-hub:ListEnrollmentStatuses`, `cost-optimization-hub:UpdateEnrollmentStatus` on `*`.
- No `iam:CreateServiceLinkedRole`: both service-linked roles exist (both services are enrolled), and the reconcile writes only on a status change. A re-enrollment after an opt-out would fail loudly and need that permission added on purpose.
- State store: `s3:ListBucket`, `s3:GetBucketLocation`, `s3:GetBucketVersioning`, `s3:GetBucketOwnershipControls`, `s3:GetBucketPublicAccessBlock`, `s3:GetEncryptionConfiguration` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an`; `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/CostControls/*` only. No bucket-configuration writes: the store is operator-bootstrapped, and the plan step fails on an outdated store instead of repairing it. The AWS-managed `aws/s3` key authorizes S3 use for account principals, so no KMS statement.

Commands as run by the packet gate session (operator workstation, `AWS_PROFILE=elpresidank-vault`), then the GitHub side:

```sh
export AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1
D="$(mktemp -d)"
cat > "$D/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com","token.actions.githubusercontent.com:sub":"repo:beep-effect/beep-effect:environment:cost-controls-prod"}}}]}
JSON
cat > "$D/policy.json" <<'JSON'
{"Version":"2012-10-17","Statement":[
{"Sid":"BudgetsRead","Effect":"Allow","Action":["budgets:ViewBudget"],"Resource":"arn:aws:budgets::832907639880:budget/*"},
{"Sid":"BudgetOwned","Effect":"Allow","Action":["budgets:ModifyBudget","budgets:TagResource","budgets:UntagResource","budgets:ListTagsForResource"],"Resource":"arn:aws:budgets::832907639880:budget/beep-account-monthly-cost"},
{"Sid":"AnomalyRead","Effect":"Allow","Action":["ce:GetAnomalyMonitors","ce:GetAnomalySubscriptions","ce:CreateAnomalySubscription"],"Resource":"*"},
{"Sid":"AnomalyMonitorAdopted","Effect":"Allow","Action":["ce:UpdateAnomalyMonitor","ce:TagResource","ce:UntagResource","ce:ListTagsForResource"],"Resource":"arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460"},
{"Sid":"AnomalySubscriptions","Effect":"Allow","Action":["ce:UpdateAnomalySubscription","ce:DeleteAnomalySubscription","ce:TagResource","ce:UntagResource","ce:ListTagsForResource"],"Resource":"arn:aws:ce::832907639880:anomalysubscription/*"},
{"Sid":"CostAllocationTags","Effect":"Allow","Action":["ce:ListCostAllocationTags","ce:UpdateCostAllocationTagsStatus"],"Resource":"*"},
{"Sid":"Enrollments","Effect":"Allow","Action":["compute-optimizer:GetEnrollmentStatus","compute-optimizer:UpdateEnrollmentStatus","cost-optimization-hub:ListEnrollmentStatuses","cost-optimization-hub:UpdateEnrollmentStatus"],"Resource":"*"},
{"Sid":"StateBucketRead","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:GetBucketVersioning","s3:GetBucketOwnershipControls","s3:GetBucketPublicAccessBlock","s3:GetEncryptionConfiguration"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an"},
{"Sid":"StateObjects","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/CostControls/*"}]}
JSON
aws iam create-role --role-name beep-alchemy-cost-controls-deploy \
  --assume-role-policy-document "file://$D/trust.json" --max-session-duration 3600 \
  --description "GitHub OIDC deploy role for the CostControls Alchemy stack (cost-controls-prod)" \
  --tags Key=beep:owner,Value=infra-alchemy-rebuild Key=beep:bootstrap,Value=cost-controls-deploy
aws iam put-role-policy --role-name beep-alchemy-cost-controls-deploy \
  --policy-name cost-controls-deploy --policy-document "file://$D/policy.json"
aws iam get-role --role-name beep-alchemy-cost-controls-deploy --query Role.Arn --output text
rm -r "$D"

gh api -X PUT repos/beep-effect/beep-effect/environments/cost-controls-prod \
  -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/beep-effect/beep-effect/environments/cost-controls-prod/deployment-branch-policies \
  -f name=main -f type=branch
gh variable set COST_CONTROLS_DEPLOY_ROLE_ARN --env cost-controls-prod \
  --body arn:aws:iam::832907639880:role/beep-alchemy-cost-controls-deploy
```

Recipient secret, same bootstrap step, before the switch to `live` (ruling, packet gate session, 2026-11-14: no new 1Password field; the list already lives encrypted in the Pulumi stack config, and the gate verified on 2026-11-14 that it decrypts to a one-recipient list). From `infra/ci-runners`, without printing it:

```sh
cd infra/ci-runners
AWS_PROFILE=elpresidank-vault PULUMI_BACKEND_URL=s3://oip-law-pulumi-state \
PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- \
  pulumi config get accountCostControls:notificationEmailAddresses --stack production \
  | jq -r 'join(",")' | tr -d '\n' \
  | gh secret set COST_CONTROLS_NOTIFICATION_EMAILS --env cost-controls-prod --repo beep-effect/beep-effect
gh secret list --env cost-controls-prod --repo beep-effect/beep-effect   # names only
```

After the Pulumi component leaves the program (cutover step 5), this GitHub secret is the only copy of the list besides the Pulumi config key the turbo-cache throttle alarm keeps.

Checks after creation: `aws iam simulate-principal-policy` for `budgets:ModifyBudget` on `budget/Monthly Budget` must say `implicitDeny`, and on `budget/beep-account-monthly-cost` `allowed`. Like the state role, the role and environment are bootstrap singletons until `@beep/infra-ci-runners` and `@beep/infra-github` adopt them (D20).
