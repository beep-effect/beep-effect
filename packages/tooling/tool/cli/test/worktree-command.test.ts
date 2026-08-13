import {
  addWorktree,
  branchDeleteCommand,
  copyLocalFiles,
  defaultWorktreeBranch,
  parseWorktreePorcelain,
  resolveWorktreeContext,
  WORKTREE_LOCAL_FILE_ENTRIES,
  worktreeAddArgs,
  worktreeDoctorReportForContext,
  worktreeRemoveArgs,
} from "@beep/repo-cli/commands/Worktree";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess } from "effect/unstable/process";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

const runGit = Effect.fn("WorktreeCommandTest.runGit")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const initScratchRepo = Effect.fn("WorktreeCommandTest.initScratchRepo")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# scratch\n");
  yield* fs.writeFileString(path.join(repoRoot, ".env"), "SECRET=local-only\n");
  yield* runGit(repoRoot, ["init"]);
  yield* runGit(repoRoot, ["config", "user.email", "worktree-test@example.com"]);
  yield* runGit(repoRoot, ["config", "user.name", "Worktree Test"]);
  yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
  yield* runGit(repoRoot, ["add", "README.md"]);
  yield* runGit(repoRoot, ["commit", "-m", "init"]);
});

const withScratchRepo = <A, E, R>(use: (repoRoot: string) => Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();
        yield* initScratchRepo(tmpDir);
        return { fs, tmpDir } as const;
      }),
      ({ tmpDir }) => use(tmpDir),
      ({ fs, tmpDir }) => fs.remove(tmpDir, { recursive: true, force: true }).pipe(Effect.ignore)
    ).pipe(provideScopedLayer(testLayer))
  );

describe("worktree argument builders", () => {
  it("builds a worktree add argv with a new branch", () => {
    expect(worktreeAddArgs("/repo-worktrees/feature-x", "feat/feature-x")).toEqual([
      "worktree",
      "add",
      "/repo-worktrees/feature-x",
      "-b",
      "feat/feature-x",
    ]);
  });

  it("builds a worktree remove argv, forced and unforced", () => {
    expect(worktreeRemoveArgs("/repo-worktrees/feature-x", false)).toEqual([
      "worktree",
      "remove",
      "/repo-worktrees/feature-x",
    ]);
    expect(worktreeRemoveArgs("/repo-worktrees/feature-x", true)).toEqual([
      "worktree",
      "remove",
      "--force",
      "/repo-worktrees/feature-x",
    ]);
  });

  it("derives the default branch and branch-delete hint from a name", () => {
    expect(defaultWorktreeBranch("feature-x")).toBe("feat/feature-x");
    expect(branchDeleteCommand("feat/feature-x")).toBe("git branch -D feat/feature-x");
  });

  it("copies a fixed set of local-only files", () => {
    expect(WORKTREE_LOCAL_FILE_ENTRIES).toEqual([
      ".env",
      ".claude/settings.local.json",
      "CLAUDE.local.md",
      ".idea/compiler.xml",
      ".idea/effect.intellij.xml",
    ]);
  });
});

describe("parseWorktreePorcelain", () => {
  it("parses a branch entry, a detached+locked entry, and a prunable entry", () => {
    const entries = parseWorktreePorcelain(
      [
        "worktree /repo",
        "HEAD 1111111111111111111111111111111111111111",
        "branch refs/heads/main",
        "",
        "worktree /repo-worktrees/pinned",
        "HEAD 2222222222222222222222222222222222222222",
        "detached",
        "locked pinned for a while",
        "",
        "worktree /tmp/stale",
        "HEAD 3333333333333333333333333333333333333333",
        "detached",
        "prunable gitdir file points to non-existent location",
        "",
      ].join("\n")
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ path: "/repo", branch: "main", detached: false, locked: false });
    expect(entries[1]).toMatchObject({ path: "/repo-worktrees/pinned", branch: null, detached: true, locked: true });
    expect(entries[2]).toMatchObject({ path: "/tmp/stale", detached: true, prunable: true });
  });
});

describe("worktree git operations", () => {
  it.effect("adds a worktree, copies local files, and reports it via doctor", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        const context = yield* resolveWorktreeContext(repoRoot);
        expect(context.currentRoot).toBe(repoRoot);
        expect(context.worktreesRoot).toBe(`${context.mainCheckout}-worktrees`);

        const targetPath = yield* addWorktree(context, "demo", defaultWorktreeBranch("demo"));
        expect(yield* fs.exists(targetPath)).toBe(true);
        expect(targetPath).toBe(path.join(context.worktreesRoot, "demo"));

        const copies = yield* copyLocalFiles(context.mainCheckout, targetPath);
        const envCopy = copies.find((copy) => copy.entry === ".env");
        const claudeCopy = copies.find((copy) => copy.entry === ".claude/settings.local.json");
        expect(envCopy?.status).toBe("copied");
        expect(claudeCopy?.status).toBe("skipped");
        expect(yield* fs.exists(path.join(targetPath, ".env"))).toBe(true);

        const refreshed = yield* resolveWorktreeContext(repoRoot);
        const report = yield* worktreeDoctorReportForContext(refreshed);
        expect(report.worktreesRoot).toBe(context.worktreesRoot);
        const demoEntry = report.entries.find((entry) => entry.path === targetPath);
        expect(demoEntry?.branch).toBe("feat/demo");
        expect(demoEntry?.hasEnv).toBe(true);
        expect(demoEntry?.hasNodeModules).toBe(false);
      })
    )
  );

  it.effect("refuses to add a second worktree at an occupied path", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const context = yield* resolveWorktreeContext(repoRoot);
        yield* addWorktree(context, "demo", defaultWorktreeBranch("demo"));
        const error = yield* addWorktree(context, "demo", defaultWorktreeBranch("demo")).pipe(Effect.flip);
        expect(error._tag).toBe("WorktreeExistsError");
      })
    )
  );
});
