# P0 Live Fact Record

Captured on 2026-08-24. This record separates live observations from
checked-in configuration and upstream-module behavior. Sensitive identifiers
are omitted or rendered as `<acct>`, `ami-…`, `lt-…`, `i-…`, `sg-…`,
`subnet-…`, `beep-ci-dist-…`, and `beep-ci-runner-…`. Reservation IDs are
omitted.

## Capture boundary

- AWS and GitHub read-only calls succeeded on 2026-08-24. Launch-template,
  AMI-pin, profile, role, boundary, inline-policy, instance, token-scope, and
  repository-runner facts below are **live-verified** unless marked otherwise.
- The earlier transport-blocked AWS capture and four-runner GitHub observation
  are superseded by this record.
- The organization runner-group endpoint remains unread because the current
  GitHub authority lacks the required organization runner permission. That
  single inventory gap is called out at the end of this record.
- No AWS or GitHub mutation was attempted.

## GitHub: live facts

### Owner and runner-group endpoint

The canonical repository is `beep-effect/beep-effect` under the `beep-effect`
organization. `gh auth status` reports classic scopes `gist`, `read:org`,
`repo`, and `workflow`; it does not report `admin:org`.

The correct inventory endpoint is
`orgs/beep-effect/actions/runner-groups`. GitHub documents `admin:org` for a
classic token. A fine-grained token needs organization `Self-hosted runners`
read for inventory and write for configuration. A GitHub App needs
`organization_self_hosted_runners` permission. See GitHub's
[runner-group REST permissions](https://docs.github.com/en/rest/actions/self-hosted-runner-groups?apiVersion=2022-11-28)
and
[self-hosted runner access controls](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access).

### Runner-group API and current fleet membership

| Surface | Live observation | Consequence |
| --- | --- | --- |
| Repository runner roster | `repos/beep-effect/beep-effect/actions/runners` returned `total_count: 0` | The earlier four active registrations were observed before the drain and are superseded. No runner names were retained. |
| Organization group inventory | The current classic token cannot read `orgs/beep-effect/actions/runner-groups` because it lacks `admin:org` | Current group membership and policy remain the only open P0 inventory fact. |
| Organization runner-group fields | GitHub documents `restricted_to_workflows`, `selected_workflows`, and `allows_public_repositories`; each defaults to `false` | `P3` must set each ratified field explicitly and verify the resulting group through the organization API. |

The checked-in controller explains the earlier repository registrations:
`enable_organization_runners` is false, runner default labels are disabled,
and the only extra label is `beep-ec2-heavy`.

### Repository Actions settings

The live `beep-effect/beep-effect` settings show:

- Actions are limited to organization-owned actions, GitHub-owned actions,
  and an explicit allowlist. Verified creators are not generally allowed.
- Third-party allowlist:
  `actions-rust-lang/setup-rust-toolchain@*`, `cachix/cachix-action@*`,
  `cachix/install-nix-action@*`, `changesets/action@*`,
  `google/osv-scanner-action/*`, `oven-sh/setup-bun@*`,
  `peter-evans/create-pull-request@*`, `swatinem/rust-cache@*`,
  `taiki-e/install-action@*`, `tauri-apps/tauri-action@*`.
- Full-length commit-SHA pinning is required.
- Fork pull requests require approval for all external contributors.
- The default workflow token has read access to repository contents and
  packages. Workflows cannot create or approve pull requests.
- The repository is public.

These controls reduce admission and supply-chain exposure. They do not make a
root-capable self-hosted runner safe, and a pull request can still change job
steps in a workflow that is allowed to reach the runner class.

### Workflow routing

`.github/workflows/check.yml` keeps five pull-request matrix lanes on
`beep-ec2-heavy`: `Lint Policy`, `Check`, `Test Integration`,
`Coverage Regression`, and `Docgen`. Its `Build` lane uses the same label only
on pushes. Pull-request jobs receive a read-only job token, checkout with
credential persistence disabled, no listed trusted-push secrets, and local
Turbo caching. Trusted push jobs on the same runner class can receive their
separate configured secrets.

Two operator workflows also address the label:

- `fleet-shadow-check.yml` uses the fixed `beep-ec2-heavy` label for the
  security probe.
- `fleet-lane-probe.yml` defaults its operator-dispatch runner input to
  `beep-ec2-heavy`; the input can select another probe lane.

No other workflow routes to the label in the current source inventory.

## AWS and controller shape

### Stack and image pins

The Pulumi project is `beep-ci-runners`, stack `production`, region
`us-east-1`. The active controller source uses the pinned
`github-aws-runners` module at version `7.10.1`.

The live `beep-ci-action-runner` launch template has one returned version:
default version 8, created 2026-08-16. Its `ImageId` resolves through SSM
parameter `/beep-ci/controller/runner-ami-id`. That parameter is version 5,
was last modified 2026-08-16, and resolves to `ami-…`.

The launch template uses public IPv4 and an encrypted 100 GiB gp3 root volume
that AWS deletes on termination. Its metadata options are live-verified:

| Option | Value |
| --- | --- |
| `HttpTokens` | `required` |
| `HttpPutResponseHopLimit` | `1` |
| `HttpEndpoint` | `enabled` |
| `InstanceMetadataTags` | `enabled` |

### Launch, identity, and metadata

Launch-template, profile, role, and metadata values below are
**live-verified**. Controller-only behavior is marked **source-reconciled**.

| Property | Live shape |
| --- | --- |
| Compute | **Source-reconciled:** spot-first with on-demand failover; maximum 14 runners |
| Network and disk | Public IPv4; encrypted 100 GiB gp3 root volume deleted on termination |
| Runner identity | **Source-reconciled:** `ec2-user`; passwordless sudo retained for hosted parity; Docker installation makes privileged/container-root paths root-equivalent |
| Instance profile | `beep-ci-runner-profile`, role shaped `beep-ci-runner-…`, path `/beep-ci/`, permissions boundary `beep-ci-fleet-boundary` |
| Metadata options | Endpoint enabled; IMDSv2 tokens required; response hop limit 1; instance tags exposed through metadata |
| SSM | **Live role plus source-reconciled controller:** no Session Manager grant; Parameter Store remains part of bootstrap |
| Registration | **Source-reconciled:** repository-scoped to `beep-effect/beep-effect`; JIT and ephemeral modes enabled; exact-label matching enabled |

The instance profile has path `/beep-ci/` and exactly one role,
`beep-ci-runner-…`, also under `/beep-ci/`. The role trusts
`ec2.amazonaws.com`, has `MaxSessionDuration` 3600, and attaches the
`beep-ci-fleet-boundary` permissions boundary. It has no attached managed
policies and these five inline policies:

| Policy | Effective role grant |
| --- | --- |
| `distribution-bucket` | `s3:GetObject` and `s3:GetObjectAcl` on one runner tarball object in `beep-ci-dist-…` |
| `ec2` | `ec2:TerminateInstances` when `aws:ARN = ${ec2:SourceInstanceARN}` |
| `runner-create-tags` | `ec2:CreateTags` on `instance/*`, limited to tag key `ghr:github_runner_id` and the source instance ARN |
| `runner-describe-tags` | `ec2:DescribeTags` on `*` |
| `runner-ssm-parameters` | Get and delete per-instance JIT parameters under `runners/tokens/*` when the instance-id tag matches; get `runners/config` and `runners/config/*` |

The role grants no `ec2:ModifyInstanceMetadataOptions`, no
`ssm:StartSession`, and no `sts:AssumeRole`.

The boundary has three statements:

- `ServiceCeiling` allows `logs:*`, `ec2:*`, `ssm:*`, `sqs:*`, `s3:*`,
  `kms:Decrypt`, `kms:GenerateDataKey`, `events:*`,
  `lambda:InvokeFunction`, `sts:GetCallerIdentity`, `dynamodb:*`, and
  `cloudwatch:PutMetricData` on `*`.
- `PassOwnRoles` allows `iam:PassRole` on
  `role/beep-ci/beep-ci-*` only when passed to EC2.
- `NoIamMutation` denies `iam:Create*`, `iam:Put*`, `iam:Attach*`,
  `iam:Delete*`, and `iam:Update*` on `*`.

The boundary caps drift; it does not grant actions to the current role.
Effective permissions are the intersection, so the role is narrow today.
Nothing in the boundary denies `ec2:ModifyInstanceMetadataOptions`. `P2` must add
the role's self-only disable allow and the boundary's explicit deny for every
endpoint value other than `disabled`, then prove both edges through dry runs.

The current metadata settings are not a sufficient root boundary. Hop limit 1
can obstruct bridged containers, while host processes and host-network
containers remain on the host path. The per-job owner rule covers
`ec2-user`; passwordless sudo, UID 0, or Docker-equivalent root can remove or
bypass it.

### Bootstrap and JIT registration

The pinned module's boot path is:

1. Root reads static configuration from SSM Parameter Store.
2. Root fetches the instance-specific encrypted JIT configuration from SSM.
3. Root deletes that per-instance SSM parameter before starting the runner.
4. Ownership of the runner directory is transferred to `ec2-user`.
5. The ephemeral runner starts as `ec2-user` with the one-use JIT
   configuration.

The GitHub App private key and webhook secret remain in the controller's
SSM/KMS path; they are not delivered to the runner VM. The guest does receive
the encoded one-use JIT configuration. `P2` must prove that it is no longer
recoverable from arguments, environment, files, logs, cloud-init data, or
process state when untrusted job code begins.

The baked post-install path avoids package installation when its marker is
present. Otherwise it installs the toolbelt. A job-start hook fails closed
while adding an owner-based firewall drop for `ec2-user`, but this is defense
in depth rather than a root boundary.

### Setup-action fast path

`.github/actions/setup-monorepo-ci/action.yml` first clears the job user's Bun
cache. Its baked fast path requires marker files, an executable Bun binary,
the expected `bunx` symlink, and the sealed cache archive. It then checks:

- checkout lock digest;
- expected Bun version and release-archive digest;
- installed Bun binary digest, owner `0:0`, and mode `755`;
- sealed cache digest, owner `0:0`, and mode `444`;
- `bunx` targeting `bun`.

A mismatch falls back to ordinary setup instead of using the baked cache.
Because this composite action is present after checkout and is PR-editable,
its log is not independent proof. `P1` needs a fresh externally baked AMI pin
and evidence that the root-owned sealed artifacts themselves match the bake
report.

### Bake freshness check

`beep runners bake --check` ran on 2026-08-24 at `abbe959d1e` and reported
`fresh: false`:

| Input | Required | Baked | Result |
| --- | --- | --- | --- |
| Bun | `1.4.0` | `1.3.14` | mismatch |
| Lockfile digest | current checkout | prior digest | mismatch |
| Bun archive digest | current release | prior digest | mismatch |

The digests are omitted. The result confirms that the 2026-08-16 serving AMI
predates PR #783's hardening and that the baked fast path falls back today.
This is why `P1` runs now as a standalone deployment baseline.

### Deregistration and teardown

The controller enables one-use ephemeral runners, JIT registration,
termination-event handling, runner deregistration, one-minute scale-down
evaluation, and deletion of the root volume at instance termination. The
runner role can terminate only its own instance. The controller also retains
an AWS-side stale-runner cleanup path, while the older groundwork stack has an
independent age-based reaper. These are layered teardown paths, not present
proof that a particular VM terminated.

At capture, the repository runner endpoint reports zero runners. The EC2 read
reports zero instances in `pending`, `running`, `stopping`, or `stopped` state
and 30 terminated fleet instances. All 30 have `ghr:Type=Repo` and
`ghr:created_by=scale-up-lambda`; all 30 report
`Client.UserInitiatedShutdown`. The ephemeral teardown path is functioning and
the fleet is idle at this capture point.

`P1` must still correlate a newly deployed registration to one candidate VM,
deregistration, and terminal EC2 state. An idle snapshot is not a substitute
for that rollout proof.

## Placement decision retained

The heavy lanes remain on EC2. The placement packet records two independent
attempts to move `Test Integration` to `ubuntu-24.04`; both runners received a
shutdown signal while verification was in flight, and affected tasks exited
137. The accepted rollback restored `beep-ec2-heavy`.

Current routing still matches that decision: the five pull-request heavy
lanes listed above stay on EC2, with push-only `Build` also using the fleet.
P0 does not reopen the hosted re-fit.

## Exact read-only capture commands

### GitHub reads

The repository runner and Actions settings reads succeeded. The organization
group read remains permission-blocked:

```sh
gh api orgs/beep-effect/actions/runner-groups
gh api repos/beep-effect/beep-effect/actions/runners
gh api repos/beep-effect/beep-effect/actions/permissions
gh api repos/beep-effect/beep-effect/actions/permissions/fork-pr-contributor-approval
gh api repos/beep-effect/beep-effect/actions/permissions/workflow
gh api repos/beep-effect/beep-effect/actions/permissions/selected-actions
```

`gh auth status` supplied the sanitized scope list. Tokens, runner names, and
email addresses were not retained.

### AWS reads

The read-only capture covered these resources and their dependent documents:

```sh
aws ec2 describe-launch-template-versions \
  --region us-east-1 \
  --launch-template-name beep-ci-action-runner \
  --versions '$Default'
aws ssm get-parameter --name /beep-ci/controller/runner-ami-id
aws iam list-instance-profiles
aws iam get-instance-profile --instance-profile-name beep-ci-runner-profile
aws iam get-role --role-name '<role-from-profile>'
aws iam list-attached-role-policies --role-name '<role-from-profile>'
aws iam list-role-policies --role-name '<role-from-profile>'
aws iam get-role-policy \
  --role-name '<role-from-profile>' \
  --policy-name '<each-inline-policy-name>'
aws iam get-policy-version \
  --policy-arn 'arn:aws:iam::<acct>:policy/beep-ci-fleet-boundary' \
  --version-id '<default-version>'
aws ec2 describe-instances --region us-east-1 --filters '<fleet-tags>'
```

The local capture files are untracked. This record retains only dates, counts,
policy behavior, and redacted identifiers.

### Source reconciliation commands

```sh
codegraph explore 'CiFleetController runner bootstrap metadata profile teardown'
codegraph explore 'beep-ec2-heavy workflow routing setup-monorepo-ci fast path'
rg -n -C 3 'beep-ec2-heavy|runs-on:' .github/workflows
rg -n 'enable_jit_config|enable_ephemeral_runners|enable_ssm_on_runners|metadata_options|runner_run_as|permissions_boundary' infra/src/CiFleetController.ts
rg -n 'Baked fast path|bun_binary|sealed|0:0|755|444|digest' .github/actions/setup-monorepo-ci/action.yml
```

## P0 live-proof gaps

The launch-template, AMI-pin, profile, boundary, role-policy, instance-state,
and repository-runner inventory gaps are closed.

One P0 inventory gap remains: read
`orgs/beep-effect/actions/runner-groups` with `admin:org`, fine-grained
organization `Self-hosted runners` read, or the GitHub App equivalent. Capture
the current groups, public-repository allowance, selected repositories,
workflow restrictions, selected workflow refs, and fleet membership.

Later phases still owe deployed proof of the new policy edges, IMDS shutdown,
JIT residue removal, selected-workflow ref matching, non-fallback registration,
fresh AMI integrity, and correlated registration-to-teardown lifecycle. Those
are rollout gates, not missing facts about the current launch template, role,
boundary, or idle fleet.
