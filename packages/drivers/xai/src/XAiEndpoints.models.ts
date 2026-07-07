/**
 * Checked-in xAI endpoint manifest used to keep the driver complete.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XaiId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $XaiId.create("XAiEndpoints.models");

/**
 * Number of xAI endpoints represented in the manifest.
 *
 * @example
 * ```ts
 * import { XAI_ENDPOINT_COUNT, XAI_ENDPOINTS } from "@beep/xai"
 *
 * const manifestMatchesCount = XAI_ENDPOINTS.length === XAI_ENDPOINT_COUNT
 * console.log(manifestMatchesCount) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAI_ENDPOINT_COUNT = 86;

const XAiHttpMethodValues = ["DELETE", "GET", "PATCH", "POST", "PUT"] as const;
const XAiHttpMethodBase = LiteralKit(XAiHttpMethodValues);

/**
 * HTTP method literals used by xAI REST endpoints.
 *
 * @example
 * ```ts
 * import type { XAiHttpMethod } from "@beep/xai"
 *
 * const method: XAiHttpMethod = "POST"
 * console.log(method)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiHttpMethod = XAiHttpMethodBase.pipe(
  $I.annoteSchema("XAiHttpMethod", {
    description: "HTTP method literals used by xAI REST endpoints.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiHttpMethodBase)
);

/**
 * Type for {@link XAiHttpMethod}.
 *
 * @example
 * ```ts
 * import type { XAiHttpMethod } from "@beep/xai"
 *
 * const method: XAiHttpMethod = "GET"
 * console.log(method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiHttpMethod = typeof XAiHttpMethod.Type;

const XAiAuthKindValues = ["api-key", "management-key"] as const;
const XAiAuthKindBase = LiteralKit(XAiAuthKindValues);

/**
 * Authentication channel required by an xAI endpoint.
 *
 * @example
 * ```ts
 * import type { XAiAuthKind } from "@beep/xai"
 *
 * const auth: XAiAuthKind = "api-key"
 * console.log(auth)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiAuthKind = XAiAuthKindBase.pipe(
  $I.annoteSchema("XAiAuthKind", {
    description: "Authentication channel required by an xAI endpoint.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiAuthKindBase)
);

/**
 * Type for {@link XAiAuthKind}.
 *
 * @example
 * ```ts
 * import type { XAiAuthKind } from "@beep/xai"
 *
 * const auth: XAiAuthKind = "api-key"
 * console.log(auth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiAuthKind = typeof XAiAuthKind.Type;

const XAiEndpointBaseValues = ["api", "management", "websocket"] as const;
const XAiEndpointBaseBase = LiteralKit(XAiEndpointBaseValues);

/**
 * xAI base URL family used by an endpoint.
 *
 * @example
 * ```ts
 * import type { XAiEndpointBase } from "@beep/xai"
 *
 * const base: XAiEndpointBase = "management"
 * console.log(base)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiEndpointBase = XAiEndpointBaseBase.pipe(
  $I.annoteSchema("XAiEndpointBase", {
    description: "xAI base URL family used by an endpoint.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiEndpointBaseBase)
);

/**
 * Type for {@link XAiEndpointBase}.
 *
 * @example
 * ```ts
 * import type { XAiEndpointBase } from "@beep/xai"
 *
 * const base: XAiEndpointBase = "api"
 * console.log(base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiEndpointBase = typeof XAiEndpointBase.Type;

const XAiRequestBodyKindValues = ["binary", "json", "multipart", "none", "websocket"] as const;
const XAiRequestBodyKindBase = LiteralKit(XAiRequestBodyKindValues);

/**
 * Request body encoding used by an xAI endpoint.
 *
 * @example
 * ```ts
 * import type { XAiRequestBodyKind } from "@beep/xai"
 *
 * const bodyKind: XAiRequestBodyKind = "json"
 * console.log(bodyKind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiRequestBodyKind = XAiRequestBodyKindBase.pipe(
  $I.annoteSchema("XAiRequestBodyKind", {
    description: "Request body encoding used by an xAI endpoint.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiRequestBodyKindBase)
);

/**
 * Type for {@link XAiRequestBodyKind}.
 *
 * @example
 * ```ts
 * import type { XAiRequestBodyKind } from "@beep/xai"
 *
 * const bodyKind: XAiRequestBodyKind = "json"
 * console.log(bodyKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiRequestBodyKind = typeof XAiRequestBodyKind.Type;

const XAiResponseBodyKindValues = ["binary", "json", "none", "sse", "websocket"] as const;
const XAiResponseBodyKindBase = LiteralKit(XAiResponseBodyKindValues);

/**
 * Response body encoding returned by an xAI endpoint.
 *
 * @example
 * ```ts
 * import type { XAiResponseBodyKind } from "@beep/xai"
 *
 * const responseKind: XAiResponseBodyKind = "json"
 * console.log(responseKind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiResponseBodyKind = XAiResponseBodyKindBase.pipe(
  $I.annoteSchema("XAiResponseBodyKind", {
    description: "Response body encoding returned by an xAI endpoint.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiResponseBodyKindBase)
);

/**
 * Type for {@link XAiResponseBodyKind}.
 *
 * @example
 * ```ts
 * import type { XAiResponseBodyKind } from "@beep/xai"
 *
 * const responseKind: XAiResponseBodyKind = "json"
 * console.log(responseKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiResponseBodyKind = typeof XAiResponseBodyKind.Type;

const XAiEndpointStatusValues = ["active", "deprecated", "documented-unknown"] as const;
const XAiEndpointStatusBase = LiteralKit(XAiEndpointStatusValues);

/**
 * Documentation status for an xAI endpoint.
 *
 * @example
 * ```ts
 * import type { XAiEndpointStatus } from "@beep/xai"
 *
 * const status: XAiEndpointStatus = "active"
 * console.log(status)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiEndpointStatus = XAiEndpointStatusBase.pipe(
  $I.annoteSchema("XAiEndpointStatus", {
    description: "Documentation status for an xAI endpoint.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiEndpointStatusBase)
);

/**
 * Type for {@link XAiEndpointStatus}.
 *
 * @example
 * ```ts
 * import type { XAiEndpointStatus } from "@beep/xai"
 *
 * const status: XAiEndpointStatus = "active"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiEndpointStatus = typeof XAiEndpointStatus.Type;

const XAiEndpointMethodNameValues = [
  "addBatchRequests",
  "addCollectionDocument",
  "batchGetCollectionDocuments",
  "cancelBatch",
  "connectRealtimeVoice",
  "connectStreamingStt",
  "connectStreamingTts",
  "createAnthropicCompletion",
  "createAnthropicMessage",
  "createApiKey",
  "createBatch",
  "createChatCompletion",
  "createCollection",
  "createCustomVoice",
  "createLegacyCompletion",
  "createRealtimeClientSecret",
  "createResponse",
  "deleteApiKey",
  "deleteCollection",
  "deleteCollectionDocument",
  "deleteCustomVoice",
  "deleteFile",
  "deleteResponse",
  "downloadCustomVoiceAudio",
  "downloadFileContent",
  "editImage",
  "editVideo",
  "extendVideo",
  "generateImage",
  "generateVideo",
  "getApiKey",
  "getApiKeyPropagation",
  "getBatch",
  "getBillingInfo",
  "getCollection",
  "getCollectionDocument",
  "getCustomVoice",
  "getDeferredChatCompletion",
  "getFile",
  "getImageGenerationModel",
  "getLanguageModel",
  "getModel",
  "getPostpaidSpendingLimits",
  "getPrepaidBalance",
  "getResponse",
  "getTtsVoice",
  "getVideo",
  "getVideoGenerationModel",
  "initializeFileUpload",
  "listApiKeys",
  "listAuditEvents",
  "listBatchRequests",
  "listBatchResults",
  "listBatches",
  "listCollectionDocuments",
  "listCollections",
  "listCustomVoices",
  "listEndpointAcls",
  "listFiles",
  "listImageGenerationModels",
  "listInvoices",
  "listLanguageModels",
  "listModels",
  "listPaymentMethods",
  "listTeamModels",
  "listTtsVoices",
  "listVideoGenerationModels",
  "previewPostpaidInvoice",
  "queryUsage",
  "regenerateCollectionDocument",
  "rotateApiKey",
  "searchDocuments",
  "setBillingInfo",
  "setDefaultPaymentMethod",
  "setPostpaidSpendingLimits",
  "synthesizeSpeech",
  "tokenizeText",
  "topUpPrepaidBalance",
  "transcribeSpeech",
  "updateApiKey",
  "updateCollection",
  "updateCustomVoice",
  "updateFile",
  "uploadFile",
  "uploadFileChunks",
  "validateManagementKey",
] as const;
const XAiEndpointMethodNameBase = LiteralKit(XAiEndpointMethodNameValues);

/**
 * Public `XAi` service method names that correspond to documented endpoints.
 *
 * @example
 * ```ts
 * import type { XAiEndpointMethodName } from "@beep/xai"
 *
 * const method: XAiEndpointMethodName = "createChatCompletion"
 * console.log(method)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiEndpointMethodName = XAiEndpointMethodNameBase.pipe(
  $I.annoteSchema("XAiEndpointMethodName", {
    description: "Public XAi service method names that correspond to documented endpoints.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiEndpointMethodNameBase)
);

/**
 * Type for {@link XAiEndpointMethodName}.
 *
 * @example
 * ```ts
 * import type { XAiEndpointMethodName } from "@beep/xai"
 *
 * const methodName: XAiEndpointMethodName = "listModels"
 * console.log(methodName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiEndpointMethodName = typeof XAiEndpointMethodName.Type;

/**
 * Runtime list of public `XAi` endpoint method names.
 *
 * @example
 * ```ts
 * import { XAI_ENDPOINT_METHOD_NAMES } from "@beep/xai"
 *
 * console.log(XAI_ENDPOINT_METHOD_NAMES.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAI_ENDPOINT_METHOD_NAMES: ReadonlyArray<XAiEndpointMethodName> = XAiEndpointMethodNameValues;

const XAiEndpointIdValues = [
  "inference.chat.createCompletion",
  "inference.chat.createResponse",
  "inference.chat.getResponse",
  "inference.chat.deleteResponse",
  "inference.chat.getDeferredCompletion",
  "inference.models.listModels",
  "inference.models.getModel",
  "inference.models.listLanguageModels",
  "inference.models.getLanguageModel",
  "inference.models.listImageGenerationModels",
  "inference.models.getImageGenerationModel",
  "inference.models.listVideoGenerationModels",
  "inference.models.getVideoGenerationModel",
  "inference.images.generate",
  "inference.images.edit",
  "inference.videos.generate",
  "inference.videos.edit",
  "inference.videos.extend",
  "inference.videos.get",
  "inference.batches.create",
  "inference.batches.list",
  "inference.batches.get",
  "inference.batches.listRequests",
  "inference.batches.addRequests",
  "inference.batches.listResults",
  "inference.batches.cancel",
  "inference.audio.transcribe",
  "inference.audio.connectStreamingStt",
  "inference.voice.createRealtimeClientSecret",
  "inference.voice.connectRealtime",
  "inference.voice.synthesizeSpeech",
  "inference.voice.connectStreamingTts",
  "inference.voice.listTtsVoices",
  "inference.voice.getTtsVoice",
  "inference.voice.createCustomVoice",
  "inference.voice.listCustomVoices",
  "inference.voice.getCustomVoice",
  "inference.voice.updateCustomVoice",
  "inference.voice.deleteCustomVoice",
  "inference.voice.downloadCustomVoiceAudio",
  "inference.other.getApiKey",
  "inference.other.tokenizeText",
  "inference.legacy.createCompletion",
  "inference.legacy.createAnthropicMessage",
  "inference.legacy.createAnthropicCompletion",
  "files.upload",
  "files.initializeUpload",
  "files.uploadChunks",
  "files.list",
  "files.get",
  "files.update",
  "files.delete",
  "files.downloadContent",
  "collections.searchDocuments",
  "collections.create",
  "collections.list",
  "collections.get",
  "collections.delete",
  "collections.update",
  "collections.addDocument",
  "collections.listDocuments",
  "collections.getDocument",
  "collections.regenerateDocument",
  "collections.deleteDocument",
  "collections.batchGetDocuments",
  "management.auth.createApiKey",
  "management.auth.listApiKeys",
  "management.auth.updateApiKey",
  "management.auth.rotateApiKey",
  "management.auth.deleteApiKey",
  "management.auth.getApiKeyPropagation",
  "management.auth.listTeamModels",
  "management.auth.listEndpointAcls",
  "management.auth.validateManagementKey",
  "management.billing.getBillingInfo",
  "management.billing.setBillingInfo",
  "management.billing.listInvoices",
  "management.billing.listPaymentMethods",
  "management.billing.setDefaultPaymentMethod",
  "management.billing.previewPostpaidInvoice",
  "management.billing.getPostpaidSpendingLimits",
  "management.billing.setPostpaidSpendingLimits",
  "management.billing.getPrepaidBalance",
  "management.billing.topUpPrepaidBalance",
  "management.billing.queryUsage",
  "management.audit.listEvents",
] as const;
const XAiEndpointIdBase = LiteralKit(XAiEndpointIdValues);

/**
 * Stable endpoint identifiers in the checked-in xAI manifest.
 *
 * @example
 * ```ts
 * import type { XAiEndpointId } from "@beep/xai"
 *
 * const endpoint: XAiEndpointId = "inference.chat.createCompletion"
 * console.log(endpoint)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XAiEndpointId = XAiEndpointIdBase.pipe(
  $I.annoteSchema("XAiEndpointId", {
    description: "Stable endpoint identifiers in the checked-in xAI manifest.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  })),
  SchemaUtils.withLiteralKitStatics(XAiEndpointIdBase)
);

/**
 * Type for {@link XAiEndpointId}.
 *
 * @example
 * ```ts
 * import type { XAiEndpointId } from "@beep/xai"
 *
 * const endpointId: XAiEndpointId = "inference.models.listModels"
 * console.log(endpointId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiEndpointId = typeof XAiEndpointId.Type;

/**
 * Schema for endpoint descriptors stored in {@link XAI_ENDPOINTS}.
 *
 * @example
 * ```ts
 * import { XAiEndpoint } from "@beep/xai"
 * import * as S from "effect/Schema"
 *
 * const isEndpoint = S.is(XAiEndpoint)
 * console.log(isEndpoint)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class XAiEndpoint extends S.Class<XAiEndpoint>($I`XAiEndpoint`)(
  {
    auth: XAiAuthKind,
    base: XAiEndpointBase,
    body: XAiRequestBodyKind,
    id: XAiEndpointId,
    method: XAiHttpMethod,
    methodName: XAiEndpointMethodName,
    path: S.String,
    response: XAiResponseBodyKind,
    status: XAiEndpointStatus,
  },
  $I.annote("XAiEndpoint", {
    description: "Schema for endpoint descriptors stored in the checked-in xAI manifest.",
  })
) {
  static readonly is = S.is(XAiEndpoint);
}

/**
 * Metadata for one documented xAI endpoint.
 *
 * @example
 * ```ts
 * import type { XAiEndpointDescriptor } from "@beep/xai"
 *
 * const descriptor: XAiEndpointDescriptor = {
 *   auth: "api-key",
 *   base: "api",
 *   body: "json",
 *   id: "inference.chat.createCompletion",
 *   method: "POST",
 *   methodName: "createChatCompletion",
 *   path: "/v1/chat/completions",
 *   response: "json",
 *   status: "active"
 * }
 * console.log(descriptor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XAiEndpointDescriptor = XAiEndpoint;

const endpoint = (descriptor: XAiEndpointDescriptor): XAiEndpointDescriptor => XAiEndpoint.make(descriptor);

/**
 * Manifest of every xAI endpoint represented by the `XAi` service.
 *
 * @example
 * ```ts
 * import { XAI_ENDPOINTS } from "@beep/xai"
 *
 * console.log(XAI_ENDPOINTS.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const XAI_ENDPOINTS: ReadonlyArray<XAiEndpointDescriptor> = [
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.chat.createCompletion",
    method: "POST",
    methodName: "createChatCompletion",
    path: "/v1/chat/completions",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.chat.createResponse",
    method: "POST",
    methodName: "createResponse",
    path: "/v1/responses",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.chat.getResponse",
    method: "GET",
    methodName: "getResponse",
    path: "/v1/responses/{response_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.chat.deleteResponse",
    method: "DELETE",
    methodName: "deleteResponse",
    path: "/v1/responses/{response_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.chat.getDeferredCompletion",
    method: "GET",
    methodName: "getDeferredChatCompletion",
    path: "/v1/chat/deferred-completion/{request_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.listModels",
    method: "GET",
    methodName: "listModels",
    path: "/v1/models",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.getModel",
    method: "GET",
    methodName: "getModel",
    path: "/v1/models/{model_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.listLanguageModels",
    method: "GET",
    methodName: "listLanguageModels",
    path: "/v1/language-models",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.getLanguageModel",
    method: "GET",
    methodName: "getLanguageModel",
    path: "/v1/language-models/{model_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.listImageGenerationModels",
    method: "GET",
    methodName: "listImageGenerationModels",
    path: "/v1/image-generation-models",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.getImageGenerationModel",
    method: "GET",
    methodName: "getImageGenerationModel",
    path: "/v1/image-generation-models/{model_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.listVideoGenerationModels",
    method: "GET",
    methodName: "listVideoGenerationModels",
    path: "/v1/video-generation-models",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.models.getVideoGenerationModel",
    method: "GET",
    methodName: "getVideoGenerationModel",
    path: "/v1/video-generation-models/{model_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.images.generate",
    method: "POST",
    methodName: "generateImage",
    path: "/v1/images/generations",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.images.edit",
    method: "POST",
    methodName: "editImage",
    path: "/v1/images/edits",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.videos.generate",
    method: "POST",
    methodName: "generateVideo",
    path: "/v1/videos/generations",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.videos.edit",
    method: "POST",
    methodName: "editVideo",
    path: "/v1/videos/edits",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.videos.extend",
    method: "POST",
    methodName: "extendVideo",
    path: "/v1/videos/extensions",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.videos.get",
    method: "GET",
    methodName: "getVideo",
    path: "/v1/videos/{request_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.batches.create",
    method: "POST",
    methodName: "createBatch",
    path: "/v1/batches",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.batches.list",
    method: "GET",
    methodName: "listBatches",
    path: "/v1/batches",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.batches.get",
    method: "GET",
    methodName: "getBatch",
    path: "/v1/batches/{batch_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.batches.listRequests",
    method: "GET",
    methodName: "listBatchRequests",
    path: "/v1/batches/{batch_id}/requests",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.batches.addRequests",
    method: "POST",
    methodName: "addBatchRequests",
    path: "/v1/batches/{batch_id}/requests",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.batches.listResults",
    method: "GET",
    methodName: "listBatchResults",
    path: "/v1/batches/{batch_id}/results",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.batches.cancel",
    method: "POST",
    methodName: "cancelBatch",
    path: "/v1/batches/{batch_id}:cancel",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "multipart",
    id: "inference.audio.transcribe",
    method: "POST",
    methodName: "transcribeSpeech",
    path: "/v1/stt",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "websocket",
    body: "websocket",
    id: "inference.audio.connectStreamingStt",
    method: "GET",
    methodName: "connectStreamingStt",
    path: "/v1/stt",
    response: "websocket",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.voice.createRealtimeClientSecret",
    method: "POST",
    methodName: "createRealtimeClientSecret",
    path: "/v1/realtime/client_secrets",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "websocket",
    body: "websocket",
    id: "inference.voice.connectRealtime",
    method: "GET",
    methodName: "connectRealtimeVoice",
    path: "/v1/realtime",
    response: "websocket",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.voice.synthesizeSpeech",
    method: "POST",
    methodName: "synthesizeSpeech",
    path: "/v1/tts",
    response: "binary",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "websocket",
    body: "websocket",
    id: "inference.voice.connectStreamingTts",
    method: "GET",
    methodName: "connectStreamingTts",
    path: "/v1/tts",
    response: "websocket",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.voice.listTtsVoices",
    method: "GET",
    methodName: "listTtsVoices",
    path: "/v1/tts/voices",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.voice.getTtsVoice",
    method: "GET",
    methodName: "getTtsVoice",
    path: "/v1/tts/voices/{voice_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "multipart",
    id: "inference.voice.createCustomVoice",
    method: "POST",
    methodName: "createCustomVoice",
    path: "/v1/custom-voices",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.voice.listCustomVoices",
    method: "GET",
    methodName: "listCustomVoices",
    path: "/v1/custom-voices",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.voice.getCustomVoice",
    method: "GET",
    methodName: "getCustomVoice",
    path: "/v1/custom-voices/{voice_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.voice.updateCustomVoice",
    method: "PATCH",
    methodName: "updateCustomVoice",
    path: "/v1/custom-voices/{voice_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.voice.deleteCustomVoice",
    method: "DELETE",
    methodName: "deleteCustomVoice",
    path: "/v1/custom-voices/{voice_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.voice.downloadCustomVoiceAudio",
    method: "GET",
    methodName: "downloadCustomVoiceAudio",
    path: "/v1/custom-voices/{voice_id}/audio",
    response: "binary",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "inference.other.getApiKey",
    method: "GET",
    methodName: "getApiKey",
    path: "/v1/api-key",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.other.tokenizeText",
    method: "POST",
    methodName: "tokenizeText",
    path: "/v1/tokenize-text",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.legacy.createCompletion",
    method: "POST",
    methodName: "createLegacyCompletion",
    path: "/v1/completions",
    response: "json",
    status: "deprecated",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.legacy.createAnthropicMessage",
    method: "POST",
    methodName: "createAnthropicMessage",
    path: "/v1/messages",
    response: "json",
    status: "deprecated",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "inference.legacy.createAnthropicCompletion",
    method: "POST",
    methodName: "createAnthropicCompletion",
    path: "/v1/complete",
    response: "json",
    status: "deprecated",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "multipart",
    id: "files.upload",
    method: "POST",
    methodName: "uploadFile",
    path: "/v1/files",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "files.initializeUpload",
    method: "POST",
    methodName: "initializeFileUpload",
    path: "/v1/files:initialize",
    response: "json",
    status: "documented-unknown",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "binary",
    id: "files.uploadChunks",
    method: "POST",
    methodName: "uploadFileChunks",
    path: "/v1/files:uploadChunks",
    response: "json",
    status: "documented-unknown",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "files.list",
    method: "GET",
    methodName: "listFiles",
    path: "/v1/files",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "files.get",
    method: "GET",
    methodName: "getFile",
    path: "/v1/files/{file_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "files.update",
    method: "PUT",
    methodName: "updateFile",
    path: "/v1/files/{file_id}",
    response: "json",
    status: "documented-unknown",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "files.delete",
    method: "DELETE",
    methodName: "deleteFile",
    path: "/v1/files/{file_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "none",
    id: "files.downloadContent",
    method: "GET",
    methodName: "downloadFileContent",
    path: "/v1/files/{file_id}/content",
    response: "binary",
    status: "active",
  }),
  endpoint({
    auth: "api-key",
    base: "api",
    body: "json",
    id: "collections.searchDocuments",
    method: "POST",
    methodName: "searchDocuments",
    path: "/v1/documents/search",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "collections.create",
    method: "POST",
    methodName: "createCollection",
    path: "/v1/collections",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.list",
    method: "GET",
    methodName: "listCollections",
    path: "/v1/collections",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.get",
    method: "GET",
    methodName: "getCollection",
    path: "/v1/collections/{collection_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.delete",
    method: "DELETE",
    methodName: "deleteCollection",
    path: "/v1/collections/{collection_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "collections.update",
    method: "PUT",
    methodName: "updateCollection",
    path: "/v1/collections/{collection_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "collections.addDocument",
    method: "POST",
    methodName: "addCollectionDocument",
    path: "/v1/collections/{collection_id}/documents/{file_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.listDocuments",
    method: "GET",
    methodName: "listCollectionDocuments",
    path: "/v1/collections/{collection_id}/documents",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.getDocument",
    method: "GET",
    methodName: "getCollectionDocument",
    path: "/v1/collections/{collection_id}/documents/{file_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.regenerateDocument",
    method: "PATCH",
    methodName: "regenerateCollectionDocument",
    path: "/v1/collections/{collection_id}/documents/{file_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.deleteDocument",
    method: "DELETE",
    methodName: "deleteCollectionDocument",
    path: "/v1/collections/{collection_id}/documents/{file_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "collections.batchGetDocuments",
    method: "GET",
    methodName: "batchGetCollectionDocuments",
    path: "/v1/collections/{collection_id}/documents:batchGet",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.auth.createApiKey",
    method: "POST",
    methodName: "createApiKey",
    path: "/auth/teams/{teamId}/api-keys",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.auth.listApiKeys",
    method: "GET",
    methodName: "listApiKeys",
    path: "/auth/teams/{teamId}/api-keys",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.auth.updateApiKey",
    method: "PUT",
    methodName: "updateApiKey",
    path: "/auth/api-keys/{api_key_id}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.auth.rotateApiKey",
    method: "POST",
    methodName: "rotateApiKey",
    path: "/auth/api-keys/{apiKeyId}/rotate",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.auth.deleteApiKey",
    method: "DELETE",
    methodName: "deleteApiKey",
    path: "/auth/api-keys/{apiKeyId}",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.auth.getApiKeyPropagation",
    method: "GET",
    methodName: "getApiKeyPropagation",
    path: "/auth/api-keys/{apiKeyId}/propagation",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.auth.listTeamModels",
    method: "GET",
    methodName: "listTeamModels",
    path: "/auth/teams/{teamId}/models",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.auth.listEndpointAcls",
    method: "GET",
    methodName: "listEndpointAcls",
    path: "/auth/teams/{teamId}/endpoints",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.auth.validateManagementKey",
    method: "GET",
    methodName: "validateManagementKey",
    path: "/auth/management-keys/validation",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.billing.getBillingInfo",
    method: "GET",
    methodName: "getBillingInfo",
    path: "/v1/billing/teams/{team_id}/billing-info",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.billing.setBillingInfo",
    method: "POST",
    methodName: "setBillingInfo",
    path: "/v1/billing/teams/{team_id}/billing-info",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.billing.listInvoices",
    method: "GET",
    methodName: "listInvoices",
    path: "/v1/billing/teams/{team_id}/invoices",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.billing.listPaymentMethods",
    method: "GET",
    methodName: "listPaymentMethods",
    path: "/v1/billing/teams/{team_id}/payment-method",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.billing.setDefaultPaymentMethod",
    method: "POST",
    methodName: "setDefaultPaymentMethod",
    path: "/v1/billing/teams/{team_id}/payment-method/default",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.billing.previewPostpaidInvoice",
    method: "GET",
    methodName: "previewPostpaidInvoice",
    path: "/v1/billing/teams/{team_id}/postpaid/invoice/preview",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.billing.getPostpaidSpendingLimits",
    method: "GET",
    methodName: "getPostpaidSpendingLimits",
    path: "/v1/billing/teams/{team_id}/postpaid/spending-limits",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.billing.setPostpaidSpendingLimits",
    method: "POST",
    methodName: "setPostpaidSpendingLimits",
    path: "/v1/billing/teams/{team_id}/postpaid/spending-limits",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.billing.getPrepaidBalance",
    method: "GET",
    methodName: "getPrepaidBalance",
    path: "/v1/billing/teams/{team_id}/prepaid/balance",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.billing.topUpPrepaidBalance",
    method: "POST",
    methodName: "topUpPrepaidBalance",
    path: "/v1/billing/teams/{team_id}/prepaid/top-up",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "json",
    id: "management.billing.queryUsage",
    method: "POST",
    methodName: "queryUsage",
    path: "/v1/billing/teams/{team_id}/usage",
    response: "json",
    status: "active",
  }),
  endpoint({
    auth: "management-key",
    base: "management",
    body: "none",
    id: "management.audit.listEvents",
    method: "GET",
    methodName: "listAuditEvents",
    path: "/audit/teams/{teamId}/events",
    response: "json",
    status: "active",
  }),
];
