---
title: "Slice 7 (PERIL-11 slice 1) files attempt journals on removal"
date: 2026-11-13
kind: checkpoint
lane: "fix/certainty-peril-11-journal-export"
reversal: "Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-7 PR."
---

Slice 6 (MEAS-07) merged as #3228. Slice 7 files a checkout's Yeet attempt journals in the workstation attempt-journal store before any removal deletes it, and before residue-reap deletes a directory that holds checkouts; `yeet economics --fleet` reads the store as `(retained)`, so retired lanes stay in the fleet census (decision `attempt-journal-store`). The export runs in `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts` (inside the archive fence, before any capture, and before a plain removal), where a copy failure refuses the removal with preservation step `export-attempt-journals`, and in `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts`, where it keeps the directory with skip reason `journal-export-failed`. The admission gate is `packages/tooling/tool/cli/test/yeet-attempt-journal-store.test.ts`: retire against a planted copy failure, retire, restore from the archive ref, retire again (a duplicate import that appends only the new attempt), residue-reap with `maxAgeDays: 0`, residue-reap before a retirement, and a Codex worktree removal, with a fleet census after each step that holds each (runId, attemptId) once. Prune: the store has none; once it passes 256 MB, a prune needs its own decision (the store held 0 bytes at landing; the workstation's 371 live journals total 8.9 MB). Next startable once this merges: PERIL-11 slices 2 and 3 (slices 8 and 9).
