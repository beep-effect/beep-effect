/**
 * TSMorph project loading and source-inspection service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import { Context, Effect, FileSystem, flow, Inspectable, Layer, MutableHashMap, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Node, Project } from "ts-morph";
import { findRepoRoot } from "../Root.ts";
import {
  ByteLength,
  ByteOffset,
  ColumnNumber,
  ContentHashFromSourceText,
  LineNumber,
  makeProjectCacheKey,
  makeProjectScopeId,
  makeSymbol,
  ProjectScopeId,
  ProjectScopeIdParts,
  RepoRootPath,
  SourceText,
  SymbolFilePath,
  SymbolId,
  SymbolNameSegment,
  SymbolQualifiedName,
  TsConfigFilePath,
  TsMorphDiagnostic,
  TsMorphDiagnosticsResult,
  TsMorphFileOutline,
  TsMorphProjectScope,
  TsMorphReferencePolicy,
  TsMorphScopeMode,
  TsMorphSourceTextResult,
  TsMorphSymbolLookupResult,
  TsMorphSymbolSearchResult,
  TsMorphSymbolSourceResult,
  TypeScriptFilePath,
  TypeScriptImplementationFilePath,
  TypeScriptImplementationFilePathToSymbolFilePath,
  WorkspaceDirectoryPath,
} from "./TSMorph.model.ts";
import {
  byNormalizedDiagnosticAscending,
  byTsMorphSymbolAscending,
  flattenDiagnosticMessageText,
  getDeclarationName,
  makeKeywords,
  makeScopeSymbolSearchText,
  makeSummary,
  normalizeDiagnosticCategory,
  pipeQualifiedName,
  readDecorators,
  readDocstring,
  readSignature,
} from "./TSMorph.shared.ts";
import type * as Crypto from "effect/Crypto";
import type { SourceFile } from "ts-morph";
import type {
  ProjectCacheKey,
  TsMorphDiagnosticsRequest,
  TsMorphFileOutlineRequest,
  TsMorphProjectInspectionRequest,
  TsMorphProjectScopeRequest,
  TsMorphScopeEntrypoint,
  TsMorphSourceTextRequest,
  Symbol as TsMorphSymbol,
  TsMorphSymbolLookupRequest,
  TsMorphSymbolSearchRequest,
  TsMorphSymbolSourceRequest,
} from "./TSMorph.model.ts";
import type { OutlineDeclaration } from "./TSMorph.shared.ts";

const $I = $RepoUtilsId.create("TSMorph/TSMorph.service");

const DEFAULT_SCOPE_MODE = TsMorphScopeMode.Enum.syntax;
const DEFAULT_REFERENCE_POLICY = TsMorphReferencePolicy.Enum.workspaceOnly;
const DEFAULT_TSCONFIG_FILE_NAME = "tsconfig.json";
const utf8Encoder = new TextEncoder();

const decodeNonNegativeInt = S.decodeUnknownEffect(NonNegativeInt);

/**
 * Typed error retained for compatibility with older placeholder service wiring.
 *
 * **Example** (Access unavailable error identifier)
 *
 * ```ts
 * import { TsMorphServiceUnavailableError } from "@beep/repo-utils"
 * const identifier = TsMorphServiceUnavailableError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsMorphServiceUnavailableError extends S.TaggedError<TsMorphServiceUnavailableError>(
  $I`TsMorphServiceUnavailableError`
)(
  "TsMorphServiceUnavailableError",
  {
    method: S.String,
    message: S.String,
  },
  $I.annoteError<TsMorphServiceUnavailableError>("TsMorphServiceUnavailableError", {
    description:
      "Typed compatibility error for placeholder TSMorphService methods; the current read-only live methods should not emit it.",
  })
) {}

/**
 * Typed error returned when a scope or repository path cannot be resolved.
 *
 * **Example** (Access scope resolution identifier)
 *
 * ```ts
 * import { TsMorphScopeResolutionError } from "@beep/repo-utils"
 * const identifier = TsMorphScopeResolutionError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsMorphScopeResolutionError extends S.TaggedError<TsMorphScopeResolutionError>(
  $I`TsMorphScopeResolutionError`
)(
  "TsMorphScopeResolutionError",
  {
    entrypoint: S.String,
    message: S.String,
  },
  $I.annoteError<TsMorphScopeResolutionError>("TsMorphScopeResolutionError", {
    description:
      "Typed error indicating that a repository path or tsconfig scope could not be resolved for TSMorphService.",
  })
) {}

/**
 * Typed error returned when a scoped ts-morph project cannot be constructed.
 *
 * **Example** (Access project load identifier)
 *
 * ```ts
 * import { TsMorphProjectLoadError } from "@beep/repo-utils"
 * const identifier = TsMorphProjectLoadError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsMorphProjectLoadError extends S.TaggedError<TsMorphProjectLoadError>($I`TsMorphProjectLoadError`)(
  "TsMorphProjectLoadError",
  {
    scopeId: ProjectScopeId,
    tsConfigPath: TsConfigFilePath,
    message: S.String,
  },
  $I.annoteError<TsMorphProjectLoadError>("TsMorphProjectLoadError", {
    description: "Typed error indicating that a ts-morph Project could not be initialized for a resolved scope.",
  })
) {}

/**
 * Typed error returned when a TypeScript file cannot be loaded from a resolved scope.
 *
 * **Example** (Access source file error identifier)
 *
 * ```ts
 * import { TsMorphSourceFileError } from "@beep/repo-utils"
 * const identifier = TsMorphSourceFileError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsMorphSourceFileError extends S.TaggedError<TsMorphSourceFileError>($I`TsMorphSourceFileError`)(
  "TsMorphSourceFileError",
  {
    scopeId: S.OptionFromNullOr(ProjectScopeId),
    filePath: S.Option(TypeScriptFilePath),
    message: S.String,
  },
  $I.annoteError<TsMorphSourceFileError>("TsMorphSourceFileError", {
    description:
      "Typed error indicating that a TypeScript source file could not be loaded or normalized by TSMorphService.",
  })
) {
  /**
   * Construct a source-file error from a raw file path (decoded to an `Option`) and message.
   *
   * @param filePathInput - Raw file path decoded to an `Option<TypeScriptFilePath>`.
   * @param message - Human-readable explanation of the source-file failure.
   * @param scopeId - Optional project scope the failing file belongs to.
   * @returns A `TsMorphSourceFileError` carrying the decoded path, message, and scope.
   * @category constructors
   * @since 0.0.0
   */
  static at(
    filePathInput: string,
    message: string,
    scopeId: O.Option<ProjectScopeId> = O.none()
  ): TsMorphSourceFileError {
    return TsMorphSourceFileError.make({
      scopeId,
      filePath: TypeScriptFilePath.decodeUnknownOption(filePathInput),
      message,
    });
  }
}

