import { Context } from "effect";
// LiveHandle.close and a PubSub subscription as `events`: the kit ends a view cleanly, folding the tail of a run that
// was published but not yet pulled.
import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Fiber, PubSub, Scheduler, Scope, Stream } from "effect";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { screenAfter } from "../../../effected/cli/ui/testing/terminalModel.ts";
import type { LiveHandle } from "../../../effected/cli/ui.ts";
import type { Ev, State } from "../helpers/live.ts";
import { End, Start, liveOn, mountsAndResolves, optionsOf, reduce, tick, until } from "../helpers/live.ts";

const runOf = (n: number): ReadonlyArray<Ev> => [Start, ...Array.from({ length: n }, (_, i) => tick(i + 1))];
const seenOf = (n: number): ReadonlyArray<string> => ["Start", ...Array.from({ length: n }, (_, i) => `tick ${i + 1}`)];
const count = (text: string, part: string): number => text.split(part).length - 1;

describe("PubSub.shutdown drops what a subscriber has not pulled (why close drains a subscription itself)", () => {
	it.effect("published, then shut down: Stream.fromSubscription collects nothing, and remaining interrupts", () =>
		Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<number>();
			const subscription = yield* PubSub.subscribe(pubsub);
			yield* PubSub.publishAll(pubsub, [1, 2, 3, 4, 5, 6, 7]);
			assert.strictEqual(yield* PubSub.remaining(subscription), 7, "control: all seven are queued before the shutdown");
			yield* PubSub.shutdown(pubsub);
			const collected = yield* Stream.runCollect(Stream.fromSubscription(subscription));
			assert.deepStrictEqual(collected, []);
			const remaining = yield* Effect.exit(PubSub.remaining(subscription));
			assert.isTrue(Exit.hasInterrupts(remaining), "remaining interrupts once the PubSub is shut down");
		}).pipe(Effect.scoped),
	);
});

describe("LiveHandle.close with a subscription", () => {
	it.live("published, then closed at once: every event is folded and the final frame shows the last", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription));
			yield* PubSub.publishAll(pubsub, runOf(7));
			yield* handle.close.pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual((yield* handle.state).seen, seenOf(7));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 7"]);
		}).pipe(Effect.scoped),
	);

	it.live("messages still queued in the subscription when close is called are folded, not dropped", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			let handle: LiveHandle<State> | undefined;
			let closing: Fiber.Fiber<void> | undefined;
			// The start is folded while the view is still taking it: what the reducer publishes then waits in the
			// subscription, and the close lands before the view takes it. Only the close's own drain can fold it.
			const options = optionsOf(subscription, {
				reduce: (state, event) => {
					if (event._tag === "Start" && handle !== undefined) {
						for (const next of runOf(7).slice(1)) PubSub.publishUnsafe(pubsub, next);
						closing = Effect.runForkWith(Context.empty())(handle.close);
					}
					return reduce(state, event);
				},
			});
			handle = yield* liveOn(fake, options);
			yield* PubSub.publish(pubsub, Start);
			yield* until(() => closing !== undefined);
			yield* Fiber.join(closing as unknown as Fiber.Fiber<void>).pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual((yield* handle.state).seen, seenOf(7));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 7"]);
		}).pipe(Effect.scoped),
	);

	it.live("a run with no terminal event is committed as drawn, done completes, and the mount permit is released", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription));
			yield* PubSub.publishAll(pubsub, runOf(2));
			yield* handle.close.pipe(Effect.timeout("2 seconds"));
			yield* handle.done.pipe(Effect.timeout("1 second"));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 2"]);
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "the permit was released");
		}).pipe(Effect.scoped),
	);

	it.live("a run that ended before the close keeps its one committed frame", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription));
			yield* PubSub.publishAll(pubsub, [...runOf(3), End]);
			yield* handle.close.pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "ended"]);
		}).pipe(Effect.scoped),
	);

	it.live("close twice: the second returns at once and writes nothing", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription));
			yield* PubSub.publishAll(pubsub, runOf(3));
			yield* Effect.all([handle.close, handle.close], { concurrency: "unbounded", discard: true }).pipe(
				Effect.timeout("2 seconds"),
			);
			const after = fake.stdout();
			yield* handle.close.pipe(Effect.timeout("1 second"));
			assert.strictEqual(fake.stdout(), after, "a later close writes nothing");
			assert.deepStrictEqual(screenAfter(after), ["RUN 1", "tick 3"]);
		}).pipe(Effect.scoped),
	);

	it.live("a subscription whose PubSub was shut down ends the view; a close after that is safe", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription), { interactive: false });
			yield* PubSub.shutdown(pubsub);
			yield* handle.done.pipe(Effect.timeout("1 second"));
			const exit = yield* Effect.exit(handle.close.pipe(Effect.timeout("1 second")));
			assert.isTrue(Exit.isSuccess(exit), "close is not interrupted by the shut-down subscription");
		}).pipe(Effect.scoped),
	);

	it.live("owned and not interactive: the run's tail is printed once", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription), { interactive: false });
			yield* PubSub.publishAll(pubsub, runOf(5));
			yield* handle.close.pipe(Effect.timeout("2 seconds"));
			yield* handle.close;
			const written = fake.stdout();
			assert.strictEqual(count(written, "RUN 1"), 1, written);
			assert.strictEqual(count(written, "tick 5"), 1, written);
		}).pipe(Effect.scoped),
	);
});

