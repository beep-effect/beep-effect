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

Type-check cost, tsgo 7.0.2, fresh build-info, before (`origin/main` at 7cc0aa9b33) → after.
The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 706,043 | 202,571 → 201,092 | 1.800 → 1.135 s |
| `@beep/repo-cli` | 4,152,690 → 4,152,640 | 1,067,045 → 1,067,032 | 12.523 → 12.164 s |
| `@beep/law-practice-domain` | 874,541 → 874,541 | 259,729 → 259,729 | 1.231 → 1.302 s |

Check time is advisory within a 5% band. Flagged: `@beep/law-practice-domain` single-threaded
check time rose 5.8% (1.231 → 1.302 s) with identical instantiations and types, on a package
whose sources this change does not touch, measured on a shared, loaded workstation; its
four-checker time fell (1.067 → 0.766 s).

The default four-checker run is advisory. Its totals depend on how files split across checkers,
so the same change reads +41,833 with two checkers and −5,039 with three:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,157,412 | 367,663 → 381,308 | 0.615 → 0.517 s |
| `@beep/repo-cli` | 8,429,151 → 8,429,046 | 2,149,366 → 2,149,337 | 5.818 → 4.918 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,290,676 | 376,265 → 376,265 | 1.067 → 0.766 s |
