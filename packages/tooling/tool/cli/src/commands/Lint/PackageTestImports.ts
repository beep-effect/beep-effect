/**
 * Package test import policy command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import { Node, Project, SyntaxKind } from "ts-morph";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";

const $I = $RepoCliId.create("commands/Lint/PackageTestImports");

class PackageSourceRoot extends S.Class<PackageSourceRoot>($I`PackageSourceRoot`)(
  {
    name: S.String,
    sourceRoot: S.String,
  },
  $I.annote("PackageSourceRoot", {
    description: "Represents the source root of a package, including its name and source root path.",
  })
) {}

class ModuleSpecifierUse extends S.Class<ModuleSpecifierUse>($I`ModuleSpecifierUse`)(
  {
    line: S.Finite,
    specifier: S.String,
  },
  $I.annote("ModuleSpecifierUse", {
    description:
      "Represents a module specifier use within a TypeScript file, including the line number and specifier string.",
  })
) {}

class PackageTestImportViolation extends S.Class<PackageTestImportViolation>($I`PackageTestImportViolation`)(
  {
    file: S.String,
    line: S.Finite,
    replacement: S.String,
    specifier: S.String,
  },
  $I.annote("PackageTestImportViolation", {
    description:
      "Represents a violation of the package test import policy, including the file, line number, replacement, and specifier.",
  })
) {}

class PackageNameDocument extends S.Class<PackageNameDocument>($I`PackageNameDocument`)(
  {
    name: S.String,
  },
  $I.annote("PackageNameDocument", {
    title: "Package Name Document",
    description: "Minimal package.json shape used to discover the owning package name for test import policy.",
  })
) {}

const decodePackageNameDocument = S.decodeUnknownEffect(S.fromJsonString(PackageNameDocument));
const moduleExtensionPattern = /\.(?:[cm]?[tj]sx?)$/;
const packageTestFilePattern = /^packages\/.+\/(?:test|dtslint)\/.+\.(?:ts|tsx)$/;
// Source-owned test helpers live under a package `src` tree, i.e. a `src`
// directory segment appears before the `test`/`dtslint` boundary (e.g.
// `packages/foo/src/internal/test/Example.test-kit.ts`). Package-level tests
// such as `packages/foo/test/src/Example.test.ts` keep `src` after the
// boundary and must stay in scope for import linting.
const packageSourceOwnedTestPattern = /\/src\/(?:.*\/)?(?:test|dtslint)\//;
const stripKnownModuleExtension = Str.replace(moduleExtensionPattern, Str.empty);
const bySourceRootLengthDescending = Order.mapInput(
  Order.Number,
  (sourceRoot: PackageSourceRoot) => -sourceRoot.sourceRoot.length
);

const exists = (fs: FileSystem.FileSystem, filePath: string): Effect.Effect<boolean> =>
  fs.exists(filePath).pipe(Effect.orElseSucceed(thunkFalse));

const isRelativeModuleSpecifier = (specifier: string): boolean =>
  Str.startsWith("./")(specifier) || Str.startsWith("../")(specifier);

const isPackageTestFilePath = (relativePath: string): boolean =>
  packageTestFilePattern.test(relativePath) && !packageSourceOwnedTestPattern.test(relativePath);

// Directory modules resolve as `@beep/pkg/Foo`, never `@beep/pkg/Foo/index` —
// dir-uniform wildcard exports (`./src/*` + `/index.ts`) cannot serve the
// `/index` spelling, so suggestions always strip the trailing segment.
const toRootImportAlias = (source: PackageSourceRoot, sourceSubpath: string): string => {
  const normalizedSubpath = Str.replace(/\/index$/u, Str.empty)(sourceSubpath);
  return normalizedSubpath === Str.empty || normalizedSubpath === "index"
    ? source.name
    : `${source.name}/${normalizedSubpath}`;
};

const isInsideSourceRoot = (sourceRoot: string, targetPath: string): boolean =>
  targetPath === sourceRoot || Str.startsWith(`${sourceRoot}/`)(targetPath);

const readOptionalPackageName = Effect.fn("PackageTestImports.readOptionalPackageName")(function* (
  packageJsonPath: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const packageJsonExists = yield* exists(fs, packageJsonPath);

  if (!packageJsonExists) {
    return O.none();
  }

  return yield* fs.readFileString(packageJsonPath).pipe(
    Effect.flatMap((content) => decodePackageNameDocument(content).pipe(Effect.option)),
    Effect.map(O.map((document) => document.name)),
    Effect.orElseSucceed(O.none)
  );
});

const collectPackageSourceRoots = Effect.fn("PackageTestImports.collectPackageSourceRoots")(function* (
  packagesRoot: string
): Effect.fn.Return<ReadonlyArray<PackageSourceRoot>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packagesRootExists = yield* exists(fs, packagesRoot);

  if (!packagesRootExists) {
    return A.empty<PackageSourceRoot>();
  }

  const walk = Effect.fn("PackageTestImports.collectPackageSourceRoots.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<PackageSourceRoot>, never, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs.stat(currentPath).pipe(Effect.option);

    if (O.isNone(stat) || stat.value.type !== "Directory") {
      return A.empty<PackageSourceRoot>();
    }

    const packageName = yield* readOptionalPackageName(path.join(currentPath, "package.json"));
    let roots = A.empty<PackageSourceRoot>();

    if (O.isSome(packageName) && Str.startsWith("@beep/")(packageName.value)) {
      roots = A.append(roots, {
        name: packageName.value,
        sourceRoot: normalizePath(path.resolve(currentPath, "src")),
      });
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));

    for (const entry of entries) {
      const childPath = path.join(currentPath, entry);
      const childStat = yield* fs.stat(childPath).pipe(Effect.option);

      if (O.isSome(childStat) && childStat.value.type === "Directory") {
        roots = A.appendAll(roots, yield* walk(childPath));
      }
    }

    return roots;
  });

  return pipe(yield* walk(packagesRoot), A.sort(bySourceRootLengthDescending));
});

const collectPackageTestFiles = Effect.fn("PackageTestImports.collectPackageTestFiles")(function* (
  packagesRoot: string,
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packagesRootExists = yield* exists(fs, packagesRoot);

  if (!packagesRootExists) {
    return A.empty<string>();
  }

  const walk = Effect.fn("PackageTestImports.collectPackageTestFiles.walk")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
    const stat = yield* fs.stat(currentPath).pipe(Effect.option);

    if (O.isNone(stat)) {
      return A.empty<string>();
    }

    if (stat.value.type === "File") {
      const relativePath = normalizePath(path.relative(repoRoot, currentPath));
      return isPackageTestFilePath(relativePath) ? A.of(normalizePath(path.resolve(currentPath))) : A.empty();
    }

    if (stat.value.type !== "Directory") {
      return A.empty<string>();
    }

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.orElseSucceed(A.empty<string>));
    let files = A.empty<string>();

    for (const entry of entries) {
      files = A.appendAll(files, yield* walk(path.join(currentPath, entry)));
    }

    return files;
  });

  return pipe(yield* walk(packagesRoot), A.sort(Order.String));
});

const collectModuleSpecifierUses = (
  project: Project,
  filePath: string,
  content: string
): ReadonlyArray<ModuleSpecifierUse> => {
  const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  let uses = A.empty<ModuleSpecifierUse>();

  for (const declaration of sourceFile.getImportDeclarations()) {
    const specifierNode = declaration.getModuleSpecifier();
    uses = A.append(uses, {
      line: specifierNode.getStartLineNumber(),
      specifier: specifierNode.getLiteralText(),
    });
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifierNode = declaration.getModuleSpecifier();

    if (specifierNode !== undefined) {
      uses = A.append(uses, {
        line: specifierNode.getStartLineNumber(),
        specifier: specifierNode.getLiteralText(),
      });
    }
  }

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node) || node.getExpression().getKind() !== SyntaxKind.ImportKeyword) {
      return;
    }

    const firstArg = pipe(node.getArguments(), A.head, O.getOrUndefined);

    if (firstArg !== undefined && Node.isStringLiteral(firstArg)) {
      uses = A.append(uses, {
        line: firstArg.getStartLineNumber(),
        specifier: firstArg.getLiteralText(),
      });
    }
  });

  return uses;
};

const resolveViolation = (
  path: Path.Path,
  sources: ReadonlyArray<PackageSourceRoot>,
  filePath: string,
  use: ModuleSpecifierUse
): O.Option<PackageTestImportViolation> => {
  if (!isRelativeModuleSpecifier(use.specifier)) {
    return O.none();
  }

  const targetPath = normalizePath(path.resolve(path.dirname(filePath), use.specifier));
  const source = A.findFirst(sources, (candidate) => isInsideSourceRoot(candidate.sourceRoot, targetPath));

  if (O.isNone(source)) {
    return O.none();
  }

  const sourceSubpath =
    targetPath === source.value.sourceRoot
      ? Str.empty
      : pipe(normalizePath(path.relative(source.value.sourceRoot, targetPath)), stripKnownModuleExtension);

  return O.some({
    file: filePath,
    line: use.line,
    replacement: toRootImportAlias(source.value, sourceSubpath),
    specifier: use.specifier,
  });
};

const runLintPackageTestImports = Effect.fn("PackageTestImports.runLintPackageTestImports")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = normalizePath(path.resolve(process.cwd()));
  const packagesRoot = path.join(repoRoot, "packages");
  const sources = yield* collectPackageSourceRoots(packagesRoot);
  const files = yield* collectPackageTestFiles(packagesRoot, repoRoot);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  let violations = A.empty<PackageTestImportViolation>();

  for (const file of files) {
    const content = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => Str.empty));
    const uses = collectModuleSpecifierUses(project, file, content);

    for (const use of uses) {
      const violation = resolveViolation(path, sources, file, use);

      if (O.isSome(violation)) {
        violations = A.append(violations, violation.value);
      }
    }
  }

  if (A.isReadonlyArrayNonEmpty(violations)) {
    yield* Console.error(
      "[check-package-test-imports] relative imports from package test/dtslint files into workspace src are not allowed. Use @beep/* package aliases."
    );

    for (const violation of violations) {
      const relativeFile = normalizePath(path.relative(repoRoot, violation.file));
      yield* Console.error(`${relativeFile}:${violation.line} ${violation.specifier} -> ${violation.replacement}`);
    }

    return yield* failWithReportedExit("check-package-test-imports: violations found.");
  }

  yield* Console.log("[check-package-test-imports] OK: package test/dtslint imports use package aliases.");
});

/**
 * Lint command for enforcing package aliases from package test and dtslint files.
 *
 * @example
 * ```ts
 * console.log("bun run beep lint package-test-imports")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const lintPackageTestImportsCommand = Command.make("package-test-imports", {}, runLintPackageTestImports).pipe(
  Command.withDescription("Check package test/dtslint files for relative imports into workspace src roots")
);
