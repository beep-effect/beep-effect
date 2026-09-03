/**
 * Deterministic file generation planning/execution service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError } from "@beep/repo-utils";
import { LiteralKit, normalizePath, SchemaUtils } from "@beep/schema";
import { A, Str, thunkEffectVoid, thunkFalse, thunkTrue } from "@beep/utils";
import { Context, Effect, FileSystem, flow, Number as Num, Order, Path, pipe, Ref, Struct } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/CreatePackage/FileGenerationPlanService");
const relativePlanPathSegments = flow(normalizePath, Str.split("/"), A.filter(Str.isNonEmpty));
const isTraversalPathSegment = P.or(Eq.equals("."), Eq.equals(".."));
const isNonEmptyRelativePlanPath = P.every<string>([Str.isNonEmpty, P.not(Str.startsWith("/"))]);
const hasSafeRelativePlanPathSegments: P.Predicate<ReadonlyArray<string>> = P.every([
  A.isReadonlyArrayNonEmpty,
  A.every(P.not(isTraversalPathSegment)),
]);

const isSafeRelativePlanPath = flow(
  normalizePath,
  O.liftPredicate(isNonEmptyRelativePlanPath),
  O.map(relativePlanPathSegments),
  O.filter(hasSafeRelativePlanPathSegments),
  O.isSome
);

const RelativePlanPathChecks = S.makeFilterGroup(
  [
    S.isNonEmpty({
      identifier: $I`RelativePlanPathNonEmptyCheck`,
      title: "Relative plan path non-empty",
      description: "Create-package plan paths must not be empty.",
      message: "Create-package plan paths must not be empty.",
    }),
    S.makeFilter((value: string) => !Str.startsWith("/")(value), {
      identifier: $I`RelativePlanPathNotAbsoluteCheck`,
      title: "Relative plan path not absolute",
      description: "Create-package plan paths must stay relative to the output directory.",
      message: "Create-package plan paths must stay relative to the output directory.",
    }),
    S.makeFilter(isSafeRelativePlanPath, {
      identifier: $I`RelativePlanPathTraversalCheck`,
      title: "Relative plan path traversal-safe",
      description: "Create-package plan paths must not contain traversal segments.",
      message: "Create-package plan paths must not contain '.' or '..' segments.",
    }),
  ],
  {
    identifier: $I`RelativePlanPathChecks`,
    title: "Relative plan path",
    description: "Validated relative path used by create-package plan entries.",
  }
);

const RelativePlanPath = S.String.check(RelativePlanPathChecks).pipe(
  $I.annoteSchema("RelativePlanPath", {
    description: "Validated output-relative path used by create-package plan entries.",
  })
);

const SymlinkTargetPath = RelativePlanPath.pipe(
  $I.annoteSchema("SymlinkTargetPath", {
    description: "Validated relative symlink target path used by create-package plan entries.",
  })
);

/**
 * A file write operation.
 *
 * **Example** (Validate PlannedFile candidate)
 *
 * ```ts
 * import { PlannedFile } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { content: "export {}\n", path: "packages/example/src/index.ts" }
 * console.log(S.is(PlannedFile)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlannedFile extends S.Class<PlannedFile>($I`PlannedFile`)(
  {
    relativePath: RelativePlanPath,
    content: S.String,
  },
  $I.annote("PlannedFile", {
    description: "A file write operation.",
  })
) {}

/**
 * A verbatim asset copy operation.
 *
 * **Details**
 *
 * `sourcePath` points outside the output directory, at the template asset on
 * disk; only `relativePath` is constrained to the generated tree. Assets exist
 * because not every generated file is text — see `StaticAssetSpec`.
 *
 * **Example** (Validate PlannedAsset candidate)
 *
 * ```ts
 * import { PlannedAsset } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { relativePath: "src-tauri/icons/icon.png", sourcePath: "/tmp/templates/assets/tauri-icon.png" }
 * console.log(S.is(PlannedAsset)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlannedAsset extends S.Class<PlannedAsset>($I`PlannedAsset`)(
  {
    relativePath: RelativePlanPath,
    sourcePath: S.String,
  },
  $I.annote("PlannedAsset", {
    description: "A verbatim asset copy operation.",
  })
) {}

/**
 * A symlink operation.
 *
 * **Example** (Validate PlannedSymlink candidate)
 *
 * ```ts
 * import { PlannedSymlink } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { linkPath: "packages/example/AGENTS.md", targetPath: "../../AGENTS.md" }
 * console.log(S.is(PlannedSymlink)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlannedSymlink extends S.Class<PlannedSymlink>($I`PlannedSymlink`)(
  {
    relativePath: RelativePlanPath,
    target: SymlinkTargetPath,
  },
  $I.annote("PlannedSymlink", {
    description: "A symlink operation.",
  })
) {}

/**
 * Input payload used to create a generation pla.
 *
 * **Example** (Validate plan input payload)
 *
 * ```ts
 * import { FileGenerationPlanInput } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { packageName: "@beep/example", packagePath: "packages/example", templateDir: "templates/package" }
 * console.log(S.is(FileGenerationPlanInput)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileGenerationPlanInput extends S.Class<FileGenerationPlanInput>($I`FileGenerationPlanInput`)(
  {
    outputDir: S.String,
    directories: S.Array(RelativePlanPath),
    files: S.Array(PlannedFile),
    assets: PlannedAsset.pipe(S.Array, SchemaUtils.withKeyDefaults(A.empty<PlannedAsset>())),
    symlinks: PlannedSymlink.pipe(S.Array, SchemaUtils.withKeyDefaults(A.empty<PlannedSymlink>())),
  },
  $I.annote("FileGenerationPlanInput", {
    description: "Input payload used to create a generation plan.",
  })
) {}

/**
 * Planned action kinds.
 *
 * **Example** (Check mkdir action kind)
 *
 * ```ts
 * import { GenerationActionKind } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const value = "mkdir"
 * console.log(S.is(GenerationActionKind)(value)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GenerationActionKind = LiteralKit(["mkdir", "write-file", "copy-asset", "symlink"]).pipe(
  $I.annoteSchema("GenerationActionKind", {
    description: "Planned action kinds for deterministic generation.",
  })
);
/**
 * Planned generation action.
 *
 * @category models
 * @since 0.0.0
 */
