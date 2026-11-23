/**
 * The reported unit-interval scalar used by epistemic measurements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { UnitInterval } from "@beep/schema/UnitInterval";

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
