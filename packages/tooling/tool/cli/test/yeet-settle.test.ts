import { fcRuns } from "@beep/fc-runs";
import {
  collectYeetStatus,
  deriveSettleVerdict,
  deriveYeetMergeReady,
  GhBranchRule,
  matchExpectedContexts,
  RepoRunContext,
  readYeetRulesetRequiredContexts,
  renderYeetHeadTimeline,
  renderYeetSettleDetail,
  rulesetRequiredContextsFromRules,
  runYeetMonitorUntilMerged,
  YEET_CENSUS_SUSPECT_MESSAGE,
  YeetCensusRead,
  YeetExpectedContextInput,
  YeetHeadTimeline,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMonitorExit,
  YeetMonitorLoopPolicy,
  YeetPrMergeReadyRow,
  YeetRulesetRequiredContexts,
  YeetRulesetRulesPayload,
  YeetSettleChanged,
  YeetSettleCheck,
  YeetSettleInput,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusSnapshotJson,
  YeetStatusWorktree,
  YeetUntilMergedPolicy,
  YeetUntilReadyPolicy,
  yeetCensusReadIsSuspect,
  yeetHeadTimelineStamp,
  yeetMonitorDurationMillis,
  yeetMonitorPolicyTerminals,
  yeetPushToReadyMillis,
  yeetSettleSchemasForTesting,
  yeetSettleStampFor,
  yeetSettleVerdictIsTerminal,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Duration, Effect, Fiber, FileSystem, HashSet, Layer, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const at = "2026-09-16T00:00:00.000Z";
const decodeBranchRules = S.decodeUnknownEffect(S.Array(GhBranchRule));
const decodeStatusRemote = S.decodeEffect(YeetStatusRemote);
const expected = (contexts: ReadonlyArray<string>) =>
  O.some(
    YeetRulesetRequiredContexts.make({
      base: "main",
      contexts,
      rulesetIds: [10240248],
      readAt: at,
    })
  );
const check = (name: string, outcome: YeetSettleCheck["outcome"] = "pass", required = true) =>
  YeetSettleCheck.make({ name, outcome, required });
const verdict = (values: Partial<YeetSettleInput> = {}) =>
  deriveSettleVerdict(
    YeetSettleInput.make({
      checks: [],
      closeoutBound: false,
      waitedMs: 0,
      timeoutMs: 1000,
      ...values,
    })
  );
const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/settle",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
const handle = (exitCode: number, output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });
const spawner = (exitCode: number, output: string) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
      expect(command.args).toEqual(["api", "repos/{owner}/{repo}/rules/branches/main"]);
      return Effect.succeed(handle(exitCode, output));
    })
  );
const platform = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("unexpected process in stubbed merge loop"))
  )
);
const temporary = Effect.fn("settleTest.temporary")(function* <V, E, R>(use: (root: string) => Effect.Effect<V, E, R>) {
  const text = yield* Ref.make("");
  const fs = FileSystem.makeNoop({
    makeDirectory: () => Effect.void,
    writeFileString: (_path, value) => Ref.set(text, value),
    readFileString: () => Ref.get(text),
  });
  return yield* use("/settle-test").pipe(Effect.provideService(FileSystem.FileSystem, fs));
});
const snapshot = (root: string, headSha = "aaa111", checks: ReadonlyArray<YeetSettleCheck> = [], state = "OPEN") =>
  YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feature/settle",
    head: "HEAD",
    createdAt: at,
    nextCommand: "monitor",
    runId: "feature-settle",
    schemaVersion: "yeet-status/v1",
    statusPath: `${root}/status.json`,
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    closeout: YeetStatusArtifact.make({ detail: "missing", path: "closeout.json", state: "missing" }),
    verdict: YeetStatusArtifact.make({ detail: "missing", path: "verdict.json", state: "missing" }),
    remote: YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "PR",
      headSha: O.some(headSha),
      checks,
      state,
    }),
  });

// Current Effect v4 exposes Arbitrary.schema, replacing the brief's S.toArbitrary.
const roundTrips = Effect.fn("settleTest.roundTrips")(function* <Schema extends S.Constraint>(schema: Schema) {
  const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 24, seed: 7 });
  yield* Effect.forEach(
    values,
    Effect.fnUntraced(function* (value) {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
      expect(yield* S.encodeEffect(schema)(decoded)).toEqual(encoded);
    })
  );
});

