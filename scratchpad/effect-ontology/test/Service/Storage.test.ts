import { PathSafetyError } from "@beep/file-processing/PathSafety";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe, it } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ConfigService, DEFAULT_CONFIG } from "../../Service/Config.ts";
import { StorageService, StorageServiceLive } from "../../Service/Storage.ts";

const PlatformLayer = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const isPathSafetyError = S.is(PathSafetyError);

const makeLocalStorageLayer = (root: string, prefix = "") =>
  StorageServiceLive.pipe(
    Layer.provide(
      Layer.succeed(ConfigService, {
        ...DEFAULT_CONFIG,
        storage: {
          ...DEFAULT_CONFIG.storage,
          localPath: O.some(root),
          prefix,
          type: "local",
        },
      })
    )
  );

class LocalStorageFixture extends Context.Service<
  LocalStorageFixture,
  {
    readonly root: string;
    readonly sandbox: string;
  }
>()("@beep/scratchpad/effect-ontology/test/Service/Storage.test/LocalStorageFixture") {}

const LocalStorageFixtureLayer = Layer.effect(
  LocalStorageFixture,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "beep-local-storage-" });
    const root = path.join(sandbox, "storage");
    yield* fs.makeDirectory(root);
    return { root, sandbox };
  })
);

const makeStorageTestLayer = (prefix = "") =>
  Layer.unwrap(Effect.map(LocalStorageFixture, ({ root }) => makeLocalStorageLayer(root, prefix))).pipe(
    Layer.provideMerge(LocalStorageFixtureLayer),
    Layer.provideMerge(PlatformLayer)
  );

const assertLocalPathRejected = (error: unknown): void => {
  const cause = isPathSafetyError(error) ? error : P.hasProperty(error, "cause") ? error.cause : error;
  if (isPathSafetyError(cause)) {
    assert.strictEqual(cause.reason, "escapes-root");
    return;
  }
  assert.isTrue(P.hasProperty(cause, "_tag") && cause._tag === "InvalidData");
  assert.isTrue(
    P.hasProperty(cause, "description") &&
      P.isString(cause.description) &&
      (Str.includes("escapes the allowed root")(cause.description) ||
        Str.includes("must be non-empty, relative")(cause.description))
  );
};

