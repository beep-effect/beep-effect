/**
 * The reader that observes and rechecks the Graph items a draft rests on.
 *
 * **Details**
 *
 * An event is read with one `getEvent`, with no time-zone preference, so
 * Graph returns start and end in UTC every time. A message is read once by
 * its Graph id when it is pinned; after that it is found by its RFC 5322
 * message id in one `listMessages` page of its conversation, because its
 * Graph id changes when it is moved to another folder. No body is selected
 * or kept. Spans carry the pin kind and the outcome only: never an id, a
 * subject or an address.
 *
 * Before a pin is kept, the caller's view of the item is compared with the
 * server's read using the pin comparison. A difference refuses the pin with
 * `basis-changed`: the draft was written from a state the item is no longer
 * in. The pin always stores the server's read.
 *
 * @category services
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import {
  GraphPathSegment,
  M365,
  M365GetEventRequest,
  M365GetMessageRequest,
  M365ListMessagesRequest,
} from "@beep/m365";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { odataEquals } from "./internal/ODataFilter.ts";
import {
  compareBasisPin,
  eventViewOf,
  messageViewOf,
  OutboxBasisError,
  OutboxBasisObservation,
  OutboxBasisPin,
  OutboxBasisPinRef,
  OutboxBasisStatus,
} from "./OutboxBasis.ts";
import type { M365Error } from "@beep/m365";
import type { OutboxBasisErrorReason } from "./OutboxBasis.ts";

const $I = $M365McpId.create("OutboxBasisReader");

const NOT_FOUND_STATUS = 404;
const CONVERSATION_PAGE_SIZE = 500;
const SERIES_MASTER = "seriesMaster";
const CONVERSATION_SELECT = "id,internetMessageId,from,receivedDateTime,isDraft";
const PINNED_MESSAGE_SELECT = "id,internetMessageId,conversationId,changeKey";

/**
 * Basis reader service shape.
 *
 * **Details**
 *
 * `observe` reads an item and builds its pin from that read; it fails when
 * the item cannot be read, is a recurring series master, or no longer
 * matches the view the caller supplied (`basis-changed`, with `fields`). `recheck` never fails: a failed
 * read is the status `Unreadable`.
 *
 * **Example** (Name a reader method)
 *
 * ```ts
 * import type { OutboxBasisReaderShape } from "@beep/m365-mcp/OutboxBasisReader"
 *
 * const method: keyof OutboxBasisReaderShape = "recheck"
 * console.log(method)
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export type OutboxBasisReaderShape = {
  readonly observe: (ref: OutboxBasisPinRef) => Effect.Effect<OutboxBasisPin, OutboxBasisError>;
  readonly recheck: (pin: OutboxBasisPin) => Effect.Effect<OutboxBasisStatus>;
};

const refusal = (reason: OutboxBasisErrorReason, message: string) => (): OutboxBasisError =>
  OutboxBasisError.make({ message, reason });

const unreadable = (what: string) =>
  refusal("basis-unreadable", `A pinned ${what} could not be read, so no draft was created.`);

const nonEmpty = O.filter(Str.isNonEmpty);

// The caller's view as an observation, so the pin comparison can judge it.
const callerObservation = (ref: OutboxBasisPinRef): OutboxBasisObservation =>
  OutboxBasisPinRef.match(ref, {
    event: ({ view }) => OutboxBasisObservation.cases.event.make({ view }),
    message: ({ view }) => OutboxBasisObservation.cases.message.make({ view }),
  });

// Field names only: never a value or any item content.
const changedSinceRead = (kind: string, fields: ReadonlyArray<string>): string =>
  `The pinned ${kind} changed since it was read (${A.join(fields, ", ")}). Read it again and redo the draft; no draft was created.`;

const unreadableStatus = (reason: string): OutboxBasisStatus => OutboxBasisStatus.cases.Unreadable.make({ reason });

const isNotFound = (error: M365Error): boolean =>
  error.reason === "response status" && O.contains(error.status, NOT_FOUND_STATUS);

const decodeSegment = S.decodeUnknownEffect(GraphPathSegment);

const makeReader = Effect.fnUntraced(function* (mailbox: GraphPathSegment) {
  const m365 = yield* M365;
  const userId = O.some(mailbox);

  const readEvent = (eventId: GraphPathSegment) => m365.getEvent(M365GetEventRequest.make({ eventId, userId }));

  // One page of a conversation; `Option.none` when it has more than one page.
  const readConversation = (conversationId: string) =>
    m365
      .listMessages(
        M365ListMessagesRequest.make({
          filter: O.some(odataEquals("conversationId", conversationId)),
          select: O.some(CONVERSATION_SELECT),
          top: O.some(CONVERSATION_PAGE_SIZE),
          userId,
        })
      )
      .pipe(
        Effect.map((page) =>
          O.match(page["@odata.nextLink"], {
            onNone: () => O.some(page.value),
            onSome: () => O.none(),
          })
        )
      );

  const observeEvent = Effect.fnUntraced(function* (id: GraphPathSegment) {
    const event = yield* readEvent(id).pipe(Effect.mapError(unreadable("event")));
    if (O.contains(event.type, SERIES_MASTER)) {
      return yield* refusal(
        "basis-series-master",
        "A pinned event is a recurring series master, which cannot be pinned; pin one occurrence instead."
      )();
    }
    const view = yield* Effect.fromOption(eventViewOf(event), unreadable("event"));
    return OutboxBasisPin.cases.event.make({
      changeKey: nonEmpty(event.changeKey),
      id,
      observedAt: yield* DateTime.now,
      view,
    });
  });

  const observeMessage = Effect.fnUntraced(function* (id: GraphPathSegment) {
    const message = yield* m365
      .getMessage(M365GetMessageRequest.make({ messageId: id, select: O.some(PINNED_MESSAGE_SELECT), userId }))
      .pipe(Effect.mapError(unreadable("message")));
    const { conversationId, internetMessageId } = yield* Effect.fromOption(
      O.all({
        conversationId: nonEmpty(message.conversationId),
        internetMessageId: nonEmpty(message.internetMessageId),
      }),
      unreadable("message")
    );
    const page = yield* readConversation(conversationId).pipe(Effect.mapError(unreadable("message")));
    const view = yield* Effect.fromOption(
      O.flatMap(page, messageViewOf({ internetMessageId, mailbox })),
      unreadable("message")
    );
    return OutboxBasisPin.cases.message.make({
      changeKey: nonEmpty(message.changeKey),
      conversationId,
      id,
      observedAt: yield* DateTime.now,
      view,
    });
  });

  const recheckEvent = (pin: Extract<OutboxBasisPin, { readonly kind: "event" }>): Effect.Effect<OutboxBasisStatus> =>
    decodeSegment(pin.id).pipe(
      Effect.mapError(() => unreadableStatus("invalid-id")),
      Effect.flatMap((eventId) =>
        readEvent(eventId).pipe(
          Effect.mapError((error) =>
            isNotFound(error) ? OutboxBasisStatus.cases.Gone.make({}) : unreadableStatus(error.reason)
          )
        )
      ),
      Effect.flatMap((event) =>
        O.match(eventViewOf(event), {
          onNone: () => Effect.fail(unreadableStatus("incomplete-event")),
          onSome: (view) => Effect.succeed(compareBasisPin(pin, OutboxBasisObservation.cases.event.make({ view }))),
        })
      ),
      Effect.catch(Effect.succeed)
    );

  // Found by message id in the conversation, so a message filed into another folder is not gone.
  const recheckMessage = (
    pin: Extract<OutboxBasisPin, { readonly kind: "message" }>
  ): Effect.Effect<OutboxBasisStatus> =>
    readConversation(pin.conversationId).pipe(
      Effect.mapError((error) => unreadableStatus(error.reason)),
      Effect.flatMap((conversation) =>
        Effect.fromOption(conversation, () => unreadableStatus("conversation-too-long"))
      ),
      Effect.map((page) =>
        O.match(messageViewOf(page, { internetMessageId: pin.view.internetMessageId, mailbox }), {
          onNone: (): OutboxBasisStatus => OutboxBasisStatus.cases.Gone.make({}),
          onSome: (view) => compareBasisPin(pin, OutboxBasisObservation.cases.message.make({ view })),
        })
      ),
      Effect.catch(Effect.succeed)
    );

  return OutboxBasisReader.of({
    observe: Effect.fn("OutboxBasisReader.observe")(function* (ref) {
      yield* Effect.annotateCurrentSpan({ m365_outbox_basis_kind: ref.kind });
      const pin = yield* OutboxBasisPinRef.match(ref, {
        event: ({ id }) => observeEvent(id),
        message: ({ id }) => observeMessage(id),
      });
      const status = compareBasisPin(pin, callerObservation(ref));
      if (OutboxBasisStatus.guards.Changed(status)) {
        return yield* OutboxBasisError.make({
          fields: status.fields,
          message: changedSinceRead(ref.kind, status.fields),
          reason: "basis-changed",
        });
      }
      return pin;
    }),
    recheck: Effect.fn("OutboxBasisReader.recheck")(function* (pin) {
      const status = yield* OutboxBasisPin.match(pin, { event: recheckEvent, message: recheckMessage });
      yield* Effect.annotateCurrentSpan({ m365_outbox_basis_kind: pin.kind, m365_outbox_basis_status: status._tag });
      return status;
    }),
  });
});

/**
 * Observes and rechecks the Graph items outbox drafts rest on, in one
 * mailbox.
 *
 * **Example** (Provide a scripted reader)
 *
 * ```ts
 * import { OutboxBasisStatus } from "@beep/m365-mcp/OutboxBasis"
 * import { OutboxBasisReader } from "@beep/m365-mcp/OutboxBasisReader"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const layer = Layer.succeed(
 *   OutboxBasisReader,
 *   OutboxBasisReader.of({
 *     observe: () => Effect.die("not scripted"),
 *     recheck: () => Effect.succeed(OutboxBasisStatus.cases.Current.make({}))
 *   })
 * )
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category services
 * @since 0.1.0
 */
export class OutboxBasisReader extends Context.Service<OutboxBasisReader, OutboxBasisReaderShape>()(
  $I`OutboxBasisReader`
) {
  /**
   * The reader over the Microsoft 365 driver, bound to one mailbox.
   *
   * **Details**
   *
   * The mailbox is also what "another sender" is compared with: a message
   * whose sender address equals it, ignoring case, is not a reply. A mailbox
   * configured as a directory object id matches no sender.
   *
   * **Example** (Build the reader layer)
   *
   * ```ts
   * import { OutboxBasisReader } from "@beep/m365-mcp/OutboxBasisReader"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(OutboxBasisReader.layer("mailbox@example.test")))
   * // true
   * ```
   *
   * @category layers
   * @since 0.1.0
   */
  static readonly layer = (mailbox: GraphPathSegment): Layer.Layer<OutboxBasisReader, never, M365> =>
    Layer.effect(OutboxBasisReader, makeReader(mailbox));
}
