import { fileURLToPath } from "node:url";
import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Err, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, MutableHashMap, MutableHashSet, Order, Path, Result, SchemaGetter, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { Node } from "ts-morph";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Quality/internal/QualityArtifactSupport");

type QualityArtifactGeneratorErrorOptions = {
  readonly command?: undefined | string;
  readonly exitCode?: undefined | number;
  readonly filePath?: undefined | string;
};

/**
 * Error raised while building or checking Quality command generated artifacts.
 *
 * @category errors
 * @since 0.0.0
 */
export class QualityArtifactGeneratorError extends TaggedErrorClass<QualityArtifactGeneratorError>(
  $I`QualityArtifactGeneratorError`
)(
  "QualityArtifactGeneratorError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    filePath: S.optionalKey(S.String),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("QualityArtifactGeneratorError", {
    description: "Typed failure raised by repo quality artifact generators.",
  })
) {
  /**
   * Construct or map a quality artifact generator error.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string, opts: QualityArtifactGeneratorErrorOptions): QualityArtifactGeneratorError;
    (message: string, opts: QualityArtifactGeneratorErrorOptions): (cause: unknown) => QualityArtifactGeneratorError;
  } = dual(
    3,
    (
      cause,
      message,
      { command, exitCode, filePath }: QualityArtifactGeneratorErrorOptions
    ): QualityArtifactGeneratorError =>
      QualityArtifactGeneratorError.make({
        cause,
        message,
        ...R.getSomes({ command: O.fromUndefinedOr(command) }),
        ...R.getSomes({ exitCode: O.fromUndefinedOr(exitCode) }),
        ...R.getSomes({ filePath: O.fromUndefinedOr(filePath) }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * JSON-compatible object record used at JSONC boundaries.
 *
 * @category models
 * @since 0.0.0
 */
export const JsonRecord = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("JsonRecord", {
    description: "Generic JSONC object decoded by repo quality artifact generators.",
  })
);

/**
 * Runtime type for JSON-compatible object records.
 *
 * @category models
 * @since 0.0.0
 */
export type JsonRecord = typeof JsonRecord.Type;

/**
 * Package manifest fields consumed by Quality artifact generators.
 *
 * @category models
 * @since 0.0.0
 */
export class PackageJson extends S.Class<PackageJson>($I`PackageJson`)(
  {
    name: S.String,
    scripts: S.optionalKey(S.Record(S.String, S.String)),
    workspaces: S.optionalKey(S.Unknown),
    exports: S.optionalKey(S.Unknown),
  },
  $I.annote("PackageJson", {
    description: "Package manifest fields used by repo CLI support scripts.",
  })
) {}

/**
 * Workspace package metadata discovered from root workspace patterns.
 *
 * @category models
 * @since 0.0.0
 */
export class WorkspacePackageInfo extends S.Class<WorkspacePackageInfo>($I`WorkspacePackageInfo`)(
  {
    name: S.String,
    path: S.String,
    absolutePath: S.String,
    packageJson: PackageJson,
  },
  $I.annote("WorkspacePackageInfo", {
    description: "Discovered workspace package metadata used by repo CLI support scripts.",
  })
) {}

const decodePackageJsonResult = S.decodeUnknownResult(PackageJson);
const decodeJsoncRecord = decodeJsoncTextAs(JsonRecord);
const stringifyJsonPretty = SchemaGetter.stringifyJson({ space: 2 });

/**
 * Repository root resolved relative to the Quality command internals.
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultRepoRoot = fileURLToPath(new URL("../../../../../../../..", import.meta.url));

/**
 * Source file extensions scanned by Quality artifact generators.
 *
 * @category configuration
 * @since 0.0.0
 */
export const sourceExtensions = [".ts", ".tsx"];

/**
 * Source filename suffixes ignored by Quality artifact generators.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ignoredSourceSuffixes = [".d.ts"];

/**
 * Read a UTF-8 text file through the Effect filesystem service.
 *
 * @category filesystem
 * @since 0.0.0
 */
