/**
 * Anthropic-backed FilingDecision implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import { LegalDocumentConceptId, legalDocumentTaxonomy } from "@beep/documents-domain/values/Taxonomy";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { A } from "@beep/utils";
import { Cause, Duration, Effect, Layer, Number as N, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { FilingDecisionLlmConfig } from "./FilingDecisionLlm.config.ts";

const $I = $DocumentsServerId.create("aggregates/Document/FilingDecisionLlm");
const FilingDecision = DocumentUseCases.Document.FilingDecision;
const MODEL_TIMEOUT = Duration.seconds(30);

class FilingProposal extends S.Class<FilingProposal>($I`FilingProposal`)(
  {
    confidence: UnitInterval,
    rationale: S.NonEmptyString,
    taxonomyConceptId: S.NonEmptyString,
  },
  $I.annote("FilingProposal", {
    description: "Schema-validated structured proposal returned by the filing language model.",
  })
) {}

const taxonomyPrompt = pipe(
  legalDocumentTaxonomy.concepts,
  A.map((concept) => `- ${concept.id}: ${concept.prefLabel} — ${concept.definition}`),
  A.join("\n")
);

const promptFor = (input: DocumentUseCases.Document.FilingDecisionInput): string =>
  pipe(
    [
      "Classify this legal document into exactly one taxonomy concept.",
      "Return only the requested structured object with taxonomyConceptId, rationale, and confidence from 0 to 1.",
      "Do not invent a concept id. If no concept is a sound match, choose the closest only with low confidence.",
      "",
      "Taxonomy:",
      taxonomyPrompt,
      "",
      `Filename: ${input.originalFileName}`,
      ...O.match(input.textExcerpt, {
        onNone: A.empty<string>,
        onSome: (textExcerpt) => ["", "Document text excerpt:", textExcerpt],
      }),
    ],
    A.join("\n")
  );

const noMatch = (rationale: string) =>
  FilingOutcome.make({
    kind: "inboxed",
    rationale,
    reason: "no-match",
  });

const conceptIdEquivalent = S.toEquivalence(LegalDocumentConceptId);
const isLegalDocumentConceptId = S.is(LegalDocumentConceptId);

const outcomeFromProposal = (proposal: FilingProposal, confidenceThreshold: UnitInterval) =>
  pipe(
    O.liftPredicate(isLegalDocumentConceptId)(proposal.taxonomyConceptId),
    O.flatMap((proposalConceptId) =>
      A.findFirst(legalDocumentTaxonomy.concepts, (concept) => conceptIdEquivalent(concept.id, proposalConceptId))
    ),
    O.match({
      onNone: () => noMatch(proposal.rationale),
      onSome: (concept) =>
        N.isLessThan(proposal.confidence, confidenceThreshold)
          ? FilingOutcome.make({
              kind: "inboxed",
              rationale: proposal.rationale,
              reason: "low-confidence",
            })
          : FilingOutcome.make({
              kind: "filed",
              confidence: proposal.confidence,
              rationale: proposal.rationale,
              taxonomyConceptId: concept.id,
            }),
    })
  );

const unavailable = FilingOutcome.make({
  kind: "inboxed",
  rationale: "The filing classifier was unavailable; routed to the intake inbox for review.",
  reason: "llm-unavailable",
});

/**
 * FilingDecision layer backed by a schema-validated LanguageModel structured call.
 *
 * @example
 * ```ts
 * import { FilingDecisionLlmLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingDecisionLlmLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FilingDecisionLlmLayer = Layer.effect(
  FilingDecision,
  Effect.gen(function* () {
    const config = yield* FilingDecisionLlmConfig;
    const languageModel = yield* LanguageModel.LanguageModel;

    return FilingDecision.of({
      decide: Effect.fn($I`decide`)(function* (input) {
        return yield* languageModel
          .generateObject({
            objectName: "filing_decision",
            prompt: promptFor(input),
            schema: FilingProposal,
          })
          .pipe(
            Effect.timeout(MODEL_TIMEOUT),
            Effect.map((response) => outcomeFromProposal(response.value, config.confidenceThreshold)),
            Effect.matchCauseEffect({
              onFailure: (cause) =>
                Effect.logWarning("LLM filing decision unavailable; routing document to intake inbox", {
                  cause: Cause.pretty(cause),
                  contentDigest: input.contentDigest,
                  originalFileName: input.originalFileName,
                }).pipe(Effect.as(unavailable)),
              onSuccess: Effect.succeed,
            })
          );
      }),
    });
  }).pipe(Effect.withSpan($I`make`))
);