describe("B7 settle contracts", () => {
  for (const [name, schema] of Object.entries({
    ...yeetSettleSchemasForTesting,
    YeetMonitorLoopPolicy,
    YeetUntilReadyPolicy,
    YeetMonitorExit,
    YeetHeadTimeline,
    YeetSettleChanged,
    YeetPrMergeReadyRow,
  })) {
    it.effect(`generated ${name} round-trips`, () => roundTrips(schema));
  }
  it.effect("folds 17 contexts, duplicate rules and unrelated pull-request parameters", () =>
    Effect.gen(function* () {
      const contexts = [
        "Heavy / Check",
        "Codegen Drift",
        "Commitlint",
        "Heavy / Docgen",
        "Heavy / Doctest",
        "Knip",
        "Lint",
        "Heavy / Lint Policy",
        "Nix Shell",
        "Professional Desktop IPC Stdio",
        "Repo Sanity",
        "SAST",
        "Secret Scanning",
        "Security",
        "Heavy / Test Integration",
        "Test Unit",
        "JSDoc Ratchet",
      ];
      const rules = yield* decodeBranchRules([
        { type: "pull_request", ruleset_id: 3, parameters: { required_approving_review_count: 0 } },
        {
          type: "required_status_checks",
          ruleset_id: 10240248,
          parameters: { required_status_checks: contexts.map((context) => ({ context })) },
        },
        {
          type: "required_status_checks",
          ruleset_id: 10240248,
          parameters: { required_status_checks: [{ context: "Lint" }, { context: "" }] },
        },
        { type: "required_status_checks" },
      ]);
      const folded = rulesetRequiredContextsFromRules(
        YeetRulesetRulesPayload.make({ base: "main", readAt: at, rules })
      );
      expect(folded.contexts).toHaveLength(17);
      expect(folded.contexts).toEqual([...contexts].sort());
      expect(folded.rulesetIds).toEqual([10240248]);
    })
  );
  it("matches only exact names and matrix children, retaining outside required rows", () => {
    const census = matchExpectedContexts(
      YeetExpectedContextInput.make({
        expected: ["Lint", "Test Unit", "Heavy / Check", "Lint"],
        checks: [
          check("Lint"),
          check("Test Unit (unit-a)", "pending", false),
          check("Heavy / Check Extra", "pass", false),
          check("Vercel", "fail", false),
          check("Outside", "pending"),
        ],
      })
    );
    expect(census).toMatchObject({
      matched: ["Lint"],
      unmatched: ["Test Unit"],
      missing: ["Heavy / Check"],
      pending: ["Outside", "Test Unit (unit-a)"],
    });
    const exact = matchExpectedContexts(
      YeetExpectedContextInput.make({
        expected: ["Test Unit"],
        checks: [check("Test Unit"), check("Test Unit (a)", "pending", false)],
      })
    );
    expect(exact.pending).toEqual([]);
  });
  it("derives every reason, the fallback, and the exact timeout boundary", () => {
    assertSome(verdict().reason, "registration");
    assertSome(verdict({ checks: [check("Vercel", "fail", false)] }).reason, "registration");
    assertSome(verdict({ checks: [check("Lint", "pending")] }).reason, "required-pending");
    assertSome(verdict({ expected: expected(["Heavy / Check"]), checks: [check("Lint")] }).reason, "required-pending");
    assertSome(verdict({ checks: [check("Lint")] }).reason, "closeout-pending");
    assertNone(verdict({ checks: [check("Lint")], closeoutBound: true, waitedMs: 1000 }).reason);
    expect(verdict({ checks: [check("Lint")], waitedMs: 1000 }).settled).toBe(true);
    expect(yeetSettleVerdictIsTerminal(verdict({ waitedMs: 999 }))).toBe(false);
    // Ruling 49: a registered required check that is still queued never trips the budget.
    const queued = verdict({ expected: expected(["Lint"]), checks: [check("Lint", "pending")], waitedMs: 5000 });
    assertSome(queued.reason, "required-pending");
    expect(yeetSettleVerdictIsTerminal(queued)).toBe(false);
    expect(renderYeetSettleDetail(queued)).toContain("registered checks are GitHub's to time out");
    expect(renderYeetSettleDetail(queued)).not.toContain("of 1s");
    const timeout = verdict({
      expected: expected(["Heavy / Check"]),
      checks: [check("Outside", "pending")],
      waitedMs: 1000,
    });
    assertSome(timeout.reason, "settle-timeout");
    expect(yeetSettleVerdictIsTerminal(timeout)).toBe(true);
    expect(renderYeetSettleDetail(timeout)).toContain("Heavy / Check");
    expect(renderYeetSettleDetail(timeout)).toContain("Outside");
    for (const value of [
      verdict(),
      verdict({ checks: [check("Lint", "pending")] }),
      verdict({ checks: [check("Lint")] }),
      verdict({ checks: [check("Lint")], closeoutBound: true }),
    ]) {
      expect(renderYeetSettleDetail(value)).toContain("settle:");
    }
    const matrix = verdict({ expected: expected(["Test Unit"]), checks: [check("Test Unit (a)")] });
    expect(renderYeetSettleDetail(matrix)).toContain("tolerated matrix parents");
    expect(
      renderYeetSettleDetail(
        verdict({ ...matrix, expected: expected(["Test Unit"]), checks: [check("Test Unit (a)")], closeoutBound: true })
      )
    ).toContain("Test Unit");
    assertSome(yeetSettleStampFor(O.none()), "settledAt");
    assertSome(yeetSettleStampFor(O.some("closeout-pending")), "settledAt");
    assertNone(O.some<"registration">("registration").pipe(yeetSettleStampFor));
  });
  it.prop(
    "every generated settle input yields a coherent verdict",
    { input: Arbitrary.schema(YeetSettleInput) },
    ({ input }) => {
      const result = deriveSettleVerdict(input);
      expect(result.waitedMs).toBe(input.waitedMs);
      expect(result.timeoutMs).toBe(input.timeoutMs);
      const reason = O.getOrNull(result.reason);
      if (result.settled) {
        expect(reason === null || reason === "closeout-pending").toBe(true);
        expect(reason === null).toBe(input.closeoutBound);
        return;
      }
      expect(["registration", "required-pending", "settle-timeout"]).toContain(reason);
      const budgeted =
        A.isReadonlyArrayEmpty(input.checks) ||
        A.isReadonlyArrayNonEmpty(result.census.missing) ||
        (O.isNone(input.expected) && A.isReadonlyArrayEmpty(result.census.matched));
      expect(reason === "settle-timeout").toBe(input.waitedMs >= input.timeoutMs && budgeted);
    },
    { arbitrary: fcRuns(40) }
  );
  for (const [value, millis] of [
    ["", 1800000],
    ["30m", 1800000],
    ["1 hour", 3600000],
    ["1h", 3600000],
    ["90s", 90000],
  ] as const) {
    it.effect(`parses duration ${value}`, () =>
      Effect.gen(function* () {
        expect(yield* yeetMonitorDurationMillis(value)).toBe(millis);
      })
    );
  }
  for (const value of ["0s", "x", "-1 seconds", "Infinity"]) {
    it.effect(`rejects duration ${value}`, () =>
      Effect.gen(function* () {
        expect((yield* Effect.result(yeetMonitorDurationMillis(value)))._tag).toBe("Failure");
      })
    );
  }
  for (const [label, code, output] of [
    ["success", 0, '[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"Lint"}]}}]'],
    ["exit", 1, "denied"],
    ["invalid", 0, "{"],
    ["truncated", 0, " ".repeat(3_000_000)],
  ] as const) {
    it.effect(`ruleset reader ${label}`, () =>
      Effect.gen(function* () {
        const result = yield* readYeetRulesetRequiredContexts(contextFor("."));
        if (label === "success") {
          assertSome(
            O.map(result, (value) => value.contexts),
            ["Lint"]
          );
          expect(yield* TestConsole.errorLines).toHaveLength(0);
        } else {
          assertNone(result);
          expect(yield* TestConsole.errorLines).toHaveLength(1);
        }
      }).pipe(provideScopedLayer(spawner(code, output)))
    );
  }
});

