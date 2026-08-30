# Selective Schema Codec Statics Spec

## Status of This Contract

This is the normative packet anchor, but its explicitly marked open branches
remain provisional until the `/grilling` frontier is empty and the operator
confirms shared understanding. Locked decisions are recorded in
[`DECISIONS.md`](./DECISIONS.md).

## Objective

Replace broad `SchemaUtils` codec-static bundles with one type-safe selective
API that compiles only the requested schema helpers at module initialization,
migrate every existing repository use to its minimal observed helper set,
delete the broad helper variants, and make inline schema compilation a hard
lint error once the repository is clean.

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

## Proposed API Direction

The following design is recommended by the initial review and is subject to the
remaining decision frontier:

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
- Static property installation is strict and deterministic: duplicate keys are
  deduplicated, incompatible existing keys fail closed, and installed
  properties are read-only and non-enumerable unless the grill decides
  otherwise.
- No zero-argument compatibility overload is recommended. Explicit selection
  is the mechanism that prevents broad attachment from returning.

## Proposed Class Direction

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

## Proposed JSON Boundary

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
`S.fromJsonString` schema. Dynamic construction-time options require an
explicit factory or cache outside the general static selector.

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
- The `beep(no-inline-schema-compile)` rule, including the current
  `ProvRdf.ts` violation, after migration proves the repository can sustain an
  error-level rule.

### Out of scope

- Any private implementation of Effect Schema classes or Schema AST nodes.
- A new general-purpose class decorator, proxy, mixin, or schema subclass.
- Unrelated Schema API redesigns.
- Dynamic JSON codec caching unless a real migrated consumer requires it and a
  later grilled decision admits it.
- Compatibility aliases whose only purpose is to preserve the deleted broad
  helpers indefinitely.

## Required Static Families

The implementation must derive its key union and result mapping from a single
typed registry. The final registry is not locked until the grill resolves the
surface question, but candidate families include:

- guards and assertions: `is`, `asserts` or `assert`;
- decode/encode runners: sync, option, result, exit, promise, and effect forms,
  including unknown-input forms where Effect exposes distinct helpers;
- schema-derived values: `equivalence`, `toArbitrary`;
- standards adapters only if their lifecycle and construction semantics match
  codec runners.

Each registry entry must state whether it is constructed eagerly at schema
declaration time, internally memoized by Effect, or intentionally omitted.

## Migration Rules

1. Build an authoritative inventory before edits: helper, owning schema,
   attached properties actually read, re-export status, and JSON/class risks.
2. Implement and test the selector before changing consumers.
3. Migrate generated sources at their generator first, then regenerate.
4. Replace each use with its minimal selected tuple. Do not translate a broad
   group mechanically into every member of that group.
5. Preserve public behavior and Effect-native function signatures.
6. Delete the six broad group implementations, the old bare behavior, their
   exports, tests, docs, and stale examples in the same campaign.
7. Prove a second inventory pass finds no stale helper names or zero-argument
   calls in executable/documented source.
8. Hoist remaining inline compiler calls, including the known `ProvRdf.ts`
   site, then promote `beep(no-inline-schema-compile)` from warning to error.

## Safety Constraints

- Do not construct every possible static to implement selection.
- Do not silently overwrite an existing property with a different value.
- Do not hide a double `S.fromJsonString` transform behind a convenience name.
- Do not erase generic context/error requirements from Effect helpers.
- Do not infer minimal public API solely from same-file property reads when a
  schema is exported.
- Do not attach statics to Effect's shared primitive singleton schemas unless
  the final ownership decision explicitly permits and tests that mutation.
- Do not start implementation before the operator confirms the completed
  decision tree.

## Acceptance Criteria

- [ ] `/grilling` has no open frontier and the operator has explicitly
      confirmed shared understanding.
- [ ] One `withCodecStatics(keys)` implementation attaches exactly the selected
      statics and constructs no unselected runners.
- [ ] The selected return type is exact and retains native Effect signatures.
- [ ] The chosen class utility form works on real `S.Class` declarations
      without a custom Schema class implementation.
- [ ] JSON construction options and per-call parse options have distinct,
      tested ownership; double wrapping is not exposed as an ergonomic path.
- [ ] Every existing broad-helper call site is migrated using an audited
      minimal key set, including exported schemas and generators.
- [ ] The old bare behavior and all six `with<X>CodecStatics` variants are
      deleted from implementation, exports, tests, docs, and live consumers.
- [ ] Direct selected runners are constructed once per schema declaration and
      a regression test distinguishes declaration-time construction from
      per-call construction.
- [ ] `beep(no-inline-schema-compile)` is error-level and its repository scope
      is clean, including `packages/foundation/modeling/rdf/src/ProvRdf.ts`.
- [ ] `@beep/schema` package verification, focused tests, docgen, and the
      canonical Yeet lane are green.
- [ ] No unrelated refactors or formatting churn.

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
| Lint ratchet | policy-pack rule tests and repository lint | Inline compile rule is error-level and clean |
| Repository proof | `bun run beep yeet verify` | Green or unrelated failures attributed |
| Hosted completion | `bun run beep yeet monitor` | `merge-ready: yes` |

## Stop Conditions

- The grill reveals a public compatibility promise that conflicts with deleting
  the broad helpers and the operator has not selected a migration policy.
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

