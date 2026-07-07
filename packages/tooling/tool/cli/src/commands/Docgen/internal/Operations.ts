/**
 * Human-first docgen operations shared by `beep docgen` and `beep docs aggregate`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError, decodePackageJsonEffect, FsUtils, findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import {
  buildDocgenAliasSource,
  CanonicalDocgenConfigInput,
  collectDocgenWorkspaceDependencyNames,
  createCanonicalDocgenConfig,
  toCanonicalDocgenConfigJson,
} from "@beep/repo-utils/schemas/DocgenConfig";
import { normalizeJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories";
import { LiteralKit, normalizePath, SchemaUtils } from "@beep/schema";
import { A, Str, thunk0, thunkEmptyStr, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import {
  DateTime,
  Effect,
  FileSystem,
  flow,
  HashMap,
  Match,
  MutableHashSet,
  Order,
  Path,
  pipe,
  Result,
  Stream,
} from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import * as jsonc from "jsonc-parser";
import { Node, Project, SyntaxKind } from "ts-morph";
import type { NoSuchFileError } from "@beep/repo-utils";
import type { DocgenAliasSource } from "@beep/repo-utils/schemas/DocgenConfig";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { ExportDeclaration, JSDoc, SourceFile } from "ts-morph";

const $I = $RepoCliId.create("commands/Docgen/internal/Operations");

const DOCGEN_CONFIG_FILENAME = "docgen.json" as const;
const DOCS_MODULES_SEGMENTS = ["docs", "modules"] as const;
const DOCGEN_REQUIRED_TAGS = ["@category", "@example", "@since"] as const;
const DOCGEN_CONFIG_SCAN_GLOBS = ["apps/**/docgen.json", "packages/**/docgen.json", "infra/docgen.json"] as const;
const DOCGEN_CONFIG_SCAN_IGNORES = [
  "**/.git/**",
  "**/.turbo/**",
  "**/build/**",
  "**/coverage/**",
  "**/dist/**",
  "**/docs/**",
  "**/node_modules/**",
] as const;

class ResolveDocgenWorkspacePackageOptions extends S.Class<ResolveDocgenWorkspacePackageOptions>(
  $I`ResolveDocgenWorkspacePackageOptions`
)(
  {
    rootDir: S.optionalKey(S.String),
  },
  $I.annote("ResolveDocgenWorkspacePackageOptions", {
    description: "Resolved workspace package options for docgen",
  })
) {}

const isResolveDocgenWorkspacePackageDataFirst = (args: IArguments): boolean =>
  (args.length === 1 && P.isString(args[0])) || args.length === 2;

const parseJsonText = S.decodeUnknownEffect(S.UnknownFromJsonString);
const byRelativePathAscending: Order.Order<DocgenWorkspacePackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenWorkspacePackage) => pkg.relativePath
);
const byDocsOutputPathAscending: Order.Order<DocgenWorkspacePackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenWorkspacePackage) => pkg.docsOutputPath
);
const byIssueAscending: Order.Order<DocgenExportAnalysis> = Order.mapInput(
  Order.String,
  (analysis: DocgenExportAnalysis) =>
    `${Match.value(analysis.priority).pipe(
      Match.when("high", () => "0"),
      Match.when("medium", () => "1"),
      Match.orElse(() => "2")
    )}:${analysis.filePath}:${analysis.line}:${analysis.name}`
);

