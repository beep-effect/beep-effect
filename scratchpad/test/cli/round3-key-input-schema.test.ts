import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Terminal from "effect/Terminal";
import { KeyInput, TestTerminal } from "../../effected/cli/TestTerminal.ts";
import { assertExitSuccess } from "@effect/vitest/utils";
const decode = S.decodeUnknownExit(KeyInput);
const encode = S.encodeUnknownExit(KeyInput);

describe("KeyInput schema", () => {
	it("decodes arbitrary key names with no modifiers", () => {
		assert.deepStrictEqual(decode({ name: "not-a-known-key" }), Exit.succeed({ name: "not-a-known-key" }));
		assert.deepStrictEqual(decode({ name: "" }), Exit.succeed({ name: "" }));
	});

	it("keeps every modifier when present", () => {
		const key = { name: "c", ctrl: true, meta: false, shift: true };
		assert.deepStrictEqual(decode(key), Exit.succeed(key));
		assert.deepStrictEqual(encode(key), Exit.succeed(key));
	});

	it("accepts and preserves explicit undefined modifiers", () => {
		const key = { name: "enter", ctrl: undefined, meta: undefined, shift: undefined };
		const decoded = decode(key);
		assertExitSuccess(decoded, key);
		assert.isTrue("ctrl" in decoded.value);
		assert.isTrue(S.is(KeyInput)(key));
	});

	it("rejects a missing name and non-boolean modifiers", () => {
		assert.isTrue(Exit.isFailure(decode({})));
		assert.isTrue(Exit.isFailure(decode({ name: 1 })));
		assert.isTrue(Exit.isFailure(decode({ name: "a", ctrl: "yes" })));
		assert.isTrue(Exit.isFailure(decode({ name: "a", shift: null })));
	});

	it.effect("queues decoded keys with undefined modifiers read as not held", () =>
		Effect.gen(function* () {
			const terminal = yield* TestTerminal.make();
			const key = yield* S.decodeEffect(KeyInput)({ name: "x", ctrl: undefined, meta: true });
			yield* terminal.input([key]);
			const queue = yield* Effect.scopedWith((scope) =>
				Effect.flatMap(Layer.buildWithScope(terminal.layer, scope), (context) =>
					Effect.provideContext(
						Effect.gen(function* () {
							const service = yield* Terminal.Terminal;
							return yield* service.readInput;
						}),
						context,
					),
				),
			);
			const first = yield* Queue.take(queue);
			assert.deepStrictEqual(first.key, { name: "x", ctrl: false, meta: true, shift: false });
		}),
	);
});
