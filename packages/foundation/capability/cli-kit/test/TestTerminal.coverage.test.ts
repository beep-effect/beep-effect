import { TestTerminal } from "@beep/cli-kit/TestTerminal";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Terminal from "effect/Terminal";
import type { TestTerminalHandle } from "@beep/cli-kit/TestTerminal";

class Harness extends Context.Service<Harness, TestTerminalHandle>()(
  "@beep/cli-kit/test/TestTerminal.coverage.test/Harness"
) {}
const layer = Layer.unwrap(
  Effect.gen(function* () {
    const handle = yield* TestTerminal.make({ columns: 91, rows: 33 });
    return Layer.merge(handle.layer, Layer.succeed(Harness, handle));
  })
);

it.effect("TestTerminal retains its runtime class identity", () =>
  Effect.sync(() => {
    const instance: unknown = Reflect.construct(TestTerminal, []);
    assert.isTrue(instance instanceof TestTerminal);
  })
);

it.layer(layer, { timeout: "30 seconds" })((it) => {
  it.effect("readLine quits and records an attempted line without consuming queued keys", () =>
    Effect.gen(function* () {
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
    })
  );
});

const sizedLayer = Layer.unwrap(Effect.map(TestTerminal.make({ columns: 72, rows: 18 }), (handle) => handle.layer));

it.layer(sizedLayer, { timeout: "30 seconds" })((it) => {
  it.effect("TestTerminal size subscriptions start at the fixed size and end with their scope", () =>
    Effect.gen(function* () {
      const terminal = yield* Terminal.Terminal;
      const subscription = yield* Effect.scoped(
        Effect.gen(function* () {
          const sizes = yield* terminal.size;
          assert.deepStrictEqual(yield* Queue.take(sizes), { columns: 72, rows: 18 });
          return sizes;
        })
      );
      const ended = yield* Queue.take(subscription).pipe(Effect.exit);
      ended.pipe(Exit.isFailure, assertTrue);
    })
  );
});
