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

On `prod` and `staging` every project, domain and DNS record is adopted per object
(`adopt(true)`, D20) and every project, domain, record and bucket carries
`RemovalPolicy.protect()`: a plan, deploy or `alchemy destroy` that would replace or
delete one fails before anything is applied. Never try to work around it with `destroy`:
after adoption a destroy would delete the live objects.

Variables: `NEXT_DISABLE_PWA` (`0`) and `CRM_HUBSPOT_ACCOUNT_ID` are public literals.
`CRM_HUBSPOT_SERVICE_KEY` uses `valueFrom: { config: "CRM_HUBSPOT_SERVICE_KEY" }`: the
`@beep/alchemy-vercel` provider reads it at deploy time and keeps only its SHA-256 in
state. Alchemy persists any `Redacted` prop's plain text in state, so a secret never goes
in `value`.

### Deploy path

One job, `staging` then `prod`, each: `alchemy plan` (log teed to a file), the pre-deploy
check `bun apps/oip-web/stack/plan-guard.ts <log>` (refuses any replace, delete or orphan
of a project, domain, DNS record or bucket, and a log with no `Plan:` line), `alchemy
deploy --yes`, then a curl poll of every hostname for its expected status. The job runs
only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`.

The `oip-web-infra-prod` environment (branch policy `main`) carries:

| Name | Kind | Source |
| --- | --- | --- |
| `OIP_WEB_DEPLOY_ROLE_ARN` | variable | role `beep-alchemy-oip-web-deploy` (state bucket read and write, bucket management on `oip-law-web-assets-*`, trust `repo:beep-effect/beep-effect:environment:oip-web-infra-prod`) |
| `VERCEL_TOKEN` | secret | `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN` (reads the team; `CLOUD_VERCEL_API_TOKEN` is refused) |
| `CLOUDFLARE_API_TOKEN` | secret | a token with DNS edit on zones `oip.law` and `opip.law` (`CLOUD_CLOUDFLARE_ACCOUNT_IAC_TOKEN` reads them; `CLOUD_CLOUDFLARE_ALCHEMY_TOKEN` cannot) |
| `CLOUDFLARE_ACCOUNT_ID` | secret | `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID` |
| `CRM_HUBSPOT_SERVICE_KEY_PROD`, `CRM_HUBSPOT_SERVICE_KEY_STAGING` | secret | the HubSpot private-app token, from a 1Password field the operator names |

### Personal stage

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd apps/oip-web
VERCEL_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN \
CLOUDFLARE_API_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_IAC_TOKEN \
CLOUDFLARE_ACCOUNT_ID=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID \
  op run -- bunx alchemy plan --stage "dev_$USER" --env-file /dev/null
```

It plans `[AssetsBucket]`, `[EnvHubSpotAccountId]`, `[EnvNextDisablePwa]` and `[Project]`
as creates, all stage-named. `prod` and `staging` refuse to run without `CI=true`.

### Cutover from Pulumi

Executed by the orchestrating session after a ruling, never by a lane. Zero planned
downtime: adoption rewrites settings that already hold, DNS records change only their
comment, and a Vercel variable change reaches new deployments only.

1. **Preconditions (read-only).** Store the HubSpot private-app token in a named
   1Password field and prove it is the live one with a read that returns portal
   `246203876` (the Pulumi copy cannot be decrypted and Vercel never returns a sensitive
   value). Confirm the Cloudflare token's DNS edit scope on both zones with the token
   verify endpoint. Check: both booleans true.
2. **Archive Pulumi.** `pulumi stack export` both stacks to
   `~/.local/state/beep/infra-archives/pulumi-exports/opip-web-<stack>-<date>.json`;
   record size and sha256 in a decision file. Check: `jq '.deployment.resources | length'`
   gives 22 and 18.
3. **Bootstrap.** Create the deploy role and the environment with the table above.
   Check: `aws iam get-role`, `gh variable list --env` and `gh secret list --env` show the
   names. Rollback: delete them; nothing live changed.
4. **Freeze Pulumi.** No `pulumi up` on `opip-web` from here on.
5. **Arm and run.** Set `OIP_WEB_INFRA_DEPLOY=enabled`, dispatch the workflow. The staging
   plan must read `Plan: 1 to create, 8 to adopted` and the prod plan
   `Plan: 1 to create, 12 to adopted` (lines listed in the expected-plan decision file);
   anything else is a stop. Check: both smoke steps pass; a second dispatch plans
   `no changes` for both stages; `alchemy drift --stage prod` exits 0. Rollback: unset
   the variable. The live objects are unchanged apart from DNS comments and rewritten
   variable values; Pulumi still holds them and `pulumi up` would restore its comments.
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
   `infra/` in P6. To hand an object back without deleting it, `alchemy state delete` its
   row; never `alchemy destroy` a live stage.

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
