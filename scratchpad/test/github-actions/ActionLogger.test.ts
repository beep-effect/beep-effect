// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect, Latch, Layer, References } from "effect";
import { TestConsole } from "effect/testing";
import { ActionEnvironment, ActionLogger } from "../../effected/github-actions/index.ts";

/** Everything written to `Console.log`, as strings, in order. */
const lines = Effect.map(TestConsole.logLines, (captured) => captured.map(String));

const live = <A, E>(program: Effect.Effect<A, E, ActionLogger>, env: Readonly<Record<string, string>> = {}) =>
	program.pipe(Effect.provide(ActionLogger.layer.pipe(Layer.provide(ActionEnvironment.layerTest(env)))));

/** The lines a single buffer flushed, between its header and its footer. */
const bufferedFor = (label: string, captured: ReadonlyArray<string>): ReadonlyArray<string> => {
	const start = captured.findIndex((line) => line.includes(`Buffered output for "${label}"`));
	const end = captured.findIndex((line) => line.includes(`End buffered output for "${label}"`));
	return start === -1 || end === -1 ? [] : captured.slice(start + 1, end);
};

describe("ActionLogger", () => {
	describe("groups", () => {
		it.effect("brackets the effect with ::group:: and ::endgroup::", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					const value = yield* logger.group("install", Effect.succeed(7));
					assert.strictEqual(value, 7);
					const captured = yield* lines;
					assert.deepStrictEqual(captured, ["::group::install", "::endgroup::"]);
				}),
			),
		);

		it.effect("closes the group even when the effect fails", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* Effect.flip(logger.group("install", Effect.fail("boom")));
					const captured = yield* lines;
					assert.strictEqual(captured.at(-1), "::endgroup::");
				}),
			),
		);

		it.effect("escapes a group name that would otherwise inject a command", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.group("bad\n::error::smuggled", Effect.void);
					const captured = yield* lines;
					assert.strictEqual(captured[0], "::group::bad%0A::error::smuggled");
				}),
			),
		);
	});

	describe("annotations", () => {
		it.effect("emits a notice with its source annotation", () =>
			live(
				Effect.gen(function* () {
					yield* (yield* ActionLogger).notice("looks odd", { file: "src/a.ts", startLine: 12 });
					const captured = yield* lines;
					assert.deepStrictEqual(captured, ["::notice file=src/a.ts,line=12::looks odd"]);
				}),
			),
		);

		it.effect("annotated puts file and line on a log the workflow logger renders", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.annotated({ file: "src/b.ts", startLine: 3, startColumn: 5 }, Effect.logWarning("careful"));
					const captured = yield* lines;
					assert.deepStrictEqual(captured, ["::warning file=src/b.ts,line=3,col=5::careful"]);
				}),
			).pipe(Effect.provide(ActionLogger.layerLogger)),
		);
	});

	describe("the workflow-command logger", () => {
		const logged = Effect.fn("logged")(function*<A, E>(program: Effect.Effect<A, E>) {
				yield* program;
				return yield* lines;
			}, Effect.provide(ActionLogger.layerLogger));

		it.effect("maps error to ::error::", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logError("it broke")), ["::error::it broke"]);
			}),
		);

		it.effect("maps warning to ::warning::", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logWarning("careful")), ["::warning::careful"]);
			}),
		);

		it.effect("maps info to plain text, with no command prefix", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logInfo("hello")), ["hello"]);
			}),
		);

		it.effect("maps debug to ::debug::", () =>
			Effect.gen(function* () {
				const captured = yield* logged(
					Effect.logDebug("noisy").pipe(Effect.provideService(References.MinimumLogLevel, "All")),
				);
				assert.deepStrictEqual(captured, ["::debug::noisy"]);
			}),
		);

		it.effect("escapes a newline so a log line cannot become a second command", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logError("line one\n::error::smuggled")), [
					"::error::line one%0A::error::smuggled",
				]);
			}),
		);

		it.effect("joins a multi-part message", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* logged(Effect.logInfo("count", 3)), ["count 3"]);
			}),
		);
	});

	describe("buffering", () => {
		it.effect("captures verbose output and flushes it when the step succeeds", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withBuffer("install", Effect.logInfo("resolving").pipe(Effect.andThen(Effect.logInfo("done"))));
					const captured = yield* lines;
					assert.deepStrictEqual(bufferedFor("install", captured), ["resolving", "done"]);
				}),
			),
		);

		it.effect("flushes the transcript when the step fails", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* Effect.flip(
						logger.withBuffer("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom"))),
					);
					const captured = yield* lines;
					assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
				}),
			),
		);

		it.effect("onSuccess: 'discard' drops the transcript when the step succeeds", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					const value = yield* logger.withBuffer(
						"install",
						Effect.as(Effect.andThen(Effect.logInfo("resolving"), Effect.logInfo("done")), 7),
						{ onSuccess: "discard" },
					);
					assert.strictEqual(value, 7);
					const captured = yield* lines;
					// A green step leaves NOTHING behind — no header, no footer, no body.
					assert.deepStrictEqual(captured, []);
				}),
			),
		);

		it.effect("onSuccess: 'discard' still flushes the transcript when the step fails", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* Effect.flip(
						logger.withBuffer("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom")), {
							onSuccess: "discard",
						}),
					);
					const captured = yield* lines;
					// Discard is a statement about SUCCESS only; the failure transcript
					// is exactly what the buffer was kept for.
					assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
				}),
			),
		);

		it.effect("onSuccess: 'flush' spelled explicitly matches the default", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withBuffer("install", Effect.logInfo("resolving"), { onSuccess: "flush" });
					const captured = yield* lines;
					assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
				}),
			),
		);

		it.effect("onSuccess: 'discard' does not suppress warnings, which never entered the buffer", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withBuffer("install", Effect.andThen(Effect.logWarning("deprecated"), Effect.logInfo("done")), {
						onSuccess: "discard",
					});
					const captured = yield* lines;
					// The warning went out live; only the Info transcript was discarded.
					assert.deepStrictEqual(captured, ["::warning::deprecated"]);
				}),
			),
		);

		it.effect("passes warnings through immediately rather than burying them in the buffer", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withBuffer("install", Effect.andThen(Effect.logWarning("deprecated"), Effect.logInfo("done")));
					const captured = yield* lines;
					// The warning is emitted before the flush header, so it is visible
					// while the step is still running.
					assert.strictEqual(captured[0], "::warning::deprecated");
					assert.deepStrictEqual(bufferedFor("install", captured), ["done"]);
				}),
			),
		);

		it.effect("does not buffer when the runner has step debugging enabled", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withBuffer("install", Effect.logInfo("resolving"));
					const captured = yield* lines;
					assert.deepStrictEqual(captured, ["resolving"]);
				}).pipe(Effect.provide(ActionLogger.layerLogger)),
				{ RUNNER_DEBUG: "1" },
			),
		);

		it.effect("flushes an enclosing buffer inside the group that failed", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* Effect.flip(
						logger.withBuffer(
							"install",
							logger.group("resolve", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom"))),
						),
					);
					const captured = yield* lines;
					const endGroup = captured.indexOf("::endgroup::");
					const flushed = captured.findIndex((line) => line.includes('Buffered output for "install"'));
					assert.isAbove(endGroup, 0, "the group must close");
					assert.isBelow(flushed, endGroup, "the transcript belongs inside the group that failed");
					assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
				}),
			),
		);

		it.effect("keeps concurrent buffers separate", () =>
			live(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					// THREE latches, and the order is the whole test. A save/restore
					// implementation over a shared "current buffer" global is LIFO-correct
					// whenever two buffers nest, so the obvious interleaving passes for the
					// wrong reason. This order forces LEFT TO LOG WHILE RIGHT'S BUFFER IS
					// STILL APPLIED AND UNRESTORED — which only a fiber-local
					// implementation survives.
					const leftInside = yield* Latch.make();
					const rightInside = yield* Latch.make();
					const leftDone = yield* Latch.make();
					yield* Effect.all(
						[
							logger.withBuffer(
								"left",
								Effect.gen(function* () {
									yield* Effect.logInfo("left-first");
									yield* leftInside.open;
									yield* rightInside.await;
									yield* Effect.logInfo("left-second");
									yield* leftDone.open;
								}),
							),
							Effect.gen(function* () {
								yield* leftInside.await;
								yield* logger.withBuffer(
									"right",
									Effect.gen(function* () {
										yield* Effect.logInfo("right-only");
										yield* rightInside.open;
										yield* leftDone.await;
									}),
								);
							}),
						],
						{ concurrency: 2 },
					);
					const captured = yield* lines;
					assert.deepStrictEqual(bufferedFor("left", captured), ["left-first", "left-second"]);
					assert.deepStrictEqual(bufferedFor("right", captured), ["right-only"]);
				}),
			),
		);
	});

	describe("steps", () => {
		/** `withStep` renders its summary through `Effect.logInfo`, so the log-to-
		 * workflow-command logger has to be installed for the line to be observable
		 * — the same one `Action.run` installs. */
		const stepped = <A, E>(program: Effect.Effect<A, E, ActionLogger>, env: Readonly<Record<string, string>> = {}) =>
			live(program.pipe(Effect.provide(ActionLogger.layerLogger)), env);

		it.effect("trades the transcript for exactly one summary line on success", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					const value = yield* logger.withStep(
						"install",
						Effect.as(Effect.andThen(Effect.logInfo("resolving"), Effect.logInfo("done")), 7),
					);
					assert.strictEqual(value, 7);
					// The whole point: two verbose lines in, one summary line out. This is
					// the step `withBuffer({ onSuccess: "discard" })` alone cannot reach —
					// it leaves ZERO lines, which is why the recipe kept coming out wrong.
					assert.deepStrictEqual(yield* lines, ["✅ install"]);
				}),
			),
		);

		it.effect("a supplied summary replaces the default line", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withStep("install", Effect.logInfo("resolving"), { summary: "installed 42 packages" });
					assert.deepStrictEqual(yield* lines, ["installed 42 packages"]);
				}),
			),
		);

		it.effect("emits the failure header BEFORE the transcript it announces", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* Effect.flip(
						logger.withStep("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom"))),
					);
					const captured = yield* lines;
					const header = captured.indexOf("❌ install");
					const flushed = captured.findIndex((line) => line.includes('Buffered output for "install"'));
					assert.isAtLeast(header, 0, "the failure header must be emitted");
					assert.isBelow(header, flushed, "the header introduces the transcript, so it cannot follow it");
					assert.deepStrictEqual(bufferedFor("install", captured), ["resolving"]);
					// The success line is a statement about success; a failed step must not
					// claim one. Mutating the `Effect.tap` to `Effect.onExit` fails here.
					assert.isFalse(captured.includes("✅ install"));
				}),
			),
		);

		it.effect("the summary is never captured by the buffer it replaces", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withStep("install", Effect.logInfo("resolving"));
					const captured = yield* lines;
					// Emitting the summary INSIDE the buffered region would discard it
					// along with the transcript, leaving a green step with no line at all.
					assert.deepStrictEqual(captured, ["✅ install"]);
				}),
			),
		);

		it.effect("warnings still go out live rather than into the discarded transcript", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withStep("install", Effect.andThen(Effect.logWarning("deprecated"), Effect.logInfo("done")));
					assert.deepStrictEqual(yield* lines, ["::warning::deprecated", "✅ install"]);
				}),
			),
		);

		it.effect("keeps the summary when step debugging turns buffering off", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* logger.withStep("install", Effect.logInfo("resolving"));
					// Verbose output goes live AND the summary still lands: someone asking
					// for debug output has not asked to lose the line naming what passed.
					assert.deepStrictEqual(yield* lines, ["resolving", "✅ install"]);
				}),
				{ RUNNER_DEBUG: "1" },
			),
		);

		it.effect("under step debugging a FAILING step emits the header after the live transcript", () =>
			stepped(
				Effect.gen(function* () {
					const logger = yield* ActionLogger;
					yield* Effect.flip(
						logger.withStep("install", Effect.andThen(Effect.logInfo("resolving"), Effect.fail("boom"))),
					);
					const captured = yield* lines;
					// The documented ordering ("header first, then the transcript") is a
					// property of the BUFFERED path only. With step debugging on,
					// withBuffer returns the effect unbuffered, so its output has already
					// gone out live by the time tapCause fires and the header lands LAST.
					// Pinned rather than papered over: the docstring is qualified to
					// match. The debug suite previously only exercised a successful step,
					// so this ordering was undocumented and unverified.
					assert.deepStrictEqual(captured, ["resolving", "❌ install"]);
				}),
				{ RUNNER_DEBUG: "1" },
			),
		);

		it.effect("the test double passes the effect through without a summary", () =>
			Effect.gen(function* () {
				const logger = yield* ActionLogger;
				assert.strictEqual(yield* logger.withStep("step", Effect.succeed("value")), "value");
				assert.deepStrictEqual(yield* lines, []);
			}).pipe(Effect.provide(ActionLogger.layerTest())),
		);
	});

	describe("silence", () => {
		it.effect("layerSilent drops log output entirely", () =>
			Effect.gen(function* () {
				yield* Effect.logError("would be noisy");
				assert.deepStrictEqual(yield* lines, []);
			}).pipe(Effect.provide(ActionLogger.layerSilent)),
		);

		it.effect("layerSilent still serves the service, passing effects through", () =>
			Effect.gen(function* () {
				const logger = yield* ActionLogger;
				assert.strictEqual(yield* logger.group("quiet", Effect.succeed(1)), 1);
				assert.deepStrictEqual(yield* lines, []);
			}).pipe(Effect.provide(ActionLogger.layerSilent)),
		);
	});

	describe("test double", () => {
		it.effect("the default double is silent rather than dying", () =>
			Effect.gen(function* () {
				const logger = yield* ActionLogger;
				yield* logger.notice("nothing to see");
				assert.strictEqual(yield* logger.withBuffer("step", Effect.succeed("value")), "value");
				assert.deepStrictEqual(yield* lines, []);
			}).pipe(Effect.provide(ActionLogger.layerTest())),
		);

		it.effect("an override wins over the silent default", () =>
			Effect.gen(function* () {
				const notices: Array<string> = [];
				yield* Effect.gen(function* () {
					yield* (yield* ActionLogger).notice("recorded");
				}).pipe(
					Effect.provide(
						ActionLogger.layerTest({
							notice: (message) => Effect.sync(() => void notices.push(message)),
						}),
					),
				);
				assert.deepStrictEqual(notices, ["recorded"]);
			}),
		);
	});
});
