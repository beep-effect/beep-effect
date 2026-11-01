/**
 * Effect catalog version resolver.
 *
 * Keeps the lockstep Effect v4 package family in the root `package.json`
 * `catalog` aligned with the canonical `effect` entry, and keeps the root
 * `config.effectSource` provenance pin (version plus release commit) aligned
 * with a published exact `effect` catalog version.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  NetworkUnavailableError,
  VersionCategoryReport,
  VersionCategoryStatusEnum,
  VersionDriftItem,
  VersionSyncError,
  versionCategoryStatusFromDrift,
} from "../../VersionSync.schemas.ts";
import { readRootPackageJson } from "./RootCatalog.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/EffectResolver");
const VERSION_SPECIFIER_PATTERN = /^([~^<>=\s]*)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
const EXACT_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
// Legacy `effect-smol` snapshot URLs still match so sync rewrites them to `Effect-TS/effect`.
const EFFECT_SNAPSHOT_PATTERN = /^https:\/\/pkg\.pr\.new\/Effect-TS\/effect(?:-smol)?\/(.+)@([0-9a-f]+)$/i;
const LOCKSTEP_EFFECT_PACKAGE_PREFIX = "@effect/";
const NON_LOCKSTEP_EFFECT_PACKAGES = ["@effect/tsgo"] as const;
const EFFECT_RELEASE_COMMIT_URL = "https://api.github.com/repos/Effect-TS/effect/commits";

/**
 * Root manifest field holding the Effect source provenance pin.
 *
 * **Example** (Name the drift field for the pinned version)
 *
 * ```ts
 * import { EFFECT_SOURCE_FIELD_PREFIX } from "@beep/repo-cli/test/VersionSync"
 *
 * console.log(`${EFFECT_SOURCE_FIELD_PREFIX}version`) // config.effectSource.version
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EFFECT_SOURCE_FIELD_PREFIX = "config.effectSource.";

class EffectCatalogPackage extends S.Opaque<EffectCatalogPackage, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    versionSpecifier: S.String,
  }).pipe(
    $I.annoteSchema("EffectCatalogPackage", {
      description: "Tracked Effect catalog dependency and its version specifier.",
    })
  )
) {}

/**
 * The root `package.json` `config.effectSource` provenance pin: the published
 * Effect version and the release commit its `effect@<version>` tag points to.
 *
 * **Example** (Build the 4.1.1 pin)
 *
 * ```ts
 * import { EffectSourcePin } from "@beep/repo-cli/test/VersionSync"
 *
 * const pin = EffectSourcePin.make({ version: "4.1.1", commit: "bc492f0965dc0f6a83cefd141071c5ead10f7efa" })
 * console.log(pin.version) // 4.1.1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectSourcePin extends S.Opaque<EffectSourcePin, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.String,
    commit: S.String,
  }).pipe(
    $I.annoteSchema("EffectSourcePin", {
      description: "Root package.json config.effectSource pin: published Effect version and its release commit.",
    })
  )
) {}

const RootConfigEffectSource = S.Struct({
  effectSource: S.OptionFromOptionalKey(EffectSourcePin),
}).pipe(
  $I.annoteSchema("RootConfigEffectSource", {
    description: "The config.effectSource half of the root package.json config record.",
  })
);

const decodeRootConfigEffectSource = S.decodeUnknownEffect(RootConfigEffectSource);

class EffectReleaseCommit extends S.Opaque<EffectReleaseCommit, { readonly brand: unique symbol }>()(
  S.Struct({
    sha: S.String.check(S.isPattern(/^[0-9a-f]{40}$/u)),
  }).pipe(
    $I.annoteSchema("EffectReleaseCommit", {
      description: "GitHub commit lookup response for an Effect release tag, reduced to the full commit sha.",
    })
  )
) {}

/**
 * Resolved Effect catalog state derived from the root `package.json` catalog entries.
 *
 * @category models
 * @since 0.0.0
 */
export class EffectCatalogState extends S.Opaque<EffectCatalogState, { readonly brand: unique symbol }>()(
  S.Struct({
    canonicalSpecifier: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    packages: ArrayKeyDefaultEmpty(EffectCatalogPackage),
    effectSource: S.Option(EffectSourcePin).pipe(S.withConstructorDefault(Effect.succeed(O.none<EffectSourcePin>()))),
    releaseCommit: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  }).pipe(
    $I.annoteSchema("EffectCatalogState", {
      description:
        "Resolved lockstep Effect catalog dependency state, the config.effectSource pin, and the upstream release commit of the exact catalog version.",
    })
  )
) {}

