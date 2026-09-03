import {
  addWorktree,
  branchDeleteCommand,
  copyLocalFiles,
  defaultWorktreeBranch,
  parseWorktreePorcelain,
  renderWorktreeRemovalReceipt,
  resolveWorktreeContext,
  runWorktreeGitCapture,
  WORKTREE_LOCAL_FILE_ENTRIES,
  WorktreeArchivePlan,
  WorktreeCommandError,
  WorktreeDirtyError,
  WorktreeDoctorEntry,
  WorktreeExistsError,
  WorktreePreservationError,
  WorktreeRemovalReceipt,
  WorktreeRemovalRequest,
  WorktreeRemovalService,
  WorktreeRemovalServiceLive,
  WorktreeRepositoryHash,
  WorktreeResidueManifest,
  worktreeAddArgs,
  worktreeArchivePlan,
  worktreeArchiveRefArgs,
  worktreeBranchDeleteArgs,
  worktreeCommand,
  worktreeDoctorEntryLines,
  worktreeDoctorReportForContext,
  worktreeRemoveArgs,
  worktreeResidueReason,
} from "@beep/repo-cli/commands/Worktree";
import { NonEmptyTrimmedStr } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { ISOStr } from "@beep/schema/Timestamp";
import { A, O, P, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path, Runtime, Stream } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const worktreeRemovalTestLayer = WorktreeRemovalServiceLive.pipe(Layer.provide(NodeServices.layer));
const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer, worktreeRemovalTestLayer);

const encodeResidueManifest = S.encodeEffect(S.fromJsonString(WorktreeResidueManifest));
const decodeResidueManifest = S.decodeUnknownEffect(S.fromJsonString(WorktreeResidueManifest));
const decodeResidueManifestValue = S.decodeUnknownEffect(WorktreeResidueManifest);
const residueManifestJson = S.fromJsonString(WorktreeResidueManifest);
const removalReceiptJson = S.fromJsonString(WorktreeRemovalReceipt);
const archivePlanJson = S.fromJsonString(WorktreeArchivePlan);

const collectRemovalReceiptLines = Effect.fn("WorktreeCommandTest.collectRemovalReceiptLines")(function* (
  receipt: WorktreeRemovalReceipt,
  archive: boolean
) {
  const existingLineCount = A.length(yield* TestConsole.logLines);
  yield* renderWorktreeRemovalReceipt(receipt, archive);
  return A.filter(A.drop(yield* TestConsole.logLines, existingLineCount), P.isString);
});

const residueManifest = (patchPath: O.Option<string>, untrackedFiles: ReadonlyArray<string>) =>
  WorktreeResidueManifest.make({
    name: NonEmptyTrimmedStr.make("feature-x"),
    branch: O.some("feat/feature-x"),
    head: GitObjectId.make("1ed08f66df016a18c6d7d56bd97aa778912cb37b"),
    archivedAt: ISOStr.make(NonEmptyTrimmedStr.make("2026-09-02T12:34:56.000Z")),
    archiveRef: "refs/archive/worktrees/feature-x/20260902-123456",
    repositoryHash: WorktreeRepositoryHash.make("0123456789ab"),
    patchPath,
    untrackedFiles,
    residueRoot: "/cache/beep-effect-0123456789ab/feature-x-20260902-123456",
    reason: "dirty+unpushed",
  });

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

const runGitText = Effect.fn("WorktreeCommandTest.runGitText")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
  return Str.trim(output);
});

