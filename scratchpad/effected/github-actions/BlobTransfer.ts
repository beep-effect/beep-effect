import type { Effect } from "effect";
import { Schema } from "effect";

/**
 * Raised when bytes could not be moved to or from a signed blob url.
 *
 * @public
 */
export class BlobTransferError extends Schema.TaggedError<BlobTransferError>()("BlobTransferError", {
	/** Which direction failed. */
	reason: Schema.Literals(["uploadFailed", "downloadFailed"]),
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
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
 * @remarks
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
 */
export interface FileBlobTransfer {
	/** Upload a file's contents to the url. */
	readonly uploadFile: (url: string, file: string) => Effect.Effect<void, BlobTransferError>;
	/** Download the url's contents into a file. */
	readonly downloadToFile: (url: string, file: string) => Effect.Effect<void, BlobTransferError>;
}

/**
 * Moving in-memory bytes to and from a signed blob url.
 *
 * @remarks
 * The {@link FileBlobTransfer} counterpart for payloads that never touch the
 * filesystem. Split rather than merged because the cache and artifact protocols
 * only ever move files and the blob store only ever moves buffers — a single
 * four-member interface would make every implementation stub two members it can
 * never be asked for.
 *
 * @public
 */
export interface DataBlobTransfer {
	/** Upload bytes to the url. */
	readonly uploadData: (url: string, data: Uint8Array) => Effect.Effect<void, BlobTransferError>;
	/** Download the url's contents. */
	readonly downloadToBuffer: (url: string) => Effect.Effect<Uint8Array, BlobTransferError>;
}
