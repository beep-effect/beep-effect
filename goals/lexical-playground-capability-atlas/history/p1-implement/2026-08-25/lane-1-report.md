# P1 lane 1 implementation report

Date: 2026-08-25
Branch: `feat/lexical-atlas-p1-resolver`
Status: implementation complete; one strict artifact reconciliation test remains red for four recorded atlas differences.

## Files created

- `packages/foundation/ui-system/editor/src/capability/schemas.ts`
- `packages/foundation/ui-system/editor/src/capability/errors.ts`
- `packages/foundation/ui-system/editor/src/capability/resolver.ts`
- `packages/foundation/ui-system/editor/src/capability/projection.ts`
- `packages/foundation/ui-system/editor/src/capability/catalog.ts`
- `packages/foundation/ui-system/editor/src/capability/profiles.ts`
- `packages/foundation/ui-system/editor/src/capability/index.ts`
- `packages/foundation/ui-system/editor/test/capability-schemas.test.ts`
- `packages/foundation/ui-system/editor/test/capability-resolver.test.ts`
- `packages/foundation/ui-system/editor/test/capability-projection.test.ts`
- `packages/foundation/ui-system/editor/test/capability-catalog.test.ts`
- `goals/lexical-playground-capability-atlas/history/p1-implement/2026-08-25/lane-1-report.md`

## Files changed

- `packages/foundation/ui-system/editor/package.json`: added source and publish exports for `./capability` and `./capability/*`; retained `./internal/*: null` last.
- `packages/foundation/ui-system/editor/src/index.ts`: added the deprecated root capability facade following the existing export-star pattern.

Concurrent changes to `research/capability-atlas.json`, `research/OPPORTUNITIES.md`, and the untracked ratified contract were preserved and not authored by this lane.

## Design deviations and conflicts

1. `format.lowercase`, `format.uppercase`, and `format.capitalize` use `lossy`, following the explicit lane instruction. This differs from contract sections 1.3/1.4/9 and the currently modified atlas, which say `unsupported`.
2. Atlas keybindings are reconciled by decoding the atlas strings through `KeyChordFromString` and comparing canonical `KeyChord` values. The contract model stores `KeyChord`, not its authored alias spelling, so exact raw equality would incorrectly reject equivalent spellings such as `Control`/`Ctrl` and `Option`/`Alt`.
3. No other design deviations were made. Catalog descriptor order is chosen so the flattened node registrations exactly preserve the pre-P1 `editorNodes` sequence required by section 13.

## Verification

### Required commands

`bun run --cwd packages/foundation/ui-system/editor lint:fix` — PASS

```text
$ biome check . --write
Checked 59 files in 812ms. No fixes applied.
```

`bun run --cwd packages/foundation/ui-system/editor check` — PASS

```text
$ tsgo -p tsconfig.check.json && bun run beep:check:tests && bun run beep:check:stories
$ tsgo -p tsconfig.test.json --noEmit
$ tsc -p tsconfig.stories.json --noEmit
```

`bun run --cwd packages/foundation/ui-system/editor test` — FAIL, environment-only before test import

```text
Vitest caught 15 unhandled errors during the test run.
Error: [vitest-pool]: Failed to start forks worker ...
Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond
Test Files  no tests
Tests  no tests
Errors  15 errors
Duration  60.02s (transform 0ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)
```

`bun run docgen:local` — PASS after fixing four introduced LiteralKit example member names

```text
@beep/editor:docgen: 171 example(s) found
@beep/editor:docgen: Typechecking examples...
@beep/editor:docgen: Docs generation succeeded!
Tasks: 65 successful, 65 total
[docgen:local] turbo docgen: exited 0
```

### Diagnostic test proof

`bunx --bun vitest run --passWithNoTests '--exclude=test/integration/**' --pool=threads --maxWorkers=1` — FAIL, artifact mismatch only

```text
Test Files  1 failed | 14 passed (15)
Tests  1 failed | 431 passed (432)
actual: [
  'node.tab: descriptor=lossless, atlas=unsupported',
  'format.lowercase: descriptor=lossy, atlas=unsupported',
  'format.uppercase: descriptor=lossy, atlas=unsupported',
  'format.capitalize: descriptor=lossy, atlas=unsupported'
]
```

This proves all existing tests, including `TaggedErrors.equivalence.test.ts` and `facade-deprecation.test.ts`, pass in the thread-pool diagnostic lane. The strict catalog assertion was not weakened.

## Open questions for the orchestrator

1. Should `node.tab` be `lossless` as ratified in section 9, or `unsupported` as the atlas still says? The reconciliation test cannot be green until those agree.
2. The lane instruction says lowercase/uppercase/capitalize are being corrected to `lossy`, but the current parallel atlas diff changes them from `lossless` to `unsupported`. Which policy should land? The implementation preserves the explicit lane instruction.
3. The default Vitest fork pool cannot start any of the package's 15 workers in this environment. The single-thread pool executes the complete suite and isolates the only semantic failure above.

## Effect v4 API source checks

- `.repos/effect/packages/effect/src/Schema.ts`: `decodeEffect` 1557, `decodeUnknownResult` 1771, `encodeEffect` 2018, `NonEmptyArray` 4696, `Union` 4921, `brand` 5240, `decodeTo` 5583, `withConstructorDefault` 5821, `toTaggedUnion` 6316, `makeFilter` 6669, `isPattern` 6828, `isLowercased` 7520, `NonEmptyString` 9576, `Option` 9648, `fromJsonString` 12437, `Class` 14347, `TaggedError` 14528.
- `.repos/effect/packages/effect/src/SchemaTransformation.ts`: `transform` 335.
- `.repos/effect/packages/effect/src/Result.ts`: `succeed` 278, `fail` 305, `isFailure` 565, `isSuccess` 597, `map` 819, `match` 863, `getOrThrow` 1202, `flatMap` 1278, `all` 1389.
- `.repos/effect/packages/effect/src/Graph.ts`: `directed` 634, `mutate` 815, `addNode` 1717, `addEdge` 2573, `isAcyclic` 4214.
- `.repos/effect/packages/effect/src/MutableHashMap.ts`: `empty` 144, `get` 260, `has` 392, `set` 439, `remove` 677; `MutableHashSet.ts`: `empty` 154, `add` 257, `has` 302, `remove` 345.
- `.repos/effect/packages/effect/src/Array.ts`: `match` 421, `append` 642, `appendAll` 673, `length` 908, `unappend` 1051, `dropWhile` 1567, `findFirst` 1721, `reverse` 2040, `contains` 2572, `map` 3562, `flatMap` 3596, `filterMap` 3776, `filter` 3818, `every` 4204, `some` 4236, `join` 4605.
- `.repos/effect/packages/effect/src/Option.ts`: `none` 256, `some` 286, `isNone` 344, `isSome` 371, `match` 403, `map` 1090; `Equal.ts`: `equals` 172.
- `.repos/effect/packages/effect/src/Effect.ts`: `void` 1172/1180, `tryPromise` 969, `fromResult` 1807, `fnUntraced` 13481, `fn` 13605; `String.ts`: `toUpperCase` 172, `toLowerCase` 189, `length` 426, `split` 444.

No commit was created.
