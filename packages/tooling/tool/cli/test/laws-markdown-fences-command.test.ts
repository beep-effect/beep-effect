import {
  lawsCommand,
  MarkdownFencesOptions,
  MarkdownFenceTypechecker,
  runMarkdownFences,
} from "@beep/repo-cli/commands/Laws";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
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
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));
const TestLayer = MarkdownFenceTypechecker.layer.pipe(Layer.provideMerge(PlatformLayer));
const runInProcess = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const encoder = new TextEncoder();

/** A finished compiler process with fixed combined output and exit code. */
const compilerHandle = (output: string, exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(encoder.encode(output)),
    stdout: Stream.make(encoder.encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

/** Replaces only the `tsrs` spawn with a stub; git and every other command still run. */
const withStubCompiler =
  (output: string, exitCode: number) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.flatMap(Effect.service(ChildProcessSpawner.ChildProcessSpawner), (real) =>
      Effect.provideService(
        self,
        ChildProcessSpawner.ChildProcessSpawner,
        ChildProcessSpawner.make((command) =>
          ChildProcess.isStandardCommand(command) && Str.endsWith("tsrs")(command.command)
            ? Effect.succeed(compilerHandle(output, exitCode))
            : real.spawn(command)
        )
      )
    );

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

const fence = Str.repeat(3)("`");
const markdownOf = (...lines: ReadonlyArray<string>): string => `${A.join(lines, "\n")}\n`;

const guide = markdownOf(
  "# Guide",
  `${fence}ts`,
  "export const ok: number = 1",
  fence,
  `${fence}ts`,
  'export const broken: number = "text"',
  fence,
  `${fence}ts skip-type-checking`,
  "partial(",
  fence,
  `${fence}ts`,
  "// @ts-ignore hides the next line",
  "export const hidden: number = 1",
  fence,
  `${fence}bash`,
  "echo ignored",
  fence
);
const generatedReadme = markdownOf(
  "<!-- docgen:api-reference:start -->",
  `${fence}ts`,
  "declare const generated: Missing",
  fence,
  "<!-- docgen:api-reference:end -->"
);
// Each fence is cut off before its closer, so the compiler reports it at the end of the staged file.
const unclosedFences = markdownOf(
  `${fence}ts`,
  "export const block = () => {",
  "  const value = 1",
  fence,
  `${fence}ts`,
  "export const call = Math.max(1,",
  "  2",
  fence,
  `${fence}ts`,
  "export const template = `unterminated ${1}",
  fence
);
const brokenHistory = markdownOf(`${fence}ts`, "const history: number = 'text'", fence);
const skillsLock = `${JSON.stringify({
  version: 2,
  skills: {
    demo: {
      _tag: "local",
      installedTargets: [".claude/skills/demo"],
      installedTreeHash: Str.repeat(64)("0"),
    },
  },
})}\n`;

const writeRepoFile = Effect.fn("MarkdownFencesCommandTest.writeRepoFile")(function* (
  root: string,
  file: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});

const runGit = Effect.fn("MarkdownFencesCommandTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  expect(yield* handle.exitCode).toBe(0);
});

/** A git checkout with the repository's compiler, a guidance file, a generated region and a history packet. */
const makeFixtureCheckout = Effect.fn("MarkdownFencesCommandTest.makeFixtureCheckout")(function* (
  withSkillsLock: boolean,
  guideText: string = guide
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "markdown-fences-" });
  yield* writeRepoFile(root, "bun.lock", "");
  yield* writeRepoFile(
    root,
    "tsconfig.json",
    '{ "compilerOptions": { "strict": true, "noEmit": true, "skipLibCheck": true, "types": [] } }\n'
  );
  if (withSkillsLock) {
    yield* writeRepoFile(root, "skills-lock.json", skillsLock);
  }
  yield* writeRepoFile(root, "docs/guide.md", guideText);
  yield* writeRepoFile(root, "packages/demo/README.md", generatedReadme);
  yield* writeRepoFile(root, "goals/demo/SPEC.md", brokenHistory);
  yield* fs.makeDirectory(path.join(root, "node_modules", ".bin"), { recursive: true });
  yield* fs.symlink(
    path.join(repoRoot, "node_modules", ".bin", "tsrs"),
    path.join(root, "node_modules", ".bin", "tsrs")
  );
  yield* runGit(root, ["init", "--quiet"]);
  yield* runGit(root, ["add", "bun.lock", "tsconfig.json", "docs", "packages", "goals"]);
  return root;
});

/** The command reads `process.cwd()`, so the test moves into the checkout for the rest of its scope. */
const enterDirectory = (directory: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const previous = process.cwd();
      process.chdir(directory);
      return previous;
    }),
    (previous) => Effect.sync(() => process.chdir(previous))
  );

