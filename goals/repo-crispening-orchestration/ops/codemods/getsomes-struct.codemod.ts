/**
 * Codemod: `R.getSomes({ ...inline struct... })` -> `O.getSomesStruct({ ... })`.
 *
 * `effect/Record`'s `getSomes` collapses a homogeneous `Record<K, Option<A>>`
 * into `Record<K, A>` (single value type `A`). The repo helper
 * `@beep/utils/Option`'s `getSomesStruct` (packages/foundation/modeling/utils/
 * src/Option.ts:102) instead preserves per-key value types, so it is the
 * correct target only when the argument is an inline heterogeneous struct
 * literal. This codemod rewrites exactly those call sites and leaves
 * `R.getSomes` applied to a variable/dictionary alone.
 *
 * Assisted tier (SPEC.md §5.5 / README triage: 0.6-0.9): the codemod computes
 * a conservative candidate edit; a P2 remediation agent reviews each diff. It
 * is a thin wrapper around `TSMorphService.updateSourceFile`, so a site with
 * no safe match is a byte-identical no-op (the service only saves on change).
 *
 * Standalone: `bun goals/repo-crispening-orchestration/ops/codemods/getsomes-struct.codemod.ts <file...>`
 *
 * @since 0.0.0
 */
import { TSMorphService, TSMorphServiceLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import { Node, SyntaxKind } from "ts-morph";
import type { TSMorphServiceError } from "@beep/repo-utils";
import type { CallExpression, ImportDeclaration, ObjectLiteralExpression, SourceFile } from "ts-morph";

const RECORD_MODULE = "effect/Record";
const EFFECT_OPTION_MODULE = "effect/Option";
const OPTION_UTILS_MODULE = "@beep/utils/Option";
const OPTION_UTILS_BARREL = "@beep/utils";

/** The package that defines `getSomesStruct`; rewriting its own imports would be circular. */
const SELF_PACKAGE_MARKER = "/foundation/modeling/utils/";

/** An object literal is a safe struct target only with fixed, non-computed keys and no spreads. */
const isSafeStructLiteral = (object: ObjectLiteralExpression): boolean => {
  const properties = object.getProperties();
  if (properties.length === 0) {
    return false;
  }
  return properties.every((property) => {
    if (Node.isShorthandPropertyAssignment(property)) {
      return true;
    }
    if (Node.isPropertyAssignment(property)) {
      return !Node.isComputedPropertyName(property.getNameNode());
    }
    return false;
  });
};

/** `<recordAlias>.getSomes(<inline safe struct literal>)`. */
const isTargetCall = (node: Node, recordAlias: string): node is CallExpression => {
  if (!Node.isCallExpression(node)) {
    return false;
  }
  const callee = node.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "getSomes") {
    return false;
  }
  const receiver = callee.getExpression();
  if (!Node.isIdentifier(receiver) || receiver.getText() !== recordAlias) {
    return false;
  }
  const args = node.getArguments();
  const [only] = args;
  if (args.length !== 1 || only === undefined || !Node.isObjectLiteralExpression(only)) {
    return false;
  }
  return isSafeStructLiteral(only);
};

/** First `import * as <alias> from "effect/Record"`. */
const findRecordNamespaceImport = (sourceFile: SourceFile): ImportDeclaration | undefined =>
  sourceFile
    .getImportDeclarations()
    .find(
      (declaration) =>
        declaration.getModuleSpecifierValue() === RECORD_MODULE && declaration.getNamespaceImport() !== undefined
    );

/** Local name of a namespace import (`* as X`) for the given module, if any. */
const findNamespaceLocalName = (sourceFile: SourceFile, moduleSpecifier: string): string | undefined => {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== moduleSpecifier) {
      continue;
    }
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport !== undefined) {
      return namespaceImport.getText();
    }
  }
  return undefined;
};

/** Local name that `{ O }` / `{ O as X }` from `@beep/utils` binds, if any. */
const findOptionBarrelLocalName = (sourceFile: SourceFile): string | undefined => {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== OPTION_UTILS_BARREL) {
      continue;
    }
    for (const specifier of declaration.getNamedImports()) {
      if (specifier.getName() === "O") {
        const alias = specifier.getAliasNode();
        return alias === undefined ? specifier.getName() : alias.getText();
      }
    }
  }
  return undefined;
};

/** True if any binding in the file already uses `name`. */
const isNameBound = (sourceFile: SourceFile, name: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => {
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport !== undefined && namespaceImport.getText() === name) {
      return true;
    }
    const defaultImport = declaration.getDefaultImport();
    if (defaultImport !== undefined && defaultImport.getText() === name) {
      return true;
    }
    return declaration.getNamedImports().some((specifier) => {
      const alias = specifier.getAliasNode();
      return (alias === undefined ? specifier.getName() : alias.getText()) === name;
    });
  });

