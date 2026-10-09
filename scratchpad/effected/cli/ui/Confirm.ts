import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import type { Screen } from "./CliUi.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { useScreenCancel } from "./internal/ScreenContext.ts";
import { KeyHelp } from "./KeyHelp.ts";
import { KeyTable, useKeys } from "./KeyTable.ts";
import { Toggle } from "./Toggle.ts";
import { Styled, useGlyphs, useTerminalSize } from "./UiTheme.ts";
import type { ViewportRow } from "./Viewport.ts";
import { Viewport } from "./Viewport.ts";

/**
 * An extra on/off row a {@link Confirm} hosts beneath its yes/no answer.
 *
 * @public
 */
export interface ConfirmToggle<K extends string> {
	/** Names the toggle in the result. */
	readonly key: K;
	/** What the row shows. */
	readonly label: string;
	/** Whether it starts on. */
	readonly value: boolean;
}

/**
 * What a {@link Confirm} resolves with: the answer, and every toggle by key.
 *
 * @public
 */
export interface ConfirmResult<K extends string> {
	/** Yes or no. */
	readonly confirmed: boolean;
	/**
	 * Each toggle's final value, by its key. Partial, because a toggle passed conditionally may be absent: read one
	 * with a fallback, `toggles.promote ?? false`.
	 */
	readonly toggles: Readonly<Partial<Record<K, boolean>>>;
}

/**
 * Where a {@link Confirm} is.
 *
 * @public
 */
export interface ConfirmState<K extends string> {
	/** The answer. */
	readonly confirmed: boolean;
	/** The highlighted row: 0 is the yes/no row, each toggle follows. */
	readonly row: number;
	/** The toggles and their current values. */
	readonly toggles: ReadonlyArray<ConfirmToggle<K>>;
	/** Whether enter was pressed. */
	readonly submitted: boolean;
}

/**
 * What a key does in a {@link Confirm}.
 *
 * @public
 */
export type ConfirmAction = "up" | "down" | "toggle" | "yes" | "no" | "flip" | "submit" | "cancel";

/**
 * Options for {@link Confirm.init}.
 *
 * @public
 */
export interface ConfirmInitOptions<K extends string> {
	/** The starting answer; no (`false`) by default. */
	readonly initial?: boolean;
	/** Extra on/off rows, with unique keys. */
	readonly toggles?: ReadonlyArray<ConfirmToggle<K>>;
}

/**
 * Options for {@link Confirm.screen}.
 *
 * @public
 */
export interface ConfirmScreenOptions<K extends string> extends ConfirmInitOptions<K> {
	/** The question. */
	readonly message: string;
}

/**
 * Props of {@link Confirm.View}.
 *
 * @public
 */
export interface ConfirmViewProps<K extends string> extends ConfirmScreenOptions<K> {
	/** Receives the answer and the toggles when enter is pressed. */
	readonly onSubmit: (result: ConfirmResult<K>) => void;
}

const assertUniqueKeys = <K extends string>(toggles: ReadonlyArray<ConfirmToggle<K>>): void => {
	const seen = new Set<string>();
	for (const toggle of toggles) {
		if (seen.has(toggle.key)) {
			throw new Error(`@effected/cli/ui: Confirm toggle keys must be unique; "${toggle.key}" repeats`);
		}
		seen.add(toggle.key);
	}
};

const init = <K extends string>(options: ConfirmInitOptions<K> = {}): ConfirmState<K> => {
	const toggles = options.toggles ?? [];
	assertUniqueKeys(toggles);
	return { confirmed: options.initial ?? false, row: 0, toggles, submitted: false };
};

const step = <K extends string>(state: ConfirmState<K>, action: ConfirmAction): ConfirmState<K> => {
	switch (action) {
		case "up":
			return { ...state, row: Math.max(0, state.row - 1) };
		case "down":
			return { ...state, row: Math.min(state.toggles.length, state.row + 1) };
		case "toggle":
			// Space flips only a toggle row; on the yes/no row it changes nothing.
			return state.row === 0
				? state
				: {
						...state,
						toggles: state.toggles.map((toggle, index) =>
							index === state.row - 1 ? { ...toggle, value: !toggle.value } : toggle,
						),
					};
		case "yes":
			return { ...state, confirmed: true };
		case "no":
			return { ...state, confirmed: false };
		case "flip":
			return { ...state, confirmed: !state.confirmed };
		case "submit":
			return { ...state, submitted: true };
		case "cancel":
			return state;
	}
};

