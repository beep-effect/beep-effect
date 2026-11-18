---
title: "RunnerLaunchTemplate lives in @beep/alchemy-aws-extras"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-aws-extras"
reversal: "Move src/RunnerLaunchTemplate.ts and its test into @beep/alchemy-github-runners and re-export it there; the resource type string does not change."
---

The P0 matrix row placed `RunnerLaunchTemplate` in `@beep/alchemy-github-runners`; SPEC Target Surfaces and the P2 brief place it in `@beep/alchemy-aws-extras`. It lands in aws-extras: it is a generic EC2 resource (block devices, EBS optimisation, Spot options, tag specifications) with no runner semantics, which is what aws-extras holds and what goes upstream as props on `AWS.AutoScaling.LaunchTemplate`. The runner composite imports it. Its props cover the live fleet template in `infra/src/CiFleetController.ts` lines 976-1062: the AL2023 AMI through `resolve:ssm:`, a 100 GB encrypted gp3 `/dev/xvda` at 3000 IOPS and 250 MB/s, EBS optimisation, IMDSv2 with hop limit 1 and instance tags, the instance profile, security groups, a public IPv4 address, user data and launch tags.
