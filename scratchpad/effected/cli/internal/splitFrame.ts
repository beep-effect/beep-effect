/** What JavaScript's `.` does not match outside dotAll mode: the four line terminators. */
const isTerminator = (ch: string | undefined): boolean => ch === "\n" || ch === "\r" || ch === " " || ch === " ";

/** One UTF-16 unit of JavaScript's `\s`; every character `\s` matches is in the BMP. */
const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

/**
 * A frame text split as `fn (location)`: at the FIRST whitespace run followed by `(`, when the text ends with `)`.
 *
 * @remarks
 * A linear scan with exactly the result of `/^(.*?)\s+\((.*)\)$/`, which backtracks polynomially on a long whitespace
 * run with no closing parenthesis. The split is the first one, not the last, because a location can hold parentheses
 * (an `eval` frame's `eval at <anonymous> (file:1:2), <anonymous>:1:1`). As with the regular expression, neither the
 * function nor the location may hold a line terminator, though the whitespace between them may.
 */
const wrappedFrame = (text: string): { readonly fn: string; readonly location: string } | undefined => {
	if (!text.endsWith(")")) return undefined;
	let firstTerminator = -1;
	let lastTerminator = -1;
	for (let i = 0; i < text.length; i++) {
		if (!isTerminator(text[i])) continue;
		if (firstTerminator === -1) firstTerminator = i;
		lastTerminator = i;
	}
	let i = 0;
	while (i < text.length) {
		if (!isSpace(text[i])) {
			i++;
			continue;
		}
		// The function is everything before this run; once it would hold a terminator, every later one would too.
		if (firstTerminator !== -1 && firstTerminator < i) return undefined;
		let j = i;
		while (isSpace(text[j])) j++;
		// `(` straight after the run, room for the closing `)`, and no terminator inside the location.
		if (text[j] === "(" && j <= text.length - 2 && lastTerminator < j) {
			return { fn: text.slice(0, i), location: text.slice(j + 1, -1) };
		}
		// Every later start inside this run reaches the same `j` and fails the same way.
		i = j;
	}
	return undefined;
};

/**
 * A frame's text without `at `, and its location: the part in parentheses, or the whole text when there are none.
 *
 * @internal
 */
export const splitFrame = (raw: string): { readonly text: string; readonly fn?: string; readonly location: string } => {
	const text = raw.trim().replace(/^at\s+/, "");
	const wrapped = wrappedFrame(text);
	return {
		text,
		...(wrapped === undefined || wrapped.fn === "" ? {} : { fn: wrapped.fn }),
		location: wrapped === undefined ? text : wrapped.location,
	};
};