export const readText = Effect.fn("QualityArtifactSupport.readText")(function* (
  filePath: string
): Effect.fn.Return<string, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(filePath)
    .pipe(QualityArtifactGeneratorError.mapError(`Failed to read ${filePath}.`, { filePath }));
});

/**
 * Read and decode a JSONC object document.
 *
 * @category filesystem
 * @since 0.0.0
 */
export const readJsonc = Effect.fn("QualityArtifactSupport.readJsonc")(function* (
  filePath: string
): Effect.fn.Return<JsonRecord, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const text = yield* readText(filePath);
  return yield* decodeJsoncRecord(text).pipe(
    QualityArtifactGeneratorError.mapError(`Failed to parse JSONC document ${filePath}.`, { filePath })
  );
});

/**
 * Format a JSON-compatible value as deterministic JSONC text.
 *
 * @param value - JSON-compatible value to render.
 * @returns Deterministically formatted JSONC text with a trailing newline.
 * @category rendering
 * @since 0.0.0
 */
export const formatJsonc = Effect.fn("QualityArtifactSupport.formatJsonc")(function* (
  value: unknown
): Effect.fn.Return<string, QualityArtifactGeneratorError> {
  const rendered = yield* stringifyJsonPretty
    .run(O.some(value), {})
    .pipe(QualityArtifactGeneratorError.mapError("Failed to format generated JSONC artifact.", {}));
  return `${O.getOrElse(rendered, thunkEmptyStr)}\n`;
});

/**
 * Convert Windows path separators to repo-standard slash separators.
 *
 * @param value - Path text that may contain backslash separators.
 * @returns Path text using slash separators.
 * @category paths
 * @since 0.0.0
 */
export const normalizeSlashes = (value: string): string => Str.replaceAll("\\", "/")(value);

/**
 * Render an absolute path relative to the repository root.
 *
 * @param absolutePath - Absolute path to make repository-relative.
 * @param repoRoot - Absolute repository root path.
 * @param path - Effect path service used for platform path operations.
 * @returns Slash-normalized repository-relative path, or `.` for the root.
 * @category paths
 * @since 0.0.0
 */
export const repoRelative: {
  (absolutePath: string, repoRoot: string, path: Path.Path): string;
  (repoRoot: string, path: Path.Path): (absolutePath: string) => string;
} = dual(3, (absolutePath: string, repoRoot: string, path: Path.Path): string =>
  normalizeSlashes(path.relative(repoRoot, absolutePath) || ".")
);

/**
 * Escape user text for safe inclusion in a regular expression.
 *
 * @param value - Literal text to escape.
 * @returns Regular expression source that matches the input text literally.
 * @category parsing
 * @since 0.0.0
 */
export const escapeRegExp = (value: string): string => Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")(value);

/**
 * Resolve a scanned filesystem entry to its canonical path inside an allowed
 * root, failing closed when the entry escapes the root.
 *
 * The shared {@link resolvePathWithinRoot} guard canonicalizes the entry
 * (following symlinks via `realPath`) and rejects any target whose real path
 * leaves `root` through a symlink, an absolute path, or a `..` traversal. A
 * rejection is mapped to `Option.none` so escaping entries are silently skipped
 * by the workspace and source scanners rather than crashing the generators or
 * being parsed as in-repo source.
 *
 * The caller's `path` service is supplied directly to the guard so this helper
 * keeps its requirement channel to `FileSystem` only and never widens callers
 * (the Quality scanners hold `FileSystem` but expose only that service). The
 * traversal protection from CSF-018 is preserved unchanged.
 *
 * @param root - Allowed root the entry must remain inside.
 * @param entryPath - Candidate entry path produced by directory enumeration.
 * @param path - Effect platform path service supplied to the safety guard.
 * @returns Effect yielding the canonical in-root path, or `Option.none` when
 * the entry escapes the root or cannot be canonicalized.
 * @category paths
 * @since 0.0.0
 */
