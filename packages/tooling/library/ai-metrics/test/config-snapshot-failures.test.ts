import { Git, GitCommandError, NotARepositoryError } from "@beep/git/Git";
import {
  AiMetricsConfigSnapshotBudget,
  AiMetricsConfigSnapshotInput,
  makeAiMetricsConfigSnapshot,
  writeAiMetricsConfigSnapshotArtifacts,
} from "@beep/repo-ai-metrics/config-snapshot";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";

// `Git` rides over the platform spawner: the snapshot reads the index through the kit (W2b).
const GitNodeServices = Layer.provideMerge(Git.layer, NodeServices.layer);

const denied = PlatformError.systemError({
  _tag: "PermissionDenied",
  module: "FileSystem",
  method: "snapshot fixture",
  description: "Synthetic permission denial",
});

it.layer(GitNodeServices, { timeout: "30 seconds" })("config snapshot failure boundaries", (it) => {
  it.effect("keeps the previous latest pointer when any artifact publication step fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const repoRoot = path.join(root, "repo");
      yield* fs.makeDirectory(repoRoot);
      yield* fs.writeFileString(path.join(repoRoot, "AGENTS.md"), "Synthetic instructions\n");
      const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
      const outputDir = path.join(root, "artifacts");
      yield* fs.makeDirectory(outputDir);
      const latestPath = path.join(outputDir, "latest.json");
      yield* fs.writeFileString(latestPath, "previous pointer\n");
      const failures: ReadonlyArray<{
        readonly message: string;
        readonly filesystem: FileSystem.FileSystem;
      }> = [
        {
          message: "Failed to create AI metrics config snapshot artifact directory.",
          filesystem: { ...fs, makeDirectory: () => Effect.fail(denied) },
        },
        {
          message: "Failed to write AI metrics config snapshot manifest.",
          filesystem: { ...fs, writeFileString: () => Effect.fail(denied) },
        },
        {
          message: "Failed to write AI metrics latest config snapshot temporary pointer.",
          filesystem: {
            ...fs,
            writeFileString: (file, content, options) =>
              Str.endsWith(".tmp")(file) ? Effect.fail(denied) : fs.writeFileString(file, content, options),
          },
        },
        {
          message: "Failed to promote AI metrics latest config snapshot pointer.",
          filesystem: { ...fs, rename: () => Effect.fail(denied) },
        },
      ];
      for (const { message, filesystem } of failures) {
        const failure = yield* writeAiMetricsConfigSnapshotArtifacts({ outputDir, result }).pipe(
          Effect.provideService(FileSystem.FileSystem, filesystem),
          Effect.flip
        );
        expect(failure.message).toBe(message);
        expect(failure.cause).toBe(denied);
        expect(yield* fs.readFileString(latestPath)).toBe("previous pointer\n");
      }
    })
  );

  it.effect("retains the platform cause when probing Git or resolving the indexed checkout fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const init = yield* ChildProcess.make("git", ["init", "--quiet"], { cwd: root });
      expect(yield* init.exitCode).toBe(0);
      const input = AiMetricsConfigSnapshotInput.make({ repoRoot: root });
      const cases: ReadonlyArray<{
        readonly message: string;
        readonly service: ChildProcessSpawner.ChildProcessSpawner["Service"];
      }> = [
        { message: "Cannot probe Git snapshot metadata.", service: { ...spawner, spawn: () => Effect.fail(denied) } },
        {
          message: "Cannot resolve indexed checkout root.",
          service: { ...spawner, string: () => Effect.fail(denied) },
        },
      ];
      for (const { message, service } of cases) {
        const failure = yield* makeAiMetricsConfigSnapshot(input).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, service),
          Effect.flip
        );
        expect(failure.message).toBe(message);
        expect(failure.cause).toBe(denied);
      }
      const emptyTop = yield* makeAiMetricsConfigSnapshot(input).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
          ...spawner,
          string: () => Effect.succeed("\n"),
        }),
        Effect.flip
      );
      expect(emptyTop.message).toBe("Git returned no indexed checkout root.");
    })
  );

  it.effect("fails closed when checkout ancestry cannot be read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const failure = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root })).pipe(
        Effect.provideService(FileSystem.FileSystem, { ...fs, realPath: () => Effect.fail(denied) }),
        Effect.flip
      );
      expect(failure.message).toBe("Cannot resolve Git snapshot ancestry.");
      expect(failure.cause).toBe(denied);
    })
  );

  it.effect("retains Git index launch, output, and exit failures rather than falling back to an untracked walk", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const init = yield* ChildProcess.make("git", ["init", "--quiet"], { cwd: root });
      expect(yield* init.exitCode).toBe(0);
      // The index read runs through `Git.lsFiles` (W2b): git never ran, its output overran the
      // kit's bound, or git reported an exit code.
      const failed = (fields: { readonly kind: "failed" | "truncated"; readonly exitCode?: number }) =>
        GitCommandError.make({ ...fields, args: ["ls-files", "--stage", "-z"], cwd: root, stderr: "" });
      const cases = [
        { error: failed({ kind: "failed" }), message: "Cannot start Git index enumeration." },
        { error: failed({ kind: "truncated" }), message: "Cannot read Git snapshot index." },
        { error: failed({ kind: "failed", exitCode: 1 }), message: "Git index enumeration failed." },
      ];
      for (const { error, message } of cases) {
        const failure = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root })).pipe(
          Effect.provideService(Git, Git.makeTest({ lsFiles: () => Effect.fail(error) })),
          Effect.flip
        );
        expect(failure.message).toBe(message);
        expect(failure.cause).toBe(error.exitCode ?? error);
      }
      const typed = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root })).pipe(
        Effect.provideService(
          Git,
          Git.makeTest({ lsFiles: () => Effect.fail(NotARepositoryError.make({ cwd: root })) })
        ),
        Effect.flip
      );
      expect(typed.message).toBe("Git index enumeration failed.");
      expect(typed.cause).toBe(128);
    })
  );

  it.effect("distinguishes inaccessible physical checkout and scan roots", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const init = yield* ChildProcess.make("git", ["init", "--quiet"], { cwd: root });
      expect(yield* init.exitCode).toBe(0);
      for (const failAt of [1, 2]) {
        let resolutions = 0;
        const filesystem: FileSystem.FileSystem = {
          ...fs,
          realPath: (file) => {
            resolutions += 1;
            return resolutions === failAt ? Effect.fail(denied) : fs.realPath(file);
          },
        };
        const failure = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root })).pipe(
          Effect.provideService(FileSystem.FileSystem, filesystem),
          Effect.flip
        );
        expect(failure.message).toBe(
          failAt === 1 ? "Cannot resolve physical checkout root." : "Cannot resolve indexed scan root."
        );
        expect(failure.cause).toBe(denied);
      }
    })
  );

  it.effect("indexes a checkout subdirectory and refuses a Git toplevel that skips its enclosing metadata", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = yield* fs.makeTempDirectoryScoped();
      const repoRoot = path.join(root, "repo");
      const subdirectory = path.join(repoRoot, "package");
      yield* fs.makeDirectory(subdirectory, { recursive: true });
      yield* fs.writeFileString(path.join(subdirectory, "AGENTS.md"), "Package-only instructions\n");
      for (const args of [
        ["init", "--quiet"],
        ["add", "package/AGENTS.md"],
      ]) {
        const command = yield* ChildProcess.make("git", args, { cwd: repoRoot });
        expect(yield* command.exitCode).toBe(0);
      }
      const input = AiMetricsConfigSnapshotInput.make({ repoRoot: subdirectory });
      const result = yield* makeAiMetricsConfigSnapshot(input);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.relativePath).toBe("AGENTS.md");
      const capped = yield* makeAiMetricsConfigSnapshot(
        AiMetricsConfigSnapshotInput.make({
          repoRoot: subdirectory,
          budget: AiMetricsConfigSnapshotBudget.make({ maxFiles: 0 }),
        })
      );
      expect(capped.files).toEqual([]);
      assertSome(capped.bounds.truncationReason, "max-files");
      const shallow = yield* makeAiMetricsConfigSnapshot(
        AiMetricsConfigSnapshotInput.make({
          repoRoot: subdirectory,
          budget: AiMetricsConfigSnapshotBudget.make({ maxDepth: 0 }),
        })
      );
      expect(shallow.files).toEqual([]);
      assertSome(shallow.bounds.truncationReason, "max-depth");
      const inconsistentTop = yield* makeAiMetricsConfigSnapshot(input).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
          ...spawner,
          string: () => Effect.succeed(root),
        }),
        Effect.flip
      );
      expect(inconsistentTop.message).toBe("Git skipped unresolved nested metadata.");
    })
  );

  it.effect("rejects a non-ancestor Git toplevel even when metadata disappears after the probe", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = yield* fs.makeTempDirectoryScoped();
      const unrelated = yield* fs.makeTempDirectoryScoped();
      const init = yield* ChildProcess.make("git", ["init", "--quiet"], { cwd: root });
      expect(yield* init.exitCode).toBe(0);
      const missing = PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method: "stat" });
      const failure = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root })).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
          ...spawner,
          string: () => Effect.succeed(unrelated),
        }),
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          stat: (file) => (path.basename(file) === ".git" ? Effect.fail(missing) : fs.stat(file)),
        }),
        Effect.flip
      );
      expect(failure.message).toBe("Git checkout root does not contain the scan root.");
    })
  );

  it.effect("honors a zero-depth budget and excludes a checkout placed at a config root", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "Root instructions\n");
      const nested = path.join(root, ".claude");
      yield* fs.makeDirectory(path.join(nested, ".git"), { recursive: true });
      yield* fs.writeFileString(path.join(nested, ".git/HEAD"), "ref: refs/heads/main\n");
      yield* fs.writeFileString(path.join(nested, "settings.json"), "{}\n");
      const normal = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root }));
      expect(normal.bounds.excludedNestedRootPaths).toContain(".claude");
      expect(normal.files).toHaveLength(1);
      expect(normal.files[0]?.relativePath).toBe("AGENTS.md");
      const bounded = yield* makeAiMetricsConfigSnapshot(
        AiMetricsConfigSnapshotInput.make({
          repoRoot: root,
          budget: AiMetricsConfigSnapshotBudget.make({ maxDepth: 0 }),
        })
      );
      expect(bounded.files).toEqual([]);
      assertSome(bounded.bounds.truncationReason, "max-depth");
    })
  );

  it.effect("does not treat a special filesystem object named .git as repository metadata", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "Synthetic instructions\n");
      const info = yield* fs.stat(root);
      const snapshot = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root })).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          stat: (file) =>
            path.basename(file) === ".git" ? Effect.succeed({ ...info, type: "Socket" }) : fs.stat(file),
        })
      );
      expect(snapshot.files).toHaveLength(1);
      expect(snapshot.files[0]?.relativePath).toBe("AGENTS.md");
    })
  );
});
