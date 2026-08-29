/**
 * Runtime composition for practice knowledge-graph bundle builds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PracticeKgProjectionsLive } from "@beep/law-practice-server";
import { Layer } from "effect";
import { makePracticeKgPgliteLayer } from "./Pglite.ts";

/**
 * Compose the injected projection service with its app-owned PGlite store.
 *
 * **Details**
 *
 * The resulting layer still needs a filesystem and path from the host — build it
 * inside a scope so the PGlite store is closed once the build settles, which is
 * how `practice-kg-build` drives it.
 *
 * **Example** (Scoped build layer program)
 *
 * ```ts
 * import { buildPracticeKgBundle, PracticeKgOptions } from "@beep/law-practice-server"
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { Effect, Layer } from "effect"
 * import { makePracticeKgBuildLayer } from "../../src/runtime/Layer.ts"
 *
 * const bundleOut = "/corpus/staging/practice-kg-bundle"
 *
 * const build = buildPracticeKgBundle(
 *   PracticeKgOptions.make({
 *     bundleOut,
 *     corpusRoot: "/corpus",
 *     includeRefresh: true,
 *     overwrite: true,
 *     skipEmails: false
 *   })
 * )
 *
 * const program = Effect.scoped(
 *   Layer.build(makePracticeKgBuildLayer(`${bundleOut}/kg.pglite`)).pipe(
 *     Effect.flatMap((context) => build.pipe(Effect.provide(context)))
 *   )
 * ).pipe(Effect.provide(BunServices.layer))
 *
 * Effect.runPromise(program).then((summary) => console.log(summary.counts.nodes))
 * ```
 *
 * @param dataDir - Directory the bundle's PGlite files are created in.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgBuildLayer = (dataDir: string) =>
  PracticeKgProjectionsLive.pipe(Layer.provide(makePracticeKgPgliteLayer(dataDir)));
