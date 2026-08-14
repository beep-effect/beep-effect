import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as O from "effect/Option";
import { ConfigService, DEFAULT_CONFIG } from "../../Service/Config.ts";
import type { StorageServiceMethods } from "../../Service/Storage.ts";
import { StorageService, StorageServiceLive } from "../../Service/Storage.ts";

const PlatformLayer = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

const withPlatform = <A2, E, R>(effect: Effect.Effect<A2, E, R>) =>
  Layer.build(PlatformLayer).pipe(
    Effect.flatMap((context) => effect.pipe(Effect.provide(context))),
    Effect.scoped
  );

const withLocalStorage = <A2, E>(localPath: string, use: (storage: StorageServiceMethods) => Effect.Effect<A2, E>) => {
  const config = {
    ...DEFAULT_CONFIG,
    storage: {
      type: "local" as const,
      bucket: O.none<string>(),
      localPath: O.some(localPath),
      prefix: "",
    },
  };
  const layer = StorageServiceLive.pipe(Layer.provide(Layer.succeed(ConfigService, config)));

  return Layer.build(layer).pipe(
    Effect.flatMap((context) => StorageService.pipe(Effect.flatMap(use), Effect.provide(context))),
    Effect.scoped
  );
};

describe("effect-ontology local storage", () => {
  it.effect("stores ordinary nested keys beneath the configured root", () =>
    withPlatform(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-ontology-storage-" });

        yield* withLocalStorage(root, (storage) =>
          Effect.gen(function* () {
            yield* storage.set("nested/report.txt", "safe content");
            expect(yield* storage.get("nested/report.txt")).toBe("safe content");
            expect(yield* storage.list("nested")).toEqual(["report.txt"]);
          })
        );
      })
    )
  );

  it.effect("rejects traversal and absolute keys across the local storage surface", () =>
    withPlatform(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "effect-ontology-storage-" });
        const root = path.join(sandbox, "output");
        const outsideFile = path.join(sandbox, "secret.txt");
        const absoluteWrite = path.join(sandbox, "absolute-write.txt");
        yield* fs.writeFileString(outsideFile, "outside secret");

        yield* withLocalStorage(root, (storage) =>
          Effect.gen(function* () {
            expect(Result.isFailure(yield* Effect.result(storage.get("../secret.txt")))).toBe(true);
            expect(Result.isFailure(yield* Effect.result(storage.get(outsideFile)))).toBe(true);
            expect(Result.isFailure(yield* Effect.result(storage.getUint8Array("../secret.txt")))).toBe(true);
            expect(Result.isFailure(yield* Effect.result(storage.set(absoluteWrite, "overwrite")))).toBe(true);
            expect(Result.isFailure(yield* Effect.result(storage.remove("../secret.txt")))).toBe(true);
            expect(Result.isFailure(yield* Effect.result(storage.list("..")))).toBe(true);
            expect(Result.isFailure(yield* Effect.result(storage.getWithGeneration("../secret.txt")))).toBe(true);
            expect(
              Result.isFailure(yield* Effect.result(storage.setIfGenerationMatch("../secret.txt", "overwrite", "0")))
            ).toBe(true);
          })
        );

        expect(yield* fs.readFileString(outsideFile)).toBe("outside secret");
        expect(yield* fs.exists(absoluteWrite)).toBe(false);
      })
    )
  );

  it.effect("rejects a key whose in-root symlink resolves outside the storage root", () =>
    withPlatform(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const sandbox = yield* fs.makeTempDirectoryScoped({ prefix: "effect-ontology-storage-" });
        const root = path.join(sandbox, "output");
        const outsideFile = path.join(sandbox, "secret.txt");
        yield* fs.writeFileString(outsideFile, "outside secret");

        yield* withLocalStorage(root, (storage) =>
          Effect.gen(function* () {
            yield* fs.symlink(outsideFile, path.join(root, "linked-secret.txt"));
            expect(Result.isFailure(yield* Effect.result(storage.get("linked-secret.txt")))).toBe(true);
          })
        );
      })
    )
  );
});
