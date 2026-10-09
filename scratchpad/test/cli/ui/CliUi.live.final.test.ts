import { assert, describe, it } from "@effect/vitest";
import { Audience } from "../../../effected/env/index.ts";
import { Console, Effect } from "effect";
import type { Document } from "../../../effected/cli/index.ts";
import { Doc } from "../../../effected/cli/index.ts";
import { CliUi } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import type { Ev, State } from "../helpers/live.ts";
import { End, Start, frameOf, reduce, tick } from "../helpers/live.ts";

const ESC = String.fromCharCode(0x1b);

const base = {
	initial: { run: 0, last: "idle", seen: [] } as State,
	reduce,
	render: frameOf,
	isStart: (event: Ev) => event._tag === "Start",
	isTerminal: (event: Ev) => event._tag === "End",
};

const final = (state: State): Document => [
	Doc.paragraph(Doc.text(`final of run ${state.run}: ${state.last}`, "success")),
];

const twoRuns = [Start, tick(1), End, Start, tick(2), End];

/** A Console that keeps every line, where the default logger writes a warning. */
const capturing = () => {
	const lines: Array<string> = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => lines.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => lines.push(args.map(String).join(" ")),
		warn: (...args: ReadonlyArray<unknown>) => lines.push(args.map(String).join(" ")),
	});
	return { double, lines };
};

describe("CliUi.live final, when not interactive", () => {
	it.effect("prints each run's final document once, in place of the Ink frame, never both", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...base, final, interactive: false, color: "none" });
			for (const event of twoRuns) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(yield* view.transcript, "final of run 1: ended\nfinal of run 2: ended");
			assert.notInclude(yield* view.written, "RUN 1", "no Ink frame was printed beside it");
		}).pipe(Effect.scoped),
	);

	it.effect("control: without final each run's Ink frame is printed as a string", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...base, interactive: false, color: "none" });
			for (const event of twoRuns) yield* view.publish(event);
			yield* view.end;
			assert.include(yield* view.transcript, "RUN 1");
			assert.notInclude(yield* view.transcript, "final of run");
		}).pipe(Effect.scoped),
	);

	it.effect("a run the events end mid-way prints its final document at the end", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...base, final, interactive: false, color: "none" });
			yield* view.publish(Start);
			yield* view.publish(tick(7));
			yield* view.end;
			assert.strictEqual(yield* view.transcript, "final of run 1: tick 7");
		}).pipe(Effect.scoped),
	);

	it.effect("hosted prints nothing, final or not", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...base, final, mode: "hosted", interactive: false });
			for (const event of twoRuns) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(yield* view.written, "");
		}).pipe(Effect.scoped),
	);

	it.effect("an agent gets the plain renderer and no escape; a person, without an audience, is painted", () =>
		Effect.gen(function* () {
			const agent = yield* CliUiTest.live({ ...base, final, interactive: false, color: "truecolor" }).pipe(
				Effect.provide(Audience.layerTest("agent")),
			);
			for (const event of [Start, End]) yield* agent.publish(event);
			yield* agent.end;
			assert.strictEqual(yield* agent.written, "final of run 1: ended\n");
			const person = yield* CliUiTest.live({ ...base, final, interactive: false, color: "truecolor" });
			for (const event of [Start, End]) yield* person.publish(event);
			yield* person.end;
			assert.include(yield* person.written, ESC, "control: the same document is painted for a person");
		}).pipe(Effect.scoped),
	);

	it.effect("a final that throws degrades that run: one warning, nothing printed, the next run prints", () =>
		Effect.gen(function* () {
			const { double, lines } = capturing();
			let calls = 0;
			const flaky = (state: State): Document => {
				calls++;
				if (calls === 1) throw new Error("no document");
				return final(state);
			};
			const view = yield* CliUiTest.live({ ...base, final: flaky, interactive: false, color: "none" }).pipe(
				Effect.provideService(Console.Console, double),
			);
			for (const event of twoRuns) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(yield* view.transcript, "final of run 2: ended");
			assert.lengthOf(
				lines.filter((line) => line.includes("no document")),
				1,
			);
		}).pipe(Effect.scoped),
	);

	it.effect("watch mode: one handle, N runs, post-run events, gives exactly N finals, each printed once", () =>
		Effect.gen(function* () {
			let calls = 0;
			let renders = 0;
			const view = yield* CliUiTest.live({
				...base,
				// vitest-agent's shape: join a run already under way, but never begin one from a post-run event.
				begins: (event, before, after) => event._tag === "Start" || (before.last === "idle" && after.last !== "idle"),
				render: (state) => {
					renders++;
					return frameOf(state);
				},
				final: (state) => {
					calls++;
					return final(state);
				},
				interactive: false,
				color: "none",
			});
			// Three runs; after each terminal event, events that begin nothing (coverage, a watcher ready), and once a
			// terminal event with no run going at all.
			const watch: ReadonlyArray<Ev> = [
				Start,
				tick(1),
				End,
				tick(90),
				End,
				Start,
				tick(2),
				End,
				tick(91),
				Start,
				tick(3),
				End,
				tick(92),
			];
			for (const event of watch) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(calls, 3, "one final per run, none for a post-run event or a terminal with no run");
			assert.deepStrictEqual((yield* view.transcript).split("\n"), [
				"final of run 1: ended",
				"final of run 2: ended",
				"final of run 3: ended",
			]);
			assert.strictEqual(renders, 0, "the Ink render never ran: final replaced the string, it did not add to it");
			assert.notInclude(yield* view.written, "RUN ");
		}).pipe(Effect.scoped),
	);

	it.effect("render passed directly, with no thunk: final still replaces the string", () =>
		Effect.gen(function* () {
			let renders = 0;
			const view = yield* CliUiTest.live({
				...base,
				render: (state) => {
					renders++;
					return frameOf(state);
				},
				final,
				interactive: false,
				color: "none",
			});
			for (const event of [Start, End]) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(renders, 0);
			assert.strictEqual(yield* view.transcript, "final of run 1: ended");
		}).pipe(Effect.scoped),
	);

	it.effect("an interactive run never calls final", () =>
		Effect.gen(function* () {
			let calls = 0;
			const view = yield* CliUiTest.live({
				...base,
				final: (state) => {
					calls++;
					return final(state);
				},
				color: "none",
			});
			for (const event of [Start, tick(1), End]) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(calls, 0);
			assert.include(yield* view.transcript, "RUN 1");
		}).pipe(Effect.scoped),
	);
});

