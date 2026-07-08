# SF-1 pilot — GraphNode categorical-generic family (R6 sub-family 3)

Wave: `SF-1` (P4 schema-first pilot). Single writer for both
`packages/foundation/capability/nlp-processing` (`@beep/nlp-processing`) and
`packages/foundation/modeling/nlp` (`@beep/nlp`). Charter: full-package
refactor authority to attempt a real schema-factory / typeclass-over-`.Type`
design on the categorical data generics the S1 audit (`p2-s1-generic.md`
attempt 4) found unconvertible via the naive `A extends S.Top` one-liner.
No commits, no inventory regen, no `standards/*.jsonc` touched.

## Verdict up front

**8 of 8 nlp-processing entries + 3 of 4 nlp generic-interface entries:
unconvertible**, confirmed by two fresh, genuinely different in-tree compile
probes (not a repeat of S1's single-file test) plus a direct read of the
detector source. **1 entry (`TypedText`, `@beep/nlp`) converted in place** —
structurally different from the rest of the family (bounded, not free, type
parameter) and now derives from its existing schema factory instead of
duplicating it, though the current detector still flags it (a documented,
narrow gap, not a code problem). No degenerate/dead-code schema shells were
added anywhere (fence 14).

## Detector mechanics read directly (not inferred)

Read `detectInterfaceReason`/`detectTypeAliasReason`
(`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:1053-1162`)
end to end. For any exported **generic** interface or type-alias-over-a-
type-literal, there are exactly two silent escape hatches and no others:

1. Extends `S.declareConstructor`/`S.decodeTo`/`S.Bottom`/`VariantSchema.Field`
   **and** declares `Rebuild: this` (R6-1, schema-infrastructure idiom).
2. **Every** member is structurally function-like (`MethodSignature`/
   `CallSignatureDeclaration`/`FunctionType`-typed property) or a curated
   runtime-handle signal (R6-2).

Anything else — including a generic type-literal/interface with even one
genuine data field — falls straight to `GENERIC_INTERFACE_EXCEPTION_REASON` /
`GENERIC_TYPE_ALIAS_EXCEPTION_REASON`, unconditionally. There is no third path
that recognizes "this generic is already composed from a same-file schema
factory via `S.Schema.Type<ReturnType<typeof Factory<K>>>`" — this matters for
the `TypedText` finding below.

## Fresh compile evidence (genuinely different from S1's probe)

S1's attempt 4 edited **one line in one file** (`EffectGraph.ts`'s `GraphNode`)
and found 64 errors across 5 files, then stopped. Per the charter's
instruction that this pilot's attempt "must be different," I ran two sharper,
independent probes against different files/symbols in the same family, each
reverted after capture (`git status --short` clean, `tsgo -b` clean,
confirmed after each revert):

**Probe 1 — `TypeClass.ts`'s own `TextOperation<A, B, R, E>`.** Changed only
the interface's own type-parameter declaration to
`<A extends S.Top, B extends S.Top, ...>` (a different file/symbol than S1
touched). Result: **104 errors in this one file alone** — worse than S1's
cross-file total, because every general-purpose combinator in the file
(`makeOperation`, `pureOperation`, `map`, `flatMap`, `chain`, `ap`, `alt`,
`replicate`, `when`, ...) instantiates `TextOperation` with bare unconstrained
type parameters. Decisive line: `ap`'s own signature,
`opFn: TextOperation<A, (b: B) => C, R1, E1>` (`TypeClass.ts:674`), errors with
`TS2344: Type '(b: B) => C' does not satisfy the constraint 'Top'` — **proof,
not inference, that this family's free type parameter is instantiated with a
function value in real code** (the Applicative `ap` combinator's
functions-as-node-data case). This is the same failure mode the S1 audit
documented for `SegmentStrategy` (`S.declare`-wrapped functions fail
`S.toArbitrary` with "Unsupported AST Declaration" and silently drop to
`undefined`/`{}` on encode) — except here it isn't hypothetical, it's the
type class's own applicative instance.

