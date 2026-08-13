/**
 * Driver-neutral candidate-promotion gate schemas.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

import { $SharedUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedUseCasesId.create("PromotionGate/PromotionGate.schema");

/**
 * Opaque product subject presented to a promotion policy.
 *
 * **Details**
 *
 * The shared contract knows only a stable kind/id pair. A vertical adapter
 * resolves that pair to its own policy scope; the pair never carries legal,
 * financial, or other vertical-specific fields.
 *
 * **Example** (Identify an application candidate)
 *
 * ```ts
 * import { PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate"
 *
 * const subject = PromotionSubjectRef.make({ id: "application-16138242", kind: "patent-application" })
 * console.log(subject.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromotionSubjectRef extends S.Class<PromotionSubjectRef>($I`PromotionSubjectRef`)(
  {
    id: S.NonEmptyString.annotateKey({ description: "Stable identifier interpreted only by the vertical adapter." }),
    kind: S.NonEmptyString.annotateKey({ description: "Opaque subject kind used to route vertical policy." }),
  },
  $I.annote("PromotionSubjectRef", {
    description: "Opaque kind/id reference consulted before candidate output promotion.",
  })
) {}

/**
 * Opaque refusal reason safe to return across the shared boundary.
 *
 * **Gotchas**
 *
 * This is a policy identifier or bounded refusal code, not the vertical's raw
 * evidence, legal analysis, or internal error payload.
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PromotionBlockReason = S.NonEmptyString.pipe(
  S.brand("PromotionBlockReason"),
  $I.annoteSchema("PromotionBlockReason", {
    description: "Opaque sanitized reason code for a blocked candidate promotion.",
  })
);

/**
 * Type-level value produced by {@link PromotionBlockReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PromotionBlockReason = typeof PromotionBlockReason.Type;

const PromotionGateOutcome = LiteralKit(["clear", "blocked"]);

/**
 * Total clear/blocked verdict returned by a promotion gate.
 *
 * **Example** (Construct a clear verdict)
 *
 * ```ts
 * import { PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate"
 *
 * const verdict = PromotionGateVerdict.cases.clear.make({})
 * console.log(verdict.outcome)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PromotionGateVerdict = PromotionGateOutcome.toTaggedUnion("outcome")({
  clear: {},
  blocked: { reason: PromotionBlockReason },
}).pipe(
  $I.annoteSchema("PromotionGateVerdict", {
    description: "Total candidate-promotion verdict: clear or blocked with an opaque sanitized reason.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PromotionGateVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type PromotionGateVerdict = typeof PromotionGateVerdict.Type;
