import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("test/build-turbo-outputs");

const CONFIG_DIR = "${configDir}/";

const BaseTsconfig = S.Struct({
  compilerOptions: S.Struct({
    outDir: S.String,
    tsBuildInfoFile: S.String,
    incremental: S.Boolean,
  }),
}).pipe(
  $I.annoteSchema("BaseTsconfig", {
    description: "Emit and incremental-state locations decoded from the repository base tsconfig.",
  })
);

const BuildConfiguration = S.Struct({
  tasks: S.Struct({
    build: S.Struct({
      cache: S.Boolean,
      outputs: S.Array(S.String),
    }),
  }),
}).pipe(
  $I.annoteSchema("BuildConfiguration", {
    description: "Build task output declaration decoded from the repository Turbo configuration.",
  })
);

const decodeBaseTsconfig = S.decodeUnknownEffect(BaseTsconfig);
const decodeBuildConfiguration = S.decodeEffect(S.fromJsonString(BuildConfiguration));
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

const readBaseTsconfig = Effect.fn("BuildTurboOutputsTest.readBaseTsconfig")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* decodeBaseTsconfig(yield* Jsonc.parse(yield* fs.readFileString(`${repoRoot}/tsconfig.base.json`)));
});

const writeFile = Effect.fn("BuildTurboOutputsTest.writeFile")(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});

const compile = Effect.fn("BuildTurboOutputsTest.compile")(function* (repoRoot: string, cwd: string) {
  const run = yield* StepExec.runCaptured({
    command: `${repoRoot}/node_modules/.bin/tsrs`,
    args: ["-p", "tsconfig.json"],
    cwd,
    source: "all",
    timeout: "60 seconds",
    extendEnv: true,
  });
  expect(run.exitCode, run.output).toBe(0);
});

const listDist = Effect.fn("BuildTurboOutputsTest.listDist")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory(`${root}/dist`), Str.Order);
});

it.layer(PlatformLayer, { concurrent: false, timeout: "90 seconds" })("build incremental state (#1874)", (it) => {
  it.effect(
    "keeps the base incremental state inside outDir, which the build task declares as an output",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const base = yield* readBaseTsconfig(repoRoot);
      const build = (yield* decodeBuildConfiguration(yield* fs.readFileString(`${repoRoot}/turbo.json`))).tasks.build;

      expect(base.compilerOptions.incremental).toBe(true);
      expect(Str.startsWith(CONFIG_DIR)(base.compilerOptions.outDir)).toBe(true);
      // A dist-only clean must also clear the incremental state, or a later emit skips unchanged files.
      expect(Str.startsWith(`${base.compilerOptions.outDir}/`)(base.compilerOptions.tsBuildInfoFile)).toBe(true);
      expect(build.cache).toBe(true);
      expect(build.outputs).toContain(`${Str.slice(CONFIG_DIR.length)(base.compilerOptions.outDir)}/**`);
    })
  );

  it.effect(
    "re-emits every output after a dist-only clean",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "build-incremental-state-" });
      yield* writeFile(
        root,
        "tsconfig.json",
        `${yield* jsonStringifyPretty({ extends: `${repoRoot}/tsconfig.base.json`, include: ["src"] })}\n`
      );
      yield* writeFile(root, "package.json", `${yield* jsonStringifyPretty({ type: "module", private: true })}\n`);
      yield* writeFile(root, "src/index.ts", 'export * from "./value.ts";\n');
      yield* writeFile(root, "src/value.ts", "export const value: number = 1;\n");

      yield* compile(repoRoot, root);
      const cold = yield* listDist(root);
      expect(cold).toContain("index.d.ts");
      expect(cold).toContain("value.d.ts");

      yield* fs.remove(`${root}/dist`, { recursive: true });
      yield* compile(repoRoot, root);
      expect(yield* listDist(root)).toEqual(cold);
    })
  );
});
