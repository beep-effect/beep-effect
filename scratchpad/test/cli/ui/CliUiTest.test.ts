import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import { Text, useInput } from "ink";
import type { ReactElement } from "react";
import { createElement, useEffect, useState } from "react";
import { Cancelled, Doc, NotInteractive, Render } from "../../../effected/cli/index.ts";
import type { Screen, ScreenControl } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import { contextOf } from "../helpers/renderContext.ts";

const ESC = String.fromCharCode(0x1b);
const sgr = (codes: string): string => `${ESC}[${codes}m`;

/** A screen that never ends on its own, drawing `element`. */
const showing =
	(element: () => ReactElement): Screen<never> =>
	() =>
		element();

/** A consumer component passing raw Ink colour props, no kit tokens. */
const RawRed = (): ReactElement => createElement(Text, { color: "red", bold: true }, "raw red");

/** Echoes every key it receives as text, so a frame shows what reached the screen. */
const Echo = (): ReactElement => {
	const [typed, setTyped] = useState("");
	useInput((input, key) => {
		if (key.upArrow) setTyped((text) => `${text}<up>`);
		else if (key.return) setTyped((text) => `${text}<enter>`);
		else setTyped((text) => text + input);
	});
	return createElement(Text, null, `typed:${typed}`);
};

describe("CliUiTest.styled", () => {
	it("decodes a marker colour to its token, nested bold to [b], and closes everything open at a reset", () => {
		assert.strictEqual(CliUiTest.styled(`${sgr("38;2;0;0;1")}ok${sgr("39")}`), "[success]ok[/success]");
		assert.strictEqual(
			CliUiTest.styled(`${sgr("1")}${sgr("38;2;0;0;7")}x${sgr("39")}${sgr("22")}`),
			"[b][accent]x[/accent][/b]",
		);
		assert.strictEqual(
			CliUiTest.styled(`${sgr("1")}${sgr("38;2;0;0;1")}x${sgr("0")}y`),
			"[b][success]x[/success][/b]y",
		);
		assert.strictEqual(CliUiTest.styled(`${sgr("2")}faint${sgr("22")}`), "[dim]faint[/dim]");
	});

	it("decodes a consumer's raw colours by name or hex, and strips non-style escapes", () => {
		assert.strictEqual(CliUiTest.styled(`${sgr("31")}r${sgr("39")}`), "[fg:red]r[/fg]");
		assert.strictEqual(CliUiTest.styled(`${sgr("38;2;255;0;0")}h${sgr("39")}`), "[fg:#ff0000]h[/fg]");
		assert.strictEqual(CliUiTest.styled(`${ESC}[?25l${ESC}[2Kplain`), "plain");
		assert.strictEqual(CliUiTest.styled("no escapes"), "no escapes");
	});
});

