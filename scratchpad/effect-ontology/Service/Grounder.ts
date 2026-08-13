/**
 * Service: Grounder
 *
 * Verifies extracted triples against source context using a second LLM pass.
 * Inspired by ODKE+ Grounder component.
 *
 * Supports both single and batched verification for efficiency.
 *
 * @since 2.0.0
 * @module Service/Grounder
 */

import {$ScratchpadId} from "@beep/identity";
import {Context, Effect, Layer, Schema, Stream} from "effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import {LanguageModel} from "effect/unstable/ai";
import type {Entity, Relation} from "../Domain/Model/Entity.ts";
import type {PropertyDefinition} from "../Domain/Model/Ontology.ts";
import {LlmAttributes} from "../Telemetry/LlmAttributes.ts";
import {ConfigService, ConfigServiceDefault} from "./Config.ts";
import {
  StageTimeoutService,
  StageTimeoutServiceLive
} from "./LlmControl/StageTimeout.ts";
import {generateObjectWithRetry} from "./LlmWithRetry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Grounder");

/**
 * Verification result schema returned by LLM (single relation)
 */
const VerificationSchema = Schema.Struct({
  grounded: Schema.Boolean,
  confidence: Schema.Finite.check(Schema.isBetween({minimum: 0, maximum: 1})),
}).annotate({
  identifier: "GroundingDecision",
  description: "Indicates whether a triple is grounded in the provided context",
});

/**
 * Batch verification result schema
 */
const BatchVerificationSchema = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      index: Schema.Finite.annotate({
        description: "Index of the triple in the input list (0-based)",
      }),
      grounded: Schema.Boolean.annotate({
        description: "Whether this triple is supported by the context",
      }),
      confidence: Schema.Finite.check(Schema.isBetween({
        minimum: 0,
        maximum: 1
      })).annotate({
        description: "Confidence score from 0 to 1",
      }),
    })
  ),
}).annotate({
  identifier: "BatchGroundingDecision",
  description: "Verification results for multiple triples",
});

/**
 * Entity verification result schema returned by LLM
 */
const EntityVerificationSchema = Schema.Struct({
  grounded: Schema.Boolean.annotate({
    description: "Whether the entity mention is found in the context",
  }),
  typeMatch: Schema.Boolean.annotate({
    description: "Whether the assigned types match the context",
  }),
  confidence: Schema.Finite.check(Schema.isBetween({
    minimum: 0,
    maximum: 1
  })).annotate({
    description: "Overall grounding confidence score",
  }),
}).annotate({
  identifier: "EntityGroundingDecision",
  description: "Verification result for an extracted entity",
});

/**
 * Batch entity verification result schema
 */
const BatchEntityVerificationSchema = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      index: Schema.Finite.annotate({
        description: "Index of the entity in the input list (0-based)",
      }),
      grounded: Schema.Boolean.annotate({
        description: "Whether the entity mention is found in the context",
      }),
      typeMatch: Schema.Boolean.annotate({
        description: "Whether the assigned types match the context",
      }),
      confidence: Schema.Finite.check(Schema.isBetween({
        minimum: 0,
        maximum: 1
      })).annotate({
        description: "Overall grounding confidence score",
      }),
    })
  ),
}).annotate({
  identifier: "BatchEntityGroundingDecision",
  description: "Verification results for multiple entities",
});

/**
 * Input required to verify an entity
 */
export interface EntityVerificationInput {
  readonly context: string;
  readonly entity: Entity;
}

/**
 * Entity grounding result
 */
export interface EntityGrounderResult {
  readonly grounded: boolean;
  readonly typeMatch: boolean;
  readonly confidence: number;
  readonly entity: Entity;
}

/**
 * Input required to verify a relation triple
 */
export interface RelationVerificationInput {
  readonly context: string;
  readonly object?: {
    readonly entityId?: string;
    readonly literal?: string | number | boolean;
    readonly mention?: string;
    readonly types?: ReadonlyArray<string>;
  };
  readonly predicate?: PropertyDefinition;
  readonly relation: Relation;
  readonly subject?: {
    readonly entityId: string;
    readonly mention: string;
    readonly types: ReadonlyArray<string>;
  };
}

/**
 * Build prompt for single relation verification
 *
 * @internal
 */
