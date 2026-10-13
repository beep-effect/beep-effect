// Internal CST schemas preserve raw source and plain-object construction.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/yaml/internal/cst");

const CstNodeType = LiteralKit([
	"document", "directive", "comment", "block-map", "block-seq", "flow-map", "flow-seq",
	"block-scalar", "flow-scalar", "alias", "anchor", "tag", "whitespace", "newline", "error",
]).annotate($I.annote("CstNodeType", { description: "The fifteen categories produced by the YAML CST parser." }));

/**
 * The 15 node types produced by the YAML CST parser.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstNodeType = typeof CstNodeType.Type;

const CstNodeFields = S.Struct({
	type: CstNodeType.annotateKey({ description: "Syntactic category of the raw node." }),
	source: S.String.annotateKey({ description: "Uninterpreted source slice, including structural punctuation." }),
	offset: S.Finite.annotateKey({ description: "Zero-based UTF-16 offset in the input source." }),
	length: S.Finite.annotateKey({ description: "Length of the source slice in UTF-16 code units." }),
}).annotate($I.annote("CstNodeFields", { description: "Non-recursive fields of a concrete syntax node." }));

// The recursive knot gives suspend a concrete return type; all other fields
// and the exported node type are inferred from the structural schemas.
type RecursiveCstNode = typeof CstNodeFields.Type & {
	readonly children?: ReadonlyArray<RecursiveCstNode>;
};

/**
 * Recursive raw syntax node codec, retaining child source spans.
 *
 * **Example** (Validate a nested raw node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CstNode } from "@beep/scratchpad/effected/yaml/internal/cst"
 * console.log(S.is(CstNode)({ type: "document", source: "", offset: 0, length: 0, children: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CstNode = S.Struct({
	...CstNodeFields.fields,
	children: S.suspend((): S.Codec<RecursiveCstNode> => CstNode).pipe(S.Array, S.optionalKey)
		.annotateKey({ description: "Ordered raw children of a container; absent on leaf nodes." }),
}).annotate($I.annote("CstNode", { description: "Recursive concrete syntax tree preserving every raw source span." }));

/**
 * A single YAML CST node: its type, raw source slice, span, and optional
 * recursive children. No interpretation occurs at the CST level — `true` is
 * still the string `"true"`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CstNode = typeof CstNode.Type;