it.layer(TestLayer, { timeout: "120 seconds" })((it) => {
  describe("markdown-fences law", { concurrent: false }, () => {
    it.effect(
      "fails a strict run with path:line diagnostics, skips opt-outs, generated regions and history",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(true);

        const summary = yield* runMarkdownFences(MarkdownFencesOptions.make({ cwd: root, strictCheck: true }));

        expect([
          summary.scannedFiles,
          summary.fenceFiles,
          summary.fences,
          summary.checkedFences,
          summary.optOutFences,
          summary.generatedFences,
        ]).toEqual([2, 2, 5, 3, 1, 1]);
        expect(summary.strictFailure).toBe(true);
        expect(
          A.flatMap(summary.failures, (failure) =>
            A.map(failure.diagnostics, (diagnostic) => `${diagnostic.path}:${diagnostic.line}:${diagnostic.code}`)
          )
        ).toEqual(["docs/guide.md:6:TS2322", "docs/guide.md:12:fence-suppression"]);
      })
    );

    it.effect(
      "fails unclosed braces, parentheses and templates reported at the end of a staged fence",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(true, unclosedFences);

        const summary = yield* runMarkdownFences(
          MarkdownFencesOptions.make({ cwd: root, strictCheck: true, pathPrefix: "docs/" })
        );

        expect(summary.checkedFences).toBe(3);
        expect(summary.strictFailure).toBe(true);
        // Every diagnostic lands on its fence's last body line: 3, 7 and 10.
        expect(
          A.map(summary.failures, (failure) =>
            A.dedupe(A.map(failure.diagnostics, (diagnostic) => `${diagnostic.path}:${diagnostic.line}`))
          )
        ).toEqual([["docs/guide.md:3"], ["docs/guide.md:7"], ["docs/guide.md:10"]]);
      })
    );

    it.effect(
      "narrows a run to a path prefix and passes a report run",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(true);

        const narrowed = yield* runMarkdownFences(
          MarkdownFencesOptions.make({ cwd: root, strictCheck: true, pathPrefix: "packages/" })
        );
        const report = yield* runMarkdownFences(MarkdownFencesOptions.make({ cwd: root }));

        expect([narrowed.scannedFiles, narrowed.checkedFences, narrowed.strictFailure]).toEqual([1, 0, false]);
        expect([report.failures.length, report.strictFailure]).toEqual([2, false]);
      })
    );

    it.effect(
      "reports as text, fails strict text and JSON checks, and passes a narrowed check",
      Effect.fnUntraced(function* () {
        yield* enterDirectory(yield* makeFixtureCheckout(true));

        const report = yield* runInProcess(["markdown-fences"]).pipe(withEmptyConfig, Effect.exit);
        const check = yield* runInProcess(["markdown-fences", "--check"]).pipe(withEmptyConfig, Effect.exit);
        const json = yield* runInProcess(["markdown-fences", "--check", "--json"]).pipe(withEmptyConfig, Effect.exit);
        const narrowed = yield* runInProcess(["markdown-fences", "--check", "--path", "packages/"]).pipe(
          withEmptyConfig,
          Effect.exit
        );

        assertTrue(Exit.isSuccess(report), failureText(report));
        expect(failureText(check)).toContain("effect-governance-markdown-fences: check failed.");
        expect(failureText(json)).toContain("effect-governance-markdown-fences: check failed.");
        assertTrue(Exit.isSuccess(narrowed), failureText(narrowed));
      })
    );

    it.effect(
      "fails with the law's execution error without a repository root or a skills lock",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bare = yield* fs.makeTempDirectoryScoped({ prefix: "markdown-fences-bare-" });
        const noLock = yield* makeFixtureCheckout(false);
        const run = (cwd: string) => runMarkdownFences(MarkdownFencesOptions.make({ cwd, strictCheck: true }));

        const noRoot = yield* run(bare).pipe(Effect.exit);
        const missingLock = yield* run(noLock).pipe(Effect.exit);

        expect(failureText(noRoot)).toContain("Failed to locate the repository root");
        expect(failureText(missingLock)).toContain("Failed to read skills-lock.json");
      })
    );
  });
});

// The command provides MarkdownFenceTypechecker.layer itself. Under a layer that has already
// built that layer, Effect memoizes the instance with the real spawner, so this block omits it.
it.layer(PlatformLayer, { timeout: "120 seconds" })((it) => {
  describe("markdown-fences law with a crashing compiler", { concurrent: false }, () => {
    it.effect(
      "fails the run and the --check command with the compiler error when the compiler crashes",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(true);
        const crash = withStubCompiler("Killed\n", 137);

        const run = yield* runMarkdownFences(MarkdownFencesOptions.make({ cwd: root, strictCheck: true })).pipe(
          Effect.provideServiceEffect(MarkdownFenceTypechecker, MarkdownFenceTypechecker.make),
          crash,
          Effect.exit
        );
        yield* enterDirectory(root);
        const check = yield* runInProcess(["markdown-fences", "--check"]).pipe(withEmptyConfig, crash, Effect.exit);

        run.pipe(Exit.isFailure, assertTrue);
        expect(failureText(run)).toContain("MarkdownFencesCompilerError");
        expect(failureText(run)).toContain("exited 137 without a fence diagnostic");
        expect(failureText(check)).toContain("exited 137 without a fence diagnostic");
        expect(failureText(check)).toContain("Killed");
        expect(failureText(check)).not.toContain("check failed.");
      })
    );
  });
});
