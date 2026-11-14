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
| `HostsAiMetrics` | `packages/tooling/infra/infra-hosts/alchemy.run.ts` | none (operator workstation only, D21) | none | Arize Phoenix on dankserver behind Tailscale Serve |
| `HostsOpenClaw` | `packages/tooling/infra/infra-hosts/openclaw.alchemy.run.ts` | none (operator workstation only, D21) | none | the OpenClaw generation on the operator workstation |
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

## Host stacks (`@beep/infra-hosts`, workstation only)

Two stacks, no deploy workflow (D21, SPEC Exception Ledger):

| Stack | Entry | Target | Config file variable |
| --- | --- | --- | --- |
| `HostsAiMetrics` | `packages/tooling/infra/infra-hosts/alchemy.run.ts` | Arize Phoenix on dankserver, over SSH | `BEEP_AI_METRICS_HOST_CONFIG` |
| `HostsOpenClaw` | `packages/tooling/infra/infra-hosts/openclaw.alchemy.run.ts` | the OpenClaw generation applicator on the operator workstation | `BEEP_OPENCLAW_HOST_CONFIG` |

`prod` runs only from the operator workstation: both programs fail with a
`ConfigError` when `CI` is true, and the S3 stage lease stops a second
concurrent deploy. Every other stage is a rehearsal that touches no
production data (AI metrics: a throwaway Phoenix on stage-suffixed names and
loopback port `phoenix.rehearsalPort`, 16006 by default; OpenClaw: renders the
generation and runs nothing). One AI metrics rehearsal at a time per port:
Preflight refuses a port another container or process holds and names it; set
`phoenix.rehearsalPort` in the config file to run two.
Design and resource graphs: the package README and the 2026-11-13 decision
files in `goals/infra-alchemy-rebuild/decisions/`.

### Configuration files

Each stack decodes one JSON file named by its variable. Keep both files on the
workstation outside the repo, under `~/.local/state/beep/infra-hosts/`. They
hold machine facts and `op://` references, never a resolved secret; the schema
rejects anything else before a resource is read.

- AI metrics (`AiMetricsHostConfig`): `sshDestination` (the ssh_config alias of
  the wrapped dankserver route), `phoenix.image` (pinned; the Pulumi stack
  config pins `arizephoenix/phoenix:15.5.0`), `tailnet.fqdn`,
  `legacyCompose.configRoot` (the directory holding today's Compose file and the
  Tailscale port state file), `secretRefs.hashSalt` and
  `secretRefs.rawArchiveKey`. Container, network, unit and port fields default
  to the Compose deployment's values; the data volume defaults to
  `<legacyCompose.composeProject>_phoenix_data`, today
  `beep-ai-metrics-dankserver_phoenix_data`.
- OpenClaw (`OpenClawStackArgs`, encoded): `identity` (home, hostname,
  machine id, runtime dir, uid, username of the workstation), `deployment`
  (hosted and local provider, Telegram token reference), optional `backup`
  (host, user, remote directory, passphrase reference).

### Session setup

1. Export the aws-vault session for the state store (the recipe under
   "Bootstrap"): `eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`
   and `export AWS_REGION=us-east-1`.
2. AI metrics only: load the dankserver key through the wrapped route named in
   the `remote-development-agents` skill (`ssh-dankserver-yubi -G >/dev/null`
   loads the key handle into the dedicated agent without opening a session;
   announce the YubiKey touch). Point `SSH_AUTH_SOCK` at that agent for the
   rest of the session: Docker's `ssh://` endpoint and every host step use
   plain non-interactive `ssh` (`BatchMode=yes`) with the configured
   destination. Prove the route before any plan:
   `ssh -o BatchMode=yes <destination> docker version --format '{{.Server.Version}}'`.
3. OpenClaw only: arm sudo in the same terminal with
   `yubi-sudo -v` (the canonical local wrapper); the preflight
   fails closed without an armed ticket.
4. Work from `packages/tooling/infra/infra-hosts`. Pass every secret as an
   `op://` reference through `op run`; nothing resolved goes on the command
   line, into the config file or into a log.

