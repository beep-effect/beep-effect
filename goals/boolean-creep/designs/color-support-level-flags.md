# Instance

- id: `color-support-level-flags`
- file:line: `packages/foundation/capability/chalk/src/internal/ChalkSchema.ts:267`
- symbol: `ColorSupport`
- members: `hasBasic`, `has256`, `has16m`
- evidence classes:
  - E4 at `packages/foundation/capability/chalk/src/internal/SupportsColor.ts:323` — translateLevel projects one ColorSupportLevel into bits: has16m:=level>=3, has256:=level>=2, hasBasic:=true; level 0 becomes ColorInfo false rather than all-false flags.
  - E1 at `packages/foundation/capability/chalk/src/internal/SupportsColor.browser.ts:41` — Browser writes only the implied stack: truecolor sets all three true; basic sets hasBasic only. Combined-false and inverted stacks are never written.

# Current shape

Live declaration at `packages/foundation/capability/chalk/src/internal/ChalkSchema.ts:264`:

```ts
export class ColorSupport extends S.Class<ColorSupport>($I`ColorSupport`)(
  {
    level: ColorSupportLevel,
    hasBasic: S.Boolean,
    has256: S.Boolean,
    has16m: S.Boolean,
  },
  $I.annote("ColorSupport", {
    description: "Detected terminal color support metadata for a Chalk output stream.",
  })
) {}
```

# Cardinality gap

The three flags represent eight combinations. For enabled `ColorSupport` objects only three cumulative levels are legal:

- level `1`: basic ANSI.
- level `2`: basic ANSI plus 256 colors.
- level `3`: basic ANSI plus 256 colors plus truecolor.

Level `0` is represented by the separate `false` member of `ColorInfo`, not a `ColorSupport` object. The existing `level: ColorSupportLevel` already names the complete source state; all three booleans are lossy duplicate projections of it.

# Target schema

Reuse the existing `ColorSupportLevel` schema and type at `ChalkSchema.ts:223-247`. Do not mint another kit or literal domain.

```ts
export class ColorSupport extends S.Class<ColorSupport>($I`ColorSupport`)(
  {
    level: ColorSupportLevel,
  },
  $I.annote("ColorSupport", {
    description: "Detected terminal color support level for an enabled Chalk output stream.",
  })
) {}
```

Consumers that need a capability answer derive it from `support.level` and the existing `ColorSupportLevel` helpers; this instance has no live flag readers, so no replacement convenience guards are required.

# Migration inventory

- `packages/foundation/capability/chalk/src/internal/ChalkSchema.ts:252-259` — update the `ColorSupport.make` example to `{ level: 3 }`.
- `packages/foundation/capability/chalk/src/internal/ChalkSchema.ts:267-269` — delete the three fields, retaining `level: ColorSupportLevel`.
- `packages/foundation/capability/chalk/src/internal/ChalkSchema.ts:271-272` — describe the level as the source of truth rather than generic duplicated metadata.
- `packages/foundation/capability/chalk/src/internal/SupportsColor.ts:318-329` — simplify `translateLevel`: level `0` remains `false`; enabled levels construct `ColorSupport.make({ level: enabledLevel })` without inequality projections.
- `packages/foundation/capability/chalk/src/internal/SupportsColor.browser.ts:41-46` — construct truecolor support as `ColorSupport.make({ level: 3 })`.
- `packages/foundation/capability/chalk/src/internal/SupportsColor.browser.ts:48-53` — construct basic support as `ColorSupport.make({ level: 1 })`.
- `packages/foundation/capability/chalk/src/Chalk.ts:366-371` — update public details to describe the supported level rather than three flags.
- `packages/foundation/capability/chalk/src/Chalk.ts:380-385` — update the decode example to `{ level: 3 }`.
- `packages/foundation/capability/chalk/src/Chalk.ts:394-402` — update the public type prose/example to `{ level: 3 }`.

Whole-package search finds no runtime read of `hasBasic`, `has256`, or `has16m`; all non-declaration occurrences are the constructors and documentation listed above.

# Guard-deletion accounting

- `packages/foundation/capability/chalk/src/internal/SupportsColor.ts:323-325` — delete the three runtime coherence projections (`level >= 3`, `level >= 2`, and unconditional basic) that manufacture a legal flag stack from the already-authoritative level.
- `packages/foundation/capability/chalk/src/internal/SupportsColor.browser.ts:41-53` — delete the two hand-maintained flag-stack literals whose field combinations must enforce `has16m => has256 => hasBasic` at every write.
- `packages/foundation/capability/chalk/src/Chalk.ts:370-371` — delete the public prose that lists the three correlated capability answers separately; the level domain is authoritative.

There are no read-side guards or legacy normalizers because no runtime consumer reads these flags. The non-empty deletion is entirely at the write-side coherence boundary, which is where this derived instance currently enforces its invariant.

# Encoded-side impact

none (internal)

# Test impact

- `packages/foundation/capability/chalk/test/index.test.ts:171-190` — `ColorSupport` participates in schema arbitrary encode/decode round trips. No assertion names the removed fields, but generated values and encoded snapshots-in-memory shrink to `{ level }`; keep this test green and add direct cases for levels 1, 2, and 3 plus `ColorInfo` level 0 as `false`.
- No Chalk test reads `hasBasic`, `has256`, or `has16m` directly.

# Risk & sequencing

Although inventory classifies this Tier 1/internal, `ColorSupport` is re-exported by `Chalk.ts` and `Chalk.browser.ts`, so TypeScript consumers observe a public structural simplification. Land internal constructors and public documentation in the same change. Do not alter the existing `ColorSupportLevel` encoding or the `ColorInfo` convention that level 0 is `false`; those are shared by terminal and browser entry points.
