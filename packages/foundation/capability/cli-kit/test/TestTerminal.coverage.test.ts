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
      const columns1 = yield* terminal.columns;
      assert.strictEqual(columns1, 91);
      const rows2 = yield* terminal.rows;
      assert.strictEqual(rows2, 33);
      yield* terminal.display("ready");
      const pipe3 = yield* terminal.readLine.pipe(Effect.result);
      assertFailure(pipe3, Terminal.QuitError.make({}));
      const output4 = yield* handle.output;
      assert.strictEqual(output4, "ready");
      const pending5 = yield* handle.pending;
      assert.strictEqual(pending5, 1);
      const reads6 = yield* handle.reads;
      assert.deepStrictEqual(reads6, { keys: 0, lines: 1, subscriptions: 0 });
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
          const take7 = yield* Queue.take(sizes);
          assert.deepStrictEqual(take7, { columns: 72, rows: 18 });
          return sizes;
        })
      );
      const ended = yield* Queue.take(subscription).pipe(Effect.exit);
      ended.pipe(Exit.isFailure, assertTrue);
    })
  );
});
