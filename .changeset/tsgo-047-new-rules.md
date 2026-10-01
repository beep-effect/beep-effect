---
"@beep/acp": patch
"@beep/ai-provider-cli": patch
"@beep/obs": patch
"@beep/effect-drizzle": patch
---

Adopt the `@effect/tsgo` 0.47 diagnostics: pending-request cleanup now uses
`Effect.tapError` instead of catching and re-failing, the private symlink
replacement sequences with `Effect.andThen`, and the Effect Drizzle test suites
satisfy the rules 0.47 now resolves through named `effect/Effect` imports.