type VersionSpecifierParts = {
  readonly prefix: string;
  readonly exact: string;
};

type SnapshotSpecifierParts = {
  readonly packageName: string;
  readonly sha: string;
};

const splitVersionSpecifier = (specifier: string): O.Option<VersionSpecifierParts> =>
  O.flatMap(Str.match(VERSION_SPECIFIER_PATTERN)(Str.trim(specifier)), (match) =>
    O.flatMap(O.fromUndefinedOr(match[1]), (prefix) =>
      O.map(O.fromUndefinedOr(match[2]), (exact) => ({ prefix, exact }))
    )
  );

const splitSnapshotSpecifier = (specifier: string): O.Option<SnapshotSpecifierParts> =>
  O.flatMap(Str.match(EFFECT_SNAPSHOT_PATTERN)(Str.trim(specifier)), (match) =>
    O.flatMap(O.fromUndefinedOr(match[1]), (packageName) =>
      O.map(O.fromUndefinedOr(match[2]), (sha) => ({ packageName, sha }))
    )
  );

const makeSnapshotSpecifier = (packageName: string, sha: string): string =>
  `https://pkg.pr.new/Effect-TS/effect/${packageName}@${sha}`;

const parseMajorVersion = (exactVersion: string): O.Option<number> =>
  O.flatMap(Str.match(EXACT_VERSION_PATTERN)(exactVersion), (match) => O.flatMap(O.fromUndefinedOr(match[1]), N.parse));

const isPublishedLockstepEffectPackage = (
  packageName: string,
  versionSpecifier: string,
  canonicalMajor: number
): boolean => {
  if (packageName === "effect") {
    return true;
  }

  if (!Str.startsWith(LOCKSTEP_EFFECT_PACKAGE_PREFIX)(packageName)) {
    return false;
  }

  const parts = splitVersionSpecifier(versionSpecifier);
  if (O.isNone(parts)) {
    return false;
  }

  const major = parseMajorVersion(parts.value.exact);
  return O.isSome(major) && major.value === canonicalMajor;
};

const isSnapshotLockstepEffectPackage = (packageName: string): boolean => {
  if (packageName === "effect") {
    return true;
  }

  return (
    Str.startsWith(LOCKSTEP_EFFECT_PACKAGE_PREFIX)(packageName) &&
    !A.some(
      NON_LOCKSTEP_EFFECT_PACKAGES,
      (name) => Str.Equivalence(packageName, name) || Str.startsWith(`${name}-`)(packageName)
    )
  );
};

const byPackageName = Order.mapInput(Order.String, ([packageName]: readonly [string, string]) => packageName);

/**
 * Resolve the root package.json Effect catalog state.
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveEffectCatalog: (
  repoRoot: string
) => Effect.Effect<EffectCatalogState, VersionSyncError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  function* (repoRoot) {
    const pkgJson = yield* readRootPackageJson(repoRoot);
    const catalog = O.getOrElse(O.fromUndefinedOr(pkgJson.catalog), R.empty<string, string>);

    const canonicalSpecifier = O.getOrElse(R.get(catalog, "effect"), thunkEmptyStr);
    const canonicalMajor = O.flatMap(splitVersionSpecifier(canonicalSpecifier), (parts) =>
      parseMajorVersion(parts.exact)
    );
    const canonicalSnapshot = splitSnapshotSpecifier(canonicalSpecifier);
    let packages = A.empty<EffectCatalogPackage>();

    for (const [packageName, versionSpecifier] of A.sort(R.toEntries(catalog), byPackageName)) {
      if (O.isSome(canonicalSnapshot)) {
        if (!isSnapshotLockstepEffectPackage(packageName)) {
          continue;
        }
      } else if (O.isSome(canonicalMajor)) {
        if (!isPublishedLockstepEffectPackage(packageName, versionSpecifier, canonicalMajor.value)) {
          continue;
        }
      } else {
        continue;
      }

      packages = A.append(packages, EffectCatalogPackage.make({ name: packageName, versionSpecifier }));
    }

    const rootConfig = yield* Effect.transposeOption(
      O.map(O.fromUndefinedOr(pkgJson.config), (config) =>
        decodeRootConfigEffectSource(config).pipe(
          VersionSyncError.mapError("Failed to decode config.effectSource in package.json", "package.json")
        )
      )
    );
    const effectSource = O.flatMap(rootConfig, (config) => config.effectSource);

    return EffectCatalogState.make({ canonicalSpecifier, packages, effectSource });
  }
);

/**
 * The exact published version a stable `effect` catalog entry pins, which is
 * the version `config.effectSource` must carry.
 *
 * **Details**
 *
 * Only a bare exact version qualifies. A range (`^4.1.1`), a pkg.pr.new
 * snapshot URL, or an empty entry yields `None`: a range does not name one
 * release tag, and a snapshot already carries its commit in the URL.
 *
 * **Example** (Read the pinned release version)
 *
 * ```ts
 * import { EffectCatalogState, effectSourceTargetVersion } from "@beep/repo-cli/test/VersionSync"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(effectSourceTargetVersion(EffectCatalogState.make({ canonicalSpecifier: "4.1.1" })))) // 4.1.1
 * console.log(O.isNone(effectSourceTargetVersion(EffectCatalogState.make({ canonicalSpecifier: "^4.1.1" })))) // true
 * ```
 *
 * @param state - Resolved Effect catalog state.
 * @returns The exact catalog version, or `None` when the entry is not a bare published version.
 * @category utilities
 * @since 0.0.0
 */
