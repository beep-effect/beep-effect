import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import { Repo, RepoRef } from "@beep/github/Repo";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { YeetCommandError } from "@beep/repo-cli/commands/Yeet/Yeet.errors";
import { layerGithubRest, layerGraphqlBudget } from "@beep/repo-cli/test/SharedInternals";
import {
  collectYeetStatus,
  decideYeetReadyGate,
  deriveYeetMergeReady,
  FinalCheckReceipt,
  FinalCheckRefreshOwnChange,
  FinalCheckRefreshPass,
  FinalCheckRefreshRefused,
  FinalCheckStepResult,
  flipPullRequestReady,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSubmitter,
  ProofJobUnit,
  parseYeetReadyInheritedRed,
  RepoRunContext,
  readYeetReviewLaneLedger,
  recordInheritedRedsWithRest,
  reviewerRequestPushable,
  runYeetReady,
  runYeetReadyGate,
  SquashCommitlintFail,
  SquashCommitlintOffendingLine,
  SquashCommitlintPass,
  SquashCommitlintReport,
  SquashCommitMessage,
  spliceYeetInheritedRedsSection,
  YEET_REVIEWER_REQUEST_SUBJECT,
  YeetReadyInheritedRed,
  YeetReadyOptions,
  YeetReadyPullRequestRead,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetWatchCheck,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant, dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type { GraphQLDocument } from "@beep/github/GraphQL";

const headSha = "abc1234def";

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feature/ready-gate",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

// A fake of the monitor's pull request read: the remote summary as
// `collectYeetStatus` reports it, with readiness derived the same way.
const prView = (
  overrides: Partial<{
    readonly available: boolean;
    readonly checks: ReadonlyArray<YeetWatchCheck>;
    readonly failingOptionalCheckCount: number;
    readonly failingRequiredCheckCount: number;
    readonly headSha: O.Option<string>;
    readonly isDraft: boolean;
    readonly mergeable: string;
    readonly pendingCheckCount: number;
    readonly pendingOptionalCheckCount: number;
    readonly pendingRequiredCheckCount: number;
    readonly state: string;
    readonly unresolvedReviewThreadCount: number;
  }> = {}
): YeetReadyPullRequestRead => {
  const remote = YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: "PR #42 OPEN",
    state: "OPEN",
    number: 42,
    headSha: O.some(headSha),
    isDraft: true,
    mergeable: "MERGEABLE",
    mergeStateStatus: "DRAFT",
    requiredCheckCount: 3,
    failingRequiredCheckCount: 0,
    pendingRequiredCheckCount: 0,
    unresolvedReviewThreadCount: 0,
    ...overrides,
  });
  const closeout = YeetStatusArtifact.make({
    detail: "closed",
    issueCount: 0,
    path: "pr-closeout.json",
    state: "present",
    reviewedHeadSha: O.some(headSha),
  });
  return YeetReadyPullRequestRead.make({ remote, mergeReady: deriveYeetMergeReady(closeout, remote) });
};

const noPullRequest = YeetReadyPullRequestRead.make({
  remote: YeetStatusRemote.make({ available: false, checked: true, detail: "no pull request for this branch" }),
  mergeReady: O.none(),
});

// The squash-commitlint advisory the flip prints: a passing verdict by default.
const squashMessage = SquashCommitMessage.make({ header: "feat(ready): gate (#42)", body: "" });
// The flip pushes a reviewer re-request; tests answer it without running git.
const stubReviewerRequest = () => Effect.succeed("[yeet] reviewer re-request stubbed");

const passingFinalCheck = (_context: RepoRunContext, head: string) =>
  Effect.succeedSome(
    FinalCheckReceipt.make({
      schemaVersion: "yeet-final-check/v1",
      headSha: head,
      mergeBase: Str.repeat(40)("0"),
      base: "origin/main",
      complete: true,
      verdict: "pass",
      startedAt: "2026-10-24T00:00:00.000Z",
      finishedAt: "2026-10-24T00:01:00.000Z",
      steps: [],
      expectationRewrites: [],
    })
  );
const passingSquashCommitlint = () =>
  Effect.succeed(SquashCommitlintReport.make({ message: squashMessage, verdict: SquashCommitlintPass.make({}) }));
const longBullet = `* ${Str.repeat(100)("a")}`;
const failingSquashCommitlint = () =>
  Effect.succeed(
    SquashCommitlintReport.make({
      message: SquashCommitMessage.make({ ...squashMessage, body: longBullet }),
      verdict: SquashCommitlintFail.make({
        rules: ["footer-max-line-length"],
        offendingLines: [SquashCommitlintOffendingLine.make({ line: 3, length: 102, text: longBullet })],
      }),
    })
  );

describe("yeet ready gate decision (push-first-publish D11: ready at content-final)", () => {
  it.each(["GraphQL: API rate limit exceeded", "authentication required", "network unreachable"])(
    "reports an unreadable PR as unknown: %s",
    (reason) => {
      const read = YeetReadyPullRequestRead.make({
        remote: YeetStatusRemote.make({
          available: false,
          checked: true,
          detail: reason,
          readFailure: O.some(YeetCommandError.make({ message: reason })),
        }),
        mergeReady: O.none(),
      });
      expect(decideYeetReadyGate(read)).toMatchObject({
        _tag: "blocked",
        blocker: "pr-open",
        detail: `could not read the pull request: ${reason}; retry after the GitHub rate limit resets or restore GitHub access`,
      });
    }
  );

  it("reports a successful lookup with no PR separately from a closed PR", () => {
    expect(decideYeetReadyGate(noPullRequest)).toMatchObject({
      _tag: "blocked",
      blocker: "pr-open",
      detail: "no open pull request was found for this branch",
    });
    expect(decideYeetReadyGate(prView({ state: "CLOSED" }))).toMatchObject({
      _tag: "blocked",
      blocker: "pr-open",
      detail: "pull request #42 is CLOSED",
    });
  });

  it.effect("explains an unread remote without a captured command failure", () =>
    Effect.gen(function* () {
      for (const remote of [
        YeetStatusRemote.make({ available: false, checked: false, detail: "remote read skipped" }),
        YeetStatusRemote.make({ available: true, checked: true, detail: "state missing" }),
      ]) {
        expect(decideYeetReadyGate(YeetReadyPullRequestRead.make({ remote, mergeReady: O.none() }))).toMatchObject({
          _tag: "blocked",
          blocker: "pr-open",
          detail: `could not read the pull request: ${remote.detail}; retry after the GitHub rate limit resets or restore GitHub access`,
        });
      }
    })
  );

  it("flips a draft whose threads are answered and required checks are green", () => {
    expect(decideYeetReadyGate(prView())).toMatchObject({ _tag: "flip", prNumber: 42 });
  });

  it.each([
    ["required checks still pending", prView({ pendingRequiredCheckCount: 2, pendingCheckCount: 2 })],
    ["the heavy matrix still pending", prView({ pendingOptionalCheckCount: 9, pendingCheckCount: 9 })],
    [
      "a red optional lane such as Heavy / Coverage Regression",
      prView({
        failingOptionalCheckCount: 1,
        checks: [YeetWatchCheck.make({ name: "Heavy / Coverage Regression", outcome: "fail", required: false })],
      }),
    ],
  ] as const)("flips at content-final with %s", (_name, read) => {
    // The merge gate still refuses this pull request; only the flip is early.
    expect(O.exists(read.mergeReady, (ready) => ready.criteria.requiredChecksGreen)).toBe(false);
    expect(decideYeetReadyGate(read)).toMatchObject({ _tag: "flip", prNumber: 42 });
  });

  it("flips even while the base conflicts: the flip gates threads and known reds only", () => {
    expect(decideYeetReadyGate(prView({ mergeable: "CONFLICTING" }))).toMatchObject({ _tag: "flip" });
  });

  it("reports a non-draft as already ready", () => {
    expect(decideYeetReadyGate(prView({ isDraft: false }))).toMatchObject({ _tag: "already-ready", prNumber: 42 });
  });

  it.each([
    ["no pull request", noPullRequest, "pr-open"],
    ["a closed pull request", prView({ state: "CLOSED" }), "pr-open"],
    ["a failing required check", prView({ failingRequiredCheckCount: 1 }), "no-required-red"],
    [
      "a required check row that is red",
      prView({ checks: [YeetWatchCheck.make({ name: "Lint", outcome: "fail", required: true })] }),
      "no-required-red",
    ],
    ["an unanswered review thread", prView({ unresolvedReviewThreadCount: 1 }), "threads-resolved"],
  ] as const)("refuses %s and names the blocker", (_name, read, blocker) => {
    expect(decideYeetReadyGate(read)).toMatchObject({ _tag: "blocked", blocker });
  });

  it("names the first blocker in gate order when several fail", () => {
    expect(decideYeetReadyGate(prView({ failingRequiredCheckCount: 1, unresolvedReviewThreadCount: 3 }))).toMatchObject(
      { _tag: "blocked", blocker: "no-required-red" }
    );
  });
});

