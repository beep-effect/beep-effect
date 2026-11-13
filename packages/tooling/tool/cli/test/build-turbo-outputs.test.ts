import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import {
  checkLeadsWithBuild,
  DECLARATION_ONLY_BUILD_COMMAND,
  DECLARATION_ONLY_BUILD_FLAG,
  implScriptDefaults,
  isDeclarationOnlyBuild,
  javaScriptBuildOverrides,
  OWN_SOURCE_CHECK_COMMAND,
  ownSourceCheckOverrides,
  scaffoldPackageScripts,
} from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { fcRuns } from "@beep/test-utils";
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

// Check once: a declaration-only package's `beep:check` leads with its build program, which the
// root `check` task's own-build edge has just run. Every other package keeps `check` off its own
// build (a bundle or a no-emit check) through `tasks.check.dependsOn` in its own `turbo.json`.
const OWN_BUILD_EDGE = "build";
const UPSTREAM_BUILD_EDGE = "^build";
const TURBO_EXTENDS = "$TURBO_EXTENDS$";
const CHECK_TSCONFIG_EXTENDS = "./tsconfig.json";
// Top-level keys a `tsconfig.check.json` the build serves may declare; `include`, `files` and
// `exclude` would change the program's file set.
const CHECK_TSCONFIG_KEYS = ["$schema", "extends", "references", "compilerOptions"];
// compilerOptions that change what a program emits or where its state lives, never which files it holds.
const EMIT_ONLY_OPTIONS = [
  "composite",
  "declaration",
  "declarationMap",
  "incremental",
  "noEmit",
  "rootDir",
  "tsBuildInfoFile",
  "sourceMap",
  "emitDeclarationOnly",
  "outDir",
];

const CheckDependsOn = S.Struct({
  tasks: S.Struct({ check: S.Struct({ dependsOn: S.Array(S.String) }) }),
}).pipe(
  $I.annoteSchema("CheckDependsOn", {
    description: "The check task's dependsOn list declared by a root or package Turbo configuration.",
  })
);

const CheckGraphMember = S.Struct({
  manifest: S.String,
  dir: S.String,
  hasCheck: S.Boolean,
  build: S.Option(S.String),
  check: S.Option(S.String),
  checkDependsOn: S.Array(S.String).pipe(S.Option),
}).pipe(
  $I.annoteSchema("CheckGraphMember", {
    description:
      "A workspace package's beep:build and beep:check, whether it has a check task, and the check dependsOn its own turbo.json declares.",
  })
);
type CheckGraphMember = typeof CheckGraphMember.Type;

const ProgramTsconfig = S.Struct({
  extends: S.optionalKey(S.String),
  references: S.Struct({ path: S.String }).pipe(S.Array, S.optionalKey),
  compilerOptions: S.optionalKey(S.Record(S.String, S.Unknown)),
}).pipe(
  $I.annoteSchema("ProgramTsconfig", {
    description: "The extends, references and compilerOptions of a package tsconfig.",
  })
);

const decodeCheckDependsOn = S.decodeUnknownOption(S.fromJsonString(CheckDependsOn));
const decodeRootCheckDependsOn = S.decodeEffect(S.fromJsonString(CheckDependsOn));
const decodeTsconfigRecord = S.decodeUnknownEffect(S.Record(S.String, S.Unknown));
const decodeProgramTsconfig = S.decodeUnknownEffect(ProgramTsconfig);
const referencePathsEquivalent = A.makeEquivalence(Str.Equivalence);

const leadingSegment = flow(
  buildSegments,
  A.head,
  O.getOrElse(() => "")
);
// The build program opens the check, alone or followed by compiler flags of its own.
const leadsWithBuild = (member: CheckGraphMember): boolean => O.exists(member.check, checkLeadsWithBuild);
const buildsDeclarationOnly = (member: CheckGraphMember): boolean => O.exists(member.build, isDeclarationOnlyBuild);

