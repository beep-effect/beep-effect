---
title: The caller read keeps the legacy session header
date: 2026-11-26
reversal: Delete mcpSessionIdHeader and the McpServerClient branch of readCaller, reading the caller from McpRequestContext alone.
governs:
  - src/SanitizedSpan.ts#mcpSessionIdHeader
  - src/SanitizedSpan.ts#readCaller
enforcedBy: []
---

`readCaller` dual-reads the caller: `McpRequestContext` is present on every rc.117 dispatch,
stateless or legacy; `McpServerClient` exists only on an initialized legacy session. The
`mcp-session-id` header, which a stateful (pre-2026-07-28) transport mints at `initialize`
and upstream keeps private, is read only when such a client exists, so a stateless dispatch
always reports `sessionId: None` whatever headers the POST carried.

Rejected: a stateless-only read, which would drop the session id of hosts still on a
session-era adapter.

Accepted limit: transitional. Delete the header read and the client branch with the last
host on a session-era adapter.
