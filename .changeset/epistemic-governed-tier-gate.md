---
"@beep/epistemic-server": patch
"@beep/mcp-kit": patch
"@beep/professional-desktop": patch
---

Land `GovernedTierGateLive`: `epistemic/server` implements `@beep/mcp-kit`'s
`TierGateShape` with a per-session frozen grant set, write-ahead fail-closed
ledger decisions (no record, no action), and settlement persistence correlated
by dispatch fiber. Every governed refusal reaches the caller reason-free; the
bounded denial reason goes only to the ledger row and the server log.

`McpCallerIdentity` gains `sessionId`, read from the `mcp-session-id` header by
`sanitizedToolkit`. It is the only stable per-session key a dispatch can see —
`clientId` is minted per request by the HTTP protocol — and is `None` on
transports that issue no session id.

The professional desktop MCP transport swaps `fromApprovedToolsPolicy` for the
governed gate, with the Drizzle ledger, epistemic config, and the shared PGlite
provided at the entrypoint.
