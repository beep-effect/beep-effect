---
"@beep/acp": patch
"@beep/professional-desktop": patch
"@beep/oip-web": patch
"@beep/architecture-lab-proof": patch
"@beep/practice-kg-mcp": patch
---

Close the jsdoc-carrier-migration follow-ups: regenerate the acp `schema.gen.ts` from the
converted emitter (titled Example sections; upstream `S.Number` now emitted as `S.Finite`
because OpenAPI numbers are JSON-finite, clearing 45 schemaNumber governance findings and
retiring the repo's last 342 legacy `@example` carriers), and migrate all apps legacy
carriers to titled Example sections with conservation proven (272 blocks, zero residue).
The zero-legacy documentation gate now scans `apps/**/src` in both scopes and its
generated-residual allowlist is empty. The `AcpRequestError` `data` field and its
constructors are typed as wire JSON end-to-end, so `toProtocolError()` can no longer
build a payload the `S.Json` error schema rejects at encode time, and the hosted
Test Unit CI lane keeps the 16GB turbo concurrency cap while fleet lanes return to
the 8vCPU tuning; the hosted Lint lane keeps the same 16GB-safe cap, and the fleet
Check lane stays serial so its largest `tsgo` processes cannot overlap and exhaust
the worker. The ACP coverage baseline is regenerated for the expanded generated
schema surface and now records absolute uncovered counts for future ratchets.
