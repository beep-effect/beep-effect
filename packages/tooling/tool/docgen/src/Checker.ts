/**
 * Validation helpers for parsed docgen modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { codeFrameColumns } from "@babel/code-frame";
import { $RepoDocgenId } from "@beep/identity";
import * as A from "@beep/utils/Array";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import * as Configuration from "./Configuration.ts";
import * as Domain from "./Domain.ts";
import * as Parser from "./Parser.ts";

const $I = $RepoDocgenId.create("Checker");
const titledExampleSection = /\*\*Example\*\*\s*\([^)]+\)[\s\S]*?```(?:ts|tsx|typescript)\b/u;

const hasDocumentedExample = (doc: Domain.Doc): boolean =>
  doc.examples.length > 0 || (doc.description !== undefined && titledExampleSection.test(doc.description));

const makeError = (
  source: Parser.SourceShape,
  position: Domain.Position,
  message: (filePath: string, frame: string) => string
) => {
  const frame = codeFrameColumns(source.sourceFile.getFullText(), {
    start: {
      line: position.line,
      column: position.column - 1,
    },
  });
  return [message(source.sourceFile.getFilePath(), frame)];
};

class Entry extends S.Class<Entry>($I`Entry`)(
  {
    doc: Domain.Doc,
    position: Domain.Position,
  },
  $I.annote("Entry", {
    description: "Represents a documentation entry with associated position information",
  })
) {}

const checkEntry = Effect.fn("checkEntry")(function* (
  model: Entry,
  options: {
    readonly enforceExample: boolean;
    readonly enforceVersion: boolean;
  }
) {
  const source = yield* Parser.Source;
  const config = yield* Configuration.Configuration;
  let errors = A.empty<string>();

  if (config.enforceDescriptions && model.doc.description === undefined) {
    errors = A.appendAll(
      errors,
      makeError(source, model.position, (filePath, frame) => `Missing description in file ${filePath}:\n\n${frame}`)
    );
  }

  if (config.enforceExamples && options.enforceExample && !hasDocumentedExample(model.doc)) {
    errors = A.appendAll(
      errors,
      makeError(source, model.position, (filePath, frame) => `Missing examples in file ${filePath}:\n\n${frame}`)
    );
  }

  if (config.enforceVersion && options.enforceVersion && model.doc.since.length === 0) {
    errors = A.appendAll(
      errors,
      makeError(source, model.position, (filePath, frame) => `Missing \`@since\` tag in file ${filePath}:\n\n${frame}`)
    );
  }

  return errors;
});

function checkEntries(
  models: ReadonlyArray<Entry>,
  options: {
    readonly enforceExample: boolean;
    readonly enforceVersion: boolean;
  }
) {
  return Effect.forEach(models, (model) => checkEntry(model, options)).pipe(Effect.map(A.flatten));
}

function checkFunction(model: Domain.Function) {
  return checkEntry(model, { enforceExample: true, enforceVersion: true });
}

/**
 * Checks documented functions for required docgen annotations.
 *
 * **Example** (Check empty function models)
 *
 * ```ts
 * import { checkFunctions } from "@beep/repo-docgen/Checker"
 * const checked = checkFunctions([])
 * console.log(checked)
 * ```
 *
 * @param models - Function models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkFunctions(models: ReadonlyArray<Domain.Function>) {
  return Effect.forEach(models, checkFunction).pipe(Effect.map(A.flatten));
}

const checkClass = Effect.fn("checkClass")(function* (model: Domain.Class) {
  const docErrors = yield* checkEntry(model, { enforceExample: true, enforceVersion: true });
  const staticMethodsErrors = yield* checkEntries(model.staticMethods, { enforceExample: true, enforceVersion: false });
  const methodsErrors = yield* checkEntries(model.methods, { enforceExample: true, enforceVersion: false });
  const propertiesErrors = yield* checkEntries(model.properties, { enforceExample: true, enforceVersion: false });
  return A.flatten([docErrors, staticMethodsErrors, methodsErrors, propertiesErrors]);
});

/**
 * Checks documented classes and their members for required docgen annotations.
 *
 * **Example** (Check empty class models)
 *
 * ```ts
 * import { checkClasses } from "@beep/repo-docgen/Checker"
 * const checked = checkClasses([])
 * console.log(checked)
 * ```
 *
 * @param models - Class models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkClasses(models: ReadonlyArray<Domain.Class>) {
  return Effect.forEach(models, checkClass).pipe(Effect.map(A.flatten));
}

function checkConstant(model: Domain.Constant) {
  return checkEntry(model, { enforceExample: true, enforceVersion: true });
}

/**
 * Checks documented constants for required docgen annotations.
 *
 * **Example** (Check empty constant models)
 *
 * ```ts
 * import { checkConstants } from "@beep/repo-docgen/Checker"
 * const checked = checkConstants([])
 * console.log(checked)
 * ```
 *
 * @param models - Constant models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkConstants(models: ReadonlyArray<Domain.Constant>) {
  return Effect.forEach(models, checkConstant).pipe(Effect.map(A.flatten));
}

function checkInterface(model: Domain.Interface) {
  return checkEntry(model, { enforceExample: false, enforceVersion: true });
}

/**
 * Checks documented interfaces for required docgen annotations.
 *
 * **Example** (Check empty interface models)
 *
 * ```ts
 * import { checkInterfaces } from "@beep/repo-docgen/Checker"
 * const checked = checkInterfaces([])
 * console.log(checked)
 * ```
 *
 * @param models - Interface models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkInterfaces(models: ReadonlyArray<Domain.Interface>) {
  return Effect.forEach(models, checkInterface).pipe(Effect.map(A.flatten));
}

function checkTypeAlias(model: Domain.TypeAlias) {
  return checkEntry(model, { enforceExample: false, enforceVersion: true });
}

/**
 * Checks documented type aliases for required docgen annotations.
 *
 * **Example** (Check empty type aliases)
 *
 * ```ts
 * import { checkTypeAliases } from "@beep/repo-docgen/Checker"
 * const checked = checkTypeAliases([])
 * console.log(checked)
 * ```
 *
 * @param models - Type alias models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkTypeAliases(models: ReadonlyArray<Domain.TypeAlias>) {
  return Effect.forEach(models, checkTypeAlias).pipe(Effect.map(A.flatten));
}

const checkNamespace = Effect.fn("checkNamespace")(function* (
  model: Domain.Namespace
): Effect.fn.Return<Array<string>, never, Parser.Source | Configuration.Configuration> {
  const docErrors = yield* checkEntry(model, { enforceExample: false, enforceVersion: true });
  const interfacesErrors = yield* checkInterfaces(model.interfaces);
  const typeAliasesErrors = yield* checkTypeAliases(model.typeAliases);
  const namespacesErrors = yield* checkNamespaces(model.namespaces);
  return A.flatten([docErrors, interfacesErrors, typeAliasesErrors, namespacesErrors]);
});

/**
 * Checks documented namespaces and their nested members for required docgen annotations.
 *
 * **Example** (Check empty namespace models)
 *
 * ```ts
 * import { checkNamespaces } from "@beep/repo-docgen/Checker"
 * const checked = checkNamespaces([])
 * console.log(checked)
 * ```
 *
 * @param models - Namespace models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkNamespaces(models: ReadonlyArray<Domain.Namespace>) {
  return Effect.forEach(models, checkNamespace).pipe(Effect.map(A.flatten));
}

/**
 * Accepts re-export declarations as graph edges whose owning declarations carry documentation.
 *
 * **Details**
 *
 * Requiring descriptions, examples, or versions on an export edge duplicates
 * metadata and can disagree with the declaration that owns the symbol.
 *
 * **Example** (Ignore export-edge metadata)
 *
 * ```ts
 * import { checkExports } from "@beep/repo-docgen/Checker"
 * const checked = checkExports([])
 * console.log(checked)
 * ```
 *
 * @param _models - Re-export models already validated through their owning declarations.
 * @returns Effect containing no export-edge documentation errors.
 * @category predicates
 * @since 0.0.0
 */
