/**
 * Service: Extraction Services
 *
 * EntityExtractor and RelationExtractor service contracts.
 * Implements two-stage extraction using LLM with structured output.
 *
 * @since 2.0.0
 * @module Service/Extraction
 */

import { $ScratchpadId } from "@beep/identity";
import { Chunk, Context, Duration, Effect, Layer, Match, Schedule } from "effect";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LanguageModel } from "effect/unstable/ai";
import {
  EntityExtractionFailed,
  MentionExtractionFailed,
  RelationExtractionFailed,
} from "../Domain/Error/Extraction.ts";
import { Entity, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { ClassDefinition, PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { EntityId, IRI } from "../Domain/Model/shared.ts";
import {
  generateStructuredEntityPrompt,
  generateStructuredMentionPrompt,
  generateStructuredRelationPrompt,
} from "../Prompt/index.ts";
import { makeEntitySchema } from "../Schema/EntityFactory.ts";
import type { Mention } from "../Schema/MentionFactory.ts";
import { MentionGraphSchema } from "../Schema/MentionFactory.ts";
import type { RelationGraphType } from "../Schema/RelationFactory.ts";
import { makeRelationSchema } from "../Schema/RelationFactory.ts";
import { annotateExtraction, annotateLlmCall, LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { sha256Sync } from "../Utils/Hash.ts";
import { buildLocalNameToIriMapSafe, expandLocalNameToIri, expandTypesToIris } from "../Utils/Iri.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { generateObjectWithFeedback } from "./GenerateWithFeedback.ts";
import { StageTimeoutService, StageTimeoutServiceLive } from "./LlmControl/StageTimeout.ts";
import { generateObjectWithRetry } from "./LlmWithRetry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Extraction");

export type { Mention };

/**
 * Generate deterministic snake_case ID from mention
 *
 * @internal
 */
const generateEntityId = (mention: string): string =>
  mention
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "_") // Spaces to underscores
    .replace(/_+/g, "_") // Multiple underscores to single
    .replace(/^_|_$/g, "") // Trim leading/trailing underscores
    .replace(/^[0-9]/, "e$&");

/**
 * EntityExtractor - Stage 1 extraction service
 *
 * Extracts entities from text using LLM with structured output.
 *
 * @since 2.0.0
 * @category Services
 */
export class EntityExtractor extends Context.Service<EntityExtractor>()($I`EntityExtractor`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const timeout = yield* StageTimeoutService;

    const llm = yield* LanguageModel.LanguageModel;

    // Create retry schedule from config
    const retrySchedule = Schedule.exponential(Duration.millis(config.runtime.retryInitialDelayMs)).pipe(
      Schedule.modifyDelay(({ duration }) =>
        Effect.succeed(Duration.min(duration, Duration.millis(config.runtime.retryMaxDelayMs)))
      ),
      Schedule.jittered
    );

    // Note: generateObjectWithFeedback handles its own retry logic internally
    // keeping this structure aligned with other services

    return {
      extract: Effect.fn("EntityExtractor.extract")(function* (
        text: string,
        candidates: ReadonlyArray<ClassDefinition>,
        datatypeProperties?: ReadonlyArray<PropertyDefinition>
      ) {
        if (candidates.length === 0) {
          return yield* EntityExtractionFailed.make({
            message: "Cannot extract entities with zero candidate classes",
            text: O.some(text),
          });
        }
        const datatypeProps = datatypeProperties ?? [];
        const structuredPrompt = generateStructuredEntityPrompt(text, candidates, datatypeProps);
        const promptLength = structuredPrompt.systemMessage.length + structuredPrompt.userMessage.length;
        const schema = makeEntitySchema(candidates, datatypeProps);
        yield* Effect.logDebug("Entity extraction stage", {
          stage: "entity-extraction",
          candidateClasses: candidates.length,
          candidateClassIris: candidates.map((c) => c.id).slice(0, 10),
          textLength: text.length,
          textPreview: text.slice(0, 200),
        });
        yield* Effect.logDebug("Entity extraction prompt", {
          stage: "entity-extraction",
          promptLength,
          systemMessageLength: structuredPrompt.systemMessage.length,
          userMessageLength: structuredPrompt.userMessage.length,
          promptPreview: structuredPrompt.systemMessage.slice(0, 500),
        });
        const jsonSchema = S.toJsonSchemaDocument(schema);
        const jsonSchemaText = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(jsonSchema);
        const schemaHash = sha256Sync(jsonSchemaText);
        yield* Effect.logDebug("Entity extraction schema", {
          stage: "entity-extraction",
          schemaIdentifier: "EntityGraph",
          allowedClassCount: candidates.length,
        });
        const response = yield* timeout
          .withTimeout(
            "entity_extraction",
            generateObjectWithFeedback(llm, {
              prompt: structuredPrompt,
              schema,
              objectName: "EntityGraph",
              maxAttempts: config.runtime.retryMaxAttempts,
              serviceName: "EntityExtractor",
              timeoutMs: config.llm.timeoutMs,
              retrySchedule,
              enablePromptCaching: config.llm.enablePromptCaching,
            }),
            () =>
              Effect.logWarning("Entity extraction approaching timeout", {
                stage: "entity-extraction",
                textLength: text.length,
                candidateClasses: candidates.length,
              })
          )
          .pipe(
            Effect.tap((response) =>
              Effect.all([
                Effect.logInfo("Entity extraction LLM response", {
                  stage: "entity-extraction",
                  entityCount: response.value.entities.length,
                  inputTokens: response.usage.inputTokens.total ?? 0,
                  outputTokens: response.usage.outputTokens.total ?? 0,
                }),
                annotateLlmCall({
                  model: config.llm.model,
                  provider: config.llm.provider,
                  promptLength,
                  inputTokens: response.usage.inputTokens.total ?? 0,
                  outputTokens: response.usage.outputTokens.total ?? 0,
                  schemaHash,
                }),
                annotateExtraction({
                  entityCount: response.value.entities.length,
                  candidateClassCount: candidates.length,
                }),
              ])
            ),
            Effect.withSpan("entity-extraction-llm", {
              attributes: {
                [LlmAttributes.PROMPT_LENGTH]: promptLength,
                [LlmAttributes.CANDIDATE_CLASS_COUNT]: candidates.length,
                [LlmAttributes.SCHEMA_HASH]: schemaHash,
              },
            }),
            Effect.mapError((error) =>
              EntityExtractionFailed.make({
                message: `LLM entity extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                cause: O.some(error),
                text: O.some(text),
              })
            )
          );
        const propertyIris: ReadonlyArray<IRI> = (datatypeProps ?? []).map((p) => IRI.fromUnknown(p.id));
        const propertyMapResult = buildLocalNameToIriMapSafe(propertyIris);
        const propertyLocalNameToIriMap = propertyMapResult.map;
        if (propertyMapResult.hasCollisions) {
          yield* Effect.logWarning("Property local name collisions detected - LLM output may map to wrong IRI", {
            collisionCount: MutableHashMap.size(propertyMapResult.collisions),
            collisions: Object.fromEntries(propertyMapResult.collisions),
          });
        }
        const classIris: ReadonlyArray<IRI> = candidates.map((c) => c.id);
        const classMapResult = buildLocalNameToIriMapSafe(classIris);
        const localNameToIriMap = classMapResult.map;
        if (classMapResult.hasCollisions) {
          yield* Effect.logWarning("Class local name collisions detected - LLM output may map to wrong IRI", {
            collisionCount: MutableHashMap.size(classMapResult.collisions),
            collisions: Object.fromEntries(classMapResult.collisions),
          });
        }
        let filteredAttributeCount = 0;
        let skippedEntityCount = 0;
        let droppedKeysCount = 0;
        const toEntity = (entityData: (typeof response.value.entities)[number]): O.Option<Entity> => {
          let entityId = entityData.id;
          if (P.not(P.isTruthy)(entityId) || !/^[a-z][a-z0-9_]*$/.test(entityId)) {
            entityId = generateEntityId(entityData.mention);
          }
          const expandedTypes = expandTypesToIris(entityData.types, localNameToIriMap);
          if (!A.isReadonlyArrayNonEmpty(expandedTypes)) {
            skippedEntityCount++;
            return O.none();
          }
          const attributes: Record<string, string | number | boolean> = {};
          if (O.isSome(entityData.attributes)) {
            for (const [key, value] of Object.entries(entityData.attributes.value)) {
              const expandedKey = expandLocalNameToIri(key, propertyLocalNameToIriMap);
              if (O.isSome(expandedKey)) {
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                  attributes[expandedKey.value] = value;
                }
              } else if (MutableHashMap.size(propertyLocalNameToIriMap) === 0) {
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                  attributes[key] = value;
                }
              } else {
                filteredAttributeCount++;
                droppedKeysCount++;
              }
            }
          }
          return O.some(
            Entity.make({
              id: EntityId.make(entityId),
              mention: entityData.mention,
              types: expandedTypes,
              attributes,
              mentions: O.getOrElse(entityData.mentions, () => []),
            })
          );
        };
        const entities = Chunk.fromIterable(
          A.flatMap(A.take(response.value.entities, 1000), (entityData) => O.toArray(toEntity(entityData)))
        );
        if (skippedEntityCount > 0) {
          yield* Effect.logWarning("Skipped entities with no valid types after expansion", {
            stage: "entity-extraction",
            skippedEntityCount,
            candidateClassCount: classIris.length,
          });
        }
        if (filteredAttributeCount > 0) {
          yield* Effect.logDebug("Filtered invalid attribute keys", {
            stage: "entity-extraction",
            filteredAttributeCount,
            droppedKeysCount,
          });
        }
        const entityArray = Chunk.toReadonlyArray(entities);
        yield* Effect.logInfo("Entity extraction complete", {
          stage: "entity-extraction",
          extractedCount: entityArray.length,
          entityIds: entityArray.map((e) => e.id).slice(0, 10),
          entityMentions: entityArray.map((e) => e.mention).slice(0, 5),
        });
        return Chunk.fromIterable(entities);
      }),
    };
  }),
}) {
  /**
   * Test layer with deterministic fake entities
   *
   * @since 2.0.0
   */
  static Test = Layer.succeed(
    EntityExtractor,
    EntityExtractor.of({
      extract: (
        _text: string,
        candidates: ReadonlyArray<ClassDefinition>,
        _datatypeProperties?: ReadonlyArray<PropertyDefinition>
      ): Effect.Effect<Chunk.Chunk<Entity>, EntityExtractionFailed> =>
        Effect.succeed(
          Chunk.fromIterable([
            Entity.make({
              id: EntityId.make("test_entity"),
              mention: "Test Entity",
              types: [
                O.match(A.head(candidates), {
                  onNone: () => IRI.fromUnknown("http://example.org/TestEntity"),
                  onSome: (candidate) => candidate.id,
                }),
              ],
              attributes: {},
            }),
          ])
        ),
    })
  );
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      StageTimeoutServiceLive,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}

/**
 * MentionExtractor - Pre-Stage 1 mention detection
 *
 * Extracts entity mentions from text without type assignment.
 * This enables entity-level semantic search for better class retrieval.
 *
 * @since 2.0.0
 * @category Services
 */
export class MentionExtractor extends Context.Service<MentionExtractor>()($I`MentionExtractor`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const timeout = yield* StageTimeoutService;

    const llm = yield* LanguageModel.LanguageModel;

    return {
      extract: Effect.fn("MentionExtractor.extract")(function* (text: string) {
        const structuredPrompt = generateStructuredMentionPrompt(text);
        yield* Effect.logDebug("Mention extraction stage", {
          stage: "mention-extraction",
          textLength: text.length,
          textPreview: text.slice(0, 200),
        });
        const response = yield* timeout
          .withTimeout(
            "entity_extraction",
            generateObjectWithRetry({
              llm,
              prompt: structuredPrompt,
              schema: MentionGraphSchema,
              enablePromptCaching: config.llm.enablePromptCaching,
              objectName: "MentionGraph",
              serviceName: "MentionExtractor",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs,
              },
              spanAttributes: {
                [LlmAttributes.CHUNK_TEXT_LENGTH]: text.length,
              },
              annotateSuccess: (response) => ({
                mentionCount: response.value.mentions.length,
              }),
            }),
            () =>
              Effect.logWarning("Mention extraction approaching timeout", {
                stage: "mention-extraction",
                textLength: text.length,
              })
          )
          .pipe(
            Effect.tap((response) =>
              annotateExtraction({
                mentionCount: response.value.mentions.length,
              })
            ),
            Effect.mapError((error) =>
              MentionExtractionFailed.make({
                message: `LLM mention extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                cause: O.some(error),
                text: O.some(text),
              })
            )
          );
        const mentions = response.value.mentions.map(
          (m): Mention => ({
            id: P.isTruthy(m.id) && /^[a-z][a-z0-9_]*$/.test(m.id) ? m.id : generateEntityId(m.mention),
            mention: m.mention,
            context: O.getOrElse(m.context, () => ""),
          })
        );
        yield* Effect.logInfo("Mention extraction complete", {
          stage: "mention-extraction",
          extractedCount: mentions.length,
          mentionIds: mentions.map((m: Mention) => m.id).slice(0, 10),
        });
        return Chunk.fromIterable(mentions);
      }),
    };
  }),
}) {
  /**
   * Test layer with deterministic fake mentions
   *
   * @since 2.0.0
   */
  static Test = Layer.succeed(
    MentionExtractor,
    MentionExtractor.of({
      extract: Effect.fn("MentionExtractor.extract")((_text: string) =>
        Effect.succeed(Chunk.fromIterable([{ id: "test_entity", mention: "Test Entity", context: "A test entity" }]))
      ),
    })
  );
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      StageTimeoutServiceLive,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}

