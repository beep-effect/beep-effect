// String-level frontmatter split and join — the raw-source surface, usable
// without parsing the body at all.
//
// The `MarkdownFrontmatter` seam requires a parsed `MarkdownDocument`; this
// module serves the consumer whose body the CommonMark engine cannot or
// should not parse (an MDX page, a template) and whose contract is
// byte-exact boundaries (a snapshot hash over the body). It runs the SAME
// closed fence grammar as the parser's offset-0 pre-scan — `---` yaml,
// `+++` toml, `---json` json, fence lines exactly the fence, an unclosed
// fence is not frontmatter — over raw bytes, and never parses the
// frontmatter value or the body: string level only, decoding is the codec
// modules' business.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RawNewline, scanRawFrontmatter } from "./internal/blocks/frontmatter.ts";
import { FrontmatterFormat } from "./MarkdownNode.ts";

const $I = $ScratchpadId.create("effected/markdown/FrontmatterSource");

/**
 * The three line-terminator spellings a fence line may end with. Recorded by
 * {@link FrontmatterSource.split} as fidelity — what the source's fence
 * lines actually used — and consumed by {@link FrontmatterSource.join}.
 *
 * **Example** (Validate a CRLF fence terminator)
 *
 * ```ts
 * import { FrontmatterNewline } from "@beep/scratchpad/effected/markdown/FrontmatterSource";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FrontmatterNewline)("\r\n")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FrontmatterNewline = RawNewline.annotate($I.annote("FrontmatterNewline", { description: "The three line-terminator spellings a fence line may end with. Recorded by FrontmatterSource.split as fidelity — what the source's fence lines actually used — and consumed by FrontmatterSource.join." }));

/**
 * The union of all fence line-terminator literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterNewline = typeof FrontmatterNewline.Type;

/**
 * A frontmatter block at string level: the format its fence declared, the
 * exact bytes between the fence lines, and the fence lines' terminator.
 *
 * **Details**
 *
 * `value` is the exact source slice strictly between the opening fence line
 * (its terminator included) and the closing fence line: every value line
 * WITH its own terminator, verbatim — so a block whose value is one blank
 * line (`"\n"`) stays distinct from a block with no value lines (`""`), and
 * interior CRLF terminators survive untouched. This deliberately differs
 * from the parsed `Frontmatter` NODE's `value`, which drops the final
 * terminator; the node feeds codecs, this feeds byte-exact reconstruction.
 * {@link FrontmatterSource.join} accepts a value without a trailing
 * terminator too, appending `newline` so a hand-built block cannot fuse its
 * last line into the closing fence.
 *
 * `newline` is a fidelity field: `split` always records the terminator
 * following the opening fence; when absent (a hand-built block), `join`
 * uses `"\n"`.
 *
 * **Example** (Keep the value line terminator)
 *
 * ```ts
 * import { FrontmatterSourceBlock } from "@beep/scratchpad/effected/markdown/FrontmatterSource";
 *
 * const block = FrontmatterSourceBlock.make({ format: "yaml", value: "title: hi\n" });
 * console.log(block.value.endsWith("\n")); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class FrontmatterSourceBlock extends S.Class<FrontmatterSourceBlock>($I`FrontmatterSourceBlock`)({
	format: FrontmatterFormat.annotateKey({ description: "Frontmatter encoding declared by the opening fence: YAML, TOML or JSON" }),
	value: S.String.annotateKey({ description: "Exact source text between the fence lines, preserving every value line's terminator" }),
	newline: S.optionalKey(FrontmatterNewline).annotateKey({ description: "Opening fence's line terminator, reused for both fences when joining; defaults to LF when omitted" }),
}, $I.annote("FrontmatterSourceBlock", { description: "A frontmatter block at string level: the format its fence declared, the exact bytes between the fence lines, and the fence lines' terminator." })) {}

/**
 * The result of {@link FrontmatterSource.split}: the frontmatter block when
 * one exists, the exact body remainder, and the body's byte offset.
 *
 * **Details**
 *
 * `body` is exactly `source.slice(bodyOffset)` — the string and the offset
 * can never disagree. With no block, `body` is the whole source and
 * `bodyOffset` is `0`. With a block, `bodyOffset` sits immediately after
 * the closing fence line and its line terminator (the terminator belongs to
 * the fence line, as every line's terminator belongs to its line), which is
 * gray-matter's body boundary; when the closing fence ends the document
 * there is no terminator and the body is empty.
 *
 * `bodyOffset` is informational output of `split`; `join` never reads it,
 * and it constructor-defaults to `0` so a hand-built value for `join` can
 * omit it.
 *
 * **Example** (Build a body without frontmatter)
 *
 * ```ts
 * import { FrontmatterSourceSplit } from "@beep/scratchpad/effected/markdown/FrontmatterSource";
 *
 * const split = FrontmatterSourceSplit.make({ body: "# Body" });
 * console.log(split.bodyOffset); // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class FrontmatterSourceSplit extends S.Class<FrontmatterSourceSplit>($I`FrontmatterSourceSplit`)({
	frontmatter: S.optionalKey(FrontmatterSourceBlock).annotateKey({ description: "Closed frontmatter block captured at the start of the source, absent when no matching block exists" }),
	body: S.String.annotateKey({ description: "Exact source remainder after the closing fence and its terminator, or the whole source when no block exists" }),
	bodyOffset: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0))).annotateKey({ description: "Zero-based UTF-16 source offset where the body begins, immediately after the closing fence and terminator, or zero without frontmatter" }),
}, $I.annote("FrontmatterSourceSplit", { description: "The result of FrontmatterSource.split: the frontmatter block when one exists, the exact body remainder, and the body's byte offset." })) {}

/** The opening fence line per format (the closed grammar's spellings). */
const OPEN_FENCE: Record<FrontmatterFormat, string> = {
	yaml: "---",
	toml: "+++",
	json: "---json",
};