it.layer(platform)("B7 merge-loop timing", (layerIt) => {
  layerIt.effect("ends exactly at timeout, persists the head timeline, and names the missing context", () =>
    temporary((root) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(0);
        const calls = yield* Ref.make(0);
        const reads = yield* Ref.make(0);
        const done = yield* Ref.make(false);
        const program = runYeetMonitorUntilMerged(contextFor(root), {
          collectStatus: () => Ref.update(calls, (n) => n + 1).pipe(Effect.as(snapshot(root))),
          rulesetRead: () => Ref.update(reads, (n) => n + 1).pipe(Effect.as(expected(["Heavy / Check"]))),
          capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
          policy: YeetUntilMergedPolicy.make({ settleTimeoutMs: 1000 }),
          pollInterval: Duration.seconds(30),
        }).pipe(Effect.tap(() => Ref.set(done, true)));
        const fiber = yield* Effect.forkChild(program);
        yield* TestClock.adjust("999 millis");
        expect(yield* Ref.get(done)).toBe(false);
        yield* TestClock.adjust("1 millis");
        expect(yield* Fiber.join(fiber)).toBe("settle-timeout");
        expect(yield* Ref.get(calls)).toBe(2);
        expect(yield* Ref.get(reads)).toBe(1);
        const fs = yield* FileSystem.FileSystem;
        const saved = yield* fs
          .readFileString(`${root}/status.json`)
          .pipe(Effect.flatMap(YeetStatusSnapshotJson.decode));
        assertSome(
          O.map(saved.timeline, (timeline) => timeline.headSha),
          "aaa111"
        );
        assertSome(
          O.flatMap(saved.timeline, (timeline) => timeline.pushedAt),
          at
        );
        expect(A.join(A.map(yield* TestConsole.logLines, String), "\n")).toContain("missing: Heavy / Check");
      })
    )
  );

  layerIt.effect("re-reads once for a new head, stamps settled/closeout/ready once, and sweeps only on merge", () =>
    temporary((root) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(0);
        const calls = yield* Ref.make(0);
        const reads = yield* Ref.make(0);
        const captures = yield* Ref.make(0);
        const sweeps = yield* Ref.make(0);
        const criteria = YeetMergeReadyCriteria.make({
          prOpen: true,
          notDraft: true,
          closeoutRun: true,
          requiredChecksGreen: true,
          threadsResolved: true,
          mergeable: true,
          mergeStateAcceptable: true,
          reviewDecisionAcceptable: true,
          greptileScore: O.none(),
        });
        const fiber = yield* runYeetMonitorUntilMerged(contextFor(root), {
          collectStatus: () =>
            Ref.getAndUpdate(calls, (n) => n + 1).pipe(
              Effect.map((n) => {
                const value = snapshot(
                  root,
                  n === 0 ? "aaa111" : "bbb222",
                  [check("Lint")],
                  n === 3 ? "MERGED" : "OPEN"
                );
                return YeetStatusSnapshot.make({
                  ...value,
                  mergeReady: O.some(YeetMergeReady.make({ ready: true, criteria, failing: O.none() })),
                });
              })
            ),
          rulesetRead: () => Ref.update(reads, (n) => n + 1).pipe(Effect.as(expected(["Lint"]))),
          capture: () =>
            Ref.update(captures, (n) => n + 1).pipe(Effect.as({ exitCode: 1, output: "", truncated: false })),
          onMerged: () => Ref.update(sweeps, (n) => n + 1),
          pollInterval: Duration.millis(100),
          policy: YeetUntilMergedPolicy.make({ settleTimeoutMs: 50 }),
        }).pipe(Effect.forkChild);
        yield* TestClock.adjust("300 millis");
        expect(yield* Fiber.join(fiber)).toBe("merged");
        expect(yield* Ref.get(reads)).toBe(2);
        expect(yield* Ref.get(captures)).toBe(2);
        expect(yield* Ref.get(sweeps)).toBe(1);
        const fs = yield* FileSystem.FileSystem;
        const saved = yield* fs
          .readFileString(`${root}/status.json`)
          .pipe(Effect.flatMap(YeetStatusSnapshotJson.decode));
        const timeline = O.getOrThrow(saved.timeline);
        expect(timeline.headSha).toBe("bbb222");
        assertNone(timeline.pushedAt);
        expect(timeline.settledAt).toEqual(timeline.readyAt);
        assertSome(timeline.closeoutAt, "1970-01-01T00:00:00.100Z");
      })
    )
  );

  it("keeps first timeline stamps and renders missing or invalid push times", () => {
    const timeline = YeetHeadTimeline.make({ headSha: "abc", firstObservedAt: at, pushedAt: O.some(at) });
    const stamped = yeetHeadTimelineStamp(timeline, "readyAt", "2026-09-16T00:01:00.000Z");
    expect(yeetHeadTimelineStamp(stamped, "readyAt", at)).toEqual(stamped);
    assertSome(yeetPushToReadyMillis(stamped), 60000);
    expect(renderYeetHeadTimeline(stamped)).toContain("push→ready 1m");
    assertNone(
      yeetPushToReadyMillis(YeetHeadTimeline.make({ ...timeline, pushedAt: O.some("bad"), readyAt: O.some(at) }))
    );
    expect(renderYeetHeadTimeline(timeline)).toContain("unknown");
  });
});

