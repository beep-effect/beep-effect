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
| `InfraGithub` | `packages/tooling/infra/github/alchemy.run.ts` | `deploy-infra-github.yml` (disarmed) | `infra-github-prod` | settings, `main` ruleset, deploy environments, variables, labels of `beep-effect/beep-effect` |

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

### InfraGithub

`InfraGithub` writes to the live repository from every stage, because the repository, its
ruleset and its labels are singletons. `prod` deploys only from CI; any other stage is a
plan-only preview and refuses to start without `INFRA_GITHUB_LIVE_PREVIEW=plan-only`. Never
`deploy` a preview stage. Every resource is retained on removal and the repository and the
`main` ruleset are protected, so a stray destroy deletes nothing:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/github
GITHUB_TOKEN="$(gh auth token)" INFRA_GITHUB_LIVE_PREVIEW=plan-only \
  bunx alchemy plan --stage "preview_$USER" --env-file /dev/null
```

The first plan shows the `main` ruleset as `adopted` and every other object as
`create`: `GitHub.Repository`, `Environment`, `Variable` and `Label` have no adoption
probe in beta.86, and their reconcile observes the live object by name and updates it in
place (the stack tests prove a first deploy issues no POST). Ownership, secrets and the
beep-reviewer switch: `packages/tooling/infra/github/README.md`.

#### Before arming: the operator's one-time setup

The deploy workflow stays disarmed until the packet gate says otherwise. Arming needs
the App below, the reviewer-switch CLI change merged, and the orchestrator told first,
because the stack rewrites the ruleset that gates every merge. The setup steps change
live settings; run them only when the gate asks.

1. Mint the App from its checked-in manifest (browser handoff, as `kriegcloud`):

   ```sh
   bun run beep github app mint beep-infra-github --dry-run   # review the manifest
   bun run beep github app mint beep-infra-github
   ```

   Confirm the registration page lists exactly: Administration, Environments, Variables
   and Issues read and write, Metadata read-only, no webhook. The launcher stores
   `app_id`, `client_id`, `slug` and `private_key` in the 1Password item
   `beep-infra-github GitHub App` (vault `BEEP_SECRETS`).
2. Install the App on `beep-effect/beep-effect` only, and record the installation id in
   the item's `installation_id` field.
3. Create the deploy environment with a `main`-only branch policy:

   ```sh
   gh api -X PUT repos/beep-effect/beep-effect/environments/infra-github-prod \
     -F 'deployment_branch_policy[protected_branches]=false' \
     -F 'deployment_branch_policy[custom_branch_policies]=true'
   gh api -X POST repos/beep-effect/beep-effect/environments/infra-github-prod/deployment-branch-policies \
     -f name=main -f type=branch
   ```

4. Put the App id and key on it, piped from 1Password and never printed:

   ```sh
   gh variable set INFRA_GITHUB_APP_ID --env infra-github-prod \
     --body "$(op read 'op://BEEP_SECRETS/beep-infra-github GitHub App/app_id')"
   op read 'op://BEEP_SECRETS/beep-infra-github GitHub App/private_key' \
     | gh secret set INFRA_GITHUB_APP_PRIVATE_KEY --env infra-github-prod
   gh variable set ALCHEMY_STATE_ROLE_ARN --env infra-github-prod \
     --body arn:aws:iam::832907639880:role/beep-alchemy-state-rw
   ```

5. Add the environment's subject to the state role's trust policy, under the aws-vault
   profile, so the OIDC token from that job can assume it:
   `repo:beep-effect/beep-effect:environment:infra-github-prod` joins the `sub` condition
   list of `beep-alchemy-state-rw` (`aws iam get-role`, edit the
   `token.actions.githubusercontent.com:sub` list, `aws iam update-assume-role-policy`).
6. Only on the gate's word: `gh variable set INFRA_GITHUB_DEPLOY_ARMED --body true`. From
   then on `beep reviewer ruleset release|require` edits the stack configuration instead
   of the live ruleset (`docs/ops/beep-reviewer-app.md`).

#### First deploy: capture, compare, roll back

The `main` ruleset is rewritten on every deploy, so the first armed deploy is bracketed by
a capture of ruleset 10240248. Before dispatching `Deploy infra-github`:

```sh
mkdir -p ~/.local/state/beep/infra-github
gh api repos/beep-effect/beep-effect/rulesets/10240248 > ~/.local/state/beep/infra-github/ruleset-10240248.before.json
```

After the run is green:

```sh
gh api repos/beep-effect/beep-effect/rulesets/10240248 > ~/.local/state/beep/infra-github/ruleset-10240248.after.json
diff <(jq -S 'del(.updated_at)' ~/.local/state/beep/infra-github/ruleset-10240248.before.json) \
     <(jq -S 'del(.updated_at)' ~/.local/state/beep/infra-github/ruleset-10240248.after.json)
```

The diff must be empty: `updated_at` is the only field allowed to change. Anything else
(a check, a bypass actor, a rule parameter) is a failed deploy: disarm
(`gh variable set INFRA_GITHUB_DEPLOY_ARMED --body false`), then re-apply the capture:

```sh
jq '{name, target, enforcement, conditions, rules, bypass_actors}' \
  ~/.local/state/beep/infra-github/ruleset-10240248.before.json \
  | gh api -X PUT repos/beep-effect/beep-effect/rulesets/10240248 --input -
```

and repeat the `after` capture and diff until it is empty again.

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
