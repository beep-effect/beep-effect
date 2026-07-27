/**
 * Edge authority repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { EdgeAuthorityRepository } from "@beep/epistemic-use-cases/EdgeAuthority";
import { Layer } from "effect";
import { makeDrizzleEdgeAuthorityRepository } from "./EdgeAuthority.repo.ts";
import type { PostgresDrizzle } from "@beep/postgres";

/**
 * Drizzle-backed edge authority repository layer.
 *
 * There is no in-memory sibling here, and that is deliberate: the atomicity this
 * repository sells — the locked head, the guarded close, the exclusion
 * constraint that refuses a second open head — is enforced by the database, so
 * an in-memory stand-in would be proving a different thing than the one callers
 * depend on.
 *
 * @example
 * ```ts
 * import { EdgeAuthorityRepositoryDrizzle } from "@beep/epistemic-server/EdgeAuthority"
 *
 * console.log(EdgeAuthorityRepositoryDrizzle)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EdgeAuthorityRepositoryDrizzle: Layer.Layer<EdgeAuthorityRepository, never, PostgresDrizzle> =
  Layer.effect(EdgeAuthorityRepository, makeDrizzleEdgeAuthorityRepository());
