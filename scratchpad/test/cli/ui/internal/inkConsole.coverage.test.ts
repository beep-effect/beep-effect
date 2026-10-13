import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { UiStreams } from "../../../../effected/cli/ui/UiStreams.ts";
import { makeFakeStreams } from "../../../../effected/cli/ui/testing/fakeStreams.ts";

const hooks = { effects: Array<() => () => void>(), out: Array<string>(), err: Array<string>() };
vi.doMock("../../../../effected/cli/ui/internal/ink.ts", () => ({
  inkModules: () => ({
    ink: { useStdout: () => ({ write: (data: string) => hooks.out.push(data) }), useStderr: () => ({ write: (data: string) => hooks.err.push(data) }) },
    react: { useLayoutEffect: (effect: () => () => void) => hooks.effects.push(effect) },
  }),
}));

const makeInkConsole = Effect.flatMap(Effect.promise(() => import("../../../../effected/cli/ui/internal/inkConsole.ts")), (module) => module.makeInkConsole);

describe("Ink console edge behavior", () => {
  it.effect("formats scalars, mixed tables, empty labels and default counters and timers", () => Effect.gen(function* () {
    const fake = makeFakeStreams();
    const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
    const writer = bridge.writer;
    const error = new Error("without stack");
    delete error.stack;
    writer.log(error);
    writer.table(42);
    writer.table(() => "unused");
    writer.table({ a: { text: "hello", missing: undefined, n: 2 }, b: "scalar", c: undefined, f: () => "function cell" });
    writer.table({ a: { text: "hello" } }, ["missing"]);
    writer.table({});
    writer.count(); writer.count(); writer.countReset(); writer.count(); writer.countReset("named");
    writer.group(); writer.debug("first\nsecond"); writer.groupEnd(); writer.groupEnd();
    writer.assert(false);
    writer.timeLog(); writer.timeEnd();
    writer.time(); writer.timeLog(); writer.timeEnd();
    bridge.print("raw");
    assert.include(fake.stdout(), "Error: without stack\n42\n");
    assert.include(fake.stdout(), "hello");
    assert.include(fake.stdout(), "scalar");
    assert.include(fake.stdout(), "default: 1\ndefault: 2\ndefault: 1\n  first\n  second\n");
    assert.match(fake.stdout(), /default: \d+\.\d{3}ms\n/);
    assert.include(fake.stdout(), "raw\n");
    assert.strictEqual(fake.stderr(), "Assertion failed\nWarning: No such label 'default' for console.timeLog()\nWarning: No such label 'default' for console.timeEnd()\n");
  }));

  it.effect("trace renders optional labels and absent stacks; timers fall back without performance", () => Effect.gen(function* () {
    const fake = makeFakeStreams();
    const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
    bridge.writer.trace(); bridge.writer.trace("normal");
    assert.match(fake.stderr(), /^Trace\n\s+at /);
    assert.include(fake.stderr(), "Trace: normal\n");
    const before = fake.stderr();
    const capture = vi.spyOn(Error, "captureStackTrace").mockImplementation((target) => Object.defineProperty(target, "stack", { value: undefined, configurable: true }));
    try {
      bridge.writer.trace(); bridge.writer.trace("label");
      assert.strictEqual(fake.stderr().slice(before.length), "Trace\nTrace: label\n");
    } finally { capture.mockRestore(); }
    vi.stubGlobal("performance", undefined);
    try {
      bridge.writer.time("fallback"); bridge.writer.timeEnd("fallback");
      assert.match(fake.stdout(), /^fallback: \d+\.\d{3}ms\n$/);
    } finally { vi.unstubAllGlobals(); }
  }));

  it.effect("bridge renders children and only its current mount may detach writers", () => Effect.gen(function* () {
    hooks.effects.length = 0; hooks.out.length = 0; hooks.err.length = 0;
    const fake = makeFakeStreams();
    const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
    assert.strictEqual(bridge.Bridge({}), null);
    assert.strictEqual(bridge.Bridge({ children: "child" }), "child");
    const [first, second] = hooks.effects;
    assert.isDefined(first); assert.isDefined(second);
    if (first === undefined || second === undefined) throw new Error("missing layout effects");
    const releaseFirst = first(); const releaseSecond = second();
    releaseFirst();
    bridge.print("attached"); bridge.writer.warn("warning");
    assert.deepStrictEqual(hooks.out, ["attached\n"]);
    assert.deepStrictEqual(hooks.err, ["warning\n"]);
    releaseSecond(); bridge.print("released");
    assert.strictEqual(fake.stdout(), "released\n");
  }));
});
