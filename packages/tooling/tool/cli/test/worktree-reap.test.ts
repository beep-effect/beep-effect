import {
  FleetLivenessVerdict,
  probeWorktreeLiveness,
  renderWorktreeReapReportLines,
  runWorktreeReap,
  WorktreeCommandError,
  WorktreeReapCandidate,
  WorktreeReapReport,
  WorktreeRemovalService,
  WorktreeRemovalServiceLive,
} from "@beep/repo-cli/commands/Worktree";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const removalLayer = WorktreeRemovalServiceLive.pipe(Layer.provide(NodeServices.layer));
const testLayer = Layer.merge(NodeServices.layer, removalLayer);
const FIXTURE_NOW_MILLIS = 2_000_000_000_000;

const verdictProber =
  (status: "dormant" | "live" | "unknown") => (): Effect.Effect<FleetLivenessVerdict, never, FileSystem.FileSystem> =>
    Effect.succeed(FleetLivenessVerdict.make({ status, evidence: [] }));

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
  ).pipe(provideScopedLayer(testLayer));

const candidateAt = (report: WorktreeReapReport, candidatePath: string) =>
  O.getOrThrow(A.findFirst(report.candidates, (candidate) => Str.Equivalence(candidate.path, candidatePath)));

const ghResult = (number: number | undefined) => ({
  exitCode: 0,
  output: number === undefined ? "[]" : `[{"number":${number}}]`,
  truncated: false,
});

type GhAnswers = Readonly<Record<string, { readonly open: number | undefined; readonly merged: number | undefined }>>;

const ghStubRunner = (answers: GhAnswers, onDu?: () => ProbeStub | undefined) =>
  Effect.fn("WorktreeReapTest.ghStubRunner")(function* (command: string, args: ReadonlyArray<string>, cwd: string) {
    if (Str.Equivalence(command, "du")) {
      const stubbed = onDu?.();
      if (stubbed !== undefined) {
        return stubbed;
      }
    }
    if (!Str.Equivalence(command, "gh")) {
      return yield* runRepoCommandCapture(command, args, cwd);
    }
    const answer = answers[cwd] ?? { open: undefined, merged: undefined };
    return ghResult(A.contains(args, "merged") ? answer.merged : answer.open);
  });

