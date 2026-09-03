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
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, identity, Path, pipe } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import {
  NetworkUnavailableError,
  VersionCategoryReport,
  VersionCategoryStatusThunk,
  VersionDriftItem,
  VersionSyncError,
} from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/BunResolver");

// ── GitHub API schema ───────────────────────────────────────────────────────

/**
 * @category validation
 * @since 0.0.0
 */

class BunRelease extends S.Class<BunRelease>($I`BunRelease`)(
  {
    tag_name: S.String,
    prerelease: S.Boolean,
    draft: S.Boolean,
  },
  $I.annote("BunRelease", {
    description: "GitHub release schema for Bun releases",
  })
) {}

class BunPackageJsonDocument extends S.Class<BunPackageJsonDocument>($I`BunPackageJsonDocument`)(
  {
    packageManager: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
  },
  $I.annote("BunPackageJsonDocument", {
    description: "Subset of root package.json fields required by the Bun resolver.",
  })
) {}

/**
 * Vercel command fields that carry explicit Bun runtime pins.
 *
 * @category models
 * @since 0.0.0
 */
export class BunVercelDocument extends S.Class<BunVercelDocument>($I`BunVercelDocument`)(
  {
    installCommand: S.String,
    buildCommand: S.String,
  },
  $I.annote("BunVercelDocument", {
    description: "Subset of Vercel configuration fields containing explicit Bun runtime pins.",
  })
) {}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * @category configuration
 * @since 0.0.0
 */
const BUN_RELEASE_URL = "https://api.github.com/repos/oven-sh/bun/releases/latest";
const BUN_ARCHIVE_NAME = "bun-linux-x64.zip";
const BUN_VERSION_IN_COMMAND_PATTERN = /\bbun@([^\s]+)/;
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
const BUN_SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const NUMERIC_PRERELEASE_IDENTIFIER = /^\d+$/;

const BunSemverIdentifier = S.Union([S.Finite, S.String]);

type BunSemverIdentifier = typeof BunSemverIdentifier.Type;

/**
 * Parsed Bun semantic version components.
 *
 * @category models
 * @since 0.0.0
 */
export class BunSemver extends S.Class<BunSemver>($I`BunSemver`)(
  {
    core: S.Tuple([S.Finite, S.Finite, S.Finite]),
    prerelease: BunSemverIdentifier.pipe(S.NonEmptyArray, S.Option),
  },
  $I.annote("BunSemver", {
    description: "Parsed Bun semantic version components.",
  })
) {}

const parseBunVersionPart = (value: string): O.Option<number> => {
  const parsed = globalThis.Number(value);
  return globalThis.Number.isInteger(parsed) && parsed >= 0 ? O.some(parsed) : O.none();
};

const parsePrereleaseIdentifier = (value: string): O.Option<BunSemverIdentifier> =>
  pipe(
    [
      pipe(
        Str.match(NUMERIC_PRERELEASE_IDENTIFIER)(value),
        O.flatMap(() => parseBunVersionPart(value))
      ),
      pipe(value, O.liftPredicate(Str.isNonEmpty)),
    ] satisfies ReadonlyArray<O.Option<BunSemverIdentifier>>,
    O.firstSomeOf
  );

const parsePrerelease = (value: string): O.Option<A.NonEmptyReadonlyArray<BunSemverIdentifier>> => {
  const identifiers = A.filter(Str.split(".")(value), Str.isNonEmpty);
  if (A.isReadonlyArrayEmpty(identifiers)) {
    return O.none();
  }

  let parsed = A.empty<BunSemverIdentifier>();
  for (const identifier of identifiers) {
    const next = parsePrereleaseIdentifier(identifier);
    if (O.isNone(next)) {
      return O.none();
    }
    parsed = A.append(parsed, next.value);
  }

  return A.isReadonlyArrayNonEmpty(parsed) ? O.some(parsed) : O.none();
};

