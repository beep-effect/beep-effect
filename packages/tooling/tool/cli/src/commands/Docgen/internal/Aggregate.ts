/**
 * Generated documentation aggregation workflow for the Docgen group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, MutableHashSet, Order, Path, pipe } from "effect";
import * as P from "effect/Predicate";
import { generateDocsIndexContent } from "../Docgen.render.ts";
import { byDocsOutputPathAscending, DocgenAggregateResult } from "../Docgen.schemas.ts";
import {
  assertNoOrphanDocgenConfigPaths,
  discoverDocgenWorkspacePackages,
  resolveDocgenWorkspacePackage,
} from "./Workspace.ts";
import type { FsUtils, NoSuchFileError } from "@beep/repo-utils";
import type { DocgenWorkspacePackage } from "../Docgen.schemas.ts";

const expectedCanonicalDocgenPath = (
  path: Path.Path,
  sourceRoot: string,
  canonicalSourceRoot: string,
  candidate: string
): string => {
  const relativeFromSourceRoot = normalizePath(path.relative(sourceRoot, candidate));

  return relativeFromSourceRoot === "." || relativeFromSourceRoot === ""
    ? canonicalSourceRoot
    : path.join(canonicalSourceRoot, ...Str.split("/")(relativeFromSourceRoot));
};

const copyDocsTree: (
  sourceDir: string,
  destinationDir: string,
  packageName: string,
  sourceRoot: string,
  canonicalSourceRoot: string
) => Effect.Effect<number, DomainError, FileSystem.FileSystem | Path.Path> = Effect.fn("DocgenOperations.copyDocsTree")(
  function* (sourceDir, destinationDir, packageName, sourceRoot, canonicalSourceRoot) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    yield* fs
      .makeDirectory(destinationDir, { recursive: true })
      .pipe(Effect.mapError(DomainError.newCause(`Failed to create "${destinationDir}"`)));

    const entries = yield* fs
      .readDirectory(sourceDir)
      .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${sourceDir}"`)));

    let copiedFiles = 0;

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry);
      const destinationPath = path.join(destinationDir, entry);
      const canonicalSourcePath = yield* fs
        .realPath(sourcePath)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve "${sourcePath}"`)));

      if (canonicalSourcePath !== expectedCanonicalDocgenPath(path, sourceRoot, canonicalSourceRoot, sourcePath)) {
        continue;
      }

      const stat = yield* fs
        .stat(sourcePath)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to stat "${sourcePath}"`)));

      if (stat.type === "Directory") {
        copiedFiles += yield* copyDocsTree(sourcePath, destinationPath, packageName, sourceRoot, canonicalSourceRoot);
        continue;
      }

      const content = yield* fs
        .readFileString(sourcePath)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${sourcePath}"`)));
      const rewritten = Str.replace(/^parent: Modules$/m, `parent: "${packageName}"`)(content);
      yield* fs
        .writeFileString(destinationPath, rewritten)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to write "${destinationPath}"`)));
      copiedFiles += 1;
    }

    return copiedFiles;
  }
);

/**
 * Aggregate generated package docs into the root ignored `docs/generated` tree.
 *
 * **Example** (Aggregate selected package docs)
 *
 * ```ts
 * import { aggregateGeneratedDocs } from "@beep/repo-cli/commands/Docgen/internal/Aggregate"
 * import { Effect } from "effect"
 *
 * const program = aggregateGeneratedDocs({ package: "packages/tooling/tool/cli" })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param options - Optional package selector and clean flag.
 * @returns Aggregation result rows for every copied package.
 * @effects Reads package-local generated docs and writes the aggregate docs tree.
 * @category workflows
 * @since 0.0.0
 */
export const aggregateGeneratedDocs: (options?: {
  readonly clean?: boolean | undefined;
  readonly package?: string | undefined;
}) => Effect.Effect<
  ReadonlyArray<DocgenAggregateResult>,
  DomainError | NoSuchFileError,
  FileSystem.FileSystem | Path.Path | FsUtils
