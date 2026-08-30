/**
 * Defines the wire-safe progress, cancellation, and flow-control contracts used
 * while an ontology extraction moves from orchestration to WebSocket clients.
 *
 * **Details**
 *
 * The orchestrator emits `ProgressEvent` values, the RPC boundary wraps them in
 * `ProgressMessage`, and clients acknowledge delivery or request cancellation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils as SchemaDefaults } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Percentage } from "@beep/schema/Percentage";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { UUID } from "@beep/schema/String";
import { ISOStr } from "@beep/schema/Timestamp";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Duration, pipe } from "effect";
import * as S from "effect/Schema";
import { ExtractionRunId } from "../Domain/Identity.ts";

const $I = $ScratchpadId.create("effect-ontology/Contract/ProgressStreaming");

// =============================================================================
// Progress Event Tags (Discriminated Union)
// =============================================================================

/**
 * Closed vocabulary of lifecycle, result, error, and flow-control event tags
 * emitted by an extraction pipeline.
 *
 * **Example** (Recognize an entity event tag)
 *
 * ```ts
 * import { ProgressEventTag } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * console.log(ProgressEventTag.is.entity_found("entity_found")) // true
 * console.log(ProgressEventTag.is.entity_found("relation_found")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProgressEventTag = LiteralKit([
  "extraction_started",
  "chunking_started",
  "chunking_progress",
  "chunking_complete",
  "chunk_processing_started",
  "mention_extraction_progress",
  "entity_extraction_progress",
  "relation_extraction_progress",
  "grounding_progress",
  "chunk_processing_complete",
  "entity_found",
  "relation_found",
  "extraction_complete",
  "extraction_failed",
  "extraction_cancelled",
  "backpressure_warning",
  "error_recoverable",
  "error_fatal",
  // Generic stage lifecycle events (used by ExtractionEntityHandler)
  "stage_started",
  "stage_progress",
  "stage_completed",
  "rate_limited",
]).pipe(
  $I.annoteSchema("ProgressEventTag", {
    description: "Closed vocabulary of extraction progress event discriminators.",
  })
);

/**
 * Runtime event discriminator accepted by {@link ProgressEventTag}.
 *
 * **Example** (Declare an event discriminator)
 *
 * ```ts
 * import type { ProgressEventTag } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * const tag: ProgressEventTag = "extraction_started"
 * console.log(tag) // "extraction_started"
 * ```
 *
 * @see {@link ProgressEventTag} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ProgressEventTag = typeof ProgressEventTag.Type;

// =============================================================================
// Common Field Schemas
// =============================================================================

/**
 * Constrains protocol progress to an integer percentage from zero through one
 * hundred.
 *
 * **Example** (Validate progress bounds)
 *
 * ```ts
 * import { Percentage } from "@beep/schema/Percentage"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const progress = Percentage.pipe(S.check(S.isInt()))
 * console.log(O.isSome(S.decodeUnknownOption(progress)(75))) // true
 * console.log(O.isNone(S.decodeUnknownOption(progress)(101))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
const ProgressPercentage = Percentage.pipe(
  S.check(S.isInt({ message: "Expected progress to be a whole-number percentage" })),
  $I.annoteSchema("ProgressPercentage", {
    description: "Whole-number completion percentage between zero and one hundred, inclusive.",
  })
);

// =============================================================================
// Progress Event Schemas
// =============================================================================

/**
 * Supplies the delivery identity, extraction identity, server time, and overall
 * completion fields shared by every progress event.
 *
 * **Example** (Decode common event fields)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const commonFields = S.Struct({ eventId: S.String, overallProgress: S.Int })
 * console.log(O.isSome(S.decodeUnknownOption(commonFields)({ eventId: "evt-1", overallProgress: 20 }))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
const BaseProgressEvent = S.Struct({
  /** Unique identifier for this event (UUID v4) */
  eventId: UUID.pipe(
    $I.annoteKey("BaseProgressEvent.eventId", {
      description: "Unique identifier for this event (UUID v4)",
    })
  ),

  /** Extraction run identifier */
  runId: ExtractionRunId.pipe(
    $I.annoteKey("BaseProgressEvent.runId", {
      description: "Extraction run identifier",
    })
  ),

  /** Server timestamp at which the event was created. */
  timestamp: ISOStr.pipe(
    $I.annoteKey("BaseProgressEvent.timestamp", {
      description: "Server timestamp at which the event was created.",
    })
  ),

  /** Overall extraction completion percentage when this event was emitted. */
  overallProgress: ProgressPercentage.pipe(
    $I.annoteKey("BaseProgressEvent.overallProgress", {
      description: "Overall extraction completion percentage when this event was emitted.",
    })
  ),
}).pipe(
  $I.annoteSchema("BaseProgressEvent", {
    description: "Fields shared by every extraction progress event.",
  })
);

/**
 * Announces the accepted extraction workload before chunking begins.
 *
 * **Example** (Create an extraction-start event)
 *
 * ```ts
 * import { ExtractionStartedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ExtractionStartedEvent)({
 *   _tag: "extraction_started",
 *   eventId: "00000000-0000-4000-8000-000000000001",
 *   runId: "doc-0123456789ab",
 *   timestamp: "2026-08-11T12:00:00Z",
 *   overallProgress: 0,
 *   totalChunks: 4,
 *   textMetadata: { characterCount: 1200, estimatedAvgChunkSize: 300 }
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ExtractionStartedEvent extends S.TaggedClass<ExtractionStartedEvent>($I`ExtractionStartedEvent`)(
  "extraction_started",
  {
    ...BaseProgressEvent.fields,

    /** Total number of chunks scheduled for this extraction. */
    totalChunks: PosInt.pipe(
      $I.annoteKey("ExtractionStartedEvent.totalChunks", {
        description: "Total number of chunks scheduled for this extraction.",
      })
    ),

    /** Source-text statistics available before chunk processing begins. */
    textMetadata: S.Struct({
      /** Total number of source-text characters before chunking. */
      characterCount: PosInt.pipe(
        $I.annoteKey("ExtractionStartedEvent.textMetadata.characterCount", {
          description: "Total number of source-text characters before chunking.",
        })
      ),

      /** Estimated mean chunk size in source-text characters. */
      estimatedAvgChunkSize: PosInt.pipe(
        $I.annoteKey("ExtractionStartedEvent.textMetadata.estimatedAvgChunkSize", {
          description: "Estimated mean chunk size in source-text characters.",
        })
      ),

      /** Optional source media type or application-defined content category. */
      contentType: S.String.pipe(
        S.OptionFromOptionalKey,
        SchemaUtils.withNoneDefault,
        $I.annoteKey("ExtractionStartedEvent.textMetadata.contentType", {
          description: "Optional source media type or application-defined content category.",
        })
      ),
    }).pipe(
      $I.annoteSchema("ExtractionStartedTextMetadata", {
        description: "Source-text statistics available before chunk processing begins.",
      }),
      $I.annoteKey("ExtractionStartedEvent.textMetadata", {
        description: "Source-text statistics available before chunk processing begins.",
      })
    ),
  },
  $I.annote("ExtractionStartedEvent", {
    description: "Extraction lifecycle event announcing the initial chunk workload and source-text statistics.",
  })
) {}

/**
 * Records the chunking policy selected when source segmentation begins.
 *
 * **Example** (Create a chunking-start event)
 *
 * ```ts
 * import { ChunkingStartedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ChunkingStartedEvent)({
 *   _tag: "chunking_started",
 *   eventId: "00000000-0000-4000-8000-000000000001",
 *   runId: "doc-0123456789ab",
 *   timestamp: "2026-08-11T12:00:01Z",
 *   overallProgress: 1,
 *   config: { maxChunkSize: 1000, preserveSentences: true }
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ChunkingStartedEvent extends S.TaggedClass<ChunkingStartedEvent>($I`ChunkingStartedEvent`)(
  "chunking_started",
  {
    ...BaseProgressEvent.fields,
    /** Text segmentation policy used by the chunking stage. */
    config: S.Struct({
      /** Maximum number of source characters targeted per chunk. */
      maxChunkSize: PosInt.pipe(
        $I.annoteKey("ChunkingStartedEvent.config.maxChunkSize", {
          description: "Maximum number of source characters targeted per chunk.",
        })
      ),
      /** Whether chunk boundaries should preserve complete sentences. */
      preserveSentences: S.Boolean.pipe(
        $I.annoteKey("ChunkingStartedEvent.config.preserveSentences", {
          description: "Whether chunk boundaries should preserve complete sentences.",
        })
      ),
    }).pipe(
      $I.annoteSchema("ChunkingStartedConfig", {
        description: "Text segmentation policy used by the chunking stage.",
      }),
      $I.annoteKey("ChunkingStartedEvent.config", {
        description: "Text segmentation policy used by the chunking stage.",
      })
    ),
  },
  $I.annote("ChunkingStartedEvent", {
    description: "Extraction lifecycle event emitted when text chunking begins.",
  })
) {}

