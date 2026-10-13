import { assert, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Fiber from "effect/Fiber";
import { createElement, type ReactElement } from "react";
import * as Deferred from "effect/Deferred";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import { CliUi } from "../../../../effected/cli/ui/CliUi.ts";
import { Text } from "ink";
import { UiRenderOptions } from "../../../../effected/cli/ui/internal/renderOptions.ts";
import { CliUiTest } from "../../../../effected/cli/ui/testing/CliUiTest.ts";

it.effect("decodes each SGR style, palette, replacement and malformed extended colour", () => Effect.sync(() => {
  const cases = [
    ["2;3;4;7;9", "[dim][i][u][inverse][s]x[/s][/inverse][/u][/i][/dim]"],
    ["31;32", "[fg:red][/fg][fg:green]x[/fg]"],
    ["91;101", "[fg:redBright][bg:redBright]x[/bg][/fg]"],
    ["41", "[bg:red]x[/bg]"],
    ["38;5", "[fg:ansi256(0)]x[/fg]"],
    ["48;5;123", "[bg:ansi256(123)]x[/bg]"],
    ["38;2", "[fg:#000000]x[/fg]"],
    ["38;2;0;0;255", "[fg:#0000ff]x[/fg]"],
    ["38;2;1;2;3", "[fg:#010203]x[/fg]"],
    ["38;2;0;1;3", "[fg:#000103]x[/fg]"],
    ["48;2;0;0;1", "[bg:#000001]x[/bg]"],
    ["38;6;48;6;999", "x"],
  ];
  for (const [codes, expected] of cases) {
    assert.strictEqual(CliUiTest.styled(`\u001b[${codes}mx`), expected);
  }
  assert.strictEqual(CliUiTest.styled("\u001b[1;2;3;4;7;9;31;41mx\u001b[22;23;24;27;29;39;49m"), "[b][dim][i][u][inverse][s][fg:red][bg:red]x[/dim][/b][/i][/u][/inverse][/s][/fg][/bg]");
  assert.strictEqual(CliUiTest.styled("\u001b[1mx\u001b[m"), "[b]x[/b]");
  assert.strictEqual(CliUiTest.styled("\u001b[23;24;27;29;39;49mplain\u001b[2K\u001b]8;;url\u0007"), "plain");
}));

it.effect("cancellation recognition rejects incomplete or foreign values and skips interruptions", () => Effect.sync(() => {
  for (const value of [null, () => undefined, {}, { _tag: "Cancelled" }, { reason: "escape" }, { _tag: "Other", reason: "escape" }, { _tag: "Cancelled", reason: "other" }]) {
    assertNone(CliUiTest.cancelReason(Cause.fail(value)));
  }
  assertNone(CliUiTest.cancelReason(Exit.succeed("ok")));
  assertNone(CliUiTest.cancelReason(Cause.interrupt(1)));
  assertSome(CliUiTest.cancelReason(Cause.die({ _tag: "Cancelled", reason: "interrupt" })), "interrupt");
  assertSome(CliUiTest.cancelReason(Exit.fail({ _tag: "Cancelled", reason: "escape" })), "escape");
  assert.isFalse(CliUiTest.serializer.test(42));
  assert.strictEqual(CliUiTest.serializer.serialize(42), "42");
}));

it.effect("a noninteractive screen has empty raw and plain frames", () => Effect.gen(function* () {
  const handle = yield* CliUiTest.render(() => createElement(Text, null, "unmounted"), { interactive: false });
  assert.strictEqual(yield* handle.frame, "");
  assert.strictEqual(yield* handle.rawFrame, "");
  assert.strictEqual(yield* handle.plainFrame, "");
}));

it.effect("next reports absent mounts and mounts that ended without drawing", () => Effect.gen(function* () {
  const session = yield* CliUiTest.session();
  const missing = yield* Effect.exit(session.next());
  assert.include(Cause.pretty(Exit.isFailure(missing) ? missing.cause : Cause.empty), "none mounted within 2 s");
  const ended = yield* CliUiTest.session();
  yield* Effect.gen(function* () {
    const options = yield* UiRenderOptions;
    options.onUnmount?.(undefined);
    options.onMount?.("screen");
    options.onUnmount?.(undefined);
  }).pipe((self) => Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(ended.layer, scope), (context) => Effect.provideContext(self, context))));
  const result = yield* Effect.exit(ended.next());
  assert.include(Cause.pretty(Exit.isFailure(result) ? result.cause : Cause.empty), "it unmounted first");
}));

