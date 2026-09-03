import {
  ResidueReapCandidate,
  ResidueReapReport,
  runRepoCommandCapture,
  runResidueReap,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const FIXTURE_NOW_MILLIS = 2_000_000_000_000;
const noLiveCwd = () => Effect.succeedSome(false);

const withTempDirectory = <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "residue-reap-test-" });
    }),
    use,
    (root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(root, { force: true, recursive: true });
      })
  );

const fixtureTimestamp = (daysAgo: number): string =>
  `@${(FIXTURE_NOW_MILLIS - Duration.toMillis(Duration.days(daysAgo))) / Duration.toMillis(Duration.seconds(1))}`;

const runFixtureCommand = Effect.fn("ResidueReapTest.runFixtureCommand")(function* (
  cwd: string,
  command: string,
  args: ReadonlyArray<string>
) {
  const result = yield* runRepoCommandCapture(command, args, cwd);
  expect(result.exitCode, result.output).toBe(0);
  return result.output;
});

const touchDaysAgo = Effect.fn("ResidueReapTest.touchDaysAgo")(function* (
  root: string,
  candidatePath: string,
  daysAgo: number
) {
  yield* runFixtureCommand(root, "touch", ["-d", fixtureTimestamp(daysAgo), candidatePath]);
});

const touchTreeDaysAgo = Effect.fn("ResidueReapTest.touchTreeDaysAgo")(function* (
  root: string,
  target: string,
  daysAgo: number
) {
  yield* runFixtureCommand(root, "find", [target, "-exec", "touch", "-d", fixtureTimestamp(daysAgo), "{}", "+"]);
});

const makeEmbeddedRepo = Effect.fn("ResidueReapTest.makeEmbeddedRepo")(function* (worktreeRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = path.join(worktreeRoot, "repo");
  yield* fs.makeDirectory(repoRoot, { recursive: true });
  yield* runFixtureCommand(repoRoot, "git", ["init", "--quiet", "-b", "main"]);
  yield* runFixtureCommand(repoRoot, "git", ["config", "user.email", "residue-reap@example.invalid"]);
  yield* runFixtureCommand(repoRoot, "git", ["config", "user.name", "Residue Reap Test"]);
  yield* runFixtureCommand(repoRoot, "git", ["config", "commit.gpgsign", "false"]);
  return repoRoot;
});

const candidateByPath = (report: ResidueReapReport, candidatePath: string): ResidueReapReport["candidates"][number] =>
  O.getOrThrow(A.findFirst(report.candidates, (candidate) => Str.Equivalence(candidate.path, candidatePath)));

const makeFixture = Effect.fn("ResidueReapTest.makeFixture")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const homeRoot = path.join(root, "home");
  const repoRoot = path.join(root, "repo");
  const sessionsRoot = path.join(homeRoot, ".codex", "sessions", "2026", "01");
  const archivedRoot = path.join(homeRoot, ".codex", "archived_sessions");
  const worktreesRoot = path.join(homeRoot, ".codex", "worktrees");
  const beepCacheRoot = path.join(homeRoot, ".cache", "beep");
  const turboCacheRoot = path.join(repoRoot, ".turbo", "cache");
  const oldSession = path.join(sessionsRoot, "old.jsonl");
  const youngSession = path.join(sessionsRoot, "young.jsonl");
  const protectedSession = path.join(sessionsRoot, "auth-copy.jsonl");
  const archivedSession = path.join(archivedRoot, "archived.jsonl");
  const oldWorktree = path.join(worktreesRoot, "old-worktree");
  const worktreePayload = path.join(oldWorktree, "payload.txt");
  const disposable = path.join(beepCacheRoot, "photo-face-old");
  const disposablePayload = path.join(disposable, "payload.txt");
  const durable = path.join(beepCacheRoot, "handoffs");
  const worktreeResidue = path.join(beepCacheRoot, "worktree-residue");
  const worktreeResiduePayload = path.join(worktreeResidue, "archive.patch");
  const turboEntry = path.join(turboCacheRoot, "old-cache.tar.zst");

  yield* Effect.forEach(
    [sessionsRoot, archivedRoot, oldWorktree, disposable, durable, worktreeResidue, turboCacheRoot],
    (directory) => fs.makeDirectory(directory, { recursive: true }),
    { discard: true }
  );
  yield* Effect.forEach(
    [
      oldSession,
      youngSession,
      protectedSession,
      archivedSession,
      worktreePayload,
      disposablePayload,
      worktreeResiduePayload,
      turboEntry,
    ],
    (file) => fs.writeFileString(file, `fixture:${path.basename(file)}\n`),
    { discard: true }
  );
  yield* Effect.forEach(
    [
      oldSession,
      protectedSession,
      archivedSession,
      worktreePayload,
      disposablePayload,
      worktreeResiduePayload,
      turboEntry,
    ],
    (file) => touchDaysAgo(root, file, 45),
    { discard: true }
  );
  yield* touchDaysAgo(root, youngSession, 2);

  return {
    archivedSession,
    beepCacheRoot,
    disposable,
    durable,
    homeRoot,
    oldSession,
    oldWorktree,
    protectedSession,
    repoRoot,
    sessionsRoot,
    turboCacheRoot,
    turboEntry,
    worktreePayload,
    worktreeResidue,
    youngSession,
  };
});

