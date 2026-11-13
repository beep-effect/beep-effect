import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { reviewerCheckExternalId } from "@beep/repo-cli/commands/Reviewer";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import {
  decideMergeGate,
  GateTableCommandOptions,
  GateTableReportJson,
  HeadSuiteCheck,
  hiddenRequiredChecks,
  MERGE_GATE_OWNER_HOLD_LABEL,
  MERGE_GATE_S11_DEFAULT_ATTRIBUTION,
  MERGE_GATE_UNBLOCKS_MAIN_LABEL,
  MergeGateBaseEvidence,
  MergeGateBaseRuns,
  MergeGateCheckAtMerge,
  MergeGateCheckRun,
  MergeGateCommandOptions,
  MergeGateHold,
  MergeGateInput,
  MergeGateOptions,
  MergeGateRead,
  MergeGateRunOptions,
  MergeGateTolerance,
  mergeGateGoodConclusion,
  mergeGateRequestsBypass,
  parseMergeGateTolerance,
  provenanceFooterBeforeMergeForTesting,
  RepoRunContext,
  RequiredShadowInput,
  readAuthenticatedMergeGate,
  readMergeGate,
  renderMergeGateDecision,
  runMergeGate,
  runYeetGateTable,
  runYeetGhChecks,
  runYeetMergeGate,
  SHADOWED_REQUIRED_REMEDY,
  SquashCommitlintFail,
  SquashCommitlintOffendingLine,
  SquashCommitlintPass,
  SquashCommitlintReport,
  SquashCommitlintUnavailable,
  SquashCommitMessage,
  YeetReviewWindowElapsed,
  YeetReviewWindowOpen,
  YeetReviewWindowUnknown,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertInclude, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import checkRunsFixture from "./fixtures/yeet-merge-gate/check-runs.json" with { type: "json" };
import checkSuitesFixture from "./fixtures/yeet-merge-gate/check-suites.json" with { type: "json" };
import pullFixture from "./fixtures/yeet-merge-gate/pull.json" with { type: "json" };
import rulesFixture from "./fixtures/yeet-merge-gate/rules.json" with { type: "json" };
import threadsFixture from "./fixtures/yeet-merge-gate/threads.json" with { type: "json" };
import openThreadsFixture from "./fixtures/yeet-merge-gate/threads-open.json" with { type: "json" };
import timelineFixture from "./fixtures/yeet-merge-gate/timeline.json" with { type: "json" };
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import {
  ADMITTED_SUITE,
  admittedSuite,
  CHECK_SUITE,
  checkSuite,
  HEAVY_ADMIT_WORKFLOW,
  LIVE_SUITE,
  liveSuite,
  pr3133Suites,
  SHADOWED_CONTEXTS,
  SKIPPED_RUN,
  SKIPPED_SUITE,
  skippedSuite,
  skippedSuiteChecks,
  suiteOfCheck,
  workflowSuite,
} from "./support/ShadowedSuites.ts";
import { legacyGhAnswer, legacyGhArgs, recordedGithub } from "./support/YeetGithub.ts";
import { rewriteWindowScenario } from "./support/YeetHeadMove.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const encodeJson = flow(S.encodeUnknownResult(UnknownJson), Result.getOrThrow);

// Recorded 2026-10-06 from merged PR #1459 (head 212fe39b4f): 16 required
// contexts on main, all 33 check runs green, one ready_for_review event, the
// head's check suites, zero review threads. No test here talks to GitHub.
const headSha = pullFixture.head.sha;
const requiredContexts = A.flatMap(rulesFixture, (rule) =>
  A.map(rule.parameters.required_status_checks, (check) => check.context)
);
const fixtureRuns = A.map(checkRunsFixture.check_runs, (run) =>
  MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion })
);
const readyAtIso = timelineFixture[0]?.created_at ?? "2026-10-06T08:00:52Z";
const suiteInstants = A.map(checkSuitesFixture.check_suites, (suite) => suite.created_at);
const pushedAtIso = A.sort(suiteInstants, Str.Order)[0] ?? readyAtIso;
const anchoredAt = DateTime.makeUnsafe(pushedAtIso > readyAtIso ? pushedAtIso : readyAtIso);
const windowMs = 20 * 60 * 1000;
const elapsedWindow = YeetReviewWindowElapsed.make({
  anchor: "head-push",
  anchoredAt: DateTime.formatIso(anchoredAt),
  windowMs,
});
const openWindow = YeetReviewWindowOpen.make({
  anchor: "head-push",
  anchoredAt: DateTime.formatIso(anchoredAt),
  remainingMs: 5 * 60 * 1000,
  windowMs,
});
const windowClosed = DateTime.add(anchoredAt, { minutes: 21 });

const squashMessage = SquashCommitMessage.make({ header: `${pullFixture.title} (#${pullFixture.number})`, body: "" });
const squashPass = SquashCommitlintReport.make({ message: squashMessage, verdict: SquashCommitlintPass.make({}) });
const longBullet = `* ${"docs(agent-pool-doctrine): gate the Claude chain Codex step on ordinaryUsageAllowed (review round 2)"}`;
const squashFail = SquashCommitlintReport.make({
  message: SquashCommitMessage.make({ ...squashMessage, body: `* fix(x): one\n\n${longBullet}\n\n---------` }),
  verdict: SquashCommitlintFail.make({
    rules: ["footer-max-line-length"],
    offendingLines: [SquashCommitlintOffendingLine.make({ line: 5, length: 102, text: longBullet })],
  }),
});
const squashUnavailable = SquashCommitlintReport.make({
  message: squashMessage,
  verdict: SquashCommitlintUnavailable.make({ detail: "bunx commitlint could not run: spawn ENOENT" }),
});

// The base evidence: the merge-base commit of base...head and the base tip, with
// their check runs. By default the PR is up to date (one commit) and green, so a
// red on the head is the PR's own unless a test says otherwise.
const mergeBaseSha = "2c1cb448ba000000000000000000000000000000";
const baseTipSha = "7a7a7a7a7a000000000000000000000000000000";
const baseRunId = (id: number) => id - 1_000_000;
const greenBaseRuns = MergeGateBaseRuns.make({
  sha: mergeBaseSha,
  checkRuns: A.map(fixtureRuns, (run) => MergeGateCheckRun.make({ ...run, id: baseRunId(run.id) })),
});
const upToDate = (base: MergeGateBaseRuns) => MergeGateBaseEvidence.make({ mergeBase: base, baseTip: base });
const greenBase = upToDate(greenBaseRuns);
const runsRedOn = (base: MergeGateBaseRuns, names: ReadonlyArray<string>) =>
  MergeGateBaseRuns.make({
    ...base,
    checkRuns: A.map(base.checkRuns, (run) =>
      A.contains(names, run.name) ? MergeGateCheckRun.make({ ...run, conclusion: "failure" }) : run
    ),
  });
// The same checks red on the one base commit: the reds the PR inherited.
const baseRedOn = (...names: ReadonlyArray<string>) => O.some(upToDate(runsRedOn(greenBaseRuns, names)));
const baseRunIdOf = (name: string) => baseRunId(O.getOrThrow(A.findFirst(fixtureRuns, (run) => run.name === name)).id);

const read = (overrides: Partial<Parameters<typeof MergeGateRead.make>[0]> = {}) =>
  MergeGateRead.make({
    prNumber: pullFixture.number,
    title: pullFixture.title,
    headSha,
    draft: false,
    mergeableState: "clean",
    labels: [],
    attributedChecks: [],
    requiredContexts: O.some(requiredContexts),
    checkRuns: fixtureRuns,
    baseRuns: O.some(greenBase),
    window: elapsedWindow,
    unresolvedThreads: O.some(0),
    squashCommitlint: squashPass,
    readAt: windowClosed,
    ...overrides,
  });

const options = (overrides: Partial<Parameters<typeof MergeGateOptions.make>[0]> = {}): MergeGateOptions =>
  MergeGateOptions.make({
    wantSha: Str.slice(0, 10)(headSha),
    now: windowClosed,
    tolerate: [],
    forceWindow: false,
    relaxed: false,
    ...overrides,
  });

const holdReason = (decision: ReturnType<typeof decideMergeGate>) =>
  decision._tag === "hold" ? decision.reason : "merge";

const withRun = (name: string, patch: Partial<{ status: string; conclusion: string | null; id: number }>) =>
  A.map(fixtureRuns, (run) => (run.name === name ? MergeGateCheckRun.make({ ...run, ...patch }) : run));

describe("yeet merge-gate decision", () => {
  it("carries the exact linted header and body into the admitted merge decision", () => {
    const message = SquashCommitMessage.make({ ...squashMessage, body: "* A folded historical subject\ncontinued.\n" });
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ squashCommitlint: SquashCommitlintReport.make({ ...squashPass, message }) }),
        options: options(),
      })
    );
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") {
      expect(decision.commitTitle).toBe(message.header);
      expect(decision.commitMessage).toBe(message.body);
    }
  });

  it("merges the recorded green PR once the window elapsed and threads are zero", () => {
    const decision = decideMergeGate(MergeGateInput.make({ read: read(), options: options() }));
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") {
      expect(decision.headSha).toBe(headSha);
      expect(decision.commitTitle).toBe(`${pullFixture.title} (#${pullFixture.number})`);
      expect(decision.windowAgeSeconds).toBeGreaterThanOrEqual(20 * 60);
      expect(decision.tolerated).toHaveLength(0);
    }
  });

  it("refuses when the head moved since the caller looked", () => {
    expect(
      holdReason(decideMergeGate(MergeGateInput.make({ read: read(), options: options({ wantSha: "0000000000" }) })))
    ).toBe("head-moved");
  });

  it("refuses a draft and a conflicting PR before reading any check", () => {
    expect(holdReason(decideMergeGate(MergeGateInput.make({ read: read({ draft: true }), options: options() })))).toBe(
      "draft"
    );
    expect(
      holdReason(decideMergeGate(MergeGateInput.make({ read: read({ mergeableState: "dirty" }), options: options() })))
    ).toBe("conflicting");
  });

  it("holds an owner-held PR as owner-hold, with every check green", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ labels: ["ready-for-heavy", MERGE_GATE_OWNER_HOLD_LABEL] }),
        options: options(),
      })
    );
    expect(holdReason(decision)).toBe("owner-hold");
    expect(renderMergeGateDecision(decision)).toContain("labelled owner-merge-hold");
  });

  it("holds on squash-commitlint when the predicted squash message fails the repo's commitlint (ep47)", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({ read: read({ squashCommitlint: squashFail }), options: options() })
    );
    expect(holdReason(decision)).toBe("squash-commitlint");
    const line = renderMergeGateDecision(decision);
    expect(line).toMatch(/^#1459 HOLD squash-commitlint: footer-max-line-length at line 5 \(102 chars\): "\* docs/u);
    expect(line).toContain("98 chars or fewer");
  });

  it("holds on squash-commitlint when commitlint gave no verdict, and in relaxed mode too", () => {
    for (const relaxed of [false, true]) {
      const decision = decideMergeGate(
        MergeGateInput.make({ read: read({ squashCommitlint: squashUnavailable }), options: options({ relaxed }) })
      );
      expect(holdReason(decision)).toBe("squash-commitlint");
      expect(renderMergeGateDecision(decision)).toContain("never a pass");
    }
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({ read: read({ squashCommitlint: squashFail }), options: options({ relaxed: true }) })
        )
      )
    ).toBe("squash-commitlint");
  });

  it("the squash-commitlint hold comes after the structural holds and before the checks", () => {
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({ read: read({ squashCommitlint: squashFail, draft: true }), options: options() })
        )
      )
    ).toBe("draft");
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ squashCommitlint: squashFail, checkRuns: withRun("Lint", { conclusion: "failure" }) }),
            options: options(),
          })
        )
      )
    ).toBe("squash-commitlint");
  });

  it("fails closed when the base ruleset could not be read", () => {
    expect(
      holdReason(
        decideMergeGate(MergeGateInput.make({ read: read({ requiredContexts: O.none() }), options: options() }))
      )
    ).toBe("required-contexts-unknown");
  });

  it("fails closed when the ruleset requires no checks, even with no check runs at all", () => {
    for (const checkRuns of [fixtureRuns, []]) {
      const decision = decideMergeGate(
        MergeGateInput.make({ read: read({ requiredContexts: O.some([]), checkRuns }), options: options() })
      );
      expect(holdReason(decision)).toBe("required-contexts-unknown");
      expect(renderMergeGateDecision(decision)).toContain("no CI evidence");
    }
  });

  it("holds while a required context is unregistered, pending, or red", () => {
    const unregistered = A.filter(fixtureRuns, (run) => run.name !== "Lint");
    expect(
      holdReason(decideMergeGate(MergeGateInput.make({ read: read({ checkRuns: unregistered }), options: options() })))
    ).toBe("required-pending");
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ checkRuns: withRun("Lint", { status: "in_progress", conclusion: null }) }),
            options: options(),
          })
        )
      )
    ).toBe("required-pending");
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }),
            options: options(),
          })
        )
      )
    ).toBe("required-red");
  });

  it("reads the newest run per check name so a superseded red does not hold", () => {
    const lint = A.findFirst(fixtureRuns, (run) => run.name === "Lint");
    lint.pipe(O.isSome, assertTrue);
    if (O.isNone(lint)) return;
    const superseded = MergeGateCheckRun.make({ ...lint.value, id: lint.value.id - 1, conclusion: "failure" });
    expect(
      decideMergeGate(
        MergeGateInput.make({ read: read({ checkRuns: A.append(fixtureRuns, superseded) }), options: options() })
      )._tag
    ).toBe("merge");
  });

  it("never tolerates a non-required red or pending check by name alone", () => {
    const coverage = "Heavy / Coverage Regression";
    expect(requiredContexts).not.toContain(coverage);
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ checkRuns: withRun(coverage, { conclusion: "failure" }) }),
            options: options(),
          })
        )
      )
    ).toBe("red");
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ checkRuns: withRun(coverage, { status: "queued", conclusion: null }) }),
            options: options(),
          })
        )
      )
    ).toBe("pending");
  });

  it("merges over an attributed non-required red and echoes the attribution", () => {
    const coverage = "Heavy / Coverage Regression";
    const tolerance = MergeGateTolerance.make({
      check: coverage,
      attribution: "inherited: red on main since 2c1cb448ba",
    });
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: withRun(coverage, { conclusion: "failure" }) }),
        options: options({ tolerate: [tolerance] }),
      })
    );
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") expect(decision.tolerated).toEqual([tolerance]);
    expect(renderMergeGateDecision(decision)).toContain("inherited: red on main since 2c1cb448ba");
  });

  it("an attributed tolerance never covers a required context", () => {
    const tolerance = MergeGateTolerance.make({ check: "Lint", attribution: "flake" });
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }),
            options: options({ tolerate: [tolerance] }),
          })
        )
      )
    ).toBe("required-red");
  });

  it("holds while the review window is open and prints the time left", () => {
    const decision = decideMergeGate(MergeGateInput.make({ read: read({ window: openWindow }), options: options() }));
    expect(holdReason(decision)).toBe("review-window-open");
    expect(renderMergeGateDecision(decision)).toMatch(/min/u);
  });

  it("holds when the review window could not be established", () => {
    const unknown = YeetReviewWindowUnknown.make({ reason: "the timeline could not be read" });
    const decision = decideMergeGate(MergeGateInput.make({ read: read({ window: unknown }), options: options() }));
    expect(holdReason(decision)).toBe("review-window-unknown");
    expect(renderMergeGateDecision(decision)).toContain("timeline could not be read");
  });

  it("the window override merges inside the window but still re-reads threads and never an unknown window", () => {
    expect(
      decideMergeGate(
        MergeGateInput.make({ read: read({ window: openWindow }), options: options({ forceWindow: true }) })
      )._tag
    ).toBe("merge");
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ window: openWindow, unresolvedThreads: O.some(2) }),
            options: options({ forceWindow: true }),
          })
        )
      )
    ).toBe("threads-unresolved");
    const unknown = YeetReviewWindowUnknown.make({ reason: "no check suite yet" });
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({ read: read({ window: unknown }), options: options({ forceWindow: true }) })
        )
      )
    ).toBe("review-window-unknown");
  });

  it("a forced merge over a window with an unparseable anchor reports a zero age", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ window: YeetReviewWindowOpen.make({ ...openWindow, anchoredAt: "not-an-instant" }) }),
        options: options({ forceWindow: true }),
      })
    );
    expect(decision._tag === "merge" ? decision.windowAgeSeconds : -1).toBe(0);
  });

  it("holds when the thread count is unknown", () => {
    expect(
      holdReason(
        decideMergeGate(MergeGateInput.make({ read: read({ unresolvedThreads: O.none() }), options: options() }))
      )
    ).toBe("threads-unknown");
  });

  it("parses --tolerate as <check>=<attribution> and rejects the rest", () => {
    parseMergeGateTolerance("Heavy / Coverage Regression=inherited: main red").pipe(O.isSome, assertTrue);
    assertNone(parseMergeGateTolerance("Heavy / Coverage Regression"));
    assertNone(parseMergeGateTolerance("=no check"));
    assertNone(parseMergeGateTolerance("Lint="));
    const parsed = parseMergeGateTolerance("Vercel - app=rate limited: 'Deployment rate limited - retry in 2 hours'");
    assertSome(
      O.map(parsed, (tolerance) => tolerance.attribution),
      "rate limited: 'Deployment rate limited - retry in 2 hours'"
    );
  });

  it("renders holds and merges as one hand-off line", () => {
    expect(renderMergeGateDecision(MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" }))).toBe(
      "#7 HOLD draft: still draft"
    );
    expect(renderMergeGateDecision(decideMergeGate(MergeGateInput.make({ read: read(), options: options() })))).toMatch(
      /^#1459 GATE-MET at 212fe39b4f/u
    );
  });
});

