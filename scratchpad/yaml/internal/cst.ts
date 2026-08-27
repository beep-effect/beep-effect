/**
 * Internal Concrete Syntax Tree types for the YAML engine.
 *
 * **Details**
 *
 * The CST layer is not public surface — a `Stream<CstNode>` interface is
 * deferred until an LSP-style consumer materializes. No interpretation
 * occurs here: the scalar `true` is still the source string `"true"`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("yaml/internal/cst");

/**
 * The 15 node types produced by the YAML CST parser.
 *
 * **Example** (Recognize a scalar node kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CstNodeType } from "@beep/scratchpad/yaml/internal/cst"
 *
 * console.log(S.is(CstNodeType)("flow-scalar")) // true
 * ```
 *
 * @see {@link CstNode} for the recursive node that carries one of these types.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const CstNodeType = Schema.Literals([
	"document",
	"directive",
	"comment",
	"block-map",
	"block-seq",
	"flow-map",
	"flow-seq",
	"block-scalar",
	"flow-scalar",
	"alias",
	"anchor",
	"tag",
	"whitespace",
	"newline",
	"error",
]).pipe(
	$I.annoteSchema("CstNodeType", {
		description: "Node kinds produced by the internal YAML concrete-syntax parser.",
	}),
);

/**
 * TypeScript representation of node kinds produced by the internal YAML concrete-syntax parser.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstNodeType = typeof CstNodeType.Type;

/**
 * A single YAML CST node: its type, raw source slice, span, and optional
 * recursive children. No interpretation occurs at the CST level — `true` is
 * still the string `"true"`.
 *
 * **Details**
 *
 * The explicit recursive type annotation is the same cycle-breaking shape
 * used by `YamlNode`: the runtime codec remains the source of validation,
 * while the annotation lets TypeScript name its own recursive output.
 *
 * **Example** (Decode a scalar CST node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CstNode } from "@beep/scratchpad/yaml/internal/cst"
 *
 * const node = S.decodeUnknownSync(CstNode)({ type: "flow-scalar", source: "x", offset: 0, length: 1 })
 * console.log(node.type) // "flow-scalar"
 * ```
 *
 * @see {@link parseCSTAll} for the parser that produces these nodes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CstNode = {
	readonly type: CstNodeType;
	readonly source: string;
	readonly offset: number;
	readonly length: number;
	readonly children?: ReadonlyArray<CstNode>;
};

/**
 * Recursive runtime codec for YAML concrete-syntax nodes.
 *
 * **Example** (Decode a scalar node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CstNode } from "@beep/scratchpad/yaml/internal/cst"
 *
 * const node = S.decodeUnknownSync(CstNode)({
 *   type: "flow-scalar",
 *   source: "x",
 *   offset: 0,
 *   length: 1
 * })
 * console.log(node.source) // "x"
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CstNode: Schema.Codec<CstNode> = Schema.Struct({
	type: CstNodeType,
	source: Schema.String,
	offset: Schema.Finite,
	length: Schema.Finite,
	children: Schema.optionalKey(Schema.Array(Schema.suspend((): Schema.Codec<CstNode> => CstNode))),
}).pipe(
	$I.annoteSchema("CstNode", {
		description: "Recursive YAML concrete-syntax node with its raw source slice and optional children.",
	}),
);
