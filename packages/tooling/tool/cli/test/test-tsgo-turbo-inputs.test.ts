import { $RepoCliId } from "@beep/identity/packages";
import {
  CoverageScopeOwner,
  effectDiagnosticsAffectedPackages,
  effectDiagnosticsProjects,
  testTsgoPrograms,
} from "@beep/repo-cli/test/Quality";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { FsUtilsLive, readPackageJsonFile } from "@beep/repo-utils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { resolveWorkspacePackages } from "@beep/repo-utils/Workspaces";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encodeUnknownJsonEffect = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const $I = $RepoCliId.create("test/test-tsgo-turbo-inputs");

const EXPECTED_TEST_TSGO_INPUTS: ReadonlyArray<string> = [
  "package.json",
  "scripts/**",
  "server/**",
  "src/**",
  "src-tauri/**",
  "test/**",
  "tsconfig*.json",
  "$TURBO_ROOT$/tsconfig.base.json",
  "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
  "$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts",
];

class TurboTaskSummary extends S.Opaque<TurboTaskSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    hash: S.String,
    taskId: S.String,
  }).pipe(
    $I.annoteSchema("TurboTaskSummary", {
      description: "Task identity and input hash read from a Turbo run summary fixture.",
    })
  )
) {}

class TurboRunSummary extends S.Opaque<TurboRunSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    tasks: S.Array(TurboTaskSummary),
  }).pipe(
    $I.annoteSchema("TurboRunSummary", {
      description: "Subset of a Turbo run summary needed by the tsgo tests input tripwire.",
    })
  )
) {}

const TurboConfiguration = S.Struct({
  tasks: S.Struct({
    "package-test-typecheck": S.Struct({
      cache: S.Boolean,
      dependsOn: S.Array(S.String),
      inputs: S.Array(S.String),
    }),
  }),
}).pipe(
  $I.annoteSchema("TurboConfiguration", {
    description: "Tsgo tests input declaration decoded from the repository Turbo configuration.",
  })
);

const TurboConfigurationJson = S.fromJsonString(TurboConfiguration);
const decodeTurboConfiguration = S.decodeUnknownEffect(TurboConfigurationJson);
const TurboRunSummaryJson = S.fromJsonString(TurboRunSummary);
const decodeTurboRunSummary = S.decodeUnknownEffect(TurboRunSummaryJson);

