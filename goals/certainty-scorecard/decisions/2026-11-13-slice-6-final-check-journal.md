---
title: "Slice 6 (MEAS-07) journals final-check attempts"
date: 2026-11-13
kind: checkpoint
lane: "feat/certainty-meas-07-final-check-journal"
reversal: "Delete this checkpoint so the slice-3 checkpoint is the latest PLAN status note, and revert the slice-6 PR."
---

Slice 3 (MEAS-02 with DEPS-10) merged as #3176. Slice 6 writes every `yeet final-check` run past the dirty-tree refusal to the branch's Yeet attempt journal as a `final-check` attempt, with the receipt it wrote, through `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` and `AttemptJournal.ts` (decision `final-check-attempt-journal`). The admission gate is `packages/tooling/tool/cli/test/yeet-final-check-journal.test.ts`: unit tests for the terminal rows (pass, red gate, refusal, interrupt, defect, codec round-trip), a scratch-repository run that journals three attempts and folds them in economics, and the ready-gate regression fixture, in which `yeet ready` admits and refuses on the head receipt exactly as before while the journal holds an earlier passing receipt for the same head. Next startable once this merges: PERIL-11 slice 1 (slice 7, export attempt journals on retire) and MEAS-03 (slice 10, terminations apart from reds). Slices 4 and 5 run in their own lanes.
