/**
 * Turborepo schema version resolver.
 *
 * Compares the `$schema` URL in every `turbo.json` (root plus each workspace
 * package) against the versioned URL for the installed `turbo` release
 * (lockfile-resolved, falling back to the root `package.json` catalog). Turborepo publishes one schema per release at
 * `https://v<major>-<minor>-<patch>.turborepo.dev/schema.json`; the
 * `@turbo/codemod update` migration rewrites `$schema` to that URL, and this
 * resolver keeps the pins current when `turbo` is bumped without the codemod.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { workspaceDirectories } from "../../../../internal/RepoWorkspaces.ts";
import {
  VersionCategoryReport,
  VersionCategoryStatusEnum,
  VersionDriftItem,
  VersionSyncError,
  versionCategoryStatusFromDrift,
} from "../../VersionSync.schemas.ts";
import { resolveInstalledToolVersion } from "./RootCatalog.ts";
import type { FsUtils } from "@beep/repo-utils";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/TurboResolver");

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * @category configuration
 * @since 0.0.0
 */
const TURBO_SCHEMA_PREFIX = "https://v";

/**
 * @category configuration
 * @since 0.0.0
 */
const TURBO_SCHEMA_SUFFIX = ".turborepo.dev/schema.json";

/**
 * @category configuration
 * @since 0.0.0
 */
const TURBO_CONFIG_FILE = "turbo.json";

/**
 * Drift-item field name for a `turbo.json` `$schema` pin; the write path keys on it.
 *
 * @category configuration
 * @since 0.0.0
 */
export const TURBO_SCHEMA_FIELD = "$schema";

const TURBO_SCHEMA_URL_PATTERN = /^https:\/\/v\d+-\d+-\d+\.turborepo\.dev\/schema\.json$/;
const STABLE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const TurboSchemaUrl = S.String.check(S.isPattern(TURBO_SCHEMA_URL_PATTERN)).pipe(
  S.brand("TurboSchemaUrl"),
  $I.annoteSchema("TurboSchemaUrl", {
    description: "Turborepo schema URL in canonical https://v<major>-<minor>-<patch>.turborepo.dev/schema.json format.",
  })
);

const StableTurboVersion = S.String.check(S.isPattern(STABLE_VERSION_PATTERN)).pipe(
  $I.annoteSchema("StableTurboVersion", {
    description: "Stable turbo release version (major.minor.patch) that has a published versioned schema.",
  })
);

const isStableTurboVersion = S.is(StableTurboVersion);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a versioned Turborepo schema URL from a release version.
 *
 * @param version - The turbo version (e.g. `2.10.13`).
 * @returns The full `$schema` URL (e.g. `https://v2-10-13.turborepo.dev/schema.json`).
 * @category utilities
 * @since 0.0.0
 */
const buildSchemaUrl = (version: string): string =>
  `${TURBO_SCHEMA_PREFIX}${Str.replace(/\./g, "-")(version)}${TURBO_SCHEMA_SUFFIX}`;

/**
 * Transformation between the canonical versioned schema URL and the bare release version.
 *
 * @category utilities
 * @since 0.0.0
 */
const TurboSchemaUrlToVersion = TurboSchemaUrl.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: flow(Str.slice(TURBO_SCHEMA_PREFIX.length, -TURBO_SCHEMA_SUFFIX.length), Str.replace(/-/g, ".")),
      encode: (version) => TurboSchemaUrl.make(buildSchemaUrl(version)),
    })
  ),
  $I.annoteSchema("TurboSchemaUrlToVersion", {
    description: "Schema transformation between canonical versioned Turborepo schema URL and bare version string.",
  })
);

const decodeSchemaVersion = S.decodeUnknownOption(TurboSchemaUrlToVersion);

class TurboJsonDocument extends S.Opaque<TurboJsonDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    $schema: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("TurboJsonDocument", {
      description: "Subset of turbo.json used to resolve the current schema URL.",
    })
  )
) {}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * One `turbo.json` file that declares a `$schema` URL.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigFile extends S.Opaque<TurboConfigFile, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    schemaUrl: S.String,
    schemaVersion: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  }).pipe(
    $I.annoteSchema("TurboConfigFile", {
      description: "A turbo.json file (repo-relative) with its current $schema URL and the version it pins, if any.",
    })
  )
) {}

