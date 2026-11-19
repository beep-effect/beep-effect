/**
 * Unbuilt-reference probe: a filesystem-only check that every project a package
 * references has its declaration index on disk, shared by the package-local
 * `check` entry points and the check census.
 *
 * The module stays lean on purpose: `beep-cli quality check-probe` runs it from
 * the slim entry before every package-local `bun run check`, so it imports no
 * command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { thunkFalse } from "@beep/utils/thunk";
import * as A from "effect/Array";
import * as Cache from "effect/Cache";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/CheckProbe");

/**
 * A tsconfig or manifest the probe reads could not be read or resolved.
 *
 * **Example** (Explain an unreadable tsconfig)
 *
 * ```ts
 * import { CheckProbeReadError } from "@beep/repo-cli/commands/Quality/CheckProbe"
 *
 * const error = CheckProbeReadError.make({ message: "Failed to read references from /repo/tsconfig.json." })
 * console.log(error._tag) // "CheckProbeReadError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CheckProbeReadError extends S.TaggedError<CheckProbeReadError, { readonly brand: unique symbol }>(
  $I`CheckProbeReadError`
)(
  "CheckProbeReadError",
  { message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<CheckProbeReadError>("CheckProbeReadError", {
    description: "A tsconfig or package manifest the unbuilt-reference probe reads could not be read or resolved.",
  })
) {}

const readFailure =
  (message: string) =>
  (cause: unknown): CheckProbeReadError =>
    CheckProbeReadError.make({ message, cause });

/**
 * A package check stopped before its compiler: projects the package references
 * have no declaration index on disk.
 *
 * **Details**
 *
 * The probe prints `message`, its one line, before failing, so the error is
 * marked reported: the CLI renders nothing more and exits with code 1.
 *
 * **Example** (Describe an unbuilt upstream)
 *
 * ```ts
 * import { UnbuiltReferenceOutputs } from "@beep/repo-cli/commands/Quality/CheckProbe"
 *
 * const error = UnbuiltReferenceOutputs.make({
 *   message: "[beep-cli] @beep/data check: unbuilt upstream declarations: 1 missing",
 *   package: "@beep/data",
 *   missing: 1,
 *   firstOutput: "../../modeling/utils/dist/index.d.ts",
 *   buildCommand: "bun x turbo run build --filter=@beep/data^...",
 * })
 * console.log(error.missing) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnbuiltReferenceOutputs extends S.TaggedError<UnbuiltReferenceOutputs, { readonly brand: unique symbol }>(
  $I`UnbuiltReferenceOutputs`
)(
  "UnbuiltReferenceOutputs",
  {
    message: S.String,
    package: S.String,
    missing: S.Int,
    firstOutput: S.String,
    buildCommand: S.String,
  },
  $I.annoteError<UnbuiltReferenceOutputs>("UnbuiltReferenceOutputs", {
    description:
      "A package check stopped before its compiler because referenced projects have no declaration index on disk.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /** The probe already printed its one line; the runtime adds nothing. */
  override readonly [Runtime.errorReported] = false;
}

// The base config emits declarations to `${configDir}/dist`; a referenced
// project that sets no `outDir` of its own lands there.
const DEFAULT_DECLARATION_OUT_DIR = "dist";
const DECLARATION_INDEX_FILE = "index.d.ts";

/**
 * A referenced project whose declaration index is absent, so a program that
 * keeps the reference would report TS6305 instead of type errors.
 *
 * **Example** (Describe a missing output)
 *
 * ```ts
 * import { MissingReferenceOutput } from "@beep/repo-cli/commands/Quality/CheckProbe"
 *
 * const missing = MissingReferenceOutput.make({
 *   package: "@beep/n3",
 *   reference: "../../foundation/modeling/schema/tsconfig.json",
 *   declarationFile: "packages/foundation/modeling/schema/dist/index.d.ts",
 * })
 * console.log(missing.declarationFile.endsWith("index.d.ts")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MissingReferenceOutput extends S.Opaque<MissingReferenceOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    package: S.String,
    reference: S.String,
    declarationFile: S.String,
  }).pipe(
    $I.annoteSchema("MissingReferenceOutput", {
      description:
        "A project referenced by a package whose declaration index (outDir/index.d.ts) does not exist on disk.",
    })
  )
) {}

// Only the name is read from the manifest; a nameless package falls back to its directory.
class PackageManifestName extends S.Opaque<PackageManifestName, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.optionalKey(S.String) }).pipe(
    $I.annoteSchema("PackageManifestName", {
      description: "The name field of a workspace package manifest, read to address its build closure.",
    })
  )
) {}

const decodePackageManifestName = S.decodeUnknownEffect(S.fromJsonString(PackageManifestName));

/**
 * Read the `references` of a package's `tsconfig.json`, keeping each
 * reference's `path` only.
 *
 * **Example** (List a package's references)
 *
 * ```ts
 * import { readTsconfigReferences } from "@beep/repo-cli/commands/Quality/CheckProbe"
 * import * as Effect from "effect/Effect"
 *
 * const program = readTsconfigReferences("/repo/packages/foundation/primitive/data")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param packageDir - Absolute package directory holding `tsconfig.json`.
 * @returns The reference paths, as written, in declaration order.
 * @category utilities
 * @since 0.0.0
 */