type ProbeStub = { readonly exitCode: number; readonly output: string; readonly truncated: boolean };

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
        const locked = yield* addWorktree(repoRoot, worktreesRoot, "locked");
        yield* runCommand("git", ["worktree", "lock", locked], repoRoot);
        yield* fs.writeFileString(path.join(dirty, "dirty.txt"), "unsaved\n");

        const nowMillis = FIXTURE_NOW_MILLIS;
        const youngHead = Str.trim(
          yield* runCommand("git", ["rev-parse", "--path-format=absolute", "--git-path", "HEAD"], young)
        );
        yield* runCommand("touch", ["-d", `@${nowMillis / 1_000}`, youngHead], repoRoot);

        let duCalls = 0;
        const runner = ghStubRunner(
          {
            [merged]: { open: undefined, merged: 101 },
            [dirty]: { open: undefined, merged: 102 },
            [young]: { open: undefined, merged: 103 },
            [open]: { open: 104, merged: undefined },
            [revival]: { open: 105, merged: 106 },
          },
          () => {
            duCalls += 1;
            return undefined;
          }
        );

        // No injected liveness prober: the eligible candidate exercises the real
        // same-uid /proc scan, which must classify a quiet fixture dir as dormant.
        const report = yield* runWorktreeReap({ nowMillis, runCommand: runner, startFrom: repoRoot });

        expect(report.applied).toBe(false);
        expect(report.schemaVersion).toBe("worktree-reap/v1");
        expect(report.candidates).toHaveLength(7);
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
        expect(O.getOrThrow(candidateAt(report, locked).skipReason)).toBe("locked");
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
        const runner = ghStubRunner({ [peer]: { open: undefined, merged: undefined } });
        const report = yield* runWorktreeReap({ runCommand: runner, startFrom: invoking });

        expect(report.mainCheckout).toBe(repoRoot);
        expect(report.invokingWorktree).toBe(invoking);
        expect(report.candidates).toHaveLength(1);
        expect(report.candidates[0]?.path).toBe(peer);
      })
    )
  );

  it.effect("skips a live worktree without measuring its size", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const occupied = yield* addWorktree(repoRoot, worktreesRoot, "occupied");
        const runner = ghStubRunner({ [occupied]: { open: undefined, merged: 401 } });
        const report = yield* runWorktreeReap({
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("live"),
          runCommand: runner,
          startFrom: repoRoot,
        });

        expect(candidateAt(report, occupied).reapClass).toBe("merged-pr");
        expect(O.getOrThrow(candidateAt(report, occupied).skipReason)).toBe("live-session");
        expect(O.isNone(candidateAt(report, occupied).bytes)).toBe(true);
      })
    )
  );

  it.effect("probes real same-uid liveness: the invoking cwd is live, a fresh temp dir is dormant", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const live = yield* probeWorktreeLiveness({ targetPath: process.cwd(), idleHours: O.some(400) });
      expect(live.status).toBe("live");
      const temp = yield* fs.makeTempDirectory({ prefix: "worktree-reap-liveness-" });
      const dormant = yield* probeWorktreeLiveness({ targetPath: temp, idleHours: O.some(400) });
      expect(dormant.status).toBe("dormant");
      yield* fs.remove(temp, { force: true, recursive: true });
    }).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("skips a candidate whose liveness verdict is unknown", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "unknown-liveness");
        const runner = ghStubRunner({ [merged]: { open: undefined, merged: 402 } });
        const report = yield* runWorktreeReap({
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("unknown"),
          runCommand: runner,
          startFrom: repoRoot,
        });

        expect(O.getOrThrow(candidateAt(report, merged).skipReason)).toBe("liveness-unknown");
        expect(candidateAt(report, merged).retired).toBe(false);
      })
    )
  );

  it.effect("revalidates and archive-retires only a merged candidate, then deletes its branch", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "apply-merged");
        const runner = ghStubRunner({ [merged]: { open: undefined, merged: 201 } });
        const report = yield* runWorktreeReap({
          apply: true,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("dormant"),
          runCommand: runner,
          startFrom: repoRoot,
        });

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

  it.effect("keeps a candidate eligible and retires it when only the size probe fails", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "unmeasured");
        const runner = ghStubRunner({ [merged]: { open: undefined, merged: 501 } }, () => ({
          exitCode: 1,
          output: "fixture du failure",
          truncated: false,
        }));
        const report = yield* runWorktreeReap({
          apply: true,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("dormant"),
          runCommand: runner,
          startFrom: repoRoot,
        });

        const candidate = candidateAt(report, merged);
        expect(candidate.retired).toBe(true);
        expect(O.isNone(candidate.skipReason)).toBe(true);
        expect(O.isNone(candidate.bytes)).toBe(true);
        expect(report.reclaimedBytes).toBe(0);
        expect(A.some(report.warnings, Str.includes("size-probe-failed"))).toBe(true);
        expect(yield* fs.exists(merged)).toBe(false);
      })
    )
  );

  it.effect("reports the rechecked classification when eligibility changes before retirement", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "reclassified");
        let openCalls = 0;
        const runner = Effect.fn("WorktreeReapTest.reclassifyRunner")(function* (
          command: string,
          args: ReadonlyArray<string>,
          cwd: string
        ) {
          if (!Str.Equivalence(command, "gh")) {
            return yield* runRepoCommandCapture(command, args, cwd);
          }
          if (A.contains(args, "merged")) {
            return ghResult(301);
          }
          openCalls += 1;
          return ghResult(openCalls > 1 ? 305 : undefined);
        });
        const report = yield* runWorktreeReap({
          apply: true,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("dormant"),
          runCommand: runner,
          startFrom: repoRoot,
        });

        const candidate = candidateAt(report, merged);
        expect(candidate.retired).toBe(false);
        expect(candidate.reapClass).toBe("open-pr");
        expect(O.getOrThrow(candidate.skipReason)).toBe("open-pr");
        expect(O.getOrThrow(candidate.prNumber)).toBe(305);
        expect(O.isSome(candidate.bytes)).toBe(true);
        expect(A.some(report.warnings, Str.includes("eligibility changed before retirement"))).toBe(true);
        expect(yield* fs.exists(merged)).toBe(true);
      })
    )
  );

  it.effect("reports a retirement whose checkout was removed before cleanup failed", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "half-retired");
        const runner = ghStubRunner({ [merged]: { open: undefined, merged: 601 } });
        const report = yield* runWorktreeReap({
          apply: true,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("dormant"),
          runCommand: runner,
          startFrom: repoRoot,
        }).pipe(
          Effect.provideService(WorktreeRemovalService, {
            remove: Effect.fnUntraced(function* (request) {
              yield* fs.remove(request.targetPath, { force: true, recursive: true }).pipe(Effect.ignore);
              return yield* WorktreeCommandError.make({ message: "fixture cleanup failure" });
            }),
          })
        );

        const candidate = candidateAt(report, merged);
        expect(candidate.retired).toBe(true);
        expect(O.isNone(candidate.skipReason)).toBe(true);
        expect(A.some(report.warnings, Str.includes("retirement-cleanup-failed"))).toBe(true);
        expect(yield* fs.exists(merged)).toBe(false);
      })
    )
  );

  it.effect("fails closed when retirement fails with the checkout still present", () =>
    withScratchRepo(({ repoRoot, worktreesRoot }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const merged = yield* addWorktree(repoRoot, worktreesRoot, "unremovable");
        const runner = ghStubRunner({ [merged]: { open: undefined, merged: 602 } });
        const report = yield* runWorktreeReap({
          apply: true,
          nowMillis: FIXTURE_NOW_MILLIS,
          probeLiveness: verdictProber("dormant"),
          runCommand: runner,
          startFrom: repoRoot,
        }).pipe(
          Effect.provideService(WorktreeRemovalService, {
            remove: Effect.fnUntraced(function* () {
              return yield* WorktreeCommandError.make({ message: "fixture removal refusal" });
            }),
          })
        );

        const candidate = candidateAt(report, merged);
        expect(candidate.retired).toBe(false);
        expect(O.getOrThrow(candidate.skipReason)).toBe("retirement-failed");
        expect(A.some(report.warnings, Str.includes("retirement-failed"))).toBe(true);
        expect(yield* fs.exists(merged)).toBe(true);
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
    })
  );

  it("renders retired, eligible, and skipped rows with totals and warnings", () => {
    const report = WorktreeReapReport.make({
      scannedAt: "2026-09-03T12:00:00.000Z",
      mainCheckout: "/repo",
      invokingWorktree: "/repo",
      idleThresholdHours: 48,
      applied: true,
      candidates: [
        WorktreeReapCandidate.make({
          path: "/w/retired",
          branch: O.some("feat/retired"),
          reapClass: "merged-pr",
          skipReason: O.none(),
          prNumber: O.some(7),
          idleHours: O.some(72.25),
          bytes: O.some(4096),
          retired: true,
        }),
        WorktreeReapCandidate.make({
          path: "/w/eligible",
          branch: O.some("feat/eligible"),
          reapClass: "merged-pr",
          skipReason: O.none(),
          prNumber: O.some(9),
          idleHours: O.some(96),
          bytes: O.none(),
          retired: false,
        }),
        WorktreeReapCandidate.make({
          path: "/w/detached",
          branch: O.none(),
          reapClass: "unknown",
          skipReason: O.some("detached-head"),
          prNumber: O.none(),
          idleHours: O.none(),
          bytes: O.none(),
          retired: false,
        }),
      ],
      retiredCount: 1,
      reclaimableBytes: 4096,
      reclaimedBytes: 4096,
      warnings: ["size-probe-failed: could not measure eligible worktree /w/eligible; retirement is unaffected."],
    });
    const rendered = renderWorktreeReapReportLines(report).join("\n");
    expect(rendered).toContain("WORKTREE REAP APPLY");
    expect(rendered).toContain("- retired class=merged-pr branch=feat/retired pr=#7 idle=72.3h bytes=4096 /w/retired");
    expect(rendered).toContain("- eligible class=merged-pr branch=feat/eligible pr=#9 idle=96.0h /w/eligible");
    expect(rendered).toContain("- skip class=unknown branch=(detached) idle=unknown skip=detached-head /w/detached");
    expect(rendered).toContain("totals: candidates=3 retired=1 reclaimable-bytes=4096 reclaimed-bytes=4096");
    expect(rendered).toContain("warning: size-probe-failed");
  });
});