/**
 * Reports completed and active chunk counts while text segmentation is running.
 *
 * **Example** (Create a chunking-progress event)
 *
 * ```ts
 * import { ChunkingProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ChunkingProgressEvent)({
 *   _tag: "chunking_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:02Z",
 *   overallProgress: 5, chunksCompleted: 3, chunksProcessing: 1, avgChunkSize: 480
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ChunkingProgressEvent extends S.TaggedClass<ChunkingProgressEvent>($I`ChunkingProgressEvent`)(
  "chunking_progress",
  {
    ...BaseProgressEvent.fields,

    /** Number of chunks fully produced when the event was emitted. */
    chunksCompleted: NonNegativeInt.pipe(
      $I.annoteKey("ChunkingProgressEvent.chunksCompleted", {
        description: "Number of chunks fully produced when the event was emitted.",
      })
    ),

    /** Estimated number of chunks currently being assembled. */
    chunksProcessing: NonNegativeInt.pipe(
      $I.annoteKey("ChunkingProgressEvent.chunksProcessing", {
        description: "Estimated number of chunks currently being assembled.",
      })
    ),

    /** Mean size in characters of chunks produced so far. */
    avgChunkSize: PosInt.pipe(
      $I.annoteKey("ChunkingProgressEvent.avgChunkSize", {
        description: "Mean size in characters of chunks produced so far.",
      })
    ),
  },
  $I.annote("ChunkingProgressEvent", {
    description: "Periodic progress snapshot for the text chunking stage.",
  })
) {}

/**
 * Summarizes the final chunk count, average size, and elapsed time after text
 * segmentation succeeds.
 *
 * **Example** (Create a chunking-complete event)
 *
 * ```ts
 * import { ChunkingCompleteEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ChunkingCompleteEvent)({
 *   _tag: "chunking_complete",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:03Z",
 *   overallProgress: 10, finalChunkCount: 8, actualAvgChunkSize: 450, durationMs: 120
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ChunkingCompleteEvent extends S.TaggedClass<ChunkingCompleteEvent>($I`ChunkingCompleteEvent`)(
  "chunking_complete",
  {
    ...BaseProgressEvent.fields,

    /** Final number of chunks produced from the source text. */
    finalChunkCount: PosInt.pipe(
      $I.annoteKey("ChunkingCompleteEvent.finalChunkCount", {
        description: "Final number of chunks produced from the source text.",
      })
    ),

    /** Observed mean chunk size in source-text characters. */
    actualAvgChunkSize: PosInt.pipe(
      $I.annoteKey("ChunkingCompleteEvent.actualAvgChunkSize", {
        description: "Observed mean chunk size in source-text characters.",
      })
    ),

    /** Elapsed chunking time in milliseconds. */
    durationMs: PosInt.pipe(
      $I.annoteKey("ChunkingCompleteEvent.durationMs", {
        description: "Elapsed chunking time in milliseconds.",
      })
    ),
  },
  $I.annote("ChunkingCompleteEvent", {
    description: "Extraction lifecycle event summarizing successful text chunking.",
  })
) {}

/**
 * Identifies the chunk entering the extraction pipeline and carries a bounded
 * source preview for operator feedback.
 *
 * **Example** (Create a chunk-processing event)
 *
 * ```ts
 * import { ChunkProcessingStartedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ChunkProcessingStartedEvent)({
 *   _tag: "chunk_processing_started",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:04Z",
 *   overallProgress: 12, chunkIndex: 0, chunkTextLength: 480, textPreview: "Ada founded Acme."
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ChunkProcessingStartedEvent extends S.TaggedClass<ChunkProcessingStartedEvent>(
  $I`ChunkProcessingStartedEvent`
)(
  "chunk_processing_started",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk entering pipeline processing. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("ChunkProcessingStartedEvent.chunkIndex", {
        description: "Zero-based index of the chunk entering pipeline processing.",
      })
    ),

    /** Number of source-text characters in the chunk. */
    chunkTextLength: PosInt.pipe(
      $I.annoteKey("ChunkProcessingStartedEvent.chunkTextLength", {
        description: "Number of source-text characters in the chunk.",
      })
    ),

    /** Preview containing at most the first 200 characters of the chunk. */
    textPreview: S.String.pipe(
      S.check(S.isMaxLength(200)),
      $I.annoteKey("ChunkProcessingStartedEvent.textPreview", {
        description: "Preview containing at most the first 200 characters of the chunk.",
      })
    ),
  },
  $I.annote("ChunkProcessingStartedEvent", {
    description: "Extraction lifecycle event emitted when full processing begins for one chunk.",
  })
) {}

/**
 * Reports mention-detection progress and the number of mentions accumulated for
 * the active chunk.
 *
 * **Example** (Create a mention-progress event)
 *
 * ```ts
 * import { MentionExtractionProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(MentionExtractionProgressEvent)({
 *   _tag: "mention_extraction_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:05Z",
 *   overallProgress: 20, chunkIndex: 0, phaseProgress: 50, mentionCount: 7
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class MentionExtractionProgressEvent extends S.TaggedClass<MentionExtractionProgressEvent>(
  $I`MentionExtractionProgressEvent`
)(
  "mention_extraction_progress",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk undergoing mention extraction. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("MentionExtractionProgressEvent.chunkIndex", {
        description: "Zero-based index of the chunk undergoing mention extraction.",
      })
    ),

    /** Completion percentage for mention extraction within the active chunk. */
    phaseProgress: ProgressPercentage.pipe(
      $I.annoteKey("MentionExtractionProgressEvent.phaseProgress", {
        description: "Completion percentage for mention extraction within the active chunk.",
      })
    ),

    /** Number of mentions detected in the active chunk so far. */
    mentionCount: NonNegativeInt.pipe(
      $I.annoteKey("MentionExtractionProgressEvent.mentionCount", {
        description: "Number of mentions detected in the active chunk so far.",
      })
    ),
  },
  $I.annote("MentionExtractionProgressEvent", {
    description: "Periodic progress snapshot for mention extraction within one chunk.",
  })
) {}

/**
 * Reports entity-resolution progress and candidate-class activity for the active
 * chunk.
 *
 * **Example** (Create an entity-progress event)
 *
 * ```ts
 * import { EntityExtractionProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(EntityExtractionProgressEvent)({
 *   _tag: "entity_extraction_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:06Z",
 *   overallProgress: 30, chunkIndex: 0, phaseProgress: 60, entityCount: 4, candidateClassCount: 12
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class EntityExtractionProgressEvent extends S.TaggedClass<EntityExtractionProgressEvent>(
  $I`EntityExtractionProgressEvent`
)(
  "entity_extraction_progress",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk undergoing entity extraction. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("EntityExtractionProgressEvent.chunkIndex", {
        description: "Zero-based index of the chunk undergoing entity extraction.",
      })
    ),

    /** Completion percentage for entity extraction within the active chunk. */
    phaseProgress: ProgressPercentage.pipe(
      $I.annoteKey("EntityExtractionProgressEvent.phaseProgress", {
        description: "Completion percentage for entity extraction within the active chunk.",
      })
    ),

    /** Number of entities extracted from the active chunk so far. */
    entityCount: NonNegativeInt.pipe(
      $I.annoteKey("EntityExtractionProgressEvent.entityCount", {
        description: "Number of entities extracted from the active chunk so far.",
      })
    ),

    /** Number of ontology classes considered during entity extraction. */
    candidateClassCount: PosInt.pipe(
      $I.annoteKey("EntityExtractionProgressEvent.candidateClassCount", {
        description: "Number of ontology classes considered during entity extraction.",
      })
    ),
  },
  $I.annote("EntityExtractionProgressEvent", {
    description: "Periodic progress snapshot for entity extraction within one chunk.",
  })
) {}

/**
 * Carries a sampled entity discovery for live inspection without requiring the
 * client to wait for the final graph.
 *
 * **Example** (Create a sampled entity event)
 *
 * ```ts
 * import { EntityFoundEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(EntityFoundEvent)({
 *   _tag: "entity_found",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:07Z",
 *   overallProgress: 35, chunkIndex: 0, entityId: "entity:ada", mention: "Ada", types: ["Person"]
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class EntityFoundEvent extends S.TaggedClass<EntityFoundEvent>($I`EntityFoundEvent`)(
  "entity_found",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk in which the entity was found. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("EntityFoundEvent.chunkIndex", {
        description: "Zero-based index of the chunk in which the entity was found.",
      })
    ),

    /** Stable identifier assigned to the extracted entity. */
    entityId: S.String.pipe(
      $I.annoteKey("EntityFoundEvent.entityId", {
        description: "Stable identifier assigned to the extracted entity.",
      })
    ),

    /** Source-text mention associated with the extracted entity. */
    mention: S.String.pipe(
      $I.annoteKey("EntityFoundEvent.mention", {
        description: "Source-text mention associated with the extracted entity.",
      })
    ),

    /** Ontology class identifiers assigned to the extracted entity. */
    types: S.Array(S.String).pipe(
      $I.annoteSchema("EntityFoundTypes", {
        description: "Ontology class identifiers assigned to one extracted entity.",
      }),
      $I.annoteKey("EntityFoundEvent.types", {
        description: "Ontology class identifiers assigned to the extracted entity.",
      })
    ),

    /** Optional confidence assigned to this sampled entity extraction. */
    confidence: Confidence.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("EntityFoundEvent.confidence", {
        description: "Optional confidence assigned to this sampled entity extraction.",
      })
    ),
  },
  $I.annote("EntityFoundEvent", {
    description: "Sampled domain event exposing one extracted entity during streaming.",
  })
) {}