export type GenerationActionKind = typeof GenerationActionKind.Type;

class GenerationActionMkdir extends S.Class<GenerationActionMkdir>($I`GenerationActionMkdir`)(
  {
    kind: S.tag("mkdir"),
    relativePath: RelativePlanPath,
  },
  $I.annote("GenerationActionMkdir", {
    description: "Directory creation action.",
  })
) {}

class GenerationActionWriteFile extends S.Class<GenerationActionWriteFile>($I`GenerationActionWriteFile`)(
  {
    kind: S.tag("write-file"),
    relativePath: RelativePlanPath,
    content: S.String,
  },
  $I.annote("GenerationActionWriteFile", {
    description: "File write action.",
  })
) {}

class GenerationActionCopyAsset extends S.Class<GenerationActionCopyAsset>($I`GenerationActionCopyAsset`)(
  {
    kind: S.tag("copy-asset"),
    relativePath: RelativePlanPath,
    sourcePath: S.String,
  },
  $I.annote("GenerationActionCopyAsset", {
    description: "Verbatim asset copy action.",
  })
) {}

class GenerationActionSymlink extends S.Class<GenerationActionSymlink>($I`GenerationActionSymlink`)(
  {
    kind: S.tag("symlink"),
    relativePath: RelativePlanPath,
    target: SymlinkTargetPath,
  },
  $I.annote("GenerationActionSymlink", {
    description: "Symlink creation action.",
  })
) {}

/**
 * Planned generation action schema.
 *
 * **Example** (Validate generation action value)
 *
 * ```ts
 * import { GenerationAction } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const value = "mkdir"
 * console.log(S.is(GenerationAction)(value)) // true
 * ```
 *
 * @returns Tagged union schema keyed by `kind`.
 * @category models
 * @since 0.0.0
 */