describe("CliUiTest.render", () => {
	it.effect("lays the frame out at the given width", () =>
		Effect.gen(function* () {
			const long = "x".repeat(100);
			const narrow = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(
						showing(() => createElement(Text, null, long)),
						{ columns: 30 },
					),
					(handle) => handle.frame,
				),
			);
			const wide = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(
						showing(() => createElement(Text, null, long)),
						{ columns: 120 },
					),
					(handle) => handle.frame,
				),
			);
			const narrowLines = narrow.split("\n").filter((line) => line.includes("x"));
			assert.isAbove(narrowLines.length, 1, "the text wrapped");
			for (const line of narrowLines) assert.isAtMost(line.length, 30, line);
			assert.include(wide, long, "control: at 120 columns the same text fits on one line");
		}),
	);

	it.effect("at colour none a raw red bold Text gives an escape-free raw frame; at truecolor it decodes", () =>
		Effect.gen(function* () {
			const none = yield* Effect.scoped(
				Effect.flatMap(CliUiTest.render(showing(RawRed), { color: "none" }), (handle) =>
					Effect.all([handle.rawFrame, handle.frame]),
				),
			);
			assert.include(none[0], "raw red", "the frame was drawn");
			assert.notInclude(none[0], ESC);
			assert.strictEqual(none[1].trim(), "raw red");
			const truecolor = yield* Effect.scoped(
				Effect.flatMap(CliUiTest.render(showing(RawRed), { color: "truecolor" }), (handle) =>
					Effect.all([handle.rawFrame, handle.frame]),
				),
			);
			assert.include(truecolor[0], ESC, "control: at truecolor the same frame carries escapes");
			assert.include(truecolor[1], "[fg:red]");
			assert.include(truecolor[1], "[b]");
		}),
	);

	it.effect("Esc ends the screen with Cancelled escape, and Ctrl-C with interrupt", () =>
		Effect.gen(function* () {
			const escaped = yield* Effect.scoped(
				Effect.gen(function* () {
					const handle = yield* CliUiTest.render(showing(() => createElement(Echo)));
					yield* handle.press("escape");
					return yield* Effect.flip(handle.result);
				}),
			);
			assert.instanceOf(escaped, Cancelled);
			assert.strictEqual(escaped instanceof Cancelled ? escaped.reason : undefined, "escape");
			const interrupted = yield* Effect.scoped(
				Effect.gen(function* () {
					const handle = yield* CliUiTest.render(showing(() => createElement(Echo)));
					yield* handle.press("ctrl+c");
					return yield* Effect.flip(handle.result);
				}),
			);
			assert.strictEqual(interrupted instanceof Cancelled ? interrupted.reason : undefined, "interrupt");
		}),
	);

	it.effect("press and type reach the screen, and frames keeps every frame in order", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(showing(() => createElement(Echo)));
			yield* handle.type("hi");
			yield* handle.press("up", "enter");
			assert.strictEqual((yield* handle.frame).trim(), "typed:hi<up><enter>");
			const frames = yield* handle.frames;
			assert.isAtLeast(frames.length, 5, "a first frame, then one per key");
			assert.strictEqual(frames[0]?.trim(), "typed:");
			assert.strictEqual(frames.at(-1), yield* handle.frame);
		}).pipe(Effect.scoped),
	);

	it.effect("resolves through result", () =>
		Effect.gen(function* () {
			const Done = (props: { readonly done: (value: string) => void }): ReactElement => {
				useEffect(() => props.done("finished"), [props.done]);
				return createElement(Text, null, "done");
			};
			const handle = yield* CliUiTest.render<string>((control) => createElement(Done, { done: control.resolve }));
			assert.strictEqual(yield* handle.result, "finished");
		}).pipe(Effect.scoped),
	);

	it.effect("not interactive: result fails with NotInteractive and nothing is drawn", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				showing(() => createElement(Echo)),
				{ interactive: false },
			);
			assert.instanceOf(yield* Effect.flip(handle.result), NotInteractive);
			assert.deepStrictEqual(yield* handle.frames, []);
		}).pipe(Effect.scoped),
	);

	it.effect("plainFrame is the latest frame with neither escapes nor markup", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(showing(RawRed), { color: "truecolor" });
			assert.include(yield* handle.rawFrame, ESC, "the raw frame is coloured");
			assert.include(yield* handle.frame, "[fg:red]", "the styled frame carries markup");
			assert.strictEqual((yield* handle.plainFrame).trim(), "raw red");
		}).pipe(Effect.scoped),
	);

	it.effect("a key whose reaction renders twice, across a timer, settles on the second render", () =>
		Effect.gen(function* () {
			const Twice = (): ReactElement => {
				const [phase, setPhase] = useState("idle");
				useInput((input) => {
					if (input !== "x") return;
					setPhase("first");
					setTimeout(() => setPhase("second"), 3);
				});
				return createElement(Text, null, `phase:${phase}`);
			};
			const handle = yield* CliUiTest.render(showing(() => createElement(Twice)));
			yield* handle.type("x");
			assert.strictEqual((yield* handle.frame).trim(), "phase:second");
		}).pipe(Effect.scoped),
	);

	it.effect("a reaction timer that comes due while the event loop is blocked still settles on its render", () =>
		Effect.gen(function* () {
			// Load, made deterministic: the handler schedules its second render on a 3 ms timer, then blocks the loop for
			// 30 ms. When the loop wakes, the harness's quiet poll and that timer are both overdue; the poll must not
			// declare the screen settled before the timer, which was due first, has run.
			const Blocked = (): ReactElement => {
				const [phase, setPhase] = useState("idle");
				useInput((input) => {
					if (input !== "x") return;
					setPhase("first");
					// A loaded machine: the loop is blocked for 30 ms just after the harness starts polling, so its next
					// quiet poll and this reaction's timer are both overdue when it wakes, the poll due first.
					setTimeout(() => {
						const until = Date.now() + 30;
						while (Date.now() < until) {
							// busy
						}
					}, 1);
					setTimeout(() => setPhase("second"), 6);
				});
				return createElement(Text, null, `phase:${phase}`);
			};
			const handle = yield* CliUiTest.render(showing(() => createElement(Blocked)));
			yield* handle.type("x");
			assert.strictEqual((yield* handle.frame).trim(), "phase:second");
		}).pipe(Effect.scoped),
	);

	it.live("a screen that never stops drawing still lets a key press return: the wait is bounded", () =>
		Effect.gen(function* () {
			const Restless = (): ReactElement => {
				const [count, setCount] = useState(0);
				// A redraw on every turn of the loop: a write always lands between the harness's quiet and its confirmation.
				useEffect(() => {
					let next: ReturnType<typeof setImmediate> | undefined;
					const redraw = (): void => {
						setCount((value) => value + 1);
						next = setImmediate(redraw);
					};
					next = setImmediate(redraw);
					return () => {
						if (next !== undefined) clearImmediate(next);
					};
				}, []);
				return createElement(Text, null, `count:${count}`);
			};
			const handle = yield* CliUiTest.render(showing(() => createElement(Restless)));
			const started = Date.now();
			yield* handle.type("x").pipe(Effect.timeout("2 seconds"));
			assert.isBelow(
				Date.now() - started,
				500,
				"a key press waits at most about its limit, not until the screen rests",
			);
		}).pipe(Effect.scoped),
	);

	it.effect("rerender swaps the screen's element in place: the new frame shows, under the same control", () =>
		Effect.gen(function* () {
			const controls: Array<ScreenControl<string>> = [];
			const first: Screen<string> = (control) => {
				controls.push(control);
				return createElement(Text, null, "state one");
			};
			const second: Screen<string> = (control) => {
				controls.push(control);
				const Done = (props: { readonly done: (value: string) => void }): ReactElement => {
					useEffect(() => {
						const timer = setTimeout(() => props.done("from the second"), 20);
						return () => clearTimeout(timer);
					}, [props.done]);
					return createElement(Text, null, "state two");
				};
				return createElement(Done, { done: control.resolve });
			};
			const handle = yield* CliUiTest.render(first);
			assert.strictEqual((yield* handle.frame).trim(), "state one");
			yield* handle.rerender(second);
			assert.strictEqual((yield* handle.frame).trim(), "state two");
			assert.lengthOf(controls, 2);
			assert.strictEqual(controls[1], controls[0], "the new element gets the original ScreenControl");
			assert.strictEqual(yield* handle.result, "from the second");
		}).pipe(Effect.scoped),
	);

	it.effect("rerender after the screen has ended is a defect", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(showing(() => createElement(Echo)));
			yield* handle.press("escape");
			yield* Effect.flip(handle.result);
			const exit = yield* Effect.exit(handle.rerender(showing(() => createElement(Text, null, "late"))));
			if (Exit.isFailure(exit)) {
				assert.isTrue(Cause.hasDies(exit.cause));
				const defect = Cause.squash(exit.cause);
				assert.include(defect instanceof Error ? defect.message : "", "after the screen ended");
			} else {
				assert.fail("expected a defect, but the rerender succeeded");
			}
		}).pipe(Effect.scoped),
	);

	it.effect(
		"rerender on a handle still queued behind another screen dies at the mount cap instead of hanging",
		() =>
			Effect.gen(function* () {
				yield* CliUiTest.render(showing(() => createElement(Text, null, "first")));
				const queued = yield* CliUiTest.render(showing(() => createElement(Text, null, "second")));
				assert.deepStrictEqual(yield* queued.frames, [], "the second screen is waiting for the first");
				const exit = yield* Effect.exit(queued.rerender(showing(() => createElement(Text, null, "swapped"))));
				if (Exit.isFailure(exit)) {
					const defect = Cause.squash(exit.cause);
					assert.include(defect instanceof Error ? defect.message : "", "before the screen mounted");
				} else {
					assert.fail("expected a defect, but the rerender succeeded");
				}
			}).pipe(Effect.scoped),
		15_000,
	);

	it.effect("closing the scope unmounts the screen", () =>
		Effect.gen(function* () {
			let unmounted = false;
			const Tracked = (): ReactElement => {
				useEffect(
					() => () => {
						unmounted = true;
					},
					[],
				);
				return createElement(Text, null, "tracked");
			};
			yield* Effect.scoped(Effect.asVoid(CliUiTest.render(showing(() => createElement(Tracked)))));
			assert.isTrue(unmounted);
		}),
	);
});