export const resolveEntryWithinRoot = Effect.fn("QualityArtifactSupport.resolveEntryWithinRoot")(function* (
  root: string,
  entryPath: string,
  path: Path.Path
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  return yield* resolvePathWithinRoot({ root, candidate: entryPath }).pipe(
    Effect.provideService(Path.Path, path),
    Effect.map(O.some),
    Effect.orElseSucceed(O.none<string>)
  );
});

/**
 * Read and decode a package manifest.
 *
 * @category filesystem
 * @since 0.0.0
 */
export const readPackageJson = Effect.fn("QualityArtifactSupport.readPackageJson")(function* (
  filePath: string
): Effect.fn.Return<PackageJson, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const json = yield* readJsonc(filePath);
  return yield* Result.match(decodePackageJsonResult(json), {
    onFailure: (cause) =>
      Effect.fail(
        QualityArtifactGeneratorError.new(cause, `Failed to decode package manifest ${filePath}.`, { filePath })
      ),
    onSuccess: Effect.succeed,
  });
});

/**
 * Read the root package manifest for a repository.
 *
 * @category filesystem
 * @since 0.0.0
 */
export const readRootPackage = Effect.fn("QualityArtifactSupport.readRootPackage")(function* (
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<PackageJson, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  return yield* readPackageJson(path.join(repoRoot, "package.json"));
});

/**
 * Extract workspace glob patterns from a package manifest workspace field.
 *
 * @param workspaces - Raw `package.json` workspaces value.
 * @returns Workspace glob patterns from array or object forms.
 * @category workspaces
 * @since 0.0.0
 */
export const workspacePatternsFrom = (workspaces: unknown): ReadonlyArray<string> => {
  if (A.isArray(workspaces)) {
    return A.filter(workspaces, P.isString);
  }
  if (P.isObject(workspaces) && P.hasProperty(workspaces, "packages") && A.isArray(workspaces.packages)) {
    return A.filter(workspaces.packages, P.isString);
  }
  return [];
};

/**
 * Expand a workspace glob pattern into package directories.
 *
 * @param pattern - Workspace glob pattern to expand.
 * @param repoRoot - Repository root used as the expansion base.
 * @param path - Effect platform path service.
 * @returns Effect that returns package directories containing `package.json`.
 * @category workspaces
 * @since 0.0.0
 */
export const expandWorkspacePattern: {
  (
    pattern: string,
    repoRoot: string,
    path: Path.Path
  ): Effect.Effect<ReadonlyArray<string>, QualityArtifactGeneratorError, FileSystem.FileSystem>;
  (
    repoRoot: string,
    path: Path.Path
  ): (pattern: string) => Effect.Effect<ReadonlyArray<string>, QualityArtifactGeneratorError, FileSystem.FileSystem>;
} = dual(
  3,
  (
    pattern: string,
    repoRoot: string,
    path: Path.Path
  ): Effect.Effect<ReadonlyArray<string>, QualityArtifactGeneratorError, FileSystem.FileSystem> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const segments = A.filter(Str.split("/")(normalizeSlashes(pattern)), Str.isNonEmpty);
      let candidates = [repoRoot];

      for (const segment of segments) {
        const nextCandidates: Array<string> = [];

        for (const candidate of candidates) {
          if (segment === "*") {
            const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(thunkFalse));
            if (!exists) {
              continue;
            }
            const entries = yield* fs.readDirectory(candidate).pipe(
              QualityArtifactGeneratorError.mapError(`Failed to read directory ${candidate}.`, {
                filePath: candidate,
              })
            );
            for (const entry of entries) {
              const entryPath = path.join(candidate, entry);
              const safeEntry = yield* resolveEntryWithinRoot(repoRoot, entryPath, path);
              if (O.isNone(safeEntry)) {
                continue;
              }
              const stat = yield* fs.stat(safeEntry.value).pipe(Effect.option);
              if (O.isSome(stat) && stat.value.type === "Directory") {
                A.appendInPlace(nextCandidates, safeEntry.value);
              }
            }
            continue;
          }

          A.appendInPlace(nextCandidates, path.join(candidate, segment));
        }

        candidates = nextCandidates;
      }

      const existingCandidates: Array<string> = [];
      for (const candidate of candidates) {
        const exists = yield* fs.exists(path.join(candidate, "package.json")).pipe(Effect.orElseSucceed(thunkFalse));
        if (exists) {
          A.appendInPlace(existingCandidates, candidate);
        }
      }

      return existingCandidates;
    }).pipe(
      QualityArtifactGeneratorError.mapError(`Failed to expand workspace pattern ${pattern}.`, {
        filePath: repoRoot,
      })
    )
);

