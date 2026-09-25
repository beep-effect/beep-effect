---
"@beep/effect-drizzle": patch
---

Let a declared number schema name the `number` SQL carrier through the new
`NumberDeclarationRepresentation` annotation from `@beep/effect-drizzle/pg`,
so PostgreSQL model construction accepts it under `doublePrecision()` instead
of failing with "Encoded declaration has no SQL carrier".
