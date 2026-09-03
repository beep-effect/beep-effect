/**
 * Effect AI language-model adapter for OpenAI-compatible chat completions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenaiCompatId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import { decodeJsonString, encodeJsonString } from "@beep/schema/Json";
import { NonNegativeInt } from "@beep/schema/Number";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, flow, Layer, Match, pipe, Stream, Tuple } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as AiError from "effect/unstable/ai/AiError";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as AiModel from "effect/unstable/ai/Model";
import { toCodecOpenAI } from "effect/unstable/ai/OpenAiStructuredOutput";
import * as Response from "effect/unstable/ai/Response";
import * as Tool from "effect/unstable/ai/Tool";
import {
  OpenAiCompatAssistantChatMessage,
  OpenAiCompatChatCompletionChunk,
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatFinishReason,
  OpenAiCompatFunctionTool,
  OpenAiCompatJsonSchemaResponseFormat,
  OpenAiCompatSystemChatMessage,
  OpenAiCompatTemperature,
  OpenAiCompatToolCall,
  OpenAiCompatToolCallFunction,
  OpenAiCompatToolChatMessage,
  OpenAiCompatUserChatMessage,
} from "./OpenAiCompat.models.ts";
import { OpenAiCompatClient } from "./OpenAiCompatClient.service.ts";
import type * as Prompt from "effect/unstable/ai/Prompt";
import type {
  OpenAiCompatChatCompletionResponse,
  OpenAiCompatChatMessage,
  OpenAiCompatResponseFormat,
  OpenAiCompatToolCallDelta,
} from "./OpenAiCompat.models.ts";
import type { OpenAiCompatClientShape } from "./OpenAiCompatClient.service.ts";

const $I = $OpenaiCompatId.create("OpenAiCompatLanguageModel.service");
const UnknownRecord = S.Record(S.String, S.Unknown).pipe(SchemaUtils.withCodecStatics(["decodeUnknownOption"]));
const OptionalPosInt = S.OptionFromOptionalKey(PosInt).pipe(SchemaUtils.withNoneDefault);
const OptionalNonNegativeInt = S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault);
const OptionalBoolean = S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault);
const OptionalString = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
const OptionalNullableTemperature = OpenAiCompatTemperature.pipe(
  S.NullOr,
  S.OptionFromOptionalKey,
  SchemaUtils.withNoneDefault
);
const OptionalNullableUnitInterval = UnitInterval.pipe(S.NullOr, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);
const decodeFinishReasonOption = S.decodeUnknownOption(OpenAiCompatFinishReason);
const knownFinishReasonToResponse = (reason: OpenAiCompatFinishReason): Response.FinishReason =>
  OpenAiCompatFinishReason.$match(reason, {
    content_filter: () => "content-filter" as const,
    function_call: () => "tool-calls" as const,
    length: () => "length" as const,
    stop: () => "stop" as const,
    tool_calls: () => "tool-calls" as const,
  });
const decodeKnownFinishReasonOption: (reason: string) => O.Option<Response.FinishReason> = flow(
  decodeFinishReasonOption,
  O.map(knownFinishReasonToResponse)
);

/**
 * Request-time tuning options shared by OpenAI-compatible language-model adapters.
 *
 * **Example** (Set max tokens and temperature)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PosInt } from "@beep/schema/Int"
 * import { OpenAiCompatLanguageModelConfig } from "@beep/openai-compat"
 *
 * const config = OpenAiCompatLanguageModelConfig.make({
 *   maxTokens: O.some(PosInt.make(512)),
 *   temperature: O.some(0.2)
 * })
 *
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatLanguageModelConfig extends S.Class<OpenAiCompatLanguageModelConfig>(
  $I`OpenAiCompatLanguageModelConfig`
)(
  {
    maxCompletionTokens: OptionalPosInt.annotateKey({
      description: "Optional positive maximum completion-token count.",
    }),
    maxTokens: OptionalPosInt.annotateKey({ description: "Optional positive legacy maximum token count." }),
    parallelToolCalls: OptionalBoolean.annotateKey({
      description: "Optional parallel tool-call preference for provider requests.",
    }),
    seed: OptionalNonNegativeInt.annotateKey({ description: "Optional non-negative deterministic sampling seed." }),
    strictJsonSchema: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether generated JSON schemas should be marked strict by default.",
    }),
    temperature: OptionalNullableTemperature.annotateKey({
      description: "Optional sampling temperature, preserving explicit null for provider wire compatibility.",
    }),
    topP: OptionalNullableUnitInterval.annotateKey({
      description: "Optional nucleus sampling value, preserving explicit null for provider wire compatibility.",
    }),
    user: OptionalString.annotateKey({ description: "Optional provider-visible end-user identifier." }),
  },
  $I.annote("OpenAiCompatLanguageModelConfig", {
    description: "Request-time tuning options shared by OpenAI-compatible language-model adapters.",
  })
) {}

/**
 * Provider callbacks used by the OpenAI-compatible language-model factory.
 *
 * **Example** (Implement a stub provider)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { OpenAiCompatChatCompletionResponse, type OpenAiCompatProvider } from "@beep/openai-compat"
 *
 * const provider: OpenAiCompatProvider = {
 *   createChatCompletion: () => Effect.succeed(OpenAiCompatChatCompletionResponse.make({ choices: [] })),
 *   streamChatCompletion: () => Stream.empty
 * }
 *
 * console.log(provider)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatProvider = OpenAiCompatClientShape;

/**
 * Options accepted by {@link makeFromProvider}.
 *
 * **Example** (Assemble provider-backed factory options)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { OpenAiCompatChatCompletionResponse, type OpenAiCompatLanguageModelOptions } from "@beep/openai-compat"
 *
 * const provider: OpenAiCompatLanguageModelOptions["provider"] = {
 *   createChatCompletion: () => Effect.succeed(OpenAiCompatChatCompletionResponse.make({ choices: [] })),
 *   streamChatCompletion: () => Stream.empty
 * }
 *
 * const options: OpenAiCompatLanguageModelOptions = {
 *   model: "gpt-compatible",
 *   moduleName: "ExampleLanguageModel",
 *   provider
 * }
 *
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatLanguageModelOptions = OpenAiCompatLanguageModelClientOptions & {
  readonly model: string;
  readonly moduleName: string;
  readonly provider: OpenAiCompatProvider;
};

/**
 * Options accepted by the default OpenAI-compatible language-model constructor.
 *
 * **Example** (Select a model by name)
 *
 * ```ts
 * import type { OpenAiCompatLanguageModelClientOptions } from "@beep/openai-compat"
 *
 * const options: OpenAiCompatLanguageModelClientOptions = {
 *   model: "gpt-compatible"
 * }
 *
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatLanguageModelClientOptions extends S.Class<OpenAiCompatLanguageModelClientOptions>(
  $I`OpenAiCompatLanguageModelClientOptions`
)(
  {
    config: S.optionalKey(OpenAiCompatLanguageModelConfig),
    model: S.String,
  },
  $I.annote("OpenAiCompatLanguageModelClientOptions", {
    description: "Options accepted by the default OpenAI-compatible language-model constructor.",
  })
) {}

class ActiveToolCall extends S.Class<ActiveToolCall>($I`ActiveToolCall`)(
  {
    arguments: S.String.annotateKey({ description: "Buffered JSON argument text for the active stream tool call." }),
    id: S.String.annotateKey({ description: "Stable tool-call identifier reconstructed from stream deltas." }),
    name: S.String.annotateKey({ description: "Tool name reconstructed from stream deltas." }),
  },
  $I.annote("ActiveToolCall", {
    description: "A tool call that is currently active.",
  })
) {}

class StreamState extends S.Class<StreamState>($I`StreamState`)(
  {
    activeToolCalls: S.Record(S.String, ActiveToolCall).annotateKey({
      description: "Active streaming tool calls keyed by provider tool-call index.",
    }),
    finishReason: S.Option(S.String).annotateKey({
      description: "Latest finish reason seen while reconstructing the stream.",
    }),
    finished: S.Boolean.annotateKey({ description: "Whether a finish part has already been emitted." }),
    textEnded: S.Boolean.annotateKey({ description: "Whether the current text span has ended." }),
    textStarted: S.Boolean.annotateKey({ description: "Whether the current text span has started." }),
    usage: OpenAiCompatChatCompletionChunk.fields.usage.annotateKey({
      description: "Latest token usage observed in stream chunks.",
    }),
  },
  $I.annote("StreamState", {
    description: "Mutable stream reconstruction state for OpenAI-compatible streaming chunks.",
  })
) {
  static readonly initial = (): StreamState => ({
    activeToolCalls: {},
    finishReason: O.none(),
    finished: false,
    textEnded: false,
    textStarted: false,
    usage: O.none(),
  });
}

const makeAiError = (moduleName: string, method: string, reason: AiError.AiErrorReason): AiError.AiError =>
  AiError.make({ method, module: moduleName, reason });

const makeInvalidOutput = (moduleName: string, method: string, description: string): AiError.AiError =>
  makeAiError(moduleName, method, AiError.InvalidOutputError.make({ description }));

const makeInvalidUserInput = (moduleName: string, method: string, description: string): AiError.AiError =>
  makeAiError(moduleName, method, AiError.InvalidUserInputError.make({ description }));

const makeUnsupportedSchema = (moduleName: string, method: string, description: string): AiError.AiError =>
  makeAiError(moduleName, method, AiError.UnsupportedSchemaError.make({ description }));

const schemaConversionDescription = (context: string, error: unknown): string =>
  P.isError(error) ? `${context} ${error.message}` : context;

const mapSchemaError =
  (moduleName: string, method: string) =>
  (cause: S.SchemaError): AiError.AiError =>
    makeAiError(moduleName, method, AiError.InvalidOutputError.fromSchemaError(cause));

const jsonObjectOrEmpty: (value: unknown) => Readonly<Record<string, unknown>> = flow(
  UnknownRecord.decodeUnknownOption,
  O.getOrElse(R.empty<string, unknown>)
);

const nonEmptyStringOption = O.liftPredicate(Str.isNonEmpty);
const isImageMediaType = flow(Str.toLowerCase, Str.startsWith("image/"));

const toFinishReason: (reason: O.Option<string>) => Response.FinishReason = flow(
  O.map(decodeKnownFinishReasonOption),
  O.match({
    onNone: (): Response.FinishReason => "unknown",
    onSome: O.getOrElse((): Response.FinishReason => "other"),
  })
);

const usageFromCompat = (usage: OpenAiCompatChatCompletionResponse["usage"]): Response.Usage => {
  const promptTokens = pipe(
    usage,
    O.flatMap((value) => value.prompt_tokens),
    O.getOrUndefined
  );
  const completionTokens = pipe(
    usage,
    O.flatMap((value) => value.completion_tokens),
    O.getOrUndefined
  );

  return Response.Usage.make({
    inputTokens: {
      cacheRead: undefined,
      cacheWrite: undefined,
      total: promptTokens,
      uncached: promptTokens,
    },
    outputTokens: {
      reasoning: undefined,
      text: completionTokens,
      total: completionTokens,
    },
  });
};

const makeFinishPart = (
  usage: OpenAiCompatChatCompletionResponse["usage"],
  reason: O.Option<string>
): Response.FinishPart =>
  Response.makePart("finish", {
    reason: toFinishReason(reason),
    response: undefined,
    usage: usageFromCompat(usage),
  });

const encodeToolParams = (
  moduleName: string,
  method: string,
  params: unknown
): Effect.Effect<string, AiError.AiError> =>
  pipe(encodeJsonString(params), Effect.mapError(mapSchemaError(moduleName, method)));

const decodeToolParams = (
  moduleName: string,
  method: string,
  source: string
): Effect.Effect<unknown, AiError.AiError> =>
  pipe(decodeJsonString(source), Effect.mapError(mapSchemaError(moduleName, method)));

const textContentPart = (part: Prompt.TextPart): Readonly<Record<string, unknown>> => ({
  text: part.text,
  type: "text",
});

const fileContentPart = (
  moduleName: string,
  part: Prompt.FilePart
): Effect.Effect<Readonly<Record<string, unknown>>, AiError.AiError> => {
  if (!isImageMediaType(part.mediaType)) {
    return Effect.fail(
      makeUnsupportedSchema(
        moduleName,
        "prepareMessages",
        `OpenAI-compatible chat requests only support image file parts; received media type "${part.mediaType}".`
      )
    );
  }
  if (P.isString(part.data)) {
    return Effect.succeed({
      image_url: { url: part.data },
      type: "image_url",
    });
  }
  if (part.data instanceof URL) {
    return Effect.succeed({
      image_url: { url: part.data.toString() },
      type: "image_url",
    });
  }
  return Effect.fail(
    makeInvalidUserInput(
      moduleName,
      "prepareMessages",
      "OpenAI-compatible chat requests require file parts to use string or URL data."
    )
  );
};

const userContentPart = (
  moduleName: string,
  part: Prompt.UserMessagePart
): Effect.Effect<Readonly<Record<string, unknown>>, AiError.AiError> => {
  if (part.type === "text") {
    return Effect.succeed(textContentPart(part));
  }
  return fileContentPart(moduleName, part);
};

const assistantTextContent = (parts: ReadonlyArray<Prompt.AssistantMessagePart>): O.Option<string> => {
  const text = pipe(
    parts,
    A.filter((part) => part.type === "text" || part.type === "reasoning"),
    A.map((part) => part.text),
    A.join("")
  );
  return nonEmptyStringOption(text);
};

const assistantToolCall = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  part: Prompt.ToolCallPart
): Effect.Effect<OpenAiCompatToolCall, AiError.AiError> =>
  pipe(
    encodeToolParams(moduleName, "prepareMessages", part.params),
    Effect.map((args) =>
      OpenAiCompatToolCall.make({
        function: OpenAiCompatToolCallFunction.make({
          arguments: args,
          name: toolNameMapper.getProviderName(part.name),
        }),
        id: part.id,
        type: "function",
      })
    )
  );

const assistantToolCalls = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  parts: ReadonlyArray<Prompt.AssistantMessagePart>
): Effect.Effect<ReadonlyArray<OpenAiCompatToolCall>, AiError.AiError> =>
  pipe(
    parts,
    A.filter((part): part is Prompt.ToolCallPart => part.type === "tool-call"),
    Effect.forEach((part) => assistantToolCall(moduleName, toolNameMapper, part))
  );

const toolResultMessage = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  part: Prompt.ToolMessagePart
): Effect.Effect<OpenAiCompatChatMessage, AiError.AiError> => {
  if (part.type !== "tool-result") {
    return Effect.fail(
      makeInvalidUserInput(
        moduleName,
        "prepareMessages",
        "OpenAI-compatible chat requests do not support tool approval response parts."
      )
    );
  }
  return pipe(
    encodeToolParams(moduleName, "prepareMessages", part.result),
    Effect.map((content) =>
      OpenAiCompatToolChatMessage.make({
        content,
        name: toolNameMapper.getProviderName(part.name),
        role: "tool",
        tool_call_id: part.id,
      })
    )
  );
};

const prepareMessage = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  message: Prompt.Message
): Effect.Effect<ReadonlyArray<OpenAiCompatChatMessage>, AiError.AiError> =>
  pipe(
    Match.type<Prompt.Message>(),
    Match.discriminatorsExhaustive("role")({
      assistant: (message) =>
        pipe(
          assistantToolCalls(moduleName, toolNameMapper, message.content),
          Effect.map((toolCalls) => [
            OpenAiCompatAssistantChatMessage.make({
              content: pipe(assistantTextContent(message.content), O.getOrNull),
              role: "assistant",
              ...O.getSomesStruct({
                tool_calls: O.filter(O.some(toolCalls), A.isReadonlyArrayNonEmpty),
              }),
            }),
          ])
        ),
      system: (message) =>
        Effect.succeed(
          A.of(
            OpenAiCompatSystemChatMessage.make({
              content: message.content,
              role: "system",
            })
          )
        ),
      tool: (message) =>
        pipe(
          message.content,
          Effect.forEach((part) => toolResultMessage(moduleName, toolNameMapper, part))
        ),
      user: (message) =>
        pipe(
          message.content,
          Effect.forEach((part) => userContentPart(moduleName, part)),
          Effect.map((content) => [
            OpenAiCompatUserChatMessage.make({
              content,
              role: "user",
            }),
          ])
        ),
    })
  )(message);

const prepareMessages = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  prompt: Prompt.Prompt
): Effect.Effect<OpenAiCompatChatCompletionRequest["messages"], AiError.AiError> =>
  pipe(
    prompt.content,
    Effect.forEach((message) => prepareMessage(moduleName, toolNameMapper, message)),
    Effect.map(A.flatten),
    Effect.map((messages) =>
      pipe(
        messages,
        A.match({
          onEmpty: () =>
            A.of(
              OpenAiCompatUserChatMessage.make({
                content: "",
                role: "user",
              })
            ),
          onNonEmpty: (messages) => messages,
        })
      )
    )
  );

const prepareTool = (
  moduleName: string,
  config: OpenAiCompatLanguageModelConfig,
  tool: Tool.Any
): Effect.Effect<OpenAiCompatFunctionTool, AiError.AiError> =>
  Effect.try({
    catch: (error) =>
      makeUnsupportedSchema(
        moduleName,
        "prepareTools",
        schemaConversionDescription("Unable to convert tool parameters to JSON Schema.", error)
      ),
    try: () => {
      const name = Tool.isProviderDefined(tool) ? tool.providerName : tool.name;
      const parameters = Tool.getJsonSchema(tool, { transformer: toCodecOpenAI });
      return OpenAiCompatFunctionTool.make({
        function: {
          description: pipe(Tool.getDescription(tool), O.fromUndefinedOr, O.getOrNull),
          name,
          parameters: jsonObjectOrEmpty(parameters),
          strict: pipe(
            Tool.getStrictMode(tool),
            O.fromUndefinedOr,
            O.getOrElse(() => config.strictJsonSchema)
          ),
        },
        type: "function",
      });
    },
  });

const prepareTools = (
  moduleName: string,
  config: OpenAiCompatLanguageModelConfig,
  options: LanguageModel.ProviderOptions
): Effect.Effect<O.Option<ReadonlyArray<OpenAiCompatFunctionTool>>, AiError.AiError> =>
  A.isReadonlyArrayNonEmpty(options.tools)
    ? pipe(
        options.tools,
        Effect.forEach((tool) => prepareTool(moduleName, config, tool)),
        Effect.asSome
      )
    : Effect.succeedNone;

const prepareToolChoice = (
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  toolChoice: LanguageModel.ProviderOptions["toolChoice"]
): O.Option<unknown> => {
  if (toolChoice === "auto" || toolChoice === "none" || toolChoice === "required") {
    return O.some(toolChoice);
  }
  if (P.isUndefined(toolChoice)) {
    return O.none();
  }
  if ("tool" in toolChoice) {
    return O.some({
      function: { name: toolNameMapper.getProviderName(toolChoice.tool) },
      type: "function",
    });
  }
  if (A.length(toolChoice.oneOf) === 1 && toolChoice.mode === "required") {
    return pipe(
      toolChoice.oneOf,
      A.head,
      O.map((toolName) => ({
        function: { name: toolNameMapper.getProviderName(toolName) },
        type: "function",
      }))
    );
  }
  return O.some(toolChoice.mode === "required" ? "required" : "auto");
};

const prepareResponseFormat = (
  moduleName: string,
  config: OpenAiCompatLanguageModelConfig,
  responseFormat: LanguageModel.ProviderOptions["responseFormat"]
): Effect.Effect<O.Option<OpenAiCompatResponseFormat>, AiError.AiError> =>
  pipe(
    Match.type<LanguageModel.ProviderOptions["responseFormat"]>(),
    Match.discriminatorsExhaustive("type")({
      json: (responseFormat) =>
        Effect.try({
          catch: (error) =>
            makeUnsupportedSchema(
              moduleName,
              "prepareResponseFormat",
              schemaConversionDescription("Unable to convert structured response schema to JSON Schema.", error)
            ),
          try: () =>
            O.some(
              OpenAiCompatJsonSchemaResponseFormat.make({
                json_schema: {
                  name: responseFormat.objectName,
                  schema: jsonObjectOrEmpty(
                    Tool.getJsonSchemaFromSchema(responseFormat.schema, { transformer: toCodecOpenAI })
                  ),
                  strict: config.strictJsonSchema,
                },
                type: "json_schema",
              })
            ),
        }),
      text: () => Effect.succeedNone,
    })
  )(responseFormat);

const makeRequest = Effect.fn("OpenAiCompatLanguageModel.makeRequest")(function* (
  moduleName: string,
  model: string,
  config: OpenAiCompatLanguageModelConfig,
  options: LanguageModel.ProviderOptions,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  stream: boolean
): Effect.fn.Return<OpenAiCompatChatCompletionRequest, AiError.AiError> {
  const messages = yield* prepareMessages(moduleName, toolNameMapper, options.prompt);
  const tools = yield* prepareTools(moduleName, config, options);
  const responseFormat = yield* prepareResponseFormat(moduleName, config, options.responseFormat);
  return OpenAiCompatChatCompletionRequest.make({
    messages,
    model,
    ...O.getSomesStruct({
      max_completion_tokens: config.maxCompletionTokens,
      max_tokens: config.maxTokens,
      parallel_tool_calls: config.parallelToolCalls,
      response_format: responseFormat,
      seed: config.seed,
      stream: stream ? O.some(true) : O.none<boolean>(),
      stream_options: stream
        ? O.some<Readonly<Record<string, unknown>>>({ include_usage: true })
        : O.none<Readonly<Record<string, unknown>>>(),
      temperature: config.temperature,
      tool_choice: O.isSome(tools) ? prepareToolChoice(toolNameMapper, options.toolChoice) : O.none(),
      tools,
      top_p: config.topP,
      user: config.user,
    }),
  });
});

const makeToolCallPart = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  toolCall: OpenAiCompatToolCall
): Effect.Effect<Response.ToolCallPartEncoded, AiError.AiError> =>
  pipe(
    decodeToolParams(moduleName, "makeResponse", toolCall.function.arguments),
    Effect.map(
      (params): Response.ToolCallPartEncoded =>
        Response.makePart("tool-call", {
          id: toolCall.id,
          name: toolNameMapper.getCustomName(toolCall.function.name),
          params,
          providerExecuted: false,
        })
    )
  );

const streamToolCallIndex = (toolCall: OpenAiCompatToolCallDelta, indexInChunk: number): string =>
  String(toolCall.index ?? indexInChunk);

const streamToolCallId = (
  chunk: OpenAiCompatChatCompletionChunk,
  toolIndex: string,
  activeToolCall: ActiveToolCall | undefined,
  toolCall: OpenAiCompatToolCallDelta
): string =>
  activeToolCall?.id ?? toolCall.id ?? (chunk.id === undefined ? `tool_${toolIndex}` : `${chunk.id}_tool_${toolIndex}`);

const streamToolCallName = (
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  activeToolCall: ActiveToolCall | undefined,
  toolCall: OpenAiCompatToolCallDelta
): string =>
  toolCall.function?.name === undefined
    ? (activeToolCall?.name ?? toolNameMapper.getCustomName("unknown_tool"))
    : toolNameMapper.getCustomName(toolCall.function.name);

type ToolCallDeltaAccumulator = readonly [
  Readonly<Record<string, ActiveToolCall>>,
  ReadonlyArray<Response.StreamPartEncoded>,
];

const makeToolCallDeltaParts = (
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  chunk: OpenAiCompatChatCompletionChunk,
  activeToolCalls: Readonly<Record<string, ActiveToolCall>>,
  toolCall: OpenAiCompatToolCallDelta,
  indexInChunk: number
): ToolCallDeltaAccumulator => {
  const toolIndex = streamToolCallIndex(toolCall, indexInChunk);
  const activeToolCall = activeToolCalls[toolIndex];
  const id = streamToolCallId(chunk, toolIndex, activeToolCall, toolCall);
  const name = streamToolCallName(toolNameMapper, activeToolCall, toolCall);
  const argumentsDelta = toolCall.function?.arguments ?? "";
  const nextToolCall: ActiveToolCall = {
    arguments: `${activeToolCall?.arguments ?? ""}${argumentsDelta}`,
    id,
    name,
  };
  const parts: ReadonlyArray<Response.StreamPartEncoded> = [
    ...(activeToolCall === undefined
      ? [
          Response.makePart("tool-params-start", {
            id,
            name,
            providerExecuted: false,
          }),
        ]
      : []),
    ...(Str.isNonEmpty(argumentsDelta)
      ? [
          Response.makePart("tool-params-delta", {
            delta: argumentsDelta,
            id,
          }),
        ]
      : []),
  ];
  return Tuple.make(R.set(activeToolCalls, toolIndex, nextToolCall), parts);
};

const makeCompletedStreamToolCallParts = (
  moduleName: string,
  toolCall: ActiveToolCall
): Effect.Effect<ReadonlyArray<Response.StreamPartEncoded>, AiError.AiError> =>
  pipe(
    decodeToolParams(moduleName, "makeStreamResponse", Str.isNonEmpty(toolCall.arguments) ? toolCall.arguments : "{}"),
    Effect.map((params) => [
      Response.makePart("tool-params-end", { id: toolCall.id }),
      Response.makePart("tool-call", {
        id: toolCall.id,
        name: toolCall.name,
        params,
        providerExecuted: false,
      }),
    ])
  );

const makeCompletedStreamToolCallsParts = (
  moduleName: string,
  activeToolCalls: Readonly<Record<string, ActiveToolCall>>
): Effect.Effect<ReadonlyArray<Response.StreamPartEncoded>, AiError.AiError> =>
  pipe(
    R.values(activeToolCalls),
    Effect.forEach((toolCall) => makeCompletedStreamToolCallParts(moduleName, toolCall)),
    Effect.map(A.flatten)
  );

const makeChoiceParts = Effect.fn("OpenAiCompatLanguageModel.makeChoiceParts")(function* (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  response: OpenAiCompatChatCompletionResponse
): Effect.fn.Return<Array<Response.PartEncoded>, AiError.AiError> {
  if (A.length(response.choices) > 1) {
    yield* Effect.logDebug({
      choiceCount: A.length(response.choices),
      component: moduleName,
      event: "additional-choices-ignored",
      method: "makeResponse",
    });
  }
  const choice = yield* pipe(
    response.choices,
    A.head,
    Effect.fromOption(() =>
      makeInvalidOutput(moduleName, "makeResponse", "Provider response did not include a choice.")
    )
  );
  const textParts = pipe(
    choice.message,
    O.flatMap((message) => message.content),
    O.flatMap(nonEmptyStringOption),
    O.match({
      onNone: A.empty<Response.PartEncoded>,
      onSome: (text) => [Response.makePart("text", { text })],
    })
  );
  const toolParts = yield* pipe(
    choice.message,
    O.flatMap((message) => message.tool_calls),
    O.getOrElse(A.empty<OpenAiCompatToolCall>),
    Effect.forEach((toolCall) => makeToolCallPart(moduleName, toolNameMapper, toolCall))
  );
  return [...textParts, ...toolParts, makeFinishPart(response.usage, choice.finish_reason)];
});

const finishStreamParts = (state: StreamState): ReadonlyArray<Response.StreamPartEncoded> =>
  state.finished
    ? []
    : [
        ...(state.textStarted && !state.textEnded ? [Response.makePart("text-end", { id: "0" })] : []),
        makeFinishPart(state.usage, state.finishReason),
      ];

const makeStreamChoiceParts = Effect.fn("OpenAiCompatLanguageModel.makeStreamChoiceParts")(function* (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  state: StreamState,
  chunk: OpenAiCompatChatCompletionChunk
): Effect.fn.Return<readonly [StreamState, ReadonlyArray<Response.StreamPartEncoded>], AiError.AiError> {
  let activeToolCalls = state.activeToolCalls;
  let finishReason = state.finishReason;
  const usage = O.isSome(chunk.usage) ? chunk.usage : state.usage;
  const choiceParts = yield* pipe(
    chunk.choices,
    Effect.forEach(
      Effect.fnUntraced(function* (choice) {
        const textParts = pipe(
          choice.delta,
          O.flatMap((delta) => delta.content),
          O.flatMap(nonEmptyStringOption),
          O.match({
            onNone: A.empty<Response.StreamPartEncoded>,
            onSome: (delta) => [
              ...(state.textStarted ? [] : [Response.makePart("text-start", { id: "0" })]),
              Response.makePart("text-delta", { delta, id: "0" }),
            ],
          })
        );
        const toolCallDeltaSeed: ToolCallDeltaAccumulator = Tuple.make(
          activeToolCalls,
          A.empty<Response.StreamPartEncoded>()
        );
        const [nextActiveToolCalls, toolDeltaParts] = pipe(
          choice.delta,
          O.flatMap((delta) => delta.tool_calls),
          O.getOrElse(A.empty<OpenAiCompatToolCallDelta>),
          A.reduce(
            toolCallDeltaSeed,
            ([currentActiveToolCalls, currentParts], toolCall, indexInChunk): ToolCallDeltaAccumulator => {
              const [updatedActiveToolCalls, deltaParts] = makeToolCallDeltaParts(
                toolNameMapper,
                chunk,
                currentActiveToolCalls,
                toolCall,
                indexInChunk
              );
              return Tuple.make(updatedActiveToolCalls, [...currentParts, ...deltaParts]);
            }
          )
        );
        activeToolCalls = nextActiveToolCalls;
        const hasFinish = O.isSome(choice.finish_reason);
        if (hasFinish) {
          finishReason = choice.finish_reason;
        }
        const completedToolParts = hasFinish
          ? yield* makeCompletedStreamToolCallsParts(moduleName, activeToolCalls)
          : [];
        if (hasFinish) {
          activeToolCalls = {};
        }
        const parts: ReadonlyArray<Response.StreamPartEncoded> = [
          ...textParts,
          ...toolDeltaParts,
          ...completedToolParts,
          ...(hasFinish && (state.textStarted || A.isReadonlyArrayNonEmpty(textParts))
            ? [Response.makePart("text-end", { id: "0" })]
            : []),
        ];
        return parts;
      })
    )
  );
  const shouldFinish =
    !state.finished && O.isSome(usage) && (O.isSome(finishReason) || !A.isReadonlyArrayNonEmpty(chunk.choices));
  const parts: Array<Response.StreamPartEncoded> = pipe(choiceParts, A.flatten);
  const finishedParts = shouldFinish ? [makeFinishPart(usage, finishReason)] : [];
  const allParts = [...parts, ...finishedParts];
  const textStarted =
    state.textStarted ||
    pipe(
      allParts,
      A.some((part) => part.type === "text-start")
    );
  const textEnded =
    state.textEnded ||
    pipe(
      allParts,
      A.some((part) => part.type === "text-end")
    );
  const finished = state.finished || shouldFinish;
  return Tuple.make(
    {
      activeToolCalls,
      finishReason,
      finished,
      textEnded,
      textStarted,
      usage,
    },
    allParts
  );
});

const makeStreamResponse = (
  moduleName: string,
  toolNameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>,
  stream: Stream.Stream<OpenAiCompatChatCompletionChunk, AiError.AiError>
): Stream.Stream<Response.StreamPartEncoded, AiError.AiError> =>
  stream.pipe(
    Stream.mapAccumEffect(
      StreamState.initial,
      (state, chunk) => makeStreamChoiceParts(moduleName, toolNameMapper, state, chunk),
      { onHalt: finishStreamParts }
    )
  );

/**
 * Builds an Effect AI language-model service from OpenAI-compatible provider callbacks.
 *
 * **Example** (Build a model from provider callbacks)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { makeFromProvider, OpenAiCompatChatCompletionResponse } from "@beep/openai-compat"
 *
 * const model = makeFromProvider({
 *   model: "gpt-compatible",
 *   moduleName: "ExampleLanguageModel",
 *   provider: {
 *     createChatCompletion: () => Effect.succeed(OpenAiCompatChatCompletionResponse.make({ choices: [] })),
 *     streamChatCompletion: () => Stream.empty
 *   }
 * })
 *
 * console.log(model)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFromProvider: (options: OpenAiCompatLanguageModelOptions) => Effect.Effect<LanguageModel.Service> =
  Effect.fn("OpenAiCompatLanguageModel.makeFromProvider")(function* (options) {
    const { config = OpenAiCompatLanguageModelConfig.make({}), model, moduleName, provider } = options;

    return yield* LanguageModel.make({
      codecTransformer: toCodecOpenAI,
      generateText: Effect.fnUntraced(function* (options) {
        const toolNameMapper = new Tool.NameMapper(options.tools);
        const request = yield* makeRequest(moduleName, model, config, options, toolNameMapper, false);
        const response = yield* provider.createChatCompletion(request);
        return yield* makeChoiceParts(moduleName, toolNameMapper, response);
      }),
      streamText: (options) => {
        const toolNameMapper = new Tool.NameMapper(options.tools);
        return pipe(
          makeRequest(moduleName, model, config, options, toolNameMapper, true),
          Effect.map((request) =>
            makeStreamResponse(moduleName, toolNameMapper, provider.streamChatCompletion(request))
          ),
          Stream.unwrap
        );
      },
    });
  });

/**
 * Builds a layer for an OpenAI-compatible language model from provider callbacks.
 *
 * **Example** (Build a layer from provider callbacks)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { layerFromProvider, OpenAiCompatChatCompletionResponse } from "@beep/openai-compat"
 *
 * const layer = layerFromProvider({
 *   model: "gpt-compatible",
 *   moduleName: "ExampleLanguageModel",
 *   provider: {
 *     createChatCompletion: () => Effect.succeed(OpenAiCompatChatCompletionResponse.make({ choices: [] })),
 *     streamChatCompletion: () => Stream.empty
 *   }
 * })
 *
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerFromProvider = (
  options: OpenAiCompatLanguageModelOptions
): Layer.Layer<LanguageModel.LanguageModel> => Layer.effect(LanguageModel.LanguageModel, makeFromProvider(options));

/**
 * Builds an OpenAI-compatible language-model service backed by {@link OpenAiCompatClient}.
 *
 * **Example** (Build a client-backed model)
 *
 * ```ts
 * import { make } from "@beep/openai-compat"
 *
 * const model = make({ model: "gpt-compatible" })
 *
 * console.log(model)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make: (
  options: OpenAiCompatLanguageModelClientOptions
) => Effect.Effect<LanguageModel.Service, never, OpenAiCompatClient> = Effect.fn("OpenAiCompatLanguageModel.make")(
  function* (options) {
    const client = yield* OpenAiCompatClient;
    return yield* makeFromProvider({
      ...O.getSomesStruct({ config: O.fromUndefinedOr(options.config) }),
      model: options.model,
      moduleName: "OpenAiCompatLanguageModel",
      provider: {
        createChatCompletion: client.createChatCompletion,
        streamChatCompletion: client.streamChatCompletion,
      },
    });
  }
);

/**
 * Builds a language-model layer backed by {@link OpenAiCompatClient}.
 *
 * **Example** (Build a client-backed layer)
 *
 * ```ts
 * import { layer } from "@beep/openai-compat"
 *
 * const modelLayer = layer({ model: "gpt-compatible" })
 *
 * console.log(modelLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (
  options: OpenAiCompatLanguageModelClientOptions
): Layer.Layer<LanguageModel.LanguageModel, never, OpenAiCompatClient> =>
  Layer.effect(LanguageModel.LanguageModel, make(options));

/**
 * Builds an Effect AI model value for a generic OpenAI-compatible provider.
 *
 * **Example** (Build an AI model value by name)
 *
 * ```ts
 * import { model } from "@beep/openai-compat"
 *
 * const aiModel = model("gpt-compatible")
 *
 * console.log(aiModel)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const model: {
  (
    config?: OpenAiCompatLanguageModelConfig | undefined
  ): (modelName: string) => AiModel.Model<"openai-compat", LanguageModel.LanguageModel, OpenAiCompatClient>;
  (
    modelName: string,
    config?: OpenAiCompatLanguageModelConfig | undefined
  ): AiModel.Model<"openai-compat", LanguageModel.LanguageModel, OpenAiCompatClient>;
} = dual(
  (args) => Str.isString(args[0]),
  (
    modelName: string,
    config?: OpenAiCompatLanguageModelConfig | undefined
  ): AiModel.Model<"openai-compat", LanguageModel.LanguageModel, OpenAiCompatClient> =>
    AiModel.make(
      "openai-compat",
      modelName,
      layer(
        config === undefined
          ? { model: modelName }
          : {
              config,
              model: modelName,
            }
      )
    )
);
