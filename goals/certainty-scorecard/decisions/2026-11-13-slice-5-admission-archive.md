---
title: "Slice 5 (SCHE-09 slice 1) in review: trimmed admission rows archived and folded"
date: 2026-11-13
kind: checkpoint
lane: "feat/certainty-sche-09-admission-archive"
reversal: "Delete this checkpoint so the slice-3 checkpoint is the latest PLAN status note, and revert the slice-5 commit."
---

Slice 3 (MEAS-02 with DEPS-10) merged as #3176. Slice 5 archives the rows the 200-admission ring trims to UTC day segments kept for 30 days under the admission root, folds them with the live journal in `bun run beep quality scheduler history`, and prunes aged segments in the scheduler reap pass (decision `sche-09-admission-archive`). The SCHE-09 pressure fields are the new slice 5b. local-proof-under-ten can read the retained history before its scheduler levers (SCHE-08, SCHE-07, SCHE-01/02) once every live checkout runs this revision. Still startable in the second wave: the certainty-nightly workflow (slice 4) and MEAS-07 final-check attempt journals (slice 6).
