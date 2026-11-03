import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import {
  ackYeetInboxRow,
  appendYeetInboxRow,
  describeYeetInboxRow,
  dispatchYeetBaseConflict,
  GreptileSummary,
  loadYeetInboxView,
  loadYeetPrWave,
  loadYeetRemediationWave,
  mergeReadyCriterionHolds,
  PrCloseoutReport,
  RepoRunContext,
  readYeetAckState,
  renderYeetAckResolution,
  runYeetMonitorUntilMerged,
  writeYeetAckReceipt,
  YeetAckClearedResolution,
  YeetAckEnvironmentOnlyResolution,
  YeetAckFixResolution,
  YeetAckObservedResolution,
  YeetAckReceipt,
  YeetAckReceiptJson,
  YeetAckResolutionKind,
  YeetAckThreadResolution,
  YeetAckWaiveResolution,
  YeetAckWontfixResolution,
  YeetBaseConflictCapsule,
  YeetBaseConflictRow,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxRow,
  YeetInboxRowJson,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetMonitorAttachment,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  YeetRulesetRequiredContexts,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetUntilMergedPolicy,
  YeetUntilReadyPolicy,
  YeetWatchCheck,
  yeetBaseConflictGeneration,
  yeetBaseConflictRowId,
  yeetBaseConflictWalk,
  yeetBaseMergeableFor,
  yeetInboxExpectedRowId,
  yeetInboxHoldsRow,
  yeetInboxRowId,
  yeetInboxRowPrNumber,
} from "@beep/repo-cli/test/Yeet";
import { fcRuns } from "@beep/test-utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { monitorGithubLayer } from "./support/YeetGithub.ts";

const at = "2026-09-25T00:00:00.000Z";
const url = "https://github.com/beep/repo/pull/7";
const head = "aaaaaaa1111111";
const fixHead = "bbbbbbb2222222";
const jobId = "0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60";
const jobUnit = `beep-proof-${jobId}.service`;

const greenCheck = YeetWatchCheck.make({ name: "Check", outcome: "pass", required: true });
const pendingCheck = YeetWatchCheck.make({ name: "Check", outcome: "pending", required: true });

const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/conflict",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

interface SnapshotInput {
  readonly bound?: boolean;
  readonly checks: ReadonlyArray<YeetWatchCheck>;
  readonly mergeable?: string;
  readonly mergeStateStatus?: string;
  readonly sha: string;
  readonly state?: string;
}

const snapshot = (root: string, input: SnapshotInput) => {
  const state = input.state ?? "OPEN";
  const bound = input.bound ?? false;
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: state === "OPEN",
    notDraft: true,
    closeoutRun: bound,
    requiredChecksGreen: A.every(input.checks, (value) => !value.required || value.outcome === "pass"),
    threadsResolved: true,
    mergeable: input.mergeable !== "CONFLICTING",
    mergeStateAcceptable: input.mergeStateStatus !== "DIRTY",
    reviewDecisionAcceptable: true,
    reviewWindowElapsed: true,
    greptileScore: O.none(),
  });
  const failing = A.findFirst(
    YeetMergeReadyCriterion.literals,
    (criterion) => !mergeReadyCriterionHolds(criteria, criterion)
  );
  return YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feature/conflict",
    head: "HEAD",
    createdAt: at,
    nextCommand: "monitor",
    runId: "conflict",
    schemaVersion: "yeet-status/v1",
    statusPath: `${root}/status.json`,
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    closeout: YeetStatusArtifact.make({ detail: "fixture", path: "closeout.json", state: "missing" }),
    verdict: YeetStatusArtifact.make({ detail: "fixture", path: "verdict.json", state: "missing" }),
    remote: YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "fixture",
      headSha: O.some(input.sha),
      number: 7,
      url,
      checks: input.checks,
      state,
      failingCheckCount: 0,
      unresolvedThreads: O.some([]),
      ...(input.mergeStateStatus === undefined ? {} : { mergeStateStatus: input.mergeStateStatus }),
      ...(input.mergeable === undefined ? {} : { mergeable: input.mergeable }),
    }),
    mergeReady: O.some(YeetMergeReady.make({ ready: O.isNone(failing), criteria, failing })),
  });
};

const conflicted = (root: string, sha = head, checks = [pendingCheck]) =>
  snapshot(root, { checks, mergeStateStatus: "DIRTY", mergeable: "CONFLICTING", sha });
const mergeable = (root: string, sha: string, bound: boolean) =>
  snapshot(root, { bound, checks: [greenCheck], mergeStateStatus: "CLEAN", mergeable: "MERGEABLE", sha });
// Mergeable with the required check still pending: clears a conflict row, but
// the census is unsettled, so no closeout reread runs inside the poll.
const mergeablePending = (root: string) =>
  snapshot(root, { checks: [pendingCheck], mergeStateStatus: "CLEAN", mergeable: "MERGEABLE", sha: head });

const report = (sha: string) => ({
  reportPath: "closeout.json",
  report: PrCloseoutReport.make({
    actionableReviewThreadCount: 0,
    botCommentCount: 0,
    greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
    issueCount: 0,
    issues: [],
    prNumber: 7,
    prUrl: url,
    reviewedHeadSha: O.some(sha),
    retriggeredGreptile: false,
    schemaVersion: "yeet-pr-closeout/v1",
  }),
});

// The loop's once-per-head merge-base diff runs through `Git.changedFiles` (W2b); a code-bearing
// answer keeps the heavy-admission verdict these fixtures were written against.
const mergeBaseDiffGit = Git.layerTest({ changedFiles: () => Effect.succeed(["packages/a/src/index.ts"]) });
const basePlatform = Layer.mergeAll(
  mergeBaseDiffGit,
  NodeFileSystem.layer,
  NodePath.layer,
  NodeCrypto.layer,
  ScriptedSpawner.make((_command, args) =>
    args[0] === "run" && args[1] === "list" ? { stdout: "[]" } : { exit: 1, stderr: "unexpected process" }
  ).layer
);
// The merge loop reads the head commit and the acting login as its gh login (W6); both answer `at`.
const platform = Layer.provideMerge(
  monitorGithubLayer(() => Effect.succeed({ exitCode: 0, output: at })),
  basePlatform
);