describe("effect-ontology local StorageService", () => {
  it.layer(makeStorageTestLayer("tenant-a"))("with tenant-prefixed local storage", (it) => {
    it.effect(
      "round-trips nested keys beneath the configured local root",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root } = yield* LocalStorageFixture;
        const storage = yield* StorageService;

        yield* storage.set("documents/report.txt", "inside");

        assert.strictEqual(yield* storage.get("documents/report.txt"), "inside");
        assert.deepStrictEqual(yield* storage.list("documents"), ["report.txt"]);
        assert.strictEqual(yield* fs.readFileString(path.join(root, "tenant-a", "documents", "report.txt")), "inside");

        const bytes = new Uint8Array([0, 1, 2, 255]);
        yield* storage.set("documents/payload.bin", bytes);
        assert.deepStrictEqual(yield* storage.getUint8Array("documents/payload.bin"), bytes);

        const versioned = yield* storage.getWithGeneration("documents/report.txt");
        assert.isTrue(O.isSome(versioned));
        if (O.isSome(versioned)) {
          yield* storage.setIfGenerationMatch("documents/report.txt", "updated", versioned.value.generation);
          assert.strictEqual(yield* storage.get("documents/report.txt"), "updated");
        }

        yield* storage.clear;
        assert.deepStrictEqual(yield* fs.readDirectory(path.join(root, "tenant-a")), []);
      })
    );
  });

  it.layer(makeStorageTestLayer())("with isolated local storage for key safety", (it) => {
    it.effect(
      "rejects unsafe keys across every key-bearing operation and pre-positioned symlink escapes",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, sandbox } = yield* LocalStorageFixture;
        const outside = path.join(sandbox, "outside");
        const outsideSecret = path.join(outside, "secret.txt");
        const outsideNew = path.join(outside, "new.txt");
        const absoluteInside = path.join(root, "inside.txt");
        const linkedOutside = path.join(root, "linked-outside");
        yield* fs.makeDirectory(outside);
        yield* fs.writeFileString(absoluteInside, "inside");
        yield* fs.writeFileString(outsideSecret, "outside-secret");
        yield* fs.symlink(outsideSecret, path.join(root, "linked-secret.txt"));
        yield* fs.symlink(outside, linkedOutside);
        const storage = yield* StorageService;

        const errors = yield* Effect.all([
          storage.get("../outside/secret.txt").pipe(Effect.flip),
          storage.get("linked-secret.txt").pipe(Effect.flip),
          storage.get("linked-outside/secret.txt").pipe(Effect.flip),
          storage.getUint8Array(outsideSecret).pipe(Effect.flip),
          storage.getUint8Array("linked-outside/secret.txt").pipe(Effect.flip),
          storage.get(absoluteInside).pipe(Effect.flip),
          storage.get("documents/./report.txt").pipe(Effect.flip),
          storage.get("documents/../inside.txt").pipe(Effect.flip),
          storage.set("../outside/new.txt", "escaped").pipe(Effect.flip),
          storage.set("linked-outside/new.txt", "escaped").pipe(Effect.flip),
          storage.remove("../outside/secret.txt").pipe(Effect.flip),
          storage.remove("linked-outside/secret.txt").pipe(Effect.flip),
          storage.list("../outside").pipe(Effect.flip),
          storage.list("linked-outside").pipe(Effect.flip),
          storage.getWithGeneration("../outside/secret.txt").pipe(Effect.flip),
          storage.getWithGeneration("linked-outside/secret.txt").pipe(Effect.flip),
          storage.setIfGenerationMatch("../outside/new.txt", "escaped", "0").pipe(Effect.flip),
          storage.setIfGenerationMatch("linked-outside/new.txt", "escaped", "0").pipe(Effect.flip),
        ]);

        A.forEach(errors, assertLocalPathRejected);
        assert.strictEqual(yield* fs.readFileString(absoluteInside), "inside");
        assert.strictEqual(yield* fs.readFileString(outsideSecret), "outside-secret");
        assert.isFalse(yield* fs.exists(outsideNew));
      })
    );
  });

  it.layer(PlatformLayer)("while inspecting storage layer construction failures", (it) => {
    it.effect(
      "rejects a prefix replaced before its post-creation containment recheck",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "beep-local-storage-" });
        const root = path.join(sandbox, "storage");
        const prefixRoot = path.join(root, "tenant-a");
        const movedPrefixRoot = path.join(root, "tenant-a-moved");
        const outside = path.join(sandbox, "outside");
        const outsideSecret = path.join(outside, "secret.txt");
        yield* fs.makeDirectory(root);
        yield* fs.makeDirectory(outside);
        yield* fs.writeFileString(outsideSecret, "outside-secret");

        const swappingFileSystem: FileSystem.FileSystem = {
          ...fs,
          makeDirectory: (target, options) =>
            fs
              .makeDirectory(target, options)
              .pipe(
                Effect.andThen(
                  Eq.equals(target, prefixRoot)
                    ? fs.rename(prefixRoot, movedPrefixRoot).pipe(Effect.andThen(fs.symlink(outside, prefixRoot)))
                    : Effect.void
                )
              ),
        };
        const SwappingFileSystemLayer = Layer.succeed(FileSystem.FileSystem, swappingFileSystem);
        const error = yield* Layer.build(
          makeLocalStorageLayer(root, "tenant-a").pipe(Layer.provide(SwappingFileSystemLayer))
        ).pipe(Effect.flip);

        assertLocalPathRejected(error);
        assert.strictEqual(yield* fs.readFileString(outsideSecret), "outside-secret");
        assert.strictEqual(yield* fs.readLink(prefixRoot), outside);
      })
    );
  });

  it.layer(makeStorageTestLayer())("with storage whose configured root is replaced", (it) => {
    it.effect(
      "rejects configured-root replacement completed between operations",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, sandbox } = yield* LocalStorageFixture;
        const movedRoot = path.join(sandbox, "storage-moved");
        const outside = path.join(sandbox, "outside");
        const outsideSecret = path.join(outside, "secret.txt");
        yield* fs.makeDirectory(outside);
        yield* fs.writeFileString(outsideSecret, "outside-secret");
        const storage = yield* StorageService;
        yield* storage.set("inside.txt", "inside");

        yield* fs.rename(root, movedRoot);
        yield* fs.symlink(outside, root);
        const errors = yield* Effect.all([storage.size.pipe(Effect.flip), storage.clear.pipe(Effect.flip)]);

        A.forEach(errors, assertLocalPathRejected);
        assert.strictEqual(yield* fs.readFileString(outsideSecret), "outside-secret");
        assert.strictEqual(yield* fs.readFileString(path.join(movedRoot, "inside.txt")), "inside");
      })
    );
  });

  it.layer(makeStorageTestLayer())("with storage containing a child symlink", (it) => {
    it.effect(
      "rejects a pre-positioned child symlink before clear",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root, sandbox } = yield* LocalStorageFixture;
        const outside = path.join(sandbox, "outside");
        const outsideSecret = path.join(outside, "secret.txt");
        const linkedOutside = path.join(root, "linked-outside");
        yield* fs.makeDirectory(outside);
        yield* fs.writeFileString(outsideSecret, "outside-secret");
        const storage = yield* StorageService;
        yield* fs.symlink(outside, linkedOutside);

        const error = yield* storage.clear.pipe(Effect.flip);

        assertLocalPathRejected(error);
        assert.strictEqual((yield* fs.stat(root)).type, "Directory");
        assert.strictEqual(yield* fs.readLink(linkedOutside), outside);
        assert.strictEqual(yield* fs.readFileString(outsideSecret), "outside-secret");
      })
    );
  });

  it.layer(PlatformLayer)("while validating configured prefix construction", (it) => {
    it.effect(
      "rejects a configured prefix that escapes the local storage root",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "beep-local-storage-" });
        const root = path.join(sandbox, "storage");
        yield* fs.makeDirectory(root);

        const error = yield* Layer.build(makeLocalStorageLayer(root, "../outside")).pipe(Effect.flip);

        assertLocalPathRejected(error);
        assert.isFalse(yield* fs.exists(path.join(sandbox, "outside")));
      })
    );
  });
});
