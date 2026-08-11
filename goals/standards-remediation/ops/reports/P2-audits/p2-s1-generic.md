# P2 audit — S1-generic (exported generic interfaces/type-aliases)

Cluster: 73 entries, `standards/schema-first.inventory.jsonc`, reason ∈
{"Generic interface requires manual modeling...", "Generic type alias requires
manual modeling..."}. Sample: `ops/slices/P2-S1-generic.json` (11 entries).

Mission posture: aggressive conversion by default. This audit attempted three
REAL in-tree conversions from the assigned sample, plus one additional
falsification probe outside the sample (justified below), because the sample
alone under-represented the cluster's actual shape diversity.

## Cluster-wide reconnaissance (before attempting fixes)

`rg` over the 73-entry reason text plus owner tally (approximate, from
`standards/schema-first.inventory.jsonc`):

| Owner | ~count |
|---|---|
| `@beep/schema` | ~52 |
| `@beep/nlp-processing` | ~12 |
| `@beep/nlp` | ~6 |
| `@beep/test-utils`, `@beep/md`, `@beep/mcp-kit` | 3 each |
| `@beep/utils`, `@beep/identity` | 2 each |
| `@beep/lint-rules`, `@beep/langextract` | 1 each |

Reading the actual symbols (not just the sample) surfaced **two structurally
distinct families**, not one:

- **Family A/B/C (schema-infrastructure + behavior-holding generics)** — the
  vast majority, concentrated in `@beep/schema` (Graph/*, MutableHashMap*,
  MutableHashSet*, VariantSchema.*, StatusCauseTaggedErrorClass*,
  TaggedErrorClass*, CauseTaggedError*, Fn.schema*, LiteralKit,
  MappedLiteralKit, Model.fields* `GeneratedByApp`/`Sensitive`/`Generated`,
  `CodecStatics`, `DualEquivalence`) plus function-member strategy/typeclass
  interfaces in `@beep/mcp-kit`/`@beep/md` (`SegmentStrategy`,
  `ProjectWithinBudgetOptions`).
- **Family D (categorical/typeclass generics with free type parameters)** —
  `@beep/nlp-processing` (`GraphNode<A>`, `EffectGraph<A>`, `Composable`,
  `Foldable`, `Functor`, `TextOperation`, `GraphOperation`, `OperationResult`,
  `StoredResult`, `NLPBackendShape`, `GraphExecutorShape`) and `@beep/nlp`
  (`Monoid`, `SearchIndex`, `TypedText`, `OperationDefinition`). These are
  **not** schema-infrastructure at all — they are plain-data-looking
  interfaces (`GraphNode<A> { data: A; id: NodeId; metadata: NodeMetadata;
  parentId: Option<NodeId> }`) whose type parameter `A` is a genuinely free
  TypeScript type variable, never a `Schema.Top`.

This mattered enough to test directly (attempt #4 below), since a blanket
"unconvertible" verdict without checking Family D would have been an
unevidenced overgeneralization.

## Attempt 1 — `SegmentStrategy<I, B>` (`@beep/md/src/Md.behavior.ts:31`)

Function-member strategy interface: `isInline: (item: I|B) => item is I`,
`renderBlock: (block: B) => string`, `renderInlineRun: (run: ReadonlyArray<I>) => string`.

Converted to `S.Struct` with each function field wrapped in `S.declare`, and
rewired `segmentInlineRuns`'s signature to consume
`S.Schema.Type<ReturnType<typeof SegmentStrategySchema<I,B>>>` instead of the
interface.

```diff
 import { A, thunkEmptyStr } from "@beep/utils";
 import { Match } from "effect";
 import { dual, flow, pipe } from "effect/Function";
 import * as O from "effect/Option";
+import * as S from "effect/Schema";
 import { Inline as InlineSchema } from "./Md.model.ts";
 import type { Block, Inline, Li, ListItemChild, Table, TaskItem } from "./Md.model.ts";

-export interface SegmentStrategy<I, B> {
-  readonly isInline: (item: I | B) => item is I;
-  readonly renderBlock: (block: B) => string;
-  readonly renderInlineRun: (run: ReadonlyArray<I>) => string;
-}
+export const SegmentStrategySchema = <I, B>() =>
+  S.Struct({
+    isInline: S.declare((_input: unknown): _input is (item: I | B) => item is I => true),
+    renderBlock: S.declare((_input: unknown): _input is (block: B) => string => true),
+    renderInlineRun: S.declare((_input: unknown): _input is (run: ReadonlyArray<I>) => string => true),
+  });
+
+export type SegmentStrategy<I, B> = {
+  readonly isInline: (item: I | B) => item is I;
+  readonly renderBlock: (block: B) => string;
+  readonly renderInlineRun: (run: ReadonlyArray<I>) => string;
+};

+type SegmentStrategySchemaType<I, B> = S.Schema.Type<ReturnType<typeof SegmentStrategySchema<I, B>>>;
 export const segmentInlineRuns: {
-  <I, B>(items: ReadonlyArray<I | B>, render: SegmentStrategy<I, B>): ReadonlyArray<string>;
-  <I, B>(render: SegmentStrategy<I, B>): (items: ReadonlyArray<I | B>) => ReadonlyArray<string>;
+  <I, B>(items: ReadonlyArray<I | B>, render: SegmentStrategySchemaType<I, B>): ReadonlyArray<string>;
+  <I, B>(render: SegmentStrategySchemaType<I, B>): (items: ReadonlyArray<I | B>) => ReadonlyArray<string>;
 } = dual(2, ...);
```

**Result:** `npx tsgo -b tsconfig.json` in `packages/foundation/modeling/md` —
**0 errors** (the `.Type` of the `S.declare`d function preserves the type
predicate verbatim, so narrowing at `A.filter(run, render.isInline)` still
works). It *compiles*.

But the SPEC's own bar for a schema change is the §5.3 parity proof (byte-
identical encoded/wire snapshot + `S.toArbitrary` round-trip law), and that
fails outright:

```
$ bun run <script calling S.toArbitrary(SegmentStrategySchema<string, number>())>
toArbitrary FAILED: Unsupported AST Declaration
  at ["isInline"]
encodeSync result: {}
```

`S.encodeSync` "succeeds" but silently drops all three function values —
`JSON.stringify`-shaped encoding of a function is `undefined`, so the
"schema" round-trips to `{}`. This is not a working schema; it's a
type-compiling shell with zero decode/encode/arbitrary value, over a shape
that is 100% behavior (a type guard + two render callbacks), not data.
**Verdict: unconvertible.** Full compiling-but-degenerate diff above; file
reverted (`git checkout -- packages/foundation/modeling/md/src/Md.behavior.ts`).

## Attempt 2 — `FieldTierSet<Minimal, Balanced, Complete>` (`@beep/mcp-kit/src/FieldTier.ts:89`)

Container holding three actual `S.Struct` instances (not data — Schema
builder objects) as fields. Converted to `S.Struct` of `S.declare`-wrapped
`S.Struct` instances:

```diff
+export const FieldTierSetSchema = <
+  Minimal extends S.Struct.Fields,
+  Balanced extends S.Struct.Fields,
+  Complete extends S.Struct.Fields,
+>() =>
+  S.Struct({
+    minimal: S.declare((_input: unknown): _input is S.Struct<Minimal> => true),
+    balanced: S.declare((_input: unknown): _input is S.Struct<Balanced> => true),
+    complete: S.declare((_input: unknown): _input is S.Struct<Complete> => true),
+  });
+
 export interface FieldTierSet<...> { ... }
```

**Result:** `npx tsgo -b tsconfig.json` in `packages/foundation/capability/mcp-kit`
— **0 errors**. Runtime probe:

```
toArbitrary FAILED: Unsupported AST Declaration
  at ["minimal"]
encodeSync result: {"minimal":{"fields":{"id":{"ast":{"~effect/Schema":"~effect/Schema","_tag":"String"}}},...
```

Same arbitrary failure as attempt 1, plus `encodeSync` this time doesn't
drop data — it recursively serializes the internal AST/implementation
representation of each `S.Struct` instance (leaking `~effect/Schema`
internal tags/symbols) into the "encoded" JSON, because `S.Struct` objects
are themselves complex runtime objects, not plain data. This container is
never round-tripped through JSON anywhere in the actual code (it's an
in-memory, compile-time-typed vehicle for three named tier schemas,
consumed only by `defineFieldTiers`/`projectFieldTier`/`projectWithinBudget`).
Schema-ifying it produces worse-than-useless output. **Verdict:
unconvertible.** File reverted
(`git checkout -- packages/foundation/capability/mcp-kit/src/FieldTier.ts`;
confirmed no `FieldTierSetSchema`/`S.declare` residue remains — an unrelated
concurrent lane is independently editing this same file's
`ProjectWithinBudgetOptions`, left untouched per the concurrency rule).

## Attempt 3 — `MutableHashMapFromSelf`/`MutableHashMap` (`@beep/schema/src/MutableHashMap.ts:101,119`)

These interfaces `extend S.declareConstructor<...>`/`S.decodeTo<...>` with a
`Rebuild: this` self-reference — exactly the idiom Effect v4's own
`effect/Schema.ts` core uses 40+ times for its own generic derived schemas
(verified via `rg`):

```
.repos/effect-v4/packages/effect/src/Schema.ts:
  8561:export interface OptionFromNullOr<S extends Constraint> extends decodeTo<Option<toType<S>>, NullOr<S>> {
  4543:export interface ArrayEnsure<S extends Constraint> extends decodeTo<...> {
  ...(40+ more)
```

Attempted to eliminate the named interfaces entirely — deleted both
`export interface MutableHashMapFromSelf<...>`/`MutableHashMap<...>`, and
removed the explicit `S.make<T>()` type arguments + return-type annotations
on the two factory functions, letting TypeScript infer:

```diff
-export interface MutableHashMapFromSelf<Key extends S.Top, Value extends S.Top>
-  extends S.declareConstructor<...> { readonly key: Key; readonly Rebuild: this; readonly value: Value; }
-export interface MutableHashMap<Key extends S.Top, Value extends S.Top>
-  extends S.decodeTo<...> { readonly key: Key; readonly Rebuild: this; readonly value: Value; }
+// interfaces deleted
 ...
-export const MutableHashMapFromSelf = <Key extends S.Top, Value extends S.Top>(options: {...}): MutableHashMapFromSelf<Key, Value> => {
+export const MutableHashMapFromSelf = <Key extends S.Top, Value extends S.Top>(options: {...}) => {
   ...
-  return S.make<MutableHashMapFromSelf<Key, Value>>(schema.ast, options).pipe(...)
+  return S.make(schema.ast, options).pipe(...)
 };
-export const MutableHashMap = <Key extends S.Top, Value extends S.Top>(options: {...}): MutableHashMap<Key, Value> => {
+export const MutableHashMap = <Key extends S.Top, Value extends S.Top>(options: {...}) => {
   ...
-  return S.make<MutableHashMap<Key, Value>>(schema.ast, {...}).pipe(...)
+  return S.make(schema.ast, {...}).pipe(...)
 };
```

**Result:** `npx tsgo -b tsconfig.json` in `packages/foundation/modeling/schema`:

```
src/MutableHashMap.ts(231,38): error TS2339: Property 'pipe' does not exist on type 'Constraint'.
src/MutableHashMap.ts(286,6): error TS2339: Property 'pipe' does not exist on type 'Constraint'.
```

`S.make: <S extends Constraint>(ast: S["ast"], options?: object) => S` cannot
infer `S` from its arguments (`S["ast"]` doesn't uniquely determine `S`), so
without a named type argument it silently falls back to the bare `Constraint`
default, which has no `.pipe`. **The named generic interface is not
optional ceremony — it is the only mechanism TypeScript offers to supply that
type argument**, and it's the identical idiom Effect's own core library uses
for every one of its built-in generic derived schemas. Converting these
"to S.Class" would be a category error regardless: these interfaces
*describe schema types themselves* (custom `Schema<Type,Encoded,R>`
combinators), not decodable data instances — `S.Class` is for the latter.
**Verdict: unconvertible.** File reverted
(`git checkout -- packages/foundation/modeling/schema/src/MutableHashMap.ts`).

This same shape (interface extends `S.declareConstructor`/`S.decodeTo`/
`S.Bottom`/`VariantSchema.Field`, with `Rebuild: this`) accounts for the
`@beep/schema` majority of the cluster: `EdgeFromSelf`/`EdgeTransform`/`Edge`
(Graph.edge.ts), `GraphFromSelf`/`DirectedGraphFromSelf`/
`MutableGraphFromSelf`/`MutableDirectedGraphFromSelf`/
`MutableUndirectedGraphFromSelf`/`UndirectedGraphFromSelf` (Graph.from-self.ts),
`DirectedGraph`/`MutableDirectedGraph`/`MutableUndirectedGraph`/
`UndirectedGraph` (Graph.transforms.ts), `MutableHashSet`/
`MutableHashSetFromSelf`, `Overridable`/`Overrideable` (both
VariantSchema.overridable.ts and Model.variants.ts), `GeneratedByApp`/
`Sensitive`/`Generated`/`FieldOption`/`optionalOption` (Model.fields.ts,
extend `VariantSchema.Field<...>`, same idiom), `CodecStatics`,
`EdgeEncodedSchema`/`GraphEncodedSchema`, `LiteralKit`, `MappedLiteralKit`,
`VariantSchema.core.ts`'s `Class`/`Field`/`Struct`/`Union`. All read and
confirmed to follow the identical `extends <schema-base-type>` +
`Rebuild: this` pattern; the MutableHashMap.ts falsification generalizes
directly (same `S.make<T>()` requirement, same category error).

Also same-family by inspection (function/constructor-signature generics,
not data): `StatusCauseTaggedErrorClassFactory`/`CauseTaggedErrorFactory`/
`TaggedErrorClassFactory` (overloaded call-signature interfaces typing a
curried class factory — no data fields at all), `FnSchemaNoArg`/
`FnSchemaUnary` (Fn.schema.ts).

## Attempt 4 (outside assigned sample, justified by reconnaissance) — `GraphNode<A>` (`@beep/nlp-processing/src/Graph/EffectGraph.ts:178`)

Not in the 11-entry sample, but the cluster-wide read (above) showed
`@beep/nlp-processing`/`@beep/nlp` contribute ~18 entries that are
**structurally different** from every pattern in the sample: plain-data-
shaped interfaces (`GraphNode<A> { data: A; id: NodeId; metadata:
NodeMetadata; parentId: Option<NodeId> }`) whose `A` is completely free
(instantiated with `GraphNode<string>` in the file's own doc example, not
`GraphNode<Schema<string>>`). This looked like a plausible genuinely-
convertible subset undercutting a blanket verdict, so it was worth one real
falsification check before generalizing.

Minimal real test: constrained the type parameter the way an `S.Class`-based
conversion would require (`A extends S.Top`) and typechecked, without
touching any call site:

```diff
-export interface GraphNode<A> {
+export interface GraphNode<A extends S.Top> {
   readonly data: A;
```

**Result:** `npx tsgo -b tsconfig.json` in `packages/foundation/capability/nlp-processing`:

```
64 errors across:
  src/Graph/EffectGraph.ts (22 errors)
  src/Graph/GraphOperations/Executor.ts (17 errors)
  src/Graph/GraphOperations/Operation.ts (7 errors)
  src/Graph/GraphOperations/Types.ts (4 errors)
  src/Graph/TypeClass.ts (14 errors)
```

All `TS2344: Type '{A|B|unknown}' does not satisfy the constraint 'Top'`.
`GraphNode<A>`/`EffectGraph<A>` back a categorical Functor/Foldable/
Traversable typeclass library (`Composable`, `Foldable`, `Functor`,
`TextOperation`) whose whole point is operating over **arbitrary** `A`/`B`
via plain functions (`map: (f: A => B) => ...`), not schema-carrying data —
`GraphOperations/Executor.ts` even instantiates `GraphNode<unknown>`.
Constraining `A` to `S.Top` breaks the public contract at every call site in
the package (not a narrow ripple — the type parameter is exercised
generically dozens of times), which is exactly RC-SF's disqualifying
condition ("if it cannot preserve the public contract, report
unconvertible"). **Verdict: unconvertible**, and this generalizes to the
sibling shapes in the same two files/module family (`OperationResult`,
`StoredResult`, `GraphOperation`, `GraphExecutorShape`, `NLPBackendShape` in
`@beep/nlp-processing`; `Monoid`, `SearchIndex`, `OperationDefinition` in
`@beep/nlp` follow the same categorical-typeclass idiom by inspection —
`Monoid<A>`'s `combine`/`empty` are operation members, not data; not
individually compile-tested). File reverted
(`git checkout -- packages/foundation/capability/nlp-processing/src/Graph/EffectGraph.ts`).

## Files touched this run (all reverted, confirmed individually)

- `packages/foundation/modeling/md/src/Md.behavior.ts` — reverted, `git diff` empty.
- `packages/foundation/capability/mcp-kit/src/FieldTier.ts` — my edit reverted
  (confirmed no `FieldTierSetSchema`/`S.declare` residue); file still shows a
  diff from an unrelated concurrent lane (`ProjectWithinBudgetOptions`
  positional-arg collapse) — not touched, not mine, left as-is per the
  concurrency rule.
- `packages/foundation/modeling/schema/src/MutableHashMap.ts` — reverted, `git diff` empty.
- `packages/foundation/capability/nlp-processing/src/Graph/EffectGraph.ts` — reverted, `git diff` empty.

No `standards/*.jsonc` file touched. No commits made.

## Verdict

**Mixed**, but overwhelmingly unconvertible, with all four real attempts
(three from the assigned sample, one falsification probe on a shape family
the sample didn't cover) producing concrete disqualifying evidence:

1. Interfaces extending `S.declareConstructor`/`S.decodeTo`/`S.Bottom`/
   `VariantSchema.Field` (~52 `@beep/schema` entries + a handful elsewhere):
   these already ARE schema (custom Schema-combinator types), following the
   exact idiom effect v4 core uses for its own built-ins; the named
   interface is structurally required (`S.make<T>()`'s `T` isn't inferable
   any other way — verified by deletion). Converting "to S.Class" is a
   category error.
2. Function/behavior-member interfaces (`SegmentStrategy`,
   `ProjectWithinBudgetOptions`, `Composable`/`Foldable`/`Functor`/
   `TextOperation`, factory call-signature types): compile under a
   `S.declare`-wrapped `S.Struct`, but fail the mandatory §5.3 arbitrary
   round-trip law (`Unsupported AST Declaration`) and either drop or
   mis-encode their function payloads. No legitimate schema exists for a
   record of behavior.
3. Container-of-schema-instances (`FieldTierSet`, likely `ClassInput`'s
   `FieldMap`/`Persisted` by the same pattern, not individually tested):
   same arbitrary-law failure, plus encoding leaks internal Schema AST
   representation.
4. Categorical/typeclass generics with free type parameters (`GraphNode<A>`,
   `EffectGraph<A>`, and the `@beep/nlp-processing`/`@beep/nlp` family):
   constraining `A` to `S.Top` (required for any S.Class-based conversion)
   cascades to 64 compile errors across 5 files from a single-line change,
   because the type parameter is exercised generically and unconstrained
   throughout the package's Functor/Foldable/Traversable combinators.

No convertible subset was found in the 11-entry sample or in the additional
reconnaissance pass across all 73 entries' file/symbol list. I did not find
any entry that looked like an ordinary pure-data interface accidentally
exempted (the closest candidates — `GraphNode`/`EffectGraph`/
`OperationResult`/`StoredResult` — turned out to be free-type-parameter
categorical generics on inspection and compile-test, not disguised data
models).

**Recommended detector-scope change** (for driver review, not self-executed):
add a `schema-infrastructure-generic` exemption class to the schema-first
detector for exported generic interfaces/type-aliases whose `extends`
clause resolves to `S.declareConstructor`/`S.decodeTo`/`S.Bottom`/
`VariantSchema.Field` (or their re-exported aliases) AND that declare a
`Rebuild: this` self-reference — this is a structural, mechanically
detectable signature (not a vibes-based carve-out), matching effect v4
core's own idiom verbatim. A second, narrower exemption for generic
interfaces where every member is function-typed (no data fields) would
catch the `SegmentStrategy`/`Composable`/`Foldable`/`Functor`/
`TextOperation`/`*ClassFactory` family. Fixture pair would need: (a) a
still-fires case — a plain pure-data generic interface with no
`S.declareConstructor`/`Bottom`/`decodeTo` extends and at least one non-
function field (e.g. a hypothetical `interface Box<A> { value: A }`) must
still be flagged; (b) a newly-excluded case — an interface identical in
shape to `MutableHashMapFromSelf`/`EdgeFromSelf` (extends `declareConstructor`
+ `Rebuild: this`) must go silent.

```json
{"clusterId":"S1-generic","entryCount":73,"classification":"mixed","convertibleSubset":"none found in the 11-entry sample or the full 73-entry file/symbol reconnaissance; estimated 0 of 73","evidence":["Md.behavior.ts SegmentStrategy: S.declare wrapper compiles (0 tsgo errors) but S.toArbitrary throws 'Unsupported AST Declaration' and S.encodeSync drops all 3 function fields to {} — reverted","FieldTier.ts FieldTierSet: S.declare wrapper compiles but S.toArbitrary throws identically and S.encodeSync leaks internal ~effect/Schema AST representation instead of data — reverted","MutableHashMap.ts MutableHashMapFromSelf/MutableHashMap: deleting the named interfaces breaks S.make<T>() type inference (TS2339 'pipe does not exist on Constraint' x2) because S extends Constraint can't be inferred from S['ast'] alone — reverted; same idiom appears 40+ times in .repos/effect-v4 packages/effect/src/Schema.ts itself (OptionFromNullOr, ArrayEnsure, DurationFromString, etc.)","EffectGraph.ts GraphNode<A> (outside sample, reconnaissance-flagged): constraining A extends S.Top cascades to 64 TS2344 errors across 5 files (EffectGraph.ts, GraphOperations/{Executor,Operation,Types}.ts, TypeClass.ts) from one line, because A/B are free type parameters threaded through Functor/Foldable/Traversable combinators, not schema-bound — reverted"],"detectorChange":"Add schema-infrastructure-generic exemption: exported generic interface/type-alias whose extends clause resolves to S.declareConstructor|S.decodeTo|S.Bottom|VariantSchema.Field (directly or via re-export) AND declares a self-referential Rebuild: this member goes silent (covers ~55-60 of 73, mostly @beep/schema). Add function-member-generic exemption: exported generic interface where every member's type is a function signature (no data-typed fields) goes silent (covers SegmentStrategy/ProjectWithinBudgetOptions/Composable/Foldable/Functor/TextOperation/*ClassFactory family, ~10-15 of 73). Residual categorical-generic family (GraphNode/EffectGraph/OperationResult/StoredResult, free non-Schema type parameter threaded through typeclass combinators) needs a third, narrower carve-out or per-entry driver sign-off since it's less mechanically detectable than the other two.","fixtureSpec":"still-fires: interface Box<A> { value: A } (no schema-base extends, has a non-function data field) must remain flagged. newly-excluded: interface FooFromSelf<K extends S.Top> extends S.declareConstructor<...> { readonly key: K; readonly Rebuild: this } must go silent under exemption 1; interface Strategy<A> { readonly run: (a: A) => string } (all-function members) must go silent under exemption 2.","estimatedLaneCount":0}
```
