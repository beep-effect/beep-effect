/**
 * S1 mechanical rewrites over a copied module: root `effect` imports become
 * per-module imports (namespace imports for modules, `effect/Function` for
 * the combinators), with the repo's `A/O/P/R/S` aliases where they do not
 * collide with an existing identifier.
 *
 * **Details**
 *
 * Aliasing renames every reference through the TypeScript language service
 * before the import is rewritten, so the local name and its uses always
 * agree. A file that already declares the alias name (a generic `S`, a local
 * `A`) keeps the long namespace name and is reported for a manual pass; the
 * codemod never shadows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ModuleKind, ModuleResolutionKind, Project, ScriptTarget, SyntaxKind, ts } from "ts-morph";
import { listTsFiles } from "./Copy.ts";
import type { AuditTarget } from "./Ledger.schema.ts";
import { labPaths, type RunnerConfig } from "./Paths.ts";
import type { ImportDeclaration, SourceFile } from "ts-morph";

const $I = $ScratchpadId.create("effected/runner/Codemod");

/**
 * The repo's namespace aliases for Effect data modules (effect law 1).
 *
 * **Example** (Look up an alias)
 *
 * ```ts
 * import { NAMESPACE_ALIASES } from "@beep/scratchpad/effected/runner/Codemod"
 * import * as HashMap from "effect/HashMap"
 *
 * console.log(HashMap.get(NAMESPACE_ALIASES, "Schema")) // some("S")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NAMESPACE_ALIASES: HashMap.HashMap<string, string> = HashMap.make(
  ["Array", "A"],
  ["Option", "O"],
  ["Predicate", "P"],
  ["Record", "R"],
  ["Schema", "S"]
);

/**
 * Root `effect` names that come from `effect/Function` rather than a module
 * namespace.
 *
 * **Example** (Check a combinator)
 *
 * ```ts
 * import { FUNCTION_EXPORTS } from "@beep/scratchpad/effected/runner/Codemod"
 *
 * console.log(FUNCTION_EXPORTS.includes("pipe")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FUNCTION_EXPORTS = ["absurd", "cast", "flow", "hole", "identity", "pipe"] as const;

const isFunctionExport = (name: string): boolean => A.some(FUNCTION_EXPORTS, (candidate) => candidate === name);

/**
 * What the import codemod did to one file.
 *
 * **Example** (Describe a rewrite)
 *
 * ```ts
 * import { ImportRewrite } from "@beep/scratchpad/effected/runner/Codemod"
 *
 * const rewrite = ImportRewrite.make({ file: "a.ts", rewritten: 1, aliased: ["Schema->S"], collisions: [], unknown: [] })
 * console.log(rewrite.rewritten) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImportRewrite extends S.Class<ImportRewrite>($I`ImportRewrite`)(
  {
    file: S.String,
    rewritten: S.Int,
    aliased: S.Array(S.String),
    collisions: S.Array(S.String),
    unknown: S.Array(S.String),
  },
  $I.annote("ImportRewrite", { description: "Root effect imports rewritten, aliased, or left for review in one file." })
) {}

const makeProject = (): Project =>
  new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowImportingTsExtensions: true,
      moduleResolution: ModuleResolutionKind.Bundler,
      module: ModuleKind.ESNext,
      target: ScriptTarget.ESNext,
      noEmit: true,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });

const declaredNames = (sourceFile: SourceFile, exclude: ImportDeclaration): MutableHashSet.MutableHashSet<string> => {
  const names = MutableHashSet.empty<string>();
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) !== exclude) {
      MutableHashSet.add(names, identifier.getText());
    }
  }
  return names;
};

interface PlannedImport {
  readonly specifier: string;
  readonly text: string;
}

/**
 * Rewrites the root `effect` imports of one source file in place and returns
 * what changed; the caller saves the file.
 *
 * **Example** (Rewrite an in-memory file)
 *
 * ```ts
 * import { rewriteRootImports } from "@beep/scratchpad/effected/runner/Codemod"
 * import { Project } from "ts-morph"
 *
 * const file = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "a.ts",
 *   'import { Effect, Schema, pipe } from "effect";\nexport const x = pipe(Schema.String, Schema.is);\nexport const y = Effect.void;\n'
 * )
 * const rewrite = rewriteRootImports(file)
 * console.log(rewrite.aliased) // ["Schema->S"]
 * console.log(file.getFullText().includes('import * as S from "effect/Schema";')) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rewriteRootImports = (sourceFile: SourceFile): ImportRewrite => {
  const aliased: Array<string> = [];
  const collisions: Array<string> = [];
  const unknown: Array<string> = [];
  let rewritten = 0;
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== "effect") continue;
    if (declaration.getNamespaceImport() !== undefined || declaration.getDefaultImport() !== undefined) {
      unknown.push(declaration.getText());
      continue;
    }
    const declarationTypeOnly = declaration.isTypeOnly();
    const planned: Array<PlannedImport> = [];
    const functionNames: Array<{ readonly text: string; readonly typeOnly: boolean }> = [];
    for (const specifier of declaration.getNamedImports()) {
      const name = specifier.getName();
      const alias = specifier.getAliasNode()?.getText();
      const typeOnly = declarationTypeOnly || specifier.isTypeOnly();
      if (isFunctionExport(name)) {
        functionNames.push({ text: alias === undefined ? name : `${name} as ${alias}`, typeOnly });
        continue;
      }
      let local = alias ?? name;
      const preferred = HashMap.get(NAMESPACE_ALIASES, name);
      if (alias === undefined && O.isSome(preferred)) {
        if (MutableHashSet.has(declaredNames(sourceFile, declaration), preferred.value)) {
          collisions.push(`${name}->${preferred.value}`);
        } else {
          specifier.renameAlias(preferred.value);
          local = preferred.value;
          aliased.push(`${name}->${preferred.value}`);
        }
      }
      planned.push({
        specifier: `effect/${name}`,
        text: `import ${typeOnly ? "type " : ""}* as ${local} from "effect/${name}";`,
      });
    }
    const valueFunctions = A.filter(functionNames, (entry) => !entry.typeOnly);
    const typeFunctions = A.filter(functionNames, (entry) => entry.typeOnly);
    const functionImports = [
      ...(A.isReadonlyArrayNonEmpty(valueFunctions)
        ? [`import { ${A.join(A.map(valueFunctions, (entry) => entry.text), ", ")} } from "effect/Function";`]
        : []),
      ...(A.isReadonlyArrayNonEmpty(typeFunctions)
        ? [`import type { ${A.join(A.map(typeFunctions, (entry) => entry.text), ", ")} } from "effect/Function";`]
        : []),
    ];
    const replacement = A.join([...A.map(planned, (entry) => entry.text), ...functionImports], "\n");
    declaration.replaceWithText(replacement);
    rewritten += 1;
  }
  return ImportRewrite.make({ file: sourceFile.getFilePath(), rewritten, aliased, collisions, unknown });
};

/**
 * Applies {@link rewriteRootImports} to every TypeScript file a target owns
 * (source and tests) and saves the changed files.
 *
 * **Example** (Rewrite a module's imports)
 *
 * ```ts
 * import { codemodImports } from "@beep/scratchpad/effected/runner/Codemod"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(codemodImports(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "glob"))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const codemodImports = Effect.fn("Codemod.imports")(function* (config: RunnerConfig, target: AuditTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lab = labPaths(target);
  const files = [
    ...(yield* listTsFiles(config.repoRoot, lab.sourceDir)),
    ...(yield* listTsFiles(config.repoRoot, lab.testDir)),
  ];
  const project = makeProject();
  const rewrites: Array<ImportRewrite> = [];
  for (const file of files) {
    const absolute = path.join(config.repoRoot, file);
    const text = yield* fs.readFileString(absolute);
    if (!Str.includes('from "effect"')(text) && !Str.includes("from 'effect'")(text)) continue;
    const sourceFile = project.createSourceFile(absolute, text, { overwrite: true });
    const rewrite = rewriteRootImports(sourceFile);
    if (rewrite.rewritten > 0) {
      yield* fs.writeFileString(absolute, sourceFile.getFullText());
      rewrites.push(ImportRewrite.make({ ...rewrite, file }));
    }
  }
  return rewrites;
});
