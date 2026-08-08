/**
 * The `api_key_required` envelope.
 *
 * A typed `failureMode: "return"` tool failure for `soft`-gated (or
 * key-optional `none`-gated) sources whose credential is absent at call
 * time. `effect/unstable/ai`'s `Toolkit`/`McpServer` machinery folds
 * `"return"`-mode failures into the tool's success union (verified
 * `Toolkit.ts:240-242`), so `McpServer.registerToolkit` ships this failure as
 * `CallToolResult({ isError: false, ... })` — never a protocol-level error —
 * with the encoded failure JSON mirrored into `content[].text` (verified
 * `McpServer.ts:717-734`). This lets the calling model see the structured
 * `api_key_required` reason and self-correct instead of treating the call as
 * a hard failure.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import * as S from "effect/Schema";
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