describe("settle policy boundaries", () => {
  it("admits settle timeout under either policy", () => {
    expect(HashSet.has(yeetMonitorPolicyTerminals(YeetUntilMergedPolicy.make({})), "settle-timeout")).toBe(true);
    expect(HashSet.has(yeetMonitorPolicyTerminals(YeetUntilReadyPolicy.make({})), "settle-timeout")).toBe(true);
  });
  it.effect("closes without a head or a ruleset read", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const value = snapshot(root, "aaa111", [], "CLOSED");
        const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
          collectStatus: () =>
            Effect.succeed(
              YeetStatusSnapshot.make({
                ...value,
                remote: YeetStatusRemote.make({ ...value.remote, headSha: O.none() }),
              })
            ),
          rulesetRead: () => Effect.die("no ruleset read without a head"),
        });
        expect(terminal).toBe("closed");
      })
    ).pipe(provideScopedLayer(platform))
  );
});

it.effect("status retains classified checks from the existing two gh views", () =>
  temporary((root) =>
    Effect.gen(function* () {
      const checkReads = yield* Ref.make(0);
      // fallow-ignore-next-line complexity -- Fixture routes git and GitHub command families to fixed census responses.
      const runner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
        const [first, second] = command.args;
        if (command.command === "git") return Effect.succeed(handle(0, ""));
        if (first === "pr" && second === "view")
          return Effect.succeed(
            handle(
              0,
              JSON.stringify({
                id: "PR_settle",
                number: 1,
                url: "https://github.com/beep/repo/pull/1",
                state: "OPEN",
                mergeable: "MERGEABLE",
                mergeStateStatus: "CLEAN",
                isDraft: false,
                reviewDecision: null,
                headRefOid: "aaa111",
              })
            )
          );
        if (first === "pr" && second === "checks")
          return Ref.update(checkReads, (n) => n + 1).pipe(
            Effect.as(
              handle(
                0,
                JSON.stringify(
                  A.contains(command.args, "--required")
                    ? [{ name: "Lint", bucket: "pending", state: "QUEUED" }]
                    : [
                        { name: "Lint", bucket: "pending", state: "QUEUED" },
                        { name: "Vercel", bucket: "fail", state: "FAILURE" },
                      ]
                )
              )
            )
          );
        if (first === "api")
          return Effect.succeed(
            handle(
              0,
              JSON.stringify({
                data: {
                  node: {
                    reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
                  },
                },
              })
            )
          );
        return Effect.succeed(handle(0, "[]"));
      });
      const result = yield* collectYeetStatus(contextFor(root), true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner)
      );
      expect(yield* Ref.get(checkReads)).toBe(2);
      expect(result.remote.checks).toEqual([check("Lint", "pending"), check("Vercel", "fail", false)]);
      expect(result.remote.pendingRequiredCheckCount).toBe(1);
      expect(result.remote.failingOptionalCheckCount).toBe(1);
      const legacy = yield* decodeStatusRemote({
        available: false,
        checked: false,
        detail: "legacy",
      });
      expect(legacy.checks).toEqual([]);
    })
  ).pipe(provideScopedLayer(platform))
);

