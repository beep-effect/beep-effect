# Crispening reference

Two parts: **A. the toolkit** (what to reach for, with real signatures + the noise it
kills + a live usage site), and **B. the moves** (before→after transforms distilled from
the `@beep/md` / `@beep/lexical-schema` crispening). Import combinators as a namespace:
`import { LiteralKit, MappedLiteralKit, SchemaUtils } from "@beep/schema"`. Line anchors
are current-as-written; trust the *symbol*, re-`rg` if a number drifted.

---

## Part A — the crispening toolkit

Source: `packages/foundation/modeling/schema/src/{SchemaUtils,LiteralKit,MappedLiteralKit}/` and upstream `effect/Schema`.

### Defaults — kill `*Defaults` spreads and per-call boilerplate

| Symbol | Signature (abridged) | Kills | Live site |
|--------|----------------------|-------|-----------|
| `SchemaUtils.withNoneDefault` | `(self: Sch & { "~type.make.in": O.Option<A> }) => withConstructorDefault<Sch>` | explicit `O.none()` at every `make` call | `Lexical.model.ts:688,766,781,788` |
| `SchemaUtils.withConstantDefault` | `<const A>(v: A) => (self: Sch & { "~type.make.in": A }) => withConstructorDefault<Sch>` | `version: 1` / `format: ""` at construction (wire stays required) | `Lexical.model.ts:681,772,776` |
| `SchemaUtils.withKeyDefaults` | `dual` `(self, v) => withDecodingDefaultKey<withConstructorDefault<Sch>>` | double-wiring a default for **both** make and decode | `SchemaUtils/withKeyDefaults.ts:50` |
| `SchemaUtils.withEmptyArrayDefaults` | `(self) => …` default `A.empty<T>()` for make + missing-key decode | repeated `[]` default wiring on array fields | `SchemaUtils/withKeyDefaults.ts:114` |
| `SchemaUtils.BoolKeyDefaultFalse` / `BoolKeyDefaultTrue` | annotated boolean field defaulting make + missing key | `O.getOrElse(O.fromUndefinedOr(...), thunkFalse)` plumbing | `Md.model.ts:1101,1468` |
| `SchemaUtils.withEncodeDefault` | `dual` decode-only default, keeps encode strict | a decode fallback that must NOT leak into the encoded shape | `SchemaUtils/withEncodeDefault.ts:40` |
| `SchemaUtils.optionalKeyWithDefault` | `dual` optional key + default | v4 replacement for `S.optionalWith(s, { exact, default })` | `SchemaUtils/optionalKeyWithDefaults.ts:29` |

> `withConstantDefault` / `withNoneDefault` are **constructor-only** (they wrap
> `S.withConstructorDefault`), so the encoded/wire contract stays unchanged. Use
> `withKeyDefaults` when a missing key on **decode** should also default.

### Statics & guards — kill the top-of-file decode/guard wall

| Symbol | Signature (abridged) | Kills | Live site |
|--------|----------------------|-------|-----------|
| `SchemaUtils.withCodecStatics` | `<Sch extends S.Top & S.ConstraintDecoder<unknown>>(self) => Sch & { is; fromUnknown; decodeOption }` | the wall of `const isX = S.is(X)` / `const decodeX = S.decodeUnknownOption(X)` | `Md.model.ts:1612` (`Block` union) |
| in-body `static readonly is = S.is(Self)` | attach on `S.Class`/`S.TaggedClass` (they lose piped statics) | a free-floating guard next to the class | `Md.model.ts:873` (`Heading.is`) |
| `SchemaUtils.withStatics` | `dual` `(self, (schema) => methods) => self & methods` | ad-hoc `Object.assign(schema, {...})` + statics lost on `.annotate` | `SchemaUtils/withStatics.ts:91` |
| `SchemaUtils.withLiteralKitStatics` | `(literalKit) => (self) => self & kitHelpers` | LiteralKit helpers dropped after an annotation rebuild | `SchemaUtils/withLiteralKitStatics.ts:37` |
| `SchemaUtils.toEquivalence` | `dual` `(schema) => (a, b) => boolean` | manual `===` / `!==` on decoded values | `SchemaUtils/toEquivalence.ts:64` |

> `withCodecStatics.fromUnknown` is a **trusted-boundary sync decode** (throws on bad
> input); `decodeOption` is the soft-boundary form (returns `O.Option`). Both come from
> the schema, so there is nothing to keep in sync by hand.

### Literal domains — collapse repeated variant families

