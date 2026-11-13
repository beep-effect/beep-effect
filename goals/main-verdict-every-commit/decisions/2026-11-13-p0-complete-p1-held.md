---
title: "P0 complete; P1 held until the scorecard reports first-wave pickup and heavy wait"
date: 2026-11-13
kind: checkpoint
lane: "claude/amazing-swirles-67011b"
reversal: "Set P0 back to in-progress and delete this checkpoint if a P0 fact is found unrecorded."
---

P0 Research is complete: slice 1 merged (#3111, guard #3140), and each P0 fact is recorded with its evidence: decision `scorecard-field-census` (which scorecard fields report main verdicts, first-wave pickup, heavy wait and cancel attribution), decision `rerun-api-cancelled-push-runs` (the re-run API and cancelled push runs) and the history note `2026-11-13-pre-ban-main-verdict-rate`. P1 stays pending: slice 2 (the replay) is held under SPEC "Stop Conditions" because the scorecard cannot report first-wave pickup or heavy wait, and slices 3 and 4 gate on the replay. The two measured days of Check runs (decision `check-run-queue-measurements`) are calibration input for the replay, not a substitute for the scorecard.
