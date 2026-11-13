---
title: "P0 complete: PR 1 merged as #3178; PR 2 open with after numbers"
date: 2026-11-13
kind: checkpoint
lane: "feat/declaration-only-build"
reversal: "None needed; a status note."
---

PR 1 merged as #3178 on 2026-11-13. The inherited check-census red found on the way (baseline stamped with an old compiler) was fixed on `main` in #3192.

PR 2 measured back to back with a fresh before: serial build work of 181 packages 80.9 s to 32.9 s, `dist` 232.5 MB to 147.9 MB, compile unchanged. PR 2 adds 1,192 single-checker instantiations to `@beep/repo-cli` (the retirement schemas in the scripts policy), so it re-measures the check-census baseline; the gate is a strict ratchet and passes afterwards.
