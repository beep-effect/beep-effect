---
"@beep/drizzle": patch
---

Crispen `@beep/drizzle` for the P2 repo-crispening wave: move Drizzle error context absence into `Option` schema fields with constructor defaults, colocate row and error guard statics, tighten operation and redacted parameter schemas, remove a duplicated EntitySchema column-name fallback, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded wire shapes remain unchanged; the cross-package EntitySchema index-hints default is deferred to the family-close sweep.
