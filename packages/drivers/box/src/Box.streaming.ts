/**
 * Hand-written byte and event stream adapters for the Box Node SDK.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeBuffer from "node:buffer";
import * as NodeDns from "node:dns";
import { $BoxId } from "@beep/identity";
import { assertAllowedRemoteUrl, BlockedHostError, HttpsUrl } from "@beep/schema";
import * as NodeStream from "@effect/platform-node-shared/NodeStream";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as M from "./_generated/Box.models.gen.ts";
import { BoxError, BoxErrorOptionsInput } from "./Box.errors.ts";
import { BOX_SDK_VERSION } from "./internal/Box.constants.ts";
import { acquireSdkCallController, decodeWith, logDriverFailure } from "./internal/Box.runtime.ts";
import type { BoxMethodName } from "./_generated/Box.models.gen.ts";

const decodeUnknownMEventResult = S.decodeUnknownResult(M.Event);

const $I = $BoxId.create("Box.streaming");

const BoxByteEffectStream = S.declare<Stream.Stream<Uint8Array, BoxError, never>>(
  (value): value is Stream.Stream<Uint8Array, BoxError, never> => Stream.isStream(value),
  $I.annote("BoxByteEffectStream", {
    description: "Effect Stream byte input accepted by Box upload adapters.",
  })
);

const isNodeReadable = (value: unknown): value is NodeJS.ReadableStream =>
  P.isObject(value) &&
  P.isFunction(Reflect.get(value, "read")) &&
  P.isFunction(Reflect.get(value, "on")) &&
  P.isFunction(Reflect.get(value, "pipe"));

const BoxNodeReadableInput = S.declare(
  isNodeReadable,
  $I.annote("BoxReadableInput", {
    description: "Node readable byte input accepted by Box upload adapters.",
  })
);

const BoxByteInputValue = S.Union([S.Uint8Array, BoxNodeReadableInput, BoxByteEffectStream]).pipe(
  $I.annoteSchema("BoxByteInput", {
    description: "Byte input accepted by Box upload adapters.",
  })
);

const isBoxByteInputValue = S.is(BoxByteInputValue);

const LastPartIndex = S.Int.check(
  S.isGreaterThanOrEqualTo(
    -1,
    $I.annote("LastPartIndexMinimumCheck", {
      title: "Last part index minimum",
      description: "Chunked upload part indexes use -1 as the pre-upload sentinel and non-negative values thereafter.",
      message: "Expected an upload part index greater than or equal to -1",
    })
  )
).pipe(
  $I.annoteSchema("LastPartIndex", {
    description: "Chunked upload part index, with -1 representing the pre-upload sentinel.",
  })
);

/**
 * Byte input accepted by Box upload adapters.
 *
 * **Example** (Stream byte input example)
 *
 * ```ts
 * import * as Stream from "effect/Stream";
 * import type { BoxByteInput } from "@beep/box"
 *
 * const bytes: BoxByteInput = Stream.make(new Uint8Array([1, 2, 3]))
 * console.log(bytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoxByteInput = typeof BoxByteInputValue.Type;

/**
 * Byte stream returned by Box download adapters.
 *
 * **Example** (Empty byte stream example)
 *
 * ```ts
 * import * as Stream from "effect/Stream";
 * import type { BoxByteStream } from "@beep/box"
 *
 * const bytes: BoxByteStream = Stream.empty
 * console.log(bytes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoxByteStream = Stream.Stream<Uint8Array, BoxError, never>;

/**
 * Technical accumulator used by the Box chunked-upload reducer helper.
 *
 * **Example** (Make part accumulator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoxPartAccumulator } from "@beep/box"
 *
 * const accumulator = BoxPartAccumulator.make({
 *   fileHash: "sha1-empty",
 *   fileSize: S.Natural.make(0),
 *   lastIndex: -1,
 *   parts: [],
 *   uploadPartUrl: "https://upload.box.com/session"
 * })
 * console.log(accumulator.parts.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxPartAccumulator extends S.Opaque<BoxPartAccumulator, { readonly brand: unique symbol }>()(
  S.Struct({
    fileHash: S.Unknown,
    fileSize: S.Natural,
    lastIndex: LastPartIndex,
    parts: M.UploadPart.pipe(S.Array),
    uploadPartUrl: S.String,
  }).pipe(
    $I.annoteSchema("BoxPartAccumulator", {
      description: "Technical accumulator used by the Box chunked-upload reducer helper.",
    })
  )
) {}

class BoxCreateUserAvatarRequestBody extends S.Opaque<
  BoxCreateUserAvatarRequestBody,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    pic: BoxByteInputValue,
    picContentType: S.String.pipe(S.optionalKey),
    picFileName: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxCreateUserAvatarRequestBody", {
      description: "Create-user-avatar request body with a runtime byte input.",
    })
  )
) {}

class BoxUploadFileVersionRequestBody extends S.Opaque<
  BoxUploadFileVersionRequestBody,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    attributes: M.UploadFileVersionRequestBodyAttributesField,
    file: BoxByteInputValue,
    fileContentType: S.String.pipe(S.optionalKey),
    fileFileName: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxUploadFileVersionRequestBody", {
      description: "Upload-file-version request body with a runtime byte input.",
    })
  )
) {}

/**
 * Upload-file request body with a runtime byte input.
 *
 * **Example** (Describe an in-memory upload into the root folder)
 *
 * ```ts
 * import { UploadFileRequestBodyAttributesField, UploadFileRequestBodyAttributesParentField } from "@beep/box"
 * import { BoxUploadFileRequestBody } from "@beep/box/Box.streaming"
 *
 * const body = BoxUploadFileRequestBody.make({
 *   attributes: UploadFileRequestBodyAttributesField.make({
 *     name: "engagement-letter.txt",
 *     parent: UploadFileRequestBodyAttributesParentField.make({ id: "0" })
 *   }),
 *   file: new TextEncoder().encode("Signed engagement letter"),
 *   fileContentType: "text/plain"
 * })
 *
 * console.log(body.attributes.name) // => "engagement-letter.txt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFileRequestBody extends S.Opaque<BoxUploadFileRequestBody, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: M.UploadFileRequestBodyAttributesField,
    file: BoxByteInputValue,
    fileContentType: S.String.pipe(S.optionalKey),
    fileFileName: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxUploadFileRequestBody", {
      description: "Upload-file request body with a runtime byte input.",
    })
  )
) {}

class BoxUploadWithPreflightCheckRequestBody extends S.Opaque<
  BoxUploadWithPreflightCheckRequestBody,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    attributes: M.UploadWithPreflightCheckRequestBodyAttributesField,
    file: BoxByteInputValue,
    fileContentType: S.String.pipe(S.optionalKey),
    fileFileName: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxUploadWithPreflightCheckRequestBody", {
      description: "Upload-with-preflight-check request body with a runtime byte input.",
    })
  )
) {}

/**
 * Payload for `avatars.createUserAvatar`.
 *
 * **Example** (Create avatar payload)
 *
 * ```ts
 * import { BoxCreateUserAvatarPayload } from "@beep/box"
 *
 * const pic = new Uint8Array([137, 80, 78, 71])
 * const payload = BoxCreateUserAvatarPayload.make({
 *   requestBody: {
 *     pic,
 *     picContentType: "image/png",
 *     picFileName: "avatar.png"
 *   },
 *   userId: "12345"
 * })
 * console.log(payload.requestBody.picFileName, pic.byteLength)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxCreateUserAvatarPayload extends S.Opaque<
  BoxCreateUserAvatarPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    optionalsInput: M.CreateUserAvatarOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxCreateUserAvatarRequestBody,
    userId: S.String,
  }).pipe(
    $I.annoteSchema("BoxCreateUserAvatarPayload", {
      description: "Payload for avatars.createUserAvatar.",
    })
  )
) {}

/**
 * Payload for `avatars.getUserAvatar`.
 *
 * **Example** (Get avatar payload)
 *
 * ```ts
 * import { BoxGetUserAvatarPayload } from "@beep/box"
 *
 * const payload = BoxGetUserAvatarPayload.make({ userId: "12345" })
 * console.log(payload.userId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetUserAvatarPayload extends S.Opaque<BoxGetUserAvatarPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    optionalsInput: M.GetUserAvatarOptionalsInput.pipe(S.optionalKey),
    userId: S.String,
  }).pipe(
    $I.annoteSchema("BoxGetUserAvatarPayload", {
      description: "Payload for avatars.getUserAvatar.",
    })
  )
) {}

/**
 * Payload for `downloads.downloadFile`.
 *
 * **Example** (Download file payload)
 *
 * ```ts
 * import { BoxDownloadFilePayload } from "@beep/box"
 *
 * const payload = BoxDownloadFilePayload.make({ fileId: "12345" })
 * console.log(payload.fileId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDownloadFilePayload extends S.Opaque<BoxDownloadFilePayload, { readonly brand: unique symbol }>()(
  S.Struct({
    fileId: S.String,
    optionalsInput: M.DownloadFileOptionalsInput.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxDownloadFilePayload", {
      description: "Payload for downloads.downloadFile.",
    })
  )
) {}

/**
 * Payload for `files.getFileThumbnailById`.
 *
 * **Example** (Thumbnail by id payload)
 *
 * ```ts
 * import { BoxGetFileThumbnailByIdPayload } from "@beep/box"
 *
 * const payload = BoxGetFileThumbnailByIdPayload.make({ extension: "png", fileId: "12345" })
 * console.log(payload.extension)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetFileThumbnailByIdPayload extends S.Opaque<
  BoxGetFileThumbnailByIdPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    extension: M.GetFileThumbnailByIdExtension,
    fileId: S.String,
    optionalsInput: M.GetFileThumbnailByIdOptionalsInput.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxGetFileThumbnailByIdPayload", {
      description: "Payload for files.getFileThumbnailById.",
    })
  )
) {}

/**
 * Payload for `uploads.uploadFileVersion`.
 *
 * **Example** (Upload file version payload)
 *
 * ```ts
 * import { BoxUploadFileVersionPayload, UploadFileVersionRequestBodyAttributesField } from "@beep/box"
 *
 * const payload = BoxUploadFileVersionPayload.make({
 *   fileId: "12345",
 *   requestBody: {
 *     attributes: UploadFileVersionRequestBodyAttributesField.make({ name: "document-v2.txt" }),
 *     file: new Uint8Array([118, 50]),
 *     fileContentType: "text/plain",
 *     fileFileName: "document-v2.txt"
 *   }
 * })
 * console.log(payload.requestBody.attributes.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFileVersionPayload extends S.Opaque<
  BoxUploadFileVersionPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    fileId: S.String,
    optionalsInput: M.UploadFileVersionOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxUploadFileVersionRequestBody,
  }).pipe(
    $I.annoteSchema("BoxUploadFileVersionPayload", {
      description: "Payload for uploads.uploadFileVersion.",
    })
  )
) {}

/**
 * Payload for `uploads.uploadFile`.
 *
 * **Example** (Upload file payload)
 *
 * ```ts
 * import {
 *   BoxUploadFilePayload,
 *   UploadFileRequestBodyAttributesField,
 *   UploadFileRequestBodyAttributesParentField
 * } from "@beep/box"
 *
 * const payload = BoxUploadFilePayload.make({
 *   requestBody: {
 *     attributes: UploadFileRequestBodyAttributesField.make({
 *       name: "document.txt",
 *       parent: UploadFileRequestBodyAttributesParentField.make({ id: "0" })
 *     }),
 *     file: new Uint8Array([104, 105]),
 *     fileContentType: "text/plain",
 *     fileFileName: "document.txt"
 *   }
 * })
 * console.log(payload.requestBody.attributes.parent.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFilePayload extends S.Opaque<BoxUploadFilePayload, { readonly brand: unique symbol }>()(
  S.Struct({
    optionalsInput: M.UploadFileOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxUploadFileRequestBody,
  }).pipe(
    $I.annoteSchema("BoxUploadFilePayload", {
      description: "Payload for uploads.uploadFile.",
    })
  )
) {}

/**
 * Payload for `uploads.uploadWithPreflightCheck`.
 *
 * **Example** (Preflight upload payload)
 *
 * ```ts
 * import {
 *   BoxUploadWithPreflightCheckPayload,
 *   UploadWithPreflightCheckRequestBodyAttributesField,
 *   UploadWithPreflightCheckRequestBodyAttributesParentField
 * } from "@beep/box"
 *
 * const payload = BoxUploadWithPreflightCheckPayload.make({
 *   requestBody: {
 *     attributes: UploadWithPreflightCheckRequestBodyAttributesField.make({
 *       name: "document.txt",
 *       parent: UploadWithPreflightCheckRequestBodyAttributesParentField.make({ id: "0" }),
 *       size: 2
 *     }),
 *     file: new Uint8Array([104, 105]),
 *     fileContentType: "text/plain",
 *     fileFileName: "document.txt"
 *   }
 * })
 * console.log(payload.requestBody.attributes.size)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadWithPreflightCheckPayload extends S.Opaque<
  BoxUploadWithPreflightCheckPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    optionalsInput: M.UploadWithPreflightCheckOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxUploadWithPreflightCheckRequestBody,
  }).pipe(
    $I.annoteSchema("BoxUploadWithPreflightCheckPayload", {
      description: "Payload for uploads.uploadWithPreflightCheck.",
    })
  )
) {}

/**
 * Payload for `chunkedUploads.uploadFilePartByUrl`.
 *
 * **Example** (Upload part by URL)
 *
 * ```ts
 * import { HttpsUrl } from "@beep/schema/URL"
 * import { BoxUploadFilePartByUrlPayload, UploadFilePartByUrlHeadersInput } from "@beep/box"
 *
 * const payload = BoxUploadFilePartByUrlPayload.make({
 *   headersInput: UploadFilePartByUrlHeadersInput.make({
 *     contentRange: "bytes 0-1/2",
 *     digest: "sha=abc123"
 *   }),
 *   requestBody: new Uint8Array([104, 105]),
 *   url: HttpsUrl.make("https://upload.box.com/api/2.0/files/upload_sessions/abc/parts")
 * })
 * console.log(new URL(payload.url).hostname)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFilePartByUrlPayload extends S.Opaque<
  BoxUploadFilePartByUrlPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    headersInput: M.UploadFilePartByUrlHeadersInput,
    optionalsInput: M.UploadFilePartByUrlOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxByteInputValue,
    url: HttpsUrl,
  }).pipe(
    $I.annoteSchema("BoxUploadFilePartByUrlPayload", {
      description: "Payload for chunkedUploads.uploadFilePartByUrl.",
    })
  )
) {}

/**
 * Payload for `chunkedUploads.uploadFilePart`.
 *
 * **Example** (Upload file part payload)
 *
 * ```ts
 * import { BoxUploadFilePartPayload, UploadFilePartHeadersInput } from "@beep/box"
 *
 * const payload = BoxUploadFilePartPayload.make({
 *   headersInput: UploadFilePartHeadersInput.make({
 *     contentRange: "bytes 0-1/2",
 *     digest: "sha=abc123"
 *   }),
 *   requestBody: new Uint8Array([104, 105]),
 *   uploadSessionId: "upload-session-id"
 * })
 * console.log(payload.headersInput.contentRange)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFilePartPayload extends S.Opaque<BoxUploadFilePartPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    headersInput: M.UploadFilePartHeadersInput,
    optionalsInput: M.UploadFilePartOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxByteInputValue,
    uploadSessionId: S.String,
  }).pipe(
    $I.annoteSchema("BoxUploadFilePartPayload", {
      description: "Payload for chunkedUploads.uploadFilePart.",
    })
  )
) {}

/**
 * Payload for `chunkedUploads.reducer`.
 *
 * **Example** (Chunked upload reducer payload)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoxChunkedUploadReducerPayload, BoxPartAccumulator } from "@beep/box"
 *
 * const chunk = new Uint8Array([104, 105])
 * const payload = BoxChunkedUploadReducerPayload.make({
 *   acc: BoxPartAccumulator.make({
 *     fileHash: "sha1-empty",
 *     fileSize: S.Natural.make(chunk.byteLength),
 *     lastIndex: -1,
 *     parts: [],
 *     uploadPartUrl: "https://upload.box.com/session"
 *   }),
 *   chunk
 * })
 * console.log(payload.acc.lastIndex + 1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxChunkedUploadReducerPayload extends S.Opaque<
  BoxChunkedUploadReducerPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    acc: BoxPartAccumulator,
    chunk: BoxByteInputValue,
  }).pipe(
    $I.annoteSchema("BoxChunkedUploadReducerPayload", {
      description: "Payload for chunkedUploads.reducer.",
    })
  )
) {}

/**
 * Payload for `chunkedUploads.uploadBigFile`.
 *
 * **Example** (Upload big file payload)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoxUploadBigFilePayload } from "@beep/box"
 *
 * const payload = BoxUploadBigFilePayload.make({
 *   file: new Uint8Array([104, 105]),
 *   fileName: "large-document.txt",
 *   fileSize: S.Natural.make(2),
 *   parentFolderId: "0"
 * })
 * console.log(`${payload.fileName}:${payload.fileSize}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadBigFilePayload extends S.Opaque<BoxUploadBigFilePayload, { readonly brand: unique symbol }>()(
  S.Struct({
    file: BoxByteInputValue,
    fileName: S.String,
    fileSize: S.Natural,
    parentFolderId: S.String,
  }).pipe(
    $I.annoteSchema("BoxUploadBigFilePayload", {
      description: "Payload for chunkedUploads.uploadBigFile.",
    })
  )
) {}

/**
 * Payload for `events.getEventStream`.
 *
 * **Example** (Empty event stream payload)
 *
 * ```ts
 * import { BoxGetEventStreamPayload } from "@beep/box"
 *
 * const payload = BoxGetEventStreamPayload.make({})
 * console.log(payload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetEventStreamPayload extends S.Opaque<BoxGetEventStreamPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    headersInput: M.GetEventStreamHeadersInput.pipe(S.optionalKey),
    queryParams: M.GetEventStreamQueryParams.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxGetEventStreamPayload", {
      description: "Payload for events.getEventStream.",
    })
  )
) {}

/**
 * Payload for `zipDownloads.getZipDownloadContent`.
 *
 * **Example** (Zip download content payload)
 *
 * ```ts
 * import { HttpsUrl } from "@beep/schema/URL"
 * import { BoxGetZipDownloadContentPayload } from "@beep/box"
 *
 * const payload = BoxGetZipDownloadContentPayload.make({ downloadUrl: HttpsUrl.make("https://example.com/content") })
 * console.log(payload.downloadUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetZipDownloadContentPayload extends S.Opaque<
  BoxGetZipDownloadContentPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    downloadUrl: HttpsUrl,
    optionalsInput: M.GetZipDownloadContentOptionalsInput.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("BoxGetZipDownloadContentPayload", {
      description: "Payload for zipDownloads.getZipDownloadContent.",
    })
  )
) {}

/**
 * Payload for `zipDownloads.downloadZip`.
 *
 * **Example** (Download zip payload)
 *
 * ```ts
 * import { BoxDownloadZipPayload, ZipDownloadRequest, ZipDownloadRequestItemsField } from "@beep/box"
 *
 * const payload = BoxDownloadZipPayload.make({
 *   requestBody: ZipDownloadRequest.make({
 *     downloadFileName: "case-files.zip",
 *     items: [ZipDownloadRequestItemsField.make({ id: "12345", type: "file" })]
 *   })
 * })
 * console.log(payload.requestBody.items.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDownloadZipPayload extends S.Opaque<BoxDownloadZipPayload, { readonly brand: unique symbol }>()(
  S.Struct({
    optionalsInput: M.DownloadZipOptionalsInput.pipe(S.optionalKey),
    requestBody: M.ZipDownloadRequest,
  }).pipe(
    $I.annoteSchema("BoxDownloadZipPayload", {
      description: "Payload for zipDownloads.downloadZip.",
    })
  )
) {}

/**
 * Hand-written streaming operation groups for the Box SDK.
 *
 * **Example** (Streaming managers keys)
 *
 * ```ts
 * import type { BoxStreamingOperations } from "@beep/box"
 *
 * type StreamingManagers = keyof BoxStreamingOperations
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type BoxStreamingOperations = {
  readonly avatars: {
    readonly createUserAvatar: (payload: BoxCreateUserAvatarPayload) => Effect.Effect<M.UserAvatar, BoxError>;
    readonly getUserAvatar: (payload: BoxGetUserAvatarPayload) => BoxByteStream;
  };
  readonly chunkedUploads: {
    readonly reducer: (payload: BoxChunkedUploadReducerPayload) => Effect.Effect<BoxPartAccumulator, BoxError>;
    readonly uploadBigFile: (payload: BoxUploadBigFilePayload) => Effect.Effect<M.FileFull, BoxError>;
    readonly uploadFilePart: (payload: BoxUploadFilePartPayload) => Effect.Effect<M.UploadedPart, BoxError>;
    readonly uploadFilePartByUrl: (payload: BoxUploadFilePartByUrlPayload) => Effect.Effect<M.UploadedPart, BoxError>;
  };
  readonly downloads: {
    readonly downloadFile: (payload: BoxDownloadFilePayload) => BoxByteStream;
  };
  readonly events: {
    readonly getEventStream: (payload: BoxGetEventStreamPayload) => Stream.Stream<M.Event, BoxError>;
  };
  readonly files: {
    readonly getFileThumbnailById: (payload: BoxGetFileThumbnailByIdPayload) => BoxByteStream;
  };
  readonly uploads: {
    readonly uploadFile: (payload: BoxUploadFilePayload) => Effect.Effect<M.Files, BoxError>;
    readonly uploadFileVersion: (payload: BoxUploadFileVersionPayload) => Effect.Effect<M.Files, BoxError>;
    readonly uploadWithPreflightCheck: (
      payload: BoxUploadWithPreflightCheckPayload
    ) => Effect.Effect<M.Files, BoxError>;
  };
  readonly zipDownloads: {
    readonly downloadZip: (payload: BoxDownloadZipPayload) => BoxByteStream;
    readonly getZipDownloadContent: (payload: BoxGetZipDownloadContentPayload) => BoxByteStream;
  };
};

const readProperty = (value: unknown, key: PropertyKey): unknown =>
  P.isObject(value)
    ? Result.getOrElse(
        Result.try(() => Reflect.get(value, key)),
        () => undefined
      )
    : undefined;

const sdkShapeFailure = (manager: string, method: string): Readonly<Record<string, string>> => ({
  _tag: "BoxSdkShapeError",
  manager,
  method,
});

const invokeSdkPromise = (
  client: unknown,
  manager: string,
  method: string,
  methodName: BoxMethodName,
  args: ReadonlyArray<unknown>
): Effect.Effect<unknown, BoxError> =>
  Effect.tryPromise({
    catch: (cause) => BoxError.fromUnknown(methodName, cause),
    try: () => {
      const managerValue = readProperty(client, manager);
      const methodValue = readProperty(managerValue, method);

      if (!P.isFunction(methodValue)) {
        return Promise.reject(sdkShapeFailure(manager, method));
      }

      const result = Result.try(() => Reflect.apply(methodValue, managerValue, args));
      return Result.match(result, {
        onFailure: (cause) => Promise.reject(cause),
        onSuccess: (value) => Promise.resolve(value),
      });
    },
  });

const invokeSdkSync = (
  client: unknown,
  manager: string,
  method: string,
  methodName: BoxMethodName,
  args: ReadonlyArray<unknown>
): Effect.Effect<unknown, BoxError> => {
  const managerValue = readProperty(client, manager);
  const methodValue = readProperty(managerValue, method);

  if (!P.isFunction(methodValue)) {
    return Effect.fail(BoxError.fromUnknown(methodName, sdkShapeFailure(manager, method)));
  }

  return Effect.try({
    catch: (cause) => BoxError.fromUnknown(methodName, cause),
    try: () => Reflect.apply(methodValue, managerValue, args),
  });
};

const combineCancellationToken = (callerSignal: AbortSignal | undefined, driverSignal: AbortSignal): AbortSignal => {
  if (callerSignal === undefined || callerSignal === driverSignal) {
    return driverSignal;
  }
  return AbortSignal.any([callerSignal, driverSignal]);
};

const readCancellationToken = (value: unknown): AbortSignal | undefined => {
  const token = readProperty(value, "cancellationToken");
  return token instanceof AbortSignal ? token : undefined;
};

const mergeCancellation = <A>(
  input: A | undefined,
  signal: AbortSignal
): A | { readonly cancellationToken: AbortSignal } => {
  const cancellationToken = combineCancellationToken(readCancellationToken(input), signal);
  if (P.isObject(input)) {
    return { ...input, cancellationToken };
  }
  return { cancellationToken };
};

/**
 * Fail-closed DNS resolver injected into the SSRF guard so a by-URL target whose
 * hostname resolves to internal space is rejected before the SDK connects. Uses
 * the OS resolver (`getaddrinfo` via `dns.lookup`) to match what the SDK's own
 * connection will resolve. A resolution failure surfaces a `BlockedHostError` so
 * the guard never proceeds on a name it could not evaluate.
 */
