# annoteError equivalence proof — 2026-09-12

D4 deletes `adoptDeclaredFieldsEquivalence` (and the effect-drizzle copy,
`declaredFieldsEquivalence`) and relies on upstream `makeClass`, which installs
`toEquivalence: ([from]) => from` for every Schema class since
`effect@4.0.0-rc.113` (`node_modules/effect/src/Schema.ts:13940`, upstream
`84864bc30c`). The measurement below is the same shape as the 2026-08-17 run
that motivated the hook (682/24,000 unequal on rc.109 without it).

## Command

Run from the worktree root under Bun 1.4.2 with the hook already deleted from
`packages/foundation/modeling/identity/src/Id.ts` (working tree of this PR):

```sh
bun run node_modules/.tmp/annote-error-proof.ts
```

The script (kept out of the tree; `node_modules/.tmp` is ignored) generates
values with `Arbitrary.schema(schema)`, round-trips them through
`S.encodeResult` and `S.decodeUnknownResult`, and counts pairs that
`S.toEquivalence(schema)` reports unequal, over seeds 1..60 with
`{ runs: 400, seed }` per `Arbitrary.checkEffect`.

## Result

| Schema | Unequal / total | effect |
| --- | --- | --- |
| `DocTextErrorReason` | 0 / 24,000 | 4.0.0-rc.113 |
| `DocTextErrorOptions` | 0 / 24,000 | 4.0.0-rc.113 |
| `DocTextError` | 0 / 24,000 | 4.0.0-rc.113 |

Acceptance (SPEC): 0/24,000 on `DocTextError`. Met. The doc-text service test
now asserts decoded-side equivalence for `DocTextError` as a schema law
(`assertSchemaRoundTrip`) instead of the encoded-only check.
