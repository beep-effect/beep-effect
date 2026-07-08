# SF-2 tail-a — foundation-modeling family (P4-wave2)

Lane: five packages, strictly sequential — `@beep/nlp`, `@beep/schema`,
`@beep/identity`, `@beep/md`, `@beep/utils`. Slices:
`goals/standards-remediation/ops/slices/P4-wave2/beep__{nlp,schema,identity,
md,utils}.json`. No `standards/*.jsonc` touched. No commits made.

## Summary of code changes (3 packages touched, 2 read-only)

| Package | Files changed |
|---|---|
| `@beep/nlp` | `src/Graph/Schema.ts`, `src/Ontology/Kind.ts` |
| `@beep/schema` | `src/Graph/Graph.edge.ts`, `src/Model/Model.variants.ts`, `src/VariantSchema/VariantSchema.overridable.ts` |
| `@beep/identity` | `src/Curie.ts`, `test/Curie.test.ts` |
| `@beep/md`, `@beep/utils` | none — all entries verified unconvertible in place |

## 1. `packages/foundation/modeling/nlp` (8 entries) — FIXED 8/8

| Symbol | Disposition | Evidence |
|---|---|---|
| `Graph/Schema.ts` `anonymous@313` (`EntityNode.span`) | **FIXED** | Extracted named `Span` class (`{ start: S.Finite, end: S.Finite }`); `EntityNode.span` field now references `Span` instead of an inline `S.Struct({...})`. |
| `Graph/Schema.ts` `anonymous@374`/`@375` (`DependencyNode.head`/`.dependent`) | **FIXED** | Extracted named `DependencyToken` class (`{ text: S.String, position: S.Finite }`); both fields now reference `DependencyToken`. |
| `Graph/Schema.ts` `anonymous@407`/`@410`/`@412`/`@415` (`RelationNode.subject`/`.object` + their nested `span`) | **FIXED** | Extracted named `RelationParticipant` class (`{ text: S.String, entityType: S.String, span: Span }`, reusing the new `Span` class), eliminating all 4 nested `S.Struct(...)` calls in one move. |
| `Ontology/Kind.ts` `TypedTextSchema` | **FIXED** | Applied the R10-cited "local-class technique": the generic factory now declares `class TypedTextSchemaClass extends S.Class<TypedTextSchemaClass>($I\`TypedTextSchema\`)({ kind, content: S.String, metadata: ... }) {}` inside the function body and returns the class, instead of `S.Struct({...}).pipe($I.annoteSchema(...))`. `makeTyped`'s `schema.make({...})` call sites are unaffected (same public shape). |

Verification: `npx tsgo -b tsconfig.json` (0 errors) · `npx vitest run` (10 files, 166/166 passed — the existing `Graph/Schema.test.ts` `S.toArbitrary`-based round-trip suite exercises every touched field shape unchanged, satisfying the §5.3 parity proof) · `turbo run docgen --filter=@beep/nlp` (succeeded, 299 examples) · `bunx biome check .` (clean).

## 2. `packages/foundation/modeling/schema` (5 entries) — FIXED 3/5

All 5 entries are named in `research/decisions.md` R15 point 3 ("Apply one-level local-alias resolution to extends-clause targets... covers 5: Edge, LiteralKit, MappedLiteralKit, Overrideable ×2"). I built a probe against the live `detectInterfaceReason` (`@beep/repo-cli/commands/Lint`) to empirically verify current detector behavior against each real declaration before touching anything.