const writeFixtureFile = Effect.fn("TestTsgoTurboInputsTest.writeFixtureFile")(function* (
  root: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(root, relativePath);

  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writeFixtureJson = Effect.fn("TestTsgoTurboInputsTest.writeFixtureJson")(function* (
  root: string,
  relativePath: string,
  document: unknown
) {
  yield* writeFixtureFile(root, relativePath, `${yield* encodeUnknownJsonEffect(document)}\n`);
});

const testTsgoHashFromSummary = Effect.fn("TestTsgoTurboInputsTest.testTsgoHashFromSummary")(function* (
  root: string,
  turboBinary: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsDirectory = path.join(root, ".turbo", "runs");

  yield* fs.remove(runsDirectory, { recursive: true, force: true });
  const run = Bun.spawnSync(
    [turboBinary, "run", "package-test-typecheck", "--filter=@fixture/test-tsgo", "--cache=local:rw", "--summarize"],
    {
      cwd: root,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream" },
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  expect(run.exitCode, `${run.stdout.toString()}\n${run.stderr.toString()}`).toBe(0);

  const summaryFiles = pipe(yield* fs.readDirectory(runsDirectory), A.filter(Str.endsWith(".json")));
  expect(summaryFiles).toHaveLength(1);

  const summary = yield* decodeTurboRunSummary(
    yield* fs.readFileString(path.join(runsDirectory, summaryFiles[0] ?? "missing-summary.json"))
  );
  const packageTask = A.findFirst(summary.tasks, (task) => task.taskId === "@fixture/test-tsgo#package-test-typecheck");

  expect(O.isSome(packageTask)).toBe(true);
  return pipe(
    packageTask,
    O.map((task) => task.hash),
    O.getOrElse(() => "missing-test-tsgo-hash")
  );
});

it.layer(NodeServices.layer)("tsgo tests Turbo inputs", (it) => {
  it.effect(
    "keeps docs outside the package hash and invalidates every declared tsgo input class",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "test-tsgo-turbo-inputs-" });
      const turboBinary = path.join(repoRoot, "node_modules", ".bin", "turbo");
      const turboConfiguration = yield* decodeTurboConfiguration(
        yield* fs.readFileString(path.join(repoRoot, "turbo.json"))
      );
      const packageTask = turboConfiguration.tasks["package-test-typecheck"];

      expect(packageTask.cache).toBe(false);
      expect(packageTask.dependsOn).toEqual(["^transit"]);
      expect(packageTask.inputs).toEqual(EXPECTED_TEST_TSGO_INPUTS);

      yield* writeFixtureJson(root, "package.json", {
        name: "test-tsgo-turbo-input-fixture",
        packageManager: "bun@1.4.0",
        private: true,
        workspaces: ["packages/*"],
      });
      yield* writeFixtureFile(root, ".gitignore", ".turbo\nnode_modules\n");
      yield* writeFixtureJson(root, "packages/test-tsgo/package.json", {
        dependencies: { "@fixture/config": "workspace:*" },
        name: "@fixture/test-tsgo",
        private: true,
        scripts: { "package-test-typecheck": "echo test-tsgo" },
      });
      yield* writeFixtureJson(root, "packages/config/package.json", {
        name: "@fixture/config",
        private: true,
      });
      yield* writeFixtureJson(root, "turbo.json", {
        tasks: {
          transit: {
            dependsOn: ["^transit"],
          },
          "package-test-typecheck": {
            cache: packageTask.cache,
            dependsOn: packageTask.dependsOn,
            inputs: packageTask.inputs,
          },
        },
      });
      yield* writeFixtureFile(root, "tsconfig.base.json", "{}\n");
      yield* writeFixtureFile(
        root,
        "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
        "export const worker = true;\n"
      );
      yield* writeFixtureFile(
        root,
        "packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts",
        "export const template = true;\n"
      );
      yield* writeFixtureFile(root, "packages/test-tsgo/test/index.test.ts", "export const expected = 1;\n");
      yield* writeFixtureFile(root, "packages/test-tsgo/src/index.ts", "export const value = 1;\n");
      yield* writeFixtureFile(root, "packages/test-tsgo/tsconfig.json", "{}\n");
      yield* writeFixtureFile(root, "packages/test-tsgo/README.md", "# Initial docs\n");
      yield* writeFixtureFile(root, "packages/config/src/index.ts", "export const config = 1;\n");

      const baselineHash = yield* testTsgoHashFromSummary(root, turboBinary);

      yield* writeFixtureFile(root, "packages/test-tsgo/README.md", "# Docs-only edit\n");
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).toBe(baselineHash);

      yield* writeFixtureFile(root, "packages/test-tsgo/test/index.test.ts", "export const expected = 2;\n");
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      yield* writeFixtureFile(root, "packages/test-tsgo/test/index.test.ts", "export const expected = 1;\n");

      yield* writeFixtureFile(root, "packages/test-tsgo/src/index.ts", "export const value = 2;\n");
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      yield* writeFixtureFile(root, "packages/test-tsgo/src/index.ts", "export const value = 1;\n");

      yield* writeFixtureFile(root, "packages/config/src/index.ts", "export const config = 2;\n");
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      yield* writeFixtureFile(root, "packages/config/src/index.ts", "export const config = 1;\n");

      yield* writeFixtureFile(root, "packages/test-tsgo/tsconfig.json", '{"compilerOptions":{}}\n');
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      yield* writeFixtureFile(root, "packages/test-tsgo/tsconfig.json", "{}\n");

      yield* writeFixtureFile(root, "tsconfig.base.json", '{"compilerOptions":{}}\n');
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      yield* writeFixtureFile(root, "tsconfig.base.json", "{}\n");

      yield* writeFixtureFile(
        root,
        "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
        "export const worker = false;\n"
      );
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
      yield* writeFixtureFile(
        root,
        "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts",
        "export const worker = true;\n"
      );

      yield* writeFixtureFile(
        root,
        "packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoSyntheticConfig.ts",
        "export const template = false;\n"
      );
      expect(yield* testTsgoHashFromSummary(root, turboBinary)).not.toBe(baselineHash);
    })
  );
});

