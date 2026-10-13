import { dual } from "effect/Function";
import * as Str from "effect/String";
import { sanitize } from "../../Fmt.ts";

/**
 * Consumer text made safe for one row of a widget: sanitised as `Fmt.sanitize` does (no escape sequence, no other
 * control character), with each line break (CR, LF or CR LF) folded to a space.
 *
 * **Gotchas**
 *
 * Every string a kit widget draws from data goes through it before it is measured or cut. Ink keeps SGR and OSC
 * sequences it is handed, so unsanitised text would paint colour at colour `none` and could plant a hyperlink whose
 * target differs from its label; and a widget's row budget counts one row per line, so a second line would push the
 * frame past the terminal, where Ink wipes the screen and its scrollback.
 *
 * **Example** (Fold a multiline label into one row)
 *
 * ```ts
 * import { lineText } from "@beep/scratchpad/effected/cli/ui/internal/lineText"
 * console.log(lineText("Alpha\r\nBeta")) // Alpha Beta
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const lineText = (text: string): string => sanitize(text).replace(/\r\n|\r|\n/g, " ");

// Complete CSI and OSC spans take precedence over their individual control bytes.
const SANITIZE_SPAN = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B\[[0-?]*[ -/]*[@-~]|\t|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const LINE_BREAK = /\r\n|\r|\n/g;

/** Replace complete spans, mapping an interior cursor to the span's output position. */
const mappedText = (text: string, cursor: number, spans: RegExp, replacement: (span: string) => string): readonly [string, number] => {
	let raw = 0;
	let shown = "";
	let mapped = Math.max(0, Math.min(cursor, text.length));
	for (const match of text.matchAll(spans)) {
		const start = match.index;
		const span = match[0];
		const end = start + span.length;
		const next = replacement(span);
		shown += Str.slice(raw, start)(text);
		if (cursor >= end) mapped += next.length - span.length;
		else if (cursor > start) mapped = shown.length + next.length;
		shown += next;
		raw = end;
	}
	return [shown + Str.slice(raw)(text), mapped];
};
const sanitizedSpan = (span: string): string => span === "\t" ? " " : "";
const foldedBreak = (): string => " ";

/**
 * Sanitize a whole value and split it at its mapped raw cursor. A cursor inside a removed escape maps to the
 * start of that span; one between CR and LF maps after their single folded space.
 *
 * **Example** (Keep an escape payload hidden at an interior cursor)
 *
 * ```ts
 * import { lineTextAround } from "@beep/scratchpad/effected/cli/ui/internal/lineText"
 * console.log(lineTextAround("a\u001b[31mRED", 2)) // ["a", "RED"]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const lineTextAround: {
	(cursor: number): (text: string) => readonly [string, string];
	(text: string, cursor: number): readonly [string, string];
} = dual(2, (text: string, cursor: number): readonly [string, string] => {
	// Remove escapes before folding: removal can bring a CR and LF together across a control span.
	const [clean, cleanCursor] = mappedText(text, cursor, SANITIZE_SPAN, sanitizedSpan);
	const [shown, mapped] = mappedText(clean, cleanCursor, LINE_BREAK, foldedBreak);
	return [Str.slice(0, mapped)(shown), Str.slice(mapped)(shown)];
});
