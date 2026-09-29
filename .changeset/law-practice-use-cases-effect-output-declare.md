---
"@beep/law-practice-use-cases": patch
---

Declare the Effect outputs of the candor and legal-position port shapes with
`S.declare` over `Effect.isEffect` and a typed guard, replacing the retired `@beep/schema`
`EffectSchema` wrapper under the "Upstream-First Foundation/Modeling" decision
(`standards/architecture/DECISIONS.md`, 2026-09-29). Port types and runtime validation are
unchanged.
