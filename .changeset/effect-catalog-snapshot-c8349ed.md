---
"@beep/schema": patch
---

Pin the Effect catalog to the pkg.pr.new snapshot of Effect-TS/effect main
commit c8349ede1a (ahead of the next v4 RC) and migrate the repo to its
breaking changes: PascalCase Config/CLI constructors, SchemaGetter and
SchemaTransformation `transformEffect` renames, the native
`effect/unstable/arbitrary/Arbitrary` model replacing the fast-check bridge,
`ByteSize` file sizes, the native PostgreSQL client, and relocated HTTP
schemas.
