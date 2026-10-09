import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import type { Binding } from "./KeyTable.ts";
import { KeyTable, useKeys } from "./KeyTable.ts";
import { Styled, useGlyphs, useTerminalSize, useTheme } from "./UiTheme.ts";

/**
 * What a key does to a {@link Tabs} row: move to the previous or next tab (wrapping), or jump to one by index.
 *
 * @public
 */
export type TabsAction = "prev" | "next" | { readonly jump: number };

/**
 * One tab.
 *
 * @public
 */
export interface Tab<N extends string> {
	/** Identifies the tab; `onChange` and `value` speak in names. */
	readonly name: N;
	/** What the tab shows. */
	readonly label: string;
}

/**
 * Props of {@link Tabs.View}.
 *
 * @public
 */
export interface TabsProps<N extends string> {
	/** The tabs, in order. */
	readonly tabs: ReadonlyArray<Tab<N>>;
	/** The active tab, when the caller controls it: keys then only ask, through `onChange`. */
	readonly value?: N;
	/** The starting tab when uncontrolled; the first tab by default. */
	readonly defaultValue?: N;
	/** Called with the starting tab once on mount, then with every tab a key asks for. */
	readonly onChange?: (name: N, index: number) => void;
	/**
	 * Whether the tabs read keys; `true` by default. Unfocused, every tab is muted (the active one still underlined)
	 * and keys are ignored.
	 */
	readonly isFocused?: boolean;
	/** Number each tab, `1. Label`; `false` by default. */
	readonly showIndex?: boolean;
	/** Between tabs in a row; ` │ ` by default (` | ` under ASCII glyphs). */
	readonly separator?: string;
	/** A row (`←`/`→`) or a column (`↑`/`↓`) of tabs; a row by default. */
	readonly direction?: "row" | "column";
}

const step = (index: number, count: number, action: TabsAction): number => {
	if (count <= 0) return index;
	if (action === "prev") return (index - 1 + count) % count;
	if (action === "next") return (index + 1) % count;
	return action.jump >= 0 && action.jump < count ? action.jump : index;
};

/** Plain digits jump: 1 is the first tab, 9 the ninth, 0 the tenth. Bound, but left out of the help line. */
const DIGITS: ReadonlyArray<Binding<TabsAction>> = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(
	(digit, index) => ({ keys: [{ char: digit }], action: { jump: index }, help: "jump", hidden: true }),
);

const table = (prev: "left" | "up", next: "right" | "down"): KeyTable<TabsAction> =>
	KeyTable.make<TabsAction>([
		{ keys: [prev], action: "prev", help: "switch" },
		{ keys: [next], action: "next", help: "switch" },
		{ keys: ["tab"], action: "next", help: "switch" },
		{ keys: ["shift+tab"], action: "prev", help: "switch" },
		...DIGITS,
	]);

const ROW_KEYS = table("left", "right");
const COLUMN_KEYS = table("up", "down");

/** The tabs from `from` to `to` that fit `width` around `active`, widening right then left in turn. */
const fitAround = (widths: ReadonlyArray<number>, active: number, gap: number, width: number) => {
	let from = active;
	let to = active;
	let used = widths[active] ?? 0;
	let grew = true;
	while (grew) {
		grew = false;
		const right = widths[to + 1];
		if (right !== undefined && used + gap + right <= width) {
			to++;
			used += gap + right;
			grew = true;
		}
		const left = widths[from - 1];
		if (left !== undefined && used + gap + left <= width) {
			from--;
			used += gap + left;
			grew = true;
		}
	}
	return { from, to };
};

/**
 * A row (or column) of tabs, for a consumer's own screen.
 *
 * @remarks
 * Not a screen: render `Tabs.View` inside a consumer's own screen. Its keys come from one `useKeys`, so there is a
 * single input reader. Tab and Shift-Tab cycle whenever the tabs are focused, and plain digits jump, so a screen that
 * hosts Tabs beside another widget reading Tab, arrows or digits (a `TextInput`, say) must decide who has the keys:
 * pass `isFocused: false` to the Tabs while the other widget is being typed into. When unfocused, Tabs reads no key
 * and is drawn muted.
 *
 * @public
 */
export class Tabs {
	private constructor() {}

	/**
	 * The tab an action lands on: `"prev"` and `"next"` wrap at both ends; `{ jump }` moves to that index and does
	 * nothing when it is out of range.
	 *
	 * @param index - the active tab
	 * @param count - how many tabs there are
	 * @param action - the action
	 */
	static readonly step: (index: number, count: number, action: TabsAction) => number = step;

	/** The keys of a row: `←`/`→` and Tab/Shift-Tab switch, plain digits 1–9 jump, 0 is the tenth tab. */
	static readonly keys: KeyTable<TabsAction> = ROW_KEYS;

	/** The keys of a column: `↑`/`↓` in place of `←`/`→`. */
	static readonly columnKeys: KeyTable<TabsAction> = COLUMN_KEYS;

