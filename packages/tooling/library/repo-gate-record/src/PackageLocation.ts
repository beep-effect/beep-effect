/**
 * Where a package gate's record goes: the repository root (the nearest
 * ancestor holding `turbo.json`), the package directory relative to it and
 * the package name, plus the input fingerprint a run records. The Vitest
 * adapter and the repo CLI's check gate both locate a package this way.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoGateRecordId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constFalse, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { RepoRelativeDir } from "./GatePaths.ts";

const $I = $RepoGateRecordId.create("PackageLocation");

/**
 * The file that marks the repository root: Turbo's root configuration. A
 * package may carry its own `turbo.json`, which extends the root's
 * (`"extends": ["//"]`), so only a `turbo.json` that extends nothing marks
 * the root.
 *
 * **Example** (Read the marker)
 *
 * ```ts
 * import { REPO_ROOT_MARKER } from "@beep/repo-gate-record/PackageLocation";
 *
 * console.log(REPO_ROOT_MARKER); // turbo.json
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPO_ROOT_MARKER = "turbo.json";

class ManifestName extends S.Opaque<ManifestName, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.optionalKey(S.String) }).pipe(
    $I.annoteSchema("ManifestName", {
      description: "The name field of the package manifest a gate run belongs to.",
    })
  )
) {}

class TurboConfigHead extends S.Opaque<TurboConfigHead, { readonly brand: unique symbol }>()(
  S.Struct({ extends: S.String.pipe(S.Array, S.optionalKey) }).pipe(
    $I.annoteSchema("TurboConfigHead", {
      description: "The extends field of a turbo.json, which tells a package configuration from the root one.",
    })
  )
) {}

const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(ManifestName));
const decodeTurboConfigHead = S.decodeUnknownEffect(S.fromJsonString(TurboConfigHead));
const isRepoRelativeDir = S.is(RepoRelativeDir);

/**
 * A located package: the repository root, the package directory relative to
 * it, and the package name (the directory when the manifest names none).
 *
 * **Example** (Describe a package)
 *
 * ```ts
 * import { PackageLocation } from "@beep/repo-gate-record/PackageLocation";
 *
 * const located = PackageLocation.make({
 *   repoRoot: "/repo",
 *   packageDir: "packages/foundation/primitive/glob",
 *   subject: "@beep/glob",
 * });
 * console.log(located.subject); // @beep/glob
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PackageLocation extends S.Opaque<PackageLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.NonEmptyString,
    packageDir: RepoRelativeDir,
    subject: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("PackageLocation", {
      description: "A package's repository root, its directory relative to that root, and its name.",
    })
  )
) {}

/**
 * The repository root above a directory: the nearest ancestor (the
 * directory itself included) whose {@link REPO_ROOT_MARKER} extends nothing.
 *
 * **Example** (Find the root)
 *
 * ```ts
 * import { findRepoRoot } from "@beep/repo-gate-record/PackageLocation";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(findRepoRoot("/repo/packages/a"))); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findRepoRoot: (dir: string) => Effect.Effect<O.Option<string>, never, FileSystem.FileSystem | Path.Path> =
  Effect.fnUntraced(function* (dir: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const marked = yield* fs.readFileString(path.join(dir, REPO_ROOT_MARKER)).pipe(
      Effect.flatMap(decodeTurboConfigHead),
      Effect.map((config) => config.extends === undefined),
      Effect.orElseSucceed(constFalse)
    );
    if (marked) return O.some(dir);
    const parent = path.dirname(dir);
    return parent === dir ? O.none() : yield* findRepoRoot(parent);
  });

const packageName = Effect.fnUntraced(function* (dir: string, fallback: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(dir, "package.json")).pipe(
    Effect.flatMap(decodeManifest),
    Effect.map((manifest) => O.getOrElse(O.fromUndefinedOr(manifest.name), () => fallback)),
    Effect.orElseSucceed(() => fallback)
  );
});

/**
 * Locate the package a directory is: none when no ancestor is a repository
 * root, or when the directory is the root itself, which is not a package.
 *
 * **Example** (Locate a package directory)
 *
 * ```ts
 * import { locatePackage } from "@beep/repo-gate-record/PackageLocation";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(locatePackage("/repo/packages/a"))); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const locatePackage = Effect.fn("PackageLocation.locatePackage")(function* (dir: string) {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot(dir);
  const packageDir = O.filter(
    O.map(repoRoot, (repo) => path.relative(repo, dir)),
    isRepoRelativeDir
  );
  return yield* pipe(
    O.all({ repoRoot, packageDir }),
    O.match({
      onNone: () => Effect.succeedNone,
      onSome: ({ repoRoot, packageDir }) =>
        Effect.asSome(
          Effect.map(packageName(dir, packageDir), (subject) => PackageLocation.make({ repoRoot, packageDir, subject }))
        ),
    })
  );
});

/**
 * The input fingerprint of a run: Turbo's task hash (`TURBO_HASH`) when
 * Turbo ran the task, otherwise a value unique to the run, so two local runs
 * never compare as the same input.
 *
 * **Example** (Fingerprint a local run)
 *
 * ```ts
 * import { inputFingerprint } from "@beep/repo-gate-record/PackageLocation";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(inputFingerprint("20261119T100000123Z-0a1b"))); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const inputFingerprint = Effect.fn("PackageLocation.inputFingerprint")(function* (runId: string) {
  const hash = yield* Config.option(Config.NonEmptyString("TURBO_HASH"));
  return pipe(
    O.map(hash, (value) => `turbo:${value}`),
    O.getOrElse(() => `local:${runId}`)
  );
});
