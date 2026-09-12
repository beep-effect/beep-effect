import { doctestFenceInfo, doctestSourceMarker } from "@beep/repo-cli/test/Docgen";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtils, FsUtilsLive, findRepoRoot, readPackageJsonFile, resolveWorkspacePackages } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Console, Effect, FileSystem, HashMap, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { resolveConfig } from "vitest/node";

const providePlatform = provideScopedLayer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));
const fixture = new URL("./fixtures/doctest-lane/package/", import.meta.url).pathname;

// These configs override test.include (coverage.include is a different selector).
const includeOverrides = [
  "apps/todox",
  "apps/professional-desktop",
  "apps/practice-kg-mcp",
  "apps/oip-web",
  "apps/labs/trustgraph-workbench",
  "apps/labs/semantica",
  "apps/labs/lejeune-bolt-workbench",
  "apps/labs/ciops",
  "apps/labs/api-docs",
  "packages/drivers/duckdb",
  "infra",
];

const ResolvedDoctestConfig = S.Struct({
  pool: S.String,
  include: S.Array(S.String),
  includeSource: S.Array(S.String),
  exclude: S.Array(S.String),
  passWithNoTests: S.Boolean,
  setupFiles: S.Array(S.String),
  globalSetup: S.Array(S.String),
});
const decodeConfig = S.decodeEffect(S.fromJsonString(ResolvedDoctestConfig));
const decodeTurboInputs = S.decodeEffect(
  S.fromJsonString(
    S.Struct({
      tasks: S.Array(S.Struct({ taskId: S.String, inputs: S.Record(S.String, S.String) })),
    })
  )
);
// A fresh config process observes the startup flag exactly as the package script does.
// Vite and Effect retain boot snapshots in a long-lived test worker.
const resolvedConfig = Effect.fn("DoctestTest.resolvedConfig")(function* (root: string, active: boolean) {
  const child = yield* StepExec.runCaptured({
    command: "bun",
    args: [
      "--eval",
      `
      import { resolveConfig } from "vitest/node";
      import { jsonStringifyPretty } from "@beep/repo-utils/JsonUtils";
      import { Effect } from "effect";
      const { vitestConfig: c } = await resolveConfig({ root: process.argv[1], config: process.argv[1] + "/vitest.config.ts", watch: false });
      console.log(await Effect.runPromise(jsonStringifyPretty({
        pool: c.pool, include: c.include, includeSource: c.includeSource ?? [], exclude: c.exclude,
        passWithNoTests: c.passWithNoTests, setupFiles: c.setupFiles, globalSetup: c.globalSetup,
      })));
    `,
      root,
    ],
    cwd: root,
    source: "stdout",
    timeout: "30 seconds",
    env: { BEEP_VITEST_DOCTEST: active ? "1" : "0", VITEST_COVERAGE_REPORT_ONLY: "1" },
    extendEnv: true,
  });
  expect(child.exitCode, child.output).toBe(0);
  return yield* decodeConfig(child.output);
});

