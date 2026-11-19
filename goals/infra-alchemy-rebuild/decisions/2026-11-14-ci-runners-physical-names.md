---
title: "CI runners physical names are beep-fleet-<stage>, fenced from the live beep-ci and beep-ovf objects"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Change physicalNames in packages/tooling/infra/ci-runners/src/Names.ts and redeploy each stage (every pinned name replaces)."
---

Every name the `CiRunners` stack pins derives from the stage: `prod` is `beep-fleet-prod`, a personal stage `dev-alice` is `beep-fleet-dev-alice` (stage names must equal their slug since 2026-11-18, so no two stages share names, and neither `beep-fleet-<slug>` nor `beep-fleet-prod` may prefix the other) (`physicalNames` in `packages/tooling/infra/ci-runners/src/Names.ts`). Production names, all new (D12), none adopted:

| Object | Production name |
| --- | --- |
| `RunnerFleet` name, pool `ghr:environment` | `beep-fleet-prod`, `beep-fleet-prod-heavy`, `beep-fleet-prod-overflow` |
| SSM root (App parameters, token and config paths) | `/beep-fleet/prod` |
| KMS alias of the App-secrets key | `alias/beep-fleet-prod-github-app` |
| VPC, internet gateway, route table `Name` tags | `beep-fleet-prod-vpc`, `beep-fleet-prod-igw`, `beep-fleet-prod-public` |
| Subnets (`Name` tags) | `beep-fleet-prod-public-us-east-1{a,b,c,d,f}` |
| Runner security group | `beep-fleet-prod-runner` |
| Flow logs: log group, role (default path `/`, amended 2026-11-18 r4613433026), flow log | `/beep-fleet/prod/vpc-flow-logs`, `beep-fleet-prod-flow-logs`, `beep-fleet-prod-flow-log` |
| Reaper Lambda | `beep-fleet-prod-reaper` |
| Runner IAM policy (path `/beep-fleet/prod/`) | `beep-fleet-prod-runner-imds-disable` (the runner boundary policy is gone: every role carries the bootstrap fleet boundary instead) |

Why these cannot collide: the live fleet's names all start with `beep-ci`, `beep-ovf`, `/beep-ci`, `/beep-ovf`, `/github-action-runners` or `alias/beep-ci` (terraform prefixes, SSM roots, KMS alias, IAM paths, Lambda names, groundwork `beep-ci-runners-*`). `requireFencedNames` refuses any stage whose names start with one of those prefixes or are a prefix of one, before any resource is declared; a test runs it over `prod` and several personal stages. The prefix rule mattered for the composite's termination watcher, which until 2026-11-18 acted on every instance whose `ghr:environment` started with the fleet name: `beep-ci` as a fleet name would have matched the live `beep-ci` environment. Since 2026-11-18 the watcher matches the fleet's pool environments exactly, on both its event path and its queued-retry path. One stage's watcher therefore never acts on another stage's runners, even when one slug prefixes another (`dev-al` and `dev-alice`). Pool names are also dash-free, so `<prefix>-<pool>` names never collide across (prefix, pool) pairs.

Composite names, pinned (gate ruling 2026-11-14): generated names derive from the state's instance ids, so a lost or moved state would mint a second fleet beside the first (the #3133 lesson), and every other `prod` stack of this packet pins its names. `RunnerFleet` gained an optional `namePrefix` (`@beep/alchemy-github-runners/RunnerFleetNames`, lower case, at most 28 characters so the longest name fits Lambda and EventBridge 64, IAM role 64, SQS 80 and S3 63 with a 24-character pool name). `prod` sets it to `beep-fleet-prod`; personal stages leave it unset and keep Alchemy's generated names. Production composite names:

| Resource | Name |
| --- | --- |
| Lambdas (log groups `/aws/lambda/<name>` follow) | `beep-fleet-prod-webhook`, `-ssm-housekeeper`, `-binaries-syncer`, `-termination-watcher`; per pool `beep-fleet-prod-{heavy,overflow}-scale-up`, `-job-retry`, `-scale-down`; the stack's `beep-fleet-prod-reaper` |
| SQS queues | per pool `-build`, `-build-dlq`, `-job-retry`, `-job-retry-dlq`; `beep-fleet-prod-deregister-retry`, `-deregister-retry-dlq` |
| Runner roles and instance profiles | `beep-fleet-prod-{heavy,overflow}-runner` |
| Launch templates | `beep-fleet-prod-{heavy,overflow}` |
| EventBridge rules | per pool `-scale-down`; `beep-fleet-prod-ssm-housekeeper`, `-binaries-syncer`, `-spot-interruption`, `-instance-state-change`, `-reaper` |
| Binaries bucket | `beep-fleet-prod-binaries-832907639880` (S3 names are global, so the account id is appended) |

A test asserts all 40 production names (`test/CiRunners.test.ts`, "pins every production physical name"); library tests cover the prefix, the length limits and the unprefixed default.

Still generated, and why that is safe: the nine Lambda execution roles. `Lambda.Function` (Alchemy 2.0.0-beta.87) names its own role `CiRunners-<logical id>-prod-<instance suffix>` and takes no role or role-name prop. After a state loss a redeploy would create new roles, but every function name is pinned, so the create collides with the existing function instead of standing up a second fleet. Pinning the roles needs a `roleName` prop on `Lambda.Function` (an upstream Alchemy change or a bun patch; candidate for D14). Other ids are AWS-assigned (VPC, subnets, security-group rules, KMS key, event-source mappings, permission statement ids) or already pinned by the stack (SSM paths, KMS alias, policies, flow logs).

Accepted (packet gate ruling, 2026-11-14): the Lambda execution roles stay generated, with no bun patch; the deploy role keeps its `role/CiRunners-*-prod-*` allowance for those nine roles only. The `roleName` prop on `Lambda.Function` is proposed upstream under D14 (in-repo first, upstream when stable) in the packet friction ledger.

Role paths (amended 2026-11-18, #3386 r4613433026). Every fleet role sits at the default path `/`: the runner roles, the flow-logs role and every Lambda execution role. The deploy role's grants and the fleet boundary name roles by prefix (`role/beep-fleet-*`, `role/CiRunners-*`), and an ARN with a path (`role/beep-fleet/prod/beep-fleet-prod-flow-logs`) matches neither, so the flow-logs role lost its `path`. A test enumerates every planned role ARN and every Lambda execution role ARN and checks each against both pattern sets. Only the IMDS policy keeps the path `/beep-fleet/prod/`, which is where `policy/beep-fleet/prod/*` grants reach.
