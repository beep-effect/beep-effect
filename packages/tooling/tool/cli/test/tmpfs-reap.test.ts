import { runRepoCommandCapture, runTmpfsReap } from "@beep/repo-cli/test/RepoRun";
import { runTmpfsWorktreesStep } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";

const FIXTURE_NOW_MILLIS = 2_000_000_000_000;
const fixtureTimestamp = (hoursAgo: number): string =>
  `@${(FIXTURE_NOW_MILLIS - Duration.toMillis(Duration.hours(hoursAgo))) / 1000}`;

const runCommand = Effect.fn("TmpfsReapTest.runCommand")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const result = yield* runRepoCommandCapture(command, args, cwd);
  expect(result.exitCode, result.output).toBe(0);
  return result.output;
});

const withTempDirectory = <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "tmpfs-reap-test-" });
    }),
    use,
    (root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(root, { force: true, recursive: true });
      })
  );

const candidateByPath = <Candidate extends { readonly path: string }>(
  report: { readonly candidates: ReadonlyArray<Candidate> },
  candidatePath: string
): Candidate => O.getOrThrow(A.findFirst(report.candidates, (candidate) => candidate.path === candidatePath));

const makeClassificationFixture = Effect.fn("TmpfsReapTest.makeClassificationFixture")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmpRoot = path.join(root, "tmp");
  const cacheRoot = path.join(root, "cache");
  const fakeParent = path.join(root, "fixture-repo");
  const fakeWorktree = path.join(tmpRoot, "fixture-worktree");
  const fallow = path.join(tmpRoot, "fallow-audit-base-cache-abc");
  const fallowLastUsed = path.join(fallow, "worker.last-used");
  const fallowSiblingLastUsed = `${fallow}.shared.last-used`;
  const youngScoped = path.join(tmpRoot, "beep-knowledge-refs-young");
  const headInstall = path.join(cacheRoot, "beep", "head-install", "beep-yeet-head-install-old");

  const dirtyWorktree = path.join(tmpRoot, "fixture-worktree-dirty");
  const oldSemanticDelta = path.join(tmpRoot, "beep-knowledge-semantic-delta-old");

  yield* Effect.forEach(
    [tmpRoot, cacheRoot, fakeParent, fallow, youngScoped, oldSemanticDelta, headInstall],
    (directory) => fs.makeDirectory(directory, { recursive: true }),
    { discard: true }
  );
  yield* runCommand("git", ["init", "-q"], fakeParent);
  yield* fs.writeFileString(path.join(fakeParent, "tracked.txt"), "tracked bytes\n");
  yield* runCommand("git", ["add", "tracked.txt"], fakeParent);
  yield* runCommand(
    "git",
    ["-c", "user.email=fixture@local", "-c", "user.name=fixture", "commit", "-q", "-m", "seed"],
    fakeParent
  );
  yield* runCommand("git", ["worktree", "add", "--detach", "-q", fakeWorktree], fakeParent);
  yield* runCommand("git", ["worktree", "add", "--detach", "-q", dirtyWorktree], fakeParent);
  yield* fs.writeFileString(path.join(dirtyWorktree, "uncommitted.txt"), "unsaved work\n");
  yield* fs.writeFileString(fallowLastUsed, "used\n");
  yield* fs.writeFileString(fallowSiblingLastUsed, "used\n");
  yield* fs.writeFileString(path.join(fallow, "payload.txt"), "cache bytes\n");
  yield* fs.writeFileString(path.join(youngScoped, "payload.txt"), "young bytes\n");
  yield* fs.writeFileString(path.join(oldSemanticDelta, "payload.txt"), "delta bytes\n");
  yield* fs.writeFileString(path.join(headInstall, "payload.txt"), "install bytes\n");

  yield* runCommand("touch", ["-d", fixtureTimestamp(3), fakeWorktree], root);
  yield* runCommand("touch", ["-d", fixtureTimestamp(3), dirtyWorktree], root);
  yield* runCommand("touch", ["-d", fixtureTimestamp(8), fallowLastUsed], root);
  yield* runCommand("touch", ["-d", fixtureTimestamp(7), fallowSiblingLastUsed], root);
  yield* runCommand("touch", ["-d", fixtureTimestamp(0), youngScoped], root);
  yield* runCommand("touch", ["-d", fixtureTimestamp(3), oldSemanticDelta], root);
  yield* runCommand("touch", ["-d", fixtureTimestamp(2), headInstall], root);

  return {
    cacheRoot,
    dirtyWorktree,
    fakeWorktree,
    fallow,
    fallowSiblingLastUsed,
    headInstall,
    oldSemanticDelta,
    tmpRoot,
    youngScoped,
  };
});

