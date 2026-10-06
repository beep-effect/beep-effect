import { Sha256Hex } from "@beep/schema";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as Stream from "effect/Stream";

/** Read size used while hashing; memory stays bounded by this regardless of file size. */
const hashChunkBytes = 1024 * 1024;

/** Content identity of one local file computed in a single streaming pass. */
type ContentHashes = {
  /** Lowercase hex SHA-1, the content hash Box reports as a file's `sha1`. */
  readonly sha1: string;
  readonly sha256: Sha256Hex;
  readonly sizeBytes: number;
};

/**
 * Streams one file through SHA-1 and SHA-256 at once.
 *
 * `effect/Crypto` only digests a complete in-memory buffer, which cannot hold a
 * gigabyte-scale source, and the repository's node-builtin gate bars
 * `node:crypto` from typechecked source. The incremental `@noble/hashes`
 * hashers (the same choice as the corpus preservation hasher) are fed from the
 * platform `FileSystem` stream instead, so the file is opened read-only and at
 * most one chunk is resident. SHA-1 is used only because it is the content hash
 * Box reports; it is not a security boundary here.
 */
export const hashFileContent = Effect.fn("BoxContentHash.hashFileContent")(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const sha1Hasher = sha1.create();
  const sha256Hasher = sha256.create();
  let sizeBytes = 0;
  yield* Stream.runForEach(fs.stream(path, { chunkSize: hashChunkBytes }), (chunk) =>
    Effect.sync(() => {
      sha1Hasher.update(chunk);
      sha256Hasher.update(chunk);
      sizeBytes += chunk.byteLength;
    })
  );
  const hashes: ContentHashes = {
    sha1: bytesToHex(sha1Hasher.digest()),
    sha256: Sha256Hex.make(bytesToHex(sha256Hasher.digest())),
    sizeBytes,
  };
  return hashes;
});
