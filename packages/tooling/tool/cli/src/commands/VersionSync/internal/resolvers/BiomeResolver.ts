/**
 * Biome schema version resolver.
 *
 * Compares the `$schema` URL version in `biome.jsonc` against the installed
 * `@biomejs/biome` version (lockfile-resolved, falling back to the root
 * `package.json` catalog).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, Path, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  VersionCategoryReport,
  VersionCategoryStatusEnum,
  VersionCategoryStatusThunk,
  VersionDriftItem,
  VersionSyncError,
} from "../../VersionSync.schemas.ts";
import { updateJsoncSchemaUrl } from "../updaters/JsoncSchemaUpdater.ts";
import { resolveInstalledToolVersion } from "./RootCatalog.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/BiomeResolver");

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * @category configuration
 * @since 0.0.0
 */
const BIOME_SCHEMA_PREFIX = "https://biomejs.dev/schemas/";

/**
 * @category configuration
 * @since 0.0.0
 */
const BIOME_SCHEMA_SUFFIX = "/schema.json";
const BIOME_SCHEMA_URL_PATTERN = /^https:\/\/biomejs\.dev\/schemas\/[^/]+\/schema\.json$/;

const BiomeSchemaUrl = S.String.check(S.isPattern(BIOME_SCHEMA_URL_PATTERN)).pipe(
  S.brand("BiomeSchemaUrl"),
  $I.annoteSchema("BiomeSchemaUrl", {
    description: "Biome schema URL in canonical https://biomejs.dev/schemas/<version>/schema.json format.",
  })
);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the version from a Biome schema URL.
 *
 * @param schemaUrl - The `$schema` URL from `biome.jsonc`.
 * @returns The extracted version, or `None` if the URL format is unrecognized.
 * @category utilities
 * @since 0.0.0
 */
const BiomeSchemaUrlToVersion = BiomeSchemaUrl.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: Str.slice(BIOME_SCHEMA_PREFIX.length, -BIOME_SCHEMA_SUFFIX.length),
      encode: (version) => BiomeSchemaUrl.make(`${BIOME_SCHEMA_PREFIX}${version}${BIOME_SCHEMA_SUFFIX}`),
    })
  ),
  $I.annoteSchema("BiomeSchemaUrlToVersion", {
    description: "Schema transformation between canonical Biome schema URL and bare version string.",
  })
);

/**
 * Build a schema URL from a version string.
 *
 * @param version - The Biome version (e.g. `2.4.4`).
 * @returns The full `$schema` URL for `biome.jsonc`.
 * @category utilities
 * @since 0.0.0
 */
const buildSchemaUrl = (version: string): string => `${BIOME_SCHEMA_PREFIX}${version}${BIOME_SCHEMA_SUFFIX}`;
const decodeSchemaVersion = S.decodeUnknownOption(BiomeSchemaUrlToVersion);

class BiomeJsoncDocument extends S.Class<BiomeJsoncDocument>($I`BiomeJsoncDocument`)(
  {
    $schema: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  },
  $I.annote("BiomeJsoncDocument", {
    description: "Subset of biome.jsonc used to resolve current schema URL.",
  })
) {}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolved Biome schema state.
 *
 * @category models
 * @since 0.0.0
 */
export class BiomeSchemaState extends S.Class<BiomeSchemaState>($I`BiomeSchemaState`)(
  {
    schemaUrl: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    schemaVersion: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    installedVersion: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
  },
  $I.annote("BiomeSchemaState", {
    description: "Resolved Biome schema state.",
  })
) {}

/**
 * Resolve the current Biome schema version from `biome.jsonc` and the installed
 * `@biomejs/biome` version (lockfile-resolved, falling back to the root `package.json` catalog).
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveBiomeSchema = Effect.fn(function* (
  repoRoot: string
): Effect.fn.Return<BiomeSchemaState, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // Read biome.jsonc
  const biomePath = path.join(repoRoot, "biome.jsonc");
  const biomeContent = yield* fs
    .readFileString(biomePath)
    .pipe(VersionSyncError.mapError("Failed to read biome.jsonc", "biome.jsonc"));

  const biomeJson = yield* decodeJsoncTextAs(BiomeJsoncDocument)(biomeContent).pipe(
    VersionSyncError.mapError("Failed to parse biome.jsonc", "biome.jsonc")
  );

  const schemaUrl = biomeJson.$schema;
  const schemaVersion = decodeSchemaVersion(schemaUrl);

  const installedVersion = yield* resolveInstalledToolVersion(repoRoot, "@biomejs/biome");

  return BiomeSchemaState.make({
    schemaUrl,
    schemaVersion,
    installedVersion,
  });
});

/**
 * Build the Biome schema category report from resolved state.
 *
 * @param state - The resolved Biome schema state.
 * @returns The version category report for the Biome schema.
 * @category utilities
 * @since 0.0.0
 */
export const buildBiomeReport: (state: BiomeSchemaState) => VersionCategoryReport = (state) => {
  let items = A.empty<VersionDriftItem>();

  if (Str.isEmpty(state.installedVersion)) {
    return VersionCategoryReport.cases.biome.make({
      status: VersionCategoryStatusEnum.ok,
      items,
      latest: O.none(),
      error: O.some("@biomejs/biome not found in bun.lock, the root catalog, or devDependencies"),
    });
  }

  const currentVersion = O.getOrElse(state.schemaVersion, () => "<missing>");
  const expectedVersion = state.installedVersion;

  if (currentVersion !== expectedVersion) {
    items = A.append(
      items,
      VersionDriftItem.make({
        file: "biome.jsonc",
        field: "$schema version",
        current: currentVersion,
        expected: expectedVersion,
        line: O.none(),
      })
    );
  }

  return VersionCategoryReport.cases.biome.make({
    status: A.match(items, {
      onEmpty: VersionCategoryStatusThunk.ok,
      onNonEmpty: VersionCategoryStatusThunk.drift,
    }),
    items,
    latest: O.some(expectedVersion),
    error: O.none(),
  });
};

/**
 * Update the `$schema` field in `biome.jsonc` to match the installed version.
 *
 * @category utilities
 * @since 0.0.0
 */
export const updateBiomeSchema = Effect.fn("updateBiomeSchema")(function* (
  filePath: string,
  version: string
): Effect.fn.Return<boolean, VersionSyncError, FileSystem.FileSystem> {
  return yield* updateJsoncSchemaUrl(filePath, buildSchemaUrl(version));
});