export const readTsconfigReferences = Effect.fn("CheckProbe.readTsconfigReferences")(function* (
  packageDir: string
): Effect.fn.Return<ReadonlyArray<{ readonly path: string }>, CheckProbeReadError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const tsconfigPath = path.join(packageDir, "tsconfig.json");
  const tsconfig = yield* TsconfigLoader.load(tsconfigPath).pipe(
    Effect.mapError(readFailure(`Failed to read references from ${tsconfigPath}.`))
  );

  // Only each reference's `path` is kept; the census overlay strips every
  // other key (`prepend`, `circular`) the same way.
  return A.map(tsconfig.references ?? A.empty(), (reference) => ({ path: reference.path }));
});

// A reference names a tsconfig file or a directory holding tsconfig.json.
const referencedTsconfigPath = Effect.fn("CheckProbe.referencedTsconfigPath")(function* (
  packageDir: string,
  reference: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = path.resolve(packageDir, reference);
  const stat = yield* fs.stat(resolved).pipe(Effect.option);

  return O.isSome(stat) && stat.value.type === "Directory" ? path.join(resolved, "tsconfig.json") : resolved;
});

// The declaration index a reference-keeping program resolves the referenced
// project through: `<outDir>/index.d.ts`, with `outDir` resolved through the
// project's full `extends` chain (absolute, `${configDir}` substituted).
const referencedDeclarationIndex = Effect.fn("CheckProbe.referencedDeclarationIndex")(function* (
  tsconfigPath: string
): Effect.fn.Return<string, CheckProbeReadError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const compilerOptions = yield* TsconfigLoader.compilerOptions(tsconfigPath).pipe(
    Effect.mapError(readFailure(`Failed to resolve compilerOptions.outDir of referenced project ${tsconfigPath}.`))
  );
  const outDir = compilerOptions.outDir ?? DEFAULT_DECLARATION_OUT_DIR;

  return path.resolve(path.dirname(tsconfigPath), outDir, DECLARATION_INDEX_FILE);
});

/**
 * Memo of each referenced tsconfig's declaration index, so a run that probes
 * many packages resolves each `extends` chain once.
 *
 * @category models
 * @since 0.0.0
 */
export type DeclarationIndexCache = Cache.Cache<string, string, CheckProbeReadError>;

/**
 * Make a {@link DeclarationIndexCache} for one probe run.
 *
 * **Details**
 *
 * The repo has about 185 projects behind 1,273 references, so a census
 * resolves each extends chain once. The cache lives for one run, so it is
 * unbounded.
 *
 * **Example** (Share one cache across packages)
 *
 * ```ts
 * import { makeDeclarationIndexCache } from "@beep/repo-cli/commands/Quality/CheckProbe"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeDeclarationIndexCache)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDeclarationIndexCache: Effect.Effect<DeclarationIndexCache, never, FileSystem.FileSystem | Path.Path> =
  Cache.make({ lookup: referencedDeclarationIndex, capacity: Number.MAX_SAFE_INTEGER });

/**
 * List the referenced projects of one package whose declaration index is
 * missing, without spawning a compiler.
 *
 * **Example** (Probe one package)
 *
 * ```ts
 * import { makeDeclarationIndexCache, missingReferenceOutputs } from "@beep/repo-cli/commands/Quality/CheckProbe"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(makeDeclarationIndexCache, (cache) =>
 *   missingReferenceOutputs("/repo", { name: "@beep/data", dir: "/repo/packages/foundation/primitive/data" }, cache)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param relativeTo - Directory each reported `declarationFile` is made relative to.
 * @param pkg - The package's name and absolute directory.
 * @param declarationIndexes - The run's declaration-index memo.
 * @returns One entry per reference whose `<outDir>/index.d.ts` does not exist, in reference order.
 * @category use-cases
 * @since 0.0.0
 */
