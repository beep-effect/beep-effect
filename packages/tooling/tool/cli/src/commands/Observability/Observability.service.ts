/**
 * Instrumentation catalog service: harvests span names, loads every
 * `*.instruments.ts` declarations file, merges them, and writes or checks the
 * per-package catalog shards and the standard's generated section.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Catalog from "@beep/observability/catalog";
import { resolveShardScope, shardScopeIncludes } from "@beep/repo-cli-kit/cli/ShardScope";
import { createWorkspaceOwnerResolver } from "@beep/repo-cli-kit/tsmorph/index";
import { FsUtils } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { isExcludedTypeScriptSourcePath, toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { PosixPath } from "@beep/schema/PosixPath";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Project } from "ts-morph";
import { ObservabilityCommandError } from "./Observability.errors.ts";
import { combineHarvests, harvestSourceFile } from "./Observability.harvest.ts";
import {
  buildCatalog,
  familySpanCounts,
  renderShardText,
  STANDARD_SECTION,
  shardCatalog,
  shardPath,
  spliceStandardSection,
} from "./Observability.render.ts";
import {
  CatalogRunReport,
  DeclarationsFile,
  GeneratedFile,
  GeneratedFileStatus,
  INSTRUMENTATION_CATALOG_DIR,
  INSTRUMENTATION_CATALOG_SHARD_SUFFIX,
  OBSERVABILITY_STANDARD_PATH,
  RETIRED_INSTRUMENTATION_CATALOG_PATH,
  SpanNameFindingKind,
} from "./Observability.schemas.ts";
import type { CatalogRunMode, SpanHarvest } from "./Observability.schemas.ts";

const $I = $RepoCliId.create("commands/Observability/Observability.service");

const SOURCE_GLOBS = ["packages/**/src/**/*.{ts,tsx}", "apps/**/src/**/*.{ts,tsx}"];
const DECLARATION_GLOBS = ["packages/**/src/**/*.instruments.ts", "apps/**/src/**/*.instruments.ts"];
const SOURCE_IGNORE = ["**/node_modules/**", "**/test/**", "**/scratchpad/**", "**/dist/**"];
const SHARD_GLOBS = [`${INSTRUMENTATION_CATALOG_DIR}/**/*${INSTRUMENTATION_CATALOG_SHARD_SUFFIX}`];

const decodePackageName = S.decodeUnknownOption(Catalog.PackageName);
const isInstrumentDeclarations = S.is(Catalog.InstrumentDeclarations);
const isFailingStatus = S.is(S.Literals(["stale", "missing", "orphaned"]));

const failure =
  (path: string, message: string) =>
  (cause: unknown): ObservabilityCommandError =>
    ObservabilityCommandError.make({ path, message, cause });

/**
 * Operations of the instrumentation catalog command.
 *
 * @category services
 * @since 0.0.0
 */
export interface InstrumentationCatalogShape {
  /** Scans `packages/**\/src` and `apps/**\/src` for span names. */
  readonly harvest: Effect.Effect<SpanHarvest, ObservabilityCommandError>;
  /** Imports every `src/**\/*.instruments.ts` file and keeps its declarations exports. */
  readonly loadDeclarations: Effect.Effect<ReadonlyArray<DeclarationsFile>, ObservabilityCommandError>;
  /**
   * Builds the catalog, then writes or checks the catalog shards and the standard's generated section.
   *
   * With `scope`, only the shards of the packages owning those paths are
   * built and compared, and the standard's generated section is skipped.
   */
  readonly run: (
    mode: CatalogRunMode,
    scope?: ReadonlyArray<string> | undefined
  ) => Effect.Effect<CatalogRunReport, ObservabilityCommandError>;
}