### AI metrics: rehearsal, cutover, rollback

```sh
export BEEP_AI_METRICS_HOST_CONFIG=~/.local/state/beep/infra-hosts/ai-metrics.json
# 1. Rehearse on dankserver without touching the live Phoenix or its data.
op run -- bunx alchemy deploy --stage "dev_$USER" --yes --env-file /dev/null
op run -- bunx alchemy destroy --stage "dev_$USER" --yes --env-file /dev/null
# 2. Plan prod. Expect creates only: Context, Network, Container and four Exec
#    steps; the data volume is a lookup. Any replace or delete stops the cutover.
op run -- bunx alchemy plan --stage prod --env-file /dev/null
```

The AI metrics stack resolves no secret at deploy time, so `op run` here only
guards against a stray resolved variable; add an env file of `op://`
references if a later step needs one.

Cutover, in order:

1. Snapshot the data with Phoenix stopped: on dankserver,
   `systemctl --user stop ai-metrics-phoenix.service` (its `ExecStop` is
   `docker compose down`, which keeps the named volume), then archive the volume
   `beep-ai-metrics-dankserver_phoenix_data` with a throwaway container into a
   dated tarball outside the volume. Record the tarball path and sha256.
2. `op run -- bunx alchemy deploy --stage prod --yes --env-file /dev/null`.
   Preflight checks the volume exists; RetireCompose disables the unit, archives
   it under `<legacy config root>/retired-compose/` and refuses to continue if a
   Compose container named `beep-ai-metrics-phoenix` is still present; the
   container starts on the same volume; TailscaleServe re-points HTTPS 8447 at
   loopback 6006; Health waits for the Docker healthcheck, then checks loopback,
   Serve and the public URL. A failure in any step fails the deploy.
3. Verify by hand: the Phoenix UI at the stack's `phoenixUrl` lists the existing
   projects (the data survived), and a test span posted to `otlpTraceUrl`
   appears. Then `bunx alchemy drift --stage prod` exits 0.
4. Save the outputs for rollback:
   `bunx alchemy state read HostsAiMetrics/prod/output > ~/.local/state/beep/infra-hosts/ai-metrics-prod-output.json`.

Rollback, in this order, because the Alchemy and Compose containers share one
name:

1. `op run -- bunx alchemy destroy --stage prod --yes --env-file /dev/null`
   removes the Alchemy container, network and context. The volume is a lookup
   and stays; Tailscale Serve stays on 8447 (Exec deletes nothing).
2. Run the saved `operatorCommands.rollbackToCompose` command. It restores the
   archived unit and starts it; `docker compose up` reattaches the same volume.
3. If the data itself is damaged, restore the step-1 snapshot into the volume
   with Phoenix stopped.

To retire Phoenix entirely, run the saved `operatorCommands.tailscaleServeOff`
after the destroy.

### OpenClaw: rehearsal, apply, rollback

```sh
export BEEP_OPENCLAW_HOST_CONFIG=~/.local/state/beep/infra-hosts/openclaw.json
# 1. Rehearse: decodes the config and renders the generation; runs nothing.
bunx alchemy deploy openclaw.alchemy.run.ts --stage "dev_$USER" --yes --env-file /dev/null
# 2. Prod plan, then apply, in the terminal that holds the armed sudo ticket.
OPENCLAW_BACKUP_PASSPHRASE=op://<vault>/<item>/<field> \
  op run -- bunx alchemy plan openclaw.alchemy.run.ts --stage prod --env-file /dev/null
OPENCLAW_BACKUP_PASSPHRASE=op://<vault>/<item>/<field> \
  op run -- bunx alchemy deploy openclaw.alchemy.run.ts --stage prod --yes --env-file /dev/null
```

