import {
  decideYeetReadyGate,
  deriveYeetMergeReady,
  RepoRunContext,
  runYeetReadyGate,
  YeetReadyPullRequestRead,
  YeetStatusArtifact,
  YeetStatusRemote,
} from "@beep/repo-cli/test/Yeet";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import * as O from "effect/Option";

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
    readonly failingRequiredCheckCount: number;
    readonly isDraft: boolean;
    readonly mergeable: string;
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

describe("yeet ready gate decision (push-first-publish D10)", () => {
  it("flips a draft whose threads are answered and required checks are green", () => {
    expect(decideYeetReadyGate(prView())).toMatchObject({ _tag: "flip", prNumber: 42 });
  });

  it("flips even while the base conflicts: D10 gates threads and checks only", () => {
    expect(decideYeetReadyGate(prView({ mergeable: "CONFLICTING" }))).toMatchObject({ _tag: "flip" });
  });

  it("reports a non-draft as already ready", () => {
    expect(decideYeetReadyGate(prView({ isDraft: false }))).toMatchObject({ _tag: "already-ready", prNumber: 42 });
  });

  it.each([
    ["no pull request", noPullRequest, "pr-open"],
    ["a closed pull request", prView({ state: "CLOSED" }), "pr-open"],
    ["a failing required check", prView({ failingRequiredCheckCount: 1 }), "required-checks-green"],
    ["a pending required check", prView({ pendingRequiredCheckCount: 2 }), "required-checks-green"],
    ["an unanswered review thread", prView({ unresolvedReviewThreadCount: 1 }), "threads-resolved"],
  ] as const)("refuses %s and names the blocker", (_name, read, blocker) => {
    expect(decideYeetReadyGate(read)).toMatchObject({ _tag: "blocked", blocker });
  });

  it("names the first blocker in gate order when several fail", () => {
    expect(decideYeetReadyGate(prView({ failingRequiredCheckCount: 1, unresolvedReviewThreadCount: 3 }))).toMatchObject(
      { _tag: "blocked", blocker: "required-checks-green" }
    );
  });
});

it.layer(NodeServices.layer)("yeet ready gate run", (it) => {
  const recordingCapture =
    (calls: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>, exitCode = 0) =>
    (command: string, args: ReadonlyArray<string>) =>
      Ref.update(calls, (all) => [...all, [command, ...args]]).pipe(
        Effect.as({ exitCode, output: exitCode === 0 ? "" : "gh: not permitted", truncated: false })
      );

  it.effect("runs gh pr ready on the read pull request when the gate holds", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: recordingCapture(calls),
      });
      expect(decision._tag).toBe("flip");
      expect(yield* Ref.get(calls)).toEqual([["gh", "pr", "ready", "42"]]);
    })
  );

  it.effect("refuses with a typed error naming the blocker and never calls gh", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ unresolvedReviewThreadCount: 2 })),
        capture: recordingCapture(calls),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "threads-resolved" });
      expect(error.message).toContain("blocked on threads-resolved");
      expect(error.message).toContain("2 review thread(s) still owe an answer");
      expect(yield* Ref.get(calls)).toEqual([]);
    })
  );

  it.effect("names the current head when required checks are not green", () =>
    Effect.gen(function* () {
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ pendingRequiredCheckCount: 1 })),
        capture: () => Effect.die("gh must not run"),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetReadyGateRefused", blocker: "required-checks-green" });
      expect(error.message).toContain(`on head ${headSha}`);
    })
  );

  it.effect("does not call gh for a pull request that is already ready", () =>
    Effect.gen(function* () {
      const decision = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView({ isDraft: false })),
        capture: () => Effect.die("gh must not run"),
      });
      expect(decision._tag).toBe("already-ready");
    })
  );

  it.effect("fails with a command error when gh pr ready fails", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const error = yield* runYeetReadyGate(context, {
        read: () => Effect.succeed(prView()),
        capture: recordingCapture(calls, 1),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "YeetCommandError", command: "gh pr ready 42" });
      expect(error.message).toContain("gh: not permitted");
    })
  );
});
