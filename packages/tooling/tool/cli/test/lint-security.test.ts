import { collectTypeScriptFiles } from "@beep/repo-cli/test/Lint";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

layer(NodeServices.layer)("Lint security", (it) => {
  describe("collectTypeScriptFiles", () => {
    it.effect(
      "skips symlinked directories that loop or escape the lint root",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const repoRoot = path.join(tmpDir, "repo");
        const sourceRoot = path.join(repoRoot, "src");
        const externalRoot = path.join(tmpDir, "external");
        const loopLink = path.join(sourceRoot, "loop");
        const escapeLink = path.join(sourceRoot, "escape");
        const internalFile = path.join(sourceRoot, "index.ts");
        const externalFile = path.join(externalRoot, "escape.ts");

        yield* fs.makeDirectory(sourceRoot, { recursive: true });
        yield* fs.makeDirectory(externalRoot, { recursive: true });
        yield* fs.writeFileString(internalFile, "export const ok = true;\n");
        yield* fs.writeFileString(externalFile, "export const nope = true;\n");
        yield* fs.symlink(sourceRoot, loopLink);
        yield* fs.symlink(externalRoot, escapeLink);

        const files = yield* collectTypeScriptFiles(sourceRoot);

        expect(files).toEqual([internalFile]);

        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
    );
  });
});
