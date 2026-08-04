/**
 * Repo-local FrozenGrantSet construction law.
 *
 * Detects `FrozenGrantSet.make(...)` and `new FrozenGrantSet(...)` outside the
 * defining module, including syntactic aliasing bypasses: import aliases
 * (`import { FrozenGrantSet as F }`), variable aliases (`const X = FrozenGrantSet`),
 * destructured make (`const { make } = FrozenGrantSet`), and extracted make
 * (`const m = FrozenGrantSet.make`). Only the exact repo-relative defining
 * module path is exempt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, HashSet, Order } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import { lawScanSourcePaths, runLawScan } from "./internal/LawScan.ts";
import type { TSMorphService, TSMorphServiceError } from "@beep/repo-utils/TSMorph/index";
import type { Path } from "effect";
import type { CallExpression, NewExpression, ObjectBindingPattern, SourceFile, VariableDeclaration } from "ts-morph";

const $I = $RepoCliId.create("commands/Laws/FrozenGrantSet");

const FROZEN_GRANT_SET_RULE_ID = "effect-governance-frozen-grant-set";
const FROZEN_GRANT_SET_DEFINING_MODULE = "packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts";
const FROZEN_GRANT_SET_NAME = "FrozenGrantSet";
const MAKE_NAME = "make";

const FrozenGrantSetSeverity = LiteralKit(["error"]);

/**
 * Runtime options for the FrozenGrantSet construction law.
 *
 * **Example** (Configure FrozenGrantSet scanning)
 * ```ts
 * import { FrozenGrantSetRulesOptions } from "@beep/repo-cli/commands/Laws/FrozenGrantSet"
 *
 * const options = FrozenGrantSetRulesOptions.make({
 *   strictCheck: true,
 *   excludePaths: ["packages/demo/test/index.ts"],
 * })
 *
 * console.log(options.strictCheck)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrozenGrantSetRulesOptions extends S.Class<FrozenGrantSetRulesOptions>($I`FrozenGrantSetRulesOptions`)(
  {
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    excludePaths: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    includePaths: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("FrozenGrantSetRulesOptions", {
    description: "Runtime options for the repo-local FrozenGrantSet construction law.",
  })
) {}

/**
 * Single FrozenGrantSet construction law diagnostic.
 *
 * @example
 * ```ts
 * import { FrozenGrantSetDiagnostic } from "@beep/repo-cli/commands/Laws/FrozenGrantSet"
 *
 * const diagnostic = FrozenGrantSetDiagnostic.make({
 *   file: "packages/demo/src/index.ts",
 *   line: 4,
 *   column: 12,
 *   ruleId: "effect-governance-frozen-grant-set",
 *   severity: "error",
 *   message: "FrozenGrantSet construction (make or new, including aliases) is only permitted inside its defining module.",
 * })
 *
 * console.log(diagnostic.severity)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FrozenGrantSetDiagnostic extends S.Class<FrozenGrantSetDiagnostic>($I`FrozenGrantSetDiagnostic`)(
  {
    file: S.String,
    line: S.Finite,
    column: S.Finite,
    ruleId: S.String,
    severity: FrozenGrantSetSeverity,
    message: S.String,
  },
  $I.annote("FrozenGrantSetDiagnostic", {
    description:
      "Diagnostic emitted when FrozenGrantSet is constructed (make, new, or a syntactic alias of either) outside its defining module.",
  })
) {}

/**
 * Summary of FrozenGrantSet construction law results.
 *
 * @example
 * ```ts
 * import { FrozenGrantSetRulesSummary } from "@beep/repo-cli/commands/Laws/FrozenGrantSet"
 *
 * const summary = FrozenGrantSetRulesSummary.make({
 *   scannedFiles: 12,
 *   touchedFiles: 1,
 *   violationCount: 1,
 *   strictFailure: true,
 * })
 *
 * console.log(summary.strictFailure)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FrozenGrantSetRulesSummary extends S.Class<FrozenGrantSetRulesSummary>($I`FrozenGrantSetRulesSummary`)(
  {
    scannedFiles: S.Finite,
    touchedFiles: S.Finite,
    violationCount: S.Finite,
    strictFailure: S.Boolean,
    affectedFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    diagnostics: S.Array(FrozenGrantSetDiagnostic).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<FrozenGrantSetDiagnostic>())),
      S.withDecodingDefault(Effect.succeed(A.empty<FrozenGrantSetDiagnostic>()))
    ),
  },
  $I.annote("FrozenGrantSetRulesSummary", {
    description: "Summary of repo-local FrozenGrantSet construction law results.",
  })
) {}

type TaintedBindings = {
  readonly classNames: HashSet.HashSet<string>;
  readonly makeNames: HashSet.HashSet<string>;
};

const isTaintedClassExpression = (node: Node, classNames: HashSet.HashSet<string>): boolean => {
  if (Node.isIdentifier(node)) {
    return HashSet.has(classNames, node.getText());
  }

  return Node.isPropertyAccessExpression(node) && node.getName() === FROZEN_GRANT_SET_NAME;
};

const isTaintedMakeAccess = (node: Node, classNames: HashSet.HashSet<string>): boolean =>
  Node.isPropertyAccessExpression(node) &&
  node.getName() === MAKE_NAME &&
  isTaintedClassExpression(node.getExpression(), classNames);

const taintedBindingCount = (taint: TaintedBindings): number =>
  HashSet.size(taint.classNames) + HashSet.size(taint.makeNames);

const collectImportedClassNames = (sourceFile: SourceFile): HashSet.HashSet<string> => {
  let classNames: HashSet.HashSet<string> = HashSet.make(FROZEN_GRANT_SET_NAME);

  for (const importSpecifier of sourceFile.getDescendantsOfKind(SyntaxKind.ImportSpecifier)) {
    if (importSpecifier.getName() === FROZEN_GRANT_SET_NAME) {
      classNames = HashSet.add(classNames, importSpecifier.getAliasNode()?.getText() ?? importSpecifier.getName());
    }
  }

  return classNames;
};

const taintIdentifierBinding = (taint: TaintedBindings, localName: string, initializer: Node): TaintedBindings => {
  const classNames = isTaintedClassExpression(initializer, taint.classNames)
    ? HashSet.add(taint.classNames, localName)
    : taint.classNames;

  const bindsMake =
    isTaintedMakeAccess(initializer, classNames) ||
    (Node.isIdentifier(initializer) && HashSet.has(taint.makeNames, initializer.getText()));

  return {
    classNames,
    makeNames: bindsMake ? HashSet.add(taint.makeNames, localName) : taint.makeNames,
  };
};

const taintObjectBindingPattern = (
  taint: TaintedBindings,
  nameNode: ObjectBindingPattern,
  initializer: Node
): TaintedBindings => {
  if (!isTaintedClassExpression(initializer, taint.classNames)) {
    return taint;
  }

  let makeNames = taint.makeNames;

  for (const element of nameNode.getElements()) {
    const propertyName = element.getPropertyNameNode()?.getText() ?? element.getNameNode().getText();
    if (propertyName === MAKE_NAME) {
      makeNames = HashSet.add(makeNames, element.getNameNode().getText());
    }
  }

  return { classNames: taint.classNames, makeNames };
};

const taintVariableDeclaration = (taint: TaintedBindings, declaration: VariableDeclaration): TaintedBindings => {
  const initializer = declaration.getInitializer();
  if (P.isUndefined(initializer)) {
    return taint;
  }

  const nameNode = declaration.getNameNode();

  if (Node.isIdentifier(nameNode)) {
    return taintIdentifierBinding(taint, nameNode.getText(), initializer);
  }

  return Node.isObjectBindingPattern(nameNode) ? taintObjectBindingPattern(taint, nameNode, initializer) : taint;
};

const collectTaintedBindings = (sourceFile: SourceFile): TaintedBindings => {
  const variableDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

  let taint: TaintedBindings = {
    classNames: collectImportedClassNames(sourceFile),
    makeNames: HashSet.empty<string>(),
  };
  let previousCount = -1;

  while (taintedBindingCount(taint) !== previousCount) {
    previousCount = taintedBindingCount(taint);
    taint = A.reduce(variableDeclarations, taint, taintVariableDeclaration);
  }

  return taint;
};

const isViolationCallee = (expression: Node, taint: TaintedBindings): boolean =>
  isTaintedMakeAccess(expression, taint.classNames) ||
  (Node.isIdentifier(expression) && HashSet.has(taint.makeNames, expression.getText()));

const byNodeStartAscending = Order.mapInput(Order.Number, (node: Node) => node.getStart());

const makeDiagnostic = (
  sourceFile: SourceFile,
  relativeFilePath: string,
  node: CallExpression | NewExpression
): FrozenGrantSetDiagnostic => {
  const position = sourceFile.getLineAndColumnAtPos(node.getStart());

  return FrozenGrantSetDiagnostic.make({
    file: relativeFilePath,
    line: position.line,
    column: position.column,
    ruleId: FROZEN_GRANT_SET_RULE_ID,
    severity: "error",
    message: `FrozenGrantSet construction (make or new, including aliases) is only permitted inside ${FROZEN_GRANT_SET_DEFINING_MODULE}.`,
  });
};

const collectFrozenGrantSetDiagnostics = (
  relativeFilePath: string,
  sourceFile: SourceFile
): ReadonlyArray<FrozenGrantSetDiagnostic> => {
  const taint = collectTaintedBindings(sourceFile);
  let violationNodes = A.empty<CallExpression | NewExpression>();

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isViolationCallee(callExpression.getExpression(), taint)) {
      violationNodes = A.append(violationNodes, callExpression);
    }
  }

  for (const newExpression of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    const expression = newExpression.getExpression();
    if (isViolationCallee(expression, taint) || isTaintedClassExpression(expression, taint.classNames)) {
      violationNodes = A.append(violationNodes, newExpression);
    }
  }

  return A.map(A.sort(violationNodes, byNodeStartAscending), (node) =>
    makeDiagnostic(sourceFile, relativeFilePath, node)
  );
};

/**
 * Run the repo-local FrozenGrantSet construction law.
 *
 * Reports every construction of FrozenGrantSet outside the exact defining
 * module path: direct `FrozenGrantSet.make(...)` calls, direct
 * `new FrozenGrantSet(...)` expressions, and syntactic-taint bypasses through
 * import aliases, variable aliases, destructured `make` bindings, and
 * extracted `make` references (including calls and `new` on those aliases).
 *
 * @param options - Runtime options for the check.
 * @returns Effect that scans production TypeScript source and reports FrozenGrantSet constructions (make, new, or aliases of either) outside the defining module.
 * @effects Requires the shared TSMorph service and platform path service to inspect repo TypeScript source files.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { runFrozenGrantSetRules, FrozenGrantSetRulesOptions } from "@beep/repo-cli/commands/Laws/FrozenGrantSet"
 *
 * const program = Effect.map(
 *   runFrozenGrantSetRules(FrozenGrantSetRulesOptions.make({ strictCheck: true })),
 *   (summary) => summary.violationCount,
 * )
 *
 * console.log(program) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runFrozenGrantSetRules = Effect.fn("FrozenGrantSet.runFrozenGrantSetRules")(function* (
  options: FrozenGrantSetRulesOptions
): Effect.fn.Return<FrozenGrantSetRulesSummary, S.SchemaError | TSMorphServiceError, TSMorphService | Path.Path> {
  const scan = yield* runLawScan({
    sourceFileGlobs: lawScanSourcePaths(options.includePaths),
    includePaths: options.includePaths,
    excludePaths: A.append(options.excludePaths, FROZEN_GRANT_SET_DEFINING_MODULE),
    strictCheck: options.strictCheck,
    collect: collectFrozenGrantSetDiagnostics,
  });

  return FrozenGrantSetRulesSummary.make(scan);
});
