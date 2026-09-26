---
"@beep/repo-ai-metrics": minor
---

Add the harness evidence ledger schemas (`ContextSurfaceKind`, `MechanismClass`,
`LedgerDisposition`, `HarnessFingerprint`, `HarnessLedgerRow`), the derived
predicates (`isHarnessEdit`, `requiresBudget`, `isStale`, `isWarmRestart`,
`annealedEditBudget`), and the PostToolUse `surface` field on `HookPulseV1`
(a hashed context-surface id; no paths enter rows).