/**
 * Resolved Turborepo schema state across every `turbo.json` in the workspace.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboSchemaState extends S.Opaque<TurboSchemaState, { readonly brand: unique symbol }>()(
  S.Struct({
    installedVersion: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    files: ArrayKeyDefaultEmpty(TurboConfigFile),
  }).pipe(
    $I.annoteSchema("TurboSchemaState", {
      description: "Resolved Turborepo schema state: installed version plus every turbo.json that pins a $schema.",
    })
  )
) {}

const readTurboConfigFile = Effect.fn("readTurboConfigFile")(function* (
  repoRoot: string,
  directory: string
): Effect.fn.Return<O.Option<TurboConfigFile>, VersionSyncError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filePath = path.join(directory, TURBO_CONFIG_FILE);
  const relativePath = path.relative(repoRoot, filePath);

  const present = yield* fs.exists(filePath).pipe(Effect.orElseSucceed(() => false));
  if (!present) {
    return O.none();
  }

  const content = yield* fs
    .readFileString(filePath)
    .pipe(VersionSyncError.mapError(`Failed to read ${relativePath}`, relativePath));

  const document = yield* Jsonc.bind(TurboJsonDocument)
    .decode(content)
    .pipe(VersionSyncError.mapError(`Failed to parse ${relativePath}`, relativePath));

  return O.map(O.fromUndefinedOr(document.$schema), (schemaUrl) =>
    TurboConfigFile.make({
      file: relativePath,
      schemaUrl,
      schemaVersion: decodeSchemaVersion(schemaUrl),
    })
  );
});

/**
 * Resolve the installed `turbo` version and every `turbo.json` `$schema` pin in the workspace.
 *
 * **Details**
 *
 * Scans the root `turbo.json` plus one `turbo.json` per workspace package
 * (from the root `package.json` `workspaces` globs). Files without a `$schema`
 * key are left alone, matching `@turbo/codemod update`.
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveTurboSchema = Effect.fn("resolveTurboSchema")(function* (
  repoRoot: string,
  installedVersionRead = resolveInstalledToolVersion(repoRoot, "turbo")
): Effect.fn.Return<TurboSchemaState, VersionSyncError, FileSystem.FileSystem | Path.Path | FsUtils> {
  const installedVersion = yield* installedVersionRead;

  const workspaceDirs = yield* workspaceDirectories(repoRoot).pipe(
    VersionSyncError.mapError("Failed to resolve workspace directories", "package.json")
  );

  const directories = A.prepend(
    A.sort(A.dedupe(A.fromIterable(HashMap.values(workspaceDirs))), Order.String),
    repoRoot
  );

  const files = yield* Effect.forEach(directories, (directory) => readTurboConfigFile(repoRoot, directory)).pipe(
    Effect.map(A.getSomes)
  );

  return TurboSchemaState.make({
    installedVersion,
    files,
  });
});

/**
 * Build the Turborepo schema category report from resolved state.
 *
 * @param state - The resolved Turborepo schema state.
 * @returns The version category report for the Turborepo schema pins.
 * @category utilities
 * @since 0.0.0
 */
export const buildTurboReport: (state: TurboSchemaState) => VersionCategoryReport = (state) => {
  if (Str.isEmpty(state.installedVersion)) {
    return VersionCategoryReport.cases.turbo.make({
      status: VersionCategoryStatusEnum.ok,
      items: A.empty<VersionDriftItem>(),
      latest: O.none(),
      error: O.some("turbo not found in bun.lock, the root catalog, or devDependencies"),
    });
  }

  if (!isStableTurboVersion(state.installedVersion)) {
    return VersionCategoryReport.cases.turbo.make({
      status: VersionCategoryStatusEnum.error,
      items: A.empty<VersionDriftItem>(),
      latest: O.some(state.installedVersion),
      error: O.some(`Unsupported turbo version specifier: ${state.installedVersion}`),
    });
  }

  const expectedVersion = state.installedVersion;
  const expectedSchemaUrl = buildSchemaUrl(expectedVersion);

  // Both columns are full URLs so a drift row reads as "this URL -> that URL";
  // the write path rewrites `$schema` to `expected` verbatim.
  const items = A.map(
    A.filter(state.files, (file) => !Str.equivalence(file.schemaUrl, expectedSchemaUrl)),
    (file) =>
      VersionDriftItem.make({
        file: file.file,
        field: TURBO_SCHEMA_FIELD,
        current: file.schemaUrl,
        expected: expectedSchemaUrl,
        line: O.none(),
      })
  );

  return VersionCategoryReport.cases.turbo.make({
    status: versionCategoryStatusFromDrift(items),
    items,
    latest: O.some(expectedVersion),
    error: O.none(),
  });
};
