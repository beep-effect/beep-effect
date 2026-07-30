/**
 * App-local file-backed PGlite provisioning for bundle builds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Pglite from "@beep/pglite";

/**
 * Provision the PGlite store owned by a graph bundle.
 *
 * @remarks
 * `relaxedDurability` is deliberate: the store is a derived artifact rebuilt from
 * the corpus whenever it is lost, so trading fsync guarantees for build speed
 * costs nothing recoverable. Point `dataDir` at the bundle's own `kg.pglite`
 * directory rather than a shared application database.
 *
 * @example
 * ```ts
 * import { makePracticeKgPgliteLayer } from "../../src/runtime/Pglite.ts"
 *
 * const store = makePracticeKgPgliteLayer("/corpus/staging/practice-kg-bundle/kg.pglite")
 *
 * console.log(typeof store.pipe) // "function"
 * ```
 *
 * @param dataDir - Directory the bundle's PGlite files are created in.
 *
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgPgliteLayer = (dataDir: string) => Pglite.makeLayer({ dataDir, relaxedDurability: true });
