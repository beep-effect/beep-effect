import { YeetCommandError } from "@beep/repo-cli/commands/Yeet/Yeet.errors";
import {
  AdmissionJournalEvent,
  admissionJournalPath,
  admissionRootFor,
  attemptJournalPathForCheckout,
  ComputeProfileProbe,
  decodeAdmissionJournalEvent,
  makeComputeProfileProbe,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
} from "@beep/repo-cli/test/RepoRun";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import {
  buildYeetEconomicsReport,
  decodeYeetAttemptJournalEvent,
  deriveYeetMergeReady,
  EconomicsScope,
  EconomicsScopeRequest,
  FINAL_CHECK_ATTEMPT_MODE,
  FINAL_CHECK_RECEIPT_DIR,
  FINAL_CHECK_REUSED_STEP_REASON,
  FINAL_CHECK_SUBSET_RECEIPT_DIR,
  FinalCheckGate,
  FinalCheckReceipt,
  FinalCheckStepResult,
  finalCheckAttemptTerminal,
  findFinalCheckRefreshReceipt,
  RepoRunContext,
  readFinalCheckReceipt,
  runYeetFinalCheck,
  runYeetReadyGate,
  SquashCommitlintPass,
  SquashCommitlintReport,
  SquashCommitMessage,
  YeetAttemptFinished,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetEconomicsSource,
  YeetFinalCheckOptions,
  YeetReadyPullRequestRead,
  YeetStatusArtifact,
  YeetStatusRemote,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertInclude, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer, temporaryWorkingDirectory } from "./support/CommandTest.ts";
import { git } from "./support/YeetHeadMove.ts";
import type { YeetAttemptTerminated } from "@beep/repo-cli/test/Yeet";

// MEAS-07: `yeet final-check` journals every run as one attempt in the branch's
// Yeet attempt journal; `yeet ready` keeps reading only the head receipt.

const HEAD = Str.repeat(40)("a");
const BASE = Str.repeat(40)("b");
const RECORDED_AT = "2026-11-12T00:06:00.000Z";
const encodeEventJson = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));

const attempt = YeetAttemptStarted.make({
  schemaVersion: "yeet-attempt-journal/v1",
  _tag: "attempt-started",
  attemptId: UUID.make("7c9f5b1e-2d4a-4f6b-9a8c-000000000071"),
  runId: "main-0123456789ab",
  branch: "main",
  base: "origin/main",
  head: HEAD,
  mode: FINAL_CHECK_ATTEMPT_MODE,
  startedAt: "2026-11-12T00:00:00.000Z",
  resolvedHeadSha: O.some(HEAD),
  envProfile: O.some("local"),
  computeProfile: O.some("workstation"),
});

const step = (
  gate: FinalCheckGate,
  status: FinalCheckStepResult["status"],
  extra: Partial<Pick<FinalCheckStepResult, "durationMs" | "reason">> = {}
) =>
  FinalCheckStepResult.make({
    gate,
    label: `final-check:${gate}`,
    hostedContext: `context for ${gate}`,
    command: `command for ${gate}`,
    status,
    durationMs: 1_000,
    ...extra,
  });

const reused = step("lint", "passed", { durationMs: 0, reason: FINAL_CHECK_REUSED_STEP_REASON });
const passed = step("expectation-rewrite", "passed");
const failed = step("check", "failed", { reason: "exit 2" });
const skipped = step("coverage", "skipped", { durationMs: 0, reason: "hosted CI proves it" });

const receiptWith = (verdict: FinalCheckReceipt["verdict"], steps: ReadonlyArray<FinalCheckStepResult>) =>
  FinalCheckReceipt.make({
    headSha: HEAD,
    mergeBase: BASE,
    base: "origin/main",
    complete: true,
    verdict,
    startedAt: "2026-11-12T00:00:01.000Z",
    finishedAt: "2026-11-12T00:05:59.000Z",
    steps,
    expectationRewrites: [],
  });

