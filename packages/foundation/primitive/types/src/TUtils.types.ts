/**
 * General-purpose type utilities for `@beep/types`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Converts a union type into an intersection type.
 *
 * **Example** (Converting union to intersection)
 *
 * ```ts
 * import type { TUtils } from "@beep/types"
 *
 * type Combined = TUtils.UnionToIntersection<
 *   { readonly id: string } | { readonly name: string }
 * >
 *
 * const combined: Combined = { id: "entity", name: "Mixin" }
 * console.log(combined)
 * ```
 *
 * @typeParam Union - Union type whose members should be collapsed into an intersection.
 * @category utilities
 * @since 0.0.0
 */
export type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection
) => void
  ? Intersection
  : never;

/**
 * Expands an object type into a readable readonly property map.
 *
 * **Example** (Simplifying intersection object type)
 *
 * ```ts
 * import type { TUtils } from "@beep/types"
 *
 * type EntityShape = TUtils.Simplify<
 *   { readonly id: string } & { readonly name: string }
 * >
 *
 * const entity: EntityShape = { id: "entity", name: "Mixin" }
 * console.log(entity)
 * ```
 *
 * @typeParam T - Property-bearing type to expand.
 * @category utilities
 * @since 0.0.0
 */
export type Simplify<T> = { readonly [K in keyof T]: T[K] } & {};
