/**
 * The event update guard of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * Graph mails every attendee of a meeting when its subject, body or time
 * changes. That is a send outside the send guard and the audit pairing, so an
 * update is allowed only for an event this server recorded creating and that
 * has no attendee. {@link checkEventUpdate} decides that from the audit
 * answer and the event as Graph stores it. It is a pure function: it reads
 * nothing and writes nothing.
 *
 * @category guards
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { GraphEvent } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $M365McpId.create("OutboxEventGuard");

/**
 * Why an event update is refused.
 *
 * **Details**
 *
 * `not-created-here`: this server has no record of creating the event.
 * `has-attendees`: the event has at least one attendee, so Graph would mail
 * them about the change.
 *
 * **Example** (Guard a refusal reason)
 *
 * ```ts
 * import { OutboxEventUpdateRefusalReason } from "@beep/m365-mcp/OutboxEventGuard"
 *
 * console.log(OutboxEventUpdateRefusalReason.is["has-attendees"]("has-attendees"))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxEventUpdateRefusalReason = LiteralKit(["not-created-here", "has-attendees"]).pipe(
  $I.annoteSchema("OutboxEventUpdateRefusalReason", { description: "Why the outbox refuses to update an event." })
);

/**
 * Type for {@link OutboxEventUpdateRefusalReason}.
 *
 * **Example** (Type a refusal reason)
 *
 * ```ts
 * import type { OutboxEventUpdateRefusalReason } from "@beep/m365-mcp/OutboxEventGuard"
 *
 * const reason: OutboxEventUpdateRefusalReason = "not-created-here"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxEventUpdateRefusalReason = typeof OutboxEventUpdateRefusalReason.Type;

/**
 * The guard's refusal of an event update.
 *
 * **Example** (Construct a refusal)
 *
 * ```ts
 * import { OutboxEventUpdateRefusal } from "@beep/m365-mcp/OutboxEventGuard"
 *
 * const refusal = OutboxEventUpdateRefusal.make({ attendeeCount: 2, reason: "has-attendees" })
 * console.log(refusal.reason)
 * // "has-attendees"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxEventUpdateRefusal extends S.Class<OutboxEventUpdateRefusal>($I`OutboxEventUpdateRefusal`)(
  {
    attendeeCount: S.Natural.annotateKey({ description: "How many attendees the stored event has." }),
    reason: OutboxEventUpdateRefusalReason.annotateKey({ description: "The first rule the update breaks." }),
  },
  $I.annote("OutboxEventUpdateRefusal", {
    description: "Refusal of the event update guard, naming the rule the update breaks.",
  })
) {}

/**
 * Everything the event update guard reads: whether the audit log holds an
 * `event-created` record for the event, and the event as Graph stores it.
 *
 * **Example** (Assemble a guard input)
 *
 * ```ts
 * import { GraphEvent } from "@beep/m365"
 * import { OutboxEventUpdateCheck } from "@beep/m365-mcp/OutboxEventGuard"
 *
 * const check = OutboxEventUpdateCheck.make({ createdHere: true, event: GraphEvent.make({ id: "event-id" }) })
 * console.log(check.createdHere)
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxEventUpdateCheck extends S.Class<OutboxEventUpdateCheck>($I`OutboxEventUpdateCheck`)(
  {
    createdHere: S.Boolean.annotateKey({
      description: "Whether the audit log holds an event-created record for this event id.",
    }),
    event: GraphEvent.annotateKey({ description: "The event as Graph stores it, read before the update." }),
  },
  $I.annote("OutboxEventUpdateCheck", { description: "Input of the event update guard." })
) {}

/**
 * How many attendees a stored event has. An absent list is empty.
 *
 * **Example** (Count attendees)
 *
 * ```ts
 * import { GraphEvent, GraphEventAttendee } from "@beep/m365"
 * import { storedAttendeeCount } from "@beep/m365-mcp/OutboxEventGuard"
 * import * as O from "effect/Option"
 *
 * console.log(storedAttendeeCount(GraphEvent.make({ id: "event-id" })))
 * // 0
 * console.log(
 *   storedAttendeeCount(GraphEvent.make({ attendees: O.some([GraphEventAttendee.make({})]), id: "event-id" }))
 * )
 * // 1
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const storedAttendeeCount = (event: GraphEvent): number =>
  pipe(
    event.attendees,
    O.map(A.length),
    O.getOrElse(() => 0)
  );

/**
 * Decide whether an event may be updated.
 *
 * **Details**
 *
 * The result is `Option.none` when the update may go ahead, and otherwise the
 * first rule it breaks, in this order:
 *
 * - `not-created-here`: the server has no record of creating the event;
 * - `has-attendees`: the stored event has at least one attendee, whatever the
 *   attendee's type and whether or not it carries an address.
 *
 * **Example** (Refuse an event that gained an attendee)
 *
 * ```ts
 * import { GraphEvent, GraphEventAttendee } from "@beep/m365"
 * import { checkEventUpdate, OutboxEventUpdateCheck } from "@beep/m365-mcp/OutboxEventGuard"
 * import * as O from "effect/Option"
 *
 * const refusal = checkEventUpdate(
 *   OutboxEventUpdateCheck.make({
 *     createdHere: true,
 *     event: GraphEvent.make({ attendees: O.some([GraphEventAttendee.make({})]), id: "event-id" })
 *   })
 * )
 * console.log(O.map(refusal, (found) => found.reason))
 * // Option.some("has-attendees")
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const checkEventUpdate = (check: OutboxEventUpdateCheck): O.Option<OutboxEventUpdateRefusal> => {
  const attendeeCount = storedAttendeeCount(check.event);
  const broken: ReadonlyArray<readonly [OutboxEventUpdateRefusalReason, boolean]> = [
    ["not-created-here", !check.createdHere],
    ["has-attendees", attendeeCount > 0],
  ];

  return pipe(
    A.findFirst(broken, ([, isBroken]) => isBroken),
    O.map(([reason]) => OutboxEventUpdateRefusal.make({ attendeeCount, reason }))
  );
};
