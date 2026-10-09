// Block/flow scalar folding helpers: rendering multi-line string values as
// block-literal (`|`), block-folded (`>`) and fold-encoded single-quoted
// scalars, plus the whitespace analyses that decide when block styles cannot
// represent a value faithfully.

/**
 * Column-based line folding for a single logical scalar line (YAML 1.2 flow
 * folding, §7.3 / §8.2.1). Breaks the content at "safe" single-space
 * boundaries — a space whose neighbours are both non-space — so each inserted
 * line break is a *semantically transparent* fold: on read, a lone break
 * between non-empty lines at the same indent folds back to a single space, and
 * the leading indentation of continuation lines is absorbed as separation
 * whitespace. The original space at the break point is consumed, replaced by
 * the break, so no content whitespace is added or lost.
 *
 * Continuation lines are prefixed with `indent`. `indentAtStart` is the column
 * the first line begins at (its content is already `indentAtStart` columns in),
 * used only to budget the first line; it is approximate because the caller's
 * exact column (after a `key: ` prefix, say) is not known here.
 *
 * Only breaks where a break is safe. When no safe break point exists before the
 * width limit, the line overflows unwrapped rather than corrupting the value —
 * width folding is a best-effort presentation concern, never a correctness one.
 * A non-positive `lineWidth` (the default) returns the text unchanged.
 */
export function foldScalarLine(text: string, indent: string, lineWidth: number, indentAtStart: number): string {
	if (lineWidth <= 0) return text;
	// Chars a continuation line can hold before reaching the width column. Guard
	// against a pathological indent >= lineWidth (nothing would fit) by never
	// dropping below one character of progress.
	const contentWidth = Math.max(1, lineWidth - indent.length);
	// Index budget for the current physical line: fold once the scan index
	// reaches it and a candidate split has been seen.
	let end = Math.max(1, lineWidth - indentAtStart);
	const folds: number[] = [];
	let split: number | undefined;
	let prev: string | undefined;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === " " && prev !== undefined && prev !== " ") {
			const next = text[i + 1];
			if (next !== undefined && next !== " ") split = i;
		}
		if (i >= end && split !== undefined) {
			folds.push(split);
			end = split + contentWidth;
			split = undefined;
		}
		prev = ch;
	}
	if (folds.length === 0) return text;
	let result = text.slice(0, folds[0]);
	for (let f = 0; f < folds.length; f++) {
		const fold = folds[f];
		const sliceEnd = folds[f + 1] ?? text.length;
		// Drop the space at `fold`; the inserted break carries the join.
		result += `\n${indent}${text.slice(fold + 1, sliceEnd)}`;
	}
	return result;
}

/**
 * Apply {@link foldScalarLine} to an already-rendered scalar according to its
 * style, inferred from the leading character:
 *
 * - `|` block-literal — returned unchanged; literal blocks preserve bytes by
 *   definition and must never be folded.
 * - `>` block-folded — each base-indent body content line is folded; blank
 *   lines and more-indented lines (which the reader treats as literal breaks)
 *   are left untouched.
 * - `"` double-quoted — the inner content is folded; breaking only at content
 *   spaces means no `\`-escaped continuations are needed.
 * - `'` single-quoted — returned unchanged (out of scope for width folding).
 * - otherwise plain — folded directly.
 *
 * `indent` is one indentation level (the continuation prefix); `lineWidth` is
 * the target column. A non-positive `lineWidth` returns the text unchanged.
 */
export function foldRenderedScalar(rendered: string, indent: string, lineWidth: number): string {
	if (lineWidth <= 0 || rendered.length === 0) return rendered;
	const first = rendered[0];
	// Block-literal and single-quoted are never width-folded.
	if (first === "|" || first === "'") return rendered;
	if (first === ">") {
		const lines = rendered.split("\n");
		const out: string[] = [lines[0]];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			// Fold only base-indent content lines: they start with exactly `indent`
			// and the next char is content (not a further space/tab, which would
			// make the line "more-indented" and its break literal to the reader).
			if (
				line.length > indent.length &&
				line.startsWith(indent) &&
				line[indent.length] !== " " &&
				line[indent.length] !== "\t"
			) {
				const content = line.slice(indent.length);
				out.push(indent + foldScalarLine(content, indent, lineWidth, indent.length));
			} else {
				out.push(line);
			}
		}
		return out.join("\n");
	}
	if (first === '"') {
		const inner = rendered.slice(1, -1);
		// +1 for the opening quote already consumed on the first line.
		return `"${foldScalarLine(inner, indent, lineWidth, indent.length + 1)}"`;
	}
	// Plain scalar.
	return foldScalarLine(rendered, indent, lineWidth, indent.length);
}

