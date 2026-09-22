/**
 * The `api_key_required` envelope and its protocol translation.
 *
 * A typed `failureMode: "return"` tool failure for `soft`-gated (or
 * key-optional `none`-gated) sources whose credential is absent at call
 * time. `effect/unstable/ai`'s `Toolkit` folds `"return"`-mode failures into
 * the handler's result stream as declared failures; rc.117
 * `McpServer.registerToolkit` projects every declared failure as
 * `CallToolResult({ isError: true })`. The kit's `sanitizedToolkit` instead
 * routes this one envelope through {@link translateApiKeyRequired}, the named
 * error translator at the kit protocol adapter (architecture 09): the
 * envelope stays a **non-error** `CallToolResult` with the encoded failure in
 * `structuredContent` and mirrored into `content[].text`, so the calling
 * model sees the structured `api_key_required` reason and self-corrects
 * instead of treating the call as a hard failure. Every other failure keeps
 * upstream semantics (declared failures are tool errors, invalid arguments
 * are JSON-RPC `InvalidParams`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { CallToolResult } from "effect/unstable/ai/McpSchema";
import { SourceAuthRegistration } from "./SourceAuth.ts";

const $I = $McpKitId.create("ApiKeyRequired");

class ApiKeyRequiredFailureParams extends S.Class<ApiKeyRequiredFailureParams>($I`ApiKeyRequiredFailureParams`)(
  {
    tool: S.String.annotateKey({
      description: "Name of the tool that could not resolve its credential.",
    }),
    registration: SourceAuthRegistration.annotateKey({
      description: "Source registration whose credential is required by the tool.",
    }),
  },
  $I.annote("ApiKeyRequiredFailureParams", {
    description: "Input payload for building an api_key_required tool failure.",
  })
) {}

type ApiKeyRequiredFailureParamsInput = Exclude<(typeof ApiKeyRequiredFailureParams)["~type.make.in"], void>;

/**
 * Typed tool failure returned when a `soft`-gated (or key-optional) source's
 * credential is absent at call time. Intended for use as a `Tool.make`
 * `failure` schema with `failureMode: "return"`.
 *
 * **Example** (Creating typed tool failure)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ApiKeyRequiredFailure, SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const failure = ApiKeyRequiredFailure.make({
 *   tool: "search_patents",
 *   envVar: "USPTO_API_KEY",
 *   registration: SourceAuthRegistration.make({
 *     name: "USPTO Open Data Portal",
 *     envVar: "USPTO_API_KEY",
 *     gate: "soft"
 *   })
 * })
 * console.log(failure.error)
 * // "api_key_required"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiKeyRequiredFailure extends S.Class<ApiKeyRequiredFailure>($I`ApiKeyRequiredFailure`)(
  {
    error: S.tag("api_key_required"),
    tool: S.NonEmptyString.annotateKey({
      description: "Name of the tool that could not resolve its credential.",
    }),
    envVar: S.NonEmptyString.annotateKey({
      description: "Environment variable the caller must populate to unlock this tool.",
    }),
    registration: SourceAuthRegistration.annotateKey({
      description: "Full source registration, including any signup URL.",
    }),
  },
  $I.annote("ApiKeyRequiredFailure", {
    description: "Typed api_key_required tool failure for a source whose credential is absent at call time.",
  })
) {
  static readonly forTool = (params: ApiKeyRequiredFailureParamsInput): ApiKeyRequiredFailure =>
    ApiKeyRequiredFailure.make({
      tool: params.tool,
      envVar: params.registration.envVar,
      registration: params.registration,
    });
}

/**
 * Builds an {@link ApiKeyRequiredFailure} for the given tool and source
 * registration.
 *
 * **When to use**
 *
 * Use inside a `soft`/`none`-gated tool's handler, guarded by
 * `Effect.fail(apiKeyRequiredFailure({ tool, registration }))` when the
 * resolved credential is absent, with the tool declared
 * `failureMode: "return"`.
 *
 * **Example** (Building failure from registration)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { apiKeyRequiredFailure, SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const registration = SourceAuthRegistration.make({
 *   name: "USPTO Open Data Portal",
 *   envVar: "USPTO_API_KEY",
 *   gate: "soft"
 * })
 *
 * const failure = apiKeyRequiredFailure({ tool: "search_patents", registration })
 * console.log(failure.envVar)
 * // "USPTO_API_KEY"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const apiKeyRequiredFailure = (params: ApiKeyRequiredFailureParamsInput): ApiKeyRequiredFailure =>
  ApiKeyRequiredFailure.forTool(params);

/**
 * Guard for the `api_key_required` envelope.
 *
 * **Example** (Recognize the envelope)
 *
 * ```ts
 * import { isApiKeyRequiredFailure } from "@beep/mcp-kit/ApiKeyRequired"
 *
 * console.log(isApiKeyRequiredFailure({ error: "other" }))
 * // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isApiKeyRequiredFailure = S.is(ApiKeyRequiredFailure);

/**
 * The pair a `Toolkit` handler result carries for a declared failure: the
 * decoded failure value and its JSON encoding. This is the input of
 * {@link translateApiKeyRequired}.
 *
 * **Example** (Build a payload)
 *
 * ```ts
 * import { ToolHandlerPayload } from "@beep/mcp-kit/ApiKeyRequired"
 *
 * const payload = ToolHandlerPayload.make({ result: { error: "other" }, encodedResult: { error: "other" } })
 * console.log(payload.encodedResult)
 * // { error: "other" }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolHandlerPayload extends S.Class<ToolHandlerPayload>($I`ToolHandlerPayload`)(
  {
    result: S.Unknown.annotateKey({ description: "Decoded handler result or declared failure value." }),
    encodedResult: S.Unknown.annotateKey({ description: "JSON encoding of `result`, as the Toolkit produced it." }),
  },
  $I.annote("ToolHandlerPayload", {
    description: "Decoded result and its JSON encoding, as carried by a Toolkit handler result.",
  })
) {}

/**
 * Named error translator at the kit protocol adapter: turns a declared
 * `api_key_required` handler failure into a non-error `CallToolResult`
 * carrying the encoded envelope, and declines every other result.
 *
 * **Details**
 *
 * Takes the decoded failure and its JSON encoding (the pair the `Toolkit`
 * result stream already carries), so no re-encoding happens at the protocol
 * boundary. `None` means "not this envelope": the caller falls through to
 * upstream projection, where declared failures are tool errors and invalid
 * arguments are `InvalidParams`.
 *
 * **Example** (Translate a declared failure)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { apiKeyRequiredFailure, ToolHandlerPayload, translateApiKeyRequired } from "@beep/mcp-kit/ApiKeyRequired"
 * import { SourceAuthRegistration } from "@beep/mcp-kit/SourceAuth"
 *
 * const registration = SourceAuthRegistration.make({ name: "Example", envVar: "EXAMPLE_KEY", gate: "soft" })
 * const failure = apiKeyRequiredFailure({ tool: "example_tool", registration })
 * const translated = translateApiKeyRequired(
 *   ToolHandlerPayload.make({ result: failure, encodedResult: { error: "api_key_required" } })
 * )
 * console.log(O.isSome(translated) && translated.value.isError)
 * // false
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export const translateApiKeyRequired = (payload: ToolHandlerPayload): O.Option<CallToolResult> =>
  isApiKeyRequiredFailure(payload.result)
    ? O.some(
        CallToolResult.make({
          isError: false,
          ...(P.isObject(payload.encodedResult) ? { structuredContent: payload.encodedResult } : {}),
          content: [{ type: "text", text: JSON.stringify(payload.encodedResult) }],
        })
      )
    : O.none();
