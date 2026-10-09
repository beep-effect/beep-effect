// The marker attribute grammar, shared by the renderer and the scanner so the
// two can never disagree about what an attribute run is.
//
// A BEGIN marker may carry `name="value"` pairs between the phrase and the
// closing rule. Names are `[A-Za-z][A-Za-z0-9_-]*`; values are double-quoted
// and may not contain `"` or any line break — there is no escaping mechanism,
// by design: an escape grammar is a second parser hiding inside the first, and
// every value this package refuses is one it could not have read back
// verbatim.

/** The attribute name grammar. No leading digit, underscore or dash. */
export const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** True when a value can appear inside an attribute's double quotes verbatim. */
export const isValidAttributeValue = (value: string): boolean =>
	!value.includes('"') && !value.includes("\n") && !value.includes("\r");

const isNameStart = (code: number): boolean => (code >= 65 && code <= 90) || (code >= 97 && code <= 122); // A-Z a-z

const isNameChar = (code: number): boolean =>
	isNameStart(code) || (code >= 48 && code <= 57) || code === 95 || code === 45; // 0-9 _ -

const isSeparator = (code: number): boolean => code === 32 || code === 9; // space, tab

/**
 * Parse a captured attribute run, or refuse it.
 *
 * @remarks
 * `undefined` means the run is not a valid attribute run and the line carrying
 * it is **not a marker** — it is ordinary content. That covers a mangled pair
 * and a name declared twice: two values for one name is two intentions for one
 * attribute, and any choice between them would be a guess.
 *
 * Document order is preserved: the returned record's insertion order is the
 * order the pairs appear in the marker.
 *
 * A hand-rolled single pass rather than a validating regex: the run comes off
 * an untrusted document line, and the natural `(pair)(sep pair)*$` pattern
 * backtracks polynomially on hostile near-misses. This walk touches each
 * character exactly once, so a megabyte of adversarial line costs a megabyte
 * of work.
 */
export const parseAttributeRun = (run: string): Record<string, string> | undefined => {
	const attributes: Record<string, string> = {};
	const length = run.length;
	let index = 0;
	let first = true;
	while (index < length) {
		if (!first) {
			// Between pairs: one or more spaces/tabs.
			if (!isSeparator(run.charCodeAt(index))) {
				return undefined;
			}
			while (index < length && isSeparator(run.charCodeAt(index))) {
				index += 1;
			}
			if (index >= length) {
				// A trailing separator is not part of a valid captured run.
				return undefined;
			}
		}
		first = false;
		// Name: [A-Za-z][A-Za-z0-9_-]*
		if (!isNameStart(run.charCodeAt(index))) {
			return undefined;
		}
		const nameStart = index;
		index += 1;
		while (index < length && isNameChar(run.charCodeAt(index))) {
			index += 1;
		}
		const name = run.slice(nameStart, index);
		// `="`
		if (index + 1 >= length || run.charCodeAt(index) !== 61 || run.charCodeAt(index + 1) !== 34) {
			return undefined;
		}
		index += 2;
		// Value: every character up to the closing quote. The scanner only hands
		// this function single-line text, but refuse a stray CR/LF regardless so
		// the grammar cannot drift from the renderer's refusal.
		const valueStart = index;
		while (index < length) {
			const code = run.charCodeAt(index);
			if (code === 34) {
				break;
			}
			if (code === 10 || code === 13) {
				return undefined;
			}
			index += 1;
		}
		if (index >= length) {
			// Unterminated value.
			return undefined;
		}
		const value = run.slice(valueStart, index);
		index += 1; // consume the closing quote
		if (Object.hasOwn(attributes, name)) {
			return undefined;
		}
		attributes[name] = value;
	}
	// An empty run is not a run — the marker regex only captures non-empty text,
	// but keep the contract honest for direct callers.
	return first ? undefined : attributes;
};
