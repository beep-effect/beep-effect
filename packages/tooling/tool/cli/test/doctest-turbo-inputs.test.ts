import { $RepoCliId } from "@beep/identity/packages";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("test/doctest-turbo-inputs");
class DoctestTaskDefinition extends S.Class<DoctestTaskDefinition>($I`DoctestTaskDefinition`)(
  {
    cache: S.Boolean,
    outputs: S.Array(S.String),
    inputs: S.Array(S.String),
    dependsOn: S.Array(S.String),
    env: S.Array(S.String),
  },
  $I.annote("DoctestTaskDefinition", { description: "Production doctest task declaration for the real hash fixture." })
) {}
class DoctestTaskSummary extends S.Class<DoctestTaskSummary>($I`DoctestTaskSummary`)(
  { taskId: S.String, hash: S.String, dependencies: S.Array(S.String) },
  $I.annote("DoctestTaskSummary", { description: "Doctest identity, hash and transit edges from Turbo." })
) {}
const Configuration = S.Struct({
  global: S.Struct({ env: S.Array(S.String), passThroughEnv: S.Array(S.String) }),
  tasks: S.Struct({
    doctest: DoctestTaskDefinition,
    transit: S.Unknown,
    test: S.Unknown,
    "test:property": S.Unknown,
    docgen: S.Unknown,
  }),
});
const Summary = S.Struct({ tasks: S.Array(DoctestTaskSummary) });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(Configuration));
const decodeSummary = S.decodeEffect(S.fromJsonString(Summary));
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));