const resolveRemoteHost = (hostname: string): Effect.Effect<ReadonlyArray<string>, BlockedHostError> =>
  Effect.tryPromise({
    catch: (cause) =>
      BlockedHostError.make({
        cause: O.some(cause),
        host: hostname,
        message: `Refusing to reach ${hostname}: DNS resolution failed`,
        url: O.none(),
      }),
    try: () => NodeDns.promises.lookup(hostname, { all: true }),
  }).pipe(Effect.map((records) => A.map(records, (record) => record.address)));

/**
 * Fail-closed SSRF guard for caller-supplied Box by-URL parameters.
 *
 * The `chunkedUploads.uploadFilePartByUrl` and `zipDownloads.getZipDownloadContent`
 * operations forward a full URL string straight to the Box SDK, turning the
 * driver into an SSRF/readable-SSRF primitive if attacker-influenced. This guard
 * parses the URL and rejects loopback, link-local, RFC1918/ULA private, and
 * cloud-metadata destinations (including IPv4-mapped IPv6 forms) before any
 * outbound request is issued. It additionally resolves the hostname through
 * {@link resolveRemoteHost} and rejects any name that resolves to internal space,
 * translating the typed `BlockedHostError` into a redacted `BoxError` so the
 * failure stays on the driver's `BoxError` channel. The residual DNS-rebinding
 * TOCTOU window (resolve public, connect internal) is documented on the
 * `@beep/schema` `SafeRemoteHost` guard.
 */