**Probe 2 — `@beep/nlp`'s `Monoid<A>`** (`src/Algebra/Monoid.ts`). Same
single-line constraint change. Result: **96 errors**, every one of them at a
concrete monoid instance: `StringConcat: Monoid<string>`,
`NumberSum/NumberProduct/NumberMax/NumberMin: Monoid<number>`,
`MultiSet: Monoid<HashMap<K, number>>`, `SetUnion: Monoid<HashSet<A>>`,
`SetIntersection: Monoid<O.Option<HashSet<A>>>`, `VectorAdd:
Monoid<ReadonlyArray<number>>`, `Endo: Monoid<(a: A) => A>`. Every real monoid
in the file is over a **plain value type**, never a schema instance — `Endo`
is the same function-value proof as probe 1 (`(a: A) => A` cannot satisfy
`Top`). `Monoid<A>`'s carrier ranges over "the set of values forming the
algebraic structure" (abstract-algebra sense), which is definitionally
incompatible with "a value that is itself a `Schema<Type,Encoded,Context>`."

## Why the schema-factory / typeclass-over-`.Type` candidates don't apply here

The charter's candidate (a) — schema-factory producing schemas at validation
boundaries while the typeclass layer keeps operating over plain `.Type`
derivations — requires **real call sites that hold a concrete schema for the
payload type**. Checked directly:

- `rg` for `S.encode\(|S.decode` near `Graph`/`Node` in nlp-processing: **zero
  hits**. `GraphNode`/`EffectGraph` are never encoded, decoded, or persisted
  anywhere in the package.
- The package's actual graph-construction call sites
  (`TextGraph.ts`, `AnnotatedTextGraph.ts`) **bypass `EffectGraph`/`GraphNode`
  entirely** — they use raw `Graph.DirectedGraph<TextNode, TextEdge>` directly
  (`TextNode`/`TextEdge` are already `S.Class`-derived in `@beep/nlp`'s
  `Graph/Schema.ts`). There is no site anywhere in the repo that instantiates
  `GraphNode<SomeConcreteDomainSchema>`.
- `Executor.ts` explicitly instantiates `GraphNode<unknown>` for its
  type-erased `Application`/`ExecutionFold` shapes — the erasure is load-
  bearing (heterogeneous cache values), not an oversight.

Building a `GraphNodeSchema<A extends S.Top>` factory with no real consumer
would be dead code whose only purpose is claiming a green detector row — the
charter's fence-14 spirit note forbids exactly this ("do not force a
degenerate design to claim success"). Candidate (b) (keep the typeclass
generic, schema-derive the "exported pure-data shape") collapses to the same
problem: there is no separate monomorphic pure-data shape to extract — the
free type parameter *is* the payload, and it is proven (probes above) to
range over function types the schema system cannot represent regardless of
factoring.

## Disposition table

### `@beep/nlp-processing`