export function checkExports(_models: ReadonlyArray<Domain.Export>) {
  return Effect.succeed(A.empty<string>());
}

/**
 * Checks a parsed module and all of its documented members for required docgen annotations.
 *
 * **Details**
 *
 * The check uses the module's source file for code-frame locations and the
 * active {@link Configuration.Configuration} service for enforcement flags.
 *
 * **Example** (Validate module with enforcement)
 *
 * ```ts
 * import { Configuration, ConfigurationShape, DEFAULT_THEME, defaultCompilerOptions } from "@beep/repo-docgen/Configuration"
 * import { checkModule } from "@beep/repo-docgen/Checker"
 * import { parseModule, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "export const undocumented = 1")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const config = ConfigurationShape.make({
 *   enableSearch: false,
 *   enforceDescriptions: true,
 *   enforceExamples: true,
 *   enforceVersion: true,
 *   examplesCompilerOptions: defaultCompilerOptions,
 *   exclude: [],
 *   include: [],
 *   outDir: "docs",
 *   parseCompilerOptions: defaultCompilerOptions,
 *   projectHomepage: "",
 *   projectName: "@beep/example",
 *   srcDir: "src",
 *   srcLink: "",
 *   theme: DEFAULT_THEME,
 *   tscExecutable: "tsc"
 * })
 * const parsedModule = Effect.runSync(parseModule.pipe(Effect.provide(Source.layer(source))))
 * const errors = Effect.runSync(checkModule(parsedModule).pipe(Effect.provide(Configuration.layer(config))))
 * console.log(errors.length) // 3
 * ```
 *
 * @param module - Module model to validate.
 * @returns Effect that accumulates validation error messages.
 * @effects Reads parser source metadata from the parsed module and consults the active docgen configuration service.
 * @category predicates
 * @since 0.0.0
 */
export function checkModule(module: Domain.Module) {
  return Layer.build(Parser.Source.layer(module.source)).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* Effect.gen(function* () {
          const functionsErrors = yield* checkFunctions(module.functions);
          const classesErrors = yield* checkClasses(module.classes);
          const constantsErrors = yield* checkConstants(module.constants);
          const interfacesErrors = yield* checkInterfaces(module.interfaces);
          const typeAliasesErrors = yield* checkTypeAliases(module.typeAliases);
          const namespacesErrors = yield* checkNamespaces(module.namespaces);
          const exportsErrors = yield* checkExports(module.exports);

          return A.flatten([
            functionsErrors,
            classesErrors,
            constantsErrors,
            interfacesErrors,
            typeAliasesErrors,
            namespacesErrors,
            exportsErrors,
          ]);
        }).pipe(Effect.provide(context));
      })
    ),
    Effect.scoped
  );
}

/**
 * Checks multiple parsed modules for required docgen annotations.
 *
 * **Example** (Check empty modules list)
 *
 * ```ts
 * import { checkModules } from "@beep/repo-docgen/Checker"
 * const checked = checkModules([])
 * console.log(checked)
 * ```
 *
 * @param modules - Module models to validate.
 * @returns Effect that accumulates validation error messages.
 * @category predicates
 * @since 0.0.0
 */
export function checkModules(modules: ReadonlyArray<Domain.Module>) {
  return Effect.forEach(modules, checkModule).pipe(Effect.map(A.flatten));
}
