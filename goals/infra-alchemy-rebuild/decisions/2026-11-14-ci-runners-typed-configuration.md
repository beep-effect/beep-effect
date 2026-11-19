---
title: "CI runners typed configuration carries the live pool values and a Spot vCPU budget the schema enforces"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Edit productionConfig in src/Config.ts; drop the Spot budget check by removing the S.check on CiRunnersConfig."
---

`CiRunnersConfig` (`src/Config.ts`) is the stack's typed configuration, decoded before any resource and carrying the live values as `productionConfig`:

- Pools, from `infra/src/CiRunnerPool.ts` and `infra/src/CiFleetController.ts`: heavy, seven 64 GiB types (`r7a.2xlarge`, `r7i.2xlarge`, `r6i.2xlarge`, `m7a/m7i/m6a/m6i.4xlarge`), cap 2, runner group `beep-ec2-heavy`; shard overflow, the three 8-vCPU types, cap 48, group `beep-shard-overflow`. Both Spot only, `capacity-optimized`, bidirectional label match, ephemeral JIT runners, job-queued check off, job retry 2 attempts / 120 s / backoff 2, minimum running time 5 minutes (the `RunnerPool` defaults already equal the live module inputs).
- Image: the baked AL2023 AMI `ami-07af50c345b5ba065` (`ciFleetController:amiId` in `infra/ci-runners/Pulumi.production.yaml`, last written by `beep runners bake` per `infra/ci-runners/runner-image.json`), root `/dev/xvda`, 100 GB gp3, 3000 IOPS, 250 MB/s, encrypted, EBS-optimized, public IP, run as `ec2-user`. The id is pinned in source, not read from an SSM parameter, so an unrelated deploy never moves the image; the live `/beep-ci/controller/runner-ami-id` parameter is not carried over.
- Network: a new VPC `10.89.0.0/16` (live is `10.88.0.0/16`), five `/20` public subnets in the live zones `us-east-1a,b,c,d,f`, flow-log retention 14 days.
- Reaper TTL 90 minutes; region `us-east-1`; account `832907639880`.
- Spot budget: the schema refuses a stage whose worst-case Spot vCPU exceeds the account quota (512, "All Standard Spot Instance Requests", read 2026-11-14). A phase field chooses the caps: `overlap` (beside the live fleet) runs heavy at 1 and overflow at 2 and reserves 416 vCPU for the live fleet (heavy 2 × 16 + overflow 48 × 8), committing 448; `primary` (after the workflows move) runs the live caps and reserves nothing. `prod` starts in `overlap`. The 64 vCPU left in the overlap means a live heavy burst may go to at most 6 VMs until the move; the live burst cap of 8 is already the whole quota with the live overflow pool at 48. Amended 2026-11-18 (review of #3386): the reserve is now 480, the live fleet at the agreed burst cap of 6 (heavy 6 × 16 + overflow 48 × 8), so the overlap commits exactly 512 and the budget check itself refuses a larger overlap cap; a personal stage reserves 480 + 32 = 512, so a rehearsal that launches anything is refused (a `ConfigError`) while the overlap lasts.