| Symbol | API | Kills | Live site |
|--------|-----|-------|-----------|
| `LiteralKit([...])` | `.Options`, `.Enum`, `.is`, `.pickOptions`, `.omitOptions`, `.$match`, `.thunk`, `.toTaggedUnion` | duplicate literal arrays + enum-like objects + ad-hoc literal guards; N near-identical nodes | `Md.model.ts:830` (`HeadingLevel`), `Lexical.model.ts:508` (`HeadingTag`) |
| `MappedLiteralKit([[from,to]])` | `.From.Enum` (from→to), `.To.Enum` (to→from), `.Pairs`, `.is` | a hand-written bidirectional lookup table + its inverse | code/protocol maps (e.g. `level↔"h1".."h6"`, SQLSTATE) |

> **Key-stringification gotcha.** Non-string literals become string helper keys:
> `1 → "number1"`, `true → "true"`, `1n → "bigint1n"`. So `LiteralKit([1,2,3,4,5,6]).Enum`
> is `{ number1, …, number6 }` and `.$match({ number200: … })`. A manual second-arg map
> `[[1,"H1"],…]` renames them (`.Enum.H1`). Do **not** add `as const` to the inline array —
> the const type params already preserve the tuple.

### Identity & errors — no bare-string identifiers, no `new Error`

```ts
import { $SchemaId } from "@beep/identity/packages";          // ~90 pre-built composers
import * as S from "effect/Schema";

const $I = $SchemaId.create("relative/path/from/pkg/src");    // file-scoped child composer

// schema identifier + annotations
export class Heading extends S.TaggedClass<Heading>($I`Heading`)(
  "heading", { level: HeadingLevel }, $I.annote("Heading", { description: "…" })
) { static readonly is = S.is(Heading); }

// pipeable schema annotation
export const HeadingLevel = LiteralKit([1,2,3,4,5,6]).pipe($I.annoteSchema("HeadingLevel", { … }));

// per-key annotation
{ level: HeadingLevel.annotateKey({ description: "…" }) }

// typed error (identifier from $I, never a bare string)
class ParseError extends S.TaggedError<ParseError>($I`ParseError`)(
  "ParseError", { operation: S.String }, $I.annote("ParseError", { description: "…" })
) {}

// boundary-translation error (always declares message + cause explicitly)
class DomainError extends S.TaggedError<DomainError>($I`DomainError`)(
  "DomainError",
  { message: S.String, cause: S.Defect({ includeStack: true }) },
  $I.annote("DomainError", { description: "…" })
) {}
// Effect.fail(raw).pipe(Effect.mapError((cause) =>
//   new DomainError({ message: "Domain operation failed", cause })
// ))
```

Use the package `$I` composer for a distinct namespaced identifier. When no
distinct identifier is needed, use `S.TaggedError<ParseError>()("ParseError",
fields)`. Never pass a bare identifier equal to the tag.

`$I` API: `` $I`Name` `` (schema identifier), `$I.annote(name, extras)` (annotation record),
`$I.annoteSchema(name, extras)` / `$I.annoteKey(name, extras)` (pipeable), `$XId.create(seg)`
(child composer). One segment per template tag — interpolation throws.

### Terse behavior & tests

| Symbol | Use |
|--------|-----|
| `Match.tagsExhaustive({ tag: fn, … })` | the catamorphism: one arm per variant, exhaustiveness enforced. Adding a node = adding one arm. |
| `Effect.fn("Name")(function* …)` / `Effect.fnUntraced(...)` | production (traced) / tests + hot paths (untraced) — never `(a) => Effect.gen(...)`. |
| `dual(2, impl)` | public 2–3-arg helpers get data-first + data-last for free (EF-18). |
| `flow(...)` | passthrough `pipe` callbacks; direct helper refs over trivial lambdas. |
| `S.toArbitrary(Schema)` + `@effect/vitest` (`FastCheck as fc`) | derive test data from the schema; delete hand fixtures. `Md.test.ts:45`, `Lexical.model.test.ts:16` |

---

## Part B — before → after moves

Distilled from `packages/foundation/modeling/md/src/` and `.../lexical/src/`.