/**
 * C0 control characters (except TAB) that must be escaped in double-quoted scalars.
 */
export function isControlChar(code: number): boolean {
	return (code >= 0x00 && code <= 0x08) || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f);
}

/**
 * Returns true when the value has whitespace immediately before a newline AND
 * the value contains a non-trailing newline. Equivalent to the regex pair
 * `/[\t ]\n/.test(s) && s.replace(/\n+$/, "").includes("\n")` but uses linear
 * imperative scans to avoid polynomial-time regex behaviour on adversarial
 * inputs containing many trailing newlines.
 */
export function hasInteriorTrailingWhitespace(s: string): boolean {
	let firstWsBeforeNl = -1;
	for (let i = 1; i < s.length; i++) {
		if (s.charCodeAt(i) === 0x0a) {
			const prev = s.charCodeAt(i - 1);
			if (prev === 0x20 || prev === 0x09) {
				firstWsBeforeNl = i;
				break;
			}
		}
	}
	if (firstWsBeforeNl < 0) return false;
	let trailingStart = s.length;
	while (trailingStart > 0 && s.charCodeAt(trailingStart - 1) === 0x0a) trailingStart--;
	// Confirm the whitespace-before-newline is not purely in the trailing newline
	// block. If firstWsBeforeNl >= trailingStart the whitespace sits on the last
	// content line only, which block style handles correctly via the chomp
	// indicator — only an INTERIOR newline followed by content matters here.
	for (let i = 0; i < trailingStart; i++) {
		if (s.charCodeAt(i) === 0x0a) return true;
	}
	return false;
}

/**
 * Returns true when the value contains a newline followed by one or more
 * spaces and then a tab — mixed leading whitespace on a continuation line
 * that block style cannot represent unambiguously.
 */
export function hasNewlineSpacesTab(s: string): boolean {
	for (let i = 0; i < s.length - 2; i++) {
		if (s.charCodeAt(i) !== 0x0a) continue;
		let j = i + 1;
		while (j < s.length && s.charCodeAt(j) === 0x20) j++;
		if (j > i + 1 && j < s.length && s.charCodeAt(j) === 0x09) return true;
	}
	return false;
}

/**
 * Renders a multi-line value as a single-quoted scalar with proper fold encoding.
 *
 * Single-quoted scalars use line folding rules (YAML 1.2 §7.4): bare newlines
 * between non-empty lines fold to a space; empty lines preserve as literal
 * newlines. To round-trip a value with N consecutive literal newlines, the
 * source needs N+1 consecutive source newlines (i.e., one extra to account
 * for the bare newline that would otherwise fold to a space).
 *
 * Continuation lines are prefixed with the given indent. Leading whitespace
 * on continuation lines after the indent is preserved as part of the content
 * because empty lines precede them, suppressing the fold-to-space rule.
 *
 * Returns null if the content cannot safely be represented as single-quoted
 * (carriage returns or non-tab control characters).
 */
