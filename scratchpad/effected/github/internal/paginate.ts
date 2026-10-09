import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { dual } from "effect/Function";
import type { GitHubError } from "../GitHubError.ts";

/**
 * A source of pages, whatever they come from.
 *
 * @remarks
 * The seam that lets the live client and the fixture double share one
 * traversal. `next` yields the next page, or `Option.none()` when the traversal
 * is finished; it is called at most once per page and never again after it
 * reports completion.
 *
 * A source is **single-use** — it holds the cursor. {@link paginate} therefore
 * takes a factory, so running the same `Stream` twice runs two traversals
 * rather than resuming an exhausted one.
 *
 * @internal
 */
export interface PageSource<A> {
	readonly next: Effect.Effect<O.Option<ReadonlyArray<A>>, GitHubError>;
}

/**
 * Walk a {@link PageSource} into a stream of its items.
 *
 * @remarks
 * **This is the only pagination implementation in the package**, and it is why
 * the fixture double cannot drift from the live client: both build a
 * `PageSource` and hand it here, so `maxPages` and item flattening have exactly
 * one behavior.
 *
 * `maxPages` bounds **requests, not items**: the walk stops issuing them rather
 * than fetching everything and slicing.
 *
 * @internal
 */
export const paginate: {
	<A>(openSource: () => PageSource<A>, maxPages: number | undefined): Stream.Stream<A, GitHubError>;
	(maxPages: number | undefined): <A>(openSource: () => PageSource<A>) => Stream.Stream<A, GitHubError>;
} = dual(2, <A>(
	openSource: () => PageSource<A>,
	maxPages: number | undefined,
): Stream.Stream<A, GitHubError> =>
	Stream.suspend(() => {
		const source = openSource();
		return Stream.paginate(0, (pagesTaken: number) =>
			Effect.map(source.next, (page) => {
				if (O.isNone(page)) {
					return [[] as ReadonlyArray<A>, O.none<number>()] as const;
				}
				const taken = pagesTaken + 1;
				const exhausted = maxPages !== undefined && taken >= maxPages;
				return [page.value, exhausted ? O.none<number>() : O.some(taken)] as const;
			}),
		);
	}));

/**
 * A {@link PageSource} over an already-collected array, sliced into pages.
 *
 * @remarks
 * What the fixture double records. Slicing here rather than inside the double
 * keeps "what is a page" in one place: a recorded fixture of 250 items with
 * `perPage: 100` pages exactly as GitHub would, so a test can assert a caller's
 * `maxPages` truncation against real page boundaries.
 *
 * @internal
 */
export const fromArray: {
	<A>(items: ReadonlyArray<A>, perPage: number): PageSource<A>;
	(perPage: number): <A>(items: ReadonlyArray<A>) => PageSource<A>;
} = dual(2, <A>(items: ReadonlyArray<A>, perPage: number): PageSource<A> => {
	let offset = 0;
	let finished = false;
	return {
		next: Effect.sync(() => {
			if (finished) return O.none();
			const page = items.slice(offset, offset + perPage);
			offset += perPage;
			// A short page is GitHub's own end-of-collection signal.
			if (page.length < perPage) finished = true;
			return page.length === 0 ? O.none() : O.some(page);
		}),
	};
});
