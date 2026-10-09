import { assert, describe, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { RetryPolicy } from "../../effected/github/Resilience.ts";
import { WorkflowDispatch, WorkflowInfo } from "../../effected/github/WorkflowDispatch.ts";
import type { Reply } from "./fixtures.ts";
import { scriptedFetch } from "./fixtures.ts";
import { harness, REPO } from "./harness.ts";

const runReply = (id: number, status: string, path = ".github/workflows/ci.yml") => ({
  id, status, path, workflow_id: 123, event: "workflow_dispatch", head_branch: "main",
  created_at: "1970-01-01T00:00:00Z", html_url: `https://example.test/runs/${id}`,
  ...(status === "completed" ? { conclusion: "success" } : {}),
});

const runsReply = (run: ReturnType<typeof runReply>): Reply => ({
  status: 200, body: { total_count: 1, workflow_runs: [run] },
});

const execute = Effect.fnUntraced(function* <A, E>(
  replies: ReadonlyArray<Reply>, use: (workflows: WorkflowDispatch["Service"]) => Effect.Effect<A, E, Repo>,
) {
  const { script, base } = harness(replies);
  const value = yield* Effect.scopedWith((scope) => Effect.gen(function* () {
    const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), scope);
    return yield* Effect.flatMap(WorkflowDispatch, use).pipe(Effect.provideContext(context));
  }));
  return { value, script };
});

const poll = { interval: Duration.seconds(1), timeout: Duration.seconds(3) };

// Model GitHub's route/event filtering: a repository-wide or unfiltered query
// actually receives the conflicting run instead of just failing a URL assertion.
const discover = Effect.fnUntraced(function* (conflicting: ReturnType<typeof runReply>) {
  const exact = scriptedFetch([{ status: 204 }, runsReply(runReply(42, "completed"))]);
  const unrelated = scriptedFetch([runsReply(conflicting)]);
  const fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(P.isString(input) ? input : input instanceof URL ? input.href : input.url);
    const transport = init?.method === "POST" || (
      url.pathname === "/repos/acme/widget/actions/workflows/ci.yml/runs" &&
      url.searchParams.get("event") === "workflow_dispatch"
    ) ? exact : unrelated;
    return transport.fetch(input, init);
  };
  fetch.preconnect = globalThis.fetch.preconnect;
  const base = Layer.merge(GitHubClient.layerFromToken({
    token: Redacted.make("ghs_test"), fetch, retry: RetryPolicy.none,
  }), Repo.layer(REPO));
  const value = yield* Effect.scopedWith((scope) => Effect.gen(function* () {
    const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), scope);
    return yield* Effect.flatMap(WorkflowDispatch, (workflows) =>
      workflows.dispatchAndWait("ci.yml", "main", { poll })).pipe(Effect.provideContext(context));
  }));
  assert.strictEqual(unrelated.count(), 0);
  return { value, script: exact };
});

describe("WorkflowDispatch dispatch discovery", () => {
  it.effect("accepts a numeric workflow ID without matching it against the filename", () =>
    Effect.gen(function* () {
      const { value, script } = yield* execute([{ status: 204 }, runsReply(runReply(42, "completed"))],
        (workflows) => workflows.dispatchAndWait("123", "main", { poll }));
      assert.strictEqual(value.id, 42);
      assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/actions/workflows/123/runs");
      assert.strictEqual(script.queryOf(1).get("event"), "workflow_dispatch");
    }),
  );

  it.effect("uses the exact workflow route so release-ci.yml cannot collide with ci.yml", () =>
    Effect.gen(function* () {
      const { value, script } = yield* discover(runReply(99, "completed", ".github/workflows/release-ci.yml"));
      assert.strictEqual(value.id, 42);
      assert.strictEqual(script.calls[1]?.path, "/repos/acme/widget/actions/workflows/ci.yml/runs");
      assert.strictEqual(script.queryOf(1).get("branch"), "main");
      assert.strictEqual(script.queryOf(1).get("created"), ">=1970-01-01T00:00:00.000Z");
      assert.strictEqual(script.queryOf(1).get("per_page"), "10");
    }),
  );

  it.effect("filters out unrelated push events at the GitHub query boundary", () =>
    Effect.gen(function* () {
      const { value, script } = yield* discover({ ...runReply(99, "completed"), event: "push" });
      assert.strictEqual(value.id, 42);
      assert.strictEqual(value.conclusion, "success");
      assert.strictEqual(script.queryOf(1).get("event"), "workflow_dispatch");
    }),
  );

  it.effect("retains the selected run ID rather than rediscovering a newer run", () =>
    Effect.gen(function* () {
      const fiber = yield* execute([
        { status: 204 }, runsReply(runReply(42, "queued")),
        { status: 200, body: runReply(42, "in_progress") },
        { status: 200, body: runReply(42, "completed") },
      ], (workflows) => workflows.dispatchAndWait("ci.yml", "main", {
        poll: { ...poll, timeout: Duration.seconds(10) },
      })).pipe(Effect.forkChild);
      yield* TestClock.adjust(Duration.seconds(2));
      const { value, script } = yield* Fiber.join(fiber);
      assert.strictEqual(value.id, 42);
      assert.isTrue(value.isDone);
      assert.strictEqual(script.count(), 4);
      assert.strictEqual(script.calls[2]?.path, "/repos/acme/widget/actions/runs/42");
      assert.strictEqual(script.calls[3]?.path, "/repos/acme/widget/actions/runs/42");
    }),
  );
});

