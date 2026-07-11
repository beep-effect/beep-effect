/**
 * FilingDecision port for deterministic and LLM-backed filing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import type { Effect } from "effect";
import type { FilingDecisionUnavailable } from "./Document.errors.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Document/FilingDecision");

/**
 * Maximum characters of extracted document text supplied to the FilingDecision port.
 *
 * @example
 * ```ts
 * import { FILING_TEXT_EXCERPT_MAX_LENGTH } from "@beep/documents-use-cases/aggregates/Document/server"
 *
 * console.log(FILING_TEXT_EXCERPT_MAX_LENGTH)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FILING_TEXT_EXCERPT_MAX_LENGTH = 8000;

/**
 * Bounded extracted-text excerpt used by content-aware filing decisions.
 *
 * @example
 * ```ts
 * import { FilingTextExcerpt } from "@beep/documents-use-cases/aggregates/Document/server"
 * import * as S from "effect/Schema"
 *
 * const excerpt = S.decodeUnknownSync(FilingTextExcerpt)("MASTER SERVICES AGREEMENT ...")
 * console.log(excerpt.length)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export const FilingTextExcerpt = S.NonEmptyString.check(S.isMaxLength(FILING_TEXT_EXCERPT_MAX_LENGTH)).pipe(
  $I.annoteSchema("FilingTextExcerpt", {
    description: "Bounded extracted-text excerpt used by content-aware filing decisions.",
  })
);

/**
 * Type for {@link FilingTextExcerpt}.
 *
 * @example
 * ```ts
 * import { FilingTextExcerpt } from "@beep/documents-use-cases/aggregates/Document/server"
 * import * as S from "effect/Schema"
 *
 * const excerpt: FilingTextExcerpt = S.decodeUnknownSync(FilingTextExcerpt)("Indemnification clause")
 * console.log(excerpt)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export type FilingTextExcerpt = typeof FilingTextExcerpt.Type;

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
      description: "Original source filename used by filename-based classification.",
    }),
    textExcerpt: S.Option(FilingTextExcerpt).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional bounded extracted-text excerpt for content-aware classification.",
    }),
  },
  $I.annote("FilingDecisionInput", {
    description: "Input supplied to the FilingDecision port.",
  })
) {}

/**
 * FilingDecision port shape used by deterministic and LLM-backed classifiers.
 *
 * @example
 * ```ts
 * import { FilingOutcome } from "@beep/documents-domain/aggregates/Document"
 * import type { FilingDecisionShape } from "@beep/documents-use-cases/aggregates/Document/server"
 * import { Effect } from "effect"
 *
 * const service: FilingDecisionShape = {
 *   decide: () => Effect.succeed(FilingOutcome.fromUnknown({
 *     kind: "filed",
 *     confidence: 1,
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
  readonly decide: (input: FilingDecisionInput) => Effect.Effect<FilingOutcome, FilingDecisionUnavailable>;
}

/**
 * FilingDecision port for deterministic and LLM-backed filing.
 *
 * @example
 * ```ts
 * import { FilingOutcome } from "@beep/documents-domain/aggregates/Document"
 * import { FilingDecision } from "@beep/documents-use-cases/aggregates/Document/server"
 * import type { FilingDecisionShape } from "@beep/documents-use-cases/aggregates/Document/server"
 * import { Effect } from "effect"
 *
 * const service: FilingDecisionShape = {
 *   decide: () => Effect.succeed(FilingOutcome.make({
 *     kind: "inboxed",
 *     rationale: "Classifier unavailable; routed to the intake inbox.",
 *     reason: "llm-unavailable"
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
