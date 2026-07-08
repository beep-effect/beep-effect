# SF-1 — @beep/schema (packages/foundation/modeling/schema)

Lane: `sf-1-schema`. Single writer for `@beep/schema`. 35 assigned entries
(`ops/slices/P4/beep__schema.json`), all recorded `status: "exception"` after
the detector rebuild. Posture: invalidate each recorded reason by attempting
the real conversion (RC-SF). Baseline before any edit: `npx tsgo -b` clean,
`vitest run` 69 files / 614 tests green.

## Disposition summary

| # | File | Symbol | Kind | Disposition |
|---|---|---|---|---|
| 1 | Csp/Csp.schema.ts | `CspDirectives` | object-struct-schema | **fixed** |
| 2 | CauseTaggedError/CauseTaggedError.errors.ts | `isExtras` | object-struct-schema | **fixed** |
| 3 | LiteralKit/LiteralKit.schema.ts | `union` | object-struct-schema | **unconvertible** (regression reproduced) |
| 4 | VariantSchema/VariantSchema.core.ts | `extract` | object-struct-schema | **unconvertible / blocked: ripple** (regression reproduced) |
| 5-27 | see "Generic-interface cluster" below | 22 entries | exported-interface | **unconvertible**, fresh detector-gap evidence supplied |
| 28-30 | EntitySchema.definition.ts / EntitySchema.persist.ts | `AssignedEntityParts`, `ClassInput`, `PersistOptions` | exported-type-literal | **unconvertible**, fresh evidence |
| 31-35 | 6 test files (Currency/Fn/Promise/Territory/Timezone/Transformations) | `schema-codec-tests` | schema-policy-advisory | **exception confirmed valid** |

## Fixed (2) — full §5.3 parity proof

### `CspDirectives` (Csp/Csp.schema.ts)