it.effect("keeps following settled red heads, preserving the one-rerun budget", () =>
  temporary((root) =>
    Effect.gen(function* () {
      const polls = yield* Ref.make(0);
      const reruns = yield* Ref.make(0);
      const runner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
        const [first, second] = command.args;
        if (first === "run" && second === "list")
          return Effect.succeed(
            handle(
              0,
              JSON.stringify([
                { databaseId: 7, headSha: "aaa111", status: "completed", conclusion: "failure", name: "CI" },
              ])
            )
          );
        if (first === "run" && second === "rerun")
          return Ref.update(reruns, (n) => n + 1).pipe(Effect.as(handle(0, "")));
        if (A.contains(command.args, "--log-failed")) return Effect.succeed(handle(0, "Test timed out in 5000ms"));
        if (first === "run" && second === "view")
          return Effect.succeed(
            handle(
              0,
              JSON.stringify({
                jobs: [
                  {
                    databaseId: 991,
                    name: "Lint",
                    status: "completed",
                    conclusion: "failure",
                    steps: [{ name: "Test", conclusion: "failure" }],
                  },
                ],
              })
            )
          );
        return Effect.succeed(handle(0, "invalid commit date"));
      });
      const terminal = yield* runYeetMonitorUntilMerged(contextFor(root), {
        collectStatus: () =>
          Ref.getAndUpdate(polls, (n) => n + 1).pipe(
            Effect.map((n) => {
              const value = snapshot(root, "aaa111", [check("Lint", "fail")], n === 2 ? "CLOSED" : "OPEN");
              const remote = YeetStatusRemote.make({ ...value.remote, failingCheckCount: 1 });
              return YeetStatusSnapshot.make({
                ...value,
                remote,
                mergeReady: deriveYeetMergeReady(
                  YeetStatusArtifact.make({ ...value.closeout, state: "present", reviewedHeadSha: O.some("aaa111") }),
                  remote
                ),
              });
            })
          ),
        rulesetRead: () => Effect.succeedNone,
        pollInterval: Duration.zero,
      }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner));
      expect(terminal).toBe("closed");
      expect(yield* Ref.get(reruns)).toBe(1);
      expect(A.join(A.map(yield* TestConsole.logLines, String), "\n")).toContain("rerun budget spent");
    })
  ).pipe(provideScopedLayer(platform))
);

