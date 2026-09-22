---
"@beep/m365-mcp": minor
"@beep/uspto-mcp": minor
"@beep/mcp-kit": patch
---

Serve MCP `2026-07-28` only: both stdio hosts pin `statelessMcpProtocols`, advertise
`instructions` through `server/discover`, expose a registrations-only layer, and pass the
kit conformance port. A legacy `initialize` is answered with `-32022`.
