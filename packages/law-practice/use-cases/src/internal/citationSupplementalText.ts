/**
 * Focused cleaning/annotation observations within the supplemental evidence bundle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationOracleJson } from "./citationOracleJson.ts";

const $I = $LawPracticeUseCasesId.create("internal/citationSupplementalText");
const Outcome = S.Union([
  S.Struct({ kind: S.tag("success"), value: S.String }),
  S.Struct({ kind: S.tag("failure"), type: S.NonEmptyString, message: S.String }),
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Outcome", { description: "Exact oracle text or its observed exception identity and message." })
);
const Range = S.Tuple([S.Natural, S.Natural]);
const Span = S.Struct({ python: Range, utf16: Range, text: S.String });
const Stages = {
  mappingUpdates: S.Array(
    S.Struct({ offset: S.Natural, side: LiteralKit(["bisect_right", "bisect_left"]), result: S.Natural })
  ),
  inputSpans: S.Array(Span),
  mappedSpans: S.Array(Span),
  outcome: Outcome,
};
const Fields = {
  id: S.NonEmptyString,
  normalizedSha256: Sha256Hex,
  workflowState: LiteralKit(["audit", "ready", "complete"]),
  targetProof: S.NullOr(S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString, evidenceSha256: Sha256Hex })),
};

/**
 * Operation-specific text probe payloads with mapping traces before overlap/balancing.
 *
 * **Example** (Select a decoder)
 *
 * ```ts
 * import { CitationSupplementalExtraction } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const decodeBundle = S.decodeUnknownEffect(CitationSupplementalExtraction)
 * void decodeBundle
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const CitationSupplementalTextCase = LiteralKit(["clean_text", "annotate_citations"])
  .toTaggedUnion("operation")({
    clean_text: {
      ...Fields,
      payload: CitationOracleJson(
        S.Struct({
          input: S.Struct({ text: S.String, steps: S.Array(S.String) }),
          ...Stages,
        })
      ),
    },
    annotate_citations: {
      ...Fields,
      payload: CitationOracleJson(
        S.Struct({
          input: S.Struct({
            plain_text: S.String,
            annotations: S.Array(S.Tuple([Range, S.String, S.String])),
            source_text: S.String,
            unbalanced_tags: S.String,
            use_dmp: S.Boolean,
          }),
          ...Stages,
        })
      ),
    },
  })
  .pipe(
    $I.annoteSchema("CitationSupplementalTextCase", {
      description:
        "Focused oracle observations; mapped spans index source text before overlap clipping or HTML balancing and are never verified raw anchors.",
    })
  );

/**
 * Schema-derived text probe type.
 *
 * @category testing
 * @since 0.0.0
 */
export type CitationSupplementalTextCase = typeof CitationSupplementalTextCase.Type;