const loopOptions = {
  rulesetRead: () =>
    Effect.succeedSome(
      YeetRulesetRequiredContexts.make({ base: "main", readAt: at, contexts: ["Check"], rulesetIds: [1] })
    ),
  pollInterval: Duration.zero,
  onMerged: () => Effect.void,
  replayComments: () => Effect.void,
  // The until-ready comment consumer is proven in yeet-pr-comment-rows.
  commentRows: () => Effect.succeed(A.empty()),
};

// The monitor job's identity as the launcher sets it on the unit.
const jobEnvironment = ConfigProvider.fromUnknown({ BEEP_YEET_JOB_ID: jobId, BEEP_YEET_JOB_UNIT: jobUnit });

const rows = Effect.fn("baseConflictTest.rows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(`${root}/.beep/inbox/failures.ndjson`);
  if (!exists) return [];
  const text = yield* fs.readFileString(`${root}/.beep/inbox/failures.ndjson`);
  return A.flatMap(Str.split(text, "\n"), (line) => O.toArray(YeetInboxRowJson.decodeOption(line)));
});

const conflictRows = (root: string) =>
  rows(root).pipe(Effect.map(A.filter((row): row is YeetBaseConflictRow => row.kind === "base-conflict")));

const tempRoot = Effect.fn("baseConflictTest.tempRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "yeet-base-conflict-" });
});

const capsuleFor = (sha: string, generation = 0) =>
  YeetBaseConflictCapsule.make({
    base: "origin/main",
    generation,
    headSha: sha,
    link: url,
    mergeable: "CONFLICTING",
    mergeStateStatus: "DIRTY",
    prNumber: 7,
  });

// The row id of one conflict generation on head A of pull request 7.
const generationId = (generation: number) => yeetBaseConflictRowId({ generation, headSha: head, prNumber: 7 });

// An earlier monitor's `cleared` receipt, stamped with its own time so a later
// rewrite by the loop under test is visible.
const earlierClear = "2026-09-24T00:00:00.000Z";
const writeEarlierClear = (root: string, id: string) =>
  writeYeetAckReceipt(
    root,
    YeetAckReceipt.make({
      ackedAt: earlierClear,
      id,
      resolution: YeetAckClearedResolution.make({
        headSha: head,
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        jobId: O.none(),
        unit: O.none(),
      }),
    })
  );

// A check red on head A, appended to rebuild the bounded active index.
const appendRed = Effect.fn("baseConflictTest.appendRed")(function* (root: string) {
  const failed = YeetFailureCapsule.make({
    bucket: "fail",
    headSha: head,
    lane: "Check",
    link: null,
    observedAt: at,
    prNumber: 7,
    state: "FAILURE",
    workflow: null,
  });
  const id = yield* yeetInboxRowId(failed);
  yield* appendYeetInboxRow(
    root,
    YeetCheckFailedRow.make({ capsule: failed, checkout: root, id, severity: "P0", ts: at })
  );
  return id;
});

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeJsonObject = S.decodeEffect(JsonObject);
const encodeJsonObject = S.encodeEffect(JsonObject);

// An it.layer block shares one TestConsole, so a test that counts lines counts
// only the ones printed after its own mark.
interface ConsoleMark {
  readonly errors: number;
  readonly logs: number;
}

const consoleMark = Effect.fn("baseConflictTest.consoleMark")(function* () {
  const errorLines1 = yield* TestConsole.errorLines;
  const argument = A.length(errorLines1);
  const logLines1 = yield* TestConsole.logLines;
  return { errors: argument, logs: A.length(logLines1) };
});

const consoleSince = Effect.fn("baseConflictTest.consoleSince")(function* (mark: ConsoleMark) {
  const errorLines2 = yield* TestConsole.errorLines;
  const argument1 = A.map(A.drop(errorLines2, mark.errors), String);
  const logLines2 = yield* TestConsole.logLines;
  return {
    errors: argument1,
    logs: A.map(A.drop(logLines2, mark.logs), String),
  };
});

