/**
 * Ontology session typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { SessionId } from "./Session.values.ts";

const $I = $OntologyDomainId.create("aggregates/Session/Session.errors");

/**
 * Reasons an ontology session change can be rejected.
 *
 * **Example** (Make invalidChange reason)
 *
 * ```ts
 * import { SessionChangeRejectedReason } from "@beep/ontology-domain/aggregates/Session"
 *
 * const reason = SessionChangeRejectedReason.make("invalidChange")
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SessionChangeRejectedReason = LiteralKit(["unknownPartition", "invalidChange"]).pipe(
  $I.annoteSchema("SessionChangeRejectedReason", {
    description: "Reason an ontology session change was rejected.",
  })
);

/**
 * Type for {@link SessionChangeRejectedReason}.
 *
 * **Example** (Type a rejection reason)
 *
 * ```ts
 * import { SessionChangeRejectedReason } from "@beep/ontology-domain/aggregates/Session"
 *
 * const reason: SessionChangeRejectedReason = "unknownPartition"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type SessionChangeRejectedReason = typeof SessionChangeRejectedReason.Type;

const SessionChangeRejectedFields = {
  sessionId: SessionId,
  reason: SessionChangeRejectedReason,
  message: S.String,
} satisfies S.Struct.Fields;
const sameSessionChangeRejectedFields = S.toEquivalence(
  S.TaggedStruct("SessionChangeRejected", SessionChangeRejectedFields)
);
const sameSessionChangeRejected = (self: SessionChangeRejected, that: SessionChangeRejected): boolean =>
  sameSessionChangeRejectedFields(self, that);

/**
 * Typed domain error for rejected ontology session changes.
 *
 * **Example** (Create SessionChangeRejected error)
 *
 * ```ts
 * import { SessionChangeRejected, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const error = SessionChangeRejected.make({
 *   sessionId: S.decodeUnknownSync(SessionId)("session-1"),
 *   reason: "invalidChange",
 *   message: "The change could not be applied."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SessionChangeRejected extends S.TaggedError<SessionChangeRejected>($I`SessionChangeRejected`)(
  "SessionChangeRejected",
  SessionChangeRejectedFields,
  $I.annoteClass<
    S.declare<SessionChangeRejected>,
    readonly [S.TaggedStruct<"SessionChangeRejected", typeof SessionChangeRejectedFields>]
  >("SessionChangeRejected", {
    description: "Typed domain error for rejected ontology session changes.",

    toEquivalence: () => sameSessionChangeRejected,
  })
) {}
