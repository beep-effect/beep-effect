---
"@beep/schema": minor
---

Retire the `Int` concept under the "Upstream-First Foundation/Modeling" decision
(`standards/architecture/DECISIONS.md`, 2026-09-29). `Int`, `PosInt`, `PostgresSerialInt`,
`NegInt`, and `NonPositiveInt` are deleted with their barrel entry and the `@beep/schema/Int`
subpath; no alias is left behind. Upstream covers each one: `S.Int` and its
`S.isGreaterThan(0)`, `S.isLessThan(0)`, `S.isLessThanOrEqualTo(0)`, and `S.isBetween(...)`
compositions. `NonNegativeInt` stays in `@beep/schema/Number`. `Int64`, which `Int.ts`
re-exported, keeps its root export and gains its own `@beep/schema/Int64` subpath until the
numeric group retires it. The consumer rewrite ran the transient `int-members` codemod rule added
in commit 2b240e7cd3 (with `number-members`, which the Number retirement cherry-picks); the rules
are removed again in this change.

`Double` flips RETIRE to KEEP, and `Float` stays ADAPT with its binary32 check and its
`internal/ProtobufNumber` base unchanged. Both schemas deliberately admit `NaN` and the
infinities, and the only upstream form for that domain is bare `S.Number`, which the repo's
`schemaNumber` effect-LSP law (`tsconfig.base.json`, TS377098) rejects; `@effect-diagnostics`
directives are banned outside the three `effectDiagnosticsDirectiveExemptions` entries. A facet
upstream covers only through a form the repo's own laws forbid is uncovered here. Rejected:
`schemaNumber` exemptions for the two files (the exemption list would grow for a counter) and a
scratchpad-local `Double` (it re-creates the concept).

Type-check cost, tsgo 7.0.2, fresh build-info, before → after. The gate is the
`--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 710,979 → 708,931 | 202,571 → 202,144 | 1.006 → 1.164 s |
| `@beep/repo-cli` | 4,152,142 → 4,151,706 | 1,066,767 → 1,066,830 | 9.340 → 10.614 s |
| `@beep/law-practice-domain` | 874,541 → 874,363 | 259,729 → 259,602 | 1.110 → 1.164 s |

Check time is advisory within a 5% band. Flagged: the `@beep/schema` (+15.7%) and `@beep/repo-cli`
(+13.6%) single-threaded times rose with lower instantiation counts, measured on a shared
workstation at load average 18 to 25; the "before" column was taken on the lane base before
`origin/main` 7cc0aa9b33 was merged in.

The default four-checker run is advisory:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,115,008 → 1,114,282 | 367,663 → 368,572 | 0.502 → 0.556 s |
| `@beep/repo-cli` | 8,428,407 → 8,426,349 | 2,149,058 → 2,148,802 | 4.132 → 4.456 s |
| `@beep/law-practice-domain` | 1,290,676 → 1,286,201 | 376,265 → 375,224 | 0.702 → 0.720 s |