**1. Six heading nodes → one `Heading{ level }`.** Kills ~20 repeated match arms + the
`headingConstructors`/`headingMarkerCount` lookup tables.
```ts
// before: H1..H6 as six S.TaggedClass nodes, six render arms, two lookup tables
// after:
export const HeadingLevel = LiteralKit([1,2,3,4,5,6]).pipe($I.annoteSchema("HeadingLevel", { … }));  // Md.model.ts:830
export class Heading extends S.TaggedClass<Heading>($I`Heading`)("heading",
  { level: HeadingLevel.annotateKey({ … }), children: … }, $I.annote("Heading", { … })) {
  static readonly is = S.is(Heading);                                                                  // Md.model.ts:873
}
// one render arm: heading: (b) => `${Str.repeat("#")(b.level)} ${inline(b.children)}`
// Md.h1…h6 stay as thin builders that construct Heading with a level.
```

**2. Decode/guard header wall → colocated statics.**
```ts
// before: const isBlock = S.is(Block); const decodeBlock = S.decodeUnknownOption(Block); // ×N at file top
// after:
export const Block = S.Union([Heading, P, BlockQuote, /* … */]).pipe(SchemaUtils.withCodecStatics); // Md.model.ts:1612
// call sites: Block.is(x) / Block.decodeOption(raw) — nothing to keep in sync.
```

**3. `*Defaults` spreads → schema-field defaults.** ~30 construction sites collapse.
```ts
// before: new ParagraphNode({ ...ParagraphDefaults, children })  // version:1, direction:none, format:"", indent:0 …
// after (fields carry their own defaults):
version: LexicalNodeVersion.pipe(SchemaUtils.withConstantDefault(1)),        // Lexical.model.ts:681
format:  ElementFormat.pipe(SchemaUtils.withConstantDefault<ElementFormat>("")), // :772
indent:  LexicalIndentDepth.pipe(SchemaUtils.withConstantDefault<number>(0)),     // :776
direction: SomeDirection.pipe(SchemaUtils.withNoneDefault),                        // :688
// call site: ParagraphNode.makeEffect({ children })
```

**4. Nullable field + null-ternary → `Option` field.**
```ts
// before: backgroundColor: string | null;  … color != null ? color : fallback
// after:
backgroundColor: S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault),
// use: O.getOrElse(cell.backgroundColor, () => fallback) — no null in domain code.
```

**5. Duplicated imperative segmentation loop → one shared `dual` combinator.**
```ts
// before: let runs = []; for (const c of children) { if (isInline(c)) …push… }  // repeated in every list renderer
// after: one combinator, data-first or data-last, no let/for/push:
export const segmentInlineRuns: {
  <I,B>(items: ReadonlyArray<I|B>, s: SegmentStrategy<I,B>): ReadonlyArray<string>;
  <I,B>(s: SegmentStrategy<I,B>): (items: ReadonlyArray<I|B>) => ReadonlyArray<string>;
} = dual(2, (items, s) => A.match(items, {
  onEmpty: A.empty<string>,
  onNonEmpty: flow(A.groupWith((l,r) => s.isInline(l) === s.isInline(r)), A.flatMap(/* … */)),
}));
```

**6. Hand fixtures → schema-derived property laws.**
```ts
import { FastCheck as fc } from "effect/testing";
const DocumentArbitrary = S.toArbitrary(Document);                 // Md.test.ts:47
it("round-trips losslessly", () => fc.assert(fc.property(DocumentArbitrary, (doc) =>
  expect(decode(encode(doc))).toEqual(doc)), { numRuns: 50 }));
// codec law: Md → Lexical → Md stabilizes after one pass (the lossiness profile IS the law).
```

**7. Module role split.** Behavior moves off the schema class; `.model.ts` stays pure,
breaking the model↔utils cycle.
```
Md.model.ts    — schemas only (S.TaggedClass, LiteralKit, SchemaUtils.*)
Md.behavior.ts — pure projections (plain-text, run segmentation)
Md.escape.ts   — escaping / URL sanitization (trust boundary — stays explicit + tested)
Md.render.ts   — render adapters (Match.tagsExhaustive matchers)
Md.ts          — public builder namespace (Md.h1 … Md.table)
```
`@beep/lexical-schema` specializes differently: `.model` / `.behavior` / `.codec` /
`.normalize`. No package uses all five suffixes — pick per package.

**8. Lesson — a value→function schema is a breaking change.** Exposing a *typed*
`Effect<A,E,R>` schema legitimately requires a phantom-typed function
(`export const EffectSchema = <A,E,R>() => S.declare<Effect.Effect<A,E,R>>(isEffect, …)`),
because `S.declare` can't runtime-check type args. But turning a schema **value** into a
**function** breaks every value-form consumer: tests and `@example` blocks must now call
`EffectSchema()` (or `S.is(EffectSchema())`), not pass the bare function. When you
parameterize a schema, sweep the guard/decode/example call sites in the same change.
