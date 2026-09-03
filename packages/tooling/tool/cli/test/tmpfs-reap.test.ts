import {
  resolveBeepCacheRoot,
  runRepoCommandCapture,
  runTmpfsReap,
  TmpfsReapReport,
} from "@beep/repo-cli/test/RepoRun";
import { runTmpfsWorktreesStep } from "@beep/repo-cli/test/Yeet";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const FIXTURE_NOW_MILLIS = 2_000_000_000_000;
const noProcessCommandLines = () => Effect.succeed(A.empty<string>());
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
    fakeParent,
    fakeWorktree,
    fallow,
    fallowSiblingLastUsed,
    headInstall,
    oldSemanticDelta,
    tmpRoot,
    youngScoped,
  };
});

const makeNewClassFixtures = Effect.fn("TmpfsReapTest.makeNewClassFixtures")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmpRoot = path.join(root, "tmp");
  const cacheRoot = path.join(root, "cache");
  const vitestEligible = path.join(tmpRoot, "0123456789abcdefghijk");
  const vitestYoung = path.join(tmpRoot, "1234567890abcdefghijk");
  const vitestLive = path.join(tmpRoot, "2345678901abcdefghijk");
  const vitestWrongShape = path.join(tmpRoot, "3456789012abcdefghijk");
  const worktreesRoot = path.join(tmpRoot, "fixture-worktrees");
  const stubEligible = path.join(worktreesRoot, "eligible");
  const stubYoung = path.join(worktreesRoot, "young");
  const stubLive = path.join(worktreesRoot, "live");
  const stubWrongShape = path.join(worktreesRoot, "wrong-shape");
  const stubMalformedGitFile = path.join(worktreesRoot, "malformed-git-file");
  const stubRelativeGitDir = path.join(worktreesRoot, "relative-gitdir");
  const stubExistingTarget = path.join(worktreesRoot, "target-exists");
  const stubParentPresent = path.join(worktreesRoot, "parent-present");
  const stubContentsPresent = path.join(worktreesRoot, "contents-present");
  const stubTrackedContent = path.join(worktreesRoot, "tracked-content");
  const stubUntrackedContent = path.join(worktreesRoot, "untracked-content");
  const stubNestedContent = path.join(worktreesRoot, "nested-content");
  const stubSymlinkContent = path.join(worktreesRoot, "symlink-content");
  const stubSymlinkGitFile = path.join(worktreesRoot, "symlink-git-file");
  const stubOversizedGitFile = path.join(worktreesRoot, "oversized-git-file");
  const soleWorktreesRoot = path.join(tmpRoot, "sole-worktrees");
  const stubSoleEligible = path.join(soleWorktreesRoot, "eligible");
  const missingRepo = path.join(root, "missing-repo");
  const existingRepo = path.join(root, "existing-repo");
  const existingGitDir = path.join(existingRepo, ".git", "worktrees", "target-exists");
  const parentPresentRepo = path.join(root, "parent-present-repo");
  const unclassifiedWorktree = path.join(tmpRoot, "unclassified-worktree");

  yield* Effect.forEach(
    [
      cacheRoot,
      path.join(vitestEligible, "ssr"),
      path.join(vitestEligible, "client"),
      path.join(vitestYoung, "client"),
      path.join(vitestLive, "ssr"),
      path.join(vitestWrongShape, "coverage"),
      stubEligible,
      stubYoung,
      stubLive,
      stubWrongShape,
      stubMalformedGitFile,
      stubRelativeGitDir,
      stubExistingTarget,
      stubParentPresent,
      stubContentsPresent,
      stubTrackedContent,
      stubUntrackedContent,
      path.join(stubNestedContent, "nested"),
      stubSymlinkContent,
      stubSymlinkGitFile,
      stubOversizedGitFile,
      stubSoleEligible,
      existingGitDir,
      parentPresentRepo,
      unclassifiedWorktree,
    ],
    (directory) => fs.makeDirectory(directory, { recursive: true }),
    { discard: true }
  );
  yield* fs.writeFileString(path.join(stubEligible, ".git"), `gitdir: ${missingRepo}/.git/worktrees/eligible\n`);
  yield* fs.writeFileString(path.join(stubYoung, ".git"), `gitdir: ${missingRepo}/.git/worktrees/young\n`);
  yield* fs.writeFileString(path.join(stubLive, ".git"), `gitdir: ${missingRepo}/.git/worktrees/live\n`);
  yield* fs.writeFileString(path.join(stubSoleEligible, ".git"), `gitdir: ${missingRepo}/.git/worktrees/sole\n`);
  yield* fs.writeFileString(path.join(stubMalformedGitFile, ".git"), "gitdir: \n");
  yield* fs.writeFileString(path.join(stubRelativeGitDir, ".git"), "gitdir: ../../missing/.git/worktrees/relative\n");
  yield* fs.writeFileString(path.join(stubExistingTarget, ".git"), `gitdir: ${existingGitDir}\n`);
  yield* fs.writeFileString(
    path.join(stubParentPresent, ".git"),
    `gitdir: ${parentPresentRepo}/.git/worktrees/missing\n`
  );
  yield* fs.writeFileString(
    path.join(stubContentsPresent, ".git"),
    `gitdir: ${missingRepo}/.git/worktrees/contents-present\n`
  );
  yield* fs.writeFileString(path.join(stubContentsPresent, "unsaved.bin"), Str.repeat(1024 * 1024 + 1)("x"));
  yield* Effect.forEach(
    [stubTrackedContent, stubUntrackedContent, stubNestedContent, stubSymlinkContent],
    (candidate) =>
      fs.writeFileString(
        path.join(candidate, ".git"),
        `gitdir: ${missingRepo}/.git/worktrees/${path.basename(candidate)}\n`
      ),
    { discard: true }
  );
  yield* fs.writeFileString(path.join(stubTrackedContent, "tracked.txt"), "small tracked bytes\n");
  yield* fs.writeFileString(path.join(stubUntrackedContent, "untracked.txt"), "small untracked bytes\n");
  yield* fs.writeFileString(path.join(stubNestedContent, "nested", "notes.txt"), "nested bytes\n");
  yield* fs.symlink(path.join(root, "outside-target"), path.join(stubSymlinkContent, "linked-data"));
  const outsideGitFile = path.join(root, "outside-git-file");
  yield* fs.writeFileString(outsideGitFile, `gitdir: ${missingRepo}/.git/worktrees/symlink-git-file\n`);
  yield* fs.symlink(outsideGitFile, path.join(stubSymlinkGitFile, ".git"));
  yield* fs.writeFileString(path.join(stubOversizedGitFile, ".git"), Str.repeat(4097)("x"));
  yield* fs.writeFileString(
    path.join(vitestWrongShape, ".git"),
    `gitdir: ${missingRepo}/.git/worktrees/nanoid-git-worktree\n`
  );
  yield* fs.writeFileString(path.join(unclassifiedWorktree, ".git"), `gitdir: ${missingRepo}/not-a-worktree\n`);
  yield* Effect.forEach(
    [
      stubEligible,
      stubLive,
      stubWrongShape,
      stubMalformedGitFile,
      stubRelativeGitDir,
      stubExistingTarget,
      stubParentPresent,
      stubContentsPresent,
      stubTrackedContent,
      stubUntrackedContent,
      stubNestedContent,
      stubSymlinkContent,
      stubSymlinkGitFile,
      stubOversizedGitFile,
      stubSoleEligible,
      unclassifiedWorktree,
      vitestWrongShape,
    ],
    (candidate) => runCommand("touch", ["-d", fixtureTimestamp(3), candidate], root),
    { discard: true }
  );
  yield* Effect.forEach(
    [vitestEligible, path.join(vitestEligible, "ssr"), path.join(vitestEligible, "client")],
    (candidate) => runCommand("touch", ["-d", fixtureTimestamp(30), candidate], root),
    { discard: true }
  );
  yield* Effect.forEach(
    [vitestYoung, vitestLive, path.join(vitestLive, "ssr")],
    (candidate) => runCommand("touch", ["-d", fixtureTimestamp(30), candidate], root),
    { discard: true }
  );
  yield* Effect.forEach(
    [path.join(vitestYoung, "client"), stubYoung],
    (candidate) => runCommand("touch", ["-d", fixtureTimestamp(1), candidate], root),
    { discard: true }
  );

  return {
    cacheRoot,
    stubEligible,
    stubExistingTarget,
    stubLive,
    stubMalformedGitFile,
    stubParentPresent,
    stubContentsPresent,
    stubTrackedContent,
    stubUntrackedContent,
    stubNestedContent,
    stubSymlinkContent,
    stubSymlinkGitFile,
    stubOversizedGitFile,
    stubRelativeGitDir,
    stubSoleEligible,
    stubWrongShape,
    stubYoung,
    soleWorktreesRoot,
    tmpRoot,
    unclassifiedWorktree,
    vitestEligible,
    vitestLive,
    vitestWrongShape,
    vitestYoung,
  };
});