/**
 * Discover workspace packages available to Quality artifact generators.
 *
 * @category workspaces
 * @since 0.0.0
 */
export const discoverWorkspacePackages = Effect.fn("QualityArtifactSupport.discoverWorkspacePackages")(function* (
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<
  MutableHashMap.MutableHashMap<string, WorkspacePackageInfo>,
  QualityArtifactGeneratorError,
  FileSystem.FileSystem
> {
  const rootPackage = yield* readRootPackage(repoRoot, path);
  const packages = MutableHashMap.empty<string, WorkspacePackageInfo>();

  MutableHashMap.set(
    packages,
    rootPackage.name,
    WorkspacePackageInfo.make({
      name: rootPackage.name,
      path: ".",
      absolutePath: repoRoot,
      packageJson: rootPackage,
    })
  );

  for (const pattern of workspacePatternsFrom(rootPackage.workspaces)) {
    for (const packagePath of yield* expandWorkspacePattern(pattern, repoRoot, path)) {
      const packageJson = yield* readPackageJson(path.join(packagePath, "package.json"));
      MutableHashMap.set(
        packages,
        packageJson.name,
        WorkspacePackageInfo.make({
          name: packageJson.name,
          path: repoRelative(packagePath, repoRoot, path),
          absolutePath: packagePath,
          packageJson,
        })
      );
    }
  }

  return packages;
});

const parseTopoSortOutput = (
  output: string,
  includeLine: (line: string) => boolean = (line) => line.length > 0 && !Str.startsWith("$")(line)
): ReadonlyArray<string> =>
  A.filter(
    A.map(
      A.filter(
        A.map(Str.split(/\r?\n/)(output), (line) => Str.trim(line)),
        includeLine
      ),
      (line) => Str.split(/\s+/u)(line)[0]
    ),
    (packageName): packageName is string => packageName !== undefined
  );

/**
 * Read package names from the repository topo-sort command.
 *
 * @category workspaces
 * @since 0.0.0
 */
export const topoSortPackageNames = Effect.fn("QualityArtifactSupport.topoSortPackageNames")(function* (
  repoRoot: string,
  includeLine: (line: string) => boolean = (line) => line.length > 0 && !Str.startsWith("$")(line)
): Effect.fn.Return<ReadonlyArray<string>, QualityArtifactGeneratorError, ChildProcessSpawner.ChildProcessSpawner> {
  const command = "bun run topo-sort";
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bun", ["run", "topo-sort"], {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* handle.all.pipe(
        Stream.decodeText(),
        Stream.runFold(thunkEmptyStr, (acc, chunk) => acc + chunk)
      );
      const exitCode = yield* handle.exitCode;
      return { exitCode, output };
    })
  ).pipe(QualityArtifactGeneratorError.mapError(`Failed to run ${command}.`, { command, filePath: repoRoot }));

  if (result.exitCode !== 0) {
    return yield* QualityArtifactGeneratorError.make({
      command,
      exitCode: result.exitCode,
      filePath: repoRoot,
      message: `${command} failed:\n${result.output}`,
    });
  }

  return parseTopoSortOutput(result.output, includeLine);
});