describe("yeet merge-gate --relaxed decision (S11)", () => {
  const coverage = "Heavy / Coverage Regression";
  const relaxed = (overrides: Partial<MergeGateOptions> = {}) => options({ relaxed: true, ...overrides });
  const atMergeOf = (decision: ReturnType<typeof decideMergeGate>) =>
    decision._tag === "merge" ? decision.atMerge : [];

  it("merges over an inherited required red and records the merge-base evidence as its attribution", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }), baseRuns: baseRedOn("Lint") }),
        options: relaxed(),
      })
    );
    expect(decision._tag).toBe("merge");
    if (decision._tag === "merge") expect(decision.relaxed).toBe(true);
    expect(atMergeOf(decision)).toEqual([
      MergeGateCheckAtMerge.make({
        check: "Lint",
        state: "red",
        required: true,
        attribution: `inherited: run ${baseRunIdOf("Lint")} failure on merge-base 2c1cb448ba`,
      }),
    ]);
  });

  it("records the S11 default for an inherited red the merge-base never ran", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({
          checkRuns: withRun("Lint", { conclusion: "failure" }),
          baseRuns: O.some(upToDate(MergeGateBaseRuns.make({ sha: mergeBaseSha, checkRuns: [] }))),
        }),
        options: relaxed(),
      })
    );
    expect(A.map(atMergeOf(decision), (entry) => entry.attribution)).toEqual([MERGE_GATE_S11_DEFAULT_ATTRIBUTION]);
  });

  it("uses the --tolerate attribution for a required red", () => {
    const attribution = "inherited: red on main since 2c1cb448ba, fix in #1477";
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: withRun("Lint", { conclusion: "failure" }) }),
        options: relaxed({ tolerate: [MergeGateTolerance.make({ check: "Lint", attribution })] }),
      })
    );
    expect(A.map(atMergeOf(decision), (entry) => entry.attribution)).toEqual([attribution]);
  });

  it("records a pending and an unregistered required context as pending", () => {
    const runs = A.filter(
      withRun("Lint", { status: "in_progress", conclusion: null }),
      (run) => run.name !== "Codegen Drift"
    );
    expect(requiredContexts).toContain("Codegen Drift");
    const decision = decideMergeGate(MergeGateInput.make({ read: read({ checkRuns: runs }), options: relaxed() }));
    expect(decision._tag).toBe("merge");
    expect(A.map(atMergeOf(decision), (entry) => [entry.check, entry.state, entry.required])).toEqual([
      ["Codegen Drift", "pending", true],
      ["Lint", "pending", true],
    ]);
  });

  it("orders required checks first, then by name, and keeps optional ones", () => {
    const runs = A.map(withRun(coverage, { conclusion: "failure" }), (run) =>
      run.name === "Lint" ? MergeGateCheckRun.make({ ...run, conclusion: "failure" }) : run
    );
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: runs, baseRuns: baseRedOn("Lint", coverage) }),
        options: relaxed(),
      })
    );
    expect(A.map(atMergeOf(decision), (entry) => [entry.check, entry.required])).toEqual([
      ["Lint", true],
      [coverage, false],
    ]);
  });

  it("still holds when not one required context has run on the head (no CI evidence)", () => {
    const decision = decideMergeGate(MergeGateInput.make({ read: read({ checkRuns: [] }), options: relaxed() }));
    expect(holdReason(decision)).toBe("required-pending");
    if (decision._tag === "hold") expect(decision.detail).toContain("never without CI evidence");
  });

  it("records nothing when every check is green, and nothing outside relaxed mode", () => {
    expect(atMergeOf(decideMergeGate(MergeGateInput.make({ read: read(), options: relaxed() })))).toEqual([]);
    const strict = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: withRun(coverage, { conclusion: "failure" }) }),
        options: options({ tolerate: [MergeGateTolerance.make({ check: coverage, attribution: "inherited" })] }),
      })
    );
    expect(strict._tag === "merge" ? [strict.relaxed, strict.atMerge] : []).toEqual([false, []]);
  });

  it.each([
    ["a moved head", "head-moved", read(), { wantSha: "0000000000" }],
    ["a draft", "draft", read({ draft: true }), {}],
    ["an owner hold", "owner-hold", read({ labels: [MERGE_GATE_OWNER_HOLD_LABEL] }), {}],
    ["a base conflict", "conflicting", read({ mergeableState: "dirty" }), {}],
    ["an unreadable ruleset", "required-contexts-unknown", read({ requiredContexts: O.none() }), {}],
    ["a ruleset with no required checks", "required-contexts-unknown", read({ requiredContexts: O.some([]) }), {}],
    ["an open review window", "review-window-open", read({ window: openWindow }), {}],
    [
      "an unknown review window",
      "review-window-unknown",
      read({ window: YeetReviewWindowUnknown.make({ reason: "not read" }) }),
      {},
    ],
    ["an unresolved thread", "threads-unresolved", read({ unresolvedThreads: O.some(1) }), {}],
    ["an unknown thread count", "threads-unknown", read({ unresolvedThreads: O.none() }), {}],
  ] as const)("still holds on %s", (_name, reason, gateRead, overrides) => {
    const redRead = MergeGateRead.make({
      ...gateRead,
      checkRuns: withRun("Lint", { conclusion: "failure" }),
      baseRuns: baseRedOn("Lint"),
    });
    expect(holdReason(decideMergeGate(MergeGateInput.make({ read: redRead, options: relaxed(overrides) })))).toBe(
      reason
    );
  });

  it("renders a relaxed merge with its reds and pending checks", () => {
    const runs = A.filter(
      A.map(withRun("Lint", { conclusion: "failure" }), (run) =>
        run.name === coverage ? MergeGateCheckRun.make({ ...run, status: "queued", conclusion: null }) : run
      ),
      (run) => run.name !== "Codegen Drift"
    );
    const line = renderMergeGateDecision(
      decideMergeGate(
        MergeGateInput.make({
          read: read({ checkRuns: runs, baseRuns: baseRedOn("Lint") }),
          options: relaxed({ tolerate: [MergeGateTolerance.make({ check: coverage, attribution: "rate limited" })] }),
        })
      )
    );
    expect(line).toMatch(/^#1459 GATE-MET \(S11\) at 212fe39b4f \(window \d+s\)/u);
    expect(line).toContain(
      ` reds at merge: Lint [inherited: run ${baseRunIdOf("Lint")} failure on merge-base 2c1cb448ba]`
    );
    expect(line).toContain(
      ` pending at merge: Codegen Drift [${MERGE_GATE_S11_DEFAULT_ATTRIBUTION}]; ${coverage} [rate limited]`
    );
    expect(line).not.toContain("tolerated:");
  });
});

