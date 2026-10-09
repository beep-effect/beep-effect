// These span factories are internal test helpers with direct-call contracts.
// @effect-diagnostics missingPipeableSignature:skip-file
// Position helpers for hand-built trees.
//
// Every node schema requires a `position`, which is right for a parser (it
// always has one) but noisy for tests that care about shape rather than
// offsets. These helpers keep hand-built fixtures readable.

import { Point, Position } from "../../../../effected/markdown/MarkdownNode.ts";

/**
 * A single-line span between two offsets. Line and column are synthesized;
 * nothing that consumes a hand-built tree looks at them.
 */
export const span = (startOffset = 0, endOffset = 0): Position =>
	Position.make({
		start: Point.make({ line: 1, column: 1, offset: startOffset }),
		end: Point.make({ line: 1, column: 1 + endOffset - startOffset, offset: endOffset }),
	});

/**
 * The same shape as {@link span}, as a plain object — for tests that decode
 * untyped JSON rather than constructing nodes.
 */
export const rawSpan = (startOffset = 0, endOffset = 0) => ({
	start: { line: 1, column: 1, offset: startOffset },
	end: { line: 1, column: 1 + endOffset - startOffset, offset: endOffset },
});
