import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import {
  DECLARATION_ONLY_BUILD_COMMAND,
  DECLARATION_ONLY_BUILD_FLAG,
  implScriptDefaults,
  javaScriptBuildOverrides,
  scaffoldPackageScripts,
} from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
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
  const readFileString4 = yield* fs.readFileString(`${repoRoot}/tsconfig.base.json`);
  const parsed = yield* Jsonc.parse(readFileString4);
  return yield* decodeBaseTsconfig(parsed);
});

const writeFile = Effect.fn("BuildTurboOutputsTest.writeFile")(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});

// The generated library `beep:build`, split into the compiler and its arguments, so the
// fixtures below build exactly what every library package builds.
const [BUILD_COMPILER, ...BUILD_ARGS] = Str.split(DECLARATION_ONLY_BUILD_COMMAND, " ");
const EMITTING_KINDS = ["library", "tool", "ecosystem", "infra"] as const;
// The fixture's public subpaths, each pointing at its source like every workspace `exports` map.
const FIXTURE_EXPORTS = {
  ".": "./src/index.ts",
  "./value": "./src/value.ts",
  "./nested/deep": "./src/nested/deep.ts",
};
const isJavaScriptOutput = (file: string): boolean => Str.endsWith(".js")(file) || Str.endsWith(".js.map")(file);
// `./src/nested/deep.ts` -> `nested/deep`, relative to `dist`.
const distStem = (target: string): string => pipe(target, Str.replace(/^\.\/src\//u, ""), Str.replace(/\.ts$/u, ""));

const compile = Effect.fn("BuildTurboOutputsTest.compile")(function* (repoRoot: string, cwd: string) {
  const run = yield* StepExec.runCaptured({
    command: `${repoRoot}/node_modules/.bin/${BUILD_COMPILER}`,
    args: BUILD_ARGS,
    cwd,
    source: "all",
    timeout: "60 seconds",
    extendEnv: true,
  });
  expect(run.exitCode, run.output).toBe(0);
});

const listDist = Effect.fn("BuildTurboOutputsTest.listDist")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const readDirectory1 = yield* fs.readDirectory(`${root}/dist`);
  return A.sort(readDirectory1, Str.Order);
});

const listDistRecursive = Effect.fn("BuildTurboOutputsTest.listDistRecursive")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(`${root}/dist`, { recursive: true });
  return A.sort(entries, Str.Order);
});

const writeFixturePackage = Effect.fn("BuildTurboOutputsTest.writeFixturePackage")(function* (
  repoRoot: string,
  root: string
) {
  yield* writeFile(
    root,
    "tsconfig.json",
    `${yield* jsonStringifyPretty({ extends: `${repoRoot}/tsconfig.base.json`, include: ["src"] })}\n`
  );
  yield* writeFile(
    root,
    "package.json",
    `${yield* jsonStringifyPretty({ type: "module", private: true, exports: FIXTURE_EXPORTS })}\n`
  );
  yield* writeFile(root, "src/index.ts", 'export * from "./value.ts";\n');
  yield* writeFile(root, "src/value.ts", "export const value: number = 1;\n");
  yield* writeFile(root, "src/nested/deep.ts", "export const deep = (input: string): string => `${input}!`;\n");
});

// A `beep:build` emits JavaScript when one of its `&&` segments runs the package's
// `tsconfig.json` program as anything but the generated declaration-only command.
const buildSegments = flow(Str.split("&&"), A.map(Str.trim));
const runsBuildProgram = Str.startsWith("tsrs -p tsconfig.json");
const emitsJavaScript = (command: string): boolean =>
  A.some(buildSegments(command), (segment) => runsBuildProgram(segment) && segment !== DECLARATION_ONLY_BUILD_COMMAND);

it.layer(PlatformLayer, { concurrent: false, timeout: "90 seconds" })("build incremental state (#1874)", (it) => {
  it.effect(
    "keeps the base incremental state inside outDir, which the build task declares as an output",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const base = yield* readBaseTsconfig(repoRoot);
      const readFileString2 = yield* fs.readFileString(`${repoRoot}/turbo.json`);
      const build = (yield* decodeBuildConfiguration(readFileString2)).tasks.build;

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
      const listDist3 = yield* listDist(root);
      expect(listDist3).toEqual(cold);
    })
  );
});

it.layer(PlatformLayer, { concurrent: false, timeout: "90 seconds" })("declaration-only library build", (it) => {
  it("generates a library build that neither runs Babel nor emits JavaScript", () => {
    expect(BUILD_COMPILER).toBe("tsrs");
    expect(BUILD_ARGS).toContain(DECLARATION_ONLY_BUILD_FLAG);
    const builds = A.filter(implScriptDefaults, (row) => row.name === "beep:build");
    expect(A.some(builds, (row) => pipe(row.value, Str.includes("babel")))).toBe(false);
    expect(A.filter(builds, (row) => emitsJavaScript(row.value))).toEqual([]);
    expect(A.filter(builds, (row) => row.value === DECLARATION_ONLY_BUILD_COMMAND)).toHaveLength(EMITTING_KINDS.length);
    for (const kind of EMITTING_KINDS) {
      const scripts = scaffoldPackageScripts(kind, []);
      expect(scripts["beep:build"], kind).toBe(DECLARATION_ONLY_BUILD_COMMAND);
      expect(scripts, kind).not.toHaveProperty("babel");
    }
  });

  it.effect(
    "keeps every workspace build free of Babel and JavaScript emit outside reviewed overrides",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const path = yield* Path.Path;
      const workspaces = yield* workspaceManifests(repoRoot);
      const overridden = A.map(javaScriptBuildOverrides, (row) => row.manifest);
      const offending = A.flatMap(HashMap.toEntries(workspaces), ([name, member]) => {
        const manifest = `${path.relative(repoRoot, member.dir)}/package.json`;
        const build = HashMap.get(member.manifest.scripts, "beep:build");
        const babel = HashMap.has(member.manifest.scripts, "babel") ? [`${name}: babel script`] : [];
        const javaScript = !A.contains(overridden, manifest) && O.exists(build, emitsJavaScript);
        const babelBuild = O.exists(build, (command) => pipe(command, Str.includes("babel")));
        return [
          ...babel,
          ...(javaScript ? [`${name}: JavaScript-emitting beep:build`] : []),
          ...(babelBuild ? [`${name}: beep:build runs Babel`] : []),
        ];
      });
      expect(HashMap.size(workspaces)).toBeGreaterThan(100);
      expect(offending).toEqual([]);
    })
  );

  it.effect(
    "emits a declaration and declaration map for every exports subpath and no JavaScript",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "build-declaration-only-" });
      yield* writeFixturePackage(repoRoot, root);

      yield* compile(repoRoot, root);
      const entries = yield* listDistRecursive(root);

      expect(A.filter(entries, isJavaScriptOutput)).toEqual([]);
      for (const target of R.values(FIXTURE_EXPORTS)) {
        const stem = distStem(target);
        expect(entries, target).toContain(`${stem}.d.ts`);
        expect(entries, target).toContain(`${stem}.d.ts.map`);
      }
    })
  );
});