/**
 * Recursively list TypeScript source files below a directory.
 *
 * @category filesystem
 * @since 0.0.0
 */
export const listSourceFiles = Effect.fn("QualityArtifactSupport.listSourceFiles")(function* (
  directory: string,
  path: Path.Path
): Effect.fn.Return<ReadonlyArray<string>, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(directory).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return A.empty<string>();
  }

  // Resolve the scan root to its canonical real path so the cycle tracker and
  // the recursion compare like-for-like against the canonical entries returned
  // by `resolveEntryWithinRoot`. A root that cannot be canonicalized yields no
  // source files rather than scanning an unverifiable tree.
  const canonicalRoot = yield* resolveEntryWithinRoot(directory, directory, path);
  if (O.isNone(canonicalRoot)) {
    return A.empty<string>();
  }

  // Track canonical directories already entered so a symlink whose real path
  // points back at an ancestor (for example `src/loop -> src`) does not drive
  // the recursion into an unbounded cycle. Entries are canonical realpaths
  // produced by `resolveEntryWithinRoot`, so equal real directories collapse.
  const visited = MutableHashSet.make(canonicalRoot.value);

  // Path-safe recursive directory walk: every branch (canonical re-resolution,
  // symlink-cycle guard, excluded dirs, extension/suffix filtering) is a
  // security-relevant gate; flattening the traversal would risk dropping a check.
  // fallow-ignore-next-line complexity
  const visit = Effect.fn("QualityArtifactSupport.listSourceFiles.visit")(function* (
    current: string
  ): Effect.fn.Return<ReadonlyArray<string>, QualityArtifactGeneratorError, FileSystem.FileSystem> {
    const entries = yield* fs
      .readDirectory(current)
      .pipe(QualityArtifactGeneratorError.mapError(`Failed to read directory ${current}.`, { filePath: current }));
    let files = A.empty<string>();

    for (const entry of entries) {
      const entryPath = path.join(current, entry);
      const safeEntry = yield* resolveEntryWithinRoot(directory, entryPath, path);
      if (O.isNone(safeEntry)) {
        continue;
      }
      const absolutePath = safeEntry.value;
      const stat = yield* fs
        .stat(absolutePath)
        .pipe(QualityArtifactGeneratorError.mapError(`Failed to stat ${absolutePath}.`, { filePath: absolutePath }));

      if (stat.type === "Directory") {
        if (entry === "node_modules" || entry === "dist" || entry === "build" || entry === ".turbo") {
          continue;
        }
        if (MutableHashSet.has(visited, absolutePath)) {
          continue;
        }
        MutableHashSet.add(visited, absolutePath);
        files = A.appendAll(files, yield* visit(absolutePath));
        continue;
      }

      if (stat.type !== "File") {
        continue;
      }

      const extension = path.extname(entry);
      if (!A.contains(sourceExtensions, extension)) {
        continue;
      }

      if (A.some(ignoredSourceSuffixes, (suffix) => Str.endsWith(suffix)(entry))) {
        continue;
      }

      files = A.append(files, absolutePath);
    }

    return files;
  });

  return A.sort(yield* visit(canonicalRoot.value), Order.String);
});

/**
 * Remove JSDoc comment framing from a comment block.
 *
 * @param commentText - Raw JSDoc comment text.
 * @returns Comment lines without the opening, closing, or leading star framing.
 * @category jsdoc
 * @since 0.0.0
 */
export const stripCommentFraming = (commentText: string): ReadonlyArray<string> =>
  A.map(Str.split(/\r?\n/)(Str.replace(/\*\/$/, "")(Str.replace(/^\/\*\*/, "")(commentText))), (line) =>
    Str.trimEnd(Str.replace(/^\s*\*\s?/, "")(line))
  );

