/**
 * Hand-written byte and event stream adapters for the Box Node SDK.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Buffer } from "node:buffer";
import * as dns from "node:dns";
import { Readable } from "node:stream";
import { $BoxId } from "@beep/identity";
import { assertAllowedRemoteUrl, BlockedHostError, HttpsUrl, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Cause, Effect, Exit, Queue, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as M from "./_generated/Box.models.gen.ts";
import { BoxError } from "./Box.errors.ts";
import { BOX_SDK_VERSION } from "./internal/Box.constants.ts";
import { decodeWith, logDriverFailure } from "./internal/Box.runtime.ts";
import type { BoxMethodName } from "./_generated/Box.models.gen.ts";

const $I = $BoxId.create("Box.streaming");

const BoxByteEffectStream = S.declare<Stream.Stream<Uint8Array, BoxError, never>>(
  (value): value is Stream.Stream<Uint8Array, BoxError, never> => Stream.isStream(value),
  $I.annote("BoxByteEffectStream", {
    description: "Effect Stream byte input accepted by Box upload adapters.",
  })
);

const BoxByteInputValue = S.Union([
  S.Uint8Array,
  S.instanceOf(
    Readable,
    $I.annote("BoxReadableInput", {
      description: "Node readable byte input accepted by Box upload adapters.",
    })
  ),
  BoxByteEffectStream,
]).pipe(
  $I.annoteSchema("BoxByteInput", {
    description: "Byte input accepted by Box upload adapters.",
  }),
  SchemaUtils.withCodecStatics
);

const LastPartIndex = S.Int.check(
  S.isGreaterThanOrEqualTo(-1, {
    identifier: $I`LastPartIndexMinimumCheck`,
    title: "Last part index minimum",
    description: "Chunked upload part indexes use -1 as the pre-upload sentinel and non-negative values thereafter.",
    message: "Expected an upload part index greater than or equal to -1",
  })
).pipe(
  $I.annoteSchema("LastPartIndex", {
    description: "Chunked upload part index, with -1 representing the pre-upload sentinel.",
  })
);

/**
 * Byte input accepted by Box upload adapters.
 *
 * @example
 * ```ts
 * import { Stream } from "effect"
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
 * @example
 * ```ts
 * import { Stream } from "effect"
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
 * @example
 * ```ts
 * import { BoxPartAccumulator } from "@beep/box"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const accumulator = BoxPartAccumulator.make({
 *   fileHash: "sha1-empty",
 *   fileSize: NonNegativeInt.make(0),
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
export class BoxPartAccumulator extends S.Class<BoxPartAccumulator>($I`BoxPartAccumulator`)(
  {
    fileHash: S.Unknown,
    fileSize: NonNegativeInt,
    lastIndex: LastPartIndex,
    parts: M.UploadPart.pipe(S.Array),
    uploadPartUrl: S.String,
  },
  $I.annote("BoxPartAccumulator", {
    description: "Technical accumulator used by the Box chunked-upload reducer helper.",
  })
) {}

class BoxCreateUserAvatarRequestBody extends S.Class<BoxCreateUserAvatarRequestBody>(
  $I`BoxCreateUserAvatarRequestBody`
)(
  {
    pic: BoxByteInputValue,
    picContentType: S.String.pipe(S.optionalKey),
    picFileName: S.String.pipe(S.optionalKey),
  },
  $I.annote("BoxCreateUserAvatarRequestBody", {
    description: "Create-user-avatar request body with a runtime byte input.",
  })
) {}

class BoxUploadFileVersionRequestBody extends S.Class<BoxUploadFileVersionRequestBody>(
  $I`BoxUploadFileVersionRequestBody`
)(
  {
    attributes: M.UploadFileVersionRequestBodyAttributesField,
    file: BoxByteInputValue,
    fileContentType: S.String.pipe(S.optionalKey),
    fileFileName: S.String.pipe(S.optionalKey),
  },
  $I.annote("BoxUploadFileVersionRequestBody", {
    description: "Upload-file-version request body with a runtime byte input.",
  })
) {}

class BoxUploadFileRequestBody extends S.Class<BoxUploadFileRequestBody>($I`BoxUploadFileRequestBody`)(
  {
    attributes: M.UploadFileRequestBodyAttributesField,
    file: BoxByteInputValue,
    fileContentType: S.String.pipe(S.optionalKey),
    fileFileName: S.String.pipe(S.optionalKey),
  },
  $I.annote("BoxUploadFileRequestBody", {
    description: "Upload-file request body with a runtime byte input.",
  })
) {}

class BoxUploadWithPreflightCheckRequestBody extends S.Class<BoxUploadWithPreflightCheckRequestBody>(
  $I`BoxUploadWithPreflightCheckRequestBody`
)(
  {
    attributes: M.UploadWithPreflightCheckRequestBodyAttributesField,
    file: BoxByteInputValue,
    fileContentType: S.String.pipe(S.optionalKey),
    fileFileName: S.String.pipe(S.optionalKey),
  },
  $I.annote("BoxUploadWithPreflightCheckRequestBody", {
    description: "Upload-with-preflight-check request body with a runtime byte input.",
  })
) {}

/**
 * Payload for `avatars.createUserAvatar`.
 *
 * @example
 * ```ts
 * import type { BoxCreateUserAvatarPayload } from "@beep/box"
 *
 * const payload = {
 *   requestBody: {
 *     pic: new Uint8Array([137, 80, 78, 71]),
 *     picContentType: "image/png",
 *     picFileName: "avatar.png"
 *   },
 *   userId: "12345"
 * } satisfies BoxCreateUserAvatarPayload
 * console.log(payload.requestBody.pic.byteLength)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxCreateUserAvatarPayload extends S.Class<BoxCreateUserAvatarPayload>($I`BoxCreateUserAvatarPayload`)(
  {
    optionalsInput: M.CreateUserAvatarOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxCreateUserAvatarRequestBody,
    userId: S.String,
  },
  $I.annote("BoxCreateUserAvatarPayload", {
    description: "Payload for avatars.createUserAvatar.",
  })
) {}

/**
 * Payload for `avatars.getUserAvatar`.
 *
 * @example
 * ```ts
 * import type { BoxGetUserAvatarPayload } from "@beep/box"
 *
 * const payload: BoxGetUserAvatarPayload = { userId: "12345" }
 * console.log(payload.userId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetUserAvatarPayload extends S.Class<BoxGetUserAvatarPayload>($I`BoxGetUserAvatarPayload`)(
  {
    optionalsInput: M.GetUserAvatarOptionalsInput.pipe(S.optionalKey),
    userId: S.String,
  },
  $I.annote("BoxGetUserAvatarPayload", {
    description: "Payload for avatars.getUserAvatar.",
  })
) {}

/**
 * Payload for `downloads.downloadFile`.
 *
 * @example
 * ```ts
 * import type { BoxDownloadFilePayload } from "@beep/box"
 *
 * const payload: BoxDownloadFilePayload = { fileId: "12345" }
 * console.log(payload.fileId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDownloadFilePayload extends S.Class<BoxDownloadFilePayload>($I`BoxDownloadFilePayload`)(
  {
    fileId: S.String,
    optionalsInput: M.DownloadFileOptionalsInput.pipe(S.optionalKey),
  },
  $I.annote("BoxDownloadFilePayload", {
    description: "Payload for downloads.downloadFile.",
  })
) {}

/**
 * Payload for `files.getFileThumbnailById`.
 *
 * @example
 * ```ts
 * import type { BoxGetFileThumbnailByIdPayload } from "@beep/box"
 *
 * const payload: BoxGetFileThumbnailByIdPayload = { extension: "png", fileId: "12345" }
 * console.log(payload.extension)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetFileThumbnailByIdPayload extends S.Class<BoxGetFileThumbnailByIdPayload>(
  $I`BoxGetFileThumbnailByIdPayload`
)(
  {
    extension: M.GetFileThumbnailByIdExtension,
    fileId: S.String,
    optionalsInput: M.GetFileThumbnailByIdOptionalsInput.pipe(S.optionalKey),
  },
  $I.annote("BoxGetFileThumbnailByIdPayload", {
    description: "Payload for files.getFileThumbnailById.",
  })
) {}

/**
 * Payload for `uploads.uploadFileVersion`.
 *
 * @example
 * ```ts
 * import type { BoxUploadFileVersionPayload } from "@beep/box"
 *
 * const payload = {
 *   fileId: "12345",
 *   requestBody: {
 *     attributes: { name: "document-v2.txt" },
 *     file: new Uint8Array([118, 50]),
 *     fileContentType: "text/plain",
 *     fileFileName: "document-v2.txt"
 *   }
 * } satisfies BoxUploadFileVersionPayload
 * console.log(payload.requestBody.attributes.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFileVersionPayload extends S.Class<BoxUploadFileVersionPayload>($I`BoxUploadFileVersionPayload`)(
  {
    fileId: S.String,
    optionalsInput: M.UploadFileVersionOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxUploadFileVersionRequestBody,
  },
  $I.annote("BoxUploadFileVersionPayload", {
    description: "Payload for uploads.uploadFileVersion.",
  })
) {}

/**
 * Payload for `uploads.uploadFile`.
 *
 * @example
 * ```ts
 * import type { BoxUploadFilePayload } from "@beep/box"
 *
 * const payload = {
 *   requestBody: {
 *     attributes: {
 *       name: "document.txt",
 *       parent: { id: "0" }
 *     },
 *     file: new Uint8Array([104, 105]),
 *     fileContentType: "text/plain",
 *     fileFileName: "document.txt"
 *   }
 * } satisfies BoxUploadFilePayload
 * console.log(payload.requestBody.attributes.parent.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFilePayload extends S.Class<BoxUploadFilePayload>($I`BoxUploadFilePayload`)(
  {
    optionalsInput: M.UploadFileOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxUploadFileRequestBody,
  },
  $I.annote("BoxUploadFilePayload", {
    description: "Payload for uploads.uploadFile.",
  })
) {}

/**
 * Payload for `uploads.uploadWithPreflightCheck`.
 *
 * @example
 * ```ts
 * import type { BoxUploadWithPreflightCheckPayload } from "@beep/box"
 *
 * const payload = {
 *   requestBody: {
 *     attributes: {
 *       name: "document.txt",
 *       parent: { id: "0" },
 *       size: 2
 *     },
 *     file: new Uint8Array([104, 105]),
 *     fileContentType: "text/plain",
 *     fileFileName: "document.txt"
 *   }
 * } satisfies BoxUploadWithPreflightCheckPayload
 * console.log(payload.requestBody.attributes.size)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadWithPreflightCheckPayload extends S.Class<BoxUploadWithPreflightCheckPayload>(
  $I`BoxUploadWithPreflightCheckPayload`
)(
  {
    optionalsInput: M.UploadWithPreflightCheckOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxUploadWithPreflightCheckRequestBody,
  },
  $I.annote("BoxUploadWithPreflightCheckPayload", {
    description: "Payload for uploads.uploadWithPreflightCheck.",
  })
) {}

/**
 * Payload for `chunkedUploads.uploadFilePartByUrl`.
 *
 * @example
 * ```ts
 * import { HttpsUrl } from "@beep/schema"
 * import type { BoxUploadFilePartByUrlPayload } from "@beep/box"
 *
 * const payload = {
 *   headersInput: {
 *     contentRange: "bytes 0-1/2",
 *     digest: "sha=abc123"
 *   },
 *   requestBody: new Uint8Array([104, 105]),
 *   url: HttpsUrl.make("https://upload.box.com/api/2.0/files/upload_sessions/abc/parts")
 * } satisfies BoxUploadFilePartByUrlPayload
 * console.log(new URL(payload.url).hostname)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFilePartByUrlPayload extends S.Class<BoxUploadFilePartByUrlPayload>(
  $I`BoxUploadFilePartByUrlPayload`
)(
  {
    headersInput: M.UploadFilePartByUrlHeadersInput,
    optionalsInput: M.UploadFilePartByUrlOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxByteInputValue,
    url: HttpsUrl,
  },
  $I.annote("BoxUploadFilePartByUrlPayload", {
    description: "Payload for chunkedUploads.uploadFilePartByUrl.",
  })
) {}

/**
 * Payload for `chunkedUploads.uploadFilePart`.
 *
 * @example
 * ```ts
 * import type { BoxUploadFilePartPayload } from "@beep/box"
 *
 * const payload = {
 *   headersInput: {
 *     contentRange: "bytes 0-1/2",
 *     digest: "sha=abc123"
 *   },
 *   requestBody: new Uint8Array([104, 105]),
 *   uploadSessionId: "upload-session-id"
 * } satisfies BoxUploadFilePartPayload
 * console.log(payload.headersInput.contentRange)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadFilePartPayload extends S.Class<BoxUploadFilePartPayload>($I`BoxUploadFilePartPayload`)(
  {
    headersInput: M.UploadFilePartHeadersInput,
    optionalsInput: M.UploadFilePartOptionalsInput.pipe(S.optionalKey),
    requestBody: BoxByteInputValue,
    uploadSessionId: S.String,
  },
  $I.annote("BoxUploadFilePartPayload", {
    description: "Payload for chunkedUploads.uploadFilePart.",
  })
) {}

/**
 * Payload for `chunkedUploads.reducer`.
 *
 * @example
 * ```ts
 * import { BoxPartAccumulator } from "@beep/box"
 * import { NonNegativeInt } from "@beep/schema"
 * import type { BoxChunkedUploadReducerPayload } from "@beep/box"
 *
 * const payload = {
 *   acc: BoxPartAccumulator.make({
 *     fileHash: "sha1-empty",
 *     fileSize: NonNegativeInt.make(2),
 *     lastIndex: -1,
 *     parts: [],
 *     uploadPartUrl: "https://upload.box.com/session"
 *   }),
 *   chunk: new Uint8Array([104, 105])
 * } satisfies BoxChunkedUploadReducerPayload
 * console.log(payload.acc.lastIndex + payload.chunk.byteLength)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxChunkedUploadReducerPayload extends S.Class<BoxChunkedUploadReducerPayload>(
  $I`BoxChunkedUploadReducerPayload`
)(
  {
    acc: BoxPartAccumulator,
    chunk: BoxByteInputValue,
  },
  $I.annote("BoxChunkedUploadReducerPayload", {
    description: "Payload for chunkedUploads.reducer.",
  })
) {}

/**
 * Payload for `chunkedUploads.uploadBigFile`.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import type { BoxUploadBigFilePayload } from "@beep/box"
 *
 * const payload = {
 *   file: new Uint8Array([104, 105]),
 *   fileName: "large-document.txt",
 *   fileSize: NonNegativeInt.make(2),
 *   parentFolderId: "0"
 * } satisfies BoxUploadBigFilePayload
 * console.log(`${payload.fileName}:${payload.fileSize}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUploadBigFilePayload extends S.Class<BoxUploadBigFilePayload>($I`BoxUploadBigFilePayload`)(
  {
    file: BoxByteInputValue,
    fileName: S.String,
    fileSize: NonNegativeInt,
    parentFolderId: S.String,
  },
  $I.annote("BoxUploadBigFilePayload", {
    description: "Payload for chunkedUploads.uploadBigFile.",
  })
) {}

/**
 * Payload for `events.getEventStream`.
 *
 * @example
 * ```ts
 * import type { BoxGetEventStreamPayload } from "@beep/box"
 *
 * const payload: BoxGetEventStreamPayload = {}
 * console.log(payload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetEventStreamPayload extends S.Class<BoxGetEventStreamPayload>($I`BoxGetEventStreamPayload`)(
  {
    headersInput: M.GetEventStreamHeadersInput.pipe(S.optionalKey),
    queryParams: M.GetEventStreamQueryParams.pipe(S.optionalKey),
  },
  $I.annote("BoxGetEventStreamPayload", {
    description: "Payload for events.getEventStream.",
  })
) {}

/**
 * Payload for `zipDownloads.getZipDownloadContent`.
 *
 * @example
 * ```ts
 * import { HttpsUrl } from "@beep/schema"
 * import type { BoxGetZipDownloadContentPayload } from "@beep/box"
 *
 * const payload: BoxGetZipDownloadContentPayload = { downloadUrl: HttpsUrl.make("https://example.com/content") }
 * console.log(payload.downloadUrl)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxGetZipDownloadContentPayload extends S.Class<BoxGetZipDownloadContentPayload>(
  $I`BoxGetZipDownloadContentPayload`
)(
  {
    downloadUrl: HttpsUrl,
    optionalsInput: M.GetZipDownloadContentOptionalsInput.pipe(S.optionalKey),
  },
  $I.annote("BoxGetZipDownloadContentPayload", {
    description: "Payload for zipDownloads.getZipDownloadContent.",
  })
) {}

/**
 * Payload for `zipDownloads.downloadZip`.
 *
 * @example
 * ```ts
 * import type { BoxDownloadZipPayload } from "@beep/box"
 *
 * const payload = {
 *   requestBody: {
 *     downloadFileName: "case-files.zip",
 *     items: [{ id: "12345", type: "file" }]
 *   }
 * } satisfies BoxDownloadZipPayload
 * console.log(payload.requestBody.items.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDownloadZipPayload extends S.Class<BoxDownloadZipPayload>($I`BoxDownloadZipPayload`)(
  {
    optionalsInput: M.DownloadZipOptionalsInput.pipe(S.optionalKey),
    requestBody: M.ZipDownloadRequest,
  },
  $I.annote("BoxDownloadZipPayload", {
    description: "Payload for zipDownloads.downloadZip.",
  })
) {}

/**
 * Hand-written streaming operation groups for the Box SDK.
 *
 * @example
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
    try: () => dns.promises.lookup(hostname, { all: true }),
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
      BoxError.fromReason("transport", {
        cause: error.message,
        method,
      })
    )
  );

const byteInputToReadable = (method: BoxMethodName, value: unknown): Effect.Effect<Readable, BoxError> => {
  if (!BoxByteInputValue.is(value)) {
    return Effect.fail(
      BoxError.fromReason("stream", {
        cause: "Expected Uint8Array, Node Readable, or Effect Stream byte input",
        method,
      })
    );
  }
  if (value instanceof Uint8Array) {
    return Effect.succeed(Readable.from([Buffer.from(value)]));
  }
  if (value instanceof Readable) {
    return Effect.succeed(value);
  }
  return Effect.succeed(Readable.from(Stream.toAsyncIterable(value)));
};

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  P.isObject(value) && P.isFunction(Reflect.get(value, Symbol.asyncIterator));

const destroyReadable = (value: unknown): void => {
  if (value instanceof Readable && !value.destroyed) {
    value.destroy();
  }
};

const chunkToBytes =
  (method: BoxMethodName) =>
  (chunk: unknown): Effect.Effect<Uint8Array, BoxError> => {
    if (chunk instanceof Uint8Array) {
      return Effect.succeed(chunk);
    }
    if (P.isString(chunk)) {
      return Effect.succeed(Buffer.from(chunk));
    }
    return Effect.fail(
      BoxError.fromReason("stream", {
        cause: "Box SDK byte stream emitted a non-byte chunk",
        method,
      })
    );
  };

const byteStreamFromSdkValue = (method: BoxMethodName, value: unknown, controller: AbortController): BoxByteStream => {
  const finalizer = Effect.sync(() => {
    controller.abort();
    destroyReadable(value);
  });

  if (value === undefined) {
    return Stream.fail(
      BoxError.fromReason("stream", {
        cause: "Box SDK did not return a readable byte stream",
        method,
      })
    ).pipe(Stream.ensuring(finalizer));
  }
  if (!isAsyncIterable(value)) {
    return Stream.fail(
      BoxError.fromReason("stream", {
        cause: "Box SDK did not return a readable byte stream",
        method,
      })
    ).pipe(Stream.ensuring(finalizer));
  }

  const sdkStream: Stream.Stream<unknown, BoxError, never> = Stream.fromAsyncIterable(value, (cause) =>
    BoxError.fromUnknown(method, cause)
  );

  return sdkStream.pipe(Stream.mapEffect(chunkToBytes(method)), Stream.ensuring(finalizer));
};

const runJsonSdkCall = <Payload, Success>(
  methodName: BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  successSchema: S.ConstraintDecoder<Success>,
  payload: unknown,
  invoke: (decoded: Payload, signal: AbortSignal) => Effect.Effect<unknown, BoxError>
): Effect.Effect<Success, BoxError> =>
  Effect.acquireUseRelease(
    Effect.sync(() => new AbortController()),
    (controller) =>
      decodeWith(methodName, payloadSchema, payload, "request encoding").pipe(
        Effect.flatMap((decoded) => invoke(decoded, controller.signal)),
        Effect.flatMap((result) => decodeWith(methodName, successSchema, result, "response decoding")),
        Effect.tapError(logDriverFailure("box.streaming_json_failure")),
        Effect.withSpan(`box.${methodName}`, {
          attributes: {
            "box.method": methodName,
            "box.sdk.version": BOX_SDK_VERSION,
          },
        })
      ),
    (controller) => Effect.sync(() => controller.abort())
  );

const runByteStreamSdkCall = <Payload>(
  methodName: BoxMethodName,
  payloadSchema: S.ConstraintDecoder<Payload>,
  payload: unknown,
  invoke: (decoded: Payload, signal: AbortSignal) => Effect.Effect<unknown, BoxError>
): BoxByteStream =>
  Stream.unwrap(
    Effect.acquireUseRelease(
      Effect.sync(() => new AbortController()),
      (controller) =>
        decodeWith(methodName, payloadSchema, payload, "request encoding").pipe(
          Effect.flatMap((decoded) => invoke(decoded, controller.signal)),
          Effect.map((result) => byteStreamFromSdkValue(methodName, result, controller)),
          Effect.tapError(logDriverFailure("box.streaming_byte_failure")),
          Effect.withSpan(`box.${methodName}`, {
            attributes: {
              "box.method": methodName,
              "box.sdk.version": BOX_SDK_VERSION,
            },
          })
        ),
      (controller, exit) => (Exit.isSuccess(exit) ? Effect.void : Effect.sync(() => controller.abort()))
    )
  ).pipe(
    Stream.withSpan(`box.${methodName}.stream`, {
      attributes: {
        "box.method": methodName,
        "box.sdk.version": BOX_SDK_VERSION,
      },
    })
  );

const eventStreamFromSdkValue = (method: BoxMethodName, value: unknown): Stream.Stream<M.Event, BoxError> => {
  if (!(value instanceof Readable)) {
    return Stream.fail(
      BoxError.fromReason("stream", {
        cause: "Box SDK did not return a readable event stream",
        method,
      })
    );
  }

  const readable = value;

  return Stream.callback<M.Event, BoxError>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        let ended = false;

        function removeListeners(): void {
          readable.off("data", onData);
          readable.off("error", onError);
          readable.off("end", onEnd);
          readable.off("close", onEnd);
        }

        function closeReadable(): void {
          removeListeners();
          destroyReadable(readable);
        }

        function fail(error: BoxError): void {
          if (!ended) {
            ended = true;
            closeReadable();
            Queue.failCauseUnsafe(queue, Cause.fail(error));
          }
        }

        function onData(payload: unknown): void {
          if (ended) {
            return;
          }

          const result = S.decodeUnknownResult(M.Event)(payload);
          if (Result.isSuccess(result)) {
            Queue.offerUnsafe(queue, result.success);
            return;
          }

          fail(
            BoxError.fromReason("response decoding", {
              cause: result.failure,
              method,
            })
          );
        }

        function onError(cause: unknown): void {
          fail(BoxError.fromUnknown(method, cause));
        }

        function onEnd(): void {
          if (!ended) {
            ended = true;
            removeListeners();
            Queue.endUnsafe(queue);
          }
        }

        readable.on("data", onData);
        readable.on("error", onError);
        readable.on("end", onEnd);
        readable.on("close", onEnd);

        return closeReadable;
      }),
      (closeReadable) => Effect.sync(closeReadable)
    )
  ).pipe(
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
    decodeWith(methodName, payloadSchema, payload, "request encoding").pipe(
      Effect.flatMap(invoke),
      Effect.map((value) => eventStreamFromSdkValue(methodName, value)),
      Effect.tapError(logDriverFailure("box.event_stream_failure")),
      Effect.withSpan(`box.${methodName}`, {
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
 * @example
 * ```ts
 * import { makeStreamingOperations } from "@beep/box"
 * import { Effect } from "effect"
 *
 * const operations = makeStreamingOperations({
 *   uploads: {
 *     uploadFile: () => Promise.resolve({ entries: [], totalCount: 1 })
 *   }
 * })
 *
 * const program = operations.uploads.uploadFile({
 *   requestBody: {
 *     attributes: {
 *       name: "document.txt",
 *       parent: { id: "0" }
 *     },
 *     file: new Uint8Array([104, 105])
 *   }
 * })
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
