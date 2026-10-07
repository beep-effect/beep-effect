/**
 * Retained provider event decoding without altering original bytes.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect } from "effect";
import * as A from "effect/Array";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { decodeProviderEvents } from "./Library.provenance.ts";
import type { LibraryArtifact } from "./Library.schemas.ts";

/**
 * Decode retained JSON or NDJSON provider events sequentially, preserving an original BOM for the decoder.
 * **Example** (Prepare retained event reading)
 * ```ts
 * import { readLibraryProviderEvents } from "@beep/repo-cli/test/ResearchLibrary"
 * import { Effect } from "effect"
 * console.log(Effect.isEffect(readLibraryProviderEvents("/library", []))) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const readLibraryProviderEvents = Effect.fn("Library.readProviderEvents")(function* (
  root: string,
  artifacts: ReadonlyArray<LibraryArtifact>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const events = yield* Effect.forEach(
    artifacts,
    (artifact) =>
      fs.readFile(path.join(root, artifact.path)).pipe(
        Effect.map((bytes) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)),
        Effect.flatMap(decodeProviderEvents)
      ),
    { concurrency: 1 }
  );
  return A.flatten(events);
});
