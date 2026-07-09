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
 * @since 0.0.0
 * @category errors
 */
export type SessionChangeRejectedReason = typeof SessionChangeRejectedReason.Type;

/**
 * Typed domain error for rejected ontology session changes.
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
