---
{}
---

No release required: all touched packages are private workspace packages.
Adds the private `@beep/uspto-mcp` MCP host (thin USPTO proving host wired
through `@beep/mcp-kit`'s `SourceAuth`/`ToolkitComposition`/`ApiKeyRequired`/
`FieldTier`); adds `@beep/mcp-kit`'s new `sanitizedToolkit` export (a drop-in
`McpServer.toolkit` replacement with dispatch wrapped in
`withSanitizedToolSpan`, since upstream `effect/unstable/ai` offers no
dispatch-wrapping seam); and retrofits `@beep/nlp-mcp` and `@beep/m365-mcp`
onto `sanitizedToolkit` plus `@beep/mcp-kit`'s four-hint annotation helper,
discharging the kit's `foundation/capability` ≥2-consumer gate with real,
grep-verifiable importers.
