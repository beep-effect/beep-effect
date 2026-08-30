/**
 * Structured language-model generation with schema feedback and bounded retry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Effect, Ref } from "effect";
import type * as Cause from "effect/Cause";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as AiError from "effect/unstable/ai/AiError";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Prompt from "effect/unstable/ai/Prompt";
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts";
import { recordProviderAttempt, recordProviderUsage } from "../Telemetry/ExtractionTelemetry.ts";
import { makeCachedPromptFromStructured } from "./PromptCache.ts";
import { RetryPolicy, retryEffect } from "./Retry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/GenerateWithFeedback");

/**
 * Normalized retry policy for schema-backed language-model generation.
 *
 * **Example** (Create a generation policy)
 *
 * ```ts
 * import { GenerateWithFeedbackPolicy } from "@effect-ontology/Service/GenerateWithFeedback"
 *
 * const policy = GenerateWithFeedbackPolicy.make({
 *   objectName: "GroundedAnswer",
 *   serviceName: "GraphRAG"
 * })
 * console.log(policy.retryPolicy.maxAttempts) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GenerateWithFeedbackPolicy extends S.Class<GenerateWithFeedbackPolicy>($I`GenerateWithFeedbackPolicy`)(
  {
    objectName: S.NonEmptyString.annotateKey({
      description: "Name supplied to the provider for the requested structured object.",
    }),
    serviceName: S.NonEmptyString.annotateKey({
      description: "Stable service name attached to retry diagnostics.",
    }),
    retryPolicy: RetryPolicy.pipe(
      SchemaUtils.withKeyDefaults(RetryPolicy.make({})),
      S.annotateKey({ description: "Validated attempt, backoff, and overall deadline policy." })
    ),
    enablePromptCaching: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({ description: "Whether structured system prompts opt into provider prompt caching." })
    ),
  },
  $I.annote("GenerateWithFeedbackPolicy", {
    description: "Validated retry, naming, and prompt-caching policy for structured generation.",
  })
) {
  static readonly decodeEffect = S.decodeEffect(GenerateWithFeedbackPolicy);
}

/**
 * Constructor input accepted by {@link GenerateWithFeedbackPolicy}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GenerateWithFeedbackPolicyInput = (typeof GenerateWithFeedbackPolicy)["~type.make.in"];

type StructuredOutputCodec = S.Codec<Record<string, unknown>, Record<string, unknown>, never, never>;

type GenerateWithFeedbackOptions<StructuredOutputSchema extends StructuredOutputCodec> =
  GenerateWithFeedbackPolicyInput & {
    readonly prompt: string | StructuredPrompt;
    readonly schema: StructuredOutputSchema;
  };

const makePrompt = (prompt: string | StructuredPrompt, enablePromptCaching: boolean): Prompt.Prompt =>
  P.isString(prompt) ? Prompt.make(prompt) : makeCachedPromptFromStructured(prompt, enablePromptCaching);

const buildFeedbackPrompt = (error: AiError.InvalidOutputError): Prompt.Prompt =>
  Prompt.make(`Your previous response failed schema validation:

${error.description}

Generate a corrected response that follows the requested schema exactly.`);

/**
 * Generates a structured object, feeding schema failures back to the model
 * before retrying under the supplied schedule.
 *
 * **Details**
 *
 * The shared retry policy owns both attempt and overall deadlines. Invalid
 * output additionally updates the prompt stored in a `Ref`, while transport
 * and timeout failures retry the unchanged prompt.
 *
 * **Example** (Compose generation with schema feedback)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { generateObjectWithFeedback } from "@effect-ontology/Service/GenerateWithFeedback"
 *
 * const Founder = S.Struct({ founder: S.String })
 * const program = generateObjectWithFeedback({
 *   objectName: "Founder",
 *   serviceName: "EntityExtractor",
 *   prompt: "Extract the founder from: Ada founded Acme.",
 *   schema: Founder
 * })
 * console.log(program)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const generateObjectWithFeedback = Effect.fn("generateObjectWithFeedback")(function* <
  StructuredOutputSchema extends StructuredOutputCodec,
>(
  options: GenerateWithFeedbackOptions<StructuredOutputSchema>
): Effect.fn.Return<
  LanguageModel.GenerateObjectResponse<Record<never, never>, StructuredOutputSchema["Type"]>,
  AiError.AiError | Cause.TimeoutError | S.SchemaError,
  LanguageModel.LanguageModel | StructuredOutputSchema["DecodingServices"]
> {
  const policy = yield* GenerateWithFeedbackPolicy.decodeEffect(options);
  const retryPolicy = yield* RetryPolicy.decodeEffect({ ...policy.retryPolicy, serviceName: policy.serviceName });
  const llm = yield* LanguageModel.LanguageModel;
  const promptRef = yield* Ref.make(makePrompt(options.prompt, policy.enablePromptCaching));
  const attemptRef = yield* Ref.make(0);

  const attempt = Effect.fn("GenerateWithFeedback.attempt")(function* () {
    yield* recordProviderAttempt;
    const attemptNumber = yield* Ref.updateAndGet(attemptRef, (current) => current + 1);
    const prompt = yield* Ref.get(promptRef);
    return yield* llm
      .generateObject({
        prompt,
        schema: options.schema,
        objectName: policy.objectName,
      })
      .pipe(
        Effect.tap((response) =>
          recordProviderUsage({
            inputTokens: response.usage.inputTokens.total,
            outputTokens: response.usage.outputTokens.total,
          })
        ),
        Effect.tapError((error) =>
          AiError.isAiError(error) && error.reason._tag === "InvalidOutputError"
            ? Effect.all([
                Ref.update(promptRef, Prompt.concat(buildFeedbackPrompt(error.reason))),
                Effect.logWarning("Structured output failed validation; retrying with feedback", {
                  service: policy.serviceName,
                  attempt: attemptNumber,
                  maxAttempts: retryPolicy.maxAttempts,
                  errorDescription: Str.slice(0, 500)(error.reason.description),
                }),
              ]).pipe(Effect.asVoid)
            : Effect.logWarning("Language-model attempt failed; retrying", {
                service: policy.serviceName,
                attempt: attemptNumber,
                maxAttempts: retryPolicy.maxAttempts,
                errorTag: error._tag,
              })
        )
      );
  });

  return yield* attempt().pipe(
    retryEffect(retryPolicy),
    Effect.tap(() =>
      Ref.get(attemptRef).pipe(
        Effect.filterOrElse(
          (attempts) => attempts > 1,
          () => Effect.void
        ),
        Effect.flatMap((attempts) =>
          Effect.logInfo("Structured output succeeded after retry", {
            service: policy.serviceName,
            attempts,
            maxAttempts: retryPolicy.maxAttempts,
          })
        ),
        Effect.ignore
      )
    ),
    Effect.tapError((error) =>
      Effect.logError("Structured output attempts exhausted", {
        service: policy.serviceName,
        attempts: retryPolicy.maxAttempts,
        errorTag: error._tag,
      })
    )
  );
});
