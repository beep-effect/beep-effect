/**
 * The basis of an outbox draft: the Microsoft Graph items it rested on.
 *
 * **Details**
 *
 * A pin names one Graph item by kind and id and keeps the named view of it
 * observed when the draft was created: for an event its subject, start, end,
 * all-day flag and cancelled flag; for a message its RFC 5322 message id and
 * the newest later reply from another sender in its conversation.
 * {@link compareBasisPin} compares a pin with a fresh observation field by
 * field, and {@link basisVerdict} folds the statuses of a draft's pins into
 * one verdict. Everything here is pure: it reads nothing.
 *
 * The item's `changeKey` is recorded for audit and never compared, because it
 * changes on every edit, a category or a reminder included.
 *
 * @category guards
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { GraphPathSegment } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Equal from "effect/Equal";
import { constFalse, dual, flow, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { emptyByDefault } from "./internal/OutboxFields.ts";
import type { GraphDateTimeTimeZone, GraphEvent, GraphMessage } from "@beep/m365";

const $I = $M365McpId.create("OutboxBasis");

/**
 * One end of an event, exactly as Graph returned it.
 *
 * **Details**
 *
 * The basis read never asks Graph for a time zone, so Graph returns both ends
 * in UTC at creation and at recheck. The pair is stored and compared as
 * returned; nothing converts it.
 *
 * **Example** (Keep an event start)
 *
 * ```ts
 * import { OutboxEventInstant } from "@beep/m365-mcp/OutboxBasis"
 *
 * const start = OutboxEventInstant.make({ dateTime: "2030-01-15T09:00:00.0000000", timeZone: "UTC" })
 * console.log(start.timeZone)
 * // "UTC"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxEventInstant extends S.Opaque<OutboxEventInstant, { readonly brand: unique symbol }>()(
  S.Struct({
    dateTime: S.NonEmptyString.annotateKey({ description: "Local date-time, as Graph returned it." }),
    timeZone: S.NonEmptyString.annotateKey({ description: "Time zone of the date-time, as Graph returned it." }),
  }).pipe($I.annoteSchema("OutboxEventInstant", { description: "One end of an event, as Graph returned it." }))
) {}

/**
 * The fields of an event a draft can rest on.
 *
 * **Example** (Describe an all-day event)
 *
 * ```ts
 * import { OutboxEventInstant, OutboxEventView } from "@beep/m365-mcp/OutboxBasis"
 *
 * const view = OutboxEventView.make({
 *   end: OutboxEventInstant.make({ dateTime: "2030-01-16T00:00:00.0000000", timeZone: "UTC" }),
 *   isAllDay: true,
 *   isCancelled: false,
 *   start: OutboxEventInstant.make({ dateTime: "2030-01-15T00:00:00.0000000", timeZone: "UTC" }),
 *   subject: "Response due"
 * })
 * console.log(view.isAllDay)
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxEventView extends S.Opaque<OutboxEventView, { readonly brand: unique symbol }>()(
  S.Struct({
    end: OutboxEventInstant.annotateKey({ description: "End of the event." }),
    isAllDay: S.Boolean.annotateKey({ description: "Whether the event spans whole days." }),
    isCancelled: S.Boolean.annotateKey({ description: "Whether the event is cancelled." }),
    start: OutboxEventInstant.annotateKey({ description: "Start of the event." }),
    subject: S.String.annotateKey({ description: "Event subject; empty when Graph returned none." }),
  }).pipe($I.annoteSchema("OutboxEventView", { description: "The fields of an event a draft can rest on." }))
) {}

/**
 * The fields of a message a draft can rest on.
 *
 * **Details**
 *
 * `newestOtherReply` is the RFC 5322 message id of the newest message in the
 * same conversation that is not a draft, arrived after the pinned message and
 * was not sent from the outbox mailbox. It is absent when there is none.
 *
 * **Example** (Describe a message with no later reply)
 *
 * ```ts
 * import { OutboxMessageView } from "@beep/m365-mcp/OutboxBasis"
 * import * as O from "effect/Option"
 *
 * const view = OutboxMessageView.make({ internetMessageId: "<request@example.test>", newestOtherReply: O.none() })
 * console.log(O.isNone(view.newestOtherReply))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxMessageView extends S.Opaque<OutboxMessageView, { readonly brand: unique symbol }>()(
  S.Struct({
    internetMessageId: S.NonEmptyString.annotateKey({ description: "RFC 5322 message id of the pinned message." }),
    newestOtherReply: S.OptionFromOptionalKey(S.NonEmptyString).annotateKey({
      description: "RFC 5322 message id of the newest later message from another sender; absent when there is none.",
    }),
  }).pipe($I.annoteSchema("OutboxMessageView", { description: "The fields of a message a draft can rest on." }))
) {}

/**
 * The kinds of Graph item a draft can rest on.
 *
 * **Example** (Guard a pin kind)
 *
 * ```ts
 * import { OutboxBasisKind } from "@beep/m365-mcp/OutboxBasis"
 *
 * console.log(OutboxBasisKind.is.event("event"))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxBasisKind = LiteralKit(["event", "message"]).pipe(
  $I.annoteSchema("OutboxBasisKind", { description: "The kind of Graph item a draft rests on." })
);

/**
 * Type for {@link OutboxBasisKind}.
 *
 * **Example** (Type a pin kind)
 *
 * ```ts
 * import type { OutboxBasisKind } from "@beep/m365-mcp/OutboxBasis"
 *
 * const kind: OutboxBasisKind = "message"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxBasisKind = typeof OutboxBasisKind.Type;

const refId = GraphPathSegment.annotateKey({
  description: "Graph id of the event or message, as a Microsoft 365 read tool returned it.",
});

/**
 * What a caller supplies to pin a draft to one Graph item: its kind, its id,
 * and the named view the caller composed the draft from.
 *
 * **Details**
 *
 * The server reads the item itself and stores its own read, never the
 * caller's view. It compares the caller's view with that read field by field
 * and refuses creation with `basis-changed` when they differ, so a draft
 * written from an earlier state of the item is never pinned to a later one.
 *
 * **Example** (Pin a calendar event as it was read)
 *
 * ```ts
 * import { OutboxBasisPinRef, OutboxEventInstant, OutboxEventView } from "@beep/m365-mcp/OutboxBasis"
 *
 * const ref = OutboxBasisPinRef.cases.event.make({
 *   id: "event-id",
 *   view: OutboxEventView.make({
 *     end: OutboxEventInstant.make({ dateTime: "2030-01-15T10:00:00.0000000", timeZone: "UTC" }),
 *     isAllDay: false,
 *     isCancelled: false,
 *     start: OutboxEventInstant.make({ dateTime: "2030-01-15T09:00:00.0000000", timeZone: "UTC" }),
 *     subject: "Hearing"
 *   })
 * })
 * console.log(ref.kind)
 * // "event"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export const OutboxBasisPinRef = OutboxBasisKind.toTaggedUnion("kind")({
  event: {
    id: refId,
    view: OutboxEventView.annotateKey({
      description: "The event as the caller read it: subject, start, end, all-day and cancelled flags.",
    }),
  },
  message: {
    id: refId,
    view: OutboxMessageView.annotateKey({
      description: "The message as the caller read it: its message id and the newest later reply it saw.",
    }),
  },
}).pipe(
  $I.annoteSchema("OutboxBasisPinRef", {
    description: "A Graph item a draft rests on, named by kind and id, with the view the caller composed from.",
  })
);

/**
 * Type for {@link OutboxBasisPinRef}.
 *
 * **Example** (Read a pin reference's kind)
 *
 * ```ts
 * import type { OutboxBasisPinRef } from "@beep/m365-mcp/OutboxBasis"
 *
 * const kindOf = (ref: OutboxBasisPinRef) => ref.kind
 * console.log(typeof kindOf)
 * // "function"
 * ```
 *
 * @category tool-schemas
 * @since 0.1.0
 */
