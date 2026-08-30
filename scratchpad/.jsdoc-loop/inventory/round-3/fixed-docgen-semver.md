# Round 3 fix report — docgen class members (semver)

Scratchpad `docgen` was failing on 54 missing description/example findings
for class members in the five owned semver files (not owning exports).
Runtime behavior was not changed.

Docgen `parseClass` only checks instance methods, static **methods**,
instance properties, and instance getters. `static readonly` duals,
codecs, and `Effect.fn` parse bindings are properties and were not
flagged. Members without a JSDoc block produced two findings (description
+ example); members with a one-liner produced one (example). `@since` is
not enforced on members; it was still added as required by the fixer
prompt.

## Changed files

- `scratchpad/semver/SemVer.ts`
- `scratchpad/semver/Range.ts`
- `scratchpad/semver/VersionCache.ts`
- `scratchpad/semver/Comparator.ts`
- `scratchpad/semver/VersionDiff.ts`

## Members documented

Each flagged member has a one-paragraph lead, one titled
`**Example** (Title)` with a single `ts` fence importing
`@beep/scratchpad/semver`, and `@since 0.0.0`.

### `SemVer.ts` — 34 findings / 30 members

`InvalidVersionError`

- `message`

`SemVer`

- `isValid`
- `isPinnable`
- `of`
- `sort`
- `rsort`
- `max`
- `min`
- `groupBy`
- `latestByMajor`
- `latestByMinor`
- `compare`
- `gt`
- `gte`
- `lt`
- `lte`
- `equal`
- `neq`
- `isPrerelease`
- `isStable`
- `bump`
- `[Equal.symbol]`
- `[Hash.symbol]`
- `toString`

`SemVerBump`

- `v`
- `major`
- `minor`
- `patch`
- `prerelease`
- `release`

Also added `@since 0.0.0` to `SemVer.parseResult` (already had an Example).

### `Range.ts` — 8 findings / 6 members

- `InvalidRangeError.message`
- `Range.simplify`
- `Range.test`
- `Range.filter`
- `Range.toString`
- `UnsatisfiableConstraintError.message`

Also added `@since 0.0.0` to `Range.parseResult`.

### `VersionCache.ts` — 6 findings / 3 members

- `EmptyCacheError.message`
- `VersionNotFoundError.message`
- `UnsatisfiedRangeError.message`

### `Comparator.ts` — 4 findings / 3 members

- `InvalidComparatorError.message`
- `Comparator.test`
- `Comparator.toString`

Also added `@since 0.0.0` to `Comparator.parseResult`.

### `VersionDiff.ts` — 2 findings / 2 members

- `VersionDiff.between`
- `VersionDiff.toString`

## Residual risk

- `static readonly` members (`FromString`, duals, `parse`, `Order`,
  `VersionCache.layer`) are still one-liners or Example-less. Docgen does
  not parse them as class methods, so they were out of the 54 findings.
- Schema constructor-field comments (`major`, `input`, `sets`, …) live on
  the schema object literal, not class `PropertyDeclaration`s.
- `@internal` `inspect.custom` methods are skipped via `shouldIgnore`.
- `{@link}` targets that live in another file are described but not
  typechecked by docgen.
- `VersionCacheShape` is type-level (`enforceExample: false`).

## Commands

```bash
zsh -ic 'bun scratchpad/.jsdoc-loop/probe-semver.ts'
zsh -ic 'bun run --cwd scratchpad docgen --include "semver/SemVer.ts,semver/Range.ts,semver/VersionCache.ts,semver/Comparator.ts,semver/VersionDiff.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
```

Scratchpad has no package `check` script. Focused scratchpad docgen is the
owning proof for these files. `probe-semver.ts` asserts the `// =>` values
used in the new Examples.

This subagent session had no shell tool, so those commands were not executed
here. Re-run them before treating the pack as merge-ready.
