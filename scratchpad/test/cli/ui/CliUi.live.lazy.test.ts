// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file newPromise:skip-file
import * as Context from "effect/Context";
// CliUi.live hands its handle back without loading Ink: a run's first mount loads it, so a
// host holds the handle, and can close it, before Ink has resolved. No static ink or react import here: the mock
// below gates Ink's load, and a static import would open it.
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as PubSub from "effect/PubSub";
import * as Scope from "effect/Scope";
import * as S from "effect/Schema";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { CliInteractive, CliTheme } from "../../../effected/cli/index.ts";
import { inkModules } from "../../../effected/cli/ui/internal/ink.ts";
import { LazyViewShapeError, loadView } from "../../../effected/cli/ui/internal/lazyView.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { screenAfter } from "../../../effected/cli/ui/testing/terminalModel.ts";
import type { LiveOptions } from "../../../effected/cli/ui.ts";
import { CliUi, UiStreams } from "../../../effected/cli/ui.ts";
import { deliberatelyInvalid } from "../deliberatelyInvalid.ts";

// Ink's import is held open until a test opens the gate; each factory records that its package began to load.
const { gate, loads } = vi.hoisted(() => {
	let open: () => void = () => undefined;
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { gate: { open: () => open(), opened }, loads: Array<string>() };
});

describe("lazy-view schema errors", () => {
	it.effect("caches a shape error by identity and gives equal-looking errors distinct primitive ids", () =>
		Effect.gen(function* () {
			let loads = 0;
			const load = () => {
				loads++;
				return Promise.resolve(deliberatelyInvalid<{ readonly default: (state: number, frame: number) => ReactElement }>({ default: 42 }));
			};
			const view = CliUi.lazyView(load);
			const first = yield* Effect.flip(loadView(view));
			const cached = yield* Effect.flip(loadView(view));
			const distinct = yield* Effect.flip(loadView(CliUi.lazyView(load)));
			assert.strictEqual(loads, 2, "each handle loads once; a deterministic shape failure is not retried");
			assert.strictEqual(cached.cause, first.cause, "later runs retain the same shape error object");
			assert.isTrue(S.is(LazyViewShapeError)(first.cause));
			assert.isTrue(S.is(LazyViewShapeError)(distinct.cause));
			if (S.is(LazyViewShapeError)(first.cause) && S.is(LazyViewShapeError)(distinct.cause)) {
				assert.strictEqual(first.cause.name, "Error");
				assert.strictEqual(distinct.cause.message, first.cause.message, "control: the errors have equal messages");
				assert.notStrictEqual(distinct.cause.id, first.cause.id, "distinct errors must not share warning identity");
			}
		}),
	);

	it.effect("retains an import rejection's cause and retries it on the next load", () =>
		Effect.gen(function* () {
			const failure = new Error("temporary lazy-view import failure");
			let attempts = 0;
			const view = CliUi.lazyView<number>(() => {
				attempts++;
				return attempts === 1
					? Promise.reject(failure)
					: Promise.resolve(() => inkModules().react.createElement(inkModules().ink.Text, null, "loaded"));
			});
			const rejected = yield* Effect.flip(loadView(view));
			assert.strictEqual(rejected._tag, "LazyViewLoadError");
			assert.strictEqual(rejected.name, "LazyViewLoadError");
			assert.strictEqual(rejected.cause, failure);
			yield* loadView(view);
			yield* loadView(view);
			assert.strictEqual(attempts, 2, "a transient rejection retries, then the successful view stays loaded");
		}),
	);
});
vi.mock("ink", async (importOriginal) => {
	loads.push("ink");
	await gate.opened;
	return await importOriginal();
});
vi.mock("react", async (importOriginal) => {
	loads.push("react");
	return await importOriginal();
});

type Ev = { readonly _tag: "Start" } | { readonly _tag: "Tick"; readonly n: number } | { readonly _tag: "End" };
interface State {
	readonly run: number;
	readonly last: string;
}

