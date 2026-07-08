/**
 * Shared `S.decodeUnknownOption`-backed narrowing for unknown JSON-ish values.
 *
 * @remarks
 * Reproduces the verbatim `unknownRecordProperty` / `unknownRecordKeys`
 * helpers in the quality command adapters, the `asRecord` narrowing in the
 * research internals, and the `isReadonlyUnknownRecord` guard in tsconfig-sync.
 * Array inputs are rejected before the record decode so downstream lookups
 * never observe numeric-index keys.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, flow, O, P, pipe, R } from "@beep/utils";
import { Order } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));

/**
 * Narrow an unknown value to a non-array, string-keyed record.
 *
 * @param value - The unknown value to narrow.
 * @returns `Some` record when `value` is a non-null, non-array object.
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { asRecord } from "@beep/repo-cli/internal/cli/UnknownProbe"
 *
 * console.log(O.isSome(asRecord({ a: 1 })))
 * console.log(O.isSome(asRecord([1, 2])))
 * ```
 * @category guards
 * @since 0.0.0
 */
export const asRecord: (value: unknown) => O.Option<Record<string, unknown>> = O.liftPredicate(P.isObject);

/**
 * Type guard narrowing an unknown value to a readonly, non-array record.
 *
 * @param value - The unknown value to test.
 * @returns `true` when `value` is a non-null, non-array object.
 * @example
 * ```ts
 * import { isUnknownRecord } from "@beep/repo-cli/internal/cli/UnknownProbe"
 *
 * console.log(isUnknownRecord({ a: 1 }))
 * console.log(isUnknownRecord([1, 2]))
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isUnknownRecord = (value: unknown): value is Readonly<Record<string, unknown>> => P.isObject(value);

/**
 * Read a single property from an unknown record, rejecting arrays and
 * `undefined` values.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { unknownRecordProperty } from "@beep/repo-cli/internal/cli/UnknownProbe"
 *
 * console.log(unknownRecordProperty({ name: "beep" }, "name"))
 * console.log(O.isNone(unknownRecordProperty([1, 2], "name")))
 * ```
 * @category access
 * @since 0.0.0
 */
export const unknownRecordProperty: {
  (value: unknown, key: string): O.Option<unknown>;
  (key: string): (value: unknown) => O.Option<unknown>;
} = dual(2, (value: unknown, key: string): O.Option<unknown> => {
  if (A.isArray(value)) {
    return O.none();
  }

  return pipe(
    decodeUnknownRecordOption(value),
    O.flatMap((record) => O.fromUndefinedOr(record[key]))
  );
});

/**
 * List the sorted string keys of an unknown record, treating arrays and
 * non-objects as empty.
 *
 * @param value - The unknown value whose keys are read.
 * @returns The ascending-sorted own string keys, or an empty array.
 * @example
 * ```ts
 * import { unknownRecordKeys } from "@beep/repo-cli/internal/cli/UnknownProbe"
 *
 * console.log(unknownRecordKeys({ b: 1, a: 2 }))
 * console.log(unknownRecordKeys([1, 2]))
 * ```
 * @category access
 * @since 0.0.0
 */
export const unknownRecordKeys = (value: unknown): ReadonlyArray<string> =>
  A.isArray(value)
    ? A.empty<string>()
    : pipe(decodeUnknownRecordOption(value), O.map(flow(R.keys, A.sort(Order.String))), O.getOrElse(A.empty<string>));
