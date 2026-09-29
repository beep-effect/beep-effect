---
"@beep/schema": minor
---

Retire the `Number` concept, `Int64`, and the fixed-width protobuf integer schemas under the
"Upstream-First Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`,
2026-09-29). `NonNegativeInt`, `NonNegNum`, `isPositive`, `isNonNegative`, `isNegative`,
`isNonPositive`, `isPostgresSerialInt`, `FiniteFromString`, `Int64`, `Int64FromString`, `isInt64`,
`Uint32`, `Uint64`, `Fixed32`, `Sfixed32`, `Sfixed64`, `Sint32`, and `Sint64` are deleted with their
barrel entries and the `@beep/schema/Number`, `/Int64`, `/Uint32`, `/Uint64`, `/Fixed32`,
`/Sfixed32`, `/Sfixed64`, `/Sint32`, and `/Sint64` subpaths; no alias is left behind. Upstream
covers each one: `S.Natural` (with `S.is(S.Natural)` and `S.decodeUnknownOption(S.Natural)` for the
old statics), `S.Finite.check(S.isGreaterThanOrEqualTo(0))`, the `S.isGreaterThan(0)` family,
`S.makeFilterGroup([S.isInt(), S.isBetween(...)])`, `S.FiniteFromString`,
`S.BigInt.check(S.isBetweenBigInt(...))` for the 64-bit ranges, and `S.Finite.check(S.isUint32())`
or `S.Finite.check(S.isInt32())` for the 32-bit ranges. Decoded types lose the `Int`,
`NonNegativeInt`, and `Int64` brands; encoded bytes are unchanged (numbers encode as numbers, and
the `Int64` JSON string wire was probed identical). `Double` stays (KEEP) and `Float` keeps its
binary32 check (ADAPT), per the 2026-09-29 goal-time ruling. The consumer rewrite ran the transient
`number-members` codemod rule, cherry-picked as commit fdc400ecfd from 2b240e7cd3 and removed
again in this change.

Type-check cost, tsgo 7.0.2, fresh build-info, before (the Int retirement head ebf1fa1d0c) →
after. The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 708,931 → 703,741 | 202,144 → 200,774 | 1.279 → 1.202 s |
| `@beep/repo-cli` | 4,151,706 → 4,150,497 | 1,066,834 → 1,066,495 | 11.705 → 12.944 s |
| `@beep/law-practice-domain` | 874,363 → 873,941 | 259,606 → 259,482 | 1.259 → 1.691 s |

Check time is advisory within a 5% band. Flagged: the `@beep/repo-cli` (+10.6%) and
`@beep/law-practice-domain` (+34%) single-threaded times rose with lower instantiation and type
counts, measured on a shared workstation at load average 24 to 34.

The default four-checker run is advisory:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,114,282 → 1,106,375 | 368,572 → 366,190 | 0.544 → 0.618 s |
| `@beep/repo-cli` | 8,426,349 → 8,423,810 | 2,148,815 → 2,148,113 | 5.279 → 5.139 s |
| `@beep/law-practice-domain` | 1,286,201 → 1,285,263 | 375,234 → 374,957 | 0.762 → 1.810 s |