describe("CliUi.lazyView", () => {
	it.effect("draws with the module's default export once loaded, with the frame index", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({
				initial: { done: 0 },
				reduce: (state: { readonly done: number }, event: Ev) =>
					event._tag === "Tick" ? { done: state.done + 1 } : state,
				render: CliUi.lazyView(() => import("../fixtures/live-view.ts")),
				isStart: (event) => event._tag === "Start",
				isTerminal: (event) => event._tag === "End",
				color: "none",
			});
			yield* view.publish(Start);
			yield* view.advance("160 millis");
			yield* view.publish(tick(1));
			assert.match(yield* view.plainFrame, /^INK done 1 frame \d+$/);
			yield* view.publish(End);
			yield* view.end;
		}).pipe(Effect.scoped),
	);

	it.effect("takes a promise of the view itself, as a named export, and passes it the frame index", () =>
		Effect.gen(function* () {
			const seen: Array<readonly [number, number]> = [];
			const render = CliUi.lazyView<State>(async () => (state: State, frame: number) => {
				seen.push([state.run, frame]);
				return frameOf(state);
			});
			const view = yield* CliUiTest.live({ ...base, render, color: "none" });
			yield* view.publish(Start);
			yield* view.advance("240 millis");
			assert.include(yield* view.plainFrame, "RUN 1");
			assert.isTrue(
				seen.some(([run, frame]) => run === 1 && frame === 3),
				`the tick's frame index reached the view: ${JSON.stringify(seen)}`,
			);
			yield* view.publish(End);
			yield* view.end;
		}).pipe(Effect.scoped),
	);

	it.effect("an import that fails degrades the run with one warning, and the next run tries again", () =>
		Effect.gen(function* () {
			const { double, lines } = capturing();
			let attempts = 0;
			const render = CliUi.lazyView<State>(async () => {
				attempts++;
				if (attempts === 1) throw new Error("module not found");
				return { default: frameOf };
			});
			const view = yield* CliUiTest.live({ ...base, render, color: "none" }).pipe(
				Effect.provideService(Console.Console, double),
			);
			for (const event of twoRuns) yield* view.publish(event);
			yield* view.end;
			assert.strictEqual(attempts, 2);
			assert.lengthOf(
				lines.filter((line) => line.includes("module not found")),
				1,
			);
			assert.include(yield* view.transcript, "RUN 2", "the second run loaded the module and drew");
		}).pipe(Effect.scoped),
	);

	/** Two runs of a lazy view whose loader answers `answers[attempt]`; what it drew, warned and how often it loaded. */
	const twoRunsOf = (answers: ReadonlyArray<() => unknown>) =>
		Effect.gen(function* () {
			const { double, lines } = capturing();
			let attempts = 0;
			const render = CliUi.lazyView<State>(async () => {
				const answer = answers[Math.min(attempts, answers.length - 1)] ?? (() => undefined);
				attempts++;
				return answer() as typeof frameOf;
			});
			const view = yield* CliUiTest.live({ ...base, render, color: "none" }).pipe(
				Effect.provideService(Console.Console, double),
			);
			for (const event of twoRuns) yield* view.publish(event);
			yield* view.end;
			const warnings = lines.filter((line) => line.includes("CliUi.lazyView"));
			return { attempts, warnings, lines, transcript: yield* view.transcript };
		});

	const assertShapeError = (
		result: { readonly attempts: number; readonly warnings: ReadonlyArray<string>; readonly transcript: string },
		received: string,
	) => {
		// Deterministic, so latched for the handle: loaded once, warned once, however many runs follow.
		assert.strictEqual(result.attempts, 1, "a shape error is kept: never loaded again");
		assert.lengthOf(result.warnings, 1, `one warning for the handle, not one per run: ${result.warnings.join(" | ")}`);
		for (const warning of result.warnings) {
			assert.include(warning, received);
			assert.include(
				warning,
				"Expected a view, (state, frame) => ReactElement, or a module whose default export is one",
			);
			assert.notInclude(warning, "before its module loaded", "never the misleading not-loaded message");
			assert.notInclude(warning, "is not a function", "never a raw TypeError from calling a non-view");
		}
		assert.notInclude(result.transcript, "RUN");
	};

	it.effect("a CommonJS double default, { default: { default: view } }, is a clear shape error", () =>
		Effect.gen(function* () {
			const result = yield* twoRunsOf([() => ({ default: { default: frameOf } })]);
			assertShapeError(result, "a module whose default export is an object, not a function");
			assert.include(result.warnings[0], "default.default");
		}).pipe(Effect.scoped),
	);

	it.effect("a module with a named export and no default names its exports", () =>
		Effect.gen(function* () {
			const result = yield* twoRunsOf([() => ({ syncView: frameOf })]);
			assertShapeError(result, "a module with no default export (it exports syncView)");
		}).pipe(Effect.scoped),
	);

	it.effect("a load that resolves to undefined (a typo'd named export) says so", () =>
		Effect.gen(function* () {
			const result = yield* twoRunsOf([() => undefined]);
			assertShapeError(result, "resolved to undefined");
		}).pipe(Effect.scoped),
	);

	it.effect("a view function that carries a default property is the view: the function wins", () =>
		Effect.gen(function* () {
			const viewWithDefault = Object.assign((state: State) => frameOf(state), { default: "not a view" });
			const result = yield* twoRunsOf([() => viewWithDefault]);
			assert.deepStrictEqual(result.warnings, []);
			assert.include(result.transcript, "RUN 2");
			assert.strictEqual(result.attempts, 1, "loaded once, then shared");
		}).pipe(Effect.scoped),
	);

	it.effect(
		"a shape error is latched for the handle: a loader that would answer differently later is not asked again",
		() =>
			Effect.gen(function* () {
				const result = yield* twoRunsOf([() => undefined, () => ({ default: frameOf })]);
				assert.strictEqual(result.attempts, 1, "deterministic: kept, not retried");
				assert.lengthOf(result.warnings, 1);
				assert.notInclude(result.transcript, "RUN 2", "contrast with the transient case below, which draws run 2");
			}).pipe(Effect.scoped),
	);

	it.effect("a transient import failure on run 1, then success, draws run 2", () =>
		Effect.gen(function* () {
			const result = yield* twoRunsOf([
				() => Promise.reject(new Error("ECONNRESET loading the chunk")),
				() => ({ default: frameOf }),
			]);
			assert.strictEqual(result.attempts, 2);
			assert.deepStrictEqual(result.transcript.split("\n"), ["RUN 1", "ended", "RUN 2", "ended"]);
		}).pipe(Effect.scoped),
	);

	it.effect("an import that keeps failing is never latched: each run loads again and warns again", () =>
		Effect.gen(function* () {
			const result = yield* twoRunsOf([() => Promise.reject(new Error("ECONNRESET loading the chunk"))]);
			// Each run's mount tries, and its end tries again to print the frame: two loads a run, one warning a run.
			assert.strictEqual(result.attempts, 4);
			assert.lengthOf(
				result.lines.filter((line) => line.includes("ECONNRESET")),
				2,
				"one warning a run: a transient failure is never latched",
			);
		}).pipe(Effect.scoped),
	);

	it.effect("a load that resolves to a number says what it got", () =>
		Effect.gen(function* () {
			const result = yield* twoRunsOf([() => 42]);
			assertShapeError(result, "resolved to number");
		}).pipe(Effect.scoped),
	);

	it("called before its module has loaded, the render throws, naming CliUi.live", () => {
		const render = CliUi.lazyView<State>(async () => ({ default: frameOf }));
		assert.throws(() => render({ run: 0, last: "", seen: [] }, 0), /CliUi.live/);
	});
});
