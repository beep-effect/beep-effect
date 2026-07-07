---
"@beep/architecture-lab-use-cases": patch
---

Crispen `@beep/architecture-lab-use-cases` for the P2 repo-crispening wave: derive action and repository error unions from schema values with tagged-union/codec statics, route repository and domain failures through exhaustive tag matching, absorb optional command/query defaults into `SchemaUtils.withNoneDefault`, annotate public command/query and error reason fields, and add encoded-shape plus `S.toArbitrary` parity coverage. Public command/query and error wire shapes remain unchanged.
