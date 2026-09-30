---
"@beep/lint-rules": patch
---

Drop the `no-manual-effect-runtime-in-tests` baseline row for the retired `@beep/schema`
`Number.test.ts`; its surviving `Age` suite moved to `Age.test.ts` and runs no manual runtimes.
