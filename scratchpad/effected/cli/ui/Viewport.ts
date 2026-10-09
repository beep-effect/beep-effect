import * as MutableHashSet from "effect/MutableHashSet";
import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import type { ReactElement } from "react";
import { inkModules } from "./internal/ink.ts";
import { KeyTable } from "./KeyTable.ts";
import { useTerminalSize } from "./UiTheme.ts";

const $I = $ScratchpadId.create("effected/cli/ui/Viewport");

class DuplicateViewportKeyError extends S.TaggedError<DuplicateViewportKeyError>(
	$I`DuplicateViewportKeyError`,
)("DuplicateViewportKeyError", {
	message: S.String,
}) {}

/**
 * Where a viewport is: the selected item, the first item in view, how many items fit, and how many there are.
 *
 * **Details**
 *
 * Every number counts items, never section headers. The reducer keeps `0 <= cursor < count` (or both 0 when there
 * are no items) and `offset <= cursor < offset + height`, and never lets the window run past the last item.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ViewportState {
	/** The selected item. */
	readonly cursor: number;
	/** The first item in view. */
	readonly offset: number;
	/** How many items the window holds. */
	readonly height: number;
	/** How many items there are. */
	readonly count: number;
}

/**
 * A row a viewport shows: a section header, or an item. Only items are selectable. An item's `key` is its React
 * key in the view, so keys must be unique within one list: `Viewport.View` dies on a repeat.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ViewportRow =
	| { readonly _tag: "Header"; readonly label: string }
	| { readonly _tag: "Item"; readonly key: string };

/**
 * A move through a viewport.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ViewportMove = "up" | "down" | "home" | "end" | "pageup" | "pagedown";

/**
 * Props of {@link Viewport.View}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ViewportViewProps {
	/** The rows, headers and items, in order; the items are what `state` counts. */
	readonly rows: ReadonlyArray<ViewportRow>;
	/** Where the viewport is. */
	readonly state: ViewportState;
	/** Draws one row; `highlighted` is true for the selected item. Each row is clipped to one line. */
	readonly renderRow: (row: ViewportRow, highlighted: boolean) => ReactElement;
	/** Lines the rest of the screen uses (a title, a help line), taken off the terminal height; 0 by default. */
	readonly reserved?: number;
}

/**
 * Throws on a repeated item key. Checked before React sees the rows: React reports a duplicate key on
 * `console.error`, which under a screen's unpatched console lands on the real stderr, over the frame.
 */
const assertUniqueItemKeys = (rows: ReadonlyArray<ViewportRow>): void => {
	const seen = MutableHashSet.empty<string>();
	for (const row of rows) {
		if (row._tag !== "Item") continue;
		if (MutableHashSet.has(seen, row.key))
			throw DuplicateViewportKeyError.make({
				message: `@effected/cli/ui: Viewport item keys must be unique; "${row.key}" repeats`,
			});
		MutableHashSet.add(seen, row.key);
	}
};

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/** The offset that keeps `cursor` in view, moving as little as possible, never past the last full window. */
const follow = (cursor: number, offset: number, height: number, count: number): number => {
	if (count === 0) return 0;
	let next = offset;
	if (cursor < next) next = cursor;
	if (cursor >= next + height) next = cursor - height + 1;
	return clamp(next, 0, Math.max(0, count - height));
};

const init = (count: number, height: number, cursor = 0): ViewportState => {
	const items = Math.max(0, Math.floor(count));
	const window = Math.max(1, Math.floor(height));
	const selected = items === 0 ? 0 : clamp(Math.floor(cursor), 0, items - 1);
	return { cursor: selected, offset: follow(selected, 0, window, items), height: window, count: items };
};

const step = (state: ViewportState, move: ViewportMove): ViewportState => {
	if (state.count === 0) return state;
	const last = state.count - 1;
	const target =
		move === "up"
			? state.cursor - 1
			: move === "down"
				? state.cursor + 1
				: move === "home"
					? 0
					: move === "end"
						? last
						: move === "pageup"
							? state.cursor - state.height
							: state.cursor + state.height;
	const cursor = clamp(target, 0, last);
	return { ...state, cursor, offset: follow(cursor, state.offset, state.height, state.count) };
};

