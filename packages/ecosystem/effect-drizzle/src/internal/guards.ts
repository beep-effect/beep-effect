/**
 * Shared cheap guards for internal author-input seams.
 *
 * @since 0.0.0
 */
import { isObject } from "effect/Predicate";

/**
 * String-keyed unknown record used by repository boundaries.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type UnknownRecord = Readonly<Record<string, unknown>>;

/**
 * Test whether an unknown value is a non-array string-keyed record.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const isUnknownRecord = (value: unknown): value is UnknownRecord => isObject(value);
