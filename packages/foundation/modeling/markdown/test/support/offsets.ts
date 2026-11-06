// Source-offset lookups for position assertions. A test that asks where a
// needle sits expects it to be there, so a miss throws instead of yielding
// the `-1` a native `indexOf` would let slip into an offset comparison.

import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UnknownJson = S.fromJsonString(S.Unknown);

/** The UTF-16 offset of the first occurrence of `needle` in `source`; throws when it does not occur. */
export const offsetOf: {
  (source: string, needle: string): number;
  (needle: string): (source: string) => number;
} = dual(2, (source: string, needle: string): number =>
  O.getOrThrowWith(
    Str.indexOf(needle)(source),
    () => new Error(`${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(needle), identity)} does not occur`)
  )
);

/** The UTF-16 offset of the last occurrence of `needle` in `source`; throws when it does not occur. */
export const lastOffsetOf: {
  (source: string, needle: string): number;
  (needle: string): (source: string) => number;
} = dual(2, (source: string, needle: string): number =>
  O.getOrThrowWith(
    Str.lastIndexOf(needle)(source),
    () => new Error(`${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(needle), identity)} does not occur`)
  )
);