const terminal = (
  exit: Exit.Exit<FinalCheckReceipt, YeetCommandError>,
  steps: ReadonlyArray<FinalCheckStepResult>,
  receipt: O.Option<FinalCheckReceipt>,
  failFast = false
) =>
  finalCheckAttemptTerminal({ attempt, exit, steps, receipt, recordedAt: RECORDED_AT, elapsedMs: 360_000, failFast });

// The verdict facts a reader of a finished final-check row relies on.
const verdictFacts = (row: YeetAttemptFinished) => ({
  mode: row.verdict.mode,
  outcome: row.verdict.outcome,
  failureKind: row.verdict.failureKind,
  failedStepId: row.verdict.failedStepId,
  failurePolicy: row.verdict.failurePolicy,
  message: row.verdict.message,
  lanes: A.map(row.verdict.lanes, (lane) => [lane.id, lane.phase, lane.status, lane.durationMs]),
});

describe("final-check attempt terminal rows", () => {
  it("finishes a passing run with one lane per step and the receipt it wrote", () => {
    const receipt = receiptWith("pass", [passed, reused, skipped]);
    const row = terminal(Exit.succeed(receipt), [], O.none());
    assertTrue(row._tag === "attempt-finished");
    deepStrictEqual(verdictFacts(row), {
      mode: "final-check",
      outcome: "success",
      failureKind: undefined,
      failedStepId: undefined,
      failurePolicy: "collect-all",
      message: `yeet final-check pass for ${Str.slice(0, 12)(HEAD)} (merge base ${Str.slice(0, 12)(BASE)})`,
      lanes: [
        ["final-check:expectation-rewrite", "expectation-rewrite", "passed", 1_000],
        ["final-check:lint", "lint", "reused", 0],
        ["final-check:coverage", "coverage", "skipped", 0],
      ],
    });
    assertSome(row.finalCheckReceipt, receipt);
    assertSome(row.verdict.elapsedMs, 360_000);
    assertSome(row.verdict.endedAt, RECORDED_AT);
    assertSome(row.resolvedHeadSha, HEAD);
  });

  it("finishes a red gate as a step exit naming the first failed step", () => {
    const receipt = receiptWith("fail", [passed, failed, skipped]);
    const error = YeetCommandError.make({ message: "yeet final-check failed: final-check:check.", exitCode: 1 });
    const row = terminal(Exit.fail(error), receipt.steps, O.some(receipt), true);
    assertTrue(row._tag === "attempt-finished");
    deepStrictEqual(verdictFacts(row), {
      mode: "final-check",
      outcome: "failure",
      failureKind: "step-exit",
      failedStepId: "final-check:check",
      failurePolicy: "fail-fast",
      message: "yeet final-check failed: final-check:check.",
      lanes: [
        ["final-check:expectation-rewrite", "expectation-rewrite", "passed", 1_000],
        ["final-check:check", "check", "failed", 1_000],
        ["final-check:coverage", "coverage", "skipped", 0],
      ],
    });
    assertSome(row.finalCheckReceipt, receipt);
  });

  it("finishes a refusal before the receipt as a handler error with the steps that ran", () => {
    const error = YeetCommandError.make({ message: "the checkout changed while the gates ran", exitCode: 2 });
    const row = terminal(Exit.fail(error), [passed], O.none());
    assertTrue(row._tag === "attempt-finished");
    expect(row.verdict.failureKind).toBe("handler-error");
    expect(row.verdict.failedStepId).toBeUndefined();
    expect(A.map(row.verdict.lanes, (lane) => lane.id)).toEqual(["final-check:expectation-rewrite"]);
    assertNone(row.finalCheckReceipt);
  });

  it("terminates an interrupt or a defect without a verdict", () => {
    const reasonOf = (row: YeetAttemptFinished | YeetAttemptTerminated) =>
      row._tag === "attempt-terminated" ? O.some(row.reason) : O.none();
    assertSome(reasonOf(terminal(Exit.interrupt(), [passed], O.none())), "interrupted");
    assertSome(reasonOf(terminal(Exit.failCause(Cause.die("boom")), [], O.none())), "unrecorded-failure");
  });

  it.effect("round-trips the receipt through the journal codec; rows without it decode as before", () =>
    Effect.gen(function* () {
      const receipt = receiptWith("pass", [passed]);
      const row = terminal(Exit.succeed(receipt), [], O.none());
      assertTrue(row._tag === "attempt-finished");
      const decoded = yield* encodeEventJson(row).pipe(Effect.flatMap(decodeYeetAttemptJournalEvent));
      assertTrue(decoded._tag === "attempt-finished");
      assertSome(decoded.finalCheckReceipt, receipt);
      const older = YeetAttemptFinished.make({ ...row, finalCheckReceipt: O.none() });
      const olderLine = yield* encodeEventJson(older);
      expect(olderLine).not.toContain("finalCheckReceipt");
      const decodedOlder = yield* decodeYeetAttemptJournalEvent(olderLine);
      assertTrue(decodedOlder._tag === "attempt-finished");
      assertNone(decodedOlder.finalCheckReceipt);
    })
  );
});

