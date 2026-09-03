import { runWorktreeReap, WorktreeReapReport, WorktreeRemovalServiceLive } from "@beep/repo-cli/commands/Worktree";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const removalLayer = WorktreeRemovalServiceLive.pipe(Layer.provide(NodeServices.layer));
const testLayer = Layer.merge(NodeServices.layer, removalLayer);
const FIXTURE_NOW_MILLIS = 2_000_000_000_000;

const runCommand = Effect.fn("WorktreeReapTest.runCommand")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const result = yield* runRepoCommandCapture(command, args, cwd);
  expect(result.exitCode, result.output).toBe(0);
  return result.output;
});

const addWorktree = Effect.fn("WorktreeReapTest.addWorktree")(function* (
  repoRoot: string,
  worktreesRoot: string,
  name: string
) {
  const path = yield* Path.Path;
  const target = path.join(worktreesRoot, name);
  yield* runCommand("git", ["worktree", "add", "--quiet", "-b", `feat/${name}`, target], repoRoot);
  return target;
});

const withScratchRepo = <Value, Failure, Requirements>(
  use: (fixture: {
    readonly repoRoot: string;
    readonly tempRoot: string;
    readonly worktreesRoot: string;
  }) => Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectory({ prefix: "worktree-reap-test-" });
        const repoRoot = path.join(tempRoot, "repo");
        const originRoot = path.join(tempRoot, "origin.git");
        const worktreesRoot = path.join(tempRoot, "worktrees");
        yield* Effect.forEach(
          [repoRoot, originRoot, worktreesRoot],
          Effect.fn("WorktreeReapTest.makeFixtureDirectory")(function* (directory) {
            yield* fs.makeDirectory(directory, { recursive: true });
          }),
          { discard: true }
        );
        yield* runCommand("git", ["init", "--quiet", "--bare"], originRoot);
        yield* runCommand("git", ["init", "--quiet", "-b", "main"], repoRoot);
        yield* runCommand("git", ["config", "user.email", "worktree-reap@example.invalid"], repoRoot);
        yield* runCommand("git", ["config", "user.name", "Worktree Reap Test"], repoRoot);
        yield* runCommand("git", ["config", "commit.gpgsign", "false"], repoRoot);
        yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# fixture\n");
        yield* runCommand("git", ["add", "README.md"], repoRoot);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repoRoot);
        yield* runCommand("git", ["remote", "add", "origin", originRoot], repoRoot);
        yield* runCommand("git", ["push", "--quiet", "--set-upstream", "origin", "main"], repoRoot);
        return { repoRoot, tempRoot, worktreesRoot };
      }),
      use,
      Effect.fn("WorktreeReapTest.removeFixture")(function* ({ tempRoot }) {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tempRoot, { force: true, recursive: true });
      })
    ).pipe(Effect.provide(testLayer))
  );

const candidateAt = (report: WorktreeReapReport, candidatePath: string) =>
  O.getOrThrow(A.findFirst(report.candidates, (candidate) => Str.Equivalence(candidate.path, candidatePath)));

const ghResult = (number: number | undefined) => ({
  exitCode: 0,
  output: number === undefined ? "[]" : `[{"number":${number}}]`,
  truncated: false,
});

