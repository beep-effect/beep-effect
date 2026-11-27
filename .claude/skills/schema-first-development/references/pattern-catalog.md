# Pattern Catalog

Use this file to choose the repo-preferred schema pattern for the task.

## 1. Replace an Exported Pure-Data `interface`

Trigger:

- schema-first lint finding
- review note about duplicated type and runtime validation
- new domain payload proposal written as plain TS

Preferred replacement:

```ts
import * as S from "effect/Schema";
import { $SchemaId } from "@beep/identity/packages";
const $I = $SchemaId.create("examples");
export class TaskInput extends S.Opaque<TaskInput, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    title: S.String,
    priority: S.Int,
  }).pipe(
    $I.annoteSchema("TaskInput", {
      description: "Input payload for task creation.",
    })
  )
) {}
```

Keep the schema value as the source of truth and derive types from it.

## 2. Build an Object Model

Default for plain data:

- `S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...})))`
  for domain objects and reusable payloads
- `S.TaggedStruct("X", {...})` as the Opaque source for `_tag` data
- construct with `X.make(...)`; no `new X(...)`, no `.extend` (spread
  `X.fields` or use `S.fieldsAssign(...)`)
- annotate the Struct inside the pipe; `X.annotate(...)` drops the statics

Stay on a branded `S.Class` / `S.TaggedClass` / `S.Error` / `S.TaggedError`:

- errors
- persisted entities (built on `@beep/effect-drizzle`)
- schemas with instance members (getters or methods)
- `.extend` chain roots and subclasses

Every schema class and Opaque declaration carries `{ readonly brand: unique symbol }`.

Boundary exception:

- an unwrapped `S.Struct` for plain shape composition that is never exported
  as a domain model
- If you use `S.Struct`, export `type X = typeof X.Type`

## 3. Model Boundary Normalization and Defaults

Use this when:

- reading env/config values
- normalizing strings
- translating text or unknown input into typed values
- encoding fallback behavior directly in the schema

Preferred tools:

- `S.decodeTo(...)`
- `SchemaTransformation.transform(...)`
- `S.withConstructorDefault(...)`
- `S.withDecodingDefaultKey(...)`

This pattern is preferred over manual parsing branches and fallback object
construction.

Decode a boundary value into the Effect type that means it, with the schema
`effect/Schema` ships, instead of keeping the string or number it arrived as:

| The value is | Decode with |
| --- | --- |
| a time | `S.DateTimeUtcFromString`, `S.DateTimeUtcFromMillis`, `S.DateTimeUtcFromDate`, `S.DateTimeZonedFromString` |
| a duration | `S.DurationFromMillis`, `S.DurationFromIsoString` |
| a size in bytes | `S.ByteSizeFromNumber`, `S.ByteSizeFromString` |
| a decimal amount | `S.BigDecimalFromString` |
| bytes or text in text | `S.Uint8ArrayFromBase64`, `S.Uint8ArrayFromHex`, `S.StringFromBase64` |
| a secret | `S.Redacted`, `S.RedactedFromValue` |
| a URL or query string | `S.URLFromString`, `S.UrlParams` |
| a version | `S.SemVerFromString` |
| a host, address or domain | `S.HostPortFromString`, `S.IpAddressFromString`, `S.DomainNameFromString` |
| a map or set | `S.HashMap`, `S.HashSet` |
| a count | `S.Natural`, or `S.Int` with a range check |
| JSON | `S.fromJsonString(schema)`, `S.Json`, `S.JsonObject` |

Trimming, case and splitting are getters or transformations composed with
`S.decodeTo` (`SchemaTransformation.trim()`, `.toLowerCase()`,
`.toUpperCase()`; `SchemaGetter.split(...)`). Business code does not call
`Str.trim` on a decoded value.

A field's description is a key annotation: `S.annotateKey({ description })`
or `$I.annoteKey("Owner.field", { description })`, never `.annotate(...)`,
which describes the schema as a whole.

## 4. Model Absence as `Option`

Use the schema helpers that match the boundary shape.

