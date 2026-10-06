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
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as jsonc from "jsonc-parser";

const testLayer = NodeServices.layer;

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
  it.layer(testLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
    it.effect("updateTsconfigPackages preserves existing references idempotently", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );

    it.effect("checkConfigNeedsUpdate reports no drift for existing root config entries", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );

    it("rejects traversal paths at the schema boundary", () => {
      expect(() => PlannedFile.make({ relativePath: "../escape.txt", content: "owned\n" })).toThrow();
      expect(() => PlannedSymlink.make({ relativePath: "CLAUDE.md", target: "../AGENTS.md" })).toThrow();
    });

    it.effect("executePlan rejects forged file writes that escape the output directory", () =>
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );

    it.effect("executePlan rejects forged symlink targets that escape the output directory", () =>
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );

    it.effect("executePlan skips an existing symlink when the target already matches", () =>
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );

    it.effect("executePlan replaces an existing non-symlink path with the planned symlink", () =>
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );

    it.effect("executePlan rejects a symlinked output directory before writing outside the intended root", () =>
      Effect.gen(function* () {
        const service = createFileGenerationPlanService();

        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
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
    );
  });
});
