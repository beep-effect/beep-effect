import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TestTerminal } from "../../effected/cli/TestTerminal.ts";

describe("TestTerminal regressions", () => {
	it.effect("input offered after end is never counted as read without a reader", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			yield* terminal.end;

			yield* terminal.input([{ name: "enter" }, { name: "down" }]);
			assert.deepStrictEqual(yield* terminal.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* terminal.pending, 0);

			yield* terminal.type("abc");
			assert.deepStrictEqual(yield* terminal.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* terminal.pending, 0);
		}),
	);
});
