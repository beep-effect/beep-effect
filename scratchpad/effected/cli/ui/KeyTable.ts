import { dual } from "effect/Function";
import type * as Cli from "../index.ts";
import * as O from "effect/Option";
import { graphemes } from "../internal/displayWidth.ts";
import { inkModules } from "./internal/ink.ts";
import { useScreenGuard } from "./internal/ScreenContext.ts";
import type { KeyName } from "./UiKey.ts";
import { UiKey } from "./UiKey.ts";
import * as P from "effect/Predicate";

/**
 * One row of a {@link KeyTable}: the keys that trigger an action, and the help line that names it.
 *
 * @public
 */
export interface Binding<Action> {
	/** The keys, named or typed (`{ char: "q" }`); any of them triggers the action. */
	readonly keys: ReadonlyArray<KeyName | { readonly char: string }>;
	/** What the keys do. */
	readonly action: Action;
	/** The words `KeyHelp` shows beside the keys. */
	readonly help: string;
	/** Bound but left out of the help line. */
	readonly hidden?: boolean;
}

/**
 * One entry of a key table's help: the key labels and what they do.
 *
 * @public
 */
export interface KeyHelpRow {
	/** The keys, labelled for the glyph set and joined with `/`. */
	readonly label: string;
	/** What they do. */
	readonly help: string;
}

/**
 * Options for {@link useKeys}.
 *
 * @public
 */
export interface UseKeysOptions {
	/** Whether the keys are read; `true` by default. */
	readonly isActive?: boolean;
}

/** Arrows under a Unicode glyph set; everything else, and everything under ASCII, as words. */
const ARROWS: Partial<Record<KeyName, string>> = { up: "↑", down: "↓", left: "←", right: "→" };
const WORDS: Record<KeyName, string> = {
	up: "up",
	down: "down",
	left: "left",
	right: "right",
	enter: "enter",
	space: "space",
	tab: "tab",
	"shift+tab": "shift+tab",
	backspace: "backspace",
	delete: "del",
	escape: "esc",
	"ctrl+c": "ctrl+c",
	home: "home",
	end: "end",
	pageup: "pgup",
	pagedown: "pgdn",
};

const labelOf = (key: KeyName | { readonly char: string }, glyphs: Cli.GlyphSet): string => {
	if (!P.isString(key)) return key.char;
	return (glyphs.kind === "unicode" ? ARROWS[key] : undefined) ?? WORDS[key];
};

/** A typed space is only ever reported as the named space key, so a `{ char: " " }` binding means `"space"`. */
const normalise = (key: KeyName | { readonly char: string }): KeyName | { readonly char: string } =>
	!P.isString(key) && key.char === " " ? "space" : key;

/** Two keys shadow each other in help when they would match the same press, so a char compares in NFC as matching does. */
const identity = (key: KeyName | { readonly char: string }): string =>
	P.isString(key) ? `named:${key}` : `char:${key.char.normalize("NFC")}`;

const bound = (binding: KeyName | { readonly char: string }, key: UiKey): boolean =>
	P.isString(binding)
		? key._tag === "Named" && key.name === binding
		: // Compared in NFC, so a precomposed binding matches decomposed input and the reverse.
			key._tag === "Char" && key.char.normalize("NFC") === binding.char.normalize("NFC");

/**
 * The keys a widget understands, as data: the one source both for dispatching input and for the help line, so the
 * two cannot drift apart.
 *
 * @remarks
 * Read it with {@link useKeys}, whose handler must step from current state, never render-closure state: several keys
 * from one stdin read are dispatched before React re-renders.
 *
 * @public
 */
export class KeyTable<Action> {
	/** The bindings, in priority order. */
	readonly bindings: ReadonlyArray<Binding<Action>>;

	// A plain field and an assignment, not a parameter property: Node's strip-only TypeScript refuses those.
	private constructor(bindings: ReadonlyArray<Binding<Action>>) {
		this.bindings = bindings;
	}

	/**
	 * A table from its bindings. When two bindings share a key, the first wins. A `{ char: " " }` key is stored as
	 * the named `"space"`, the only form in which Ink reports a space.
	 *
	 * @param bindings - the bindings, in priority order
	 */
	static readonly make = <Action>(bindings: ReadonlyArray<Binding<Action>>): KeyTable<Action> =>
		new KeyTable(bindings.map((binding) => ({ ...binding, keys: binding.keys.map(normalise) })));

	/**
	 * The keys every screen has: Esc cancels with `"escape"` (help: cancel), and Ctrl-C cancels with `"interrupt"`,
	 * bound but hidden. `q` is never a root key: it belongs to a widget's own table, so a text input can type it.
	 */
	static readonly root: KeyTable<"escape" | "interrupt"> = new KeyTable<"escape" | "interrupt">([
		{ keys: ["escape"], action: "escape", help: "cancel" },
		{ keys: ["ctrl+c"], action: "interrupt", help: "interrupt", hidden: true },
	]);

	/**
	 * The action of the first binding that holds `key`, or `None`.
	 *
	 * @param key - the key pressed
	 */
	readonly match = (key: UiKey): O.Option<Action> => {
		for (const binding of this.bindings) {
			if (binding.keys.some((candidate) => bound(candidate, key))) return O.some(binding.action);
		}
		return O.none();
	};

