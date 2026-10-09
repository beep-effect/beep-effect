import * as Data from "effect/Data";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Context from "effect/Context";
import { assertSome, assertNone } from "@effect/vitest/utils";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { Command } from "effect/cli";
import { Cancelled, CliExit } from "../../../effected/cli/index.ts";
import type { KeyName } from "../../../effected/cli/ui.ts";
import { CliUi, Select, TextInput } from "../../../effected/cli/ui.ts";
import { CliUiTest, type CliUiTestSession } from "../../../effected/cli/ui-testing.ts";
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
	it.effect("press({ char }) types the character, between named keys", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.press({ char: "n" }, { char: "o" }, "enter");
			assert.strictEqual(yield* handle.result, "no");
		}),
	);

	it.effect("a bare string that is not a key name dies naming type(...) and { char }, not a stream error", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			const exit = yield* Effect.exit(handle.press(deliberatelyInvalid<KeyName>("n")));
			const message = defectMessage(exit);
			assert.include(message, 'type("n")');
			assert.include(message, '{ char: "n" }');
			assert.notInclude(message, "chunk");
			const chunked = yield* Effect.exit(handle.chunk(deliberatelyInvalid<KeyName>("x")));
			assert.include(defectMessage(chunked), 'type("x")');
		}),
	);
});

describe("CliUiTest.cancelReason (O2b)", () => {
	it.effect("finds a Cancelled in the typed channel of a screen's exit", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(TextInput.screen({ message: "Name" }));
			yield* handle.press("escape");
			const exit = yield* Effect.exit(handle.result);
			assertSome(CliUiTest.cancelReason(exit), "escape");
		}),
	);

	it("finds one as a defect, and in a bare Cause", () => {
		assertSome(
			CliUiTest.cancelReason(Exit.die(Cancelled.make({ reason: "interrupt" }))),
			"interrupt",
		);
		assertSome(
			CliUiTest.cancelReason(Cause.fail(Cancelled.make({ reason: "escape" }))),
			"escape",
		);
		assertSome(
			CliUiTest.cancelReason(Cause.die(Cancelled.make({ reason: "interrupt" }))),
			"interrupt",
		);
	});

	it("is None for a success, another failure, or an interrupt", () => {
		assertNone(CliUiTest.cancelReason(Exit.succeed(1)));
		assertNone(CliUiTest.cancelReason(Exit.fail(new TestError("boom"))));
		assertNone(CliUiTest.cancelReason(Cause.die("x")));
		assertNone(CliUiTest.cancelReason(Cause.interrupt()));
	});
});

class TestSession extends Context.Service<TestSession, CliUiTestSession>()("@beep/scratchpad/test/cli/ui/CliUiTest.ergonomics.test/TestSession") {}

const sessionLayer = Layer.unwrap(Effect.map(CliUiTest.session(), (session) =>
	Layer.merge(session.layer, Layer.succeed(TestSession, session)),
));

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

	it.layer(Layer.mergeAll(
		sessionLayer,
		CliExit.layer,
		MemoryFileSystem.layer,
		Path.layer,
		Stdio.layerTest({}),
		Layer.succeed(Terminal.Terminal, Terminal.make({
			columns: Effect.succeed(80), rows: Effect.succeed(24),
			readInput: Effect.die("unused terminal input"), readLine: Effect.die("unused terminal line"),
			display: () => Effect.void,
		})),
		Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}),
	), { timeout: "30 seconds" })((it) => {
		it.effect("session.layer + CliExit.layer + a ConfigProvider for HOME, forked, then next()", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				const program = Effect.gen(function* () {
					yield* Command.runWith(pick, { version: "1.0.0" })([]);
					return MutableRef.get((yield* CliExit).code);
				}).pipe(
					Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ HOME: "/sandbox/home" })),
				);
				const fiber = yield* Effect.forkScoped(program);
				const screen = yield* session.next({ contains: "Pick one" });
				yield* screen.press("down", "enter");
				assert.strictEqual(yield* Fiber.join(fiber), 3);
				assert.strictEqual(yield* session.stdout, "/sandbox/home:drop\n");
				assert.strictEqual(yield* session.mounts, 1);
			}),
		);
	});
});

describe("Select's highlight marker in plainFrame (O2d)", () => {
	it.effect("the arrow marks the initial index in plain text, so a test can assert it", () =>
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
		}),
	);
});

/** Class methods are inherited and non-enumerable, as an ambient console's members can be. */
class RecordingConsole implements Console.Console {
	readonly owner = this;
	readonly calls: Array<readonly [string, ReadonlyArray<unknown>]> = [];