const result = <K extends string>(state: ConfirmState<K>): ConfirmResult<K> => {
	const toggles: Partial<Record<K, boolean>> = {};
	for (const toggle of state.toggles) {
		Object.defineProperty(toggles, toggle.key, { value: toggle.value, enumerable: true, configurable: true, writable: true });
	}
	return { confirmed: state.confirmed, toggles };
};

/** The bindings; with no toggles the row and toggle keys stay bound (they do nothing) but leave the help line. */
const bindings = (toggles: boolean): KeyTable<ConfirmAction> =>
	KeyTable.make<ConfirmAction>([
		{ keys: [{ char: "y" }], action: "yes", help: "yes" },
		{ keys: [{ char: "n" }], action: "no", help: "no" },
		{ keys: ["left"], action: "flip", help: "flip" },
		{ keys: ["right"], action: "flip", help: "flip" },
		{ keys: ["up"], action: "up", help: "row", hidden: !toggles },
		{ keys: ["down"], action: "down", help: "row", hidden: !toggles },
		{ keys: ["space"], action: "toggle", help: "toggle", hidden: !toggles },
		{ keys: ["enter"], action: "submit", help: "submit" },
		{ keys: [{ char: "q" }], action: "cancel", help: "cancel" },
	]);

const KEYS = bindings(true);
const ANSWER_KEYS = bindings(false);

/** The lines around the toggle rows: the question, the answer row and the help line. */
const RESERVED = 3;

/**
 * A yes/no question, optionally with extra on/off rows beneath it: a pure reducer, its key table, a view and a
 * ready-made screen.
 *
 * @remarks
 * The rows are the yes/no row first, then each toggle. `y` and `n` set the answer and `←`/`→` flip it, from any
 * row; `↑`/`↓` move between rows; space flips the highlighted toggle and does nothing on the yes/no row; enter
 * submits; `q` cancels with `"escape"`. Toggle keys must be unique; `init` throws, and `screen` dies, on a repeat.
 * With no toggles, the help line leaves out the row and toggle keys. Toggles that do not fit the terminal scroll
 * in a window under the answer row, so the question, the answer and the help line stay on screen.
 * The answer starts as no unless `initial` says otherwise, and `←`/`→` flip it whichever row is highlighted.
 *
 * A toggle passed conditionally is absent from the result when it was left out, so read it back with a fallback:
 *
 * ```ts
 * import { CliUi, Confirm } from "../ui.ts"
 * import { Effect } from "effect"
 *
 * const publish = (drafts: number) =>
 *   Effect.gen(function* () {
 *     const { confirmed, toggles } = yield* CliUi.run(
 *       Confirm.screen({
 *         message: "Publish the release?",
 *         toggles: drafts > 0 ? [{ key: "promote", label: `promote ${drafts} drafts to stable`, value: true }] : [],
 *       }),
 *     )
 *     const promote = toggles.promote ?? false
 *     return { confirmed, promote }
 *   })
 * ```
 *
 * @public
 */
export class Confirm {
	private constructor() {}

	/**
	 * A confirm with its answer (no by default) and toggles, on the yes/no row.
	 *
	 * @param options - the starting answer and the toggles
	 */
	static readonly init: <K extends string>(options?: ConfirmInitOptions<K>) => ConfirmState<K> = init;

	/**
	 * Apply an action (see the class remarks for what each key does).
	 *
	 * @param state - where the confirm is
	 * @param action - the action
	 */
	static readonly step: <K extends string>(state: ConfirmState<K>, action: ConfirmAction) => ConfirmState<K> = step;

	/**
	 * The answer and every toggle's value by key.
	 *
	 * @param state - where the confirm is
	 */
	static readonly result: <K extends string>(state: ConfirmState<K>) => ConfirmResult<K> = result;

