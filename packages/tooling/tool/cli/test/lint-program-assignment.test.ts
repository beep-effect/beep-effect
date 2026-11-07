import { validateLintProgramAssignment } from "@beep/repo-cli/test/Lint";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { afterEach, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { API } from "tsrs/async";
import { vi } from "vitest";

const startParser = vi.hoisted(() => vi.fn());
vi.mock("tsrs/async", (importOriginal) =>
  importOriginal<typeof import("tsrs/async")>().then((original) => ({
    ...original,
    API: class extends original.API {
      constructor(options: ConstructorParameters<typeof original.API>[0]) {
        startParser();
        super(options);
      }
    },
  }))
);
afterEach(() => {
  startParser.mockReset();
  vi.restoreAllMocks();
});

const fixture = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "lint-program-assignment-" });
  const write = Effect.fnUntraced(function* (file: string, text: string) {
    const target = path.join(root, file);
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* fs.writeFileString(target, text);
  });
  return { root, write };
});

it.layer(Layer.merge(NodeFileSystem.layer, Path.layer), { timeout: "30 seconds" })("Rust lint ownership", (it) => {
  it.effect("rejects a compiler that cannot start", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture();
      startParser.mockImplementationOnce(() => {
        throw new Error("compiler unavailable");
      });
      const error = yield* validateLintProgramAssignment(root, ["index.ts"]).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "LintProgramAssignmentError",
        message: "lint deprecated-apis: cannot start tsrs config parser.",
      });
    })
  );
  it.effect("rejects a failed compiler request and still closes its process", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write("tsconfig.json", "{}");
      vi.spyOn(API.prototype, "parseConfigFile").mockRejectedValueOnce(new Error("compiler disconnected"));
      const close = vi.spyOn(API.prototype, "close");
      const error = yield* validateLintProgramAssignment(root, ["index.ts"]).pipe(Effect.scoped, Effect.flip);
      expect(error).toMatchObject({
        _tag: "LintProgramAssignmentError",
        message: "lint deprecated-apis: parse tsconfig failed; cannot prove TypeScript coverage.",
      });
      expect(close).toHaveBeenCalledOnce();
    })
  );
  it.effect("rejects a malformed compiler response and still closes its process", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write("tsconfig.json", "{}");
      const response = { fileNames: [], options: {}, errors: [], projectReferences: [] };
      // Simulate an incompatible wire response without changing the compiler client's declared type.
      Reflect.set(response, "fileNames", 42);
      vi.spyOn(API.prototype, "parseConfigFile").mockResolvedValueOnce(response);
      const close = vi.spyOn(API.prototype, "close");
      const error = yield* validateLintProgramAssignment(root, ["index.ts"]).pipe(Effect.scoped, Effect.flip);
      expect(error).toMatchObject({
        _tag: "LintProgramAssignmentError",
        message: "lint deprecated-apis: malformed config response for tsconfig.json.",
      });
      expect(close).toHaveBeenCalledOnce();
    })
  );
  it.effect("resolves directory references, inherited includes and all TypeScript extensions", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write("tsconfig.json", '{"files":[],"references":[{"path":"./package"}]}');
      yield* write("package/base.json", '{"include":["src"]}');
      yield* write("package/tsconfig.json", '{"extends":"./base.json"}');
      const files = ["package/src/a.ts", "package/src/b.tsx", "package/src/c.mts", "package/src/d.cts"];
      yield* Effect.forEach(files, (file) => write(file, "export {};\n"));
      yield* validateLintProgramAssignment(root, files);
      yield* write("package/scripts/orphan.ts", "export {};\n");
      const error = yield* validateLintProgramAssignment(root, [...files, "package/scripts/orphan.ts"]).pipe(
        Effect.flip
      );
      expect(error).toMatchObject({ _tag: "LintProgramAssignmentError", files: ["package/scripts/orphan.ts"] });
    })
  );
  it.effect("follows solution references to a test-only config", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write("tsconfig.json", '{"files":[],"references":[{"path":"./package/tsconfig.test.json"}]}');
      yield* write("package/tsconfig.json", '{"include":["src"]}');
      yield* write("package/tsconfig.test.json", '{"include":["test"]}');
      yield* write("package/src/index.ts", "export {};\n");
      yield* write("package/test/index.ts", "export {};\n");
      yield* validateLintProgramAssignment(root, ["package/test/index.ts"]);
    })
  );
  it.effect("honors disabled ancestor solution searching", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write("tsconfig.json", '{"include":["package/**/*.ts"]}');
      yield* write("package/tsconfig.json", '{"compilerOptions":{"disableSolutionSearching":true},"include":["src"]}');
      yield* write("package/src/index.ts", "export {};\n");
      yield* write("package/test/index.ts", "export {};\n");
      const error = yield* validateLintProgramAssignment(root, ["package/test/index.ts"]).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "LintProgramAssignmentError", files: ["package/test/index.ts"] });
    })
  );
  it.effect("does not over-assign through a pruned composite project's references", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write(
        "tsconfig.json",
        '{"compilerOptions":{"composite":true},"include":["src"],"references":[{"path":"./test.json"}]}'
      );
      yield* write("test.json", '{"include":["test"]}');
      yield* write("src/index.ts", "export {};\n");
      yield* write("test/index.ts", "export {};\n");
      const error = yield* validateLintProgramAssignment(root, ["test/index.ts"]).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "LintProgramAssignmentError", files: ["test/index.ts"] });
    })
  );
  it.effect("fails closed on malformed configs and terminates reference cycles", () =>
    Effect.gen(function* () {
      const { root, write } = yield* fixture();
      yield* write("tsconfig.json", '{"files":[],"references":[{"path":"./cycle.json"}]}');
      yield* write("cycle.json", '{"files":[],"references":[{"path":"./tsconfig.json"}]}');
      yield* write("orphan.ts", "export {};\n");
      const cycle = yield* validateLintProgramAssignment(root, ["orphan.ts"]).pipe(Effect.flip);
      expect(cycle).toMatchObject({ _tag: "LintProgramAssignmentError", files: ["orphan.ts"] });
      yield* write("tsconfig.json", '{"compilerOptions":{"target":"not-a-target"},"include":["*.ts"]}');
      const invalid = yield* validateLintProgramAssignment(root, ["orphan.ts"]).pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "LintProgramAssignmentError" });
    })
  );
});
