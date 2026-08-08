/**
 * Namespaced collection of unsafe types, intentionally painful to use.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Repository-wide escape hatch for the `any` type.
 *
 * **Details**
 *
 * All code that requires `any` should import this alias so unsafe usage
 * remains visible, auditable, and centralized.
 *
 * **Example** (Using Any escape hatch)
 *
 * ```typescript
 * import type { TUnsafe } from "@beep/types"
 *
 * const log = (value: TUnsafe.Any) => console.log(value)
 * log("hello")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 * biome-ignore lint/suspicious/noExplicitAny: Let this be the only `any` in the repository.
 */
export type Any = any;
