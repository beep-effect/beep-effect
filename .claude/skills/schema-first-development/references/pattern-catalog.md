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

### Look up what ships before choosing a primitive

The table above is a sample. The complete list is generated from the installed
`effect` into `references/schema-index/`, grouped by the type on the wire, so
the lookup is "this arrives as a number, what can it become":

```bash
bun run beep schema-idioms lookup number
```

Slices: `string`, `number`, `bigint`, `date`, `collections` (size, length and
uniqueness checks), `constructors` (schemas that take a schema: `S.Option`,
`S.OptionFromNullOr`, `S.HashSet`, `S.Redacted`, `S.NonEmptyArray`) and
`getters`. `bun run beep schema-idioms index --write` regenerates them after an
Effect bump; `--check` fails when they are stale.

A field's name is the strongest sign that a primitive is standing in for a
richer value. Seven name shapes are checked on newly written schema fields, and
`bun run beep schema-idioms hint <file>` prints them for a file:

| The name reads as | Examples | Consider |
| --- | --- | --- |
| a duration | `timeoutMs`, `leaseMillis`, `ttl`, `retryDelay` | `S.DurationFromMillis`, `S.DurationFromNanos`, `S.DurationFromString` |
| an instant | `createdAt`, `expiresAt`, `startedAtMs`, `maintenanceUntil` | `S.DateTimeUtcFromString`, `S.DateTimeUtcFromMillis`, `S.DateTimeUtcFromDate` |
| a byte size | `payloadBytes`, `diskFreeBytes` | `S.ByteSizeFromNumber`, `S.ByteSizeFromBigInt`, `S.ByteSizeFromString` |
| a URL | `endpointUrl`, `callbackUri`, `href` | `S.URLFromString` |
| a network address | `address`, `host`, `sourceIp` | `S.IpAddressFromString`, `S.HostFromString`, `S.HostPortFromString` |
| a port | `port`, `listenPort` | `S.Port` |
| a version | `agentVersion`, `clientVersion` | `S.SemVerFromString` |

The hint is advisory. Keep the primitive when the encoded shape is a persisted
or published contract that other code compares as a number, or when the value
only passes through to another field of the same primitive type.

Changing the definition is what removes the compensating code. Once a field
decodes to `ByteSize`, the `bytes / 1024 ** 3` at the call site is replaced by
`ByteSize.format`; once it decodes to `Option`, the `=== null` goes. So a null
check, a `??` fallback, a `.trim()` or a `.length > 0` in application code is a
reason to read back to where the value was decoded, not a defect on that line:
most such lines act on local variables, platform values or parser input that no
schema produced. Use them as a reading aid in review (`crispen`), never as a
line-level rule.

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

### The discriminator governs its fields

The best reason to reach for a tagged union is a rule of the form "when
`state` is X, field Y is present, absent or required". Put that rule in the
members: each member declares exactly the fields its state has. The rule is
then enforced when a value is built, when it is decoded and when code reads
it, with no check to remember.

```ts
import { $SchemaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $SchemaId.create("examples");

const RunState = LiteralKit(["running", "success", "error"]);

class RunRunning extends S.Opaque<RunRunning, { readonly brand: unique symbol }>()(
  S.Struct({
    state: S.tag("running"),
  }).pipe($I.annoteSchema("RunRunning", { description: "A run that has not finished." }))
) {}

class RunSuccess extends S.Opaque<RunSuccess, { readonly brand: unique symbol }>()(
  S.Struct({
    state: S.tag("success"),
    output: S.String,
  }).pipe($I.annoteSchema("RunSuccess", { description: "A finished run and what it produced." }))
) {}

class RunError extends S.Opaque<RunError, { readonly brand: unique symbol }>()(
  S.Struct({
    state: S.tag("error"),
    error: S.NonEmptyString,
  }).pipe($I.annoteSchema("RunError", { description: "A failed run and why it failed." }))
) {}

export const Run = RunState.mapMembers(() => Tuple.make(RunRunning, RunSuccess, RunError)).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("Run", { description: "One run, in the state it has reached." })
);
export type Run = typeof Run.Type;

export const summarize = Run.match({
  running: () => "still running",
  success: ({ output }) => `done: ${output}`,
  error: ({ error }) => `failed: ${error}`,
});
```

A success has no `error` field to set, an error cannot be built without one,
and `summarize` cannot read `error` outside the `error` arm. The flat form,
`{ state, error?: string, output?: string }`, states none of that.

Prefer the strongest form that can carry a rule:

1. **Shape.** A rule about which fields exist under which state goes in the
   union's members. The type, the constructor, the decoder and every match
   enforce it.
2. **Check.** A rule the shape cannot carry (one number below another, a span
   inside a text) is a metadata-rich `S.makeFilter` on the schema. The
   constructor and the decoder enforce it; the type does not.
3. **Code.** A rule left to an `if`, an assertion or a comment is enforced
   only where someone remembered. Move it up.

When a cross-field filter reads a literal field
(`run.state !== "success" || O.isNone(run.error)`), it is a union written as
a check. Replace it with the members.

## 6a. Nested Unions: One Question Per Union