const parseBunSemver = (value: string): O.Option<BunSemver> => {
  const match = BUN_SEMVER_PATTERN.exec(value);
  if (match === null) {
    return O.none();
  }

  const major = parseBunVersionPart(match[1]);
  const minor = parseBunVersionPart(match[2]);
  const patch = parseBunVersionPart(match[3]);

  if (O.isNone(major) || O.isNone(minor) || O.isNone(patch)) {
    return O.none();
  }

  const prerelease = O.flatMap(O.fromNullishOr(match[4]), (identifier) =>
    Str.isNonEmpty(identifier) ? parsePrerelease(identifier) : O.none()
  );

  return O.some({
    core: [major.value, minor.value, patch.value] as const,
    prerelease,
  });
};

const compareBunSemverIdentifier = (left: BunSemverIdentifier, right: BunSemverIdentifier): number => {
  if (P.isNumber(left) && P.isNumber(right)) {
    return left - right;
  }
  if (P.isNumber(left)) {
    return -1;
  }
  if (P.isNumber(right)) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const comparePrerelease = (
  left: O.Option<A.NonEmptyReadonlyArray<BunSemverIdentifier>>,
  right: O.Option<A.NonEmptyReadonlyArray<BunSemverIdentifier>>
): number => {
  if (O.isNone(left) && O.isNone(right)) {
    return 0;
  }
  if (O.isNone(left)) {
    return 1;
  }
  if (O.isNone(right)) {
    return -1;
  }

  const length = Math.min(left.value.length, right.value.length);
  for (let index = 0; index < length; index += 1) {
    const result = compareBunSemverIdentifier(left.value[index], right.value[index]);
    if (result !== 0) {
      return result;
    }
  }

  if (left.value.length < right.value.length) {
    return -1;
  }
  if (left.value.length > right.value.length) {
    return 1;
  }
  return 0;
};

const compareBunSemver = (left: BunSemver, right: BunSemver): number => {
  if (left.core[0] !== right.core[0]) {
    return left.core[0] - right.core[0];
  }
  if (left.core[1] !== right.core[1]) {
    return left.core[1] - right.core[1];
  }
  if (left.core[2] !== right.core[2]) {
    return left.core[2] - right.core[2];
  }
  return comparePrerelease(left.prerelease, right.prerelease);
};

const selectLatestLocalBunVersion = (
  state: Pick<BunVersionState, "bunVersionFile" | "packageManagerField">
): string => {
  const bunVersionFile = parseBunSemver(state.bunVersionFile);
  const packageManagerField = parseBunSemver(state.packageManagerField);

  if (O.isSome(bunVersionFile) && O.isSome(packageManagerField)) {
    return compareBunSemver(bunVersionFile.value, packageManagerField.value) >= 0
      ? state.bunVersionFile
      : state.packageManagerField;
  }
  if (O.isSome(bunVersionFile)) {
    return state.bunVersionFile;
  }
  if (O.isSome(packageManagerField)) {
    return state.packageManagerField;
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
export class BunVersionState extends S.Class<BunVersionState>($I`BunVersionState`)(
  {
    bunVersionFile: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    packageManagerField: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    vercelInstallVersion: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    vercelBuildVersion: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    bunArchiveSha256: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    expectedBunArchiveSha256: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("BunVersionState", {
    description: "Resolved Bun version state from local files and optionally GitHub",
  })
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

    const pkgJson = yield* decodeJsoncTextAs(BunPackageJsonDocument)(pkgJsonContent).pipe(
      VersionSyncError.mapError("Failed to parse package.json", "package.json")
    );
    const packageManagerField = extractPackageManagerVersion(pkgJson.packageManager);

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
      onTrue: VersionCategoryStatusThunk.drift,
      onFalse: VersionCategoryStatusThunk.ok,
    }),
    items,
    latest: state.latest,
    error: O.none(),
  });
};
