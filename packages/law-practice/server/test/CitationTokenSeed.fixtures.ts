/** Shared native source-token fixture codec; no test registration.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationTokenSeed } from "@beep/law-practice-server/internal/Citation/TokenObjects";
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