/**
 * Reports relation-extraction progress together with the entity population
 * available to the active chunk.
 *
 * **Example** (Create a relation-progress event)
 *
 * ```ts
 * import { RelationExtractionProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(RelationExtractionProgressEvent)({
 *   _tag: "relation_extraction_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:08Z",
 *   overallProgress: 45, chunkIndex: 0, phaseProgress: 40, relationCount: 2, entityCount: 4
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class RelationExtractionProgressEvent extends S.TaggedClass<RelationExtractionProgressEvent>(
  $I`RelationExtractionProgressEvent`
)(
  "relation_extraction_progress",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk undergoing relation extraction. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("RelationExtractionProgressEvent.chunkIndex", {
        description: "Zero-based index of the chunk undergoing relation extraction.",
      })
    ),

    /** Completion percentage for relation extraction within the active chunk. */
    phaseProgress: ProgressPercentage.pipe(
      $I.annoteKey("RelationExtractionProgressEvent.phaseProgress", {
        description: "Completion percentage for relation extraction within the active chunk.",
      })
    ),

    /** Number of relations extracted from the active chunk so far. */
    relationCount: NonNegativeInt.pipe(
      $I.annoteKey("RelationExtractionProgressEvent.relationCount", {
        description: "Number of relations extracted from the active chunk so far.",
      })
    ),

    /** Number of extracted entities available as relation endpoints. */
    entityCount: NonNegativeInt.pipe(
      $I.annoteKey("RelationExtractionProgressEvent.entityCount", {
        description: "Number of extracted entities available as relation endpoints.",
      })
    ),
  },
  $I.annote("RelationExtractionProgressEvent", {
    description: "Periodic progress snapshot for relation extraction within one chunk.",
  })
) {}

/**
 * Carries a sampled relation discovery with enough information to distinguish an
 * entity reference from a scalar literal.
 *
 * **Example** (Create a sampled relation event)
 *
 * ```ts
 * import { RelationFoundEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(RelationFoundEvent)({
 *   _tag: "relation_found",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:09Z",
 *   overallProgress: 50, chunkIndex: 0, subjectId: "entity:ada", predicate: "schema:worksFor",
 *   object: "entity:acme", isEntityReference: true
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class RelationFoundEvent extends S.TaggedClass<RelationFoundEvent>($I`RelationFoundEvent`)(
  "relation_found",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk in which the relation was found. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("RelationFoundEvent.chunkIndex", {
        description: "Zero-based index of the chunk in which the relation was found.",
      })
    ),

    /** Identifier of the extracted relation subject. */
    subjectId: S.String.pipe(
      $I.annoteKey("RelationFoundEvent.subjectId", {
        description: "Identifier of the extracted relation subject.",
      })
    ),

    /** Ontology predicate IRI connecting the subject and object. */
    predicate: S.String.pipe(
      $I.annoteKey("RelationFoundEvent.predicate", {
        description: "Ontology predicate IRI connecting the subject and object.",
      })
    ),

    /** Entity identifier or scalar literal used as the relation object. */
    object: S.Union([S.String, S.Finite, S.Boolean]).pipe(
      $I.annoteSchema("RelationFoundObject", {
        description: "Entity identifier or scalar literal used as an extracted relation object.",
      }),
      $I.annoteKey("RelationFoundEvent.object", {
        description: "Entity identifier or scalar literal used as the relation object.",
      })
    ),

    /** Whether object identifies another entity rather than a scalar literal. */
    isEntityReference: S.Boolean.pipe(
      $I.annoteKey("RelationFoundEvent.isEntityReference", {
        description: "Whether object identifies another entity rather than a scalar literal.",
      })
    ),

    /** Optional confidence assigned to this sampled relation extraction. */
    confidence: Confidence.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("RelationFoundEvent.confidence", {
        description: "Optional confidence assigned to this sampled relation extraction.",
      })
    ),
  },
  $I.annote("RelationFoundEvent", {
    description: "Sampled domain event exposing one extracted relation during streaming.",
  })
) {}

/**
 * Reports how many candidate relations have been verified and how many satisfy
 * the configured grounding threshold.
 *
 * **Example** (Create a grounding-progress event)
 *
 * ```ts
 * import { GroundingProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(GroundingProgressEvent)({
 *   _tag: "grounding_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:10Z",
 *   overallProgress: 60, chunkIndex: 0, verifiedRelations: 5, groundedRelations: 4,
 *   confidenceThreshold: 0.8
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class GroundingProgressEvent extends S.TaggedClass<GroundingProgressEvent>($I`GroundingProgressEvent`)(
  "grounding_progress",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk undergoing grounding verification. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("GroundingProgressEvent.chunkIndex", {
        description: "Zero-based index of the chunk undergoing grounding verification.",
      })
    ),

    /** Number of candidate relations checked by the grounding stage. */
    verifiedRelations: NonNegativeInt.pipe(
      $I.annoteKey("GroundingProgressEvent.verifiedRelations", {
        description: "Number of candidate relations checked by the grounding stage.",
      })
    ),

    /** Number of verified relations meeting the grounding threshold. */
    groundedRelations: NonNegativeInt.pipe(
      $I.annoteKey("GroundingProgressEvent.groundedRelations", {
        description: "Number of verified relations meeting the grounding threshold.",
      })
    ),

    /** Minimum confidence required for a relation to count as grounded. */
    confidenceThreshold: Confidence.pipe(
      $I.annoteKey("GroundingProgressEvent.confidenceThreshold", {
        description: "Minimum confidence required for a relation to count as grounded.",
      })
    ),
  },
  $I.annote("GroundingProgressEvent", {
    description: "Periodic progress snapshot for relation grounding within one chunk.",
  })
) {}

/**
 * Summarizes the results, duration, and non-fatal diagnostics produced after one
 * chunk completes every extraction phase.
 *
 * **Example** (Create a chunk-complete event)
 *
 * ```ts
 * import { ChunkProcessingCompleteEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ChunkProcessingCompleteEvent)({
 *   _tag: "chunk_processing_complete",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:11Z",
 *   overallProgress: 70, chunkIndex: 0, entityCount: 4, relationCount: 3, durationMs: 850
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ChunkProcessingCompleteEvent extends S.TaggedClass<ChunkProcessingCompleteEvent>(
  $I`ChunkProcessingCompleteEvent`
)(
  "chunk_processing_complete",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk that completed processing. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("ChunkProcessingCompleteEvent.chunkIndex", {
        description: "Zero-based index of the chunk that completed processing.",
      })
    ),

    /** Number of entities extracted from the completed chunk. */
    entityCount: NonNegativeInt.pipe(
      $I.annoteKey("ChunkProcessingCompleteEvent.entityCount", {
        description: "Number of entities extracted from the completed chunk.",
      })
    ),

    /** Number of relations extracted from the completed chunk. */
    relationCount: NonNegativeInt.pipe(
      $I.annoteKey("ChunkProcessingCompleteEvent.relationCount", {
        description: "Number of relations extracted from the completed chunk.",
      })
    ),

    /** Elapsed processing time for the chunk in milliseconds. */
    durationMs: PosInt.pipe(
      $I.annoteKey("ChunkProcessingCompleteEvent.durationMs", {
        description: "Elapsed processing time for the chunk in milliseconds.",
      })
    ),

    /** Optional ordered diagnostics from recoverable chunk-processing failures. */
    errors: S.Array(
      S.Struct({
        /** Pipeline phase that produced the non-fatal diagnostic. */
        phase: S.String.pipe(
          $I.annoteKey("ChunkProcessingCompleteEvent.errors.phase", {
            description: "Pipeline phase that produced the non-fatal diagnostic.",
          })
        ),
        /** Human-readable description of the non-fatal processing error. */
        message: S.String.pipe(
          $I.annoteKey("ChunkProcessingCompleteEvent.errors.message", {
            description: "Human-readable description of the non-fatal processing error.",
          })
        ),
      }).pipe(
        $I.annoteSchema("ChunkProcessingCompleteEventError", {
          description: "Non-fatal phase diagnostic recorded while processing a chunk.",
        })
      )
    ).pipe(
      $I.annoteSchema("ChunkProcessingCompleteEventErrors", {
        description: "Ordered collection of recoverable diagnostics produced while processing one chunk.",
      }),
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ChunkProcessingCompleteEvent.errors", {
        description: "Optional ordered diagnostics from recoverable chunk-processing failures.",
      })
    ),
  },
  $I.annote("ChunkProcessingCompleteEvent", {
    description: "Extraction lifecycle event summarizing the completed processing of one chunk.",
  })
) {}

/**
 * Publishes the final graph counts, chunk outcomes, and wall-clock duration after
 * an extraction completes successfully.
 *
 * **Example** (Create an extraction-complete event)
 *
 * ```ts
 * import { ExtractionCompleteEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ExtractionCompleteEvent)({
 *   _tag: "extraction_complete",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:12Z",
 *   overallProgress: 100, totalEntities: 40, totalRelations: 28, uniqueEntityTypes: 6,
 *   totalDurationMs: 5000, successfulChunks: 8, failedChunks: 0
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ExtractionCompleteEvent extends S.TaggedClass<ExtractionCompleteEvent>($I`ExtractionCompleteEvent`)(
  "extraction_complete",
  {
    ...BaseProgressEvent.fields,

    /** Total number of entities in the merged knowledge graph. */
    totalEntities: NonNegativeInt.pipe(
      $I.annoteKey("ExtractionCompleteEvent.totalEntities", {
        description: "Total number of entities in the merged knowledge graph.",
      })
    ),

    /** Total number of relations in the merged knowledge graph. */
    totalRelations: NonNegativeInt.pipe(
      $I.annoteKey("ExtractionCompleteEvent.totalRelations", {
        description: "Total number of relations in the merged knowledge graph.",
      })
    ),

    /** Number of distinct ontology classes represented by final entities. */
    uniqueEntityTypes: NonNegativeInt.pipe(
      $I.annoteKey("ExtractionCompleteEvent.uniqueEntityTypes", {
        description: "Number of distinct ontology classes represented by final entities.",
      })
    ),

    /** End-to-end extraction duration in milliseconds. */
    totalDurationMs: PosInt.pipe(
      $I.annoteKey("ExtractionCompleteEvent.totalDurationMs", {
        description: "End-to-end extraction duration in milliseconds.",
      })
    ),

    /** Number of chunks that completed every extraction phase. */
    successfulChunks: NonNegativeInt.pipe(
      $I.annoteKey("ExtractionCompleteEvent.successfulChunks", {
        description: "Number of chunks that completed every extraction phase.",
      })
    ),

    /** Number of chunks omitted because of recoverable failures. */
    failedChunks: NonNegativeInt.pipe(
      $I.annoteKey("ExtractionCompleteEvent.failedChunks", {
        description: "Number of chunks omitted because of recoverable failures.",
      })
    ),
  },
  $I.annote("ExtractionCompleteEvent", {
    description: "Terminal domain event summarizing a successfully merged extraction.",
  })
) {}

