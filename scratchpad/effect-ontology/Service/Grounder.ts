/**
 * Service: Grounder
 *
 * **Details**
 *
 * Verifies extracted triples against source context using a second LLM pass.
 * Inspired by ODKE+ Grounder component.
 *
 * Supports both single and batched verification for efficiency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Str as BeepStr } from "@beep/utils";
import { Context, Effect, HashMap, Layer, Stream } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { LanguageModel } from "effect/unstable/ai";
import { Entity, GroundingDecision, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { PropertyDefinition } from "../Domain/Model/Ontology.ts";
import { LlmAttributes } from "../Telemetry/LlmAttributes.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { generateObjectWithRetry } from "./LlmWithRetry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Grounder");

/**
 * Verification result schema returned by LLM (single relation)
 */
const Verification = S.Struct({
  grounded: S.Boolean,
  confidence: Confidence,
}).annotate({
  identifier: "GroundingDecision",
  description: "Indicates whether a triple is grounded in the provided context",
});

/**
 * Batch verification result schema
 */
const BatchVerification = S.Struct({
  results: S.Array(
    S.Struct({
      index: NonNegativeInt.annotate({
        description: "Index of the triple in the input list (0-based)",
      }),
      grounded: S.Boolean.annotate({
        description: "Whether this triple is supported by the context",
      }),
      confidence: Confidence.annotate({
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
const EntityVerification = S.Struct({
  grounded: S.Boolean.annotate({
    description: "Whether the entity mention is found in the context",
  }),
  typeMatch: S.Boolean.annotate({
    description: "Whether the assigned types match the context",
  }),
  confidence: Confidence.annotate({
    description: "Overall grounding confidence score",
  }),
}).annotate({
  identifier: "EntityGroundingDecision",
  description: "Verification result for an extracted entity",
});

/**
 * Batch entity verification result schema
 */
const BatchEntityVerification = S.Struct({
  results: S.Array(
    S.Struct({
      index: NonNegativeInt.annotate({
        description: "Index of the entity in the input list (0-based)",
      }),
      grounded: S.Boolean.annotate({
        description: "Whether the entity mention is found in the context",
      }),
      typeMatch: S.Boolean.annotate({
        description: "Whether the assigned types match the context",
      }),
      confidence: Confidence.annotate({
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
 *
 *
 * **Example** (Use the EntityVerificationInput contract)
 *
 * ```ts
 * import type { EntityVerificationInput } from "@effect-ontology/Service/Grounder"
 *
 * const acceptsEntityVerificationInput = (_value: EntityVerificationInput): void => undefined
 *
 * console.log(acceptsEntityVerificationInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EntityVerificationInput {
  readonly context: string;
  readonly entity: Entity;
}

/**
 * Entity grounding result
 *
 *
 * **Example** (Use the EntityGrounderResult contract)
 *
 * ```ts
 * import type { EntityGrounderResult } from "@effect-ontology/Service/Grounder"
 *
 * const acceptsEntityGrounderResult = (_value: EntityGrounderResult): void => undefined
 *
 * console.log(acceptsEntityGrounderResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class EntityGrounderResult extends S.Class<EntityGrounderResult>($I`EntityGrounderResult`)(
  {
    decision: GroundingDecision,
    typeMatch: S.Boolean,
    entity: Entity,
  },
  $I.annote("EntityGrounderResult", {
    description: "Schema-owned grounding decision paired with its extracted entity.",
  })
) {
  /**
   * Whether this entity observation passed grounding verification.
   *
   * **Example** (Inspect the getter)
   * ```ts
   * import { EntityGrounderResult } from "@effect-ontology/Service/Grounder"
   *
   * console.log(Reflect.getOwnPropertyDescriptor(EntityGrounderResult.prototype, "grounded")?.get !== undefined)
   * ```
   *
   * @returns `true` only when the schema-owned decision is `Supported`.
   */
  get grounded(): boolean {
    return GroundingDecision.guards.Supported(this.decision);
  }

  /**
   * Numeric compatibility view of the schema-owned grounding decision.
   *
   * **Example** (Inspect the getter)
   * ```ts
   * import { EntityGrounderResult } from "@effect-ontology/Service/Grounder"
   *
   * console.log(Reflect.getOwnPropertyDescriptor(EntityGrounderResult.prototype, "confidence")?.get !== undefined)
   * ```
   *
   * @returns The verifier confidence, or zero when grounding was not evaluated.
   */
  get confidence(): Confidence {
    return GroundingDecision.match(this.decision, {
      NotEvaluated: () => Confidence.make(0),
      Supported: ({ confidence }) => confidence,
      Rejected: ({ confidence }) => confidence,
    });
  }
}

/**
 * Input required to verify a relation triple
 *
 *
 * **Example** (Use the RelationVerificationInput contract)
 *
 * ```ts
 * import type { RelationVerificationInput } from "@effect-ontology/Service/Grounder"
 *
 * const acceptsRelationVerificationInput = (_value: RelationVerificationInput): void => undefined
 *
 * console.log(acceptsRelationVerificationInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
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

const relationObjectPrompt = (
  relation: Relation,
  object: RelationVerificationInput["object"]
): readonly [label: string, detail: string] => {
  const context = O.fromNullishOr(object);
  const mention = O.flatMap(context, (value) => O.fromNullishOr(value.mention));
  const types = O.flatMap(context, (value) => O.fromNullishOr(value.types));
  return RelationObject.match(relation.object, {
    EntityReference: ({ value }): readonly [string, string] => [
      O.match(mention, {
        onNone: () => value,
        onSome: (label) => `${label} (${value})`,
      }),
      O.match(types, {
        onNone: () => "",
        onSome: (values) => `\nObject types: ${A.join(values, ", ")}`,
      }),
    ],
    Text: ({ value }): readonly [string, string] => [value, ""],
    Number: ({ value }): readonly [string, string] => [BeepStr.fromNumber(value), ""],
    Boolean: ({ value }): readonly [string, string] => [
      Bool.match(value, { onFalse: () => "false", onTrue: () => "true" }),
      "",
    ],
  });
};

/**
 * Build prompt for single relation verification
 *
 * @internal
 */
const buildGrounderPrompt = ({ context, object, predicate, relation, subject }: RelationVerificationInput): string => {
  const predicateLabel = O.getOrElse(
    O.map(O.fromNullishOr(predicate), (value) => value.label),
    () => relation.predicate
  );
  const subjectLabel = O.match(O.fromNullishOr(subject), {
    onNone: () => relation.subjectId,
    onSome: (value) => `${value.mention} (${value.entityId})`,
  });
  const [objectLabel, objectDetail] = relationObjectPrompt(relation, object);

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
  const { object, predicate, relation, subject } = input;
  const predicateLabel = O.getOrElse(
    O.map(O.fromNullishOr(predicate), (value) => value.label),
    () => relation.predicate
  );
  const subjectLabel = O.match(O.fromNullishOr(subject), {
    onNone: () => relation.subjectId,
    onSome: (value) => `${value.mention} (${value.entityId})`,
  });
  const [objectLabel] = relationObjectPrompt(relation, object);

  return `${index}. <${subjectLabel}, ${predicateLabel}, ${objectLabel}>`;
};

/**
 * Build prompt for batch relation verification
 *
 * @internal
 */
const buildBatchGrounderPrompt = (context: string, inputs: ReadonlyArray<RelationVerificationInput>): string => {
  const triplesFormatted = A.join(A.map(inputs, formatRelationForBatch), "\n");

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
const buildEntityGrounderPrompt = ({ context, entity }: EntityVerificationInput): string => {
  const typesStr = A.join(entity.types, ", ");

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
  const typesStr = A.join(entity.types, ", ");
  return `${index}. "${entity.mention}" [${typesStr}]`;
};

/**
 * Build prompt for batch entity verification
 *
 * @internal
 */
const buildBatchEntityGrounderPrompt = (context: string, entities: ReadonlyArray<Entity>): string => {
  const entitiesFormatted = A.join(A.map(entities, formatEntityForBatch), "\n");

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
 *
 *
 * **Example** (Use the GrounderResult contract)
 *
 * ```ts
 * import type { GrounderResult } from "@effect-ontology/Service/Grounder"
 *
 * const acceptsGrounderResult = (_value: GrounderResult): void => undefined
 *
 * console.log(acceptsGrounderResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class GrounderResult extends S.Class<GrounderResult>($I`GrounderResult`)(
  {
    decision: GroundingDecision,
    relation: Relation,
  },
  $I.annote("GrounderResult", {
    description: "Schema-owned grounding decision paired with its extracted relation.",
  })
) {
  /**
   * Whether this relation observation passed grounding verification.
   *
   * **Example** (Inspect the getter)
   * ```ts
   * import { GrounderResult } from "@effect-ontology/Service/Grounder"
   *
   * console.log(Reflect.getOwnPropertyDescriptor(GrounderResult.prototype, "grounded")?.get !== undefined)
   * ```
   *
   * @returns `true` only when the schema-owned decision is `Supported`.
   */
  get grounded(): boolean {
    return GroundingDecision.guards.Supported(this.decision);
  }

  /**
   * Numeric compatibility view of the schema-owned grounding decision.
   *
   * **Example** (Inspect the getter)
   * ```ts
   * import { GrounderResult } from "@effect-ontology/Service/Grounder"
   *
   * console.log(Reflect.getOwnPropertyDescriptor(GrounderResult.prototype, "confidence")?.get !== undefined)
   * ```
   *
   * @returns The verifier confidence, or zero when grounding was not evaluated.
   */
  get confidence(): Confidence {
    return GroundingDecision.match(this.decision, {
      NotEvaluated: () => Confidence.make(0),
      Supported: ({ confidence }) => confidence,
      Rejected: ({ confidence }) => confidence,
    });
  }
}

const GroundingBatchKind = LiteralKit(["entity", "relation"]);

/**
 * Grounder response omitted one or more requested batch entries.
 *
 * **Example** (Construct an incomplete-batch failure)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { GroundingProtocolError } from "@effect-ontology/Service/Grounder"
 *
 * const error = GroundingProtocolError.make({
 *   kind: "entity",
 *   expectedCount: NonNegativeInt.make(2),
 *   receivedCount: NonNegativeInt.make(1),
 *   missingIndexes: [NonNegativeInt.make(1)]
 * })
 * console.log(error._tag) // "GroundingProtocolError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GroundingProtocolError extends S.TaggedError<GroundingProtocolError>($I`GroundingProtocolError`)(
  "GroundingProtocolError",
  {
    kind: GroundingBatchKind,
    expectedCount: NonNegativeInt,
    receivedCount: NonNegativeInt,
    missingIndexes: S.Array(NonNegativeInt),
  },
  $I.annote("GroundingProtocolError", {
    description: "Incomplete or malformed indexed response from batched grounding verification.",
  })
) {
  static readonly is = S.is(this);
}

type IndexedRelationVerification = (typeof BatchVerification.Type)["results"][number];
type IndexedEntityVerification = (typeof BatchEntityVerification.Type)["results"][number];

const groundingDecision = (grounded: boolean, confidence: Confidence): GroundingDecision =>
  Bool.match(grounded, {
    onFalse: () => GroundingDecision.cases.Rejected.make({ confidence }),
    onTrue: () => GroundingDecision.cases.Supported.make({ confidence }),
  });

const missingIndexes = <TValue>(inputs: ReadonlyArray<TValue>, results: HashMap.HashMap<number, unknown>) =>
  A.getSomes(
    A.map(inputs, (_, index) =>
      HashMap.has(results, index) ? O.none<NonNegativeInt>() : O.some(NonNegativeInt.make(index))
    )
  );

const validateRelationBatch = Effect.fn("Grounder.validateRelationBatch")(function* (
  inputs: ReadonlyArray<RelationVerificationInput>,
  results: ReadonlyArray<IndexedRelationVerification>
) {
  const byIndex = HashMap.fromIterable(
    A.map(results, (result): readonly [number, IndexedRelationVerification] => [result.index, result])
  );
  const missing = missingIndexes(inputs, byIndex);
  if (
    A.isReadonlyArrayNonEmpty(missing) ||
    HashMap.size(byIndex) !== inputs.length ||
    results.length !== inputs.length
  ) {
    return yield* GroundingProtocolError.make({
      kind: "relation",
      expectedCount: NonNegativeInt.make(inputs.length),
      receivedCount: NonNegativeInt.make(results.length),
      missingIndexes: missing,
    });
  }
  return yield* Effect.forEach(inputs, (input, index) =>
    O.match(HashMap.get(byIndex, index), {
      onNone: () =>
        GroundingProtocolError.make({
          kind: "relation",
          expectedCount: NonNegativeInt.make(inputs.length),
          receivedCount: NonNegativeInt.make(results.length),
          missingIndexes: [NonNegativeInt.make(index)],
        }),
      onSome: (result) =>
        Effect.succeed(
          GrounderResult.make({
            decision: groundingDecision(result.grounded, result.confidence),
            relation: input.relation,
          })
        ),
    })
  );
});

const validateEntityBatch = Effect.fn("Grounder.validateEntityBatch")(function* (
  entities: ReadonlyArray<Entity>,
  results: ReadonlyArray<IndexedEntityVerification>
) {
  const byIndex = HashMap.fromIterable(
    A.map(results, (result): readonly [number, IndexedEntityVerification] => [result.index, result])
  );
  const missing = missingIndexes(entities, byIndex);
  if (
    A.isReadonlyArrayNonEmpty(missing) ||
    HashMap.size(byIndex) !== entities.length ||
    results.length !== entities.length
  ) {
    return yield* GroundingProtocolError.make({
      kind: "entity",
      expectedCount: NonNegativeInt.make(entities.length),
      receivedCount: NonNegativeInt.make(results.length),
      missingIndexes: missing,
    });
  }
  return yield* Effect.forEach(entities, (entity, index) =>
    O.match(HashMap.get(byIndex, index), {
      onNone: () =>
        GroundingProtocolError.make({
          kind: "entity",
          expectedCount: NonNegativeInt.make(entities.length),
          receivedCount: NonNegativeInt.make(results.length),
          missingIndexes: [NonNegativeInt.make(index)],
        }),
      onSome: (result) =>
        Effect.succeed(
          EntityGrounderResult.make({
            decision: groundingDecision(result.grounded, result.confidence),
            typeMatch: result.typeMatch,
            entity,
          })
        ),
    })
  );
});

/**
 * Default batch size for grouped verification
 */
const DEFAULT_BATCH_SIZE = 5;

/**
 * Grounder Service
 *
 * **Details**
 *
 * Provides relation verification via secondary LLM pass.
 * Supports both single relation and batched verification.
 *
 * **Example** (Inspect grounder)
 *
 * ```ts
 * import { Grounder } from "@effect-ontology/Service/Grounder"
 *
 * console.log(Grounder)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class Grounder extends Context.Service<Grounder>()($I`Grounder`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const llm = yield* LanguageModel.LanguageModel;

    return {
      verifyRelation: Effect.fn("Grounder.verifyRelation")(function* (input: RelationVerificationInput) {
        const prompt = buildGrounderPrompt(input);
        const result = yield* generateObjectWithRetry({
          prompt,
          schema: Verification,
          objectName: "GroundingDecision",
          serviceName: "Grounder",
          model: config.llm.model,
          provider: config.llm.provider,
          retryPolicy: config.llm.retryPolicy,
          spanAttributes: {
            [LlmAttributes.PROMPT_LENGTH]: prompt.length,
          },
          annotateSuccess: (response) => ({
            grounded: response.value.grounded,
            confidence: response.value.confidence,
          }),
        }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, llm),
          Effect.tap((response) =>
            Effect.logDebug("Grounder verification result", {
              stage: "grounder",
              grounded: response.value.grounded,
              confidence: response.value.confidence,
            })
          ),
          Effect.withSpan("grounder-single-verification")
        );
        return GrounderResult.make({
          decision: groundingDecision(result.value.grounded, result.value.confidence),
          relation: input.relation,
        });
      }),
      verifyRelationBatch: Effect.fn("Grounder.verifyRelationBatch")(
        function* (context: string, inputs: ReadonlyArray<RelationVerificationInput>) {
          if (A.isReadonlyArrayEmpty(inputs)) {
            return [];
          }
          if (inputs.length === 1) {
            const prompt = buildGrounderPrompt(inputs[0]);
            const result = yield* generateObjectWithRetry({
              prompt,
              schema: Verification,
              objectName: "GroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryPolicy: config.llm.retryPolicy,
              spanAttributes: {
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
              annotateSuccess: (response) => ({
                grounded: response.value.grounded,
                confidence: response.value.confidence,
              }),
            }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));
            return [
              GrounderResult.make({
                decision: groundingDecision(result.value.grounded, result.value.confidence),
                relation: inputs[0].relation,
              }),
            ];
          }
          const prompt = buildBatchGrounderPrompt(context, inputs);
          const response = yield* generateObjectWithRetry({
            prompt,
            schema: BatchVerification,
            objectName: "BatchGroundingDecision",
            serviceName: "Grounder",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              [LlmAttributes.RELATION_COUNT]: inputs.length,
              [LlmAttributes.PROMPT_LENGTH]: prompt.length,
            },
          }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));
          return yield* validateRelationBatch(inputs, response.value.results);
        },
        (effect, inputs) =>
          effect.pipe(
            Effect.tap((results) =>
              Effect.all([
                Effect.logDebug("Grounder batch verification complete", {
                  stage: "grounder",
                  batchSize: inputs.length,
                  groundedCount: A.length(A.filter(results, (result) => result.grounded)),
                }),
                Effect.annotateCurrentSpan(LlmAttributes.RELATION_COUNT, inputs.length),
                Effect.annotateCurrentSpan(
                  "grounder.grounded_count",
                  A.length(A.filter(results, (result) => result.grounded))
                ),
              ])
            ),
            Effect.withSpan("grounder-batch-verification", {
              attributes: {
                [LlmAttributes.RELATION_COUNT]: inputs.length,
              },
            })
          )
      ),
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
            return generateObjectWithRetry({
              prompt,
              schema: BatchVerification,
              objectName: "BatchGroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryPolicy: config.llm.retryPolicy,
              spanAttributes: {
                [LlmAttributes.RELATION_COUNT]: batchArray.length,
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
            }).pipe(
              Effect.provideService(LanguageModel.LanguageModel, llm),
              Effect.flatMap((response) => validateRelationBatch(batchArray, response.value.results))
            );
          }),
          Stream.flattenIterable
        ),
      verifyEntity: Effect.fn("Grounder.verifyEntity")(function* (input: EntityVerificationInput) {
        const prompt = buildEntityGrounderPrompt(input);
        const result = yield* generateObjectWithRetry({
          prompt,
          schema: EntityVerification,
          objectName: "EntityGroundingDecision",
          serviceName: "Grounder",
          model: config.llm.model,
          provider: config.llm.provider,
          retryPolicy: config.llm.retryPolicy,
          spanAttributes: {
            [LlmAttributes.PROMPT_LENGTH]: prompt.length,
          },
          annotateSuccess: (response) => ({
            grounded: response.value.grounded,
            typeMatch: response.value.typeMatch,
            confidence: response.value.confidence,
          }),
        }).pipe(
          Effect.provideService(LanguageModel.LanguageModel, llm),
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
        return EntityGrounderResult.make({
          decision: groundingDecision(result.value.grounded, result.value.confidence),
          typeMatch: result.value.typeMatch,
          entity: input.entity,
        });
      }),
      verifyEntityBatch: Effect.fn("Grounder.verifyEntityBatch")(
        function* (context: string, entities: ReadonlyArray<Entity>) {
          if (A.isReadonlyArrayEmpty(entities)) {
            return [];
          }
          if (entities.length === 1) {
            const input = { context, entity: entities[0] };
            const prompt = buildEntityGrounderPrompt(input);
            const result = yield* generateObjectWithRetry({
              prompt,
              schema: EntityVerification,
              objectName: "EntityGroundingDecision",
              serviceName: "Grounder",
              model: config.llm.model,
              provider: config.llm.provider,
              retryPolicy: config.llm.retryPolicy,
              spanAttributes: {
                [LlmAttributes.PROMPT_LENGTH]: prompt.length,
              },
            }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));
            return [
              EntityGrounderResult.make({
                decision: groundingDecision(result.value.grounded, result.value.confidence),
                typeMatch: result.value.typeMatch,
                entity: entities[0],
              }),
            ];
          }
          const prompt = buildBatchEntityGrounderPrompt(context, entities);
          const response = yield* generateObjectWithRetry({
            prompt,
            schema: BatchEntityVerification,
            objectName: "BatchEntityGroundingDecision",
            serviceName: "Grounder",
            model: config.llm.model,
            provider: config.llm.provider,
            retryPolicy: config.llm.retryPolicy,
            spanAttributes: {
              [LlmAttributes.ENTITY_COUNT]: entities.length,
              [LlmAttributes.PROMPT_LENGTH]: prompt.length,
            },
          }).pipe(Effect.provideService(LanguageModel.LanguageModel, llm));
          return yield* validateEntityBatch(entities, response.value.results);
        },
        (effect, _context, entities) =>
          effect.pipe(
            Effect.tap((results) =>
              Effect.all([
                Effect.logDebug("Grounder batch entity verification complete", {
                  stage: "grounder",
                  batchSize: entities.length,
                  groundedCount: A.length(A.filter(results, (result) => result.grounded)),
                }),
                Effect.annotateCurrentSpan(LlmAttributes.ENTITY_COUNT, entities.length),
                Effect.annotateCurrentSpan(
                  "grounder.entity_grounded_count",
                  A.length(A.filter(results, (result) => result.grounded))
                ),
              ])
            ),
            Effect.withSpan("grounder-batch-entity-verification", {
              attributes: {
                [LlmAttributes.ENTITY_COUNT]: entities.length,
              },
            })
          )
      ),
    };
  }),
}) {
  /**
   * Test layer with deterministic responses (all relations pass verification)
   *
   * @since 0.0.0
   */
  static Test = Layer.succeed(Grounder, {
    verifyRelation: Effect.fn("Grounder.verifyRelation")((input: RelationVerificationInput) =>
      Effect.succeed(
        GrounderResult.make({
          decision: GroundingDecision.cases.Supported.make({ confidence: Confidence.make(1) }),
          relation: input.relation,
        })
      )
    ),
    verifyRelationBatch: Effect.fn("Grounder.verifyRelationBatch")(
      (_context: string, inputs: ReadonlyArray<RelationVerificationInput>) =>
        Effect.succeed(
          A.map(inputs, (input) =>
            GrounderResult.make({
              decision: GroundingDecision.cases.Supported.make({ confidence: Confidence.make(1) }),
              relation: input.relation,
            })
          )
        )
    ),
    verifyRelationStream: (_context: string, relations: Stream.Stream<RelationVerificationInput>) =>
      relations.pipe(
        Stream.map((input) =>
          GrounderResult.make({
            decision: GroundingDecision.cases.Supported.make({ confidence: Confidence.make(1) }),
            relation: input.relation,
          })
        )
      ),
    verifyEntity: Effect.fn("Grounder.verifyEntity")((input: EntityVerificationInput) =>
      Effect.succeed(
        EntityGrounderResult.make({
          decision: GroundingDecision.cases.Supported.make({ confidence: Confidence.make(1) }),
          typeMatch: true,
          entity: input.entity,
        })
      )
    ),
    verifyEntityBatch: Effect.fn("Grounder.verifyEntityBatch")((_context: string, entities: ReadonlyArray<Entity>) =>
      Effect.succeed(
        A.map(entities, (entity) =>
          EntityGrounderResult.make({
            decision: GroundingDecision.cases.Supported.make({ confidence: Confidence.make(1) }),
            typeMatch: true,
            entity,
          })
        )
      )
    ),
  });
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide(ConfigServiceDefault));
}