// 2026-11-02: #2522 (stale schema-catalog shard, Repo Sanity) and #2526
// (repo-cli-3 package-scripts expectations) merged under S11 over reds they
// introduced, each costing an unblocker. The relaxed gate now tells the two apart.
describe("yeet merge-gate --relaxed own versus inherited reds (S11, 2026-11-02)", () => {
  const relaxed = (overrides: Partial<MergeGateOptions> = {}) => options({ relaxed: true, ...overrides });
  const repoSanityRed = withRun("Repo Sanity", { conclusion: "failure" });
  const atMergeOf = (decision: ReturnType<typeof decideMergeGate>) =>
    decision._tag === "merge" ? decision.atMerge : [];

  it("holds on own-red when the required check is green on the merge-base commit", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({ read: read({ checkRuns: repoSanityRed }), options: relaxed() })
    );
    expect(holdReason(decision)).toBe("own-red");
    expect(renderMergeGateDecision(decision)).toBe(
      `#1459 HOLD own-red: Repo Sanity (base run ${baseRunIdOf("Repo Sanity")} green at merge-base 2c1cb448ba)`
    );
    // The orchestrator loop ends on a HOLD whose line names no pending word.
    expect(renderMergeGateDecision(decision)).not.toMatch(/pending|window|not run/iu);
  });

  it("merges over a red inherited from main: red, pending or absent on the merge-base commit", () => {
    const red = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed, baseRuns: baseRedOn("Repo Sanity") }),
        options: relaxed(),
      })
    );
    expect(red._tag).toBe("merge");
    expect(A.map(atMergeOf(red), (entry) => [entry.check, entry.attribution])).toEqual([
      ["Repo Sanity", `inherited: run ${baseRunIdOf("Repo Sanity")} failure on merge-base 2c1cb448ba`],
    ]);
    const pendingBase = MergeGateBaseRuns.make({
      sha: mergeBaseSha,
      checkRuns: A.map(greenBaseRuns.checkRuns, (run) =>
        run.name === "Repo Sanity" ? MergeGateCheckRun.make({ ...run, status: "in_progress", conclusion: null }) : run
      ),
    });
    const pending = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed, baseRuns: O.some(upToDate(pendingBase)) }),
        options: relaxed(),
      })
    );
    expect(A.map(atMergeOf(pending), (entry) => entry.attribution)).toEqual([
      `inherited: run ${baseRunIdOf("Repo Sanity")} in_progress on merge-base 2c1cb448ba`,
    ]);
    const absentBase = MergeGateBaseRuns.make({
      sha: mergeBaseSha,
      checkRuns: A.filter(greenBaseRuns.checkRuns, (run) => run.name !== "Repo Sanity"),
    });
    expect(
      decideMergeGate(
        MergeGateInput.make({
          read: read({ checkRuns: repoSanityRed, baseRuns: O.some(upToDate(absentBase)) }),
          options: relaxed(),
        })
      )._tag
    ).toBe("merge");
  });

  it("names an absent merge-base run when the inherited red has a run only on the base tip", () => {
    const absentBase = MergeGateBaseRuns.make({
      ...greenBaseRuns,
      checkRuns: A.filter(greenBaseRuns.checkRuns, (run) => run.name !== "Repo Sanity"),
    });
    const evidence = MergeGateBaseEvidence.make({
      mergeBase: absentBase,
      baseTip: runsRedOn(MergeGateBaseRuns.make({ ...greenBaseRuns, sha: baseTipSha }), ["Repo Sanity"]),
    });
    const observed = read({ checkRuns: repoSanityRed, baseRuns: O.some(evidence) });
    const decision = decideMergeGate(MergeGateInput.make({ read: observed, options: relaxed() }));
    expect(decision._tag).toBe("merge");
    expect(A.map(atMergeOf(decision), (entry) => entry.attribution)).toEqual([
      `inherited: no run on merge-base 2c1cb448ba; run ${baseRunIdOf("Repo Sanity")} failure on base tip 7a7a7a7a7a`,
    ]);
    expect(holdReason(decideMergeGate(MergeGateInput.make({ read: observed, options: options() })))).toBe(
      "required-red"
    );
  });

  it("describes a completed base run without a conclusion without treating it as a strict pass", () => {
    const unconcluded = MergeGateBaseRuns.make({
      ...greenBaseRuns,
      checkRuns: A.map(greenBaseRuns.checkRuns, (run) =>
        run.name === "Repo Sanity" ? MergeGateCheckRun.make({ ...run, status: "completed", conclusion: null }) : run
      ),
    });
    const observed = read({ checkRuns: repoSanityRed, baseRuns: O.some(upToDate(unconcluded)) });
    const decision = decideMergeGate(MergeGateInput.make({ read: observed, options: relaxed() }));
    expect(decision._tag).toBe("merge");
    expect(A.map(atMergeOf(decision), (entry) => entry.attribution)).toEqual([
      `inherited: run ${baseRunIdOf("Repo Sanity")} without conclusion on merge-base 2c1cb448ba`,
    ]);
    expect(holdReason(decideMergeGate(MergeGateInput.make({ read: observed, options: options() })))).toBe(
      "required-red"
    );
  });

  // Hosted CI tests the head on the base tip, so a PR behind its base is judged on both commits.
  it("behind its base, a red is inherited only when the check is not green on the merge-base nor on the base tip", () => {
    const tipGreen = MergeGateBaseRuns.make({ ...greenBaseRuns, sha: baseTipSha });
    const redOnMergeBaseOnly = MergeGateBaseEvidence.make({
      mergeBase: runsRedOn(greenBaseRuns, ["Repo Sanity"]),
      baseTip: tipGreen,
    });
    const fixedOnMain = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed, baseRuns: O.some(redOnMergeBaseOnly) }),
        options: relaxed(),
      })
    );
    expect(holdReason(fixedOnMain)).toBe("own-red");
    if (fixedOnMain._tag === "hold") {
      expect(fixedOnMain.detail).toBe(
        `Repo Sanity (base run ${baseRunIdOf("Repo Sanity")} green at base tip 7a7a7a7a7a)`
      );
    }
    const redOnTipOnly = MergeGateBaseEvidence.make({
      mergeBase: greenBaseRuns,
      baseTip: runsRedOn(tipGreen, ["Repo Sanity"]),
    });
    const brokeLater = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed, baseRuns: O.some(redOnTipOnly) }),
        options: relaxed(),
      })
    );
    expect(holdReason(brokeLater)).toBe("own-red");
    if (brokeLater._tag === "hold") {
      expect(brokeLater.detail).toBe(
        `Repo Sanity (base run ${baseRunIdOf("Repo Sanity")} green at merge-base 2c1cb448ba)`
      );
    }
    const redOnBoth = MergeGateBaseEvidence.make({
      mergeBase: runsRedOn(greenBaseRuns, ["Repo Sanity"]),
      baseTip: runsRedOn(tipGreen, ["Repo Sanity"]),
    });
    const inherited = decideMergeGate(
      MergeGateInput.make({ read: read({ checkRuns: repoSanityRed, baseRuns: O.some(redOnBoth) }), options: relaxed() })
    );
    expect(A.map(atMergeOf(inherited), (entry) => entry.attribution)).toEqual([
      `inherited: run ${baseRunIdOf("Repo Sanity")} failure on merge-base 2c1cb448ba; run ${baseRunIdOf("Repo Sanity")} failure on base tip 7a7a7a7a7a`,
    ]);
    // A base tip still running does not open a window: the merge-base must be red too.
    const tipPending = MergeGateBaseEvidence.make({
      mergeBase: runsRedOn(greenBaseRuns, ["Repo Sanity"]),
      baseTip: MergeGateBaseRuns.make({
        sha: baseTipSha,
        checkRuns: A.map(greenBaseRuns.checkRuns, (run) =>
          run.name === "Repo Sanity" ? MergeGateCheckRun.make({ ...run, status: "queued", conclusion: null }) : run
        ),
      }),
    });
    expect(
      decideMergeGate(
        MergeGateInput.make({
          read: read({ checkRuns: repoSanityRed, baseRuns: O.some(tipPending) }),
          options: relaxed(),
        })
      )._tag
    ).toBe("merge");
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({
              checkRuns: repoSanityRed,
              baseRuns: O.some(MergeGateBaseEvidence.make({ mergeBase: greenBaseRuns, baseTip: tipPending.baseTip })),
            }),
            options: relaxed(),
          })
        )
      )
    ).toBe("own-red");
  });

  it("merges an unblocks-main PR over every red, the PR's own included", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed, labels: ["ready-for-heavy", MERGE_GATE_UNBLOCKS_MAIN_LABEL] }),
        options: relaxed(),
      })
    );
    expect(decision._tag).toBe("merge");
    expect(A.map(atMergeOf(decision), (entry) => entry.attribution)).toEqual([
      "inherited: unblocks-main PR, the fix for a red main",
    ]);
  });

  it("an attributed red merges: --tolerate names it, or the PR body's Inherited reds (S11) section does", () => {
    const tolerated = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed }),
        options: relaxed({
          tolerate: [MergeGateTolerance.make({ check: "Repo Sanity", attribution: "fix in #2530" })],
        }),
      })
    );
    expect(A.map(atMergeOf(tolerated), (entry) => entry.attribution)).toEqual(["fix in #2530"]);
    const recorded = decideMergeGate(
      MergeGateInput.make({
        read: read({ checkRuns: repoSanityRed, attributedChecks: ["Repo Sanity"] }),
        options: relaxed(),
      })
    );
    expect(A.map(atMergeOf(recorded), (entry) => entry.attribution)).toEqual([
      'inherited: attributed in the PR body ("Inherited reds (S11)")',
    ]);
  });

  it("holds an unattributed red on base-runs-unknown when the merge-base could not be read", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({ read: read({ checkRuns: repoSanityRed, baseRuns: O.none() }), options: relaxed() })
    );
    expect(holdReason(decision)).toBe("base-runs-unknown");
    expect(renderMergeGateDecision(decision)).toContain("base check runs unreadable for Repo Sanity");
    // Attributed reds, and green heads, never need the base.
    expect(
      decideMergeGate(
        MergeGateInput.make({
          read: read({ checkRuns: repoSanityRed, baseRuns: O.none(), attributedChecks: ["Repo Sanity"] }),
          options: relaxed(),
        })
      )._tag
    ).toBe("merge");
    expect(decideMergeGate(MergeGateInput.make({ read: read({ baseRuns: O.none() }), options: relaxed() }))._tag).toBe(
      "merge"
    );
  });

  it("names every own red and ignores optional, pending and inherited ones", () => {
    const runs = A.map(repoSanityRed, (run) =>
      run.name === "Lint" || run.name === "Heavy / Coverage Regression"
        ? MergeGateCheckRun.make({ ...run, conclusion: "failure" })
        : run.name === "Codegen Drift"
          ? MergeGateCheckRun.make({ ...run, status: "in_progress", conclusion: null })
          : run
    );
    const decision = decideMergeGate(
      MergeGateInput.make({ read: read({ checkRuns: runs, baseRuns: baseRedOn("Lint") }), options: relaxed() })
    );
    expect(holdReason(decision)).toBe("own-red");
    if (decision._tag === "hold") {
      expect(decision.detail).toBe(
        `Repo Sanity (base run ${baseRunIdOf("Repo Sanity")} green at merge-base 2c1cb448ba)`
      );
    }
  });

  it("the strict gate is unchanged: a required red holds as required-red whatever the base says", () => {
    expect(
      holdReason(
        decideMergeGate(
          MergeGateInput.make({
            read: read({ checkRuns: repoSanityRed, baseRuns: baseRedOn("Repo Sanity") }),
            options: options(),
          })
        )
      )
    ).toBe("required-red");
  });
});

