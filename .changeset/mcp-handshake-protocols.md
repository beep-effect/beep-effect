---
"@beep/mcp-kit": patch
"@beep/uspto-mcp": patch
"@beep/gov-legal-mcp": patch
"@beep/law-practice-server": patch
---

Let the USPTO and gov-legal MCP hosts start under Claude Desktop. Both listed
only the stateless `2026-07-28` protocol, so the classic `initialize` request
Claude Desktop opens with was refused ("initialize is not supported by the
configured MCP protocols") and the server never started. `@beep/mcp-kit` now
exports `handshakeMcpProtocols` (the stateless adapter first, then
`2025-11-25`, `2025-06-18`, `2025-03-26` and `2024-11-05`); both hosts pass it,
and `practiceKgMcpProtocols` is now an alias of it, so the repo has one list.
`statelessMcpProtocols` stays for hosts only stateless clients reach. The
hosts' advertised instructions now say that both the handshake and direct
calls work, and the kit test surface gains `withStdioServer` to drive a host's
own stdio layer.