const buildGrounderPrompt = ({
                               context,
                               object,
                               predicate,
                               relation,
                               subject
                             }: RelationVerificationInput): string => {
  const predicateLabel = predicate?.label ?? relation.predicate;
  const subjectLabel = P.isNotUndefined(subject) ? `${subject.mention} (${subject.entityId})` : relation.subjectId;

  const objectLabel =
    typeof relation.object === "string"
      ? P.isNotUndefined(object?.mention)
        ? `${object.mention} (${relation.object})`
        : relation.object
      : String(relation.object);

  const objectDetail =
    typeof relation.object === "string" && P.isNotUndefined(object?.types)
      ? `\nObject types: ${object.types.join(", ")}`
      : "";

  return `You are a verifier that determines whether a triple is grounded in the provided context.

Context:
${context}

Triple:
<${subjectLabel}, ${predicateLabel}, ${objectLabel}>${objectDetail}

Instructions:
- Answer using JSON matching the schema { "grounded": boolean, "confidence": number between 0 and 1 }
- "grounded" is true if and only if the triple is explicitly supported by the context.
- Confidence should reflect how certain you are about the grounding decision.
- Do not use external knowledge beyond the provided context.`;
};

/**
 * Format a single relation for batch verification prompt
 *
 * @internal
 */
const formatRelationForBatch = (input: RelationVerificationInput, index: number): string => {
  const {object, predicate, relation, subject} = input;
  const predicateLabel = predicate?.label ?? relation.predicate;
  const subjectLabel = P.isNotUndefined(subject) ? `${subject.mention} (${subject.entityId})` : relation.subjectId;

  const objectLabel =
    typeof relation.object === "string"
      ? P.isNotUndefined(object?.mention)
        ? `${object.mention} (${relation.object})`
        : relation.object
      : String(relation.object);

  return `${index}. <${subjectLabel}, ${predicateLabel}, ${objectLabel}>`;
};

/**
 * Build prompt for batch relation verification
 *
 * @internal
 */
const buildBatchGrounderPrompt = (context: string, inputs: ReadonlyArray<RelationVerificationInput>): string => {
  const triplesFormatted = inputs.map((input, index) => formatRelationForBatch(input, index)).join("\n");

  return `You are a verifier that determines whether triples are grounded in the provided context.

Context:
${context}

Triples to verify:
${triplesFormatted}

Instructions:
- For each triple, determine if it is explicitly supported by the context.
- Return a JSON object with a "results" array.
- Each result should have: { "index": <triple number>, "grounded": boolean, "confidence": number between 0 and 1 }
- "grounded" is true if and only if the triple is explicitly stated or clearly implied by the context.
- Do not use external knowledge beyond the provided context.
- Return results for ALL triples in the same order as provided.`;
};

/**
 * Build prompt for single entity verification
 *
 * @internal
 */
const buildEntityGrounderPrompt = ({
                                     context,
                                     entity
                                   }: EntityVerificationInput): string => {
  const typesStr = entity.types.join(", ");

  return `You are a verifier that determines whether an extracted entity is grounded in the provided context.

Context:
${context}

Entity to verify:
- Mention: "${entity.mention}"
- Assigned types: [${typesStr}]

Instructions:
- Determine if the entity mention "${entity.mention}" appears in or is clearly referenced by the context.
- Determine if the assigned types [${typesStr}] match what the context says about this entity.
- Return JSON: { "grounded": boolean, "typeMatch": boolean, "confidence": number between 0 and 1 }
- "grounded" is true if the entity mention is found or clearly referenced in the context.
- "typeMatch" is true if the assigned types match what the context implies about the entity.
- "confidence" is your overall confidence in the grounding (0-1).
- Do not use external knowledge beyond the provided context.`;
};

/**
 * Format entity for batch verification
 *
 * @internal
 */
const formatEntityForBatch = (entity: Entity, index: number): string => {
  const typesStr = entity.types.join(", ");
  return `${index}. "${entity.mention}" [${typesStr}]`;
};

/**
 * Build prompt for batch entity verification
 *
 * @internal
 */
const buildBatchEntityGrounderPrompt = (context: string, entities: ReadonlyArray<Entity>): string => {
  const entitiesFormatted = entities.map((entity, index) => formatEntityForBatch(entity, index)).join("\n");

  return `You are a verifier that determines whether extracted entities are grounded in the provided context.

Context:
${context}

Entities to verify:
${entitiesFormatted}

Instructions:
- For each entity, determine if it is mentioned or referenced in the context.
- Determine if the assigned types match what the context says about each entity.
- Return JSON: { "results": [{ "index": number, "grounded": boolean, "typeMatch": boolean, "confidence": number }] }
- "grounded" is true if the entity mention is found or clearly referenced.
- "typeMatch" is true if the assigned types match the context.
- "confidence" is your overall grounding confidence (0-1).
- Do not use external knowledge beyond the provided context.
- Return results for ALL entities in the same order.`;
};

