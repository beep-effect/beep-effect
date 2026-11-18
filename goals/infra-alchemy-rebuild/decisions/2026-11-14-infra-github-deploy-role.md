---
title: "InfraGithub deploys through a stack-scoped OIDC role, beep-alchemy-infra-github-deploy"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "gh variable delete ALCHEMY_STATE_ROLE_ARN --env infra-github-prod --repo beep-effect/beep-effect; aws iam delete-role-policy --role-name beep-alchemy-infra-github-deploy --policy-name infra-github-deploy; aws iam delete-role --role-name beep-alchemy-infra-github-deploy"
---

Ruling by the packet gate session, 2026-11-14: like the other stacks' deploy jobs, `Deploy infra-github` assumes a stack-scoped role, not the shared `beep-alchemy-state-rw`. The variable name (`ALCHEMY_STATE_ROLE_ARN` on `infra-github-prod`) and the workflow do not change; only the role it names does. The runbook step that added `repo:beep-effect/beep-effect:environment:infra-github-prod` to the trust policy of `beep-alchemy-state-rw` is dropped. The role is not created yet; the commands below are for the bootstrap, on the gate's word.

What the store code touches (read at Alchemy 2.0.0-beta.87; `AWS.state({ backend: "s3", … })` in `alchemy.run.ts` sets no `prefix`; the stack name is `InfraGithub`):

- Bucket `alchemy-state-832907639880-us-east-1-an` (`createStateBucketName(accountId, region)`).
- Bucket configuration, `ensureStateBucket` in `@alchemy.run/aws` `src/StateStore/State.ts`. It calls `headBucket` (`s3:ListBucket`), then reads versioning, encryption, the public access block and ownership controls. It writes them only on drift. Under this role a drift therefore fails the deploy instead of being converged, which is the intended fail-closed behavior: the bucket is a bootstrap singleton.
- Objects, `makeBucketState` in `alchemy` `src/State/BucketState.ts`. Every key is `{prefix}{stack}/{stage}/…`, so `InfraGithub/prod/{fqn}.json`, `InfraGithub/prod/__stack_output__.json` and `InfraGithub/prod/__lease__.json`:
  - reads: `GetObject`;
  - writes: `PutObject`, including the conditional lease write;
  - deletes: `DeleteObject` and the batch `DeleteObjects`, which S3 authorizes as `s3:DeleteObject` per key; stale rows and the lease release.
- Listings (`ListObjectsV2`, `s3:ListBucket`) use the stage prefix. Stack and stage enumeration lists bucket-level names but reads no object.
- No key outside `InfraGithub/` is read, written or deleted.
- Encryption is SSE-KMS with the AWS-managed `aws/s3` key. Its key policy grants use through S3 to principals in the account, so the role needs no KMS statement.

Trust: the existing provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, subject exactly `repo:beep-effect/beep-effect:environment:infra-github-prod`. Session length one hour.

Commands (operator workstation, `AWS_PROFILE=elpresidank-vault`), then the GitHub side:

```sh
export AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1
D="$(mktemp -d)"
cat > "$D/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com","token.actions.githubusercontent.com:sub":"repo:beep-effect/beep-effect:environment:infra-github-prod"}}}]}
JSON
cat > "$D/policy.json" <<'JSON'
{"Version":"2012-10-17","Statement":[
{"Sid":"StateBucketRead","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:GetBucketVersioning","s3:GetBucketOwnershipControls","s3:GetBucketPublicAccessBlock","s3:GetEncryptionConfiguration"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an"},
{"Sid":"StateObjects","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/InfraGithub/*"}]}
JSON
aws iam create-role --role-name beep-alchemy-infra-github-deploy \
  --assume-role-policy-document "file://$D/trust.json" --max-session-duration 3600 \
  --description "GitHub OIDC deploy role for the InfraGithub Alchemy stack (infra-github-prod)" \
  --tags Key=beep:owner,Value=infra-alchemy-rebuild Key=beep:bootstrap,Value=infra-github-deploy
aws iam put-role-policy --role-name beep-alchemy-infra-github-deploy \
  --policy-name infra-github-deploy --policy-document "file://$D/policy.json"
aws iam get-role --role-name beep-alchemy-infra-github-deploy --query Role.Arn --output text
rm -r "$D"

gh variable set ALCHEMY_STATE_ROLE_ARN --env infra-github-prod --repo beep-effect/beep-effect \
  --body arn:aws:iam::832907639880:role/beep-alchemy-infra-github-deploy
```

Checks after creation (`aws iam simulate-principal-policy --policy-source-arn <role arn>`):
- `s3:PutObject` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/InfraGithub/prod/x.json` must say `allowed`;
- `s3:PutObject` on `…/CostControls/prod/x.json` must say `implicitDeny`;
- `s3:PutBucketVersioning` on the bucket must say `implicitDeny`.

The role is a bootstrap singleton, like the state role, until `@beep/infra-ci-runners` adopts the OIDC roles.