const resize = (state: ViewportState, height: number): ViewportState => {
	const window = Math.max(1, Math.floor(height));
	return { ...state, height: window, offset: follow(state.cursor, state.offset, window, state.count) };
};

/**
 * The rows to draw, as indexes into `rows`, for a window of `budget` lines starting at item `start`: the section
 * header of the first item first (re-emitted when it has scrolled off), then rows in order until the budget is spent.
 */
const linesFrom = (
	rows: ReadonlyArray<ViewportRow>,
	items: ReadonlyArray<number>,
	start: number,
	budget: number,
) => {
	const first = items[start] ?? 0;
	const lines: Array<number> = [];
	if (budget > 1) {
		for (let index = first - 1; index >= 0; index--) {
			if (rows[index]?._tag === "Header") {
				lines.push(index);
				break;
			}
		}
	}
	for (let index = first; index < rows.length && lines.length < budget; index++) lines.push(index);
	return lines;
};

/** What the view draws: the row indexes, the item the window starts at, and the selected row (or -1). */
interface Slice {
	readonly lines: ReadonlyArray<number>;
	readonly start: number;
	readonly selected: number;
}

/**
 * The visible slice, starting where the window last started (`previous`, or the state's offset on first draw) and
 * moving only as far as the selected item needs: back to it when it is above the window, forward until it is drawn
 * when it is below. So moving inside the window moves only the highlight, even when headers take lines the
 * item-counting reducer does not. The cursor is clamped into the items here, for both the slice and the highlight.
 */
const slice = (
	rows: ReadonlyArray<ViewportRow>,
	state: ViewportState,
	budget: number,
	previous: number | undefined,
): Slice => {
	const items = rows.flatMap((row, index) => (row._tag === "Item" ? [index] : []));
	if (items.length === 0)
		return { lines: rows.slice(0, budget).map((_, index) => index), start: 0, selected: -1 };
	const cursor = clamp(state.cursor, 0, items.length - 1);
	const selected = items[cursor] ?? 0;
	let start = clamp(previous ?? state.offset, 0, cursor);
	let lines = linesFrom(rows, items, start, budget);
	while (!lines.includes(selected) && start < cursor) {
		start++;
		lines = linesFrom(rows, items, start, budget);
	}
	// At the end of the list a window can come up short, after the terminal grew or the budget rose: pull the start
	// back while that fills it and still draws the selected item.
	while (lines.length < budget && start > 0) {
		const earlier = linesFrom(rows, items, start - 1, budget);
		if (!earlier.includes(selected)) break;
		start--;
		lines = earlier;
	}
	return { lines, start, selected };
};

