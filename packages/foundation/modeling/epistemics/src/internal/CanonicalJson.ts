/**
 * Internal canonical JSON encoder for the digest-bearing epistemic values
 * (contradiction seals, detection proposal ids, evidence-verification keys).
 * Not part of the public API surface: the package `exports` map nulls
 * `./internal/*`.
 *
 * `@beep/epistemic-domain`'s agent-authority seals (grant sets, execution
 * records) reuse this one implementation through `canonicalDetectionJson`, so
 * every seal that shares a digest shares the encoder.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, P, R } from "@beep/utils";
import { identity } from "effect/Function";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const UnknownJson = S.fromJsonString(S.Unknown);

const isScalar: P.Predicate<unknown> = P.some([P.isNull, P.isNumber, P.isBoolean, P.isString]);

type CanonicalEntry = readonly [key: string, entry: unknown];

const byKeyAscending = Order.mapInput(Order.String, ([key]: CanonicalEntry) => key);

/**
 * Deterministic canonical JSON over wire-form values: object keys sorted
 * recursively so equal values always encode to equal strings. Operates on
 * already-encoded (wire-form) values, which are plain JSON by construction.
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJson = (value: unknown): string => {
  if (isScalar(value)) {
    return Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(value), identity);
  }
  if (A.isArray(value)) {
    return `[${A.join(A.map(value, canonicalJson), ",")}]`;
  }
  const defined: ReadonlyArray<CanonicalEntry> = A.filter(
    R.toEntries(value as R.ReadonlyRecord<string, unknown>),
    ([, entry]) => entry !== undefined
  );
  const entries = A.sort(defined, byKeyAscending);
  return `{${A.join(
    A.map(
      entries,
      ([key, entry]) =>
        `${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(key), identity)}:${canonicalJson(entry)}`
    ),
    ","
  )}}`;
};
