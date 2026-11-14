---
title: "CI runners physical names are beep-fleet-<stage>, fenced from the live beep-ci and beep-ovf objects"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Change physicalNames in packages/tooling/infra/ci-runners/src/Names.ts and redeploy each stage (every pinned name replaces)."
---

Every name the `CiRunners` stack pins derives from the stage: `prod` is `beep-fleet-prod`, a personal stage `dev_alice` is `beep-fleet-dev-alice` (`physicalNames` in `packages/tooling/infra/ci-runners/src/Names.ts`). Production names, all new (D12), none adopted:

| Object | Production name |
| --- | --- |
| `RunnerFleet` name, pool `ghr:environment` | `beep-fleet-prod`, `beep-fleet-prod-heavy`, `beep-fleet-prod-overflow` |
| SSM root (App parameters, token and config paths) | `/beep-fleet/prod` |
| KMS alias of the App-secrets key | `alias/beep-fleet-prod-github-app` |
| VPC, internet gateway, route table `Name` tags | `beep-fleet-prod-vpc`, `beep-fleet-prod-igw`, `beep-fleet-prod-public` |
| Subnets (`Name` tags) | `beep-fleet-prod-public-us-east-1{a,b,c,d,f}` |
| Runner security group | `beep-fleet-prod-runner` |
| Flow logs: log group, role, flow log | `/beep-fleet/prod/vpc-flow-logs`, `beep-fleet-prod-flow-logs`, `beep-fleet-prod-flow-log` |
| Reaper Lambda | `beep-fleet-prod-reaper` |
| Runner IAM policies (path `/beep-fleet/prod/`) | `beep-fleet-prod-runner-imds-disable`, `beep-fleet-prod-runner-boundary` |

Why these cannot collide: the live fleet's names all start with `beep-ci`, `beep-ovf`, `/beep-ci`, `/beep-ovf`, `/github-action-runners` or `alias/beep-ci` (terraform prefixes, SSM roots, KMS alias, IAM paths, Lambda names, groundwork `beep-ci-runners-*`). `requireFencedNames` refuses any stage whose names start with one of those prefixes or are a prefix of one, before any resource is declared; a test runs it over `prod` and several personal stages. The prefix rule matters for the composite's termination watcher, which acts on every instance whose `ghr:environment` starts with the fleet name: `beep-ci` as a fleet name would have matched the live `beep-ci` environment. The stage is always in the name, so the `prod` watcher prefix never matches a personal stage's runners (one personal slug can still prefix another, for example `dev-al` and `dev-alice`).

Not pinned: the resources inside `RunnerFleet` that take no name prop (Lambdas, queues, roles, instance profiles, the binaries bucket, launch templates, rules) get Alchemy's generated names `CiRunners-<logical id>-prod-<instance suffix>`, which start with the stack name and so cannot equal a live name. Being instance-derived, they would change if the state were lost or moved; pinning them needs a name-prefix prop on `RunnerFleet` (open question for the gate, not needed for greenfield).
