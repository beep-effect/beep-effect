import { Git, GitCommandError } from "@beep/git/Git";
import {
  formatNoTrackedPythonFinding,
  isTrackedPythonPath,
  lawsCommand,
  NoTrackedPythonFinding,
  NoTrackedPythonOptions,
  runNoTrackedPython,
} from "@beep/repo-cli/commands/Laws";
import { lintLawsCommand } from "@beep/repo-cli/commands/Lint";
import { FsUtilsLive, findRepoRoot, TSMorphServiceLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { NodeTestLayer } from "./support/CommandTest.ts";

// `lint laws` also builds the package-scan TSMorph service, which the repository mode never uses.
const PlatformLayer = Layer.mergeAll(FsUtilsLive, TSMorphServiceLive).pipe(Layer.provideMerge(NodeTestLayer));
const runLaws = Command.runWith(lawsCommand, { version: "0.0.0" });
const runLint = Command.runWith(Command.make("lint").pipe(Command.withSubcommands([lintLawsCommand])), {
  version: "0.0.0",
});
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

const runGit = Effect.fn("NoTrackedPythonTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

/** Files every fixture tracks: no Python, and names that only resemble it. */
const cleanFixtures = ["README.md", "docs/python.md", "packages/demo/src/py.ts", "scripts/cloud/bootstrap.sh"];

/**
 * A checkout tracking the clean files plus `extra`, with a staged deletion of a
 * `.py`, an untracked `.py` and a gitlink whose path ends in `.py`.
 */
const makeFixtureCheckout = Effect.fn("NoTrackedPythonTest.makeFixtureCheckout")(function* (
  extra: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "no-tracked-python-" });
  const write = Effect.fnUntraced(function* (file: string) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), "print('hello')\n");
  });
  yield* fs.writeFileString(path.join(root, "bun.lock"), "");
  yield* Effect.forEach([...cleanFixtures, ...extra, "scripts/removed.py"], write, { discard: true });
  yield* runGit(root, ["init", "--quiet"]);
  yield* runGit(root, ["add", "."]);
  yield* runGit(root, ["rm", "--cached", "--quiet", "scripts/removed.py"]);
  yield* runGit(root, [
    "update-index",
    "--add",
    "--cacheinfo",
    "160000,0123456789abcdef0123456789abcdef01234567,vendor/module.py",
  ]);
  yield* write("scratch/untracked.py");
  return root;
});

/** The commands read `process.cwd()`, so the test moves into the checkout for the rest of its scope. */
const enterDirectory = (directory: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = process.cwd();
      process.chdir(directory);
      return previous;
    }),
    (previous) => Effect.sync(() => process.chdir(previous))
  );

it.layer(PlatformLayer, { timeout: "60 seconds" })((it) => {
  describe("no-tracked-python law", { concurrent: false }, () => {
    it.effect("bans Python sources, stubs, windowed scripts and notebooks only", () =>
      Effect.sync(() => {
        for (const file of ["probe.py", "goals/demo/ops/run.py", "types/stub.pyi", "tools/app.pyw", "nb/a.ipynb"]) {
          expect(isTrackedPythonPath(file), file).toBe(true);
        }
        for (const file of ["docs/python.md", "src/py.ts", "cache/mod.pyc", "Probe.PY", "py", "notes.ipynb.md"]) {
          expect(isTrackedPythonPath(file), file).toBe(false);
        }
        expect(formatNoTrackedPythonFinding(NoTrackedPythonFinding.make({ file: "probe.py" }))).toBe(
          "probe.py  port it to TypeScript or run it outside the repository; tracked Python is banned"
        );
      })
    );

    it.effect(
      "fails a strict scan on tracked Python and ignores untracked files, removed files and gitlinks",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(["tools/probe.py", "types/stub.pyi", "research/nb.ipynb", "w.pyw"]);

        const summary = yield* runNoTrackedPython(NoTrackedPythonOptions.make({ cwd: root, strictCheck: true }));
        const report = yield* runNoTrackedPython(NoTrackedPythonOptions.make({ cwd: root }));

        expect(summary.trackedPythonFiles).toBe(4);
        expect(summary.strictFailure).toBe(true);
        expect(A.map(summary.findings, (finding) => finding.file)).toEqual([
          "research/nb.ipynb",
          "tools/probe.py",
          "types/stub.pyi",
          "w.pyw",
        ]);
        expect(report.strictFailure).toBe(false);
        expect(report.trackedPythonFiles).toBe(4);
      })
    );

    it.effect(
      "fails `laws no-tracked-python --check` and bare `lint laws` on a checkout tracking a .py",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(["tools/probe.py"]);
        yield* enterDirectory(root);

        const report = yield* runLaws(["no-tracked-python"]).pipe(withEmptyConfig, Effect.exit);
        const json = yield* runLaws(["no-tracked-python", "--json"]).pipe(withEmptyConfig, Effect.exit);
        const check = yield* runLaws(["no-tracked-python", "--check"]).pipe(withEmptyConfig, Effect.exit);
        const lint = yield* runLint(["laws"]).pipe(withEmptyConfig, Effect.exit);

        assertTrue(Exit.isSuccess(report), failureText(report));
        assertTrue(Exit.isSuccess(json), failureText(json));
        expect(failureText(check)).toContain("effect-governance-no-tracked-python: check failed.");
        expect(failureText(lint)).toContain("lint laws: no-tracked-python failed.");
      })
    );

    it.effect(
      "names every failed repository law when shell and Python both fail",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(["tools/probe.py", "scripts/release.sh"]);
        yield* enterDirectory(root);

        const lint = yield* runLint(["laws"]).pipe(withEmptyConfig, Effect.exit);

        expect(failureText(lint)).toContain("lint laws: tracked-shell-allowlist, no-tracked-python failed.");
      })
    );

    it.effect(
      "passes `--check` and bare `lint laws` when Python is only untracked, removed or a gitlink",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout([]);
        yield* enterDirectory(root);

        const check = yield* runLaws(["no-tracked-python", "--check"]).pipe(withEmptyConfig, Effect.exit);
        const lint = yield* runLint(["laws"]).pipe(withEmptyConfig, Effect.exit);

        assertTrue(Exit.isSuccess(check), failureText(check));
        assertTrue(Exit.isSuccess(lint), failureText(lint));
      })
    );

    it.effect(
      "fails with its execution error when the root or the git index cannot be read",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = yield* findRepoRoot();
        const options = NoTrackedPythonOptions.make({ cwd: repoRoot, strictCheck: true });

        const rootless = yield* runNoTrackedPython(options).pipe(
          Effect.provideService(FileSystem.FileSystem, { ...fs, exists: () => Effect.succeed(false) }),
          Effect.flip
        );
        const unlisted = yield* runNoTrackedPython(options).pipe(
          Effect.provideService(
            Git,
            Git.makeTest({
              lsFiles: () =>
                Effect.fail(
                  GitCommandError.make({
                    kind: "failed",
                    args: ["ls-files"],
                    cwd: repoRoot,
                    exitCode: 128,
                    stderr: "fatal",
                  })
                ),
            })
          ),
          Effect.flip
        );

        expect(rootless._tag).toBe("NoTrackedPythonExecutionError");
        expect(rootless.message).toContain("Failed to locate the repository root");
        expect(unlisted._tag).toBe("NoTrackedPythonExecutionError");
        expect(unlisted.message).toBe("git ls-files --stage -z failed with exit code 128.");
      })
    );
  });
});