export type OutboxBasisPinRef = typeof OutboxBasisPinRef.Type;

const pinStamp = {
  changeKey: S.OptionFromOptionalKey(S.NonEmptyString).annotateKey({
    description: "Graph change key observed with the view; recorded for audit, never compared.",
  }),
  id: S.NonEmptyString.annotateKey({ description: "Graph id of the item when it was pinned." }),
  observedAt: S.DateTimeUtcFromString.annotateKey({ description: "When the view was read (UTC, ISO-8601)." }),
};

/**
 * What a fresh read observes of one Graph item, by kind.
 *
 * **Example** (Observe a message)
 *
 * ```ts
 * import { OutboxBasisObservation, OutboxMessageView } from "@beep/m365-mcp/OutboxBasis"
 * import * as O from "effect/Option"
 *
 * const now = OutboxBasisObservation.cases.message.make({
 *   view: OutboxMessageView.make({ internetMessageId: "<request@example.test>", newestOtherReply: O.none() })
 * })
 * console.log(now.kind)
 * // "message"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxBasisObservation = OutboxBasisKind.toTaggedUnion("kind")({
  event: { view: OutboxEventView },
  message: { view: OutboxMessageView },
}).pipe($I.annoteSchema("OutboxBasisObservation", { description: "The named view of one Graph item, by kind." }));

/**
 * Type for {@link OutboxBasisObservation}.
 *
 * **Example** (Read an observation's kind)
 *
 * ```ts
 * import type { OutboxBasisObservation } from "@beep/m365-mcp/OutboxBasis"
 *
 * const kindOf = (now: OutboxBasisObservation) => now.kind
 * console.log(typeof kindOf)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxBasisObservation = typeof OutboxBasisObservation.Type;

/**
 * One Graph item a draft rested on, with the view observed when the draft was
 * created.
 *
 * **Details**
 *
 * A message pin also stores the message's `conversationId`. Like the id, it
 * is a lookup key and never compared: the recheck lists the conversation and
 * finds the pinned message by its RFC 5322 message id, so a message moved to
 * another folder, which gets a new Graph id, is still found.
 *
 * **Example** (Pin an event)
 *
 * ```ts
 * import { OutboxBasisPin, OutboxEventInstant, OutboxEventView } from "@beep/m365-mcp/OutboxBasis"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const pin = OutboxBasisPin.cases.event.make({
 *   changeKey: O.none(),
 *   id: "event-id",
 *   observedAt: DateTime.makeUnsafe("2030-01-10T12:00:00Z"),
 *   view: OutboxEventView.make({
 *     end: OutboxEventInstant.make({ dateTime: "2030-01-15T10:00:00.0000000", timeZone: "UTC" }),
 *     isAllDay: false,
 *     isCancelled: false,
 *     start: OutboxEventInstant.make({ dateTime: "2030-01-15T09:00:00.0000000", timeZone: "UTC" }),
 *     subject: "Response due"
 *   })
 * })
 * console.log(pin.kind)
 * // "event"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxBasisPin = OutboxBasisKind.toTaggedUnion("kind")({
  event: { ...pinStamp, view: OutboxEventView },
  message: {
    ...pinStamp,
    conversationId: S.NonEmptyString.annotateKey({
      description: "Graph id of the message's conversation; a lookup key, never compared.",
    }),
    view: OutboxMessageView,
  },
}).pipe(
  $I.annoteSchema("OutboxBasisPin", { description: "One Graph item a draft rested on, with the view observed then." })
);

/**
 * Type for {@link OutboxBasisPin}.
 *
 * **Example** (Read a pin's id)
 *
 * ```ts
 * import type { OutboxBasisPin } from "@beep/m365-mcp/OutboxBasis"
 *
 * const idOf = (pin: OutboxBasisPin) => pin.id
 * console.log(typeof idOf)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxBasisPin = typeof OutboxBasisPin.Type;

/**
 * A named view field that differs now.
 *
 * **Example** (Guard a changed field)
 *
 * ```ts
 * import { OutboxBasisChangedField } from "@beep/m365-mcp/OutboxBasis"
 *
 * console.log(OutboxBasisChangedField.is.start("start"))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxBasisChangedField = LiteralKit([
  "subject",
  "start",
  "end",
  "isAllDay",
  "isCancelled",
  "internetMessageId",
  "newestOtherReply",
]).pipe($I.annoteSchema("OutboxBasisChangedField", { description: "A named view field that differs now." }));

/**
 * Type for {@link OutboxBasisChangedField}.
 *
 * **Example** (Type a changed field)
 *
 * ```ts
 * import type { OutboxBasisChangedField } from "@beep/m365-mcp/OutboxBasis"
 *
 * const field: OutboxBasisChangedField = "newestOtherReply"
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxBasisChangedField = typeof OutboxBasisChangedField.Type;

/**
 * What a fresh read says about one pin.
 *
 * **Details**
 *
 * `Current`: every named field is as pinned. `Changed`: the named fields that
 * differ, and the fresh observation. `Gone`: the item no longer exists.
 * `Unreadable`: Graph could not be asked, with a redacted reason.
 *
 * **Example** (Report an unreadable pin)
 *
 * ```ts
 * import { OutboxBasisStatus } from "@beep/m365-mcp/OutboxBasis"
 *
 * const status = OutboxBasisStatus.cases.Unreadable.make({ reason: "throttled" })
 * console.log(status._tag)
 * // "Unreadable"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxBasisStatus = S.TaggedUnion({
  Changed: {
    fields: S.NonEmptyArray(OutboxBasisChangedField).annotateKey({
      description: "The named fields that differ, in a fixed order, each at most once.",
    }),
    now: OutboxBasisObservation.annotateKey({ description: "The view as read now." }),
  },
  Current: {},
  Gone: {},
  Unreadable: {
    reason: S.NonEmptyString.annotateKey({ description: "Redacted reason the item could not be read." }),
  },
}).pipe($I.annoteSchema("OutboxBasisStatus", { description: "What a fresh read says about one pin." }));

/**
 * Type for {@link OutboxBasisStatus}.
 *
 * **Example** (Read a status tag)
 *
 * ```ts
 * import type { OutboxBasisStatus } from "@beep/m365-mcp/OutboxBasis"
 *
 * const tagOf = (status: OutboxBasisStatus) => status._tag
 * console.log(typeof tagOf)
 * // "function"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxBasisStatus = typeof OutboxBasisStatus.Type;

/**
 * Overall basis verdict of one draft.
 *
 * **Details**
 *
 * `unpinned`: the draft has no pin. `pinned-stale`: a pin changed or is gone.
 * `pinned-unverified`: no pin is stale, but one could not be read.
 * `pinned-current`: every pin is as it was.
 *
 * **Example** (Guard a verdict)
 *
 * ```ts
 * import { OutboxBasisVerdict } from "@beep/m365-mcp/OutboxBasis"
 *
 * console.log(OutboxBasisVerdict.is["pinned-stale"]("pinned-stale"))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxBasisVerdict = LiteralKit(["unpinned", "pinned-current", "pinned-stale", "pinned-unverified"]).pipe(
  $I.annoteSchema("OutboxBasisVerdict", { description: "Overall basis verdict of one draft." })
);

/**
 * Type for {@link OutboxBasisVerdict}.
 *
 * **Example** (Type a verdict)
 *
 * ```ts
 * import type { OutboxBasisVerdict } from "@beep/m365-mcp/OutboxBasis"
 *
 * const verdict: OutboxBasisVerdict = "pinned-current"
 * console.log(verdict)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxBasisVerdict = typeof OutboxBasisVerdict.Type;

/**
 * Basis report of one draft: each pin with its status, and the verdict.
 *
 * **Example** (Report an unpinned draft)
 *
 * ```ts
 * import { OutboxBasisReport } from "@beep/m365-mcp/OutboxBasis"
 *
 * const report = OutboxBasisReport.make({ pins: [], verdict: "unpinned" })
 * console.log(report.verdict)
 * // "unpinned"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxBasisReport extends S.Opaque<OutboxBasisReport, { readonly brand: unique symbol }>()(
  S.Struct({
    pins: S.Array(
      S.Struct({
        pin: OutboxBasisPin.annotateKey({ description: "The pin as recorded when the draft was created." }),
        status: OutboxBasisStatus.annotateKey({ description: "What a fresh read says about it." }),
      })
    ).annotateKey({ description: "Each pin of the draft with its status, in recorded order." }),
    verdict: OutboxBasisVerdict.annotateKey({ description: "Overall verdict over the pins." }),
  }).pipe($I.annoteSchema("OutboxBasisReport", { description: "Basis report of one draft." }))
) {}

/**
 * The `basis` field of the `draft-created` audit record.
 *
 * **Details**
 *
 * A record written before pins existed has no such key and decodes to an
 * empty basis, so every earlier record stays readable.
 *
 * **Example** (Declare a record field)
 *
 * ```ts
 * import { basisField } from "@beep/m365-mcp/OutboxBasis"
 * import * as S from "effect/Schema"
 *
 * const Record = S.Struct({ basis: basisField })
 * console.log(S.decodeUnknownSync(Record)({}).basis.length)
 * // 0
 * ```
 *
 * @category schemas
 * @since 0.1.0
 */