| symbol | file | disposition | reason / evidence |
|---|---|---|---|
| `GraphNode<A>` | `Graph/EffectGraph.ts:178` | **unconvertible** | Free `A` proven to range over function types transitively (via `TextOperation`'s `ap`, probe 1); zero concrete instantiation sites anywhere in the package (`rg` swept); S1's original 64-error cascade reproduced in spirit by probes 1/2 on different files. |
| `EffectGraph<A>` | `Graph/EffectGraph.ts:227` | **unconvertible** | Direct container of `GraphNode<A>`; inherits the disqualification. |
| `Composable<A, R, E>` | `Graph/TypeClass.ts:142` | **unconvertible** | `identity: TextOperation<A, A>` field is itself the unconvertible type; `compose` is function-typed. |
| `ForgetfulOperation<A, B, R, E>` | `Graph/TypeClass.ts:399` | **unconvertible** | `apply` is a function field over `GraphNode<A>`/`GraphNode<B>`; only other member (`name: string`) is too thin to justify a split that would break the single-object public contract. |
| `TextOperation<A, B, R, E>` | `Graph/TypeClass.ts:59` | **unconvertible** | Probe 1 (fresh, this pilot): 104 `tsgo` errors from one line; `ap`'s `(b: B) => C` instantiation is a hard `S.Top` violation, not a ripple-size problem. |
| `GraphOperation<A, B, R, E>` | `Graph/GraphOperations/Operation.ts:57` | **unconvertible (as one object)** | `apply`/`estimateCost`/`validate` are function fields over `GraphNode<A>`/`GraphNode<B>`. A descriptor/behavior split (`category`/`description`/`name` vs. the function bundle) is theoretically viable per the R11-4 "ExportedTool" precedent — `category`/`description`/`name` don't depend on `A`/`B` at all — but it would change the public contract (every `operation.X` call site in `Executor.ts` becomes two objects) and is a distinct, larger redesign than this charter authorized. Flagged below as a follow-up recommendation, not attempted. |
| `OperationResult<B, E>` | `Graph/GraphOperations/Types.ts:716` | **unconvertible** | `newNodes: ReadonlyArray<GraphNode<B>>` for free `B`; `originalGraph: unknown` is intentionally opaque (documented). Inherits `GraphNode`'s disqualification. |
| `StoredResult` | `Graph/GraphOperations/ResultStore.ts:114` | **unconvertible** | Non-generic itself, but `result: AnyOperationResult = OperationResult<unknown, unknown>` inherits the disqualification transitively; `hits`/`timestamp`/`key` alone are already fine (key is `ResultKey`, already `S.Class`). |

### `@beep/nlp`

| symbol | file | disposition | reason / evidence |
|---|---|---|---|
| `Monoid<A>` | `Algebra/Monoid.ts:40` | **unconvertible** | Probe 2 (fresh, this pilot): 96 `tsgo` errors from one line; every real instance (`StringConcat`, `NumberSum`, `MultiSet`, `SetUnion`, `Endo`, ...) is over a plain value type, several (`Endo`) over function types — the abstract-algebra carrier-type sense of "generic" is incompatible with `S.Top`. |
| `SearchIndex<K, A>` | `Graph/GraphOps.ts:106` | **unconvertible** | `keyFn: (node: A) => ReadonlyArray<K>` is a stored function (behavior), `index: HashMap.HashMap<K, ReadonlyArray<NodeIndex>>` is a plain-value HashMap keyed by free `K` with no schema counterpart anywhere in the file — same mixed data+function, non-`Top`-value shape as the S1 audit's `FieldTierSet`/`MutableHashMap` attempts. |
| `OperationDefinition<A, B, R, E>` | `Operations/Definition.ts:48` | **unconvertible (as one object)** | Already the *closest* candidate in the whole family — it literally carries `inputSchema: S.Schema<A>`/`outputSchema: S.Schema<B>` as fields — but a field whose *value* is itself a `Schema` instance is exactly the S1 audit's `FieldTierSet` failure mode (`S.toArbitrary` throws, `encodeSync` leaks the internal AST instead of data), and `implementation: (input: A) => Effect.Effect<B, E, R>` is a behavior field. Same descriptor/behavior-split note as `GraphOperation` applies (`name`/`description`/`metadata` are genuinely schema-able); not attempted for the same public-contract-break reason. |
| `TypedText<K extends TextKind>` | `Ontology/Kind.ts:129` (now derived, was a hand-declared interface) | **fixed in code; detector still flags it (documented gap)** | See below — this one *is* structurally different from the rest of the family. |

## `TypedText` — the one real conversion, and why it's different

Unlike every other entry above, `TypedText<K extends TextKind>`'s type
parameter is **bounded to a finite literal union** (`TextKind`), not free —
and the file already had a working schema factory,
`TypedTextSchema = <K extends TextKind>(kind: S.Schema<K>) => S.Struct({kind,
content: S.String, metadata: ...})`, whose `.make(...)` the file's own smart
constructors (`Document`, `Token`, etc.) were already calling. The hand-
declared `interface TypedText<K> { content, kind, metadata? }` was pure
duplication of that factory's derived shape.

Converted: moved `TypedTextSchema` above the type declaration and replaced
the interface with
`export type TypedText<K extends TextKind> = S.Schema.Type<ReturnType<typeof TypedTextSchema<K>>>;`
— structurally identical (verified by full green compile + tests), single
source of truth is now the schema factory. Diff confined to
`packages/foundation/modeling/nlp/src/Ontology/Kind.ts`; no other file in the
repo imports `TypedText` (`rg` swept `packages`/`apps`).

**This does not currently zero out the inventory entry.** Per the detector
read above, a generic type alias whose type node is `S.Schema.Type<...>`
(an `IndexedAccessType`/generic `TypeReference`, not a `TypeLiteral`) still
falls through to `GENERIC_TYPE_ALIAS_EXCEPTION_REASON` — the detector has no
rule recognizing "this generic type alias is composed from a same-file schema
factory," only the two escape hatches listed above. **Recommended detector-
scope addition (for driver review, not self-executed):** a third silent
exemption — generic type alias whose type node resolves to
`S.Schema.Type<ReturnType<typeof X<...>>>` (or `typeof X.Type`) where `X` is a
same-file exported `const` whose body is (or pipes to) an `S.Struct`/`S.Class`
call. Fixture pair: **still-fires** — `type Box<A> = { value: A }` (plain
type-literal alias, no factory indirection); **newly-excluded** —
`type Foo<K extends Bound> = S.Schema.Type<ReturnType<typeof FooSchema<K>>>`
where `FooSchema` is a same-file `S.Struct`-returning factory.

## Recommended follow-up (not self-executed, out of this pilot's scope)

`GraphOperation` (`@beep/nlp-processing`) and `OperationDefinition`
(`@beep/nlp`) both have a genuine severable pure-data subset
(`category`/`description`/`name` and `name`/`description`/`metadata`
respectively) alongside an irreducible function/schema-carrying remainder,
matching the R11-4 "ExportedTool" descriptor/behavior-split precedent. Unlike
the rest of this family, these are *not* proven categorically impossible —
but splitting either into two exported types changes the public contract
(every `operation.X`/`definition.X` call site, especially
`GraphOperations/Executor.ts`'s dozen-plus accesses, would need to address two
objects instead of one), which is a larger, cross-cutting redesign than "full
package refactor" was scoped to authorize here. Recommend a dedicated goal
packet with driver sign-off if this is wanted, rather than forcing it into
this pilot's verified-fails outcome.

Out of scope, left untouched: the 6 `Graph/Schema.ts` inline
`object-struct-schema` entries and the `TypedTextSchema` function-local-
wrapper entry in the same `beep__nlp.json` slice — these belong to the
established S7/S9 inline-`S.Struct`-extraction cluster (R10), not the R6-3
categorical-generic family this pilot was chartered for.

## Files touched

- `packages/foundation/modeling/nlp/src/Ontology/Kind.ts` — `TypedText`
  conversion (kept).
- `packages/foundation/capability/nlp-processing/src/Graph/TypeClass.ts` —
  probe 1 (`TextOperation<A extends S.Top, ...>`), reverted
  (`git status --short` clean, confirmed via full-directory restore from a
  pre-edit backup).
- `packages/foundation/modeling/nlp/src/Algebra/Monoid.ts` — probe 2
  (`Monoid<A extends S.Top>`), reverted the same way; `git status --short`
  confirmed clean immediately after. A **later, unrelated concurrent diff**
  now sits in this file (a `checkIdentity` helper extracted from
  `checkLeftIdentity`/`checkRightIdentity`) — not authored by this lane, not
  present at my post-revert clean check, almost certainly a concurrent P3
  dual-arity-wave dedup pass on the same branch. Left untouched per the
  concurrency rule (same posture as the S1 audit's `FieldTier.ts` note);
  re-verified `tsgo`/`vitest` green with it in place.

No `standards/*.jsonc` touched. No commits made.

## Verification

- `npx tsgo -b tsconfig.json`: clean in both packages (post-revert and with
  the `TypedText` change in place).
- `npx vitest run`: `@beep/nlp` 166/166 (10 files); `@beep/nlp-processing`
  68/68 (7 files) — both unchanged counts, all green.
- `turbo run build check test docgen --filter=@beep/nlp --filter=@beep/nlp-processing`:
  35/35 tasks successful (16 cached), docgen typechecked 296/292 examples
  respectively.

## Summary (≤10 lines)

R6-3 GraphNode family: 11 of 12 flagged generic-interface entries across both
packages confirmed **unconvertible** with fresh, file-specific compile proofs
(not a repeat of S1's probe) — `TypeClass.ts`'s `ap` and `Monoid.ts`'s `Endo`
both prove the free type parameter is instantiated with function values,
which no schema can represent regardless of factoring; zero real concrete-
schema consumers exist anywhere in either package. `TypedText` (bounded, not
free, type parameter) was genuinely converted to derive from its existing
`TypedTextSchema` factory — tests/build/docgen green in both packages — but
the current detector still flags it; documented a narrow, evidenced exemption
recommendation for driver review. `GraphOperation`/`OperationDefinition` have
a theoretically viable descriptor/behavior split but it's a public-contract-
breaking redesign outside this charter's scope — flagged as a follow-up, not
attempted. No degenerate schema shells added anywhere.
