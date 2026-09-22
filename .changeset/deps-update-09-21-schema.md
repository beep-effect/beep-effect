---
"@beep/schema": patch
---

Adapt to effect rc.116/rc.117: `HttpMethod` gains the `QUERY` method (a body-carrying method with the `query` alias) that effect added to its own `HttpMethod` union, so `HttpApiEndpoint.Top` assigns to the repo's endpoint metadata again; `EffectSchema` declares its runtime guard explicitly because `Effect.isEffect` now narrows to `Effect<unknown, unknown, unknown>` instead of `any`; and `collectAnnotationsAt` no longer visits a constructor-default link because `SchemaAST.Context.constructorDefault` stores the bare default Effect.
