/**
 * Shared re-quoting semantics so the `quoted-strings` lint fix and
 * `YamlFormat`'s opt-in `requoteScalars` option cannot drift into two
 * dialects of "re-quotable".
 *
 * Two modes, deliberately distinct: `"conservative"` is the lint fix's
 * byte-exact shipped behavior; `"escaping"` is the format path's
 * semantics-preserving transform through the stringifier's quote renderers.
 * This module consumes public AST *types* only; nothing public imports it
 * back, so the cycle firewall holds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { ScalarStyle } from "../YamlNode.ts";
import { isControlChar } from "./fold.ts";
import { renderDoubleQuoted, renderSingleQuoted } from "./stringifier.ts";

const $I = $ScratchpadId.create("yaml/internal/requote");

/**
 * The structural slice of a scalar node the re-quoting decision reads —
 * satisfied by a public `YamlScalar` without this module depending on the
 * class itself.
 *
 * **Example** (Guard the scalar slice)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RequoteScalarInput } from "@beep/scratchpad/yaml/internal/requote"
 *
 * console.log(S.is(RequoteScalarInput)({ value: "x", style: "plain", offset: 0, length: 1 })) // true
 * ```
 *
 * @see {@link requoteScalarText} for the function that consumes this slice.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const RequoteScalarInput = Schema.Struct({
	value: Schema.Unknown,
	style: ScalarStyle,
	tag: Schema.optional(Schema.String),
	anchor: Schema.optional(Schema.String),
	offset: Schema.Finite,
	length: Schema.Finite,
}).pipe(
	$I.annoteSchema("RequoteScalarInput", {
		description: "Structural YAML scalar slice needed to decide whether a source quote can be changed safely.",
	}),
);

export type RequoteScalarInput = typeof RequoteScalarInput.Type;

/**
 * Re-quoting dialect: `"conservative"` is lint-fix semantics, `"escaping"`
 * is format-path semantics.
 *
 * **Gotchas**
 *
 * The modes are deliberately distinct. Using `"escaping"` in the lint fix
 * would change shipped bytes; using `"conservative"` on the format path
 * would skip valid quote swaps. Conservative is byte-exact (inner text must
 * equal the parsed value). Escaping re-renders via `renderDoubleQuoted` /
 * `renderSingleQuoted`; double→single returns `undefined` when the value
 * carries characters single-quoted style cannot express.
 *
 * @see {@link quotedStrings} for the lint rule that always uses `"conservative"`.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const RequoteMode = Schema.Literals(["conservative", "escaping"]).pipe(
	$I.annoteSchema("RequoteMode", {
		description: "YAML scalar re-quoting modes: byte-conservative lint fixes or escaping format transforms.",
	}),
);

export type RequoteMode = typeof RequoteMode.Type;

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
 *
 * **Gotchas**
 *
 * Skip when the scalar has a tag, an anchor, a non-string value, or a
 * multi-line source slice (`\n` or `\r`). Conservative skips when inner
 * text ≠ value or the target quote appears in the content. Import only
 * public AST *types* here — a runtime import of the classes would cycle
 * the engine.
 *
 * **Example** (Conservative wrap vs skipped escaped scalar)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const wrap = YamlLint.run("a: hello\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "quoted-strings": { quoteType: "double", required: true } },
 * }))
 * console.log(wrap.some((d) => d.rule === "quoted-strings" && d.fix !== undefined)) // true
 *
 * const skip = YamlLint.run("a: \"a\\nb\"\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "quoted-strings": { quoteType: "single" } },
 * }))
 * console.log(skip.filter((d) => d.rule === "quoted-strings").every((d) => d.fix === undefined)) // true
 * ```
 *
 * @see {@link quotedStrings} for the lint path that always passes `"conservative"`.
 * @see {@link YamlFormat.format} for the format path's opt-in `requoteScalars`.
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const requoteScalarText: {
	(scalar: RequoteScalarInput, quote: '"' | "'", mode: RequoteMode): (text: string) => string | undefined;
	(text: string, scalar: RequoteScalarInput, quote: '"' | "'", mode: RequoteMode): string | undefined;
} = dual(4, (text: string, scalar: RequoteScalarInput, quote: '"' | "'", mode: RequoteMode): string | undefined => {
	if (scalar.tag !== undefined || scalar.anchor !== undefined) return undefined;
	if (!P.isString(scalar.value)) return undefined;
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
});
