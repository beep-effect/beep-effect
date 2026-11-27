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
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { FsUtils } from "@beep/repo-utils";
import { A, Str, Text, thunkFalse, thunkUndefined } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import type * as Order from "effect/Order";

const $I = $RepoCliId.create("commands/Codegen/Codegen.command");

const TYPE_SCRIPT_SOURCE_FILE_PATTERN = /^.+\.(ts|tsx)$/;
const TYPE_SCRIPT_TEST_FILE_PATTERN = /^.+\.(test|spec)\.(ts|tsx)$/;
const TYPESCRIPT_IMPORT_PATH_PATTERN = /^\.\/.+\.ts$/;
const BARREL_DOC_BLOCK_PATTERN = /\/\*\*(?:(?!\*\/)[\s\S])*\*\//;
const BARREL_DOCUMENTED_EXPORT_PATTERN = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\r?\nexport \* from "([^"]+)";/g;
const BARREL_EXPORT_FOLLOWS_PATTERN = /^\r?\nexport \* from "/;

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

const toImportPath = (name: string): string => {
  if (!isTypeScriptSourceFileName(name)) {
    return `./${name}`;
  }
  return Result.getOrThrow(decodeImportPathResult(name));
};

const alphabetical: Order.Order<string> = Str.orderAsc;

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

          const info = yield* fs.stat(fullPath).pipe(Effect.orElseSucceed(thunkUndefined));
          if (info === undefined) return A.empty<string>();

          if (Str.equivalence(info.type, "Directory")) {
            if (isInternalDirectoryName(entry)) return A.empty<string>();

            return yield* walk(fullPath, `${prefix}${entry}/`);
          }
          if (Str.equivalence(info.type, "File") && isTypeScriptSourceFileName(entry)) {
            if (isTypeScriptTestFileName(entry)) return A.empty<string>();

            if (Str.isEmpty(prefix) && isRootIndexFileName(entry)) return A.empty<string>();

            return A.of(`${prefix}${entry}`);
          }

          return A.empty<string>();
        }),
        { concurrency: 1 }
      );

      return A.flatten(discovered);
    });

  return yield* walk(srcDir, Str.empty);
});

const emptyBarrelDocs = (): HashMap.HashMap<string, string> => HashMap.empty<string, string>();

const parseBarrelHeader = (content: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(BARREL_DOC_BLOCK_PATTERN.exec(content)),
    O.filter((match) => !BARREL_EXPORT_FOLLOWS_PATTERN.test(Str.slice(match.index + Str.length(match[0]))(content))),
    O.map((match) => match[0])
  );

const parseBarrelDocs = (content: string): HashMap.HashMap<string, string> => {
  let docs = emptyBarrelDocs();
  for (const match of Str.matchAll(BARREL_DOCUMENTED_EXPORT_PATTERN)(content)) {
    const block = match[1];
    const importPath = match[2];
    if (block !== undefined && importPath !== undefined) {
      docs = HashMap.set(docs, importPath, block);
    }
  }
  return docs;
};

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

    const packageDir = pathSvc.isAbsolute(config.packageDir) ? config.packageDir : pathSvc.resolve(config.packageDir);

    const srcDir = pathSvc.join(packageDir, "src");

    const srcExists = yield* fs.exists(srcDir).pipe(Effect.orElseSucceed(thunkFalse));
    if (!srcExists) {
      yield* Console.error(`Error: No src/ directory found at ${srcDir}`);
      return;
    }

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

    const rawModules = yield* discoverModules(srcDir);

    const modules = A.sort(rawModules, alphabetical);

    const hasModules = yield* A.match(modules, {
      onEmpty: () => Console.log("No modules found to export.").pipe(Effect.as(false)),
      onNonEmpty: () => Effect.succeed(true),
    });
    if (!hasModules) {
      return;
    }

    yield* Console.log(`Found ${A.length(modules)} module(s):`);
    yield* Effect.forEach(modules, (mod) => Console.log(`  - ${mod}`), { concurrency: 1, discard: true });

    const indexPath = pathSvc.join(srcDir, "index.ts");

    const previous = yield* fs.readFileString(indexPath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));

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
 * **Details**
 *
 * `barrel` scans the package's `src/` for `.ts` and `.tsx` modules, skipping the
 * root `index.ts`, `internal/` directories and test files, and writes `index.ts`
 * with one `export * from "./<path>.ts"` per module in alphabetical order (a
 * `.tsx` module is imported as `.ts`), each under a `@since 0.0.0` block.
 * `--dry-run` prints the file instead.
 *
 * **Gotchas**
 *
 * Documentation in the committed barrel survives regeneration. A JSDoc block on
 * the line directly above an `export *` stays with that export. The first block
 * is the module header unless an export sits on its next line, so a header
 * needs a blank line before the first export or it is read as that export's
 * documentation.
 *
 * **Example** (Build the codegen command runner)
 *
 * ```ts
 * import { codegenCommand } from "@beep/repo-cli/commands/Codegen"
 * import * as Command from "effect/cli/Command";
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
