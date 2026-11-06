/** Canonical component projection before private resource hashing.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationComponents } from "@beep/law-practice-domain/values";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { FullCaseCitation } from "@beep/law-practice-domain/values";

const $I = $LawPracticeServerId.create("internal/Citation/ResourceComponents");
const ResourcePage = S.Tuple([S.toEncoded(CitationComponents), S.NullOr(S.String)]).pipe(
  $I.annoteSchema("ResourcePage", {
    description: "Canonical encoded case components and their present, possibly null page.",
  })
);
/** Project the canonical components and require page presence without evaluating
 * any reporter/edition data. Retain each caller's exact two boundary failures.
 * @internal @category operations @since 0.0.0
 */
export const readCitationResourcePage = Effect.fn("Citation.readResourcePage")(function* <E>(
  citation: FullCaseCitation,
  invalid: () => E,
  missing: () => E
) {
  const groups = yield* S.encodeEffect(CitationComponents)(citation.components).pipe(Effect.mapError(invalid));
  const page = yield* Effect.fromOption(R.get(groups, "page"), missing);
  return ResourcePage.make([groups, page]);
});
