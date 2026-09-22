/**
 * Code generation command - generate barrel file exports for packages.
 *
 * Scans a package's `src/` directory for TypeScript modules and generates
 * an `index.ts` barrel file with `export *` re-exports, each annotated
 * with `@since 0.0.0` JSDoc tags as required by `@beep/repo-docgen`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { FsUtils } from "@beep/repo-utils";
import { A, Str, Text, thunkFalse, thunkUndefined } from "@beep/utils";
import { Console, Effect, FileSystem, HashMap, Path, pipe, Result, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import type { Order } from "effect";

const $I = $RepoCliId.create("commands/Codegen/Codegen.command");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * File extensions recognised as TypeScript source modules during barrel generation.
 *
 * **Example** (Log TS extensions label)
 *
 * ```ts
 * console.log("TS_EXTENSIONS")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const TYPE_SCRIPT_SOURCE_FILE_PATTERN = /^.+\.(ts|tsx)$/;
const TYPE_SCRIPT_TEST_FILE_PATTERN = /^.+\.(test|spec)\.(ts|tsx)$/;
const TYPESCRIPT_IMPORT_PATH_PATTERN = /^\.\/.+\.ts$/;
// `(?!\*\/)` keeps a block from swallowing the comment that follows it: a lazy
// `[\s\S]*?` would happily span from the module header to the first documented export.
const BARREL_DOC_BLOCK_PATTERN = /\/\*\*(?:(?!\*\/)[\s\S])*\*\//;
const BARREL_DOCUMENTED_EXPORT_PATTERN = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\r?\nexport \* from "([^"]+)";/g;
const BARREL_EXPORT_FOLLOWS_PATTERN = /^\s*export \* from "/;

const TypeScriptSourceFileName = S.String.check(S.isPattern(TYPE_SCRIPT_SOURCE_FILE_PATTERN)).pipe(
  S.brand("TypeScriptSourceFileName"),
  $I.annoteSchema("TypeScriptSourceFileName", {
    description: "TypeScript source filename ending with .ts or .tsx.",
  })
);
const decodeTypeScriptSourceFileNameResult = S.decodeUnknownResult(TypeScriptSourceFileName);

const TypeScriptTestFileName = S.String.check(S.isPattern(TYPE_SCRIPT_TEST_FILE_PATTERN)).pipe(
  S.brand("TypeScriptTestFileName"),
  $I.annoteSchema("TypeScriptTestFileName", {
    description: "TypeScript test filename ending with .test.ts[x] or .spec.ts[x].",
  })
);

const TypeScriptImportPath = S.String.check(S.isPattern(TYPESCRIPT_IMPORT_PATH_PATTERN)).pipe(
  $I.annoteSchema("TypeScriptImportPath", {
    description: "Relative TypeScript import path using the repository's uniform .ts source specifier.",
  })
);

const TypeScriptSourceToImportPath = TypeScriptSourceFileName.pipe(
  S.decodeTo(
    TypeScriptImportPath,
    SchemaTransformation.transform({
      decode: (fileName) => `./${pipe(fileName, Str.replace(/\.tsx?$/, ".ts"))}`,
      encode: (importPath) =>
        Result.getOrThrow(decodeTypeScriptSourceFileNameResult(pipe(importPath, Str.replace(/^\.\/(.*)$/, "$1")))),
    })
  ),
  $I.annoteSchema("TypeScriptSourceToImportPath", {
    description: "Schema transformation from a TypeScript module filename to its matching source import path.",
  })
);

const InternalDirectoryName = S.Literal("internal").pipe(
  $I.annoteSchema("InternalDirectoryName", {
    description: "Directory name excluded from barrel generation.",
  })
);

const RootIndexFileName = S.Literal("index.ts").pipe(
  $I.annoteSchema("RootIndexFileName", {
    description: "Root index module excluded from generated barrel inputs.",
  })
);

const isTypeScriptSourceFileName = S.is(TypeScriptSourceFileName);
const isTypeScriptTestFileName = S.is(TypeScriptTestFileName);
const isInternalDirectoryName = S.is(InternalDirectoryName);
const isRootIndexFileName = S.is(RootIndexFileName);
const decodeImportPathResult = S.decodeUnknownResult(TypeScriptSourceToImportPath);

/**
 * Convert a TypeScript filename to its corresponding source import specifier.
 *
 * **Details**
 *
 * Uses the repository's uniform `.ts` source specifier and prepends `./` so the
 * result is a valid relative import path (e.g. `"View.tsx"` becomes `"./View.ts"`).
 *
 * **Example** (Log toImportPath label)
 *
 * ```ts
 * console.log("toImportPath")
 * ```
 *
 * @param name - The TypeScript filename (may include a sub-path prefix).
 * @returns A relative import specifier with the uniform `.ts` source extension.
 * @category utilities
 * @since 0.0.0
 */
const toImportPath = (name: string): string => {
  if (!isTypeScriptSourceFileName(name)) {
    return `./${name}`;
  }
  return Result.getOrThrow(decodeImportPathResult(name));
};

