/**
 * Product-neutral Venice AI API driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $VeniceAiId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { HttpStatus } from "@beep/schema/HttpStatus";
import { decodeJsonString } from "@beep/schema/Json";
import { NonNegativeInt } from "@beep/schema/Number";
import { URLStr } from "@beep/schema/URL";
import { A, O, Str } from "@beep/utils";
import { Config, Context, Effect, flow, Layer, pipe, Result, SchemaGetter, Stream } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import type { Redacted } from "effect";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

const $I = $VeniceAiId.create("VeniceAI.service");

/**
 * Venice API base URL used by the live layer.
 *
 * **Example** (Log Venice API URL)
 *
 * ```ts
 * import { VENICE_API_URL } from "@beep/venice-ai"
 *
 * console.log(VENICE_API_URL)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const VENICE_API_URL = "https://api.venice.ai/api/v1";

/**
 * Default Venice text model used by the compatibility chat service.
 *
 * **Example** (Log default chat model)
 *
 * ```ts
 * import { VENICE_CHAT_MODEL } from "@beep/venice-ai"
 *
 * console.log(VENICE_CHAT_MODEL)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const VENICE_CHAT_MODEL = "venice-uncensored-1-2";

const normalizeBaseUrl = Str.replace(/\/+$/, "");
const makeVeniceAIBaseUrl = flow(normalizeBaseUrl, URLStr.make);
const defaultVeniceAIBaseUrl = makeVeniceAIBaseUrl(VENICE_API_URL);
const VeniceAIHttpStatusArbitraryValues = R.values(HttpStatus.From.Enum) as [HttpStatus, ...Array<HttpStatus>];
const isVeniceAIHttpStatus = (status: number): status is HttpStatus =>
  pipe(VeniceAIHttpStatusArbitraryValues as ReadonlyArray<number>, A.contains(status));
const makeHttpStatus: (status: number) => HttpStatus = flow(
  O.liftPredicate(isVeniceAIHttpStatus),
  O.getOrElse(() => HttpStatus.From.Enum.InternalServerError)
);
const VeniceAIHttpStatus = S.Literals(VeniceAIHttpStatusArbitraryValues).pipe(
  $I.annoteSchema("VeniceAIHttpStatus", {
    description: "Numeric HTTP status code accepted by the Venice AI driver.",
  })
);

const VeniceAIBaseUrl = URLStr.pipe(
  S.decode({
    decode: SchemaGetter.transform(makeVeniceAIBaseUrl),
    encode: SchemaGetter.transform(makeVeniceAIBaseUrl),
  })
)
  // The Type domain admits only normalization fixed points so schema-derived
  // arbitraries generate values the codec round-trips byte-identically.
  .check(
    S.makeFilter((value: string) => Str.Equivalence(value, normalizeBaseUrl(value)), {
      identifier: $I.make("VeniceAIBaseUrlNormalizedCheck"),
      title: "VeniceAIBaseUrl Normalized",
      description: "A Venice AI base URL already stripped of trailing slash separators.",
      message: "Base URL must not end with trailing slash separators.",
    })
  )
  .pipe(
    $I.annoteSchema("VeniceAIBaseUrl", {
      description: "Normalized Venice AI API base URL without trailing slash separators.",
    })
  );

/**
 * Supported HTTP methods in the checked-in Venice OpenAPI document.
 *
 * **Example** (Assign GET method)
 *
 * ```ts
 * import type { VeniceAIHttpMethod } from "@beep/venice-ai"
 *
 * const method: VeniceAIHttpMethod = "GET"
 * console.log(method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VeniceAIHttpMethod = LiteralKit(["DELETE", "GET", "PATCH", "POST"]).pipe(
  $I.annoteSchema("VeniceAIHttpMethod", {
    description: "Supported HTTP methods in the Venice AI OpenAPI document.",
  })
);

/**
 * Type for {@link VeniceAIHttpMethod}.
 *
 * **Example** (Assign POST method)
 *
 * ```ts
 * import type { VeniceAIHttpMethod } from "@beep/venice-ai"
 *
 * const method: VeniceAIHttpMethod = "POST"
 * console.log(method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VeniceAIHttpMethod = typeof VeniceAIHttpMethod.Type;

/**
 * Public operation identifiers from `packages/drivers/venice-ai/swagger.yaml`.
 *
 * **Example** (Assign listModels operation)
 *
 * ```ts
 * import type { VeniceAIOperationId } from "@beep/venice-ai"
 *
 * const operation: VeniceAIOperationId = "listModels"
 * console.log(operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VeniceAIOperationId = LiteralKit([
  "backgroundRemoveImage",
  "completeAudio",
  "completeVideo",
  "createApiKey",
  "createChatCompletion",
  "createClonedVoice",
  "createEmbedding",
  "createResponse",
  "createSpeech",
  "createTextParser",
  "createTranscription",
  "createVideoTranscription",
  "cryptoRpcProxy",
  "deleteApiKey",
  "editImage",
  "generateImage",
  "getApiKeyById",
  "getApiKeyGenerateWeb3Key",
  "getApiKeyRateLimitLogs",
  "getApiKeyRateLimits",
  "getApiKeys",
  "getBillingBalance",
  "getBillingUsage",
  "getBillingUsageAnalytics",
  "getCharacterBySlug",
  "getCharacterReviews",
  "getX402Balance",
  "getX402Transactions",
  "listCharacters",
  "listCryptoRpcNetworks",
  "listImageStyles",
  "listModelCompatibilityMapping",
  "listModelTraits",
  "listModels",
  "multiEditImage",
  "postApiKeyGenerateWeb3Key",
  "queueAudio",
  "queueVideo",
  "quoteAudio",
  "quoteVideo",
  "retrieveAudio",
  "retrieveVideo",
  "simpleGenerateImage",
  "topUpX402Balance",
  "upscaleImage",
  "updateApiKey",
  "webScrape",
  "webSearch",
]).pipe(
  $I.annoteSchema("VeniceAIOperationId", {
    description: "Operation identifiers exposed by the Venice AI driver.",
  })
);

/**
 * Type for {@link VeniceAIOperationId}.
 *
 * **Example** (Assign createChatCompletion)
 *
 * ```ts
 * import type { VeniceAIOperationId } from "@beep/venice-ai"
 *
 * const operation: VeniceAIOperationId = "createChatCompletion"
 * console.log(operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VeniceAIOperationId = typeof VeniceAIOperationId.Type;

/**
 * Technical error reasons emitted by the Venice AI driver.
 *
 * **Example** (Assign response status reason)
 *
 * ```ts
 * import type { VeniceAIErrorReason } from "@beep/venice-ai"
 *
 * const reason: VeniceAIErrorReason = "response status"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VeniceAIErrorReason = LiteralKit([
  "config",
  "multipart encoding",
  "request encoding",
  "response decoding",
  "response status",
  "sse decoding",
  "transport",
]).pipe(
  $I.annoteSchema("VeniceAIErrorReason", {
    description: "Redacted technical error reasons emitted by the Venice AI driver.",
  })
);

/**
 * Type for {@link VeniceAIErrorReason}.
 *
 * **Example** (Assign transport reason)
 *
 * ```ts
 * import type { VeniceAIErrorReason } from "@beep/venice-ai"
 *
 * const reason: VeniceAIErrorReason = "transport"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type VeniceAIErrorReason = typeof VeniceAIErrorReason.Type;

/**
 * Query parameter value accepted by Venice request options.
 *
 * **Example** (Assign array query value)
 *
 * ```ts
 * import type { VeniceAIQueryValue } from "@beep/venice-ai"
 *
 * const value: VeniceAIQueryValue = ["image", "text"]
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VeniceAIQueryValue = S.Union([
  S.Array(S.Union([S.Boolean, S.Finite, S.String])),
  S.Boolean,
  S.Finite,
  S.String,
]).pipe(
  $I.annoteSchema("VeniceAIQueryValue", {
    description: "URL query value accepted by the Venice AI driver.",
  })
);

/**
 * Type for {@link VeniceAIQueryValue}.
 *
 * **Example** (Assign numeric query value)
 *
 * ```ts
 * import type { VeniceAIQueryValue } from "@beep/venice-ai"
 *
 * const query: VeniceAIQueryValue = 10
 * console.log(query)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VeniceAIQueryValue = typeof VeniceAIQueryValue.Type;

const VeniceAIEncodedQuery = S.Record(S.String, VeniceAIQueryValue).pipe(
  $I.annoteSchema("VeniceAIEncodedQuery", {
    description: "Encoded URL query record accepted by the Venice AI driver.",
  })
);

type VeniceAIEncodedQuery = typeof VeniceAIEncodedQuery.Type;

const VeniceAIFormData = S.FormData.annotate({
  toArbitrary: () => (fc) => fc.constant(null).map(() => new FormData()),
});

const VeniceAIUnknownPayload = S.Unknown.annotate({
  toArbitrary: () => (fc) =>
    fc.oneof(
      fc.boolean(),
      fc.constant(null),
      fc.integer(),
      fc.record({ ok: fc.boolean(), value: fc.string() }, { requiredKeys: [] }),
      fc.string()
    ),
});

const VeniceAIBytes = S.Uint8Array.annotate({
  toArbitrary: () => (fc) => fc.uint8Array({ maxLength: 16 }),
});

/**
 * Request options accepted by each Venice API operation method.
 *
 * **Details**
 *
 * `path` fills OpenAPI path parameters, `query` fills URL parameters, `body`
 * sends JSON, and `formData` sends multipart/form-data.
 *
 * **Example** (Make body and query options)
 *
 * ```ts
 * import { VeniceAIRequestOptions } from "@beep/venice-ai"
 * import * as O from "effect/Option"
 *
 * const request = VeniceAIRequestOptions.make({
 *   body: O.some({ model: "venice-uncensored-1-2" }),
 *   query: O.some({ limit: 10 })
 * })
 *
 * console.log(request)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAIRequestOptions extends S.Class<VeniceAIRequestOptions>($I`VeniceAIRequestOptions`)(
  {
    accept: S.optionalKey(S.String).annotateKey({
      description: "Explicit Accept header override; defaults from the operation descriptor when omitted.",
    }),
    body: S.OptionFromOptionalKey(VeniceAIUnknownPayload).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional JSON request body for operations that accept application/json." })
    ),
    formData: S.OptionFromOptionalKey(VeniceAIFormData).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional multipart body for operations that accept multipart/form-data." })
    ),
    headers: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Additional request headers merged after driver base headers." })
    ),
    path: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "OpenAPI path parameter values keyed by parameter name." })
    ),
    query: S.OptionFromOptionalKey(VeniceAIEncodedQuery).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "URL query parameters keyed by parameter name." })
    ),
  },
  $I.annote("VeniceAIRequestOptions", {
    description: "Request options accepted by every Venice API operation method.",
  })
) {}

/**
 * Runtime configuration accepted by {@link VeniceAI.makeLayer}.
 *
 * **Example** (Make config with API key)
 *
 * ```ts
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 * import { URLStr } from "@beep/schema/URL"
 * import { VeniceAIConfigInput } from "@beep/venice-ai"
 *
 * const config = VeniceAIConfigInput.make({
 *   apiKey: O.some(Redacted.make("test-key")),
 *   baseUrl: URLStr.make("https://api.venice.ai/api/v1")
 * })
 *
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAIConfigInput extends S.Class<VeniceAIConfigInput>($I`VeniceAIConfigInput`)(
  {
    apiKey: S.OptionFromOptionalKey(S.String.pipe(S.RedactedFromValue)).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional Venice API key; the live layer reads AI_VENICE_API_KEY when omitted." })
    ),
    baseUrl: VeniceAIBaseUrl.pipe(
      SchemaUtils.withKeyDefaults(defaultVeniceAIBaseUrl),
      S.annotateKey({ description: "Venice API base URL normalized without trailing slash separators." })
    ),
    headers: S.Record(S.String, S.String).pipe(
      SchemaUtils.withKeyDefaults(R.empty()),
      S.annotateKey({ description: "Base headers applied to every Venice API request." })
    ),
  },
  $I.annote("VeniceAIConfigInput", {
    description: "Runtime configuration accepted by the Venice AI driver layer.",
  })
) {}

/**
 * OpenAPI operation descriptor used by the service and coverage tests.
 *
 * **Example** (Log descriptor registry length)
 *
 * ```ts
 * import { VENICE_AI_OPERATION_DESCRIPTORS } from "@beep/venice-ai"
 *
 * console.log(VENICE_AI_OPERATION_DESCRIPTORS.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAIOperationDescriptor extends S.Class<VeniceAIOperationDescriptor>($I`VeniceAIOperationDescriptor`)(
  {
    authenticated: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Whether the operation sends bearer-token authentication.",
    }),
    method: VeniceAIHttpMethod.annotateKey({ description: "HTTP method used by the operation." }),
    operationId: VeniceAIOperationId.annotateKey({ description: "Stable Venice OpenAPI operation id." }),
    path: S.String.annotateKey({ description: "OpenAPI path template for the operation." }),
    requestContentTypes: S.Array(S.String).annotateKey({
      description: "Request content media types declared by the operation.",
    }),
    responseContentTypes: S.Array(S.String).annotateKey({
      description: "Response content media types declared by the operation.",
    }),
    tag: S.String.annotateKey({ description: "OpenAPI tag associated with the operation." }),
  },
  $I.annote("VeniceAIOperationDescriptor", {
    description: "OpenAPI operation descriptor used by the Venice AI service.",
  })
) {
  static readonly is = S.is(VeniceAIOperationDescriptor);
}

/**
 * JSON response returned by the Venice AI driver.
 *
 * **Example** (Make JSON success response)
 *
 * ```ts
 * import { VeniceAIJsonResponse } from "@beep/venice-ai"
 *
 * const response = VeniceAIJsonResponse.make({
 *   body: { ok: true },
 *   headers: {},
 *   status: 200
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAIJsonResponse extends S.TaggedClass<VeniceAIJsonResponse>($I`VeniceAIJsonResponse`)(
  "Json",
  {
    body: VeniceAIUnknownPayload.annotateKey({ description: "Decoded JSON response body." }),
    contentType: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Response Content-Type header when present." })
    ),
    headers: S.Record(S.String, S.String).annotateKey({ description: "Response headers keyed by header name." }),
    status: VeniceAIHttpStatus.annotateKey({ description: "HTTP response status code." }),
  },
  $I.annote("VeniceAIJsonResponse", {
    description: "JSON response returned by the Venice AI driver.",
  })
) {}

/**
 * Text response returned by the Venice AI driver.
 *
 * **Example** (Make text success response)
 *
 * ```ts
 * import { VeniceAITextResponse } from "@beep/venice-ai"
 * import * as O from "effect/Option"
 *
 * const response = VeniceAITextResponse.make({
 *   contentType: O.some("text/plain"),
 *   headers: {},
 *   status: 200,
 *   text: "ok"
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAITextResponse extends S.TaggedClass<VeniceAITextResponse>($I`VeniceAITextResponse`)(
  "Text",
  {
    contentType: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Response Content-Type header when present." })
    ),
    headers: S.Record(S.String, S.String).annotateKey({ description: "Response headers keyed by header name." }),
    status: VeniceAIHttpStatus.annotateKey({ description: "HTTP response status code." }),
    text: S.String.annotateKey({ description: "Decoded response text." }),
  },
  $I.annote("VeniceAITextResponse", {
    description: "Text response returned by the Venice AI driver.",
  })
) {}

/**
 * Binary response returned by the Venice AI driver.
 *
 * **Example** (Make binary image response)
 *
 * ```ts
 * import { VeniceAIBinaryResponse } from "@beep/venice-ai"
 * import * as O from "effect/Option"
 *
 * const response = VeniceAIBinaryResponse.make({
 *   bytes: new Uint8Array([1, 2, 3]),
 *   contentType: O.some("image/png"),
 *   headers: {},
 *   status: 200
 * })
 *
 * console.log(response)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAIBinaryResponse extends S.TaggedClass<VeniceAIBinaryResponse>($I`VeniceAIBinaryResponse`)(
  "Binary",
  {
    bytes: VeniceAIBytes.annotateKey({ description: "Decoded binary response bytes." }),
    contentType: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Response Content-Type header when present." })
    ),
    headers: S.Record(S.String, S.String).annotateKey({ description: "Response headers keyed by header name." }),
    status: VeniceAIHttpStatus.annotateKey({ description: "HTTP response status code." }),
  },
  $I.annote("VeniceAIBinaryResponse", {
    description: "Binary response returned by the Venice AI driver.",
  })
) {}

/**
 * Response union returned by non-streaming Venice API operation methods.
 *
 * **Example** (Read response tag)
 *
 * ```ts
 * import type { VeniceAIResponse } from "@beep/venice-ai"
 *
 * const tag = (response: VeniceAIResponse) => response._tag
 * console.log(tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VeniceAIResponse = S.Union([VeniceAIBinaryResponse, VeniceAIJsonResponse, VeniceAITextResponse]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("VeniceAIResponse", {
    description: "Response union returned by non-streaming Venice AI operation methods.",
  })
);

/**
 * Type for {@link VeniceAIResponse}.
 *
 * **Example** (Read response status)
 *
 * ```ts
 * import type { VeniceAIResponse } from "@beep/venice-ai"
 *
 * const getStatus = (response: VeniceAIResponse) => response.status
 * console.log(getStatus)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VeniceAIResponse = typeof VeniceAIResponse.Type;

/**
 * Parsed server-sent event emitted by Venice streaming endpoints.
 *
 * **Example** (Make streaming SSE event)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema/Number"
 * import { VeniceAIServerSentEvent } from "@beep/venice-ai"
 * import * as O from "effect/Option"
 *
 * const event = VeniceAIServerSentEvent.make({
 *   data: O.some({ delta: "hello" }),
 *   done: false,
 *   index: NonNegativeInt.make(0)
 * })
 *
 * console.log(event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VeniceAIServerSentEvent extends S.Class<VeniceAIServerSentEvent>($I`VeniceAIServerSentEvent`)(
  {
    data: S.OptionFromOptionalKey(VeniceAIUnknownPayload).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Decoded SSE payload when the event carries data." })
    ),
    done: S.Boolean.annotateKey({ description: "Whether this SSE event is the terminal [DONE] marker." }),
    index: NonNegativeInt.annotateKey({ description: "Zero-based stream event index." }),
  },
  $I.annote("VeniceAIServerSentEvent", {
    description: "Parsed server-sent event emitted by Venice streaming endpoints.",
  })
) {}

/**
 * Technical failure raised by the Venice AI driver boundary.
 *
 * **Example** (Make response status error)
 *
 * ```ts
 * import { HttpStatus } from "@beep/schema/HttpStatus"
 * import { VeniceAIError } from "@beep/venice-ai"
 * import * as O from "effect/Option"
 *
 * const error = VeniceAIError.make({
 *   method: O.some("GET"),
 *   operation: O.some("listModels"),
 *   path: O.some("/models"),
 *   reason: "response status",
 *   status: O.some(HttpStatus.make(500))
 * })
 *
 * console.log(error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VeniceAIError extends S.TaggedError<VeniceAIError>($I`VeniceAIError`)(
  "VeniceAIError",
  {
    cause: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Sanitized technical cause label when one was available." })
    ),
    method: S.OptionFromOptionalKey(VeniceAIHttpMethod).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "HTTP method associated with the failure when known." })
    ),
    operation: S.OptionFromOptionalKey(VeniceAIOperationId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Venice operation associated with the failure when known." })
    ),
    path: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Request path associated with the failure when known." })
    ),
    reason: VeniceAIErrorReason.annotateKey({ description: "Redacted technical failure reason." }),
    status: S.OptionFromOptionalKey(VeniceAIHttpStatus).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "HTTP response status code associated with the failure when known." })
    ),
  },
  $I.annoteError<VeniceAIError>("VeniceAIError", {
    description: "Redacted technical failure raised by the Venice AI driver boundary.",
  })
) {
  /**
   * Create a driver error scoped to an OpenAPI operation.
   *
   * **Example** (Error from operation descriptor)
   *
   * ```ts
   * import { VeniceAIError, VENICE_AI_OPERATION_DESCRIPTORS } from "@beep/venice-ai"
   *
   * const error = VeniceAIError.fromDescriptor(VENICE_AI_OPERATION_DESCRIPTORS[0], "transport")
   * console.log(error)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromDescriptor: {
    (
      descriptor: VeniceAIOperationDescriptor,
      reason: VeniceAIErrorReason,
      options?: VeniceAIErrorOptionsInput
    ): VeniceAIError;
    (
      reason: VeniceAIErrorReason,
      options?: VeniceAIErrorOptionsInput
    ): (descriptor: VeniceAIOperationDescriptor) => VeniceAIError;
  } = dual(
    (args) => args.length >= 2 && VeniceAIOperationDescriptor.is(args[0]),
    (
      descriptor: VeniceAIOperationDescriptor,
      reason: VeniceAIErrorReason,
      options: VeniceAIErrorOptionsInput = {}
    ): VeniceAIError => {
      const normalizedOptions = normalizeVeniceAIErrorOptions(options);

      return VeniceAIError.make({
        method: O.some(descriptor.method),
        operation: O.some(descriptor.operationId),
        path: O.some(descriptor.path),
        reason,
        cause: O.flatMap(normalizedOptions.cause, causeFromUnknown),
        status: normalizedOptions.status,
      });
    }
  );

  /**
   * Create a configuration error before a specific operation exists.
   *
   * **Example** (Create configuration error)
   *
   * ```ts
   * import { VeniceAIError } from "@beep/venice-ai"
   *
   * const error = VeniceAIError.config()
   * console.log(error.reason)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly config = (cause?: unknown): VeniceAIError =>
    VeniceAIError.make({
      reason: "config",
      cause: causeFromUnknown(cause),
    });
}

/**
 * Compatibility alias for older chat-wrapper consumers.
 *
 * **Example** (Create chat config error)
 *
 * ```ts
 * import { VeniceAiChatError } from "@beep/venice-ai"
 *
 * const error = VeniceAiChatError.config()
 * console.log(error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VeniceAiChatError = VeniceAIError;

/**
 * Type alias for the centralized Venice AI driver error.
 *
 * **Example** (Read chat error reason)
 *
 * ```ts
 * import type { VeniceAiChatError } from "@beep/venice-ai"
 *
 * const reason = (error: VeniceAiChatError) => error.reason
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type VeniceAiChatError = VeniceAIError;

type VeniceAIErrorOptionsInput = {
  readonly cause?: unknown;
  readonly status?: number;
};

class VeniceAIErrorOptions extends S.Class<VeniceAIErrorOptions>($I`VeniceAIErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(VeniceAIUnknownPayload).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Original native or third-party cause when one was available." })
    ),
    status: S.OptionFromOptionalKey(HttpStatus).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "HTTP response status code associated with the failure when one was available." })
    ),
  },
  $I.annote("VeniceAIErrorOptions", {
    description: "Normalized options for configuring VeniceAIError instances.",
  })
) {}

const normalizeVeniceAIErrorOptions = (options: VeniceAIErrorOptionsInput): VeniceAIErrorOptions =>
  VeniceAIErrorOptions.make({
    cause: O.fromUndefinedOr(options.cause),
    status: pipe(O.fromUndefinedOr(options.status), O.map(makeHttpStatus)),
  });

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- safe reflection keeps unknown API causes inside the Venice boundary
const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  if (!P.isObject(value)) {
    return O.none();
  }

  return O.fromUndefinedOr(
    Result.getOrElse(
      Result.try(() => Reflect.get(value, key)),
      () => undefined
    )
  );
};

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  // shared driver boundary idiom; no in-family home; future foundation capability candidate.
  // fallow-ignore-next-line code-duplication -- Venice property refinement mirrors peer drivers but stays provider-local
  O.filter(readProperty(value, key), P.isString);

const tryBoolean = (evaluate: () => boolean): Result.Result<boolean, unknown> => Result.try(evaluate);

const safeBoolean: (evaluate: () => boolean) => boolean = flow(
  tryBoolean,
  Result.getOrElse(() => false)
);

const httpClientCauseLabel = (cause: unknown): O.Option<string> =>
  safeBoolean(() => HttpClientError.isHttpClientError(cause))
    ? pipe(
        readProperty(cause, "reason"),
        O.flatMap((reason) => readString(reason, "_tag")),
        O.map((tag) => `HttpClientError:${tag}`)
      )
    : O.none();

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- Venice cause normalization preserves provider-specific HTTP labels
const causeFromUnknown = (cause: unknown): O.Option<string> =>
  P.isUndefined(cause)
    ? O.none()
    : O.firstSomeOf([
        httpClientCauseLabel(cause),
        readString(cause, "_tag"),
        readString(cause, "name"),
        P.isString(cause) ? O.some("String") : O.none(),
      ]);

class ChatCompletionMessageResponse extends S.Class<ChatCompletionMessageResponse>($I`ChatCompletionMessageResponse`)(
  {
    content: S.NullOr(S.String),
  },
  $I.annote("ChatCompletionMessageResponse", {
    description: "Minimal assistant message shape decoded by the compatibility chat service.",
  })
) {}

class ChatCompletionChoiceResponse extends S.Class<ChatCompletionChoiceResponse>($I`ChatCompletionChoiceResponse`)(
  {
    message: ChatCompletionMessageResponse,
  },
  $I.annote("ChatCompletionChoiceResponse", {
    description: "Minimal chat completion choice shape decoded by the compatibility chat service.",
  })
) {}

class ChatCompletionTextResponse extends S.Class<ChatCompletionTextResponse>($I`ChatCompletionTextResponse`)(
  {
    choices: S.Array(ChatCompletionChoiceResponse),
  },
  $I.annote("ChatCompletionTextResponse", {
    description: "Minimal chat completion response shape decoded by the compatibility chat service.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(ChatCompletionTextResponse);
}

const decodeSseJson = decodeJsonString;

const createChatCompletionOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createChatCompletion",
  path: "/chat/completions",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Chat",
});

const createResponseOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createResponse",
  path: "/responses",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Responses (Alpha)",
});

const generateImageOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "generateImage",
  path: "/image/generate",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json", "image/jpeg", "image/png", "image/webp"],
  tag: "Image",
});

const simpleGenerateImageOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "simpleGenerateImage",
  path: "/images/generations",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Image",
});

const listImageStylesOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "listImageStyles",
  path: "/image/styles",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Image",
});

const upscaleImageOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "upscaleImage",
  path: "/image/upscale",
  requestContentTypes: ["application/json", "multipart/form-data"],
  responseContentTypes: ["image/png", "application/json"],
  tag: "Image",
});

const editImageOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "editImage",
  path: "/image/edit",
  requestContentTypes: ["application/json", "multipart/form-data"],
  responseContentTypes: ["image/png", "application/json"],
  tag: "Image",
});

const multiEditImageOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "multiEditImage",
  path: "/image/multi-edit",
  requestContentTypes: ["application/json", "multipart/form-data"],
  responseContentTypes: ["image/png", "application/json"],
  tag: "Image",
});

const backgroundRemoveImageOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "backgroundRemoveImage",
  path: "/image/background-remove",
  requestContentTypes: ["application/json", "multipart/form-data"],
  responseContentTypes: ["image/png", "application/json"],
  tag: "Image",
});

const listModelsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "listModels",
  path: "/models",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Models",
});

const listModelTraitsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "listModelTraits",
  path: "/models/traits",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Models",
});

const listModelCompatibilityMappingOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "listModelCompatibilityMapping",
  path: "/models/compatibility_mapping",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Models",
});

const getApiKeysOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getApiKeys",
  path: "/api_keys",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const deleteApiKeyOperation = VeniceAIOperationDescriptor.make({
  method: "DELETE",
  operationId: "deleteApiKey",
  path: "/api_keys",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const createApiKeyOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createApiKey",
  path: "/api_keys",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const updateApiKeyOperation = VeniceAIOperationDescriptor.make({
  method: "PATCH",
  operationId: "updateApiKey",
  path: "/api_keys",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const getApiKeyByIdOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getApiKeyById",
  path: "/api_keys/{id}",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const getApiKeyRateLimitsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getApiKeyRateLimits",
  path: "/api_keys/rate_limits",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const getApiKeyRateLimitLogsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getApiKeyRateLimitLogs",
  path: "/api_keys/rate_limits/log",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const getApiKeyGenerateWeb3KeyOperation = VeniceAIOperationDescriptor.make({
  authenticated: false,
  method: "GET",
  operationId: "getApiKeyGenerateWeb3Key",
  path: "/api_keys/generate_web3_key",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const postApiKeyGenerateWeb3KeyOperation = VeniceAIOperationDescriptor.make({
  authenticated: false,
  method: "POST",
  operationId: "postApiKeyGenerateWeb3Key",
  path: "/api_keys/generate_web3_key",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "API Keys",
});

const listCharactersOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "listCharacters",
  path: "/characters",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Characters",
});

const getCharacterBySlugOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getCharacterBySlug",
  path: "/characters/{slug}",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Characters",
});

const getCharacterReviewsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getCharacterReviews",
  path: "/characters/{slug}/reviews",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Characters",
});

const createEmbeddingOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createEmbedding",
  path: "/embeddings",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Embeddings",
});

const createSpeechOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createSpeech",
  path: "/audio/speech",
  requestContentTypes: ["application/json"],
  responseContentTypes: [
    "audio/aac",
    "audio/flac",
    "audio/mpeg",
    "audio/opus",
    "audio/pcm",
    "audio/wav",
    "application/json",
  ],
  tag: "Audio",
});

const createTranscriptionOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createTranscription",
  path: "/audio/transcriptions",
  requestContentTypes: ["multipart/form-data"],
  responseContentTypes: ["application/json", "text/plain"],
  tag: "Audio",
});

const createClonedVoiceOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createClonedVoice",
  path: "/audio/voices",
  requestContentTypes: ["multipart/form-data"],
  responseContentTypes: ["application/json"],
  tag: "Audio",
});

const completeVideoOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "completeVideo",
  path: "/video/complete",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Video",
});

const queueVideoOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "queueVideo",
  path: "/video/queue",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Video",
});

const quoteVideoOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "quoteVideo",
  path: "/video/quote",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Video",
});

const retrieveVideoOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "retrieveVideo",
  path: "/video/retrieve",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json", "video/mp4"],
  tag: "Video",
});

const createVideoTranscriptionOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createVideoTranscription",
  path: "/video/transcriptions",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json", "text/plain"],
  tag: "Video",
});

const createTextParserOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "createTextParser",
  path: "/augment/text-parser",
  requestContentTypes: ["multipart/form-data"],
  responseContentTypes: ["application/json", "text/plain"],
  tag: "Augment",
});

const completeAudioOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "completeAudio",
  path: "/audio/complete",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Audio",
});

const queueAudioOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "queueAudio",
  path: "/audio/queue",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Audio",
});

const quoteAudioOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "quoteAudio",
  path: "/audio/quote",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Audio",
});

const retrieveAudioOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "retrieveAudio",
  path: "/audio/retrieve",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json", "audio/mpeg", "audio/wav", "audio/flac"],
  tag: "Audio",
});

const getBillingBalanceOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getBillingBalance",
  path: "/billing/balance",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Billing",
});

const getBillingUsageOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getBillingUsage",
  path: "/billing/usage",
  requestContentTypes: [],
  responseContentTypes: ["application/json", "text/csv"],
  tag: "Billing",
});

const getBillingUsageAnalyticsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getBillingUsageAnalytics",
  path: "/billing/usage-analytics",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Billing",
});

const listCryptoRpcNetworksOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "listCryptoRpcNetworks",
  path: "/crypto/rpc/networks",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "Crypto RPC",
});

const cryptoRpcProxyOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "cryptoRpcProxy",
  path: "/crypto/rpc/{network}",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Crypto RPC",
});

const getX402BalanceOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getX402Balance",
  path: "/x402/balance/{walletAddress}",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "x402",
});

const topUpX402BalanceOperation = VeniceAIOperationDescriptor.make({
  authenticated: false,
  method: "POST",
  operationId: "topUpX402Balance",
  path: "/x402/top-up",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "x402",
});

const getX402TransactionsOperation = VeniceAIOperationDescriptor.make({
  method: "GET",
  operationId: "getX402Transactions",
  path: "/x402/transactions/{walletAddress}",
  requestContentTypes: [],
  responseContentTypes: ["application/json"],
  tag: "x402",
});

const webScrapeOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "webScrape",
  path: "/augment/scrape",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Augment",
});

const webSearchOperation = VeniceAIOperationDescriptor.make({
  method: "POST",
  operationId: "webSearch",
  path: "/augment/search",
  requestContentTypes: ["application/json"],
  responseContentTypes: ["application/json"],
  tag: "Augment",
});

/**
 * Operation registry derived from `swagger.yaml`.
 *
 * **Example** (Map operation IDs)
 *
 * ```ts
 * import { VENICE_AI_OPERATION_DESCRIPTORS } from "@beep/venice-ai"
 * import { A } from "@beep/utils"
 * import { pipe } from "effect"
 *
 * const operationIds = pipe(
 *   VENICE_AI_OPERATION_DESCRIPTORS,
 *   A.map((operation) => operation.operationId)
 * )
 * console.log(operationIds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VENICE_AI_OPERATION_DESCRIPTORS: ReadonlyArray<VeniceAIOperationDescriptor> = [
  createChatCompletionOperation,
  createResponseOperation,
  generateImageOperation,
  simpleGenerateImageOperation,
  listImageStylesOperation,
  upscaleImageOperation,
  editImageOperation,
  multiEditImageOperation,
  backgroundRemoveImageOperation,
  listModelsOperation,
  listModelTraitsOperation,
  listModelCompatibilityMappingOperation,
  getApiKeysOperation,
  deleteApiKeyOperation,
  createApiKeyOperation,
  updateApiKeyOperation,
  getApiKeyByIdOperation,
  getApiKeyRateLimitsOperation,
  getApiKeyRateLimitLogsOperation,
  getApiKeyGenerateWeb3KeyOperation,
  postApiKeyGenerateWeb3KeyOperation,
  listCharactersOperation,
  getCharacterBySlugOperation,
  getCharacterReviewsOperation,
  createEmbeddingOperation,
  createSpeechOperation,
  createTranscriptionOperation,
  createClonedVoiceOperation,
  completeVideoOperation,
  queueVideoOperation,
  quoteVideoOperation,
  retrieveVideoOperation,
  createVideoTranscriptionOperation,
  createTextParserOperation,
  completeAudioOperation,
  queueAudioOperation,
  quoteAudioOperation,
  retrieveAudioOperation,
  getBillingBalanceOperation,
  getBillingUsageOperation,
  getBillingUsageAnalyticsOperation,
  listCryptoRpcNetworksOperation,
  cryptoRpcProxyOperation,
  getX402BalanceOperation,
  topUpX402BalanceOperation,
  getX402TransactionsOperation,
  webScrapeOperation,
  webSearchOperation,
];

/**
 * Non-streaming Venice API operation method.
 *
 * **Example** (Accept non-streaming method)
 *
 * ```ts
 * import type { VeniceAIMethod } from "@beep/venice-ai"
 *
 * const operation = (method: VeniceAIMethod) => method
 * console.log(operation)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type VeniceAIMethod = (request?: VeniceAIRequestOptions) => Effect.Effect<VeniceAIResponse, VeniceAIError>;

/**
 * Streaming Venice API operation method.
 *
 * **Example** (Accept streaming method)
 *
 * ```ts
 * import type { VeniceAIStreamMethod } from "@beep/venice-ai"
 *
 * const operation = (stream: VeniceAIStreamMethod) => stream
 * console.log(operation)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type VeniceAIStreamMethod = (
  request?: VeniceAIRequestOptions
) => Stream.Stream<VeniceAIServerSentEvent, VeniceAIError>;

type VeniceAINonStreamingShape = {
  readonly [MethodName in VeniceAIOperationId]: VeniceAIMethod;
};

/**
 * Runtime shape exposed by the {@link VeniceAI} service.
 *
 * **Example** (Call listModels on shape)
 *
 * ```ts
 * import type { VeniceAIShape } from "@beep/venice-ai"
 *
 * const operation = (venice: VeniceAIShape) => venice.listModels()
 * console.log(operation)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type VeniceAIShape = VeniceAINonStreamingShape & {
  readonly streamChatCompletion: VeniceAIStreamMethod;
  readonly streamResponse: VeniceAIStreamMethod;
};

class ResolvedVeniceAIConfig extends S.Class<ResolvedVeniceAIConfig>($I`ResolvedVeniceAIConfig`)(
  {
    apiKey: S.Option(S.String.pipe(S.RedactedFromValue)).annotateKey({
      description: "Resolved Venice API key from explicit configuration or environment.",
    }),
    baseUrl: VeniceAIBaseUrl.annotateKey({ description: "Resolved normalized Venice API base URL." }),
    headers: S.Record(S.String, S.String).annotateKey({ description: "Resolved base request headers." }),
  },
  $I.annote("ResolvedVeniceAIConfig", {
    description: "Resolved runtime configuration for the Venice AI driver.",
  })
) {}

const resolveConfig = (
  config: VeniceAIConfigInput,
  redactedApiKey?: Redacted.Redacted<string>
): ResolvedVeniceAIConfig => ({
  apiKey: pipe(
    O.fromUndefinedOr(redactedApiKey),
    O.orElse(() => config.apiKey)
  ),
  baseUrl: makeVeniceAIBaseUrl(config.baseUrl),
  headers: config.headers,
});

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- Venice keeps response media classification at its provider HTTP boundary
const isJsonContentType = (contentType: string): boolean => Str.includes("application/json")(contentType);

const isTextContentType = (contentType: string): boolean =>
  Str.startsWith("text/")(contentType) || Str.includes("text/event-stream")(contentType);

const hasRequestContentType = (descriptor: VeniceAIOperationDescriptor, contentType: string): boolean =>
  pipe(descriptor.requestContentTypes, A.contains(contentType));

const responseContentType = (response: HttpClientResponse.HttpClientResponse): O.Option<string> =>
  O.fromNullishOr(response.headers["content-type"]);

const diagnosticsFor = (event: string, error: VeniceAIError): Readonly<Record<string, unknown>> => ({
  event,
  provider: "venice-ai",
  reason: error.reason,
  ...O.getSomesStruct({
    cause: error.cause,
    operation: error.operation,
    path: error.path,
    status: error.status,
  }),
});

const logDriverFailure =
  (event: string) =>
  (error: VeniceAIError): Effect.Effect<void> =>
    Effect.logDebug(diagnosticsFor(event, error));

const logStatusFailure = (error: VeniceAIError): Effect.Effect<void> =>
  Effect.logWarning(diagnosticsFor("response-status", error));

const defaultAcceptHeader = (descriptor: VeniceAIOperationDescriptor): string =>
  pipe(
    descriptor.responseContentTypes,
    A.get(0),
    O.getOrElse(() => "application/json")
  );

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- Venice keeps path interpolation local to its operation request builder
const applyPathParams = (path: string, params: Readonly<Record<string, string>> = {}): string =>
  pipe(
    params,
    R.reduce(path, (currentPath, value, key) => Str.replace(`{${key}}`, encodeURIComponent(value))(currentPath))
  );

const failMissingPathParam = (
  descriptor: VeniceAIOperationDescriptor,
  path: string
): Effect.Effect<void, VeniceAIError> =>
  Str.includes("{")(path) ? Effect.fail(VeniceAIError.fromDescriptor(descriptor, "request encoding")) : Effect.void;

const requestEncodingError = <A>(descriptor: VeniceAIOperationDescriptor): Effect.Effect<A, VeniceAIError> =>
  Effect.fail(VeniceAIError.fromDescriptor(descriptor, "request encoding"));

const normalizeRequestOptions = (request: VeniceAIRequestOptions | undefined): VeniceAIRequestOptions =>
  request ?? VeniceAIRequestOptions.make({});

const normalizeQuery = (
  descriptor: VeniceAIOperationDescriptor,
  query: VeniceAIRequestOptions["query"] | undefined
): Effect.Effect<O.Option<VeniceAIEncodedQuery>, VeniceAIError> =>
  pipe(
    query ?? O.none(),
    O.match({
      onNone: () => Effect.succeed(O.none<VeniceAIEncodedQuery>()),
      onSome: (value) =>
        S.decodeEffect(VeniceAIEncodedQuery)(value).pipe(
          Effect.asSome,
          Effect.mapError(() => VeniceAIError.fromDescriptor(descriptor, "request encoding"))
        ),
    })
  );

const addRequestHeaders = (
  request: HttpClientRequest.HttpClientRequest,
  config: ResolvedVeniceAIConfig,
  descriptor: VeniceAIOperationDescriptor,
  options: VeniceAIRequestOptions
): HttpClientRequest.HttpClientRequest => {
  const withBaseHeaders = pipe(
    request,
    HttpClientRequest.accept(options.accept ?? defaultAcceptHeader(descriptor)),
    HttpClientRequest.setHeaders(config.headers),
    HttpClientRequest.setHeaders(O.getOrElse(options.headers ?? O.none(), () => R.empty<string>()))
  );

  return descriptor.authenticated
    ? pipe(
        config.apiKey,
        O.match({
          onNone: () => withBaseHeaders,
          onSome: (apiKey) => HttpClientRequest.bearerToken(withBaseHeaders, apiKey),
        })
      )
    : withBaseHeaders;
};

const addRequestBody = (
  request: HttpClientRequest.HttpClientRequest,
  descriptor: VeniceAIOperationDescriptor,
  options: VeniceAIRequestOptions
): Effect.Effect<HttpClientRequest.HttpClientRequest, VeniceAIError> => {
  const formData = options.formData ?? O.none();
  const body = options.body ?? O.none();

  if (O.isSome(formData)) {
    return hasRequestContentType(descriptor, "multipart/form-data")
      ? Effect.succeed(HttpClientRequest.bodyFormData(request, formData.value))
      : requestEncodingError(descriptor);
  }

  if (
    hasRequestContentType(descriptor, "multipart/form-data") &&
    !hasRequestContentType(descriptor, "application/json")
  ) {
    return Effect.fail(VeniceAIError.fromDescriptor(descriptor, "multipart encoding"));
  }

  if (O.isNone(body)) {
    return Effect.succeed(request);
  }

  if (!hasRequestContentType(descriptor, "application/json")) {
    return requestEncodingError(descriptor);
  }

  return pipe(
    HttpClientRequest.bodyJson(request, body.value),
    Effect.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "request encoding", { cause }))
  );
};

const buildRequest = Effect.fn("VeniceAI.buildRequest")(function* (
  config: ResolvedVeniceAIConfig,
  descriptor: VeniceAIOperationDescriptor,
  options: VeniceAIRequestOptions
) {
  const path = applyPathParams(
    descriptor.path,
    O.getOrElse(options.path ?? O.none(), () => R.empty<string>())
  );
  yield* failMissingPathParam(descriptor, path);
  const query = yield* normalizeQuery(descriptor, options.query);

  const request = pipe(
    HttpClientRequest.make(descriptor.method)(`${config.baseUrl}${path}`, { urlParams: O.getOrUndefined(query) }),
    (baseRequest) => addRequestHeaders(baseRequest, config, descriptor, options)
  );

  return yield* addRequestBody(request, descriptor, options);
});

const executeRaw = Effect.fn("VeniceAI.executeRaw")(function* (
  client: HttpClient.HttpClient,
  config: ResolvedVeniceAIConfig,
  descriptor: VeniceAIOperationDescriptor,
  options: VeniceAIRequestOptions
) {
  const request = yield* buildRequest(config, descriptor, options);

  return yield* client.execute(request).pipe(
    Effect.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "transport", { cause })),
    Effect.tapError(logDriverFailure("transport"))
  );
});

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- Venice assembles typed provider response metadata at its decode boundary
const responseContext = (response: HttpClientResponse.HttpClientResponse) => ({
  contentType: responseContentType(response),
  headers: response.headers,
  status: makeHttpStatus(response.status),
});

const ensureSuccessStatus = (
  descriptor: VeniceAIOperationDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<HttpClientResponse.HttpClientResponse, VeniceAIError> =>
  response.status >= 200 && response.status < 300
    ? Effect.succeed(response)
    : pipe(VeniceAIError.fromDescriptor(descriptor, "response status", { status: response.status }), (error) =>
        pipe(logStatusFailure(error), Effect.andThen(Effect.fail(error)))
      );

const contentMediaType: (contentType: string) => string = flow(
  Str.split(";"),
  A.get(0),
  O.getOrElse(() => ""),
  Str.trim,
  Str.toLowerCase
);

const isSseContentType = (contentType: string): boolean => contentMediaType(contentType) === "text/event-stream";

const ensureSseResponse = (
  descriptor: VeniceAIOperationDescriptor,
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<void, VeniceAIError> =>
  pipe(
    responseContentType(response),
    O.filter(isSseContentType),
    O.match({
      onNone: () => Effect.fail(VeniceAIError.fromDescriptor(descriptor, "sse decoding", { status: response.status })),
      onSome: () => Effect.void,
    })
  );

const decodeResponse = Effect.fn("VeniceAI.decodeResponse")(function* (
  descriptor: VeniceAIOperationDescriptor,
  response: HttpClientResponse.HttpClientResponse
) {
  const successfulResponse = yield* ensureSuccessStatus(descriptor, response);
  const contentType = O.getOrElse(responseContentType(successfulResponse), () => "");

  if (isJsonContentType(contentType)) {
    const body = yield* successfulResponse.json.pipe(
      Effect.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "response decoding", { cause }))
    );

    return VeniceAIJsonResponse.make({
      body,
      ...responseContext(successfulResponse),
    });
  }

  if (isTextContentType(contentType)) {
    const text = yield* successfulResponse.text.pipe(
      Effect.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "response decoding", { cause }))
    );

    return VeniceAITextResponse.make({
      text,
      ...responseContext(successfulResponse),
    });
  }

  const buffer = yield* successfulResponse.arrayBuffer.pipe(
    Effect.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "response decoding", { cause }))
  );

  return VeniceAIBinaryResponse.make({
    bytes: new Uint8Array(buffer),
    ...responseContext(successfulResponse),
  });
});

const executeOperation = (
  client: HttpClient.HttpClient,
  config: ResolvedVeniceAIConfig,
  descriptor: VeniceAIOperationDescriptor
): VeniceAIMethod => {
  const operation = Effect.fn(`VeniceAI.${descriptor.operationId}`)(function* (request?: VeniceAIRequestOptions) {
    const options = normalizeRequestOptions(request);
    const response = yield* executeRaw(client, config, descriptor, options);
    return yield* decodeResponse(descriptor, response);
  });

  return (request) =>
    operation(request).pipe(
      Effect.tapError(logDriverFailure("operation")),
      Effect.withSpan("VeniceAI.operation", {
        attributes: {
          operation: descriptor.operationId,
          path: descriptor.path,
          provider: "venice-ai",
        },
      })
    );
};

const addStreamFlag = (body: unknown): unknown => (P.isObject(body) ? { ...body, stream: true } : { stream: true });

const makeStreamingRequest = (request?: VeniceAIRequestOptions): VeniceAIRequestOptions => {
  const options = normalizeRequestOptions(request);

  return VeniceAIRequestOptions.make({
    ...options,
    accept: "text/event-stream",
    body: O.some(addStreamFlag(O.getOrUndefined(options.body ?? O.none()))),
  });
};

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- Venice keeps data-line parsing local to its provider SSE decoder
const dataLine = (line: string): O.Option<string> =>
  Str.startsWith("data:")(line) ? O.some(Str.trim(Str.slice(5)(line))) : O.none();

const sseBlockData = (block: string): O.Option<string> => {
  const data = pipe(A.fromIterable(Str.linesIterator(block)), A.map(dataLine), A.getSomes, A.join("\n"), Str.trim);
  if (!Str.isEmpty(data)) {
    return O.some(data);
  }

  return Str.isEmpty(Str.trim(block)) ? O.none() : O.some("");
};

type SseDataEvent = {
  readonly data: string;
  readonly index: number;
};

type SseDecodeState = {
  readonly buffer: string;
  readonly decoder: TextDecoder;
  readonly index: number;
};

const makeSseDecodeState = (): SseDecodeState => ({
  buffer: "",
  decoder: new TextDecoder(),
  index: 0,
});

const endsWithSseBoundary = (text: string): boolean => Str.endsWith("\n\n")(text) || Str.endsWith("\r\n\r\n")(text);

const splitSseText = (
  text: string
): {
  readonly blocks: ReadonlyArray<string>;
  readonly remainder: string;
} => {
  const parts = Str.split(text, /\r?\n\r?\n/);

  return endsWithSseBoundary(text)
    ? { blocks: parts, remainder: "" }
    : {
        blocks: A.dropRight(parts, 1),
        remainder: pipe(
          parts,
          A.last,
          O.getOrElse(() => "")
        ),
      };
};

const indexedSseBlocks = (startIndex: number, blocks: ReadonlyArray<string>): ReadonlyArray<SseDataEvent> =>
  pipe(
    blocks,
    A.map(sseBlockData),
    A.getSomes,
    A.map((data, offset) => ({
      data,
      index: startIndex + offset,
    }))
  );

const decodeSseChunk = (
  state: SseDecodeState,
  chunk: Uint8Array
): readonly [SseDecodeState, ReadonlyArray<SseDataEvent>] => {
  const decoded = state.decoder.decode(chunk, { stream: true });
  const { blocks, remainder } = splitSseText(`${state.buffer}${decoded}`);
  const values = indexedSseBlocks(state.index, blocks);

  return [
    {
      ...state,
      buffer: remainder,
      index: state.index + values.length,
    },
    values,
  ];
};

const flushSseState = (state: SseDecodeState): ReadonlyArray<SseDataEvent> => {
  const text = `${state.buffer}${state.decoder.decode()}`;
  return Str.isEmpty(text) ? [] : indexedSseBlocks(state.index, [text]);
};

const parseSseData = (
  descriptor: VeniceAIOperationDescriptor,
  data: string,
  index: number
): Effect.Effect<VeniceAIServerSentEvent, VeniceAIError> =>
  data === "[DONE]"
    ? Effect.succeed(VeniceAIServerSentEvent.make({ done: true, index: NonNegativeInt.make(index) }))
    : pipe(
        decodeSseJson(data),
        Effect.map((decoded) =>
          VeniceAIServerSentEvent.make({ data: O.some(decoded), done: false, index: NonNegativeInt.make(index) })
        ),
        Effect.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "sse decoding", { cause }))
      );

const streamOperation =
  (
    client: HttpClient.HttpClient,
    config: ResolvedVeniceAIConfig,
    descriptor: VeniceAIOperationDescriptor
  ): VeniceAIStreamMethod =>
  (request) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const response = yield* executeRaw(client, config, descriptor, makeStreamingRequest(request));
        const successfulResponse = yield* ensureSuccessStatus(descriptor, response);
        yield* ensureSseResponse(descriptor, successfulResponse);
        return successfulResponse.stream.pipe(
          Stream.mapError((cause) => VeniceAIError.fromDescriptor(descriptor, "sse decoding", { cause })),
          Stream.mapAccum(makeSseDecodeState, decodeSseChunk, { onHalt: flushSseState }),
          Stream.mapEffect(({ data, index }) => parseSseData(descriptor, data, index))
        );
      })
    ).pipe(
      Stream.tapError(logDriverFailure("stream")),
      Stream.withSpan("VeniceAI.stream", {
        attributes: {
          operation: descriptor.operationId,
          path: descriptor.path,
          provider: "venice-ai",
        },
      })
    );

const extractChatText = Effect.fn("VeniceAI.extractChatText")(function* (response: VeniceAIResponse) {
  const body = yield* VeniceAIResponse.match(response, {
    Binary: () => Effect.fail(VeniceAIError.fromDescriptor(createChatCompletionOperation, "response decoding")),
    Json: (json) => Effect.succeed(json.body),
    Text: () => Effect.fail(VeniceAIError.fromDescriptor(createChatCompletionOperation, "response decoding")),
  });

  const decoded = yield* ChatCompletionTextResponse.decodeUnknownEffect(body).pipe(
    Effect.mapError((cause) =>
      VeniceAIError.fromDescriptor(createChatCompletionOperation, "response decoding", { cause })
    )
  );

  const firstChoice = yield* pipe(
    decoded.choices,
    A.get(0),
    Effect.fromOption(() => VeniceAIError.fromDescriptor(createChatCompletionOperation, "response decoding"))
  );

  return yield* pipe(
    O.fromNullishOr(firstChoice.message.content),
    Effect.fromOption(() => VeniceAIError.fromDescriptor(createChatCompletionOperation, "response decoding"))
  );
});

const makeService = (client: HttpClient.HttpClient, config: ResolvedVeniceAIConfig): VeniceAIShape => {
  const call = (descriptor: VeniceAIOperationDescriptor): VeniceAIMethod =>
    executeOperation(client, config, descriptor);
  const stream = (descriptor: VeniceAIOperationDescriptor): VeniceAIStreamMethod =>
    streamOperation(client, config, descriptor);

  return {
    backgroundRemoveImage: call(backgroundRemoveImageOperation),
    completeAudio: call(completeAudioOperation),
    completeVideo: call(completeVideoOperation),
    createApiKey: call(createApiKeyOperation),
    createChatCompletion: call(createChatCompletionOperation),
    createClonedVoice: call(createClonedVoiceOperation),
    createEmbedding: call(createEmbeddingOperation),
    createResponse: call(createResponseOperation),
    createSpeech: call(createSpeechOperation),
    createTextParser: call(createTextParserOperation),
    createTranscription: call(createTranscriptionOperation),
    createVideoTranscription: call(createVideoTranscriptionOperation),
    cryptoRpcProxy: call(cryptoRpcProxyOperation),
    deleteApiKey: call(deleteApiKeyOperation),
    editImage: call(editImageOperation),
    generateImage: call(generateImageOperation),
    getApiKeyById: call(getApiKeyByIdOperation),
    getApiKeyGenerateWeb3Key: call(getApiKeyGenerateWeb3KeyOperation),
    getApiKeyRateLimitLogs: call(getApiKeyRateLimitLogsOperation),
    getApiKeyRateLimits: call(getApiKeyRateLimitsOperation),
    getApiKeys: call(getApiKeysOperation),
    getBillingBalance: call(getBillingBalanceOperation),
    getBillingUsage: call(getBillingUsageOperation),
    getBillingUsageAnalytics: call(getBillingUsageAnalyticsOperation),
    getCharacterBySlug: call(getCharacterBySlugOperation),
    getCharacterReviews: call(getCharacterReviewsOperation),
    getX402Balance: call(getX402BalanceOperation),
    getX402Transactions: call(getX402TransactionsOperation),
    listCharacters: call(listCharactersOperation),
    listCryptoRpcNetworks: call(listCryptoRpcNetworksOperation),
    listImageStyles: call(listImageStylesOperation),
    listModelCompatibilityMapping: call(listModelCompatibilityMappingOperation),
    listModelTraits: call(listModelTraitsOperation),
    listModels: call(listModelsOperation),
    multiEditImage: call(multiEditImageOperation),
    postApiKeyGenerateWeb3Key: call(postApiKeyGenerateWeb3KeyOperation),
    queueAudio: call(queueAudioOperation),
    queueVideo: call(queueVideoOperation),
    quoteAudio: call(quoteAudioOperation),
    quoteVideo: call(quoteVideoOperation),
    retrieveAudio: call(retrieveAudioOperation),
    retrieveVideo: call(retrieveVideoOperation),
    simpleGenerateImage: call(simpleGenerateImageOperation),
    streamChatCompletion: stream(createChatCompletionOperation),
    streamResponse: stream(createResponseOperation),
    topUpX402Balance: call(topUpX402BalanceOperation),
    upscaleImage: call(upscaleImageOperation),
    updateApiKey: call(updateApiKeyOperation),
    webScrape: call(webScrapeOperation),
    webSearch: call(webSearchOperation),
  };
};

/**
 * Effect service for Venice AI API operations.
 *
 * **Example** (Yield service listModels)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VeniceAI } from "@beep/venice-ai"
 *
 * const program = Effect.gen(function* () {
 *   const venice = yield* VeniceAI
 *   return yield* venice.listModels()
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VeniceAI extends Context.Service<VeniceAI, VeniceAIShape>()($I`VeniceAI`) {
  /**
   * Build a Venice AI layer from explicit runtime configuration.
   *
   * **Example** (Build layer from config)
   *
   * ```ts
   * import { Redacted } from "effect"
   * import * as O from "effect/Option"
   * import { VeniceAI, VeniceAIConfigInput } from "@beep/venice-ai"
   *
   * const layer = VeniceAI.makeLayer(VeniceAIConfigInput.make({ apiKey: O.some(Redacted.make("test-key")) }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config = VeniceAIConfigInput.make({})
  ): Layer.Layer<VeniceAI, never, HttpClient.HttpClient> =>
    Layer.effect(
      VeniceAI,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        return VeniceAI.of(makeService(client, resolveConfig(config)));
      })
    );

  /**
   * Live Venice AI layer backed by `AI_VENICE_API_KEY`.
   *
   * **Example** (Use live VeniceAI layer)
   *
   * ```ts
   * import { VeniceAI } from "@beep/venice-ai"
   *
   * const layer = VeniceAI.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<VeniceAI, VeniceAIError> = Layer.effect(
    VeniceAI,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("AI_VENICE_API_KEY");
      const client = yield* HttpClient.HttpClient;
      return VeniceAI.of(makeService(client, resolveConfig(VeniceAIConfigInput.make({}), apiKey)));
    }).pipe(Effect.mapError(VeniceAIError.config))
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

/**
 * Compatibility chat convenience backed by {@link VeniceAI.createChatCompletion}.
 *
 * **Example** (Chat with convenience service)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { VeniceAiChat } from "@beep/venice-ai"
 *
 * const program = Effect.gen(function* () {
 *   const venice = yield* VeniceAiChat
 *   return yield* venice.chat("What is your favorite joke?")
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VeniceAiChat extends Context.Service<
  VeniceAiChat,
  {
    readonly chat: (message: string) => Effect.Effect<string, VeniceAIError>;
  }
>()($I`VeniceAiChat`) {
  /**
   * Build the compatibility chat layer from an already provided {@link VeniceAI} service.
   *
   * **Example** (Provide chat over VeniceAI)
   *
   * ```ts
   * import { Layer } from "effect"
   * import { VeniceAI, VeniceAiChat } from "@beep/venice-ai"
   *
   * const layer = VeniceAiChat.makeLayer.pipe(Layer.provide(VeniceAI.layer))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer: Layer.Layer<VeniceAiChat, never, VeniceAI> = Layer.effect(
    VeniceAiChat,
    Effect.gen(function* () {
      const venice = yield* VeniceAI;

      return VeniceAiChat.of({
        chat: Effect.fn("VeniceAiChat.chat")(function* (message: string) {
          const response = yield* venice.createChatCompletion(
            VeniceAIRequestOptions.make({
              body: O.some({
                messages: [
                  {
                    content: message,
                    role: "user",
                  },
                ],
                model: VENICE_CHAT_MODEL,
              }),
            })
          );

          return yield* extractChatText(response);
        }),
      });
    })
  );

  /**
   * Live compatibility chat layer.
   *
   * **Example** (Use live chat layer)
   *
   * ```ts
   * import { VeniceAiChat } from "@beep/venice-ai"
   *
   * const layer = VeniceAiChat.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<VeniceAiChat, VeniceAIError> = VeniceAiChat.makeLayer.pipe(
    Layer.provide(VeniceAI.layer)
  );
}