const initScratchRepo = Effect.fn("WorktreeCommandTest.initScratchRepo")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# scratch\n");
  yield* fs.writeFileString(path.join(repoRoot, ".env"), "SECRET=local-only\n");
  yield* runGit(repoRoot, ["init", "-b", "main"]);
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
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory({ prefix: "worktree-command-test-" });
        const repoRoot = path.join(tmpDir, "main");
        yield* fs.makeDirectory(repoRoot);
        yield* initScratchRepo(repoRoot);
        const originRoot = path.join(tmpDir, "origin.git");
        yield* fs.makeDirectory(originRoot);
        yield* runGit(originRoot, ["init", "--bare"]);
        yield* runGit(repoRoot, ["remote", "add", "origin", originRoot]);
        yield* runGit(repoRoot, ["push", "--set-upstream", "origin", "main"]);
        return { fs, repoRoot, tmpDir } as const;
      }),
      ({ repoRoot }) => use(repoRoot),
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

  it("builds git removal argv for plain and preservation-complete removal", () => {
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

  it("builds create-only archive-ref and branch-delete argv", () => {
    const head = GitObjectId.make("1ed08f66df016a18c6d7d56bd97aa778912cb37b");
    expect(worktreeArchiveRefArgs("refs/archive/worktrees/feature-x/20260902-123456", head)).toEqual([
      "update-ref",
      "refs/archive/worktrees/feature-x/20260902-123456",
      head,
      "0000000000000000000000000000000000000000",
    ]);
    expect(worktreeBranchDeleteArgs("feat/feature-x")).toEqual(["branch", "-D", "--", "feat/feature-x"]);
  });

  it.effect("builds deterministic residue paths and reasons", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const plan = worktreeArchivePlan(
        path,
        "/cache",
        "beep-effect",
        WorktreeRepositoryHash.make("0123456789ab"),
        "feature-x",
        "20260902-123456"
      );
      const otherClonePlan = worktreeArchivePlan(
        path,
        "/cache",
        "beep-effect",
        WorktreeRepositoryHash.make("fedcba987654"),
        "feature-x",
        "20260902-123456"
      );
      const unsafeNamePlan = worktreeArchivePlan(
        path,
        "/cache",
        "beep-effect",
        WorktreeRepositoryHash.make("0123456789ab"),
        "feature x",
        "20260902-123456"
      );
      const reservedSuffixPlan = worktreeArchivePlan(
        path,
        "/cache",
        "beep-effect",
        WorktreeRepositoryHash.make("0123456789ab"),
        ".Feature_9.lock",
        "20260902-123456"
      );
      const emptySanitizedPlan = worktreeArchivePlan(
        path,
        "/cache",
        "beep-effect",
        WorktreeRepositoryHash.make("0123456789ab"),
        "🚀",
        "20260902-123456"
      );
      expect(plan.archiveRef).toBe("refs/archive/worktrees/feature-x/20260902-123456");
      expect(plan.residueRoot).toBe("/cache/beep-effect-0123456789ab/feature-x-20260902-123456");
      expect(plan.patchPath).toBe("/cache/beep-effect-0123456789ab/feature-x-20260902-123456/tracked.patch");
      expect(otherClonePlan.residueRoot).not.toBe(plan.residueRoot);
      expect(unsafeNamePlan.archiveRef).toBe("refs/archive/worktrees/feature-x/20260902-123456");
      expect(reservedSuffixPlan.archiveRef).toBe("refs/archive/worktrees/Feature_9.lock-worktree/20260902-123456");
      expect(emptySanitizedPlan.archiveRef).toBe("refs/archive/worktrees/worktree/20260902-123456");
      expect(worktreeResidueReason(true, false)).toBe("dirty");
      expect(worktreeResidueReason(false, true)).toBe("unpushed-commits");
      expect(worktreeResidueReason(true, true)).toBe("dirty+unpushed");
      expect(worktreeResidueReason(false, false)).toBe("clean");
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("omits the unsupported force flag from remove help", () =>
    Effect.gen(function* () {
      const existingLineCount = A.length(yield* TestConsole.logLines);
      yield* Command.runWith(worktreeCommand, { version: "0.0.0" })(["remove", "--help"]);
      const help = A.join(A.filter(A.drop(yield* TestConsole.logLines, existingLineCount), P.isString), "\n");
      const existingErrorCount = A.length(yield* TestConsole.errorLines);
      yield* Command.runWith(worktreeCommand, { version: "0.0.0" })(["remove", "example", "--force"]).pipe(Effect.flip);
      const errors = A.join(A.filter(A.drop(yield* TestConsole.errorLines, existingErrorCount), P.isString), "\n");

      expect(help).toContain("--archive");
      expect(help).not.toContain("--force");
      expect(errors).toContain("Unrecognized flag: --force");
    }).pipe(provideScopedLayer(testLayer))
  );

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

describe("WorktreeResidueManifest", () => {
  it.effect("round-trips through its JSON codec", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeResidueManifestValue({
        name: "feature-x",
        branch: "feat/feature-x",
        head: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
        archivedAt: "2026-09-02T12:34:56.000Z",
        archiveRef: "refs/archive/worktrees/feature-x/20260902-123456",
        repositoryHash: "0123456789ab",
        patchPath: "/cache/beep-effect-0123456789ab/feature-x-20260902-123456/tracked.patch",
        untrackedFiles: ["notes.txt"],
        residueRoot: "/cache/beep-effect-0123456789ab/feature-x-20260902-123456",
        reason: "dirty+unpushed",
      });
      const decoded = yield* encodeResidueManifest(manifest).pipe(Effect.flatMap(decodeResidueManifest));
      expect(decoded).toEqual(manifest);
      expect(O.getOrThrow(decoded.branch)).toBe("feat/feature-x");
      expect(O.getOrThrow(decoded.patchPath)).toContain("tracked.patch");
    })
  );

  it("round-trips arbitrary archive models through their JSON codecs", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(WorktreeResidueManifest)(fc),
        S.toArbitrary(WorktreeRemovalReceipt)(fc),
        S.toArbitrary(WorktreeArchivePlan)(fc),
        (manifest, receipt, plan) => {
          const manifestJson = S.encodeSync(residueManifestJson)(manifest);
          const receiptJson = S.encodeSync(removalReceiptJson)(receipt);
          const planJson = S.encodeSync(archivePlanJson)(plan);
          expect(S.decodeSync(residueManifestJson)(manifestJson)).toEqual(manifest);
          expect(S.decodeSync(removalReceiptJson)(receiptJson)).toEqual(receipt);
          expect(S.decodeSync(archivePlanJson)(planJson)).toEqual(plan);
        }
      )
    );
  });
});