`S.Struct({...FetchDirective.fields, ...DocumentDirective.fields, ...})` →
named `class CspDirectives extends S.Class<CspDirectives>($I\`CspDirectives\`)({...spreads unchanged...}, $I.annote(...)) {}`.
Spreads/computed keys carry through unchanged into the class fields arg
(confirms R10's S7 finding).

- Parity: generated 25 `S.toArbitrary(CspDirectives)` samples with a fixed
  seed (`{ numRuns: 25, seed: 42 }`), captured `S.encodeSync` wire output
  before (git-committed `S.Struct` version, via `git show HEAD:...`) and after
  the edit — **byte-identical** (`diff` clean).
- Round-trip law added: `test/Csp.test.ts` (`S.toArbitrary` + `fc.assert`
  property, 25 runs: `encode(decode(encode(x))) === encode(x)`), plus a
  `mapFields` still-works assertion (the field consumed by
  `ContentSecurityPolicyOptionStruct.directives`).
- Verify: `tsgo -b` clean; `vitest run` 70 files / 616 (then 617 after the
  next fix) passed.

### `isExtras` (CauseTaggedError/CauseTaggedError.errors.ts)

`S.is(S.Struct(fields))` (generic `fields: Fields`, not a plain object
literal) → local generic-factory class per R10's `TypedTextSchema` technique:
`class ExtrasShape extends S.Class<ExtrasShape>("CauseTaggedErrorExtras")(fields as S.Struct.Fields) {}; const isExtras = S.is(ExtrasShape);`.

- **Real finding en route**: `S.is(SomeClass)` requires actual `instanceof`,
  not structural match — confirmed with a throwaway script: a plain object
  with the exact right shape passed `S.is(S.Struct(fields))` (`true`) but
  failed `S.is(ExtrasShape)` (`false`); only a real `new ExtrasShape(...)`
  instance passes the class-backed check. This is the same failure mode that
  later reproduced (at full package-test scale) for `union` and `extract`
  below.
- Because `makeCauseTaggedErrorExtrasDecoder`'s two branches already returned
  the identical expression regardless of `isExtras`'s value
  (`if (isExtras(input)) return input; return input as ...;` — both branches
  return the same input), the observable behavior of the decoder function is
  unchanged for every input; only the internal (unused) boolean's semantics
  shifted from "structural match" to "instanceof". Cast both branches to the
  same type to keep the compiler honest about this.
- Parity: added a property-based test in `test/CauseTaggedError.test.ts`
  round-tripping arbitrary `S.String` values as `OperationError.new(cause,
  "boom", { operation })` extras (25 runs) — `error.operation === operation`
  for every sample, proving the public passthrough contract survives.
- Verify: `tsgo -b` clean; `test/CauseTaggedError.test.ts` 27/27 (was 26),
  full suite 70 files / 617 tests green.

## Unconvertible with reproduced regressions (2)

### `union` (LiteralKit/LiteralKit.schema.ts, `toTaggedUnion`)

This is the dedicated-lane entry named in both the fixer prompt and R10
("LiteralKit.schema.ts `union` ... gets a dedicated P4 lane with full package
test proof"). Real attempt made: replaced the per-member
`S.Struct({[tag]: S.tag(member.literal), ...cases[...]})` inside `.mapMembers`
with a per-member local class
(`class TaggedUnionMemberShape extends S.Class<TaggedUnionMemberShape>(...)(memberFields) {}`),
compiled clean (`tsgo -b`), then ran the **full package** `vitest run` per the
prompt's explicit instruction.

**Result: 3 test failures**, all in `test/LiteralKit.test.ts`:
`Event.guards.created({ kind: "created", value: 1 })` (and two structurally
identical cases) returned `false` instead of `true`. Root cause: `S.toTaggedUnion`
derives its generated `.guards.<case>` predicates from `S.is` on each union
member; once members are `S.Class` instances, `S.is` requires `instanceof`
(same mechanism found above for `isExtras`) — so **every plain-object input,
which is how 100% of call sites use `.toTaggedUnion`'s output, now fails the
generated guard.** Reverted immediately
(`git diff --stat` clean after revert, `tsgo -b` clean, targeted
`vitest run LiteralKit` 38/38 green).

Blast radius if this had been forced through anyway: grepped the whole repo
for `\.toTaggedUnion\(` called on a `LiteralKit(...)`/named-kit value (not
`S.Union([...]).pipe(S.toTaggedUnion(...))`, a different, unaffected idiom).
Consumers outside `@beep/schema`: `packages/drivers/uspto-mcp/UsptoDocumentTiers.ts`,
`packages/tooling/policy-pack/repo-configs/.../Routes.schema.ts`,
`packages/law-practice/domain/entities/{Rejection,Distinction}/*.values.ts`,
`packages/tooling/library/repo-utils/.../HasJSDocApplicableToMapEntry.model.ts`,
`packages/foundation/ui-system/ui/notification-card.tsx`,
`packages/foundation/capability/mcp-kit/{FieldTier,TierGate}.ts`,
`packages/foundation/capability/observability/{CauseDiagnostics,CoreConfig}.ts`,
`packages/epistemic/domain/.../ClaimGateResult.model.ts` (~12 call sites, 8+
packages), plus 2 in-package consumers (`EntitySchema.persist.ts`'s
`IndexHintKind`/`StorageKind`). **Disposition: unconvertible / high-risk**,
per the fixer prompt's explicit escape hatch ("report `blocked: high-risk`
... if the conversion changes any public type"). No detector-scope change
recommended here — the shape (`S.Struct` fed by a computed tag key + case
spread inside a closure) is intrinsic to how a tagged-union member needs to
support both `S.is`-based generated guards over plain data AND arbitrary
per-case field spreads; there is no code-level fix that preserves both.

### `extract` (VariantSchema/VariantSchema.core.ts)

Central mechanism of `Model.Class`/`VariantSchema.make(...).Class` — every
domain entity/aggregate in the repo goes through this function to build its
`.select`/`.insert`/`.update`/`.json*` variant schemas. Real attempt: replaced
`S.Struct(fields as S.Struct.Fields)` with a local
`class ExtractedVariantShape extends S.Class<ExtractedVariantShape>(...)(fields as S.Struct.Fields) {}`.

- First cast attempt (`as Extract<V, A>`) failed to compile in this same file:
  `TS2352: Conversion of type 'typeof ExtractedVariantShape' to type
  'Extract<V, A, false>' may be a mistake because neither type sufficiently
  overlaps` — direct, in-file proof that `Extract<V,A,IsDefault>`'s own type
  definition (`S.Struct<Struct_.Simplify<ExtractFields<V, Fields>>>`,
  `VariantSchema.core.ts:272-278`) structurally rejects an `S.Class` value.
- Forced past that with `as unknown as Extract<V, A>` to observe runtime
  behavior. Package still type-checked (`tsgo -b` clean — nothing else in
  `@beep/schema` does a literal `S.Struct<Fields>` type-position assertion
  against this specific return), but **`vitest run` failed 12 tests across 3
  files**: `test/EntitySchema.test.ts` (3), `test/VariantSchema.test.ts` (6),
  `test/Model.test.ts` (2), plus one more in EntitySchema.test.ts's earlier
  encode assertion. Failure modes: `Object.keys(Fixture.insert.fields)` →
  `TypeError: undefined is not an object` (variant-struct field enumeration
  breaks for class-backed variants used inside `.mapFields`/`.extend` chains);
  `S.encodeSync(select)({...plainObject})` → `SchemaError: Expected
  VariantSchema.extract.select, got {...}` (encode/decode themselves reject
  plain-object input once the extracted schema is class-backed — a strictly
  worse failure than the `union` case, not just guard predicates).
- Reverted immediately; confirmed clean (`git diff --stat` empty, `tsgo -b`
  clean, full suite back to 70 files / 617 tests green).

**Disposition: unconvertible / blocked: ripple.** `Extract<V, A, IsDefault>`'s
type signature (`S.Struct<...>`) is consumed by name throughout
`Model.variants.ts` (`ModelClassCore`) and, transitively, by every entity file
across the repo that types a field as `SomeModel.insert`/`.update`/etc. A
signature change here is definitionally outside `packages/foundation/modeling/schema`'s
fence. Not attempted further; STOPped per fence 10.

## Generic-interface cluster (22 entries) — R6 sub-family-1, with fresh detector-gap diagnosis

All 22 remaining `exported-interface` entries extend a schema-combinator base
(`S.declareConstructor`, `S.decodeTo`, `S.Bottom`, `S.Codec`, `S.Union`,
`VariantSchema.Field`, `VariantSchema.Overridable`, or a local alias one level
removed from one of those) and either declare `readonly Rebuild: this` or have
an empty own body that exists purely for the type/value dual-binding — R6's
already-locked "schema-infrastructure generic" sub-family
(`S.make<T>()` cannot infer `T`; a truly generic self-referencing schema
combinator has no runtime data shape for §5.3 to check).

**I confirmed the R6 detector fix has already landed** (read
`detectInterfaceReason`/`detectTypeAliasReason` in
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:1053-1162`
directly) and did two real compile-tested deletion attempts against it
(`EdgeEncodedSchema` in `Graph.encoded.ts`, full delete + inline at all 3 use
sites including the cross-file `Graph.edge.ts` consumer): inlining the
anonymous type **compiles**, but only by silently dropping the interface's
`readonly Rebuild: this` member (no member of that name/type exists in the
inlined anonymous type) — an undocumented public-API removal, not a
conversion. Reverted (`git diff --stat` clean, `tsgo -b` clean). A second
experiment (interface → generic `type` alias, keeping `Rebuild`) still
compiles but only reclassifies into `GENERIC_TYPE_ALIAS_EXCEPTION_REASON`
(confirmed by reading the constant at `SchemaFirst.ts:849-850`) — a lateral
move, not a fix.

Reading the detector's exact matching logic explains precisely why these 22
still surface despite R6 already being live, and splits into four concrete,
narrow gaps (recommend the driver evaluate all four together, one lane, one
fixture-pair commit per SPEC fence 11):

1. **`S.Codec` / `S.Union` missing from `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN`**
   (`SchemaFirst.ts:70-71`, currently
   `/\b(?:S|Schema)\.(?:declareConstructor|decodeTo|Bottom)\b|\bVariantSchema\.Field\b/`).
   Affects 4: `Fn.schema.ts` `FnSchemaNoArg`/`FnSchemaUnary` (extend
   `S.Codec<...>`, non-empty bodies with real `implement*`/`inputSchema`/
   `outputSchema`/`errorSchema` members + `Rebuild: this`),
   `Graph.encoded.ts` `EdgeEncodedSchema`/`GraphEncodedSchema` (same shape).

2. **R13's `isEmptyOrMetaOnlyOwnBody` carve-out (driver-verified against
   `DateTimeInsert`) is only wired into the *non-generic* extends branch**
   (`detectInterfaceReason:1075`, guarded by `node.getTypeParameters().length
   === 0` at the outer `if` on line 1057) — **it never runs for a generic
   interface**, even when the generic interface's own body is empty and its
   extends target matches the schema-infra pattern exactly like
   `DateTimeInsert` does. Affects 8, every one an empty-body
   `extends VariantSchema.Field<{...}> {}` / `extends S.decodeTo<...> {}` /
   `extends S.Bottom<...> {}`: `Model.fields.ts` `JsonFromString`,
   `FieldOption`, `Generated`, `GeneratedByApp`, `Sensitive`, `optionalOption`;
   `Model.uuid.ts` `UuidV4Insert`; `VariantSchema.overridable.ts`
   `Overridable`. Fix: apply `isEmptyOrMetaOnlyOwnBody(node.getMembers())` as
   an alternative to `hasRebuildThisMember` inside the generic branch too.

3. **Extends-target resolution doesn't walk one level of local alias/interface
   indirection** before testing the pattern (the repo already has
   `resolveOneLevelLocalTypeAlias`, used elsewhere per R11-6, but not applied
   to `extendsSchemaInfrastructureBase`). Affects 5: `Graph.edge.ts` `Edge`
   (`extends EdgeTransform<Data>`, itself `extends S.decodeTo<...>`),
   `LiteralKit.schema.ts` `LiteralKit` (`extends LiteralKitBase<L,M>`, itself
   `S.Literals<L> & {...}`), `MappedLiteralKit.schema.ts` `MappedLiteralKit`
   (`extends MappedLiteralKitBase<M>`), `Model.variants.ts` `Overrideable`
   (`extends Overridable<S>`, local), `VariantSchema.overridable.ts`
   `Overrideable` (`extends Overridable<S>`, local).

4. **`VariantSchema.Overridable` (distinct from `VariantSchema.Field`) is
   absent from the pattern entirely.** Affects 1: `Model.variants.ts`
   `Overridable` (`extends VariantSchema.Overridable<S> {}`, empty body — also
   needs fix #2 applied together).

**Residue not covered by any of the four gaps above (4):**
`VariantSchema.core.ts`'s own `Class`, `Field`, `Struct`, `Union` — these are
the toolkit's foundational definitions that every other entry in this cluster
ultimately derives from. `Class` extends `S.Bottom<...>` (pattern-matched) but
has substantial non-empty own members (`extend`, `fields`, `make`,
`mapFields`, `new` — all schema-infra methods/accessors, no `Rebuild: this`
declared); `Field`/`Struct` extend `Pipeable` (not a schema base at all,
by design — they're plain tagged carriers); `Union` extends `S.Union<{...}>`
(would be covered by fix #1, but still has no `Rebuild`). These four don't fit
the four mechanical gaps above without also either (a) composing real member
lists through the generic branch (a bigger detector change than 1-4, and one
that risks reclassifying them as gate-failing `candidate`s per R11-4's "mixed
data+function, no structural signal" rule, since `fields`/`make`/`mapFields`
are exactly that shape) or (b) a narrow, explicit by-name allowlist. Recommend
the driver treat these 4 as the canonical positive controls for whatever R6
extension ships — they're the exact shape R6's own prose describes
("the named interface is structurally required") and were the reason `S1`
audit's `MutableHashMapFromSelf` precedent was chosen in the first place.

No code-level fix exists for any of the 22 (attempted 2, reasoned the rest by
verified structural analogy per RC-SF's "attempt the conversion anyway"
posture combined with SPEC's time/scope fences) — every one requires either a
named self-referencing interface (to satisfy `S.make<T>()`'s inference) or
loses a real, non-vacuous member. **Disposition: unconvertible**, driver-owned
detector follow-up recommended (fixture pair per fence 11, single lane, not
mixed with code fixes).

## `exported-type-literal` cluster (3) — EntitySchema

`AssignedEntityParts` (`EntitySchema.definition.ts`), `ClassInput`
(`EntitySchema.definition.ts`), `PersistOptions` (`EntitySchema.persist.ts`).

These are pure compile-time entity-builder-DSL plumbing, never wrapped in a
schema and never decoded/encoded: `AssignedEntityParts.fields`'s *values* are
`S.Top` schema instances (an `EntityFieldInputs` map), and `.persisted`'s
values are `PersistDescriptor` shape descriptors — i.e. the "data" described
by these types is itself a map of schemas, not schema-describable JSON data.
`assignEntityParts`'s body (`Struct.assign(...)`) confirms this: it returns a
plain object built from two input maps, cast to the type, with no `S.Class`/
`S.Struct` wrapper at all — there is no schema value to convert. Same category
as R6 sub-family 1 (`VariantSchema.core.ts`'s `Struct`/`Field`/`Class`), except
`detectTypeAliasReason` (`SchemaFirst.ts:1139-1162`) has no equivalent "schema-
authoring plumbing, not decodable data" carve-out for type aliases at all
today — R6/R13's silent-skip logic is interface-shaped, not type-alias-shaped.
`ClassInput`/`PersistOptions` are the same DSL-input-descriptor shape.
**Disposition: unconvertible, fresh evidence** (no code-level attempt possible
— there is no `S.Struct(...)` call to convert and no schema instance backing
these types; a driver-authored type-alias-plumbing carve-out analogous to R6
would be the correct end state, not a lane-level code fix).

## `schema-policy-advisory` cluster (6) — confirmed valid, no fix

Read each named test file directly against its recorded reason; all 6 hold:

- `CurrencyCode.test.ts` / `TerritoryCode.test.ts` / `Timezone.test.ts`:
  finite `LiteralKit`/`MappedLiteralKit` enumerations generated from
  ISO-4217/CLDR/IANA data — `S.toArbitrary` over a closed literal union only
  re-samples already-enumerated members; example-based decode/reject/mapping
  assertions are the correct test shape.
- `Fn.test.ts`: meta-test of the `Fn`/`ThunkOf`/`AnyFn` function-value
  combinator (`declareConstructor` + self-identity equivalence) — no
  structural data to arbitrary-generate.
- `PromiseSchema.test.ts`: `S.declare<Promise<unknown>>` identity declaration;
  `S.toArbitrary` throws `Unsupported AST Declaration` on this exact schema
  (verified against the schema's `S.declare` shape in `PromiseSchema.ts`); a
  native `Promise` has no meaningful round-trip law.
  `Transformations.test.ts`: meta-test of `destructiveTransform` using
  test-local illustrative schemas; lossy decode + passthrough encode, no
  round-trip law, no domain source schema. **Disposition: exception confirmed
  valid** — no action; these are exactly the residue class RC-SF's item 5
  ("SFV4 advisories → fix the underlying issue") anticipates staying as
  legitimate exceptions once genuinely irreducible.

## Files touched (not committed)

- `packages/foundation/modeling/schema/src/Csp/Csp.schema.ts` (fixed)
- `packages/foundation/modeling/schema/src/CauseTaggedError/CauseTaggedError.errors.ts` (fixed)
- `packages/foundation/modeling/schema/test/Csp.test.ts` (new)
- `packages/foundation/modeling/schema/test/CauseTaggedError.test.ts` (+1 test)
- All other experimental edits (`LiteralKit.schema.ts`, `VariantSchema.core.ts`,
  `Graph.encoded.ts`, `Graph.edge.ts`) were reverted; `git status --porcelain`
  confirms clean on all four.

## Commands run + outcomes

- `npx tsgo -b tsconfig.json` (repeated after every edit/revert): clean at
  baseline, clean after both fixes, clean final state.
- `bunx --bun vitest run` (repeated): 69 files/614 tests baseline → 70
  files/617 tests final (all green); 3 transient failures during the `union`
  attempt (reverted), 12 transient failures during the `extract` attempt
  (reverted) — both captured above as evidence, not left in the tree.
- `bunx turbo run build check test docgen --filter=@beep/schema`: `test`/
  `check`/`build` green for `@beep/schema`; `docgen` failed, but the failure
  (`SchemaError: Expected @beep/repo-utils/schemas/TSConfig/
  TSConfigCompilerOptionsShape, got TSConfigCompilerOptions({...})`) is inside
  `@beep/repo-utils`'s `TSConfig.ts`, which `git status` shows as
  concurrently modified (uncommitted) by another lane in this shared working
  tree — unrelated to any `@beep/schema` change in this report. Not caused by
  this lane; flagging for the driver rather than attempting a fix outside my
  package fence.
- No `standards/*.jsonc` file touched; no inventory regen; no commit.

## Summary (≤10 lines)

2 fixed (`CspDirectives`, `isExtras`) with byte-identical wire-snapshot proof
+ round-trip laws; package green (70 files/617 tests, `tsgo -b` clean). 2
confirmed unconvertible via reproduced regressions (`union`: 3 test breaks,
`.toTaggedUnion` guards need `instanceof` once members are classes, ~12
cross-package consumers; `extract`: 12 test breaks, it's the whole repo's
`Model.Class` mechanism, blocked:ripple). 22 generic-interface entries
unconvertible (R6 sub-family-1); diagnosed 4 precise, narrow reasons the
already-landed R6 detector fix still misses them (S.Codec/S.Union missing
from the pattern; R13's empty-body carve-out not wired into the generic
branch; one-level alias indirection unresolved; VariantSchema.Overridable
missing from the pattern) plus 4 residue (VariantSchema.core.ts's own
Class/Field/Struct/Union) as positive controls for the fix. 3 EntitySchema
type-literal entries are pure builder-DSL plumbing with no schema instance to
convert — fresh evidence, no carve-out exists yet. 6 test-file advisories
re-verified as legitimately irreducible. Docgen failure in
`turbo run --filter=@beep/schema` traced to an unrelated concurrent lane's
uncommitted `TSConfig.ts` change, not this lane.
