/**
 * Ecosystem package dependency-polarity lint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, readPackageJsonFile } from "@beep/repo-utils";
import { normalizePath, TaggedErrorClass } from "@beep/schema";
import { A, Str, Text, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { Node, Project, SyntaxKind } from "ts-morph";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";

const $I = $RepoCliId.create("commands/Lint/EcosystemPolarity");
const ECOSYSTEM_ROOT = "packages/ecosystem";
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

/**
 * Runtime options for the ecosystem-polarity lint.
 *
 * @category models
 * @since 0.0.0
 */
export class EcosystemPolarityOptions extends S.Class<EcosystemPolarityOptions>($I`EcosystemPolarityOptions`)(
  {
    includePaths: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("EcosystemPolarityOptions", {
    description: "Optional changed-file scope for the ecosystem dependency-polarity lint.",
  })
) {}

/**
 * A single ecosystem-polarity violation.
 *
 * @category models
 * @since 0.0.0
 */
export class EcosystemPolarityViolation extends S.Class<EcosystemPolarityViolation>($I`EcosystemPolarityViolation`)(
  {
    file: S.String,
    line: S.Finite,
    kind: S.Literals(["runtime-dependency", "bundled-dependencies", "source-import"] as const),
    detail: S.String,
  },
  $I.annote("EcosystemPolarityViolation", {
    description: "A forbidden repo-internal runtime edge in an ecosystem member.",
  })
) {}

/**
 * Summary returned by the ecosystem-polarity lint.
 *
 * @category models
 * @since 0.0.0
 */
export class EcosystemPolaritySummary extends S.Class<EcosystemPolaritySummary>($I`EcosystemPolaritySummary`)(
  {
    checkedMembers: S.Finite,
    scannedSourceFiles: S.Finite,
    violations: S.Array(EcosystemPolarityViolation),
  },
  $I.annote("EcosystemPolaritySummary", {
    description: "Members, source files, and violations observed by the ecosystem-polarity lint.",
  })
) {}

/**
 * Tagged filesystem or manifest failure raised while checking ecosystem polarity.
 *
 * @category errors
 * @since 0.0.0
 */
export class EcosystemPolarityError extends TaggedErrorClass<EcosystemPolarityError>($I`EcosystemPolarityError`)(
  "EcosystemPolarityError",
  { message: S.String },
  $I.annote("EcosystemPolarityError", {
    description: "An ecosystem package could not be discovered, read, or decoded for polarity linting.",
  })
) {
  static readonly new = (message: string): EcosystemPolarityError => EcosystemPolarityError.make({ message });
}

class EcosystemMember extends S.Class<EcosystemMember>($I`EcosystemMember`)(
  {
    name: S.String,
    root: S.String,
    manifestPath: S.String,
  },
  $I.annote("EcosystemMember", {
    description: "A directly nested package under packages/ecosystem.",
  })
) {}

const isSourceFile = (filePath: string): boolean =>
  A.some(SOURCE_EXTENSIONS, (extension) => Str.endsWith(extension)(filePath));

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

const collectSourceFiles: (
  root: string
) => Effect.Effect<ReadonlyArray<string>, EcosystemPolarityError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "EcosystemPolarity.collectSourceFiles"
)(function* (root) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootExists = yield* fs.exists(root).pipe(Effect.orElseSucceed(thunkFalse));

  if (!rootExists) {
    return A.empty<string>();
  }

  const stat = yield* fs
    .stat(root)
    .pipe(Effect.mapError(() => EcosystemPolarityError.new(`Failed to inspect ecosystem source path "${root}".`)));

  if (stat.type === "File") {
    return isSourceFile(root) ? A.of(root) : A.empty<string>();
  }

  if (stat.type !== "Directory") {
    return A.empty<string>();
  }

  const entries = yield* fs
    .readDirectory(root)
    .pipe(Effect.mapError(() => EcosystemPolarityError.new(`Failed to list ecosystem source directory "${root}".`)));
  let files = A.empty<string>();

  for (const entry of entries) {
    files = A.appendAll(files, yield* collectSourceFiles(path.join(root, entry)));
  }

  return A.sort(files, Order.String);
});

