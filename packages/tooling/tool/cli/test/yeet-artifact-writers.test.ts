import {
  defaultYeetRunOptions,
  RepoRunContext,
  RepoRunPlan,
  runArtifactPathForContext,
  TurboPlanSnapshot,
  writeRunVerdictForTesting,
  writeYeetStatusSnapshot,
  YeetAttemptStarted,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusSnapshotJson,
  YeetStatusWorktree,
  YeetVerdictJson,
} from "@beep/repo-cli/test/Yeet";
import { UUID } from "@beep/schema/String";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { YeetExecutedStep, YeetVerdictExtrasForTesting } from "@beep/repo-cli/test/Yeet";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

const attemptId = S.decodeUnknownSync(UUID)("550e8400-e29b-41d4-a716-446655440000");

const contextForRoot = (repoRoot: string): RepoRunContext =>
  RepoRunContext.make({
    repoRoot,
    cwd: repoRoot,
    base: "origin/main",
    head: "HEAD",
    branch: "feat/merge-loop",
    packetDir: ".beep/yeet",
    originalArgv: [],
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], packages: [], tasks: [] }),
  });

const attemptFor = (context: RepoRunContext): YeetAttemptStarted =>
  YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId,
    runId: "feat_merge-loop",
    branch: context.branch,
    base: context.base,
    head: context.head,
    mode: "publish",
    startedAt: "2026-08-04T00:00:00.000Z",
  });

const blockedMergeReady = YeetMergeReady.make({
  ready: false,
  failing: O.some("threads-resolved"),
  criteria: YeetMergeReadyCriteria.make({
    closeoutRun: true,
    checksGreen: true,
    threadsResolved: false,
    greptileScore: O.some("5/5"),
  }),
});

const extrasWith = (mergeReady: O.Option<YeetMergeReady>): YeetVerdictExtrasForTesting => ({
  baseFreshness: O.none(),
  mergeReady,
  stash: O.none(),
});

// Resolved through the same path helper the writer uses, so the bytes read back
// are the bytes `yeet status` would later decode.
const readVerdictArtifact = Effect.fnUntraced(function* (context: RepoRunContext) {
  const fs = yield* FileSystem.FileSystem;
  const verdictPath = yield* runArtifactPathForContext(context, "verdict.json");
  return { text: yield* fs.readFileString(verdictPath), verdictPath } as const;
});

// The artifact producers were covered only at the codec layer, so reverting a
// writer to a generic JSON render left every test green while `yeet status`
// could no longer decode what the writer had emitted. These assert the bytes
// that actually landed on disk.
describe("writeRunVerdict", () => {
  it.effect("writes a verdict file that decodes back through YeetVerdictJson", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const context = contextForRoot(tmpDir);
        const plan = RepoRunPlan.make({ context, steps: A.empty() });
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
        const extras = yield* Ref.make<YeetVerdictExtrasForTesting>(extrasWith(O.some(blockedMergeReady)));

        yield* writeRunVerdictForTesting(
          plan,
          defaultYeetRunOptions({ mode: "publish" }),
          attemptFor(context),
          0,
          recorder,
          extras,
          "success",
          "yeet publish succeeded.",
          O.none()
        );

        const { text } = yield* readVerdictArtifact(context);
        expect(text).not.toContain('"_id":"Option"');

        const decoded = yield* YeetVerdictJson.decode(text);
        expect(decoded.outcome).toBe("success");
        expect(decoded.mode).toBe("publish");
        expect(decoded.attemptId).toStrictEqual(O.some(attemptId));
        // Threaded from the status snapshot the publish/monitor path read.
        expect(O.flatMap(decoded.mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));
      })
    )
  );

  it.effect("omits merge readiness from the artifact when no status snapshot was read", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const context = contextForRoot(tmpDir);
        const plan = RepoRunPlan.make({ context, steps: A.empty() });
        const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
        const extras = yield* Ref.make<YeetVerdictExtrasForTesting>(extrasWith(O.none()));

        yield* writeRunVerdictForTesting(
          plan,
          defaultYeetRunOptions({ mode: "verify" }),
          attemptFor(context),
          0,
          recorder,
          extras,
          "success",
          "yeet verify succeeded.",
          O.none()
        );

        const { text } = yield* readVerdictArtifact(context);
        expect(text).not.toContain("mergeReady");

        const decoded = yield* YeetVerdictJson.decode(text);
        expect(decoded.mergeReady).toStrictEqual(O.none());
      })
    )
  );
});

describe("writeYeetStatusSnapshot", () => {
  it.effect("writes a status file that decodes back through YeetStatusSnapshotJson", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const statusPath = path.join(tmpDir, ".beep", "yeet", "runs", "feat_merge-loop", "status.json");
        const closeout = YeetStatusArtifact.make({
          detail: "PR #560",
          issueCount: 0,
          path: "pr-closeout.json",
          state: "present",
          greptileScore: O.some("5/5"),
        });
        const snapshot = YeetStatusSnapshot.make({
          base: "origin/main",
          branch: "feat/merge-loop",
          closeout,
          createdAt: "2026-08-04T00:00:00.000Z",
          head: "HEAD",
          nextCommand: "bun run beep yeet closeout --summary",
          remote: YeetStatusRemote.make({
            available: true,
            checked: true,
            detail: "PR #560 OPEN",
            checkCount: 24,
            failingCheckCount: 0,
            pendingCheckCount: 0,
            unresolvedReviewThreadCount: 1,
          }),
          runId: "feat_merge-loop",
          schemaVersion: "yeet-status/v1",
          statusPath,
          verdict: YeetStatusArtifact.make({ detail: "publish success", path: "verdict.json", state: "present" }),
          worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
          mergeReady: O.some(blockedMergeReady),
        });

        yield* writeYeetStatusSnapshot(snapshot);

        const text = yield* fs.readFileString(statusPath);
        expect(text).not.toContain('"_id":"Option"');

        const decoded = yield* YeetStatusSnapshotJson.decode(text);
        expect(decoded.statusPath).toBe(statusPath);
        expect(O.flatMap(decoded.mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));
        expect(O.flatMap(decoded.mergeReady, (value) => value.criteria.greptileScore)).toStrictEqual(O.some("5/5"));
      })
    )
  );
});
