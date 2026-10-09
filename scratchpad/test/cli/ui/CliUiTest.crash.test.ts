import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess, assertNone, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { Text } from "ink";
import type { ReactElement } from "react";
import { createElement, useContext, useEffect, useState } from "react";
import { UiRenderOptions } from "../../../effected/cli/ui/internal/renderOptions.ts";
import { screenContext, useScreenCancel } from "../../../effected/cli/ui/internal/ScreenContext.ts";
import type { Screen } from "../../../effected/cli/ui.ts";
import { CliUi, KeyTable, useKeys } from "../../../effected/cli/ui.ts";
import type { CliUiTestSession, CliUiTestScreen } from "../../../effected/cli/ui-testing.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

class TestSession extends Context.Service<TestSession, CliUiTestSession>()("@beep/scratchpad/test/cli/ui/CliUiTest.crash.test/TestSession") {}

const sessionLayer = Layer.unwrap(
	Effect.map(CliUiTest.session(), (session) => Layer.merge(session.layer, Layer.succeed(TestSession, session))),
);

const Json = S.fromJsonString(S.Unknown);

const messageOf = (exit: Exit.Exit<unknown, unknown>): string => {
	if (Exit.isSuccess(exit)) return "<succeeded>";
	const error = Cause.squash(exit.cause);
	return error instanceof Error ? error.message : String(error);
};

const isDie = (exit: Exit.Exit<unknown, unknown>): boolean =>
	Exit.isFailure(exit) && exit.cause.reasons.some(Cause.isDieReason);

const Boom = (): ReactElement => {
	throw new Error("component crashed");
};

/** A thunk that throws before it returns an element. */
const throwingThunk: Screen<never> = () => {
	throw new Error("thunk crashed");
};

/**
 * A thunk compiled with classic JSX where `React` is not in scope: `<Text>x</Text>` became `React.createElement(Text,
 * null, "x")`, and evaluating it throws a `ReferenceError`, as vitest-agent's tsx repro does.
 */
const classicJsx = new Function("Text", 'return React.createElement(Text, null, "x");');
const classicJsxThunk: Screen<never> = () => classicJsx(Text);

/** Every read and send of a screen, each run to its exit. */
const everyAccess = (screen: CliUiTestScreen) =>
	Effect.all({
		frame: Effect.exit(screen.frame),
		rawFrame: Effect.exit(screen.rawFrame),
		plainFrame: Effect.exit(screen.plainFrame),
		frames: Effect.exit(screen.frames),
		press: Effect.exit(screen.press("enter")),
		type: Effect.exit(screen.type("x")),
		chunk: Effect.exit(screen.chunk("enter")),
		resize: Effect.exit(screen.resize(40, 10)),
	});

const CASES: ReadonlyArray<readonly [string, Screen<never>, string]> = [
	["a throwing screen thunk", throwingThunk, "thunk crashed"],
	["a throwing component", () => createElement(Boom), "component crashed"],
	["a classic-JSX thunk with React not in scope", classicJsxThunk, "React is not defined"],
];

describe("CliUiTest.render surfaces a crash", () => {
	for (const [name, screen, message] of CASES) {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.live(`${name}: result dies, and every read and send dies, with the thrown message within 2 s`, () =>
			Effect.gen(function* () {
				const handle = yield* CliUiTest.render(screen);
				const result = yield* Effect.exit(handle.result);
				assert.isTrue(isDie(result), `result is a die: ${messageOf(result)}`);
				assert.include(messageOf(result), message);
				const accesses = yield* everyAccess(handle);
				for (const [access, exit] of Object.entries(accesses)) {
					assert.include(messageOf(exit), message, access);
				}
			}).pipe(Effect.timeout("2 seconds")),
		);
	}

	it.effect("control: a screen that draws and resolves reads its frames and never dies", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render<string>(() => createElement(Text, null, "fine"));
			assert.include(yield* handle.plainFrame, "fine");
			assert.isNotEmpty(yield* handle.frames);
		}),
	);
});

describe("CliUiTest.session surfaces a crash", () => {
	for (const [name, screen, message] of CASES) {
		it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
			// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
			it.effect(`${name}: next, or the next read or send, dies with the thrown message within 2 s`, () =>
				Effect.gen(function* () {
					const session = yield* TestSession;
					const fiber = yield* Effect.forkScoped(CliUi.run(screen));
					const taken = yield* Effect.exit(session.next());
					if (Exit.isFailure(taken)) {
						assert.include(messageOf(taken), message, "next");
					} else {
						const accesses = yield* everyAccess(taken.value);
						for (const [access, exit] of Object.entries(accesses)) {
							assert.include(messageOf(exit), message, access);
						}
					}
					const program = yield* Fiber.await(fiber);
					assert.include(messageOf(program), message, "control: the program itself died with it");
				}).pipe(Effect.timeout("2 seconds")),
			);
		});
	}

	it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.effect("a crash under next({ contains }) dies with the crash, not with what it waited for", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				yield* Effect.forkScoped(CliUi.run(() => createElement(Boom)));
				const taken = yield* Effect.exit(session.next({ contains: "never shown" }));
				assert.include(messageOf(taken), "component crashed");
			}).pipe(Effect.timeout("2 seconds")),
		);
	});
});