export const effectSourceTargetVersion = (state: EffectCatalogState): O.Option<string> =>
  O.flatMap(splitVersionSpecifier(state.canonicalSpecifier), (parts) =>
    Str.isEmpty(parts.prefix) ? O.some(parts.exact) : O.none()
  );

/**
 * Fetch the commit the Effect release tag `effect@<version>` points to.
 *
 * **Details**
 *
 * Calls `GET https://api.github.com/repos/Effect-TS/effect/commits/effect@<version>`.
 * The commits endpoint resolves any ref to its commit, so annotated and
 * lightweight tags both yield the commit sha. A non-2xx answer, a transport
 * failure, or a body without a 40-character lowercase sha fails with
 * {@link NetworkUnavailableError}.
 *
 * **Example** (Resolve the effect@4.1.1 commit)
 *
 * ```ts
 * import { fetchEffectReleaseCommit } from "@beep/repo-cli/test/VersionSync"
 * import * as Effect from "effect/Effect"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient"
 *
 * const program = fetchEffectReleaseCommit("4.1.1").pipe(Effect.provide(FetchHttpClient.layer))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param version - Exact published Effect version.
 * @returns The full release commit sha.
 * @category utilities
 * @since 0.0.0
 */
export const fetchEffectReleaseCommit = Effect.fn("EffectResolver.fetchEffectReleaseCommit")(function* (
  version: string
): Effect.fn.Return<string, NetworkUnavailableError, HttpClient.HttpClient> {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
  const response = yield* client
    .get(`${EFFECT_RELEASE_COMMIT_URL}/effect@${version}`, {
      headers: {
        "User-Agent": "beep-cli/0.0.0",
        Accept: "application/vnd.github+json",
      },
    })
    .pipe(NetworkUnavailableError.mapError(`GitHub commit lookup for effect@${version} failed`));
  const body = yield* HttpClientResponse.schemaBodyJson(EffectReleaseCommit)(response).pipe(
    NetworkUnavailableError.mapError(`Failed to parse the GitHub commit lookup for effect@${version}`)
  );
  return body.sha;
});

/**
 * Attach the upstream release commit of the exact `effect` catalog version to
 * resolved catalog state.
 *
 * **Details**
 *
 * Looks the commit up only when the catalog pins a bare published version and
 * the root manifest has `config.effectSource`. With `skipNetwork`, or when the
 * lookup fails, `releaseCommit` stays `None` and {@link buildEffectReport}
 * reports the pin as unresolved instead of guessing a commit.
 *
 * **Example** (Skip the lookup offline)
 *
 * ```ts
 * import { EffectCatalogState, withEffectReleaseCommit } from "@beep/repo-cli/test/VersionSync"
 * import * as Effect from "effect/Effect"
 *
 * const program = withEffectReleaseCommit(EffectCatalogState.make({ canonicalSpecifier: "4.1.1" }), true)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param state - Resolved Effect catalog state.
 * @param skipNetwork - When `true`, no lookup is made.
 * @returns The state with `releaseCommit` set when the lookup succeeded.
 * @category utilities
 * @since 0.0.0
 */
export const withEffectReleaseCommit = Effect.fn("EffectResolver.withEffectReleaseCommit")(function* (
  state: EffectCatalogState,
  skipNetwork: boolean
): Effect.fn.Return<EffectCatalogState, never, HttpClient.HttpClient> {
  const target = O.filter(effectSourceTargetVersion(state), () => O.isSome(state.effectSource));
  if (O.isNone(target) || skipNetwork) {
    return state;
  }

  const releaseCommit = yield* fetchEffectReleaseCommit(target.value).pipe(
    Effect.asSome,
    Effect.catchTag(
      "NetworkUnavailableError",
      Effect.fn(function* (error) {
        yield* Effect.logWarning(`Effect release commit resolution failed: ${error.message}`);
        return O.none<string>();
      })
    )
  );

  return EffectCatalogState.make({ ...state, releaseCommit });
});