it.layer(platform)("B7 sleep after a spent registration budget (ruling 49)", (layerIt) => {
  layerIt.effect("keeps the full poll interval while registered required checks are merely queued", () =>
    temporary((root) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(0);
        const calls = yield* Ref.make(0);
        const program = runYeetMonitorUntilMerged(contextFor(root), {
          collectStatus: () =>
            Ref.update(calls, (n) => n + 1).pipe(Effect.as(snapshot(root, "aaa111", [check("Lint", "pending")]))),
          rulesetRead: () => Effect.succeed(expected(["Lint"])),
          capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
          policy: YeetUntilReadyPolicy.make({ settleTimeoutMs: 1000 }),
          pollInterval: Duration.seconds(30),
        });
        const fiber = yield* Effect.forkChild(program);
        yield* TestClock.adjust("1000 millis");
        expect(yield* Ref.get(calls)).toBe(1);
        yield* TestClock.adjust("28999 millis");
        expect(yield* Ref.get(calls)).toBe(1);
        yield* TestClock.adjust("1 millis");
        expect(yield* Ref.get(calls)).toBe(2);
        yield* TestClock.adjust("30 seconds");
        expect(yield* Ref.get(calls)).toBe(3);
        yield* Fiber.interrupt(fiber);
      })
    )
  );
  layerIt.effect("still clamps the sleep to the remaining budget while a context is missing", () =>
    temporary((root) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(0);
        const calls = yield* Ref.make(0);
        const program = runYeetMonitorUntilMerged(contextFor(root), {
          collectStatus: () =>
            Ref.update(calls, (n) => n + 1).pipe(Effect.as(snapshot(root, "aaa111", [check("Lint")]))),
          rulesetRead: () => Effect.succeed(expected(["Lint", "Heavy / Check"])),
          capture: () => Effect.succeed({ exitCode: 0, output: at, truncated: false }),
          policy: YeetUntilReadyPolicy.make({ settleTimeoutMs: 1000 }),
          pollInterval: Duration.seconds(30),
        });
        const fiber = yield* Effect.forkChild(program);
        yield* TestClock.adjust("999 millis");
        expect(yield* Ref.get(calls)).toBe(1);
        yield* TestClock.adjust("1 millis");
        expect(yield* Fiber.join(fiber)).toBe("settle-timeout");
        expect(yield* Ref.get(calls)).toBe(2);
      })
    )
  );
});

describe("yeetCensusReadIsSuspect (ruling 50)", () => {
  it("flags an empty census only after the head's census registered", () => {
    expect(yeetCensusReadIsSuspect(YeetCensusRead.make({ registered: true, checks: [] }))).toBe(true);
    expect(yeetCensusReadIsSuspect(YeetCensusRead.make({ registered: false, checks: [] }))).toBe(false);
    expect(
      yeetCensusReadIsSuspect(
        YeetCensusRead.make({ registered: true, checks: [YeetSettleCheck.make({ name: "Lint", outcome: "pending" })] })
      )
    ).toBe(false);
    expect(Str.startsWith("PR checks read returned no rows")(YEET_CENSUS_SUSPECT_MESSAGE)).toBe(true);
  });
  it.prop(
    "a read with any check, or before registration, is never suspect",
    { read: Arbitrary.schema(YeetCensusRead) },
    ({ read }) => {
      expect(yeetCensusReadIsSuspect(read)).toBe(read.registered && A.isReadonlyArrayEmpty(read.checks));
    }
  );
});
