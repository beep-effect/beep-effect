import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import type { Screen } from "./CliUi.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { useScreenCancel } from "./internal/ScreenContext.ts";
import { KeyHelp } from "./KeyHelp.ts";
import { KeyTable, useKeys } from "./KeyTable.ts";
import { Styled, useGlyphs, useTerminalSize } from "./UiTheme.ts";
import type { ViewportRow } from "./Viewport.ts";
import { Viewport, ViewportState } from "./Viewport.ts";

const $I = $ScratchpadId.create("effected/cli/ui/MultiSelect");

/**
 * Reports an item key repeated across multi-select sections.
 *
 * **Example** (Describe the failure)
 *
 * ```ts
 * import { DuplicateItemKey } from "./MultiSelect.ts"
 * const error = DuplicateItemKey.make({ message: "Item key alpha repeats." })
 * console.log(error._tag) // DuplicateItemKey
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class DuplicateItemKey extends S.TaggedError<DuplicateItemKey>($I`DuplicateItemKey`)(
	"DuplicateItemKey",
	{ message: S.String.annotate($I.annote("DuplicateItemKey.message", {
		description: "Identifies the item key repeated across multi-select sections.",
	})) },
	$I.annote("DuplicateItemKey", { description: "Two multi-select items share a row key." }),
) {
	override readonly name = "Error";
}

/**
 * One item of a {@link MultiSelect} section, as a schema over the value schema: `key` identifies the item (unique
 * across sections), `label` is what the row shows, `value` what selecting it returns, `detail` a line shown muted
 * beneath the list while it is highlighted, and `selected` whether it starts selected.
 *
 * **Example** (Validate an item payload)
 *
 * ```ts
 * import { MultiSelectItem } from "@beep/scratchpad/effected/cli/ui/MultiSelect"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MultiSelectItem(S.String))({ key: "lint", label: "Linting", value: "lint", selected: true })) // true
 * ```
 *
 * @param value - the schema of the value selecting it returns
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MultiSelectItem = <Value extends S.Top>(value: Value) =>
	S.Struct({
		key: S.String.annotateKey($I.annote("MultiSelectItem.key", { description: "Identifies the item; unique across sections." })),
		label: S.String.annotateKey($I.annote("MultiSelectItem.label", { description: "What the row shows." })),
		value,
		detail: S.optionalKey(S.String).annotateKey($I.annote("MultiSelectItem.detail", {
			description: "A line shown, muted, beneath the list while this item is highlighted.",
		})),
		selected: S.optionalKey(S.Boolean).annotateKey($I.annote("MultiSelectItem.selected", {
			description: "Whether it starts selected.",
		})),
	}).annotate($I.annote("MultiSelectItem", { description: "One keyed, labelled item of a multi-selection section." }));

/**
 * Plain payload accepted by {@link MultiSelectItem}; reducers retain this structural representation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MultiSelectItem<A> = ReturnType<typeof MultiSelectItem<S.Codec<A>>>["Type"];

/**
 * A titled group of items, as a schema over the value schema; the title is a header the cursor never stops on.
 *
 * **Example** (Validate a section payload)
 *
 * ```ts
 * import { MultiSelectSection } from "@beep/scratchpad/effected/cli/ui/MultiSelect"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MultiSelectSection(S.String))({ title: "Tools", items: [] })) // true
 * ```
 *
 * @param value - the schema of the items' values
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MultiSelectSection = <Value extends S.Top>(value: Value) =>
	S.Struct({
		title: S.String.annotateKey($I.annote("MultiSelectSection.title", { description: "The header." })),
		items: value.pipe(MultiSelectItem, S.Array).annotateKey($I.annote("MultiSelectSection.items", {
			description: "The items, in order.",
		})),
	}).annotate($I.annote("MultiSelectSection", { description: "A titled group of multi-selection items." }));

/**
 * Plain payload accepted by {@link MultiSelectSection}; reducers retain this structural representation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MultiSelectSection<A> = ReturnType<typeof MultiSelectSection<S.Codec<A>>>["Type"];

/**
 * Where a {@link MultiSelect} is, as a schema over the value schema: its sections, which items are selected, the
 * viewport over the items, and whether it was submitted.
 *
 * **Details**
 *
 * Items are numbered across sections in order, section by section; `chosen` holds those numbers. The viewport counts
 * items only, never headers.
 *
 * **Example** (Validate a multi-selection state)
 *
 * ```ts
 * import { MultiSelect, MultiSelectState } from "@beep/scratchpad/effected/cli/ui/MultiSelect"
 * import * as S from "effect/Schema"
 *
 * const state = MultiSelect.init([{ title: "Tools", items: [{ key: "lint", label: "Linting", value: "lint" }] }])
 * console.log(S.is(MultiSelectState(S.String))(state)) // true
 * ```
 *
 * @param value - the schema of the items' values
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MultiSelectState = <Value extends S.Top>(value: Value) =>
	S.Struct({
		sections: value.pipe(MultiSelectSection, S.Array).annotateKey($I.annote("MultiSelectState.sections", {
			description: "The sections.",
		})),
		chosen: S.HashSet(S.Finite).annotateKey($I.annote("MultiSelectState.chosen", {
			description: "The selected items, by their number across all sections.",
		})),
		viewport: ViewportState.annotateKey($I.annote("MultiSelectState.viewport", {
			description: "The highlighted item and the window over the list; it counts items only, never headers.",
		})),
		submitted: S.Boolean.annotateKey($I.annote("MultiSelectState.submitted", { description: "Whether enter was pressed." })),
	}).annotate($I.annote("MultiSelectState", { description: "The plain reducer state of a sectioned multi-selection." }));

/**
 * Plain payload accepted by {@link MultiSelectState}; reducers retain this structural representation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MultiSelectState<A> = ReturnType<typeof MultiSelectState<S.Codec<A>>>["Type"];

/**
 * What a key does in a {@link MultiSelect}.
 *
 * **Example** (Recognize a submission action)
 *
 * ```ts
 * import { MultiSelectAction } from "@beep/scratchpad/effected/cli/ui/MultiSelect"
 * import * as S from "effect/Schema"
 * console.log(S.is(MultiSelectAction)("submit")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MultiSelectAction = LiteralKit([
	"up", "down", "home", "end", "pageup", "pagedown", "toggle", "toggleSection", "submit", "cancel",
]).annotate(
	$I.annote("MultiSelectAction", { description: "The viewport, item, section and submission actions of a multi-selection." }),
);

/**
 * A viewport or interaction action accepted by {@link MultiSelectAction}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MultiSelectAction = typeof MultiSelectAction.Type;

/**
 * Options for {@link MultiSelect.init}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface MultiSelectInitOptions {
	/** How many rows the list shows at most; the terminal height also limits it. 10 by default. */
	readonly height?: number;
}

