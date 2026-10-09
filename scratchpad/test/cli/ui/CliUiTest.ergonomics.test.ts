// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import * as Data from "effect/Data";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import { Command } from "effect/cli";
import { Cancelled, CliExit } from "../../../effected/cli/index.ts";
import type { KeyName } from "../../../effected/cli/ui.ts";
import { CliUi, Select, TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import { deliberatelyInvalid } from "../deliberatelyInvalid.ts";

class TestError extends Data.TaggedError("TestError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly name = "Error";
	constructor(message: string, options?: { readonly cause?: unknown }) { super({ message, ...options }); }
}

const defectMessage = (exit: Exit.Exit<unknown, unknown>): string => {
	if (Exit.isSuccess(exit)) return "";
	const defect = Cause.squash(exit.cause);
	return defect instanceof Error ? defect.message : String(defect);
};

describe("press takes characters as chunk does, and names type for a bare string (O2a)", () => {
	it.live("press({ char }) types the character, between named keys", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.press({ char: "n" }, { char: "o" }, "enter");
			assert.strictEqual(yield* handle.result, "no");
		}).pipe(Effect.scoped),
	);

	it.live("a bare string that is not a key name dies naming type(...) and { char }, not a stream error", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			const exit = yield* Effect.exit(handle.press(deliberatelyInvalid<KeyName>("n")));
			const message = defectMessage(exit);
			assert.include(message, 'type("n")');
			assert.include(message, '{ char: "n" }');
			assert.notInclude(message, "chunk");
			const chunked = yield* Effect.exit(handle.chunk(deliberatelyInvalid<KeyName>("x")));
			assert.include(defectMessage(chunked), 'type("x")');
		}).pipe(Effect.scoped),
	);
});

describe("CliUiTest.cancelReason (O2b)", () => {
	it.live("finds a Cancelled in the typed channel of a screen's exit", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.press("escape");
			const exit = yield* Effect.exit(handle.result);
			assert.deepStrictEqual(CliUiTest.cancelReason(exit), O.some("escape"));
		}).pipe(Effect.scoped),
	);

	it("finds one as a defect, and in a bare Cause", () => {
		assert.deepStrictEqual(
			CliUiTest.cancelReason(Exit.die(Cancelled.make({ reason: "interrupt" }))),
			O.some("interrupt"),
		);
		assert.deepStrictEqual(
			CliUiTest.cancelReason(Cause.fail(Cancelled.make({ reason: "escape" }))),
			O.some("escape"),
		);
		assert.deepStrictEqual(
			CliUiTest.cancelReason(Cause.die(Cancelled.make({ reason: "interrupt" }))),
			O.some("interrupt"),
		);
	});

	it("is None for a success, another failure, or an interrupt", () => {
		assert.deepStrictEqual(CliUiTest.cancelReason(Exit.succeed(1)), O.none());
		assert.deepStrictEqual(CliUiTest.cancelReason(Exit.fail(new TestError("boom"))), O.none());
		assert.deepStrictEqual(CliUiTest.cancelReason(Cause.die("x")), O.none());
		assert.deepStrictEqual(CliUiTest.cancelReason(Cause.interrupt()), O.none());
	});
});

describe("the session recipe for a whole Command handler (O2c)", () => {
	/** A tiny command: reads HOME through Config, asks one question, records a findings code. */
	const pick = Command.make("pick", {}, () =>
		Effect.gen(function* () {
			const home = yield* Config.String("HOME");
			const answer = yield* CliUi.prompt(
				Select.screen({
					message: "Pick one",
					choices: [
						{ label: "keep", value: "keep" },
						{ label: "drop", value: "drop" },
					],
				}),
			);
			yield* Console.log(`${home}:${answer}`);
			if (answer === "drop") yield* CliExit.set(3);
		}),
	);

	it.live("session.layer + CliExit.layer + a ConfigProvider for HOME, forked, then next()", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			const program = Effect.gen(function* () {
				yield* Command.runWith(pick, { version: "1.0.0" })([]);
				return MutableRef.get((yield* CliExit).code);
			}).pipe(
				Effect.provide(session.layer),
				Effect.provide(CliExit.layer),
				Effect.provide(NodeServices.layer),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ HOME: "/sandbox/home" })),
			);
			const fiber = yield* Effect.forkScoped(program);
			const screen = yield* session.next({ contains: "Pick one" });
			yield* screen.press("down", "enter");
			assert.strictEqual(yield* Fiber.join(fiber), 3);
			assert.strictEqual(yield* session.stdout, "/sandbox/home:drop\n");
			assert.strictEqual(yield* session.mounts, 1);
		}).pipe(Effect.scoped),
	);
});

describe("Select's highlight marker in plainFrame (O2d)", () => {
	it.live("the arrow marks the initial index in plain text, so a test can assert it", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				Select.screen({
					message: "Profile",
					choices: [
						{ label: "software-project", value: 0 },
						{ label: "library", value: 1 },
					],
					initial: 1,
				}),
			);
			const plain = yield* handle.plainFrame;
			const lines = plain.split("\n");
			assert.include(lines, "→ library", plain);
			assert.include(lines, "  software-project", plain);
		}).pipe(Effect.scoped),
	);
});
