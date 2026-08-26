# P3 coverage report

## Result

Added behavior-level coverage in
`packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts`.
All reachable statements, branches, and functions in the three identity modules
are now covered. The package ratchet still exits 1 because
`IdentityRdfBinding.ts:195` is unreachable under the current source and counts
as one uncovered statement, line, and function.

Final package totals are 99.06% lines, 99.07% statements, 100% branches, and
98.03% functions. No baseline, source, coverage configuration, or ignore comment
was changed.

## How the uncovered units were located

1. `codegraph explore` mapped `datasetToEntries`, `layerDataset`,
   `projectShapes`, `predicateCollision`, and their callers and existing tests.
2. `bun run coverage -- --filter=@beep/semantic-web` produced the authoritative
   package totals.
3. The shared Vitest configuration at `vitest.shared.ts` sets
   `reportsDirectory: "coverage"` and enables the `lcov` reporter. The exact
   per-file data was read from
   `packages/foundation/capability/semantic-web/coverage/lcov.info`.
4. The initial `lcov.info` showed uncovered callbacks at lines 195, 201, 208,
   233, 267, and 296 in `src/identity/IdentityRdfBinding.ts`. After the added
   tests, only line 195 remains at `FNDA:0` and `DA:0`.

## Tests added

| Unit | Test name |
| --- | --- |
| `decodeSubject`: blank-node subject | `rejects a blank-node identity subject` |
| `literalAt`: missing and duplicate identifier cardinality | `rejects missing and duplicate identifier literals` |
| `literalAt`: missing and duplicate CURIE cardinality | `rejects missing and duplicate CURIE literals` |
| `ObjectTerm.match`: blank-node and named-node values | `rejects blank-node and named-node registry values` |
| `literalAt`: wrong datatype and language-tagged literal | `rejects non-string and language-tagged literals` |
| `decodeSubject`: unknown predicate | `rejects an unmapped RDF predicate` |
| `literalAt`: duplicate mapped fiber | `rejects duplicate values for a mapped fiber` |
| `A.match`: omitted optional mapped fiber | `decodes an omitted mapped fiber as absent` |
| `layerDataset`: data-last overload | `builds a registry through the data-last layerDataset overload` |
| `projectShapes`: data-last overload | `matches data-first projection through the data-last projectShapes overload` |

The tests assert exact error `_tag`, `subject`, and `message` fields or exact
decoded/projected values. The pre-existing test file already covers valid and
colliding predicate bindings, round trips, missing fiber bindings, the
data-first registry layer, and successful data-first projection.

## Unreachable unit

`IdentityRdfBinding.ts:195` is the `onNone` callback for
`A.head(matching)`. `matching` is a fresh array returned by `A.filter`. The code
immediately returns an `IdentityDatasetDecodeError` unless
`A.length(matching) === 1`. For an array of length one, Effect's `A.head` calls
`A.get(0)`, and index zero is in bounds, so it always returns `Option.some`.
The `onNone` callback cannot run.

Covering it from a test would require mocking `effect/Array` into an internally
inconsistent state. That would not test production behavior and was not done.
A source change is required to remove or restructure the redundant defensive
branch, but this task expressly forbids changes under `src/**`.

## Final ratchet output

```text
[coverage-ratchet] coverage regression(s) detected:
  - @beep/semantic-web (packages/foundation/capability/semantic-web) functions: 98.03 < 100
  - @beep/semantic-web (packages/foundation/capability/semantic-web) lines: 99.06 < 100
  - @beep/semantic-web (packages/foundation/capability/semantic-web) statements: 99.07 < 100
```

The final per-file row for `IdentityRdfBinding.ts` is 98.64% statements, 100%
branches, 97.29% functions, and 98.63% lines, with line 195 as the sole
uncovered line. `IdentityRegistryDataset.ts` and `IdentityShaclProjection.ts`
are 100% on all four metrics.

## Proof commands

| Command | Exit code | Result |
| --- | ---: | --- |
| `cd packages/foundation/capability/semantic-web && bun run test` | 1 | Fork workers timed out before tests started. |
| `cd packages/foundation/capability/semantic-web && bun run test -- --pool=threads` | 0 | 4 files passed, 27 tests passed. |
| `cd packages/foundation/capability/semantic-web && bun run check` | 0 | TSGo passed. |
| `cd packages/foundation/capability/semantic-web && bun run lint` | 0 | Biome checked 17 files. |
| `bun run coverage -- --filter=@beep/semantic-web` | 1 | Branches reached 100%; the three rows above remain because of line 195. |
| `bun run beep lint schema-first` | 0 | No missing, stale, or advisory entries. |
| `bun run docgen:local` | 0 | Scoped proof completed and aggregated 121 packages. |
