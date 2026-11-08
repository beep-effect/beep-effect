---
title: "Behavior proof is a committed observable-state recording, diffed pre and post move"
date: 2026-11-07
lane: "feat/execution-authority-slice"
reversal: "Delete apps/professional-desktop/test/integration/execution-authority-recording.pglite.test.ts and the recordings"
---

execution-authority-recording.pglite.test.ts drives the real desktop MCP transport over a migrated PGlite ledger: one allowed and one egress-denied publish. It records the sidecar bind host, verdict chains with verification results, outcome settlements, information_schema column pins, constraints and triggers. With EXECUTION_AUTHORITY_RECORDING_OUT set it writes JSON. research/recordings/pre-move.json (taken on cf46c70048) and post-move.json are identical after mapping the declared epistemic_execution_ prefix to execution_authority_.
