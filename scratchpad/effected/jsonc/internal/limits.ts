// Shared hardening limits. Lives in its own leaf module so every recursive
// surface (parser, AST evaluator, equality walker, SAX visitor, canonicalizer)
// imports the same cap without an import cycle.

/**
 * Maximum collection-nesting depth any recursive walk over untrusted input
 * descends into before failing through its typed channel.
 *
 * **Details**
 *
 * Every stage that recurses per node is a stack-overflow denial-of-service
 * vector on deeply nested input: the recursive-descent parser (value and tree
 * mode), `JsoncNode.toValue`, `Jsonc.equals`, the `JsoncVisitor` walk and the
 * `JsoncFingerprint` canonicalizer. Each one caps out at this depth and reports
 * a `NestingDepthExceeded` parse error, an in-band visitor `Error` event, a
 * typed canonicalize error or a bounded placeholder instead of throwing a
 * `RangeError` as a defect.
 *
 * **Example** (Compare a document's depth against the cap)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/scratchpad/effected/jsonc/internal/limits"
 *
 * const depth = 300
 *
 * console.log(depth > MAX_NESTING_DEPTH) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;