	/**
	 * Draw the tabs: the active one in the accent token, bold and underlined; the others plain; every tab muted while
	 * unfocused. At colour `"none"`, where all of that vanishes, the active tab is bracketed, `[Alpha]`, and the others
	 * padded a space each side. A row wider than the terminal shows the tabs that fit around the active one, with the
	 * glyph set's ellipsis at a cut edge, so it never wraps.
	 *
	 * @remarks
	 * Controlled when `value` is given: a key calls `onChange` and the active tab moves only when `value` does.
	 * Uncontrolled otherwise, starting at `defaultValue` or the first tab. Either way `onChange` fires once on mount
	 * with the starting tab.
	 *
	 * @param props - the tabs and how they behave
	 */
	static readonly View = <N extends string>(props: TabsProps<N>): ReactElement => {
		const { ink, react } = inkModules();
		const glyphs = useGlyphs();
		const theme = useTheme();
		const { columns } = useTerminalSize();
		const indexOf = (name: N | undefined): number =>
			name === undefined ? -1 : props.tabs.findIndex((tab) => tab.name === name);
		const [own, setOwn] = react.useState(() => Math.max(0, indexOf(props.defaultValue)));
		const controlled = props.value !== undefined;
		const index = controlled ? Math.max(0, indexOf(props.value)) : own;
		const focused = props.isFocused ?? true;
		const column = props.direction === "column";
		const { onChange } = props;
		// Where the next key steps from. Re-read from the render on every render, and moved by the handler itself, so
		// keys arriving in one stdin chunk (handled before React re-renders) each step from the last one's tab.
		const at = react.useRef(index);
		at.current = index;
		// The tab the last render drew. Controlled, the handler's move only lasts out the read it came in: Ink dispatches
		// a read's keys synchronously, so a microtask runs once they are all handled and puts the next read back on
		// `value`. A parent that rejects a change never re-renders, and without this its tabs would drift from `value`.
		const drawn = react.useRef(index);
		drawn.current = index;
		// Fires once, on mount, with the starting tab; later changes are reported from the key handler. The ref keeps
		// it to once even if React runs mount effects twice.
		const announced = react.useRef(false);
		react.useEffect(() => {
			if (announced.current) return;
			announced.current = true;
			const first = props.tabs[index];
			if (first !== undefined) onChange?.(first.name, index);
		}, []);
		useKeys(
			column ? COLUMN_KEYS : ROW_KEYS,
			(action) => {
				const from = at.current;
				const next = step(from, props.tabs.length, action);
				const tab = props.tabs[next];
				if (next === from || tab === undefined) return;
				at.current = next;
				if (controlled) {
					queueMicrotask(() => {
						at.current = drawn.current;
					});
				} else setOwn(next);
				onChange?.(tab.name, next);
			},
			{ isActive: focused },
		);
		const labelOf = (position: number): string =>
			`${props.showIndex === true ? `${position + 1}. ` : ""}${lineText(props.tabs[position]?.label ?? "")}`;
		// At colour none, accent, bold and underline all vanish: the active tab is bracketed instead, and the others
		// padded a space each side so a tab's width does not change as it becomes active.
		const plain = theme.color === "none";
		const marks = plain ? 2 : 0;
		const marked = (position: number, text: string): string =>
			plain ? (position === index ? `[${text}]` : ` ${text} `) : text;
		const draw = (position: number, text: string): ReactElement => {
			if (!focused) {
				return react.createElement(
					Styled,
					{ key: position, token: position === index ? { ...theme.style("muted"), underline: true } : "muted" },
					text,
				);
			}
			return position === index
				? react.createElement(
						Styled,
						{ key: position, token: { ...theme.style("accent"), bold: true, underline: true } },
						text,
					)
				: react.createElement(ink.Text, { key: position }, text);
		};
		if (column) {
			return react.createElement(
				ink.Box,
				{ flexDirection: "column" },
				...props.tabs.map((_, position) =>
					react.createElement(
						ink.Box,
						{ key: position },
						draw(
							position,
							marked(
								position,
								Fmt.truncate(labelOf(position), Math.max(1, columns - marks), { ellipsis: glyphs.ellipsis }),
							),
						),
					),
				),
			);
		}
		const separator = lineText(props.separator ?? (glyphs.kind === "unicode" ? " │ " : " | "));
		const labels = props.tabs.map((_, position) => marked(position, labelOf(position)));
		const mark = Fmt.width(glyphs.ellipsis);
		const total = labels.reduce((sum, label) => sum + Fmt.width(label), 0) + Fmt.width(separator) * (labels.length - 1);
		// Too wide: show the tabs that fit around the active one, keeping room for an ellipsis at each cut edge.
		const { from, to } =
			total <= columns
				? { from: 0, to: labels.length - 1 }
				: fitAround(
						labels.map((label) => Fmt.width(label)),
						index,
						Fmt.width(separator),
						Math.max(1, columns - 2 * mark),
					);
		const children: Array<ReactElement | string> = [];
		if (from > 0) children.push(glyphs.ellipsis);
		for (let position = from; position <= to; position++) {
			if (position > from) children.push(separator);
			const room = Math.max(1, columns - (from > 0 ? mark : 0) - (to < labels.length - 1 ? mark : 0));
			const label = labels[position] ?? "";
			const cut = (): string =>
				marked(position, Fmt.truncate(labelOf(position), Math.max(1, room - marks), { ellipsis: glyphs.ellipsis }));
			children.push(draw(position, from === to && Fmt.width(label) > room ? cut() : label));
		}
		if (to < labels.length - 1) children.push(glyphs.ellipsis);
		return react.createElement(ink.Text, { wrap: "truncate-end" }, ...children);
	};
}