it.layer(platform, { timeout: "30 seconds" })("base-conflict row", (it) => {
  it.effect("derives one id per (pull request, head, generation) and joins every kind-dispatch site", () =>
    Effect.gen(function* () {
      const id = yield* yeetBaseConflictRowId(capsuleFor(head));
      expect(id).toMatch(/^base-conflict-[0-9a-f]{12}$/);
      // Generation 0 keeps the pre-generation digest of "7:<head>", so rows and
      // cleared receipts already on disk keep their ids.
      strictEqual(id, "base-conflict-d50fbcc322ba");
      const generationId3 = yield* generationId(0);
      strictEqual(generationId3, id);
      const generationId4 = yield* generationId(1);
      expect(generationId4).not.toBe(id);
      const generationId5 = yield* generationId(2);
      const argument2 = expect(generationId5).not;
      const generationId6 = yield* generationId(1);
      argument2.toBe(generationId6);
      // Re-reading the same conflict derives the same id; the raw merge fields are evidence, not identity.
      const yeetBaseConflictRowId6 = yield* yeetBaseConflictRowId(
        YeetBaseConflictCapsule.make({ ...capsuleFor(head), mergeable: "UNKNOWN", mergeStateStatus: "DIRTY" })
      );
      expect(yeetBaseConflictRowId6).toBe(id);
      const yeetBaseConflictRowId7 = yield* yeetBaseConflictRowId(capsuleFor(fixHead));
      expect(yeetBaseConflictRowId7).not.toBe(id);
      const yeetBaseConflictRowId8 = yield* yeetBaseConflictRowId({ generation: 0, headSha: head, prNumber: 8 });
      expect(yeetBaseConflictRowId8).not.toBe(id);

      const row = YeetBaseConflictRow.make({
        capsule: capsuleFor(head),
        checkout: "/repo",
        id,
        severity: "P0",
        ts: at,
      });
      const yeetInboxExpectedRowId9 = yield* yeetInboxExpectedRowId(row);
      expect(yeetInboxExpectedRowId9).toBe(id);
      assertSome(yeetInboxRowPrNumber(row), 7);
      expect(describeYeetInboxRow(row)).toBe("base conflict with origin/main (pr #7 @ aaaaaaa)");
      const line = yield* YeetInboxRowJson.encode(row);
      assertSome(YeetInboxRowJson.decodeOption(line), row);
      const encoded = yield* decodeJsonObject(line);
      expect(encoded).toMatchObject({
        kind: "base-conflict",
        schemaVersion: "yeet-inbox/v1",
        severity: "P0",
        capsule: { base: "origin/main", generation: 0, link: url, mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" },
      });

      // A row written before generations existed has no key; it decodes as
      // generation 0, the same row, so its id still validates.
      const legacyLine = yield* encodeJsonObject({
        ...encoded,
        capsule: {
          base: "origin/main",
          headSha: head,
          link: url,
          mergeable: "CONFLICTING",
          mergeStateStatus: "DIRTY",
          prNumber: 7,
        },
      });
      expect(legacyLine).not.toContain("generation");
      assertSome(YeetInboxRowJson.decodeOption(legacyLine), row);
    })
  );

  it.effect.prop(
    "derives the row id from the pull request, head and generation alone, for any generated capsule",
    [Arbitrary.schema(YeetBaseConflictCapsule), Arbitrary.schema(YeetBaseConflictCapsule)],
    Effect.fnUntraced(function* ([capsule, evidence]) {
      const id = yield* yeetBaseConflictRowId(capsule);
      expect(id).toMatch(/^base-conflict-[0-9a-f]{12}$/);
      // Base, link, and the raw merge fields are evidence, not identity.
      const yeetBaseConflictRowId10 = yield* yeetBaseConflictRowId(
        YeetBaseConflictCapsule.make({
          ...evidence,
          generation: capsule.generation,
          headSha: capsule.headSha,
          prNumber: capsule.prNumber,
        })
      );
      expect(yeetBaseConflictRowId10).toBe(id);
      // The next generation on the same head is a different row.
      const yeetBaseConflictRowId11 = yield* yeetBaseConflictRowId({ ...capsule, generation: capsule.generation + 1 });
      expect(yeetBaseConflictRowId11).not.toBe(id);
      const row = YeetBaseConflictRow.make({ capsule, checkout: "/repo", id, severity: "P0", ts: at });
      const yeetInboxExpectedRowId12 = yield* yeetInboxExpectedRowId(row);
      expect(yeetInboxExpectedRowId12).toBe(id);
    }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips generated base-conflict rows through the inbox row codec",
    [Arbitrary.schema(YeetBaseConflictRow)],
    Effect.fnUntraced(function* ([row]) {
      const line = yield* YeetInboxRowJson.encode(row);
      const decoded = yield* YeetInboxRowJson.decode(line);
      assertTrue(S.toEquivalence(YeetInboxRow)(decoded, row));
      const encoded13 = yield* YeetInboxRowJson.encode(decoded);
      expect(encoded13).toBe(line);
    }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips generated remediation wave records",
    [Arbitrary.schema(YeetRemediationWave)],
    Effect.fnUntraced(function* ([wave]) {
      const json = yield* YeetRemediationWaveJson.encode(wave);
      const argument3 = S.toEquivalence(YeetRemediationWave);
      const decoded7 = yield* YeetRemediationWaveJson.decode(json);
      assertTrue(argument3(decoded7, wave));
    }),
    { arbitrary: fcRuns(20) }
  );

  it.effect("clears only on positive mergeability, never on an unknown or absent read", () =>
    Effect.sync(() => {
      expect(yeetBaseMergeableFor(O.some("MERGEABLE"), O.some("CLEAN"))).toBe(true);
      expect(yeetBaseMergeableFor(O.some("mergeable"), O.some("BLOCKED"))).toBe(true);
      expect(yeetBaseMergeableFor(O.some("MERGEABLE"), O.none())).toBe(true);
      expect(yeetBaseMergeableFor(O.some("MERGEABLE"), O.some("DIRTY"))).toBe(false);
      expect(yeetBaseMergeableFor(O.some("UNKNOWN"), O.some("UNKNOWN"))).toBe(false);
      expect(yeetBaseMergeableFor(O.some("CONFLICTING"), O.some("CLEAN"))).toBe(false);
      expect(yeetBaseMergeableFor(O.none(), O.some("CLEAN"))).toBe(false);
    })
  );

  it.effect("joins the conflict to the head's wave once and returns None for a row the inbox already holds", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const first = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const argument4 = O.map(first, (row) => row.id);
      const generationId8 = yield* generationId(0);
      assertSome(argument4, generationId8);
      // The same generation again appends nothing, so it reports no live row written.
      const dispatchYeetBaseConflict14 = yield* dispatchYeetBaseConflict(
        root,
        capsuleFor(head),
        "2026-09-25T00:00:30.000Z"
      );
      assertNone(dispatchYeetBaseConflict14);
      const conflictRows15 = yield* conflictRows(root);
      expect(conflictRows15).toHaveLength(1);
      const loadedYeetRemediationWave = yield* loadYeetRemediationWave(root);
      const wave = O.getOrThrow(loadedYeetRemediationWave);
      expect(wave).toMatchObject({ headSha: head, prNumber: 7, sessionStartedAt: at });
      expect(wave.capsuleIds).toStrictEqual(A.map(O.toArray(first), (row) => row.id));
      const errorLines16 = yield* TestConsole.errorLines;
      const errors = A.map(errorLines16, String);
      expect(A.filter(errors, Str.includes("opened the repair session"))).toHaveLength(1);
      expect(A.filter(errors, Str.includes("already queued for head aaaaaaa"))).toHaveLength(0);
    })
  );

  it.effect("moves to the next generation only through a cleared receipt, which the active index cannot drop", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const coordinates = { headSha: head, prNumber: 7 };
      const yeetBaseConflictGeneration17 = yield* yeetBaseConflictGeneration(root, coordinates);
      strictEqual(yeetBaseConflictGeneration17, 0);
      const dispatchYeetBaseConflict18 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const first = O.getOrThrow(dispatchYeetBaseConflict18);
      // An open row is still the current generation: every poll derives its id.
      const yeetBaseConflictGeneration19 = yield* yeetBaseConflictGeneration(root, coordinates);
      strictEqual(yeetBaseConflictGeneration19, 0);

      yield* writeEarlierClear(root, first.id);
      const yeetBaseConflictGeneration20 = yield* yeetBaseConflictGeneration(root, coordinates);
      strictEqual(yeetBaseConflictGeneration20, 1);
      // Any later append rebuilds the active index without the acked row; the
      // receipt still counts it, and the acked id is held by its receipt.
      const red = yield* appendRed(root);
      const yeetInboxHoldsRow21 = yield* yeetInboxHoldsRow(root, first.id);
      assertFalse(yeetInboxHoldsRow21);
      const yeetBaseConflictGeneration22 = yield* yeetBaseConflictGeneration(root, coordinates);
      strictEqual(yeetBaseConflictGeneration22, 1);
      const dispatchYeetBaseConflict23 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      assertNone(dispatchYeetBaseConflict23);

      const dispatchYeetBaseConflict24 = yield* dispatchYeetBaseConflict(root, capsuleFor(head, 1), at);
      const second = O.getOrThrow(dispatchYeetBaseConflict24);
      const generationId25 = yield* generationId(1);
      strictEqual(second.id, generationId25);
      strictEqual(second.capsule.generation, 1);
      expect(second.id).not.toBe(first.id);
      const dispatchYeetBaseConflict26 = yield* dispatchYeetBaseConflict(root, capsuleFor(head, 1), at);
      assertNone(dispatchYeetBaseConflict26);
      const yeetBaseConflictGeneration27 = yield* yeetBaseConflictGeneration(root, coordinates);
      strictEqual(yeetBaseConflictGeneration27, 1);
      const conflictRows28 = yield* conflictRows(root);
      expect(A.map(conflictRows28, (row) => row.capsule.generation)).toStrictEqual([0, 1]);

      // The new generation is live and unacknowledged, so it is part of the pull request's wave.
      const loadedYeetPrWave = yield* loadYeetPrWave(root, 7, HashSet.empty());
      assertSome(
        O.map(loadedYeetPrWave, (wave) =>
          A.map(wave.entries, (entry) => [entry.row.id, entry.ack.acked, entry.liveness])
        ),
        [
          [red, false, "live"],
          [second.id, false, "live"],
        ]
      );
      const loadedYeetRemediationWave29 = yield* loadYeetRemediationWave(root);
      const wave = O.getOrThrow(loadedYeetRemediationWave29);
      expect(wave.capsuleIds).toStrictEqual([first.id, second.id]);

      // An operator ack of another kind closes the row but is not a clear.
      yield* ackYeetInboxRow(root, second.id, YeetAckWontfixResolution.make({ reason: "base revert pending" }), at);
      const yeetBaseConflictGeneration30 = yield* yeetBaseConflictGeneration(root, coordinates);
      strictEqual(yeetBaseConflictGeneration30, 1);
    })
  );
});