const optionsOf = (events: PubSub.Subscription<Ev>): LiveOptions<Ev, State> => ({
	events,
	initial: { run: 0, last: "idle" },
	reduce: (state, event) =>
		event._tag === "Start"
			? { run: state.run + 1, last: "started" }
			: { ...state, last: event._tag === "Tick" ? `tick ${event.n}` : "ended" },
	// Read at render time, once the view has loaded Ink.
	render: (state): ReactElement => {
		const { ink, react } = inkModules();
		return react.createElement(
			ink.Box,
			{ flexDirection: "column" },
			react.createElement(ink.Text, null, `RUN ${state.run}`),
			react.createElement(ink.Text, null, state.last),
		);
	},
	isStart: (event) => event._tag === "Start",
	isTerminal: (event) => event._tag === "End",
});

const liveOn = (fake: ReturnType<typeof makeFakeStreams>, options: LiveOptions<Ev, State>) =>
	CliUi.live(options).pipe(
		Effect.provideService(UiStreams, fake.streams),
		Effect.provideService(CliInteractive, true),
		Effect.provide(CliTheme.layerTest({ color: "none" })),
	);

describe("CliUi.live before Ink has loaded", () => {
	// In file order: the first test needs Ink unloaded, the second opens the gate.
	it.live("returns its handle without loading Ink, and a close with no run ends without loading it", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			// Ink's load is gated shut: a `live` that waited for it would never return.
			const handle = yield* liveOn(fake, optionsOf(subscription)).pipe(Effect.timeout("1 second"));
			assert.deepStrictEqual(loads, [], "the handle came back with neither peer loading");
			yield* handle.close.pipe(Effect.timeout("1 second"));
			yield* handle.done.pipe(Effect.timeout("1 second"));
			assert.deepStrictEqual(loads, [], "a view that never ran a run never loads Ink");
			assert.strictEqual(fake.stdout(), "", "and writes nothing");
		}).pipe(Effect.scoped),
	);

	it.live("crosses no async boundary before returning: Effect.runSync hands the handle back", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const scope = yield* Scope.make();
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub).pipe(Scope.provide(scope));
			// A host outside Effect (a reporter's plugin hook) can hold the handle synchronously.
			const handle = Effect.runSyncWith(Context.empty())(liveOn(fake, optionsOf(subscription)).pipe(Scope.provide(scope)));
			assert.deepStrictEqual(loads, [], "still nothing loading");
			yield* handle.close.pipe(Effect.ensuring(Scope.close(scope, Exit.void)), Effect.timeout("1 second"));
			assert.deepStrictEqual(loads, []);
		}),
	);

	it.live("a close made while the first run's mount waits on Ink drains the run once Ink loads", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const head: ReadonlyArray<Ev> = [{ _tag: "Start" }, { _tag: "Tick", n: 1 }, { _tag: "Tick", n: 2 }];
			yield* PubSub.publishAll(pubsub, head);
			const handle = yield* liveOn(fake, optionsOf(subscription)).pipe(Effect.timeout("1 second"));
			const closing: Fiber.Fiber<void> = yield* Effect.forkChild(handle.close, { startImmediately: true });
			// The run has begun mounting, and its mount is held on Ink's load.
			yield* Effect.suspend(() => (loads.includes("ink") ? Effect.void : Effect.fail("not yet"))).pipe(
				Effect.eventually,
				Effect.timeout("2 seconds"),
			);
			yield* Effect.sleep("50 millis");
			assert.isUndefined(closing.pollUnsafe(), "close waits for the run it drains");
			yield* PubSub.publish(pubsub, { _tag: "Tick", n: 3 });
			gate.open();
			yield* Fiber.join(closing).pipe(Effect.timeout("2 seconds"));
			yield* handle.done.pipe(Effect.timeout("1 second"));
			assert.deepStrictEqual(yield* handle.state, { run: 1, last: "tick 3" });
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 3"]);
		}).pipe(Effect.scoped),
	);
});
