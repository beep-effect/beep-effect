const ESC = String.fromCharCode(0x1b);

/**
 * A small terminal model for the production render path: what a terminal shows after `written`, as its non-empty
 * lines.
 *
 * @remarks
 * It applies printable text, line feeds, the erase and cursor moves Ink's log-update writes (erase line, cursor up,
 * cursor to column one), and the clears of Ink's clear-terminal frame: `ESC[2J` blanks the visible screen, `ESC[3J`
 * drops the scrollback above it, `ESC[H` homes the cursor to the screen's top left. The visible screen is the last
 * `rows` lines; with `rows` unknown, the whole buffer counts as the screen, so a clear takes everything. Every other
 * escape is ignored. It does not wrap a line wider than the terminal. Shared by `CliUiTest.live`'s transcript and the
 * kit's own production-path tests.
 *
 * @param written - every byte written to the terminal
 * @param rows - the terminal's height, which decides how much of the buffer a clear takes as the screen
 *
 * @internal
 */
export const screenAfter = (written: string, rows?: number): ReadonlyArray<string> => {
	const lines: Array<string> = [""];
	let row = 0;
	let column = 0;
	const screenTop = (): number => (rows === undefined ? 0 : Math.max(0, lines.length - rows));
	const sequence = new RegExp(`${ESC}\\[([0-9;?]*)([A-Za-z])|${ESC}\\][^\\u0007]*\\u0007|([\\s\\S])`, "g");
	for (const match of written.matchAll(sequence)) {
		const [, params, command, character] = match;
		if (character !== undefined) {
			if (character === "\n") {
				row++;
				column = 0;
				while (lines.length <= row) lines.push("");
			} else if (character === "\r") column = 0;
			else if (character >= " ") {
				const line = lines[row] ?? "";
				lines[row] = `${line.slice(0, column).padEnd(column)}${character}${line.slice(column + 1)}`;
				column++;
			}
		} else if (command === "K") lines[row] = "";
		else if (command === "A") row = Math.max(0, row - Number(params === "" ? 1 : params));
		else if (command === "G") column = 0;
		else if (command === "J" && params === "2") {
			for (let index = screenTop(); index < lines.length; index++) lines[index] = "";
		} else if (command === "J" && params === "3") {
			const top = screenTop();
			lines.splice(0, top);
			row = Math.max(0, row - top);
			if (lines.length === 0) lines.push("");
		} else if (command === "H") {
			const [line, col] = params === "" ? [1, 1] : params.split(";").map((part) => Number(part === "" ? 1 : part));
			row = screenTop() + (line ?? 1) - 1;
			column = (col ?? 1) - 1;
			while (lines.length <= row) lines.push("");
		}
	}
	return lines.map((line) => line.trimEnd()).filter((line) => line !== "");
};
