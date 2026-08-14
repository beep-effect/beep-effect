import { AiMetricsFileInventoryError, listAiMetricsDirectoryFileInfo } from "@beep/repo-ai-metrics/file-inventory";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";

const withTempDirectory = <A2, E, R>(use: (tmpDir: string) => Effect.Effect<A2, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true, force: true }))
  );

layer(NodeServices.layer)("AI metrics file inventory", (it) => {
  it.effect("recursively inventories regular files", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = path.join(tmpDir, "inventory");
        const firstPath = path.join(root, "first.jsonl");
        const secondPath = path.join(root, "nested", "second.jsonl");
        yield* fs.makeDirectory(path.dirname(secondPath), { recursive: true });
        yield* fs.writeFileString(firstPath, "first\n");
        yield* fs.writeFileString(secondPath, "second\n");
        yield* fs.symlink("/dev/null", path.join(root, "ignored-device"));

        const inventory = yield* listAiMetricsDirectoryFileInfo(root);
        const paths = A.map(inventory, ([absolutePath]) => absolutePath);

        expect(paths).toEqual(expect.arrayContaining([firstPath, secondPath]));
        expect(paths).toHaveLength(2);
        expect(A.every(inventory, ([, info]) => info.type === "File")).toBe(true);
      })
    )
  );

  it.effect("reports inspect when the root cannot be statted", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const path = yield* Path.Path;
        const failure = yield* Effect.flip(listAiMetricsDirectoryFileInfo(path.join(tmpDir, "absent")));

        expect(failure).toBeInstanceOf(AiMetricsFileInventoryError);
        expect(failure.operation).toBe("inspect");
      })
    )
  );

  it.effect("reports read when directory entries cannot be read", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const unreadablePath = path.join(tmpDir, "unreadable");
        yield* fs.makeDirectory(unreadablePath);

        const failure = yield* Effect.acquireUseRelease(
          fs.chmod(unreadablePath, 0o000),
          () => Effect.flip(listAiMetricsDirectoryFileInfo(unreadablePath)),
          () => fs.chmod(unreadablePath, 0o700).pipe(Effect.ignore)
        );

        expect(failure).toBeInstanceOf(AiMetricsFileInventoryError);
        expect(failure.operation).toBe("read");
      })
    )
  );
});
