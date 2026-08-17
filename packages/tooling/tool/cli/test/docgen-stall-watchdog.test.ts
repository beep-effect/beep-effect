import { runDocgenStepWithStallWatchdogForTesting } from "@beep/repo-cli/test/Docgen";
import { runToExit } from "@beep/repo-cli/test/Process";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import * as Result from "effect/Result";

// The hosted Docgen lane runs turbo to completion and then never sees it exit:
// 2m8s of real work followed by 56 minutes of silence until the job timed out
// (run 31991634069). These bind the containment for that, which is otherwise
// only reachable against a child that outlives a multi-minute budget.
//
// `it.live` throughout: the watchdog is built on `Effect.timeoutOption`, and
// under the default TestClock no budget would ever elapse, so every one of
// these would pass without exercising anything.
describe("commands/Docgen docgen step stall watchdog", () => {
  it.live(
    "returns as soon as the child exits, without a retry",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();

      yield* runDocgenStepWithStallWatchdogForTesting("watchdog probe", "true", [], repoRoot, {
        first: Duration.seconds(30),
        retry: Duration.seconds(30),
      });
    }, provideScopedLayer(NodeServices.layer))
  );

  it.live(
    "surfaces a nonzero child exit rather than treating it as a stall",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();

      const outcome = yield* Effect.result(
        runDocgenStepWithStallWatchdogForTesting("watchdog probe", "false", [], repoRoot, {
          first: Duration.seconds(30),
          retry: Duration.seconds(30),
        })
      );

      expect(Result.isFailure(outcome)).toBe(true);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.live(
    "abandons a child that outlives its budget and fails once the retry stalls too",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();

      // Both attempts stall, which is the unrecoverable case: it has to fail
      // loudly rather than hang, since hanging is the whole defect.
      const outcome = yield* Effect.result(
        runDocgenStepWithStallWatchdogForTesting("watchdog probe", "sleep", ["30"], repoRoot, {
          first: Duration.millis(250),
          retry: Duration.millis(250),
        })
      );

      expect(Result.isFailure(outcome)).toBe(true);
    }, provideScopedLayer(NodeServices.layer))
  );
});

describe("internal/process runToExit force-kill escalation", () => {
  // Abandoning a step closes the child scope, which signals the process group
  // and then waits on the exit event. Without this escalation that wait is
  // unbounded against a child ignoring SIGTERM, so the watchdog above could not
  // actually reclaim anything.
  it.live(
    "accepts a force-kill window without disturbing a normal exit",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();

      const exitCode = yield* runToExit({
        command: "true",
        args: [],
        cwd: repoRoot,
        stdio: "ignore",
        forceKillAfter: Duration.seconds(5),
      });

      expect(exitCode).toBe(0);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.live(
    "still reports a nonzero exit when a force-kill window is set",
    Effect.fnUntraced(function* () {
      const repoRoot = yield* findRepoRoot();

      const exitCode = yield* runToExit({
        command: "false",
        args: [],
        cwd: repoRoot,
        stdio: "ignore",
        forceKillAfter: Duration.seconds(5),
      });

      expect(exitCode).not.toBe(0);
    }, provideScopedLayer(NodeServices.layer))
  );
});