// #3133 (2026-11-12): a later label's Heavy Admit run skipped, so the ruleset read the
// heavy checks the earlier run reported as "expected" while the gate read them green.
describe("yeet merge-gate shadowed required checks (#3133)", () => {
  // The recorded #1459 head, each run tagged with the suite it reported into on #3133, plus the
  // skipped run's two jobs.
  const suiteRuns = (suiteOf: (name: string) => O.Option<number>) => [
    ...A.map(fixtureRuns, (run) => MergeGateCheckRun.make({ ...run, checkSuiteId: suiteOf(run.name) })),
    ...A.map(skippedSuiteChecks, ({ id, name }) =>
      MergeGateCheckRun.make({
        id,
        name,
        status: "completed",
        conclusion: "skipped",
        checkSuiteId: O.some(SKIPPED_SUITE),
      })
    ),
  ];
  const pr3133Runs = suiteRuns(flow(suiteOfCheck, O.some));
  const shadowRead = (overrides: Partial<Parameters<typeof MergeGateRead.make>[0]> = {}) =>
    read({ checkRuns: pr3133Runs, workflowSuites: pr3133Suites, ...overrides });
  const decide = (observed: MergeGateRead, relaxed = false) =>
    decideMergeGate(MergeGateInput.make({ read: observed, options: options({ relaxed }) }));
  const hiddenOf = (observed: MergeGateRead) =>
    hiddenRequiredChecks(
      RequiredShadowInput.make({
        requiredContexts: requiredContexts,
        checks: A.map(observed.checkRuns, (run) =>
          HeadSuiteCheck.make({
            id: run.id,
            name: run.name,
            checkSuiteId: run.checkSuiteId,
            verdict: run.status !== "completed" ? "pending" : mergeGateGoodConclusion(run.conclusion) ? "green" : "red",
            conclusion: O.fromNullishOr(run.conclusion),
          })
        ),
        suites: observed.workflowSuites,
      })
    );
  const replaced = `replaced by newer ${HEAVY_ADMIT_WORKFLOW} pull_request run ${SKIPPED_RUN} (skipped)`;

  it("names the three heavy checks green only in the replaced suite, and nothing else", () => {
    const shadowed = hiddenOf(shadowRead());
    expect(A.map(shadowed, (entry) => entry.context)).toEqual(SHADOWED_CONTEXTS);
    expect(A.dedupe(A.map(shadowed, (entry) => entry.state))).toEqual(["shadowed"]);
    expect(A.dedupe(A.map(shadowed, (entry) => entry.hiddenIn.checkSuiteId))).toEqual([ADMITTED_SUITE]);
    expect(A.dedupe(A.map(shadowed, (entry) => entry.replacedBy.runId))).toEqual([SKIPPED_RUN]);
    assertSome(A.head(A.map(shadowed, (entry) => entry.replacedBy.conclusion)), O.some("skipped"));
  });

  it("strict: holds required-shadowed naming the checks, the replacing run and the remedy", () => {
    const decision = decide(shadowRead());
    expect(holdReason(decision)).toBe("required-shadowed");
    expect(renderMergeGateDecision(decision)).toBe(
      `#${pullFixture.number} HOLD required-shadowed: required context(s) the ruleset reads as expected: ` +
        `Heavy / Check, Heavy / Docgen, Heavy / Doctest passed only in check suite ${ADMITTED_SUITE}, ${replaced}; ` +
        SHADOWED_REQUIRED_REMEDY
    );
  });

  it("relaxed: merges with every shadowed check attributed and asks for the rules bypass", () => {
    const tolerated = MergeGateTolerance.make({ check: "Heavy / Docgen", attribution: "re-applied in #3135" });
    const decision = decideMergeGate(
      MergeGateInput.make({ read: shadowRead(), options: options({ relaxed: true, tolerate: [tolerated] }) })
    );
    expect(decision._tag).toBe("merge");
    if (decision._tag !== "merge") return;
    const evidence = `shadowed: passed in check suite ${ADMITTED_SUITE}; newer ${HEAVY_ADMIT_WORKFLOW} pull_request run ${SKIPPED_RUN} (skipped) replaced it, so the ruleset reads it as expected`;
    expect(A.map(decision.atMerge, (entry) => [entry.check, entry.state, entry.required, entry.attribution])).toEqual([
      ["Heavy / Check", "shadowed", true, evidence],
      ["Heavy / Docgen", "shadowed", true, "re-applied in #3135"],
      ["Heavy / Doctest", "shadowed", true, evidence],
    ]);
    expect(mergeGateRequestsBypass(decision)).toBe(true);
    assertInclude(renderMergeGateDecision(decision), `GATE-MET (S11)`);
    assertInclude(renderMergeGateDecision(decision), `shadowed at merge: Heavy / Check [${evidence}]`);
  });

  it("one admitted Heavy Admit run only: no hold", () => {
    const observed = shadowRead({
      checkRuns: A.take(pr3133Runs, A.length(fixtureRuns)),
      workflowSuites: [checkSuite, admittedSuite],
    });
    expect(hiddenOf(observed)).toEqual([]);
    expect(decide(observed)._tag).toBe("merge");
  });

  // The heavy checks with one conclusion, all reported into `suite`, ids from `firstId`.
  const heavyRuns = (conclusion: string, suite: number, firstId: number) =>
    A.map(SHADOWED_CONTEXTS, (name, index) =>
      MergeGateCheckRun.make({
        id: firstId + index,
        name,
        status: "completed",
        conclusion,
        checkSuiteId: O.some(suite),
      })
    );

  it("a newer successful run that re-reports the checks: no hold", () => {
    // `skipped` is how a re-report (heavy.yml called with `admitted: false`) reports each lane.
    for (const conclusion of ["success", "skipped"]) {
      const observed = shadowRead({
        checkRuns: [...pr3133Runs, ...heavyRuns(conclusion, LIVE_SUITE, 112231400000)],
        workflowSuites: [...pr3133Suites, liveSuite],
      });
      expect(hiddenOf(observed)).toEqual([]);
      expect(decide(observed)._tag).toBe("merge");
    }
  });

  // rerun-runner-loss re-ran the admitted run after a later run reported the heavy checks: the
  // re-run keeps the older created_at, so its suite stays replaced while its check runs take ids
  // above the live suite's. The gate judges the live run, as the ruleset does.
  const rerunRead = (live: string, copy: string) =>
    shadowRead({
      checkRuns: [
        ...pr3133Runs,
        ...heavyRuns(live, LIVE_SUITE, 112231400000),
        ...heavyRuns(copy, ADMITTED_SUITE, 112231500000),
      ],
      workflowSuites: [...pr3133Suites, liveSuite],
    });

  it("(a) a red copy in a replaced suite, re-run with higher ids, never holds the green live run", () => {
    const observed = rerunRead("success", "failure");
    expect(hiddenOf(observed)).toEqual([]);
    expect(decide(observed)._tag).toBe("merge");
    const relaxed = decide(observed, true);
    expect(relaxed._tag).toBe("merge");
    if (relaxed._tag !== "merge") return;
    expect(relaxed.atMerge).toEqual([]);
    expect(mergeGateRequestsBypass(relaxed)).toBe(false);
  });

  it("(b) a green copy in a replaced suite, re-run with higher ids, never hides the red live run", () => {
    const observed = rerunRead("failure", "success");
    expect(hiddenOf(observed)).toEqual([]);
    const strict = decide(observed);
    expect(holdReason(strict)).toBe("required-red");
    for (const context of SHADOWED_CONTEXTS) assertInclude(renderMergeGateDecision(strict), context);
    // Relaxed mode gets the own-red check (green on the merge-base), so it holds: no merge, no bypass.
    const relaxed = decide(observed, true);
    expect(holdReason(relaxed)).toBe("own-red");
    assertInclude(renderMergeGateDecision(relaxed), `Heavy / Check (base run ${baseRunIdOf("Heavy / Check")} green`);
  });

  it("a newer run still going holds as required-pending, not as a remedy to apply", () => {
    const running = workflowSuite({
      runId: SKIPPED_RUN,
      checkSuiteId: SKIPPED_SUITE,
      createdAt: DateTime.makeUnsafe("2026-11-12T23:28:51Z"),
      status: "in_progress",
      conclusion: O.none(),
    });
    const decision = decide(shadowRead({ workflowSuites: [checkSuite, admittedSuite, running] }));
    expect(holdReason(decision)).toBe("required-pending");
    assertInclude(renderMergeGateDecision(decision), `run ${SKIPPED_RUN} (still in_progress)`);
  });

  it("a red newest run is reported red, not shadowed", () => {
    const red = MergeGateCheckRun.make({
      id: 112231300003,
      name: "Heavy / Check",
      status: "completed",
      conclusion: "failure",
      checkSuiteId: O.some(SKIPPED_SUITE),
    });
    const observed = shadowRead({ checkRuns: [...pr3133Runs, red] });
    expect(A.map(hiddenOf(observed), (entry) => entry.context)).toEqual(["Heavy / Docgen", "Heavy / Doctest"]);
    expect(holdReason(decide(observed))).toBe("required-red");
  });

  // A required red that exists only in a replaced suite is judged red, never dropped: a later
  // label's skipped run must not let a relaxed merge bypass the rules over the PR's own red.
  const hiddenRedRuns = A.map(pr3133Runs, (run) =>
    A.contains(SHADOWED_CONTEXTS, run.name) ? MergeGateCheckRun.make({ ...run, conclusion: "failure" }) : run
  );
  const hiddenRed =
    `Heavy / Check=failure, Heavy / Docgen=failure, Heavy / Doctest=failure failed only in check suite ` +
    `${ADMITTED_SUITE}, ${replaced}`;

  it("one red admitted run, then a later skip run: strict required-red, relaxed own-red, no bypass", () => {
    const observed = shadowRead({ checkRuns: hiddenRedRuns });
    expect(A.dedupe(A.map(hiddenOf(observed), (entry) => entry.state))).toEqual(["red"]);
    expect(renderMergeGateDecision(decide(observed))).toBe(
      `#${pullFixture.number} HOLD required-red: required red in a replaced check suite: ${hiddenRed}`
    );
    // The base is green, so the red is the PR's own: relaxed mode holds, so nothing merges or bypasses.
    const relaxed = decide(observed, true);
    expect(holdReason(relaxed)).toBe("own-red");
    assertInclude(renderMergeGateDecision(relaxed), `Heavy / Check (base run ${baseRunIdOf("Heavy / Check")} green`);
    // A replacing run still going changes nothing: a red copy is red, never pending.
    const running = workflowSuite({ ...skippedSuite, status: "in_progress", conclusion: O.none() });
    const whileRunning = shadowRead({ checkRuns: hiddenRedRuns, workflowSuites: [checkSuite, admittedSuite, running] });
    expect(holdReason(decide(whileRunning))).toBe("required-red");
    expect(holdReason(decide(whileRunning, true))).toBe("own-red");
  });

  it("a hidden red the base shares is attributed only as inherited, like a live red", () => {
    const decision = decideMergeGate(
      MergeGateInput.make({
        read: shadowRead({ checkRuns: hiddenRedRuns, baseRuns: baseRedOn(...SHADOWED_CONTEXTS) }),
        options: options({ relaxed: true }),
      })
    );
    expect(decision._tag).toBe("merge");
    if (decision._tag !== "merge") return;
    expect(
      A.map(decision.atMerge, (entry) => [entry.check, entry.state, Str.startsWith("inherited: ")(entry.attribution)])
    ).toEqual(A.map(SHADOWED_CONTEXTS, (context) => [context, "red", true]));
    expect(mergeGateRequestsBypass(decision)).toBe(true);
  });

  it("green R1, red R2, skip R3: the newest replaced suite's red copy decides, not the green one", () => {
    const redRun = 43329100002;
    const redSuite = 117334700002;
    const r2 = workflowSuite({
      runId: redRun,
      checkSuiteId: redSuite,
      createdAt: DateTime.makeUnsafe("2026-11-12T23:28:10Z"),
      conclusion: O.some("failure"),
    });
    // R1 was re-run after R2, so its green copies carry the highest ids: suite order decides, never id.
    const observed = shadowRead({
      checkRuns: [
        ...pr3133Runs,
        ...heavyRuns("failure", redSuite, 112231400000),
        ...heavyRuns("success", ADMITTED_SUITE, 112231500000),
      ],
      workflowSuites: [checkSuite, admittedSuite, r2, skippedSuite],
    });
    expect(A.map(hiddenOf(observed), (entry) => [entry.context, entry.state, entry.hiddenIn.runId])).toEqual(
      A.map(SHADOWED_CONTEXTS, (context) => [context, "red", redRun])
    );
    expect(holdReason(decide(observed))).toBe("required-red");
    expect(holdReason(decide(observed, true))).toBe("own-red");
  });

  // The ruleset reads required contexts only, so an optional check keeps origin/main's view, its
  // newest run over every suite: a red the admitted run reported stays red after a later skip.
  const lintPolicyRed = A.map(pr3133Runs, (run) =>
    run.name === "Heavy / Lint Policy" ? MergeGateCheckRun.make({ ...run, conclusion: "failure" }) : run
  );

  it("an optional red in the replaced admitted suite is recorded when relaxed and held when strict", () => {
    const relaxed = decide(shadowRead({ checkRuns: lintPolicyRed }), true);
    expect(relaxed._tag).toBe("merge");
    if (relaxed._tag !== "merge") return;
    expect(
      A.map(
        A.filter(relaxed.atMerge, (entry) => entry.state === "red"),
        (entry) => [entry.check, entry.required, entry.attribution]
      )
    ).toEqual([["Heavy / Lint Policy", false, MERGE_GATE_S11_DEFAULT_ATTRIBUTION]]);
    assertInclude(
      renderMergeGateDecision(relaxed),
      `reds at merge: Heavy / Lint Policy [${MERGE_GATE_S11_DEFAULT_ATTRIBUTION}] shadowed at merge: Heavy / Check`
    );
    // On the #3133 shape itself the shadowed required lanes hold strict mode first.
    expect(holdReason(decide(shadowRead({ checkRuns: lintPolicyRed })))).toBe("required-shadowed");
    // With the required lanes live (Check's own heavy run reported them, and Lint Policy, green
    // before the admitted run's newer red), strict holds the optional red where origin/main did.
    const checkSuiteLanes = A.map([...SHADOWED_CONTEXTS, "Heavy / Lint Policy"], (name, index) =>
      MergeGateCheckRun.make({
        id: 112226500000 + index,
        name,
        status: "completed",
        conclusion: "success",
        checkSuiteId: O.some(CHECK_SUITE),
      })
    );
    const strict = shadowRead({ checkRuns: [...lintPolicyRed, ...checkSuiteLanes] });
    expect(hiddenOf(strict)).toEqual([]);
    expect(renderMergeGateDecision(decide(strict))).toBe(
      `#${pullFixture.number} HOLD red: red, attribute it before tolerating: Heavy / Lint Policy`
    );
  });

  it("a check whose suite no Actions run owns, or that names no suite, is unaffected", () => {
    const otherApp = 990000000001;
    for (const suiteOf of [
      (name: string) => (A.contains(SHADOWED_CONTEXTS, name) ? O.some(otherApp) : O.some(CHECK_SUITE)),
      (name: string) => (A.contains(SHADOWED_CONTEXTS, name) ? O.none() : O.some(CHECK_SUITE)),
    ]) {
      const observed = shadowRead({ checkRuns: suiteRuns(suiteOf) });
      expect(hiddenOf(observed)).toEqual([]);
      expect(decide(observed)._tag).toBe("merge");
    }
  });

  it("a newer run of another event (push) does not shadow the pull_request suite", () => {
    const pushRun = workflowSuite({ ...skippedSuite, event: "push" });
    const observed = shadowRead({ workflowSuites: [checkSuite, admittedSuite, pushRun] });
    expect(hiddenOf(observed)).toEqual([]);
    expect(decide(observed)._tag).toBe("merge");
  });

  it("orders runs by creation, then run id, per workflow and event", () => {
    // Same instant: the higher run id is the newer run.
    const tied = workflowSuite({ ...skippedSuite, createdAt: admittedSuite.createdAt });
    expect(
      A.map(hiddenOf(shadowRead({ workflowSuites: [checkSuite, admittedSuite, tied] })), (e) => e.context)
    ).toEqual(SHADOWED_CONTEXTS);
    // An older run listed last never replaces a newer one, and the Check run never shadows a Heavy Admit suite.
    expect(hiddenOf(shadowRead({ workflowSuites: [skippedSuite, checkSuite, admittedSuite] }))).toHaveLength(3);
  });
});

// A scripted `gh` whose answers are the recorded fixtures, routed by argv; the
// merge PUT is captured so the test proves what would have been sent.
interface ScriptedAnswer {
  readonly exitCode: number;
  readonly output: string;
}

interface GhScript {
  readonly additionalActiveRuns?: boolean;
  readonly baseCheckRuns?: unknown;
  readonly baseTipCheckRuns?: unknown;
  readonly baseTipSha?: string;
  readonly cancelFailId?: number;
  readonly checkRuns?: unknown;
  readonly commentExit?: number;
  readonly commitlint?: ScriptedAnswer;
  readonly commits?: ReadonlyArray<string>;
  readonly compareExit?: number;
  readonly mergeResponse: string;
  /** Set by the harness: whether the merge request was already sent when this call arrived. */
  readonly mergeSent?: boolean;
  readonly pull?: unknown;
  readonly queuedExit?: number;
  readonly reviewerRequired?: boolean;
  readonly reviewerRuns?: ReadonlyArray<unknown>;
  readonly reviewerTotal?: number;
  readonly rulesExit: number;
  readonly spawnFails?: boolean;
  readonly threads?: unknown;
  readonly threadsExit: number;
  /** The first thread page's cursor; a second page (the same threads) follows when it names one. */
  readonly threadsPageInfo?: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  readonly windowExit: number;
  // The head's workflow runs, served as one page in place of the recorded pages (the default
  // pages carry a run on another head and a duplicate id for the merge gate's own head guard).
  readonly workflowRuns?: ReadonlyArray<unknown>;
}

