import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { workspaceDirectories } from "@beep/repo-cli/test/SharedInternals";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

// Quality audit K3 and M10 (2026-11-02): package prose never enters a build, check, test or transit
// hash, and test sources stay out of `build` and `transit`, so neither cascades through `^build` or
// `^transit` into dependents. Every other default input stays keyed.

const $I = $RepoCliId.create("test/package-role-turbo-inputs");

const PROSE = ["!README.md", "!CHANGELOG.md", "!LICENSE"];
const TESTS = "!test/**";
const EXTENDS = "$TURBO_EXTENDS$";
const Strings = S.Array(S.String);

class RoleTask extends S.Opaque<RoleTask, { readonly brand: unique symbol }>()(
  S.Struct({
    inputs: Strings,
    dependsOn: Strings.pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
  }).pipe($I.annoteSchema("RoleTask", { description: "A package role task's inputs and dependency edges." }))
) {}

const RootConfiguration = S.Struct({
  tasks: S.Struct({
    transit: RoleTask,
    build: RoleTask,
    check: RoleTask,
    test: RoleTask,
    "test:property": RoleTask,
  }),
});
const Overlay = S.Struct({
  tasks: S.Record(S.String, S.Struct({ inputs: Strings.pipe(S.optionalKey) })),
});
const Manifest = S.Struct({ scripts: S.Record(S.String, S.String).pipe(S.optionalKey) });
const Tsconfig = S.Struct({
  include: Strings.pipe(S.optionalKey),
  extends: S.String.pipe(S.optionalKey),
});
const Summary = S.Struct({ tasks: S.Array(S.Struct({ taskId: S.String, hash: S.String })) });

const decodeRoot = S.decodeEffect(S.fromJsonString(RootConfiguration));
const decodeOverlay = S.decodeUnknownEffect(Overlay);
const decodeManifest = S.decodeEffect(S.fromJsonString(Manifest));
const decodeTsconfig = S.decodeUnknownEffect(Tsconfig);
const decodeSummary = S.decodeEffect(S.fromJsonString(Summary));
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

const readRoot = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const repo = yield* findRepoRoot();
  return { repo, config: yield* decodeRoot(yield* fs.readFileString(`${repo}/turbo.json`)) };
});

// The `include` a tsconfig resolves to, following relative `extends`.
const tsconfigInclude = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let current = file;
  for (let depth = 0; depth < 8; depth++) {
    const config = yield* decodeTsconfig(yield* Jsonc.parse(yield* fs.readFileString(current)));
    if (config.include !== undefined) return config.include;
    if (config.extends === undefined || !Str.startsWith(".")(config.extends)) break;
    current = path.resolve(path.dirname(current), config.extends);
  }
  return A.empty<string>();
});

// Whether a workspace's build compiles its `test` directory: a `tsrs -p <config>` whose program includes
// it, or a `next build`, which typechecks the `tsconfig.json` program.
const buildCompilesTests = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scripts = (yield* decodeManifest(yield* fs.readFileString(path.join(directory, "package.json")))).scripts ?? {};
  const script = O.getOrElse(
    O.orElse(R.get(scripts, "beep:build"), () => R.get(scripts, "build")),
    () => ""
  );
  const configs = [
    ...A.getSomes(
      A.map(Str.split(script, "&&"), (step) => O.map(Str.match(/tsrs -[pb] (\S+)/)(step), (m) => m[1] ?? ""))
    ),
    ...(Str.includes("next build")(script) ? ["tsconfig.json"] : []),
  ];
  const includes = yield* Effect.forEach(configs, (config) => tsconfigInclude(path.join(directory, config)));
  return A.some(A.flatten(includes), (entry) => entry === "test" || Str.startsWith("test/")(entry));
});

// A workspace's effective build inputs: its overlay's, through `$TURBO_EXTENDS$`, or the root's.
const effectiveBuildInputs = Effect.fnUntraced(function* (directory: string, root: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(directory, "turbo.json");
  if (!(yield* fs.exists(file))) return root;
  const overlay = yield* decodeOverlay(yield* Jsonc.parse(yield* fs.readFileString(file)));
  const inputs = overlay.tasks.build?.inputs;
  if (inputs === undefined) return root;
  return A.contains(inputs, EXTENDS) ? [...root, ...A.filter(inputs, (input) => input !== EXTENDS)] : inputs;
});

