/**
 * Internal canonical JSON encoder shared by every digest-bearing execution
 * authority module. Not part of the public API surface: the `values` barrel
 * never re-exports it and the package `exports` map nulls `./values/internal/*`.
 *
 * One implementation on purpose — {@link canonicalJson} feeds both the
 * grant-set seal and the ledger record seals, so a second private copy could
 * drift and silently split the digests those seals are supposed to share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, P, R } from "@beep/utils";

const isScalar: P.Predicate<unknown> = P.some([P.isNull, P.isNumber, P.isBoolean, P.isString]);

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
    return JSON.stringify(value);
  }
  if (A.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = R.toEntries(value as R.ReadonlyRecord<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
};