/**
 * Options for {@link MultiSelect.screen}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface MultiSelectScreenOptions<A> {
	/** The question, shown above the list. */
	readonly message: string;
	/** The sections. */
	readonly sections: ReadonlyArray<MultiSelectSection<A>>;
	/** How many rows the list shows at most. */
	readonly height?: number;
}

/**
 * Props of {@link MultiSelect.View}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface MultiSelectViewProps<A> extends MultiSelectScreenOptions<A> {
	/** Receives the selected values, in section then item order, when enter is pressed. */
	readonly onSubmit: (values: ReadonlyArray<A>) => void;
}

/** Every item with its section's index, numbered across sections in order. */
const flatten = <A>(
	sections: ReadonlyArray<MultiSelectSection<A>>,
): ReadonlyArray<{ readonly section: number; readonly item: MultiSelectItem<A> }> =>
	sections.flatMap((section, index) => section.items.map((item) => ({ section: index, item })));

/** Throws when two items, in any sections, share a key: keys identify rows. */
const assertUniqueKeys = <A>(sections: ReadonlyArray<MultiSelectSection<A>>): void => {
	const seen = MutableHashSet.empty<string>();
	for (const { item } of flatten(sections)) {
		if (MutableHashSet.has(seen, item.key)) {
			throw DuplicateItemKey.make({ message: `@effected/cli/ui: MultiSelect item keys must be unique across sections; "${item.key}" repeats` });
		}
		MutableHashSet.add(seen, item.key);
	}
};

