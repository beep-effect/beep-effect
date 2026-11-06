/** Shared original-token coherence at citation constructor boundaries.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationCaseNameSelectionInput } from "./CaseNameSelection.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractionContext");
/** Actual token and its original built-in Document words, with optional owned geometry.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenExtractionInput extends S.Opaque<
  CitationTokenExtractionInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    words: CitationCaseNameSelectionInput.fields.words,
    index: CitationCaseNameSelectionInput.fields.index,
    token: S.Struct(CitationTokenSeed.fields),
    geometry: CitationCaseNameSelectionInput.fields.geometry,
  }).pipe(
    $I.annoteSchema("CitationTokenExtractionInput", {
      description: "Shared native token/context input before any constructor branch is executed.",
    })
  )
) {}
const sameNative = S.toEquivalence(CitationTokenSeed.fields.data);
const sameGroups = S.toEquivalence(CitationTokenSeed.fields.groups);
/** Reject conflicting representations before metadata or a native child starts.
 * @internal @category operations @since 0.0.0
 */
export const validateCitationTokenWord = Effect.fn("Citation.validateExtractionToken")(function* <E>(
  request: Pick<CitationTokenExtractionInput, "words" | "index" | "token">,
  invalid: () => E
) {
  const word = yield* Effect.fromOption(A.get(request.words, request.index), invalid);
  if (
    word.kind !== request.token.kind ||
    !sameNative(word.data, request.token.data) ||
    word.start !== request.token.start ||
    !sameGroups(word.groups, request.token.groups)
  )
    return yield* Effect.fail(invalid());
});