// S11: a required red inherited from main, attributed with --inherited.
const lint = YeetWatchCheck.make({ name: "Lint", outcome: "fail", required: true });
const knip = YeetWatchCheck.make({ name: "Knip", outcome: "fail", required: true });
const lintInherited = YeetReadyInheritedRed.make({ check: "Lint", attribution: "red on main since 2c1cb448ba" });
const knipInherited = YeetReadyInheritedRed.make({ check: "Knip", attribution: "red on main since 9f1e0a2b3c" });
const redRead = (checks: ReadonlyArray<YeetWatchCheck>, failingRequiredCheckCount = A.length(checks)) =>
  prView({ checks, failingRequiredCheckCount });

describe("yeet ready --inherited decision (S11)", () => {
  it("flips when every failing required check is attributed, carrying the applied attributions", () => {
    const decision = decideYeetReadyGate(redRead([lint, knip]), [lintInherited, knipInherited]);
    expect(decision).toMatchObject({ _tag: "flip", prNumber: 42 });
    expect(decision._tag === "flip" ? decision.inherited : []).toEqual([lintInherited, knipInherited]);
  });

  it("the pipeable form decides the same", () => {
    expect(decideYeetReadyGate([lintInherited])(redRead([lint]))).toMatchObject({ _tag: "flip" });
  });

  it("refuses on no-required-red when only some failing required checks are attributed", () => {
    expect(decideYeetReadyGate(redRead([lint, knip]), [lintInherited])).toMatchObject({
      _tag: "blocked",
      blocker: "no-required-red",
    });
  });

  it("fails closed when the census counts more failing required checks than it names", () => {
    expect(decideYeetReadyGate(redRead([lint], 2), [lintInherited])).toMatchObject({
      _tag: "blocked",
      blocker: "no-required-red",
    });
  });

  it("drops an attribution naming a check that is not failing", () => {
    const decision = decideYeetReadyGate(redRead([lint]), [lintInherited, knipInherited]);
    expect(decision._tag === "flip" ? decision.inherited : []).toEqual([lintInherited]);
    const green = decideYeetReadyGate(prView(), [knipInherited]);
    expect(green._tag === "flip" ? green.inherited : ["not a flip"]).toEqual([]);
  });

  it("without --inherited a failing required check still refuses, and the detail names the S11 escape", () => {
    const decision = decideYeetReadyGate(redRead([lint]));
    expect(decision).toMatchObject({ _tag: "blocked", blocker: "no-required-red" });
    expect(decision._tag === "blocked" ? decision.detail : "").toMatch(
      /; under S11, attribute a red inherited from main with --inherited "<check>=<attribution>"$/u
    );
    expect(decideYeetReadyGate(prView())).toMatchObject({ _tag: "flip", inherited: [] });
  });

  it("parses --inherited as <check>=<attribution> and rejects the rest", () => {
    assertSome(
      parseYeetReadyInheritedRed("Lint = red on main since 2c1cb448ba"),
      YeetReadyInheritedRed.make({ check: "Lint", attribution: "red on main since 2c1cb448ba" })
    );
    assertNone(parseYeetReadyInheritedRed("Lint"));
    assertNone(parseYeetReadyInheritedRed("=red on main"));
  });
});