/**
 * Alphabetical `Order` instance used to sort discovered module paths deterministically
 * before emitting barrel re-exports.
 *
 * **Example** (Log alphabetical order label)
 *
 * ```ts
 * console.log("alphabetical")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const alphabetical: Order.Order<string> = Str.orderAsc;

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Recursively discover exportable TypeScript modules under `srcDir`.
 *
 * **Details**
 *
 * Returns relative paths from `srcDir` (e.g. `"FsUtils.ts"`, `"errors/index.ts"`).
 * Skips `index.ts` at the root level, `internal/` directories, and test files.
 *
 * **Example** (Log discoverModules label)
 *
 * ```ts
 * console.log("discoverModules")
 * ```
 *
 * @param srcDir - Absolute path to the `src/` directory to scan.
 * @returns An unsorted array of relative file paths suitable for barrel re-export.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
const discoverModules = Effect.fn(function* (srcDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const walk: (dir: string, prefix: string) => Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =
    Effect.fn(function* (dir, prefix) {
      const entries = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(A.empty<string>));

      const discovered = yield* Effect.forEach(
        entries,
        Effect.fnUntraced(function* (entry) {
          const fullPath = path.join(dir, entry);

          // Check if this entry is a directory
          const info = yield* fs.stat(fullPath).pipe(Effect.orElseSucceed(thunkUndefined));
          if (info === undefined) return A.empty<string>();

          if (Str.equivalence(info.type, "Directory")) {
            // Skip internal directories
            if (isInternalDirectoryName(entry)) return A.empty<string>();

            // Recurse into subdirectories
            return yield* walk(fullPath, `${prefix}${entry}/`);
          }
          if (Str.equivalence(info.type, "File") && isTypeScriptSourceFileName(entry)) {
            // Skip test files
            if (isTypeScriptTestFileName(entry)) return A.empty<string>();

            // Skip root-level index.ts (that's what we're generating)
            if (Str.isEmpty(prefix) && isRootIndexFileName(entry)) return A.empty<string>();

            return A.of(`${prefix}${entry}`);
          }

          return A.empty<string>();
        })
      );

      return A.flatten(discovered);
    });

  return yield* walk(srcDir, Str.empty);
});

/**
 * Empty preserved-documentation map used when no previous barrel exists.
 *
 * **Example** (Log emptyBarrelDocs label)
 *
 * ```ts
 * console.log("emptyBarrelDocs")
 * ```
 *
 * @returns An empty import-path to JSDoc-block map.
 * @category utilities
 * @since 0.0.0
 */
const emptyBarrelDocs = (): HashMap.HashMap<string, string> => HashMap.empty<string, string>();

/**
 * Read the module-level JSDoc header from a previously generated barrel.
 *
 * **Details**
 *
 * The header is the file's first JSDoc block when it is not the block documenting
 * the first `export *` statement. A barrel whose first block sits directly above an
 * export has no separate header, so the caller falls back to the generated default.
 *
 * **Example** (Log parseBarrelHeader label)
 *
 * ```ts
 * console.log("parseBarrelHeader")
 * ```
 *
 * @param content - Contents of the existing `index.ts` barrel.
 * @returns The header block when the barrel declares one.
 * @category utilities
 * @since 0.0.0
 */
const parseBarrelHeader = (content: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(BARREL_DOC_BLOCK_PATTERN.exec(content)),
    O.filter((match) => !BARREL_EXPORT_FOLLOWS_PATTERN.test(Str.slice(content, match.index + Str.length(match[0])))),
    O.map((match) => match[0])
  );

/**
 * Index a previously generated barrel's per-export JSDoc blocks by import path.
 *
 * **Details**
 *
 * Regeneration is otherwise lossy: hand-authored `**Example**` sections on barrel
 * re-exports are required by the repository's JSDoc law and are exercised by docgen,
 * so they must survive a `beep codegen barrel` run.
 *
 * **Example** (Log parseBarrelDocs label)
 *
 * ```ts
 * console.log("parseBarrelDocs")
 * ```
 *
 * @param content - Contents of the existing `index.ts` barrel.
 * @returns A map from import specifier to the JSDoc block documenting it.
 * @category utilities
 * @since 0.0.0
 */
const parseBarrelDocs = (content: string): HashMap.HashMap<string, string> => {
  let docs = emptyBarrelDocs();
  for (const match of content.matchAll(BARREL_DOCUMENTED_EXPORT_PATTERN)) {
    const block = match[1];
    const importPath = match[2];
    if (block !== undefined && importPath !== undefined) {
      docs = HashMap.set(docs, importPath, block);
    }
  }
  return docs;
};

/**
 * Build the barrel file content from a sorted list of module relative paths.
 *
 * **Details**
 *
 * Produces a string containing a JSDoc header and one `export * from ...` statement
 * per module, each annotated with `@since 0.0.0` as required by `@beep/repo-docgen`.
 *
 * **Gotchas**
 *
 * Documentation already present in `previous` wins over the generated defaults, so a
 * regeneration normalises ordering and spacing without discarding authored prose.
 *
 * **Example** (Log buildBarrelContent label)
 *
 * ```ts
 * console.log("buildBarrelContent")
 * ```
 *
 * @param packageName - Used in the module description header comment.
 * @param modules - Sorted list of relative file paths (e.g. `"FsUtils.ts"`).
 * @param previous - Contents of the existing barrel, when one is already committed.
 * @returns The full content of the generated `index.ts` barrel file.
 * @category utilities
 * @since 0.0.0
 */
