# @beep/infra-ci-runners

The `CiRunners` Alchemy stack: the self-hosted GitHub Actions runner fleet,
built beside the Pulumi `beep-ci-runners/production` fleet under new names
(`goals/infra-alchemy-rebuild`, phase P5, D2, D12, D19). Nothing here has been
deployed; the first `prod` deploy waits for the CI window-5 verdict.

## Design

Order: schema and typed configuration, then the guards, then the resources.

### Configuration (`src/Config.ts`, `src/Credentials.ts`, `src/Names.ts`)

`CiRunnersConfig` is one `S.Opaque` struct per stage, decoded before any
resource: the guarded account and region, the phase (`overlap` beside the live
fleet, `primary` after the workflow move), the Spot quota and the live-fleet
reserve, the network (VPC `10.89.0.0/16`, five public `/20` subnets), the
runner image (pinned baked AL2023 AMI, 100 GB gp3 `/dev/xvda`), the two pools
(live instance types, live caps, small overlap caps, new labels, the live org
runner groups) and the reaper TTL. The schema refuses a stage whose worst-case
Spot vCPU plus the reserve exceeds the quota.

| Stage | Phase | Heavy cap | Overflow cap | Runner type | Allowed repositories | App credentials |
| --- | --- | --- | --- | --- | --- | --- |
| `prod` | `overlap` | 1 (live 2) | 2 (live 48) | Org | `beep-effect/beep-effect` | `CI_RUNNERS_GITHUB_*` from the `ci-runners-prod` environment |
| `dev_$USER` | `overlap` | 0 | 0 | Repo | none | placeholders |
| `dev_$USER` with `CI_RUNNERS_REHEARSAL_REPOSITORY` | `overlap` | 1 | 1 | Repo | the sandbox repository | `CI_RUNNERS_GITHUB_*` through `op run` |

Every physical name derives from the stage (`beep-fleet-<stage>`), and a guard
refuses any name that overlaps the live fleet's (`beep-ci`, `beep-ovf`,
`/github-action-runners`).

### Resources (`src/CiRunners.ts`)

| Area | Resources | Pinned production names |
| --- | --- | --- |
| Network (`src/Network.ts`) | VPC, empty default security group, internet gateway, route table and default route, 5 subnets and associations, zero-ingress runner security group (egress 443, 80, 53 TCP/UDP, 123 UDP), VPC flow logs, log group, flow-logs role | `beep-fleet-prod-vpc`, `beep-fleet-prod-runner`, `/beep-fleet/prod/vpc-flow-logs`, `beep-fleet-prod-flow-logs` |
| Runner IAM | IMDS-disable managed policy, runner permissions boundary | `beep-fleet-prod-runner-imds-disable`, `beep-fleet-prod-runner-boundary` |
| Fleet (`RunnerFleet` from `@beep/alchemy-github-runners`) | KMS key and alias, three App SecureString parameters, binaries bucket, one webhook function URL for both pools, per pool a launch template, runner role, instance profile, build and job-retry queues, scale-up, job-retry and scale-down functions; termination watcher, SSM housekeeper, binaries syncer, `RunnerSweep` | `alias/beep-fleet-prod-github-app`, `/beep-fleet/prod/...` |
| Reaper (`src/Reaper.ts`) | Effect Lambda, five-minute schedule, invoke permission | `beep-fleet-prod-reaper` |

Runners run the live post-install (`src/RunnerBootstrap.ts`): the toolbelt
fallback, the per-job IMDS hook and the IMDS boundary shim that disables IMDS
before the runner starts and powers the instance off when it exits.

### Guards (`src/Guards.ts`)

`prod` refuses to plan or deploy outside CI (`CI=true`); every stage refuses
another account or region (`requireDeployTarget` from
`@beep/alchemy-aws-extras`) and names that overlap the live fleet.

### Pre-deploy gate (`plan-check.ts`, `src/PlanCheck.ts`)

Reads the plan log and refuses any replace, delete or orphan, any resource
outside the stack and any line it cannot read; see the runbook.

## Commands

Personal-stage plan (read-only, no credentials needed):

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/ci-runners
bunx alchemy plan --stage "dev_$USER" --env-file /dev/null
```

Expect 66 creates and 9 binding changes. `prod` is planned and deployed only
by the deploy workflow.

## Development

```bash
bun run check
bun run test
bun run lint:fix
```

Tests run the whole stack on `@alchemy.run/test` with in-memory state and
recording fake providers (`test/support/Fakes.ts`); the destroy test checks
that the runner sweep runs before any network object, launch template or
scale-up function is deleted.

## License

MIT. The fleet composite ports github-aws-runners/terraform-aws-github-runner
v7.10.1 (MIT); see `@beep/alchemy-github-runners`.
