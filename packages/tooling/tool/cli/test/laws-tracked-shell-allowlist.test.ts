import { Git, GitCommandError } from "@beep/git/Git";
import {
  isTrackedShellAllowed,
  lawsCommand,
  runTrackedShellAllowlist,
  TrackedShellAllowlistOptions,
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

const runGit = Effect.fn("TrackedShellAllowlistTest.runGit")(function* (root: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const allowedFixtures = [
  ".claude/hooks/session-start.sh",
  ".codex/hooks/guard.sh",
  ".cursor/install.sh",
  "goals/demo/ops/replay.sh",
  "explorations/demo/assets/fetch.sh",
  "infra/r2-cache/check.sh",
  "scripts/cloud/bootstrap.sh",
  "packages/tooling/tool/cli/test/fixtures/models/locators.sh",
  "packages/tooling/tool/docgen/test/fixtures/section-example/tsc-wrapper.sh",
];

/** A checkout with every allowed shape plus `extra` tracked shell files, a staged deletion and an untracked file. */
const makeFixtureCheckout = Effect.fn("TrackedShellAllowlistTest.makeFixtureCheckout")(function* (
  extra: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "tracked-shell-allowlist-" });
  const write = Effect.fnUntraced(function* (file: string) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), "#!/usr/bin/env bash\n");
  });
  yield* fs.writeFileString(path.join(root, "bun.lock"), "");
  yield* Effect.forEach([...allowedFixtures, ...extra, "scripts/removed.sh"], write, { discard: true });
  yield* runGit(root, ["init", "--quiet"]);
  yield* runGit(root, ["add", "."]);
  yield* runGit(root, ["rm", "--cached", "--quiet", "scripts/removed.sh"]);
  yield* write("scripts/untracked.sh");
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
  describe("tracked-shell-allowlist law", { concurrent: false }, () => {
    it.effect("matches exact roots and files, never prefixes of them", () =>
      Effect.sync(() => {
        assertTrue(A.every(allowedFixtures, isTrackedShellAllowed));
        for (const file of [
          "scripts/release.sh",
          "scripts/cloud/helper.sh",
          ".claude-other/hook.sh",
          "goalsx/run.sh",
          "packages/tooling/tool/cli/test/fixtures/models/other.sh",
          "nested/.claude/hooks/hook.sh",
          "scripts/ci-cache-pilot-build.sh",
          "scripts/ci/ci-change-profile.sh",
        ]) {
          expect(isTrackedShellAllowed(file), file).toBe(false);
        }
      })
    );

    it.effect(
      "fails a strict scan on tracked shell outside the allowlist and ignores untracked and removed files",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(["scripts/release.sh", "packages/demo/run.sh"]);

        const summary = yield* runTrackedShellAllowlist(
          TrackedShellAllowlistOptions.make({ cwd: root, strictCheck: true })
        );

        expect(summary.trackedShellFiles).toBe(allowedFixtures.length + 2);
        expect(summary.allowedFiles).toBe(allowedFixtures.length);
        expect(summary.strictFailure).toBe(true);
        expect(A.map(summary.findings, (finding) => finding.file)).toEqual([
          "packages/demo/run.sh",
          "scripts/release.sh",
        ]);
      })
    );

    it.effect(
      "fails `laws tracked-shell-allowlist --check` and bare `lint laws` on the fixture",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout(["scripts/release.sh"]);
        yield* enterDirectory(root);

        const report = yield* runLaws(["tracked-shell-allowlist"]).pipe(withEmptyConfig, Effect.exit);
        const check = yield* runLaws(["tracked-shell-allowlist", "--check"]).pipe(withEmptyConfig, Effect.exit);
        const lint = yield* runLint(["laws"]).pipe(withEmptyConfig, Effect.exit);

        assertTrue(Exit.isSuccess(report), failureText(report));
        expect(failureText(check)).toContain("effect-governance-tracked-shell-allowlist: check failed.");
        expect(failureText(lint)).toContain("lint laws: tracked-shell-allowlist failed.");
      })
    );

    it.effect(
      "passes bare `lint laws` on a checkout with only allowed shell scripts",
      Effect.fnUntraced(function* () {
        const root = yield* makeFixtureCheckout([]);
        yield* enterDirectory(root);

        const lint = yield* runLint(["laws"]).pipe(withEmptyConfig, Effect.exit);

        assertTrue(Exit.isSuccess(lint), failureText(lint));
      })
    );

    it.effect(
      "fails with its execution error when the root or the git index cannot be read",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = yield* findRepoRoot();
        const options = TrackedShellAllowlistOptions.make({ cwd: repoRoot, strictCheck: true });

        const rootless = yield* runTrackedShellAllowlist(options).pipe(
          Effect.provideService(FileSystem.FileSystem, { ...fs, exists: () => Effect.succeed(false) }),
          Effect.flip
        );
        const unlisted = yield* runTrackedShellAllowlist(options).pipe(
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

        expect(rootless._tag).toBe("TrackedShellAllowlistExecutionError");
        expect(rootless.message).toContain("Failed to locate the repository root");
        expect(unlisted._tag).toBe("TrackedShellAllowlistExecutionError");
        expect(unlisted.message).toBe("git ls-files --stage -z failed with exit code 128.");
      })
    );

    it.effect(
      "passes on the real repository",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();

        const summary = yield* runTrackedShellAllowlist(
          TrackedShellAllowlistOptions.make({ cwd: repoRoot, strictCheck: true })
        );

        expect(A.map(summary.findings, (finding) => finding.file)).toEqual([]);
        expect(summary.strictFailure).toBe(false);
      })
    );
  });
});
