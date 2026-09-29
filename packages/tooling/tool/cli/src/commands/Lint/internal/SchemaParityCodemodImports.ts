/**
 * Import inspection shared by the schema-parity codemod rules and engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { dual } from "effect/Function";
import type { ImportDeclaration, SourceFile } from "ts-morph";

/**
 * Value (non type-only) import declarations of one module specifier.
 *
 * **Details**
 *
 * Rules read these to reuse an existing alias before planning a new import,
 * and the engine reads them to avoid adding an import the file already has.
 *
 * **Example** (Find value imports of effect)
 *
 * ```ts
 * import { schemaParityCodemodValueImports } from "@beep/repo-cli/test/Lint"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "/a.ts",
 *   'import { Effect } from "effect";\nimport type { Layer } from "effect";\n'
 * )
 * console.log(schemaParityCodemodValueImports(sourceFile, "effect").length) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodValueImports: {
  (moduleSpecifier: string): (sourceFile: SourceFile) => ReadonlyArray<ImportDeclaration>;
  (sourceFile: SourceFile, moduleSpecifier: string): ReadonlyArray<ImportDeclaration>;
} = dual(
  2,
  (sourceFile: SourceFile, moduleSpecifier: string): ReadonlyArray<ImportDeclaration> =>
    A.filter(
      sourceFile.getImportDeclarations(),
      (declaration) => !declaration.isTypeOnly() && declaration.getModuleSpecifierValue() === moduleSpecifier
    )
);