const assertBoxUrlAllowed = (method: BoxMethodName, url: string): Effect.Effect<void, BoxError> =>
  assertAllowedRemoteUrl(url, { resolve: resolveRemoteHost }).pipe(
    Effect.mapError((error: BlockedHostError) =>
      BoxError.fromReason(
        "transport",
        BoxErrorOptionsInput.make({
          cause: error.message,
          method,
        })
      )
    )
  );

const byteInputToReadable = (method: BoxMethodName, value: unknown): Effect.Effect<NodeJS.ReadableStream, BoxError> => {
  if (!isBoxByteInputValue(value)) {
    return Effect.fail(
      BoxError.fromReason(
        "stream",
        BoxErrorOptionsInput.make({
          cause: "Expected Uint8Array, Node Readable, or Effect Stream byte input",
          method,
        })
      )
    );
  }
  if (value instanceof Uint8Array) {
    return Stream.make(value).pipe(NodeStream.toReadableNever, Effect.succeed);
  }
  if (Stream.isStream(value)) {
    return value.pipe(NodeStream.toReadableNever, Effect.succeed);
  }
  return Effect.succeed(value);
};

const chunkToBytes =
  (method: BoxMethodName) =>
  (chunk: unknown): Effect.Effect<Uint8Array, BoxError> => {
    if (chunk instanceof Uint8Array) {
      return Effect.succeed(chunk);
    }
    if (P.isString(chunk)) {
      return Effect.succeed(NodeBuffer.Buffer.from(chunk));
    }
    return Effect.fail(
      BoxError.fromReason(
        "stream",
        BoxErrorOptionsInput.make({
          cause: "Box SDK byte stream emitted a non-byte chunk",
          method,
        })
      )
    );
  };