it.effect("live reads empty frames before its first event and resizes its terminal", () => Effect.gen(function* () {
  const live = yield* CliUiTest.live({
    initial: 0,
    reduce: (state: number, _event: string) => state + 1,
    render: (state) => createElement(Text, null, `count ${state}`),
    isStart: (event) => event === "start",
    isTerminal: (event) => event === "end",
  });
  assert.strictEqual(yield* live.rawFrame, "");
  assert.strictEqual(yield* live.frame, "");
  assert.strictEqual(yield* live.plainFrame, "");
  yield* live.resize(35, 8);
  yield* live.publish("start");
  assert.include(yield* live.plainFrame, "count 1");
  yield* live.end;
}));

it.effect("a chunk ending in escape cancels a view", () => Effect.gen(function* () {
  const view = yield* CliUiTest.view(createElement(Text, null, "ready"));
  yield* view.chunk("escape");
  assert.strictEqual(yield* view.plainFrame, "ready");
  const result = yield* Effect.exit(view.chunk("enter"));
  assert.include(Cause.pretty(Exit.isFailure(result) ? result.cause : Cause.empty), "screen that has ended");
}));


it.effect("next reports a mounted screen that never draws", () => Effect.gen(function* () {
  const session = yield* CliUiTest.session();
  const options = yield* Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(session.layer, scope), (context) => Effect.provideContext(UiRenderOptions, context)));
  options.onMount?.("screen");
  const result = yield* Effect.exit(session.next({ contains: "missing" }));
  assert.include(Cause.pretty(Exit.isFailure(result) ? result.cause : Cause.empty), "it did not within 2 s");
}));

it.effect("interrupting a pending native check releases its immediate", () => Effect.gen(function* () {
  const original = globalThis.setImmediate;
  let queued = false;
  const immediate = vi.spyOn(globalThis, "setImmediate").mockImplementation((callback, ...args) => {
    const handle = original(callback, ...args);
    if (callback.toString().includes("resume")) {
      clearImmediate(handle);
      queued = true;
    }
    return handle;
  });
  const clear = vi.spyOn(globalThis, "clearImmediate");
  try {
    const fiber = yield* Effect.forkScoped(CliUiTest.render(() => createElement(Text, null, "waiting"), { interactive: false }));
    yield* Effect.sync(() => queued).pipe(Effect.repeat({ until: (value) => value }));
    yield* Fiber.interrupt(fiber);
    assert.isAtLeast(clear.mock.calls.length, 2);
  } finally {
    immediate.mockRestore();
    clear.mockRestore();
  }
}));

it.effect("the static harness class keeps its formatter available on reflective construction", () => Effect.sync(() => {
  const instance = Reflect.construct(CliUiTest, []);
  assert.strictEqual(Reflect.getPrototypeOf(instance), CliUiTest.prototype);
  assert.strictEqual(CliUiTest.styled("ready"), "ready");
}));

it.effect("rerender observes an unmount before the run records its exit", () => Effect.gen(function* () {
  const released = yield* Deferred.make<void>();
  const ending = yield* Deferred.make<void>();
  let resolveElement: ((element: ReactElement) => void) | undefined;
  const original = CliUi.run;
  const run = vi.spyOn(CliUi, "run").mockImplementation((screen, options) => original(screen, options).pipe(
    Effect.onExit(() => Effect.gen(function* () {
      resolveElement?.(createElement(Text, null, "late"));
      yield* Deferred.succeed(ending, undefined);
      yield* Deferred.await(released);
    })),
  ));
  try {
    const handle = yield* CliUiTest.render<string>(() => createElement(Text, null, "ready"));
    yield* Effect.forkScoped(ending.pipe(Deferred.await,
      Effect.andThen(Clock.Clock.defaultValue().sleep(Duration.millis(20))),
      Effect.andThen(Deferred.succeed(released, undefined)),
    ));
    const result = yield* Effect.exit(handle.rerender((control) => {
      const pending = Promise.withResolvers<ReactElement>();
      resolveElement = pending.resolve;
      control.resolve("done");
      return pending.promise;
    }));
    assert.include(Cause.pretty(Exit.isFailure(result) ? result.cause : Cause.empty), "rerender after the screen ended");
    assert.strictEqual(yield* handle.result, "done");
  } finally {
    run.mockRestore();
  }
}));
