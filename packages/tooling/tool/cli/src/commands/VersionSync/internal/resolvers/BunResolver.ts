/**
 * Bun version resolver.
 *
 * Reads current Bun version from `.bun-version` and `package.json` `packageManager`,
 * and optionally fetches the latest stable release from GitHub.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { SemVer } from "@beep/semver/SemVer";
import { A, Str } from "@beep/utils";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow, identity, pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { manifestParser } from "../../../../internal/ManifestRead.ts";
import {
  NetworkUnavailableError,
  VersionCategoryReport,
  VersionCategoryStatusEnum,
  VersionDriftItem,
  VersionSyncError,
} from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/BunResolver");

// ── GitHub API schema ───────────────────────────────────────────────────────

/**
 * @category validation
 * @since 0.0.0
 */

class BunRelease extends S.Opaque<BunRelease, { readonly brand: unique symbol }>()(
  S.Struct({
    tag_name: S.String,
    prerelease: S.Boolean,
    draft: S.Boolean,
  }).pipe(
    $I.annoteSchema("BunRelease", {
      description: "GitHub release schema for Bun releases",
    })
  )
) {}

const parsePackageJson = manifestParser(["packageManager"]);

/**
 * Read the raw `packageManager` field of the root `package.json` text.
 *
 * **Details**
 *
 * An absent field reads as `""`; a present one must be a string. Strict JSON
 * only: JSONC text fails.
 *
 * **Example** (Read the Bun pin)
 *
 * ```ts
 * import { readPackageManagerField } from "@beep/repo-cli/test/VersionSync"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(readPackageManagerField('{"packageManager":"bun@1.3.0"}'))) // bun@1.3.0
 * ```
 *
 * @param text - The root manifest document as read from disk.
 * @returns The `packageManager` value, or `""` when absent.
 * @category parsing
 * @since 0.0.0
 */
export const readPackageManagerField = Effect.fn("BunResolver.readPackageManagerField")(function* (
  text: string
): Effect.fn.Return<string, VersionSyncError> {
  const manifest = yield* parsePackageJson(text).pipe(
    VersionSyncError.mapError("Failed to parse package.json", "package.json")
  );
  return manifest.packageManager ?? "";
});

/**
 * Vercel command fields that carry explicit Bun runtime pins.
 *
 * @category models
 * @since 0.0.0
 */
export class BunVercelDocument extends S.Opaque<BunVercelDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    installCommand: S.String,
    buildCommand: S.String,
  }).pipe(
    $I.annoteSchema("BunVercelDocument", {
      description: "Subset of Vercel configuration fields containing explicit Bun runtime pins.",
    })
  )
) {}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * @category configuration
 * @since 0.0.0
 */