/** The closing fence line per format. */
const CLOSE_FENCE: Record<FrontmatterFormat, string> = {
	yaml: "---",
	toml: "+++",
	json: "---",
};

/**
 * The string-level frontmatter facade: split raw source at the fence
 * boundaries and join it back, without parsing anything.
 *
 * **Example** (Round-trip a fenced document)
 *
 * ```ts
 * import { FrontmatterSource } from "@beep/scratchpad/effected/markdown/FrontmatterSource";
 *
 * const source = "---\ntitle: hi\n---\n# Body\n";
 * console.log(FrontmatterSource.join(FrontmatterSource.split(source)) === source); // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class FrontmatterSource {
	private constructor() {}

	/**
	 * Split raw source into its frontmatter block and body, at string level.
	 * Total: never fails, never parses — absence of a block (including an
	 * opening fence with no closing fence, which per the grammar is not
	 * frontmatter) is a representable result, not an error.
	 *
	 * **Details**
	 *
	 * The grammar is the parser's own offset-0 pre-scan, over raw bytes:
	 * the fence set is closed (`---` yaml, `+++` toml, `---json` json), a
	 * fence line is exactly the fence with no surrounding whitespace, and a
	 * leading BOM means offset 0 is not a fence — strip one before calling
	 * if the source may carry it. Unlike the parse path there is no capture
	 * toggle here, so absence is one fact: the source has no closed block.
	 * (`MarkdownDocument`'s two-reason absence exists because parsing can be
	 * asked not to look; this surface always looks.)
	 *
	 * Byte exactness: `source.slice(0, result.bodyOffset) + result.body`
	 * reassembles `source` exactly, and {@link FrontmatterSource.join}
	 * reproduces the original bytes for an unmodified round-trip — see
	 * `join` for the two normalizations at the contract's edge.
	 *
	 * **Example** (Split YAML frontmatter from the document body)
	 *
	 * ```ts
	 * import { FrontmatterSource } from "@beep/scratchpad/effected/markdown/FrontmatterSource";
	 *
	 * const split = FrontmatterSource.split("---\ntitle: hi\n---\n\n# Body\n");
	 * console.log(split.frontmatter?.format); // yaml
	 * console.log(split.frontmatter?.value === "title: hi\n"); // true
	 * console.log(split.body === "\n# Body\n"); // true
	 * ```
	 *
	 * @param source - The raw document source, body format irrelevant.
	 * @returns A {@link FrontmatterSourceSplit}; `frontmatter` is absent when
	 *   the source opens with no closed fence block.
	 * @category parsing
	 * @since 0.0.0
	 */
	static split(source: string): FrontmatterSourceSplit {
		const capture = scanRawFrontmatter(source);
		if (capture === null) {
			return FrontmatterSourceSplit.make({ body: source, bodyOffset: 0 });
		}
		return FrontmatterSourceSplit.make({
			frontmatter: FrontmatterSourceBlock.make({
				format: capture.format,
				value: capture.value,
				newline: capture.newline,
			}),
			body: source.slice(capture.bodyOffset),
			bodyOffset: capture.bodyOffset,
		});
	}

	/**
	 * Serialize a split back to one source string. Total and pure.
	 *
	 * **Details**
	 *
	 * With no block the body is returned verbatim. With a block the output
	 * is the opening fence, `newline` (default `"\n"`), the value — a
	 * non-empty value missing a final line terminator gets `newline`
	 * appended, so the closing fence always starts its own line — the
	 * closing fence, `newline`, then the body verbatim.
	 *
	 * **Round-trip contract:** `join(split(source)) === source`, byte for
	 * byte, for every source whose closing fence line ends with a line
	 * terminator matching the opening fence's. The two edges where join
	 * normalizes instead: a closing fence at end-of-document gains a final
	 * `newline` (the block's one unterminated spelling), and fence lines
	 * with MISMATCHED terminators (say `---\r\n … ---\n`) re-emit both with
	 * the opening one. Value and body bytes survive verbatim in every case.
	 *
	 * **Example** (Join a hand-built block and body)
	 *
	 * ```ts
	 * import { FrontmatterSource, FrontmatterSourceBlock, FrontmatterSourceSplit } from "@beep/scratchpad/effected/markdown/FrontmatterSource";
	 *
	 * const split = FrontmatterSourceSplit.make({
	 *   frontmatter: FrontmatterSourceBlock.make({ format: "json", value: "{}" }),
	 *   body: "# Body\n",
	 * });
	 * console.log(FrontmatterSource.join(split) === "---json\n{}\n---\n# Body\n"); // true
	 * ```
	 *
	 * @param split - The parts to serialize, typically from
	 *   {@link FrontmatterSource.split} or built with
	 *   `FrontmatterSourceSplit.make`.
	 * @returns The combined source string.
	 * @category formatting
	 * @since 0.0.0
	 */
	static join(split: FrontmatterSourceSplit): string {
		const block = split.frontmatter;
		if (block === undefined) {
			return split.body;
		}
		const newline = block.newline ?? "\n";
		const value =
			block.value === "" || block.value.endsWith("\n") || block.value.endsWith("\r")
				? block.value
				: `${block.value}${newline}`;
		return `${OPEN_FENCE[block.format]}${newline}${value}${CLOSE_FENCE[block.format]}${newline}${split.body}`;
	}
}