/**
 * Optional retry policy for a recoverable extraction failure: exponential
 * backoff, fixed delay, or none.
 *
 * **Example** (Construct exponential and no-retry strategies)
 *
 * ```ts
 * import { ExtractionFailedRetryStrategy } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as S from "effect/Schema"
 *
 * const backoff = S.decodeUnknownSync(ExtractionFailedRetryStrategy)({
 *   type: "exponential_backoff",
 *   delayMs: 250,
 *   maxAttempts: 3
 * })
 * const none = S.decodeUnknownSync(ExtractionFailedRetryStrategy)({ type: "none" })
 * console.log(backoff.type) // "exponential_backoff"
 * console.log(none.type) // "none"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractionFailedRetryStrategy = pipe(
  {
    /** Optional initial or fixed retry delay in milliseconds. */
    delayMs: PosInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionFailedEvent.retryStrategy.delayMs", {
        description: "Optional initial or fixed retry delay in milliseconds.",
      })
    ),
    /** Optional upper bound on client retry attempts. */
    maxAttempts: PosInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionFailedEvent.retryStrategy.maxAttempts", {
        description: "Optional upper bound on client retry attempts.",
      })
    ),
  },
  (fields) =>
    S.Union([
      S.Struct({
        /** Selects retry delays that grow exponentially between attempts. */
        type: S.tag("exponential_backoff").pipe(
          $I.annoteKey("ExtractionRetryStrategy.exponentialBackoff.type", {
            description: "Selects retry delays that grow exponentially between attempts.",
          })
        ),
        ...fields,
      }).pipe(
        $I.annoteSchema("ExponentialBackoffRetryStrategy", {
          description: "Retry policy whose delay grows exponentially between attempts.",
        })
      ),
      S.Struct({
        /** Selects a constant delay between retry attempts. */
        type: S.tag("fixed_delay").pipe(
          $I.annoteKey("ExtractionRetryStrategy.fixedDelay.type", {
            description: "Selects a constant delay between retry attempts.",
          })
        ),
        ...fields,
      }).pipe(
        $I.annoteSchema("FixedDelayRetryStrategy", {
          description: "Retry policy that waits a constant delay between attempts.",
        })
      ),
      S.Struct({
        /** Disables automatic retry for the failed extraction. */
        type: S.tag("none").pipe(
          $I.annoteKey("ExtractionRetryStrategy.none.type", {
            description: "Disables automatic retry for the failed extraction.",
          })
        ),
        ...fields,
      }).pipe(
        $I.annoteSchema("NoRetryStrategy", {
          description: "Retry policy explicitly disabling automatic retry attempts.",
        })
      ),
    ]).pipe(
      S.toTaggedUnion("type"),
      $I.annoteSchema("ExtractionFailedRetryStrategy", {
        description: "Optional retry policy for a recoverable extraction failure.",
      })
    )
);

/**
 * Runtime value decoded by {@link ExtractionFailedRetryStrategy}.
 *
 * @see {@link ExtractionFailedRetryStrategy} for the tagged-union schema and retry cases.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionFailedRetryStrategy = typeof ExtractionFailedRetryStrategy.Type;

/**
 * Terminates the stream with systemic failure details, optional retry guidance,
 * and the amount of usable work completed before failure.
 *
 * **Example** (Create a failed-extraction event)
 *
 * ```ts
 * import { ExtractionFailedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ExtractionFailedEvent)({
 *   _tag: "extraction_failed",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:13Z",
 *   overallProgress: 70, errorType: "LlmTimeout", errorMessage: "The model timed out.",
 *   isRecoverable: true
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ExtractionFailedEvent extends S.TaggedClass<ExtractionFailedEvent>($I`ExtractionFailedEvent`)(
  "extraction_failed",
  {
    ...BaseProgressEvent.fields,

    /** Stable classifier for the systemic extraction failure. */
    errorType: S.String.pipe(
      $I.annoteKey("ExtractionFailedEvent.errorType", {
        description: "Stable classifier for the systemic extraction failure.",
      })
    ),

    /** Human-readable explanation of the extraction failure. */
    errorMessage: S.String.pipe(
      $I.annoteKey("ExtractionFailedEvent.errorMessage", {
        description: "Human-readable explanation of the extraction failure.",
      })
    ),

    /** Whether a client may safely attempt the suggested retry or resume strategy. */
    isRecoverable: S.Boolean.pipe(
      $I.annoteKey("ExtractionFailedEvent.isRecoverable", {
        description: "Whether a client may safely attempt the suggested retry or resume strategy.",
      })
    ),

    /** Optional retry policy for a recoverable extraction failure. */
    retryStrategy: ExtractionFailedRetryStrategy.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

    /** Optional usable counts accumulated before the terminal failure. */
    partialResults: S.Struct({
      entityCount: NonNegativeInt.pipe(
        $I.annoteKey("ExtractionFailedEvent.partialResults.entityCount", {
          description: "Number of entities retained before extraction failed.",
        })
      ),
      relationCount: NonNegativeInt.pipe(
        $I.annoteKey("ExtractionFailedEvent.partialResults.relationCount", {
          description: "Number of relations retained before extraction failed.",
        })
      ),
      processedChunks: NonNegativeInt.pipe(
        $I.annoteKey("ExtractionFailedEvent.partialResults.processedChunks", {
          description: "Number of chunks completed before extraction failed.",
        })
      ),
    }).pipe(
      $I.annoteSchema("ExtractionFailedPartialResults", {
        description: "Usable extraction counts accumulated before a terminal failure.",
      }),
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionFailedEvent.partialResults", {
        description: "Optional usable counts accumulated before the terminal failure.",
      })
    ),

    /** Optional zero-based checkpoint from which a resumable extraction may continue. */
    lastSuccessfulChunkIndex: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionFailedEvent.lastSuccessfulChunkIndex", {
        description: "Optional zero-based checkpoint from which a resumable extraction may continue.",
      })
    ),
  },
  $I.annote("ExtractionFailedEvent", {
    description: "Terminal domain event describing a systemic extraction failure and recovery options.",
  })
) {}

/**
 * Terminates the stream after client cancellation while preserving optional
 * partial-result and resume-position information.
 *
 * **Example** (Create a cancellation event)
 *
 * ```ts
 * import { ExtractionCancelledEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(ExtractionCancelledEvent)({
 *   _tag: "extraction_cancelled",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:14Z",
 *   overallProgress: 45, reason: "Requested by operator"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class ExtractionCancelledEvent extends S.TaggedClass<ExtractionCancelledEvent>($I`ExtractionCancelledEvent`)(
  "extraction_cancelled",
  {
    ...BaseProgressEvent.fields,

    /** Human-readable reason supplied for cancelling the extraction. */
    reason: S.String.pipe(
      $I.annoteKey("ExtractionCancelledEvent.reason", {
        description: "Human-readable reason supplied for cancelling the extraction.",
      })
    ),

    /** Optional usable counts accumulated before cancellation. */
    partialResults: S.Struct({
      /** Number of entities retained before cancellation. */
      entityCount: NonNegativeInt.pipe(
        $I.annoteKey("ExtractionCancelledEvent.partialResults.entityCount", {
          description: "Number of entities retained before cancellation.",
        })
      ),
      /** Number of relations retained before cancellation. */
      relationCount: NonNegativeInt.pipe(
        $I.annoteKey("ExtractionCancelledEvent.partialResults.relationCount", {
          description: "Number of relations retained before cancellation.",
        })
      ),
      /** Number of chunks completed before cancellation. */
      processedChunks: NonNegativeInt.pipe(
        $I.annoteKey("ExtractionCancelledEvent.partialResults.processedChunks", {
          description: "Number of chunks completed before cancellation.",
        })
      ),
    }).pipe(
      $I.annoteSchema("ExtractionCancelledPartialResults", {
        description: "Usable extraction counts accumulated before client cancellation.",
      }),
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionCancelledEvent.partialResults", {
        description: "Optional usable counts accumulated before cancellation.",
      })
    ),

    /** Optional zero-based index of the last chunk processed before cancellation. */
    lastProcessedChunkIndex: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExtractionCancelledEvent.lastProcessedChunkIndex", {
        description: "Optional zero-based index of the last chunk processed before cancellation.",
      })
    ),
  },
  $I.annote("ExtractionCancelledEvent", {
    description: "Terminal domain event describing graceful client-requested extraction cancellation.",
  })
) {}

