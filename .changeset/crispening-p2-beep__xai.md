---
"@beep/xai": patch
---

Crispen `@beep/xai` for the P2 repo-crispening wave: move config/request/error/language-model defaults into schema constructors, tighten xAI URL, status, SSE index, WebSocket close-code, model-name, and query-value schemas, colocate codec and LiteralKit statics without changing public helper signatures, route service dispatch through schema-owned matchers, and add encoded-shape snapshots plus `S.toArbitrary` encoded round-trip laws for package-owned schemas. Public encoded wire shapes remain unchanged.
