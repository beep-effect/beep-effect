/**
 * Experimental effect/Schema models for Box Node SDK payloads.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { HttpMethod } from "@beep/schema/HttpMethod";
import { HttpStatus } from "@beep/schema/HttpStatus";
import * as Box from "box-node-sdk/box";
import * as BoxSchemas from "box-node-sdk/schemas";
import * as S from "effect/Schema";
import { SerializedData } from "./domain/values/SerializedData/SerializedData.model.ts";

const $I = $BoxId.create("experimental/Box.schemas");

/**
 * Schema class describing an outgoing Box API request: method, URL, query params, headers, and body.
 *
 * **Example** (Create RequestInfo with make)
 *
 * ```ts
 * import * as BoxSchemas from "@beep/box/experimental/Box.schemas"
 *
 * const request = BoxSchemas.RequestInfo.make({
 *   method: "GET",
 *   url: new URL("https://api.box.com/2.0/users/me"),
 *   queryParams: {},
 *   headers: {}
 * })
 * console.log(request.url.href)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RequestInfo extends S.Class<RequestInfo>($I`RequestInfo`)(
  {
    contentType: S.optionalKey(S.String),
    method: HttpMethod,
    url: S.URLFromString,
    queryParams: S.Record(S.String, S.String),
    headers: S.Record(S.String, S.String),
    body: S.optionalKey(S.Any),
  },
  $I.annote("RequestInfo", {
    description: "A schema for request information used in the Box driver, encapsulating details about API requests.",
  })
) {}

/**
 * Schema class describing a Box API response: status code, headers, body, and error context fields.
 *
 * **Example** (Validate ResponseInfo with Schema)
 *
 * ```ts
 * import * as BoxSchemas from "@beep/box/experimental/Box.schemas"
 * import * as S from "effect/Schema"
 *
 * const isResponseInfo = S.is(BoxSchemas.ResponseInfo)
 * console.log(isResponseInfo({ statusCode: 0 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResponseInfo extends S.Class<ResponseInfo>($I`ResponseInfo`)(
  {
    statusCode: HttpStatus,
    headers: S.Record(S.String, S.String),
    body: S.optionalKey(SerializedData),
    rawBody: S.optionalKey(S.String),
    code: S.optionalKey(S.String),
    contextInfo: S.optionalKey(S.Record(S.String, S.Any)),
    requestId: S.optionalKey(S.String),
    helpUrl: S.optionalKey(S.String),
  },
  $I.annote("ResponseInfo", {
    description: "A schema for response information used in the Box driver, encapsulating details about API responses.",
  })
) {}

/**
 * Schema matching instances of the Box SDK's `BoxSdkError`.
 *
 * **Example** (Test BoxSdkError schema match)
 *
 * ```ts
 * import * as BoxSchemas from "@beep/box/experimental/Box.schemas"
 * import * as S from "effect/Schema"
 *
 * const isBoxSdkError = S.is(BoxSchemas.BoxSdkError)
 * console.log(isBoxSdkError(new Error("not a box error")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const BoxSdkError = S.instanceOf(Box.BoxSdkError).pipe(
  $I.annoteSchema("BoxSdkError", {
    description: "A schema for errors thrown by the Box SDK, encapsulating details about the error.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * {@inheritDoc BoxSdkError}
 * @category type-level
 * @since 0.0.0
 */
export type BoxSdkError = typeof BoxSdkError.Type;

/**
 * Schema matching instances of the Box SDK's `BoxApiError` returned by the Box API.
 *
 * **Example** (Test BoxApiError schema match)
 *
 * ```ts
 * import * as BoxSchemas from "@beep/box/experimental/Box.schemas"
 * import * as S from "effect/Schema"
 *
 * const isBoxApiError = S.is(BoxSchemas.BoxApiError)
 * console.log(isBoxApiError(new Error("not a box api error")))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const BoxApiError = S.instanceOf(Box.BoxApiError).pipe(
  $I.annoteSchema("BoxApiError", {
    description: "A schema for errors returned by the Box API, encapsulating details about the error.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * {@inheritDoc BoxApiError}
 * @category type-level
 * @since 0.0.0
 */
export type BoxApiError = typeof BoxApiError.Type;

/**
 * Schema matching instances of the Box SDK's `AiAgentAsk` AI-agent request configuration.
 *
 * **Example** (Validate AiAgentAsk instance)
 *
 * ```ts
 * import * as BoxSchemas from "@beep/box/experimental/Box.schemas"
 * import * as S from "effect/Schema"
 *
 * const isAiAgentAsk = S.is(BoxSchemas.AiAgentAsk)
 * console.log(isAiAgentAsk({ type: "ai_agent_ask" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiAgentAsk = S.instanceOf(BoxSchemas.AiAgentAsk).pipe(
  $I.annoteSchema("AiAgentAsk", {
    description: "A schema for requests to AI agents, encapsulating details about the request.",
  }),
  SchemaUtils.withCodecStatics
);
