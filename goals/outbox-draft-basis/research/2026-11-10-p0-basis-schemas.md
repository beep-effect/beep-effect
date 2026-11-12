# P0: basis schemas, comparison rule and Graph facts

Dated 2026-11-10. This note backs the decision file
`2026-11-10-p0-schemas-store-the-view.md`. It records what was designed,
how it was checked, and what the Microsoft Graph documentation says about
the two reads the design depends on. No package code changed.

## How the sketch was checked

The schemas below were written as one module inside `@beep/m365-mcp`,
type-checked with the package's own `tsrs -p tsconfig.check.json`, and
removed. Everything in the listing compiled against the installed Effect
and `@beep/schema`: the `kind` tagged unions from `LiteralKit`, the
`S.TaggedUnion` status with its `isAnyOf` and `guards` helpers,
`S.toEquivalence`, and the package's `emptyByDefault` field helper applied
to a union schema.

The only diagnostics were two `missingPipeable` findings from the Effect
rules: an exported two-argument function needs a `dual` overload, as
`emptyByDefault` in `packages/drivers/m365-mcp/src/internal/OutboxFields.ts`
already has. The real module exports its comparisons through `dual`.

## The schemas

```ts
import { $M365McpId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { emptyByDefault } from "./internal/OutboxFields.ts";

const $I = $M365McpId.create("OutboxBasis");

// One end of an event, exactly as Graph returned it.
export class OutboxEventInstant extends S.Opaque<OutboxEventInstant, { readonly brand: unique symbol }>()(
  S.Struct({
    dateTime: S.NonEmptyString,
    timeZone: S.NonEmptyString,
  }).pipe($I.annoteSchema("OutboxEventInstant", { description: "One end of an event, as Graph returned it." }))
) {}

// The fields of an event a draft can rest on.
export class OutboxEventView extends S.Opaque<OutboxEventView, { readonly brand: unique symbol }>()(
  S.Struct({
    end: OutboxEventInstant,
    isAllDay: S.Boolean,
    isCancelled: S.Boolean,
    start: OutboxEventInstant,
    subject: S.String,
  }).pipe($I.annoteSchema("OutboxEventView", { description: "The fields of an event a draft can rest on." }))
) {}

// The fields of a message a draft can rest on. Provisional: see "Message pin".
export class OutboxMessageView extends S.Opaque<OutboxMessageView, { readonly brand: unique symbol }>()(
  S.Struct({
    internetMessageId: S.NonEmptyString,
    newestOtherReply: S.OptionFromOptionalKey(S.NonEmptyString),
  }).pipe($I.annoteSchema("OutboxMessageView", { description: "The fields of a message a draft can rest on." }))
) {}

const pinStamp = {
  changeKey: S.OptionFromOptionalKey(S.NonEmptyString), // audit only, never compared
  id: S.NonEmptyString,
  observedAt: S.DateTimeUtcFromString,
};

const OutboxBasisKindBase = LiteralKit(["event", "message"]);

// What a fresh read observes, by kind.
export const OutboxBasisObservation = OutboxBasisKindBase.toTaggedUnion("kind")({
  event: { view: OutboxEventView },
  message: { view: OutboxMessageView },
}).pipe($I.annoteSchema("OutboxBasisObservation", { description: "The named view of one Graph item, by kind." }));

// What the draft-created record stores: the observation plus when and what was read.
export const OutboxBasisPin = OutboxBasisKindBase.toTaggedUnion("kind")({
  event: { ...pinStamp, view: OutboxEventView },
  message: { ...pinStamp, view: OutboxMessageView },
}).pipe($I.annoteSchema("OutboxBasisPin", { description: "One Graph item a draft rested on, with the view observed then." }));

export const OutboxBasisChangedField = LiteralKit([
  "subject",
  "start",
  "end",
  "isAllDay",
  "isCancelled",
  "internetMessageId",
  "newestOtherReply",
]).pipe($I.annoteSchema("OutboxBasisChangedField", { description: "A named view field that differs now." }));

export const OutboxBasisStatus = S.TaggedUnion({
  Changed: { fields: S.NonEmptyArray(OutboxBasisChangedField), now: OutboxBasisObservation },
  Current: {},
  Gone: {},
  Unreadable: { reason: S.NonEmptyString },
}).pipe($I.annoteSchema("OutboxBasisStatus", { description: "What a fresh read says about one pin." }));

export const OutboxBasisVerdict = LiteralKit(["unpinned", "pinned-current", "pinned-stale", "pinned-unverified"]).pipe(
  $I.annoteSchema("OutboxBasisVerdict", { description: "Overall basis verdict of one draft." })
);

export class OutboxBasisReport extends S.Opaque<OutboxBasisReport, { readonly brand: unique symbol }>()(
  S.Struct({
    pins: S.Array(S.Struct({ pin: OutboxBasisPin, status: OutboxBasisStatus })),
    verdict: OutboxBasisVerdict,
  }).pipe($I.annoteSchema("OutboxBasisReport", { description: "Basis report of one draft." }))
) {}

// The new field of the draft-created record. A record written before this
// goal has no such key and decodes to an empty basis.
export const basisField = emptyByDefault(OutboxBasisPin, "Graph items the draft rested on; empty when unpinned.");
```