describe("spliceYeetInheritedRedsSection", () => {
  const section = (attribution: string) =>
    `<!-- yeet-inherited-reds:start -->\n## Inherited reds (S11) at ${headSha}\n\n- \`Lint\`: ${attribution}\n<!-- yeet-inherited-reds:end -->`;
  const provenance = "---\n\n<!-- yeet-provenance:start -->\n## Provenance\n<!-- yeet-provenance:end -->\n";

  it("appends the section after one blank line when the body has no marker", () => {
    assertSome(
      spliceYeetInheritedRedsSection("Summary\n", [lintInherited], headSha),
      `Summary\n\n${section(lintInherited.attribution)}\n`
    );
    assertSome(spliceYeetInheritedRedsSection("", [lintInherited], headSha), `${section(lintInherited.attribution)}\n`);
  });

  it("inserts the section before the provenance footer, its rule included", () => {
    assertSome(
      spliceYeetInheritedRedsSection(`Summary\n\n${provenance}`, [lintInherited], headSha),
      `Summary\n\n${section(lintInherited.attribution)}\n\n${provenance}`
    );
  });

  it("replaces an existing section and keeps everything around it", () => {
    const body = `Summary\n\n${section("old")}\n\nNotes\n\n${provenance}`;
    assertSome(
      spliceYeetInheritedRedsSection([lintInherited], headSha)(body),
      `Summary\n\n${section(lintInherited.attribution)}\n\nNotes\n\n${provenance}`
    );
  });

  it("rewrites a stale section to None when no inherited reds apply and keeps surrounding text", () => {
    const body = `Summary\n\n${section("old")}\n\nNotes\n\n${provenance}`;
    assertSome(
      spliceYeetInheritedRedsSection(body, [], headSha),
      `Summary\n\n<!-- yeet-inherited-reds:start -->\n## Inherited reds (S11) at ${headSha}\n\nNone: no required check is red on this head.\n<!-- yeet-inherited-reds:end -->\n\nNotes\n\n${provenance}`
    );
    assertSome(spliceYeetInheritedRedsSection(`Summary\n\n${provenance}`, [], headSha), `Summary\n\n${provenance}`);
    assertNone(spliceYeetInheritedRedsSection("<!-- yeet-inherited-reds:start -->", [], headSha));
  });

  it("refuses an orphan, repeated or out-of-order marker instead of guessing a span", () => {
    const start = "<!-- yeet-inherited-reds:start -->";
    const end = "<!-- yeet-inherited-reds:end -->";
    assertNone(spliceYeetInheritedRedsSection(`Summary\n${start}\nhand-written notes`, [lintInherited], headSha));
    assertNone(spliceYeetInheritedRedsSection(`Summary\n${end}\nthen ${start}`, [lintInherited], headSha));
    assertNone(spliceYeetInheritedRedsSection(`${section("a")}\n\n${section("b")}`, [lintInherited], headSha));
  });
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("yeet ready gate run", (it) => {
  const recordingMarkReady =
    (calls: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>, fails = false) =>
    (prNumber: number) =>
      Ref.update(calls, (all) => [...all, ["ready", `${prNumber}`]]).pipe(
        Effect.andThen(
          fails
            ? Effect.fail(
                YeetCommandError.make({
                  message: "could not mark pull request #42 ready for review: not permitted",
                  command: "bun run beep yeet gh pr ready 42",
                  exitCode: 1,
                })
              )
            : Effect.void
        )
      );
  // The flip takes the gate read twice: once to decide, once to confirm right
  // before `gh pr ready`. This fake answers the first read with `first` and
  // every later read with `later`.
  const readTwice = (first: YeetReadyPullRequestRead, later: YeetReadyPullRequestRead) =>
    Effect.map(
      Ref.make(0),
      (count) => () => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.map((n) => (n === 0 ? first : later)))
    );

  it.effect("runs gh pr ready on the read pull request when the gate holds", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
    })
  );

  it.effect("pushes the beep-reviewer re-request for the flipped head after the flip", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const requests = yield* Ref.make<ReadonlyArray<readonly [number, string]>>([]);
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: (_context, prNumber, confirmedHead) =>
          Ref.update(requests, A.append([prNumber, confirmedHead] as const)).pipe(Effect.as("[yeet] pushed")),
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
      expect(yield* Ref.get(requests)).toEqual([[42, headSha]]);
    })
  );

  it.effect("records the flip with the pull request author in the checkout's review lane ledger", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const work = yield* fs.makeTempDirectoryScoped({ prefix: "ready-gate-flip-" });
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(RepoRunContext.make({ ...context, repoRoot: work, cwd: work }), {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        readAuthor: () => Effect.succeedSome("octocat"),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      const ledger = yield* readYeetReviewLaneLedger(work);
      expect(A.map(ledger.rows, (row) => row._tag)).toEqual(["flip"]);
      assertSome(
        O.flatMap(A.head(ledger.rows), (row) => (row._tag === "flip" ? row.author : O.none())),
        "octocat"
      );
    })
  );

  it.effect("keeps the flip when the reviewer re-request push fails", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: () =>
          Effect.fail(YeetCommandError.make({ message: "git push failed", command: "git push", exitCode: 1 })),
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
    })
  );

  it("pushes the re-request only from the flipped head", () => {
    expect(reviewerRequestPushable("abcdef1234", "abcdef1234")).toBe(true);
    expect(reviewerRequestPushable("fedcba9876", "abcdef1234")).toBe(false);
    expect(reviewerRequestPushable("abcdef1234")("abcdef1234")).toBe(true);
    expect(YEET_REVIEWER_REQUEST_SUBJECT).toBe("chore: re-request beep-reviewer (S32)");
  });

  it.effect("refuses to flip when the head moved between the gate read and the confirmation", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: yield* readTwice(prView(), prView({ headSha: O.some("fedcba9876") })),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError" });
      expect(error.message).toContain("changed between the gate read and the flip");
      expect(error.message).toContain(`gate ${headSha}, live fedcba9876`);
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("refuses to flip when the same head picks up a new thread before the confirmation", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: yield* readTwice(prView(), prView({ unresolvedReviewThreadCount: 1 })),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError" });
      expect(error.message).toContain("now blocked on threads-resolved");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("refuses with a typed error naming the blocker and never calls gh", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ unresolvedReviewThreadCount: 2 })),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "threads-resolved" });
      expect(error.message).toContain("blocked on threads-resolved");
      expect(error.message).toContain("2 review thread(s) still owe an answer");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("refuses on final-check when the head has no passing receipt and never calls gh", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const refuse = (finalCheck: typeof passingFinalCheck) =>
        runYeetReadyGate(context, {
          finalCheck,
          refresh: () => Effect.succeedNone,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          read: () => Effect.succeed(prView()),
          markReady: recordingMarkReady(calls),
        }).pipe(Effect.flip);
      const missing = yield* refuse(() => Effect.succeedNone);
      expect(missing).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(missing.message).toContain(`no final-check receipt for head ${headSha}`);
      expect(missing.message).toContain("bun run beep yeet final-check");
      const failing = yield* refuse((_context, head) =>
        Effect.map(
          passingFinalCheck(_context, head),
          O.map((receipt) => FinalCheckReceipt.make({ ...receipt, verdict: "fail" }))
        )
      );
      expect(failing).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("flips a head with no receipt when the refresh rule carries an ancestor receipt", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const receiptHead = Str.repeat(40)("r");
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: () => Effect.succeedNone,
        refresh: (_context, head) =>
          Effect.map(passingFinalCheck(_context, receiptHead), (receipt) =>
            O.map(receipt, (found) =>
              FinalCheckRefreshPass.make({
                receipt: found,
                finalHead: head,
                ownChanges: [
                  FinalCheckRefreshOwnChange.make({
                    path: "standards/schema-first.inventory.jsonc",
                    allowance: O.some("standards-inventory"),
                  }),
                  FinalCheckRefreshOwnChange.make({ path: "unknown.txt", allowance: O.none() }),
                ],
              })
            )
          ),
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain(`carries the receipt of ancestor ${receiptHead}`);
      expect(printed).toContain("standards/schema-first.inventory.jsonc (standards-inventory)");
      expect(printed).toContain("unknown.txt (not allowed)");
      expect(printed).toContain(`final <sha40> #42 receipt ${receiptHead}`);
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
    })
  );

  it.effect("renders an ancestor receipt without own changes and without a skipped-gate reason", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const receiptHead = Str.repeat(40)("r");
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: () => Effect.succeedNone,
        refresh: (_context, head) =>
          Effect.map(passingFinalCheck(_context, receiptHead), (receipt) =>
            O.map(receipt, (found) =>
              FinalCheckRefreshPass.make({
                receipt: FinalCheckReceipt.make({
                  ...found,
                  steps: [
                    FinalCheckStepResult.make({
                      gate: "coverage",
                      label: "final-check:coverage",
                      hostedContext: "Heavy / Coverage Regression",
                      command: "(skipped)",
                      status: "skipped",
                      durationMs: 0,
                    }),
                  ],
                }),
                finalHead: head,
                ownChanges: [],
              })
            )
          ),
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain("own changes since the receipt: none");
      expect(printed).toContain("coverage (no reason)");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
    })
  );

  it.effect("refuses on final-check when the refresh rule refuses and never calls gh", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const receiptHead = Str.repeat(40)("r");
      const error = yield* runYeetReadyGate(context, {
        finalCheck: () => Effect.succeedNone,
        refresh: (_context, head) =>
          Effect.succeedSome(
            FinalCheckRefreshRefused.make({
              receiptHead,
              finalHead: head,
              reason: "own-change-outside-allowlist",
              ownChanges: [FinalCheckRefreshOwnChange.make({ path: "src/index.ts", allowance: O.none() })],
              detail: "the lane changed 1 file(s) outside the refresh allowlist after the receipt: src/index.ts",
            })
          ),
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(error.message).toContain(`no final-check receipt for head ${headSha}`);
      expect(error.message).toContain(
        `the nearest ancestor receipt, on ${Str.slice(0, 12)(receiptHead)}, does not carry`
      );
      expect(error.message).toContain("src/index.ts");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("refuses with the refresh detail alone when a receipt is malformed", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const detail = `the final-check receipt for head ${headSha} exists but does not decode`;
      const error = yield* runYeetReadyGate(context, {
        finalCheck: () => Effect.succeedNone,
        refresh: (_context, head) =>
          Effect.succeedSome(
            FinalCheckRefreshRefused.make({
              receiptHead: head,
              finalHead: head,
              reason: "malformed-receipt",
              ownChanges: [],
              detail,
            })
          ),
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(error.message).toContain(detail);
      expect(error.message).not.toContain("nearest ancestor receipt, on");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("never consults the refresh rule when the head has a failing receipt of its own", () =>
    Effect.gen(function* () {
      const consulted = yield* Ref.make(false);
      const error = yield* runYeetReadyGate(context, {
        finalCheck: (_context, head) =>
          Effect.map(
            passingFinalCheck(_context, head),
            O.map((receipt) => FinalCheckReceipt.make({ ...receipt, verdict: "fail" }))
          ),
        refresh: () => Ref.set(consulted, true).pipe(Effect.as(O.none())),
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: () => Effect.void,
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(yield* Ref.get(consulted)).toBe(false);
    })
  );

  it.effect("names the gates a passing final-check receipt skipped before the flip", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: (_context, head) =>
          Effect.map(
            passingFinalCheck(_context, head),
            O.map((receipt) =>
              FinalCheckReceipt.make({
                ...receipt,
                steps: [
                  FinalCheckStepResult.make({
                    gate: "coverage",
                    label: "final-check:coverage",
                    hostedContext: "Heavy / Coverage Regression",
                    command: "(skipped)",
                    status: "skipped",
                    durationMs: 0,
                    reason: "admission waited 10 minutes",
                  }),
                  FinalCheckStepResult.make({
                    gate: "fallow",
                    label: "final-check:fallow",
                    hostedContext: "Fallow Advisory Envelopes",
                    command: "(skipped)",
                    status: "skipped",
                    durationMs: 0,
                  }),
                ],
              })
            )
          ),
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain(
        "pass with 2 skipped gate(s): coverage (admission waited 10 minutes); fallow (no reason)"
      );
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
    })
  );

  it.effect("names the current head and the red check when a required check is failing", () =>
    Effect.gen(function* () {
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () =>
          Effect.succeed(
            prView({
              failingRequiredCheckCount: 1,
              checks: [YeetWatchCheck.make({ name: "Lint", outcome: "fail", required: true })],
            })
          ),
        markReady: () => Effect.die("the flip must not run"),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "no-required-red" });
      expect(error.message).toContain(`1 required check(s) are failing on head ${headSha} (Lint)`);
    })
  );

  it.effect("flips with hosted heavy checks still pending and says the review window starts", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ pendingOptionalCheckCount: 9, pendingRequiredCheckCount: 1 })),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain("the review window starts now");
      expect(printed).toContain("do not merge in this step");
    })
  );

  it.effect("warns with the offending line when the squash message would fail commitlint, and still flips", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        recordInherited: () => Effect.void,
        finalCheck: passingFinalCheck,
        squashCommitlint: failingSquashCommitlint,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain(
        "[yeet] warning: the squash commit message GitHub will write for #42 fails commitlint: footer-max-line-length at line 3 (102 chars)"
      );
      expect(printed).toContain(`"${longBullet}"`);
      expect(printed).toContain("The merge gate holds on squash-commitlint");
      // The advisory precedes the flip in the log (TestConsole accumulates across this block, so compare the last run).
      expect(O.getOrElse(constant(-1))(Str.lastIndexOf("squash commit message")(printed))).toBeLessThan(
        O.getOrElse(constant(-1))(Str.lastIndexOf("flipped from draft")(printed))
      );
    })
  );

  it.effect("prints a passing squash-commitlint line and loses only the advice when the read fails", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      yield* runYeetReadyGate(context, {
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ isDraft: false })),
        markReady: () => Effect.die("the flip must not run"),
      });
      yield* runYeetReadyGate(context, {
        recordInherited: () => Effect.void,
        finalCheck: passingFinalCheck,
        squashCommitlint: () => Effect.fail(YeetCommandError.make({ message: "gh api pulls failed", exitCode: 1 })),
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain("[yeet] squash-commitlint #42: pass");
      expect(printed).toContain("[yeet] warning: squash-commitlint check skipped for #42");
    })
  );

  it.effect("reads a non-draft pull request with an open thread as already ready, never as a pending flip", () =>
    Effect.gen(function* () {
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ isDraft: false, unresolvedReviewThreadCount: 1 })),
        markReady: () => Effect.die("the flip must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  it.effect("refuses a closed or merged non-draft pull request on pr-open instead of calling it ready", () =>
    Effect.gen(function* () {
      for (const state of ["CLOSED", "MERGED"] as const) {
        const error = yield* runYeetReadyGate(context, {
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          read: () => Effect.succeed(prView({ isDraft: false, state })),
          markReady: () => Effect.die("the flip must not run"),
        }).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "pr-open" });
        expect(error.message).toContain(state);
      }
    })
  );

  it.effect("does not call gh for a pull request that is already ready", () =>
    Effect.gen(function* () {
      const decision = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ isDraft: false })),
        markReady: () => Effect.die("the flip must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  const recordingRecord =
    (calls: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>, fails = false) =>
    (prNumber: number, entries: ReadonlyArray<YeetReadyInheritedRed>) =>
      Ref.update(calls, (all) => [...all, ["record", `${prNumber}`, ...A.map(entries, (entry) => entry.check)]]).pipe(
        Effect.andThen(
          fails ? Effect.fail(YeetCommandError.make({ message: "could not record: 403", exitCode: 1 })) : Effect.void
        )
      );

  it.effect("records the inherited reds before the flip, after the confirmation re-read", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const reads = yield* Ref.make(0);
      const decision = yield* runYeetReadyGate(
        context,
        {
          read: () => Ref.update(reads, (n) => n + 1).pipe(Effect.as(redRead([lint]))),
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: recordingRecord(calls),
          markReady: recordingMarkReady(calls),
          requestReview: stubReviewerRequest,
          findMonitor: () => Effect.succeedNone,
        },
        [lintInherited, knipInherited]
      );
      expect(decision._tag).toBe("flip");
      // The confirmation decided with the same --inherited list, or it would have refused on Lint.
      expect(yield* Ref.get(reads)).toBe(3);
      expect(yield* Ref.get(calls)).toEqual([
        ["record", "42", "Lint"],
        ["ready", "42"],
      ]);
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain(
        "[yeet] note: --inherited Knip is not a failing required check on this head; ignored (optional reds never hold the flip)"
      );
      expect(printed).toContain("[yeet] recorded 1 inherited red(s) in the PR body");
    })
  );

  it.effect("refuses the flip when the inherited reds cannot be recorded", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(
        context,
        {
          read: () => Effect.succeed(redRead([lint])),
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: recordingRecord(calls, true),
          markReady: () => Effect.die("the flip must not run"),
        },
        [lintInherited]
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError" });
      expect(error.message).toContain("could not record: 403");
      expect(yield* Ref.get(calls)).toEqual([["record", "42", "Lint"]]);
    })
  );

  it.effect("reconciles an empty attribution list before flipping", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      yield* runYeetReadyGate(
        context,
        {
          read: () => Effect.succeed(prView()),
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: recordingRecord(calls),
          markReady: recordingMarkReady(calls),
          requestReview: stubReviewerRequest,
          findMonitor: () => Effect.succeedNone,
        },
        [lintInherited]
      );
      expect(yield* Ref.get(calls)).toEqual([
        ["record", "42"],
        ["ready", "42"],
      ]);
    })
  );

  it.effect("fails with a command error when the ready flip fails", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView()),
        markReady: recordingMarkReady(calls, true),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError", command: "bun run beep yeet gh pr ready 42" });
      expect(error.message).toContain("not permitted");
    })
  );
});

