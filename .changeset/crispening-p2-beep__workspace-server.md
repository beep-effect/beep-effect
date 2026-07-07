---
"@beep/workspace-server": patch
---

Crispen `@beep/workspace-server` for the P2 repo-crispening wave: move ThreadStore construction ids, turn indexes, titles, and in-memory defaults into local schemas with field annotations, route timeline item projection through exhaustive discriminator matching, remove Drizzle row casts, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public service signatures and encoded persistence shapes remain unchanged.