const writeFile = Effect.fn("DoctestTurboTest.writeFile")(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});
const writeJson = Effect.fn("DoctestTurboTest.writeJson")(function* (root: string, file: string, value: unknown) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("doctest Turbo inputs", (it) => {
  it.effect(
    "tracks source, tests, setup, config and transit dependencies while ignoring docs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const config = yield* decodeConfiguration(yield* fs.readFileString(`${repoRoot}/turbo.json`));
      expect(config.tasks.doctest.cache).toBe(true);
      expect(config.tasks.doctest.outputs).toEqual([]);
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "doctest-turbo-" });
      yield* writeJson(root, "package.json", {
        name: "doctest-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*", "packages/foundation/modeling/*"],
      });
      yield* writeJson(root, "packages/consumer/package.json", {
        name: "@fixture/consumer",
        dependencies: { "@fixture/upstream": "workspace:*" },
        scripts: { doctest: "echo doctest" },
      });
      yield* writeJson(root, "packages/upstream/package.json", { name: "@fixture/upstream" });
      yield* writeJson(root, "packages/foundation/modeling/utils/package.json", {
        name: "@beep/utils",
        dependencies: { "@beep/identity": "workspace:*" },
      });
      yield* writeJson(root, "packages/identity/package.json", { name: "@beep/identity" });

      yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated" });
      yield* writeJson(root, "turbo.json", { tasks: { doctest: config.tasks.doctest, transit: config.tasks.transit } });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
      const inputs = [
        "packages/consumer/src/index.ts",
        "packages/consumer/test/example.tsx",
        "packages/consumer/test/setup.ts",
        "packages/consumer/vitest.config.ts",
        "packages/consumer/tsconfig.test.json",
        "packages/consumer/package.json",
        "vitest.shared.ts",
        "vitest.setup.ts",
        "vitest.aliases.generated.json",
        "packages/foundation/modeling/utils/src/index.ts",
        "packages/identity/src/index.ts",
        "packages/tooling/tool/cli/test/global-cleanup.ts",
        "packages/upstream/src/index.ts",
      ];
      const unrelated = ["README.md", "packages/consumer/README.md", "packages/unrelated/src/index.ts"];
      yield* Effect.forEach(
        A.filter([...inputs, ...unrelated], (file) => file !== "packages/consumer/package.json"),
        (file) => writeFile(root, file, "{}\n")
      );
      const hash = Effect.fnUntraced(function* (flag = "1") {
        const run = yield* StepExec.runCaptured({
          command: path.join(repoRoot, "node_modules/.bin/turbo"),
          args: ["run", "doctest", "--filter=@fixture/consumer", "--dry-run=json", "--cache=local:rw"],
          cwd: root,
          source: "stdout",
          timeout: "20 seconds",
          env: { BEEP_VITEST_DOCTEST: flag, TURBO_TELEMETRY_DISABLED: "1" },
          extendEnv: true,
        });
        expect(run.exitCode, run.output).toBe(0);
        const summary = yield* decodeSummary(run.output);
        const task = O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === "@fixture/consumer#doctest"));
        expect(task.dependencies).toEqual(["@beep/utils#transit", "@fixture/upstream#transit"]);
        return task.hash;
      });
      const baseline = yield* hash();
      for (const file of [...inputs, ...unrelated]) {
        const original = yield* fs.readFileString(path.join(root, file));
        yield* writeFile(root, file, `${original}\n`);
        expect((yield* hash()) === baseline, file).toBe(A.contains(unrelated, file));
        yield* writeFile(root, file, original);
        expect(yield* hash(), `${file}: restored`).toBe(baseline);
      }
      expect(yield* hash("0")).not.toBe(baseline);
    }),
    { timeout: 180_000 }
  );
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("test and docgen Turbo cache boundaries", (it) => {
  it.effect(
    "ignores local and upstream artifacts but hashes aliases, source and generator dependencies",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const config = yield* decodeConfiguration(yield* fs.readFileString(`${repoRoot}/turbo.json`));
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "test-docgen-turbo-" });
      yield* writeJson(root, "package.json", {
        name: "test-docgen-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*"],
      });
      yield* writeJson(root, "packages/consumer/package.json", {
        name: "@fixture/consumer",
        dependencies: { "@fixture/upstream": "workspace:*" },
        scripts: { test: "echo test", "test:property": "echo property", docgen: "echo docgen" },
      });
      yield* writeJson(root, "packages/upstream/package.json", { name: "@fixture/upstream" });
      yield* writeJson(root, "packages/docgen/package.json", {
        name: "@beep/repo-docgen",
        dependencies: { "@fixture/helper": "workspace:*" },
      });
      yield* writeJson(root, "packages/helper/package.json", { name: "@fixture/helper" });
      yield* writeJson(root, "packages/utils/package.json", { name: "@beep/utils" });
      yield* writeJson(root, "turbo.json", {
        futureFlags: { globalConfiguration: true },
        global: config.global,
        tasks: config.tasks,
      });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\ndocs\ndist\n.beep\ncoverage\n.env\n.env.*\n");
      const files = [
        "packages/consumer/src/index.ts",
        "packages/consumer/.env",
        "packages/upstream/src/index.ts",
        "packages/docgen/src/index.ts",
        "packages/helper/src/index.ts",
        "packages/utils/src/index.ts",
        "vitest.shared.ts",
        "vitest.setup.ts",
        "vitest.aliases.generated.json",
      ];
      yield* Effect.forEach(files, (file) => writeFile(root, file, "{}\n"));
      const hashes = Effect.fnUntraced(function* (regeneration = "0") {
        const run = yield* StepExec.runCaptured({
          command: path.join(repoRoot, "node_modules/.bin/turbo"),
          args: [
            "run",
            "test",
            "test:property",
            "docgen",
            "--filter=@fixture/consumer",
            "--dry-run=json",
            "--cache=local:rw",
          ],
          cwd: root,
          source: "stdout",
          timeout: "20 seconds",
          env: { TURBO_TELEMETRY_DISABLED: "1", REGEN_GOLDENS: regeneration },
          extendEnv: true,
        });
        expect(run.exitCode, run.output).toBe(0);
        const summary = yield* decodeSummary(run.output);
        return A.map(
          ["test", "test:property", "docgen"],
          (task) => O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === `@fixture/consumer#${task}`)).hash
        );
      });
      const git = yield* StepExec.runCaptured({
        command: "git",
        args: ["init", "--quiet"],
        cwd: root,
        source: "all",
        timeout: "20 seconds",
        extendEnv: true,
      });
      expect(git.exitCode, git.output).toBe(0);
      for (const args of [
        ["add", "."],
        [
          "-c",
          "user.name=Turbo Fixture",
          "-c",
          "user.email=turbo-fixture@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--quiet",
          "-m",
          "fixture",
        ],
      ]) {
        const committed = yield* StepExec.runCaptured({
          command: "git",
          args,
          cwd: root,
          source: "all",
          timeout: "20 seconds",
          extendEnv: true,
        });
        expect(committed.exitCode, committed.output).toBe(0);
      }

      const baseline = yield* hashes();
      expect(yield* hashes()).toEqual(baseline);
      const regenerated = yield* hashes("1");
      A.forEach(regenerated, (hash, index) => {
        expect(hash, `regeneration task ${index}`).not.toBe(baseline[index]);
      });
      expect(yield* hashes("0"), "normal hashes restored after regeneration").toEqual(baseline);
      for (const owner of ["consumer", "upstream", "docgen", "helper"]) {
        for (const directory of ["docs", "dist", ".beep", "coverage"]) {
          const file = `packages/${owner}/${directory}/generated.ts`;
          yield* writeFile(root, file, "export const generated = 1;\n");
          expect(yield* hashes(), file).toEqual(baseline);
        }
      }
      for (const file of files) {
        const original = yield* fs.readFileString(path.join(root, file));
        yield* writeFile(root, file, `${original}\n`);
        const mutated = yield* hashes();
        const generator = A.contains(["packages/docgen/src/index.ts", "packages/helper/src/index.ts"], file);
        const sharedTestConfig = A.contains(
          ["vitest.shared.ts", "vitest.setup.ts", "vitest.aliases.generated.json", "packages/utils/src/index.ts"],
          file
        );
        expect(mutated[0] === baseline[0], `${file}: test`).toBe(generator);
        expect(mutated[1] === baseline[1], `${file}: property`).toBe(generator);
        expect(mutated[2] === baseline[2], `${file}: docgen`).toBe(sharedTestConfig);
        yield* writeFile(root, file, original);
        expect(yield* hashes(), `${file}: restored`).toEqual(baseline);
      }
    }),
    { timeout: 180_000 }
  );
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("CLI Turbo configuration consumers", (it) => {
  it.effect(
    "invalidates CLI tests for an unrelated root task edit without invalidating ordinary packages",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const config = yield* decodeConfiguration(yield* fs.readFileString(`${repoRoot}/turbo.json`));
      const override = yield* fs.readFileString(`${repoRoot}/packages/tooling/tool/cli/turbo.json`);
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cli-turbo-inputs-" });
      yield* writeJson(root, "package.json", {
        name: "cli-turbo-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*"],
      });
      for (const [directory, name] of [
        ["cli", "@beep/repo-cli"],
        ["ordinary", "@fixture/ordinary"],
      ]) {
        yield* writeJson(root, `packages/${directory}/package.json`, {
          name,
          scripts: { test: "echo test", "test:property": "echo property" },
        });
      }
      yield* writeJson(root, "packages/utils/package.json", { name: "@beep/utils" });
      yield* writeFile(root, "packages/cli/turbo.json", override);
      const writeConfiguration = (inputs: ReadonlyArray<string>) =>
        writeJson(root, "turbo.json", {
          tasks: {
            test: config.tasks.test,
            "test:property": config.tasks["test:property"],
            transit: config.tasks.transit,
            unrelated: { inputs },
          },
        });
      const hashes = Effect.fnUntraced(function* () {
        const run = yield* StepExec.runCaptured({
          command: path.join(repoRoot, "node_modules/.bin/turbo"),
          args: [
            "run",
            "test",
            "test:property",
            "--filter=@beep/repo-cli",
            "--filter=@fixture/ordinary",
            "--dry-run=json",
          ],
          cwd: root,
          source: "stdout",
          timeout: "20 seconds",
          env: { TURBO_TELEMETRY_DISABLED: "1" },
          extendEnv: true,
        });
        expect(run.exitCode, run.output).toBe(0);
        const summary = yield* decodeSummary(run.output);
        return A.map(
          ["@beep/repo-cli#test", "@beep/repo-cli#test:property", "@fixture/ordinary#test"],
          (taskId) => O.getOrThrow(A.findFirst(summary.tasks, (task) => task.taskId === taskId)).hash
        );
      });
      yield* writeConfiguration(["src/**"]);
      const baseline = yield* hashes();
      yield* writeConfiguration(["src/**", "fixtures/**"]);
      const mutated = yield* hashes();
      expect(mutated[0]).not.toBe(baseline[0]);
      expect(mutated[1]).not.toBe(baseline[1]);
      expect(mutated[2]).toBe(baseline[2]);
      yield* writeConfiguration(["src/**"]);
      expect(yield* hashes()).toEqual(baseline);
    }),
    { timeout: 60_000 }
  );
});
