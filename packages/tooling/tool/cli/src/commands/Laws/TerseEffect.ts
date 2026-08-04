/**
 * Terse Effect style migration and check logic.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A, thunkEmptyStr } from "@beep/utils";
import { Effect, HashMap, Inspectable, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Node, Project, SyntaxKind } from "ts-morph";
import { isExcludedLawScanPath } from "./internal/LawScan.ts";
import { TerseEffectRulesPersistenceError } from "./Laws.errors.ts";
import type { ArrowFunction, CallExpression, FunctionDeclaration, ObjectLiteralExpression } from "ts-morph";

const $I = $RepoCliId.create("commands/Laws/TerseEffect");

/**
 * Runtime options for terse Effect style migration checks.
 *
 * **Example** (Configure terse Effect scanning)
 * ```ts
 * console.log("TerseEffectRulesOptions")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TerseEffectRulesOptions extends S.Class<TerseEffectRulesOptions>($I`TerseEffectRulesOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
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
  $I.annote("TerseEffectRulesOptions", {
    description: "Runtime options for terse Effect style migration checks.",
  })
) {}

/**
 * Summary of terse Effect style migration results.
 *
 * **Example** (Reference the terse-effect rules summary)
 *
 * ```ts
 * console.log("TerseEffectRulesSummary")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TerseEffectRulesSummary extends S.Class<TerseEffectRulesSummary>($I`TerseEffectRulesSummary`)(
  {
    touchedFiles: S.Finite,
    helpersSimplified: S.Finite,
    thunkHelpersSimplified: S.Finite,
    flowCandidatesDetected: S.Finite,
    optionObjectCompactionCandidatesDetected: S.Finite,
    conditionalOptionalObjectSpreadCandidatesDetected: S.Finite,
    nestedOptionMatchCandidatesDetected: S.Finite,
    nestedBoolMatchCandidatesDetected: S.Finite,
    dualOverloadCandidatesDetected: S.Finite,
    strictFailure: S.Boolean,
    changedFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    blockingFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    informationalFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    rewritableFiles: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    blockingFindings: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    informationalFindings: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    rewritableFindings: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("TerseEffectRulesSummary", {
    description: "Summary of terse Effect style migration results.",
  })
) {}

const THUNK_HELPER_NAMES = [
  "thunkUndefined",
  "thunkEmptyStr",
  "thunkNull",
  "thunkTrue",
  "thunkFalse",
  "thunk0",
] as const;

type ThunkHelperName = (typeof THUNK_HELPER_NAMES)[number];

const OPTION_MATCH_HANDLER_NAMES = ["onNone", "onSome"] as const;

const BOOL_MATCH_HANDLER_NAMES = ["onFalse", "onTrue"] as const;

const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;

const findingText = (sourceFile: import("ts-morph").SourceFile, filePath: string, kind: string, node: Node): string => {
  const position = sourceFile.getLineAndColumnAtPos(node.getStart());
  return `${filePath}:${position.line}:${position.column} ${kind}`;
};

const getCallExpressionArgument = (callExpression: CallExpression, index: number): O.Option<import("ts-morph").Node> =>
  A.get(callExpression.getArguments(), index);

const getSimpleIdentifierParameterName = (arrowFunction: ArrowFunction): O.Option<string> => {
  const parameters = arrowFunction.getParameters();
  if (parameters.length !== 1) {
    return O.none();
  }

  const parameter = parameters[0];
  if (
    P.isUndefined(parameter) ||
    !Node.isIdentifier(parameter.getNameNode()) ||
    P.isNotUndefined(parameter.getInitializer()) ||
    parameter.hasQuestionToken() ||
    parameter.isRestParameter()
  ) {
    return O.none();
  }

  return O.some(parameter.getName());
};

const typeArgumentSuffix = (callExpression: CallExpression): string =>
  pipe(
    callExpression.getTypeArguments(),
    A.match({
      onEmpty: thunkEmptyStr,
      onNonEmpty: (typeArguments) =>
        `<${pipe(
          typeArguments,
          A.map((typeArgument) => typeArgument.getText()),
          A.join(", ")
        )}>`,
    })
  );

const getZeroArgHelperReference = (callExpression: CallExpression): O.Option<string> => {
  const expression = callExpression.getExpression();

  if (!Node.isPropertyAccessExpression(expression) || callExpression.getArguments().length !== 0) {
    return O.none();
  }

  const receiverText = expression.getExpression().getText();
  const propertyText = expression.getName();

  if ((receiverText === "A" && propertyText === "empty") || (receiverText === "O" && propertyText === "none")) {
    return O.some(`${receiverText}.${propertyText}${typeArgumentSuffix(callExpression)}`);
  }

  return O.none();
};

const getSingleArgHelperReference = (callExpression: CallExpression, parameterName: string): O.Option<string> => {
  const expression = callExpression.getExpression();
  const argumentsList = callExpression.getArguments();

  if (
    !Node.isPropertyAccessExpression(expression) ||
    argumentsList.length !== 1 ||
    !pipe(
      getCallExpressionArgument(callExpression, 0),
      O.exists((argument) => Node.isIdentifier(argument) && argument.getText() === parameterName)
    )
  ) {
    return O.none();
  }

  const receiverText = expression.getExpression().getText();
  const propertyText = expression.getName();
  const suffix = typeArgumentSuffix(callExpression);

  if (receiverText === "A" && propertyText === "make") {
    return O.some(`A.of${suffix}`);
  }

  if (receiverText === "O" && propertyText === "some") {
    return O.some(`O.some${suffix}`);
  }

  return O.none();
};

const getArrowReplacement = (arrowFunction: ArrowFunction): O.Option<string> => {
  const body = arrowFunction.getBody();
  if (!Node.isCallExpression(body)) {
    return O.none();
  }

  if (arrowFunction.getParameters().length === 0) {
    return getZeroArgHelperReference(body);
  }

  return pipe(
    getSimpleIdentifierParameterName(arrowFunction),
    O.flatMap((parameterName) => getSingleArgHelperReference(body, parameterName))
  );
};

const getImportedThunkHelperAliases = (sourceFile: import("ts-morph").SourceFile): HashMap.HashMap<string, string> => {
  let aliases = HashMap.empty<string, string>();

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    if (importDeclaration.getModuleSpecifierValue() !== "@beep/utils" || importDeclaration.isTypeOnly()) {
      continue;
    }

    for (const importSpecifier of importDeclaration.getNamedImports()) {
      if (importSpecifier.isTypeOnly()) {
        continue;
      }

      const importedName = importSpecifier.getName();
      if (!A.some(THUNK_HELPER_NAMES, (helperName) => helperName === importedName)) {
        continue;
      }

      aliases = HashMap.set(aliases, importedName, importSpecifier.getAliasNode()?.getText() ?? importedName);
    }
  }

  return aliases;
};

const getLiteralThunkHelperName = (expression: import("ts-morph").Node): O.Option<ThunkHelperName> => {
  if (Node.isIdentifier(expression) && expression.getText() === "undefined") {
    return O.some("thunkUndefined");
  }

  if (Node.isStringLiteral(expression) && expression.getLiteralText() === "") {
    return O.some("thunkEmptyStr");
  }

  if (expression.getKind() === SyntaxKind.NullKeyword) {
    return O.some("thunkNull");
  }

  if (expression.getKind() === SyntaxKind.TrueKeyword) {
    return O.some("thunkTrue");
  }

  if (expression.getKind() === SyntaxKind.FalseKeyword) {
    return O.some("thunkFalse");
  }

  if (Node.isNumericLiteral(expression) && expression.getText() === "0") {
    return O.some("thunk0");
  }

  return O.none();
};

const getThunkHelperReplacement = (
  arrowFunction: ArrowFunction,
  thunkHelperAliases: HashMap.HashMap<string, string>
): O.Option<string> => {
  if (arrowFunction.getParameters().length !== 0) {
    return O.none();
  }

  return pipe(
    getLiteralThunkHelperName(arrowFunction.getBody()),
    O.flatMap((helperName) => HashMap.get(thunkHelperAliases, helperName))
  );
};

const nodeContainsIdentifier = (node: import("ts-morph").Node, identifierName: string): boolean =>
  (Node.isIdentifier(node) && node.getText() === identifierName) ||
  pipe(
    node.getDescendantsOfKind(SyntaxKind.Identifier),
    A.some((identifier) => identifier.getText() === identifierName)
  );

const isFlowCandidate = (arrowFunction: ArrowFunction): boolean =>
  pipe(
    getSimpleIdentifierParameterName(arrowFunction),
    O.flatMap((parameterName) => {
      const body = arrowFunction.getBody();
      if (!Node.isCallExpression(body)) {
        return O.none();
      }

      const expression = body.getExpression();
      if (!Node.isIdentifier(expression) || expression.getText() !== "pipe") {
        return O.none();
      }

      return pipe(
        getCallExpressionArgument(body, 0),
        O.filter(Node.isIdentifier),
        O.filter((firstArgument) => firstArgument.getText() === parameterName),
        O.filter(() =>
          pipe(
            body.getArguments(),
            A.drop(1),
            A.every((argument) => !nodeContainsIdentifier(argument, parameterName))
          )
        )
      );
    }),
    O.isSome
  );

const isKnownMatcherExpression = (
  callExpression: CallExpression,
  receiverNames: ReadonlyArray<string>,
  propertyName: string
): boolean => {
  const expression = callExpression.getExpression();

  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== propertyName) {
    return false;
  }

  const receiverText = expression.getExpression().getText();
  return A.some(receiverNames, (receiverName) => receiverName === receiverText);
};

const isOptionMatchExpression = (callExpression: CallExpression): boolean =>
  isKnownMatcherExpression(callExpression, ["O", "Option"], "match");

const isBoolMatchExpression = (callExpression: CallExpression): boolean =>
  isKnownMatcherExpression(callExpression, ["Bool", "Boolean"], "match");

const getMatcherHandlers = (
  callExpression: CallExpression,
  isMatcherExpression: (callExpression: CallExpression) => boolean
): O.Option<ObjectLiteralExpression> => {
  if (!isMatcherExpression(callExpression)) {
    return O.none();
  }

  return pipe(
    getCallExpressionArgument(callExpression, 1),
    O.orElse(() => getCallExpressionArgument(callExpression, 0)),
    O.filter(Node.isObjectLiteralExpression)
  );
};

const getOptionMatchHandlers = (callExpression: CallExpression): O.Option<ObjectLiteralExpression> =>
  getMatcherHandlers(callExpression, isOptionMatchExpression);

const getBoolMatchHandlers = (callExpression: CallExpression): O.Option<ObjectLiteralExpression> =>
  getMatcherHandlers(callExpression, isBoolMatchExpression);

const getPropertyInitializer = (
  objectLiteral: ObjectLiteralExpression,
  propertyName: string
): O.Option<import("ts-morph").Node> =>
  pipe(
    objectLiteral.getProperties(),
    A.findFirst((property) => Node.isPropertyAssignment(property) && property.getName() === propertyName),
    O.flatMap((property) =>
      Node.isPropertyAssignment(property) ? O.fromNullishOr(property.getInitializer()) : O.none()
    )
  );

const getHandlerInitializers = (
  objectLiteral: ObjectLiteralExpression,
  handlerNames: ReadonlyArray<string>
): ReadonlyArray<import("ts-morph").Node> =>
  pipe(
    handlerNames,
    A.flatMap((handlerName) =>
      pipe(
        getPropertyInitializer(objectLiteral, handlerName),
        O.match({
          onNone: A.empty<import("ts-morph").Node>,
          onSome: A.of,
        })
      )
    )
  );

const getObjectLiteralArrowBody = (node: import("ts-morph").Node): O.Option<ObjectLiteralExpression> => {
  if (!Node.isArrowFunction(node)) {
    return O.none();
  }

  const body = node.getBody();
  if (Node.isObjectLiteralExpression(body)) {
    return O.some(body);
  }

  if (Node.isParenthesizedExpression(body)) {
    const expression = body.getExpression();
    if (Node.isObjectLiteralExpression(expression)) {
      return O.some(expression);
    }
  }

  return O.none();
};

const isEmptyObjectThunk = (node: import("ts-morph").Node): boolean =>
  pipe(
    getObjectLiteralArrowBody(node),
    O.exists((body) => A.length(body.getProperties()) === 0)
  );

const isObjectLiteralThunk = (node: import("ts-morph").Node): boolean =>
  pipe(
    getObjectLiteralArrowBody(node),
    O.exists((body) => A.length(body.getProperties()) > 0)
  );

const isOptionObjectCompactionCandidate = (callExpression: CallExpression): boolean =>
  pipe(
    getOptionMatchHandlers(callExpression),
    O.flatMap((handlers) =>
      pipe(
        O.all({
          onNone: getPropertyInitializer(handlers, "onNone"),
          onSome: getPropertyInitializer(handlers, "onSome"),
        }),
        O.filter(({ onNone, onSome }) => isEmptyObjectThunk(onNone) && isObjectLiteralThunk(onSome))
      )
    ),
    O.isSome
  );

const unwrapParenthesizedExpression = (node: import("ts-morph").Node): import("ts-morph").Node =>
  Node.isParenthesizedExpression(node) ? unwrapParenthesizedExpression(node.getExpression()) : node;

const isUndefinedIdentifier = (node: import("ts-morph").Node): boolean =>
  Node.isIdentifier(node) && node.getText() === "undefined";

const isEmptyObjectLiteral = (node: import("ts-morph").Node): boolean => {
  const expression = unwrapParenthesizedExpression(node);
  return Node.isObjectLiteralExpression(expression) && A.length(expression.getProperties()) === 0;
};

const isSinglePropertyObjectLiteral = (node: import("ts-morph").Node): boolean => {
  const expression = unwrapParenthesizedExpression(node);
  return Node.isObjectLiteralExpression(expression) && A.length(expression.getProperties()) === 1;
};

const isConditionalOptionalObjectSpreadCandidate = (spreadAssignment: import("ts-morph").SpreadAssignment): boolean => {
  const parent = spreadAssignment.getParent();
  if (!Node.isObjectLiteralExpression(parent)) {
    return false;
  }

  const expression = unwrapParenthesizedExpression(spreadAssignment.getExpression());
  if (!Node.isConditionalExpression(expression)) {
    return false;
  }

  const condition = unwrapParenthesizedExpression(expression.getCondition());
  if (!Node.isBinaryExpression(condition)) {
    return false;
  }

  const operator = condition.getOperatorToken().getText();
  if (operator !== "===" && operator !== "!==") {
    return false;
  }

  const comparesWithUndefined =
    isUndefinedIdentifier(condition.getLeft()) || isUndefinedIdentifier(condition.getRight());
  if (!comparesWithUndefined) {
    return false;
  }

  const emptyBranch = operator === "===" ? expression.getWhenTrue() : expression.getWhenFalse();
  const objectBranch = operator === "===" ? expression.getWhenFalse() : expression.getWhenTrue();

  return isEmptyObjectLiteral(emptyBranch) && isSinglePropertyObjectLiteral(objectBranch);
};

const nodeContainsCallExpression = (
  node: import("ts-morph").Node,
  predicate: (callExpression: CallExpression) => boolean
): boolean =>
  (Node.isCallExpression(node) && predicate(node)) ||
  pipe(node.getDescendantsOfKind(SyntaxKind.CallExpression), A.some(predicate));

const isNestedMatcherCandidate = (
  callExpression: CallExpression,
  getHandlers: (callExpression: CallExpression) => O.Option<ObjectLiteralExpression>,
  isMatcherExpression: (callExpression: CallExpression) => boolean,
  handlerNames: ReadonlyArray<string>
): boolean =>
  pipe(
    getHandlers(callExpression),
    O.exists((handlers) =>
      pipe(
        getHandlerInitializers(handlers, handlerNames),
        A.some((handler) => nodeContainsCallExpression(handler, isMatcherExpression))
      )
    )
  );

const isNestedOptionMatchCandidate = (callExpression: CallExpression): boolean =>
  isNestedMatcherCandidate(callExpression, getOptionMatchHandlers, isOptionMatchExpression, OPTION_MATCH_HANDLER_NAMES);

const isNestedBoolMatchCandidate = (callExpression: CallExpression): boolean =>
  isNestedMatcherCandidate(callExpression, getBoolMatchHandlers, isBoolMatchExpression, BOOL_MATCH_HANDLER_NAMES);

const hasFunctionReturnType = (functionDeclaration: FunctionDeclaration): boolean =>
  pipe(O.fromNullishOr(functionDeclaration.getReturnTypeNode()), O.exists(Node.isFunctionTypeNode));

const isExplicitDualOverloadCandidate = (functionDeclaration: FunctionDeclaration): boolean => {
  if (!functionDeclaration.isExported() || P.isUndefined(functionDeclaration.getBody())) {
    return false;
  }

  const overloads = functionDeclaration.getOverloads();
  const dataFirstParameterCounts = pipe(
    overloads,
    A.filter((overload) => !hasFunctionReturnType(overload)),
    A.map((overload) => overload.getParameters().length)
  );
  const dataLastParameterCounts = pipe(
    overloads,
    A.filter(hasFunctionReturnType),
    A.filter((overload) => overload.getParameters().length > 0),
    A.map((overload) => overload.getParameters().length)
  );

  return pipe(
    dataLastParameterCounts,
    A.some((dataLastParameterCount) =>
      pipe(
        dataFirstParameterCounts,
        A.some((dataFirstParameterCount) => dataLastParameterCount < dataFirstParameterCount)
      )
    )
  );
};

/**
 * Run terse Effect style migration/check logic.
 *
 * **Example** (Reference the terse-effect rules runner)
 *
 * ```ts
 * console.log("runTerseEffectRules")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runTerseEffectRules = Effect.fn(function* (options: TerseEffectRulesOptions) {
  const path = yield* Path.Path;

  const isExcludedFile = (filePath: string): boolean => isExcludedLawScanPath(options.excludePaths, filePath);

  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  for (const pattern of options.includePaths ?? INCLUDED_GLOBS) {
    project.addSourceFilesAtPaths(pattern);
  }

  const sourceFiles = A.filter(project.getSourceFiles(), (sourceFile) => !isExcludedFile(sourceFile.getFilePath()));

  let helpersSimplified = 0;
  let thunkHelpersSimplified = 0;
  let flowCandidatesDetected = 0;
  let optionObjectCompactionCandidatesDetected = 0;
  let conditionalOptionalObjectSpreadCandidatesDetected = 0;
  let nestedOptionMatchCandidatesDetected = 0;
  let nestedBoolMatchCandidatesDetected = 0;
  let dualOverloadCandidatesDetected = 0;
  let touchedFiles = 0;
  let changedFiles = A.empty<string>();
  let blockingFiles = A.empty<string>();
  let informationalFiles = A.empty<string>();
  let rewritableFiles = A.empty<string>();
  let blockingFindings = A.empty<string>();
  let informationalFindings = A.empty<string>();
  let rewritableFindings = A.empty<string>();

  for (const sourceFile of sourceFiles) {
    const sourceFilePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    let fileTouched = false;
    let fileMutated = false;
    let fileHasBlockingCandidate = false;
    const fileHasInformationalCandidate = false;
    let fileHasRewritableCandidate = false;
    let fileBlockingFindings = A.empty<string>();
    const fileInformationalFindings = A.empty<string>();
    let fileRewritableFindings = A.empty<string>();
    const thunkHelperAliases = getImportedThunkHelperAliases(sourceFile);
    const arrowFunctions = A.sort(
      sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      Order.mapInput(Order.Number, (arrowFunction: ArrowFunction) => -arrowFunction.getStart())
    );

    for (const arrowFunction of arrowFunctions) {
      if (
        pipe(
          getArrowReplacement(arrowFunction),
          O.map((replacement) => {
            const finding = findingText(sourceFile, sourceFilePath, "helper-ref", arrowFunction);
            if (options.write) {
              arrowFunction.replaceWithText(replacement);
              fileMutated = true;
            }
            helpersSimplified += 1;
            fileTouched = true;
            fileHasBlockingCandidate = true;
            fileHasRewritableCandidate = true;
            fileBlockingFindings = A.append(fileBlockingFindings, finding);
            fileRewritableFindings = A.append(fileRewritableFindings, finding);
          }),
          O.isSome
        )
      ) {
        continue;
      }

      if (
        pipe(
          getThunkHelperReplacement(arrowFunction, thunkHelperAliases),
          O.map((replacement) => {
            const finding = findingText(sourceFile, sourceFilePath, "thunk-helper", arrowFunction);
            if (options.write) {
              arrowFunction.replaceWithText(replacement);
              fileMutated = true;
            }
            thunkHelpersSimplified += 1;
            fileTouched = true;
            fileHasBlockingCandidate = true;
            fileHasRewritableCandidate = true;
            fileBlockingFindings = A.append(fileBlockingFindings, finding);
            fileRewritableFindings = A.append(fileRewritableFindings, finding);
          }),
          O.isSome
        )
      ) {
        continue;
      }

      if (isFlowCandidate(arrowFunction)) {
        const finding = findingText(sourceFile, sourceFilePath, "flow-candidate", arrowFunction);
        flowCandidatesDetected += 1;
        fileTouched = true;
        fileHasBlockingCandidate = true;
        fileBlockingFindings = A.append(fileBlockingFindings, finding);
      }
    }

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (isOptionObjectCompactionCandidate(callExpression)) {
        optionObjectCompactionCandidatesDetected += 1;
        fileTouched = true;
        fileHasBlockingCandidate = true;
        fileBlockingFindings = A.append(
          fileBlockingFindings,
          findingText(sourceFile, sourceFilePath, "option-object-compaction", callExpression)
        );
      }

      if (isNestedOptionMatchCandidate(callExpression)) {
        nestedOptionMatchCandidatesDetected += 1;
        fileTouched = true;
        fileHasBlockingCandidate = true;
        fileBlockingFindings = A.append(
          fileBlockingFindings,
          findingText(sourceFile, sourceFilePath, "nested-option-match", callExpression)
        );
      }

      if (isNestedBoolMatchCandidate(callExpression)) {
        nestedBoolMatchCandidatesDetected += 1;
        fileTouched = true;
        fileHasBlockingCandidate = true;
        fileBlockingFindings = A.append(
          fileBlockingFindings,
          findingText(sourceFile, sourceFilePath, "nested-bool-match", callExpression)
        );
      }
    }

    for (const spreadAssignment of sourceFile.getDescendantsOfKind(SyntaxKind.SpreadAssignment)) {
      if (isConditionalOptionalObjectSpreadCandidate(spreadAssignment)) {
        conditionalOptionalObjectSpreadCandidatesDetected += 1;
        fileTouched = true;
        fileHasBlockingCandidate = true;
        fileBlockingFindings = A.append(
          fileBlockingFindings,
          findingText(sourceFile, sourceFilePath, "conditional-optional-object-spread", spreadAssignment)
        );
      }
    }

    for (const functionDeclaration of sourceFile.getFunctions()) {
      if (isExplicitDualOverloadCandidate(functionDeclaration)) {
        dualOverloadCandidatesDetected += 1;
        fileTouched = true;
        fileHasBlockingCandidate = true;
        fileBlockingFindings = A.append(
          fileBlockingFindings,
          findingText(sourceFile, sourceFilePath, "dual-overload", functionDeclaration)
        );
      }
    }

    if (fileMutated) {
      sourceFile.organizeImports();
    }

    if (fileTouched) {
      touchedFiles += 1;
      changedFiles = A.append(changedFiles, sourceFilePath);
      if (fileHasBlockingCandidate) {
        blockingFiles = A.append(blockingFiles, sourceFilePath);
        blockingFindings = A.appendAll(blockingFindings, fileBlockingFindings);
      }
      if (fileHasInformationalCandidate) {
        informationalFiles = A.append(informationalFiles, sourceFilePath);
        informationalFindings = A.appendAll(informationalFindings, fileInformationalFindings);
      }
      if (fileHasRewritableCandidate) {
        rewritableFiles = A.append(rewritableFiles, sourceFilePath);
        rewritableFindings = A.appendAll(rewritableFindings, fileRewritableFindings);
      }
    }
  }

  if (options.write) {
    yield* Effect.tryPromise({
      try: () => project.save(),
      catch: (cause) =>
        TerseEffectRulesPersistenceError.new(
          `Failed to persist terse Effect style updates: ${Inspectable.toStringUnknown(cause, 0)}`
        ),
    });
  }

  const strictFailure =
    options.strictCheck &&
    (helpersSimplified > 0 ||
      thunkHelpersSimplified > 0 ||
      flowCandidatesDetected > 0 ||
      optionObjectCompactionCandidatesDetected > 0 ||
      conditionalOptionalObjectSpreadCandidatesDetected > 0 ||
      nestedOptionMatchCandidatesDetected > 0 ||
      nestedBoolMatchCandidatesDetected > 0 ||
      dualOverloadCandidatesDetected > 0);

  return TerseEffectRulesSummary.make({
    touchedFiles,
    helpersSimplified,
    thunkHelpersSimplified,
    flowCandidatesDetected,
    optionObjectCompactionCandidatesDetected,
    conditionalOptionalObjectSpreadCandidatesDetected,
    nestedOptionMatchCandidatesDetected,
    nestedBoolMatchCandidatesDetected,
    dualOverloadCandidatesDetected,
    strictFailure,
    changedFiles,
    blockingFiles,
    informationalFiles,
    rewritableFiles,
    blockingFindings,
    informationalFindings,
    rewritableFindings,
  });
});
