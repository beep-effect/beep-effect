/** Frozen one-point CPython classifications for owned native source words.
 * PSF-2.0; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { citationPythonCharacterData } from "./PythonCharacterData.ts";
import { citationRegexCellFor } from "./RegexAlphabet.ts";

const predicate = (ranges: ReadonlyArray<readonly [number, number]>) => {
  const starts = [...A.map(ranges, ([start]) => start), 0x110000];
  return (point: number) => {
    const [start, end] = A.getUnsafe(ranges, citationRegexCellFor(starts, point));
    return start <= point && point <= end;
  };
};
const $I = $LawPracticeServerId.create("internal/Citation/PythonCharacters");
/** @internal @category errors @since 0.0.0 */
export class CitationPythonCharacterFailure extends S.TaggedError<
  CitationPythonCharacterFailure,
  { readonly brand: unique symbol }
>($I`CitationPythonCharacterFailure`)(
  "CitationPythonCharacterFailure",
  { reason: S.tag("invalid-data") },
  $I.annoteError<CitationPythonCharacterFailure>("CitationPythonCharacterFailure", {
    description: "Invalid frozen character data without parser causes or source words.",
  })
) {}
/** Decode the one frozen schema through Effect and capture pure upper/lower/
 * alpha predicates for validated native points. No per-word allocation or host
 * Unicode dependency is introduced. Returned predicates need no services.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPythonCharacters = Effect.fn("Citation.makePythonCharacters")(function* () {
  const data = yield* citationPythonCharacterData.pipe(Effect.mapError(() => CitationPythonCharacterFailure.make({})));
  return {
    data,
    upper: predicate(data.upperRanges),
    lower: predicate(data.lowerRanges),
    alpha: predicate(data.alphaRanges),
  };
});
