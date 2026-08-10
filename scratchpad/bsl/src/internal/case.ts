/** Small Effect-backed casing seam used by physical SQL names. */
import * as Str from "effect/String";

/** Normalize an identifier to snake_case. */
export const snakeCase = (value: string): string => Str.snakeCase(value);

/** Normalize an identifier to camelCase. */
export const camelCase = (value: string): string => Str.camelCase(value);
