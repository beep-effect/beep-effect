import { assert, describe, it } from "@effect/vitest";
import { WorkflowCommand } from "../../effected/github-commands/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as References from "effect/References";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { TestConsole } from "effect/testing";
import { ActionEnvironment, ActionLogger, ActionOutputs } from "../../effected/github-actions/index.ts";
import { commandLines, isCommand } from "./helpers/runnerCommands.ts";

const Json = S.fromJsonString(S.Unknown);

const ZWSP = String.fromCodePoint(0x200b);

/** Everything written to `Console.log`, as strings, in order. */
const lines = Effect.map(TestConsole.logLines, (captured) => captured.map(String));

const HOSTILE = [
	"ok\n::add-mask::x",
	"prefix ##[error]y",
	"a\r::error::cr",
	"b\u0085::warning::nel",
	"c\r\n  ##[stop-commands]tok",
	"::notice::leading",
	"fine ## heading",
];

const logged = Effect.fn("logged")(function* <A, E>(program: Effect.Effect<A, E>) {
	yield* program;
	return yield* lines;
});

describe("ActionLogger neutralizes the plain text it writes", () => {
	it("the oracle flags real commands and a mid-line legacy form (positive controls)", () => {
		for (const real of ["::error::x", "::group::y", "prefix ##[error]y"]) assert.isTrue(isCommand(real), real);
		assert.isFalse(isCommand("fine ## heading"));
	});

	for (const text of HOSTILE) {
		it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
			it.effect(
				`Effect.logInfo(${Result.getOrThrowWith(S.encodeResult(Json)(text), (error) => error)}) reaches stdout with no command line`,
				() =>
					Effect.gen(function* () {
						const captured = yield* logged(Effect.logInfo(text));
						assert.deepStrictEqual(
							commandLines(captured.join("\n")),
							[],
							Result.getOrThrowWith(S.encodeResult(Json)(captured), (error) => error),
						);
						assert.isAbove(captured.length, 0);
					}),
			);
		});
	}

	it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
		it.effect("the text is kept: only zero-width spaces are added", () =>
			Effect.gen(function* () {
				const captured = yield* logged(Effect.logInfo("ok\n::add-mask::x"));
				assert.strictEqual(captured.join("\n").replaceAll(ZWSP, ""), "ok\n::add-mask::x");
				assert.include(captured.join("\n"), ZWSP);
			}),
		);
	});

	it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
		it.effect("an ordinary line, and a bare ##, are untouched", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logInfo("hello", 3)), ["hello 3"]);
			}),
		);
	});

	it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
		it.effect("a markdown heading is not a command", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logInfo("## Heading")), ["## Heading"]);
			}),
		);
	});

	it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
		it.effect("a hostile Error-level message is still ONE real ::error:: command, its data escaped", () =>
			Effect.gen(function* () {
				const captured = yield* logged(Effect.logError("x\n::error::y ##[stop-commands]z"));
				assert.strictEqual(captured.length, 1);
				assert.match(captured[0] ?? "", /^::error::x%0A::error::y /);
				assert.isTrue(isCommand(captured[0] ?? ""), "the real command is a command: this layer must not defang it");
				assert.deepStrictEqual(captured, [WorkflowCommand.error("x\n::error::y ##[stop-commands]z")]);
			}),
		);
	});

	it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
		it.effect("a warning is still a real ::warning:: command", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logWarning("careful")), [WorkflowCommand.warning("careful")]);
			}),
		);
	});

	it.layer(ActionLogger.layerLogger, { timeout: "30 seconds" })((it) => {
		it.effect("a debug line is still a real ::debug:: command", () =>
			Effect.gen(function* () {
				const debug = yield* logged(
					Effect.logDebug("noisy").pipe(Effect.provideService(References.MinimumLogLevel, "All")),
				);
				assert.deepStrictEqual(debug, [WorkflowCommand.debug("noisy")]);
			}),
		);
	});

	it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })((it) => {
		it.effect("group and notice are still real commands through ActionLogger", () =>
			Effect.gen(function* () {
				const logger = yield* ActionLogger;
				yield* logger.group("install", Effect.void);
				yield* logger.notice("looks odd", { file: "src/a.ts", startLine: 12 });
				const captured = yield* lines;
				assert.deepStrictEqual(captured, [
					WorkflowCommand.group("install"),
					WorkflowCommand.endGroup(),
					WorkflowCommand.notice("looks odd", { file: "src/a.ts", startLine: 12 }),
				]);
				assert.strictEqual(commandLines(captured.join("\n")).length, 3);
			}),
		);
	});
});

describe("the buffered transcript and the step line are neutralized too", () => {
	it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })((it) => {
		it.effect("a flushed transcript, its header with the label, and its entries", () =>
			Effect.gen(function* () {
				const logger = yield* ActionLogger;
				yield* Effect.flip(
					logger.withBuffer(
						"step ##[error]label",
						Effect.andThen(Effect.logInfo("resolving\n::add-mask::secret"), Effect.fail("boom")),
					),
				);
				const captured = yield* lines;
				assert.isAbove(captured.length, 2);
				assert.deepStrictEqual(commandLines(captured.join("\n")), []);
				assert.include(captured.join("\n").replaceAll(ZWSP, ""), "resolving\n::add-mask::secret");
			}),
		);
	});

	it.layer(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))), { timeout: "30 seconds" })((it) => {
		it.effect("withStep's failure line carries a hostile step name safely", () =>
			Effect.gen(function* () {
				const logger = yield* ActionLogger;
				yield* Effect.flip(logger.withStep("name\n::error::x ##[add-mask]y", Effect.fail("boom")));
				const captured = yield* lines;
				assert.deepStrictEqual(
					commandLines(captured.join("\n")),
					[],
					Result.getOrThrowWith(S.encodeResult(Json)(captured), (error) => error),
				);
			}),
		);
	});
});

describe("a detached worker's setFailed degrades to a neutralized plain line", () => {
	it.layer(ActionOutputs.layerDetached, { timeout: "30 seconds" })((it) => {
		it.effect("the message cannot start a command or hold ##[", () =>
			Effect.gen(function* () {
				const outputs = yield* ActionOutputs;
				yield* outputs.setFailed("bad\n::error::x ##[stop-commands]y");
				const errors = (yield* TestConsole.errorLines).map(String);
				assert.deepStrictEqual(
					commandLines(errors.join("\n")),
					[],
					Result.getOrThrowWith(S.encodeResult(Json)(errors), (error) => error),
				);
				assert.isAbove(errors.length, 0);
			}),
		);
	});
});