/**
 * Warns that the server event queue is approaching capacity and tells the client
 * how to reduce the risk of event loss.
 *
 * **Example** (Create a critical backpressure warning)
 *
 * ```ts
 * import { BackpressureWarningEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(BackpressureWarningEvent)({
 *   _tag: "backpressure_warning",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:15Z",
 *   overallProgress: 50, queuedEvents: 900, maxQueueSize: 1000, severity: "critical",
 *   recommendedAction: "Acknowledge events more quickly."
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class BackpressureWarningEvent extends S.TaggedClass<BackpressureWarningEvent>($I`BackpressureWarningEvent`)(
  "backpressure_warning",
  {
    ...BaseProgressEvent.fields,

    /** Current number of events awaiting client consumption. */
    queuedEvents: PosInt.pipe(
      $I.annoteKey("BackpressureWarningEvent.queuedEvents", {
        description: "Current number of events awaiting client consumption.",
      })
    ),

    /** Configured event-queue capacity before overflow handling begins. */
    maxQueueSize: PosInt.pipe(
      $I.annoteKey("BackpressureWarningEvent.maxQueueSize", {
        description: "Configured event-queue capacity before overflow handling begins.",
      })
    ),

    /** Whether queue pressure is advisory or immediately threatens event loss. */
    severity: LiteralKit(["warning", "critical"]).pipe(
      $I.annoteSchema("BackpressureSeverity", {
        description: "Closed vocabulary of server queue-pressure severity levels.",
      }),
      $I.annoteKey("BackpressureWarningEvent.severity", {
        description: "Whether queue pressure is advisory or immediately threatens event loss.",
      })
    ),

    /** Concrete client action recommended to restore safe queue headroom. */
    recommendedAction: S.String.pipe(
      $I.annoteKey("BackpressureWarningEvent.recommendedAction", {
        description: "Concrete client action recommended to restore safe queue headroom.",
      })
    ),
  },
  $I.annote("BackpressureWarningEvent", {
    description: "Flow-control event warning that slow client consumption is exhausting server queue capacity.",
  })
) {}

/**
 * Reports a chunk-scoped failure together with the recovery action taken while
 * allowing the extraction stream to continue.
 *
 * **Example** (Create a recoverable error event)
 *
 * ```ts
 * import { RecoverableErrorEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(RecoverableErrorEvent)({
 *   _tag: "error_recoverable",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:16Z",
 *   overallProgress: 55, chunkIndex: 2, errorType: "ParseFailure",
 *   errorMessage: "Model output was invalid.", phase: "entity-extraction", recoveryAction: "skip chunk"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class RecoverableErrorEvent extends S.TaggedClass<RecoverableErrorEvent>($I`RecoverableErrorEvent`)(
  "error_recoverable",
  {
    ...BaseProgressEvent.fields,

    /** Zero-based index of the chunk affected by the recoverable failure. */
    chunkIndex: NonNegativeInt.pipe(
      $I.annoteKey("RecoverableErrorEvent.chunkIndex", {
        description: "Zero-based index of the chunk affected by the recoverable failure.",
      })
    ),

    /** Stable classifier for the recoverable chunk failure. */
    errorType: S.String.pipe(
      $I.annoteKey("RecoverableErrorEvent.errorType", {
        description: "Stable classifier for the recoverable chunk failure.",
      })
    ),

    /** Human-readable explanation of the recoverable failure. */
    errorMessage: S.String.pipe(
      $I.annoteKey("RecoverableErrorEvent.errorMessage", {
        description: "Human-readable explanation of the recoverable failure.",
      })
    ),

    /** Pipeline phase in which the recoverable failure occurred. */
    phase: S.String.pipe(
      $I.annoteKey("RecoverableErrorEvent.phase", {
        description: "Pipeline phase in which the recoverable failure occurred.",
      })
    ),

    /** Action already taken by the server to continue extraction. */
    recoveryAction: S.String.pipe(
      $I.annoteKey("RecoverableErrorEvent.recoveryAction", {
        description: "Action already taken by the server to continue extraction.",
      })
    ),
  },
  $I.annote("RecoverableErrorEvent", {
    description: "Non-terminal domain event describing a recovered chunk-level extraction failure.",
  })
) {}

/**
 * Reports the systemic condition that halted extraction and exposes optional
 * partial results and retry timing.
 *
 * **Example** (Create a rate-limit fatal error)
 *
 * ```ts
 * import { FatalErrorEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(FatalErrorEvent)({
 *   _tag: "error_fatal",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:17Z",
 *   overallProgress: 60, errorType: "LlmRateLimit", errorMessage: "Quota exhausted.", isTemporary: true,
 *   retryAfterMs: 30000
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class FatalErrorEvent extends S.TaggedClass<FatalErrorEvent>($I`FatalErrorEvent`)(
  "error_fatal",
  {
    ...BaseProgressEvent.fields,

    /** Stable classifier for the fatal systemic failure. */
    errorType: S.String.pipe(
      $I.annoteKey("FatalErrorEvent.errorType", {
        description: "Stable classifier for the fatal systemic failure.",
      })
    ),

    /** Human-readable explanation of the fatal failure. */
    errorMessage: S.String.pipe(
      $I.annoteKey("FatalErrorEvent.errorMessage", {
        description: "Human-readable explanation of the fatal failure.",
      })
    ),

    /** Whether the systemic condition may clear without changing the extraction input. */
    isTemporary: S.Boolean.pipe(
      $I.annoteKey("FatalErrorEvent.isTemporary", {
        description: "Whether the systemic condition may clear without changing the extraction input.",
      })
    ),

    /** Optional usable counts accumulated before the fatal failure. */
    partialResults: S.Struct({
      /** Number of entities retained before the fatal failure. */
      entityCount: NonNegativeInt.pipe(
        $I.annoteKey("FatalErrorEvent.partialResults.entityCount", {
          description: "Number of entities retained before the fatal failure.",
        })
      ),
      /** Number of relations retained before the fatal failure. */
      relationCount: NonNegativeInt.pipe(
        $I.annoteKey("FatalErrorEvent.partialResults.relationCount", {
          description: "Number of relations retained before the fatal failure.",
        })
      ),
      /** Number of chunks completed before the fatal failure. */
      processedChunks: NonNegativeInt.pipe(
        $I.annoteKey("FatalErrorEvent.partialResults.processedChunks", {
          description: "Number of chunks completed before the fatal failure.",
        })
      ),
    }).pipe(
      $I.annoteSchema("FatalErrorPartialResults", {
        description: "Usable extraction counts accumulated before a fatal systemic failure.",
      }),
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FatalErrorEvent.partialResults", {
        description: "Optional usable counts accumulated before the fatal failure.",
      })
    ),

    /** Optional server-recommended delay in milliseconds before retrying. */
    retryAfterMs: PosInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FatalErrorEvent.retryAfterMs", {
        description: "Optional server-recommended delay in milliseconds before retrying.",
      })
    ),
  },
  $I.annote("FatalErrorEvent", {
    description: "Terminal domain event describing a fatal systemic extraction failure.",
  })
) {}

// =============================================================================
// Generic Stage Lifecycle Events (used by ExtractionEntityHandler)
// =============================================================================

/**
 * Closed vocabulary of coarse pipeline stages used by generic lifecycle events.
 *
 * **Example** (Recognize a grounding stage)
 *
 * ```ts
 * import * as S from "effect/Schema"
 *
 * const stage = S.Literals(["chunking", "entity_extraction", "relation_extraction", "grounding", "serialization"])
 * console.log(S.is(stage)("grounding")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
const StageType = LiteralKit([
  "chunking",
  "entity_extraction",
  "relation_extraction",
  "grounding",
  "serialization",
]).pipe(
  $I.annoteSchema("StageType", {
    description: "Closed vocabulary of coarse extraction pipeline stages.",
  })
);

/**
 * Announces the start of a coarse pipeline stage when a specialized event is not
 * required.
 *
 * **Example** (Create a stage-start event)
 *
 * ```ts
 * import { StageStartedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(StageStartedEvent)({
 *   _tag: "stage_started",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:18Z",
 *   overallProgress: 0, stage: "serialization"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class StageStartedEvent extends S.TaggedClass<StageStartedEvent>($I`StageStartedEvent`)(
  "stage_started",
  {
    ...BaseProgressEvent.fields,

    /** Pipeline stage that has begun processing. */
    stage: StageType.pipe(
      $I.annoteKey("StageStartedEvent.stage", {
        description: "Pipeline stage that has begun processing.",
      })
    ),
  },
  $I.annote("StageStartedEvent", {
    description: "Generic lifecycle event announcing the start of an extraction stage.",
  })
) {}

/**
 * Reports completion and item counts for a coarse pipeline stage.
 *
 * **Example** (Create a generic stage-progress event)
 *
 * ```ts
 * import { StageProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(StageProgressEvent)({
 *   _tag: "stage_progress",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:19Z",
 *   overallProgress: 80, stage: "serialization", percent: 50, itemsProcessed: 5, itemsTotal: 10
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class StageProgressEvent extends S.TaggedClass<StageProgressEvent>($I`StageProgressEvent`)(
  "stage_progress",
  {
    ...BaseProgressEvent.fields,

    /** Pipeline stage currently reporting progress. */
    stage: StageType.pipe(
      $I.annoteKey("StageProgressEvent.stage", {
        description: "Pipeline stage currently reporting progress.",
      })
    ),

    /** Completion percentage within the named pipeline stage. */
    percent: ProgressPercentage.pipe(
      $I.annoteKey("StageProgressEvent.percent", {
        description: "Completion percentage within the named pipeline stage.",
      })
    ),

    /** Number of stage work items completed so far. */
    itemsProcessed: NonNegativeInt.pipe(
      $I.annoteKey("StageProgressEvent.itemsProcessed", {
        description: "Number of stage work items completed so far.",
      })
    ),

    /** Total number of work items expected by the stage. */
    itemsTotal: NonNegativeInt.pipe(
      $I.annoteKey("StageProgressEvent.itemsTotal", {
        description: "Total number of work items expected by the stage.",
      })
    ),
  },
  $I.annote("StageProgressEvent", {
    description: "Generic progress snapshot for a coarse extraction stage.",
  })
) {}

