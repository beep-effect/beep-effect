---
"@beep/gov-legal-mcp": minor
"@beep/identity": patch
---

Adds the private `@beep/gov-legal-mcp` MCP host: a thin, read-only stdio
server exposing bounded GovInfo and eCFR toolkits (`govinfo_search`,
`ecfr_list_titles`, `ecfr_search_results`, `ecfr_get_structure`) through
`@beep/mcp-kit`'s `SourceAuthRegistration`/`gatedLayer`/`composeGatedLayers`
composition and `sanitizedToolkit` dispatch. eCFR mounts keyless (`none`
gate); GovInfo is `hard`-gated on `GOVINFO_API_KEY` and vanishes at
composition when the key is absent. Ships the deterministic tool-name
collision contract: driver-prefixed normalization to `^[a-zA-Z0-9_-]+$`, a
64-character cap with an 8-hex SHA-256 digest suffix, fail-closed duplicate
detection, and a checked-in byte-stable collision report regenerated via the
package-local generator.