export function renderSingleQuotedMultiline(s: string, indent: string): string | null {
	// CR or non-tab control chars cannot be represented in single-quoted
	for (let i = 0; i < s.length; i++) {
		const code = s.charCodeAt(i);
		if (code === 0x0d || isControlChar(code)) return null;
	}
	const escaped = s.replace(/'/g, "''");
	let result = "";
	let i = 0;
	let firstSegment = true;
	while (i < escaped.length) {
		let segEnd = i;
		while (segEnd < escaped.length && escaped[segEnd] !== "\n") segEnd++;
		const segment = escaped.slice(i, segEnd);
		if (firstSegment) {
			result += segment;
			firstSegment = false;
		} else {
			result += `${indent}${segment}`;
		}
		i = segEnd;
		let nlEnd = i;
		while (nlEnd < escaped.length && escaped[nlEnd] === "\n") nlEnd++;
		const nlCount = nlEnd - i;
		if (nlCount > 0) {
			// Each literal newline in value requires one extra source newline
			result += "\n".repeat(nlCount + 1);
		}
		i = nlEnd;
	}
	return `'${result}'`;
}

/**
 * Renders a string scalar using block literal style (pipe `|`).
 *
 * @param explicitChomp - Original chomp indicator from the AST, when known.
 * `keep` (`+`) and `strip` (`-`) preserve trailing-newline semantics that
 * cannot be inferred from the resolved value alone.
 * @param preserveKeep - Re-emit a REDUNDANT explicit `+` (a keep header whose
 * value ends in exactly one newline, where clip would read identically) —
 * fidelity-path header preservation; canonical mode passes false.
 * @param explicitIndent - Explicit indentation-indicator digit from the AST,
 * re-emitted only when it matches the rendered indent (fidelity path).
 */
export function renderBlockLiteral(
	s: string,
	indent: string,
	explicitChomp?: "strip" | "clip" | "keep",
	parentPosition?: "block-map-value" | "block-seq-item",
	preserveKeep = false,
	explicitIndent?: number,
): string {
	// Compute chomp indicator from the value's trailing-newline structure.
	// `+` (keep) is required when the value retains more than one trailing
	// newline OR when the value consists solely of newlines (otherwise `|`
	// with empty content would parse as the empty string, losing the trailing
	// newline). `-` (strip) is required when the value has no trailing
	// newline. Default (clip `|`) preserves exactly one trailing newline —
	// but an EXPLICIT keep header is re-emitted on the fidelity path even
	// when clip would read identically (byte preservation).
	let chomp = "";
	const onlyNewlines = s.length > 0 && /^\n+$/.test(s);
	if (s.endsWith("\n\n") || (onlyNewlines && explicitChomp === "keep")) {
		chomp = "+";
	} else if (!s.endsWith("\n")) {
		chomp = "-";
	} else if (preserveKeep && explicitChomp === "keep") {
		chomp = "+";
	}
	const lines = s.split("\n");
	// If the string ends with \n, the last element is empty — drop it for rendering
	if (s.endsWith("\n")) {
		lines.pop();
	}
	// Explicit indent indicator needed when:
	// - First content line starts with space (reader would misdetect indent)
	// - Value starts with empty lines AND has actual content (reader can't
	//   auto-detect indent from leading blanks).
	// - Newline-only body with keep-chomp under a block-map value (K858):
	//   libyaml's canonical emitter emits `|2+` here since the parent's value
	//   indent is already established by sibling pairs and the empty body is
	//   ambiguous without an explicit indicator. Block-seq items (JEF9) do
	//   not get the indicator — there the `-` already anchors the entry.
	let indentIndicator = "";
	const firstContent = lines.find((l) => l !== "");
	const hasContent = firstContent !== undefined;
	if (firstContent?.startsWith(" ") || (lines.length > 0 && lines[0] === "" && hasContent)) {
		indentIndicator = String(indent.length);
	} else if (!hasContent && chomp === "+" && parentPosition === "block-map-value" && indent.length > 0) {
		indentIndicator = String(indent.length);
	} else if (explicitIndent !== undefined && explicitIndent === indent.length) {
		// Fidelity path: the source spelled a redundant explicit indicator
		// (`|2` over content the reader could auto-detect) — re-emit it when
		// it matches the rendered indent, byte-preserving the header.
		indentIndicator = String(explicitIndent);
	}
	return `|${indentIndicator}${chomp}\n${lines.map((l) => (l === "" ? "" : `${indent}${l}`)).join("\n")}`;
}

/**
 * Renders a string scalar using block folded style (greater-than `>`).
 *
 * In folded block scalars, a single newline between content lines is folded
 * into a space by the reader. To preserve a literal newline in the value,
 * the output must contain an empty line (double newline). Each empty line
 * in the value already produces the correct number of blank lines.
 */
export function renderBlockFolded(
	s: string,
	indent: string,
	explicitChomp?: "strip" | "clip" | "keep",
	explicitIndent?: number,
): string {
	// Chomp derivation mirrors renderBlockLiteral; `explicitChomp` /
	// `explicitIndent` are fidelity-path header preservation (a redundant
	// explicit `+` or `>2` re-emits byte-intact) — canonical callers pass
	// neither.
	let chomp = "";
	if (s.endsWith("\n\n")) {
		chomp = "+";
	} else if (!s.endsWith("\n")) {
		chomp = "-";
	} else if (explicitChomp === "keep") {
		chomp = "+";
	}

	// Split the value into lines and build folded output.
	// In folded scalars, the reader folds bare newlines between same-indent
	// content lines into spaces. To preserve a literal \n in the value:
	// - Between two "normal" (non-indented) lines → insert empty line
	// - Before a "more-indented" line (starts with space/tab) → no extra line
	//   needed, the reader preserves newlines before more-indented lines
	// - Empty lines in the value → emit as-is (already preserved by reader)
	const valueLines = s.split("\n");
	if (s.endsWith("\n")) {
		valueLines.pop();
	}

	// Explicit indent indicator needed when first content line starts with
	// space, or when the value starts with two-or-more empty lines and has
	// actual content. A single leading blank line is fine without the
	// indicator because the next non-empty content line still establishes
	// the indent, but multiple leading blanks introduce enough ambiguity
	// that libyaml's canonical form emits the explicit indicator.
	let indentIndicator = "";
	const firstContent = valueLines.find((l) => l !== "");
	if (
		firstContent?.startsWith(" ") ||
		(valueLines.length >= 2 && valueLines[0] === "" && valueLines[1] === "" && firstContent !== undefined)
	) {
		indentIndicator = String(indent.length);
	} else if (explicitIndent !== undefined && explicitIndent === indent.length) {
		// Fidelity path: re-emit the source's redundant explicit indicator
		// when it matches the rendered indent — see renderBlockLiteral.
		indentIndicator = String(explicitIndent);
	}

	// Build folded output from the resolved value lines.
	//
	// Folded scalar reading rules (YAML 1.2 §8.2.1):
	// - Bare newline between same-indent content lines → folded to space
	// - Empty line (blank line) → preserves the newline
	// - The line break BEFORE an empty line or more-indented line is also
	//   preserved (not folded)
	//
	// To reverse this for rendering:
	// - Between consecutive non-empty, non-more-indented lines: insert an
	//   empty line (prevents the reader from folding to space)
	// - When a non-empty line is followed by empty line(s): the line break
	//   after the content is preserved by the reader, so we need an extra
	//   empty line in the output to account for it
	const outputLines: string[] = [];
	// Index of the last non-empty value line, precomputed once so the loop
	// never rescans forward. A blank run past this index is TRAILING and has
	// no fold to reverse: those breaks are governed by chomping and map 1:1
	// to value newlines, so emitting a compensation line there would grow a
	// keep-chomp scalar by one newline per round-trip.
	let lastContentIdx = -1;
	for (let i = valueLines.length - 1; i >= 0; i--) {
		if (valueLines[i] !== "") {
			lastContentIdx = i;
			break;
		}
	}
	let prevNonEmpty = false;
	let prevMoreIndented = false;
	// Set at the first blank after non-empty, non-more-indented content when
	// more content follows; resolved when that content is reached. Every line
	// in a blank run is the identical `""`, so emitting the compensation line
	// at the end of the run instead of its start is byte-identical output.
	let pendingCompensation = false;
	for (let i = 0; i < valueLines.length; i++) {
		const line = valueLines[i];
		if (line === "") {
			// If the previous line was non-empty, non-more-indented content,
			// the \n after it is preserved (not folded) because it's followed
			// by an empty line. Emit an extra empty line for that preserved \n.
			// Exception: if the next non-empty content is more-indented, the
			// reader already preserves the linebreak, so skip the extra line
			// (decided when that content line is reached).
			if (prevNonEmpty && !prevMoreIndented && i < lastContentIdx) {
				pendingCompensation = true;
			}
			outputLines.push("");
			prevNonEmpty = false;
			prevMoreIndented = false;
		} else {
			const isMoreIndented = line.startsWith(" ") || line.startsWith("\t");
			if (pendingCompensation) {
				if (!isMoreIndented) {
					outputLines.push("");
				}
				pendingCompensation = false;
			}
			if (prevNonEmpty && !isMoreIndented) {
				// Fold break: insert empty line between consecutive content lines
				outputLines.push("");
			}
			outputLines.push(`${indent}${line}`);
			prevNonEmpty = true;
			prevMoreIndented = isMoreIndented;
		}
	}

	return `>${indentIndicator}${chomp}\n${outputLines.join("\n")}`;
}