it.layer(platform, { timeout: "30 seconds" })("until-ready merge loop as the base-conflict producer", (it) => {
  it.effect("writes one row per head across polls and acks it cleared when the same head turns mergeable", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const polls = yield* Ref.make(0);
      const receiptBeforeMergeable = yield* Ref.make(true);
      // Polls 0-2: head A conflicted. Poll 3: GitHub recomputing (UNKNOWN), which
      // must not clear. Poll 4: the same head reads MERGEABLE (the base change was
      // reverted), closeout pending; the closeout reread (poll 5) binds it: ready.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        collectStatus: Effect.fnUntraced(function* () {
          const n = yield* Ref.getAndUpdate(polls, (value) => value + 1);
          if (n === 4) {
            const id = yield* yeetBaseConflictRowId(capsuleFor(head));
            yield* Ref.set(receiptBeforeMergeable, (yield* readYeetAckState(root, id)).acked);
          }
          if (n <= 2) return conflicted(root);
          if (n === 3) {
            return snapshot(root, {
              checks: [pendingCheck],
              mergeStateStatus: "UNKNOWN",
              mergeable: "UNKNOWN",
              sha: head,
            });
          }
          return mergeable(root, head, n >= 5);
        }),
        closeout: () => Effect.succeed(report(head)),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment));
      expect(terminal).toBe("ready");
      const got = yield* Ref.get(polls);
      expect(got).toBe(6);

      const written = yield* conflictRows(root);
      expect(written).toHaveLength(1);
      const row = A.getUnsafe(written, 0);
      expect(row).toMatchObject({
        severity: "P0",
        capsule: {
          base: "origin/main",
          headSha: head,
          link: url,
          mergeable: "CONFLICTING",
          mergeStateStatus: "DIRTY",
          prNumber: 7,
        },
      });
      const loadedYeetRemediationWave31 = yield* loadYeetRemediationWave(root);
      const wave = O.getOrThrow(loadedYeetRemediationWave31);
      expect(wave.capsuleIds).toContain(row.id);

      // No receipt through the conflicted and UNKNOWN polls; a cleared one after.
      const got32 = yield* Ref.get(receiptBeforeMergeable);
      expect(got32).toBe(false);
      const ack = yield* readYeetAckState(root, row.id);
      expect(ack.acked).toBe(true);
      const receipt = O.getOrThrow(O.fromNullOr(ack.receipt));
      expect(renderYeetAckResolution(receipt.resolution)).toBe(
        `cleared at aaaaaaa (MERGEABLE/CLEAN) by monitor job ${jobId}`
      );
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(`${root}/.beep/inbox/acks/${row.id}`);
      const decodedJsonObject = yield* decodeJsonObject(raw);
      expect(decodedJsonObject).toMatchObject({
        id: row.id,
        resolution: { kind: "cleared", headSha: head, jobId, unit: jobUnit },
      });

      const logLines33 = yield* TestConsole.logLines;
      const printed = A.join(A.map(logLines33, String), "\n");
      expect(printed).toContain(
        `[yeet] base conflict cleared on head aaaaaaa without a push; row ${row.id} acked cleared`
      );
      const errorLines34 = yield* TestConsole.errorLines;
      const errors = A.map(errorLines34, String);
      expect(A.filter(errors, Str.includes("[yeet] base conflict with origin/main on head aaaaaaa"))).toHaveLength(1);
    })
  );

  it.effect("lets the fix push supersede the row and never clears it from the new head's mergeability", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const polls = yield* Ref.make(0);
      // Polls 0-1: head A conflicted. Poll 2: the merge-the-base push (head B)
      // is mergeable; the closeout reread (poll 3) binds it: ready.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) => (n <= 1 ? conflicted(root) : mergeable(root, fixHead, n >= 3)))
          ),
        closeout: () => Effect.succeed(report(fixHead)),
      });
      expect(terminal).toBe("ready");
      const written = yield* conflictRows(root);
      expect(A.map(written, (row) => row.capsule.headSha)).toStrictEqual([head]);
      const id = A.getUnsafe(written, 0).id;
      expect((yield* readYeetAckState(root, id)).acked).toBe(false);
      const view = yield* loadYeetInboxView(root);
      const entry = A.findFirst(view.entries, (candidate) => candidate.row.id === id);
      assertSome(
        O.map(entry, (value) => value.liveness),
        "superseded"
      );
      const loadedYeetRemediationWave35 = yield* loadYeetRemediationWave(root);
      assertSome(
        O.map(loadedYeetRemediationWave35, (wave) => wave.headSha),
        fixHead
      );
      const errorLines36 = yield* TestConsole.errorLines;
      const errors = A.join(A.map(errorLines36, String), "\n");
      expect(errors).toContain("head moved to bbbbbbb; the 1-capsule wave for aaaaaaa is superseded.");
    })
  );

  it.effect("a restarted loop recalls the head's unacked conflict row and clears it", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const dispatchYeetBaseConflict37 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const earlier = O.getOrThrow(dispatchYeetBaseConflict37);
      const polls = yield* Ref.make(0);
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(Effect.map((n) => mergeable(root, head, n >= 1))),
        closeout: () => Effect.succeed(report(head)),
      });
      expect(terminal).toBe("ready");
      const conflictRows38 = yield* conflictRows(root);
      expect(conflictRows38).toHaveLength(1);
      const receipt = (yield* readYeetAckState(root, earlier.id)).receipt;
      assertSome(
        O.map(O.fromNullOr(receipt), (value) => renderYeetAckResolution(value.resolution)),
        "cleared at aaaaaaa (MERGEABLE/CLEAN) by an attached monitor"
      );
    }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
  );

  it.effect("a restarted loop whose first read is UNKNOWN still recalls and clears the row", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const dispatchYeetBaseConflict39 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const earlier = O.getOrThrow(dispatchYeetBaseConflict39);
      const polls = yield* Ref.make(0);
      // Poll 0: GitHub is still recomputing mergeability (UNKNOWN), which neither
      // writes nor clears. Poll 1: the same head reads MERGEABLE, closeout pending;
      // the closeout reread (poll 2) binds it: ready.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              n === 0
                ? snapshot(root, {
                    checks: [pendingCheck],
                    mergeStateStatus: "UNKNOWN",
                    mergeable: "UNKNOWN",
                    sha: head,
                  })
                : mergeable(root, head, n >= 2)
            )
          ),
        closeout: () => Effect.succeed(report(head)),
      });
      expect(terminal).toBe("ready");
      const conflictRows40 = yield* conflictRows(root);
      expect(conflictRows40).toHaveLength(1);
      const receipt = (yield* readYeetAckState(root, earlier.id)).receipt;
      assertSome(
        O.map(O.fromNullOr(receipt), (value) => value.resolution.kind),
        "cleared"
      );
    }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
  );

  it.effect("a conflict that returns on the same head after its clear writes the next generation and clears it", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const mark = yield* consoleMark();
      const first = yield* generationId(0);
      const second = yield* generationId(1);
      const polls = yield* Ref.make(0);
      const waveBeforeSecondClear = yield* Ref.make(O.none<ReadonlyArray<string>>());
      const secondAckedBeforeClear = yield* Ref.make(true);
      // Polls 0-1: head A conflicted (generation 0). Poll 2: the same head reads
      // mergeable with the required check still pending: generation 0 is acked
      // cleared. Polls 3-4: the conflict returns on the same head, no push
      // (generation 1). Poll 5: mergeable again: generation 1 is acked cleared.
      // Poll 6: green, closeout pending; the closeout reread (poll 7) binds it: ready.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        collectStatus: Effect.fnUntraced(function* () {
          const n = yield* Ref.getAndUpdate(polls, (value) => value + 1);
          if (n === 4) {
            const wave = yield* loadYeetPrWave(root, 7, HashSet.empty());
            yield* Ref.set(
              waveBeforeSecondClear,
              O.map(wave, (value) => A.map(value.entries, (entry) => entry.row.id))
            );
          }
          if (n === 5) {
            yield* Ref.set(secondAckedBeforeClear, (yield* readYeetAckState(root, second)).acked);
          }
          if (n === 2 || n === 5) return mergeablePending(root);
          if (n >= 6) return mergeable(root, head, n >= 7);
          return conflicted(root);
        }),
        closeout: () => Effect.succeed(report(head)),
      });
      strictEqual(terminal, "ready");
      const got41 = yield* Ref.get(polls);
      strictEqual(got41, 8);

      const conflictRows42 = yield* conflictRows(root);
      expect(A.map(conflictRows42, (row) => [row.id, row.capsule.generation])).toStrictEqual([
        [first, 0],
        [second, 1],
      ]);
      // Between its write and its clear, generation 1 was the pull request's
      // live, unacked wave row; the acked generation 0 was not part of it.
      const got43 = yield* Ref.get(waveBeforeSecondClear);
      assertSome(got43, [second]);
      const got44 = yield* Ref.get(secondAckedBeforeClear);
      assertFalse(got44);
      assertSome(
        O.map(O.fromNullOr((yield* readYeetAckState(root, first)).receipt), (receipt) => receipt.resolution.kind),
        "cleared"
      );
      assertSome(
        O.map(O.fromNullOr((yield* readYeetAckState(root, second)).receipt), (receipt) => receipt.resolution.kind),
        "cleared"
      );
      // Each generation was cleared exactly once: the second clear wrote only generation 1.
      const printed = yield* consoleSince(mark);
      expect(A.filter(printed.logs, Str.includes(`row ${first} acked cleared`))).toHaveLength(1);
      expect(A.filter(printed.logs, Str.includes(`row ${second} acked cleared`))).toHaveLength(1);
      expect(A.filter(printed.errors, Str.includes(`P0 capsule ${first} opened the repair session`))).toHaveLength(1);
      expect(
        A.filter(
          printed.errors,
          Str.includes(`P0 capsule ${second} queued to the head aaaaaaa repair session (2 capsules)`)
        )
      ).toHaveLength(1);
      const loadedYeetRemediationWave45 = yield* loadYeetRemediationWave(root);
      expect(O.getOrThrow(loadedYeetRemediationWave45).capsuleIds).toStrictEqual([first, second]);
      const yeetBaseConflictGeneration46 = yield* yeetBaseConflictGeneration(root, { headSha: head, prNumber: 7 });
      strictEqual(yeetBaseConflictGeneration46, 2);
    })
  );

  it.effect("an attached loop hands back a conflict that returns on the same head after an earlier clear", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const mark = yield* consoleMark();
      // An earlier monitor wrote generation 0 and acked it cleared.
      const dispatchYeetBaseConflict47 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const earlier = O.getOrThrow(dispatchYeetBaseConflict47);
      yield* writeEarlierClear(root, earlier.id);
      const second = yield* generationId(1);
      const polls = yield* Ref.make(0);
      // Poll 0: the conflict is back on the same head with no push, a new wave.
      // Had it raised no row, poll 1 would read the pull request closed.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        attachment: YeetMonitorAttachment.Enum.attached,
        policy: YeetUntilReadyPolicy.make({}),
        waveRerunCommand: "bun run beep yeet monitor --until-ready",
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              n === 0 ? conflicted(root) : snapshot(root, { checks: [pendingCheck], sha: head, state: "CLOSED" })
            )
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      strictEqual(terminal, "wave");
      const got48 = yield* Ref.get(polls);
      strictEqual(got48, 1);
      const conflictRows49 = yield* conflictRows(root);
      expect(A.map(conflictRows49, (row) => row.id)).toStrictEqual([earlier.id, second]);
      const printed = A.join((yield* consoleSince(mark)).logs, "\n");
      expect(printed).toContain(`[${second}]`);
      expect(printed).not.toContain(`[${earlier.id}]`);
    })
  );

  it.effect("a corrupt receipt on generation 0 is passed, so a same-head conflict still writes generation 1", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const fs = yield* FileSystem.FileSystem;
      // A truncated write: the receipt file exists, so it acks the row, but it no longer decodes.
      const corruptReceipt = Effect.fnUntraced(function* (id: string) {
        const path = yield* writeEarlierClear(root, id);
        const argument5 = Str.slice(0, 24);
        const readFileString9 = yield* fs.readFileString(path);
        yield* fs.writeFileString(path, argument5(readFileString9));
        return path;
      });
      const dispatchYeetBaseConflict50 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const earlier = O.getOrThrow(dispatchYeetBaseConflict50);
      const receiptPath = yield* corruptReceipt(earlier.id);
      const ack = yield* readYeetAckState(root, earlier.id);
      assertTrue(ack.acked);
      assertNone(O.fromNullOr(ack.receipt));
      const mark = yield* consoleMark();
      const second = yield* generationId(1);
      const polls = yield* Ref.make(0);
      // Poll 0: the conflict is back on the same head. A walk that stopped on the
      // corrupt receipt would write no row, and poll 1 would read the pull request closed.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        attachment: YeetMonitorAttachment.Enum.attached,
        policy: YeetUntilReadyPolicy.make({}),
        waveRerunCommand: "bun run beep yeet monitor --until-ready",
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              n === 0 ? conflicted(root) : snapshot(root, { checks: [pendingCheck], sha: head, state: "CLOSED" })
            )
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      strictEqual(terminal, "wave");
      const got51 = yield* Ref.get(polls);
      strictEqual(got51, 1);
      const conflictRows52 = yield* conflictRows(root);
      expect(A.map(conflictRows52, (row) => [row.id, row.capsule.generation])).toStrictEqual([
        [earlier.id, 0],
        [second, 1],
      ]);
      const printed = yield* consoleSince(mark);
      expect(
        A.filter(printed.errors, Str.includes(`[yeet] base-conflict ack receipt ${receiptPath} does not decode`))
      ).toHaveLength(1);
      expect(A.filter(printed.errors, Str.includes(`P0 capsule ${second} opened the repair session`))).toHaveLength(0);
      expect(A.filter(printed.errors, Str.includes(`P0 capsule ${second} queued to the head aaaaaaa`))).toHaveLength(1);
      const yeetBaseConflictGeneration53 = yield* yeetBaseConflictGeneration(root, { headSha: head, prNumber: 7 });
      strictEqual(yeetBaseConflictGeneration53, 1);
      const walk = yield* yeetBaseConflictWalk(root, { headSha: head, prNumber: 7 });
      expect(A.map(walk.corruptReceipts, (receipt) => [receipt.generation, receipt.path])).toStrictEqual([
        [0, receiptPath],
      ]);

      // Generation 1 acked wontfix keeps the head's conflict open with no row, so
      // every conflicted poll walks past the corrupt receipt again: from the
      // dispatch, the recall, and the ack notice. Polls 0-2: head A conflicted.
      // Polls 3-5: the fix push, conflicted too, whose own generation 0 receipt
      // is corrupt. Poll 6 reads the pull request closed.
      yield* ackYeetInboxRow(root, second, YeetAckWontfixResolution.make({ reason: "base revert pending" }), at);
      const yeetBaseConflictRowId54 = yield* yeetBaseConflictRowId({ generation: 0, headSha: fixHead, prNumber: 7 });
      const fixReceiptPath = yield* corruptReceipt(yeetBaseConflictRowId54);
      const fixSecond = yield* yeetBaseConflictRowId({ generation: 1, headSha: fixHead, prNumber: 7 });
      const repeatMark = yield* consoleMark();
      const repeatPolls = yield* Ref.make(0);
      const repeated = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilReadyPolicy.make({}),
        collectStatus: () =>
          Ref.getAndUpdate(repeatPolls, (n) => n + 1).pipe(
            Effect.map((n) => {
              if (n <= 2) return conflicted(root);
              if (n <= 5) return conflicted(root, fixHead);
              return snapshot(root, { checks: [pendingCheck], sha: fixHead, state: "CLOSED" });
            })
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      strictEqual(repeated, "closed");
      const got55 = yield* Ref.get(repeatPolls);
      strictEqual(got55, 7);
      const conflictRows56 = yield* conflictRows(root);
      expect(A.map(conflictRows56, (row) => row.id)).toStrictEqual([earlier.id, second, fixSecond]);
      const repeatedErrors = (yield* consoleSince(repeatMark)).errors;
      // Once per head and generation: three polls on head A name its corrupt
      // receipt once, and the new head names its own once.
      expect(
        A.filter(repeatedErrors, Str.includes(`[yeet] base-conflict ack receipt ${receiptPath} does not decode`))
      ).toHaveLength(1);
      expect(
        A.filter(
          repeatedErrors,
          Str.includes(
            `[yeet] base-conflict ack receipt ${fixReceiptPath} does not decode; counting conflict generation 0 on head bbbbbbb as consumed`
          )
        )
      ).toHaveLength(1);
      expect(A.filter(repeatedErrors, Str.includes(`${second} carries a wontfix ack receipt`))).toHaveLength(1);
    })
  );

  it.effect("a same-head conflict on a generation acked wontfix writes no row and says why once per head", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const dispatchYeetBaseConflict57 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const earlier = O.getOrThrow(dispatchYeetBaseConflict57);
      yield* ackYeetInboxRow(root, earlier.id, YeetAckWontfixResolution.make({ reason: "base revert pending" }), at);
      const mark = yield* consoleMark();
      const polls = yield* Ref.make(0);
      // Polls 0-1: the conflict on the same head. Its row is closed by another
      // ack kind than cleared, so neither poll writes a row or hands back a wave.
      // Poll 2 reads the pull request closed.
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        attachment: YeetMonitorAttachment.Enum.attached,
        policy: YeetUntilReadyPolicy.make({}),
        waveRerunCommand: "bun run beep yeet monitor --until-ready",
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              n <= 1 ? conflicted(root) : snapshot(root, { checks: [pendingCheck], sha: head, state: "CLOSED" })
            )
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      strictEqual(terminal, "closed");
      const got58 = yield* Ref.get(polls);
      strictEqual(got58, 3);
      const conflictRows59 = yield* conflictRows(root);
      expect(A.map(conflictRows59, (row) => row.id)).toStrictEqual([earlier.id]);
      const yeetBaseConflictGeneration60 = yield* yeetBaseConflictGeneration(root, { headSha: head, prNumber: 7 });
      strictEqual(yeetBaseConflictGeneration60, 0);
      const printed = yield* consoleSince(mark);
      expect(
        A.filter(
          printed.errors,
          Str.includes(
            `[yeet] base conflict on head aaaaaaa raises no new row: ${earlier.id} carries a wontfix ack receipt, not cleared`
          )
        )
      ).toHaveLength(1);
      expect(
        A.filter(printed.errors, Str.includes("[yeet] base conflict with origin/main on head aaaaaaa"))
      ).toHaveLength(0);
    })
  );

  for (const firstRead of ["conflicting", "mergeable"])
    it.effect(
      `a restarted loop whose first read is ${firstRead} recalls the latest generation and clears only it`,
      () =>
        Effect.gen(function* () {
          const root = yield* tempRoot();
          const mark = yield* consoleMark();
          const dispatchYeetBaseConflict61 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
          const first = O.getOrThrow(dispatchYeetBaseConflict61);
          yield* writeEarlierClear(root, first.id);
          const dispatchYeetBaseConflict62 = yield* dispatchYeetBaseConflict(root, capsuleFor(head, 1), at);
          const second = O.getOrThrow(dispatchYeetBaseConflict62);
          // The generation 1 append rebuilt the active index without the acked generation 0.
          const yeetInboxHoldsRow63 = yield* yeetInboxHoldsRow(root, first.id);
          assertFalse(yeetInboxHoldsRow63);
          const polls = yield* Ref.make(0);
          // conflicting: polls 0-1 still read the conflict (the row is already
          // written), poll 2 reads it mergeable. mergeable: poll 0 reads it
          // mergeable at once. Then green with closeout pending; the closeout
          // reread binds it: ready.
          const clearAt = firstRead === "conflicting" ? 2 : 0;
          const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
            ...loopOptions,
            policy: YeetUntilReadyPolicy.make({}),
            collectStatus: () =>
              Ref.getAndUpdate(polls, (n) => n + 1).pipe(
                Effect.map((n) => {
                  if (n < clearAt) return conflicted(root);
                  if (n === clearAt) return mergeablePending(root);
                  return mergeable(root, head, n > clearAt + 1);
                })
              ),
            closeout: () => Effect.succeed(report(head)),
          });
          strictEqual(terminal, "ready");
          const conflictRows64 = yield* conflictRows(root);
          expect(A.map(conflictRows64, (row) => row.id)).toStrictEqual([first.id, second.id]);
          assertSome(
            O.map(
              O.fromNullOr((yield* readYeetAckState(root, second.id)).receipt),
              (receipt) => receipt.resolution.kind
            ),
            "cleared"
          );
          // Generation 0 keeps the earlier monitor's receipt: the loop never rewrote it.
          assertSome(
            O.map(O.fromNullOr((yield* readYeetAckState(root, first.id)).receipt), (receipt) => receipt.ackedAt),
            earlierClear
          );
          const printed = yield* consoleSince(mark);
          expect(A.filter(printed.logs, Str.includes(`row ${second.id} acked cleared`))).toHaveLength(1);
          expect(A.filter(printed.logs, Str.includes(`row ${first.id} acked cleared`))).toHaveLength(0);
          // Only the two seeded dispatches announced a row; the loop wrote none.
          expect(
            A.filter(printed.errors, Str.includes("[yeet] base conflict with origin/main on head aaaaaaa"))
          ).toHaveLength(2);
        }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    );

  it.effect("an until-merged loop writes no base-conflict row", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const polls = yield* Ref.make(0);
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        ...loopOptions,
        policy: YeetUntilMergedPolicy.make({}),
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) =>
              n === 0 ? conflicted(root) : snapshot(root, { checks: [greenCheck], sha: head, state: "MERGED" })
            )
          ),
        closeout: () => Effect.die("unexpected closeout"),
      });
      expect(terminal).toBe("merged");
      const rows65 = yield* rows(root);
      expect(rows65).toStrictEqual([]);
    })
  );
});

