import * as NodeURL from "node:url";
import { resolvePathWithinCanonicalRoot, resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Err, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Regex from "effect/RegExp";
import * as S from "effect/Schema";
import { Node } from "ts-morph";
import { fencedLineState } from "../../../internal/jsdoc/JSDocSections.ts";
import { manifestDecoder, manifestParser } from "../../../internal/ManifestRead.ts";
import { runCaptured } from "../../../internal/process/index.ts";
import { OpaqueDefect } from "../../../internal/schema/OpaqueDefect.ts";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import type { WorkspaceDiscoveryError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import type { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ManifestField } from "../../../internal/ManifestRead.ts";

export { fencedLineState, jsdocCommentsFromSource } from "../../../internal/jsdoc/JSDocSections.ts";

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
export class QualityArtifactGeneratorError extends S.TaggedError<
  QualityArtifactGeneratorError,
  { readonly brand: unique symbol }
>($I`QualityArtifactGeneratorError`)(
  "QualityArtifactGeneratorError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    filePath: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<QualityArtifactGeneratorError>("QualityArtifactGeneratorError", {
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
        ...O.getSomesStruct({ command: O.fromUndefinedOr(command) }),
        ...O.getSomesStruct({ exitCode: O.fromUndefinedOr(exitCode) }),
        ...O.getSomesStruct({ filePath: O.fromUndefinedOr(filePath) }),
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
 * Workspace package metadata discovered from root workspace patterns.
 *
 * @category models
 * @since 0.0.0
 */
export class WorkspacePackageInfo extends S.Opaque<WorkspacePackageInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    path: S.String,
    absolutePath: S.String,
    packageJson: LenientManifest,
  }).pipe(
    $I.annoteSchema("WorkspacePackageInfo", {
      description: "Discovered workspace package metadata used by repo CLI support scripts.",
    })
  )
) {}

