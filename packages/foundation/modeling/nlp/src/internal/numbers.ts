/**
 * Shared numeric schemas used across NLP domains and tool boundaries.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { isPositive, SchemaUtils } from "@beep/schema";

export { UnitInterval } from "@beep/schema/UnitInterval";

import * as S from "effect/Schema";

const $I = $NlpId.create("internal/numbers");

/**
 * Strictly positive numeric value.
 *
 * **Example** (Import and log PositiveNumber)
 *
 * ```ts
 * import { PositiveNumber } from "./numbers"
 *
 * console.log(PositiveNumber)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PositiveNumber = S.Finite.check(
  isPositive.annotate({
    description: "A number greater than 0.",
    message: "Expected a number greater than 0",
  })
).pipe(
  $I.annoteSchema("PositiveNumber", {
    description: "A numeric value greater than 0.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PositiveNumber}.
 *
 * **Example** (Declare PositiveNumber type alias)
 *
 * ```ts
 * import type { PositiveNumber } from "./numbers"
 *
 * type Example = PositiveNumber
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveNumber = typeof PositiveNumber.Type;
