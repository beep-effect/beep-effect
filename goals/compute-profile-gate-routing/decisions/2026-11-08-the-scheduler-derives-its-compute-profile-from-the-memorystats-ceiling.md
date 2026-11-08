---
title: "The scheduler derives its compute profile from the MemoryStats ceiling"
date: 2026-11-08
reversal: "Resolve the profile in withQualityAdmission through ComputeProfileProbe instead of resolveComputeProfileForCeiling"
---

withQualityAdmission resolves the profile with resolveComputeProfileForCeiling(min(MemTotal, ceilingGib), envelope), the same override rule as the probe, instead of calling the live probe. The refusal and the capacity view therefore never disagree, and scheduler tests stay deterministic on 16 GiB hosted runners where the live probe would say worker. Requests whose envProfile is hosted are never refused (D5).