describe("worktree reap", () => {
  it.effect("classifies registered worktrees and measures bytes only for clean, idle merged PRs", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "merged");
        const dirty = yield* addWorktree(repoRoot, worktreesRoot, "dirty");
        const open = yield* addWorktree(repoRoot, worktreesRoot, "open");
        const revival = yield* addWorktree(repoRoot, worktreesRoot, "revival");
        const noPr = yield* addWorktree(repoRoot, worktreesRoot, "no-pr");
        const young = yield* addWorktree(repoRoot, worktreesRoot, "young");
        yield* fs.writeFileString(path.join(dirty, "dirty.txt"), "unsaved\n");

        const nowMillis = FIXTURE_NOW_MILLIS;
        const youngHead = Str.trim(
          yield* runCommand("git", ["rev-parse", "--path-format=absolute", "--git-path", "HEAD"], young)
        );
        yield* runCommand("touch", ["-d", `@${nowMillis / 1_000}`, youngHead], repoRoot);

        let duCalls = 0;
        const runner = Effect.fn("WorktreeReapTest.classificationRunner")(function* (
          command: string,
          args: ReadonlyArray<string>,
          cwd: string
        ) {
          if (Str.Equivalence(command, "du")) {
            duCalls += 1;
          }
          if (!Str.Equivalence(command, "gh")) {
            return yield* runRepoCommandCapture(command, args, cwd);
          }
          const mergedQuery = A.contains(args, "merged");
          if (Str.Equivalence(cwd, merged)) return ghResult(mergedQuery ? 101 : undefined);
          if (Str.Equivalence(cwd, dirty)) return ghResult(mergedQuery ? 102 : undefined);
          if (Str.Equivalence(cwd, young)) return ghResult(mergedQuery ? 103 : undefined);
          if (Str.Equivalence(cwd, open)) return ghResult(mergedQuery ? undefined : 104);
          if (Str.Equivalence(cwd, revival)) return ghResult(mergedQuery ? 106 : 105);
          return ghResult(undefined);
        });

        const report = yield* runWorktreeReap({ nowMillis, runCommand: runner, startFrom: repoRoot });

        expect(report.applied).toBe(false);
        expect(report.schemaVersion).toBe("worktree-reap/v1");
        expect(report.candidates).toHaveLength(6);
        expect(candidateAt(report, merged)).toMatchObject({ reapClass: "merged-pr", retired: false });
        expect(O.isNone(candidateAt(report, merged).skipReason)).toBe(true);
        expect(O.isSome(candidateAt(report, merged).bytes)).toBe(true);
        expect(candidateAt(report, dirty).reapClass).toBe("merged-pr");
        expect(O.getOrThrow(candidateAt(report, dirty).skipReason)).toBe("dirty-tree");
        expect(candidateAt(report, open).reapClass).toBe("open-pr");
        expect(O.getOrThrow(candidateAt(report, open).skipReason)).toBe("open-pr");
        expect(candidateAt(report, revival).reapClass).toBe("open-pr");
        expect(O.getOrThrow(candidateAt(report, revival).skipReason)).toBe("open-pr");
        expect(O.getOrThrow(candidateAt(report, revival).prNumber)).toBe(105);
        expect(candidateAt(report, noPr).reapClass).toBe("no-pr");
        expect(O.getOrThrow(candidateAt(report, noPr).skipReason)).toBe("no-pr");
        expect(O.getOrThrow(candidateAt(report, young).skipReason)).toBe("too-young");
        expect(duCalls).toBe(1);
      })
    )
  );

  it.effect("fails closed on GitHub errors and missing worktree directories", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ghFailure = yield* addWorktree(repoRoot, worktreesRoot, "gh-failure");
        const missing = yield* addWorktree(repoRoot, worktreesRoot, "missing");
        yield* fs.remove(missing, { force: true, recursive: true });
        const runner = Effect.fn("WorktreeReapTest.failureRunner")(function* (
          command: string,
          args: ReadonlyArray<string>,
          cwd: string
        ) {
          if (Str.Equivalence(command, "gh")) {
            return { exitCode: 1, output: "fixture gh failure", truncated: false };
          }
          return yield* runRepoCommandCapture(command, args, cwd);
        });
        const report = yield* runWorktreeReap({ runCommand: runner, startFrom: repoRoot });

        expect(candidateAt(report, ghFailure).reapClass).toBe("unknown");
        expect(O.getOrThrow(candidateAt(report, ghFailure).skipReason)).toBe("gh-probe-failed");
        expect(O.getOrThrow(candidateAt(report, missing).skipReason)).toBe("missing-directory");
        expect(report.reclaimableBytes).toBe(0);
      })
    )
  );

  it.effect("excludes both the main checkout and the invoking linked worktree", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const invoking = yield* addWorktree(repoRoot, worktreesRoot, "invoking");
        const peer = yield* addWorktree(repoRoot, worktreesRoot, "peer");
        const runner = Effect.fn("WorktreeReapTest.scopeRunner")(function* (
          command: string,
          args: ReadonlyArray<string>,
          cwd: string
        ) {
          if (Str.Equivalence(command, "gh")) return ghResult(undefined);
          return yield* runRepoCommandCapture(command, args, cwd);
        });
        const report = yield* runWorktreeReap({ runCommand: runner, startFrom: invoking });

        expect(report.mainCheckout).toBe(repoRoot);
        expect(report.invokingWorktree).toBe(invoking);
        expect(report.candidates).toHaveLength(1);
        expect(report.candidates[0]?.path).toBe(peer);
      })
    )
  );

  it.effect("revalidates and archive-retires only a merged candidate, then deletes its branch", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "apply-merged");
        const nowMillis = FIXTURE_NOW_MILLIS;
        const runner = Effect.fn("WorktreeReapTest.applyRunner")(function* (
          command: string,
          args: ReadonlyArray<string>,
          cwd: string
        ) {
          if (Str.Equivalence(command, "gh")) return ghResult(A.contains(args, "merged") ? 201 : undefined);
          return yield* runRepoCommandCapture(command, args, cwd);
        });
        const report = yield* runWorktreeReap({ apply: true, nowMillis, runCommand: runner, startFrom: repoRoot });

        const candidate = candidateAt(report, merged);
        expect(candidate.retired).toBe(true);
        expect(O.isNone(candidate.skipReason)).toBe(true);
        expect(report.retiredCount).toBe(1);
        expect(report.reclaimedBytes).toBeGreaterThan(0);
        expect(yield* fs.exists(merged)).toBe(false);
        const branch = yield* runRepoCommandCapture(
          "git",
          ["show-ref", "--verify", "--quiet", "refs/heads/feat/apply-merged"],
          repoRoot
        );
        expect(branch.exitCode).not.toBe(0);
      })
    )
  );

  it.effect("round-trips worktree-reap/v1 reports through the JSON codec", () =>
    Effect.gen(function* () {
      const report = WorktreeReapReport.make({
        scannedAt: "2026-09-03T12:00:00.000Z",
        mainCheckout: "/repo",
        invokingWorktree: "/repo-worktrees/janitor",
        idleThresholdHours: 48,
        applied: false,
        candidates: [],
        retiredCount: 0,
        reclaimableBytes: 0,
        reclaimedBytes: 0,
        warnings: [],
      });
      const codec = S.fromJsonString(WorktreeReapReport);
      const encoded = yield* S.encodeEffect(codec)(report);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      expect(decoded).toEqual(report);
      expect(decoded.schemaVersion).toBe("worktree-reap/v1");
    }).pipe(Effect.provide(testLayer))
  );
});
