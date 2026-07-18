import { codegenCommand } from "@beep/repo-cli/commands/Codegen";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";

const runCodegenCommand = Command.runWith(codegenCommand, { version: "0.0.0" });
const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);

describe("codegen command", () => {
  it("uses uniform .ts specifiers for TypeScript and TSX barrel entries", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const packageDir = yield* fs.makeTempDirectoryScoped({ prefix: "codegen-command-test-" });
        const srcDir = path.join(packageDir, "src");

        yield* fs.makeDirectory(srcDir, { recursive: true });
        yield* fs.writeFileString(path.join(packageDir, "package.json"), '{"name":"@beep/codegen-fixture"}\n');
        yield* fs.writeFileString(path.join(srcDir, "Model.ts"), "export const Model = null;\n");
        yield* fs.writeFileString(path.join(srcDir, "View.tsx"), "export const View = null;\n");

        yield* runCodegenCommand(["--package", packageDir]);

        const barrel = yield* fs.readFileString(path.join(srcDir, "index.ts"));
        expect(barrel).toContain('export * from "./Model.ts";');
        expect(barrel).toContain('export * from "./View.ts";');
        expect(barrel).not.toContain(".tsx");
      }).pipe(provideScopedLayer(testLayer))
    ));
});