/**
 * Summarizes the elapsed time and item count after a coarse pipeline stage
 * completes.
 *
 * **Example** (Create a stage-complete event)
 *
 * ```ts
 * import { StageCompletedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(StageCompletedEvent)({
 *   _tag: "stage_completed",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:20Z",
 *   overallProgress: 90, stage: "serialization", durationMs: 30, itemCount: 10
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class StageCompletedEvent extends S.TaggedClass<StageCompletedEvent>($I`StageCompletedEvent`)(
  "stage_completed",
  {
    ...BaseProgressEvent.fields,

    /** Pipeline stage that completed. */
    stage: StageType.pipe(
      $I.annoteKey("StageCompletedEvent.stage", {
        description: "Pipeline stage that completed.",
      })
    ),

    /** Elapsed stage duration in milliseconds. */
    durationMs: NonNegativeInt.pipe(
      $I.annoteKey("StageCompletedEvent.durationMs", {
        description: "Elapsed stage duration in milliseconds.",
      })
    ),

    /** Number of work items completed by the stage. */
    itemCount: NonNegativeInt.pipe(
      $I.annoteKey("StageCompletedEvent.itemCount", {
        description: "Number of work items completed by the stage.",
      })
    ),
  },
  $I.annote("StageCompletedEvent", {
    description: "Generic lifecycle event summarizing a completed extraction stage.",
  })
) {}

/**
 * Reports a bounded delay caused by token, request, or concurrency limits.
 *
 * **Example** (Create a rate-limit event)
 *
 * ```ts
 * import { RateLimitedEvent } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(RateLimitedEvent)({
 *   _tag: "rate_limited",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:21Z",
 *   overallProgress: 65, waitMs: 1000, reason: "requests"
 * })
 * console.log(O.isSome(event)) // true
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class RateLimitedEvent extends S.TaggedClass<RateLimitedEvent>($I`RateLimitedEvent`)(
  "rate_limited",
  {
    ...BaseProgressEvent.fields,

    /** Server-imposed delay in milliseconds before work may continue. */
    waitMs: NonNegativeInt.pipe(
      $I.annoteKey("RateLimitedEvent.waitMs", {
        description: "Server-imposed delay in milliseconds before work may continue.",
      })
    ),

    /** Resource dimension responsible for the rate-limit delay. */
    reason: LiteralKit(["tokens", "requests", "concurrent"]).pipe(
      $I.annoteSchema("RateLimitReason", {
        description: "Closed vocabulary of resource dimensions that may delay extraction work.",
      }),
      $I.annoteKey("RateLimitedEvent.reason", {
        description: "Resource dimension responsible for the rate-limit delay.",
      })
    ),
  },
  $I.annote("RateLimitedEvent", {
    description: "Flow-control event describing a temporary rate-limit delay.",
  })
) {}

// =============================================================================
// Union Type: All Progress Events
// =============================================================================

/**
 * Exhaustive discriminated schema for every event a progress stream may emit.
 *
 * **When to use**
 *
 * Use when decoding any progress event at RPC or WebSocket boundaries before
 * dispatching on `_tag`.
 *
 * **Example** (Identify a progress event)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProgressEvent } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * const isProgressEvent = S.is(ProgressEvent)
 * console.log(isProgressEvent({
 *   _tag: "stage_started",
 *   eventId: "evt-23",
 *   runId: "doc-0123456789ab",
 *   timestamp: "2026-08-11T12:00:22Z",
 *   overallProgress: 0,
 *   stage: "chunking"
 * })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProgressEvent = S.Union([
  ExtractionStartedEvent,
  ChunkingStartedEvent,
  ChunkingProgressEvent,
  ChunkingCompleteEvent,
  ChunkProcessingStartedEvent,
  MentionExtractionProgressEvent,
  EntityExtractionProgressEvent,
  EntityFoundEvent,
  RelationExtractionProgressEvent,
  RelationFoundEvent,
  GroundingProgressEvent,
  ChunkProcessingCompleteEvent,
  ExtractionCompleteEvent,
  ExtractionFailedEvent,
  ExtractionCancelledEvent,
  BackpressureWarningEvent,
  RecoverableErrorEvent,
  FatalErrorEvent,
  // Generic stage lifecycle events
  StageStartedEvent,
  StageProgressEvent,
  StageCompletedEvent,
  RateLimitedEvent,
]).pipe(
  S.toTaggedUnion("_tag"),
  SchemaUtils.withEffectCodecStatics,
  $I.annoteSchema("ProgressEvent", {
    description: "Exhaustive discriminated union of extraction progress stream events.",
  })
);

/**
 * Decoded event value produced by {@link ProgressEvent}.
 *
 * @see {@link ProgressEvent} for the runtime schema and tagged-union helpers.
 * @category type-level
 * @since 0.0.0
 */
export type ProgressEvent = typeof ProgressEvent.Type;

// =============================================================================
// Backpressure Strategy
// =============================================================================

/**
 * Queue-overflow strategy used by progress streaming.
 *
 * **Example** (Recognize overflow policies)
 *
 * ```ts
 * import { BackpressureStrategy } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * console.log(BackpressureStrategy.is.drop_oldest("drop_oldest")) // true
 * console.log(BackpressureStrategy.is.drop_oldest("block_producer")) // false
 * ```
 *
 * @see {@link BackpressureConfig} for the queue policy that selects one of these strategies.
 * @category schemas
 * @since 0.0.0
 */
export const BackpressureStrategy = LiteralKit(["drop_oldest", "drop_newest", "block_producer", "close_stream"]).pipe(
  $I.annoteSchema("BackpressureStrategy", {
    description: "Deterministic queue-overflow policies supported by progress streaming.",
  })
);

/**
 * Runtime value accepted by {@link BackpressureStrategy}.
 *
 * @see {@link BackpressureStrategy} for the closed literal set and guards.
 * @category type-level
 * @since 0.0.0
 */
export type BackpressureStrategy = typeof BackpressureStrategy.Type;

/**
 * Configuration that bounds the server event queue and selects an overflow
 * strategy when a client consumes progress more slowly than it is produced.
 *
 * **Details**
 *
 * This policy configures stream infrastructure; it is not itself transmitted as
 * a progress event.
 *
 * **Example** (Configure bounded event delivery)
 *
 * ```ts
 * import { BackpressureConfig } from "@effect-ontology/Contract/ProgressStreaming"
 * import { Duration } from "effect"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeSync(BackpressureConfig)({
 *   maxQueueSize: 500,
 *   warningThreshold: 0.75,
 *   strategy: "block_producer",
 *   blockTimeout: Duration.seconds(2),
 *   detailedEventSampleRate: 0.25
 * })
 * console.log(config.strategy) // "block_producer"
 * console.log(BackpressureConfig.make({}).maxQueueSize) // 1000
 * ```
 *
 * @see {@link BackpressureStrategy} for the overflow policies this config selects.
 * @category configuration
 * @since 0.0.0
 */
export class BackpressureConfig extends S.Class<BackpressureConfig>($I`BackpressureConfig`)(
  {
    maxQueueSize: PosInt.pipe(SchemaDefaults.withKeyDefaults(PosInt.make(1000))),
    warningThreshold: UnitInterval.pipe(SchemaDefaults.withKeyDefaults(UnitInterval.make(0.8))),
    strategy: BackpressureStrategy.pipe(SchemaDefaults.withKeyDefaults(BackpressureStrategy.Enum.drop_oldest)),
    blockTimeout: S.Duration.pipe(SchemaDefaults.withKeyDefaults(Duration.seconds(5))),
    detailedEventSampleRate: UnitInterval.pipe(SchemaDefaults.withKeyDefaults(UnitInterval.make(0.1))),
  },
  $I.annote("BackpressureConfig", {
    description: "Capacity, warning, overflow, blocking, and sampling policy for progress-event queues.",
  })
) {}

/**
 * Constructor input accepted by {@link BackpressureConfig}.
 *
 * @see {@link BackpressureConfig} for the runtime schema and constructor defaults.
 * @category type-level
 * @since 0.0.0
 */
export type BackpressureConfigInput = (typeof BackpressureConfig)["~type.make.in"];

