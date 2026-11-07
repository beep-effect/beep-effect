/** Trusted frozen-edition selection shared by extraction and raw resolution.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { FullCitation, ShortFormCaseCitation } from "@beep/law-practice-domain/values";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import type { CitationMention } from "@beep/law-practice-domain/values";

const $I = $LawPracticeServerId.create("internal/Citation/ResolutionEditions");
const PublicationCitation = S.Union([FullCitation, ShortFormCaseCitation]).pipe(
  $I.annoteSchema("PublicationCitation", {
    description: "Full authorities and short case citations whose selected editions participate in resolution.",
  })
);
/** Capture authenticated frozen lookup; preserve original first-occurrence
 * ordering and deduplication of selected edition references. Caller spellings
 * never establish the trusted authority vocabulary.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationResolutionEditions = Effect.fn("Citation.makeResolutionEditions")(function* () {
  const editions = yield* CitationFrozenEditions;
  return {
    forMentions: Effect.fn("Citation.resolutionEditionNames")(function* (mentions: ReadonlyArray<CitationMention>) {
      let seen = HashSet.empty<string>();
      const output = A.empty<CitationAuthorityEdition>();
      for (const mention of mentions) {
        const citation = mention.citation;
        if (!S.is(PublicationCitation)(citation) || O.isNone(citation.publication.selectedEdition)) continue;
        const reference = citation.publication.selectedEdition.value;
        if (HashSet.has(seen, reference)) continue;
        const edition = yield* editions.lookup(reference, citation.type === "shortFormCase" ? "case" : citation.type);
        output.push(CitationAuthorityEdition.make({ edition: reference, shortName: edition.value.short_name }));
        seen = HashSet.add(seen, reference);
      }
      return output;
    }),
  };
});
