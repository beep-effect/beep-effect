import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { displayWidth, graphemes } from "../../internal/displayWidth.ts";
const ESC = "\u001b";

/**
 * A small terminal model for the production render path: what a terminal shows after `written`, as its non-empty
 * lines.
 *
 * **Details**
 *
 * It applies printable text, line feeds, the erase and cursor moves Ink's log-update writes (erase line, cursor up,
 * cursor to column one), and the clears of Ink's clear-terminal frame: `ESC[2J` blanks the visible screen, `ESC[3J`
 * drops the scrollback above it, `ESC[H` homes the cursor to the screen's top left. The visible screen is the last
 * `rows` lines; with `rows` unknown, the whole buffer counts as the screen, so a clear takes everything. Every other
 * escape is ignored. Cursor columns count display cells; an overwrite blanks every cell of an affected grapheme
 * before writing its replacement, keeping emoji, combining sequences and wide East Asian text intact.
 * It does not wrap a line wider than the terminal. Shared by `CliUiTest.live`'s transcript and the
 * kit's own production-path tests.
 *
 * **Example** (Apply terminal cursor and erase sequences)
 *
 * ```ts
 * import { screenAfter } from "@beep/scratchpad/effected/cli/ui/testing/terminalModel"
 * const written = "old\u001b[1G\u001b[2Knew"
 * console.log(screenAfter(written).join("\n")) // new
 * ```
 *
 * @param written - every byte written to the terminal
 * @param rows - the terminal's height, which decides how much of the buffer a clear takes as the screen
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const screenAfter: {
	(rows?: number): (written: string) => ReadonlyArray<string>;
	(written: string, rows?: number): ReadonlyArray<string>;
} = dual((args) => P.isString(args[0]), (written: string, rows?: number): ReadonlyArray<string> => {
	// Some holds a grapheme's leading cell; None marks each continuation cell.
	let lines: Array<Array<O.Option<string>>> = [[]];
	let row = 0;
	let column = 0;
	let pending = "";
	const screenTop = (): number => (rows === undefined ? 0 : Math.max(0, lines.length - rows));
	const writePending = (): void => {
		const line = lines[row] ?? [];
		const clearCell = (index: number): void => {
			let start = index;
			while (start > 0 && O.isNone(A.getUnsafe(line, start))) start--;
			let end = start + 1;
			while (end < line.length && O.isNone(A.getUnsafe(line, end))) end++;
			for (let cell = start; cell < end; cell++) line[cell] = O.some(" ");
		};
		for (const segment of graphemes(pending)) {
			if (segment < " ") continue;
			const width = displayWidth(segment);
			if (width === 0) {
				let previous = column - 1;
				while (previous > 0 && O.isNone(line[previous] ?? O.some(" "))) previous--;
				const cell = line[previous];
				if (cell !== undefined) line[previous] = O.map(cell, (text) => text + segment);
				continue;
			}
			while (line.length < column + width) line[line.length] = O.some(" ");
			for (let cell = column; cell < column + width; cell++) clearCell(cell);
			line[column] = O.some(segment);
			for (let cell = column + 1; cell < column + width; cell++) line[cell] = O.none();
			column += width;
		}
		lines[row] = line;
		pending = "";
	};
	const sequence = new RegExp(`${ESC}\\[([0-9;?]*)([A-Za-z])|${ESC}\\][^\\u0007]*?(?:\\u0007|${ESC}\\\\)|([^${ESC}\\r\\n]+|[\\s\\S])`, "g");
	for (const match of Str.matchAll(sequence)(written)) {
		const [, params, command, character] = match;
		if (character !== undefined) {
			if (character === "\n") {
				writePending();
				row++;
				column = 0;
				while (lines.length <= row) lines[lines.length] = [];
			} else if (character === "\r") {
				writePending();
				column = 0;
			} else pending += character;
		} else if (command === "K" || command === "A" || command === "G" || command === "H" ||
			(command === "J" && (params === "2" || params === "3"))) {
			writePending();
			if (command === "K") lines[row] = [];
			else if (command === "A") row = Math.max(0, row - Number(params === "" ? 1 : params));
			else if (command === "G") column = Math.max(0, Number(params === "" ? 1 : params) - 1);
			else if (command === "J" && params === "2") {
				for (let index = screenTop(); index < lines.length; index++) lines[index] = [];
			} else if (command === "J" && params === "3") {
				const top = screenTop();
				lines = A.drop(lines, top);
				row = Math.max(0, row - top);
				if (lines.length === 0) lines = [[]];
			} else {
				const [line, col] = params === undefined || params === "" ? [1, 1] : A.map(Str.split(params, ";"), (part) => Number(part === "" ? 1 : part));
				row = screenTop() + Number(line) - 1;
				column = (col ?? 1) - 1;
				while (lines.length <= row) lines[lines.length] = [];
			}
		}
	}
	writePending();
	return A.filter(A.map(lines, (line) => Str.trimEnd(A.join(A.getSomes(line), ""))), Str.isNonEmpty);
});
