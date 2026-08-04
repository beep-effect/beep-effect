import {
  ConfigUpdateTarget,
  checkConfigNeedsUpdate,
  createFileGenerationPlanService,
  FileGenerationPlan,
  GenerationAction,
  PlannedFile,
  PlannedSymlink,
  updateTsconfigPackages,
} from "@beep/repo-cli/test/CreatePackage";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as jsonc from "jsonc-parser";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer);

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  );

const makeSymlinkPlan = (outputDir: string) =>
  FileGenerationPlan.make({
    outputDir,
    actions: [GenerationAction.cases.symlink.make({ relativePath: "CLAUDE.md", target: "AGENTS.md" })],
  });

const writeRootConfigFiles = Effect.fn(function* (rootDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.writeFileString(
    path.join(rootDir, "tsconfig.packages.json"),
    `{
  "references": [
    { "path": "packages/foundation/modeling/identity" }
  ]
}
`
  );
  yield* fs.writeFileString(
    path.join(rootDir, "tsconfig.json"),
    `{
  "compilerOptions": {
    "paths": {
      "@beep/identity": ["./packages/foundation/modeling/identity/src/index.ts"],
      "@beep/identity/*": ["./packages/foundation/modeling/identity/src/*"]
    }
  }
}
`
  );
});

describe("create-package security", () => {
  it("updateTsconfigPackages preserves existing references idempotently", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const filePath = path.join(tmpDir, "tsconfig.packages.json");

          yield* writeRootConfigFiles(tmpDir);

          const changed = yield* updateTsconfigPackages(tmpDir, "packages/foundation/modeling/identity");
          const parsed = jsonc.parse(yield* fs.readFileString(filePath), undefined, {
            allowTrailingComma: true,
            disallowComments: false,
          });

          expect(changed).toBe(false);
          expect(parsed.references).toEqual([{ path: "packages/foundation/modeling/identity" }]);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("checkConfigNeedsUpdate reports no drift for existing root config entries", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          yield* writeRootConfigFiles(tmpDir);

          const result = yield* checkConfigNeedsUpdate(
            tmpDir,
            ConfigUpdateTarget.make({
              packageName: "identity",
              packagePath: "packages/foundation/modeling/identity",
            })
          );

          expect(result.tsconfigPackages).toBe(false);
          expect(result.tsconfigPaths).toBe(false);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it("rejects traversal paths at the schema boundary", () => {
    expect(() => PlannedFile.make({ relativePath: "../escape.txt", content: "owned\n" })).toThrow();
    expect(() => PlannedSymlink.make({ relativePath: "CLAUDE.md", target: "../AGENTS.md" })).toThrow();
  });

  it("executePlan rejects forged file writes that escape the output directory", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const outputDir = path.join(tmpDir, "pkg");
            const externalPath = path.join(tmpDir, "external.txt");

            yield* fs.makeDirectory(outputDir, { recursive: true });
            yield* fs.writeFileString(externalPath, "safe\n");

            const forgedPlan = {
              outputDir,
              actions: [{ kind: "write-file", relativePath: "../external.txt", content: "owned\n" }],
            } as unknown as FileGenerationPlan;

            const succeeded = yield* service.executePlan(forgedPlan).pipe(
              Effect.match({
                onFailure: () => false,
                onSuccess: () => true,
              })
            );
            expect(succeeded).toBe(false);
            expect(yield* fs.readFileString(externalPath)).toBe("safe\n");
          })
        ).pipe(provideScopedLayer(testLayer));
      })
    ));

  it("executePlan rejects forged symlink targets that escape the output directory", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const outputDir = path.join(tmpDir, "pkg");
            const symlinkPath = path.join(outputDir, "CLAUDE.md");

            yield* fs.makeDirectory(outputDir, { recursive: true });

            const forgedPlan = {
              outputDir,
              actions: [{ kind: "symlink", relativePath: "CLAUDE.md", target: "../AGENTS.md" }],
            } as unknown as FileGenerationPlan;

            const succeeded = yield* service.executePlan(forgedPlan).pipe(
              Effect.match({
                onFailure: () => false,
                onSuccess: () => true,
              })
            );
            expect(succeeded).toBe(false);
            expect(yield* fs.exists(symlinkPath)).toBe(false);
          })
        ).pipe(provideScopedLayer(testLayer));
      })
    ));

  it("executePlan skips an existing symlink when the target already matches", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const outputDir = path.join(tmpDir, "pkg");
            const symlinkPath = path.join(outputDir, "CLAUDE.md");

            yield* fs.makeDirectory(outputDir, { recursive: true });
            yield* fs.writeFileString(path.join(outputDir, "AGENTS.md"), "target\n");
            yield* fs.symlink("AGENTS.md", symlinkPath);

            const result = yield* service.executePlan(makeSymlinkPlan(outputDir));

            expect(result.createdSymlinks).toBe(0);
            expect(result.skippedSymlinks).toBe(1);
            expect(yield* fs.readLink(symlinkPath)).toBe("AGENTS.md");
          })
        ).pipe(provideScopedLayer(testLayer));
      })
    ));

  it("executePlan replaces an existing non-symlink path with the planned symlink", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const outputDir = path.join(tmpDir, "pkg");
            const symlinkPath = path.join(outputDir, "CLAUDE.md");

            yield* fs.makeDirectory(outputDir, { recursive: true });
            yield* fs.writeFileString(symlinkPath, "stale file\n");

            const result = yield* service.executePlan(makeSymlinkPlan(outputDir));

            expect(result.createdSymlinks).toBe(1);
            expect(result.skippedSymlinks).toBe(0);
            expect(yield* fs.readLink(symlinkPath)).toBe("AGENTS.md");
          })
        ).pipe(provideScopedLayer(testLayer));
      })
    ));

  it("executePlan rejects a symlinked output directory before writing outside the intended root", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        yield* withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const outputDir = path.join(tmpDir, "pkg-link");
            const externalRoot = path.join(tmpDir, "external-root");
            const escapedPath = path.join(externalRoot, "README.md");

            yield* fs.makeDirectory(externalRoot, { recursive: true });
            yield* fs.symlink(externalRoot, outputDir);

            const forgedPlan = {
              outputDir,
              actions: [{ kind: "write-file", relativePath: "README.md", content: "owned\n" }],
            } as unknown as FileGenerationPlan;

            const succeeded = yield* service.executePlan(forgedPlan).pipe(
              Effect.match({
                onFailure: () => false,
                onSuccess: () => true,
              })
            );
            expect(succeeded).toBe(false);
            expect(yield* fs.exists(escapedPath)).toBe(false);
          })
        ).pipe(provideScopedLayer(testLayer));
      })
    ));
});
