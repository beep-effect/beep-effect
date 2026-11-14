---
title: "Pin the prod bucket and Worker names: beep-turbo-cache"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "Remove productionNames from src/TurboCache.ts; prod then takes generated names from state-held instance ids."
---

Alchemy names a bucket or Worker from an instance id it keeps in state, so a stage whose state is lost or moved mints new ones (PR #3133). `prod` pins both to `beep-turbo-cache` (greenfield, D12: neither the AWS cache nor the pilot bucket `beep-turbo-r2-pilot` is touched), giving CI a stable `TURBO_API` of `https://beep-turbo-cache.beep-effect.workers.dev`. Personal stages keep generated names. The stage is read with `Effect.serviceOption(Stage)`, so the bundled Worker runtime, which has no `Stage`, never sees a stage-dependent prop. `RemovalPolicy.retain` holds the bucket and the tokens in `prod` only.