export const basisField = emptyByDefault(OutboxBasisPin, "Graph items the draft rested on; empty when unpinned.");

/**
 * Which step of reading a pin failed.
 *
 * **Details**
 *
 * `basis-unreadable`: the item could not be read, or lacks a field the view
 * needs. `basis-series-master`: the item is a recurring series master, which
 * cannot be pinned. `basis-changed`: the item no longer matches the view the
 * caller composed the draft from.
 *
 * **Example** (Guard a basis failure reason)
 *
 * ```ts
 * import { OutboxBasisErrorReason } from "@beep/m365-mcp/OutboxBasis"
 *
 * console.log(OutboxBasisErrorReason.is["basis-series-master"]("basis-series-master"))
 * // true
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export const OutboxBasisErrorReason = LiteralKit(["basis-unreadable", "basis-series-master", "basis-changed"]).pipe(
  $I.annoteSchema("OutboxBasisErrorReason", { description: "Why a pin could not be observed." })
);

/**
 * Type for {@link OutboxBasisErrorReason}.
 *
 * **Example** (Type a basis failure reason)
 *
 * ```ts
 * import type { OutboxBasisErrorReason } from "@beep/m365-mcp/OutboxBasis"
 *
 * const reason: OutboxBasisErrorReason = "basis-unreadable"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export type OutboxBasisErrorReason = typeof OutboxBasisErrorReason.Type;

/**
 * Typed failure of observing a pin.
 *
 * **Details**
 *
 * `fields` names the view fields that differ when the reason is
 * `basis-changed`, and is empty otherwise.
 *
 * **Example** (Construct a basis failure)
 *
 * ```ts
 * import { OutboxBasisError } from "@beep/m365-mcp/OutboxBasis"
 *
 * const error = OutboxBasisError.make({
 *   message: "A pinned event is a recurring series master, which cannot be pinned.",
 *   reason: "basis-series-master"
 * })
 * console.log(error.reason)
 * // "basis-series-master"
 * ```
 *
 * @category errors
 * @since 0.1.0
 */
