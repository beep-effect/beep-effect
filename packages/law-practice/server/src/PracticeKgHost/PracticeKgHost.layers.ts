/**
 * Long-lived store layers a host process mounts under the practice KG toolkit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import * as Pglite from "@beep/pglite";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { PracticeKgBundle } from "../PracticeKg.host.ts";
import type { PracticeKgBundleContext } from "../PracticeKg.host.ts";

/**
 * Open the shipped practice DuckDB file for the host lifetime.
 *
 * **Gotchas**
 *
 * DuckDB loads its native `duckdb.node` addon. A `bun build --compile` host
 * must keep the `@duckdb/node-bindings-*` addons external and ship them next
 * to the executable, as the practice-kg-mcp packaging script does.
 *
 * **Example** (Create practice DuckDB layer)
 *
 * ```ts
 * import { makePracticeKgDuckDbLayer } from "@beep/law-practice-server/PracticeKgHost"
 * import * as Layer from "effect/Layer"
 *
 * const layer = makePracticeKgDuckDbLayer("/bundle/practice.duckdb")
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @param databasePath - Path to the bundle's `practice.duckdb` file.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgDuckDbLayer = (databasePath: string) =>
  DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }));

/**
 * Provision the PGlite store owned by a graph bundle.
 *
 * **Gotchas**
 *
 * `relaxedDurability` is deliberate: the store is a derived artifact rebuilt from
 * the corpus whenever it is lost, so trading fsync guarantees for build speed
 * costs nothing recoverable. Point `dataDir` at the bundle's own `kg.pglite`
 * directory rather than a shared application database. A compiled host embeds
 * the PGlite wasm and data assets itself; this layer does not import them.
 *
 * **Example** (Provision PGlite store layer)
 *
 * ```ts
 * import { makePracticeKgPgliteLayer } from "@beep/law-practice-server/PracticeKgHost"
 * import * as Layer from "effect/Layer"
 *
 * const store = makePracticeKgPgliteLayer("/corpus/staging/practice-kg-bundle/kg.pglite")
 * console.log(Layer.isLayer(store)) // true
 * ```
 *
 * @param dataDir - Directory the bundle's PGlite files live in.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgPgliteLayer = (dataDir: string) => Pglite.makeLayer({ dataDir, relaxedDurability: true });

/**
 * Open the bundle's PGlite and DuckDB stores and publish the bundle context.
 *
 * **Details**
 *
 * This is the one place a host decides which files back its stores, so a
 * stdio server, an in-process gateway and the headless self-check all read the
 * same resources. Provide it under `PracticeKgToolkitLayer` (or
 * `makePracticeKgServerLayer`) to satisfy their `DuckDb`, `SqlClient` and
 * `PracticeKgBundle` requirements.
 *
 * **Example** (Mount the toolkit over a bundle)
 *
 * ```ts
 * import { PracticeKgToolkitLayer, type PracticeKgBundleContext } from "@beep/law-practice-server"
 * import { makePracticeKgHostResourcesLayer } from "@beep/law-practice-server/PracticeKgHost"
 * import * as Layer from "effect/Layer"
 *
 * const mount = (context: PracticeKgBundleContext) =>
 *   PracticeKgToolkitLayer.pipe(Layer.provide(makePracticeKgHostResourcesLayer(context)))
 * console.log(typeof mount) // "function"
 * ```
 *
 * @param context - Validated bundle paths and manifest metadata.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgHostResourcesLayer = (context: PracticeKgBundleContext) =>
  Path.Path.pipe(
    Effect.service,
    Effect.map((path) =>
      Layer.mergeAll(
        makePracticeKgPgliteLayer(path.join(context.bundleDir, "kg.pglite")),
        makePracticeKgDuckDbLayer(path.join(context.bundleDir, "practice.duckdb")),
        Layer.succeed(PracticeKgBundle, PracticeKgBundle.of(context))
      )
    ),
    Layer.unwrap
  );
