import { codegenCommand } from "@beep/repo-cli/commands/Codegen";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const runCodegenCommand = Command.runWith(codegenCommand, { version: "0.0.0" });
const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);

it.layer(testLayer, { timeout: "30 seconds" })("codegen command", (it) => {
  it.effect("uses uniform .ts specifiers for TypeScript and TSX barrel entries", () =>
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
      const exists1 = yield* fs.exists(path.join(srcDir, "index.ts"));
      expect(exists1).toBe(false);

      yield* runCodegenCommand(["barrel", "--package", packageDir]);

      const barrel = yield* fs.readFileString(path.join(srcDir, "index.ts"));
      expect(barrel).toContain('export * from "./Model.ts";');
      expect(barrel).toContain('export * from "./View.ts";');
      expect(barrel).not.toContain(".tsx");
    })
  );

  it.effect("preserves an authored module header and export docs across regeneration", () =>
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
      expect(Str.startsWith(`${header}\n`)(first)).toBe(true);
      expect(first).toContain(`${modelDoc}\nexport * from "./Model.ts";`);
      expect(first).toContain('/**\n * @since 0.0.0\n */\nexport * from "./View.ts";');

      yield* runCodegenCommand(["barrel", "--package", packageDir]);
      const second = yield* fs.readFileString(path.join(srcDir, "index.ts"));
      expect(second).toBe(first);
    })
  );
});
