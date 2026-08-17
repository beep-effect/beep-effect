/**
 * Schema-backed extraction telemetry and workflow outcome models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as S from "effect/Schema";
import { KnowledgeGraph } from "./Entity.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/ExtractionTelemetry");

/**
 * Provider token accounting across every attempted language-model call.
 *
 * **Example** (Represent unavailable provider usage)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { ProviderTokenUsage } from "@effect-ontology/Model/ExtractionTelemetry"
 *
 * const usage = ProviderTokenUsage.cases.Unavailable.make({ attemptCount: NonNegativeInt.make(2) })
 * console.log(usage._tag) // "Unavailable"
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const ProviderTokenUsage = (() => {
  const definition = S.TaggedUnion({
    Complete: {
      inputTokens: NonNegativeInt,
      outputTokens: NonNegativeInt,
      attemptCount: PosInt,
    },
    Partial: {
      inputTokens: NonNegativeInt,
      outputTokens: NonNegativeInt,
      attemptCount: PosInt,
      missingAttempts: PosInt,
    },
    Unavailable: {
      attemptCount: NonNegativeInt,
    },
  });
  const schema = definition.check(
    S.makeFilter((usage) => usage._tag !== "Partial" || usage.missingAttempts <= usage.attemptCount, {
      identifier: $I`ProviderTokenUsageAttemptCheck`,
      title: "Provider Token Usage Attempt Counts",
      description: "Partial usage cannot report more missing attempts than total attempts.",
      message: "Expected missingAttempts to be less than or equal to attemptCount.",
    })
  );
  return schema.pipe(
    $I.annoteSchema("ProviderTokenUsage", {
      description: "Complete, partial, or unavailable provider-reported token usage across all attempts.",
      toArbitrary: () => (fc) => S.toArbitrary(definition)(fc).filter(S.is(schema)),
    })
  );
})();

/**
 * Runtime value decoded by {@link ProviderTokenUsage}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProviderTokenUsage = typeof ProviderTokenUsage.Type;

/**
 * Immutable telemetry returned by one extraction workflow invocation.
 *
 * **Example** (Create a zero-call telemetry value)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import { ExtractionTelemetry, ProviderTokenUsage } from "@effect-ontology/Model/ExtractionTelemetry"
 *
 * const telemetry = ExtractionTelemetry.make({
 *   chunkCount: NonNegativeInt.make(0),
 *   usage: ProviderTokenUsage.cases.Unavailable.make({ attemptCount: NonNegativeInt.make(0) })
 * })
 * console.log(telemetry.chunkCount) // 0
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export class ExtractionTelemetry extends S.Class<ExtractionTelemetry>($I`ExtractionTelemetry`)(
  {
    chunkCount: NonNegativeInt,
    usage: ProviderTokenUsage,
  },
  $I.annote("ExtractionTelemetry", {
    description: "Actual chunk count and provider usage captured for one extraction invocation.",
  })
) {}

/**
 * Successful extraction value returned by the workflow service.
 *
 * **Details**
 *
 * The knowledge graph owns published assertions and its provenance audit.
 * Telemetry reports actual chunk and provider-attempt accounting without
 * fabricating unavailable usage as zero.
 *
 * **Example** (Read outcome telemetry)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { ExtractionOutcome, ExtractionTelemetry, ProviderTokenUsage } from "@effect-ontology/Model/ExtractionTelemetry"
 *
 * const outcome = ExtractionOutcome.make({
 *   graph: KnowledgeGraph.make({}),
 *   telemetry: ExtractionTelemetry.make({
 *     chunkCount: NonNegativeInt.make(0),
 *     usage: ProviderTokenUsage.cases.Unavailable.make({ attemptCount: NonNegativeInt.make(0) })
 *   })
 * })
 * console.log(outcome.telemetry.chunkCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractionOutcome extends S.Class<ExtractionOutcome>($I`ExtractionOutcome`)(
  {
    graph: KnowledgeGraph,
    telemetry: ExtractionTelemetry,
  },
  $I.annote("ExtractionOutcome", {
    description: "Published and audited knowledge graph paired with extraction telemetry.",
  })
) {}