export const GenerationAction = S.Union([
  GenerationActionMkdir,
  GenerationActionWriteFile,
  GenerationActionCopyAsset,
  GenerationActionSymlink,
]).pipe(
  $I.annoteSchema("GenerationAction", {
    description: "Planned generation action.",
  }),
  S.toTaggedUnion("kind"),
  SchemaUtils.withStatics((schema) => ({
    toStr: flow(
      schema.match({
        mkdir: (action) => `mkdir ${action.relativePath}`,
        "write-file": (action) => `write ${action.relativePath}`,
        "copy-asset": (action) => `copy ${action.relativePath}`,
        symlink: (action) => `symlink ${action.relativePath} -> ${action.target}`,
      })
    ),
  }))
);
/**
 * Planned generation action.
 *
 * @category models
 * @since 0.0.0
 */
export type GenerationAction = typeof GenerationAction.Type;

/**
 * Deterministic generation plan.
 *
 * **Example** (Validate empty generation plan)
 *
 * ```ts
 * import { FileGenerationPlan } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { actions: [], files: [], symlinks: [] }
 * console.log(S.is(FileGenerationPlan)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileGenerationPlan extends S.Class<FileGenerationPlan>($I`FileGenerationPlan`)(
  {
    outputDir: S.String,
    actions: S.Array(GenerationAction),
  },
  $I.annote("FileGenerationPlan", {
    description: "Deterministic generation plan.",
  })
) {}

/**
 * Execution report for a plan run.
 *
 * **Example** (Validate empty execution result)
 *
 * ```ts
 * import { FileGenerationExecutionResult } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { createdDirectories: [], createdFiles: [], createdSymlinks: [] }
 * console.log(S.is(FileGenerationExecutionResult)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileGenerationExecutionResult extends S.Class<FileGenerationExecutionResult>(
  $I`FileGenerationExecutionResult`
)(
  {
    createdDirectories: S.Finite,
    writtenFiles: S.Finite,
    skippedFileWrites: S.Finite,
    createdSymlinks: S.Finite,
    skippedSymlinks: S.Finite,
  },
  $I.annote("FileGenerationExecutionResult", {
    description: "Execution report for a plan run.",
  })
) {}

/**
 * Service contract for deterministic generation plan orchestration.
 *
 * **Example** (Type service shape value)
 *
 * ```ts
 * import type { FileGenerationPlanServiceShape } from "@beep/repo-cli/commands/CreatePackage"
 * const value = {} as FileGenerationPlanServiceShape
 * console.log(value) // example value
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileGenerationPlanServiceShape = {
  readonly createPlan: (input: FileGenerationPlanInput) => FileGenerationPlan;
  readonly previewPlan: (plan: FileGenerationPlan) => ReadonlyArray<string>;
  readonly executePlan: (
    plan: FileGenerationPlan
  ) => Effect.Effect<FileGenerationExecutionResult, DomainError, FileSystem.FileSystem | Path.Path>;
};

/**
 * Service tag for deterministic file-generation planning and execution.
 *
 * **Example** (Access plan service Effect)
 *
 * ```ts
 * import { FileGenerationPlanService } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const program = Effect.service(FileGenerationPlanService)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class FileGenerationPlanService extends Context.Service<
  FileGenerationPlanService,
  FileGenerationPlanServiceShape
>()($I`FileGenerationPlanService`) {}

const toPosixPath = normalizePath;

const unique = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.dedupe(values);

const byDirectoryDepthAscending: Order.Order<string> = Order.mapInput(Order.Number, flow(Str.split("/"), A.length));

const byDirectoryPathAscending: Order.Order<string> = Order.String;

const byDirectoryAscending: Order.Order<string> = Order.combine(byDirectoryDepthAscending, byDirectoryPathAscending);

const sortedDirectories = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(values, byDirectoryAscending);

const sortedByRelativePath = <
  T extends {
    readonly relativePath: string;
  },
>(
  entries: ReadonlyArray<T>
): ReadonlyArray<T> =>
  A.sort(
    entries,
    Order.mapInput(Order.String, (entry: T) => toPosixPath(entry.relativePath))
  );

const planPathSegments = flow(toPosixPath, Str.split("/"), A.filter(Str.isNonEmpty));

const parentDirectoriesOf = flow(
  planPathSegments,
  A.dropRight(1),
  A.scan(A.empty<string>(), (currentSegments, segment) => A.append(currentSegments, segment)),
  A.drop(1),
  A.map(A.join("/"))
);

const parentDirectoriesForEntries = <
  T extends {
    readonly relativePath: string;
  },
>(
  entries: ReadonlyArray<T>
): ReadonlyArray<string> => A.flatMap(entries, flow(Struct.get("relativePath"), parentDirectoriesOf));

const failDomainMessage = (message: string): Effect.Effect<never, DomainError> =>
  Effect.fail(DomainError.newMessage(message));

const mapFsError = (message: string) => Effect.mapError(DomainError.newCause(message));

const failWhen: {
  (condition: boolean, effect: Effect.Effect<never, DomainError>): Effect.Effect<void, DomainError>;
  (effect: Effect.Effect<never, DomainError>): (condition: boolean) => Effect.Effect<void, DomainError>;
} = dual(
  2,
  (condition: boolean, effect: Effect.Effect<never, DomainError>): Effect.Effect<void, DomainError> =>
    effect.pipe(Effect.when(Effect.succeed(condition)), Effect.asVoid)
);

const isEscapingResolvedPath = (path: Path.Path): P.Predicate<string> =>
  P.some([path.isAbsolute, Eq.equals(".."), Str.startsWith("../")]);

const ensureResolvedPathContained: {
  (relativePath: string, path: Path.Path, message: string): Effect.Effect<void, DomainError>;
  (path: Path.Path, message: string): (relativePath: string) => Effect.Effect<void, DomainError>;
} = dual(
  3,
  (relativePath: string, path: Path.Path, message: string): Effect.Effect<void, DomainError> =>
    pipe(
      relativePath,
      O.liftPredicate(P.not(isEscapingResolvedPath(path))),
      O.isNone,
      failWhen(failDomainMessage(message))
    )
);

const ensureCanonicalAncestor = (
  ancestor: {
    readonly canonicalPath: string;
    readonly existingPath: string;
  },
  message: string
): Effect.Effect<void, DomainError> =>
  pipe(
    ancestor,
    O.liftPredicate(({ canonicalPath, existingPath }) => Str.equivalence(existingPath, canonicalPath)),
    O.isNone,
    failWhen(failDomainMessage(`${message}: "${ancestor.existingPath}" -> "${ancestor.canonicalPath}"`))
  );

const resolveExistingAncestor = Effect.fn(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let candidate = absolutePath;

  while (true) {
    const exists = yield* fs.exists(candidate).pipe(mapFsError(`Failed to inspect path "${candidate}"`));

    if (exists) {
      const canonicalPath = yield* fs.realPath(candidate).pipe(mapFsError(`Failed to resolve path "${candidate}"`));

      return {
        canonicalPath,
        existingPath: candidate,
      };
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return yield* failDomainMessage(`Failed to find an existing ancestor for "${absolutePath}"`);
    }
    candidate = parent;
  }
});

const resolveContainedPathBase: {
  (
    rootDir: string,
    relativePath: string,
    allowTerminalSymlink: boolean
  ): Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    relativePath: string,
    allowTerminalSymlink: boolean
  ): (rootDir: string) => Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  3,
  Effect.fn("resolveContainedPathBase")(function* (
    rootDir: string,
    relativePath: string,
    allowTerminalSymlink: boolean
  ): Effect.fn.Return<string, DomainError, FileSystem.FileSystem | Path.Path> {
    const path = yield* Path.Path;
    const resolvedRoot = path.resolve(rootDir);
    const resolvedPath = path.resolve(resolvedRoot, relativePath);
    const relativeFromRoot = normalizePath(path.relative(resolvedRoot, resolvedPath));
    const ancestorCandidate = pipe(
      allowTerminalSymlink,
      O.liftPredicate(P.isTruthy),
      O.map(() => path.dirname(resolvedPath)),
      O.getOrElse(() => resolvedPath)
    );

    yield* pipe(
      relativeFromRoot,
      ensureResolvedPathContained(path, `Generation action escapes output directory: "${relativePath}"`)
    );

    yield* ensureCanonicalAncestor(
      yield* resolveExistingAncestor(resolvedRoot),
      "Generation output directory uses a symlinked ancestor"
    );

    yield* ensureCanonicalAncestor(
      yield* resolveExistingAncestor(ancestorCandidate),
      "Generation action resolves through a symlinked ancestor"
    );

    return resolvedPath;
  })
);

const resolveContainedPath: {
  (rootDir: string, relativePath: string): Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path>;
  (relativePath: string): (rootDir: string) => Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn("resolveContainedPath")(function* (
    rootDir: string,
    relativePath: string
  ): Effect.fn.Return<string, DomainError, FileSystem.FileSystem | Path.Path> {
    return yield* resolveContainedPathBase(rootDir, relativePath, false);
  })
);

const resolveContainedSymlinkDestinationPath: {
  (rootDir: string, relativePath: string): Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path>;
  (relativePath: string): (rootDir: string) => Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn("resolveContainedSymlinkDestinationPath")(function* (
    rootDir: string,
    relativePath: string
  ): Effect.fn.Return<string, DomainError, FileSystem.FileSystem | Path.Path> {
    return yield* resolveContainedPathBase(rootDir, relativePath, true);
  })
);

/**
 * Construct the default generation plan service implementation.
 *
 * **Example** (Create default plan service)
 *
 * ```ts
 * import { createFileGenerationPlanService } from "@beep/repo-cli/commands/CreatePackage"
 *
 * const service = createFileGenerationPlanService()
 * console.log("createPlan" in service) // true
 * ```
 *
 * @returns Deterministic plan preview and execution helpers.
 * @category models
 * @since 0.0.0
 */