// One sample per kit member. Match.exhaustive makes a kit member without a
// sample a type error, so a new resolution kind cannot skip this test.
const sampleResolution = (kind: YeetAckResolutionKind) =>
  Match.value(kind).pipe(
    Match.when("fix-sha", () => YeetAckFixResolution.make({ sha: "2817f28" })),
    Match.when("environment-only", () => YeetAckEnvironmentOnlyResolution.make({ reason: "runner image" })),
    Match.when("wontfix", () => YeetAckWontfixResolution.make({ reason: "flaky infra lane" })),
    Match.when("thread-url", () =>
      YeetAckThreadResolution.make({ url: "https://github.com/beep/repo/pull/7#discussion_r2" })
    ),
    Match.when("waive", () =>
      YeetAckWaiveResolution.make({
        actor: "operator",
        expiresAt: "2999-01-01T00:00:00Z",
        reason: "hosted outage",
        shard: "Security",
      })
    ),
    Match.when("observed", () => YeetAckObservedResolution.make({ via: "inbox-ack" })),
    Match.when("cleared", () =>
      YeetAckClearedResolution.make({
        headSha: head,
        mergeable: "MERGEABLE",
        mergeStateStatus: null,
        jobId: O.none(),
        unit: O.none(),
      })
    ),
    Match.exhaustive
  );

