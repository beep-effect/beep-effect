/**
 * File type detection and validation declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import * as SchemaUtils from "../../../SchemaUtils/index.ts";

/**
 * Schema for numeric and textual file-signature components.
 *
 * @category models
 * @since 0.0.0
 */
export const NumOrStr = S.Union([S.Finite, S.String]);

/**
 * Numeric or textual component of a file signature.
 *
 * @category models
 * @since 0.0.0
 */
export type NumOrStr = typeof NumOrStr.Type;

const opt = <T extends S.Top>(schema: T) => schema.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

/**
 * Optional string field decoded to an Effect `Option`.
 *
 * @category models
 * @since 0.0.0
 */
export const optStr = opt(S.String);

/**
 * Builds an array schema with an empty-array constructor default.
 *
 * @category models
 * @since 0.0.0
 */
export const arr = <T extends S.Top>(schema: T) => schema.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults);

/**
 * String array schema with an empty-array constructor default.
 *
 * @category models
 * @since 0.0.0
 */
export const strArr = arr(S.String);
/**
 * Finite-number array schema with an empty-array constructor default.
 *
 * @category models
 * @since 0.0.0
 */
export const numArr = arr(S.Finite);
