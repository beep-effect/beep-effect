/**
 * The tolerant reads every manifest projection shares: the `version` rule
 * and the dependency blocks carried only when they have the expected shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $RepoWorkspacesId.create("internal/manifestFields");

const DependencyBlock = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("DependencyBlock", { description: "A manifest dependency block mapping names to ranges." })
);

const isDependencyBlock = S.is(DependencyBlock);

const ABSENT_DEPENDENCY_RECORD_ROUND_TRIPS_AS_EMPTY: Readonly<Record<string, string>> = R.fromEntries([]);

/**
 * A model's dependency-record field: names to specifiers, defaulting to `{}`
 * when the key is absent on decode or omitted at construction.
 *
 * **Example** (Default an omitted dependency record)
 *
 * ```ts
 * import { DependencyMap } from "@beep/repo-workspaces/internal/manifestFields";
 * import * as S from "effect/Schema";
 *
 * const Model = S.Struct({ dependencies: DependencyMap });
 * console.log(S.decodeUnknownSync(Model)({}).dependencies); // {}
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DependencyMap = DependencyBlock.pipe(
  S.withDecodingDefaultKey(Effect.succeed(ABSENT_DEPENDENCY_RECORD_ROUND_TRIPS_AS_EMPTY)),
  S.withConstructorDefault(Effect.succeed(ABSENT_DEPENDENCY_RECORD_ROUND_TRIPS_AS_EMPTY))
);

/**
 * **Example** (Check a model's dependency records)
 *
 * ```ts
 * import { DependencyBlocks } from "@beep/repo-workspaces/internal/manifestFields";
 * import * as S from "effect/Schema";
 *
 * const blocks = { dependencies: {}, devDependencies: {}, peerDependencies: {}, optionalDependencies: {} };
 * console.log(S.is(DependencyBlocks)(blocks)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DependencyBlocks extends S.Opaque<DependencyBlocks, { readonly brand: unique symbol }>()(
  S.Struct({
    dependencies: DependencyBlock.pipe(
      $I.annoteKey("DependencyBlocks.dependencies", { description: "Runtime dependencies." })
    ),
    devDependencies: DependencyBlock.pipe(
      $I.annoteKey("DependencyBlocks.devDependencies", { description: "Development dependencies." })
    ),
    peerDependencies: DependencyBlock.pipe(
      $I.annoteKey("DependencyBlocks.peerDependencies", { description: "Peer dependencies." })
    ),
    optionalDependencies: DependencyBlock.pipe(
      $I.annoteKey("DependencyBlocks.optionalDependencies", { description: "Optional dependencies." })
    ),
  }).pipe($I.annoteSchema("DependencyBlocks", { description: "A model's four dependency records." }))
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DependencyBlocks {
  /**
   * The plain, unbranded encoded shape of a {@link DependencyBlocks}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DependencyBlocks.Encoded;
}

/**
 * **Example** (Check a partial set of dependency records)
 *
 * ```ts
 * import { PresentDependencyBlocks } from "@beep/repo-workspaces/internal/manifestFields";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PresentDependencyBlocks)({ dependencies: { effect: "^4.0.0" } })); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PresentDependencyBlocks extends S.Opaque<PresentDependencyBlocks, { readonly brand: unique symbol }>()(
  S.Struct({
    dependencies: S.optionalKey(DependencyBlock).pipe(
      $I.annoteKey("PresentDependencyBlocks.dependencies", { description: "Runtime dependencies, when usable." })
    ),
    devDependencies: S.optionalKey(DependencyBlock).pipe(
      $I.annoteKey("PresentDependencyBlocks.devDependencies", { description: "Development dependencies, when usable." })
    ),
    peerDependencies: S.optionalKey(DependencyBlock).pipe(
      $I.annoteKey("PresentDependencyBlocks.peerDependencies", { description: "Peer dependencies, when usable." })
    ),
    optionalDependencies: S.optionalKey(DependencyBlock).pipe(
      $I.annoteKey("PresentDependencyBlocks.optionalDependencies", {
        description: "Optional dependencies, when usable.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PresentDependencyBlocks", {
      description: "The usable dependency records a manifest carries, each omitted when absent or malformed.",
    })
  )
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PresentDependencyBlocks {
  /**
   * The plain, unbranded encoded shape of a {@link PresentDependencyBlocks}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PresentDependencyBlocks.Encoded;
}

/**
 * Merges a model's four dependency records into one.
 *
 * **Details**
 *
 * Precedence on a name declared in several kinds runs `dependencies` \>
 * `devDependencies` \> `peerDependencies` \> `optionalDependencies`.
 *
 * **Example** (Prefer runtime dependencies over development ones)
 *
 * ```ts
 * import { mergedDependencies } from "@beep/repo-workspaces/internal/manifestFields";
 *
 * const merged = mergedDependencies({
 *   dependencies: { effect: "^4.0.0" },
 *   devDependencies: { effect: "^3.0.0" },
 *   peerDependencies: {},
 *   optionalDependencies: {},
 * });
 * console.log(merged.effect); // ^4.0.0
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mergedDependencies = (blocks: DependencyBlocks.Encoded): Record<string, string> =>
  R.fromEntries([
    ...R.toEntries(blocks.optionalDependencies),
    ...R.toEntries(blocks.peerDependencies),
    ...R.toEntries(blocks.devDependencies),
    ...R.toEntries(blocks.dependencies),
  ]);

/**
 * Reads a manifest's `version` field, or the sentence saying why it is
 * unusable.
 *
 * **Details**
 *
 * `version` is optional, and optional means ABSENT — not "any present value
 * counts". Absent stays absent: pnpm accepts a version-less private package,
 * and a private root without one is the ordinary shape. A present non-string
 * is the manifest's shape being wrong, and so is `""`: pnpm never wrote that
 * shape, and admitting it resolves `workspace:^` to a bare `"^"` and makes
 * `versionOf` answer `some("")`, which every consumer downstream reads as a
 * real version. `WorkspaceDiscovery` fails both as `invalidShape` with these
 * sentences, and `WorkspacesSync` reports the same skip with the same
 * sentence rather than raising it.
 *
 * **Example** (Validate manifest versions)
 *
 * ```ts
 * import { manifestVersionOf } from "@beep/repo-workspaces/internal/manifestFields";
 * import * as Result from "effect/Result";
 *
 * console.log(Result.isSuccess(manifestVersionOf("1.0.0"))); // true
 * console.log(Result.isSuccess(manifestVersionOf(undefined))); // true
 * console.log(Result.isFailure(manifestVersionOf(""))); // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const manifestVersionOf = (version: unknown): Result.Result<string | undefined, string> => {
  if (version === undefined) return Result.succeed(undefined);
  if (!P.isString(version)) return Result.fail(`version must be a string, got ${typeof version}`);
  return version === "" ? Result.fail("version must be a non-empty string") : Result.succeed(version);
};

/**
 * Reads the dependency blocks of a manifest that map names to ranges,
 * omitting any block that is absent or has another shape.
 *
 * **Details**
 *
 * The tolerant projection discovery and at-ref snapshots both apply: a
 * malformed block is dropped rather than failing the read, and an absent one
 * stays absent.
 *
 * **Example** (Keep only usable dependency blocks)
 *
 * ```ts
 * import { dependencyBlocksOf } from "@beep/repo-workspaces/internal/manifestFields";
 *
 * const blocks = dependencyBlocksOf({ dependencies: { effect: "^4.0.0" }, devDependencies: 42 });
 * console.log(blocks.dependencies?.effect); // ^4.0.0
 * console.log("devDependencies" in blocks); // false
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const dependencyBlocksOf = (manifest: Readonly<Record<string, unknown>>): PresentDependencyBlocks.Encoded => ({
  ...(isDependencyBlock(manifest.dependencies) ? { dependencies: manifest.dependencies } : {}),
  ...(isDependencyBlock(manifest.devDependencies) ? { devDependencies: manifest.devDependencies } : {}),
  ...(isDependencyBlock(manifest.peerDependencies) ? { peerDependencies: manifest.peerDependencies } : {}),
  ...(isDependencyBlock(manifest.optionalDependencies) ? { optionalDependencies: manifest.optionalDependencies } : {}),
});
