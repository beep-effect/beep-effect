/**
 * Effect catalog version resolver.
 *
 * Keeps the lockstep Effect v4 package family in the root `package.json`
 * `catalog` aligned with the canonical `effect` entry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { Effect, FileSystem, Number as N, Order, Path } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  VersionCategoryReport,
  VersionCategoryStatusEnum,
  VersionCategoryStatusThunk,
  VersionDriftItem,
  VersionSyncError,
} from "../../VersionSync.schemas.js";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/EffectResolver");
const VERSION_SPECIFIER_PATTERN = /^([~^<>=\s]*)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
const EXACT_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const EFFECT_SMOL_SNAPSHOT_PATTERN = /^https:\/\/pkg\.pr\.new\/Effect-TS\/effect-smol\/(.+)@([0-9a-f]+)$/i;
const LOCKSTEP_EFFECT_PACKAGE_PREFIX = "@effect/";
const NON_LOCKSTEP_EFFECT_PACKAGES = ["@effect/markdown-toc", "@effect/tsgo"] as const;

class RootPackageJsonDocument extends S.Class<RootPackageJsonDocument>($I`RootPackageJsonDocument`)(
  {
    catalog: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, string>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, string>()))
    ),
  },
  $I.annote("RootPackageJsonDocument", {
    description: "Subset of root package.json fields required for Effect catalog version resolution.",
  })
) {}

class EffectCatalogPackage extends S.Class<EffectCatalogPackage>($I`EffectCatalogPackage`)(
  {
    name: S.String,
    versionSpecifier: S.String,
  },
  $I.annote("EffectCatalogPackage", {
    description: "Tracked Effect catalog dependency and its version specifier.",
  })
) {}

/**
 * Resolved Effect catalog state derived from the root `package.json` catalog entries.
 *
 * @category models
 * @since 0.0.0
 */
export class EffectCatalogState extends S.Class<EffectCatalogState>($I`EffectCatalogState`)(
  {
    canonicalSpecifier: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefault(Effect.succeed(""))
    ),
    packages: S.Array(EffectCatalogPackage).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EffectCatalogPackage>())),
      S.withDecodingDefault(Effect.succeed(A.empty<EffectCatalogPackage>()))
    ),
  },
  $I.annote("EffectCatalogState", {
    description: "Resolved lockstep Effect catalog dependency state from the root package.json.",
  })
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
  O.flatMap(Str.match(EFFECT_SMOL_SNAPSHOT_PATTERN)(Str.trim(specifier)), (match) =>
    O.flatMap(O.fromUndefinedOr(match[1]), (packageName) =>
      O.map(O.fromUndefinedOr(match[2]), (sha) => ({ packageName, sha }))
    )
  );

const makeSnapshotSpecifier = (packageName: string, sha: string): string =>
  `https://pkg.pr.new/Effect-TS/effect-smol/${packageName}@${sha}`;

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
    !A.contains(NON_LOCKSTEP_EFFECT_PACKAGES, packageName)
  );
};

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
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const pkgJsonPath = path.join(repoRoot, "package.json");

    const pkgJsonContent = yield* fs
      .readFileString(pkgJsonPath)
      .pipe(VersionSyncError.mapError("Failed to read package.json", "package.json"));

    const pkgJson = yield* decodeJsoncTextAs(RootPackageJsonDocument)(pkgJsonContent).pipe(
      VersionSyncError.mapError("Failed to parse package.json", "package.json")
    );

    const canonicalSpecifier = O.getOrElse(R.get(pkgJson.catalog, "effect"), thunkEmptyStr);
    const canonicalMajor = O.flatMap(splitVersionSpecifier(canonicalSpecifier), (parts) =>
      parseMajorVersion(parts.exact)
    );
    const canonicalSnapshot = splitSnapshotSpecifier(canonicalSpecifier);
    let packages = A.empty<EffectCatalogPackage>();

    for (const packageName of A.sort(R.keys(pkgJson.catalog), Order.String)) {
      const versionSpecifier = pkgJson.catalog[packageName];

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

    return EffectCatalogState.make({ canonicalSpecifier, packages });
  }
);

/**
 * Build the Effect catalog category report from resolved state.
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

  return VersionCategoryReport.cases.effect.make({
    status: A.match(items, {
      onEmpty: VersionCategoryStatusThunk.ok,
      onNonEmpty: VersionCategoryStatusThunk.drift,
    }),
    items,
    latest: O.some(state.canonicalSpecifier),
    error: O.none(),
  });
};