| Symbol | Disposition | Evidence |
|---|---|---|
| `Graph/Graph.edge.ts` `Edge<Data>` | **FIXED** | Was `interface Edge<Data> extends EdgeTransform<Data> {}` (empty body, one hop through a sibling *interface*, not a type alias — `resolveLocalTypeAliasTypeNode` only resolves `TypeAliasDeclaration`, so the landed R15 alias-resolution helper does not fire here; probe-confirmed `exception` before edit). `EdgeTransform<Data>` itself is `extends S.decodeTo<EdgeFromSelf<S.toType<Data>>, EdgeEncodedSchema<Data>> { data; Rebuild: this }` and is already silent. Flattened `Edge` to extend `S.decodeTo<EdgeFromSelf<S.toType<Data>>, EdgeEncodedSchema<Data>>` directly (same target, same `data`/`Rebuild: this` own members copied down) — zero change to `Edge`'s resulting structural type, since `Edge` was already documented as "an alias of `EdgeTransform`." Probe-confirmed `silent` after edit. |
| `Model/Model.variants.ts` `Overrideable<S>` | **FIXED** | Was `extends Overridable<S> {}` (empty body, one hop through a local interface). The local `Overridable<S>` (no "e") already extends `VariantSchema.Overridable<S>` directly and is already silent. Flattened `Overrideable` to `extends VariantSchema.Overridable<S> {}` directly — identical resulting type (the intermediate `Overridable` contributed zero own members). Probe-confirmed `silent` after edit. |
| `VariantSchema/VariantSchema.overridable.ts` `Overrideable<S>` | **FIXED** | Same pattern: was `extends Overridable<S> {}`; the local `Overridable<S>` extends `S.Bottom<..., Overridable<S>, ...>` directly (14-arg instantiation). Flattened `Overrideable` to extend the identical `S.Bottom<...>` instantiation directly (same self-referential `Overridable<S>` type argument the original transitively resolved to). Probe-confirmed `silent` after edit. |
| `LiteralKit/LiteralKit.schema.ts` `LiteralKit<L, M>` | unconvertible | `extends LiteralKitBase<L, M>`, and `LiteralKitBase` **is** a type alias (`S.Literals<L> & {...8 helper members...}`), so the landed R15 alias-resolution helper *does* fire — but the resolved text (`S.Literals<L> & {...}`) doesn't match `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN` (no `declareConstructor`/`decodeTo`/`Bottom`/`Codec`/`Union`/`VariantSchema.Field`\|`Overridable` substring), and single-hop-only resolution (by design, R7 posture) doesn't follow `S.Literals` further. `LiteralKit` also carries 8 substantive own/inherited helper members (`Options`, `is`, `Enum`, `pickOptions`, `omitOptions`, `$match`, `thunk`, `toTaggedUnion`) beyond meta-only plumbing — this is a genuinely custom toolkit type, not a pure alias, so forcing it to match the schema-infra escape-hatch pattern would misrepresent its shape rather than resolve an underlying issue. Probe-confirmed `exception`, unchanged by the Edge/Overrideable fixes above. **Flagging for driver verdict-challenge**: R15's "covers 5" claim does not hold for this entry under the currently-landed detector code. |
| `MappedLiteralKit/MappedLiteralKit.schema.ts` `MappedLiteralKit<M>` | unconvertible | Same shape of finding: `extends MappedLiteralKitBase<M>` (`ForwardDirectionalKit<M> & { From, To, Pairs }`, itself resolving through `DirectionalKit<...>` — not a schema-infra base), plus its own `annotate(...)`/`Rebuild: MappedLiteralKit<M>` members. Genuinely custom mapped-literal toolkit type. **Same R15 verdict-challenge flag as `LiteralKit`.** |

Verification: `npx tsgo -b tsconfig.json` (0 errors) · `npx vitest run` (70 files, 617/617 passed) · `turbo run docgen --filter=@beep/schema` (succeeded, 929 examples) · `bunx biome check .` (clean after auto-format of the two multi-line `extends` clauses).

## 3. `packages/foundation/modeling/identity` (3 entries) — FIXED 2/3