The steps run Preflight, Stage, Apply, Probe and (with a `backup` block)
BackupShip in order; each fails the deploy on a non-zero exit. The passphrase
reference is resolved by `op run` into the process environment only, so it
never reaches stack props or state. After the apply, run the stack output's
`operatorCommands.liveAcceptance` and `operatorCommands.driftAudit`. Roll back
with `operatorCommands.rollback` (it restores the previous generation from its
snapshot); `alchemy destroy` leaves the workstation untouched by design.

## OipWeb (oip.law)

`apps/oip-web/alchemy.run.ts` owns the configuration around the oip.law site; Vercel
deployments themselves stay with `.github/workflows/vercel-deploy.yml` (see
[Vercel deploys](vercel-deploys.md)). It replaced the Pulumi project `opip-web`
(stacks `production` and `staging`, backend `s3://oip-law-pulumi-state`; both stacks removed
2026-11-14, see "Cutover from Pulumi" below). Design and
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
check `bun apps/oip-web/stack/plan-guard.ts <log>`. It refuses any replace, delete or orphan
of the project, a variable, a domain, a DNS record or a bucket; on `prod` and `staging` it also
refuses every `create` outside an explicit allow-list (the assets bucket, the three variables and
that stage's domains), so a project or DNS record that failed to adopt can never be created a
second time. It fails closed on a log with no `Plan · <stage>` title or no `Plan:` summary, on a
resource line it cannot read, and on per-action counts that disagree with the summary; its
messages name FQNs and counts only. `CRM_HUBSPOT_SERVICE_KEY` must be set for the plan step
too: the stack reads it before declaring anything, so a missing key fails before any write, `alchemy deploy --yes`, then a curl poll of every hostname for its expected status.
The job runs only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`.

```sh
# Arm: every later push to main that matches the workflow's paths deploys.
gh variable set OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect --body enabled
# Run the armed job now, without a push.
gh workflow run deploy-oip-web-infra.yml -R beep-effect/beep-effect --ref main
# Disarm.
gh variable delete OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect
```

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

### Live write rehearsal

Run this before arming after any change to a write path of `@beep/alchemy-vercel`. The fake Vercel API
only encodes rules someone has observed; the first arm failed on one it did not know (decision
`2026-11-14-first-armed-oipweb-deploy-failed-on-a-sensitive-variable-edit`).

- **Stack:** `apps/oip-web/test/live/rehearsal.alchemy.run.ts`, the `OipWebRehearsal` stack.
- **Objects:** a scratch project `oip-web-rehearsal-<stage>` with three variables shaped like the stack's
  (`encrypted` literal, `sensitive` `valueFrom`, `plain`).
- **Stages:** it refuses `prod` and `staging`, and touches no domain, DNS record or Cloudflare object.

Use the personal stage's environment above plus `OIP_WEB_REHEARSAL_SECRET`, a throwaway value that is
never a real secret. Run each step with `bunx alchemy <plan|deploy|destroy> test/live/rehearsal.alchemy.run.ts
--stage "dev_$USER"` from `apps/oip-web`:

1. **Seed:** deploy. Expect 4 creates.
2. **Adoption over existing objects:** `bunx alchemy state delete OipWebRehearsal/dev_$USER -r -c
   test/live/rehearsal.alchemy.run.ts`, then deploy with `OIP_WEB_REHEARSAL_ADOPT=true`. Expect
   `3 to create, 1 to adopted`, every write in place: same ids, no second variable.
3. **Edits:** deploy with `OIP_WEB_REHEARSAL_PLAIN_PREVIEW=true` (plain target change), with a new
   `OIP_WEB_REHEARSAL_SECRET` (rotation), and with `OIP_WEB_REHEARSAL_SENSITIVE_PREVIEW=true` (sensitive
   target change). Expect one update each. Then deploy with `OIP_WEB_REHEARSAL_SENSITIVE_KEY=REHEARSAL_SENSITIVE_RENAMED`:
   expect `1 to replace`, with the new variable created before the old one is deleted.
4. **A missing row:** reseed, delete only `OipWebRehearsal/dev_$USER/EnvSensitive`, and deploy with
   adoption. Expect `1 to adopted`, then `no changes`. (A row a failed create left behind is a
   `creating` checkpoint instead, which plans as `create`.)
5. **Teardown:** `destroy`, and confirm the scratch project is gone.

Then deploy and destroy the real `OipWeb` personal stage, which covers its project, variables and bucket.

Known limits, recorded when the cutover lane retired (2026-11-14):

- **Never exercised against a live stage.**
  - A variable key rename (create first): rehearsed on a scratch project only.
  - A variable type change (delete first): fake only.
  - `gitBranch` and `comment` edits: fake only. Whether Vercel accepts a `comment` edit on a
    sensitive variable is unconfirmed.
  - A domain move from another project: fake only.
  - Any new `Vercel.Project` setting: the stack declares only `name` and `teamId`. Rehearse a new
    setting on a scratch stage before declaring it.
- **Not encoded by the fake (unconfirmed against the real API).**
  - An upsert onto a sensitive variable with a weaker declared type.
  - A redirect to a domain that is not on the project.
  - The exact error codes of the refusals it does encode.

### Cutover from Pulumi (done 2026-11-14)

The packet gate session ran the cutover on 2026-11-14, staging first, with no downtime and no
change to any project, domain or DNS record. Decision:
`goals/infra-alchemy-rebuild/decisions/2026-11-14-oipweb-pulumi-cutover-done-both-stacks-removed.md`.

1. **Archive.** Both Pulumi stacks were exported to
   `~/.local/state/beep/infra-archives/pulumi-exports/opip-web-<stack>-2026-11-14.json`:
   staging has 18 resources, production 22. The step snapshots, comparisons, destroy previews and
   logs, and the cutover script (`oip-web-pulumi-cutover.sh`) and its steps file sit beside them.
   They are kept until P6.
2. **Arm and deploy.** The first dispatch (run 43585534113) stopped on staging at a sensitive
   variable edit and was disarmed. After the fix (#3339), run 43591525409 deployed both stages:
   - staging `Plan: 1 to create`. A failed create leaves a `creating` checkpoint, which plans as
     `create` and is adopted at apply time.
   - prod `Plan: 8 to create, 5 to adopted`.

   `OIP_WEB_INFRA_DEPLOY` stays `enabled`: every matching push to `main` deploys.
3. **Detach and remove.** Per stack:
   - `pulumi state delete` of the adopted URNs: the DNS records, domains, variables and project.
   - `pulumi state unprotect` and a targeted `pulumi destroy` of the empty old bucket
     (`staging-assets.oip.law`, `assets.oip.law`) and its four dependents.
   - `pulumi state delete` of the component, then `pulumi stack rm --force --preserve-config`.

   Each step was checked against a fresh `pulumi stack export`. Afterwards `pulumi stack ls -a` on
   `s3://oip-law-pulumi-state` lists only `organization/beep-ci-runners/production` (354 resources,
   untouched). The Pulumi program (infra/oip-web (removed in #3341) and infra/src/OipWeb.ts (removed in #3341)) was deleted after the
   cutover, together with the Storybook program and infra/src/Vercel.ts (removed in #3341).

**Rollback** (re-creates Pulumi state; the live objects never left Alchemy):

1. Disarm with `gh variable delete OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect`.
2. Check out a commit that still has infra/oip-web (removed in #3341), such as `6e393d55c29`.
3. Run the archived script's `rollback <stack> --preview`, then `--apply --confirmed`. It runs
   `pulumi stack init`, then `pulumi stack import` of the archive, then
   `pulumi refresh --target <bucket urn> --target-dependents`, which drops the destroyed bucket
   from state. `pulumi up` then recreates the empty bucket under its old name if that name is free.
4. Leave Alchemy's `OipWeb/<stage>` rows in place unless Pulumi takes the objects over for good.
   Then remove them state-only: `bunx alchemy state delete OipWeb/<stage> -r` from `apps/oip-web`.

To hand one object back without deleting it, `alchemy state delete` its row. Never
`alchemy destroy` a live stage. Rewording the DNS comment to name Alchemy is its own deploy and
needs DNS · Edit.

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