const literalSpecifier = (node: Node): O.Option<string> =>
  Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node) ? O.some(node.getLiteralText()) : O.none();

const collectSourceViolations = (
  project: Project,
  relativeFilePath: string,
  content: string
): ReadonlyArray<EcosystemPolarityViolation> => {
  const sourceFile = project.createSourceFile(relativeFilePath, content, { overwrite: true });
  let violations = A.empty<EcosystemPolarityViolation>();
  const appendSpecifier = (specifier: string, line: number): void => {
    if (Str.startsWith("@beep/")(specifier)) {
      violations = A.append(
        violations,
        EcosystemPolarityViolation.make({
          file: relativeFilePath,
          line,
          kind: "source-import",
          detail: specifier,
        })
      );
    }
  };

  for (const declaration of sourceFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifier();
    appendSpecifier(specifier.getLiteralText(), specifier.getStartLineNumber());
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifier();
    if (specifier !== undefined) {
      appendSpecifier(specifier.getLiteralText(), specifier.getStartLineNumber());
    }
  }

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) {
      return;
    }

    const expression = node.getExpression();
    const isDynamicImport = expression.getKind() === SyntaxKind.ImportKeyword;
    const isRequire = Node.isIdentifier(expression) && Str.equivalence(expression.getText(), "require");
    if (!isDynamicImport && !isRequire) {
      return;
    }

    pipe(
      node.getArguments(),
      A.head,
      O.flatMap(literalSpecifier),
      O.map((specifier) => appendSpecifier(specifier, node.getStartLineNumber()))
    );
  });

  return violations;
};

const runtimeDependencyViolations = (
  relativeManifestPath: string,
  field: string,
  dependencies: O.Option<Readonly<Record<string, string>>>
): ReadonlyArray<EcosystemPolarityViolation> =>
  pipe(
    dependencies,
    O.map((entries) =>
      pipe(
        R.keys(entries),
        A.filter(Str.startsWith("@beep/")),
        A.map((dependency) =>
          EcosystemPolarityViolation.make({
            file: relativeManifestPath,
            line: 1,
            kind: "runtime-dependency",
            detail: `${field}.${dependency}`,
          })
        )
      )
    ),
    O.getOrElse(A.empty<EcosystemPolarityViolation>)
  );

const bundledFieldViolations = (
  relativeManifestPath: string,
  fields: ReadonlyArray<readonly [field: string, value: O.Option<unknown>]>
): ReadonlyArray<EcosystemPolarityViolation> =>
  pipe(
    fields,
    A.filter(([, value]) => O.isSome(value)),
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
 * @category use-cases
 * @since 0.0.0
 */
export const runEcosystemPolarityCheck = Effect.fn("EcosystemPolarity.runEcosystemPolarityCheck")(function* (
  options: EcosystemPolarityOptions
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
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
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  let scannedSourceFiles = 0;
  let violations = A.empty<EcosystemPolarityViolation>();

  for (const member of members) {
    violations = A.appendAll(violations, yield* manifestViolations(member, repoRoot));
    const sourceFiles = yield* collectSourceFiles(path.join(member.root, "src"));
    scannedSourceFiles += A.length(sourceFiles);

    for (const sourceFile of sourceFiles) {
      const content = yield* fs
        .readFileString(sourceFile)
        .pipe(Effect.mapError(() => EcosystemPolarityError.new(`Failed to read ecosystem source "${sourceFile}".`)));
      const relativeFilePath = normalizePath(path.relative(repoRoot, sourceFile));
      violations = A.appendAll(violations, collectSourceViolations(project, relativeFilePath, content));
    }
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
 * @category cli-commands
 * @since 0.0.0
 */
export const lintEcosystemPolarityCommand = Command.make(
  "ecosystem-polarity",
  {
    include: Flag.string("include").pipe(
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
