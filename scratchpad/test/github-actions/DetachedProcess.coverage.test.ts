import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { DetachedLogUnavailableError, DetachedNotReadyError, DetachedProcess, DetachedSignalFailedError, DetachedSpawnFailedError, InvalidPidError } from "../../effected/github-actions/DetachedProcess.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
describe("DetachedProcess coverage", () => {
  it.effect("errors identify the failed resource and operation", () => Effect.sync(() => {
    assert.strictEqual(DetachedLogUnavailableError.make({ path: "/log" }).message, 'Could not open the detached log file "/log"');
    assert.strictEqual(DetachedSpawnFailedError.make({}).message, "The detached child did not start");
    assert.strictEqual(InvalidPidError.make({ pid: 0 }).message, "Refusing to signal pid 0: a non-positive pid targets a process group, not a process");
    assert.strictEqual(DetachedSignalFailedError.make({ pid: 42 }).message, "Could not signal pid 42");
    assert.strictEqual(DetachedNotReadyError.make({}).message, "The detached child never became ready");
  }));
  it.effect("all unstubbed ops die with their own operation name", () => Effect.gen(function* () {
    const ops = DetachedProcess.makeTestOps();
    const operations = [
      ["spawn", ops.spawn({ command: "unused", logFile: "/unused" })],
      ["awaitReady", ops.awaitReady(Effect.succeed(true))],
      ["reap", ops.reap(42)],
    ] as const;
    for (const [name, operation] of operations) {
      assertExitFailure(yield* Effect.exit(operation), Cause.die(UnstubbedMemberError.make({ message: `DetachedProcess.makeTestOps: ${name}() was called but not stubbed — pass a \`${name}\` override.` })));
    }
  }));
});

import * as Layer from "effect/Layer";
import { HttpClient, HttpClientResponse } from "effect/http";
class InformationalResponse extends Response {
  override readonly status = 199;
}
for (const status of [199, 200, 299, 300, 503]) {
  it.layer(Layer.succeed(HttpClient.HttpClient, HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, status === 199 ? new InformationalResponse(null) : new Response(null, { status }))))))((it) => {
    it.effect(`http readiness classifies ${status}`, () => Effect.gen(function* () {
      assert.strictEqual(yield* DetachedProcess.httpProbe("https://probe.test"), status >= 200 && status < 300);
    }));
  });
}
it.layer(Layer.succeed(HttpClient.HttpClient, HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null))))))((it) => {
  it.effect("http readiness collapses client errors to false", () => Effect.gen(function* () {
    assert.isFalse(yield* DetachedProcess.httpProbe("not a valid URL"));
  }));
});
