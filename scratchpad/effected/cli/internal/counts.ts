import { dual } from "effect/Function";
import type { BlockOf, Counter, Inline } from "../Doc.ts";
import { Fmt } from "../Fmt.ts";
import * as P from "effect/Predicate";

/**
 * The label a counter shows for a count: its one label, or `one` when the count is exactly 1 and `other` otherwise.
 * The count is the counter's own `n`, except in a share headline (`1/3 repos`), which reads by the denominator, the
 * total, and passes it.
 *
 * @internal
 */
export const counterLabel: {
	(count?: number): (counter: Counter) => string;
	(counter: Counter, count?: number): string;
} = dual((args) => P.isObjectKeyword(args[0]) && !P.isFunction(args[0]), (counter: Counter, count: number = counter.n): string =>
	P.isString(counter.label) ? counter.label : count === 1 ? counter.label.one : counter.label.other);

/**
 * The label a counter's column is headed with in a `CountsTable`: its one label, or its plural form, since a column
 * holds every row's count.
 *
 * @internal
 */
export const columnLabel = (counter: Counter): string =>
	P.isString(counter.label) ? counter.label : counter.label.other;

/**
 * The total of a `Counts` block: the caller's rule when it has one, otherwise the sum of `n` over every counter.
 *
 * **Details**
 *
 * Lives here, not on `Doc`, so a renderer needs nothing from `Doc` at runtime: `Doc.print` imports the renderers, and
 * a renderer importing `Doc` back would make a cycle. `Doc.total` is this function.
 *
 * @internal
 */
export const totalOf = (block: BlockOf<"Counts">): number =>
	block.total === undefined ? block.counters.reduce((sum, counter) => sum + counter.n, 0) : block.total(block.counters);

/**
 * The counters a renderer shows: every one except a zero counter that does not ask for `showZero`. `Doc.visibleCounters`
 * is this function.
 *
 * @internal
 */
export const visibleCountersOf = (block: BlockOf<"Counts">): ReadonlyArray<Counter> =>
	block.counters.filter((counter) => counter.n !== 0 || counter.showZero === true);

/**
 * A `CountsTable` as the `Table` it renders as: a label column, then a column per counter key in the order the keys
 * first appear, headed by that counter's label; a cell is the count painted with its status token, empty where a row
 * has no counter for the key; a duration column, when some row has a `durationMs`, formatted with `Fmt.duration`; and,
 * with `totalRow`, a last row summing each column (a missing count or duration is zero).
 *
 * **Details**
 *
 * Plain literals, not `Doc` constructors: a renderer needs nothing from `Doc` at runtime (see {@link totalOf}).
 *
 * @internal
 */
export const countsTableOf = (block: BlockOf<"CountsTable">): BlockOf<"Table"> => {
	const keys: Array<Counter> = [];
	for (const row of block.rows) {
		for (const counter of row.counters) if (!keys.some((known) => known.key === counter.key)) keys.push(counter);
	}
	const text = (value: string, token?: Counter["status"]["def"]["token"]): Inline =>
		token === undefined ? { _tag: "Text", value } : { _tag: "Text", value, token };
	const countCell = (counter: Counter | undefined): ReadonlyArray<Inline> =>
		counter === undefined ? [] : [text(String(counter.n), counter.status.def.token)];
	const timed = block.rows.some((row) => row.durationMs !== undefined);
	const durationCell = (ms: number | undefined): ReadonlyArray<ReadonlyArray<Inline>> =>
		timed ? [ms === undefined ? [] : [text(Fmt.duration(ms))]] : [];
	const rows = block.rows.map((row) => [
		row.label,
		...keys.map((key) => countCell(row.counters.find((counter) => counter.key === key.key))),
		...durationCell(row.durationMs),
	]);
	const totalLabel =
		block.totalRow === undefined || block.totalRow === false
			? undefined
			: block.totalRow === true
				? [text("Total")]
				: block.totalRow;
	const total =
		totalLabel === undefined
			? []
			: [
					[
						totalLabel,
						...keys.map((key) => [
							text(
								String(
									block.rows.reduce(
										(sum, row) => sum + (row.counters.find((counter) => counter.key === key.key)?.n ?? 0),
										0,
									),
								),
							),
						]),
						...durationCell(block.rows.reduce((sum, row) => sum + (row.durationMs ?? 0), 0)),
					],
				];
	return {
		_tag: "Table",
		columns: [
			{ header: block.labelHeader ?? [] },
			...keys.map((key) => ({ header: [text(columnLabel(key))] })),
			...(timed ? [{ header: block.durationHeader ?? [text("duration")] }] : []),
		],
		rows: [...rows, ...total],
	};
};
