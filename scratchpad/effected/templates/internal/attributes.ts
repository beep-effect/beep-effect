// The marker attribute grammar, shared by the renderer and the scanner so the
// two can never disagree about what an attribute run is.
//
// A BEGIN marker may carry `name="value"` pairs between the phrase and the
// closing rule. Names are `[A-Za-z][A-Za-z0-9_-]*`; values are double-quoted
// and may not contain `"` or any line break — there is no escaping mechanism,
// by design: an escape grammar is a second parser hiding inside the first, and
// every value this package refuses is one it could not have read back
// verbatim.

import { $ScratchpadId } from "@beep/identity/packages";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/templates/internal/attributes");

/**
 * The attribute name grammar. No leading digit, underscore or dash.
 *
 * **Example** (Check the first character of an attribute name)
 *
 * ```ts
 * import { ATTRIBUTE_NAME_PATTERN } from "@beep/scratchpad/effected/templates/internal/attributes";
 *
 * console.log(ATTRIBUTE_NAME_PATTERN.test("owner-id")) // true
 * console.log(ATTRIBUTE_NAME_PATTERN.test("_owner")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * Attribute names retain the original JavaScript dollar-anchor semantics.
 *
 * **Example** (Validate an attribute name with its schema)
 *
 * ```ts
 * import { AttributeName } from "@beep/scratchpad/effected/templates/internal/attributes";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(AttributeName);
 * console.log(valid("owner-id")) // true
 * console.log(valid("9owner")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttributeName = S.String.check(S.isPattern(ATTRIBUTE_NAME_PATTERN)).annotate(
	$I.annote("AttributeName", { description: "An attribute name accepted by the existing marker renderer grammar." }),
);
/**
 * The string type validated by {@link AttributeName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AttributeName = typeof AttributeName.Type;

/**
 * Values may contain neither a double quote nor CR or LF, with no escaping.
 *
 * **Example** (Validate values that render verbatim)
 *
 * ```ts
 * import { AttributeValue } from "@beep/scratchpad/effected/templates/internal/attributes";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(AttributeValue);
 * console.log(valid("Ada")) // true
 * console.log(valid('Ada"')) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttributeValue = S.String.check(S.isPattern(/^(?![\s\S]*["\r\n])/)).annotate(
	$I.annote("AttributeValue", { description: "An attribute value that can be rendered verbatim inside double quotes." }),
);
/**
 * The string type validated by {@link AttributeValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AttributeValue = typeof AttributeValue.Type;

/**
 * True when a name satisfies the renderer's original grammar.
 *
 * **Example** (Reject a leading dash in an attribute name)
 *
 * ```ts
 * import { isValidAttributeName } from "@beep/scratchpad/effected/templates/internal/attributes";
 *
 * console.log(isValidAttributeName("owner-id")) // true
 * console.log(isValidAttributeName("-owner")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidAttributeName = S.is(AttributeName);

/**
 * True when a value can appear inside an attribute's double quotes verbatim.
 *
 * **Example** (Reject a line break in an attribute value)
 *
 * ```ts
 * import { isValidAttributeValue } from "@beep/scratchpad/effected/templates/internal/attributes";
 *
 * console.log(isValidAttributeValue("Ada")) // true
 * console.log(isValidAttributeValue("Ada\nLovelace")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isValidAttributeValue = S.is(AttributeValue);

const isNameStart = (code: number): boolean => (code >= 65 && code <= 90) || (code >= 97 && code <= 122); // A-Z a-z

const isNameChar = (code: number): boolean =>
	isNameStart(code) || (code >= 48 && code <= 57) || code === 95 || code === 45; // 0-9 _ -

const isSeparator = (code: number): boolean => code === 32 || code === 9; // space, tab

/**
 * Parse a captured attribute run, or refuse it.
 *
 * **Details**
 *
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
 *
 * **Example** (Read attribute pairs and refuse duplicate names)
 *
 * ```ts
 * import { parseAttributeRun } from "@beep/scratchpad/effected/templates/internal/attributes";
 *
 * const attributes = parseAttributeRun('owner="Ada" mode="strict"');
 * console.log(attributes?.owner) // Ada
 * console.log(parseAttributeRun('owner="Ada" owner="Grace"')) // undefined
 * ```
 * @category parsing
 * @since 0.0.0
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
		if (R.has(attributes, name)) {
			return undefined;
		}
		attributes[name] = value;
	}
	// An empty run is not a run — the marker regex only captures non-empty text,
	// but keep the contract honest for direct callers.
	return first ? undefined : attributes;
};
