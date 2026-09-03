# Selective Schema Codec Statics Spec

## Status of This Contract

This is the ratified normative packet anchor. The `/grilling` frontier is empty
and the operator confirmed shared understanding on 2026-08-30. Locked decisions
are recorded in [`DECISIONS.md`](./DECISIONS.md); changes require a dated
amendment there.

## Objective

Replace broad `SchemaUtils` codec-static bundles with one type-safe selective
API that compiles only the requested schema helpers at module initialization,
migrate every existing repository use to its minimal observed helper set,
delete the broad helper variants, and establish a shrinking no-growth baseline
for legacy helpers and inline schema compilation. Full inline-compiler cleanup
and hard-error promotion belong to a mandatory successor goal created after a
fresh closing census.

## Locked Inputs

- Use Effect's public `Schema` APIs; do not implement, wrap, subclass, proxy, or
  emulate Effect Schema classes.
- Replace every existing bare `SchemaUtils.withCodecStatics` use and every
  `with<X>CodecStatics` use with an explicit minimal selector.
- Delete the broad helper variants after their call sites and generated sources
  are migrated; do not leave duplicate implementations behind.
- A schema using only `.is` must request only `"is"`.
- Preserve unrelated worktree changes and keep the migration mechanically
  reviewable.

## Selected API Contract

The selected schema API is:

```ts
const MyString = S.String.pipe(
  S.brand("MyString"),
  SchemaUtils.withCodecStatics(["decodeEffect", "is"])
)
```

- `withCodecStatics(keys)` accepts a readonly tuple of type-safe static names.
- Its return type exposes exactly the selected properties, preserving each
  Effect helper's native overloads and error/context types.
- Each selected runner is constructed once while the schema declaration is
  evaluated. For `S.decodeEffect`, this has the same steady-state compilation
  benefit as a module-scope `const decode = S.decodeEffect(schema)`; the two
  properties are distinct function objects but both avoid rebuilding the
  runner on each business-function call.
- Selection must be lazy by key: requesting one helper must not construct all
  helpers and then discard the unused ones.
- Static property installation is strict and deterministic: duplicate keys,
  pre-attached companion statics, and attempted overrides fail with a typed
  configuration error. Selected properties are non-enumerable, non-writable,
  and non-configurable.
- The selector creates a fresh owned schema with Effect's public
  `self.rebuild(self.ast)` before installation. It never mutates the supplied
  schema or implements private Schema machinery.
- The selector is dual: both `schema.pipe(withCodecStatics(keys))` and
  `withCodecStatics(schema, keys)` are supported by one implementation.
- A non-empty readonly tuple is mandatory. There is no zero-argument overload
  and an empty tuple is not an identity operation.

## Selected Class Contract

The safe class recommendation is a nested, frozen utility bag bound explicitly
to the finished class constructor:

```ts
export class MyClass extends S.Class<MyClass>($I`MyClass`)({}) {
  static readonly utils = SchemaUtils.classStatics(this, [
    "decodeEffect",
    "is",
  ])
}
```

Consumers may destructure the bag:

```ts
const { decodeEffect, is } = MyClass.utils
```

JavaScript does not give `classStatics(["decodeEffect", "is"])` enough
information to bind the declaring class. The packet therefore does not assume
that exact shorthand can be made safe. It also rejects custom class wrappers,
decorators, receiver-magic inheritance helpers, and static-block mutation as
default solutions.

## Selected JSON Boundary

JSON-string helper names such as `decodeUnknownJsonStringEffect` are not
recommended members of the general selector. They obscure whether a schema is
already the result of `S.fromJsonString` and make double wrapping possible.
Use a named JSON schema and select ordinary codec statics instead:

```ts
const MyStructJson = S.fromJsonString(MyStruct, jsonOptions).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownEffect"])
)
```

`AST.ParseOptions` remain ordinary per-invocation runner arguments. JSON
reviver, replacer, and spacing options belong to construction of the named
`S.fromJsonString` schema. The package exports a compact named
`UnknownFromJsonString`. Fixed pretty or custom variants stay as local named
schemas beside their consumers; this goal does not add a public dynamic factory
or cache.

## Migration Scope

### In scope

- `packages/foundation/modeling/schema/src/SchemaUtils/**`, its exports, type
  tests, runtime tests, and public documentation.
- All source, test, fixture, example, generated-source template, application,
  tooling, and package call sites that use:
  - bare `SchemaUtils.withCodecStatics`;
  - `withSyncCodecStatics`;
  - `withPromiseCodecStatics`;
  - `withEffectCodecStatics`;
  - `withExitCodecStatics`;
  - `withOptionCodecStatics`;
  - `withResultCodecStatics`.
- Property-use analysis for every migrated schema so the selector contains the
  smallest helper set demonstrably consumed in the repository.
- Call sites whose helper object is re-exported or passed through another
  abstraction; these require explicit public-surface analysis rather than a
  textual nearest-file guess.
- A goal-local typechecker-backed inventory, reviewed minimal-key mapping, and
  disposable codemod used to make the migration reproducible.
- Per-schema generator override maps that default to no attached statics.
- A shrinking legacy baseline and no-growth gate for family PRs.
- Inline-compiler findings in touched code and the known `ProvRdf.ts` finding.
- A fresh closing census and a mandatory successor-goal requirement for full
  inline-compiler cleanup and hard-error promotion.

### Out of scope

- Any private implementation of Effect Schema classes or Schema AST nodes.
- A new general-purpose class decorator, proxy, mixin, or schema subclass.
- Unrelated Schema API redesigns.
- Dynamic JSON codec caching unless a real migrated consumer requires it and a
  later grilled decision admits it.
