import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { failure } from "./cursor-lifecycle-schemas.ts";

/**
 * Qualifies the canonical interpreter's complete parent chain against unprivileged replacement.
 *
 * **Example** (Qualify a canonical system interpreter)
 * ```ts
 * yield* qualifyInterpreterAncestors("/usr/bin/python3.14");
 * ```
 *
 * **Details**
 * Checks root first, then each parent. Missing ownership fails closed. This does
 * not attest privileged writers or replace the interpreter descriptor/hash checks.
 *
 * @category validation
 * @since 0.0.0
 */
export const qualifyInterpreterAncestors = Effect.fnUntraced(function* (executable: string) {
  const fs = yield* FileSystem.FileSystem;
  let directory = "";
  for (const component of A.dropRight(Str.split(executable, "/"), 1)) {
    directory = `${directory}${component}`;
    const info = yield* fs.stat(directory === "" ? "/" : directory);
    if (info.type !== "Directory" || !O.contains(info.uid, 0) || (info.mode & 0o022) !== 0)
      return yield* failure("enrollment");
    directory = `${directory}/`;
  }
});
