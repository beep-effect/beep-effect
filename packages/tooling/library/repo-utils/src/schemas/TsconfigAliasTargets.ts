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
const wildcardFileStemPattern = /(?:^|\/)\*\.tsx?$/u;

/**
 * Root alias target emitted into tsconfig/docgen path mappings.
 *
 * **Example** (Validate root alias target)
 *
 * ```ts
 * import { RootAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const isRootTarget = RootAliasTarget.is("./packages/example/src/index.ts")
 * console.log(isRootTarget)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const RootAliasTarget = S.String.check(S.isPattern(rootAliasTargetPattern)).pipe(
  $I.annoteSchema("RootAliasTarget", {
    description: "A repo-relative alias target beginning with ./ and containing no wildcard segment.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Runtime type for {@link RootAliasTarget}.
 *
 * **Example** (Accept RootAliasTarget type)
 *
 * ```ts
 * import type { RootAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const acceptRootTarget = (_value: RootAliasTarget) => undefined
 * console.log(acceptRootTarget)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RootAliasTarget = typeof RootAliasTarget.Type;

/**
 * Wildcard alias target emitted into tsconfig/docgen path mappings.
 *
 * **Example** (Validate wildcard alias target)
 *
 * ```ts
 * import { WildcardAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const isWildcardTarget = WildcardAliasTarget.is("./packages/example/src/*")
 * console.log(isWildcardTarget)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WildcardAliasTarget = S.String.check(S.isPattern(wildcardAliasTargetPattern)).pipe(
  $I.annoteSchema("WildcardAliasTarget", {
    description: "A repo-relative alias target beginning with ./ and containing a wildcard segment.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Runtime type for {@link WildcardAliasTarget}.
 *
 * **Example** (Accept WildcardAliasTarget type)
 *
 * ```ts
 * import type { WildcardAliasTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const acceptWildcardTarget = (_value: WildcardAliasTarget) => undefined
 * console.log(acceptWildcardTarget)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WildcardAliasTarget = typeof WildcardAliasTarget.Type;

/**
 * Canonical alias targets derived for a package root export.
 *
 * **Example** (Make canonical alias targets)
 *
 * ```ts
 * import { CanonicalAliasTargets } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const targets = CanonicalAliasTargets.make({
 *   rootAliasTarget: "./packages/example/src/index.ts",
 *   wildcardAliasTarget: "./packages/example/src/*"
 * })
 * console.log(targets.wildcardAliasTarget) // "./packages/example/src/*"
 * ```
 *
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
 * **Details**
 *
 * Conditional export objects are searched in repo-preferred order:
 * `types`, `import`, `default`, `require`, `node`, `bun`, then `browser`.
 * If an export map only contains subpaths and no `"."` key, this returns
 * `Option.none`.
 *
 * **Example** (Resolve root export target)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { resolveRootExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const target = resolveRootExportTarget({
 *   ".": { types: "./dist/index.d.ts", import: "./src/index.ts" },
 *   "./package.json": "./package.json"
 * })
 * console.log(O.getOrUndefined(target)) // "./dist/index.d.ts"
 * ```
 *
 * @param exportsField - Package `exports` field value the root entry is resolved from.
 * @returns The resolved root export target path, or `Option.none` when only subpaths exist.
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
 * **Example** (Resolve subpath export target)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { resolveSubpathExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const target = resolveSubpathExportTarget(
 *   { "./testing": { import: "./src/testing.ts" } },
 *   "./testing"
 * )
 * console.log(O.getOrUndefined(target)) // "./src/testing.ts"
 * ```
 *
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
 * **Example** (Resolve wildcard export target)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { resolveWildcardExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const wildcard = resolveWildcardExportTarget({ "./*": "./src/*.ts" })
 * console.log(O.getOrUndefined(wildcard)) // "./src/*.ts"
 * ```
 *
 * @param exportsField - Package `exports` field value the wildcard entry is resolved from.
 * @returns The resolved wildcard export target path, or `Option.none` when absent.
 * @category models
 * @since 0.0.0
 */