export class OutboxBasisError extends S.TaggedError<OutboxBasisError, { readonly brand: unique symbol }>(
  $I`OutboxBasisError`
)(
  "OutboxBasisError",
  {
    fields: emptyByDefault(
      OutboxBasisChangedField,
      "The view fields that differ from the caller's view; empty unless the reason is basis-changed."
    ),
    message: S.String.annotateKey({ description: "Human-readable failure; never item content." }),
    reason: OutboxBasisErrorReason.annotateKey({ description: "Which step failed." }),
  },
  $I.annoteError<OutboxBasisError>("OutboxBasisError", {
    description: "Typed failure of observing a Graph item a draft rests on.",
  })
) {}

const nonEmpty = O.filter(Str.isNonEmpty);

const instantOf: (value: O.Option<GraphDateTimeTimeZone>) => O.Option<OutboxEventInstant> = flow(
  O.flatMap((pair) => O.all({ dateTime: nonEmpty(pair.dateTime), timeZone: nonEmpty(pair.timeZone) })),
  O.map(OutboxEventInstant.make)
);

/**
 * The named view of an event as Graph returned it.
 *
 * **Details**
 *
 * `Option.none` when the event lacks a start or an end. A missing subject is
 * `""`, and a missing all-day or cancelled flag is `false`. Start and end are
 * kept exactly as returned, with no zone conversion.
 *
 * **Example** (View an event)
 *
 * ```ts
 * import { GraphDateTimeTimeZone, GraphEvent } from "@beep/m365"
 * import { eventViewOf } from "@beep/m365-mcp/OutboxBasis"
 * import * as O from "effect/Option"
 *
 * const at = (dateTime: string) => O.some(GraphDateTimeTimeZone.make({ dateTime: O.some(dateTime), timeZone: O.some("UTC") }))
 * const view = eventViewOf(
 *   GraphEvent.make({ end: at("2030-01-15T10:00:00.0000000"), id: "event-id", start: at("2030-01-15T09:00:00.0000000") })
 * )
 * console.log(O.map(view, (found) => found.subject))
 * // Option.some("")
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const eventViewOf = (event: GraphEvent): O.Option<OutboxEventView> =>
  pipe(
    O.all({ end: instantOf(event.end), start: instantOf(event.start) }),
    O.map(({ end, start }) =>
      OutboxEventView.make({
        end,
        isAllDay: O.getOrElse(event.isAllDay, constFalse),
        isCancelled: O.getOrElse(event.isCancelled, constFalse),
        start,
        subject: O.getOrElse(event.subject, () => ""),
      })
    )
  );

const normalizeAddress = flow(Str.trim, Str.toLowerCase);

const fromAddress = (message: GraphMessage): O.Option<string> =>
  pipe(
    message.from,
    O.flatMap((from) => from.emailAddress),
    O.flatMap((emailAddress) => emailAddress.address)
  );

const receivedAt = (message: GraphMessage): O.Option<DateTime.Utc> =>
  O.flatMap(message.receivedDateTime, (received) => DateTime.make(received));

const byReceipt = Order.mapInput(DateTime.Order, ([at]: readonly [DateTime.Utc, string]) => at);

const newestOtherReplyIn = (
  page: ReadonlyArray<GraphMessage>,
  pinned: GraphMessage,
  mailbox: string
): O.Option<string> => {
  const self = normalizeAddress(mailbox);
  // A pinned message without a receipt time sorts before every other message.
  const isLater = (at: DateTime.Utc): boolean =>
    O.match(receivedAt(pinned), { onNone: () => true, onSome: (pinnedAt) => DateTime.isGreaterThan(at, pinnedAt) });
  const isOtherSender = (message: GraphMessage): boolean =>
    !O.exists(fromAddress(message), (address) => normalizeAddress(address) === self);
  const candidates = pipe(
    A.filter(page, (message) => !O.contains(message.isDraft, true) && isOtherSender(message)),
    A.map((message) => O.all([receivedAt(message), nonEmpty(message.internetMessageId)])),
    A.getSomes,
    A.filter(([at]) => isLater(at))
  );

  return A.match(candidates, {
    onEmpty: O.none,
    onNonEmpty: (found) => O.some(A.max(found, byReceipt)[1]),
  });
};

/**
 * The named view of a pinned message, from one page of its conversation.
 *
 * **Details**
 *
 * The pinned message is found in the page by its RFC 5322 message id;
 * `Option.none` when it is not there. `newestOtherReply` is the message id of
 * the newest message in the page that is not a draft, was received after the
 * pinned message and whose sender is not the mailbox, compared ignoring case.
 * A message without a sender counts as another sender, and a message without
 * a readable receipt time is never a reply. Receipt times are compared as
 * instants.
 *
 * **Example** (Find a later reply)
 *
 * ```ts
 * import { GraphEmailAddress, GraphMessage, GraphRecipient } from "@beep/m365"
 * import { messageViewOf } from "@beep/m365-mcp/OutboxBasis"
 * import * as O from "effect/Option"
 *
 * const from = (address: string) =>
 *   O.some(GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({ address: O.some(address) })) }))
 * const page = [
 *   GraphMessage.make({
 *     from: from("counsel@example.test"),
 *     id: "m-1",
 *     internetMessageId: O.some("<request@example.test>"),
 *     receivedDateTime: O.some("2030-01-10T09:00:00Z")
 *   }),
 *   GraphMessage.make({
 *     from: from("counsel@example.test"),
 *     id: "m-2",
 *     internetMessageId: O.some("<follow-up@example.test>"),
 *     receivedDateTime: O.some("2030-01-11T09:00:00Z")
 *   })
 * ]
 * const view = messageViewOf(page, { internetMessageId: "<request@example.test>", mailbox: "mailbox@example.test" })
 * console.log(O.flatMap(view, (found) => found.newestOtherReply))
 * // Option.some("<follow-up@example.test>")
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const messageViewOf: {
  (pinned: {
    readonly internetMessageId: string;
    readonly mailbox: string;
  }): (page: ReadonlyArray<GraphMessage>) => O.Option<OutboxMessageView>;
  (
    page: ReadonlyArray<GraphMessage>,
    pinned: { readonly internetMessageId: string; readonly mailbox: string }
  ): O.Option<OutboxMessageView>;
} = dual(
  2,
  (
    page: ReadonlyArray<GraphMessage>,
    pinned: { readonly internetMessageId: string; readonly mailbox: string }
  ): O.Option<OutboxMessageView> =>
    pipe(
      O.liftPredicate(pinned.internetMessageId, Str.isNonEmpty),
      O.flatMap((internetMessageId) =>
        A.findFirst(page, (message) => O.contains(message.internetMessageId, internetMessageId))
      ),
      O.map((message) =>
        OutboxMessageView.make({
          internetMessageId: pinned.internetMessageId,
          newestOtherReply: newestOtherReplyIn(page, message, pinned.mailbox),
        })
      )
    )
);

type FieldTest<View> = readonly [OutboxBasisChangedField, (pinned: View, now: View) => boolean];

const sameInstant = S.toEquivalence(OutboxEventInstant);

const EVENT_FIELDS: ReadonlyArray<FieldTest<OutboxEventView>> = [
  ["subject", (pinned, now) => pinned.subject === now.subject],
  ["start", (pinned, now) => sameInstant(pinned.start, now.start)],
  ["end", (pinned, now) => sameInstant(pinned.end, now.end)],
  ["isAllDay", (pinned, now) => pinned.isAllDay === now.isAllDay],
  ["isCancelled", (pinned, now) => pinned.isCancelled === now.isCancelled],
];

const MESSAGE_FIELDS: ReadonlyArray<FieldTest<OutboxMessageView>> = [
  ["internetMessageId", (pinned, now) => pinned.internetMessageId === now.internetMessageId],
  ["newestOtherReply", (pinned, now) => Equal.equals(pinned.newestOtherReply, now.newestOtherReply)],
];

const differing = <View>(
  tests: ReadonlyArray<FieldTest<View>>,
  pinned: View,
  now: View
): ReadonlyArray<OutboxBasisChangedField> =>
  pipe(
    A.filter(tests, ([, same]) => !same(pinned, now)),
    A.map(([field]) => field)
  );

const fieldNames = <View>(tests: ReadonlyArray<FieldTest<View>>): ReadonlyArray<OutboxBasisChangedField> =>
  A.map(tests, ([field]) => field);

// An observation of the other kind cannot come from the reader; it differs in every field.
const changedFields = (pin: OutboxBasisPin, now: OutboxBasisObservation): ReadonlyArray<OutboxBasisChangedField> =>
  OutboxBasisPin.match(pin, {
    event: (pinned) =>
      OutboxBasisObservation.match(now, {
        event: (observed) => differing(EVENT_FIELDS, pinned.view, observed.view),
        message: () => fieldNames(EVENT_FIELDS),
      }),
    message: (pinned) =>
      OutboxBasisObservation.match(now, {
        event: () => fieldNames(MESSAGE_FIELDS),
        message: (observed) => differing(MESSAGE_FIELDS, pinned.view, observed.view),
      }),
  });

/**
 * Compare a pin with a fresh observation of the same item.
 *
 * **Details**
 *
 * One predicate per named field; start and end compare with the equivalence
 * of {@link OutboxEventInstant}. A field outside the view (a category, a
 * reminder, the change key) cannot produce `Changed`. The result is `Current`
 * when every named field is equal, and otherwise `Changed` with the differing
 * fields and the observation.
 *
 * **Example** (Detect a moved event)
 *
 * ```ts
 * import {
 *   compareBasisPin,
 *   OutboxBasisObservation,
 *   OutboxBasisPin,
 *   OutboxEventInstant,
 *   OutboxEventView
 * } from "@beep/m365-mcp/OutboxBasis"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const at = (dateTime: string) => OutboxEventInstant.make({ dateTime, timeZone: "UTC" })
 * const view = (start: string) =>
 *   OutboxEventView.make({ end: at("2030-01-15T10:00:00"), isAllDay: false, isCancelled: false, start: at(start), subject: "Hearing" })
 * const pin = OutboxBasisPin.cases.event.make({
 *   changeKey: O.none(),
 *   id: "event-id",
 *   observedAt: DateTime.makeUnsafe("2030-01-10T12:00:00Z"),
 *   view: view("2030-01-15T09:00:00")
 * })
 * const status = compareBasisPin(pin, OutboxBasisObservation.cases.event.make({ view: view("2030-01-15T08:00:00") }))
 * console.log(status._tag === "Changed" ? status.fields : [])
 * // ["start"]
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const compareBasisPin: {
  (now: OutboxBasisObservation): (pin: OutboxBasisPin) => OutboxBasisStatus;
  (pin: OutboxBasisPin, now: OutboxBasisObservation): OutboxBasisStatus;
} = dual(
  2,
  (pin: OutboxBasisPin, now: OutboxBasisObservation): OutboxBasisStatus =>
    pipe(
      changedFields(pin, now),
      A.match({
        onEmpty: (): OutboxBasisStatus => OutboxBasisStatus.cases.Current.make({}),
        onNonEmpty: (fields): OutboxBasisStatus => OutboxBasisStatus.cases.Changed.make({ fields, now }),
      })
    )
);

const isStale = OutboxBasisStatus.isAnyOf(["Changed", "Gone"]);

const anyStale = (statuses: ReadonlyArray<OutboxBasisStatus>): boolean => A.some(statuses, isStale);

const anyUnreadable = (statuses: ReadonlyArray<OutboxBasisStatus>): boolean =>
  A.some(statuses, OutboxBasisStatus.guards.Unreadable);

/**
 * The verdict over the statuses of a draft's pins.
 *
 * **Details**
 *
 * No pins: `unpinned`. Any `Changed` or `Gone`: `pinned-stale`. Otherwise any
 * `Unreadable`: `pinned-unverified`. Otherwise `pinned-current`.
 *
 * **Example** (A failed read is not current)
 *
 * ```ts
 * import { basisVerdict, OutboxBasisStatus } from "@beep/m365-mcp/OutboxBasis"
 *
 * console.log(
 *   basisVerdict([OutboxBasisStatus.cases.Current.make({}), OutboxBasisStatus.cases.Unreadable.make({ reason: "transport" })])
 * )
 * // "pinned-unverified"
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const basisVerdict = (statuses: ReadonlyArray<OutboxBasisStatus>): OutboxBasisVerdict =>
  Match.value(statuses).pipe(
    Match.when(A.isReadonlyArrayEmpty, (): OutboxBasisVerdict => "unpinned"),
    Match.when(anyStale, (): OutboxBasisVerdict => "pinned-stale"),
    Match.when(anyUnreadable, (): OutboxBasisVerdict => "pinned-unverified"),
    Match.orElse((): OutboxBasisVerdict => "pinned-current")
  );

/**
 * The basis report of a draft: its pins paired with their statuses, in order,
 * and the verdict over them.
 *
 * **Example** (Report a draft with no pins)
 *
 * ```ts
 * import { makeBasisReport } from "@beep/m365-mcp/OutboxBasis"
 *
 * console.log(makeBasisReport([], []).verdict)
 * // "unpinned"
 * ```
 *
 * @category constructors
 * @since 0.1.0
 */
export const makeBasisReport: {
  (statuses: ReadonlyArray<OutboxBasisStatus>): (pins: ReadonlyArray<OutboxBasisPin>) => OutboxBasisReport;
  (pins: ReadonlyArray<OutboxBasisPin>, statuses: ReadonlyArray<OutboxBasisStatus>): OutboxBasisReport;
} = dual(
  2,
  (pins: ReadonlyArray<OutboxBasisPin>, statuses: ReadonlyArray<OutboxBasisStatus>): OutboxBasisReport =>
    OutboxBasisReport.make({
      pins: A.zipWith(pins, statuses, (pin, status) => ({ pin, status })),
      verdict: basisVerdict(statuses),
    })
);
