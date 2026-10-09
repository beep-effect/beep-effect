import * as O from "@beep/utils/Option";
import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import type { Screen } from "./CliUi.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { useScreenCancel } from "./internal/ScreenContext.ts";
import { KeyHelp } from "./KeyHelp.ts";
import { KeyTable, useKeys } from "./KeyTable.ts";
import { Styled, useGlyphs, useTerminalSize, useTheme } from "./UiTheme.ts";
import type { ViewportMove, ViewportRow, ViewportState } from "./Viewport.ts";
import { Viewport } from "./Viewport.ts";

/**
 * One choice of a {@link Select}.
 *
 * @public
 */
export interface SelectChoice<A> {
	/** What the row shows. */
	readonly label: string;
	/** What choosing it returns. */
	readonly value: A;
	/** A line shown, muted, beneath the list while this choice is highlighted. */
	readonly detail?: string;
	/** Shown muted and never highlighted: moves skip it. */
	readonly disabled?: boolean;
}

/**
 * Where a {@link Select} is: its choices, the viewport over them, and whether one was submitted.
 *
 * @public
 */
export interface SelectState<A> {
	/** The choices. */
	readonly choices: ReadonlyArray<SelectChoice<A>>;
	/** The highlighted choice and the window over the list. */
	readonly viewport: ViewportState;
	/** Whether the highlighted choice was submitted. */
	readonly submitted: boolean;
}

/**
 * What a key does in a {@link Select}: a viewport move, submit, or cancel.
 *
 * @public
 */
export type SelectAction = ViewportMove | "submit" | "cancel";

/**
 * Options for {@link Select.init}.
 *
 * @public
 */
export interface SelectInitOptions {
	/**
	 * The choice to start on: the first enabled one at or after it, or the nearest enabled one before it when none
	 * follows. 0 by default.
	 */
	readonly initial?: number;
	/** How many rows the list shows at most; the terminal height also limits it. 10 by default. */
	readonly height?: number;
}

/**
 * Props of {@link Select.View}.
 *
 * @public
 */
export interface SelectViewProps<A> {
	/** The question, shown above the list. */
	readonly message: string;
	/** The choices. */
	readonly choices: ReadonlyArray<SelectChoice<A>>;
	/** The choice to start on. */
	readonly initial?: number;
	/** How many rows the list shows at most. */
	readonly height?: number;
	/** Receives the value chosen with enter. */
	readonly onSubmit: (value: A) => void;
}

/**
 * Options for {@link Select.screen}.
 *
 * @public
 */
export interface SelectScreenOptions<A> {
	/** The question, shown above the list. */
	readonly message: string;
	/** The choices. */
	readonly choices: ReadonlyArray<SelectChoice<A>>;
	/** The choice to start on. */
	readonly initial?: number;
	/** How many rows the list shows at most. */
	readonly height?: number;
}

const enabled = <A>(choices: ReadonlyArray<SelectChoice<A>>, index: number): boolean =>
	index >= 0 && index < choices.length && choices[index]?.disabled !== true;

/** The nearest enabled index from `from` in `direction`, or `undefined`. */
const nearest = <A>(choices: ReadonlyArray<SelectChoice<A>>, from: number, direction: 1 | -1): number | undefined => {
	for (let index = from; index >= 0 && index < choices.length; index += direction) {
		if (enabled(choices, index)) return index;
	}
	return undefined;
};

/** Move the viewport's cursor to `index`, one step at a time so its window follows. */
const moveTo = (viewport: ViewportState, index: number): ViewportState => {
	let state = viewport;
	while (state.cursor < index) state = Viewport.step(state, "down");
	while (state.cursor > index) state = Viewport.step(state, "up");
	return state;
};

const NO_ENABLED_CHOICE = "@effected/cli/ui: Select needs at least one enabled choice";

const init = <A>(choices: ReadonlyArray<SelectChoice<A>>, options: SelectInitOptions = {}): SelectState<A> => {
	if (!choices.some((choice) => choice.disabled !== true)) throw new Error(NO_ENABLED_CHOICE);
	const height = options.height ?? 10;
	const start = options.initial ?? 0;
	const first = nearest(choices, start, 1) ?? nearest(choices, start, -1) ?? 0;
	return { choices, viewport: moveTo(Viewport.init(choices.length, height), first), submitted: false };
};