A tagged union answers one question about a value ("which kind of media is
this?"). A discriminator that answers two questions at once, or two flags on
one struct that between them answer one, is the smell. The idea is the old
one, make illegal states unrepresentable; the rule that gets there is one
question per union.

Use it when any of these is true:

- a union's tags are products of two domains (`"video-locked"`,
  `"image-full"`)
- a struct has two discriminating literal fields, or one literal field plus
  optional fields that only mean something under some of its values
- branch code reads `a.kind === "x" && a.status === "y"`

First write the questions the data answers. Then ask of each pair: does the
first answer decide which second question is asked? That picks the shape.

### Dependent: the first answer decides the second question

Each member of the outer union holds its own inner union. The inner unions
differ, because the second question is a different question per answer. Put
the question code chooses by first on the outside: the one whose answer
selects a service, a renderer or a table.

```ts
import { $SchemaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $SchemaId.create("examples");

const VideoTargetKind = LiteralKit(["channel", "clip"]);
const VideoTarget = VideoTargetKind.mapMembers(() =>
  Tuple.make(
    S.Struct({ kind: S.tag("channel"), handle: S.NonEmptyString }),
    S.Struct({ kind: S.tag("clip"), id: S.NonEmptyString })
  )
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("VideoTarget", { description: "What a video site link points at." })
);

const ForumTargetKind = LiteralKit(["board", "thread"]);
const ForumTarget = ForumTargetKind.mapMembers(() =>
  Tuple.make(
    S.Struct({ kind: S.tag("board"), name: S.NonEmptyString }),
    S.Struct({ kind: S.tag("thread"), board: S.NonEmptyString, id: S.NonEmptyString })
  )
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ForumTarget", { description: "What a forum link points at." })
);

const Site = LiteralKit(["video", "forum"]);

class VideoLink extends S.Opaque<VideoLink, { readonly brand: unique symbol }>()(
  S.Struct({
    site: S.tag("video"),
    target: VideoTarget,
  }).pipe($I.annoteSchema("VideoLink", { description: "A link into the video site." }))
) {}

class ForumLink extends S.Opaque<ForumLink, { readonly brand: unique symbol }>()(
  S.Struct({
    site: S.tag("forum"),
    target: ForumTarget,
  }).pipe($I.annoteSchema("ForumLink", { description: "A link into the forum." }))
) {}

export const Link = Site.mapMembers(() => Tuple.make(VideoLink, ForumLink)).pipe(
  S.toTaggedUnion("site"),
  $I.annoteSchema("Link", { description: "A link, by site and then by what it points at." })
);
export type Link = typeof Link.Type;

export const describeLink = Link.match({
  video: ({ target }) =>
    VideoTarget.match(target, {
      channel: ({ handle }) => `channel ${handle}`,
      clip: ({ id }) => `clip ${id}`,
    }),
  forum: ({ target }) =>
    ForumTarget.match(target, {
      board: ({ name }) => `board ${name}`,
      thread: ({ board, id }) => `thread ${id} on ${board}`,
    }),
});
```

### Independent: the second question is asked whatever the first answer

The flat form is a product multiplied out: two kinds times two access levels
is four tags, and every match repeats the second question once per first
answer. Factor it back into two unions. The second union is one schema,
reused as the same field wherever the question applies.

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
  $I.annoteSchema("Media", { description: "One gallery item: its kind, and separately its access." })
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

Because the questions are independent, each has one matcher (`fetchable`
never mentions kinds). When the members of the outer union would differ in
nothing but their tag, there is no outer union to write: the value is one
struct with two fields, each a union or a `LiteralKit`.

### Both shapes

- A member that carries nothing but its tag is normal. It is what makes the
  match exhaustive.
- A field true of one answer sits in that answer's member. A field true of
  every answer of a union sits on the struct that holds the union.
- Each union has its own `.cases`, `.guards` and `.isAnyOf`, so construction
  reads `Media.cases.video.make({ access: Access.cases.locked.make({}), seconds: 12 })`.
- Adding an answer is a compile error at the matches of that one union and
  nowhere else. A product-tagged union breaks every match for either change.
- A state the unions exclude cannot be built: a locked item has no field to
  hold a URL.

### Where a literal field stays a literal

- A literal that no answer attaches data to, and that code only stores, shows
  or compares, stays a `LiteralKit` field. `LiteralKit.match` is already
  exhaustive over it.
- Lift it into a union as soon as one answer gains a field, or a sibling field
  turns out to be meaningful only under some answers.

### A refined view for the cross-cut

A dependent nesting has one order. When code also needs "every locked item,
of any kind", or "every link to a single post, on any site", do not build a
second tree: refine the first one with a type guard.

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

### Gotchas

- A union's own `.match` takes the wide union, so inside an arm a refined
  value's inner field is wide again. Narrow a refined value on its
  discriminator directly (`media.kind === "video"`).
- A constructor returns the wide type. Wrap it: `LockedMedia.make(Media.cases.image.make({...}))`,
  or `LockedMedia.makeOption(...)` where a miss is a legal outcome.
- Decoding drops a key the matched member does not declare; it does not refuse
  it. Test that a forbidden field cannot survive a decode, not that the input
  is rejected.
- Do not invent a question the domain does not ask in order to add a union,
  and do not keep two unions for one question.

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
  Factor into one union per question (section 6a)
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