// The check dependsOn Turbo resolves for a package: its own list replaces the root list unless it
// extends it with `$TURBO_EXTENDS$`.
const effectiveCheckDependsOn = (root: ReadonlyArray<string>, member: CheckGraphMember): ReadonlyArray<string> =>
  O.match(member.checkDependsOn, {
    onNone: () => root,
    onSome: (declared) =>
      A.contains(declared, TURBO_EXTENDS)
        ? [...root, ...A.filter(declared, (edge) => edge !== TURBO_EXTENDS)]
        : declared,
  });

const nonDeclarationOnlyViolations = (member: CheckGraphMember, edges: ReadonlyArray<string>) => [
  ...(A.contains(edges, OWN_BUILD_EDGE) ? [`${member.manifest}: check depends on its own build`] : []),
  ...(A.contains(edges, UPSTREAM_BUILD_EDGE) ? [] : [`${member.manifest}: check lost its upstream builds`]),
  ...(leadsWithBuild(member) ? [`${member.manifest}: beep:check leads with the declaration-only build`] : []),
];

// Every package with a check task: a declaration-only one depends on its own build; any other one
// does not, still depends on its upstream builds, and was never rewritten to lead with the build.
const ownBuildEdgeViolations = (
  root: ReadonlyArray<string>,
  members: ReadonlyArray<CheckGraphMember>
): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(members, (member) => member.hasCheck),
    (member: CheckGraphMember) => {
      const edges = effectiveCheckDependsOn(root, member);
      if (!buildsDeclarationOnly(member)) return nonDeclarationOnlyViolations(member, edges);
      return A.contains(edges, OWN_BUILD_EDGE) ? [] : [`${member.manifest}: check misses its own build`];
    }
  );

const checkGraphMember = (
  manifest: string,
  build: string,
  check: string,
  checkDependsOn: O.Option<ReadonlyArray<string>>
): CheckGraphMember => ({
  manifest,
  dir: manifest,
  hasCheck: true,
  build: O.some(build),
  check: O.some(check),
  checkDependsOn,
});

const checkGraphMembers = Effect.fn("BuildTurboOutputsTest.checkGraphMembers")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspaces = yield* workspaceManifests(repoRoot);
  return yield* Effect.forEach(
    HashMap.values(workspaces),
    Effect.fnUntraced(function* (member) {
      const turboFile = path.join(member.dir, "turbo.json");
      const turbo = yield* Effect.when(fs.readFileString(turboFile), fs.exists(turboFile));
      const row: CheckGraphMember = {
        manifest: `${path.relative(repoRoot, member.dir)}/package.json`,
        dir: member.dir,
        hasCheck: HashMap.has(member.manifest.scripts, "check"),
        build: HashMap.get(member.manifest.scripts, "beep:build"),
        check: HashMap.get(member.manifest.scripts, "beep:check"),
        checkDependsOn: O.flatMap(turbo, (text) =>
          O.map(decodeCheckDependsOn(text), (config) => config.tasks.check.dependsOn)
        ),
      };
      return row;
    })
  );
});

const rootCheckDependsOn = Effect.fn("BuildTurboOutputsTest.rootCheckDependsOn")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`${repoRoot}/turbo.json`);
  return (yield* decodeRootCheckDependsOn(text)).tasks.check.dependsOn;
});

const readTsconfig = Effect.fn("BuildTurboOutputsTest.readTsconfig")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file);
  const parsed = yield* Jsonc.parse(text);
  const record = yield* decodeTsconfigRecord(parsed);
  const keys = R.keys(record);
  const program = yield* decodeProgramTsconfig(parsed);
  return { keys, program };
});

const referencePaths = (program: typeof ProgramTsconfig.Type): ReadonlyArray<string> =>
  A.map(program.references ?? [], (reference) => reference.path);