describe("WorkflowDispatch polling deadline", () => {
  it.effect("rejects a zero interval with a typed 422 before dispatching", () =>
    Effect.gen(function* () {
      const { value: error, script } = yield* execute([], (workflows) =>
        workflows.dispatchAndWait("ci.yml", "main", { poll: { ...poll, interval: Duration.zero } }).pipe(Effect.flip));
      assert.instanceOf(error, GitHubError);
      assert.strictEqual(error.kind, "rejected");
      assert.strictEqual(error.status, 422);
      assert.strictEqual(error.operation, "WorkflowDispatch.dispatchAndWait");
      assert.strictEqual(error.reason, "polling interval must be positive");
      assert.strictEqual(script.count(), 0);
    }),
  );

  it.effect("bounds a blocked dispatch request by the polling deadline", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const client = GitHubClient.layerTest({ request: () => Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Effect.never),
      ) });
      const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(
        Layer.provideMerge(Layer.merge(client, Repo.layer(REPO))),
      ), scope);
      const fiber = yield* Effect.flatMap(WorkflowDispatch, (workflows) =>
        workflows.dispatchAndWait("ci.yml", "main", { poll }))
        .pipe(Effect.provideContext(context), Effect.flip, Effect.forkChild);
      yield* Deferred.await(started);
      yield* TestClock.adjust(Duration.seconds(3));
      const error = yield* Fiber.join(fiber);
      assert.instanceOf(error, GitHubError);
      assert.strictEqual(error.kind, "rejected");
      assert.strictEqual(error.status, 408);
      assert.strictEqual(error.operation, "WorkflowDispatch.dispatchAndWait");
      assert.include(error.reason, "did not finish within");
    })),
  );

  it.effect("bounds a blocked discovery request as well as sleeps", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const { base } = harness([{ status: 204 }]);
      const blockedClient = Layer.effect(GitHubClient, Effect.map(GitHubClient, (client) => ({
        ...client, paginate: () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
      }))).pipe(Layer.provide(base));
      const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(
        Layer.provideMerge(Layer.merge(blockedClient, Repo.layer(REPO))),
      ), scope);
      const fiber = yield* Effect.flatMap(WorkflowDispatch, (workflows) =>
        workflows.dispatchAndWait("ci.yml", "main", { poll }))
        .pipe(Effect.provideContext(context), Effect.flip, Effect.forkChild);
      yield* Deferred.await(started);
      yield* TestClock.adjust(Duration.seconds(3));
      const error = yield* Fiber.join(fiber);
      assert.instanceOf(error, GitHubError);
      assert.strictEqual(error.status, 408);
      assert.strictEqual(error.operation, "WorkflowDispatch.dispatchAndWait");
    })),
  );

  it.effect("expires at the deadline while discovery keeps returning no runs", () =>
    Effect.gen(function* () {
      const fiber = yield* execute([
        { status: 204 }, { status: 200, body: { total_count: 0, workflow_runs: [] } },
      ], (workflows) => workflows.dispatchAndWait("ci.yml", "main", { poll }).pipe(Effect.flip))
        .pipe(Effect.forkChild);
      yield* TestClock.adjust(Duration.seconds(3));
      const { value: error, script } = yield* Fiber.join(fiber);
      assert.strictEqual(error.kind, "rejected");
      assert.strictEqual(error.status, 408);
      assert.isAtLeast(script.count(), 2);
      assert.isAtMost(script.count(), 4);
    }),
  );
});

describe("WorkflowInfo return-model compatibility", () => {
  it.effect("decodes and lists the same plain object with all four required fields", () =>
    Effect.gen(function* () {
      const workflow: WorkflowInfo = { id: 123, name: "CI", path: ".github/workflows/ci.yml", state: "disabled_manually" };
      const { value } = yield* execute([{ status: 200, body: { total_count: 1, workflows: [workflow] } }],
        (workflows) => workflows.list);
      assert.deepStrictEqual(value, [workflow]);
      assert.deepStrictEqual(yield* S.decodeEffect(WorkflowInfo)(workflow), workflow);
      assert.deepStrictEqual(yield* S.encodeEffect(WorkflowInfo)(workflow), workflow);
      assert.isTrue(S.is(WorkflowInfo)(value[0]));
      assert.isFalse(S.is(WorkflowInfo)({ id: 123, name: "CI", path: ".github/workflows/ci.yml" }));
    }),
  );
});