const byteStreamFromSdkValue = (method: BoxMethodName, value: unknown, controller: AbortController): BoxByteStream => {
  const finalizer = Effect.sync(() => {
    controller.abort();
  });

  if (!isNodeReadable(value)) {
    return Stream.fail(
      BoxError.fromReason(
        "stream",
        BoxErrorOptionsInput.make({
          cause: "Box SDK did not return a readable byte stream",
          method,
        })
      )
    ).pipe(Stream.ensuring(finalizer));
  }

  return NodeStream.fromReadable<Uint8Array | string, BoxError>({
    evaluate: () => value,
    onError: (cause) => BoxError.fromUnknown(method, cause),
  }).pipe(Stream.mapEffect(chunkToBytes(method)), Stream.ensuring(finalizer));
};

const runJsonSdkCall = <Payload, Success>(
  methodName: BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  successSchema: S.ConstraintDecoder<Success>,
  payload: unknown,
  invoke: (decoded: Payload, signal: AbortSignal) => Effect.Effect<unknown, BoxError>
): Effect.Effect<Success, BoxError> =>
  acquireSdkCallController({
    methodName,
    payloadSchema,
    payload,
    use: (decoded, controller) =>
      invoke(decoded, controller.signal).pipe(
        Effect.flatMap((result) =>
          decodeWith(successSchema, result, { method: methodName, reason: "response decoding" })
        ),
        Effect.tapError(logDriverFailure("box.streaming_json_failure")),
        Effect.withSpan("Box.streamJson", {
          attributes: {
            "box.method": methodName,
            "box.sdk.version": BOX_SDK_VERSION,
          },
        })
      ),
    release: (controller) => Effect.sync(() => controller.abort()),
  });