describe("CliUiTest.serializer", () => {
	it.effect("recognises a styled frame and a Render.ansi string, and serializes ANSI to token markup", () =>
		Effect.gen(function* () {
			const ansi = Render.ansi([Doc.heading(1, "Title")], yield* contextOf());
			assert.include(ansi, ESC, "the IR output carries escapes at truecolor");
			assert.isTrue(CliUiTest.serializer.test(ansi));
			assert.isTrue(CliUiTest.serializer.test("[success]ok[/success]"));
			assert.isFalse(CliUiTest.serializer.test("plain text"), "a plain string is left to the default serializer");
			assert.isTrue(CliUiTest.serializer.test("[fg:red]x[/fg]"));
			assert.isFalse(CliUiTest.serializer.test("[info] starting"), "a log-style level prefix is not markup");
			assert.isFalse(CliUiTest.serializer.test("[error] failed\n[info] retrying"), "nor are several of them");
			assert.isFalse(
				CliUiTest.serializer.test("some [b]bold[/b], [i]italic[/i] and [u]underlined[/u] BBCode"),
				"style-only brackets in unrelated data are not claimed",
			);
			assert.isFalse(CliUiTest.serializer.test(42));
			assert.strictEqual(CliUiTest.serializer.serialize(ansi), CliUiTest.styled(ansi));
			assert.notInclude(CliUiTest.serializer.serialize(ansi), ESC);
		}),
	);
});
