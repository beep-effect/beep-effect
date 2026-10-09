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
 * **Example** (Validate a named key)
 *
 * ```ts
 * import { KeyName } from "@beep/scratchpad/effected/cli/ui/UiKey"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KeyName)("shift+tab")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const KeyName = LiteralKit([
	"up", "down", "left", "right", "enter", "space", "tab", "shift+tab",
	"backspace", "delete", "escape", "ctrl+c", "home", "end", "pageup", "pagedown",
]).annotate($I.annote("KeyName", { description: "The named keys understood by CLI screens and test input." }));
/**
 * A named terminal key accepted by the KeyName schema.
 *
 * @category type-level
 * @since 0.0.0
 */
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
 * **Example** (Validate pasted text)
 *
 * ```ts
 * import { UiKey } from "@beep/scratchpad/effected/cli/ui/UiKey"
 * import { UiKeyPayload } from "@beep/scratchpad/effected/cli/ui/UiKey"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UiKeyPayload)(UiKey.char("pasted text"))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const UiKeyPayload = S.Union([Named, Char]).pipe(S.toTaggedUnion("_tag"))
	.annotate($I.annote("UiKeyPayload", { description: "A plain named key or typed-text payload received by a screen." }));
/**
 * A named key or typed-text payload validated by UiKeyPayload.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UiKeyPayload = typeof UiKeyPayload.Type;
/**
 * The normalized key payload consumed by a screen.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UiKey = UiKeyPayload;

const named = (name: KeyName): UiKey => Named.make({ name });

// biome-ignore lint/suspicious/noControlCharactersInRegex: an input holding a control character is not typed text
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Normalizes Ink input and constructs the key payloads consumed by screens.
 *
 * **Example** (Construct a space key)
 *
 * ```ts
 * import { UiKey } from "@beep/scratchpad/effected/cli/ui/UiKey"
 *
 * const key = UiKey.named("space")
 * console.log(key._tag) // Named
 * ```
 *
 * @public
 * @category normalization
 * @since 0.0.0
 */
export const UiKey: {
	/**
	 * The key Ink reported to a `useInput` handler, or `undefined` for one the kit does not name: a Ctrl or Meta
	 * combination other than Ctrl-C, or an input holding a control character.
	 * **Example** (Normalize an Ink space input)
	 *
	 * ```ts
	 * import { UiKey } from "@beep/scratchpad/effected/cli/ui/UiKey"
	 * import type { Key } from "ink"
	 *
	 * const inkKey: Key = {
	 *   upArrow: false,
	 *   downArrow: false,
	 *   leftArrow: false,
	 *   rightArrow: false,
	 *   pageDown: false,
	 *   pageUp: false,
	 *   home: false,
	 *   end: false,
	 *   return: false,
	 *   escape: false,
	 *   ctrl: false,
	 *   shift: false,
	 *   tab: false,
	 *   backspace: false,
	 *   delete: false,
	 *   meta: false,
	 *   super: false,
	 *   hyper: false,
	 *   capsLock: false,
	 *   numLock: false,
	 * }
	 * const key = UiKey.fromInk(" ", inkKey)
	 * console.log(key?._tag) // Named
	 * ```
	 *
	 * @category normalization
	 * @since 0.0.0
	 */
	readonly fromInk: (input: string, key: Key) => UiKey | undefined;
	/**
	 * Creates a payload for a named terminal key.
	 *
	 * **Example** (Construct a named key)
	 *
	 * ```ts
	 * import { UiKey } from "@beep/scratchpad/effected/cli/ui/UiKey"
	 *
	 * console.log(UiKey.named("enter")._tag) // Named
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	readonly named: (name: KeyName) => UiKey;
	/**
	 * Creates a payload for typed text or a whole pasted input.
	 *
	 * **Example** (Construct typed text)
	 *
	 * ```ts
	 * import { UiKey } from "@beep/scratchpad/effected/cli/ui/UiKey"
	 *
	 * console.log(UiKey.char("hello")._tag) // Char
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
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