/**
 * Workspace docgen status derived from config and generated output presence.
 *
 * @example
 * ```ts
 * import { DocgenPackageStatus } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * console.log(DocgenPackageStatus.is["configured-and-generated"]("configured-and-generated"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenPackageStatus = LiteralKit([
  "configured-and-generated",
  "configured-not-generated",
  "not-configured",
]).pipe(
  $I.annoteSchema("DocgenPackageStatus", {
    description: "Workspace docgen status derived from config and generated output presence.",
  })
);
/**
 * Workspace docgen status derived from config and generated output presence.
 *
 * @example
 * ```ts
 * import type { DocgenPackageStatus } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const status: DocgenPackageStatus = "configured-not-generated"
 * console.log(status)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenPackageStatus = typeof DocgenPackageStatus.Type;

const DocgenJsonObject = S.Json.pipe(
  $I.annoteSchema("DocgenJsonObject", {
    description: "Generic JSON object payload used for docgen compiler option blocks.",
  })
);

/**
 * Parsed `docgen.json` document used by the command suite.
 *
 * @example
 * ```ts
 * import { DocgenConfigDocument } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const config = DocgenConfigDocument.make({
 *   srcDir: "src",
 *   outDir: "docs",
 *   include: ["src/index.ts"]
 * })
 * console.log(config.srcDir)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenConfigDocument extends S.Class<DocgenConfigDocument>($I`DocgenConfigDocument`)(
  {
    $schema: S.optionalKey(S.String),
    projectHomepage: S.optionalKey(S.String),
    srcLink: S.optionalKey(S.String),
    srcDir: S.String.pipe(SchemaUtils.withKeyDefaults("src")),
    outDir: S.optionalKey(S.String),
    theme: S.optionalKey(S.String),
    enableSearch: S.optionalKey(S.Boolean),
    enforceDescriptions: S.optionalKey(S.Boolean),
    enforceExamples: S.optionalKey(S.Boolean),
    enforceVersion: S.optionalKey(S.Boolean),
    tscExecutable: S.optionalKey(S.String),
    runExamples: S.optionalKey(S.Boolean),
    include: S.String.pipe(S.Array, S.optionalKey),
    exclude: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    parseCompilerOptions: S.optionalKey(S.Union([S.String, DocgenJsonObject])),
    examplesCompilerOptions: S.optionalKey(S.Union([S.String, DocgenJsonObject])),
  },
  $I.annote("DocgenConfigDocument", {
    description: "Parsed docgen.json document used by the command suite.",
  })
) {}

/**
 * Workspace package metadata used by docgen commands.
 *
 * @example
 * ```ts
 * import { DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const pkg = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 * console.log(pkg.docsOutputPath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenWorkspacePackage extends S.Class<DocgenWorkspacePackage>($I`DocgenWorkspacePackage`)(
  {
    name: S.String,
    relativePath: S.String,
    absolutePath: S.String,
    docsOutputPath: S.String,
    hasDocgenConfig: S.Boolean,
    hasGeneratedDocs: S.Boolean,
    status: DocgenPackageStatus,
  },
  $I.annote("DocgenWorkspacePackage", {
    description: "Workspace package metadata used by docgen commands.",
  })
) {}

/**
 * Issue priority used by analysis findings.
 *
 * @example
 * ```ts
 * import { DocgenIssuePriority } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * console.log(DocgenIssuePriority.is.high("high"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenIssuePriority = LiteralKit(["high", "medium", "low"]).pipe(
  $I.annoteSchema("DocgenIssuePriority", {
    description: "Issue priority used by analysis findings.",
  })
);
/**
 * Issue priority used by analysis findings.
 *
 * @example
 * ```ts
 * import type { DocgenIssuePriority } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const priority: DocgenIssuePriority = "medium"
 * console.log(priority)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenIssuePriority = typeof DocgenIssuePriority.Type;

/**
 * Export kind surfaced by analysis.
 *
 * @example
 * ```ts
 * import { DocgenExportKind } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * console.log(DocgenExportKind.is["module-fileoverview"]("module-fileoverview"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocgenExportKind = LiteralKit([
  "function",
  "const",
  "type",
  "interface",
  "class",
  "namespace",
  "enum",
  "re-export",
  "module-fileoverview",
]).pipe(
  $I.annoteSchema("DocgenExportKind", {
    description: "Export kind surfaced by analysis.",
  })
);
/**
 * Export kind surfaced by analysis.
 *
 * @example
 * ```ts
 * import type { DocgenExportKind } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const kind: DocgenExportKind = "class"
 * console.log(kind)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocgenExportKind = typeof DocgenExportKind.Type;

/**
 * Analysis finding for a single export or module-level doc requirement.
 *
 * @example
 * ```ts
 * import { DocgenExportAnalysis } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const finding = DocgenExportAnalysis.make({
 *   name: "docgenCommand",
 *   kind: "const",
 *   filePath: "src/commands/Docgen/Docgen.command.ts",
 *   line: 1172,
 *   presentTags: ["@category", "@example", "@since"],
 *   missingTags: [],
 *   categoryValues: ["cli-commands"],
 *   categoryIssues: [],
 *   hasJsDoc: true,
 *   priority: "low",
 *   declarationSource: "export const docgenCommand = Command.make(...)"
 * })
 * console.log(finding.priority)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenExportAnalysis extends S.Class<DocgenExportAnalysis>($I`DocgenExportAnalysis`)(
  {
    name: S.String,
    kind: DocgenExportKind,
    filePath: S.String,
    line: S.Finite,
    presentTags: S.Array(S.String),
    missingTags: S.Array(S.String),
    categoryValues: S.Array(S.String),
    categoryIssues: S.Array(S.String),
    hasJsDoc: S.Boolean,
    context: S.optionalKey(S.String),
    priority: DocgenIssuePriority,
    declarationSource: S.String,
  },
  $I.annote("DocgenExportAnalysis", {
    description: "Analysis finding for a single export or module-level doc requirement.",
  })
) {}

/**
 * Summary counts for a package analysis run.
 *
 * @example
 * ```ts
 * import { DocgenAnalysisSummary } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const summary = DocgenAnalysisSummary.make({
 *   totalExports: 12,
 *   fullyDocumented: 10,
 *   missingDocumentation: 2,
 *   missingCategory: 0,
 *   invalidCategory: 0,
 *   missingExample: 2,
 *   missingSince: 0
 * })
 * console.log(summary.missingDocumentation)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenAnalysisSummary extends S.Class<DocgenAnalysisSummary>($I`DocgenAnalysisSummary`)(
  {
    totalExports: S.Finite,
    fullyDocumented: S.Finite,
    missingDocumentation: S.Finite,
    missingCategory: S.Finite,
    invalidCategory: S.Finite,
    missingExample: S.Finite,
    missingSince: S.Finite,
  },
  $I.annote("DocgenAnalysisSummary", {
    description: "Summary counts for a package analysis run.",
  })
) {}

/**
 * Package-level analysis document written by `docgen analyze`.
 *
 * @example
 * ```ts
 * import {
 *   DocgenAnalysisSummary,
 *   DocgenPackageAnalysis
 * } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const analysis = DocgenPackageAnalysis.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   timestamp: "2026-05-12T00:00:00.000Z",
 *   exports: [],
 *   summary: DocgenAnalysisSummary.make({
 *     totalExports: 0,
 *     fullyDocumented: 0,
 *     missingDocumentation: 0,
 *     missingCategory: 0,
 *     invalidCategory: 0,
 *     missingExample: 0,
 *     missingSince: 0
 *   })
 * })
 * console.log(analysis.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenPackageAnalysis extends S.Class<DocgenPackageAnalysis>($I`DocgenPackageAnalysis`)(
  {
    packageName: S.String,
    packagePath: S.String,
    timestamp: S.String,
    exports: S.Array(DocgenExportAnalysis),
    summary: DocgenAnalysisSummary,
  },
  $I.annote("DocgenPackageAnalysis", {
    description: "Package-level analysis document written by docgen analyze.",
  })
) {}

/**
 * Per-package docgen generation result.
 *
 * @example
 * ```ts
 * import { DocgenGenerationResult } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const result = DocgenGenerationResult.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   success: true,
 *   moduleCount: 42
 * })
 * console.log(result.moduleCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenGenerationResult extends S.Class<DocgenGenerationResult>($I`DocgenGenerationResult`)(
  {
    packageName: S.String,
    packagePath: S.String,
    success: S.Boolean,
    moduleCount: S.optionalKey(S.Finite),
    error: S.optionalKey(S.String),
    output: S.optionalKey(S.String),
  },
  $I.annote("DocgenGenerationResult", {
    description: "Per-package docgen generation result.",
  })
) {}

type RunDocgenForPackageOptions = {
  readonly include?: ReadonlyArray<string>;
};

const isDocgenWorkspacePackage = S.is(DocgenWorkspacePackage);

const isRunDocgenForPackageDataFirst = (args: IArguments): boolean =>
  (args.length === 1 && isDocgenWorkspacePackage(args[0])) || args.length === 2;

/**
 * Per-package aggregated docs result.
 *
 * @example
 * ```ts
 * import { DocgenAggregateResult } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const result = DocgenAggregateResult.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   fileCount: 18
 * })
 * console.log(result.fileCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenAggregateResult extends S.Class<DocgenAggregateResult>($I`DocgenAggregateResult`)(
  {
    packageName: S.String,
    packagePath: S.String,
    docsOutputPath: S.String,
    fileCount: S.Finite,
  },
  $I.annote("DocgenAggregateResult", {
    description: "Per-package aggregated docs result.",
  })
) {}

const decodeDocgenConfigDocument = S.decodeUnknownEffect(DocgenConfigDocument);

const normalizeSlashes = Str.replace(/\\/g, "/");

const stringFromUnknown = (value: unknown): string => {
  if (P.isString(value)) {
    return value;
  }
  if (P.isError(value)) {
    return value.message;
  }
  return `${value}`;
};

const encodeJsonResult = S.encodeUnknownResult(S.UnknownFromJsonString);
const jsonText = (value: unknown): string => {
  const encoded = Result.getOrThrow(encodeJsonResult(value));
  const edits = jsonc.format(encoded, undefined, {
    tabSize: 2,
    insertSpaces: true,
  });
  return `${jsonc.applyEdits(encoded, edits)}\n`;
};

const readUnknownJsonFile = Effect.fn("DocgenOperations.readUnknownJsonFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${filePath}"`)));
  const parsed = yield* parseJsonText(content).pipe(
    Effect.mapError(DomainError.newCause(`Invalid JSON in "${filePath}"`))
  );
  return parsed;
});

const readPackageJson = Effect.fn("DocgenOperations.readPackageJson")(function* (absolutePackagePath: string) {
  const path = yield* Path.Path;
  const packageJsonPath = path.join(absolutePackagePath, "package.json");
  const parsed = yield* readUnknownJsonFile(packageJsonPath);
  return yield* decodePackageJsonEffect(parsed).pipe(
    Effect.mapError(DomainError.newCause(`Invalid package.json at "${packageJsonPath}"`))
  );
});

const loadWorkspaceDocgenAliasSources = Effect.fn("DocgenOperations.loadWorkspaceDocgenAliasSources")(function* (
  rootDir: string
) {
  const path = yield* Path.Path;
  const workspaceDirs = yield* resolveWorkspaceDirs(rootDir);
  const aliasSources = A.empty<DocgenAliasSource>();

  for (const [packageName, absolutePath] of workspaceDirs) {
    const packageJson = yield* readPackageJson(absolutePath);
    A.appendInPlace(
      aliasSources,
      buildDocgenAliasSource(packageName, normalizeSlashes(path.relative(rootDir, absolutePath)), packageJson)
    );
  }

  return aliasSources;
});

const formatOrphanDocgenConfigMessage = (paths: ReadonlyArray<string>): string =>
  `Found docgen.json file(s) outside current workspaces: ${A.join(paths, ", ")}. Remove stale package dirs or add them back to root workspaces before running docgen.`;

/**
 * Discover package-local docgen configs that do not belong to a current workspace.
 *
 * @param rootDir - Optional repo root override.
 * @returns Repo-relative orphaned `docgen.json` paths sorted for stable diagnostics.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { discoverOrphanDocgenConfigPaths } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 *
 * const program = discoverOrphanDocgenConfigPaths().pipe(
 *   Effect.map((paths) => paths.length)
 * )
 *
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const discoverOrphanDocgenConfigPaths: (
  rootDir?: string
) => Effect.Effect<ReadonlyArray<string>, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils> =
  Effect.fn("DocgenOperations.discoverOrphanDocgenConfigPaths")(function* (rootDir?: string) {
    const fs = yield* FileSystem.FileSystem;
    const fsUtils = yield* FsUtils;
    const path = yield* Path.Path;
    const repoRoot = rootDir ?? (yield* findRepoRoot());
    const workspaceDirs = yield* resolveWorkspaceDirs(repoRoot);
    const canonicalWorkspaceDirs = MutableHashSet.empty<string>();

    for (const [, absolutePath] of workspaceDirs) {
      MutableHashSet.add(canonicalWorkspaceDirs, normalizeSlashes(absolutePath));
    }

    const configPaths = yield* fsUtils.globFiles(DOCGEN_CONFIG_SCAN_GLOBS, {
      cwd: repoRoot,
      absolute: true,
      ignore: DOCGEN_CONFIG_SCAN_IGNORES,
    });
    const orphanedPaths = A.empty<string>();

    for (const configPath of configPaths) {
      const configDir = path.dirname(configPath);
      const canonicalConfigDir = yield* fs
        .realPath(configDir)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve docgen config directory "${configDir}"`)));

      if (MutableHashSet.has(canonicalWorkspaceDirs, normalizeSlashes(canonicalConfigDir))) {
        continue;
      }

      A.appendInPlace(orphanedPaths, normalizeSlashes(path.relative(repoRoot, configPath)));
    }

    return A.sort(orphanedPaths, Order.String);
  });

/**
 * Fail when stale package-local docgen configs exist outside current workspaces.
 *
 * @param rootDir - Optional repo root override.
 * @returns Void when every discovered `docgen.json` belongs to a current workspace.
 * @example
 * ```ts
 * import { assertNoOrphanDocgenConfigPaths } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 *
 * const program = assertNoOrphanDocgenConfigPaths()
 *
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const assertNoOrphanDocgenConfigPaths: (
  rootDir?: string
) => Effect.Effect<void, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils> = Effect.fn(
  "DocgenOperations.assertNoOrphanDocgenConfigPaths"
)(function* (rootDir?: string) {
  const orphanedPaths = yield* discoverOrphanDocgenConfigPaths(rootDir);

  if (A.isReadonlyArrayNonEmpty(orphanedPaths)) {
    return yield* DomainError.make({
      message: formatOrphanDocgenConfigMessage(orphanedPaths),
    });
  }
});

const packageHasDocgenConfig = Effect.fn("DocgenOperations.packageHasDocgenConfig")(function* (
  absolutePackagePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .exists(path.join(absolutePackagePath, DOCGEN_CONFIG_FILENAME))
    .pipe(Effect.orElseSucceed(thunkFalse));
});

const packageHasGeneratedDocs = Effect.fn("DocgenOperations.packageHasGeneratedDocs")(function* (
  absolutePackagePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .exists(path.join(absolutePackagePath, ...DOCS_MODULES_SEGMENTS))
    .pipe(Effect.orElseSucceed(thunkFalse));
});

const computePackageStatus = (hasDocgenConfig: boolean, hasGeneratedDocs: boolean): DocgenPackageStatus => {
  if (hasDocgenConfig && hasGeneratedDocs) {
    return "configured-and-generated";
  }
  if (hasDocgenConfig) {
    return "configured-not-generated";
  }
  return "not-configured";
};

const relativePathWithinPackage = (absolutePackagePath: string, absoluteFilePath: string, path: Path.Path): string =>
  normalizeSlashes(path.relative(absolutePackagePath, absoluteFilePath));

const getJsDocs = (node: Node): ReadonlyArray<JSDoc> => {
  if (Node.isJSDocable(node)) {
    return node.getJsDocs();
  }

  if (Node.isVariableDeclaration(node)) {
    const statement = node.getVariableStatement();
    if (statement !== undefined) {
      return statement.getJsDocs();
    }
  }

  return A.empty();
};

const getOwningJsDocs = (node: Node): ReadonlyArray<JSDoc> => pipe(getJsDocs(node), A.last, O.toArray);

const extractJsDocTags = flow(
  getOwningJsDocs,
  A.flatMap((doc) => A.map(doc.getTags(), (tag) => `@${tag.getTagName()}`))
);

const extractJsDocCategoryValues = flow(
  getOwningJsDocs,
  A.flatMap((doc) =>
    A.flatMap(doc.getTags(), (tag) =>
      tag.getTagName() === "category" ? [Str.trim(tag.getCommentText() ?? "")] : A.empty<string>()
    )
  )
);

const getLeadingJsDocCommentText = (node: ExportDeclaration): O.Option<string> =>
  pipe(
    node.getLeadingCommentRanges(),
    A.filter((range) => Str.startsWith("/**")(range.getText())),
    A.last,
    O.map((range) => range.getText())
  );

const extractJsDocTagsFromText = flow(
  Str.matchAll(/@([A-Za-z][\w-]*)/g),
  A.fromIterable,
  A.flatMap((match) => (match[1] === undefined ? A.empty<string>() : [`@${match[1]}`]))
);

const extractJsDocCategoryValuesFromText = flow(
  Str.split(/\r?\n/),
  A.flatMap((line) => {
    const match = /@category(?:\s+([^*]+?))?\s*(?:\*\/)?\s*$/.exec(line);

    return match === null ? A.empty<string>() : [Str.trim(match[1] ?? "")];
  })
);

const extractContext = flow(
  getOwningJsDocs,
  A.head,
  O.flatMap((doc) => O.fromNullishOr(doc.getDescription())),
  O.map((description) => Str.trim(description)),
  O.filter((description) => description.length > 0),
  O.map((description) => {
    const [firstLine] = Str.split("\n")(description);
    return firstLine === undefined ? description : firstLine;
  }),
  O.getOrUndefined
);

const hasJsDocComment = (node: Node): boolean => getOwningJsDocs(node).length > 0;

type DocgenRequiredTag = (typeof DOCGEN_REQUIRED_TAGS)[number];

const resolveRequiredTags = (config: DocgenConfigDocument): ReadonlyArray<DocgenRequiredTag> => {
  const tags = A.empty<DocgenRequiredTag>();

  A.appendInPlace(tags, "@category");

  if (config.enforceExamples === true) {
    A.appendInPlace(tags, "@example");
  }

  if (config.enforceVersion !== false) {
    A.appendInPlace(tags, "@since");
  }

  return tags;
};

const missingRequiredTags = (
  presentTags: ReadonlyArray<string>,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): ReadonlyArray<DocgenRequiredTag> => A.filter(requiredTags, (tag) => !A.contains(presentTags, tag));

const categoryIssueMessages: (categoryValues: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.map(normalizeJSDocCategory),
  A.filter((category) => category.status === "rejected" || category.status === "unknown"),
  A.map((category) => category.message ?? `Invalid @category value ${category.original}.`)
);

const extractLeadingCommentTags = (node: Node): ReadonlyArray<string> =>
  pipe(
    node.getLeadingCommentRanges(),
    A.flatMap((range) => extractJsDocTagsFromText(range.getText()))
  );

const extractLeadingCommentCategoryValues = (node: Node): ReadonlyArray<string> =>
  pipe(
    node.getLeadingCommentRanges(),
    A.flatMap((range) => extractJsDocCategoryValuesFromText(range.getText()))
  );

const collectExportSpecifierTags = (sourceFile: SourceFile): HashMap.HashMap<string, ReadonlyArray<string>> => {
  let index = HashMap.empty<string, ReadonlyArray<string>>();

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration)) {
    for (const specifier of declaration.getNamedExports()) {
      const exportName = specifier.getAliasNode()?.getText() ?? specifier.getName();
      const tags = pipe(
        [...extractLeadingCommentTags(specifier), ...extractJsDocTagsFromText(specifier.getText())],
        A.dedupe
      );

      if (A.isReadonlyArrayNonEmpty(tags)) {
        index = HashMap.set(index, exportName, tags);
      }
    }
  }

  return index;
};

const collectExportSpecifierCategoryValues = (
  sourceFile: SourceFile
): HashMap.HashMap<string, ReadonlyArray<string>> => {
  let index = HashMap.empty<string, ReadonlyArray<string>>();

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration)) {
    for (const specifier of declaration.getNamedExports()) {
      const exportName = specifier.getAliasNode()?.getText() ?? specifier.getName();
      const categoryValues = pipe(
        [...extractLeadingCommentCategoryValues(specifier), ...extractJsDocCategoryValuesFromText(specifier.getText())],
        A.dedupe
      );

      if (A.isReadonlyArrayNonEmpty(categoryValues)) {
        index = HashMap.set(index, exportName, categoryValues);
      }
    }
  }

  return index;
};

const isStaticMemberAssignmentExportDeclaration = (node: Node): boolean =>
  Node.isIdentifier(node) && Node.isPropertyAccessExpression(node.getParent());

const getExportKind = (node: Node): DocgenExportKind => {
  if (Node.isFunctionDeclaration(node)) return "function";
  if (Node.isVariableDeclaration(node)) return "const";
  if (Node.isTypeAliasDeclaration(node)) return "type";
  if (Node.isInterfaceDeclaration(node)) return "interface";
  if (Node.isClassDeclaration(node)) return "class";
  if (Node.isModuleDeclaration(node)) return "namespace";
  if (Node.isEnumDeclaration(node)) return "enum";
  return "const";
};

const computePriority = (
  hasJsDoc: boolean,
  missingTags: ReadonlyArray<string>,
  categoryIssues: ReadonlyArray<string>
): DocgenIssuePriority => {
  const issueCount = missingTags.length + categoryIssues.length;

  if (!hasJsDoc || issueCount >= 3) {
    return "high";
  }
  if (issueCount > 0) {
    return "medium";
  }
  return "low";
};

const hasAnalysisIssue = (analysis: DocgenExportAnalysis): boolean =>
  analysis.missingTags.length > 0 || analysis.categoryIssues.length > 0;

const makeExportAnalysis = (options: {
  readonly name: string;
  readonly kind: DocgenExportKind;
  readonly filePath: string;
  readonly line: number;
  readonly presentTags: ReadonlyArray<string>;
  readonly missingTags: ReadonlyArray<string>;
  readonly categoryValues: ReadonlyArray<string>;
  readonly categoryIssues: ReadonlyArray<string>;
  readonly hasJsDoc: boolean;
  readonly declarationSource: string;
  readonly context?: string | undefined;
}): DocgenExportAnalysis =>
  DocgenExportAnalysis.make({
    name: options.name,
    kind: options.kind,
    filePath: options.filePath,
    line: options.line,
    presentTags: [...options.presentTags],
    missingTags: [...options.missingTags],
    categoryValues: [...options.categoryValues],
    categoryIssues: [...options.categoryIssues],
    hasJsDoc: options.hasJsDoc,
    priority: computePriority(options.hasJsDoc, options.missingTags, options.categoryIssues),
    declarationSource: options.declarationSource,
    ...O.getSomesStruct({ context: O.fromUndefinedOr(options.context) }),
  });

const analyzeExport = (
  name: string,
  node: Node,
  filePath: string,
  requiredTags: ReadonlyArray<DocgenRequiredTag>,
  inheritedTags: ReadonlyArray<string>,
  inheritedCategoryValues: ReadonlyArray<string>
): DocgenExportAnalysis => {
  const presentTags = pipe([...extractJsDocTags(node), ...inheritedTags], A.dedupe);
  const categoryValues = pipe([...extractJsDocCategoryValues(node), ...inheritedCategoryValues], A.dedupe);
  const missingTags = missingRequiredTags(presentTags, requiredTags);
  const categoryIssues = categoryIssueMessages(categoryValues);

  return makeExportAnalysis({
    name,
    kind: getExportKind(node),
    filePath,
    line: node.getStartLineNumber(),
    presentTags,
    missingTags,
    categoryValues,
    categoryIssues,
    hasJsDoc: hasJsDocComment(node) || A.isReadonlyArrayNonEmpty(inheritedTags),
    declarationSource: node.getText(),
    context: extractContext(node),
  });
};

const analyzeModuleFileoverview = (
  sourceFile: SourceFile,
  relativeFilePath: string,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): O.Option<DocgenExportAnalysis> => {
  const match = /^(?:#![^\n]*\n)?\s*(\/\*\*[\s\S]*?\*\/)/.exec(sourceFile.getFullText());

  if (match === null) {
    if (!A.contains(requiredTags, "@since")) {
      return O.none();
    }

    return O.some(
      makeExportAnalysis({
        name: "<module fileoverview>",
        kind: "module-fileoverview",
        filePath: relativeFilePath,
        line: 1,
        presentTags: A.empty(),
        missingTags: ["@since"],
        categoryValues: A.empty(),
        categoryIssues: A.empty(),
        hasJsDoc: false,
        declarationSource: "",
        context: "Module fileoverview JSDoc is missing.",
      })
    );
  }

  const commentText = match[1] ?? "";
  const presentTags = pipe(
    ["@file", "@fileoverview", "@module", "@category", "@example"],
    A.filter((tag) => Str.includes(tag)(commentText))
  );
  const categoryValues = extractJsDocCategoryValuesFromText(commentText);
  const categoryIssues = categoryIssueMessages(categoryValues);
  const missingTags =
    /@since\b/.test(commentText) || !A.contains(requiredTags, "@since") ? A.empty<DocgenRequiredTag>() : ["@since"];

  if (missingTags.length === 0 && categoryIssues.length === 0) {
    return O.none();
  }

  const hasMissingTags = A.isReadonlyArrayNonEmpty(missingTags);
  const hasCategoryIssues = A.isReadonlyArrayNonEmpty(categoryIssues);
  const context = pipe(
    [
      pipe(
        hasMissingTags && hasCategoryIssues,
        O.liftPredicate(P.isTruthy),
        O.as("Module fileoverview is missing @since and has invalid @category metadata.")
      ),
      pipe(hasMissingTags, O.liftPredicate(P.isTruthy), O.as("Module fileoverview is missing @since.")),
    ] satisfies ReadonlyArray<O.Option<string>>,
    O.firstSomeOf,
    O.getOrElse(() => "Module fileoverview has invalid @category metadata.")
  );

  return O.some(
    makeExportAnalysis({
      name: "<module fileoverview>",
      kind: "module-fileoverview",
      filePath: relativeFilePath,
      line: 1,
      presentTags,
      missingTags,
      categoryValues,
      categoryIssues,
      hasJsDoc: true,
      declarationSource: commentText,
      context,
    })
  );
};

const analyzeReExports = (
  sourceFile: SourceFile,
  relativeFilePath: string,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): ReadonlyArray<DocgenExportAnalysis> =>
  pipe(
    sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration),
    A.map((declaration: ExportDeclaration) => {
      const jsDocTags = pipe(
        getJsDocs(declaration),
        A.flatMap((doc) => A.map(doc.getTags(), (tag) => `@${tag.getTagName()}`))
      );
      const leadingTags = pipe(
        getLeadingJsDocCommentText(declaration),
        O.map(extractJsDocTagsFromText),
        O.getOrElse(A.empty<string>)
      );
      const declarationTextTags = extractJsDocTagsFromText(declaration.getText());
      const presentTags = pipe([...jsDocTags, ...leadingTags, ...declarationTextTags], A.dedupe);
      const categoryValues = pipe(
        [
          ...extractJsDocCategoryValues(declaration),
          ...pipe(
            getLeadingJsDocCommentText(declaration),
            O.map(extractJsDocCategoryValuesFromText),
            O.getOrElse(A.empty<string>)
          ),
          ...extractJsDocCategoryValuesFromText(declaration.getText()),
        ],
        A.dedupe
      );
      const missingTags = missingRequiredTags(presentTags, requiredTags);
      const categoryIssues = categoryIssueMessages(categoryValues);

      return makeExportAnalysis({
        name: declaration.getText(),
        kind: "re-export",
        filePath: relativeFilePath,
        line: declaration.getStartLineNumber(),
        presentTags,
        missingTags,
        categoryValues,
        categoryIssues,
        hasJsDoc: presentTags.length > 0,
        declarationSource: declaration.getText(),
        context: `Re-export from ${declaration.getModuleSpecifierValue() ?? "<unknown>"} needs documentation.`,
      });
    }),
    A.filter(hasAnalysisIssue)
  );

const sourceFileMatchesExclude = (
  absolutePackagePath: string,
  srcDir: string,
  sourceFilePath: string,
  pattern: string
): boolean => {
  const normalizedPattern = normalizeSlashes(Str.replace(/^\.\//, "")(pattern));
  const packageRelative = Str.replace(
    `${normalizeSlashes(absolutePackagePath)}/`,
    ""
  )(normalizeSlashes(sourceFilePath));
  const srcRelative = Str.startsWith(`${srcDir}/`)(packageRelative)
    ? Str.slice(srcDir.length + 1)(packageRelative)
    : packageRelative;
  const patternRegex = globPatternToRegExp(normalizedPattern);

  return A.some([packageRelative, srcRelative], (candidate) => patternRegex.test(candidate));
};

const escapeRegexChar = (char: string): string => Str.replace(/[.+?^${}()|[\]\\]/g, "\\$&")(char);

const globPatternToRegExp = (pattern: string): RegExp => {
  let source = "^";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    const next = pattern[index + 1];
    const afterNext = pattern[index + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 3;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      index += 1;
      continue;
    }

    source += escapeRegexChar(char ?? "");
    index += 1;
  }

  return new RegExp(`${source}$`);
};

const getSourceFiles = (
  project: Project,
  absolutePackagePath: string,
  srcDir: string,
  exclude: ReadonlyArray<string>
): ReadonlyArray<SourceFile> => {
  const baseDir = normalizeSlashes(`${absolutePackagePath}/${srcDir}`);
  project.addSourceFilesAtPaths(`${baseDir}/**/*.ts`);
  project.addSourceFilesAtPaths(`${baseDir}/**/*.tsx`);

  return pipe(
    project.getSourceFiles(),
    A.filter((sourceFile) => !Str.endsWith(".d.ts")(sourceFile.getFilePath())),
    A.filter(
      (sourceFile) =>
        !A.some(exclude, (pattern) =>
          sourceFileMatchesExclude(absolutePackagePath, srcDir, sourceFile.getFilePath(), pattern)
        )
    )
  );
};

const analyzeSourceFile = (
  sourceFile: SourceFile,
  absolutePackagePath: string,
  path: Path.Path,
  requiredTags: ReadonlyArray<DocgenRequiredTag>
): ReadonlyArray<DocgenExportAnalysis> => {
  const relativeFilePath = relativePathWithinPackage(absolutePackagePath, sourceFile.getFilePath(), path);
  const reExports = analyzeReExports(sourceFile, relativeFilePath, requiredTags);
  const exportSpecifierTags = collectExportSpecifierTags(sourceFile);
  const exportSpecifierCategoryValues = collectExportSpecifierCategoryValues(sourceFile);
  const directExports = pipe(
    A.fromIterable(sourceFile.getExportedDeclarations().entries()),
    A.flatMap(([name, declarations]) => {
      const localDeclarations = pipe(
        declarations,
        A.filter((declaration) => declaration.getSourceFile() === sourceFile),
        A.filter((declaration) => !isStaticMemberAssignmentExportDeclaration(declaration))
      );
      const declarationGroupTags = pipe(localDeclarations, A.flatMap(extractJsDocTags), A.dedupe);
      const declarationGroupCategoryValues = pipe(localDeclarations, A.flatMap(extractJsDocCategoryValues), A.dedupe);
      const specifierTags = O.getOrElse(HashMap.get(exportSpecifierTags, name), A.empty<string>);
      const specifierCategoryValues = O.getOrElse(HashMap.get(exportSpecifierCategoryValues, name), A.empty<string>);

      return A.map(localDeclarations, (declaration) =>
        analyzeExport(
          name,
          declaration,
          relativeFilePath,
          requiredTags,
          [...declarationGroupTags, ...specifierTags],
          [...declarationGroupCategoryValues, ...specifierCategoryValues]
        )
      );
    })
  );

  if (reExports.length === 0 && directExports.length === 0) {
    return A.empty();
  }

  const moduleFileoverview = analyzeModuleFileoverview(sourceFile, relativeFilePath, requiredTags);

  return pipe(O.toArray(moduleFileoverview), A.appendAll(reExports), A.appendAll(directExports));
};

const computeAnalysisSummary = (analyses: ReadonlyArray<DocgenExportAnalysis>): DocgenAnalysisSummary =>
  DocgenAnalysisSummary.make({
    totalExports: analyses.length,
    fullyDocumented: A.filter(analyses, (analysis) => !hasAnalysisIssue(analysis)).length,
    missingDocumentation: A.filter(analyses, hasAnalysisIssue).length,
    missingCategory: A.filter(analyses, (analysis) => A.contains(analysis.missingTags, "@category")).length,
    invalidCategory: A.filter(analyses, (analysis) => A.isReadonlyArrayNonEmpty(analysis.categoryIssues)).length,
    missingExample: A.filter(analyses, (analysis) => A.contains(analysis.missingTags, "@example")).length,
    missingSince: A.filter(analyses, (analysis) => A.contains(analysis.missingTags, "@since")).length,
  });

const formatChecklistItem = (analysis: DocgenExportAnalysis): string =>
  A.join(
    [
      `- [ ] \`${analysis.filePath}:${analysis.line}\` - **${analysis.name}** (${analysis.kind})`,
      `  - Missing: ${A.join(analysis.missingTags, ", ") || "none"}`,
      ...(analysis.categoryIssues.length === 0
        ? A.empty()
        : [`  - Category issues: ${A.join(analysis.categoryIssues, "; ")}`]),
      ...(analysis.presentTags.length === 0 ? A.empty() : [`  - Has: ${A.join(analysis.presentTags, ", ")}`]),
      ...(analysis.context === undefined ? A.empty() : [`  - Context: ${analysis.context}`]),
    ],
    "\n"
  );

