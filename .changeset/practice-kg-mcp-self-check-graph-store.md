---
"@beep/practice-kg-mcp": patch
---

`--self-check` names the graph store and carries the PGlite error text when
`kg.pglite` will not open, and refuses an empty `kg.pglite` folder or an empty
`practice.duckdb` before opening it, so the check never creates a store inside
a bundle.
