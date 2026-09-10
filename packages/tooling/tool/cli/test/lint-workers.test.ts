import { lintCommand } from "@beep/repo-cli/commands/Lint";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { rootLintPolicyStepsForTesting } from "@beep/repo-cli/test/Quality";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty, TSMorphServiceLive } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Config, ConfigProvider, Effect, Exit, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { beforeEach, describe, expect, vi } from "vitest";

const selection = vi.hoisted(() => ({ root: "" }));
vi.mock("@beep/repo-utils", (importOriginal) =>
  importOriginal<typeof import("@beep/repo-utils")>().then((original) => ({
    ...original,
    findRepoRoot: () => (selection.root === "" ? original.findRepoRoot() : Effect.succeed(selection.root)),
  }))
);
const execution = vi.hoisted(() => vi.fn<typeof StepExec.runToExit>());
vi.mock("../src/internal/process/StepExec.ts", (importOriginal) =>
  importOriginal<typeof StepExec>().then((original) => ({ ...original, runToExit: execution }))
);
const platform = Layer.mergeAll(FsUtilsLive, TSMorphServiceLive).pipe(Layer.provideMerge(NodeServices.layer));
const providePlatform = provideScopedLayer(platform);
const runCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const run = (args: ReadonlyArray<string>, env: Record<string, string> = {}) =>
  runCommand(args).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)));
const runShardCommand = Effect.fnUntraced(function* (args: ReadonlyArray<string>, env: Record<string, string>) {
  const fs = yield* FileSystem.FileSystem;
  yield* run(args, env).pipe(
    Effect.provideService(FileSystem.FileSystem, {
      ...fs,
      exists: () => Effect.succeed(true),
      makeDirectory: () => Effect.void,
    })
  );
});
const prefix = "packages/tooling/tool/cli";
beforeEach(() => execution.mockReset().mockImplementation(() => Effect.succeed(0)));