/**
 * Extract the summary sentence from a JSDoc comment block.
 *
 * @param commentText - Raw JSDoc comment text.
 * @returns First non-empty prose line, when the comment has one.
 * @category jsdoc
 * @since 0.0.0
 */
export const summaryFromComment = (commentText: string): string | undefined => {
  for (const line of stripCommentFraming(commentText)) {
    const trimmed = Str.trim(line);
    if (trimmed.length === 0 || Str.startsWith("@")(trimmed) || Str.startsWith("```")(trimmed)) {
      continue;
    }
    return trimmed;
  }
  return undefined;
};

/**
 * Extract tag names from a JSDoc comment block.
 *
 * @param commentText - Raw JSDoc comment text.
 * @returns Unique JSDoc tag names in first-seen order.
 * @category jsdoc
 * @since 0.0.0
 */
export const tagsFromComment = (commentText: string): ReadonlyArray<string> => {
  const tags: Array<string> = [];
  for (const line of stripCommentFraming(commentText)) {
    const match = /^\s*@([A-Za-z][\w-]*)\b/.exec(line);
    if (match !== null) {
      A.appendInPlace(tags, `@${match[1]}`);
    }
  }
  return A.dedupe(tags);
};

/**
 * Extract values for a specific JSDoc tag from a comment block.
 *
 * @category jsdoc
 * @since 0.0.0
 */
export const valuesForTag: {
  (tagName: string): (commentText: string) => ReadonlyArray<string>;
  (commentText: string, tagName: string): ReadonlyArray<string>;
} = dual(2, (commentText: string, tagName: string): ReadonlyArray<string> => {
  const values: Array<string> = [];
  const pattern = new RegExp(`^\\s*${escapeRegExp(tagName)}\\b\\s*(.*)$`);

  for (const line of stripCommentFraming(commentText)) {
    const match = pattern.exec(line);
    if (match !== null) {
      A.appendInPlace(values, Str.trim(match[1] ?? ""));
    }
  }

  return values;
});

/**
 * Resolve the ts-morph node that owns a declaration's documentation.
 *
 * @param node - Declaration or export node to inspect.
 * @returns Node whose leading JSDoc should be used for documentation analysis.
 * @category jsdoc
 * @since 0.0.0
 */
export const getDocNode = (node: Node): Node => {
  if (Node.isVariableDeclaration(node)) {
    return node.getVariableStatement() ?? node;
  }
  if (Node.isExportSpecifier(node)) {
    return node.getParent();
  }
  return node;
};

/**
 * Read the nearest JSDoc text for a ts-morph declaration node.
 *
 * @param node - Declaration or export node to inspect.
 * @returns Raw JSDoc text, or an empty string when no JSDoc is available.
 * @category jsdoc
 * @since 0.0.0
 */
export const getJsDocText = (node: Node): string => {
  const docNode = getDocNode(node);
  if (Node.isJSDocable(docNode)) {
    const docs = docNode.getJsDocs();
    return docs.at(-1)?.getText() ?? "";
  }
  return "";
};

/**
 * Classify a ts-morph declaration node for generated reports.
 *
 * @param node - Declaration node to classify.
 * @returns Stable declaration kind label used in quality artifacts.
 * @category jsdoc
 * @since 0.0.0
 */
export const declarationKind = (node: Node): string => {
  if (Node.isFunctionDeclaration(node)) {
    return "function";
  }
  if (Node.isVariableDeclaration(node)) {
    return "const";
  }
  if (Node.isTypeAliasDeclaration(node)) {
    return "type";
  }
  if (Node.isInterfaceDeclaration(node)) {
    return "interface";
  }
  if (Node.isClassDeclaration(node)) {
    return "class";
  }
  if (Node.isModuleDeclaration(node)) {
    return "namespace";
  }
  if (Node.isEnumDeclaration(node)) {
    return "enum";
  }
  return node.getKindName();
};