const step = <A>(state: SelectState<A>, action: SelectAction): SelectState<A> => {
	const { choices, viewport } = state;
	if (action === "cancel") return state;
	if (action === "submit") return enabled(choices, viewport.cursor) ? { ...state, submitted: true } : state;
	const last = choices.length - 1;
	const paged = Viewport.step(viewport, action).cursor;
	// Each move lands on the nearest enabled choice in its direction; with none in reach it stays put.
	const target =
		action === "up"
			? nearest(choices, viewport.cursor - 1, -1)
			: action === "down"
				? nearest(choices, viewport.cursor + 1, 1)
				: action === "home"
					? nearest(choices, 0, 1)
					: action === "end"
						? nearest(choices, last, -1)
						: action === "pageup"
							? (nearest(choices, paged, -1) ?? nearest(choices, paged, 1))
							: (nearest(choices, paged, 1) ?? nearest(choices, paged, -1));
	return target === undefined ? state : { ...state, viewport: moveTo(viewport, target) };
};

/** ↑/↓ shown; the page, home and end moves bound but hidden, so the help line fits 80 columns. */
const KEYS: KeyTable<SelectAction> = KeyTable.make<SelectAction>([
	{ keys: ["up"], action: "up", help: "move" },
	{ keys: ["down"], action: "down", help: "move" },
	{ keys: ["pageup"], action: "pageup", help: "page", hidden: true },
	{ keys: ["pagedown"], action: "pagedown", help: "page", hidden: true },
	{ keys: ["home"], action: "home", help: "top", hidden: true },
	{ keys: ["end"], action: "end", help: "bottom", hidden: true },
	{ keys: ["enter"], action: "submit", help: "choose" },
	{ keys: [{ char: "q" }], action: "cancel", help: "cancel" },
]);

/** The text mark a disabled row carries at colour `none`, where the muted token paints nothing. */
const DISABLED = " (disabled)";

/** Lines around the list: the message above, the detail and the help line below. */
const RESERVED = 3;

/**
 * A single choice from a list: a pure reducer, its key table, a view, and a ready-made screen.
 *
 * @remarks
 * A select with no enabled choice is a programming error: `init` throws, and `screen` dies, saying so.
 *
 * @example
 * ```ts
 * import { CliUi, Select } from "../ui.ts"
 * import * as Effect from "effect/Effect";
 *
 * const pickTarget = Effect.gen(function* () {
 * 	const target = yield* CliUi.run(
 * 		Select.screen({
 * 			message: "Deploy to which environment?",
 * 			choices: [
 * 				{ label: "staging", value: "staging" },
 * 				{ label: "production", value: "production", detail: "Needs approval" },
 * 			],
 * 		}),
 * 	)
 * 	return target
 * })
 * ```
 *
 * @public
 */
export class Select {
	private constructor() {}

	/**
	 * A select over `choices`, on the first enabled choice at or after `initial` (the nearest enabled one before it
	 * when none follows).
	 *
	 * @param choices - the choices
	 * @param options - the starting choice and the list height
	 */
	static readonly init: <A>(choices: ReadonlyArray<SelectChoice<A>>, options?: SelectInitOptions) => SelectState<A> =
		init;

	/**
	 * Apply an action: a move lands on the nearest enabled choice, never on a disabled one and never past either
	 * end; `"submit"` marks the highlighted choice chosen (a disabled one never is); `"cancel"` changes nothing here,
	 * because ending the screen is the view's job.
	 *
	 * @param state - where the select is
	 * @param action - the action
	 */
	static readonly step: <A>(state: SelectState<A>, action: SelectAction) => SelectState<A> = step;

	/**
	 * The submitted value, or `None` before a submit.
	 *
	 * @param state - where the select is
	 */
	static readonly chosen = <A>(state: SelectState<A>): O.Option<A> => {
		const choice = state.choices[state.viewport.cursor];
		return state.submitted && choice !== undefined ? O.some(choice.value) : O.none();
	};

	/** The keys: the viewport's moves, enter choose, q cancel. */
	static readonly keys: KeyTable<SelectAction> = KEYS;

