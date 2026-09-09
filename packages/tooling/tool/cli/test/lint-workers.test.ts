import { lintCommand } from "@beep/repo-cli/commands/Lint";
import { FsUtils, FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { BunServices } from "@effect/platform-bun";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import { Command } from "effect/unstable/cli";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({ root: "" }));
vi.mock("@beep/repo-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@beep/repo-utils")>();
  const { Effect } = await import("effect");
  return {
    ...original,
    findRepoRoot: () => (selection.root === "" ? original.findRepoRoot() : Effect.succeed(selection.root)),
  };
});
const execution = vi.hoisted(() => vi.fn());
vi.mock("../src/internal/process/StepExec.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@beep/repo-cli/internal/process/StepExec")>()),
  runToExit: execution,
}));
const platform = FsUtilsLive.pipe(Layer.provideMerge(BunServices.layer));
const runCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const run = (args: ReadonlyArray<string>, env: Record<string, string> = {}) =>
  Effect.runPromise(
    runCommand(args).pipe(
      Effect.provide(platform),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
      Effect.scoped
    )
  );
const root = await Effect.runPromise(findRepoRoot().pipe(Effect.provide(BunServices.layer)));
const prefix = "packages/tooling/tool/cli";
const packageFiles = (directory: string) =>
  Effect.runPromise(
    FsUtils.use((fs) =>
      fs.globFiles([`${directory}/**/*.{ts,tsx}`], {
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
      })
    ).pipe(
      Effect.map((files) => A.join(A.sort(files, Order.String), ",")),
      Effect.provide(platform)
    )
  );
beforeEach(() => execution.mockReset().mockImplementation(() => Effect.succeed(0)));

describe("thin lint workers", { concurrent: false }, () => {
  it("runs package deprecated APIs from the root without a cache and with the default heap cap", async () => {
    await run(["deprecated-apis", "--package", "."]);
    expect(execution).toHaveBeenCalledExactlyOnceWith({
      command: `${root}/node_modules/.bin/eslint`,
      args: ["--config", `${root}/eslint.config.mjs`, prefix],
      cwd: root,
      env: { BEEP_ESLINT_PROFILE: "deprecated-apis", NODE_OPTIONS: "--max-old-space-size=4096" },
      extendEnv: true,
      stdio: "inherit",
    });
  });
  it("retains an explicit heap cap and other Node options", async () => {
    await run(["deprecated-apis", "--package", "."], { NODE_OPTIONS: "--trace-warnings --max-old-space-size=2048" });
    expect(execution.mock.calls[0]?.[0].env.NODE_OPTIONS).toBe("--trace-warnings --max-old-space-size=2048");
  });
  it("runs package docs with zero warnings and appends a missing heap cap", async () => {
    await run(["jsdoc", "--package", "."], { NODE_OPTIONS: "--trace-warnings" });
    expect(execution).toHaveBeenCalledExactlyOnceWith({
      command: `${root}/node_modules/.bin/eslint`,
      args: ["--config", `${root}/eslint.config.mjs`, "--max-warnings=0", "--no-warn-ignored", prefix],
      cwd: root,
      env: { BEEP_ESLINT_PROFILE: "docs", NODE_OPTIONS: "--trace-warnings --max-old-space-size=4096" },
      extendEnv: true,
      stdio: "inherit",
    });
  });
  it("rejects missing or ambiguous jsdoc scope before spawning", async () => {
    await expect(run(["jsdoc"])).rejects.toBeDefined();
    await expect(run(["jsdoc", "--package", ".", "--root-only"])).rejects.toBeDefined();
    expect(execution).not.toHaveBeenCalled();
  });
  it("selects root docs outside workspace directories and labs, and skips an empty selection", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
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
          yield* Effect.promise(() => run(["jsdoc", "--root-only"]));
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
            env: { BEEP_ESLINT_PROFILE: "docs", NODE_OPTIONS: "--max-old-space-size=4096" },
            extendEnv: true,
            stdio: "inherit",
          });
          execution.mockClear();
          yield* fs.remove(`${fixtureRoot}/infra/example.ts`);
          yield* fs.remove(`${fixtureRoot}/packages/unowned/example.ts`);
          yield* Effect.promise(() => run(["jsdoc", "--root-only"]));
          expect(execution).not.toHaveBeenCalled();
        } finally {
          selection.root = "";
        }
      }).pipe(Effect.provide(platform), Effect.scoped)
    );
  });
  it("runs all five scoped law checks serially with inherited environment", async () => {
    await run(["laws", "--package", "."]);
    const include = await packageFiles(prefix);
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
  });
  it.each(["apps/todox", "apps/labs/ciops", "infra"])("runs only four laws for %s", async (directory) => {
    await run(["laws", "--package", `${root}/${directory}`]);
    const include = await packageFiles(directory);
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
  });
  it("expands TS and TSX across the package, excludes artifacts, and skips empty law surfaces", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
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
          yield* Effect.promise(() => run(["laws", "--package", `${fixtureRoot}/${directory}`]));
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
          yield* Effect.promise(() => run(["laws", "--package", `${fixtureRoot}/${directory}`]));
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
      }).pipe(Effect.provide(platform), Effect.scoped)
    );
  });
  it("propagates eslint failure and stops laws at the first failure", async () => {
    execution.mockImplementation(() => Effect.succeed(7));
    await expect(run(["deprecated-apis", "--package", "."])).rejects.toBeDefined();
    await expect(run(["jsdoc", "--package", "."])).rejects.toBeDefined();
    execution.mockClear();
    await expect(run(["laws", "--package", "."])).rejects.toBeDefined();
    expect(execution).toHaveBeenCalledTimes(1);
  });
});

describe("executed lint workers", { concurrent: false }, () => {
  it.each(["laws", "jsdoc", "deprecated-apis"])(
    "executes %s against a fixture package surface",
    async (worker) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          // Keep the temporary source in the real CLI TypeScript project so both
          // ESLint profiles inspect it; test/fixtures is excluded by the docs profile.
          const fixture = yield* fs.makeTempDirectoryScoped({
            directory: `${root}/${prefix}/src`,
            prefix: "lint-worker-fixture-",
          });
          yield* fs.writeFileString(`${fixture}/index.ts`, "export {};\n");
          const child = Bun.spawn(
            ["bun", "run", `${root}/${prefix}/src/bin.ts`, "--", "lint", worker, "--package", "."],
            {
              cwd: fixture,
              env: {
                ...Bun.env,
                VITEST: undefined,
                VITEST_MODE: undefined,
                VITEST_POOL_ID: undefined,
                VITEST_WORKER_ID: undefined,
              },
              stdin: "ignore",
              stdout: "pipe",
              stderr: "pipe",
            }
          );
          const [code, stdout, stderr] = yield* Effect.promise(() =>
            Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          );
          expect(code, `${stdout}\n${stderr}`).toBe(0);
          if (worker === "laws") {
            expect(stdout).not.toContain("skipping four laws");
            expect(stdout).toContain("scanned_files=1");
            expect(stdout).toContain("package-test-imports");
          }
        }).pipe(Effect.provide(platform), Effect.scoped)
      ),
    60000
  );
});
