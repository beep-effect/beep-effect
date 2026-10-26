/**
 * The blob transfer contracts the archive-backed services upload and download through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubActionsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";

const $I = $GithubActionsId.create("BlobTransfer");

/**
 * Raised when bytes could not be moved to or from a signed blob url.
 *
 * **Example** (Identify a failed upload)
 *
 * ```ts
 * import { BlobTransferError } from "@beep/github-actions/BlobTransfer";
 *
 * const error = BlobTransferError.make({ reason: "uploadFailed" });
 * console.log(error.message) // Could not upload to the signed blob url
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class BlobTransferError extends S.TaggedError<BlobTransferError, { readonly brand: unique symbol }>(
  $I`BlobTransferError`
)(
  "BlobTransferError",
  {
    /** Which direction failed. */
    reason: S.Literals(["uploadFailed", "downloadFailed"]).pipe(
      $I.annoteKey("BlobTransferError.reason", { description: "Which direction failed." })
    ),
    /** The underlying failure, preserved structurally. */
    cause: S.optionalKey(S.Defect()).pipe(
      $I.annoteKey("BlobTransferError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<BlobTransferError>("BlobTransferError", {
    description: "Raised when bytes could not be moved to or from a signed blob url.",
  })
) {
  /**
   * Describes whether uploading or downloading the signed blob failed.
   *
   * **Example** (Describe a failed download)
   *
   * ```ts
   * import { BlobTransferError } from "@beep/github-actions/BlobTransfer";
   *
   * const error = BlobTransferError.make({ reason: "downloadFailed" });
   * console.log(error.message) // Could not download from the signed blob url
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return this.reason === "uploadFailed"
      ? "Could not upload to the signed blob url"
      : "Could not download from the signed blob url";
  }
}

/**
 * Moving whole files to and from the signed blob url a results-backend RPC
 * hands back.
 *
 * **Details**
 *
 * The seam exists because the *protocol* is what this package owns and the
 * *transport* is not: the Actions results backend answers a Twirp RPC with a
 * pre-signed Azure url, and everything interesting — the RPC sequence, the
 * conflict handling, the retry policy, the version hash — happens on this side
 * of it. Taking the transport as an argument means all of that is exercised by
 * a test rather than described by one, and the Azure client stays confined to
 * the three modules permitted to import it.
 *
 * A url is a plain string on purpose: it is a **credential** (the signature is
 * in the query), and it is never logged, annotated on a span, or carried on an
 * error.
 *
 * @public
 * @category ports
 * @since 0.0.0
 */
export interface FileBlobTransfer {
  /** Download the url's contents into a file. */
  readonly downloadToFile: {
    (url: string, file: string): Effect.Effect<void, BlobTransferError>;
    (file: string): (url: string) => Effect.Effect<void, BlobTransferError>;
  };
  /** Upload a file's contents to the url. */
  readonly uploadFile: {
    (url: string, file: string): Effect.Effect<void, BlobTransferError>;
    (file: string): (url: string) => Effect.Effect<void, BlobTransferError>;
  };
}

/**
 * Moving in-memory bytes to and from a signed blob url.
 *
 * **Details**
 *
 * The {@link FileBlobTransfer} counterpart for payloads that never touch the
 * filesystem. Split rather than merged because the cache and artifact protocols
 * only ever move files and the blob store only ever moves buffers — a single
 * four-member interface would make every implementation stub two members it can
 * never be asked for.
 *
 * @public
 * @category ports
 * @since 0.0.0
 */
export interface DataBlobTransfer {
  /** Download the url's contents. */
  readonly downloadToBuffer: (url: string) => Effect.Effect<Uint8Array, BlobTransferError>;
  /** Upload bytes to the url. */
  readonly uploadData: {
    (url: string, data: Uint8Array): Effect.Effect<void, BlobTransferError>;
    (data: Uint8Array): (url: string) => Effect.Effect<void, BlobTransferError>;
  };
}