Key annotations and JSDoc are omitted here for length; the module carries
them as every other schema in the package does.

## Why the pin stores the view and not a digest

The brief and the first decision said "a digest of named fields". The part
that matters is "named fields, not `changeKey`", and that stands. The
digest does not.

- A digest is for something too large to store or not allowed in the log,
  such as attachment bytes. An event view is five short fields.
- The audit log already holds event subjects and draft subjects in clear
  (`event-created`, `draft-created`). The view adds start, end and two
  flags. No body is stored.
- With the view stored, equality comes from the schema
  (`S.toEquivalence`). A digest needs a canonical encoding, which is a
  second definition of equality to keep correct.
- A digest can only say "changed". The stored view says which field
  changed, and the status carries the fresh observation, so the report can
  read "start moved from the 5th to the 12th".

## Comparison rule

One predicate per named field. `start` and `end` compare with the
equivalence derived from `OutboxEventInstant`. A field outside the view (a
category, a reminder, `changeKey`) cannot produce `Changed`, by
construction.

Verdict, from the statuses of a draft's pins:

1. no pins: `unpinned`;
2. any `Changed` or `Gone`: `pinned-stale`;
3. otherwise any `Unreadable`: `pinned-unverified`;
4. otherwise `pinned-current`.

`pinned-unverified` is new against the brief. A read that failed is
unknown, and unknown is neither stale nor current. The check-drafts tool
sets the category on `pinned-stale`, clears it on `pinned-current`, and
leaves it as it is on `pinned-unverified`.

## Time zones

Microsoft Graph, "Get event"
(<https://learn.microsoft.com/en-us/graph/api/event-get?view=graph-rest-1.0>),
read 2026-11-10: "If the `Prefer: outlook.timezone` header is not
specified, the start and end times are returned in UTC."

The driver's `getEvent` sends no such header. Both the read at creation
and the recheck therefore return UTC, and the pair is compared as returned.
No zone conversion is written. The rule to keep: the basis read never sets
a zone preference, and a test pins that. An all-day event is a UTC pair
like any other, with `isAllDay` true.

## Message pin: one new hazard

Microsoft Graph, "message resource type"
(<https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0>),
read 2026-11-10, on `id`: "By default, this value changes when the item is
moved from one container (such as a folder or calendar) to another. To
change this behavior, use the `Prefer: IdType="ImmutableId"` header."

The driver sets no such header. A message pinned by its Graph id would
read as `Gone` once the attorney files it into another folder, which is
routine. The message pin therefore has to recheck by `internetMessageId`,
or the driver has to opt into immutable ids. Either costs more than the
event pin. This strengthens the brief's cut: the message pin ships only if
its decision file settles this inside the two-pull-request budget.

The same sentence covers an event moved between calendars. That is rare;
the report shows it as `Gone`, which is the safe reading.

## Still open in P0

- The tenant proof that a category on a draft does not reach recipients.
  The message resource page does not say. No mark is written before it.
- Whether `conversationId` can be used in a `$filter` on messages. The
  resource page does not say. It decides whether "a later message from
  another sender" is one list call.
- The message pin decision, given the mutable-id hazard above.
- The state of `m365-agent-outbox` slice 3 at the time the first pull
  request opens.