const fakeHandle = (output: string, exitCode = 0) =>
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
const mockSpawner = ChildProcessSpawner.make((command) =>
  Effect.succeed(fakeHandle("[]", ChildProcess.isStandardCommand(command) && command.command === "gh" ? 1 : 0))
);
const readyPlatform = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  BunCrypto.layer,
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, mockSpawner)
);
it.layer(readyPlatform, { timeout: "10 seconds" })("ready gate runtime boundaries", (it) => {
  it.effect("uses the real ancestor lookup when the head receipt is missing and refuses an empty store", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<number>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        markReady: (prNumber) => Ref.update(calls, (all) => A.append(all, prNumber)),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(error.message).toContain(`no final-check receipt for head ${headSha}`);
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  const fallbackRunner = (lookup: string, lookupExit = 0, comments = "[]", restStatus = "OPEN") =>
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
      const route = A.join(A.take(command.args, 2), " ");
      if (command.command === "git") {
        return Effect.succeed(fakeHandle("git@github.com:beep/beep.git"));
      }
      if (route === "pr view" || route === "api graphql") {
        return Effect.succeed(fakeHandle("GraphQL: API rate limit exceeded", 1));
      }
      if (Str.includes("pulls?head=")(route)) return Effect.succeed(fakeHandle(lookup, lookupExit));
      if (Str.includes("/comments?")(route)) return Effect.succeed(fakeHandle(comments));
      if (Str.endsWith("/pulls/42")(route)) {
        return Effect.succeed(
          fakeHandle(
            `{"headRefOid":"abc1234def","id":"PR_ready","isDraft":true,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"DRAFT","number":42,"reviewDecision":null,"state":"${restStatus}","url":"https://github.com/beep/beep/pull/42"}`
          )
        );
      }
      return Effect.succeed(fakeHandle("[]"));
    });
  const restFound = '[{"number":42,"headRefName":"feature/ready-gate","state":"OPEN"}]';

  it.effect("recovers the ready read through REST while GraphQL is rate limited", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetStatus(context, true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, fallbackRunner(restFound))
      );
      expect(snapshot.remote.available).toBe(true);
      assertNone(snapshot.remote.readFailure);
      expect(snapshot.remote.unresolvedReviewThreadCount).toBe(0);
      expect(
        decideYeetReadyGate(
          YeetReadyPullRequestRead.make({
            remote: snapshot.remote,
            mergeReady: snapshot.mergeReady,
          })
        )
      ).toMatchObject({ _tag: "flip", prNumber: 42 });
    })
  );

  it.effect("keeps an unread REST review decision unknown and blocks merge readiness", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetStatus(context, true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, fallbackRunner(restFound))
      );
      expect(snapshot.remote.available).toBe(true);
      expect(snapshot.remote.reviewDecision).toBe("UNKNOWN");
      const mergeReady = snapshot.mergeReady;
      assertSome(
        O.map(mergeReady, (value) => value.criteria.reviewDecisionAcceptable),
        false
      );
      assertSome(
        O.map(mergeReady, (value) => value.ready),
        false
      );
    })
  );

  it.effect("reports absence only after REST successfully confirms no branch PR", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetStatus(context, true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, fallbackRunner("[]"))
      );
      expect(snapshot.remote.available).toBe(false);
      assertNone(snapshot.remote.readFailure);
      expect(
        decideYeetReadyGate(
          YeetReadyPullRequestRead.make({
            remote: snapshot.remote,
            mergeReady: snapshot.mergeReady,
          })
        )
      ).toMatchObject({
        _tag: "blocked",
        blocker: "pr-open",
        detail: "no open pull request was found for this branch",
      });
    })
  );

  it.effect("retains the read failure when the REST lookup fails too", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetStatus(context, true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, fallbackRunner("REST unavailable", 1))
      );
      expect(snapshot.remote.available).toBe(false);
      assertTrue(snapshot.remote.readFailure.pipe(O.isSome));
      expect(snapshot.remote.detail).toContain("REST unavailable");
      const decision = decideYeetReadyGate(
        YeetReadyPullRequestRead.make({
          remote: snapshot.remote,
          mergeReady: snapshot.mergeReady,
        })
      );
      expect(decision).toMatchObject({ _tag: "blocked", blocker: "pr-open" });
      if (decision._tag === "blocked")
        expect(decision.detail).toContain(
          "could not read the pull request: gh pr view failed: GraphQL: API rate limit exceeded"
        );
    })
  );

  it.effect("blocks when the recovered PR has closed since the branch lookup", () =>
    Effect.gen(function* () {
      const snapshot = yield* collectYeetStatus(context, true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, fallbackRunner(restFound, 0, "[]", "CLOSED"))
      );
      expect(
        decideYeetReadyGate(
          YeetReadyPullRequestRead.make({
            remote: snapshot.remote,
            mergeReady: snapshot.mergeReady,
          })
        )
      ).toMatchObject({ _tag: "blocked", blocker: "pr-open", detail: "pull request #42 is CLOSED" });
    })
  );

  it.effect("refuses to treat existing review comments as resolved threads", () =>
    Effect.gen(function* () {
      const failure = yield* collectYeetStatus(context, true).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, fallbackRunner(restFound, 0, "[{}]")),
        Effect.flip
      );
      expect(failure.message).toContain("thread resolution is unknown");
    })
  );

  it.effect("degrades remote status when REST status cannot be read", () =>
    Effect.gen(function* () {
      for (const [output, exitCode, detail] of [
        ["REST status unavailable", 1, "Failed to read PR status through GitHub REST."],
        ["invalid status JSON", 0, "Failed to decode GitHub REST PR status."],
      ] as const) {
        const base = fallbackRunner(restFound);
        const runner = ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
          const route = command.args[1] ?? "";
          return command.command === "gh" && Str.includes("/pulls/42")(route)
            ? Effect.succeed(fakeHandle(output, exitCode))
            : base.spawn(command);
        });
        const snapshot = yield* collectYeetStatus(context, true).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner)
        );
        expect(snapshot.remote.available).toBe(false);
        assertTrue(snapshot.remote.readFailure.pipe(O.isSome));
        expect(snapshot.remote.detail).toBe(
          `gh pr view failed: GraphQL: API rate limit exceeded; REST fallback: ${detail}`
        );
      }
    })
  );

  it.effect("fails when REST review comments cannot be read", () =>
    Effect.gen(function* () {
      for (const [output, exitCode, detail] of [
        ["comments unavailable", 1, "Could not read REST review comments."],
        ["invalid comments JSON", 0, "Could not decode REST review comments."],
      ] as const) {
        const base = fallbackRunner(restFound);
        const runner = ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
          const route = command.args[1] ?? "";
          return command.command === "gh" && Str.includes("/comments?")(route)
            ? Effect.succeed(fakeHandle(output, exitCode))
            : base.spawn(command);
        });
        const failure = yield* collectYeetStatus(context, true).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner),
          Effect.flip
        );
        expect(failure.message).toContain(`REST fallback: ${detail}`);
      }
    })
  );

  it.effect("recovers truncated and unstartable primary reads and tolerates unavailable workflow runs", () =>
    Effect.gen(function* () {
      const spawnFailure = Effect.fail(PlatformError.badArgument({ module: "ChildProcess", method: "spawn" }));
      for (const [failedRoute, response] of [
        ["pr view", Effect.succeed(fakeHandle(Str.repeat(512 * 1024 + 1)("x")))],
        ["pr view", spawnFailure],
        ["run list", spawnFailure],
      ] as const) {
        const base = fallbackRunner(restFound);
        const runner = ChildProcessSpawner.make((command) => {
          if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
          const route = A.join(A.take(command.args, 2), " ");
          if (command.command === "gh" && route === failedRoute) return response;
          return base.spawn(command);
        });
        const snapshot = yield* collectYeetStatus(context, true).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner)
        );
        expect(snapshot.remote.available).toBe(true);
        expect(snapshot.remote.reviewDecision).toBe("UNKNOWN");
        assertNone(snapshot.remote.readFailure);
      }
    })
  );

  it.effect("treats failed artifact existence probes as unreadable local evidence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const snapshot = yield* collectYeetStatus(context, false).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          exists: () => Effect.fail(PlatformError.badArgument({ module: "FileSystem", method: "exists" })),
        })
      );
      expect(snapshot.verdict.state).toBe("unreadable");
      expect(snapshot.verdict.detail).toBe("verdict artifact could not be read");
      expect(snapshot.closeout.state).toBe("unreadable");
      expect(snapshot.closeout.detail).toBe("closeout artifact could not be read");
    })
  );

  it.effect("confirms and flips through the default remote reader", () =>
    Effect.gen(function* () {
      const runner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
        const route = A.join(A.take(command.args, 2), " ");
        const answers: Readonly<Record<string, string>> = {
          "pr view":
            '{"headRefOid":"abc1234def","id":"PR_ready","isDraft":true,"labels":[],"mergeable":"MERGEABLE","mergeStateStatus":"DRAFT","number":42,"reviewDecision":null,"state":"OPEN","url":"https://github.com/beep/beep/pull/42"}',
          "pr checks":
            '[{"bucket":"pass","completedAt":"2026-10-01T00:00:00Z","link":"","name":"Check","startedAt":"2026-10-01T00:00:00Z","state":"SUCCESS","workflow":"Check"}]',
          "api graphql":
            '{"data":{"node":{"author":{"login":"author"},"reviewThreads":{"nodes":[],"pageInfo":{"endCursor":null,"hasNextPage":false}}}}}',
          "run list": "[]",
        };
        return Effect.succeed(fakeHandle(command.command === "gh" ? (answers[route] ?? "") : ""));
      });
      expect(
        (yield* runYeetReadyGate(context, {
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          markReady: () => Effect.void,
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, runner)))._tag
      ).toBe("flip");
    })
  );
  it.effect("reads remote status through the default reader", () =>
    Effect.gen(function* () {
      expect((yield* runYeetReadyGate(context).pipe(Effect.flip))._tag).toBe("YeetReadyGateRefused");
    })
  );
  it.effect("hydrates the command context before its default remote read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(`${process.cwd()}/.git`, { recursive: true });
      const error = yield* runYeetReady(
        YeetReadyOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet", inherited: [] })
      ).pipe(Effect.flip);
      expect(error._tag).toBe("YeetReadyGateRefused");
    })
  );
  it.effect("refuses a malformed --inherited before reading anything", () =>
    Effect.gen(function* () {
      const spawned = yield* Ref.make(0);
      const counting = ChildProcessSpawner.make(() =>
        Ref.update(spawned, (n) => n + 1).pipe(Effect.as(fakeHandle("", 1)))
      );
      const error = yield* runYeetReady(
        YeetReadyOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet", inherited: ["Lint"] })
      ).pipe(Effect.flip, Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, counting));
      expect(error).toMatchObject({ _tag: "YeetCommandError" });
      expect(error.message).toContain('--inherited needs "<check name>=<attribution>"; got "Lint".');
      expect(yield* Ref.get(spawned)).toBe(0);
    })
  );
  it.effect("loses only the hint when the monitor registry is unreadable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const failingFs = FileSystem.FileSystem.of({
        ...fs,
        exists: Effect.fn("ReadyTest.exists")(() =>
          Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "ReadyTest", method: "exists" }))
        ),
      });
      expect(
        (yield* runYeetReadyGate(context, {
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          read: () => Effect.succeed(prView()),
          markReady: () => Effect.void,
        }).pipe(Effect.provideService(FileSystem.FileSystem, failingFs)))._tag
      ).toBe("flip");
    })
  );
  it.effect("reads an empty monitor registry after the flip", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/repo/.beep/yeet/jobs", { recursive: true });
      yield* fs.remove("/repo/.beep/yeet/jobs/.guard", { recursive: true, force: true });
      yield* fs.writeFileString("/repo/.beep/yeet/jobs/.guard", "");
      expect(
        (yield* runYeetReadyGate(context, {
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          read: () => Effect.succeed(prView()),
          markReady: () => Effect.void,
        }))._tag
      ).toBe("flip");
    })
  );
});
it.layer(NodeServices.layer, { timeout: "10 seconds" })("ready confirmation races", (it) => {
  it.effect("rewrites a recorded section to None on a no-red rerun after a post-record refusal", () =>
    Effect.gen(function* () {
      const body = yield* Ref.make("Summary");
      const green = yield* Ref.make(false);
      const flips = yield* Ref.make(0);
      const currentHead = yield* Ref.make(headSha);
      const dependencies = {
        read: Effect.fnUntraced(function* () {
          const sha = yield* Ref.get(currentHead);
          return (yield* Ref.get(green)) ? prView({ headSha: O.some(sha) }) : redRead([lint]);
        }),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: (_pr: number, entries: ReadonlyArray<YeetReadyInheritedRed>, sha: string) =>
          Ref.update(body, (source) => O.getOrThrow(spliceYeetInheritedRedsSection(source, entries, sha))).pipe(
            Effect.andThen(Ref.set(green, true))
          ),
        markReady: () => Ref.update(flips, (n) => n + 1),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      };
      const error = yield* runYeetReadyGate(context, dependencies, [lintInherited]).pipe(Effect.flip);
      expect(error.message).toContain("changed while recording inherited reds");
      expect(yield* Ref.get(body)).toContain("- `Lint`:");
      expect(yield* Ref.get(flips)).toBe(0);
      yield* Ref.set(currentHead, "fedcba9876");
      expect((yield* runYeetReadyGate(context, dependencies))._tag).toBe("flip");
      expect(yield* Ref.get(body)).toContain("None: no required check is red on this head.");
      expect(yield* Ref.get(body)).toContain("Inherited reds (S11) at fedcba9876");
      expect(yield* Ref.get(body)).not.toContain("- `Lint`:");
      expect(yield* Ref.get(body)).toContain("Summary");
      expect(yield* Ref.get(flips)).toBe(1);
    })
  );

  it.effect("rewrites inherited reds after a draft-ready-draft-ready cycle", () =>
    Effect.gen(function* () {
      const body = yield* Ref.make("Summary");
      const draft = yield* Ref.make(true);
      const green = yield* Ref.make(false);
      const sha = yield* Ref.make(headSha);
      const dependencies = {
        read: Effect.fnUntraced(function* () {
          const isDraft = yield* Ref.get(draft);
          const current = yield* Ref.get(sha);
          return (yield* Ref.get(green))
            ? prView({ isDraft, headSha: O.some(current) })
            : prView({ checks: [lint], failingRequiredCheckCount: 1, isDraft, headSha: O.some(current) });
        }),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: (_pr: number, entries: ReadonlyArray<YeetReadyInheritedRed>, head: string) =>
          Ref.update(body, (source) => O.getOrThrow(spliceYeetInheritedRedsSection(source, entries, head))),
        markReady: () => Ref.set(draft, false),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      };
      expect((yield* runYeetReadyGate(context, dependencies, [lintInherited]))._tag).toBe("flip");
      expect(yield* Ref.get(body)).toContain("- `Lint`:");
      expect((yield* runYeetReadyGate(context, dependencies))._tag).toBe("already-ready");
      yield* Ref.set(draft, true);
      yield* Ref.set(green, true);
      yield* Ref.set(sha, "fedcba9876");
      expect((yield* runYeetReadyGate(context, dependencies))._tag).toBe("flip");
      expect(yield* Ref.get(body)).toContain("Inherited reds (S11) at fedcba9876");
      expect(yield* Ref.get(body)).toContain("None: no required check is red on this head.");
      expect(yield* Ref.get(body)).not.toContain("- `Lint`:");
    })
  );

  it.effect("refuses a head change during the inherited-red body write", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const error = yield* runYeetReadyGate(
        context,
        {
          read: () =>
            Ref.getAndUpdate(reads, (n) => n + 1).pipe(
              Effect.map((n) => (n < 2 ? redRead([lint]) : prView({ headSha: O.some(Str.repeat(40)("b")) })))
            ),
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          markReady: () => Effect.die("a moved head must not flip"),
        },
        [lintInherited]
      ).pipe(Effect.flip);
      expect(error.message).toContain("changed while recording inherited reds");
    })
  );
  it.effect("refuses a new blocker during the inherited-red body write", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const error = yield* runYeetReadyGate(
        context,
        {
          read: () =>
            Ref.getAndUpdate(reads, (n) => n + 1).pipe(
              Effect.map((n) => (n < 2 ? redRead([lint]) : redRead([lint, knip])))
            ),
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          markReady: () => Effect.die("a new red must not flip"),
        },
        [lintInherited]
      ).pipe(Effect.flip);
      expect(error.message).toContain("changed while recording inherited reds");
    })
  );
  it.effect("refuses changed applied attributions after the body write even when the gate passes", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const error = yield* runYeetReadyGate(
        context,
        {
          read: () =>
            Ref.getAndUpdate(reads, (n) => n + 1).pipe(Effect.map((n) => (n < 2 ? redRead([lint]) : prView()))),
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          markReady: () => Effect.die("stale attributions must not flip"),
        },
        [lintInherited]
      ).pipe(Effect.flip);
      expect(error.message).toContain("changed while recording inherited reds");
    })
  );
  it.effect("refuses a new blocker after empty-section cleanup without inherited-red refusal wording", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const error = yield* runYeetReadyGate(context, {
        read: () =>
          Ref.getAndUpdate(reads, (n) => n + 1).pipe(
            Effect.map((n) => prView({ unresolvedReviewThreadCount: n < 2 ? 0 : 1 }))
          ),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        markReady: () => Effect.die("a new blocker must still refuse the default flip"),
      }).pipe(Effect.flip);
      expect(error.message).toContain("changed while reconciling the inherited-reds section");
      expect(error.message).not.toContain("changed while recording inherited reds");
      expect(error.message).not.toContain("S11 requires the record");
    })
  );
  it.effect("refuses another flip after an actor already marked the PR ready", () =>
    Effect.gen(function* () {
      const count = yield* Ref.make(0);
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Ref.getAndUpdate(count, (n) => n + 1).pipe(Effect.map((n) => prView({ isDraft: n === 0 }))),
      }).pipe(Effect.flip);
      expect(error.message).toContain("already ready for review");
    })
  );
  it.effect("refuses a flip without a head identity", () =>
    Effect.gen(function* () {
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ headSha: O.none() })),
      }).pipe(Effect.flip);
      expect(error.message).toContain("gate unknown, live unknown");
    })
  );
  it.effect("reads the head's receipt from the checkout by default and refuses when it is absent", () =>
    Effect.gen(function* () {
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        markReady: () => Effect.die("the flip must not run without a final-check receipt"),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "final-check" });
      expect(error.message).toContain(`no final-check receipt for head ${headSha}`);
    })
  );
  it.effect("maps an unavailable GitHub token on the default flip to the command error", () =>
    Effect.gen(function* () {
      // Every child process (`gh auth token`) fails, so no request reaches GitHub.
      const refusing = ChildProcessSpawner.make(() => Effect.succeed(fakeHandle("", 1)));
      const error = yield* runYeetReadyGate(context, {
        finalCheck: passingFinalCheck,
        read: () => Effect.succeed(prView()),
      }).pipe(Effect.flip, Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, refusing));
      expect(error).toMatchObject({ _tag: "YeetCommandError", command: "bun run beep yeet gh pr ready 42" });
      expect(error.message).toContain("could not mark pull request #42 ready for review");
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain("[yeet] warning:");
      expect(printed).not.toContain("S11 requires the record");
    })
  );
  it.effect("flips with a warning when the REST body read fails with no applied inherited reds", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const reads = yield* Ref.make(0);
      const rest = {
        pullRequest: () =>
          Ref.update(reads, (n) => n + 1).pipe(
            Effect.andThen(
              Effect.fail(
                GitHubError.make({ kind: "rateLimited", operation: "pullRequest", reason: "REST body read failed" })
              )
            )
          ),
        updatePullRequest: () => Effect.die("a failed body read must not write"),
      };
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: (prNumber, entries, head) =>
          recordInheritedRedsWithRest(rest, prNumber, entries, head).pipe(
            Effect.mapError((cause) => YeetCommandError.make({ message: cause.message, exitCode: 1 }))
          ),
        markReady: (prNumber) => Ref.update(calls, A.append(["ready", `${prNumber}`])),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(reads)).toBe(1);
      expect(yield* Ref.get(calls)).toEqual([["ready", "42"]]);
      const printed = A.join(A.map(yield* TestConsole.logLines, String), "\n");
      expect(printed).toContain("[yeet] warning:");
      expect(printed).toContain("REST body read failed");
      expect(printed).not.toContain("S11 requires the record");
    })
  );
  it.effect("flips with a warning when empty inherited-red cleanup fails to write", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: (prNumber) =>
          Ref.update(calls, A.append(["record", `${prNumber}`])).pipe(
            Effect.andThen(Effect.fail(YeetCommandError.make({ message: "body write failed", exitCode: 1 })))
          ),
        markReady: (prNumber) => Ref.update(calls, A.append(["ready", `${prNumber}`])),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([
        ["record", "42"],
        ["ready", "42"],
      ]);
      expect(A.join(A.map(yield* TestConsole.logLines, String), "\n")).toContain("[yeet] warning:");
    })
  );
  it.effect("refuses the flip when the default inherited-red recorder cannot acquire its identity", () =>
    Effect.gen(function* () {
      const refusing = ChildProcessSpawner.make(() => Effect.succeed(fakeHandle("", 1)));
      const error = yield* runYeetReadyGate(
        context,
        {
          finalCheck: passingFinalCheck,
          read: () => Effect.succeed(redRead([lint])),
          markReady: () => Effect.die("the flip must not run before the record succeeds"),
        },
        [lintInherited]
      ).pipe(Effect.flip, Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, refusing));
      expect(error).toMatchObject({ _tag: "YeetCommandError", exitCode: 1 });
      expect(error.message).toContain("could not record the inherited reds in the body of #42");
      expect(error.message).toContain("S11 requires the record before the flip");
    })
  );
  it.effect("reports the existing monitor after a successful flip", () =>
    Effect.gen(function* () {
      const record = ProofJobRecord.make({
        jobId: "cc5d6bd3-1111-4aaa-8bbb-000000000001",
        phase: "running",
        submittedAt: "2026-10-05T10:00:00.000Z",
        request: ProofJobRequest.make({
          mode: "monitor",
          argv: ["monitor", "--until-ready"],
          checkout: "/repo",
          branch: context.branch,
          base: "origin/main",
          head: headSha,
          forwardedEnvNames: [],
        }),
        submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
        unit: ProofJobUnit.make({
          unitName: "beep-proof-test.service",
          slice: "agent-runs.slice",
          description: "test",
          logPath: "/repo/test.log",
          execStart: ["bun"],
          execStopPost: ["bun"],
          maxRuntimeSeconds: O.none(),
          invocationId: O.none(),
        }),
        runner: O.none(),
        outcome: O.none(),
        systemd: O.none(),
        terminationReason: O.none(),
        cancelRequestedAt: O.none(),
        prNumber: O.some(42),
      });
      expect(
        (yield* runYeetReadyGate(context, {
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          read: () => Effect.succeed(prView()),
          markReady: () => Effect.void,
          requestReview: stubReviewerRequest,
          findMonitor: () => Effect.succeedSome(record),
        }))._tag
      ).toBe("flip");
    })
  );
});

