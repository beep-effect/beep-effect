import * as Domain from "@alchemy.run/domain";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { Proposition } from "../Proposition.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

/**
 * The bar a proposition's evidence must clear before it may be accepted.
 * (`LiteralKit` in the design; `S.Literals` here, since the prototype does
 * not depend on `@beep/schema`.)
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionGate = S.Literals(["independent-corroboration", "source-support"]);
/**
 * @category models
 * @since 0.0.0
 */
export type AdmissionGate = typeof AdmissionGate.Type;

/**
 * Refused: the evidence does not clear the gate this proposition needs.
 *
 * @category rejections
 * @since 0.0.0
 */
export class AdmissionGateUnmet extends Domain.Rejection(
  "AdmissionGateUnmet",
  { gate: AdmissionGate, have: S.Int, need: S.Int },
  { httpApiStatus: 422, description: "The claim's evidence does not clear its admission gate." },
) {}

/**
 * The fact, with the invocation it ran under. Phase 3 removed its
 * `corroboration` (D22): older stored events still carry the key, and a read
 * ignores it.
 *
 * @category events
 * @since 0.0.0
 */
export class ClaimAccepted extends Domain.Event("ClaimAccepted", carry({ proposition: Proposition })) {}

/**
 * Accept a pending claim once its admission gate is met.
 *
 * @category commands
 * @since 0.0.0
 */
export class AcceptClaim extends Domain.Command(
  "AcceptClaim",
  {
    target: ClaimId,
    middleware: [Session],
    events: [ClaimAccepted],
    rejects: [ClaimNotPending, MissingGrant, AdmissionGateUnmet],
  },
  { description: "Accept a pending claim once its admission gate is met." },
) {}
