/**
 * Small Effect-backed casing seam used by physical SQL names.
 *
 * @since 0.0.0
 */
import { camelCase as camelCaseEffect, snakeCase as snakeCaseEffect } from "effect/String";

/**
 * Normalize an identifier to snake_case.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const snakeCase = (value: string): string => snakeCaseEffect(value);

/**
 * Normalize an identifier to camelCase.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const camelCase = (value: string): string => camelCaseEffect(value);
