---
{}
---

No release: satisfy the hosted Check lane's `effect(preferTypedSchemaDecoder)` diagnostic
(TS377112) in `packages/workspace/use-cases/test/ThreadTimeline.test.ts`.

The two timeline-item fixtures were decoded through `S.decodeUnknownSync` although their
object literals are already assignable to the schemas' Encoded types; the typed
`S.decodeSync` form preserves compile-time checking of those literals. Inherited-from-main
hosted red observed on PR #656; the diagnostic only surfaces on the hosted Check lane —
the local check invocation does not emit language-service plugin diagnostics even on a
cold build.
