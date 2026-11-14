---
title: "OipWeb bootstrap: deploy role, environment, secrets and the Cloudflare grant"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "gh variable delete OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect; gh api -X DELETE repos/beep-effect/beep-effect/environments/oip-web-infra-prod; aws iam delete-role-policy --role-name beep-alchemy-oip-web-deploy --policy-name oip-web-deploy; aws iam delete-role --role-name beep-alchemy-oip-web-deploy; remove the oip.law and opip.law DNS grant from the Alchemy Cloudflare token."
---

Ruled by the packet gate session, 2026-11-14: it runs these commands itself when the PR is about to open; no lane runs them. `@beep/infra-github` adopts the environment, variable and secrets when it lands (D20). Run on the operator workstation with the aws-vault session alive; values are piped from 1Password and never printed.

**1. Deploy role** (least privilege on the shared state store, matching the cost-controls deploy role: bucket-level reads only, object read, write and delete under the stack's own `OipWeb/` prefix; every action on the two assets buckets, `s3:DeleteBucket` denied on them). The packet gate session created it 2026-11-14 05:10Z with this policy. No bucket-config writes are needed because the plan step fails on a missing or outdated store; every object a deploy touches is `OipWeb/<stage>/...` (resource rows, `__stack_output__.json`, `__lease__.json`; the store version is a code constant, and bucket-policy calls exist only in `alchemy state migrate`):

```sh
export AWS_PROFILE=elpresidank-vault
d="$HOME/.cache/beep/oip-web-bootstrap"; mkdir -p "$d"
cat > "$d/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com","token.actions.githubusercontent.com:sub":"repo:beep-effect/beep-effect:environment:oip-web-infra-prod"}}}]}
JSON
cat > "$d/policy.json" <<'JSON'
{"Version":"2012-10-17","Statement":[
 {"Sid":"StateBucketRead","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:GetBucketVersioning","s3:GetBucketOwnershipControls","s3:GetBucketPublicAccessBlock","s3:GetEncryptionConfiguration"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an"},
 {"Sid":"StateObjects","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/OipWeb/*"},
 {"Sid":"AssetsBuckets","Effect":"Allow","Action":"s3:*","Resource":["arn:aws:s3:::oip-law-web-assets-prod","arn:aws:s3:::oip-law-web-assets-prod/*","arn:aws:s3:::oip-law-web-assets-staging","arn:aws:s3:::oip-law-web-assets-staging/*"]},
 {"Sid":"NeverDeleteAssetsBuckets","Effect":"Deny","Action":"s3:DeleteBucket","Resource":["arn:aws:s3:::oip-law-web-assets-prod","arn:aws:s3:::oip-law-web-assets-staging"]}
]}
JSON
aws iam create-role --role-name beep-alchemy-oip-web-deploy \
  --assume-role-policy-document "file://$d/trust.json" \
  --tags Key=beep:owner,Value=infra-alchemy-rebuild Key=beep:stack,Value=OipWeb
aws iam put-role-policy --role-name beep-alchemy-oip-web-deploy \
  --policy-name oip-web-deploy --policy-document "file://$d/policy.json"
aws iam get-role --role-name beep-alchemy-oip-web-deploy --query Role.Arn --output text
```

**2. Environment, branch policy, variable and secrets:**

```sh
R=beep-effect/beep-effect; E=oip-web-infra-prod
gh api -X PUT "repos/$R/environments/$E" \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST "repos/$R/environments/$E/deployment-branch-policies" -f name=main -f type=branch
gh variable set OIP_WEB_DEPLOY_ROLE_ARN --env "$E" -R "$R" \
  --body arn:aws:iam::832907639880:role/beep-alchemy-oip-web-deploy
op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN | gh secret set VERCEL_TOKEN --env "$E" -R "$R"
op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN | gh secret set CLOUDFLARE_API_TOKEN --env "$E" -R "$R"
op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID | gh secret set CLOUDFLARE_ACCOUNT_ID --env "$E" -R "$R"
op read op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY | gh secret set CRM_HUBSPOT_SERVICE_KEY --env "$E" -R "$R"
gh variable list --env "$E" -R "$R"; gh secret list --env "$E" -R "$R"
```

One `CRM_HUBSPOT_SERVICE_KEY` secret serves both stages: the packet gate session verified that the token equals the value both Pulumi stacks held. The repository variable `OIP_WEB_INFRA_DEPLOY` is not part of the bootstrap; arming is the separate deploy act in the window-5 decision (`gh variable set OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect --body enabled`, after the token re-check and after telling the orchestrator the time).

**3. Cloudflare grant on the Alchemy token** (`op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`; never the account IaC token). The six records live in zones `oip.law` (id `144f81bdbe12b3a7530cdcc8d56b13cc`: `oip.law` A, `www.oip.law` CNAME, `staging.oip.law` CNAME) and `opip.law` (id `0d26e874202f4579081926dc38b3bf80`: `opip.law` A, `www.opip.law` CNAME, `staging.opip.law` CNAME). The token already reads both zones (`GET /zones/{zone_id}` returned 200) and is refused on their records (403). The first `prod` and `staging` deploys call, per record, `GET /zones/{zone_id}/dns_records?name.exact=<name>&type=<type>` at plan time and again in reconcile, and nothing else: content, TTL, proxy flag and the declared comment (`Managed by Pulumi for oip.law Vercel routing.`, the live text) all match, so the provider skips `PUT /zones/{zone_id}/dns_records/{id}`. `GET /zones/{zone_id}` is called only when a name lookup finds nothing. Needed now: **Zone · DNS · Read** (API permission group `DNS Read`) on both zones. Needed for any later record change (rewording the comment, a content change, a removal): **Zone · DNS · Edit** (API `DNS Write`) on the same zones. **Zone · Zone · Read** (API `Zone Read`) is already granted. Declaring no comment would not be a pure read: the provider then sends its default `Managed by Alchemy (<fqn>)`, which differs from the live comment and triggers the `PUT`.

Checks after the bootstrap: the role ARN prints; the one variable and four secret names list; with the widened token, `GET /zones/{zone_id}/dns_records` returns 200 on both zones.
