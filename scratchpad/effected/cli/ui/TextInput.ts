import * as A from "effect/Array";
import type { ReactElement } from "react";
import { Fmt } from "../Fmt.ts";
import type { Screen } from "./CliUi.ts";
import { inkModules } from "./internal/ink.ts";
import { lineText } from "./internal/lineText.ts";
import { useScreenGuard } from "./internal/ScreenContext.ts";
import { KeyHelp } from "./KeyHelp.ts";
import { KeyTable } from "./KeyTable.ts";
import { UiKey } from "./UiKey.ts";
import { Styled, useGlyphs, useTerminalSize } from "./UiTheme.ts";
import * as P from "effect/Predicate";
import * as Match from "effect/Match";

/**
 * Where a {@link TextInput} is: its value, the cursor within it, and whether enter was pressed.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface TextInputState {
	/** The text. */
	readonly value: string;
	/**
	 * The insertion point, from 0 to the value's length, in UTF-16 code units. Left, right, backspace and delete move
	 * and delete by grapheme, so a character built from several code points (an emoji, a flag, a letter with a
	 * combining accent) is crossed and deleted whole, and the cursor never stops inside one it moved over.
	 */
	readonly cursor: number;
	/** Whether enter was pressed; the view submits only when the value also validates. */
	readonly submitted: boolean;
}

/**
 * Options for {@link TextInput.init}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface TextInputInitOptions {
	/** The starting text; the cursor starts after it. */
	readonly initial?: string;
}

/**
 * Options for {@link TextInput.screen}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface TextInputScreenOptions {
	/** The question, shown above the input. */
	readonly message: string;
	/** The starting text. */
	readonly initial?: string;
	/** Shown, muted, while the value is empty. */
	readonly placeholder?: string;
	/** Returns a message when the value cannot be submitted, or `undefined` when it can; given the real text. */
	readonly validate?: (value: string) => string | undefined;
	/**
  * Draw the value masked, so a secret typed or pasted into it is never drawn: one mask per grapheme, so an emoji, a
  * flag or a letter with a combining accent is one mask, not one per code unit. `true` masks with `•` (`*` under ASCII
  * glyphs); a string masks with that string, its controls removed. A predicate, `(value) => boolean`, is asked with
  * the real value and masks with `•` from the first render it answers `true`, and then LATCHES: the value stays masked
  * through every edit after (deleting a pasted token's first character never redraws the rest in clear) until the
  * value is cleared to empty. So a field that holds an address (an `op://` reference) stays readable while typed and
  * hides a value the moment it looks like a token. Match a giveaway ANYWHERE in the value, never as a prefix:
  * `(value) => /gh[pousr]_|github_pat_/.test(value)` masks `op://v/` followed by a pasted token, which a prefix
  * match never would. Frames drawn before it first answered `true` showed the text typed so far; a paste arrives
  * whole, so a pasted token is masked from its first frame. Unmasked by default.
  *
  * **Gotchas**
  *
  * Only the drawing changes: `validate` and the resolved value get the real text, the cursor moves through it as
  * before, and the placeholder still shows while the value is empty. A masked frame never holds the text, so neither
  * does the scrollback; erase the frame as well with `clear: true` on the run when even the mask's length should not
  * stay behind.
  *
  * The message `validate` returns is drawn as it is, unmasked: a message that echoes the value (`"ghp_abc is a
  * token"`) draws the secret in the frame. Say what is wrong without quoting the value.
  */
	readonly mask?: string | true | ((value: string) => boolean);
}

/**
 * Props of {@link TextInput.View}.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface TextInputViewProps extends TextInputScreenOptions {
	/** Receives the value when enter is pressed and it validates. */
	readonly onSubmit: (value: string) => void;
}

