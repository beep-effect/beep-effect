import { TestTerminal } from "@beep/cli-kit/TestTerminal";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("TestTerminal regressions", () => {
  it.effect("input offered after end is never counted as read without a reader", () =>
    Effect.gen(function* () {
      const terminal = yield* TestTerminal.make();
      yield* terminal.end;

      yield* terminal.input([{ name: "enter" }, { name: "down" }]);
      const reads1 = yield* terminal.reads;
      assert.deepStrictEqual(reads1, { keys: 0, lines: 0, subscriptions: 0 });
      const pending2 = yield* terminal.pending;
      assert.strictEqual(pending2, 0);

      yield* terminal.type("abc");
      const reads3 = yield* terminal.reads;
      assert.deepStrictEqual(reads3, { keys: 0, lines: 0, subscriptions: 0 });
      const pending4 = yield* terminal.pending;
      assert.strictEqual(pending4, 0);
    })
  );
});