const defaultScript: GhScript = {
  threadsExit: 0,
  windowExit: 0,
  rulesExit: 0,
  mergeResponse: encodeJson({
    status: "merged",
    details: { message: "Pull request was merged.", sha: "feedfacefeedfacefeedfacefeedfacefeedface" },
  }),
};

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feat/gate",
  cwd: ".",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: ".",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

// One REST workflow run with the fields the gate keys its suites by (the recorded check runs
// name no suite, so none of these shadows anything).
const workflowRun = (id: number, status: string, conclusion: string | null, sha: string = pullFixture.head.sha) => ({
  id,
  head_sha: sha,
  status,
  conclusion,
  check_suite_id: 900 + id,
  path: ".github/workflows/check.yml",
  event: "pull_request",
  created_at: "2026-10-06T07:50:00Z",
});
const workflowRunPages = (additionalActiveRuns: GhScript["additionalActiveRuns"]) => [
  {
    workflow_runs: [
      workflowRun(11, "queued", null),
      workflowRun(12, "in_progress", null),
      workflowRun(12, "in_progress", null),
      workflowRun(13, "in_progress", null),
      workflowRun(14, "waiting", null, Str.repeat(40)("0")),
      workflowRun(19, "completed", "success"),
      // A live main push run on the merged head sha is never cancelled (the main cancel ban).
      { ...workflowRun(20, "in_progress", null), event: "push", head_branch: "main" },
    ],
  },
  ...(additionalActiveRuns === true
    ? [
        {
          workflow_runs: A.map(["waiting", "requested", "pending", "future_status"], (status, index) =>
            workflowRun(15 + index, status, null)
          ),
        },
      ]
    : []),
];

const scriptReviewerRules = (script: GhScript) =>
  script.reviewerRequired === true
    ? [
        ...rulesFixture,
        {
          type: "required_status_checks",
          parameters: { required_status_checks: [{ context: "beep-reviewer", integration_id: 42 }] },
        },
      ]
    : rulesFixture;
const scriptReviewerPage = (script: GhScript) => {
  const runs = script.reviewerRuns ?? [];
  return { total_count: script.reviewerTotal ?? runs.length, check_runs: runs };
};
// The squash prediction's three reads: the PR commits (one slurped page) before the PR
// itself, which is a prefix of it, and the repository's squash settings last, because every
// other `repos/{owner}/{repo}/...` call contains that fragment.
const squashAnswers = (script: GhScript): ReadonlyArray<readonly [string, ScriptedAnswer]> => {
  const commits = script.commits ?? [`${pullFixture.title}\n\nThe one commit.`];
  return [
    [
      `/pulls/${pullFixture.number}/commits`,
      { exitCode: 0, output: encodeJson([A.map(commits, (message) => ({ commit: { message } }))]) },
    ],
    [`/pulls/${pullFixture.number}`, { exitCode: 0, output: encodeJson(script.pull ?? pullFixture) }],
    [
      "repos/{owner}/{repo}",
      {
        exitCode: 0,
        output: encodeJson({
          squash_merge_commit_title: "COMMIT_OR_PR_TITLE",
          squash_merge_commit_message: "COMMIT_MESSAGES",
        }),
      },
    ],
  ];
};
// Defaults applied once, so the answer tables below carry no fallbacks. The base
// check runs mirror the head's unless a script says otherwise, so a scripted red on
// the head reads as inherited by default.
const scriptDefaults = {
  baseTipSha: mergeBaseSha,
  cancelFailId: -1,
  checkRuns: checkRunsFixture as unknown,
  commentExit: 0,
  compareExit: 0,
  queuedExit: 0,
  threads: threadsFixture as unknown,
};
const resolveScript = (script: GhScript) => {
  const resolved = { ...scriptDefaults, ...script };
  return {
    ...resolved,
    baseCheckRuns: resolved.baseCheckRuns ?? resolved.checkRuns,
    baseTipCheckRuns: resolved.baseTipCheckRuns ?? resolved.checkRuns,
  };
};
type ResolvedGhScript = ReturnType<typeof resolveScript>;
type GhAnswerRoute = readonly [string, ScriptedAnswer];
const answer = (exitCode: number, output: string): ScriptedAnswer => ({ exitCode, output });

// The merge PUT and the S11 post-merge steps: the PR comment, the leftover-run listing
// (run 14 belongs to another head; the server-side filter should not return it, and the
// gate never cancels it) and each cancel. The gate's own read lists the same runs before
// the merge; `queuedExit` fails only the listing after it.
const postMergeAnswers = (script: ResolvedGhScript): ReadonlyArray<GhAnswerRoute> => [
  ["/merge", answer(0, script.mergeResponse)],
  [
    `/issues/${pullFixture.number}/comments`,
    answer(
      script.commentExit,
      encodeJson({
        id: 1,
        html_url: `https://github.com/beep-effect/beep-effect/pull/${pullFixture.number}#issuecomment-1`,
      })
    ),
  ],
  [
    "/actions/runs?",
    answer(
      script.mergeSent === true ? script.queuedExit : 0,
      encodeJson(
        script.workflowRuns === undefined
          ? workflowRunPages(script.additionalActiveRuns)
          : [{ workflow_runs: script.workflowRuns }]
      )
    ),
  ],
  [`/runs/${script.cancelFailId}/cancel`, answer(1, "cancel refused")],
  ["/cancel", answer(0, "")],
];

// The gate's reads: the review window (the recorded REST timeline and check
// suites, read through `GithubRest` since W6), the threads, the ruleset and the reviewer page.
const gateReadAnswers = (script: ResolvedGhScript): ReadonlyArray<GhAnswerRoute> => [
  ["/timeline", answer(script.windowExit, encodeJson(timelineFixture))],
  ["/check-suites", answer(script.windowExit, encodeJson(checkSuitesFixture))],
  ["graphql", answer(script.threadsExit, encodeJson(script.threads))],
  ["rules/branches/", answer(script.rulesExit, encodeJson(scriptReviewerRules(script)))],
  ["check_name=beep-reviewer", answer(0, encodeJson(scriptReviewerPage(script)))],
];

// The inherited-red evidence: the compare of base...head names the merge base and the
// base tip, then each commit's check runs; the head's check runs are matched last because
// their fragment is a suffix of the other two.
const baseEvidenceAnswers = (script: ResolvedGhScript): ReadonlyArray<GhAnswerRoute> => [
  [
    `/compare/${pullFixture.base.ref}...${headSha}`,
    answer(
      script.compareExit,
      encodeJson({ merge_base_commit: { sha: mergeBaseSha }, base_commit: { sha: script.baseTipSha } })
    ),
  ],
  [`commits/${mergeBaseSha}/check-runs`, answer(0, encodeJson([script.baseCheckRuns]))],
  [`commits/${script.baseTipSha}/check-runs`, answer(0, encodeJson([script.baseTipCheckRuns]))],
  ["/check-runs", answer(0, encodeJson([script.checkRuns]))],
];

// The recorded answer for each `gh` call, matched on a fragment of its argv, first match wins.
const ghAnswers = (script: GhScript): ReadonlyArray<GhAnswerRoute> => {
  const resolved = resolveScript(script);
  return [
    // The reviewer gate reads the operator token, then calls GitHub through the `@beep/github` client.
    ["gh auth token", answer(0, "gho_fixture\n")],
    ...postMergeAnswers(resolved),
    ...gateReadAnswers(resolved),
    ...baseEvidenceAnswers(resolved),
    ...squashAnswers(script),
  ];
};

// `bunx commitlint` is scripted too: the gate's own tests never run the real
// linter (yeet-squash-commitlint.test.ts does); by default it passes.
const answerFor = (script: GhScript, command: string, line: string): ScriptedAnswer =>
  command === "git"
    ? { exitCode: 0, output: "feat/gate\n" }
    : command === "bunx"
      ? (script.commitlint ?? { exitCode: 0, output: "✔   found 0 problems, 0 warnings" })
      : A.findFirst(ghAnswers(script), ([fragment]) => Str.includes(fragment)(line)).pipe(
          O.map(([, answer]) => answer),
          O.getOrElse(() => ({ exitCode: 1, output: `unexpected command: ${line}` }))
        );

const scriptedGh = (script: GhScript, calls: Ref.Ref<ReadonlyArray<string>>) =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    if (script.spawnFails === true && command === "gh") {
      return PlatformError.systemError({
        _tag: "NotFound",
        module: "MergeGateTest",
        method: "spawn",
        pathOrDescriptor: "gh",
      });
    }
    const answer = answerFor(script, command, line);
    // The script is synchronous; the shared Ref is updated in place, as `Ref.update` would.
    MutableRef.update(calls.ref, A.append(line));
    return { stdout: answer.output, exit: answer.exitCode };
  });

// The REST fields GitHub always sends that the recorded #1459 pull omits.
const restPull = (pull: unknown) => ({
  node_id: "PR_kwDOPbO_N86w1459",
  body: null,
  merged_at: null,
  html_url: `https://github.com/beep-effect/beep-effect/pull/${pullFixture.number}`,
  labels: [],
  updated_at: pullFixture.created_at,
  ...(pull as object),
});

interface RecordedThreads {
  readonly data: {
    readonly repository: {
      readonly pullRequest: {
        readonly reviewThreads: { readonly nodes: ReadonlyArray<{ readonly comments: unknown }> };
      };
    };
  };
}

// The recorded thread page selected `comments(last: 1)` as `comments`: that is
// each thread's newest comment, so it is also `latest`; the pull request's author
// comes from the recorded pull; the first page carries the script's cursor.
const withLatest = (recorded: RecordedThreads, pageInfo: GhScript["threadsPageInfo"]) => {
  const threads = recorded.data.repository.pullRequest.reviewThreads;
  return {
    data: {
      repository: {
        pullRequest: {
          author: pullFixture.user,
          reviewThreads: {
            ...threads,
            ...(pageInfo === undefined ? {} : { pageInfo }),
            nodes: A.map(threads.nodes, (thread) => ({ ...thread, latest: thread.comments })),
          },
        },
      },
    },
  };
};

const isFirstThreadPage = (call: GithubCall): boolean =>
  !Str.includes('"after"')(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(call.body ?? {}), identity));

// What the old `gh` call printed, as GitHub's own answer, with the recorded
// payloads completed the way GitHub sends them.
const recordedOutput = (script: GhScript, call: GithubCall, output: string): string =>
  O.isSome(call.graphql)
    ? Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)(
          withLatest(
            Result.getOrThrowWith(S.decodeResult(UnknownJson)(output), identity) as RecordedThreads,
            isFirstThreadPage(call) ? script.threadsPageInfo : undefined
          )
        ),
        identity
      )
    : call.path === `{repo}/pulls/${pullFixture.number}`
      ? Result.getOrThrowWith(
          S.encodeUnknownResult(UnknownJson)(
            S.decodeResult(UnknownJson)(output).pipe(Result.getOrThrowWith(identity), restPull)
          ),
          identity
        )
      : output;

const githubAnswer = (script: GhScript, call: GithubCall, line: string): GithubAnswer => {
  if (script.spawnFails === true) return { unreachable: "getaddrinfo ENOTFOUND api.github.com" };
  const answer = answerFor(script, "gh", line);
  return legacyGhAnswer({
    call,
    exitCode: answer.exitCode,
    output: answer.exitCode === 0 ? recordedOutput(script, call, answer.output) : answer.output,
  });
};

const oneWorkflowRunPage = (pages: unknown) => {
  const runs = A.flatMap(
    pages as ReadonlyArray<{ readonly workflow_runs: ReadonlyArray<unknown> }>,
    (page) => page.workflow_runs
  );
  return { total_count: A.length(runs), workflow_runs: runs };
};

// The reviewer gate's REST calls arrive through `fetch`; each is recorded and answered as the
// `gh api <path>` line it replaced, so one answer table serves both transports.
const decodeAnswer = S.decodeResult(UnknownJson);
const scriptedGithub = (script: GhScript, calls: Ref.Ref<ReadonlyArray<string>>) =>
  githubFetch((call) => {
    const line = `gh api ${Str.slice(1)(call.url.pathname)}${call.url.search}`;
    // `fetch` is synchronous here; the Ref is updated in place, as `Ref.update` would.
    MutableRef.update(calls.ref, A.append(line));
    const scripted = answerFor(script, "gh", line);
    // The recorded pull omits fields GitHub always sends; complete it as the `gh` transport does.
    // The recorded run listing is the `gh --paginate --slurp` page array; `fetch` reads one page.
    const complete = Str.endsWith(`/pulls/${pullFixture.number}`)(call.url.pathname)
      ? restPull
      : Str.endsWith("/actions/runs")(call.url.pathname)
        ? oneWorkflowRunPage
        : identity;
    return scripted.exitCode === 0
      ? Result.getOrElse(Result.map(decodeAnswer(scripted.output), complete), () => ({}))
      : reply(404)({ message: scripted.output });
  });

