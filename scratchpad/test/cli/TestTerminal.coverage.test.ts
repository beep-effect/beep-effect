import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Terminal from "effect/Terminal";
import { TestTerminal, type TestTerminalHandle } from "../../effected/cli/TestTerminal.ts";

class Harness extends Context.Service<Harness, TestTerminalHandle>()("@beep/scratchpad/test/cli/TestTerminal.coverage.test/Harness") {}
const layer = Layer.unwrap(Effect.gen(function* () {
  const handle = yield* TestTerminal.make({ columns: 91, rows: 33 });
  return Layer.merge(handle.layer, Layer.succeed(Harness, handle));
}));

it.effect("TestTerminal retains its runtime class identity", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(TestTerminal, []);
  assert.isTrue(instance instanceof TestTerminal);
}));

it.layer(layer, { timeout: "30 seconds" })((it) => {
  it.effect("readLine quits and records an attempted line without consuming queued keys", () => Effect.gen(function* () {
    const handle = yield* Harness;
    yield* handle.type("x");
    const terminal = yield* Terminal.Terminal;
    assert.strictEqual(yield* terminal.columns, 91);
    assert.strictEqual(yield* terminal.rows, 33);
    yield* terminal.display("ready");
    assertFailure(yield* terminal.readLine.pipe(Effect.result), Terminal.QuitError.make({}));
    assert.strictEqual(yield* handle.output, "ready");
    assert.strictEqual(yield* handle.pending, 1);
    assert.deepStrictEqual(yield* handle.reads, { keys: 0, lines: 1, subscriptions: 0 });
  }));
});
