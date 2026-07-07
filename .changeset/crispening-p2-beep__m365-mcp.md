---
"@beep/m365-mcp": patch
---

Crispen `@beep/m365-mcp` for the P2 repo-crispening wave: tighten the MCP tool failure schema with non-empty fields, model optional Microsoft 365 failure reasons as an `Option` backed by the upstream driver reason domain, preserve encoded failure payloads, and add package-local wire-shape plus `S.toArbitrary` parity laws for the package-owned schemas.