const generateDocsIndexContent = (packageName: string, outputPath: string, order: number): string => `---
title: "${packageName}"
has_children: true
permalink: /docs/${normalizeSlashes(outputPath)}
nav_order: ${order}
---
`;

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
 * Normalize a workspace-relative package path to the current generated docs output layout.
 *
 * @param relativePath - Workspace-relative package path.
 * @returns Current nested docs output path with the top-level workspace root trimmed.
 * @example
 * ```ts
 * import { normalizeDocsOutputPath } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const outputPath = normalizeDocsOutputPath("packages/tooling/tool/cli")
 * console.log(outputPath)
 * ```
 * @category normalization
 * @since 0.0.0
 */
export const normalizeDocsOutputPath = (relativePath: string): string =>
  Str.replace(/^(packages|tooling|apps)\//, "")(normalizeSlashes(relativePath));

/**
 * Load a package-local `docgen.json` document.
 *
 * @param absolutePackagePath - Absolute package path containing the `docgen.json` file to decode.
 * @returns Parsed current-schema docgen configuration.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { loadDocgenConfigDocument } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const program = loadDocgenConfigDocument("/repo/packages/tooling/tool/cli")
 * console.log(Effect.isEffect(program))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const loadDocgenConfigDocument: (
  absolutePackagePath: string
) => Effect.Effect<DocgenConfigDocument, DomainError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocgenOperations.loadDocgenConfigDocument"
)(function* (absolutePackagePath) {
  const path = yield* Path.Path;
  const configPath = path.join(absolutePackagePath, DOCGEN_CONFIG_FILENAME);
  const parsed = yield* readUnknownJsonFile(configPath);
  return yield* decodeDocgenConfigDocument(parsed).pipe(
    Effect.mapError(DomainError.newCauseMessage(`Invalid JSON shape in "${configPath}"`))
  );
});

/**
 * Build the repo-standard `docgen.json` document for a package.
 *
 * @param targetPackage - Target workspace package.
 * @param rootDir - Absolute repo root.
 * @returns Bootstrapped docgen config using current repo defaults plus dependency-aware paths.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   DocgenWorkspacePackage,
 *   createDocgenConfigDocument
 * } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const target = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 * const program = createDocgenConfigDocument(target, "/repo")
 * console.log(Effect.isEffect(program))
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const createDocgenConfigDocument: {
  (
    targetPackage: DocgenWorkspacePackage,
    rootDir: string
  ): Effect.Effect<DocgenConfigDocument, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils>;
  (
    rootDir: string
  ): (
    targetPackage: DocgenWorkspacePackage
  ) => Effect.Effect<DocgenConfigDocument, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils>;
} = dual(
  2,
  Effect.fn("DocgenOperations.createDocgenConfigDocument")(function* (targetPackage, rootDir) {
    const packageJson = yield* readPackageJson(targetPackage.absolutePath);
    const workspaceAliasSources = yield* loadWorkspaceDocgenAliasSources(rootDir);
    const canonicalConfig = yield* createCanonicalDocgenConfig(
      CanonicalDocgenConfigInput.make({
        rootDir,
        packageAbsolutePath: targetPackage.absolutePath,
        packageRelativePath: targetPackage.relativePath,
        packageName: targetPackage.name,
        directWorkspaceDependencies: [...collectDocgenWorkspaceDependencyNames(packageJson)],
        workspaceAliasSources,
      })
    );
    const canonicalConfigJson = toCanonicalDocgenConfigJson(canonicalConfig);

    return DocgenConfigDocument.make({
      srcDir: "src",
      outDir: "docs",
      ...canonicalConfigJson,
    });
  })
);

/**
 * Discover all workspace packages relevant to docgen.
 *
 * @param rootDir - Optional repo root override.
 * @returns Sorted workspace package descriptors with current docgen status.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { discoverDocgenWorkspacePackages } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const program = discoverDocgenWorkspacePackages().pipe(
 *   Effect.map((packages) => packages.map((pkg) => pkg.relativePath))
 * )
 * console.log(Effect.isEffect(program))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const discoverDocgenWorkspacePackages: (
  rootDir?: string
) => Effect.Effect<
  ReadonlyArray<DocgenWorkspacePackage>,
  DomainError | NoSuchFileError,
  FileSystem.FileSystem | Path.Path | FsUtils
> = Effect.fn("DocgenOperations.discoverDocgenWorkspacePackages")(function* (rootDir?: string) {
  const path = yield* Path.Path;
  const repoRoot = rootDir ?? (yield* findRepoRoot());
  const workspaceDirs = yield* resolveWorkspaceDirs(repoRoot);
  const packages = yield* Effect.forEach(
    HashMap.toEntries(workspaceDirs),
    Effect.fnUntraced(function* ([name, absolutePath]) {
      const relativePath = normalizeSlashes(path.relative(repoRoot, absolutePath));
      const hasDocgenConfig = yield* packageHasDocgenConfig(absolutePath);
      const hasGeneratedDocs = yield* packageHasGeneratedDocs(absolutePath);

      return DocgenWorkspacePackage.make({
        name,
        relativePath,
        absolutePath,
        docsOutputPath: normalizeDocsOutputPath(relativePath),
        hasDocgenConfig,
        hasGeneratedDocs,
        status: computePackageStatus(hasDocgenConfig, hasGeneratedDocs),
      });
    }),
    { concurrency: "unbounded" }
  );

  return A.sort(packages, byRelativePathAscending);
});

/**
 * Resolve a workspace package by package name, repo-relative path, absolute path, or current docs output path.
 *
 * @param selector - Package selector supplied by the CLI.
 * @param options - Optional repo root override.
 * @returns Resolved workspace package descriptor.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { resolveDocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const program = resolveDocgenWorkspacePackage("@beep/repo-cli").pipe(
 *   Effect.map((pkg) => pkg.docsOutputPath)
 * )
 * console.log(Effect.isEffect(program))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const resolveDocgenWorkspacePackage: {
  (
    selector: string,
    options?: ResolveDocgenWorkspacePackageOptions
  ): Effect.Effect<DocgenWorkspacePackage, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils>;
  (
    options: ResolveDocgenWorkspacePackageOptions
  ): (
    selector: string
  ) => Effect.Effect<
    DocgenWorkspacePackage,
    DomainError | NoSuchFileError,
    FileSystem.FileSystem | Path.Path | FsUtils
  >;
} = dual(
  isResolveDocgenWorkspacePackageDataFirst,
  Effect.fn("DocgenOperations.resolveDocgenWorkspacePackage")(function* (
    selector: string,
    options?: ResolveDocgenWorkspacePackageOptions
  ) {
    const path = yield* Path.Path;
    const repoRoot = options?.rootDir ?? (yield* findRepoRoot());
    const normalizedSelector = normalizeSlashes(selector);
    const absoluteSelector = path.isAbsolute(selector) ? path.normalize(selector) : path.resolve(repoRoot, selector);
    const packages = yield* discoverDocgenWorkspacePackages(repoRoot);
    const match = A.findFirst(
      packages,
      (pkg) =>
        pkg.name === normalizedSelector ||
        pkg.relativePath === normalizedSelector ||
        pkg.docsOutputPath === normalizedSelector ||
        path.normalize(pkg.absolutePath) === absoluteSelector
    );

    return yield* O.match(match, {
      onNone: () =>
        DomainError.make({
          message: `Could not resolve workspace package "${selector}". Use a package name like "@beep/schema" or a repo-relative path like "packages/foundation/modeling/schema".`,
        }),
      onSome: Effect.succeed,
    });
  })
);

/**
 * Analyze a package for missing docgen-required JSDoc.
 *
 * @param targetPackage - Target workspace package.
 * @returns Package analysis document grounded in the current repo package layout.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   DocgenWorkspacePackage,
 *   analyzePackageDocumentation
 * } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const target = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 * const program = analyzePackageDocumentation(target).pipe(
 *   Effect.map((analysis) => analysis.summary.missingDocumentation)
 * )
 * console.log(Effect.isEffect(program))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const analyzePackageDocumentation: (
  targetPackage: DocgenWorkspacePackage
) => Effect.Effect<DocgenPackageAnalysis, DomainError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocgenOperations.analyzePackageDocumentation"
)(function* (targetPackage) {
  const path = yield* Path.Path;
  const config = targetPackage.hasDocgenConfig
    ? yield* loadDocgenConfigDocument(targetPackage.absolutePath)
    : DocgenConfigDocument.make({
        srcDir: "src",
        exclude: A.empty(),
      });
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const srcDir = config.srcDir;
  const exclude = config.exclude;
  const requiredTags = resolveRequiredTags(config);
  const analyses = pipe(
    getSourceFiles(project, targetPackage.absolutePath, srcDir, exclude),
    A.flatMap((sourceFile) => analyzeSourceFile(sourceFile, targetPackage.absolutePath, path, requiredTags)),
    A.sort(byIssueAscending)
  );
  const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

  return DocgenPackageAnalysis.make({
    packageName: targetPackage.name,
    packagePath: targetPackage.relativePath,
    timestamp,
    exports: analyses,
    summary: computeAnalysisSummary(analyses),
  });
});

/**
 * Render a human-first markdown report for a package analysis run.
 *
 * @param analysis - Package analysis document.
 * @param fixMode - Whether to emit checklist-focused output.
 * @returns Human-first markdown report content.
 * @example
 * ```ts
 * import {
 *   DocgenAnalysisSummary,
 *   DocgenPackageAnalysis,
 *   generateAnalysisReport
 * } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const analysis = DocgenPackageAnalysis.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   timestamp: "2026-05-12T00:00:00.000Z",
 *   exports: [],
 *   summary: DocgenAnalysisSummary.make({
 *     totalExports: 0,
 *     fullyDocumented: 0,
 *     missingDocumentation: 0,
 *     missingCategory: 0,
 *     invalidCategory: 0,
 *     missingExample: 0,
 *     missingSince: 0
 *   })
 * })
 * const report = generateAnalysisReport(analysis, true)
 * console.log(report.includes("Fix Checklist"))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const generateAnalysisReport: {
  (analysis: DocgenPackageAnalysis, fixMode: boolean): string;
  (fixMode: boolean): (analysis: DocgenPackageAnalysis) => string;
} = dual(2, (analysis: DocgenPackageAnalysis, fixMode: boolean): string => {
  const issues = A.filter(analysis.exports, hasAnalysisIssue);
  const high = A.filter(issues, (entry) => entry.priority === "high");
  const medium = A.filter(issues, (entry) => entry.priority === "medium");
  const low = A.filter(issues, (entry) => entry.priority === "low");
  const sections = A.empty<string>();

  A.appendInPlace(sections, `# JSDoc Analysis Report: ${analysis.packageName}`);
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, `> **Generated**: ${analysis.timestamp}`);
  A.appendInPlace(sections, `> **Package**: ${analysis.packagePath}`);
  A.appendInPlace(sections, `> **Status**: ${analysis.summary.missingDocumentation} export(s) need documentation`);
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "## What To Fix");
  A.appendInPlace(sections, "");
  A.appendInPlace(
    sections,
    "Public exports should include the repo-required JSDoc tags and canonical category values:"
  );
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "1. `@category`");
  A.appendInPlace(sections, "2. `@example`");
  A.appendInPlace(sections, "3. `@since`");
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "Re-run the analysis after edits:");
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "```bash");
  A.appendInPlace(sections, `bun run beep docgen analyze -p ${analysis.packagePath}`);
  A.appendInPlace(sections, "```");
  A.appendInPlace(sections, "");

  if (fixMode) {
    A.appendInPlace(sections, "## Fix Checklist");
    A.appendInPlace(sections, "");

    if (A.isReadonlyArrayEmpty(issues)) {
      A.appendInPlace(sections, "All public exports are fully documented.");
      A.appendInPlace(sections, "");
    } else {
      if (A.isReadonlyArrayNonEmpty(high)) {
        A.appendInPlace(sections, "### High Priority");
        A.appendInPlace(sections, "");
        for (const entry of high) {
          A.appendInPlace(sections, formatChecklistItem(entry));
          A.appendInPlace(sections, "");
        }
      }

      if (A.isReadonlyArrayNonEmpty(medium)) {
        A.appendInPlace(sections, "### Medium Priority");
        A.appendInPlace(sections, "");
        for (const entry of medium) {
          A.appendInPlace(sections, formatChecklistItem(entry));
          A.appendInPlace(sections, "");
        }
      }

      if (A.isReadonlyArrayNonEmpty(low)) {
        A.appendInPlace(sections, "### Low Priority");
        A.appendInPlace(sections, "");
        for (const entry of low) {
          A.appendInPlace(sections, formatChecklistItem(entry));
          A.appendInPlace(sections, "");
        }
      }
    }
  } else {
    A.appendInPlace(sections, "## Findings");
    A.appendInPlace(sections, "");

    if (A.isReadonlyArrayEmpty(issues)) {
      A.appendInPlace(sections, "All public exports are fully documented.");
      A.appendInPlace(sections, "");
    } else {
      for (const entry of issues) {
        A.appendInPlace(sections, `### ${entry.name}`);
        A.appendInPlace(sections, "");
        A.appendInPlace(sections, `- Location: \`${entry.filePath}:${entry.line}\``);
        A.appendInPlace(sections, `- Kind: ${entry.kind}`);
        A.appendInPlace(sections, `- Missing: ${A.join(entry.missingTags, ", ")}`);
        if (entry.categoryIssues.length > 0) {
          A.appendInPlace(sections, `- Category issues: ${A.join(entry.categoryIssues, "; ")}`);
        }
        if (entry.presentTags.length > 0) {
          A.appendInPlace(sections, `- Present: ${A.join(entry.presentTags, ", ")}`);
        }
        if (P.isNotUndefined(entry.context)) {
          A.appendInPlace(sections, `- Context: ${entry.context}`);
        }
        A.appendInPlace(sections, "");
      }
    }
  }

  A.appendInPlace(sections, "## Summary");
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "| Metric | Count |");
  A.appendInPlace(sections, "|--------|-------|");
  A.appendInPlace(sections, `| Total Exports | ${analysis.summary.totalExports} |`);
  A.appendInPlace(sections, `| Fully Documented | ${analysis.summary.fullyDocumented} |`);
  A.appendInPlace(sections, `| Missing Documentation | ${analysis.summary.missingDocumentation} |`);
  A.appendInPlace(sections, `| Missing @category | ${analysis.summary.missingCategory} |`);
  A.appendInPlace(sections, `| Invalid @category | ${analysis.summary.invalidCategory} |`);
  A.appendInPlace(sections, `| Missing @example | ${analysis.summary.missingExample} |`);
  A.appendInPlace(sections, `| Missing @since | ${analysis.summary.missingSince} |`);
  A.appendInPlace(sections, "");

  return A.join(sections, "\n");
});

/**
 * Encode a package analysis document as JSON text.
 *
 * @param analysis - Package analysis document.
 * @returns JSON representation suitable for writing to disk or stdout.
 * @example
 * ```ts
 * import {
 *   DocgenAnalysisSummary,
 *   DocgenPackageAnalysis,
 *   generateAnalysisJson
 * } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const analysis = DocgenPackageAnalysis.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   timestamp: "2026-05-12T00:00:00.000Z",
 *   exports: [],
 *   summary: DocgenAnalysisSummary.make({
 *     totalExports: 0,
 *     fullyDocumented: 0,
 *     missingDocumentation: 0,
 *     missingCategory: 0,
 *     invalidCategory: 0,
 *     missingExample: 0,
 *     missingSince: 0
 *   })
 * })
 * const json = generateAnalysisJson(analysis)
 * console.log(json.includes("\"packageName\": \"@beep/repo-cli\""))
 * ```
 * @category serialization
 * @since 0.0.0
 */
export const generateAnalysisJson = (analysis: DocgenPackageAnalysis): string => jsonText(analysis);

/**
 * Aggregate generated package docs into the root `docs/generated/` layout.
 *
 * @param options - Aggregate configuration for the docs copy step, including the clean flag and optional package selector.
 * @returns Per-package aggregation results using the current nested layout.
 * @remarks
 * Aggregation rejects generated docs whose resolved source directory escapes
 * the package-local `docs/modules` tree.
 * @effects
 * Reads package-local generated docs and writes the selected aggregate tree under `docs/generated/`.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { aggregateGeneratedDocs } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * const program = aggregateGeneratedDocs({
 *   package: "packages/tooling/tool/cli",
 *   clean: false
 * }).pipe(Effect.map((results) => results.length))
 * console.log(Effect.isEffect(program))
 * ```
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
      const sourceDir = path.join(pkg.absolutePath, ...DOCS_MODULES_SEGMENTS);
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
      const expectedCanonicalSourceDir = path.join(canonicalPackageDir, ...DOCS_MODULES_SEGMENTS);

      if (canonicalSourceDir !== expectedCanonicalSourceDir) {
        return yield* DomainError.make({
          message: `Refusing to aggregate docs for package "${pkg.name}" because "${sourceDir}" resolves outside the package docs/modules tree.`,
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
          generateDocsIndexContent(pkg.name, pkg.docsOutputPath, index + 2)
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

const runDocgenForPackageEffect = Effect.fn("DocgenOperations.runDocgenForPackage")(
  function* (targetPackage: DocgenWorkspacePackage, options?: RunDocgenForPackageOptions) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repoRoot = yield* findRepoRoot(targetPackage.absolutePath);
    const docgenEntrypoint = path.join(repoRoot, "packages", "tooling", "tool", "docgen", "src", "bin.ts");
    const include = options?.include ?? A.empty<string>();
    const args: ReadonlyArray<string> = [
      "run",
      docgenEntrypoint,
      ...(A.isReadonlyArrayEmpty(include) ? A.empty<string>() : ["--include", A.join(include, ",")]),
    ];
    const command = ChildProcess.make("bun", [...args], {
      cwd: targetPackage.absolutePath,
      stdout: "pipe",
      stderr: "pipe",
    });
    const result = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* command;
        const output = yield* handle.all.pipe(
          Stream.decodeText(),
          Stream.runFold(thunkEmptyStr, (acc: string, chunk) => `${acc}${chunk}`)
        );
        const exitCode = yield* handle.exitCode;
        return {
          output: Str.trim(output),
          exitCode,
        };
      })
    ).pipe(
      Effect.result,
      Effect.map(
        Result.match({
          onFailure: (cause) => ({
            output: pipe(cause, stringFromUnknown, Str.trim),
            exitCode: 1,
          }),
          onSuccess: (value) => value,
        })
      )
    );

    if (result.exitCode !== 0) {
      return DocgenGenerationResult.make({
        packageName: targetPackage.name,
        packagePath: targetPackage.relativePath,
        success: false,
        error: `docgen exited with code ${result.exitCode}`,
        ...(Str.isEmpty(result.output) ? {} : { output: result.output }),
      });
    }

    const docsModulesDir = path.join(targetPackage.absolutePath, ...DOCS_MODULES_SEGMENTS);
    const moduleCount = yield* fs.exists(docsModulesDir).pipe(
      Effect.orElseSucceed(thunkFalse),
      Effect.flatMap(
        Effect.fnUntraced(function* (exists) {
          return yield* exists
            ? fs
                .readDirectory(docsModulesDir)
                .pipe(Effect.map(flow(A.filter(Str.endsWith(".md")), A.length)), Effect.orElseSucceed(thunk0))
            : Effect.succeed(0);
        })
      )
    );

    return DocgenGenerationResult.make({
      packageName: targetPackage.name,
      packagePath: targetPackage.relativePath,
      success: true,
      moduleCount,
      ...(result.output.length === 0 ? {} : { output: result.output }),
    });
  },
  (effect, targetPackage) =>
    effect.pipe(
      Effect.result,
      Effect.map(
        Result.match({
          onFailure: (cause) =>
            DocgenGenerationResult.make({
              packageName: targetPackage.name,
              packagePath: targetPackage.relativePath,
              success: false,
              error: "docgen execution failed before completion",
              output: pipe(cause, stringFromUnknown, Str.trim),
            }),
          onSuccess: (result) => result,
        })
      )
    )
);

/**
 * Runs the repo-local `@beep/repo-docgen` implementation for one workspace package.
 *
 * @param targetPackage - Workspace package to run through docgen.
 * @param options - Optional focused include globs forwarded to repo-docgen.
 * @returns Generation result including command output and module count.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   DocgenWorkspacePackage,
 *   runDocgenForPackage,
 * } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 *
 * const target = DocgenWorkspacePackage.make({
 *   name: "@beep/example",
 *   relativePath: "packages/example",
 *   absolutePath: "/repo/packages/example",
 *   docsOutputPath: "docs/generated/example",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: false,
 *   status: "configured-not-generated",
 * })
 *
 * const effect = runDocgenForPackage(target, { include: ["src/index.ts"] })
 * console.log(Effect.isEffect(effect))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runDocgenForPackage: {
  (
    targetPackage: DocgenWorkspacePackage,
    options?: RunDocgenForPackageOptions
  ): Effect.Effect<
    DocgenGenerationResult,
    DocgenGenerationResult,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner
  >;
  (
    options: RunDocgenForPackageOptions
  ): (
    targetPackage: DocgenWorkspacePackage
  ) => Effect.Effect<
    DocgenGenerationResult,
    DocgenGenerationResult,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner
  >;
} = dual(isRunDocgenForPackageDataFirst, runDocgenForPackageEffect);
