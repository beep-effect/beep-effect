/**
 * Package entry point for `@beep/contract-kit`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Model-shaped catalogs that let a contract package declare a client Api
 * with no aggregate behind it.
 *
 * **Example** (Import the catalog namespace)
 *
 * ```ts
 * import * as Catalog from "@beep/contract-kit/Catalog"
 *
 * console.log(typeof Catalog.make) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as Catalog from "./Catalog.ts";
/**
 * RPC wire shapes for the parity test between a contract Api and its model
 * Api.
 *
 * **Example** (Import the parity namespace)
 *
 * ```ts
 * import * as Parity from "@beep/contract-kit/Parity"
 *
 * console.log(typeof Parity.groupShape) // "function"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export * as Parity from "./Parity.ts";