/**
 * Grounder verification result
 */
export interface GrounderResult {
  readonly grounded: boolean;
  readonly confidence: number;
  readonly relation: Relation;
}

/**
 * Default batch size for grouped verification
 */
const DEFAULT_BATCH_SIZE = 5;

/**
 * Grounder Service
 *
 * Provides relation verification via secondary LLM pass.
 * Supports both single relation and batched verification.
 *
 * @since 2.0.0
 */
export class Grounder extends Context.Service<Grounder>()($I`Grounder`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const timeout = yield* StageTimeoutService;
    const llm = yield* LanguageModel.LanguageModel;

    return {
      verifyRelation: Effect.fn("Grounder.verifyRelation")(function* (input: RelationVerificationInput) {
        const prompt = buildGrounderPrompt(input);
        const result = yield* timeout
          .withTimeout(
            "grounding",
            generateObjectWithRetry({
              llm,
              prompt,
              schema: VerificationSchema,
              objectName: "GroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs * 2,
              },
              spanAttributes: {
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
              annotateSuccess: (response) => ({
                grounded: response.value.grounded,
                confidence: response.value.confidence,
              }),
            }),
            () =>
              Effect.logWarning("Grounder verification approaching timeout", {
                stage: "grounding",
                subjectId: input.relation.subjectId,
                predicate: input.relation.predicate,
              })
          )
          .pipe(
            Effect.tap((response) =>
              Effect.logDebug("Grounder verification result", {
                stage: "grounder",
                grounded: response.value.grounded,
                confidence: response.value.confidence,
              })
            ),
            Effect.withSpan("grounder-single-verification")
          );
        return {
          grounded: result.value.grounded,
          confidence: result.value.confidence,
          relation: input.relation,
        };
      }),
      verifyRelationBatch:
        Effect.fn(function* (context: string, inputs: ReadonlyArray<RelationVerificationInput>) {
          if (inputs.length === 0) {
            return [];
          }
          if (inputs.length === 1) {
            const prompt = buildGrounderPrompt(inputs[0]);
            const result = yield* timeout.withTimeout(
              "grounding",
              generateObjectWithRetry({
                llm,
                prompt,
                schema: VerificationSchema,
                objectName: "GroundingDecision",
                serviceName: "Grounder",
                model: config.llm.model,
                provider: config.llm.provider,
                retryConfig: {
                  initialDelayMs: config.runtime.retryInitialDelayMs,
                  maxDelayMs: config.runtime.retryMaxDelayMs,
                  maxAttempts: config.runtime.retryMaxAttempts,
                  timeoutMs: config.llm.timeoutMs * 2,
                },
                spanAttributes: {
                  [LlmAttributes.PROMPT_LENGTH]: prompt.length,
                },
                annotateSuccess: (response) => ({
                  grounded: response.value.grounded,
                  confidence: response.value.confidence,
                }),
              }),
              () =>
                Effect.logWarning("Grounder single verification approaching timeout", {
                  stage: "grounding",
                  subjectId: inputs[0].relation.subjectId,
                })
            );
            return [
              {
                grounded: result.value.grounded,
                confidence: result.value.confidence,
                relation: inputs[0].relation,
              },
            ];
          }
          const prompt = buildBatchGrounderPrompt(context, inputs);
          const response = yield* timeout.withTimeout(
            "grounding",
            generateObjectWithRetry({
              llm,
              prompt,
              schema: BatchVerificationSchema,
              objectName: "BatchGroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs * 3,
              },
              spanAttributes: {
                [LlmAttributes.RELATION_COUNT]: inputs.length,
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
            }),
            () =>
              Effect.logWarning("Grounder batch verification approaching timeout", {
                stage: "grounding",
                batchSize: inputs.length,
              })
          );
          type GrounderResult = {
            index: number;
            grounded: boolean;
            confidence: number;
          };
          const resultsMap = HashMap.fromIterable(
            (response.value.results as ReadonlyArray<GrounderResult>).map((r: GrounderResult) => [r.index, r] as const)
          );
          return inputs.map((input, index) => {
            const result = HashMap.get(resultsMap, index);
            return {
              grounded: O.match(result, {onNone: () => false, onSome: (value) => value.grounded}),
              confidence: O.match(result, {onNone: () => 0, onSome: (value) => value.confidence}),
              relation: input.relation,
            };
          });
        }, (effect, inputs) => effect.pipe(
          Effect.tap((results) =>
            Effect.all([
              Effect.logDebug("Grounder batch verification complete", {
                stage: "grounder",
                batchSize: inputs.length,
                groundedCount: results.filter((r) => r.grounded).length,
              }),
              Effect.annotateCurrentSpan(LlmAttributes.RELATION_COUNT, inputs.length),
              Effect.annotateCurrentSpan("grounder.grounded_count", results.filter((r) => r.grounded).length),
            ])
          ),
          Effect.withSpan("grounder-batch-verification", {
            attributes: {
              [LlmAttributes.RELATION_COUNT]: inputs.length,
            },
          })
        )),
      verifyRelationStream: (
        context: string,
        relations: Stream.Stream<RelationVerificationInput>,
        batchSize: number = DEFAULT_BATCH_SIZE
      ) =>
        relations.pipe(
          Stream.grouped(batchSize),
          Stream.mapEffect((batch) => {
            const batchArray = batch;
            const prompt = buildBatchGrounderPrompt(context, batchArray);
            return timeout
              .withTimeout(
                "grounding",
                generateObjectWithRetry({
                  llm,
                  prompt,
                  schema: BatchVerificationSchema,
                  objectName: "BatchGroundingDecision",
                  serviceName: "Grounder",
                  model: config.llm.model,
                  provider: config.llm.provider,
                  retryConfig: {
                    initialDelayMs: config.runtime.retryInitialDelayMs,
                    maxDelayMs: config.runtime.retryMaxDelayMs,
                    maxAttempts: config.runtime.retryMaxAttempts,
                    timeoutMs: config.llm.timeoutMs * 3,
                  },
                  spanAttributes: {
                    [LlmAttributes.RELATION_COUNT]: batchArray.length,
                    [LlmAttributes.PROMPT_LENGTH]: prompt.length,
                  },
                }),
                () =>
                  Effect.logWarning("Grounder stream batch approaching timeout", {
                    stage: "grounding",
                    batchSize: batchArray.length,
                  })
              )
              .pipe(
                Effect.map((response) => {
                  type GrounderResult = {
                    index: number;
                    grounded: boolean;
                    confidence: number;
                  };
                  const resultsMap = HashMap.fromIterable(
                    (response.value.results as ReadonlyArray<GrounderResult>).map(
                      (r: GrounderResult) => [r.index, r] as const
                    )
                  );
                  return batchArray.map((input, index) => {
                    const result = HashMap.get(resultsMap, index);
                    return {
                      grounded: O.match(result, {onNone: () => false, onSome: (value) => value.grounded}),
                      confidence: O.match(result, {onNone: () => 0, onSome: (value) => value.confidence}),
                      relation: input.relation,
                    };
                  });
                })
              );
          }),
          Stream.flattenIterable
        ),
      verifyEntity: Effect.fn("Grounder.verifyEntity")(function* (input: EntityVerificationInput) {
        const prompt = buildEntityGrounderPrompt(input);
        const result = yield* timeout
          .withTimeout(
            "grounding",
            generateObjectWithRetry({
              llm,
              prompt,
              schema: EntityVerificationSchema,
              objectName: "EntityGroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs * 2,
              },
              spanAttributes: {
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
              annotateSuccess: (response) => ({
                grounded: response.value.grounded,
                typeMatch: response.value.typeMatch,
                confidence: response.value.confidence,
              }),
            }),
            () =>
              Effect.logWarning("Grounder entity verification approaching timeout", {
                stage: "grounding",
                entityId: input.entity.id,
              })
          )
          .pipe(
            Effect.tap((response) =>
              Effect.logDebug("Grounder entity verification result", {
                stage: "grounder",
                entityId: input.entity.id,
                grounded: response.value.grounded,
                typeMatch: response.value.typeMatch,
                confidence: response.value.confidence,
              })
            ),
            Effect.withSpan("grounder-entity-verification")
          );
        return {
          grounded: result.value.grounded,
          typeMatch: result.value.typeMatch,
          confidence: result.value.confidence,
          entity: input.entity,
        };
      }),
      verifyEntityBatch:
        Effect.fn(function* (context: string, entities: ReadonlyArray<Entity>) {
          if (entities.length === 0) {
            return [];
          }
          if (entities.length === 1) {
            const input = {context, entity: entities[0]};
            const prompt = buildEntityGrounderPrompt(input);
            const result = yield* timeout.withTimeout(
              "grounding",
              generateObjectWithRetry({
                llm,
                prompt,
                schema: EntityVerificationSchema,
                objectName: "EntityGroundingDecision",
                serviceName: "Grounder",
                model: config.llm.model,
                provider: config.llm.provider,
                retryConfig: {
                  initialDelayMs: config.runtime.retryInitialDelayMs,
                  maxDelayMs: config.runtime.retryMaxDelayMs,
                  maxAttempts: config.runtime.retryMaxAttempts,
                  timeoutMs: config.llm.timeoutMs * 2,
                },
                spanAttributes: {
                  [LlmAttributes.PROMPT_LENGTH]: prompt.length,
                },
              }),
              () =>
                Effect.logWarning("Grounder single entity verification approaching timeout", {
                  stage: "grounding",
                  entityId: entities[0].id,
                })
            );
            return [
              {
                grounded: result.value.grounded,
                typeMatch: result.value.typeMatch,
                confidence: result.value.confidence,
                entity: entities[0],
              },
            ];
          }
          const prompt = buildBatchEntityGrounderPrompt(context, entities);
          const response = yield* timeout.withTimeout(
            "grounding",
            generateObjectWithRetry({
              llm,
              prompt,
              schema: BatchEntityVerificationSchema,
              objectName: "BatchEntityGroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryConfig: {
                initialDelayMs: config.runtime.retryInitialDelayMs,
                maxDelayMs: config.runtime.retryMaxDelayMs,
                maxAttempts: config.runtime.retryMaxAttempts,
                timeoutMs: config.llm.timeoutMs * 3,
              },
              spanAttributes: {
                [LlmAttributes.ENTITY_COUNT]: entities.length,
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
            }),
            () =>
              Effect.logWarning("Grounder batch entity verification approaching timeout", {
                stage: "grounding",
                batchSize: entities.length,
              })
          );
          type EntityResult = {
            index: number;
            grounded: boolean;
            typeMatch: boolean;
            confidence: number;
          };
          const resultsMap = HashMap.fromIterable(
            (response.value.results as ReadonlyArray<EntityResult>).map((r: EntityResult) => [r.index, r] as const)
          );
          return entities.map((entity, index) => {
            const result = HashMap.get(resultsMap, index);
            return {
              grounded: O.match(result, {onNone: () => false, onSome: (value) => value.grounded}),
              typeMatch: O.match(result, {onNone: () => false, onSome: (value) => value.typeMatch}),
              confidence: O.match(result, {onNone: () => 0, onSome: (value) => value.confidence}),
              entity,
            };
          });
        }, (effect, _context, entities) => effect.pipe(
          Effect.tap((results) =>
            Effect.all([
              Effect.logDebug("Grounder batch entity verification complete", {
                stage: "grounder",
                batchSize: entities.length,
                groundedCount: results.filter((r) => r.grounded).length,
              }),
              Effect.annotateCurrentSpan(LlmAttributes.ENTITY_COUNT, entities.length),
              Effect.annotateCurrentSpan("grounder.entity_grounded_count", results.filter((r) => r.grounded).length),
            ])
          ),
          Effect.withSpan("grounder-batch-entity-verification", {
            attributes: {
              [LlmAttributes.ENTITY_COUNT]: entities.length,
            },
          })
        )),
    };
  }),
}) {
  /**
   * Test layer with deterministic responses (all relations pass verification)
   *
   * @since 2.0.0
   */
  static Test = Layer.succeed(Grounder, {
    verifyRelation: Effect.fn("Grounder.verifyRelation")((input: RelationVerificationInput) =>
      Effect.succeed({
        grounded: true,
        confidence: 1,
        relation: input.relation,
      })
    ),
    verifyRelationBatch: Effect.fn("Grounder.verifyRelationBatch")(
      (_context: string, inputs: ReadonlyArray<RelationVerificationInput>) =>
        Effect.succeed(
          inputs.map((input) => ({
            grounded: true,
            confidence: 1,
            relation: input.relation,
          }))
        )
    ),
    verifyRelationStream: (_context: string, relations: Stream.Stream<RelationVerificationInput>) =>
      relations.pipe(
        Stream.map((input) => ({
          grounded: true,
          confidence: 1,
          relation: input.relation,
        }))
      ),
    verifyEntity: Effect.fn("Grounder.verifyEntity")((input: EntityVerificationInput) =>
      Effect.succeed({
        grounded: true,
        typeMatch: true,
        confidence: 1,
        entity: input.entity,
      })
    ),
    verifyEntityBatch: Effect.fn("Grounder.verifyEntityBatch")((_context: string, entities: ReadonlyArray<Entity>) =>
      Effect.succeed(
        entities.map((entity) => ({
          grounded: true,
          typeMatch: true,
          confidence: 1,
          entity,
        }))
      )
    ),
  });
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      StageTimeoutServiceLive,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}