const init = (options: TextInputInitOptions = {}): TextInputState => {
	const value = options.initial ?? "";
	return { value, cursor: value.length, submitted: false };
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The grapheme boundary before `at`: the start of the grapheme `at` is in or just after; 0 at the start. */
const previous = (value: string, at: number): number => {
	let boundary = 0;
	for (const { index } of segmenter.segment(value)) {
		if (index >= at) break;
		boundary = index;
	}
	return boundary;
};

/** The grapheme boundary after `at`: the end of the grapheme that starts at or contains `at`; the length at the end. */
const following = (value: string, at: number): number => {
	for (const { index, segment } of segmenter.segment(value)) {
		const end = index + segment.length;
		if (end > at) return end;
	}
	return value.length;
};

const insert = (state: TextInputState, text: string): TextInputState => ({
	value: state.value.slice(0, state.cursor) + text + state.value.slice(state.cursor),
	cursor: state.cursor + text.length,
	submitted: false,
});

// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to split typed text at control characters
const CONTROLS = /([\u0000-\u001f\u007f])/;

// biome-ignore lint/suspicious/noControlCharactersInRegex: a paste's control characters are dropped
const PASTE_CONTROLS = /[\u0000-\u001f\u007f]/g;

/**
 * The keys one Ink input holds. Text read in one go (a fast typist, a paste) reaches `useInput` as one string, controls
 * and all, so it is split at its control characters: the printable runs are typed whole, `\r` is enter (and ends the
 * input: text after a submit is not typed into a submitted field), a backspace byte is backspace, a line feed is a
 * space (a pasted line break separates words in a one-line field), and a tab or any other control is dropped. A named
 * key, or a Ctrl or Meta combination, is the one key Ink reported.
 */
const typedKeys = (input: string, key: Parameters<typeof UiKey.fromInk>[1]): ReadonlyArray<UiKey> => {
	const single = UiKey.fromInk(input, key);
	if (single?._tag === "Named" || key.ctrl || key.meta || !CONTROLS.test(input) || [...input].length < 2) {
		return single === undefined ? [] : [single];
	}
	const keys: Array<UiKey> = [];
	for (const piece of input.split(CONTROLS)) {
		if (piece === "") continue;
		if (piece === "\r") {
			keys.push(UiKey.named("enter"));
			break;
		}
		if (piece === "\n") keys.push(UiKey.char(" "));
		else if (!CONTROLS.test(piece)) keys.push(UiKey.char(piece));
	}
	return keys;
};

const step = (state: TextInputState, key: UiKey): TextInputState => {
	if (key._tag === "Char") return insert(state, key.char);
	const { value, cursor } = state;
	return Match.value(key.name).pipe(
		Match.when("space", () => insert(state, " ")),
		Match.when("backspace", () => {
			if (cursor === 0) return state;
			const from = previous(value, cursor);
			return { value: value.slice(0, from) + value.slice(cursor), cursor: from, submitted: false };
		}),
		Match.when("delete", () => cursor === value.length
				? state
				: { value: value.slice(0, cursor) + value.slice(following(value, cursor)), cursor, submitted: false }),
		Match.when("left", () => ({ ...state, cursor: previous(value, cursor), submitted: false })),
		Match.when("right", () => ({ ...state, cursor: following(value, cursor), submitted: false })),
		Match.when("home", () => ({ ...state, cursor: 0, submitted: false })),
		Match.when("end", () => ({ ...state, cursor: value.length, submitted: false })),
		Match.when("enter", () => ({ ...state, submitted: true })),
		Match.orElse(() => state),
	);
};

/** Take code points from the end of `text` while they fit in `width` cells. */
const tail = (text: string, width: number): string => {
	const points = [...text];
	let out = "";
	let used = 0;
	for (let index = points.length - 1; index >= 0; index--) {
		const point = A.getUnsafe(points, index);
		const cells = Fmt.width(point);
		if (used + cells > width) break;
		out = point + out;
		used += cells;
	}
	return out;
};

/** Take code points from the start of `text` while they fit in `width` cells. */
const head = (text: string, width: number): string => {
	let out = "";
	let used = 0;
	for (const point of text) {
		const cells = Fmt.width(point);
		if (used + cells > width) break;
		out += point;
		used += cells;
	}
	return out;
};

/**
 * The text either side of the cursor, scrolled so the line fits `width` cells and the cursor stays in view: a cut
 * edge is marked with the ellipsis, the text after the cursor keeps up to a third of the room, and the text before
 * it the rest.
 */
const windowAround = (before: string, after: string, width: number, ellipsis: string): readonly [string, string] => {
	if (Fmt.width(before) + Fmt.width(after) <= width) return [before, after];
	const mark = Fmt.width(ellipsis);
	const afterRoom = Math.min(Fmt.width(after), Math.floor(width / 3));
	const beforeRoom = width - afterRoom;
	// The ellipsis marks a cut edge only when it fits with at least one cell of text beside it; on a terminal too narrow
	// for that (ASCII "..." in three cells), the text is simply cut.
	const shownBefore =
		Fmt.width(before) <= beforeRoom
			? before
			: beforeRoom > mark
				? `${ellipsis}${tail(before, beforeRoom - mark)}`
				: tail(before, Math.max(0, beforeRoom));
	const room = Math.max(0, width - Fmt.width(shownBefore));
	const shownAfter =
		Fmt.width(after) <= room ? after : room > mark ? `${head(after, room - mark)}${ellipsis}` : head(after, room);
	return [shownBefore, shownAfter];
};

/**
 * The value masked either side of the cursor, one `mask` per grapheme of the whole value: the graphemes that start
 * before the cursor, then the rest, so the two always add up to the value's graphemes, wherever the cursor is.
 */
const maskedAround = (value: string, cursor: number, mask: string): readonly [string, string] => {
	let before = 0;
	let total = 0;
	for (const { index } of segmenter.segment(value)) {
		total++;
		if (index < cursor) before++;
	}
	return [mask.repeat(before), mask.repeat(total - before)];
};

/** Shown in the help line only; the input reads every key itself. */
const HELP: KeyTable<"submit"> = KeyTable.make<"submit">([{ keys: ["enter"], action: "submit", help: "submit" }]);

/**
 * One line of text: a pure reducer, a view and a ready-made screen.
 *
 * **Details**
 *
 * Every typed character is text, `q` included: the input binds no letter, so Esc and Ctrl-C are the screen's root
 * keys and still cancel with `"escape"` and `"interrupt"`.
 *
 * **Example** (Ask for a required package name)
 *
 * ```ts
 * import { CliUi } from "@beep/scratchpad/effected/cli/ui/CliUi"
 * import { TextInput } from "@beep/scratchpad/effected/cli/ui/TextInput"
 * import * as Effect from "effect/Effect";
 *
 * const askName = Effect.gen(function* () {
 * 	const name = yield* CliUi.run(
 * 		TextInput.screen({
 * 			message: "Package name?",
 * 			placeholder: "my-package",
 * 			validate: (value) => (value.trim() === "" ? "A name is required" : undefined),
 * 		}),
 * 	)
 * 	return name
 * })
 * console.log(Effect.isEffect(askName)) // true
 * ```
 *
 * @public
 * @category components
 * @since 0.0.0
 */
export abstract class TextInput {

	/**
	 * An input holding `initial`, the cursor after it.
	 *
	 * **Example** (Place the cursor after initial text)
	 *
	 * ```ts
	 * import { TextInput } from "@beep/scratchpad/effected/cli/ui/TextInput";
	 *
	 * const state = TextInput.init({ initial: "hello" });
	 * console.log(state.cursor) // 5
	 * ```
	 *
	 * @param options - the starting text
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly init: (options?: TextInputInitOptions) => TextInputState = init;

	/**
	 * Apply a key: a typed character (every character, `q` included) or space is inserted at the cursor; backspace and delete
	 * remove the grapheme before or after it; left and right move it a grapheme, home and end to either end, clamped
	 * to the text; enter marks it submitted. Every other key changes nothing.
	 *
	 * **Example** (Delete a whole emoji grapheme)
	 *
	 * ```ts
	 * import { TextInput } from "@beep/scratchpad/effected/cli/ui/TextInput";
	 * import { UiKey } from "@beep/scratchpad/effected/cli/ui/UiKey";
	 *
	 * const state = TextInput.init({ initial: "Hi😀" });
	 * const edited = TextInput.step(state, UiKey.named("backspace"));
	 * console.log(edited.value) // Hi
	 * ```
	 *
	 * @param state - where the input is
	 * @param key - the key pressed
	 * @category combinators
	 * @since 0.0.0
	 */
	static readonly step: (state: TextInputState, key: UiKey) => TextInputState = step;

	/**
	 * Draw the input: the message, the value with the cursor shown as `▏` (`|` under ASCII glyphs, so it stays visible
	 * without colour), or one mask per grapheme in its place with `mask`, the placeholder while empty, a validation
	 * message in the error token, and the key help. Enter
	 * submits when `validate` passes; otherwise its message is shown until the next key other than enter, or a paste.
	 *
	 * **Details**
	 *
	 * Text read in one go (a fast typist) is typed as it reads: printable runs are inserted whole, a return submits
	 * what came before it (anything after it is dropped), a backspace byte deletes, a line feed becomes a space, and a
	 * tab or other control character is dropped. A bracketed paste is inserted as text, its line breaks as spaces, and
	 * never submits.
	 *
	 * **Example** (Compose a masked token input)
	 *
	 * ```ts
	 * import { TextInput } from "@beep/scratchpad/effected/cli/ui/TextInput";
	 * import { createElement } from "react";
	 *
	 * const element = createElement(TextInput.View, { message: "Token?", mask: true, onSubmit: (value) => console.log(value.length) });
	 * console.log(element.props.mask) // true
	 * ```
	 *
	 * @param props - the message, the starting text, the placeholder, the validator and where the value goes
	 * @category components
	 * @since 0.0.0
	 */
	static readonly View = (props: TextInputViewProps): ReactElement => {
		const { ink, react } = inkModules();
		const glyphs = useGlyphs();
		const { columns } = useTerminalSize();
		const [state, setState] = react.useState(() => init(props.initial === undefined ? {} : { initial: props.initial }));
		const [error, setError] = react.useState<string | undefined>(undefined);
		const { validate, onSubmit } = props;
		// Deliberately keyed on `submitted` alone: the effect runs in the render where it flipped, whose closure already
		// holds that render's validate and onSubmit, so listing them would only re-run it with nothing new to do.
		react.useEffect(() => {
			if (!state.submitted) return;
			const problem = validate?.(state.value);
			if (problem === undefined) onSubmit(state.value);
			else {
				setError(problem);
				setState((current) => ({ ...current, submitted: false }));
			}
		}, [state.submitted]);
		// A paste is text: inserted whole, a pasted line break a space (a paste never submits), other controls dropped.
		const guard = useScreenGuard();
		ink.usePaste(
			guard((text: string) => {
				const typed = text.replace(/\r\n|\r|\n/g, " ").replace(PASTE_CONTROLS, "");
				if (typed === "") return;
				setError(undefined);
				setState((current) => step(current, UiKey.char(typed)));
			}),
		);
		ink.useInput(
			guard((input: string, key: Parameters<typeof UiKey.fromInk>[1]) => {
				const keys = typedKeys(input, key);
				// Esc and Ctrl-C belong to the screen's root keys.
				if (
					keys.some((pressed) => pressed._tag === "Named" && (pressed.name === "escape" || pressed.name === "ctrl+c"))
				) {
					return;
				}
				if (keys.some((pressed) => !(pressed._tag === "Named" && pressed.name === "enter"))) setError(undefined);
				for (const pressed of keys) setState((current) => step(current, pressed));
			}),
		);
		const cursorGlyph = glyphs.kind === "unicode" ? "▏" : "|";
		// A predicate latches: once it has answered true the value stays masked, whatever is edited after (deleting the
		// first character of a pasted token must not redraw the rest of it in clear), until the value is cleared.
		const latched = react.useRef(false);
		if (state.value === "") latched.current = false;
		else if (P.isFunction(props.mask) && !latched.current && props.mask(state.value)) latched.current = true;
		const masking = P.isFunction(props.mask) ? latched.current : props.mask;
		const mask =
			masking === undefined || masking === false
				? undefined
				: masking === true
					? glyphs.kind === "unicode"
						? "•"
						: "*"
					: lineText(masking);
		const [shownBefore, shownAfter] =
			mask === undefined
				? [lineText(state.value.slice(0, state.cursor)), lineText(state.value.slice(state.cursor))]
				: maskedAround(state.value, state.cursor, mask);
		const [before, after] = windowAround(shownBefore, shownAfter, columns - Fmt.width(cursorGlyph), glyphs.ellipsis);
		return react.createElement(
			ink.Box,
			{ flexDirection: "column" },
			react.createElement(
				Styled,
				{ token: "emphasis" },
				Fmt.truncate(lineText(props.message), columns, { ellipsis: glyphs.ellipsis }),
			),
			react.createElement(
				ink.Text,
				null,
				before,
				cursorGlyph,
				after,
				state.value === "" && props.placeholder !== undefined
					? react.createElement(
							Styled,
							{ token: "muted" },
							Fmt.truncate(lineText(props.placeholder), Math.max(0, columns - Fmt.width(cursorGlyph)), {
								ellipsis: glyphs.ellipsis,
							}),
						)
					: null,
			),
			error === undefined
				? null
				: react.createElement(
						Styled,
						{ token: "error" },
						Fmt.truncate(lineText(error), columns, { ellipsis: glyphs.ellipsis }),
					),
			react.createElement(KeyHelp, { tables: [HELP] }),
		);
	};

	/**
	 * A ready-made screen for `CliUi.run`: the input, resolving with the submitted text.
	 *
	 * **Details**
	 *
	 * With `mask`, a secret is drawn as one mask per grapheme and never as itself, while the screen still resolves with
	 * the real text.
	 *
	 * **Example** (Construct a masked token prompt)
	 *
	 * ```ts
	 * import { CliUi } from "@beep/scratchpad/effected/cli/ui/CliUi";
	 * import { TextInput } from "@beep/scratchpad/effected/cli/ui/TextInput";
	 * import * as Effect from "effect/Effect";
	 *
	 * const token = CliUi.run(TextInput.screen({ message: "Token reference?", mask: true }), { clear: true })
	 * console.log(Effect.isEffect(token)) // true
	 * ```
	 *
	 * @param options - the message, the starting text, the placeholder, the validator and the mask
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly screen =
		(options: TextInputScreenOptions): Screen<string> =>
		(control) =>
			inkModules().react.createElement(TextInput.View, { ...options, onSubmit: control.resolve });
}
