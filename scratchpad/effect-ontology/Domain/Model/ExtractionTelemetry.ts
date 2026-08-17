/**
 * Schema-backed extraction telemetry and workflow outcome models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
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
  const schema = S.TaggedUnion({
    Complete: {
      inputTokens: NonNegativeInt,
      outputTokens: NonNegativeInt,
      attemptCount: NonNegativeInt,
    },
    Partial: {
      inputTokens: NonNegativeInt,
      outputTokens: NonNegativeInt,
      attemptCount: NonNegativeInt,
      missingAttempts: NonNegativeInt,
    },
    Unavailable: {
      attemptCount: NonNegativeInt,
    },
  });
  return schema.pipe(
    $I.annoteSchema("ProviderTokenUsage", {
      description: "Complete, partial, or unavailable provider-reported token usage across all attempts.",
      toArbitrary: () => (fc) => S.toArbitrary(schema)(fc),
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
 * **Example** (Inspect an extraction outcome)
 *
 * ```ts
 * import type { ExtractionOutcome } from "@effect-ontology/Model/ExtractionTelemetry"
 *
 * const chunkCount = (outcome: ExtractionOutcome) => outcome.telemetry.chunkCount
 * console.log(chunkCount)
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