- `OptionFromNullOr`: input may be `null`
- `OptionFromNullishOr`: input may be `null` or `undefined`
- `OptionFromOptionalKey`: object key may be absent (never `OptionFromOptional`, EF-40)

Do not decode to `string | undefined` and convert later unless the boundary
truly requires it.

## 5. Model Reusable Literal Domains

Use `LiteralKit(...)` for a named literal domain, especially when it needs any
of:

- guards (`.is`)
- enums (`.Enum`)
- record-form matching (`match`)
- direct annotation

Inline array literals passed directly to `LiteralKit(...)` should omit
`as const`; `LiteralKit` preserves them through const type parameters.

Use `S.Literals(...)` for an anonymous inline union never referenced by name.

## 6. Model Tagged Unions

Use this split:

- Model finite variants, lifecycle states, status/result cases, and
  case-specific payloads as discriminated unions instead of optional/nullish
  payload bags.
- If an external wire contract forces a bag shape, decode or normalize it into
  an internal tagged model before branching.
- `S.toTaggedUnion("field")` for discriminator fields such as `kind`, `type`,
  `status`, `subtype`, `decision`, `profile`, or `family`
- `S.TaggedUnion(...)` only for `_tag`

Repo-preferred construction for reusable literal domains:

1. Define the literal kit.
2. Define member schemas, usually as branded `S.Opaque` classes over `S.Struct`.
3. Assemble members with `.mapMembers(...)`.
4. Finalize with `S.toTaggedUnion("field")`.

This is the high-signal repo style for discriminator-heavy modules.

When branching on the resulting schema union, prefer the schema-derived
`.match` helper. Use `.cases` for case constructors, `.guards` for
discriminator-aware guards, and `.isAnyOf` for grouped case checks. For
ordinary runtime unions that are not schema-derived, prefer
`Match.tagsExhaustive` or `Match.tags` when they make the case set explicit.

## 6a. Layer Unions: One Question Per Layer

A tagged union answers one question about a value ("which kind of media is
this?"). When a value answers a second question ("what may the viewer
fetch?"), the second answer is its own tagged union, held as a field of the
first union's members. The result is a tree of small unions that code walks
with nested `.match` calls, one layer per question.

Use it when any of these is true:

- a struct has two discriminating literal fields, or one literal field plus
  optional fields that only mean something under some of its values
- a union's tags are products of two domains (`"video-locked"`,
  `"image-full"`): the member count is the product, and every match repeats
  the second question once per first answer
- branch code reads `a.kind === "x" && a.status === "y"`

How to build it:

1. Write the questions the data answers, and order them the way code chooses:
   the question whose answer picks a service, a renderer or a table comes
   first.
2. Give each question a `LiteralKit` and one member schema per answer.
3. A field true of every answer sits on the layer above. A field true of one
   answer sits in that answer's member. A member that carries nothing but its
   tag is normal: it is what makes the match exhaustive.
4. Close each layer with `mapMembers` and `S.toTaggedUnion("<field>")`, inner
   layers first, and use the inner union as a field type of the outer members.

```ts
import { $SchemaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $SchemaId.create("examples");

const AccessKind = LiteralKit(["full", "locked"]);

class AccessFull extends S.Opaque<AccessFull, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("full"),
    urls: S.NonEmptyArray(S.NonEmptyString),
  }).pipe($I.annoteSchema("AccessFull", { description: "Every rendition can be fetched." }))
) {}

class AccessLocked extends S.Opaque<AccessLocked, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("locked"),
  }).pipe($I.annoteSchema("AccessLocked", { description: "The item exists and nothing can be fetched." }))
) {}

export const Access = AccessKind.mapMembers(() => Tuple.make(AccessFull, AccessLocked)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Access", { description: "What the viewer may fetch of one item." })
);
export type Access = typeof Access.Type;

const MediaKind = LiteralKit(["image", "video"]);

class MediaImage extends S.Opaque<MediaImage, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("image"),
    access: Access,
  }).pipe($I.annoteSchema("MediaImage", { description: "A still image." }))
) {}

class MediaVideo extends S.Opaque<MediaVideo, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("video"),
    access: Access,
    seconds: S.Natural,
  }).pipe($I.annoteSchema("MediaVideo", { description: "A video and its running time." }))
) {}

export const Media = MediaKind.mapMembers(() => Tuple.make(MediaImage, MediaVideo)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Media", { description: "One gallery item, by kind and then by access." })
);
export type Media = typeof Media.Type;

const fetchable = Access.match({
  full: ({ urls }) => `${A.length(urls)} files`,
  locked: () => "locked",
});

export const describeMedia = Media.match({
  image: ({ access }) => `image, ${fetchable(access)}`,
  video: ({ access, seconds }) => `video of ${seconds}s, ${fetchable(access)}`,
});
```

