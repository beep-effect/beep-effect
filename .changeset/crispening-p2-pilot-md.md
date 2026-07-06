---
"@beep/md": patch
---

Crispen `@beep/md` (P2 pilot of repo-crispening-orchestration): colocate the
escape-schema guards onto `StringArray` and `UnsafeUrlProtocolDestination` via
`SchemaUtils.withCodecStatics`, delete the free-floating `S.is(...)` guard
walls, and add an `S.toArbitrary` guard-parity law. Public API and encoded
wire shapes are unchanged (`isStringArray` keeps a byte-identical signature).
