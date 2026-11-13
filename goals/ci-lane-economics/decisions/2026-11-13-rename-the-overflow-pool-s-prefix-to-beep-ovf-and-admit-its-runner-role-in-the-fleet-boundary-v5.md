---
title: "Rename the overflow pool's prefix to beep-ovf and admit its runner role in the fleet boundary (v5)"
date: 2026-11-13
lane: "ci/shard-overflow-cutover"
pullRequest: 3275
reversal: "aws iam set-default-policy-version --policy-arn arn:aws:iam::832907639880:policy/beep-ci-fleet-boundary --version-id v4 once the overflow pool is off, and revert the prefix in CiRunnerPool.ts"
---

Operator ruling 2026-11-13 (overflow-prefix-rename), applied by the CI goals finish driver.

- **Why rename.** The module's termination watcher (github-aws-runners v7.10.1, `ConfigResolver.ts`) matches instances whose `ghr:environment` tag *starts with* its own prefix, and our controllers set no `tag_filters`. With the overflow prefix `beep-ci-ovf`, the heavy pool's (`beep-ci`) spot-termination handler and notification Lambdas would also have handled every overflow VM, deregistering its runner a second time. The overflow prefix is now `beep-ovf`; `CiShardOverflowPool.test.ts` asserts that neither pool's prefix starts with the other's.
- **Why the boundary changed.** Every role the module creates carries the hand-maintained permissions boundary `beep-ci-fleet-boundary` (not managed by Pulumi). Its `PassOwnRoles` statement lets a role pass to EC2 only `arn:aws:iam::832907639880:role/beep-ci/beep-ci-*` (v4). The scale-up Lambda must pass the runner role, which the module creates at `/<prefix>/<prefix>-runner-<hash>`, so no prefix that avoids the heavy prefix fits v4. The same check showed the previous overflow prefix would never have launched a VM either: its role path was `/beep-ci-ovf/`, outside `role/beep-ci/`.
- **The change.** Boundary v5 (default since 2026-11-13, applied by the driver) differs from v4 only in `PassOwnRoles`, which now also lists `arn:aws:iam::832907639880:role/beep-ovf/beep-ovf-*` with the same `iam:PassedToService` `ec2.amazonaws.com` condition. `CiShardOverflowPool.test.ts` asserts both controllers leave `role_path` unset and that each runner role falls inside one of the two entries.
- **Proof.** No preview can exercise `iam:PassRole`, and `simulate-principal-policy` needs a role that exists. The first proof is the first overflow VM launch after enablement: `/aws/lambda/beep-ovf-scale-up` must log `Created instance(s)` with no `Create fleet` failure naming `iam:PassRole` (`docs/runbooks/ci-runner-reliability.md`, Shard overflow pool).
