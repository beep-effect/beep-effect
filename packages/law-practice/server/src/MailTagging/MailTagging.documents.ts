/**
 * The document store port over the `@beep/box` driver: one create-only upload
 * call per file, metered.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Box } from "@beep/box";
import { DocumentFileId } from "@beep/law-practice-domain/values/MailTagging";
import {
  DocumentNameTaken,
  DocumentStore,
  DocumentStoreShape,
  DocumentUploaded,
  MailTaggingPortError,
} from "@beep/law-practice-use-cases/MailTagging";
import * as O from "@beep/utils/Option";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProviderCallMeter, ProviderCalls } from "./MailTagging.metering.ts";
import type { BoxError, BoxUploadFilePayload, Files } from "@beep/box";
import type { DocumentUploadResult, UploadDocumentRequest } from "@beep/law-practice-use-cases/MailTagging";

const tooManyRequests = 429;
const conflictStatus = 409;
const nameInUseCode = "item_name_in_use";
const conflictingFileType = "file";
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

// A 409 is a taken name unless Box names another kind of conflict.
const isNameTaken = (error: BoxError): boolean =>
  hasStatus(error, conflictStatus) && O.getOrElse(error.code, () => nameInUseCode) === nameInUseCode;

/**
 * What a Box name-conflict error says about the file that holds the name.
 *
 * **Details**
 *
 * `byteLength` and `contentSha1` are part of the shape because Box reports
 * them for a file name conflict. The `@beep/box` error keeps only each
 * conflict's `id` and `type`, so both are always none today.
 *
 * @category models
 * @since 0.0.0
 */
export type BoxConflictingFile = {
  readonly fileId: DocumentFileId;
  readonly byteLength: O.Option<number>;
  readonly contentSha1: O.Option<string>;
};

/**
 * Reads the file that holds a taken name out of a Box driver error.
 *
 * **Details**
 *
 * The answer is the first conflict of type `file` in the conflict summary the
 * driver error retains. It is none when the error has no summary, when the
 * summary lists no file, or when the id is not a usable document id. Nothing
 * is looked up and nothing is guessed.
 *
 * **Example** (Read the conflicting file of a 409)
 *
 * ```ts
 * import { BoxApiFailureContext, BoxError } from "@beep/box"
 * import { boxConflictingFile } from "@beep/law-practice-server/MailTagging"
 * import * as O from "effect/Option"
 *
 * const error = BoxError.fromReason("response status", {
 *   status: 409,
 *   context: BoxApiFailureContext.make({ values: { conflictCount: 1, conflicts: [{ id: "8001", type: "file" }] } })
 * })
 * console.log(O.map(boxConflictingFile(error), (file) => file.fileId)) // Option.some("8001")
 * ```
 *
 * @param error - Driver error of a refused upload.
 * @returns The conflicting file, when the error identifies one.
 * @category use-cases
 * @since 0.0.0
 */
export const boxConflictingFile = (error: BoxError): O.Option<BoxConflictingFile> =>
  pipe(
    error.context,
    O.flatMap((context) => A.findFirst(context.values.conflicts, (conflict) => conflict.type === conflictingFileType)),
    O.flatMap((conflict) => decodeFileId(conflict.id)),
    O.map((fileId) => ({ fileId, byteLength: O.none(), contentSha1: O.none() }))
  );

// The one place the conflicting file becomes the port's outcome.
const nameTaken = (error: BoxError): DocumentNameTaken =>
  DocumentNameTaken.make({ existingFileId: O.map(boxConflictingFile(error), (file) => file.fileId) });

const failureKind = (error: BoxError) =>
  hasStatus(error, conflictStatus) ? MailTaggingPortError.conflict : MailTaggingPortError.during;

// Status and reason only: a Box error never carries a file name, and neither does this.
const portFailure = (error: BoxError): MailTaggingPortError =>
  isThrottled(error)
    ? MailTaggingPortError.throttled("DocumentStore", "upload", statusText(error))
    : failureKind(error)("DocumentStore", "upload", statusText(error));

// A taken name is an answer; every other driver failure stays a failure.
const refused = (error: BoxError): Effect.Effect<DocumentUploadResult, MailTaggingPortError> =>
  isNameTaken(error) && !isThrottled(error) ? Effect.succeed(nameTaken(error)) : Effect.fail(portFailure(error));

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
      return yield* box.uploads.uploadFile(payloadOf(request)).pipe(
        Effect.matchEffect({
          onFailure: refused,
          onSuccess: (files) => Effect.map(fileIdOf(files), (fileId) => DocumentUploaded.make({ fileId })),
        })
      );
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
 * A created file answers `DocumentUploaded`. A 409 whose Box error code is
 * `item_name_in_use`, or that carries no code, answers `DocumentNameTaken`:
 * the name exists and nothing was written. Its `existingFileId` is the id of
 * the first `file` conflict the driver's error retains, and none when the
 * driver retained no conflict; the adapter never looks the file up. A 409
 * with any other code is a `conflict` port failure. A 429, or a Box error
 * code that names a limit or a quota, is a `throttled` port failure, which
 * ends the run. Any other driver failure is an `unavailable` port failure.
 * The reason carries the driver's reason and HTTP status only.
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