/**
 * Typed error returned when a symbol id cannot be resolved within a scope.
 *
 * **Example** (Access symbol not found identifier)
 *
 * ```ts
 * import { TsMorphSymbolNotFoundError } from "@beep/repo-utils"
 * const identifier = TsMorphSymbolNotFoundError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsMorphSymbolNotFoundError extends S.TaggedError<TsMorphSymbolNotFoundError>(
  $I`TsMorphSymbolNotFoundError`
)(
  "TsMorphSymbolNotFoundError",
  {
    scopeId: ProjectScopeId,
    symbolId: SymbolId,
    message: S.String,
  },
  $I.annoteError<TsMorphSymbolNotFoundError>("TsMorphSymbolNotFoundError", {
    description: "Typed error indicating that a stable symbol id could not be resolved inside a ts-morph scope.",
    reason: "Raised when a requested stable symbol id is absent from the scope-local symbol index.",
    owner: "repo-utils",
    issueContext: "ts-morph-read-only-v1",
  })
) {}

/**
 * Typed error returned when a request targets a currently unsupported TypeScript source boundary.
 *
 * **Example** (Access unsupported file identifier)
 *
 * ```ts
 * import { TsMorphUnsupportedFileError } from "@beep/repo-utils"
 * const identifier = TsMorphUnsupportedFileError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsMorphUnsupportedFileError extends S.TaggedError<TsMorphUnsupportedFileError>(
  $I`TsMorphUnsupportedFileError`
)(
  "TsMorphUnsupportedFileError",
  {
    filePath: TypeScriptFilePath,
    message: S.String,
  },
  $I.annoteError<TsMorphUnsupportedFileError>("TsMorphUnsupportedFileError", {
    description:
      "Typed error indicating that a TypeScript file is valid input but is not yet supported by the current TSMorphService operation.",
  })
) {}

/**
 * Tagged union of all recoverable service errors emitted by `TSMorphService`.
 *
 * **Example** (Access service error identifier)
 *
 * ```ts
 * import { TSMorphServiceError } from "@beep/repo-utils"
 * const identifier = TSMorphServiceError.ast.annotations?.identifier
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TSMorphServiceError = S.Union([
  TsMorphProjectLoadError,
  TsMorphScopeResolutionError,
  TsMorphSourceFileError,
  TsMorphSymbolNotFoundError,
  TsMorphUnsupportedFileError,
  TsMorphServiceUnavailableError,
]).pipe(
  $I.annoteSchema("TSMorphServiceError", {
    description: "Tagged union of all recoverable service errors emitted by TSMorphService.",
  }),
  S.toTaggedUnion("_tag")
);

/**
 * Tagged union type for all ts-morph service errors.
 *
 * **Example** (Import error union type)
 *
 * ```ts
 * import type { TSMorphServiceError } from "@beep/repo-utils"
 * type Example = TSMorphServiceError
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSMorphServiceError = typeof TSMorphServiceError.Type;

/**
 * Read-only v1 service contract for ts-morph-backed scope, symbol, source, and diagnostic operations.
 *
 * **Example** (Import service shape type)
 *
 * ```ts
 * import type { TSMorphServiceShape } from "@beep/repo-utils"
 * type Example = TSMorphServiceShape
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSMorphServiceShape = {
  readonly resolveProjectScope: (
    request: TsMorphProjectScopeRequest
  ) => Effect.Effect<TsMorphProjectScope, TSMorphServiceError>;
  readonly inspectProject: <A>(
    request: TsMorphProjectInspectionRequest,
    inspect: (context: {
      readonly scope: TsMorphProjectScope;
      readonly project: Project;
      readonly sourceFiles: ReadonlyArray<SourceFile>;
    }) => A
  ) => Effect.Effect<A, TSMorphServiceError>;
  readonly getFileOutline: (
    request: TsMorphFileOutlineRequest
  ) => Effect.Effect<TsMorphFileOutline, TSMorphServiceError>;
  readonly getSymbolById: (
    request: TsMorphSymbolLookupRequest
  ) => Effect.Effect<TsMorphSymbolLookupResult, TSMorphServiceError>;
  readonly searchSymbols: (
    request: TsMorphSymbolSearchRequest
  ) => Effect.Effect<TsMorphSymbolSearchResult, TSMorphServiceError>;
  readonly readSourceText: (
    request: TsMorphSourceTextRequest
  ) => Effect.Effect<TsMorphSourceTextResult, TSMorphServiceError>;
  readonly readSymbolSource: (
    request: TsMorphSymbolSourceRequest
  ) => Effect.Effect<TsMorphSymbolSourceResult, TSMorphServiceError>;
  readonly getDiagnostics: (
    request: TsMorphDiagnosticsRequest
  ) => Effect.Effect<TsMorphDiagnosticsResult, TSMorphServiceError>;
  readonly updateSourceFile: (
    filePath: string,
    update: (sourceFile: SourceFile, project: Project) => void
  ) => Effect.Effect<boolean, TSMorphServiceError>;
};

/**
 * Service tag for the read-only v1 ts-morph contract.
 *
 * **Example** (Yield service tag in Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { TSMorphService } from "@beep/repo-utils"
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* TSMorphService
 *   return "getFileOutline" satisfies keyof typeof service
 * })
 * console.log(program)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class TSMorphService extends Context.Service<TSMorphService, TSMorphServiceShape>()($I`TSMorphService`) {}

type ProjectPool = {
  readonly getOrCreate: (scope: TsMorphProjectScope) => Effect.Effect<Project, TsMorphProjectLoadError>;
};

type ScopeSymbolIndex = {
  readonly entries: ReadonlyArray<ScopeSymbolEntry>;
  readonly entriesById: MutableHashMap.MutableHashMap<string, ScopeSymbolEntry>;
  readonly entriesByFilePath: MutableHashMap.MutableHashMap<string, ReadonlyArray<ScopeSymbolEntry>>;
};

interface ScopeSymbolEntry {
  readonly contentHash: TsMorphSymbol["contentHash"];
  readonly searchText: string;
  readonly sourceText: SourceText;
  readonly symbol: TsMorphSymbol;
}

const byScopeSymbolEntryAscending: Order.Order<ScopeSymbolEntry> = Order.mapInput(
  byTsMorphSymbolAscending,
  (entry: ScopeSymbolEntry) => entry.symbol
);

const schemaMessage = (cause: unknown): string =>
  P.isError(cause) ? cause.message : Inspectable.toStringUnknown(cause, 0);

const decodeOrFail = <A, E extends TSMorphServiceError>(
  decode: (value: unknown) => Effect.Effect<A, S.SchemaError>,
  value: unknown,
  makeError: (message: string) => E
): Effect.Effect<A, E> => decode(value).pipe(Effect.mapError(flow(schemaMessage, makeError)));

const resolveAbsolutePath = (pathApi: Path.Path, repoRootPath: RepoRootPath, inputPath: string): string =>
  pathApi.normalize(pathApi.isAbsolute(inputPath) ? inputPath : pathApi.resolve(repoRootPath, inputPath));

const isOutsideAncestor = (pathApi: Path.Path, parentPath: string, childPath: string): boolean => {
  const relativePath = pathApi.relative(parentPath, childPath);
  return relativePath.length === 0 ? false : pathApi.isAbsolute(relativePath) || Str.startsWith("..")(relativePath);
};

const isMissingDirectoryError = (cause: unknown): boolean =>
  P.isString(cause)
    ? Str.includes("Directory not found:")(cause)
    : P.isObject(cause) &&
      P.hasProperty(cause, "message") &&
      P.isString(cause.message) &&
      Str.includes("Directory not found:")(cause.message);

const decodeRepoRelativePath = Effect.fn(function* (
  pathApi: Path.Path,
  repoRootPath: RepoRootPath,
  absolutePath: string
): Effect.fn.Return<string, TsMorphScopeResolutionError> {
  const relativePath = pathApi.normalize(pathApi.relative(repoRootPath, absolutePath));

  if (relativePath.length === 0 || pathApi.isAbsolute(relativePath) || Str.startsWith("..")(relativePath)) {
    return yield* TsMorphScopeResolutionError.make({
      entrypoint: absolutePath,
      message: `Resolved path "${absolutePath}" is outside the repository root "${repoRootPath}".`,
    });
  }

  return yield* Effect.succeed(relativePath);
});

const ensureExists = Effect.fn("ensureExists")(function* <E extends TSMorphServiceError>(
  fs: FileSystem.FileSystem,
  absolutePath: string,
  makeError: () => E
): Effect.fn.Return<void, E> {
  return yield* fs.exists(absolutePath).pipe(
    Effect.orElseSucceed(thunkFalse),
    Effect.flatMap(
      Effect.fnUntraced(function* (exists) {
        return yield* exists ? Effect.void : Effect.fail(makeError());
      })
    )
  );
});

const createProjectPool = (pathApi: Path.Path): ProjectPool => {
  const projects = MutableHashMap.empty<ProjectCacheKey, Project>();

  const getOrCreate: ProjectPool["getOrCreate"] = Effect.fn(function* (scope) {
    const cachedProject = MutableHashMap.get(projects, scope.cacheKey);
    if (O.isSome(cachedProject)) {
      return cachedProject.value;
    }

    const absoluteTsConfigPath = resolveAbsolutePath(pathApi, scope.repoRootPath, scope.tsConfigPath);
    const project = yield* Effect.try({
      try: () =>
        new Project({
          tsConfigFilePath: absoluteTsConfigPath,
          skipFileDependencyResolution: scope.referencePolicy === TsMorphReferencePolicy.Enum.workspaceOnly,
          skipLoadingLibFiles: scope.mode === TsMorphScopeMode.Enum.syntax,
        }),
      catch: (cause) =>
        TsMorphProjectLoadError.make({
          scopeId: scope.scopeId,
          tsConfigPath: scope.tsConfigPath,
          message: `Failed to initialize ts-morph Project for "${scope.cacheKey}": ${schemaMessage(cause)}`,
        }),
    });

    MutableHashMap.set(projects, scope.cacheKey, project);
    return project;
  });

  return { getOrCreate };
};

const normalizeOutlineSymbol = Effect.fn("normalizeOutlineSymbol")(function* (
  sourceFileText: string,
  symbolFilePath: SymbolFilePath,
  declaration: OutlineDeclaration,
  parentSymbol: O.Option<TsMorphSymbol>
): Effect.fn.Return<O.Option<ScopeSymbolEntry>, TSMorphServiceError, Crypto.Crypto> {
  const declarationName = getDeclarationName(declaration);
  if (O.isNone(declarationName)) {
    return O.none<ScopeSymbolEntry>();
  }

  if (!SymbolNameSegment.is(declarationName.value.name)) {
    return O.none<ScopeSymbolEntry>();
  }

  const qualifiedName = pipeQualifiedName(parentSymbol, declarationName.value.name);
  if (!SymbolQualifiedName.is(qualifiedName)) {
    return O.none<ScopeSymbolEntry>();
  }

  const startOffset = declaration.getStart(true);
  const endOffset = declaration.getEnd();
  const symbolText = yield* decodeOrFail(
    SourceText.decodeEffect,
    Str.slice(startOffset, endOffset)(sourceFileText),
    (message) =>
      TsMorphSourceFileError.at(
        symbolFilePath,
        `Failed to decode extracted symbol source for "${qualifiedName}": ${message}`
      )
  );
  const contentHash = yield* ContentHashFromSourceText.decodeEffect(symbolText).pipe(
    Effect.mapError((error) =>
      TsMorphSourceFileError.at(
        symbolFilePath,
        `Failed to hash extracted symbol source for "${qualifiedName}": ${schemaMessage(error)}`
      )
    )
  );

  const bytePrefix = utf8Encoder.encode(Str.slice(0, startOffset)(sourceFileText));
  const byteSpan = utf8Encoder.encode(symbolText);
  const docstring = readDocstring(declaration);
  const symbol = makeSymbol({
    filePath: yield* decodeOrFail(SymbolFilePath.decodeEffect, symbolFilePath, (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode symbol file path for "${qualifiedName}": ${message}`)
    ),
    name: yield* decodeOrFail(SymbolNameSegment.decodeEffect, declarationName.value.name, (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode symbol name for "${qualifiedName}": ${message}`)
    ),
    qualifiedName: yield* decodeOrFail(SymbolQualifiedName.decodeEffect, qualifiedName, (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode qualified name "${qualifiedName}": ${message}`)
    ),
    kind: declarationName.value.kind,
    signature: readSignature(declaration),
    docstring,
    summary: makeSummary(docstring),
    decorators: readDecorators(declaration),
    keywords: makeKeywords(declarationName.value.name, qualifiedName, { kind: declarationName.value.kind }),
    parentId: O.map(parentSymbol, (parent) => parent.id),
    startLine: yield* decodeOrFail(LineNumber.decodeEffect, declaration.getStartLineNumber(true), (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode start line for "${qualifiedName}": ${message}`)
    ),
    endLine: yield* decodeOrFail(LineNumber.decodeEffect, declaration.getEndLineNumber(), (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode end line for "${qualifiedName}": ${message}`)
    ),
    byteOffset: yield* decodeOrFail(ByteOffset.decodeEffect, bytePrefix.length, (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode byte offset for "${qualifiedName}": ${message}`)
    ),
    byteLength: yield* decodeOrFail(ByteLength.decodeEffect, byteSpan.length, (message) =>
      TsMorphSourceFileError.at(symbolFilePath, `Failed to decode byte length for "${qualifiedName}": ${message}`)
    ),
    contentHash,
  });

  return O.some({
    symbol,
    sourceText: symbolText,
    contentHash,
    searchText: makeScopeSymbolSearchText(symbol, symbolText),
  } satisfies ScopeSymbolEntry);
});

const resolveSymbolFilePath = Effect.fn(function* (
  filePath: TypeScriptFilePath
): Effect.fn.Return<SymbolFilePath, TsMorphUnsupportedFileError> {
  const implementationFilePath = yield* decodeOrFail(
    TypeScriptImplementationFilePath.decodeEffect,
    filePath,
    (message) =>
      TsMorphUnsupportedFileError.make({
        filePath,
        message: `File outlines currently support TypeScript implementation files only: ${message}`,
      })
  );

  return yield* decodeOrFail(
    TypeScriptImplementationFilePathToSymbolFilePath.decodeEffect,
    implementationFilePath,
    (message) =>
      TsMorphUnsupportedFileError.make({
        filePath,
        message: `Failed to normalize implementation file path "${implementationFilePath}" for symbol ids: ${message}`,
      })
  );
});

const collectOutlineEntries = Effect.fn(function* (
  filePath: TypeScriptFilePath,
  sourceFile: SourceFile
): Effect.fn.Return<ReadonlyArray<ScopeSymbolEntry>, TSMorphServiceError, Crypto.Crypto> {
  const symbolFilePath = yield* resolveSymbolFilePath(filePath);

  let entries = A.empty<ScopeSymbolEntry>();
  const sourceText = sourceFile.getFullText();

  for (const statement of sourceFile.getStatements()) {
    if (Node.isFunctionDeclaration(statement)) {
      const entry = yield* normalizeOutlineSymbol(sourceText, symbolFilePath, statement, O.none());
      if (O.isSome(entry)) {
        entries = A.append(entries, entry.value);
      }
      continue;
    }

    if (Node.isClassDeclaration(statement)) {
      const classEntry = yield* normalizeOutlineSymbol(sourceText, symbolFilePath, statement, O.none());
      if (O.isSome(classEntry)) {
        entries = A.append(entries, classEntry.value);

        for (const member of statement.getMembers()) {
          if (
            Node.isConstructorDeclaration(member) ||
            Node.isMethodDeclaration(member) ||
            Node.isGetAccessorDeclaration(member) ||
            Node.isSetAccessorDeclaration(member)
          ) {
            const memberEntry = yield* normalizeOutlineSymbol(
              sourceText,
              symbolFilePath,
              member,
              O.some(classEntry.value.symbol)
            );
            if (O.isSome(memberEntry)) {
              entries = A.append(entries, memberEntry.value);
            }
          }
        }
      }
      continue;
    }

    if (
      Node.isInterfaceDeclaration(statement) ||
      Node.isTypeAliasDeclaration(statement) ||
      Node.isEnumDeclaration(statement)
    ) {
      const entry = yield* normalizeOutlineSymbol(sourceText, symbolFilePath, statement, O.none());
      if (O.isSome(entry)) {
        entries = A.append(entries, entry.value);
      }
    }
  }

  return entries;
});

/**
 * Construct the current live implementation for the v1 TSMorphService contract.
 *
 * **Example** (Create live service instance)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createTSMorphService } from "@beep/repo-utils"
 *
 * const program = createTSMorphService().pipe(
 *   Effect.map((service) => "searchSymbols" in service)
 * )
 * console.log(program)
 * ```
 *
 * @returns Live service implementation backed by filesystem, path, and ts-morph project loading.
 * @effects
 * - Requires `Crypto.Crypto`, `FileSystem.FileSystem`, and `Path.Path`.
 * - Resolves repository roots from `process.cwd()`, reads tsconfig/source
 *   files, loads ts-morph projects, computes content hashes, and reads
 *   diagnostics/symbol outlines.
 * - Caches resolved scopes and symbol indexes in memory for the returned
 *   service instance; only `updateSourceFile` persists source edits.
 * @category models
 * @since 0.0.0
 */
