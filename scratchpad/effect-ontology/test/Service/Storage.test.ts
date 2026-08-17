import { PathSafetyError } from "@beep/file-processing/PathSafety";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe, it } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { ConfigService, DEFAULT_CONFIG } from "../../Service/Config.ts";
import type { StorageServiceMethods } from "../../Service/Storage.ts";
import {
  GenerationMismatchError,
  StorageService,
  StorageServiceLive,
  StorageServiceTest,
} from "../../Service/Storage.ts";

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

class FirstLocalStorage extends Context.Service<FirstLocalStorage, StorageServiceMethods>()(
  "@beep/scratchpad/effect-ontology/test/Service/Storage.test/FirstLocalStorage"
) {}

class SecondLocalStorage extends Context.Service<SecondLocalStorage, StorageServiceMethods>()(
  "@beep/scratchpad/effect-ontology/test/Service/Storage.test/SecondLocalStorage"
) {}

const IndependentLocalStoragePairLayer = Layer.unwrap(
  Effect.map(LocalStorageFixture, ({ root }) =>
    Layer.merge(
      Layer.effect(FirstLocalStorage, StorageService).pipe(
        Layer.provide(makeLocalStorageLayer(root, "independent-pair"))
      ),
      Layer.effect(SecondLocalStorage, StorageService).pipe(
        Layer.provide(makeLocalStorageLayer(root, "independent-pair"))
      )
    )
  )
).pipe(Layer.provideMerge(LocalStorageFixtureLayer), Layer.provideMerge(PlatformLayer));

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