export const createFileGenerationPlanService = (): FileGenerationPlanServiceShape => {
  const createPlan: FileGenerationPlanServiceShape["createPlan"] = (input) => {
    const symlinks = input.symlinks;

    const directoryCandidates = pipe(
      A.make(
        A.map(input.directories, toPosixPath),
        parentDirectoriesForEntries(input.files),
        parentDirectoriesForEntries(input.assets),
        parentDirectoriesForEntries(symlinks)
      ),
      A.flatten,
      unique,
      A.filter(Str.isNonEmpty)
    );

    const mkdirActions = pipe(
      directoryCandidates,
      sortedDirectories,
      A.map((relativePath) => GenerationAction.cases.mkdir.make({ relativePath }))
    );

    const writeActions = pipe(
      input.files,
      sortedByRelativePath,
      A.map((file) =>
        GenerationAction.cases["write-file"].make({
          relativePath: toPosixPath(file.relativePath),
          content: file.content,
        })
      )
    );

    const copyAssetActions = pipe(
      input.assets,
      sortedByRelativePath,
      A.map((asset) =>
        GenerationAction.cases["copy-asset"].make({
          relativePath: toPosixPath(asset.relativePath),
          sourcePath: asset.sourcePath,
        })
      )
    );

    const symlinkActions = pipe(
      symlinks,
      sortedByRelativePath,
      A.map((link) =>
        GenerationAction.cases.symlink.make({
          relativePath: toPosixPath(link.relativePath),
          target: toPosixPath(link.target),
        })
      )
    );

    const actions: ReadonlyArray<GenerationAction> = pipe(
      mkdirActions,
      A.appendAll(writeActions),
      A.appendAll(copyAssetActions),
      A.appendAll(symlinkActions)
    );

    return FileGenerationPlan.make({
      outputDir: input.outputDir,
      actions,
    });
  };

  const previewPlan: FileGenerationPlanServiceShape["previewPlan"] = (plan) =>
    A.map(plan.actions, GenerationAction.toStr);

  const executePlan: FileGenerationPlanServiceShape["executePlan"] = Effect.fn(function* (plan) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const ensureDirectoryFor = Effect.fn("ensureDirectoryFor")(function* (absolutePath: string) {
      const parentDir = path.dirname(absolutePath);
      yield* pipe(
        fs.makeDirectory(parentDir, { recursive: true }),
        mapFsError(`Failed to create directory "${parentDir}"`)
      );
    });

    const pathExists = Effect.fn("pathExists")(function* (absolutePath: string) {
      return yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(thunkFalse));
    });

    const readIfExists = Effect.fn("readIfExists")(function* (absolutePath: string) {
      return yield* pipe(
        absolutePath,
        fs.readFileString,
        Effect.asSome,
        Effect.orElseSucceed(O.none<string>),
        Effect.when(pathExists(absolutePath)),
        Effect.map(O.flatten)
      );
    });

    const counterRefs = yield* Effect.all({
      createdDirectories: Ref.make(0),
      writtenFiles: Ref.make(0),
      skippedFileWrites: Ref.make(0),
      createdSymlinks: Ref.make(0),
      skippedSymlinks: Ref.make(0),
    });

    const incrementCounter = Ref.update(Num.increment);
    const countCreatedDirectory = incrementCounter(counterRefs.createdDirectories);
    const countWrittenFile = incrementCounter(counterRefs.writtenFiles);
    const countSkippedFileWrite = incrementCounter(counterRefs.skippedFileWrites);
    const countCreatedSymlink = incrementCounter(counterRefs.createdSymlinks);
    const countSkippedSymlink = incrementCounter(counterRefs.skippedSymlinks);

    const createDirectory = (absolutePath: string) =>
      fs
        .makeDirectory(absolutePath, { recursive: true })
        .pipe(mapFsError(`Failed to create directory "${absolutePath}"`), Effect.tap(countCreatedDirectory));

    const writeFile = (absolutePath: string, content: string) =>
      fs
        .writeFileString(absolutePath, content)
        .pipe(mapFsError(`Failed to write file "${absolutePath}"`), Effect.tap(countWrittenFile));

    const writeFileIfChanged = (absolutePath: string, content: string) =>
      ensureDirectoryFor(absolutePath).pipe(
        Effect.andThen(() => readIfExists(absolutePath)),
        Effect.andThen(
          flow(
            O.filter(Str.equivalence(content)),
            O.map(() => countSkippedFileWrite),
            O.getOrElse(() => writeFile(absolutePath, content))
          )
        )
      );

    // Copied unconditionally rather than skipped-if-present. `create-package`
    // refuses to run against an existing directory, so a destination-exists
    // branch here is one no test can reach — the shape that reads as lost
    // coverage the moment anything else in this file moves.
    const copyAsset = (absolutePath: string, sourcePath: string) =>
      ensureDirectoryFor(absolutePath).pipe(
        Effect.andThen(() =>
          fs
            .copyFile(sourcePath, absolutePath)
            .pipe(mapFsError(`Failed to copy asset "${sourcePath}" to "${absolutePath}"`), Effect.tap(countWrittenFile))
        )
      );

    const createSymlink = (absolutePath: string, target: string) =>
      fs
        .symlink(target, absolutePath)
        .pipe(mapFsError(`Failed to create symlink "${absolutePath}"`), Effect.tap(countCreatedSymlink));

    const removeExistingPath = (absolutePath: string) =>
      fs
        .remove(absolutePath, {
          recursive: true,
          force: true,
        })
        .pipe(mapFsError(`Failed to remove existing path "${absolutePath}"`));

    const replaceWithSymlink = (absolutePath: string, target: string) =>
      removeExistingPath(absolutePath).pipe(Effect.andThen(() => createSymlink(absolutePath, target)));

    const inspectSymlinkPath = Effect.fn("inspectSymlinkPath")(function* (absolutePath: string) {
      const currentTarget = yield* Effect.option(fs.readLink(absolutePath));
      const exists = yield* pipe(
        pathExists(absolutePath),
        Effect.when(Effect.succeed(O.isNone(currentTarget))),
        Effect.map(O.getOrElse(thunkTrue))
      );

      return {
        currentTarget,
        exists,
      };
    });

    const writeSymlinkForState: {
      (exists: boolean, absolutePath: string, target: string): Effect.Effect<void, DomainError>;
      (absolutePath: string, target: string): (exists: boolean) => Effect.Effect<void, DomainError>;
    } = dual(3, (exists: boolean, absolutePath: string, target: string) =>
      pipe(
        exists,
        O.liftPredicate(P.isTruthy),
        O.map(() => replaceWithSymlink(absolutePath, target)),
        O.getOrElse(() => createSymlink(absolutePath, target))
      )
    );

    const ensureSymlink: {
      (absolutePath: string, target: string): Effect.Effect<void, DomainError>;
      (target: string): (absolutePath: string) => Effect.Effect<void, DomainError>;
    } = dual(
      2,
      Effect.fn(function* (absolutePath: string, target: string) {
        return yield* ensureDirectoryFor(absolutePath).pipe(
          Effect.andThen(() => inspectSymlinkPath(absolutePath)),
          Effect.andThen(
            Effect.fnUntraced(function* ({
              currentTarget,
              exists,
            }: {
              currentTarget: O.Option<string>;
              exists: boolean;
            }) {
              return yield* pipe(
                currentTarget,
                O.filter(Str.equivalence(target)),
                O.map(() => countSkippedSymlink),
                O.getOrElse(() => pipe(exists, writeSymlinkForState(absolutePath, target)))
              );
            })
          )
        );
      })
    );

    const runAction: {
      (absolutePath: string, action: GenerationAction): Effect.Effect<void, DomainError>;
      (action: GenerationAction): (absolutePath: string) => Effect.Effect<void, DomainError>;
    } = dual(2, (absolutePath: string, action: GenerationAction) =>
      GenerationAction.match(action, {
        mkdir: () => createDirectory(absolutePath),
        "write-file": (writeAction) => writeFileIfChanged(absolutePath, writeAction.content),
        "copy-asset": (copyAction) => copyAsset(absolutePath, copyAction.sourcePath),
        symlink: (linkAction) => ensureSymlink(absolutePath, linkAction.target),
      })
    );

    const validateSymlinkTarget = Effect.fn("validateSymlinkTarget")(function* (absolutePath: string, target: string) {
      const resolvedTarget = yield* resolveContainedPath(path.dirname(absolutePath), target);
      const relativeToOutputDir = normalizePath(path.relative(path.resolve(plan.outputDir), resolvedTarget));

      yield* ensureResolvedPathContained(
        relativeToOutputDir,
        path,
        `Symlink target escapes output directory: "${target}"`
      );
    });

    const resolveActionPath = Effect.fn("resolveActionPath")(function* (action: GenerationAction) {
      const absolutePath = yield* GenerationAction.match(action, {
        mkdir: () => resolveContainedPath(plan.outputDir, action.relativePath),
        "write-file": () => resolveContainedPath(plan.outputDir, action.relativePath),
        "copy-asset": () => resolveContainedPath(plan.outputDir, action.relativePath),
        symlink: () => resolveContainedSymlinkDestinationPath(plan.outputDir, action.relativePath),
      });

      yield* GenerationAction.match(action, {
        mkdir: thunkEffectVoid,
        "write-file": thunkEffectVoid,
        // Only the destination is constrained; `sourcePath` deliberately points
        // at the template asset outside the generated tree.
        "copy-asset": thunkEffectVoid,
        symlink: ({ target }) => validateSymlinkTarget(absolutePath, target),
      });

      return absolutePath;
    });

    yield* Effect.forEach(
      plan.actions,
      (action) =>
        pipe(
          resolveActionPath(action),
          Effect.andThen((absolutePath: string) => runAction(absolutePath, action))
        ),
      { discard: true }
    );

    return FileGenerationExecutionResult.make(
      yield* Effect.all({
        createdDirectories: Ref.get(counterRefs.createdDirectories),
        writtenFiles: Ref.get(counterRefs.writtenFiles),
        skippedFileWrites: Ref.get(counterRefs.skippedFileWrites),
        createdSymlinks: Ref.get(counterRefs.createdSymlinks),
        skippedSymlinks: Ref.get(counterRefs.skippedSymlinks),
      })
    );
  });

  return {
    createPlan,
    previewPlan,
    executePlan,
  };
};
