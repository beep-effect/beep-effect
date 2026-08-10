/**
 * Effect AI language-model adapter for Venice chat completions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $VeniceAiId } from "@beep/identity";
import {
  makeFromProvider,
  OpenAiCompatChatCompletionChunk,
  OpenAiCompatChatCompletionResponse,
  OpenAiCompatLanguageModelConfig,
} from "@beep/openai-compat";
import { SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { Effect, Layer, pipe, Result, Stream } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as AiError from "effect/unstable/ai/AiError";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as AiModel from "effect/unstable/ai/Model";
import { VeniceAI, VeniceAIErrorReason, VeniceAIRequestOptions, VeniceAIResponse } from "./VeniceAI.service.ts";
import type { OpenAiCompatChatCompletionRequest } from "@beep/openai-compat";
import type { VeniceAIError, VeniceAIServerSentEvent, VeniceAIShape } from "./VeniceAI.service.ts";

const $I = $VeniceAiId.create("VeniceAiLanguageModel.service");

/**
 * Options accepted by the Venice Effect AI language-model adapter.
 *
 * **Example** (Making language model options)
 *
 * ```ts
 * import { VeniceAiLanguageModel } from "@beep/venice-ai"
 * import * as S from "effect/Schema"
 *
 * const options = VeniceAiLanguageModel.VeniceAiLanguageModelOptions.make({
 *   model: S.NonEmptyString.make("llama-3.3-70b")
 * })
 *
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAiLanguageModelOptions extends S.Class<VeniceAiLanguageModelOptions>(
  $I`VeniceAiLanguageModelOptions`
)(
  {
    config: S.OptionFromOptionalKey(OpenAiCompatLanguageModelConfig).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional OpenAI-compatible adapter configuration." })
    ),
    model: S.NonEmptyString.annotateKey({ description: "Venice model id forwarded to chat-completion requests." }),
  },
  $I.annote("VeniceAiLanguageModelOptions", {
    description: "Options accepted by the Venice Effect AI language-model adapter.",
  })
) {}

type VeniceAiLanguageModelOptionsInput = {
  readonly config?: OpenAiCompatLanguageModelConfig | undefined;
  readonly model: string;
};

const normalizeLanguageModelOptions = (options: VeniceAiLanguageModelOptionsInput): VeniceAiLanguageModelOptions =>
  VeniceAiLanguageModelOptions.make({
    config: O.fromUndefinedOr(options.config),
    model: S.NonEmptyString.make(options.model),
  });

const moduleName = "VeniceAiLanguageModel.service";

const makeAiError = (method: string, reason: AiError.AiErrorReason): AiError.AiError =>
  AiError.make({ method, module: moduleName, reason });

const errorDescription = (error: VeniceAIError): string =>
  `Venice AI driver failed with ${error.reason}${pipe(
    error.operation,
    O.match({
      onNone: () => "",
      onSome: (operation) => ` during ${operation}`,
    })
  )}.`;

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- adapter maps Venice transport failures locally to Effect AI network errors
const networkTransportError = (error: VeniceAIError): AiError.NetworkError =>
  AiError.NetworkError.make({
    description: errorDescription(error),
    reason: "TransportError",
    request: {
      hash: undefined,
      headers: {},
      method: O.getOrElse(error.method, () => "POST"),
      url: O.getOrElse(error.path, () => "/"),
      urlParams: [],
    },
  });

const mapSchemaError =
  (method: string) =>
  (cause: S.SchemaError): AiError.AiError =>
    makeAiError(method, AiError.InvalidOutputError.fromSchemaError(cause));

const decodeChatCompletionResponseResult = S.decodeUnknownResult(OpenAiCompatChatCompletionResponse);
const decodeChatCompletionChunkResult = S.decodeUnknownResult(OpenAiCompatChatCompletionChunk);

const decodeChatCompletionResponseEffect = (
  input: unknown
): Effect.Effect<OpenAiCompatChatCompletionResponse, AiError.AiError> =>
  Effect.fromResult(
    pipe(decodeChatCompletionResponseResult(input), Result.mapError(mapSchemaError("createChatCompletion")))
  );

const decodeChatCompletionChunkEffect = (
  input: unknown
): Effect.Effect<OpenAiCompatChatCompletionChunk, AiError.AiError> =>
  Effect.fromResult(
    pipe(decodeChatCompletionChunkResult(input), Result.mapError(mapSchemaError("streamChatCompletion")))
  );

const invalidJsonResponse = (method: string): Effect.Effect<never, AiError.AiError> =>
  Effect.fail(
    makeAiError(
      method,
      AiError.InvalidOutputError.make({ description: "Venice chat completion did not return a JSON response." })
    )
  );

const decodeCreateChatCompletionResponse = (
  response: VeniceAIResponse
): Effect.Effect<OpenAiCompatChatCompletionResponse, AiError.AiError> => {
  const result: Effect.Effect<OpenAiCompatChatCompletionResponse, AiError.AiError> = VeniceAIResponse.match(response, {
    Binary: () => invalidJsonResponse("createChatCompletion"),
    Json: (json) => decodeChatCompletionResponseEffect(json.body),
    Text: () => invalidJsonResponse("createChatCompletion"),
  });

  return result;
};

const mapVeniceError =
  (method: string) =>
  (error: VeniceAIError): AiError.AiError => {
    const description = errorDescription(error);

    return pipe(
      error.status,
      O.match({
        onNone: () =>
          VeniceAIErrorReason.$match(error.reason, {
            config: () => makeAiError(method, AiError.InvalidRequestError.make({ description })),
            "multipart encoding": () => makeAiError(method, AiError.InvalidRequestError.make({ description })),
            "request encoding": () => makeAiError(method, AiError.InvalidRequestError.make({ description })),
            "response decoding": () => makeAiError(method, AiError.InvalidOutputError.make({ description })),
            "response status": () => makeAiError(method, AiError.UnknownError.make({ description })),
            "sse decoding": () => makeAiError(method, AiError.InvalidOutputError.make({ description })),
            transport: () => makeAiError(method, networkTransportError(error)),
          }),
        onSome: (status) =>
          makeAiError(
            method,
            AiError.reasonFromHttpStatus({
              description,
              status,
            })
          ),
      })
    );
  };

const createChatCompletion = (
  venice: VeniceAIShape,
  request: OpenAiCompatChatCompletionRequest
): Effect.Effect<OpenAiCompatChatCompletionResponse, AiError.AiError> =>
  pipe(
    venice.createChatCompletion(VeniceAIRequestOptions.make({ body: O.some(request) })),
    Effect.mapError(mapVeniceError("createChatCompletion")),
    Effect.flatMap(decodeCreateChatCompletionResponse),
    Effect.withSpan("VeniceAiLanguageModel.createChatCompletion", {
      attributes: {
        operation: "createChatCompletion",
        provider: "venice-ai",
      },
    })
  );

const parseStreamEvent = (
  event: VeniceAIServerSentEvent
): Effect.Effect<OpenAiCompatChatCompletionChunk, AiError.AiError> =>
  pipe(
    event.data,
    O.match({
      onNone: () =>
        Effect.fail(
          makeAiError(
            "streamChatCompletion",
            AiError.InvalidOutputError.make({ description: "Venice stream event did not carry a data payload." })
          )
        ),
      onSome: decodeChatCompletionChunkEffect,
    })
  );

const streamChatCompletion = (
  venice: VeniceAIShape,
  request: OpenAiCompatChatCompletionRequest
): Stream.Stream<OpenAiCompatChatCompletionChunk, AiError.AiError> =>
  venice.streamChatCompletion(VeniceAIRequestOptions.make({ body: O.some(request) })).pipe(
    Stream.mapError(mapVeniceError("streamChatCompletion")),
    Stream.flatMap((event) => (event.done ? Stream.empty : Stream.fromEffect(parseStreamEvent(event)))),
    Stream.withSpan("VeniceAiLanguageModel.streamChatCompletion", {
      attributes: {
        operation: "streamChatCompletion",
        provider: "venice-ai",
      },
    })
  );

/**
 * Builds a Venice Effect AI language-model service.
 *
 * **Example** (Building language model service)
 *
 * ```ts
 * import { VeniceAiLanguageModel } from "@beep/venice-ai"
 *
 * const languageModel = VeniceAiLanguageModel.make({ model: "llama-3.3-70b" })
 *
 * console.log(languageModel)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: (
  options: VeniceAiLanguageModelOptionsInput
) => Effect.Effect<LanguageModel.Service, never, VeniceAI> = Effect.fn("VeniceAiLanguageModel.make")(function* (input) {
  const options = normalizeLanguageModelOptions(input);
  const venice = yield* VeniceAI;
  return yield* makeFromProvider({
    ...O.getSomesStruct({ config: options.config }),
    model: options.model,
    moduleName,
    provider: {
      createChatCompletion: (request) => createChatCompletion(venice, request),
      streamChatCompletion: (request) => streamChatCompletion(venice, request),
    },
  });
});

/**
 * Builds a Venice Effect AI language-model layer.
 *
 * **Example** (Building language model layer)
 *
 * ```ts
 * import { VeniceAiLanguageModel } from "@beep/venice-ai"
 *
 * const languageModelLayer = VeniceAiLanguageModel.layer({ model: "llama-3.3-70b" })
 *
 * console.log(languageModelLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (
  options: VeniceAiLanguageModelOptionsInput
): Layer.Layer<LanguageModel.LanguageModel, never, VeniceAI> =>
  Layer.effect(LanguageModel.LanguageModel, make(options));

/**
 * Builds an Effect AI model value for Venice.
 *
 * **Example** (Creating Effect AI model)
 *
 * ```ts
 * import { VeniceAiLanguageModel } from "@beep/venice-ai"
 *
 * const aiModel = VeniceAiLanguageModel.model("llama-3.3-70b")
 *
 * console.log(aiModel)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
// fallow-ignore-next-line code-duplication -- provider adapters intentionally mirror the shared Effect AI model surface
export const model: {
  (
    config?: OpenAiCompatLanguageModelConfig | undefined
  ): (modelName: string) => AiModel.Model<"venice", LanguageModel.LanguageModel, VeniceAI>;
  (
    modelName: string,
    config?: OpenAiCompatLanguageModelConfig | undefined
  ): AiModel.Model<"venice", LanguageModel.LanguageModel, VeniceAI>;
} = dual(
  (args) => Str.isString(args[0]),
  (
    modelName: string,
    config?: OpenAiCompatLanguageModelConfig | undefined
  ): AiModel.Model<"venice", LanguageModel.LanguageModel, VeniceAI> =>
    AiModel.make("venice", modelName, layer(config === undefined ? { model: modelName } : { config, model: modelName }))
);