/**
 * Cancels and then throws in the same key handler: the cancel settles the screen's result first, and the crash comes
 * in the same tick, before anything has unmounted. `useScreenCancel` is the hook widgets cancel through.
 */
const CancelThenCrash = (): ReactElement => {
	const cancel = useScreenCancel();
	useKeys(KeyTable.make([{ keys: ["enter"], action: "go", help: "go" }]), () => {
		cancel("escape");
		throw new Error("crashed with the cancel");
	});
	return createElement(Text, null, "armed");
};

describe("a crash in the same tick as a cancel wins", () => {
	// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
	it.live("render: result dies with the crash, never Cancelled", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(CancelThenCrash));
			assert.include(yield* handle.plainFrame, "armed", "control: it drew first");
			yield* handle.press("enter");
			const result = yield* Effect.exit(handle.result);
			assert.isTrue(isDie(result), `result is a die: ${messageOf(result)}`);
			assert.include(messageOf(result), "crashed with the cancel");
			assert.include(messageOf(yield* Effect.exit(handle.frame)), "crashed with the cancel");
		}).pipe(Effect.timeout("2 seconds")),
	);

	// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
	it.live("view: the next read dies with the crash, not a readable cancelled frame", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.view(createElement(CancelThenCrash));
			yield* view.press("enter");
			assert.include(messageOf(yield* Effect.exit(view.frame)), "crashed with the cancel");
		}).pipe(Effect.timeout("2 seconds")),
	);

	it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.effect("session: the screen's next read and the program both die with the crash", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				const fiber = yield* Effect.forkScoped(
					CliUi.run(() => createElement(CancelThenCrash)),
				);
				const screen = yield* session.next({ contains: "armed" });
				yield* screen.press("enter");
				assert.include(messageOf(yield* Effect.exit(screen.frame)), "crashed with the cancel");
				const program = yield* Fiber.await(fiber);
				assert.isTrue(isDie(program), messageOf(program));
				assert.include(messageOf(program), "crashed with the cancel");
			}).pipe(Effect.timeout("2 seconds")),
		);
	});

	// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
	it.live("control: Esc alone still cancels with escape, and the frames stay readable", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(Text, null, "calm"));
			yield* handle.press("escape");
			const result = yield* Effect.exit(handle.result);
			assertSome(CliUiTest.cancelReason(result), "escape");
			assert.include(yield* handle.plainFrame, "calm");
		}).pipe(Effect.timeout("2 seconds")),
	);
});

/** Reports a crash through the screen's own `die` as it unmounts: a crash recorded while an interrupt ends the run. */
const CrashOnUnmount = (): ReactElement => {
	const screen = useContext(screenContext());
	useEffect(
		() => () => {
			screen?.die?.(new Error("crashed on unmount"));
		},
		[screen],
	);
	return createElement(Text, null, "steady");
};