it.layer(platform, { timeout: "30 seconds" })("cleared ack kind", (it) => {
  it.effect("every resolution kind has a union member that round-trips and renders", () =>
    Effect.gen(function* () {
      expect(YeetAckResolutionKind.literals).toContain("cleared");
      expect(A.length(YeetAckResolutionKind.literals)).toBe(7);
      for (const kind of YeetAckResolutionKind.literals) {
        const resolution = sampleResolution(kind);
        expect(resolution.kind).toBe(kind);
        const receipt = YeetAckReceipt.make({ ackedAt: at, id: "row-abc", resolution });
        const line = yield* YeetAckReceiptJson.encode(receipt);
        const decoded66 = yield* YeetAckReceiptJson.decode(line);
        expect(decoded66).toStrictEqual(receipt);
        expect(renderYeetAckResolution(resolution)).not.toBe("");
      }
      expect(renderYeetAckResolution(sampleResolution("cleared"))).toBe(
        "cleared at aaaaaaa (MERGEABLE) by an attached monitor"
      );
    })
  );

  it.effect.prop(
    "round-trips generated ack receipts of every resolution kind",
    [Arbitrary.schema(YeetAckReceipt)],
    Effect.fnUntraced(function* ([receipt]) {
      const line = yield* YeetAckReceiptJson.encode(receipt);
      const argument6 = S.toEquivalence(YeetAckReceipt);
      const decoded10 = yield* YeetAckReceiptJson.decode(line);
      assertTrue(argument6(decoded10, receipt));
      expect(renderYeetAckResolution(receipt.resolution)).not.toBe("");
    }),
    { arbitrary: fcRuns(20) }
  );

  it.effect("admits a cleared receipt only for a base-conflict row", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const failed = YeetFailureCapsule.make({
        bucket: "fail",
        headSha: head,
        lane: "Check",
        link: null,
        observedAt: at,
        prNumber: 7,
        state: "FAILURE",
        workflow: null,
      });
      const failedId = yield* yeetInboxRowId(failed);
      yield* appendYeetInboxRow(
        root,
        YeetCheckFailedRow.make({ capsule: failed, checkout: root, id: failedId, severity: "P0", ts: at })
      );
      const dispatchYeetBaseConflict67 = yield* dispatchYeetBaseConflict(root, capsuleFor(head), at);
      const conflict = O.getOrThrow(dispatchYeetBaseConflict67);
      const cleared = sampleResolution("cleared");
      const refused = yield* ackYeetInboxRow(root, failedId, cleared, at).pipe(Effect.flip);
      expect(refused.message).toBe("A cleared receipt applies only to base-conflict rows; the merge loop writes it.");
      const accepted = yield* ackYeetInboxRow(root, conflict.id, cleared, at);
      expect(accepted.receipt.resolution.kind).toBe("cleared");
    })
  );
});