// Scratch-repository runs: a workstation profile, no ambient config.
const WORKSTATION = makeComputeProfileProbe({
  constrainedMemoryBytes: () => 0,
  totalMemoryBytes: () => 125 * 1024 ** 3,
  residentBytes: () => 0,
});

// A 7 GiB slice on a 15 GiB host: the dankserver worker profile.
const WORKER = makeComputeProfileProbe({
  constrainedMemoryBytes: () => 7 * 1024 ** 3,
  totalMemoryBytes: () => 15 * 1024 ** 3,
  residentBytes: () => 0,
});

const finalCheck = (
  options: {
    readonly gates?: ReadonlyArray<string>;
    readonly skip?: ReadonlyArray<string>;
    readonly forceLocal?: boolean;
    readonly dryRun?: boolean;
  } = {},
  probe = WORKSTATION
) =>
  runYeetFinalCheck(
    YeetFinalCheckOptions.make({ base: "HEAD~1", gates: [], skip: [], dryRun: false, failFast: false, ...options })
  ).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
    Effect.provideService(ComputeProfileProbe, probe)
  );

// Every gate but the in-process expectation replay skipped with a reason: a
// complete, passing receipt without any subprocess gate.
const SKIP_SUBPROCESS_GATES = A.map(
  A.filter(FinalCheckGate.literals, (gate) => gate !== "expectation-rewrite"),
  (gate) => `${gate}=hosted CI proves it`
);

const commitFile = Effect.fnUntraced(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(`${root}/${file}`), { recursive: true });
  yield* fs.writeFileString(`${root}/${file}`, content);
  yield* git(root, ["add", file]);
  yield* git(root, ["commit", "-q", "-m", `edit ${file}`]);
});

const scratchRepository = Effect.fnUntraced(function* () {
  const root = yield* temporaryWorkingDirectory;
  yield* git(root, ["init", "-q", "-b", "main"]);
  yield* git(root, ["config", "user.name", "Final Check"]);
  yield* git(root, ["config", "user.email", "final-check@example.invalid"]);
  yield* git(root, ["config", "commit.gpgsign", "false"]);
  yield* commitFile(root, ".gitignore", ".beep/\n");
  yield* commitFile(root, "README.md", "base\n");
  yield* commitFile(root, "README.md", "head\n");
  return root;
});

// A one-package workspace whose head commit edits that package's source: the affected coverage
// plan selects exactly @beep/covered, and the root `coverage` script stands in for the real run.
const coverageWorkspace = Effect.fnUntraced(function* () {
  const root = yield* scratchRepository();
  yield* commitFile(
    root,
    "package.json",
    '{"name":"@beep/root","private":true,"workspaces":["packages/*"],"scripts":{"beep":"echo","coverage":"echo"}}\n'
  );
  yield* commitFile(
    root,
    "packages/covered/package.json",
    '{"name":"@beep/covered","private":true,"scripts":{"coverage":"echo"}}\n'
  );
  yield* commitFile(root, "packages/covered/src/index.ts", "export const covered = 1;\n");
  return root;
});

