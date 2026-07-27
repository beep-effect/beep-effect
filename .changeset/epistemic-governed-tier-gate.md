---
"@beep/epistemic-server": patch
"@beep/professional-desktop": patch
---

Land `GovernedTierGateLive`: `epistemic/server` implements `@beep/mcp-kit`'s
`TierGateShape` with a per-session frozen grant set (run store keyed by
`clientId`), write-ahead fail-closed ledger decisions (no record, no action),
and settlement persistence through the execution ledger. The professional
desktop MCP transport swaps `fromApprovedToolsPolicy` for the governed gate,
with the Drizzle ledger, epistemic config, and the shared PGlite provided at
the entrypoint.