describe("thin lint workers", { concurrent: false }, () => {
  it.effect(
    "checks declared fingerprint inputs independently of formatting and source contents",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "fingerprint-gate-" });
      yield* fs.makeDirectory(`${root}/packages/cli/src`, { recursive: true });
      yield* fs.makeDirectory(`${root}/packages/helper/src`, { recursive: true });
      yield* fs.makeDirectory(`${root}/standards`);
      yield* fs.writeFileString(`${root}/package.json`, '{"name":"fixture","workspaces":["packages/*"]}');
      yield* fs.writeFileString(`${root}/packages/cli/package.json`, '{"name":"@beep/repo-cli"}');
      yield* fs.writeFileString(`${root}/packages/helper/package.json`, '{"name":"@beep/helper"}');
      const turboFile = `${root}/turbo.json`;
      const turboBefore =
        '{\n  "tasks": {\n    "//#lint:policy-fingerprint": {\n      "cache": true,\n      "outputs": [],\n      "inputs": []\n    },\n    "untouched": { "inputs": ["keep/**"] }\n  }\n}\n';
      yield* fs.writeFileString(turboFile, turboBefore);
      selection.root = root;
      try {
        expect(yield* run(["policy-fingerprint", "--check"]).pipe(Effect.isFailure)).toBe(true);
        yield* run(["policy-fingerprint", "--write"]);
        const file = `${root}/standards/policy-tools.fingerprint.json`;
        const declaration = yield* fs.readFileString(file);
        const turbo = yield* fs.readFileString(turboFile);
        expect(turbo).toContain('"untouched": { "inputs": ["keep/**"] }');
        expect(Str.replace(/"inputs": \[[\s\S]*?\]/, '"inputs": []')(turbo)).toBe(turboBefore);
        yield* run(["policy-fingerprint", "--write"]);
        expect(yield* fs.readFileString(file)).toBe(declaration);
        expect(yield* fs.readFileString(turboFile)).toBe(turbo);
        yield* fs.writeFileString(turboFile, turboBefore);
        const turboDrift = yield* run(["policy-fingerprint", "--check"]).pipe(Effect.exit);
        expect(Exit.isFailure(turboDrift)).toBe(true);
        if (Exit.isFailure(turboDrift)) {
          const message = Cause.pretty(turboDrift.cause);
          expect(message).toContain('turbo.json tasks["//#lint:policy-fingerprint"].inputs');
          expect(message).not.toContain("Policy fingerprint drift: standards/policy-tools.fingerprint.json");
        }
        yield* run(["policy-fingerprint", "--write"]);
        yield* fs.writeFileString(file, `  ${declaration}  `);
        yield* fs.writeFileString(`${root}/packages/cli/src/index.ts`, "changed source");
        yield* fs.writeFileString(`${root}/eslint.config.mjs`, "changed config");
        yield* run(["policy-fingerprint", "--check"]);
        yield* fs.writeFileString(
          `${root}/packages/cli/package.json`,
          '{"name":"@beep/repo-cli","dependencies":{"@beep/helper":"workspace:*"}}'
        );
        expect(yield* run(["policy-fingerprint", "--check"]).pipe(Effect.isFailure)).toBe(true);
        yield* run(["policy-fingerprint", "--write"]);
        yield* run(["policy-fingerprint", "--check"]);
        yield* fs.writeFileString(file, "invalid json");
        const fileDrift = yield* run(["policy-fingerprint", "--check"]).pipe(Effect.exit);
        expect(Exit.isFailure(fileDrift)).toBe(true);
        if (Exit.isFailure(fileDrift)) {
          const message = Cause.pretty(fileDrift.cause);
          expect(message).toContain("Policy fingerprint drift: standards/policy-tools.fingerprint.json;");
          expect(message).not.toContain('turbo.json tasks["//#lint:policy-fingerprint"].inputs');
        }
        yield* fs.writeFileString(turboFile, "invalid json");
        expect(yield* run(["policy-fingerprint", "--write"]).pipe(Effect.isFailure)).toBe(true);
        expect(yield* fs.readFileString(file)).toBe("invalid json");
        const bothDrift = yield* run(["policy-fingerprint", "--check"]).pipe(Effect.exit);
        expect(Exit.isFailure(bothDrift)).toBe(true);
        if (Exit.isFailure(bothDrift)) {
          expect(Cause.pretty(bothDrift.cause)).toContain(
            'Policy fingerprint drift: standards/policy-tools.fingerprint.json; turbo.json tasks["//#lint:policy-fingerprint"].inputs;'
          );
        }
        yield* fs.remove(turboFile);
        expect(yield* run(["policy-fingerprint", "--check"]).pipe(Effect.isFailure)).toBe(true);
      } finally {
        selection.root = "";
      }
    }, providePlatform)
  );
  it.effect(
    "runs package deprecated APIs from the root without a cache and with the default heap cap",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      yield* run(["deprecated-apis", "--package", "."]);
      expect(execution).toHaveBeenCalledExactlyOnceWith({
        command: `${root}/node_modules/.bin/eslint`,
        args: ["--config", `${root}/eslint.config.mjs`, prefix],
        cwd: root,
        env: { BEEP_ESLINT_PROFILE: "deprecated-apis", NODE_OPTIONS: "--max-old-space-size=8192" },
        extendEnv: true,
        stdio: "inherit",
      });
    }, providePlatform)
  );
  it.effect(
    "runs the standalone deprecated API command through the policy Turbo step",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      yield* run(["deprecated-apis"]);
      const expected = rootLintPolicyStepsForTesting(root, undefined, "origin/main")[0];
      expect(execution).toHaveBeenCalledTimes(1);
      expect(execution.mock.calls[0]?.[0]).toMatchObject({
        command: expected?.command,
        args: expected?.args,
        cwd: root,
      });
      expect(execution.mock.calls[0]?.[0].args).toContain("--affected");
      expect(execution.mock.calls[0]?.[0].env?.TURBO_SCM_BASE).toBe("origin/main");
      execution.mockClear();
      execution.mockImplementation(() => Effect.succeed(7));
      expect(yield* run(["deprecated-apis"]).pipe(Effect.isFailure)).toBe(true);
    }, providePlatform)
  );
  it.effect(
    "runs the full standalone deprecated API command through the shard program",
    Effect.fnUntraced(function* () {
      yield* runShardCommand(["deprecated-apis", "--full"], {});
      expect(execution.mock.calls[0]?.[0]).toMatchObject({
        command: "./node_modules/.bin/eslint",
        args: [
          "--cache",
          "--cache-location",
          "node_modules/.cache/eslint-deprecated-apis/.eslintcache-apps__architecture-lab-proof",
          "--cache-strategy",
          "content",
          "--config",
          "eslint.config.mjs",
          "apps/architecture-lab-proof",
        ],
        env: { BEEP_ESLINT_PROFILE: "deprecated-apis", NODE_OPTIONS: "--max-old-space-size=8192" },
      });
    }, providePlatform)
  );
  it.effect(
    "runs the hosted standalone deprecated API command through the shard program",
    Effect.fnUntraced(function* () {
      yield* runShardCommand(["deprecated-apis", "--base", "refs/heads/caller-base"], { CI: "true" });
      expect(execution.mock.calls[0]?.[0].command).toBe("./node_modules/.bin/eslint");
      expect(execution.mock.calls[0]?.[0].env?.BEEP_ESLINT_PROFILE).toBe("deprecated-apis");
      expect(execution.mock.calls[0]?.[0].args).not.toContain("--affected");
    }, providePlatform)
  );
  it.effect(
    "passes the standalone caller base only to its affected Turbo child",
    Effect.fnUntraced(function* () {
      const ambientBase = yield* Config.option(Config.String("TURBO_SCM_BASE"));
      // The command reads CI through the test's empty provider, so this is the local affected path.
      yield* run(["deprecated-apis", "--base", "refs/heads/caller-base"]);
      const invocation = execution.mock.calls[0]?.[0];
      expect(invocation?.args).toContain("--affected");
      expect(invocation?.env?.TURBO_SCM_BASE).toBe("refs/heads/caller-base");
      expect(yield* Config.option(Config.String("TURBO_SCM_BASE"))).toEqual(ambientBase);
    }, providePlatform)
  );
  it.effect(
    "tolerates unmatched deprecated API targets only for lab packages",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      yield* run(["deprecated-apis", "--package", `${root}/apps/labs/ciops`]);
      expect(execution.mock.calls[0]?.[0].args).toEqual([
        "--config",
        `${root}/eslint.config.mjs`,
        "--no-error-on-unmatched-pattern",
        "apps/labs/ciops",
      ]);
      execution.mockClear();
      yield* run(["deprecated-apis", "--package", `${root}/apps/labsx/member`]);
      expect(execution.mock.calls[0]?.[0].args).not.toContain("--no-error-on-unmatched-pattern");
    }, providePlatform)
  );
  it.effect(
    "retains an explicit heap cap and other Node options",
    Effect.fnUntraced(function* () {
      yield* run(["deprecated-apis", "--package", "."], { NODE_OPTIONS: "--trace-warnings --max-old-space-size=2048" });
      expect(execution.mock.calls[0]?.[0].env?.NODE_OPTIONS).toBe("--trace-warnings --max-old-space-size=2048");
    }, providePlatform)
  );
  it.effect(
    "runs package docs with zero warnings and appends a missing heap cap",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      yield* run(["jsdoc", "--package", "."], { NODE_OPTIONS: "--trace-warnings" });
      expect(execution).toHaveBeenCalledExactlyOnceWith({
        command: `${root}/node_modules/.bin/eslint`,
        args: ["--config", `${root}/eslint.config.mjs`, "--max-warnings=0", "--no-warn-ignored", prefix],
        cwd: root,
        env: { BEEP_ESLINT_PROFILE: "docs", NODE_OPTIONS: "--trace-warnings --max-old-space-size=8192" },
        extendEnv: true,
        stdio: "inherit",
      });
    }, providePlatform)
  );
  it.effect(
    "rejects missing or ambiguous jsdoc scope before spawning",
    Effect.fnUntraced(function* () {
      expect(yield* run(["jsdoc"]).pipe(Effect.isFailure)).toBe(true);
      expect(yield* run(["jsdoc", "--package", ".", "--root-only"]).pipe(Effect.isFailure)).toBe(true);
      expect(execution).not.toHaveBeenCalled();
    }, providePlatform)
  );
  it.effect(
    "selects root docs outside workspace directories and labs, and skips an empty selection",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lint-workers-" });
      yield* fs.writeFileString(
        `${fixtureRoot}/package.json`,
        yield* jsonStringifyPretty({
          name: "fixture",
          workspaces: ["packages/*", "apps/*"],
        })
      );
      for (const dir of ["packages/member", "packages/unowned", "apps/labs/orphan", "infra"]) {
        yield* fs.makeDirectory(`${fixtureRoot}/${dir}`, { recursive: true });
        yield* fs.writeFileString(`${fixtureRoot}/${dir}/example.ts`, "export {};\n");
      }
      yield* fs.writeFileString(`${fixtureRoot}/packages/member/package.json`, '{"name":"member"}');
      selection.root = fixtureRoot;
      try {
        yield* run(["jsdoc", "--root-only"]);
        expect(execution).toHaveBeenCalledExactlyOnceWith({
          command: `${fixtureRoot}/node_modules/.bin/eslint`,
          args: [
            "--config",
            `${fixtureRoot}/eslint.config.mjs`,
            "--max-warnings=0",
            "--no-warn-ignored",
            "infra/example.ts",
            "packages/unowned/example.ts",
          ],
          cwd: fixtureRoot,
          env: { BEEP_ESLINT_PROFILE: "docs", NODE_OPTIONS: "--max-old-space-size=8192" },
          extendEnv: true,
          stdio: "inherit",
        });
        execution.mockClear();
        yield* fs.remove(`${fixtureRoot}/infra/example.ts`);
        yield* fs.remove(`${fixtureRoot}/packages/unowned/example.ts`);
        yield* run(["jsdoc", "--root-only"]);
        expect(execution).not.toHaveBeenCalled();
      } finally {
        selection.root = "";
      }
    }, providePlatform)
  );
  it.effect(
    "runs laws in process and propagates findings without subprocesses",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "lint-laws-worker-" });
      yield* fs.makeDirectory(`${root}/packages/fixture/src`, { recursive: true });
      yield* fs.writeFileString(`${root}/packages/fixture/package.json`, '{"name":"@beep/fixture"}');
      yield* fs.writeFileString(`${root}/packages/fixture/tsconfig.test.json`, '{"include":["src","test"]}');
      yield* fs.writeFileString(`${root}/packages/fixture/src/index.ts`, "export const value = 1;");
      selection.root = root;
      try {
        yield* run(["laws", "--package", `${root}/packages/fixture`]);
        expect(execution).not.toHaveBeenCalled();
        yield* fs.makeDirectory(`${root}/packages/failing/src`, { recursive: true });
        yield* fs.writeFileString(`${root}/packages/failing/package.json`, '{"name":"@beep/failing"}');
        yield* fs.writeFileString(`${root}/packages/failing/tsconfig.test.json`, '{"include":["src"]}');
        yield* fs.writeFileString(`${root}/packages/failing/src/index.ts`, "export const value = new Set();");
        expect(yield* run(["laws", "--package", `${root}/packages/failing`]).pipe(Effect.isFailure)).toBe(true);
        expect(execution).not.toHaveBeenCalled();
      } finally {
        selection.root = "";
      }
    }, providePlatform)
  );
  it.effect(
    "propagates eslint worker failures",
    Effect.fnUntraced(function* () {
      execution.mockImplementation(() => Effect.succeed(7));
      expect(yield* run(["deprecated-apis", "--package", "."]).pipe(Effect.isFailure)).toBe(true);
      expect(yield* run(["jsdoc", "--package", "."]).pipe(Effect.isFailure)).toBe(true);
    }, providePlatform)
  );
});

