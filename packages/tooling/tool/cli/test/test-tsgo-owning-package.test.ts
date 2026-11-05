import { testTsgoPrograms } from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const writePackage = Effect.fn("TestTsgoOwningPackageTest.writePackage")(function* (dir: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(dir, "test"), { recursive: true });
  yield* fs.writeFileString(path.join(dir, "package.json"), `{ "name": "${name}" }\n`);
});

const owners = Effect.fn("TestTsgoOwningPackageTest.owners")(function* (
  repoRoot: string,
  files: ReadonlyArray<string>
) {
  const groups = yield* testTsgoPrograms.collectGroups(repoRoot, files);
  return A.map(groups, (group) => [group.packageName, group.packageDir, group.files] as const);
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("test-tsgo package ownership", (it) => {
  it.effect("assigns a test file to the nearest package.json inside the repository", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped();
      const root = yield* fs.realPath(madeTempDirectoryScoped);
      const repo = path.join(root, "repo");
      const pkg = path.join(repo, "packages", "a");
      yield* writePackage(repo, "root");
      yield* writePackage(pkg, "a");
      const owned = path.join(pkg, "test", "a.test.ts");
      const loose = path.join(repo, "test", "root.test.ts");

      const owners1 = yield* owners(repo, [owned, loose]);
      expect(owners1).toEqual([
        ["root", repo, [loose]],
        ["a", pkg, [owned]],
      ]);
    })
  );

  it.effect("never lets a sibling directory that shares the root's prefix claim a test file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const madeTempDirectoryScoped2 = yield* fs.makeTempDirectoryScoped();
      const root = yield* fs.realPath(madeTempDirectoryScoped2);
      const repo = path.join(root, "repo");
      // `/…/repo-worktrees` starts with `/…/repo` as a string but is not inside it.
      const sibling = path.join(root, "repo-worktrees", "lane");
      yield* writePackage(repo, "root");
      yield* writePackage(sibling, "foreign");
      const outside = path.join(sibling, "test", "outside.test.ts");

      const owners3 = yield* owners(repo, [outside]);
      expect(owners3).toEqual([["root", repo, [outside]]]);
    })
  );
});