export const resolveWildcardExportTarget = (exportsField: unknown): O.Option<string> =>
  resolveSubpathExportTarget(exportsField, "./*");

/**
 * Build root and wildcard alias targets for a package export target.
 *
 * **Details**
 *
 * The wildcard target is derived from the directory that contains the root
 * export. A root export at `./src/index.ts` therefore maps wildcards to
 * `./src/*`, not to the package root.
 *
 * **Example** (Build package alias targets)
 *
 * ```ts
 * import { buildCanonicalAliasTargets } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const targets = buildCanonicalAliasTargets("packages/example", "./src/index.ts")
 * console.log(targets.rootAliasTarget) // "./packages/example/src/index.ts"
 * console.log(targets.wildcardAliasTarget) // "./packages/example/src/*"
 * ```
 *
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

/**
 * Derive a tsconfig wildcard alias target from a package wildcard export target.
 *
 * **Gotchas**
 *
 * Wildcard export targets whose `*` is a file stem (`./src/*.ts`,
 * `./src/components/*.tsx`) map to extensionless alias targets so TypeScript
 * extension substitution resolves them (`./<pkg>/src/*`). Every other shape —
 * most importantly the dir-uniform `./src/*` + `/index.ts` — passes through
 * verbatim, because an extensionless alias cannot resolve directory modules
 * under nodenext resolution.
 *
 * **Example** (Derive wildcard from export)
 *
 * ```ts
 * import { deriveWildcardAliasTargetFromExport } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * const flat = deriveWildcardAliasTargetFromExport("packages/example", "./src/*.ts")
 * const dir = deriveWildcardAliasTargetFromExport("packages/example", "./src/*" + "/index.ts")
 * console.log(flat) // "./packages/example/src/*"
 * console.log(dir.endsWith("index.ts")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const deriveWildcardAliasTargetFromExport: {
  (packagePath: string, wildcardExportTarget: string): WildcardAliasTarget;
  (wildcardExportTarget: string): (packagePath: string) => WildcardAliasTarget;
} = dual(2, (packagePath: string, wildcardExportTarget: string): WildcardAliasTarget => {
  const normalizedWildcardExportTarget = Str.replace(/^\.\//, "")(wildcardExportTarget);
  const aliasWildcardTarget = wildcardFileStemPattern.test(normalizedWildcardExportTarget)
    ? Str.replace(/\.tsx?$/u, "")(normalizedWildcardExportTarget)
    : normalizedWildcardExportTarget;

  return `./${packagePath}/${aliasWildcardTarget}`;
});

/**
 * Whether a wildcard export target uses its `*` as a file stem.
 *
 * **Gotchas**
 *
 * File-stem targets (`./src/SchemaUtils/*.ts`, `./src/components/*.tsx`) are
 * the shapes that need dedicated scoped aliases. Directory-shaped scoped
 * targets (`./src/aggregates/*` + `/index.ts`) must NOT get aliases: an alias
 * pattern rewrites unconditionally, so it would shadow sibling mid-star export
 * keys such as `./aggregates/*` + `/server` that only the package export map
 * can resolve.
 *
 * **Example** (Detect file-stem wildcards)
 *
 * ```ts
 * import { isFileStemWildcardExportTarget } from "@beep/repo-utils/schemas/TsconfigAliasTargets"
 * console.log(isFileStemWildcardExportTarget("./src/SchemaUtils/*.ts")) // true
 * console.log(isFileStemWildcardExportTarget("./src/aggregates/*" + "/index.ts")) // false
 * ```
 *
 * @param exportTarget - Wildcard export target path from a package `exports` field.
 * @returns `true` when the target's `*` names a `.ts`/`.tsx` file stem.
 * @category validation
 * @since 0.0.0
 */
export const isFileStemWildcardExportTarget = (exportTarget: string): boolean =>
  wildcardFileStemPattern.test(Str.replace(/^\.\//, "")(exportTarget));