describe("ready gate incomplete remote identities", () => {
  it("reports a closed remote whose number is absent", () => {
    const read = prView({ state: "CLOSED" });
    const decision = decideYeetReadyGate(
      YeetReadyPullRequestRead.make({
        ...read,
        remote: YeetStatusRemote.make(Struct.omit(read.remote, ["number"])),
      })
    );
    expect(decision).toMatchObject({ _tag: "blocked", detail: "pull request #? is CLOSED" });
  });
  it("fails closed if a successful verdict lacks a PR number", () => {
    const read = prView();
    expect(
      decideYeetReadyGate(
        YeetReadyPullRequestRead.make({
          ...read,
          remote: YeetStatusRemote.make(Struct.omit(read.remote, ["number"])),
        })
      )._tag
    ).toBe("blocked");
  });
  it("reports an unknown head for checks that cannot be proven green", () => {
    expect(decideYeetReadyGate(prView({ headSha: O.none(), failingRequiredCheckCount: 1 }))).toMatchObject({
      _tag: "blocked",
      detail: expect.stringContaining("on head unknown"),
    });
  });
  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect("refuses a successful verdict with no head identity before capture", () =>
      Effect.gen(function* () {
        const read = prView();
        const withoutHead = YeetReadyPullRequestRead.make({
          ...read,
          remote: YeetStatusRemote.make({ ...read.remote, headSha: O.none() }),
        });
        const error = yield* runYeetReadyGate(context, {
          finalCheck: passingFinalCheck,
          squashCommitlint: passingSquashCommitlint,
          recordInherited: () => Effect.void,
          read: () => Effect.succeed(withoutHead),
        }).pipe(Effect.flip);
        expect(error.message).toContain("gate unknown, live unknown");
      })
    );
  });
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("ready head after the GraphQL budget wait", (it) => {
  const waitingFlip = Effect.fnUntraced(function* (replenished: boolean) {
    const liveHead = yield* Ref.make(headSha);
    const mutations = yield* Ref.make(0);
    const restReads = yield* Ref.make(0);
    const probes = yield* Ref.make(0);
    const client = GitHubClient.layerTest({
      requestDecoded: dual(
        3,
        Effect.fnUntraced(function* <A, I>(_route: string, _params: Record<string, unknown>, schema: S.Codec<A, I>) {
          yield* Ref.update(restReads, (n) => n + 1);
          return yield* S.decodeUnknownEffect(schema)({
            number: 42,
            node_id: "PR_ready",
            title: "Ready head",
            body: "",
            state: "open",
            draft: true,
            merged: false,
            merged_at: null,
            mergeable_state: "clean",
            head: { ref: "feature/ready-gate", sha: yield* Ref.get(liveHead) },
            base: { ref: "main" },
            html_url: "https://github.com/beep/beep/pull/42",
            user: { login: "author" },
            labels: [],
            created_at: "2026-10-01T00:00:00Z",
            updated_at: "2026-10-01T00:00:00Z",
          }).pipe(Effect.orDie);
        })
      ),
      graphql: dual(
        2,
        Effect.fnUntraced(function* <A, V extends Record<string, unknown>>(
          document: GraphQLDocument<A, V>,
          _variables: V
        ) {
          if (document.name === "rateLimit") {
            const probe: number = yield* Ref.getAndUpdate(probes, (n) => n + 1);
            return yield* document
              .decode({
                rateLimit: {
                  remaining: probe > 0 && replenished ? 5000 : 0,
                  resetAt: "1970-01-01T00:10:00Z",
                },
              })
              .pipe(Effect.orDie);
          }
          yield* Ref.update(mutations, (n) => n + 1);
          return yield* document
            .decode({
              markPullRequestReadyForReview: {
                pullRequest: { id: "PR_ready", isDraft: false },
              },
            })
            .pipe(Effect.orDie);
        })
      ),
    });
    const services = Layer.mergeAll(layerGithubRest, layerGraphqlBudget).pipe(
      Layer.provideMerge(Layer.mergeAll(client, Repo.layer(RepoRef.make({ owner: "beep", repo: "beep" }))))
    );
    const serviceContext = yield* Layer.build(services);
    return {
      liveHead,
      mutations,
      restReads,
      probes,
      markReady: (number: number, confirmed: string) =>
        flipPullRequestReady(number, confirmed).pipe(
          Effect.provideContext(serviceContext),
          Effect.mapError((cause) => YeetCommandError.make({ message: cause.message, exitCode: 1 }))
        ),
    };
  });

  // These tests run serially. Each owns one fork, advances the shared TestClock,
  // and joins the fork before the next test can use that clock.
  it.effect("refuses a push during the budget wait without a ready mutation", () =>
    Effect.gen(function* () {
      const flip = yield* waitingFlip(true);
      const fiber = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        markReady: flip.markReady,
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      }).pipe(Effect.flip, Effect.forkChild);
      yield* TestClock.adjust(Duration.seconds(1));
      expect(yield* Ref.get(flip.probes)).toBe(1);
      expect(yield* Ref.get(flip.restReads)).toBe(0);
      yield* Ref.set(flip.liveHead, "fedcba9876");
      yield* TestClock.adjust(Duration.minutes(11));
      const error = yield* Fiber.join(fiber);
      expect(error).toMatchObject({ _tag: "YeetCommandError", exitCode: 1 });
      expect(error.message).toContain(`confirmed ${headSha}, live fedcba9876`);
      expect(error.message).toContain("Re-run `bun run beep yeet ready`");
      expect(yield* Ref.get(flip.mutations)).toBe(0);
      expect(yield* Ref.get(flip.restReads)).toBe(1);
    })
  );

  it.effect("flips a stable confirmed head once after the wait", () =>
    Effect.gen(function* () {
      const flip = yield* waitingFlip(true);
      const confirmed = yield* Ref.make("");
      const fiber = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        markReady: (number, head) => Ref.set(confirmed, head).pipe(Effect.andThen(flip.markReady(number, head))),
        requestReview: stubReviewerRequest,
        findMonitor: () => Effect.succeedNone,
      }).pipe(Effect.forkChild);
      yield* TestClock.adjust(Duration.minutes(11));
      expect((yield* Fiber.join(fiber))._tag).toBe("flip");
      expect(yield* Ref.get(confirmed)).toBe(headSha);
      expect(yield* Ref.get(flip.mutations)).toBe(1);
      expect(yield* Ref.get(flip.restReads)).toBe(1);
    })
  );

  it.effect("repeats the full gate and attribution confirmation after an expired wait", () =>
    Effect.gen(function* () {
      const flip = yield* waitingFlip(false);
      const reads = yield* Ref.make(0);
      const records = yield* Ref.make(0);
      const inherited = [YeetReadyInheritedRed.make({ check: "Lint", attribution: "inherited from main" })];
      const dependencies = {
        read: () =>
          Ref.update(reads, (n) => n + 1).pipe(
            Effect.as(
              prView({
                failingRequiredCheckCount: 1,
                checks: [YeetWatchCheck.make({ name: "Lint", outcome: "fail", required: true })],
              })
            )
          ),
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Ref.update(records, (n) => n + 1),
        markReady: flip.markReady,
      };
      const fiber = yield* runYeetReadyGate(context, dependencies, inherited).pipe(Effect.flip, Effect.forkChild);
      yield* TestClock.adjust(Duration.minutes(11));
      expect((yield* Fiber.join(fiber)).message).toContain("GraphQL budget too low");
      expect(yield* Ref.get(flip.restReads)).toBe(0);
      expect(yield* Ref.get(flip.mutations)).toBe(0);
      yield* runYeetReadyGate(
        context,
        { ...dependencies, markReady: () => Effect.void, findMonitor: () => Effect.succeedNone },
        inherited
      );
      expect(yield* Ref.get(reads)).toBe(6);
      expect(yield* Ref.get(records)).toBe(2);
    })
  );
});

