/**
 * Repo-local Effect.fn supplemental law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import { lawScanSourcePaths, runLawScan } from "./internal/LawScan.ts";
import type { TSMorphService, TSMorphServiceError } from "@beep/repo-utils/TSMorph/index";
import type { Path } from "effect";
import type {
  ArrowFunction,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  MethodDeclaration,
  SourceFile,
} from "ts-morph";

const $I = $RepoCliId.create("commands/Laws/EffectFn");

const EFFECT_FN_RULE_ID = "beep-laws/effect-fn";

const EffectFnRecommendation = LiteralKit(["Effect.fn", "Effect.fnUntraced"]);

type EffectFnRecommendation = typeof EffectFnRecommendation.Type;
type EffectFnOwner = ArrowFunction | FunctionDeclaration | FunctionExpression | MethodDeclaration;

/**
 * Runtime options for the Effect.fn supplemental law.
 *
 * **Example** (Configure Effect.fn scanning)
 * ```ts
 * import { EffectFnRulesOptions } from "@beep/repo-cli/commands/Laws/EffectFn"
 *
 * const options = EffectFnRulesOptions.make({
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
export class EffectFnRulesOptions extends S.Class<EffectFnRulesOptions>($I`EffectFnRulesOptions`)(
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
  $I.annote("EffectFnRulesOptions", {
    description: "Runtime options for the repo-local Effect.fn supplemental law.",
  })
) {}

/**
 * Single Effect.fn supplemental law diagnostic.
 *
 * **Example** (Construct an effect fn diagnostic)
 *
 * ```ts
 * import { EffectFnDiagnostic } from "@beep/repo-cli/commands/Laws/EffectFn"
 *
 * const diagnostic = EffectFnDiagnostic.make({
 *   file: "packages/demo/src/index.ts",
 *   line: 4,
 *   column: 42,
 *   ruleId: "beep-laws/effect-fn",
 *   ownerName: "loadDemo",
 *   recommendation: "Effect.fn",
 *   message: "Function \"loadDemo\" directly returns Effect.gen; wrap it with Effect.fn.",
 * })
 *
 * console.log(diagnostic.recommendation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectFnDiagnostic extends S.Class<EffectFnDiagnostic>($I`EffectFnDiagnostic`)(
  {
    file: S.String,
    line: S.Finite,
    column: S.Finite,
    ruleId: S.String,
    ownerName: S.String,
    recommendation: EffectFnRecommendation,
    message: S.String,
  },
  $I.annote("EffectFnDiagnostic", {
    description: "Diagnostic emitted when a reusable function directly returns Effect.gen.",
  })
) {}

/**
 * Summary of Effect.fn supplemental law results.
 *
 * **Example** (Construct an effect fn rules summary)
 *
 * ```ts
 * import { EffectFnRulesSummary } from "@beep/repo-cli/commands/Laws/EffectFn"
 *
 * const summary = EffectFnRulesSummary.make({
 *   scannedFiles: 12,
 *   touchedFiles: 1,
 *   violationCount: 1,
 *   strictFailure: true,
 * })
 *
 * console.log(summary.strictFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffectFnRulesSummary extends S.Class<EffectFnRulesSummary>($I`EffectFnRulesSummary`)(
  {
    scannedFiles: S.Finite,
    touchedFiles: S.Finite,
    violationCount: S.Finite,
    strictFailure: S.Boolean,
    affectedFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    diagnostics: S.Array(EffectFnDiagnostic).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EffectFnDiagnostic>())),
      S.withDecodingDefault(Effect.succeed(A.empty<EffectFnDiagnostic>()))
    ),
  },
  $I.annote("EffectFnRulesSummary", {
    description: "Summary of repo-local Effect.fn supplemental law results.",
  })
) {}

const isEffectFnOwner = (node: Node): node is EffectFnOwner =>
  Node.isArrowFunction(node) ||
  Node.isFunctionDeclaration(node) ||
  Node.isFunctionExpression(node) ||
  Node.isMethodDeclaration(node);

const isGeneratorOwner = (owner: EffectFnOwner): boolean => !Node.isArrowFunction(owner) && owner.isGenerator();

const parentOf = (node: Node): O.Option<Node> => O.fromUndefinedOr(node.getParent());

const isSourceFileParent = (node: Node): boolean => pipe(parentOf(node), O.exists(Node.isSourceFile));

const isSameNode = (left: Node, right: Node): boolean =>
  left.getSourceFile() === right.getSourceFile() &&
  left.getStart() === right.getStart() &&
  left.getEnd() === right.getEnd();

const unwrapParenthesized = (node: Node): Node =>
  Node.isParenthesizedExpression(node) ? unwrapParenthesized(node.getExpression()) : node;

const isEffectMemberCallExpression = (callExpression: CallExpression, memberNames: ReadonlyArray<string>): boolean => {
  const expression = callExpression.getExpression();

  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getExpression().getText() === "Effect" &&
    A.contains(expression.getName())(memberNames)
  );
};

const isEffectGenCall = (node: Node): node is CallExpression =>
  Node.isCallExpression(node) && isEffectMemberCallExpression(node, ["gen"]);

const isEffectFnConstructorCall = (callExpression: CallExpression): boolean => {
  if (isEffectMemberCallExpression(callExpression, ["fn", "fnUntraced"])) {
    return true;
  }

  const expression = callExpression.getExpression();
  return Node.isCallExpression(expression) && isEffectMemberCallExpression(expression, ["fn", "fnUntraced"]);
};

const isEffectFnBody = (owner: EffectFnOwner): boolean =>
  pipe(
    parentOf(owner),
    O.exists((parent) => Node.isCallExpression(parent) && isEffectFnConstructorCall(parent))
  );

const nearestOwner = (node: Node): O.Option<EffectFnOwner> => {
  let current = node.getParent();

  while (P.isNotUndefined(current)) {
    if (isEffectFnOwner(current)) {
      return O.some(current);
    }

    current = current.getParent();
  }

  return O.none();
};

const parentSkippingParentheses = (node: Node): readonly [directNode: Node, parent: O.Option<Node>] => {
  let directNode = node;
  let parent = directNode.getParent();

  while (P.isNotUndefined(parent) && Node.isParenthesizedExpression(parent)) {
    directNode = parent;
    parent = directNode.getParent();
  }

  return [directNode, O.fromUndefinedOr(parent)] as const;
};

const getDirectReturnOwner = (callExpression: CallExpression): O.Option<EffectFnOwner> => {
  const [, parent] = parentSkippingParentheses(callExpression);

  return pipe(
    parent,
    O.flatMap((parentNode) => {
      if (Node.isArrowFunction(parentNode) && isSameNode(unwrapParenthesized(parentNode.getBody()), callExpression)) {
        return O.some(parentNode);
      }

      if (
        Node.isReturnStatement(parentNode) &&
        pipe(
          O.fromUndefinedOr(parentNode.getExpression()),
          O.map(unwrapParenthesized),
          O.exists((expression) => isSameNode(expression, callExpression))
        )
      ) {
        return nearestOwner(parentNode);
      }

      return O.none();
    })
  );
};

const ownerNameFromParent = (owner: EffectFnOwner): O.Option<string> =>
  pipe(
    parentOf(owner),
    O.flatMap((parent) => {
      if (
        Node.isVariableDeclaration(parent) ||
        Node.isPropertyAssignment(parent) ||
        Node.isPropertyDeclaration(parent)
      ) {
        return O.some(parent.getName());
      }

      return O.none();
    })
  );

const getOwnerName = (owner: EffectFnOwner): O.Option<string> => {
  if (Node.isFunctionDeclaration(owner) || Node.isFunctionExpression(owner)) {
    return pipe(
      O.fromUndefinedOr(owner.getName()),
      O.orElse(() => ownerNameFromParent(owner))
    );
  }

  if (Node.isMethodDeclaration(owner)) {
    return O.some(owner.getName());
  }

  return ownerNameFromParent(owner);
};

const hasTopLevelStatementOwner = (owner: EffectFnOwner): boolean => {
  if (Node.isFunctionDeclaration(owner)) {
    return isSourceFileParent(owner);
  }

  const parent = owner.getParent();

  if (P.isNotUndefined(parent) && Node.isVariableDeclaration(parent)) {
    const variableStatement = parent.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    return P.isNotUndefined(variableStatement) && isSourceFileParent(variableStatement);
  }

  if (
    P.isNotUndefined(parent) &&
    (Node.isPropertyAssignment(parent) || Node.isPropertyDeclaration(parent) || Node.isMethodDeclaration(owner))
  ) {
    const variableStatement = owner.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    if (P.isNotUndefined(variableStatement) && isSourceFileParent(variableStatement)) {
      return true;
    }

    const classDeclaration = owner.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    if (P.isNotUndefined(classDeclaration) && isSourceFileParent(classDeclaration)) {
      return true;
    }
  }

  return false;
};

const recommendationForOwner = (owner: EffectFnOwner): EffectFnRecommendation =>
  hasTopLevelStatementOwner(owner) ? "Effect.fn" : "Effect.fnUntraced";

const fallbackOwnerName = (owner: EffectFnOwner): string =>
  pipe(
    getOwnerName(owner),
    O.getOrElse(() => (Node.isMethodDeclaration(owner) ? "method" : "callback"))
  );

const makeDiagnostic = (
  sourceFile: SourceFile,
  relativeFilePath: string,
  owner: EffectFnOwner,
  callExpression: CallExpression
): EffectFnDiagnostic => {
  const position = sourceFile.getLineAndColumnAtPos(callExpression.getStart());
  const ownerName = fallbackOwnerName(owner);
  const recommendation = recommendationForOwner(owner);
  const suggestedName =
    recommendation === "Effect.fn" ? ` named ${recommendation}("${ownerName}")` : ` ${recommendation}`;

  return EffectFnDiagnostic.make({
    file: relativeFilePath,
    line: position.line,
    column: position.column,
    ruleId: EFFECT_FN_RULE_ID,
    ownerName,
    recommendation,
    message: `Reusable function '${ownerName}' directly returns Effect.gen(function*). Use${suggestedName} instead.`,
  });
};

const collectEffectFnDiagnostics = (
  relativeFilePath: string,
  sourceFile: SourceFile
): ReadonlyArray<EffectFnDiagnostic> => {
  let diagnostics = A.empty<EffectFnDiagnostic>();

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!isEffectGenCall(callExpression)) {
      continue;
    }

    const owner = pipe(
      getDirectReturnOwner(callExpression),
      O.filter((candidate) => !isGeneratorOwner(candidate))
    );
    if (O.isNone(owner) || isEffectFnBody(owner.value)) {
      continue;
    }

    diagnostics = A.append(diagnostics, makeDiagnostic(sourceFile, relativeFilePath, owner.value, callExpression));
  }

  return diagnostics;
};

/**
 * Run the repo-local Effect.fn supplemental law.
 *
 * **Example** (Run effect fn rules)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { runEffectFnRules, EffectFnRulesOptions } from "@beep/repo-cli/commands/Laws/EffectFn"
 *
 * const program = Effect.map(
 *   runEffectFnRules(EffectFnRulesOptions.make({ strictCheck: true })),
 *   (summary) => summary.violationCount,
 * )
 *
 * console.log(program) // example value
 * ```
 *
 * @param options - Runtime options for the check.
 * @returns Effect that scans production TypeScript source and reports direct Effect.gen returns.
 * @effects Requires the shared TSMorph service and platform path service to inspect repo TypeScript source files.
 * @category utilities
 * @since 0.0.0
 */
export const runEffectFnRules = Effect.fn("EffectFn.runEffectFnRules")(function* (
  options: EffectFnRulesOptions
): Effect.fn.Return<EffectFnRulesSummary, S.SchemaError | TSMorphServiceError, TSMorphService | Path.Path> {
  const scan = yield* runLawScan({
    sourceFileGlobs: lawScanSourcePaths(options.includePaths),
    includePaths: options.includePaths,
    excludePaths: options.excludePaths,
    strictCheck: options.strictCheck,
    collect: collectEffectFnDiagnostics,
  });

  return EffectFnRulesSummary.make(scan);
});
