---
title: Evidence seal phases share seal's transaction and validate before any delete
date: 2026-11-23
reversal: Let a phase helper commit its own transaction, or delete evidence before the seal validations finish.
governs:
  - src/evidence-retention.ts#makeEvidenceRetention
enforcedBy: []
---

Collect, verify, and commitRetirement run only inside seal's existing transaction. No phase
helper commits on its own. Every validation still finishes before recovery capture and deletion.
Rejected: an independent commit per phase. A crash between them would retire evidence the
validations had not all accepted, or leave a recovery copy the delete never reached.
