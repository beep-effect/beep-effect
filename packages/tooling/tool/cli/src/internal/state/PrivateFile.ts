/**
 * Owner-only atomic file writes for workstation state.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Random from "effect/Random";

/**
 * Write a file only its owner can read: the directory is created (or
 * narrowed to) `0700`, the text goes to a uniquely named `0600` temporary
 * file beside the target, and a rename puts it in place.
 *
 * **Details**
 *
 * A reader sees the old file or the new one, never a torn write; a failed
 * write removes its temporary file.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { writePrivateFile } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(writePrivateFile("/state/palantiri/hot.json", "{}"))) // true
 * ```
 *
 * @param file - Absolute path of the file to replace.
 * @param text - The file's new contents.
 * @returns An effect that writes the file.
 * @category utilities
 * @since 0.0.0
 */
export const writePrivateFile = Effect.fn("StateFile.writePrivate")(function* (file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.dirname(file);
  yield* fs.makeDirectory(dir, { recursive: true, mode: 0o700 });
  yield* fs.chmod(dir, 0o700);
  const temporary = `${file}.${yield* Random.nextIntBetween(0, 2_147_483_647)}.tmp`;
  yield* Effect.gen(function* () {
    yield* fs.writeFileString(temporary, text, { mode: 0o600 });
    yield* fs.chmod(temporary, 0o600);
    yield* fs.rename(temporary, file);
  }).pipe(Effect.onError(() => fs.remove(temporary).pipe(Effect.ignore)));
});
