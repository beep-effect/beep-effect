---
"@beep/law-practice-use-cases": patch
---

Declare the Effect outputs of the candor and legal-position port shapes with one
package-internal `EffectOutput<A, E, R>()` schema, `S.declare` over `Effect.isEffect` with a
typed guard, replacing the retired `@beep/schema` `EffectSchema` wrapper under the
"Upstream-First Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`,
2026-09-29). Port types and runtime validation are unchanged; `EffectOutput` is re-exported
from `@beep/law-practice-use-cases/test` for the guard and codec tests.
