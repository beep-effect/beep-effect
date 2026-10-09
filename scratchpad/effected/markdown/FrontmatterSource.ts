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

import { Effect, Schema } from "effect";
import { scanRawFrontmatter } from "./internal/blocks/frontmatter.ts";
import { FrontmatterFormat } from "./MarkdownNode.ts";

/**
 * The three line-terminator spellings a fence line may end with. Recorded by
 * {@link FrontmatterSource.split} as fidelity — what the source's fence
 * lines actually used — and consumed by {@link FrontmatterSource.join}.
 *
 * @public
 */
export const FrontmatterNewline = Schema.Literals(["\n", "\r\n", "\r"]);

/**
 * The union of all fence line-terminator literals.
 *
 * @public
 */
export type FrontmatterNewline = typeof FrontmatterNewline.Type;

/**
 * A frontmatter block at string level: the format its fence declared, the
 * exact bytes between the fence lines, and the fence lines' terminator.
 *
 * @remarks
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
 * @public
 */
export class FrontmatterSourceBlock extends Schema.Class<FrontmatterSourceBlock>("FrontmatterSourceBlock")({
	format: FrontmatterFormat,
	value: Schema.String,
	newline: Schema.optionalKey(FrontmatterNewline),
}) {}

/**
 * The result of {@link FrontmatterSource.split}: the frontmatter block when
 * one exists, the exact body remainder, and the body's byte offset.
 *
 * @remarks
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
 * @public
 */
export class FrontmatterSourceSplit extends Schema.Class<FrontmatterSourceSplit>("FrontmatterSourceSplit")({
	frontmatter: Schema.optionalKey(FrontmatterSourceBlock),
	body: Schema.String,
	bodyOffset: Schema.Finite.pipe(Schema.withConstructorDefault(Effect.succeed(0))),
}) {}

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
 * @public
 */
export class FrontmatterSource {
	private constructor() {}

	/**
	 * Split raw source into its frontmatter block and body, at string level.
	 * Total: never fails, never parses — absence of a block (including an
	 * opening fence with no closing fence, which per the grammar is not
	 * frontmatter) is a representable result, not an error.
	 *
	 * @remarks
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
	 * @example
	 * ```ts
	 * import { FrontmatterSource } from "./index.ts";
	 *
	 * const split = FrontmatterSource.split("---\ntitle: hi\n---\n\n# Body\n");
	 * console.log(split.frontmatter?.format); // => "yaml"
	 * console.log(split.frontmatter?.value); // => "title: hi\n"
	 * console.log(split.body); // => "\n# Body\n"
	 * ```
	 *
	 * @param source - The raw document source, body format irrelevant.
	 * @returns A {@link FrontmatterSourceSplit}; `frontmatter` is absent when
	 *   the source opens with no closed fence block.
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
	 * @remarks
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
	 * @param split - The parts to serialize, typically from
	 *   {@link FrontmatterSource.split} or built with
	 *   `FrontmatterSourceSplit.make`.
	 * @returns The combined source string.
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