const buildBarrelContent = (
  packageName: string,
  modules: ReadonlyArray<string>,
  previous: O.Option<string>
): string => {
  const header = pipe(
    previous,
    O.flatMap(parseBarrelHeader),
    O.getOrElse(() =>
      pipe(A.make("/**", ` * Re-exports for ${packageName}.`, " *", " * @since 0.0.0", " */"), Text.joinLines)
    )
  );

  const preservedDocs = pipe(previous, O.match({ onNone: emptyBarrelDocs, onSome: parseBarrelDocs }));
  const defaultDoc = pipe(A.make("/**", " * @since 0.0.0", " */"), Text.joinLines);

  const exportLines = A.map(modules, (mod) => {
    const importPath = toImportPath(mod);
    const doc = pipe(
      HashMap.get(preservedDocs, importPath),
      O.getOrElse(() => defaultDoc)
    );
    return `${doc}\nexport * from "${importPath}";`;
  });

  return `${header}\n${A.join(exportLines, "\n\n")}\n`;
};

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

/**
 * CLI command that scans a package's `src/` directory and generates (or previews)
 * an `index.ts` barrel file with `export *` re-exports for every discovered module.
 *
 * **Example** (Log codegenCommand label)
 *
 * ```ts
 * console.log("codegenCommand")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const barrelCommand = Command.make(
  "barrel",
  {
    packageDir: Flag.String("package").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Package directory to generate barrel exports for"),
      Flag.withDefault(".")
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Preview changes without writing files")
    ),
  },
  Effect.fn(function* (config) {
    const fs = yield* FileSystem.FileSystem;
    const pathSvc = yield* Path.Path;
    const fsUtils = yield* FsUtils;

    // Resolve absolute path to the package
    const packageDir = pathSvc.isAbsolute(config.packageDir) ? config.packageDir : pathSvc.resolve(config.packageDir);

    const srcDir = pathSvc.join(packageDir, "src");

    // Verify src/ exists
    const srcExists = yield* fs.exists(srcDir).pipe(Effect.orElseSucceed(thunkFalse));
    if (!srcExists) {
      yield* Console.error(`Error: No src/ directory found at ${srcDir}`);
      return;
    }

    // Read package.json to extract the package name for the header
    const packageJsonPath = pathSvc.join(packageDir, "package.json");
    const packageJson = yield* fsUtils.readJson(packageJsonPath).pipe(Effect.orElseSucceed(O.none));
    const packageName =
      O.isSome(packageJson) &&
      P.isObject(packageJson.value) &&
      P.isNotNull(packageJson.value) &&
      P.hasProperty(packageJson.value, "name") &&
      P.Struct({
        name: P.isString,
      })(packageJson.value)
        ? packageJson.value.name
        : pathSvc.basename(packageDir);

    yield* Console.log(`Scanning ${srcDir} for modules...`);

    // Discover modules
    const rawModules = yield* discoverModules(srcDir);

    // Sort alphabetically for determinism
    const modules = A.sort(rawModules, alphabetical);

    const hasModules = yield* A.match(modules, {
      onEmpty: () => Console.log("No modules found to export.").pipe(Effect.as(false)),
      onNonEmpty: () => Effect.succeed(true),
    });
    if (!hasModules) {
      return;
    }

    yield* Console.log(`Found ${A.length(modules)} module(s):`);
    yield* Effect.forEach(modules, (mod) => Console.log(`  - ${mod}`), { discard: true });

    const indexPath = pathSvc.join(srcDir, "index.ts");

    // Preserve documentation already authored on the committed barrel.
    const previous = yield* fs.readFileString(indexPath).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));

    // Generate barrel content
    const content = buildBarrelContent(packageName, modules, previous);

    if (config.dryRun) {
      yield* printLines([
        "",
        "--- Dry run: would generate the following ---",
        `File: ${indexPath}`,
        "---",
        content,
        "--- End dry run ---",
      ]);
    } else {
      yield* fs.writeFileString(indexPath, content);
      yield* printLines(["", `Wrote ${indexPath}`]);
    }
  })
).pipe(Command.withDescription("Generate barrel file exports for a package"));

/**
 * Groups code generators under explicit subcommands.
 *
 * **Example** (Build the codegen command runner)
 *
 * ```ts
 * import { codegenCommand } from "@beep/repo-cli/commands/Codegen"
 * import { Command } from "effect/unstable/cli"
 *
 * const run = Command.runWith(codegenCommand, { version: "0.0.0" })
 * const preview = run(["barrel", "--package", "packages/foundation/modeling/identity", "--dry-run"])
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const codegenCommand = Command.make("codegen").pipe(
  Command.withDescription("Run a code generator"),
  Command.withSubcommands([barrelCommand])
);
