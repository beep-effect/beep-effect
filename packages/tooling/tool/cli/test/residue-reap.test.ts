import { renderResidueReportLinesForTesting } from "@beep/repo-cli/test/Quality";
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
import * as F from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeResidueReapReportJson = S.decodeEffect(S.fromJsonString(ResidueReapReport));
const encodeResidueReapReportJson = S.encodeEffect(S.fromJsonString(ResidueReapReport));

const FIXTURE_NOW_MILLIS = 2_000_000_000_000;
const noLiveCwd = () => Effect.succeedSome(false);
const pidAlive = (alive: HashSet.HashSet<string>) => (pid: string) => Effect.succeedSome(HashSet.has(alive, pid));
const noLivePid = pidAlive(HashSet.empty());

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
        expect(report.classes).toEqual([
          "codex-sessions",
          "codex-worktrees",
          "turbo-cache",
          "beep-cache-disposable",
          "merged-preview",
          "turbo-runs",
          "shared-turbo-cache",
          "qualification-views",
        ]);
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

  it.effect("resolves a symlinked ancestor for removal while the report keeps the operator's path", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // The operator's HOME is a symlink to the real store. Every candidate is reached
        // lexically through the link, but the removal must run on the resolved directory
        // so a repointed ancestor cannot redirect the recursive delete elsewhere.
        const realHome = path.join(root, "real-home");
        const linkedHome = path.join(root, "linked-home");
        const fixture = yield* makeFixture(realHome);
        yield* fs.symlink(fixture.homeRoot, linkedHome);
        const lexicalWorktree = path.join(linkedHome, ".codex", "worktrees", "old-worktree");

        const report = yield* runResidueReap({
          apply: true,
          classes: ["codex-worktrees"],
          homeRoot: linkedHome,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });

        const reaped = candidateByPath(report, lexicalWorktree);
        expect(reaped.action).toBe("remove-dir");
        expect(reaped.path).toBe(lexicalWorktree);
        // The real directory behind the link is gone; the symlink itself is untouched.
        expect(yield* fs.exists(fixture.oldWorktree)).toBe(false);
        expect(O.isSome(yield* fs.readLink(linkedHome).pipe(Effect.option))).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves external data behind every symlinked home residue root", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const homeRoot = path.join(root, "home");
        const external = path.join(root, "external");
        const payload = path.join(external, "photo-face-old", "keep.txt");
        const session = path.join(external, "old.jsonl");
        yield* fs.makeDirectory(path.dirname(payload), { recursive: true });
        yield* fs.writeFileString(payload, "unrelated work\n");
        yield* fs.writeFileString(session, "unrelated session\n");
        yield* touchTreeDaysAgo(root, external, 60);
        for (const relative of [".codex/sessions", ".codex/archived_sessions", ".codex/worktrees", ".cache/beep"]) {
          const linked = path.join(homeRoot, relative);
          yield* fs.makeDirectory(path.dirname(linked), { recursive: true });
          yield* fs.symlink(external, linked);
        }
        const report = yield* runResidueReap({
          apply: true,
          homeRoot,
          repoRoot: root,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
        });
        expect(report.reapedCount).toBe(0);
        expect(yield* fs.readFileString(payload)).toBe("unrelated work\n");
        expect(yield* fs.readFileString(session)).toBe("unrelated session\n");
        expect(A.every(report.candidates, (entry) => entry.action === "skip")).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("rechecks the home boundary when a class root is repointed after discovery", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        const classRoot = path.dirname(fixture.oldWorktree);
        const moved = path.join(root, "moved-worktrees");
        const external = path.join(root, "external");
        const payload = path.join(external, "old-worktree", "keep.txt");
        yield* fs.makeDirectory(path.dirname(payload), { recursive: true });
        yield* fs.writeFileString(payload, "unrelated work\n");
        yield* touchTreeDaysAgo(root, external, 60);
        const swappingProbe = Effect.fn("rootSwappingProbe")(function* (target: string) {
          if (Str.Equivalence(target, fixture.oldWorktree) && !(yield* fs.exists(moved))) {
            yield* fs.rename(classRoot, moved);
            yield* fs.symlink(external, classRoot);
          }
          return O.some(false);
        }, Effect.orDie);
        const report = yield* runResidueReap({
          apply: true,
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          repoRoot: fixture.repoRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: swappingProbe,
        });
        expect(report.reapedCount).toBe(0);
        expect(candidateByPath(report, fixture.oldWorktree).skipReason).toBe("path-changed");
        expect(yield* fs.readFileString(payload)).toBe("unrelated work\n");
        expect(yield* fs.exists(path.join(moved, "old-worktree", "payload.txt"))).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("rechecks the repository boundary when the Turbo cache root is repointed after discovery", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        const entry = path.join(fixture.turboCacheRoot, "old-directory");
        const moved = path.join(root, "moved-cache");
        const external = path.join(root, "external-cache");
        const payload = path.join(external, "old-directory", "keep.txt");
        yield* fs.makeDirectory(entry);
        yield* fs.writeFileString(path.join(entry, "payload.txt"), "original cache\n");
        yield* fs.makeDirectory(path.dirname(payload), { recursive: true });
        yield* fs.writeFileString(payload, "unrelated work\n");
        yield* touchTreeDaysAgo(root, entry, 60);
        yield* touchTreeDaysAgo(root, external, 60);
        const swappingProbe = Effect.fn("turboRootSwappingProbe")(function* (target: string) {
          if (Str.Equivalence(target, entry) && !(yield* fs.exists(moved))) {
            yield* fs.rename(fixture.turboCacheRoot, moved);
            yield* fs.symlink(external, fixture.turboCacheRoot);
          }
          return O.some(false);
        }, Effect.orDie);
        const report = yield* runResidueReap({
          apply: true,
          classes: ["turbo-cache"],
          homeRoot: fixture.homeRoot,
          repoRoot: fixture.repoRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: swappingProbe,
        });
        expect(report.reapedCount).toBe(0);
        expect(candidateByPath(report, entry).skipReason).toBe("path-changed");
        expect(yield* fs.readFileString(payload)).toBe("unrelated work\n");
        expect(yield* fs.readFileString(path.join(moved, "old-directory", "payload.txt"))).toBe("original cache\n");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("skips a candidate whose path became a symlink after classification", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        // Stand in for the apply-time race: classify the real worktree, then swap it for a
        // symlink pointing at a live directory outside the reap root before removal.
        const classified = yield* runResidueReap({
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });
        expect(candidateByPath(classified, fixture.oldWorktree).action).toBe("remove-dir");

        const bystander = path.join(root, "bystander");
        yield* fs.makeDirectory(bystander, { recursive: true });
        yield* fs.writeFileString(path.join(bystander, "keep.txt"), "live\n");
        yield* fs.remove(fixture.oldWorktree, { force: true, recursive: true });
        yield* fs.symlink(bystander, fixture.oldWorktree);

        const applied = yield* runResidueReap({
          apply: true,
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: noLiveCwd,
          repoRoot: fixture.repoRoot,
        });

        const skipped = candidateByPath(applied, fixture.oldWorktree);
        expect(skipped.action).toBe("skip");
        // The bystander the link pointed at is never followed for deletion.
        expect(yield* fs.exists(path.join(bystander, "keep.txt"))).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("leaves a directory renamed into the candidate's path after reassessment untouched", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        const moved = path.join(root, "moved");
        const probes = yield* Ref.make(0);
        // utimes takes Unix seconds: forty days before the fixture clock.
        const staleSeconds =
          (FIXTURE_NOW_MILLIS - Duration.toMillis(Duration.days(40))) / Duration.toMillis(Duration.seconds(1));
        // The liveness probe runs after the apply-time resolution and before the bound
        // removal. On its second visit to the candidate it moves the assessed directory
        // aside and puts an equally old-looking directory with another inode in its place.
        const swappingProbe = Effect.fn("swappingProbe")(function* (target: string) {
          if (!Str.Equivalence(target, fixture.oldWorktree)) {
            return O.some(false);
          }
          const visit = yield* Ref.updateAndGet(probes, (count) => count + 1);
          if (visit === 2) {
            yield* fs.rename(fixture.oldWorktree, moved);
            yield* fs.makeDirectory(fixture.oldWorktree);
            yield* fs.writeFileString(path.join(fixture.oldWorktree, "fresh.txt"), "live\n");
            yield* fs.utimes(path.join(fixture.oldWorktree, "fresh.txt"), staleSeconds, staleSeconds);
            yield* fs.utimes(fixture.oldWorktree, staleSeconds, staleSeconds);
          }
          return O.some(false);
        }, Effect.orDie);

        const applied = yield* runResidueReap({
          apply: true,
          classes: ["codex-worktrees"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveCwd: swappingProbe,
          repoRoot: fixture.repoRoot,
        });

        const skipped = candidateByPath(applied, fixture.oldWorktree);
        expect(skipped.action).toBe("skip");
        expect(skipped.skipReason).toBe("path-changed");
        // Neither the directory that was assessed nor the one that replaced it was deleted.
        expect(yield* fs.exists(path.join(fixture.oldWorktree, "fresh.txt"))).toBe(true);
        expect(A.isReadonlyArrayNonEmpty(yield* fs.readDirectory(moved))).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports a removal failure when the bound tree cannot be emptied", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture(root);
        const sealed = path.join(fixture.oldWorktree, "sealed");
        yield* fs.makeDirectory(sealed);
        yield* fs.writeFileString(path.join(sealed, "pinned.txt"), "stale\n");
        yield* touchTreeDaysAgo(root, fixture.oldWorktree, 40);

        // A directory without write permission cannot have its entries unlinked, so the
        // descriptor-bound removal fails part-way and says so instead of reporting a reap.
        const applied = yield* Effect.acquireUseRelease(
          fs.chmod(sealed, 0o500),
          () =>
            runResidueReap({
              apply: true,
              classes: ["codex-worktrees"],
              homeRoot: fixture.homeRoot,
              nowMillis: FIXTURE_NOW_MILLIS,
              probeLiveCwd: noLiveCwd,
              repoRoot: fixture.repoRoot,
            }),
          () => fs.chmod(sealed, 0o700).pipe(Effect.ignore)
        );

        const failed = candidateByPath(applied, fixture.oldWorktree);
        expect(failed.action).toBe("skip");
        expect(failed.skipReason).toBe("removal-failed");
        expect(yield* fs.exists(path.join(sealed, "pinned.txt"))).toBe(true);
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

  it("renders reaped, eligible, and skipped rows with totals and warnings", () => {
    const base = {
      scannedAt: "2026-09-03T12:00:00.000Z",
      homeRoot: "/home/me",
      repoRoot: "/repo",
      maxAgeDays: 30,
      turboMaxAgeDays: 14,
      turboRunsMaxAgeDays: 1,
      sharedTurboCacheRoot: "/home/me/.cache/beep/turbo",
      sharedTurboMaxAgeDays: 14,
      sharedTurboMaxBytes: 21474836480,
      qualificationViewsKeep: 2,
      fleet: false,
      checkoutRoots: ["/repo"],
      classes: ["codex-sessions", "codex-worktrees"],
      reapedCount: 1,
      reclaimedBytes: 4096,
      warnings: ["Failed to remove /home/me/.codex/worktrees/stuck."],
    } as const;
    const applied = ResidueReapReport.make({
      ...base,
      applied: true,
      candidates: [
        ResidueReapCandidate.make({
          root: "/home/me/.codex/sessions",
          path: "/home/me/.codex/sessions/old.jsonl",
          reapClass: "codex-sessions",
          ageDays: 45.25,
          action: "remove-file",
          bytes: 4096,
        }),
        ResidueReapCandidate.make({
          root: "/home/me/.codex/worktrees",
          path: "/home/me/.codex/worktrees/opaque",
          reapClass: "codex-worktrees",
          action: "skip",
          skipReason: "census-failed",
          entriesScanned: 7,
        }),
      ],
    });
    const rendered = renderResidueReportLinesForTesting(applied).join("\n");
    expect(rendered).toContain("RESIDUE REAP APPLY");
    expect(rendered).toContain("home root: /home/me");
    expect(rendered).toContain("thresholds: default=30d turbo=14d");
    expect(rendered).toContain("classes: codex-sessions, codex-worktrees");
    expect(rendered).toContain(
      "- remove-file class=codex-sessions age=45.3d bytes=4096 /home/me/.codex/sessions/old.jsonl"
    );
    expect(rendered).toContain(
      "- skip class=codex-worktrees age=unknown entries=7 reason=census-failed /home/me/.codex/worktrees/opaque"
    );
    expect(rendered).toContain("totals: candidates=2 reaped=1 reclaimed-bytes=4096");
    expect(rendered).toContain("warning: Failed to remove /home/me/.codex/worktrees/stuck.");

    const dryRun = renderResidueReportLinesForTesting(
      ResidueReapReport.make({ ...base, applied: false, candidates: [], reapedCount: 0, reclaimedBytes: 0 })
    ).join("\n");
    expect(dryRun).toContain("RESIDUE REAP DRY RUN");
  });

  it.effect("round-trips the residue-reap/v2 report schema and honors class filtering", () =>
    withTempDirectory((root) =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture(root);
        const report = yield* runResidueReap({
          classes: ["turbo-cache"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          repoRoot: fixture.repoRoot,
        });
        const encoded = yield* encodeResidueReapReportJson(report);
        const decoded = yield* decodeResidueReapReportJson(encoded);
        expect(decoded).toEqual(report);
        expect(decoded.schemaVersion).toBe("residue-reap/v2");
        expect(decoded.classes).toEqual(["turbo-cache"]);
        expect(decoded.candidates).toHaveLength(1);
        expect(decoded.candidates[0]).toBeInstanceOf(ResidueReapCandidate);
        // v2 widened every literal domain, so a v1-tagged payload must not decode as v2.
        const v1Payload = Str.replace("residue-reap/v2", "residue-reap/v1")(encoded);
        expect(S.isSchemaError(yield* Effect.flip(decodeResidueReapReportJson(v1Payload)))).toBe(true);

        const filtered = yield* runResidueReap({
          classes: ["turbo-runs", "qualification-views"],
          homeRoot: fixture.homeRoot,
          nowMillis: FIXTURE_NOW_MILLIS,
          repoRoot: fixture.repoRoot,
        });
        expect(filtered.classes).toEqual(["turbo-runs", "qualification-views"]);
        expect(A.some(filtered.candidates, (entry) => Str.Equivalence(entry.path, fixture.turboEntry))).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  describe("merged-preview", () => {
    const makePreviewRepo = Effect.fn("ResidueReapTest.makePreviewRepo")(function* (root: string, name: string) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeEmbeddedRepo(path.join(root, name));
      yield* fs.writeFileString(path.join(repoRoot, "README.md"), "fixture\n");
      yield* runFixtureCommand(repoRoot, "git", ["add", "README.md"]);
      yield* runFixtureCommand(repoRoot, "git", ["commit", "--quiet", "-m", "fixture"]);
      const yeetRoot = path.join(repoRoot, ".beep", "yeet");
      yield* fs.makeDirectory(yeetRoot, { recursive: true });
      return { repoRoot, yeetRoot };
    });

    const addPreviewWorktree = Effect.fn("ResidueReapTest.addPreviewWorktree")(function* (
      root: string,
      repoRoot: string,
      previewPath: string,
      daysAgo: number
    ) {
      const path = yield* Path.Path;
      yield* runFixtureCommand(repoRoot, "git", ["worktree", "add", "--quiet", "--detach", previewPath]);
      yield* touchDaysAgo(root, path.join(previewPath, ".git"), daysAgo);
      yield* touchDaysAgo(root, previewPath, daysAgo);
    });

    const listedWorktrees = Effect.fn("ResidueReapTest.listedWorktrees")(function* (repoRoot: string) {
      return yield* runFixtureCommand(repoRoot, "git", ["worktree", "list", "--porcelain"]);
    });

    it.effect("tears down a dead registered preview with git and removes an unregistered one", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const homeRoot = path.join(root, "home");
          yield* fs.makeDirectory(homeRoot, { recursive: true });
          const { repoRoot, yeetRoot } = yield* makePreviewRepo(root, "one");
          const registered = path.join(yeetRoot, "merged-preview-99999");
          const unregistered = path.join(yeetRoot, "merged-preview-88888");
          const ignored = path.join(yeetRoot, "merged-preview-x");
          const linked = path.join(yeetRoot, "merged-preview-1");
          const external = path.join(root, "external-preview");
          yield* addPreviewWorktree(root, repoRoot, registered, 3);
          yield* fs.makeDirectory(path.join(unregistered, "node_modules"), { recursive: true });
          yield* fs.writeFileString(path.join(unregistered, "node_modules", "dep.js"), "stale\n");
          yield* touchTreeDaysAgo(root, unregistered, 3);
          yield* fs.makeDirectory(ignored);
          yield* touchDaysAgo(root, ignored, 3);
          yield* fs.makeDirectory(external);
          yield* fs.writeFileString(path.join(external, "keep.txt"), "unrelated work\n");
          yield* touchTreeDaysAgo(root, external, 3);
          yield* fs.symlink(external, linked);
          const options = {
            classes: ["merged-preview"] as const,
            homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: noLiveCwd,
            probePidAlive: noLivePid,
            repoRoot,
          };

          const dryRun = yield* runResidueReap(options);
          expect(candidateByPath(dryRun, registered).action).toBe("worktree-remove");
          expect(candidateByPath(dryRun, registered).checkoutRoot).toBe(repoRoot);
          expect(candidateByPath(dryRun, unregistered).action).toBe("remove-dir");
          expect(candidateByPath(dryRun, linked).skipReason).toBe("wrong-shape");
          expect(A.some(dryRun.candidates, (entry) => Str.Equivalence(entry.path, ignored))).toBe(false);

          const applied = yield* runResidueReap({ ...options, apply: true });
          expect(applied.reapedCount).toBe(2);
          expect(yield* fs.exists(registered)).toBe(false);
          expect(yield* fs.exists(unregistered)).toBe(false);
          expect(F.pipe(yield* listedWorktrees(repoRoot), Str.includes("merged-preview-99999"))).toBe(false);
          expect(yield* fs.readFileString(path.join(external, "keep.txt"))).toBe("unrelated work\n");
          expect(yield* fs.exists(ignored)).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );

    it.effect("keeps previews whose owner is alive, whose directory is a live cwd, or that are too young", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const homeRoot = path.join(root, "home");
          yield* fs.makeDirectory(homeRoot, { recursive: true });
          const { repoRoot, yeetRoot } = yield* makePreviewRepo(root, "one");
          const owned = path.join(yeetRoot, "merged-preview-4242");
          const occupied = path.join(yeetRoot, "merged-preview-4343");
          const fresh = path.join(yeetRoot, "merged-preview-4444");
          yield* addPreviewWorktree(root, repoRoot, owned, 3);
          yield* addPreviewWorktree(root, repoRoot, occupied, 3);
          yield* addPreviewWorktree(root, repoRoot, fresh, 0);

          const report = yield* runResidueReap({
            apply: true,
            classes: ["merged-preview"],
            homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: (candidatePath) => Effect.succeedSome(Str.Equivalence(candidatePath, occupied)),
            probePidAlive: pidAlive(HashSet.make("4242")),
            repoRoot,
          });

          expect(candidateByPath(report, owned).skipReason).toBe("pid-alive");
          expect(candidateByPath(report, occupied).skipReason).toBe("live-cwd-ref");
          expect(candidateByPath(report, fresh).skipReason).toBe("too-young");
          expect(report.reapedCount).toBe(0);
          expect(yield* fs.exists(owned)).toBe(true);
          expect(yield* fs.exists(occupied)).toBe(true);
          expect(yield* fs.exists(fresh)).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );
  });

  describe("turbo-runs", () => {
    it.effect("reaps old run summaries only and never follows a linked runs root", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const homeRoot = path.join(root, "home");
          const repoRoot = path.join(root, "repo");
          const runsRoot = path.join(repoRoot, ".turbo", "runs");
          const oldRun = path.join(runsRoot, "old.json");
          const newRun = path.join(runsRoot, "new.json");
          const notes = path.join(runsRoot, "notes.txt");
          yield* fs.makeDirectory(homeRoot, { recursive: true });
          yield* fs.makeDirectory(runsRoot, { recursive: true });
          yield* Effect.forEach([oldRun, newRun, notes], (file) => fs.writeFileString(file, "{}\n"), { discard: true });
          yield* touchDaysAgo(root, oldRun, 2);
          yield* touchDaysAgo(root, newRun, 0);
          yield* touchDaysAgo(root, notes, 5);

          const report = yield* runResidueReap({
            apply: true,
            classes: ["turbo-runs"],
            homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            repoRoot,
          });
          expect(candidateByPath(report, oldRun).action).toBe("remove-file");
          expect(candidateByPath(report, newRun).skipReason).toBe("too-young");
          expect(candidateByPath(report, notes).skipReason).toBe("wrong-shape");
          expect(yield* fs.exists(oldRun)).toBe(false);
          expect(yield* fs.exists(newRun)).toBe(true);
          expect(yield* fs.exists(notes)).toBe(true);

          const linkedRepo = path.join(root, "linked-repo");
          const external = path.join(root, "external-runs");
          const externalRun = path.join(external, "old.json");
          yield* fs.makeDirectory(path.join(linkedRepo, ".turbo"), { recursive: true });
          yield* fs.makeDirectory(external);
          yield* fs.writeFileString(externalRun, "{}\n");
          yield* touchDaysAgo(root, externalRun, 5);
          yield* fs.symlink(external, path.join(linkedRepo, ".turbo", "runs"));
          const linkedOptions = {
            classes: ["turbo-runs"] as const,
            homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            repoRoot: linkedRepo,
          };
          const linkedRuns = path.join(linkedRepo, ".turbo", "runs");
          const assessed = yield* runResidueReap(linkedOptions);
          expect(candidateByPath(assessed, linkedRuns).skipReason).toBe("wrong-shape");
          const linked = yield* runResidueReap({ ...linkedOptions, apply: true });
          expect(linked.reapedCount).toBe(0);
          expect(candidateByPath(linked, linkedRuns).action).toBe("skip");
          expect(yield* fs.exists(externalRun)).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );
  });

  describe("shared-turbo-cache", () => {
    // Groups A (20d), B (5d), C (3d), and D (0.1d); every member of a group has the same size.
    const makeSharedCache = Effect.fn("ResidueReapTest.makeSharedCache")(function* (root: string) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const homeRoot = path.join(root, "home");
      const cacheRoot = path.join(homeRoot, ".cache", "beep", "turbo");
      yield* fs.makeDirectory(cacheRoot, { recursive: true });
      const groups = [
        { key: "A", daysAgo: 20, size: 10 },
        { key: "B", daysAgo: 5, size: 20 },
        { key: "C", daysAgo: 3, size: 30 },
        { key: "D", daysAgo: 0.1, size: 40 },
      ] as const;
      yield* Effect.forEach(
        groups,
        Effect.fnUntraced(function* (group) {
          for (const suffix of [".tar.zst", "-meta.json", "-manifest.json"]) {
            const member = path.join(cacheRoot, `${group.key}${suffix}`);
            yield* fs.writeFileString(member, Str.repeat(group.size)("x"));
            yield* touchDaysAgo(root, member, group.daysAgo);
          }
        }),
        { discard: true }
      );
      const orphan = path.join(cacheRoot, "X-meta.json");
      yield* fs.writeFileString(orphan, "{}");
      yield* touchDaysAgo(root, orphan, 20);
      const member = (key: string, suffix: string) => path.join(cacheRoot, `${key}${suffix}`);
      return { cacheRoot, homeRoot, member, orphan };
    });

    it.effect("ages out old groups, then evicts oldest-written groups down to the byte budget", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fixture = yield* makeSharedCache(root);
          const options = {
            classes: ["shared-turbo-cache"] as const,
            homeRoot: fixture.homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            repoRoot: root,
            sharedTurboCacheRoot: fixture.cacheRoot,
          };
          // Budget = C + D: evicting B alone brings the survivors under the cap.
          const budgeted = yield* runResidueReap({ ...options, sharedTurboMaxBytes: 3 * 30 + 3 * 40 });
          for (const suffix of [".tar.zst", "-meta.json", "-manifest.json"]) {
            expect(candidateByPath(budgeted, fixture.member("A", suffix)).action).toBe("remove-file");
            expect(candidateByPath(budgeted, fixture.member("A", suffix)).groupKey).toBe("A");
            expect(candidateByPath(budgeted, fixture.member("B", suffix)).action).toBe("remove-file");
            expect(candidateByPath(budgeted, fixture.member("B", suffix)).groupKey).toBe("B");
            expect(candidateByPath(budgeted, fixture.member("C", suffix)).skipReason).toBe("within-size-budget");
            expect(candidateByPath(budgeted, fixture.member("D", suffix)).skipReason).toBe("too-young");
          }
          const orphan = candidateByPath(budgeted, fixture.orphan);
          expect(orphan.action).toBe("remove-file");
          expect(orphan.groupKey).toBe("X");
          // Within a group the archive leads, so an interrupted eviction is a clean cache miss.
          const groupA = A.filter(budgeted.candidates, (entry) => entry.groupKey === "A");
          expect(Str.endsWith(".tar.zst")(O.getOrThrow(A.head(groupA)).path)).toBe(true);

          // A zero budget still never touches the group written within the floor.
          const zero = yield* runResidueReap({ ...options, sharedTurboMaxBytes: 0 });
          expect(candidateByPath(zero, fixture.member("C", ".tar.zst")).action).toBe("remove-file");
          expect(candidateByPath(zero, fixture.member("D", ".tar.zst")).skipReason).toBe("too-young");
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );

    it.effect("keeps a member turbo rewrote between assessment and removal", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const fixture = yield* makeSharedCache(root);
          const rewritten = fixture.member("B", "-meta.json");
          const nowSeconds = FIXTURE_NOW_MILLIS / Duration.toMillis(Duration.seconds(1));
          // realPath on a member first runs at apply time: rewrite the file right there.
          const rewritingFileSystem = FileSystem.makeNoop({
            ...fs,
            realPath: (target) =>
              Str.Equivalence(target, rewritten)
                ? fs.utimes(target, nowSeconds, nowSeconds).pipe(Effect.andThen(fs.realPath(target)))
                : fs.realPath(target),
          });
          const applied = yield* runResidueReap({
            apply: true,
            classes: ["shared-turbo-cache"],
            homeRoot: fixture.homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            repoRoot: root,
            sharedTurboCacheRoot: fixture.cacheRoot,
            sharedTurboMaxBytes: 3 * 30 + 3 * 40,
          }).pipe(Effect.provideService(FileSystem.FileSystem, rewritingFileSystem));
          expect(candidateByPath(applied, rewritten).skipReason).toBe("path-changed");
          expect(yield* fs.exists(rewritten)).toBe(true);
          expect(yield* fs.exists(fixture.member("B", ".tar.zst"))).toBe(false);
          expect(yield* fs.exists(fixture.member("A", ".tar.zst"))).toBe(false);
          expect(yield* fs.exists(fixture.member("C", ".tar.zst"))).toBe(true);
          expect(yield* fs.exists(fixture.member("D", ".tar.zst"))).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );

    it.effect("refuses a shared cache root outside home and never reaps durable beep cache names whole", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fixture = yield* makeSharedCache(root);
          const outside = path.join(root, "outside-turbo");
          yield* fs.makeDirectory(outside);
          const escaped = yield* runResidueReap({
            classes: ["shared-turbo-cache"],
            homeRoot: fixture.homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            repoRoot: root,
            sharedTurboCacheRoot: outside,
          });
          expect(candidateByPath(escaped, outside).skipReason).toBe("path-changed");
          expect(A.some(escaped.warnings, Str.includes(outside))).toBe(true);

          const beepCacheRoot = path.dirname(fixture.cacheRoot);
          const durable = ["turbo", "turbo-qualification", "codex-security", "effect-vitest-canon", "boolean-creep"];
          yield* Effect.forEach(
            durable,
            (name) => fs.makeDirectory(path.join(beepCacheRoot, name), { recursive: true }),
            { discard: true }
          );
          yield* touchTreeDaysAgo(root, beepCacheRoot, 90);
          const disposable = yield* runResidueReap({
            classes: ["beep-cache-disposable"],
            homeRoot: fixture.homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: noLiveCwd,
            repoRoot: root,
          });
          expect(disposable.candidates).toHaveLength(0);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );
  });

  describe("qualification-views", () => {
    const makeViews = Effect.fn("ResidueReapTest.makeViews")(function* (root: string) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const homeRoot = path.join(root, "home");
      const qualificationRoot = path.join(homeRoot, ".cache", "beep", "turbo-qualification");
      const viewsRoot = path.join(qualificationRoot, "dependencies");
      const evidenceRoot = path.join(qualificationRoot, "evidence");
      const view = (name: string) => path.join(viewsRoot, `view-${name}`);
      yield* Effect.forEach(
        [
          ["a", 1],
          ["b", 2],
          ["c", 3],
          ["d", 4],
          ["e", 5],
        ] as const,
        Effect.fnUntraced(function* ([name, daysAgo]) {
          const directory = view(name);
          yield* fs.makeDirectory(path.join(directory, "node_modules"), { recursive: true });
          for (const file of ["one.js", "two.js", "three.js"]) {
            yield* fs.writeFileString(path.join(directory, "node_modules", file), "dep\n");
          }
          yield* touchDaysAgo(root, directory, daysAgo);
        }),
        { discard: true }
      );
      yield* fs.makeDirectory(path.join(evidenceRoot, "e1"), { recursive: true });
      yield* fs.writeFileString(
        path.join(evidenceRoot, "e1", "dependencies.json"),
        `{"schemaVersion":"cache-dependency-materialization/v1","authority":"local-installed-tree-snapshot","directory":"${view("d")}","tree":{"entries":3}}`
      );
      return { evidenceRoot, homeRoot, view };
    });

    it.effect("keeps the newest views, cited views, and live views, and reaps the rest without a census", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const fixture = yield* makeViews(root);
          const report = yield* runResidueReap({
            apply: true,
            // A census would overflow on every view; the class must not need one.
            censusEntryCap: 1,
            classes: ["qualification-views"],
            homeRoot: fixture.homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: (candidatePath) => Effect.succeedSome(Str.Equivalence(candidatePath, fixture.view("c"))),
            repoRoot: root,
          });
          expect(candidateByPath(report, fixture.view("a")).skipReason).toBe("kept-newest");
          expect(candidateByPath(report, fixture.view("b")).skipReason).toBe("kept-newest");
          expect(candidateByPath(report, fixture.view("c")).skipReason).toBe("live-cwd-ref");
          expect(candidateByPath(report, fixture.view("d")).skipReason).toBe("evidence-referenced");
          expect(candidateByPath(report, fixture.view("e")).action).toBe("remove-dir");
          expect(report.reapedCount).toBe(1);
          expect(yield* fs.exists(fixture.view("e"))).toBe(false);
          expect(yield* fs.exists(fixture.view("d"))).toBe(true);
          expect(yield* fs.exists(fixture.view("a"))).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );

    it.effect("fails closed on a malformed evidence receipt", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fixture = yield* makeViews(root);
          yield* fs.makeDirectory(path.join(fixture.evidenceRoot, "e2"));
          yield* fs.writeFileString(path.join(fixture.evidenceRoot, "e2", "dependencies.json"), "{not json");
          const report = yield* runResidueReap({
            apply: true,
            classes: ["qualification-views"],
            homeRoot: fixture.homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: noLiveCwd,
            repoRoot: root,
          });
          expect(A.every(report.candidates, (entry) => entry.skipReason === "census-failed")).toBe(true);
          expect(report.candidates).toHaveLength(5);
          expect(yield* fs.exists(fixture.view("e"))).toBe(true);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );
  });

  describe("fleet", () => {
    const seedCheckout = Effect.fn("ResidueReapTest.seedCheckout")(function* (root: string, name: string) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeEmbeddedRepo(path.join(root, name));
      yield* fs.writeFileString(path.join(repoRoot, "README.md"), "fixture\n");
      yield* runFixtureCommand(repoRoot, "git", ["add", "README.md"]);
      yield* runFixtureCommand(repoRoot, "git", ["commit", "--quiet", "-m", "fixture"]);
      const cacheEntry = path.join(repoRoot, ".turbo", "cache", "old.tar.zst");
      const run = path.join(repoRoot, ".turbo", "runs", "old.json");
      const preview = path.join(repoRoot, ".beep", "yeet", "merged-preview-77777");
      yield* fs.makeDirectory(path.dirname(cacheEntry), { recursive: true });
      yield* fs.makeDirectory(path.dirname(run), { recursive: true });
      yield* fs.makeDirectory(path.dirname(preview), { recursive: true });
      yield* fs.writeFileString(cacheEntry, "cache\n");
      yield* fs.writeFileString(run, "{}\n");
      yield* touchDaysAgo(root, cacheEntry, 20);
      yield* touchDaysAgo(root, run, 2);
      yield* runFixtureCommand(repoRoot, "git", ["worktree", "add", "--quiet", "--detach", preview]);
      yield* touchDaysAgo(root, path.join(preview, ".git"), 3);
      yield* touchDaysAgo(root, preview, 3);
      return { cacheEntry, preview, repoRoot, run };
    });

    it.effect("sweeps repository-scoped classes in every distinct checkout root", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const homeRoot = path.join(root, "home");
          yield* fs.makeDirectory(homeRoot, { recursive: true });
          const first = yield* seedCheckout(root, "first");
          const second = yield* seedCheckout(root, "second");
          const alias = path.join(root, "alias-of-first");
          yield* fs.symlink(first.repoRoot, alias);

          const report = yield* runResidueReap({
            apply: true,
            checkoutRoots: [first.repoRoot, second.repoRoot, alias],
            classes: ["turbo-cache", "turbo-runs", "merged-preview"],
            fleet: true,
            homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: noLiveCwd,
            probePidAlive: noLivePid,
            repoRoot: first.repoRoot,
          });
          expect(report.fleet).toBe(true);
          expect(report.checkoutRoots).toHaveLength(2);
          for (const checkout of [first, second]) {
            for (const target of [checkout.cacheEntry, checkout.run, checkout.preview]) {
              expect(candidateByPath(report, target).checkoutRoot).toBe(checkout.repoRoot);
              expect(yield* fs.exists(target)).toBe(false);
            }
          }
          expect(report.reapedCount).toBe(6);
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );

    it.effect("rechecks each checkout's boundary when its Turbo cache root is repointed after discovery", () =>
      withTempDirectory((root) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const homeRoot = path.join(root, "home");
          yield* fs.makeDirectory(homeRoot, { recursive: true });
          const first = path.join(root, "first");
          const second = path.join(root, "second");
          const secondCache = path.join(second, ".turbo", "cache");
          const entry = path.join(secondCache, "old-directory");
          const moved = path.join(root, "moved-cache");
          const external = path.join(root, "external-cache");
          const payload = path.join(external, "old-directory", "keep.txt");
          yield* fs.makeDirectory(path.join(first, ".turbo", "cache"), { recursive: true });
          yield* fs.makeDirectory(entry, { recursive: true });
          yield* fs.writeFileString(path.join(entry, "payload.txt"), "original cache\n");
          yield* fs.makeDirectory(path.dirname(payload), { recursive: true });
          yield* fs.writeFileString(payload, "unrelated work\n");
          yield* touchTreeDaysAgo(root, entry, 60);
          yield* touchTreeDaysAgo(root, external, 60);
          const swappingProbe = Effect.fn("fleetTurboRootSwappingProbe")(function* (target: string) {
            if (Str.Equivalence(target, entry) && !(yield* fs.exists(moved))) {
              yield* fs.rename(secondCache, moved);
              yield* fs.symlink(external, secondCache);
            }
            return O.some(false);
          }, Effect.orDie);
          const report = yield* runResidueReap({
            apply: true,
            checkoutRoots: [first, second],
            classes: ["turbo-cache"],
            fleet: true,
            homeRoot,
            nowMillis: FIXTURE_NOW_MILLIS,
            probeLiveCwd: swappingProbe,
            repoRoot: first,
          });
          expect(report.reapedCount).toBe(0);
          expect(candidateByPath(report, entry).skipReason).toBe("path-changed");
          expect(candidateByPath(report, entry).checkoutRoot).toBe(second);
          expect(yield* fs.readFileString(payload)).toBe("unrelated work\n");
          expect(yield* fs.readFileString(path.join(moved, "old-directory", "payload.txt"))).toBe("original cache\n");
        })
      ).pipe(provideScopedLayer(NodeServices.layer))
    );
  });

  it("groups fleet rows by checkout with per-class subtotals and caps human rows", () => {
    const rows = A.makeBy(30, (index) =>
      ResidueReapCandidate.make({
        root: "/repo-a/.turbo/cache",
        path: `/repo-a/.turbo/cache/entry-${index}`,
        reapClass: "turbo-cache",
        checkoutRoot: "/repo-a",
        ageDays: 20,
        action: "remove-file",
        bytes: 10,
      })
    );
    const report = ResidueReapReport.make({
      scannedAt: "2026-09-03T12:00:00.000Z",
      homeRoot: "/home/me",
      repoRoot: "/repo-a",
      maxAgeDays: 30,
      turboMaxAgeDays: 14,
      turboRunsMaxAgeDays: 1,
      sharedTurboCacheRoot: "/home/me/.cache/beep/turbo",
      sharedTurboMaxAgeDays: 14,
      sharedTurboMaxBytes: 21474836480,
      qualificationViewsKeep: 2,
      fleet: true,
      checkoutRoots: ["/repo-a", "/repo-b"],
      applied: false,
      classes: ["turbo-cache", "qualification-views"],
      candidates: A.append(
        rows,
        ResidueReapCandidate.make({
          root: "/home/me/.cache/beep/turbo-qualification/dependencies",
          path: "/home/me/.cache/beep/turbo-qualification/dependencies/view-a",
          reapClass: "qualification-views",
          action: "skip",
          skipReason: "kept-newest",
        })
      ),
      reapedCount: 0,
      reclaimedBytes: 0,
      warnings: [],
    });
    const rendered = renderResidueReportLinesForTesting(report).join("\n");
    expect(rendered).toContain("checkouts: 2 (fleet)");
    expect(rendered).toContain("== checkout: /repo-a ==");
    expect(rendered).toContain("turbo-cache: candidates=30 eligible=30 skipped=0 eligible-bytes=300");
    expect(rendered).toContain("... 5 more turbo-cache rows omitted; --json lists every candidate");
    expect(rendered).toContain("== home ==");
    expect(rendered).toContain(
      "qualification-views: candidates=1 eligible=0 skipped=1 eligible-bytes=apparent-only skip-reasons: kept-newest=1"
    );
  });
});
