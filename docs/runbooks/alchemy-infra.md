# Alchemy infrastructure: state store, CI identity, pins

Operating notes for every Alchemy stack in this repo: the app stacks beside
`apps/<app>/alchemy.run.ts` and the `@beep/infra-*` packages under
`packages/tooling/infra/`. Binding decisions: `explorations/pulumi-to-alchemy/DECISIONS.md`
(D1–D21) and `goals/infra-alchemy-rebuild/decisions/`.

## One state store

Every stack declares the same store:

```ts
import * as AWS from "@alchemy.run/aws";

const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});
```

- Bucket: the account-regional default, `alchemy-state-<accountId>-<region>-an`
  in `us-east-1`. Alchemy derives the name from the ambient account and region;
  nothing in the repo spells the account id.
- Encryption: SSE-KMS with the AWS-managed S3 key, S3 bucket keys on,
  customer-provided keys blocked. Redacted outputs sit in state as plain JSON,
  so the store is never AES256-only. A customer-managed key is a later
  `kmsMasterKeyId` edit; existing objects are not rewritten.
- Lease: the store leases each `<stack>/<stage>`; a second deploy of the same
  stage fails fast. CI concurrency groups per stack are the first guard, the
  lease the second.
- Layout: `s3://<bucket>/<Stack>/<stage>/<fqn>.json`, `__stack_output__.json`,
  `__lease__.json`. Inspect with `alchemy state list|read`, never with the S3
  console as a source of truth.

### Bootstrap (once per account, operator workstation)