// These tests spawn the CLI (ts-morph, eslint) for real; under coverage instrumentation on a
// two-worker hosted runner the laws worker took 40 s on main and 60 s on PR #1079, so an explicit
// 60 s cap raced the runner instead of catching hangs. The budget equals the package config's
// coverage and deep-sweep `testTimeout` (300 s) so no per-test cap sits below the lane's own;
// a hang still fails here because the CLI bounds its children.
const EXECUTED_WORKER_TIMEOUT_MILLIS = 300_000;

describe("executed lint workers", { concurrent: false }, () => {
  it.effect(
    "executes deprecated APIs on the ciops lab package",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      const result = yield* StepExec.runCaptured({
        command: "bun",
        args: ["run", `${root}/${prefix}/src/bin.ts`, "--", "lint", "deprecated-apis", "--package", "."],
        cwd: `${root}/apps/labs/ciops`,
        env: R.filter(process.env, (_, key) => !Str.startsWith("VITEST")(key)),
        extendEnv: false,
      });
      expect(result.exitCode, result.output).toBe(0);
    }, providePlatform),
    EXECUTED_WORKER_TIMEOUT_MILLIS
  );
  for (const worker of ["laws", "jsdoc", "deprecated-apis"]) {
    it.effect(
      `executes ${worker} against a fixture package surface`,
      Effect.fnUntraced(function* () {
        const root = yield* findRepoRoot();
        const fs = yield* FileSystem.FileSystem;
        // A source in the CLI project is inspected by both ESLint profiles.
        const fixture = yield* fs.makeTempDirectoryScoped({
          directory: `${root}/${prefix}/src`,
          prefix: "lint-worker-fixture-",
        });
        yield* fs.writeFileString(`${fixture}/index.ts`, "export {};\n");
        if (worker === "laws") yield* fs.writeFileString(`${fixture}/tsconfig.test.json`, '{"include":["index.ts"]}');
        const { exitCode, output } = yield* StepExec.runCaptured({
          command: "bun",
          args: ["run", `${root}/${prefix}/src/bin.ts`, "--", "lint", worker, "--package", "."],
          cwd: fixture,
          env: R.filter(
            process.env,
            (_, key) => !A.contains(["VITEST", "VITEST_MODE", "VITEST_POOL_ID", "VITEST_WORKER_ID"], key)
          ),
          extendEnv: false,
        });
        expect(exitCode, output).toBe(0);
        if (worker === "laws") {
          expect(output).not.toContain("skipping four laws");
          expect(output).toContain("project_source_files=1");
          expect(output).toContain("package-test-imports");
        }
      }, providePlatform),
      EXECUTED_WORKER_TIMEOUT_MILLIS
    );
  }
});
