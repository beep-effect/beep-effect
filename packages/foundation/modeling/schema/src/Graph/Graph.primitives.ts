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
 * **Details**
 *
 * Validates that the value is a non-negative integer.
 *
 * **Example** (Decode zero node index)
 *
 * ```ts import.meta.vitest name="Decode zero node index"
 * import * as S from "effect/Schema"
 * import { NodeIndex } from "@beep/schema/Graph"
 *
 * const decode = S.decodeUnknownSync(NodeIndex)
 *
 * const idx = decode(0)
 * idx // => 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Type branded node index)
 *
 * ```ts import.meta.vitest name="Type branded node index"
 * import * as S from "effect/Schema"
 * import { NodeIndex } from "@beep/schema/Graph"
 *
 * const idx: NodeIndex = S.decodeUnknownSync(NodeIndex)(0)
 * idx // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NodeIndex = typeof NodeIndex.Type;

/**
 * Decode a string-encoded graph node index into a branded {@link NodeIndex}.
 *
 * **Example** (Decode string node index)
 *
 * ```ts import.meta.vitest name="Decode string node index"
 * import * as S from "effect/Schema"
 * import { NodeIndexFromString } from "@beep/schema/Graph"
 *
 * const decode = S.decodeUnknownSync(NodeIndexFromString)
 *
 * const idx = decode("3")
 * idx // => 3
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Decode edge index value)
 *
 * ```ts
 * import { EdgeIndex } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const index = S.decodeUnknownSync(EdgeIndex)(1)
 * console.log(index)
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * **Example** (Type branded edge index)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EdgeIndex } from "@beep/schema/Graph"
 *
 * const idx: EdgeIndex = S.decodeUnknownSync(EdgeIndex)(1)
 * console.log(idx)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EdgeIndex = typeof EdgeIndex.Type;

/**
 * Decode a string-encoded graph edge index into a branded {@link EdgeIndex}.
 *
 * **Example** (Decode string edge index)
 *
 * ```ts
 * import { EdgeIndexFromString } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const index = S.decodeUnknownSync(EdgeIndexFromString)("2")
 * console.log(index)
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Decode directed graph kind)
 *
 * ```ts
 * import { GraphKind } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(GraphKind)("directed")
 * console.log(kind)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const GraphKind = S.Literals(["directed", "undirected"]).pipe(
  $I.annoteSchema("GraphKind", {
    description: "The graph kind discriminator used by Effect Graph values.",
  })
);

/**
 * Graph kind discriminator type extracted from {@link GraphKind}.
 *
 * **Example** (Type directed graph kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GraphKind } from "@beep/schema/Graph"
 *
 * const kind: GraphKind = S.decodeUnknownSync(GraphKind)("directed")
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GraphKind = typeof GraphKind.Type;