export const missingReferenceOutputs = Effect.fn("CheckProbe.missingReferenceOutputs")(function* (
  relativeTo: string,
  pkg: { readonly name: string; readonly dir: string },
  declarationIndexes: DeclarationIndexCache
): Effect.fn.Return<ReadonlyArray<MissingReferenceOutput>, CheckProbeReadError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const references = yield* readTsconfigReferences(pkg.dir);

  return yield* Effect.forEach(
    references,
    Effect.fnUntraced(function* (reference) {
      const tsconfigPath = yield* referencedTsconfigPath(pkg.dir, reference.path);
      const declarationFile = yield* Cache.get(declarationIndexes, tsconfigPath);
      const exists = yield* fs.exists(declarationFile).pipe(Effect.orElseSucceed(thunkFalse));

      return exists
        ? A.empty<MissingReferenceOutput>()
        : A.of(
            MissingReferenceOutput.make({
              package: pkg.name,
              reference: reference.path,
              declarationFile: path.relative(relativeTo, declarationFile),
            })
          );
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
});

/**
 * The command that builds a package's upstream closure, as `package-verify`'s
 * `check:build-closure` step runs it.
 *
 * **Example** (Name the fix for one package)
 *
 * ```ts
 * import { packageBuildClosureCommand } from "@beep/repo-cli/commands/Quality/CheckProbe"
 *
 * console.log(packageBuildClosureCommand("@beep/data")) // "bun x turbo run build --filter=@beep/data^..."
 * ```
 *
 * @param packageName - Workspace package name.
 * @returns The shell command text.
 * @category utilities
 * @since 0.0.0
 */
export const packageBuildClosureCommand = (packageName: string): string =>
  `bun x turbo run build --filter=${packageName}^...`;

const readPackageName = Effect.fn("CheckProbe.readPackageName")(function* (
  packageDir: string
): Effect.fn.Return<string, CheckProbeReadError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(packageDir, "package.json");
  const manifest = yield* fs
    .readFileString(manifestPath)
    .pipe(
      Effect.flatMap(decodePackageManifestName),
      Effect.mapError(readFailure(`Failed to read the package name from ${manifestPath}.`))
    );

  return O.getOrElse(O.fromUndefinedOr(manifest.name), () => packageDir);
});

/**
 * Stop a package check before its compiler when a referenced project has no
 * declaration index, printing one line instead of one TS6305 per reference.
 *
 * **Details**
 *
 * The probe is filesystem-only. On a built tree it prints nothing and
 * succeeds. Otherwise it writes one line to stderr naming the missing count,
 * the first missing output (relative to the package) and the build-closure
 * command, then fails with {@link UnbuiltReferenceOutputs}, which the runtime
 * treats as already reported.
 *
 * **Example** (Guard a package check)
 *
 * ```ts
 * import { checkPackageReferencesBuilt } from "@beep/repo-cli/commands/Quality/CheckProbe"
 * import * as Effect from "effect/Effect"
 *
 * const program = checkPackageReferencesBuilt("/repo/packages/foundation/primitive/data")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param packageDir - Absolute package directory holding `package.json` and `tsconfig.json`.
 * @returns Succeeds on a built upstream; fails after printing its one line otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const checkPackageReferencesBuilt = Effect.fn("CheckProbe.checkPackageReferencesBuilt")(function* (
  packageDir: string
): Effect.fn.Return<void, CheckProbeReadError | UnbuiltReferenceOutputs, FileSystem.FileSystem | Path.Path> {
  const name = yield* readPackageName(packageDir);
  const declarationIndexes = yield* makeDeclarationIndexCache;
  const missing = yield* missingReferenceOutputs(packageDir, { name, dir: packageDir }, declarationIndexes);
  const first = A.head(missing);

  if (O.isSome(first)) {
    const buildCommand = packageBuildClosureCommand(name);
    const message = `[beep-cli] ${name} check: unbuilt upstream declarations: ${A.length(missing)} missing (first: ${first.value.declarationFile}); build them with: ${buildCommand}`;
    yield* Console.error(message);
    return yield* UnbuiltReferenceOutputs.make({
      message,
      package: name,
      missing: A.length(missing),
      firstOutput: first.value.declarationFile,
      buildCommand,
    });
  }
});