// What a `tsconfig.check.json` adds to its package's build program: a key that changes the file
// set, a base other than the build config, a compilerOption outside the emit-only set, or
// project references that differ from the build's (references are never inherited).
const additionsToBuildProgram = Effect.fn("BuildTurboOutputsTest.additionsToBuildProgram")(function* (dir: string) {
  const check = yield* readTsconfig(`${dir}/tsconfig.check.json`);
  const build = yield* readTsconfig(`${dir}/tsconfig.json`);
  const options = R.keys(check.program.compilerOptions ?? {});
  return [
    ...A.map(
      A.filter(check.keys, (key) => !A.contains(CHECK_TSCONFIG_KEYS, key)),
      (key) => `declares ${key}`
    ),
    ...(check.program.extends === CHECK_TSCONFIG_EXTENDS ? [] : [`extends ${check.program.extends ?? "nothing"}`]),
    ...A.map(
      A.filter(options, (option) => !A.contains(EMIT_ONLY_OPTIONS, option)),
      (option) => `sets compilerOptions.${option}`
    ),
    ...(referencePathsEquivalent(referencePaths(check.program), referencePaths(build.program))
      ? []
      : ["references differ from the build config"]),
  ];
});

// Edge spellings a check dependsOn list can hold, for the resolution property below.
const CHECK_EDGES = [UPSTREAM_BUILD_EDGE, OWN_BUILD_EDGE, TURBO_EXTENDS, "@beep/editor#check"] as const;

