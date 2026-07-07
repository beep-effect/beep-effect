/**
 * Shared alias target helpers for tsconfig and docgen path mappings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("schemas/TsconfigAliasTargets");
const EXPORT_CONDITION_PRIORITY = ["types", "import", "default", "require", "node", "bun", "browser"] as const;
const rootAliasTargetPattern = /^\.\/(?!.*\*).+/u;
const wildcardAliasTargetPattern = /^\.\/.*\*.*$/u;

type BuildDocgenAliasTargetsOptions = {
  readonly rootExportTarget: string;
  readonly wildcardExportTarget?: string | undefined;
};

/**
 * Root alias target emitted into tsconfig/docgen path mappings.
 *
 * @example
 * ```ts
 * import { RootAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const isRootTarget = RootAliasTarget.is("./packages/example/src/index.ts")
 * console.log(isRootTarget)
 * ```
 * @category validation
 * @since 0.0.0
 */
export const RootAliasTarget = S.String.check(S.isPattern(rootAliasTargetPattern)).pipe(
  $I.annoteSchema("RootAliasTarget", {
    description: "A repo-relative alias target beginning with ./ and containing no wildcard segment.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link RootAliasTarget}.
 *
 * @example
 * ```ts
 * import type { RootAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const acceptRootTarget = (_value: RootAliasTarget) => undefined
 * console.log(acceptRootTarget)
 * ```
 * @category models
 * @since 0.0.0
 */
export type RootAliasTarget = typeof RootAliasTarget.Type;

/**
 * Wildcard alias target emitted into tsconfig/docgen path mappings.
 *
 * @example
 * ```ts
 * import { WildcardAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const isWildcardTarget = WildcardAliasTarget.is("./packages/example/src/*")
 * console.log(isWildcardTarget)
 * ```
 * @category validation
 * @since 0.0.0
 */
export const WildcardAliasTarget = S.String.check(S.isPattern(wildcardAliasTargetPattern)).pipe(
  $I.annoteSchema("WildcardAliasTarget", {
    description: "A repo-relative alias target beginning with ./ and containing a wildcard segment.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link WildcardAliasTarget}.
 *
 * @example
 * ```ts
 * import type { WildcardAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const acceptWildcardTarget = (_value: WildcardAliasTarget) => undefined
 * console.log(acceptWildcardTarget)
 * ```
 * @category models
 * @since 0.0.0
 */
export type WildcardAliasTarget = typeof WildcardAliasTarget.Type;

/**
 * Canonical alias targets derived for a package root export.
 *
 * @example
 * ```ts
 * import { CanonicalAliasTargets } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const targets = CanonicalAliasTargets.make({
 *   rootAliasTarget: "./packages/example/src/index.ts",
 *   wildcardAliasTarget: "./packages/example/src/*"
 * })
 * console.log(targets.wildcardAliasTarget) // "./packages/example/src/*"
 * ```
 * @category models
 * @since 0.0.0
 */
export class CanonicalAliasTargets extends S.Class<CanonicalAliasTargets>($I`CanonicalAliasTargets`)(
  {
    rootAliasTarget: RootAliasTarget.annotateKey({
      description: "Concrete root import target for the package alias.",
    }),
    wildcardAliasTarget: WildcardAliasTarget.annotateKey({
      description: "Wildcard import target for package subpath aliases.",
    }),
  },
  $I.annote("CanonicalAliasTargets", {
    description: "Canonical root and wildcard alias targets derived for a package root export.",
  })
) {}

const isRelativeDotPath = (value: unknown): value is string => P.isString(value) && Str.startsWith("./")(value);

const isReadonlyUnknownRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value);

const isSubpathExportKey = (key: string): boolean => key === "." || Str.startsWith("./")(key);

const firstRelativeDotPath = (value: unknown): O.Option<string> => {
  if (isRelativeDotPath(value)) {
    return O.some(value);
  }

  if (A.isArray(value)) {
    return pipe(value, A.map(firstRelativeDotPath), O.firstSomeOf);
  }

  if (isReadonlyUnknownRecord(value)) {
    const prioritizedCandidate = pipe(
      EXPORT_CONDITION_PRIORITY,
      A.map((key) => pipe(value, R.get(key), O.flatMap(firstRelativeDotPath))),
      O.firstSomeOf
    );

    return pipe(
      prioritizedCandidate,
      O.orElse(() => pipe(value, R.values, A.map(firstRelativeDotPath), O.firstSomeOf))
    );
  }

  return O.none();
};

/**
 * Resolve the canonical root export target from a package `exports` field.
 *
 * @param exportsField - Package `exports` field value the root entry is resolved from.
 * @returns The resolved root export target path, or `Option.none` when only subpaths exist.
 * @remarks
 * Conditional export objects are searched in repo-preferred order:
 * `types`, `import`, `default`, `require`, `node`, `bun`, then `browser`.
 * If an export map only contains subpaths and no `"."` key, this returns
 * `Option.none`.
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { resolveRootExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const target = resolveRootExportTarget({
 *   ".": { types: "./dist/index.d.ts", import: "./src/index.ts" },
 *   "./package.json": "./package.json"
 * })
 * console.log(O.getOrUndefined(target)) // "./dist/index.d.ts"
 * ```
 * @category models
 * @since 0.0.0
 */
export const resolveRootExportTarget = (exportsField: unknown): O.Option<string> => {
  if (isReadonlyUnknownRecord(exportsField)) {
    if (P.hasProperty(exportsField, ".")) {
      return firstRelativeDotPath(exportsField["."]);
    }
    if (A.some(R.keys(exportsField), isSubpathExportKey)) {
      return O.none();
    }
  }

  return firstRelativeDotPath(exportsField);
};

/**
 * Resolve a specific subpath export target from a package `exports` field.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { resolveSubpathExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const target = resolveSubpathExportTarget(
 *   { "./testing": { import: "./src/testing.ts" } },
 *   "./testing"
 * )
 * console.log(O.getOrUndefined(target)) // "./src/testing.ts"
 * ```
 * @category models
 * @since 0.0.0
 */
export const resolveSubpathExportTarget: {
  (exportsField: unknown, subpath: string): O.Option<string>;
  (subpath: string): (exportsField: unknown) => O.Option<string>;
} = dual(2, (exportsField: unknown, subpath: string): O.Option<string> => {
  if (isReadonlyUnknownRecord(exportsField)) {
    return pipe(exportsField, R.get(subpath), O.flatMap(firstRelativeDotPath));
  }

  return O.none();
});

/**
 * Resolve the wildcard export target from a package `exports` field.
 *
 * @param exportsField - Package `exports` field value the wildcard entry is resolved from.
 * @returns The resolved wildcard export target path, or `Option.none` when absent.
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { resolveWildcardExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const wildcard = resolveWildcardExportTarget({ "./*": "./src/*.ts" })
 * console.log(O.getOrUndefined(wildcard)) // "./src/*.ts"
 * ```
 * @category models
 * @since 0.0.0
 */
export const resolveWildcardExportTarget = (exportsField: unknown): O.Option<string> =>
  resolveSubpathExportTarget(exportsField, "./*");

/**
 * Build root and wildcard alias targets for a package export target.
 *
 * @remarks
 * The wildcard target is derived from the directory that contains the root
 * export. A root export at `./src/index.ts` therefore maps wildcards to
 * `./src/*`, not to the package root.
 * @example
 * ```ts
 * import { buildCanonicalAliasTargets } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const targets = buildCanonicalAliasTargets("packages/example", "./src/index.ts")
 * console.log(targets.rootAliasTarget) // "./packages/example/src/index.ts"
 * console.log(targets.wildcardAliasTarget) // "./packages/example/src/*"
 * ```
 * @category models
 * @since 0.0.0
 */
export const buildCanonicalAliasTargets: {
  (packagePath: string, rootExportTarget: string): CanonicalAliasTargets;
  (rootExportTarget: string): (packagePath: string) => CanonicalAliasTargets;
} = dual(2, (packagePath: string, rootExportTarget: string): CanonicalAliasTargets => {
  const normalizedRootExportTarget = Str.replace(/^\.\//, "")(rootExportTarget);
  const rootAliasTarget = `./${packagePath}/${normalizedRootExportTarget}`;
  const lastSlash = pipe(
    rootAliasTarget,
    Str.lastIndexOf("/"),
    O.getOrElse(() => -1)
  );

  return CanonicalAliasTargets.make({
    rootAliasTarget,
    wildcardAliasTarget: lastSlash < 0 ? `./${packagePath}/*` : `${pipe(rootAliasTarget, Str.slice(0, lastSlash))}/*`,
  });
});

const deriveDocgenWildcardTarget = (rootExportTarget: string): string => {
  const normalizedRootExportTarget = Str.replace(/^\.\//, "")(rootExportTarget);
  const lastSlash = pipe(
    normalizedRootExportTarget,
    Str.lastIndexOf("/"),
    O.getOrElse(() => -1)
  );

  if (lastSlash < 0) {
    return Str.endsWith(".ts")(normalizedRootExportTarget) ? "*.ts" : "*";
  }

  const parentDir = pipe(normalizedRootExportTarget, Str.slice(0, lastSlash));
  return Str.endsWith(".ts")(normalizedRootExportTarget) ? `${parentDir}/*.ts` : `${parentDir}/*`;
};

/**
 * Build source-root and source-wildcard alias targets for docgen example resolution.
 *
 * Unlike root tsconfig aliases, docgen aliases should mirror source exports directly
 * so example imports resolve to concrete `*.ts` files.
 *
 * @remarks
 * When the package manifest has no explicit wildcard export, the wildcard is
 * inferred from the root export's containing directory. This keeps docgen
 * examples compiling against source files without changing the published
 * package's actual export surface.
 * @example
 * ```ts
 * import { buildDocgenAliasTargets } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const targets = buildDocgenAliasTargets("packages/example", {
 *   rootExportTarget: "./src/index.ts",
 *   wildcardExportTarget: "./src/*.ts"
 * })
 * console.log(targets.wildcardAliasTarget) // "./packages/example/src/*.ts"
 * ```
 * @category models
 * @since 0.0.0
 */
export const buildDocgenAliasTargets: {
  (packagePath: string, options: BuildDocgenAliasTargetsOptions): CanonicalAliasTargets;
  (options: BuildDocgenAliasTargetsOptions): (packagePath: string) => CanonicalAliasTargets;
} = dual(2, (packagePath: string, options: BuildDocgenAliasTargetsOptions): CanonicalAliasTargets => {
  const normalizedRootExportTarget = Str.replace(/^\.\//, "")(options.rootExportTarget);
  const normalizedWildcardExportTarget = Str.replace(
    /^\.\//,
    ""
  )(options.wildcardExportTarget ?? deriveDocgenWildcardTarget(options.rootExportTarget));

  return CanonicalAliasTargets.make({
    rootAliasTarget: `./${packagePath}/${normalizedRootExportTarget}`,
    wildcardAliasTarget: `./${packagePath}/${normalizedWildcardExportTarget}`,
  });
});
