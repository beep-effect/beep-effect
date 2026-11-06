/** Shared native source-token fixture codec; no test registration.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationTokenSeed } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationTokenSeed");
/** Native oracle carrier with hexadecimal little-endian bytes.
 * @internal @category testing @since 0.0.0
 */
export const CitationNativeUnicodeHex = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex }).pipe(
  $I.annoteSchema("CitationNativeUnicodeHex", {
    description: "Lossless fixture carrier; production owners independently validate layout and ownership.",
  })
);
/** @internal @category testing @since 0.0.0 */
export type CitationNativeUnicodeHex = typeof CitationNativeUnicodeHex.Type;
const Native = S.NullOr(CitationNativeUnicodeHex);
/** @internal @category testing @since 0.0.0 */
export const CitationTokenSeedHex = S.Struct({
  ...CitationTokenSeed.fields,
  data: Native,
  groups: S.Record(S.String, Native),
});

/** Native original Document words shared by name and full-model source replays. */
export const CitationCaseNameDocument = S.Struct({
  markup: CitationNativeUnicodeHex,
  plain: CitationNativeUnicodeHex,
  index: S.Int,
  words: S.Array(
    S.Struct({
      kind: S.String,
      data: CitationNativeUnicodeHex,
      start: S.NullOr(S.Int),
      groups: S.Record(S.String, S.NullOr(CitationNativeUnicodeHex)),
    })
  ),
}).pipe(
  $I.annoteSchema("CitationCaseNameDocument", {
    description: "Original native markup/plain text, token classes, source starts and capture groups.",
  })
);
export type CitationCaseNameDocument = typeof CitationCaseNameDocument.Type;

const ModelMetadata = S.Record(S.String, S.Union([S.Null, S.toType(CitationNativeUnicodeHex), S.Int])).pipe(
  $I.annoteSchema("ModelMetadata", {
    description: "Native model attributes used only to compare original and target constructor state.",
  })
);
const modelNames = R.fromEntries<readonly [string, string]>([
  ["pinCite", "pin_cite"],
  ["pinCiteSpanStart", "pin_cite_span_start"],
  ["pinCiteSpanEnd", "pin_cite_span_end"],
  ["antecedentGuess", "antecedent_guess"],
  ["resolvedCaseName", "resolved_case_name"],
  ["resolvedCaseNameShort", "resolved_case_name_short"],
]);
/** Normalize only the declared model field spellings, preserving every native value and field. */
export const readCitationModelMetadata = Effect.fn("CitationModelTest.metadata")(function* (raw: unknown) {
  const values = yield* S.decodeUnknownEffect(ModelMetadata)(raw);
  return R.mapKeys(values, (key) => O.getOrElse(R.get(modelNames, key), () => key));
});