	record(method: string, args: ReadonlyArray<unknown>): void {
		assert.strictEqual(this, this.owner, `${method} keeps the ambient receiver`);
		this.calls.push([method, args]);
	}
	assert(condition: boolean, ...args: ReadonlyArray<unknown>): void { this.record("assert", [condition, ...args]); }
	clear(): void { this.record("clear", []); }
	count(label?: string): void { this.record("count", [label]); }
	countReset(label?: string): void { this.record("countReset", [label]); }
	debug(...args: ReadonlyArray<unknown>): void { this.record("debug", args); }
	dir(item: unknown, options?: unknown): void { this.record("dir", [item, options]); }
	dirxml(...args: ReadonlyArray<unknown>): void { this.record("dirxml", args); }
	error(...args: ReadonlyArray<unknown>): void { this.record("error", args); }
	group(...args: ReadonlyArray<unknown>): void { this.record("group", args); }
	groupCollapsed(...args: ReadonlyArray<unknown>): void { this.record("groupCollapsed", args); }
	groupEnd(): void { this.record("groupEnd", []); }
	info(...args: ReadonlyArray<unknown>): void { this.record("info", args); }
	log(...args: ReadonlyArray<unknown>): void { this.record("log", args); }
	table(tabularData: unknown, properties?: ReadonlyArray<string>): void { this.record("table", [tabularData, properties]); }
	time(label?: string): void { this.record("time", [label]); }
	timeEnd(label?: string): void { this.record("timeEnd", [label]); }
	timeLog(label?: string, ...args: ReadonlyArray<unknown>): void { this.record("timeLog", [label, ...args]); }
	trace(...args: ReadonlyArray<unknown>): void { this.record("trace", args); }
	warn(...args: ReadonlyArray<unknown>): void { this.record("warn", args); }
}

describe("CliUiTest.session ambient Console delegation", () => {
	it.effect("captures all six output methods and delegates every other Console member with its ambient receiver", () =>
		Effect.gen(function* () {
			const ambient = new RecordingConsole();
			const session = yield* CliUiTest.session().pipe(Effect.provideService(Console.Console, ambient));
			yield* Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(session.layer, scope), (context) =>
				Effect.provideContext(Console.consoleWith((writer) => Effect.sync(() => {
					writer.log("log");
					writer.info("info");
					writer.debug("debug");
					writer.error("error");
					writer.warn("warn");
					writer.trace("trace");
					writer.assert(false, "assert", 1);
					writer.clear();
					writer.count("counter");
					writer.countReset("counter");
					writer.dir({ value: 1 }, { depth: 2 });
					writer.dirxml("xml", 2);
					writer.group("group", 3);
					writer.groupCollapsed("collapsed", 4);
					writer.groupEnd();
					writer.table([{ value: 1 }], ["value"]);
					writer.time("timer");
					writer.timeEnd("timer");
					writer.timeLog("timer", "elapsed", 5);
				})), context),
			));
			assert.strictEqual(yield* session.stdout, "log\ninfo\ndebug\n");
			assert.strictEqual(yield* session.stderr, "error\nwarn\ntrace\n");
			assert.deepStrictEqual(ambient.calls, [
				["assert", [false, "assert", 1]], ["clear", []], ["count", ["counter"]], ["countReset", ["counter"]],
				["dir", [{ value: 1 }, { depth: 2 }]], ["dirxml", ["xml", 2]], ["group", ["group", 3]],
				["groupCollapsed", ["collapsed", 4]], ["groupEnd", []], ["table", [[{ value: 1 }], ["value"]]],
				["time", ["timer"]], ["timeEnd", ["timer"]], ["timeLog", ["timer", "elapsed", 5]],
			]);
		}),
	);

	it.effect("resolves a replaced ambient method at call time, including a previously obtained writer", () =>
		Effect.gen(function* () {
			const ambient = new RecordingConsole();
			const session = yield* CliUiTest.session().pipe(Effect.provideService(Console.Console, ambient));
			yield* Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(session.layer, scope), (context) =>
				Effect.provideContext(Console.consoleWith((writer) => Effect.sync(() => {
					writer.count("before");
					ambient.count = function(this: RecordingConsole, ...args: [label?: string]): void {
						this.record("replacement", args);
					};
					writer.count("after");
					writer.count();
					writer.count(undefined);
				})), context),
			));
			assert.deepStrictEqual(ambient.calls, [
				["count", ["before"]], ["replacement", ["after"]], ["replacement", []], ["replacement", [undefined]],
			]);
			assert.strictEqual(yield* session.stdout, "");
			assert.strictEqual(yield* session.stderr, "");
		}),
	);
});
