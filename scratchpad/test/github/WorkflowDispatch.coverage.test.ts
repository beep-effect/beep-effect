import { assert, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Exit from "effect/Exit";
import { assertExitFailure } from "@effect/vitest/utils";
import * as TestClock from "effect/testing/TestClock";
import { WorkflowDispatch, WorkflowRunStatus } from "../../effected/github/WorkflowDispatch.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { harness, REPO } from "./harness.ts";
import type { Reply } from "./fixtures.ts";

const execute = Effect.fnUntraced(function* <A, E>(replies: ReadonlyArray<Reply>, use: (service: WorkflowDispatch["Service"]) => Effect.Effect<A, E, Repo>) {
  const { base, script } = harness(replies);
  const value = yield* Effect.scopedWith(scope => Effect.gen(function* () {
    const context = yield* Layer.buildWithScope(WorkflowDispatch.layer.pipe(Layer.provideMerge(base)), scope);
    return yield* Effect.flatMap(WorkflowDispatch, use).pipe(Effect.provideContext(context));
  }));
  return { value, script };
});

it.effect("unstubbed methods name the member, while the list defect is deferred", () => Effect.gen(function* () {
  const service = WorkflowDispatch.makeTest();
  assert.throws(() => service.dispatch("ci.yml", "main"), /dispatch\(\) was called but not stubbed/);
  assert.throws(() => service.runStatus(1), /runStatus\(\) was called but not stubbed/);
  assert.throws(() => service.dispatchAndWait("ci.yml", "main"), /dispatchAndWait\(\) was called but not stubbed/);
  const exit = yield* Effect.exit(service.list.pipe(Effect.provideService(Repo, REPO)));
  const cause = exit.pipe(Exit.getCause, O.getOrThrow);
  assertExitFailure(exit, cause);
  assert.include(Cause.pretty(cause), "list() was called but not stubbed");
}));

it.effect("test layers retain every supplied method and result", () => Effect.gen(function* () {
  const run = WorkflowRunStatus.make({ id: 1, status: "completed", url: "run/1" });
  const overrides = {
    dispatch: (workflow: string, ref: string) => Effect.sync(() => assert.deepStrictEqual([workflow, ref], ["ci.yml", "main"])),
    runStatus: (id: number) => Effect.sync(() => { assert.strictEqual(id, 1); return run; }),
    list: Effect.succeed([{ id: 1, name: "CI", path: "ci.yml", state: "active" }]),
    dispatchAndWait: () => Effect.succeed(run),
  };
  yield* Effect.scopedWith(scope => Effect.gen(function* () {
    const context = yield* Layer.buildWithScope(Layer.merge(WorkflowDispatch.layerTest(overrides), Repo.layer(REPO)), scope);
    yield* Effect.gen(function* () {
    const service = yield* WorkflowDispatch;
    yield* service.dispatch("ci.yml", "main");
    assert.strictEqual(yield* service.runStatus(1), run);
    assert.deepStrictEqual(yield* service.list, [{ id: 1, name: "CI", path: "ci.yml", state: "active" }]);
    assert.strictEqual(yield* service.dispatchAndWait("ci.yml", "main"), run);
    }).pipe(Effect.provideContext(context));
  }));
  yield* Effect.scopedWith(scope => Effect.gen(function* () {
    const context = yield* Layer.buildWithScope(Layer.merge(WorkflowDispatch.layerTest(), Repo.layer(REPO)), scope);
    yield* Effect.gen(function* () {
    const service = yield* WorkflowDispatch;
    const exit = yield* Effect.exit(service.list);
    const cause = exit.pipe(Exit.getCause, O.getOrThrow);
    assertExitFailure(exit, cause);
    assert.include(Cause.pretty(cause), "list() was called but not stubbed");
    }).pipe(Effect.provideContext(context));
  }));
}));

it.effect("missing run status becomes unknown and a null conclusion is omitted", () => Effect.gen(function* () {
  const { value } = yield* execute([{ status: 200, body: { id: 1, status: null, conclusion: null, html_url: "run/1" } }], service => service.runStatus(1));
  assert.strictEqual(value.status, "unknown");
  assert.strictEqual(value.conclusion, undefined);
  assert.isFalse(value.isDone);
}));

it.effect("default polling discovers a completed run without requiring options", () => Effect.gen(function* () {
  const { value, script } = yield* execute([
    { status: 204 }, { status: 200, body: { total_count: 1, workflow_runs: [{ id: 7, status: "completed", conclusion: "failure", html_url: "run/7" }] } },
  ], service => service.dispatchAndWait("ci.yml", "main"));
  assert.strictEqual(value.id, 7);
  assert.strictEqual(value.conclusion, "failure");
  assert.isTrue(value.isDone);
  assert.strictEqual(script.calls[0]?.body, '{"ref":"main"}');
}));

it.effect("an empty discovery retries then returns the newly discovered run with inputs", () => Effect.gen(function* () {
  const fiber = yield* execute([
    { status: 204 }, { status: 200, body: { total_count: 0, workflow_runs: [] } },
    { status: 200, body: { total_count: 1, workflow_runs: [{ id: 9, status: "completed", html_url: "run/9" }] } },
  ], service => service.dispatchAndWait("ci.yml", "main", { inputs: { mode: "test" }, poll: { timeout: Duration.seconds(30) } })).pipe(Effect.forkChild);
  yield* TestClock.adjust(Duration.seconds(10));
  const { value, script } = yield* Fiber.join(fiber);
  assert.strictEqual(value.id, 9);
  assert.strictEqual(script.count(), 3);
  assert.strictEqual(script.calls[0]?.body, '{"ref":"main","inputs":{"mode":"test"}}');
}));
