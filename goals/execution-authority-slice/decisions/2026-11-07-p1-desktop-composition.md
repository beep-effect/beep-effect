---
title: "No desktop runtime Layer change: main.ts already composes ExecutionLedgerDrizzle"
date: 2026-11-07
lane: "feat/execution-authority-slice"
reversal: "Merge ExecutionLedgerDrizzle back into EpistemicServerDrizzleLive"
---

EpistemicServerDrizzleLive no longer provides ExecutionLedger. apps/professional-desktop/src/runtime/Layer.ts only Layer.provides it to the contradiction QA seed, whose output never included the ledger, and server/main.ts already provides ExecutionLedgerDrizzle beside PgliteDrizzleLive to the governed MCP transport. Typecheck of @beep/professional-desktop and the four desktop integration suites confirm it.
