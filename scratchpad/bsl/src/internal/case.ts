/** Small Effect-backed casing seam used by physical SQL names. */
import { camelCase as camelCaseEffect, snakeCase as snakeCaseEffect } from "effect/String";

/** Normalize an identifier to snake_case. */
/** @internal */
export const snakeCase = (value: string): string => snakeCaseEffect(value);

/** Normalize an identifier to camelCase. */
/** @internal */
export const camelCase = (value: string): string => camelCaseEffect(value);
