/**
 * FilingDecision port for deterministic P1 and future LLM-backed P2 filing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { LegalDocumentConceptId } from "@beep/documents-domain/values/Taxonomy";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";
import type { FilingDecisionUnavailable } from "./Document.errors.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Document/FilingDecision");

/**
 * Input supplied to the FilingDecision port.
 *
 * @example
 * ```ts
 * import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document"
 * import { FilingDecisionInput } from "@beep/documents-use-cases/aggregates/Document/server"
 * import * as S from "effect/Schema"
 *
 * const input = FilingDecisionInput.make({
 *   contentDigest: S.decodeUnknownSync(DocumentContentDigest)("abc123"),
 *   originalFileName: "complaint.pdf"
 * })
 * console.log(input.originalFileName)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class FilingDecisionInput extends S.Class<FilingDecisionInput>($I`FilingDecisionInput`)(
  {
    contentDigest: DocumentContentDigest.annotateKey({
      description: "Deterministic content digest for the source bytes.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original source filename used by the deterministic heuristic.",
    }),
  },
  $I.annote("FilingDecisionInput", {
    description: "Input supplied to the FilingDecision port.",
  })
) {}

/**
 * Result returned by the FilingDecision port.
 *
 * @example
 * ```ts
 * import { FilingDecisionResult } from "@beep/documents-use-cases/aggregates/Document/server"
 *
 * const result = FilingDecisionResult.make({
 *   rationale: "Matched deterministic taxonomy token for pleadings.",
 *   taxonomyConceptId: "pleadings"
 * })
 * console.log(result.taxonomyConceptId)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class FilingDecisionResult extends S.Class<FilingDecisionResult>($I`FilingDecisionResult`)(
  {
    rationale: S.NonEmptyString.annotateKey({
      description: "Deterministic explanation for the selected taxonomy concept.",
    }),
    taxonomyConceptId: LegalDocumentConceptId.annotateKey({
      description: "Selected legal document taxonomy concept.",
    }),
  },
  $I.annote("FilingDecisionResult", {
    description: "Result returned by the FilingDecision port.",
  })
) {}

/**
 * FilingDecision port shape used by deterministic and LLM-backed classifiers.
 *
 * @example
 * ```ts
 * import { FilingDecisionResult } from "@beep/documents-use-cases/aggregates/Document/server"
 * import type { FilingDecisionShape } from "@beep/documents-use-cases/aggregates/Document/server"
 * import { Effect } from "effect"
 *
 * const service: FilingDecisionShape = {
 *   decide: () => Effect.succeed(FilingDecisionResult.make({
 *     rationale: "Matched deterministic taxonomy token for pleadings.",
 *     taxonomyConceptId: "pleadings"
 *   }))
 * }
 * console.log(service)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface FilingDecisionShape {
  readonly decide: (input: FilingDecisionInput) => Effect.Effect<FilingDecisionResult, FilingDecisionUnavailable>;
}

/**
 * FilingDecision port for deterministic P1 and future LLM-backed filing.
 *
 * @example
 * ```ts
 * import { FilingDecision, FilingDecisionResult } from "@beep/documents-use-cases/aggregates/Document/server"
 * import type { FilingDecisionShape } from "@beep/documents-use-cases/aggregates/Document/server"
 * import { Effect } from "effect"
 *
 * const service: FilingDecisionShape = {
 *   decide: () => Effect.succeed(FilingDecisionResult.make({
 *     rationale: "Matched deterministic taxonomy token for pleadings.",
 *     taxonomyConceptId: "pleadings"
 *   }))
 * }
 * const program = Effect.gen(function* () {
 *   return (yield* FilingDecision) === service
 * }).pipe(Effect.provideService(FilingDecision, service))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class FilingDecision extends Context.Service<FilingDecision, FilingDecisionShape>()($I`FilingDecision`) {}
