// Shared re-quoting semantics (#347): the ONE definition of "which scalar can
// be re-quoted to the target style, and with what replacement text", so the
// `quoted-strings` lint fix and `YamlFormat`'s opt-in `requoteScalars` option
// cannot drift into two dialects of "re-quotable".
//
// Two modes, deliberately distinct:
//
// - `"conservative"` is the lint fix's shipped behavior, byte-exact: a quote
//   swap or a wrap happens only when the raw inner text IS the parsed value
//   (no escapes, no doubled quotes in play) and the target quote never
//   appears in it — otherwise no replacement. The lint fix delegates here so
//   its behavior is pinned by this module rather than re-derived.
// - `"escaping"` is the format path's semantics-preserving transform: it
//   re-renders the parsed value through the stringifier's own quote
//   renderers, applying proper double-quote escaping for single→double and
//   `''` doubling for double→single. Double→single returns no replacement
//   whenever the value carries characters single-quoted style cannot express
//   (newlines, tabs, carriage returns, control and other non-printable
//   characters — single quotes can escape nothing but `'`). Only
//   already-quoted, single-line, untagged, unanchored source scalars are
//   candidates: plain scalars stay plain and block scalars stay block.
//
// The escaping mode's replacement text comes from `renderDoubleQuoted` /
// `renderSingleQuoted` — the same functions the stringifier itself uses to
// emit a scalar of that style — so a format-path caller that flips a node's
// `style` and re-stringifies produces exactly this replacement.
//
// Like the stringifier, this module consumes the public AST *types* only;
// nothing public imports it back, so the cycle firewall holds.

import type { ScalarStyle } from "../YamlNode.ts";
import { isControlChar } from "./fold.ts";
import { renderDoubleQuoted, renderSingleQuoted } from "./stringifier.ts";

/**
 * The structural slice of a scalar node the re-quoting decision reads —
 * satisfied by a public `YamlScalar` without this module depending on the
 * class itself.
 */
export interface RequoteScalarInput {
	readonly value: unknown;
	readonly style: ScalarStyle;
	readonly tag?: string | undefined;
	readonly anchor?: string | undefined;
	readonly offset: number;
	readonly length: number;
}

/** See the module header: `"conservative"` = lint-fix semantics, `"escaping"` = format-path semantics. */
export type RequoteMode = "conservative" | "escaping";

/**
 * True when `value` can be carried by a single-quoted flow scalar on one
 * line. Single-quoted style has exactly one escape (`''`), so any character
 * double-quote escape sequences exist to encode — newline, carriage return,
 * tab, C0 controls, DEL and the C1 range — has no single-quoted spelling and
 * makes the conversion impossible rather than lossy-but-tempting.
 */
function isSingleQuotable(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
		if (isControlChar(code)) return false;
		if (code === 0x7f || (code >= 0x80 && code <= 0x9f)) return false;
	}
	return true;
}

/**
 * The replacement raw text that re-quotes `scalar` with `quote`, or
 * `undefined` when no value-preserving replacement exists under `mode`
 * (skipping is always correct; corrupting never is).
 */
export function requoteScalarText(
	text: string,
	scalar: RequoteScalarInput,
	quote: '"' | "'",
	mode: RequoteMode,
): string | undefined {
	if (scalar.tag !== undefined || scalar.anchor !== undefined) return undefined;
	if (typeof scalar.value !== "string") return undefined;
	const raw = text.slice(scalar.offset, scalar.offset + scalar.length);
	// A multi-line source scalar folds line breaks into its value; re-quoting
	// it from the value would collapse the layout, so it is skipped whole.
	// A lone `\r` is a YAML line break too (b-carriage-return), so a scalar
	// folded on CR-only breaks is just as multi-line as an LF one.
	if (raw.includes("\n") || raw.includes("\r")) return undefined;

	if (mode === "conservative") {
		const inner = scalar.style === "plain" ? raw : raw.slice(1, -1);
		// Only when the raw inner text IS the value (no escapes, no doubled
		// quotes) and the target quote never appears in it does requoting
		// provably preserve the value.
		if (inner !== scalar.value) return undefined;
		if (inner.includes(quote)) return undefined;
		if (quote === '"' && inner.includes("\\")) return undefined;
		return `${quote}${inner}${quote}`;
	}

	// Escaping mode: quote-style conversion only — the source must already be
	// quoted in the opposite style. Plain scalars stay plain, block scalars
	// stay block, same-style scalars need nothing.
	if (quote === '"') {
		if (scalar.style !== "single-quoted") return undefined;
		return renderDoubleQuoted(scalar.value);
	}
	if (scalar.style !== "double-quoted") return undefined;
	if (!isSingleQuotable(scalar.value)) return undefined;
	return renderSingleQuoted(scalar.value);
}
