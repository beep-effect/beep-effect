# #1875 Effect Vitest canon wave 13: record

Branch `test/vitest-canon-wave13`, stacked on wave 12 (#2424, which is open as this is written). It was
restacked after #2424's review rounds and main `480b302e42`: the 46 rows are unchanged. The two
EV006 rows still listed are the open rows #2386 baselined, which #2432 migrates.
Scope: every remaining EV006 `hand-rolled-data-assertion` exception (46 rows in 20 files across
16 packages).

## Finding: the exits were mostly migrations, not detector repairs

Most of the 46 exits read "retire when EV006 recognises ..." or "retire when `@effect/vitest/utils`
assertions accept a message". A probe against the live detector showed that every
`@effect/vitest/utils` form reports nothing. That covers `deepStrictEqual` with Option or Result
nested in the expected value, with or without a message; `assertSome`; `strictEqual` between two
predicates; and `x.pipe(O.isSome, assertTrue)`. EV006 targets the `expect` matcher forms. The
helpers already accept a message: `deepStrictEqual(actual, expected, message)` and
`assertTrue(self, message)`. So every row could migrate to the canonical helper with no detector
change, and none of them needed a looser rule.

## Migrations: 46 rows

| Original form | Canonical form | Rows |
| --- | --- | ---: |
| `expect(a).toEqual(b)` / `toStrictEqual(b)` with Option or Result in either operand | `deepStrictEqual(a, b)` | 19 |
| `expect(pred, msg).toBe(true)` / `expect(x, msg).toEqual(y)` | `assertTrue(pred, msg)` / `deepStrictEqual(x, y, msg)` | 4 |
| `expect(Exit.isFailure(x)).toBe(true)` and `expect(O.isSome(x)).toBe(true)` with no expected payload | `x.pipe(Exit.isFailure, assertTrue)` / `x.pipe(O.isSome, assertTrue)` | 16 |
| `expect(O.isSome(a)).toBe(O.isSome(b))` | `strictEqual(O.isSome(a), O.isSome(b))` | 1 |
| Lexical `toMatchObject` subset oracles | narrow by node `type` (as the file already does for tables), then `assertSome`, `assertNone`, `strictEqual`, `deepStrictEqual` per field | 5 |
| Plain-object alignment oracle | `assertSome(..., [ConceptAlignment.make(...)])` | 1 |

Strength: every rewrite keeps the operands and polarity, and none is weaker.

- `deepStrictEqual` is stricter than `toEqual`: it checks prototypes and does not ignore
  `undefined` keys.
- The Lexical subset checks now also pin the node type.
- The list check pins both items' kinds, `[O.some(O.some(true)), O.some(O.none())]`.
- The dock and ontology oracles are built with the schemas' own `make`, so they are typed.
- The Boolean branch checks (16 rows) gain no payload, because the canon's EV006 guidance forbids
  inventing one. They keep exactly their original strength through the prescribed
  `assertTrue` fallback.

## Inventory, paired by `(ruleId, file, occurrence)` against the wave 12 head

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 485 | 485 | 0 |
| After | 439 | 439 | 0 |

- Gone: 46, all EV006. EV006 now has **0** rows.
- New: 0.
- Line-only shifts: 18 EV002 rows, from the added imports.
- Status and reason changes: 0.

## Verification

| Check | Result |
| --- | --- |
| Touched test files, 16 packages, Bun and Node 24 | all pass. The test-utils skips are its existing runtime gates. A Bun `SqlTest.pglite` worker SIGTERM'd by earlyoom passed on rerun (25 passed, 12 skipped). |
| `turbo run check` for the 16 packages | 0 errors (`missedPipeableOpportunity` fixed by the pipe forms) |
| `bun run beep lint effect-vitest --write` | 485 → 439, 0 introduced |
| Biome on all touched files | clean |

Coverage and package-verify are left to hosted CI under the push-first rule.
