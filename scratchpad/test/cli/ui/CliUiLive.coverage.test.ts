import { assert, it, vi } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as Stream from "effect/Stream";
import * as PubSub from "effect/PubSub";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { createElement } from "react";
import { Text } from "ink";
import { Doc } from "../../../effected/cli/Doc.ts";
import { CurrentRuntimeEnv } from "../../../effected/env/index.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import type { Ev } from "../helpers/live.ts";
import { End, Start, capturing, liveOn, optionsOf, tick, until, warningsIn } from "../helpers/live.ts";
import { commandLines } from "../helpers/runnerCommands.ts";

const rejectExit = { current: false };
vi.doMock("ink", (importOriginal) => importOriginal<typeof import("ink")>().then((actual) => ({
  ...actual,
  render: (...args: Parameters<typeof actual.render>) => {
    const instance = actual.render(...args);
    return { ...instance, waitUntilExit: () => rejectExit.current ? Promise.reject(new Error("exit rejected")) : instance.waitUntilExit() };
  },
})));

it.effect("invalid tick sizes die before reading events or mounting", () =>
  Effect.gen(function* () {
    for (const tickMillis of [0, -1, NaN, Infinity, -Infinity]) {
      const fake = makeFakeStreams();
      const exit = yield* Effect.exit(liveOn(fake, optionsOf(Stream.empty, { tickMillis })));
      assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
      assert.include(String(Cause.squash(exit.cause)), "positive, finite");
      assert.strictEqual(fake.stdout(), "");
    }
  }),
);

it.effect("an empty final document prints nothing and a non-Error final failure warns once", () =>
  Effect.gen(function* () {
    for (const [final, warnings] of [[() => [], 0], [() => { throw "final failed"; }, 1]] as const) {
      const fake = makeFakeStreams();
      const logs = capturing();
      const handle = yield* liveOn(fake, optionsOf(Stream.make(Start, End), { final }), { interactive: false, console: logs.console });
      yield* handle.done;
      assert.strictEqual(fake.stdout(), "");
      assert.strictEqual(warningsIn(logs.lines).length, warnings);
      if (warningsIn(logs.lines).length > 0) assert.include(logs.lines.join("\n"), "final failed");
    }
  }),
);

it.effect("subscriptions ended before live starts fold their buffered tail and final value exactly once", () =>
  Effect.gen(function* () {
    const fake = makeFakeStreams();
    const pubsub = yield* PubSub.unbounded<Ev>();
    const sub = yield* PubSub.subscribe(pubsub);
    yield* PubSub.publishAll(pubsub, [Start, tick(7)]);
    yield* PubSub.end(pubsub, End);
    const handle = yield* liveOn(fake, optionsOf(sub, { final: (state) => [Doc.paragraph(state.seen.join(","))] }), { interactive: false });
    yield* handle.done;
    yield* handle.close;
    assert.deepStrictEqual((yield* handle.state).seen, ["Start", "tick 7", "End"]);
    assert.strictEqual(fake.stdout(), "Start,tick 7,End\n");
  }),
);

it.effect("a subscription shut down before live starts has no tail or output", () =>
  Effect.gen(function* () {
    const fake = makeFakeStreams();
    const pubsub = yield* PubSub.unbounded<Ev>();
    const sub = yield* PubSub.subscribe(pubsub);
    yield* PubSub.shutdown(pubsub);
    const handle = yield* liveOn(fake, optionsOf(sub), { interactive: false });
    yield* handle.done;
    assert.deepStrictEqual((yield* handle.state).seen, []);
    assert.strictEqual(fake.stdout(), "");
  }),
);

it.effect("a reducer that dies before any run starts produces no frame", () =>
  Effect.gen(function* () {
    const failure = new Error("idle reducer failed");
    const fake = makeFakeStreams();
    const handle = yield* liveOn(fake, optionsOf(Stream.make(tick(1)), { reduce: () => { throw failure; } }), { interactive: false });
    const exit = yield* Effect.exit(handle.done);
    assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
    assert.strictEqual(Cause.squash(exit.cause), failure);
    assert.strictEqual(fake.stdout(), "");
  }),
);

it.effect("a late failure report after its run ended is ignored, and a rejected Ink exit still releases the view", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => { rejectExit.current = true; }),
    () => Effect.gen(function* () {
      const fake = makeFakeStreams();
      const logs = capturing();
      const handle = yield* liveOn(fake, optionsOf(Stream.concat(Stream.make(Start, End), Stream.never), {
        render: (state) => {
          if (state.last === "started") throw new Error("initial frame failed");
          return createElement(Text, null, state.last);
        },
      }), { console: logs.console });
      yield* until(() => fake.stdout().includes("ended")).pipe(TestClock.withLive);
      yield* handle.close;
      assert.strictEqual(warningsIn(logs.lines).length, 1);
      assert.include(fake.stdout(), "ended");
    }),
    () => Effect.sync(() => { rejectExit.current = false; }),
  ),
);

it.layer(CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") }), { timeout: "30 seconds" })((it) => {
  it.effect("final documents without the full environment neutralize workflow commands", () =>
    Effect.gen(function* () {
      const fake = makeFakeStreams();
      const handle = yield* liveOn(fake, optionsOf(Stream.make(Start, End), { final: () => [Doc.paragraph("::error::data")] }), { interactive: false });
      yield* handle.done;
      assert.include(fake.stdout(), "data");
      assert.deepStrictEqual(commandLines(fake.stdout()), []);
    }),
  );
});

it.effect("a reducer defect after a run starts is retained by done and close", () =>
  Effect.gen(function* () {
    const failure = new Error("broken reducer");
    const fake = makeFakeStreams();
    const handle = yield* liveOn(fake, optionsOf(Stream.make(Start, tick(1), End), {
      reduce: (state, event) => {
        if (event._tag === "Tick") throw failure;
        return { ...state, last: event._tag };
      },
    }), { interactive: false });
    for (const end of [handle.done, handle.close]) {
      const exit = yield* Effect.exit(end);
      assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
      assert.strictEqual(Cause.squash(exit.cause), failure);
    }
    assert.strictEqual(fake.stdout(), "");
  }),
);
