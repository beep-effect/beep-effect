/**
 * Ontology session typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";
import { SessionId } from "./Session.values.js";

const { $OntologyDomainId } = makeIdentity("ontology-domain");
const $I = $OntologyDomainId.create("aggregates/Session/Session.errors");

/**
 * Reasons an ontology session change can be rejected.
 *
 * @example
 * ```ts
 * import { SessionChangeRejectedReason } from "@beep/ontology-domain/aggregates/Session"
 *
 * const reason = SessionChangeRejectedReason.make("invalidChange")
 *
 * console.log(reason)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export const SessionChangeRejectedReason = LiteralKit(["unknownPartition", "invalidChange"]).pipe(
  $I.annoteSchema("SessionChangeRejectedReason", {
    description: "Reason an ontology session change was rejected.",
  })
);

/**
 * Type for {@link SessionChangeRejectedReason}.
 *
 * @example
 * ```ts
 * import { SessionChangeRejectedReason } from "@beep/ontology-domain/aggregates/Session"
 *
 * const reason: SessionChangeRejectedReason = "unknownPartition"
 *
 * console.log(reason)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export type SessionChangeRejectedReason = typeof SessionChangeRejectedReason.Type;

/**
 * Typed domain error for rejected ontology session changes.
 *
 * @example
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
 * @since 0.0.0
 * @category errors
 */
export class SessionChangeRejected extends TaggedErrorClass<SessionChangeRejected>($I`SessionChangeRejected`)(
  "SessionChangeRejected",
  {
    sessionId: SessionId,
    reason: SessionChangeRejectedReason,
    message: S.String,
  },
  $I.annote("SessionChangeRejected", {
    description: "Typed domain error for rejected ontology session changes.",
  })
) {}
