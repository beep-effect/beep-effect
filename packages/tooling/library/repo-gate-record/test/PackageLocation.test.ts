import { inputFingerprint, locatePackage, PackageLocation } from "@beep/repo-gate-record/PackageLocation";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";

const PACKAGE_DIR = "packages/demo";

const tempRepo = Effect.fn("PackageLocationTest.tempRepo")(function* (manifest: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-record-" });
  const packageRoot = path.join(repoRoot, PACKAGE_DIR);
  yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}");
  yield* fs.makeDirectory(packageRoot, { recursive: true });
  yield* fs.writeFileString(path.join(packageRoot, "package.json"), manifest);
  return { repoRoot, packageRoot };
});

describe("inputFingerprint", () => {
  it.effect("is Turbo's task hash under Turbo and unique to the run otherwise", () =>
    Effect.gen(function* () {
      const turbo = yield* inputFingerprint("r1").pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TURBO_HASH: "abc" }))
      );
      const local = yield* inputFingerprint("r1").pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
      );
      assert.strictEqual(turbo, "turbo:abc");
      assert.strictEqual(local, "local:r1");
    })
  );
});

it.layer(NodeServices.layer)("locatePackage", (it) => {
  it.effect("locates a package directory under the repository root", () =>
    Effect.gen(function* () {
      const { repoRoot, packageRoot } = yield* tempRepo('{"name":"@beep/demo"}');
      const located = yield* locatePackage(packageRoot);
      assertSome(located, PackageLocation.make({ repoRoot, packageDir: PACKAGE_DIR, subject: "@beep/demo" }));
      const atRoot = yield* locatePackage(repoRoot);
      assertNone(atRoot);
    })
  );

  it.effect("names a package without a readable manifest name by its directory", () =>
    Effect.gen(function* () {
      const { packageRoot } = yield* tempRepo("{}");
      const unnamed = yield* locatePackage(packageRoot);
      assertSome(
        O.map(unnamed, (located) => located.subject),
        PACKAGE_DIR
      );
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.writeFileString(path.join(packageRoot, "package.json"), "not json");
      const unreadable = yield* locatePackage(packageRoot);
      assertSome(
        O.map(unreadable, (located) => located.subject),
        PACKAGE_DIR
      );
    })
  );

  it.effect("passes a package's own turbo.json, which extends the root's", () =>
    Effect.gen(function* () {
      const { repoRoot, packageRoot } = yield* tempRepo('{"name":"@beep/demo"}');
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.writeFileString(path.join(packageRoot, "turbo.json"), '{"extends":["//"]}');
      const located = yield* locatePackage(packageRoot);
      assertSome(
        O.map(located, (found) => [found.repoRoot, found.packageDir]),
        [repoRoot, PACKAGE_DIR]
      );
    })
  );

  it.effect("finds no package outside a repository", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const bare = yield* fs.makeTempDirectoryScoped({ prefix: "gate-record-bare-" });
      const located = yield* locatePackage(bare);
      assertNone(located);
    })
  );
});
