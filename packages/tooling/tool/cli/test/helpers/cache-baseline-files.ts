import { encodeCachePolicyBaselineFiles } from "@beep/repo-cli/commands/Cache";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type { CachePolicyBaseline } from "@beep/repo-configs/cache";

/** Write a baseline as the per-subject files the writer commits under `root`. */
export const writeCachePolicyBaselineFixture = Effect.fn("CacheBaselineFixture.write")(function* (
  root: string,
  baseline: CachePolicyBaseline
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* encodeCachePolicyBaselineFiles(baseline);
  yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (file) {
      const target = path.join(root, file.path);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, file.text);
    }),
    { discard: true }
  );
  return files;
});