it.layer(PlatformLayer, { concurrent: false, timeout: "90 seconds" })("check once", (it) => {
  it.prop(
    "resolves a package's own check list without the root list unless it extends it",
    { root: S.Literals(CHECK_EDGES).pipe(S.Array), declared: S.Literals(CHECK_EDGES).pipe(S.Array) },
    ({ root, declared }) => {
      const served = `${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`;
      const bundled = checkGraphMember(
        "apps/bundled/package.json",
        "vite build",
        OWN_SOURCE_CHECK_COMMAND,
        O.some(declared)
      );
      const inherited = checkGraphMember(
        "packages/inherited/package.json",
        DECLARATION_ONLY_BUILD_COMMAND,
        served,
        O.none()
      );
      // Membership oracle: an own list replaces the root list unless it carries `$TURBO_EXTENDS$`.
      const resolves = (edge: string) =>
        A.contains(declared, edge) || (A.contains(declared, TURBO_EXTENDS) && A.contains(root, edge));
      const bundledClean = resolves(UPSTREAM_BUILD_EDGE) && !resolves(OWN_BUILD_EDGE);
      expect(A.isReadonlyArrayEmpty(ownBuildEdgeViolations(root, [bundled]))).toBe(bundledClean);
      expect(A.isReadonlyArrayEmpty(ownBuildEdgeViolations(root, [inherited]))).toBe(A.contains(root, OWN_BUILD_EDGE));
    },
    { arbitrary: fcRuns(100) }
  );

  it("reports a package flipped from the declaration-only build to a bundler without the override", () => {
    const root = [UPSTREAM_BUILD_EDGE, OWN_BUILD_EDGE];
    const served = `${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`;
    const members = [
      checkGraphMember("packages/library/package.json", DECLARATION_ONLY_BUILD_COMMAND, served, O.none()),
      checkGraphMember("apps/flipped/package.json", "vite build", OWN_SOURCE_CHECK_COMMAND, O.none()),
      checkGraphMember(
        "apps/extended/package.json",
        "next build",
        OWN_SOURCE_CHECK_COMMAND,
        O.some([TURBO_EXTENDS, "@beep/editor#check"])
      ),
      checkGraphMember("apps/upstream-only/package.json", "vite build", OWN_SOURCE_CHECK_COMMAND, O.some([])),
      checkGraphMember("apps/overridden/package.json", "vite build", OWN_SOURCE_CHECK_COMMAND, O.some(["^build"])),
      checkGraphMember("apps/rewritten/package.json", OWN_SOURCE_CHECK_COMMAND, served, O.some(["^build"])),
      checkGraphMember(
        "apps/rewritten-flagged/package.json",
        OWN_SOURCE_CHECK_COMMAND,
        `${DECLARATION_ONLY_BUILD_COMMAND} --checkerCostCache a.cache`,
        O.some(["^build"])
      ),
      checkGraphMember("packages/narrowed/package.json", DECLARATION_ONLY_BUILD_COMMAND, served, O.some(["^build"])),
    ];
    expect(ownBuildEdgeViolations(root, members)).toEqual([
      "apps/flipped/package.json: check depends on its own build",
      "apps/extended/package.json: check depends on its own build",
      "apps/upstream-only/package.json: check lost its upstream builds",
      "apps/rewritten/package.json: beep:check leads with the declaration-only build",
      "apps/rewritten-flagged/package.json: beep:check leads with the declaration-only build",
      "packages/narrowed/package.json: check misses its own build",
    ]);
  });

  it.effect(
    "keeps check off the own build of every package whose build is not declaration-only",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const root = yield* rootCheckDependsOn(repoRoot);
      const members = yield* checkGraphMembers(repoRoot);
      expect(root).toContain(UPSTREAM_BUILD_EDGE);
      expect(root).toContain(OWN_BUILD_EDGE);
      expect(A.filter(members, (member) => member.hasCheck && buildsDeclarationOnly(member)).length).toBeGreaterThan(
        100
      );
      expect(A.filter(members, (member) => member.hasCheck && !buildsDeclarationOnly(member)).length).toBeGreaterThan(
        0
      );
      expect(ownBuildEdgeViolations(root, members)).toEqual([]);
    })
  );

  it.effect(
    "leads every declaration-only check with the build program, its own flags allowed, except reviewed overrides",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const workspaces = yield* checkGraphMembers(repoRoot);
      const members = A.filter(workspaces, (member) => member.hasCheck && buildsDeclarationOnly(member));
      const overridden = A.map(ownSourceCheckOverrides, (row) => row.manifest);
      // No exemption for flags: a first segment that still names `tsconfig.check.json` is an offender.
      const offending = A.flatMap(members, (member) => {
        const first = O.getOrElse(O.map(member.check, leadingSegment), () => "");
        if (A.contains(overridden, member.manifest))
          return first === OWN_SOURCE_CHECK_COMMAND ? [] : [`${member.manifest}: override without the no-emit check`];
        return leadsWithBuild(member) ? [] : [`${member.manifest}: ${first}`];
      });
      expect(offending).toEqual([]);
      expect(A.filter(overridden, (manifest) => !A.some(members, (member) => member.manifest === manifest))).toEqual(
        []
      );
    })
  );

  it.effect(
    "adds nothing to the build program wherever the build serves the check, and only the overrides add to it",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const workspaces = yield* checkGraphMembers(repoRoot);
      const members = A.filter(workspaces, (member) => member.hasCheck && buildsDeclarationOnly(member));
      const rows = yield* Effect.forEach(
        members,
        Effect.fnUntraced(function* (member) {
          const hasCheckConfig = yield* fs.exists(`${member.dir}/tsconfig.check.json`);
          const additions = hasCheckConfig ? yield* additionsToBuildProgram(member.dir) : [];
          return { member, additions };
        })
      );
      const wider = A.filter(rows, (row) => A.isReadonlyArrayNonEmpty(row.additions));
      expect(
        A.map(
          A.filter(wider, (row) => leadsWithBuild(row.member)),
          (row) => `${row.member.manifest}: ${A.join(row.additions, ", ")}`
        )
      ).toEqual([]);
      expect(
        A.sort(
          A.map(wider, (row) => row.member.manifest),
          Str.Order
        )
      ).toEqual(
        A.sort(
          A.map(ownSourceCheckOverrides, (row) => row.manifest),
          Str.Order
        )
      );
      expect(A.map(wider, (row) => row.additions)).toEqual(A.map(wider, () => ["declares include"]));
    })
  );
});