const runByteStreamSdkCall = <Payload>(
  methodName: BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  payload: unknown,
  invoke: (decoded: Payload, signal: AbortSignal) => Effect.Effect<unknown, BoxError>
): BoxByteStream =>
  Stream.unwrap(
    acquireSdkCallController({
      methodName,
      payloadSchema,
      payload,
      use: (decoded, controller) =>
        invoke(decoded, controller.signal).pipe(
          Effect.map((result) => byteStreamFromSdkValue(methodName, result, controller)),
          Effect.tapError(logDriverFailure("box.streaming_byte_failure")),
          Effect.withSpan("Box.streamBytes", {
            attributes: {
              "box.method": methodName,
              "box.sdk.version": BOX_SDK_VERSION,
            },
          })
        ),
      release: (controller, exit) => (Exit.isSuccess(exit) ? Effect.void : Effect.sync(() => controller.abort())),
    })
  ).pipe(
    Stream.withSpan(`box.${methodName}.stream`, {
      attributes: {
        "box.method": methodName,
        "box.sdk.version": BOX_SDK_VERSION,
      },
    })
  );

const eventStreamFromSdkValue = (method: BoxMethodName, value: unknown): Stream.Stream<M.Event, BoxError> => {
  if (!isNodeReadable(value)) {
    return Stream.fail(
      BoxError.fromReason(
        "stream",
        BoxErrorOptionsInput.make({
          cause: "Box SDK did not return a readable event stream",
          method,
        })
      )
    );
  }

  return NodeStream.fromReadable<unknown, BoxError>({
    evaluate: () => value,
    onError: (cause) => BoxError.fromUnknown(method, cause),
  }).pipe(
    Stream.mapEffect((payload) => {
      const result = decodeUnknownMEventResult(payload);
      return Result.isSuccess(result)
        ? Effect.succeed(result.success)
        : Effect.fail(
            BoxError.fromReason(
              "response decoding",
              BoxErrorOptionsInput.make({
                cause: result.failure,
                method,
              })
            )
          );
    }),
    Stream.withSpan(`box.${method}.stream`, {
      attributes: {
        "box.method": method,
        "box.sdk.version": BOX_SDK_VERSION,
      },
    })
  );
};

