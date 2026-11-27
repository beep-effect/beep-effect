import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

export const PACKAGE_DIR = "packages/demo";

export const tempRepo = Effect.fn("RepoGateVitestTest.tempRepo")(function* (manifest = '{"name":"@beep/demo"}') {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-vitest-" });
  const packageRoot = path.join(repoRoot, PACKAGE_DIR);
  yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}");
  yield* fs.makeDirectory(packageRoot, { recursive: true });
  yield* fs.writeFileString(path.join(packageRoot, "package.json"), manifest);
  return { repoRoot, packageRoot };
});
