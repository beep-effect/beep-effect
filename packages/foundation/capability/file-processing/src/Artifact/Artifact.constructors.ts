/**
 * Artifact constructors for runtime-neutral file processing operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256HexFromBytes } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { ArtifactId } from "./Artifact.schema.ts";
import type * as Crypto from "effect/Crypto";

const deriveArtifactIdDigest = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeDerivedArtifactId = S.decodeUnknownEffect(ArtifactId);
const artifactIdTextEncoder = new TextEncoder();

/**
 * Derive a stable artifact identifier from deterministic artifact parts.
 *
 * **Example** (Derive id from artifact parts)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { deriveArtifactId } from "@beep/file-processing/Artifact"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* deriveArtifactId(["artifact:parent", "children/message.txt"])
 *   return id.startsWith("artifact:")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then((valid) => console.log(valid)) // true
 * ```
 *
 * @effects Requires `Crypto.Crypto` to hash the joined artifact parts and may fail with `SchemaError` when the derived identifier cannot be decoded.
 * @category constructors
 * @since 0.0.0
 */
export const deriveArtifactId = Effect.fn("Artifact.deriveArtifactId")(function* (
  parts: ReadonlyArray<string>
): Effect.fn.Return<ArtifactId, S.SchemaError, Crypto.Crypto> {
  const digest = yield* deriveArtifactIdDigest(artifactIdTextEncoder.encode(A.join("\x1f")(parts)));
  return yield* decodeDerivedArtifactId(`artifact:${digest}`);
});
