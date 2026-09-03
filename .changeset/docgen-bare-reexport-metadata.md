---
"@beep/api-transport": patch
"@beep/editor": patch
"@beep/html": patch
"@beep/lexical-schema": patch
"@beep/mcp-kit": patch
"@beep/observability": patch
"@beep/pandoc-ast": patch
"@beep/rdf": patch
"@beep/schema": patch
---

Add the docgen `@category`/`@since` metadata to the bare re-export statements
that Heavy / Docgen flags whenever one of these packages enters the docgen
scope. Documentation comments only; no runtime change.
