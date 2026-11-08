---
title: "Invalidate preparation before a bootstrap reinstall"
date: 2026-11-08
kind: checkpoint
lane: "codex/audit-bootstrap-stamp"
reversal: "Revert the stamp ordering and its regression together; preserve the private original and counterexample receipts."
---

A supplemental T43 finding exposed an install/prepare stamp ordering gap. In a synthetic cache with a current prepare stamp and a missing install stamp, the old source can finish reinstalling and publish the install stamp, then stop before invalidating preparation. The next run can skip both steps. Invalidate the prepare stamp before starting reinstall so interruption or failure cannot preserve that stale success. The existing hermetic bootstrap suite now has a cache-reinstall regression with a failing late-cleanup stub: the original source fails it and the repaired source passes all 30 tests. Package lint and check pass; bash syntax passes. ShellCheck is unavailable locally (command not found), so no ShellCheck success is claimed. This does not prove actual VM frequency, installed compiler correctness or campaign completion. PM and ADHD remain separate, source records stay private, and no cloud work or spending is admitted.