const init = <A>(
	sections: ReadonlyArray<MultiSelectSection<A>>,
	options: MultiSelectInitOptions = {},
): MultiSelectState<A> => {
	assertUniqueKeys(sections);
	const items = flatten(sections);
	const chosen = HashSet.fromIterable(items.flatMap((entry, index) => (entry.item.selected === true ? [index] : [])));
	return { sections, chosen, viewport: Viewport.init(items.length, options.height ?? 10), submitted: false };
};

const step = <A>(state: MultiSelectState<A>, action: MultiSelectAction): MultiSelectState<A> => {
	if (state.submitted) return state;
	const items = flatten(state.sections);
	const cursor = state.viewport.cursor;
	return Match.value(action).pipe(
		Match.when("cancel", () => state),
		Match.when("submit", () => ({ ...state, submitted: true })),
		Match.when("toggle", () => {
			if (items.length === 0) return state;
			const chosen = HashSet.has(state.chosen, cursor)
				? HashSet.remove(state.chosen, cursor)
				: HashSet.add(state.chosen, cursor);
			return { ...state, chosen };
		}),
		Match.when("toggleSection", () => {
			const section = items[cursor]?.section;
			if (section === undefined) return state;
			const members = items.flatMap((entry, index) => (entry.section === section ? [index] : []));
			// Any unselected member selects the whole section; a fully selected section is cleared.
			const fill = members.some((index) => !HashSet.has(state.chosen, index));
			const chosen = A.reduce(members, state.chosen, fill ? HashSet.add<number> : HashSet.remove<number>);
			return { ...state, chosen };
		}),
		Match.orElse((move) => ({ ...state, viewport: Viewport.step(state.viewport, move) })),
	);
};

const selected = <A>(state: MultiSelectState<A>): ReadonlyArray<A> =>
	flatten(state.sections).flatMap((entry, index) => (HashSet.has(state.chosen, index) ? [entry.item.value] : []));

/** ↑/↓ shown; the page, home and end moves bound but hidden, so the line names space, a, enter and esc at 80 columns. */
const KEYS: KeyTable<MultiSelectAction> = KeyTable.make<MultiSelectAction>([
	{ keys: ["up"], action: "up", help: "move" },
	{ keys: ["down"], action: "down", help: "move" },
	{ keys: ["pageup"], action: "pageup", help: "page", hidden: true },
	{ keys: ["pagedown"], action: "pagedown", help: "page", hidden: true },
	{ keys: ["home"], action: "home", help: "top", hidden: true },
	{ keys: ["end"], action: "end", help: "bottom", hidden: true },
	{ keys: ["space"], action: "toggle", help: "toggle" },
	{ keys: [{ char: "a" }], action: "toggleSection", help: "toggle section" },
	{ keys: ["enter"], action: "submit", help: "continue" },
	{ keys: [{ char: "q" }], action: "cancel", help: "cancel" },
]);

/** Lines around the list: the message above, the detail and the help line below. */
const RESERVED = 3;

/**
 * Several choices from sectioned lists: a pure reducer, its key table, a view and a ready-made screen.
 *
 * **Details**
 *
 * Item keys must be unique across all sections; `init` throws, and `screen` dies, on a repeat.
 *
 * The cursor moves over items only; section titles are headers drawn by the viewport, which keeps a scrolled-off
 * header visible. Submitting with nothing selected resolves an empty list, which is a result, not a cancel.
 *
 * **Example** (Select features from a sectioned list)
 *
 * ```ts
 * import { CliUi } from "@beep/scratchpad/effected/cli/ui/CliUi"
 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect"
 * import * as Effect from "effect/Effect";
 *
 * const pickFeatures = Effect.gen(function* () {
 * 	const features = yield* CliUi.run(
 * 		MultiSelect.screen({
 * 			message: "Which features?",
 * 			sections: [
 * 				{
 * 					title: "Tooling",
 * 					items: [
 * 						{ key: "lint", label: "Linting", value: "lint", selected: true },
 * 						{ key: "test", label: "Tests", value: "test" },
 * 					],
 * 				},
 * 			],
 * 		}),
 * 	)
 * 	return features
 * })
 * console.log(Effect.isEffect(pickFeatures)) // true
 * ```
 *
 * @public
 * @category components
 * @since 0.0.0
 */
