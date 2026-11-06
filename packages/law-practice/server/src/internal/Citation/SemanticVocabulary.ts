/** Runtime projection of reviewed frozen-to-public publication identity evidence.
 * Source data: Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CourtReporterArtifactVersion,
  findReporterById,
  isCurrentCourtReporterArtifactVersion,
  ReporterId,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $LawPracticeServerId.create("internal/Citation/SemanticVocabulary");
const Reason = LiteralKit(["invalid-configuration", "artifact-mismatch", "missing-edition", "kind-mismatch"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed semantic identity failures without publication payloads or source text.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationSemanticVocabularyFailure extends S.TaggedError<
  CitationSemanticVocabularyFailure,
  { readonly brand: unique symbol }
>($I`CitationSemanticVocabularyFailure`)(
  "CitationSemanticVocabularyFailure",
  { reason: Reason },
  $I.annoteError<CitationSemanticVocabularyFailure>("CitationSemanticVocabularyFailure", {
    description: "Reviewed semantic identity projection failed without source or nested causes.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationSemanticVocabularyFailure.make({ reason });
const Binding = S.Union([
  S.Struct({ family: S.tag("case"), edition: CitationEditionRef, reporterId: ReporterId }),
  S.Struct({ family: S.tag("law"), edition: CitationEditionRef }),
  S.Struct({ family: S.tag("journal"), edition: CitationEditionRef }),
]).pipe(
  S.toTaggedUnion("family"),
  $I.annoteSchema("Binding", {
    description: "Reviewed case reporter identity or original non-case publication family.",
  })
);
const Artifact = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-semantic-editions/v1"),
    mappingSha256: S.tag("b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5"),
    vocabularyVersion: CourtReporterArtifactVersion,
    editions: S.Array(Binding).check(S.isBetweenLength(2533, 2533)),
  })
);
const Text = S.String.check(S.isMaxLength(1024 * 1024));
const Family = LiteralKit(["case", "law", "journal"]).pipe(
  $I.annoteSchema("Family", {
    description: "Original publication source families, without conflating law/journal and case reporter identities.",
  })
);
/** Authenticate the exact derived artifact before retaining its complete identity
 * table. Current public reporter membership is checked; aliases are never guessed.
 * No test-only schema or generated vocabulary internal is imported at runtime.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSemanticVocabulary = Effect.fn("Citation.makeSemanticVocabulary")(function* (raw: unknown) {
  const text = yield* S.decodeUnknownEffect(Text)(raw).pipe(Effect.mapError(() => fail("invalid-configuration")));
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
    Effect.mapError(() => fail("artifact-mismatch")),
    Effect.catchDefect(() => Effect.fail(fail("artifact-mismatch")))
  );
  if (digest !== "9e3e5f9539e13f0cfce17489ece472686e11c9ccc446ba7d71319d8680c0dba8")
    return yield* fail("artifact-mismatch");
  const artifact = yield* S.decodeEffect(Artifact)(text).pipe(Effect.mapError(() => fail("invalid-configuration")));
  if (!isCurrentCourtReporterArtifactVersion(artifact.vocabularyVersion)) return yield* fail("artifact-mismatch");
  const rows = HashMap.fromIterable(A.map(artifact.editions, (row) => Tuple.make(row.edition, row)));
  if (HashMap.size(rows) !== 2533) return yield* fail("artifact-mismatch");
  yield* Effect.forEach(
    artifact.editions,
    (row) =>
      row.family === "case" && O.isNone(findReporterById(row.reporterId))
        ? Effect.fail(fail("artifact-mismatch"))
        : Effect.void,
    { concurrency: 1, discard: true }
  );
  const lookup = Effect.fn("Citation.semanticEditionIdentity")(function* (
    edition: CitationEditionRef,
    family: typeof Family.Type
  ) {
    const row = yield* Effect.fromOption(HashMap.get(rows, edition), () => fail("missing-edition"));
    if (row.family !== family) return yield* fail("kind-mismatch");
    return row;
  });
  return { vocabularyVersion: artifact.vocabularyVersion, lookup };
});
