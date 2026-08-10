/**
 * App-owned bundle loading and long-lived MCP host resource composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeKgMcpId } from "@beep/identity/packages";
import {
  makePracticeKgServerLayer,
  PracticeKgBundle,
  PracticeKgBundleContext,
  PracticeKgBundleManifest,
  PracticeKgMcpServerConfig,
} from "@beep/law-practice-server";
import { TaggedErrorClass } from "@beep/schema";
import * as OptionUtils from "@beep/utils/Option";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makePracticeKgDuckDbLayer } from "./DuckDb.ts";
import { makePracticeKgPgliteLayer } from "./Pglite.ts";

const $I = $PracticeKgMcpId.create("runtime/Host");
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));

/**
 * Sanitized startup failure while resolving a portable practice KG bundle.
 *
 * **Example** (Make PracticeKgHostError)
 *
 * ```ts
 * import { PracticeKgHostError } from "../../src/runtime/Host.ts"
 *
 * const error = PracticeKgHostError.make({ message: "Bundle directory is required." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgHostError extends TaggedErrorClass<PracticeKgHostError>($I`PracticeKgHostError`)(
  "PracticeKgHostError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
  },
  $I.annote("PracticeKgHostError", {
    description: "Sanitized startup failure while resolving a portable practice KG bundle.",
  })
) {}

/**
 * Read and validate the bundle manifest before either database is opened.
 *
 * **Example** (Load bundle context effect)
 *
 * ```ts
 * import { loadPracticeKgBundleContext } from "../../src/runtime/Host.ts"
 * import { Effect } from "effect"
 *
 * const loading = loadPracticeKgBundleContext("/bundle")
 * console.log(Effect.isEffect(loading))
 * ```
 *
 * @param bundleDir - Directory containing `bundle.manifest.json` and both stores.
 * @param corpusRoot - Optional pointer to the external corpus content tree.
 * @category constructors
 * @since 0.0.0
 */
export const loadPracticeKgBundleContext = Effect.fn("PracticeKgHost.loadBundle")(function* (
  bundleDir: string,
  corpusRoot?: string | undefined
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(bundleDir, "bundle.manifest.json");
  const manifestText = yield* fs.readFileString(manifestPath).pipe(
    Effect.mapError((cause) =>
      PracticeKgHostError.make({
        cause,
        message: `Failed reading practice KG bundle manifest at "${manifestPath}".`,
      })
    )
  );
  const manifest = yield* decodeManifest(manifestText).pipe(
    Effect.mapError((cause) =>
      PracticeKgHostError.make({
        cause,
        message: `Practice KG bundle manifest at "${manifestPath}" is invalid.`,
      })
    )
  );
  return PracticeKgBundleContext.make({
    bundleDir,
    manifest,
    ...OptionUtils.getSomesStruct({ corpusRoot: O.fromUndefinedOr(corpusRoot) }),
  });
});

/**
 * Compose the stdio server with app-owned PGlite and DuckDB resources.
 *
 * **Example** (Compose practice host layer)
 *
 * ```ts
 * import { makePracticeKgHostLayer } from "../../src/runtime/Host.ts"
 * import type { PracticeKgBundleContext } from "@beep/law-practice-server"
 *
 * const compose = (context: PracticeKgBundleContext) => makePracticeKgHostLayer(context)
 * console.log(typeof compose)
 * ```
 *
 * @param context - Validated bundle paths and manifest metadata.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgHostLayer = (context: PracticeKgBundleContext) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const resources = Layer.mergeAll(
        makePracticeKgPgliteLayer(path.join(context.bundleDir, "kg.pglite")),
        makePracticeKgDuckDbLayer(path.join(context.bundleDir, "practice.duckdb")),
        Layer.succeed(PracticeKgBundle, PracticeKgBundle.of(context))
      );
      return makePracticeKgServerLayer(
        PracticeKgMcpServerConfig.make({ name: "beep-practice-kg", version: "0.0.0" })
      ).pipe(Layer.provide(resources));
    })
  );
