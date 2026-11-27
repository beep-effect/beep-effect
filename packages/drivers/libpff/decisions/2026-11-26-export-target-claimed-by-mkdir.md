---
title: An export owns its target through a non-recursive mkdir claim that no policy steals
date: 2026-11-26
reversal: Remove acquireExportClaim and the `.claim` path from src/Libpff.pffexport.ts and rely on the existing-export policy's exists-check.
governs:
  - src/Libpff.pffexport.ts#makePffexportFileProcessingEngine
enforcedBy: []
---

Two concurrent exports of the same content-addressed source derive identical target paths, and duplicate PSTs are common in real corpora.
Each export creates `<target>.claim` with a non-recursive mkdir before it writes, holds it for the run and always releases it; an existing claim fails the export under every existing-export policy.
Reason: the driver cannot tell a live concurrent export from a crashed run's leftover, so `replace` must not take the claim; recovering a crashed run means removing the `.claim` path or choosing a fresh export root.
A successful export releases the claim itself and reports a failed release as a result warning; the `ensuring` backstop stays silent because failure paths already carry their own error.
Rejected: an exists-check on the target trees alone, which leaves a window where both exports pass before either writes.
