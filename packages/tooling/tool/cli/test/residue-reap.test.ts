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
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
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
