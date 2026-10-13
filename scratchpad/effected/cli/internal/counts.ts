import { dual } from "effect/Function";
import type { BlockOf, Counter, Inline } from "../Doc.ts";
import { Fmt } from "../Fmt.ts";
import * as P from "effect/Predicate";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";

/**
 * The label a counter shows for a count: its one label, or `one` when the count is exactly 1 and `other` otherwise.
 * The count is the counter's own `n`, except in a share headline (`1/3 repos`), which reads by the denominator, the
 * total, and passes it.
 *
 * **Example** (Read singular and denominator labels)
 *
 * ```ts
 * import { counterLabel } from "@beep/scratchpad/effected/cli/internal/counts"
 * import type { Counter } from "@beep/scratchpad/effected/cli/Doc"
 *
 * const counter: Counter = {
 *   key: "repos", label: { one: "repo", other: "repos" }, n: 1,
 *   status: { name: "ok", def: { glyph: "+", ascii: "+", token: "success", rank: 0 } },
 * }
 * console.log(counterLabel(counter)) // repo
 * console.log(counterLabel(counter, 3)) // repos
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
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
 * **Example** (Head a column with the plural label)
 *
 * ```ts
 * import { columnLabel } from "@beep/scratchpad/effected/cli/internal/counts"
 * import type { Counter } from "@beep/scratchpad/effected/cli/Doc"
 *
 * const counter: Counter = {
 *   key: "repos", label: { one: "repo", other: "repos" }, n: 1,
 *   status: { name: "ok", def: { glyph: "+", ascii: "+", token: "success", rank: 0 } },
 * }
 * console.log(columnLabel(counter)) // repos
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
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
 * **Example** (Sum counter values)
 *
 * ```ts
 * import { totalOf } from "@beep/scratchpad/effected/cli/internal/counts"
 *
 * console.log(totalOf({ _tag: "Counts", layout: "inline", counters: [] })) // 0
 * ```
 *
 * @internal
 * @category folding
 * @since 0.0.0
 */
export const totalOf = (block: BlockOf<"Counts">): number =>
	block.total === undefined ? block.counters.reduce((sum, counter) => sum + counter.n, 0) : block.total(block.counters);

/**
 * The counters a renderer shows: every one except a zero counter that does not ask for `showZero`. `Doc.visibleCounters`
 * is this function.
 *
 * **Example** (Hide a zero count unless requested)
 *
 * ```ts
 * import { visibleCountersOf } from "@beep/scratchpad/effected/cli/internal/counts"
 * import type { Counter } from "@beep/scratchpad/effected/cli/Doc"
 * import type { BlockOf } from "@beep/scratchpad/effected/cli/Doc"
 *
 * const counter: Counter = {
 *   key: "repos", label: { one: "repo", other: "repos" }, n: 1,
 *   status: { name: "ok", def: { glyph: "+", ascii: "+", token: "success", rank: 0 } },
 * }
 * const block: BlockOf<"Counts"> = {
 *   _tag: "Counts", layout: "inline", counters: [{ ...counter, n: 0 }],
 * }
 * console.log(visibleCountersOf(block).length) // 0
 * console.log(visibleCountersOf({ ...block, counters: [{ ...counter, n: 0, showZero: true }] }).length) // 1
 * ```
 *
 * @internal
 * @category filtering
 * @since 0.0.0
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
 * **Example** (Build the columns of an empty table)
 *
 * ```ts
 * import { countsTableOf } from "@beep/scratchpad/effected/cli/internal/counts"
 *
 * const table = countsTableOf({ _tag: "CountsTable", rows: [] })
 * console.log(table.columns.length) // 1
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const countsTableOf = (block: BlockOf<"CountsTable">): BlockOf<"Table"> => {
	const keys: Array<Counter> = [];
	const seen = MutableHashSet.empty<string>();
	const indexed = A.map(block.rows, (row) => {
		const counters = MutableHashMap.empty<string, Counter>();
		for (const counter of row.counters) {
			const key = counter.key;
			if (!MutableHashSet.has(seen, key)) {
				MutableHashSet.add(seen, key);
				keys.push(counter);
			}
			if (!MutableHashMap.has(counters, key)) MutableHashMap.set(counters, key, counter);
		}
		return { row, counters };
	});
	const text = (value: string, token?: Counter["status"]["def"]["token"]): Inline =>
		token === undefined ? { _tag: "Text", value } : { _tag: "Text", value, token };
	const countCell = (counter: Counter | undefined): ReadonlyArray<Inline> =>
		counter === undefined ? [] : [text(String(counter.n), counter.status.def.token)];
	const timed = block.rows.some((row) => row.durationMs !== undefined);
	const durationCell = (ms: number | undefined): ReadonlyArray<ReadonlyArray<Inline>> =>
		timed ? [ms === undefined ? [] : [text(Fmt.duration(ms))]] : [];
	const rows = A.map(indexed, ({ row, counters }) => [
		row.label,
		...A.map(keys, (key) => countCell(counters.pipe(MutableHashMap.get(key.key), O.getOrUndefined))),
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
									A.reduce(indexed,
										0,
										(sum, { counters }) => sum + (O.getOrUndefined(MutableHashMap.get(counters, key.key))?.n ?? 0),
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