> = Effect.fn("DocgenOperations.aggregateGeneratedDocs")(function* (options?: {
  readonly clean?: boolean | undefined;
  readonly package?: string | undefined;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  yield* assertNoOrphanDocgenConfigPaths(repoRoot);

  const docsRoot = path.join(repoRoot, "docs", "generated");
  const selectedPackage = P.isUndefined(options?.package)
    ? undefined
    : yield* resolveDocgenWorkspacePackage(options.package, { rootDir: repoRoot });
  const packages = yield* pipe(
    O.fromUndefinedOr(selectedPackage),
    O.match({
      onNone: () => discoverDocgenWorkspacePackages(repoRoot).pipe(Effect.map(A.filter((pkg) => pkg.hasGeneratedDocs))),
      onSome: (pkg) => Effect.succeed(pkg.hasGeneratedDocs ? A.of(pkg) : A.empty<DocgenWorkspacePackage>()),
    })
  );

  if (selectedPackage !== undefined && A.isReadonlyArrayEmpty(packages)) {
    return yield* DomainError.make({
      message: `Package "${selectedPackage.name}" does not have generated docs. Run "bun run beep docgen generate -p ${selectedPackage.relativePath}" first.`,
    });
  }

  if (A.isReadonlyArrayEmpty(packages)) {
    return A.empty();
  }

  if (P.isUndefined(options?.package)) {
    const seen = MutableHashSet.empty<string>();
    const duplicates = MutableHashSet.empty<string>();

    for (const pkg of packages) {
      if (MutableHashSet.has(seen, pkg.docsOutputPath)) {
        MutableHashSet.add(duplicates, pkg.docsOutputPath);
        continue;
      }
      MutableHashSet.add(seen, pkg.docsOutputPath);
    }

    if (MutableHashSet.size(duplicates) > 0) {
      return yield* DomainError.make({
        message: `Duplicate docs output paths detected: ${pipe(
          A.fromIterable(duplicates),
          A.sort(Order.String),
          A.join(", ")
        )}`,
      });
    }
  }

  if (options?.clean === true) {
    if (selectedPackage !== undefined) {
      const destinationDir = path.join(docsRoot, selectedPackage.docsOutputPath);
      yield* fs
        .remove(destinationDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.mapError(DomainError.newCause(`Failed to remove "${destinationDir}"`)));
    } else {
      yield* fs
        .remove(docsRoot, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.mapError(DomainError.newCause(`Failed to remove "${docsRoot}"`)));
    }
  }

  yield* fs
    .makeDirectory(docsRoot, { recursive: true })
    .pipe(Effect.mapError(DomainError.newCause(`Failed to create "${docsRoot}"`)));

  const sortedPackages = A.sort(packages, byDocsOutputPathAscending);
  return yield* Effect.forEach(
    sortedPackages,
    Effect.fnUntraced(function* (pkg, index) {
      const generatedDocsModulesSegments = Str.split("/")(pkg.generatedDocsModulesPath);
      const sourceDir = path.join(pkg.absolutePath, ...generatedDocsModulesSegments);
      const destinationDir = path.join(docsRoot, pkg.docsOutputPath);
      const hasDocs = yield* fs.exists(sourceDir).pipe(Effect.orElseSucceed(thunkFalse));

      if (!hasDocs) {
        return yield* DomainError.make({
          message: `Package "${pkg.name}" does not have generated docs. Run "bun run beep docgen generate -p ${pkg.relativePath}" first.`,
        });
      }

      const canonicalPackageDir = yield* fs
        .realPath(pkg.absolutePath)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve "${pkg.absolutePath}"`)));
      const canonicalSourceDir = yield* fs
        .realPath(sourceDir)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve "${sourceDir}"`)));
      const expectedCanonicalSourceDir = path.join(canonicalPackageDir, ...generatedDocsModulesSegments);

      if (canonicalSourceDir !== expectedCanonicalSourceDir) {
        return yield* DomainError.make({
          message: `Refusing to aggregate docs for package "${pkg.name}" because "${sourceDir}" resolves outside its generated modules tree.`,
        });
      }

      yield* fs
        .remove(destinationDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.mapError(DomainError.newCause(`Failed to reset "${destinationDir}"`)));
      const fileCount = yield* copyDocsTree(sourceDir, destinationDir, pkg.name, sourceDir, canonicalSourceDir);
      yield* fs
        .writeFileString(
          path.join(destinationDir, "index.md"),
          generateDocsIndexContent(pkg.name, {
            order: index + 2,
            outputPath: pkg.docsOutputPath,
          })
        )
        .pipe(Effect.mapError(DomainError.newCause(`Failed to write docs index for "${pkg.name}"`)));

      return DocgenAggregateResult.make({
        packageName: pkg.name,
        packagePath: pkg.relativePath,
        docsOutputPath: pkg.docsOutputPath,
        fileCount,
      });
    }),
    { concurrency: 1 }
  );
});
