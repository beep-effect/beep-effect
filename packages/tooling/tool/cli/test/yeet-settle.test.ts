import { fcRuns } from "@beep/fc-runs";
import { HEAVY_ADMISSION_LABEL, HeavyAdmission } from "@beep/repo-cli/commands/Ci";
import {
  collectYeetStatus,
  deriveSettleVerdict,
  deriveYeetMergeReady,
  GhBranchRule,
  GreptileSummary,
  matchExpectedContexts,
  mergeReadyCriterionHolds,
  PrCloseoutReport,
  RepoRunContext,
  readYeetRulesetRequiredContexts,
  rememberRegistered,
  renderYeetHeadTimeline,
  renderYeetSettleDetail,
  rulesetRequiredContextsFromRules,
  runYeetMonitorUntilMerged,
  YeetExpectedContextCensus,
  YeetExpectedContextInput,
  YeetGatedContextFamily,
  YeetHeadTimeline,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetMonitorExit,
  YeetMonitorLoopPolicy,
  YeetPrMergeReadyRow,
  YeetRulesetRequiredContexts,
  YeetRulesetRulesPayload,
  YeetSettleChanged,
  YeetSettleCheck,
  YeetSettleInput,
  YeetSettleVerdict,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusSnapshotJson,
  YeetStatusWorktree,
  YeetUntilMergedPolicy,
  YeetUntilReadyPolicy,
  yeetBaseConflictFor,
  yeetGatedFamiliesFor,
  yeetHeadTimelineStamp,
  yeetMonitorDurationMillis,
  yeetMonitorPolicyTerminals,
  yeetPushToReadyMillis,
  yeetSettleClockReset,
  yeetSettleSchemasForTesting,
  yeetSettleStampFor,
  yeetSettleVerdictIsHeld,
  yeetSettleVerdictIsTerminal,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Duration, Effect, Fiber, FileSystem, HashSet, Layer, Ref, Result, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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
const admission = (verdict: HeavyAdmission["verdict"], docsOnly = false) =>
  O.some(
    HeavyAdmission.make({
      verdict,
      admitted: verdict === "run",
      sources: verdict === "run" ? ["label"] : [],
      docsOnly,
      changedPathCount: 1,
    })
  );
// Property-test predicates, named so the property body stays flat (fallow CRAP gate).
const expectSettledVerdict = (input: YeetSettleInput, result: YeetSettleVerdict): void => {
  const reason = O.getOrNull(result.reason);
  expect(reason === null || reason === "closeout-pending").toBe(true);
  expect(reason === null).toBe(input.closeoutBound);
};
// Held = hold AND gated is the only open work AND outside the registration window.
const holdWithGatedOpen = (input: YeetSettleInput, result: YeetSettleVerdict): boolean =>
  O.exists(input.admission, (value) => value.verdict === "hold") &&
  A.isReadonlyArrayNonEmpty(result.census.gated) &&
  A.isReadonlyArrayEmpty(result.census.missing) &&
  A.isReadonlyArrayEmpty(result.census.pending) &&
  A.isReadonlyArrayNonEmpty(input.checks) &&
  !(O.isNone(input.expected) && A.isReadonlyArrayEmpty(result.census.matched));
const settleBudgeted = (input: YeetSettleInput, result: YeetSettleVerdict): boolean =>
  A.isReadonlyArrayEmpty(input.checks) ||
  A.isReadonlyArrayNonEmpty(result.census.missing) ||
  (O.isNone(input.expected) && A.isReadonlyArrayEmpty(result.census.matched));
// A base conflict is named first, never spends the budget, and is never terminal.
const expectBaseConflict = (result: YeetSettleVerdict): void => {
  assertSome(result.reason, "base-conflict");
  expect(result.settled).toBe(false);
  expect(result.budgetApplies).toBe(false);
  expect(yeetSettleVerdictIsTerminal(result)).toBe(false);
};
const onlyGatedOpen = (input: YeetSettleInput, result: YeetSettleVerdict): boolean =>
  A.isReadonlyArrayEmpty(result.census.pending) &&
  A.isReadonlyArrayEmpty(result.census.missing) &&
  A.isReadonlyArrayNonEmpty(input.checks);
const heavyContexts = ["Lint", "Heavy / Check", "Heavy / Docgen"];
const heavyFamilies = expected(heavyContexts).pipe(O.getOrThrow, yeetGatedFamiliesFor);
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
  BunCrypto.layer,
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
const snapshot = (
  root: string,
  headSha = "aaa111",
  checks: ReadonlyArray<YeetSettleCheck> = [],
  state = "OPEN",
  labels: ReadonlyArray<string> = [HEAVY_ADMISSION_LABEL]
) =>
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
      labels,
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
    assertNone(O.some<"heavy-not-admitted">("heavy-not-admitted").pipe(yeetSettleStampFor));
  });
  it("names a base conflict first, uncounted and never terminal, and clears on the repaired push", () => {
    const dirty = { expected: expected(["Lint", "Test Unit"]), baseConflict: true, timeoutMs: 1000 };
    // GitHub emptied the rollup: every context reads missing, yet the budget does not apply.
    const conflict = verdict({ ...dirty, waitedMs: 5000 });
    expectBaseConflict(conflict);
    expect(conflict.census.missing).toEqual(["Lint", "Test Unit"]);
    assertNone(conflict.reason.pipe(yeetSettleStampFor));
    expect(renderYeetSettleDetail(conflict)).toBe(
      "settle: base-conflict; merge origin/main and push; waited 5s (not counted toward the 1s settle timeout)"
    );
    // Precedence: a conflict explains an empty rollup better than the registration window.
    assertSome(verdict({ ...dirty, checks: [] }).reason, "base-conflict");
    assertSome(verdict({ ...dirty, checks: [check("Lint", "pending")] }).reason, "base-conflict");
    assertSome(
      verdict({ ...dirty, checks: [check("Lint"), check("Test Unit")], closeoutBound: true }).reason,
      "base-conflict"
    );
    // The same observations with the conflict repaired follow the B7 rule again.
    assertSome(verdict({ ...dirty, baseConflict: false, checks: [], waitedMs: 5000 }).reason, "settle-timeout");
    expect(yeetBaseConflictFor(O.some("CONFLICTING"), O.none())).toBe(true);
    expect(yeetBaseConflictFor(O.some("mergeable"), O.some("dirty"))).toBe(true);
    expect(yeetBaseConflictFor(O.some("MERGEABLE"), O.some("CLEAN"))).toBe(false);
    expect(yeetBaseConflictFor(O.none(), O.none())).toBe(false);
  });
  it("restarts the settle clock only when the budget resumes", () => {
    const withBudget = (budgetApplies: boolean) =>
      YeetSettleVerdict.make({
        settled: false,
        reason: O.some(budgetApplies ? "registration" : "base-conflict"),
        census: YeetExpectedContextCensus.make({ matched: [], unmatched: [], pending: [], missing: ["Lint"] }),
        waitedMs: 9000,
        timeoutMs: 1000,
        budgetApplies,
      });
    expect(yeetSettleClockReset(O.some(withBudget(false)), withBudget(true))).toBe(true);
    expect(yeetSettleClockReset(O.some(withBudget(true)), withBudget(true))).toBe(false);
    expect(yeetSettleClockReset(O.some(withBudget(false)), withBudget(false))).toBe(false);
    expect(yeetSettleClockReset(O.some(withBudget(true)), withBudget(false))).toBe(false);
    expect(yeetSettleClockReset(O.none(), withBudget(true))).toBe(false);
    // The budget also resumes out of a held wait and a registered-but-queued wait.
    const heldVerdict = verdict({
      expected: expected(heavyContexts),
      families: heavyFamilies,
      checks: [check("Lint")],
      admission: admission("hold"),
    });
    const missingVerdict = verdict({ expected: expected(["Lint"]), checks: [check("Docs", "pass", false)] });
    expect(yeetSettleClockReset(O.some(heldVerdict), missingVerdict)).toBe(true);
    expect(yeetSettleClockReset(O.some(verdict({ checks: [check("Lint", "pending")] })), missingVerdict)).toBe(true);
  });
  it("remembers registered contexts and keeps an absent one pending, never missing", () => {
    const first = rememberRegistered(HashSet.empty(), [check("Lint", "pending"), check("Vercel", "pass", false)]);
    expect(first.recalled).toEqual([]);
    expect(first.checks).toEqual([check("Lint", "pending"), check("Vercel", "pass", false)]);
    expect(HashSet.size(first.registered)).toBe(2);
    expect(HashSet.has(first.registered, "Lint") && HashSet.has(first.registered, "Vercel")).toBe(true);
    // The rollup came back empty: both names are recalled as pending, non-required rows.
    const second = rememberRegistered(first.registered, []);
    expect(second.recalled).toEqual(["Lint", "Vercel"]);
    expect(second.checks).toEqual([check("Lint", "pending", false), check("Vercel", "pending", false)]);
    expect(HashSet.size(second.registered)).toBe(2);
    // Under the ruleset census the remembered expected context holds as pending, not missing;
    // a never-registered context stays missing and keeps the budget.
    const recalled = verdict({ expected: expected(["Lint", "Docs"]), checks: second.checks, waitedMs: 500 });
    assertSome(recalled.reason, "required-pending");
    expect(recalled.census.pending).toEqual(["Lint"]);
    expect(recalled.census.missing).toEqual(["Docs"]);
    expect(recalled.budgetApplies).toBe(true);
    assertSome(
      verdict({ expected: expected(["Lint", "Docs"]), checks: second.checks, waitedMs: 5000 }).reason,
      "settle-timeout"
    );
    const onlyRecalled = verdict({ expected: expected(["Lint"]), checks: second.checks, waitedMs: 5000 });
    assertSome(onlyRecalled.reason, "required-pending");
    expect(onlyRecalled.census.missing).toEqual([]);
    expect(onlyRecalled.budgetApplies).toBe(false);
    expect(yeetSettleVerdictIsTerminal(onlyRecalled)).toBe(false);
    // A reported name is never duplicated by its memory.
    const third = rememberRegistered(second.registered, [check("Lint")]);
    expect(third.recalled).toEqual(["Vercel"]);
    expect(A.map(third.checks, (row) => row.name)).toEqual(["Lint", "Vercel"]);
  });
  it("folds gated families out of the expected set", () => {
    expect(heavyFamilies).toEqual([
      YeetGatedContextFamily.make({
        prefix: "Heavy / ",
        admittedBy: HEAVY_ADMISSION_LABEL,
        members: ["Heavy / Check", "Heavy / Docgen"],
      }),
    ]);
    expect(yeetGatedFamiliesFor(O.getOrThrow(expected(["Lint", "Test Unit"])))).toEqual([]);
  });
  it("holds, times out, or settles the heavy family by admission verdict", () => {
    const gated = { expected: expected(heavyContexts), families: heavyFamilies, timeoutMs: 1000 };
    // (1) hold: absent heavy contexts are gated, the wait is named, the budget is not compared.
    const held = verdict({ ...gated, checks: [check("Lint")], admission: admission("hold"), waitedMs: 5000 });
    assertSome(held.reason, "heavy-not-admitted");
    expect(held.settled).toBe(false);
    expect(yeetSettleVerdictIsTerminal(held)).toBe(false);
    expect(yeetSettleVerdictIsHeld(held)).toBe(true);
    expect(held.census).toEqual(
      expect.objectContaining({
        matched: ["Lint"],
        missing: [],
        pending: [],
        gated: ["Heavy / Check", "Heavy / Docgen"],
      })
    );
    expect(renderYeetSettleDetail(held)).toBe(
      "settle: heavy-not-admitted; gated: Heavy / Check, Heavy / Docgen; admit: gh pr edit --add-label ready-for-heavy; waited 5s (not counted toward the 1s settle timeout)"
    );
    // (2) run: B7 exactly — missing, and settle-timeout past the budget.
    const running = verdict({ ...gated, checks: [check("Lint")], admission: admission("run"), waitedMs: 999 });
    assertSome(running.reason, "required-pending");
    expect(running.census.missing).toEqual(["Heavy / Check", "Heavy / Docgen"]);
    expect(running.census.gated).toEqual([]);
    expect(yeetSettleVerdictIsHeld(running)).toBe(false);
    const timedOut = verdict({ ...gated, checks: [check("Lint")], admission: admission("run"), waitedMs: 1000 });
    assertSome(timedOut.reason, "settle-timeout");
    expect(yeetSettleVerdictIsTerminal(timedOut)).toBe(true);
    // No admission at all is the B7 rule too.
    assertSome(verdict({ ...gated, checks: [check("Lint")], waitedMs: 1000 }).reason, "settle-timeout");
    // (3) skip-satisfied: the lanes pass without work on a hosted runner and the head
    // settles; the line says why.
    const skippedInput = {
      ...gated,
      checks: [check("Lint"), check("Heavy / Check"), check("Heavy / Docgen")],
      admission: admission("skip-satisfied", true),
      waitedMs: 5000,
    };
    const skipped = verdict(skippedInput);
    expect(skipped.settled).toBe(true);
    assertSome(skipped.reason, "closeout-pending");
    expect(renderYeetSettleDetail(skipped)).toContain("heavy: docs-only, lanes pass without work");
    // A lane that is still skipped rather than passed settles the same way.
    const skippedLanes = verdict({
      ...skippedInput,
      checks: [check("Lint"), check("Heavy / Check", "skip"), check("Heavy / Docgen", "skip")],
    });
    expect(skippedLanes.settled).toBe(true);
    assertSome(skippedLanes.reason, "closeout-pending");
    const bound = verdict({ ...skippedInput, closeoutBound: true });
    assertNone(bound.reason);
    expect(renderYeetSettleDetail(bound)).toBe(
      "settle: settled; closeout bound; heavy: docs-only, lanes pass without work"
    );
    const skippedPending = verdict({
      ...gated,
      checks: [check("Lint", "pending"), check("Heavy / Check")],
      admission: admission("skip-satisfied", true),
    });
    assertSome(skippedPending.reason, "required-pending");
    expect(renderYeetSettleDetail(skippedPending)).toContain("heavy: docs-only, lanes pass without work");
    // hold with non-gated work still open stays required-pending and names the gate.
    const mixed = verdict({
      ...gated,
      checks: [check("Lint", "pending")],
      admission: admission("hold"),
      waitedMs: 5000,
    });
    assertSome(mixed.reason, "required-pending");
    expect(mixed.census.pending).toEqual(["Lint"]);
    expect(mixed.census.gated).toEqual(["Heavy / Check", "Heavy / Docgen"]);
    expect(yeetSettleVerdictIsTerminal(mixed)).toBe(false);
    // Not held: a non-gated required check is still open, so the B7 rule judges it
    // (registered and queued → GitHub's to time out, the budget does not apply).
    expect(yeetSettleVerdictIsHeld(mixed)).toBe(false);
    expect(mixed.budgetApplies).toBe(false);
    expect(renderYeetSettleDetail(mixed)).toBe(
      "settle: required-pending; pending: Lint; gated: Heavy / Check, Heavy / Docgen; admit: gh pr edit --add-label ready-for-heavy; waited 5s; registered checks are GitHub's to time out"
    );
    // Hold with a non-gated context never registered: it spends the budget and times out,
    // gated or not — the label cannot hide a required context that never came.
    const lintMissing = verdict({
      expected: expected([...heavyContexts, "Docs"]),
      families: heavyFamilies,
      checks: [check("Lint")],
      admission: admission("hold"),
      waitedMs: 1000,
      timeoutMs: 1000,
    });
    assertSome(lintMissing.reason, "settle-timeout");
    expect(lintMissing.census.missing).toEqual(["Docs"]);
    expect(lintMissing.census.gated).toEqual(["Heavy / Check", "Heavy / Docgen"]);
    expect(yeetSettleVerdictIsHeld(lintMissing)).toBe(false);
    expect(yeetSettleVerdictIsTerminal(lintMissing)).toBe(true);
    const lintMissingEarly = verdict({
      expected: expected([...heavyContexts, "Docs"]),
      families: heavyFamilies,
      checks: [check("Lint")],
      admission: admission("hold"),
      waitedMs: 500,
      timeoutMs: 1000,
    });
    assertSome(lintMissingEarly.reason, "required-pending");
    expect(lintMissingEarly.budgetApplies).toBe(true);
    expect(renderYeetSettleDetail(lintMissingEarly)).toContain("waited 500ms of 1s");
    // A pending heavy check or matrix child under hold is gated too, by its member name.
    const stale = verdict({
      ...gated,
      checks: [check("Lint"), check("Heavy / Check", "pending"), check("Heavy / Docgen (a)", "pending", false)],
      admission: admission("hold"),
    });
    assertSome(stale.reason, "heavy-not-admitted");
    expect(stale.census.pending).toEqual([]);
    expect(stale.census.gated).toEqual(["Heavy / Check", "Heavy / Docgen"]);
    // Hold without any gated family is B7: nothing to gate, a missing context still spends the budget.
    const ungated = verdict({
      expected: expected(["Lint", "Docs"]),
      checks: [check("Lint")],
      admission: admission("hold"),
      waitedMs: 1000,
    });
    assertSome(ungated.reason, "settle-timeout");
    expect(yeetSettleVerdictIsHeld(ungated)).toBe(false);
    // Under hold with zero registered checks the head is NOT held: the reason stays
    // registration, the registration budget applies, and past it the head times out
    // (a broken CI that never registers must never hide behind the label).
    const registering = verdict({ ...gated, admission: admission("hold"), waitedMs: 500 });
    assertSome(registering.reason, "registration");
    expect(yeetSettleVerdictIsHeld(registering)).toBe(false);
    expect(renderYeetSettleDetail(registering)).toContain("waited 500ms of 1s");
    const neverRegistered = verdict({ ...gated, admission: admission("hold"), waitedMs: 1000 });
    assertSome(neverRegistered.reason, "settle-timeout");
    expect(yeetSettleVerdictIsTerminal(neverRegistered)).toBe(true);
    expect(yeetSettleVerdictIsHeld(neverRegistered)).toBe(false);
    // Every heavy context reported green under hold: nothing gated, settled as B7.
    const green = verdict({
      ...gated,
      checks: [check("Lint"), check("Heavy / Check"), check("Heavy / Docgen")],
      admission: admission("hold"),
      closeoutBound: true,
    });
    assertNone(green.reason);
    expect(green.census.gated).toEqual([]);
  });
  it.prop(
    "every generated settle input yields a coherent verdict",
    { input: Arbitrary.schema(YeetSettleInput) },
    ({ input }) => {
      const result = deriveSettleVerdict(input);
      expect(result.waitedMs).toBe(input.waitedMs);
      expect(result.timeoutMs).toBe(input.timeoutMs);
      if (input.baseConflict) {
        expectBaseConflict(result);
        return;
      }
      if (result.settled) {
        expectSettledVerdict(input, result);
        return;
      }
      const reason = O.getOrNull(result.reason);
      expect(["registration", "required-pending", "heavy-not-admitted", "settle-timeout"]).toContain(reason);
      const held = yeetSettleVerdictIsHeld(result);
      expect(held).toBe(holdWithGatedOpen(input, result));
      // The budget bounds registration (B7) and never a held head (B8); the
      // gated census is the one the budget reads, since hold moves members out of missing.
      expect(reason === "settle-timeout").toBe(
        !held && input.waitedMs >= input.timeoutMs && settleBudgeted(input, result)
      );
      expect(reason === "heavy-not-admitted").toBe(held && onlyGatedOpen(input, result));
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
      }).pipe(provideScopedLayer(Layer.mergeAll(BunCrypto.layer, spawner(code, output))))
    );
  }
});