/**
 * Conservative queue policy that warns at 80 percent capacity, drops the oldest
 * event on overflow, and samples detailed discoveries at 10 percent.
 *
 * **Example** (Inspect the default queue limit)
 *
 * ```ts
 * import { DefaultBackpressureConfig } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * console.log(DefaultBackpressureConfig.maxQueueSize) // 1000
 * console.log(DefaultBackpressureConfig.strategy) // "drop_oldest"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DefaultBackpressureConfig = BackpressureConfig.make({});

// =============================================================================
// Cancellation Semantics
// =============================================================================

/**
 * Client command requesting graceful termination of an active extraction run.
 *
 * **Example** (Request cancellation)
 *
 * ```ts
 * import { CancellationRequest } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const request = S.decodeUnknownOption(CancellationRequest)({ runId: "doc-0123456789ab", savePartialResults: true })
 * console.log(O.isSome(request)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class CancellationRequest extends S.Class<CancellationRequest>($I`CancellationRequest`)(
  S.Struct({
    /** Identifier of the active extraction run to cancel. */
    runId: ExtractionRunId.pipe(
      $I.annoteKey("CancellationRequest.runId", {
        description: "Identifier of the active extraction run to cancel.",
      })
    ),

    /** Optional human-readable reason supplied by the client. */
    reason: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CancellationRequest.reason", {
        description: "Optional human-readable reason supplied by the client.",
      })
    ),

    /** Optional request to persist usable partial results before termination. */
    savePartialResults: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CancellationRequest.savePartialResults", {
        description: "Optional request to persist usable partial results before termination.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CancellationRequestFields", {
      description: "Decoded fields carried by an extraction cancellation request.",
    })
  ),
  $I.annote("CancellationRequest", {
    description: "Client command requesting graceful cancellation of an extraction run.",
  })
) {}

/**
 * Server acknowledgment stating whether a cancellation request was accepted.
 *
 * **Example** (Acknowledge cancellation)
 *
 * ```ts
 * import { CancellationResponse } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const response = S.decodeUnknownOption(CancellationResponse)({
 *   runId: "doc-0123456789ab", accepted: true, timestamp: "2026-08-11T12:00:23Z"
 * })
 * console.log(O.isSome(response)) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class CancellationResponse extends S.Class<CancellationResponse>($I`CancellationResponse`)(
  S.Struct({
    /** Identifier of the extraction run addressed by the response. */
    runId: ExtractionRunId.pipe(
      $I.annoteKey("CancellationResponse.runId", {
        description: "Identifier of the extraction run addressed by the response.",
      })
    ),

    /** Whether the server accepted the cancellation request. */
    accepted: S.Boolean.pipe(
      $I.annoteKey("CancellationResponse.accepted", {
        description: "Whether the server accepted the cancellation request.",
      })
    ),

    /** Optional explanation when the server rejects cancellation. */
    rejectionReason: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CancellationResponse.rejectionReason", {
        description: "Optional explanation when the server rejects cancellation.",
      })
    ),

    /** Server timestamp at which the response was created. */
    timestamp: ISOStr.pipe(
      $I.annoteKey("CancellationResponse.timestamp", {
        description: "Server timestamp at which the response was created.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CancellationResponseFields", {
      description: "Decoded fields carried by an extraction cancellation response.",
    })
  ),
  $I.annote("CancellationResponse", {
    description: "Server acknowledgment of an extraction cancellation request.",
  })
) {}

// =============================================================================
// Error Recovery Contract
// =============================================================================

/**
 * Type-level protocol describing stream termination, partial-result, and client
 * recovery behavior for each failure class.
 *
 * **Example** (Describe recovery semantics)
 *
 * ```ts
 * import { ErrorRecoverySemantics } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * const semantics = ErrorRecoverySemantics.make({
 *   systemicErrors: {
 *     fatal: true,
 *     streamEnds: true,
 *     partialResults: true,
 *     resumable: "some"
 *   },
 *   contentErrors: {
 *     fatal: false,
 *     streamEnds: false,
 *     partialResults: false,
 *     chunkSkipped: true,
 *     continuesWithNextChunk: true
 *   },
 *   backpressure: {
 *     fatal: false,
 *     streamEnds: "maybe",
 *     eventLossPossible: true,
 *     clientShouldAction: true
 *   },
 *   clientCancellation: {
 *     fatal: false,
 *     streamEnds: true,
 *     graceful: true,
 *     partialResults: true
 *   }
 * })
 * console.log(semantics.clientCancellation.streamEnds) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class ErrorRecoverySemantics extends S.Class<ErrorRecoverySemantics>($I`ErrorRecoverySemantics`)(
  {
    /**
     * Systemic Errors (LlmTimeout, LlmRateLimit, DatabaseConnection, etc.)
     *
     * - Emit ExtractionFailedEvent with isRecoverable = true/false
     * - Extraction stream ends
     * - Partial results available in event
     * - Client can:
     *   - Resume from lastSuccessfulChunkIndex (if resumable)
     *   - Retry entire extraction from beginning
     *   - Accept partial results
     *
     * LlmRateLimit specifically:
     * - isTemporary = true
     * - retryAfterMs indicates wait duration
     * - Client should wait and retry (exponential backoff recommended)
     */
    systemicErrors: S.Struct({
      /** Systemic failures are fatal to the active extraction attempt. */
      fatal: S.Literal(true),
      /** The progress stream terminates after a systemic failure. */
      streamEnds: S.Literal(true),
      /** The terminal event may carry usable work completed before failure. */
      partialResults: S.Literal(true),
      /** Resumption is available only when a successful chunk checkpoint exists. */
      resumable: S.Literal("some"),
    }),

    /**
     * Content Errors (Entity extraction fails for a chunk, but other chunks ok)
     *
     * - Emit RecoverableErrorEvent
     * - Extraction continues with next chunk
     * - This chunk contributes empty results
     * - Client sees stream continue, progress updates after error
     *
     * Examples:
     * - LLM returns unparseable response for one chunk
     * - Grounding verification times out for one chunk
     * - Text preprocessing fails for one chunk
     */
    contentErrors: S.Struct({
      /** Content failures do not halt the overall extraction. */
      fatal: S.Literal(false),
      /** The progress stream remains open after a content failure. */
      streamEnds: S.Literal(false),
      /** The failed chunk contributes no partial entity or relation payload. */
      partialResults: S.Literal(false),
      /** The chunk that produced the content failure is omitted. */
      chunkSkipped: S.Literal(true),
      /** Processing advances to the next available chunk. */
      continuesWithNextChunk: S.Literal(true),
    }),

    /**
     * Backpressure (Client consuming too slowly)
     *
     * - Emit BackpressureWarningEvent
     * - If client doesn't speed up:
     *   - Based on config.strategy: drop_oldest | drop_newest | block_producer | close_stream
     *   - Event loss may occur
     * - Client should increase parallelism or event consumption rate
     * - Extraction continues server-side regardless
     */
    backpressure: S.Struct({
      /** Queue pressure does not itself fail server-side extraction. */
      fatal: S.Literal(false),
      /** The stream closes only when the configured overflow strategy requires it. */
      streamEnds: S.Literal("maybe"),
      /** Drop strategies may discard queued progress events. */
      eventLossPossible: S.Literal(true),
      /** The client should accelerate consumption or acknowledgment. */
      clientShouldAction: S.Literal(true),
    }),

    /**
     * Client Cancellation
     *
     * - Client sends CancellationRequest
     * - Server emits ExtractionCancelledEvent
     * - Extraction stream ends gracefully
     * - Partial results available
     * - Server cleans up resources
     */
    clientCancellation: S.Struct({
      /** Client cancellation is an expected control path rather than a failure. */
      fatal: S.Literal(false),
      /** Acknowledged cancellation terminates the active stream. */
      streamEnds: S.Literal(true),
      /** The server releases extraction resources through its normal cleanup path. */
      graceful: S.Literal(true),
      /** The terminal cancellation event may carry usable completed work. */
      partialResults: S.Literal(true),
    }),
  },
  $I.annote("ErrorRecoverySemantics", {
    description: "Canonical stream termination, partial-result, and client recovery behavior by failure class.",
  })
) {}

/**
 * Canonical recovery behavior clients can consult when implementing progress
 * stream state transitions.
 *
 * **Example** (Inspect content-error behavior)
 *
 * ```ts
 * import { ErrorRecoverySemanticsSpec } from "@effect-ontology/Contract/ProgressStreaming"
 *
 * console.log(ErrorRecoverySemanticsSpec.contentErrors.continuesWithNextChunk) // true
 * console.log(ErrorRecoverySemanticsSpec.systemicErrors.streamEnds) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ErrorRecoverySemanticsSpec = ErrorRecoverySemantics.make({
  systemicErrors: {
    fatal: true,
    streamEnds: true,
    partialResults: true,
    resumable: "some",
  },
  contentErrors: {
    fatal: false,
    streamEnds: false,
    partialResults: false,
    chunkSkipped: true,
    continuesWithNextChunk: true,
  },
  backpressure: {
    fatal: false,
    streamEnds: "maybe",
    eventLossPossible: true,
    clientShouldAction: true,
  },
  clientCancellation: {
    fatal: false,
    streamEnds: true,
    graceful: true,
    partialResults: true,
  },
});

// =============================================================================
// RPC Message Contract (JSON-serializable wrapper)
// =============================================================================

/**
 * RPC-safe envelope carrying either one decoded progress event or a serialization
 * diagnostic produced at the transport boundary.
 *
 * **Example** (Wrap a stage event)
 *
 * ```ts
 * import { ProgressMessage } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const data = {
 *   _tag: "stage_started",
 *   eventId: "00000000-0000-4000-8000-000000000001", runId: "doc-0123456789ab", timestamp: "2026-08-11T12:00:24Z",
 *   overallProgress: 0, stage: "chunking"
 * }
 * const message = S.decodeUnknownOption(ProgressMessage)({
 *   _tag: "progress", data, createdAt: "2026-08-11T12:00:24Z" })
 * console.log(O.isSome(message)) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class ProgressMessage extends S.TaggedClass<ProgressMessage>($I`ProgressMessage`)(
  "progress",
  {
    /** Progress event payload or serialization diagnostic. */
    data: S.Union([
      ProgressEvent,
      S.TaggedStruct("serialization_error", {
        /** Discriminator of the progress event that could not be serialized. */
        eventTag: S.String.pipe(
          $I.annoteKey("ProgressSerializationError.eventTag", {
            description: "Discriminator of the progress event that could not be serialized.",
          })
        ),
        /** Human-readable description of the serialization failure. */
        originalError: S.String.pipe(
          $I.annoteKey("ProgressSerializationError.originalError", {
            description: "Human-readable description of the serialization failure.",
          })
        ),
      }).pipe(
        $I.annoteSchema("ProgressSerializationError", {
          description: "Transport-safe diagnostic replacing a progress event that could not be serialized.",
        })
      ),
    ]).pipe(
      $I.annoteSchema("ProgressMessageData", {
        description: "Progress event or transport-safe serialization diagnostic carried by an RPC message.",
      }),
      $I.annoteKey("ProgressMessage.data", {
        description: "Progress event payload or serialization diagnostic.",
      })
    ),

    /** Server timestamp at which the transport envelope was created. */
    createdAt: ISOStr.pipe(
      $I.annoteKey("ProgressMessage.createdAt", {
        description: "Server timestamp at which the transport envelope was created.",
      })
    ),
  },
  $I.annote("ProgressMessage", {
    description: "RPC-safe envelope for one extraction progress event or serialization diagnostic.",
  })
) {}

