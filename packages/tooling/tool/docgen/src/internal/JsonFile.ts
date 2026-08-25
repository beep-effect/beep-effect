/**
 * Reads JSON documents from disk and decodes them, translating every failure into a `DocgenError`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect, FileSystem } from "effect";
import * as Domain from "../Domain.ts";

/**
 * Reads a JSON file and decodes its text with the supplied decoder.
 *
 * **Details**
 *
 * Read failures and decode failures both surface as `DocgenError` values whose message
 * names the `scope` and the file path, so callers do not repeat that translation.
 *
 * **Example** (Reading a package manifest version)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { readDecodedJsonFile } from "../../src/internal/JsonFile.ts"
 *
 * const decodeVersion = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ version: S.String })))
 *
 * const program = readDecodedJsonFile("Example.readVersion", "package.json", decodeVersion).pipe(
 *   Effect.map((manifest) => manifest.version),
 *   Effect.provide(BunServices.layer)
 * )
 *
 * console.log(typeof program) // "object"
 * ```
 *
 * @category filesystem
 * @since 0.0.0
 */
export const readDecodedJsonFile = Effect.fn("InternalJsonFile.readDecodedJsonFile")(function* <A, E>(
  scope: string,
  filePath: string,
  decode: (content: string) => Effect.Effect<A, E>
) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(filePath).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[${scope}] Failed to read '${filePath}'\n${String(cause)}`,
      })
    )
  );
  return yield* decode(content).pipe(
    Effect.mapError((cause) =>
      Domain.DocgenError.make({
        message: `[${scope}] Failed to decode '${filePath}'\n${String(cause)}`,
      })
    )
  );
});
