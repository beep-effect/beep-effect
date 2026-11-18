---
title: "Live heavy bursts stay at 6 or fewer while both runner fleets exist"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Lift the cap once the old fleet is destroyed (cutover step 6), or lower the new fleet's overlap caps to 0 if a larger live burst is needed earlier."
---

Packet gate ruling, 2026-11-18, recorded as a binding precondition of cutover step 1. The account's Spot quota is 512 vCPU; the new fleet's overlap caps commit 32 (heavy 1 x 16, overflow 2 x 8) and the live fleet at its default caps holds 416 (heavy 2 x 16, overflow 48 x 8), 448 in all. While both fleets exist a live heavy burst may therefore reach at most 6 VMs (6 x 16 + 384 + 32 = 512); at 8 the two fleets would ask for more than the quota and `CreateFleet` would fail on whichever asks last. The cap binds the CI goals driver, so the gate relays it to the orchestrator; `BEEP_HEAVY_BURST_MAX` lives in the burst tooling's template outside the repo and is set by the orchestrator and driver, never by this lane. The schema's Spot budget in `CiRunnersConfig` enforces the new fleet's side of the same arithmetic.