/**
 * RelationExtractor - Stage 2 extraction service
 *
 * Extracts relations between entities using LLM with structured output.
 *
 * @since 2.0.0
 * @category Services
 */
export class RelationExtractor extends Context.Service<RelationExtractor>()($I`RelationExtractor`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const timeout = yield* StageTimeoutService;

    const llm = yield* LanguageModel.LanguageModel;

    return {
      extract: Effect.fn("RelationExtractor.extract")(function* (
        text: string,
        entities: Chunk.Chunk<Entity>,
        properties: ReadonlyArray<PropertyDefinition>,
        classHierarchy?: (childIri: string, parentIri: string) => boolean
      ) {
        const entityArray = Chunk.toReadonlyArray(entities);
        if (entityArray.length < 2) {
          return Chunk.empty<Relation>();
        }
        if (properties.length === 0) {
          return Chunk.empty<Relation>();
        }
        const validEntityIds = entityArray.map((e) => e.id);
        const entityTypesMap = MutableHashMap.empty<string, ReadonlyArray<string>>();
        for (const entity of entityArray) {
          MutableHashMap.set(entityTypesMap, entity.id, entity.types);
        }
        type PropertyConstraints = {
          domain: ReadonlyArray<string>;
          range: ReadonlyArray<string>;
          rangeType: string;
        };
        const propertyConstraintsMap = MutableHashMap.empty<string, PropertyConstraints>();
        for (const prop of properties) {
          MutableHashMap.set(propertyConstraintsMap, prop.id, {
            domain: prop.domain,
            range: prop.range,
            rangeType: prop.rangeType,
          });
        }
        const structuredPrompt = generateStructuredRelationPrompt(text, entityArray, properties);
        const promptLength = structuredPrompt.systemMessage.length + structuredPrompt.userMessage.length;
        const schema = makeRelationSchema(validEntityIds, properties);
        yield* Effect.logDebug("Relation extraction stage", {
          stage: "relation-extraction",
          entityCount: entityArray.length,
          entityIds: validEntityIds.slice(0, 10),
          propertyCount: properties.length,
          propertyIris: properties.map((p) => p.id).slice(0, 10),
          textLength: text.length,
          textPreview: text.slice(0, 200),
        });
        yield* Effect.logDebug("Relation extraction prompt", {
          stage: "relation-extraction",
          promptLength,
          systemMessageLength: structuredPrompt.systemMessage.length,
          userMessageLength: structuredPrompt.userMessage.length,
          promptPreview: structuredPrompt.systemMessage.slice(0, 500),
        });
        const jsonSchema = S.toJsonSchemaDocument(schema);
        const jsonSchemaText = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(jsonSchema);
        const schemaHash = sha256Sync(jsonSchemaText);
        yield* Effect.logDebug("Relation extraction schema", {
          stage: "relation-extraction",
          schemaIdentifier: "RelationGraph",
          schemaHash,
          validEntityIdCount: validEntityIds.length,
          allowedPropertyCount: properties.length,
        });
        const response = yield* timeout
          .withTimeout(
            "relation_extraction",
            generateObjectWithRetry({
              llm,
              prompt: structuredPrompt,
              schema,
              objectName: "RelationGraph",
              serviceName: "RelationExtractor",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs,
              },
              enablePromptCaching: config.llm.enablePromptCaching,
              spanAttributes: {
                [LlmAttributes.ENTITY_COUNT]: entityArray.length,
              },
              annotateSuccess: (response) => ({
                relationCount: response.value.relations.length,
              }),
            }),
            () =>
              Effect.logWarning("Relation extraction approaching timeout", {
                stage: "relation-extraction",
                entityCount: entityArray.length,
                propertyCount: properties.length,
              })
          )
          .pipe(
            Effect.tap((response) =>
              annotateExtraction({
                relationCount: response.value.relations.length,
                entityCount: entityArray.length,
              })
            ),
            Effect.mapError((error) =>
              RelationExtractionFailed.make({
                message: `LLM relation extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                cause: O.some(error),
                text: O.some(text),
              })
            )
          );
        const propertyIris: ReadonlyArray<IRI> = properties.map((p) => IRI.fromUnknown(p.id));
        const relationPropertyMapResult = buildLocalNameToIriMapSafe(propertyIris);
        const localNameToIriMap = relationPropertyMapResult.map;
        if (relationPropertyMapResult.hasCollisions) {
          yield* Effect.logWarning("Relation property local name collisions detected", {
            collisionCount: MutableHashMap.size(relationPropertyMapResult.collisions),
            collisions: Object.fromEntries(relationPropertyMapResult.collisions),
          });
        }
        let skippedRelationCount = 0;
        const domainViolations: Array<{
          subjectId: string;
          predicate: string;
          subjectTypes: ReadonlyArray<string>;
          expectedDomain: ReadonlyArray<string>;
        }> = [];
        const rangeViolations: Array<{
          objectId: string;
          predicate: string;
          objectTypes: ReadonlyArray<string>;
          expectedRange: ReadonlyArray<string>;
        }> = [];
        type RelationData = RelationGraphType["relations"][number];
        const toLiteralObject = Match.type<string | number | boolean>().pipe(
          Match.when(P.isString, (value) => RelationObject.cases.Text.make({ value })),
          Match.when(P.isNumber, (value) => RelationObject.cases.Number.make({ value })),
          Match.when(P.isBoolean, (value) => RelationObject.cases.Boolean.make({ value })),
          Match.exhaustive
        );
        const typesMatchConstraint = (
          entityTypes: ReadonlyArray<string>,
          constraintTypes: ReadonlyArray<string>
        ): boolean => {
          if (constraintTypes.length === 0) return true;
          return entityTypes.some((entityType) =>
            constraintTypes.some(
              (constraintType) =>
                entityType === constraintType || (classHierarchy?.(entityType, constraintType) ?? false)
            )
          );
        };
        const toRelation = (relationData: RelationData): O.Option<Relation> => {
          const expandedPredicate = expandLocalNameToIri(relationData.predicate, localNameToIriMap);
          if (O.isNone(expandedPredicate)) {
            skippedRelationCount++;
            return O.none();
          }
          const constraints = MutableHashMap.get(propertyConstraintsMap, expandedPredicate.value);
          if (O.isSome(constraints)) {
            const subjectTypes = O.getOrElse(MutableHashMap.get(entityTypesMap, relationData.subjectId), () => []);
            if (!typesMatchConstraint(subjectTypes, constraints.value.domain)) {
              domainViolations.push({
                subjectId: relationData.subjectId,
                predicate: expandedPredicate.value,
                subjectTypes,
                expectedDomain: constraints.value.domain,
              });
            }
            if (constraints.value.rangeType === "object" && P.isString(relationData.object)) {
              const objectTypes = O.getOrElse(MutableHashMap.get(entityTypesMap, relationData.object), () => []);
              if (objectTypes.length > 0 && !typesMatchConstraint(objectTypes, constraints.value.range)) {
                rangeViolations.push({
                  objectId: relationData.object,
                  predicate: expandedPredicate.value,
                  objectTypes,
                  expectedRange: constraints.value.range,
                });
              }
            }
          }
          const object =
            O.isSome(constraints) && constraints.value.rangeType === "object" && P.isString(relationData.object)
              ? RelationObject.cases.EntityReference.make({ value: EntityId.make(relationData.object) })
              : toLiteralObject(relationData.object);
          return O.some(
            Relation.make({
              subjectId: EntityId.make(relationData.subjectId),
              predicate: expandedPredicate.value,
              object,
              evidence: relationData.evidence,
            })
          );
        };
        const relations = Chunk.fromIterable(
          A.flatMap(A.take(response.value.relations, 5000), (relationData) => O.toArray(toRelation(relationData)))
        );
        if (skippedRelationCount > 0) {
          yield* Effect.logWarning("Skipped relations with invalid predicates after expansion", {
            stage: "relation-extraction",
            skippedRelationCount,
            validPropertyCount: propertyIris.length,
          });
        }
        if (domainViolations.length > 0) {
          yield* Effect.logWarning(
            "Domain constraint violations detected - subject entity types don't match property domain",
            {
              stage: "relation-extraction",
              violationCount: domainViolations.length,
              violations: domainViolations.slice(0, 10).map((v) => ({
                subject: v.subjectId,
                predicate: v.predicate,
                subjectTypes: v.subjectTypes,
                expectedDomain: v.expectedDomain,
              })),
            }
          );
        }
        if (rangeViolations.length > 0) {
          yield* Effect.logWarning(
            "Range constraint violations detected - object entity types don't match property range",
            {
              stage: "relation-extraction",
              violationCount: rangeViolations.length,
              violations: rangeViolations.slice(0, 10).map((v) => ({
                object: v.objectId,
                predicate: v.predicate,
                objectTypes: v.objectTypes,
                expectedRange: v.expectedRange,
              })),
            }
          );
        }
        const relationArray = Chunk.toReadonlyArray(relations);
        yield* Effect.logInfo("Relation extraction complete", {
          stage: "relation-extraction",
          extractedCount: relationArray.length,
          relations: relationArray
            .slice(0, 10)
            .map(
              (r: Relation) =>
                `${r.subjectId} --[${r.predicate}]--> ${typeof r.object === "string" ? r.object : String(r.object)}`
            ),
        });
        return Chunk.fromIterable(relations);
      }),
    };
  }),
}) {
  /**
   * Test layer with deterministic fake relations
   *
   * @since 2.0.0
   */
  static Test = Layer.succeed(
    RelationExtractor,
    RelationExtractor.of({
      extract: (
        _text: string,
        entities: Chunk.Chunk<Entity>,
        _properties: ReadonlyArray<PropertyDefinition>
      ): Effect.Effect<Chunk.Chunk<Relation>, RelationExtractionFailed> => {
        const entityArray = Chunk.toReadonlyArray(entities);
        if (entityArray.length < 2) {
          return Effect.succeed(Chunk.empty<Relation>());
        }

        return Effect.succeed(
          Chunk.fromIterable([
            Relation.make({
              subjectId: entityArray[0].id,
              predicate: IRI.fromUnknown(_properties.length > 0 ? _properties[0].id : "http://example.org/relatedTo"),
              object: RelationObject.cases.EntityReference.make({ value: entityArray[1].id }),
            }),
          ])
        );
      },
    })
  );
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      StageTimeoutServiceLive,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}
