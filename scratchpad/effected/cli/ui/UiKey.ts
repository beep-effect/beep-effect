import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import type { Key } from "ink";

const $I = $ScratchpadId.create("effected/cli/ui/UiKey");

/**
 * The named keys a screen understands and a test can press.
 *
 * **Details**
 *
 * Letters, digits and punctuation are not named: they arrive as typed text.
 *
 * @public
 */
export const KeyName = LiteralKit([
	"up", "down", "left", "right", "enter", "space", "tab", "shift+tab",
	"backspace", "delete", "escape", "ctrl+c", "home", "end", "pageup", "pagedown",
]).annotate($I.annote("KeyName", { description: "The named keys understood by CLI screens and test input." }));
export type KeyName = typeof KeyName.Type;

const Named = S.Struct({
	_tag: S.tag("Named"),
	name: KeyName.annotateKey($I.annote("name", { description: "The named key reported by the terminal." })),
}).annotate($I.annote("Named", { description: "A named terminal key as a plain payload." }));

const Char = S.Struct({
	_tag: S.tag("Char"),
	char: S.String.annotateKey($I.annote("char", { description: "The typed text, including a whole pasted input." })),
}).annotate($I.annote("Char", { description: "Typed terminal text as a plain payload." }));

/**
 * A key as a screen sees it: a named key, or typed text.
 *
 * **Details**
 *
 * Space is always `Named("space")`, never `Char(" ")`, so a key table binds it once. A `Char` is what Ink delivers
 * as one input, so a paste arrives as one `Char` holding the pasted text.
 *
 * @public
 */
export const UiKeyPayload = S.Union([Named, Char]).pipe(S.toTaggedUnion("_tag"))
	.annotate($I.annote("UiKeyPayload", { description: "A plain named key or typed-text payload received by a screen." }));
export type UiKeyPayload = typeof UiKeyPayload.Type;
export type UiKey = UiKeyPayload;

const named = (name: KeyName): UiKey => Named.make({ name });

// biome-ignore lint/suspicious/noControlCharactersInRegex: an input holding a control character is not typed text
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Normalising Ink's input into {@link UiKey}s.
 *
 * @public
 */
export const UiKey: {
	/**
	 * The key Ink reported to a `useInput` handler, or `undefined` for one the kit does not name: a Ctrl or Meta
	 * combination other than Ctrl-C, or an input holding a control character.
	 */
	readonly fromInk: (input: string, key: Key) => UiKey | undefined;
	/** A named key. */
	readonly named: (name: KeyName) => UiKey;
	/** Typed text. */
	readonly char: (char: string) => UiKey;
} = {
	fromInk: (input, key) => {
		if (key.upArrow) return named("up");
		if (key.downArrow) return named("down");
		if (key.leftArrow) return named("left");
		if (key.rightArrow) return named("right");
		if (key.pageUp) return named("pageup");
		if (key.pageDown) return named("pagedown");
		if (key.home) return named("home");
		if (key.end) return named("end");
		if (key.return) return named("enter");
		if (key.escape) return named("escape");
		if (key.ctrl && input === "c") return named("ctrl+c");
		if (key.tab) return named(key.shift ? "shift+tab" : "tab");
		if (key.backspace) return named("backspace");
		if (key.delete) return named("delete");
		if (key.ctrl || key.meta) return undefined;
		if (input === " ") return named("space");
		if (input === "" || CONTROL.test(input)) return undefined;
		return Char.make({ char: input });
	},
	named,
	char: (char) => Char.make({ char }),
};