/**
 * A scrolling list: a pure reducer over a window of items, its key table, and a view that draws the window.
 *
 * **Details**
 *
 * The view never draws more lines than fit: its height is `min(state.height, terminal rows - 1 - reserved)`, and
 * every row is clipped to one line of `columns - 1` cells, so a frame never fills the terminal and Ink never clears
 * the screen and scrollback to redraw it. A section header stays visible: when the header of the first visible item
 * has scrolled off, it is drawn again atop the slice.
 *
 * **Example** (Follow the selection through a scrolling window)
 *
 * ```ts
 * import { Viewport } from "@beep/scratchpad/effected/cli/ui/Viewport"
 * const state = Viewport.step(Viewport.init(8, 3), "end")
 * console.log(state.offset) // 5
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Viewport {
	private constructor() {}

	/**
	 * A viewport over `count` items, `height` of them in view, with `cursor` selected (clamped; 0 by default).
	 *
	 * **Example** (Clamp an initial selection)
	 *
	 * ```ts
	 * import { Viewport } from "@beep/scratchpad/effected/cli/ui/Viewport"
	 * console.log(Viewport.init(5, 2, 9).cursor) // 4
	 * ```
	 *
	 * @param count - how many items
	 * @param height - how many fit (at least 1)
	 * @param cursor - the item to select
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly init: (count: number, height: number, cursor?: number) => ViewportState = init;

	/**
	 * Move the cursor, clamped at both ends with no wrap, keeping it in view. A page is the window height.
	 *
	 * **Example** (Move by one page)
	 *
	 * ```ts
	 * import { Viewport } from "@beep/scratchpad/effected/cli/ui/Viewport"
	 * console.log(Viewport.step(Viewport.init(10, 3), "pagedown").cursor) // 3
	 * ```
	 *
	 * @param state - where the viewport is
	 * @param move - the move
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly step: (state: ViewportState, move: ViewportMove) => ViewportState = step;

	/**
	 * Change the window height, keeping the cursor where it is and in view.
	 *
	 * **Example** (Keep the selected item visible after shrinking)
	 *
	 * ```ts
	 * import { Viewport } from "@beep/scratchpad/effected/cli/ui/Viewport"
	 * console.log(Viewport.resize(Viewport.init(8, 4, 6), 2).offset) // 5
	 * ```
	 *
	 * @param state - where the viewport is
	 * @param height - the new height (at least 1)
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly resize: (state: ViewportState, height: number) => ViewportState = resize;

	/**
	 * The keys: ↑/↓ move, pgup/pgdn page, home top, end bottom.
	 *
	 * **Example** (Inspect the navigation bindings)
	 *
	 * ```ts
	 * import { Viewport } from "@beep/scratchpad/effected/cli/ui/Viewport"
	 * console.log(Viewport.keys.bindings.length) // 6
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly keys: KeyTable<ViewportMove> = KeyTable.make<ViewportMove>([
		{ keys: ["up"], action: "up", help: "move" },
		{ keys: ["down"], action: "down", help: "move" },
		{ keys: ["pageup"], action: "pageup", help: "page" },
		{ keys: ["pagedown"], action: "pagedown", help: "page" },
		{ keys: ["home"], action: "home", help: "top" },
		{ keys: ["end"], action: "end", help: "bottom" },
	]);

	/**
	 * Draw the window: the visible rows, each clipped to one line. A repeated item key is a defect: the view throws, so
	 * the screen dies with the reason.
	 *
	 * **Example** (Construct a scrolling list element)
	 *
	 * ```ts
	 * import { Viewport } from "@beep/scratchpad/effected/cli/ui/Viewport"
	 * import { createElement, isValidElement } from "react"
	 * import { Text } from "ink"
	 *
	 * const element = createElement(Viewport.View, {
	 *   rows: [{ _tag: "Item", key: "a" }],
	 *   state: Viewport.init(1, 1),
	 *   renderRow: () => createElement(Text, null, "Alpha"),
	 * })
	 * console.log(isValidElement(element)) // true
	 * ```
	 *
	 * @param props - the rows, the state, how to draw a row, and the lines reserved for the rest of the screen
	 * @category components
	 * @since 0.0.0
	 */
	static readonly View = (props: ViewportViewProps): ReactElement => {
		assertUniqueItemKeys(props.rows);
		const { ink, react } = inkModules();
		const size = useTerminalSize();
		const budget = Math.max(1, Math.min(props.state.height, size.rows - (props.reserved ?? 0)));
		// The window's start is the view's own memory: it depends on the lines headers take, which the reducer
		// cannot see. Writing it during render is safe because `slice` is a fixpoint on its own output: fed the start
		// it just returned, with the same rows, state and budget, it returns that start again (the selected item is
		// drawn and the window is full or begins at item 0, so neither loop moves). A render repeated by React, or a
		// second render before commit, therefore sees and writes the same value.
		const started = react.useRef<number | undefined>(undefined);
		const { lines, start, selected } = slice(props.rows, props.state, budget, started.current);
		started.current = start;
		return react.createElement(
			ink.Box,
			{ flexDirection: "column", marginRight: 1 },
			...lines.map((index) => {
				const row = A.getUnsafe(props.rows, index);
				return react.createElement(
					ink.Box,
					{
						key: row._tag === "Item" ? `item:${row.key}` : `header:${index}`,
						height: 1,
						overflow: "hidden",
					},
					props.renderRow(row, index === selected),
				);
			}),
		);
	};
}