What this buys:

- A locked item cannot hold a URL. In a flat struct with `locked: boolean` and
  `urls: Array<string>` that state is one typo away.
- Adding an access level is a compile error in `fetchable` and nowhere else.
  Adding a media kind is a compile error in `describeMedia` and nowhere else.
  A flat product union breaks every match for either change.
- Each layer has its own `.cases`, `.guards` and `.isAnyOf`, so construction
  reads `Media.cases.video.make({ access: Access.cases.locked.make({}), seconds: 12 })`.

Where a literal field stays a literal:

- A literal that no answer attaches data to and that code only stores, shows
  or compares stays a `LiteralKit` field. `LiteralKit.match` is already
  exhaustive over it.
- Lift it into a union as soon as one answer gains a field, or a sibling field
  turns out to be meaningful only under some answers.

Reading the tree in the other order:

A tree has one nesting order. When code also needs "every locked item, of any
kind", do not build a second tree: refine the first one with a typed guard.

```ts
import * as S from "effect/Schema";

const Locked = S.Struct({ kind: S.tag("locked") });
const Full = S.Struct({ kind: S.tag("full"), url: S.NonEmptyString });
const Access = S.Union([Full, Locked]).pipe(S.toTaggedUnion("kind"));
const Image = S.Struct({ kind: S.tag("image"), access: Access });
const Video = S.Struct({ kind: S.tag("video"), access: Access });
const Media = S.Union([Image, Video]).pipe(S.toTaggedUnion("kind"));
type Media = typeof Media.Type;

type LockedMedia = Media & { readonly access: typeof Locked.Type };
const isLocked = (media: Media): media is LockedMedia => media.access.kind === "locked";

export const LockedMedia = Media.pipe(
  S.refine(isLocked, {
    identifier: "LockedMedia",
    title: "Locked media",
    description: "A gallery item of any kind whose access is locked.",
  })
);
```

The refined value is still a `Media`, so it encodes and prints with no
conversion. A signature that takes `LockedMedia` turns a wrong argument into a
compile error.

Gotchas:

- A union's own `.match` takes the wide union, so inside an arm a refined
  value's inner field is wide again. Narrow a refined value on its
  discriminator directly (`media.kind === "video"`).
- A constructor returns the wide type. Wrap it: `LockedMedia.make(Media.cases.image.make({...}))`,
  or `LockedMedia.makeOption(...)` where a miss is a legal outcome.
- Decoding drops a key the matched member does not declare; it does not refuse
  it. Test that a forbidden field cannot survive a decode, not that the input
  is rejected.
- Do not invent a question the domain does not ask in order to add a layer,
  and do not keep two layers for one question.

## 7. Reuse Schema-Derived Runtime Helpers

When the schema already exists, derive helpers instead of duplicating the rule.

Use:

- `S.is(schema)` for guards
- `S.toEquivalence(schema)` for comparisons
- `Arbitrary.schema(schema)` (`effect/Arbitrary`) for schema-modeled property tests
- schema tagged-union `.cases`, `.guards`, `.isAnyOf`, and `.match`
- `LiteralKit.Enum`, `.is`, `.match`, `.matchOrElse`, and `.toTaggedUnion`, the
  kit-returning subsets `.pick(...)` and `.omit(...)`, plus the inherited
  `S.Literals` members `.literals` and `.mapMembers(...)`