const admissionRoutes = Effect.fnUntraced(function* (runtimeRoot: RuntimeRootChoice) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const admission = yield* admissionJournalPath(admissionRootFor(path, runtimeRoot));
  const text = yield* fs.readFileString(admission);
  const rows = yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) =>
    decodeAdmissionJournalEvent(line)
  );
  return A.filter(rows, AdmissionJournalEvent.guards["admission-routed"]);
});

const decodeReceiptJson = S.decodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));

// The `--gates` subset receipts a head holds, in run order: their ULID names sort by write time.
const subsetReceipts = Effect.fnUntraced(function* (root: string, head: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = `${root}/${FINAL_CHECK_SUBSET_RECEIPT_DIR}/${head}`;
  const files = yield* fs.readDirectory(directory);
  return yield* Effect.forEach(A.sort(files, Order.String), (file) =>
    fs.readFileString(`${directory}/${file}`).pipe(Effect.flatMap(decodeReceiptJson))
  );
});

const journalEvents = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const journal = yield* attemptJournalPathForCheckout(root, "main");
  const text = yield* fs.readFileString(journal);
  return yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) =>
    decodeYeetAttemptJournalEvent(line)
  );
});

// The economics source reads the journals the runs wrote through the real filesystem.
const JournalTestLayer = Layer.provideMerge(YeetEconomicsSource.layer, NodeCommandTestLayer);

const finishedRows = A.filter(YeetAttemptJournalEvent.guards["attempt-finished"]);
const startedRows = A.filter(YeetAttemptJournalEvent.guards["attempt-started"]);