// The default re-request runs real git, so it is proven against a scratch clone
// with a bare origin rather than a stub.
const scratchGit = Effect.fn("YeetReadyTest.scratchGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  expect(yield* handle.exitCode).toBe(0);
  return Str.trim(output);
});

const scratchClone = Effect.fn("YeetReadyTest.scratchClone")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-ready-rereview-" });
  const work = path.join(tmp, "work");
  const origin = path.join(tmp, "origin.git");
  yield* fs.makeDirectory(work);
  yield* fs.makeDirectory(origin);
  yield* scratchGit(origin, ["init", "--bare", "-b", "main"]);
  yield* scratchGit(work, ["init", "-b", "main"]);
  yield* scratchGit(work, ["config", "user.email", "yeet-ready-test@example.com"]);
  yield* scratchGit(work, ["config", "user.name", "Yeet Ready Test"]);
  yield* scratchGit(work, ["config", "commit.gpgsign", "false"]);
  yield* fs.writeFileString(path.join(work, "README.md"), "# scratch\n");
  yield* scratchGit(work, ["add", "README.md"]);
  yield* scratchGit(work, ["commit", "-m", "init"]);
  yield* scratchGit(work, ["remote", "add", "origin", origin]);
  yield* scratchGit(work, ["push", "--set-upstream", "origin", "main"]);
  const head = yield* scratchGit(work, ["rev-parse", "HEAD"]);
  return {
    work,
    origin,
    head,
    context: RepoRunContext.make({ ...context, repoRoot: work, cwd: work, branch: "main" }),
  };
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("yeet ready reviewer re-request", (it) => {
  it.effect("pushes one empty re-request commit on top of the flipped head", () =>
    Effect.gen(function* () {
      const clone = yield* scratchClone();
      const decision = yield* runYeetReadyGate(clone.context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ headSha: O.some(clone.head) })),
        markReady: () => Effect.void,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* scratchGit(clone.origin, ["log", "-1", "--format=%s", "main"])).toBe(YEET_REVIEWER_REQUEST_SUBJECT);
      expect(yield* scratchGit(clone.origin, ["rev-parse", "main~1"])).toBe(clone.head);
      expect(yield* scratchGit(clone.work, ["diff", "--stat", "HEAD~1", "HEAD"])).toBe("");
    })
  );

  it.effect("pushes nothing when the checkout is not on the flipped head", () =>
    Effect.gen(function* () {
      const clone = yield* scratchClone();
      const decision = yield* runYeetReadyGate(clone.context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ headSha: O.some("0000000000000000000000000000000000000000") })),
        markReady: () => Effect.void,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* scratchGit(clone.origin, ["rev-parse", "main"])).toBe(clone.head);
      expect(yield* scratchGit(clone.work, ["rev-parse", "HEAD"])).toBe(clone.head);
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("yeet ready reviewer re-request safety", (it) => {
  it.effect("never commits staged changes into the re-request", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const clone = yield* scratchClone();
      yield* fs.writeFileString(path.join(clone.work, "staged.txt"), "not proven\n");
      yield* scratchGit(clone.work, ["add", "staged.txt"]);
      const decision = yield* runYeetReadyGate(clone.context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ headSha: O.some(clone.head) })),
        markReady: () => Effect.void,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* scratchGit(clone.origin, ["log", "-1", "--format=%s", "main"])).toBe(YEET_REVIEWER_REQUEST_SUBJECT);
      expect(yield* scratchGit(clone.origin, ["diff", "--name-only", "main~1", "main"])).toBe("");
      expect(yield* scratchGit(clone.work, ["diff", "--cached", "--name-only"])).toBe("staged.txt");
    })
  );

  it.effect("pushes to the pull request branch on origin even when push config points elsewhere", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const clone = yield* scratchClone();
      const decoy = path.join(path.dirname(clone.origin), "decoy.git");
      yield* fs.makeDirectory(decoy);
      yield* scratchGit(decoy, ["init", "--bare", "-b", "main"]);
      yield* scratchGit(clone.work, ["remote", "add", "decoy", decoy]);
      yield* scratchGit(clone.work, ["config", "remote.pushDefault", "decoy"]);
      const decision = yield* runYeetReadyGate(clone.context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ headSha: O.some(clone.head) })),
        markReady: () => Effect.void,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* scratchGit(clone.origin, ["log", "-1", "--format=%s", "main"])).toBe(YEET_REVIEWER_REQUEST_SUBJECT);
      expect(yield* scratchGit(decoy, ["for-each-ref", "--format=%(refname)"])).toBe("");
    })
  );

  it.effect("keeps the local re-request and the flip when the push fails", () =>
    Effect.gen(function* () {
      const clone = yield* scratchClone();
      yield* scratchGit(clone.work, ["remote", "remove", "origin"]);
      const decision = yield* runYeetReadyGate(clone.context, {
        finalCheck: passingFinalCheck,
        squashCommitlint: passingSquashCommitlint,
        recordInherited: () => Effect.void,
        read: () => Effect.succeed(prView({ headSha: O.some(clone.head) })),
        markReady: () => Effect.void,
        findMonitor: () => Effect.succeedNone,
      });
      expect(decision._tag).toBe("flip");
      expect(yield* scratchGit(clone.work, ["log", "-1", "--format=%s"])).toBe(YEET_REVIEWER_REQUEST_SUBJECT);
      expect(yield* scratchGit(clone.work, ["rev-parse", "HEAD~1"])).toBe(clone.head);
      expect(yield* scratchGit(clone.origin, ["rev-parse", "main"])).toBe(clone.head);
    })
  );
});
