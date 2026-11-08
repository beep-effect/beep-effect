/** Shared original-token coherence at citation constructor boundaries.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage, CitationTokenSeed } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationCaseNameSelectionInput } from "./CaseNameSelection.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";

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
/** Evaluate the source constructor's missing-page predicate on owned native text.
 * This value predicate neither creates token identities nor verifies coordinates.
 * @internal @category operations @since 0.0.0
 */
export const isMissingCitationModelPage = Effect.fn("Citation.isMissingModelPage")(function* (
  storage: CitationPythonUnicodeStorage
) {
  const length = storage.bytes.length / storage.width;
  if (length === 0) return false;
  const end = citationPythonPointAt(storage, length - 1) === 10 ? length - 1 : length;
  if (end === 0) return false;
  for (let index = 0; index < end; index++) {
    if (citationPythonPointAt(storage, index) !== 95) return false;
    if (index % 4096 === 4095) yield* Effect.yieldNow;
  }
  return true;
});
/** Apply CitationBase.__post_init__ from eyecite 2.7.6 models.py (BSD-2-Clause).
 * The original missing-page expression accepts underscores and an optional final
 * newline. Preserve the raw token spelling while normalizing its model groups.
 * @internal @category operations @since 0.0.0
 */
export const normalizeCitationModelPage = Effect.fn("Citation.normalizeModelPage")(function* (
  token: CitationTokenSeed
) {
  const page = O.getOrNull(R.get(token.groups, "page"));
  if (page === null) return token;
  const missing = yield* isMissingCitationModelPage(CitationPythonUnicodeStorage.make(page));
  return missing ? CitationTokenSeed.make({ ...token, groups: { ...token.groups, page: null } }) : token;
});
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
