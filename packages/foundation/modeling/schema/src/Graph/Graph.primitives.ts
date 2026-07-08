/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import { isNonNegative } from "../Number.ts";
import { $I } from "./Graph.shared.ts";

/**
 * Branded schema for graph node indices.
 *
 * Validates that the value is a non-negative integer.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeIndex } from "@beep/schema/Graph"
 *
 * const decode = S.decodeUnknownSync(NodeIndex)
 *
 * const idx = decode(0)
 * console.log(idx) // 0
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const NodeIndex = S.Int.check(isNonNegative).pipe(
  S.brand("NodeIndex"),
  $I.annoteSchema("NodeIndex", {
    description: "A branded non-negative graph node index.",
  })
);

/**
 * Branded node index type extracted from {@link NodeIndex}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeIndex } from "@beep/schema/Graph"
 *
 * const idx: NodeIndex = S.decodeUnknownSync(NodeIndex)(0)
 * console.log(idx) // 0
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type NodeIndex = typeof NodeIndex.Type;

/**
 * Decode a string-encoded graph node index into a branded {@link NodeIndex}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeIndexFromString } from "@beep/schema/Graph"
 *
 * const decode = S.decodeUnknownSync(NodeIndexFromString)
 *
 * const idx = decode("3")
 * console.log(idx) // 3
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const NodeIndexFromString = S.FiniteFromString.pipe(
  S.decodeTo(NodeIndex),
  $I.annoteSchema("NodeIndexFromString", {
    description: "A graph node index decoded from a string.",
  })
);

/**
 * Branded schema for graph edge indices.
 *
 * @example
 * ```ts
 * import { EdgeIndex } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const index = S.decodeUnknownSync(EdgeIndex)(1)
 * console.log(index)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EdgeIndex = S.Int.check(isNonNegative).pipe(
  S.brand("EdgeIndex"),
  $I.annoteSchema("EdgeIndex", {
    description: "A branded non-negative graph edge index.",
  })
);

/**
 * Branded edge index type extracted from {@link EdgeIndex}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EdgeIndex } from "@beep/schema/Graph"
 *
 * const idx: EdgeIndex = S.decodeUnknownSync(EdgeIndex)(1)
 * console.log(idx)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EdgeIndex = typeof EdgeIndex.Type;

/**
 * Decode a string-encoded graph edge index into a branded {@link EdgeIndex}.
 *
 * @example
 * ```ts
 * import { EdgeIndexFromString } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const index = S.decodeUnknownSync(EdgeIndexFromString)("2")
 * console.log(index)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const EdgeIndexFromString = S.FiniteFromString.pipe(
  S.decodeTo(EdgeIndex),
  $I.annoteSchema("EdgeIndexFromString", {
    description: "A graph edge index decoded from a string.",
  })
);

/**
 * Schema for graph kind discriminators.
 *
 * @example
 * ```ts
 * import { GraphKind } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(GraphKind)("directed")
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const GraphKind = S.Literals(["directed", "undirected"]).pipe(
  $I.annoteSchema("GraphKind", {
    description: "The graph kind discriminator used by Effect Graph values.",
  })
);

/**
 * Graph kind discriminator type extracted from {@link GraphKind}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GraphKind } from "@beep/schema/Graph"
 *
 * const kind: GraphKind = S.decodeUnknownSync(GraphKind)("directed")
 * console.log(kind)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GraphKind = typeof GraphKind.Type;