Alchemy resolves AWS credentials from the process environment first
(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`,
`AWS_REGION`), then, only with `CI=true`, the same variables, and otherwise an
Alchemy profile. The repo never uses Alchemy profiles, and `AWS_PROFILE` alone
is not consulted, so export the aws-vault session into the environment first:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd apps/beep-effect-web
bunx alchemy state bootstrap --no-input
bunx alchemy state list --no-input   # first read creates a missing bucket outside CI
```

`export-credentials` runs the profile's `credential_process` (aws-vault) and
prints shell exports; `eval` keeps the values out of logs. Never `aws login`,
never `alchemy profile`. The store stays operator-bootstrapped by workflow
shape, not by `CI=true` alone: `alchemy plan` runs first and fails on a missing
or outdated store, while `deploy --yes` would create or upgrade it in CI
(`--yes` sets `updateStateStore`). Keep the plan step ahead of every deploy;
a missing or outdated store is an operator action, not a workflow retry.

Teardown is `alchemy state teardown --backend aws` after every stack has been
destroyed; the decision file that recorded the bootstrap carries the receipt.

## CI identity for the store

GitHub Actions assumes an IAM role through the account's GitHub OIDC provider
(`token.actions.githubusercontent.com`). Role `beep-alchemy-state-rw` may read
and write the state bucket and its bucket configuration, nothing else. Its
trust policy lists one subject per deploying environment, today
`repo:beep-effect/beep-effect:environment:beep-effect-web-prod` and
`repo:beep-effect/beep-effect:environment:storybook-prod`.

Workflow shape (see `.github/workflows/deploy-beep-effect-web.yml`):

```yaml
permissions:
  contents: read
  id-token: write
steps:
  - uses: aws-actions/configure-aws-credentials@<sha> # pinned
    with:
      role-to-assume: ${{ vars.ALCHEMY_STATE_ROLE_ARN }}
      role-session-name: alchemy-<stack>-prod
      aws-region: us-east-1
  - run: bunx alchemy plan --stage prod --env-file /dev/null $ADOPT
  - run: bunx alchemy deploy --stage prod --yes --env-file /dev/null $ADOPT
```

`ADOPT` is `--adopt` only on a one-time `workflow_dispatch` with `adopt: true`
(a state-store move); plan and deploy take the same adoption policy because a
plan without `--adopt` fails on an `Unowned` read before the deploy runs.

`ALCHEMY_STATE_ROLE_ARN` is an environment variable on each deploying GitHub
environment. `--env-file /dev/null` stops the CLI loading a stray `.env`.
Stacks that also manage AWS resources (cost controls, runner fleet) take a
stack-scoped deploy role; the state role stays state-only.

Adding a stack's environment: add its subject to the role trust policy and set
the variable on the environment. Both are bootstrap singletons until
`@beep/infra-ci-runners` adopts the provider and role (`adopt(true)`, one
decision file per object).

## Stacks

| Stack | Source | Workflow | Environment | Serves |
| --- | --- | --- | --- | --- |
| `BeepEffectWeb` | `apps/beep-effect-web/alchemy.run.ts` | `deploy-beep-effect-web.yml` | `beep-effect-web-prod` | `https://beep-effect.com` (custom domain, `www` redirect) |
| `Storybook` | `apps/storybook/alchemy.run.ts` | `deploy-storybook.yml` | `storybook-prod` | `https://beep-effect.com/storybook/` (zone route `beep-effect.com/storybook*` in front of the apex Worker) |
| `CostControls` | `packages/tooling/infra/cost-controls/alchemy.run.ts` | `deploy-cost-controls.yml` | `cost-controls-prod` | AWS account budget, services anomaly monitor and subscription, cost allocation tags, Compute Optimizer and Cost Optimization Hub enrollment |
| `OipWeb` | `apps/oip-web/alchemy.run.ts` | `deploy-oip-web-infra.yml` (armed by repo variable `OIP_WEB_INFRA_DEPLOY=enabled`) | `oip-web-infra-prod` | oip.law Vercel project settings, variables and domains, their Cloudflare DNS records, the assets buckets (stages `staging` then `prod`) |

Storybook is an assets-only Worker. Its build writes to `site/storybook` under the app
(`bun run storybook:build:site`), so each asset path carries the `/storybook` prefix the
route keeps on the request; the Worker has no script. The asset layer redirects
`/storybook` to `/storybook/` and `iframe.html` to `iframe`, keeping the query string. A
personal stage serves the same tree from its workers.dev URL under `/storybook/`:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd apps/storybook
CLOUDFLARE_API_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN \
CLOUDFLARE_ACCOUNT_ID=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID \
  op run -- bunx alchemy deploy --stage "dev_$USER" --yes --env-file /dev/null
```

Destroy it with the same command and `destroy` in place of `deploy`.

## Cost controls

`CostControls` (`@beep/infra-cost-controls`) replaces the Pulumi
`AccountCostControls` component of `beep-ci-runners/production`. Design and
resource table: the package README. Decisions:
`goals/infra-alchemy-rebuild/decisions/*-cost-controls-*.md`.

Deploy identity. The stack manages AWS resources, so it does not use the
state role. Its workflow assumes `beep-alchemy-cost-controls-deploy` (variable
`COST_CONTROLS_DEPLOY_ROLE_ARN` on `cost-controls-prod`), trusted only for
`repo:beep-effect/beep-effect:environment:cost-controls-prod`. The inline
policy allows the Budgets, Cost Explorer anomaly and cost-allocation-tag,
Compute Optimizer and Cost Optimization Hub calls the five providers make,
writes only the budget `beep-account-monthly-cost`, the adopted services
monitor and anomaly subscriptions, and reads and writes state objects only
under `CostControls/` in the state bucket. Budgets and Cost Explorer are
global services on the `us-east-1` endpoint; Cost Optimization Hub exists only
in `us-east-1`; the stack pins that region. Exact `aws iam` commands and their
reversal: decision "Cost controls deploys through a stack-scoped OIDC role".

Personal stage (plan only needs no recipients; the stage is always silent):

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/cost-controls
bunx alchemy plan --stage "dev_$USER" --env-file /dev/null
```

Expect one create, the stage-suffixed budget, and nothing else: personal
stages declare no account singleton, so only `prod` (CI, behind the
pre-deploy gate) adopts or writes the tags, enrollments and monitor. A
personal deploy creates a free budget with no notifications; `destroy`
deletes that budget.

Pre-deploy gate. Between plan and deploy, the workflow's "Check the plan
before deploy" step (`plan-check.ts`, tested in `test/PlanCheck.test.ts`)
fails the job unless the nine adopted account settings (six tags, two
enrollments, the services monitor) plan as adopt or no-op with no property
change, their live values equal the declared ones, and nothing plans a
delete or replace. If it fails, or if any plan ever shows a change to a
setting that touches EC2, Spot or Lambda concurrency, do not re-run or work
around it: the job has stopped before any deploy, and the next step is to ask
the CI goals driver through the orchestrator. The stack declares no budget
action, SCP, quota change or anomaly response (no enforcement without a new
ruling from the CI window owner).

Phases. `prod` ran `silent` beside the Pulumi budget and subscription (the
new budget without notifications, no new anomaly subscription) and is now
`live`: the budget carries its four notifications and `AnomalyAlerts` mails
the daily anomaly digest. The environment secret
`COST_CONTROLS_NOTIFICATION_EMAILS` (comma-separated) is set at bootstrap,
piped from the encrypted Pulumi config key `accountCostControls:notificationEmailAddresses`
without printing it (deploy-role decision). Pulumi commands take the
passphrase only as
`PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi ...`.
The `prod` plan runs only in the workflow, never from a workstation.

Cutover from Pulumi (decision "Cost controls cutover from Pulumi"), `live`
first and the Pulumi destroy second (packet gate ruling, 2026-11-14), so the
account, already over its budget, is never without alerts:

1. Merge the `live` PR. Its deploy adds the budget notifications and creates
   `AnomalyAlerts`; the gate accepts a budget update and an `AnomalyAlerts`
   create while the nine singletons stay no-op.
2. Verify: the gate step printed the nine singletons as `noop`, the budget
   lists four notifications, and `beep-account-anomaly-alerts` exists beside
   the old `beep-account-daily-anomalies`. Until step 3, recipients get one
   duplicate burst: the new budget's threshold mails on creation and at most
   one duplicate daily anomaly digest.
3. The packet gate session exports `beep-ci-runners/production` to
   `~/.local/state/beep/infra-archives/pulumi-exports/`, unprotects the
   component's twelve state entries, `pulumi destroy --target`s only the old
   budget and subscription (preview first: exactly two deletes), then
   `pulumi state delete`s the monitor, the six tags, the two enrollments,
   the component provider and the component. Never `pulumi destroy` a tag,
   an enrollment or the monitor: Pulumi would deactivate the tag, opt the
   account out, or delete the services monitor Alchemy now owns. No step
   runs the program and none needs `pulumi up`.
4. The PR deleting the component from the program merges after `live` has
   been green for 24 hours, and before the next `pulumi preview` of that
   stack.

Rollback (decision "Cost controls cutover from Pulumi"):

- Before step 3, leave `live`: one PR back to `silent`. Its plan deletes the
  stack's own `AnomalyAlerts` subscription, the only delete the gate allows
  (by logical id, `delete` only); the nine adopted settings still may not
  change. The Pulumi pair is still live, so nothing else is needed.
- After step 3, before the component-removal PR merges, restore the Pulumi
  budget and subscription: `pulumi stack import` of the newest archive
  (state only), then `pulumi refresh --target` the old budget and
  subscription URNs, `pulumi preview --target` them and confirm exactly two
  creates, `pulumi up --target` them, and check both exist in AWS. Then take
  `prod` back to `silent` (first case) so only one set mails.
- After the component-removal PR merged, `pulumi up` no longer sees the old
  declarations: revert that PR first, then import, refresh, preview and up.

## OipWeb (oip.law)

`apps/oip-web/alchemy.run.ts` owns the configuration around the oip.law site; Vercel
deployments themselves stay with `.github/workflows/vercel-deploy.yml` (see
[Vercel deploys](vercel-deploys.md)). It replaces the Pulumi project `opip-web`
(stacks `production` and `staging`, backend `s3://oip-law-pulumi-state`). Design and
rulings: the app README's "Infrastructure" section and the 2026-11-14 P4 decision files in
`goals/infra-alchemy-rebuild/decisions/`.

| Stage | Vercel project | Domains (adopted) | DNS records (adopted) | Assets bucket (new) |
| --- | --- | --- | --- | --- |
| `prod` | `oip-web` | `oip.law`; `www.oip.law`, `opip.law`, `www.opip.law` redirect 308 to `oip.law` | four, zones `oip.law` and `opip.law` | `oip-law-web-assets-prod` |
| `staging` | `oip-web-staging` | `staging.oip.law`; `staging.opip.law` redirects 307 to it | two | `oip-law-web-assets-staging` |
| `dev_$USER` | `oip-web-dev-<user>` (new) | none | none | `oip-law-web-assets-dev-<user>` |

Every name is pinned in `apps/oip-web/stack/OipWebConfig.ts`; none is derived from a
state-held instance id. The configuration schema refuses a personal stage that names a
live project, a live or retiring bucket, any domain or the HubSpot secret.

On `prod` and `staging` every adopted object (the project, its three variables, the domains
and the DNS records) is adopted per object (`adopt(true)`, D20) and, with the bucket, carries
`RemovalPolicy.protect()`: a plan, deploy or `alchemy destroy` that would replace or delete
one fails before anything is applied. Never try to work around it with `destroy`: after
adoption a destroy would delete the live objects.

What the first deploys can change on the live objects:

- **Projects:** nothing. The stack declares only `name` and `teamId`; the git link,
  framework, commands, root directory, Node version, system variables and deployment
  protection are not declared, so the provider never sends them, and `git.deploymentEnabled`
  lives in `apps/oip-web/vercel.json`, which no resource touches. Ids are kept, so
  `vercel-deploy.yml` and its pull-request jobs are unaffected.
- **Variables:** rewritten with the values they hold today (`NEXT_DISABLE_PWA=0`,
  `CRM_HUBSPOT_ACCOUNT_ID`, and the HubSpot token, verified equal); a Vercel variable change
  reaches new deployments only.
- **Domains:** nothing (same project, same redirects).
- **DNS records:** nothing. The stack declares the live comment
  (`Managed by Pulumi for oip.law Vercel routing.`), so every declared field already
  matches and the provider only lists the records.

Variables: `NEXT_DISABLE_PWA` (`0`) and `CRM_HUBSPOT_ACCOUNT_ID` are public literals.
`CRM_HUBSPOT_SERVICE_KEY` uses `valueFrom: { config: "CRM_HUBSPOT_SERVICE_KEY" }`: the
`@beep/alchemy-vercel` provider reads it at deploy time and keeps only its SHA-256 in
state. Alchemy persists any `Redacted` prop's plain text in state, so a secret never goes
in `value`.

### Deploy path

One job, `staging` then `prod`, each: `alchemy plan` (log teed to a file), the pre-deploy
check `bun apps/oip-web/stack/plan-guard.ts <log>` (refuses any replace, delete or orphan
of the project, a variable, a domain, a DNS record or a bucket, and fails closed on a log
with no `Plan:` line, on a resource line it cannot read, and on per-action counts that
disagree with the `Plan:` summary; its messages name FQNs and counts only), `alchemy deploy --yes`, then a curl poll of every hostname for its expected status.
The job runs only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`.

The `oip-web-infra-prod` environment (branch policy `main`) carries:

| Name | Kind | Source |
| --- | --- | --- |
| `OIP_WEB_DEPLOY_ROLE_ARN` | variable | role `beep-alchemy-oip-web-deploy` (state bucket: bucket-level reads, object read, write and delete under `OipWeb/` only; every action on the two `oip-law-web-assets-*` buckets except `s3:DeleteBucket`, which is denied; trust `repo:beep-effect/beep-effect:environment:oip-web-infra-prod`) |
| `VERCEL_TOKEN` | secret | `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN` (reads the team; `CLOUD_VERCEL_API_TOKEN` is refused) |
| `CLOUDFLARE_API_TOKEN` | secret | `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`, once it carries Zone · DNS · Read on zones `oip.law` and `opip.law` (DNS · Edit for any later record change) |
| `CLOUDFLARE_ACCOUNT_ID` | secret | `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID` |
| `CRM_HUBSPOT_SERVICE_KEY` | secret | `op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY` (one token serves both stages) |

The exact bootstrap commands and their reversal are in the decision file
"OipWeb bootstrap: deploy role, environment, secrets and the Cloudflare grant".

### Personal stage

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd apps/oip-web
VERCEL_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN \
CLOUDFLARE_API_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN \
CLOUDFLARE_ACCOUNT_ID=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID \
  op run -- bunx alchemy plan --stage "dev_$USER" --env-file /dev/null
```

It plans `[AssetsBucket]`, `[EnvHubSpotAccountId]`, `[EnvNextDisablePwa]` and `[Project]`
as creates, all stage-named, and makes no Cloudflare call. `prod` and `staging` refuse to
run without `CI=true`.

### Cutover from Pulumi

Executed by the packet gate session after its rulings, never by a lane. Zero planned
downtime: no project, domain or DNS record changes, and a variable rewrite (same values)
reaches new deployments only. Pulumi commands run from `infra/oip-web` with
`AWS_PROFILE=elpresidank-vault`, `PULUMI_BACKEND_URL=s3://oip-law-pulumi-state` and the
OIP passphrase:

```sh
PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/OIP_SECRETS/PULUMI_CONFIG_PASSPHRASE op run -- pulumi <command>
```

1. **Preconditions (read-only).** The HubSpot token at
   `op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY` returns HTTP 200 and portal
   `246203876` from HubSpot's account-info endpoint (verified 2026-11-14); the Alchemy
   Cloudflare token lists the records of both zones. Check: both booleans true.
2. **Archive Pulumi.** `pulumi stack export --stack <stack> --file
   ~/.local/state/beep/infra-archives/pulumi-exports/opip-web-<stack>-<date>.json` for both
   stacks; record size and sha256 in a decision file. Check:
   `jq '.deployment.resources | length'` gives 22 and 18.
3. **Bootstrap.** Run the bootstrap decision's commands. Check: `aws iam get-role`,
   `gh variable list --env oip-web-infra-prod` and `gh secret list --env oip-web-infra-prod`
   show the names. Rollback: the decision's reversal; nothing live changed.
4. **Freeze Pulumi.** No `pulumi up` on `opip-web` from here on.
5. **Re-check the token, then arm.** Immediately before arming, repeat the account-info read
   with the token the environment secret was set from (HTTP 200, portal `246203876`); a wrong
   value would break the contact form on the next deployment. Arming is a deploy act: tell the
   orchestrator the time first; the packet gate session sets `OIP_WEB_INFRA_DEPLOY=enabled`
   itself, never a workflow or a lane. Then dispatch the workflow (or let the next filtered
   push run it). The staging plan must read `Plan: 1 to create, 8 to adopted` and the prod
   plan `Plan: 1 to create, 12 to adopted` (lines in the expected-plan decision file);
   anything else is a stop. Check: both smoke steps pass; a second dispatch plans
   `no changes` for both stages; `alchemy drift --stage prod` exits 0. Rollback: unset the
   variable. The live objects are as they were apart from rewritten variable values (equal
   values), and Pulumi still holds them.
6. **Detach Pulumi.** Per stack, `pulumi state delete <urn>` for the project, the three
   variables, the domains and the DNS records, so no later Pulumi destroy can reach them.
   Confirm the old buckets still hold no object version, then
   `pulumi state unprotect <urn>` on the five bucket resources and
   `pulumi destroy --target <bucket urn> --target-dependents` to delete the empty buckets
   (decision file first, naming the archive). Then `pulumi stack rm`. Check:
   `aws s3api head-bucket --bucket assets.oip.law` returns 404, the smoke checks pass.
   Rollback: `pulumi stack import --file <archive>` restores Pulumi's state; `pulumi up`
   recreates an empty bucket under its old name if it is still free.
7. **Later.** `infra/oip-web`, `infra/src/OipWeb.ts` and `infra/src/Vercel.ts` leave with
   `infra/` in P6. Rewording the DNS comment to name Alchemy is its own deploy and needs
   DNS · Edit. To hand an object back without deleting it, `alchemy state delete` its row;
   never `alchemy destroy` a live stage.

## Acceptance evidence

`alchemy plan` has no changes-pending exit code and GitHub secrets re-upload on
every deploy, so the per-stack acceptance is: the plan log shows no create or
replace, and `alchemy drift --stage prod` exits 0. The plan step in every deploy
workflow is that log.

## Local stages

Personal stages (`live_$USER`, `dev_$USER`) use the same store. Export AWS
credentials for the bucket into the environment (the `export-credentials`
recipe above), pass the provider credentials through `op run` with `op://`
references, and always pass `--stage`. `prod` refuses to
run without `CI=true`, except `@beep/infra-hosts` (D21).

## Pins and patches

`alchemy`, `@alchemy.run/*` and `@distilled.cloud/*` are root catalog entries
pinned to exact versions; a bump is its own PR with `alchemy plan` no-op on
every stack (D13). An upstream fix merged but unreleased rides as a bun
`patchedDependencies` patch on the pinned version and is dropped in the bump
that ships it. Current: `patches/alchemy@2.0.0-beta.85.patch` carries the
`Artifacts.cached` fix (waiters settle on failure; verify at bump time with
`grep -n onExit node_modules/alchemy/lib/Artifacts.js`).

## Adding an infra package

```sh
bun run beep create-package infra-<name> --family tooling --kind infra --description "..."
```

Then add `alchemy.run.ts` at the package root declaring the shared store, the
`CI` guard on `prod`, and a deploy workflow per the shape above with its own
concurrency group. Every repo law applies: schema-first, `effect/<Module>`
leaves, tests on the `@alchemy.run/test` harness, `package-verify` before
handoff. Use the shipped primitive first; a repo-owned resource exists only
where `goals/infra-alchemy-rebuild/research/use-this-never-roll-that.md`
records a verified gap.

## Turbo cache

`@beep/infra-turbo-cache` (`packages/tooling/infra/turbo-cache`, stack
`TurboCache`) is the Turborepo remote cache: a Worker over an R2 bucket at
`https://beep-turbo-cache.beep-effect.workers.dev`, team `beep`. Policy,
protocol and the cache-input review: the package README.

### Deploy

`prod` deploys from `main` through `.github/workflows/deploy-turbo-cache.yml`
(environment `turbo-cache-prod`, concurrency group `alchemy-turbo-cache-prod`):
package tests, plan, deploy, then a smoke check that the Worker answers an
anonymous status request with 401 and an unknown path with 404. The
workflow also takes a bare `workflow_dispatch`; never dispatch it in a loop
during a busy hour, because each run takes a hosted runner slot (the condition
the ci-lane-economics window-5 owner cleared it on). The
environment holds `ALCHEMY_STATE_ROLE_ARN`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID` and, optionally, `TURBO_CACHE_ALERT_EMAIL` (comma
separated; unset means no error alert).

The Cloudflare token needs, beyond what the Worker stacks use (Workers Scripts
Write, Account Settings Read), **Workers R2 Storage Write** for the bucket, and
**Notifications Write** once `TURBO_CACHE_ALERT_EMAIL` is set.

A personal stage, from the package directory:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
CLOUDFLARE_API_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN \
CLOUDFLARE_ACCOUNT_ID=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID \
  op run -- bunx alchemy deploy --stage dev_$USER --yes --env-file /dev/null
# ... and the same with `destroy --stage dev_$USER --yes` afterwards.
```

`destroy` refuses a bucket that still holds artifacts (`BucketNotEmpty`;
Alchemy's `R2.Bucket` has no empty-on-delete option): delete the personal
stage's objects first, through the R2 objects API or the dashboard, and never
touch another stage's bucket.

Only `prod` pins its names (`beep-turbo-cache` for the bucket and the Worker)
and retains the bucket and tokens on destroy; a personal stage gets generated
names and is removed completely.

### Issue a token

Tokens are `Random` resources in state, one per policy principal; they never
appear in a stack output or a log. `token.ts` reads one from state and writes
it to a receiving command's stdin, printing only `TURBO_API` and `TURBO_TEAM`.
Run it from the package directory with the state-store credentials exported
(the first two lines above):

```sh
# CI writer: protected main pushes only.
bun token.ts --stage prod --principal ci-main -- \
  gh secret set TURBO_CACHE_WRITE_TOKEN --env turbo-cache-write --repo beep-effect/beep-effect
# CI reader: same-repository pull requests (forks never receive secrets).
bun token.ts --stage prod --principal ci-pr -- \
  gh secret set TURBO_CACHE_READ_TOKEN --repo beep-effect/beep-effect
```

A trusted workstation's token goes into its 1Password item the same way: any
receiver that reads the value from stdin and stores it works, and the vault
write goes through the human `op-human` lane when the agent lane cannot write.

The new secret names stand beside the live `TURBO_TOKEN`/`TURBO_READ_TOKEN`
until CI is flipped to the Worker (cutover stage 2). `@beep/infra-github`
takes these secrets over when it lands.

### Rotate or revoke a token

Raise the principal's `rotation` in `src/Worker.ts` (`cachePolicy`) and merge:
the deploy creates a new token for that principal only and the old one stops
working on the same deploy. Re-issue it with `token.ts`. To revoke a holder,
remove its principal and merge. To add one (a new trusted workstation), add a
principal with `access: "write"` (or `"read"`) and merge, then issue.

### Enroll a client

A client needs three values: `TURBO_API` (the Worker origin), `TURBO_TEAM`
(`beep`) and `TURBO_TOKEN` (its principal's token). For CI, the setup action
passes them from `vars`/`secrets`; for a workstation, put them in the
checkout's environment from 1Password references (`op run`), never as raw
values in a dotenv file. Verify with a remote round trip: `turbo run <task>
--summarize` in a clean cache directory reports `"source": "REMOTE"` on the
second run. A read token's upload is refused with `403 read_only`, so a PR job
can never seed the cache.