describe("worktree error factories", () => {
  it("preserves command context in both WorktreeCommandError call forms", () => {
    const cause = { message: "spawn failed" };
    const direct = WorktreeCommandError.new(cause, "Could not run Git.", {
      command: "git status --short",
      exitCode: 17,
      path: "/repo-worktrees/feature-x",
    });
    const curried = WorktreeCommandError.new("Could not inspect Git.")(cause);

    expect(direct).toMatchObject({
      _tag: "WorktreeCommandError",
      cause,
      command: "git status --short",
      exitCode: 17,
      message: "Could not run Git.",
      path: "/repo-worktrees/feature-x",
    });
    expect(direct[Runtime.errorExitCode]).toBe(17);
    expect(curried).toMatchObject({ _tag: "WorktreeCommandError", cause, message: "Could not inspect Git." });
    expect(curried.command).toBeUndefined();
    expect(curried.exitCode).toBeUndefined();
    expect(curried.path).toBeUndefined();
    expect(curried[Runtime.errorExitCode]).toBe(1);
  });

  it("constructs dirty, preservation, and occupied-path errors", () => {
    const cause = { message: "write failed" };
    const dirty = WorktreeDirtyError.new("/repo-worktrees/dirty", 3);
    const minimalPreservation = WorktreePreservationError.new("write-manifest", "Could not write manifest.");
    const detailedPreservation = WorktreePreservationError.new("copy-untracked-files", "Could not copy file.", {
      cause,
      path: "/repo-worktrees/dirty/notes.txt",
    });
    const exists = WorktreeExistsError.new("/repo-worktrees/occupied");

    expect(dirty).toMatchObject({
      _tag: "WorktreeDirtyError",
      changeCount: 3,
      message: "Worktree /repo-worktrees/dirty has 3 uncommitted change(s); pass --archive to preserve and remove it.",
      path: "/repo-worktrees/dirty",
    });
    expect(dirty[Runtime.errorExitCode]).toBe(1);
    expect(minimalPreservation).toMatchObject({
      _tag: "WorktreePreservationError",
      message: "Preservation step write-manifest failed: Could not write manifest.",
      step: "write-manifest",
    });
    expect(minimalPreservation.cause).toBeUndefined();
    expect(minimalPreservation.path).toBeUndefined();
    expect(detailedPreservation).toMatchObject({
      cause,
      message: "Preservation step copy-untracked-files failed: Could not copy file.",
      path: "/repo-worktrees/dirty/notes.txt",
      step: "copy-untracked-files",
    });
    expect(detailedPreservation[Runtime.errorExitCode]).toBe(1);
    expect(exists).toMatchObject({
      _tag: "WorktreeExistsError",
      message: "A worktree already exists at /repo-worktrees/occupied.",
      path: "/repo-worktrees/occupied",
    });
    expect(exists[Runtime.errorExitCode]).toBe(1);
  });
});

