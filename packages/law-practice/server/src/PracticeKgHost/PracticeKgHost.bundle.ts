/**
 * Bundle manifest loading for a host process, before either store opens.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as OptionUtils from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { PracticeKgBundleContext } from "../PracticeKg.host.ts";
import { PracticeKgBundleManifest } from "../PracticeKg.schemas.ts";
import { PracticeKgHostError } from "./PracticeKgHost.errors.ts";

const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));
// Mirrors `PracticeKgSchemaVersions`; bumped with every breaking kg_node/kg_edge or DuckDB table layout change.
const supportedStoreVersions = { duckdb: "4", pglite: "4" } as const;
const decodeStoreVersionProbe = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ schemaVersion: S.Struct({ duckdb: S.String, pglite: S.String }) }))
);

/**
 * Read and validate the bundle manifest before either database is opened.
 *
 * **Details**
 *
 * A manifest naming a store format other than the one this package reads is
 * refused with both formats in the message, ahead of the strict decode, so an
 * older bundle is reported as one to replace rather than as merely invalid.
 *
 * **Example** (Load bundle context effect)
 *
 * ```ts
 * import { loadPracticeKgBundleContext } from "@beep/law-practice-server/PracticeKgHost"
 * import * as Effect from "effect/Effect"
 *
 * const loading = loadPracticeKgBundleContext("/bundle")
 * console.log(Effect.isEffect(loading)) // true
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
  // An older bundle lacks columns the tools read (format 1 keys families on
  // the bare docket number; format 2 has no `matters.client_name`; format 3
  // has no correspondent tables), so it is
  // refused by store version before the strict decode can report it as merely
  // "invalid".
  const storeVersion = yield* decodeStoreVersionProbe(manifestText).pipe(Effect.option);
  if (
    O.isSome(storeVersion) &&
    (storeVersion.value.schemaVersion.pglite !== supportedStoreVersions.pglite ||
      storeVersion.value.schemaVersion.duckdb !== supportedStoreVersions.duckdb)
  ) {
    const found = storeVersion.value.schemaVersion;
    return yield* PracticeKgHostError.make({
      message: `Practice KG bundle at "${bundleDir}" uses store format pglite ${found.pglite} / duckdb ${found.duckdb}; this server reads pglite ${supportedStoreVersions.pglite} / duckdb ${supportedStoreVersions.duckdb}. Install the rebuilt bundle that matches this server.`,
    });
  }
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