it.layer(JournalTestLayer, { timeout: "60 seconds" })("final-check attempt journal", (it) => {
  it.effect(
    "journals each run with the receipt it wrote, and economics counts the runs beside the comparable modes",
    Effect.fnUntraced(function* () {
      const root = yield* scratchRepository();
      const head = yield* git(root, ["rev-parse", "HEAD"]);

      const passingRun = yield* finalCheck({ skip: SKIP_SUBPROCESS_GATES, forceLocal: true });
      const passing = O.getOrThrow(passingRun);
      expect(passing.complete).toBe(true);
      const red = yield* finalCheck({ gates: ["repo-sanity"] }).pipe(Effect.flip);
      assertInclude(red.message, "yeet final-check failed: final-check:repo-sanity");

      // A dirty tree is refused before the attempt opens: no journal row.
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(`${root}/README.md`, "dirty\n");
      const dirty = yield* finalCheck().pipe(Effect.flip);
      assertInclude(dirty.message, "the tree has uncommitted changes");
      yield* git(root, ["checkout", "--", "README.md"]);

      // A gate that edits a tracked file: the gates ran, no receipt is written.
      yield* commitFile(root, "package.json", '{"scripts":{"beep":"echo drift >> README.md"}}\n');
      const movedHead = yield* git(root, ["rev-parse", "HEAD"]);
      const moved = yield* finalCheck({ gates: ["repo-sanity"] }).pipe(Effect.flip);
      assertInclude(moved.message, "the checkout changed while the gates ran");

      const events = yield* journalEvents(root);
      const starts = startedRows(events);
      const finishes = finishedRows(events);
      expect(A.map(starts, (row) => [row.mode, row.head, O.getOrUndefined(row.forceLocal)])).toEqual([
        ["final-check", head, true],
        ["final-check", head, undefined],
        ["final-check", movedHead, undefined],
      ]);
      assertTrue(A.every(starts, (row) => O.isSome(row.ownerPid) && O.isSome(row.resolvedHeadSha)));
      expect(A.map(finishes, (row) => row.attemptId)).toEqual(A.map(starts, (row) => row.attemptId));
      expect(
        A.map(finishes, (row) => [row.verdict.outcome, row.verdict.failureKind, row.verdict.failedStepId])
      ).toEqual([
        ["success", undefined, undefined],
        ["failure", "step-exit", "final-check:repo-sanity"],
        ["failure", "handler-error", undefined],
      ]);

      // The head receipt still holds the passing complete run; the red subset
      // run wrote its own receipt, and the journal holds both.
      const onHead = yield* readFinalCheckReceipt(root, head);
      assertSome(onHead, passing);
      const subsets = yield* subsetReceipts(root, head);
      expect(A.map(subsets, (receipt) => [receipt.verdict, receipt.complete])).toEqual([["fail", false]]);
      deepStrictEqual(
        A.map(finishes, (row) => row.finalCheckReceipt),
        [O.some(passing), A.head(subsets), O.none()]
      );
      expect(
        A.map(
          A.flatMap(A.drop(finishes, 2), (row) => row.verdict.lanes),
          (lane) => [lane.id, lane.status]
        )
      ).toEqual([["final-check:repo-sanity", "passed"]]);

      // Economics folds the rows as their own mode, outside the comparable
      // red-to-green modes; the red gate is an actionable lane and the moved
      // tree a typed refusal (MEAS-03). The dirty-tree refusal never opened an
      // attempt, so the mode row counts three runs and none of them terminated.
      const journals = yield* YeetEconomicsSource.use((source) =>
        source.read(EconomicsScopeRequest.make({ repoRoot: root, branch: O.some("main"), fleet: false }))
      );
      const report = buildYeetEconomicsReport(
        journals,
        EconomicsScope.make({ kind: "checkout", checkouts: [root], branch: O.some("main") }),
        DateTime.makeUnsafe("2026-11-13T00:00:00.000Z"),
        []
      );
      expect(A.map(report.attempts.all.modeMix, (row) => [row.key, row.count])).toEqual([["final-check", 3]]);
      expect(report.attempts.comparable.modeMix).toEqual([]);
      expect(A.map(report.firstFailure.actionableLaneMix, (row) => [row.key, row.count])).toEqual([
        ["final-check:repo-sanity", 1],
        ["refusal:moved-tree", 1],
      ]);
      expect(A.map(report.attempts.all.classMix, (row) => [row.key, row.count])).toEqual([
        ["red", 2],
        ["green", 1],
      ]);
      expect(
        A.map(report.modeDurations, (row) => [
          row.mode,
          row.attempts,
          row.redAttempts,
          row.terminatedAttempts,
          row.measuredAttempts,
          O.isSome(row.p50ElapsedMs) && O.isSome(row.p95ElapsedMs),
        ])
      ).toEqual([["final-check", 3, 2, 0, 3, true]]);
    })
  );

  it.effect(
    "ready reads the head receipt exactly as before and never the journal",
    Effect.fnUntraced(function* () {
      const root = yield* scratchRepository();
      const head = yield* git(root, ["rev-parse", "HEAD"]);
      const context = RepoRunContext.make({
        base: "HEAD~1",
        branch: "main",
        cwd: root,
        head: "HEAD",
        originalArgv: [],
        packetDir: ".beep/yeet",
        repoRoot: root,
        turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
      });
      const remote = YeetStatusRemote.make({
        available: true,
        checked: true,
        detail: "PR #42 OPEN",
        state: "OPEN",
        number: 42,
        headSha: O.some(head),
        isDraft: true,
        mergeable: "MERGEABLE",
        mergeStateStatus: "DRAFT",
        requiredCheckCount: 3,
        failingRequiredCheckCount: 0,
        pendingRequiredCheckCount: 0,
        unresolvedReviewThreadCount: 0,
      });
      const closeout = YeetStatusArtifact.make({
        detail: "closed",
        issueCount: 0,
        path: "pr-closeout.json",
        state: "present",
        reviewedHeadSha: O.some(head),
      });
      const read = YeetReadyPullRequestRead.make({ remote, mergeReady: deriveYeetMergeReady(closeout, remote) });
      const flips = yield* Ref.make(0);
      // Every dependency but the final-check receipt reader is answered in
      // process; the default reader reads `.beep/yeet/final-check/<head>.json`.
      const ready = runYeetReadyGate(context, {
        read: () => Effect.succeed(read),
        refresh: () => Effect.succeedNone,
        rewriteCarry: () => Effect.succeedNone,
        squashCommitlint: () =>
          Effect.succeed(
            SquashCommitlintReport.make({
              message: SquashCommitMessage.make({ header: "feat(yeet): journal (#42)", body: "" }),
              verdict: SquashCommitlintPass.make({}),
            })
          ),
        recordInherited: () => Effect.void,
        requestReview: () => Effect.succeed("[yeet] reviewer re-request stubbed"),
        findMonitor: () => Effect.succeedNone,
        readAuthor: () => Effect.succeedNone,
        markReady: () => Ref.update(flips, (count) => count + 1),
      });

      const fs = yield* FileSystem.FileSystem;
      const headReceipt = `${root}/${FINAL_CHECK_RECEIPT_DIR}/${head}.json`;
      yield* finalCheck({ skip: SKIP_SUBPROCESS_GATES });
      const complete = yield* fs.readFileString(headReceipt);
      const flipped = yield* ready;
      expect(flipped._tag).toBe("flip");
      const flipsAfterPass = yield* Ref.get(flips);
      expect(flipsAfterPass).toBe(1);

      // A later subset run, red or passing, writes its own receipt: the
      // complete head receipt is byte-for-byte unchanged and still admits the flip.
      yield* finalCheck({ gates: ["repo-sanity"] }).pipe(Effect.flip);
      const passingSubsetRun = yield* finalCheck({ gates: ["expectation-rewrite"] });
      const passingSubset = O.getOrThrow(passingSubsetRun);
      expect([passingSubset.complete, passingSubset.verdict]).toEqual([false, "pass"]);
      const afterSubsets = yield* fs.readFileString(headReceipt);
      expect(afterSubsets).toBe(complete);
      const flippedAgain = yield* ready;
      expect(flippedAgain._tag).toBe("flip");

      // Without the head receipt, a passing subset receipt never admits the flip.
      yield* fs.remove(headReceipt);
      const subsets = yield* subsetReceipts(root, head);
      expect(A.map(subsets, (receipt) => [receipt.complete, receipt.verdict])).toEqual([
        [false, "fail"],
        [false, "pass"],
      ]);
      const missing = yield* ready.pipe(Effect.flip);
      expect(missing).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      assertInclude(missing.message, `no final-check receipt for head ${Str.slice(0, 12)(head)}`);
      const flipsAfterRefusals = yield* Ref.get(flips);
      expect(flipsAfterRefusals).toBe(2);

      const events = yield* journalEvents(root);
      const passingInJournal = A.filter(finishedRows(events), (row) =>
        O.exists(
          row.finalCheckReceipt,
          (receipt) => receipt.headSha === head && receipt.verdict === "pass" && receipt.complete
        )
      );
      expect(A.length(passingInJournal)).toBe(1);
    })
  );

  it.effect(
    "never offers a subset receipt to the refresh rule, and a full run still writes the head receipt",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* scratchRepository();
      const parent = yield* git(root, ["rev-parse", "HEAD"]);
      const subsetRun = yield* finalCheck({ gates: ["expectation-rewrite"] });
      const subset = O.getOrThrow(subsetRun);
      const parentReceipt = yield* readFinalCheckReceipt(root, parent);
      assertNone(parentReceipt);

      // The child's nearest ancestor holds only a subset receipt: no carry candidate.
      yield* commitFile(root, "README.md", "child\n");
      const child = yield* git(root, ["rev-parse", "HEAD"]);
      const carried = yield* findFinalCheckRefreshReceipt(root, child);
      assertNone(carried);

      const fullRun = yield* finalCheck({ skip: SKIP_SUBPROCESS_GATES });
      const full = O.getOrThrow(fullRun);
      expect(full.complete).toBe(true);
      const onChild = yield* readFinalCheckReceipt(root, child);
      assertSome(onChild, full);
      const childSubsets = yield* fs.exists(`${root}/${FINAL_CHECK_SUBSET_RECEIPT_DIR}/${child}`);
      expect(childSubsets).toBe(false);
      const parentSubsets = yield* subsetReceipts(root, parent);
      deepStrictEqual(parentSubsets, [subset]);
    })
  );

  it.effect(
    "a journal that cannot be written is reported and never blocks the receipt",
    Effect.fnUntraced(function* () {
      const root = yield* scratchRepository();
      const head = yield* git(root, ["rev-parse", "HEAD"]);
      const fs = yield* FileSystem.FileSystem;
      // A directory where the journal file belongs: every append fails.
      const journal = yield* attemptJournalPathForCheckout(root, "main");
      yield* fs.makeDirectory(journal, { recursive: true });

      const passingRun = yield* finalCheck({ skip: SKIP_SUBPROCESS_GATES });
      const passing = O.getOrThrow(passingRun);
      const onHead = yield* readFinalCheckReceipt(root, head);
      assertSome(onHead, passing);
      const errorLines = yield* TestConsole.errorLines;
      assertInclude(A.join(A.map(errorLines, String), "\n"), "[yeet] final-check attempt journal not written");
    })
  );

  // goals/compute-profile-gate-routing (2026-11-13 decision "A forced gate on a worker completes
  // serially inside its measured budget or refuses with the reason"): forced coverage over the
  // diff's own package runs one task at a time and its receipt records forceLocal; a gate the worker
  // cannot hold stays with hosted CI; and every routing decision leaves an admission row, because a
  // worker never takes a ticket.
  it.effect(
    "forces coverage serially on a worker, refuses check, and journals each routing decision",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeDir = yield* fs.makeTempDirectoryScoped();
      const runtimeRoot = RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir });
      const root = yield* coverageWorkspace();
      const head = yield* git(root, ["rev-parse", "HEAD"]);

      // docgen carries an operator skip: the operator, not the profile, routed it, so it has no row.
      const options = {
        gates: ["coverage", "check", "docgen"],
        skip: ["docgen=hosted CI proves it"],
        forceLocal: true,
      };
      const planned = yield* finalCheck({ ...options, dryRun: true }, WORKER).pipe(
        provideRuntimeRootForTesting(runtimeRoot)
      );
      assertNone(planned);
      const forced = yield* finalCheck(options, WORKER).pipe(provideRuntimeRootForTesting(runtimeRoot));
      const receipt = O.getOrThrow(forced);
      const probeLines = yield* TestConsole.logLines;
      const unread = A.filter(A.map(probeLines, String), Str.includes("scope probe unavailable"));
      expect(A.filter(unread, Str.includes(root))).toEqual([]);
      expect([receipt.computeProfile, receipt.forceLocal, receipt.verdict, receipt.complete]).toEqual([
        "worker",
        true,
        "pass",
        false,
      ]);
      expect(A.map(receipt.steps, (row) => [row.gate, row.status, row.reason])).toEqual([
        ["check", "skipped", "compute-profile=worker"],
        ["docgen", "skipped", "hosted CI proves it"],
        ["coverage", "passed", undefined],
      ]);
      const coverage = O.getOrThrow(A.findFirst(receipt.steps, (row) => row.gate === "coverage"));
      expect(Str.endsWith("bun run coverage --affected --concurrency=1")(coverage.command)).toBe(true);
      const onHead = yield* readFinalCheckReceipt(root, head);
      assertNone(onHead);
      const written = yield* subsetReceipts(root, head);
      deepStrictEqual(written, [receipt]);
      const logged = yield* TestConsole.logLines;
      const logLines = A.map(logged, String);
      const runsCoverage =
        "[yeet] final-check --force-local on the worker profile runs coverage one task at a time (concurrency 1)";
      const measures =
        "[yeet] final-check --force-local measures coverage for @beep/covered (this diff's affected plan)";
      expect(A.filter(logLines, Str.startsWith("[yeet] final-check --force-local"))).toEqual([
        expect.stringContaining("refused check on the worker profile: the @beep/repo-cli test type-check"),
        runsCoverage,
        measures,
        expect.stringContaining("refused check on the worker profile"),
        runsCoverage,
        measures,
      ]);

      const routed = yield* admissionRoutes(runtimeRoot);
      expect(
        A.map(routed, (row) => [
          O.getOrUndefined(row.gateRoute),
          row.outcome,
          row.computeProfile,
          row.forceLocal,
          row.command,
          row.branch,
          O.isSome(row.attemptId),
        ])
      ).toEqual([
        ["check", "refusal", "worker", true, "bun run beep yeet final-check", "main", true],
        ["coverage", "bypass", "worker", true, "bun run beep yeet final-check", "main", true],
      ]);
      const events = yield* journalEvents(root);
      // Both rows name the forced run's attempt, beside its attempt-journal row.
      const attemptId = O.map(A.last(startedRows(events)), (row) => row.attemptId);
      deepStrictEqual(
        A.map(routed, (row) => row.attemptId),
        [attemptId, attemptId]
      );
    })
  );

  // The mirror: a forced gate the worker refuses runs nothing. Its refusal is an admission row and a
  // skipped step, and the receipt does not claim a forced run.
  it.effect(
    "refuses forced fallow on a worker with its measured reason and records no forced step",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeDir = yield* fs.makeTempDirectoryScoped();
      const runtimeRoot = RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir });
      const root = yield* coverageWorkspace();
      const head = yield* git(root, ["rev-parse", "HEAD"]);

      const refused = yield* finalCheck({ gates: ["fallow"], forceLocal: true }, WORKER).pipe(
        provideRuntimeRootForTesting(runtimeRoot)
      );
      const receipt = O.getOrThrow(refused);
      expect([receipt.computeProfile, receipt.forceLocal, receipt.verdict]).toEqual(["worker", false, "pass"]);
      expect(A.map(receipt.steps, (row) => [row.gate, row.status, row.reason])).toEqual([
        ["fallow", "skipped", "compute-profile=worker"],
      ]);
      const written = yield* subsetReceipts(root, head);
      deepStrictEqual(written, [receipt]);
      const logged = yield* TestConsole.logLines;
      const forcedLines = A.filter(
        A.map(logged, String),
        Str.startsWith("[yeet] final-check --force-local refused fallow")
      );
      expect(forcedLines).toEqual([
        expect.stringMatching(
          /^\[yeet\] final-check --force-local refused fallow on the worker profile: .*523 s.*; push with `bun run beep yeet open --body-file <md>` and let hosted CI prove it$/
        ),
      ]);

      const routed = yield* admissionRoutes(runtimeRoot);
      expect(A.map(routed, (row) => [O.getOrUndefined(row.gateRoute), row.outcome, row.forceLocal])).toEqual([
        ["fallow", "refusal", true],
      ]);
    })
  );

  // The dankserver sequence (goals/compute-profile-gate-routing, 2026-11-13 worker-host acceptance
  // "Host notes"): a refusal run after a forced coverage run on the same head used to replace the
  // forced receipt. Each subset run now keeps its own receipt, in run order.
  it.effect(
    "keeps a forced coverage receipt readable after a refused forced gate runs on the same head",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeDir = yield* fs.makeTempDirectoryScoped();
      const runtimeRoot = RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir });
      const root = yield* coverageWorkspace();
      const head = yield* git(root, ["rev-parse", "HEAD"]);

      const forcedRun = yield* finalCheck({ gates: ["coverage"], forceLocal: true }, WORKER).pipe(
        provideRuntimeRootForTesting(runtimeRoot)
      );
      const forced = O.getOrThrow(forcedRun);
      const refusedRun = yield* finalCheck({ gates: ["fallow"], forceLocal: true }, WORKER).pipe(
        provideRuntimeRootForTesting(runtimeRoot)
      );
      const refused = O.getOrThrow(refusedRun);

      const written = yield* subsetReceipts(root, head);
      deepStrictEqual(written, [forced, refused]);
      expect(
        A.map(written, (receipt) => [
          receipt.forceLocal,
          A.map(receipt.steps, (row) => [row.gate, row.status, row.reason]),
        ])
      ).toEqual([
        [true, [["coverage", "passed", undefined]]],
        [false, [["fallow", "skipped", "compute-profile=worker"]]],
      ]);
      const onHead = yield* readFinalCheckReceipt(root, head);
      assertNone(onHead);
    })
  );
});