const runEventStreamSdkCall = <Payload>(
  methodName: BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  payload: unknown,
  invoke: (decoded: Payload) => Effect.Effect<unknown, BoxError>
): Stream.Stream<M.Event, BoxError> =>
  Stream.unwrap(
    decodeWith(payloadSchema, payload, { method: methodName, reason: "request encoding" }).pipe(
      Effect.flatMap(invoke),
      Effect.map((value) => eventStreamFromSdkValue(methodName, value)),
      Effect.tapError(logDriverFailure("box.event_stream_failure")),
      Effect.withSpan("Box.streamEvents", {
        attributes: {
          "box.method": methodName,
          "box.sdk.version": BOX_SDK_VERSION,
        },
      })
    )
  );

/**
 * Build hand-written Box byte/event operation groups from a SDK client.
 *
 * **Example** (Build streaming operations)
 *
 * ```ts
 * import {
 *   BoxUploadFilePayload,
 *   makeStreamingOperations,
 *   UploadFileRequestBodyAttributesField,
 *   UploadFileRequestBodyAttributesParentField
 * } from "@beep/box"
 * import * as Effect from "effect/Effect"
 *
 * const operations = makeStreamingOperations({
 *   uploads: {
 *     uploadFile: () => Promise.resolve({ entries: [], totalCount: 1 })
 *   }
 * })
 *
 * const program = operations.uploads.uploadFile(BoxUploadFilePayload.make({
 *   requestBody: {
 *     attributes: UploadFileRequestBodyAttributesField.make({
 *       name: "document.txt",
 *       parent: UploadFileRequestBodyAttributesParentField.make({ id: "0" })
 *     }),
 *     file: new Uint8Array([104, 105])
 *   }
 * }))
 *
 * Effect.runPromise(program).then((files) => console.log(files.totalCount))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeStreamingOperations = (client: unknown): BoxStreamingOperations => ({
  avatars: {
    createUserAvatar: (payload) =>
      runJsonSdkCall("avatars.createUserAvatar", BoxCreateUserAvatarPayload, M.UserAvatar, payload, (decoded, signal) =>
        byteInputToReadable("avatars.createUserAvatar", decoded.requestBody.pic).pipe(
          Effect.flatMap((pic) =>
            invokeSdkPromise(client, "avatars", "createUserAvatar", "avatars.createUserAvatar", [
              decoded.userId,
              { ...decoded.requestBody, pic },
              mergeCancellation(decoded.optionalsInput, signal),
            ])
          )
        )
      ),
    getUserAvatar: (payload) =>
      runByteStreamSdkCall("avatars.getUserAvatar", BoxGetUserAvatarPayload, payload, (decoded, signal) =>
        invokeSdkPromise(client, "avatars", "getUserAvatar", "avatars.getUserAvatar", [
          decoded.userId,
          mergeCancellation(decoded.optionalsInput, signal),
        ])
      ),
  },
  chunkedUploads: {
    reducer: (payload) =>
      runJsonSdkCall("chunkedUploads.reducer", BoxChunkedUploadReducerPayload, BoxPartAccumulator, payload, (decoded) =>
        byteInputToReadable("chunkedUploads.reducer", decoded.chunk).pipe(
          Effect.flatMap((chunk) =>
            invokeSdkPromise(client, "chunkedUploads", "reducer", "chunkedUploads.reducer", [decoded.acc, chunk])
          )
        )
      ),
    uploadBigFile: (payload) =>
      runJsonSdkCall("chunkedUploads.uploadBigFile", BoxUploadBigFilePayload, M.FileFull, payload, (decoded, signal) =>
        byteInputToReadable("chunkedUploads.uploadBigFile", decoded.file).pipe(
          Effect.flatMap((file) =>
            invokeSdkPromise(client, "chunkedUploads", "uploadBigFile", "chunkedUploads.uploadBigFile", [
              file,
              decoded.fileName,
              decoded.fileSize,
              decoded.parentFolderId,
              signal,
            ])
          )
        )
      ),
    uploadFilePart: (payload) =>
      runJsonSdkCall(
        "chunkedUploads.uploadFilePart",
        BoxUploadFilePartPayload,
        M.UploadedPart,
        payload,
        (decoded, signal) =>
          byteInputToReadable("chunkedUploads.uploadFilePart", decoded.requestBody).pipe(
            Effect.flatMap((requestBody) =>
              invokeSdkPromise(client, "chunkedUploads", "uploadFilePart", "chunkedUploads.uploadFilePart", [
                decoded.uploadSessionId,
                requestBody,
                decoded.headersInput,
                mergeCancellation(decoded.optionalsInput, signal),
              ])
            )
          )
      ),
    uploadFilePartByUrl: (payload) =>
      runJsonSdkCall(
        "chunkedUploads.uploadFilePartByUrl",
        BoxUploadFilePartByUrlPayload,
        M.UploadedPart,
        payload,
        (decoded, signal) =>
          assertBoxUrlAllowed("chunkedUploads.uploadFilePartByUrl", decoded.url).pipe(
            Effect.andThen(byteInputToReadable("chunkedUploads.uploadFilePartByUrl", decoded.requestBody)),
            Effect.flatMap((requestBody) =>
              invokeSdkPromise(client, "chunkedUploads", "uploadFilePartByUrl", "chunkedUploads.uploadFilePartByUrl", [
                decoded.url,
                requestBody,
                decoded.headersInput,
                mergeCancellation(decoded.optionalsInput, signal),
              ])
            )
          )
      ),
  },
  downloads: {
    downloadFile: (payload) =>
      runByteStreamSdkCall("downloads.downloadFile", BoxDownloadFilePayload, payload, (decoded, signal) =>
        invokeSdkPromise(client, "downloads", "downloadFile", "downloads.downloadFile", [
          decoded.fileId,
          mergeCancellation(decoded.optionalsInput, signal),
        ])
      ),
  },
  events: {
    getEventStream: (payload) =>
      runEventStreamSdkCall("events.getEventStream", BoxGetEventStreamPayload, payload, (decoded) =>
        invokeSdkSync(client, "events", "getEventStream", "events.getEventStream", [
          decoded.queryParams,
          decoded.headersInput,
        ])
      ),
  },
  files: {
    getFileThumbnailById: (payload) =>
      runByteStreamSdkCall("files.getFileThumbnailById", BoxGetFileThumbnailByIdPayload, payload, (decoded, signal) =>
        invokeSdkPromise(client, "files", "getFileThumbnailById", "files.getFileThumbnailById", [
          decoded.fileId,
          decoded.extension,
          mergeCancellation(decoded.optionalsInput, signal),
        ])
      ),
  },
  uploads: {
    uploadFile: (payload) =>
      runJsonSdkCall("uploads.uploadFile", BoxUploadFilePayload, M.Files, payload, (decoded, signal) =>
        byteInputToReadable("uploads.uploadFile", decoded.requestBody.file).pipe(
          Effect.flatMap((file) =>
            invokeSdkPromise(client, "uploads", "uploadFile", "uploads.uploadFile", [
              { ...decoded.requestBody, file },
              mergeCancellation(decoded.optionalsInput, signal),
            ])
          )
        )
      ),
    uploadFileVersion: (payload) =>
      runJsonSdkCall("uploads.uploadFileVersion", BoxUploadFileVersionPayload, M.Files, payload, (decoded, signal) =>
        byteInputToReadable("uploads.uploadFileVersion", decoded.requestBody.file).pipe(
          Effect.flatMap((file) =>
            invokeSdkPromise(client, "uploads", "uploadFileVersion", "uploads.uploadFileVersion", [
              decoded.fileId,
              { ...decoded.requestBody, file },
              mergeCancellation(decoded.optionalsInput, signal),
            ])
          )
        )
      ),
    uploadWithPreflightCheck: (payload) =>
      runJsonSdkCall(
        "uploads.uploadWithPreflightCheck",
        BoxUploadWithPreflightCheckPayload,
        M.Files,
        payload,
        (decoded, signal) =>
          byteInputToReadable("uploads.uploadWithPreflightCheck", decoded.requestBody.file).pipe(
            Effect.flatMap((file) =>
              invokeSdkPromise(client, "uploads", "uploadWithPreflightCheck", "uploads.uploadWithPreflightCheck", [
                { ...decoded.requestBody, file },
                mergeCancellation(decoded.optionalsInput, signal),
              ])
            )
          )
      ),
  },
  zipDownloads: {
    downloadZip: (payload) =>
      runByteStreamSdkCall("zipDownloads.downloadZip", BoxDownloadZipPayload, payload, (decoded, signal) =>
        invokeSdkPromise(client, "zipDownloads", "downloadZip", "zipDownloads.downloadZip", [
          decoded.requestBody,
          mergeCancellation(decoded.optionalsInput, signal),
        ])
      ),
    getZipDownloadContent: (payload) =>
      runByteStreamSdkCall(
        "zipDownloads.getZipDownloadContent",
        BoxGetZipDownloadContentPayload,
        payload,
        (decoded, signal) =>
          assertBoxUrlAllowed("zipDownloads.getZipDownloadContent", decoded.downloadUrl).pipe(
            Effect.andThen(
              invokeSdkPromise(client, "zipDownloads", "getZipDownloadContent", "zipDownloads.getZipDownloadContent", [
                decoded.downloadUrl,
                mergeCancellation(decoded.optionalsInput, signal),
              ])
            )
          )
      ),
  },
});