- Compatibility aliases whose only purpose is to preserve the deleted broad
  helpers indefinitely.
- Migration of the existing 253-class manual-static fleet beyond one `S.Class`
  and one `S.TaggedClass` pilot.
- Repository-wide inline-compiler cleanup or promotion of
  `beep(no-inline-schema-compile)` to an error in this goal.

## Required Static Catalog

The implementation derives its key union and exact result mapping from one
typed registry. It contains exactly:

- `decodeEffect`, `decodeUnknownEffect`, `encodeEffect`,
  `encodeUnknownEffect`;
- `decodeExit`, `decodeUnknownExit`, `encodeExit`, `encodeUnknownExit`;
- `decodeOption`, `decodeUnknownOption`, `encodeOption`,
  `encodeUnknownOption`;
- `decodePromise`, `decodeUnknownPromise`, `encodePromise`,
  `encodeUnknownPromise`;
- `decodeResult`, `decodeUnknownResult`, `encodeResult`,
  `encodeUnknownResult`;
- `decodeSync`, `decodeUnknownSync`, `encodeSync`, `encodeUnknownSync`;
- `is`, `asserts`, the existing dual `equivalence`, and `toArbitrary`.

Names exactly match Effect. Legacy `fromUnknown`, the legacy unknown-input
`decodeOption` meaning, all JSON-suffixed names, and `toStandardSchemaV1` are
excluded. Each selected entry is constructed once at schema declaration; no
unselected factory is invoked.

## Migration Rules

1. Build a typechecker-backed authoritative inventory before consumer edits:
   helper, owning schema, attached properties actually read, explicit public
   contract, re-export status, and JSON/class risks.
2. Implement and test the selector before changing consumers.
3. Migrate generated sources at their generator first, then regenerate.
4. Replace each use with its minimal selected tuple. Do not translate a broad
   group mechanically into every member of that group.
5. Preserve public behavior and Effect-native function signatures.
6. Delete the six broad group implementations, the old bare behavior, their
   exports, tests, docs, and stale examples in the same campaign.
7. Treat the old every-runner `Unknown` surface as intentionally retired.
8. Prove a second inventory pass finds no stale helper names or zero-argument
   calls in executable/documented source.
9. Fix inline compiler calls in touched code and the known `ProvRdf.ts` site,
   reject warning growth, and record the fresh closing census for the mandatory
   successor goal.

## Safety Constraints

- Do not construct every possible static to implement selection.
- Do not silently overwrite an existing property with a different value.
- Do not hide a double `S.fromJsonString` transform behind a convenience name.
- Do not erase generic context/error requirements from Effect helpers.
- Do not infer minimal public API solely from same-file property reads when a
  schema is exported.
- Do not attach statics to Effect's shared primitive singleton schemas unless
  the final ownership decision explicitly permits and tests that mutation.
- Do not change public `withStatics` behavior. Its internal installer may be
  shared, but only the selected codec path uses owned strict mode.

## Acceptance Criteria

- [x] `/grilling` has no open frontier and the operator explicitly confirmed
      shared understanding on 2026-08-30.
- [x] One `withCodecStatics(keys)` implementation attaches exactly the selected
      statics and constructs no unselected runners.
- [x] The selected return type is exact and retains native Effect signatures.
- [x] Duplicate keys, pre-attached statics, and attempted overrides fail closed;
      selected descriptors are immutable and non-enumerable.
- [x] The chosen class utility form works on real `S.Class` declarations
      without a custom Schema class implementation.
- [x] JSON construction options and per-call parse options have distinct,
      tested ownership; double wrapping is not exposed as an ergonomic path.
- [x] Every existing broad-helper call site is migrated using an audited
      minimal key set, including exported schemas and generators.
- [x] The reviewed inventory and disposable codemod are retained as goal-local
      evidence; generators default to no statics with explicit override maps.
- [x] The old bare behavior and all six `with<X>CodecStatics` variants are
      deleted from implementation, exports, tests, docs, and live consumers.
- [x] Direct selected runners are constructed once per schema declaration and
      a regression test distinguishes declaration-time construction from
      per-call construction.
- [x] Touched inline-compiler findings and `ProvRdf.ts` are fixed; the shrinking
      baseline rejects helper or warning growth.
- [x] A fresh closing census is recorded and requires a successor goal for
      full cleanup and hard-error promotion.
- [ ] `@beep/schema` package verification, focused tests, docgen, and the
      canonical Yeet lane are green.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/schema-utils-selective-codec-statics/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/schema-utils-selective-codec-statics/ops/manifest.json` | Passes |
| Packet integrity | `bun run beep goals doctor` | No introduced packet error |
| Portfolio projection | `bun run beep goals index --write && bun run beep goals index --check` | Passes; index remains untracked |
| Broad helper removal | targeted `rg` census from `research/SOURCES.md` | Zero live definitions, exports, or uses |
| Selector behavior | focused `@beep/schema` runtime and dtslint tests | Exact keys, signatures, collisions, and construction timing pass |
| Package proof | `bun run beep quality package-verify @beep/schema` | Green |
| Lint ratchet | goal-local baseline check and repository census | No growth; touched and known finding clean |
| Repository proof | `bun run beep yeet verify` | Green or unrelated failures attributed |
| Hosted completion | `bun run beep yeet monitor` | `merge-ready: yes` |

## Stop Conditions

- A migrated exported schema's minimal public helper set cannot be established
  from repository evidence.
- Safe class binding would require a custom Schema implementation or mutation
  of Effect internals.
- JSON option ownership cannot be represented without rebuilding a codec on
  each call.
- Required source files are missing or materially contradictory.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
