/**
 * The document store port over the `@beep/box` driver: one create-only upload
 * call per file, metered.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Box } from "@beep/box";
import { DocumentFileId } from "@beep/law-practice-domain/values/MailTagging";
import { DocumentStore, DocumentStoreShape, MailTaggingPortError } from "@beep/law-practice-use-cases/MailTagging";
import * as O from "@beep/utils/Option";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProviderCallMeter, ProviderCalls } from "./MailTagging.metering.ts";
import type { BoxError, BoxUploadFilePayload, Files } from "@beep/box";
import type { UploadDocumentRequest } from "@beep/law-practice-use-cases/MailTagging";

const tooManyRequests = 429;
const nameConflict = 409;
// Box names its rate and storage refusals `rate_limit_exceeded`, `storage_limit_exceeded`, and the like.
const quotaCodePattern = /limit|quota/u;

const oneUploadCall = ProviderCalls.make({ provider: "box", calls: 1 });
const decodeFileId = S.decodeUnknownOption(DocumentFileId);

const statusText = (error: BoxError): string =>
  O.match(error.status, {
    onNone: () => error.reason,
    onSome: (status) => `${error.reason} ${status}`,
  });

const hasStatus = (error: BoxError, status: number): boolean => O.exists(error.status, (actual) => actual === status);

const isThrottled = (error: BoxError): boolean =>
  hasStatus(error, tooManyRequests) || O.isSome(O.flatMap(error.code, Str.match(quotaCodePattern)));

// Status and reason only: a Box error never carries a file name, and neither does this.
const portFailure = (error: BoxError): MailTaggingPortError =>
  isThrottled(error)
    ? MailTaggingPortError.throttled("DocumentStore", "upload", statusText(error))
    : hasStatus(error, nameConflict)
      ? MailTaggingPortError.conflict("DocumentStore", "upload", statusText(error))
      : MailTaggingPortError.during("DocumentStore", "upload", statusText(error));

const payloadOf = (request: UploadDocumentRequest): BoxUploadFilePayload => ({
  requestBody: {
    attributes: { name: request.fileName, parent: { id: request.folderId } },
    file: request.bytes,
    fileFileName: request.fileName,
    ...O.getSomesStruct({ fileContentType: request.contentType }),
  },
});

const fileIdOf = (files: Files): Effect.Effect<DocumentFileId, MailTaggingPortError> =>
  pipe(
    O.fromUndefinedOr(files.entries),
    O.flatMap(A.head),
    O.flatMap((file) => decodeFileId(file.id)),
    Effect.fromOption,
    Effect.mapError(() => MailTaggingPortError.during("DocumentStore", "upload", "upload answered without a file id"))
  );

const makeDocumentStore = Effect.gen(function* () {
  const box = yield* Box;
  const meter = yield* ProviderCallMeter;

  return DocumentStoreShape.make({
    upload: Effect.fn("DocumentStoreBox.upload")(function* (request: UploadDocumentRequest) {
      yield* meter.record(oneUploadCall);
      const files = yield* Effect.mapError(box.uploads.uploadFile(payloadOf(request)), portFailure);
      return yield* fileIdOf(files);
    }),
  });
});

/**
 * Layer providing the document store over `@beep/box` `uploads.uploadFile`.
 *
 * **Details**
 *
 * An upload is exactly one driver call: parent folder id, file name, content
 * type when known, and the bytes. There is no listing, no preflight, and no
 * version upload, so an existing file is never replaced. The call is reported
 * to the {@link ProviderCallMeter} before it is made, so a refused call is
 * counted too.
 *
 * A 409 is a `conflict` port failure: the name exists and nothing was
 * written. A 429, or a Box error code that names a limit or a quota, is a
 * `throttled` port failure, which ends the run. Any other driver failure is
 * an `unavailable` port failure. The reason carries the driver's reason and
 * HTTP status only.
 *
 * **Example** (Wire the store over Box and an unmetered meter)
 *
 * ```ts
 * import { DocumentStoreBox, ProviderCallMeter } from "@beep/law-practice-server/MailTagging"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const Store = DocumentStoreBox.pipe(
 *   Layer.provide(Layer.succeed(ProviderCallMeter, ProviderCallMeter.of({ record: () => Effect.void })))
 * )
 * console.log(Layer.isLayer(Store)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentStoreBox: Layer.Layer<DocumentStore, never, Box | ProviderCallMeter> = Layer.effect(
  DocumentStore,
  makeDocumentStore
);
