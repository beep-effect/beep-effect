---
"@beep/mcp-kit": patch
"@beep/oxigraph": patch
"@beep/ontology-domain": patch
"@beep/ontology-use-cases": patch
"@beep/ontology-server": patch
---

Add the authenticated ontology MCP caller context, fail-closed TierGate
mutation handlers, per-change actor attribution, and the sidecar transport
support required by the professional desktop `/mcp` mount. Fix the Oxigraph
SPARQL binding conversion to treat empty language tags as plain literals, and
sanitize defect-class tool errors so MCP clients receive stable generic text
instead of server stack traces.
