import { Effect } from "effect";
import * as S from "effect/Schema";
import type { FileSystem } from "effect";

/**
 * Schema-encode a canary artifact and write its newline-terminated JSON form.
 *
 * **Details**
 *
 * Callers provide stage-specific typed failures for encoding and filesystem
 * errors so C0, C1, and later stages share the I/O mechanism without erasing
 * their public error contracts.
 *
 * **Example** (Build a typed artifact write)
 *
 * ```ts
 * import { writeJsonArtifact } from "@/canary/Artifact"
 * import { Effect, FileSystem } from "effect"
 * import * as S from "effect/Schema"
 *
 * const ReportJson = S.fromJsonString(S.Struct({ count: S.Number }))
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   yield* writeJsonArtifact(fs, ReportJson, "report.json", { count: 1 }, {
 *     encode: new Error("encode failed"),
 *     write: new Error("write failed")
 *   })
 * })
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const writeJsonArtifact = Effect.fn("SemanticaCanary.writeJsonArtifact")(function* <Type, Encoded, E>(
  fs: FileSystem.FileSystem,
  schema: S.Codec<Type, Encoded>,
  outputPath: string,
  value: Type,
  failure: { readonly encode: E; readonly write: E }
) {
  const json = yield* S.encodeEffect(schema)(value).pipe(Effect.mapError(() => failure.encode));
  yield* fs.writeFileString(outputPath, `${json}\n`).pipe(Effect.mapError(() => failure.write));
});