it.layer(platform)("B7 merge-loop timing", (layerIt) => {
  layerIt.effect(
    "ends exactly at timeout for an admitted head, persists the timeline, and names the missing context",
    () =>
      temporary((root) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(0);
          const calls = yield* Ref.make(0);
          const reads = yield* Ref.make(0);
          const done = yield* Ref.make(false);
          const program = runYeetMonitorUntilMerged(contextFor(root), {
            collectStatus: () =>
              Ref.update(calls, (n) => n + 1).pipe(Effect.as(snapshot(root, "aaa111", [check("Lint")]))),
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

  layerIt.effect(
    "holds an unlabelled head past the budget, admits on the label within one poll, and reaches ready",
    () =>
      temporary((root) =>
        Effect.gen(function* () {
          yield* TestClock.setTime(0);
          // The layer shares one TestConsole across tests: read only this test's lines.
          const priorLines = A.length(yield* TestConsole.logLines);
          const ownLines = TestConsole.logLines.pipe(
            Effect.map((lines) => A.join(A.map(A.drop(lines, priorLines), String), "\n"))
          );
          const calls = yield* Ref.make(0);
          const closeouts = yield* Ref.make(0);
          const captures = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
          const criteria = (closeoutRun: boolean) =>
            YeetMergeReadyCriteria.make({
              prOpen: true,
              notDraft: true,
              closeoutRun,
              requiredChecksGreen: true,
              threadsResolved: true,
              mergeable: true,
              mergeStateAcceptable: true,
              reviewDecisionAcceptable: true,
              greptileScore: O.none(),
            });
          // Polls 0–2: tier 1 green, no label, heavy absent → held. Poll 3: the label
          // lands and the heavy lanes report → settle → closeout (poll 4 rereads) → ready.
          const fiber = yield* runYeetMonitorUntilMerged(contextFor(root), {
            collectStatus: () =>
              Ref.getAndUpdate(calls, (n) => n + 1).pipe(
                Effect.map((n) => {
                  const labelled = n >= 3;
                  const value = snapshot(
                    root,
                    "aaa111",
                    labelled ? [check("Lint"), check("Heavy / Check"), check("Heavy / Docgen")] : [check("Lint")],
                    "OPEN",
                    labelled ? ["size/M", HEAVY_ADMISSION_LABEL] : ["size/M"]
                  );
                  const ready = criteria(n >= 4);
                  return YeetStatusSnapshot.make({
                    ...value,
                    mergeReady: O.some(
                      YeetMergeReady.make({
                        ready: n >= 4,
                        criteria: ready,
                        failing: A.findFirst(
                          YeetMergeReadyCriterion.Options,
                          (criterion) => !mergeReadyCriterionHolds(ready, criterion)
                        ),
                      })
                    ),
                  });
                })
              ),
            rulesetRead: () => Effect.succeed(expected(heavyContexts)),
            capture: (_command, args) =>
              Ref.update(captures, A.append(args)).pipe(
                Effect.as({
                  exitCode: 0,
                  output: args[0] === "diff" ? "packages/a/src/index.ts\0" : at,
                  truncated: false,
                })
              ),
            closeout: () =>
              Ref.update(closeouts, (n) => n + 1).pipe(
                Effect.as({
                  reportPath: "closeout.json",
                  report: PrCloseoutReport.make({
                    actionableReviewThreadCount: 0,
                    botCommentCount: 0,
                    greptile: GreptileSummary.make({ issueCount: 0, score: "5/5" }),
                    issueCount: 0,
                    issues: [],
                    prNumber: 1,
                    prUrl: "https://github.com/beep/repo/pull/1",
                    reviewedHeadSha: O.some("aaa111"),
                    retriggeredGreptile: false,
                    schemaVersion: "yeet-pr-closeout/v1",
                  }),
                })
              ),
            policy: YeetUntilReadyPolicy.make({ settleTimeoutMs: 50 }),
            pollInterval: Duration.millis(100),
          }).pipe(Effect.forkChild);
          // Three held polls span 200ms against a 50ms budget: a held head never times out,
          // and it sleeps the full interval instead of racing the exhausted budget.
          yield* TestClock.adjust("250 millis");
          expect(yield* Ref.get(calls)).toBe(3);
          const heldLines = yield* ownLines;
          expect(heldLines).toContain(
            "settle: heavy-not-admitted; gated: Heavy / Check, Heavy / Docgen; admit: gh pr edit --add-label ready-for-heavy; waited 200ms (not counted toward the 50ms settle timeout)"
          );
          expect(heldLines).not.toContain("settle-timeout");
          yield* TestClock.adjust("100 millis");
          expect(yield* Fiber.join(fiber)).toBe("ready");
          expect(yield* Ref.get(calls)).toBe(5);
          expect(yield* Ref.get(closeouts)).toBe(1);
          // One merge-base diff and one push-time read per head, never per poll.
          expect(A.map(yield* Ref.get(captures), (args) => args[0])).toEqual(["api", "diff"]);
          const lines = yield* ownLines;
          expect(lines).toContain("[yeet] heavy admission: hold → run");
          // The closeout runs inside the same poll, so the reason moves straight to settled.
          expect(lines).toContain("[yeet] settle: heavy-not-admitted → settled");
          expect(lines).toContain("merge-ready: yes");
          expect(lines).not.toContain("settle-timeout");
          const fs = yield* FileSystem.FileSystem;
          const saved = yield* fs
            .readFileString(`${root}/status.json`)
            .pipe(Effect.flatMap(YeetStatusSnapshotJson.decode));
          const timeline = O.getOrThrow(saved.timeline);
          assertSome(timeline.settledAt, "1970-01-01T00:00:00.300Z");
          assertSome(timeline.readyAt, "1970-01-01T00:00:00.300Z");
          expect(saved.remote.labels).toEqual(["size/M", HEAVY_ADMISSION_LABEL]);
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
        // Two heads × (pushedAt read + merge-base diff): both are once per head.
        expect(yield* Ref.get(captures)).toBe(4);
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

describe("closeout follow-up gate", () => {
  // The closeout collector now raises a blocking pr-review issue for a thread
  // the author resolved that a reviewer has spoken on since, and the live
  // remote counts it as a follow-up. Either one alone keeps merge readiness
  // blocked on threads-resolved, so a follow-up can never be merged over.
  const remoteWith = (followUpThreadCount: number) =>
    YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "PR",
      headSha: O.some("aaa111"),
      checks: [check("Lint")],
      state: "OPEN",
      isDraft: false,
      requiredCheckCount: 1,
      failingRequiredCheckCount: 0,
      pendingRequiredCheckCount: 0,
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      unresolvedReviewThreadCount: 0,
      followUpThreadCount,
      acknowledgedThreadCount: 1,
    });
  const closeoutWith = (issueCount: number) =>
    YeetStatusArtifact.make({
      detail: "PR #1184",
      issueCount,
      path: "pr-closeout.json",
      state: "present",
      reviewedHeadSha: O.some("aaa111"),
    });

  it("blocks threads-resolved on a reviewer follow-up and clears once it is answered", () => {
    const blocked = deriveYeetMergeReady(closeoutWith(1), remoteWith(1));
    expect(O.flatMap(blocked, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));

    // The closeout artifact's own issue count still blocks on its own.
    const artifactOnly = deriveYeetMergeReady(closeoutWith(1), remoteWith(0));
    expect(O.flatMap(artifactOnly, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));

    // Answered: no follow-up left, no closeout issues, and the bot
    // acknowledgement never counted against the merge.
    const answered = deriveYeetMergeReady(closeoutWith(0), remoteWith(0));
    expect(O.flatMap(answered, (value) => value.failing)).toStrictEqual(O.none());
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
                labels: [{ id: "L1", name: "ready-for-heavy", color: "0e8a16" }, { name: "size/M" }],
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
      expect(result.remote.labels).toEqual(["ready-for-heavy", "size/M"]);
      const legacy = yield* decodeStatusRemote({
        available: false,
        checked: false,
        detail: "legacy",
      });
      expect(legacy.checks).toEqual([]);
      expect(legacy.labels).toEqual([]);
    })
  ).pipe(provideScopedLayer(platform))
);

it.effect("status refuses a review-thread page that names itself as its own successor", () =>
  temporary((root) =>
    Effect.gen(function* () {
      const pageReads = yield* Ref.make(0);
      const runner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
        const [first, second] = command.args;
        if (command.command === "git") return Effect.succeed(handle(0, ""));
        if (first === "pr" && second === "view")
          return Effect.succeed(
            handle(
              0,
              JSON.stringify({
                id: "PR_loop",
                number: 1,
                url: "https://github.com/beep/repo/pull/1",
                state: "OPEN",
                mergeable: "MERGEABLE",
                mergeStateStatus: "CLEAN",
                isDraft: false,
                reviewDecision: null,
                headRefOid: "aaa111",
                labels: [],
              })
            )
          );
        if (first === "pr" && second === "checks") return Effect.succeed(handle(0, "[]"));
        // Every page claims a successor at the cursor that was just requested:
        // a loop that trusted it would re-read this page forever.
        if (first === "api")
          return Ref.update(pageReads, (n) => n + 1).pipe(
            Effect.as(
              handle(
                0,
                JSON.stringify({
                  data: {
                    node: {
                      author: { login: "octocat" },
                      reviewThreads: {
                        nodes: [
                          {
                            id: "PRRT_loop",
                            isResolved: false,
                            isOutdated: false,
                            path: "src/a.ts",
                            line: 1,
                            resolvedBy: null,
                            comments: {
                              nodes: [{ author: { __typename: "User", login: "reviewer" }, body: "?", databaseId: 1 }],
                            },
                            latest: {
                              nodes: [{ author: { __typename: "User", login: "reviewer" }, body: "?", databaseId: 1 }],
                            },
                          },
                        ],
                        pageInfo: { hasNextPage: true, endCursor: "same-cursor" },
                      },
                    },
                  },
                })
              )
            )
          );
        return Effect.succeed(handle(0, "[]"));
      });
      const result = yield* collectYeetStatus(contextFor(root), true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner),
        Effect.result
      );
      expect(Result.isFailure(result)).toBe(true);
      expect(Result.isFailure(result) ? result.failure.message : "").toContain("repeated the same GraphQL end cursor");
      // The first page and its claimed successor were read; the third lap never ran.
      expect(yield* Ref.get(pageReads)).toBe(2);
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