export abstract class MultiSelect {

	/**
	 * A multi-select over `sections`, each item starting as its own `selected` flag says, on the first item.
	 *
	 * **Example** (Start with a selected item)
	 *
	 * ```ts
	 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect";
	 *
	 * const state = MultiSelect.init([{ title: "Tools", items: [{ key: "lint", label: "Linting", value: "lint", selected: true }] }]);
	 * console.log(MultiSelect.selected(state).join(",")) // lint
	 * ```
	 *
	 * @param sections - the sections
	 * @param options - the list height
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly init: <A>(
		sections: ReadonlyArray<MultiSelectSection<A>>,
		options?: MultiSelectInitOptions,
	) => MultiSelectState<A> = init;

	/**
	 * Apply an action: a viewport move over the items; `"toggle"` flips the highlighted item; `"toggleSection"`
	 * selects every item of the highlighted item's section while any is unselected, and clears them all otherwise;
	 * `"submit"` marks it submitted; `"cancel"` changes nothing here, because ending the screen is the view's job.
	 *
	 * **Example** (Toggle every item in a section)
	 *
	 * ```ts
	 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect";
	 *
	 * const state = MultiSelect.init([{ title: "Tools", items: [{ key: "lint", label: "Linting", value: "lint" }] }]);
	 * const toggled = MultiSelect.step(state, "toggleSection");
	 * console.log(MultiSelect.selected(toggled).join(",")) // lint
	 * ```
	 *
	 * @param state - where the multi-select is
	 * @param action - the action
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly step: <A>(state: MultiSelectState<A>, action: MultiSelectAction) => MultiSelectState<A> = step;

	/**
	 * The selected values, in section order and then item order, however they were toggled.
	 *
	 * **Example** (Read selected values in item order)
	 *
	 * ```ts
	 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect";
	 *
	 * const state = MultiSelect.init([{ title: "Tools", items: [{ key: "lint", label: "Linting", value: "lint", selected: true }, { key: "test", label: "Tests", value: "test", selected: true }] }]);
	 * console.log(MultiSelect.selected(state).join(",")) // lint,test
	 * ```
	 *
	 * @param state - where the multi-select is
	 * @category getters
	 * @since 0.0.0
	 */
	static readonly selected: <A>(state: MultiSelectState<A>) => ReadonlyArray<A> = selected;

