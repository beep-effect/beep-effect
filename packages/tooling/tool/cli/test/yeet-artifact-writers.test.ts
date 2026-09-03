import {
  attemptJournalPath,
  decodeYeetAttemptJournalEvent,
  defaultYeetRunOptions,
  ensureAttemptTerminatedForTesting,
  GreptileSummary,
  PrCloseoutReport,
  PrCloseoutReportJson,
  RepoRunContext,
  RepoRunPlan,
  runArtifactPathForContext,
  TurboPlanSnapshot,
  writePrCloseoutReportForTesting,
  writeRunVerdictForTesting,
  writeYeetStatusSnapshot,
  YeetAttemptJournalEvent,
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
import { Effect, Exit, FileSystem, Layer, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { describe, expect, it } from "vitest";
import type { YeetExecutedStep, YeetVerdictExtrasForTesting } from "@beep/repo-cli/test/Yeet";

const itEffect = <E>(name: string, program: () => Effect.Effect<unknown, E>): void =>
  it(name, () => Effect.runPromise(program()));

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

const attemptId = S.decodeSync(UUID)("550e8400-e29b-41d4-a716-446655440000");

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
    head: "0123456789abcdef0123456789abcdef01234567",
    mode: "publish",
    startedAt: "2026-08-04T00:00:00.000Z",
    resolvedHeadSha: O.some("0123456789abcdef0123456789abcdef01234567"),
    diffFingerprint: O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
    proofTier: O.some("full"),
  });

const blockedMergeReady = YeetMergeReady.make({
  ready: false,
  failing: O.some("threads-resolved"),
  criteria: YeetMergeReadyCriteria.make({
    prOpen: true,
    notDraft: true,
    closeoutRun: true,
    requiredChecksGreen: true,
    threadsResolved: false,
    mergeable: true,
    mergeStateAcceptable: true,
    reviewDecisionAcceptable: true,
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
  itEffect("writes a verdict file that decodes back through YeetVerdictJson", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
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
        expect(decoded.resolvedHeadSha).toStrictEqual(O.some("0123456789abcdef0123456789abcdef01234567"));
        expect(decoded.diffFingerprint).toStrictEqual(
          O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd")
        );
        expect(decoded.proofTier).toStrictEqual(O.some("full"));
        // Threaded from the status snapshot the publish/monitor path read.
        expect(O.flatMap(decoded.mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));

        const journalText = yield* fs.readFileString(yield* attemptJournalPath(context));
        const journalEvents = yield* Effect.forEach(
          pipe(journalText, Str.split("\n"), A.filter(Str.isNonEmpty)),
          decodeYeetAttemptJournalEvent
        );
        const terminal = pipe(
          journalEvents,
          A.findFirst(YeetAttemptJournalEvent.guards["attempt-terminated"]),
          O.getOrThrow
        );
        expect(terminal.reason).toBe("success");
        expect(terminal.verdict).toMatchObject({ _tag: "Some" });
      })
    )
  );

  itEffect("omits merge readiness from the artifact when no status snapshot was read", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
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
          "failure",
          "yeet verify failed.",
          O.none()
        );

        const { text } = yield* readVerdictArtifact(context);
        expect(text).not.toContain("mergeReady");

        const decoded = yield* YeetVerdictJson.decode(text);
        expect(decoded.mergeReady).toStrictEqual(O.none());
        const journalText = yield* fs.readFileString(yield* attemptJournalPath(context));
        const events = yield* Effect.forEach(
          pipe(journalText, Str.split("\n"), A.filter(Str.isNonEmpty)),
          decodeYeetAttemptJournalEvent
        );
        expect(
          pipe(events, A.findFirst(YeetAttemptJournalEvent.guards["attempt-terminated"]), O.getOrThrow).reason
        ).toBe("failure");
      })
    )
  );

  itEffect("writes one interruption terminal when execution exits before a verdict", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const context = contextForRoot(tmpDir);
        const attempt = attemptFor(context);
        const terminalWritten = yield* Ref.make(false);

        yield* ensureAttemptTerminatedForTesting(context, attempt, terminalWritten, Exit.interrupt());
        yield* ensureAttemptTerminatedForTesting(context, attempt, terminalWritten, Exit.interrupt());

        const journalText = yield* fs.readFileString(yield* attemptJournalPath(context));
        const events = yield* Effect.forEach(
          pipe(journalText, Str.split("\n"), A.filter(Str.isNonEmpty)),
          decodeYeetAttemptJournalEvent
        );
        const terminals = A.filter(events, YeetAttemptJournalEvent.guards["attempt-terminated"]);
        expect(terminals).toHaveLength(1);
        expect(terminals[0]?.reason).toBe("interrupted");
        expect(terminals[0]?.verdict).toStrictEqual(O.none());
        expect(terminals[0]?.proofTier).toStrictEqual(O.some("full"));
      })
    )
  );
});

const reviewedSha = "0123456789abcdef0123456789abcdef01234567";

const closeoutReportWith = (reviewedHeadSha: O.Option<string>): PrCloseoutReport =>
  PrCloseoutReport.make({
    actionableReviewThreadCount: 0,
    botCommentCount: 2,
    greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
    issueCount: 0,
    issues: A.empty(),
    prNumber: 560,
    prUrl: "https://github.com/YeeBois/beep-effect/pull/560",
    reviewedHeadSha,
    retriggeredGreptile: false,
    schemaVersion: "yeet-pr-closeout/v1",
  });

describe("writePrCloseoutReport", () => {
  itEffect("writes a closeout file whose reviewedHeadSha decodes back as a plain string", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const context = contextForRoot(tmpDir);

        const reportPath = yield* writePrCloseoutReportForTesting(context, closeoutReportWith(O.some(reviewedSha)));
        expect(reportPath).toBe(yield* runArtifactPathForContext(context, "pr-closeout.json"));

        const text = yield* fs.readFileString(reportPath);
        expect(text).not.toContain('"_id":"Option"');
        expect(text).toContain(`"reviewedHeadSha":"${reviewedSha}"`);

        const decoded = yield* PrCloseoutReportJson.decode(text);
        expect(decoded.reviewedHeadSha).toStrictEqual(O.some(reviewedSha));
        expect(decoded.greptile.score).toBe("5/5");
      })
    )
  );

  itEffect("omits reviewedHeadSha from the artifact when no head was recorded", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const context = contextForRoot(tmpDir);

        const reportPath = yield* writePrCloseoutReportForTesting(context, closeoutReportWith(O.none()));

        const text = yield* fs.readFileString(reportPath);
        expect(text).not.toContain("reviewedHeadSha");

        const decoded = yield* PrCloseoutReportJson.decode(text);
        expect(decoded.reviewedHeadSha).toStrictEqual(O.none());
      })
    )
  );
});

describe("writeYeetStatusSnapshot", () => {
  itEffect("writes a status file that decodes back through YeetStatusSnapshotJson", () =>
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
