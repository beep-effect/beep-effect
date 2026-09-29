---
"@beep/schema": patch
---

Retire the instance and declare wrappers under the "Upstream-First Foundation/Modeling"
decision (`standards/architecture/DECISIONS.md`, 2026-09-29): `AbortSignal`, `DomDragEvent`,
`DomEvent`, `DomHtmlElement`, `DomMouseEvent`, `EffectSchema`, `PromiseSchema`, and `Thunk`
are deleted with their barrel and subpath exports, and no alias is left behind. Upstream covers
each one: `S.instanceOf(...)` for runtime instances, `S.declare(...)` over `Effect.isEffect`,
`Predicate.isPromise`, or `Predicate.isFunction` for the rest. Every consumer migrates in the
same change.

Type-check cost, tsgo 7.0.2, fresh build-info, before → after. The gate is the
`--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 706,043 | 202,571 → 201,092 | 1.076 → 0.969 s |
| `@beep/repo-cli` | 4,126,448 → 4,126,398 | 1,059,620 → 1,059,612 | 11.661 → 11.906 s |
| `@beep/law-practice-domain` | 874,541 → 874,541 | 259,729 → 259,729 | 1.296 → 1.413 s |

The default four-checker run is advisory. Its totals depend on how files split across checkers,
so the same change reads +41,833 with two checkers and −5,039 with three:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,157,412 | 367,663 → 381,308 | 0.552 → 0.515 s |
| `@beep/repo-cli` | 8,433,860 → 8,433,809 | 2,153,175 → 2,153,212 | 6.217 → 5.127 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,290,676 | 376,265 → 376,265 | 0.788 → 0.755 s |
