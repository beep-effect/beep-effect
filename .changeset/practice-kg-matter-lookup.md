---
"@beep/law-practice-use-cases": patch
"@beep/law-practice-server": patch
"@beep/practice-kg-mcp": patch
---

Add the practice knowledge-graph matter-lookup contract: `matters` and `matter_dockets` tables in the bundle DuckDB, the `PracticeKgMatterLookup` service, the `kg_matter_lookup` MCP tool, and `extractPracticeKgReferences`. Carry candidate claims into a rebuilt bundle with `claims.ts --carry-from`, verify a bundle with `verify.ts`, report tool failures with a reason, name withheld columns, return search match offsets, and version the DuckDB store as format 2.

Answer the `initialize` handshake again: the practice KG host lists the handshake-era MCP protocol versions after the stateless one, so Claude Desktop can start the installed extension. The extension package carries a real version.
