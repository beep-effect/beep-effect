/**
 * Shared unknown-to-record narrowing for research internals.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";

/**
 * Narrow an unknown value to a string-keyed record, rejecting arrays.
 *
 * @internal
 * @param value - Unknown value to narrow.
 * @returns The value as a record when it is a non-array object.
 * @category utilities
 */
export const asRecord = (value: unknown): O.Option<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value) ? O.some(value as Record<string, unknown>) : O.none();
