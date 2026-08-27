// Shared hardening limits. Private implementation, zero dependencies.
//
// Lives in its own leaf module so every recursive surface — the parser, the
// AST value-extractor, the semantic-equality walker and the SAX visitor — can
// import the same cap without an import cycle (the parser imports
// `JsoncNode`, so `JsoncNode` must not import the parser).

/**
 * Maximum collection-nesting depth any recursive walk over untrusted input will
 * descend into. Every stage that recurses per node — the recursive-descent
 * parser (value and tree mode), {@link JsoncNode.toValue}'s evaluator, the
 * `Jsonc.equals` structural comparison and the `JsoncVisitor` SAX walk — is a
 * stack-overflow denial-of-service vector on deeply-nested input, so each caps
 * out here and fails through its typed channel (a `NestingDepthExceeded` parse
 * error, an in-band visitor `Error` event, or a bounded placeholder) instead of
 * throwing `RangeError: Maximum call stack size exceeded` as a defect.
 *
 * 256 is far beyond any real document and leaves a wide margin under the
 * observed single-frame overflow point. Mirrors `@effected/yaml`'s composer cap
 * for cross-package parity.
 */
export const MAX_NESTING_DEPTH = 256;
