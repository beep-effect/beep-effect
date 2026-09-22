---
"@beep/mcp-kit": patch
"@beep/gov-legal-mcp": patch
---

Rebase `sanitizedToolkit` on the rc.117 MCP `2026-07-28` adapter (dual-read caller identity,
strict decode, `outputSchema`, upstream failure classification, named `api_key_required`
translator), add the product-neutral dispatch anchor and protocol pins, ship the kit-owned
`@beep/mcp-kit/client` (HTTP and NDJSON protocols, `server/discover` first) with its Node stdio
entry, and add the `@beep/mcp-kit/test/Conformance` port. The gov-legal host test follows the
declared-failure projection (envelope in `content[].text`).
