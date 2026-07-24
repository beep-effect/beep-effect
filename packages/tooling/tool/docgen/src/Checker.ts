/**
 * Validation helpers for parsed docgen modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { codeFrameColumns } from "@babel/code-frame";
import { $RepoDocgenId } from "@beep/identity";
import { A } from "@beep/utils";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import * as Configuration from "./Configuration.ts";
import * as Domain from "./Domain.ts";
import * as Parser from "./Parser.ts";

const $I = $RepoDocgenId.create("Checker");

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
    readonly enforceVersion: boolean;
  }
) {
  const source = yield* Parser.Source;
  const config = yield* Configuration.Configuration;
  let errors: Array<string> = [];

  if (config.enforceDescriptions && model.doc.description === undefined) {
    errors = A.appendAll(
      errors,
      makeError(source, model.position, (filePath, frame) => `Missing description in file ${filePath}:\n\n${frame}`)
    );
  }

  if (config.enforceExamples && model.doc.examples.length === 0) {
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
    readonly enforceVersion: boolean;
  }
) {
  return Effect.forEach(models, (model) => checkEntry(model, options)).pipe(Effect.map(A.flatten));
}

function checkFunction(model: Domain.Function) {
  return checkEntry(model, { enforceVersion: true });
}

/**
 * Checks documented functions for required docgen annotations.
 *
 * @param models - Function models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkFunctions } from "@beep/repo-docgen/Checker"
 * const checked = checkFunctions([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkFunctions(models: ReadonlyArray<Domain.Function>) {
  return Effect.forEach(models, checkFunction).pipe(Effect.map(A.flatten));
}

const checkClass = Effect.fn("checkClass")(function* (model: Domain.Class) {
  const docErrors = yield* checkEntry(model, { enforceVersion: true });
  const staticMethodsErrors = yield* checkEntries(model.staticMethods, { enforceVersion: false });
  const methodsErrors = yield* checkEntries(model.methods, { enforceVersion: false });
  const propertiesErrors = yield* checkEntries(model.properties, { enforceVersion: false });
  return A.flatten([docErrors, staticMethodsErrors, methodsErrors, propertiesErrors]);
});

/**
 * Checks documented classes and their members for required docgen annotations.
 *
 * @param models - Class models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkClasses } from "@beep/repo-docgen/Checker"
 * const checked = checkClasses([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkClasses(models: ReadonlyArray<Domain.Class>) {
  return Effect.forEach(models, checkClass).pipe(Effect.map(A.flatten));
}

function checkConstant(model: Domain.Constant) {
  return checkEntry(model, { enforceVersion: true });
}

/**
 * Checks documented constants for required docgen annotations.
 *
 * @param models - Constant models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkConstants } from "@beep/repo-docgen/Checker"
 * const checked = checkConstants([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkConstants(models: ReadonlyArray<Domain.Constant>) {
  return Effect.forEach(models, checkConstant).pipe(Effect.map(A.flatten));
}

function checkInterface(model: Domain.Interface) {
  return checkEntry(model, { enforceVersion: true });
}

/**
 * Checks documented interfaces for required docgen annotations.
 *
 * @param models - Interface models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkInterfaces } from "@beep/repo-docgen/Checker"
 * const checked = checkInterfaces([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkInterfaces(models: ReadonlyArray<Domain.Interface>) {
  return Effect.forEach(models, checkInterface).pipe(Effect.map(A.flatten));
}

function checkTypeAlias(model: Domain.TypeAlias) {
  return checkEntry(model, { enforceVersion: true });
}

/**
 * Checks documented type aliases for required docgen annotations.
 *
 * @param models - Type alias models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkTypeAliases } from "@beep/repo-docgen/Checker"
 * const checked = checkTypeAliases([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkTypeAliases(models: ReadonlyArray<Domain.TypeAlias>) {
  return Effect.forEach(models, checkTypeAlias).pipe(Effect.map(A.flatten));
}

const checkNamespace = Effect.fn("checkNamespace")(function* (
  model: Domain.Namespace
): Effect.fn.Return<Array<string>, never, Parser.Source | Configuration.Configuration> {
  const docErrors = yield* checkEntry(model, { enforceVersion: true });
  const interfacesErrors = yield* checkInterfaces(model.interfaces);
  const typeAliasesErrors = yield* checkTypeAliases(model.typeAliases);
  const namespacesErrors = yield* checkNamespaces(model.namespaces);
  return A.flatten([docErrors, interfacesErrors, typeAliasesErrors, namespacesErrors]);
});

/**
 * Checks documented namespaces and their nested members for required docgen annotations.
 *
 * @param models - Namespace models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkNamespaces } from "@beep/repo-docgen/Checker"
 * const checked = checkNamespaces([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkNamespaces(models: ReadonlyArray<Domain.Namespace>) {
  return Effect.forEach(models, checkNamespace).pipe(Effect.map(A.flatten));
}

function checkExport(model: Domain.Export) {
  return checkEntry(model, { enforceVersion: true });
}

/**
 * Checks documented manual exports for required docgen annotations.
 *
 * @param models - Export models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkExports } from "@beep/repo-docgen/Checker"
 * const checked = checkExports([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkExports(models: ReadonlyArray<Domain.Export>) {
  return Effect.forEach(models, checkExport).pipe(Effect.map(A.flatten));
}

/**
 * Checks a parsed module and all of its documented members for required docgen annotations.
 *
 * @param module - Module model to validate.
 * @returns Effect that accumulates validation error messages.
 * @remarks
 * The check uses the module's source file for code-frame locations and the
 * active {@link Configuration.Configuration} service for enforcement flags.
 * @effects Reads parser source metadata from the parsed module and consults the active docgen configuration service.
 * @example
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
 *   runExamples: false,
 *   srcDir: "src",
 *   srcLink: "",
 *   theme: DEFAULT_THEME,
 *   tscExecutable: "tsc"
 * })
 * const parsedModule = Effect.runSync(parseModule.pipe(Effect.provide(Source.layer(source))))
 * const errors = Effect.runSync(checkModule(parsedModule).pipe(Effect.provide(Configuration.layer(config))))
 * console.log(errors.length) // 3
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkModule(module: Domain.Module) {
  return Effect.scoped(
    Layer.build(Parser.Source.layer(module.source)).pipe(
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
      )
    )
  );
}

/**
 * Checks multiple parsed modules for required docgen annotations.
 *
 * @param modules - Module models to validate.
 * @returns Effect that accumulates validation error messages.
 * @example
 * ```ts
 * import { checkModules } from "@beep/repo-docgen/Checker"
 * const checked = checkModules([])
 * console.log(checked)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export function checkModules(modules: ReadonlyArray<Domain.Module>) {
  return Effect.forEach(modules, checkModule).pipe(Effect.map(A.flatten));
}
