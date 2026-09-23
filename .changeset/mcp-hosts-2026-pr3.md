---
"@beep/gov-legal-mcp": minor
"@beep/law-practice-server": minor
"@beep/practice-kg-mcp": minor
"@beep/mcp-kit": patch
---

Serve MCP `2026-07-28` only from gov-legal-mcp and the practice-kg host: both pin
`statelessMcpProtocols`, advertise `instructions` through `server/discover`, expose a
registrations-only layer, and pass the kit conformance port. The compiled practice-kg
smoke speaks the stateless framing. A legacy `initialize` is answered with `-32022`.
