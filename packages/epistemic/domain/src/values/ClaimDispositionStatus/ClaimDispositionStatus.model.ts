/**
 * Claim disposition status vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $EpistemicDomainId.create("values/ClaimDispositionStatus/ClaimDispositionStatus.model");

const ClaimDispositionStatusBase = LiteralKit(["active", "rejected", "superseded"]);

/**
 * Status of a durable claim disposition. The vocabulary is deliberately three
 * members: a disposition is either the standing one (`active`), a recorded
 * rejection (`rejected`), or displaced by a later disposition (`superseded`).
 * There is no `conflicted` member — an unresolved conflict is not a disposition.
 *
 * @example
 * ```ts
 * import { ClaimDispositionStatus } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(ClaimDispositionStatus)("rejected")
 * console.log(status)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimDispositionStatus = ClaimDispositionStatusBase.pipe(
  $I.annoteSchema("ClaimDispositionStatus", {
    description: "Status of a durable claim disposition.",
  }),
  SchemaUtils.withLiteralKitStatics(ClaimDispositionStatusBase)
);

/**
 * Runtime type for {@link ClaimDispositionStatus}.
 *
 * @example
 * ```ts
 * import type { ClaimDispositionStatus } from "@beep/epistemic-domain"
 *
 * const status = "active" satisfies ClaimDispositionStatus
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimDispositionStatus = typeof ClaimDispositionStatus.Type;