// The merge gate consults a workstation merge-reservation helper whenever the host has activated
// reservations (`~/.local/state/beep/merge-reservations/active`). The scripted runs prove the gate's
// own decisions, so the sentinel always reads as absent here and a developer machine with active
// reservations sees the same argv as CI.
const withoutHostMergeReservation = Effect.map(FileSystem.FileSystem, (fs) =>
  FileSystem.FileSystem.of({
    ...fs,
    exists: Effect.fn("withoutHostMergeReservation.exists")(function* (path: string) {
      const found = yield* fs.exists(path);
      return found && !Str.endsWith("/merge-reservations/active")(path);
    }),
  })
);

// Every scripted run records the argv it was asked for (and each GitHub call in
// that form), so a test can prove the merge was or was not sent.
const withScriptedGh = <A, E, R>(
  script: GhScript,
  use: (calls: Ref.Ref<ReadonlyArray<string>>, github: ReadonlyArray<GithubCall>) => Effect.Effect<A, E, R>
) =>
  // The test clock starts at the epoch; put "now" a minute past the recorded window.
  windowClosed.pipe(
    DateTime.toEpochMillis,
    TestClock.setTime,
    Effect.andThen(Ref.make<ReadonlyArray<string>>(A.empty())),
    Effect.flatMap((calls) => {
      const github = recordedGithub((call) => {
        const line = A.join(["gh", ...legacyGhArgs(call)], " ");
        const mergeSent = A.some(MutableRef.get(calls.ref), Str.includes("/merge"));
        MutableRef.update(calls.ref, A.append(line));
        return githubAnswer({ ...script, mergeSent }, call, line);
      });
      return use(calls, github.calls).pipe(
        github.provide,
        Effect.provideService(GithubTransportFetch, O.some(scriptedGithub(script, calls).fetch)),
        Effect.provideServiceEffect(Git, Git.make),
        Effect.provideServiceEffect(FileSystem.FileSystem, withoutHostMergeReservation),
        provideSpawner(scriptedGh(script, calls))
      );
    })
  );

const mergeWasSent = (calls: Ref.Ref<ReadonlyArray<string>>) =>
  Ref.get(calls).pipe(Effect.map(A.some(Str.includes("/merge"))));