export const createTSMorphService = Effect.fn("createTSMorphService")(function* (): Effect.fn.Return<
  TSMorphServiceShape,
  never,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const cryptoContext = yield* Effect.context<Crypto.Crypto>();

  const resolvedScopes = MutableHashMap.empty<string, TsMorphProjectScope>();
  const projectPool = createProjectPool(pathApi);
  const symbolIndexPool = MutableHashMap.empty<ProjectCacheKey, ScopeSymbolIndex>();

  const resolveRepoRoot = Effect.fn("TSMorphService.resolveRepoRoot")(function* (
    repoRootPath: O.Option<RepoRootPath>
  ): Effect.fn.Return<RepoRootPath, TsMorphScopeResolutionError> {
    if (O.isSome(repoRootPath)) {
      return yield* decodeOrFail(
        RepoRootPath.decodeEffect,
        pathApi.normalize(
          pathApi.isAbsolute(repoRootPath.value)
            ? repoRootPath.value
            : pathApi.resolve(process.cwd(), repoRootPath.value)
        ),
        (message) =>
          TsMorphScopeResolutionError.make({
            entrypoint: repoRootPath.value,
            message: `Failed to normalize explicit repository root "${repoRootPath.value}": ${message}`,
          })
      );
    }

    const discoveredRepoRoot = yield* findRepoRoot(process.cwd()).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.mapError((error) =>
        TsMorphScopeResolutionError.make({
          entrypoint: process.cwd(),
          message: error.message,
        })
      )
    );

    return yield* decodeOrFail(RepoRootPath.decodeEffect, pathApi.normalize(discoveredRepoRoot), (message) =>
      TsMorphScopeResolutionError.make({
        entrypoint: discoveredRepoRoot,
        message: `Failed to normalize discovered repository root "${discoveredRepoRoot}": ${message}`,
      })
    );
  });

  const resolveTsConfigPath = Effect.fn(function* (
    repoRootPath: RepoRootPath,
    tsConfigPath: string
  ): Effect.fn.Return<TsConfigFilePath, TSMorphServiceError> {
    const absoluteTsConfigPath = resolveAbsolutePath(pathApi, repoRootPath, tsConfigPath);
    yield* ensureExists(fs, absoluteTsConfigPath, () =>
      TsMorphScopeResolutionError.make({
        entrypoint: tsConfigPath,
        message: `No tsconfig file exists at "${absoluteTsConfigPath}".`,
      })
    );

    const repoRelativeTsConfigPath = yield* decodeRepoRelativePath(pathApi, repoRootPath, absoluteTsConfigPath);
    return yield* decodeOrFail(TsConfigFilePath.decodeEffect, repoRelativeTsConfigPath, (message) =>
      TsMorphScopeResolutionError.make({
        entrypoint: tsConfigPath,
        message: `Resolved tsconfig path "${repoRelativeTsConfigPath}" is not a valid TsConfigFilePath: ${message}`,
      })
    );
  });

  const resolveScopedFilePath = Effect.fn("TSMorphService.resolveScopedFilePath")(function* (
    repoRootPath: RepoRootPath,
    filePath: TypeScriptFilePath
  ): Effect.fn.Return<
    {
      readonly absoluteFilePath: string;
      readonly filePath: TypeScriptFilePath;
    },
    TSMorphServiceError
  > {
    const absoluteFilePath = resolveAbsolutePath(pathApi, repoRootPath, filePath);
    yield* ensureExists(fs, absoluteFilePath, () =>
      TsMorphSourceFileError.at(filePath, `No TypeScript file exists at "${absoluteFilePath}".`)
    );

    const repoRelativeFilePath = yield* decodeRepoRelativePath(pathApi, repoRootPath, absoluteFilePath);
    return {
      absoluteFilePath,
      filePath: yield* decodeOrFail(TypeScriptFilePath.decodeEffect, repoRelativeFilePath, (message) =>
        TsMorphSourceFileError.at(
          filePath,
          `Resolved file path "${repoRelativeFilePath}" is not a valid TypeScriptFilePath: ${message}`
        )
      ),
    };
  });

  const resolveFileEntrypointTsConfig = Effect.fn(function* (
    repoRootPath: RepoRootPath,
    filePath: TypeScriptFilePath
  ): Effect.fn.Return<TsConfigFilePath, TSMorphServiceError> {
    const { absoluteFilePath } = yield* resolveScopedFilePath(repoRootPath, filePath);

    let currentDirectory = pathApi.dirname(absoluteFilePath);
    while (true) {
      const candidateTsConfigPath = pathApi.join(currentDirectory, DEFAULT_TSCONFIG_FILE_NAME);
      const candidateExists = yield* fs.exists(candidateTsConfigPath).pipe(Effect.orElseSucceed(thunkFalse));

      if (candidateExists) {
        const repoRelativeTsConfigPath = yield* decodeRepoRelativePath(pathApi, repoRootPath, candidateTsConfigPath);
        return yield* decodeOrFail(TsConfigFilePath.decodeEffect, repoRelativeTsConfigPath, (message) =>
          TsMorphScopeResolutionError.make({
            entrypoint: filePath,
            message: `Resolved tsconfig path "${repoRelativeTsConfigPath}" is not a valid TsConfigFilePath: ${message}`,
          })
        );
      }

      if (currentDirectory === repoRootPath) {
        break;
      }

      const parentDirectory = pathApi.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) {
        break;
      }
      currentDirectory = parentDirectory;
    }

    return yield* TsMorphScopeResolutionError.make({
      entrypoint: filePath,
      message: `No owning "${DEFAULT_TSCONFIG_FILE_NAME}" could be found for "${filePath}" within repository root "${repoRootPath}".`,
    });
  });

  const buildResolvedScope = Effect.fn("TSMorphService.buildResolvedScope")(function* (
    repoRootPath: RepoRootPath,
    tsConfigPath: TsConfigFilePath,
    mode: TsMorphScopeMode,
    referencePolicy: TsMorphReferencePolicy
  ) {
    const absoluteTsConfigPath = resolveAbsolutePath(pathApi, repoRootPath, tsConfigPath);
    const workspaceDirectoryPath = yield* decodeOrFail(
      WorkspaceDirectoryPath.decodeEffect,
      pathApi.dirname(absoluteTsConfigPath),
      (message) =>
        TsMorphScopeResolutionError.make({
          entrypoint: tsConfigPath,
          message: `Failed to normalize workspace directory for "${tsConfigPath}": ${message}`,
        })
    );

    const scopeId = makeProjectScopeId({
      tsConfigPath,
      mode,
      referencePolicy,
    });

    const scope = TsMorphProjectScope.make({
      scopeId,
      cacheKey: makeProjectCacheKey({
        tsConfigPath,
        mode,
        referencePolicy,
      }),
      repoRootPath,
      workspaceDirectoryPath,
      tsConfigPath,
      mode,
      referencePolicy,
    });

    MutableHashMap.set(resolvedScopes, scope.scopeId, scope);
    return scope;
  });

  const resolveScopeFromEntrypoint = Effect.fn("TSMorphService.resolveScopeFromEntrypoint")(function* (
    entrypoint: TsMorphScopeEntrypoint,
    repoRootPath: O.Option<RepoRootPath>,
    mode: TsMorphScopeMode,
    referencePolicy: TsMorphReferencePolicy
  ) {
    const resolvedRepoRootPath = yield* resolveRepoRoot(repoRootPath);
    const resolvedTsConfigPath = P.isTagged(entrypoint, "tsconfig")
      ? yield* resolveTsConfigPath(resolvedRepoRootPath, entrypoint.tsConfigPath)
      : yield* resolveFileEntrypointTsConfig(resolvedRepoRootPath, entrypoint.filePath);

    return yield* buildResolvedScope(resolvedRepoRootPath, resolvedTsConfigPath, mode, referencePolicy);
  });

  const resolveScopeById = Effect.fnUntraced(function* (
    scopeId: string
  ): Effect.fn.Return<TsMorphProjectScope, TSMorphServiceError> {
    const cachedScope = MutableHashMap.get(resolvedScopes, scopeId);
    if (O.isSome(cachedScope)) {
      return cachedScope.value;
    }

    const [tsConfigPath, _scopeSeparator, mode, _policySeparator, referencePolicy] = yield* decodeOrFail(
      ProjectScopeIdParts.decodeEffect,
      scopeId,
      (message) =>
        TsMorphScopeResolutionError.make({
          entrypoint: scopeId,
          message: `Failed to parse scope id "${scopeId}": ${message}`,
        })
    );

    const repoRootPath = yield* resolveRepoRoot(O.none());
    const resolvedTsConfigPath = yield* resolveTsConfigPath(repoRootPath, tsConfigPath);
    return yield* buildResolvedScope(repoRootPath, resolvedTsConfigPath, mode, referencePolicy);
  });

  const loadSourceFile = Effect.fnUntraced(function* (
    scope: TsMorphProjectScope,
    filePath: TypeScriptFilePath
  ): Effect.fn.Return<
    {
      readonly sourceFile: SourceFile;
      readonly filePath: TypeScriptFilePath;
    },
    TSMorphServiceError
  > {
    const { absoluteFilePath, filePath: normalizedFilePath } = yield* resolveScopedFilePath(
      scope.repoRootPath,
      filePath
    );

    if (
      scope.referencePolicy === TsMorphReferencePolicy.Enum.workspaceOnly &&
      isOutsideAncestor(pathApi, scope.workspaceDirectoryPath, absoluteFilePath)
    ) {
      return yield* TsMorphSourceFileError.at(
        normalizedFilePath,
        `File "${normalizedFilePath}" is outside the workspace directory "${scope.workspaceDirectoryPath}" for scope "${scope.scopeId}".`,
        O.some(scope.scopeId)
      );
    }

    const project = yield* projectPool.getOrCreate(scope);
    const existingSourceFile = project.getSourceFile(absoluteFilePath);
    const sourceFile = existingSourceFile ?? project.addSourceFileAtPathIfExists(absoluteFilePath);

    if (sourceFile === undefined) {
      return yield* TsMorphSourceFileError.at(
        normalizedFilePath,
        `File "${normalizedFilePath}" could not be loaded into ts-morph project scope "${scope.scopeId}".`,
        O.some(scope.scopeId)
      );
    }

    if (existingSourceFile === undefined) {
      MutableHashMap.remove(symbolIndexPool, scope.cacheKey);
    }

    return {
      sourceFile,
      filePath: normalizedFilePath,
    };
  });

  const collectScopeSymbolIndex = Effect.fnUntraced(function* (
    scope: TsMorphProjectScope
  ): Effect.fn.Return<ScopeSymbolIndex, TSMorphServiceError> {
    const project = yield* projectPool.getOrCreate(scope);
    let entries = A.empty<ScopeSymbolEntry>();

    for (const sourceFile of project.getSourceFiles()) {
      const absoluteFilePath = pathApi.normalize(sourceFile.getFilePath());
      if (
        scope.referencePolicy === TsMorphReferencePolicy.Enum.workspaceOnly &&
        isOutsideAncestor(pathApi, scope.workspaceDirectoryPath, absoluteFilePath)
      ) {
        continue;
      }

      const repoRelativeFilePath = pathApi.normalize(pathApi.relative(scope.repoRootPath, absoluteFilePath));
      if (
        repoRelativeFilePath.length === 0 ||
        pathApi.isAbsolute(repoRelativeFilePath) ||
        Str.startsWith("..")(repoRelativeFilePath)
      ) {
        continue;
      }

      const implementationFilePath = TypeScriptImplementationFilePath.decodeUnknownOption(repoRelativeFilePath);
      if (O.isSome(implementationFilePath)) {
        const sourceEntries = yield* collectOutlineEntries(implementationFilePath.value, sourceFile).pipe(
          Effect.provide(cryptoContext)
        );
        entries = A.appendAll(entries, sourceEntries);
      }
    }

    const sortedEntries = A.sort(entries, byScopeSymbolEntryAscending);
    const entriesById = MutableHashMap.empty<string, ScopeSymbolEntry>();
    const entriesByFilePath = MutableHashMap.empty<string, ReadonlyArray<ScopeSymbolEntry>>();

    for (const entry of entries) {
      const fileEntries = O.getOrElse(
        MutableHashMap.get(entriesByFilePath, entry.symbol.filePath),
        A.empty<ScopeSymbolEntry>
      );
      MutableHashMap.set(entriesByFilePath, entry.symbol.filePath, A.append(fileEntries, entry));
    }

    for (const entry of sortedEntries) {
      MutableHashMap.set(entriesById, entry.symbol.id, entry);
    }

    return {
      entries: sortedEntries,
      entriesById,
      entriesByFilePath,
    } satisfies ScopeSymbolIndex;
  });

  const getOrCreateScopeSymbolIndex = Effect.fnUntraced(function* (
    scope: TsMorphProjectScope
  ): Effect.fn.Return<ScopeSymbolIndex, TSMorphServiceError> {
    const cachedSymbolIndex = MutableHashMap.get(symbolIndexPool, scope.cacheKey);
    if (O.isSome(cachedSymbolIndex)) {
      return cachedSymbolIndex.value;
    }

    const symbolIndex = yield* collectScopeSymbolIndex(scope);
    MutableHashMap.set(symbolIndexPool, scope.cacheKey, symbolIndex);
    return symbolIndex;
  });

  const findScopeSymbolEntry = Effect.fnUntraced(function* (
    scope: TsMorphProjectScope,
    symbolId: SymbolId
  ): Effect.fn.Return<ScopeSymbolEntry, TSMorphServiceError> {
    const symbolIndex = yield* getOrCreateScopeSymbolIndex(scope);
    const entry = MutableHashMap.get(symbolIndex.entriesById, symbolId);
    if (O.isSome(entry)) {
      return entry.value;
    }

    return yield* TsMorphSymbolNotFoundError.make({
      scopeId: scope.scopeId,
      symbolId,
      message: `Symbol "${symbolId}" could not be resolved within scope "${scope.scopeId}".`,
    });
  });

  const resolveProjectScope: TSMorphServiceShape["resolveProjectScope"] = Effect.fn(function* (request) {
    return yield* resolveScopeFromEntrypoint(
      request.entrypoint,
      request.repoRootPath,
      request.mode,
      request.referencePolicy
    );
  });

  const readSourceText: TSMorphServiceShape["readSourceText"] = Effect.fn(function* (request) {
    const scope = yield* resolveScopeFromEntrypoint(
      {
        _tag: "file",
        filePath: request.filePath,
      },
      O.none(),
      DEFAULT_SCOPE_MODE,
      DEFAULT_REFERENCE_POLICY
    );
    const loadedSourceFile = yield* loadSourceFile(scope, request.filePath);
    const sourceText = yield* decodeOrFail(
      SourceText.decodeEffect,
      loadedSourceFile.sourceFile.getFullText(),
      (message) =>
        TsMorphSourceFileError.at(
          loadedSourceFile.filePath,
          `Failed to decode source text for "${loadedSourceFile.filePath}": ${message}`,
          O.some(scope.scopeId)
        )
    );
    const contentHash = yield* ContentHashFromSourceText.decodeEffect(sourceText).pipe(
      Effect.mapError((error) =>
        TsMorphSourceFileError.at(
          loadedSourceFile.filePath,
          `Failed to hash source text for "${loadedSourceFile.filePath}": ${schemaMessage(error)}`,
          O.some(scope.scopeId)
        )
      ),
      Effect.provide(cryptoContext)
    );

    return TsMorphSourceTextResult.make({
      filePath: loadedSourceFile.filePath,
      sourceText,
      contentHash,
    });
  });

  const getFileOutline: TSMorphServiceShape["getFileOutline"] = Effect.fn(function* (request) {
    const scope = yield* resolveScopeById(request.scopeId);
    const loadedSourceFile = yield* loadSourceFile(scope, request.filePath);
    const outlineEntries = yield* collectOutlineEntries(loadedSourceFile.filePath, loadedSourceFile.sourceFile).pipe(
      Effect.provide(cryptoContext)
    );
    const symbols = A.map(outlineEntries, (entry) => entry.symbol);

    return TsMorphFileOutline.make({
      scopeId: scope.scopeId,
      filePath: loadedSourceFile.filePath,
      symbols,
    });
  });

  const getSymbolById: TSMorphServiceShape["getSymbolById"] = Effect.fn(function* (request) {
    const scope = yield* resolveScopeById(request.scopeId);
    const entry = yield* findScopeSymbolEntry(scope, request.symbolId);

    return TsMorphSymbolLookupResult.make({
      scopeId: scope.scopeId,
      symbol: entry.symbol,
    });
  });

  const searchSymbols: TSMorphServiceShape["searchSymbols"] = Effect.fn(function* (request) {
    const scope = yield* resolveScopeById(request.scopeId);
    const symbolIndex = yield* getOrCreateScopeSymbolIndex(scope);
    const normalizedQuery = pipe(request.query, Str.trim, Str.toLowerCase);
    const searchableEntries = Str.isNonEmpty(normalizedQuery) ? symbolIndex.entries : A.empty<ScopeSymbolEntry>();
    const matchesRequestedFilters = (entry: ScopeSymbolEntry): boolean =>
      (A.isReadonlyArrayEmpty(request.categories) ||
        A.some(request.categories, (category) => category === entry.symbol.category)) &&
      (A.isReadonlyArrayEmpty(request.kinds) || A.some(request.kinds, (kind) => kind === entry.symbol.kind));
    const filteredEntries = pipe(
      searchableEntries,
      A.filter((entry) => Str.includes(normalizedQuery)(entry.searchText) && matchesRequestedFilters(entry))
    );

    return TsMorphSymbolSearchResult.make({
      scopeId: scope.scopeId,
      query: request.query,
      limit: request.limit,
      symbols: pipe(
        A.take(filteredEntries, request.limit),
        A.map((entry) => entry.symbol)
      ),
      total: yield* decodeOrFail(decodeNonNegativeInt, A.length(filteredEntries), (message) =>
        TsMorphSourceFileError.make({
          scopeId: O.some(scope.scopeId),
          filePath: O.none(),
          message: `Failed to decode symbol search total: ${message}`,
        })
      ),
    });
  });

  const readSymbolSource: TSMorphServiceShape["readSymbolSource"] = Effect.fn(function* (request) {
    const scope = yield* resolveScopeById(request.scopeId);
    const entry = yield* findScopeSymbolEntry(scope, request.symbolId);

    return TsMorphSymbolSourceResult.make({
      scopeId: scope.scopeId,
      symbol: entry.symbol,
      sourceText: entry.sourceText,
      contentHash: entry.contentHash,
    });
  });

  const getDiagnostics: TSMorphServiceShape["getDiagnostics"] = Effect.fn(function* (request) {
    const scope = yield* resolveScopeById(request.scopeId);
    const loadedSourceFile = yield* loadSourceFile(scope, request.filePath);
    const normalizedLoadedSourceFilePath = pathApi.normalize(loadedSourceFile.sourceFile.getFilePath());
    const diagnostics = yield* pipe(
      loadedSourceFile.sourceFile.getPreEmitDiagnostics(),
      A.filter((diagnostic) => {
        const diagnosticSourceFile = diagnostic.getSourceFile();

        return (
          P.isNotUndefined(diagnosticSourceFile) &&
          pathApi.normalize(diagnosticSourceFile.getFilePath()) === normalizedLoadedSourceFilePath
        );
      }),
      Effect.forEach(
        Effect.fnUntraced(function* (diagnostic) {
          const start = diagnostic.getStart() ?? 0;
          const length = diagnostic.getLength() ?? 0;
          const end = start + length;
          const startPosition = loadedSourceFile.sourceFile.getLineAndColumnAtPos(start);
          const endPosition = loadedSourceFile.sourceFile.getLineAndColumnAtPos(end);
          const source = diagnostic.getSource();
          const filePathOption = TypeScriptFilePath.decodeUnknownOption(loadedSourceFile.filePath);
          const decodeDiagnosticField = <A>(
            decode: (value: unknown) => Effect.Effect<A, S.SchemaError>,
            value: unknown,
            label: string
          ) =>
            decodeOrFail(decode, value, (message) =>
              TsMorphSourceFileError.make({
                scopeId: O.some(scope.scopeId),
                filePath: filePathOption,
                message: `Failed to normalize diagnostic ${label} for "${loadedSourceFile.filePath}": ${message}`,
              })
            );

          return yield* decodeOrFail(
            TsMorphDiagnostic.decodeEffect,
            {
              category: normalizeDiagnosticCategory(diagnostic.getCategory()),
              code: yield* decodeDiagnosticField(decodeNonNegativeInt, diagnostic.getCode(), "code"),
              message: flattenDiagnosticMessageText(diagnostic.getMessageText()),
              source: source ?? null,
              startLine: yield* decodeDiagnosticField(LineNumber.decodeEffect, startPosition.line, "start line"),
              startColumn: yield* decodeDiagnosticField(
                ColumnNumber.decodeEffect,
                startPosition.column,
                "start column"
              ),
              endLine: yield* decodeDiagnosticField(LineNumber.decodeEffect, endPosition.line, "end line"),
              endColumn: yield* decodeDiagnosticField(ColumnNumber.decodeEffect, endPosition.column, "end column"),
            },
            (message) =>
              TsMorphSourceFileError.make({
                scopeId: O.some(scope.scopeId),
                filePath: filePathOption,
                message: `Failed to normalize diagnostic for "${loadedSourceFile.filePath}": ${message}`,
              })
          );
        })
      ),
      Effect.map(A.sort(byNormalizedDiagnosticAscending))
    );

    return TsMorphDiagnosticsResult.make({
      scopeId: scope.scopeId,
      filePath: loadedSourceFile.filePath,
      diagnostics,
    });
  });

  const inspectProject: TSMorphServiceShape["inspectProject"] = Effect.fn("TSMorphService.inspectProject")(
    function* (request, inspect) {
      const scope = yield* resolveScopeFromEntrypoint(
        request.entrypoint,
        request.repoRootPath,
        request.mode,
        request.referencePolicy
      );
      const project = yield* projectPool.getOrCreate(scope);

      for (const sourceFileGlob of request.sourceFileGlobs) {
        yield* Effect.try({
          try: () => project.addSourceFilesAtPaths(sourceFileGlob),
          catch: (cause) =>
            TsMorphSourceFileError.make({
              scopeId: O.some(scope.scopeId),
              filePath: O.none(),
              message: `Failed to add source file glob "${sourceFileGlob}": ${
                P.isObject(cause) && P.hasProperty(cause, "message") && P.isString(cause.message)
                  ? cause.message
                  : Inspectable.toStringUnknown(cause)
              }`,
            }),
        }).pipe(
          Effect.catchIf(
            (error) => isMissingDirectoryError(error.message),
            () => Effect.void
          )
        );
      }

      if (!A.isReadonlyArrayEmpty(request.sourceFileGlobs)) {
        MutableHashMap.remove(symbolIndexPool, scope.cacheKey);
      }

      for (const filePath of request.filePaths) {
        yield* loadSourceFile(scope, filePath);
      }

      const sourceFiles = A.filter(project.getSourceFiles(), (sourceFile) => {
        if (scope.referencePolicy !== TsMorphReferencePolicy.Enum.workspaceOnly) {
          return true;
        }

        return !isOutsideAncestor(pathApi, scope.workspaceDirectoryPath, pathApi.normalize(sourceFile.getFilePath()));
      });

      return yield* Effect.try({
        try: () =>
          inspect({
            scope,
            project,
            sourceFiles,
          }),
        catch: (cause) =>
          TsMorphSourceFileError.make({
            scopeId: O.some(scope.scopeId),
            filePath: O.none(),
            message: `Read-only project inspection failed for scope "${scope.scopeId}": ${schemaMessage(cause)}`,
          }),
      });
    }
  );

  const updateSourceFile: TSMorphServiceShape["updateSourceFile"] = Effect.fn("TSMorphService.updateSourceFile")(
    function* (filePath, update) {
      const safeFilePath = TypeScriptImplementationFilePath.make(filePath);
      const scope = yield* resolveScopeFromEntrypoint(
        {
          _tag: "file",
          filePath: safeFilePath,
        },
        O.none(),
        DEFAULT_SCOPE_MODE,
        DEFAULT_REFERENCE_POLICY
      );
      const loadedSourceFile = yield* loadSourceFile(scope, safeFilePath);
      const project = yield* projectPool.getOrCreate(scope);
      const before = loadedSourceFile.sourceFile.getFullText();

      yield* Effect.try({
        try: () => update(loadedSourceFile.sourceFile, project),
        catch: (cause) =>
          TsMorphSourceFileError.at(
            loadedSourceFile.filePath,
            `Failed to update source file "${loadedSourceFile.filePath}": ${schemaMessage(cause)}`,
            O.some(scope.scopeId)
          ),
      });

      const after = loadedSourceFile.sourceFile.getFullText();
      if (before === after) {
        return false;
      }

      yield* Effect.tryPromise({
        try: () => loadedSourceFile.sourceFile.save(),
        catch: (cause) =>
          TsMorphSourceFileError.at(
            loadedSourceFile.filePath,
            `Failed to save source file "${loadedSourceFile.filePath}": ${schemaMessage(cause)}`,
            O.some(scope.scopeId)
          ),
      });

      MutableHashMap.remove(symbolIndexPool, scope.cacheKey);
      return true;
    }
  );

  return {
    resolveProjectScope,
    inspectProject,
    getFileOutline,
    getSymbolById,
    searchSymbols,
    readSourceText,
    readSymbolSource,
    getDiagnostics,
    updateSourceFile,
  };
});

/**
 * Default live layer for the current TSMorphService contract.
 *
 * **Example** (Compose default live layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { TSMorphServiceLive } from "@beep/repo-utils"
 *
 * const liveLayer = TSMorphServiceLive.pipe(Layer.provideMerge(Layer.empty))
 * console.log(liveLayer)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TSMorphServiceLive: Layer.Layer<TSMorphService, never, Crypto.Crypto | FileSystem.FileSystem | Path.Path> =
  Layer.effect(TSMorphService, createTSMorphService().pipe(Effect.map(TSMorphService.of)));