- `S.decodeUnknownEffect` / `S.decodeEffect` for default decoders
- `S.encodeUnknownEffect` / `S.encodeEffect` for default encoders
- `S.decodeUnknownResult`, `S.decodeResult`, or `S.decodeUnknownOption` only
  for explicit non-throwing synchronous helpers

Avoid:

- hand-written `isX`
- duplicate comparison logic
- duplicate literal arrays or enum-like constants for a `LiteralKit` domain
- `switch` / `if` branches over a schema tagged-union discriminator in the
  same module that owns the schema
- manual conversion helpers that restate schema behavior
- sync throwing schema codecs (`S.decodeSync`, `S.decodeUnknownSync`,
  `S.encodeSync`, `S.encodeUnknownSync`) as the default constructor pattern

When decoder or encoder failures leave the local helper, wrap the Effect codec
with `Effect.mapError(...)` and return the boundary's typed error.

## 8. Use JSON String Codecs

For JSON string boundaries:

- `S.fromJsonString(S.Unknown)` for unknown JSON payloads
- `S.fromJsonString(MySchema)` when the string should decode directly into a
  known domain schema

Avoid wrapping `JSON.parse` with Effect code unless a very unusual boundary
forces it.

## 9. Add Reusable Custom Checks

Before custom checks:

1. Look for an existing schema in `@beep/schema`.
2. Look for built-in constructors such as `S.NonEmptyString`,
   `S.NonEmptyArray`, `S.isPattern`, and `S.isIncluding`.
3. For exported/domain/boundary schemas, ask whether broad primitives such as
   `S.String`, `S.Number`, or `S.Array` really accept the full primitive space.
4. Only then use `S.makeFilter(...)` or `S.makeFilterGroup(...)`.

If the check is reusable, include:

- `identifier`
- `title`
- `description`
- user-facing `message`

## 10. Common Anti-Patterns and Replacements

- Exported data `interface`
  Replace with a branded `S.Opaque` over an annotated `S.Struct`
- Plain data declared as `S.Class`
  Replace with a branded `S.Opaque`; `S.Class` rejects plain objects in
  `S.is` and encoding
- Schema class or Opaque without a brand type argument
  Add `{ readonly brand: unique symbol }`
- `type X = { ... }` plus separate decoder
  Replace with one schema value and derived type alias
- `JSON.parse` / `JSON.stringify`
  Replace with schema JSON codecs
- Manual default object merging
  Replace with schema defaults and transforms
- Manual branch helpers for schema tagged unions
  Replace with `.match`, `.guards`, `.isAnyOf`, and `.cases`
- Duplicate literal constants for reusable literal domains
  Replace with `LiteralKit.Enum`, `.literals`, `.pick(...)` and `.omit(...)`
- Ad-hoc string predicates
  Replace with local shared schemas, built-in checks, or a reusable metadata-rich
  filter
- `S.Literals(...)` for a reusable internal domain
  Replace with `LiteralKit(...)`
- One object with optional fields for every case payload
  Replace with a tagged union, or decode the external bag into an internal
  tagged model at the boundary.
- Product tags such as `"video-locked"`, or two flags on one struct
  Replace with layered unions, one per question (section 6a)
- A second union tree that restates the first in another order
  Replace with a typed refinement of the first (section 6a)
- `.annotate(...)` on a struct field
  Replace with `S.annotateKey(...)` or `$I.annoteKey(...)`

## 11. Review Checklist

Before approving or shipping schema work, check:

- Is the schema the source of truth?
- Are defaults and normalization encoded in the schema?
- Are nullish and optional fields converted at the boundary?
- Does the code reuse local shared schema primitives?
- Are annotations present and meaningful?
- Are tagged unions built with the right discriminator helper?
- Does each union answer one question, with a second question modeled as a
  nested union instead of product tags or a second flag?
- Are guards, branch helpers, options, arbitraries, or comparisons derived
  instead of duplicated?
- Are exported/domain/boundary primitives as precise as the domain requires?