describe("tmpfs reap", () => {
  it.effect("resolves the persistent cache root through every configuration fallback", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const override = path.join(root, "override-cache");
        const xdgCache = path.join(root, "xdg-cache");
        const home = path.join(root, "home");
        const tmp = path.join(root, "tmp");

        expect(yield* resolveBeepCacheRoot(override)).toBe(path.resolve(override));
        expect(
          yield* resolveBeepCacheRoot().pipe(
            provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ XDG_CACHE_HOME: xdgCache })))
          )
        ).toBe(path.resolve(xdgCache));
        expect(
          yield* resolveBeepCacheRoot().pipe(
            provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ XDG_CACHE_HOME: "", HOME: home })))
          )
        ).toBe(path.join(path.resolve(home), ".cache"));
        expect(
          yield* resolveBeepCacheRoot().pipe(
            provideScopedLayer(
              ConfigProvider.layer(ConfigProvider.fromUnknown({ XDG_CACHE_HOME: "", HOME: "", TMPDIR: tmp }))
            )
          )
        ).toBe(path.resolve(tmp));
        expect(
          yield* resolveBeepCacheRoot().pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({}))))
        ).toBe(path.resolve("/tmp"));

        const missingCacheReport = yield* runTmpfsReap({
          cacheRoot: path.join(root, "missing-cache"),
          classes: ["head-install"],
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: root,
        });
        expect(missingCacheReport.candidates).toEqual([]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

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

  it.effect("classifies and applies Vitest forks scratch and dangling worktree stubs conservatively", () =>
    withTempDirectory((root) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const fixture = yield* makeNewClassFixtures(root);
          yield* ChildProcess.make("sh", ["-c", "while :; do sleep 1; done"], {
            cwd: fixture.vitestLive,
            stdin: "ignore",
            stderr: "pipe",
            stdout: "pipe",
          });
          yield* ChildProcess.make("sh", ["-c", "while :; do sleep 1; done"], {
            cwd: fixture.stubLive,
            stdin: "ignore",
            stderr: "pipe",
            stdout: "pipe",
          });

          const report = yield* runTmpfsReap({
            apply: true,
            cacheRoot: fixture.cacheRoot,
            classes: ["vitest-forks-tmp", "dangling-worktree-stub", "git-worktree"],
            listProcessCommandLines: noProcessCommandLines,
            nowMillis: FIXTURE_NOW_MILLIS,
            tmpRoot: fixture.tmpRoot,
          });

          const vitestEligible = candidateByPath(report, fixture.vitestEligible);
          expect(vitestEligible.root).toBe(fixture.tmpRoot);
          expect(vitestEligible.reapClass).toBe("vitest-forks-tmp");
          expect(vitestEligible.action).toBe("remove-dir");
          expect(yield* fs.exists(fixture.vitestEligible)).toBe(false);

          const vitestYoung = candidateByPath(report, fixture.vitestYoung);
          expect(vitestYoung.action).toBe("skip");
          expect(vitestYoung.skipReason).toBe("too-young");
          expect(yield* fs.exists(fixture.vitestYoung)).toBe(true);

          const vitestLive = candidateByPath(report, fixture.vitestLive);
          expect(vitestLive.refCount).toBeGreaterThan(0);
          expect(vitestLive.skipReason).toBe("live-cwd-ref");
          expect(yield* fs.exists(fixture.vitestLive)).toBe(true);

          const vitestWrongShape = candidateByPath(report, fixture.vitestWrongShape);
          expect(vitestWrongShape.action).toBe("skip");
          expect(vitestWrongShape.reapClass).toBe("git-worktree");
          expect(vitestWrongShape.skipReason).toBe("dirty-worktree");
          expect(yield* fs.exists(fixture.vitestWrongShape)).toBe(true);

          const stubEligible = candidateByPath(report, fixture.stubEligible);
          expect(stubEligible.root).toBe(fixture.tmpRoot);
          expect(stubEligible.reapClass).toBe("dangling-worktree-stub");
          expect(stubEligible.action).toBe("remove-dir");
          expect(yield* fs.exists(fixture.stubEligible)).toBe(false);

          const stubYoung = candidateByPath(report, fixture.stubYoung);
          expect(stubYoung.skipReason).toBe("too-young");
          expect(yield* fs.exists(fixture.stubYoung)).toBe(true);

          const stubLive = candidateByPath(report, fixture.stubLive);
          expect(stubLive.refCount).toBeGreaterThan(0);
          expect(stubLive.skipReason).toBe("live-cwd-ref");
          expect(yield* fs.exists(fixture.stubLive)).toBe(true);

          const stubWrongShape = candidateByPath(report, fixture.stubWrongShape);
          expect(stubWrongShape.skipReason).toBe("wrong-shape");
          expect(yield* fs.exists(fixture.stubWrongShape)).toBe(true);

          expect(candidateByPath(report, fixture.stubMalformedGitFile).skipReason).toBe("wrong-shape");
          expect(candidateByPath(report, fixture.stubSymlinkGitFile).skipReason).toBe("wrong-shape");
          expect(candidateByPath(report, fixture.stubOversizedGitFile).skipReason).toBe("wrong-shape");
          expect(yield* fs.exists(fixture.stubSymlinkGitFile)).toBe(true);
          expect(yield* fs.exists(fixture.stubOversizedGitFile)).toBe(true);

          const stubRelativeGitDir = candidateByPath(report, fixture.stubRelativeGitDir);
          expect(stubRelativeGitDir.action).toBe("remove-dir");
          expect(yield* fs.exists(fixture.stubRelativeGitDir)).toBe(false);

          const stubExistingTarget = candidateByPath(report, fixture.stubExistingTarget);
          expect(stubExistingTarget.skipReason).toBe("gitdir-target-exists");
          expect(stubExistingTarget.bytes).toBeUndefined();
          expect(yield* fs.exists(fixture.stubExistingTarget)).toBe(true);

          const stubParentPresent = candidateByPath(report, fixture.stubParentPresent);
          expect(stubParentPresent.skipReason).toBe("parent-repo-present");
          expect(stubParentPresent.bytes).toBeUndefined();
          expect(yield* fs.exists(fixture.stubParentPresent)).toBe(true);

          const stubContentsPresent = candidateByPath(report, fixture.stubContentsPresent);
          expect(stubContentsPresent.skipReason).toBe("contents-present");
          expect(stubContentsPresent.bytes).toBeUndefined();
          expect(yield* fs.exists(fixture.stubContentsPresent)).toBe(true);

          for (const preserved of [
            fixture.stubTrackedContent,
            fixture.stubUntrackedContent,
            fixture.stubNestedContent,
            fixture.stubSymlinkContent,
          ]) {
            const candidate = candidateByPath(report, preserved);
            expect(candidate.skipReason).toBe("contents-present");
            expect(candidate.bytes).toBeUndefined();
            expect(yield* fs.exists(preserved)).toBe(true);
          }

          expect(candidateByPath(report, fixture.unclassifiedWorktree).skipReason).toBe("unclassified");

          expect(candidateByPath(report, fixture.stubSoleEligible).action).toBe("remove-dir");
          expect(yield* fs.exists(fixture.stubSoleEligible)).toBe(false);
          expect(report.reapedCount).toBe(4);
        })
      )
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("fails closed when discovered candidates change during the liveness scan", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeNewClassFixtures(root);
        const stubGitFile = path.join(fixture.stubEligible, ".git");
        const worktreeGitFile = path.join(fixture.vitestWrongShape, ".git");
        const missingStatTarget = path.join(root, "missing-stat-target");
        const missingCacheRoot = path.join(root, "missing-cache-root");
        let stubGitStatCount = 0;
        const racingFileSystem = FileSystem.makeNoop({
          ...fs,
          stat: (target) => {
            if (Str.Equivalence(target, stubGitFile)) {
              stubGitStatCount += 1;
              if (stubGitStatCount > 1) return fs.stat(missingStatTarget);
            }
            return fs.stat(target);
          },
        });

        const report = yield* runTmpfsReap({
          cacheRoot: missingCacheRoot,
          listProcessCommandLines: () => fs.remove(worktreeGitFile).pipe(Effect.orDie, Effect.as(A.empty<string>())),
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem));

        expect(candidateByPath(report, fixture.stubEligible).skipReason).toBe("contents-present");
        expect(candidateByPath(report, fixture.vitestWrongShape).skipReason).toBe("dirty-worktree");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("rejects a dangling stub whose Git marker becomes a symlink during discovery", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeNewClassFixtures(root);
        const gitFile = path.join(fixture.stubEligible, ".git");
        let readLinkCount = 0;
        const racingFileSystem = FileSystem.makeNoop({
          ...fs,
          readLink: (target) => {
            if (!Str.Equivalence(target, gitFile)) return fs.readLink(target);
            readLinkCount += 1;
            return readLinkCount === 2 ? Effect.succeed("raced-git-marker") : fs.readLink(target);
          },
        });

        const report = yield* runTmpfsReap({
          cacheRoot: fixture.cacheRoot,
          classes: ["dangling-worktree-stub"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem));

        expect(readLinkCount).toBe(2);
        expect(candidateByPath(report, fixture.stubEligible).skipReason).toBe("contents-present");
        expect(yield* fs.exists(fixture.stubEligible)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("revalidates dangling-stub eligibility immediately before removal", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeNewClassFixtures(root);
        const gitFile = path.join(fixture.stubEligible, ".git");
        const missingStatTarget = path.join(root, "missing-stat-target");
        let gitFileStatCount = 0;
        const racingFileSystem = FileSystem.makeNoop({
          ...fs,
          stat: (target) => {
            if (!Str.Equivalence(target, gitFile)) return fs.stat(target);
            gitFileStatCount += 1;
            return gitFileStatCount === 3 ? fs.stat(missingStatTarget) : fs.stat(target);
          },
        });

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: fixture.cacheRoot,
          classes: ["dangling-worktree-stub"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem));

        expect(gitFileStatCount).toBe(3);
        expect(yield* fs.exists(fixture.stubEligible)).toBe(true);
        expect(report.warnings).toContain(
          `Skipped ${fixture.stubEligible}: dangling-stub eligibility changed before removal.`
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves candidates when guarded filesystem removal fails", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeNewClassFixtures(root);
        const gitFile = path.join(fixture.stubSoleEligible, ".git");
        const scopedCandidate = path.join(fixture.tmpRoot, "beep-knowledge-refs-remove-failure");
        yield* fs.makeDirectory(scopedCandidate, { recursive: true });
        yield* fs.writeFileString(path.join(scopedCandidate, "payload.txt"), "preserve\n");
        yield* runCommand("touch", ["-d", fixtureTimestamp(3), scopedCandidate], root);
        const failingFileSystem = FileSystem.makeNoop({
          ...fs,
          remove: (target, options) =>
            Str.Equivalence(target, gitFile) || Str.Equivalence(target, scopedCandidate)
              ? Effect.fail(
                  PlatformError.badArgument({
                    description: "simulated guarded removal failure",
                    method: "remove",
                    module: "FileSystem",
                  })
                )
              : fs.remove(target, options),
        });

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: fixture.cacheRoot,
          classes: ["dangling-worktree-stub", "scoped-temp"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, failingFileSystem));

        expect(report.warnings).toContain(`Failed to remove ${gitFile}.`);
        expect(report.warnings).toContain(`Failed to remove ${scopedCandidate}.`);
        expect(yield* fs.exists(fixture.stubSoleEligible)).toBe(true);
        expect(yield* fs.exists(scopedCandidate)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves an emptied dangling stub when the guarded rmdir process cannot start", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const fixture = yield* makeNewClassFixtures(root);
        const failingSpawner = ChildProcessSpawner.make(() =>
          Effect.fail(
            PlatformError.badArgument({
              description: "simulated rmdir spawn failure",
              method: "spawn",
              module: "ChildProcessSpawner",
            })
          )
        );

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: fixture.cacheRoot,
          classes: ["dangling-worktree-stub"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, failingSpawner));

        expect(yield* fs.exists(fixture.stubSoleEligible)).toBe(true);
        expect(report.warnings).toContain(
          `Preserved raced contents under ${fixture.stubSoleEligible}; directory was not empty.`
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("removes a worktree directory directly when its parent repository disappears", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeClassificationFixture(root);
        const parentGitDirectory = path.join(fixture.fakeParent, ".git");
        const missingParentFileSystem = FileSystem.makeNoop({
          ...fs,
          exists: (target) =>
            Str.Equivalence(target, parentGitDirectory)
              ? Effect.fail(
                  PlatformError.badArgument({
                    description: "simulated vanished parent repository",
                    method: "exists",
                    module: "FileSystem",
                  })
                )
              : fs.exists(target),
        });

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: fixture.cacheRoot,
          classes: ["git-worktree"],
          gitWorktreePaths: [fixture.fakeWorktree],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, missingParentFileSystem));

        expect(report.reapedCount).toBe(1);
        expect(yield* fs.exists(fixture.fakeWorktree)).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves a container child created when non-recursive cleanup begins", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeNewClassFixtures(root);
        const racedChild = path.join(fixture.soleWorktreesRoot, "concurrent-worktree");
        const racingFileSystem = FileSystem.makeNoop({
          ...fs,
          readDirectory: (target) =>
            Str.Equivalence(target, fixture.soleWorktreesRoot)
              ? fs
                  .exists(fixture.stubSoleEligible)
                  .pipe(
                    Effect.flatMap((stubExists) =>
                      stubExists
                        ? fs.readDirectory(target)
                        : fs.makeDirectory(racedChild).pipe(Effect.andThen(fs.readDirectory(target)))
                    )
                  )
              : fs.readDirectory(target),
        });
        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: fixture.cacheRoot,
          classes: ["dangling-worktree-stub"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem));

        expect(candidateByPath(report, fixture.stubSoleEligible).action).toBe("remove-dir");
        expect(yield* fs.exists(fixture.stubSoleEligible)).toBe(false);
        expect(yield* fs.exists(racedChild)).toBe(true);
        expect(A.some(report.warnings, Str.includes(fixture.soleWorktreesRoot))).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("keeps dangling worktree stubs when census metadata vanishes or removal fails", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeNewClassFixtures(root);
        const gitFile = path.join(fixture.stubEligible, ".git");
        const relativeGitFile = path.join(fixture.stubRelativeGitDir, ".git");
        const racedContent = path.join(fixture.stubRelativeGitDir, "raced-content");
        const missingStatTarget = path.join(root, "missing-stat-target");
        const missingCacheRoot = path.join(root, "missing-cache");
        let gitFileStatCount = 0;
        const racingFileSystem = FileSystem.makeNoop({
          ...fs,
          remove: (target, options) =>
            Str.Equivalence(target, relativeGitFile)
              ? fs.remove(target, options).pipe(Effect.andThen(fs.writeFileString(racedContent, "race")))
              : fs.remove(target, options),
          stat: (target) => {
            if (!Str.Equivalence(target, gitFile)) return fs.stat(target);
            gitFileStatCount += 1;
            return gitFileStatCount === 2 ? fs.stat(missingStatTarget) : fs.stat(target);
          },
        });

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot: missingCacheRoot,
          classes: ["dangling-worktree-stub"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot: fixture.tmpRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem));

        const candidate = candidateByPath(report, fixture.stubEligible);
        expect(candidate.action).toBe("skip");
        expect(candidate.skipReason).toBe("contents-present");
        expect(yield* fs.exists(fixture.stubEligible)).toBe(true);
        expect(gitFileStatCount).toBe(2);
        expect(yield* fs.exists(fixture.stubRelativeGitDir)).toBe(true);
        expect(report.warnings).toContain(
          `Preserved raced contents under ${fixture.stubRelativeGitDir}; directory was not empty.`
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("skips every Vitest forks candidate when the injected process listing sees a live runner", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const candidatePath = path.join(tmpRoot, "4567890123abcdefghijk");
        const ssr = path.join(candidatePath, "ssr");
        yield* Effect.forEach([ssr, cacheRoot], (directory) => fs.makeDirectory(directory, { recursive: true }), {
          discard: true,
        });
        yield* Effect.forEach(
          [candidatePath, ssr],
          (candidate) => runCommand("touch", ["-d", fixtureTimestamp(30), candidate], root),
          { discard: true }
        );

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["vitest-forks-tmp"],
          listProcessCommandLines: () => Effect.succeed(["bun\u0000vitest\u0000run"]),
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        const candidate = candidateByPath(report, candidatePath);
        expect(candidate.skipReason).toBe("live-runner");
        expect(candidate.action).toBe("skip");
        expect(yield* fs.exists(candidatePath)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("distinguishes a live file descriptor from a live working-directory reference", () =>
    withTempDirectory((root) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpRoot = path.join(root, "tmp");
          const cacheRoot = path.join(root, "cache");
          const candidatePath = path.join(tmpRoot, "beep-knowledge-refs-live-fd");
          const payloadPath = path.join(candidatePath, "payload.txt");
          yield* Effect.forEach(
            [candidatePath, cacheRoot],
            (directory) => fs.makeDirectory(directory, { recursive: true }),
            {
              discard: true,
            }
          );
          yield* fs.writeFileString(payloadPath, "held open\n");
          yield* runCommand("touch", ["-d", fixtureTimestamp(3), candidatePath], root);

          yield* ChildProcess.make(
            "sh",
            ["-c", 'exec 3< "$1"; while :; do sleep 1; done', "tmpfs-reap-fd", payloadPath],
            { cwd: root, stdin: "ignore", stderr: "pipe", stdout: "pipe" }
          );

          const report = yield* runTmpfsReap({ cacheRoot, nowMillis: FIXTURE_NOW_MILLIS, tmpRoot });
          const candidate = candidateByPath(report, candidatePath);
          expect(candidate.refCount).toBeGreaterThan(0);
          expect(candidate.skipReason).toBe("live-fd-ref");
        })
      )
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("recognizes a held fallow-cache flock independently of path references", () =>
    withTempDirectory((root) =>
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpRoot = path.join(root, "tmp");
          const cacheRoot = path.join(root, "cache");
          const candidatePath = path.join(tmpRoot, "fallow-audit-base-cache-locked");
          const lockPath = `${candidatePath}.lock`;
          yield* Effect.forEach(
            [candidatePath, cacheRoot],
            (directory) => fs.makeDirectory(directory, { recursive: true }),
            {
              discard: true,
            }
          );
          yield* fs.writeFileString(path.join(candidatePath, "payload.txt"), "cached\n");
          yield* runCommand("touch", ["-d", fixtureTimestamp(8), candidatePath], root);

          yield* ChildProcess.make("flock", ["-x", lockPath, "sh", "-c", "while :; do sleep 1; done"], {
            cwd: root,
            stdin: "ignore",
            stderr: "pipe",
            stdout: "pipe",
          });

          const report = yield* runTmpfsReap({ cacheRoot, nowMillis: FIXTURE_NOW_MILLIS, tmpRoot });
          const candidate = candidateByPath(report, candidatePath);
          expect(candidate.refCount).toBe(0);
          expect(candidate.skipReason).toBe("live-flock");
        })
      )
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("rejects symlink escapes and ignores non-directory worktree-container entries", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const safeWorktreesRoot = path.join(tmpRoot, "safe-worktrees");
        const escapedRootTarget = path.join(root, "escaped-root-target");
        const escapedChildTarget = path.join(root, "escaped-child-target");
        const missingRepo = path.join(root, "missing-repo");
        yield* Effect.forEach(
          [safeWorktreesRoot, escapedRootTarget, escapedChildTarget, cacheRoot],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* fs.writeFileString(
          path.join(escapedChildTarget, ".git"),
          `gitdir: ${missingRepo}/.git/worktrees/escaped\n`
        );
        yield* fs.writeFileString(path.join(safeWorktreesRoot, "not-a-directory"), "fixture\n");
        yield* fs.symlink(escapedChildTarget, path.join(safeWorktreesRoot, "escaped-child"));
        yield* fs.symlink(escapedRootTarget, path.join(tmpRoot, "escaped-worktrees"));

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["dangling-worktree-stub"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });
        const escapedChild = candidateByPath(report, escapedChildTarget);
        expect(escapedChild.skipReason).toBe("wrong-shape");
        expect(candidateByPath(report, escapedRootTarget).skipReason).toBe("wrong-shape");
        expect(yield* fs.exists(escapedChildTarget)).toBe(true);
        expect(yield* fs.exists(escapedRootTarget)).toBe(true);
        expect(report.candidates).toHaveLength(2);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("walks the mandatory scratch root plus a distinct absolute TMPDIR and de-duplicates them", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const systemTmpRoot = path.join(root, "system-tmp");
        const configuredTmpRoot = path.join(root, "configured-tmp");
        const homeRoot = path.join(root, "home");
        const cacheRoot = path.join(root, "cache");
        const systemCandidate = path.join(systemTmpRoot, "beep-knowledge-refs-system");
        const configuredCandidate = path.join(configuredTmpRoot, "beep-knowledge-refs-configured");
        yield* Effect.forEach(
          [systemCandidate, configuredCandidate, cacheRoot, homeRoot],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* Effect.forEach(
          [systemCandidate, configuredCandidate],
          (candidate) => runCommand("touch", ["-d", fixtureTimestamp(3), candidate], root),
          { discard: true }
        );

        const configuredReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: configuredTmpRoot }))));
        expect(configuredReport.tmpRoots).toEqual([systemTmpRoot, configuredTmpRoot]);
        expect(candidateByPath(configuredReport, systemCandidate).root).toBe(systemTmpRoot);
        expect(candidateByPath(configuredReport, configuredCandidate).root).toBe(configuredTmpRoot);

        const unsetReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({}))));
        expect(unsetReport.tmpRoots).toEqual([systemTmpRoot]);
        expect(unsetReport.candidates).toHaveLength(1);

        const malformedReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: {} }))));
        expect(malformedReport.tmpRoots).toEqual([systemTmpRoot]);

        const unavailableReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(
          provideScopedLayer(
            ConfigProvider.layer(
              ConfigProvider.make(() =>
                Effect.fail(new ConfigProvider.SourceError({ message: "configuration source unavailable" }))
              )
            )
          )
        );
        expect(unavailableReport.tmpRoots).toEqual([systemTmpRoot]);

        const duplicateReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: `${systemTmpRoot}/` }))));
        expect(duplicateReport.tmpRoots).toEqual([systemTmpRoot]);

        const homeReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(
          provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: homeRoot, TMPDIR: homeRoot })))
        );
        expect(homeReport.tmpRoots).toEqual([systemTmpRoot]);
        expect(A.some(homeReport.warnings, Str.includes("HOME"))).toBe(true);

        const relativeReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: "relative-tmp" }))));
        expect(relativeReport.tmpRoots).toEqual([systemTmpRoot]);

        const missingTmpRoot = path.join(root, "missing-tmpdir");
        const unreadableReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: missingTmpRoot }))));
        expect(unreadableReport.warnings).toContain("Dropped TMPDIR because its canonical path is unreadable.");

        const rootReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: "/" }))));
        expect(rootReport.warnings).toContain("Dropped TMPDIR because it resolves to the filesystem root.");

        const ancestorReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME: homeRoot, TMPDIR: root }))));
        expect(ancestorReport.warnings).toContain("Dropped TMPDIR because it is an ancestor of HOME.");

        const checkoutReport = yield* runTmpfsReap({
          cacheRoot,
          classes: ["scoped-temp"],
          nowMillis: FIXTURE_NOW_MILLIS,
          systemTmpRoot,
        }).pipe(provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ TMPDIR: process.cwd() }))));
        expect(checkoutReport.warnings).toContain("Dropped TMPDIR because it contains the invoking checkout.");

        const explicitMissingRoot = path.join(root, "missing-explicit-root");
        const explicitReport = yield* runTmpfsReap({ cacheRoot, tmpRoot: explicitMissingRoot });
        expect(explicitReport.tmpRoots).toEqual([explicitMissingRoot]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("falls back safely when ambient TMPDIR is malformed and the HOME cache does not exist", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const homeRoot = path.join(root, "home");
        const systemTmpRoot = path.join(root, "system-tmp");
        yield* Effect.forEach(
          [homeRoot, systemTmpRoot],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );

        const configProvider = ConfigProvider.make((configPath) => {
          const name = A.head(configPath);
          if (O.isSome(name) && name.value === "HOME") {
            return Effect.succeed(ConfigProvider.makeValue(homeRoot));
          }
          if (O.isSome(name) && name.value === "TMPDIR") {
            return Effect.fail(new ConfigProvider.SourceError({ message: "fixture TMPDIR source failure" }));
          }
          return Effect.void.pipe(Effect.as(undefined));
        });
        const cacheRoot = yield* resolveBeepCacheRoot().pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, configProvider)
        );
        expect(cacheRoot).toBe(path.join(homeRoot, ".cache"));
        expect(yield* fs.exists(cacheRoot)).toBe(false);

        const report = yield* runTmpfsReap({
          classes: ["head-install"],
          listProcessCommandLines: noProcessCommandLines,
          systemTmpRoot,
        }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, configProvider));
        expect(report.tmpRoots).toEqual([systemTmpRoot]);
        expect(report.candidates).toEqual([]);
        expect(report.warnings).toEqual([]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("round-trips the additive tmpfs-reap/v1 root fields through the report schema", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const candidatePath = path.join(tmpRoot, "beep-knowledge-refs-round-trip");
        yield* Effect.forEach(
          [candidatePath, cacheRoot],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          {
            discard: true,
          }
        );
        yield* runCommand("touch", ["-d", fixtureTimestamp(3), candidatePath], root);
        const report = yield* runTmpfsReap({ cacheRoot, nowMillis: FIXTURE_NOW_MILLIS, tmpRoot });
        const encoded = yield* S.encodeEffect(S.fromJsonString(TmpfsReapReport))(report);
        const decoded = yield* S.decodeEffect(S.fromJsonString(TmpfsReapReport))(encoded);
        expect(decoded).toEqual(report);
        expect(decoded.schemaVersion).toBe("tmpfs-reap/v1");
        expect(candidateByPath(decoded, candidatePath).root).toBe(tmpRoot);

        const legacy = yield* S.decodeEffect(TmpfsReapReport)({
          schemaVersion: "tmpfs-reap/v1",
          scannedAt: "2026-08-29T12:00:00.000Z",
          tmpRoot: "/tmp",
          applied: false,
          candidates: [
            {
              path: "/tmp/beep-knowledge-refs-legacy",
              reapClass: "scoped-temp",
              ageHours: 3,
              refCount: 0,
              action: "remove-dir",
              bytes: 1,
            },
          ],
          reapedCount: 0,
          reclaimedBytes: 0,
          warnings: [],
        });
        expect(legacy.tmpRoots).toBeUndefined();
        expect(legacy.candidates[0]?.root).toBeUndefined();
      })
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

  it.effect("releases nested head-install worktrees and reports a locked release failure", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const repo = path.join(root, "repo");
        const headInstallRoot = path.join(cacheRoot, "beep", "head-install");
        const releasedInstall = path.join(headInstallRoot, "beep-yeet-head-install-released");
        const lockedInstall = path.join(headInstallRoot, "beep-yeet-head-install-locked");
        const releasedCheckout = path.join(releasedInstall, "checkout");
        const lockedCheckout = path.join(lockedInstall, "checkout");
        yield* Effect.forEach([tmpRoot, repo], (directory) => fs.makeDirectory(directory, { recursive: true }), {
          discard: true,
        });
        yield* runCommand("git", ["init", "--quiet"], repo);
        yield* runCommand("git", ["config", "user.email", "tmpfs-reap@example.invalid"], repo);
        yield* runCommand("git", ["config", "user.name", "Tmpfs Reap Test"], repo);
        yield* fs.writeFileString(path.join(repo, "README.md"), "fixture\n");
        yield* runCommand("git", ["add", "README.md"], repo);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "released-install", releasedCheckout], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "locked-install", lockedCheckout], repo);
        yield* runCommand("git", ["worktree", "lock", lockedCheckout], repo);
        yield* Effect.forEach(
          [releasedInstall, lockedInstall],
          (candidate) => runCommand("touch", ["-d", fixtureTimestamp(2), candidate], root),
          { discard: true }
        );

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["head-install"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });

        expect(report.reapedCount).toBe(2);
        expect(yield* fs.exists(releasedInstall)).toBe(false);
        expect(yield* fs.exists(lockedInstall)).toBe(false);
        expect(A.some(report.warnings, Str.includes(`Nested head-install checkout ${lockedCheckout}`))).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("never follows a nested head-install checkout symlink outside the install root", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const repo = path.join(root, "repo");
        const install = path.join(cacheRoot, "beep", "head-install", "beep-yeet-head-install-linked");
        const checkout = path.join(install, "checkout");
        const outsideWorktree = path.join(root, "outside-worktree");
        yield* Effect.forEach(
          [tmpRoot, repo, install],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* runCommand("git", ["init", "--quiet"], repo);
        yield* runCommand("git", ["config", "user.email", "tmpfs-reap@example.invalid"], repo);
        yield* runCommand("git", ["config", "user.name", "Tmpfs Reap Test"], repo);
        yield* fs.writeFileString(path.join(repo, "README.md"), "fixture\n");
        yield* runCommand("git", ["add", "README.md"], repo);
        yield* runCommand("git", ["commit", "--quiet", "-m", "fixture"], repo);
        yield* runCommand("git", ["worktree", "add", "--quiet", "-b", "outside-install", outsideWorktree], repo);
        yield* fs.writeFileString(path.join(outsideWorktree, "preserve.txt"), "do not delete\n");
        yield* fs.symlink(outsideWorktree, checkout);
        yield* runCommand("touch", ["-d", fixtureTimestamp(2), install], root);

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["head-install"],
          listProcessCommandLines: noProcessCommandLines,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });

        expect(report.reapedCount).toBe(1);
        expect(yield* fs.exists(install)).toBe(false);
        expect(yield* fs.readFileString(path.join(outsideWorktree, "preserve.txt"))).toBe("do not delete\n");
        expect(A.some(report.warnings, Str.includes(`Skipped unsafe nested head-install checkout ${checkout}`))).toBe(
          true
        );
        const worktreeList = yield* runCommand("git", ["worktree", "list", "--porcelain"], repo);
        expect(Str.includes(outsideWorktree)(worktreeList)).toBe(true);
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

  it.effect("revalidates a discovered candidate immediately before removal", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpRoot = path.join(root, "tmp");
        const cacheRoot = path.join(root, "cache");
        const candidate = path.join(tmpRoot, "beep-knowledge-refs-race");
        const outside = path.join(root, "outside-preserve");
        yield* Effect.forEach(
          [candidate, cacheRoot, outside],
          (directory) => fs.makeDirectory(directory, { recursive: true }),
          { discard: true }
        );
        yield* fs.writeFileString(path.join(candidate, "old.txt"), "old candidate\n");
        yield* fs.writeFileString(path.join(outside, "preserve.txt"), "do not delete\n");
        yield* runCommand("touch", ["-d", fixtureTimestamp(3), candidate], root);

        const swapCandidateBeforeProcessScan = Effect.fn("TmpfsReapTest.swapCandidateBeforeProcessScan")(function* () {
          yield* fs.remove(candidate, { force: true, recursive: true });
          yield* fs.symlink(outside, candidate);
          return A.empty<string>();
        }, Effect.orDie);

        const report = yield* runTmpfsReap({
          apply: true,
          cacheRoot,
          classes: ["scoped-temp"],
          listProcessCommandLines: swapCandidateBeforeProcessScan,
          nowMillis: FIXTURE_NOW_MILLIS,
          tmpRoot,
        });

        expect(report.reapedCount).toBe(0);
        expect(A.some(report.warnings, Str.includes(`${candidate}: path changed or escaped its discovery root`))).toBe(
          true
        );
        expect(yield* fs.readFileString(path.join(outside, "preserve.txt"))).toBe("do not delete\n");
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

  it("property: tmpfs-reap reports round-trip through the JSON codec", () => {
    const ReportArbitrary = S.toArbitrary(TmpfsReapReport)(fc);
    fc.assert(
      fc.property(ReportArbitrary, (report) => {
        const encoded = S.encodeSync(S.fromJsonString(TmpfsReapReport))(report);
        const decoded = S.decodeSync(S.fromJsonString(TmpfsReapReport))(encoded);
        expect(decoded.schemaVersion).toBe(report.schemaVersion);
        expect(decoded.tmpRoot).toBe(report.tmpRoot);
        expect(A.length(decoded.candidates)).toBe(A.length(report.candidates));
        // JSON drops the sign of -0, so the codec law is encode-stability
        // rather than Object.is identity on numeric fields.
        expect(S.encodeSync(S.fromJsonString(TmpfsReapReport))(decoded)).toBe(encoded);
      }),
      fcRuns(32)
    );
  });
});
