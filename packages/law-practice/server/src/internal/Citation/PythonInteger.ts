/** Exact base-ten str-to-int profile of the pinned CPython 3.11 interpreter.
 * PSF-2.0 behavior observations; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { trimCitationMetadataBoundary } from "./MetadataStrings.ts";
import { citationPythonDecimalValues } from "./PythonDecimal.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PythonInteger");
const spaces = HashSet.fromIterable(
  A.filter(A.fromIterable(citationPythonTextData.whitespace), (char) => {
    const point = O.getOrThrow(Str.codePointAt(char, 0));
    return point > 127 || point === 32 || (point >= 9 && point <= 13);
  })
);
const integerSpace = (point: number) => HashSet.has(spaces, String.fromCodePoint(point));
class DecimalState extends S.Opaque<DecimalState, { readonly brand: unique symbol }>()(
  S.Struct({ value: S.BigInt, count: S.Natural.check(S.isLessThanOrEqualTo(4300)), previousDigit: S.Boolean }).pipe(
    $I.annoteSchema("DecimalState", {
      description: "Exact signed-integer magnitude scan under the frozen source digit ceiling.",
    })
  )
) {}
const nextDigit = (state: DecimalState, point: number) => {
  const decimal = HashMap.get(citationPythonDecimalValues, String.fromCodePoint(point));
  if (O.isSome(decimal))
    return state.count === 4300
      ? O.none<DecimalState>()
      : O.some(
          DecimalState.make({
            value: state.value * BigInt(10) + BigInt(decimal.value),
            count: state.count + 1,
            previousDigit: true,
          })
        );
  return point === 95 && state.previousDigit
    ? O.some(DecimalState.make({ ...state, previousDigit: false }))
    : O.none<DecimalState>();
};
const digits = Effect.fn("Citation.scanPythonIntegerDigits")(function* (
  source: CitationPythonUnicodeValue,
  start: number,
  end: number
) {
  let state = DecimalState.make({ value: BigInt(0), count: 0, previousDigit: false });
  for (let index = start; index < end; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const next = nextDigit(state, citationPythonPointAt(source.storage, index));
    if (O.isNone(next)) return O.none<bigint>();
    state = next.value;
  }
  return state.previousDigit ? O.some(state.value) : O.none<bigint>();
});
/** Preserve arbitrary-size signed values within the frozen 4300-digit limit.
 * None represents Python ValueError; the caller owns the closed failure mapping.
 * @internal @category operations @since 0.0.0
 */
export const parseCitationPythonInteger = Effect.fn("Citation.parsePythonInteger")(function* (
  source: CitationPythonUnicodeValue
) {
  let start = yield* trimCitationMetadataBoundary(source, 0, source.pythonLength, 1, integerSpace);
  const end = 1 + (yield* trimCitationMetadataBoundary(source, source.pythonLength - 1, start - 1, -1, integerSpace));
  if (start === end) return O.none<bigint>();
  const first = citationPythonPointAt(source.storage, start);
  const negative = first === 45;
  if (negative || first === 43) start++;
  const parsed = yield* digits(source, start, end);
  return O.map(parsed, (value) => (negative ? -value : value));
});