| Symbol | Disposition | Evidence |
|---|---|---|
| `Curie.ts` `expand` (SFV4-null-return, line 167) | **FIXED** | Repo-wide grep found **zero external consumers** of `expand`/`contract` outside this package (only this file's own doc examples and its own test file) — the recorded exception reason ("preserves the existing... compatibility API") is stale, same pattern as R10's `CreateThreadAtomInput` finding. Exported the already-existing private `expandOption` helper (was already `O.Option`-returning, just unexported) with doc comments, and removed `expand`'s two `string \| undefined`-returning fallback overloads, leaving only the two literal-preserving overloads. The shared implementation now returns plain `string`, throwing only on the type-system-asserted-impossible case (`O.getOrElse(() => { throw new Error(...) })`) instead of silently returning `undefined`. |
| `Curie.ts` `contract` (SFV4-null-return, line 194) | **FIXED** | Identical fix, exporting `contractOption` and dropping `contract`'s `string \| undefined` fallback overloads. |
| `Id.ts` `IdentityComposer<Value, Authority, Prefix, Vocab>` | unconvertible | Real attempt made (temp probe file, reverted): tried assigning an `S.Class`-backed instance to the `IdentityComposer` type. `tsgo` immediately failed with `TS2740: Type 'IdentityComposerSchema' is missing the following properties from type 'IdentityComposer<...>': annote, annoteHttp, annoteKey, annoteSchema, and 6 more.` `IdentityComposer` has a callable template-tag call signature (`(strings: TemplateStringsArray, ...): IdentityString<...>`, `Id.ts:1088`) — its runtime value (`createComposer`) is a function with properties (`Object.defineProperties(createTemplateIdentity, {...})`). A schema-`Class` instance is a plain (non-callable) object; no Effect Schema combinator can produce a callable-function-shaped decoded value. Categorically the same class of finding as R14's "type parameters instantiated with function types... no schema can represent these." |

Test-file consumer sweep: `test/Curie.test.ts`'s two loop-based round-trip tests (which pass a widened `string`, not a literal, so they resolved to the now-removed fallback overloads) were updated to call `expandOption`/`contractOption` directly with explicit `O.isSome`/`O.getOrUndefined` unwraps — same assertions, same control flow, now Option-typed. The "preserves literal expansion types" test (uses the literal overload) is untouched.

Verification: `npx tsgo -b tsconfig.json` (0 errors) · `npx vitest run` (6 files, 58/58 passed) · `turbo run docgen --filter=@beep/identity` (succeeded, 158 examples) · `bunx biome check .` (clean).

## 4. `packages/foundation/modeling/md` (2 entries) — no code changes

| Symbol | Disposition | Evidence |
|---|---|---|
| `Md.render.ts` `PureRenderAdapter<Output>` | unconvertible | Real attempt made (reverted): split into `RenderAdapterDescriptor { name }` + `PureRenderAdapter { descriptor; render }` (the R11-4 "ExportedTool" descriptor/behavior-split pattern). `tsgo -b` immediately produced 5 errors in-package alone (`TS2741`/`TS2353` on `MarkdownAdapter`/`HtmlFragmentAdapter`/`PlainTextAdapter`/`renderEffectWith`/`renderWith`'s flat-literal usages) — before even touching `test/Md.test.ts` (4+ more flat-literal adapters) or `dtslint/Md.tst.ts` (asserts the exact flat shape via `expect(...).type.toBe<PureRenderAdapter<...>>()`). This is a deliberate, documented plugin-extension contract ("Future PDF and DOCX adapters can use this shape") validated by its own dtslint fixture — the split breaks the public contract, same verdict already accepted by the driver for the analogous `GraphOperation`/`OperationDefinition` entries (R14 point 3, deferred to a follow-up goal packet). |
| `Md.render.ts` `EffectRenderAdapter<Output, Error, Requirements>` | unconvertible | Same descriptor/behavior-split attempt and same immediate `TS2741` failure (`renderEffectWith`'s adapter param). Same verdict as `PureRenderAdapter`. |

Both entries are generic interfaces with no extends clause, so `classifyGenericInterface`'s only two outcomes (silent schema-infra escape hatch, or exception) apply — there is no "candidate"/member-composition path for generics (confirmed by reading `SchemaFirst.ts:1238-1259` directly), so a partial/mixed-signal fix is not available short of the contract-breaking split above.

Verification: `npx tsgo -b tsconfig.json` (0 errors, baseline — package has unrelated in-flight changes from a concurrent lane in `Md.behavior.ts`/`Md.model.ts` that I did not touch) · `npx vitest run` (1 file, 16/16 passed) · `turbo run docgen --filter=@beep/md` (succeeded, 176 examples) · `bunx biome check .` (clean). `git status --porcelain` on `Md.render.ts` confirmed clean (no diff) after the revert.

## 5. `packages/foundation/modeling/utils` (2 entries) — no code changes

| Symbol | Disposition | Evidence |
|---|---|---|
| `Event.ts` `makeEventSchema` | unconvertible | Real attempt made (reverted): applied the same local-class technique that fixed `TypedTextSchema` (nlp) — declared `class EventPayload extends S.Class<EventPayload>($I\`EventPayload\`)({ ...payload }, ...) {}` inside the factory body in place of the flagged `S.Struct({ ...payload })`. `tsgo -b` failed: `TS2509: Base constructor return type '...' is not an object type or intersection of object types with statically known members.` Root cause differs from `TypedTextSchema`: here the generic parameter is over the **fields dictionary itself** (`TFields extends S.Struct.Fields`, fully abstract key set), not over a single field's schema value (`S.Schema<K>`) — this is the exact "Missing Self generic" TS2509 blocker already ratified in R15's addendum for `packages/tooling/library/repo-utils/src/schemas/TSConfig.ts`'s `makeTypeStruct`/`makeEncodedStruct`/`strict` (independently reproduced by both `sf1-schema` and `sf1-repoutils`). This is now a **third independent reproduction** of the same root-cause TS limitation, in a different package. |
| `DrainableWorker.ts` `DrainableWorker<A>` | unconvertible | Real attempt made (reverted): tried `class DrainableWorkerSchema<A> extends S.Class<DrainableWorkerSchema<A>>(...)({ drain: S.declare(...), enqueue: S.declare(...) }) {}`. `tsgo -b` failed immediately: `TS2562: Base class expressions cannot reference class type parameters` (on both field lines) — a fundamental TS restriction independent of the schema-first mechanics. Independent of that error, `drain: Effect.Effect<void>` and `enqueue: (item: A) => Effect.Effect<void>` are both computation-valued (a pending signal / a callback), not decodable data; an `S.declare`-wrapped identity schema would satisfy `tsgo` but fail the §5.3 `S.toArbitrary` round-trip proof exactly as R15 already ruled for `PromiseSchema` ("`S.toArbitrary` throws `Unsupported AST Declaration`... a native Promise has no meaningful round-trip law") — the same argument applies verbatim to an `Effect.Effect` field. |

Verification: `npx tsgo -b tsconfig.json` (0 errors) · `npx vitest run` (13 files, 157/157 passed) · `turbo run docgen --filter=@beep/utils` (succeeded, 201 examples) · `bunx biome check .` (clean). `git status --porcelain` confirmed clean (no diff) for both probe attempts after revert.

## Verdict-challenge queue for the driver (D-C)

1. **R15 point 3's "covers 5" claim is only 3/5 accurate under the currently-landed `SchemaFirst.ts` code.** `Edge`, and both `Overrideable` entries are now fixed via in-package flattening (no detector change needed — I found a genuine code-level fix instead of relying on the detector). `LiteralKit` and `MappedLiteralKit` remain flagged: probe-verified (`detectInterfaceReason`, before and after edits) that (a) `LiteralKitBase`/`MappedLiteralKitBase` resolve (via the existing one-hop alias helper) to `S.Literals<L> & {...}` / `ForwardDirectionalKit<M> & {...}` text that does not match `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN`, and (b) both carry substantive custom helper members beyond meta-only plumbing, so forcing a pattern match would misrepresent their shape rather than fix anything. Recommend either revising the R15 record to 3/5, or a driver-owned decision on whether `LiteralKit`/`MappedLiteralKit` need a dedicated curated-exclusion entry (R14 mechanism) instead.
2. **Third independent reproduction of the "Missing Self generic" TS2509 blocker** (`Event.ts` `makeEventSchema`, joining `TSConfig.ts`'s `makeTypeStruct`/`makeEncodedStruct`/`strict` from the R15 addendum) — generic factories parameterized over an abstract `Fields extends S.Struct.Fields` (the dictionary itself, not a single field's schema) cannot construct an `S.Class` internally. Recommend adding `Event.ts` `makeEventSchema` to the same R15-addendum curated exclusion list, citing this reproduction.

Both are reported, not applied — fence 11 (detector changes never mix with code fixes) and fence 10 (lanes don't touch `packages/tooling/tool/cli/**`); `research/decisions.md` and `standards/*.jsonc` are driver-owned.

## Commands run (all outcomes green)

- `npx tsgo -b tsconfig.json` — clean in all 5 packages (3 with real edits, 2 baseline-only, re-verified after every revert).
- `npx vitest run` — `@beep/nlp` 166/166, `@beep/schema` 617/617, `@beep/identity` 58/58, `@beep/md` 16/16, `@beep/utils` 157/157.
- `turbo run docgen --filter=<pkg>` — succeeded for all 5 packages.
- `bunx biome check .` — clean in all 5 packages (2 files auto-formatted in `@beep/schema`, re-verified after).
- `git status --porcelain` — confirmed zero diff outside the listed changed files after each revert (`@beep/md`, `@beep/utils` probes; the deleted temp probe scripts at repo root and in `@beep/identity/src`).

No `standards/*.jsonc` file was read for writing, only for context (via `SPEC.md`/`research/decisions.md`). No commits made. No files outside the 5 assigned packages were edited.