	/**
	 *  The keys: ↑/↓ move (page, home and end too), space toggle, a toggle section, enter continue, q cancel.
	 *
	 * **Example** (Inspect the upward movement binding)
	 *
	 * ```ts
	 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect";
	 *
	 * console.log(MultiSelect.keys.bindings[0]?.action) // up
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly keys: KeyTable<MultiSelectAction> = KEYS;

	/**
	 * Draw the multi-select: the message, the sections (each item a check glyph, `◉`/`◯` or `[x]`/`[ ]` under ASCII,
	 * then its label cut to the width; the highlighted one in the accent token with the arrow glyph), the highlighted
	 * item's detail, and the key help. Enter calls `onSubmit` with the selected values; `q` cancels with `"escape"`.
	 *
	 * **Details**
	 *
	 * Single-shot, like `Select.View`: the sections are read once at mount.
	 *
	 * **Example** (Compose a multi-select view)
	 *
	 * ```ts
	 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect";
	 * import { createElement } from "react";
	 *
	 * const element = createElement(MultiSelect.View<string>, { message: "Which features?", sections: [], onSubmit: (values) => console.log(values) });
	 * console.log(element.type === MultiSelect.View) // true
	 * ```
	 *
	 * @param props - the message, the sections, and where the selection goes
	 * @category components
	 * @since 0.0.0
	 */
	static readonly View = <A>(props: MultiSelectViewProps<A>): ReactElement => {
		const { ink, react } = inkModules();
		const glyphs = useGlyphs();
		const { columns } = useTerminalSize();
		const cancel = useScreenCancel();
		const [state, setState] = react.useState(() =>
			init(props.sections, props.height === undefined ? {} : { height: props.height }),
		);
		const { onSubmit } = props;
		// Deliberately keyed on `submitted` alone: the effect runs in the render where it flipped, whose closure
		// already holds that render's state and onSubmit.
		react.useEffect(() => {
			if (state.submitted) onSubmit(selected(state));
		}, [state.submitted]);
		useKeys(KEYS, (action) => {
			if (action === "cancel") cancel("escape");
			else setState((current) => step(current, action));
		});
		const items = flatten(state.sections);
		// Rows are keyed by the item's own key (unique, checked at init), which is also the React key of the row.
		const numberOf = MutableHashMap.fromIterable(items.map((entry, index) => [entry.item.key, index] as const));
		const rows: ReadonlyArray<ViewportRow> = state.sections.flatMap((section) => [
			{ _tag: "Header" as const, label: section.title },
			...section.items.map((item) => ({ _tag: "Item" as const, key: item.key })),
		]);
		const on = glyphs.kind === "unicode" ? "◉" : "[x]";
		const off = glyphs.kind === "unicode" ? "◯" : "[ ]";
		const blank = " ".repeat(Fmt.width(glyphs.arrow));
		const ellipsis = { ellipsis: glyphs.ellipsis };
		const renderRow = (row: ViewportRow, highlighted: boolean): ReactElement => {
			if (row._tag === "Header")
				return react.createElement(Styled, { token: "emphasis" }, Fmt.truncate(lineText(row.label), columns, ellipsis));
			const index = O.getOrThrow(MutableHashMap.get(numberOf, row.key));
			const entry = A.getUnsafe(items, index);
			const text = Fmt.truncate(
				`${highlighted ? glyphs.arrow : blank} ${HashSet.has(state.chosen, index) ? on : off} ${lineText(entry.item.label)}`,
				columns,
				ellipsis,
			);
			return highlighted
				? react.createElement(Styled, { token: "accent" }, text)
				: react.createElement(ink.Text, null, text);
		};
		const detail = items[state.viewport.cursor]?.item.detail;
		// One row each, clipped at layout time with the cursor column reserved: during Ink's immediate resize repaint the
		// width above is one paint stale, and an unclipped row would wrap past the screen's row budget.
		const line = (child: ReactElement): ReactElement =>
			react.createElement(ink.Box, { height: 1, overflow: "hidden", marginRight: 1 }, child);
		return react.createElement(
			ink.Box,
			{ flexDirection: "column" },
			line(react.createElement(Styled, { token: "emphasis" }, Fmt.truncate(lineText(props.message), columns, ellipsis))),
			react.createElement(Viewport.View, { rows, state: state.viewport, renderRow, reserved: RESERVED }),
			detail === undefined
				? null
				: line(react.createElement(Styled, { token: "muted" }, Fmt.truncate(lineText(detail), columns, ellipsis))),
			line(react.createElement(KeyHelp, { tables: [KEYS] })),
		);
	};

	/**
	 * A ready-made screen for `CliUi.run`: the multi-select, resolving with the selected values (`[]` when none are).
	 *
	 * **Example** (Construct a features screen)
	 *
	 * ```ts
	 * import { MultiSelect } from "@beep/scratchpad/effected/cli/ui/MultiSelect";
	 *
	 * const screen = MultiSelect.screen({ message: "Which features?", sections: [] });
	 * console.log(typeof screen) // function
	 * ```
	 *
	 * @param options - the message, the sections and the list height
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly screen =
		<A>(options: MultiSelectScreenOptions<A>): Screen<ReadonlyArray<A>> =>
		(control) => {
			// Checked before mounting, so a repeated key dies rather than drawing an ambiguous list.
			assertUniqueKeys(options.sections);
			return inkModules().react.createElement(MultiSelect.View<A>, { ...options, onSubmit: control.resolve });
		};
}