const commandOptions = (overrides: Partial<Parameters<typeof MergeGateCommandOptions.make>[0]> = {}) =>
  MergeGateCommandOptions.make({
    base: "origin/main",
    head: "HEAD",
    packetDir: ".beep/yeet",
    pr: pullFixture.number,
    sha: headSha,
    tolerate: [],
    forceWindow: false,
    relaxed: false,
    dryRun: true,
    ...overrides,
  });

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer, TestConsole.layer), { timeout: "30 seconds" })(
  "yeet merge-gate against recorded gh payloads",
  (it) => {
    it.effect("reads the PR, check runs, review window, threads and ruleset into one read", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.headSha).toBe(headSha);
          expect(result.draft).toBe(false);
          expect(result.checkRuns).toHaveLength(checkRunsFixture.check_runs.length);
          assertSome(O.map(result.requiredContexts, A.length), 15);
          expect(result.window._tag).toBe("elapsed");
          if (result.window._tag === "elapsed") expect(result.window.anchoredAt).toBe(DateTime.formatIso(anchoredAt));
          assertSome(result.unresolvedThreads, 0);
          expect(result.squashCommitlint.verdict._tag).toBe("pass");
          expect(result.squashCommitlint.message.header).toBe(`${pullFixture.title} (#${pullFixture.number})`);
          expect(result.squashCommitlint.message.body).toBe("The one commit.");
          // The head's workflow runs, with run 14 (another head) dropped.
          expect(A.map(result.workflowSuites, (suite) => [suite.runId, suite.checkSuiteId])).toEqual([
            [11, 911],
            [12, 912],
            [12, 912],
            [13, 913],
            [19, 919],
            [20, 920],
          ]);
          const mergeWasSent1 = yield* mergeWasSent(calls);
          expect(mergeWasSent1).toBe(false);
        })
      )
    );

    it.effect("a failing squash commitlint holds the gate and is printed before the decision, no merge sent", () =>
      withScriptedGh(
        {
          ...defaultScript,
          commits: ["fix(x): one\n\nBody.", Str.slice(2)(longBullet)],
          commitlint: {
            exitCode: 1,
            output:
              "✖   footer's lines must not be longer than 100 characters [footer-max-line-length]\n✖   found 1 problems, 0 warnings",
          },
        },
        (calls) =>
          Effect.gen(function* () {
            const error = yield* runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: false,
                relaxed: true,
                dryRun: false,
              })
            ).pipe(Effect.flip);
            // The recorded #1459 title is 116 characters with its suffix, so the header is listed first.
            expect(error.message).toContain("HOLD squash-commitlint: footer-max-line-length at line 1 (116 chars)");
            expect(error.message).not.toContain(`line 7 (102 chars): "${longBullet}"`);
            const mergeWasSent2 = yield* mergeWasSent(calls);
            expect(mergeWasSent2).toBe(false);
            const logLines3 = yield* TestConsole.logLines;
            const printed = A.join(A.map(logLines3, String), "\n");
            expect(printed).toContain(`[yeet] squash-commitlint #${pullFixture.number}: footer-max-line-length`);
            expect(printed).toContain(`#${pullFixture.number} HOLD squash-commitlint`);
          })
      )
    );

    it.effect("reads the labels, the body's attributed checks and the merge-base check runs", () =>
      withScriptedGh(
        {
          ...defaultScript,
          pull: {
            ...pullFixture,
            labels: [{ name: "ready-for-heavy" }, { name: MERGE_GATE_UNBLOCKS_MAIN_LABEL }],
            body: `Summary\n\n<!-- yeet-inherited-reds:start -->\n## Inherited reds (S11) at 212fe39b4f\n\n- \`Lint\`: red on main since 2c1cb448ba\n- \`Repo Sanity\`: fix in #2530\n<!-- yeet-inherited-reds:end -->\n`,
          },
        },
        () =>
          Effect.gen(function* () {
            const result = yield* readMergeGate(context, pullFixture.number);
            expect(result.labels).toEqual(["ready-for-heavy", MERGE_GATE_UNBLOCKS_MAIN_LABEL]);
            expect(result.attributedChecks).toEqual(["Lint", "Repo Sanity"]);
            const base = O.getOrThrow(result.baseRuns);
            expect(base.mergeBase.sha).toBe(mergeBaseSha);
            expect(base.baseTip.sha).toBe(mergeBaseSha);
            expect(base.mergeBase.checkRuns).toHaveLength(checkRunsFixture.check_runs.length);
          })
      )
    );

    it.effect("a body record stamped for an earlier head attributes nothing on this one", () =>
      withScriptedGh(
        {
          ...defaultScript,
          pull: {
            ...pullFixture,
            body: `<!-- yeet-inherited-reds:start -->\n## Inherited reds (S11) at abcdef1234\n\n- \`Lint\`: red on main\n<!-- yeet-inherited-reds:end -->\n`,
          },
        },
        () =>
          readMergeGate(context, pullFixture.number).pipe(
            Effect.map((result) => expect(result.attributedChecks).toEqual([]))
          )
      )
    );

    it.effect("behind its base, the gate reads the base tip's runs too and only reads them once when up to date", () =>
      Effect.gen(function* () {
        const behind = yield* withScriptedGh(
          {
            ...defaultScript,
            baseTipSha,
            baseCheckRuns: lintRed,
            baseTipCheckRuns: checkRunsFixture,
            checkRuns: lintRed,
          },
          (calls) =>
            Effect.gen(function* () {
              const result = yield* readMergeGate(context, pullFixture.number);
              assertSome(
                O.map(result.baseRuns, (base) => base.baseTip.sha),
                baseTipSha
              );
              return yield* Ref.get(calls);
            })
        );
        expect(A.filter(behind, Str.includes("/check-runs?per_page=100"))).toHaveLength(3);
        const upToDateCalls = yield* withScriptedGh(defaultScript, (calls) =>
          readMergeGate(context, pullFixture.number).pipe(Effect.andThen(Ref.get(calls)))
        );
        expect(A.filter(upToDateCalls, Str.includes("/check-runs?per_page=100"))).toHaveLength(2);
      })
    );

    it.effect("a pull request without labels or a body reads as unlabelled and unattributed", () =>
      withScriptedGh({ ...defaultScript, pull: { ...pullFixture, body: null } }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.labels).toEqual([]);
          expect(result.attributedChecks).toEqual([]);
        })
      )
    );

    it.effect("a failed merge-base read becomes an unknown base, never a green one", () =>
      withScriptedGh({ ...defaultScript, compareExit: 1 }, () =>
        readMergeGate(context, pullFixture.number).pipe(Effect.map((result) => assertNone(result.baseRuns)))
      )
    );

    it.effect("counts the recorded unresolved threads of #1488 as outstanding", () =>
      withScriptedGh({ ...defaultScript, threads: openThreadsFixture }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          assertSome(result.unresolvedThreads, 4);
        })
      )
    );

    it.effect("an author-resolved thread holds when a human spoke last, and not when a bot did", () =>
      Effect.gen(function* () {
        // #1459's four threads are resolved by the PR author, who also commented last.
        const resolved = threadsFixture.data.repository.pullRequest.reviewThreads;
        const withLastAuthor = (author: { readonly __typename: string; readonly login: string }) => ({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  ...resolved,
                  nodes: A.map(resolved.nodes, (node, index) =>
                    index === 0
                      ? { ...node, comments: { nodes: [{ createdAt: "2026-10-06T09:00:00Z", author }] } }
                      : node
                  ),
                },
              },
            },
          },
        });
        const count = (threads: unknown) =>
          withScriptedGh({ ...defaultScript, threads }, () =>
            readMergeGate(context, pullFixture.number).pipe(Effect.map((read) => read.unresolvedThreads))
          );
        const count4 = yield* count(threadsFixture);
        assertSome(count4, 0);
        const count5 = yield* count(withLastAuthor({ __typename: "User", login: "reviewer" }));
        assertSome(count5, 1);
        const count6 = yield* count(withLastAuthor({ __typename: "Bot", login: "greptile-apps" }));
        assertSome(count6, 0);
      })
    );

    it.effect("a page that claims a successor without a cursor is an unknown count, never a lower bound", () =>
      withScriptedGh(
        {
          ...defaultScript,
          threadsPageInfo: { hasNextPage: true, endCursor: null },
        },
        () =>
          readMergeGate(context, pullFixture.number).pipe(Effect.map((result) => assertNone(result.unresolvedThreads)))
      )
    );

    it.effect("more threads than one page are read to the end and all counted", () =>
      withScriptedGh(
        {
          ...defaultScript,
          threads: openThreadsFixture,
          threadsPageInfo: { hasNextPage: true, endCursor: "page-2" },
        },
        (calls) =>
          Effect.gen(function* () {
            const result = yield* readMergeGate(context, pullFixture.number);
            // Four open threads on the first page and four more on the second.
            assertSome(result.unresolvedThreads, 8);
            const got = yield* Ref.get(calls);
            expect(A.filter(got, Str.includes("graphql"))).toHaveLength(2);
          })
      )
    );

    it.effect("a pull request with no mergeable state yet reads as unknown, not clean", () =>
      withScriptedGh({ ...defaultScript, pull: { ...pullFixture, mergeable_state: null } }, () =>
        readMergeGate(context, pullFixture.number).pipe(
          Effect.map((result) => expect(result.mergeableState).toBe("unknown"))
        )
      )
    );

    it.effect("a gh that cannot start is a typed failure naming the read", () =>
      withScriptedGh({ ...defaultScript, spawnFails: true }, () =>
        Effect.gen(function* () {
          const failure = yield* readMergeGate(context, pullFixture.number).pipe(Effect.flip);
          expect(failure.message).toContain(`gh api pulls/${pullFixture.number} failed (`);
        })
      )
    );

    it.effect("relaxed merges still hold without the required reviewer's successful current-head run", () =>
      Effect.gen(function* () {
        const own = {
          id: 999999999,
          name: "beep-reviewer",
          head_sha: headSha,
          status: "completed",
          conclusion: "success",
          app: { id: 42 },
          external_id: reviewerCheckExternalId(pullFixture.number, headSha, pullFixture.base.sha),
        };
        const cases = [
          [],
          [{ ...own, external_id: reviewerCheckExternalId(pullFixture.number + 1, headSha, pullFixture.base.sha) }],
          [{ ...own, external_id: reviewerCheckExternalId(pullFixture.number, headSha, Str.repeat(40)("b")) }],
          [{ ...own, app: { id: 99 } }],
          [{ ...own, head_sha: Str.repeat(40)("b") }],
          [{ ...own, conclusion: "failure" }],
          [{ ...own, status: "in_progress", conclusion: null }],
        ];
        for (const reviewerRuns of cases) {
          yield* withScriptedGh({ ...defaultScript, reviewerRequired: true, reviewerRuns }, (calls) =>
            Effect.gen(function* () {
              const held = yield* runMergeGate(
                context,
                MergeGateRunOptions.make({
                  prNumber: pullFixture.number,
                  wantSha: headSha,
                  tolerate: [],
                  forceWindow: false,
                  relaxed: true,
                  dryRun: false,
                })
              ).pipe(Effect.result);
              expect(held._tag).toBe("Failure");
              const got7 = yield* Ref.get(calls);
              expect(A.some(got7, (line) => Str.includes("/merge")(line))).toBe(false);
            })
          );
        }
        yield* withScriptedGh({ ...defaultScript, reviewerRequired: true, reviewerRuns: [own] }, (calls) =>
          Effect.gen(function* () {
            const decision = yield* runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: false,
                relaxed: true,
                dryRun: false,
              })
            );
            expect(decision._tag).toBe("merge");
            const got8 = yield* Ref.get(calls);
            expect(A.some(got8, (line) => Str.includes("/merge")(line))).toBe(true);
          })
        );
      })
    );

    it.effect("holds after one empty reviewer page with an inflated total count", () =>
      withScriptedGh({ ...defaultScript, reviewerRequired: true, reviewerRuns: [], reviewerTotal: 999 }, (calls) =>
        Effect.gen(function* () {
          const held = yield* runMergeGate(
            context,
            MergeGateRunOptions.make({
              prNumber: pullFixture.number,
              wantSha: headSha,
              tolerate: [],
              forceWindow: false,
              relaxed: true,
              dryRun: false,
            })
          ).pipe(Effect.result);
          expect(held._tag).toBe("Failure");
          const got9 = yield* Ref.get(calls);
          expect(A.filter(got9, Str.includes("check_name=beep-reviewer"))).toHaveLength(1);
          const mergeWasSent10 = yield* mergeWasSent(calls);
          expect(mergeWasSent10).toBe(false);
        })
      )
    );

    it.effect("a decline with an empty message, and a merge with an empty one, are still reported", () =>
      Effect.gen(function* () {
        const declined = yield* withScriptedGh(
          { ...defaultScript, mergeResponse: '{"status":"failed","details":{"message":""}}' },
          () =>
            runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: false,
                relaxed: false,
                dryRun: false,
              })
            ).pipe(Effect.flip)
        );
        expect(declined.message).toContain("HOLD merge-failed: merge-async failed: GitHub sent no message");
        const decision = yield* withScriptedGh(
          { ...defaultScript, mergeResponse: '{"status":"merged","details":{"message":"","sha":"feedface"}}' },
          () =>
            runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: true,
                relaxed: false,
                dryRun: false,
              })
            )
        );
        expect(decision._tag).toBe("merge");
      })
    );

    it.effect("a failed thread read becomes an unknown count, and the gate holds on it", () =>
      withScriptedGh({ ...defaultScript, threadsExit: 1 }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          assertNone(result.unresolvedThreads);
          expect(
            holdReason(decideMergeGate(MergeGateInput.make({ read: result, options: options({ now: result.readAt }) })))
          ).toBe("threads-unknown");
        })
      )
    );

    it.effect("a failed window read becomes an unknown window, which holds even when forced", () =>
      withScriptedGh({ ...defaultScript, windowExit: 1 }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          expect(result.window._tag).toBe("unknown");
          expect(
            holdReason(
              decideMergeGate(
                MergeGateInput.make({ read: result, options: options({ now: result.readAt, forceWindow: true }) })
              )
            )
          ).toBe("review-window-unknown");
        })
      )
    );

    it.effect("an unreadable ruleset becomes unknown required contexts", () =>
      withScriptedGh({ ...defaultScript, rulesExit: 1 }, () =>
        Effect.gen(function* () {
          const result = yield* readMergeGate(context, pullFixture.number);
          assertNone(result.requiredContexts);
        })
      )
    );

    it.effect("--dry-run decides without sending the merge", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const decision = yield* runMergeGate(
            context,
            MergeGateRunOptions.make({
              prNumber: pullFixture.number,
              wantSha: Str.slice(0, 10)(headSha),
              tolerate: [],
              forceWindow: false,
              relaxed: false,
              dryRun: true,
            })
          );
          expect(decision._tag).toBe("merge");
          const mergeWasSent11 = yield* mergeWasSent(calls);
          expect(mergeWasSent11).toBe(false);
        })
      )
    );

    it.effect("a met gate squash-merges at the pinned head with `<title> (#n)`", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          yield* runMergeGate(
            context,
            MergeGateRunOptions.make({
              prNumber: pullFixture.number,
              wantSha: headSha,
              tolerate: [],
              forceWindow: false,
              relaxed: false,
              dryRun: false,
            })
          );
          const got12 = yield* Ref.get(calls);
          const merge = A.findFirst(got12, Str.includes("/merge"));
          merge.pipe(O.isSome, assertTrue);
          if (O.isSome(merge)) {
            expect(merge.value).toContain("-X PUT");
            expect(merge.value).toContain(`/pulls/${pullFixture.number}/merge-async `);
            expect(merge.value).toContain("merge_action=direct_merge");
            expect(merge.value).toContain("bypass_rules=false");
            expect(merge.value).toContain("merge_method=squash");
            expect(merge.value).toContain(`sha=${headSha}`);
            expect(merge.value).toContain(`commit_title=${pullFixture.title} (#${pullFixture.number})`);
            expect(merge.value).toContain("commit_message=The one commit.");
          }
        })
      )
    );

    it.effect("the folded historical body sent to GitHub exactly equals the linted message and decision", () =>
      withScriptedGh(
        {
          ...defaultScript,
          pull: { ...pullFixture, title: "fix(yeet): lint the explicit squash message" },
          commits: ["fix(x): one\n\nBody.", Str.slice(2)(longBullet)],
        },
        (_calls, github) =>
          Effect.gen(function* () {
            const read = yield* readMergeGate(context, pullFixture.number);
            const linted = read.squashCommitlint.message;
            expect(read.squashCommitlint.verdict._tag).toBe("pass");
            expect(linted.body).not.toContain(longBullet);
            pipe(
              linted.body,
              Str.split("\n"),
              A.every((line) => Str.length(line) < 100),
              assertTrue
            );
            const decision = yield* runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: false,
                relaxed: false,
                dryRun: false,
              })
            );
            expect(decision._tag).toBe("merge");
            if (decision._tag === "merge") {
              expect(decision.commitTitle).toBe(linted.header);
              expect(decision.commitMessage).toBe(linted.body);
              const request = A.findFirst(
                github,
                (call) => call.method === "PUT" && call.path === `{repo}/pulls/${pullFixture.number}/merge-async`
              );
              request.pipe(O.isSome, assertTrue);
              if (O.isSome(request))
                expect(request.value.body).toEqual({
                  merge_action: "direct_merge",
                  merge_method: "squash",
                  sha: headSha,
                  bypass_rules: false,
                  commit_title: linted.header,
                  commit_message: linted.body,
                });
            }
          })
      )
    );

    it.effect("GitHub declining the merge is a failure, never a silent pass", () =>
      withScriptedGh(
        {
          ...defaultScript,
          mergeResponse: encodeJson({
            status: "failed",
            details: { message: "A conversation must be resolved before this pull request can be merged." },
          }),
        },
        () =>
          Effect.gen(function* () {
            const failure = yield* runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: false,
                relaxed: false,
                dryRun: false,
              })
            ).pipe(Effect.flip);
            expect(failure.message).toBe(
              `#${pullFixture.number} HOLD merge-failed: merge-async failed: A conversation must be resolved before this pull request can be merged.`
            );
            expect(failure.exitCode).toBe(1);
          })
      )
    );

    it.effect("a merge GitHub never settles holds as merge-unsettled and is never read as merged", () =>
      withScriptedGh(
        {
          ...defaultScript,
          mergeResponse: encodeJson({
            status: "enqueued",
            details: { message: "Pull request was added to the queue." },
          }),
        },
        () =>
          Effect.gen(function* () {
            const failure = yield* runMergeGate(
              context,
              MergeGateRunOptions.make({
                prNumber: pullFixture.number,
                wantSha: headSha,
                tolerate: [],
                forceWindow: false,
                relaxed: false,
                dryRun: false,
              })
            ).pipe(Effect.flip);
            expect(failure.message).toBe(
              `#${pullFixture.number} HOLD merge-unsettled: merge-async unsettled: enqueued, not merged: Pull request was added to the queue.`
            );
            expect(failure.exitCode).toBe(1);
          })
      )
    );

    it.effect("a hold exits non-zero with the routed reason and never merges", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const failure = yield* runMergeGate(
            context,
            MergeGateRunOptions.make({
              prNumber: pullFixture.number,
              wantSha: "0000000000",
              tolerate: [],
              forceWindow: false,
              relaxed: false,
              dryRun: false,
            })
          ).pipe(Effect.flip);
          expect(failure.message).toContain("HOLD head-moved");
          expect(failure.exitCode).toBe(1);
          const mergeWasSent13 = yield* mergeWasSent(calls);
          expect(mergeWasSent13).toBe(false);
        })
      )
    );

    const lintRed = {
      check_runs: A.map(checkRunsFixture.check_runs, (run) =>
        run.name === "Lint" ? { ...run, conclusion: "failure" } : run
      ),
    };
    // The recorded Lint run id: the default scripted base mirrors the head, so it is also the base run.
    const lintRunId = O.getOrThrow(A.findFirst(checkRunsFixture.check_runs, (run) => run.name === "Lint")).id;
    const relaxedRun = (dryRun: boolean, forceWindow = false) =>
      runMergeGate(
        context,
        MergeGateRunOptions.make({
          prNumber: pullFixture.number,
          wantSha: headSha,
          tolerate: [],
          forceWindow,
          relaxed: true,
          dryRun,
        })
      );
    const indexOf = (lines: ReadonlyArray<string>, fragment: string) =>
      O.getOrElse(A.findFirstIndex(lines, Str.includes(fragment)), () => -1);

    it.effect("a relaxed merge comments with the reds and cancels the head's leftover runs after merging", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          const mergeAt = indexOf(lines, "/merge");
          const commentAt = indexOf(lines, `/issues/${pullFixture.number}/comments`);
          expect(mergeAt).toBeGreaterThanOrEqual(0);
          expect(commentAt).toBeGreaterThan(mergeAt);
          const comment = lines[commentAt] ?? "";
          expect(comment).toContain("-X POST");
          expect(comment).toContain(
            "yeet merge-gate (S11): merged 212fe39b4f as feedfacefe via merge-async, with a rules bypass requested over the checks below."
          );
          // The S11 merge with a recorded red is the one request that asks GitHub to bypass.
          const mergeLine = lines[mergeAt] ?? "";
          expect(mergeLine).toContain("bypass_rules=true");
          expect(comment).toContain(
            `reds at merge: Lint [inherited: run ${lintRunId} failure on merge-base 2c1cb448ba]`
          );
          expect(comment).toContain('Merged under operator ruling S11 (AGENTS.md "Mergeable")');
          // The gate lists the head's runs before deciding, and again after the merge to cancel the leftovers.
          expect(indexOf(lines, `head_sha=${headSha}`)).toBeLessThan(mergeAt);
          expect(O.getOrElse(A.findLastIndex(lines, Str.includes(`head_sha=${headSha}`)), () => -1)).toBeGreaterThan(
            mergeAt
          );
          // A duplicate run in the listing is cancelled once.
          expect(A.filter(lines, Str.includes("/cancel"))).toEqual(
            A.map([11, 12, 13], (id) => `gh api -X POST repos/{owner}/{repo}/actions/runs/${id}/cancel`)
          );
          expect(comment).toContain("review window elapsed");
          const logLines14 = yield* TestConsole.logLines;
          expect(A.join(A.map(logLines14, String), "\n")).toContain(
            `recorded the S11 merge in a comment on #${pullFixture.number}`
          );
          const logLines15 = yield* TestConsole.logLines;
          const printed = A.join(A.map(logLines15, String), "\n");
          expect(printed).toContain("GATE-MET (S11)");
          expect(printed).toContain("cancelled 3 of 3 active workflow run(s) on 212fe39b4f");
        })
      )
    );

    it.effect("a relaxed gate holds on the PR's own red, prints the HOLD line and never merges (2026-11-02)", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed, baseCheckRuns: checkRunsFixture }, (calls) =>
        Effect.gen(function* () {
          const failure = yield* relaxedRun(false).pipe(Effect.flip);
          expect(failure.message).toBe(
            `#${pullFixture.number} HOLD own-red: Lint (base run ${lintRunId} green at merge-base 2c1cb448ba)`
          );
          expect(failure.exitCode).toBe(1);
          const mergeWasSent16 = yield* mergeWasSent(calls);
          expect(mergeWasSent16).toBe(false);
          const logLines17 = yield* TestConsole.logLines;
          const printed = A.join(A.map(logLines17, String), "\n");
          expect(printed).toContain(`[yeet] #${pullFixture.number} HOLD own-red: Lint (base run ${lintRunId} green`);
        })
      )
    );

    it.effect("a red main at the merge-base that main fixed since no longer excuses the PR's red (review thread)", () =>
      withScriptedGh(
        {
          ...defaultScript,
          checkRuns: lintRed,
          baseCheckRuns: lintRed,
          baseTipSha,
          baseTipCheckRuns: checkRunsFixture,
        },
        (calls) =>
          Effect.gen(function* () {
            const failure = yield* relaxedRun(false).pipe(Effect.flip);
            expect(failure.message).toBe(
              `#${pullFixture.number} HOLD own-red: Lint (base run ${lintRunId} green at base tip 7a7a7a7a7a)`
            );
            const mergeWasSent18 = yield* mergeWasSent(calls);
            expect(mergeWasSent18).toBe(false);
          })
      )
    );

    it.effect("cancels every active status across pages while retaining the head guard", () =>
      withScriptedGh({ ...defaultScript, additionalActiveRuns: true }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          // Relaxed with every check green records no red, so it asks for no bypass.
          expect(lines[indexOf(lines, "/merge-async")]).toContain("bypass_rules=false");
          const listings = A.filter(lines, Str.includes("/actions/runs?"));
          // The gate read's listing, then the post-merge one; both read every page.
          expect(listings).toHaveLength(2);
          expect(A.every(listings, Str.includes("per_page=100"))).toBe(true);
          expect(A.filter(lines, Str.includes("/cancel"))).toEqual(
            A.map([11, 12, 13, 15, 16, 17, 18], (id) => `gh api -X POST repos/{owner}/{repo}/actions/runs/${id}/cancel`)
          );
        })
      )
    );

    it.effect("a relaxed merge with a forced window says so in the lasting comment", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false, true))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          const comment = lines[indexOf(lines, `/issues/${pullFixture.number}/comments`)] ?? "";
          expect(comment).toContain("review window forced (a fix that unblocks main)");
          expect(comment).not.toContain("review window elapsed");
        })
      )
    );

    it.effect("a failed paginated run listing only warns after the merge", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed, queuedExit: 1 }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(A.filter(lines, Str.includes("/cancel"))).toEqual([]);
          const errorLines19 = yield* TestConsole.errorLines;
          const warned = A.join(A.map(errorLines19, String), "\n");
          expect(warned).toContain("[yeet] warning: listing the merged head's workflow runs failed after the merge");
          const logLines20 = yield* TestConsole.logLines;
          const printed = A.join(A.map(logLines20, String), "\n");
          expect(printed).toContain("cancelled 0 of 0 active workflow run(s)");
        })
      )
    );

    // #3133 through the real reads: each check run names its suite, and the head's workflow runs
    // carry the two Heavy Admit runs, the later one skipped.
    const shadowScript: GhScript = {
      ...defaultScript,
      checkRuns: {
        ...checkRunsFixture,
        check_runs: [
          ...A.map(checkRunsFixture.check_runs, (run) => ({ ...run, check_suite: { id: suiteOfCheck(run.name) } })),
          ...A.map(skippedSuiteChecks, ({ id, name }) => ({
            id,
            name,
            status: "completed",
            conclusion: "skipped",
            check_suite: { id: SKIPPED_SUITE },
          })),
        ],
      },
      workflowRuns: A.map(pr3133Suites, (suite) => ({
        id: suite.runId,
        name: "Heavy Admit",
        head_sha: headSha,
        status: suite.status,
        conclusion: O.getOrNull(suite.conclusion),
        check_suite_id: suite.checkSuiteId,
        path: suite.workflowPath,
        event: suite.event,
        created_at: DateTime.formatIso(suite.createdAt),
      })),
    };

    it.effect("a strict gate holds the checks a newer skipped Heavy Admit run shadows and never merges", () =>
      withScriptedGh(shadowScript, (calls) =>
        Effect.gen(function* () {
          const failure = yield* runMergeGate(
            context,
            MergeGateRunOptions.make({
              prNumber: pullFixture.number,
              wantSha: headSha,
              tolerate: [],
              forceWindow: false,
              relaxed: false,
              dryRun: false,
            })
          ).pipe(Effect.flip);
          assertInclude(
            failure.message,
            `HOLD required-shadowed: required context(s) the ruleset reads as expected: Heavy / Check, Heavy / Docgen, Heavy / Doctest passed only in check suite ${ADMITTED_SUITE}`
          );
          assertInclude(failure.message, SHADOWED_REQUIRED_REMEDY);
          const sent = yield* mergeWasSent(calls);
          expect(sent).toBe(false);
        })
      )
    );

    it.effect("a relaxed gate merges over shadowed checks with a rules bypass and records them", () =>
      withScriptedGh(shadowScript, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(lines[indexOf(lines, "/merge-async")]).toContain("bypass_rules=true");
          const comment = lines[indexOf(lines, `/issues/${pullFixture.number}/comments`)] ?? "";
          assertInclude(comment, `shadowed at merge: Heavy / Check [shadowed: passed in check suite ${ADMITTED_SUITE}`);
        })
      )
    );

    it.effect("one failed cancel only warns; the other runs are still cancelled and the count says so", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed, cancelFailId: 12 }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(A.filter(lines, Str.includes("/cancel"))).toHaveLength(3);
          expect(A.some(lines, Str.includes("/runs/14/cancel"))).toBe(false);
          const errorLines21 = yield* TestConsole.errorLines;
          const warned = A.join(A.map(errorLines21, String), "\n");
          expect(warned).toContain("[yeet] warning: cancelling a leftover workflow run failed after the merge");
          const logLines22 = yield* TestConsole.logLines;
          const printed = A.join(A.map(logLines22, String), "\n");
          expect(printed).toContain("cancelled 2 of 3 active workflow run(s)");
        })
      )
    );

    it.effect("a failed S11 comment only warns: the merge already happened and the runs are still cancelled", () =>
      withScriptedGh({ ...defaultScript, commentExit: 1 }, (calls) =>
        Effect.gen(function* () {
          expect((yield* relaxedRun(false))._tag).toBe("merge");
          const lines = yield* Ref.get(calls);
          expect(A.filter(lines, Str.includes("/cancel"))).toHaveLength(3);
          const errorLines23 = yield* TestConsole.errorLines;
          const warned = A.join(A.map(errorLines23, String), "\n");
          expect(warned).toContain("[yeet] warning: the S11 merge comment failed after the merge");
        })
      )
    );

    it.effect("a relaxed dry run, and a strict merge, neither comment nor cancel", () =>
      Effect.gen(function* () {
        // The gate read lists the head's runs once; neither path lists them again, comments or cancels.
        const postMerge = (lines: ReadonlyArray<string>) =>
          A.filter(lines, (line) => Str.includes("/comments")(line) || Str.includes("/cancel")(line));
        const listings = (lines: ReadonlyArray<string>) => A.filter(lines, Str.includes("actions/runs"));
        const dryRun = yield* withScriptedGh({ ...defaultScript, checkRuns: lintRed }, (calls) =>
          relaxedRun(true).pipe(Effect.andThen(Ref.get(calls)))
        );
        expect(A.some(dryRun, Str.includes("/merge"))).toBe(false);
        expect(postMerge(dryRun)).toEqual([]);
        expect(listings(dryRun)).toHaveLength(1);
        const strict = yield* withScriptedGh(defaultScript, (calls) =>
          runMergeGate(
            context,
            MergeGateRunOptions.make({
              prNumber: pullFixture.number,
              wantSha: headSha,
              tolerate: [],
              forceWindow: false,
              relaxed: false,
              dryRun: false,
            })
          ).pipe(Effect.andThen(Ref.get(calls)))
        );
        expect(A.some(strict, Str.includes("/merge"))).toBe(true);
        expect(postMerge(strict)).toEqual([]);
        expect(listings(strict)).toHaveLength(1);
      })
    );

    it.effect("yeet gh checks cancel-queued cancels the pull-request run and never the main push run on its head", () =>
      withScriptedGh(
        {
          ...defaultScript,
          workflowRuns: [
            {
              id: 20,
              name: "Check",
              status: "queued",
              conclusion: null,
              head_sha: headSha,
              event: "pull_request",
              path: ".github/workflows/check.yml",
              created_at: "2026-10-06T07:50:00Z",
              head_branch: pullFixture.head.ref,
            },
            // A branch fast-forwarded to main's tip shares the sha with a live main push run.
            {
              id: 21,
              name: "Check",
              status: "in_progress",
              conclusion: null,
              head_sha: headSha,
              event: "push",
              path: ".github/workflows/check.yml",
              created_at: "2026-10-06T07:50:00Z",
              head_branch: "main",
            },
            // An event GitHub did not report is never cancelled either.
            {
              id: 22,
              name: "Check",
              status: "queued",
              conclusion: null,
              head_sha: headSha,
              path: ".github/workflows/check.yml",
              created_at: "2026-10-06T07:50:00Z",
            },
          ],
        },
        (calls) =>
          Effect.gen(function* () {
            // The repository comes from GH_REPO: the scripted git answers name no origin remote.
            yield* runYeetGhChecks({ action: "cancel-queued", number: pullFixture.number, tokenRef: O.none() }).pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ GH_REPO: "beep-effect/beep-effect" })
              )
            );
            const lines = yield* Ref.get(calls);
            expect(A.filter(lines, Str.includes("/cancel"))).toEqual([
              "gh api repos/beep-effect/beep-effect/actions/runs/20/cancel",
            ]);
          })
      )
    );

    it.effect("the command passes --relaxed through to the gate", () =>
      withScriptedGh({ ...defaultScript, checkRuns: lintRed }, () =>
        Effect.gen(function* () {
          yield* runYeetMergeGate(commandOptions({ relaxed: true, tolerate: ["Lint=inherited: red on main"] }));
          const logLines24 = yield* TestConsole.logLines;
          const printed = A.join(A.map(logLines24, String), "\n");
          expect(printed).toContain("GATE-MET (S11)");
          expect(printed).toContain("reds at merge: Lint [inherited: red on main]");
        })
      )
    );

    it.effect("the command refuses a malformed --tolerate before reading anything", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          const failure = yield* runYeetMergeGate(commandOptions({ tolerate: ["Heavy / Coverage Regression"] })).pipe(
            Effect.flip
          );
          expect(failure.message).toContain('--tolerate needs "<check name>=<attribution>"');
          const got25 = yield* Ref.get(calls);
          expect(got25).toHaveLength(0);
        })
      )
    );

    it.effect("re-asserts the provenance footer before a real merge and never on a dry run", () =>
      Effect.gen(function* () {
        const runs = yield* Ref.make(0);
        const reassert = Ref.update(runs, (n) => n + 1);
        yield* provenanceFooterBeforeMergeForTesting({ dryRun: true, reassert });
        const afterDryRun = yield* Ref.get(runs);
        expect(afterDryRun).toBe(0);
        yield* provenanceFooterBeforeMergeForTesting({ dryRun: false, reassert });
        const afterMerge = yield* Ref.get(runs);
        expect(afterMerge).toBe(1);
      })
    );

    it.effect("the command decodes tolerances, resolves the repo and runs the gate", () =>
      withScriptedGh(defaultScript, (calls) =>
        Effect.gen(function* () {
          yield* runYeetMergeGate(commandOptions({ tolerate: ["Heavy / Coverage Regression=inherited: red on main"] }));
          const lines = yield* Ref.get(calls);
          expect(A.some(lines, Str.includes(`/pulls/${pullFixture.number}`))).toBe(true);
          const mergeWasSent26 = yield* mergeWasSent(calls);
          expect(mergeWasSent26).toBe(false);
        })
      )
    );
  }
);