const checkInvocations = (scripts: Readonly<Record<string, string>>, root: boolean) => {
  const reachable = HashSet.fromIterable(
    A.filter(
      R.keys(scripts),
      (name) => name === "check" || name === "beep:check" || (root && Str.startsWith("check:")(name))
    )
  );
  let names = A.fromIterable(reachable);
  let seen = HashSet.empty<string>();
  let invocations = A.empty<string>();
  while (A.isReadonlyArrayNonEmpty(names)) {
    const [name, ...remaining] = names;
    names = remaining;
    if (HashSet.has(seen, name)) continue;
    seen = HashSet.add(seen, name);
    const command = pipe(
      scripts,
      R.get(name),
      O.getOrElse(() => "")
    );
    invocations = A.appendAll(
      invocations,
      A.filter(Str.split(command, /&&|\|\||[;|]/u), (invocation) =>
        O.isSome(Str.match(/(?:^|\s)(?:tsrs|tsgo)\s/u)(invocation))
      )
    );
    const words = Str.split(command, /\s+/u);
    names = A.appendAll(
      names,
      A.getSomes(
        A.map(words, (word, index) =>
          word === "run" && words[index - 1] === "bun"
            ? A.get(words, words[index + 1] === "--if-present" ? index + 2 : index + 1)
            : O.none()
        )
      )
    );
  }
  return invocations;
};

const expectedInvocationProjects = Effect.fn("test.expectedInvocationProjects")(function* (
  dir: string,
  invocation: string
) {
  const path = yield* Path.Path;
  const tokens = Str.split(Str.trim(invocation), /\s+/u);
  const flag = O.getOrUndefined(
    A.findFirstIndex(tokens, (token) => A.contains(["-p", "--project", "-b", "--build"], token))
  );
  assertDefined(flag);
  const target = O.getOrUndefined(A.get(tokens, flag + 1));
  assertDefined(target);
  let pending = [path.resolve(dir, target)];
  const build = A.contains(["-b", "--build"], tokens[flag]);
  let expected = HashSet.empty<string>();
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [next, ...rest] = pending;
    pending = rest;
    if (HashSet.has(expected, next)) continue;
    expected = HashSet.add(expected, next);
    if (!build) continue;
    const config = yield* TsconfigLoader.resolve(next);
    pending = A.appendAll(
      pending,
      A.map(config.references ?? [], (ref) => {
        const resolved = path.resolve(path.dirname(next), ref.path);
        return Str.endsWith(".json")(resolved) ? resolved : path.join(resolved, "tsconfig.json");
      })
    );
  }
  return A.fromIterable(expected);
});

const expectedOwnerProjects = Effect.fn("test.expectedOwnerProjects")(function* (
  dir: string,
  scripts: Readonly<Record<string, string>>,
  root: boolean
) {
  const programs = yield* Effect.forEach(
    checkInvocations(scripts, root),
    (invocation) => expectedInvocationProjects(dir, invocation),
    { concurrency: 1 }
  );
  return HashSet.fromIterable(A.flatten(programs));
});

