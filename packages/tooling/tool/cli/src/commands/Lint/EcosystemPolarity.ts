/**
 * Ecosystem package dependency-polarity lint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, readPackageJsonFile, toSortedRecord } from "@beep/repo-utils";
import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
import { normalizePath } from "@beep/schema";
import { A, Str, Text, thunkFalse } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import type { BoundaryRule } from "@beep/repo-workspaces/SourceBoundary";
import type * as HashMap from "effect/HashMap";

const $I = $RepoCliId.create("commands/Lint/EcosystemPolarity");
const ECOSYSTEM_ROOT = "packages/ecosystem";
const SOURCE_EXTENSIONS: ReadonlyArray<string> = [".ts", ".tsx", ".mts", ".cts"];
/** Every `@beep/*` module specifier is a forbidden repo-internal edge (`forbidImports` is a prefix match before `*`). */
const SOURCE_IMPORT_RULES: ReadonlyArray<BoundaryRule.Encoded> = [{ forbidImports: ["@beep/*"] }];

/**
 * Runtime options for the ecosystem-polarity lint.
 *
 * **Example** (Construct a full-scan option set)
 *
 * ```ts
 * import { EcosystemPolarityOptions } from "@beep/repo-cli/commands/Lint"
 *
 * const options = EcosystemPolarityOptions.make({})
 * console.log(options.includePaths) // undefined
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcosystemPolarityOptions extends S.Opaque<EcosystemPolarityOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    includePaths: S.Array(S.String).pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("EcosystemPolarityOptions", {
      description: "Optional changed-file scope for the ecosystem dependency-polarity lint.",
    })
  )
) {}

/**
 * A single ecosystem-polarity violation.
 *
 * **Example** (Construct a source-import violation)
 *
 * ```ts
 * import { EcosystemPolarityViolation } from "@beep/repo-cli/commands/Lint"
 *
 * const violation = EcosystemPolarityViolation.make({
 *   file: "packages/ecosystem/demo/src/index.ts",
 *   line: 1,
 *   kind: "source-import",
 *   detail: "@beep/forbidden",
 * })
 * console.log(violation.kind) // "source-import"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcosystemPolarityViolation extends S.Opaque<
  EcosystemPolarityViolation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    file: S.String,
    line: S.Finite,
    kind: S.Literals(["runtime-dependency", "bundled-dependencies", "source-import"] as const),
    detail: S.String,
  }).pipe(
    $I.annoteSchema("EcosystemPolarityViolation", {
      description: "A forbidden repo-internal runtime edge in an ecosystem member.",
    })
  )
) {}

/**
 * Summary returned by the ecosystem-polarity lint.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { EcosystemPolaritySummary } from "@beep/repo-cli/commands/Lint"
 *
 * const summary = EcosystemPolaritySummary.make({ checkedMembers: 1, scannedSourceFiles: 33, violations: [] })
 * console.log(summary.violations.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EcosystemPolaritySummary extends S.Opaque<EcosystemPolaritySummary, { readonly brand: unique symbol }>()(
  S.Struct({
    checkedMembers: S.Finite,
    scannedSourceFiles: S.Finite,
    violations: S.Array(EcosystemPolarityViolation),
  }).pipe(
    $I.annoteSchema("EcosystemPolaritySummary", {
      description: "Members, source files, and violations observed by the ecosystem-polarity lint.",
    })
  )
) {}

/**
 * Tagged filesystem or manifest failure raised while checking ecosystem polarity.
 *
 * **Example** (Construct a discovery failure)
 *
 * ```ts
 * import { EcosystemPolarityError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EcosystemPolarityError.new("Failed to list packages/ecosystem.")
 * console.log(error._tag) // "EcosystemPolarityError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EcosystemPolarityError extends S.TaggedError<EcosystemPolarityError, { readonly brand: unique symbol }>(
  $I`EcosystemPolarityError`
)(
  "EcosystemPolarityError",
  { message: S.String },
  $I.annoteError<EcosystemPolarityError>("EcosystemPolarityError", {
    description: "An ecosystem package could not be discovered, read, or decoded for polarity linting.",
  })
) {
  static readonly new = (message: string): EcosystemPolarityError => EcosystemPolarityError.make({ message });
}

class EcosystemMember extends S.Opaque<EcosystemMember, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    root: S.String,
    manifestPath: S.String,
  }).pipe(
    $I.annoteSchema("EcosystemMember", {
      description: "A directly nested package under packages/ecosystem.",
    })
  )
) {}

const changedMemberName = (filePath: string): O.Option<string> => {
  const segments = Str.split(normalizePath(filePath), "/");
  const member = A.get(segments, 2);
  const memberRelativePath = A.drop(segments, 3);
  const triggersMemberCheck =
    O.exists(A.get(segments, 0), Str.equivalence("packages")) &&
    O.exists(A.get(segments, 1), Str.equivalence("ecosystem")) &&
    ((A.length(memberRelativePath) === 1 && O.exists(A.head(memberRelativePath), Str.equivalence("package.json"))) ||
      O.exists(A.head(memberRelativePath), Str.equivalence("src")));

  return triggersMemberCheck ? O.filter(member, Str.isNonEmpty) : O.none();
};

const discoverMembers = Effect.fn("EcosystemPolarity.discoverMembers")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ecosystemRoot = path.join(repoRoot, ECOSYSTEM_ROOT);
  const rootExists = yield* fs.exists(ecosystemRoot).pipe(Effect.orElseSucceed(thunkFalse));

  if (!rootExists) {
    return A.empty<EcosystemMember>();
  }

  const entries = yield* fs
    .readDirectory(ecosystemRoot)
    .pipe(Effect.mapError(() => EcosystemPolarityError.new(`Failed to list ${ECOSYSTEM_ROOT}.`)));
  let members = A.empty<EcosystemMember>();

  for (const name of entries) {
    const root = path.join(ecosystemRoot, name);
    const manifestPath = path.join(root, "package.json");
    const manifestExists = yield* fs.exists(manifestPath).pipe(Effect.orElseSucceed(thunkFalse));

    if (manifestExists) {
      members = A.append(members, EcosystemMember.make({ name, root, manifestPath }));
    }
  }

  return A.sort(
    members,
    Order.mapInput(Order.String, (member: EcosystemMember) => member.name)
  );
});

const sourceViolations = Effect.fn("EcosystemPolarity.sourceViolations")(function* (
  member: EcosystemMember,
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = path.join(member.root, "src");
  const sourceRootStat = yield* fs.stat(sourceRoot).pipe(Effect.option);

  if (!O.exists(sourceRootStat, (stat) => stat.type === "Directory")) {
    return { scannedSourceFiles: 0, violations: A.empty<EcosystemPolarityViolation>() };
  }

  const scan = yield* SourceBoundary.scan({
    root: sourceRoot,
    rules: SOURCE_IMPORT_RULES,
    extensions: SOURCE_EXTENSIONS,
  }).pipe(
    Effect.mapError(() =>
      EcosystemPolarityError.new(
        `Failed to scan ecosystem source directory "${normalizePath(path.relative(repoRoot, sourceRoot))}".`
      )
    )
  );

  return {
    scannedSourceFiles: A.length(scan.files),
    violations: A.map(scan.offences, (offence) =>
      EcosystemPolarityViolation.make({
        file: normalizePath(path.relative(repoRoot, path.join(sourceRoot, offence.file))),
        line: offence.line,
        kind: "source-import",
        detail: offence.detail,
      })
    ),
  };
});

const runtimeDependencyViolations = (
  relativeManifestPath: string,
  field: string,
  dependencies: HashMap.HashMap<string, string>
): ReadonlyArray<EcosystemPolarityViolation> =>
  pipe(
    dependencies,
    toSortedRecord,
    R.toEntries,
    A.flatMap(([dependency, target]) => {
      const detail = Str.startsWith("@beep/")(dependency)
        ? O.some(`${field}.${dependency}`)
        : pipe(
            target,
            O.liftPredicate(Str.startsWith("npm:@beep/")),
            O.map((aliasTarget) => `${field}.${dependency} -> ${aliasTarget}`)
          );
      return O.match(detail, {
        onNone: A.empty<EcosystemPolarityViolation>,
        onSome: (violationDetail) =>
          A.of(
            EcosystemPolarityViolation.make({
              file: relativeManifestPath,
              line: 1,
              kind: "runtime-dependency",
              detail: violationDetail,
            })
          ),
      });
    })
  );

const bundledFieldViolations = (
  relativeManifestPath: string,
  fields: ReadonlyArray<readonly [field: string, value: unknown]>
): ReadonlyArray<EcosystemPolarityViolation> =>
  pipe(
    fields,
    A.filter(([, value]) => P.isNotUndefined(value)),
    A.map(([field]) =>
      EcosystemPolarityViolation.make({
        file: relativeManifestPath,
        line: 1,
        kind: "bundled-dependencies",
        detail: field,
      })
    )
  );

const manifestViolations = Effect.fn("EcosystemPolarity.manifestViolations")(function* (
  member: EcosystemMember,
  repoRoot: string
) {
  const manifest = yield* readPackageJsonFile(member.manifestPath).pipe(
    Effect.mapError(() => EcosystemPolarityError.new(`Failed to read or decode ${normalizePath(member.manifestPath)}.`))
  );
  const relativeManifestPath = normalizePath((yield* Path.Path).relative(repoRoot, member.manifestPath));
  const dependencyFields = [
    ["dependencies", manifest.dependencies],
    ["peerDependencies", manifest.peerDependencies],
    ["optionalDependencies", manifest.optionalDependencies],
  ] as const;
  const manifestEdges = A.flatMap(dependencyFields, ([field, dependencies]) =>
    runtimeDependencyViolations(relativeManifestPath, field, dependencies)
  );
  return A.appendAll(
    manifestEdges,
    bundledFieldViolations(relativeManifestPath, [
      ["bundledDependencies", manifest.bundledDependencies],
      ["bundleDependencies", manifest.bundleDependencies],
    ])
  );
});

/**
 * Check ecosystem members for forbidden repo-internal runtime edges.
 *
 * **Example** (Run a full-repo polarity check)
 *
 * ```ts
 * import { EcosystemPolarityOptions, runEcosystemPolarityCheck } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect";
 * const program = runEcosystemPolarityCheck(EcosystemPolarityOptions.make({}))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runEcosystemPolarityCheck = Effect.fn("EcosystemPolarity.runEcosystemPolarityCheck")(function* (
  options: EcosystemPolarityOptions
) {
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(() => EcosystemPolarityError.new("Could not locate the repository root."))
  );
  const discoveredMembers = yield* discoverMembers(repoRoot);
  const changedMembers = P.isUndefined(options.includePaths)
    ? O.none<HashSet.HashSet<string>>()
    : O.some(HashSet.fromIterable(A.getSomes(A.map(options.includePaths, changedMemberName))));
  const members = O.match(changedMembers, {
    onNone: () => discoveredMembers,
    onSome: (names) => A.filter(discoveredMembers, (member) => HashSet.has(names, member.name)),
  });
  let scannedSourceFiles = 0;
  let violations = A.empty<EcosystemPolarityViolation>();

  for (const member of members) {
    violations = A.appendAll(violations, yield* manifestViolations(member, repoRoot));
    const sources = yield* sourceViolations(member, repoRoot);
    scannedSourceFiles += sources.scannedSourceFiles;
    violations = A.appendAll(violations, sources.violations);
  }

  return EcosystemPolaritySummary.make({
    checkedMembers: A.length(members),
    scannedSourceFiles,
    violations,
  });
});

const runEcosystemPolarityLint = Effect.fn("EcosystemPolarity.runEcosystemPolarityLint")(function* (
  options: EcosystemPolarityOptions
) {
  const summary = yield* runEcosystemPolarityCheck(options);

  if (A.isReadonlyArrayNonEmpty(summary.violations)) {
    yield* Console.error(`[lint:ecosystem-polarity] found ${A.length(summary.violations)} violation(s).`);
    for (const violation of summary.violations) {
      yield* Console.error(`${violation.file}:${violation.line} [${violation.kind}] ${violation.detail}`);
    }
    return yield* failWithReportedExit("lint ecosystem-polarity: violations found.");
  }

  yield* Console.log(
    `[lint:ecosystem-polarity] OK: checked ${summary.checkedMembers} member(s), ${summary.scannedSourceFiles} source file(s).`
  );
});

/**
 * Lint command enforcing ecosystem package runtime polarity.
 *
 * **Example** (Inspect the registered command name)
 *
 * ```ts
 * import { lintEcosystemPolarityCommand } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(typeof lintEcosystemPolarityCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintEcosystemPolarityCommand = Command.make(
  "ecosystem-polarity",
  {
    include: Flag.String("include").pipe(
      Flag.withDescription(
        "Comma-separated changed files; a member manifest or src change expands to that member's full check"
      ),
      Flag.withDefault("*")
    ),
  },
  ({ include }) =>
    runEcosystemPolarityLint(
      EcosystemPolarityOptions.make({
        ...(Str.equivalence(include, "*") ? {} : { includePaths: Text.splitCommaSeparatedTrimmed(include) }),
      })
    )
).pipe(Command.withDescription("Reject @beep runtime edges and bundled dependencies in ecosystem packages"));