describe("LiveHandle.close with a plain stream", () => {
	it.live("what the view pulled is folded and committed; the stream, never ending, is stopped", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			// `live` pulls the first chunk before it returns: by the close, the run is in the view, not in the source.
			const events = Stream.concat(Stream.fromIterable(runOf(4)), Stream.never);
			const handle = yield* liveOn(fake, optionsOf(events));
			yield* handle.close.pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual((yield* handle.state).seen, seenOf(4));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 4"]);
		}).pipe(Effect.scoped),
	);

	it.live("close after the stream ended: done is already complete, and nothing more is written", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([...runOf(2), End])));
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			const before = fake.stdout();
			yield* handle.close.pipe(Effect.timeout("1 second"));
			assert.strictEqual(fake.stdout(), before);
			assert.deepStrictEqual(screenAfter(before), ["RUN 1", "ended"]);
		}).pipe(Effect.scoped),
	);

	it.live("close inside the caller's scope, then the scope closes: the mount permit is released", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const events = Stream.concat(Stream.fromIterable(runOf(1)), Stream.never);
			const fiber = yield* Effect.forkChild(
				Effect.scoped(Effect.flatMap(liveOn(fake, optionsOf(events)), (handle) => handle.close)),
			);
			yield* Fiber.join(fiber).pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "the permit was released");
		}),
	);
});

describe("a subscription whose PubSub is ended with PubSub.end (review I1)", () => {
	it.live("the buffered messages, then the final message once, are folded, and done completes", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			let folds = 0;
			const handle = yield* liveOn(
				fake,
				optionsOf(subscription, {
					reduce: (state, event) => {
						folds++;
						return reduce(state, event);
					},
				}),
			);
			yield* PubSub.publishAll(pubsub, runOf(3));
			yield* PubSub.end(pubsub, End);
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual((yield* handle.state).seen, [...seenOf(3), "End"]);
			assert.strictEqual(folds, 5, "the sticky final message is folded once, never again");
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "ended"]);
		}).pipe(Effect.scoped),
	);

	it.live("ended while the view waits: the final message ends it", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription), { interactive: false });
			yield* PubSub.publishAll(pubsub, runOf(2));
			// The view has taken both and is waiting again when the PubSub ends.
			yield* until(() => Effect.runSyncWith(Context.empty())(handle.state).seen.length === 3);
			yield* PubSub.end(pubsub, End);
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual((yield* handle.state).seen, [...seenOf(2), "End"]);
		}).pipe(Effect.scoped),
	);

	it.live("a final message that is not terminal: the run is committed as drawn, and close after it is safe", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* liveOn(fake, optionsOf(subscription));
			yield* PubSub.publishAll(pubsub, runOf(1));
			yield* PubSub.end(pubsub, tick(9));
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			yield* handle.close.pipe(Effect.timeout("1 second"));
			assert.deepStrictEqual((yield* handle.state).seen, [...seenOf(1), "tick 9"]);
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 9"]);
		}).pipe(Effect.scoped),
	);
});

describe("close under a small scheduler budget loses nothing it took (review I2)", () => {
	// A budget this small makes the fibers yield every few operations, which is where a chunk taken but not yet
	// handed to the fold could be dropped by close's interrupt. Through the stream machinery the tail was lost at 7, 8
	// and 13-18; with the direct take it is not, and budget 3 is the one that loses it if the step is allowed to yield.
	for (const budget of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 32]) {
		it.live(`MaxOpsBeforeYield ${budget}: every message published before close is folded`, () =>
			Effect.gen(function* () {
				const losses: Array<string> = [];
				for (const n of [1, 2, 3, 5, 7]) {
					for (const k of [0, 1, 2, 3]) {
						const folded = yield* Effect.gen(function* () {
							const pubsub = yield* PubSub.unbounded<Ev>();
							const subscription = yield* PubSub.subscribe(pubsub);
							const handle = yield* liveOn(makeFakeStreams(), optionsOf(subscription, { mode: "hosted" }), {
								interactive: false,
							});
							for (const event of runOf(n - 1)) PubSub.publishUnsafe(pubsub, event);
							for (let i = 0; i < k; i++) yield* Effect.yieldNow;
							yield* handle.close.pipe(Effect.timeout("2 seconds"));
							return (yield* handle.state).seen.length;
						}).pipe(Effect.scoped, Effect.provideService(Scheduler.MaxOpsBeforeYield, budget));
						if (folded !== n) losses.push(`n=${n} k=${k}: ${folded}`);
					}
				}
				assert.deepStrictEqual(losses, []);
			}),
		);
	}
});

describe("close after the caller's scope has closed (review minor 1)", () => {
	it.live("completes: the scope already stopped the view, and there is nothing left to end", () =>
		Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<Ev>();
			const scope = yield* Scope.make();
			const subscription = yield* Scope.provide(PubSub.subscribe(pubsub), scope);
			const handle = yield* Scope.provide(
				liveOn(makeFakeStreams(), optionsOf(subscription), { interactive: false }),
				scope,
			);
			yield* PubSub.publishAll(pubsub, runOf(2));
			yield* Scope.close(scope, Exit.void);
			const exit = yield* Effect.exit(handle.close.pipe(Effect.timeout("1 second")));
			assert.isTrue(Exit.isSuccess(exit), String(exit));
		}),
	);
});