describe("tmpfs reap", () => {
  it.effect("classifies worktrees, fallow caches, and scoped temporaries with the correct idleness actions", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fixture = yield* makeClassificationFixture(root);
        const report = yield* runTmpfsReap({
          cacheRoot: fixture.cacheRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        });

        const worktree = candidateByPath(report, fixture.fakeWorktree);
        expect(worktree.reapClass).toBe("git-worktree");
        expect(worktree.action).toBe("worktree-remove");
        expect(worktree.ageHours).toBeGreaterThanOrEqual(2);

        const fallow = candidateByPath(report, fixture.fallow);
        expect(fallow.reapClass).toBe("fallow-cache");
        expect(fallow.action).toBe("remove-dir");
        expect(fallow.ageHours).toBeGreaterThanOrEqual(6);

        const young = candidateByPath(report, fixture.youngScoped);
        expect(young.reapClass).toBe("scoped-temp");
        expect(young.action).toBe("skip");
        expect(young.skipReason).toBe("too-young");
        expect(young.ageHours).toBeLessThan(2);

        const dirty = candidateByPath(report, fixture.dirtyWorktree);
        expect(dirty.reapClass).toBe("git-worktree");
        expect(dirty.action).toBe("skip");
        expect(dirty.skipReason).toBe("dirty-worktree");

        const semanticDelta = candidateByPath(report, fixture.oldSemanticDelta);
        expect(semanticDelta.reapClass).toBe("scoped-temp");
        expect(semanticDelta.action).toBe("remove-dir");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("counts a child process cwd as a live reference and refuses reaping", () =>
    withTempDirectory((root) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpRoot = path.join(root, "tmp");
          const cacheRoot = path.join(root, "cache");
          const candidatePath = path.join(tmpRoot, "beep-knowledge-refs-live");
          yield* fs.makeDirectory(candidatePath, { recursive: true });
          yield* fs.makeDirectory(cacheRoot, { recursive: true });
          yield* fs.writeFileString(path.join(candidatePath, "payload.txt"), "live\n");
          yield* runCommand("touch", ["-d", fixtureTimestamp(3), candidatePath], root);

          yield* ChildProcess.make("sh", ["-c", "while :; do sleep 1; done"], {
            cwd: candidatePath,
            stdin: "ignore",
            stderr: "pipe",
            stdout: "pipe",
          });
          const report = yield* runTmpfsReap({ cacheRoot, nowMillis: FIXTURE_NOW_MILLIS, tmpRoot });
          const candidate = candidateByPath(report, candidatePath);
          expect(candidate.refCount).toBeGreaterThan(0);
          expect(candidate.action).toBe("skip");
          expect(candidate.skipReason).toBe("live-cwd-ref");
        })
      )
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("applies eligible removals, preserves young artifacts, and reports reclaimed bytes", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeClassificationFixture(root);
        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: fixture.cacheRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        });

        expect(report.applied).toBe(true);
        expect(report.reapedCount).toBe(4);
        expect(report.reclaimedBytes).toBeGreaterThan(0);
        expect(yield* fs.exists(fixture.fakeWorktree)).toBe(false);
        expect(yield* fs.exists(fixture.fallow)).toBe(false);
        expect(yield* fs.exists(fixture.fallowSiblingLastUsed)).toBe(false);
        expect(yield* fs.exists(fixture.headInstall)).toBe(false);
        expect(yield* fs.exists(fixture.oldSemanticDelta)).toBe(false);
        expect(yield* fs.exists(fixture.youngScoped)).toBe(true);
        expect(yield* fs.exists(fixture.dirtyWorktree)).toBe(true);
        expect(yield* fs.exists(path.join(fixture.dirtyWorktree, "uncommitted.txt"))).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("removes a real linked worktree through git and prunes its registration", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const repo = path.join(root, "repo");
        const worktree = path.join(tmpRoot, "real-worktree");
        yield* Effect.forEach(
          [tmpRoot, cacheRoot, repo],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          {
            discard: true,
          }
        );
        yield* runCommand("git", ["init", "--quiet"], repo);
        yield* runCommand("git", ["config", "user.email", "tmpfs-reap@example.invalid"], repo);
        yield* runCommand("git", ["config", "user.name", "Tmpfs Reap Test"], repo);
        yield* fs.writeFileString(path.join(repo, "README.md"), "fixture\n");
        yield* runCommand("git", ["add", "README.md"], repo);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "fixture-worktree", worktree], repo);
        yield* runCommand("touch", ["-d", fixtureTimestamp(3), worktree], root);

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        const candidate = candidateByPath(report, worktree);
        expect(candidate.action).toBe("worktree-remove");
        expect(candidate.parentRepo).toBe(repo);
        expect(report.reapedCount).toBe(1);
        expect(yield* fs.exists(worktree)).toBe(false);
        const worktreeList = yield* runCommand("git", ["worktree", "list", "--porcelain"], repo);
        expect(Str.includes(worktree)(worktreeList)).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("ignores a symlinked tmp entry that resolves to a worktree outside the temporary root", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const repo = path.join(root, "repo");
        const outsideWorktree = path.join(root, "outside-worktree");
        const linkedEntry = path.join(tmpRoot, "linked-worktree");
        yield* Effect.forEach(
          [tmpRoot, cacheRoot, repo],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          {
            discard: true,
          }
        );
        yield* runCommand("git", ["init", "--quiet"], repo);
        yield* runCommand("git", ["config", "user.email", "tmpfs-reap@example.invalid"], repo);
        yield* runCommand("git", ["config", "user.name", "Tmpfs Reap Test"], repo);
        yield* fs.writeFileString(path.join(repo, "README.md"), "fixture\n");
        yield* runCommand("git", ["add", "README.md"], repo);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "outside-worktree", outsideWorktree], repo);
        yield* fs.writeFileString(path.join(outsideWorktree, "preserve.txt"), "do not delete\n");
        yield* fs.symlink(outsideWorktree, linkedEntry);
        yield* runCommand("touch", ["-h", "-d", fixtureTimestamp(3), linkedEntry], root);

        const discoveredReport = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        const explicitReport = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["git-worktree"],
          gitWorktreePaths: [linkedEntry],
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        expect(A.some(discoveredReport.candidates, (candidate) => candidate.path === linkedEntry)).toBe(false);
        expect(A.some(explicitReport.candidates, (candidate) => candidate.path === linkedEntry)).toBe(false);
        expect(discoveredReport.reapedCount).toBe(0);
        expect(explicitReport.reapedCount).toBe(0);
        expect(yield* fs.exists(outsideWorktree)).toBe(true);
        expect(yield* fs.readFileString(path.join(outsideWorktree, "preserve.txt"))).toBe("do not delete\n");
        const worktreeList = yield* runCommand("git", ["worktree", "list", "--porcelain"], repo);
        expect(Str.includes(outsideWorktree)(worktreeList)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("ignores a cache head-install root that resolves outside the configured cache", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const configuredBeepRoot = path.join(cacheRoot, "beep");
        const outsideHeadInstallRoot = path.join(root, "outside-head-install");
        const outsideInstall = path.join(outsideHeadInstallRoot, "beep-yeet-head-install-preserve");
        yield* Effect.forEach(
          [tmpRoot, configuredBeepRoot, outsideInstall],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* fs.writeFileString(path.join(outsideInstall, "preserve.txt"), "do not delete\n");
        yield* fs.symlink(outsideHeadInstallRoot, path.join(configuredBeepRoot, "head-install"));

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["head-install"],
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        expect(report.candidates).toStrictEqual([]);
        expect(report.reapedCount).toBe(0);
        expect(yield* fs.readFileString(path.join(outsideInstall, "preserve.txt"))).toBe("do not delete\n");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("falls back to directory mtime and rejects an explicit non-directory candidate", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const fallow = path.join(tmpRoot, "fallow-audit-base-cache-no-last-used");
        const explicitFile = path.join(tmpRoot, "explicit-file");
        yield* Effect.forEach([fallow, cacheRoot], (directory) => fs.makeDirectory(directory, { recursive: true }), {
          discard: true,
        });
        yield* fs.writeFileString(explicitFile, "not a directory\n");
        yield* runCommand("touch", ["-d", fixtureTimestamp(8), fallow], root);

        const discoveredReport = yield* runTmpfsReap({
          cacheRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        const explicitReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["git-worktree"],
          gitWorktreePaths: [explicitFile],
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        expect(candidateByPath(discoveredReport, fallow).action).toBe("remove-dir");
        expect(explicitReport.candidates).toStrictEqual([]);
        expect(yield* fs.readFileString(explicitFile)).toBe("not a directory\n");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // it.live: the sweep step consults the real clock, and the fixture ages are wall-clock relative.
  it.live("sweep step reaps this repo's idle tmpfs worktree and reports the reclaim", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const repo = path.join(root, "sweep-repo");
        const worktree = path.join(tmpRoot, "sweep-worktree");
        yield* Effect.forEach([tmpRoot, repo], (directory) => fs.makeDirectory(directory, { recursive: true }), {
          discard: true,
        });
        yield* runCommand("git", ["init", "--quiet"], repo);
        yield* runCommand("git", ["config", "user.email", "tmpfs-reap@example.invalid"], repo);
        yield* runCommand("git", ["config", "user.name", "Tmpfs Reap Test"], repo);
        yield* fs.writeFileString(path.join(repo, "README.md"), "fixture\n");
        yield* runCommand("git", ["add", "README.md"], repo);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "sweep-branch", worktree], repo);
        // The step runs against the real clock, so age the worktree relative to it.
        yield* runCommand("touch", ["-d", "3 hours ago", worktree], root);

        const outcome = yield* runTmpfsWorktreesStep(repo, tmpRoot);
        expect(outcome.status === "skipped" ? outcome.reason : "executed").toBe("executed");
        expect(yield* fs.exists(worktree)).toBe(false);
        const worktreeList = yield* runCommand("git", ["worktree", "list", "--porcelain"], repo);
        expect(Str.includes(worktree)(worktreeList)).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.live("sweep step skips when no repo worktree lives under the temporary root", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const repo = path.join(root, "sweep-repo");
        const diskWorktree = path.join(root, "disk-worktree");
        yield* Effect.forEach([tmpRoot, repo], (directory) => fs.makeDirectory(directory, { recursive: true }), {
          discard: true,
        });
        yield* runCommand("git", ["init", "--quiet"], repo);
        yield* runCommand("git", ["config", "user.email", "tmpfs-reap@example.invalid"], repo);
        yield* runCommand("git", ["config", "user.name", "Tmpfs Reap Test"], repo);
        yield* fs.writeFileString(path.join(repo, "README.md"), "fixture\n");
        yield* runCommand("git", ["add", "README.md"], repo);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "disk-branch", diskWorktree], repo);

        const outcome = yield* runTmpfsWorktreesStep(repo, tmpRoot);
        expect(outcome.status).toBe("skipped");
        expect(yield* fs.exists(diskWorktree)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
