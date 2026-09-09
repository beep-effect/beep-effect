import { lintCommand } from "@beep/repo-cli/commands/Lint";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtils, FsUtilsLive, findRepoRoot, jsonStringifyPretty, TSMorphServiceLive } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as R from "effect/Record";
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
const prefix = "packages/tooling/tool/cli";
const packageFiles = Effect.fnUntraced(function* (directory: string) {
  const root = yield* findRepoRoot();
  const fs = yield* FsUtils;
  const files = yield* fs.globFiles([`${directory}/**/*.{ts,tsx}`], {
    cwd: root,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/*.d.tsx",
    ],
  });
  return A.join(A.sort(files, Order.String), ",");
});
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
      selection.root = root;
      try {
        expect(yield* run(["policy-fingerprint", "--check"]).pipe(Effect.isFailure)).toBe(true);
        yield* run(["policy-fingerprint", "--write"]);
        const file = `${root}/standards/policy-tools.fingerprint.json`;
        const declaration = yield* fs.readFileString(file);
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
    "runs all five scoped law checks serially with inherited environment",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      yield* run(["laws", "--package", "."]);
      const include = yield* packageFiles(prefix);
      const suffixes = [
        ["laws", "terse-effect", "--check", "--advisory", "--include", include],
        ["laws", "native-runtime", "--check", "--include", include],
        ["laws", "frozen-grant-set", "--check", "--include", include],
        ["laws", "effect-fn", "--check", "--include", include],
        ["lint", "package-test-imports", "--include-root", prefix],
      ];
      expect(execution).toHaveBeenCalledTimes(5);
      for (const [index, suffix] of suffixes.entries()) {
        expect(execution).toHaveBeenNthCalledWith(index + 1, {
          command: "bun",
          args: ["run", `${root}/packages/tooling/tool/cli/src/bin.ts`, "--", ...suffix],
          cwd: root,
          extendEnv: true,
          stdio: "inherit",
        });
      }
    }, providePlatform)
  );
  for (const directory of ["apps/todox", "apps/labs/ciops", "infra"])
    it.effect(
      `runs only four laws for ${directory}`,
      Effect.fnUntraced(function* () {
        const root = yield* findRepoRoot();
        yield* run(["laws", "--package", `${root}/${directory}`]);
        const include = yield* packageFiles(directory);
        expect(execution).toHaveBeenCalledTimes(4);
        for (const [index, law] of ["terse-effect", "native-runtime", "frozen-grant-set", "effect-fn"].entries()) {
          expect(execution).toHaveBeenNthCalledWith(index + 1, {
            command: "bun",
            args: [
              "run",
              `${root}/packages/tooling/tool/cli/src/bin.ts`,
              "--",
              "laws",
              law,
              "--check",
              ...(law === "terse-effect" ? ["--advisory"] : []),
              "--include",
              include,
            ],
            cwd: root,
            extendEnv: true,
            stdio: "inherit",
          });
        }
      }, providePlatform)
    );
  it.effect(
    "expands TS and TSX across the package, excludes artifacts, and skips empty law surfaces",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lint-law-surface-" });
      const directory = "packages/fixture";
      for (const file of [
        "src/index.ts",
        "src/view.tsx",
        "test/example.test.ts",
        "src/types.d.ts",
        "src/types.d.tsx",
        "node_modules/bad.ts",
        "dist/bad.ts",
        "build/bad.ts",
        ".turbo/bad.ts",
        "coverage/bad.ts",
      ]) {
        const target = `${fixtureRoot}/${directory}/${file}`;
        const path = yield* Path.Path;
        yield* fs.makeDirectory(path.dirname(target), { recursive: true });
        yield* fs.writeFileString(target, "export {};\n");
      }
      selection.root = fixtureRoot;
      try {
        yield* run(["laws", "--package", `${fixtureRoot}/${directory}`]);
        expect(execution).toHaveBeenCalledTimes(5);
        const include =
          "packages/fixture/src/index.ts,packages/fixture/src/view.tsx,packages/fixture/test/example.test.ts";
        for (const call of A.take(execution.mock.calls, 4)) {
          expect(call[0].args).toContain("--include");
          expect(call[0].args).toContain(include);
          expect(call[0].args).not.toContain("--include-prefix");
        }
        for (const file of ["src/index.ts", "src/view.tsx", "test/example.test.ts"]) {
          yield* fs.remove(`${fixtureRoot}/${directory}/${file}`);
        }
        execution.mockClear();
        yield* run(["laws", "--package", `${fixtureRoot}/${directory}`]);
        expect(execution).toHaveBeenCalledTimes(1);
        expect(execution.mock.calls[0]?.[0].args).toEqual([
          "run",
          `${fixtureRoot}/packages/tooling/tool/cli/src/bin.ts`,
          "--",
          "lint",
          "package-test-imports",
          "--include-root",
          directory,
        ]);
      } finally {
        selection.root = "";
      }
    }, providePlatform)
  );
  it.effect(
    "propagates eslint failure and stops laws at the first failure",
    Effect.fnUntraced(function* () {
      execution.mockImplementation(() => Effect.succeed(7));
      expect(yield* run(["deprecated-apis", "--package", "."]).pipe(Effect.isFailure)).toBe(true);
      expect(yield* run(["jsdoc", "--package", "."]).pipe(Effect.isFailure)).toBe(true);
      execution.mockClear();
      expect(yield* run(["laws", "--package", "."]).pipe(Effect.isFailure)).toBe(true);
      expect(execution).toHaveBeenCalledTimes(1);
    }, providePlatform)
  );
});

describe("executed lint workers", { concurrent: false }, () => {
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
          expect(output).toContain("scanned_files=1");
          expect(output).toContain("package-test-imports");
        }
      }, providePlatform),
      60000
    );
  }
});
