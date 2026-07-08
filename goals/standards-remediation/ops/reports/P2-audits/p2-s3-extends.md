# P2 audit — S3-extends (exported interfaces with `extends` clauses)

Cluster: 55 `standards/schema-first.inventory.jsonc` exception entries whose
`reason` matches `Derived interface with extends clauses is tracked as an
exception.` (54 entries) or the BM25-specific variant (1 entry). Full census
extracted programmatically (`node -e "... .entries.filter(reason includes
'extends')"`); grep line numbers cross-checked against the file.

## Root cause (driver-verified, code-read)

`detectInterfaceReason` in
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:755-766`:

```ts
const detectInterfaceReason = (node): O.Option<string> => {
  if (node.getTypeParameters().length > 0) { ... }
  if (node.getExtends().length > 0) {
    return O.some("Derived interface with extends clauses is tracked as an exception.");
  }
  if (typeLiteralMembersUnsafe(node.getMembers())) {
    return O.some("Interface contains non-schema signals such as function members or runtime handles.");
  }
  return O.none();
};
```

The extends-branch is an unconditional early return: **any** interface with an
`extends` clause is flagged, regardless of (a) whether the extends target is
external/framework code the repo doesn't own, or (b) whether the interface's
own+inherited members are actually unsafe (function members, `Effect.Effect<`,
etc. — the exact check `typeLiteralMembersUnsafe` already runs for *non*-extends
interfaces, one branch below, but is never reached here). This is why the
inventory shows one generic reason string for 55 structurally very different
interfaces, and why one entry (`BM25VectorizerWithBowInstance`) already carries
a hand-written custom `reason` that says exactly what the corrected detector
should be concluding programmatically for the whole cluster.

Read every one of the 55 files/symbols (not just the 12-entry slice sample).
Full breakdown:

| Sub-class | Count | Extends target (direct, unresolved) |
|---|---|---|
| React/DOM/third-party framework Props | 38 | `React.ComponentProps<...>` / `Omit<React.ComponentProps<...>>`, `d3.SimulationNodeDatum`/`SimulationLinkDatum`, `frimousse`'s `EmojiPickerRootProps`, `@base-ui/react`'s `RadioGroupPrimitive.Props` |
| Repo-local Props alias (extends a repo-local Props interface that is itself framework-rooted) | 2 | `UploadBoxProps` (upload.tsx, same file) |
| Service-contract / port interfaces (function-member-dominant) | 7 | `DuckDbClient`, `G.RunpodOperationsShape<E>`, `WorkItemClientTransport`, `AcpProtocol.AcpProtocolLoggingOptions` (×3: Agent/Client/PatchedProtocol options), `BM25VectorizerInstance` |
| Schema-meta "named generic instantiation" idiom (`@beep/schema` internal) | 8 | `VariantSchema.Field<{...}>` (×7), `S.decodeTo<...>` (×1, `Date`) |

38 + 2 + 7 + 8 = 55. See full per-file table at the end.

## Sub-class (a) — extends external framework/third-party types (40 entries: 38 direct + 2 repo-local-alias)

**Verified by direct read of every file.** Examples:

- `packages/foundation/ui-system/form/src/components/Form.tsx:33` —
  `FormProps extends React.ComponentProps<"form">`
- `packages/foundation/ui-system/form/src/fields/TextField.tsx:33` —
  `TextFieldProps extends Omit<React.ComponentProps<typeof Input>, ...>`
  (all 26 `form/src/fields/*.tsx` entries follow this exact shape — each
  extends `React.ComponentProps<typeof <ShadcnPrimitive>>`, always via `Omit`)
- `packages/foundation/ui-system/ui/src/components/knowledge-graph.tsx:30,59` —
  `GraphNode extends d3.SimulationNodeDatum`, `GraphLink extends
  d3.SimulationLinkDatum<GraphNode>` (`d3` is `node_modules`)
- `packages/foundation/ui-system/ui/src/components/emoji-picker.tsx:39-40` —
  `EmojiPickerProps extends Omit<EmojiPickerRootProps, ...>` where
  `EmojiPickerRootProps` is imported `from "frimousse"` (third-party)
- `packages/foundation/ui-system/ui/src/components/rating.tsx:35-36` —
  `RatingProps extends Omit<RadioGroupPrimitive.Props, ...>` where
  `RadioGroupPrimitive` is `@base-ui/react/radio-group` (third-party)
- `packages/foundation/ui-system/ui/src/components/upload.tsx:91-92` —
  `UploadBoxProps extends Omit<React.ComponentProps<"div">, ...>` (external,
  direct), then `:523` `UploadProps extends UploadBoxProps {}` and `:573`
  `UploadAvatarProps extends Omit<UploadBoxProps, "multiple"> {}` — both
  extend the **repo-local** `UploadBoxProps`, one hop removed from React.

**Disposition: unconvertible, detector-ruling.** Converting any of these to
`S.Class` would (1) break JSX spread ergonomics — these are compile-time-only
prop-typing surfaces consumed by `<Component {...props} />`, never
decoded/encoded/serialized; (2) require schema-encoding function-typed props
(`onValueChange`, `onBlur`, `children: (props) => ReactNode`, etc.) which
`Schema` has no legitimate encode/decode semantics for; (3) add zero runtime
validation since nothing externally decodes a React prop bag. This matches the
mission's hypothesis (a) exactly.

**Precise detector ruling to spec** (driver to verify and implement; not
touched by this lane):

Replace the unconditional extends-early-return with a check that resolves the
first `extends` clause's type reference symbol and skips emitting when that
symbol's declaration source file is outside the workspace source roots (i.e.
under `node_modules`, or the TS lib/DOM ambient declarations) — a single-hop
check only (no transitive resolution). Concretely, in
`detectInterfaceReason`, before returning the extends-clause reason: for each
`node.getExtends()` clause, get `.getExpression().getSymbol()?.getDeclarations()`
and check `declaration.getSourceFile().isInNodeModules()` (ts-morph API) or
path-prefix-test against the repo's tracked source roots
(`apps/**`,`packages/**`,`infra/**`). If **every** extends clause resolves
external, skip (return `O.none()` or fall through to `typeLiteralMembersUnsafe`
as normal). If **any** extends clause resolves repo-local, keep firing (do not
resolve transitively — `UploadProps`/`UploadAvatarProps` must keep firing via
this rule, which matches what's already true of them structurally: their own
composed members include function-typed callbacks inherited from
`UploadBoxProps`, so they'd also independently fail `typeLiteralMembersUnsafe`
once that check runs on the resolved member set — see fixture spec below).

**Fixture spec:** add two fixture interfaces to the SchemaFirst detector test
suite:
- *still-fires case*: an interface `extends` a repo-local interface with
  function members (e.g. a `Repro extends LocalPortShape {}` fixture) — must
  still appear in the inventory (via the reworked "non-schema signals" path,
  not the retired "extends clauses" path).
- *newly-excluded case*: an interface `extends React.ComponentProps<"div">`
  (or a same-shape `d3`/third-party stand-in fixture with no `node_modules`
  dependency, e.g. a fixture `.d.ts` under a synthetic `external-lib` stand-in
  recognized as outside source roots) — must produce zero findings.

## Sub-class (b) — extends repo-local types: real conversion attempts (3 performed, all failed as expected)

Per RC-SF ("attempt the conversion anyway ... if it cannot preserve the public
contract, report unconvertible with the failed-attempt diff"), I made and
compiled three real in-tree attempts (edited, ran `npx tsgo -b tsconfig.json
--force` inside the owning package, captured output, then `git checkout --
<file>` — all three files confirmed clean via `git status --short` afterward,
no leftover diffs).

### Attempt 1 — `DuckDbShape` (`packages/drivers/duckdb/src/DuckDb.service.ts:165`)

`export interface DuckDbShape extends DuckDbClient {}` where `DuckDbClient`
(`:78-134`) is 100% `Effect.Effect<...>`-returning methods (`query`, `run`,
`runMany`, `withTransaction`, `copyTableToParquet`). Converted to:

```ts
export class DuckDbShape extends S.Class<DuckDbShape>($I`DuckDbShape`)({
  copyTableToParquet: S.declare((input: unknown): input is DuckDbClient["copyTableToParquet"] => typeof input === "function"),
  query: S.declare(...), run: S.declare(...), runMany: S.declare(...), withTransaction: S.declare(...),
}) {}
```

Result: **compiles clean** (`tsgo -b --force` exit 0, zero diagnostics). But
this is a hollow conversion — every field is an `S.declare` wrapping a bare
`typeof input === "function"` predicate; there is no real decode/encode, no
serialization, and the mandatory SPEC §5.3 parity proof ("byte-identical
encoded/wire snapshot + one `S.toArbitrary` round-trip law per absorbed
invariant") is **unsatisfiable** — you cannot byte-snapshot-encode an
`Effect`-returning function, and `S.toArbitrary` cannot generate a meaningful
arbitrary function that queries a real database. The fact that it typechecks
is itself the evidence that "compiles" is not sufficient proof of a valid
schema-first conversion — exactly why the existing (non-extends)
`typeLiteralMembersUnsafe` branch already exists to catch function-member
interfaces on its own terms, correctly, without a class wrapper.

**Disposition: unconvertible** (fence 1, service-contract carve-out — no
locked ruling suspends fence 1 for this file). Fold into the "non-schema
signals" reason once the detector fix lands; no standing exception language
change needed beyond that.

### Attempt 2 — `DateTimeInsert` (`packages/foundation/modeling/schema/src/Model/Model.datetime.ts:133-138,159`)

`export interface DateTimeInsert extends VariantSchema.Field<{ select: ...;
insert: Overridable<...>; json: ... }> {}` then `export const DateTimeInsert:
DateTimeInsert = Field({...})`. This is the exact pattern effect's own core
`Schema.ts` uses at scale (verified: `.repos/effect-v4/packages/effect/src/Schema.ts`
has 25+ instances of `export interface X extends Y<...> {}` for naming
generic-instantiation types, e.g. `:2960 String extends Bottom<string,...>`,
`:909 Optic<T,Iso> extends Schema<T>`) — a named nominal alias so a value and
its (otherwise anonymous, deeply-generic) type can share one identifier.

Attempt: deleted the `interface` declaration and the `: DateTimeInsert` type
annotation, leaving `export const DateTimeInsert = Field({...})` with its type
inferred. Result: **package still compiles** (`tsgo -b --force` exit 0) — so
this isn't a hard compile-time requirement in isolation. But it breaks the
dual type+value binding the package (and its own JSDoc `@example`) documents
and relies on: a scratch probe doing exactly what the file's own `@example`
does —

```ts
import * as Model from "./Model/index.ts";
const field: Model.DateTimeInsert = Model.DateTimeInsert;
```

fails with **`TS2749: 'Model.DateTimeInsert' refers to a value, but is being
used as a type here. Did you mean 'typeof Model.DateTimeInsert'?`** —
a real, compiler-verified contract break. Separately, checking the emitted
`.d.ts` (`dist/Model/Model.datetime.d.ts`) confirms the un-named form inlines
the full generic expansion (`export declare const DateTimeInsert:
VariantSchema.Field<{ readonly select: ...; ... }>;`) instead of a clean named
type — worse DX, same root problem.

**Disposition: unconvertible** — this is not a data model to convert, it's
schema-authoring infrastructure (the field's own properties are themselves
Schema values, e.g. `select: S.DateTimeUtcFromString`, not decoded data), using
the same idiom Effect's own `Schema.ts` uses to let a schema-producing const
be referenced by name as a type. Applies identically to the other 7 entries in
this row (`DateTimeInsertFromDate/FromNumber`, `DateTimeUpdate` ×3,
`BooleanSqlite`, and `Date` which extends `S.decodeTo<...>` directly).

### Attempt 3 — `AcpAgentOptions` (`packages/drivers/acp/src/AcpAgent.service.ts:42-44`)

`export interface AcpAgentOptions extends AcpProtocol.AcpProtocolLoggingOptions
{ readonly logger?: (event) => Effect.Effect<void>; }`. Notably the base,
`AcpProtocolLoggingOptions`, is **already** an `S.Class`
(`AcpProtocol.service.ts:267-279`) — so this is a hybrid: a schema-first base
extended with one added function-typed field. Attempted the mission's
suggested mechanism, `S.extend`:

```ts
export class AcpAgentOptions extends S.extend(
  AcpProtocol.AcpProtocolLoggingOptions,
  S.Struct({ logger: S.optionalKey(S.declare((i): i is ... => typeof i === "function")) })
)<AcpAgentOptions>($I`AcpAgentOptions`) {}
```

Result: **`TS2551: Property 'extend' does not exist on type ... Did you mean
'extendTo'?`** — `S.extend` does not exist in effect v4 (verified against
`.repos/effect-v4/packages/effect/src/Schema.ts:3565`); `extendTo` is a
different combinator entirely — it adds *derived* fields computed from the
already-decoded struct via an `Option`-returning function, not a struct/class
mixin. This is a training-data v3 prior, exactly the class of error the SPEC's
"Verified API Corrections" table warns about. Even a corrected attempt (manual
field-spread instead of `S.extend`) only arrives back at the same hollow
`S.declare`-wrapped-function problem as Attempt 1 — `logger` has no
decode/encode semantics worth adding.

**Disposition: unconvertible.** Applies identically to `AcpClientOptions`
(`AcpClient.service.ts:62-64`, same shape) and `AcpPatchedProtocolOptions`
(`AcpProtocol.service.ts:364-370`, same base + 4 function-typed fields).

### Service-contract entries not separately re-attempted (same conclusion as Attempt 1/3, by inspection)

- `RunpodShape` (`Runpod.service.ts:186-188`) extends `G.RunpodOperationsShape<RunpodError>`
  (a generated interface, 100% `Effect.Effect`-returning operations) plus one
  more `raw` method of the same shape.
- `WorkItemClientShape` (`WorkItem.client.ts:142`) extends
  `WorkItemClientTransport` (`:78-99`, 7 methods, 100%
  `Effect.Effect<DomainWorkItem.WorkItem, WorkItemActionError>`-returning).
  **Not edited for a live compile check** — this file is flagged
  `packages/architecture-lab/client/CLAUDE.md`: "PROOF ORACLE ... `beep
  architecture` generation replays this tree byte-for-byte" — too risky to
  touch even transiently; disposition follows by direct inspection using the
  identical mechanical argument as `DuckDbShape`.
- `BM25VectorizerWithBowInstance` (`packages/drivers/wink/src/internal/bm25.ts:19-21`)
  extends `BM25VectorizerInstance` (`:10-17`, `doc`/`learn`/`out`/`vectorOf`
  methods modeling the third-party `wink-nlp` BM25 vectorizer's runtime
  object). **This entry's inventory `reason` is already hand-written and
  already states the correct conclusion** ("... extends runtime methods and
  accessors; it is not a serializable data model") — direct textual
  confirmation of this whole sub-class's disposition from whoever authored
  the original exception.

All 7 service-contract entries: **disposition unconvertible, fence 1
(service-contract/interface carve-out) applies as-is** — no new detector
ruling needed beyond the same root-cause fix in sub-class (a)/(b): once
`detectInterfaceReason` resolves inherited members instead of short-circuiting
on `extends`, these naturally re-classify under the existing (correct)
"Interface contains non-schema signals such as function members or runtime
handles" reason — same standing exception, accurate reason text, zero new
carve-out language required.

## Full per-entry disposition table (55/55)

| File | Symbol | Sub-class | Disposition |
|---|---|---|---|
| architecture-lab/client/.../WorkItem.client.ts | WorkItemClientShape | service-contract | unconvertible (fence 1) |
| drivers/acp/src/AcpAgent.service.ts | AcpAgentOptions | hybrid schema-base+fn-field | unconvertible (Attempt 3) |
| drivers/acp/src/AcpClient.service.ts | AcpClientOptions | hybrid schema-base+fn-field | unconvertible (same as Attempt 3) |
| drivers/acp/src/AcpProtocol.service.ts | AcpPatchedProtocolOptions | hybrid schema-base+fn-field | unconvertible (same as Attempt 3) |
| drivers/duckdb/src/DuckDb.service.ts | DuckDbShape | service-contract | unconvertible (Attempt 1) |
| drivers/runpod/src/Runpod.service.ts | RunpodShape | service-contract | unconvertible (same as Attempt 1) |
| drivers/wink/src/internal/bm25.ts | BM25VectorizerWithBowInstance | service-contract (3rd-party adapter) | unconvertible (author's own reason confirms) |
| foundation/modeling/schema/.../Model.datetime.ts | Date | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/modeling/schema/.../Model.datetime.ts | DateTimeInsert | schema-meta idiom | unconvertible (Attempt 2) |
| foundation/modeling/schema/.../Model.datetime.ts | DateTimeInsertFromDate | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/modeling/schema/.../Model.datetime.ts | DateTimeInsertFromNumber | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/modeling/schema/.../Model.datetime.ts | DateTimeUpdate | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/modeling/schema/.../Model.datetime.ts | DateTimeUpdateFromDate | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/modeling/schema/.../Model.datetime.ts | DateTimeUpdateFromNumber | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/modeling/schema/.../Model.sqlite.ts | BooleanSqlite | schema-meta idiom | unconvertible (Attempt 2 family) |
| foundation/ui-system/form/.../Form.tsx | FormProps | extends-external (React) | detector-ruling |
| foundation/ui-system/form/.../SubmitButton.tsx | SubmitButtonProps | extends-external (React) | detector-ruling |
| foundation/ui-system/form/fields/*.tsx (26 files) | `<Name>FieldProps` | extends-external (React) | detector-ruling |
| foundation/ui-system/ui/.../color-picker.tsx | ColorPickerProps | extends-external (React) | detector-ruling |
| foundation/ui-system/ui/.../country-select.tsx | CountryOptionContentProps, CountrySelectProps | extends-external (React) | detector-ruling |
| foundation/ui-system/ui/.../emoji-picker.tsx | EmojiPickerProps | extends-external (frimousse) | detector-ruling |
| foundation/ui-system/ui/.../knowledge-graph.tsx | GraphNode, GraphLink | extends-external (d3) | detector-ruling |
| foundation/ui-system/ui/.../orb-background.tsx | OrbBackgroundProps | extends-external (React) | detector-ruling |
| foundation/ui-system/ui/.../phone-input.tsx | PhoneInputProps | extends-external (React) | detector-ruling |
| foundation/ui-system/ui/.../rating.tsx | RatingProps | extends-external (@base-ui/react) | detector-ruling |
| foundation/ui-system/ui/.../upload.tsx | UploadBoxProps | extends-external (React) | detector-ruling |
| foundation/ui-system/ui/.../upload.tsx | UploadProps, UploadAvatarProps | repo-local Props alias (still fires) | unconvertible (function-member inherited) |

(26 form-field files: AutocompleteField, CheckboxField, ColorField,
ComboboxField, CountryField, DateField, DateTimeField, EmojiField,
MultiSelectField, NativeSelectField, NumberField, OTPField, PhoneField,
RadioGroupField, RatingField, SelectField, SliderField, SwitchField,
TextField, TextareaField, TimeField, ToggleField, ToggleGroupField,
UploadAvatarField, UploadBoxField, UploadField — each individually verified by
`grep -n "^export interface" -A3` against the file.)

## Files touched (all reverted, `git status --short` clean for each)

- `packages/drivers/duckdb/src/DuckDb.service.ts` (Attempt 1, reverted)
- `packages/foundation/modeling/schema/src/Model/Model.datetime.ts` (Attempt 2, reverted)
- `packages/drivers/acp/src/AcpAgent.service.ts` (Attempt 3, reverted)

No `standards/*.jsonc`, no repo-wide commands, no commits. Compile checks used
package-scoped `npx tsgo -b tsconfig.json [--force]` inside each owning
package directory only.