describe("worktree output rendering", () => {
  it("formats clean and fully annotated doctor entries", () => {
    expect(
      worktreeDoctorEntryLines(
        WorktreeDoctorEntry.make({
          path: "/repo-worktrees/clean",
          branch: "feat/clean",
          detached: false,
          locked: false,
          prunable: false,
          clean: true,
          unpushed: false,
          changeCount: 0,
          hasEnv: true,
          hasNodeModules: true,
        })
      )
    ).toEqual(["- /repo-worktrees/clean", "    branch: feat/clean  status: clean  unpushed: no"]);
    expect(
      worktreeDoctorEntryLines(
        WorktreeDoctorEntry.make({
          path: "/repo-worktrees/dirty",
          branch: "feat/dirty",
          detached: false,
          locked: true,
          prunable: true,
          clean: false,
          unpushed: true,
          changeCount: 4,
          hasEnv: false,
          hasNodeModules: false,
        })
      )
    ).toEqual([
      "- /repo-worktrees/dirty",
      "    branch: feat/dirty  status: dirty (4)  unpushed: yes  notes: locked, prunable, missing .env, missing node_modules",
    ]);
  });

  it("distinguishes detached and unknown doctor branches", () => {
    const base = {
      path: "/repo-worktrees/detached",
      branch: null,
      locked: false,
      prunable: false,
      clean: true,
      unpushed: false,
      changeCount: 0,
      hasEnv: true,
      hasNodeModules: true,
    };

    expect(worktreeDoctorEntryLines(WorktreeDoctorEntry.make({ ...base, detached: true }))[1]).toContain(
      "branch: (detached)"
    );
    expect(worktreeDoctorEntryLines(WorktreeDoctorEntry.make({ ...base, detached: false }))[1]).toContain(
      "branch: (unknown)"
    );
  });

  it.effect("renders legacy attached and detached removal receipts", () =>
    Effect.gen(function* () {
      const attached = WorktreeRemovalReceipt.make({
        targetPath: "/repo-worktrees/feature-x",
        branch: O.some("feat/feature-x"),
        reason: "clean",
        manifest: O.none(),
        branchDeleted: false,
      });
      const detached = WorktreeRemovalReceipt.make({ ...attached, branch: O.none() });

      expect(Effect.isEffect(renderWorktreeRemovalReceipt(false)(attached))).toBe(true);
      expect(yield* collectRemovalReceiptLines(attached, false)).toEqual([
        "Removed worktree /repo-worktrees/feature-x",
        "Branch retained. Delete it when ready:\n  git branch -D feat/feature-x",
      ]);
      expect(yield* collectRemovalReceiptLines(detached, false)).toEqual([
        "Removed worktree /repo-worktrees/feature-x",
        "Branch retained; delete it manually when ready.",
      ]);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("renders clean and residue-free archive retirement", () =>
    Effect.gen(function* () {
      const receipt = WorktreeRemovalReceipt.make({
        targetPath: "/repo-worktrees/feature-x",
        branch: O.some("feat/feature-x"),
        reason: "clean",
        manifest: O.none(),
        branchDeleted: false,
      });

      expect(yield* collectRemovalReceiptLines(receipt, true)).toEqual([
        "",
        "Worktree retirement complete: /repo-worktrees/feature-x",
        "  reason: clean",
        "  archived: no residue needed (clean with no unpushed commits)",
        "  removed: /repo-worktrees/feature-x",
        "  branch retained. Delete it when ready:\n    git branch -D feat/feature-x",
      ]);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("renders archived patches, untracked files, and retained branches", () =>
    Effect.gen(function* () {
      const receipt = WorktreeRemovalReceipt.make({
        targetPath: "/repo-worktrees/feature-x",
        branch: O.some("feat/feature-x"),
        reason: "dirty+unpushed",
        manifest: O.some(
          residueManifest(O.some("/cache/beep-effect-0123456789ab/feature-x-20260902-123456/tracked.patch"), [
            "notes.txt",
          ])
        ),
        branchDeleted: false,
      });
      const lines = yield* collectRemovalReceiptLines(receipt, true);

      expect(lines).toContain("  repository hash: 0123456789ab");
      expect(lines).toContain(
        "  tracked patch: /cache/beep-effect-0123456789ab/feature-x-20260902-123456/tracked.patch"
      );
      expect(lines).toContain("  untracked files: 1");
      expect(lines).toContain(
        "    git -C <restore-path> apply /cache/beep-effect-0123456789ab/feature-x-20260902-123456/tracked.patch"
      );
      expect(lines).toContain(
        "    copy /cache/beep-effect-0123456789ab/feature-x-20260902-123456/untracked/ contents back into <restore-path>"
      );
      expect(lines).toContain("  branch retained. Delete it when ready:\n    git branch -D feat/feature-x");
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("renders patch-free archived residue and deleted branch labels", () =>
    Effect.gen(function* () {
      const archived = WorktreeRemovalReceipt.make({
        targetPath: "/repo-worktrees/feature-x",
        branch: O.some("feat/feature-x"),
        reason: "unpushed-commits",
        manifest: O.some(residueManifest(O.none(), [])),
        branchDeleted: true,
      });
      const detached = WorktreeRemovalReceipt.make({ ...archived, branch: O.none() });
      const archivedLines = yield* collectRemovalReceiptLines(archived, true);
      const detachedLines = yield* collectRemovalReceiptLines(detached, true);

      expect(archivedLines).toContain("  tracked patch: (none)");
      expect(archivedLines).toContain("  untracked files: 0");
      expect(archivedLines).toContain("  branch deleted: feat/feature-x");
      expect(detachedLines).toContain("  branch deleted: (detached HEAD)");
    }).pipe(provideScopedLayer(TestConsole.layer))
  );
});

describe("worktree git operations", () => {
  it.effect("adapts Git spawn failures and non-zero exits", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const nonZero = yield* runWorktreeGitCapture(
          repoRoot,
          ["rev-parse", "--verify", "refs/heads/does-not-exist"],
          "Failed to resolve the branch."
        ).pipe(Effect.flip);
        const spawnFailure = yield* runWorktreeGitCapture(
          `${repoRoot}/does-not-exist`,
          ["status", "--short"],
          "Failed to inspect the worktree."
        ).pipe(Effect.flip);

        expect(nonZero.message).toContain("Failed to resolve the branch. (exit ");
        expect(nonZero.command).toBe("git rev-parse --verify refs/heads/does-not-exist");
        expect(nonZero.exitCode).toBeGreaterThan(0);
        expect(spawnFailure.message).toBe("Failed to inspect the worktree.");
        expect(spawnFailure.command).toBe("git status --short");
        expect(spawnFailure.exitCode).toBeUndefined();
      })
    )
  );

  it.effect("rejects branch deletion outside archive retirement", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const removalService = yield* WorktreeRemovalService;
        const context = yield* resolveWorktreeContext(repoRoot);
        const targetPath = yield* addWorktree(context, "delete-demo", defaultWorktreeBranch("delete-demo"));
        const error = yield* removalService
          .remove(
            WorktreeRemovalRequest.make({
              name: NonEmptyTrimmedStr.make("delete-demo"),
              targetPath,
              mainCheckout: context.mainCheckout,
              branch: O.some(defaultWorktreeBranch("delete-demo")),
              archive: false,
              deleteBranch: true,
            })
          )
          .pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "WorktreeCommandError",
          message: "--delete-branch requires --archive so branch deletion cannot discard unreachable commits.",
        });
        expect(yield* fs.exists(targetPath)).toBe(true);
      })
    )
  );

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
        expect(demoEntry?.unpushed).toBe(false);
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

  it.effect("refuses archive retirement when the residue root is inside the target", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const removalService = yield* WorktreeRemovalService;
        const context = yield* resolveWorktreeContext(repoRoot);
        const name = NonEmptyTrimmedStr.make("contained-residue");
        const targetPath = yield* addWorktree(context, name, defaultWorktreeBranch(name));
        const nestedResidueRoot = path.join(targetPath, "residue");
        const configuredRoots = [
          { configured: targetPath, expected: targetPath },
          { configured: path.relative(path.resolve(), nestedResidueRoot), expected: nestedResidueRoot },
        ];

        yield* fs.writeFileString(path.join(targetPath, "README.md"), "# dirty\n");
        for (const configuredRoot of configuredRoots) {
          const configProvider = ConfigProvider.fromEnv({
            env: { BEEP_WORKTREE_RESIDUE_ROOT: configuredRoot.configured, HOME: context.worktreesRoot },
          });
          const error = yield* removalService
            .remove(
              WorktreeRemovalRequest.make({
                name,
                targetPath,
                mainCheckout: context.mainCheckout,
                branch: O.some(defaultWorktreeBranch(name)),
                archive: true,
                deleteBranch: false,
              })
            )
            .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider), Effect.flip);

          expect(error).toMatchObject({
            _tag: "WorktreePreservationError",
            path: configuredRoot.expected,
            step: "resolve-residue-root",
          });
          expect(error.message).toContain("Choose a path outside");
        }

        expect(yield* fs.exists(targetPath)).toBe(true);
        expect(
          yield* runGitText(repoRoot, [
            "for-each-ref",
            "--format=%(refname)",
            "refs/archive/worktrees/contained-residue",
          ])
        ).toBe("");
      })
    )
  );

  it.effect("refuses archive retirement when an initialized submodule has uncommitted work", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const removalService = yield* WorktreeRemovalService;
        const context = yield* resolveWorktreeContext(repoRoot);
        const name = NonEmptyTrimmedStr.make("submodule-demo");
        const targetPath = yield* addWorktree(context, name, defaultWorktreeBranch(name));
        const submoduleSource = path.join(path.dirname(repoRoot), "submodule-source");
        const submoduleRelativePath = path.join("vendor", "local");
        const submodulePath = path.join(targetPath, submoduleRelativePath);
        const residueBase = path.join(context.worktreesRoot, "submodule-residue");

        yield* fs.makeDirectory(submoduleSource);
        yield* initScratchRepo(submoduleSource);
        yield* runGit(targetPath, [
          "-c",
          "protocol.file.allow=always",
          "submodule",
          "add",
          submoduleSource,
          submoduleRelativePath,
        ]);
        yield* runGit(targetPath, ["commit", "-am", "add local submodule"]);
        yield* fs.writeFileString(path.join(submodulePath, "README.md"), "# dirty submodule\n");

        const configProvider = ConfigProvider.fromEnv({
          env: { BEEP_WORKTREE_RESIDUE_ROOT: residueBase, HOME: context.worktreesRoot },
        });
        const error = yield* removalService
          .remove(
            WorktreeRemovalRequest.make({
              name,
              targetPath,
              mainCheckout: context.mainCheckout,
              branch: O.some(defaultWorktreeBranch(name)),
              archive: true,
              deleteBranch: false,
            })
          )
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider), Effect.flip);

        expect(error).toMatchObject({
          _tag: "WorktreePreservationError",
          path: submodulePath,
          step: "inspect-submodules",
        });
        expect(error.message).toContain(`Submodule ${submoduleRelativePath} has uncommitted work`);
        expect(error.message).toContain("commit or clean it");
        expect(yield* fs.exists(targetPath)).toBe(true);
        expect(yield* fs.exists(residueBase)).toBe(false);
        expect(
          yield* runGitText(repoRoot, ["for-each-ref", "--format=%(refname)", "refs/archive/worktrees/submodule-demo"])
        ).toBe("");
      })
    )
  );

  it.effect("archives a worktree whose raw name contains a space under a validated encoded ref", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const removalService = yield* WorktreeRemovalService;
        const context = yield* resolveWorktreeContext(repoRoot);
        const name = NonEmptyTrimmedStr.make("space lane");
        const targetPath = path.join(context.worktreesRoot, name);
        const residueBase = path.join(context.worktreesRoot, "space-residue");

        yield* fs.makeDirectory(context.worktreesRoot, { recursive: true });
        yield* runGit(repoRoot, ["worktree", "add", "--detach", targetPath, "HEAD"]);
        yield* fs.writeFileString(path.join(targetPath, "README.md"), "# dirty\n");

        const receipt = yield* removalService
          .remove(
            WorktreeRemovalRequest.make({
              name,
              targetPath,
              mainCheckout: context.mainCheckout,
              branch: O.none(),
              archive: true,
              deleteBranch: false,
            })
          )
          .pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({
                env: { BEEP_WORKTREE_RESIDUE_ROOT: residueBase, HOME: context.worktreesRoot },
              })
            )
          );
        const manifest = O.getOrThrow(receipt.manifest);

        expect(manifest.name).toBe("space lane");
        expect(manifest.archiveRef).toContain("refs/archive/worktrees/space-lane/");
        expect(manifest.repositoryHash).toMatch(/^[0-9a-f]{12}$/u);
        expect(path.basename(path.dirname(manifest.residueRoot))).toBe(`main-${manifest.repositoryHash}`);
        yield* runGit(repoRoot, ["check-ref-format", manifest.archiveRef]);
        expect(yield* fs.exists(targetPath)).toBe(false);
      })
    )
  );

  it.effect("separates same-name residue from clones with the same basename", () =>
    withScratchRepo((firstRepoRoot) =>
      withScratchRepo((secondRepoRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const removalService = yield* WorktreeRemovalService;
          const firstContext = yield* resolveWorktreeContext(firstRepoRoot);
          const secondContext = yield* resolveWorktreeContext(secondRepoRoot);
          const name = NonEmptyTrimmedStr.make("collision-demo");
          const firstTarget = yield* addWorktree(firstContext, name, defaultWorktreeBranch(name));
          const secondTarget = yield* addWorktree(secondContext, name, defaultWorktreeBranch(name));
          const residueBase = path.join(path.dirname(firstRepoRoot), "shared-residue");
          const configProvider = ConfigProvider.fromEnv({
            env: { BEEP_WORKTREE_RESIDUE_ROOT: residueBase, HOME: firstContext.worktreesRoot },
          });

          yield* fs.writeFileString(path.join(firstTarget, "README.md"), "# first dirty clone\n");
          yield* fs.writeFileString(path.join(secondTarget, "README.md"), "# second dirty clone\n");

          const firstReceipt = yield* removalService
            .remove(
              WorktreeRemovalRequest.make({
                name,
                targetPath: firstTarget,
                mainCheckout: firstContext.mainCheckout,
                branch: O.some(defaultWorktreeBranch(name)),
                archive: true,
                deleteBranch: false,
              })
            )
            .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider));
          const secondReceipt = yield* removalService
            .remove(
              WorktreeRemovalRequest.make({
                name,
                targetPath: secondTarget,
                mainCheckout: secondContext.mainCheckout,
                branch: O.some(defaultWorktreeBranch(name)),
                archive: true,
                deleteBranch: false,
              })
            )
            .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider));
          const firstManifest = O.getOrThrow(firstReceipt.manifest);
          const secondManifest = O.getOrThrow(secondReceipt.manifest);

          expect(firstManifest.repositoryHash).not.toBe(secondManifest.repositoryHash);
          expect(firstManifest.residueRoot).not.toBe(secondManifest.residueRoot);
          expect(path.basename(path.dirname(firstManifest.residueRoot))).toBe(`main-${firstManifest.repositoryHash}`);
          expect(path.basename(path.dirname(secondManifest.residueRoot))).toBe(`main-${secondManifest.repositoryHash}`);
        })
      )
    )
  );

  it.effect("archives dirty and unpushed residue before removal and leaves clean removal residue-free", () =>
    withScratchRepo((repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const removalService = yield* WorktreeRemovalService;
        const context = yield* resolveWorktreeContext(repoRoot);
        const targetPath = yield* addWorktree(context, "archive-demo", defaultWorktreeBranch("archive-demo"));

        yield* fs.writeFileString(path.join(targetPath, "README.md"), "# committed lane change\n");
        yield* runGit(targetPath, ["add", "README.md"]);
        yield* runGit(targetPath, ["commit", "-m", "lane commit"]);
        const oldHead = yield* runGitText(targetPath, ["rev-parse", "HEAD"]);
        yield* fs.writeFileString(path.join(targetPath, "README.md"), "# working tree change\n");
        yield* fs.makeDirectory(path.join(targetPath, "notes"));
        yield* fs.writeFileString(path.join(targetPath, "notes", "recovery.txt"), "recover me\n");

        const doctorBeforeRemoval = yield* resolveWorktreeContext(repoRoot).pipe(
          Effect.flatMap(worktreeDoctorReportForContext)
        );
        const archiveDoctorEntry = A.findFirst(doctorBeforeRemoval.entries, (entry) => entry.path === targetPath);
        expect(O.getOrThrow(archiveDoctorEntry).unpushed).toBe(true);
        expect(O.getOrThrow(archiveDoctorEntry).clean).toBe(false);

        const residueBase = path.join(context.worktreesRoot, "test-residue");
        const configProvider = ConfigProvider.fromEnv({
          env: { BEEP_WORKTREE_RESIDUE_ROOT: residueBase, HOME: context.worktreesRoot },
        });
        const receipt = yield* removalService
          .remove(
            WorktreeRemovalRequest.make({
              name: NonEmptyTrimmedStr.make("archive-demo"),
              targetPath,
              mainCheckout: context.mainCheckout,
              branch: O.some(defaultWorktreeBranch("archive-demo")),
              archive: true,
              deleteBranch: false,
            })
          )
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider));

        expect(receipt.reason).toBe("dirty+unpushed");
        const manifest = O.getOrThrow(receipt.manifest);
        const repositoryResidueRoot = path.dirname(manifest.residueRoot);
        expect(path.basename(repositoryResidueRoot)).toBe(`main-${manifest.repositoryHash}`);
        expect(yield* runGitText(repoRoot, ["rev-parse", manifest.archiveRef])).toBe(oldHead);
        expect(yield* fs.exists(targetPath)).toBe(false);
        expect(yield* fs.readFileString(path.join(manifest.residueRoot, "untracked", "notes", "recovery.txt"))).toBe(
          "recover me\n"
        );
        const persistedManifest = yield* fs
          .readFileString(path.join(manifest.residueRoot, "manifest.json"))
          .pipe(Effect.flatMap(decodeResidueManifest));
        expect(persistedManifest).toEqual(manifest);

        const restoredPath = path.join(context.worktreesRoot, "restored-demo");
        yield* runGit(repoRoot, ["worktree", "add", "--detach", restoredPath, manifest.archiveRef]);
        yield* runGit(restoredPath, ["apply", O.getOrThrow(manifest.patchPath)]);
        expect(yield* fs.readFileString(path.join(restoredPath, "README.md"))).toBe("# working tree change\n");

        const cleanPath = yield* addWorktree(context, "clean-demo", defaultWorktreeBranch("clean-demo"));
        const beforeCleanRemoval = yield* fs.readDirectory(repositoryResidueRoot);
        const cleanReceipt = yield* removalService
          .remove(
            WorktreeRemovalRequest.make({
              name: NonEmptyTrimmedStr.make("clean-demo"),
              targetPath: cleanPath,
              mainCheckout: context.mainCheckout,
              branch: O.some(defaultWorktreeBranch("clean-demo")),
              archive: true,
              deleteBranch: true,
            })
          )
          .pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider));
        const afterCleanRemoval = yield* fs.readDirectory(repositoryResidueRoot);

        expect(cleanReceipt.reason).toBe("clean");
        expect(O.isNone(cleanReceipt.manifest)).toBe(true);
        expect(cleanReceipt.branchDeleted).toBe(true);
        expect(yield* fs.exists(cleanPath)).toBe(false);
        expect(afterCleanRemoval).toEqual(beforeCleanRemoval);
      })
    )
  );
});
