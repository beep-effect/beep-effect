/**
 * Deterministic heuristic FilingDecision implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import { legalDocumentTaxonomy, slugVaultSegment } from "@beep/documents-domain/values/Taxonomy";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { A } from "@beep/utils";
import { Effect, flow, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const $I = $DocumentsServerId.create("aggregates/Document/FilingDecisionHeuristic");

const FilingDecision = DocumentUseCases.Document.FilingDecision;
const deterministicConfidence = UnitInterval.fromUnknown(1);

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
          FilingOutcome.make({
            kind: "inboxed",
            rationale: "No taxonomy heuristic token matched the filename; routed to the intake inbox.",
            reason: "no-match",
          }),
        onSome: (concept) =>
          FilingOutcome.make({
            kind: "filed",
            confidence: deterministicConfidence,
            rationale: `Matched deterministic taxonomy token for ${concept.id}.`,
            taxonomyConceptId: concept.id,
          }),
      })
    )
  );

/**
 * Deterministic FilingDecision layer used by P1.
 *
 * @example
 * ```ts
 * import { FilingDecisionHeuristicLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingDecisionHeuristicLayer)
 * ```
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