describe("package role task inputs", () => {
  it.layer(PlatformLayer)("live configuration", (it) => {
    it.effect(
      "drops package prose from every role and test sources from build and transit only",
      Effect.fnUntraced(function* () {
        const { config } = yield* readRoot();
        for (const [name, task] of R.toEntries(config.tasks)) {
          expect(task.inputs, name).toContain("$TURBO_DEFAULT$");
          expect(task.inputs, name).toEqual(expect.arrayContaining(PROSE));
          expect(A.contains(task.inputs, TESTS), name).toBe(name === "build" || name === "transit");
        }
      })
    );

    it.effect(
      "keeps test sources in the build of every workspace whose compiler program includes them",
      Effect.fnUntraced(function* () {
        const { repo, config } = yield* readRoot();
        const directories = HashMap.toValues(yield* workspaceDirectories(repo));
        const rows = yield* Effect.forEach(
          directories,
          Effect.fnUntraced(function* (directory) {
            const compiles = yield* buildCompilesTests(directory);
            return Tuple.make(directory, compiles, yield* effectiveBuildInputs(directory, config.tasks.build.inputs));
          })
        );
        const compiling = A.filter(rows, ([, compiles]) => compiles);
        // The noEmit apps typecheck `tsconfig.check.json`, which includes tests; the Next apps typecheck theirs.
        expect(A.length(compiling)).toBeGreaterThanOrEqual(11);
        for (const [directory, compiles, inputs] of rows) {
          expect(A.contains(inputs, TESTS), directory).toBe(!compiles);
          // An override restates the root boundary rather than diverging from it.
          if (compiles)
            expect(A.take(inputs, A.length(config.tasks.build.inputs) - 1), directory).toEqual(
              A.filter(config.tasks.build.inputs, (input) => input !== TESTS)
            );
        }
      }),
      { timeout: 60_000 }
    );
  });

  it.layer(PlatformLayer, { timeout: "30 seconds" })("native Turbo fixture", (it) => {
    it.effect(
      "keeps prose and test edits out of dependents while source and runtime data still propagate",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { repo, config } = yield* readRoot();
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "package-role-turbo-" });
        const write = Effect.fnUntraced(function* (file: string, text: string) {
          const target = path.join(root, file);
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          yield* fs.writeFileString(target, text);
        });
        const writeJson = Effect.fnUntraced(function* (file: string, value: unknown) {
          yield* write(file, `${yield* jsonStringifyPretty(value)}\n`);
        });
        const scripts = { build: "echo build", check: "echo check", test: "echo test" };
        yield* writeJson("package.json", {
          name: "role-fixture",
          private: true,
          packageManager: "bun@1.4.2",
          workspaces: ["packages/*"],
        });
        yield* write(".gitignore", "node_modules\n.turbo\n");
        yield* writeJson("packages/upstream/package.json", { name: "@fixture/upstream", scripts });
        yield* writeJson("packages/downstream/package.json", {
          name: "@fixture/downstream",
          dependencies: { "@fixture/upstream": "workspace:*" },
          scripts,
        });
        const files = [
          "packages/upstream/src/index.ts",
          "packages/upstream/src/nested/README.md",
          "packages/upstream/data/table.json",
          "packages/upstream/test/upstream.test.ts",
          "packages/upstream/README.md",
          "packages/upstream/CHANGELOG.md",
          "packages/upstream/LICENSE",
          "packages/downstream/src/index.ts",
          "packages/downstream/test/downstream.test.ts",
          "packages/downstream/README.md",
        ];
        yield* Effect.forEach(files, (file) => write(file, "initial\n"));
        // The shared utils edge names a workspace this fixture does not have.
        const tasks = R.fromEntries(
          A.map(R.toEntries(config.tasks), ([name, task]) =>
            Tuple.make(name, {
              inputs: task.inputs,
              dependsOn: A.filter(task.dependsOn, (dependency) => !Str.startsWith("@beep/")(dependency)),
            })
          )
        );
        yield* writeJson("turbo.json", { tasks });
        const ids = A.flatMap(["upstream", "downstream"], (name) =>
          A.map(["build", "check", "test"], (task) => `@fixture/${name}#${task}`)
        );
        const hashes = Effect.gen(function* () {
          const run = yield* StepExec.runCaptured({
            command: path.join(repo, "node_modules", ".bin", "turbo"),
            args: ["run", "build", "check", "test", "--dry-run=json"],
            cwd: root,
            source: "stdout",
            timeout: "20 seconds",
            env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream" },
            extendEnv: true,
          });
          expect(run.exitCode, run.output).toBe(0);
          const summary = yield* decodeSummary(run.output);
          return A.map(ids, (id) => O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === id)).hash);
        });
        const baseline = yield* hashes;
        // Expected misses, in `ids` order: upstream build/check/test, then downstream build/check/test.
        const expectMisses = Effect.fnUntraced(function* (file: string, misses: ReadonlyArray<string>) {
          yield* write(file, "edited\n");
          const changed = yield* hashes;
          const missed = A.filter(ids, (_id, index) => changed[index] !== baseline[index]);
          yield* write(file, "initial\n");
          expect(missed, file).toEqual(A.filter(ids, (id) => A.contains(misses, id)));
        });
        const up = (task: string) => `@fixture/upstream#${task}`;
        const down = (task: string) => `@fixture/downstream#${task}`;
        for (const file of ["README.md", "CHANGELOG.md", "LICENSE"]) {
          yield* expectMisses(`packages/upstream/${file}`, []);
        }
        yield* expectMisses("packages/downstream/README.md", []);
        // A test edit replays its own package's check and test, never its build or any dependent.
        yield* expectMisses("packages/upstream/test/upstream.test.ts", [up("check"), up("test")]);
        yield* expectMisses("packages/downstream/test/downstream.test.ts", [down("check"), down("test")]);
        // Source, runtime data outside `src`, and Markdown inside `src` still reach every dependent.
        const everything = [...A.map(["build", "check", "test"], up), ...A.map(["build", "check", "test"], down)];
        for (const file of ["src/index.ts", "data/table.json", "src/nested/README.md"]) {
          yield* expectMisses(`packages/upstream/${file}`, everything);
        }
        expect(yield* hashes).toEqual(baseline);
      }),
      { timeout: 120_000 }
    );
  });
});