describe("a crash and an interrupt, and the cause run keeps", () => {
	it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.effect(
			"a crash recorded while the run is interrupted: run is an interrupt, and the screen does not die with it",
			() =>
				Effect.gen(function* () {
					const session = yield* TestSession;
					const fiber = yield* Effect.forkScoped(
						CliUi.run(() => createElement(CrashOnUnmount)),
					);
					const screen = yield* session.next({ contains: "steady" });
					yield* Fiber.interrupt(fiber);
					const program = yield* Fiber.await(fiber);
					assertExitFailure(
						program,
						Exit.match(program, {
							onFailure: (cause) => Cause.fromReasons(cause.reasons.filter(Cause.isInterruptReason)),
							onSuccess: () => Cause.empty,
						}),
					);
					assert.isTrue(Cause.hasInterruptsOnly(program.cause), messageOf(program));
					const read = yield* Effect.exit(screen.plainFrame);
					assertExitSuccess(read, Exit.match(read, { onFailure: () => "", onSuccess: (value) => value }));
					assert.include(read.value, "steady");
				}).pipe(Effect.timeout("2 seconds")),
		);
	});

	it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.effect("control: the same crash with no interrupt is a defect on the screen", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				const Swap = (props: { readonly control: { readonly resolve: (value: number) => void } }): ReactElement => {
					useKeys(KeyTable.make([{ keys: ["enter"], action: "go", help: "go" }]), () => props.control.resolve(1));
					return createElement(CrashOnUnmount);
				};
				const fiber = yield* Effect.forkScoped(
					CliUi.run<number>((control) => createElement(Swap, { control })),
				);
				const screen = yield* session.next({ contains: "steady" });
				yield* screen.press("enter");
				const program = yield* Fiber.await(fiber);
				assert.include(messageOf(program), "crashed on unmount");
				assert.include(messageOf(yield* Effect.exit(screen.plainFrame)), "crashed on unmount");
			}).pipe(Effect.timeout("2 seconds")),
		);
	});

	it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.effect("a finalizer that dies beside a crash recorded with a cancel: run carries both defects, not the cancel", () =>
			Effect.gen(function* () {
				const session = yield* TestSession;
				const program = CliUi.run(() => createElement(CancelThenCrash));
				const fiber = yield* Effect.forkScoped(
					Effect.gen(function* () {
						const harness = yield* UiRenderOptions;
						return yield* program.pipe(
							Effect.provideService(UiRenderOptions, {
								...harness,
								onUnmount: (crash) => {
									harness.onUnmount?.(crash);
									throw new Error("finalizer failed");
								},
							}),
						);
					}),
				);
				const screen = yield* session.next({ contains: "armed" });
				yield* screen.press("enter");
				const exit = yield* Fiber.await(fiber);
				const defects = Exit.isFailure(exit)
					? exit.cause.reasons.filter(Cause.isDieReason).map((reason) => String(reason.defect))
					: [];
				assert.isTrue(
					defects.some((defect) => defect.includes("crashed with the cancel")),
					`the recorded crash is kept: ${Result.getOrThrow(S.encodeUnknownResult(Json)(defects))}`,
				);
				assert.isTrue(
					defects.some((defect) => defect.includes("finalizer failed")),
					`the finalizer's defect is kept: ${Result.getOrThrow(S.encodeUnknownResult(Json)(defects))}`,
				);
				assertNone(CliUiTest.cancelReason(exit));
			}).pipe(Effect.timeout("2 seconds")),
		);
	});

	it.layer(sessionLayer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
		// Live clock: the deadline bounds Ink rendering and settling driven by real timers.
		it.effect("a run that already died keeps its whole cause: a failing finalizer's defect is not dropped", () =>
			Effect.gen(function* () {
				const fiber = yield* Effect.forkScoped(
					CliUi.run(() => createElement(Boom)).pipe(
						Effect.provideService(UiRenderOptions, {
								onUnmount: () => {
									throw new Error("finalizer failed");
								},
						}),
					),
				);
				const program = yield* Fiber.await(fiber);
				const defects = Exit.isFailure(program)
					? program.cause.reasons.filter(Cause.isDieReason).map((reason) => String(reason.defect))
					: [];
				assert.strictEqual(
					defects.filter((defect) => defect.includes("component crashed")).length,
					1,
					`the crash once, never doubled: ${Result.getOrThrow(S.encodeUnknownResult(Json)(defects))}`,
				);
				assert.isTrue(
					defects.some((defect) => defect.includes("finalizer failed")),
					Result.getOrThrow(S.encodeUnknownResult(Json)(defects)),
				);
			}).pipe(Effect.timeout("2 seconds")),
		);
	});
});

/** Draws, then crashes 30 ms later, on its own. */
const CrashSoon = (): ReactElement => {
	const [crash, setCrash] = useState(false);
	useEffect(() => {
		// React owns this timer: launch at the hook boundary and interrupt it when the component unmounts.
		const timer = Effect.runFork(Effect.andThen(Effect.sleep("30 millis"), Effect.sync(() => setCrash(true))));
		return () => timer.interruptUnsafe();
	}, []);
	if (crash) throw new Error("crashed while the rerender was built");
	return createElement(Text, null, "steady");
};

// Screen thunks return a Promise; this boundary keeps the 150 ms element-build delay on the live clock.
const delayedNext: Screen<never> = () =>
	Effect.runPromise(Effect.as(Effect.sleep("150 millis"), createElement(Text, null, "next")));

describe("a rerender racing a crash", () => {
	// Live clock: React crashes after 30 ms while the rerender waits 150 ms on real timers.
	it.live("a rerender whose element is built while the screen crashes dies with the crash, not 'screen ended'", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(CrashSoon));
			const exit = yield* Effect.exit(
				handle.rerender(delayedNext),
			);
			assert.isTrue(isDie(exit), messageOf(exit));
			assert.include(messageOf(exit), "crashed while the rerender was built");
		}).pipe(Effect.timeout("3 seconds")),
	);
});
