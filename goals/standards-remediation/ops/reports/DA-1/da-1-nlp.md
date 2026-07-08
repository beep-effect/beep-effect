# DA-1 fixer report — `@beep/nlp` (`packages/foundation/modeling/nlp`)

All 19 assigned entries fixed. Zero ripple outside the package: confirmed
`@beep/nlp/Graph/GraphOps`, `@beep/nlp/Algebra/Monoid`,
`@beep/nlp/Algebra/NLPMonoid`, and `@beep/nlp/Operations/Composable` have no
consumers anywhere else in the repo (`rg` for those exact submodule import
paths repo-wide returned nothing; the earlier substring hits for `"@beep/nlp"`
were unrelated sibling packages `@beep/nlp-mcp`/`@beep/nlp-processing`).

## Disposition table

| # | qualifiedName | file | diagnostics | fix | disposition |
|---|---|---|---|---|---|
| 1 | `Product3` | `src/Algebra/Monoid.ts:550` | missing-dual | wrapped `dual(3, (ma, mb, mc) => ...)`; data-first call sites/doc example unchanged | fixed |
| 2 | `Product` | `src/Algebra/Monoid.ts:525` | missing-dual | wrapped `dual(2, (ma, mb) => ...)`; data-first call sites/doc example unchanged (test at `test/Algebra/Monoid.test.ts:69` still compiles as-is) | fixed |
| 3 | `StringDelimited` | `src/Algebra/Monoid.ts:201` | missing-dual, third-param-not-object-like | constructor-factory (produces a `Monoid<string>` from 3 raw string configs, no "self" to pipe — same family as `VectorAdd`/`StringJoin`); collapsed to single options object `{ prefix, suffix, separator }` (arity 1, resolves both diagnostics — dual no longer applies at arity 1); zero real call sites, only its own doc example, updated | fixed |
| 4 | `checkAssociativity` | `src/Algebra/Monoid.ts:751` | too-many-positional-params | per LOCKED ruling R12 (`research/decisions.md`): converted fully to one options object `{ monoid, x, y, z, equals? }` (math notation preserved as field names); updated doc example + the internal call inside `checkLaws` | fixed |
| 5 | `checkLeftIdentity` | `src/Algebra/Monoid.ts:707` | missing-dual, third-param-not-object-like | restructured to arity 2: `(monoid, { x, equals? })`, wrapped `dual(2, ...)` (self = `monoid`); updated doc example + internal call in `checkLaws` | fixed |
| 6 | `checkRightIdentity` | `src/Algebra/Monoid.ts:729` | missing-dual, third-param-not-object-like | same pattern as `checkLeftIdentity` | fixed |
| 7 | `checkLaws` | `src/Algebra/Monoid.ts:779` | missing-dual, third-param-not-object-like | restructured to arity 2: `(monoid, { values, equals? })`, wrapped `dual(2, ...)`; updated doc example; body updated to call the now-options-shaped `checkLeftIdentity`/`checkRightIdentity`/`checkAssociativity` | fixed |
| 8 | `computeTFIDF` | `src/Algebra/NLPMonoid.ts:735` | missing-dual, third-param-not-object-like | restructured to arity 2: `(tf, { df, totalDocs })`, wrapped `dual(2, ...)` (self = `tf`, the primary term-frequency map); updated doc example + test call site (`test/Algebra/NLPMonoid.test.ts:184`) | fixed |
| 9 | `batchNodes` | `src/Graph/GraphOps.ts:909` | too-many-positional-params, invalid-dual-arity | merged `start`/`order`/`batchSize` into new shared `TraversalStart & { batchSize }` options object → arity 2, `dual(2, ...)`; updated doc example + test call site (`test/Graph/GraphOps.test.ts`) | fixed |
| 10 | `collectTraversal` | `src/Graph/GraphOps.ts:454` | third-param-not-object-like | merged `start`/`order` into new `TraversalStart` options object → arity 2, `dual(2, ...)`; updated doc example, internal call, and test call site | fixed |
| 11 | `foldTraversal` | `src/Graph/GraphOps.ts:396` | too-many-positional-params, invalid-dual-arity | merged `start`/`order`/`initial` into `TraversalStart & { initial }`, kept callback `f` positional → arity 3, `dual(3, ...)`; updated doc example + internal call from `collectTraversal` | fixed |
| 12 | `streamNodes` | `src/Graph/GraphOps.ts:854` | third-param-not-object-like | merged `start`/`order` into `TraversalStart` → arity 2, `dual(2, ...)`; updated doc example, internal call from `batchNodes`, and test call site | fixed |
| 13 | `streamNodesWithIndex` | `src/Graph/GraphOps.ts:880` | third-param-not-object-like | merged `start`/`order` into `TraversalStart` → arity 2, `dual(2, ...)` (lost the previous point-free `flow(createWalker, Graph.entries, Stream.fromIterable)` body since options must be destructured); updated doc example (0 other call sites) | fixed |
| 14 | `traverseNodes` | `src/Graph/GraphOps.ts:701` | too-many-positional-params, invalid-dual-arity | merged `start`/`order` into `TraversalStart`, kept `f` positional → arity 3, `dual(3, ...)`; updated doc example (0 other call sites, matches P2 audit's finding) | fixed |
| 15 | `traverseNodesCollect` | `src/Graph/GraphOps.ts:749` | too-many-positional-params, invalid-dual-arity | same pattern as `traverseNodes` → arity 3, `dual(3, ...)`; updated doc example + test call site | fixed |
| 16 | `aggregate` | `src/Operations/Composable.ts:540` | missing-dual | added `values: ReadonlyArray<A>` as the explicit self and wrapped `dual(3, (values, monoid, f) => ...)`; the old curried 2-arg call `aggregate(monoid, f)` now hits dual's data-last branch and still returns `(values) => M`, so the existing test call site (`test/Operations/Composable.test.ts:170`) needed **no change** | fixed |
| 17 | `map` (module fn) | `src/Operations/Composable.ts:342` | third-param-not-object-like | merged `f`/`outputSchema` into one options object → arity 2, `dual(2, ...)`; updated doc example + 2 test call sites | fixed |
| 18 | `product` (module fn) | `src/Operations/Composable.ts:384` | third-param-not-object-like | merged `that`/`outputSchema` into one options object → arity 2, `dual(2, ...)`; updated doc example + 2 test call sites | fixed |
| 19 | `zipWith` (module fn) | `src/Operations/Composable.ts:426` | too-many-positional-params, invalid-dual-arity | merged `that`/`f`/`resultSchema` into one options object → arity 2 (down from 4), `dual(2, ...)` (was `dual(4,...)`); updated doc example + 2 test call sites | fixed |

No `detector-bug?`, `unconvertible`, or `blocked` dispositions — every entry converted cleanly with a compiling, options-object (or plain `dual`) shape and zero cross-package ripple. The two "constructor factory" candidates in this slice (`StringDelimited`) and the math-notation law-checker (`checkAssociativity`) were the only ones needing judgment calls; both resolved per SPEC's aggressive-conversion default and the LOCKED R12 ruling, not via a carve-out.

## New shared type

Added `TraversalStart` (`src/Graph/GraphOps.ts`, exported, documented with
`@example`/`@category`/`@since`) — `{ readonly start: ReadonlyArray<NodeIndex>; readonly order: TraversalOrder }`.
Reused across `batchNodes`/`collectTraversal`/`foldTraversal`/`streamNodes`/
`streamNodesWithIndex`/`traverseNodes`/`traverseNodesCollect` to keep the
options-object shape consistent and each function's positional arity ≤3.

## Files touched

- `packages/foundation/modeling/nlp/src/Algebra/Monoid.ts`
- `packages/foundation/modeling/nlp/src/Algebra/NLPMonoid.ts`
- `packages/foundation/modeling/nlp/src/Graph/GraphOps.ts` (also dropped the now-unused `flow` import from `effect`)
- `packages/foundation/modeling/nlp/src/Operations/Composable.ts`
- `packages/foundation/modeling/nlp/test/Algebra/NLPMonoid.test.ts`
- `packages/foundation/modeling/nlp/test/Graph/GraphOps.test.ts`
- `packages/foundation/modeling/nlp/test/Operations/Composable.test.ts`

No `dtslint/` fixtures existed for this package beyond a `.gitkeep` — none to update.

## Commands run

- `npx tsgo -b tsconfig.json` (inside the package) → 0 errors
- `npx vitest run` (inside the package) → 10 test files, **166/166 passed**
- `turbo run build check test docgen --filter=@beep/nlp` (repo root) → **25/25 tasks successful** (build, check, test, docgen across the dependency graph); nlp's own docgen pass typechecked all 296 `@example` blocks with 0 failures
- `git status --short packages/foundation/modeling/nlp` → only the 7 files above modified; confirmed no other in-flight lane files were touched

## Summary

19/19 entries fixed, 0 blocked/detector-bug/unconvertible. Package typechecks,
166/166 tests pass, docgen's 296 examples typecheck clean. Zero cross-package
ripple (verified no external importer of the four touched submodules exists).
Added one new shared exported type (`TraversalStart`) to keep the 5
traversal-shaped GraphOps functions consistent. Not committed — driver owns
commit/push/inventory regen per SPEC fence 10.

## Follow-up — `TraversalStart` schema-first conversion (RC-SF)

Driver flagged that the new exported `TraversalStart` in
`src/Graph/GraphOps.ts` surfaces as a schema-first CANDIDATE under the
strengthened detector (pure-data exported type, no structural signal).
Converted per RC-SF:

```ts
const NodeIndexSchema = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NodeIndexSchema", {
    description: "Stable node index allocated by the backing effect/Graph.",
  })
);

export class TraversalStart extends S.Class<TraversalStart>($I`TraversalStart`)(
  {
    start: S.Array(NodeIndexSchema),
    order: TraversalOrder,
  },
  $I.annote("TraversalStart", { description: "..." })
) {}
```

`start`'s field schema models `NodeIndex` (`Graph.NodeIndex`, a plain
non-negative-integer alias — confirmed `export type NodeIndex = number` in
`.repos/effect-v4/packages/effect/src/Graph.ts`) as `S.Int.check(isGreaterThanOrEqualTo(0))`,
following this same package's existing `NonNegativeCount` convention
(`src/Algebra/NLPMonoid.ts:34`). `order` reuses the existing `TraversalOrder`
`LiteralKit` schema directly as a field (`LiteralKit(...)` returns
`attachHelperDescriptors(S.Literals(...), {...})` — a real schema with helpers
attached, not a wrapper — so it's a valid struct/class field as-is).

**Structural compatibility verified, not assumed:** ran `npx tsgo -b
tsconfig.json` after the conversion — **0 errors**. Every existing call site
that builds `TraversalStart & { initial }` / `TraversalStart & { batchSize }`
via a plain object literal (`{ start: getRoots(graph), order: "dfs" }`,
`{ ...options, initial: A.empty<A>() }`, etc., in both `src/Graph/GraphOps.ts`
itself and `test/Graph/GraphOps.test.ts`) still type-checked with **zero
changes needed** — `S.Class` instances have no private/protected members, so
TS's structural typing accepts plain literals against the class type exactly
as it did against the old `interface`. The fallback (inlining the literal
type into each overload instead of an exported alias) was not needed.

Only `src/Graph/GraphOps.ts` changed for this follow-up (added `import * as S
from "effect/Schema"`, the `NodeIndexSchema` const, and the class body);
`GraphOps.test.ts` required no edits.

### Commands run (follow-up)

- `npx tsgo -b tsconfig.json` (inside the package) → 0 errors
- `npx vitest run` (inside the package) → 166/166 passed (unchanged)
- `turbo run build check test docgen --filter=@beep/nlp` → 25/25 tasks green, docgen's 296 examples (including the rewritten `TraversalStart` doc example using `new TraversalStart({...})`) typecheck clean
- `git status --short packages/foundation/modeling/nlp` → only `src/Graph/GraphOps.ts` newly modified beyond the original 7-file diff

Not committed — driver owns commit/push/inventory regen per SPEC fence 10.

## Follow-up 2 — Fallow duplication fix in `Monoid.ts` (hosted CI round-1 blocker)

Driver flagged a Fallow-audit-introduced 6-line duplication x2 at
`src/Algebra/Monoid.ts:726` vs `:750` — the two near-identical dual-wrapped
type signatures + destructure line that `checkLeftIdentity`/
`checkRightIdentity` picked up from the earlier options-object restructure.

Extracted the shared shape into one private type alias and one private
implementation helper, then had both public functions delegate to it with
only the combine order differing:

```ts
type IdentityCheckOptions<A> = { readonly x: A; readonly equals?: (a: A, b: A) => boolean };

const checkIdentity = <A>(
  monoid: Monoid<A>,
  options: IdentityCheckOptions<A>,
  combineWithEmpty: (monoid: Monoid<A>, x: A) => A
): boolean => {
  const { x, equals = (a: A, b: A) => a === b } = options;
  return equals(combineWithEmpty(monoid, x), x);
};

export const checkLeftIdentity: {
  <A>(monoid: Monoid<A>, options: IdentityCheckOptions<A>): boolean;
  <A>(options: IdentityCheckOptions<A>): (monoid: Monoid<A>) => boolean;
} = dual(2, <A>(monoid: Monoid<A>, options: IdentityCheckOptions<A>): boolean =>
  checkIdentity(monoid, options, (m, x) => m.combine(m.empty, x))
);

export const checkRightIdentity: {
  <A>(monoid: Monoid<A>, options: IdentityCheckOptions<A>): boolean;
  <A>(options: IdentityCheckOptions<A>): (monoid: Monoid<A>) => boolean;
} = dual(2, <A>(monoid: Monoid<A>, options: IdentityCheckOptions<A>): boolean =>
  checkIdentity(monoid, options, (m, x) => m.combine(x, m.empty))
);
```

Extraction over fallow-ignore suppression, per the driver's preference and
SPEC fence 13 (never weaken a detector/gate to make a finding pass).

**Verified, not assumed, that this closed the gate for the file:** ran
`bun run beep quality fallow audit --check --base origin/main --out ... --quiet`
twice. Because this is a repo-wide audit against `origin/main` (368 changed
files across every concurrent lane), the total "introduced" finding counts
shifted between runs (other lanes landing changes concurrently) — so raw
top-line counts alone aren't a reliable per-file signal. Instead, parsed the
tool's raw JSON output (`duplication.clone_groups[].introduced` boolean +
`instances[].file`) directly: across both runs, **zero** introduced
(blocking) duplication-clone-group instances reference
`packages/foundation/modeling/nlp/**` — the two/five introduced groups seen
across runs all resolve to
`packages/tooling/tool/cli/src/commands/{Laws/DualArity.ts,Lint/SchemaFirst.ts,Quality/internal/JSDocDocumentationInventory.ts}`,
and the one introduced complexity finding is `collectCandidateDiagnostics` in
`packages/tooling/tool/cli/src/commands/Laws/DualArity.ts` — all belonging to
other lanes' detector work, not this one. `grep` for
`checkLeftIdentity|checkRightIdentity|checkIdentity` across the raw audit
output returns nothing at all (the duplicate is gone, not merely
reclassified). The one duplication clone group that still appears inside
`Monoid.ts` (`SetIntersection`'s and `Option`'s shared `if (O.isNone(x)) ...`
shape, lines ~419 and ~596) is **pre-existing** — confirmed via
`git show origin/main:packages/foundation/modeling/nlp/src/Algebra/Monoid.ts`,
which has the identical pattern at the same lines on `origin/main` — so it is
correctly attributed `inherited-adjacent` (non-blocking), not introduced by
this lane, and out of scope for this fix.

Re-verified `npx tsgo -b tsconfig.json` (0 errors) and `npx vitest run`
(166/166 pass, unchanged) after the extraction. Only `src/Algebra/Monoid.ts`
changed for this follow-up.

Not committed — driver owns commit/push/inventory regen per SPEC fence 10.
