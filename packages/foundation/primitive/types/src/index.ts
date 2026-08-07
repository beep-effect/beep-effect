/**
 * Shared utility types for the beep platform.
 *
 * **Details**
 *
 * Provides array, string, and unsafe type-level utilities used across packages.
 *
 * **Example** (Compose shared utility types)
 *
 * ```ts
 * import type { TArray, TString, TUnsafe, TUtils } from "@beep/types"
 *
 * type Element = TArray.Elem<readonly ["id", "name"]>
 * type NonEmptyName = TString.NonEmpty<"Entity">
 * type EntityShape = TUtils.Simplify<{ readonly id: Element } & { readonly name: NonEmptyName }>
 *
 * const log = (value: TUnsafe.Any) => console.log(value)
 * const entity: EntityShape = { id: "id", name: "Entity" }
 * log(entity)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Array utility types.
 *
 * **Example** (Extract tuple element type)
 *
 * ```ts
 * import type { TArray } from "@beep/types"
 *
 * type Element = TArray.Elem<readonly ["id", "name"]>
 *
 * const element: Element = "id"
 * console.log(element)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type * as TArray from "./TArray.types.ts";
/**
 * String utility types.
 *
 * **Example** (Brand non-empty string type)
 *
 * ```ts
 * import type { TString } from "@beep/types"
 *
 * type Name = TString.NonEmpty<"Entity">
 *
 * const name: Name = "Entity"
 * console.log(name)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type * as TString from "./TString.types.ts";
/**
 * Unsafe type aliases for auditable escape hatches.
 *
 * **Example** (Accept values as Any)
 *
 * ```ts
 * import type { TUnsafe } from "@beep/types"
 *
 * const log = (value: TUnsafe.Any) => console.log(value)
 * log("hello")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type * as TUnsafe from "./TUnsafe.types.ts";
/**
 * General-purpose type utilities.
 *
 * **Example** (Simplify intersection object type)
 *
 * ```ts
 * import type { TUtils } from "@beep/types"
 *
 * type EntityShape = TUtils.Simplify<{ readonly id: string } & { readonly name: string }>
 *
 * const entity: EntityShape = { id: "entity", name: "Mixin" }
 * console.log(entity)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type * as TUtils from "./TUtils.types.ts";
