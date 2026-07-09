/**
 * Deterministic heuristic FilingDecision implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { legalDocumentTaxonomy, slugVaultSegment } from "@beep/documents-domain/values/Taxonomy";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, flow, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const $I = $DocumentsServerId.create("aggregates/Document/FilingDecisionHeuristic");

const FilingDecision = DocumentUseCases.Document.FilingDecision;
const fallbackConceptId = "client-source-materials" as const;

const normalizedHaystack = flow(Str.toLowerCase, Str.replace(/[_\s.]+/g, "-"));

const tokenMatches = (haystack: string, token: string): boolean =>
  pipe(haystack, Str.includes(slugVaultSegment(token)));

const decideFromTaxonomy = (fileName: string) =>
  Effect.succeed(
    pipe(
      legalDocumentTaxonomy.concepts,
      A.findFirst((concept) =>
        A.some(concept.heuristicTokens, (token) => tokenMatches(normalizedHaystack(fileName), token))
      ),
      O.match({
        onNone: () =>
          DocumentUseCases.Document.FilingDecisionResult.make({
            rationale: "No taxonomy heuristic token matched the filename; defaulted to client source materials.",
            taxonomyConceptId: fallbackConceptId,
          }),
        onSome: (concept) =>
          DocumentUseCases.Document.FilingDecisionResult.make({
            rationale: `Matched deterministic taxonomy token for ${concept.id}.`,
            taxonomyConceptId: concept.id,
          }),
      })
    )
  );

/**
 * Deterministic FilingDecision layer used by P1.
 *
 * @category layers
 * @since 0.0.0
 */
export const FilingDecisionHeuristicLayer = Layer.succeed(
  FilingDecision,
  FilingDecision.of({
    decide: Effect.fn($I`decide`)(function* (input) {
      return yield* decideFromTaxonomy(input.originalFileName);
    }),
  })
);