/**
 * Instrumentation catalog operations bound to one repository checkout.
 *
 * **Example** (Prepare a check run)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { InstrumentationCatalog } from "@beep/repo-cli/commands/Observability"
 *
 * const program = InstrumentationCatalog.use((catalog) => catalog.run("check"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstrumentationCatalog extends Context.Service<InstrumentationCatalog, InstrumentationCatalogShape>()(
  $I`InstrumentationCatalog`
) {}

const makeInstrumentationCatalog = Effect.fn("InstrumentationCatalog.make")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fsUtils = yield* FsUtils;
  const relative = (absolute: string): string => toPosixPath(path.relative(repoRoot, absolute));

  const ownerOf = yield* createWorkspaceOwnerResolver({ root: repoRoot, fallbackOwner: "@beep/root" }).pipe(
    Effect.mapError(failure(repoRoot, "Failed to resolve workspace packages."))
  );

  // Both loaders glob with the full scan's globs; a scoped run narrows the matched files with
  // `includes`, so a scoped shard is parsed from exactly the files the full scan attributes to it.
  const harvestFiles = Effect.fn("InstrumentationCatalog.harvestFiles")(function* (
    includes: (absolutePath: string) => boolean
  ) {
    const files = yield* fsUtils
      .globFiles(SOURCE_GLOBS, { absolute: true, cwd: repoRoot, ignore: SOURCE_IGNORE })
      .pipe(
        Effect.mapBoth({ onSuccess: A.filter(includes), onFailure: failure(repoRoot, "Failed to list source files.") })
      );
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const harvests = yield* Effect.forEach(
      A.filter(A.sort(files, Str.Order), (file) => !isExcludedTypeScriptSourcePath(relative(file))),
      (file) =>
        O.match(decodePackageName(ownerOf(file)), {
          onNone: () =>
            Effect.fail(
              ObservabilityCommandError.make({ path: relative(file), message: "Owning package name is invalid." })
            ),
          onSome: (owner) =>
            Effect.try({
              try: () => {
                const sourceFile = project.addSourceFileAtPath(file);
                const result = harvestSourceFile(sourceFile, PosixPath.make(relative(file)), owner);
                project.removeSourceFile(sourceFile);
                return result;
              },
              catch: failure(relative(file), "Failed to parse source file."),
            }),
        })
    );
    return combineHarvests(harvests);
  });

  const everyFile = (): boolean => true;

  const harvest = harvestFiles(everyFile).pipe(Effect.withSpan("InstrumentationCatalog.harvest"));

  const loadDeclarationsFiles = Effect.fn("InstrumentationCatalog.loadDeclarationsFiles")(function* (
    includes: (absolutePath: string) => boolean
  ) {
    const files = yield* fsUtils
      .globFiles(DECLARATION_GLOBS, { absolute: true, cwd: repoRoot, ignore: SOURCE_IGNORE })
      .pipe(
        Effect.mapBoth({
          onSuccess: A.filter(includes),
          onFailure: failure(repoRoot, "Failed to list instruments files."),
        })
      );
    return yield* Effect.forEach(A.sort(files, Str.Order), (file) =>
      Effect.tryPromise({
        try: (): Promise<Record<string, unknown>> => import(file),
        catch: failure(relative(file), "Failed to import instrument declarations."),
      }).pipe(
        Effect.flatMap((module) => {
          const declarations = A.filter(R.values(module), isInstrumentDeclarations);
          return A.isReadonlyArrayNonEmpty(declarations)
            ? Effect.succeed(DeclarationsFile.make({ file: PosixPath.make(relative(file)), declarations }))
            : Effect.fail(
                ObservabilityCommandError.make({
                  path: relative(file),
                  message: "Instruments file exports no InstrumentDeclarations value.",
                })
              );
        })
      )
    );
  });

  const loadDeclarations = loadDeclarationsFiles(everyFile).pipe(
    Effect.withSpan("InstrumentationCatalog.loadDeclarations")
  );

  const sync = Effect.fn("InstrumentationCatalog.sync")(function* (
    mode: CatalogRunMode,
    relativePath: string,
    next: (current: O.Option<string>) => Effect.Effect<string, ObservabilityCommandError>
  ) {
    const absolute = path.join(repoRoot, relativePath);
    const exists = yield* fs.exists(absolute).pipe(Effect.mapError(failure(relativePath, "Failed to stat file.")));
    const current = exists
      ? O.some(yield* fs.readFileString(absolute).pipe(Effect.mapError(failure(relativePath, "Failed to read file."))))
      : O.none<string>();
    const content = yield* next(current);
    if (O.contains(current, content)) {
      return GeneratedFileStatus.Enum.current;
    }
    if (mode === "write") {
      yield* fs
        .makeDirectory(path.dirname(absolute), { recursive: true })
        .pipe(Effect.mapError(failure(relativePath, "Failed to create the parent directory.")));
      yield* fs
        .writeFileString(absolute, content)
        .pipe(Effect.mapError(failure(relativePath, "Failed to write file.")));
      return GeneratedFileStatus.Enum.wrote;
    }
    return O.isSome(current) ? GeneratedFileStatus.Enum.stale : GeneratedFileStatus.Enum.missing;
  });

  const retire = Effect.fn("InstrumentationCatalog.retire")(function* (mode: CatalogRunMode, relativePath: string) {
    if (mode === "write") {
      yield* fs
        .remove(path.join(repoRoot, relativePath))
        .pipe(Effect.mapError(failure(relativePath, "Failed to remove orphaned file.")));
      return GeneratedFileStatus.Enum.removed;
    }
    return GeneratedFileStatus.Enum.orphaned;
  });

  const existingCatalogFiles = Effect.gen(function* () {
    const shards = yield* fsUtils
      .globFiles(SHARD_GLOBS, { absolute: true, cwd: repoRoot })
      .pipe(Effect.mapError(failure(INSTRUMENTATION_CATALOG_DIR, "Failed to list catalog shards.")));
    const retired = yield* fs
      .exists(path.join(repoRoot, RETIRED_INSTRUMENTATION_CATALOG_PATH))
      .pipe(Effect.mapError(failure(RETIRED_INSTRUMENTATION_CATALOG_PATH, "Failed to stat file.")));
    return A.sort([...A.map(shards, relative), ...(retired ? [RETIRED_INSTRUMENTATION_CATALOG_PATH] : [])], Str.Order);
  });

  // A scoped run reads only the owning packages' sources. Shards never mix
  // packages, so the scoped text equals the full scan's text for those owners;
  // the standard's generated section and orphan retirement need the whole
  // catalog and are left to the full run.
  const resolveScope = Effect.fn("InstrumentationCatalog.resolveScope")(function* (paths: ReadonlyArray<string>) {
    const scope = yield* resolveShardScope(repoRoot, paths, ownerOf).pipe(
      Effect.mapError(failure(repoRoot, "Failed to resolve the owning packages of the scoped paths.")),
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path)
    );
    return {
      owners: A.getSomes(A.map(scope.owners, (owner) => decodePackageName(owner.owner))),
      includes: shardScopeIncludes(scope, ownerOf),
    };
  });

  const run = Effect.fn("InstrumentationCatalog.run")(function* (
    mode: CatalogRunMode,
    scopePaths?: ReadonlyArray<string> | undefined
  ) {
    const scope = O.fromNullishOr(scopePaths).pipe(O.filter(A.isReadonlyArrayNonEmpty));
    const scoped = O.isSome(scope) ? O.some(yield* resolveScope(scope.value)) : O.none();
    const harvested = yield* O.match(scoped, {
      onNone: () => harvest,
      onSome: ({ includes }) => harvestFiles(includes),
    });
    const files = yield* O.match(scoped, {
      onNone: () => loadDeclarations,
      onSome: ({ includes }) => loadDeclarationsFiles(includes),
    });
    const build = buildCatalog(
      harvested,
      A.flatMap(files, (file) => file.declarations)
    );
    const scopedOwners = O.map(scoped, ({ owners }) => owners);
    const shards = A.filter(shardCatalog(build.document), (shard) =>
      O.match(scopedOwners, { onNone: () => true, onSome: A.contains(shard.package) })
    );
    const expected = HashSet.fromIterable(A.map(shards, (shard) => shardPath(shard.package)));
    const written = yield* Effect.forEach(shards, (shard) => {
      const shardFile = shardPath(shard.package);
      return renderShardText(shard).pipe(
        Effect.mapError(failure(shardFile, "Failed to encode the catalog shard.")),
        Effect.flatMap((text) => sync(mode, shardFile, () => Effect.succeed(text))),
        Effect.map((status) => GeneratedFile.make({ path: PosixPath.make(shardFile), status }))
      );
    });
    // Scoped: only an in-scope owner that lost its last span is an orphan.
    const orphans = yield* O.match(scopedOwners, {
      onNone: () =>
        Effect.map(
          existingCatalogFiles,
          A.filter((file) => !HashSet.has(expected, file))
        ),
      onSome: (owners) =>
        Effect.filter(
          A.filter(A.map(owners, shardPath), (file) => !HashSet.has(expected, file)),
          (file) => fs.exists(path.join(repoRoot, file)).pipe(Effect.mapError(failure(file, "Failed to stat file.")))
        ),
    });
    const retired = yield* Effect.forEach(A.sort(orphans, Str.Order), (file) =>
      Effect.map(retire(mode, file), (status) => GeneratedFile.make({ path: PosixPath.make(file), status }))
    );
    const standard = O.isSome(scoped)
      ? GeneratedFileStatus.Enum.skipped
      : yield* sync(mode, OBSERVABILITY_STANDARD_PATH, (current) =>
          Effect.fromOption(O.flatMap(current, spliceStandardSection(STANDARD_SECTION))).pipe(
            Effect.mapError(() =>
              ObservabilityCommandError.make({
                path: OBSERVABILITY_STANDARD_PATH,
                message: "Generated section markers are missing.",
              })
            )
          )
        );
    const drifted = A.filter([...written, ...retired], (file) => file.status !== GeneratedFileStatus.Enum.current);
    const interpolated = A.filter(harvested.findings, (finding) => SpanNameFindingKind.is.interpolated(finding.kind));
    const nonLiteral = A.filter(harvested.findings, (finding) => SpanNameFindingKind.is["non-literal"](finding.kind));
    const spans = build.document.spans;
    const conforming = A.length(A.filter(spans, (row) => row.conforms));
    const filesCurrent = !A.some([standard, ...A.map(drifted, (file) => file.status)], isFailingStatus);
    return CatalogRunReport.make({
      mode,
      shards: A.length(shards),
      drifted,
      standard,
      spans: A.length(spans),
      conforming,
      nonConforming: A.length(spans) - conforming,
      families: familySpanCounts(spans),
      attributes: A.length(build.document.attributes),
      declaredInstruments: A.length(build.document.instruments),
      declarationFiles: A.map(files, (file) => file.file),
      interpolated,
      nonLiteral,
      conflicts: build.conflicts,
      ok: filesCurrent && A.isReadonlyArrayEmpty(interpolated) && A.isReadonlyArrayEmpty(build.conflicts),
    });
  });

  return InstrumentationCatalog.of({ harvest, loadDeclarations, run });
});

/**
 * Binds the catalog operations to the checkout that contains the working
 * directory.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { InstrumentationCatalogLive } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(Layer.isLayer(InstrumentationCatalogLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const InstrumentationCatalogLive = Layer.effect(
  InstrumentationCatalog,
  Effect.flatMap(
    findRepoRoot().pipe(Effect.mapError(failure(".", "Failed to find the repository root."))),
    makeInstrumentationCatalog
  )
);
