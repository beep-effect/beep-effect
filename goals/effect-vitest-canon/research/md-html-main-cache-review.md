# Markdown cache reconciliation after HTML merge

Base: main 9cb79ddda2b72c426b322045fee9f5131b92a13c, including HTML #1279
and effect-drizzle #1277. Preserve the complete main projection, qualification
profile, epoch, scope and configuration sources. Restore only the nine reviewed
Markdown task dependency lists introduced by its test-runner dependency.
Commands and configuration are identical for these nodes; only runner edges are
added. Dependency multiplicities are preserved. This is no qualification promotion.

- `@beep/md#audit`
- `@beep/md#build`
- `@beep/md#check`
- `@beep/md#coverage`
- `@beep/md#doctest`
- `@beep/md#lint:deprecated-apis`
- `@beep/md#package-test-typecheck`
- `@beep/md#test`
- `@beep/md#test:property`

Cache audit against the merged checkout remains required.
