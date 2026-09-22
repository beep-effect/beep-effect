// import * as S from "effect/Schema";
// import { $ScratchpadId } from "@beep/identity";
// import { LiteralKit } from "@beep/schema/LiteralKit";
// import * as Tuple from "effect/Tuple";
// import {
//   NonEmptyTrimmedStr,
//   NonNegativeInt,
//   PosInt,
//   SchemaUtils, Timezone,
// } from "@beep/schema";
// import { pipe } from "effect/Function";
// import { URI } from "@beep/rdf";
// import { LanguageCode } from "../effect-ontology/Domain/Schema/index.ts";
//
// const $I = $ScratchpadId.create("tmp/index");
//
// export const ConfidenceLabel = LiteralKit(
//   [
//     "high",
//     "medium",
//     "low",
//   ],
// ).pipe(
//   $I.annoteSchema("ConfidenceLabel", {
//     description: "",
//   }),
// );
//
// export type ConfidenceLabel = typeof ConfidenceLabel.Type;
//
// export const UncertaintyReason = LiteralKit(
//   [
//     "low_quality_transcript",
//     "overlapping_speech",
//     "speaker_uncertain",
//     "subject_ambiguous",
//     "entity_ambiguous",
//     "entity_link_uncertain",
//     "temporal_scope_unclear",
//     "weak_evidence",
//     "inferred_not_stated",
//     "conflicts_with_existing_memory",
//     "conflicts_with_locked_memory",
//     "conflicts_with_reviewed_memory",
//     "duplicate_near_match",
//     "source_truncated",
//     "translation_loss",
//     "sensitive_requires_review",
//     "policy_boundary",
//     "unsupported_by_existing_state",
//   ],
// ).pipe(
//   $I.annoteSchema("UncertaintyReason", {
//     description: "",
//   }),
// );
//
// export type UncertaintyReason = typeof UncertaintyReason.Type;
//
// export const DurabilityLabel = LiteralKit(
//   [
//     "ephemeral", "short_term", "medium_term", "long_term",
//   ],
// ).pipe(
//   $I.annoteSchema("DurabilityLabel", {
//     description: "",
//   }),
// );
//
// export type DurabilityLabel = typeof DurabilityLabel.Type;
//
// export const PipelineMode = LiteralKit(
//   [
//     "production", "shadow", "offline", "backfill",
//   ],
// ).pipe(
//   $I.annoteSchema("PipelineMode", {
//     description: "",
//   }),
// );
//
// export type PipelineMode = typeof PipelineMode.Type;
//
// export const MemoryStatus = LiteralKit(
//   ["active", "inactive", "rejected", "review", "archived"],
// ).pipe(
//   $I.annoteSchema("MemoryStatus", {
//     description: "",
//   }),
// );
//
// export type MemoryStatus = typeof MemoryStatus.Type;
//
//
// export class ModelConfig extends S.Class<ModelConfig>($I`ModelConfig`)({
//     extractorModel: NonEmptyTrimmedStr.pipe(
//       SchemaUtils.withKeyDefaults(NonEmptyTrimmedStr.make("stub")),
//     ),
//     normalizerModel: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     entityLinkerModel: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     conflictResolverModel: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     temperature: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0.0))),
//     maxOutputTokens: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//   },
//   $I.annote("ModelConfig", {
//     description: "",
//   }),
// ) {
// }
//
// export class ThresholdConfig extends S.Class<ThresholdConfig>($I`ThresholdConfig`)(
//   {
//     duplicateTextSimilarity: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0.92))),
//     lowQaualitySttConfidence: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0.55))),
//   },
//   $I.annote("ThresholdConfig", {
//     description: "",
//   }),
// ) {
// }
//
// export class PolicyConfig extends S.Class<PolicyConfig>($I`PolicyConfig`)(
//   {
//     blockCredentials: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//     reviewHighSensitivity: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//     rejectEphemeral: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//   },
//   $I.annote("PolicyConfig", {
//     description: "",
//   }),
// ) {
// }
//
// export class RoutingConfig extends S.Class<RoutingConfig>($I`RoutingConfig`)(
//   {
//     autoCreateHighConfidence: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//     /** relaxed from False post-hallucination-campaign */
//     autoCreateMediumConfidence: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true), $I.annoteKey("RoutingConfig.autoCreateMediumConfidence", {
//       documentation: "relaxed from False post-hallucination-campaign",
//     })),
//     reviewUncertain: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//     reviewLowConfidence: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//     allowSupersession: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//     allowReviewedSupersession: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
//     allowLockedSupersession: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
//     routeTasks: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
//
//   },
//   $I.annote("RoutingConfig", {
//     description: "",
//   }),
// ) {
// }
//
// export class OutputConfig extends S.Class<OutputConfig>($I`OutputConfig`)(
//   {
//     includePrivateInputFingerprint: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
//     vectorNamespace: NonEmptyTrimmedStr.pipe(SchemaUtils.withKeyDefaults(NonEmptyTrimmedStr.make("ns2"))),
//     emitDiagnosticTriplesForRejections: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
//   },
//   $I.annote("OutputConfig", {
//     description: "",
//   }),
// ) {
// }
//
// export class MemoryPipelineConfig extends S.Class<MemoryPipelineConfig>($I`MemoryPipelineConfig`)(
//   {
//     configVersion: NonEmptyTrimmedStr.pipe(SchemaUtils.withKeyDefaults(NonEmptyTrimmedStr.make("memory_pipeline_config.v1"))),
//     pipelineVersion: NonEmptyTrimmedStr.pipe(SchemaUtils.withKeyDefaults(NonEmptyTrimmedStr.make("memory_pipeline.v1"))),
//     ontologyVersion: NonEmptyTrimmedStr.pipe(SchemaUtils.withKeyDefaults(NonEmptyTrimmedStr.make("omi_memory_ontology.v0"))),
//     models: ModelConfig,
//     thresholds: ThresholdConfig,
//     policy: PolicyConfig,
//     routing: RoutingConfig,
//     output: OutputConfig,
//   },
//   $I.annote("MemoryPipelineConfig", {
//     description: "",
//   }),
// ) {
// }
//
// export class SourceRef extends S.Class<SourceRef>($I`SourceRef`)(
//   {
//     conversationId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     transcriptSegmentId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     memoryId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     integrationId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     appId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     documentId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     externalId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     fixtureId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//   },
//   $I.annote("SourceRef", {
//     description: "",
//   }),
// ) {
// }
//
// /**
//  * Signal quality tier for extraction behavior modulation.
//  *
//  */
// export const SourceStrength = LiteralKit(
//   [
//     /** chat_exchange, conversation — clean, intentional */
//     "high",
//     /** voice_transcript, manual_note — some noise */
//     "medium",
//     /** transcript, desktop_rewind, ocr_screenshot_text, ambient_voice */
//     "low",
//     /** benchmark_fixture */
//     "unknown",
//   ],
// ).pipe(
//   $I.annoteSchema("SourceStrength", {
//     description: "Signal quality tier for extraction behavior modulation.",
//   }),
// );
//
// export type SourceStrength = typeof SourceStrength.Type;
//
// export const SourceTypeConfig = SourceStrength.mapMembers((members) => {
//   const make = <T extends SourceStrength>({ literal }: S.Literal<T>) => S.Struct({
//     strength: S.tag(literal),
//     /** human-readable name for the prompt */
//     label: S.String.pipe($I.annoteKey("SourceTypeConfig.label", {
//       description: "human-readable name for the prompt",
//     })),
//     confidenceCap: S.Finite.pipe(S.check(S.isGreaterThanOrEqualTo(0)), SchemaUtils.withKeyDefaults(PosInt.make(1))),
//     requiresCorroboration: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
//     defaultEmptyOnNoise: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
//     guidanceNotes: S.String.pipe(SchemaUtils.withKeyDefaults("")),
//   });
//
//   return pipe(
//     members,
//     Tuple.evolve(
//       [
//         make,
//         make,
//         make,
//         make,
//       ],
//     ),
//   );
// }).pipe(
//   S.toTaggedUnion("strength"),
//   $I.annoteSchema("SourceTypeConfig", {
//     description: "Extensible per-source-type configuration for extraction behavior.",
//     documentation: "To add a new source type:\n" +
//       "      1. Add the literal to SourceDescriptor.source_type\n" +
//       "      2. Add an entry here (or accept UNKNOWN defaults)\n" +
//       "      3. Zero other code changes needed — prompt receives guidance string automatically.",
//   }),
// );
//
// export type SourceTypeConfig = typeof SourceTypeConfig.Type;
//
//
// export const SourceDescriptorType = LiteralKit(
//   [
//     // --- Existing ---
//     "conversation",
//     "transcript",
//     "desktop_rewind",
//     "manual_note",
//     "integration",
//     "import",
//     "developer_api",
//     "benchmark_fixture",
//     //  --- NEW: granular source types ---
//     /** HIGH: intentional user statements in chat UI */
//     "chat_exchange",
//     /** MEDIUM: push-to-talk / recorded voice */
//     "voice_transcript",
//     /** LOW: screen capture OCR output */
//     "ocr_screenshot_text",
//     /** LOW: always-on ambient recording */
//     "ambient_voice",
//   ],
// ).pipe(
//   $I.annoteSchema("SourceDescriptorType", {
//     description: "",
//   }),
// );
//
// export type SourceDescriptorType = typeof SourceDescriptorType.Type;
//
// export const SourceDescriptor = SourceDescriptorType.mapMembers((members) => {
//   const make;
//   <T extends SourceDescriptorType>({ literal }: S.Literal<T>) => S.Struct({
//     sourceType: S.tag(literal),
//     sourceId: S.String,
//     sourceUri: URI.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     capturedAt: S.DateTimeUtcFromDate.pipe(
//       S.OptionFromOptionalKey,
//       SchemaUtils.withNoneDefault,
//     ),
//     timezone: Timezone.pipe(
//       S.OptionFromOptionalKey,
//       SchemaUtils.withNoneDefault,
//     ),
//     language: LanguageCode.pipe(
//       S.OptionFromOptionalKey,
//       SchemaUtils.withNoneDefault,
//     ),
//     metadata: S.Record(S.String, S.Any),
//   });
//
//   return pipe(
//     members,
//     Tuple.evolve(
//       [
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//         make,
//       ],
//     ),
//   );
// }).pipe(
//   S.toTaggedUnion("sourceType"),
//   $I.annoteSchema("SourceDescriptor", {
//     description: "",
//   }),
// );
//
// export type SourceDescriptor = typeof SourceDescriptor.Type;
//
// export class ActorDescriptor extends S.Class<ActorDescriptor>($I`ActorDescriptor`)(
//   {
//     userId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     syntheticUserId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     displayName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
//     knownAliases: S.String.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults),
//     local: LanguageCode.pipe(
//       S.OptionFromOptionalKey,
//       SchemaUtils.withNoneDefault,
//     )
//   },
//   $I.annote("ActorDescriptor", {
//     description: ""
//   })
// ) {}