// =============================================================================
// WebSocket Contract Layer (Protocol)
// =============================================================================

/**
 * WebSocket Protocol Contract
 *
 * Defines the message flow between client and server.
 *
 * CLIENT → SERVER:
 * 1. StartExtractionRequest: { runId?, text, config }
 * 2. CancellationRequest: { runId, reason? }
 * 3. AckMessage: { eventId } - Acknowledge receipt for backpressure tracking
 *
 * SERVER → CLIENT:
 * 1. StartExtractionResponse: { runId, accepted, error? }
 * 2. ProgressMessage: { data: ProgressEvent, createdAt }
 * 3. CancellationResponse: { runId, accepted, reason? }
 * 4. BackpressureWarningEvent: (special case - client must respond with Ack)
 *
 * Flow:
 * ```
 * CLIENT: StartExtractionRequest
 *    ↓
 * SERVER: StartExtractionResponse { runId, accepted: true }
 *    ↓
 * SERVER: ExtractionStartedEvent
 *    ↓
 * SERVER: [ChunkingStartedEvent, ChunkingProgressEvent*, ChunkingCompleteEvent]
 *    ↓
 * SERVER: [ChunkProcessingStartedEvent, {phase events}*, ChunkProcessingCompleteEvent]*
 *    ↓
 * SERVER: ExtractionCompleteEvent | ExtractionFailedEvent | ExtractionCancelledEvent
 *    ↓
 * [Connection ends or client starts new extraction]
 * ```
 */

/**
 * Client command supplying source text and the execution policy for a new or
 * resumed extraction.
 *
 * **Example** (Start an extraction)
 *
 * ```ts
 * import { StartExtractionRequest } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const request = S.decodeUnknownOption(StartExtractionRequest)({
 *   _tag: "start_extraction",
 *   text: "Ada founded Acme.",
 *   config: {
 *     chunking: { maxChunkSize: 1000, preserveSentences: true },
 *     concurrency: 2,
 *     ontologyPath: "/ontologies/example.ttl"
 *   }
 * })
 * console.log(O.isSome(request)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class StartExtractionRequest extends S.TaggedClass<StartExtractionRequest>($I`StartExtractionRequest`)(
  "start_extraction",
  {
    /** Non-empty source text from which entities and relations will be extracted. */
    text: S.String.pipe(
      S.check(S.isMinLength(1)),
      $I.annoteKey("StartExtractionRequest.text", {
        description: "Non-empty source text from which entities and relations will be extracted.",
      })
    ),

    /** Execution policy for the requested extraction. */
    config: S.Struct({
      /** Text segmentation policy for the requested extraction. */
      chunking: S.Struct({
        /** Maximum number of source characters targeted per chunk. */
        maxChunkSize: PosInt.pipe(
          $I.annoteKey("StartExtractionRequest.config.chunking.maxChunkSize", {
            description: "Maximum number of source characters targeted per chunk.",
          })
        ),
        /** Whether chunk boundaries should preserve complete sentences. */
        preserveSentences: S.Boolean.pipe(
          $I.annoteKey("StartExtractionRequest.config.chunking.preserveSentences", {
            description: "Whether chunk boundaries should preserve complete sentences.",
          })
        ),
      }).pipe(
        $I.annoteSchema("StartExtractionChunkingConfig", {
          description: "Text segmentation policy for a requested extraction.",
        }),
        $I.annoteKey("StartExtractionRequest.config.chunking", {
          description: "Text segmentation policy for the requested extraction.",
        })
      ),
      /** Maximum number of extraction tasks allowed to run concurrently. */
      concurrency: PosInt.pipe(
        $I.annoteKey("StartExtractionRequest.config.concurrency", {
          description: "Maximum number of extraction tasks allowed to run concurrently.",
        })
      ),
      /** Filesystem path of the ontology used to classify extracted concepts. */
      ontologyPath: S.String.pipe(
        $I.annoteKey("StartExtractionRequest.config.ontologyPath", {
          description: "Filesystem path of the ontology used to classify extracted concepts.",
        })
      ),
    }).pipe(
      $I.annoteSchema("StartExtractionConfig", {
        description: "Chunking, concurrency, and ontology settings for a requested extraction.",
      }),
      $I.annoteKey("StartExtractionRequest.config", {
        description: "Execution policy for the requested extraction.",
      })
    ),

    /** Optional existing run identifier used to resume an extraction. */
    runId: ExtractionRunId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("StartExtractionRequest.runId", {
        description: "Optional existing run identifier used to resume an extraction.",
      })
    ),
  },
  $I.annote("StartExtractionRequest", {
    description: "Client command requesting a new or resumed ontology extraction.",
  })
) {}

/**
 * Server acknowledgment that identifies the run and reports whether an extraction
 * request was accepted.
 *
 * **Example** (Accept an extraction request)
 *
 * ```ts
 * import { StartExtractionResponse } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const response = S.decodeUnknownOption(StartExtractionResponse)({
 *   _tag: "start_extraction_response",
 *   runId: "doc-0123456789ab", accepted: true, timestamp: "2026-08-11T12:00:25Z"
 * })
 * console.log(O.isSome(response)) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class StartExtractionResponse extends S.TaggedClass<StartExtractionResponse>($I`StartExtractionResponse`)(
  "start_extraction_response",
  {
    /** Generated or caller-provided identifier of the extraction run. */
    runId: ExtractionRunId.pipe(
      $I.annoteKey("StartExtractionResponse.runId", {
        description: "Generated or caller-provided identifier of the extraction run.",
      })
    ),

    /** Whether the server accepted the extraction request. */
    accepted: S.Boolean.pipe(
      $I.annoteKey("StartExtractionResponse.accepted", {
        description: "Whether the server accepted the extraction request.",
      })
    ),

    /** Optional structured error present when the request is rejected. */
    error: S.Struct({
      /** Stable machine-readable code explaining request rejection. */
      code: S.String.pipe(
        $I.annoteKey("StartExtractionResponse.error.code", {
          description: "Stable machine-readable code explaining request rejection.",
        })
      ),
      /** Human-readable explanation of why the request was rejected. */
      message: S.String.pipe(
        $I.annoteKey("StartExtractionResponse.error.message", {
          description: "Human-readable explanation of why the request was rejected.",
        })
      ),
    }).pipe(
      $I.annoteSchema("StartExtractionError", {
        description: "Structured rejection returned when an extraction request is not accepted.",
      }),
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("StartExtractionResponse.error", {
        description: "Optional structured error present when the request is rejected.",
      })
    ),

    /** Server timestamp at which the response was created. */
    timestamp: ISOStr.pipe(
      $I.annoteKey("StartExtractionResponse.timestamp", {
        description: "Server timestamp at which the response was created.",
      })
    ),
  },
  $I.annote("StartExtractionResponse", {
    description: "Server acknowledgment accepting or rejecting an extraction request.",
  })
) {}

/**
 * Client acknowledgment identifying the progress event released from server-side
 * backpressure accounting.
 *
 * **Example** (Acknowledge an event)
 *
 * ```ts
 * import { AckMessage } from "@effect-ontology/Contract/ProgressStreaming"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const message = S.decodeUnknownOption(AckMessage)({
 *   _tag: "ack",
 *   runId: "doc-0123456789ab", eventId: "00000000-0000-4000-8000-000000000001", timestamp: "2026-08-11T12:00:26Z"
 * })
 * console.log(O.isSome(message)) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class AckMessage extends S.TaggedClass<AckMessage>($I`AckMessage`)(
  "ack",
  {
    /** Extraction run whose event delivery is being acknowledged. */
    runId: ExtractionRunId.pipe(
      $I.annoteKey("AckMessage.runId", {
        description: "Extraction run whose event delivery is being acknowledged.",
      })
    ),

    /** Unique identifier of the progress event received by the client. */
    eventId: UUID.pipe(
      $I.annoteKey("AckMessage.eventId", {
        description: "Unique identifier of the progress event received by the client.",
      })
    ),

    /** Client timestamp at which event receipt was acknowledged. */
    timestamp: ISOStr.pipe(
      $I.annoteKey("AckMessage.timestamp", {
        description: "Client timestamp at which event receipt was acknowledged.",
      })
    ),
  },
  $I.annote("AckMessage", {
    description: "Client acknowledgment used to release one event from backpressure tracking.",
  })
) {}