describe("doctest lane fixture", { concurrent: false }, () => {
  it.effect(
    "resolves every owner to non-empty in-source discovery and hashes its setup files",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const fsUtils = yield* FsUtils;
      const path = yield* Path.Path;
      const workspaces = yield* resolveWorkspacePackages(root);
      let owners = 0;
      for (const [name, workspace] of workspaces) {
        const dir = workspace.dir;
        const manifest = yield* readPackageJsonFile(path.join(dir, "package.json"));
        const scripts = O.getOrElse(manifest.scripts, () => ({}));
        if (!("doctest" in scripts) && !("beep:doctest" in scripts)) continue;
        owners++;
        const config = yield* resolvedConfig(dir, true);
        expect(config.include, name).toEqual([]);
        expect(config.includeSource, name).toEqual(["src/**/*.{ts,tsx}"]);
        expect(config.passWithNoTests, name).toBe(false);
        expect(config.pool, name).toBe("forks");
        expect(scripts["beep:doctest"], name).toBe("BEEP_VITEST_DOCTEST=1 bunx vitest run");
        const sources = yield* fsUtils.globFiles(config.includeSource ?? [], { cwd: dir, ignore: config.exclude });
        const marked = yield* Effect.filter(sources, (file) =>
          fs.readFileString(path.join(dir, file)).pipe(Effect.map(Str.includes("import.meta.vitest")))
        );
        expect(marked.length, name).toBeGreaterThan(0);
        // Inspect every source, including excluded paths: the marker must name a fence.
        const allSources = yield* fsUtils.globFiles(["src/**/*.{ts,tsx}"], { cwd: dir });
        for (const file of allSources) {
          const source = yield* fs.readFileString(path.join(dir, file));
          if (Str.includes(doctestSourceMarker)(source)) {
            expect(source, `${name}: ${file}`).toMatch(/^\s*\*?\s*`{3}(?:ts|tsx|typescript)\s+import\.meta\.vitest\b/m);
          }
        }
        // Production Turbo input expansion must cover every resolved setup/global setup file.
        const probe = yield* StepExec.runCaptured({
          command: path.join(root, "node_modules/.bin/turbo"),
          args: ["run", "doctest", `--filter=${name}`, "--dry-run=json", "--cache=local:rw"],
          cwd: root,
          source: "stdout",
          timeout: "30 seconds",
          env: { TURBO_TELEMETRY_DISABLED: "1" },
          extendEnv: true,
        });
        expect(probe.exitCode, probe.output).toBe(0);
        const summary = yield* decodeTurboInputs(probe.output);
        const task = O.getOrThrow(A.findFirst(summary.tasks, (entry) => entry.taskId === `${name}#doctest`));
        for (const setup of [...config.setupFiles, ...config.globalSetup]) {
          const relative = path.relative(dir, setup);
          expect(task.inputs[relative], `${name}: ${relative}`).toBeDefined();
        }
      }
      yield* Console.log(`doctest discovery: ${owners} owners with non-empty source discovery and covered setup files`);
      expect(owners).toBeGreaterThan(0);
      expect(HashMap.has(workspaces, "@beep/storybook")).toBe(true);
    }, providePlatform),
    { timeout: 180_000 }
  );

  it.effect(
    "selects a marked fence but not a runtime-composed template in-process",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const fsUtils = yield* FsUtils;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "doctest-marker-parity-" });
      yield* fs.makeDirectory(path.join(root, "src"));
      yield* fs.writeFileString(path.join(root, "src/template.ts"), 'export const marker = "import.meta." + "vitest";');
      yield* fs.writeFileString(
        path.join(root, "src/marked.ts"),
        [
          "/**",
          " * **Example** (Add numbers)",
          ` * \`\`\`${doctestFenceInfo("Add numbers")}`,
          " * 1 + 1 // => 2",
          " * ```",
          " */",
          "export const sum = 2;",
        ].join("\n")
      );
      const { vitestConfig: config } = yield* Effect.promise(() =>
        resolveConfig({
          root,
          config: false,
          watch: false,
          include: [],
          includeSource: ["src/**/*.{ts,tsx}"],
          passWithNoTests: false,
        })
      );
      const sources = yield* fsUtils.globFiles(config.includeSource ?? [], { cwd: root, ignore: config.exclude });
      expect(sources).toContain("src/template.ts");
      expect(sources).toContain("src/marked.ts");
      const selected = yield* Effect.filter(sources, (file) =>
        fs.readFileString(path.join(root, file)).pipe(Effect.map(Str.includes("import.meta.vitest")))
      );
      expect(selected).toEqual(["src/marked.ts"]);
      expect(doctestSourceMarker).toBe("import.meta.vitest");
      expect(doctestFenceInfo("Add numbers")).toBe('ts import.meta.vitest name="Add numbers"');
    }, providePlatform)
  );

  it.effect(
    "keeps ordinary includes and suppresses every inheriting override in doctest mode",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      for (const active of [false, true]) {
        yield* Effect.forEach(
          includeOverrides,
          Effect.fnUntraced(function* (dir) {
            const config = yield* resolvedConfig(`${root}/${dir}`, active);
            expect(config.include.length === 0, `${dir}: mode=${active}`).toBe(active);
            expect(config.passWithNoTests, dir).toBe(!active);
            expect(config.includeSource, dir).toEqual(active ? ["src/**/*.{ts,tsx}"] : []);
          }),
          { concurrency: 1 }
        );
      }
    }, providePlatform),
    { timeout: 120_000 }
  );

  it.effect(
    "runs the package script through the shared doctest mode",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "doctest-lane-" });
      const resultPath = `${temp}/result.json`;
      const child = yield* StepExec.runCaptured({
        command: "bun",
        args: ["run", "doctest", "--maxWorkers=1", "--reporter=json", `--outputFile=${resultPath}`],
        cwd: fixture,
        env: { BEEP_VITEST_DOCTEST: "1", VITEST: "", VITEST_MODE: "", VITEST_POOL_ID: "", VITEST_WORKER_ID: "" },
        extendEnv: true,
        timeout: "60 seconds",
      });
      expect(child.exitCode, child.output).toBe(0);
      const result = yield* fs.readFileString(resultPath);
      expect(result).toContain('"numPassedTestSuites":2');
      expect(result).toContain('"numPassedTests":2');
    }, providePlatform),
    { timeout: 90_000 }
  );
});