	/** The keys: y yes, n no, ←/→ flip, ↑/↓ row, space toggle, enter submit, q cancel (the view hides row and toggle from its help when there are no toggles). */
	static readonly keys: KeyTable<ConfirmAction> = KEYS;

	/**
	 * Draw the confirm: the question, the answer row (`[Yes]  No` or ` Yes  [No]`, the chosen answer in brackets so it
	 * shows without colour, and in the accent token), a {@link Toggle} row per toggle, and the key help.
	 *
	 * @remarks
	 * Single-shot, like `Select.View`: the options are read once at mount.
	 *
	 * @param props - the question, the starting answer, the toggles and where the result goes
	 */
	static readonly View = <K extends string>(props: ConfirmViewProps<K>): ReactElement => {
		const { ink, react } = inkModules();
		const glyphs = useGlyphs();
		const { columns } = useTerminalSize();
		const cancel = useScreenCancel();
		const [state, setState] = react.useState(() =>
			init<K>({
				...(props.initial === undefined ? {} : { initial: props.initial }),
				...(props.toggles === undefined ? {} : { toggles: props.toggles }),
			}),
		);
		const { onSubmit } = props;
		// Deliberately keyed on `submitted` alone: the effect runs in the render where it flipped, whose closure
		// already holds that render's state and onSubmit.
		react.useEffect(() => {
			if (state.submitted) onSubmit(result(state));
		}, [state.submitted]);
		const keys = state.toggles.length === 0 ? ANSWER_KEYS : KEYS;
		useKeys(keys, (action) => {
			if (action === "cancel") cancel("escape");
			else setState((current) => step(current, action));
		});
		const toggleRows: ReadonlyArray<ViewportRow> = state.toggles.map((toggle) => ({ _tag: "Item", key: toggle.key }));
		const numberOf: ReadonlyMap<string, number> = new Map(state.toggles.map((toggle, index) => [toggle.key, index]));
		const ellipsis = { ellipsis: glyphs.ellipsis };
		const lead = state.row === 0 ? glyphs.arrow : " ".repeat(Fmt.width(glyphs.arrow));
		const answer = (label: string, chosen: boolean): ReactElement =>
			chosen
				? react.createElement(Styled, { token: "accent" }, `[${label}]`)
				: react.createElement(ink.Text, null, ` ${label} `);
		return react.createElement(
			ink.Box,
			{ flexDirection: "column" },
			react.createElement(Styled, { token: "emphasis" }, Fmt.truncate(lineText(props.message), columns, ellipsis)),
			react.createElement(
				ink.Text,
				null,
				`${lead} `,
				answer("Yes", state.confirmed),
				" ",
				answer("No", !state.confirmed),
			),
			state.toggles.length === 0
				? null
				: react.createElement(Viewport.View, {
						rows: toggleRows,
						// A fresh state each render is safe: the window's position is not in this state but in Viewport.View's
						// own sticky ref, which starts where the window last started and moves only as far as the cursor
						// needs. This state carries only the cursor and the counts, both derived from Confirm's own row.
						state: Viewport.init(state.toggles.length, state.toggles.length, Math.max(0, state.row - 1)),
						reserved: RESERVED,
						renderRow: (row: ViewportRow) => {
							const index = row._tag === "Item" ? (numberOf.get(row.key) ?? 0) : 0;
							const toggle = state.toggles[index];
							return react.createElement(Toggle.View, {
								label: toggle?.label ?? "",
								value: toggle?.value ?? false,
								highlighted: state.row === index + 1,
							});
						},
					}),
			react.createElement(KeyHelp, { tables: [keys] }),
		);
	};

	/**
	 * A ready-made screen for `CliUi.run`: the confirm, resolving with the answer and the toggles.
	 *
	 * @param options - the question, the starting answer and the toggles
	 */
	static readonly screen =
		<K extends string>(options: ConfirmScreenOptions<K>): Screen<ConfirmResult<K>> =>
		(control) => {
			// Checked before mounting, so a repeated toggle key dies rather than drawing an ambiguous screen.
			assertUniqueKeys(options.toggles ?? []);
			return inkModules().react.createElement(Confirm.View<K>, { ...options, onSubmit: control.resolve });
		};
}