describe.sequential("effect-ontology local StorageService", () => {
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
        assert.deepStrictEqual(yield* storage.getOption("documents/report.txt"), O.some("inside"));
        assert.deepStrictEqual(yield* storage.getOption("documents/missing.txt"), O.none());
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
        assert.deepStrictEqual(yield* storage.list(""), []);
        assert.isFalse(yield* fs.exists(path.join(root, "tenant-a", "documents")));
        assert.deepStrictEqual(yield* fs.readDirectory(path.join(root, "tenant-a")), [".effect-ontology-storage"]);
      })
    );
  });

  it.layer(IndependentLocalStoragePairLayer)("with independently built local storage layers", (it) => {
    it.effect(
      "rejects a stale write after another layer updates the object",
      Effect.fnUntraced(function* () {
        const first = yield* FirstLocalStorage;
        const second = yield* SecondLocalStorage;
        yield* first.set("stale.txt", "first");
        const before = yield* first.getWithGeneration("stale.txt");
        if (O.isNone(before)) return yield* Effect.die("Expected the first layer to read its stored object.");

        yield* second.set("stale.txt", "second");
        const after = yield* first.getWithGeneration("stale.txt");
        if (O.isNone(after)) return yield* Effect.die("Expected the first layer to observe the update.");
        assert.notStrictEqual(after.value.generation, before.value.generation);

        const staleWrite = yield* Effect.result(
          first.setIfGenerationMatch("stale.txt", "stale", before.value.generation)
        );
        assert(staleWrite.pipe(Result.isFailure));
        assert(staleWrite.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));
        assert.strictEqual(yield* first.get("stale.txt"), "second");
      })
    );

    it.effect(
      "permits exactly one concurrent generation-zero create across layers",
      Effect.fnUntraced(function* () {
        const first = yield* FirstLocalStorage;
        const second = yield* SecondLocalStorage;
        const results = yield* TestClock.withLive(
          Effect.all(
            [
              Effect.result(first.setIfGenerationMatch("create.txt", "first", "0")),
              Effect.result(second.setIfGenerationMatch("create.txt", "second", "0")),
            ],
            { concurrency: "unbounded" }
          )
        );

        assert.strictEqual(A.length(A.filter(results, Result.isSuccess)), 1);
        assert.strictEqual(A.length(A.filter(results, Result.isFailure)), 1);
        assert(A.some(results, (result) => result.pipe(Result.getFailure, O.exists(GenerationMismatchError.is))));
      })
    );

    it.effect(
      "rejects a pre-delete generation after another layer recreates the object",
      Effect.fnUntraced(function* () {
        const first = yield* FirstLocalStorage;
        const second = yield* SecondLocalStorage;
        yield* first.set("aba.txt", "same");
        const before = yield* first.getWithGeneration("aba.txt");
        if (O.isNone(before)) return yield* Effect.die("Expected the first layer to read its stored object.");

        yield* second.remove("aba.txt");
        yield* second.setIfGenerationMatch("aba.txt", "same", "0");
        const recreated = yield* first.getWithGeneration("aba.txt");
        if (O.isNone(recreated)) return yield* Effect.die("Expected the second layer to recreate the object.");
        assert.notStrictEqual(recreated.value.generation, before.value.generation);

        const staleWrite = yield* Effect.result(
          first.setIfGenerationMatch("aba.txt", "stale", before.value.generation)
        );
        assert(staleWrite.pipe(Result.isFailure));
        assert(staleWrite.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));
        assert.strictEqual(yield* first.get("aba.txt"), "same");
      })
    );
  });

  it.layer(makeStorageTestLayer("tenant-b"))("with isolated versioned local storage", (it) => {
    it.effect(
      "enforces create-only and stale-generation semantics atomically",
      Effect.fnUntraced(function* () {
        const storage = yield* StorageService;

        const staleMissing = yield* Effect.result(
          storage.setIfGenerationMatch("documents/missing.txt", "unexpected", "12")
        );
        assert(staleMissing.pipe(Result.isFailure));
        assert(staleMissing.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));

        const createResults = yield* TestClock.withLive(
          Effect.all(
            [
              Effect.result(storage.setIfGenerationMatch("documents/created.txt", "first", "0")),
              Effect.result(storage.setIfGenerationMatch("documents/created.txt", "second", "0")),
            ],
            { concurrency: "unbounded" }
          )
        );
        assert.strictEqual(A.length(A.filter(createResults, Result.isSuccess)), 1);
        assert.strictEqual(A.length(A.filter(createResults, Result.isFailure)), 1);

        const versioned = yield* storage.getWithGeneration("documents/created.txt");
        assert(versioned.pipe(O.isSome));
        yield* storage.remove("documents/created.txt");
        const deletedBeforeUpdate = yield* Effect.result(
          storage.setIfGenerationMatch("documents/created.txt", "stale-update", versioned.pipe(O.getOrThrow).generation)
        );
        assert(deletedBeforeUpdate.pipe(Result.isFailure));
        assert(deletedBeforeUpdate.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));
        assert.deepStrictEqual(yield* storage.getOption("documents/created.txt"), O.none());

        yield* storage.setIfGenerationMatch("documents/created.txt", "first", "0");
        const recreated = yield* storage.getWithGeneration("documents/created.txt");
        assert(recreated.pipe(O.isSome));
        assert.notStrictEqual(recreated.pipe(O.getOrThrow).generation, versioned.pipe(O.getOrThrow).generation);

        const staleAfterRecreate = yield* Effect.result(
          storage.setIfGenerationMatch("documents/created.txt", "stale-update", versioned.pipe(O.getOrThrow).generation)
        );
        assert(staleAfterRecreate.pipe(Result.isFailure));
        assert(staleAfterRecreate.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));
        assert.deepStrictEqual(yield* storage.getOption("documents/created.txt"), O.some("first"));

        yield* storage.setIfGenerationMatch(
          "documents/created.txt",
          "equal-size-1",
          recreated.pipe(O.getOrThrow).generation
        );
        const updated = yield* storage.getWithGeneration("documents/created.txt");
        assert(updated.pipe(O.isSome));
        assert.notStrictEqual(updated.pipe(O.getOrThrow).generation, recreated.pipe(O.getOrThrow).generation);

        const reusedGeneration = yield* Effect.result(
          storage.setIfGenerationMatch("documents/created.txt", "equal-size-2", recreated.pipe(O.getOrThrow).generation)
        );
        assert(reusedGeneration.pipe(Result.isFailure));
        assert(reusedGeneration.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));
      })
    );
  });

  it.layer(makeStorageTestLayer("expired-lock"))("with an abandoned local mutation lease", (it) => {
    it.effect(
      "reclaims an expired owner record before mutating",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { root } = yield* LocalStorageFixture;
        const lockPath = path.join(root, "expired-lock", ".effect-ontology-storage", "mutation.lock");
        yield* fs.writeFileString(
          lockPath,
          '{"owner":"0000000000000000000000000000000000000000000000000000000000000000","expiresAt":0}',
          { flag: "wx", mode: 0o600 }
        );
        const storage = yield* StorageService;

        yield* TestClock.withLive(storage.set("document.txt", "recovered"));

        assert.strictEqual(yield* storage.get("document.txt"), "recovered");
        assert.isFalse(yield* fs.exists(lockPath));
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
          storage.get(".effect-ontology-storage/generations/private.json").pipe(Effect.flip),
          storage.set("../outside/new.txt", "escaped").pipe(Effect.flip),
          storage.set("linked-outside/new.txt", "escaped").pipe(Effect.flip),
          storage.remove("../outside/secret.txt").pipe(Effect.flip),
          storage.remove("linked-outside/secret.txt").pipe(Effect.flip),
          storage.list("../outside").pipe(Effect.flip),
          storage.list("linked-outside").pipe(Effect.flip),
          storage.list(".effect-ontology-storage").pipe(Effect.flip),
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

describe("effect-ontology memory StorageService", () => {
  it.layer(StorageServiceTest)("with versioned in-memory storage", (it) => {
    it.effect(
      "rejects stale generations after deletion and recreation",
      Effect.fnUntraced(function* () {
        const storage = yield* StorageService;
        yield* storage.set("document.txt", "first");
        const original = yield* storage.getWithGeneration("document.txt");
        assert(original.pipe(O.isSome));

        yield* storage.remove("document.txt");
        const updateWhileAbsent = yield* Effect.result(
          storage.setIfGenerationMatch("document.txt", "stale", original.pipe(O.getOrThrow).generation)
        );
        assert(updateWhileAbsent.pipe(Result.isFailure));
        assert(updateWhileAbsent.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));

        yield* storage.setIfGenerationMatch("document.txt", "first", "0");
        const recreated = yield* storage.getWithGeneration("document.txt");
        assert(recreated.pipe(O.isSome));
        assert.notStrictEqual(recreated.pipe(O.getOrThrow).generation, original.pipe(O.getOrThrow).generation);

        const staleAfterRecreate = yield* Effect.result(
          storage.setIfGenerationMatch("document.txt", "stale", original.pipe(O.getOrThrow).generation)
        );
        assert(staleAfterRecreate.pipe(Result.isFailure));
        assert(staleAfterRecreate.pipe(Result.getFailure, O.exists(GenerationMismatchError.is)));
      })
    );
  });
});
