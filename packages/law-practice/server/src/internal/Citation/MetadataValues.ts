/**
 * Source-visible metadata string selection shared by default resolution paths.
 * Adapted from eyecite 2.7.6 resolve.py; Free Law Project, BSD-2-Clause.
 * See THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("internal/Citation/MetadataValues");
const Metadata = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("Metadata", {
    description: "Source-ordered encoded citation metadata before nonempty string selection.",
  })
);
const NonEmpty = S.is(S.NonEmptyString);
/** Preserve encoded metadata order and the source's extra court spelling.
 * @internal @category operations @since 0.0.0
 */
export const citationMetadataValues = Effect.fn("Citation.metadataValues")(function* (citation: Citation) {
  const wire = yield* S.encodeEffect(Citation)(citation);
  const metadata = yield* S.decodeEffect(Metadata)(wire.metadata);
  const values = A.filter(R.values(metadata), NonEmpty);
  if (citation.type !== "case" || O.isNone(citation.metadata.court)) return values;
  const court = citation.metadata.court.value;
  const name = court.status === "known" ? court.id : court.value;
  return Str.isNonEmpty(name) ? A.append(values, name) : values;
});