describe("residue reap", () => {
  it.effect("classifies age, protects durable names, and keeps file and directory actions distinct", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture(root);
        const report = yield* runResidueReap({
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });

        expect(candidateByPath(report, fixture.oldSession).action).toBe("remove-file");
        expect(candidateByPath(report, fixture.youngSession).skipReason).toBe("too-young");
        expect(candidateByPath(report, fixture.protectedSession).skipReason).toBe("protected-name");
        expect(candidateByPath(report, fixture.archivedSession).action).toBe("remove-file");
        expect(candidateByPath(report, fixture.oldWorktree).action).toBe("remove-dir");
        expect(candidateByPath(report, fixture.disposable).action).toBe("remove-dir");
        expect(A.some(report.candidates, (candidate) => Str.Equivalence(candidate.path, fixture.durable))).toBe(false);
        // worktree-residue archives are the preserved copy of retired worktree state and
        // must never surface as candidates, no matter how old they grow.
        expect(A.some(report.candidates, (candidate) => Str.Equivalence(candidate.path, fixture.worktreeResidue))).toBe(
          false
        );
        expect(candidateByPath(report, fixture.turboEntry).action).toBe("remove-file");
        expect(report.classes).toEqual(["codex-sessions", "codex-worktrees", "turbo-cache", "beep-cache-disposable"]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("is dry-run by default and apply removes entries without removing their owned roots", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const fixture = yield* makeFixture(root);
        const options = {
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        };
        const dryRun = yield* runResidueReap(options);
        expect(dryRun.applied).toBe(false);
        expect(yield* fs.exists(fixture.oldSession)).toBe(true);
        expect(yield* fs.exists(fixture.oldWorktree)).toBe(true);

        const applied = yield* runResidueReap({ ...options, apply: true });
        expect(applied.reapedCount).toBe(5);
        expect(yield* fs.exists(fixture.oldSession)).toBe(false);
        expect(yield* fs.exists(fixture.archivedSession)).toBe(false);
        expect(yield* fs.exists(fixture.oldWorktree)).toBe(false);
        expect(yield* fs.exists(fixture.disposable)).toBe(false);
        expect(yield* fs.exists(fixture.turboEntry)).toBe(false);
        expect(yield* fs.exists(fixture.sessionsRoot)).toBe(true);
        expect(yield* fs.exists(fixture.turboCacheRoot)).toBe(true);
        expect(yield* fs.exists(fixture.durable)).toBe(true);
        expect(yield* fs.exists(fixture.youngSession)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("fails closed when the worktree cwd probe is live or unavailable", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture(root);
        const live = yield* runResidueReap({
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: () => Effect.succeedSome(true),
          repoRoot: fixture.repoRoot,
        });
        expect(candidateByPath(live, fixture.oldWorktree).skipReason).toBe("live-cwd-ref");

        const failed = yield* runResidueReap({
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: () => Effect.succeedNone,
          repoRoot: fixture.repoRoot,
        });
        expect(candidateByPath(failed, fixture.oldWorktree).skipReason).toBe("process-probe-failed");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("fails closed on stat, census, and entry-cap failures", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const fixture = yield* makeFixture(root);
        const failingFileSystem = FileSystem.makeNoop({
          ...fs,
          stat: (target) =>
            Str.Equivalence(target, fixture.oldSession) || Str.Equivalence(target, fixture.worktreePayload)
              ? Effect.fail(
                  PlatformError.badArgument({
                    description: "simulated residue stat failure",
                    method: "stat",
                    module: "FileSystem",
                  })
                )
              : fs.stat(target),
        });
        const failed = yield* runResidueReap({
          classes: ["codex-sessions", "codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        }).pipe(Effect.provideService(FileSystem.FileSystem, failingFileSystem));
        expect(candidateByPath(failed, fixture.oldSession).skipReason).toBe("stat-failed");
        expect(candidateByPath(failed, fixture.oldWorktree).skipReason).toBe("census-failed");

        const overflow = yield* runResidueReap({
          censusEntryCap: 0,
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });
        expect(candidateByPath(overflow, fixture.oldWorktree).skipReason).toBe("census-overflow");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves dirty embedded git checkouts and reaps clean ones", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        const worktreesRoot = path.join(fixture.homeRoot, ".codex", "worktrees");
        const dirtyWorktree = path.join(worktreesRoot, "dirty-worktree");
        const cleanWorktree = path.join(worktreesRoot, "clean-worktree");
        const dirtyRepo = yield* makeEmbeddedRepo(dirtyWorktree);
        const cleanRepo = yield* makeEmbeddedRepo(cleanWorktree);
        yield* fs.writeFileString(path.join(dirtyRepo, "uncommitted.txt"), "unpreserved work\n");
        yield* fs.writeFileString(path.join(cleanRepo, "committed.txt"), "landed work\n");
        yield* runFixtureCommand(cleanRepo, "git", ["add", "committed.txt"]);
        yield* runFixtureCommand(cleanRepo, "git", ["commit", "--quiet", "-m", "fixture"]);
        yield* touchTreeDaysAgo(root, dirtyWorktree, 45);
        yield* touchTreeDaysAgo(root, cleanWorktree, 45);

        const report = yield* runResidueReap({
          apply: true,
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });

        const dirty = candidateByPath(report, dirtyWorktree);
        expect(dirty.action).toBe("skip");
        expect(dirty.skipReason).toBe("dirty-tree");
        expect(yield* fs.exists(path.join(dirtyRepo, "uncommitted.txt"))).toBe(true);
        const clean = candidateByPath(report, cleanWorktree);
        expect(clean.action).toBe("remove-dir");
        expect(clean.skipReason).toBeUndefined();
        expect(yield* fs.exists(cleanWorktree)).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("classifies a turbo cache directory by its newest descendant, not its own mtime", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        const staleDir = path.join(fixture.turboCacheRoot, "stale-dir");
        const freshInside = path.join(staleDir, "fresh.bin");
        yield* fs.makeDirectory(staleDir, { recursive: true });
        yield* fs.writeFileString(freshInside, "recent cache write\n");
        yield* touchDaysAgo(root, freshInside, 2);
        yield* touchDaysAgo(root, staleDir, 45);

        const report = yield* runResidueReap({
          classes: ["turbo-cache"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });

        const stale = candidateByPath(report, staleDir);
        expect(stale.action).toBe("skip");
        expect(stale.skipReason).toBe("too-young");
        expect(candidateByPath(report, fixture.turboEntry).action).toBe("remove-file");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("fails closed when the configured home root is empty or relative", () =>
    Effect.gen(function* () {
      const empty = yield* Effect.result(runResidueReap({ homeRoot: "" }));
      expect(Result.isFailure(empty)).toBe(true);
      const relative = yield* Effect.result(runResidueReap({ homeRoot: "relative/home" }));
      expect(Result.isFailure(relative)).toBe(true);
    }).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("round-trips the residue-reap/v1 report schema and honors class filtering", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture(root);
        const report = yield* runResidueReap({
          classes: ["turbo-cache"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          repoRoot: fixture.repoRoot,
        });
        const encoded = yield* S.encodeEffect(S.fromJsonString(ResidueReapReport))(report);
        const decoded = yield* S.decodeEffect(S.fromJsonString(ResidueReapReport))(encoded);
        expect(decoded).toEqual(report);
        expect(decoded.schemaVersion).toBe("residue-reap/v1");
        expect(decoded.classes).toEqual(["turbo-cache"]);
        expect(decoded.candidates).toHaveLength(1);
        expect(decoded.candidates[0]).toBeInstanceOf(ResidueReapCandidate);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
