/**
 * Structured language-model generation with schema feedback and bounded retry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { PosInt, SchemaUtils } from "@beep/schema";
import { Duration, Effect, Ref } from "effect";
import type * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as AiError from "effect/unstable/ai/AiError";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Prompt from "effect/unstable/ai/Prompt";
import type { StructuredPrompt } from "../Prompt/PromptGenerator.ts";
import { makeCachedPromptFromStructured } from "./PromptCache.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/GenerateWithFeedback");

/**
 * Normalized retry policy for schema-backed language-model generation.
 *
 * **Example** (Create a generation policy)
 *
 * ```ts
 * import { Duration } from "effect"
 * import { GenerateWithFeedbackPolicy } from "@effect-ontology/Service/GenerateWithFeedback"
 *
 * const policy = GenerateWithFeedbackPolicy.make({
 *   objectName: "GroundedAnswer",
 *   serviceName: "GraphRAG",
 *   timeout: Duration.seconds(30)
 * })
 * console.log(policy.maxAttempts) // 3
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
    maxAttempts: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(3)),
      S.annotateKey({ description: "Maximum number of generation attempts, including the initial attempt." })
    ),
    serviceName: S.NonEmptyString.annotateKey({
      description: "Stable service name attached to retry diagnostics.",
    }),
    timeout: S.Duration.pipe(
      SchemaUtils.withKeyDefaults(Duration.seconds(30)),
      S.annotateKey({ description: "Maximum duration allowed for each provider attempt." })
    ),
    enablePromptCaching: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({ description: "Whether structured system prompts opt into provider prompt caching." })
    ),
  },
  $I.annote("GenerateWithFeedbackPolicy", {
    description: "Validated timeout, attempt bound, naming, and prompt-caching policy for structured generation.",
  })
) {}

/**
 * Constructor input accepted by {@link GenerateWithFeedbackPolicy}.
 *
 *
 * **Example** (Use the GenerateWithFeedbackPolicyInput contract)
 *
 * ```ts
 * import type { GenerateWithFeedbackPolicyInput } from "@effect-ontology/Service/GenerateWithFeedback"
 *
 * const acceptsGenerateWithFeedbackPolicyInput = (_value: GenerateWithFeedbackPolicyInput): void => undefined
 *
 * console.log(acceptsGenerateWithFeedbackPolicyInput)
 * ```
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
    readonly retrySchedule?: Schedule.Schedule<unknown, unknown, never>;
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
 * Each attempt has its own timeout. `Effect.retry` owns retry timing and the
 * attempt bound; invalid output additionally updates the prompt stored in a
 * `Ref`, while transport and timeout failures retry the unchanged prompt.
 *
 * **Example** (Inspect the feedback generator)
 *
 * ```ts
 * import { generateObjectWithFeedback } from "@effect-ontology/Service/GenerateWithFeedback"
 *
 * console.log(generateObjectWithFeedback)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const generateObjectWithFeedback = Effect.fn("generateObjectWithFeedback")(function* <
  StructuredOutputSchema extends StructuredOutputCodec,
>(
  llm: LanguageModel.Service,
  options: GenerateWithFeedbackOptions<StructuredOutputSchema>
): Effect.fn.Return<
  LanguageModel.GenerateObjectResponse<Record<never, never>, StructuredOutputSchema["Type"]>,
  AiError.AiError | Cause.TimeoutError,
  StructuredOutputSchema["DecodingServices"]
> {
  const policy = GenerateWithFeedbackPolicy.make(options);
  const promptRef = yield* Ref.make(makePrompt(options.prompt, policy.enablePromptCaching));
  const attemptRef = yield* Ref.make(0);

  const attempt = Effect.gen(function* () {
    const attemptNumber = yield* Ref.updateAndGet(attemptRef, (current) => current + 1);
    const prompt = yield* Ref.get(promptRef);
    return yield* llm
      .generateObject({
        prompt,
        schema: options.schema,
        objectName: policy.objectName,
      })
      .pipe(
        Effect.timeout(policy.timeout),
        Effect.tapError((error) =>
          AiError.isAiError(error) && error.reason._tag === "InvalidOutputError"
            ? Effect.all([
                Ref.update(promptRef, Prompt.concat(buildFeedbackPrompt(error.reason))),
                Effect.logWarning("Structured output failed validation; retrying with feedback", {
                  service: policy.serviceName,
                  attempt: attemptNumber,
                  maxAttempts: policy.maxAttempts,
                  errorDescription: Str.slice(0, 500)(error.reason.description),
                }),
              ]).pipe(Effect.asVoid)
            : Effect.logWarning("Language-model attempt failed; retrying", {
                service: policy.serviceName,
                attempt: attemptNumber,
                maxAttempts: policy.maxAttempts,
                errorTag: error._tag,
              })
        )
      );
  });

  const retries = policy.maxAttempts - 1;
  const generated = O.match(O.fromUndefinedOr(options.retrySchedule), {
    onNone: () => attempt.pipe(Effect.retry({ times: retries })),
    onSome: (schedule) => attempt.pipe(Effect.retry({ schedule, times: retries })),
  });

  return yield* generated.pipe(
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
            maxAttempts: policy.maxAttempts,
          })
        ),
        Effect.ignore
      )
    ),
    Effect.tapError((error) =>
      Effect.logError("Structured output attempts exhausted", {
        service: policy.serviceName,
        attempts: policy.maxAttempts,
        errorTag: error._tag,
      })
    )
  );
});