	/**
	 * Draw the select: the message, the list (the highlighted row in the accent token with the arrow glyph, disabled
	 * rows muted, and at colour `none` ending in ` (disabled)` instead, every row cut to the width with the glyph set's
	 * ellipsis), the highlighted choice's detail, and the
	 * key help.
	 *
	 * @remarks
	 * A choice's `detail` is drawn only while that choice is highlighted, as one muted line under the list, so the others'
	 * details are not on screen until the cursor reaches them. Enter calls `onSubmit` with the value; `q` cancels the screen with `"escape"`.
	 *
	 * Single-shot: the choices and the starting choice are read once, when the view mounts, and later changes to them
	 * are ignored; after a submit it stays as it is. Render a new view (a new screen) to ask again.
	 *
	 * @param props - the message, the choices, and where the chosen value goes
	 */
	static readonly View = <A>(props: SelectViewProps<A>): ReactElement => {
		const { ink, react } = inkModules();
		const glyphs = useGlyphs();
		const theme = useTheme();
		const { columns } = useTerminalSize();
		const cancel = useScreenCancel();
		const [state, setState] = react.useState(() =>
			init(props.choices, {
				...O.getSomesStruct({ initial: O.fromUndefinedOr(props.initial) }),
				...O.getSomesStruct({ height: O.fromUndefinedOr(props.height) }),
			}),
		);
		const submitted = state.submitted;
		const { onSubmit } = props;
		// Deliberately keyed on `submitted` alone: the effect runs in the render where it flipped, whose closure
		// already holds that render's state and onSubmit, so listing them would only re-run it with nothing new to do.
		react.useEffect(() => {
			const choice = state.choices[state.viewport.cursor];
			if (submitted && choice !== undefined) onSubmit(choice.value);
		}, [submitted]);
		useKeys(KEYS, (action) => {
			if (action === "cancel") cancel("escape");
			else setState((current) => step(current, action));
		});
		const rows: ReadonlyArray<ViewportRow> = props.choices.map((_, index) => ({ _tag: "Item", key: String(index) }));
		const blank = " ".repeat(Fmt.width(glyphs.arrow));
		const renderRow = (row: ViewportRow, highlighted: boolean): ReactElement => {
			const choice = row._tag === "Item" ? props.choices[Number(row.key)] : undefined;
			const line = `${highlighted ? glyphs.arrow : blank} ${lineText(choice?.label ?? "")}`;
			// At colour none the muted token paints nothing, so a disabled row says so in text; the label is cut, never the mark.
			const marked = choice?.disabled === true && theme.color === "none";
			const text = marked
				? `${Fmt.truncate(line, Math.max(0, columns - Fmt.width(DISABLED)), { ellipsis: glyphs.ellipsis })}${DISABLED}`
				: Fmt.truncate(line, columns, { ellipsis: glyphs.ellipsis });
			if (highlighted) return react.createElement(Styled, { token: "accent" }, text);
			if (choice?.disabled === true) return react.createElement(Styled, { token: "muted" }, text);
			return react.createElement(ink.Text, null, text);
		};
		const detail = props.choices[state.viewport.cursor]?.detail;
		return react.createElement(
			ink.Box,
			{ flexDirection: "column" },
			react.createElement(
				Styled,
				{ token: "emphasis" },
				Fmt.truncate(lineText(props.message), columns, { ellipsis: glyphs.ellipsis }),
			),
			react.createElement(Viewport.View, { rows, state: state.viewport, renderRow, reserved: RESERVED }),
			detail === undefined
				? null
				: react.createElement(
						Styled,
						{ token: "muted" },
						Fmt.truncate(lineText(detail), columns, { ellipsis: glyphs.ellipsis }),
					),
			react.createElement(KeyHelp, { tables: [KEYS] }),
		);
	};

	/**
	 * A ready-made screen for `CliUi.run`: the select, resolving with the chosen value.
	 *
	 * @param options - the message, the choices, the starting choice and the list height
	 */
	static readonly screen =
		<A>(options: SelectScreenOptions<A>): Screen<A> =>
		(control) => {
			// Checked before mounting, so a screen with nothing to choose dies rather than drawing an empty list.
			if (!options.choices.some((choice) => choice.disabled !== true)) throw new Error(NO_ENABLED_CHOICE);
			return inkModules().react.createElement(Select.View<A>, { ...options, onSubmit: control.resolve });
		};
}
