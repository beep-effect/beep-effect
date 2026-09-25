---
"@beep/identity": patch
"@beep/utils": patch
"@beep/wink": patch
---

Keep every test file in its own worker under coverage for `@beep/identity`, `@beep/utils`, and
`@beep/wink`: their suites depend on per-file module state (runtime error singletons, property
instrumentation, the wink engine) and broke once `vitest.shared.ts` began sharing the module graph
under coverage.