/**
 * Resolve (creating/retargeting an import if needed) the local namespace name
 * that exposes `getSomesStruct`, preferring an existing `@beep/utils` binding.
 */
const resolveOptionAlias = (sourceFile: SourceFile): string => {
  const fromUtilsNamespace = findNamespaceLocalName(sourceFile, OPTION_UTILS_MODULE);
  if (fromUtilsNamespace !== undefined) {
    return fromUtilsNamespace;
  }
  const fromBarrel = findOptionBarrelLocalName(sourceFile);
  if (fromBarrel !== undefined) {
    return fromBarrel;
  }
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== EFFECT_OPTION_MODULE) {
      continue;
    }
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport !== undefined) {
      // `@beep/utils/Option` re-exports all of `effect/Option`, so retargeting
      // is safe and preserves every existing `O.*` reference.
      const alias = namespaceImport.getText();
      declaration.setModuleSpecifier(OPTION_UTILS_MODULE);
      return alias;
    }
  }
  let alias = "O";
  // Walk O -> OptionUtils -> OptionUtils1 -> ... until the name is free, so a
  // file that already binds both candidates never gains a duplicate identifier.
  for (let attempt = 0; isNameBound(sourceFile, alias); attempt++) {
    alias = attempt === 0 ? "OptionUtils" : `OptionUtils${attempt}`;
  }
  sourceFile.addImportDeclaration({ moduleSpecifier: OPTION_UTILS_MODULE, namespaceImport: alias });
  return alias;
};

/** Rewrite every matching callee `R.getSomes` -> `<optionAlias>.getSomesStruct`. */
const rewriteCalls = (sourceFile: SourceFile, recordAlias: string, optionAlias: string): void => {
  for (;;) {
    const match = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => isTargetCall(call, recordAlias));
    if (match === undefined) {
      break;
    }
    match.getExpression().replaceWithText(`${optionAlias}.getSomesStruct`);
  }
};

/** Drop the `effect/Record` import once its alias is no longer referenced. */
const maybeRemoveRecordImport = (
  sourceFile: SourceFile,
  recordAlias: string,
  recordImport: ImportDeclaration
): void => {
  const occurrences = sourceFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((identifier) => identifier.getText() === recordAlias).length;
  // Exactly one occurrence means only the namespace binding itself remains.
  if (occurrences <= 1) {
    recordImport.remove();
  }
};

/**
 * Pure ts-morph mutation callback for `TSMorphService.updateSourceFile`.
 *
 * @since 0.0.0
 */
export const rewriteGetSomesStruct = (sourceFile: SourceFile): void => {
  if (sourceFile.getFilePath().includes(SELF_PACKAGE_MARKER)) {
    return;
  }
  const recordImport = findRecordNamespaceImport(sourceFile);
  if (recordImport === undefined) {
    return;
  }
  const namespaceImport = recordImport.getNamespaceImport();
  if (namespaceImport === undefined) {
    return;
  }
  const recordAlias = namespaceImport.getText();

  const hasMatch = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => isTargetCall(call, recordAlias));
  if (!hasMatch) {
    return;
  }

  const optionAlias = resolveOptionAlias(sourceFile);
  rewriteCalls(sourceFile, recordAlias, optionAlias);
  maybeRemoveRecordImport(sourceFile, recordAlias, recordImport);
};

/** Per-file outcome of a codemod run. */
export type GetSomesStructResult = {
  readonly filePath: string;
  readonly changed: boolean;
};

/**
 * Run the rewrite across the given files. Pure over the file list so the P2
 * wave can drive it; each file goes through `updateSourceFile`, so a no-match
 * file is a byte-identical no-op (`changed: false`).
 *
 * @since 0.0.0
 */
export const runGetSomesStructCodemod = (
  filePaths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<GetSomesStructResult>, TSMorphServiceError, TSMorphService> =>
  Effect.gen(function* () {
    const service = yield* TSMorphService;
    return yield* Effect.forEach(
      filePaths,
      (filePath) =>
        service
          .updateSourceFile(filePath, rewriteGetSomesStruct)
          .pipe(Effect.map((changed): GetSomesStructResult => ({ filePath, changed }))),
      { concurrency: 1 }
    );
  });

if (import.meta.main) {
  const filePaths = process.argv.slice(2);
  const MainLayer = TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer));
  Effect.runPromise(
    runGetSomesStructCodemod(filePaths).pipe(
      Effect.flatMap((results) =>
        Effect.forEach(
          results,
          (result) => Console.log(`${result.changed ? "changed  " : "unchanged"}\t${result.filePath}`),
          {
            discard: true,
          }
        )
      ),
      Effect.tapErrorCause((cause) => Console.error(cause)),
      Effect.provide(MainLayer)
    )
  ).catch(() => {
    process.exit(1);
  });
}
