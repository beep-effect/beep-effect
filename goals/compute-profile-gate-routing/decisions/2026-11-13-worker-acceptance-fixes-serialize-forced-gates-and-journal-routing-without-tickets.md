---
title: "Worker acceptance fixes serialize forced gates and journal routing without tickets"
date: 2026-11-13
lane: "fix/compute-profile-acceptance-fixes"
reversal: "Revert the acceptance fix lane and repeat worker-host acceptance before changing the route table"
---

Findings in goals/compute-profile-gate-routing/research/2026-11-13-worker-host-acceptance.md require serial forced Fallow and coverage execution, explicit refusal of gates beyond the worker budget, admission-routed facts through the existing archive, and scoped effect-vitest lint over changed test files. Local tests are implementation proof only; repeat acceptance on dankserver before the final PR.
