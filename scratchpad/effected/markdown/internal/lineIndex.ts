// An offset -> unist Point (1-based line/column) index. Built once per parse
// from the source text, iteratively (a single forward scan, no recursion),
// then queried by binary search — MarkdownNode.ts's Point construction is the
// consumer. Imports nothing; this module never participates in the cycle
// firewall (src/internal/ never imports public modules, and this file
// imports nothing at all).

/** A 1-based line/column pair, unist's `Point` shape minus the `offset` field. */
export interface LineColumn {
	readonly line: number;
	readonly column: number;
}

/**
 * A precomputed index of line-start offsets over a fixed source text,
 * answering `positionAt(offset)` in `O(log n)` via binary search rather than
 * rescanning the text per query.
 *
 * @remarks
 * Only `\n` begins a new line. A `\r` immediately before a `\n` (CRLF) is
 * left as the trailing character of the prior line — the pair still reads as
 * a single boundary because the following `\n` is what advances the line
 * counter, not the `\r`. A bare `\r` (old Mac line endings) is not
 * recognized as a break; CommonMark's preprocessing pass normalizes those
 * before this index is ever built.
 */
export class LineIndex {
	private constructor(
		private readonly text: string,
		private readonly lineStarts: ReadonlyArray<number>,
	) {}

	/**
	 * Build a {@link LineIndex} over `text` with one forward scan.
	 *
	 * @remarks
	 * Recognizes only `\n`, which is why the block pass hands over its own
	 * line table instead — see {@link LineIndex.fromLineStarts}.
	 */
	static make(text: string): LineIndex {
		const lineStarts: number[] = [0];
		for (let i = 0; i < text.length; i++) {
			if (text.charCodeAt(i) === 0x0a) {
				lineStarts.push(i + 1);
			}
		}
		return new LineIndex(text, lineStarts);
	}

	/**
	 * Build a {@link LineIndex} over `text` from a line table someone else
	 * already computed.
	 *
	 * @remarks
	 * The parser splits lines on `\r\n`, `\n` AND a bare `\r`; this index's
	 * own scan recognizes only `\n`. For any document without a bare `\r` the
	 * two agree, but for one with them they disagree about what a line is, and
	 * every reported line number would be wrong. Handing the parser's own
	 * table over removes the possibility rather than documenting it: there is
	 * one definition of a line, and it belongs to the preprocessor.
	 *
	 * `starts` must be ascending and begin at 0; a table that is neither is a
	 * wiring bug and dies as a defect.
	 */
	static fromLineStarts(text: string, starts: ReadonlyArray<number>): LineIndex {
		if (starts.length === 0 || starts[0] !== 0) {
			throw new TypeError("line index: a line table must be non-empty and start at offset 0");
		}
		return new LineIndex(text, starts);
	}

	/**
	 * The 1-based `{ line, column }` of `offset` within this index's text.
	 * Out-of-range offsets clamp to the nearest valid position (`0` or
	 * `text.length`) rather than throwing.
	 */
	positionAt(offset: number): LineColumn {
		const clamped = Math.min(Math.max(offset, 0), this.text.length);

		let low = 0;
		let high = this.lineStarts.length - 1;
		while (low < high) {
			const mid = (low + high + 1) >> 1;
			if ((this.lineStarts[mid] ?? 0) <= clamped) {
				low = mid;
			} else {
				high = mid - 1;
			}
		}

		const lineStart = this.lineStarts[low] ?? 0;
		return { line: low + 1, column: clamped - lineStart + 1 };
	}
}