// The fields Quality artifact generators read from a workspace manifest. The
// four dependency buckets let coverage scope planning follow workspace-internal
// edges to dependents; a malformed `workspaces` fails the read instead of
// silently discovering fewer packages.
const MANIFEST_FIELDS: ReadonlyArray<ManifestField> = [
  "name",
  "scripts",
  "workspaces",
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const parsePackageJson = manifestParser(MANIFEST_FIELDS);
const decodePackageJson = manifestDecoder(MANIFEST_FIELDS);
const decodeJsoncRecord = decodeJsoncTextAs(JsonRecord);

/**
 * Repository root resolved relative to the Quality command internals.
 *
 * @category configuration
 * @since 0.0.0
 */
export const defaultRepoRoot = NodeURL.fileURLToPath(new URL("../../../../../../../..", import.meta.url));

/**
 * Source file extensions scanned by Quality artifact generators.
 *
 * @category configuration
 * @since 0.0.0
 */
const sourceExtensions = [".ts", ".tsx"];

/**
 * Source filename suffixes ignored by Quality artifact generators.
 *
 * @category configuration
 * @since 0.0.0
 */
const ignoredSourceSuffixes = [".d.ts"];

/**
 * Read a UTF-8 text file through the Effect filesystem service.
 *
 * @category filesystem
 * @since 0.0.0
 */
const readText = Effect.fn("QualityArtifactSupport.readText")(function* (
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
 * Resolve a scanned filesystem entry to its canonical path inside an allowed
 * root, failing closed when the entry escapes the root.
 *
 * The shared {@link resolvePathWithinRoot} guard canonicalizes the entry
 * (following symlinks via `realPath`) and rejects any target whose real path
 * leaves `root` through a symlink, an absolute path, or a `..` traversal. A
 * rejection is mapped to `Option.none` so escaping entries are silently skipped
 * by the source scanner rather than crashing the generators or being parsed as
 * in-repo source. Workspace discovery keeps the same protection through the
 * kit's `containWithinRoot` (see {@link discoverWorkspacePackages}).
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
const resolveEntryWithinRoot = Effect.fn("QualityArtifactSupport.resolveEntryWithinRoot")(function* (
  root: string,
  entryPath: string,
  path: Path.Path
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  return yield* resolvePathWithinRoot({ root, candidate: entryPath }).pipe(
    Effect.provideService(Path.Path, path),
    Effect.asSome,
    Effect.orElseSucceed(O.none<string>)
  );
});

/**
 * Read one workspace `package.json` text into its discovery record.
 *
 * **Details**
 *
 * The manifest must declare a `name`, and a present `name`, `scripts`,
 * `workspaces` or dependency bucket must keep its JSON shape. Strict JSON
 * only: JSONC text fails.
 *
 * **Example** (Read a workspace manifest)
 *
 * ```ts
 * import { readWorkspacePackageText } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const info = Effect.runSync(
 *   readWorkspacePackageText('{"name":"@beep/demo"}', "/repo/packages/demo/package.json", "/repo/packages/demo", "packages/demo")
 * )
 * console.log(info.name, info.path) // @beep/demo packages/demo
 * ```
 *
 * @param content - Workspace `package.json` text.
 * @param filePath - Path named in a failure.
 * @param absolutePath - Absolute workspace directory the record carries.
 * @param relativePath - Repo-relative workspace directory the record carries.
 * @returns The workspace's discovery record.
 * @category parsing
 * @since 0.0.0
 */
export const readWorkspacePackageText = Effect.fn("QualityArtifactSupport.readWorkspacePackageText")(function* (
  content: string,
  filePath: string,
  absolutePath: string,
  relativePath: string
): Effect.fn.Return<WorkspacePackageInfo, QualityArtifactGeneratorError> {
  const packageJson = yield* parsePackageJson(content).pipe(
    QualityArtifactGeneratorError.mapError(`Failed to decode package manifest ${filePath}.`, { filePath })
  );
  return yield* workspacePackageInfoOf(packageJson, filePath, absolutePath, relativePath);
});

/**
 * The discovery record for one decoded workspace manifest, failing when it
 * declares no `name`.
 *
 * @category parsing
 * @since 0.0.0
 */
const workspacePackageInfoOf = Effect.fnUntraced(function* (
  packageJson: LenientManifest,
  filePath: string,
  absolutePath: string,
  relativePath: string
): Effect.fn.Return<WorkspacePackageInfo, QualityArtifactGeneratorError> {
  if (P.isUndefined(packageJson.name)) {
    return yield* QualityArtifactGeneratorError.new(
      `${filePath} does not declare a package name.`,
      `Failed to decode package manifest ${filePath}.`,
      { filePath }
    );
  }
  return WorkspacePackageInfo.make({ name: packageJson.name, path: relativePath, absolutePath, packageJson });
});

/**
 * Read one workspace package manifest into its discovery record.
 *
 * @category filesystem
 * @since 0.0.0
 */
const readWorkspacePackage = Effect.fn("QualityArtifactSupport.readWorkspacePackage")(function* (
  absolutePath: string,
  relativePath: string,
  path: Path.Path
): Effect.fn.Return<WorkspacePackageInfo, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const filePath = path.join(absolutePath, "package.json");
  return yield* readWorkspacePackageText(yield* readText(filePath), filePath, absolutePath, relativePath);
});

/**
 * The generator message for a kit discovery failure, naming the file the way
 * the retired expander did.
 *
 * @param error - The kit failure to describe.
 * @returns The generator error message.
 * @category workspaces
 * @since 0.0.0
 */
const discoveryFailureMessage = (error: WorkspaceDiscoveryError): string =>
  Match.value(error.kind).pipe(
    Match.when("read", () => `Failed to read ${error.path}.`),
    Match.when("invalidYaml", () => `Failed to decode workspace config ${error.path}.`),
    Match.orElse(() => `Failed to decode package manifest ${error.path}.`)
  );

/**
 * The members `WorkspaceDiscovery` finds beneath `repoRoot`, root excluded,
 * enumeration order kept.
 *
 * **Details**
 *
 * The root is pinned as both the start and the ceiling of the root ascent, so
 * an enclosing workspace is never adopted, and the kit runs with
 * `containWithinRoot`, so a member directory, wildcard base or `**` descent
 * whose real path leaves the root is skipped before its manifest is read or
 * its tree walked (the CSF-018 traversal protection). A kit failure maps onto
 * the generator error: a manifest that cannot be read fails as its read, a
 * malformed `pnpm-workspace.yaml` as a workspace config decode, any other
 * manifest failure as its decode, and a pattern that cannot be enumerated (a
 * wildcard whose base directory is absent included) as its expansion.
 *
 * @category workspaces
 * @since 0.0.0
 */
const discoverMembers = Effect.fn("QualityArtifactSupport.discoverMembers")(function* (
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const roots = yield* WorkspaceRoot.make.pipe(Effect.provideService(Path.Path, path));
  const discovery = yield* WorkspaceDiscovery.make({ cwd: repoRoot, stopAt: repoRoot, containWithinRoot: true }).pipe(
    Effect.provideService(WorkspaceRoot, roots),
    Effect.provideService(Path.Path, path)
  );
  const packages = yield* discovery.listPackages.pipe(
    Effect.catchTags({
      WorkspaceDiscoveryError: (error) =>
        Effect.fail(QualityArtifactGeneratorError.new(error, discoveryFailureMessage(error), { filePath: error.path })),
      WorkspacePatternError: (error) =>
        Effect.fail(
          QualityArtifactGeneratorError.new(error, `Failed to expand workspace pattern ${error.pattern}.`, {
            filePath: repoRoot,
          })
        ),
      WorkspaceRootNotFoundError: (error) =>
        Effect.fail(
          QualityArtifactGeneratorError.new(error, `Failed to resolve workspace root ${repoRoot}.`, {
            filePath: repoRoot,
          })
        ),
    })
  );
  return A.filter(packages, (workspacePackage) => workspacePackage.relativePath !== ".");
});

/**
 * One discovered member as a Quality discovery record, or `Option.none` when
 * its real path leaves the canonical root.
 *
 * **Details**
 *
 * The containment check is a guard behind the kit's own `containWithinRoot`.
 * The member is recorded at its repo-relative path as the kit enumerated it,
 * lexically under `repoRoot`, and its as-read manifest is decoded by the same
 * strict reader as the root, without reading the file again.
 *
 * @category workspaces
 * @since 0.0.0
 */
const containedMember = Effect.fn("QualityArtifactSupport.containedMember")(function* (
  member: WorkspacePackage,
  canonicalRoot: string,
  repoRoot: string,
  path: Path.Path
): Effect.fn.Return<O.Option<WorkspacePackageInfo>, QualityArtifactGeneratorError, FileSystem.FileSystem> {
  const contained = yield* resolvePathWithinCanonicalRoot({ canonicalRoot, candidate: member.path }).pipe(
    Effect.provideService(Path.Path, path),
    Effect.as(true),
    Effect.orElseSucceed(thunkFalse)
  );
  if (!contained) {
    return O.none();
  }
  const absolutePath = path.join(repoRoot, member.relativePath);
  const filePath = path.join(absolutePath, "package.json");
  const packageJson = yield* decodePackageJson(member.manifestRecord).pipe(
    QualityArtifactGeneratorError.mapError(`Failed to decode package manifest ${filePath}.`, { filePath })
  );
  return O.some(yield* workspacePackageInfoOf(packageJson, filePath, absolutePath, member.relativePath));
});

/**
 * Discover workspace packages available to Quality artifact generators.
 *
 * **Details**
 *
 * The root manifest is read first, so a malformed `workspaces` fails before
 * any member is enumerated, and a root without `workspaces` is a one-package
 * workspace. Members come from `@beep/repo-workspaces` `WorkspaceDiscovery`
 * (discovery only) run with `containWithinRoot`, and each is checked again
 * against the root's real path through `resolvePathWithinCanonicalRoot`
 * before it is kept. The kit's tolerant projection must accept a member
 * first: a non-empty string `name` and, when present, a non-empty string
 * `version`; a non-empty `pnpm-workspace.yaml` `packages` list takes
 * precedence over `workspaces`, as pnpm reads it. The strict `package.json`
 * reader then decodes the member's as-read manifest. Members are recorded at
 * their repo-relative paths under `repoRoot` as given, so a root behind a
 * symlinked ancestor keeps plain relative paths. A later member with an
 * earlier member's name replaces it.
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
  const rootPackage = yield* readWorkspacePackage(repoRoot, ".", path);
  const packages = MutableHashMap.empty<string, WorkspacePackageInfo>();
  MutableHashMap.set(packages, rootPackage.name, rootPackage);
  if (P.isUndefined(rootPackage.packageJson.workspaces)) {
    return packages;
  }

  const members = yield* discoverMembers(repoRoot, path);
  const fs = yield* FileSystem.FileSystem;
  const canonicalRoot = yield* fs
    .realPath(repoRoot)
    .pipe(
      QualityArtifactGeneratorError.mapError(`Failed to resolve workspace root ${repoRoot}.`, { filePath: repoRoot })
    );
  const kept = yield* Effect.forEach(members, (member) => containedMember(member, canonicalRoot, repoRoot, path), {
    concurrency: 10,
  });
  for (const workspacePackage of A.getSomes(kept)) {
    MutableHashMap.set(packages, workspacePackage.name, workspacePackage);
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
 * `bun run topo-sort` output interleaves real package names with dependency
 * section headers (`dependencies`, `devDependencies`, `peerDependencies`,
 * `optionalDependencies`); {@link parseTopoSortOutput} takes the first
 * whitespace token of every line, so those headers parse as phantom package
 * names. The parsed names are intersected against
 * {@link discoverWorkspacePackages} so only real workspace packages survive
 * (ruling R3-J2).
 *
 * @category workspaces
 * @since 0.0.0
 */
export const topoSortPackageNames = Effect.fn("QualityArtifactSupport.topoSortPackageNames")(function* (
  repoRoot: string,
  path: Path.Path,
  includeLine: (line: string) => boolean = (line) => line.length > 0 && !Str.startsWith("$")(line)
): Effect.fn.Return<
  ReadonlyArray<string>,
  QualityArtifactGeneratorError,
  FileSystem.FileSystem | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const command = "bun run topo-sort";
  const result = yield* runCaptured({
    command: "bun",
    args: ["run", "topo-sort"],
    cwd: repoRoot,
  }).pipe(QualityArtifactGeneratorError.mapError(`Failed to run ${command}.`, { command, filePath: repoRoot }));

  if (result.exitCode !== 0) {
    return yield* QualityArtifactGeneratorError.make({
      command,
      exitCode: result.exitCode,
      filePath: repoRoot,
      message: `${command} failed:\n${result.output}`,
    });
  }

  const parsedNames = parseTopoSortOutput(result.output, includeLine);
  const workspacePackages = yield* discoverWorkspacePackages(repoRoot, path);
  return A.filter(parsedNames, (packageName) => MutableHashMap.has(workspacePackages, packageName));
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
  // fallow-ignore-next-line complexity -- path-safe walk keeps canonicalization, cycle, exclusion and suffix gates together (cognitive 20). Owner: @beep/repo-cli. Exit: split when a shared path-safe walker exists in repo-utils.
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
      // The containment guard also accepts not-yet-created write targets by
      // canonicalizing their existing ancestors. Broken symlinks (or entries
      // removed after enumeration) can therefore pass it but have no stat.
      const maybeStat = yield* fs.stat(absolutePath).pipe(
        Effect.asSome,
        Effect.catchIf(
          (error) => P.isTagged("NotFound")(error.reason),
          () => Effect.succeedNone
        ),
        QualityArtifactGeneratorError.mapError(`Failed to stat ${absolutePath}.`, { filePath: absolutePath })
      );
      if (O.isNone(maybeStat)) {
        continue;
      }
      const stat = maybeStat.value;

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
export const summaryFromComment = (commentText: string): O.Option<string> => {
  for (const line of stripCommentFraming(commentText)) {
    const trimmed = Str.trim(line);
    if (trimmed.length === 0 || Str.startsWith("@")(trimmed) || Str.startsWith("```")(trimmed)) {
      continue;
    }
    return O.some(trimmed);
  }
  return O.none();
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
  let openFence: string | undefined;
  for (const line of stripCommentFraming(commentText)) {
    const [nextOpenFence, isFenced] = fencedLineState(line, openFence);
    openFence = nextOpenFence;
    if (isFenced) {
      continue;
    }
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
  const pattern = new RegExp(`^\\s*${Regex.escape(tagName)}\\b\\s*(.*)$`);

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
  // `export default <expression>` (the ESLint-rule module shape, ruling R20)
  // resolves the exported declaration to the expression node itself (for
  // example the CallExpression in `export default defineRule({...})`), which
  // is never JSDocable — the doc block lives on the enclosing ExportAssignment
  // statement instead. A real default-exported declaration (`export default
  // class Foo {}`) is already JSDocable and its parent is the SourceFile, so
  // this branch only redirects the expression-export shape.
  const parent = node.getParent();
  if (parent !== undefined && Node.isExportAssignment(parent)) {
    return parent;
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
  // Binding elements — names exported via a destructured `const { /** doc */
  // Class, ... } = VariantSchema.make(...)` — are absent from ts-morph's
  // `canHaveJSDoc` switch, so `getJsDocs()` never sees the leading `/** */`
  // block sitting directly above each element. Read the leading comment range
  // instead and return the last JSDoc-style block (ruling R24).
  if (Node.isBindingElement(docNode)) {
    const lastJsDoc = A.findLast(docNode.getLeadingCommentRanges(), (range) => Str.startsWith("/**")(range.getText()));
    return O.match(lastJsDoc, { onNone: thunkEmptyStr, onSome: (range) => range.getText() });
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

const collectFilesImpl = Effect.fn("QualityScriptCommands.collectFiles")(function* (
  searchRoot: string,
  shouldInclude: (normalizedPath: string, name: string) => boolean,
  shouldSkipDirectory: (normalizedPath: string, name: string) => boolean
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(searchRoot).pipe(Effect.orElseSucceed(thunkFalse));

  if (!exists) {
    return A.empty<string>();
  }

  // Symlinks are never followed; a directory contributes its subtree unless skipped, a file
  // contributes itself when included, and anything else contributes nothing.
  const visitEntry = Effect.fn("QualityScriptCommands.collectFiles.visitEntry")(function* (
    currentPath: string,
    entry: string
  ): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
    const childPath = path.join(currentPath, entry);
    const normalized = Str.replaceAll("\\", "/")(childPath);
    const symlinkTarget = yield* fs.readLink(childPath).pipe(Effect.option);
    if (O.isSome(symlinkTarget)) {
      return A.empty<string>();
    }

    // An entry removed between the directory listing and this stat (a scoped
    // temporary directory another test is tearing down) contributes nothing;
    // every other stat failure still fails the walk.
    const stat = yield* fs.stat(childPath).pipe(
      Effect.asSome,
      Effect.catchIf(
        (error) => error.reason._tag === "NotFound",
        () => Effect.succeedNone
      ),
      QualityScriptCommandError.mapError(`Failed to stat ${childPath}.`)
    );
    if (O.isNone(stat)) {
      return A.empty<string>();
    }
    if (stat.value.type === "Directory") {
      return shouldSkipDirectory(`${normalized}/`, entry) ? A.empty<string>() : yield* visit(childPath);
    }
    return stat.value.type === "File" && shouldInclude(normalized, entry) ? A.of(childPath) : A.empty<string>();
  });

  const visit = Effect.fn("QualityScriptCommands.collectFiles.visit")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(QualityScriptCommandError.mapError(`Failed to read directory ${currentPath}.`));
    return yield* Effect.forEach(entries, (entry) => visitEntry(currentPath, entry), { concurrency: 1 }).pipe(
      Effect.map(A.flatten)
    );
  });

  return pipe(yield* visit(searchRoot), A.sort(Order.String));
});

/**
 * Walk regular files without following symlinks, using caller-owned inclusion rules.
 *
 * **Example** (Build a bounded file walk)
 * ```ts
 * import { collectFiles } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(collectFiles(".", () => true, () => true))) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const collectFiles: {
  (
    include: (path: string, name: string) => boolean,
    skip: (path: string, name: string) => boolean
  ): (
    root: string
  ) => Effect.Effect<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path>;
  (
    root: string,
    include: (path: string, name: string) => boolean,
    skip: (path: string, name: string) => boolean
  ): Effect.Effect<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path>;
} = dual(3, collectFilesImpl);
