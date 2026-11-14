---
title: "The ci-runners reaper keys on the fleet's ghr:environment tags with the live 90-minute TTL"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Remove declareReaper from src/CiRunners.ts and redeploy; scale-down and the termination watcher remain."
---

The live groundwork stack's reaper (`infra/src/CiRunners.ts`) terminates every instance tagged `beep-ci=runner` older than `ciRunners:reaperTtlMinutes` (90) on a five-minute schedule, as a backstop the guest cannot cancel. The new stack keeps the behaviour and the TTL but ports it to an Effect program over the composite's `Ec2Fleet` service (`src/Reaper.ts`, bundled by Alchemy from `src/internal/lambda/reaper.ts`), D19's pattern, and changes what it keys on:

- It lists instances by `ghr:environment` (the tag scale-up stamps on every runner), one listing per pool environment of its own fleet (`beep-fleet-prod-heavy`, `beep-fleet-prod-overflow`), in states pending, running, stopping and stopped, and terminates those launched more than 90 minutes ago. An instance without a launch time is kept; a failed termination is logged and the pass continues.
- Its role may describe instances and terminate only instances whose `ghr:environment` is one of those values. The live reaper's `beep-ci=runner` filter is not used: composite runners carry only `ghr:*` instance tags, and keying on `ghr:environment` means neither reaper can touch the other fleet's instances during the overlap.
- One pass costs two `DescribeInstances` pages every five minutes (the live reaper costs one); scale-down already lists each pool every minute.

The reaper's function name is pinned (`beep-fleet-<stage>-reaper`); its schedule and permission take generated names.