it.layer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)), { timeout: "60 seconds" })((it) => {
  describe("Effect diagnostics check-program parity", () => {
    it.effect(
      "covers exactly the real check-script programs and their build references",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* findRepoRoot();
          const workspaces = yield* resolveWorkspacePackages(root);
          const manifest = yield* readPackageJsonFile(path.join(root, "package.json"));
          const actual = yield* effectDiagnosticsProjects(root);
          const tests = yield* testTsgoPrograms.uncovered(root);
          const manifests = A.append(
            A.map(
              HashMap.toEntries(workspaces),
              ([name, workspace]) => [name, workspace.dir, workspace.scripts] as const
            ),
            [manifest.name, root, O.getOrElse(manifest.scripts, () => ({}))] as const
          );
          for (const [name, dir, scripts] of manifests) {
            const scripted = yield* expectedOwnerProjects(dir, scripts, dir === root);
            const expected = HashSet.union(
              scripted,
              HashSet.fromIterable(
                A.map(
                  A.filter(tests, (test) => test.packageName === name),
                  (test) => test.tsconfigPath
                )
              )
            );
            const candidates = O.getOrElse(HashMap.get(actual, name), () => A.empty<string>());
            expect(candidates, name).toEqual(A.sort(A.fromIterable(expected), Order.String));
            for (const project of candidates) expect(yield* fs.exists(project), project).toBe(true);
          }
          expect(A.some(A.flatten(A.fromIterable(HashMap.values(actual))), Str.endsWith("tsconfig.configs.json"))).toBe(
            true
          );
        }),
      60_000
    );

    it.effect("retains every existing project from the pre-PR fixed-name inventory", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* findRepoRoot();
        const workspaces = yield* resolveWorkspacePackages(root);
        const actual = yield* effectDiagnosticsProjects(root);
        for (const [name, workspace] of HashMap.toEntries(workspaces)) {
          const candidates = O.getOrElse(HashMap.get(actual, name), () => A.empty<string>());
          for (const kind of ["tsconfig.check.json", "tsconfig.test.json", "test/tsconfig.json"]) {
            const previous = path.join(workspace.dir, kind);
            if (yield* fs.exists(previous)) expect(A.contains(candidates, previous), previous).toBe(true);
          }
        }
      })
    );

    it.effect("selects scripts, stories and examples with the root configs owner", () =>
      Effect.gen(function* () {
        const owners = [
          CoverageScopeOwner.make({ packageName: "root", packagePath: ".", hasCoverage: false }),
          CoverageScopeOwner.make({ packageName: "ui", packagePath: "packages/ui", hasCoverage: false }),
        ];
        for (const file of ["scripts/build.ts", "stories/Button.stories.tsx", "examples/demo.ts"]) {
          expect(effectDiagnosticsAffectedPackages(owners, [`packages/ui/${file}`])).toEqual(["root", "ui"]);
        }
        expect(effectDiagnosticsAffectedPackages(owners, ["vitest.shared.ts"])).toEqual(["root"]);
        expect(effectDiagnosticsAffectedPackages(owners, ["docs/note.md"])).toEqual([]);
        expect(effectDiagnosticsAffectedPackages(owners, ["tsconfig.configs.json"])).toEqual(["root", "ui"]);
      })
    );
  });
});

const encodeTurboConfiguration = S.encodeEffect(TurboConfigurationJson);
const encodeTurboRunSummary = S.encodeEffect(TurboRunSummaryJson);

it.effect.prop(
  "preserves compiler input declarations and task summaries through their JSON codecs",
  [Arbitrary.schema(TurboConfiguration), Arbitrary.schema(TurboRunSummary)],
  ([configuration, summary]) =>
    Effect.gen(function* () {
      expect(yield* decodeTurboConfiguration(yield* encodeTurboConfiguration(configuration))).toEqual(configuration);
      expect(yield* decodeTurboRunSummary(yield* encodeTurboRunSummary(summary))).toEqual(summary);
    }),
  { arbitrary: fcRuns(30) }
);
