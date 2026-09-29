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
 * The symbol `name` resolves to at `site`.
 *
 * **Details**
 *
 * Resolution walks every enclosing scope (parameters, catch bindings, nested
 * declarations, the module, globals) and every meaning (value, type,
 * namespace), so a rule can tell whether a name it wants to introduce or reuse
 * is shadowed at the site it edits.
 *
 * **Example** (Resolve a parameter)
 *
 * ```ts
 * import { resolveSchemaParityCodemodName } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile("/a.ts", "export const f = (S: number) => S;\n")
 * const body = sourceFile.getFirstDescendantByKindOrThrow(SyntaxKind.ArrowFunction).getBody()
 * console.log(O.isSome(resolveSchemaParityCodemodName(body, "S"))) // true
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
 * Whether `name` resolves to `declaration` at `site`.
 *
 * **Example** (Check an unshadowed import)
 *
 * ```ts
 * import { schemaParityCodemodNameResolvesTo } from "@beep/repo-cli/test/Lint"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "/a.ts",
 *   'import * as S from "effect/Schema";\nexport const x = S;\n'
 * )
 * const declaration = sourceFile.getImportDeclarations()[0].getImportClauseOrThrow().getNamespaceImportOrThrow().getParentOrThrow()
 * console.log(schemaParityCodemodNameResolvesTo(sourceFile.getVariableDeclarationOrThrow("x"), "S", declaration)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodNameResolvesTo: {
  (name: string, declaration: Node): (site: Node) => boolean;
  (site: Node, name: string, declaration: Node): boolean;
} = dual(3, (site: Node, name: string, declaration: Node): boolean =>
  pipe(
    resolveSchemaParityCodemodName(site, name),
    O.exists((symbol) => A.some(symbol.declarations ?? A.empty(), (node) => node === declaration.compilerNode))
  )
);

/**
 * The local name and declaration of a value namespace import of a module.
 *
 * **Example** (Find the Schema namespace)
 *
 * ```ts
 * import { schemaParityCodemodNamespaceBinding } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile("/a.ts", 'import * as Schema from "effect/Schema";\n')
 * const binding = schemaParityCodemodNamespaceBinding(sourceFile, "effect/Schema")
 * console.log(O.map(binding, (entry) => entry.local)) // Some("Schema")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodNamespaceBinding: {
  (
    moduleSpecifier: string
  ): (sourceFile: SourceFile) => O.Option<{ readonly local: string; readonly declaration: Node }>;
  (sourceFile: SourceFile, moduleSpecifier: string): O.Option<{ readonly local: string; readonly declaration: Node }>;
} = dual(
  2,
  (sourceFile: SourceFile, moduleSpecifier: string): O.Option<{ readonly local: string; readonly declaration: Node }> =>
    A.findFirst(schemaParityCodemodValueImports(sourceFile, moduleSpecifier), (declaration) =>
      pipe(
        O.fromNullishOr(declaration.getNamespaceImport()),
        O.flatMap((name) =>
          O.map(O.fromNullishOr(name.getParent()), (node) => ({ local: name.getText(), declaration: node }))
        )
      )
    )
);

/**
 * The local name and specifier of a value named import of a module.
 *
 * **Details**
 *
 * Type-only specifiers never match; an aliased specifier reports its alias as
 * the local name.
 *
 * **Example** (Find an aliased named import)
 *
 * ```ts
 * import { schemaParityCodemodNamedValueBinding } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile("/a.ts", 'import { Schema as S } from "effect";\n')
 * console.log(O.map(schemaParityCodemodNamedValueBinding(sourceFile, "effect", "Schema"), (entry) => entry.local)) // Some("S")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodNamedValueBinding: {
  (
    moduleSpecifier: string,
    name: string
  ): (sourceFile: SourceFile) => O.Option<{ readonly local: string; readonly declaration: Node }>;
  (
    sourceFile: SourceFile,
    moduleSpecifier: string,
    name: string
  ): O.Option<{ readonly local: string; readonly declaration: Node }>;
} = dual(
  3,
  (
    sourceFile: SourceFile,
    moduleSpecifier: string,
    name: string
  ): O.Option<{ readonly local: string; readonly declaration: Node }> =>
    A.findFirst(schemaParityCodemodValueImports(sourceFile, moduleSpecifier), (declaration) =>
      A.findFirst(declaration.getNamedImports(), (specifier) =>
        !specifier.isTypeOnly() && specifier.getName() === name
          ? O.some({
              local: pipe(
                O.fromNullishOr(specifier.getAliasNode()),
                O.map((node) => node.getText()),
                O.getOrElse(() => name)
              ),
              declaration: specifier,
            })
          : O.none()
      )
    )
);
