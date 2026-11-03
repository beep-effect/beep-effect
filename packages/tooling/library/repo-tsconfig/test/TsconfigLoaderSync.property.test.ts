import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { MemoryFileSystem } from "@beep/memfs";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { TsconfigLoaderSync } from "@beep/repo-tsconfig/TsconfigLoaderSync";
import { TsconfigJson, TsconfigJsonFromString } from "@beep/tsconfig/TsconfigJson";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const path = Path.layer.pipe(Layer.build, Effect.map(Context.get(Path.Path)), Effect.scoped, Effect.runSync);
const Sample = S.Struct({
  compilerOptions: S.Struct({ strict: S.Boolean, target: S.Literals(["es2022", "esnext", "es5"]) }),
  files: S.Array(S.String),
});

describe("TsconfigLoaderSync parser properties", () => {
  it.effect.prop(
    "load preserves JSONC values and parse/stringify/parse fidelity with idempotent canonical encoding",
    [Arbitrary.schema(Sample)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(TsconfigJsonFromString)(value);
        const fileSystem = MemoryFileSystem.makeSync({ "/project/tsconfig.json": `// comment\n${text}` }).sync;
        const parsed = TsconfigLoaderSync.load("/project/tsconfig.json", { fileSystem, path });
        assert.isTrue(S.toEquivalence(TsconfigJson)(parsed, value));
        const formatted = yield* S.encodeEffect(TsconfigJsonFromString)(parsed);
        const reparsed = TsconfigLoaderSync.load("/project/tsconfig.json", {
          fileSystem: MemoryFileSystem.makeSync({ "/project/tsconfig.json": formatted }).sync,
          path,
        });
        assert.isTrue(S.toEquivalence(TsconfigJson)(reparsed, parsed));
        const value1 = yield* S.encodeEffect(TsconfigJsonFromString)(reparsed);
        assert.strictEqual(value1, formatted);
      }),
    runs
  );

  it.effect.prop(
    "resolve and compilerOptions equal the async pipeline for an inherited config",
    [Arbitrary.schema(Sample)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(TsconfigJsonFromString)(value);
        const memory = yield* MemoryFileSystem.makeHandle({
          "/project/tsconfig.json": text,
          "/project/child.json": '{"extends":"./tsconfig.json","compilerOptions":{"noEmit":true}}',
        });
        const sync = { fileSystem: memory.sync, path };
        const argument = TsconfigLoaderSync.resolve("/project/child.json", sync);
        const pipe1 = yield* TsconfigLoader.resolve("/project/child.json").pipe(
          Effect.provideService(FileSystem.FileSystem, memory.fileSystem),
          Effect.provideService(Path.Path, path)
        );
        assert.deepStrictEqual(argument, pipe1);
        const argument1 = TsconfigLoaderSync.compilerOptions("/project/child.json", sync);
        const pipe2 = yield* TsconfigLoader.compilerOptions("/project/child.json").pipe(
          Effect.provideService(FileSystem.FileSystem, memory.fileSystem),
          Effect.provideService(Path.Path, path)
        );
        assert.deepStrictEqual(argument1, pipe2);
      }),
    runs
  );
});