type EffectSourceCheck = {
  readonly items: ReadonlyArray<VersionDriftItem>;
  readonly error: O.Option<string>;
};

const makeEffectSourceDriftItem = (key: string, current: string, expected: string): VersionDriftItem =>
  VersionDriftItem.make({
    file: "package.json",
    field: `${EFFECT_SOURCE_FIELD_PREFIX}${key}`,
    current,
    expected,
    line: O.none(),
  });

const checkEffectSource = (state: EffectCatalogState): EffectSourceCheck => {
  const target = effectSourceTargetVersion(state);
  if (O.isNone(target) || O.isNone(state.effectSource)) {
    return { items: A.empty(), error: O.none() };
  }

  const source = state.effectSource.value;
  const versionItems = Str.Equivalence(source.version, target.value)
    ? A.empty<VersionDriftItem>()
    : A.of(makeEffectSourceDriftItem("version", source.version, target.value));

  return O.match(state.releaseCommit, {
    onSome: (commit) => ({
      items: Str.Equivalence(source.commit, commit)
        ? versionItems
        : A.append(versionItems, makeEffectSourceDriftItem("commit", source.commit, commit)),
      error: O.none(),
    }),
    // Without the release commit the version alone cannot be rewritten: the
    // pin would pair the new version with the old commit.
    onNone: () => ({
      items: versionItems,
      error: Bool.match(A.isReadonlyArrayEmpty(versionItems), {
        onTrue: O.none<string>,
        onFalse: () =>
          O.some(
            `config.effectSource needs the effect@${target.value} release commit, which could not be resolved (network skipped or unavailable); rerun without --skip-network`
          ),
      }),
    }),
  });
};

/**
 * Build the Effect catalog category report from resolved state.
 *
 * **Details**
 *
 * Reports lockstep `catalog` drift and, for a bare published `effect` version,
 * `config.effectSource.version` and `config.effectSource.commit` drift. When
 * the version drifted but the release commit is unknown, the report is an
 * `error` naming the unresolved commit; write mode then leaves
 * `config.effectSource` untouched.
 *
 * @param state - Resolved Effect catalog dependency state.
 * @returns The Effect-specific version drift report derived from the catalog state.
 * @category utilities
 * @since 0.0.0
 */
export const buildEffectReport: (state: EffectCatalogState) => VersionCategoryReport = (state) => {
  if (Str.isEmpty(state.canonicalSpecifier)) {
    return VersionCategoryReport.cases.effect.make({
      status: VersionCategoryStatusEnum.error,
      items: A.empty(),
      latest: O.none(),
      error: O.some("effect not found in the root package.json catalog"),
    });
  }

  if (
    O.isNone(splitVersionSpecifier(state.canonicalSpecifier)) &&
    O.isNone(splitSnapshotSpecifier(state.canonicalSpecifier))
  ) {
    return VersionCategoryReport.cases.effect.make({
      status: VersionCategoryStatusEnum.error,
      items: A.empty(),
      latest: O.some(state.canonicalSpecifier),
      error: O.some(`Unsupported effect catalog version specifier: ${state.canonicalSpecifier}`),
    });
  }

  const canonicalSnapshot = splitSnapshotSpecifier(state.canonicalSpecifier);
  let items = A.empty<VersionDriftItem>();

  for (const pkg of state.packages) {
    const expectedSpecifier = O.match(canonicalSnapshot, {
      onNone: () => state.canonicalSpecifier,
      onSome: ({ sha }) => makeSnapshotSpecifier(pkg.name, sha),
    });

    if (pkg.versionSpecifier === expectedSpecifier) {
      continue;
    }

    items = A.append(
      items,
      VersionDriftItem.make({
        file: "package.json",
        field: `catalog.${pkg.name}`,
        current: pkg.versionSpecifier,
        expected: expectedSpecifier,
        line: O.none(),
      })
    );
  }

  const effectSourceCheck = checkEffectSource(state);
  items = A.appendAll(items, effectSourceCheck.items);

  return VersionCategoryReport.cases.effect.make({
    status: O.match(effectSourceCheck.error, {
      onNone: () => versionCategoryStatusFromDrift(items),
      onSome: () => VersionCategoryStatusEnum.error,
    }),
    items,
    latest: O.some(state.canonicalSpecifier),
    error: effectSourceCheck.error,
  });
};
