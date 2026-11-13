---
title: "PR 2 merged as #3208; PR 3 (check once) open"
date: 2026-11-13
kind: checkpoint
lane: "feat/check-once"
reversal: "None needed; a status note."
---

PR 2 merged as #3208 on 2026-11-13. Its hosted gate was green except an inherited coverage ratchet row, which is the proof that nothing reads `dist/*.js`; the Exception Ledger stays empty. An inherited cache-policy red found while publishing it was fixed on `main` in #3206. The four sibling verification goals were told before the merge, when the PR was final and after it landed.

PR 3 serves the own-source check of 180 packages from the build program (decision `2026-11-13-check-runs-the-build-program`), with the Turbo edge scoped as the owner of `goals/route-soundness-repair` asked. P4 Close follows in a goals-only final PR so the completion check sees a merge-ready head.
