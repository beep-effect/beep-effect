import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import type { PageSource } from "../../effected/github/internal/paginate.ts";
import { fromArray, paginate } from "../../effected/github/internal/paginate.ts";

/** A source that hands out the given pages in order, counting its calls. */
const recordedPages = <A>(pages: ReadonlyArray<ReadonlyArray<A>>, calls: Ref.Ref<number>): PageSource<A> => {
	let index = 0;
	return {
		next: Ref.update(calls, (n) => n + 1).pipe(
			Effect.map(() => (index < pages.length ? A.get(pages, index++) : O.none())),
		),
	};
};

describe("paginate", () => {
	it.effect("flattens every page when there is no bound", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const items = yield* Stream.runCollect(paginate(() => recordedPages([[1, 2], [3, 4], [5]], calls), undefined));
			assert.deepStrictEqual(items, [1, 2, 3, 4, 5]);
			// Three pages plus the one call that reports completion.
			assert.strictEqual(yield* Ref.get(calls), 4);
		}),
	);

	it.effect("stops ISSUING requests at maxPages, rather than slicing after the fact", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const items = yield* Stream.runCollect(
				paginate(
					() =>
						recordedPages(
							[
								[1, 2],
								[3, 4],
								[5, 6],
							],
							calls,
						),
					2,
				),
			);
			assert.deepStrictEqual(items, [1, 2, 3, 4]);
			assert.strictEqual(yield* Ref.get(calls), 2, "the third page must never be requested");
		}),
	);

	it.effect("a maxPages of one takes a single page", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const items = yield* Stream.runCollect(paginate(() => recordedPages([[1], [2]], calls), 1));
			assert.deepStrictEqual(items, [1]);
			assert.strictEqual(yield* Ref.get(calls), 1);
		}),
	);

	it.effect("a maxPages larger than the collection is harmless", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const items = yield* Stream.runCollect(paginate(() => recordedPages([[1], [2]], calls), 99));
			assert.deepStrictEqual(items, [1, 2]);
		}),
	);

	it.effect("an empty collection yields nothing", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const items = yield* Stream.runCollect(paginate(() => recordedPages<number>([], calls), undefined));
			assert.deepStrictEqual(items, []);
		}),
	);

	it.effect("surfaces a page failure as the stream's typed error", () =>
		Effect.gen(function* () {
			const boom = GitHubError.rejected("probe", 500, "page two exploded");
			let index = 0;
			const source = (): PageSource<number> => ({
				next: Effect.suspend(() => (index++ === 0 ? Effect.succeedSome([1, 2]) : Effect.fail(boom))),
			});
			const error = yield* paginate(source, undefined).pipe(Stream.runCollect, Effect.flip);
			assert.strictEqual(error.reason, "page two exploded");
		}),
	);

	it.effect("opens a fresh source per run, so a stream is re-runnable", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const stream = paginate(() => recordedPages([[1], [2]], calls), undefined);
			assert.deepStrictEqual(yield* Stream.runCollect(stream), [1, 2]);
			assert.deepStrictEqual(
				yield* Stream.runCollect(stream),
				[1, 2],
				"a second run must not resume an exhausted cursor",
			);
		}),
	);

	it.effect("lets a downstream take short-circuit the walk", () =>
		Effect.gen(function* () {
			const calls = yield* Ref.make(0);
			const items = yield* Stream.runCollect(
				paginate(
					() =>
						recordedPages(
							[
								[1, 2],
								[3, 4],
								[5, 6],
							],
							calls,
						),
					undefined,
				).pipe(Stream.take(3)),
			);
			assert.deepStrictEqual(items, [1, 2, 3]);
			assert.isBelow(yield* Ref.get(calls), 3, "pages beyond the taken items must not be requested");
		}),
	);
});

describe("fromArray", () => {
	it.effect("pages a recorded array exactly as GitHub would", () =>
		Effect.gen(function* () {
			const items = Array.from({ length: 250 }, (_, index) => index);
			const collected = yield* Stream.runCollect(paginate(() => fromArray(items, 100), undefined));
			assert.deepStrictEqual(collected, items);
		}),
	);

	it.effect("respects a page budget against real page boundaries", () =>
		Effect.gen(function* () {
			const items = Array.from({ length: 250 }, (_, index) => index);
			const collected = yield* Stream.runCollect(paginate(() => fromArray(items, 100), 2));
			assert.lengthOf(collected, 200);
			assert.strictEqual(collected[199], 199);
		}),
	);

	it.effect("terminates on an exactly-full final page", () =>
		Effect.gen(function* () {
			const items = [1, 2, 3, 4];
			const collected = yield* Stream.runCollect(paginate(() => fromArray(items, 2), undefined));
			assert.deepStrictEqual(collected, items);
		}),
	);

	it.effect("handles an empty recorded array", () =>
		Effect.gen(function* () {
			const collected = yield* Stream.runCollect(paginate(() => fromArray<number>([], 100), undefined));
			assert.deepStrictEqual(collected, []);
		}),
	);
});
