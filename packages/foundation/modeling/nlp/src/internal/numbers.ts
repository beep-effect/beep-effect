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
 * @example
 * ```ts
 * import { PositiveNumber } from "./numbers"
 *
 * console.log(PositiveNumber)
 * ```
 *
 * @since 0.0.0
 * @category validation
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
 * @example
 * ```ts
 * import type { PositiveNumber } from "./numbers"
 *
 * type Example = PositiveNumber
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PositiveNumber = typeof PositiveNumber.Type;
