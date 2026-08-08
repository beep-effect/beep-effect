/**
 * Schema-first OpenAI-compatible chat completion request and response models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenaiCompatId } from "@beep/identity";
import { LiteralKit, OptionFromOptionalNullishKey, SchemaUtils } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import { NonNegativeInt } from "@beep/schema/Number";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $OpenaiCompatId.create("OpenAiCompat.models");

const OptionalNullableString = OptionFromOptionalNullishKey(S.String).pipe(SchemaUtils.withNoneDefault);
const OptionalNonNegativeInt = S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault);
const OptionalUnknownRecord = S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault);
/**
 * OpenAI-compatible sampling temperature.
 *
 * **Example** (Making a temperature value)
 *
 * ```ts
 * import { OpenAiCompatTemperature } from "@beep/openai-compat"
 *
 * const temperature = OpenAiCompatTemperature.make(0.7)
 *
 * console.log(temperature)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenAiCompatTemperature = S.Finite.check(S.isBetween({ minimum: 0, maximum: 2 })).pipe(
  $I.annoteSchema("OpenAiCompatTemperature", {
    description: "OpenAI-compatible sampling temperature in the inclusive range 0 through 2.",
  })
);

/**
 * OpenAI-compatible sampling temperature.
 *
 * **Example** (Typing a temperature value)
 *
 * ```ts
 * import type { OpenAiCompatTemperature } from "@beep/openai-compat"
 *
 * const temperature: OpenAiCompatTemperature = 0.7
 *
 * console.log(temperature)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatTemperature = typeof OpenAiCompatTemperature.Type;

/**
 * OpenAI-compatible frequency or presence penalty.
 *
 * **Example** (Making a penalty value)
 *
 * ```ts
 * import { OpenAiCompatPenalty } from "@beep/openai-compat"
 *
 * const penalty = OpenAiCompatPenalty.make(0)
 *
 * console.log(penalty)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenAiCompatPenalty = S.Finite.check(S.isBetween({ minimum: -2, maximum: 2 })).pipe(
  $I.annoteSchema("OpenAiCompatPenalty", {
    description: "OpenAI-compatible frequency or presence penalty in the inclusive range -2 through 2.",
  })
);

/**
 * OpenAI-compatible frequency or presence penalty.
 *
 * **Example** (Typing a penalty value)
 *
 * ```ts
 * import type { OpenAiCompatPenalty } from "@beep/openai-compat"
 *
 * const penalty: OpenAiCompatPenalty = 0
 *
 * console.log(penalty)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatPenalty = typeof OpenAiCompatPenalty.Type;

/**
 * Chat roles accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Checking a user role)
 *
 * ```ts
 * import { OpenAiCompatChatRole } from "@beep/openai-compat"
 *
 * const isUserRole = OpenAiCompatChatRole.is.user("user")
 *
 * console.log(isUserRole)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenAiCompatChatRole = LiteralKit(["system", "user", "assistant", "tool"]).pipe(
  $I.annoteSchema("OpenAiCompatChatRole", {
    description: "Chat roles accepted by OpenAI-compatible chat completion endpoints.",
  })
);

/**
 * Chat roles accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Typing an assistant role)
 *
 * ```ts
 * import type { OpenAiCompatChatRole } from "@beep/openai-compat"
 *
 * const role: OpenAiCompatChatRole = "assistant"
 *
 * console.log(role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatChatRole = typeof OpenAiCompatChatRole.Type;

/**
 * Finish reasons emitted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Checking a stop reason)
 *
 * ```ts
 * import { OpenAiCompatFinishReason } from "@beep/openai-compat"
 *
 * const stopped = OpenAiCompatFinishReason.is.stop("stop")
 *
 * console.log(stopped)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenAiCompatFinishReason = LiteralKit([
  "stop",
  "length",
  "tool_calls",
  "content_filter",
  "function_call",
]).pipe(
  $I.annoteSchema("OpenAiCompatFinishReason", {
    description: "Finish reasons emitted by OpenAI-compatible chat completion endpoints.",
  })
);

/**
 * Finish reasons emitted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Typing a tool_calls reason)
 *
 * ```ts
 * import type { OpenAiCompatFinishReason } from "@beep/openai-compat"
 *
 * const reason: OpenAiCompatFinishReason = "tool_calls"
 *
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatFinishReason = typeof OpenAiCompatFinishReason.Type;

/**
 * Function payload inside an OpenAI-compatible tool call.
 *
 * **Example** (Making a tool-call function)
 *
 * ```ts
 * import { OpenAiCompatToolCallFunction } from "@beep/openai-compat"
 *
 * const call = OpenAiCompatToolCallFunction.make({
 *   arguments: "{\"city\":\"Austin\"}",
 *   name: "weather"
 * })
 *
 * console.log(call)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatToolCallFunction extends S.Class<OpenAiCompatToolCallFunction>(
  $I`OpenAiCompatToolCallFunction`
)(
  {
    arguments: S.String.annotateKey({ description: "JSON-encoded argument payload supplied to the tool call." }),
    name: S.String.annotateKey({ description: "Provider-facing function name for the tool call." }),
  },
  $I.annote("OpenAiCompatToolCallFunction", {
    description: "Function payload inside an OpenAI-compatible tool call.",
  })
) {}

/**
 * Tool call payload emitted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a tool call)
 *
 * ```ts
 * import { OpenAiCompatToolCall } from "@beep/openai-compat"
 *
 * const call = OpenAiCompatToolCall.make({
 *   function: { arguments: "{}", name: "noop" },
 *   id: "call_1",
 *   type: "function"
 * })
 *
 * console.log(call)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatToolCall extends S.Class<OpenAiCompatToolCall>($I`OpenAiCompatToolCall`)(
  {
    function: OpenAiCompatToolCallFunction.annotateKey({
      description: "Function payload attached to the OpenAI-compatible tool call.",
    }),
    id: S.String.annotateKey({ description: "Provider-generated tool-call identifier." }),
    index: S.optionalKey(NonNegativeInt).annotateKey({
      description: "Zero-based tool-call index when a provider includes one.",
    }),
    type: S.tag("function").annotateKey({ description: "OpenAI-compatible tool-call discriminator." }),
  },
  $I.annote("OpenAiCompatToolCall", {
    description: "Tool call payload emitted by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Incremental function payload inside an OpenAI-compatible streaming tool-call delta.
 *
 * **Example** (Making a function delta)
 *
 * ```ts
 * import { OpenAiCompatToolCallFunctionDelta } from "@beep/openai-compat"
 *
 * const delta = OpenAiCompatToolCallFunctionDelta.make({
 *   arguments: "{\"city\""
 * })
 *
 * console.log(delta)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatToolCallFunctionDelta extends S.Class<OpenAiCompatToolCallFunctionDelta>(
  $I`OpenAiCompatToolCallFunctionDelta`
)(
  {
    arguments: S.optionalKey(S.String).annotateKey({
      description: "Partial JSON-encoded argument delta for a streaming tool call.",
    }),
    name: S.optionalKey(S.String).annotateKey({
      description: "Provider-facing function name when present in the stream delta.",
    }),
  },
  $I.annote("OpenAiCompatToolCallFunctionDelta", {
    description: "Incremental function payload inside an OpenAI-compatible streaming tool-call delta.",
  })
) {}

/**
 * Incremental tool-call payload emitted by OpenAI-compatible chat completion streams.
 *
 * **Example** (Making a tool-call delta)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import { OpenAiCompatToolCallDelta } from "@beep/openai-compat"
 *
 * const delta = OpenAiCompatToolCallDelta.make({
 *   function: { arguments: "{\"city\"" },
 *   index: NonNegativeInt.make(0)
 * })
 *
 * console.log(delta)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatToolCallDelta extends S.Class<OpenAiCompatToolCallDelta>($I`OpenAiCompatToolCallDelta`)(
  {
    function: S.optionalKey(OpenAiCompatToolCallFunctionDelta).annotateKey({
      description: "Incremental function payload for the streaming tool-call delta.",
    }),
    id: S.optionalKey(S.String).annotateKey({ description: "Tool-call identifier when supplied by the stream." }),
    index: S.optionalKey(NonNegativeInt).annotateKey({
      description: "Zero-based streaming tool-call index.",
    }),
    type: S.optionalKey(S.Literal("function")).annotateKey({
      description: "Streaming tool-call discriminator when supplied by the provider.",
    }),
  },
  $I.annote("OpenAiCompatToolCallDelta", {
    description: "Incremental tool-call payload emitted by OpenAI-compatible chat completion streams.",
  })
) {}

/**
 * Function details sent to OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a function definition)
 *
 * ```ts
 * import { OpenAiCompatFunctionToolDefinition } from "@beep/openai-compat"
 *
 * const definition = OpenAiCompatFunctionToolDefinition.make({
 *   name: "noop",
 *   parameters: { type: "object" }
 * })
 *
 * console.log(definition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatFunctionToolDefinition extends S.Class<OpenAiCompatFunctionToolDefinition>(
  $I`OpenAiCompatFunctionToolDefinition`
)(
  {
    description: S.String.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Optional provider-visible tool description.",
    }),
    name: S.String.annotateKey({ description: "Provider-visible function name." }),
    parameters: S.Record(S.String, S.Unknown).annotateKey({
      description: "JSON Schema parameter object forwarded to the provider.",
    }),
    strict: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether the provider should enforce the supplied JSON Schema strictly.",
    }),
  },
  $I.annote("OpenAiCompatFunctionToolDefinition", {
    description: "Function details sent to OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Function declaration sent to OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a function tool)
 *
 * ```ts
 * import { OpenAiCompatFunctionTool } from "@beep/openai-compat"
 *
 * const tool = OpenAiCompatFunctionTool.make({
 *   function: { name: "noop", parameters: { type: "object" } },
 *   type: "function"
 * })
 *
 * console.log(tool)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatFunctionTool extends S.Class<OpenAiCompatFunctionTool>($I`OpenAiCompatFunctionTool`)(
  {
    function: OpenAiCompatFunctionToolDefinition.annotateKey({
      description: "Function definition sent to the chat completion provider.",
    }),
    type: S.tag("function").annotateKey({ description: "OpenAI-compatible function-tool discriminator." }),
  },
  $I.annote("OpenAiCompatFunctionTool", {
    description: "Function declaration sent to OpenAI-compatible chat completion endpoints.",
  })
) {}

const OpenAiCompatChatContent = S.Union([S.String, S.Array(S.Record(S.String, S.Unknown))]).pipe(
  $I.annoteSchema("OpenAiCompatChatContent", {
    description: "Text or multimodal chat message content accepted by OpenAI-compatible endpoints.",
  })
);

/**
 * System chat message accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a system message)
 *
 * ```ts
 * import { OpenAiCompatSystemChatMessage } from "@beep/openai-compat"
 *
 * const message = OpenAiCompatSystemChatMessage.make({
 *   content: "You are concise.",
 *   role: "system"
 * })
 *
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatSystemChatMessage extends S.Class<OpenAiCompatSystemChatMessage>(
  $I`OpenAiCompatSystemChatMessage`
)(
  {
    content: OpenAiCompatChatContent.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "System message content sent to the provider.",
    }),
    name: S.optionalKey(S.String).annotateKey({ description: "Optional participant name for the system message." }),
    role: S.tag("system").annotateKey({ description: "System chat role discriminator." }),
  },
  $I.annote("OpenAiCompatSystemChatMessage", {
    description: "System chat message accepted by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * User chat message accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a user message)
 *
 * ```ts
 * import { OpenAiCompatUserChatMessage } from "@beep/openai-compat"
 *
 * const message = OpenAiCompatUserChatMessage.make({
 *   content: "Hello",
 *   role: "user"
 * })
 *
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatUserChatMessage extends S.Class<OpenAiCompatUserChatMessage>($I`OpenAiCompatUserChatMessage`)(
  {
    content: OpenAiCompatChatContent.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "User message content sent to the provider.",
    }),
    name: S.optionalKey(S.String).annotateKey({ description: "Optional participant name for the user message." }),
    role: S.tag("user").annotateKey({ description: "User chat role discriminator." }),
  },
  $I.annote("OpenAiCompatUserChatMessage", {
    description: "User chat message accepted by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Assistant chat message accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making an assistant message)
 *
 * ```ts
 * import { OpenAiCompatAssistantChatMessage } from "@beep/openai-compat"
 *
 * const message = OpenAiCompatAssistantChatMessage.make({
 *   content: "Hi there",
 *   role: "assistant"
 * })
 *
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatAssistantChatMessage extends S.Class<OpenAiCompatAssistantChatMessage>(
  $I`OpenAiCompatAssistantChatMessage`
)(
  {
    content: OpenAiCompatChatContent.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Assistant message content sent to the provider.",
    }),
    name: S.optionalKey(S.String).annotateKey({
      description: "Optional participant name for the assistant message.",
    }),
    role: S.tag("assistant").annotateKey({ description: "Assistant chat role discriminator." }),
    tool_calls: OpenAiCompatToolCall.pipe(S.Array, S.optionalKey).annotateKey({
      description: "Tool calls requested by the assistant message.",
    }),
  },
  $I.annote("OpenAiCompatAssistantChatMessage", {
    description: "Assistant chat message accepted by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Tool chat message accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a tool message)
 *
 * ```ts
 * import { OpenAiCompatToolChatMessage } from "@beep/openai-compat"
 *
 * const message = OpenAiCompatToolChatMessage.make({
 *   content: "{}",
 *   role: "tool",
 *   tool_call_id: "call_1"
 * })
 *
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatToolChatMessage extends S.Class<OpenAiCompatToolChatMessage>($I`OpenAiCompatToolChatMessage`)(
  {
    content: OpenAiCompatChatContent.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Tool result content sent back to the provider.",
    }),
    name: S.optionalKey(S.String).annotateKey({ description: "Optional provider-facing tool name." }),
    role: S.tag("tool").annotateKey({ description: "Tool chat role discriminator." }),
    tool_call_id: S.optionalKey(S.String).annotateKey({
      description: "Identifier of the tool call this message answers.",
    }),
  },
  $I.annote("OpenAiCompatToolChatMessage", {
    description: "Tool chat message accepted by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Chat message accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Typing a user chat message)
 *
 * ```ts
 * import type { OpenAiCompatChatMessage } from "@beep/openai-compat"
 *
 * const message: OpenAiCompatChatMessage = {
 *   content: "Hello",
 *   role: "user"
 * }
 *
 * console.log(message)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenAiCompatChatMessage = OpenAiCompatChatRole.mapMembers(
  Tuple.evolve([
    () => OpenAiCompatSystemChatMessage,
    () => OpenAiCompatUserChatMessage,
    () => OpenAiCompatAssistantChatMessage,
    () => OpenAiCompatToolChatMessage,
  ])
).pipe(
  $I.annoteSchema("OpenAiCompatChatMessage", {
    description: "Role-discriminated chat message accepted by OpenAI-compatible chat completion endpoints.",
  }),
  S.toTaggedUnion("role"),
  SchemaUtils.withCodecStatics
);

/**
 * Chat message accepted by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Typing a user chat message)
 *
 * ```ts
 * import type { OpenAiCompatChatMessage } from "@beep/openai-compat"
 *
 * const message: OpenAiCompatChatMessage = {
 *   content: "Hello",
 *   role: "user"
 * }
 *
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatChatMessage = typeof OpenAiCompatChatMessage.Type;

/**
 * JSON schema response-format details for chat completion requests.
 *
 * **Example** (Making a JSON schema definition)
 *
 * ```ts
 * import { OpenAiCompatJsonSchemaDefinition } from "@beep/openai-compat"
 *
 * const definition = OpenAiCompatJsonSchemaDefinition.make({
 *   name: "Answer",
 *   schema: { type: "object" },
 *   strict: true
 * })
 *
 * console.log(definition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatJsonSchemaDefinition extends S.Class<OpenAiCompatJsonSchemaDefinition>(
  $I`OpenAiCompatJsonSchemaDefinition`
)(
  {
    description: S.optionalKey(S.String).annotateKey({
      description: "Optional description of the structured response schema.",
    }),
    name: S.String.annotateKey({ description: "Structured response schema name." }),
    schema: S.Record(S.String, S.Unknown).annotateKey({
      description: "JSON Schema object used for structured provider output.",
    }),
    strict: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether the provider should strictly enforce the structured output schema.",
    }),
  },
  $I.annote("OpenAiCompatJsonSchemaDefinition", {
    description: "JSON schema response-format details for chat completion requests.",
  })
) {}

/**
 * Structured response format configuration for chat completion requests.
 *
 * **Example** (Making a JSON schema format)
 *
 * ```ts
 * import { OpenAiCompatJsonSchemaResponseFormat } from "@beep/openai-compat"
 *
 * const format = OpenAiCompatJsonSchemaResponseFormat.make({
 *   json_schema: { name: "Answer", schema: { type: "object" }, strict: true },
 *   type: "json_schema"
 * })
 *
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatJsonSchemaResponseFormat extends S.Class<OpenAiCompatJsonSchemaResponseFormat>(
  $I`OpenAiCompatJsonSchemaResponseFormat`
)(
  {
    json_schema: OpenAiCompatJsonSchemaDefinition.annotateKey({
      description: "JSON Schema response-format payload.",
    }),
    type: S.tag("json_schema").annotateKey({ description: "JSON Schema response-format discriminator." }),
  },
  $I.annote("OpenAiCompatJsonSchemaResponseFormat", {
    description: "Structured response format configuration for chat completion requests.",
  })
) {}

/**
 * Response format discriminator accepted by OpenAI-compatible chat completion requests.
 *
 * **Example** (Checking a json_schema kind)
 *
 * ```ts
 * import { OpenAiCompatResponseFormatKind } from "@beep/openai-compat"
 *
 * const isJsonSchema = OpenAiCompatResponseFormatKind.is.json_schema("json_schema")
 *
 * console.log(isJsonSchema)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpenAiCompatResponseFormatKind = LiteralKit(["text", "json_object", "json_schema"]).pipe(
  $I.annoteSchema("OpenAiCompatResponseFormatKind", {
    description: "Response format discriminator accepted by OpenAI-compatible chat completion requests.",
  })
);

/**
 * Type for {@link OpenAiCompatResponseFormatKind}.
 *
 * **Example** (Typing a json_object kind)
 *
 * ```ts
 * import type { OpenAiCompatResponseFormatKind } from "@beep/openai-compat"
 *
 * const kind: OpenAiCompatResponseFormatKind = "json_object"
 *
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatResponseFormatKind = typeof OpenAiCompatResponseFormatKind.Type;

/**
 * Text response format configuration.
 *
 * **Example** (Making a text response format)
 *
 * ```ts
 * import { OpenAiCompatTextResponseFormat } from "@beep/openai-compat"
 *
 * const format = OpenAiCompatTextResponseFormat.make({ type: "text" })
 *
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatTextResponseFormat extends S.Class<OpenAiCompatTextResponseFormat>(
  $I`OpenAiCompatTextResponseFormat`
)(
  {
    type: S.tag("text").annotateKey({ description: "Text response-format discriminator." }),
  },
  $I.annote("OpenAiCompatTextResponseFormat", {
    description: "Text response format configuration.",
  })
) {}

/**
 * JSON object response format configuration.
 *
 * **Example** (Making a JSON object format)
 *
 * ```ts
 * import { OpenAiCompatJsonObjectResponseFormat } from "@beep/openai-compat"
 *
 * const format = OpenAiCompatJsonObjectResponseFormat.make({ type: "json_object" })
 *
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatJsonObjectResponseFormat extends S.Class<OpenAiCompatJsonObjectResponseFormat>(
  $I`OpenAiCompatJsonObjectResponseFormat`
)(
  {
    type: S.tag("json_object").annotateKey({ description: "JSON object response-format discriminator." }),
  },
  $I.annote("OpenAiCompatJsonObjectResponseFormat", {
    description: "JSON object response format configuration.",
  })
) {}

/**
 * Response format configuration accepted by OpenAI-compatible chat completion requests.
 *
 * **Example** (Typing a JSON object format)
 *
 * ```ts
 * import type { OpenAiCompatResponseFormat } from "@beep/openai-compat"
 *
 * const format: OpenAiCompatResponseFormat = { type: "json_object" }
 *
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpenAiCompatResponseFormat = OpenAiCompatResponseFormatKind.mapMembers(
  Tuple.evolve([
    () => OpenAiCompatTextResponseFormat,
    () => OpenAiCompatJsonObjectResponseFormat,
    () => OpenAiCompatJsonSchemaResponseFormat,
  ])
).pipe(
  $I.annoteSchema("OpenAiCompatResponseFormat", {
    description: "Response format configuration accepted by OpenAI-compatible chat completion requests.",
  }),
  S.toTaggedUnion("type"),
  SchemaUtils.withCodecStatics
);

/**
 * Response format configuration accepted by OpenAI-compatible chat completion requests.
 *
 * **Example** (Typing a text response format)
 *
 * ```ts
 * import type { OpenAiCompatResponseFormat } from "@beep/openai-compat"
 *
 * const format: OpenAiCompatResponseFormat = { type: "text" }
 *
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpenAiCompatResponseFormat = typeof OpenAiCompatResponseFormat.Type;

/**
 * Chat completion request sent to OpenAI-compatible providers.
 *
 * **Example** (Making a chat completion request)
 *
 * ```ts
 * import { OpenAiCompatChatCompletionRequest, OpenAiCompatUserChatMessage } from "@beep/openai-compat"
 *
 * const request = OpenAiCompatChatCompletionRequest.make({
 *   messages: [OpenAiCompatUserChatMessage.make({ content: "Hello", role: "user" })],
 *   model: "gpt-compatible"
 * })
 *
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatChatCompletionRequest extends S.Class<OpenAiCompatChatCompletionRequest>(
  $I`OpenAiCompatChatCompletionRequest`
)(
  {
    frequency_penalty: OpenAiCompatPenalty.pipe(S.optionalKey).annotateKey({
      description: "Penalty applied to repeated tokens, from -2 through 2.",
    }),
    max_completion_tokens: PosInt.pipe(S.optionalKey).annotateKey({
      description: "Positive maximum number of completion tokens.",
    }),
    max_tokens: PosInt.pipe(S.optionalKey).annotateKey({
      description: "Positive maximum number of tokens accepted by legacy providers.",
    }),
    messages: S.NonEmptyArray(OpenAiCompatChatMessage).annotateKey({
      description: "Non-empty chat message list sent to the provider.",
    }),
    model: S.NonEmptyString.annotateKey({ description: "Provider model identifier." }),
    parallel_tool_calls: S.Boolean.pipe(S.optionalKey).annotateKey({
      description: "Whether provider-side parallel tool calls are allowed.",
    }),
    presence_penalty: OpenAiCompatPenalty.pipe(S.optionalKey).annotateKey({
      description: "Penalty applied to already-present tokens, from -2 through 2.",
    }),
    response_format: S.optionalKey(OpenAiCompatResponseFormat).annotateKey({
      description: "Optional response-format controls for provider output.",
    }),
    seed: S.optionalKey(NonNegativeInt).annotateKey({
      description: "Non-negative deterministic sampling seed.",
    }),
    stream: S.Boolean.pipe(S.optionalKey).annotateKey({
      description: "Whether the request asks the provider for a stream.",
    }),
    stream_options: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({
      description: "Provider stream options forwarded with streaming requests.",
    }),
    temperature: OpenAiCompatTemperature.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Sampling temperature or null when explicitly forwarded to the provider.",
    }),
    tool_choice: S.optionalKey(S.Unknown).annotateKey({
      description: "Provider-specific tool-choice directive.",
    }),
    tools: OpenAiCompatFunctionTool.pipe(S.Array, S.optionalKey).annotateKey({
      description: "Function tools made available to the provider.",
    }),
    top_p: UnitInterval.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Nucleus sampling value or null when explicitly forwarded to the provider.",
    }),
    user: S.optionalKey(S.String).annotateKey({ description: "Optional provider-visible end-user identifier." }),
  },
  $I.annote("OpenAiCompatChatCompletionRequest", {
    description: "Chat completion request sent to OpenAI-compatible providers.",
  })
) {}

/**
 * Assistant message returned by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making an assistant message)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { OpenAiCompatAssistantMessage } from "@beep/openai-compat"
 *
 * const message = OpenAiCompatAssistantMessage.make({
 *   content: O.some("Done"),
 *   role: "assistant"
 * })
 *
 * console.log(message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatAssistantMessage extends S.Class<OpenAiCompatAssistantMessage>(
  $I`OpenAiCompatAssistantMessage`
)(
  {
    content: OptionalNullableString.annotateKey({
      description: "Assistant message content returned by the provider.",
    }),
    role: S.optionalKey(S.Literal("assistant")).annotateKey({
      description: "Optional assistant role marker returned by the provider.",
    }),
    tool_calls: OpenAiCompatToolCall.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Tool calls returned with the assistant message.",
    }),
  },
  $I.annote("OpenAiCompatAssistantMessage", {
    description: "Assistant message returned by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Delta message returned by OpenAI-compatible chat completion streams.
 *
 * **Example** (Making an assistant delta)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { OpenAiCompatAssistantDelta } from "@beep/openai-compat"
 *
 * const delta = OpenAiCompatAssistantDelta.make({
 *   content: O.some("Hi "),
 *   role: "assistant"
 * })
 *
 * console.log(delta)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatAssistantDelta extends S.Class<OpenAiCompatAssistantDelta>($I`OpenAiCompatAssistantDelta`)(
  {
    content: OptionalNullableString.annotateKey({
      description: "Incremental assistant content returned by a stream chunk.",
    }),
    role: S.optionalKey(S.Literal("assistant")).annotateKey({
      description: "Optional assistant role marker returned by the stream.",
    }),
    tool_calls: OpenAiCompatToolCallDelta.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    ).annotateKey({ description: "Incremental tool-call deltas returned by the stream." }),
  },
  $I.annote("OpenAiCompatAssistantDelta", {
    description: "Delta message returned by OpenAI-compatible chat completion streams.",
  })
) {}

/**
 * Token usage returned by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a usage payload)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import { OpenAiCompatUsage } from "@beep/openai-compat"
 *
 * const usage = OpenAiCompatUsage.make({
 *   completion_tokens: O.some(NonNegativeInt.make(2)),
 *   prompt_tokens: O.some(NonNegativeInt.make(1)),
 *   total_tokens: O.some(NonNegativeInt.make(3))
 * })
 *
 * console.log(usage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatUsage extends S.Class<OpenAiCompatUsage>($I`OpenAiCompatUsage`)(
  {
    completion_tokens: OptionalNonNegativeInt.annotateKey({
      description: "Non-negative number of completion tokens reported by the provider.",
    }),
    prompt_tokens: OptionalNonNegativeInt.annotateKey({
      description: "Non-negative number of prompt tokens reported by the provider.",
    }),
    prompt_tokens_details: OptionalUnknownRecord.annotateKey({
      description: "Provider-specific prompt token detail payload.",
    }),
    total_tokens: OptionalNonNegativeInt.annotateKey({
      description: "Non-negative total token count reported by the provider.",
    }),
  },
  $I.annote("OpenAiCompatUsage", {
    description: "Token usage returned by OpenAI-compatible chat completion endpoints.",
  })
) {}

/**
 * Chat completion choice returned by OpenAI-compatible endpoints.
 *
 * **Example** (Making a completion choice)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import { OpenAiCompatAssistantMessage, OpenAiCompatChatCompletionChoice } from "@beep/openai-compat"
 *
 * const choice = OpenAiCompatChatCompletionChoice.make({
 *   finish_reason: O.some("stop"),
 *   index: NonNegativeInt.make(0),
 *   message: O.some(OpenAiCompatAssistantMessage.make({ content: O.some("Hello"), role: "assistant" }))
 * })
 *
 * console.log(choice)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatChatCompletionChoice extends S.Class<OpenAiCompatChatCompletionChoice>(
  $I`OpenAiCompatChatCompletionChoice`
)(
  {
    finish_reason: OptionalNullableString.annotateKey({
      description: "Provider finish reason for this chat completion choice.",
    }),
    index: S.optionalKey(NonNegativeInt).annotateKey({
      description: "Zero-based chat completion choice index.",
    }),
    message: S.OptionFromOptionalKey(OpenAiCompatAssistantMessage)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Assistant message payload for this choice." }),
  },
  $I.annote("OpenAiCompatChatCompletionChoice", {
    description: "Chat completion choice returned by OpenAI-compatible endpoints.",
  })
) {}

/**
 * Chat completion response returned by OpenAI-compatible endpoints.
 *
 * **Example** (Making a completion response)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import {
 *   OpenAiCompatAssistantMessage,
 *   OpenAiCompatChatCompletionChoice,
 *   OpenAiCompatChatCompletionResponse
 * } from "@beep/openai-compat"
 *
 * const response = OpenAiCompatChatCompletionResponse.make({
 *   choices: [
 *     OpenAiCompatChatCompletionChoice.make({
 *       finish_reason: O.some("stop"),
 *       index: NonNegativeInt.make(0),
 *       message: O.some(OpenAiCompatAssistantMessage.make({ content: O.some("Hello") }))
 *     })
 *   ]
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatChatCompletionResponse extends S.Class<OpenAiCompatChatCompletionResponse>(
  $I`OpenAiCompatChatCompletionResponse`
)(
  {
    choices: S.Array(OpenAiCompatChatCompletionChoice).annotateKey({
      description: "Chat completion choices returned by the provider.",
    }),
    id: S.optionalKey(S.String).annotateKey({ description: "Provider response identifier." }),
    model: S.optionalKey(S.String).annotateKey({ description: "Provider model identifier for the response." }),
    usage: S.OptionFromOptionalKey(OpenAiCompatUsage)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Optional token usage returned by the provider." }),
  },
  $I.annote("OpenAiCompatChatCompletionResponse", {
    description: "Chat completion response returned by OpenAI-compatible endpoints.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(OpenAiCompatChatCompletionResponse);
}

/**
 * Stream chunk choice returned by OpenAI-compatible endpoints.
 *
 * **Example** (Making a stream chunk choice)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import { OpenAiCompatAssistantDelta, OpenAiCompatChatCompletionChunkChoice } from "@beep/openai-compat"
 *
 * const choice = OpenAiCompatChatCompletionChunkChoice.make({
 *   delta: O.some(OpenAiCompatAssistantDelta.make({ content: O.some("Hi ") })),
 *   index: NonNegativeInt.make(0)
 * })
 *
 * console.log(choice)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatChatCompletionChunkChoice extends S.Class<OpenAiCompatChatCompletionChunkChoice>(
  $I`OpenAiCompatChatCompletionChunkChoice`
)(
  {
    delta: S.OptionFromOptionalKey(OpenAiCompatAssistantDelta)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Assistant delta payload for this stream choice." }),
    finish_reason: OptionalNullableString.annotateKey({
      description: "Provider finish reason carried by this stream choice.",
    }),
    index: S.optionalKey(NonNegativeInt).annotateKey({
      description: "Zero-based stream choice index.",
    }),
  },
  $I.annote("OpenAiCompatChatCompletionChunkChoice", {
    description: "Stream chunk choice returned by OpenAI-compatible endpoints.",
  })
) {}

/**
 * Stream chunk returned by OpenAI-compatible chat completion endpoints.
 *
 * **Example** (Making a stream chunk)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import {
 *   OpenAiCompatAssistantDelta,
 *   OpenAiCompatChatCompletionChunk,
 *   OpenAiCompatChatCompletionChunkChoice
 * } from "@beep/openai-compat"
 *
 * const chunk = OpenAiCompatChatCompletionChunk.make({
 *   choices: [
 *     OpenAiCompatChatCompletionChunkChoice.make({
 *       delta: O.some(OpenAiCompatAssistantDelta.make({ content: O.some("Hi ") })),
 *       index: NonNegativeInt.make(0)
 *     })
 *   ]
 * })
 *
 * console.log(chunk)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiCompatChatCompletionChunk extends S.Class<OpenAiCompatChatCompletionChunk>(
  $I`OpenAiCompatChatCompletionChunk`
)(
  {
    choices: S.Array(OpenAiCompatChatCompletionChunkChoice).annotateKey({
      description: "Streaming chat completion choices returned by the provider.",
    }),
    id: S.optionalKey(S.String).annotateKey({ description: "Provider stream chunk identifier." }),
    model: S.optionalKey(S.String).annotateKey({ description: "Provider model identifier for the chunk." }),
    usage: S.OptionFromOptionalKey(OpenAiCompatUsage)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Optional token usage returned by a stream chunk." }),
  },
  $I.annote("OpenAiCompatChatCompletionChunk", {
    description: "Stream chunk returned by OpenAI-compatible chat completion endpoints.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(OpenAiCompatChatCompletionChunk);
}

/**
 * Decodes an unknown value into an OpenAI-compatible chat completion response.
 *
 * **Example** (Decoding a completion response)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeChatCompletionResponse } from "@beep/openai-compat"
 *
 * const decoded = Effect.runSync(decodeChatCompletionResponse({ choices: [] }))
 *
 * console.log(decoded)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeChatCompletionResponse = OpenAiCompatChatCompletionResponse.decodeUnknownEffect;

/**
 * Decodes an unknown value into an OpenAI-compatible chat completion stream chunk.
 *
 * **Example** (Decoding a stream chunk)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeChatCompletionChunk } from "@beep/openai-compat"
 *
 * const decoded = Effect.runSync(decodeChatCompletionChunk({ choices: [] }))
 *
 * console.log(decoded)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeChatCompletionChunk = OpenAiCompatChatCompletionChunk.decodeUnknownEffect;