	/**
	 * The help rows of every binding not hidden that can still fire, in order, labelled for `glyphs`: `↑/↓` under
	 * Unicode, `up/down` under ASCII.
	 *
	 * @remarks
	 * A key an earlier binding already holds (hidden or not) can never fire a later one, so a later binding is
	 * labelled with its remaining keys only, and left out when none remain.
	 *
	 * @param glyphs - the glyph set the labels are drawn with
	 */
	readonly help = (glyphs: Cli.GlyphSet): ReadonlyArray<KeyHelpRow> => {
		const taken = new Set<string>();
		const rows: Array<KeyHelpRow> = [];
		for (const binding of this.bindings) {
			const live = binding.keys.filter((key) => !taken.has(identity(key)));
			for (const key of binding.keys) taken.add(identity(key));
			if (binding.hidden === true || live.length === 0) continue;
			rows.push({ label: live.map((key) => labelOf(key, glyphs)).join("/"), help: binding.help });
		}
		return rows;
	};
}

/** What a character of coalesced text is as a key: a line break is enter, and so on; another control is nothing. */
const keyOfCharacter = (character: string): UiKey | undefined => {
	if (character === "\r" || character === "\n" || character === "\r\n") return UiKey.named("enter");
	if (character === "\t") return UiKey.named("tab");
	if (character === " ") return UiKey.named("space");
	if (character === "\u007f" || character === "\b") return UiKey.named("backspace");
	return UiKey.fromInk(character, PLAIN);
};

/** Ink's key flags for plain typed text: none set. */
const PLAIN: Parameters<typeof UiKey.fromInk>[1] = {
	upArrow: false,
	downArrow: false,
	leftArrow: false,
	rightArrow: false,
	pageDown: false,
	pageUp: false,
	home: false,
	end: false,
	return: false,
	escape: false,
	ctrl: false,
	shift: false,
	tab: false,
	backspace: false,
	delete: false,
	meta: false,
	super: false,
	hyper: false,
	capsLock: false,
	numLock: false,
};

/**
 * The keys in one Ink input. Ink hands text read in one go to `useInput` as one string with no key flag (`"yy"`, or
 * `"y\r"` with no `return`), so text of more than one code point is split into a key per code point; a named key,
 * or a Ctrl or Meta combination, is the one key it is.
 */
const keysOf = (input: string, key: Parameters<typeof UiKey.fromInk>[1]): ReadonlyArray<UiKey> => {
	const single = UiKey.fromInk(input, key);
	if (single?._tag === "Named" || key.ctrl || key.meta) return single === undefined ? [] : [single];
	// By grapheme, not code point: a decomposed é or a ZWJ emoji is one key, and CR LF is one enter.
	const characters = graphemes(input);
	if (characters.length <= 1) return single === undefined ? [] : [single];
	return characters.flatMap((character) => {
		const pressed = keyOfCharacter(character);
		return pressed === undefined ? [] : [pressed];
	});
};

/**
 * Read the keys of `table` and dispatch the action each one matches; keys the table does not bind are ignored.
 *
 * @remarks
 * One Ink `useInput` per call, and nothing else reads input.
 *
 * Text read in one go (`"yy"`, `"y\r"`) reaches Ink's `useInput` as one string; it is split here into a key per
 * grapheme (a decomposed letter or a ZWJ emoji is one key), a line break (CR, LF or CR LF) as one enter, a tab as tab, a
 * space as space, so `{ char: "y" }` matches each `y`. A `{ char }` binding matches in NFC, whichever form was typed.
 * A bracketed paste never reaches it: the screen takes pastes on Ink's paste channel, so pasted text cannot press a
 * widget's keys (a pasted `q` does not cancel); `TextInput` reads pastes as text.
 *
 * Several keys from one stdin read (a fast typist, a held arrow, a terminal that batches) are each dispatched
 * before React re-renders, so `dispatch` must never step from state captured in the render that created it: the
 * second key would see the first key's starting point and repeat its move. Step with a functional update
 * (`setState((current) => step(current, action))`), a `useReducer` dispatch, or a ref the handler itself advances.
 *
 * Inside a screen mounted by `CliUi.run`, a `dispatch` that throws ends the screen as a defect carrying the error, as a
 * component that throws in render does; it never escapes as an uncaught exception.
 *
 * @param table - the keys to read
 * @param dispatch - receives each matched action
 * @param options - whether the keys are read
 *
 * @public
 */
export const useKeys: {
	<Action>(dispatch: (action: Action) => void, options?: UseKeysOptions): (table: KeyTable<Action>) => void;
	<Action>(table: KeyTable<Action>, dispatch: (action: Action) => void, options?: UseKeysOptions): void;
} = dual((args) => !P.isFunction(args[0]), <Action>(
	table: KeyTable<Action>,
	dispatch: (action: Action) => void,
	options: UseKeysOptions = {},
): void => {
	const guard = useScreenGuard();
	inkModules().ink.useInput(
		guard((input, key) => {
			for (const pressed of keysOf(input, key)) {
				const action = table.match(pressed);
				if (O.isSome(action)) dispatch(action.value);
			}
		}),
		{ isActive: options.isActive ?? true },
	);
});