// `yeet gate-table` under the same recorded login: the open-PR list is the only route the
// merge gate's script lacks; the combined status 404s, which the table reads as unknown.
const withGateTable = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  windowClosed.pipe(
    DateTime.toEpochMillis,
    TestClock.setTime,
    Effect.andThen(Ref.make<ReadonlyArray<string>>(A.empty())),
    Effect.flatMap((calls) => {
      const github = recordedGithub((call) => {
        const line = A.join(["gh", ...legacyGhArgs(call)], " ");
        MutableRef.update(calls.ref, A.append(line));
        return call.method === "GET" && call.path === "{repo}/pulls"
          ? { body: [restPull(pullFixture)] }
          : githubAnswer(defaultScript, call, line);
      });
      return use.pipe(
        github.provide,
        Effect.provideServiceEffect(Git, Git.make),
        provideSpawner(scriptedGh(defaultScript, calls))
      );
    })
  );

const gateTableOptions = (json: boolean) =>
  GateTableCommandOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet", json });

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer, TestConsole.layer), { timeout: "30 seconds" })(
  "yeet gate-table command",
  (it) => {
    it.effect("prints the table under the recorded login, unknown statuses holding the row", () =>
      withGateTable(runYeetGateTable(gateTableOptions(false))).pipe(
        Effect.andThen(TestConsole.logLines),
        Effect.map((lines) => {
          const printed = A.join(A.map(lines, String), "\n");
          assertInclude(printed, "1 open PR(s), 0 GATE-MET");
          assertInclude(printed, `#${pullFixture.number}\tready\tmain`);
          assertInclude(printed, "PENDING:statuses=?");
        })
      )
    );

    it.effect("emits the yeet-gate-table/v1 report with --json", () =>
      withGateTable(runYeetGateTable(gateTableOptions(true))).pipe(
        Effect.andThen(TestConsole.logLines),
        // The layer's console keeps earlier tests' lines; the report is the last one.
        Effect.flatMap((lines) => GateTableReportJson.decode(O.getOrElse(O.map(A.last(lines), String), () => ""))),
        Effect.map((report) => assertTrue(A.length(report.entries) === 1))
      )
    );
  }
);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "120 seconds" })(
  "merge-gate classifier seam",
  (it) => {
    it.effect("builds the checkout classifier for the gate's window read", () =>
      Effect.gen(function* () {
        const scenario = yield* rewriteWindowScenario();
        yield* DateTime.makeUnsafe("2026-11-10T02:50:00Z").pipe(DateTime.toEpochMillis, TestClock.setTime);
        const read = yield* readAuthenticatedMergeGate(scenario.context, 3050).pipe(scenario.github.provide);
        expect(read.window).toMatchObject({
          _tag: "elapsed",
          anchor: "ready-for-review",
          anchoredAt: "2026-11-10T02:25:19.000Z",
        });
        if (read.window._tag !== "unknown")
          assertSome(
            O.map(read.window.carried, (carry) => carry.rootSha),
            scenario.s.l2
          );
      })
    );
  }
);
