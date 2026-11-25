/**
 * The reported unit-interval scalar used by epistemic measurements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicsId } from "@beep/identity/packages";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";

const $I = $EpistemicsId.create("Confidence");

/**
 * A reported confidence scalar in the closed unit interval, without a calibration claim.
 *
 * **Example** (Construct a reported zero)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemics/Confidence"
 *
 * const value = Confidence.make(0)
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Confidence = UnitInterval.pipe(
  $I.annoteSchema("Confidence", { description: "Reported confidence in [0, 1]; calibration is a separate fact." })
);

/**
 * Decoded reported confidence scalar.
 *
 * @category models
 * @since 0.0.0
 */
export type Confidence = typeof Confidence.Type;

/**
 * A producer-attributed report with no implied calibration.
 *
 * **Example** (Retain a legacy report)
 *
 * ```ts
 * import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence"
 * import * as O from "effect/Option"
 * const report = ReportedConfidence.make({ value: Confidence.make(0), method: "legacy-reported", producer: O.none() })
 * console.log(report.value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReportedConfidence extends S.Opaque<ReportedConfidence, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ReportedConfidence", {
    value: Confidence,
    method: S.NonEmptyString,
    producer: S.OptionFromOptionalKey(ActivityPin),
  }).pipe(
    $I.annoteSchema("ReportedConfidence", {
      description: "Reported unit-interval value with method and optional producer attribution.",
    })
  )
) {}
