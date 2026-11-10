---
title: "COVE-08 owns the Coverage Regression job name; PERIH-01 slice 1 leaves that line alone"
date: 2026-11-09
reversal: "Supersede with matching decision files here and in route-soundness-repair that move the line to PERIH-01."
---

COVE-08 (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. Both outputs are then set explicitly or have no consumers, which meets the MAP.md reviewer constraint. COVE-08 is assigned to route-soundness-repair by D23. Rejected: removing both name conditionals in PERIH-01 slice 1 (lands COVE-08's change without its route replay of context emission).

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D23); `explorations/ten-minute-certainty/MAP.md` (Reviewer constraints); coordinator arbitration of the 2026-11-09 review round.
