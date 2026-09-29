/**
 * Import inspection shared by the schema-parity codemod rules and engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { ts } from "ts-morph";
import type { ImportDeclaration, Node, SourceFile } from "ts-morph";

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

/**
 * The symbol a name resolves to at a site.
 *
 * **Details**
 *
 * Resolution walks every enclosing scope (parameters, catch bindings, nested
 * declarations, the module, globals) and every meaning (value, type,
 * namespace), so rules can tell whether a name they are about to emit is free
 * or already bound, and to what.
 *
 * **Example** (Resolve an import binding)
 *
 * ```ts
 * import { resolveSchemaParityCodemodName } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "/a.ts",
 *   'import { Effect } from "effect";\nexport const a = 1;\n'
 * )
 * console.log(O.isSome(resolveSchemaParityCodemodName(sourceFile, "Effect"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveSchemaParityCodemodName: {
  (name: string): (site: Node) => O.Option<ts.Symbol>;
  (site: Node, name: string): O.Option<ts.Symbol>;
} = dual(
  2,
  (site: Node, name: string): O.Option<ts.Symbol> =>
    O.fromNullishOr(
      site.getProject().getTypeChecker().compilerObject.resolveName(name, site.compilerNode, ts.SymbolFlags.All, false)
    )
);

/**
 * Whether a name at a site still resolves to a given declaration.
 *
 * **Details**
 *
 * A parameter, catch binding or nested declaration of the same name shadows
 * an import; rules reuse or rewrite a binding only where it still resolves to
 * the declaration they inspected.
 *
 * **Example** (Check an import is not shadowed)
 *
 * ```ts
 * import { schemaParityCodemodResolvesTo } from "@beep/repo-cli/test/Lint"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "/a.ts",
 *   'import { Effect } from "effect";\nexport const a = 1;\n'
 * )
 * const specifier = sourceFile.getImportDeclarations()[0]?.getNamedImports()[0]
 * console.log(specifier !== undefined && schemaParityCodemodResolvesTo(sourceFile, "Effect", specifier)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodResolvesTo: {
  (name: string, declaration: Node): (site: Node) => boolean;
  (site: Node, name: string, declaration: Node): boolean;
} = dual(3, (site: Node, name: string, declaration: Node): boolean =>
  pipe(
    resolveSchemaParityCodemodName(site, name),
    O.exists((symbol) => A.some(symbol.declarations ?? A.empty(), (node) => node === declaration.compilerNode))
  )
);
