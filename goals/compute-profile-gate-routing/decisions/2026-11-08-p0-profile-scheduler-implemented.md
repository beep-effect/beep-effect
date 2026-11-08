---
title: "P0 profile + scheduler implemented"
date: 2026-11-08
kind: checkpoint
reversal: "n/a"
---

P0 landed in the lane tree: ComputeProfile, ComputeProfileSource and ComputeProfileResolution schemas; the ComputeProfileProbe reference over process.constrainedMemory with the tighten-only BEEP_COMPUTE_PROFILE Config override; MemoryStats.ceilingGib with a ceiling-clamped availableGib; the D6 GateRoute table with gateRouteFor; the scheduler refusal (ComputeProfileRefusal inside QualitySchedulerError) for hosted-only gates on worker unless forceLocal; computeProfile on attempt, admission, termination and proof-shadow facts outside every digest; and beep compute profile with --is and --json. Probe evidence is research/2026-11-08-p0-probe-evidence.md. Next: P1 sets gateRoute from yeet final-check, records forced and auto-skipped gates in the receipt, and adds the lefthook skip.
