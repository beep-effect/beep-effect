import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import { BlobTransferError } from "../BlobTransfer.ts";
import type { DataBlobTransfer, FileBlobTransfer } from "../BlobTransfer.ts";

// The one module in the package that imports `@azure/storage-blob`. The cache,
// artifact and blob-store protocols hand back signed Azure URLs, so the three
// services that speak them (`ActionCache`, `Artifact` and
// `BlobStore.githubCache`) reach this module and nothing else does:
// `test/reachability.test.ts` pins both halves of that confinement, so a
// consumer that imports only `ActionOutputs` can never link a blob client.

/**
 * File transfers against a signed blob URL, with the block size and
 * concurrency `actions/cache` itself uses: a multi-gigabyte toolchain cache is
 * the normal case, not the exceptional one.
 *
 * **Example** (Reference the file transfer)
 *
 * ```ts
 * import { azureFileTransfer } from "@beep/github-actions/internal/azureBlob";
 *
 * console.log(typeof azureFileTransfer.uploadFile) // function
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const azureFileTransfer: FileBlobTransfer = {
  uploadFile: dual(
    2,
    (url: string, file: string): Effect.Effect<void, BlobTransferError> =>
      Effect.tryPromise({
        try: () =>
          new BlockBlobClient(url).uploadFile(file, {
            blockSize: 64 * 1024 * 1024,
            concurrency: 8,
            maxSingleShotSize: 128 * 1024 * 1024,
          }),
        catch: (cause) => BlobTransferError.make({ reason: "uploadFailed", cause }),
      }).pipe(Effect.asVoid)
  ),
  downloadToFile: dual(
    2,
    (url: string, file: string): Effect.Effect<void, BlobTransferError> =>
      Effect.tryPromise({
        try: () => new BlobClient(url).downloadToFile(file),
        catch: (cause) => BlobTransferError.make({ reason: "downloadFailed", cause }),
      }).pipe(Effect.asVoid)
  ),
};

/**
 * In-memory transfers against a signed blob URL, for payloads small enough to
 * hold whole: the blob store's framed envelopes.
 *
 * **Example** (Reference the data transfer)
 *
 * ```ts
 * import { azureDataTransfer } from "@beep/github-actions/internal/azureBlob";
 *
 * console.log(typeof azureDataTransfer.downloadToBuffer) // function
 * ```
 *
 * @internal
 * @category layers
 * @since 0.0.0
 */
export const azureDataTransfer: DataBlobTransfer = {
  uploadData: dual(
    2,
    (url: string, data: Uint8Array): Effect.Effect<void, BlobTransferError> =>
      Effect.tryPromise({
        try: () => new BlockBlobClient(url).uploadData(data),
        catch: (cause) => BlobTransferError.make({ reason: "uploadFailed", cause }),
      }).pipe(Effect.asVoid)
  ),
  downloadToBuffer: (url) =>
    Effect.tryPromise({
      try: () => new BlobClient(url).downloadToBuffer(),
      catch: (cause) => BlobTransferError.make({ reason: "downloadFailed", cause }),
    }).pipe(Effect.map((buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))),
};
