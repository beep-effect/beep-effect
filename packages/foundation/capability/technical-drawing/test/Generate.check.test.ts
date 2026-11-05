import { CodegenKit } from "@beep/codegen-kit";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";
import * as TestConsole from "effect/testing/TestConsole";
import { emitLabelGlyphs } from "../scripts/generate-label-glyphs.ts";

const platform = Layer.merge(NodeServices.layer, FetchHttpClient.layer);
const GeneratorTestLayer = Layer.mergeAll(
  platform,
  TestConsole.layer,
  CodegenKit.layer().pipe(Layer.provide(platform))
);

it.layer(GeneratorTestLayer, { timeout: "30 seconds" })("emitLabelGlyphs", (it) => {
  it.effect("check mode reports drift without replacing the committed module", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "label-glyphs-check-" });
      const target = path.join(directory, "LabelGlyphs.ts");
      const committed = "export const retained = true;\n";
      yield* fs.writeFileString(target, committed);
      const failure = yield* emitLabelGlyphs({
        check: true,
        target,
        content: "export const generated = true;\n",
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("CodegenDriftError");
      const actual = yield* fs.readFileString(target);
      expect(actual).toBe(committed);
    })
  );

  it.effect("check mode passes on a current module and write mode replaces it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "label-glyphs-write-" });
      const target = path.join(directory, "LabelGlyphs.ts");
      const content = "export const generated = true;\n";
      yield* emitLabelGlyphs({ check: false, target, content });
      const written = yield* fs.readFileString(target);
      expect(written).toBe(content);
      yield* emitLabelGlyphs({ check: true, target, content });
      const unchanged = yield* fs.readFileString(target);
      expect(unchanged).toBe(content);
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  it.effect("exposes check mode through the real CLI without reading font inputs", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = path.resolve(import.meta.dirname, "..");
      const handle = yield* spawner.spawn(
        ChildProcess.make("bun", ["--no-env-file", path.join(root, "scripts/generate-label-glyphs.ts"), "--help"], {
          cwd: root,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        })
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          handle.stdout.pipe(Stream.decodeText, Stream.mkString),
          handle.stderr.pipe(Stream.decodeText, Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: 3 }
      );
      expect(exitCode).toBe(0);
      expect(stdout + stderr).toContain("--check");
      expect(stdout + stderr).toContain("sans");
      expect(stdout + stderr).toContain("serif");
    })
  );
});
