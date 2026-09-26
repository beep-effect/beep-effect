import { codegenCommand } from "@beep/repo-cli/commands/Codegen";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { Command } from "effect/cli";
import * as TestConsole from "effect/testing/TestConsole";
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

        yield* runCodegenCommand(["barrel", "--package", packageDir, "--dry-run"]);
        expect(yield* fs.exists(path.join(srcDir, "index.ts"))).toBe(false);

        yield* runCodegenCommand(["barrel", "--package", packageDir]);

        const barrel = yield* fs.readFileString(path.join(srcDir, "index.ts"));
        expect(barrel).toContain('export * from "./Model.ts";');
        expect(barrel).toContain('export * from "./View.ts";');
        expect(barrel).not.toContain(".tsx");
      }).pipe(Effect.scoped, provideScopedLayer(testLayer))
    ));

  it("preserves an authored module header and export docs across regeneration", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const packageDir = yield* fs.makeTempDirectoryScoped({ prefix: "codegen-command-test-" });
        const srcDir = path.join(packageDir, "src");
        const header = "/**\n * Authored package header.\n *\n * @packageDocumentation\n * @since 0.0.0\n */";
        const modelDoc =
          "/**\n * Model docs.\n *\n * **Example** (Read the model)\n *\n * ```ts\n * console.log(1)\n * ```\n *\n * @since 0.0.0\n */";

        yield* fs.makeDirectory(srcDir, { recursive: true });
        yield* fs.writeFileString(path.join(packageDir, "package.json"), '{"name":"@beep/codegen-fixture"}\n');
        yield* fs.writeFileString(path.join(srcDir, "Model.ts"), "export const Model = null;\n");
        yield* fs.writeFileString(path.join(srcDir, "View.ts"), "export const View = null;\n");
        // Header separated from the first export by a blank line, then a documented export.
        yield* fs.writeFileString(
          path.join(srcDir, "index.ts"),
          `${header}\n\nexport * from "./View.ts";\n${modelDoc}\nexport * from "./Model.ts";\n`
        );

        yield* runCodegenCommand(["barrel", "--package", packageDir]);
        const first = yield* fs.readFileString(path.join(srcDir, "index.ts"));
        expect(first.startsWith(`${header}\n`)).toBe(true);
        expect(first).toContain(`${modelDoc}\nexport * from "./Model.ts";`);
        expect(first).toContain('/**\n * @since 0.0.0\n */\nexport * from "./View.ts";');

        yield* runCodegenCommand(["barrel", "--package", packageDir]);
        const second = yield* fs.readFileString(path.join(srcDir, "index.ts"));
        expect(second).toBe(first);
      }).pipe(Effect.scoped, provideScopedLayer(testLayer))
    ));
});
