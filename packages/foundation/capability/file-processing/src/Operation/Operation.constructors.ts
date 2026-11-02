/**
 * Operation constructors for runtime-neutral file processing engines.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PosixPath } from "@beep/schema/PosixPath";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { deriveArtifactId } from "../Artifact/Artifact.constructors.ts";
import { FileProcessingOperationError } from "./Operation.errors.ts";
import type { ExportArchiveOperation } from "./Operation.schema.ts";

const decodePosixPath = S.decodeEffect(PosixPath);

/**
 * Decode an archive child's relative path and derive its artifact id from the
 * archive source id, mapping either failure to `archive-export-failed`.
 *
 * **Details**
 *
 * Failure messages start with `subject`, as in
 * "libpff child artifact path was not POSIX-normalized." or
 * "libpff child artifact id could not be derived.". `engine`, when given, is
 * copied onto the operation error.
 *
 * **Example** (Derive an archive child artifact)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { deriveArchiveChildArtifact, ExportArchiveOperation } from "@beep/file-processing/Operation"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const operation = yield* S.decodeUnknownEffect(ExportArchiveOperation)({
 *     format: "pst",
 *     operationId: "operation:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *     operationKind: "export-archive",
 *     preference: { engine: "libpff" },
 *     source: {
 *       digest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *       extension: "pst",
 *       id: "artifact:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *       locator: { kind: "synthetic", value: "mailbox.pst" },
 *       name: "mailbox.pst",
 *       relativePath: "mailbox.pst",
 *       sizeBytes: 128
 *     }
 *   })
 *   const child = yield* deriveArchiveChildArtifact(operation, "children/message.txt", { subject: "Example" })
 *   return child.relativePath
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunCrypto.layer))).then(console.log) // "children/message.txt"
 * ```
 *
 * @effects Requires `Digest.Digest` to hash the child id parts.
 * @category constructors
 * @since 0.0.0
 */
export const deriveArchiveChildArtifact = Effect.fn("Operation.deriveArchiveChildArtifact")(function* (
  operation: ExportArchiveOperation,
  path: string,
  options: { readonly subject: string; readonly engine?: string }
) {
  const { subject, ...engine } = options;
  const failure = (problem: string) => () =>
    FileProcessingOperationError.fromReason("archive-export-failed", {
      artifactId: operation.source.id,
      ...engine,
      format: operation.format,
      message: `${subject} child artifact ${problem}.`,
      operationId: operation.operationId,
    });
  const relativePath = yield* decodePosixPath(path).pipe(Effect.mapError(failure("path was not POSIX-normalized")));
  const id = yield* deriveArtifactId([operation.source.id, relativePath]).pipe(
    Effect.mapError(failure("id could not be derived"))
  );
  return { id, relativePath };
});