const BUN_RELEASE_URL = "https://api.github.com/repos/oven-sh/bun/releases/latest";
const BUN_ARCHIVE_NAME = "bun-linux-x64.zip";
const BUN_VERSION_IN_COMMAND_PATTERN = /\bbun@([^\s"'$`]+)/;
const BUN_ARCHIVE_CHECKSUM_PATTERN = /^([a-f0-9]{64})\s+\*?bun-linux-x64\.zip$/m;

/**
 * Strip the `bun-v` prefix from a GitHub release tag name.
 *
 * @param tagName - The GitHub release tag (e.g. `bun-v1.3.9`).
 * @returns The bare version string.
 * @category utilities
 * @since 0.0.0
 */
const extractBunVersion = Str.replace(/^bun-v/, "");

/**
 * Strip the `bun@` prefix from a `packageManager` field value.
 *
 * @param value - The packageManager field value (e.g. `bun@1.3.9`).
 * @returns The bare version string.
 * @category utilities
 * @since 0.0.0
 */
const extractPackageManagerVersion = Str.replace(/^bun@/, "");

/**
 * Extract an explicit Bun version from a shell command.
 *
 * **Details**
 * Shell substitutions read the canonical version at execution time and are not
 * independent pins. Quotes delimit literal pins without becoming part of them.
 *
 * **Example** (Distinguish literal and derived runtime versions)
 *
 * ```ts
 * import { extractCommandBunVersion } from "@beep/repo-cli/commands/VersionSync/internal/resolvers/BunResolver"
 * import * as O from "effect/Option"
 *
 * const pinned = extractCommandBunVersion('npx --yes "bun@1.4.2" install')
 * const derived = extractCommandBunVersion('npx --yes "bun@$(cat .bun-version)" install')
 * console.log(O.getOrElse(pinned, () => "unpinned")) // "1.4.2"
 * console.log(O.isNone(derived)) // true
 * ```
 *
 * @param command - Shell command that may contain a `bun@<version>` invocation.
 * @returns The explicit Bun version when present.
 * @category utilities
 * @since 0.0.0
 */
export const extractCommandBunVersion = (command: string): O.Option<string> =>
  pipe(
    Str.match(BUN_VERSION_IN_COMMAND_PATTERN)(command),
    O.flatMap((match) => O.fromUndefinedOr(match[1]))
  );

/**
 * Extract the Linux x64 archive digest from Bun's release checksum manifest.
 *
 * @param manifest - Bun release checksum manifest text.
 * @returns The Linux x64 archive digest when present.
 * @category utilities
 * @since 0.0.0
 */
export const extractBunArchiveChecksum = (manifest: string): O.Option<string> =>
  pipe(
    Str.match(BUN_ARCHIVE_CHECKSUM_PATTERN)(manifest),
    O.flatMap((match) => O.fromUndefinedOr(match[1]))
  );

/**
 * Parse a Bun pin as a strict SemVer value after an optional leading `v`.
 *
 * A pin carries no surrounding whitespace and no build metadata (the `+` slot of a
 * `packageManager` value is its integrity hash), so only corepack-pinnable strings parse.
 */
const parseBunVersion: (value: string) => O.Option<SemVer> = flow(
  Str.replace(/^v/, ""),
  O.liftPredicate((text) => text === Str.trim(text)),
  O.flatMap(flow(SemVer.parseResult, Result.getSuccess)),
  O.filter((version) => A.isReadonlyArrayEmpty(version.build))
);

const selectLatestLocalBunVersion = (
  state: Pick<BunVersionState, "bunVersionFile" | "packageManagerField">
): string => {
  const bunVersionFile = parseBunVersion(state.bunVersionFile);
  const packageManagerField = parseBunVersion(state.packageManagerField);

  // A parsed pin is written in canonical form (no leading `v`): corepack and
  // `PackageManager.version` reject `bun@v1.4.0`.
  if (O.isSome(bunVersionFile) && O.isSome(packageManagerField)) {
    return (
      SemVer.gte(bunVersionFile.value, packageManagerField.value) ? bunVersionFile.value : packageManagerField.value
    ).toString();
  }
  if (O.isSome(bunVersionFile)) {
    return bunVersionFile.value.toString();
  }
  if (O.isSome(packageManagerField)) {
    return packageManagerField.value.toString();
  }

  return Str.isNonEmpty(state.bunVersionFile) ? state.bunVersionFile : state.packageManagerField;
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolved Bun version state.
 *
 * @category models
 * @since 0.0.0
 */
export class BunVersionState extends S.Opaque<BunVersionState, { readonly brand: unique symbol }>()(
  S.Struct({
    bunVersionFile: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    packageManagerField: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    vercelInstallVersion: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    vercelBuildVersion: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    bunArchiveSha256: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    expectedBunArchiveSha256: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  }).pipe(
    $I.annoteSchema("BunVersionState", {
      description: "Resolved Bun version state from local files and optionally GitHub",
    })
  )
) {}

/**
 * Resolve current Bun versions from local files and optionally fetch latest from GitHub.
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveBunVersions: {
  (
    repoRoot: string,
    skipNetwork: boolean
  ): Effect.Effect<BunVersionState, VersionSyncError, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient>;
  (
    skipNetwork: boolean
  ): (
    repoRoot: string
  ) => Effect.Effect<BunVersionState, VersionSyncError, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient>;
} = dual(
  2,
  Effect.fn(function* (
    repoRoot: string,
    skipNetwork: boolean
  ): Effect.fn.Return<BunVersionState, VersionSyncError, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    // Read .bun-version
    const bunVersionPath = path.join(repoRoot, ".bun-version");
    const bunVersionFile = yield* fs
      .readFileString(bunVersionPath)
      .pipe(Effect.map(Str.trim), VersionSyncError.mapError("Failed to read .bun-version", ".bun-version"));

    // Read package.json packageManager field
    const pkgJsonPath = path.join(repoRoot, "package.json");
    const pkgJsonContent = yield* fs
      .readFileString(pkgJsonPath)
      .pipe(VersionSyncError.mapError("Failed to read package.json", "package.json"));

    const packageManagerField = extractPackageManagerVersion(yield* readPackageManagerField(pkgJsonContent));

    const vercelJsonPath = path.join(repoRoot, "apps", "oip-web", "vercel.json");
    const vercelDocument = yield* fs.exists(vercelJsonPath).pipe(
      Effect.flatMap(
        Bool.match({
          onFalse: () => Effect.succeed(O.none<BunVercelDocument>()),
          onTrue: () =>
            fs.readFileString(vercelJsonPath).pipe(
              VersionSyncError.mapError("Failed to read apps/oip-web/vercel.json", "apps/oip-web/vercel.json"),
              Effect.flatMap((content) =>
                decodeJsoncTextAs(BunVercelDocument)(content).pipe(
                  VersionSyncError.mapError("Failed to parse apps/oip-web/vercel.json", "apps/oip-web/vercel.json")
                )
              ),
              Effect.asSome
            ),
        })
      ),
      VersionSyncError.mapError("Failed to inspect apps/oip-web/vercel.json", "apps/oip-web/vercel.json")
    );

    const checksumPath = path.join(repoRoot, ".bun-linux-x64.sha256");
    const bunArchiveSha256 = yield* fs.exists(checksumPath).pipe(
      Effect.flatMap(
        Bool.match({
          onFalse: () => Effect.succeed(O.none<string>()),
          onTrue: () =>
            fs
              .readFileString(checksumPath)
              .pipe(
                VersionSyncError.mapError("Failed to read .bun-linux-x64.sha256", ".bun-linux-x64.sha256"),
                Effect.map(Str.trim),
                Effect.asSome
              ),
        })
      ),
      VersionSyncError.mapError("Failed to inspect .bun-linux-x64.sha256", ".bun-linux-x64.sha256")
    );

    const latest = yield* Bool.match(skipNetwork, {
      onTrue: () => Effect.succeed(O.none<string>()),
      onFalse: () => fetchLatestBunVersion().pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>)),
    });

    const target = O.match(latest, {
      onSome: identity,
      onNone: () => selectLatestLocalBunVersion({ bunVersionFile, packageManagerField }),
    });
    const expectedBunArchiveSha256 = yield* Bool.match(skipNetwork, {
      onTrue: () => Effect.succeed(O.none<string>()),
      onFalse: () => fetchBunArchiveChecksum(target).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>)),
    });

    return BunVersionState.make({
      bunVersionFile,
      packageManagerField,
      vercelInstallVersion: O.flatMap(vercelDocument, (document) => extractCommandBunVersion(document.installCommand)),
      vercelBuildVersion: O.flatMap(vercelDocument, (document) => extractCommandBunVersion(document.buildCommand)),
      bunArchiveSha256,
      expectedBunArchiveSha256,
      latest,
    });
  })
);

/**
 * Fetch the latest stable Bun release version from GitHub.
 *
 * @category utilities
 * @since 0.0.0
 */
const fetchLatestBunVersion = Effect.fn(function* (): Effect.fn.Return<
  string,
  NetworkUnavailableError,
  HttpClient.HttpClient
> {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .get(BUN_RELEASE_URL, {
      headers: {
        "User-Agent": "beep-cli/0.0.0",
        Accept: "application/vnd.github+json",
      },
    })
    .pipe(NetworkUnavailableError.mapError("GitHub API request failed"));
  const body = yield* HttpClientResponse.schemaBodyJson(BunRelease)(response).pipe(
    NetworkUnavailableError.mapError("Failed to parse GitHub API response")
  );
  return extractBunVersion(body.tag_name);
});

const fetchBunArchiveChecksum = Effect.fn(function* (
  version: string
): Effect.fn.Return<string, NetworkUnavailableError, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .get(`https://github.com/oven-sh/bun/releases/download/bun-v${version}/SHASUMS256.txt`, {
      headers: { "User-Agent": "beep-cli/0.0.0" },
    })
    .pipe(NetworkUnavailableError.mapError("Bun checksum manifest request failed"));
  const manifest = yield* response.text.pipe(NetworkUnavailableError.mapError("Failed to read Bun checksum manifest"));
  const checksum = extractBunArchiveChecksum(manifest);
  if (O.isNone(checksum)) {
    return yield* NetworkUnavailableError.new(`Bun checksum manifest did not include ${BUN_ARCHIVE_NAME}`);
  }
  return checksum.value;
});

const makeBunDriftItem = (file: string, field: string, current: string, expected: string): VersionDriftItem =>
  VersionDriftItem.make({
    file,
    field,
    current,
    expected,
    line: O.none(),
  });

const requiredBunVersionDrift = (
  file: string,
  field: string,
  current: string,
  expected: string
): O.Option<VersionDriftItem> =>
  Bool.match(current === expected, {
    onTrue: O.none<VersionDriftItem>,
    onFalse: () => O.some(makeBunDriftItem(file, field, current, expected)),
  });

const optionalBunVersionDrift = (
  file: string,
  field: string,
  current: O.Option<string>,
  expected: string
): O.Option<VersionDriftItem> => O.flatMap(current, (value) => requiredBunVersionDrift(file, field, value, expected));

const bunArchiveChecksumDrift = (state: BunVersionState): O.Option<VersionDriftItem> =>
  pipe(
    O.all([state.bunArchiveSha256, state.expectedBunArchiveSha256]),
    O.flatMap(([current, expected]) =>
      requiredBunVersionDrift(".bun-linux-x64.sha256", `${BUN_ARCHIVE_NAME} sha256`, current, expected)
    )
  );

/**
 * Build the Bun category report from resolved state.
 *
 * @param state - The resolved Bun version state.
 * @returns The version category report for Bun.
 * @category utilities
 * @since 0.0.0
 */
export const buildBunReport: (state: BunVersionState) => VersionCategoryReport = (state) => {
  const target = O.match(state.latest, {
    onSome: identity,
    onNone: () => selectLatestLocalBunVersion(state),
  });
  const items = A.getSomes([
    requiredBunVersionDrift(".bun-version", "version", state.bunVersionFile, target),
    requiredBunVersionDrift("package.json", "packageManager", `bun@${state.packageManagerField}`, `bun@${target}`),
    optionalBunVersionDrift(
      "apps/oip-web/vercel.json",
      "installCommand Bun version",
      state.vercelInstallVersion,
      target
    ),
    optionalBunVersionDrift("apps/oip-web/vercel.json", "buildCommand Bun version", state.vercelBuildVersion, target),
    bunArchiveChecksumDrift(state),
  ]);

  const hasDrift = A.matchToBoolean(items);
  const hasInternalMismatch = state.bunVersionFile !== state.packageManagerField;

  return VersionCategoryReport.cases.bun.make({
    status: Bool.match(hasDrift || hasInternalMismatch, {
      onTrue: constant(VersionCategoryStatusEnum.drift),
      onFalse: constant(VersionCategoryStatusEnum.ok),
    }),
    items,
    latest: state.latest,
    error: O.none(),
  });
};
